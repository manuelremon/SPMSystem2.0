"""
Sistema de Rate Limiting para SPM API.
Sprint 10.1 - Proteccion contra abuso de API.

Provee:
- Limite de requests por IP/usuario
- Configuracion por endpoint
- Headers de rate limit en respuestas
- Integracion con metricas
- Backend Redis compartido entre workers Gunicorn (con fallback a memoria)
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


# ---------------------------------------------------------------------------
# Lua script for atomic token-bucket operations in Redis.
#
# KEYS[1]  = bucket key (string)
# ARGV[1]  = max_tokens  (requests per window)
# ARGV[2]  = refill_rate (tokens per second = requests / window_seconds)
# ARGV[3]  = now         (unix timestamp as float, passed as string)
# ARGV[4]  = burst       (extra tokens beyond max_tokens)
#
# Returns: {allowed (0|1), floor(remaining_tokens)}
# ---------------------------------------------------------------------------
_TOKEN_BUCKET_LUA = """
local key          = KEYS[1]
local max_tokens   = tonumber(ARGV[1])
local refill_rate  = tonumber(ARGV[2])
local now          = tonumber(ARGV[3])
local burst        = tonumber(ARGV[4])
local max_capacity = max_tokens + burst

local bucket      = redis.call('hmget', key, 'tokens', 'last_update')
local tokens      = tonumber(bucket[1])
local last_update = tonumber(bucket[2])

if tokens == nil then
    tokens      = max_capacity
    last_update = now
end

local elapsed = math.max(0, now - last_update)
tokens        = math.min(max_capacity, tokens + elapsed * refill_rate)

local allowed = 0
if tokens >= 1 then
    tokens  = tokens - 1
    allowed = 1
end

redis.call('hmset', key, 'tokens', tokens, 'last_update', now)
redis.call('expire', key, 3600)

return {allowed, math.floor(tokens)}
"""


@dataclass
class RateLimitConfig:
    """Configuracion de rate limit."""

    requests: int = 100  # Numero de requests permitidos
    window_seconds: int = 60  # Ventana de tiempo en segundos
    burst: int = 10  # Requests adicionales permitidos en rafaga
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

    Cuando Redis esta disponible, el estado del bucket se almacena en Redis
    de forma atomica (via Lua script), lo que garantiza limites correctos
    con multiples workers Gunicorn. Si Redis no esta disponible o falla,
    se usa el backend en memoria como fallback.
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

        # Redis state (lazy-initialised on first check_rate_limit call)
        self._redis = None
        self._redis_checked: bool = False
        self._lua_script = None  # compiled redis.register_script handle

    # -----------------------------------------------------------------------
    # Redis initialisation (lazy, called once)
    # -----------------------------------------------------------------------

    def _init_redis(self) -> None:
        """Try to obtain the shared Redis client from the cache module."""
        try:
            from backend.core.cache import _redis_available, _redis_client

            if _redis_available and _redis_client:
                self._redis = _redis_client
                self._lua_script = self._redis.register_script(_TOKEN_BUCKET_LUA)
                logger.info("Rate limiter using Redis backend (shared between workers)")
        except Exception as exc:
            logger.debug("Rate limiter Redis init skipped: %s", exc)

    # -----------------------------------------------------------------------
    # Endpoint configuration & helpers
    # -----------------------------------------------------------------------

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

    def _get_request_ip(self) -> str:
        """Extrae la IP del request actual."""
        ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        if not ip:
            ip = request.headers.get("X-Real-IP", request.remote_addr)
        return ip or request.remote_addr

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

        # Si es un cliente nuevo (tokens=0 y primer request), inicializar con el maximo
        if state.tokens == 0 and state.request_count == 0:
            state.tokens = config.requests + config.burst
        else:
            # Agregar tokens basado en tiempo transcurrido
            state.tokens = min(
                config.requests + config.burst,  # Maximo con burst
                state.tokens + elapsed * rate,
            )
        state.last_update = now

    # -----------------------------------------------------------------------
    # IP block helpers (in-memory + Redis)
    # -----------------------------------------------------------------------

    def _is_ip_blocked_redis(self, ip: str) -> Optional[float]:
        """
        Check Redis for a blocked IP.

        Returns the unblock timestamp (float) if blocked, None otherwise.
        """
        try:
            raw = self._redis.get(f"rate_limit:blocked:{ip}")
            if raw is not None:
                return float(raw)
        except Exception as exc:
            logger.debug("Redis blocked-IP check failed: %s", exc)
        return None

    # -----------------------------------------------------------------------
    # Core rate-limit logic (Redis-backed)
    # -----------------------------------------------------------------------

    def _check_rate_limit_redis(
        self, client_key: str, config: RateLimitConfig
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check rate limit using Redis atomic token bucket.

        The Lua script guarantees atomicity across workers.
        Key format: rate_limit:bucket:<client_key>
        """
        redis_key = f"rate_limit:bucket:{client_key}"
        refill_rate = config.requests / config.window_seconds
        now = time.time()

        result = self._lua_script(
            keys=[redis_key],
            args=[
                str(config.requests),
                str(refill_rate),
                str(now),
                str(config.burst),
            ],
        )

        allowed_flag, remaining = int(result[0]), int(result[1])

        if allowed_flag:
            reset_time = int(now + config.window_seconds)
            return True, {
                "X-RateLimit-Limit": config.requests,
                "X-RateLimit-Remaining": remaining,
                "X-RateLimit-Reset": reset_time,
            }
        else:
            reset_time = int(now + config.window_seconds)
            retry_after = max(1, reset_time - int(now))
            self._record_rate_limit_hit(client_key, "")
            return False, {
                "X-RateLimit-Limit": config.requests,
                "X-RateLimit-Remaining": 0,
                "X-RateLimit-Reset": reset_time,
                "Retry-After": retry_after,
            }

    # -----------------------------------------------------------------------
    # Core rate-limit logic (in-memory, original implementation)
    # -----------------------------------------------------------------------

    def _check_rate_limit_memory(
        self, client_key: str, path: str, config: RateLimitConfig
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check rate limit using the in-memory token bucket (original logic).

        This is called when Redis is unavailable or raises an exception.
        """
        with self._lock:
            # Obtener/crear estado del cliente
            state = self._client_states[client_key]

            # Rellenar tokens
            self._refill_tokens(state, config)

            # Verificar si hay tokens disponibles
            if state.tokens >= 1:
                state.tokens -= 1
                state.request_count += 1

                remaining = int(state.tokens)
                reset_time = int(time.time() + config.window_seconds)

                return True, {
                    "X-RateLimit-Limit": config.requests,
                    "X-RateLimit-Remaining": remaining,
                    "X-RateLimit-Reset": reset_time,
                }
            else:
                reset_time = int(state.last_update + config.window_seconds)
                retry_after = max(1, reset_time - int(time.time()))

                self._record_rate_limit_hit(client_key, path)

                return False, {
                    "X-RateLimit-Limit": config.requests,
                    "X-RateLimit-Remaining": 0,
                    "X-RateLimit-Reset": reset_time,
                    "Retry-After": retry_after,
                }

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

    def check_rate_limit(self, path: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Verifica si el request esta dentro del rate limit.

        Tries Redis first (shared between Gunicorn workers). Falls back to
        the in-memory token bucket when Redis is unavailable.

        Args:
            path: Path del request

        Returns:
            Tupla (permitido, info_headers)
        """
        # Lazy Redis initialisation (done once per process)
        if not self._redis_checked:
            self._init_redis()
            self._redis_checked = True

        config = self._get_config(path)
        client_key = self._get_client_key(config)
        ip = self._get_request_ip()

        # ------------------------------------------------------------------
        # Check whether this IP is blocked (Redis first, then memory)
        # ------------------------------------------------------------------
        if self._redis:
            try:
                unblock_ts = self._is_ip_blocked_redis(ip)
                if unblock_ts is not None:
                    now = time.time()
                    if now < unblock_ts:
                        retry_after = int(unblock_ts - now)
                        return False, {
                            "X-RateLimit-Limit": config.requests,
                            "X-RateLimit-Remaining": 0,
                            "X-RateLimit-Reset": int(unblock_ts),
                            "Retry-After": retry_after,
                        }
                    else:
                        # Expired block — remove it
                        try:
                            self._redis.delete(f"rate_limit:blocked:{ip}")
                        except Exception:
                            pass
            except Exception as exc:
                logger.debug("Redis block-check failed, using memory: %s", exc)
                # Fall through to in-memory block check below

        # Always check in-memory blocks (covers the no-Redis path and
        # ensures block_ip() always works regardless of Redis state)
        with self._lock:
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

        # ------------------------------------------------------------------
        # Token bucket: try Redis, fall back to memory
        # ------------------------------------------------------------------
        if self._redis:
            try:
                return self._check_rate_limit_redis(client_key, config)
            except Exception as exc:
                logger.warning("Redis rate limit failed, falling back to memory: %s", exc)

        return self._check_rate_limit_memory(client_key, path, config)

    def block_ip(self, ip: str, duration_seconds: int = 3600) -> None:
        """
        Bloquea una IP temporalmente.

        Writes to both Redis (for cross-worker visibility) and the local
        in-memory dict (so tests and the in-process path still work).

        Args:
            ip: IP a bloquear
            duration_seconds: Duracion del bloqueo
        """
        unblock_at = time.time() + duration_seconds

        with self._lock:
            self._blocked_ips[ip] = unblock_at

        if self._redis:
            try:
                self._redis.setex(
                    f"rate_limit:blocked:{ip}",
                    duration_seconds,
                    str(unblock_at),
                )
            except Exception as exc:
                logger.debug("Redis block_ip failed (memory fallback active): %s", exc)

        logger.warning("IP bloqueada: %s por %ss", ip, duration_seconds)

    def unblock_ip(self, ip: str) -> bool:
        """
        Desbloquea una IP.

        Removes from both Redis and the local in-memory dict.

        Args:
            ip: IP a desbloquear

        Returns:
            True si estaba bloqueada
        """
        was_blocked = False

        with self._lock:
            if ip in self._blocked_ips:
                del self._blocked_ips[ip]
                was_blocked = True

        if self._redis:
            try:
                deleted = self._redis.delete(f"rate_limit:blocked:{ip}")
                was_blocked = was_blocked or bool(deleted)
            except Exception as exc:
                logger.debug("Redis unblock_ip failed: %s", exc)

        if was_blocked:
            logger.info("IP desbloqueada: %s", ip)

        return was_blocked

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
            stats = {
                "active_clients": len(self._client_states),
                "blocked_ips": len(self._blocked_ips),
                "endpoint_configs": len(self._endpoint_configs),
                "blocked_ip_list": list(self._blocked_ips.keys()),
                "backend": "redis" if self._redis else "memory",
            }
        return stats

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
                key
                for key, state in self._client_states.items()
                if now - state.last_update > 3600
            ]
            for key in expired_clients:
                del self._client_states[key]
                cleaned += 1

            # Limpiar IPs desbloqueadas del dict en memoria
            expired_ips = [
                ip for ip, unblock_time in self._blocked_ips.items() if now > unblock_time
            ]
            for ip in expired_ips:
                del self._blocked_ips[ip]

        return cleaned

    def reset(self) -> None:
        """Reinicia el rate limiter (borra estado en memoria)."""
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
        "/api/auth/login", requests=10, window_seconds=60, burst=5, by_user=False, by_ip=True
    )
    limiter.configure_endpoint(
        "/api/auth/register", requests=20, window_seconds=60, burst=5, by_user=False, by_ip=True
    )
    limiter.configure_endpoint("/api/auth/refresh", requests=100, window_seconds=60, burst=20)

    # Endpoints de escritura (moderados)
    limiter.configure_endpoint("/api/solicitudes", requests=500, window_seconds=60, burst=100)

    # Endpoints de lectura (mas permisivos)
    limiter.configure_endpoint("/api/catalogos", requests=1000, window_seconds=60, burst=200)
    limiter.configure_endpoint("/api/materiales", requests=1000, window_seconds=60, burst=200)
    limiter.configure_endpoint("/api/notificaciones", requests=1000, window_seconds=60, burst=200)
    limiter.configure_endpoint("/api/kpis", requests=1000, window_seconds=60, burst=200)
    limiter.configure_endpoint("/api/admin", requests=1000, window_seconds=60, burst=200)

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
