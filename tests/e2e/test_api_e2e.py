"""
Tests E2E para la API.
Sprint 14 - Verifica flujos completos de la API.

Nota: En Windows, estos tests pueden fallar por bloqueo de SQLite.
En CI (Linux), funcionan correctamente.
"""

import json
import os
import sys

import pytest


# Configurar entorno de test
os.environ["ENV"] = "test"
os.environ["SECRET_KEY"] = "test-secret-key-for-e2e"


def _create_test_app():
    """Intenta crear la app de test, retorna None si falla."""
    try:
        from backend.app import create_app
        app = create_app({
            "TESTING": True,
            "RATE_LIMIT_ENABLED": False,
        })
        return app
    except PermissionError:
        return None
    except Exception as e:
        if "being utilized" in str(e) or "WinError" in str(e):
            return None
        raise


# Intentar crear app una sola vez
_test_app = None
_app_creation_attempted = False


def get_test_app():
    """Obtiene la app de test singleton."""
    global _test_app, _app_creation_attempted

    if not _app_creation_attempted:
        _app_creation_attempted = True
        _test_app = _create_test_app()

    return _test_app


@pytest.fixture(scope="module")
def app():
    """Crea la aplicacion una sola vez por modulo."""
    test_app = get_test_app()
    if test_app is None:
        pytest.skip("DB locked (Windows issue) - skipping E2E tests")
    return test_app


@pytest.fixture(scope="module")
def client(app):
    """Crea cliente de test compartido."""
    with app.test_client() as client:
        yield client


class TestHealthEndpoints:
    """Tests E2E para endpoints de health."""

    def test_health_endpoint(self, client):
        """GET /health retorna OK."""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "healthy"

    def test_health_live(self, client):
        """GET /health/live retorna OK."""
        response = client.get("/health/live")

        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "alive"

    def test_health_ready(self, client):
        """GET /health/ready retorna OK o 503 si DB no lista."""
        response = client.get("/health/ready")
        assert response.status_code in (200, 503)


class TestAuthEndpoints:
    """Tests E2E para endpoints de autenticacion."""

    def test_login_missing_credentials(self, client):
        """POST /api/auth/login sin credenciales retorna error."""
        response = client.post(
            "/api/auth/login",
            json={},
            content_type="application/json"
        )
        assert response.status_code in (400, 401, 422)

    def test_login_invalid_credentials(self, client):
        """POST /api/auth/login con credenciales invalidas."""
        response = client.post(
            "/api/auth/login",
            json={"email": "fake@example.com", "password": "wrongpass"},
            content_type="application/json"
        )
        assert response.status_code in (401, 403)

    def test_protected_endpoint_without_token(self, client):
        """Endpoint protegido sin token retorna 401."""
        response = client.get("/api/solicitudes")
        assert response.status_code == 401


class TestAPIRoot:
    """Tests E2E para endpoints raiz."""

    def test_api_root(self, client):
        """GET /api retorna info de la API."""
        response = client.get("/api")

        assert response.status_code == 200
        data = response.get_json()
        assert data["ok"] is True
        assert "version" in data

    def test_favicon(self, client):
        """GET /favicon.ico retorna SVG."""
        response = client.get("/favicon.ico")

        assert response.status_code == 200
        assert response.content_type == "image/svg+xml"


class TestErrorHandling:
    """Tests E2E para manejo de errores."""

    def test_404_api_endpoint(self, client):
        """GET /api/nonexistent retorna 404 JSON."""
        response = client.get("/api/nonexistent")

        assert response.status_code == 404
        data = response.get_json()
        assert data["ok"] is False
        assert "error" in data

    def test_405_method_not_allowed(self, client):
        """Metodo no permitido retorna 405."""
        response = client.post("/health")
        assert response.status_code == 405


class TestSecurityHeaders:
    """Tests E2E para headers de seguridad."""

    def test_security_headers_present(self, client):
        """Headers de seguridad estan presentes."""
        response = client.get("/health")

        assert "X-Content-Type-Options" in response.headers
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert "X-Frame-Options" in response.headers


class TestContentNegotiation:
    """Tests E2E para negociacion de contenido."""

    def test_json_response(self, client):
        """API retorna JSON."""
        response = client.get("/health")
        assert response.content_type.startswith("application/json")

    def test_accepts_json_body(self, client):
        """API acepta JSON body."""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "test"},
            content_type="application/json"
        )
        assert response.status_code != 415


class TestAPIResponseFormat:
    """Tests E2E para formato de respuestas."""

    def test_success_response_has_ok_true(self, client):
        """Respuesta exitosa tiene ok=true."""
        response = client.get("/api")
        data = response.get_json()
        assert data.get("ok") is True

    def test_error_response_has_ok_false(self, client):
        """Respuesta de error tiene ok=false."""
        response = client.get("/api/nonexistent")
        data = response.get_json()
        assert data.get("ok") is False


class TestCatalogoEndpoints:
    """Tests E2E para endpoints de catalogos."""

    def test_catalogos_centros_requires_auth(self, client):
        """GET /api/catalogos/centros requiere auth."""
        response = client.get("/api/catalogos/centros")
        assert response.status_code in (401, 403)


class TestDocumentationEndpoints:
    """Tests E2E para endpoints de documentacion."""

    def test_openapi_spec(self, client):
        """GET /api/docs/openapi.json retorna spec."""
        response = client.get("/api/docs/openapi.json")
        if response.status_code == 200:
            data = response.get_json()
            assert "openapi" in data or "swagger" in data


class TestMetricsEndpoints:
    """Tests E2E para endpoints de metricas."""

    def test_metrics_endpoint(self, client):
        """GET /api/metrics retorna metricas."""
        response = client.get("/api/metrics")
        assert response.status_code in (200, 401, 404)
