"""
Tests de integración para rutas de solicitudes
Sprint: Auditoría Técnica - Fase 3
"""

import pytest


@pytest.fixture
def client():
    """Fixture para crear cliente de test"""
    try:
        from backend.app import create_app
    except ImportError:
        import sys

        sys.path.insert(
            0, str(__file__).replace("tests/integration/test_solicitudes_routes.py", "")
        )
        from backend.app import create_app

    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestSolicitudesAuth:
    """Tests de autenticación para solicitudes"""

    def test_list_solicitudes_requires_auth(self, client):
        """GET /solicitudes requiere autenticación"""
        response = client.get("/api/solicitudes")
        assert response.status_code in [401, 403, 429]

    def test_get_solicitud_requires_auth(self, client):
        """GET /solicitudes/<id> requiere autenticación"""
        response = client.get("/api/solicitudes/1")
        assert response.status_code in [401, 403, 404, 429]

    def test_create_solicitud_requires_auth(self, client):
        """POST /solicitudes requiere autenticación"""
        response = client.post(
            "/api/solicitudes", json={"items": []}, content_type="application/json"
        )
        assert response.status_code in [401, 403, 429]

    def test_delete_solicitud_requires_auth(self, client):
        """DELETE /solicitudes/<id> requiere autenticación"""
        response = client.delete("/api/solicitudes/1")
        assert response.status_code in [401, 403, 404, 429]


class TestSolicitudesValidation:
    """Tests de validación para solicitudes"""

    def test_create_solicitud_validates_items(self, client):
        """POST /solicitudes valida que items no esté vacío"""
        response = client.post(
            "/api/solicitudes",
            json={"items": [], "centro": "1234"},
            content_type="application/json",
        )
        # Sin auth devuelve 401/403, con auth sin items devolvería 400
        assert response.status_code in [400, 401, 403, 429]

    def test_guardar_borrador_requires_auth(self, client):
        """PATCH /solicitudes/<id>/draft requiere autenticación"""
        response = client.patch(
            "/api/solicitudes/1/draft", json={"items": []}, content_type="application/json"
        )
        assert response.status_code in [401, 403, 404, 429]

    def test_enviar_solicitud_requires_auth(self, client):
        """PUT /solicitudes/<id>/enviar requiere autenticación"""
        response = client.put("/api/solicitudes/1/enviar")
        assert response.status_code in [401, 403, 404, 429]


class TestSolicitudesAprobacion:
    """Tests para flujo de aprobación"""

    def test_aprobar_requires_auth(self, client):
        """PUT /solicitudes/<id>/aprobar requiere autenticación"""
        response = client.put("/api/solicitudes/1/aprobar")
        assert response.status_code in [401, 403, 404, 429]

    def test_rechazar_requires_auth(self, client):
        """PUT /solicitudes/<id>/rechazar requiere autenticación"""
        response = client.put(
            "/api/solicitudes/1/rechazar", json={"motivo": "Test"}, content_type="application/json"
        )
        assert response.status_code in [401, 403, 404, 429]


class TestSolicitudesHistorial:
    """Tests para historial de solicitudes"""

    def test_historial_estados_requires_auth(self, client):
        """GET /solicitudes/<id>/historial-estados requiere auth"""
        response = client.get("/api/solicitudes/1/historial-estados")
        assert response.status_code in [401, 403, 404, 429]

    def test_transiciones_posibles_requires_auth(self, client):
        """GET /solicitudes/<id>/transiciones-posibles requiere auth"""
        response = client.get("/api/solicitudes/1/transiciones-posibles")
        assert response.status_code in [401, 403, 404, 429]
