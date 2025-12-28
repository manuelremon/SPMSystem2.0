"""
Health check endpoints avanzados.
Sprint 9.3 - Verificacion completa del estado del sistema.

Endpoints:
- GET /health          - Health check basico (para load balancers)
- GET /api/health      - Health check detallado
- GET /api/health/live - Liveness probe (Kubernetes)
- GET /api/health/ready - Readiness probe (Kubernetes)
"""

import json
import logging
import os
import shutil
import sqlite3
import subprocess
import time
from datetime import datetime

from flask import Blueprint, jsonify, request

try:
    from backend.core.config import settings
    from backend.core.db import get_db_path
    from backend.core.auth_middleware import require_auth
except ImportError:
    from core.config import settings
    from core.db import get_db_path
    from core.auth_middleware import require_auth

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
        # BD principal (spm) usa PostgreSQL
        if db_name == "spm":
            return _check_postgresql()

        # BDs secundarias todavia usan SQLite (migracion pendiente)
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


# =============================================================================
# Infrastructure Monitoring
# =============================================================================


def _run_command(cmd: list, timeout: int = 5) -> tuple:
    """
    Ejecuta un comando de shell con timeout.

    Args:
        cmd: Lista con comando y argumentos
        timeout: Timeout en segundos

    Returns:
        (success, output)
    """
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, check=False
        )
        return result.returncode == 0, result.stdout.strip()
    except subprocess.TimeoutExpired:
        return False, "timeout"
    except FileNotFoundError:
        return False, "command not found"
    except Exception as e:
        return False, str(e)


def _get_docker_status() -> dict:
    """
    Obtiene estado de contenedores Docker.

    Returns:
        Dict con lista de contenedores y su estado
    """
    result = {"available": False, "containers": [], "error": None}

    # Verificar si docker está disponible
    success, output = _run_command(["docker", "version", "--format", "{{.Server.Version}}"])
    if not success:
        result["error"] = "Docker no disponible" if output == "command not found" else output
        return result

    result["available"] = True
    result["docker_version"] = output

    # Obtener lista de contenedores
    success, output = _run_command([
        "docker", "ps", "-a", "--format",
        '{"name":"{{.Names}}","status":"{{.Status}}","state":"{{.State}}","image":"{{.Image}}","ports":"{{.Ports}}"}'
    ])

    if not success:
        result["error"] = output
        return result

    containers = []
    for line in output.split("\n"):
        if line.strip():
            try:
                container = json.loads(line)
                # Extraer uptime del status
                status = container.get("status", "")
                container["running"] = container.get("state") == "running"
                containers.append(container)
            except json.JSONDecodeError:
                continue

    result["containers"] = containers
    result["running_count"] = sum(1 for c in containers if c.get("running"))
    result["total_count"] = len(containers)

    return result


def _get_git_status() -> dict:
    """
    Obtiene información del repositorio Git.

    Returns:
        Dict con info de git (branch, último commit, etc.)
    """
    result = {"available": False, "error": None}

    # Verificar si git está disponible
    success, _ = _run_command(["git", "--version"])
    if not success:
        result["error"] = "Git no disponible"
        return result

    result["available"] = True

    # Branch actual
    success, branch = _run_command(["git", "branch", "--show-current"])
    result["branch"] = branch if success else "unknown"

    # Último commit
    success, commit_info = _run_command([
        "git", "log", "-1", "--format=%H|%s|%ar|%an"
    ])
    if success and commit_info:
        parts = commit_info.split("|")
        if len(parts) >= 4:
            result["last_commit"] = {
                "hash": parts[0][:7],
                "hash_full": parts[0],
                "message": parts[1][:50] + ("..." if len(parts[1]) > 50 else ""),
                "time_ago": parts[2],
                "author": parts[3],
            }

    # Cambios pendientes
    success, status_output = _run_command(["git", "status", "--porcelain"])
    if success:
        changes = [line for line in status_output.split("\n") if line.strip()]
        result["pending_changes"] = len(changes)
        result["clean"] = len(changes) == 0

    # Remote URL (sin credenciales)
    success, remote = _run_command(["git", "remote", "get-url", "origin"])
    if success:
        # Limpiar credenciales si existen
        if "@" in remote:
            remote = remote.split("@")[-1]
        result["remote"] = remote

    return result


def _get_services_status() -> dict:
    """
    Obtiene estado de servicios del sistema.

    Returns:
        Dict con estado de servicios (nginx, postgresql, docker)
    """
    result = {"services": []}

    # Lista de servicios a verificar con sus puertos
    services_to_check = [
        {"name": "nginx", "port": 443, "systemd": "nginx"},
        {"name": "postgresql", "port": 5432, "systemd": "postgresql"},
        {"name": "docker", "port": None, "systemd": "docker"},
    ]

    for svc in services_to_check:
        service_status = {
            "name": svc["name"],
            "running": False,
            "port": svc["port"],
        }

        # Intentar con systemctl
        success, output = _run_command(["systemctl", "is-active", svc["systemd"]])
        if success and output == "active":
            service_status["running"] = True
            service_status["method"] = "systemctl"
        else:
            # Fallback: verificar puerto si está definido
            if svc["port"]:
                success, _ = _run_command([
                    "ss", "-tlnp", f"sport = :{svc['port']}"
                ])
                if success:
                    # Si ss no falla y tiene contenido, el puerto está en uso
                    service_status["running"] = True
                    service_status["method"] = "port_check"

        result["services"].append(service_status)

    # Agregar información del sistema
    result["system"] = {}

    # Uso de disco
    disk = shutil.disk_usage("/")
    result["system"]["disk"] = {
        "total_gb": round(disk.total / (1024**3), 1),
        "used_gb": round(disk.used / (1024**3), 1),
        "free_gb": round(disk.free / (1024**3), 1),
        "percent_used": round(disk.used / disk.total * 100, 1),
    }

    # Carga del sistema
    try:
        load1, load5, load15 = os.getloadavg()
        result["system"]["load"] = {
            "1min": round(load1, 2),
            "5min": round(load5, 2),
            "15min": round(load15, 2),
        }
    except (OSError, AttributeError):
        pass

    return result


def _get_oci_metadata() -> dict:
    """
    Obtiene metadatos de la instancia Oracle Cloud desde el servicio IMDS.

    El Instance Metadata Service (IMDS) está disponible en 169.254.169.254
    y no requiere autenticación desde dentro de la instancia.

    Returns:
        Dict con información de la instancia OCI
    """
    import urllib.request
    import urllib.error

    result = {"available": False, "error": None}

    try:
        # OCI Instance Metadata Service v2
        url = "http://169.254.169.254/opc/v2/instance/"
        req = urllib.request.Request(url)
        req.add_header("Authorization", "Bearer Oracle")

        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))

            result["available"] = True
            result["instance"] = {
                "id": data.get("id", "").split(".")[-1][:12] + "...",  # Truncar OCID
                "name": data.get("displayName"),
                "hostname": data.get("hostname"),
                "state": data.get("state"),
                "created": data.get("timeCreated"),
            }
            result["shape"] = {
                "name": data.get("shape"),
                "ocpus": data.get("shapeConfig", {}).get("ocpus"),
                "memory_gb": data.get("shapeConfig", {}).get("memoryInGBs"),
                "network_gbps": data.get("shapeConfig", {}).get("networkingBandwidthInGbps"),
            }
            result["location"] = {
                "region": data.get("region"),
                "availability_domain": data.get("availabilityDomain", "").split(":")[-1],
                "fault_domain": data.get("faultDomain"),
            }

    except urllib.error.URLError as e:
        result["error"] = f"Metadata service unavailable: {e.reason}"
    except Exception as e:
        result["error"] = str(e)

    return result


def _get_system_metrics() -> dict:
    """
    Obtiene métricas del sistema en tiempo real.

    Lee /proc/stat y /proc/meminfo para CPU y memoria.

    Returns:
        Dict con métricas de CPU y memoria
    """
    result = {}

    # CPU Usage (from /proc/stat)
    try:
        with open("/proc/stat", "r") as f:
            line = f.readline()
            if line.startswith("cpu "):
                parts = line.split()[1:]
                # user, nice, system, idle, iowait, irq, softirq
                idle = int(parts[3]) + int(parts[4])  # idle + iowait
                total = sum(int(p) for p in parts[:7])
                # Necesitamos dos muestras para calcular % real
                # Por ahora retornamos los valores de carga
    except Exception:
        pass

    # Memory Usage (from /proc/meminfo)
    try:
        meminfo = {}
        with open("/proc/meminfo", "r") as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 2:
                    key = parts[0].rstrip(":")
                    value = int(parts[1])  # En KB
                    meminfo[key] = value

        total = meminfo.get("MemTotal", 0)
        available = meminfo.get("MemAvailable", 0)
        used = total - available

        result["memory"] = {
            "total_gb": round(total / 1024 / 1024, 1),
            "used_gb": round(used / 1024 / 1024, 1),
            "available_gb": round(available / 1024 / 1024, 1),
            "percent_used": round(used / total * 100, 1) if total > 0 else 0,
        }
    except Exception:
        pass

    # Uptime
    try:
        with open("/proc/uptime", "r") as f:
            uptime_seconds = float(f.read().split()[0])
            days = int(uptime_seconds // 86400)
            hours = int((uptime_seconds % 86400) // 3600)
            minutes = int((uptime_seconds % 3600) // 60)
            result["uptime"] = {
                "seconds": int(uptime_seconds),
                "formatted": f"{days}d {hours}h {minutes}m" if days > 0 else f"{hours}h {minutes}m",
            }
    except Exception:
        pass

    return result


@bp.route("/api/health/infrastructure", methods=["GET"])
@require_auth
def infrastructure_status():
    """
    Estado de infraestructura: Docker, Git, servicios del sistema.

    Requiere autenticación para no exponer información sensible.
    Solo usuarios autenticados pueden acceder a esta información.

    Returns:
        JSON con estado de Docker, Git y servicios
    """

    try:
        response = {
            "ok": True,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "oci": _get_oci_metadata(),
            "system": _get_system_metrics(),
            "docker": _get_docker_status(),
            "git": _get_git_status(),
            "services": _get_services_status(),
        }

        return jsonify(response), 200

    except Exception as e:
        logger.exception("Error getting infrastructure status")
        return jsonify({
            "ok": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }), 500
