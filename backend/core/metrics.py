"""
Sistema de metricas y monitoreo para SPM API.
Sprint 9.2 - Recoleccion y exposicion de metricas.

Provee:
- Metricas de aplicacion (requests, latencia, errores)
- Metricas de negocio (solicitudes, aprobaciones)
- Metricas de sistema (memoria, conexiones, cache)
- Endpoint /api/metrics para exposicion
"""

import gc
import logging
import os
import sys
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


# =============================================================================
# Metricas de Aplicacion
# =============================================================================


@dataclass
class RequestMetrics:
    """Metricas de una peticion HTTP."""

    method: str
    path: str
    status_code: int
    duration_ms: float
    timestamp: float = field(default_factory=time.time)


class MetricsCollector:
    """
    Recolector central de metricas.

    Recopila metricas de:
    - Requests HTTP (conteo, latencia, errores)
    - Operaciones de negocio (solicitudes, aprobaciones)
    - Sistema (memoria, conexiones)
    """

    def __init__(self, max_history: int = 1000):
        """
        Inicializa el recolector.

        Args:
            max_history: Maximo de requests a mantener en historial
        """
        self._lock = threading.RLock()
        self._max_history = max_history
        self._start_time = time.time()

        # Contadores de requests
        self._request_count = 0
        self._error_count = 0
        self._request_history: List[RequestMetrics] = []

        # Contadores por endpoint
        self._endpoint_counts: Dict[str, int] = defaultdict(int)
        self._endpoint_errors: Dict[str, int] = defaultdict(int)
        self._endpoint_durations: Dict[str, List[float]] = defaultdict(list)

        # Contadores por status code
        self._status_counts: Dict[int, int] = defaultdict(int)

        # Metricas de negocio
        self._business_counters: Dict[str, int] = defaultdict(int)
        self._business_gauges: Dict[str, float] = {}

        # Ultimas metricas de sistema
        self._system_metrics: Dict[str, Any] = {}
        self._last_system_update = 0

    def record_request(self, method: str, path: str, status_code: int, duration_ms: float) -> None:
        """
        Registra una peticion HTTP.

        Args:
            method: Metodo HTTP (GET, POST, etc.)
            path: Path del endpoint
            status_code: Codigo de respuesta HTTP
            duration_ms: Duracion en milisegundos
        """
        with self._lock:
            self._request_count += 1
            self._status_counts[status_code] += 1

            # Normalizar path (remover IDs dinamicos)
            normalized_path = self._normalize_path(path)
            self._endpoint_counts[f"{method}:{normalized_path}"] += 1
            self._endpoint_durations[f"{method}:{normalized_path}"].append(duration_ms)

            # Mantener solo ultimos N durations por endpoint
            if len(self._endpoint_durations[f"{method}:{normalized_path}"]) > 100:
                self._endpoint_durations[f"{method}:{normalized_path}"] = self._endpoint_durations[
                    f"{method}:{normalized_path}"
                ][-100:]

            # Contar errores
            if status_code >= 400:
                self._error_count += 1
                self._endpoint_errors[f"{method}:{normalized_path}"] += 1

            # Agregar a historial
            metrics = RequestMetrics(
                method=method,
                path=normalized_path,
                status_code=status_code,
                duration_ms=duration_ms,
            )
            self._request_history.append(metrics)

            # Mantener historial limitado
            if len(self._request_history) > self._max_history:
                self._request_history = self._request_history[-self._max_history :]

    def _normalize_path(self, path: str) -> str:
        """Normaliza path reemplazando IDs numericos con {id}."""
        parts = path.split("/")
        normalized = []
        for part in parts:
            if part.isdigit():
                normalized.append("{id}")
            else:
                normalized.append(part)
        return "/".join(normalized)

    def increment_counter(self, name: str, value: int = 1) -> None:
        """
        Incrementa un contador de negocio.

        Args:
            name: Nombre del contador
            value: Valor a incrementar (default: 1)
        """
        with self._lock:
            self._business_counters[name] += value

    def set_gauge(self, name: str, value: float) -> None:
        """
        Establece un gauge de negocio.

        Args:
            name: Nombre del gauge
            value: Valor actual
        """
        with self._lock:
            self._business_gauges[name] = value

    def get_request_stats(self) -> Dict[str, Any]:
        """
        Obtiene estadisticas de requests.

        Returns:
            Estadisticas agregadas de requests
        """
        with self._lock:
            now = time.time()
            uptime = now - self._start_time

            # Calcular RPM (requests por minuto)
            recent_requests = [r for r in self._request_history if now - r.timestamp < 60]
            rpm = len(recent_requests)

            # Calcular latencia promedio
            if self._request_history:
                durations = [r.duration_ms for r in self._request_history[-100:]]
                avg_latency = sum(durations) / len(durations)
                p50_latency = sorted(durations)[len(durations) // 2]
                p95_latency = (
                    sorted(durations)[int(len(durations) * 0.95)]
                    if len(durations) > 1
                    else avg_latency
                )
                p99_latency = (
                    sorted(durations)[int(len(durations) * 0.99)]
                    if len(durations) > 1
                    else avg_latency
                )
            else:
                avg_latency = p50_latency = p95_latency = p99_latency = 0

            # Error rate
            error_rate = (
                (self._error_count / self._request_count * 100) if self._request_count > 0 else 0
            )

            return {
                "total_requests": self._request_count,
                "total_errors": self._error_count,
                "error_rate_percent": round(error_rate, 2),
                "requests_per_minute": rpm,
                "uptime_seconds": round(uptime, 0),
                "latency": {
                    "avg_ms": round(avg_latency, 2),
                    "p50_ms": round(p50_latency, 2),
                    "p95_ms": round(p95_latency, 2),
                    "p99_ms": round(p99_latency, 2),
                },
                "status_codes": dict(self._status_counts),
            }

    def get_endpoint_stats(self, top_n: int = 10) -> Dict[str, Any]:
        """
        Obtiene estadisticas por endpoint.

        Args:
            top_n: Numero de top endpoints a retornar

        Returns:
            Estadisticas por endpoint
        """
        with self._lock:
            # Top endpoints por requests
            top_endpoints = sorted(self._endpoint_counts.items(), key=lambda x: x[1], reverse=True)[
                :top_n
            ]

            # Top errores
            top_errors = sorted(self._endpoint_errors.items(), key=lambda x: x[1], reverse=True)[
                :top_n
            ]

            # Latencia por endpoint
            endpoint_latencies = {}
            for endpoint, durations in self._endpoint_durations.items():
                if durations:
                    endpoint_latencies[endpoint] = {
                        "avg_ms": round(sum(durations) / len(durations), 2),
                        "count": len(durations),
                    }

            return {
                "top_endpoints": dict(top_endpoints),
                "top_errors": dict(top_errors),
                "endpoint_latencies": endpoint_latencies,
            }

    def get_business_metrics(self) -> Dict[str, Any]:
        """
        Obtiene metricas de negocio.

        Returns:
            Contadores y gauges de negocio
        """
        with self._lock:
            return {
                "counters": dict(self._business_counters),
                "gauges": dict(self._business_gauges),
            }

    def get_system_metrics(self) -> Dict[str, Any]:
        """
        Obtiene metricas del sistema.

        Returns:
            Metricas de sistema (memoria, etc.)
        """
        now = time.time()

        # Cachear metricas de sistema por 5 segundos
        if now - self._last_system_update < 5:
            return self._system_metrics

        try:
            import psutil

            process = psutil.Process(os.getpid())

            self._system_metrics = {
                "process": {
                    "memory_mb": round(process.memory_info().rss / 1024 / 1024, 2),
                    "memory_percent": round(process.memory_percent(), 2),
                    "cpu_percent": round(process.cpu_percent(), 2),
                    "threads": process.num_threads(),
                    "open_files": len(process.open_files()),
                },
                "system": {
                    "cpu_percent": round(psutil.cpu_percent(), 2),
                    "memory_percent": round(psutil.virtual_memory().percent, 2),
                    "disk_percent": round(psutil.disk_usage("/").percent, 2),
                },
            }
        except ImportError:
            # psutil no disponible
            self._system_metrics = {
                "process": {
                    "memory_mb": round(sys.getsizeof(gc.get_objects()) / 1024 / 1024, 2),
                    "threads": threading.active_count(),
                },
                "system": {"note": "psutil not installed for detailed metrics"},
            }
        except Exception as e:
            self._system_metrics = {"error": str(e)}

        self._last_system_update = now
        return self._system_metrics

    def get_all_metrics(self) -> Dict[str, Any]:
        """
        Obtiene todas las metricas.

        Returns:
            Todas las metricas combinadas
        """
        return {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "requests": self.get_request_stats(),
            "endpoints": self.get_endpoint_stats(),
            "business": self.get_business_metrics(),
            "system": self.get_system_metrics(),
        }

    def reset(self) -> None:
        """Reinicia todas las metricas."""
        with self._lock:
            self._request_count = 0
            self._error_count = 0
            self._request_history.clear()
            self._endpoint_counts.clear()
            self._endpoint_errors.clear()
            self._endpoint_durations.clear()
            self._status_counts.clear()
            self._business_counters.clear()
            self._business_gauges.clear()
            self._start_time = time.time()


# =============================================================================
# Singleton global
# =============================================================================

_metrics_collector: Optional[MetricsCollector] = None
_metrics_lock = threading.Lock()


def get_metrics_collector() -> MetricsCollector:
    """
    Obtiene el recolector de metricas global (singleton).

    Returns:
        Instancia del MetricsCollector
    """
    global _metrics_collector
    if _metrics_collector is None:
        with _metrics_lock:
            if _metrics_collector is None:
                _metrics_collector = MetricsCollector()
    return _metrics_collector


# =============================================================================
# Middleware para Flask
# =============================================================================


def init_metrics_middleware(app) -> None:
    """
    Inicializa middleware de metricas para Flask.

    Args:
        app: Aplicacion Flask
    """
    collector = get_metrics_collector()

    @app.before_request
    def before_request():
        from flask import g

        g.start_time = time.time()

    @app.after_request
    def after_request(response):
        from flask import g, request

        # Calcular duracion
        if hasattr(g, "start_time"):
            duration_ms = (time.time() - g.start_time) * 1000
        else:
            duration_ms = 0

        # Registrar metrica
        collector.record_request(
            method=request.method,
            path=request.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )

        return response


# =============================================================================
# Decorador para medir funciones
# =============================================================================


def timed(name: Optional[str] = None):
    """
    Decorador para medir tiempo de ejecucion de una funcion.

    Args:
        name: Nombre para la metrica (default: nombre de funcion)

    Usage:
        @timed("process_order")
        def process_order(order_id):
            ...
    """

    def decorator(func: Callable):
        metric_name = name or func.__name__

        def wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration_ms = (time.time() - start) * 1000
                collector = get_metrics_collector()
                collector.set_gauge(f"function_{metric_name}_last_ms", duration_ms)

        wrapper.__name__ = func.__name__
        wrapper.__doc__ = func.__doc__
        return wrapper

    return decorator


# =============================================================================
# Metricas de Cache
# =============================================================================


def get_cache_metrics() -> Dict[str, Any]:
    """
    Obtiene metricas de todos los sistemas de cache.

    Returns:
        Estadisticas unificadas de caches (simple, advanced, data_loader)
    """
    result = {}

    # Cache simple (TTLCache)
    try:
        from backend.core.cache import get_cache_stats
        result.update(get_cache_stats())
    except Exception:
        pass

    # Data cache loader (DataFrames SAP)
    try:
        from backend.core.cache_loader import get_consumo_cache, get_stock_cache
        # Solo verificar si estan cargados
        result["data_loader"] = {
            "stock_loaded": get_stock_cache() is not None,
            "consumo_loaded": get_consumo_cache() is not None,
        }
    except Exception:
        pass

    return result if result else {"error": "Cache modules not available"}


# =============================================================================
# Metricas de Pool de BD
# =============================================================================


def get_db_pool_metrics() -> Dict[str, Any]:
    """
    Obtiene metricas del pool de conexiones.

    Returns:
        Estadisticas del pool de BD
    """
    try:
        from backend.core.db_optimization import get_all_pool_stats
        return get_all_pool_stats()
    except Exception:
        return {"error": "DB optimization module not available"}
