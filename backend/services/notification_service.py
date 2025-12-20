"""
Servicio de Notificaciones en Tiempo Real

Maneja la lógica de negocio para notificaciones:
- Creación de notificaciones
- Consultas (leídas/no leídas)
- Marcar como leídas
- Gestión de eventos SSE
- Envío de push notifications
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from backend.core.config import settings
    from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql
    from backend.core.notification_schemas import (
        Notificacion,
        NotificacionCreate,
        NotificacionEvent,
        NotificacionListResponse,
    )
    from backend.services.push_service import send_push_notification
except ImportError:
    from core.db import get_db_connection, get_db_transaction, is_using_postgresql
    from core.notification_schemas import Notificacion

    try:
        from services.push_service import send_push_notification
    except ImportError:
        send_push_notification = None

logger = logging.getLogger(__name__)


class NotificationService:
    """Servicio para gestionar notificaciones"""

    @staticmethod
    def _placeholder():
        """Retorna el placeholder correcto para la BD"""
        return "%s" if is_using_postgresql() else "?"

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
            ID de la notificación creada o None si falla
        """
        notif_id = None
        ph = cls._placeholder()
        try:
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                if is_using_postgresql():
                    cursor.execute(
                        f"""
                        INSERT INTO notificaciones (destinatario_id, mensaje, tipo, solicitud_id, leido, created_at)
                        VALUES ({ph}, {ph}, {ph}, {ph}, false, {ph})
                        RETURNING id
                        """,
                        (destinatario_id, mensaje, tipo, solicitud_id, datetime.now().isoformat()),
                    )
                    row = cursor.fetchone()
                    notif_id = row[0] if row else None
                else:
                    cursor.execute(
                        f"""
                        INSERT INTO notificaciones (destinatario_id, mensaje, tipo, solicitud_id, leido, created_at)
                        VALUES ({ph}, {ph}, {ph}, {ph}, 0, {ph})
                        """,
                        (destinatario_id, mensaje, tipo, solicitud_id, datetime.now().isoformat()),
                    )
                    notif_id = cursor.lastrowid
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
            return None

        # Enviar push notification si está habilitado
        if notif_id and send_push and send_push_notification:
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
        ph = cls._placeholder()
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()

                where_clause = f"WHERE destinatario_id = {ph}"
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
                    LIMIT {ph}
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
        ph = cls._placeholder()
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                # Column is INTEGER (0/1), not BOOLEAN
                cursor.execute(
                    f"SELECT COUNT(*) FROM notificaciones WHERE destinatario_id = {ph} AND leido = 0",
                    (user_id,),
                )
                result = cursor.fetchone()
                return result[0] if result else 0
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
        ph = cls._placeholder()
        try:
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                # Column is INTEGER (0/1), not BOOLEAN
                cursor.execute(
                    f"""
                    UPDATE notificaciones
                    SET leido = 1
                    WHERE id = {ph} AND destinatario_id = {ph}
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
        ph = cls._placeholder()
        try:
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                # Column is INTEGER (0/1), not BOOLEAN
                cursor.execute(
                    f"""
                    UPDATE notificaciones
                    SET leido = 1
                    WHERE destinatario_id = {ph} AND leido = 0
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
        ph = cls._placeholder()
        try:
            with get_db_transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    DELETE FROM notificaciones
                    WHERE id = {ph} AND destinatario_id = {ph}
                    """,
                    (notification_id, user_id),
                )
                return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"Error deleting notification: {e}")
            return False


# Helper functions para crear notificaciones automáticas


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
