from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from app.routers import bookings

MEMBER = "00000000-0000-0000-0000-0000000000f1"
OTHER = "00000000-0000-0000-0000-0000000000f2"
COACH = "00000000-0000-0000-0000-0000000000f3"
DONE = "10000000-0000-4000-8000-000000000001"
PENDING = "10000000-0000-4000-8000-000000000002"
DONE_2 = "10000000-0000-4000-8000-000000000003"


@pytest.fixture
def store(strict_app, monkeypatch):
    tables = {
        "bookings": [
            {"id": DONE, "user_id": MEMBER, "coach_id": COACH, "status": "completed"},
            {"id": PENDING, "user_id": MEMBER, "coach_id": COACH, "status": "pending"},
            {"id": DONE_2, "user_id": OTHER, "coach_id": COACH, "status": "completed"},
        ],
        "reviews": [],
        "coach_details": [{"id": COACH, "rating": 0, "review_count": 0}],
    }

    class Query:
        def __init__(self, table):
            self.table = table
            self.filters = {}
            self.change = None
            self.new_row = None

        def select(self, *_):
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def limit(self, _):
            return self

        def insert(self, row):
            self.new_row = row
            return self

        def update(self, change):
            self.change = change
            return self

        def execute(self):
            rows = tables[self.table]
            if self.new_row is not None:
                if any(r["booking_id"] == self.new_row["booking_id"] for r in rows):
                    raise APIError({"code": "23505", "message": "duplicate"})
                saved = {"id": f"review-{len(rows) + 1}", **self.new_row}
                rows.append(saved)
                return SimpleNamespace(data=[saved])
            matched = [r for r in rows if all(r.get(k) == v for k, v in self.filters.items())]
            if self.change is not None:
                for row in matched:
                    row.update(self.change)
            return SimpleNamespace(data=matched)

    actor = {"id": MEMBER}
    monkeypatch.setattr(bookings, "get_optional_supabase", lambda: SimpleNamespace(table=Query))
    strict_app.app.dependency_overrides[bookings.get_current_user] = lambda: SimpleNamespace(id=actor["id"])
    yield SimpleNamespace(app=strict_app.app, tables=tables, actor=actor)
    strict_app.app.dependency_overrides.clear()


def review(client, booking_id, rating=5, content="  좋았습니다  "):
    return client.post(f"/api/v1/bookings/{booking_id}/review", json={"rating": rating, "content": content})


def test_member_reviews_completed_booking_and_coach_rating_updates(store):
    with TestClient(store.app) as client:
        first = review(client, DONE, 5)
        store.actor["id"] = OTHER
        second = review(client, DONE_2, 2)
    assert first.status_code == 200
    assert first.json()["content"] == "좋았습니다"
    assert second.status_code == 200
    assert store.tables["coach_details"][0] == {"id": COACH, "rating": 3.5, "review_count": 2}


def test_one_review_per_booking(store):
    with TestClient(store.app) as client:
        assert review(client, DONE).status_code == 200
        assert review(client, DONE, 1).status_code == 409
    assert len(store.tables["reviews"]) == 1


def test_unfinished_or_foreign_bookings_cannot_be_reviewed(store):
    with TestClient(store.app) as client:
        assert review(client, PENDING).status_code == 409
        assert review(client, DONE_2).status_code == 403
        store.actor["id"] = COACH
        assert review(client, DONE).status_code == 403
    assert store.tables["reviews"] == []


@pytest.mark.parametrize("payload", [{"rating": 0}, {"rating": 6}, {"rating": 5, "content": "x" * 501}])
def test_invalid_review_is_rejected(store, payload):
    with TestClient(store.app) as client:
        assert client.post(f"/api/v1/bookings/{DONE}/review", json=payload).status_code == 422
    assert store.tables["reviews"] == []
