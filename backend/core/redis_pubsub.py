"""
Redis Pub/Sub para notificaciones en tiempo real

FIX 5.1: Implementación de Redis pub/sub para SSE escalable.
Permite escalar horizontalmente con múltiples workers.

Características:
- Fallback automático a polling si Redis no está disponible
- Reconexión automática
- Canales por usuario para notificaciones personalizadas
- Canal broadcast para notificaciones globales

Uso:
    from backend.core.redis_pubsub import redis_pubsub

    # Publicar notificación
    redis_pubsub.publish_notification(user_id, {"type": "new_notification", ...})

    # Suscribirse a notificaciones
    for message in redis_pubsub.subscribe_notifications(user_id):
        yield message
"""

import json
import logging
import os
import threading
import time
from typing import Any, Callable, Dict, Generator, Optional

logger = logging.getLogger(__name__)

# Intentar importar redis
try:
    import redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    logger.info("Redis no disponible - usando fallback de polling")


class RedisPubSub:
    """
    Gestor de Redis Pub/Sub con fallback automático.

    Si Redis no está disponible o falla, usa polling tradicional.
    """

    # Prefijos para canales
    CHANNEL_USER_PREFIX = "spm:notifications:user:"
    CHANNEL_BROADCAST = "spm:notifications:broadcast"
    CHANNEL_ADMIN = "spm:notifications:admin"

    def __init__(self):
        self._client: Optional["redis.Redis"] = None
        self._connected = False
        self._lock = threading.Lock()
        self._connection_attempts = 0
        self._max_connection_attempts = 1  # FIX: Solo 1 intento, luego deshabilitar
        self._reconnect_delay = 5  # segundos
        self._disabled_until = 0  # Timestamp hasta cuando Redis está deshabilitado
        self._disable_duration = 3600  # FIX: Deshabilitar por 1 hora después de fallar

    def _get_redis_url(self) -> str:
        """Obtiene URL de Redis desde variables de entorno."""
        return os.environ.get(
            "REDIS_URL",
            os.environ.get("REDIS_HOST", "redis://localhost:6379/0")
        )

    def _connect(self) -> bool:
        """
        Intenta conectar a Redis.

        FIX: Implementa cooldown para evitar saturar logs cuando Redis no está disponible.
        Después de fallar, deshabilita Redis por 1 hora.

        Returns:
            True si la conexión fue exitosa, False en caso contrario.
        """
        if not HAS_REDIS:
            return False

        with self._lock:
            # FIX: Verificar si Redis está en cooldown
            current_time = time.time()
            if current_time < self._disabled_until:
                # Redis deshabilitado temporalmente, no intentar
                return False

            if self._connected and self._client:
                try:
                    self._client.ping()
                    return True
                except Exception:
                    self._connected = False

            if self._connection_attempts >= self._max_connection_attempts:
                # FIX: Deshabilitar por 1 hora y resetear contador
                self._disabled_until = current_time + self._disable_duration
                self._connection_attempts = 0
                logger.info(
                    f"[Redis] Deshabilitado por {self._disable_duration}s después de {self._max_connection_attempts} intentos fallidos"
                )
                return False

            try:
                redis_url = self._get_redis_url()
                self._client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_timeout=2,  # FIX: Reducir timeout
                    socket_connect_timeout=2,
                    retry_on_timeout=False  # FIX: No reintentar en timeout
                )
                # Test de conexión
                self._client.ping()
                self._connected = True
                self._connection_attempts = 0
                self._disabled_until = 0  # Limpiar cooldown
                logger.info(f"Conectado a Redis: {redis_url}")
                return True

            except Exception as e:
                self._connection_attempts += 1
                self._connected = False
                # FIX: Solo loguear en el primer intento
                if self._connection_attempts == 1:
                    logger.debug(f"Redis no disponible: {e}")
                return False

    def is_available(self) -> bool:
        """
        Verifica si Redis está disponible.

        Returns:
            True si Redis está conectado y funcionando.
        """
        return self._connect()

    def publish_notification(
        self,
        user_id: str,
        data: Dict[str, Any],
        include_broadcast: bool = False
    ) -> bool:
        """
        Publica una notificación para un usuario específico.

        Args:
            user_id: ID del usuario destinatario
            data: Datos de la notificación (se serializa a JSON)
            include_broadcast: Si True, también publica en canal broadcast

        Returns:
            True si se publicó correctamente, False si Redis no disponible.
        """
        if not self._connect():
            return False

        try:
            message = json.dumps(data)
            channel = f"{self.CHANNEL_USER_PREFIX}{user_id}"

            self._client.publish(channel, message)

            if include_broadcast:
                self._client.publish(self.CHANNEL_BROADCAST, message)

            return True

        except Exception as e:
            logger.error(f"Error publicando notificación: {e}")
            self._connected = False
            return False

    def publish_broadcast(self, data: Dict[str, Any]) -> bool:
        """
        Publica una notificación broadcast a todos los usuarios.

        Args:
            data: Datos de la notificación

        Returns:
            True si se publicó correctamente.
        """
        if not self._connect():
            return False

        try:
            message = json.dumps(data)
            self._client.publish(self.CHANNEL_BROADCAST, message)
            return True

        except Exception as e:
            logger.error(f"Error en broadcast: {e}")
            self._connected = False
            return False

    def publish_admin(self, data: Dict[str, Any]) -> bool:
        """
        Publica notificación solo para administradores.

        Args:
            data: Datos de la notificación

        Returns:
            True si se publicó correctamente.
        """
        if not self._connect():
            return False

        try:
            message = json.dumps(data)
            self._client.publish(self.CHANNEL_ADMIN, message)
            return True

        except Exception as e:
            logger.error(f"Error en admin notification: {e}")
            self._connected = False
            return False

    def subscribe_notifications(
        self,
        user_id: str,
        include_broadcast: bool = True,
        is_admin: bool = False,
        timeout: float = 30.0
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Generador que yield notificaciones para un usuario.

        Este método está diseñado para usarse con SSE.
        Si Redis no está disponible, yield None periódicamente
        para permitir fallback a polling.

        Args:
            user_id: ID del usuario
            include_broadcast: Si incluir notificaciones broadcast
            is_admin: Si incluir canal de admin
            timeout: Timeout para esperar mensajes (segundos)

        Yields:
            Dict con datos de notificación, o None si timeout/no disponible.
        """
        if not self._connect():
            # Redis no disponible - señal para usar fallback
            while True:
                yield None
                time.sleep(timeout)

        try:
            pubsub = self._client.pubsub()

            # Suscribirse a canales
            channels = [f"{self.CHANNEL_USER_PREFIX}{user_id}"]
            if include_broadcast:
                channels.append(self.CHANNEL_BROADCAST)
            if is_admin:
                channels.append(self.CHANNEL_ADMIN)

            pubsub.subscribe(*channels)
            logger.debug(f"Usuario {user_id} suscrito a: {channels}")

            while True:
                try:
                    message = pubsub.get_message(
                        ignore_subscribe_messages=True,
                        timeout=timeout
                    )

                    if message and message.get("type") == "message":
                        try:
                            data = json.loads(message["data"])
                            yield data
                        except json.JSONDecodeError:
                            logger.warning(f"Mensaje malformado: {message}")
                    else:
                        # Timeout - yield None para heartbeat
                        yield None

                except redis.ConnectionError:
                    logger.warning("Conexión Redis perdida, reconectando...")
                    self._connected = False
                    time.sleep(self._reconnect_delay)
                    if not self._connect():
                        break
                    pubsub = self._client.pubsub()
                    pubsub.subscribe(*channels)

        except Exception as e:
            logger.error(f"Error en subscribe: {e}")
            self._connected = False

    def get_stats(self) -> Dict[str, Any]:
        """
        Obtiene estadísticas de Redis.

        Returns:
            Dict con información de estado.
        """
        if not self._connect():
            return {
                "available": False,
                "reason": "Redis not connected",
                "has_redis_lib": HAS_REDIS
            }

        try:
            info = self._client.info("server")
            clients = self._client.info("clients")

            return {
                "available": True,
                "version": info.get("redis_version", "unknown"),
                "connected_clients": clients.get("connected_clients", 0),
                "uptime_seconds": info.get("uptime_in_seconds", 0)
            }

        except Exception as e:
            return {
                "available": False,
                "reason": str(e)
            }

    def close(self):
        """Cierra la conexión a Redis."""
        with self._lock:
            if self._client:
                try:
                    self._client.close()
                except Exception:
                    pass
            self._client = None
            self._connected = False


# Instancia global singleton
redis_pubsub = RedisPubSub()


# Helpers para uso directo
def publish_user_notification(user_id: str, data: Dict[str, Any]) -> bool:
    """Publica notificación a un usuario específico."""
    return redis_pubsub.publish_notification(user_id, data)


def publish_broadcast_notification(data: Dict[str, Any]) -> bool:
    """Publica notificación broadcast."""
    return redis_pubsub.publish_broadcast(data)


def is_redis_available() -> bool:
    """Verifica si Redis está disponible."""
    return redis_pubsub.is_available()
