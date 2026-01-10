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
from datetime import datetime
from typing import Any, Dict, List, Optional

from flask import Blueprint, g, jsonify, request

from backend.core.db import get_db_connection
from backend.core.roles import require_auth, require_role
from backend.routes.database import is_postgres

logger = logging.getLogger(__name__)

procurement_bp = Blueprint('procurement', __name__, url_prefix='/api/procurement')


def _get_user_id() -> str:
    """Obtiene el user_id del request context."""
    return getattr(g, "user_id", None) or getattr(g, "current_user", {}).get("id_spm", "")


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
            conditions.append("(material_descripcion LIKE ? OR material_codigo LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])

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

    except Exception as e:
        logger.error(f"Error obteniendo solpeds: {e}")
        return jsonify({"error": "Error al obtener requisiciones"}), 500


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

    except Exception as e:
        logger.error(f"Error obteniendo detalle SOLPED {solped_id}: {e}")
        return jsonify({"error": "Error al obtener detalle"}), 500


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

    except Exception as e:
        logger.error(f"Error obteniendo orders: {e}")
        return jsonify({"error": "Error al obtener ordenes de compra"}), 500


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

    except Exception as e:
        logger.error(f"Error obteniendo detalle pedido {pedido_id}: {e}")
        return jsonify({"error": "Error al obtener detalle"}), 500


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

    except Exception as e:
        logger.error(f"Error obteniendo KPIs: {e}")
        return jsonify({"error": "Error al obtener KPIs"}), 500


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

    except Exception as e:
        logger.error(f"Error obteniendo lead times: {e}")
        return jsonify({"error": "Error al obtener lead times"}), 500


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
            cur.execute("""
                SELECT * FROM v_sap_cumplimiento
                WHERE total_pedidos >= ?
                ORDER BY pct_otif DESC
            """, (min_pedidos,))
            rows = cur.fetchall()

        return jsonify({
            "items": [_row_to_dict(r) for r in rows]
        })

    except Exception as e:
        logger.error(f"Error obteniendo compliance: {e}")
        return jsonify({"error": "Error al obtener cumplimiento"}), 500


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
            conditions.append("(material_codigo LIKE ? OR material_descripcion LIKE ?)")
            params.extend([f"%{material}%", f"%{material}%"])
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

    except Exception as e:
        logger.error(f"Error obteniendo costos: {e}")
        return jsonify({"error": "Error al obtener analisis de costos"}), 500


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

    except Exception as e:
        logger.error(f"Error en importacion: {e}")
        return jsonify({"error": f"Error durante importacion: {str(e)}"}), 500


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

    except Exception as e:
        logger.error(f"Error obteniendo historial: {e}")
        return jsonify({"error": "Error al obtener historial"}), 500


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

    except Exception as e:
        logger.error(f"Error obteniendo resumen: {e}")
        return jsonify({"error": "Error al obtener resumen"}), 500


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

    except Exception as e:
        logger.error(f"Error obteniendo pipeline: {e}")
        return jsonify({"error": "Error al obtener pipeline"}), 500


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

    except Exception as e:
        logger.error(f"Error obteniendo analytics: {e}")
        return jsonify({"error": "Error al obtener analytics de procurement"}), 500
