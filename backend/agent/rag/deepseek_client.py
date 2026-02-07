"""
Cliente Deepseek-r1 para RAG via Ollama (local).

Conecta con un modelo Deepseek-r1 corriendo localmente
a través de Ollama's REST API.

Ventajas:
- Sin costo de API (corre en tu PC)
- Sin limites de rate limiting
- Privacidad total (datos nunca salen de tu red)
- Ideal para desarrollo y testing

Requisitos:
- Ollama instalado y corriendo: https://ollama.com
- Modelo descargado: ollama pull deepseek-r1:latest

Configuracion via variables de entorno:
- OLLAMA_BASE_URL: URL base de Ollama (default: http://localhost:11434)
- DEEPSEEK_MODEL: Nombre del modelo (default: deepseek-r1:latest)
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

from .llm_client import BaseLLMClient

logger = logging.getLogger(__name__)

# ============================================================================
# Configuracion por defecto
# ============================================================================
DEFAULT_OLLAMA_URL = "http://localhost:11434"
DEFAULT_MODEL = "deepseek-r1:latest"


class OllamaConnectionError(Exception):
    """Error de conexion con el servidor Ollama."""

    def __init__(self, base_url: str, original_error: Exception):
        self.base_url = base_url
        self.original_error = original_error
        super().__init__(
            f"No se pudo conectar con Ollama en {base_url}. "
            f"Verifique que Ollama este corriendo: 'ollama serve'\n"
            f"Error original: {original_error}"
        )


class OllamaModelNotFoundError(Exception):
    """El modelo solicitado no esta disponible en Ollama."""

    def __init__(self, model: str):
        self.model = model
        super().__init__(
            f"Modelo '{model}' no encontrado en Ollama. "
            f"Descargalo con: 'ollama pull {model}'"
        )


class DeepseekClient(BaseLLMClient):
    """
    Cliente para Deepseek-r1 via Ollama (ejecucion local).

    Se comunica con Ollama a traves de su REST API HTTP.
    No requiere API keys ni conexion a internet.

    Ollama REST API docs: https://github.com/ollama/ollama/blob/main/docs/api.md

    Ejemplo:
        client = DeepseekClient()
        response = client.generate("Que materiales necesito para una bomba?")
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 120,
        verify_on_init: bool = True,
    ):
        """
        Inicializa el cliente Deepseek/Ollama.

        Args:
            base_url: URL del servidor Ollama (default: env OLLAMA_BASE_URL
                      o http://localhost:11434)
            model: Nombre del modelo en Ollama (default: env DEEPSEEK_MODEL
                   o deepseek-r1:latest)
            timeout: Timeout en segundos para requests HTTP. Deepseek-r1 es
                     un modelo grande, puede tardar bastante en responder,
                     especialmente la primera vez que lo usas (carga en RAM).
            verify_on_init: Si True, verifica que Ollama este corriendo y
                           el modelo este disponible al inicializar.
                           Poner False para tests o inicializacion lazy.
        """
        self._base_url = (
            base_url
            or os.getenv("OLLAMA_BASE_URL", DEFAULT_OLLAMA_URL)
        ).rstrip("/")  # Quitar trailing slash si existe

        self._model = (
            model
            or os.getenv("DEEPSEEK_MODEL", DEFAULT_MODEL)
        )

        self._timeout = timeout

        if verify_on_init:
            self._verify_connection()

        logger.info(
            f"Cliente Deepseek inicializado: "
            f"model={self._model}, url={self._base_url}"
        )

    # ========================================================================
    # Propiedades requeridas por BaseLLMClient
    # ========================================================================

    @property
    def model_name(self) -> str:
        """Nombre del modelo (e.g. 'deepseek-r1:latest')."""
        return self._model

    @property
    def provider(self) -> str:
        """Identificador del proveedor."""
        return "deepseek"

    # ========================================================================
    # Metodos de comunicacion HTTP con Ollama
    # ========================================================================

    def _http_post(
        self,
        endpoint: str,
        payload: dict,
        timeout: Optional[int] = None,
    ) -> dict:
        """
        Realiza un POST HTTP al servidor Ollama.

        Usamos urllib (stdlib) en lugar de requests para evitar
        agregar una dependencia extra. Ollama usa JSON simple.

        Args:
            endpoint: Path del endpoint (e.g. "/api/generate")
            payload: Diccionario a enviar como JSON body
            timeout: Timeout en segundos (default: self._timeout)

        Returns:
            Respuesta parseada como dict

        Raises:
            OllamaConnectionError: Si Ollama no esta corriendo
        """
        url = f"{self._base_url}{endpoint}"
        data = json.dumps(payload).encode("utf-8")

        req = Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urlopen(req, timeout=timeout or self._timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except URLError as e:
            raise OllamaConnectionError(self._base_url, e)
        except json.JSONDecodeError as e:
            logger.error(f"Respuesta invalida de Ollama: {e}")
            raise

    def _http_get(self, endpoint: str, timeout: int = 10) -> dict:
        """GET HTTP al servidor Ollama (para health checks)."""
        url = f"{self._base_url}{endpoint}"
        req = Request(url, method="GET")

        try:
            with urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except URLError as e:
            raise OllamaConnectionError(self._base_url, e)

    # ========================================================================
    # Verificacion y salud del servidor
    # ========================================================================

    def _verify_connection(self) -> None:
        """
        Verifica que Ollama este corriendo y el modelo disponible.

        Raises:
            OllamaConnectionError: Si Ollama no responde
            OllamaModelNotFoundError: Si el modelo no esta descargado
        """
        # 1. Verificar que Ollama este corriendo
        try:
            self._http_get("/api/tags", timeout=5)
        except OllamaConnectionError:
            logger.warning(
                f"Ollama no disponible en {self._base_url}. "
                "El cliente se creo pero las llamadas fallaran "
                "hasta que Ollama este corriendo."
            )
            return  # No fallar, permitir inicializacion lazy

        # 2. Verificar que el modelo este disponible
        if not self.is_model_available():
            logger.warning(
                f"Modelo '{self._model}' no encontrado en Ollama. "
                f"Descargalo con: ollama pull {self._model}"
            )

    def is_model_available(self) -> bool:
        """
        Verifica si el modelo esta descargado en Ollama.

        Returns:
            True si el modelo esta disponible
        """
        try:
            response = self._http_get("/api/tags", timeout=5)
            models = response.get("models", [])
            available = [m.get("name", "") for m in models]
            return self._model in available
        except Exception:
            return False

    def list_models(self) -> List[str]:
        """
        Lista todos los modelos disponibles en Ollama.

        Returns:
            Lista de nombres de modelos
        """
        try:
            response = self._http_get("/api/tags", timeout=5)
            return [m.get("name", "") for m in response.get("models", [])]
        except Exception as e:
            logger.error(f"Error listando modelos: {e}")
            return []

    def get_status(self) -> Dict[str, Any]:
        """
        Retorna estado completo del cliente y servidor.

        Returns:
            Dict con informacion de estado
        """
        status = {
            "provider": self.provider,
            "model": self.model_name,
            "base_url": self._base_url,
            "timeout": self._timeout,
        }

        try:
            models = self.list_models()
            status["ollama_running"] = True
            status["available_models"] = models
            status["model_ready"] = self._model in models
            status["status"] = "ready" if self._model in models else "model_missing"
        except Exception:
            status["ollama_running"] = False
            status["available_models"] = []
            status["model_ready"] = False
            status["status"] = "offline"

        return status

    # ========================================================================
    # Metodos de generacion (implementacion de BaseLLMClient)
    # ========================================================================

    def _clean_thinking_tokens(self, text: str) -> str:
        """
        Deepseek-r1 produce tokens de "pensamiento" entre <think>...</think>.
        Este metodo los remueve para dar una respuesta limpia al usuario.

        Args:
            text: Texto crudo del modelo

        Returns:
            Texto sin bloques <think>
        """
        import re
        # Remover bloques <think>...</think> (con newlines incluidos)
        cleaned = re.sub(
            r"<think>.*?</think>",
            "",
            text,
            flags=re.DOTALL,
        )
        return cleaned.strip()

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        include_thinking: bool = False,
        **kwargs,
    ) -> str:
        """
        Genera una respuesta usando Deepseek-r1 via Ollama.

        Usa el endpoint /api/generate de Ollama con stream=false
        para recibir la respuesta completa en una sola llamada.

        Args:
            prompt: Prompt del usuario
            system_prompt: Instrucciones del sistema (opcional)
            max_tokens: Maximo de tokens a generar.
                        Ollama usa "num_predict" internamente.
            temperature: Control de creatividad (0.0 = determinista,
                        1.0 = muy creativo). Para RAG, usar 0.1-0.3.
            include_thinking: Si True, incluye los tokens <think> de
                            Deepseek-r1 en la respuesta. Util para
                            debugging. Default: False (respuesta limpia).
            **kwargs: Parametros extra para Ollama options (top_p, top_k, etc.)

        Returns:
            Texto de respuesta generado

        Raises:
            OllamaConnectionError: Si Ollama no esta corriendo
        """
        # Construir payload para Ollama /api/generate
        payload = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,  # Respuesta completa, no streaming
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                # Valores sensatos por defecto para RAG
                "top_p": kwargs.get("top_p", 0.9),
                "top_k": kwargs.get("top_k", 40),
                "repeat_penalty": kwargs.get("repeat_penalty", 1.1),
            },
        }

        # System prompt (Ollama lo soporta nativamente)
        if system_prompt:
            payload["system"] = system_prompt

        logger.debug(
            f"Deepseek generate: model={self._model}, "
            f"prompt_len={len(prompt)}, temp={temperature}"
        )

        try:
            response = self._http_post("/api/generate", payload)

            raw_text = response.get("response", "")

            if not raw_text:
                logger.warning("Respuesta vacia de Deepseek-r1")
                return "No se pudo generar una respuesta."

            # Limpiar tokens de pensamiento a menos que se pidan
            if include_thinking:
                return raw_text.strip()
            else:
                return self._clean_thinking_tokens(raw_text)

        except OllamaConnectionError:
            raise
        except Exception as e:
            logger.error(f"Error generando con Deepseek: {e}")
            raise

    def generate_with_context(
        self,
        query: str,
        context: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        **kwargs,
    ) -> str:
        """
        Genera respuesta usando contexto RAG de documentos/materiales.

        Este es el metodo principal para RAG: recibe la query del
        usuario + los documentos relevantes recuperados por el
        retriever, y genera una respuesta contextualizada.

        Args:
            query: Pregunta del usuario
            context: Lista de documentos relevantes del retriever.
                     Cada dict tiene: codigo, descripcion, similarity,
                     stock, precio, etc.
            system_prompt: System prompt personalizado (si None, usa default)
            max_tokens: Maximo de tokens en respuesta

        Returns:
            Respuesta contextualizada
        """
        context_text = self._format_context(context)

        full_prompt = (
            "CONTEXTO DE MATERIALES:\n"
            f"{context_text}\n\n"
            "---\n\n"
            "Basandote UNICAMENTE en el contexto anterior, "
            "responde la siguiente pregunta. Si la informacion "
            "no esta en el contexto, indica que no hay datos.\n\n"
            f"PREGUNTA: {query}\n\n"
            "RESPUESTA:"
        )

        default_system = (
            "Eres un asistente experto en gestion de materiales "
            "e inventario SAP para la industria Oil & Gas. "
            "Responde en espanol de forma precisa y concisa. "
            "NUNCA inventes codigos de material ni datos que no "
            "esten en el contexto proporcionado."
        )

        return self.generate(
            prompt=full_prompt,
            system_prompt=system_prompt or default_system,
            max_tokens=max_tokens,
            temperature=0.3,  # Baja para RAG (precision > creatividad)
            **kwargs,
        )

    def generate_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        include_thinking: bool = False,
    ) -> str:
        """
        Genera respuesta en modo chat con historial de conversacion.

        Usa el endpoint /api/chat de Ollama que soporta mensajes
        multi-turno nativamente (como OpenAI chat completions).

        Args:
            messages: Historial de chat. Cada dict tiene:
                      {"role": "user"|"assistant", "content": "..."}
            system_prompt: Instrucciones del sistema
            max_tokens: Maximo de tokens
            temperature: Creatividad (0-1)
            include_thinking: Incluir tokens <think> de Deepseek

        Returns:
            Respuesta del asistente
        """
        # Construir lista de mensajes para Ollama /api/chat
        ollama_messages = []

        if system_prompt:
            ollama_messages.append({
                "role": "system",
                "content": system_prompt,
            })

        for msg in messages:
            ollama_messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

        payload = {
            "model": self._model,
            "messages": ollama_messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "top_p": 0.9,
            },
        }

        try:
            response = self._http_post("/api/chat", payload)
            raw_text = response.get("message", {}).get("content", "")

            if not raw_text:
                return "No se pudo generar una respuesta."

            if include_thinking:
                return raw_text.strip()
            else:
                return self._clean_thinking_tokens(raw_text)

        except OllamaConnectionError:
            raise
        except Exception as e:
            logger.error(f"Error en chat con Deepseek: {e}")
            raise

    # ========================================================================
    # Metodos de utilidad
    # ========================================================================

    def _format_context(self, context: List[Dict[str, Any]]) -> str:
        """
        Formatea documentos de contexto para Deepseek.

        Deepseek-r1 responde bien con formato estructurado simple
        (sin XML ni Markdown complejo). Usamos texto plano claro.

        Args:
            context: Lista de documentos del retriever

        Returns:
            Texto formateado con los materiales
        """
        parts = []
        for i, doc in enumerate(context, 1):
            codigo = doc.get("codigo", doc.get("id", f"Doc{i}"))
            descripcion = doc.get("descripcion", doc.get("document", ""))
            similarity = doc.get("similarity", doc.get("match_score", 0))
            stock = doc.get("stock", "N/A")
            precio = doc.get("precio", doc.get("precio_usd", "N/A"))

            parts.append(
                f"[Material {i}]\n"
                f"  Codigo: {codigo}\n"
                f"  Descripcion: {descripcion}\n"
                f"  Relevancia: {similarity:.0%}\n"
                f"  Stock: {stock}\n"
                f"  Precio USD: {precio}"
            )
        return "\n\n".join(parts)

    def generate_streaming(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ):
        """
        Genera respuesta con streaming (token por token).

        Usa stream=True en Ollama, que devuelve la respuesta
        en multiples chunks JSON (uno por linea, NDJSON).

        Util para mostrar la respuesta en tiempo real en el
        frontend mientras el modelo "piensa".

        Args:
            prompt: Prompt del usuario
            system_prompt: System prompt opcional
            max_tokens: Maximo tokens
            temperature: Creatividad

        Yields:
            str: Cada token/chunk de texto generado
        """
        payload = {
            "model": self._model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        if system_prompt:
            payload["system"] = system_prompt

        url = f"{self._base_url}/api/generate"
        data = json.dumps(payload).encode("utf-8")

        req = Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urlopen(req, timeout=self._timeout) as resp:
                for line in resp:
                    if line:
                        chunk = json.loads(line.decode("utf-8"))
                        token = chunk.get("response", "")
                        if token:
                            yield token
                        # Ollama marca done=true en el ultimo chunk
                        if chunk.get("done", False):
                            break
        except URLError as e:
            raise OllamaConnectionError(self._base_url, e)
