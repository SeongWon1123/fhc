from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from app.routers import bookings

MEMBER = "00000000-0000-0000-0000-0000000000f1"
COACH = "00000000-0000-0000-0000-0000000000f3"
OTHER_COACH = "00000000-0000-0000-0000-0000000000f4"
FIRST = "10000000-0000-4000-8000-000000000001"
SECOND = "10000000-0000-4000-8000-000000000002"


@pytest.fixture
def store(strict_app, monkeypatch):
    tables = {
        "bookings": [
            {"id": FIRST, "user_id": MEMBER, "coach_id": COACH, "status": "confirmed"},
            {"id": SECOND, "user_id": MEMBER, "coach_id": COACH, "status": "confirmed"},
            {"id": "other", "user_id": MEMBER, "coach_id": OTHER_COACH, "status": "completed"},
        ],
        "coach_details": [{"id": COACH, "booking_count": 99}],
    }
    failures = {"stage": None}

    class Query:
        def __init__(self, table):
            self.table = table
            self.filters = {}
            self.change = None
            self.count = None
            self.head = False

        def select(self, _, count=None, head=False):
            self.count = count
            self.head = head
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def limit(self, _):
            return self

        def update(self, change):
            self.change = change
            return self

        def execute(self):
            if (
                failures["stage"] == "count" and self.count
                or failures["stage"] == "update" and self.table == "coach_details"
            ):
                raise APIError({"code": "XX000", "message": "count unavailable"})
            matched = [
                row for row in tables[self.table]
                if all(row.get(key) == value for key, value in self.filters.items())
            ]
            if self.change is not None:
                for row in matched:
                    row.update(self.change)
            return SimpleNamespace(
                data=[] if self.head else [dict(row) for row in matched],
                count=len(matched) if self.count else None,
            )

    async def skip_notification(*_):
        return "skipped"

    monkeypatch.setattr(bookings, "get_optional_supabase", lambda: SimpleNamespace(table=Query))
    monkeypatch.setattr(bookings, "publish_booking_change", skip_notification)
    strict_app.app.dependency_overrides[bookings.get_current_user] = lambda: SimpleNamespace(id=COACH)
    yield SimpleNamespace(app=strict_app.app, tables=tables, failures=failures)
    strict_app.app.dependency_overrides.clear()


def test_completing_booking_recounts_only_coach_completed_sessions(store):
    with TestClient(store.app) as client:
        response = client.patch(f"/api/v1/bookings/{FIRST}/status", json={"status": "completed"})
    assert response.status_code == 200
    assert store.tables["coach_details"][0]["booking_count"] == 1


@pytest.mark.parametrize("status", ["cancelled", "no_show"])
def test_non_completed_status_leaves_count_unchanged(store, status):
    with TestClient(store.app) as client:
        response = client.patch(f"/api/v1/bookings/{FIRST}/status", json={"status": status})
    assert response.status_code == 200
    assert store.tables["coach_details"][0]["booking_count"] == 99


def test_second_completion_counts_two_without_double_counting(store):
    with TestClient(store.app) as client:
        assert client.patch(
            f"/api/v1/bookings/{FIRST}/status", json={"status": "completed"}
        ).status_code == 200
        response = client.patch(f"/api/v1/bookings/{SECOND}/status", json={"status": "completed"})
        repeated = client.patch(f"/api/v1/bookings/{FIRST}/status", json={"status": "completed"})
    assert response.status_code == 200
    assert repeated.status_code == 409
    assert store.tables["coach_details"][0]["booking_count"] == 2


@pytest.mark.parametrize("stage", ["count", "update"])
def test_recount_failure_does_not_fail_saved_status(store, stage, caplog):
    store.failures["stage"] = stage
    with TestClient(store.app) as client:
        response = client.patch(f"/api/v1/bookings/{FIRST}/status", json={"status": "completed"})
    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    assert store.tables["bookings"][0]["status"] == "completed"
    assert store.tables["coach_details"][0]["booking_count"] == 99
    assert any(record.levelname == "WARNING" and record.name == bookings.__name__ for record in caplog.records)
