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

from flask import Blueprint, Response, g, jsonify, request, stream_with_context

from backend.core.notification_schemas import NotificacionEvent
from backend.core.roles import require_auth
from backend.services.notification_service import NotificationService


bp = Blueprint("notificaciones", __name__, url_prefix="/api/notificaciones")


@bp.route("", methods=["GET"])
@require_auth
def list_notifications():
    """
    Listar notificaciones del usuario autenticado.

    Query params:
    - unread_only: bool - Solo no leídas (default: false)
    - limit: int - Cantidad máxima (default: 50, max: 100)

    Returns:
        JSON con lista de notificaciones y contador de no leídas
    """
    user_id = g.user.get("user_id")

    unread_only = request.args.get("unread_only", "false").lower() == "true"
    limit = min(int(request.args.get("limit", 50)), 100)

    # FIX 3.13: Usar método combinado para optimizar queries
    notifications, unread_count = NotificationService.get_user_notifications_with_count(
        user_id=user_id, unread_only=unread_only, limit=limit
    )

    return jsonify(
        {
            "ok": True,
            "total": len(notifications),
            "unread_count": unread_count,
            "notifications": notifications,
        }
    )


@bp.route("/<int:notification_id>/marcar-leida", methods=["POST"])
@require_auth
def mark_as_read(notification_id):
    """
    Marcar una notificación como leída.

    Args:
        notification_id: ID de la notificación

    Returns:
        JSON con confirmación
    """
    user_id = g.user.get("user_id")

    success = NotificationService.mark_as_read(notification_id, user_id)

    if success:
        return jsonify({"ok": True, "message": "Notificación marcada como leída"})
    else:
        return jsonify({"ok": False, "error": "Notificación no encontrada"}), 404


@bp.route("/marcar-todas-leidas", methods=["POST"])
@require_auth
def mark_all_as_read():
    """
    Marcar todas las notificaciones del usuario como leídas.

    Returns:
        JSON con cantidad de notificaciones marcadas
    """
    user_id = g.user.get("user_id")

    count = NotificationService.mark_all_as_read(user_id)

    return jsonify(
        {"ok": True, "message": f"{count} notificaciones marcadas como leídas", "count": count}
    )


@bp.route("/<int:notification_id>", methods=["DELETE"])
@require_auth
def delete_notification(notification_id):
    """
    Eliminar una notificación.

    Args:
        notification_id: ID de la notificación

    Returns:
        JSON con confirmación
    """
    user_id = g.user.get("user_id")

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

    FIX 5.1: Ahora usa Redis pub/sub cuando está disponible para
    escalabilidad horizontal. Fallback automático a polling si Redis
    no está conectado.

    NOTE: SSE no puede usar @require_auth porque EventSource no envía
    headers de Authorization. Auth se maneja internamente.

    Returns:
        SSE stream con eventos de notificaciones
    """
    # SSE requiere auth manual (EventSource no envía headers)
    from backend.core.auth_middleware import _decode_token
    payload = _decode_token("access", "spm_token")
    if isinstance(payload, tuple):
        return payload  # Error response
    user_id = payload.get("user_id")
    if not user_id:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    # FIX 5.1: Importar Redis pub/sub
    try:
        from backend.core.redis_pubsub import redis_pubsub, is_redis_available
    except ImportError:
        from core.redis_pubsub import redis_pubsub, is_redis_available

    use_redis = is_redis_available()

    def generate_with_redis():
        """
        Generador SSE usando Redis pub/sub.

        Tiempo real verdadero - sin polling de BD.
        """
        # Evento inicial
        yield f"data: {json.dumps({'type': 'connected', 'user_id': user_id, 'mode': 'redis'})}\n\n"

        last_heartbeat = time.time()

        for message in redis_pubsub.subscribe_notifications(user_id, timeout=30.0):
            current_time = time.time()

            # Heartbeat si timeout
            if current_time - last_heartbeat >= 30:
                yield ": heartbeat\n\n"
                last_heartbeat = current_time

            if message is None:
                # Timeout de Redis - solo heartbeat
                continue

            # Notificación recibida de Redis
            event = NotificacionEvent(
                event="notification",
                data={
                    "id": message.get("id"),
                    "mensaje": message.get("mensaje"),
                    "tipo": message.get("tipo"),
                    "solicitud_id": message.get("solicitud_id"),
                    "created_at": message.get("created_at"),
                    "leido": message.get("leido", False),
                },
            )
            yield event.to_sse_format()
            last_heartbeat = current_time

    def generate_with_polling():
        """
        Generador SSE usando polling de BD.

        Fallback cuando Redis no está disponible.
        Polling cada 15 segundos para reducir carga.
        """
        # Evento inicial
        yield f"data: {json.dumps({'type': 'connected', 'user_id': user_id, 'mode': 'polling'})}\n\n"

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

            # Polling cada 15 segundos (reducción 92% vs 2s)
            time.sleep(15)

            new_notifications = NotificationService.get_user_notifications(user_id, limit=10)

            for notif in new_notifications:
                if notif["id"] > last_notification_id:
                    event = NotificacionEvent(
                        event="notification",
                        data={
                            "id": notif["id"],
                            "mensaje": notif["mensaje"],
                            "tipo": notif["tipo"],
                            "solicitud_id": notif["solicitud_id"],
                            "created_at": notif["created_at"],
                            "leido": notif.get("leido", False),
                        },
                    )
                    yield event.to_sse_format()
                    last_notification_id = notif["id"]

    # FIX 5.1: Usar Redis si disponible, sino fallback a polling
    generator = generate_with_redis if use_redis else generate_with_polling

    return Response(
        stream_with_context(generator()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Nginx
            "Connection": "keep-alive",
        },
    )


@bp.route("/centro-interaccion", methods=["GET"])
@require_auth
def centro_interaccion():
    """
    Datos consolidados para el Centro de Interacción.

    Retorna:
    - Contadores de notificaciones, consultas pendientes y mensajes
    - Timeline de actividad reciente
    """
    user_id = g.user.get("user_id")

    try:
        from backend.core.db import get_db_connection
    except ImportError:
        from core.db import get_db_connection

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            # 1. Notificaciones no leídas
            cur.execute(
                """
                SELECT COUNT(*) as count FROM notificaciones
                WHERE destinatario_id = ? AND leido = 0
                """,
                (user_id,),
            )
            notif_count = cur.fetchone()["count"]

            # 2. Consultas de stock pendientes (si es responsable/referente)
            cur.execute(
                """
                SELECT COUNT(*) as count
                FROM decision_abastecimiento_fuentes f
                JOIN decision_abastecimiento d ON d.id = f.decision_id
                LEFT JOIN config_almacenes ca
                    ON ca.centro = f.centro_origen AND ca.almacen = f.almacen_origen
                WHERE (f.estado_consulta = 'pendiente' OR f.estado_consulta IS NULL)
                  AND f.tipo_fuente IN ('stock', 'transferencia', 'equivalencia')
                  AND d.estado = 'esperando_confirmacion'
                  AND (
                      ca.responsable_id = ?
                      OR EXISTS (
                          SELECT 1 FROM usuarios u
                          WHERE u.id_spm = ?
                          AND f.centro_origen = ANY(string_to_array(u.centros, ','))
                          AND (u.rol LIKE '%%coordinador%%' OR u.rol LIKE '%%jefe%%')
                      )
                  )
                """,
                (user_id, user_id),
            )
            consultas_count = cur.fetchone()["count"]

            # 3. Mensajes no leídos
            cur.execute(
                """
                SELECT COUNT(*) as count FROM mensajes
                WHERE destinatario_id = ? AND leido = 0
                """,
                (user_id,),
            )
            mensajes_count = cur.fetchone()["count"]

            # 4. Timeline (últimas 20 interacciones)
            cur.execute(
                """
                SELECT 'notificacion' as tipo, mensaje as descripcion,
                       tipo as subtipo, created_at, solicitud_id
                FROM notificaciones WHERE destinatario_id = ?
                UNION ALL
                SELECT 'mensaje' as tipo, SUBSTR(mensaje, 1, 100) as descripcion,
                       'mensaje' as subtipo, created_at, solicitud_id
                FROM mensajes WHERE destinatario_id = ?
                ORDER BY created_at DESC LIMIT 20
                """,
                (user_id, user_id),
            )
            timeline = [dict(row) for row in cur.fetchall()]

        return jsonify(
            {
                "ok": True,
                "data": {
                    "notificaciones_count": notif_count,
                    "consultas_count": consultas_count,
                    "mensajes_count": mensajes_count,
                    "timeline": timeline,
                },
            }
        )

    except Exception as e:
        import logging

        logging.error(f"Error en centro-interaccion para {user_id}: {e}")
        return jsonify({"ok": False, "error": "Error interno"}), 500


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
