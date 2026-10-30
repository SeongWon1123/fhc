import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from postgrest._sync.request_builder import SyncRequestBuilder

from app import fallback
from app.routers import bookings
from app.services import notifications

MEMBER = "10000000-0000-4000-8000-000000000001"
COACH = "20000000-0000-4000-8000-000000000002"
BOOKING = "30000000-0000-4000-8000-000000000003"
REVIEW = "40000000-0000-4000-8000-000000000004"
PAYLOAD = {
    "coach_id": COACH, "scheduled_at": "2026-11-02T01:00:00+00:00",
    "session_type": "online",
}


@pytest.fixture
def inbox(strict_app, monkeypatch):
    state = SimpleNamespace(
        actor=MEMBER, failure=False, reject=False, stale=False,
        notifications=[], attempts=0, reviews=[],
        booking={
            "id": BOOKING, "user_id": MEMBER, "coach_id": COACH,
            "status": "pending", "scheduled_at": PAYLOAD["scheduled_at"],
            "duration_minutes": 60, "session_type": "online", "price": 60000,
            "created_at": "2026-10-29T00:00:00+00:00",
        },
    )

    def database(request):
        table = request.url.path.rsplit("/", 1)[-1]
        body = json.loads(request.content) if request.content else None
        if table == "profiles":
            return httpx.Response(200, json=[{
                "full_name": "테스트 회원" if state.actor == MEMBER else "테스트 코치",
                "role": "coach" if request.url.params.get("id") == f"eq.{COACH}" else "user",
            }])
        if table == "notifications":
            state.attempts += 1
            if state.failure:
                raise RuntimeError("Notification insert failed")
            state.notifications.append(body)
            return httpx.Response(201, json=[{"id": "notice", **body}])
        if table == "coach_details":
            return httpx.Response(200, json=[{"id": COACH, "base_price": 60000, "is_verified": True}])
        if table == "reviews":
            if request.method == "POST":
                state.reviews.append({"id": REVIEW, **body})
            return httpx.Response(200, json=state.reviews)
        assert table == "bookings"
        if request.method != "GET":
            if state.reject:
                return httpx.Response(409, json={"code": "23P01", "message": "Overlap"})
            if state.stale:
                return httpx.Response(200, json=[])
            state.booking.update(body)
        return httpx.Response(200, json=[state.booking.copy()], headers={"Content-Range": "0-0/1"})

    async def publish(*_):
        return "delivered"

    monkeypatch.setattr(bookings, "publish_booking_change", publish)
    strict_app.app.dependency_overrides[bookings.get_current_user] = lambda: SimpleNamespace(id=state.actor)
    with httpx.Client(base_url="http://store.test", transport=httpx.MockTransport(database)) as session:
        client = SimpleNamespace(table=lambda table: SyncRequestBuilder(session, f"/{table}"))
        monkeypatch.setattr(bookings, "get_optional_supabase", lambda: client)
        monkeypatch.setattr(notifications, "get_supabase", lambda: client)
        with TestClient(strict_app.app) as http:
            state.http = http
            yield state
    strict_app.app.dependency_overrides.clear()


def test_booking_request_notifies_only_coach(inbox):
    # Given: a member requesting a session.
    # When: the booking is saved.
    response = inbox.http.post("/api/v1/bookings", json=PAYLOAD)
    # Then: exactly one persisted coach notification references that booking.
    assert response.status_code == 200
    assert inbox.attempts == 1
    assert len(inbox.notifications) == 1
    notice = inbox.notifications[0]
    assert (notice["user_id"], notice["type"]) == (COACH, "booking_requested")
    assert notice["data"] == {"booking_id": BOOKING, "status": "pending"}


@pytest.mark.parametrize(
    ("actor", "before", "after", "recipient"),
    [
        (COACH, "pending", "confirmed", MEMBER),
        (COACH, "pending", "cancelled", MEMBER),
        (MEMBER, "pending", "cancelled", COACH),
        (COACH, "confirmed", "completed", MEMBER),
        (COACH, "confirmed", "no_show", MEMBER),
    ],
)
def test_status_change_notifies_other_party(inbox, actor, before, after, recipient):
    # Given: distinct participants and a valid transition.
    inbox.actor = actor
    inbox.booking["status"] = before
    # When: the actor changes the status.
    response = inbox.http.patch(f"/api/v1/bookings/{BOOKING}/status", json={"status": after})
    # Then: exactly one notification goes to the non-actor.
    assert response.status_code == 200
    assert inbox.attempts == 1
    assert len(inbox.notifications) == 1
    notice = inbox.notifications[0]
    assert (notice["user_id"], notice["type"]) == (recipient, f"booking_{after}")
    assert notice["user_id"] != actor
    assert notice["data"] == {"booking_id": BOOKING, "status": after}


def test_review_notifies_coach(inbox):
    # Given: a completed session owned by the member.
    inbox.booking["status"] = "completed"
    # When: the review is saved.
    response = inbox.http.post(f"/api/v1/bookings/{BOOKING}/review", json={"rating": 5})
    # Then: exactly one coach notification identifies the saved review.
    assert response.status_code == 200
    assert inbox.attempts == 1
    assert len(inbox.notifications) == 1
    notice = inbox.notifications[0]
    assert (notice["user_id"], notice["type"]) == (COACH, "review_created")
    assert notice["data"] == {"review_id": REVIEW, "booking_id": BOOKING}


@pytest.mark.parametrize("operation", ["create", "status", "review"])
def test_insert_exception_preserves_saved_response(inbox, operation, caplog):
    # Given: the notification store throws after the primary write.
    inbox.failure = True
    # When: a booking, transition or review is saved.
    if operation == "create":
        response = inbox.http.post("/api/v1/bookings", json=PAYLOAD)
    elif operation == "status":
        response = inbox.http.patch(f"/api/v1/bookings/{BOOKING}/status", json={"status": "cancelled"})
    else:
        inbox.booking["status"] = "completed"
        response = inbox.http.post(f"/api/v1/bookings/{BOOKING}/review", json={"rating": 5})
    # Then: the successful response and stored data survive, without retry.
    assert response.status_code == 200
    assert inbox.attempts == 1
    assert inbox.notifications == []
    assert any(record.name == notifications.__name__ for record in caplog.records)
    if operation == "review":
        assert response.json() == inbox.reviews[0]
    else:
        assert response.json()["id"] == inbox.booking["id"]
        assert response.json()["status"] == ("cancelled" if operation == "status" else "pending")
        assert inbox.booking["status"] == response.json()["status"]


@pytest.mark.parametrize("operation", ["create", "status", "review"])
def test_demo_never_inserts_notifications(demo_app, monkeypatch, operation):
    # Given: demo fallback and a database accessor that records any use.
    monkeypatch.setattr(fallback, "_BOOKINGS", [])
    calls = []
    monkeypatch.setattr(bookings, "get_optional_supabase", lambda: calls.append(True))
    monkeypatch.setattr(notifications, "get_supabase", lambda: calls.append(True))
    payload = {**PAYLOAD, "coach_id": fallback.SAMPLE_COACHES[0]["id"]}
    saved = fallback.create_booking(payload, fallback.DEMO_USER_ID)
    # When: the demo member creates, cancels or attempts a review.
    with TestClient(demo_app.app) as client:
        if operation == "create":
            payload["scheduled_at"] = "2026-11-03T01:00:00+00:00"
            response = client.post("/api/v1/bookings", json=payload)
        elif operation == "status":
            response = client.patch(f"/api/v1/bookings/{saved['id']}/status", json={"status": "cancelled"})
        else:
            response = client.post(f"/api/v1/bookings/{saved['id']}/review", json={"rating": 5})
    # Then: demo behavior is unchanged and never reaches the database.
    assert response.status_code == (503 if operation == "review" else 200)
    assert calls == []


@pytest.mark.parametrize("failure", ["reject", "stale", "forbidden"])
def test_unsaved_changes_never_notify(inbox, failure):
    # Given: a rejected write, stale row or unauthorized transition.
    inbox.reject = failure == "reject"
    inbox.stale = failure == "stale"
    status = "confirmed" if failure == "forbidden" else "cancelled"
    # When: the change is attempted.
    response = inbox.http.patch(f"/api/v1/bookings/{BOOKING}/status", json={"status": status})
    # Then: no notification describes an unsaved change.
    assert response.status_code == (403 if failure == "forbidden" else 409)
    assert inbox.attempts == 0
    assert inbox.notifications == []
