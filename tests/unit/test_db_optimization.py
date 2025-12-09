"""
Tests para el modulo de optimizacion de BD.
Sprint 8.2 - Verifica pool de conexiones, indices y queries cacheadas.
"""

import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class TestSQLiteConnectionPool:
    """Tests para el pool de conexiones."""

    @pytest.fixture
    def temp_db(self):
        """Crea BD temporal para tests."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        # Crear tabla de prueba
        conn = sqlite3.connect(db_path)
        conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)")
        conn.execute("INSERT INTO test VALUES (1, 'test')")
        conn.commit()
        conn.close()

        yield db_path

        # Cleanup
        try:
            db_path.unlink()
        except Exception:
            pass

    @pytest.fixture
    def pool(self, temp_db):
        """Crea pool de conexiones."""
        try:
            from backend.core.db_optimization import SQLiteConnectionPool
        except ImportError:
            from core.db_optimization import SQLiteConnectionPool

        pool = SQLiteConnectionPool(temp_db, max_size=3)
        yield pool
        pool.close_all()

    def test_pool_creates_connection(self, pool):
        """Pool crea conexion al usarla."""
        with pool.connection() as conn:
            assert conn is not None
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM test")
            row = cursor.fetchone()
            assert row[0] == 1

    def test_pool_reuses_connection(self, pool):
        """Pool reutiliza conexiones."""
        # Primera conexion
        with pool.connection() as conn1:
            id1 = id(conn1)

        # Segunda conexion - deberia reutilizar
        with pool.connection() as conn2:
            id2 = id(conn2)

        # Verificar reutilizacion via stats
        stats = pool.stats()
        assert stats["reused"] >= 1

    def test_pool_stats(self, pool):
        """Pool reporta estadisticas."""
        with pool.connection():
            pass

        stats = pool.stats()
        assert "created" in stats
        assert "reused" in stats
        assert "max_size" in stats
        assert stats["created"] >= 1

    def test_pool_max_size(self, pool):
        """Pool respeta limite de conexiones."""
        connections = []

        # Adquirir hasta el limite
        for _ in range(3):
            conn = pool._acquire()
            connections.append(conn)

        # Intentar una mas deberia fallar o esperar
        with pytest.raises(RuntimeError):
            pool._acquire()  # Pool exhausted

        # Liberar conexiones
        for conn in connections:
            pool._release(conn)

    def test_pool_close_all(self, pool):
        """Pool cierra todas las conexiones."""
        # Crear algunas conexiones
        with pool.connection():
            pass
        with pool.connection():
            pass

        pool.close_all()

        stats = pool.stats()
        assert stats["pool_size"] == 0
        assert stats["active"] == 0


class TestPooledConnection:
    """Tests para conexiones del pool."""

    @pytest.fixture
    def mock_pool(self):
        """Mock del pool global."""
        with patch("backend.core.db_optimization._pools", {}):
            yield

    def test_get_pool_creates_new(self, mock_pool):
        """get_pool crea nuevo pool si no existe."""
        try:
            from backend.core.db_optimization import _pools, get_pool
        except ImportError:
            pytest.skip("Module not available")

        with patch("backend.core.db_optimization.settings") as mock_settings:
            mock_settings.DATABASE_URL = "sqlite:///data/spm.db"

            pool = get_pool("spm")
            assert pool is not None


class TestRecommendedIndexes:
    """Tests para indices recomendados."""

    def test_recommended_indexes_defined(self):
        """Indices recomendados estan definidos."""
        try:
            from backend.core.db_optimization import RECOMMENDED_INDEXES
        except ImportError:
            pytest.skip("Module not available")

        assert "spm" in RECOMMENDED_INDEXES
        assert len(RECOMMENDED_INDEXES["spm"]) > 0

    def test_index_structure(self):
        """Cada indice tiene estructura correcta."""
        try:
            from backend.core.db_optimization import RECOMMENDED_INDEXES
        except ImportError:
            pytest.skip("Module not available")

        for db_name, indexes in RECOMMENDED_INDEXES.items():
            for idx in indexes:
                assert len(idx) == 3  # (name, table, columns)
                assert idx[0].startswith("idx_")  # Naming convention


class TestCachedQueries:
    """Tests para queries cacheadas."""

    def test_get_centros_cached_returns_list(self):
        """get_centros_cached retorna lista."""
        try:
            from backend.core.db_optimization import get_centros_cached
        except ImportError:
            pytest.skip("Module not available")

        # Mockear conexion
        with patch("backend.core.db_optimization.get_pooled_connection") as mock_conn:
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = [{"id": 1, "codigo": "1000", "nombre": "Centro 1"}]
            mock_conn.return_value.__enter__.return_value.cursor.return_value = mock_cursor

            # Limpiar cache
            get_centros_cached.invalidate()

            result = get_centros_cached()
            assert isinstance(result, list)

    def test_get_solicitudes_count_returns_dict(self):
        """get_solicitudes_count_by_estado retorna dict."""
        try:
            from backend.core.db_optimization import \
                get_solicitudes_count_by_estado
        except ImportError:
            pytest.skip("Module not available")

        with patch("backend.core.db_optimization.get_pooled_connection") as mock_conn:
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = [
                {"estado": "submitted", "count": 10},
                {"estado": "approved", "count": 5},
            ]
            mock_conn.return_value.__enter__.return_value.cursor.return_value = mock_cursor

            get_solicitudes_count_by_estado.invalidate()

            result = get_solicitudes_count_by_estado()
            assert isinstance(result, dict)

    def test_cached_function_has_invalidate(self):
        """Funciones cacheadas tienen metodo invalidate."""
        try:
            from backend.core.db_optimization import get_centros_cached
        except ImportError:
            pytest.skip("Module not available")

        assert hasattr(get_centros_cached, "invalidate")
        assert callable(get_centros_cached.invalidate)


class TestDatabaseStats:
    """Tests para estadisticas de BD."""

    def test_get_db_stats_structure(self):
        """get_db_stats retorna estructura correcta."""
        try:
            from backend.core.db_optimization import get_db_stats
        except ImportError:
            pytest.skip("Module not available")

        with patch("backend.core.db_optimization.get_pooled_connection") as mock_conn:
            mock_cursor = MagicMock()
            mock_cursor.fetchone.side_effect = [
                (100,),  # page_count
                (4096,),  # page_size
                (5,),  # table_count
                (10,),  # index_count
                (0, 0, 0),  # wal_checkpoint
            ]
            mock_conn.return_value.__enter__.return_value.cursor.return_value = mock_cursor

            stats = get_db_stats("spm")

            assert "db_name" in stats
            assert "size_mb" in stats
            assert "table_count" in stats
            assert "index_count" in stats

    def test_get_all_pool_stats(self):
        """get_all_pool_stats retorna dict."""
        try:
            from backend.core.db_optimization import get_all_pool_stats
        except ImportError:
            pytest.skip("Module not available")

        result = get_all_pool_stats()
        assert isinstance(result, dict)


class TestOptimizeDatabase:
    """Tests para optimizacion de BD."""

    def test_create_indexes_returns_result(self):
        """create_indexes retorna resultado."""
        try:
            from backend.core.db_optimization import create_indexes
        except ImportError:
            pytest.skip("Module not available")

        with patch("backend.core.db_optimization.get_pooled_connection") as mock_conn:
            mock_cursor = MagicMock()
            mock_conn.return_value.__enter__.return_value.cursor.return_value = mock_cursor

            result = create_indexes("spm")

            assert "ok" in result
            assert "created" in result

    def test_analyze_tables_returns_result(self):
        """analyze_tables retorna resultado."""
        try:
            from backend.core.db_optimization import analyze_tables
        except ImportError:
            pytest.skip("Module not available")

        with patch("backend.core.db_optimization.get_pooled_connection") as mock_conn:
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = [("usuarios",), ("solicitudes",)]
            mock_conn.return_value.__enter__.return_value.cursor.return_value = mock_cursor

            result = analyze_tables("spm")

            assert result["ok"] is True
            assert "tables_analyzed" in result

    def test_optimize_database_runs_all(self):
        """optimize_database ejecuta todas las optimizaciones."""
        try:
            from backend.core.db_optimization import optimize_database
        except ImportError:
            pytest.skip("Module not available")

        with patch("backend.core.db_optimization.get_pooled_connection") as mock_conn:
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = [("test",)]
            mock_conn.return_value.__enter__.return_value.cursor.return_value = mock_cursor
            mock_conn.return_value.__enter__.return_value.execute = MagicMock()

            result = optimize_database("spm")

            assert "indexes" in result
            assert "analyze" in result
            assert "vacuum" in result


class TestExplainQuery:
    """Tests para explicacion de queries."""

    def test_explain_query_returns_plan(self):
        """explain_query retorna plan de ejecucion."""
        try:
            from backend.core.db_optimization import explain_query
        except ImportError:
            pytest.skip("Module not available")

        with patch("backend.core.db_optimization.get_pooled_connection") as mock_conn:
            mock_cursor = MagicMock()
            mock_cursor.fetchall.return_value = [
                {"id": 0, "parent": 0, "notused": 0, "detail": "SCAN usuarios"}
            ]
            mock_conn.return_value.__enter__.return_value.cursor.return_value = mock_cursor

            result = explain_query("spm", "SELECT * FROM usuarios")

            assert isinstance(result, list)
            assert len(result) > 0


class TestPooledConnectionPragmas:
    """Tests para configuracion de pragmas."""

    @pytest.fixture
    def temp_db(self):
        """Crea BD temporal."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        conn = sqlite3.connect(db_path)
        conn.execute("CREATE TABLE test (id INTEGER)")
        conn.commit()
        conn.close()

        yield db_path

        try:
            db_path.unlink()
        except Exception:
            pass

    def test_wal_mode_enabled(self, temp_db):
        """Conexiones usan WAL mode."""
        try:
            from backend.core.db_optimization import SQLiteConnectionPool
        except ImportError:
            pytest.skip("Module not available")

        pool = SQLiteConnectionPool(temp_db)

        with pool.connection() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA journal_mode")
            mode = cursor.fetchone()[0]
            assert mode.lower() == "wal"

        pool.close_all()

    def test_cache_size_configured(self, temp_db):
        """Conexiones tienen cache configurado."""
        try:
            from backend.core.db_optimization import SQLiteConnectionPool
        except ImportError:
            pytest.skip("Module not available")

        pool = SQLiteConnectionPool(temp_db)

        with pool.connection() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA cache_size")
            size = cursor.fetchone()[0]
            # Negativo = KB, positivo = paginas
            assert size != 0

        pool.close_all()
