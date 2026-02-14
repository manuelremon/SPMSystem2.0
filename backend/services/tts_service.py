"""
Servicio de Text-to-Speech usando Edge TTS (Microsoft) - GRATIS.

Usa voces neurales de Microsoft Edge, incluyendo voz argentina nativa.
No requiere API key ni autenticacion.

Voces argentinas disponibles:
- es-AR-TomasNeural: Voz masculina argentina (default)
- es-AR-ElenaNeural: Voz femenina argentina

Uso:
    from backend.services.tts_service import tts_service
    audio_bytes = await tts_service.synthesize("Che, como andas?")
"""

import asyncio
import io
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Flag para saber si el servicio esta disponible
TTS_AVAILABLE = False
_init_error = ""

try:
    import edge_tts
    TTS_AVAILABLE = True
except ImportError as e:
    _init_error = f"edge-tts no instalado: {e}"
    logger.warning(_init_error)


class TTSService:
    """
    Servicio de Text-to-Speech usando Edge TTS (Microsoft).

    Usa voces neurales gratuitas de alta calidad.
    Incluye voz argentina nativa (es-AR-TomasNeural).
    """

    # Voces disponibles - Argentina primero!
    VOICE_OPTIONS = {
        "elena": {
            "name": "es-AR-ElenaNeural",
            "description": "Voz femenina argentina - Elena",
            "gender": "Female",
            "locale": "es-AR",
        },
        "tomas": {
            "name": "es-AR-TomasNeural",
            "description": "Voz masculina argentina - Tomas (default)",
            "gender": "Male",
            "locale": "es-AR",
        },
        "dalia": {
            "name": "es-MX-DaliaNeural",
            "description": "Voz femenina mexicana - Dalia",
            "gender": "Female",
            "locale": "es-MX",
        },
        "jorge": {
            "name": "es-MX-JorgeNeural",
            "description": "Voz masculina mexicana - Jorge",
            "gender": "Male",
            "locale": "es-MX",
        },
    }

    def __init__(self, voice_type: str = "tomas"):
        """
        Inicializa el servicio TTS con voz argentina.

        Args:
            voice_type: Tipo de voz ('elena', 'tomas', 'dalia', 'jorge')
        """
        self._voice_type = voice_type
        self._voice_name = self.VOICE_OPTIONS.get(
            voice_type, self.VOICE_OPTIONS["tomas"]
        )["name"]
        self._available = TTS_AVAILABLE
        self._error = _init_error if not TTS_AVAILABLE else ""

        if self._available:
            logger.info(f"TTS argentino inicializado con voz: {self._voice_name}")

    @property
    def is_available(self) -> bool:
        """Retorna si el servicio esta disponible."""
        return self._available

    @property
    def error(self) -> str:
        """Retorna el error de inicializacion si existe."""
        return self._error

    async def synthesize_async(self, text: str, voice_type: Optional[str] = None) -> bytes:
        """
        Sintetiza texto a audio MP3 (async).

        Args:
            text: Texto a convertir a voz (max 5000 caracteres)
            voice_type: Opcional, tipo de voz diferente al default

        Returns:
            bytes: Audio en formato MP3
        """
        if not self._available:
            raise RuntimeError(f"TTS no disponible: {self._error}")

        if not text or not text.strip():
            raise ValueError("El texto no puede estar vacio")

        # Limpiar texto
        clean_text = self._clean_text(text)

        if len(clean_text) > 5000:
            raise ValueError("El texto excede el limite de 5000 caracteres")

        # Seleccionar voz
        voice_name = self._voice_name
        if voice_type and voice_type in self.VOICE_OPTIONS:
            voice_name = self.VOICE_OPTIONS[voice_type]["name"]

        try:
            # Generar audio con Edge TTS
            communicate = edge_tts.Communicate(
                clean_text,
                voice_name,
                rate="+18%",   # Velocidad natural argentina
                pitch="+5Hz",  # Ligeramente mas alto
            )

            # Recolectar chunks de audio
            audio_data = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.write(chunk["data"])

            audio_bytes = audio_data.getvalue()
            logger.debug(f"Audio generado: {len(audio_bytes)} bytes con voz {voice_name}")
            return audio_bytes

        except Exception as e:
            logger.error(f"Error sintetizando audio: {e}")
            raise RuntimeError(f"Error generando audio: {e}")

    def synthesize(self, text: str, voice_type: Optional[str] = None) -> bytes:
        """
        Sintetiza texto a audio MP3 (sync wrapper).

        Args:
            text: Texto a convertir a voz
            voice_type: Opcional, tipo de voz

        Returns:
            bytes: Audio en formato MP3
        """
        import concurrent.futures

        # Ejecutar en un thread separado con su propio event loop
        def run_in_thread():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(
                    self.synthesize_async(text, voice_type)
                )
            finally:
                loop.close()

        # Usar ThreadPoolExecutor para ejecutar el async code
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(run_in_thread)
            return future.result(timeout=60)  # 60 segundos para textos largos

    def _clean_text(self, text: str) -> str:
        """
        Limpia el texto para mejor sintesis.
        """
        clean = text

        # Eliminar markdown
        clean = re.sub(r'\*\*(.+?)\*\*', r'\1', clean)  # **bold**
        clean = re.sub(r'\*(.+?)\*', r'\1', clean)      # *italic*
        clean = re.sub(r'`(.+?)`', r'\1', clean)        # `code`
        clean = re.sub(r'```[\s\S]*?```', '', clean)    # code blocks
        clean = re.sub(r'#+\s*', '', clean)             # headers
        clean = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', clean)  # links

        # Listas a texto
        clean = re.sub(r'^\s*[-*]\s*', '', clean, flags=re.MULTILINE)
        clean = re.sub(r'^\s*\d+\.\s*', '', clean, flags=re.MULTILINE)

        # Normalizar espacios
        clean = re.sub(r'\n+', '. ', clean)
        clean = re.sub(r'\s+', ' ', clean)

        # Caracteres problematicos
        clean = re.sub(r'[<>{}|\[\]]', '', clean)

        return clean.strip()

    async def get_available_voices_async(self) -> list:
        """Lista todas las voces disponibles en espanol."""
        if not self._available:
            return []

        try:
            voices = await edge_tts.list_voices()
            spanish_voices = [
                {
                    "name": v["ShortName"],
                    "gender": v["Gender"],
                    "locale": v["Locale"],
                    "friendly_name": v.get("FriendlyName", v["ShortName"]),
                }
                for v in voices
                if v["Locale"].startswith("es-")
            ]
            return spanish_voices
        except Exception as e:
            logger.error(f"Error listando voces: {e}")
            return []

    def get_available_voices(self) -> list:
        """Lista todas las voces disponibles en espanol (sync)."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                return []  # No podemos bloquear
            return loop.run_until_complete(self.get_available_voices_async())
        except RuntimeError:
            return asyncio.run(self.get_available_voices_async())


# Instancia singleton - voz Tomas argentina por default
tts_service = TTSService(voice_type="tomas")


def get_tts_service(voice_type: str = "tomas") -> TTSService:
    """Factory para obtener instancia del servicio TTS."""
    global tts_service

    if voice_type == "tomas":
        return tts_service

    return TTSService(voice_type=voice_type)
