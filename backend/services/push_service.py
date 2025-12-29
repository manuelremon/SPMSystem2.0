"""
Push Notification Service
=========================
Servicio para gestionar suscripciones y enviar notificaciones push.

Usa Web Push Protocol con VAPID para autenticacion.
"""

import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from pywebpush import WebPushException, webpush

try:
    from backend.core.db import get_db_connection, get_db_transaction
    from backend.core.push_config import (
        VAPID_PRIVATE_KEY_PATH,
        get_vapid_claims,
        get_vapid_private_key,
        get_vapid_public_key_base64,
    )
except ImportError:
    from core.db import get_db_connection, get_db_transaction
    from core.push_config import (
        VAPID_PRIVATE_KEY_PATH,
        get_vapid_claims,
        get_vapid_private_key,
        get_vapid_public_key_base64,
    )

logger = logging.getLogger(__name__)


@dataclass
class PushSubscription:
    """Representa una suscripcion push del navegador."""

    id: int
    user_id: str
    endpoint: str
    p256dh: str
    auth: str
    created_at: str


class PushService:
    """Servicio para gestionar push notifications."""

    def __init__(self):
        self._ensure_table()

    def _ensure_table(self):
        """Crea la tabla de suscripciones si no existe."""
        try:
            with get_db_transaction() as conn:
                cur = conn.cursor()
                # Sintaxis compatible con PostgreSQL y SQLite
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS push_subscriptions (
                        id SERIAL PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        endpoint TEXT UNIQUE NOT NULL,
                        p256dh TEXT NOT NULL,
                        auth TEXT NOT NULL,
                        user_agent TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        last_used_at TIMESTAMP
                    )
                """
                )
                cur.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_push_user
                    ON push_subscriptions(user_id)
                """
                )
                cur.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_push_endpoint
                    ON push_subscriptions(endpoint)
                """
                )
        except Exception as e:
            logger.warning(f"[PUSH] No se pudo crear tabla push_subscriptions: {e}")

    def subscribe(
        self, user_id: str, endpoint: str, p256dh: str, auth: str, user_agent: Optional[str] = None
    ) -> bool:
        """
        Registra una nueva suscripcion push.

        Args:
            user_id: ID del usuario
            endpoint: URL del endpoint push del navegador
            p256dh: Clave publica del cliente (base64)
            auth: Secreto de autenticacion (base64)
            user_agent: User agent del navegador (opcional)

        Returns:
            True si se registro correctamente
        """
        try:
            with get_db_transaction() as conn:
                cur = conn.cursor()
                # Upsert: actualizar si ya existe el endpoint (SQLite 3.24+ compatible)
                cur.execute(
                    """
                    INSERT INTO push_subscriptions
                    (user_id, endpoint, p256dh, auth, user_agent, created_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(endpoint) DO UPDATE SET
                        user_id = excluded.user_id,
                        p256dh = excluded.p256dh,
                        auth = excluded.auth,
                        user_agent = excluded.user_agent
                """,
                    (user_id, endpoint, p256dh, auth, user_agent),
                )
            logger.info(f"[PUSH] Suscripcion registrada para usuario {user_id}")
            return True
        except Exception as e:
            logger.error(f"[PUSH] Error al registrar suscripcion: {e}")
            return False

    def unsubscribe(self, user_id: str, endpoint: str) -> bool:
        """
        Elimina una suscripcion push.

        Args:
            user_id: ID del usuario
            endpoint: URL del endpoint a eliminar

        Returns:
            True si se elimino correctamente
        """
        try:
            with get_db_transaction() as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    DELETE FROM push_subscriptions
                    WHERE user_id = ? AND endpoint = ?
                """,
                    (user_id, endpoint),
                )
            logger.info(f"[PUSH] Suscripcion eliminada para usuario {user_id}")
            return cur.rowcount > 0
        except Exception as e:
            logger.error(f"[PUSH] Error al eliminar suscripcion: {e}")
            return False

    def unsubscribe_all(self, user_id: str) -> int:
        """
        Elimina todas las suscripciones de un usuario.

        Returns:
            Numero de suscripciones eliminadas
        """
        try:
            with get_db_transaction() as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    DELETE FROM push_subscriptions
                    WHERE user_id = ?
                """,
                    (user_id,),
                )
            count = cur.rowcount
            logger.info(f"[PUSH] {count} suscripciones eliminadas para usuario {user_id}")
            return count
        except Exception as e:
            logger.error(f"[PUSH] Error al eliminar suscripciones: {e}")
            return 0

    def get_user_subscriptions(self, user_id: str) -> List[PushSubscription]:
        """Obtiene todas las suscripciones de un usuario."""
        try:
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT id, user_id, endpoint, p256dh, auth, created_at
                    FROM push_subscriptions
                    WHERE user_id = ?
                """,
                    (user_id,),
                )
                rows = cur.fetchall()
                result = []
                for row in rows:
                    # Compatibilidad PostgreSQL (dict) y SQLite (tuple)
                    if isinstance(row, dict):
                        result.append(PushSubscription(
                            id=row["id"],
                            user_id=row["user_id"],
                            endpoint=row["endpoint"],
                            p256dh=row["p256dh"],
                            auth=row["auth"],
                            created_at=row["created_at"],
                        ))
                    else:
                        result.append(PushSubscription(
                            id=row[0],
                            user_id=row[1],
                            endpoint=row[2],
                            p256dh=row[3],
                            auth=row[4],
                            created_at=row[5],
                        ))
                return result
        except Exception as e:
            logger.error(f"[PUSH] Error al obtener suscripciones: {e}")
            return []

    def has_subscription(self, user_id: str) -> bool:
        """Verifica si el usuario tiene al menos una suscripcion."""
        try:
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT COUNT(*) as count
                    FROM push_subscriptions
                    WHERE user_id = ?
                """,
                    (user_id,),
                )
                row = cur.fetchone()
                # Compatibilidad PostgreSQL (dict) y SQLite (tuple)
                if row:
                    count = row["count"] if isinstance(row, dict) else row[0]
                    return count > 0
                return False
        except Exception as e:
            logger.error(f"[PUSH] Error al verificar suscripcion: {e}")
            return False

    def send_push(
        self,
        user_id: str,
        title: str,
        body: str,
        tipo: Optional[str] = None,
        icon: Optional[str] = None,
        url: Optional[str] = None,
        tag: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Envia una notificacion push a todas las suscripciones del usuario.

        Args:
            user_id: ID del usuario destinatario
            title: Titulo de la notificacion
            body: Cuerpo del mensaje
            tipo: Tipo de notificacion (para seleccion de icono en SW)
            icon: URL del icono (opcional, se ignora si tipo esta definido)
            url: URL a abrir al hacer click (opcional)
            tag: Tag para agrupar notificaciones (opcional)
            data: Datos adicionales (opcional)

        Returns:
            Dict con resultados {sent: int, failed: int, errors: list}
        """
        subscriptions = self.get_user_subscriptions(user_id)
        if not subscriptions:
            logger.debug(f"[PUSH] Usuario {user_id} no tiene suscripciones")
            return {"sent": 0, "failed": 0, "errors": []}

        # Payload de la notificacion
        payload = {
            "title": title,
            "body": body,
            "tipo": tipo or "default",
            "url": url or "/",
            "tag": tag,
            "data": data or {},
        }

        results = {"sent": 0, "failed": 0, "errors": []}
        failed_endpoints = []

        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                }

                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=str(VAPID_PRIVATE_KEY_PATH),
                    vapid_claims=get_vapid_claims(),
                    timeout=10,
                )

                results["sent"] += 1

                # Actualizar last_used_at
                with get_db_transaction() as conn:
                    cur = conn.cursor()
                    cur.execute(
                        """
                        UPDATE push_subscriptions
                        SET last_used_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    """,
                        (sub.id,),
                    )

            except WebPushException as e:
                results["failed"] += 1
                error_msg = str(e)
                results["errors"].append(error_msg)
                logger.warning(f"[PUSH] Error enviando a {sub.endpoint[:50]}...: {error_msg}")

                # Si el endpoint ya no es valido, marcarlo para eliminar
                if e.response and e.response.status_code in (404, 410):
                    failed_endpoints.append(sub.endpoint)

            except Exception as e:
                results["failed"] += 1
                results["errors"].append(str(e))
                logger.error(f"[PUSH] Error inesperado: {e}")

        # Limpiar endpoints invalidos
        if failed_endpoints:
            self._cleanup_invalid_endpoints(failed_endpoints)

        logger.info(
            f"[PUSH] Enviado a usuario {user_id}: "
            f"{results['sent']} exitosos, {results['failed']} fallidos"
        )
        return results

    def _cleanup_invalid_endpoints(self, endpoints: List[str]):
        """Elimina endpoints que ya no son validos."""
        if not endpoints:
            return
        try:
            with get_db_transaction() as conn:
                cur = conn.cursor()
                # Usar IN con placeholders dinamicos (SQLite compatible)
                placeholders = ",".join(["?"] * len(endpoints))
                cur.execute(
                    f"""
                    DELETE FROM push_subscriptions
                    WHERE endpoint IN ({placeholders})
                """,
                    tuple(endpoints),
                )
            logger.info(f"[PUSH] Limpiados {len(endpoints)} endpoints invalidos")
        except Exception as e:
            logger.error(f"[PUSH] Error limpiando endpoints: {e}")

    def cleanup_inactive_subscriptions(self, days: int = 30) -> int:
        """
        FIX 4.5: Elimina suscripciones inactivas (zombies).

        Elimina suscripciones que no han sido usadas en los ultimos N dias.
        Esto previene acumulacion de endpoints obsoletos.

        Args:
            days: Dias de inactividad para considerar zombie (default 30)

        Returns:
            Numero de suscripciones eliminadas
        """
        try:
            with get_db_transaction() as conn:
                cur = conn.cursor()
                # SQLite/PostgreSQL compatible datetime calculation
                cur.execute(
                    """
                    DELETE FROM push_subscriptions
                    WHERE last_used_at IS NOT NULL
                      AND last_used_at < datetime('now', ? || ' days')
                """,
                    (f"-{days}",),
                )
                deleted = cur.rowcount

                # También limpiar suscripciones que nunca fueron usadas
                # y tienen más de 7 días de creación (pruebas abandonadas)
                cur.execute(
                    """
                    DELETE FROM push_subscriptions
                    WHERE last_used_at IS NULL
                      AND created_at < datetime('now', '-7 days')
                """
                )
                deleted += cur.rowcount

            if deleted > 0:
                logger.info(f"[PUSH] Limpiadas {deleted} suscripciones inactivas (zombies)")
            return deleted
        except Exception as e:
            logger.error(f"[PUSH] Error limpiando suscripciones inactivas: {e}")
            return 0

    def send_push_to_many(
        self, user_ids: List[str], title: str, body: str, **kwargs
    ) -> Dict[str, Any]:
        """
        Envia notificacion push a multiples usuarios.

        Returns:
            Dict con resultados agregados
        """
        total_results = {"sent": 0, "failed": 0, "errors": []}

        for user_id in user_ids:
            result = self.send_push(user_id, title, body, **kwargs)
            total_results["sent"] += result["sent"]
            total_results["failed"] += result["failed"]
            total_results["errors"].extend(result["errors"])

        return total_results


# Instancia global del servicio
push_service = PushService()


# Funciones helper para uso directo
def send_push_notification(
    user_id: str,
    title: str,
    body: str,
    tipo: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Envia una notificacion push al usuario.

    Args:
        user_id: ID del usuario destinatario
        title: Titulo de la notificacion
        body: Cuerpo del mensaje
        tipo: Tipo de notificacion para seleccionar icono (ej: solicitud_approved)
        **kwargs: Parametros adicionales (url, tag, data)
    """
    return push_service.send_push(user_id, title, body, tipo=tipo, **kwargs)


def get_vapid_public_key() -> str:
    """Obtiene la clave publica VAPID para el frontend."""
    return get_vapid_public_key_base64()
