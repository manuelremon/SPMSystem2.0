"""
Advanced Cache System - Sistema de cache con Redis y fallback en memoria.
Sprint 14 - Cache distribuido para produccion.

Uso:
    from backend.core.cache_advanced import get_cache, cached

    cache = get_cache()
    cache.set("key", {"data": "value"}, ttl=300)
    value = cache.get("key")

    @cached(ttl=60, prefix="user")
    def get_user(user_id: int):
        return db.query(User).get(user_id)
"""

from __future__ import annotations

import functools
import hashlib
import json
import logging
import threading
import time
from abc import ABC, abstractmethod
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, Generic, Optional, TypeVar, Union

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass
class CacheEntry(Generic[T]):
    """Entrada de cache con metadata."""
    value: T
    created_at: float = field(default_factory=time.time)
    expires_at: Optional[float] = None
    hits: int = 0

    def is_expired(self) -> bool:
        """Verifica si la entrada expiro."""
        if self.expires_at is None:
            return False
        return time.time() > self.expires_at


class CacheBackend(ABC):
    """Interfaz abstracta para backends de cache."""

    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        """Obtiene un valor del cache."""
        pass

    @abstractmethod
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Guarda un valor en cache."""
        pass

    @abstractmethod
    def delete(self, key: str) -> bool:
        """Elimina un valor del cache."""
        pass

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Verifica si una clave existe."""
        pass

    @abstractmethod
    def clear(self) -> int:
        """Limpia todo el cache."""
        pass

    @abstractmethod
    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadisticas del cache."""
        pass


class MemoryCache(CacheBackend):
    """Cache en memoria con LRU eviction."""

    def __init__(self, max_size: int = 10000, default_ttl: int = 300):
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[Any]:
        """Obtiene un valor del cache."""
        with self._lock:
            entry = self._cache.get(key)

            if entry is None:
                self._misses += 1
                return None

            if entry.is_expired():
                del self._cache[key]
                self._misses += 1
                return None

            # LRU: mover al final
            self._cache.move_to_end(key)
            entry.hits += 1
            self._hits += 1

            return entry.value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Guarda un valor en cache."""
        if ttl is None:
            ttl = self._default_ttl

        with self._lock:
            # Eviccion LRU si excedemos el tamano
            while len(self._cache) >= self._max_size:
                self._cache.popitem(last=False)

            expires_at = time.time() + ttl if ttl > 0 else None
            self._cache[key] = CacheEntry(
                value=value,
                expires_at=expires_at,
            )
            # Mover al final (mas reciente)
            self._cache.move_to_end(key)

            return True

    def delete(self, key: str) -> bool:
        """Elimina un valor del cache."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def exists(self, key: str) -> bool:
        """Verifica si una clave existe y no expiro."""
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return False
            if entry.is_expired():
                del self._cache[key]
                return False
            return True

    def clear(self) -> int:
        """Limpia todo el cache."""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            return count

    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadisticas del cache."""
        with self._lock:
            total_requests = self._hits + self._misses
            hit_rate = (self._hits / total_requests * 100) if total_requests > 0 else 0

            return {
                "backend": "memory",
                "size": len(self._cache),
                "max_size": self._max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(hit_rate, 2),
                "default_ttl": self._default_ttl,
            }

    def cleanup_expired(self) -> int:
        """Limpia entradas expiradas."""
        with self._lock:
            expired_keys = [
                k for k, v in self._cache.items()
                if v.is_expired()
            ]
            for key in expired_keys:
                del self._cache[key]
            return len(expired_keys)

    def get_many(self, keys: list[str]) -> Dict[str, Any]:
        """Obtiene multiples valores."""
        result = {}
        for key in keys:
            value = self.get(key)
            if value is not None:
                result[key] = value
        return result

    def set_many(self, mapping: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Guarda multiples valores."""
        for key, value in mapping.items():
            self.set(key, value, ttl)
        return True


class RedisCache(CacheBackend):
    """Cache usando Redis como backend."""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: Optional[str] = None,
        default_ttl: int = 300,
        prefix: str = "spm:",
    ):
        self._host = host
        self._port = port
        self._db = db
        self._password = password
        self._default_ttl = default_ttl
        self._prefix = prefix
        self._client = None
        self._hits = 0
        self._misses = 0

        self._connect()

    def _connect(self) -> None:
        """Conecta a Redis."""
        try:
            import redis
            self._client = redis.Redis(
                host=self._host,
                port=self._port,
                db=self._db,
                password=self._password,
                decode_responses=True,
            )
            # Test connection
            self._client.ping()
            logger.info(f"Connected to Redis at {self._host}:{self._port}")
        except ImportError:
            logger.warning("redis package not installed, Redis cache unavailable")
            self._client = None
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")
            self._client = None

    def _key(self, key: str) -> str:
        """Agrega prefijo a la clave."""
        return f"{self._prefix}{key}"

    @property
    def is_available(self) -> bool:
        """Verifica si Redis esta disponible."""
        if self._client is None:
            return False
        try:
            self._client.ping()
            return True
        except Exception:
            return False

    def get(self, key: str) -> Optional[Any]:
        """Obtiene un valor del cache."""
        if not self.is_available:
            return None

        try:
            value = self._client.get(self._key(key))
            if value is None:
                self._misses += 1
                return None

            self._hits += 1
            return json.loads(value)
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            self._misses += 1
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Guarda un valor en cache."""
        if not self.is_available:
            return False

        if ttl is None:
            ttl = self._default_ttl

        try:
            serialized = json.dumps(value)
            if ttl > 0:
                self._client.setex(self._key(key), ttl, serialized)
            else:
                self._client.set(self._key(key), serialized)
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Elimina un valor del cache."""
        if not self.is_available:
            return False

        try:
            return self._client.delete(self._key(key)) > 0
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False

    def exists(self, key: str) -> bool:
        """Verifica si una clave existe."""
        if not self.is_available:
            return False

        try:
            return self._client.exists(self._key(key)) > 0
        except Exception as e:
            logger.error(f"Redis exists error: {e}")
            return False

    def clear(self) -> int:
        """Limpia todas las claves con el prefijo."""
        if not self.is_available:
            return 0

        try:
            keys = self._client.keys(f"{self._prefix}*")
            if keys:
                return self._client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Redis clear error: {e}")
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadisticas del cache."""
        total_requests = self._hits + self._misses
        hit_rate = (self._hits / total_requests * 100) if total_requests > 0 else 0

        stats = {
            "backend": "redis",
            "available": self.is_available,
            "host": self._host,
            "port": self._port,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(hit_rate, 2),
            "default_ttl": self._default_ttl,
        }

        if self.is_available:
            try:
                info = self._client.info("memory")
                stats["used_memory"] = info.get("used_memory_human", "unknown")
            except Exception:
                pass

        return stats


class HybridCache(CacheBackend):
    """Cache hibrido: Redis primario con fallback a memoria."""

    def __init__(
        self,
        redis_host: str = "localhost",
        redis_port: int = 6379,
        redis_password: Optional[str] = None,
        memory_max_size: int = 5000,
        default_ttl: int = 300,
    ):
        self._redis = RedisCache(
            host=redis_host,
            port=redis_port,
            password=redis_password,
            default_ttl=default_ttl,
        )
        self._memory = MemoryCache(
            max_size=memory_max_size,
            default_ttl=default_ttl,
        )
        self._default_ttl = default_ttl

    @property
    def _primary(self) -> CacheBackend:
        """Retorna el backend primario disponible."""
        if self._redis.is_available:
            return self._redis
        return self._memory

    def get(self, key: str) -> Optional[Any]:
        """Obtiene valor, primero de memoria, luego Redis."""
        # Intentar memoria primero (L1)
        value = self._memory.get(key)
        if value is not None:
            return value

        # Si Redis disponible, intentar ahi (L2)
        if self._redis.is_available:
            value = self._redis.get(key)
            if value is not None:
                # Populate L1
                self._memory.set(key, value)
                return value

        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Guarda en ambos caches."""
        self._memory.set(key, value, ttl)

        if self._redis.is_available:
            self._redis.set(key, value, ttl)

        return True

    def delete(self, key: str) -> bool:
        """Elimina de ambos caches."""
        result = self._memory.delete(key)

        if self._redis.is_available:
            self._redis.delete(key)

        return result

    def exists(self, key: str) -> bool:
        """Verifica en memoria o Redis."""
        if self._memory.exists(key):
            return True
        if self._redis.is_available:
            return self._redis.exists(key)
        return False

    def clear(self) -> int:
        """Limpia ambos caches."""
        count = self._memory.clear()

        if self._redis.is_available:
            count += self._redis.clear()

        return count

    def get_stats(self) -> Dict[str, Any]:
        """Estadisticas combinadas."""
        return {
            "backend": "hybrid",
            "memory": self._memory.get_stats(),
            "redis": self._redis.get_stats(),
            "using_redis": self._redis.is_available,
        }


# ==================== Singleton ====================

_cache: Optional[CacheBackend] = None
_cache_lock = threading.Lock()


def get_cache(
    backend: str = "auto",
    **kwargs,
) -> CacheBackend:
    """
    Obtiene la instancia de cache.

    Args:
        backend: "memory", "redis", "hybrid", o "auto"
        **kwargs: Configuracion del backend

    Returns:
        Instancia de cache
    """
    global _cache

    if _cache is None:
        with _cache_lock:
            if _cache is None:
                if backend == "memory":
                    _cache = MemoryCache(**kwargs)
                elif backend == "redis":
                    _cache = RedisCache(**kwargs)
                elif backend == "hybrid":
                    _cache = HybridCache(**kwargs)
                else:  # auto
                    # Intentar Redis, fallback a memoria
                    redis_cache = RedisCache(**kwargs)
                    if redis_cache.is_available:
                        _cache = HybridCache(**kwargs)
                    else:
                        _cache = MemoryCache(**kwargs)

                logger.info(f"Cache initialized: {_cache.get_stats()['backend']}")

    return _cache


def reset_cache() -> None:
    """Resetea el singleton de cache (para tests)."""
    global _cache
    with _cache_lock:
        if _cache:
            _cache.clear()
        _cache = None


# ==================== Decorador ====================

def cached(
    ttl: int = 300,
    prefix: str = "",
    key_builder: Optional[Callable[..., str]] = None,
    unless: Optional[Callable[..., bool]] = None,
):
    """
    Decorador para cachear resultados de funciones.

    Args:
        ttl: Tiempo de vida en segundos
        prefix: Prefijo para la clave
        key_builder: Funcion custom para generar clave
        unless: Funcion que retorna True para no cachear

    Uso:
        @cached(ttl=60, prefix="user")
        def get_user(user_id: int):
            return db.query(User).get(user_id)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Verificar si debemos skipear cache
            if unless and unless(*args, **kwargs):
                return func(*args, **kwargs)

            # Generar clave
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                cache_key = _build_cache_key(func, prefix, args, kwargs)

            # Intentar obtener de cache
            cache = get_cache()
            cached_value = cache.get(cache_key)

            if cached_value is not None:
                return cached_value

            # Ejecutar funcion y cachear resultado
            result = func(*args, **kwargs)

            if result is not None:
                cache.set(cache_key, result, ttl)

            return result

        # Agregar metodo para invalidar cache
        def invalidate(*args, **kwargs):
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                cache_key = _build_cache_key(func, prefix, args, kwargs)
            return get_cache().delete(cache_key)

        wrapper.invalidate = invalidate
        wrapper.cache_prefix = prefix

        return wrapper

    return decorator


def _build_cache_key(
    func: Callable,
    prefix: str,
    args: tuple,
    kwargs: dict,
) -> str:
    """Construye una clave de cache unica."""
    # Base: nombre de funcion
    parts = [prefix, func.__module__, func.__name__]

    # Agregar argumentos
    if args:
        args_str = ":".join(str(a) for a in args)
        parts.append(args_str)

    if kwargs:
        kwargs_str = ":".join(f"{k}={v}" for k, v in sorted(kwargs.items()))
        parts.append(kwargs_str)

    key = ":".join(filter(None, parts))

    # Si es muy largo, usar hash
    if len(key) > 200:
        key = f"{prefix}:{hashlib.md5(key.encode()).hexdigest()}"

    return key


# ==================== Flask Integration ====================

def init_cache(app, backend: str = "auto") -> None:
    """
    Inicializa el sistema de cache en Flask.

    Args:
        app: Aplicacion Flask
        backend: Backend a usar
    """
    # Obtener configuracion de app
    redis_host = app.config.get("REDIS_HOST", "localhost")
    redis_port = app.config.get("REDIS_PORT", 6379)
    redis_password = app.config.get("REDIS_PASSWORD")
    cache_ttl = app.config.get("CACHE_DEFAULT_TTL", 300)

    # Inicializar cache
    cache = get_cache(
        backend=backend,
        redis_host=redis_host,
        redis_port=redis_port,
        redis_password=redis_password,
        default_ttl=cache_ttl,
    )

    app.logger.info(f"Cache system initialized: {cache.get_stats()['backend']}")

    # Agregar cleanup periodico
    @app.teardown_appcontext
    def cleanup_cache(exception=None):
        pass  # Cache persiste entre requests
