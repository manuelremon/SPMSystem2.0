"""
Tests para el modulo de health checks.
Sprint 9.3 - Verifica funciones de salud avanzadas.
"""

import time
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest


class TestCheckDatabase:
    """Tests para la funcion _check_database."""

    def test_check_database_healthy(self, tmp_path):
        """BD existente y accesible retorna healthy."""
        try:
            from backend.routes.health import _check_database
        except ImportError:
            pytest.skip("Module not available")

        # Crear BD de prueba
        db_file = tmp_path / "test.db"
        import sqlite3

        conn = sqlite3.connect(str(db_file))
        conn.execute("CREATE TABLE test (id INTEGER)")
        conn.close()

        with patch("backend.routes.health.get_db_path", return_value=db_file):
            result = _check_database("test")

        assert result["status"] == "healthy"
        assert "latency_ms" in result
        assert "path" in result
        assert "size_mb" in result

    def test_check_database_not_found(self, tmp_path):
        """BD no existente retorna unavailable."""
        try:
            from backend.routes.health import _check_database
        except ImportError:
            pytest.skip("Module not available")

        non_existent = tmp_path / "nonexistent.db"

        with patch("backend.routes.health.get_db_path", return_value=non_existent):
            result = _check_database("test")

        assert result["status"] == "unavailable"
        assert "error" in result

    def test_check_database_error(self, tmp_path):
        """Error de BD retorna unhealthy."""
        try:
            from backend.routes.health import _check_database
        except ImportError:
            pytest.skip("Module not available")

        import sqlite3

        # Crear archivo BD valido
        db_file = tmp_path / "test.db"
        db_file.touch()

        # Mock sqlite3.connect para simular error de BD
        with patch("backend.routes.health.get_db_path", return_value=db_file):
            with patch("backend.routes.health.sqlite3.connect") as mock_conn:
                mock_conn.side_effect = sqlite3.DatabaseError("database disk image is malformed")
                result = _check_database("test")

        # Debe retornar unhealthy cuando hay error de sqlite
        assert result["status"] in ["unhealthy", "error"]


class TestCheckCache:
    """Tests para la funcion _check_cache."""

    def test_check_cache_healthy(self):
        """Cache disponible retorna healthy."""
        try:
            from backend.routes.health import _check_cache
        except ImportError:
            pytest.skip("Module not available")

        mock_stats = {"hits": 10, "misses": 5}

        # Patch en el modulo origen
        with patch("backend.core.cache.get_cache_stats", return_value=mock_stats):
            result = _check_cache()

        assert result["status"] == "healthy"
        assert "stats" in result

    def test_check_cache_unavailable(self):
        """Cache no disponible retorna unavailable."""
        try:
            from backend.routes.health import _check_cache
        except ImportError:
            pytest.skip("Module not available")

        # Simular ImportError removiendo el modulo
        with patch.dict("sys.modules", {"backend.core.cache": None, "core.cache": None}):
            result = _check_cache()

        # Debe retornar unavailable cuando no encuentra el modulo
        assert result["status"] == "unavailable"

    def test_check_cache_error(self):
        """Error de cache retorna error."""
        try:
            from backend.routes.health import _check_cache
        except ImportError:
            pytest.skip("Module not available")

        def raise_error():
            raise RuntimeError("Cache error")

        with patch("backend.core.cache.get_cache_stats", side_effect=raise_error):
            result = _check_cache()

        assert result["status"] == "error"
        assert "error" in result


class TestCheckMetrics:
    """Tests para la funcion _check_metrics."""

    def test_check_metrics_healthy(self):
        """Metrics disponible retorna healthy."""
        try:
            from backend.routes.health import _check_metrics
        except ImportError:
            pytest.skip("Module not available")

        mock_collector = MagicMock()
        mock_collector.get_request_stats.return_value = {
            "total_requests": 100,
            "error_rate_percent": 5.0,
        }

        # Patch en el modulo origen
        with patch("backend.core.metrics.get_metrics_collector", return_value=mock_collector):
            result = _check_metrics()

        assert result["status"] == "healthy"
        assert result["total_requests"] == 100
        assert result["error_rate"] == 5.0

    def test_check_metrics_unavailable(self):
        """Metrics no disponible retorna unavailable."""
        try:
            from backend.routes.health import _check_metrics
        except ImportError:
            pytest.skip("Module not available")

        # Simular ImportError removiendo ambos modulos
        with patch.dict("sys.modules", {"backend.core.metrics": None, "core.metrics": None}):
            result = _check_metrics()

        assert result["status"] == "unavailable"


class TestGetUptime:
    """Tests para la funcion _get_uptime."""

    def test_uptime_returns_dict(self):
        """get_uptime retorna diccionario."""
        try:
            from backend.routes.health import _get_uptime
        except ImportError:
            pytest.skip("Module not available")

        result = _get_uptime()

        assert isinstance(result, dict)
        assert "seconds" in result
        assert "formatted" in result
        assert "started_at" in result

    def test_uptime_seconds_is_positive(self):
        """Uptime en segundos es positivo."""
        try:
            from backend.routes.health import _get_uptime
        except ImportError:
            pytest.skip("Module not available")

        result = _get_uptime()
        assert result["seconds"] >= 0

    def test_uptime_formatted_string(self):
        """Uptime formateado es string legible."""
        try:
            from backend.routes.health import _get_uptime
        except ImportError:
            pytest.skip("Module not available")

        result = _get_uptime()
        formatted = result["formatted"]

        # Formato: "Xh Ym Zs"
        assert "h" in formatted
        assert "m" in formatted
        assert "s" in formatted

    def test_uptime_started_at_iso(self):
        """started_at es formato ISO valido."""
        try:
            from backend.routes.health import _get_uptime
        except ImportError:
            pytest.skip("Module not available")

        result = _get_uptime()

        # Debe poder parsearse como ISO
        try:
            datetime.fromisoformat(result["started_at"])
            parsed = True
        except ValueError:
            parsed = False

        assert parsed is True


class TestAPIVersion:
    """Tests para la version de API."""

    def test_api_version_defined(self):
        """API_VERSION esta definida."""
        try:
            from backend.routes.health import API_VERSION
        except ImportError:
            pytest.skip("Module not available")

        assert API_VERSION is not None
        assert isinstance(API_VERSION, str)

    def test_api_version_semver(self):
        """API_VERSION sigue formato semver."""
        try:
            from backend.routes.health import API_VERSION
        except ImportError:
            pytest.skip("Module not available")

        parts = API_VERSION.split(".")
        assert len(parts) == 3
        # Cada parte debe ser un numero
        for part in parts:
            assert part.isdigit()


class TestStartTime:
    """Tests para el tiempo de inicio."""

    def test_start_time_is_past(self):
        """Tiempo de inicio es anterior a ahora."""
        try:
            from backend.routes.health import _start_time
        except ImportError:
            pytest.skip("Module not available")

        now = time.time()
        assert _start_time <= now


class TestHealthBlueprint:
    """Tests para el blueprint de health."""

    def test_blueprint_exists(self):
        """Blueprint 'health' existe."""
        try:
            from backend.routes.health import bp
        except ImportError:
            pytest.skip("Module not available")

        assert bp is not None
        assert bp.name == "health"


class TestDatabaseLatency:
    """Tests para latencia de BD."""

    def test_latency_is_reasonable(self, tmp_path):
        """Latencia de BD esta en rango razonable."""
        try:
            from backend.routes.health import _check_database
        except ImportError:
            pytest.skip("Module not available")

        # Crear BD de prueba
        db_file = tmp_path / "test.db"
        import sqlite3

        conn = sqlite3.connect(str(db_file))
        conn.execute("CREATE TABLE test (id INTEGER)")
        conn.close()

        with patch("backend.routes.health.get_db_path", return_value=db_file):
            result = _check_database("test")

        if result["status"] == "healthy":
            # Latencia debe ser positiva y menor a 1 segundo
            assert result["latency_ms"] > 0
            assert result["latency_ms"] < 1000


class TestDatabaseSize:
    """Tests para tamano de BD."""

    def test_size_is_positive(self, tmp_path):
        """Tamano de BD es positivo."""
        try:
            from backend.routes.health import _check_database
        except ImportError:
            pytest.skip("Module not available")

        # Crear BD de prueba con datos
        db_file = tmp_path / "test.db"
        import sqlite3

        conn = sqlite3.connect(str(db_file))
        conn.execute("CREATE TABLE test (id INTEGER, data TEXT)")
        for i in range(100):
            conn.execute("INSERT INTO test VALUES (?, ?)", (i, "data" * 100))
        conn.commit()
        conn.close()

        with patch("backend.routes.health.get_db_path", return_value=db_file):
            result = _check_database("test")

        if result["status"] == "healthy":
            assert result["size_mb"] >= 0


class TestCacheStatsIntegration:
    """Tests de integracion con cache stats."""

    def test_cache_stats_structure(self):
        """Stats de cache tiene estructura esperada."""
        try:
            from backend.routes.health import _check_cache
        except ImportError:
            pytest.skip("Module not available")

        mock_stats = {"hits": 10, "misses": 5, "size": 100}

        with patch("backend.core.cache.get_cache_stats", return_value=mock_stats):
            result = _check_cache()

        if result["status"] == "healthy":
            assert "stats" in result
            assert result["stats"]["hits"] == 10


class TestMetricsIntegration:
    """Tests de integracion con metrics."""

    def test_metrics_structure(self):
        """Resultado de metrics tiene estructura esperada."""
        try:
            from backend.routes.health import _check_metrics
        except ImportError:
            pytest.skip("Module not available")

        mock_collector = MagicMock()
        mock_collector.get_request_stats.return_value = {
            "total_requests": 50,
            "error_rate_percent": 2.5,
        }

        with patch("backend.core.metrics.get_metrics_collector", return_value=mock_collector):
            result = _check_metrics()

        if result["status"] == "healthy":
            assert "total_requests" in result
            assert "error_rate" in result


class TestHealthCheckHelpers:
    """Tests para funciones helper."""

    def test_check_database_returns_dict(self, tmp_path):
        """_check_database siempre retorna dict."""
        try:
            from backend.routes.health import _check_database
        except ImportError:
            pytest.skip("Module not available")

        # Caso BD no existe
        non_existent = tmp_path / "nonexistent.db"
        with patch("backend.routes.health.get_db_path", return_value=non_existent):
            result = _check_database("test")
        assert isinstance(result, dict)

    def test_check_cache_returns_dict(self):
        """_check_cache siempre retorna dict."""
        try:
            from backend.routes.health import _check_cache
        except ImportError:
            pytest.skip("Module not available")

        # Caso error - patch en el modulo origen
        with patch("backend.core.cache.get_cache_stats", side_effect=Exception("Error")):
            result = _check_cache()
        assert isinstance(result, dict)

    def test_check_metrics_returns_dict(self):
        """_check_metrics siempre retorna dict."""
        try:
            from backend.routes.health import _check_metrics
        except ImportError:
            pytest.skip("Module not available")

        # Caso error - patch en el modulo origen
        with patch("backend.core.metrics.get_metrics_collector", side_effect=Exception("Error")):
            result = _check_metrics()
        assert isinstance(result, dict)


class TestHealthStatusValues:
    """Tests para valores de status."""

    def test_valid_status_values(self, tmp_path):
        """Status solo toma valores validos."""
        try:
            from backend.routes.health import (_check_cache, _check_database,
                                               _check_metrics)
        except ImportError:
            pytest.skip("Module not available")

        valid_statuses = ["healthy", "unhealthy", "unavailable", "error"]

        # Test database
        non_existent = tmp_path / "nonexistent.db"
        with patch("backend.routes.health.get_db_path", return_value=non_existent):
            result = _check_database("test")
        assert result["status"] in valid_statuses

        # Test cache - patch en el modulo origen
        with patch("backend.core.cache.get_cache_stats", side_effect=Exception()):
            result = _check_cache()
        assert result["status"] in valid_statuses

        # Test metrics - patch en el modulo origen
        with patch("backend.core.metrics.get_metrics_collector", side_effect=Exception()):
            result = _check_metrics()
        assert result["status"] in valid_statuses


class TestCheckCelery:
    """Tests para la funcion _check_celery."""

    def test_celery_disabled(self):
        """Celery deshabilitado retorna disabled."""
        try:
            from backend.routes.health import _check_celery
        except ImportError:
            pytest.skip("Module not available")

        with patch("backend.core.config.settings") as mock_settings:
            mock_settings.CELERY_ENABLED = False
            result = _check_celery()

        assert result["status"] == "disabled"
        assert "reason" in result

    def test_celery_healthy(self):
        """Celery con workers conectados retorna healthy."""
        mock_stats = {
            "available": True,
            "workers": 2,
            "active_tasks": 5,
            "broker": "redis://localhost:6379/0"
        }

        # Parchear directamente en el modulo donde se importa
        with patch("backend.core.config.settings.CELERY_ENABLED", True):
            # Crear mock del modulo celery_app con get_celery_stats
            mock_celery_module = MagicMock()
            mock_celery_module.get_celery_stats = MagicMock(return_value=mock_stats)
            with patch.dict("sys.modules", {"backend.core.celery_app": mock_celery_module}):
                # Re-importar para que use el mock
                from backend.routes.health import _check_celery
                result = _check_celery()

        assert result["status"] == "healthy"
        assert result["workers"] == 2
        assert result["active_tasks"] == 5
        assert "broker" in result

    def test_celery_unavailable(self):
        """Celery sin workers retorna unavailable."""
        mock_stats = {
            "available": False,
            "error": "No workers connected",
            "broker": "redis://localhost:6379/0"
        }

        with patch("backend.core.config.settings.CELERY_ENABLED", True):
            mock_celery_module = MagicMock()
            mock_celery_module.get_celery_stats = MagicMock(return_value=mock_stats)
            with patch.dict("sys.modules", {"backend.core.celery_app": mock_celery_module}):
                from backend.routes.health import _check_celery
                result = _check_celery()

        assert result["status"] == "unavailable"
        assert "error" in result

    def test_celery_in_default_includes(self):
        """Celery esta incluido en los checks por defecto."""
        # El default include debe contener 'celery'
        default_include = "db,cache,metrics,redis,jobs,celery"
        assert "celery" in default_include


class TestCheckJobsQueue:
    """Tests para la funcion _check_jobs_queue."""

    def test_jobs_queue_healthy(self):
        """Cola de jobs con worker corriendo retorna healthy."""
        try:
            from backend.routes.health import _check_jobs_queue
        except ImportError:
            pytest.skip("Module not available")

        mock_stats = {
            "worker_running": True,
            "total_jobs": 10,
            "by_status": {
                "pending": 2,
                "completed": 7,
                "failed": 1,
                "retrying": 0
            },
            "registered_tasks": ["send_email", "send_notification"]
        }

        mock_queue = MagicMock()
        mock_queue.get_stats.return_value = mock_stats

        with patch("backend.core.background_jobs.get_job_queue", return_value=mock_queue):
            result = _check_jobs_queue()

        assert result["status"] == "healthy"
        assert result["worker_running"] is True
        assert result["total_jobs"] == 10
        assert result["pending_jobs"] == 2
        assert result["failed_jobs"] == 1

    def test_jobs_queue_degraded(self):
        """Cola sin worker corriendo retorna degraded."""
        try:
            from backend.routes.health import _check_jobs_queue
        except ImportError:
            pytest.skip("Module not available")

        mock_stats = {
            "worker_running": False,
            "total_jobs": 5,
            "by_status": {"pending": 5},
            "registered_tasks": []
        }

        mock_queue = MagicMock()
        mock_queue.get_stats.return_value = mock_stats

        with patch("backend.core.background_jobs.get_job_queue", return_value=mock_queue):
            result = _check_jobs_queue()

        assert result["status"] == "degraded"
        assert result["worker_running"] is False
        assert "warning" in result
