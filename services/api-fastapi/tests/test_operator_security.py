from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.routers import admin
from app.services import operator_access


@pytest.fixture
def operator_store(strict_app, monkeypatch):
    rows = {
        "profiles": [
            {"id": "owner-a", "role": "gym_owner"},
            {"id": "owner-b", "role": "gym_owner"},
            {"id": "admin", "role": "admin"},
            {"id": "empty-owner", "role": "gym_owner"},
            {"id": "member-a", "role": "user", "gym_id": "gym-a", "email": "a@example.test", "full_name": "Member A"},
            {"id": "member-b", "role": "user", "gym_id": "gym-b", "email": "b@example.test", "full_name": "Member B"},
            {"id": "coach-a", "role": "coach", "full_name": "Coach A", "coach_details": {"gym_id": "gym-a"}},
            {"id": "coach-b", "role": "coach", "full_name": "Coach B", "coach_details": {"gym_id": "gym-b"}},
        ],
        "gyms": [
            {"id": "gym-a", "owner_id": "owner-a", "is_active": True},
            {"id": "gym-b", "owner_id": "owner-b", "is_active": True},
        ],
        "bookings": [
            {"id": "booking-a", "gym_id": "gym-a", "profiles": {"full_name": "Member A"}, "coach": {"full_name": "Coach A"}},
            {"id": "booking-b", "gym_id": "gym-b", "profiles": {"full_name": "Member B"}, "coach": {"full_name": "Coach B"}},
        ],
        "clothing_recommendations": [
            {"id": "clothing-a", "profiles": {"gym_id": "gym-a"}, "items": [{"name": "Item A"}]},
            {"id": "clothing-b", "profiles": {"gym_id": "gym-b"}, "items": [{"name": "Item B"}]},
        ],
    }

    def field(row, key):
        value = row
        for part in key.split("."):
            value = value.get(part)
        return value

    class Query:
        def __init__(self, table):
            self.rows = deepcopy(rows[table])

        def select(self, _):
            return self

        def eq(self, key, value):
            self.rows = [row for row in self.rows if field(row, key) == value]
            return self

        def in_(self, key, values):
            self.rows = [row for row in self.rows if field(row, key) in values]
            return self

        def limit(self, count):
            self.rows = self.rows[:count]
            return self

        def order(self, *_, **__):
            return self

        def execute(self):
            return SimpleNamespace(data=self.rows)

    async def authenticated_user(credentials):
        # Deliberately untrusted metadata must not grant an operator role.
        return SimpleNamespace(id=credentials.credentials, user_metadata={"role": "admin"})

    client = SimpleNamespace(table=Query)
    monkeypatch.setattr(operator_access, "get_current_user", authenticated_user)
    monkeypatch.setattr(operator_access, "get_optional_supabase", lambda: client)
    monkeypatch.setattr(admin, "get_optional_supabase", lambda: client)
    return strict_app


@pytest.mark.parametrize("path", ["/access", "/overview"])
def test_operator_routes_require_token_in_demo_too(demo_app, path):
    with TestClient(demo_app.app) as client:
        assert client.get("/api/v1/admin" + path).status_code == 401


@pytest.mark.parametrize("user", ["member-a", "coach-a", "unknown"])
def test_operator_role_comes_from_stored_profile(operator_store, user):
    with TestClient(operator_store.app) as client:
        response = client.get("/api/v1/admin/access", headers={"Authorization": f"Bearer {user}"})
        assert response.status_code == 403


@pytest.mark.parametrize(("owner", "suffix"), [("owner-a", "a"), ("owner-b", "b")])
def test_owner_overview_contains_only_owned_gym(operator_store, owner, suffix):
    with TestClient(operator_store.app) as client:
        headers = {"Authorization": f"Bearer {owner}"}
        access = client.get("/api/v1/admin/access", headers=headers)
        assert access.json() == {"role": "gym_owner", "gym_ids": [f"gym-{suffix}"]}
        response = client.get("/api/v1/admin/overview", headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert [row["id"] for row in body["coaches"]] == [f"coach-{suffix}"]
        assert [row["id"] for row in body["members"]] == [f"member-{suffix}"]
        assert [row["id"] for row in body["bookings"]] == [f"booking-{suffix}"]
        assert [row["id"] for row in body["clothing_items"]] == [f"clothing-{suffix}-0"]


def test_global_admin_can_read_both_gyms(operator_store):
    with TestClient(operator_store.app) as client:
        response = client.get(
            "/api/v1/admin/overview", headers={"Authorization": "Bearer admin"}
        )
        assert response.status_code == 200
        assert {row["id"] for row in response.json()["members"]} == {"member-a", "member-b"}


def test_owner_without_gyms_does_not_get_global_data(operator_store):
    with TestClient(operator_store.app) as client:
        response = client.get(
            "/api/v1/admin/overview", headers={"Authorization": "Bearer empty-owner"}
        )
        assert response.status_code == 200
        assert response.json() == {
            "source": "supabase", "coaches": [], "coach_applications": [],
            "members": [], "bookings": [], "clothing_items": [],
        }
