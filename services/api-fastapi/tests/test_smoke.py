"""Smoke tests for the FitConnect core API.

Every test builds its own TestClient from an app whose configuration it controls
(see ``demo_app`` / ``strict_app`` in conftest), so the suite asserts real
contracts rather than whatever happens to be in the developer's ``.env``.
"""

from fastapi.testclient import TestClient

from app.fallback import SAMPLE_COACHES

DEMO_COACH_ID = SAMPLE_COACHES[0]["id"]
UNKNOWN_COACH_ID = "99999999-9999-9999-9999-999999999999"


def test_root_and_health_report_running(demo_app) -> None:
    with TestClient(demo_app.app, raise_server_exceptions=False) as client:
        root = client.get("/")
        assert root.status_code == 200
        assert root.json()["status"] == "running"

        health = client.get("/health")
        assert health.status_code == 200
        body = health.json()
        assert body["status"] == "healthy"
        assert "dependencies" in body


def test_openapi_schema_covers_every_router(demo_app) -> None:
    with TestClient(demo_app.app, raise_server_exceptions=False) as client:
        schema = client.get("/openapi.json")
        assert schema.status_code == 200
        paths = schema.json()["paths"]
        for prefix in (
            "/api/v1/coaches",
            "/api/v1/bookings",
            "/api/v1/diet",
            "/api/v1/clothing",
            "/api/v1/admin",
        ):
            assert any(path.startswith(prefix) for path in paths), f"no routes under {prefix}"


class TestDemoFallback:
    """Behaviour with no data store configured and the fallback enabled."""

    def test_coach_listing_serves_demo_data(self, demo_app) -> None:
        with TestClient(demo_app.app, raise_server_exceptions=False) as client:
            response = client.get("/api/v1/coaches/")
            assert response.status_code == 200
            body = response.json()
            assert body["source"] == "demo-fallback"
            assert body["total"] == len(body["coaches"]) > 0
            assert {"id", "full_name", "coach_details"} <= set(body["coaches"][0])

    def test_coach_price_filter_narrows_results(self, demo_app) -> None:
        with TestClient(demo_app.app, raise_server_exceptions=False) as client:
            unfiltered = client.get("/api/v1/coaches/").json()["coaches"]
            ceiling = min(coach["coach_details"]["base_price"] for coach in unfiltered)

            filtered = client.get("/api/v1/coaches/", params={"max_price": ceiling})
            assert filtered.status_code == 200
            coaches = filtered.json()["coaches"]
            assert coaches, "the cheapest demo coach must survive its own price ceiling"
            assert all(c["coach_details"]["base_price"] <= ceiling for c in coaches)

    def test_coach_detail_resolves_a_known_coach(self, demo_app) -> None:
        with TestClient(demo_app.app, raise_server_exceptions=False) as client:
            response = client.get(f"/api/v1/coaches/{DEMO_COACH_ID}")
            assert response.status_code == 200
            assert str(response.json()["id"]) == DEMO_COACH_ID

    def test_booking_creation_returns_a_priced_online_booking(self, demo_app) -> None:
        with TestClient(demo_app.app, raise_server_exceptions=False) as client:
            payload = {
                "coach_id": DEMO_COACH_ID,
                "scheduled_at": "2026-12-01T10:00:00",
                "session_type": "online",
                "notes": "smoke test",
            }
            response = client.post("/api/v1/bookings", json=payload)
            assert response.status_code in (200, 201), response.text
            body = response.json()
            assert str(body["coach_id"]) == DEMO_COACH_ID
            assert body["price"] > 0
            assert body["status"]
            assert body["meeting_url"], "an online session must carry a meeting link"

    def test_booking_listing_returns_a_list(self, demo_app) -> None:
        with TestClient(demo_app.app, raise_server_exceptions=False) as client:
            response = client.get("/api/v1/bookings/my")
            assert response.status_code == 200
            assert isinstance(response.json(), list)

    def test_diet_chat_answers_a_prompt(self, demo_app) -> None:
        with TestClient(demo_app.app, raise_server_exceptions=False) as client:
            response = client.post(
                "/api/v1/diet/chat", json={"message": "오늘 점심은 뭘 먹을까?"}
            )
            assert response.status_code == 200, response.text
            body = response.json()
            assert body["reply"], "chat responses carry the answer in `reply`"
            assert body["session_id"]

    def test_clothing_recommendations_are_served(self, demo_app) -> None:
        with TestClient(demo_app.app, raise_server_exceptions=False) as client:
            response = client.get("/api/v1/clothing/recommendations")
            assert response.status_code == 200, response.text
            body = response.json()
            items = body["items"] if isinstance(body, dict) else body
            assert isinstance(items, list)


class TestWithoutFallback:
    """Behaviour with the fallback disabled: routes must fail closed, not fake data."""

    def test_coach_listing_reports_an_unavailable_store(self, strict_app) -> None:
        with TestClient(strict_app.app, raise_server_exceptions=False) as client:
            response = client.get("/api/v1/coaches/")
            assert response.status_code == 503, response.text

    def test_protected_routes_reject_anonymous_callers(self, strict_app) -> None:
        with TestClient(strict_app.app, raise_server_exceptions=False) as client:
            assert client.get("/api/v1/bookings/my").status_code == 401
            chat = client.post("/api/v1/diet/chat", json={"message": "안녕"})
            assert chat.status_code == 401

    def test_admin_overview_fails_closed_without_a_data_store(self, strict_app) -> None:
        """`_require_admin_key` is a no-op outside production.

        In a non-production environment without Supabase the admin overview
        reports 503 rather than serving demo rows. This pins that behaviour: if
        the admin console is ever exposed beyond local use, the missing
        production key check is the thing to revisit.
        """
        with TestClient(strict_app.app, raise_server_exceptions=False) as client:
            response = client.get("/api/v1/admin/overview")
            assert response.status_code == 503, response.text


class TestValidation:
    """Request validation contracts that hold in every configuration."""

    def test_coach_detail_rejects_a_non_uuid_id(self, demo_app) -> None:
        """The path parameter is typed UUID, so a bad id is a 422, not a 404."""
        with TestClient(demo_app.app, raise_server_exceptions=False) as client:
            response = client.get("/api/v1/coaches/not-a-uuid")
            assert response.status_code == 422

    def test_coach_detail_404s_for_an_unknown_uuid(self, demo_app) -> None:
        with TestClient(demo_app.app, raise_server_exceptions=False) as client:
            response = client.get(f"/api/v1/coaches/{UNKNOWN_COACH_ID}")
            assert response.status_code == 404

    def test_booking_creation_rejects_a_malformed_body(self, demo_app) -> None:
        with TestClient(demo_app.app, raise_server_exceptions=False) as client:
            response = client.post("/api/v1/bookings", json={"coach_id": "not-a-uuid"})
            assert response.status_code == 422
