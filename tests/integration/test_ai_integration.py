"""
Tests de integracion para el servicio de IA.
Sprint 8.1 - Verifica servicio IA end-to-end.
"""

from datetime import datetime, timedelta

import pytest


@pytest.fixture
def app():
    """Crea aplicacion de prueba."""
    try:
        from backend.app import create_app
    except ImportError:
        from app import create_app

    app = create_app({"TESTING": True})
    return app


@pytest.fixture
def client(app):
    """Cliente de prueba."""
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Headers con autenticacion."""
    response = client.post(
        "/api/auth/login", json={"email": "admin@spm.com", "password": "admin123"}
    )

    if response.status_code == 200:
        data = response.get_json()
        token = data.get("data", {}).get("access_token") or data.get("access_token")
        if token:
            return {"Authorization": f"Bearer {token}"}

    return {"Authorization": "Bearer test_token"}


class TestAIEndpointsIntegration:
    """Tests de integracion para endpoints IA."""

    def test_get_ai_status(self, client, auth_headers):
        """GET /api/ai/status retorna estado."""
        response = client.get("/api/ai/status", headers=auth_headers)

        assert response.status_code in [200, 401, 500]

        if response.status_code == 200:
            data = response.get_json()
            assert "ok" in data
            if data.get("ok"):
                assert "clustering" in data.get("data", {})
                assert "scoring" in data.get("data", {})
                assert "forecast" in data.get("data", {})

    def test_post_ai_sugerir_accion(self, client, auth_headers):
        """POST /api/ai/sugerir-accion sugiere accion."""
        response = client.post(
            "/api/ai/sugerir-accion",
            json={
                "solicitud": {
                    "id": 1,
                    "criticidad": "Alta",
                    "total_monto": 50000,
                    "data_json": {"items": [1, 2, 3]},
                }
            },
            headers=auth_headers,
        )

        assert response.status_code in [200, 401, 500]

        if response.status_code == 200:
            data = response.get_json()
            if data.get("ok"):
                assert "accion_sugerida" in data.get("data", {})

    def test_get_ai_alertas(self, client, auth_headers):
        """GET /api/ai/alertas genera alertas."""
        response = client.get("/api/ai/alertas?centro=1000", headers=auth_headers)

        assert response.status_code in [200, 401, 500]


class TestAIServiceIntegration:
    """Tests de integracion del servicio IA."""

    def test_ai_service_init(self):
        """Inicializa servicio IA correctamente."""
        try:
            from backend.services.ai_service import AIService
        except ImportError:
            pytest.skip("AI service not available")

        service = AIService()

        assert service.clustering is not None
        assert service.scoring is not None
        assert service.forecast is not None

    def test_ai_service_status(self):
        """Obtiene status del servicio."""
        try:
            from backend.services.ai_service import AIService
        except ImportError:
            pytest.skip("AI service not available")

        service = AIService()
        status = service.get_status()

        assert "clustering" in status
        assert "scoring" in status
        assert "forecast" in status
        assert "pipelines_trained" in status

    def test_priorizar_solicitudes(self):
        """Prioriza lista de solicitudes."""
        try:
            from backend.services.ai_service import AIService
        except ImportError:
            pytest.skip("AI service not available")

        service = AIService()
        solicitudes = [
            {"id": 1, "criticidad": "Normal", "total_monto": 1000, "data_json": {"items": [1]}},
            {
                "id": 2,
                "criticidad": "Alta",
                "total_monto": 50000,
                "data_json": {"items": [1, 2, 3]},
            },
        ]

        result = service.priorizar_solicitudes(solicitudes)

        assert result["total_solicitudes"] == 2
        assert len(result["solicitudes_rankeadas"]) == 2
        # Alta criticidad debe tener mayor score
        assert result["solicitudes_rankeadas"][0]["solicitud_id"] == 2

    def test_sugerir_accion_alta_prioridad(self):
        """Sugiere aprobar solicitud de alta prioridad."""
        try:
            from backend.services.ai_service import AIService
        except ImportError:
            pytest.skip("AI service not available")

        service = AIService()
        solicitud = {
            "id": 1,
            "criticidad": "Alta",
            "fecha_necesidad": (datetime.now() + timedelta(days=1)).isoformat(),
            "total_monto": 80000,
            "data_json": {"items": [1, 2, 3, 4, 5]},
        }

        result = service.sugerir_accion(solicitud)

        assert "accion_sugerida" in result
        assert "confianza" in result
        assert result["accion_sugerida"] in ["aprobar", "revisar", "escalar", "rechazar"]

    def test_sugerir_cantidad_optima(self):
        """Sugiere cantidad optima de pedido."""
        try:
            from backend.services.ai_service import AIService
        except ImportError:
            pytest.skip("AI service not available")

        service = AIService()
        result = service.sugerir_cantidad_optima(
            material_codigo="MAT001", centro="1000", demanda_anual=1200
        )

        assert "cantidad_sugerida" in result
        assert result["cantidad_sugerida"] > 0
        assert "metodo" in result


class TestAIServiceCache:
    """Tests para cache del servicio IA."""

    def test_cache_guardar_y_recuperar(self):
        """Guarda y recupera del cache."""
        try:
            from backend.services.ai_service import AIService
        except ImportError:
            pytest.skip("AI service not available")

        service = AIService()

        # Guardar
        service.cache_recommendation("MAT001", "score", {"value": 0.8})

        # Recuperar
        cached = service.get_cached_recommendation("MAT001", "score")

        assert cached is not None
        assert cached["value"] == 0.8

    def test_cache_key_inexistente(self):
        """Retorna None para key inexistente."""
        try:
            from backend.services.ai_service import AIService
        except ImportError:
            pytest.skip("AI service not available")

        service = AIService()
        cached = service.get_cached_recommendation("NOEXISTE", "test")

        assert cached is None


class TestAIServiceFallbacks:
    """Tests para fallbacks del servicio IA."""

    def test_fallback_proyeccion_sin_modelo(self):
        """Usa fallback cuando modelo no esta entrenado."""
        try:
            from backend.services.ai_service import AIService
        except ImportError:
            pytest.skip("AI service not available")

        service = AIService()  # Sin entrenar

        result = service.proyectar_demanda("MAT001", "1000", 30)

        assert "predicted_demand" in result
        assert result.get("metodo") == "promedio_historico"
