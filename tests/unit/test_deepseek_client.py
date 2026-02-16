"""
Tests para DeepseekClient (Ollama/Deepseek-r1 local).

Cubre:
- Inicializacion y configuracion
- Comunicacion HTTP con Ollama (mocked)
- Metodo generate() con limpieza de tokens <think>
- Metodo generate_with_context() para RAG
- Metodo generate_chat() para historial
- Metodo generate_streaming()
- Health checks y status
- Manejo de errores (Ollama offline, modelo faltante)

Los tests usan mocks para no depender de Ollama corriendo.
Para tests de integracion real, ver la clase TestDeepseekIntegration.
"""

import json
import pytest
from unittest.mock import MagicMock, patch, mock_open
from io import BytesIO
from urllib.error import URLError


# ============================================================================
# Fixtures
# ============================================================================


def _mock_ollama_tags_response():
    """Simula respuesta de GET /api/tags de Ollama."""
    return {
        "models": [
            {"name": "deepseek-r1:latest", "size": 4700000000},
            {"name": "llama3:latest", "size": 3800000000},
        ]
    }


def _mock_generate_response(text="Respuesta de prueba"):
    """Simula respuesta de POST /api/generate de Ollama."""
    return {
        "model": "deepseek-r1:latest",
        "response": text,
        "done": True,
        "total_duration": 5000000000,
        "eval_count": 42,
    }


def _mock_chat_response(text="Respuesta chat de prueba"):
    """Simula respuesta de POST /api/chat de Ollama."""
    return {
        "model": "deepseek-r1:latest",
        "message": {"role": "assistant", "content": text},
        "done": True,
    }


# ============================================================================
# Tests de Inicializacion
# ============================================================================

class TestDeepseekClientInit:
    """Tests para la inicializacion del cliente."""

    @patch("backend.agent.rag.deepseek_client.urlopen")
    def test_init_default_config(self, mock_urlopen):
        """Debe usar valores por defecto si no hay env vars."""
        # Mock del health check
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(
            _mock_ollama_tags_response()
        ).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        from backend.agent.rag.deepseek_client import DeepseekClient

        client = DeepseekClient()

        assert client.provider == "deepseek"
        assert client.model_name == "deepseek-r1:latest"
        assert client._base_url == "http://localhost:11434"

    def test_init_custom_config(self):
        """Debe aceptar configuracion personalizada."""
        from backend.agent.rag.deepseek_client import DeepseekClient

        client = DeepseekClient(
            base_url="http://192.168.1.100:11434",
            model="deepseek-r1:7b",
            timeout=60,
            verify_on_init=False,  # No verificar para test
        )

        assert client._base_url == "http://192.168.1.100:11434"
        assert client.model_name == "deepseek-r1:7b"
        assert client._timeout == 60

    @patch.dict("os.environ", {
        "OLLAMA_BASE_URL": "http://gpu-server:11434",
        "DEEPSEEK_MODEL": "deepseek-r1:14b",
    })
    def test_init_from_env_vars(self):
        """Debe leer configuracion de variables de entorno."""
        from backend.agent.rag.deepseek_client import DeepseekClient

        client = DeepseekClient(verify_on_init=False)

        assert client._base_url == "http://gpu-server:11434"
        assert client.model_name == "deepseek-r1:14b"

    def test_init_strips_trailing_slash(self):
        """Debe limpiar trailing slash de la URL."""
        from backend.agent.rag.deepseek_client import DeepseekClient

        client = DeepseekClient(
            base_url="http://localhost:11434/",
            verify_on_init=False,
        )
        assert client._base_url == "http://localhost:11434"


# ============================================================================
# Tests de Generacion
# ============================================================================

class TestDeepseekGenerate:
    """Tests para los metodos de generacion."""

    def _make_client(self):
        """Helper para crear cliente sin verificacion."""
        from backend.agent.rag.deepseek_client import DeepseekClient
        return DeepseekClient(verify_on_init=False)

    @patch("backend.agent.rag.deepseek_client.urlopen")
    def test_generate_basic(self, mock_urlopen):
        """generate() debe retornar texto limpio."""
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(
            _mock_generate_response("Esta es la respuesta.")
        ).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        client = self._make_client()
        result = client.generate("Hola, que materiales hay?")

        assert result == "Esta es la respuesta."
        assert mock_urlopen.called

    @patch("backend.agent.rag.deepseek_client.urlopen")
    def test_generate_strips_thinking_tokens(self, mock_urlopen):
        """generate() debe remover tokens <think> por defecto."""
        raw = (
            "<think>Voy a analizar los materiales disponibles "
            "para bombas centrifugas...</think>"
            "Los materiales disponibles para bombas son: X, Y, Z."
        )
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(
            _mock_generate_response(raw)
        ).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        client = self._make_client()
        result = client.generate("Materiales para bombas")

        assert "<think>" not in result
        assert "Los materiales disponibles" in result

    @patch("backend.agent.rag.deepseek_client.urlopen")
    def test_generate_keeps_thinking_when_requested(self, mock_urlopen):
        """generate(include_thinking=True) debe mantener tokens <think>."""
        raw = "<think>Pensando...</think>Respuesta final."
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(
            _mock_generate_response(raw)
        ).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        client = self._make_client()
        result = client.generate("Test", include_thinking=True)

        assert "<think>" in result
        assert "Pensando..." in result

    @patch("backend.agent.rag.deepseek_client.urlopen")
    def test_generate_sends_correct_payload(self, mock_urlopen):
        """generate() debe enviar el payload correcto a Ollama."""
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(
            _mock_generate_response()
        ).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        client = self._make_client()
        client.generate(
            prompt="Test prompt",
            system_prompt="Eres un experto en SAP",
            max_tokens=512,
            temperature=0.3,
        )

        # Verificar que se llamo urlopen con los datos correctos
        call_args = mock_urlopen.call_args
        request_obj = call_args[0][0]
        sent_data = json.loads(request_obj.data.decode())

        assert sent_data["model"] == "deepseek-r1:latest"
        assert sent_data["prompt"] == "Test prompt"
        assert sent_data["system"] == "Eres un experto en SAP"
        assert sent_data["stream"] is False
        assert sent_data["options"]["temperature"] == 0.3
        assert sent_data["options"]["num_predict"] == 512


# ============================================================================
# Tests de RAG (generate_with_context)
# ============================================================================

class TestDeepseekRAG:
    """Tests para generate_with_context (RAG)."""

    def _make_client(self):
        from backend.agent.rag.deepseek_client import DeepseekClient
        return DeepseekClient(verify_on_init=False)

    @patch("backend.agent.rag.deepseek_client.urlopen")
    def test_generate_with_context_formats_materials(self, mock_urlopen):
        """Debe formatear materiales y enviarlos como contexto."""
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(
            _mock_generate_response("La bomba KSB es ideal para agua fria.")
        ).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        context = [
            {
                "codigo": "MAT-001234",
                "descripcion": "BOMBA CENTRIFUGA KSB 4X3",
                "similarity": 0.92,
                "stock": 5,
                "precio": 15000,
            },
            {
                "codigo": "MAT-005678",
                "descripcion": "SELLO MECANICO PARA BOMBA KSB",
                "similarity": 0.78,
                "stock": 12,
                "precio": 800,
            },
        ]

        client = self._make_client()
        result = client.generate_with_context(
            query="Que bomba me recomendas para agua fria?",
            context=context,
        )

        assert "KSB" in result

        # Verificar que el prompt incluyo los materiales
        call_args = mock_urlopen.call_args
        request_obj = call_args[0][0]
        sent_data = json.loads(request_obj.data.decode())

        assert "MAT-001234" in sent_data["prompt"]
        assert "BOMBA CENTRIFUGA" in sent_data["prompt"]
        assert sent_data["options"]["temperature"] == 0.3  # Baja para RAG


# ============================================================================
# Tests de Chat
# ============================================================================

class TestDeepseekChat:
    """Tests para generate_chat()."""

    def _make_client(self):
        from backend.agent.rag.deepseek_client import DeepseekClient
        return DeepseekClient(verify_on_init=False)

    @patch("backend.agent.rag.deepseek_client.urlopen")
    def test_chat_sends_messages(self, mock_urlopen):
        """generate_chat() debe usar /api/chat con mensajes."""
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(
            _mock_chat_response("Hola! En que puedo ayudarte?")
        ).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        client = self._make_client()
        result = client.generate_chat(
            messages=[
                {"role": "user", "content": "Hola"},
            ],
            system_prompt="Eres un asistente de materiales",
        )

        assert "Hola" in result

        # Verificar payload
        call_args = mock_urlopen.call_args
        request_obj = call_args[0][0]
        sent_data = json.loads(request_obj.data.decode())

        assert "messages" in sent_data
        assert sent_data["messages"][0]["role"] == "system"
        assert sent_data["messages"][1]["role"] == "user"
        assert "/api/chat" in request_obj.full_url


# ============================================================================
# Tests de Manejo de Errores
# ============================================================================

class TestDeepseekErrors:
    """Tests para manejo de errores y edge cases."""

    def _make_client(self):
        from backend.agent.rag.deepseek_client import DeepseekClient
        return DeepseekClient(verify_on_init=False)

    @patch("backend.agent.rag.deepseek_client.urlopen")
    def test_connection_error_raises_custom_exception(self, mock_urlopen):
        """Debe lanzar OllamaConnectionError si Ollama no responde."""
        from backend.agent.rag.deepseek_client import OllamaConnectionError

        mock_urlopen.side_effect = URLError("Connection refused")

        client = self._make_client()

        with pytest.raises(OllamaConnectionError) as exc_info:
            client.generate("Test")

        assert "Ollama" in str(exc_info.value)
        assert "ollama serve" in str(exc_info.value)

    @patch("backend.agent.rag.deepseek_client.urlopen")
    def test_empty_response_returns_fallback(self, mock_urlopen):
        """Si Ollama devuelve respuesta vacia, retornar mensaje fallback."""
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(
            _mock_generate_response("")
        ).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        client = self._make_client()
        result = client.generate("Test")

        assert "No se pudo generar" in result


# ============================================================================
# Tests de Health Check y Status
# ============================================================================

class TestDeepseekStatus:
    """Tests para verificacion de estado."""

    def _make_client(self):
        from backend.agent.rag.deepseek_client import DeepseekClient
        return DeepseekClient(verify_on_init=False)

    @patch("backend.agent.rag.deepseek_client.urlopen")
    def test_is_model_available_true(self, mock_urlopen):
        """Debe detectar modelo disponible."""
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(
            _mock_ollama_tags_response()
        ).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        client = self._make_client()
        assert client.is_model_available() is True

    @patch("backend.agent.rag.deepseek_client.urlopen")
    def test_is_model_available_false(self, mock_urlopen):
        """Debe detectar modelo NO disponible."""
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(
            {"models": [{"name": "llama3:latest"}]}
        ).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        client = self._make_client()
        assert client.is_model_available() is False

    @patch("backend.agent.rag.deepseek_client.urlopen")
    def test_get_status_when_ready(self, mock_urlopen):
        """get_status() debe reportar ready cuando todo OK."""
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(
            _mock_ollama_tags_response()
        ).encode()
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        client = self._make_client()
        status = client.get_status()

        assert status["provider"] == "deepseek"
        assert status["ollama_running"] is True
        assert status["model_ready"] is True
        assert status["status"] == "ready"

    def test_get_status_when_offline(self):
        """get_status() debe reportar offline si Ollama no responde."""
        client = self._make_client()
        # Patch list_models on the instance to raise, since the real
        # list_models() swallows exceptions internally and returns [].
        # To exercise the offline branch in get_status(), we need the
        # exception to propagate out of list_models().
        with patch.object(client, "list_models", side_effect=URLError("Connection refused")):
            status = client.get_status()

        assert status["ollama_running"] is False
        assert status["model_ready"] is False
        assert status["status"] == "offline"


# ============================================================================
# Tests de Integracion con Factory
# ============================================================================

class TestDeepseekFactory:
    """Tests para verificar que get_llm_client reconoce deepseek."""

    def test_factory_creates_deepseek_client(self):
        """get_llm_client(provider='deepseek') debe crear DeepseekClient."""
        from backend.agent.rag.llm_client import get_llm_client
        from backend.agent.rag.deepseek_client import DeepseekClient

        # Nota: verify_on_init=True por default, pero el factory
        # no falla si Ollama no esta corriendo (solo warning)
        client = get_llm_client(provider="deepseek")
        assert isinstance(client, DeepseekClient)
        assert client.provider == "deepseek"

    @patch.dict("os.environ", {
        "OLLAMA_BASE_URL": "http://localhost:11434",
    }, clear=False)
    def test_factory_auto_detects_deepseek(self):
        """Auto-detect debe encontrar deepseek si hay OLLAMA_BASE_URL."""
        from backend.agent.rag.llm_client import get_llm_client

        # Limpiar otras API keys para que auto caiga en deepseek
        with patch.dict("os.environ", {
            "GOOGLE_AI_API_KEY": "",
            "ANTHROPIC_API_KEY": "",
            "OPENAI_API_KEY": "",
            "OLLAMA_BASE_URL": "http://localhost:11434",
        }):
            client = get_llm_client(provider="auto")
            assert client.provider == "deepseek"
