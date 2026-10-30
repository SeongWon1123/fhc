import base64
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import anyio
import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.services import rag_service


VECTOR = [0.125] * 768
FOOD = {
    "food_name": "비빔밥", "calories": 500,
    "macronutrients": {"protein": 20, "fat": 10, "carb": 80, "fiber": 5},
    "ai_analysis": "채소와 단백질을 함께 섭취하세요.", "recommendations": [],
}


@pytest.fixture
def api_settings(monkeypatch):
    config = Settings(
        _env_file=None,
        embed_provider="openai_compatible", embed_api_base_url="", embed_api_key="",
        embed_api_model="openai/text-embedding-3-small", embed_dimensions=768,
        rag_match_threshold=0.3,
        vision_provider="openai_compatible", vision_api_base_url="", vision_api_key="",
        vision_api_model="qwen/qwen3-vl-8b-instruct",
        chat_provider="openai_compatible", chat_api_base_url="https://llm.example/v1/",
        chat_api_key="test-secret-key", chat_api_model="chat-model",
    )
    monkeypatch.setattr(rag_service, "settings", config)
    return config


def route(monkeypatch, handler):
    real_client = httpx.AsyncClient
    requests = []

    def record(request):
        requests.append(request)
        return handler(request)

    monkeypatch.setattr(
        rag_service.httpx, "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(record), **kwargs),
    )
    return requests


@pytest.mark.parametrize("override", [False, True])
def test_embedding_request_and_chat_fallback(monkeypatch, api_settings, override, caplog):
    # Given: either dedicated embedding credentials or the chat credentials.
    if override:
        api_settings.embed_api_base_url = "https://embed.example/v1/"
        api_settings.embed_api_key = "dedicated-secret"
    requests = route(monkeypatch, lambda _: httpx.Response(200, json={"data": [{"embedding": VECTOR}]}))
    # When: the real embedding adapter runs.
    result = anyio.run(rag_service.get_embedding, "점심")
    # Then: the OpenAI wire contract requests the schema's exact dimension.
    assert result == VECTOR
    assert len(requests) == 1
    request = requests[0]
    base = "https://embed.example/v1" if override else "https://llm.example/v1"
    key = "dedicated-secret" if override else "test-secret-key"
    assert str(request.url) == f"{base}/embeddings"
    assert request.headers["Authorization"] == f"Bearer {key}"
    assert json.loads(request.content) == {
        "model": "openai/text-embedding-3-small", "input": "점심", "dimensions": 768,
    }
    assert request.extensions["timeout"]["read"] == 30
    assert key not in caplog.text


def test_embedding_dimension_mismatch_raises(monkeypatch, api_settings):
    # Given: the upstream ignores the requested dimensions.
    route(monkeypatch, lambda _: httpx.Response(200, json={"data": [{"embedding": [1.0] * 1536}]}))
    # When/Then: incompatible vectors cannot reach the database.
    with pytest.raises(ValueError, match="dimension"):
        anyio.run(rag_service.get_embedding, "meal")


def test_ollama_embedding_path_is_preserved(monkeypatch, api_settings):
    # Given: the default local provider.
    api_settings.embed_provider = "ollama"
    requests = route(monkeypatch, lambda _: httpx.Response(200, json={"embedding": VECTOR}))
    # When: a local embedding is requested.
    assert anyio.run(rag_service.get_embedding, "meal") == VECTOR
    # Then: Ollama's original body and endpoint remain unchanged.
    assert requests[0].url.path == "/api/embeddings"
    assert json.loads(requests[0].content) == {
        "model": api_settings.ollama_embed_model, "prompt": "meal",
    }


def test_search_uses_configured_threshold_and_rpc_contract(monkeypatch, api_settings):
    # Given: real embeddings and a recording RPC boundary.
    calls = []
    docs = [{"title": "nutrition", "content": "rice"}]

    def rpc(name, params):
        calls.append((name, params))
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=docs))

    monkeypatch.setattr(rag_service, "get_optional_supabase", lambda: SimpleNamespace(rpc=rpc))
    route(monkeypatch, lambda _: httpx.Response(200, json={"data": [{"embedding": VECTOR}]}))
    # When: retrieval specifies a category and count.
    result = anyio.run(rag_service.search_rag, "meal", "nutrition", 3)
    # Then: the full existing RPC contract uses the configured threshold.
    assert result == docs
    assert calls == [("match_rag_documents", {
        "query_embedding": VECTOR, "match_threshold": 0.3,
        "match_count": 3, "filter_category": "nutrition",
    })]


@pytest.mark.parametrize("failure", ["embedding", "dimension", "rpc"])
def test_retrieval_failure_keeps_chat_available_without_sources(
    monkeypatch, api_settings, caplog, failure,
):
    # Given: retrieval fails but the chat API is healthy.
    def rpc(*_):
        raise RuntimeError("test-secret-key must not be logged")

    monkeypatch.setattr(rag_service, "get_optional_supabase", lambda: SimpleNamespace(rpc=rpc))

    def handler(request):
        if request.url.path.endswith("/embeddings"):
            if failure == "embedding":
                return httpx.Response(401, json={"error": "test-secret-key"})
            return httpx.Response(200, json={"data": [{
                "embedding": [1] if failure == "dimension" else VECTOR,
            }]})
        return httpx.Response(200, json={"choices": [{"message": {"content": "식단 답변"}}]})

    route(monkeypatch, handler)
    # When: the full answer pipeline runs, including retrieval failure handling.
    reply, sources = anyio.run(rag_service.generate_diet_response, "meal", [], {})
    # Then: retrieval has returned [] and chat has still answered.
    assert reply == "식단 답변"
    assert sources == []
    assert any(record.levelname == "WARNING" for record in caplog.records)
    assert "test-secret-key" not in caplog.text


@pytest.mark.parametrize("mime", ["image/jpeg", "image/png", "image/webp"])
@pytest.mark.parametrize("override", [False, True])
def test_vision_uses_multimodal_request(monkeypatch, api_settings, mime, override):
    # Given: a hosted vision model and a known image payload.
    if override:
        api_settings.vision_api_base_url = "https://vision.example/v1/"
        api_settings.vision_api_key = "vision-secret"
    requests = route(monkeypatch, lambda _: httpx.Response(200, json={
        "choices": [{"message": {"content": json.dumps(FOOD)}}],
    }))
    # When: the real image analyzer runs.
    result = anyio.run(rag_service.analyze_food_image, b"image-bytes", {}, mime)
    # Then: MIME and base64 bytes survive the OpenAI content parts contract.
    assert result == {**FOOD, "analysis": FOOD["ai_analysis"]}
    base = "https://vision.example/v1" if override else "https://llm.example/v1"
    assert str(requests[0].url) == f"{base}/chat/completions"
    key = "vision-secret" if override else "test-secret-key"
    assert requests[0].headers["Authorization"] == f"Bearer {key}"
    body = json.loads(requests[0].content)
    assert body["model"] == "qwen/qwen3-vl-8b-instruct"
    assert body["temperature"] == 0.2
    assert body["max_tokens"] == 600
    message, = body["messages"]
    assert message["role"] == "user"
    text, image = message["content"]
    assert text["type"] == "text"
    assert isinstance(text["text"], str)
    assert image == {"type": "image_url", "image_url": {
        "url": f"data:{mime};base64,{base64.b64encode(b'image-bytes').decode()}",
    }}


@pytest.mark.parametrize("raw", ["not JSON", '{"food_name":', "[]"])
def test_invalid_vision_json_returns_safe_default(monkeypatch, api_settings, raw):
    # Given: a model response that cannot be parsed as an analysis object.
    route(monkeypatch, lambda _: httpx.Response(200, json={
        "choices": [{"message": {"content": raw}}],
    }))
    # When: image analysis parses the model output.
    result = anyio.run(rag_service.analyze_food_image, b"image", {})
    # Then: unknown nutrition is never replaced by invented calories.
    assert result["food_name"] == "Unknown food"
    assert result["calories"] == 0
    assert result["macronutrients"] == dict.fromkeys(["protein", "fat", "carb", "fiber"], 0)
    assert result["analysis"] == result["ai_analysis"]


@pytest.mark.parametrize("content", [
    "{}",
    '{"food_name":"rice","calories":"many","macronutrients":null}',
    json.dumps({**FOOD, "calories": -1}),
    json.dumps({**FOOD, "calories": True}),
    json.dumps({**FOOD, "macronutrients": {"protein": 1, "fat": 1, "carb": 1}}),
    json.dumps({**FOOD, "food_name": " "}),
    json.dumps({**FOOD, "ai_analysis": None}),
    json.dumps({**FOOD, "recommendations": "eat more"}),
    json.dumps(FOOD).replace('"calories": 500', '"calories": NaN'),
    json.dumps(FOOD).replace('"fiber": 5', '"fiber": Infinity'),
    json.dumps({**FOOD, "calories": 10**400}),
    json.dumps({**FOOD, "calories": 10001}),
    json.dumps({**FOOD, "macronutrients": {**FOOD["macronutrients"], "carb": 2001}}),
    json.dumps({**FOOD, "food_name": "가" * 101}),
    json.dumps({**FOOD, "ai_analysis": "가" * 2001}),
])
def test_malformed_vision_object_returns_safe_default(monkeypatch, api_settings, content):
    # Given: syntactically parseable JSON whose analysis fields are unusable.
    route(monkeypatch, lambda _: httpx.Response(200, json={
        "choices": [{"message": {"content": content}}],
    }))
    # When: image analysis validates the model object.
    result = anyio.run(rag_service.analyze_food_image, b"image", {})
    # Then: the complete zero-nutrition fallback is returned.
    assert result["food_name"] == "Unknown food"
    assert result["calories"] == 0
    assert result["macronutrients"] == dict.fromkeys(["protein", "fat", "carb", "fiber"], 0)
    assert result["recommendations"]


@pytest.mark.parametrize("calories", ["NaN", "Infinity", str(10**400)])
def test_non_finite_nutrition_through_upload_route_is_not_500(
    demo_app, monkeypatch, api_settings, calories,
):
    # Given: the real upload route and a hosted model answering with unusable calories.
    from app.routers import diet

    monkeypatch.setattr(diet.image_usage, "_counts", {})
    monkeypatch.setattr(rag_service, "get_optional_supabase", lambda: None)
    bad_food = json.dumps(FOOD).replace('"calories": 500', f'"calories": {calories}')
    route(monkeypatch, lambda _: httpx.Response(200, json={
        "choices": [{"message": {"content": bad_food}}],
    }))
    # When: the response is serialized by the real route.
    with TestClient(demo_app.app) as client:
        response = client.post("/api/v1/diet/analyze-image", files={
            "image": ("meal.png", b"\x89PNG\r\n\x1a\npayload", "image/png"),
        })
    # Then: the client receives the safe fallback instead of a server error.
    assert response.status_code == 200
    assert response.json()["food_name"] == "Unknown food"
    assert response.json()["calories"] == 0


def test_non_food_response_has_zero_nutrition(monkeypatch, api_settings):
    # Given: the model recognizes non-food but sends inconsistent nutrition.
    route(monkeypatch, lambda _: httpx.Response(200, json={"choices": [{"message": {
        "content": json.dumps({**FOOD, "food_name": "음식 아님"}),
    }}]}))
    # When: non-food JSON is parsed.
    result = anyio.run(rag_service.analyze_food_image, b"image", {})
    # Then: non-food is safe to display with zero nutrition.
    assert result["food_name"] == "음식 아님"
    assert result["calories"] == 0
    assert all(value == 0 for value in result["macronutrients"].values())


@pytest.mark.parametrize("response", [
    httpx.Response(429, json={"error": "test-secret-key"}),
    httpx.Response(200, json={"choices": []}),
])
def test_vision_api_failure_returns_safe_default(monkeypatch, api_settings, caplog, response):
    # Given: an upstream error or malformed completion.
    route(monkeypatch, lambda _: response)
    # When: the analysis adapter handles the failure.
    result = anyio.run(rag_service.analyze_food_image, b"image", {})
    # Then: the existing safe fallback is retained without leaking error bodies.
    assert result["calories"] == 0
    assert result["ai_analysis"] == rag_service.OLLAMA_UNAVAILABLE_MESSAGE
    assert "test-secret-key" not in caplog.text


def test_real_upload_route_passes_detected_mime(demo_app, monkeypatch, api_settings):
    # Given: the actual upload route with only external I/O replaced.
    from app.routers import diet

    monkeypatch.setattr(diet.image_usage, "_counts", {})
    requests = route(monkeypatch, lambda _: httpx.Response(200, json={
        "choices": [{"message": {"content": json.dumps(FOOD)}}],
    }))
    monkeypatch.setattr(rag_service, "get_optional_supabase", lambda: None)
    # When: a PNG reaches the real router and image analysis implementation.
    with TestClient(demo_app.app) as client:
        response = client.post("/api/v1/diet/analyze-image", files={
            "image": ("meal.png", b"\x89PNG\r\n\x1a\npayload", "image/png"),
        })
    # Then: no JPEG default is incorrectly used for the upstream request.
    assert response.status_code == 200
    body = json.loads(requests[0].content)
    assert body["messages"][0]["content"][1]["image_url"]["url"].startswith("data:image/png;base64,")
    assert response.json()["food_name"] == FOOD["food_name"]


@pytest.mark.parametrize("prefix", ["embed", "vision"])
@pytest.mark.parametrize("missing", ["base_url", "key", "model"])
def test_production_requires_hosted_provider_settings(prefix, missing):
    # Given: one missing required hosted-provider setting and no chat fallback.
    values = {
        f"{prefix}_provider": "openai_compatible",
        f"{prefix}_api_base_url": "https://llm.example/v1",
        f"{prefix}_api_key": "test-key",
        f"{prefix}_api_model": "test-model",
        "chat_api_base_url": "", "chat_api_key": "", "chat_provider": "ollama",
        f"{prefix}_api_{missing}": "",
    }
    # When: production configuration is validated.
    errors = Settings(_env_file=None, environment="production", **values).production_config_errors()
    # Then: the missing setting is a startup configuration error.
    assert f"{prefix.upper()}_API_{missing.upper()} is required when {prefix.upper()}_PROVIDER=openai_compatible" in errors


@pytest.mark.parametrize("prefix", ["embed", "vision"])
def test_production_accepts_chat_credentials_fallback(prefix):
    # Given: dedicated credentials are empty but chat credentials are configured.
    values = {
        f"{prefix}_provider": "openai_compatible", f"{prefix}_api_model": "test-model",
        f"{prefix}_api_base_url": "", f"{prefix}_api_key": "",
    }
    # When: production validation resolves the fallback.
    errors = Settings(
        _env_file=None, environment="production", chat_api_base_url="https://llm.example/v1",
        chat_api_key="test-key", chat_provider="ollama", **values,
    ).production_config_errors()
    # Then: no false missing-provider error is raised.
    assert not any(error.startswith(prefix.upper()) for error in errors)


@pytest.mark.parametrize("field,value", [
    ("rag_match_threshold", -0.1), ("rag_match_threshold", 1.1), ("embed_dimensions", 1536),
])
def test_settings_reject_schema_incompatible_values(field, value):
    # Given/When/Then: settings reject values that cannot satisfy retrieval's contract.
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{field: value})


@pytest.fixture
def embed_script(monkeypatch):
    import dotenv

    # Given: importing the CLI must not initialize Supabase or read real credentials.
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *_: None)
    for name, value in {
        "EMBED_PROVIDER": "openai_compatible", "EMBED_API_BASE_URL": "", "EMBED_API_KEY": "",
        "EMBED_API_MODEL": "openai/text-embedding-3-small", "EMBED_DIMENSIONS": "768",
        "CHAT_API_BASE_URL": "https://llm.example/v1/", "CHAT_API_KEY": "script-test-key",
        "SUPABASE_URL": "https://db.example", "SUPABASE_SERVICE_ROLE_KEY": "service-test-key",
    }.items():
        monkeypatch.setenv(name, value)
    path = Path(__file__).resolve().parents[3] / "infra/scripts/embed_rag.py"
    spec = importlib.util.spec_from_file_location("embed_rag_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("provider", ["openai_compatible", "ollama"])
def test_script_embedding_wire_contract(monkeypatch, embed_script, provider):
    # Given: the script's HTTP boundary records requests.
    calls = []
    monkeypatch.setattr(embed_script, "EMBED_PROVIDER", provider)

    def post(url, **kwargs):
        calls.append((url, kwargs))
        payload = {"data": [{"embedding": VECTOR}]} if provider == "openai_compatible" else {"embedding": VECTOR}
        return httpx.Response(200, json=payload, request=httpx.Request("POST", url))

    monkeypatch.setattr(embed_script.httpx, "post", post)
    # When: the script requests an embedding.
    assert embed_script.get_embedding("meal") == VECTOR
    # Then: each provider uses its real protocol.
    url, kwargs = calls[0]
    if provider == "openai_compatible":
        assert url == "https://llm.example/v1/embeddings"
        assert kwargs["json"] == {"model": "openai/text-embedding-3-small", "input": "meal", "dimensions": 768}
        assert kwargs["headers"]["Authorization"] == "Bearer script-test-key"
    else:
        assert url.endswith("/api/embeddings")
        assert kwargs["json"] == {"model": embed_script.EMBED_MODEL, "prompt": "meal"}


@pytest.mark.parametrize("force", [False, True])
def test_script_only_embeds_null_rows_unless_forced(monkeypatch, embed_script, force, capsys):
    # Given: a recording Supabase boundary and service-role credentials.
    filters, updates, clients = [], [], []

    class Query:
        def select(self, _):
            return self

        def is_(self, name, value):
            filters.append((name, value))
            return self

        def order(self, _):
            return self

        def range(self, start, end):
            assert (start, end) == (0, 999)
            return self

        def update(self, row):
            updates.append(row)
            return self

        def eq(self, name, value):
            assert (name, value) == ("id", "doc-id")
            return self

        def execute(self):
            return SimpleNamespace(data=[{"id": "doc-id", "content": "meal", "title": "meal"}])

    def create_client(url, key):
        clients.append((url, key))
        return SimpleNamespace(table=lambda _: Query())

    monkeypatch.setattr(embed_script, "create_client", create_client)
    monkeypatch.setattr(embed_script, "get_embedding", lambda _: VECTOR)
    # When: the CLI batch body runs without real I/O.
    embed_script.embed_documents(force=force)
    # Then: force controls only the NULL filter and writes use the service role.
    assert filters == ([] if force else [("embedding", "null")])
    assert updates == [{"embedding": VECTOR}]
    assert clients == [("https://db.example", "service-test-key")]
    output = capsys.readouterr().out
    assert "Completed: 1; failed: 0" in output
    assert "service-test-key" not in output
    assert "script-test-key" not in output
