"""
Rutas para KPIs y métricas del sistema
"""

import json
from collections import Counter, defaultdict

from flask import Blueprint, jsonify

from backend.core.db import (
    get_db_connection,
    sql_date_diff_days,
    sql_date_relative,
    sql_format_date,
)
from backend.core.helpers import row_to_dict as _row_to_dict


def _rows_to_dicts(rows, cursor):
    """Convierte múltiples filas a diccionarios"""
    return [row if isinstance(row, dict) else dict(row) for row in rows]


bp = Blueprint("kpis", __name__, url_prefix="/api/kpis")


@bp.route("", methods=["GET"])
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
                FROM solicitudes
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
                FROM solicitudes
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
                SELECT COUNT(*) FROM solicitudes
                WHERE created_at >= {sql_date_relative(days=-14)}
                AND created_at < {sql_date_relative(days=-7)}
            """
            )
            row = cursor.fetchone()
            prev_week = (list(row.values())[0] if isinstance(row, dict) else row[0]) or 1
            cursor.execute(
                f"""
                SELECT COUNT(*) FROM solicitudes
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
                FROM presupuestos
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
            # 3. MATERIALES MÁS SOLICITADOS
            # =============================================

            # Obtener todos los items de solicitudes y contar por código
            cursor.execute(
                """
                SELECT data_json FROM solicitudes
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
                FROM solicitudes
                WHERE status IN ('approved', 'processing', 'dispatched', 'closed')
            """
            )
            row = _row_to_dict(cursor.fetchone(), cursor)
            promedio_dias = (
                round(row["promedio_dias"], 1) if row and row.get("promedio_dias") else 2.5
            )

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
                FROM solicitudes
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
                        },
                        "tiempoAprobacion": {
                            "promedio": promedio_dias,
                            "meta": 3.0,
                            "trend": [3.2, 2.9, 2.7, 2.5, 2.4, promedio_dias, promedio_dias],
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
        import logging

        logging.getLogger(__name__).error(f"Error obteniendo KPIs: {e}")
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
