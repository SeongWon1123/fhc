from types import SimpleNamespace
from uuid import UUID

from fastapi.testclient import TestClient

from app import fallback
from app.routers import diet


def test_chat_rejects_non_uuid_session(demo_app):
    with TestClient(demo_app.app) as client:
        response = client.post(
            "/api/v1/diet/chat",
            json={"session_id": "diet_123456", "message": "lunch"},
        )
        assert response.status_code == 422


def test_chat_default_session_is_uuid(demo_app, monkeypatch):
    async def reply(*_):
        return "response", []

    monkeypatch.setattr(diet, "generate_diet_response", reply)
    with TestClient(demo_app.app) as client:
        response = client.post("/api/v1/diet/chat", json={"message": "lunch"})
        assert response.status_code == 200
        assert UUID(response.json()["session_id"]).version == 4


def test_chat_history_is_filtered_by_user_and_session(strict_app, monkeypatch):
    actor = SimpleNamespace(id="00000000-0000-0000-0000-000000000011")
    session = "11111111-1111-4111-8111-111111111111"
    messages = [
        {"user_id": str(actor.id), "session_id": session, "role": "user", "content": "mine"},
        {"user_id": "other", "session_id": session, "role": "user", "content": "private"},
        {"user_id": str(actor.id), "session_id": "other", "role": "user", "content": "other session"},
    ]
    captured = []
    inserted = []

    class Query:
        def __init__(self, table):
            self.table = table
            self.filters = {}
            self.count = None
            self.created_after = None

        def select(self, _, *, count=None):
            self.count = count
            return self

        def eq(self, key, value):
            self.filters[key] = value
            return self

        def gte(self, key, value):
            assert key == "created_at"
            self.created_after = value
            return self

        def single(self):
            return self

        def order(self, *_, **__):
            return self

        def limit(self, _):
            return self

        def insert(self, rows):
            inserted.extend(rows)
            return self

        def execute(self):
            data = {} if self.table == "profiles" else [
                row for row in messages
                if all(row.get(key) == value for key, value in self.filters.items())
                and (
                    self.created_after is None
                    or row.get("created_at", self.created_after) >= self.created_after
                )
            ]
            return SimpleNamespace(data=data, count=len(data) if self.count else None)

    async def reply(_, history, __):
        captured.extend(history)
        return "response", []

    strict_app.app.dependency_overrides[diet.get_current_user] = lambda: actor
    monkeypatch.setattr(diet, "get_optional_supabase", lambda: SimpleNamespace(table=Query))
    monkeypatch.setattr(diet, "generate_diet_response", reply)
    try:
        with TestClient(strict_app.app) as client:
            response = client.post(
                "/api/v1/diet/chat", json={"session_id": session, "message": "lunch"}
            )
            assert response.status_code == 200
            assert captured == [{"role": "user", "content": "mine"}]
            assert all(row["user_id"] == str(actor.id) for row in inserted)
            assert all(row["session_id"] == session for row in inserted)
    finally:
        strict_app.app.dependency_overrides.clear()


def test_saved_meal_can_be_read_back(demo_app, monkeypatch):
    monkeypatch.setattr(fallback, "_DIET_LOGS", [])
    meal = {
        "meal_type": "lunch", "food_name": "rice", "calories": 300,
        "macronutrients": {"protein": 10, "fat": 5, "carb": 50, "fiber": 2},
        "ai_analysis": "balanced",
    }
    with TestClient(demo_app.app) as client:
        saved = client.post("/api/v1/diet/logs", json=meal)
        assert saved.status_code == 200
        rows = client.get("/api/v1/diet/logs").json()
        assert any(row["id"] == saved.json()["id"] and row["food_name"] == "rice" for row in rows)
