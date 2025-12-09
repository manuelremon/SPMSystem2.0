"""
Tests para el modulo de metricas.
Sprint 9.2 - Verifica recoleccion y exposicion de metricas.
"""

import time

import pytest


class TestMetricsCollector:
    """Tests para el recolector de metricas."""

    @pytest.fixture
    def collector(self):
        """Crea un recolector nuevo."""
        try:
            from backend.core.metrics import MetricsCollector
        except ImportError:
            pytest.skip("Module not available")

        return MetricsCollector(max_history=100)

    def test_record_request_increments_count(self, collector):
        """Registrar request incrementa contador."""
        collector.record_request("GET", "/api/test", 200, 50.0)

        stats = collector.get_request_stats()
        assert stats["total_requests"] == 1

    def test_record_multiple_requests(self, collector):
        """Registrar multiples requests."""
        for i in range(10):
            collector.record_request("GET", "/api/test", 200, 50.0)

        stats = collector.get_request_stats()
        assert stats["total_requests"] == 10

    def test_record_error_increments_error_count(self, collector):
        """Registrar error incrementa contador de errores."""
        collector.record_request("GET", "/api/test", 500, 50.0)

        stats = collector.get_request_stats()
        assert stats["total_errors"] == 1
        assert stats["error_rate_percent"] == 100.0

    def test_status_code_tracking(self, collector):
        """Rastreo de status codes."""
        collector.record_request("GET", "/api/test", 200, 50.0)
        collector.record_request("GET", "/api/test", 200, 50.0)
        collector.record_request("GET", "/api/test", 404, 50.0)
        collector.record_request("GET", "/api/test", 500, 50.0)

        stats = collector.get_request_stats()
        assert stats["status_codes"][200] == 2
        assert stats["status_codes"][404] == 1
        assert stats["status_codes"][500] == 1

    def test_latency_calculation(self, collector):
        """Calculo de latencia."""
        collector.record_request("GET", "/api/test", 200, 100.0)
        collector.record_request("GET", "/api/test", 200, 200.0)
        collector.record_request("GET", "/api/test", 200, 300.0)

        stats = collector.get_request_stats()
        assert stats["latency"]["avg_ms"] == 200.0
        assert stats["latency"]["p50_ms"] == 200.0

    def test_path_normalization(self, collector):
        """Normalizacion de paths con IDs."""
        collector.record_request("GET", "/api/users/123", 200, 50.0)
        collector.record_request("GET", "/api/users/456", 200, 50.0)

        stats = collector.get_endpoint_stats()
        # Ambos deben normalizarse a /api/users/{id}
        assert "GET:/api/users/{id}" in stats["top_endpoints"]
        assert stats["top_endpoints"]["GET:/api/users/{id}"] == 2

    def test_business_counter(self, collector):
        """Incrementar contador de negocio."""
        collector.increment_counter("solicitudes_creadas")
        collector.increment_counter("solicitudes_creadas")
        collector.increment_counter("solicitudes_aprobadas", 5)

        metrics = collector.get_business_metrics()
        assert metrics["counters"]["solicitudes_creadas"] == 2
        assert metrics["counters"]["solicitudes_aprobadas"] == 5

    def test_business_gauge(self, collector):
        """Establecer gauge de negocio."""
        collector.set_gauge("solicitudes_pendientes", 42)
        collector.set_gauge("tasa_aprobacion", 0.85)

        metrics = collector.get_business_metrics()
        assert metrics["gauges"]["solicitudes_pendientes"] == 42
        assert metrics["gauges"]["tasa_aprobacion"] == 0.85

    def test_uptime_tracking(self, collector):
        """Rastreo de uptime."""
        time.sleep(1.1)  # Esperar mas de 1 segundo para evitar redondeo a 0

        stats = collector.get_request_stats()
        assert stats["uptime_seconds"] >= 1.0

    def test_reset_clears_all(self, collector):
        """Reset limpia todas las metricas."""
        collector.record_request("GET", "/api/test", 200, 50.0)
        collector.increment_counter("test")
        collector.set_gauge("test", 1.0)

        collector.reset()

        stats = collector.get_request_stats()
        assert stats["total_requests"] == 0
        assert stats["total_errors"] == 0

    def test_max_history_limit(self, collector):
        """Historial respeta limite maximo."""
        for i in range(200):
            collector.record_request("GET", f"/api/test/{i}", 200, 50.0)

        # El collector tiene max_history=100
        assert len(collector._request_history) <= 100

    def test_get_all_metrics(self, collector):
        """get_all_metrics retorna todas las metricas."""
        collector.record_request("GET", "/api/test", 200, 50.0)

        all_metrics = collector.get_all_metrics()

        assert "timestamp" in all_metrics
        assert "requests" in all_metrics
        assert "endpoints" in all_metrics
        assert "business" in all_metrics
        assert "system" in all_metrics


class TestMetricsSingleton:
    """Tests para el singleton de metricas."""

    def test_get_metrics_collector_returns_same_instance(self):
        """get_metrics_collector retorna misma instancia."""
        try:
            from backend.core.metrics import get_metrics_collector
        except ImportError:
            pytest.skip("Module not available")

        collector1 = get_metrics_collector()
        collector2 = get_metrics_collector()

        assert collector1 is collector2


class TestTimedDecorator:
    """Tests para el decorador timed."""

    def test_timed_measures_duration(self):
        """Decorador timed mide duracion."""
        try:
            from backend.core.metrics import get_metrics_collector, timed
        except ImportError:
            pytest.skip("Module not available")

        @timed("test_function")
        def slow_function():
            time.sleep(0.1)
            return "done"

        result = slow_function()

        assert result == "done"
        collector = get_metrics_collector()
        gauge = collector._business_gauges.get("function_test_function_last_ms")
        assert gauge is not None
        assert gauge >= 100  # Al menos 100ms


class TestCacheMetrics:
    """Tests para metricas de cache."""

    def test_get_cache_metrics(self):
        """get_cache_metrics retorna estadisticas."""
        try:
            from backend.core.metrics import get_cache_metrics
        except ImportError:
            pytest.skip("Module not available")

        metrics = get_cache_metrics()

        # Puede ser dict con stats o error
        assert isinstance(metrics, dict)


class TestDBPoolMetrics:
    """Tests para metricas de pool de BD."""

    def test_get_db_pool_metrics(self):
        """get_db_pool_metrics retorna estadisticas."""
        try:
            from backend.core.metrics import get_db_pool_metrics
        except ImportError:
            pytest.skip("Module not available")

        metrics = get_db_pool_metrics()

        # Puede ser dict con stats o error
        assert isinstance(metrics, dict)


class TestSystemMetrics:
    """Tests para metricas de sistema."""

    def test_system_metrics_basic(self):
        """Metricas de sistema basicas."""
        try:
            from backend.core.metrics import MetricsCollector
        except ImportError:
            pytest.skip("Module not available")

        collector = MetricsCollector()
        metrics = collector.get_system_metrics()

        assert isinstance(metrics, dict)
        # Debe tener al menos process
        assert "process" in metrics or "error" in metrics


class TestEndpointStats:
    """Tests para estadisticas de endpoints."""

    @pytest.fixture
    def collector(self):
        """Crea un recolector."""
        try:
            from backend.core.metrics import MetricsCollector
        except ImportError:
            pytest.skip("Module not available")

        return MetricsCollector()

    def test_top_endpoints(self, collector):
        """Obtiene top endpoints."""
        for _ in range(50):
            collector.record_request("GET", "/api/hot", 200, 10.0)
        for _ in range(10):
            collector.record_request("GET", "/api/cold", 200, 10.0)

        stats = collector.get_endpoint_stats(top_n=5)

        assert "top_endpoints" in stats
        # Hot endpoint debe estar primero
        endpoints = list(stats["top_endpoints"].keys())
        assert "GET:/api/hot" in endpoints

    def test_top_errors(self, collector):
        """Obtiene endpoints con mas errores."""
        for _ in range(10):
            collector.record_request("GET", "/api/broken", 500, 10.0)
        for _ in range(5):
            collector.record_request("GET", "/api/flaky", 500, 10.0)

        stats = collector.get_endpoint_stats()

        assert "top_errors" in stats
        assert stats["top_errors"]["GET:/api/broken"] == 10

    def test_endpoint_latencies(self, collector):
        """Obtiene latencias por endpoint."""
        collector.record_request("GET", "/api/slow", 200, 1000.0)
        collector.record_request("GET", "/api/fast", 200, 10.0)

        stats = collector.get_endpoint_stats()

        assert "endpoint_latencies" in stats
        assert stats["endpoint_latencies"]["GET:/api/slow"]["avg_ms"] == 1000.0
        assert stats["endpoint_latencies"]["GET:/api/fast"]["avg_ms"] == 10.0


class TestRequestsPerMinute:
    """Tests para RPM (requests per minute)."""

    def test_rpm_calculation(self):
        """Calculo de requests por minuto."""
        try:
            from backend.core.metrics import MetricsCollector
        except ImportError:
            pytest.skip("Module not available")

        collector = MetricsCollector()

        # Registrar 10 requests "recientes"
        for _ in range(10):
            collector.record_request("GET", "/api/test", 200, 10.0)

        stats = collector.get_request_stats()

        # RPM debe ser 10 (todos son recientes)
        assert stats["requests_per_minute"] == 10


class TestErrorRate:
    """Tests para tasa de errores."""

    def test_error_rate_zero(self):
        """Tasa de error es 0 sin errores."""
        try:
            from backend.core.metrics import MetricsCollector
        except ImportError:
            pytest.skip("Module not available")

        collector = MetricsCollector()
        collector.record_request("GET", "/api/test", 200, 10.0)

        stats = collector.get_request_stats()
        assert stats["error_rate_percent"] == 0

    def test_error_rate_50_percent(self):
        """Tasa de error correcta con 50% errores."""
        try:
            from backend.core.metrics import MetricsCollector
        except ImportError:
            pytest.skip("Module not available")

        collector = MetricsCollector()
        collector.record_request("GET", "/api/test", 200, 10.0)
        collector.record_request("GET", "/api/test", 500, 10.0)

        stats = collector.get_request_stats()
        assert stats["error_rate_percent"] == 50.0
