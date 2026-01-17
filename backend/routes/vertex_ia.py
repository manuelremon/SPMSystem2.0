"""
Rutas API para Vertex IA - Asistente conversacional con Gemini.

Endpoints:
- POST /api/vertex/chat - Enviar mensaje al chat
- GET  /api/vertex/suggestions - Obtener sugerencias contextuales
- GET  /api/vertex/alerts - Obtener alertas proactivas
- POST /api/vertex/alerts/<id>/dismiss - Descartar alerta
- POST /api/vertex/session/start - Iniciar nueva sesion
- GET  /api/vertex/session/resume - Reanudar sesion existente
- GET  /api/vertex/history - Historial de conversaciones
- GET  /api/vertex/status - Estado del servicio
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List

from flask import Blueprint, g, jsonify, request

try:
    from backend.core.roles import require_auth
    from backend.core.rate_limit import rate_limit
except ImportError:
    from core.roles import require_auth
    from core.rate_limit import rate_limit

# Importar componentes de Vertex IA
try:
    from backend.agent.core.vertex_memory import VertexMemory
    from backend.agent.rag.vertex_prompts import (
        VERTEX_SYSTEM_PROMPT,
        VERTEX_SEARCH_PROMPT,
        get_page_suggestions,
        get_greeting,
    )
    from backend.agent.rag.llm_client import get_llm_client
    VERTEX_AVAILABLE = True
except ImportError as e:
    VERTEX_AVAILABLE = False
    import_error = str(e)

logger = logging.getLogger(__name__)

bp = Blueprint("vertex_ia", __name__, url_prefix="/api/vertex")


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

    return jsonify({
        "ok": True,
        "service": "vertex_ia",
        "available": VERTEX_AVAILABLE,
        "gemini_configured": bool(gemini_key),
        "features": {
            "chat": VERTEX_AVAILABLE and bool(gemini_key),
            "memory": VERTEX_AVAILABLE,
            "proactive_alerts": VERTEX_AVAILABLE,
        },
        "error": None if VERTEX_AVAILABLE else import_error,
    }), 200


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
        if user_context:
            context_info = f"\n\nInformacion del usuario:\n{user_context}"

        full_prompt = f"""{VERTEX_SYSTEM_PROMPT}{context_info}

Historial de conversacion:
{_format_history(history)}

Nuevo mensaje del usuario: {user_message}

Responde como Vertex IA:"""

        # Generar respuesta con Gemini
        try:
            client = get_llm_client(provider="gemini")
            response_text = client.generate(
                prompt=full_prompt,
                max_tokens=1024,
                temperature=0.7,
            )
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
    for msg in history[-6:]:  # Ultimos 6 mensajes
        role = "Usuario" if msg["role"] == "user" else "Vertex"
        content = msg["content"][:200]  # Truncar mensajes largos
        lines.append(f"{role}: {content}")

    return "\n".join(lines)


def _learn_from_message(memory: VertexMemory, user_msg: str, response: str):
    """Extrae y guarda informacion util de la conversacion."""
    # Detectar si pregunta por materiales especificos
    # En el futuro: usar NLP para extraer entidades
    pass


# =============================================================================
# Sugerencias Contextuales
# =============================================================================


@bp.route("/suggestions", methods=["GET"])
@require_auth
def get_suggestions():
    """
    Obtiene sugerencias contextuales basadas en la pagina actual.

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
        user_id = g.user["id_spm"]
        user_name = g.user.get("nombre", "")

        # Obtener hora actual para saludo
        hour = datetime.now().hour

        # Generar saludo
        greeting = get_greeting(hour, user_name)

        # Obtener sugerencias para la pagina
        suggestions = get_page_suggestions(page)

        # Personalizar con memoria si existe
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
@require_auth
def get_alerts():
    """
    Obtiene alertas proactivas pendientes para el usuario.

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

    try:
        from backend.core.db import get_db_connection

        user_id = g.user["id_spm"]

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
        from backend.core.db import get_db_transaction

        user_id = g.user["id_spm"]

        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE vertex_proactive_alerts
                SET dismissed_at = NOW()
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
        from backend.core.db import get_db_transaction

        user_id = g.user["id_spm"]

        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE vertex_proactive_alerts
                SET shown_at = NOW()
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
                GROUP BY vc.id
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
