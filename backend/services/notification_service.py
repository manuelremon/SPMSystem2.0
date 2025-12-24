"""
Servicio de Notificaciones en Tiempo Real

Maneja la lógica de negocio para notificaciones:
- Creación de notificaciones
- Consultas (leídas/no leídas)
- Marcar como leídas
- Gestión de eventos SSE
- Envío de push notifications
- Rate limiting por usuario
"""

import logging
import threading
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

try:
    from backend.core.config import settings
    from backend.core.db import get_db_connection, get_db_transaction
    from backend.core.notification_schemas import (
        Notificacion,
        NotificacionCreate,
        NotificacionEvent,
        NotificacionListResponse,
    )
    from backend.services.push_service import send_push_notification
except ImportError:
    from core.db import get_db_connection, get_db_transaction
    from core.notification_schemas import Notificacion

    try:
        from services.push_service import send_push_notification
    except ImportError:
        send_push_notification = None

logger = logging.getLogger(__name__)


class NotificationRateLimiter:
    """
    Rate limiter para notificaciones por usuario.

    Previene spam de notificaciones limitando la cantidad
    de notificaciones por usuario en una ventana de tiempo.
    """

    # Configuración por defecto: máximo 20 notificaciones por minuto por usuario
    DEFAULT_MAX_NOTIFICATIONS = 20
    DEFAULT_WINDOW_SECONDS = 60

    def __init__(self, max_notifications: int = None, window_seconds: int = None):
        self.max_notifications = max_notifications or self.DEFAULT_MAX_NOTIFICATIONS
        self.window_seconds = window_seconds or self.DEFAULT_WINDOW_SECONDS
        self._user_timestamps: Dict[str, List[datetime]] = defaultdict(list)
        self._lock = threading.Lock()

    def is_allowed(self, user_id: str) -> bool:
        """
        Verifica si se permite enviar notificación al usuario.

        Returns:
            True si está permitido, False si excede el límite
        """
        now = datetime.now()
        cutoff = now - timedelta(seconds=self.window_seconds)

        with self._lock:
            # Limpiar timestamps antiguos
            self._user_timestamps[user_id] = [
                ts for ts in self._user_timestamps[user_id] if ts > cutoff
            ]

            # Verificar límite
            if len(self._user_timestamps[user_id]) >= self.max_notifications:
                return False

            # Registrar nuevo timestamp
            self._user_timestamps[user_id].append(now)
            return True

    def get_remaining(self, user_id: str) -> int:
        """Retorna cantidad de notificaciones restantes para el usuario."""
        now = datetime.now()
        cutoff = now - timedelta(seconds=self.window_seconds)

        with self._lock:
            recent = [ts for ts in self._user_timestamps[user_id] if ts > cutoff]
            return max(0, self.max_notifications - len(recent))

    def cleanup(self):
        """Limpia timestamps antiguos de todos los usuarios."""
        now = datetime.now()
        cutoff = now - timedelta(seconds=self.window_seconds * 2)

        with self._lock:
            users_to_remove = []
            for user_id in self._user_timestamps:
                self._user_timestamps[user_id] = [
                    ts for ts in self._user_timestamps[user_id] if ts > cutoff
                ]
                if not self._user_timestamps[user_id]:
                    users_to_remove.append(user_id)

            for user_id in users_to_remove:
                del self._user_timestamps[user_id]


# Instancia global del rate limiter
_notification_rate_limiter = NotificationRateLimiter()


class NotificationService:
    """Servicio para gestionar notificaciones"""

    # Mapeo de tipos de notificación a títulos para push
    PUSH_TITLES = {
        "info": "SPM - Información",
        "success": "SPM - Éxito",
        "warning": "SPM - Atención",
        "error": "SPM - Error",
        "solicitud_created": "Nueva Solicitud",
        "solicitud_approved": "Solicitud Aprobada",
        "solicitud_rejected": "Solicitud Rechazada",
        "solicitud_planned": "Solicitud Planificada",
        "solicitud_dispatched": "Solicitud Despachada",
    }

    # Mapeo de tipos de notificación a preferencias del usuario
    TIPO_TO_PREFERENCE = {
        "solicitud_created": "notif_solicitudes",
        "solicitud_approved": "notif_aprobaciones",
        "solicitud_rejected": "notif_aprobaciones",
        "solicitud_planned": "notif_solicitudes",
        "solicitud_dispatched": "notif_solicitudes",
        "mensaje_nuevo": "notif_mensajes",
        "budget_alert": "notif_presupuestos",
        "mrp_alert": "notif_mrp",
        "sla_alert": "notif_sla",
        "profile_approved": "notif_solicitudes",
        "profile_rejected": "notif_solicitudes",
    }

    @classmethod
    def _get_user_preferences(cls, user_id: str) -> Dict[str, bool]:
        """
        Obtiene las preferencias de notificación del usuario.

        Returns:
            Dict con preferencias (todo True si no hay registro)
        """
        defaults = {
            "push_enabled": True,
            "sound_enabled": True,
            "notif_solicitudes": True,
            "notif_aprobaciones": True,
            "notif_mensajes": True,
            "notif_presupuestos": True,
            "notif_mrp": True,
            "notif_sla": True,
        }

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """SELECT push_enabled, sound_enabled, notif_solicitudes, notif_aprobaciones,
                              notif_mensajes, notif_presupuestos, notif_mrp, notif_sla
                       FROM user_notification_preferences
                       WHERE user_id = ?""",
                    (str(user_id),),
                )
                row = cursor.fetchone()

            if row:
                if hasattr(row, "keys"):
                    return {k: bool(v) for k, v in dict(row).items()}
                else:
                    return {
                        "push_enabled": bool(row[0]),
                        "sound_enabled": bool(row[1]),
                        "notif_solicitudes": bool(row[2]),
                        "notif_aprobaciones": bool(row[3]),
                        "notif_mensajes": bool(row[4]),
                        "notif_presupuestos": bool(row[5]),
                        "notif_mrp": bool(row[6]),
                        "notif_sla": bool(row[7]),
                    }
        except Exception as e:
            logger.warning(f"Error getting user preferences for {user_id}: {e}")

        return defaults

    @classmethod
    def _should_notify(cls, user_id: str, tipo: str) -> tuple:
        """
        Determina si se debe notificar al usuario basado en sus preferencias.

        Returns:
            tuple: (should_create_inapp, should_send_push)
        """
        prefs = cls._get_user_preferences(user_id)

        # Verificar preferencia específica del tipo
        pref_key = cls.TIPO_TO_PREFERENCE.get(tipo)
        if pref_key and not prefs.get(pref_key, True):
            # Usuario deshabilitó este tipo de notificación
            return (False, False)

        # Tipos básicos (info, success, warning, error) siempre se crean in-app
        # pero respetan la preferencia de push
        should_push = prefs.get("push_enabled", True)

        return (True, should_push)

    @classmethod
    def create_notification(
        cls,
        destinatario_id: str,
        mensaje: str,
        tipo: str = "info",
        solicitud_id: Optional[int] = None,
        send_push: bool = True,
    ) -> Optional[int]:
        """
        Crear una nueva notificación.

        Args:
            destinatario_id: ID del usuario destinatario
            mensaje: Mensaje de la notificación
            tipo: Tipo de notificación (info, success, warning, error)
            solicitud_id: ID de solicitud relacionada (opcional)
            send_push: Enviar también push notification (default: True)

        Returns:
            ID de la notificación creada o None si falla o el usuario deshabilitó este tipo
        """
        # Verificar preferencias del usuario
        should_create, should_push = cls._should_notify(destinatario_id, tipo)

        if not should_create:
            logger.debug(f"Notificación tipo {tipo} omitida por preferencias de usuario {destinatario_id}")
            return None

        # Rate limiting: verificar si el usuario no ha excedido el límite
        if not _notification_rate_limiter.is_allowed(destinatario_id):
            logger.warning(
                f"Rate limit excedido para usuario {destinatario_id}. "
                f"Notificación omitida: {mensaje[:50]}..."
            )
            return None

        notif_id = None
        try:
            with get_db_transaction() as conn:
                cursor = conn.cursor()

                # Evitar notificaciones duplicadas en los últimos 5 segundos
                cursor.execute(
                    """
                    SELECT id FROM notificaciones
                    WHERE destinatario_id = ? AND mensaje = ? AND tipo = ?
                    AND created_at > datetime('now', '-5 seconds')
                    LIMIT 1
                    """,
                    (destinatario_id, mensaje, tipo),
                )
                if cursor.fetchone():
                    logger.debug(
                        f"Notificación duplicada omitida para usuario {destinatario_id}: {mensaje[:50]}..."
                    )
                    return None

                cursor.execute(
                    """
                    INSERT INTO notificaciones (destinatario_id, mensaje, tipo, solicitud_id, leido, created_at)
                    VALUES (?, ?, ?, ?, false, ?)
                    RETURNING id
                    """,
                    (destinatario_id, mensaje, tipo, solicitud_id, datetime.now().isoformat()),
                )
                row = cursor.fetchone()
                # Compatibilidad PostgreSQL (dict) y SQLite (tuple)
                if row:
                    notif_id = row["id"] if isinstance(row, dict) else row[0]
                else:
                    notif_id = None
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            return None

        # Enviar push notification si está habilitado (por parámetro Y por preferencias)
        if notif_id and send_push and should_push and send_push_notification:
            try:
                title = cls.PUSH_TITLES.get(tipo, "SPM - Notificación")
                url = f"/solicitudes/{solicitud_id}" if solicitud_id else "/notificaciones"
                send_push_notification(
                    user_id=destinatario_id,
                    title=title,
                    body=mensaje,
                    url=url,
                    tag=f"notif-{notif_id}",
                )
            except Exception as e:
                logger.warning(f"Error sending push notification: {e}")
                # No fallar si push falla, la notificación ya se creó

        return notif_id

    @classmethod
    def get_user_notifications(
        cls, user_id: str, unread_only: bool = False, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Obtener notificaciones de un usuario.

        Args:
            user_id: ID del usuario
            unread_only: Solo notificaciones no leídas
            limit: Cantidad máxima de notificaciones

        Returns:
            Lista de notificaciones como diccionarios
        """
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()

                where_clause = "WHERE destinatario_id = ?"
                params = [user_id]

                if unread_only:
                    # Column is INTEGER (0/1), not BOOLEAN
                    where_clause += " AND leido = 0"

                cursor.execute(
                    f"""
                    SELECT id, destinatario_id, mensaje, tipo, solicitud_id, leido, created_at
                    FROM notificaciones
                    {where_clause}
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    params + [limit],
                )

                rows = cursor.fetchall()
                notifications = []

                # PostgreSQL wrapper ya retorna dicts, SQLite retorna Row
                for row in rows:
                    row_dict = row if isinstance(row, dict) else dict(row)
                    notif = Notificacion.from_db_row(row_dict)
                    notifications.append(notif.to_dict())

                return notifications

        except Exception as e:
            logger.error(f"Error fetching notifications: {e}")
            return []

    @classmethod
    def get_unread_count(cls, user_id: str) -> int:
        """
        Contar notificaciones no leídas de un usuario.

        Args:
            user_id: ID del usuario

        Returns:
            Cantidad de notificaciones no leídas
        """
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                # Column is INTEGER (0/1), not BOOLEAN
                cursor.execute(
                    "SELECT COUNT(*) as count FROM notificaciones WHERE destinatario_id = ? AND leido = 0",
                    (user_id,),
                )
                result = cursor.fetchone()
                # Handle both dict (PostgreSQL wrapper) and tuple (SQLite)
                if result is None:
                    return 0
                if isinstance(result, dict):
                    return result.get("count", 0)
                return result[0]
        except Exception as e:
            logger.error(f"Error counting unread: {e}")
            return 0

    @classmethod
    def mark_as_read(cls, notification_id: int, user_id: str) -> bool:
        """
        Marcar una notificación como leída.

        Args:
            notification_id: ID de la notificación
            user_id: ID del usuario (para verificar ownership)

        Returns:
            True si se marcó correctamente, False en caso contrario
        """
        try:
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                # Column is INTEGER (0/1), not BOOLEAN
                cursor.execute(
                    """
                    UPDATE notificaciones
                    SET leido = 1
                    WHERE id = ? AND destinatario_id = ?
                    """,
                    (notification_id, user_id),
                )
                return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"Error marking as read: {e}")
            return False

    @classmethod
    def mark_all_as_read(cls, user_id: str) -> int:
        """
        Marcar todas las notificaciones de un usuario como leídas.

        Args:
            user_id: ID del usuario

        Returns:
            Cantidad de notificaciones marcadas
        """
        try:
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                # Column is INTEGER (0/1), not BOOLEAN
                cursor.execute(
                    """
                    UPDATE notificaciones
                    SET leido = 1
                    WHERE destinatario_id = ? AND leido = 0
                    """,
                    (user_id,),
                )
                return cursor.rowcount
        except Exception as e:
            logger.error(f"Error marking all as read: {e}")
            return 0

    @classmethod
    def delete_notification(cls, notification_id: int, user_id: str) -> bool:
        """
        Eliminar una notificación.

        Args:
            notification_id: ID de la notificación
            user_id: ID del usuario (para verificar ownership)

        Returns:
            True si se eliminó correctamente
        """
        try:
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    DELETE FROM notificaciones
                    WHERE id = ? AND destinatario_id = ?
                    """,
                    (notification_id, user_id),
                )
                return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"Error deleting notification: {e}")
            return False


# =============================================================================
# Helper functions para crear notificaciones automáticas
# =============================================================================
# Estas funciones proveen una API simple para notificar eventos específicos.
# Deben usarse desde las rutas (routes/) cuando ocurren eventos importantes.
# El FSM también genera notificaciones automáticas en cambios de estado.


def notify_solicitud_created(solicitud_id: int, aprobador_id: str):
    """Notificar cuando se crea una solicitud"""
    NotificationService.create_notification(
        destinatario_id=aprobador_id,
        mensaje=f"Nueva solicitud #{solicitud_id} pendiente de aprobación",
        tipo="solicitud_created",
        solicitud_id=solicitud_id,
    )


def notify_solicitud_approved(solicitud_id: int, solicitante_id: str):
    """Notificar cuando se aprueba una solicitud"""
    NotificationService.create_notification(
        destinatario_id=solicitante_id,
        mensaje=f"Tu solicitud #{solicitud_id} ha sido aprobada",
        tipo="solicitud_approved",
        solicitud_id=solicitud_id,
    )


def notify_solicitud_rejected(solicitud_id: int, solicitante_id: str, motivo: str = ""):
    """Notificar cuando se rechaza una solicitud"""
    mensaje = f"Tu solicitud #{solicitud_id} ha sido rechazada"
    if motivo:
        mensaje += f": {motivo}"

    NotificationService.create_notification(
        destinatario_id=solicitante_id,
        mensaje=mensaje,
        tipo="solicitud_rejected",
        solicitud_id=solicitud_id,
    )


def notify_solicitud_planned(solicitud_id: int, solicitante_id: str):
    """Notificar cuando se planifica una solicitud"""
    NotificationService.create_notification(
        destinatario_id=solicitante_id,
        mensaje=f"Tu solicitud #{solicitud_id} ha sido planificada",
        tipo="solicitud_planned",
        solicitud_id=solicitud_id,
    )
