"""
Cliente Gemini para Vertex IA.

Usa Google GenAI SDK (google-genai) para generar respuestas.
Soporta Gemini 2.0 Flash y otros modelos disponibles.

Configuracion via variables de entorno:
- GOOGLE_AI_API_KEY: API key de Google AI Studio
"""

import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class GeminiClient:
    """
    Cliente para Google Gemini API.

    Usa el nuevo SDK google-genai (reemplaza google.generativeai deprecado).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-2.0-flash",
    ):
        """
        Inicializa cliente Gemini.

        Args:
            api_key: API key (o usa GOOGLE_AI_API_KEY)
            model: Modelo a usar (gemini-2.0-flash, gemini-1.5-pro, etc.)
        """
        try:
            from google import genai
        except ImportError:
            raise ImportError(
                "google-genai no instalado. "
                "Ejecute: pip install google-genai"
            )

        self.api_key = api_key or os.getenv("GOOGLE_AI_API_KEY")
        if not self.api_key:
            raise ValueError(
                "API key de Google AI no configurada. "
                "Configure GOOGLE_AI_API_KEY o pase api_key."
            )

        self._model_name = model
        self._genai = genai

        # Crear cliente con API key
        self.client = genai.Client(api_key=self.api_key)

        logger.info(f"Cliente Gemini inicializado: {model}")

    @property
    def model_name(self) -> str:
        """Nombre del modelo."""
        return self._model_name

    @property
    def provider(self) -> str:
        """Nombre del proveedor."""
        return "gemini"

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        **kwargs,
    ) -> str:
        """
        Genera una respuesta del LLM.

        Args:
            prompt: Prompt del usuario
            system_prompt: Instrucciones del sistema
            max_tokens: Maximo de tokens en respuesta
            temperature: Creatividad (0-1)

        Returns:
            Respuesta generada
        """
        # Construir prompt completo con system prompt
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n---\n\n{prompt}"

        try:
            # Configuracion de generacion
            config = {
                "temperature": temperature,
                "max_output_tokens": max_tokens,
                "top_p": 0.95,
            }

            response = self.client.models.generate_content(
                model=self._model_name,
                contents=full_prompt,
                config=config,
            )

            # Verificar respuesta
            if not response or not response.text:
                logger.warning("Respuesta de Gemini vacia o bloqueada")
                return "Lo siento, no puedo responder a esa consulta."

            return response.text

        except Exception as e:
            logger.error(f"Error generando con Gemini: {e}")
            raise

    def generate_with_context(
        self,
        query: str,
        context: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        **kwargs,
    ) -> str:
        """
        Genera respuesta usando contexto de documentos.

        Args:
            query: Pregunta del usuario
            context: Lista de documentos relevantes
            system_prompt: Instrucciones del sistema
            max_tokens: Maximo de tokens

        Returns:
            Respuesta generada
        """
        # Formatear contexto
        context_text = self._format_context(context)

        # Prompt con contexto
        full_prompt = f"""<contexto>
{context_text}
</contexto>

Basandote en el contexto anterior, responde la siguiente pregunta:

{query}"""

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
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> str:
        """
        Genera respuesta en modo chat con historial.

        Args:
            messages: Lista de mensajes [{"role": "user"|"assistant", "content": "..."}]
            system_prompt: Instrucciones del sistema
            max_tokens: Maximo de tokens
            temperature: Creatividad (0-1)

        Returns:
            Respuesta generada
        """
        try:
            # Construir historial de conversacion como texto
            conversation_parts = []

            if system_prompt:
                conversation_parts.append(f"[Sistema]\n{system_prompt}")

            for msg in messages:
                role_label = "Usuario" if msg["role"] == "user" else "Asistente"
                conversation_parts.append(f"[{role_label}]\n{msg['content']}")

            # El prompt completo es la conversacion
            full_prompt = "\n\n---\n\n".join(conversation_parts)

            # Agregar instruccion final para que responda
            if messages and messages[-1]["role"] == "user":
                full_prompt += "\n\n---\n\n[Asistente]\n"

            # Configuracion de generacion
            config = {
                "temperature": temperature,
                "max_output_tokens": max_tokens,
                "top_p": 0.95,
            }

            response = self.client.models.generate_content(
                model=self._model_name,
                contents=full_prompt,
                config=config,
            )

            if not response or not response.text:
                return "Lo siento, no puedo responder a esa consulta."

            return response.text

        except Exception as e:
            logger.error(f"Error en chat con Gemini: {e}")
            raise

    def _format_context(self, context: List[Dict[str, Any]]) -> str:
        """Formatea documentos de contexto para Gemini."""
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
        """Retorna estado del cliente."""
        return {
            "provider": self.provider,
            "model": self.model_name,
            "status": "ready",
            "api_key_configured": bool(self.api_key),
        }
