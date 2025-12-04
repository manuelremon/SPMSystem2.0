"""
Rutas API para Sistema de Mensajería Bidireccional

Endpoints:
- GET /api/mensajes/inbox - Bandeja de entrada
- GET /api/mensajes/outbox - Bandeja de salida
- GET /api/mensajes/:id/thread - Hilo de conversación
- POST /api/mensajes - Enviar nuevo mensaje
- POST /api/mensajes/:id/reply - Responder mensaje
- POST /api/mensajes/:id/mark-read - Marcar como leído
- DELETE /api/mensajes/:id - Eliminar mensaje
- GET /api/mensajes/unread-count - Contador de no leídos
"""

from flask import Blueprint, jsonify, request

try:
    from backend_v2.routes.auth import _decode_token
    from backend_v2.services.message_service import MessageService
except ImportError:
    from routes.auth import _decode_token
    from services.message_service import MessageService


bp = Blueprint("mensajes", __name__, url_prefix="/api/mensajes")


def _get_user_from_token():
    """
    Extraer user_id del token de autorización.

    Soporta:
    - Authorization: Bearer <token> header
    - spm_token cookie

    _decode_token maneja ambos casos internamente.
    """
    # _decode_token busca en header Authorization o en cookie
    payload = _decode_token(expected_type="access", cookie_name="spm_token")

    # _decode_token retorna tuple (response, status) en error, dict en éxito
    if isinstance(payload, tuple):
        return None

    if not isinstance(payload, dict):
        return None

    return payload.get("sub") or payload.get("user_id")


@bp.route("/inbox", methods=["GET"])
def get_inbox():
    """
    Obtener bandeja de entrada del usuario

    Query params:
    - unread_only: bool - Solo no leídos (default: false)
    - limit: int - Cantidad máxima (default: 50, max: 100)
    - offset: int - Offset para paginación (default: 0)

    Returns:
        JSON con lista de mensajes recibidos
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    unread_only = request.args.get("unread_only", "false").lower() == "true"
    limit = min(int(request.args.get("limit", 50)), 100)
    offset = int(request.args.get("offset", 0))

    messages = MessageService.get_inbox(
        user_id=user_id, unread_only=unread_only, limit=limit, offset=offset
    )

    unread_count = MessageService.get_unread_count(user_id)

    return (
        jsonify(
            {"ok": True, "total": len(messages), "unread_count": unread_count, "messages": messages}
        ),
        200,
    )


@bp.route("/outbox", methods=["GET"])
def get_outbox():
    """
    Obtener bandeja de salida del usuario

    Query params:
    - limit: int - Cantidad máxima (default: 50, max: 100)
    - offset: int - Offset para paginación (default: 0)

    Returns:
        JSON con lista de mensajes enviados
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    limit = min(int(request.args.get("limit", 50)), 100)
    offset = int(request.args.get("offset", 0))

    messages = MessageService.get_outbox(user_id=user_id, limit=limit, offset=offset)

    return jsonify({"ok": True, "total": len(messages), "messages": messages}), 200


@bp.route("/<int:message_id>/thread", methods=["GET"])
def get_thread(message_id):
    """
    Obtener hilo de conversación completo

    Args:
        message_id: ID del mensaje original

    Returns:
        JSON con mensaje original y todas las respuestas
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    thread = MessageService.get_thread(message_id, user_id)

    if not thread:
        return jsonify({"ok": False, "error": "Thread not found or unauthorized"}), 404

    return jsonify({"ok": True, "thread": thread}), 200


@bp.route("", methods=["POST"])
def send_message():
    """
    Enviar un nuevo mensaje

    Body:
    {
        "destinatario_id": "user123",
        "asunto": "Asunto del mensaje",
        "mensaje": "Contenido del mensaje",
        "solicitud_id": 1 (opcional),
        "tipo": "mensaje" (opcional),
        "metadata": {} (opcional)
    }

    Returns:
        JSON con confirmación y ID del mensaje
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}

    # Validar campos requeridos
    if not data.get("destinatario_id"):
        return jsonify({"ok": False, "error": "destinatario_id es requerido"}), 400

    if not data.get("asunto"):
        return jsonify({"ok": False, "error": "asunto es requerido"}), 400

    if not data.get("mensaje"):
        return jsonify({"ok": False, "error": "mensaje es requerido"}), 400

    message_id = MessageService.send_message(
        remitente_id=user_id,
        destinatario_id=data["destinatario_id"],
        asunto=data["asunto"],
        mensaje=data["mensaje"],
        solicitud_id=data.get("solicitud_id"),
        tipo=data.get("tipo", "mensaje"),
        metadata=data.get("metadata"),
    )

    if message_id:
        return (
            jsonify(
                {"ok": True, "message_id": message_id, "message": "Mensaje enviado correctamente"}
            ),
            201,
        )
    else:
        return jsonify({"ok": False, "error": "Error al enviar mensaje"}), 500


@bp.route("/<int:message_id>/reply", methods=["POST"])
def reply_message(message_id):
    """
    Responder a un mensaje (crea mensaje en el thread)

    Args:
        message_id: ID del mensaje al que se responde

    Body:
    {
        "mensaje": "Contenido de la respuesta"
    }

    Returns:
        JSON con confirmación y ID de la respuesta
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}

    if not data.get("mensaje"):
        return jsonify({"ok": False, "error": "mensaje es requerido"}), 400

    # Obtener el mensaje original para determinar destinatario y asunto
    thread = MessageService.get_thread(message_id, user_id)
    if not thread:
        return jsonify({"ok": False, "error": "Mensaje original no encontrado"}), 404

    original_message = thread[0]

    # El destinatario es el remitente del mensaje original
    # (a menos que YO sea el remitente, en cuyo caso respondo al destinatario original)
    if original_message["remitente_id"] == user_id:
        destinatario_id = original_message["destinatario_id"]
    else:
        destinatario_id = original_message["remitente_id"]

    # Crear la respuesta
    reply_id = MessageService.send_message(
        remitente_id=user_id,
        destinatario_id=destinatario_id,
        asunto=f"Re: {original_message['asunto']}",
        mensaje=data["mensaje"],
        solicitud_id=original_message.get("solicitud_id"),
        parent_id=message_id,
        tipo=original_message.get("tipo", "mensaje"),
    )

    if reply_id:
        return (
            jsonify(
                {"ok": True, "reply_id": reply_id, "message": "Respuesta enviada correctamente"}
            ),
            201,
        )
    else:
        return jsonify({"ok": False, "error": "Error al enviar respuesta"}), 500


@bp.route("/<int:message_id>/mark-read", methods=["POST"])
def mark_as_read(message_id):
    """
    Marcar mensaje como leído

    Args:
        message_id: ID del mensaje

    Returns:
        JSON con confirmación
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    success = MessageService.mark_as_read(message_id, user_id)

    if success:
        return jsonify({"ok": True, "message": "Mensaje marcado como leído"}), 200
    else:
        return jsonify({"ok": False, "error": "Mensaje no encontrado o ya leído"}), 404


@bp.route("/<int:message_id>", methods=["DELETE"])
def delete_message(message_id):
    """
    Eliminar mensaje

    Args:
        message_id: ID del mensaje

    Returns:
        JSON con confirmación
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    success = MessageService.delete_message(message_id, user_id)

    if success:
        return jsonify({"ok": True, "message": "Mensaje eliminado correctamente"}), 200
    else:
        return jsonify({"ok": False, "error": "Mensaje no encontrado"}), 404


@bp.route("/unread-count", methods=["GET"])
def get_unread_count():
    """
    Obtener cantidad de mensajes no leídos

    Returns:
        JSON con contador de no leídos
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    count = MessageService.get_unread_count(user_id)

    return jsonify({"ok": True, "unread_count": count}), 200
