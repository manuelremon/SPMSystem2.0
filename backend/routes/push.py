"""
Push Notifications Routes
=========================
Endpoints para gestionar suscripciones de notificaciones push.

Endpoints:
- GET  /api/push/vapid-key    - Obtener clave publica VAPID
- POST /api/push/subscribe    - Registrar suscripcion
- POST /api/push/unsubscribe  - Cancelar suscripcion
- GET  /api/push/status       - Estado de suscripcion del usuario
- POST /api/push/test         - Enviar notificacion de prueba (dev only)
"""

import logging

from flask import Blueprint, jsonify, request

try:
    from backend.core.config import settings
    from backend.core.db import get_db_connection
    from backend.routes.auth import _decode_token
    from backend.services.push_service import (
        get_vapid_public_key,
        push_service,
        send_push_notification,
    )
except ImportError:
    from core.config import settings
    from core.db import get_db_connection
    from services.push_service import get_vapid_public_key, push_service, send_push_notification

    from routes.auth import _decode_token

logger = logging.getLogger(__name__)

bp = Blueprint("push", __name__, url_prefix="/api/push")


def _get_current_user():
    """Obtiene el usuario actual del token JWT."""
    payload = _decode_token("access", "spm_token")
    if isinstance(payload, tuple):
        return None, payload
    return payload.get("user_id"), None


def _is_admin(user_id: str) -> bool:
    """Verifica si el usuario tiene rol admin."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT rol FROM usuarios WHERE id_spm = ?", (user_id,))
            row = cursor.fetchone()
            if row:
                rol = row["rol"] if isinstance(row, dict) else row[0]
                return "admin" in (rol or "").lower()
    except Exception as e:
        logger.error(f"[PUSH] Error verificando rol admin: {e}")
    return False


@bp.route("/vapid-key", methods=["GET"])
def get_vapid_key():
    """
    Obtiene la clave publica VAPID.

    Esta clave se usa en el frontend para suscribirse a push notifications.
    No requiere autenticacion.

    Returns:
        {publicKey: string}
    """
    try:
        public_key = get_vapid_public_key()
        return jsonify({"ok": True, "publicKey": public_key}), 200
    except Exception as e:
        logger.error(f"[PUSH] Error obteniendo VAPID key: {e}")
        return jsonify({"ok": False, "error": "Error obteniendo clave VAPID"}), 500


@bp.route("/subscribe", methods=["POST"])
def subscribe():
    """
    Registra una suscripcion push.

    Body:
    {
        "endpoint": "https://fcm.googleapis.com/...",
        "keys": {
            "p256dh": "base64...",
            "auth": "base64..."
        }
    }

    Returns:
        {ok: bool, message: string}
    """
    user_id, error = _get_current_user()
    if error:
        return error

    data = request.get_json(silent=True) or {}

    # Validar campos requeridos
    endpoint = data.get("endpoint")
    keys = data.get("keys", {})
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")

    if not all([endpoint, p256dh, auth]):
        return (
            jsonify(
                {"ok": False, "error": "Faltan campos requeridos: endpoint, keys.p256dh, keys.auth"}
            ),
            400,
        )

    # Obtener user agent para debugging
    user_agent = request.headers.get("User-Agent")

    # Registrar suscripcion
    success = push_service.subscribe(
        user_id=user_id, endpoint=endpoint, p256dh=p256dh, auth=auth, user_agent=user_agent
    )

    if success:
        logger.info(f"[PUSH] Usuario {user_id} suscrito a push notifications")
        return jsonify({"ok": True, "message": "Suscripcion registrada correctamente"}), 201
    else:
        return jsonify({"ok": False, "error": "Error al registrar suscripcion"}), 500


@bp.route("/unsubscribe", methods=["POST"])
def unsubscribe():
    """
    Cancela una suscripcion push.

    Body:
    {
        "endpoint": "https://fcm.googleapis.com/..."
    }

    Si no se proporciona endpoint, cancela todas las suscripciones del usuario.

    Returns:
        {ok: bool, message: string}
    """
    user_id, error = _get_current_user()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    endpoint = data.get("endpoint")

    if endpoint:
        # Cancelar suscripcion especifica
        success = push_service.unsubscribe(user_id, endpoint)
        message = "Suscripcion cancelada" if success else "Suscripcion no encontrada"
    else:
        # Cancelar todas las suscripciones
        count = push_service.unsubscribe_all(user_id)
        success = True
        message = f"{count} suscripciones canceladas"

    return jsonify({"ok": success, "message": message}), 200


@bp.route("/status", methods=["GET"])
def get_status():
    """
    Obtiene el estado de suscripcion del usuario.

    Returns:
        {
            ok: bool,
            isSubscribed: bool,
            subscriptionCount: int
        }
    """
    user_id, error = _get_current_user()
    if error:
        return error

    subscriptions = push_service.get_user_subscriptions(user_id)

    return (
        jsonify(
            {
                "ok": True,
                "isSubscribed": len(subscriptions) > 0,
                "subscriptionCount": len(subscriptions),
            }
        ),
        200,
    )


@bp.route("/test", methods=["POST"])
def send_test_notification():
    """
    Envia una notificacion push de prueba.

    Disponible en desarrollo para todos, en produccion solo para admins.

    Body (opcional):
    {
        "title": "Titulo personalizado",
        "body": "Mensaje personalizado"
    }

    Returns:
        {ok: bool, results: {sent: int, failed: int}}
    """
    user_id, error = _get_current_user()
    if error:
        return error

    # En produccion, solo admins pueden enviar test
    if settings.ENV not in ("development", "dev", "local"):
        if not _is_admin(user_id):
            return jsonify({"ok": False, "error": "Solo disponible para administradores"}), 403

    data = request.get_json(silent=True) or {}
    title = data.get("title", "Notificacion de prueba")
    body = data.get("body", "Esta es una notificacion de prueba del sistema SPM")

    results = send_push_notification(
        user_id=user_id, title=title, body=body, url="/notificaciones", tag="test"
    )

    return jsonify({"ok": True, "results": results}), 200


@bp.route("/send", methods=["POST"])
def send_notification():
    """
    Envia una notificacion push a un usuario especifico.

    Requiere rol admin.

    Body:
    {
        "user_id": "8",
        "title": "Titulo",
        "body": "Mensaje",
        "url": "/ruta" (opcional)
    }
    """
    current_user_id, error = _get_current_user()
    if error:
        return error

    # Verificar rol admin
    if not _is_admin(current_user_id):
        return (
            jsonify(
                {"ok": False, "error": {"code": "forbidden", "message": "Requiere rol admin"}}
            ),
            403,
        )

    data = request.get_json(silent=True) or {}
    target_user_id = data.get("user_id")
    title = data.get("title")
    body = data.get("body")
    url = data.get("url")

    if not all([target_user_id, title, body]):
        return (
            jsonify({"ok": False, "error": "Faltan campos requeridos: user_id, title, body"}),
            400,
        )

    results = send_push_notification(user_id=target_user_id, title=title, body=body, url=url)

    return jsonify({"ok": True, "results": results}), 200
