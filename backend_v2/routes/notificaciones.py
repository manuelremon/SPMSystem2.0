"""
Rutas API para Notificaciones en Tiempo Real

Endpoints:
- GET /api/notificaciones - Listar notificaciones del usuario
- POST /api/notificaciones/:id/marcar-leida - Marcar como leída
- POST /api/notificaciones/marcar-todas-leidas - Marcar todas como leídas
- DELETE /api/notificaciones/:id - Eliminar notificación
- GET /api/notificaciones/stream - Server-Sent Events para tiempo real
"""

import json
import time

from flask import Blueprint, Response, jsonify, request, stream_with_context

try:
    from backend_v2.core.notification_schemas import NotificacionEvent
    from backend_v2.routes.auth import _decode_token
    from backend_v2.services.notification_service import NotificationService
except ImportError:
    from core.notification_schemas import NotificacionEvent
    from routes.auth import _decode_token
    from services.notification_service import NotificationService


bp = Blueprint("notificaciones", __name__, url_prefix="/api/notificaciones")


def _get_user_from_token():
    """
    Extract user_id from request using the standard _decode_token helper.

    Supports both:
    - Authorization: Bearer <token> header
    - spm_token cookie

    Returns:
        str: user_id if valid token found
        None: if no valid token
    """
    # _decode_token uses cookie_name to get token from either header or cookie
    payload = _decode_token(expected_type="access", cookie_name="spm_token")

    # _decode_token returns tuple (response, status_code) on error, dict on success
    if isinstance(payload, tuple):
        return None

    if not isinstance(payload, dict):
        return None

    return payload.get("sub") or payload.get("user_id")


@bp.route("", methods=["GET"])
def list_notifications():
    """
    Listar notificaciones del usuario autenticado.

    Query params:
    - unread_only: bool - Solo no leídas (default: false)
    - limit: int - Cantidad máxima (default: 50, max: 100)

    Returns:
        JSON con lista de notificaciones y contador de no leídas
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    unread_only = request.args.get("unread_only", "false").lower() == "true"
    limit = min(int(request.args.get("limit", 50)), 100)

    notifications = NotificationService.get_user_notifications(
        user_id=user_id, unread_only=unread_only, limit=limit
    )

    unread_count = NotificationService.get_unread_count(user_id)

    return jsonify(
        {
            "ok": True,
            "total": len(notifications),
            "unread_count": unread_count,
            "notifications": notifications,
        }
    )


@bp.route("/<int:notification_id>/marcar-leida", methods=["POST"])
def mark_as_read(notification_id):
    """
    Marcar una notificación como leída.

    Args:
        notification_id: ID de la notificación

    Returns:
        JSON con confirmación
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    success = NotificationService.mark_as_read(notification_id, user_id)

    if success:
        return jsonify({"ok": True, "message": "Notificación marcada como leída"})
    else:
        return jsonify({"ok": False, "error": "Notificación no encontrada"}), 404


@bp.route("/marcar-todas-leidas", methods=["POST"])
def mark_all_as_read():
    """
    Marcar todas las notificaciones del usuario como leídas.

    Returns:
        JSON con cantidad de notificaciones marcadas
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    count = NotificationService.mark_all_as_read(user_id)

    return jsonify(
        {"ok": True, "message": f"{count} notificaciones marcadas como leídas", "count": count}
    )


@bp.route("/<int:notification_id>", methods=["DELETE"])
def delete_notification(notification_id):
    """
    Eliminar una notificación.

    Args:
        notification_id: ID de la notificación

    Returns:
        JSON con confirmación
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    success = NotificationService.delete_notification(notification_id, user_id)

    if success:
        return jsonify({"ok": True, "message": "Notificación eliminada"})
    else:
        return jsonify({"ok": False, "error": "Notificación no encontrada"}), 404


@bp.route("/stream", methods=["GET"])
def notification_stream():
    """
    Server-Sent Events endpoint para notificaciones en tiempo real.

    Mantiene una conexión abierta y envía notificaciones nuevas al cliente.

    Headers required:
    - Authorization: Bearer <token>

    Returns:
        SSE stream con eventos de notificaciones
    """
    user_id = _get_user_from_token()
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    def generate():
        """
        Generador de eventos SSE.

        Envia:
        1. Heartbeat cada 30 segundos para mantener conexión
        2. Nuevas notificaciones cuando se crean

        Nota: En producción, esto debería usar Redis pub/sub o similar
        para escalar horizontalmente. Esta implementación es básica
        y funciona solo con un worker.
        """
        # Enviar evento inicial de conexión
        yield f"data: {json.dumps({'type': 'connected', 'user_id': user_id})}\n\n"

        last_check = time.time()
        last_notification_id = 0

        # Obtener el último ID de notificación
        notifications = NotificationService.get_user_notifications(user_id, limit=1)
        if notifications:
            last_notification_id = notifications[0]["id"]

        while True:
            current_time = time.time()

            # Heartbeat cada 30 segundos
            if current_time - last_check >= 30:
                yield ": heartbeat\n\n"
                last_check = current_time

            # Verificar nuevas notificaciones (polling cada 2 segundos)
            # En producción, usar Redis pub/sub
            time.sleep(2)

            new_notifications = NotificationService.get_user_notifications(user_id, limit=10)

            for notif in new_notifications:
                if notif["id"] > last_notification_id:
                    # Nueva notificación detectada
                    event = NotificacionEvent(
                        event="notification",
                        data={
                            "id": notif["id"],
                            "mensaje": notif["mensaje"],
                            "tipo": notif["tipo"],
                            "solicitud_id": notif["solicitud_id"],
                            "created_at": notif["created_at"],
                        },
                    )
                    yield event.to_sse_format()
                    last_notification_id = notif["id"]

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Nginx
            "Connection": "keep-alive",
        },
    )


@bp.route("/test", methods=["POST"])
def create_test_notification():
    """
    Endpoint de prueba para crear notificaciones manualmente.

    Body:
    {
        "destinatario_id": "user123",
        "mensaje": "Test notification",
        "tipo": "info"
    }

    Solo para desarrollo/testing.
    """
    data = request.get_json()

    notification_id = NotificationService.create_notification(
        destinatario_id=data.get("destinatario_id"),
        mensaje=data.get("mensaje", "Test notification"),
        tipo=data.get("tipo", "info"),
        solicitud_id=data.get("solicitud_id"),
    )

    if notification_id:
        return jsonify(
            {
                "ok": True,
                "notification_id": notification_id,
                "message": "Notificación de prueba creada",
            }
        )
    else:
        return jsonify({"ok": False, "error": "Error al crear notificación"}), 500
