"""
Rutas API para Vertex IA - Asistente conversacional con Gemini.

Endpoints:
- POST /api/vertex/chat - Enviar mensaje al chat
- POST /api/vertex/tts - Sintetizar texto a voz (Google Cloud TTS)
- GET  /api/vertex/suggestions - Obtener sugerencias contextuales
- GET  /api/vertex/alerts - Obtener alertas proactivas
- POST /api/vertex/alerts/<id>/dismiss - Descartar alerta
- POST /api/vertex/session/start - Iniciar nueva sesion
- GET  /api/vertex/session/resume - Reanudar sesion existente
- GET  /api/vertex/history - Historial de conversaciones
- GET  /api/vertex/status - Estado del servicio

Mejoras Sprint 24:
- Cache de respuestas con TTL
- Integracion RAG para busqueda de materiales
- Enriquecimiento de contexto con datos del usuario
- Aprendizaje de materiales consultados
- Integracion de AlertEngine para alertas proactivas

Mejoras Sprint 25:
- Text-to-Speech con Edge TTS (Microsoft) - GRATIS, voces neurales argentinas
"""

import hashlib
import json
import logging
import re
import threading
from datetime import datetime
from typing import Any, Dict, List, Optional

from flask import Blueprint, g, jsonify, request, Response

logger = logging.getLogger(__name__)

# =============================================================================
# Cache de Respuestas (Thread-Safe)
# =============================================================================

# Lock para operaciones de cache (thread-safety en Gunicorn multi-worker)
_cache_lock = threading.Lock()

# Simple TTL cache para respuestas repetidas
_response_cache: Dict[str, Dict[str, Any]] = {}
_cache_ttl_seconds = 300  # 5 minutos


def _get_cache_key(user_id: str, message: str, page: str) -> str:
    """Genera clave de cache normalizada."""
    normalized = message.lower().strip()
    raw = f"{user_id}:{page}:{normalized}"
    return hashlib.md5(raw.encode()).hexdigest()


def _get_cached_response(cache_key: str) -> Optional[str]:
    """Obtiene respuesta cacheada si existe y no expiro (thread-safe)."""
    with _cache_lock:
        if cache_key in _response_cache:
            entry = _response_cache[cache_key]
            if (datetime.now() - entry["created_at"]).total_seconds() < _cache_ttl_seconds:
                logger.debug(f"Cache hit for {cache_key[:8]}...")
                return entry["response"]
            else:
                del _response_cache[cache_key]
        return None


def _set_cached_response(cache_key: str, response: str):
    """Guarda respuesta en cache (thread-safe)."""
    with _cache_lock:
        # Limitar tamano del cache
        if len(_response_cache) > 500:
            # Eliminar entradas mas antiguas
            oldest = sorted(_response_cache.items(), key=lambda x: x[1]["created_at"])[:100]
            for key, _ in oldest:
                del _response_cache[key]

        _response_cache[cache_key] = {
            "response": response,
            "created_at": datetime.now(),
        }


# =============================================================================
# Helper para verificar tablas de Vertex (Thread-Safe)
# =============================================================================

_tables_lock = threading.Lock()
_vertex_tables_exist: Optional[bool] = None


def _check_vertex_tables() -> bool:
    """
    Verifica si las tablas de Vertex existen en la BD.
    Cachea el resultado para evitar queries repetidas (thread-safe).
    Soporta PostgreSQL y SQLite.
    """
    global _vertex_tables_exist

    # Fast path: si ya está cacheado, retornar sin lock
    if _vertex_tables_exist is not None:
        return _vertex_tables_exist

    with _tables_lock:
        # Double-check dentro del lock
        if _vertex_tables_exist is not None:
            return _vertex_tables_exist

        try:
            from backend.core.db import get_db_connection, is_using_postgresql

            with get_db_connection() as conn:
                cursor = conn.cursor()
                if is_using_postgresql():
                    cursor.execute(
                        """
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables
                            WHERE table_name = 'vertex_conversations'
                        )
                        """
                    )
                    _vertex_tables_exist = cursor.fetchone()[0]
                else:
                    cursor.execute(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name='vertex_conversations'"
                    )
                    _vertex_tables_exist = cursor.fetchone() is not None
                return _vertex_tables_exist
        except Exception as e:
            logger.warning(f"Error verificando tablas Vertex: {e}")
            _vertex_tables_exist = False
            return False

from backend.core.roles import require_auth
from backend.core.rate_limit import rate_limit

# Servicio TTS (Text-to-Speech)
TTS_AVAILABLE = False
tts_service = None
try:
    from backend.services.tts_service import tts_service, TTS_AVAILABLE
except ImportError:
    try:
        from services.tts_service import tts_service, TTS_AVAILABLE
    except ImportError as e:
        logger.warning(f"TTS service not available: {e}")

# Importar componentes de Vertex IA
VERTEX_AVAILABLE = False
import_error = ""
vertex_memory_module = None
vertex_prompts_module = None
llm_client_module = None

try:
    from backend.agent.core.vertex_memory import VertexMemory
    vertex_memory_module = True
except ImportError as e:
    import_error = f"vertex_memory: {e}"
    logger.warning(f"Could not import vertex_memory: {e}")

try:
    from backend.agent.rag.vertex_prompts import (
        VERTEX_SYSTEM_PROMPT,
        VERTEX_SEARCH_PROMPT,
        get_page_suggestions,
        get_greeting,
    )
    vertex_prompts_module = True
except ImportError as e:
    import_error += f"; vertex_prompts: {e}"
    logger.warning(f"Could not import vertex_prompts: {e}")
    # Provide fallback functions
    VERTEX_SYSTEM_PROMPT = ""
    VERTEX_SEARCH_PROMPT = ""
    def get_page_suggestions(page): return ["Como te puedo ayudar?"]
    def get_greeting(hour, name=""): return "Hola! Soy Vertex IA."

try:
    from backend.agent.rag.llm_client import get_llm_client
    llm_client_module = True
except ImportError as e:
    import_error += f"; llm_client: {e}"
    logger.warning(f"Could not import llm_client: {e}")

VERTEX_AVAILABLE = bool(vertex_memory_module and vertex_prompts_module and llm_client_module)

bp = Blueprint("vertex_ia", __name__, url_prefix="/api/vertex")


def ensure_vertex_tables():
    """
    Crea tablas de Vertex si no existen (idempotente).
    Usa CREATE TABLE IF NOT EXISTS, seguro de ejecutar multiples veces.
    Se llama desde create_app() en startup.
    Soporta PostgreSQL (produccion) y SQLite (desarrollo).
    """
    global _vertex_tables_exist
    try:
        import os
        import importlib.util

        migration_path = os.path.join(
            os.path.dirname(__file__), "..", "migrations", "022_vertex_ia_tables.py"
        )
        migration_path = os.path.abspath(migration_path)

        if not os.path.exists(migration_path):
            logger.warning(f"Vertex migration file not found: {migration_path}")
            return

        spec = importlib.util.spec_from_file_location("migration_022", migration_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.run_migration()  # Auto-detecta SQLite o PostgreSQL
        _vertex_tables_exist = True
        logger.info("Vertex tables verified/created successfully")
    except Exception as e:
        logger.warning(f"Vertex tables auto-creation skipped: {e}")


# =============================================================================
# Health & Status
# =============================================================================


@bp.route("/status", methods=["GET"])
def status():
    """
    Estado del servicio Vertex IA.

    Response:
    {
        "ok": true,
        "service": "vertex_ia",
        "available": true,
        "gemini_configured": true,
        "features": {
            "chat": true,
            "memory": true,
            "proactive_alerts": true
        }
    }
    """
    import os

    gemini_key = os.getenv("GOOGLE_AI_API_KEY")

    tables_exist = _check_vertex_tables()

    return jsonify({
        "ok": True,
        "service": "vertex_ia",
        "available": VERTEX_AVAILABLE,
        "gemini_configured": bool(gemini_key),
        "tables_exist": tables_exist,
        "tts_available": TTS_AVAILABLE,
        "tts_voice": tts_service._voice_type if tts_service else None,
        "features": {
            "chat": VERTEX_AVAILABLE and bool(gemini_key),
            "memory": bool(vertex_memory_module),
            "prompts": bool(vertex_prompts_module),
            "llm_client": bool(llm_client_module),
            "proactive_alerts": VERTEX_AVAILABLE,
            "tts": TTS_AVAILABLE,
        },
        "error": None if VERTEX_AVAILABLE else import_error,
        "modules": {
            "vertex_memory": bool(vertex_memory_module),
            "vertex_prompts": bool(vertex_prompts_module),
            "llm_client": bool(llm_client_module),
        },
    }), 200


# =============================================================================
# Text-to-Speech (Google Cloud TTS Neural)
# =============================================================================


@bp.route("/tts", methods=["POST"])
@require_auth
@rate_limit(60, 60)  # 60 requests por minuto (cada mensaje puede generar audio)
def text_to_speech():
    """
    Sintetiza texto a audio usando Edge TTS (Microsoft) - GRATIS.

    Genera audio MP3 de alta calidad con voz argentina nativa (Tomas).
    No requiere API key ni autenticacion.

    Request JSON:
    {
        "text": "Hola, soy tu asistente virtual",
        "voice": "elena"  // opcional: elena (AR), tomas (AR), dalia (MX), jorge (MX)
    }

    Response:
    - Content-Type: audio/mpeg
    - Body: audio MP3 binario

    Errors:
    - 400: Texto vacio o muy largo (max 5000 chars)
    - 503: Servicio TTS no disponible
    - 500: Error interno
    """
    # Verificar disponibilidad del servicio
    if not TTS_AVAILABLE or tts_service is None:
        return jsonify({
            "ok": False,
            "error": {
                "code": "tts_not_available",
                "message": "Servicio TTS no disponible. Usar Web Speech API como fallback.",
            },
        }), 503

    if not tts_service.is_available:
        return jsonify({
            "ok": False,
            "error": {
                "code": "tts_not_configured",
                "message": f"TTS no configurado: {tts_service.error}",
            },
        }), 503

    try:
        data = request.get_json() or {}
        text = data.get("text", "").strip()
        voice_type = data.get("voice", "tomas")

        # Validar texto
        if not text:
            return jsonify({
                "ok": False,
                "error": {
                    "code": "empty_text",
                    "message": "El texto no puede estar vacio",
                },
            }), 400

        if len(text) > 5000:
            return jsonify({
                "ok": False,
                "error": {
                    "code": "text_too_long",
                    "message": "El texto excede el limite de 5000 caracteres",
                },
            }), 400

        # Generar audio
        logger.info(f"TTS: Generando audio para texto: {text[:50]}...")
        audio_bytes = tts_service.synthesize(text, voice_type=voice_type)
        logger.info(f"TTS: Audio generado, {len(audio_bytes)} bytes")

        # Retornar audio como stream
        return Response(
            audio_bytes,
            mimetype="audio/mpeg",
            headers={
                "Content-Disposition": "inline",
                "Content-Length": str(len(audio_bytes)),
                "Cache-Control": "private, max-age=3600",  # Cache 1 hora
            },
        )

    except ValueError as e:
        logger.warning(f"TTS validation error: {e}")
        return jsonify({
            "ok": False,
            "error": {
                "code": "validation_error",
                "message": str(e),
            },
        }), 400

    except RuntimeError as e:
        logger.error(f"TTS runtime error: {e}")
        return jsonify({
            "ok": False,
            "error": {
                "code": "tts_error",
                "message": str(e),
            },
        }), 500

    except Exception as e:
        logger.exception(f"Unexpected TTS error: {e}")
        return jsonify({
            "ok": False,
            "error": {
                "code": "internal_error",
                "message": "Error interno generando audio",
            },
        }), 500


@bp.route("/tts/voices", methods=["GET"])
def list_tts_voices():
    """
    Lista las voces TTS disponibles en espanol.

    Response:
    {
        "ok": true,
        "voices": [
            {
                "name": "es-US-Neural2-A",
                "language_codes": ["es-US"],
                "ssml_gender": "FEMALE",
                "natural_sample_rate_hertz": 24000
            }
        ],
        "default": "neural2",
        "options": {
            "neural2": { "name": "es-US-Neural2-A", ... },
            ...
        }
    }
    """
    if not TTS_AVAILABLE or tts_service is None or not tts_service.is_available:
        return jsonify({
            "ok": False,
            "error": {
                "code": "tts_not_available",
                "message": "Servicio TTS no disponible",
            },
        }), 503

    try:
        voices = tts_service.get_available_voices()

        return jsonify({
            "ok": True,
            "voices": voices,
            "default": "neural2",
            "options": tts_service.VOICE_OPTIONS,
        }), 200

    except Exception as e:
        logger.exception(f"Error listing TTS voices: {e}")
        return jsonify({
            "ok": False,
            "error": {
                "code": "list_error",
                "message": str(e),
            },
        }), 500


# =============================================================================
# Chat Principal
# =============================================================================


@bp.route("/chat", methods=["POST"])
@require_auth
@rate_limit(30, 60)  # 30 mensajes por minuto
def chat():
    """
    Procesa un mensaje del usuario y genera respuesta con Gemini.

    Request JSON:
    {
        "message": "Necesito una bomba de agua",
        "session_id": "uuid-opcional",
        "context": {
            "page": "materiales",
            "solicitud_id": 123
        }
    }

    Response:
    {
        "ok": true,
        "response": "Dale, te busco bombas de agua...",
        "session_id": "uuid-de-la-sesion",
        "suggestions": ["Ver detalles", "Crear solicitud"]
    }
    """
    if not VERTEX_AVAILABLE:
        return jsonify({
            "ok": False,
            "error": {
                "code": "vertex_not_available",
                "message": "Vertex IA no disponible",
            },
        }), 503

    try:
        data = request.get_json() or {}
        user_message = data.get("message", "").strip()
        session_id = data.get("session_id")
        context = data.get("context", {})

        if not user_message:
            return jsonify({
                "ok": False,
                "error": {
                    "code": "empty_message",
                    "message": "El mensaje no puede estar vacio",
                },
            }), 400

        user_id = g.user["id_spm"]
        page = context.get("page", "default")

        # Verificar cache para queries repetidas
        cache_key = _get_cache_key(user_id, user_message, page)
        cached = _get_cached_response(cache_key)
        if cached and not _is_user_specific_query(user_message):
            return jsonify({
                "ok": True,
                "response": cached,
                "session_id": session_id or "cached",
                "suggestions": get_page_suggestions(page),
                "cached": True,
            }), 200

        memory = VertexMemory(user_id)

        # Reanudar o crear sesion
        if session_id:
            if not memory.resume_conversation(session_id):
                # Sesion no encontrada, crear nueva
                session_id = memory.start_conversation(context)
        else:
            session_id = memory.start_conversation(context)

        # Guardar mensaje del usuario
        memory.add_message("user", user_message)

        # Obtener historial para contexto
        history = memory.get_conversation_for_llm(limit=8)

        # Obtener hechos del usuario para personalizar
        user_facts = memory.get_all_facts()
        user_context = memory.get_context_summary()

        # Construir prompt con contexto
        context_info = ""

        # Agregar página actual para contexto
        page_descriptions = {
            "dashboard": "el Dashboard principal con resumen de actividad",
            "crear_solicitud": "la página de Crear Nueva Solicitud",
            "create": "la página de Crear Nueva Solicitud",
            "mis_solicitudes": "Mis Solicitudes (listado de sus pedidos)",
            "solicitudes": "el listado de Solicitudes",
            "materiales": "el Catálogo de Materiales",
            "materials": "el Catálogo de Materiales",
            "planner": "el Planificador de solicitudes aprobadas",
            "planificador": "el Planificador de solicitudes aprobadas",
            "presupuesto": "la página de Presupuestos",
            "budget": "la página de Presupuestos",
            "mrp": "el Tablero de Alertas MRP (stock crítico)",
            "alertas": "el Tablero de Alertas MRP",
            "forecast": "la página de Pronósticos de Demanda",
            "aprobaciones": "la página de Aprobaciones pendientes",
            "equivalencias": "el Catálogo de Equivalencias de materiales",
        }
        page_desc = page_descriptions.get(page, f"la página {page}")
        context_info = f"\n\nContexto de navegación: El usuario está en {page_desc}."

        if user_context:
            context_info += f"\nInformación del usuario: {user_context}"

        # =================================================================
        # MEJORA: Integrar RAG para busqueda de materiales
        # =================================================================
        rag_context = ""
        has_real_context = False
        if _is_material_query(user_message):
            rag_context = _get_rag_context(user_message)
            # Verificar si realmente encontramos materiales
            has_real_context = bool(rag_context) and "MATERIALES ENCONTRADOS" in rag_context

        # =================================================================
        # CRÍTICO: Instrucción anti-alucinación cuando NO hay contexto real
        # =================================================================
        if _is_material_query(user_message) and not has_real_context:
            rag_context = """

⚠️ RESTRICCIÓN ABSOLUTA - LEE ESTO PRIMERO:
No se encontraron materiales en el catálogo para esta consulta.
ESTÁ PROHIBIDO inventar códigos SAP, precios o descripciones de materiales.
Tu respuesta DEBE ser: "No encontré materiales con esos criterios en el catálogo. ¿Podés darme más detalles o buscar con otro término?"
NO ofrezcas ejemplos inventados. NO uses códigos ficticios como 1234-5678.
"""

        # =================================================================
        # MEJORA: Enriquecer con datos del usuario (solicitudes, alertas)
        # =================================================================
        user_data_context = _get_user_data_context(user_id, user_message)
        if user_data_context:
            context_info += f"\n\n{user_data_context}"

        # Agregar instrucción anti-alucinación SIEMPRE para queries de materiales
        material_restriction = ""
        if _is_material_query(user_message):
            if has_real_context:
                material_restriction = """

⛔ REGLA INVIOLABLE: Solo podés mencionar los materiales listados arriba.
- Si el usuario pide algo que NO está en la lista, decí: "No encontré exactamente eso, pero tengo estas opciones similares:"
- NUNCA inventes códigos. Los códigos válidos empiezan con 4 dígitos (ej: 0915-0000461)
- Si un código no aparece en la lista de arriba, NO LO MENCIONES."""
            else:
                material_restriction = """

⛔ REGLA INVIOLABLE: No encontré materiales para esta búsqueda.
- Respondé: "No encontré materiales con esos criterios. ¿Podés darme más detalles?"
- NUNCA inventes códigos, precios ni descripciones."""

        full_prompt = f"""{VERTEX_SYSTEM_PROMPT}{context_info}{rag_context}{material_restriction}

HISTORIAL DE CONVERSACIÓN (léelo con atención):
{_format_history(history)}

MENSAJE ACTUAL DEL USUARIO: {user_message}

IMPORTANTE: Si el usuario dice "Dale", "Sí", "Ok", "Claro" o similar, es una CONFIRMACIÓN.
Revisá tu último mensaje en el historial y respondé con la información que ofreciste.
NO vuelvas a preguntar "¿En qué te puedo ayudar?".

Responde como Vertex IA:"""

        # Generar respuesta con Gemini
        try:
            client = get_llm_client(provider="auto")

            # LOG DETALLADO para debugging
            logger.info(f"=== VERTEX CHAT DEBUG ===")
            logger.info(f"LLM Client: {type(client).__name__}")
            logger.info(f"Has real context: {has_real_context}")
            logger.info(f"RAG Context (primeros 500 chars): {rag_context[:500] if rag_context else 'VACÍO'}")

            # Temperatura baja para evitar alucinaciones
            # 0.3 con contexto (algo de variación en el tono)
            # 0.1 sin contexto (muy determinístico, solo decir "no encontré")
            temperature = 0.3 if has_real_context else 0.1
            logger.info(f"Temperature: {temperature}")

            response_text = client.generate(
                prompt=full_prompt,
                max_tokens=1024,
                temperature=temperature,
            )
            logger.info(f"Response (primeros 300 chars): {response_text[:300]}")

            # Solo cachear respuestas con contexto real para evitar propagar inventos
            if has_real_context and not _is_user_specific_query(user_message):
                _set_cached_response(cache_key, response_text)
            # Si no hay contexto real, NO cachear (la respuesta podría ser "no encontré")

        except Exception as e:
            logger.error(f"Error generando con Gemini: {e}")
            response_text = (
                "Uh, tuve un problema conectandome. "
                "Podes intentar de nuevo en unos segundos?"
            )

        # Guardar respuesta
        memory.add_message("assistant", response_text)

        # Generar sugerencias de seguimiento
        page = context.get("page", "default")
        suggestions = get_page_suggestions(page)

        # Aprender de la conversacion (materiales mencionados, etc.)
        _learn_from_message(memory, user_message, response_text)

        return jsonify({
            "ok": True,
            "response": response_text,
            "session_id": session_id,
            "suggestions": suggestions,
        }), 200

    except Exception as e:
        logger.exception(f"Error en chat Vertex: {e}")
        return jsonify({
            "ok": False,
            "error": {
                "code": "chat_error",
                "message": str(e),
            },
        }), 500


def _format_history(history: List[Dict[str, str]]) -> str:
    """Formatea historial para el prompt."""
    if not history:
        return "(Sin historial previo)"

    lines = []
    for msg in history[-10:]:  # Últimos 10 mensajes para mejor contexto
        role = "Usuario" if msg["role"] == "user" else "Vertex"
        # No truncar para mantener preguntas completas
        content = msg["content"][:800]
        lines.append(f"{role}: {content}")

    return "\n".join(lines)


# =============================================================================
# Funciones de Inteligencia (RAG, Contexto, Aprendizaje)
# =============================================================================

# Keywords para detectar queries de materiales
MATERIAL_KEYWORDS = [
    "material", "bomba", "repuesto", "stock", "necesito", "busco",
    "precio", "disponible", "inventario", "codigo", "sap",
    "valvula", "motor", "filtro", "sensor", "cable", "tornillo",
    "pieza", "componente", "herramienta", "equipo",
    "junta", "empaquetadura", "gasket", "brida", "codo", "tubo",
    "acero", "inoxidable", "hierro", "cobre", "aluminio",
    "pulgadas", "serie", "espiralada", "espiral", "comprar", "quiero",
]

# Keywords que indican query especifica del usuario (no cachear)
USER_SPECIFIC_KEYWORDS = [
    "mi solicitud", "mis solicitudes", "mi pedido", "mis pedidos",
    "mi presupuesto", "mi centro", "mi sector", "cuanto tengo",
    "pendiente", "estado de", "seguimiento",
]


def _is_material_query(message: str) -> bool:
    """Detecta si el mensaje es una consulta sobre materiales."""
    msg_lower = message.lower()
    return any(kw in msg_lower for kw in MATERIAL_KEYWORDS)


def _is_user_specific_query(message: str) -> bool:
    """Detecta si el mensaje es especifico del usuario (no cachear)."""
    msg_lower = message.lower()
    return any(kw in msg_lower for kw in USER_SPECIFIC_KEYWORDS)


def _get_rag_context(message: str) -> str:
    """
    Busca materiales relevantes en la BD y formatea para el prompt.
    Usa búsqueda directa en SQLite como fallback si RAG no está disponible.
    """
    # Primero intentar búsqueda directa en BD (más confiable)
    try:
        results = _search_materials_direct(message)
        if results:
            context = "\n\n" + "="*60 + "\n"
            context += "📋 MATERIALES ENCONTRADOS EN EL CATÁLOGO SAP\n"
            context += "="*60 + "\n"
            context += "CÓDIGOS VÁLIDOS (solo podés usar estos):\n\n"
            for i, r in enumerate(results, 1):
                precio = r.get('precio', 0)
                precio_fmt = f"${precio:,.2f}" if precio else "Sin precio"
                context += f"{i}. {r['codigo']} - {r['descripcion'][:80]} - {precio_fmt}\n"
            context += "\n" + "="*60 + "\n"
            context += "⚠️ ATENCIÓN: Si el usuario pide algo que NO está en esta lista,\n"
            context += "decí que no lo encontraste y ofrecé las opciones disponibles.\n"
            context += "NUNCA inventes códigos que no estén arriba.\n"
            context += "="*60
            return context
    except Exception as e:
        logger.warning(f"Error en búsqueda directa: {e}")

    # Fallback a RAG si está disponible
    try:
        from backend.agent.rag.pipeline import get_rag_pipeline
        rag = get_rag_pipeline(llm_provider="auto")
        results = rag.search(message, n_results=5)

        if not results:
            return "\n\nNo se encontraron materiales con esos criterios en el catálogo."

        context = "\n\nMATERIALES ENCONTRADOS (datos reales):\n"
        for r in results:
            codigo = r.get("codigo", r.get("material_id", "N/A"))
            descripcion = r.get("descripcion", r.get("text", ""))[:100]
            context += f"- {codigo}: {descripcion}\n"

        return context

    except Exception as e:
        logger.warning(f"Error en búsqueda RAG: {e}")
        return "\n\nNo se pudo buscar en el catálogo. NO inventes materiales."


def _search_materials_direct(query: str) -> list:
    """
    Búsqueda directa en SQLite con ranking de relevancia.

    Usa OR para encontrar más resultados y ordena por cantidad de matches.
    Más flexible que la versión anterior que usaba AND.
    """
    import sqlite3
    import re

    # Extraer palabras clave significativas
    words = re.findall(r'\w+', query.lower())
    stopwords = {
        'de', 'la', 'el', 'en', 'un', 'una', 'los', 'las', 'que', 'por',
        'para', 'con', 'del', 'al', 'quiero', 'necesito', 'busco', 'comprar',
        'hay', 'tiene', 'donde', 'como', 'cual', 'cuanto', 'ver', 'mostrar',
        'dame', 'buscar', 'encontrar', 'material', 'materiales'
    }
    keywords = [w for w in words if len(w) > 2 and w not in stopwords]

    if not keywords:
        return []

    try:
        from backend.core.db import get_master_materiales_db_path
        from pathlib import Path

        # Buscar la BD que contenga la tabla 'materiales'
        db_path = str(get_master_materiales_db_path())
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Verificar si la tabla existe en esta BD
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='materiales'")
        if not cur.fetchone():
            conn.close()
            # Fallback: buscar en catalogo_materiales.db directamente
            fallback_path = Path(db_path).parent / "catalogo_materiales.db"
            if fallback_path.exists():
                conn = sqlite3.connect(str(fallback_path))
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
            else:
                return []

        # Limitar a 5 keywords más relevantes
        keywords = keywords[:5]

        # Construir condiciones OR (no AND) para mayor flexibilidad
        # Ranking y filtrado usan parámetros para evitar SQL injection
        conditions = []
        ranking_parts = []
        params = []
        for kw in keywords:
            kw_pattern = f'%{kw}%'
            conditions.append("(UPPER(descripcion) LIKE UPPER(?) OR UPPER(descripcion_larga) LIKE UPPER(?))")
            params.extend([kw_pattern, kw_pattern])
            # Ranking: descripcion vale 2 puntos, descripcion_larga vale 1
            ranking_parts.append("(CASE WHEN UPPER(descripcion) LIKE UPPER(?) THEN 2 ELSE 0 END)")
            ranking_parts.append("(CASE WHEN UPPER(descripcion_larga) LIKE UPPER(?) THEN 1 ELSE 0 END)")

        ranking_expr = " + ".join(ranking_parts) if ranking_parts else "0"

        # Parámetros para ranking (mismos patterns)
        ranking_params = []
        for kw in keywords:
            kw_pattern = f'%{kw}%'
            ranking_params.extend([kw_pattern, kw_pattern])

        # Query con OR y ordenamiento por relevancia
        sql = f"""
            SELECT
                codigo,
                descripcion,
                COALESCE(precio_usd, 0) as precio,
                ({ranking_expr}) as relevance
            FROM materiales
            WHERE ({' OR '.join(conditions)})
            AND activo = 1
            ORDER BY relevance DESC, precio DESC
            LIMIT 10
        """

        # ranking_params primero (para SELECT), luego filter params (para WHERE)
        cur.execute(sql, ranking_params + params)
        results = [dict(row) for row in cur.fetchall()]
        conn.close()

        # Filtrar resultados con relevancia mínima (al menos 1 match)
        results = [r for r in results if r.get('relevance', 0) > 0]

        logger.debug(f"Búsqueda directa BD: {len(results)} resultados para keywords {keywords}")
        return results

    except Exception as e:
        logger.warning(f"Error búsqueda directa BD: {e}")
        return []


def _get_user_data_context(user_id: str, message: str) -> str:
    """
    Obtiene datos relevantes del usuario para enriquecer el contexto.
    """
    context_parts = []

    try:
        from backend.core.db import get_db_connection, sql_extract_year

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Si pregunta por solicitudes, obtener las activas
            if any(kw in message.lower() for kw in ["solicitud", "pedido", "estado"]):
                cursor.execute(
                    """
                    SELECT id, status, total_monto, created_at
                    FROM solicitud
                    WHERE id_usuario = ?
                    AND status NOT IN ('closed', 'rejected', 'cancelled')
                    ORDER BY created_at DESC
                    LIMIT 5
                    """,
                    (user_id,),
                )
                solicitudes = cursor.fetchall()

                if solicitudes:
                    context_parts.append("Solicitudes activas del usuario:")
                    for sol in solicitudes:
                        sol_id = sol[0] if isinstance(sol, (list, tuple)) else sol["id"]
                        status = sol[1] if isinstance(sol, (list, tuple)) else sol["status"]
                        monto = sol[2] if isinstance(sol, (list, tuple)) else sol["total_monto"]
                        context_parts.append(f"  - #{sol_id} ({status}): ${monto:,.0f}" if monto else f"  - #{sol_id} ({status})")

            # Si pregunta por presupuesto, obtener info del centro
            if any(kw in message.lower() for kw in ["presupuesto", "budget", "plata", "dinero"]):
                cursor.execute(
                    "SELECT centros FROM usuario WHERE id_spm = ?",
                    (user_id,),
                )
                user_row = cursor.fetchone()
                if user_row:
                    centros = user_row[0] if isinstance(user_row, (list, tuple)) else user_row.get("centros")
                    if centros:
                        centro = centros.split(",")[0].strip() if "," in str(centros) else centros
                        year_expr = sql_extract_year()
                        cursor.execute(
                            f"""
                            SELECT monto_total, monto_usado, monto_reservado
                            FROM presupuesto
                            WHERE centro = ? AND anio = {year_expr}
                            """,
                            (centro,),
                        )
                        budget = cursor.fetchone()
                        if budget:
                            total = budget[0] if isinstance(budget, (list, tuple)) else budget["monto_total"]
                            usado = budget[1] if isinstance(budget, (list, tuple)) else budget["monto_usado"]
                            disponible = total - (usado or 0) if total else 0
                            context_parts.append(f"Presupuesto del centro {centro}:")
                            context_parts.append(f"  - Total: ${total:,.0f}" if total else "  - Total: N/A")
                            context_parts.append(f"  - Usado: ${usado:,.0f}" if usado else "  - Usado: $0")
                            context_parts.append(f"  - Disponible: ${disponible:,.0f}")

    except Exception as e:
        logger.warning(f"Error obteniendo contexto del usuario: {e}")

    return "\n".join(context_parts) if context_parts else ""


def _learn_from_message(memory: VertexMemory, user_msg: str, response: str):
    """
    Extrae y guarda informacion util de la conversacion.
    Aprende codigos de materiales consultados para personalizar futuras respuestas.
    """
    try:
        # 1. Extraer codigos de material (formato: 6-10 digitos)
        material_codes = re.findall(r'\b\d{6,10}\b', user_msg + " " + response)

        if material_codes:
            # Obtener materiales frecuentes existentes
            freq_materials = memory.recall_fact("materiales_frecuentes") or []

            # Agregar nuevos codigos (sin duplicados)
            for code in material_codes:
                if not any(m.get("codigo") == code for m in freq_materials):
                    freq_materials.append({
                        "codigo": code,
                        "mentioned_at": datetime.now().isoformat(),
                    })

            # Memoria ilimitada y permanente
            memory.remember_fact("materiales_frecuentes", freq_materials, expires_in_days=None)

        # 2. Detectar temas de interes
        topics = []
        topic_keywords = {
            "stock": ["stock", "inventario", "disponible", "cantidad"],
            "solicitud": ["solicitud", "pedido", "orden"],
            "presupuesto": ["presupuesto", "budget", "monto", "precio"],
            "sla": ["sla", "tiempo", "urgente", "demora", "vencimiento"],
            "equivalente": ["equivalente", "alternativa", "reemplazo", "similar"],
        }

        for topic, keywords in topic_keywords.items():
            if any(kw in user_msg.lower() for kw in keywords):
                topics.append(topic)

        if topics:
            # Memoria permanente de temas
            existing_topics = memory.recall_fact("recent_topics") or []
            all_topics = list(set(existing_topics + topics))
            memory.remember_fact("recent_topics", all_topics, expires_in_days=None)

    except Exception as e:
        logger.warning(f"Error en aprendizaje de mensaje: {e}")


# =============================================================================
# Sugerencias Contextuales
# =============================================================================


@bp.route("/suggestions", methods=["GET"])
def get_suggestions():
    """
    Obtiene sugerencias contextuales basadas en la pagina actual.

    No requiere autenticacion - devuelve sugerencias genericas si no hay auth.
    Personaliza si el usuario esta autenticado.

    Query params:
    - page: Nombre de la pagina actual
    - solicitud_id: ID de solicitud (opcional)

    Response:
    {
        "ok": true,
        "greeting": "Buen dia, Manuel!",
        "suggestions": [
            "Queres ver tus solicitudes pendientes?",
            "Te ayudo a buscar un material?"
        ]
    }
    """
    if not VERTEX_AVAILABLE:
        return jsonify({
            "ok": False,
            "error": {"code": "vertex_not_available"},
        }), 503

    try:
        page = request.args.get("page", "default")
        hour = datetime.now().hour

        # Intentar obtener info del usuario si esta autenticado
        user_name = ""
        user_id = None
        if hasattr(g, "user") and g.user:
            user_name = g.user.get("nombre", "")
            user_id = g.user.get("id_spm")

        # Generar saludo
        greeting = get_greeting(hour, user_name)

        # Obtener sugerencias para la pagina
        suggestions = get_page_suggestions(page)

        # Personalizar con memoria si el usuario esta autenticado
        if user_id:
            try:
                memory = VertexMemory(user_id)
                recent_topics = memory.get_recent_topics(days=3, limit=1)
                if recent_topics:
                    suggestions.insert(0, f"Seguimos con lo que hablamos de '{recent_topics[0][:30]}...'?")
                    suggestions = suggestions[:4]  # Max 4 sugerencias
            except Exception:
                pass

        return jsonify({
            "ok": True,
            "greeting": greeting,
            "suggestions": suggestions,
        }), 200

    except Exception as e:
        logger.exception(f"Error obteniendo sugerencias: {e}")
        return jsonify({
            "ok": False,
            "error": {"code": "suggestions_error", "message": str(e)},
        }), 500


# =============================================================================
# Alertas Proactivas
# =============================================================================


@bp.route("/alerts", methods=["GET"])
def get_alerts():
    """
    Obtiene alertas proactivas pendientes para el usuario.

    No requiere autenticacion - devuelve lista vacia si no hay auth.

    Response:
    {
        "ok": true,
        "alerts": [
            {
                "id": 1,
                "type": "stock_bajo",
                "priority": 2,
                "title": "Stock bajo de material frecuente",
                "message": "Che, el material X tiene poco stock..."
            }
        ],
        "count": 1
    }
    """
    if not VERTEX_AVAILABLE:
        return jsonify({
            "ok": False,
            "error": {"code": "vertex_not_available"},
        }), 503

    # Si no hay usuario autenticado, devolver lista vacia
    if not hasattr(g, "user") or not g.user:
        return jsonify({
            "ok": True,
            "alerts": [],
            "count": 0,
        }), 200

    try:
        from backend.core.db import get_db_connection

        user_id = g.user["id_spm"]

        # Verificar si las tablas existen
        if not _check_vertex_tables():
            return jsonify({
                "ok": True,
                "alerts": [],
                "count": 0,
                "tables_exist": False,
            }), 200

        # Obtener alertas pendientes (no mostradas)
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT id, alert_type, priority, title, message, context, created_at
                FROM vertex_proactive_alerts
                WHERE user_id = ? AND shown_at IS NULL
                ORDER BY priority ASC, created_at ASC
                LIMIT 5
                """,
                (user_id,),
            )
            rows = cursor.fetchall()

        alerts = []
        for row in rows:
            context_val = row["context"] if isinstance(row, dict) else row[5]
            if isinstance(context_val, str):
                context_val = json.loads(context_val)

            alerts.append({
                "id": row["id"] if isinstance(row, dict) else row[0],
                "type": row["alert_type"] if isinstance(row, dict) else row[1],
                "priority": row["priority"] if isinstance(row, dict) else row[2],
                "title": row["title"] if isinstance(row, dict) else row[3],
                "message": row["message"] if isinstance(row, dict) else row[4],
                "context": context_val,
                "created_at": (row["created_at"] if isinstance(row, dict) else row[6]),
            })

        return jsonify({
            "ok": True,
            "alerts": alerts,
            "count": len(alerts),
        }), 200

    except Exception as e:
        logger.exception(f"Error obteniendo alertas: {e}")
        return jsonify({
            "ok": False,
            "error": {"code": "alerts_error", "message": str(e)},
        }), 500


@bp.route("/alerts/<int:alert_id>/dismiss", methods=["POST"])
@require_auth
def dismiss_alert(alert_id: int):
    """
    Descarta una alerta (marca como vista/ignorada).

    Response:
    {
        "ok": true,
        "alert_id": 1
    }
    """
    try:
        from backend.core.db import get_db_transaction, sql_datetime_now

        user_id = g.user["id_spm"]
        now = sql_datetime_now()

        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE vertex_proactive_alerts
                SET dismissed_at = {now}
                WHERE id = ? AND user_id = ?
                """,
                (alert_id, user_id),
            )

            if cursor.rowcount == 0:
                return jsonify({
                    "ok": False,
                    "error": {"code": "not_found", "message": "Alerta no encontrada"},
                }), 404

        return jsonify({
            "ok": True,
            "alert_id": alert_id,
        }), 200

    except Exception as e:
        logger.exception(f"Error descartando alerta: {e}")
        return jsonify({
            "ok": False,
            "error": {"code": "dismiss_error", "message": str(e)},
        }), 500


@bp.route("/alerts/<int:alert_id>/shown", methods=["POST"])
@require_auth
def mark_alert_shown(alert_id: int):
    """
    Marca una alerta como mostrada al usuario.

    Response:
    {
        "ok": true,
        "alert_id": 1
    }
    """
    try:
        from backend.core.db import get_db_transaction, sql_datetime_now

        user_id = g.user["id_spm"]
        now = sql_datetime_now()

        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE vertex_proactive_alerts
                SET shown_at = {now}
                WHERE id = ? AND user_id = ? AND shown_at IS NULL
                """,
                (alert_id, user_id),
            )

        return jsonify({
            "ok": True,
            "alert_id": alert_id,
        }), 200

    except Exception as e:
        logger.exception(f"Error marcando alerta: {e}")
        return jsonify({
            "ok": False,
            "error": {"code": "mark_error", "message": str(e)},
        }), 500


# =============================================================================
# Sesiones y Historial
# =============================================================================


@bp.route("/session/start", methods=["POST"])
@require_auth
def start_session():
    """
    Inicia una nueva sesion de chat.

    Request JSON (opcional):
    {
        "context": {
            "page": "materiales",
            "solicitud_id": 123
        }
    }

    Response:
    {
        "ok": true,
        "session_id": "uuid-de-la-sesion",
        "greeting": "Buen dia! Soy Vertex..."
    }
    """
    if not VERTEX_AVAILABLE:
        return jsonify({
            "ok": False,
            "error": {"code": "vertex_not_available"},
        }), 503

    try:
        data = request.get_json() or {}
        context = data.get("context", {})

        user_id = g.user["id_spm"]
        user_name = g.user.get("nombre", "")

        memory = VertexMemory(user_id)
        session_id = memory.start_conversation(context)

        hour = datetime.now().hour
        greeting = get_greeting(hour, user_name)

        return jsonify({
            "ok": True,
            "session_id": session_id,
            "greeting": greeting,
        }), 200

    except Exception as e:
        logger.exception(f"Error iniciando sesion: {e}")
        return jsonify({
            "ok": False,
            "error": {"code": "session_error", "message": str(e)},
        }), 500


@bp.route("/session/resume", methods=["GET"])
@require_auth
def resume_session():
    """
    Intenta reanudar la ultima sesion activa del usuario.

    Response:
    {
        "ok": true,
        "session_id": "uuid-de-la-sesion",
        "messages": [...],
        "has_active_session": true
    }
    """
    if not VERTEX_AVAILABLE:
        return jsonify({
            "ok": False,
            "error": {"code": "vertex_not_available"},
        }), 503

    try:
        from backend.core.db import get_db_connection

        user_id = g.user["id_spm"]

        # Verificar si las tablas existen
        if not _check_vertex_tables():
            return jsonify({
                "ok": True,
                "has_active_session": False,
                "session_id": None,
                "messages": [],
                "tables_exist": False,
            }), 200

        # Buscar ultima sesion activa
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT session_id FROM vertex_conversations
                WHERE user_id = ? AND ended_at IS NULL
                ORDER BY started_at DESC
                LIMIT 1
                """,
                (user_id,),
            )
            row = cursor.fetchone()

        if not row:
            return jsonify({
                "ok": True,
                "has_active_session": False,
                "session_id": None,
                "messages": [],
            }), 200

        session_id = str(row["session_id"] if isinstance(row, dict) else row[0])

        # Obtener mensajes de la sesion
        memory = VertexMemory(user_id)
        memory.resume_conversation(session_id)
        messages = memory.get_conversation_history(limit=20)

        return jsonify({
            "ok": True,
            "has_active_session": True,
            "session_id": session_id,
            "messages": [m.to_dict() for m in messages],
        }), 200

    except Exception as e:
        logger.exception(f"Error reanudando sesion: {e}")
        return jsonify({
            "ok": False,
            "error": {"code": "resume_error", "message": str(e)},
        }), 500


@bp.route("/history", methods=["GET"])
@require_auth
def get_history():
    """
    Obtiene historial de conversaciones del usuario.

    Query params:
    - limit: Numero maximo de conversaciones (default: 10)

    Response:
    {
        "ok": true,
        "conversations": [
            {
                "session_id": "uuid",
                "started_at": "2024-01-15T10:30:00",
                "ended_at": "2024-01-15T10:45:00",
                "summary": "Consulta sobre bombas de agua",
                "message_count": 8
            }
        ],
        "total": 15
    }
    """
    try:
        from backend.core.db import get_db_connection

        user_id = g.user["id_spm"]
        limit = request.args.get("limit", 10, type=int)

        # Verificar si las tablas existen
        if not _check_vertex_tables():
            return jsonify({
                "ok": True,
                "conversations": [],
                "total": 0,
                "tables_exist": False,
            }), 200

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Obtener conversaciones con conteo de mensajes
            cursor.execute(
                """
                SELECT
                    vc.session_id,
                    vc.started_at,
                    vc.ended_at,
                    vc.summary,
                    COUNT(vm.id) as message_count
                FROM vertex_conversations vc
                LEFT JOIN vertex_messages vm ON vc.id = vm.conversation_id
                WHERE vc.user_id = ?
                GROUP BY vc.id, vc.session_id, vc.started_at, vc.ended_at, vc.summary
                ORDER BY vc.started_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            )
            rows = cursor.fetchall()

            # Obtener total
            cursor.execute(
                "SELECT COUNT(*) FROM vertex_conversations WHERE user_id = ?",
                (user_id,),
            )
            total_row = cursor.fetchone()
            total = total_row["count"] if isinstance(total_row, dict) else total_row[0] if total_row else 0

        conversations = []
        for row in rows:
            conversations.append({
                "session_id": str(row["session_id"] if isinstance(row, dict) else row[0]),
                "started_at": row["started_at"] if isinstance(row, dict) else row[1],
                "ended_at": row["ended_at"] if isinstance(row, dict) else row[2],
                "summary": row["summary"] if isinstance(row, dict) else row[3],
                "message_count": row["message_count"] if isinstance(row, dict) else row[4],
            })

        return jsonify({
            "ok": True,
            "conversations": conversations,
            "total": total,
        }), 200

    except Exception as e:
        logger.exception(f"Error obteniendo historial: {e}")
        return jsonify({
            "ok": False,
            "error": {"code": "history_error", "message": str(e)},
        }), 500
