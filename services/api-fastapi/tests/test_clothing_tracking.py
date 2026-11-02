from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.routers import clothing
from app.services import clothing_service

ME = "00000000-0000-0000-0000-00000000c001"
OTHER = "00000000-0000-0000-0000-00000000c002"


@pytest.fixture
def store(strict_app, monkeypatch):
    rows = []

    class Query:
        def __init__(self, _table):
            self.filters = {}
            self.change = None
            self.new_row = None

        def select(self, *_):
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def order(self, *_, **__):
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
            if self.new_row is not None:
                saved = {"id": f"rec-{len(rows) + 1}", **self.new_row}
                rows.append(saved)
                return SimpleNamespace(data=[saved])
            matched = [r for r in rows if all(r.get(k) == v for k, v in self.filters.items())]
            if self.change is not None:
                for row in matched:
                    row.update(self.change)
            return SimpleNamespace(data=list(reversed(matched)))

    client = SimpleNamespace(table=Query)
    monkeypatch.setattr(clothing_service, "get_optional_supabase", lambda: client)
    monkeypatch.setattr(clothing, "get_optional_supabase", lambda: client)
    strict_app.app.dependency_overrides[clothing.get_current_user] = lambda: SimpleNamespace(id=ME)
    yield SimpleNamespace(app=strict_app.app, rows=rows)
    strict_app.app.dependency_overrides.clear()


def test_recommendations_use_working_search_links_and_return_a_trackable_id(store):
    with TestClient(store.app) as client:
        body = client.get("/api/v1/clothing/recommendations", params={"sport_category": "running"}).json()
    assert body["recommendation_id"] == store.rows[0]["id"]
    assert all(item["url"].startswith("https://www.musinsa.com/search/goods?keyword=") for item in body["items"])
    assert all(item["commission_rate"] == 0 for item in body["items"])


def test_retired_sample_links_are_replaced(store):
    store.rows.append({
        "id": "old", "user_id": ME, "sport_category": "gym",
        "items": [{"name": "x", "url": "https://www.musinsa.com/products/sample1"}],
    })
    with TestClient(store.app) as client:
        body = client.get("/api/v1/clothing/recommendations").json()
    assert body["recommendation_id"] != "old"
    assert "/products/sample" not in str(body["items"])


def test_click_is_recorded_only_on_the_callers_recommendation(store):
    store.rows.append({"id": "mine", "user_id": ME, "items": []})
    store.rows.append({"id": "theirs", "user_id": OTHER, "items": []})
    with TestClient(store.app) as client:
        assert client.post("/api/v1/clothing/click/mine").status_code == 200
        assert client.post("/api/v1/clothing/click/theirs").status_code == 404
    assert store.rows[0].get("clicked_at")
    assert store.rows[1].get("clicked_at") is None
