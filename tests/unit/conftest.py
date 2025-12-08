"""
Fixtures compartidos para tests unitarios.
"""

from __future__ import annotations

import importlib
from pathlib import Path

import pytest


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    """Crea aplicacion Flask para testing."""
    monkeypatch.setenv("SPM_DEBUG", "1")
    monkeypatch.setenv("SPM_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("SPM_ENV", "test")
    db_path = tmp_path / "spm-test.db"
    monkeypatch.setenv("SPM_DB_PATH", str(db_path))

    try:
        import backend.app as app_module
        import backend.core.config as config_module
    except ImportError:
        pytest.skip("Backend module not importable in this context")

    importlib.reload(config_module)
    importlib.reload(app_module)

    flask_app = app_module.create_app({"TESTING": True})
    yield flask_app


@pytest.fixture
def client(app):
    """Cliente de testing Flask."""
    with app.test_client() as testing_client:
        yield testing_client


@pytest.fixture
def app_context(app):
    """Contexto de aplicacion Flask."""
    with app.app_context():
        yield app
