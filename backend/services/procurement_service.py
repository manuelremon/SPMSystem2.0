"""
Procurement Service - Logic for SAP Requisitions and Purchase Orders
Refactored from routes/procurement.py
"""

import logging
import os
import tempfile
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql
from backend.core.search_utils import build_description_search_with_catalog

logger = logging.getLogger(__name__)

class ProcurementService:
    @staticmethod
    def ensure_procurement_views():
        """Crea vistas SAP de procurement si no existen (idempotente)."""
        if not is_using_postgresql():
            return
        
        try:
            with get_db_connection() as conn:
                cur = conn.cursor()
                # View creation logic (copied from routes)
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
                        ROUND((100.0 * SUM(CASE WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada THEN 1 ELSE 0 END) / COUNT(*))::numeric, 1) as pct_a_tiempo,
                        ROUND((100.0 * SUM(CASE WHEN p.cantidad_recepcionada >= p.cantidad_pedida THEN 1 ELSE 0 END) / COUNT(*))::numeric, 1) as pct_completas,
                        ROUND((100.0 * SUM(CASE
                            WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
                             AND p.cantidad_recepcionada >= p.cantidad_pedida
                            THEN 1 ELSE 0
                        END) / COUNT(*))::numeric, 1) as pct_otif,
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
                    CREATE OR REPLACE VIEW v_sap_pipeline AS
                    SELECT
                        etapa, cantidad,
                        ROUND((100.0 * cantidad / NULLIF(SUM(cantidad) OVER(), 0))::numeric, 1) as porcentaje,
                        orden
                    FROM (
                        SELECT 'Requisiciones' as etapa, COUNT(DISTINCT solped_id) as cantidad, 1 as orden FROM sap_solpeds
                        UNION ALL
                        SELECT 'Liberadas', COUNT(DISTINCT solped_id), 2 FROM sap_solpeds WHERE estrategia_liberacion = 'LIBERADA'
                        UNION ALL
                        SELECT 'En Pedido', COUNT(DISTINCT pedido_id), 3 FROM sap_purchase_orders
                        UNION ALL
                        SELECT 'Recepcionadas', COUNT(DISTINCT pedido_id), 4 FROM sap_purchase_orders WHERE fecha_recepcion IS NOT NULL
                    ) sub
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
                            THEN ROUND(((MAX(s.precio_unitario) - MIN(s.precio_unitario)) / AVG(s.precio_unitario) * 100)::numeric, 2)
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

    @staticmethod
    def get_solpeds(
        page: int = 1,
        per_page: int = 50,
        centro: Optional[str] = None,
        material: Optional[str] = None,
        estado: Optional[str] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        offset = (page - 1) * per_page
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
            count_query = f"SELECT COUNT(*) as count FROM sap_solpeds WHERE {where_clause}"
            cur.execute(count_query, params)
            total = cur.fetchone()['count']

            query = f"""
                SELECT * FROM sap_solpeds
                WHERE {where_clause}
                ORDER BY fecha_creacion DESC, solped_id DESC
                LIMIT ? OFFSET ?
            """
            cur.execute(query, params + [per_page, offset])
            rows = cur.fetchall()

        items = [_row_to_dict(r) for r in rows]

        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page
        }

    @staticmethod
    def get_solped_detail(solped_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cur = conn.cursor()
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
                return None

            items = [_row_to_dict(r) for r in rows]
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

            return {
                "summary": summary,
                "items": items
            }

    @staticmethod
    def get_orders(
        page: int = 1,
        per_page: int = 50,
        proveedor: Optional[str] = None,
        material: Optional[str] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        recibido: bool = False
    ) -> Dict[str, Any]:
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
                f"SELECT COUNT(*) as count FROM sap_purchase_orders WHERE {where_clause}",
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

        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page
        }

    @staticmethod
    def get_order_detail(pedido_id: str) -> Optional[Dict[str, Any]]:
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
                return None

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

            return {
                "summary": summary,
                "items": items
            }

    @staticmethod
    def _date_since_sql(days: int) -> str:
        """Retorna expresión SQL compatible para 'hace N días'."""
        if is_using_postgresql():
            return f"NOW() - INTERVAL '{days} days'"
        return f"datetime('now', '-{days} days')"

    @staticmethod
    def get_kpis(centro: Optional[str] = None, periodo: str = 'mes') -> Dict[str, Any]:
        dias = {'mes': 30, 'trimestre': 90, 'anio': 365}.get(periodo, 30)
        fecha_filtro = ProcurementService._date_since_sql(dias)

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

            # Lead time promedio (usar _date_diff_sql para compatibilidad PG/SQLite)
            lt_total = ProcurementService._date_diff_sql('p.fecha_recepcion', 's.fecha_creacion')
            lt_aprobacion = ProcurementService._date_diff_sql('p.fecha_pedido', 's.fecha_creacion')
            lt_entrega = ProcurementService._date_diff_sql('p.fecha_recepcion', 'p.fecha_pedido')
            cur.execute(f"""
                SELECT
                    {ProcurementService._round_avg_sql(lt_total)} as lead_time_total,
                    {ProcurementService._round_avg_sql(lt_aprobacion)} as tiempo_aprobacion,
                    {ProcurementService._round_avg_sql(lt_entrega)} as tiempo_entrega
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

        return {
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
                "total_dias": round(float(lead_time_dict.get('lead_time_total') or 0), 1),
                "aprobacion_dias": round(float(lead_time_dict.get('tiempo_aprobacion') or 0), 1),
                "entrega_dias": round(float(lead_time_dict.get('tiempo_entrega') or 0), 1)
            },
            "cumplimiento": {
                "pct_a_tiempo": round(100 * (otif_dict.get('a_tiempo', 0) or 0) / total_otif, 1),
                "pct_completas": round(100 * (otif_dict.get('completas', 0) or 0) / total_otif, 1),
                "pct_otif": round(100 * (otif_dict.get('otif', 0) or 0) / total_otif, 1)
            },
            "top_proveedores": [_row_to_dict(r) for r in top_proveedores]
        }

    @staticmethod
    def get_lead_times(
        centro: Optional[str] = None,
        proveedor: Optional[str] = None,
        group_by: str = 'proveedor'
    ) -> Dict[str, Any]:
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
        lead_time_diff = ProcurementService._date_diff_sql('p.fecha_recepcion', 's.fecha_creacion')
        aprobacion_diff = ProcurementService._date_diff_sql('p.fecha_pedido', 's.fecha_creacion')
        entrega_diff = ProcurementService._date_diff_sql('p.fecha_recepcion', 'p.fecha_pedido')

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(f"""
                SELECT
                    {select_field},
                    COUNT(*) as total_entregas,
                    {ProcurementService._round_avg_sql(lead_time_diff)} as lead_time_promedio,
                    MIN({lead_time_diff}) as lead_time_min,
                    MAX({lead_time_diff}) as lead_time_max,
                    {ProcurementService._round_avg_sql(aprobacion_diff)} as tiempo_aprobacion,
                    {ProcurementService._round_avg_sql(entrega_diff)} as tiempo_entrega
                FROM sap_solpeds s
                INNER JOIN sap_purchase_orders p
                    ON s.solped_id = p.solped_id AND s.posicion = p.solped_posicion
                WHERE {where_clause}
                GROUP BY {group_field}
                ORDER BY lead_time_promedio DESC
                LIMIT 50
            """, params)
            rows = cur.fetchall()

        return {
            "group_by": group_by,
            "items": [_row_to_dict(r) for r in rows]
        }

    @staticmethod
    def get_compliance(min_pedidos: int = 5, limit: int = 50) -> List[Dict[str, Any]]:
        limit = min(limit, 200)
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Verificar si la vista existe (compatible SQLite y PostgreSQL)
            try:
                cur.execute("SELECT 1 FROM v_sap_cumplimiento LIMIT 1")
            except Exception:
                return []

            cur.execute("""
                SELECT * FROM v_sap_cumplimiento
                WHERE total_pedidos >= ?
                ORDER BY pct_otif DESC
                LIMIT ?
            """, (min_pedidos, limit))
            rows = cur.fetchall()

        return [_row_to_dict(r) for r in rows]

    @staticmethod
    def get_costs(
        material: Optional[str] = None,
        moneda: Optional[str] = None,
        min_trans: int = 3
    ) -> List[Dict[str, Any]]:
        # Filtros adicionales (excluyendo num_transacciones que va en subquery)
        conditions = []
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

        extra_where = (" AND " + " AND ".join(conditions)) if conditions else ""

        # num_transacciones es un alias calculado en la vista — se filtra en subquery
        # para compatibilidad SQLite/PostgreSQL
        with get_db_connection() as conn:
            cur = conn.cursor()
            try:
                cur.execute(f"""
                    SELECT * FROM (
                        SELECT * FROM v_sap_analisis_costos
                        WHERE num_transacciones >= ?
                        {extra_where}
                    ) sub
                    ORDER BY importe_total DESC
                    LIMIT 100
                """, [min_trans] + params)
                rows = cur.fetchall()
            except Exception:
                return []

        return [_row_to_dict(r) for r in rows]

    @staticmethod
    def import_zm65_file(file_storage, user_id: str) -> Dict[str, Any]:
        """
        Procesa el archivo ZM65.
        
        Args:
            file_storage: Objeto FileStorage de Flask o similar con método save().
            user_id: ID del usuario que importa.
        """
        # Guardar archivo temporal
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            file_storage.save(tmp.name)
            tmp_path = tmp.name

        try:
            # Importar localmente para evitar problemas circulares
            from backend.scripts.import_zm65 import ZM65Importer
            
            importer = ZM65Importer(verbose=True)
            stats = importer.import_file(tmp_path, user_id=user_id)

            return {
                "success": True,
                "message": "Importacion completada",
                "stats": stats
            }

        finally:
            # Limpiar archivo temporal
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    @staticmethod
    def get_import_history(limit: int = 20) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM sap_import_log
                ORDER BY started_at DESC
                LIMIT ?
            """, (limit,))
            rows = cur.fetchall()

        return [_row_to_dict(r) for r in rows]

    @staticmethod
    def get_summary() -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM v_sap_resumen_centro")
            rows = cur.fetchall()

        return [_row_to_dict(r) for r in rows]

    @staticmethod
    def get_pipeline() -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM v_sap_pipeline ORDER BY orden")
            rows = cur.fetchall()

        return [_row_to_dict(r) for r in rows]

    @staticmethod
    def get_procurement_analytics() -> Dict[str, Any]:
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

            # 2. Lead times (usar columnas pre-calculadas de la vista)
            cur.execute("""
                SELECT
                    ROUND(AVG(dias_total)::numeric, 1) as promedio,
                    MIN(dias_total) as minimo,
                    MAX(dias_total) as maximo
                FROM v_sap_lead_times
            """)
            lead_times = cur.fetchone()

            # 3. Cumplimiento OTIF (SQL compatible con PG y SQLite)
            cur.execute(f"""
                SELECT
                    COUNT(*) as total,
                    {ProcurementService._round_avg_sql('pct_a_tiempo')} as avg_a_tiempo,
                    {ProcurementService._round_avg_sql('pct_completas')} as avg_completas,
                    {ProcurementService._round_avg_sql('pct_otif')} as avg_otif
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

            # 6. Top 5 proveedores por lead time (mas rapidos)
            cur.execute("""
                SELECT
                    proveedor_nombre,
                    COUNT(*) as entregas,
                    ROUND(AVG(dias_total)::numeric, 1) as lead_time_promedio
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

        return {
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
        }

    @staticmethod
    def get_provider_scorecard(proveedor: str, periodo: str = 'anio') -> Dict[str, Any]:
        dias = {'mes': 30, 'trimestre': 90, 'anio': 365}.get(periodo, 365)
        fecha_filtro = ProcurementService._date_since_sql(dias)

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
                return {}

            info = _row_to_dict(info_row)

            # Métricas de cumplimiento (OTIF)
            lead_time_diff = ProcurementService._date_diff_sql('p.fecha_recepcion', 's.fecha_creacion')
            aprobacion_diff = ProcurementService._date_diff_sql('p.fecha_pedido', 's.fecha_creacion')
            entrega_diff = ProcurementService._date_diff_sql('p.fecha_recepcion', 'p.fecha_pedido')

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
                    {ProcurementService._round_avg_sql(lead_time_diff)} as lead_time_promedio,
                    MIN({lead_time_diff}) as lead_time_min,
                    MAX({lead_time_diff}) as lead_time_max,
                    {ProcurementService._round_avg_sql(aprobacion_diff)} as tiempo_aprobacion,
                    {ProcurementService._round_avg_sql(entrega_diff)} as tiempo_entrega
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
                    {ProcurementService._round_avg_sql('s.precio_unitario')} as precio_promedio
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

        return {
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
        }

    @staticmethod
    def get_price_history(
        material_codigo: str,
        centro: Optional[str] = None,
        moneda: Optional[str] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
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
                return {}

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

        return {
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
        }

    @staticmethod
    def get_provider_ranking(
        limit: int = 20,
        periodo: str = 'anio',
        centro: Optional[str] = None
    ) -> Dict[str, Any]:
        limit = min(limit, 100)
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
                    {ProcurementService._round_avg_sql(ProcurementService._date_diff_sql('p.fecha_recepcion', 'p.fecha_pedido'))} as lead_time_promedio
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

        return {
            "ok": True,
            "data": {
                "ranking": ranking,
                "total": len(ranking),
                "periodo": periodo,
            }
        }

    @staticmethod
    def compare_providers(
        material_codigo: str,
        centro: Optional[str] = None
    ) -> Dict[str, Any]:
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
                    {ProcurementService._round_avg_sql(ProcurementService._date_diff_sql('p.fecha_recepcion', 'p.fecha_pedido'))} as lead_time_promedio,
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

        return {
            "ok": True,
            "data": {
                "material": material_codigo,
                "proveedores": proveedores,
                "total": len(proveedores),
            }
        }

    @staticmethod
    def compare_providers_side_by_side(proveedor_ids: List[str]) -> Dict[str, Any]:
        if not proveedor_ids or len(proveedor_ids) < 2:
            raise ValueError("Se requieren al menos 2 proveedores")
        if len(proveedor_ids) > 5:
            raise ValueError("Máximo 5 proveedores para comparar")

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
                    lead_time_diff = ProcurementService._date_diff_sql(
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
                            {ProcurementService._round_avg_sql(lead_time_diff)} as lead_time_promedio
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

        return {
            "ok": True,
            "data": {
                "proveedores": resultados,
                "total": len(resultados),
            }
        }

    @staticmethod
    def get_scorecard_ranking(
        limit: int = 50,
        periodo: Optional[str] = None
    ) -> Dict[str, Any]:
        limit = min(limit, 200)

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

        # Build tendencia map in a single query (avoid N+1)
        tendencia_map = {}
        if rows:
            prov_ids = list({dict(r).get('proveedor_id') for r in rows})
            try:
                with get_db_connection() as conn2:
                    cur2 = conn2.cursor()
                    placeholders = ','.join(['?'] * len(prov_ids))
                    cur2.execute(f"""
                        SELECT proveedor_id, score_global,
                               LAG(score_global) OVER (
                                   PARTITION BY proveedor_id ORDER BY created_at
                               ) as prev_score
                        FROM proveedor_evaluacion
                        WHERE proveedor_id IN ({placeholders})
                        ORDER BY proveedor_id, created_at DESC
                    """, prov_ids)
                    for trow in cur2.fetchall():
                        td = dict(trow)
                        pid = td.get('proveedor_id')
                        if pid not in tendencia_map and td.get('prev_score') is not None:
                            tendencia_map[pid] = round(
                                float(td.get('score_global') or 0) - float(td['prev_score']), 1
                            )
            except Exception:
                pass

        ranking = []
        for row in rows:
            d = dict(row)
            ranking.append({
                'proveedor_id': d.get('proveedor_id'),
                'nombre': d.get('proveedor_nombre'),
                'score_global': float(d.get('score_global') or 0),
                'entrega_score': float(d.get('entrega_score') or 0),
                'calidad_score': float(d.get('calidad_score') or 0),
                'precio_score': float(d.get('precio_score') or 0),
                'servicio_score': float(d.get('servicio_score') or 0),
                'tendencia': tendencia_map.get(d.get('proveedor_id')),
                'periodo': d.get('periodo'),
            })

        return {"ok": True, "ranking": ranking}

    @staticmethod
    def evaluate_provider(
        proveedor_id: str,
        data: Dict[str, Any],
        user_id: str
    ) -> Dict[str, Any]:
        """
        Crear evaluación manual de un proveedor.
        """
        calidad = min(max(float(data.get('calidad_score', 0)), 0), 100)
        entrega = min(max(float(data.get('entrega_score', 0)), 0), 100)
        precio = min(max(float(data.get('precio_score', 0)), 0), 100)
        servicio = min(max(float(data.get('servicio_score', 0)), 0), 100)
        score_global = round(calidad * 0.25 + entrega * 0.30 + precio * 0.25 + servicio * 0.20, 1)
        periodo = data.get('periodo', datetime.now().strftime('%Y-%m'))
        notas = data.get('notas', '')
        proveedor_nombre = data.get('nombre', proveedor_id)

        with get_db_transaction() as (conn, cur):
            cur.execute("""
                INSERT INTO proveedor_evaluacion
                (proveedor_id, proveedor_nombre, periodo, calidad_score,
                 entrega_score, precio_score, servicio_score, score_global,
                 evaluado_por, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
            """, (proveedor_id, proveedor_nombre, periodo, calidad,
                  entrega, precio, servicio, score_global, user_id, notas))
            row = cur.fetchone()
            eval_id = row[0] if row else None

        return {
            "ok": True,
            "data": {
                "id": eval_id,
                "proveedor_id": proveedor_id,
                "score_global": score_global,
                "periodo": periodo,
            }
        }

    @staticmethod
    def get_scorecard_history(
        proveedor_id: str,
        meses: int = 12
    ) -> Dict[str, Any]:
        meses = min(meses, 36)

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

        return {
            "ok": True,
            "current": current,
            "historial": historial,
        }

    # Helper methods for SQL generation

    @staticmethod
    def _row_to_dict(row) -> Dict[str, Any]:
        if row is None:
            return {}
        if hasattr(row, 'keys'):
            return dict(row)
        return {}

    @staticmethod
    def _date_diff_sql(col1: str, col2: str) -> str:
        if is_using_postgresql():
            return f"EXTRACT(EPOCH FROM ({col1} - {col2})) / 86400.0"
        return f"julianday({col1}) - julianday({col2})"

    @staticmethod
    def _round_avg_sql(expression: str, decimals: int = 1) -> str:
        if is_using_postgresql():
            return f"ROUND(AVG({expression})::numeric, {decimals})"
        return f"ROUND(AVG({expression}), {decimals})"

# Global helpers to maintain compatibility or style if needed, 
# but static methods are preferred.
def _row_to_dict(row: Any) -> Dict[str, Any]:
    return ProcurementService._row_to_dict(row)

def _date_diff_sql(col1: str, col2: str) -> str:
    return ProcurementService._date_diff_sql(col1, col2)

def _round_avg_sql(expression: str, decimals: int = 1) -> str:
    return ProcurementService._round_avg_sql(expression, decimals)

