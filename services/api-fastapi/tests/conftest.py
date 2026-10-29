"""Shared fixtures for the FitConnect core API tests.

The app reads ``.env`` through pydantic-settings, so ambient configuration can
silently disagree with what the suite needs (the checked-in ``.env`` disables the
demo fallback). Fixtures here pin the settings the tests assert on, and every
test that depends on a specific configuration asks for the matching fixture
instead of assuming the machine is set up a particular way.

Reloading note: modules bind their collaborators at import time -- routers do
``from app.config import settings`` and pull ``get_current_user`` from
``app.dependencies``, while ``app.database`` binds ``settings`` and caches the
Supabase client -- so reloading ``app.config`` alone leaves every one of them
holding the old objects. The fixtures reload ``app.config`` first, then
``app.database`` (fresh settings, client cache cleared) before
``app.dependencies`` and every router, and finish with ``main``. Order matters:
each module must be rebuilt after the ones it imports from.
"""

import importlib

import pytest

# Settings the app reads at import time.
_CONFIGURED_ENV = {
    "ENVIRONMENT": "test",
    "ENABLE_DEMO_FALLBACK": "true",
    "SUPABASE_URL": "",
    "SUPABASE_SERVICE_ROLE_KEY": "",
    "ADMIN_API_KEY": "",
}

_RELOAD_MODULES = (
    "app.dependencies",
    # This service also binds settings/database collaborators at import time.
    # Reload it before routers so strict fixtures cannot leak into demo tests.
    "app.services.clothing_service",
    "app.routers.coaches",
    "app.routers.bookings",
    "app.routers.diet",
    "app.routers.clothing",
    "app.routers.admin",
)


def _reload_app():
    """Rebuild the app from the process environment the caller has pinned.

    Environment pinning is the caller's job (``monkeypatch.setenv``); this helper
    only re-imports the modules whose import-time globals must be rebuilt.
    """
    import app.config as config_module

    importlib.reload(config_module)

    # `app.database` binds `settings` at import time and caches the Supabase
    # client, so it must be rebuilt from the fresh config -- and before
    # `app.dependencies` and the routers, which import from it -- or a client
    # built from ambient `.env` credentials would keep serving the demo tests.
    import app.database as database_module

    importlib.reload(database_module)
    database_module._supabase_client = None

    for module_name in _RELOAD_MODULES:
        importlib.reload(importlib.import_module(module_name))

    import main

    importlib.reload(main)
    return main


@pytest.fixture
def demo_app(monkeypatch: pytest.MonkeyPatch):
    """The app in demo-fallback mode: no Supabase, demo data served."""
    for key, value in _CONFIGURED_ENV.items():
        monkeypatch.setenv(key, value)
    return _reload_app()


@pytest.fixture
def strict_app(monkeypatch: pytest.MonkeyPatch):
    """The app with the demo fallback off: endpoints must fail closed."""
    values = dict(_CONFIGURED_ENV, ENABLE_DEMO_FALLBACK="false")
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    return _reload_app()
