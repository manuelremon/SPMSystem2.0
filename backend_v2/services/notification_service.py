"""
Servicio de Notificaciones en Tiempo Real

Maneja la lógica de negocio para notificaciones:
- Creación de notificaciones
- Consultas (leídas/no leídas)
- Marcar como leídas
- Gestión de eventos SSE
"""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from backend_v2.core.config import settings
    from backend_v2.core.notification_schemas import (Notificacion,
                                                      NotificacionCreate,
                                                      NotificacionEvent,
                                                      NotificacionListResponse)
except ImportError:
    from core.config import settings
    from core.notification_schemas import Notificacion


class NotificationService:
    """Servicio para gestionar notificaciones"""

    @staticmethod
    def _db_path() -> Path:
        """Obtener ruta de la base de datos"""
        if settings.DATABASE_URL.startswith("sqlite:///"):
            return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
        return Path("spm.db")

    @staticmethod
    def _connect():
        """Conectar a la base de datos"""
        path = NotificationService._db_path()
        return sqlite3.connect(path)

    @classmethod
    def create_notification(
        cls,
        destinatario_id: str,
        mensaje: str,
        tipo: str = "info",
        solicitud_id: Optional[int] = None,
    ) -> Optional[int]:
        """
        Crear una nueva notificación.

        Args:
            destinatario_id: ID del usuario destinatario
            mensaje: Mensaje de la notificación
            tipo: Tipo de notificación (info, success, warning, error)
            solicitud_id: ID de solicitud relacionada (opcional)

        Returns:
            ID de la notificación creada o None si falla
        """
        conn = cls._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO notificaciones (destinatario_id, mensaje, tipo, solicitud_id, leido, created_at)
                VALUES (?, ?, ?, ?, 0, ?)
                """,
                (destinatario_id, mensaje, tipo, solicitud_id, datetime.now().isoformat()),
            )
            conn.commit()
            return cursor.lastrowid
        except Exception as e:
            print(f"Error creating notification: {e}")
            return None
        finally:
            conn.close()

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
        conn = cls._connect()
        try:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            where_clause = "WHERE destinatario_id = ?"
            params = [user_id]

            if unread_only:
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

            for row in rows:
                notif = Notificacion.from_db_row(dict(row))
                notifications.append(notif.to_dict())

            return notifications

        except Exception as e:
            print(f"Error fetching notifications: {e}")
            return []
        finally:
            conn.close()

    @classmethod
    def get_unread_count(cls, user_id: str) -> int:
        """
        Contar notificaciones no leídas de un usuario.

        Args:
            user_id: ID del usuario

        Returns:
            Cantidad de notificaciones no leídas
        """
        conn = cls._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM notificaciones WHERE destinatario_id = ? AND leido = 0",
                (user_id,),
            )
            result = cursor.fetchone()
            return result[0] if result else 0
        except Exception as e:
            print(f"Error counting unread: {e}")
            return 0
        finally:
            conn.close()

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
        conn = cls._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE notificaciones
                SET leido = 1
                WHERE id = ? AND destinatario_id = ?
                """,
                (notification_id, user_id),
            )
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            print(f"Error marking as read: {e}")
            return False
        finally:
            conn.close()

    @classmethod
    def mark_all_as_read(cls, user_id: str) -> int:
        """
        Marcar todas las notificaciones de un usuario como leídas.

        Args:
            user_id: ID del usuario

        Returns:
            Cantidad de notificaciones marcadas
        """
        conn = cls._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE notificaciones
                SET leido = 1
                WHERE destinatario_id = ? AND leido = 0
                """,
                (user_id,),
            )
            conn.commit()
            return cursor.rowcount
        except Exception as e:
            print(f"Error marking all as read: {e}")
            return 0
        finally:
            conn.close()

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
        conn = cls._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM notificaciones
                WHERE id = ? AND destinatario_id = ?
                """,
                (notification_id, user_id),
            )
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            print(f"Error deleting notification: {e}")
            return False
        finally:
            conn.close()


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
