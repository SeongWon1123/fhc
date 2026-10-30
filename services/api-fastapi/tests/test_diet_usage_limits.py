from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.routers import diet
from app.services import usage_limits


ACTOR = "00000000-0000-0000-0000-000000000099"
PNG = b"\x89PNG\r\n\x1a\npayload"


@pytest.fixture(autouse=True)
def isolated_usage(monkeypatch):
    class Clock(datetime):
        instant = datetime(2026, 10, 29, 15, tzinfo=timezone.utc)

        @classmethod
        def now(cls, tz=None):
            return cls.instant.astimezone(tz)

    monkeypatch.setattr(usage_limits, "datetime", Clock)
    monkeypatch.setattr(usage_limits.image_usage, "_counts", {})
    monkeypatch.setattr(usage_limits.demo_chat_usage, "_counts", {})
    return Clock


@pytest.fixture
def chat_store(strict_app, monkeypatch):
    state = SimpleNamespace(rows=[], queries=[], failure=None, missing_count=False, calls=[])

    class Query:
        def __init__(self, table):
            self.table = table
            self.filters = {}
            self.start = None
            self.count = None
            self.inserted = None

        def select(self, columns, *, count=None):
            self.count = count
            state.queries.append((self.table, columns, count, self))
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def gte(self, key, value):
            assert key == "created_at"
            self.start = datetime.fromisoformat(value)
            return self

        def single(self):
            return self

        def order(self, *_, **__):
            return self

        def limit(self, _):
            return self

        def insert(self, rows):
            self.inserted = rows
            return self

        def execute(self):
            if self.count and state.failure:
                raise state.failure
            if self.inserted is not None:
                return SimpleNamespace(data=self.inserted)
            if self.table == "profiles":
                return SimpleNamespace(data={})
            rows = [
                row for row in state.rows
                if all(row.get(key) == value for key, value in self.filters.items())
                and (self.start is None or datetime.fromisoformat(row["created_at"]) >= self.start)
            ]
            return SimpleNamespace(
                data=rows,
                count=None if state.missing_count else len(rows),
            )

    async def reply(*args):
        state.calls.append(args)
        return "answer", []

    strict_app.app.dependency_overrides[diet.get_current_user] = lambda: SimpleNamespace(id=ACTOR)
    monkeypatch.setattr(diet, "get_optional_supabase", lambda: SimpleNamespace(table=Query))
    monkeypatch.setattr(diet, "generate_diet_response", reply)
    monkeypatch.setattr(diet.settings, "diet_chat_daily_limit", 2)
    try:
        yield strict_app, state
    finally:
        strict_app.app.dependency_overrides.clear()


@pytest.mark.parametrize("count,expected", [(1, 200), (2, 429), (3, 429)])
def test_chat_checks_daily_count_before_model(chat_store, count, expected):
    # Given: today's user messages span sessions; other roles/users/days do not count.
    app, state = chat_store
    row = {
        "user_id": ACTOR, "role": "user", "content": "meal",
        "session_id": "another-session", "created_at": "2026-10-30T00:00:00+09:00",
    }
    state.rows = [dict(row) for _ in range(count)] + [
        {**row, "role": "assistant"}, {**row, "user_id": "someone-else"},
        {**row, "created_at": "2026-10-29T23:59:59+09:00"},
    ]
    # When: the real route receives a valid chat.
    with TestClient(app.app) as client:
        response = client.post("/api/v1/diet/chat", json={"message": "lunch"})
    # Then: only requests below the limit reach the model.
    assert response.status_code == expected
    assert len(state.calls) == (1 if expected == 200 else 0)
    if expected == 429:
        assert response.json()["detail"] == "Daily diet chat limit reached"
    table, columns, count_mode, query = state.queries[0]
    assert (table, columns, count_mode) == ("chat_messages", "id", "exact")
    assert query.filters == {"user_id": ACTOR, "role": "user"}


@pytest.mark.parametrize("fallback", [False, True])
@pytest.mark.parametrize("missing_count", [False, True])
def test_chat_count_failure_is_closed(chat_store, monkeypatch, fallback, missing_count):
    # Given: an unavailable count, even when demo fallback is enabled.
    app, state = chat_store
    monkeypatch.setattr(diet.settings, "enable_demo_fallback", fallback)
    state.missing_count = missing_count
    state.failure = None if missing_count else RuntimeError("count unavailable")
    # When: chat attempts its usage query.
    with TestClient(app.app) as client:
        response = client.post("/api/v1/diet/chat", json={"message": "lunch"})
    # Then: no model call is permitted.
    assert response.status_code == 503
    assert state.calls == []


@pytest.mark.parametrize("instant,expected", [
    ("2026-10-29T14:59:59+00:00", "2026-10-29T00:00:00+09:00"),
    ("2026-10-29T15:00:00+00:00", "2026-10-30T00:00:00+09:00"),
])
def test_chat_count_filter_uses_kst_midnight(chat_store, isolated_usage, instant, expected):
    # Given: a fixed instant immediately before or after Korean midnight.
    app, state = chat_store
    isolated_usage.instant = datetime.fromisoformat(instant)
    # When: chat queries today's usage.
    with TestClient(app.app) as client:
        response = client.post("/api/v1/diet/chat", json={"message": "lunch"})
    # Then: the filter carries midnight in Asia/Seoul, not UTC midnight.
    assert response.status_code == 200
    assert state.queries[0][3].start.isoformat() == expected


def test_demo_chat_uses_memory_limit_without_database(demo_app, monkeypatch):
    # Given: demo chat has no database and permits two requests.
    calls = []

    def forbidden():
        pytest.fail("Demo chat must not query Supabase")

    async def reply(*_):
        calls.append(True)
        return "answer", []

    monkeypatch.setattr(diet, "get_optional_supabase", forbidden)
    monkeypatch.setattr(diet, "generate_diet_response", reply)
    monkeypatch.setattr(diet.settings, "diet_chat_daily_limit", 2)
    # When: three valid requests arrive.
    with TestClient(demo_app.app) as client:
        responses = [client.post("/api/v1/diet/chat", json={"message": "lunch"}) for _ in range(3)]
    # Then: the demo path is limited too.
    assert [response.status_code for response in responses] == [200, 200, 429]
    assert len(calls) == 2
    assert responses[-1].json()["detail"] == "Daily diet chat limit reached"


@pytest.fixture
def image_client(demo_app, monkeypatch):
    calls = []

    async def analyze(content, _):
        calls.append(content)
        return {"ai_analysis": "meal"}

    monkeypatch.setattr(diet, "analyze_food_image", analyze)
    monkeypatch.setattr(diet.settings, "diet_image_daily_limit", 2)
    with TestClient(demo_app.app) as client:
        yield client, calls


def upload(client):
    return client.post("/api/v1/diet/analyze-image", files={"image": ("meal.png", PNG, "image/png")})


def test_image_allows_limit_then_rejects_without_model(image_client):
    # Given: a two-image daily allowance.
    client, calls = image_client
    # When: three valid images arrive.
    responses = [upload(client) for _ in range(3)]
    # Then: only accepted requests reach vision.
    assert [response.status_code for response in responses] == [200, 200, 429]
    assert responses[-1].json()["detail"] == "Daily image analysis limit reached"
    assert calls == [PNG, PNG]


def test_image_quota_resets_at_kst_midnight(image_client, isolated_usage):
    # Given: a full quota just before Korean midnight.
    client, calls = image_client
    isolated_usage.instant = datetime(2026, 10, 29, 14, 59, 59, tzinfo=timezone.utc)
    assert upload(client).status_code == 200
    assert upload(client).status_code == 200
    assert upload(client).status_code == 429
    isolated_usage.instant = datetime(2026, 10, 29, 15, tzinfo=timezone.utc)
    # When: the next Korean day begins, still on the same UTC day.
    response = upload(client)
    # Then: the allowance is restored and yesterday's entry is discarded.
    assert response.status_code == 200
    assert len(calls) == 3
    assert all(key[1].isoformat() == "2026-10-30" for key in usage_limits.image_usage._counts)


@pytest.mark.parametrize("files,expected", [
    ({}, 400),
    ({"image": ("meal.svg", b"<svg/>", "image/svg+xml")}, 400),
    ({"image": ("meal.png", b"not png", "image/png")}, 400),
    ({"image": ("meal.jpg", PNG, "image/jpeg")}, 400),
    ({"image": ("meal.png", PNG + b"x" * 32, "image/png")}, 413),
])
def test_rejected_images_do_not_consume_quota(image_client, monkeypatch, files, expected):
    # Given: an empty one-image allowance and an invalid upload.
    client, calls = image_client
    monkeypatch.setattr(diet.settings, "diet_image_daily_limit", 1)
    monkeypatch.setattr(diet, "MAX_UPLOAD_SIZE", 32)
    # When: invalid input precedes a valid image and one over-limit image.
    rejected = client.post("/api/v1/diet/analyze-image", files=files)
    accepted = upload(client)
    limited = upload(client)
    # Then: invalid requests have not consumed the allowance.
    assert rejected.status_code == expected
    assert accepted.status_code == 200
    assert limited.status_code == 429
    assert calls == [PNG]


def test_memory_limit_is_per_user_and_atomic():
    # Given: an isolated limiter shared by concurrent requests.
    limiter = usage_limits.DailyUsageLimiter()
    # When: multiple threads try to consume one user's allowance.
    with ThreadPoolExecutor(max_workers=8) as executor:
        accepted = list(executor.map(lambda _: limiter.consume(ACTOR, 2), range(16)))
    # Then: exactly two succeed and another user has an independent allowance.
    assert sum(accepted) == 2
    assert limiter.consume("other-user", 2)


def test_daily_limits_read_environment(monkeypatch):
    # Given: explicit server configuration.
    from app.config import Settings

    monkeypatch.setenv("DIET_CHAT_DAILY_LIMIT", "7")
    monkeypatch.setenv("DIET_IMAGE_DAILY_LIMIT", "3")
    # When: settings parse the environment.
    settings = Settings(_env_file=None)
    # Then: both limits are configurable.
    assert settings.diet_chat_daily_limit == 7
    assert settings.diet_image_daily_limit == 3


def test_daily_limits_have_defaults(monkeypatch):
    # Given: neither limit is configured.
    from app.config import Settings

    monkeypatch.delenv("DIET_CHAT_DAILY_LIMIT", raising=False)
    monkeypatch.delenv("DIET_IMAGE_DAILY_LIMIT", raising=False)
    # When: settings use their defaults without ambient env files.
    settings = Settings(_env_file=None)
    # Then: the documented allowances apply.
    assert settings.diet_chat_daily_limit == 50
    assert settings.diet_image_daily_limit == 20
