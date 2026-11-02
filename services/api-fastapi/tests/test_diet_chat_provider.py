import asyncio
import json

import httpx
import pytest

from app.config import Settings
from app.services import rag_service


MESSAGES = [{"role": "user", "content": "lunch"}]


@pytest.fixture
def chat_settings(monkeypatch):
    values = {
        "chat_provider": "openai_compatible",
        "chat_api_base_url": "https://llm.example/v1/",
        "chat_api_key": "test-key",
        "chat_api_model": "cheap-model",
    }
    for name, value in values.items():
        monkeypatch.setattr(rag_service.settings, name, value)


def _route(monkeypatch, handler):
    real_client = httpx.AsyncClient
    requests = []

    def recording(request):
        requests.append(request)
        return handler(request)

    monkeypatch.setattr(
        rag_service.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(recording), **kwargs),
    )
    return requests


def test_openai_compatible_provider_sends_chat_completion(monkeypatch, chat_settings):
    requests = _route(
        monkeypatch,
        lambda _: httpx.Response(200, json={"choices": [{"message": {"content": "eat rice"}}]}),
    )

    assert asyncio.run(rag_service._chat(MESSAGES)) == "eat rice"
    assert len(requests) == 1
    request = requests[0]
    assert str(request.url) == "https://llm.example/v1/chat/completions"
    assert request.headers["Authorization"] == "Bearer test-key"
    body = json.loads(request.content)
    assert body["model"] == "cheap-model"
    assert body["messages"] == MESSAGES


def test_unconfigured_provider_returns_fallback_without_request(monkeypatch, chat_settings):
    monkeypatch.setattr(rag_service.settings, "chat_api_key", "")
    requests = _route(monkeypatch, lambda _: httpx.Response(500))

    assert asyncio.run(rag_service._chat(MESSAGES)) == rag_service.OLLAMA_UNAVAILABLE_MESSAGE
    assert requests == []


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(429, json={"error": "rate limit"}),
        httpx.Response(200, json={"choices": [{"message": {"content": "  "}}]}),
        httpx.Response(200, json={"unexpected": True}),
    ],
)
def test_provider_failures_return_fallback(monkeypatch, chat_settings, response):
    _route(monkeypatch, lambda _: response)

    assert asyncio.run(rag_service._chat(MESSAGES)) == rag_service.OLLAMA_UNAVAILABLE_MESSAGE


def test_default_provider_still_uses_ollama(monkeypatch):
    monkeypatch.setattr(rag_service.settings, "chat_provider", "ollama")
    requests = _route(
        monkeypatch, lambda _: httpx.Response(200, json={"message": {"content": "local"}})
    )

    assert asyncio.run(rag_service._chat(MESSAGES)) == "local"
    assert requests[0].url.path == "/api/chat"


def test_production_requires_chat_api_settings():
    settings = Settings(
        _env_file=None,
        environment="production",
        chat_provider="openai_compatible",
        chat_api_base_url="https://llm.example/v1",
        chat_api_key="",
        chat_api_model="cheap-model",
    )

    assert "CHAT_API_KEY is required when CHAT_PROVIDER=openai_compatible" in (
        settings.production_config_errors()
    )
