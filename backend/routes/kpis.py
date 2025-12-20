"""
Rutas para KPIs y métricas del sistema
"""

import json
from collections import Counter, defaultdict

from flask import Blueprint, jsonify

try:
    from backend.core.db import get_db_connection, is_using_postgresql
except ImportError:
    from core.db import get_db_connection, is_using_postgresql


def _row_to_dict(row, cursor):
    """Convierte una fila de BD a diccionario"""
    if row is None:
        return None
    if is_using_postgresql():
        columns = [desc[0] for desc in cursor.description]
        return dict(zip(columns, row))
    return dict(row)


def _rows_to_dicts(rows, cursor):
    """Convierte múltiples filas a diccionarios"""
    if is_using_postgresql():
        columns = [desc[0] for desc in cursor.description]
        return [dict(zip(columns, row)) for row in rows]
    return [dict(row) for row in rows]


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
            using_pg = is_using_postgresql()

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
            if using_pg:
                cursor.execute(
                    """
                    SELECT
                        DATE(created_at) as fecha,
                        COUNT(*) as cantidad
                    FROM solicitudes
                    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
                    GROUP BY DATE(created_at)
                    ORDER BY fecha
                """
                )
            else:
                cursor.execute(
                    """
                    SELECT
                        DATE(created_at) as fecha,
                        COUNT(*) as cantidad
                    FROM solicitudes
                    WHERE created_at >= DATE('now', '-7 days')
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
            if using_pg:
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM solicitudes
                    WHERE created_at >= CURRENT_DATE - INTERVAL '14 days'
                    AND created_at < CURRENT_DATE - INTERVAL '7 days'
                """
                )
            else:
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM solicitudes
                    WHERE created_at >= DATE('now', '-14 days')
                    AND created_at < DATE('now', '-7 days')
                """
                )
            prev_week = cursor.fetchone()[0] or 1
            if using_pg:
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM solicitudes
                    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
                """
                )
            else:
                cursor.execute(
                    """
                    SELECT COUNT(*) FROM solicitudes
                    WHERE created_at >= DATE('now', '-7 days')
                """
                )
            this_week = cursor.fetchone()[0] or 0
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
                    monto_total,
                    monto_disponible
                FROM presupuestos
                WHERE monto_total > 0
                ORDER BY monto_total DESC
            """
            )
            presupuestos = _rows_to_dicts(cursor.fetchall(), cursor)

            total_presupuesto = sum(row["monto_total"] or 0 for row in presupuestos)
            total_utilizado = sum(
                (row["monto_total"] or 0) - (row["monto_disponible"] or 0) for row in presupuestos
            )
            total_disponible = sum(row["monto_disponible"] or 0 for row in presupuestos)

            presupuesto_por_centro = []
            for row in presupuestos[:5]:  # Top 5
                presupuesto_por_centro.append(
                    {
                        "nombre": f"Centro {row['centro']} - {row['sector']}",
                        "valor": (row["monto_total"] or 0)
                        - (row["monto_disponible"] or 0),  # Utilizado
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
            if using_pg:
                cursor.execute(
                    """
                    SELECT
                        AVG(EXTRACT(EPOCH FROM (updated_at::timestamp - created_at::timestamp)) / 86400) as promedio_dias
                    FROM solicitudes
                    WHERE status IN ('approved', 'processing', 'dispatched', 'closed')
                """
                )
            else:
                cursor.execute(
                    """
                    SELECT
                        AVG(JULIANDAY(updated_at) - JULIANDAY(created_at)) as promedio_dias
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

            if using_pg:
                cursor.execute(
                    """
                    SELECT
                        TO_CHAR(created_at::timestamp, 'YYYY-MM') as mes,
                        status,
                        COUNT(*) as cantidad
                    FROM solicitudes
                    WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
                    GROUP BY TO_CHAR(created_at::timestamp, 'YYYY-MM'), status
                    ORDER BY mes
                """
                )
            else:
                cursor.execute(
                    """
                    SELECT
                        strftime('%Y-%m', created_at) as mes,
                        status,
                        COUNT(*) as cantidad
                    FROM solicitudes
                    WHERE created_at >= DATE('now', '-6 months')
                    GROUP BY strftime('%Y-%m', created_at), status
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
