"""
Simple in-memory cache with TTL support for improving performance.

This cache is designed for:
- Frequently accessed catalog data (sectores, centros, almacenes)
- User session data
- Configuration that rarely changes

No external dependencies required (Redis, Memcached, etc.)
"""

import hashlib
import logging
import threading
import time
from functools import wraps
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)


class TTLCache:
    """
    Thread-safe in-memory cache with Time-To-Live support.

    Usage:
        cache = TTLCache(default_ttl=300)  # 5 minutes default
        cache.set("key", "value")
        value = cache.get("key")  # Returns "value" or None if expired
    """

    def __init__(self, default_ttl: int = 300, max_size: int = 1000):
        """
        Initialize cache.

        Args:
            default_ttl: Default time-to-live in seconds (default: 5 minutes)
            max_size: Maximum number of items to store (prevents memory bloat)
        """
        self._cache: Dict[str, tuple] = {}  # {key: (value, expiry_time)}
        self._lock = threading.RLock()
        self._default_ttl = default_ttl
        self._max_size = max_size
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None

            value, expiry = self._cache[key]
            if time.time() > expiry:
                # Expired
                del self._cache[key]
                self._misses += 1
                return None

            self._hits += 1
            return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with optional custom TTL."""
        with self._lock:
            # Cleanup if we're at max size
            if len(self._cache) >= self._max_size:
                self._cleanup_expired()
                # If still at max, remove oldest entries
                if len(self._cache) >= self._max_size:
                    self._evict_oldest(self._max_size // 4)

            expiry = time.time() + (ttl if ttl is not None else self._default_ttl)
            self._cache[key] = (value, expiry)

    def delete(self, key: str) -> bool:
        """Delete a specific key from cache."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()
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

# Catalog cache: Long TTL (10 minutes) - data rarely changes
catalog_cache = TTLCache(default_ttl=600, max_size=500)

# User cache: Medium TTL (2 minutes) - balance freshness vs performance
user_cache = TTLCache(default_ttl=120, max_size=200)

# Query cache: Short TTL (30 seconds) - for expensive queries
query_cache = TTLCache(default_ttl=30, max_size=100)


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
        return hashlib.md5(key_str.encode()).hexdigest()
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


def get_cache_stats() -> Dict[str, Any]:
    """Get statistics for all caches."""
    return {
        "catalog_cache": catalog_cache.stats(),
        "user_cache": user_cache.stats(),
        "query_cache": query_cache.stats(),
    }
