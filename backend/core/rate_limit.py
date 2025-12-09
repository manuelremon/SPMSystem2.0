"""
Sistema de Rate Limiting para SPM API.
Sprint 10.1 - Proteccion contra abuso de API.

Provee:
- Limite de requests por IP/usuario
- Configuracion por endpoint
- Headers de rate limit en respuestas
- Integracion con metricas
"""

import logging
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from functools import wraps
from typing import Any, Callable, Dict, Optional, Tuple

from flask import g, jsonify, request

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Configuracion de rate limit."""

    requests: int = 500  # Numero de requests permitidos (aumentado para dev)
    window_seconds: int = 60  # Ventana de tiempo en segundos
    burst: int = 50  # Requests adicionales permitidos en rafaga (aumentado)
    by_user: bool = True  # Limitar por usuario autenticado
    by_ip: bool = True  # Limitar por IP


@dataclass
class RateLimitState:
    """Estado del rate limit para un cliente."""

    tokens: float = 0.0
    last_update: float = field(default_factory=time.time)
    request_count: int = 0
    window_start: float = field(default_factory=time.time)


class RateLimiter:
    """
    Implementacion de rate limiting usando token bucket.

    Cada cliente tiene un bucket de tokens que se rellenan
    a una tasa constante. Cada request consume un token.
    """

    def __init__(self, default_config: Optional[RateLimitConfig] = None):
        """
        Inicializa el rate limiter.

        Args:
            default_config: Configuracion por defecto
        """
        self._lock = threading.RLock()
        self._default_config = default_config or RateLimitConfig()
        self._endpoint_configs: Dict[str, RateLimitConfig] = {}
        self._client_states: Dict[str, RateLimitState] = defaultdict(RateLimitState)
        self._blocked_ips: Dict[str, float] = {}  # IP -> tiempo de desbloqueo

    def configure_endpoint(
        self,
        pattern: str,
        requests: int = 100,
        window_seconds: int = 60,
        burst: int = 10,
        by_user: bool = True,
        by_ip: bool = True,
    ) -> None:
        """
        Configura rate limit para un patron de endpoint.

        Args:
            pattern: Patron de URL (ej: "/api/auth/login")
            requests: Requests por ventana
            window_seconds: Duracion de ventana
            burst: Rafaga permitida
            by_user: Limitar por usuario
            by_ip: Limitar por IP
        """
        self._endpoint_configs[pattern] = RateLimitConfig(
            requests=requests,
            window_seconds=window_seconds,
            burst=burst,
            by_user=by_user,
            by_ip=by_ip,
        )

    def _get_config(self, path: str) -> RateLimitConfig:
        """Obtiene configuracion para un path."""
        # Buscar match exacto primero
        if path in self._endpoint_configs:
            return self._endpoint_configs[path]

        # Buscar match por prefijo
        for pattern, config in self._endpoint_configs.items():
            if path.startswith(pattern):
                return config

        return self._default_config

    def _get_client_key(self, config: RateLimitConfig) -> str:
        """
        Genera clave unica para identificar al cliente.

        Args:
            config: Configuracion de rate limit

        Returns:
            Clave unica del cliente
        """
        parts = []

        if config.by_ip:
            # Obtener IP real (considerar proxies)
            ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            if not ip:
                ip = request.headers.get("X-Real-IP", request.remote_addr)
            parts.append(f"ip:{ip}")

        if config.by_user and hasattr(g, "user") and g.user:
            user_id = g.user.get("id") or g.user.get("user_id")
            if user_id:
                parts.append(f"user:{user_id}")

        return ":".join(parts) if parts else "anonymous"

    def _refill_tokens(self, state: RateLimitState, config: RateLimitConfig) -> None:
        """
        Rellena tokens basado en tiempo transcurrido.

        Args:
            state: Estado del cliente
            config: Configuracion
        """
        now = time.time()
        elapsed = now - state.last_update

        # Tasa de reposicion: requests por segundo
        rate = config.requests / config.window_seconds

        # Agregar tokens
        state.tokens = min(
            config.requests + config.burst,  # Maximo con burst
            state.tokens + elapsed * rate,
        )
        state.last_update = now

    def check_rate_limit(self, path: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Verifica si el request esta dentro del rate limit.

        Args:
            path: Path del request

        Returns:
            Tupla (permitido, info_headers)
        """
        config = self._get_config(path)
        client_key = self._get_client_key(config)

        with self._lock:
            # Verificar si IP esta bloqueada
            ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            if not ip:
                ip = request.remote_addr

            if ip in self._blocked_ips:
                if time.time() < self._blocked_ips[ip]:
                    retry_after = int(self._blocked_ips[ip] - time.time())
                    return False, {
                        "X-RateLimit-Limit": config.requests,
                        "X-RateLimit-Remaining": 0,
                        "X-RateLimit-Reset": int(self._blocked_ips[ip]),
                        "Retry-After": retry_after,
                    }
                else:
                    del self._blocked_ips[ip]

            # Obtener/crear estado del cliente
            state = self._client_states[client_key]

            # Rellenar tokens
            self._refill_tokens(state, config)

            # Verificar si hay tokens disponibles
            if state.tokens >= 1:
                state.tokens -= 1
                state.request_count += 1

                # Calcular remaining y reset
                remaining = int(state.tokens)
                reset_time = int(time.time() + config.window_seconds)

                return True, {
                    "X-RateLimit-Limit": config.requests,
                    "X-RateLimit-Remaining": remaining,
                    "X-RateLimit-Reset": reset_time,
                }
            else:
                # Rate limit excedido
                reset_time = int(state.last_update + config.window_seconds)
                retry_after = max(1, reset_time - int(time.time()))

                # Registrar en metricas
                self._record_rate_limit_hit(client_key, path)

                return False, {
                    "X-RateLimit-Limit": config.requests,
                    "X-RateLimit-Remaining": 0,
                    "X-RateLimit-Reset": reset_time,
                    "Retry-After": retry_after,
                }

    def block_ip(self, ip: str, duration_seconds: int = 3600) -> None:
        """
        Bloquea una IP temporalmente.

        Args:
            ip: IP a bloquear
            duration_seconds: Duracion del bloqueo
        """
        with self._lock:
            self._blocked_ips[ip] = time.time() + duration_seconds
            logger.warning(f"IP bloqueada: {ip} por {duration_seconds}s")

    def unblock_ip(self, ip: str) -> bool:
        """
        Desbloquea una IP.

        Args:
            ip: IP a desbloquear

        Returns:
            True si estaba bloqueada
        """
        with self._lock:
            if ip in self._blocked_ips:
                del self._blocked_ips[ip]
                logger.info(f"IP desbloqueada: {ip}")
                return True
            return False

    def _record_rate_limit_hit(self, client_key: str, path: str) -> None:
        """Registra hit de rate limit en metricas."""
        try:
            from backend.core.metrics import get_metrics_collector

            collector = get_metrics_collector()
            collector.increment_counter("rate_limit_hits")
        except ImportError:
            pass

    def get_stats(self) -> Dict[str, Any]:
        """
        Obtiene estadisticas del rate limiter.

        Returns:
            Estadisticas
        """
        with self._lock:
            return {
                "active_clients": len(self._client_states),
                "blocked_ips": len(self._blocked_ips),
                "endpoint_configs": len(self._endpoint_configs),
                "blocked_ip_list": list(self._blocked_ips.keys()),
            }

    def cleanup_expired(self) -> int:
        """
        Limpia estados expirados.

        Returns:
            Numero de estados limpiados
        """
        now = time.time()
        cleaned = 0

        with self._lock:
            # Limpiar estados inactivos (mas de 1 hora)
            expired_clients = [
                key for key, state in self._client_states.items() if now - state.last_update > 3600
            ]
            for key in expired_clients:
                del self._client_states[key]
                cleaned += 1

            # Limpiar IPs desbloqueadas
            expired_ips = [
                ip for ip, unblock_time in self._blocked_ips.items() if now > unblock_time
            ]
            for ip in expired_ips:
                del self._blocked_ips[ip]

        return cleaned

    def reset(self) -> None:
        """Reinicia el rate limiter."""
        with self._lock:
            self._client_states.clear()
            self._blocked_ips.clear()


# =============================================================================
# Singleton global
# =============================================================================

_rate_limiter: Optional[RateLimiter] = None
_limiter_lock = threading.Lock()


def get_rate_limiter() -> RateLimiter:
    """
    Obtiene el rate limiter global (singleton).

    Returns:
        Instancia del RateLimiter
    """
    global _rate_limiter
    if _rate_limiter is None:
        with _limiter_lock:
            if _rate_limiter is None:
                _rate_limiter = RateLimiter()
                _configure_default_limits(_rate_limiter)
    return _rate_limiter


def _configure_default_limits(limiter: RateLimiter) -> None:
    """Configura limites por defecto para endpoints comunes."""
    # Endpoints de autenticacion (mas restrictivos)
    limiter.configure_endpoint(
        "/api/auth/login", requests=50, window_seconds=60, burst=10, by_user=False, by_ip=True
    )
    limiter.configure_endpoint(
        "/api/auth/register", requests=20, window_seconds=60, burst=5, by_user=False, by_ip=True
    )
    limiter.configure_endpoint("/api/auth/refresh", requests=100, window_seconds=60, burst=20)

    # Endpoints de escritura (moderados)
    limiter.configure_endpoint("/api/solicitudes", requests=200, window_seconds=60, burst=50)

    # Endpoints de lectura (mas permisivos)
    limiter.configure_endpoint("/api/catalogos", requests=500, window_seconds=60, burst=100)
    limiter.configure_endpoint("/api/materiales", requests=500, window_seconds=60, burst=100)
    limiter.configure_endpoint("/api/notificaciones", requests=500, window_seconds=60, burst=100)
    limiter.configure_endpoint("/api/admin", requests=500, window_seconds=60, burst=100)

    # Health checks (sin limite)
    limiter.configure_endpoint("/health", requests=1000, window_seconds=60, burst=100)
    limiter.configure_endpoint("/api/health", requests=1000, window_seconds=60, burst=100)


# =============================================================================
# Middleware para Flask
# =============================================================================


def init_rate_limiting(app) -> None:
    """
    Inicializa middleware de rate limiting para Flask.

    Args:
        app: Aplicacion Flask
    """
    limiter = get_rate_limiter()

    @app.before_request
    def check_rate_limit():
        # Ignorar OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            return None

        allowed, headers = limiter.check_rate_limit(request.path)

        # Guardar headers para after_request
        g.rate_limit_headers = headers

        if not allowed:
            response = jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "rate_limit_exceeded",
                        "message": "Too many requests. Please try again later.",
                        "retry_after": headers.get("Retry-After", 60),
                    },
                }
            )
            response.status_code = 429

            # Agregar headers
            for key, value in headers.items():
                response.headers[key] = str(value)

            return response

    @app.after_request
    def add_rate_limit_headers(response):
        # Agregar headers de rate limit a todas las respuestas
        if hasattr(g, "rate_limit_headers"):
            for key, value in g.rate_limit_headers.items():
                if key != "Retry-After":  # Solo en 429
                    response.headers[key] = str(value)

        return response


# =============================================================================
# Decorador para rate limiting personalizado
# =============================================================================


def rate_limit(
    requests: int = 100,
    window_seconds: int = 60,
    burst: int = 10,
    by_user: bool = True,
    by_ip: bool = True,
):
    """
    Decorador para aplicar rate limiting personalizado a una funcion.

    Args:
        requests: Requests por ventana
        window_seconds: Duracion de ventana
        burst: Rafaga permitida
        by_user: Limitar por usuario
        by_ip: Limitar por IP

    Usage:
        @rate_limit(requests=10, window_seconds=60)
        def sensitive_endpoint():
            ...
    """

    def decorator(func: Callable):
        # Crear configuracion especifica
        config = RateLimitConfig(
            requests=requests,
            window_seconds=window_seconds,
            burst=burst,
            by_user=by_user,
            by_ip=by_ip,
        )

        @wraps(func)
        def wrapper(*args, **kwargs):
            limiter = get_rate_limiter()

            # Usar path de la funcion como key
            path = f"__custom__:{func.__module__}.{func.__name__}"

            # Registrar config temporal
            limiter._endpoint_configs[path] = config

            allowed, headers = limiter.check_rate_limit(path)
            g.rate_limit_headers = headers

            if not allowed:
                return (
                    jsonify(
                        {
                            "ok": False,
                            "error": {
                                "code": "rate_limit_exceeded",
                                "message": "Too many requests",
                                "retry_after": headers.get("Retry-After", 60),
                            },
                        }
                    ),
                    429,
                )

            return func(*args, **kwargs)

        return wrapper

    return decorator
