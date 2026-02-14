"""
Rutas para KPIs y métricas del sistema
"""

import json
import logging
from collections import Counter, defaultdict

from flask import Blueprint, jsonify

from backend.core.cache import cached, kpi_cache
from backend.core.db import (
    get_db_connection,
    is_using_postgresql,
    sql_date_diff_days,
    sql_date_relative,
    sql_format_date,
)
from backend.core.helpers import row_to_dict as _row_to_dict
from backend.core.roles import require_auth

logger = logging.getLogger(__name__)


def _rows_to_dicts(rows, cursor=None):
    """Convierte múltiples filas a diccionarios"""
    return [row if isinstance(row, dict) else dict(row) for row in rows]


bp = Blueprint("kpis", __name__, url_prefix="/api/kpis")


@bp.route("/stock-inmovilizado", methods=["GET"])
@require_auth
def get_stock_inmovilizado():
    """
    Obtiene materiales inmovilizados con información de centro.

    Stock inmovilizado se identifica por la columna 'inmovilizado' = 'INMOVILIZADO'
    en la tabla stock de sap_data.db. Solo se incluyen filas con stock > 0.

    Lotes típicos de stock inmovilizado:
    - GAINSP-100: En inspección
    - GREZAG-100: Rezago/obsoleto
    - GREPAR-100: En reparación
    - GAREPA-100: A reparar
    - GSOBRA-100: Sobrantes

    Query params:
        - centros: lista de centros (códigos, ej: AA101,AA102)
        - centro: un solo centro (alternativa a centros)
        - almacen: filtrar por almacén específico
        - limit: límite de resultados (default 50)

    Returns:
        - items: lista de materiales inmovilizados con codigo, descripcion, lote y valor
        - total: cantidad total de materiales inmovilizados
        - valorTotal: valor total del stock inmovilizado
        - globalTotal: total global (sin filtros)
        - globalValorTotal: valor total global (sin filtros)
    """
    from flask import request

    try:
        # Obtener filtros de query params
        centros_param = request.args.get("centros", "")
        centros = [c.strip() for c in centros_param.split(",") if c.strip()]

        # Soporte para un solo centro (alternativa)
        centro_unico = request.args.get("centro", "").strip()
        if centro_unico and not centros:
            centros = [centro_unico]

        # Filtro de almacén
        almacen_param = request.args.get("almacen", "").strip()

        # Límite de resultados
        limit = int(request.args.get("limit", 50))
        limit = min(max(limit, 1), 100)  # Entre 1 y 100

        with get_db_connection("sap_data") as conn:
            cursor = conn.cursor()

            # Totales globales (sin filtros de centro)
            cursor.execute(
                """
                SELECT
                    COUNT(DISTINCT material) as total,
                    COALESCE(SUM(stock_valorizado), 0) as valor_total
                FROM stock
                WHERE inmovilizado = ? AND stock > 0
            """,
                ("INMOVILIZADO",),
            )
            global_row = cursor.fetchone()
            if isinstance(global_row, dict):
                global_total = global_row.get("total") or 0
                global_valor = float(global_row.get("valor_total") or 0)
            else:
                global_total = global_row[0] if global_row else 0
                global_valor = float(global_row[1]) if global_row and global_row[1] else 0

            # Construir query con filtros
            where_clauses = ["inmovilizado = ?", "stock > 0"]
            params = ["INMOVILIZADO"]

            if centros:
                placeholders = ",".join(["?" for _ in centros])
                where_clauses.append(f"centro IN ({placeholders})")
                params.extend(centros)

            if almacen_param:
                where_clauses.append("almacen = ?")
                params.append(almacen_param)

            where_sql = " AND ".join(where_clauses)

            # Query filtrada para items (agrupado por material)
            query = f"""
                SELECT
                    material as codigo,
                    material_descripcion as descripcion,
                    lote,
                    SUM(stock) as stock_total,
                    SUM(stock_valorizado) as valor_total
                FROM stock
                WHERE {where_sql}
                GROUP BY material, material_descripcion, lote
                ORDER BY valor_total DESC
                LIMIT {limit}
            """
            cursor.execute(query, params)
            rows = cursor.fetchall()

            items = []
            for row in rows:
                row_dict = dict(row) if hasattr(row, "keys") else {
                    "codigo": row[0],
                    "descripcion": row[1],
                    "lote": row[2],
                    "stock_total": row[3],
                    "valor_total": row[4],
                }
                desc = row_dict.get("descripcion") or row_dict.get("codigo") or ""
                desc_corta = desc[:40] + "..." if len(desc) > 40 else desc
                items.append({
                    "codigo": row_dict.get("codigo", ""),
                    "descripcion": desc_corta,
                    "lote": row_dict.get("lote", ""),
                    "stock": float(row_dict.get("stock_total") or 0),
                    "valor": float(row_dict.get("valor_total") or 0),
                })

            # Total filtrado
            count_query = f"""
                SELECT
                    COUNT(DISTINCT material) as total,
                    COALESCE(SUM(stock_valorizado), 0) as valor_total
                FROM stock
                WHERE {where_sql}
            """
            cursor.execute(count_query, params)
            totals_row = cursor.fetchone()
            if isinstance(totals_row, dict):
                total_count = totals_row.get("total") or 0
                valor_total = float(totals_row.get("valor_total") or 0)
            else:
                total_count = totals_row[0] if totals_row else 0
                valor_total = float(totals_row[1]) if totals_row and totals_row[1] else 0

            return jsonify({
                "ok": True,
                "items": items,
                "total": total_count,
                "valorTotal": valor_total,
                "globalTotal": global_total,
                "globalValorTotal": global_valor,
            })

    except Exception as e:
        logger.error(f"Error obteniendo stock inmovilizado: {e}")
        return jsonify({
            "ok": False,
            "error": "Error al obtener stock inmovilizado",
            "items": [],
            "total": 0,
            "valorTotal": 0,
            "globalTotal": 0,
            "globalValorTotal": 0,
        }), 500


@bp.route("/compras-evitadas-detalle", methods=["GET"])
@require_auth
def get_compras_evitadas_detalle():
    """
    Obtiene detalle de compras evitadas por solicitud para filtrado en frontend.

    Returns:
        - items: lista de decisiones con solicitud_id, centro, sector, fecha, valor
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT
                    d.solicitud_id,
                    s.centro,
                    s.sector,
                    s.created_at,
                    f.tipo_fuente,
                    f.cantidad_asignada,
                    f.precio_unitario,
                    (f.cantidad_asignada * COALESCE(f.precio_unitario, 0)) as valor
                FROM decision_abastecimiento_fuentes f
                JOIN decision_abastecimiento d ON f.decision_id = d.id
                JOIN solicitud s ON d.solicitud_id = s.id
                WHERE f.tipo_fuente IN ('stock', 'transferencia')
                ORDER BY s.created_at DESC
            """
            )
            rows = cursor.fetchall()

            items = []
            for row in rows:
                if isinstance(row, dict):
                    items.append({
                        "solicitud_id": row.get("solicitud_id"),
                        "centro": row.get("centro"),
                        "sector": row.get("sector"),
                        "fecha": row.get("created_at"),
                        "tipo_fuente": row.get("tipo_fuente"),
                        "cantidad": float(row.get("cantidad_asignada") or 0),
                        "precio": float(row.get("precio_unitario") or 0),
                        "valor": float(row.get("valor") or 0),
                    })
                else:
                    items.append({
                        "solicitud_id": row[0],
                        "centro": row[1],
                        "sector": row[2],
                        "fecha": row[3],
                        "tipo_fuente": row[4],
                        "cantidad": float(row[5] or 0),
                        "precio": float(row[6] or 0),
                        "valor": float(row[7] or 0),
                    })

            return jsonify({
                "ok": True,
                "items": items,
                "total": len(items),
                "valorTotal": sum(i["valor"] for i in items),
            })

    except Exception as e:
        logger.error(f"Error obteniendo compras evitadas detalle: {e}")
        return jsonify({
            "ok": False,
            "error": "Error al obtener compras evitadas",
            "items": [],
            "total": 0,
            "valorTotal": 0,
        }), 500


@bp.route("", methods=["GET"])
@require_auth
@cached(kpi_cache, "kpis")
def get_kpis():
    """
    Obtiene KPIs del sistema basados en datos reales.

    Returns:
        - solicitudes: métricas de solicitudes
        - presupuesto: métricas de presupuesto por centro/sector
        - materialesMasSolicitados: top 5 materiales
        - gruposArticulosMasSolicitados: top 5 grupos de artículos
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # =============================================
            # 1. MÉTRICAS DE SOLICITUDES
            # =============================================

            # Total de solicitudes por estado
            cursor.execute(
                """
                SELECT
                    status,
                    COUNT(*) as cantidad
                FROM solicitud
                GROUP BY status
            """
            )
            rows = _rows_to_dicts(cursor.fetchall(), cursor)
            estados_raw = {row["status"]: row["cantidad"] for row in rows}

            # Mapear estados a categorías
            total = sum(estados_raw.values())
            aprobadas = (
                estados_raw.get("approved", 0)
                + estados_raw.get("processing", 0)
                + estados_raw.get("dispatched", 0)
                + estados_raw.get("closed", 0)
            )
            rechazadas = estados_raw.get("rejected", 0)
            pendientes = estados_raw.get("submitted", 0) + estados_raw.get("draft", 0)

            # Tendencia últimos 7 días
            cursor.execute(
                f"""
                SELECT
                    DATE(created_at) as fecha,
                    COUNT(*) as cantidad
                FROM solicitud
                WHERE created_at >= {sql_date_relative(days=-7)}
                GROUP BY DATE(created_at)
                ORDER BY fecha
            """
            )
            trend_data = _rows_to_dicts(cursor.fetchall(), cursor)
            trend = [row["cantidad"] for row in trend_data] if trend_data else [0] * 7

            # Asegurar 7 valores
            while len(trend) < 7:
                trend.insert(0, 0)
            trend = trend[-7:]

            # Calcular tendencia porcentual (vs semana anterior)
            cursor.execute(
                f"""
                SELECT COUNT(*) FROM solicitud
                WHERE created_at >= {sql_date_relative(days=-14)}
                AND created_at < {sql_date_relative(days=-7)}
            """
            )
            row = cursor.fetchone()
            prev_week = (list(row.values())[0] if isinstance(row, dict) else row[0]) or 1
            cursor.execute(
                f"""
                SELECT COUNT(*) FROM solicitud
                WHERE created_at >= {sql_date_relative(days=-7)}
            """
            )
            row = cursor.fetchone()
            this_week = (list(row.values())[0] if isinstance(row, dict) else row[0]) or 0
            trend_percentage = (
                round(((this_week - prev_week) / prev_week) * 100, 1) if prev_week > 0 else 0
            )

            # =============================================
            # 2. PRESUPUESTO
            # =============================================

            cursor.execute(
                """
                SELECT
                    centro,
                    sector,
                    monto_usd,
                    saldo_usd
                FROM presupuesto
                WHERE monto_usd > 0
                ORDER BY monto_usd DESC
            """
            )
            presupuestos = _rows_to_dicts(cursor.fetchall(), cursor)

            total_presupuesto = sum(row["monto_usd"] or 0 for row in presupuestos)
            total_utilizado = sum(
                (row["monto_usd"] or 0) - (row["saldo_usd"] or 0) for row in presupuestos
            )
            total_disponible = sum(row["saldo_usd"] or 0 for row in presupuestos)

            presupuesto_por_centro = []
            for row in presupuestos[:5]:  # Top 5
                presupuesto_por_centro.append(
                    {
                        "nombre": f"Centro {row['centro']} - {row['sector']}",
                        "valor": (row["monto_usd"] or 0)
                        - (row["saldo_usd"] or 0),  # Utilizado
                    }
                )

            percentage_used = (
                round((total_utilizado / total_presupuesto) * 100) if total_presupuesto > 0 else 0
            )

            # =============================================
            # 2.0 COMPRAS EVITADAS (abastecimiento interno)
            # =============================================
            # Suma de items abastecidos desde stock o transferencia interna
            try:
                cursor.execute(
                    """
                    SELECT
                        COALESCE(SUM(f.cantidad_asignada * COALESCE(f.precio_unitario, 0)), 0) as valor_evitado,
                        COUNT(DISTINCT f.id) as items_internos
                    FROM decision_abastecimiento_fuentes f
                    JOIN decision_abastecimiento d ON f.decision_id = d.id
                    WHERE f.tipo_fuente IN ('stock', 'transferencia')
                """
                )
                row = cursor.fetchone()
                if isinstance(row, dict):
                    compras_evitadas_usd = float(row.get("valor_evitado") or 0)
                    items_internos = row.get("items_internos") or 0
                else:
                    compras_evitadas_usd = float(row[0]) if row else 0
                    items_internos = row[1] if row else 0
            except Exception:
                compras_evitadas_usd = 0
                items_internos = 0

            # =============================================
            # 2.1 PRESUPUESTO POR CENTRO (Top 3 con %)
            # =============================================
            centros_agrupados = defaultdict(lambda: {"monto": 0, "utilizado": 0})
            for row in presupuestos:
                centro = row["centro"]
                monto = row["monto_usd"] or 0
                utilizado = monto - (row["saldo_usd"] or 0)
                centros_agrupados[centro]["monto"] += monto
                centros_agrupados[centro]["utilizado"] += utilizado

            top_centros = []
            for centro, datos in sorted(
                centros_agrupados.items(),
                key=lambda x: x[1]["utilizado"],
                reverse=True
            )[:3]:
                pct = round((datos["utilizado"] / datos["monto"]) * 100) if datos["monto"] > 0 else 0
                top_centros.append({
                    "nombre": centro,
                    "monto": datos["monto"],
                    "utilizado": datos["utilizado"],
                    "porcentaje": pct,
                })

            # =============================================
            # 2.2 PRESUPUESTO POR SECTOR (Top 3 con %)
            # =============================================
            sectores_agrupados = defaultdict(lambda: {"monto": 0, "utilizado": 0})
            for row in presupuestos:
                sector = row["sector"]
                monto = row["monto_usd"] or 0
                utilizado = monto - (row["saldo_usd"] or 0)
                sectores_agrupados[sector]["monto"] += monto
                sectores_agrupados[sector]["utilizado"] += utilizado

            top_sectores = []
            for sector, datos in sorted(
                sectores_agrupados.items(),
                key=lambda x: x[1]["utilizado"],
                reverse=True
            )[:3]:
                pct = round((datos["utilizado"] / datos["monto"]) * 100) if datos["monto"] > 0 else 0
                top_sectores.append({
                    "nombre": sector,
                    "monto": datos["monto"],
                    "utilizado": datos["utilizado"],
                    "porcentaje": pct,
                })

            # =============================================
            # 3. MATERIALES MÁS SOLICITADOS
            # =============================================

            # Obtener todos los items de solicitudes y contar por código
            cursor.execute(
                """
                SELECT data_json FROM solicitud
                WHERE status NOT IN ('draft')
            """
            )

            material_counter = Counter()
            grupo_counter = Counter()

            rows_data = _rows_to_dicts(cursor.fetchall(), cursor)
            for row in rows_data:
                try:
                    data = json.loads(row["data_json"])
                    items = data.get("items", [])
                    for item in items:
                        codigo = item.get("codigo") or item.get("codigo_sap", "")
                        descripcion = item.get("descripcion", "Material sin descripción")
                        cantidad = item.get("cantidad", 1)

                        # Contar material
                        material_counter[(codigo, descripcion[:50])] += cantidad

                        # Extraer grupo del código (primeros 4-6 dígitos suelen ser el grupo)
                        # O extraer de la descripción (primera palabra significativa)
                        if descripcion:
                            # Intentar extraer grupo de la descripción
                            palabras = descripcion.split()
                            if palabras:
                                grupo = palabras[0].upper()
                                # Limpiar grupo
                                grupo = grupo.strip(".,;:*#")
                                if len(grupo) >= 2:
                                    grupo_counter[grupo] += cantidad
                except (json.JSONDecodeError, TypeError):
                    continue

            # Top 5 materiales
            top_materiales = []
            for (codigo, descripcion), cantidad in material_counter.most_common(5):
                top_materiales.append(
                    {
                        "codigo": codigo,
                        "nombre": (
                            descripcion if len(descripcion) <= 40 else descripcion[:37] + "..."
                        ),
                        "cantidad": cantidad,
                    }
                )

            # Top 5 grupos de artículos
            top_grupos = []
            for grupo, cantidad in grupo_counter.most_common(5):
                top_grupos.append({"nombre": grupo, "cantidad": cantidad})

            # =============================================
            # 4. TIEMPO PROMEDIO DE APROBACIÓN
            # =============================================

            # Calcular tiempo promedio entre creación y aprobación
            cursor.execute(
                f"""
                SELECT
                    AVG({sql_date_diff_days('updated_at', 'created_at')}) as promedio_dias
                FROM solicitud
                WHERE status IN ('approved', 'processing', 'dispatched', 'closed')
            """
            )
            row = _row_to_dict(cursor.fetchone(), cursor)
            promedio_dias = (
                round(row["promedio_dias"], 1) if row and row.get("promedio_dias") else 2.5
            )

            # Calcular trend real de tiempo de aprobación (últimos 7 días)
            tiempo_trend = []
            for dias_atras in range(6, -1, -1):  # 6, 5, 4, 3, 2, 1, 0 (de más antiguo a hoy)
                cursor.execute(
                    f"""
                    SELECT
                        AVG({sql_date_diff_days('updated_at', 'created_at')}) as promedio
                    FROM solicitud
                    WHERE status IN ('approved', 'processing', 'dispatched', 'closed')
                    AND DATE(updated_at) = DATE({sql_date_relative(days=-dias_atras)})
                """
                )
                row_trend = cursor.fetchone()
                if row_trend:
                    val = (row_trend.get("promedio") if isinstance(row_trend, dict)
                           else row_trend[0])
                    tiempo_trend.append(round(val, 1) if val else promedio_dias)
                else:
                    tiempo_trend.append(promedio_dias)

            # =============================================
            # 5. SOLICITUDES POR ESTADO (ÚLTIMOS 6 MESES)
            # =============================================

            # Nombres de meses en español
            meses = [
                "Ene",
                "Feb",
                "Mar",
                "Abr",
                "May",
                "Jun",
                "Jul",
                "Ago",
                "Sep",
                "Oct",
                "Nov",
                "Dic",
            ]

            cursor.execute(
                f"""
                SELECT
                    {sql_format_date('created_at', '%Y-%m')} as mes,
                    status,
                    COUNT(*) as cantidad
                FROM solicitud
                WHERE created_at >= {sql_date_relative(months=-6)}
                GROUP BY {sql_format_date('created_at', '%Y-%m')}, status
                ORDER BY mes
            """
            )

            por_mes = defaultdict(lambda: {"aprobadas": 0, "rechazadas": 0, "pendientes": 0})
            rows_mes = _rows_to_dicts(cursor.fetchall(), cursor)
            for row in rows_mes:
                mes = row["mes"]
                status = row["status"]
                cantidad = row["cantidad"]

                if status in ("approved", "processing", "dispatched", "closed"):
                    por_mes[mes]["aprobadas"] += cantidad
                elif status == "rejected":
                    por_mes[mes]["rechazadas"] += cantidad
                else:
                    por_mes[mes]["pendientes"] += cantidad

            # Ordenar por mes y tomar últimos 6
            meses_ordenados = sorted(por_mes.keys())[-6:]
            labels = []
            aprobadas_por_mes = []
            rechazadas_por_mes = []
            pendientes_por_mes = []

            for mes_key in meses_ordenados:
                # Convertir "2024-12" a "Dic"
                try:
                    mes_num = int(mes_key.split("-")[1])
                    labels.append(meses[mes_num - 1])
                except (ValueError, IndexError):
                    labels.append(mes_key)

                aprobadas_por_mes.append(por_mes[mes_key]["aprobadas"])
                rechazadas_por_mes.append(por_mes[mes_key]["rechazadas"])
                pendientes_por_mes.append(por_mes[mes_key]["pendientes"])

            # Asegurar 6 valores
            while len(labels) < 6:
                labels.insert(0, "-")
                aprobadas_por_mes.insert(0, 0)
                rechazadas_por_mes.insert(0, 0)
                pendientes_por_mes.insert(0, 0)

            # =============================================
            # RESPUESTA FINAL
            # =============================================

            return jsonify(
                {
                    "ok": True,
                    "data": {
                        "solicitudes": {
                            "total": total,
                            "aprobadas": aprobadas,
                            "rechazadas": rechazadas,
                            "pendientes": pendientes,
                            "trend": trend,
                            "trendPercentage": trend_percentage,
                        },
                        "presupuesto": {
                            "total": total_presupuesto,
                            "utilizado": total_utilizado,
                            "disponible": total_disponible,
                            "percentage": percentage_used,
                            "porCentro": presupuesto_por_centro,
                            "topCentros": top_centros,
                            "topSectores": top_sectores,
                        },
                        "comprasEvitadas": {
                            "valor": compras_evitadas_usd,
                            "items": items_internos,
                        },
                        "tiempoAprobacion": {
                            "promedio": promedio_dias,
                            "meta": 3.0,
                            "trend": tiempo_trend,
                        },
                        "materialesMasSolicitados": top_materiales,
                        "gruposArticulosMasSolicitados": top_grupos,
                        "solicitudesPorEstado": {
                            "labels": labels,
                            "aprobadas": aprobadas_por_mes,
                            "rechazadas": rechazadas_por_mes,
                            "pendientes": pendientes_por_mes,
                        },
                    },
                }
            )

    except Exception as e:
        logger.error(f"Error obteniendo KPIs: {e}")
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "kpi_error",
                        "message": "Error al obtener métricas del sistema",
                    },
                }
            ),
            500,
        )
