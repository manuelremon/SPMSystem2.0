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

            if _table_exists(conn, "solicitud"):
                cur.execute("SELECT status, COUNT(*) as cnt FROM solicitud GROUP BY status")
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
                cur.execute("SELECT SUM(saldo_usd) as total FROM presupuesto")
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
            FROM solicitud s
            LEFT JOIN usuario u ON s.id_usuario = u.id_spm
            LEFT JOIN usuario ua ON s.aprobador_id = ua.id_spm
            LEFT JOIN usuario up ON s.planner_id = up.id_spm
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
            "SELECT centro, sector, monto_usd, saldo_usd FROM presupuesto WHERE centro=? AND sector=?",
            (centro, sector),
        )
        row = cur.fetchone()

    if not row:
        return jsonify({"centro": centro, "sector": sector, "monto_usd": 0, "saldo_usd": 0}), 200
    d = dict(row)
    return jsonify(d), 200


@dashboard_bp.route("/simular", methods=["POST"])
@require_auth
def simular_compra():
    """Feature 4.2: Simula el impacto de una compra propuesta.

    Body JSON:
        material_codigo: str
        centro: str
        cantidad: int
        precio_unitario: float (optional)

    Returns:
        Simulacion con impacto en cobertura, presupuesto y stock
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON requerido"}), 400

    material_codigo = data.get("material_codigo")
    centro = data.get("centro")
    cantidad = data.get("cantidad", 0)
    precio_unitario = data.get("precio_unitario", 0)

    if not material_codigo or not centro or cantidad <= 0:
        return jsonify({"error": "material_codigo, centro y cantidad > 0 requeridos"}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            cur.execute(
                """
                SELECT codigo_material, descripcion, stock_actual, stock_seguridad,
                       punto_pedido, consumo_promedio_mensual, lead_time_dias
                FROM materiales_mrp
                WHERE codigo_material = ? AND centro = ?
                """,
                (material_codigo, centro),
            )
            mat = cur.fetchone()

            if not mat:
                return jsonify({"error": "Material no encontrado en MRP"}), 404

            mat_dict = (
                dict(mat)
                if hasattr(mat, "keys")
                else {
                    "stock_actual": mat[2],
                    "stock_seguridad": mat[3],
                    "punto_pedido": mat[4],
                    "consumo_promedio_mensual": mat[5],
                    "lead_time_dias": mat[6],
                    "descripcion": mat[1],
                }
            )

            stock_actual = mat_dict.get("stock_actual") or 0
            consumo_mensual = mat_dict.get("consumo_promedio_mensual") or 0
            consumo_diario = consumo_mensual / 30 if consumo_mensual > 0 else 0
            ss = mat_dict.get("stock_seguridad") or 0
            pp = mat_dict.get("punto_pedido") or 0

            cobertura_actual = round(stock_actual / consumo_diario, 1) if consumo_diario > 0 else 0

            stock_simulado = stock_actual + cantidad
            cobertura_simulada = round(stock_simulado / consumo_diario, 1) if consumo_diario > 0 else 0

            costo_total = round(cantidad * precio_unitario, 2) if precio_unitario > 0 else 0

            estado_actual = (
                "quiebre"
                if stock_actual <= 0
                else (
                    "critico"
                    if stock_actual < ss
                    else ("bajo_punto_pedido" if stock_actual < pp else "normal")
                )
            )
            estado_simulado = (
                "quiebre"
                if stock_simulado <= 0
                else (
                    "critico"
                    if stock_simulado < ss
                    else ("bajo_punto_pedido" if stock_simulado < pp else "normal")
                )
            )

            presupuesto_impacto = None
            if precio_unitario > 0:
                cur.execute(
                    "SELECT saldo_cents, monto_cents FROM presupuesto WHERE centro = ? LIMIT 1",
                    (centro,),
                )
                budget_row = cur.fetchone()
                if budget_row:
                    budget_dict = (
                        dict(budget_row)
                        if hasattr(budget_row, "keys")
                        else {"saldo_cents": budget_row[0], "monto_cents": budget_row[1]}
                    )
                    saldo = budget_dict.get("saldo_cents", 0) or 0
                    presupuesto_impacto = {
                        "saldo_actual_usd": round(saldo / 100, 2),
                        "costo_compra_usd": costo_total,
                        "saldo_post_compra_usd": round((saldo / 100) - costo_total, 2),
                        "pct_presupuesto": round(costo_total / (saldo / 100) * 100, 1) if saldo > 0 else 0,
                    }

        return jsonify(
            {
                "material": material_codigo,
                "descripcion": mat_dict.get("descripcion", ""),
                "cantidad_propuesta": cantidad,
                "precio_unitario": precio_unitario,
                "simulacion": {
                    "stock_actual": stock_actual,
                    "stock_simulado": stock_simulado,
                    "cobertura_actual_dias": cobertura_actual,
                    "cobertura_simulada_dias": cobertura_simulada,
                    "ganancia_cobertura_dias": round(cobertura_simulada - cobertura_actual, 1),
                    "estado_actual": estado_actual,
                    "estado_simulado": estado_simulado,
                    "stock_seguridad": ss,
                    "punto_pedido": pp,
                    "consumo_diario": round(consumo_diario, 2),
                },
                "presupuesto": presupuesto_impacto,
                "costo_total": costo_total,
            }
        )

    except Exception as exc:
        logger.error(f"Error en simulacion: {exc}")
        return jsonify({"error": "Error al simular compra"}), 500
