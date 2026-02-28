"""
Cache system with TTL support - in-memory with optional Redis L2.

This cache is designed for:
- Frequently accessed catalog data (sectores, centros, almacenes)
- User session data
- Configuration that rarely changes

When Redis is available (production), acts as L1 (memory) + L2 (Redis)
for sharing cache across multiple gunicorn workers.
"""

import hashlib
import json
import logging
import threading
import time
from functools import wraps
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)

_redis_client = None
_redis_available = False


class TTLCache:
    """
    Thread-safe in-memory cache with Time-To-Live support.
    When Redis is initialized, acts as L1 (memory) + L2 (Redis).

    Usage:
        cache = TTLCache(default_ttl=300)  # 5 minutes default
        cache.set("key", "value")
        value = cache.get("key")  # Returns "value" or None if expired
    """

    def __init__(self, default_ttl: int = 300, max_size: int = 1000, prefix: str = ""):
        self._cache: Dict[str, tuple] = {}  # {key: (value, expiry_time)}
        self._lock = threading.RLock()
        self._default_ttl = default_ttl
        self._max_size = max_size
        self._prefix = prefix
        self._hits = 0
        self._misses = 0

    def _redis_key(self, key: str) -> str:
        return f"spm:{self._prefix}:{key}" if self._prefix else f"spm:{key}"

    def get(self, key: str) -> Optional[Any]:
        """Get value from L1 (memory), then L2 (Redis) if available."""
        with self._lock:
            # L1: Memory
            if key in self._cache:
                value, expiry = self._cache[key]
                if time.time() <= expiry:
                    self._hits += 1
                    return value
                del self._cache[key]

        # L2: Redis (outside lock to avoid holding it during I/O)
        if _redis_available and _redis_client:
            try:
                raw = _redis_client.get(self._redis_key(key))
                if raw is not None:
                    value = json.loads(raw)
                    # Populate L1
                    ttl_remaining = _redis_client.ttl(self._redis_key(key))
                    if ttl_remaining > 0:
                        with self._lock:
                            self._cache[key] = (value, time.time() + ttl_remaining)
                            self._hits += 1
                    return value
            except Exception:
                pass

        with self._lock:
            self._misses += 1
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in L1 (memory) and L2 (Redis) if available."""
        if ttl is None:
            ttl = self._default_ttl

        with self._lock:
            if len(self._cache) >= self._max_size:
                self._cleanup_expired()
                if len(self._cache) >= self._max_size:
                    self._evict_oldest(self._max_size // 4)
            self._cache[key] = (value, time.time() + ttl)

        # L2: Redis
        if _redis_available and _redis_client:
            try:
                _redis_client.setex(self._redis_key(key), ttl, json.dumps(value, default=str))
            except Exception:
                pass

    def delete(self, key: str) -> bool:
        """Delete a specific key from L1 and L2."""
        deleted = False
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                deleted = True
        if _redis_available and _redis_client:
            try:
                _redis_client.delete(self._redis_key(key))
            except Exception:
                pass
        return deleted

    def clear(self) -> None:
        """Clear all cache entries from L1 and matching L2 keys."""
        with self._lock:
            self._cache.clear()
        if _redis_available and _redis_client and self._prefix:
            try:
                pattern = f"spm:{self._prefix}:*"
                cursor = 0
                while True:
                    cursor, keys = _redis_client.scan(cursor, match=pattern, count=100)
                    if keys:
                        _redis_client.delete(*keys)
                    if cursor == 0:
                        break
            except Exception:
                pass
        logger.info("Cache cleared")

    def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all keys containing the pattern.

        Args:
            pattern: String pattern to match in keys

        Returns:
            Number of keys invalidated
        """
        with self._lock:
            keys_to_delete = [k for k in self._cache if pattern in k]
            for key in keys_to_delete:
                del self._cache[key]
            if keys_to_delete:
                logger.debug(
                    f"Invalidated {len(keys_to_delete)} cache entries matching '{pattern}'"
                )
            return len(keys_to_delete)

    def _cleanup_expired(self) -> None:
        """Remove all expired entries."""
        now = time.time()
        expired = [k for k, (_, exp) in self._cache.items() if now > exp]
        for key in expired:
            del self._cache[key]

    def _evict_oldest(self, count: int) -> None:
        """Evict oldest entries to make room."""
        sorted_items = sorted(self._cache.items(), key=lambda x: x[1][1])
        for key, _ in sorted_items[:count]:
            del self._cache[key]

    def stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        with self._lock:
            total = self._hits + self._misses
            hit_rate = (self._hits / total * 100) if total > 0 else 0
            return {
                "size": len(self._cache),
                "max_size": self._max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": f"{hit_rate:.1f}%",
                "default_ttl": self._default_ttl,
            }


# =============================================================================
# Global cache instances with different TTLs
# =============================================================================

# Catalog cache: Long TTL (30 minutes) - data rarely changes
catalog_cache = TTLCache(default_ttl=1800, max_size=500, prefix="catalog")

# User cache: Medium TTL (5 minutes) - balance freshness vs performance
user_cache = TTLCache(default_ttl=300, max_size=200, prefix="user")

# Query cache: Short TTL (60 seconds) - for expensive queries
query_cache = TTLCache(default_ttl=60, max_size=100, prefix="query")

# KPI cache: Medium TTL (300 seconds / 5 minutes) - for expensive KPI calculations
kpi_cache = TTLCache(default_ttl=300, max_size=50, prefix="kpi")


# =============================================================================
# Decorators for easy caching
# =============================================================================


def cached(cache: TTLCache, key_prefix: str = "", ttl: Optional[int] = None):
    """
    Decorator to cache function results.

    Usage:
        @cached(catalog_cache, "centros")
        def get_centros():
            return db_query(...)

    Args:
        cache: TTLCache instance to use
        key_prefix: Prefix for cache key
        ttl: Optional custom TTL (uses cache default if None)
    """

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Build cache key from function name and arguments
            key_parts = [key_prefix or func.__name__]
            if args:
                key_parts.append(str(args))
            if kwargs:
                key_parts.append(str(sorted(kwargs.items())))
            cache_key = ":".join(key_parts)

            # Try to get from cache
            result = cache.get(cache_key)
            if result is not None:
                logger.debug(f"Cache HIT: {cache_key}")
                return result

            # Cache miss - execute function
            logger.debug(f"Cache MISS: {cache_key}")
            result = func(*args, **kwargs)

            # Store in cache (don't cache None results)
            if result is not None:
                cache.set(cache_key, result, ttl)

            return result

        # Add method to invalidate this function's cache
        wrapper.invalidate = lambda: cache.invalidate_pattern(key_prefix or func.__name__)
        wrapper.cache = cache
        wrapper.cache_key_prefix = key_prefix or func.__name__

        return wrapper

    return decorator


def cache_key(*args) -> str:
    """Generate a cache key from arguments."""
    key_str = ":".join(str(a) for a in args)
    if len(key_str) > 100:
        # Hash long keys
        return hashlib.sha256(key_str.encode()).hexdigest()
    return key_str


# =============================================================================
# Cache invalidation helpers
# =============================================================================


def invalidate_catalog_cache():
    """Invalidate all catalog caches (call after admin changes)."""
    catalog_cache.clear()
    logger.info("Catalog cache invalidated")


def invalidate_user_cache(user_id: Optional[str] = None):
    """
    Invalidate user cache.

    Args:
        user_id: If provided, only invalidate that user's cache.
                 If None, clear all user cache.
    """
    if user_id:
        user_cache.invalidate_pattern(f"user:{user_id}")
    else:
        user_cache.clear()
    logger.info(f"User cache invalidated: {user_id or 'ALL'}")


def invalidate_kpi_cache():
    """Invalidate all KPI caches (call after data changes)."""
    kpi_cache.clear()
    logger.info("KPI cache invalidated")


def get_cache_stats() -> Dict[str, Any]:
    """Get statistics for all caches."""
    stats = {
        "catalog_cache": catalog_cache.stats(),
        "user_cache": user_cache.stats(),
        "query_cache": query_cache.stats(),
        "kpi_cache": kpi_cache.stats(),
        "redis_available": _redis_available,
    }
    if _redis_available and _redis_client:
        try:
            info = _redis_client.info("memory")
            stats["redis_memory"] = info.get("used_memory_human", "unknown")
        except Exception:
            pass
    return stats


def init_redis_cache(redis_url: Optional[str] = None) -> bool:
    """
    Initialize Redis as L2 cache backend.
    Call this from app.py after Redis is configured.

    Returns True if Redis was successfully connected.
    """
    global _redis_client, _redis_available

    if not redis_url:
        import os
        redis_url = os.environ.get("REDIS_URL")

    if not redis_url:
        logger.info("No REDIS_URL configured, using memory-only cache")
        return False

    try:
        import redis
        _redis_client = redis.from_url(redis_url, decode_responses=True)
        _redis_client.ping()
        _redis_available = True
        logger.info(f"Redis L2 cache connected: {redis_url.split('@')[-1] if '@' in redis_url else redis_url}")
        return True
    except ImportError:
        logger.info("redis package not installed, using memory-only cache")
        return False
    except Exception as e:
        logger.warning(f"Redis connection failed ({e}), using memory-only cache")
        _redis_client = None
        _redis_available = False
        return False
