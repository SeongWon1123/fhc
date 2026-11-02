from copy import deepcopy
import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from app.fallback import DEMO_USER_ID
from app.routers import account
from app.services import account_deletion


MEMBER = "00000000-0000-0000-0000-0000000000f1"
OTHER = "00000000-0000-0000-0000-0000000000f2"
COACH = "00000000-0000-0000-0000-0000000000f3"
REVIEW_ONLY = "00000000-0000-0000-0000-0000000000f4"
BOOKING_ONLY = "00000000-0000-0000-0000-0000000000f5"


@pytest.fixture
def store(strict_app, monkeypatch):
    tables = {
        "profiles": [
            {"id": MEMBER, "role": "user"},
            {"id": OTHER, "role": "user"},
            *({"id": coach, "role": "coach"} for coach in (COACH, REVIEW_ONLY, BOOKING_ONLY)),
        ],
        "bookings": [
            {"id": "mine", "user_id": MEMBER, "coach_id": COACH, "status": "completed"},
            {"id": "booking-only", "user_id": MEMBER, "coach_id": BOOKING_ONLY, "status": "completed"},
            {"id": "remaining", "user_id": OTHER, "coach_id": COACH, "status": "completed"},
            {"id": "cancelled", "user_id": OTHER, "coach_id": COACH, "status": "cancelled"},
            {"id": "unrelated", "user_id": OTHER, "coach_id": REVIEW_ONLY, "status": "pending"},
        ],
        "reviews": [
            {"id": "mine", "user_id": MEMBER, "coach_id": COACH, "rating": 1},
            {"id": "review-only", "user_id": MEMBER, "coach_id": REVIEW_ONLY, "rating": 5},
            *(
                {"id": f"remaining-{index}", "user_id": OTHER, "coach_id": COACH, "rating": rating}
                for index, rating in enumerate((5, 4, 4))
            ),
        ],
        "coach_details": [
            {"id": coach, "rating": 9, "review_count": 99, "booking_count": 99}
            for coach in (COACH, REVIEW_ONLY, BOOKING_ONLY)
        ],
        "workout_logs": [{"id": "workout", "user_id": MEMBER}],
        "notifications": [{"id": "notification", "user_id": MEMBER}],
    }
    deleted = []
    failures = {"coach": None, "delete": False}
    actor = {"id": MEMBER, "email": "member@example.test"}
    verification = {"id": MEMBER, "error": None}
    confirmations = []

    def verify_password(email, password):
        confirmations.append((email, password))
        if verification["error"] is not None:
            raise verification["error"]
        if password != "correct-password":
            raise HTTPException(status_code=403, detail="Password confirmation failed")
        return verification["id"]

    monkeypatch.setattr(account_deletion, "verify_password", verify_password)

    class Query:
        def __init__(self, table):
            self.table = table
            self.filters = {}
            self.membership = {}
            self.alternatives = []
            self.change = None
            self.count = None
            self.head = False
            self.maximum = None
            self.columns = "*"

        def select(self, columns, count=None, head=False):
            self.columns = columns
            self.count = count
            self.head = head
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def in_(self, key, values):
            self.membership[key] = values
            return self

        def or_(self, expression):
            self.alternatives = [term.split(".eq.", 1) for term in expression.split(",")]
            return self

        def limit(self, maximum):
            self.maximum = maximum
            return self

        def update(self, change):
            self.change = change
            return self

        def execute(self):
            if self.table == "coach_details" and self.filters.get("id") == failures["coach"]:
                raise APIError({"code": "XX000", "message": "aggregate unavailable"})
            matched = [
                row for row in tables[self.table]
                if all(row.get(key) == value for key, value in self.filters.items())
                and all(row.get(key) in values for key, values in self.membership.items())
                and (
                    not self.alternatives
                    or any(row.get(key) == value for key, value in self.alternatives)
                )
            ]
            count = len(matched) if self.count else None
            if self.change is not None:
                for row in matched:
                    row.update(self.change)
            data = matched[:self.maximum]
            if self.columns != "*":
                data = [{key.strip(): row[key.strip()] for key in self.columns.split(",")} for row in data]
            # Model the live postgrest-py 0.18 head-count bug, not an idealized API.
            return SimpleNamespace(data=[] if self.head else deepcopy(data), count=0 if self.head else count)

    def delete_user(user_id):
        if failures["delete"]:
            raise APIError({"code": "XX000", "message": "delete unavailable"})
        deleted.append(user_id)
        for name, rows in tables.items():
            tables[name] = [
                row for row in rows
                if row.get("user_id") != user_id and row.get("coach_id") != user_id
                and not (name in ("profiles", "coach_details") and row["id"] == user_id)
            ]

    fake = SimpleNamespace(table=Query, auth=SimpleNamespace(admin=SimpleNamespace(delete_user=delete_user)))
    monkeypatch.setattr(account, "get_optional_supabase", lambda: fake)
    strict_app.app.dependency_overrides[account.get_current_user] = lambda: SimpleNamespace(**actor)
    yield SimpleNamespace(
        app=strict_app.app, tables=tables, deleted=deleted, failures=failures, actor=actor,
        verification=verification, confirmations=confirmations,
    )
    strict_app.app.dependency_overrides.clear()


def test_delete_cascades_and_recomputes_remaining_coach_stats(store):
    # Given a member with reviews and completed bookings affecting three coaches.
    # When the authenticated member deletes their account.
    with TestClient(store.app) as client:
        response = client.request("DELETE", "/api/v1/account", json={"password": "correct-password"})
    # Then auth deletion cascades and all affected surviving aggregates are repaired.
    assert response.status_code == 200
    assert response.json() == {"deleted": True}
    assert store.deleted == [MEMBER]
    assert store.confirmations == [("member@example.test", "correct-password")]
    assert all(row["id"] != MEMBER for row in store.tables["profiles"])
    assert store.tables["workout_logs"] == []
    assert store.tables["notifications"] == []
    assert all(row["user_id"] != MEMBER for row in store.tables["reviews"])
    assert all(row["user_id"] != MEMBER for row in store.tables["bookings"])
    assert store.tables["coach_details"] == [
        {"id": COACH, "rating": 4.33, "review_count": 3, "booking_count": 1},
        {"id": REVIEW_ONLY, "rating": 0, "review_count": 0, "booking_count": 0},
        {"id": BOOKING_ONLY, "rating": 0, "review_count": 0, "booking_count": 0},
    ]


@pytest.mark.parametrize("status", ["pending", "confirmed"])
@pytest.mark.parametrize("role", ["member", "coach"])
def test_upcoming_booking_blocks_deletion_without_side_effects(store, status, role):
    # Given an active booking in either participant role.
    store.tables["bookings"].append({
        "id": "active", "user_id": MEMBER if role == "member" else OTHER,
        "coach_id": COACH if role == "member" else MEMBER, "status": status,
    })
    before = deepcopy(store.tables)
    # When the member tries to delete the account.
    with TestClient(store.app) as client:
        response = client.request("DELETE", "/api/v1/account", json={"password": "correct-password"})
    # Then no identity, data, or aggregate was changed.
    assert response.status_code == 409
    assert response.json()["detail"] == "Upcoming bookings must be cancelled before deleting the account"
    assert store.deleted == []
    assert store.tables == before


def test_admin_cannot_delete_account(store):
    # Given the server-side profile is an administrator.
    store.tables["profiles"][0]["role"] = "admin"
    before = deepcopy(store.tables)
    # When deletion is requested.
    with TestClient(store.app) as client:
        response = client.request("DELETE", "/api/v1/account", json={"password": "correct-password"})
    # Then the account and all data remain.
    assert response.status_code == 403
    assert store.deleted == []
    assert store.tables == before


def test_unauthenticated_deletion_is_rejected(strict_app):
    # Given authentication is required and no bearer token is supplied.
    # When deletion is requested.
    with TestClient(strict_app.app) as client:
        response = client.request("DELETE", "/api/v1/account", json={"password": "correct-password"})
    # Then authentication fails before deletion.
    assert response.status_code in (401, 403)


def test_recompute_failure_is_logged_and_other_coaches_are_repaired(store, caplog):
    # Given one coach's aggregate update fails after deletion.
    store.failures["coach"] = COACH
    # When deletion is requested.
    with TestClient(store.app) as client:
        response = client.request("DELETE", "/api/v1/account", json={"password": "correct-password"})
    # Then deletion still succeeds and the other coaches are repaired.
    assert response.status_code == 200
    assert response.json() == {"deleted": True}
    assert store.deleted == [MEMBER]
    assert store.tables["coach_details"][1]["review_count"] == 0
    assert store.tables["coach_details"][2]["booking_count"] == 0
    assert any(
        record.levelname == "WARNING" and record.name == "app.services.account_deletion"
        for record in caplog.records
    )


def test_deleted_coach_is_not_recomputed(store):
    # Given the account is also a coach with historical self-referencing data.
    store.tables["profiles"][0]["role"] = "coach"
    store.tables["coach_details"].append({"id": MEMBER, "rating": 5, "review_count": 1})
    store.tables["reviews"].append({"id": "self", "user_id": MEMBER, "coach_id": MEMBER, "rating": 5})
    store.failures["coach"] = MEMBER
    # When deletion cascades through both participant references.
    with TestClient(store.app) as client:
        response = client.request("DELETE", "/api/v1/account", json={"password": "correct-password"})
    # Then no deleted coach is recreated or updated.
    assert response.status_code == 200
    assert all(row["id"] != MEMBER for row in store.tables["coach_details"])


def test_request_body_cannot_choose_another_identity(store):
    # Given a caller supplies someone else's ID in an unsolicited body.
    # When the authenticated deletion endpoint receives it.
    with TestClient(store.app) as client:
        response = client.request(
            "DELETE", "/api/v1/account",
            json={"password": "correct-password", "user_id": OTHER, "email": "other@example.test"},
        )
    # Then only the authenticated identity is deleted.
    assert response.status_code == 200
    assert store.deleted == [MEMBER]
    assert store.confirmations == [("member@example.test", "correct-password")]
    assert any(row["id"] == OTHER for row in store.tables["profiles"])


def test_delete_failure_preserves_data_and_returns_unavailable(store):
    # Given auth admin rejects deletion.
    store.failures["delete"] = True
    before = deepcopy(store.tables)
    # When deletion is requested.
    with TestClient(store.app) as client:
        response = client.request("DELETE", "/api/v1/account", json={"password": "correct-password"})
    # Then failure is reported without modifying data.
    assert response.status_code == 503
    assert store.deleted == []
    assert store.tables == before


def test_missing_supabase_fails_closed(store, monkeypatch):
    # Given the service-role client is unavailable.
    monkeypatch.setattr(account, "get_optional_supabase", lambda: None)
    # When an authenticated user requests deletion.
    with TestClient(store.app) as client:
        response = client.request("DELETE", "/api/v1/account", json={"password": "correct-password"})
    # Then deletion is not falsely reported as successful.
    assert response.status_code == 503
    assert store.deleted == []


def test_demo_account_cannot_be_deleted(demo_app, monkeypatch):
    # Given a shared demo identity, even with a client accidentally available.
    def unexpected_client():
        pytest.fail("Demo deletion must not access Supabase")

    monkeypatch.setattr(account, "get_optional_supabase", unexpected_client)
    confirmations = []

    def verify_password(email, password):
        confirmations.append((email, password))
        return str(DEMO_USER_ID)

    monkeypatch.setattr(account_deletion, "verify_password", verify_password)
    demo_app.app.dependency_overrides[account.get_current_user] = lambda: SimpleNamespace(
        id=DEMO_USER_ID, email="demo@example.test",
    )
    # When demo deletion is requested.
    try:
        with TestClient(demo_app.app) as client:
            response = client.request("DELETE", "/api/v1/account", json={"password": "correct-password"})
    finally:
        demo_app.app.dependency_overrides.clear()
    # Then the request is denied without touching the client.
    assert response.status_code == 403
    assert confirmations == [("demo@example.test", "correct-password")]


@pytest.mark.parametrize("guard", ["none", "admin", "upcoming"])
def test_wrong_password_blocks_deletion_before_existing_guards(store, guard):
    # Given a wrong password, including accounts blocked by an existing guard.
    if guard == "admin":
        store.tables["profiles"][0]["role"] = "admin"
    if guard == "upcoming":
        store.tables["bookings"][0]["status"] = "confirmed"
    before = deepcopy(store.tables)
    # When password confirmation fails.
    with TestClient(store.app) as client:
        response = client.request("DELETE", "/api/v1/account", json={"password": "wrong-password"})
    # Then no data is touched and the response does not trigger a 401 sign-out.
    assert response.status_code == 403
    assert response.json()["detail"] == "Password confirmation failed"
    assert store.deleted == []
    assert store.tables == before


@pytest.mark.parametrize("body", [None, {}, {"password": ""}, {"password": " \t\n"}, {"password": "x" * 201}])
def test_missing_or_invalid_password_is_rejected(store, body):
    # Given a missing, blank, or oversized password.
    before = deepcopy(store.tables)
    # When deletion is requested.
    with TestClient(store.app) as client:
        response = client.request("DELETE", "/api/v1/account", json=body)
    # Then validation fails before authentication confirmation or deletion.
    assert response.status_code == 422
    assert store.confirmations == []
    assert store.deleted == []
    assert store.tables == before


def test_password_for_another_identity_is_rejected(store):
    # Given Supabase confirms a different identity.
    store.verification["id"] = OTHER
    before = deepcopy(store.tables)
    # When deletion is requested with an otherwise valid password.
    with TestClient(store.app) as client:
        response = client.request("DELETE", "/api/v1/account", json={"password": "correct-password"})
    # Then the authenticated account and all data remain.
    assert response.status_code == 403
    assert response.json()["detail"] == "Password confirmation failed"
    assert store.deleted == []
    assert store.tables == before


@pytest.mark.parametrize("failure", [httpx.ConnectError, httpx.ReadTimeout])
def test_password_verification_network_failure_preserves_data(store, failure):
    # Given the password service cannot be reached.
    store.verification["error"] = failure("Authentication unavailable")
    before = deepcopy(store.tables)
    # When deletion is requested.
    with TestClient(store.app) as client:
        response = client.request("DELETE", "/api/v1/account", json={"password": "correct-password"})
    # Then deletion fails closed with an availability error.
    assert response.status_code == 503
    assert store.deleted == []
    assert store.tables == before


@pytest.mark.parametrize("status", [200, 400, 401, 500, 503])
def test_password_verifier_uses_configured_auth_endpoint(strict_app, monkeypatch, status):
    # Given a wire-level fake of Supabase Auth and non-secret test settings.
    monkeypatch.setattr(account_deletion.config.settings, "supabase_url", "https://auth.example.test/")
    monkeypatch.setattr(account_deletion.config.settings, "supabase_service_role_key", "test-service-key")
    requests = []

    def auth(request):
        requests.append(request)
        return httpx.Response(status, json={"user": {"id": MEMBER}})

    with httpx.Client(transport=httpx.MockTransport(auth)) as session:
        monkeypatch.setattr(account_deletion.httpx, "post", session.post)
        # When the real verifier calls the mocked HTTP transport.
        if status == 200:
            assert account_deletion.verify_password("member@example.test", "correct-password") == MEMBER
        else:
            with pytest.raises(HTTPException) as error:
                account_deletion.verify_password("member@example.test", "correct-password")
            assert error.value.status_code == (403 if status in (400, 401) else 503)
    # Then only the configured password-grant endpoint receives the credentials.
    assert len(requests) == 1
    request = requests[0]
    assert request.method == "POST"
    assert str(request.url) == "https://auth.example.test/auth/v1/token?grant_type=password"
    assert request.headers["apikey"] == "test-service-key"
    assert json.loads(request.content) == {"email": "member@example.test", "password": "correct-password"}
    assert all(0 < value <= 5 for value in request.extensions["timeout"].values())
