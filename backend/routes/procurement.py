"""
Procurement Routes - SAP Requisitions and Purchase Orders
KPIs de lead times, cumplimiento y costos

Endpoints:
- GET /api/procurement/solpeds - Listar requisiciones
- GET /api/procurement/solpeds/<id> - Detalle de requisicion
- GET /api/procurement/orders - Listar ordenes de compra
- GET /api/procurement/orders/<id> - Detalle de orden
- GET /api/procurement/kpis - KPIs consolidados
- GET /api/procurement/kpis/lead-times - Analisis de tiempos
- GET /api/procurement/kpis/compliance - Cumplimiento entregas
- GET /api/procurement/kpis/costs - Analisis de costos
- POST /api/procurement/import - Importar archivo ZM65
- GET /api/procurement/import/history - Historial de importaciones
"""

import logging
import os
import tempfile
from typing import Any, Dict

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection
from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth, require_role
from backend.core.search_utils import build_description_search_with_catalog
from backend.routes.database import is_postgres

logger = logging.getLogger(__name__)

procurement_bp = Blueprint('procurement', __name__, url_prefix='/api/procurement')


def ensure_procurement_views():
    """Crea vistas SAP de procurement si no existen (idempotente)."""
    if not is_postgres():
        return
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                CREATE OR REPLACE VIEW v_sap_cumplimiento AS
                SELECT
                    p.proveedor_cuit,
                    p.proveedor_nombre,
                    COUNT(*) as total_pedidos,
                    SUM(CASE WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada THEN 1 ELSE 0 END) as entregas_a_tiempo,
                    SUM(CASE WHEN p.cantidad_recepcionada >= p.cantidad_pedida THEN 1 ELSE 0 END) as entregas_completas,
                    SUM(CASE
                        WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
                         AND p.cantidad_recepcionada >= p.cantidad_pedida
                        THEN 1 ELSE 0
                    END) as otif_count,
                    ROUND(100.0 * SUM(CASE WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_a_tiempo,
                    ROUND(100.0 * SUM(CASE WHEN p.cantidad_recepcionada >= p.cantidad_pedida THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_completas,
                    ROUND(100.0 * SUM(CASE
                        WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
                         AND p.cantidad_recepcionada >= p.cantidad_pedida
                        THEN 1 ELSE 0
                    END) / COUNT(*), 1) as pct_otif,
                    SUM(p.valor_pedido) as valor_total_pedido,
                    SUM(p.valor_recibido) as valor_total_recibido
                FROM sap_purchase_orders p
                INNER JOIN sap_solpeds s
                    ON p.solped_id = s.solped_id
                    AND p.solped_posicion = s.posicion
                WHERE p.fecha_recepcion IS NOT NULL
                GROUP BY p.proveedor_cuit, p.proveedor_nombre
            """)
            cur.execute("""
                CREATE OR REPLACE VIEW v_sap_lead_times AS
                SELECT
                    s.material_codigo,
                    s.material_descripcion,
                    p.proveedor_nombre,
                    s.centro,
                    s.solped_id,
                    s.posicion as solped_posicion,
                    p.pedido_id,
                    s.fecha_creacion as fecha_solicitud,
                    p.fecha_pedido,
                    p.fecha_recepcion,
                    s.fecha_entrega_solicitada,
                    EXTRACT(DAY FROM (p.fecha_pedido - s.fecha_creacion))::INTEGER as dias_aprobacion,
                    EXTRACT(DAY FROM (p.fecha_recepcion - p.fecha_pedido))::INTEGER as dias_entrega,
                    EXTRACT(DAY FROM (p.fecha_recepcion - s.fecha_creacion))::INTEGER as dias_total,
                    EXTRACT(DAY FROM (p.fecha_recepcion - s.fecha_entrega_solicitada))::INTEGER as dias_desviacion,
                    s.cantidad,
                    s.precio_unitario,
                    s.importe_total,
                    s.moneda
                FROM sap_solpeds s
                INNER JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id
                    AND s.posicion = p.solped_posicion
                WHERE p.fecha_recepcion IS NOT NULL
                  AND p.fecha_pedido IS NOT NULL
            """)
            cur.execute("""
                CREATE OR REPLACE VIEW v_sap_resumen_centro AS
                SELECT
                    s.centro,
                    COUNT(DISTINCT s.solped_id) as total_solpeds,
                    COUNT(*) as total_items,
                    COUNT(DISTINCT s.material_codigo) as materiales_unicos,
                    COUNT(DISTINCT p.proveedor_cuit) as proveedores_unicos,
                    SUM(CASE WHEN s.estrategia_liberacion = 'LIBERADA' THEN 1 ELSE 0 END) as solpeds_liberadas,
                    SUM(CASE WHEN p.fecha_recepcion IS NOT NULL THEN 1 ELSE 0 END) as items_recibidos,
                    SUM(s.importe_total) as importe_total,
                    AVG(EXTRACT(DAY FROM (p.fecha_recepcion - s.fecha_creacion))::INTEGER) as lead_time_promedio
                FROM sap_solpeds s
                LEFT JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id
                    AND s.posicion = p.solped_posicion
                GROUP BY s.centro
            """)
            cur.execute("""
                CREATE OR REPLACE VIEW v_sap_analisis_costos AS
                SELECT
                    s.material_codigo,
                    s.material_descripcion,
                    p.proveedor_cuit,
                    p.proveedor_nombre,
                    s.moneda,
                    AVG(s.precio_unitario) as precio_promedio,
                    MIN(s.precio_unitario) as precio_minimo,
                    MAX(s.precio_unitario) as precio_maximo,
                    CASE
                        WHEN AVG(s.precio_unitario) > 0
                        THEN ROUND((MAX(s.precio_unitario) - MIN(s.precio_unitario)) / AVG(s.precio_unitario) * 100, 2)
                        ELSE 0
                    END as variacion_pct,
                    SUM(s.cantidad) as cantidad_total,
                    SUM(s.importe_total) as importe_total,
                    COUNT(*) as num_transacciones,
                    MIN(s.fecha_creacion) as primera_transaccion,
                    MAX(s.fecha_creacion) as ultima_transaccion
                FROM sap_solpeds s
                LEFT JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id
                    AND s.posicion = p.solped_posicion
                GROUP BY s.material_codigo, s.material_descripcion, p.proveedor_cuit, p.proveedor_nombre, s.moneda
            """)
            conn.commit()
            logger.info("Procurement views created/verified successfully")
    except Exception as e:
        logger.warning(f"Could not create procurement views: {e}", exc_info=True)


def _row_to_dict(row) -> Dict[str, Any]:
    """Convierte una fila de BD a diccionario."""
    if row is None:
        return {}
    if hasattr(row, 'keys'):
        return dict(row)
    return {}


def _date_diff_sql(col1: str, col2: str) -> str:
    """Genera SQL para diferencia de fechas compatible con PG y SQLite."""
    if is_postgres():
        return f"({col1} - {col2})"
    return f"julianday({col1}) - julianday({col2})"


def _round_avg_sql(expression: str, decimals: int = 1) -> str:
    """Genera SQL para ROUND(AVG(...)) compatible con PG y SQLite."""
    if is_postgres():
        return f"ROUND(AVG({expression})::numeric, {decimals})"
    return f"ROUND(AVG({expression}), {decimals})"


# =============================================================================
# SOLPEDS (Requisiciones SAP)
# =============================================================================

@procurement_bp.route('/solpeds', methods=['GET'])
@require_auth
def get_solpeds():
    """
    Lista requisiciones SAP con filtros y paginacion.

    Query params:
        - page: Pagina (default 1)
        - per_page: Items por pagina (default 50, max 200)
        - centro: Filtrar por centro
        - material: Filtrar por codigo de material
        - estado: Filtrar por estrategia_liberacion
        - fecha_desde: Fecha creacion minima (YYYY-MM-DD)
        - fecha_hasta: Fecha creacion maxima (YYYY-MM-DD)
        - search: Busqueda en material_descripcion
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 200)
        centro = request.args.get('centro')
        material = request.args.get('material')
        estado = request.args.get('estado')
        fecha_desde = request.args.get('fecha_desde')
        fecha_hasta = request.args.get('fecha_hasta')
        search = request.args.get('search')

        offset = (page - 1) * per_page

        # Construir query
        conditions = []
        params = []

        if centro:
            conditions.append("centro = ?")
            params.append(centro)
        if material:
            conditions.append("material_codigo LIKE ?")
            params.append(f"%{material}%")
        if estado:
            conditions.append("estrategia_liberacion = ?")
            params.append(estado)
        if fecha_desde:
            conditions.append("fecha_creacion >= ?")
            params.append(fecha_desde)
        if fecha_hasta:
            conditions.append("fecha_creacion <= ?")
            params.append(fecha_hasta)
        if search:
            s = build_description_search_with_catalog(
                search, ["material_descripcion", "material_codigo"], "material_codigo"
            )
            if s:
                conditions.append(s.where_clause)
                params.extend(s.params)

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        with get_db_connection() as conn:
            cur = conn.cursor()
            # Contar total
            count_query = f"SELECT COUNT(*) FROM sap_solpeds WHERE {where_clause}"
            cur.execute(count_query, params)
            total = cur.fetchone()['count']

            # Obtener datos
            query = f"""
                SELECT * FROM sap_solpeds
                WHERE {where_clause}
                ORDER BY fecha_creacion DESC, solped_id DESC
                LIMIT ? OFFSET ?
            """
            cur.execute(query, params + [per_page, offset])
            rows = cur.fetchall()

        items = [_row_to_dict(r) for r in rows]

        return jsonify({
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_solpeds: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_solpeds: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


@procurement_bp.route('/solpeds/<int:solped_id>', methods=['GET'])
@require_auth
def get_solped_detail(solped_id: int):
    """
    Obtiene detalle de una requisicion y sus posiciones.
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Obtener posiciones de la SOLPED
            cur.execute("""
                SELECT s.*, p.pedido_id, p.fecha_pedido, p.fecha_recepcion,
                       p.proveedor_nombre, p.cantidad_recepcionada, p.valor_recibido
                FROM sap_solpeds s
                LEFT JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id AND s.posicion = p.solped_posicion
                WHERE s.solped_id = ?
                ORDER BY s.posicion
            """, (solped_id,))
            rows = cur.fetchall()

            if not rows:
                return jsonify({"error": "SOLPED no encontrada"}), 404

            items = [_row_to_dict(r) for r in rows]

            # Resumen
            first = items[0]
            summary = {
                "solped_id": solped_id,
                "centro": first.get('centro'),
                "fecha_creacion": first.get('fecha_creacion'),
                "creado_por": first.get('creado_por'),
                "solicitante": first.get('solicitante'),
                "total_posiciones": len(items),
                "total_importe": sum(i.get('importe_total') or 0 for i in items),
                "moneda": first.get('moneda', 'ARP'),
                "estados": list(set(i.get('estrategia_liberacion') for i in items if i.get('estrategia_liberacion')))
            }

        return jsonify({
            "summary": summary,
            "items": items
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_solped_detail: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_solped_detail for solped_id={solped_id}: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


# =============================================================================
# PURCHASE ORDERS (Ordenes de Compra SAP)
# =============================================================================

@procurement_bp.route('/orders', methods=['GET'])
@require_auth
def get_orders():
    """
    Lista ordenes de compra SAP con filtros y paginacion.

    Query params:
        - page, per_page: Paginacion
        - proveedor: Filtrar por CUIT o nombre de proveedor
        - material: Filtrar por codigo de material
        - fecha_desde, fecha_hasta: Rango de fecha de pedido
        - recibido: 'true' para solo pedidos recibidos
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 200)
        proveedor = request.args.get('proveedor')
        material = request.args.get('material')
        fecha_desde = request.args.get('fecha_desde')
        fecha_hasta = request.args.get('fecha_hasta')
        recibido = request.args.get('recibido', '').lower() == 'true'

        offset = (page - 1) * per_page

        conditions = []
        params = []

        if proveedor:
            conditions.append("(proveedor_cuit LIKE ? OR proveedor_nombre LIKE ?)")
            params.extend([f"%{proveedor}%", f"%{proveedor}%"])
        if material:
            conditions.append("material_codigo LIKE ?")
            params.append(f"%{material}%")
        if fecha_desde:
            conditions.append("fecha_pedido >= ?")
            params.append(fecha_desde)
        if fecha_hasta:
            conditions.append("fecha_pedido <= ?")
            params.append(fecha_hasta)
        if recibido:
            conditions.append("fecha_recepcion IS NOT NULL")

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                f"SELECT COUNT(*) FROM sap_purchase_orders WHERE {where_clause}",
                params
            )
            total = cur.fetchone()['count']

            query = f"""
                SELECT * FROM sap_purchase_orders
                WHERE {where_clause}
                ORDER BY fecha_pedido DESC, pedido_id DESC
                LIMIT ? OFFSET ?
            """
            cur.execute(query, params + [per_page, offset])
            rows = cur.fetchall()

        items = [_row_to_dict(r) for r in rows]

        return jsonify({
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_orders: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_orders: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


@procurement_bp.route('/orders/<int:pedido_id>', methods=['GET'])
@require_auth
def get_order_detail(pedido_id: int):
    """Obtiene detalle de una orden de compra."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT p.*, s.material_descripcion, s.fecha_creacion as fecha_solped,
                       s.fecha_entrega_solicitada, s.solicitante
                FROM sap_purchase_orders p
                LEFT JOIN sap_solpeds s
                    ON p.solped_id = s.solped_id AND p.solped_posicion = s.posicion
                WHERE p.pedido_id = ?
            """, (pedido_id,))
            rows = cur.fetchall()

            if not rows:
                return jsonify({"error": "Pedido no encontrado"}), 404

            items = [_row_to_dict(r) for r in rows]
            first = items[0]

            summary = {
                "pedido_id": pedido_id,
                "proveedor_cuit": first.get('proveedor_cuit'),
                "proveedor_nombre": first.get('proveedor_nombre'),
                "fecha_pedido": first.get('fecha_pedido'),
                "fecha_recepcion": first.get('fecha_recepcion'),
                "total_valor": sum(i.get('valor_pedido') or 0 for i in items),
                "total_recibido": sum(i.get('valor_recibido') or 0 for i in items),
                "moneda": first.get('moneda_pedido', 'ARP'),
                "total_items": len(items)
            }

        return jsonify({
            "summary": summary,
            "items": items
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_order_detail: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_order_detail for pedido_id={pedido_id}: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


# =============================================================================
# KPIs
# =============================================================================

@procurement_bp.route('/kpis', methods=['GET'])
@require_auth
def get_kpis():
    """
    Obtiene KPIs consolidados de procurement.

    Query params:
        - centro: Filtrar por centro
        - periodo: 'mes', 'trimestre', 'anio' (default: 'mes')
    """
    try:
        centro = request.args.get('centro')
        periodo = request.args.get('periodo', 'mes')

        # Calcular rango de fechas segun periodo (PostgreSQL syntax)
        fecha_filtro = {
            'mes': "NOW() - INTERVAL '30 days'",
            'trimestre': "NOW() - INTERVAL '90 days'",
            'anio': "NOW() - INTERVAL '365 days'"
        }.get(periodo, "NOW() - INTERVAL '30 days'")

        centro_filter = "AND s.centro = ?" if centro else ""
        params = [centro] if centro else []

        with get_db_connection() as conn:
            cur = conn.cursor()
            # Totales generales
            cur.execute(f"""
                SELECT
                    COUNT(DISTINCT s.solped_id) as total_solpeds,
                    COUNT(*) as total_items,
                    COUNT(DISTINCT s.material_codigo) as materiales_unicos,
                    COUNT(DISTINCT p.proveedor_cuit) as proveedores_unicos,
                    SUM(s.importe_total) as importe_total,
                    SUM(CASE WHEN s.estrategia_liberacion = 'LIBERADA' THEN 1 ELSE 0 END) as solpeds_liberadas,
                    SUM(CASE WHEN p.fecha_recepcion IS NOT NULL THEN 1 ELSE 0 END) as items_recibidos
                FROM sap_solpeds s
                LEFT JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id AND s.posicion = p.solped_posicion
                WHERE s.fecha_creacion >= {fecha_filtro}
                {centro_filter}
            """, params)
            totals = cur.fetchone()

            # Lead time promedio
            cur.execute(f"""
                SELECT
                    AVG(p.fecha_recepcion - s.fecha_creacion) as lead_time_total,
                    AVG(p.fecha_pedido - s.fecha_creacion) as tiempo_aprobacion,
                    AVG(p.fecha_recepcion - p.fecha_pedido) as tiempo_entrega
                FROM sap_solpeds s
                INNER JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id AND s.posicion = p.solped_posicion
                WHERE p.fecha_recepcion IS NOT NULL
                  AND s.fecha_creacion >= {fecha_filtro}
                {centro_filter}
            """, params)
            lead_time = cur.fetchone()

            # OTIF global
            cur.execute(f"""
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada THEN 1 ELSE 0 END) as a_tiempo,
                    SUM(CASE WHEN p.cantidad_recepcionada >= p.cantidad_pedida THEN 1 ELSE 0 END) as completas,
                    SUM(CASE
                        WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
                         AND p.cantidad_recepcionada >= p.cantidad_pedida
                        THEN 1 ELSE 0
                    END) as otif
                FROM sap_purchase_orders p
                INNER JOIN sap_solpeds s
                    ON p.solped_id = s.solped_id AND p.solped_posicion = s.posicion
                WHERE p.fecha_recepcion IS NOT NULL
                  AND s.fecha_creacion >= {fecha_filtro}
                {centro_filter}
            """, params)
            otif = cur.fetchone()

            # Top 5 proveedores por volumen
            cur.execute(f"""
                SELECT
                    p.proveedor_nombre,
                    p.proveedor_cuit,
                    COUNT(*) as pedidos,
                    SUM(p.valor_pedido) as valor_total
                FROM sap_purchase_orders p
                INNER JOIN sap_solpeds s
                    ON p.solped_id = s.solped_id AND p.solped_posicion = s.posicion
                WHERE s.fecha_creacion >= {fecha_filtro}
                  AND p.proveedor_nombre IS NOT NULL
                {centro_filter}
                GROUP BY p.proveedor_cuit, p.proveedor_nombre
                ORDER BY valor_total DESC
                LIMIT 5
            """, params)
            top_proveedores = cur.fetchall()

        totals_dict = _row_to_dict(totals)
        lead_time_dict = _row_to_dict(lead_time)
        otif_dict = _row_to_dict(otif)

        total_otif = otif_dict.get('total', 0) or 1

        return jsonify({
            "periodo": periodo,
            "centro": centro,
            "totales": {
                "solpeds": totals_dict.get('total_solpeds', 0),
                "items": totals_dict.get('total_items', 0),
                "materiales_unicos": totals_dict.get('materiales_unicos', 0),
                "proveedores_unicos": totals_dict.get('proveedores_unicos', 0),
                "importe_total": totals_dict.get('importe_total', 0),
                "pct_liberadas": round(100 * (totals_dict.get('solpeds_liberadas', 0) or 0) / max(totals_dict.get('total_items', 1), 1), 1),
                "pct_recibidas": round(100 * (totals_dict.get('items_recibidos', 0) or 0) / max(totals_dict.get('total_items', 1), 1), 1)
            },
            "lead_times": {
                "total_dias": round(lead_time_dict.get('lead_time_total') or 0, 1),
                "aprobacion_dias": round(lead_time_dict.get('tiempo_aprobacion') or 0, 1),
                "entrega_dias": round(lead_time_dict.get('tiempo_entrega') or 0, 1)
            },
            "cumplimiento": {
                "pct_a_tiempo": round(100 * (otif_dict.get('a_tiempo', 0) or 0) / total_otif, 1),
                "pct_completas": round(100 * (otif_dict.get('completas', 0) or 0) / total_otif, 1),
                "pct_otif": round(100 * (otif_dict.get('otif', 0) or 0) / total_otif, 1)
            },
            "top_proveedores": [_row_to_dict(r) for r in top_proveedores]
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_kpis: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_kpis: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


@procurement_bp.route('/kpis/lead-times', methods=['GET'])
@require_auth
def get_lead_times():
    """
    Analisis detallado de lead times por proveedor y material.

    Query params:
        - centro: Filtrar por centro
        - proveedor: Filtrar por proveedor
        - group_by: 'proveedor', 'material', 'centro' (default: 'proveedor')
    """
    try:
        centro = request.args.get('centro')
        proveedor = request.args.get('proveedor')
        group_by = request.args.get('group_by', 'proveedor')

        conditions = ["p.fecha_recepcion IS NOT NULL"]
        params = []

        if centro:
            conditions.append("s.centro = ?")
            params.append(centro)
        if proveedor:
            conditions.append("(p.proveedor_cuit = ? OR p.proveedor_nombre LIKE ?)")
            params.extend([proveedor, f"%{proveedor}%"])

        where_clause = " AND ".join(conditions)

        # Determinar agrupacion
        group_field = {
            'proveedor': "p.proveedor_nombre, p.proveedor_cuit",
            'material': "s.material_codigo, s.material_descripcion",
            'centro': "s.centro"
        }.get(group_by, "p.proveedor_nombre, p.proveedor_cuit")

        select_field = {
            'proveedor': "p.proveedor_nombre as nombre, p.proveedor_cuit as id",
            'material': "s.material_codigo as id, s.material_descripcion as nombre",
            'centro': "s.centro as id, s.centro as nombre"
        }.get(group_by, "p.proveedor_nombre as nombre, p.proveedor_cuit as id")

        # SQL compatible con PostgreSQL y SQLite
        lead_time_diff = _date_diff_sql('p.fecha_recepcion', 's.fecha_creacion')
        aprobacion_diff = _date_diff_sql('p.fecha_pedido', 's.fecha_creacion')
        entrega_diff = _date_diff_sql('p.fecha_recepcion', 'p.fecha_pedido')

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(f"""
                SELECT
                    {select_field},
                    COUNT(*) as total_entregas,
                    {_round_avg_sql(lead_time_diff)} as lead_time_promedio,
                    MIN({lead_time_diff}) as lead_time_min,
                    MAX({lead_time_diff}) as lead_time_max,
                    {_round_avg_sql(aprobacion_diff)} as tiempo_aprobacion,
                    {_round_avg_sql(entrega_diff)} as tiempo_entrega
                FROM sap_solpeds s
                INNER JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id AND s.posicion = p.solped_posicion
                WHERE {where_clause}
                GROUP BY {group_field}
                ORDER BY lead_time_promedio DESC
                LIMIT 50
            """, params)
            rows = cur.fetchall()

        return jsonify({
            "group_by": group_by,
            "items": [_row_to_dict(r) for r in rows]
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_lead_times: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_lead_times: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


@procurement_bp.route('/kpis/compliance', methods=['GET'])
@require_auth
def get_compliance():
    """
    Analisis de cumplimiento OTIF por proveedor.
    """
    try:
        min_pedidos = request.args.get('min_pedidos', 5, type=int)

        with get_db_connection() as conn:
            cur = conn.cursor()
            # Verificar si la vista existe (compatible SQLite y PostgreSQL)
            try:
                cur.execute("SELECT 1 FROM v_sap_cumplimiento LIMIT 1")
            except Exception:
                return jsonify({"items": [], "message": "Datos SAP no disponibles"})

            cur.execute("""
                SELECT * FROM v_sap_cumplimiento
                WHERE total_pedidos >= ?
                ORDER BY pct_otif DESC
            """, (min_pedidos,))
            rows = cur.fetchall()

        return jsonify({
            "items": [_row_to_dict(r) for r in rows]
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_compliance: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_compliance: {e}", exc_info=True)
        # Retornar vacío en lugar de error 500 para no romper el frontend
        return jsonify({"items": [], "error": "Error interno del servidor"})


@procurement_bp.route('/kpis/costs', methods=['GET'])
@require_auth
def get_costs():
    """
    Analisis de costos por material/proveedor.

    Query params:
        - material: Filtrar por material
        - moneda: Filtrar por moneda (ARP, USD, EUR)
        - min_transacciones: Minimo de transacciones (default 3)
    """
    try:
        material = request.args.get('material')
        moneda = request.args.get('moneda')
        min_trans = request.args.get('min_transacciones', 3, type=int)

        conditions = [f"num_transacciones >= {min_trans}"]
        params = []

        if material:
            s = build_description_search_with_catalog(
                material, ["material_codigo", "material_descripcion"], "material_codigo"
            )
            if s:
                conditions.append(s.where_clause)
                params.extend(s.params)
        if moneda:
            conditions.append("moneda = ?")
            params.append(moneda)

        where_clause = " AND ".join(conditions)

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(f"""
                SELECT * FROM v_sap_analisis_costos
                WHERE {where_clause}
                ORDER BY importe_total DESC
                LIMIT 100
            """, params)
            rows = cur.fetchall()

        return jsonify({
            "items": [_row_to_dict(r) for r in rows]
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_costs: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_costs: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


# =============================================================================
# IMPORTACION
# =============================================================================

@procurement_bp.route('/import', methods=['POST'])
@require_auth
@require_role(['Admin', 'Administrador', 'Planificador'])
def import_zm65():
    """
    Importar archivo ZM65.xlsx

    Espera multipart/form-data con campo 'file' conteniendo el Excel.
    Retorna estadisticas de importacion.
    """
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No se envio archivo"}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({"error": "Nombre de archivo vacio"}), 400

        if not file.filename.endswith(('.xlsx', '.xls')):
            return jsonify({"error": "Formato de archivo no soportado. Use .xlsx"}), 400

        # Guardar archivo temporal
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        try:
            # Importar
            from backend.scripts.import_zm65 import ZM65Importer

            user_id = _get_user_id()
            importer = ZM65Importer(verbose=True)
            stats = importer.import_file(tmp_path, user_id=user_id)

            return jsonify({
                "success": True,
                "message": "Importacion completada",
                "stats": stats
            })

        finally:
            # Limpiar archivo temporal
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in import_zm65: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in import_zm65: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


@procurement_bp.route('/import/history', methods=['GET'])
@require_auth
def get_import_history():
    """Obtiene historial de importaciones."""
    try:
        limit = request.args.get('limit', 20, type=int)

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM sap_import_log
                ORDER BY started_at DESC
                LIMIT ?
            """, (limit,))
            rows = cur.fetchall()

        return jsonify({
            "items": [_row_to_dict(r) for r in rows]
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_import_history: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_import_history: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


# =============================================================================
# RESUMEN Y PIPELINE
# =============================================================================

@procurement_bp.route('/summary', methods=['GET'])
@require_auth
def get_summary():
    """Obtiene resumen por centro."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM v_sap_resumen_centro")
            rows = cur.fetchall()

        return jsonify({
            "items": [_row_to_dict(r) for r in rows]
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_summary: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_summary: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


@procurement_bp.route('/pipeline', methods=['GET'])
@require_auth
def get_pipeline():
    """Obtiene pipeline de conversion (embudo)."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM v_sap_pipeline ORDER BY orden")
            rows = cur.fetchall()

        return jsonify([_row_to_dict(r) for r in rows])

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_pipeline: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_pipeline: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


# =============================================================================
# ANALYTICS - Impacto en Produccion
# =============================================================================

@procurement_bp.route('/analytics', methods=['GET'])
@require_auth
def get_procurement_analytics():
    """
    Analisis consolidado del impacto de procurement en produccion.

    Retorna metricas de volumenes, lead times, cumplimiento OTIF,
    top proveedores e historial de importaciones.
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            # 1. Volumenes actuales
            cur.execute("""
                SELECT
                    COUNT(*) as total_solpeds,
                    COUNT(DISTINCT material_codigo) as materiales_unicos,
                    COUNT(DISTINCT centro) as centros
                FROM sap_solpeds
            """)
            solpeds_stats = cur.fetchone()

            cur.execute("""
                SELECT
                    COUNT(*) as total_orders,
                    COUNT(DISTINCT proveedor_cuit) as proveedores,
                    SUM(CASE WHEN fecha_recepcion IS NOT NULL THEN 1 ELSE 0 END) as recibidos,
                    SUM(valor_pedido) as valor_total
                FROM sap_purchase_orders
            """)
            orders_stats = cur.fetchone()

            # 2. Lead times (SQL compatible con PG y SQLite)
            date_diff = _date_diff_sql('fecha_recepcion', 'fecha_creacion')
            cur.execute(f"""
                SELECT
                    {_round_avg_sql(date_diff)} as promedio,
                    MIN({date_diff}) as minimo,
                    MAX({date_diff}) as maximo
                FROM v_sap_lead_times
            """)
            lead_times = cur.fetchone()

            # 3. Cumplimiento OTIF (SQL compatible con PG y SQLite)
            cur.execute(f"""
                SELECT
                    COUNT(*) as total,
                    {_round_avg_sql('pct_a_tiempo')} as avg_a_tiempo,
                    {_round_avg_sql('pct_completas')} as avg_completas,
                    {_round_avg_sql('pct_otif')} as avg_otif
                FROM v_sap_cumplimiento
            """)
            cumplimiento = cur.fetchone()

            # 4. Pipeline
            cur.execute("SELECT etapa, cantidad, porcentaje FROM v_sap_pipeline ORDER BY orden")
            pipeline = cur.fetchall()

            # 5. Top 5 proveedores por volumen
            cur.execute("""
                SELECT
                    proveedor_nombre,
                    proveedor_cuit,
                    total_pedidos,
                    pct_completas,
                    pct_a_tiempo
                FROM v_sap_cumplimiento
                ORDER BY total_pedidos DESC
                LIMIT 5
            """)
            top_proveedores = cur.fetchall()

            # 6. Top 5 proveedores por lead time (mas rapidos, SQL compatible)
            cur.execute(f"""
                SELECT
                    proveedor_nombre,
                    COUNT(*) as entregas,
                    {_round_avg_sql(date_diff)} as lead_time_promedio
                FROM v_sap_lead_times
                WHERE proveedor_nombre IS NOT NULL
                GROUP BY proveedor_nombre
                HAVING COUNT(*) >= 3
                ORDER BY lead_time_promedio ASC
                LIMIT 5
            """)
            proveedores_rapidos = cur.fetchall()

            # 7. Distribucion por centro
            cur.execute("""
                SELECT centro, total_solpeds, total_items, materiales_unicos
                FROM v_sap_resumen_centro
                ORDER BY total_solpeds DESC
            """)
            por_centro = cur.fetchall()

            # 8. Historial de importaciones
            cur.execute("""
                SELECT
                    COUNT(*) as total_imports,
                    MAX(started_at) as ultima_importacion,
                    SUM(records_inserted) as total_insertados,
                    SUM(records_error) as total_errores
                FROM sap_import_log
            """)
            imports = cur.fetchone()

        return jsonify({
            "volumenes": {
                "solpeds": solpeds_stats.get('total_solpeds', 0) if solpeds_stats else 0,
                "orders": orders_stats.get('total_orders', 0) if orders_stats else 0,
                "recibidos": orders_stats.get('recibidos', 0) if orders_stats else 0,
                "proveedores": orders_stats.get('proveedores', 0) if orders_stats else 0,
                "materiales": solpeds_stats.get('materiales_unicos', 0) if solpeds_stats else 0,
                "centros": solpeds_stats.get('centros', 0) if solpeds_stats else 0,
                "valor_total": float(orders_stats.get('valor_total') or 0) if orders_stats else 0
            },
            "lead_times": {
                "promedio": float(lead_times.get('promedio') or 0) if lead_times else 0,
                "minimo": int(lead_times.get('minimo') or 0) if lead_times else 0,
                "maximo": int(lead_times.get('maximo') or 0) if lead_times else 0
            },
            "cumplimiento": {
                "proveedores_evaluados": cumplimiento.get('total', 0) if cumplimiento else 0,
                "pct_a_tiempo": float(cumplimiento.get('avg_a_tiempo') or 0) if cumplimiento else 0,
                "pct_completas": float(cumplimiento.get('avg_completas') or 0) if cumplimiento else 0,
                "pct_otif": float(cumplimiento.get('avg_otif') or 0) if cumplimiento else 0,
                "objetivo_otif": 85.0
            },
            "pipeline": [_row_to_dict(r) for r in pipeline],
            "top_proveedores_volumen": [_row_to_dict(r) for r in top_proveedores],
            "proveedores_mas_rapidos": [_row_to_dict(r) for r in proveedores_rapidos],
            "distribucion_centros": [_row_to_dict(r) for r in por_centro],
            "importaciones": {
                "total": imports.get('total_imports', 0) if imports else 0,
                "ultima": str(imports.get('ultima_importacion', '')) if imports and imports.get('ultima_importacion') else None,
                "registros_insertados": imports.get('total_insertados', 0) if imports else 0,
                "errores": imports.get('total_errores', 0) if imports else 0
            }
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_procurement_analytics: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_procurement_analytics: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


# =============================================================================
# SCORECARD Y HISTORIAL DE PRECIOS
# =============================================================================

@procurement_bp.route('/scorecard/<proveedor>', methods=['GET'])
@require_auth
def get_provider_scorecard(proveedor):
    """
    Genera scorecard consolidado de un proveedor.

    Path params:
        - proveedor: CUIT o nombre del proveedor

    Query params:
        - periodo: 'mes', 'trimestre', 'anio' (default: 'anio')

    Returns:
        Scorecard con métricas de cumplimiento, lead time, calidad y costos
    """
    try:
        periodo = request.args.get('periodo', 'anio')

        fecha_filtro = {
            'mes': "NOW() - INTERVAL '30 days'",
            'trimestre': "NOW() - INTERVAL '90 days'",
            'anio': "NOW() - INTERVAL '365 days'"
        }.get(periodo, "NOW() - INTERVAL '365 days'")

        with get_db_connection() as conn:
            cur = conn.cursor()

            # Información general del proveedor
            cur.execute("""
                SELECT
                    p.proveedor_cuit,
                    p.proveedor_nombre,
                    COUNT(DISTINCT p.pedido_id) as total_pedidos,
                    COUNT(DISTINCT s.solped_id) as total_solpeds,
                    COUNT(DISTINCT s.material_codigo) as materiales_unicos,
                    COUNT(DISTINCT s.centro) as centros_atendidos,
                    MIN(s.fecha_creacion) as primera_transaccion,
                    MAX(s.fecha_creacion) as ultima_transaccion,
                    SUM(p.valor_pedido) as valor_total_pedido,
                    SUM(p.valor_recibido) as valor_total_recibido
                FROM sap_purchase_orders p
                INNER JOIN sap_solpeds s
                    ON p.solped_id = s.solped_id AND p.solped_posicion = s.posicion
                WHERE (p.proveedor_cuit = ? OR p.proveedor_nombre LIKE ?)
                GROUP BY p.proveedor_cuit, p.proveedor_nombre
            """, (proveedor, f"%{proveedor}%"))
            info_row = cur.fetchone()

            if not info_row:
                return jsonify({"error": "Proveedor no encontrado"}), 404

            info = _row_to_dict(info_row)

            # Métricas de cumplimiento (OTIF)
            lead_time_diff = _date_diff_sql('p.fecha_recepcion', 's.fecha_creacion')
            aprobacion_diff = _date_diff_sql('p.fecha_pedido', 's.fecha_creacion')
            entrega_diff = _date_diff_sql('p.fecha_recepcion', 'p.fecha_pedido')

            cur.execute(f"""
                SELECT
                    COUNT(*) as total_entregas,
                    SUM(CASE WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada THEN 1 ELSE 0 END) as a_tiempo,
                    SUM(CASE WHEN p.cantidad_recepcionada >= p.cantidad_pedida THEN 1 ELSE 0 END) as completas,
                    SUM(CASE
                        WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
                         AND p.cantidad_recepcionada >= p.cantidad_pedida
                        THEN 1 ELSE 0
                    END) as otif,
                    {_round_avg_sql(lead_time_diff)} as lead_time_promedio,
                    MIN({lead_time_diff}) as lead_time_min,
                    MAX({lead_time_diff}) as lead_time_max,
                    {_round_avg_sql(aprobacion_diff)} as tiempo_aprobacion,
                    {_round_avg_sql(entrega_diff)} as tiempo_entrega
                FROM sap_purchase_orders p
                INNER JOIN sap_solpeds s
                    ON p.solped_id = s.solped_id AND p.solped_posicion = s.posicion
                WHERE (p.proveedor_cuit = ? OR p.proveedor_nombre LIKE ?)
                  AND p.fecha_recepcion IS NOT NULL
                  AND s.fecha_creacion >= {fecha_filtro}
            """, (proveedor, f"%{proveedor}%"))
            cumplimiento_row = cur.fetchone()
            cumplimiento = _row_to_dict(cumplimiento_row)

            total_entregas = cumplimiento.get('total_entregas', 0) or 1

            # Top materiales del proveedor
            cur.execute(f"""
                SELECT
                    s.material_codigo,
                    s.material_descripcion,
                    COUNT(*) as pedidos,
                    SUM(s.cantidad) as cantidad_total,
                    SUM(s.importe_total) as importe_total,
                    {_round_avg_sql('s.precio_unitario')} as precio_promedio
                FROM sap_solpeds s
                INNER JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id AND s.posicion = p.solped_posicion
                WHERE (p.proveedor_cuit = ? OR p.proveedor_nombre LIKE ?)
                  AND s.fecha_creacion >= {fecha_filtro}
                GROUP BY s.material_codigo, s.material_descripcion
                ORDER BY importe_total DESC
                LIMIT 10
            """, (proveedor, f"%{proveedor}%"))
            top_materiales = [_row_to_dict(r) for r in cur.fetchall()]

        # Calcular scores (0-100)
        pct_a_tiempo = round(100 * (cumplimiento.get('a_tiempo', 0) or 0) / total_entregas, 1)
        pct_completas = round(100 * (cumplimiento.get('completas', 0) or 0) / total_entregas, 1)
        pct_otif = round(100 * (cumplimiento.get('otif', 0) or 0) / total_entregas, 1)

        # Score general ponderado
        score_general = round(pct_otif * 0.5 + pct_a_tiempo * 0.3 + pct_completas * 0.2, 1)

        return jsonify({
            "proveedor": {
                "cuit": info.get('proveedor_cuit'),
                "nombre": info.get('proveedor_nombre'),
                "primera_transaccion": str(info.get('primera_transaccion', '')),
                "ultima_transaccion": str(info.get('ultima_transaccion', '')),
                "total_pedidos": info.get('total_pedidos', 0),
                "total_solpeds": info.get('total_solpeds', 0),
                "materiales_unicos": info.get('materiales_unicos', 0),
                "centros_atendidos": info.get('centros_atendidos', 0),
                "valor_total_pedido": float(info.get('valor_total_pedido') or 0),
                "valor_total_recibido": float(info.get('valor_total_recibido') or 0)
            },
            "scorecard": {
                "score_general": score_general,
                "pct_a_tiempo": pct_a_tiempo,
                "pct_completas": pct_completas,
                "pct_otif": pct_otif,
                "total_entregas_evaluadas": cumplimiento.get('total_entregas', 0)
            },
            "lead_times": {
                "promedio": float(cumplimiento.get('lead_time_promedio') or 0),
                "minimo": int(cumplimiento.get('lead_time_min') or 0),
                "maximo": int(cumplimiento.get('lead_time_max') or 0),
                "aprobacion": float(cumplimiento.get('tiempo_aprobacion') or 0),
                "entrega": float(cumplimiento.get('tiempo_entrega') or 0)
            },
            "top_materiales": top_materiales,
            "periodo": periodo
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_provider_scorecard: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_provider_scorecard for proveedor={proveedor}: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


@procurement_bp.route('/price-history/<material_codigo>', methods=['GET'])
@require_auth
def get_price_history(material_codigo):
    """
    Obtiene historial de precios de un material a través de compras SAP.

    Path params:
        - material_codigo: Código del material

    Query params:
        - centro: Filtrar por centro (opcional)
        - moneda: Filtrar por moneda (opcional)
        - limit: Máximo de registros (default: 50, max: 200)

    Returns:
        Historial de precios con tendencia y estadísticas
    """
    try:
        centro = request.args.get('centro')
        moneda = request.args.get('moneda')
        limit = min(request.args.get('limit', 50, type=int), 200)

        conditions = ["s.material_codigo = ?"]
        params = [material_codigo]

        if centro:
            conditions.append("s.centro = ?")
            params.append(centro)
        if moneda:
            conditions.append("s.moneda = ?")
            params.append(moneda)

        where_clause = " AND ".join(conditions)

        with get_db_connection() as conn:
            cur = conn.cursor()

            # Historial de precios
            cur.execute(f"""
                SELECT
                    s.fecha_creacion,
                    s.precio_unitario,
                    s.cantidad,
                    s.importe_total,
                    s.moneda,
                    s.centro,
                    s.solped_id,
                    s.posicion,
                    p.proveedor_nombre,
                    p.proveedor_cuit,
                    p.pedido_id,
                    p.fecha_pedido,
                    p.fecha_recepcion
                FROM sap_solpeds s
                LEFT JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id AND s.posicion = p.solped_posicion
                WHERE {where_clause}
                ORDER BY s.fecha_creacion DESC
                LIMIT ?
            """, params + [limit])
            rows = cur.fetchall()

            if not rows:
                return jsonify({
                    "material": material_codigo,
                    "historial": [],
                    "estadisticas": {},
                    "message": "Sin historial de precios para este material"
                })

            historial = [_row_to_dict(r) for r in rows]

            # Estadísticas de precios
            cur.execute(f"""
                SELECT
                    s.material_descripcion,
                    COUNT(*) as num_transacciones,
                    AVG(s.precio_unitario) as precio_promedio,
                    MIN(s.precio_unitario) as precio_minimo,
                    MAX(s.precio_unitario) as precio_maximo,
                    SUM(s.cantidad) as cantidad_total,
                    SUM(s.importe_total) as importe_total,
                    COUNT(DISTINCT p.proveedor_cuit) as proveedores_unicos,
                    MIN(s.fecha_creacion) as primera_compra,
                    MAX(s.fecha_creacion) as ultima_compra
                FROM sap_solpeds s
                LEFT JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id AND s.posicion = p.solped_posicion
                WHERE {where_clause}
            """, params)
            stats_row = cur.fetchone()
            stats = _row_to_dict(stats_row)

            # Precios por proveedor
            cur.execute(f"""
                SELECT
                    p.proveedor_nombre,
                    p.proveedor_cuit,
                    COUNT(*) as transacciones,
                    AVG(s.precio_unitario) as precio_promedio,
                    MIN(s.precio_unitario) as precio_minimo,
                    MAX(s.precio_unitario) as precio_maximo
                FROM sap_solpeds s
                INNER JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id AND s.posicion = p.solped_posicion
                WHERE {where_clause}
                  AND p.proveedor_nombre IS NOT NULL
                GROUP BY p.proveedor_nombre, p.proveedor_cuit
                ORDER BY precio_promedio ASC
            """, params)
            por_proveedor = [_row_to_dict(r) for r in cur.fetchall()]

        precio_promedio = float(stats.get('precio_promedio') or 0)
        precio_min = float(stats.get('precio_minimo') or 0)
        precio_max = float(stats.get('precio_maximo') or 0)
        variacion_pct = round(
            ((precio_max - precio_min) / precio_promedio * 100) if precio_promedio > 0 else 0, 2
        )

        return jsonify({
            "material": material_codigo,
            "descripcion": stats.get('material_descripcion', ''),
            "historial": historial,
            "estadisticas": {
                "num_transacciones": stats.get('num_transacciones', 0),
                "precio_promedio": round(precio_promedio, 2),
                "precio_minimo": round(precio_min, 2),
                "precio_maximo": round(precio_max, 2),
                "variacion_pct": variacion_pct,
                "cantidad_total": float(stats.get('cantidad_total') or 0),
                "importe_total": float(stats.get('importe_total') or 0),
                "proveedores_unicos": stats.get('proveedores_unicos', 0),
                "primera_compra": str(stats.get('primera_compra', '')),
                "ultima_compra": str(stats.get('ultima_compra', ''))
            },
            "precios_por_proveedor": por_proveedor
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_price_history: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_price_history for material={material_codigo}: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


# ============================================================================
# Ranking de Proveedores
# ============================================================================


@procurement_bp.route('/ranking', methods=['GET'])
@require_auth
def get_provider_ranking():
    """
    Ranking de proveedores por score OTIF consolidado.

    Query params:
        - limit: Máximo de proveedores (default: 20, max: 100)
        - periodo: 'mes', 'trimestre', 'anio' (default: 'anio')
        - centro: Filtrar por centro (opcional)

    Returns:
        Lista de proveedores ordenados por score general descendente
    """
    try:
        limit = min(request.args.get('limit', 20, type=int), 100)
        periodo = request.args.get('periodo', 'anio')
        centro = request.args.get('centro')

        fecha_filtro = {
            'mes': "NOW() - INTERVAL '30 days'",
            'trimestre': "NOW() - INTERVAL '90 days'",
            'anio': "NOW() - INTERVAL '365 days'"
        }.get(periodo, "NOW() - INTERVAL '365 days'")

        centro_clause = ""
        params = []
        if centro:
            centro_clause = "AND s.centro = ?"
            params.append(centro)

        with get_db_connection() as conn:
            cur = conn.cursor()

            cur.execute(f"""
                SELECT
                    p.proveedor_cuit,
                    p.proveedor_nombre,
                    COUNT(DISTINCT p.pedido_id) as total_pedidos,
                    COUNT(DISTINCT s.material_codigo) as materiales_unicos,
                    SUM(p.valor_pedido) as valor_total,
                    SUM(CASE WHEN p.fecha_recepcion IS NOT NULL THEN 1 ELSE 0 END) as entregas_realizadas,
                    SUM(CASE
                        WHEN p.fecha_recepcion IS NOT NULL
                         AND p.fecha_recepcion <= s.fecha_entrega_solicitada
                        THEN 1 ELSE 0
                    END) as entregas_a_tiempo,
                    SUM(CASE
                        WHEN p.fecha_recepcion IS NOT NULL
                         AND p.cantidad_recepcionada >= p.cantidad_pedida
                        THEN 1 ELSE 0
                    END) as entregas_completas,
                    SUM(CASE
                        WHEN p.fecha_recepcion IS NOT NULL
                         AND p.fecha_recepcion <= s.fecha_entrega_solicitada
                         AND p.cantidad_recepcionada >= p.cantidad_pedida
                        THEN 1 ELSE 0
                    END) as entregas_otif,
                    {_round_avg_sql(_date_diff_sql('p.fecha_recepcion', 'p.fecha_pedido'))} as lead_time_promedio
                FROM sap_purchase_orders p
                INNER JOIN sap_solpeds s
                    ON p.solped_id = s.solped_id AND p.solped_posicion = s.posicion
                WHERE s.fecha_creacion >= {fecha_filtro}
                  {centro_clause}
                GROUP BY p.proveedor_cuit, p.proveedor_nombre
                HAVING COUNT(DISTINCT p.pedido_id) >= 3
                ORDER BY total_pedidos DESC
                LIMIT ?
            """, params + [limit])

            rows = cur.fetchall()

        ranking = []
        for row in rows:
            r = _row_to_dict(row)
            entregas = max(r.get('entregas_realizadas', 0) or 0, 1)
            pct_a_tiempo = round(100 * (r.get('entregas_a_tiempo', 0) or 0) / entregas, 1)
            pct_completas = round(100 * (r.get('entregas_completas', 0) or 0) / entregas, 1)
            pct_otif = round(100 * (r.get('entregas_otif', 0) or 0) / entregas, 1)
            score = round(pct_otif * 0.5 + pct_a_tiempo * 0.3 + pct_completas * 0.2, 1)

            ranking.append({
                'proveedor_cuit': r.get('proveedor_cuit'),
                'proveedor_nombre': r.get('proveedor_nombre'),
                'score_general': score,
                'pct_otif': pct_otif,
                'pct_a_tiempo': pct_a_tiempo,
                'pct_completas': pct_completas,
                'total_pedidos': r.get('total_pedidos', 0),
                'materiales_unicos': r.get('materiales_unicos', 0),
                'valor_total': float(r.get('valor_total') or 0),
                'lead_time_promedio': float(r.get('lead_time_promedio') or 0),
            })

        ranking.sort(key=lambda x: x['score_general'], reverse=True)

        for idx, prov in enumerate(ranking, 1):
            prov['posicion'] = idx

        return jsonify({
            "ok": True,
            "data": {
                "ranking": ranking,
                "total": len(ranking),
                "periodo": periodo,
            }
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_provider_ranking: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_provider_ranking: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


@procurement_bp.route('/comparar', methods=['GET', 'POST'])
@require_auth
def comparar_proveedores():
    """
    Compara proveedores.

    GET - Compara proveedores para un material específico:
        Query params:
            - material: Código del material (requerido)
            - centro: Centro (opcional)

    POST - Compara proveedores side-by-side por IDs:
        JSON body:
            - proveedor_ids: list[str] (2-5 IDs, requerido)

    Returns:
        Proveedores con sus métricas comparadas
    """
    if request.method == 'POST':
        return _comparar_proveedores_side_by_side()

    material_codigo = request.args.get('material')
    if not material_codigo:
        return jsonify({"error": "Parámetro 'material' es requerido"}), 400

    centro = request.args.get('centro')

    try:
        centro_clause = ""
        params = [material_codigo]
        if centro:
            centro_clause = "AND s.centro = ?"
            params.append(centro)

        with get_db_connection() as conn:
            cur = conn.cursor()

            cur.execute(f"""
                SELECT
                    p.proveedor_cuit,
                    p.proveedor_nombre,
                    COUNT(*) as transacciones,
                    AVG(s.precio_unitario) as precio_promedio,
                    MIN(s.precio_unitario) as precio_min,
                    MAX(s.precio_unitario) as precio_max,
                    SUM(s.cantidad) as cantidad_total,
                    {_round_avg_sql(_date_diff_sql('p.fecha_recepcion', 'p.fecha_pedido'))} as lead_time_promedio,
                    SUM(CASE
                        WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
                        THEN 1 ELSE 0
                    END) as a_tiempo,
                    MAX(s.fecha_creacion) as ultima_compra
                FROM sap_solpeds s
                INNER JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id AND s.posicion = p.solped_posicion
                WHERE s.material_codigo = ?
                  {centro_clause}
                  AND p.proveedor_nombre IS NOT NULL
                GROUP BY p.proveedor_cuit, p.proveedor_nombre
                ORDER BY precio_promedio ASC
            """, params)

            rows = cur.fetchall()

        proveedores = []
        for row in rows:
            r = _row_to_dict(row)
            total = max(r.get('transacciones', 0) or 0, 1)
            pct_a_tiempo = round(100 * (r.get('a_tiempo', 0) or 0) / total, 1)

            proveedores.append({
                'proveedor_cuit': r.get('proveedor_cuit'),
                'proveedor_nombre': r.get('proveedor_nombre'),
                'precio_promedio': round(float(r.get('precio_promedio') or 0), 2),
                'precio_min': round(float(r.get('precio_min') or 0), 2),
                'precio_max': round(float(r.get('precio_max') or 0), 2),
                'transacciones': r.get('transacciones', 0),
                'cantidad_total': float(r.get('cantidad_total') or 0),
                'lead_time_promedio': float(r.get('lead_time_promedio') or 0),
                'pct_a_tiempo': pct_a_tiempo,
                'ultima_compra': str(r.get('ultima_compra', '')),
            })

        return jsonify({
            "ok": True,
            "data": {
                "material": material_codigo,
                "proveedores": proveedores,
                "total": len(proveedores),
            }
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in comparar_proveedores: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in comparar_proveedores: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


def _comparar_proveedores_side_by_side():
    """
    Compara proveedores side-by-side por IDs.

    JSON body:
        - proveedor_ids: list[str] (2-5 IDs)

    Returns:
        Lista de proveedores con scorecard completo y historial 12 meses
    """
    data = request.get_json() or {}
    proveedor_ids = data.get('proveedor_ids', [])

    if not proveedor_ids or len(proveedor_ids) < 2:
        return jsonify({"error": "Se requieren al menos 2 proveedores"}), 400
    if len(proveedor_ids) > 5:
        return jsonify({"error": "Máximo 5 proveedores para comparar"}), 400

    try:
        resultados = []

        for prov_id in proveedor_ids:
            prov_data = {
                'proveedor_id': prov_id,
                'nombre': prov_id,
                'scorecard': None,
                'historial_12m': [],
            }

            with get_db_connection() as conn:
                cur = conn.cursor()

                # Try persistent scorecard first
                cur.execute("""
                    SELECT proveedor_nombre, calidad_score, entrega_score,
                           precio_score, servicio_score, score_global, periodo
                    FROM proveedor_evaluacion
                    WHERE proveedor_id = ?
                    ORDER BY created_at DESC LIMIT 1
                """, (prov_id,))
                eval_row = cur.fetchone()

                if eval_row:
                    d = dict(eval_row)
                    prov_data['nombre'] = d.get('proveedor_nombre', prov_id)
                    prov_data['scorecard'] = {
                        'calidad_score': float(d.get('calidad_score') or 0),
                        'entrega_score': float(d.get('entrega_score') or 0),
                        'precio_score': float(d.get('precio_score') or 0),
                        'servicio_score': float(d.get('servicio_score') or 0),
                        'score_global': float(d.get('score_global') or 0),
                        'periodo': d.get('periodo'),
                    }
                else:
                    # Fallback: compute from SAP data
                    lead_time_diff = _date_diff_sql(
                        'p.fecha_recepcion', 'p.fecha_pedido'
                    )
                    cur.execute(f"""
                        SELECT
                            p.proveedor_nombre,
                            COUNT(DISTINCT p.pedido_id) as total_pedidos,
                            SUM(CASE
                                WHEN p.fecha_recepcion IS NOT NULL
                                 AND p.fecha_recepcion <= s.fecha_entrega_solicitada
                                THEN 1 ELSE 0
                            END) as entregas_a_tiempo,
                            SUM(CASE
                                WHEN p.fecha_recepcion IS NOT NULL
                                 AND p.cantidad_recepcionada >= p.cantidad_pedida
                                THEN 1 ELSE 0
                            END) as entregas_completas,
                            SUM(CASE
                                WHEN p.fecha_recepcion IS NOT NULL
                                THEN 1 ELSE 0
                            END) as entregas_realizadas,
                            {_round_avg_sql(lead_time_diff)} as lead_time_promedio
                        FROM sap_purchase_orders p
                        INNER JOIN sap_solpeds s
                            ON p.solped_id = s.solped_id
                            AND p.solped_posicion = s.posicion
                        WHERE p.proveedor_cuit = ?
                           OR p.proveedor_nombre = ?
                        GROUP BY p.proveedor_nombre
                    """, (prov_id, prov_id))
                    sap_row = cur.fetchone()

                    if sap_row:
                        r = dict(sap_row)
                        prov_data['nombre'] = r.get(
                            'proveedor_nombre', prov_id
                        )
                        entregas = max(
                            r.get('entregas_realizadas', 0) or 0, 1
                        )
                        pct_a_tiempo = round(
                            100 * (r.get('entregas_a_tiempo', 0) or 0)
                            / entregas, 1
                        )
                        pct_completas = round(
                            100 * (r.get('entregas_completas', 0) or 0)
                            / entregas, 1
                        )
                        prov_data['scorecard'] = {
                            'entrega_score': pct_a_tiempo,
                            'calidad_score': pct_completas,
                            'precio_score': 0,
                            'servicio_score': 0,
                            'score_global': round(
                                pct_a_tiempo * 0.5 + pct_completas * 0.3,
                                1
                            ),
                            'lead_time_promedio': float(
                                r.get('lead_time_promedio') or 0
                            ),
                            'total_pedidos': r.get('total_pedidos', 0),
                        }

                # Historial 12 meses
                cur.execute("""
                    SELECT periodo, calidad_score, entrega_score, precio_score,
                           servicio_score, score_global
                    FROM proveedor_evaluacion
                    WHERE proveedor_id = ?
                    ORDER BY periodo DESC
                    LIMIT 12
                """, (prov_id,))
                hist_rows = cur.fetchall()
                prov_data['historial_12m'] = [
                    dict(row) for row in hist_rows
                ]

            resultados.append(prov_data)

        return jsonify({
            "ok": True,
            "data": {
                "proveedores": resultados,
                "total": len(resultados),
            }
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in _comparar_proveedores_side_by_side: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in _comparar_proveedores_side_by_side: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


# ============================================================================
# Scorecard Persistente (Sprint 39)
# ============================================================================


@procurement_bp.route('/scorecard/ranking', methods=['GET'])
@require_auth
def get_scorecard_ranking():
    """
    Ranking de proveedores con scorecard persistente (evaluaciones históricas).

    Query params:
        - limit: Máximo de proveedores (default: 50)
        - periodo: Filtrar por periodo (formato YYYY-MM, opcional)

    Returns:
        {ok: true, ranking: [...]}
    """
    try:
        limit = min(request.args.get('limit', 50, type=int), 200)
        periodo = request.args.get('periodo')

        with get_db_connection() as conn:
            cur = conn.cursor()

            # Get latest evaluation per provider
            if periodo:
                cur.execute("""
                    SELECT proveedor_id, proveedor_nombre,
                           calidad_score, entrega_score, precio_score,
                           servicio_score, score_global, periodo, created_at
                    FROM proveedor_evaluacion
                    WHERE periodo = ?
                    ORDER BY score_global DESC
                    LIMIT ?
                """, (periodo, limit))
            else:
                cur.execute("""
                    SELECT pe.proveedor_id, pe.proveedor_nombre,
                           pe.calidad_score, pe.entrega_score, pe.precio_score,
                           pe.servicio_score, pe.score_global, pe.periodo, pe.created_at
                    FROM proveedor_evaluacion pe
                    INNER JOIN (
                        SELECT proveedor_id, MAX(created_at) as max_created
                        FROM proveedor_evaluacion
                        GROUP BY proveedor_id
                    ) latest ON pe.proveedor_id = latest.proveedor_id
                              AND pe.created_at = latest.max_created
                    ORDER BY pe.score_global DESC
                    LIMIT ?
                """, (limit,))

            rows = cur.fetchall()

        ranking = []
        for row in rows:
            d = dict(row)
            # Calculate tendencia (diff with previous period)
            tendencia = None
            try:
                with get_db_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("""
                        SELECT score_global FROM proveedor_evaluacion
                        WHERE proveedor_id = ? AND created_at < ?
                        ORDER BY created_at DESC LIMIT 1
                    """, (d['proveedor_id'], d['created_at']))
                    prev = cur.fetchone()
                    if prev:
                        tendencia = round(float(d.get('score_global') or 0) - float(prev['score_global'] or 0), 1)
            except Exception:
                pass

            ranking.append({
                'proveedor_id': d.get('proveedor_id'),
                'nombre': d.get('proveedor_nombre'),
                'score_global': float(d.get('score_global') or 0),
                'entrega_score': float(d.get('entrega_score') or 0),
                'calidad_score': float(d.get('calidad_score') or 0),
                'precio_score': float(d.get('precio_score') or 0),
                'servicio_score': float(d.get('servicio_score') or 0),
                'tendencia': tendencia,
                'periodo': d.get('periodo'),
            })

        return jsonify({"ok": True, "ranking": ranking})

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_scorecard_ranking: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_scorecard_ranking: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


@procurement_bp.route('/scorecard/<proveedor_id>/evaluar', methods=['POST'])
@require_auth
@require_role(['admin', 'planner'])
def evaluar_proveedor(proveedor_id):
    """
    Crear evaluación manual de un proveedor.

    JSON body:
        {
            calidad_score: float (0-100),
            entrega_score: float (0-100),
            precio_score: float (0-100),
            servicio_score: float (0-100),
            periodo: str (YYYY-MM),
            notas: str (optional)
        }
    """
    from datetime import datetime

    from backend.core.db import get_db_transaction, is_using_postgresql

    data = request.get_json() or {}
    user_id = _get_user_id()

    calidad = min(max(float(data.get('calidad_score', 0)), 0), 100)
    entrega = min(max(float(data.get('entrega_score', 0)), 0), 100)
    precio = min(max(float(data.get('precio_score', 0)), 0), 100)
    servicio = min(max(float(data.get('servicio_score', 0)), 0), 100)
    score_global = round(calidad * 0.25 + entrega * 0.30 + precio * 0.25 + servicio * 0.20, 1)
    periodo = data.get('periodo', datetime.now().strftime('%Y-%m'))
    notas = data.get('notas', '')
    proveedor_nombre = data.get('nombre', proveedor_id)

    try:
        with get_db_transaction() as conn:
            cur = conn.cursor()
            if is_using_postgresql():
                cur.execute("""
                    INSERT INTO proveedor_evaluacion
                    (proveedor_id, proveedor_nombre, periodo, calidad_score,
                     entrega_score, precio_score, servicio_score, score_global,
                     evaluado_por, notas)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (proveedor_id, proveedor_nombre, periodo, calidad,
                      entrega, precio, servicio, score_global, user_id, notas))
                eval_id = cur.fetchone()[0]
            else:
                cur.execute("""
                    INSERT INTO proveedor_evaluacion
                    (proveedor_id, proveedor_nombre, periodo, calidad_score,
                     entrega_score, precio_score, servicio_score, score_global,
                     evaluado_por, notas)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (proveedor_id, proveedor_nombre, periodo, calidad,
                      entrega, precio, servicio, score_global, user_id, notas))
                eval_id = cur.lastrowid

        return jsonify({
            "ok": True,
            "data": {
                "id": eval_id,
                "proveedor_id": proveedor_id,
                "score_global": score_global,
                "periodo": periodo,
            }
        }), 201

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in evaluar_proveedor: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in evaluar_proveedor for proveedor_id={proveedor_id}: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


@procurement_bp.route('/scorecard/<proveedor_id>/historial', methods=['GET'])
@require_auth
def get_scorecard_historial(proveedor_id):
    """
    Obtener historial de evaluaciones de un proveedor.

    Query params:
        - meses: Meses hacia atrás (default: 12)
    """
    meses = min(request.args.get('meses', 12, type=int), 36)

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            # Current (latest)
            cur.execute("""
                SELECT * FROM proveedor_evaluacion
                WHERE proveedor_id = ?
                ORDER BY created_at DESC LIMIT 1
            """, (proveedor_id,))
            current_row = cur.fetchone()
            current = dict(current_row) if current_row else None

            # Historial
            cur.execute("""
                SELECT periodo, calidad_score, entrega_score, precio_score,
                       servicio_score, score_global, evaluado_por, notas, created_at
                FROM proveedor_evaluacion
                WHERE proveedor_id = ?
                ORDER BY periodo DESC
                LIMIT ?
            """, (proveedor_id, meses))
            historial = [dict(row) for row in cur.fetchall()]

        return jsonify({
            "ok": True,
            "current": current,
            "historial": historial,
        })

    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"Invalid input in get_scorecard_historial: {e}")
        return jsonify({"error": "Datos de entrada inválidos"}), 400
    except Exception as e:
        logger.error(f"Error in get_scorecard_historial for proveedor_id={proveedor_id}: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500
