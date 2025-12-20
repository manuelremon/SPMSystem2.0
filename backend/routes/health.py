"""
Health check endpoints avanzados.
Sprint 9.3 - Verificacion completa del estado del sistema.

Endpoints:
- GET /health          - Health check basico (para load balancers)
- GET /api/health      - Health check detallado
- GET /api/health/live - Liveness probe (Kubernetes)
- GET /api/health/ready - Readiness probe (Kubernetes)
"""

import logging
import os
import sqlite3
import time
from datetime import datetime

from flask import Blueprint, jsonify, request

try:
    from backend.core.config import settings
    from backend.core.db import get_db_path, is_using_postgresql
except ImportError:
    from core.config import settings
    from core.db import get_db_path, is_using_postgresql

logger = logging.getLogger(__name__)

bp = Blueprint("health", __name__)

# Tiempo de inicio de la aplicacion
_start_time = time.time()
API_VERSION = "2.0.0"


def _check_database(db_name: str = "spm") -> dict:
    """
    Verifica conectividad a una base de datos.

    Args:
        db_name: Nombre de la BD a verificar

    Returns:
        Estado de la BD
    """
    try:
        # BD principal (spm) puede usar PostgreSQL en produccion
        if db_name == "spm" and is_using_postgresql():
            return _check_postgresql()

        # BDs secundarias siempre usan SQLite
        db_path = get_db_path(db_name)
        if not db_path.exists():
            return {"status": "unavailable", "error": f"Database file not found: {db_path}"}

        start = time.time()
        conn = sqlite3.connect(str(db_path), timeout=5.0)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        conn.close()
        latency_ms = (time.time() - start) * 1000

        return {
            "status": "healthy",
            "latency_ms": round(latency_ms, 2),
            "path": str(db_path),
            "size_mb": round(db_path.stat().st_size / 1024 / 1024, 2),
        }

    except sqlite3.Error as e:
        return {"status": "unhealthy", "error": str(e)}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def _check_postgresql() -> dict:
    """
    Verifica conectividad a PostgreSQL.

    Returns:
        Estado de la BD PostgreSQL
    """
    try:
        import psycopg2

        start = time.time()
        conn = psycopg2.connect(settings.DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        conn.close()
        latency_ms = (time.time() - start) * 1000

        return {
            "status": "healthy",
            "latency_ms": round(latency_ms, 2),
            "type": "postgresql",
        }

    except ImportError:
        return {"status": "error", "error": "psycopg2 not installed"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


def _check_cache() -> dict:
    """
    Verifica estado del cache.

    Returns:
        Estado del cache
    """
    try:
        from backend.core.cache import get_cache_stats
    except ImportError:
        try:
            from core.cache import get_cache_stats
        except ImportError:
            return {"status": "unavailable", "error": "Cache module not found"}

    try:
        stats = get_cache_stats()
        return {"status": "healthy", "stats": stats}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def _check_metrics() -> dict:
    """
    Verifica estado del sistema de metricas.

    Returns:
        Estado del sistema de metricas
    """
    try:
        from backend.core.metrics import get_metrics_collector
    except ImportError:
        try:
            from core.metrics import get_metrics_collector
        except ImportError:
            return {"status": "unavailable"}

    try:
        collector = get_metrics_collector()
        stats = collector.get_request_stats()
        return {
            "status": "healthy",
            "total_requests": stats["total_requests"],
            "error_rate": stats["error_rate_percent"],
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


def _get_uptime() -> dict:
    """
    Obtiene informacion de uptime.

    Returns:
        Uptime en diferentes formatos
    """
    uptime_seconds = time.time() - _start_time
    hours = int(uptime_seconds // 3600)
    minutes = int((uptime_seconds % 3600) // 60)
    seconds = int(uptime_seconds % 60)

    return {
        "seconds": round(uptime_seconds, 0),
        "formatted": f"{hours}h {minutes}m {seconds}s",
        "started_at": datetime.fromtimestamp(_start_time).isoformat(),
    }


@bp.route("/health", methods=["GET"])
def health_check_basic():
    """
    Health check basico para load balancers.

    Retorna 200 si el servidor esta respondiendo.
    No verifica dependencias para respuesta rapida.

    Returns:
        JSON con estado basico
    """
    return jsonify({"ok": True, "status": "healthy", "version": API_VERSION}), 200


@bp.route("/api/health", methods=["GET"])
def health_check_detailed():
    """
    Health check detallado con verificacion de dependencias.

    Query params:
        - include: Componentes a incluir (db,cache,metrics) separados por coma
        - verbose: true para informacion extra

    Returns:
        JSON con estado detallado del sistema
    """
    include = request.args.get("include", "db,cache,metrics").split(",")
    verbose = request.args.get("verbose", "false").lower() == "true"

    checks = {}
    overall_status = "healthy"

    # Database checks
    if "db" in include:
        checks["database"] = {
            "spm": _check_database("spm"),
            "sap_data": _check_database("sap_data"),
            "equivalentes": _check_database("equivalentes"),
            "catalogo_materiales": _check_database("catalogo_materiales"),
        }

        # Verificar si alguna BD esta unhealthy
        for db_status in checks["database"].values():
            if db_status.get("status") not in ["healthy", "unavailable"]:
                overall_status = "degraded"

    # Cache check
    if "cache" in include:
        checks["cache"] = _check_cache()
        if checks["cache"].get("status") == "error":
            overall_status = "degraded"

    # Metrics check
    if "metrics" in include:
        checks["metrics"] = _check_metrics()

    response = {
        "ok": overall_status == "healthy",
        "status": overall_status,
        "version": API_VERSION,
        "environment": settings.ENV,
        "uptime": _get_uptime(),
        "checks": checks,
    }

    if verbose:
        response["server"] = {
            "host": request.host,
            "python_version": f"{os.sys.version_info.major}.{os.sys.version_info.minor}.{os.sys.version_info.micro}",
            "debug_mode": settings.DEBUG,
        }

    status_code = 200 if overall_status == "healthy" else 503
    return jsonify(response), status_code


@bp.route("/api/health/live", methods=["GET"])
def liveness_probe():
    """
    Liveness probe para Kubernetes.

    Indica si la aplicacion esta viva (no colgada).
    No verifica dependencias - solo que el proceso responde.

    Returns:
        JSON con estado de liveness
    """
    return (
        jsonify({"ok": True, "status": "alive", "timestamp": datetime.utcnow().isoformat() + "Z"}),
        200,
    )


@bp.route("/api/health/ready", methods=["GET"])
def readiness_probe():
    """
    Readiness probe para Kubernetes.

    Indica si la aplicacion esta lista para recibir trafico.
    Verifica conectividad a BD principal.

    Returns:
        JSON con estado de readiness
    """
    # Verificar BD principal
    db_check = _check_database("spm")

    if db_check.get("status") == "healthy":
        return jsonify({"ok": True, "status": "ready", "database": db_check}), 200
    else:
        return jsonify({"ok": False, "status": "not_ready", "database": db_check}), 503


@bp.route("/api/health/dependencies", methods=["GET"])
def check_dependencies():
    """
    Verifica estado de todas las dependencias.

    Returns:
        JSON con estado de cada dependencia
    """
    dependencies = {
        "databases": {
            "spm": _check_database("spm"),
            "sap_data": _check_database("sap_data"),
            "equivalentes": _check_database("equivalentes"),
            "catalogo_materiales": _check_database("catalogo_materiales"),
        },
        "cache": _check_cache(),
        "metrics": _check_metrics(),
    }

    # Determinar estado general
    all_healthy = True
    for category in dependencies.values():
        if isinstance(category, dict):
            if "status" in category:
                if category["status"] not in ["healthy", "unavailable"]:
                    all_healthy = False
            else:
                for dep in category.values():
                    if dep.get("status") not in ["healthy", "unavailable"]:
                        all_healthy = False

    return jsonify(
        {
            "ok": all_healthy,
            "status": "healthy" if all_healthy else "degraded",
            "dependencies": dependencies,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
    ), (200 if all_healthy else 503)
