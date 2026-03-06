"""
Advanced KPI service - Tiers 1, 2 & 3 metrics for the dashboard.

Tier 1: Stock Aging, Supplier OTD, Production Efficiency, Inventory Accuracy, Procurement Cycle
Tier 2: Supplier Scorecard, Quality Scorecard, Fleet Utilization, Forecast Accuracy
Tier 3: Supply Chain Risk, Cost Avoidance, Kanban Health
"""

import logging
from datetime import datetime, timedelta

from backend.core.db import get_db_connection

logger = logging.getLogger(__name__)


def _safe_float(val, default=0.0):
    try:
        return float(val) if val is not None else default
    except (TypeError, ValueError):
        return default


def _safe_int(val, default=0):
    try:
        return int(val) if val is not None else default
    except (TypeError, ValueError):
        return default


def _row_val(row, key_or_idx):
    if isinstance(row, dict):
        return row.get(key_or_idx)
    if isinstance(key_or_idx, int):
        return row[key_or_idx] if row and len(row) > key_or_idx else None
    return None


def get_stock_aging():
    """Tier 1: Stock aging - materials with 0 consumption in 3/6/12 months."""
    try:
        with get_db_connection("sap_data") as conn:
            cursor = conn.cursor()

            now = datetime.now()
            thresholds = {
                "3m": (now - timedelta(days=90)).strftime("%Y-%m-%d"),
                "6m": (now - timedelta(days=180)).strftime("%Y-%m-%d"),
                "12m": (now - timedelta(days=365)).strftime("%Y-%m-%d"),
            }

            result = {}
            for period, date_limit in thresholds.items():
                cursor.execute(
                    """
                    SELECT COUNT(DISTINCT s.material) as materiales,
                           COALESCE(SUM(s.stock_valorizado), 0) as valor
                    FROM stock s
                    WHERE s.stock > 0
                    AND NOT EXISTS (
                        SELECT 1 FROM consumo_historico ch
                        WHERE ch.material = s.material
                        AND ch.fecha >= %s
                    )
                    """,
                    (date_limit,),
                )
                row = cursor.fetchone()
                result[period] = {
                    "materiales": _safe_int(_row_val(row, "materiales") or _row_val(row, 0)),
                    "valor": _safe_float(_row_val(row, "valor") or _row_val(row, 1)),
                }

            # Total stock for percentage calculation
            cursor.execute(
                "SELECT COUNT(DISTINCT material) as total, COALESCE(SUM(stock_valorizado), 0) as valor FROM stock WHERE stock > 0"
            )
            row = cursor.fetchone()
            total_materiales = _safe_int(_row_val(row, "total") or _row_val(row, 0)) or 1
            total_valor = _safe_float(_row_val(row, "valor") or _row_val(row, 1))

            # Top 10 aged items (no consumption in 6+ months)
            cursor.execute(
                """
                SELECT s.material as codigo, s.material_descripcion as descripcion,
                       s.centro, SUM(s.stock) as stock_total,
                       SUM(s.stock_valorizado) as valor_total
                FROM stock s
                WHERE s.stock > 0
                AND NOT EXISTS (
                    SELECT 1 FROM consumo_historico ch
                    WHERE ch.material = s.material AND ch.fecha >= %s
                )
                GROUP BY s.material, s.material_descripcion, s.centro
                ORDER BY valor_total DESC
                LIMIT 10
                """,
                (thresholds["6m"],),
            )
            top_items = []
            for row in cursor.fetchall():
                d = dict(row) if hasattr(row, "keys") else {}
                top_items.append({
                    "codigo": d.get("codigo", row[0] if not d else ""),
                    "descripcion": (d.get("descripcion") or (row[1] if not d else ""))[:40],
                    "centro": d.get("centro", row[2] if not d else ""),
                    "stock": _safe_float(d.get("stock_total") or (row[3] if not d else 0)),
                    "valor": _safe_float(d.get("valor_total") or (row[4] if not d else 0)),
                })

            return {
                "ok": True,
                "periodos": result,
                "totalMateriales": total_materiales,
                "totalValor": total_valor,
                "pctSinConsumo6m": round((result["6m"]["materiales"] / total_materiales) * 100, 1) if total_materiales else 0,
                "topItems": top_items,
            }
    except Exception as e:
        logger.error("Error in get_stock_aging: %s", e)
        return {"ok": False, "periodos": {}, "totalMateriales": 0, "totalValor": 0, "pctSinConsumo6m": 0, "topItems": []}


def get_supplier_otd():
    """Tier 1: Supplier On-Time Delivery % from ASN data + order data."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # From ASN: compare estimated shipping vs actual state
            cursor.execute(
                """
                SELECT
                    a.proveedor_cuit,
                    pe.nombre as proveedor_nombre,
                    COUNT(*) as total_envios,
                    SUM(CASE WHEN a.estado = 'recibido' THEN 1 ELSE 0 END) as recibidos,
                    SUM(CASE WHEN a.estado = 'recibido'
                        AND a.created_at <= a.fecha_envio_estimada + INTERVAL '2 days'
                        THEN 1 ELSE 0 END) as a_tiempo
                FROM asn a
                LEFT JOIN proveedores_externos pe ON pe.cuit = a.proveedor_cuit
                GROUP BY a.proveedor_cuit, pe.nombre
                ORDER BY total_envios DESC
                """
            )
            asn_rows = cursor.fetchall()

            # From decision_abastecimiento_fuentes: lead time compliance
            cursor.execute(
                """
                SELECT
                    f.cuit_proveedor,
                    f.proveedor_nombre,
                    COUNT(*) as total_decisiones,
                    AVG(f.plazo_dias) as plazo_promedio,
                    SUM(CASE WHEN f.estado_consulta = 'confirmado' THEN 1 ELSE 0 END) as confirmadas
                FROM decision_abastecimiento_fuentes f
                WHERE f.tipo_fuente = 'proveedor'
                AND f.cuit_proveedor IS NOT NULL
                GROUP BY f.cuit_proveedor, f.proveedor_nombre
                ORDER BY total_decisiones DESC
                LIMIT 15
                """
            )
            decision_rows = cursor.fetchall()

            proveedores = {}
            for row in decision_rows:
                d = dict(row) if hasattr(row, "keys") else {}
                cuit = d.get("cuit_proveedor", "")
                proveedores[cuit] = {
                    "cuit": cuit,
                    "nombre": d.get("proveedor_nombre", "") or cuit,
                    "totalDecisiones": _safe_int(d.get("total_decisiones")),
                    "plazoPromedio": round(_safe_float(d.get("plazo_promedio")), 1),
                    "confirmadas": _safe_int(d.get("confirmadas")),
                    "totalEnvios": 0,
                    "aTiempo": 0,
                }

            for row in asn_rows:
                d = dict(row) if hasattr(row, "keys") else {}
                cuit = d.get("proveedor_cuit", "")
                if cuit in proveedores:
                    proveedores[cuit]["totalEnvios"] = _safe_int(d.get("total_envios"))
                    proveedores[cuit]["aTiempo"] = _safe_int(d.get("a_tiempo"))
                else:
                    proveedores[cuit] = {
                        "cuit": cuit,
                        "nombre": d.get("proveedor_nombre", "") or cuit,
                        "totalDecisiones": 0,
                        "plazoPromedio": 0,
                        "confirmadas": 0,
                        "totalEnvios": _safe_int(d.get("total_envios")),
                        "aTiempo": _safe_int(d.get("a_tiempo")),
                    }

            items = sorted(proveedores.values(), key=lambda x: x["totalDecisiones"] + x["totalEnvios"], reverse=True)[:10]

            total_decisiones = sum(p["totalDecisiones"] for p in items)
            total_confirmadas = sum(p["confirmadas"] for p in items)
            otd_global = round((total_confirmadas / total_decisiones) * 100, 1) if total_decisiones > 0 else 0

            return {
                "ok": True,
                "otdGlobal": otd_global,
                "totalProveedores": len(items),
                "totalDecisiones": total_decisiones,
                "proveedores": items,
            }
    except Exception as e:
        logger.error("Error in get_supplier_otd: %s", e)
        return {"ok": False, "otdGlobal": 0, "totalProveedores": 0, "totalDecisiones": 0, "proveedores": []}


def get_production_efficiency():
    """Tier 1: Production efficiency - planned vs actual from plan_produccion_item."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT
                    ppi.estado,
                    COUNT(*) as total,
                    SUM(ppi.cantidad_planificada) as planificada,
                    SUM(COALESCE(ppi.cantidad_producida, 0)) as producida
                FROM plan_produccion_item ppi
                JOIN plan_produccion pp ON ppi.plan_id = pp.id
                GROUP BY ppi.estado
                """
            )
            rows = cursor.fetchall()
            by_status = {}
            total_plan = 0
            total_prod = 0
            total_items = 0
            for row in rows:
                d = dict(row) if hasattr(row, "keys") else {}
                estado = d.get("estado", "")
                cnt = _safe_int(d.get("total"))
                plan = _safe_float(d.get("planificada"))
                prod = _safe_float(d.get("producida"))
                by_status[estado] = {"count": cnt, "planificada": plan, "producida": prod}
                total_plan += plan
                total_prod += prod
                total_items += cnt

            eficiencia = round((total_prod / total_plan) * 100, 1) if total_plan > 0 else 0

            # Capacity utilization from produccion_capacidad
            cursor.execute(
                """
                SELECT
                    AVG(CASE WHEN capacidad_disponible > 0
                        THEN (capacidad_utilizada / capacidad_disponible) * 100
                        ELSE 0 END) as utilizacion_pct,
                    COUNT(*) as registros
                FROM produccion_capacidad
                WHERE capacidad_disponible > 0
                """
            )
            row = cursor.fetchone()
            utilizacion = round(_safe_float(_row_val(row, "utilizacion_pct") or _row_val(row, 0)), 1)

            # Work centers
            cursor.execute(
                """
                SELECT nombre, eficiencia_pct, estado, capacidad_diaria, costo_hora
                FROM work_center
                ORDER BY eficiencia_pct DESC
                """
            )
            work_centers = []
            for row in cursor.fetchall():
                d = dict(row) if hasattr(row, "keys") else {}
                work_centers.append({
                    "nombre": d.get("nombre", ""),
                    "eficiencia": _safe_float(d.get("eficiencia_pct")),
                    "estado": d.get("estado", ""),
                    "capacidadDiaria": _safe_float(d.get("capacidad_diaria")),
                    "costoHora": _safe_float(d.get("costo_hora")),
                })

            return {
                "ok": True,
                "eficiencia": eficiencia,
                "utilizacionCapacidad": utilizacion,
                "totalItems": total_items,
                "totalPlanificada": total_plan,
                "totalProducida": total_prod,
                "porEstado": by_status,
                "workCenters": work_centers,
            }
    except Exception as e:
        logger.error("Error in get_production_efficiency: %s", e)
        return {"ok": False, "eficiencia": 0, "utilizacionCapacidad": 0, "totalItems": 0,
                "totalPlanificada": 0, "totalProducida": 0, "porEstado": {}, "workCenters": []}


def get_inventory_accuracy():
    """Tier 1: Inventory accuracy from cycle count results."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT
                    COUNT(*) as total_items,
                    SUM(CASE WHEN ABS(COALESCE(varianza_pct, 0)) <= 2 THEN 1 ELSE 0 END) as dentro_tolerancia,
                    AVG(ABS(COALESCE(varianza_pct, 0))) as varianza_promedio,
                    SUM(CASE WHEN varianza > 0 THEN 1 ELSE 0 END) as sobrantes,
                    SUM(CASE WHEN varianza < 0 THEN 1 ELSE 0 END) as faltantes,
                    SUM(CASE WHEN varianza = 0 THEN 1 ELSE 0 END) as exactos
                FROM cycle_count_item
                WHERE estado IN ('counted', 'verified', 'adjusted')
                """
            )
            row = cursor.fetchone()
            total = _safe_int(_row_val(row, "total_items") or _row_val(row, 0))
            dentro = _safe_int(_row_val(row, "dentro_tolerancia") or _row_val(row, 1))
            varianza = round(_safe_float(_row_val(row, "varianza_promedio") or _row_val(row, 2)), 2)
            sobrantes = _safe_int(_row_val(row, "sobrantes") or _row_val(row, 3))
            faltantes = _safe_int(_row_val(row, "faltantes") or _row_val(row, 4))
            exactos = _safe_int(_row_val(row, "exactos") or _row_val(row, 5))

            precision = round((dentro / total) * 100, 1) if total > 0 else 0

            # Cycle count summary
            cursor.execute(
                """
                SELECT estado, COUNT(*) as total
                FROM cycle_count
                GROUP BY estado
                """
            )
            conteos = {}
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                conteos[d.get("estado", "")] = _safe_int(d.get("total"))

            return {
                "ok": True,
                "precision": precision,
                "varianzaPromedio": varianza,
                "totalItems": total,
                "dentroTolerancia": dentro,
                "sobrantes": sobrantes,
                "faltantes": faltantes,
                "exactos": exactos,
                "conteos": conteos,
            }
    except Exception as e:
        logger.error("Error in get_inventory_accuracy: %s", e)
        return {"ok": False, "precision": 0, "varianzaPromedio": 0, "totalItems": 0,
                "dentroTolerancia": 0, "sobrantes": 0, "faltantes": 0, "exactos": 0, "conteos": {}}


def get_procurement_cycle():
    """Tier 1: Procurement cycle time - requisition to PO to receipt."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Average time from solicitud creation to decision
            cursor.execute(
                """
                SELECT
                    AVG(EXTRACT(EPOCH FROM (d.created_at - s.created_at)) / 86400) as dias_solicitud_decision,
                    COUNT(*) as total
                FROM decision_abastecimiento d
                JOIN solicitud s ON d.solicitud_id = s.id
                WHERE d.created_at IS NOT NULL AND s.created_at IS NOT NULL
                """
            )
            row = cursor.fetchone()
            dias_sol_dec = round(_safe_float(_row_val(row, "dias_solicitud_decision") or _row_val(row, 0)), 1)
            total_decisiones = _safe_int(_row_val(row, "total") or _row_val(row, 1))

            # Average time from OC creation to completion
            cursor.execute(
                """
                SELECT
                    AVG(EXTRACT(EPOCH FROM (oc.updated_at - oc.created_at)) / 86400) as dias_oc,
                    COUNT(*) as total
                FROM orden_compra oc
                WHERE oc.estado IN ('completada', 'recibida', 'cerrada')
                AND oc.updated_at IS NOT NULL
                """
            )
            row = cursor.fetchone()
            dias_oc = round(_safe_float(_row_val(row, "dias_oc") or _row_val(row, 0)), 1)

            # Overall lead time from solicitud to close
            cursor.execute(
                """
                SELECT
                    AVG(EXTRACT(EPOCH FROM (s.updated_at - s.created_at)) / 86400) as dias_total,
                    COUNT(*) as total
                FROM solicitud s
                WHERE s.status IN ('closed', 'dispatched')
                AND s.updated_at IS NOT NULL
                """
            )
            row = cursor.fetchone()
            dias_total = round(_safe_float(_row_val(row, "dias_total") or _row_val(row, 0)), 1)

            # Monthly trend (last 6 months)
            cursor.execute(
                """
                SELECT
                    TO_CHAR(s.created_at, 'YYYY-MM') as mes,
                    AVG(EXTRACT(EPOCH FROM (s.updated_at - s.created_at)) / 86400) as dias
                FROM solicitud s
                WHERE s.status IN ('closed', 'dispatched')
                AND s.created_at >= NOW() - INTERVAL '6 months'
                GROUP BY TO_CHAR(s.created_at, 'YYYY-MM')
                ORDER BY mes
                """
            )
            trend = []
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                trend.append({
                    "mes": d.get("mes", ""),
                    "dias": round(_safe_float(d.get("dias")), 1),
                })

            return {
                "ok": True,
                "diasSolicitudDecision": dias_sol_dec,
                "diasOrdenCompra": dias_oc,
                "diasTotal": dias_total,
                "totalDecisiones": total_decisiones,
                "trend": trend,
            }
    except Exception as e:
        logger.error("Error in get_procurement_cycle: %s", e)
        return {"ok": False, "diasSolicitudDecision": 0, "diasOrdenCompra": 0, "diasTotal": 0,
                "totalDecisiones": 0, "trend": []}


def get_supplier_scorecard():
    """Tier 2: Supplier scorecard - spend + OTD + quality + lead time."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Spend by supplier from decision_abastecimiento_fuentes
            cursor.execute(
                """
                SELECT
                    f.cuit_proveedor as cuit,
                    f.proveedor_nombre as nombre,
                    COUNT(*) as total_items,
                    SUM(f.cantidad_asignada * COALESCE(f.precio_unitario, 0)) as gasto_total,
                    AVG(f.plazo_dias) as lead_time_promedio,
                    AVG(f.score_opcion) as score_promedio
                FROM decision_abastecimiento_fuentes f
                WHERE f.tipo_fuente = 'proveedor'
                AND f.cuit_proveedor IS NOT NULL
                GROUP BY f.cuit_proveedor, f.proveedor_nombre
                ORDER BY gasto_total DESC
                LIMIT 10
                """
            )
            proveedores = []
            for row in cursor.fetchall():
                d = dict(row) if hasattr(row, "keys") else {}
                cuit = d.get("cuit", "")

                # Quality check for this supplier
                cursor.execute(
                    """
                    SELECT
                        COUNT(*) as total_checks,
                        SUM(CASE WHEN es_compliant = 1 THEN 1 ELSE 0 END) as compliant
                    FROM compliance_check cc
                    JOIN orden_compra oc ON cc.orden_compra_id = oc.id
                    WHERE oc.proveedor_cuit = %s
                    """,
                    (cuit,),
                )
                qrow = cursor.fetchone()
                q_total = _safe_int(_row_val(qrow, "total_checks") or _row_val(qrow, 0))
                q_compliant = _safe_int(_row_val(qrow, "compliant") or _row_val(qrow, 1))
                quality_pct = round((q_compliant / q_total) * 100, 1) if q_total > 0 else None

                # Risk score
                cursor.execute(
                    "SELECT score_riesgo, nivel FROM proveedor_riesgo WHERE proveedor_cuit = %s ORDER BY created_at DESC LIMIT 1",
                    (cuit,),
                )
                rrow = cursor.fetchone()
                risk_score = _safe_float(_row_val(rrow, "score_riesgo") or _row_val(rrow, 0)) if rrow else None
                risk_level = (_row_val(rrow, "nivel") or _row_val(rrow, 1)) if rrow else None

                proveedores.append({
                    "cuit": cuit,
                    "nombre": d.get("nombre", "") or cuit,
                    "totalItems": _safe_int(d.get("total_items")),
                    "gastoTotal": round(_safe_float(d.get("gasto_total")), 2),
                    "leadTimePromedio": round(_safe_float(d.get("lead_time_promedio")), 1),
                    "scorePromedio": round(_safe_float(d.get("score_promedio")), 1),
                    "qualityPct": quality_pct,
                    "riskScore": risk_score,
                    "riskLevel": risk_level,
                })

            return {"ok": True, "proveedores": proveedores}
    except Exception as e:
        logger.error("Error in get_supplier_scorecard: %s", e)
        return {"ok": False, "proveedores": []}


def get_quality_scorecard():
    """Tier 2: Quality scorecard - defect rate, audit findings, warranty claims."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Compliance check pass rate
            cursor.execute(
                """
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN es_compliant = 1 THEN 1 ELSE 0 END) as passed,
                    AVG(ABS(COALESCE(desviacion_porcentaje, 0))) as desviacion_avg
                FROM compliance_check
                """
            )
            row = cursor.fetchone()
            cc_total = _safe_int(_row_val(row, "total") or _row_val(row, 0))
            cc_passed = _safe_int(_row_val(row, "passed") or _row_val(row, 1))
            cc_desviacion = round(_safe_float(_row_val(row, "desviacion_avg") or _row_val(row, 2)), 2)
            pass_rate = round((cc_passed / cc_total) * 100, 1) if cc_total > 0 else 0

            # Warranty claims
            cursor.execute(
                """
                SELECT
                    estado,
                    COUNT(*) as total
                FROM reclamo_garantia
                GROUP BY estado
                """
            )
            garantias = {}
            total_reclamos = 0
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                estado = d.get("estado", "")
                cnt = _safe_int(d.get("total"))
                garantias[estado] = cnt
                total_reclamos += cnt

            # Audit findings
            cursor.execute(
                """
                SELECT
                    tipo, estado, COUNT(*) as total
                FROM auditoria_hallazgo
                GROUP BY tipo, estado
                """
            )
            hallazgos = {}
            total_hallazgos = 0
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                tipo = d.get("tipo", "otro")
                cnt = _safe_int(d.get("total"))
                hallazgos[tipo] = hallazgos.get(tipo, 0) + cnt
                total_hallazgos += cnt

            return {
                "ok": True,
                "passRate": pass_rate,
                "totalChecks": cc_total,
                "desviacionPromedio": cc_desviacion,
                "garantias": garantias,
                "totalReclamos": total_reclamos,
                "hallazgos": hallazgos,
                "totalHallazgos": total_hallazgos,
            }
    except Exception as e:
        logger.error("Error in get_quality_scorecard: %s", e)
        return {"ok": False, "passRate": 0, "totalChecks": 0, "desviacionPromedio": 0,
                "garantias": {}, "totalReclamos": 0, "hallazgos": {}, "totalHallazgos": 0}


def get_fleet_utilization():
    """Tier 2: Fleet utilization - availability, maintenance costs, efficiency."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Vehicle status summary
            cursor.execute(
                """
                SELECT
                    estado,
                    COUNT(*) as total,
                    SUM(CASE WHEN activo = true THEN 1 ELSE 0 END) as activos
                FROM fms_vehicles
                GROUP BY estado
                """
            )
            estados = {}
            total_vehicles = 0
            total_activos = 0
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                est = d.get("estado", "")
                cnt = _safe_int(d.get("total"))
                act = _safe_int(d.get("activos"))
                estados[est] = cnt
                total_vehicles += cnt
                total_activos += act

            disponibles = estados.get("disponible", 0)
            disponibilidad_pct = round((disponibles / total_vehicles) * 100, 1) if total_vehicles > 0 else 0

            # Detect cost column (costo_real in dev, costo_total in prod)
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='fms_work_orders' AND column_name IN ('costo_real','costo_total') "
                "ORDER BY column_name DESC LIMIT 1"
            )
            cost_col_row = cursor.fetchone()
            cost_col = (_row_val(cost_col_row, "column_name") or _row_val(cost_col_row, 0)) if cost_col_row else "costo_real"

            # Work order summary
            cursor.execute(
                f"""
                SELECT
                    estado,
                    COUNT(*) as total,
                    AVG({cost_col}) as costo_promedio,
                    SUM({cost_col}) as costo_total
                FROM fms_work_orders
                GROUP BY estado
                """
            )
            wo_by_status = {}
            total_wo = 0
            costo_total_wo = 0
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                est = d.get("estado", "")
                cnt = _safe_int(d.get("total"))
                costo = _safe_float(d.get("costo_total"))
                wo_by_status[est] = {
                    "count": cnt,
                    "costoPromedio": round(_safe_float(d.get("costo_promedio")), 2),
                    "costoTotal": round(costo, 2),
                }
                total_wo += cnt
                costo_total_wo += costo

            # Upcoming maintenance
            cursor.execute(
                """
                SELECT COUNT(*) as total
                FROM fms_vehicles
                WHERE proximo_mantenimiento IS NOT NULL
                AND proximo_mantenimiento <= CURRENT_DATE + INTERVAL '30 days'
                AND activo = true
                """
            )
            row = cursor.fetchone()
            mant_proximo = _safe_int(_row_val(row, "total") or _row_val(row, 0))

            return {
                "ok": True,
                "totalVehiculos": total_vehicles,
                "disponibles": disponibles,
                "disponibilidadPct": disponibilidad_pct,
                "vehiculosPorEstado": estados,
                "totalOrdenesTrabajo": total_wo,
                "costoTotalOT": round(costo_total_wo, 2),
                "otPorEstado": wo_by_status,
                "mantenimientoProximo30d": mant_proximo,
            }
    except Exception as e:
        logger.error("Error in get_fleet_utilization: %s", e)
        return {"ok": False, "totalVehiculos": 0, "disponibles": 0, "disponibilidadPct": 0,
                "vehiculosPorEstado": {}, "totalOrdenesTrabajo": 0, "costoTotalOT": 0,
                "otPorEstado": {}, "mantenimientoProximo30d": 0}


def get_forecast_accuracy():
    """Tier 2: Forecast accuracy - predicted vs actual demand."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Plan demanda details with confidence
            cursor.execute(
                """
                SELECT
                    pd.nombre as plan_nombre,
                    pd.estado as plan_estado,
                    pdd.material_codigo,
                    pdd.fuente,
                    pdd.cantidad_pronosticada,
                    pdd.confianza
                FROM plan_demanda_detalle pdd
                JOIN plan_demanda pd ON pdd.plan_id = pd.id
                ORDER BY pd.created_at DESC
                LIMIT 100
                """
            )
            detalles = []
            total_pronosticado = 0
            confianza_sum = 0
            count = 0
            by_fuente = {}
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                cant = _safe_float(d.get("cantidad_pronosticada"))
                conf = _safe_float(d.get("confianza"))
                fuente = d.get("fuente", "manual")
                total_pronosticado += cant
                confianza_sum += conf
                count += 1
                by_fuente[fuente] = by_fuente.get(fuente, 0) + 1

            confianza_promedio = round(confianza_sum / count, 1) if count > 0 else 0

            # Compare forecast with actual consumption (last 6 months)
            cursor.execute(
                """
                SELECT
                    pdd.material_codigo,
                    SUM(pdd.cantidad_pronosticada) as pronosticado,
                    COALESCE((
                        SELECT SUM(ch.cantidad)
                        FROM consumo_historico ch
                        WHERE ch.material = pdd.material_codigo
                        AND ch.fecha >= NOW() - INTERVAL '6 months'
                    ), 0) as consumido
                FROM plan_demanda_detalle pdd
                JOIN plan_demanda pd ON pdd.plan_id = pd.id
                WHERE pd.created_at >= NOW() - INTERVAL '6 months'
                GROUP BY pdd.material_codigo
                HAVING SUM(pdd.cantidad_pronosticada) > 0
                LIMIT 20
                """
            )
            accuracy_items = []
            mape_sum = 0
            mape_count = 0
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                pron = _safe_float(d.get("pronosticado"))
                cons = _safe_float(d.get("consumido"))
                if pron > 0:
                    error_pct = abs(pron - cons) / pron * 100
                    mape_sum += error_pct
                    mape_count += 1
                    accuracy_items.append({
                        "material": d.get("material_codigo", ""),
                        "pronosticado": round(pron, 1),
                        "consumido": round(cons, 1),
                        "errorPct": round(error_pct, 1),
                    })

            mape = round(mape_sum / mape_count, 1) if mape_count > 0 else 0
            accuracy = round(100 - mape, 1) if mape <= 100 else 0

            # Plan demanda status counts
            cursor.execute(
                "SELECT estado, COUNT(*) as total FROM plan_demanda GROUP BY estado"
            )
            plan_status = {}
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                plan_status[d.get("estado", "")] = _safe_int(d.get("total"))

            return {
                "ok": True,
                "accuracy": accuracy,
                "mape": mape,
                "confianzaPromedio": confianza_promedio,
                "totalPronosticos": count,
                "porFuente": by_fuente,
                "planStatus": plan_status,
                "topItems": sorted(accuracy_items, key=lambda x: x["errorPct"], reverse=True)[:10],
            }
    except Exception as e:
        logger.error("Error in get_forecast_accuracy: %s", e)
        return {"ok": False, "accuracy": 0, "mape": 0, "confianzaPromedio": 0,
                "totalPronosticos": 0, "porFuente": {}, "planStatus": {}, "topItems": []}


def get_supply_chain_risk():
    """Tier 3: Supply chain risk - single source, geographic concentration, risk scores."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Supplier risk summary
            cursor.execute(
                """
                SELECT
                    pr.nivel,
                    COUNT(*) as total,
                    AVG(pr.score_riesgo) as score_promedio,
                    SUM(CASE WHEN pr.es_fuente_unica = 1 THEN 1 ELSE 0 END) as fuente_unica
                FROM proveedor_riesgo pr
                GROUP BY pr.nivel
                ORDER BY score_promedio DESC
                """
            )
            by_level = {}
            total_proveedores = 0
            total_fuente_unica = 0
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                nivel = d.get("nivel", "unknown")
                cnt = _safe_int(d.get("total"))
                fu = _safe_int(d.get("fuente_unica"))
                by_level[nivel] = {
                    "count": cnt,
                    "scorePromedio": round(_safe_float(d.get("score_promedio")), 1),
                }
                total_proveedores += cnt
                total_fuente_unica += fu

            # Geographic concentration
            cursor.execute(
                """
                SELECT
                    COALESCE(pr.provincia, pr.pais, 'No especificado') as region,
                    COUNT(*) as total,
                    AVG(pr.score_riesgo) as score_promedio
                FROM proveedor_riesgo pr
                GROUP BY COALESCE(pr.provincia, pr.pais, 'No especificado')
                ORDER BY total DESC
                LIMIT 10
                """
            )
            by_region = []
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                by_region.append({
                    "region": d.get("region", ""),
                    "total": _safe_int(d.get("total")),
                    "scorePromedio": round(_safe_float(d.get("score_promedio")), 1),
                })

            # Top risk suppliers
            cursor.execute(
                """
                SELECT
                    pr.proveedor_cuit,
                    pe.nombre,
                    pr.score_riesgo,
                    pr.nivel,
                    pr.es_fuente_unica,
                    pr.riesgo_financiero,
                    pr.riesgo_entrega,
                    pr.riesgo_calidad,
                    pr.riesgo_dependencia
                FROM proveedor_riesgo pr
                LEFT JOIN proveedores_externos pe ON pe.cuit = pr.proveedor_cuit
                ORDER BY pr.score_riesgo DESC
                LIMIT 10
                """
            )
            top_risk = []
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                top_risk.append({
                    "cuit": d.get("proveedor_cuit", ""),
                    "nombre": d.get("nombre", "") or d.get("proveedor_cuit", ""),
                    "score": round(_safe_float(d.get("score_riesgo")), 1),
                    "nivel": d.get("nivel", ""),
                    "fuenteUnica": bool(_safe_int(d.get("es_fuente_unica"))),
                    "riesgoFinanciero": round(_safe_float(d.get("riesgo_financiero")), 1),
                    "riesgoEntrega": round(_safe_float(d.get("riesgo_entrega")), 1),
                    "riesgoCalidad": round(_safe_float(d.get("riesgo_calidad")), 1),
                    "riesgoDependencia": round(_safe_float(d.get("riesgo_dependencia")), 1),
                })

            return {
                "ok": True,
                "totalProveedores": total_proveedores,
                "fuenteUnica": total_fuente_unica,
                "porNivel": by_level,
                "porRegion": by_region,
                "topRisk": top_risk,
            }
    except Exception as e:
        logger.error("Error in get_supply_chain_risk: %s", e)
        return {"ok": False, "totalProveedores": 0, "fuenteUnica": 0,
                "porNivel": {}, "porRegion": [], "topRisk": []}


def get_cost_avoidance():
    """Tier 3: Cost avoidance - negotiated savings, internal sourcing savings."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Price negotiations
            cursor.execute(
                """
                SELECT
                    COUNT(*) as total,
                    SUM(precio_anterior - precio_nuevo) as ahorro_total,
                    AVG(descuento_negociado_pct) as descuento_promedio,
                    SUM(CASE WHEN estado = 'aprobada' THEN 1 ELSE 0 END) as aprobadas
                FROM precio_negociacion
                WHERE precio_anterior > precio_nuevo
                """
            )
            row = cursor.fetchone()
            neg_total = _safe_int(_row_val(row, "total") or _row_val(row, 0))
            neg_ahorro = round(_safe_float(_row_val(row, "ahorro_total") or _row_val(row, 1)), 2)
            neg_descuento = round(_safe_float(_row_val(row, "descuento_promedio") or _row_val(row, 2)), 1)
            neg_aprobadas = _safe_int(_row_val(row, "aprobadas") or _row_val(row, 3))

            # Internal sourcing savings (stock + transferencia vs external)
            cursor.execute(
                """
                SELECT
                    f.tipo_fuente,
                    COUNT(*) as items,
                    SUM(f.cantidad_asignada * COALESCE(f.precio_unitario, 0)) as valor_total
                FROM decision_abastecimiento_fuentes f
                GROUP BY f.tipo_fuente
                ORDER BY valor_total DESC
                """
            )
            by_source = {}
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                by_source[d.get("tipo_fuente", "")] = {
                    "items": _safe_int(d.get("items")),
                    "valor": round(_safe_float(d.get("valor_total")), 2),
                }

            valor_interno = (by_source.get("stock", {}).get("valor", 0)
                             + by_source.get("transferencia", {}).get("valor", 0))
            valor_externo = by_source.get("proveedor", {}).get("valor", 0)
            total_valor = valor_interno + valor_externo
            pct_interno = round((valor_interno / total_valor) * 100, 1) if total_valor > 0 else 0

            return {
                "ok": True,
                "negociaciones": {
                    "total": neg_total,
                    "ahorroTotal": neg_ahorro,
                    "descuentoPromedio": neg_descuento,
                    "aprobadas": neg_aprobadas,
                },
                "abastecimiento": by_source,
                "valorInterno": round(valor_interno, 2),
                "valorExterno": round(valor_externo, 2),
                "pctInterno": pct_interno,
            }
    except Exception as e:
        logger.error("Error in get_cost_avoidance: %s", e)
        return {"ok": False, "negociaciones": {}, "abastecimiento": {}, "valorInterno": 0,
                "valorExterno": 0, "pctInterno": 0}


def get_kanban_health():
    """Tier 3: Kanban system health - pull signals, cycle time, efficiency."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Kanban boards summary
            cursor.execute(
                """
                SELECT estado, COUNT(*) as total
                FROM kanban_tablero
                GROUP BY estado
                """
            )
            tableros = {}
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                tableros[d.get("estado", "")] = _safe_int(d.get("total"))

            # Cards summary
            cursor.execute(
                """
                SELECT
                    estado,
                    COUNT(*) as total,
                    AVG(ciclos_totales) as ciclos_promedio,
                    AVG(lead_time_horas) as lead_time_promedio
                FROM kanban_tarjeta
                GROUP BY estado
                """
            )
            tarjetas = {}
            total_tarjetas = 0
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                est = d.get("estado", "")
                cnt = _safe_int(d.get("total"))
                tarjetas[est] = {
                    "count": cnt,
                    "ciclosPromedio": round(_safe_float(d.get("ciclos_promedio")), 1),
                    "leadTimePromedio": round(_safe_float(d.get("lead_time_promedio")), 1),
                }
                total_tarjetas += cnt

            # Signal efficiency
            cursor.execute(
                """
                SELECT
                    tipo,
                    estado,
                    COUNT(*) as total,
                    AVG(CASE WHEN fecha_completado IS NOT NULL AND fecha_generacion IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (fecha_completado - fecha_generacion)) / 3600
                        ELSE NULL END) as tiempo_respuesta_horas
                FROM kanban_senal
                GROUP BY tipo, estado
                """
            )
            senales = {}
            total_senales = 0
            completadas = 0
            tiempo_resp_sum = 0
            tiempo_resp_count = 0
            for r in cursor.fetchall():
                d = dict(r) if hasattr(r, "keys") else {}
                tipo = d.get("tipo", "")
                estado = d.get("estado", "")
                cnt = _safe_int(d.get("total"))
                key = f"{tipo}_{estado}"
                senales[key] = cnt
                total_senales += cnt
                if estado == "completada":
                    completadas += cnt
                tr = _safe_float(d.get("tiempo_respuesta_horas"))
                if tr > 0:
                    tiempo_resp_sum += tr * cnt
                    tiempo_resp_count += cnt

            eficiencia = round((completadas / total_senales) * 100, 1) if total_senales > 0 else 0
            tiempo_respuesta = round(tiempo_resp_sum / tiempo_resp_count, 1) if tiempo_resp_count > 0 else 0

            return {
                "ok": True,
                "tableros": tableros,
                "tarjetas": tarjetas,
                "totalTarjetas": total_tarjetas,
                "totalSenales": total_senales,
                "senalesCompletadas": completadas,
                "eficiencia": eficiencia,
                "tiempoRespuestaHoras": tiempo_respuesta,
            }
    except Exception as e:
        logger.error("Error in get_kanban_health: %s", e)
        return {"ok": False, "tableros": {}, "tarjetas": {}, "totalTarjetas": 0,
                "totalSenales": 0, "senalesCompletadas": 0, "eficiencia": 0, "tiempoRespuestaHoras": 0}


def get_all_advanced_kpis():
    """Get all advanced KPIs in a single call for the dashboard."""
    return {
        "stockAging": get_stock_aging(),
        "supplierOtd": get_supplier_otd(),
        "productionEfficiency": get_production_efficiency(),
        "inventoryAccuracy": get_inventory_accuracy(),
        "procurementCycle": get_procurement_cycle(),
        "supplierScorecard": get_supplier_scorecard(),
        "qualityScorecard": get_quality_scorecard(),
        "fleetUtilization": get_fleet_utilization(),
        "forecastAccuracy": get_forecast_accuracy(),
        "supplyChainRisk": get_supply_chain_risk(),
        "costAvoidance": get_cost_avoidance(),
        "kanbanHealth": get_kanban_health(),
    }
