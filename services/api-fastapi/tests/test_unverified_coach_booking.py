from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.routers import bookings

MEMBER = "00000000-0000-0000-0000-0000000000f1"
COACH = "00000000-0000-0000-0000-0000000000f3"


@pytest.fixture
def store(strict_app, monkeypatch):
    tables = {
        "coach_details": [{
            "id": COACH, "base_price": 30000, "is_verified": True,
            "weekly_availability": {"mon": ["09:00"]},
        }],
        "profiles": [{"id": COACH, "role": "coach"}],
        "bookings": [],
    }

    class Query:
        def __init__(self, table):
            self.table = table
            self.filters = {}
            self.new_row = None

        def select(self, _):
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def limit(self, _):
            return self

        def insert(self, row):
            self.new_row = row
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
            return SimpleNamespace(data=[
                row for row in rows
                if all(row.get(key) == value for key, value in self.filters.items())
            ])

    async def skipped(*_):
        return "skipped"

    database = SimpleNamespace(table=Query)
    monkeypatch.setattr(bookings, "get_optional_supabase", lambda: database)
    monkeypatch.setattr(bookings, "notify_booking", lambda *_: None)
    monkeypatch.setattr(bookings, "publish_booking_change", skipped)
    strict_app.app.dependency_overrides[bookings.get_current_user] = lambda: SimpleNamespace(id=MEMBER)
    try:
        yield SimpleNamespace(app=strict_app.app, tables=tables)
    finally:
        strict_app.app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "verified,role,expected",
    [(True, "coach", 200), (False, "coach", 404), (True, "user", 404), (True, None, 404)],
)
def test_booking_accepts_only_approved_coach(store, verified, role, expected):
    # Given: a coach detail row and an optional matching profile.
    store.tables["coach_details"][0]["is_verified"] = verified
    store.tables["profiles"] = [] if role is None else [{"id": COACH, "role": role}]
    # When: a member requests an available session.
    with TestClient(store.app) as client:
        response = client.post("/api/v1/bookings", json={
            "coach_id": COACH, "scheduled_at": "2026-11-02T00:00:00Z",
        })
    # Then: only an approved coach receives a persisted booking.
    assert response.status_code == expected
    assert len(store.tables["bookings"]) == (1 if expected == 200 else 0)
    if expected == 404:
        assert response.json() == {"detail": "Coach not found"}


@pytest.mark.parametrize("verified,role", [(False, "coach"), (True, "user"), (True, None)])
def test_unapproved_coach_is_hidden_before_availability_check(store, verified, role):
    # Given: an unapproved coach with no available hours.
    store.tables["coach_details"][0].update(is_verified=verified, weekly_availability={})
    store.tables["profiles"] = [] if role is None else [{"id": COACH, "role": role}]
    # When: a member requests a session outside availability.
    with TestClient(store.app) as client:
        response = client.post("/api/v1/bookings", json={
            "coach_id": COACH, "scheduled_at": "2026-11-02T00:00:00Z",
        })
    # Then: rejection reveals neither the account nor its availability.
    assert response.status_code == 404
    assert response.json() == {"detail": "Coach not found"}
    assert store.tables["bookings"] == []
