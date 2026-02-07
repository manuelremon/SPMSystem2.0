"""
Cliente LLM abstracto para RAG.

Soporta múltiples proveedores:
- Google Gemini (Vertex IA - recomendado)
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)

Configuración via variables de entorno:
- GOOGLE_AI_API_KEY: API key de Google AI Studio (Gemini)
- OPENAI_API_KEY: API key de OpenAI
- ANTHROPIC_API_KEY: API key de Anthropic
"""

import logging
import os
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class BaseLLMClient(ABC):
    """Cliente base abstracto para LLMs."""

    @abstractmethod
    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        **kwargs,
    ) -> str:
        """
        Genera una respuesta del LLM.

        Args:
            prompt: Prompt del usuario
            system_prompt: Instrucciones del sistema
            max_tokens: Máximo de tokens en respuesta
            temperature: Creatividad (0-1)

        Returns:
            Respuesta generada
        """
        pass

    @abstractmethod
    def generate_with_context(
        self,
        query: str,
        context: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        **kwargs,
    ) -> str:
        """
        Genera respuesta usando contexto de documentos.

        Args:
            query: Pregunta del usuario
            context: Lista de documentos relevantes
            system_prompt: Instrucciones del sistema
            max_tokens: Máximo de tokens

        Returns:
            Respuesta generada
        """
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Nombre del modelo."""
        pass

    @property
    @abstractmethod
    def provider(self) -> str:
        """Nombre del proveedor."""
        pass


class OpenAIClient(BaseLLMClient):
    """Cliente para OpenAI GPT."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-4o-mini",
    ):
        """
        Inicializa cliente OpenAI.

        Args:
            api_key: API key (o usa OPENAI_API_KEY)
            model: Modelo a usar
        """
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError(
                "openai no instalado. Ejecute: pip install openai>=1.0.0"
            )

        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError(
                "API key de OpenAI no configurada. "
                "Configure OPENAI_API_KEY o pase api_key."
            )

        self._model = model
        self.client = OpenAI(api_key=self.api_key)
        logger.info(f"Cliente OpenAI inicializado: {model}")

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def provider(self) -> str:
        return "openai"

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        **kwargs,
    ) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            response = self.client.chat.completions.create(
                model=self._model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                **kwargs,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error generando con OpenAI: {e}")
            raise

    def generate_with_context(
        self,
        query: str,
        context: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        **kwargs,
    ) -> str:
        # Formatear contexto
        context_text = self._format_context(context)

        # Prompt con contexto
        full_prompt = f"""Usa el siguiente contexto para responder la pregunta.

CONTEXTO:
{context_text}

PREGUNTA: {query}

RESPUESTA:"""

        return self.generate(
            prompt=full_prompt,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            **kwargs,
        )

    def _format_context(self, context: List[Dict[str, Any]]) -> str:
        """Formatea documentos de contexto."""
        parts = []
        for i, doc in enumerate(context, 1):
            codigo = doc.get("codigo", doc.get("id", f"Doc{i}"))
            descripcion = doc.get("descripcion", doc.get("document", ""))
            similarity = doc.get("similarity", doc.get("match_score", 0))

            parts.append(
                f"[{i}] Código: {codigo}\n"
                f"    Descripción: {descripcion}\n"
                f"    Relevancia: {similarity:.2%}"
            )
        return "\n\n".join(parts)


class AnthropicClient(BaseLLMClient):
    """Cliente para Anthropic Claude."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "claude-3-haiku-20240307",
    ):
        """
        Inicializa cliente Anthropic.

        Args:
            api_key: API key (o usa ANTHROPIC_API_KEY)
            model: Modelo a usar
        """
        try:
            from anthropic import Anthropic
        except ImportError:
            raise ImportError(
                "anthropic no instalado. Ejecute: pip install anthropic>=0.18.0"
            )

        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError(
                "API key de Anthropic no configurada. "
                "Configure ANTHROPIC_API_KEY o pase api_key."
            )

        self._model = model
        self.client = Anthropic(api_key=self.api_key)
        logger.info(f"Cliente Anthropic inicializado: {model}")

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def provider(self) -> str:
        return "anthropic"

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        **kwargs,
    ) -> str:
        try:
            response = self.client.messages.create(
                model=self._model,
                max_tokens=max_tokens,
                system=system_prompt or "Eres un asistente experto en gestión de materiales e inventario.",
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"Error generando con Anthropic: {e}")
            raise

    def generate_with_context(
        self,
        query: str,
        context: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        **kwargs,
    ) -> str:
        # Formatear contexto
        context_text = self._format_context(context)

        # Prompt con contexto
        full_prompt = f"""<context>
{context_text}
</context>

Basándote en el contexto anterior, responde la siguiente pregunta:

{query}"""

        default_system = (
            "Eres un asistente experto en gestión de materiales e inventario SAP. "
            "Responde basándote SOLO en el contexto proporcionado. "
            "Si no encuentras la información, indica que no hay datos disponibles."
        )

        return self.generate(
            prompt=full_prompt,
            system_prompt=system_prompt or default_system,
            max_tokens=max_tokens,
            **kwargs,
        )

    def _format_context(self, context: List[Dict[str, Any]]) -> str:
        """Formatea documentos de contexto para Claude."""
        parts = []
        for i, doc in enumerate(context, 1):
            codigo = doc.get("codigo", doc.get("id", f"Doc{i}"))
            descripcion = doc.get("descripcion", doc.get("document", ""))
            similarity = doc.get("similarity", doc.get("match_score", 0))
            stock = doc.get("stock", "N/A")
            precio = doc.get("precio", doc.get("precio_usd", "N/A"))

            parts.append(
                f"<material id=\"{i}\">\n"
                f"  <codigo>{codigo}</codigo>\n"
                f"  <descripcion>{descripcion}</descripcion>\n"
                f"  <relevancia>{similarity:.2%}</relevancia>\n"
                f"  <stock>{stock}</stock>\n"
                f"  <precio>{precio}</precio>\n"
                f"</material>"
            )
        return "\n".join(parts)


class MockLLMClient(BaseLLMClient):
    """Cliente mock para pruebas sin API keys."""

    def __init__(self, model: str = "mock-model"):
        self._model = model
        logger.info("Cliente Mock LLM inicializado (sin conexión a API)")

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def provider(self) -> str:
        return "mock"

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        **kwargs,
    ) -> str:
        return f"[Mock Response] Prompt recibido ({len(prompt)} chars). Configure una API key para respuestas reales."

    def generate_with_context(
        self,
        query: str,
        context: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 1024,
        **kwargs,
    ) -> str:
        n_docs = len(context)
        return (
            f"[Mock Response] Query: '{query}'\n"
            f"Contexto: {n_docs} documentos encontrados.\n"
            f"Configure OPENAI_API_KEY o ANTHROPIC_API_KEY para respuestas reales."
        )


def get_llm_client(
    provider: str = "auto",
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> BaseLLMClient:
    """
    Factory para obtener cliente LLM.

    Args:
        provider: 'gemini', 'openai', 'anthropic', 'deepseek', 'mock', o 'auto'
        model: Modelo específico (opcional)
        api_key: API key (opcional, usa env vars)

    Returns:
        Cliente LLM configurado
    """
    if provider == "auto":
        # Detectar automaticamente basado en API keys / servicios disponibles
        # Prioridad: Gemini > Anthropic > OpenAI > Deepseek (local) > Mock
        if os.getenv("GOOGLE_AI_API_KEY"):
            provider = "gemini"
        elif os.getenv("ANTHROPIC_API_KEY") or api_key:
            provider = "anthropic"
        elif os.getenv("OPENAI_API_KEY"):
            provider = "openai"
        elif os.getenv("OLLAMA_BASE_URL") or os.getenv("DEEPSEEK_MODEL"):
            provider = "deepseek"
        else:
            logger.warning("No se encontraron API keys, usando cliente mock")
            provider = "mock"

    if provider == "gemini":
        from backend.agent.rag.gemini_client import GeminiClient
        return GeminiClient(api_key=api_key, model=model or "gemini-2.0-flash")
    elif provider == "openai":
        return OpenAIClient(api_key=api_key, model=model or "gpt-4o-mini")
    elif provider == "anthropic":
        return AnthropicClient(api_key=api_key, model=model or "claude-3-haiku-20240307")
    elif provider == "deepseek":
        from backend.agent.rag.deepseek_client import DeepseekClient
        return DeepseekClient(model=model, verify_on_init=True)
    elif provider == "mock":
        return MockLLMClient(model=model or "mock-model")
    else:
        raise ValueError(f"Proveedor no soportado: {provider}")
