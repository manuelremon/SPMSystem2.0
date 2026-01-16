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

from backend.core.config import settings
from backend.core.db import get_db_connection, get_db_transaction, sql_now_minus, is_using_postgresql
from backend.core.notification_schemas import (
    Notificacion,
    NotificacionCreate,
    NotificacionEvent,
    NotificacionListResponse,
)
from backend.services.push_service import send_push_notification

logger = logging.getLogger(__name__)


class NotificationRateLimiter:
    """
    Rate limiter para notificaciones por usuario.

    Previene spam de notificaciones limitando la cantidad
    de notificaciones por usuario en una ventana de tiempo.

    FIX: Ahora usa la base de datos en lugar de memoria para:
    - Persistir entre reinicios del servidor
    - Funcionar con múltiples workers
    - No consumir memoria RAM
    """

    # Configuración por defecto: máximo 20 notificaciones por minuto por usuario
    DEFAULT_MAX_NOTIFICATIONS = 20
    DEFAULT_WINDOW_SECONDS = 60

    def __init__(self, max_notifications: int = None, window_seconds: int = None):
        self.max_notifications = max_notifications or self.DEFAULT_MAX_NOTIFICATIONS
        self.window_seconds = window_seconds or self.DEFAULT_WINDOW_SECONDS
        # FIX: Ya no usamos memoria, sino BD
        # self._user_timestamps: Dict[str, List[datetime]] = defaultdict(list)
        # self._lock = threading.Lock()

    def is_allowed(self, user_id: str) -> bool:
        """
        Verifica si se permite enviar notificación al usuario.

        FIX: Ahora consulta la BD para contar notificaciones recientes.

        Returns:
            True si está permitido, False si excede el límite
        """
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                # Contar notificaciones del usuario en el último minuto
                cursor.execute(
                    f"""
                    SELECT COUNT(*) as count FROM notificaciones
                    WHERE destinatario_id = ?
                    AND created_at > {sql_now_minus(f"{self.window_seconds} seconds")}
                    """,
                    (user_id,),
                )
                row = cursor.fetchone()
                count = row["count"] if isinstance(row, dict) else row[0]

                if count >= self.max_notifications:
                    logger.debug(
                        f"[RATE_LIMIT] Usuario {user_id} excedió límite: "
                        f"{count}/{self.max_notifications} en {self.window_seconds}s"
                    )
                    return False

                return True
        except Exception as e:
            logger.error(f"[RATE_LIMIT] Error verificando límite para {user_id}: {e}")
            # En caso de error, permitir la notificación (fail open)
            return True

    def get_remaining(self, user_id: str) -> int:
        """Retorna cantidad de notificaciones restantes para el usuario."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    SELECT COUNT(*) as count FROM notificaciones
                    WHERE destinatario_id = ?
                    AND created_at > {sql_now_minus(f"{self.window_seconds} seconds")}
                    """,
                    (user_id,),
                )
                row = cursor.fetchone()
                count = row["count"] if isinstance(row, dict) else row[0]
                return max(0, self.max_notifications - count)
        except Exception as e:
            logger.error(f"[RATE_LIMIT] Error obteniendo remaining para {user_id}: {e}")
            return self.max_notifications  # Asumir todo disponible en error

    def cleanup(self):
        """FIX: Ya no es necesario, la BD se auto-limpia con queries."""
        pass


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
        "stock_consulta": "SPM - Consulta de Stock",
        "stock_consulta_respuesta": "SPM - Respuesta Consulta Stock",
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
        "stock_consulta": "notif_mrp",
        "stock_consulta_respuesta": "notif_mrp",
    }

    _preferences_table_ensured = False

    @classmethod
    def _ensure_preferences_table(cls) -> None:
        """
        FIX 3.9: Asegura que la tabla de preferencias existe.

        Crea la tabla si no existe en lugar de fallar silenciosamente.
        Usa flag de clase para evitar verificar en cada llamada.

        FIX: Usa sintaxis compatible con PostgreSQL (SERIAL) y SQLite (AUTOINCREMENT).
        """
        if cls._preferences_table_ensured:
            return

        try:
            with get_db_transaction() as conn:
                cursor = conn.cursor()

                # FIX: Sintaxis diferente para PostgreSQL vs SQLite
                if is_using_postgresql():
                    # PostgreSQL: SERIAL para auto-increment
                    cursor.execute(
                        """
                        CREATE TABLE IF NOT EXISTS user_notification_preferences (
                            id SERIAL PRIMARY KEY,
                            user_id TEXT UNIQUE NOT NULL,
                            push_enabled INTEGER DEFAULT 1,
                            sound_enabled INTEGER DEFAULT 1,
                            notif_solicitudes INTEGER DEFAULT 1,
                            notif_aprobaciones INTEGER DEFAULT 1,
                            notif_mensajes INTEGER DEFAULT 1,
                            notif_presupuestos INTEGER DEFAULT 1,
                            notif_mrp INTEGER DEFAULT 1,
                            notif_sla INTEGER DEFAULT 1,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """
                    )
                else:
                    # SQLite: INTEGER PRIMARY KEY AUTOINCREMENT
                    cursor.execute(
                        """
                        CREATE TABLE IF NOT EXISTS user_notification_preferences (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id TEXT UNIQUE NOT NULL,
                            push_enabled INTEGER DEFAULT 1,
                            sound_enabled INTEGER DEFAULT 1,
                            notif_solicitudes INTEGER DEFAULT 1,
                            notif_aprobaciones INTEGER DEFAULT 1,
                            notif_mensajes INTEGER DEFAULT 1,
                            notif_presupuestos INTEGER DEFAULT 1,
                            notif_mrp INTEGER DEFAULT 1,
                            notif_sla INTEGER DEFAULT 1,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """
                    )

                cursor.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_user_notif_prefs_user
                    ON user_notification_preferences(user_id)
                """
                )
            cls._preferences_table_ensured = True
            logger.debug("[NOTIF] Tabla user_notification_preferences verificada/creada")
        except Exception as e:
            logger.warning(f"[NOTIF] Error asegurando tabla preferencias: {e}")

    @classmethod
    def _get_user_preferences(cls, user_id: str) -> Dict[str, bool]:
        """
        Obtiene las preferencias de notificación del usuario.

        Returns:
            Dict con preferencias (todo True si no hay registro)
        """
        # FIX 3.9: Asegurar que la tabla existe antes de consultar
        cls._ensure_preferences_table()

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

                # FIX: Evitar notificaciones duplicadas en los últimos 60 segundos
                # (aumentado de 5s para prevenir duplicados en operaciones lentas)
                cursor.execute(
                    f"""
                    SELECT id FROM notificaciones
                    WHERE destinatario_id = ? AND mensaje = ? AND tipo = ?
                    AND created_at > {sql_now_minus("60 seconds")}
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
                    VALUES (?, ?, ?, ?, 0, ?)
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
                    tipo=tipo,  # Para selección de icono en Service Worker
                    url=url,
                    tag=f"notif-{notif_id}",
                )
            except Exception as e:
                logger.warning(f"Error sending push notification: {e}")
                # No fallar si push falla, la notificación ya se creó

        # FIX 5.1: Publicar a Redis para entrega en tiempo real vía SSE
        if notif_id:
            try:
                from backend.core.redis_pubsub import publish_user_notification
            except ImportError:
                try:
                    from core.redis_pubsub import publish_user_notification
                except ImportError:
                    publish_user_notification = None

            if publish_user_notification:
                try:
                    publish_user_notification(
                        destinatario_id,
                        {
                            "id": notif_id,
                            "mensaje": mensaje,
                            "tipo": tipo,
                            "solicitud_id": solicitud_id,
                            "created_at": datetime.now().isoformat(),
                            "leido": False,
                        },
                    )
                except Exception as e:
                    logger.debug(f"Redis pub/sub no disponible: {e}")
                    # No fallar si Redis no está disponible, fallback a polling

        return notif_id

    @classmethod
    def notify_solicitud_cancelled(
        cls,
        solicitud_id: int,
        motivo: str,
        cancelado_por: Optional[str] = None,
    ) -> Optional[int]:
        """
        FIX: Notifica la cancelación/reversión de una solicitud.

        Envía notificación al solicitante original cuando su solicitud
        es cancelada o revertida después de haber sido aprobada.

        Args:
            solicitud_id: ID de la solicitud cancelada
            motivo: Motivo de la cancelación
            cancelado_por: ID del usuario que canceló (opcional)

        Returns:
            ID de la notificación creada, o None si falla
        """
        from backend.core.repository import SolicitudRepository

        try:
            solicitud = SolicitudRepository.get_by_id(solicitud_id)
            if not solicitud:
                logger.warning(f"[NOTIF] Solicitud {solicitud_id} no encontrada para notificar cancelación")
                return None

            destinatario_id = solicitud.get("id_usuario")
            if not destinatario_id:
                logger.warning(f"[NOTIF] Solicitud {solicitud_id} sin usuario para notificar")
                return None

            mensaje = f"Tu solicitud #{solicitud_id} ha sido cancelada"
            if motivo:
                mensaje += f": {motivo}"

            return cls.create_notification(
                destinatario_id=str(destinatario_id),
                mensaje=mensaje,
                tipo="solicitud_cancelled",
                solicitud_id=solicitud_id,
            )
        except Exception as e:
            logger.error(f"[NOTIF] Error notificando cancelación de solicitud {solicitud_id}: {e}")
            return None

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
                    try:
                        row_dict = row if isinstance(row, dict) else dict(row)
                        notif = Notificacion.from_db_row(row_dict)
                        notifications.append(notif.to_dict())
                    except Exception as row_err:
                        logger.error(f"Error processing notification row: {row_err}, row={row}")
                        continue  # Skip bad rows instead of failing all

                return notifications

        except Exception as e:
            import traceback
            logger.error(f"Error fetching notifications: {e}\n{traceback.format_exc()}")
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
    def get_user_notifications_with_count(
        cls, user_id: str, unread_only: bool = False, limit: int = 50
    ) -> tuple:
        """
        FIX 3.13: Obtiene notificaciones Y contador en una sola operación de BD.

        Más eficiente que llamar get_user_notifications + get_unread_count por separado.

        Args:
            user_id: ID del usuario
            unread_only: Si True, solo notificaciones no leídas
            limit: Límite de notificaciones a retornar

        Returns:
            tuple: (lista de notificaciones, contador de no leídas)
        """
        notifications = cls.get_user_notifications(user_id, unread_only, limit)

        # Calcular unread_count de las notificaciones obtenidas si es posible
        # o hacer query adicional solo si es necesario
        if unread_only:
            # Si pedimos solo no leídas, el total es el count total de no leídas
            unread_count = cls.get_unread_count(user_id)
        else:
            # Contar directamente de las notificaciones cargadas si tenemos todas
            # Si hay menos que el límite, podemos contar directamente
            if len(notifications) < limit:
                unread_count = sum(1 for n in notifications if not n.get("leido", True))
            else:
                # Hay más, necesitamos query
                unread_count = cls.get_unread_count(user_id)

        return notifications, unread_count

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


# =============================================================================
# Limpieza de notificaciones antiguas
# =============================================================================


def cleanup_old_notifications(days_old: int = 30) -> int:
    """
    Elimina notificaciones leídas con más de X días de antigüedad.

    Args:
        days_old: Días de antigüedad para eliminar (default: 30)

    Returns:
        Número de notificaciones eliminadas
    """
    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            # Eliminar notificaciones leídas con más de X días
            cursor.execute(
                f"""
                DELETE FROM notificaciones
                WHERE leido = 1
                AND created_at < {sql_now_minus(f"{days_old} days")}
                """
            )
            deleted = cursor.rowcount
            logger.info(f"[NOTIF] Limpiadas {deleted} notificaciones antiguas (>{days_old} días)")
            return deleted
    except Exception as e:
        logger.error(f"[NOTIF] Error limpiando notificaciones antiguas: {e}")
        return 0
