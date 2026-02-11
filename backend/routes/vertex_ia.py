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

        # =================================================================
        # Construir system prompt con contexto (va como system_instruction)
        # =================================================================
        system_parts = [VERTEX_SYSTEM_PROMPT, context_info]
        if rag_context:
            system_parts.append(rag_context)
        if material_restriction:
            system_parts.append(material_restriction)

        system_prompt = "\n".join(system_parts)

        # =================================================================
        # Construir mensajes multi-turno para Gemini
        # =================================================================
        chat_messages = []

        # Historial de conversacion como mensajes reales
        for msg in history:
            chat_messages.append({
                "role": msg["role"],
                "content": msg["content"][:2000] if msg["content"] else "",
            })

        # Si el ultimo mensaje del historial ya es el user_message actual,
        # no duplicar (memory.add_message ya lo agrego)
        if not chat_messages or chat_messages[-1]["content"] != user_message:
            chat_messages.append({"role": "user", "content": user_message})

        # Generar respuesta con Gemini (o fallback a otro LLM)
        try:
            client = get_llm_client(provider="auto")

            # Clasificar query para ajustar temperature
            query_type = _classify_query(user_message)
            # Datos: temperature baja. Conversacion: mas alta
            if query_type in ("material", "stock", "mrp", "presupuesto", "solicitud", "sla"):
                temperature = 0.3 if has_real_context else 0.1
            else:
                temperature = 0.7

            # Limitar max_tokens segun complejidad (evitar timeouts)
            max_tokens = 2048 if query_type in ("mrp", "sla") else 4096

            logger.info(
                f"=== VERTEX CHAT === LLM: {type(client).__name__}, "
                f"msgs: {len(chat_messages)}, type: {query_type}, "
                f"sys_len: {len(system_prompt)}, temp: {temperature}"
            )

            # Usar generate_chat si es GeminiClient (multi-turno nativo)
            from backend.agent.rag.gemini_client import GeminiClient
            if isinstance(client, GeminiClient):
                response_text = client.generate_chat(
                    messages=chat_messages,
                    system_prompt=system_prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
            else:
                # Fallback para otros LLMs: concatenar como antes
                history_text = _format_history(history)
                full_prompt = f"""Contexto:\n{context_info}{rag_context}{material_restriction}

HISTORIAL:
{history_text}

MENSAJE ACTUAL: {user_message}

Responde como Vertex IA:"""
                response_text = client.generate(
                    prompt=full_prompt,
                    system_prompt=VERTEX_SYSTEM_PROMPT,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )

            logger.info(f"Response ({len(response_text)} chars): {response_text[:200]}")

            # Solo cachear respuestas con contexto real
            if has_real_context and not _is_user_specific_query(user_message):
                _set_cached_response(cache_key, response_text)

        except Exception as e:
            logger.exception(f"Error generando con LLM: {e}")
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
    """Formatea historial para el prompt. Preserva mensajes completos recientes."""
    if not history:
        return "(Sin historial previo)"

    lines = []
    msgs = history[-10:]
    for i, msg in enumerate(msgs):
        role = "Usuario" if msg["role"] == "user" else "Vertex"
        # Mensajes recientes (ultimos 4) sin truncar, anteriores a 2000 chars
        if i >= len(msgs) - 4:
            content = msg["content"]
        else:
            content = msg["content"][:2000]
        lines.append(f"{role}: {content}")

    return "\n".join(lines)


# =============================================================================
# Funciones de Inteligencia (RAG, Contexto, Aprendizaje)
# =============================================================================

# Keywords por tipo de consulta para clasificacion
QUERY_KEYWORDS = {
    "material": [
        "material", "bomba", "repuesto", "busco", "necesito",
        "valvula", "motor", "filtro", "sensor", "cable", "tornillo",
        "pieza", "componente", "herramienta", "equipo",
        "junta", "empaquetadura", "gasket", "brida", "codo", "tubo",
        "acero", "inoxidable", "hierro", "cobre", "aluminio",
        "pulgadas", "serie", "espiralada", "espiral", "comprar", "quiero",
    ],
    "stock": [
        "stock", "disponible", "inventario", "cantidad", "cuanto hay",
        "deposito", "almacen", "existencia", "disponibilidad",
    ],
    "solicitud": [
        "solicitud", "pedido", "orden", "estado de mi", "seguimiento",
        "aprobada", "rechazada", "pendiente",
    ],
    "presupuesto": [
        "presupuesto", "budget", "plata", "dinero", "monto",
        "cuanto queda", "disponible presupuesto",
    ],
    "mrp": [
        "mrp", "reposicion", "punto de pedido", "stock critico",
        "alerta", "reorden", "eoq", "stock seguridad",
    ],
    "sla": [
        "sla", "tiempo", "urgente", "demora", "vence", "vencimiento",
        "plazo", "limite",
    ],
}

# Keywords que indican query especifica del usuario (no cachear)
USER_SPECIFIC_KEYWORDS = [
    "mi solicitud", "mis solicitudes", "mi pedido", "mis pedidos",
    "mi presupuesto", "mi centro", "mi sector", "cuanto tengo",
    "pendiente", "estado de", "seguimiento",
]

# Regex para codigos SAP reales: XXXX-XXXXXXX (ej: 0915-0000632)
SAP_CODE_REGEX = re.compile(r'\b\d{4}-\d{7}\b')
# Formato alternativo: 7-10 digitos seguidos
SAP_CODE_ALT_REGEX = re.compile(r'\b\d{7,10}\b')


def _classify_query(message: str) -> str:
    """
    Clasifica el tipo de query para ajustar comportamiento.

    Returns:
        Tipo: 'material', 'stock', 'solicitud', 'presupuesto', 'mrp', 'sla', 'general'
    """
    msg_lower = message.lower()

    # Detectar codigo SAP directo -> material
    if SAP_CODE_REGEX.search(message) or SAP_CODE_ALT_REGEX.search(message):
        return "material"

    # Clasificar por keywords con scoring
    scores = {}
    for query_type, keywords in QUERY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in msg_lower)
        if score > 0:
            scores[query_type] = score

    if scores:
        return max(scores, key=scores.get)

    return "general"


def _is_material_query(message: str) -> bool:
    """Detecta si el mensaje es una consulta sobre materiales (no MRP/SLA/solicitud)."""
    query_type = _classify_query(message)
    # MRP, SLA, solicitud y presupuesto NO son queries de materiales
    # (no necesitan busqueda en catalogo, solo datos de BD transaccional)
    if query_type in ("mrp", "sla", "solicitud", "presupuesto"):
        return False
    # Material y stock queries necesitan busqueda en catalogo
    if query_type in ("material", "stock"):
        return True
    # Tambien si contiene un codigo SAP directo
    if SAP_CODE_REGEX.search(message):
        return True
    # Verificar keywords de precio/codigo que siempre son de materiales
    msg_lower = message.lower()
    return any(kw in msg_lower for kw in ["precio", "codigo", "sap"])


def _is_user_specific_query(message: str) -> bool:
    """Detecta si el mensaje es especifico del usuario (no cachear)."""
    msg_lower = message.lower()
    return any(kw in msg_lower for kw in USER_SPECIFIC_KEYWORDS)


def _get_rag_context(message: str) -> str:
    """
    Busca materiales relevantes en la BD y formatea para el prompt.
    Usa búsqueda directa en SQLite como fallback si RAG no está disponible.
    """
    # Primero intentar busqueda directa en BD (mas confiable, con stock y equivalencias)
    try:
        results = _search_materials_direct(message)
        if results:
            context = "\n\n" + "="*60 + "\n"
            context += "MATERIALES ENCONTRADOS EN EL CATALOGO SAP\n"
            context += "="*60 + "\n"
            context += "CODIGOS VALIDOS (solo podes usar estos):\n\n"
            for i, r in enumerate(results, 1):
                precio = r.get('precio', 0)
                precio_fmt = f"${precio:,.2f}" if precio else "Sin precio"
                stock = r.get('stock_total', 'Sin datos')
                stock_fmt = f"{stock} unidades" if isinstance(stock, (int, float)) else stock
                context += f"{i}. {r['codigo']} - {r['descripcion'][:80]}\n"
                context += f"   Precio: {precio_fmt} | Stock: {stock_fmt}\n"

                # Agregar equivalencias si existen
                equivs = r.get('equivalencias', [])
                if equivs:
                    equiv_strs = [f"{e['codigo']} ({e['tipo']})" for e in equivs[:2]]
                    context += f"   Equivalencias: {', '.join(equiv_strs)}\n"

            context += "\n" + "="*60 + "\n"
            context += "ATENCION: Si el usuario pide algo que NO esta en esta lista,\n"
            context += "deci que no lo encontraste y ofrece las opciones disponibles.\n"
            context += "NUNCA inventes codigos que no esten arriba.\n"
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
    Busqueda directa en SQLite con ranking de relevancia.
    Incluye datos de stock y equivalencias cuando estan disponibles.
    """
    import sqlite3

    # Extraer palabras clave significativas
    words = re.findall(r'\w+', query.lower())
    stopwords = {
        'de', 'la', 'el', 'en', 'un', 'una', 'los', 'las', 'que', 'por',
        'para', 'con', 'del', 'al', 'quiero', 'necesito', 'busco', 'comprar',
        'hay', 'tiene', 'donde', 'como', 'cual', 'cuanto', 'ver', 'mostrar',
        'dame', 'buscar', 'encontrar', 'material', 'materiales'
    }
    keywords = [w for w in words if len(w) > 2 and w not in stopwords]

    # Tambien buscar por codigo SAP directo
    sap_codes = SAP_CODE_REGEX.findall(query)
    sap_codes_alt = SAP_CODE_ALT_REGEX.findall(query)

    if not keywords and not sap_codes and not sap_codes_alt:
        return []

    try:
        from backend.core.db import get_master_materiales_db_path
        from pathlib import Path

        db_path = str(get_master_materiales_db_path())
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Verificar si la tabla existe
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='materiales'")
        if not cur.fetchone():
            conn.close()
            fallback_path = Path(db_path).parent / "catalogo_materiales.db"
            if fallback_path.exists():
                conn = sqlite3.connect(str(fallback_path))
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
            else:
                return []

        results = []

        # 1. Busqueda por codigo SAP exacto (maxima prioridad)
        for code in sap_codes + sap_codes_alt:
            cur.execute(
                """SELECT codigo, descripcion, COALESCE(precio_usd, 0) as precio
                   FROM materiales WHERE codigo = ? AND activo = 1""",
                (code,),
            )
            for row in cur.fetchall():
                results.append({**dict(row), "relevance": 100})

        # 2. Busqueda por keywords (si no encontramos por codigo)
        if not results and keywords:
            keywords = keywords[:5]

            conditions = []
            ranking_parts = []
            params = []
            for kw in keywords:
                kw_pattern = f'%{kw}%'
                conditions.append("(UPPER(descripcion) LIKE UPPER(?) OR UPPER(descripcion_larga) LIKE UPPER(?))")
                params.extend([kw_pattern, kw_pattern])
                ranking_parts.append("(CASE WHEN UPPER(descripcion) LIKE UPPER(?) THEN 2 ELSE 0 END)")
                ranking_parts.append("(CASE WHEN UPPER(descripcion_larga) LIKE UPPER(?) THEN 1 ELSE 0 END)")

            ranking_expr = " + ".join(ranking_parts) if ranking_parts else "0"

            ranking_params = []
            for kw in keywords:
                kw_pattern = f'%{kw}%'
                ranking_params.extend([kw_pattern, kw_pattern])

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
            cur.execute(sql, ranking_params + params)
            results = [dict(row) for row in cur.fetchall()]
            results = [r for r in results if r.get('relevance', 0) > 0]

        conn.close()

        # 3. Enriquecer con datos de stock (sap_data.db)
        if results:
            results = _enrich_with_stock(results)
            results = _enrich_with_equivalencias(results)

        logger.debug(f"Busqueda directa BD: {len(results)} resultados")
        return results

    except Exception as e:
        logger.warning(f"Error busqueda directa BD: {e}")
        return []


def _enrich_with_stock(materials: list) -> list:
    """Agrega datos de stock a los resultados de materiales."""
    import sqlite3
    try:
        from backend.core.db import get_sap_data_db_path
        db_path = str(get_sap_data_db_path())
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        for mat in materials:
            codigo = mat.get("codigo", "")
            cur.execute(
                """SELECT SUM(stock) as stock_total, centro, almacen
                   FROM stock WHERE material = ?
                   GROUP BY material LIMIT 1""",
                (codigo,),
            )
            row = cur.fetchone()
            if row:
                mat["stock_total"] = row["stock_total"] or 0
                mat["centro"] = row["centro"]
                mat["almacen"] = row["almacen"]
            else:
                mat["stock_total"] = "Sin datos"

        conn.close()
    except Exception as e:
        logger.debug(f"No se pudo enriquecer con stock: {e}")

    return materials


def _enrich_with_equivalencias(materials: list) -> list:
    """Agrega equivalencias disponibles a los resultados."""
    import sqlite3
    try:
        from backend.core.db import get_master_materiales_db_path
        db_path = str(get_master_materiales_db_path())
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Verificar si existe la tabla de equivalencias
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='materiales_equivalencias'")
        if not cur.fetchone():
            conn.close()
            return materials

        for mat in materials:
            codigo = mat.get("codigo", "")
            cur.execute(
                """SELECT material_equivalente, texto_breve_equivalente, tipo_equiv
                   FROM materiales_equivalencias
                   WHERE material_base = ?
                   LIMIT 3""",
                (codigo,),
            )
            equiv_rows = cur.fetchall()
            if equiv_rows:
                mat["equivalencias"] = [
                    {
                        "codigo": r["material_equivalente"],
                        "descripcion": r["texto_breve_equivalente"],
                        "tipo": r["tipo_equiv"],
                    }
                    for r in equiv_rows
                ]

        conn.close()
    except Exception as e:
        logger.debug(f"No se pudo enriquecer con equivalencias: {e}")

    return materials


def _get_user_data_context(user_id: str, message: str) -> str:
    """
    Obtiene datos relevantes del usuario para enriquecer el contexto.
    Incluye solicitudes, presupuesto, alertas MRP y SLA.
    """
    context_parts = []
    query_type = _classify_query(message)

    try:
        from backend.core.db import get_db_connection, sql_extract_year

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Obtener info basica del usuario (centro, rol)
            cursor.execute(
                "SELECT centros, roles, nombre FROM usuario WHERE id_spm = ?",
                (user_id,),
            )
            user_row = cursor.fetchone()
            user_centro = None
            if user_row:
                centros_val = user_row[0] if isinstance(user_row, (list, tuple)) else user_row.get("centros")
                if centros_val:
                    user_centro = centros_val.split(",")[0].strip() if "," in str(centros_val) else centros_val

            # === SOLICITUDES (si pregunta por solicitudes o general) ===
            if query_type in ("solicitud", "general") or any(
                kw in message.lower() for kw in ["solicitud", "pedido", "estado"]
            ):
                cursor.execute(
                    """
                    SELECT id, status, total_monto, created_at, criticidad
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
                        criticidad = sol[4] if isinstance(sol, (list, tuple)) else sol.get("criticidad", "")
                        line = f"  - #{sol_id} ({status})"
                        if monto:
                            line += f": ${monto:,.0f}"
                        if criticidad:
                            line += f" [{criticidad}]"
                        context_parts.append(line)

            # === PRESUPUESTO ===
            if query_type == "presupuesto" or any(
                kw in message.lower() for kw in ["presupuesto", "budget", "plata", "dinero"]
            ):
                if user_centro:
                    year_expr = sql_extract_year()
                    cursor.execute(
                        f"""
                        SELECT monto_total, monto_usado, monto_reservado
                        FROM presupuesto
                        WHERE centro = ? AND anio = {year_expr}
                        """,
                        (user_centro,),
                    )
                    budget = cursor.fetchone()
                    if budget:
                        total = budget[0] if isinstance(budget, (list, tuple)) else budget["monto_total"]
                        usado = budget[1] if isinstance(budget, (list, tuple)) else budget["monto_usado"]
                        reservado = budget[2] if isinstance(budget, (list, tuple)) else budget.get("monto_reservado", 0)
                        disponible = (total or 0) - (usado or 0) - (reservado or 0)
                        pct_usado = ((usado or 0) / total * 100) if total else 0
                        context_parts.append(f"Presupuesto del centro {user_centro}:")
                        context_parts.append(f"  - Total: ${total:,.0f}" if total else "  - Total: N/A")
                        context_parts.append(f"  - Usado: ${(usado or 0):,.0f} ({pct_usado:.0f}%)")
                        context_parts.append(f"  - Disponible: ${disponible:,.0f}")
                        if pct_usado > 80:
                            context_parts.append("  - ALERTA: Mas del 80% del presupuesto ya fue utilizado")

            # === ALERTAS MRP (si pregunta por MRP, stock critico o alertas) ===
            if query_type in ("mrp", "stock") or any(
                kw in message.lower() for kw in ["alerta", "critico", "reposicion", "mrp"]
            ):
                try:
                    # Usar query simple sin OR condicional (problematico en PostgreSQL)
                    if user_centro:
                        cursor.execute(
                            """
                            SELECT material_codigo, tipo, severidad, mensaje
                            FROM alertas_mrp
                            WHERE estado = 'activa' AND centro = ?
                            ORDER BY
                                CASE severidad WHEN 'danger' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END
                            LIMIT 5
                            """,
                            (user_centro,),
                        )
                    else:
                        cursor.execute(
                            """
                            SELECT material_codigo, tipo, severidad, mensaje
                            FROM alertas_mrp
                            WHERE estado = 'activa'
                            ORDER BY
                                CASE severidad WHEN 'danger' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END
                            LIMIT 5
                            """,
                        )
                    alertas = cursor.fetchall()
                    if alertas:
                        context_parts.append("Alertas MRP activas:")
                        for al in alertas:
                            codigo = al[0] if isinstance(al, (list, tuple)) else al["material_codigo"]
                            tipo = al[1] if isinstance(al, (list, tuple)) else al["tipo"]
                            sev = al[2] if isinstance(al, (list, tuple)) else al["severidad"]
                            msg = al[3] if isinstance(al, (list, tuple)) else al["mensaje"]
                            context_parts.append(f"  - [{sev.upper()}] {codigo}: {tipo} - {(msg or '')[:80]}")
                    else:
                        context_parts.append("No hay alertas MRP activas en este momento.")
                except Exception as e:
                    logger.debug(f"Error consultando alertas MRP: {e}")

            # === SLA (si pregunta por tiempos, urgencias, vencimientos) ===
            if query_type == "sla" or any(
                kw in message.lower() for kw in ["sla", "vence", "urgente", "demora", "plazo"]
            ):
                try:
                    cursor.execute(
                        """
                        SELECT sa.solicitud_id, sa.tipo, sa.fecha_vencimiento,
                               sa.tiempo_transcurrido_horas, sa.tiempo_objetivo_horas
                        FROM sla_alertas sa
                        JOIN solicitud s ON s.id = sa.solicitud_id
                        WHERE s.id_usuario = ? AND sa.estado = 'activa'
                        ORDER BY sa.fecha_vencimiento ASC
                        LIMIT 5
                        """,
                        (user_id,),
                    )
                    sla_alertas = cursor.fetchall()
                    if sla_alertas:
                        context_parts.append("Alertas SLA del usuario:")
                        for sa in sla_alertas:
                            sol_id = sa[0] if isinstance(sa, (list, tuple)) else sa["solicitud_id"]
                            tipo = sa[1] if isinstance(sa, (list, tuple)) else sa["tipo"]
                            venc = sa[2] if isinstance(sa, (list, tuple)) else sa["fecha_vencimiento"]
                            transcurrido = sa[3] if isinstance(sa, (list, tuple)) else sa["tiempo_transcurrido_horas"]
                            objetivo = sa[4] if isinstance(sa, (list, tuple)) else sa["tiempo_objetivo_horas"]
                            context_parts.append(
                                f"  - Solicitud #{sol_id}: {tipo} - "
                                f"Vence: {venc}, {transcurrido:.0f}h/{objetivo}h"
                            )
                    else:
                        context_parts.append("No hay alertas SLA activas.")
                except Exception as e:
                    logger.debug(f"Error consultando alertas SLA: {e}")

    except Exception as e:
        logger.warning(f"Error obteniendo contexto del usuario: {e}")

    return "\n".join(context_parts) if context_parts else ""


def _learn_from_message(memory: VertexMemory, user_msg: str, response: str):
    """
    Extrae y guarda informacion util de la conversacion.
    Delega al metodo learn_from_conversation de VertexMemory.
    """
    try:
        memory.learn_from_conversation(user_msg, response)
    except Exception as e:
        logger.warning(f"Error en aprendizaje de mensaje: {e}")


# =============================================================================
# Sugerencias Contextuales
# =============================================================================


def _get_greeting_context(user_id: str) -> Optional[dict]:
    """Obtiene datos del usuario para personalizar el saludo."""
    try:
        from backend.core.db import get_db_connection
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Solicitudes pendientes
            cursor.execute(
                """SELECT COUNT(*) FROM solicitud
                   WHERE id_usuario = ? AND status NOT IN ('closed', 'rejected', 'cancelled')""",
                (user_id,),
            )
            row = cursor.fetchone()
            pending = row[0] if isinstance(row, (list, tuple)) else (row.get("count", 0) if row else 0)

            # Alertas MRP activas
            alertas = 0
            try:
                cursor.execute(
                    "SELECT COUNT(*) FROM alertas_mrp WHERE estado = 'activa'"
                )
                al_row = cursor.fetchone()
                alertas = al_row[0] if isinstance(al_row, (list, tuple)) else (al_row.get("count", 0) if al_row else 0)
            except Exception:
                pass

            if pending or alertas:
                return {
                    "pending_solicitudes": pending,
                    "alertas_count": alertas,
                }
    except Exception as e:
        logger.debug(f"Error obteniendo contexto para greeting: {e}")

    return None


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
        greeting_context = None
        if hasattr(g, "user") and g.user:
            user_name = g.user.get("nombre", "")
            user_id = g.user.get("id_spm")

            # Obtener contexto para greeting personalizado
            if user_id:
                greeting_context = _get_greeting_context(user_id)

        # Generar saludo contextual
        greeting = get_greeting(hour, user_name, user_context=greeting_context)

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
