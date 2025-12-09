"""
Endpoints para metricas y monitoreo.
Sprint 9.2 - Expone metricas de aplicacion, negocio y sistema.

Endpoints:
- GET /api/metrics           - Todas las metricas
- GET /api/metrics/requests  - Metricas de requests
- GET /api/metrics/endpoints - Metricas por endpoint
- GET /api/metrics/business  - Metricas de negocio
- GET /api/metrics/system    - Metricas de sistema
- GET /api/metrics/cache     - Metricas de cache
- GET /api/metrics/db        - Metricas de BD
- POST /api/metrics/reset    - Reiniciar metricas (admin)
"""

from functools import wraps

from flask import Blueprint, g, jsonify

try:
    from backend.core.metrics import get_cache_metrics, get_db_pool_metrics, get_metrics_collector
except ImportError:
    from core.metrics import get_cache_metrics, get_db_pool_metrics, get_metrics_collector

bp = Blueprint("metrics", __name__, url_prefix="/api/metrics")


def require_auth(f):
    """Decorator que requiere autenticacion."""

    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, "user") or not g.user:
            return (
                jsonify(
                    {"ok": False, "error": {"code": "unauthorized", "message": "No autenticado"}}
                ),
                401,
            )
        return f(*args, **kwargs)

    return decorated


def require_admin(f):
    """Decorator que requiere rol admin."""

    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, "user") or not g.user:
            return (
                jsonify(
                    {"ok": False, "error": {"code": "unauthorized", "message": "No autenticado"}}
                ),
                401,
            )

        if "admin" not in g.user.get("rol", "").lower():
            return (
                jsonify(
                    {"ok": False, "error": {"code": "forbidden", "message": "Requiere rol admin"}}
                ),
                403,
            )

        return f(*args, **kwargs)

    return decorated


@bp.route("", methods=["GET"])
@bp.route("/", methods=["GET"])
def get_all_metrics():
    """
    Obtiene todas las metricas del sistema.

    Returns:
        JSON con metricas de requests, endpoints, negocio y sistema
    """
    collector = get_metrics_collector()
    metrics = collector.get_all_metrics()

    # Agregar metricas de cache y BD
    metrics["cache"] = get_cache_metrics()
    metrics["database"] = get_db_pool_metrics()

    return jsonify({"ok": True, "data": metrics})


@bp.route("/requests", methods=["GET"])
def get_request_metrics():
    """
    Obtiene metricas de requests HTTP.

    Returns:
        Estadisticas de requests, errores y latencia
    """
    collector = get_metrics_collector()
    stats = collector.get_request_stats()

    return jsonify({"ok": True, "data": stats})


@bp.route("/endpoints", methods=["GET"])
def get_endpoint_metrics():
    """
    Obtiene metricas por endpoint.

    Returns:
        Top endpoints, errores y latencias
    """
    collector = get_metrics_collector()
    stats = collector.get_endpoint_stats()

    return jsonify({"ok": True, "data": stats})


@bp.route("/business", methods=["GET"])
@require_auth
def get_business_metrics():
    """
    Obtiene metricas de negocio.

    Requiere autenticacion.

    Returns:
        Contadores y gauges de negocio
    """
    collector = get_metrics_collector()
    stats = collector.get_business_metrics()

    return jsonify({"ok": True, "data": stats})


@bp.route("/system", methods=["GET"])
@require_auth
def get_system_metrics():
    """
    Obtiene metricas del sistema.

    Requiere autenticacion.

    Returns:
        Metricas de proceso y sistema (CPU, memoria, etc.)
    """
    collector = get_metrics_collector()
    stats = collector.get_system_metrics()

    return jsonify({"ok": True, "data": stats})


@bp.route("/cache", methods=["GET"])
@require_auth
def get_cache_metrics_endpoint():
    """
    Obtiene metricas de cache.

    Requiere autenticacion.

    Returns:
        Estadisticas de todos los caches
    """
    stats = get_cache_metrics()

    return jsonify({"ok": True, "data": stats})


@bp.route("/db", methods=["GET"])
@require_auth
def get_db_metrics():
    """
    Obtiene metricas del pool de BD.

    Requiere autenticacion.

    Returns:
        Estadisticas del pool de conexiones
    """
    stats = get_db_pool_metrics()

    return jsonify({"ok": True, "data": stats})


@bp.route("/db-stats", methods=["GET"])
@require_auth
def get_db_stats():
    """
    Obtiene estadisticas de las bases de datos.

    Returns:
        Conteo de registros y tamaño de cada BD
    """
    import sqlite3

    try:
        from backend.core.db import get_db_path
    except ImportError:
        from core.db import get_db_path

    def get_table_counts(db_name, tables):
        """Obtiene conteo de registros de tablas especificadas."""
        try:
            db_path = get_db_path(db_name)
            if not db_path.exists():
                return {"error": f"Database {db_name} not found"}

            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            counts = {}
            for table in tables:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    counts[table] = cursor.fetchone()[0]
                except sqlite3.OperationalError:
                    counts[table] = 0
            conn.close()

            size_mb = round(db_path.stat().st_size / 1024 / 1024, 2)
            return {"counts": counts, "size_mb": size_mb, "total_records": sum(counts.values())}
        except Exception as e:
            return {"error": str(e)}

    stats = {
        "spm": get_table_counts(
            "spm",
            [
                "usuarios",
                "solicitudes",
                "notificaciones",
                "mensajes",
                "presupuestos",
                "solpeds",
                "purchase_orders",
                "foro_posts",
            ],
        ),
        "sap_data": get_table_counts(
            "sap_data", ["stock", "consumo_historico", "materiales_bbdd", "pedidos", "reservas"]
        ),
        "equivalentes": get_table_counts(
            "equivalentes", ["equivalencias", "materiales_equivalentes"]
        ),
        "catalogo_materiales": get_table_counts(
            "catalogo_materiales", ["materiales", "grupos", "categorias"]
        ),
    }

    # Calcular totales
    total_records = sum(
        db.get("total_records", 0)
        for db in stats.values()
        if isinstance(db, dict) and "error" not in db
    )
    total_size = sum(
        db.get("size_mb", 0) for db in stats.values() if isinstance(db, dict) and "error" not in db
    )

    return jsonify(
        {
            "ok": True,
            "data": {
                "databases": stats,
                "totals": {"records": total_records, "size_mb": round(total_size, 2)},
            },
        }
    )


@bp.route("/reset", methods=["POST"])
@require_admin
def reset_metrics():
    """
    Reinicia todas las metricas.

    Solo admin puede reiniciar metricas.

    Returns:
        Confirmacion de reinicio
    """
    collector = get_metrics_collector()
    collector.reset()

    return jsonify(
        {
            "ok": True,
            "data": {
                "message": "Metricas reiniciadas",
                "reset_at": collector.get_request_stats()["uptime_seconds"],
            },
        }
    )


@bp.route("/prometheus", methods=["GET"])
def prometheus_metrics():
    """
    Expone metricas en formato Prometheus.

    Returns:
        Metricas en formato text/plain para Prometheus
    """
    collector = get_metrics_collector()
    stats = collector.get_request_stats()
    cache_stats = get_cache_metrics()

    lines = [
        "# HELP spm_requests_total Total de requests HTTP",
        "# TYPE spm_requests_total counter",
        f"spm_requests_total {stats['total_requests']}",
        "",
        "# HELP spm_errors_total Total de errores HTTP",
        "# TYPE spm_errors_total counter",
        f"spm_errors_total {stats['total_errors']}",
        "",
        "# HELP spm_request_duration_milliseconds Latencia de requests",
        "# TYPE spm_request_duration_milliseconds gauge",
        f'spm_request_duration_milliseconds{{quantile="0.5"}} {stats["latency"]["p50_ms"]}',
        f'spm_request_duration_milliseconds{{quantile="0.95"}} {stats["latency"]["p95_ms"]}',
        f'spm_request_duration_milliseconds{{quantile="0.99"}} {stats["latency"]["p99_ms"]}',
        "",
        "# HELP spm_uptime_seconds Tiempo desde inicio",
        "# TYPE spm_uptime_seconds gauge",
        f"spm_uptime_seconds {stats['uptime_seconds']}",
        "",
    ]

    # Status codes
    lines.append("# HELP spm_http_responses_total Respuestas por status code")
    lines.append("# TYPE spm_http_responses_total counter")
    for code, count in stats.get("status_codes", {}).items():
        lines.append(f'spm_http_responses_total{{status="{code}"}} {count}')

    # Cache metrics
    if isinstance(cache_stats, dict) and "error" not in cache_stats:
        lines.append("")
        lines.append("# HELP spm_cache_hits_total Hits de cache")
        lines.append("# TYPE spm_cache_hits_total counter")
        for cache_name, cache_data in cache_stats.items():
            if isinstance(cache_data, dict) and "hits" in cache_data:
                lines.append(f'spm_cache_hits_total{{cache="{cache_name}"}} {cache_data["hits"]}')

        lines.append("")
        lines.append("# HELP spm_cache_misses_total Misses de cache")
        lines.append("# TYPE spm_cache_misses_total counter")
        for cache_name, cache_data in cache_stats.items():
            if isinstance(cache_data, dict) and "misses" in cache_data:
                lines.append(
                    f'spm_cache_misses_total{{cache="{cache_name}"}} {cache_data["misses"]}'
                )

    return "\n".join(lines), 200, {"Content-Type": "text/plain; charset=utf-8"}
