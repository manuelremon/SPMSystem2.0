"""
Cliente Gemini para Vertex IA.

Usa Google GenAI SDK (google-genai) para generar respuestas.
Soporta Gemini 2.0 Flash y otros modelos disponibles.

Mejoras:
- system_instruction nativo del SDK (no concatenado como texto)
- generate_chat con contenido multi-turno real (Contents API)
- Temperature dinamica segun tipo de query

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

    Usa el nuevo SDK google-genai con system_instruction nativo
    y contenido multi-turno estructurado.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-2.0-flash",
    ):
        try:
            from google import genai
            from google.genai import types as genai_types
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
        self._types = genai_types

        # Crear cliente con API key
        self.client = genai.Client(api_key=self.api_key)

        logger.info(f"Cliente Gemini inicializado: {model}")

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def provider(self) -> str:
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
        Genera una respuesta usando system_instruction nativo.

        Args:
            prompt: Prompt del usuario
            system_prompt: Instrucciones del sistema (usa system_instruction nativo)
            max_tokens: Maximo de tokens en respuesta
            temperature: Creatividad (0-1)

        Returns:
            Respuesta generada
        """
        try:
            config = self._types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
                top_p=0.95,
            )

            # Usar system_instruction nativo si hay system_prompt
            if system_prompt:
                config.system_instruction = system_prompt

            response = self.client.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config=config,
            )

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
        """
        context_text = self._format_context(context)

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
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """
        Genera respuesta en modo chat con historial multi-turno real.

        Usa la Contents API de Gemini con roles 'user' y 'model'
        en vez de concatenar todo como texto plano.

        Args:
            messages: Lista de mensajes [{"role": "user"|"assistant", "content": "..."}]
            system_prompt: Instrucciones del sistema (usa system_instruction nativo)
            max_tokens: Maximo de tokens
            temperature: Creatividad (0-1)

        Returns:
            Respuesta generada
        """
        try:
            # Construir contenido multi-turno con objetos Content
            contents = []
            for msg in messages:
                # Gemini usa "model" en vez de "assistant"
                role = "model" if msg["role"] == "assistant" else "user"
                contents.append(
                    self._types.Content(
                        role=role,
                        parts=[self._types.Part(text=msg["content"])],
                    )
                )

            # Asegurar que el ultimo mensaje sea del usuario
            if contents and contents[-1].role != "user":
                contents.append(
                    self._types.Content(
                        role="user",
                        parts=[self._types.Part(text="Continua.")],
                    )
                )

            config = self._types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
                top_p=0.95,
            )

            # system_instruction nativo - el modelo lo sigue mucho mejor
            if system_prompt:
                config.system_instruction = system_prompt

            response = self.client.models.generate_content(
                model=self._model_name,
                contents=contents,
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
        return {
            "provider": self.provider,
            "model": self.model_name,
            "status": "ready",
            "api_key_configured": bool(self.api_key),
        }
