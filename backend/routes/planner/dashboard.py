"""
Planner - Dashboard y Listados

Endpoints para dashboard de planificador, listados de solicitudes
y consultas de presupuesto.
"""

import json
import logging

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection
from backend.core.roles import require_auth
from backend.routes.planner_helpers import (
    _current_user,
    _require_planner_role,
    _table_exists,
)

logger = logging.getLogger(__name__)

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/dashboard", methods=["GET"])
def dashboard_stats():
    """Estadisticas para el dashboard del planificador/admin"""
    stats = {
        "total_solicitudes": 0,
        "en_aprobacion": 0,
        "en_planificacion": 0,
        "presupuesto_disponible": 0,
    }
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            if _table_exists(conn, "solicitudes"):
                cur.execute("SELECT status, COUNT(*) as cnt FROM solicitudes GROUP BY status")
                rows = cur.fetchall() or []
                counts = {}
                for row in rows:
                    if isinstance(row, dict):
                        counts[row["status"]] = row["cnt"]
                    else:
                        counts[row[0]] = row[1]
                stats["total_solicitudes"] = int(sum(counts.values()))
                stats["en_aprobacion"] = int(
                    counts.get("En Progreso", 0)
                    + counts.get("Enviada", 0)
                    + counts.get("En Aprobacion", 0)
                    + counts.get("En aprobacion", 0)
                )
                stats["en_planificacion"] = int(
                    counts.get("Aprobada", 0)
                    + counts.get("En tratamiento", 0)
                    + counts.get("Tratado", 0)
                )

            if _table_exists(conn, "presupuestos"):
                cur.execute("SELECT SUM(saldo_usd) as total FROM presupuestos")
                total_saldo = cur.fetchone()
                # Compatibilidad PostgreSQL (dict) y SQLite (tuple)
                if total_saldo:
                    if isinstance(total_saldo, dict):
                        stats["presupuesto_disponible"] = float(total_saldo.get("total", 0) or 0)
                    else:
                        stats["presupuesto_disponible"] = float(total_saldo[0] or 0)
                else:
                    stats["presupuesto_disponible"] = 0.0

        return jsonify({"ok": True, "data": stats}), 200
    except Exception as exc:
        return (
            jsonify({"ok": False, "error": {"code": "dashboard_error", "message": str(exc)}}),
            500,
        )


def _load_solicitudes(filters: dict):
    """Carga solicitudes con filtros aplicados"""
    # FSM: Soportar tanto estados legacy como nuevos (normalizados)
    where = [
        """(
            s.status IN ('Aprobada', 'En Progreso', 'En tratamiento', 'Tratado', 'Finalizada', 'Completada')
            OR s.status IN ('approved', 'in_planning', 'in_treatment', 'treated', 'completed')
        )"""
    ]
    params = []
    if filters.get("planner_id"):
        where.append("s.planner_id = ?")
        params.append(filters["planner_id"])
    if filters.get("centro"):
        where.append("s.centro = ?")
        params.append(filters["centro"])
    if filters.get("sector"):
        where.append("s.sector = ?")
        params.append(filters["sector"])
    where_sql = "WHERE " + " AND ".join(where)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"""
            SELECT
                s.id, s.id_usuario, s.centro, s.sector, s.justificacion, s.centro_costos, s.almacen_virtual,
                s.criticidad, s.fecha_necesidad, s.status, s.total_monto, s.planner_id, s.created_at, s.updated_at, s.data_json, s.aprobador_id,
                u.nombre AS solicitante_nombre, u.apellido AS solicitante_apellido,
                ua.nombre AS aprobador_nombre, ua.apellido AS aprobador_apellido,
                up.nombre AS planner_nombre, up.apellido AS planner_apellido
            FROM solicitudes s
            LEFT JOIN usuarios u ON s.id_usuario = u.id_spm
            LEFT JOIN usuarios ua ON s.aprobador_id = ua.id_spm
            LEFT JOIN usuarios up ON s.planner_id = up.id_spm
            {where_sql}
            ORDER BY s.updated_at DESC
            """,
            params,
        )
        rows = cur.fetchall()

    results = []
    for r in rows:
        d = dict(r)
        extra = {}
        try:
            extra = json.loads(d.get("data_json") or "{}")
        except Exception:
            extra = {}
        d["items"] = extra.get("items", [])
        results.append(d)
    return results


@dashboard_bp.route("/solicitudes", methods=["GET"])
@require_auth
def listar_solicitudes_aprobadas():
    """Solicitudes aprobadas/asignadas para planificador"""
    user = _current_user()
    if isinstance(user, tuple):
        return user
    guard, is_admin = _require_planner_role(user)
    if guard:
        return guard
    planner_id = user.get("id_spm") if not is_admin else request.args.get("planner_id")
    centro = request.args.get("centro")
    sector = request.args.get("sector")
    data = _load_solicitudes({"planner_id": planner_id, "centro": centro, "sector": sector})
    return jsonify(data), 200


@dashboard_bp.route("/presupuesto", methods=["GET"])
def obtener_presupuesto():
    """Retorna presupuesto y saldo por centro/sector para validaciones rapidas"""
    centro = request.args.get("centro")
    sector = request.args.get("sector")
    if not centro or not sector:
        return jsonify({"error": "centro y sector son requeridos"}), 400

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT centro, sector, monto_usd, saldo_usd FROM presupuestos WHERE centro=? AND sector=?",
            (centro, sector),
        )
        row = cur.fetchone()

    if not row:
        return jsonify({"centro": centro, "sector": sector, "monto_usd": 0, "saldo_usd": 0}), 200
    d = dict(row)
    return jsonify(d), 200
