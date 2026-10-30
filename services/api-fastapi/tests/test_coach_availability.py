from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.routers import bookings, coaches

MEMBER = "00000000-0000-0000-0000-0000000000f1"
COACH = "00000000-0000-0000-0000-0000000000f3"


@pytest.fixture
def store(strict_app, monkeypatch):
    tables = {
        "coach_details": [{
            "id": COACH, "base_price": 30000, "is_verified": True,
            "weekly_availability": {"mon": ["09:00", "10:00"], "tue": []},
        }],
        "profiles": [{"id": COACH, "role": "coach"}],
        "bookings": [],
    }

    class Query:
        def __init__(self, table):
            self.table = table
            self.filters = {}
            self.new_row = None
            self.upsert_row = None

        def select(self, columns):
            assert columns == "*"
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def limit(self, _):
            return self

        def insert(self, row):
            self.new_row = row
            return self

        def upsert(self, row):
            self.upsert_row = row
            return self

        def execute(self):
            rows = tables[self.table]
            if self.new_row is not None:
                saved = {
                    "id": "10000000-0000-4000-8000-000000000001",
                    "created_at": "2026-10-29T00:00:00Z",
                    **self.new_row,
                }
                rows.append(saved)
                return SimpleNamespace(data=[saved])
            if self.upsert_row is not None:
                existing = next((r for r in rows if r["id"] == self.upsert_row["id"]), None)
                if existing is None:
                    existing = dict(self.upsert_row)
                    rows.append(existing)
                else:
                    existing.update(self.upsert_row)
                return SimpleNamespace(data=[existing])
            return SimpleNamespace(data=[
                row for row in rows
                if all(row.get(key) == value for key, value in self.filters.items())
            ])

    async def skipped(*_):
        return "skipped"

    database = SimpleNamespace(table=Query)
    monkeypatch.setattr(bookings, "get_optional_supabase", lambda: database)
    monkeypatch.setattr(coaches, "get_optional_supabase", lambda: database)
    monkeypatch.setattr(bookings, "publish_booking_change", skipped)
    strict_app.app.dependency_overrides[bookings.get_current_user] = lambda: SimpleNamespace(id=MEMBER)
    try:
        yield SimpleNamespace(app=strict_app.app, tables=tables)
    finally:
        strict_app.app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "scheduled_at,duration,expected",
    [
        ("2026-11-02T00:00:00Z", 60, 200),
        ("2026-11-02T02:00:00Z", 60, 422),
        ("2026-11-03T00:00:00Z", 60, 422),
        ("2026-11-02T01:30:00Z", 60, 422),
        ("2026-11-02T00:00:01Z", 60, 422),
        ("2026-11-02T00:00:00.500000Z", 60, 422),
        ("2026-11-02T00:00:00Z", 120, 200),
        ("2026-11-02T01:00:00Z", 120, 422),
        ("2026-11-02T01:00:00Z", 61, 422),
        ("2026-11-02T09:00:00+09:00", 60, 200),
    ],
)
def test_booking_requires_every_hour_in_korea_time(store, scheduled_at, duration, expected):
    with TestClient(store.app) as client:
        response = client.post("/api/v1/bookings", json={
            "coach_id": COACH, "scheduled_at": scheduled_at,
            "duration_minutes": duration, "session_type": "online",
        })
    assert response.status_code == expected
    assert len(store.tables["bookings"]) == (1 if expected == 200 else 0)
    if expected == 422:
        assert response.json()["detail"] == "Requested time is outside the coach's availability"


@pytest.mark.parametrize("missing", [True, False])
def test_legacy_coach_has_no_availability_restriction(store, missing):
    coach = store.tables["coach_details"][0]
    if missing:
        del coach["weekly_availability"]
    else:
        coach["weekly_availability"] = None
    with TestClient(store.app) as client:
        response = client.post("/api/v1/bookings", json={
            "coach_id": COACH, "scheduled_at": "2026-11-03T01:30:00Z",
        })
    assert response.status_code == 200
    assert len(store.tables["bookings"]) == 1


@pytest.mark.parametrize("availability", [
    {"monday": ["09:00"]},
    {"mon": ["9:00"]},
    {"mon": ["09:30"]},
    {"mon": ["24:00"]},
    {"mon": ["09:00", "09:00"]},
    {"mon": ["09:00"] * 25},
    {"mon": "09:00"},
])
def test_profile_rejects_invalid_availability(store, availability):
    with TestClient(store.app) as client:
        response = client.put("/api/v1/coaches/me/details", json={
            "weekly_availability": availability,
        })
    assert response.status_code == 422
    assert len(store.tables["coach_details"]) == 1


def test_profile_saves_sorted_availability_and_day_off(store):
    with TestClient(store.app) as client:
        response = client.put("/api/v1/coaches/me/details", json={
            "weekly_availability": {"mon": ["10:00", "09:00"], "tue": []},
        })
    assert response.status_code == 200
    saved = next(row for row in store.tables["coach_details"] if row["id"] == MEMBER)
    assert saved["weekly_availability"] == {"mon": ["09:00", "10:00"], "tue": []}
