from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError
from types import SimpleNamespace

from app import fallback
from app.routers import bookings
from app.models.booking import BookingStatusUpdate
from app.services.booking_rules import (
    BookingConflictError,
    BookingPermissionError,
    ensure_booking_update,
)


COACH_ID = fallback.SAMPLE_COACHES[0]["id"]
MEMBER_ID = str(fallback.DEMO_USER_ID)


@pytest.fixture(autouse=True)
def isolated_bookings(monkeypatch):
    monkeypatch.setattr(fallback, "_BOOKINGS", [])


def payload(start="2026-12-01T10:00:00+00:00", duration=60):
    return {
        "coach_id": COACH_ID,
        "scheduled_at": start,
        "duration_minutes": duration,
        "session_type": "online",
    }


@pytest.mark.parametrize("status", ["confirmed", "completed", "no_show", "pending"])
def test_member_cannot_set_coach_status(demo_app, status):
    with TestClient(demo_app.app) as client:
        booking = client.post("/api/v1/bookings", json=payload()).json()
        response = client.patch(
            f"/api/v1/bookings/{booking['id']}/status", json={"status": status}
        )
        assert response.status_code == 403
        assert client.get("/api/v1/bookings/my").json()[0]["status"] == "pending"


def test_member_cannot_write_coach_notes(demo_app):
    with TestClient(demo_app.app) as client:
        booking = client.post("/api/v1/bookings", json=payload()).json()
        response = client.patch(
            f"/api/v1/bookings/{booking['id']}/status",
            json={"status": "cancelled", "coach_notes": "forged"},
        )
        assert response.status_code == 403


def test_cancellation_releases_slot_and_cannot_be_reversed(demo_app):
    with TestClient(demo_app.app) as client:
        booking = client.post("/api/v1/bookings", json=payload()).json()
        path = f"/api/v1/bookings/{booking['id']}/status"
        assert client.patch(path, json={"status": "cancelled"}).status_code == 200
        assert client.patch(path, json={"status": "confirmed"}).status_code == 403
        assert client.post("/api/v1/bookings", json=payload()).status_code == 200


@pytest.mark.parametrize(
    ("start", "duration", "expected"),
    [
        ("2026-12-01T10:00:00+00:00", 60, 409),
        ("2026-12-01T10:30:00+00:00", 60, 409),
        ("2026-12-01T09:30:00+00:00", 60, 409),
        ("2026-12-01T19:00:00+09:00", 60, 409),
        ("2026-12-01T11:00:00+00:00", 60, 200),
    ],
)
def test_booking_overlap_uses_duration_and_timezone(demo_app, start, duration, expected):
    with TestClient(demo_app.app) as client:
        assert client.post("/api/v1/bookings", json=payload()).status_code == 200
        response = client.post("/api/v1/bookings", json=payload(start, duration))
        assert response.status_code == expected


def test_coach_transitions_and_terminal_state_are_enforced():
    booking = fallback.create_booking(payload(), MEMBER_ID)
    confirmed = fallback.update_booking_status(
        booking["id"], COACH_ID, BookingStatusUpdate(status="confirmed", coach_notes="ready")
    )
    assert confirmed["status"] == "confirmed"
    assert confirmed["coach_notes"] == "ready"
    completed = fallback.update_booking_status(
        booking["id"], COACH_ID, BookingStatusUpdate(status="completed")
    )
    assert completed["status"] == "completed"
    with pytest.raises(BookingConflictError):
        fallback.update_booking_status(
            booking["id"], COACH_ID, BookingStatusUpdate(status="confirmed")
        )


def test_unrelated_user_cannot_change_booking():
    booking = fallback.create_booking(payload(), MEMBER_ID)
    with pytest.raises(BookingPermissionError):
        ensure_booking_update(booking, "unrelated-user", BookingStatusUpdate(status="cancelled"))


def test_concurrent_demo_requests_reserve_only_one_slot():
    barrier = Barrier(2)

    def reserve():
        barrier.wait(timeout=5)
        try:
            fallback.create_booking(payload(), MEMBER_ID)
            return "created"
        except BookingConflictError:
            return "conflict"

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: reserve(), range(2)))
    assert sorted(outcomes) == ["conflict", "created"]


def test_database_overlap_is_409_and_never_a_demo_success(demo_app, monkeypatch):
    actor = SimpleNamespace(id="00000000-0000-0000-0000-000000000099")

    class Query:
        def select(self, _):
            return self

        def eq(self, *_):
            return self

        def limit(self, _):
            return self

        def execute(self):
            return SimpleNamespace(data=[{
                "base_price": 60000, "gym_id": None, "is_verified": True, "role": "coach",
            }])

        def insert(self, _):
            raise APIError({"code": "23P01", "message": "overlap", "details": "", "hint": ""})

    demo_app.app.dependency_overrides[bookings.get_current_user] = lambda: actor
    monkeypatch.setattr(bookings, "get_optional_supabase", lambda: SimpleNamespace(table=lambda _: Query()))
    try:
        with TestClient(demo_app.app) as client:
            assert client.post("/api/v1/bookings", json=payload()).status_code == 409
            assert fallback.list_bookings(actor.id) == []
    finally:
        demo_app.app.dependency_overrides.clear()
