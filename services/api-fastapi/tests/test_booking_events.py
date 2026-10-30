import json
from functools import partial
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from postgrest._sync.request_builder import SyncRequestBuilder

from app import fallback
from app.routers import bookings
from app.services import booking_events, notifications


MEMBER_ID = "10000000-0000-0000-0000-000000000001"
COACH_ID = fallback.SAMPLE_COACHES[0]["id"]
BOOKING_ID = "30000000-0000-0000-0000-000000000001"
AUTHORIZATION = "Bearer participant-test-jwt"
PAYLOAD = {
    "coach_id": COACH_ID,
    "scheduled_at": "2026-12-01T10:00:00+00:00",
    "session_type": "online",
}


@pytest.fixture
def booking_http(strict_app, monkeypatch):
    """Exercise real query builders and HTTP clients with isolated wire stores."""
    saved = {
        "id": BOOKING_ID,
        "user_id": MEMBER_ID,
        "coach_id": COACH_ID,
        "scheduled_at": PAYLOAD["scheduled_at"],
        "duration_minutes": 60,
        "session_type": "online",
        "status": "pending",
        "price": 60000,
        "created_at": "2026-10-23T00:00:00+00:00",
    }
    state = SimpleNamespace(
        saved=saved, events=[], publications=[], inbox=[], actor_id=MEMBER_ID,
        write_error=False, stale=False, missing=False, notification="ok",
    )

    def database(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/coach_details"):
            return httpx.Response(200, json=[{"base_price": 60000, "gym_id": None, "is_verified": True}])
        if request.url.path.endswith("/profiles"):
            return httpx.Response(200, json=[{"full_name": "참여자", "role": "coach"}])
        if request.url.path.endswith("/notifications"):
            assert request.method == "POST"
            assert state.events == ["saved"]
            row = json.loads(request.content)
            state.inbox.append(row)
            return httpx.Response(201, json=[{"id": "notification-1", **row}])
        assert request.url.path.endswith("/bookings")
        if request.method == "GET":
            return httpx.Response(200, json=[] if state.missing else [saved.copy()])
        if state.write_error:
            return httpx.Response(409, json={
                "code": "23P01", "message": "overlap", "details": "", "hint": "",
            })
        if state.stale:
            return httpx.Response(200, json=[])
        if request.method == "PATCH":
            assert request.url.params["id"] == f"eq.{BOOKING_ID}"
            assert request.url.params["status"] == f"eq.{saved['status']}"
        saved.update(json.loads(request.content))
        state.events.append("saved")
        return httpx.Response(201 if request.method == "POST" else 200, json=[saved.copy()])

    def notification(request: httpx.Request) -> httpx.Response:
        state.publications.append(request)
        assert state.events == ["saved"]
        assert len(state.inbox) == 1
        assert state.inbox[0]["data"] == {"booking_id": saved["id"], "status": saved["status"]}
        assert request.method == "POST"
        assert str(request.url) == "http://bff.test/api/realtime/trigger-update"
        assert request.headers["authorization"] == AUTHORIZATION
        assert json.loads(request.content) == {"bookingId": saved["id"]}
        assert all(0 < value <= 2 for value in request.extensions["timeout"].values())
        state.events.append("published")
        match state.notification:
            case "timeout":
                raise httpx.ReadTimeout(AUTHORIZATION, request=request)
            case "disconnect":
                raise httpx.ConnectError(AUTHORIZATION, request=request)
            case "rejected":
                return httpx.Response(403, text=AUTHORIZATION)
            case "error":
                return httpx.Response(503, text=AUTHORIZATION)
            case "redirect":
                return httpx.Response(307, headers={"Location": "http://other.test"})
            case "ok":
                return httpx.Response(200, json={
                    "success": True, "bookingId": saved["id"], "status": saved["status"],
                })
        pytest.fail("Unknown notification test outcome")

    monkeypatch.setattr(bookings.settings, "bff_internal_url", "http://bff.test/")
    monkeypatch.setattr(
        booking_events, "AsyncClient",
        partial(httpx.AsyncClient, transport=httpx.MockTransport(notification)),
    )
    strict_app.app.dependency_overrides[bookings.get_current_user] = (
        lambda: SimpleNamespace(id=state.actor_id)
    )
    with httpx.Client(
        base_url="http://store.test/rest/v1", transport=httpx.MockTransport(database),
    ) as session:
        # Keep PostgREST serialization/error handling intact; replace only the wire.
        store = SimpleNamespace(table=lambda table: SyncRequestBuilder(session, f"/{table}"))
        monkeypatch.setattr(
            bookings, "get_optional_supabase",
            lambda: store,
        )
        monkeypatch.setattr(notifications, "get_supabase", lambda: store)
        with TestClient(strict_app.app) as client:
            state.client = client
            yield state
    strict_app.app.dependency_overrides.clear()


def mutate(state, operation):
    if operation == "create":
        return state.client.post(
            "/api/v1/bookings", json=PAYLOAD,
            headers={"Authorization": AUTHORIZATION, "Origin": "http://localhost:3000"},
        )
    return state.client.patch(
        f"/api/v1/bookings/{BOOKING_ID}/status", json={"status": "cancelled"},
        headers={"Authorization": AUTHORIZATION, "Origin": "http://localhost:3000"},
    )


@pytest.mark.parametrize("operation", ["create", "patch"])
def test_booking_publishes_saved_state_with_participant_token(booking_http, operation):
    # Given: a participant and an accepting BFF.
    # When: the participant saves a booking change.
    response = mutate(booking_http, operation)
    # Then: persistence precedes one authenticated notification and CORS exposes its outcome.
    assert response.status_code == 200
    assert response.headers["X-Booking-Notification"] == "delivered"
    assert "x-booking-notification" in response.headers["access-control-expose-headers"].lower()
    assert response.json()["id"] == BOOKING_ID
    assert response.json()["status"] == booking_http.saved["status"]
    assert booking_http.events == ["saved", "published"]
    assert len(booking_http.publications) == 1


@pytest.mark.parametrize("operation", ["create", "patch"])
@pytest.mark.parametrize("failure", ["timeout", "disconnect", "rejected", "error", "redirect"])
def test_publication_failure_preserves_successful_booking(booking_http, operation, failure, caplog):
    # Given: a BFF that fails after persistence.
    booking_http.notification = failure
    # When: a booking change is saved.
    response = mutate(booking_http, operation)
    # Then: the saved response remains successful without retrying or logging credentials.
    assert response.status_code == 200
    assert response.headers["X-Booking-Notification"] == "unavailable"
    assert response.json()["id"] == BOOKING_ID
    assert response.json()["status"] == booking_http.saved["status"]
    assert booking_http.events == ["saved", "published"]
    assert len(booking_http.publications) == 1
    assert any(record.name == booking_events.__name__ for record in caplog.records)
    assert AUTHORIZATION not in caplog.text


@pytest.mark.parametrize("operation", ["create", "patch"])
def test_failed_database_write_never_publishes(booking_http, operation):
    # Given: the database rejects the write.
    booking_http.write_error = True
    # When: a participant attempts a change.
    response = mutate(booking_http, operation)
    # Then: neither a saved event nor a notification is produced.
    assert response.status_code == 409
    assert booking_http.events == []
    assert booking_http.publications == []
    assert "X-Booking-Notification" not in response.headers


@pytest.mark.parametrize(
    ("actor", "status", "body", "expected"),
    [
        (MEMBER_ID, "pending", {"status": "confirmed"}, 403),
        ("unrelated-user", "pending", {"status": "cancelled"}, 403),
        (COACH_ID, "completed", {"status": "confirmed"}, 409),
        (COACH_ID, "pending", {"status": "pending", "coach_notes": "notes only"}, 409),
        (MEMBER_ID, "pending", {"status": "cancelled", "coach_notes": "forged"}, 403),
    ],
)
def test_rejected_transition_never_publishes(booking_http, actor, status, body, expected):
    # Given: a forbidden actor or transition, including a notes-only update.
    booking_http.actor_id = actor
    booking_http.saved["status"] = status
    # When: the invalid transition is submitted.
    response = booking_http.client.patch(
        f"/api/v1/bookings/{BOOKING_ID}/status", json=body,
        headers={"Authorization": AUTHORIZATION},
    )
    # Then: no persistence or publication occurs.
    assert response.status_code == expected
    assert booking_http.events == []
    assert booking_http.publications == []


def test_coach_transition_with_notes_publishes_saved_change(booking_http):
    # Given: the assigned coach confirms a pending booking with notes.
    booking_http.actor_id = COACH_ID
    # When: the allowed transition and accompanying notes are saved together.
    response = booking_http.client.patch(
        f"/api/v1/bookings/{BOOKING_ID}/status",
        json={"status": "confirmed", "coach_notes": "ready"},
        headers={"Authorization": AUTHORIZATION},
    )
    # Then: persisted notes are returned and publication follows the save.
    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"
    assert response.json()["coach_notes"] == "ready"
    assert booking_http.saved["coach_notes"] == "ready"
    assert response.headers["X-Booking-Notification"] == "delivered"
    assert booking_http.events == ["saved", "published"]


def test_anonymous_request_never_publishes(booking_http, strict_app):
    # Given: real authentication rather than the participant identity fixture.
    strict_app.app.dependency_overrides.clear()
    # When: an anonymous caller attempts a booking.
    response = booking_http.client.post("/api/v1/bookings", json=PAYLOAD)
    # Then: authentication rejects it before persistence or publication.
    assert response.status_code == 401
    assert booking_http.events == []
    assert booking_http.publications == []


@pytest.mark.parametrize(("flag", "expected"), [("stale", 409), ("missing", 404)])
def test_unsaved_status_patch_never_publishes(booking_http, flag, expected):
    # Given: a missing row or a concurrent status change.
    setattr(booking_http, flag, True)
    # When: the participant attempts cancellation.
    response = mutate(booking_http, "patch")
    # Then: no notification describes an unsaved change.
    assert response.status_code == expected
    assert booking_http.events == []
    assert booking_http.publications == []


@pytest.mark.parametrize("operation", ["create", "patch"])
def test_demo_changes_skip_real_notification(demo_app, monkeypatch, operation):
    # Given: isolated demo state and a real HTTP client that must never be opened.
    monkeypatch.setattr(fallback, "_BOOKINGS", [])

    def unexpected_client(*args, **kwargs):
        pytest.fail("Demo changes must not open a real BFF client")

    monkeypatch.setattr(booking_events, "AsyncClient", unexpected_client)
    saved = fallback.create_booking(PAYLOAD, fallback.DEMO_USER_ID) if operation == "patch" else None
    # When: a demo user creates or cancels a booking.
    with TestClient(demo_app.app) as client:
        response = (
            client.patch(f"/api/v1/bookings/{saved['id']}/status", json={"status": "cancelled"})
            if saved else client.post("/api/v1/bookings", json=PAYLOAD)
        )
    # Then: the successful demo change explicitly skips real publication.
    assert response.status_code == 200
    assert response.headers["X-Booking-Notification"] == "skipped"
