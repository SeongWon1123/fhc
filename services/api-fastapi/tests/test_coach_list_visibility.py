from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.routers import coaches

ROWS = [
    {"id": "approved", "role": "coach", "coach_details": {"is_verified": True}},
    {"id": "applicant", "role": "coach", "coach_details": {"is_verified": False}},
    {"id": "member", "role": "user", "coach_details": {"is_verified": True}},
]


def _value(row, column):
    value = row
    for part in column.split("."):
        value = (value or {}).get(part)
    return value


class Query:
    def __init__(self):
        self.filters = []

    def select(self, _):
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def range(self, *_):
        return self

    def execute(self):
        rows = [row for row in ROWS if all(_value(row, c) == v for c, v in self.filters)]
        return SimpleNamespace(data=rows)


def test_coach_list_returns_only_approved_coaches(strict_app, monkeypatch):
    monkeypatch.setattr(coaches, "get_optional_supabase", lambda: SimpleNamespace(table=lambda _: Query()))
    with TestClient(strict_app.app) as client:
        response = client.get("/api/v1/coaches")
    assert response.status_code == 200
    assert [coach["id"] for coach in response.json()["coaches"]] == ["approved"]
