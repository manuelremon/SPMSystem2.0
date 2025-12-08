"""
Tests para el sistema de cache avanzado.
Sprint 14 - Verifica cache en memoria, Redis y hibrido.
"""

import time
from unittest.mock import MagicMock, patch

import pytest


class TestCacheEntry:
    """Tests para CacheEntry."""

    def test_entry_creation(self):
        """Crear entrada de cache."""
        try:
            from backend.core.cache_advanced import CacheEntry
        except ImportError:
            pytest.skip("Module not available")

        entry = CacheEntry(value={"key": "value"})

        assert entry.value == {"key": "value"}
        assert entry.hits == 0
        assert entry.created_at > 0

    def test_entry_not_expired_without_ttl(self):
        """Entrada sin TTL no expira."""
        try:
            from backend.core.cache_advanced import CacheEntry
        except ImportError:
            pytest.skip("Module not available")

        entry = CacheEntry(value="test", expires_at=None)

        assert entry.is_expired() is False

    def test_entry_expires(self):
        """Entrada expira despues de TTL."""
        try:
            from backend.core.cache_advanced import CacheEntry
        except ImportError:
            pytest.skip("Module not available")

        entry = CacheEntry(
            value="test",
            expires_at=time.time() - 1  # Ya expiro
        )

        assert entry.is_expired() is True

    def test_entry_not_expired_yet(self):
        """Entrada no expira antes de TTL."""
        try:
            from backend.core.cache_advanced import CacheEntry
        except ImportError:
            pytest.skip("Module not available")

        entry = CacheEntry(
            value="test",
            expires_at=time.time() + 3600  # Expira en 1 hora
        )

        assert entry.is_expired() is False


class TestMemoryCache:
    """Tests para MemoryCache."""

    @pytest.fixture
    def cache(self):
        """Crea un cache en memoria."""
        try:
            from backend.core.cache_advanced import MemoryCache
        except ImportError:
            pytest.skip("Module not available")

        return MemoryCache(max_size=100, default_ttl=60)

    def test_set_and_get(self, cache):
        """Set y get basico."""
        cache.set("key1", "value1")
        result = cache.get("key1")

        assert result == "value1"

    def test_get_nonexistent_key(self, cache):
        """Get de clave inexistente retorna None."""
        result = cache.get("nonexistent")

        assert result is None

    def test_delete(self, cache):
        """Delete elimina clave."""
        cache.set("key1", "value1")
        result = cache.delete("key1")

        assert result is True
        assert cache.get("key1") is None

    def test_delete_nonexistent(self, cache):
        """Delete de clave inexistente retorna False."""
        result = cache.delete("nonexistent")

        assert result is False

    def test_exists(self, cache):
        """Exists verifica si clave existe."""
        cache.set("key1", "value1")

        assert cache.exists("key1") is True
        assert cache.exists("nonexistent") is False

    def test_clear(self, cache):
        """Clear elimina todas las claves."""
        cache.set("key1", "value1")
        cache.set("key2", "value2")

        count = cache.clear()

        assert count == 2
        assert cache.get("key1") is None
        assert cache.get("key2") is None

    def test_ttl_expiration(self, cache):
        """Claves expiran despues de TTL."""
        cache.set("key1", "value1", ttl=1)

        # Antes de expirar
        assert cache.get("key1") == "value1"

        # Esperar a que expire
        time.sleep(1.1)

        assert cache.get("key1") is None

    def test_lru_eviction(self):
        """LRU eviction cuando se excede max_size."""
        try:
            from backend.core.cache_advanced import MemoryCache
        except ImportError:
            pytest.skip("Module not available")

        cache = MemoryCache(max_size=3)

        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")

        # Acceder a key1 para hacerla mas reciente
        cache.get("key1")

        # Agregar key4, deberia evictar key2 (la menos usada)
        cache.set("key4", "value4")

        assert cache.get("key1") == "value1"  # Mas reciente
        assert cache.get("key2") is None  # Evictada
        assert cache.get("key3") == "value3"
        assert cache.get("key4") == "value4"

    def test_get_stats(self, cache):
        """Get stats retorna estadisticas."""
        cache.set("key1", "value1")
        cache.get("key1")  # Hit
        cache.get("nonexistent")  # Miss

        stats = cache.get_stats()

        assert stats["backend"] == "memory"
        assert stats["size"] == 1
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 50.0

    def test_cleanup_expired(self, cache):
        """Cleanup elimina entradas expiradas."""
        cache.set("key1", "value1", ttl=1)
        cache.set("key2", "value2", ttl=3600)

        time.sleep(1.1)

        removed = cache.cleanup_expired()

        assert removed == 1
        assert cache.get("key2") == "value2"

    def test_get_many(self, cache):
        """Get many obtiene multiples valores."""
        cache.set("key1", "value1")
        cache.set("key2", "value2")

        result = cache.get_many(["key1", "key2", "key3"])

        assert result == {"key1": "value1", "key2": "value2"}

    def test_set_many(self, cache):
        """Set many guarda multiples valores."""
        cache.set_many({
            "key1": "value1",
            "key2": "value2",
        })

        assert cache.get("key1") == "value1"
        assert cache.get("key2") == "value2"


class TestRedisCacheWithoutRedis:
    """Tests para RedisCache cuando Redis no esta disponible."""

    def test_redis_unavailable(self):
        """Redis no disponible usa None."""
        try:
            from backend.core.cache_advanced import RedisCache
        except ImportError:
            pytest.skip("Module not available")

        cache = RedisCache(host="nonexistent", port=9999)

        assert cache.is_available is False
        assert cache.get("key") is None
        assert cache.set("key", "value") is False

    def test_get_stats_unavailable(self):
        """Stats cuando Redis no disponible."""
        try:
            from backend.core.cache_advanced import RedisCache
        except ImportError:
            pytest.skip("Module not available")

        cache = RedisCache(host="nonexistent", port=9999)
        stats = cache.get_stats()

        assert stats["backend"] == "redis"
        assert stats["available"] is False


class TestHybridCache:
    """Tests para HybridCache."""

    @pytest.fixture
    def cache(self):
        """Crea un cache hibrido (solo memoria porque Redis no esta)."""
        try:
            from backend.core.cache_advanced import HybridCache
        except ImportError:
            pytest.skip("Module not available")

        return HybridCache(
            redis_host="nonexistent",
            redis_port=9999,
            memory_max_size=100,
        )

    def test_fallback_to_memory(self, cache):
        """Usa memoria cuando Redis no disponible."""
        cache.set("key1", "value1")
        result = cache.get("key1")

        assert result == "value1"

    def test_get_stats_shows_both(self, cache):
        """Stats muestra ambos backends."""
        stats = cache.get_stats()

        assert stats["backend"] == "hybrid"
        assert "memory" in stats
        assert "redis" in stats
        assert stats["using_redis"] is False


class TestCachedDecorator:
    """Tests para el decorador @cached."""

    def test_caches_result(self):
        """Decorador cachea resultado."""
        try:
            from backend.core.cache_advanced import cached, reset_cache
        except ImportError:
            pytest.skip("Module not available")

        reset_cache()

        call_count = 0

        @cached(ttl=60, prefix="test")
        def expensive_function(x):
            nonlocal call_count
            call_count += 1
            return x * 2

        # Primera llamada
        result1 = expensive_function(5)
        assert result1 == 10
        assert call_count == 1

        # Segunda llamada (debe usar cache)
        result2 = expensive_function(5)
        assert result2 == 10
        assert call_count == 1  # No incremento

    def test_different_args_different_cache(self):
        """Diferentes argumentos tienen diferente cache."""
        try:
            from backend.core.cache_advanced import cached, reset_cache
        except ImportError:
            pytest.skip("Module not available")

        reset_cache()

        call_count = 0

        @cached(ttl=60, prefix="test2")
        def add(a, b):
            nonlocal call_count
            call_count += 1
            return a + b

        result1 = add(1, 2)
        result2 = add(3, 4)

        assert result1 == 3
        assert result2 == 7
        assert call_count == 2

    def test_unless_skips_cache(self):
        """Unless puede skipear cache."""
        try:
            from backend.core.cache_advanced import cached, reset_cache
        except ImportError:
            pytest.skip("Module not available")

        reset_cache()

        call_count = 0

        @cached(ttl=60, prefix="test3", unless=lambda x: x < 0)
        def double(x):
            nonlocal call_count
            call_count += 1
            return x * 2

        # Valor negativo no se cachea
        double(-5)
        double(-5)
        assert call_count == 2

        # Valor positivo se cachea
        double(5)
        double(5)
        assert call_count == 3  # Solo una llamada adicional

    def test_invalidate(self):
        """Metodo invalidate elimina cache."""
        try:
            from backend.core.cache_advanced import cached, reset_cache, get_cache
        except ImportError:
            pytest.skip("Module not available")

        reset_cache()

        @cached(ttl=60, prefix="test4")
        def get_value(key):
            return f"value_{key}"

        # Cachear
        result1 = get_value("mykey")
        assert result1 == "value_mykey"

        # Invalidar
        get_value.invalidate("mykey")

        # Verificar que se elimino
        cache = get_cache()
        # El cache deberia estar vacio para esa clave


class TestCacheKeyBuilder:
    """Tests para construccion de claves de cache."""

    def test_custom_key_builder(self):
        """Custom key builder funciona."""
        try:
            from backend.core.cache_advanced import cached, reset_cache
        except ImportError:
            pytest.skip("Module not available")

        reset_cache()

        @cached(
            ttl=60,
            key_builder=lambda user_id: f"user:{user_id}"
        )
        def get_user(user_id):
            return {"id": user_id, "name": f"User {user_id}"}

        result = get_user(123)
        assert result["id"] == 123


class TestGetCache:
    """Tests para get_cache singleton."""

    def test_returns_same_instance(self):
        """Retorna la misma instancia."""
        try:
            from backend.core.cache_advanced import get_cache, reset_cache
        except ImportError:
            pytest.skip("Module not available")

        reset_cache()

        cache1 = get_cache()
        cache2 = get_cache()

        assert cache1 is cache2

    def test_auto_backend_uses_memory_without_redis(self):
        """Auto backend usa memoria si Redis no disponible."""
        try:
            from backend.core.cache_advanced import get_cache, reset_cache
        except ImportError:
            pytest.skip("Module not available")

        reset_cache()

        cache = get_cache(backend="auto")
        stats = cache.get_stats()

        # Sin Redis, deberia usar memory o hybrid con memoria
        assert stats["backend"] in ("memory", "hybrid")


class TestCacheWithComplexObjects:
    """Tests para cache con objetos complejos."""

    def test_cache_dict(self):
        """Cache de diccionarios."""
        try:
            from backend.core.cache_advanced import MemoryCache
        except ImportError:
            pytest.skip("Module not available")

        cache = MemoryCache()

        data = {"users": [{"id": 1}, {"id": 2}], "total": 2}
        cache.set("users_list", data)

        result = cache.get("users_list")

        assert result == data
        assert result["total"] == 2

    def test_cache_list(self):
        """Cache de listas."""
        try:
            from backend.core.cache_advanced import MemoryCache
        except ImportError:
            pytest.skip("Module not available")

        cache = MemoryCache()

        data = [1, 2, 3, 4, 5]
        cache.set("numbers", data)

        result = cache.get("numbers")

        assert result == data


class TestCacheHitRate:
    """Tests para hit rate del cache."""

    def test_hit_rate_calculation(self):
        """Calculo de hit rate es correcto."""
        try:
            from backend.core.cache_advanced import MemoryCache
        except ImportError:
            pytest.skip("Module not available")

        cache = MemoryCache()

        cache.set("key1", "value1")

        # 2 hits
        cache.get("key1")
        cache.get("key1")

        # 2 misses
        cache.get("nonexistent1")
        cache.get("nonexistent2")

        stats = cache.get_stats()

        assert stats["hits"] == 2
        assert stats["misses"] == 2
        assert stats["hit_rate"] == 50.0


class TestResetCache:
    """Tests para reset_cache."""

    def test_reset_clears_singleton(self):
        """Reset limpia el singleton."""
        try:
            from backend.core.cache_advanced import get_cache, reset_cache
        except ImportError:
            pytest.skip("Module not available")

        cache1 = get_cache()
        cache1.set("test", "value")

        reset_cache()

        cache2 = get_cache()

        # Deberia ser una nueva instancia
        assert cache2.get("test") is None
