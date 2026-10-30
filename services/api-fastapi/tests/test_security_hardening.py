import importlib
from datetime import datetime, timezone
from io import BytesIO
from types import SimpleNamespace

import anyio
import pytest
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.datastructures import Headers

from app import fallback
from app.models.booking import BookingCreate, BookingStatusUpdate
from app.models.coach import CoachDetailUpdate
from app.models.diet import DietLogCreate
from app.routers import bookings, diet


COACH = fallback.SAMPLE_COACHES[0]["id"]
MEAL = {
    "meal_type": "lunch", "food_name": "rice", "calories": 300,
    "macronutrients": {"protein": 10, "fat": 5, "carb": 50, "fiber": 2},
}
PNG = b"\x89PNG\r\n\x1a\npayload"
JPEG = b"\xff\xd8\xffpayload"
WEBP = b"RIFF\x0b\x00\x00\x00WEBPpayload"


@pytest.mark.parametrize("payload", [
    {"message": ""}, {"message": " \n\t "}, {"message": "x" * 2001},
    {"message": "hello", "context_type": "unknown"},
])
def test_invalid_chat_never_calls_model(demo_app, monkeypatch, payload):
    # Given: a model call is forbidden for invalid input.
    async def forbidden(*_):
        pytest.fail("Invalid chat reached the model")

    monkeypatch.setattr(diet, "generate_diet_response", forbidden)
    # When: the request crosses the HTTP validation boundary.
    with TestClient(demo_app.app) as client:
        response = client.post("/api/v1/diet/chat", json=payload)
    # Then: validation rejects it before model execution.
    assert response.status_code == 422


@pytest.mark.parametrize("context", ["diet", "workout", "clothing", "general"])
def test_valid_chat_trims_message_and_accepts_db_context(demo_app, monkeypatch, context):
    # Given: the model records the normalized prompt.
    prompts = []

    async def reply(message, *_):
        prompts.append(message)
        return "answer", []

    monkeypatch.setattr(diet, "generate_diet_response", reply)
    # When: a maximum-length prompt has surrounding whitespace.
    with TestClient(demo_app.app) as client:
        response = client.post("/api/v1/diet/chat", json={
            "message": " " + "x" * 2000 + "\n", "context_type": context,
        })
    # Then: a supported context and stripped prompt are accepted.
    assert response.status_code == 200
    assert prompts == ["x" * 2000]


@pytest.mark.parametrize("real", [False, True])
@pytest.mark.parametrize("start,expected", [
    ("2026-10-28T23:59:59Z", 422),
    ("2026-10-29T08:00:00+09:00", 422),
    ("2026-10-28T23:59:59", 422),
    ("2026-11-02T10:00:00Z", 200),
    ("2026-11-02T10:00:00", 200),
])
def test_booking_time_checked_before_any_insert(demo_app, monkeypatch, real, start, expected):
    # Given: a fixed UTC clock and isolated demo/remote stores.
    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 10, 29, tzinfo=timezone.utc).astimezone(tz)

    monkeypatch.setattr(bookings, "datetime", Clock)
    monkeypatch.setattr(fallback, "_BOOKINGS", [])
    inserted = []

    class Query:
        def select(self, *_):
            return self

        def eq(self, *_):
            return self

        def limit(self, *_):
            return self

        def insert(self, row):
            inserted.append({
                **row, "id": "10000000-0000-4000-8000-000000000001",
                "created_at": "2026-10-29T00:00:00Z",
            })
            return self

        def execute(self):
            return SimpleNamespace(data=inserted or [{
                "is_verified": True, "role": "coach", "base_price": 60000,
            }])

    async def skipped(*_):
        return "skipped"

    if real:
        demo_app.app.dependency_overrides[bookings.get_current_user] = lambda: SimpleNamespace(
            id="00000000-0000-0000-0000-000000000099",
        )
    monkeypatch.setattr(bookings, "get_optional_supabase", lambda: SimpleNamespace(table=lambda _: Query()))
    monkeypatch.setattr(bookings, "notify_booking", lambda *_: None)
    monkeypatch.setattr(bookings, "publish_booking_change", skipped)
    # When: a member requests the given time.
    try:
        with TestClient(demo_app.app) as client:
            response = client.post("/api/v1/bookings", json={
                "coach_id": COACH, "scheduled_at": start,
            })
    finally:
        demo_app.app.dependency_overrides.clear()
    # Then: past requests cannot write to either store.
    assert response.status_code == expected, response.text
    assert len(inserted if real else fallback._BOOKINGS) == (1 if expected == 200 else 0)
    if expected == 422:
        assert response.json() == {"detail": "Booking time must be in the future"}


@pytest.mark.parametrize("model,payload", [
    (BookingCreate, {"coach_id": COACH, "scheduled_at": "2030-01-01", "notes": "x" * 501}),
    (BookingStatusUpdate, {"status": "confirmed", "coach_notes": "x" * 501}),
    *[(DietLogCreate, {**MEAL, **update}) for update in [
        {"food_name": ""}, {"food_name": "x" * 101}, {"calories": -1},
        {"calories": 10001}, {"ai_analysis": "x" * 2001},
        *[{"macronutrients": {key: value}} for key in ["protein", "fat", "carb", "fiber"]
          for value in [-1, 2001, "10", True, float("inf"), float("nan")]],
        {"macronutrients": {"unknown": 1}},
    ]],
    *[(CoachDetailUpdate, {"video_url": url}) for url in [
        "javascript:alert(1)", "http://example.com/video", "https://",
        "https://example.com/" + "x" * 481,
    ]],
])
def test_invalid_bounded_fields_fail_validation(model, payload):
    # Given/When: invalid untrusted input is parsed.
    with pytest.raises(ValidationError):
        model.model_validate(payload)
    # Then: no invalid model is produced.


def test_valid_bounded_fields_preserve_existing_shapes():
    # Given: exact upper limits and supported optional values.
    payload = {"coach_id": COACH, "scheduled_at": "2030-01-01", "notes": "x" * 500}
    # When: valid values cross the model boundary.
    booking = BookingCreate.model_validate(payload)
    update = BookingStatusUpdate(status="confirmed", coach_notes="x" * 500)
    meal = DietLogCreate.model_validate({
        **MEAL, "food_name": "x" * 100, "calories": 10000,
        "ai_analysis": "x" * 2000,
        "macronutrients": {"protein": 0, "fat": 2000, "carb": 1.5, "fiber": 2},
    })
    url = "https://example.com/" + "x" * 480
    coach = CoachDetailUpdate(video_url=url)
    # Then: dict and string serialization stays compatible.
    assert booking.notes == payload["notes"]
    assert len(update.coach_notes) == 500
    assert meal.model_dump()["macronutrients"] == {"protein": 0, "fat": 2000, "carb": 1.5, "fiber": 2}
    assert coach.model_dump()["video_url"] == url
    assert CoachDetailUpdate(video_url=None).video_url is None
    assert BookingCreate(**{**payload, "notes": None}).notes is None
    assert BookingStatusUpdate(status="confirmed", coach_notes=None).coach_notes is None
    assert DietLogCreate(**{**MEAL, "calories": 0, "ai_analysis": None}).calories == 0


@pytest.mark.parametrize("mime,content,expected", [
    ("image/jpeg", JPEG, 200), ("image/png", PNG, 200), ("image/webp", WEBP, 200),
    ("image/jpeg", PNG, 400), ("image/png", WEBP, 400),
    ("image/webp", JPEG, 400), ("image/png", b"not an image", 400),
    ("image/svg+xml", b"<svg/>", 400), ("image/x; foo", JPEG, 400),
    ("image/png", b"", 400),
])
@pytest.mark.parametrize("field", ["image", "file"])
def test_image_type_is_verified_before_analysis(demo_app, monkeypatch, mime, content, expected, field):
    # Given: the external model is replaced at its call boundary.
    analyzed = []

    async def analyze(data, _):
        analyzed.append(data)
        return {"ai_analysis": "meal", "image_data_url": "untrusted"}

    monkeypatch.setattr(diet, "analyze_food_image", analyze)
    # When: a multipart image reaches the real route.
    with TestClient(demo_app.app) as client:
        response = client.post("/api/v1/diet/analyze-image", files={field: ("meal", content, mime)})
    # Then: only matching supported signatures reach analysis.
    assert response.status_code == expected
    assert analyzed == ([content] if expected == 200 else [])
    if expected == 200:
        assert response.json()["image_data_url"].startswith(f"data:{mime};base64,")


@pytest.mark.parametrize("extra,expected", [(0, 200), (1, 413), (100, 413)])
def test_image_reader_stops_at_size_cap(demo_app, monkeypatch, extra, expected):
    # Given: a real UploadFile containing an image at or beyond the cap.
    monkeypatch.setattr(diet, "MAX_UPLOAD_SIZE", 32)
    stream = BytesIO(PNG + b"x" * (32 - len(PNG) + extra))
    upload = UploadFile(stream, headers=Headers({"content-type": "image/png"}))

    async def analyze(*_):
        return {"ai_analysis": "meal"}

    monkeypatch.setattr(diet, "analyze_food_image", analyze)

    async def invoke():
        return await diet.analyze_diet_image(
            image=upload, current_user=SimpleNamespace(id=fallback.DEMO_USER_ID),
        )

    # When: the upload is read by the handler.
    if expected == 413:
        with pytest.raises(HTTPException) as error:
            anyio.run(invoke)
        assert error.value.status_code == 413
    else:
        assert anyio.run(invoke)["image_data_url"].startswith("data:image/png;base64,")
    # Then: at most cap + 1 bytes have been consumed.
    assert stream.tell() == min(32 + extra, 33)


@pytest.mark.parametrize("production", [False, True])
@pytest.mark.parametrize("ready", [False, True])
def test_documentation_and_status_visibility(demo_app, monkeypatch, production, ready):
    # Given: isolated configuration with valid synthetic production settings.
    import app.config as config
    import main

    settings = config.settings.model_copy(update={
        "environment": "production" if production else "test",
        "enable_demo_fallback": False,
        "supabase_url": "https://test.invalid", "supabase_service_role_key": "test-key",
        "jwt_secret": "test-secret", "database_url": "postgresql://db/fitconnect",
        "redis_url": "redis://cache:6379/0", "allowed_origins": "https://test.invalid",
        "chat_provider": "ollama",
    })
    try:
        with monkeypatch.context() as patch:
            patch.setattr(config, "settings", settings)
            importlib.reload(main)
            patch.setattr(main, "dependency_status", lambda: {
                "supabase": {"configured": ready},
                "production": {"config_errors": [] if ready else ["private config error"]},
            })
            # When: public docs and both status aliases are requested.
            with TestClient(main.app) as client:
                for path in ["/docs", "/redoc", "/openapi.json"]:
                    assert client.get(path).status_code == (404 if production else 200)
                for path in ["/health", "/api/v1/health", "/ready", "/api/v1/ready"]:
                    response = client.get(path)
                    # Then: production hides details while retaining readiness status.
                    assert response.status_code == (503 if path.endswith("ready") and not ready else 200)
                    body = response.json()
                    assert ("dependencies" in body) is not production
                    if production:
                        assert set(body) == {"status", "version"}
                    assert body["status"] == (
                        ("ready" if ready else "not_ready") if path.endswith("ready") else "healthy"
                    )
    finally:
        importlib.reload(main)
