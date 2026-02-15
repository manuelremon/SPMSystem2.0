"""
Dashboard Data Routes - Endpoints paginados para DashboardAdmin

Endpoints:
- GET /api/dashboard-data/solicitudes  - Solicitudes paginadas con filtros
- GET /api/dashboard-data/resumen      - Resumen ejecutivo (KPIs rápidos)
- GET /api/dashboard-data/drill/<metrica> - Drill-down analytics por métrica

Sprint 35: Paginación server-side para reducir carga en frontend
Sprint 36: Drill-down analytics para exploración detallada de métricas
"""

import json
import logging
import math
from datetime import datetime

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

from backend.core.db import get_db_connection, is_using_postgresql, sql_date_relative
from backend.core.helpers import row_to_dict
from backend.core.roles import require_auth

bp = Blueprint("dashboards_data", __name__, url_prefix="/api/dashboard-data")


# =============================================================================
# Sprint 35: Paginación Server-Side
# =============================================================================


@bp.route("/solicitudes", methods=["GET"])
@require_auth
def get_solicitudes_paginadas():
    """
    Obtener solicitudes con paginación y filtros server-side.

    Query params:
    - page: página actual (default 1)
    - page_size: items por página (default 50, max 200)
    - estado: filtrar por estado (draft, submitted, approved, rejected, etc.)
    - centro: filtrar por centro
    - sector: filtrar por sector
    - sort_by: campo de ordenamiento (default "created_at")
    - sort_dir: dirección (asc/desc, default "desc")
    - q: búsqueda rápida en justificacion/solicitante

    Returns:
        {
            ok: true,
            data: [...],
            total: N,
            page: P,
            pages: ceil(total/page_size),
            page_size: PS
        }
    """
    try:
        # Validación de paginación
        page = max(1, request.args.get("page", 1, type=int))
        page_size = min(max(1, request.args.get("page_size", 50, type=int)), 200)

        # Filtros
        estado = request.args.get("estado")
        centro = request.args.get("centro")
        sector = request.args.get("sector")
        q = request.args.get("q", "").strip()

        # Ordenamiento
        sort_by = request.args.get("sort_by", "created_at")
        sort_dir = request.args.get("sort_dir", "desc").lower()

        # Validar campos de ordenamiento permitidos
        allowed_sort_fields = {
            "created_at",
            "updated_at",
            "status",
            "total_monto",
            "fecha_necesidad",
            "criticidad",
            "centro",
            "sector",
        }
        if sort_by not in allowed_sort_fields:
            sort_by = "created_at"

        if sort_dir not in ["asc", "desc"]:
            sort_dir = "desc"

        # Construir cláusulas WHERE
        where_clauses = []
        params = []

        if estado:
            where_clauses.append("LOWER(s.status) = LOWER(?)")
            params.append(estado)

        if centro:
            where_clauses.append("s.centro = ?")
            params.append(centro)

        if sector:
            where_clauses.append("s.sector = ?")
            params.append(sector)

        if q:
            # Búsqueda en justificación, nombre de solicitante o apellido
            where_clauses.append(
                "(s.justificacion LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ?)"
            )
            like_pattern = f"%{q}%"
            params.extend([like_pattern, like_pattern, like_pattern])

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Contar total
            count_query = f"""
                SELECT COUNT(*) AS count
                FROM solicitud s
                LEFT JOIN usuario u ON s.id_usuario = u.id_spm
                {where_sql}
            """
            cursor.execute(count_query, params)
            count_row = cursor.fetchone()
            total = count_row["count"] if isinstance(count_row, dict) else count_row[0]

            # Calcular offset y páginas
            offset = (page - 1) * page_size
            total_pages = math.ceil(total / page_size) if total > 0 else 0

            # Obtener datos con paginación
            data_query = f"""
                SELECT
                    s.id, s.id_usuario, s.centro, s.sector, s.justificacion,
                    s.centro_costos, s.almacen_virtual, s.criticidad,
                    s.fecha_necesidad, s.status, s.total_monto,
                    s.aprobador_id, s.planner_id, s.created_at, s.updated_at,
                    s.data_json,
                    u.nombre AS solicitante_nombre,
                    u.apellido AS solicitante_apellido,
                    a.nombre AS aprobador_nombre,
                    a.apellido AS aprobador_apellido
                FROM solicitud s
                LEFT JOIN usuario u ON s.id_usuario = u.id_spm
                LEFT JOIN usuario a ON s.aprobador_id = a.id_spm
                {where_sql}
                ORDER BY s.{sort_by} {sort_dir}
                LIMIT ? OFFSET ?
            """
            cursor.execute(data_query, params + [page_size, offset])
            rows = cursor.fetchall()

        # Formatear resultados
        solicitudes_list = []
        for row in rows:
            d = row_to_dict(row)
            if not d:
                continue

            # Parsear data_json para obtener items_count
            try:
                extra = json.loads(d.get("data_json") or "{}")
                items_count = len(extra.get("items", []))
            except Exception:
                items_count = 0

            # Construir objeto de respuesta
            solicitudes_list.append(
                {
                    "id": d.get("id"),
                    "id_usuario": d.get("id_usuario"),
                    "centro": d.get("centro"),
                    "sector": d.get("sector"),
                    "justificacion": d.get("justificacion"),
                    "centro_costos": d.get("centro_costos"),
                    "almacen_virtual": d.get("almacen_virtual"),
                    "criticidad": d.get("criticidad"),
                    "fecha_necesidad": d.get("fecha_necesidad"),
                    "status": d.get("status"),
                    "total_monto": float(d.get("total_monto") or 0),
                    "aprobador_id": d.get("aprobador_id"),
                    "planner_id": d.get("planner_id"),
                    "created_at": d.get("created_at"),
                    "updated_at": d.get("updated_at"),
                    "solicitante_nombre": d.get("solicitante_nombre"),
                    "solicitante_apellido": d.get("solicitante_apellido"),
                    "aprobador_nombre": d.get("aprobador_nombre"),
                    "aprobador_apellido": d.get("aprobador_apellido"),
                    "items_count": items_count,
                }
            )

        return jsonify(
            {
                "ok": True,
                "data": solicitudes_list,
                "total": total,
                "page": page,
                "pages": total_pages,
                "page_size": page_size,
            }
        )

    except Exception as e:
        logger.error(f"Error obteniendo solicitudes paginadas: {e}", exc_info=True)
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "solicitudes_error",
                        "message": "Error al obtener solicitudes",
                    },
                }
            ),
            500,
        )


@bp.route("/resumen", methods=["GET"])
@require_auth
def get_resumen_ejecutivo():
    """
    Obtener resumen ejecutivo rápido (versión ligera de dashboard).

    Returns:
        {
            ok: true,
            data: {
                solicitudes: {...},
                presupuesto: {...},
                alertas_mrp: {...},
                sla_breaches: N,
                generado_at: "ISO timestamp"
            }
        }
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # 1. Solicitudes del día / pendientes
            if is_using_postgresql():
                cursor.execute(
                    """
                    SELECT
                        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as hoy,
                        COUNT(*) FILTER (WHERE status = 'submitted') as pendientes_aprobacion,
                        COUNT(*) FILTER (WHERE status = 'approved') as pendientes_planificacion,
                        COUNT(*) FILTER (WHERE status IN ('processing', 'dispatched')) as en_proceso,
                        COUNT(*) as total
                    FROM solicitud
                """
                )
            else:
                cursor.execute(
                    """
                    SELECT
                        SUM(CASE WHEN DATE(created_at) = DATE('now') THEN 1 ELSE 0 END) as hoy,
                        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as pendientes_aprobacion,
                        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as pendientes_planificacion,
                        SUM(CASE WHEN status IN ('processing', 'dispatched') THEN 1 ELSE 0 END) as en_proceso,
                        COUNT(*) as total
                    FROM solicitud
                """
                )
            sol_row = cursor.fetchone()
            sol = row_to_dict(sol_row) or {}

            # 2. Presupuesto resumen
            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(monto_usd), 0) as total,
                    COALESCE(SUM(saldo_usd), 0) as disponible,
                    COALESCE(SUM(monto_usd) - SUM(saldo_usd), 0) as utilizado
                FROM presupuesto
                WHERE monto_usd > 0
            """
            )
            pres_row = cursor.fetchone()
            presupuesto = row_to_dict(pres_row) or {}
            total_pres = float(presupuesto.get("total") or 0)
            presupuesto["porcentaje_usado"] = (
                round((float(presupuesto.get("utilizado") or 0) / total_pres * 100), 1)
                if total_pres > 0
                else 0
            )

            # 3. Alertas MRP críticas
            alertas_mrp = {"criticas": 0, "altas": 0}
            try:
                with get_db_connection("sap_data") as conn2:
                    cur2 = conn2.cursor()
                    cur2.execute(
                        """
                        SELECT
                            SUM(CASE WHEN s.stock_actual <= 0 THEN 1 ELSE 0 END) as criticas,
                            SUM(CASE WHEN s.stock_actual > 0 AND s.stock_actual < m.punto_de_pedido THEN 1 ELSE 0 END) as altas
                        FROM materiales_bbdd m
                        LEFT JOIN (
                            SELECT material, centro, SUM(stock) as stock_actual
                            FROM stock GROUP BY material, centro
                        ) s ON m.codigo_material = s.material AND m.centro = s.centro
                        WHERE m.punto_de_pedido > 0
                    """
                    )
                    alert_row = cur2.fetchone()
                    if alert_row:
                        alertas_mrp = {
                            "criticas": int(row_to_dict(alert_row).get("criticas") or 0),
                            "altas": int(row_to_dict(alert_row).get("altas") or 0),
                        }
            except Exception as e:
                logger.warning(f"Error obteniendo alertas MRP: {e}")

            # 4. SLA breaches
            sla_breaches = 0
            try:
                cursor.execute(
                    f"""
                    SELECT COUNT(*) as total
                    FROM solicitud
                    WHERE status = 'submitted'
                    AND created_at < {sql_date_relative(days=-3)}
                """
                )
                sla_row = cursor.fetchone()
                sla_breaches = int(row_to_dict(sla_row).get("total") or 0)
            except Exception as e:
                logger.warning(f"Error obteniendo SLA breaches: {e}")

        return jsonify(
            {
                "ok": True,
                "data": {
                    "solicitudes": {
                        "hoy": int(sol.get("hoy") or 0),
                        "pendientes_aprobacion": int(sol.get("pendientes_aprobacion") or 0),
                        "pendientes_planificacion": int(
                            sol.get("pendientes_planificacion") or 0
                        ),
                        "en_proceso": int(sol.get("en_proceso") or 0),
                        "total": int(sol.get("total") or 0),
                    },
                    "presupuesto": {
                        "total": float(presupuesto.get("total") or 0),
                        "disponible": float(presupuesto.get("disponible") or 0),
                        "utilizado": float(presupuesto.get("utilizado") or 0),
                        "porcentaje_usado": presupuesto.get("porcentaje_usado", 0),
                    },
                    "alertas_mrp": alertas_mrp,
                    "sla_breaches": sla_breaches,
                    "generado_at": datetime.now().isoformat(),
                },
            }
        )

    except Exception as e:
        logger.error(f"Error en resumen ejecutivo: {e}", exc_info=True)
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "resumen_error",
                        "message": "Error al generar resumen ejecutivo",
                    },
                }
            ),
            500,
        )


# =============================================================================
# Sprint 36: Drill-Down Analytics
# =============================================================================


@bp.route("/drill/<metrica>", methods=["GET"])
@require_auth
def drill_down_metrica(metrica):
    """
    Obtener datos detallados de una métrica específica con paginación.

    Métricas soportadas:
    - solicitudes_diarias: Solicitudes por día
    - solicitudes_por_estado: Desglose por estado
    - presupuesto_por_centro: Consumo de presupuesto por centro
    - materiales_top: Materiales más solicitados
    - tiempos_promedio: Tiempos de procesamiento por etapa
    - stock_critico: Materiales con stock crítico
    - compras_evitadas: Solicitudes resueltas con stock

    Query params:
    - periodo: días hacia atrás (default 30)
    - centro: filtrar por centro
    - sector: filtrar por sector
    - page: página (default 1)
    - page_size: items por página (default 50, max 200)

    Returns:
        {
            ok: true,
            data: [...],
            total: N,
            metrica: "nombre",
            titulo: "...",
            columnas: [{field, headerName, type}, ...]
        }
    """
    try:
        # Validar métrica
        metricas_validas = {
            "solicitudes_diarias",
            "solicitudes_por_estado",
            "presupuesto_por_centro",
            "materiales_top",
            "tiempos_promedio",
            "stock_critico",
            "compras_evitadas",
        }

        if metrica not in metricas_validas:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "metrica_invalida",
                            "message": f"Métrica '{metrica}' no soportada",
                        },
                    }
                ),
                400,
            )

        # Parámetros comunes
        periodo = min(max(1, request.args.get("periodo", 30, type=int)), 365)
        centro = request.args.get("centro")
        sector = request.args.get("sector")
        page = max(1, request.args.get("page", 1, type=int))
        page_size = min(max(1, request.args.get("page_size", 50, type=int)), 200)

        # Delegar a handlers específicos
        if metrica == "solicitudes_diarias":
            return _drill_solicitudes_diarias(periodo, centro, sector, page, page_size)
        elif metrica == "solicitudes_por_estado":
            return _drill_solicitudes_por_estado(periodo, centro, sector, page, page_size)
        elif metrica == "presupuesto_por_centro":
            return _drill_presupuesto_por_centro(periodo, centro, sector, page, page_size)
        elif metrica == "materiales_top":
            return _drill_materiales_top(periodo, centro, sector, page, page_size)
        elif metrica == "tiempos_promedio":
            return _drill_tiempos_promedio(periodo, centro, sector, page, page_size)
        elif metrica == "stock_critico":
            return _drill_stock_critico(centro, page, page_size)
        elif metrica == "compras_evitadas":
            return _drill_compras_evitadas(periodo, centro, sector, page, page_size)

    except Exception as e:
        logger.error(f"Error en drill-down {metrica}: {e}", exc_info=True)
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "drill_error",
                        "message": f"Error al obtener datos de {metrica}",
                    },
                }
            ),
            500,
        )


# =============================================================================
# Handlers de Drill-Down
# =============================================================================


def _drill_solicitudes_diarias(periodo, centro, sector, page, page_size):
    """Solicitudes agrupadas por día."""
    where_clauses = []
    params = []

    # Filtro de fecha
    where_clauses.append(f"created_at >= {sql_date_relative(days=-periodo)}")

    if centro:
        where_clauses.append("centro = ?")
        params.append(centro)

    if sector:
        where_clauses.append("sector = ?")
        params.append(sector)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Contar total de días únicos
        if is_using_postgresql():
            count_query = f"""
                SELECT COUNT(DISTINCT DATE(created_at)) as total
                FROM solicitud
                {where_sql}
            """
        else:
            count_query = f"""
                SELECT COUNT(DISTINCT DATE(created_at)) as total
                FROM solicitud
                {where_sql}
            """
        cursor.execute(count_query, params)
        total = row_to_dict(cursor.fetchone()).get("total") or 0

        # Obtener datos paginados
        offset = (page - 1) * page_size

        if is_using_postgresql():
            data_query = f"""
                SELECT
                    DATE(created_at) as fecha,
                    COUNT(*) as cantidad,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as aprobadas,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rechazadas,
                    COALESCE(SUM(total_monto), 0) as monto_total
                FROM solicitud
                {where_sql}
                GROUP BY DATE(created_at)
                ORDER BY fecha DESC
                LIMIT ? OFFSET ?
            """
        else:
            data_query = f"""
                SELECT
                    DATE(created_at) as fecha,
                    COUNT(*) as cantidad,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as aprobadas,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rechazadas,
                    COALESCE(SUM(total_monto), 0) as monto_total
                FROM solicitud
                {where_sql}
                GROUP BY DATE(created_at)
                ORDER BY fecha DESC
                LIMIT ? OFFSET ?
            """
        cursor.execute(data_query, params + [page_size, offset])
        rows = cursor.fetchall()

    data = []
    for row in rows:
        d = row_to_dict(row)
        data.append(
            {
                "fecha": d.get("fecha"),
                "cantidad": int(d.get("cantidad") or 0),
                "aprobadas": int(d.get("aprobadas") or 0),
                "rechazadas": int(d.get("rechazadas") or 0),
                "monto_total": float(d.get("monto_total") or 0),
            }
        )

    return jsonify(
        {
            "ok": True,
            "data": data,
            "total": total,
            "metrica": "solicitudes_diarias",
            "titulo": "Solicitudes por Día",
            "columnas": [
                {"field": "fecha", "headerName": "Fecha", "type": "date"},
                {"field": "cantidad", "headerName": "Total", "type": "number"},
                {"field": "aprobadas", "headerName": "Aprobadas", "type": "number"},
                {"field": "rechazadas", "headerName": "Rechazadas", "type": "number"},
                {"field": "monto_total", "headerName": "Monto USD", "type": "number"},
            ],
        }
    )


def _drill_solicitudes_por_estado(periodo, centro, sector, page, page_size):
    """Solicitudes agrupadas por estado."""
    where_clauses = []
    params = []

    where_clauses.append(f"created_at >= {sql_date_relative(days=-periodo)}")

    if centro:
        where_clauses.append("centro = ?")
        params.append(centro)

    if sector:
        where_clauses.append("sector = ?")
        params.append(sector)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Contar total de estados únicos
        count_query = f"""
            SELECT COUNT(DISTINCT status) as total
            FROM solicitud
            {where_sql}
        """
        cursor.execute(count_query, params)
        total = row_to_dict(cursor.fetchone()).get("total") or 0

        # Obtener datos paginados
        offset = (page - 1) * page_size
        data_query = f"""
            SELECT
                status,
                COUNT(*) as cantidad,
                COALESCE(SUM(total_monto), 0) as monto_total,
                COALESCE(AVG(total_monto), 0) as monto_promedio
            FROM solicitud
            {where_sql}
            GROUP BY status
            ORDER BY cantidad DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(data_query, params + [page_size, offset])
        rows = cursor.fetchall()

    data = []
    for row in rows:
        d = row_to_dict(row)
        data.append(
            {
                "status": d.get("status"),
                "cantidad": int(d.get("cantidad") or 0),
                "monto_total": float(d.get("monto_total") or 0),
                "monto_promedio": float(d.get("monto_promedio") or 0),
            }
        )

    return jsonify(
        {
            "ok": True,
            "data": data,
            "total": total,
            "metrica": "solicitudes_por_estado",
            "titulo": "Solicitudes por Estado",
            "columnas": [
                {"field": "status", "headerName": "Estado", "type": "string"},
                {"field": "cantidad", "headerName": "Cantidad", "type": "number"},
                {"field": "monto_total", "headerName": "Monto Total USD", "type": "number"},
                {"field": "monto_promedio", "headerName": "Monto Promedio USD", "type": "number"},
            ],
        }
    )


def _drill_presupuesto_por_centro(periodo, centro, sector, page, page_size):
    """Consumo de presupuesto por centro."""
    where_clauses = []
    params = []

    if centro:
        where_clauses.append("centro = ?")
        params.append(centro)

    if sector:
        where_clauses.append("sector = ?")
        params.append(sector)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Contar total de centros únicos
        count_query = f"""
            SELECT COUNT(DISTINCT centro) as total
            FROM presupuesto
            {where_sql}
        """
        cursor.execute(count_query, params)
        total = row_to_dict(cursor.fetchone()).get("total") or 0

        # Obtener datos paginados
        offset = (page - 1) * page_size
        data_query = f"""
            SELECT
                centro,
                sector,
                COALESCE(SUM(monto_usd), 0) as total_asignado,
                COALESCE(SUM(saldo_usd), 0) as saldo_disponible,
                COALESCE(SUM(monto_usd) - SUM(saldo_usd), 0) as consumido
            FROM presupuesto
            {where_sql}
            GROUP BY centro, sector
            ORDER BY consumido DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(data_query, params + [page_size, offset])
        rows = cursor.fetchall()

    data = []
    for row in rows:
        d = row_to_dict(row)
        total_asignado = float(d.get("total_asignado") or 0)
        consumido = float(d.get("consumido") or 0)
        porcentaje_uso = (
            round((consumido / total_asignado * 100), 1) if total_asignado > 0 else 0
        )

        data.append(
            {
                "centro": d.get("centro"),
                "sector": d.get("sector"),
                "total_asignado": total_asignado,
                "saldo_disponible": float(d.get("saldo_disponible") or 0),
                "consumido": consumido,
                "porcentaje_uso": porcentaje_uso,
            }
        )

    return jsonify(
        {
            "ok": True,
            "data": data,
            "total": total,
            "metrica": "presupuesto_por_centro",
            "titulo": "Presupuesto por Centro",
            "columnas": [
                {"field": "centro", "headerName": "Centro", "type": "string"},
                {"field": "sector", "headerName": "Sector", "type": "string"},
                {"field": "total_asignado", "headerName": "Asignado USD", "type": "number"},
                {"field": "saldo_disponible", "headerName": "Disponible USD", "type": "number"},
                {"field": "consumido", "headerName": "Consumido USD", "type": "number"},
                {"field": "porcentaje_uso", "headerName": "% Uso", "type": "number"},
            ],
        }
    )


def _drill_materiales_top(periodo, centro, sector, page, page_size):
    """Materiales más solicitados."""
    where_clauses = []
    params = []

    where_clauses.append(f"created_at >= {sql_date_relative(days=-periodo)}")

    if centro:
        where_clauses.append("centro = ?")
        params.append(centro)

    if sector:
        where_clauses.append("sector = ?")
        params.append(sector)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Obtener todas las solicitudes con items
        query = f"""
            SELECT data_json
            FROM solicitud
            {where_sql}
        """
        cursor.execute(query, params)
        rows = cursor.fetchall()

    # Procesar items de JSON
    materiales_count = {}
    for row in rows:
        d = row_to_dict(row)
        try:
            extra = json.loads(d.get("data_json") or "{}")
            items = extra.get("items", [])
            for item in items:
                codigo = item.get("codigo")
                descripcion = item.get("descripcion", "")
                cantidad = float(item.get("cantidad") or 0)

                if codigo:
                    if codigo not in materiales_count:
                        materiales_count[codigo] = {
                            "codigo": codigo,
                            "descripcion": descripcion,
                            "veces_solicitado": 0,
                            "cantidad_total": 0,
                        }
                    materiales_count[codigo]["veces_solicitado"] += 1
                    materiales_count[codigo]["cantidad_total"] += cantidad
        except Exception:
            continue

    # Convertir a lista y ordenar
    materiales_list = sorted(
        materiales_count.values(), key=lambda x: x["veces_solicitado"], reverse=True
    )

    # Paginar
    total = len(materiales_list)
    offset = (page - 1) * page_size
    data = materiales_list[offset : offset + page_size]

    return jsonify(
        {
            "ok": True,
            "data": data,
            "total": total,
            "metrica": "materiales_top",
            "titulo": "Materiales Más Solicitados",
            "columnas": [
                {"field": "codigo", "headerName": "Código", "type": "string"},
                {"field": "descripcion", "headerName": "Descripción", "type": "string"},
                {
                    "field": "veces_solicitado",
                    "headerName": "Veces Solicitado",
                    "type": "number",
                },
                {"field": "cantidad_total", "headerName": "Cantidad Total", "type": "number"},
            ],
        }
    )


def _drill_tiempos_promedio(periodo, centro, sector, page, page_size):
    """Tiempos promedio de procesamiento por estado."""
    where_clauses = []
    params = []

    where_clauses.append(f"created_at >= {sql_date_relative(days=-periodo)}")

    if centro:
        where_clauses.append("centro = ?")
        params.append(centro)

    if sector:
        where_clauses.append("sector = ?")
        params.append(sector)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Calcular tiempos promedio por estado
        if is_using_postgresql():
            data_query = f"""
                SELECT
                    status,
                    COUNT(*) as cantidad,
                    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as dias_promedio
                FROM solicitud
                {where_sql}
                GROUP BY status
                ORDER BY cantidad DESC
                LIMIT ? OFFSET ?
            """
        else:
            data_query = f"""
                SELECT
                    status,
                    COUNT(*) as cantidad,
                    AVG((JULIANDAY(updated_at) - JULIANDAY(created_at))) as dias_promedio
                FROM solicitud
                {where_sql}
                GROUP BY status
                ORDER BY cantidad DESC
                LIMIT ? OFFSET ?
            """

        offset = (page - 1) * page_size
        cursor.execute(data_query, params + [page_size, offset])
        rows = cursor.fetchall()

        # Contar total
        count_query = f"""
            SELECT COUNT(DISTINCT status) as total
            FROM solicitud
            {where_sql}
        """
        cursor.execute(count_query, params)
        total = row_to_dict(cursor.fetchone()).get("total") or 0

    data = []
    for row in rows:
        d = row_to_dict(row)
        data.append(
            {
                "status": d.get("status"),
                "cantidad": int(d.get("cantidad") or 0),
                "dias_promedio": round(float(d.get("dias_promedio") or 0), 2),
            }
        )

    return jsonify(
        {
            "ok": True,
            "data": data,
            "total": total,
            "metrica": "tiempos_promedio",
            "titulo": "Tiempos Promedio por Estado",
            "columnas": [
                {"field": "status", "headerName": "Estado", "type": "string"},
                {"field": "cantidad", "headerName": "Cantidad", "type": "number"},
                {"field": "dias_promedio", "headerName": "Días Promedio", "type": "number"},
            ],
        }
    )


def _drill_stock_critico(centro, page, page_size):
    """Materiales con stock crítico (bajo punto de pedido o agotado)."""
    try:
        with get_db_connection("sap_data") as conn:
            cursor = conn.cursor()

            where_clauses = ["m.punto_de_pedido > 0"]
            params = []

            if centro:
                where_clauses.append("m.centro = ?")
                params.append(centro)

            where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            # Contar total
            count_query = f"""
                SELECT COUNT(*) as total
                FROM materiales_bbdd m
                LEFT JOIN (
                    SELECT material, centro, SUM(stock) as stock_actual
                    FROM stock
                    GROUP BY material, centro
                ) s ON m.codigo_material = s.material AND m.centro = s.centro
                {where_sql}
                AND (s.stock_actual IS NULL OR s.stock_actual <= m.punto_de_pedido)
            """
            cursor.execute(count_query, params)
            total = row_to_dict(cursor.fetchone()).get("total") or 0

            # Obtener datos paginados
            offset = (page - 1) * page_size
            data_query = f"""
                SELECT
                    m.codigo_material as codigo,
                    m.descripcion_material as descripcion,
                    m.centro,
                    m.punto_de_pedido,
                    COALESCE(s.stock_actual, 0) as stock_actual,
                    m.lote_economico
                FROM materiales_bbdd m
                LEFT JOIN (
                    SELECT material, centro, SUM(stock) as stock_actual
                    FROM stock
                    GROUP BY material, centro
                ) s ON m.codigo_material = s.material AND m.centro = s.centro
                {where_sql}
                AND (s.stock_actual IS NULL OR s.stock_actual <= m.punto_de_pedido)
                ORDER BY stock_actual ASC, punto_de_pedido DESC
                LIMIT ? OFFSET ?
            """
            cursor.execute(data_query, params + [page_size, offset])
            rows = cursor.fetchall()

        data = []
        for row in rows:
            d = row_to_dict(row)
            stock_actual = float(d.get("stock_actual") or 0)
            punto_pedido = float(d.get("punto_de_pedido") or 0)

            criticidad = "AGOTADO" if stock_actual <= 0 else "BAJO"

            data.append(
                {
                    "codigo": d.get("codigo"),
                    "descripcion": d.get("descripcion"),
                    "centro": d.get("centro"),
                    "stock_actual": stock_actual,
                    "punto_de_pedido": punto_pedido,
                    "lote_economico": float(d.get("lote_economico") or 0),
                    "criticidad": criticidad,
                }
            )

        return jsonify(
            {
                "ok": True,
                "data": data,
                "total": total,
                "metrica": "stock_critico",
                "titulo": "Stock Crítico",
                "columnas": [
                    {"field": "codigo", "headerName": "Código", "type": "string"},
                    {"field": "descripcion", "headerName": "Descripción", "type": "string"},
                    {"field": "centro", "headerName": "Centro", "type": "string"},
                    {"field": "stock_actual", "headerName": "Stock Actual", "type": "number"},
                    {"field": "punto_de_pedido", "headerName": "Punto Pedido", "type": "number"},
                    {"field": "lote_economico", "headerName": "Lote Económico", "type": "number"},
                    {"field": "criticidad", "headerName": "Criticidad", "type": "string"},
                ],
            }
        )

    except Exception as e:
        logger.error(f"Error en stock crítico: {e}", exc_info=True)
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "stock_critico_error",
                        "message": "Error al obtener stock crítico",
                    },
                }
            ),
            500,
        )


def _drill_compras_evitadas(periodo, centro, sector, page, page_size):
    """Solicitudes que fueron resueltas con stock existente (compras evitadas)."""
    where_clauses = []
    params = []

    where_clauses.append(f"created_at >= {sql_date_relative(days=-periodo)}")
    where_clauses.append("status = 'approved'")

    if centro:
        where_clauses.append("centro = ?")
        params.append(centro)

    if sector:
        where_clauses.append("sector = ?")
        params.append(sector)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Obtener solicitudes aprobadas
        query = f"""
            SELECT
                id, centro, sector, justificacion, total_monto,
                created_at, data_json
            FROM solicitud
            {where_sql}
        """
        cursor.execute(query, params)
        rows = cursor.fetchall()

    # Filtrar las que se resolvieron con stock
    compras_evitadas = []
    for row in rows:
        d = row_to_dict(row)
        try:
            extra = json.loads(d.get("data_json") or "{}")
            items = extra.get("items", [])

            # Verificar si tiene flag de "resuelto_con_stock" o fuente "stock"
            resuelto_stock = any(
                item.get("fuente") == "stock" or item.get("resuelto_con_stock")
                for item in items
            )

            if resuelto_stock:
                compras_evitadas.append(
                    {
                        "id": d.get("id"),
                        "centro": d.get("centro"),
                        "sector": d.get("sector"),
                        "justificacion": d.get("justificacion"),
                        "total_monto": float(d.get("total_monto") or 0),
                        "created_at": d.get("created_at"),
                        "items_count": len(items),
                    }
                )
        except Exception:
            continue

    # Paginar
    total = len(compras_evitadas)
    offset = (page - 1) * page_size
    data = compras_evitadas[offset : offset + page_size]

    return jsonify(
        {
            "ok": True,
            "data": data,
            "total": total,
            "metrica": "compras_evitadas",
            "titulo": "Compras Evitadas (Resueltas con Stock)",
            "columnas": [
                {"field": "id", "headerName": "ID", "type": "number"},
                {"field": "centro", "headerName": "Centro", "type": "string"},
                {"field": "sector", "headerName": "Sector", "type": "string"},
                {"field": "justificacion", "headerName": "Justificación", "type": "string"},
                {"field": "total_monto", "headerName": "Monto USD", "type": "number"},
                {"field": "created_at", "headerName": "Fecha", "type": "date"},
                {"field": "items_count", "headerName": "Items", "type": "number"},
            ],
        }
    )
