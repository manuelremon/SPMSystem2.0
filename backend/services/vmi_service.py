"""
Servicio de Vendor Managed Inventory (VMI).
Gestiona programas VMI, inventario compartido y reposiciones automáticas.
"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction

logger = logging.getLogger(__name__)

PH = '%s'  # PostgreSQL placeholder


def crear_programa(data: Dict[str, Any]) -> Optional[int]:
    """
    Crea un programa VMI.

    Returns:
        ID del programa creado o None si falla
    """
    try:
        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                INSERT INTO vmi_programa
                (proveedor_cuit, nombre, material_codigo, centro_id, almacen_id,
                 estado, tipo_reposicion, min_stock, max_stock, punto_pedido,
                 cantidad_pedido, frecuencia_dias, responsable_interno,
                 fecha_inicio, created_at)
                VALUES ({PH}, {PH}, {PH}, {PH}, {PH},
                        'active', {PH}, {PH}, {PH}, {PH},
                        {PH}, {PH}, {PH},
                        {PH}, {PH})
                RETURNING id
            """, (
                data.get('proveedor_cuit') or data.get('proveedor_id'),
                data.get('nombre', ''),
                data.get('material_codigo', ''),
                data.get('centro_id') or data.get('centro'),
                data.get('almacen_id') or data.get('almacen'),
                data.get('tipo_reposicion', 'min_max'),
                data.get('min_stock') or data.get('stock_minimo'),
                data.get('max_stock') or data.get('stock_maximo'),
                data.get('punto_pedido'),
                data.get('cantidad_pedido'),
                data.get('frecuencia_dias'),
                data.get('responsable_interno') or data.get('creado_por'),
                datetime.utcnow(),
                datetime.utcnow(),
            ))

            programa_id = cursor.fetchone()[0]
            logger.info(f"Programa VMI creado: {programa_id}")
            return programa_id

    except Exception as e:
        logger.error(f"Error creando programa VMI: {e}", exc_info=True)
        return None


def obtener_programas(filtros: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Obtiene programas VMI con paginación y filtros.
    """
    filtros = filtros or {}
    page = filtros.get('page', 1)
    per_page = filtros.get('per_page', 50)
    offset = (page - 1) * per_page

    try:
        conditions = []
        params = []

        if filtros.get('estado'):
            conditions.append(f"p.estado = {PH}")
            params.append(filtros['estado'])

        if filtros.get('proveedor_cuit') or filtros.get('proveedor'):
            conditions.append(f"p.proveedor_cuit ILIKE {PH}")
            params.append(f"%{filtros.get('proveedor_cuit') or filtros.get('proveedor')}%")

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(f"""
                SELECT COUNT(*) FROM vmi_programa p WHERE {where_clause}
            """, params)
            total = cursor.fetchone()[0]

            cursor.execute(f"""
                SELECT p.id, p.proveedor_cuit, p.nombre, p.material_codigo,
                       p.centro_id, p.almacen_id, p.estado, p.tipo_reposicion,
                       p.min_stock, p.max_stock, p.punto_pedido,
                       p.cantidad_pedido, p.frecuencia_dias,
                       p.responsable_proveedor, p.responsable_interno,
                       p.fecha_inicio, p.fecha_fin, p.created_at,
                       (SELECT pr.nombre FROM proveedores pr
                        WHERE pr.id_proveedor = p.proveedor_cuit LIMIT 1) as proveedor_nombre
                FROM vmi_programa p
                WHERE {where_clause}
                ORDER BY p.created_at DESC
                LIMIT {PH} OFFSET {PH}
            """, params + [per_page, offset])

            items = [dict(row) for row in cursor.fetchall()]

            return {
                'items': items,
                'total': total,
                'page': page,
                'per_page': per_page
            }

    except Exception as e:
        logger.error(f"Error obteniendo programas VMI: {e}", exc_info=True)
        return {'items': [], 'total': 0, 'page': page, 'per_page': per_page}


def obtener_detalle_programa(programa_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtiene el detalle completo de un programa VMI.
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get programa
            cursor.execute(f"""
                SELECT p.id, p.proveedor_cuit, p.nombre, p.material_codigo,
                       p.centro_id, p.almacen_id, p.estado, p.tipo_reposicion,
                       p.min_stock, p.max_stock, p.punto_pedido,
                       p.cantidad_pedido, p.frecuencia_dias,
                       p.responsable_proveedor, p.responsable_interno,
                       p.fecha_inicio, p.fecha_fin, p.created_at,
                       (SELECT pr.nombre FROM proveedores pr
                        WHERE pr.id_proveedor = p.proveedor_cuit LIMIT 1) as proveedor_nombre
                FROM vmi_programa p
                WHERE p.id = {PH}
            """, (programa_id,))

            programa_row = cursor.fetchone()
            if not programa_row:
                return None

            programa = dict(programa_row)

            # Get inventario historico
            cursor.execute(f"""
                SELECT id, fecha, stock_disponible, stock_reservado,
                       stock_en_transito, consumo_diario_promedio,
                       dias_inventario, stock_proyectado_7d, alerta
                FROM vmi_inventario_compartido
                WHERE programa_id = {PH}
                ORDER BY fecha DESC
                LIMIT 30
            """, (programa_id,))

            inventario = [dict(row) for row in cursor.fetchall()]

            # Latest inventory as snapshot
            inventario_actual = inventario[0] if inventario else {}

            # Get reposiciones
            cursor.execute(f"""
                SELECT id, tipo, cantidad_sugerida, cantidad_aprobada,
                       fecha_sugerida, fecha_entrega_esperada, estado,
                       orden_compra_id, razon_rechazo, aprobado_por, created_at
                FROM vmi_reposicion
                WHERE programa_id = {PH}
                ORDER BY created_at DESC
            """, (programa_id,))

            reposiciones = [dict(row) for row in cursor.fetchall()]

            # Get KPIs
            cursor.execute(f"""
                SELECT id, periodo, stockout_count, dias_stockout,
                       fill_rate, inventory_turnover, lead_time_avg,
                       costo_almacenamiento
                FROM vmi_kpi_snapshot
                WHERE programa_id = {PH}
                ORDER BY periodo DESC
                LIMIT 12
            """, (programa_id,))

            kpis = [dict(row) for row in cursor.fetchall()]

            return {
                'ok': True,
                'programa': programa,
                'inventario': inventario,
                'inventario_actual': inventario_actual,
                'reposiciones': reposiciones,
                'kpis': kpis
            }

    except Exception as e:
        logger.error(f"Error obteniendo detalle de programa {programa_id}: {e}", exc_info=True)
        return None


def actualizar_programa(programa_id: int, data: Dict[str, Any]) -> bool:
    """
    Actualiza un programa VMI.
    """
    try:
        updates = []
        params = []

        field_map = {
            'nombre': 'nombre',
            'min_stock': 'min_stock',
            'stock_minimo': 'min_stock',
            'max_stock': 'max_stock',
            'stock_maximo': 'max_stock',
            'punto_pedido': 'punto_pedido',
            'cantidad_pedido': 'cantidad_pedido',
            'frecuencia_dias': 'frecuencia_dias',
            'tipo_reposicion': 'tipo_reposicion',
            'estado': 'estado',
            'responsable_proveedor': 'responsable_proveedor',
            'responsable_interno': 'responsable_interno',
        }

        for input_field, db_field in field_map.items():
            if input_field in data:
                updates.append(f"{db_field} = {PH}")
                params.append(data[input_field])

        if not updates:
            return False

        params.append(programa_id)
        set_clause = ", ".join(updates)

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE vmi_programa
                SET {set_clause}
                WHERE id = {PH}
            """, params)

            logger.info(f"Programa VMI {programa_id} actualizado")
            return True

    except Exception as e:
        logger.error(f"Error actualizando programa {programa_id}: {e}", exc_info=True)
        return False


def actualizar_inventario(programa_id: int, data: Dict[str, Any]) -> bool:
    """
    Actualiza el inventario compartido de un programa VMI.
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                SELECT min_stock, punto_pedido
                FROM vmi_programa
                WHERE id = {PH}
            """, (programa_id,))

            programa_row = cursor.fetchone()
            if not programa_row:
                return False

            min_stock = programa_row[0] or 0
            punto_pedido = programa_row[1] or 0

        stock_disponible = data.get('stock_disponible', 0)
        stock_reservado = data.get('reservado', 0) or data.get('stock_reservado', 0)
        stock_en_transito = data.get('en_transito', 0) or data.get('stock_en_transito', 0)
        consumo_diario = data.get('consumo_diario', 0) or data.get('consumo_diario_promedio', 0)

        # Dias de inventario
        dias_inventario = (stock_disponible / consumo_diario) if consumo_diario > 0 else 999

        # Stock proyectado a 7 dias
        stock_proyectado_7d = stock_disponible - (consumo_diario * 7)

        # Alerta (DB CHECK: stock_bajo, reposicion_sugerida, ok)
        if stock_disponible < min_stock:
            alerta = 'stock_bajo'
        elif stock_disponible < punto_pedido:
            alerta = 'reposicion_sugerida'
        else:
            alerta = 'ok'

        fecha_actual = datetime.utcnow().date()

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                INSERT INTO vmi_inventario_compartido
                (programa_id, fecha, stock_disponible, stock_reservado,
                 stock_en_transito, consumo_diario_promedio,
                 dias_inventario, stock_proyectado_7d, alerta,
                 sincronizado_por, created_at)
                VALUES ({PH}, {PH}, {PH}, {PH},
                        {PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH})
                ON CONFLICT (programa_id, fecha)
                DO UPDATE SET
                    stock_disponible = EXCLUDED.stock_disponible,
                    stock_reservado = EXCLUDED.stock_reservado,
                    stock_en_transito = EXCLUDED.stock_en_transito,
                    consumo_diario_promedio = EXCLUDED.consumo_diario_promedio,
                    dias_inventario = EXCLUDED.dias_inventario,
                    stock_proyectado_7d = EXCLUDED.stock_proyectado_7d,
                    alerta = EXCLUDED.alerta,
                    sincronizado_por = EXCLUDED.sincronizado_por
            """, (
                programa_id, fecha_actual, stock_disponible, stock_reservado,
                stock_en_transito, consumo_diario, dias_inventario,
                stock_proyectado_7d, alerta, 'internal', datetime.utcnow()
            ))

            logger.info(f"Inventario VMI actualizado para programa {programa_id}")
            return True

    except Exception as e:
        logger.error(f"Error actualizando inventario VMI: {e}", exc_info=True)
        return False


def obtener_reposiciones(filtros: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Obtiene reposiciones VMI con filtros opcionales.
    """
    try:
        filtros = filtros or {}
        conditions = []
        params = []

        if filtros.get('estado'):
            conditions.append(f"r.estado = {PH}")
            params.append(filtros['estado'])

        if filtros.get('programa_id'):
            conditions.append(f"r.programa_id = {PH}")
            params.append(filtros['programa_id'])

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                SELECT
                    r.id, r.programa_id, r.tipo, r.cantidad_sugerida,
                    r.cantidad_aprobada, r.fecha_sugerida,
                    r.fecha_entrega_esperada, r.estado,
                    r.orden_compra_id, r.razon_rechazo,
                    r.aprobado_por, r.created_at,
                    p.proveedor_cuit, p.nombre as programa_nombre,
                    p.material_codigo,
                    (SELECT pr.nombre FROM proveedores pr
                     WHERE pr.id_proveedor = p.proveedor_cuit LIMIT 1) as proveedor_nombre
                FROM vmi_reposicion r
                JOIN vmi_programa p ON r.programa_id = p.id
                WHERE {where_clause}
                ORDER BY r.created_at DESC
            """, params)

            return [dict(row) for row in cursor.fetchall()]

    except Exception as e:
        logger.error(f"Error obteniendo reposiciones VMI: {e}", exc_info=True)
        return []


def aprobar_reposicion(
    reposicion_id: int,
    user_id: int,
    cantidad_aprobada: Optional[float] = None
) -> bool:
    """Aprueba una reposición VMI."""
    try:
        with get_db_transaction() as (conn, cursor):
            if cantidad_aprobada is None:
                cursor.execute(f"""
                    SELECT cantidad_sugerida FROM vmi_reposicion
                    WHERE id = {PH}
                """, (reposicion_id,))
                row = cursor.fetchone()
                if not row:
                    return False
                cantidad_aprobada = row[0]

            cursor.execute(f"""
                UPDATE vmi_reposicion
                SET estado = 'approved',
                    cantidad_aprobada = {PH},
                    aprobado_por = {PH}
                WHERE id = {PH}
            """, (cantidad_aprobada, user_id, reposicion_id))

            logger.info(f"Reposición VMI {reposicion_id} aprobada por usuario {user_id}")
            return True

    except Exception as e:
        logger.error(f"Error aprobando reposición {reposicion_id}: {e}", exc_info=True)
        return False


def rechazar_reposicion(reposicion_id: int, user_id: int, razon: str) -> bool:
    """Rechaza una reposición VMI."""
    try:
        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE vmi_reposicion
                SET estado = 'rejected',
                    aprobado_por = {PH},
                    razon_rechazo = {PH}
                WHERE id = {PH}
            """, (user_id, razon, reposicion_id))

            logger.info(f"Reposición VMI {reposicion_id} rechazada por usuario {user_id}")
            return True

    except Exception as e:
        logger.error(f"Error rechazando reposición {reposicion_id}: {e}", exc_info=True)
        return False


def obtener_dashboard_vmi() -> Dict[str, Any]:
    """
    Obtiene KPIs agregados para el dashboard VMI.
    """
    dashboard = {
        'programas_activos': 0,
        'reposiciones_pendientes': 0,
        'avg_fill_rate': 0.0,
        'fill_rate_promedio': 0.0
    }

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Programas activos
            cursor.execute("""
                SELECT COUNT(*) FROM vmi_programa
                WHERE estado = 'active'
            """)
            dashboard['programas_activos'] = cursor.fetchone()[0]

            # Reposiciones pendientes
            cursor.execute("""
                SELECT COUNT(*) FROM vmi_reposicion
                WHERE estado = 'suggested'
            """)
            dashboard['reposiciones_pendientes'] = cursor.fetchone()[0]

            # Average fill rate from latest KPI snapshots
            cursor.execute("""
                SELECT AVG(fill_rate)
                FROM (
                    SELECT DISTINCT ON (programa_id) fill_rate
                    FROM vmi_kpi_snapshot
                    ORDER BY programa_id, periodo DESC
                ) latest
            """)

            result = cursor.fetchone()[0]
            avg_fr = round(result or 0.0, 2)
            dashboard['avg_fill_rate'] = avg_fr
            dashboard['fill_rate_promedio'] = avg_fr

            return dashboard

    except Exception as e:
        logger.error(f"Error obteniendo dashboard VMI: {e}", exc_info=True)
        return dashboard


def evaluar_reposiciones_diario() -> bool:
    """
    Evalúa programas VMI activos y crea reposiciones automáticas si es necesario.
    """
    try:
        reposiciones_creadas = 0

        with get_db_transaction() as (conn, cursor):
            cursor.execute("""
                SELECT id, proveedor_cuit, min_stock, max_stock, punto_pedido,
                       frecuencia_dias, tipo_reposicion
                FROM vmi_programa
                WHERE estado = 'active'
            """)

            programas = cursor.fetchall()

            for programa in programas:
                prog_id = programa[0]
                min_stock = programa[2] or 0
                max_stock = programa[3] or 0
                rop = programa[4] or 0
                freq_dias = programa[5] or 7
                tipo_repo = programa[6] or 'min_max'

                # Get latest inventario
                cursor.execute(f"""
                    SELECT stock_disponible, stock_proyectado_7d
                    FROM vmi_inventario_compartido
                    WHERE programa_id = {PH}
                    ORDER BY fecha DESC
                    LIMIT 1
                """, (prog_id,))

                inv_row = cursor.fetchone()
                if not inv_row:
                    continue

                stock_disponible = inv_row[0] or 0
                stock_proyectado = inv_row[1] or 0

                if stock_proyectado < rop:
                    # Check pending
                    cursor.execute(f"""
                        SELECT COUNT(*) FROM vmi_reposicion
                        WHERE programa_id = {PH}
                        AND estado IN ('suggested', 'approved')
                    """, (prog_id,))

                    if cursor.fetchone()[0] > 0:
                        continue

                    # Calculate cantidad
                    if tipo_repo == 'min_max':
                        cantidad_sugerida = max_stock - stock_disponible
                    else:
                        cantidad_sugerida = max_stock - stock_disponible

                    fecha_entrega = datetime.utcnow() + timedelta(days=freq_dias)

                    cursor.execute(f"""
                        INSERT INTO vmi_reposicion
                        (programa_id, tipo, cantidad_sugerida,
                         fecha_sugerida, fecha_entrega_esperada,
                         estado, created_at)
                        VALUES ({PH}, 'automatic', {PH},
                                {PH}, {PH}, 'suggested', {PH})
                    """, (prog_id, cantidad_sugerida,
                          datetime.utcnow(), fecha_entrega, datetime.utcnow()))

                    reposiciones_creadas += 1
                    logger.info(f"Reposición automática creada para programa VMI {prog_id}")

            logger.info(f"Evaluación VMI completada: {reposiciones_creadas} reposiciones creadas")
            return True

    except Exception as e:
        logger.error(f"Error evaluando reposiciones VMI: {e}", exc_info=True)
        return False


def calcular_kpis_mensual() -> bool:
    """
    Calcula KPIs mensuales para cada programa VMI activo.
    """
    try:
        periodo_actual = datetime.utcnow().strftime('%Y-%m')

        with get_db_transaction() as (conn, cursor):
            cursor.execute("""
                SELECT id FROM vmi_programa WHERE estado = 'active'
            """)

            programas = cursor.fetchall()

            for programa_row in programas:
                prog_id = programa_row[0]

                # Stockout count (days with stock < min)
                cursor.execute(f"""
                    SELECT COUNT(*)
                    FROM vmi_inventario_compartido inv
                    JOIN vmi_programa prog ON inv.programa_id = prog.id
                    WHERE inv.programa_id = {PH}
                    AND inv.fecha >= date_trunc('month', CURRENT_DATE)
                    AND inv.stock_disponible < prog.min_stock
                """, (prog_id,))
                stockout_count = cursor.fetchone()[0]

                # Total days
                cursor.execute(f"""
                    SELECT COUNT(*)
                    FROM vmi_inventario_compartido
                    WHERE programa_id = {PH}
                    AND fecha >= date_trunc('month', CURRENT_DATE)
                """, (prog_id,))
                total_days = cursor.fetchone()[0]

                fill_rate = ((total_days - stockout_count) / total_days * 100) if total_days > 0 else 100.0

                # Avg inventory
                cursor.execute(f"""
                    SELECT AVG(stock_disponible)
                    FROM vmi_inventario_compartido
                    WHERE programa_id = {PH}
                    AND fecha >= date_trunc('month', CURRENT_DATE)
                """, (prog_id,))
                avg_inv = cursor.fetchone()[0] or 0.0

                # Simple turnover calc
                inventory_turnover = 0.0
                if avg_inv > 0:
                    cursor.execute(f"""
                        SELECT AVG(consumo_diario_promedio)
                        FROM vmi_inventario_compartido
                        WHERE programa_id = {PH}
                        AND fecha >= date_trunc('month', CURRENT_DATE)
                    """, (prog_id,))
                    avg_consumo = cursor.fetchone()[0] or 0.0
                    if avg_consumo > 0:
                        inventory_turnover = round((avg_consumo * 30) / avg_inv, 2)

                # UPSERT KPI snapshot
                cursor.execute(f"""
                    INSERT INTO vmi_kpi_snapshot
                    (programa_id, periodo, stockout_count, dias_stockout,
                     fill_rate, inventory_turnover, created_at)
                    VALUES ({PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH})
                    ON CONFLICT (programa_id, periodo)
                    DO UPDATE SET
                        stockout_count = EXCLUDED.stockout_count,
                        dias_stockout = EXCLUDED.dias_stockout,
                        fill_rate = EXCLUDED.fill_rate,
                        inventory_turnover = EXCLUDED.inventory_turnover
                """, (
                    prog_id, periodo_actual, stockout_count, stockout_count,
                    fill_rate, inventory_turnover, datetime.utcnow()
                ))

                logger.info(f"KPIs VMI calculados para programa {prog_id}, periodo {periodo_actual}")

            logger.info(f"Cálculo de KPIs VMI completado para {len(programas)} programas")
            return True

    except Exception as e:
        logger.error(f"Error calculando KPIs VMI mensuales: {e}", exc_info=True)
        return False
