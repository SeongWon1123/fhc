"""Shared fixtures for the FitConnect core API tests.

The app reads ``.env`` through pydantic-settings, so ambient configuration can
silently disagree with what the suite needs (the checked-in ``.env`` disables the
demo fallback). Fixtures here pin the settings the tests assert on, and every
test that depends on a specific configuration asks for the matching fixture
instead of assuming the machine is set up a particular way.

Reloading note: routers do ``from app.config import settings`` and pull
``get_current_user`` from ``app.dependencies`` at import time, so reloading
``app.config`` alone leaves every router holding the old objects. The fixtures
reload ``app.config`` and ``app.dependencies`` first, then every router module,
then ``main`` -- each reload rebinds the router globals to freshly built
settings.
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

_ROUTER_MODULES = (
    "app.dependencies",
    "app.routers.coaches",
    "app.routers.bookings",
    "app.routers.diet",
    "app.routers.clothing",
    "app.routers.admin",
)


def _reload_app(values: dict[str, str]):
    """Rebuild the app with `values` forced into the process environment."""
    import app.config as config_module

    importlib.reload(config_module)

    for module_name in _ROUTER_MODULES:
        importlib.reload(importlib.import_module(module_name))

    import main

    importlib.reload(main)
    return main


@pytest.fixture
def demo_app(monkeypatch: pytest.MonkeyPatch):
    """The app in demo-fallback mode: no Supabase, demo data served."""
    for key, value in _CONFIGURED_ENV.items():
        monkeypatch.setenv(key, value)
    return _reload_app(_CONFIGURED_ENV)


@pytest.fixture
def strict_app(monkeypatch: pytest.MonkeyPatch):
    """The app with the demo fallback off: endpoints must fail closed."""
    values = dict(_CONFIGURED_ENV, ENABLE_DEMO_FALLBACK="false")
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    return _reload_app(values)
