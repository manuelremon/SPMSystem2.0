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

from flask import Blueprint, g, jsonify, request

from backend.core.metrics import get_cache_metrics, get_db_pool_metrics, get_metrics_collector
from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql
from backend.core.roles import require_auth, require_admin

bp = Blueprint("metrics", __name__, url_prefix="/api/metrics")


@bp.route("", methods=["GET"])
@bp.route("/", methods=["GET"])
@require_admin
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
@require_admin
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
@require_admin
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
    Obtiene metricas de negocio desde la base de datos.

    Requiere autenticacion.

    Returns:
        Contadores de solicitudes, usuarios, materiales
    """
    # Helper SQL para compatibilidad PostgreSQL/SQLite
    date_today = "CURRENT_DATE" if is_using_postgresql() else "DATE('now')"
    date_1day_ago = "NOW() - INTERVAL '1 day'" if is_using_postgresql() else "datetime('now', '-1 day')"
    date_30days_ago = "NOW() - INTERVAL '30 days'" if is_using_postgresql() else "datetime('now', '-30 days')"

    with get_db_connection() as conn:
        cur = conn.cursor()

        # Solicitudes por estado
        cur.execute("""
            SELECT estado, COUNT(*) as cnt
            FROM solicitudes
            GROUP BY estado
        """)
        rows = cur.fetchall()
        solicitudes_por_estado = {}
        for row in rows:
            estado = row["estado"] if isinstance(row, dict) else row[0]
            cnt = row["cnt"] if isinstance(row, dict) else row[1]
            solicitudes_por_estado[estado] = cnt

        # Solicitudes hoy
        cur.execute(f"""
            SELECT COUNT(*) as cnt FROM solicitudes
            WHERE DATE(created_at) = {date_today}
        """)
        row = cur.fetchone()
        solicitudes_hoy = row["cnt"] if isinstance(row, dict) else row[0]

        # Aprobaciones pendientes
        cur.execute("""
            SELECT COUNT(*) as cnt FROM solicitudes
            WHERE estado IN ('Enviada', 'En Revisión', 'En Revision')
        """)
        row = cur.fetchone()
        pendientes = row["cnt"] if isinstance(row, dict) else row[0]

        # Usuarios activos (login últimas 24h) - desde audit_log
        try:
            cur.execute(f"""
                SELECT COUNT(DISTINCT user_id) as cnt FROM audit_log
                WHERE action = 'login'
                AND timestamp > {date_1day_ago}
            """)
            row = cur.fetchone()
            usuarios_activos = row["cnt"] if isinstance(row, dict) else row[0]
        except Exception:
            # Si audit_log no existe o falla, retornar 0
            usuarios_activos = 0

        # Total usuarios activos
        cur.execute("SELECT COUNT(*) as cnt FROM usuarios WHERE activo = 1")
        row = cur.fetchone()
        total_usuarios = row["cnt"] if isinstance(row, dict) else row[0]

        # Materiales únicos solicitados (último mes)
        try:
            cur.execute(f"""
                SELECT COUNT(DISTINCT codigo_material) as cnt FROM solicitud_items si
                JOIN solicitudes s ON si.solicitud_id = s.id
                WHERE s.created_at > {date_30days_ago}
            """)
            row = cur.fetchone()
            materiales_mes = row["cnt"] if isinstance(row, dict) else row[0]
        except Exception:
            materiales_mes = 0

    return jsonify({
        "ok": True,
        "data": {
            "solicitudes": {
                "por_estado": solicitudes_por_estado,
                "hoy": solicitudes_hoy,
                "pendientes": pendientes,
                "total": sum(solicitudes_por_estado.values())
            },
            "usuarios": {
                "activos_24h": usuarios_activos,
                "total": total_usuarios
            },
            "materiales": {
                "unicos_mes": materiales_mes
            }
        }
    })


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

    # Whitelist de tablas permitidas (defensa en profundidad)
    ALLOWED_TABLES = {
        "usuarios", "solicitudes", "notificaciones", "mensajes", "presupuestos",
        "solpeds", "purchase_orders", "foro_posts", "stock", "consumo_historico",
        "materiales_bbdd", "pedidos", "reservas", "equivalencias",
        "materiales_equivalentes", "materiales", "grupos", "categorias"
    }

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
                # Validar tabla contra whitelist
                if table not in ALLOWED_TABLES:
                    counts[table] = -1  # Tabla no permitida
                    continue
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
@require_admin
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


# =============================================================================
# HISTÓRICO DE MÉTRICAS Y ALERTAS
# =============================================================================


@bp.route("/history", methods=["GET"])
@require_auth
def get_metrics_history():
    """
    Obtiene histórico de métricas para gráficos de tendencias.

    Query params:
        type: Tipo de métrica (cpu, memory, latency_p50, error_rate, cache_hit, all)
        hours: Horas hacia atrás (default 24, max 168)

    Returns:
        Histórico agrupado por tipo de métrica
    """
    metric_type = request.args.get("type", "all")
    hours = min(request.args.get("hours", 24, type=int), 168)  # Max 7 días

    # Helper SQL para compatibilidad
    if is_using_postgresql():
        time_filter = f"timestamp > NOW() - INTERVAL '{hours} hours'"
    else:
        time_filter = f"timestamp > datetime('now', '-{hours} hours')"

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            if metric_type == "all":
                cur.execute(f"""
                    SELECT metric_type, timestamp, metric_value
                    FROM metrics_history
                    WHERE {time_filter}
                    ORDER BY timestamp ASC
                """)
            else:
                cur.execute(f"""
                    SELECT metric_type, timestamp, metric_value
                    FROM metrics_history
                    WHERE metric_type = ?
                    AND {time_filter}
                    ORDER BY timestamp ASC
                """, (metric_type,))

            rows = cur.fetchall()

        # Agrupar por tipo de métrica
        history = {}
        for row in rows:
            t = row["metric_type"] if isinstance(row, dict) else row[0]
            ts = row["timestamp"] if isinstance(row, dict) else row[1]
            val = row["metric_value"] if isinstance(row, dict) else row[2]

            if t not in history:
                history[t] = []

            # Convertir timestamp a string ISO si es objeto datetime
            ts_str = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
            history[t].append({"timestamp": ts_str, "value": val})

        return jsonify({"ok": True, "data": history})

    except Exception as e:
        # Si la tabla no existe aún, retornar datos vacíos
        if "metrics_history" in str(e):
            return jsonify({"ok": True, "data": {}, "message": "No hay datos históricos aún"})
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500


@bp.route("/alerts", methods=["GET"])
@require_auth
def get_system_alerts():
    """
    Obtiene alertas del sistema.

    Query params:
        include_acknowledged: Incluir alertas ya reconocidas (default false)
        limit: Número máximo de alertas (default 50, max 200)

    Returns:
        Lista de alertas ordenadas por timestamp descendente
    """
    include_acknowledged = request.args.get("include_acknowledged", "false") == "true"
    limit = min(request.args.get("limit", 50, type=int), 200)

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            if include_acknowledged:
                cur.execute("""
                    SELECT id, timestamp, alert_type, metric_name, threshold_value,
                           actual_value, message, acknowledged, acknowledged_by,
                           acknowledged_at, created_at
                    FROM system_alerts
                    ORDER BY timestamp DESC
                    LIMIT ?
                """, (limit,))
            else:
                cur.execute("""
                    SELECT id, timestamp, alert_type, metric_name, threshold_value,
                           actual_value, message, acknowledged, acknowledged_by,
                           acknowledged_at, created_at
                    FROM system_alerts
                    WHERE acknowledged = FALSE
                    ORDER BY timestamp DESC
                    LIMIT ?
                """, (limit,))

            rows = cur.fetchall()

        # Convertir a lista de diccionarios
        alerts = []
        for row in rows:
            if isinstance(row, dict):
                alert = dict(row)
            else:
                alert = {
                    "id": row[0],
                    "timestamp": row[1],
                    "alert_type": row[2],
                    "metric_name": row[3],
                    "threshold_value": row[4],
                    "actual_value": row[5],
                    "message": row[6],
                    "acknowledged": row[7],
                    "acknowledged_by": row[8],
                    "acknowledged_at": row[9],
                    "created_at": row[10]
                }
            # Convertir timestamps a string si es necesario
            for key in ["timestamp", "acknowledged_at", "created_at"]:
                if alert.get(key) and hasattr(alert[key], "isoformat"):
                    alert[key] = alert[key].isoformat()
            alerts.append(alert)

        return jsonify({"ok": True, "data": alerts, "total": len(alerts)})

    except Exception as e:
        # Si la tabla no existe aún, retornar lista vacía
        if "system_alerts" in str(e):
            return jsonify({"ok": True, "data": [], "total": 0, "message": "Sin alertas"})
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500


@bp.route("/alerts/<int:alert_id>/acknowledge", methods=["POST"])
@require_admin
def acknowledge_alert(alert_id):
    """
    Marca una alerta como reconocida.

    Solo usuarios admin pueden reconocer alertas.

    Path params:
        alert_id: ID de la alerta a reconocer

    Returns:
        Confirmación de reconocimiento
    """
    user_id = g.user.get("id") if hasattr(g, "user") and g.user else None

    # SQL helper para timestamp actual
    now_sql = "NOW()" if is_using_postgresql() else "datetime('now')"

    try:
        with get_db_transaction() as conn:
            cur = conn.cursor()

            # Verificar que la alerta existe
            cur.execute("SELECT id, acknowledged FROM system_alerts WHERE id = ?", (alert_id,))
            row = cur.fetchone()

            if not row:
                return jsonify({
                    "ok": False,
                    "error": {"code": "not_found", "message": "Alerta no encontrada"}
                }), 404

            acknowledged = row["acknowledged"] if isinstance(row, dict) else row[1]
            if acknowledged:
                return jsonify({
                    "ok": False,
                    "error": {"code": "already_acknowledged", "message": "Alerta ya fue reconocida"}
                }), 400

            # Marcar como reconocida
            cur.execute(f"""
                UPDATE system_alerts
                SET acknowledged = TRUE,
                    acknowledged_by = ?,
                    acknowledged_at = {now_sql}
                WHERE id = ?
            """, (user_id, alert_id))

        return jsonify({
            "ok": True,
            "data": {
                "message": "Alerta reconocida",
                "alert_id": alert_id,
                "acknowledged_by": user_id
            }
        })

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500


@bp.route("/alerts/acknowledge-all", methods=["POST"])
@require_admin
def acknowledge_all_alerts():
    """
    Marca todas las alertas pendientes como reconocidas.

    Solo usuarios admin.

    Returns:
        Número de alertas reconocidas
    """
    user_id = g.user.get("id") if hasattr(g, "user") and g.user else None
    now_sql = "NOW()" if is_using_postgresql() else "datetime('now')"

    try:
        with get_db_transaction() as conn:
            cur = conn.cursor()

            cur.execute(f"""
                UPDATE system_alerts
                SET acknowledged = TRUE,
                    acknowledged_by = ?,
                    acknowledged_at = {now_sql}
                WHERE acknowledged = FALSE
            """, (user_id,))

            # Obtener número de filas afectadas
            affected = cur.rowcount if hasattr(cur, "rowcount") else 0

        return jsonify({
            "ok": True,
            "data": {
                "message": f"{affected} alertas reconocidas",
                "count": affected
            }
        })

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500
