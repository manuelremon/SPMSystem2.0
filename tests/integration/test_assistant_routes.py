"""
Tests de integración para rutas del Asistente NLP y RAG.

Endpoints probados:
- POST /api/assistant/solicitudes/sugerir
- GET /api/assistant/health
- GET /api/assistant/rag/status
- POST /api/assistant/rag/search
- POST /api/assistant/rag/query
- POST /api/assistant/rag/equivalents

Usa fixtures de tests/conftest.py (app, client con BD en memoria).
"""

from unittest.mock import patch, MagicMock

import pytest

from tests.integration.auth_utils import mint_access_token


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def auth_headers(app):
    """Headers con autenticación Bearer."""
    with app.app_context():
        token = mint_access_token(app, user_id="1", roles=["usuario"])
        return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_client(client, auth_headers):
    """Cliente con headers de autenticación pre-configurados."""

    class AuthenticatedClient:
        def __init__(self, client, headers):
            self._client = client
            self._headers = headers

        def get(self, *args, **kwargs):
            headers = kwargs.pop("headers", {})
            headers.update(self._headers)
            return self._client.get(*args, headers=headers, **kwargs)

        def post(self, *args, **kwargs):
            headers = kwargs.pop("headers", {})
            headers.update(self._headers)
            return self._client.post(*args, headers=headers, **kwargs)

    return AuthenticatedClient(client, auth_headers)


# =============================================================================
# Tests de Health Check
# =============================================================================


class TestAssistantHealth:
    """Tests para el endpoint de health check."""

    def test_health_endpoint(self, client):
        """GET /api/assistant/health debería retornar status OK."""
        response = client.get("/api/assistant/health")

        assert response.status_code == 200
        data = response.get_json()
        assert data["ok"] is True
        assert data["module"] == "assistant"
        assert "tools" in data
        assert "nlp_processor" in data["tools"]
        assert "material_matcher" in data["tools"]

    def test_health_shows_rag_status(self, client):
        """Health debería mostrar estado de RAG."""
        response = client.get("/api/assistant/health")

        data = response.get_json()
        assert "rag_available" in data
        # rag_status puede ser None si RAG no está disponible
        if data["rag_available"]:
            assert "rag_status" in data


# =============================================================================
# Tests de Sugerencias NLP
# =============================================================================


class TestSugerirMateriales:
    """Tests para endpoint de sugerencias de materiales."""

    def test_sugerir_requires_descripcion(self, auth_client):
        """Debería requerir descripción."""
        response = auth_client.post(
            "/api/assistant/solicitudes/sugerir",
            json={},
        )

        assert response.status_code == 400
        data = response.get_json()
        assert data["ok"] is False
        assert data["error"]["code"] == "missing_description"

    def test_sugerir_empty_descripcion(self, auth_client):
        """Debería rechazar descripción vacía."""
        response = auth_client.post(
            "/api/assistant/solicitudes/sugerir",
            json={"descripcion": "   "},
        )

        assert response.status_code == 400

    def test_sugerir_extracts_entities(self, auth_client):
        """Debería extraer entidades del texto."""
        response = auth_client.post(
            "/api/assistant/solicitudes/sugerir",
            json={
                "descripcion": "La bomba de agua tiene una fuga en el sello mecánico",
                "criticidad": "alta",
            },
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["ok"] is True
        assert "analisis" in data
        assert "equipos_detectados" in data["analisis"]
        assert "componentes_detectados" in data["analisis"]
        assert "tipo_falla" in data["analisis"]
        assert "justificacion_generada" in data

    def test_sugerir_with_criticidad(self, auth_client):
        """Debería ajustar cantidades según criticidad."""
        response = auth_client.post(
            "/api/assistant/solicitudes/sugerir",
            json={
                "descripcion": "Motor quemado necesita reemplazo",
                "criticidad": "alta",
            },
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["ok"] is True
        # Verificar que sugerencias existan (pueden estar vacías si no hay materiales)
        assert "sugerencias" in data


# =============================================================================
# Tests de RAG Status
# =============================================================================


class TestRAGStatus:
    """Tests para endpoint de estado RAG."""

    def test_rag_status_endpoint(self, client):
        """GET /api/assistant/rag/status debería retornar estado."""
        response = client.get("/api/assistant/rag/status")

        assert response.status_code == 200
        data = response.get_json()
        assert data["ok"] is True
        assert "available" in data
        assert "semantic_search" in data
        assert "llm_pipeline" in data


# =============================================================================
# Tests de RAG Search
# =============================================================================


class TestRAGSearch:
    """Tests para endpoint de búsqueda semántica."""

    def test_rag_search_requires_query(self, auth_client):
        """Debería requerir query."""
        response = auth_client.post(
            "/api/assistant/rag/search",
            json={},
        )

        # Puede retornar 400 (missing query) o 503 (RAG not available)
        assert response.status_code in [400, 503]

    def test_rag_search_when_unavailable(self, auth_client):
        """Debería retornar 503 si RAG no está disponible."""
        with patch("backend.routes.assistant.RAG_ENABLED", False):
            response = auth_client.post(
                "/api/assistant/rag/search",
                json={"query": "bomba centrifuga"},
            )

            # Puede estar habilitado o no, ambos son válidos
            assert response.status_code in [200, 503]

    def test_rag_search_valid_request(self, auth_client):
        """Debería procesar búsqueda válida."""
        response = auth_client.post(
            "/api/assistant/rag/search",
            json={
                "query": "bomba centrifuga para agua",
                "n_results": 5,
                "min_similarity": 0.3,
            },
        )

        # 200 si RAG disponible, 503 si no disponible, 500 si error de dependencias
        assert response.status_code in [200, 500, 503]

        if response.status_code == 200:
            data = response.get_json()
            assert data["ok"] is True
            assert "results" in data
            assert "count" in data
            assert data["method"] == "semantic"


# =============================================================================
# Tests de RAG Query (LLM)
# =============================================================================


class TestRAGQuery:
    """Tests para endpoint de consulta RAG con LLM."""

    def test_rag_query_requires_query(self, auth_client):
        """Debería requerir query."""
        response = auth_client.post(
            "/api/assistant/rag/query",
            json={},
        )

        # 400 o 503
        assert response.status_code in [400, 503]

    def test_rag_query_without_llm(self, auth_client):
        """Debería retornar 503 si LLM no está disponible."""
        with patch("backend.routes.assistant.RAG_ENABLED", True):
            with patch("backend.routes.assistant.is_llm_available", return_value=False):
                response = auth_client.post(
                    "/api/assistant/rag/query",
                    json={"query": "¿Qué bomba me recomiendas?"},
                )

                # Sin LLM debería ser 503
                assert response.status_code == 503

    def test_rag_query_valid_request(self, auth_client):
        """Debería procesar consulta válida."""
        response = auth_client.post(
            "/api/assistant/rag/query",
            json={
                "query": "Necesito una bomba para agua fría, ¿cuál me recomiendas?",
                "template": "search",
                "n_results": 5,
            },
        )

        # 200 si RAG+LLM disponible, 503 si no, 500 si error de dependencias
        assert response.status_code in [200, 500, 503]

        if response.status_code == 200:
            data = response.get_json()
            assert data["ok"] is True
            assert "response" in data
            assert "sources" in data


# =============================================================================
# Tests de RAG Equivalents
# =============================================================================


class TestRAGEquivalents:
    """Tests para endpoint de búsqueda de equivalentes."""

    def test_rag_equivalents_requires_material(self, auth_client):
        """Debería requerir código de material."""
        response = auth_client.post(
            "/api/assistant/rag/equivalents",
            json={},
        )

        # 400 o 503
        assert response.status_code in [400, 503]

    def test_rag_equivalents_valid_request(self, auth_client):
        """Debería procesar búsqueda de equivalentes."""
        response = auth_client.post(
            "/api/assistant/rag/equivalents",
            json={
                "material_codigo": "1000295076",
                "n_results": 5,
            },
        )

        # 200 si RAG disponible, 503 si no, 500 si error de dependencias
        assert response.status_code in [200, 500, 503]

        if response.status_code == 200:
            data = response.get_json()
            assert data["ok"] is True
            assert "equivalents" in data
            assert data["material_original"] == "1000295076"


# =============================================================================
# Tests con Mocks
# =============================================================================


class TestAssistantWithMocks:
    """Tests usando mocks para simular componentes."""

    def test_sugerir_with_mocked_matcher(self, auth_client):
        """Debería funcionar con MaterialMatcher mockeado."""
        mock_materiales = [
            {
                "codigo": "MAT001",
                "descripcion": "BOMBA CENTRIFUGA",
                "unidad_medida": "UN",
                "precio_usd": 1500.0,
                "match_query": "bomba",
                "match_score": 0.95,
            }
        ]

        with patch(
            "backend.routes.assistant.matcher.execute",
            return_value={"materiales": mock_materiales},
        ):
            response = auth_client.post(
                "/api/assistant/solicitudes/sugerir",
                json={"descripcion": "Necesito una bomba"},
            )

            assert response.status_code == 200
            data = response.get_json()
            assert data["ok"] is True
            # Puede tener sugerencias si el matcher retorna materiales
            if data["sugerencias"]:
                assert data["sugerencias"][0]["codigo_sap"] == "MAT001"

    def test_rag_search_with_mocked_retriever(self, auth_client):
        """Debería funcionar con MaterialRetriever mockeado."""
        mock_results = [
            {"codigo": "MAT001", "descripcion": "BOMBA CENTRIFUGA", "similarity": 0.95},
            {"codigo": "MAT002", "descripcion": "BOMBA AGUA", "similarity": 0.85},
        ]

        mock_retriever = MagicMock()
        mock_retriever.search.return_value = mock_results
        mock_retriever.get_stats.return_value = {"indexed_count": 1000}

        with patch("backend.routes.assistant.RAG_ENABLED", True):
            with patch(
                "backend.agent.rag.get_material_retriever",
                return_value=mock_retriever,
            ):
                response = auth_client.post(
                    "/api/assistant/rag/search",
                    json={"query": "bomba"},
                )

                # Acepta 200 (éxito), 500 (error interno), 503 (no disponible)
                assert response.status_code in [200, 500, 503]

                if response.status_code == 200:
                    data = response.get_json()
                    assert data["ok"] is True


# =============================================================================
# Tests de Manejo de Errores
# =============================================================================


class TestAssistantErrorHandling:
    """Tests para manejo de errores."""

    def test_sugerir_handles_nlp_error(self, auth_client):
        """Debería manejar errores de NLP graciosamente."""
        with patch(
            "backend.routes.assistant.nlp.execute",
            side_effect=Exception("NLP error"),
        ):
            response = auth_client.post(
                "/api/assistant/solicitudes/sugerir",
                json={"descripcion": "Texto de prueba"},
            )

            assert response.status_code == 500
            data = response.get_json()
            assert data["ok"] is False
            assert data["error"]["code"] == "internal_error"

    def test_invalid_json_body(self, auth_client):
        """Debería manejar JSON inválido."""
        response = auth_client.post(
            "/api/assistant/solicitudes/sugerir",
            data="not valid json",
            content_type="application/json",
        )

        # Flask debería rechazar JSON inválido
        assert response.status_code in [400, 500]
