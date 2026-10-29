from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.routers import admin, coaches
from app.services import operator_access

APPLICANT = "00000000-0000-0000-0000-0000000000a1"
COACH = "00000000-0000-0000-0000-0000000000c1"
OWNER = "00000000-0000-0000-0000-0000000000b1"
ADMIN = "00000000-0000-0000-0000-0000000000d1"
MEMBER = "00000000-0000-0000-0000-0000000000e1"


@pytest.fixture
def store(strict_app, monkeypatch):
    tables = {
        "profiles": [
            {"id": APPLICANT, "role": "user", "full_name": "Applicant"},
            {"id": COACH, "role": "coach", "full_name": "Coach"},
            {"id": OWNER, "role": "gym_owner"},
            {"id": ADMIN, "role": "admin"},
            {"id": MEMBER, "role": "user"},
        ],
        "coach_details": [
            {"id": APPLICANT, "is_verified": False, "base_price": 30000},
            {"id": COACH, "is_verified": True, "base_price": 50000},
            {"id": OWNER, "is_verified": False},
        ],
        "gyms": [],
    }

    class Query:
        def __init__(self, table):
            self.table = table
            self.filters = {}
            self.change = None
            self.delete_rows = False

        def select(self, *_):
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def limit(self, _):
            return self

        def update(self, change):
            self.change = change
            return self

        def delete(self):
            self.delete_rows = True
            return self

        def upsert(self, row):
            self.change = row
            return self

        def execute(self):
            rows = tables[self.table]
            matched = [r for r in rows if all(r.get(k) == v for k, v in self.filters.items())]
            if self.delete_rows:
                tables[self.table] = [r for r in rows if r not in matched]
            elif self.change is not None and not self.filters:
                existing = [r for r in rows if r["id"] == self.change["id"]]
                if existing:
                    existing[0].update(self.change)
                else:
                    rows.append(dict(self.change))
                matched = [self.change]
            elif self.change is not None:
                for row in matched:
                    row.update(self.change)
            return SimpleNamespace(data=matched)

    async def authenticated_user(credentials):
        return SimpleNamespace(id=credentials.credentials)

    client = SimpleNamespace(table=Query)
    monkeypatch.setattr(operator_access, "get_current_user", authenticated_user)
    monkeypatch.setattr(operator_access, "get_optional_supabase", lambda: client)
    monkeypatch.setattr(admin, "get_optional_supabase", lambda: client)
    monkeypatch.setattr(coaches, "get_optional_supabase", lambda: client)
    return SimpleNamespace(app=strict_app.app, tables=tables)


def _as(user):
    return {"Authorization": f"Bearer {user}"}


def _row(store, table, row_id):
    return next((r for r in store.tables[table] if r["id"] == row_id), None)


def test_admin_approval_makes_applicant_a_verified_coach(store):
    with TestClient(store.app) as client:
        response = client.post(f"/api/v1/admin/coaches/{APPLICANT}/approve", headers=_as(ADMIN))
    assert response.status_code == 200
    assert _row(store, "profiles", APPLICANT)["role"] == "coach"
    assert _row(store, "coach_details", APPLICANT)["is_verified"] is True


@pytest.mark.parametrize("actor", [OWNER, MEMBER, COACH])
@pytest.mark.parametrize("action", ["approve", "reject"])
def test_only_global_admin_decides_applications(store, actor, action):
    with TestClient(store.app) as client:
        response = client.post(f"/api/v1/admin/coaches/{APPLICANT}/{action}", headers=_as(actor))
    assert response.status_code == 403
    assert _row(store, "profiles", APPLICANT)["role"] == "user"
    assert _row(store, "coach_details", APPLICANT) is not None


def test_operator_profile_cannot_be_approved_as_coach(store):
    with TestClient(store.app) as client:
        response = client.post(f"/api/v1/admin/coaches/{OWNER}/approve", headers=_as(ADMIN))
    assert response.status_code == 409
    assert _row(store, "profiles", OWNER)["role"] == "gym_owner"


def test_unknown_application_is_not_found(store):
    with TestClient(store.app) as client:
        response = client.post(f"/api/v1/admin/coaches/{MEMBER}/approve", headers=_as(ADMIN))
    assert response.status_code == 404
    assert _row(store, "profiles", MEMBER)["role"] == "user"


def test_reject_removes_only_pending_applications(store):
    with TestClient(store.app) as client:
        rejected = client.post(f"/api/v1/admin/coaches/{APPLICANT}/reject", headers=_as(ADMIN))
        approved_coach = client.post(f"/api/v1/admin/coaches/{COACH}/reject", headers=_as(ADMIN))
    assert rejected.status_code == 200
    assert _row(store, "coach_details", APPLICANT) is None
    assert _row(store, "profiles", APPLICANT)["role"] == "user"
    assert approved_coach.status_code == 409
    assert _row(store, "coach_details", COACH) is not None


def test_applicant_cannot_self_verify_or_change_role(store):
    store.app.dependency_overrides[coaches.get_current_user] = lambda: SimpleNamespace(id=MEMBER)
    try:
        with TestClient(store.app) as client:
            saved = client.put(
                "/api/v1/coaches/me/details",
                json={"specialty": ["gym"], "base_price": 30000, "is_verified": True, "role": "coach"},
            )
            mine = client.get("/api/v1/coaches/me/details")
    finally:
        store.app.dependency_overrides.clear()
    assert saved.status_code == 200
    assert _row(store, "coach_details", MEMBER).get("is_verified") is not True
    assert _row(store, "profiles", MEMBER)["role"] == "user"
    assert mine.json()["role"] == "user"
    assert mine.json()["details"]["base_price"] == 30000


@pytest.mark.parametrize(
    "payload",
    [{"base_price": -1}, {"specialty": []}, {"experience_years": 99}, {"name": ""}],
)
def test_invalid_coach_profile_is_rejected(store, payload):
    store.app.dependency_overrides[coaches.get_current_user] = lambda: SimpleNamespace(id=MEMBER)
    try:
        with TestClient(store.app) as client:
            response = client.put("/api/v1/coaches/me/details", json=payload)
    finally:
        store.app.dependency_overrides.clear()
    assert response.status_code == 422
