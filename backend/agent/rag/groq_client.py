"""
Cliente Groq para Vertex IA.

Usa el SDK de OpenAI apuntando al endpoint de Groq,
que es 100% compatible con la API de OpenAI.

Groq ofrece inferencia ultrarapida en su tier gratuito:
- ~14,400 requests/dia
- Modelos: llama-3.3-70b-versatile, mixtral-8x7b-32768, etc.
- Sin tarjeta de credito

Configuracion via variables de entorno:
- GROQ_API_KEY: API key de console.groq.com
"""

import logging
import os
from typing import Any, Dict, List, Optional

from .llm_client import BaseLLMClient

logger = logging.getLogger(__name__)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "llama-3.3-70b-versatile"


class GroqClient(BaseLLMClient):
    """
    Cliente para Groq API (inferencia ultrarapida).

    Usa el SDK de OpenAI con base_url apuntando a Groq.
    Soporta los mismos metodos que OpenAIClient.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
    ):
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError(
                "openai no instalado. Ejecute: pip install openai>=1.0.0"
            )

        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError(
                "API key de Groq no configurada. "
                "Configure GROQ_API_KEY o pase api_key. "
                "Obtenga una gratis en https://console.groq.com"
            )

        self._model = model
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=GROQ_BASE_URL,
        )
        logger.info(f"Cliente Groq inicializado: {model}")

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def provider(self) -> str:
        return "groq"

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
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
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error generando con Groq: {e}")
            raise

    def generate_with_context(
        self,
        query: str,
        context: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        **kwargs,
    ) -> str:
        context_text = self._format_context(context)
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

    def generate_chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """
        Genera respuesta en modo chat multi-turno.

        Groq soporta la misma API de chat completions que OpenAI.
        """
        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})

        for msg in messages:
            api_messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

        try:
            response = self.client.chat.completions.create(
                model=self._model,
                messages=api_messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )

            content = response.choices[0].message.content
            if not content:
                return "Lo siento, no puedo responder a esa consulta."
            return content
        except Exception as e:
            logger.error(f"Error en chat con Groq: {e}")
            raise

    def _format_context(self, context: List[Dict[str, Any]]) -> str:
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
                f"  Precio: ${precio}"
            )
        return "\n\n".join(parts)

    def get_status(self) -> Dict[str, Any]:
        return {
            "provider": self.provider,
            "model": self.model_name,
            "status": "ready",
            "api_key_configured": bool(self.api_key),
        }
