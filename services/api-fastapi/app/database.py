from typing import Any

import redis.asyncio as aioredis

from app.config import settings

try:
    from supabase import Client, create_client
except ImportError:  # pragma: no cover - dependency should exist in production image
    Client = Any
    create_client = None


_supabase_client: Client | None = None


def _is_placeholder(value: str) -> bool:
    return settings.is_placeholder(value)


def is_supabase_configured() -> bool:
    return not _is_placeholder(settings.supabase_url) and not _is_placeholder(
        settings.supabase_service_role_key
    )


def get_supabase() -> Client:
    global _supabase_client
    if create_client is None:
        raise RuntimeError("supabase package is not installed")
    if not is_supabase_configured():
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _supabase_client


def get_optional_supabase() -> Client | None:
    try:
        return get_supabase()
    except Exception:
        return None


def dependency_status() -> dict:
    configured = is_supabase_configured()
    return {
        "supabase": {
            "configured": configured,
            "client_loaded": _supabase_client is not None,
            "mode": "remote"
            if configured
            else "demo-fallback"
            if settings.demo_fallback_enabled
            else "unavailable",
        },
        "redis": {
            "configured": bool(settings.redis_url),
        },
        "demo_fallback": {
            "enabled": settings.demo_fallback_enabled,
        },
        "production": {
            "enabled": settings.is_production,
            "config_errors": settings.production_config_errors(),
        },
    }


async def get_redis():
    return aioredis.from_url(settings.redis_url, decode_responses=True)
