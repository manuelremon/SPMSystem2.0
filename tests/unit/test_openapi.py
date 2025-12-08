"""
Tests para el modulo de documentacion OpenAPI.
Sprint 9.1 - Verifica generacion de especificacion y endpoints.
"""

import json

import pytest


class TestOpenAPISpec:
    """Tests para la especificacion OpenAPI."""

    def test_generate_spec_returns_dict(self):
        """generate_openapi_spec retorna diccionario."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert isinstance(spec, dict)

    def test_spec_has_openapi_version(self):
        """Especificacion incluye version OpenAPI."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "openapi" in spec
        assert spec["openapi"].startswith("3.0")

    def test_spec_has_info(self):
        """Especificacion incluye info basica."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "info" in spec
        assert "title" in spec["info"]
        assert "version" in spec["info"]
        assert "description" in spec["info"]

    def test_spec_has_servers(self):
        """Especificacion incluye servidores."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "servers" in spec
        assert len(spec["servers"]) > 0
        assert "url" in spec["servers"][0]

    def test_spec_has_tags(self):
        """Especificacion incluye tags."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "tags" in spec
        assert len(spec["tags"]) > 0

        # Verificar tags esperados
        tag_names = [t["name"] for t in spec["tags"]]
        assert "auth" in tag_names
        assert "solicitudes" in tag_names
        assert "mrp" in tag_names
        assert "ai" in tag_names

    def test_spec_has_paths(self):
        """Especificacion incluye paths."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "paths" in spec
        assert len(spec["paths"]) > 0

    def test_spec_has_auth_endpoint(self):
        """Especificacion incluye endpoint de login."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "/api/auth/login" in spec["paths"]
        assert "post" in spec["paths"]["/api/auth/login"]

    def test_spec_has_solicitudes_endpoints(self):
        """Especificacion incluye endpoints de solicitudes."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "/api/solicitudes" in spec["paths"]
        assert "/api/solicitudes/{id}" in spec["paths"]

    def test_spec_has_mrp_endpoints(self):
        """Especificacion incluye endpoints MRP."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "/api/mrp/alertas" in spec["paths"]
        assert "/api/mrp/kpis" in spec["paths"]

    def test_spec_has_ai_endpoints(self):
        """Especificacion incluye endpoints AI."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "/api/ai/status" in spec["paths"]
        assert "/api/ai/train" in spec["paths"]
        assert "/api/ai/sugerir-accion" in spec["paths"]

    def test_spec_has_sla_endpoints(self):
        """Especificacion incluye endpoints SLA."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "/api/sla/metricas" in spec["paths"]
        assert "/api/sla/alertas" in spec["paths"]

    def test_spec_has_export_endpoints(self):
        """Especificacion incluye endpoints export."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "/api/export/solicitudes" in spec["paths"]
        assert "/api/export/formatos" in spec["paths"]

    def test_spec_has_health_endpoint(self):
        """Especificacion incluye health check."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "/api/health" in spec["paths"]

    def test_spec_has_components(self):
        """Especificacion incluye componentes."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        assert "components" in spec
        assert "schemas" in spec["components"]
        assert "securitySchemes" in spec["components"]

    def test_spec_has_bearer_auth(self):
        """Especificacion incluye autenticacion Bearer."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        security = spec["components"]["securitySchemes"]
        assert "bearerAuth" in security
        assert security["bearerAuth"]["type"] == "http"
        assert security["bearerAuth"]["scheme"] == "bearer"

    def test_spec_has_error_schema(self):
        """Especificacion incluye schema de error."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        schemas = spec["components"]["schemas"]
        assert "ErrorResponse" in schemas

    def test_spec_has_user_schema(self):
        """Especificacion incluye schema de usuario."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        schemas = spec["components"]["schemas"]
        assert "User" in schemas
        assert "LoginRequest" in schemas
        assert "LoginResponse" in schemas

    def test_spec_has_solicitud_schemas(self):
        """Especificacion incluye schemas de solicitud."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        schemas = spec["components"]["schemas"]
        assert "Solicitud" in schemas
        assert "SolicitudCreate" in schemas
        assert "SolicitudItem" in schemas

    def test_spec_has_common_parameters(self):
        """Especificacion incluye parametros comunes."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        params = spec["components"]["parameters"]
        assert "idParam" in params
        assert "pageParam" in params
        assert "limitParam" in params

    def test_spec_has_common_responses(self):
        """Especificacion incluye respuestas comunes."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        responses = spec["components"]["responses"]
        assert "Unauthorized" in responses
        assert "Forbidden" in responses
        assert "NotFound" in responses
        assert "BadRequest" in responses

    def test_spec_is_json_serializable(self):
        """Especificacion puede serializarse a JSON."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        json_str = json.dumps(spec)
        assert len(json_str) > 1000  # Debe ser un JSON significativo

    def test_endpoint_has_operation_id(self):
        """Endpoints tienen operationId."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        login_endpoint = spec["paths"]["/api/auth/login"]["post"]
        assert "operationId" in login_endpoint
        assert login_endpoint["operationId"] == "login"

    def test_endpoint_has_responses(self):
        """Endpoints tienen respuestas definidas."""
        try:
            from backend.core.openapi import generate_openapi_spec
        except ImportError:
            pytest.skip("Module not available")

        spec = generate_openapi_spec()
        login_endpoint = spec["paths"]["/api/auth/login"]["post"]
        assert "responses" in login_endpoint
        assert "200" in login_endpoint["responses"]


class TestAPIVersion:
    """Tests para version de API."""

    def test_api_version_defined(self):
        """Version de API esta definida."""
        try:
            from backend.core.openapi import API_VERSION
        except ImportError:
            pytest.skip("Module not available")

        assert API_VERSION is not None
        assert len(API_VERSION) > 0

    def test_api_version_format(self):
        """Version tiene formato semver."""
        try:
            from backend.core.openapi import API_VERSION
        except ImportError:
            pytest.skip("Module not available")

        parts = API_VERSION.split(".")
        assert len(parts) == 3
        assert all(p.isdigit() for p in parts)

    def test_api_title_defined(self):
        """Titulo de API esta definido."""
        try:
            from backend.core.openapi import API_TITLE
        except ImportError:
            pytest.skip("Module not available")

        assert API_TITLE is not None
        assert "SPM" in API_TITLE


class TestDocsEndpoints:
    """Tests para endpoints de documentacion."""

    @pytest.fixture
    def app(self):
        """Crea aplicacion de prueba."""
        try:
            from backend.app import create_app
        except ImportError:
            pytest.skip("App not available")

        app = create_app({"TESTING": True})
        return app

    @pytest.fixture
    def client(self, app):
        """Cliente de prueba."""
        return app.test_client()

    def test_swagger_ui_returns_html(self, client):
        """GET /api/docs retorna HTML."""
        response = client.get("/api/docs")
        assert response.status_code == 200
        assert b"swagger-ui" in response.data

    def test_openapi_json_returns_spec(self, client):
        """GET /api/docs/openapi retorna JSON."""
        response = client.get("/api/docs/openapi")
        assert response.status_code == 200
        assert response.content_type == "application/json"

        data = json.loads(response.data)
        assert "openapi" in data
        assert "paths" in data

    def test_redoc_returns_html(self, client):
        """GET /api/docs/redoc retorna HTML."""
        response = client.get("/api/docs/redoc")
        assert response.status_code == 200
        assert b"redoc" in response.data

    def test_api_info_endpoint(self, client):
        """GET /api/docs/info retorna info basica."""
        response = client.get("/api/docs/info")
        assert response.status_code == 200

        data = json.loads(response.data)
        assert data["ok"] is True
        assert "title" in data["data"]
        assert "version" in data["data"]
        assert "docs" in data["data"]
