from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from app.routers import workouts

MEMBER = "00000000-0000-0000-0000-0000000000f1"
OTHER = "00000000-0000-0000-0000-0000000000f2"
PATH = "/api/v1/workouts"
VALID = {"sport_category": "gym", "duration_minutes": 45, "calories_burned": 250, "memo": "하체"}


@pytest.fixture
def store(strict_app, monkeypatch):
    rows = []

    class Query:
        def __init__(self, table):
            assert table == "workout_logs"
            self.filters = {}
            self.new_row = None
            self.deleting = False
            self.maximum = 100
            self.descending = False
            self.order_key = None

        def select(self, columns):
            assert columns == "*"
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def order(self, key, desc=False):
            self.order_key = key
            self.descending = desc
            return self

        def limit(self, maximum):
            self.maximum = maximum
            return self

        def insert(self, row):
            self.new_row = row
            return self

        def delete(self):
            self.deleting = True
            return self

        def execute(self):
            if self.new_row is not None:
                saved = {"id": str(uuid4()), "created_at": "2026-10-29T01:00:00Z", **self.new_row}
                rows.append(saved)
                return SimpleNamespace(data=[saved])
            matched = [
                row for row in rows
                if all(row.get(key) == value for key, value in self.filters.items())
            ]
            if self.deleting:
                for row in matched:
                    rows.remove(row)
            if self.order_key:
                matched.sort(key=lambda row: row[self.order_key], reverse=self.descending)
            return SimpleNamespace(data=matched[:self.maximum])

    monkeypatch.setattr(workouts, "get_optional_supabase", lambda: SimpleNamespace(table=Query))
    strict_app.app.dependency_overrides[workouts.get_current_user] = lambda: SimpleNamespace(id=MEMBER)
    try:
        yield SimpleNamespace(app=strict_app.app, rows=rows)
    finally:
        strict_app.app.dependency_overrides.clear()


def test_create_uses_token_identity_and_maps_storage_columns(store):
    with TestClient(store.app) as client:
        response = client.post(PATH, json={**VALID, "user_id": OTHER})
    assert response.status_code == 201
    saved = response.json()
    assert saved["user_id"] == MEMBER
    assert saved["duration"] == 45
    assert saved["workout_type"] == saved["sport_category"] == "gym"
    assert saved["calories_burned"] == 250
    assert saved["data"] == {"memo": "하체"}
    assert store.rows == [saved]


@pytest.mark.parametrize("sport", ["gym", "running", "pilates", "yoga", "crossfit"])
def test_create_accepts_each_mobile_sport_and_optional_defaults(store, sport):
    with TestClient(store.app) as client:
        response = client.post(PATH, json={"sport_category": sport, "duration_minutes": 1})
    assert response.status_code == 201
    assert response.json()["calories_burned"] == 0
    assert response.json()["data"] == {"memo": ""}


def test_list_only_own_rows_newest_first_with_limit(store):
    store.rows.extend([
        {"id": str(uuid4()), "user_id": MEMBER, "created_at": "2026-10-27T00:00:00Z"},
        {"id": str(uuid4()), "user_id": OTHER, "created_at": "2026-10-30T00:00:00Z"},
        {"id": str(uuid4()), "user_id": MEMBER, "created_at": "2026-10-29T00:00:00Z"},
        {"id": str(uuid4()), "user_id": MEMBER, "created_at": "2026-10-28T00:00:00Z"},
    ])
    with TestClient(store.app) as client:
        response = client.get(PATH, params={"limit": 2})
    assert response.status_code == 200
    assert response.json() == [store.rows[2], store.rows[3]]


def test_delete_own_row_keeps_other_rows(store):
    own_id = str(uuid4())
    store.rows.extend([{"id": own_id, "user_id": MEMBER}, {"id": str(uuid4()), "user_id": OTHER}])
    with TestClient(store.app) as client:
        response = client.delete(f"{PATH}/{own_id}")
    assert response.status_code == 200
    assert response.json() == {"deleted": True}
    assert len(store.rows) == 1
    assert store.rows[0]["user_id"] == OTHER


@pytest.mark.parametrize("owner", [OTHER, MEMBER])
def test_delete_not_owned_or_missing_returns_404_and_preserves_rows(store, owner):
    row = {"id": str(uuid4()), "user_id": owner}
    store.rows.append(row)
    requested_id = row["id"] if owner == OTHER else str(uuid4())
    with TestClient(store.app) as client:
        response = client.delete(f"{PATH}/{requested_id}")
    assert response.status_code == 404
    assert store.rows == [row]


@pytest.mark.parametrize("change", [
    {"duration_minutes": 0}, {"duration_minutes": -1}, {"duration_minutes": 601},
    {"duration_minutes": 1.5}, {"duration_minutes": True},
    {"sport_category": "swimming"}, {"memo": "가" * 201},
    {"calories_burned": -1}, {"calories_burned": 5001},
])
def test_invalid_body_returns_422_without_writing(store, change):
    with TestClient(store.app) as client:
        response = client.post(PATH, json={**VALID, **change})
    assert response.status_code == 422
    assert store.rows == []


@pytest.mark.parametrize("limit", [0, -1, 101])
def test_invalid_limit_returns_422(store, limit):
    with TestClient(store.app) as client:
        response = client.get(PATH, params={"limit": limit})
    assert response.status_code == 422


def test_upper_bound_values_are_accepted(store):
    with TestClient(store.app) as client:
        response = client.post(PATH, json={
            **VALID, "duration_minutes": 600, "calories_burned": 5000, "memo": "가" * 200,
        })
    assert response.status_code == 201


@pytest.mark.parametrize("operation", ["get", "post", "delete"])
@pytest.mark.parametrize("failure", ["missing", "query"])
def test_store_unavailable_returns_503(store, monkeypatch, operation, failure):
    class FailedQuery:
        def __init__(self, _):
            raise APIError({"message": "unavailable", "code": "503", "details": "", "hint": ""})

    database = None if failure == "missing" else SimpleNamespace(table=FailedQuery)
    monkeypatch.setattr(workouts, "get_optional_supabase", lambda: database)
    with TestClient(store.app) as client:
        if operation == "post":
            response = client.post(PATH, json=VALID)
        elif operation == "delete":
            response = client.delete(f"{PATH}/{uuid4()}")
        else:
            response = client.get(PATH)
    assert response.status_code == 503


def test_demo_create_list_delete_stays_in_memory(demo_app, monkeypatch):
    def forbidden():
        pytest.fail("Demo workouts must not call Supabase")

    monkeypatch.setattr(workouts, "get_optional_supabase", forbidden)
    with TestClient(demo_app.app) as client:
        created = client.post(PATH, json=VALID)
        assert created.status_code == 201
        row = created.json()
        assert client.get(PATH).json() == [row]
        assert client.delete(f"{PATH}/{row['id']}").json() == {"deleted": True}
        assert client.get(PATH).json() == []
        assert client.delete(f"{PATH}/{row['id']}").status_code == 404
