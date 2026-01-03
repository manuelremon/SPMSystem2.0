from __future__ import annotations

import importlib
from pathlib import Path

import pytest


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    """Create a test Flask app with temporary database."""
    monkeypatch.setenv("SPM_DEBUG", "1")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-key-for-testing-only")
    db_path = tmp_path / "spm-test.db"
    monkeypatch.setenv("SPM_DB_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")

    import backend.core.config as config_module
    import backend.app as app_module

    importlib.reload(config_module)
    importlib.reload(app_module)

    flask_app = app_module.create_app()
    flask_app.config["TESTING"] = True
    flask_app.config["WTF_CSRF_ENABLED"] = False
    yield flask_app


@pytest.fixture
def client(app):
    """Create a test client for the Flask app."""
    with app.test_client() as testing_client:
        yield testing_client
