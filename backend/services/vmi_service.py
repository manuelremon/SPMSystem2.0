"""
Servicio de Vendor Managed Inventory (VMI).
Gestiona programas VMI, inventario compartido y reposiciones automáticas.
"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def crear_programa(data: Dict[str, Any]) -> Optional[int]:
    """
    Crea un programa VMI.

    Args:
        data: Dict con proveedor_cuit, materiales_incluidos, min_stock, max_stock,
              punto_pedido, lead_time_dias, tipo_reposicion, consumo_diario_promedio,
              creado_por

    Returns:
        ID del programa creado o None si falla
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                INSERT INTO vmi_programa
                (proveedor_cuit, materiales_incluidos, min_stock, max_stock,
                 punto_pedido, lead_time_dias, tipo_reposicion,
                 consumo_diario_promedio, estado, creado_por, fecha_creacion)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder}, {placeholder},
                        'active', {placeholder}, {placeholder})
            """, (
                data.get('proveedor_cuit'),
                str(data.get('materiales_incluidos', [])),
                data.get('min_stock'),
                data.get('max_stock'),
                data.get('punto_pedido'),
                data.get('lead_time_dias'),
                data.get('tipo_reposicion', 'min_max'),
                data.get('consumo_diario_promedio', 0.0),
                data.get('creado_por'),
                datetime.utcnow()
            ))

            if is_using_postgresql():
                cursor.execute("SELECT lastval()")
            else:
                cursor.execute("SELECT last_insert_rowid()")

            programa_id = cursor.fetchone()[0]
            logger.info(f"Programa VMI creado: {programa_id} para proveedor {data.get('proveedor_cuit')}")
            return programa_id

    except Exception as e:
        logger.error(f"Error creando programa VMI: {str(e)}", exc_info=True)
        return None


def obtener_programas(filtros: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Obtiene programas VMI con paginación y filtros.

    Args:
        filtros: Dict opcional con estado, proveedor_cuit, page, per_page

    Returns:
        Dict con items, total, page, per_page
    """
    try:
        filtros = filtros or {}
        placeholder = '%s' if is_using_postgresql() else '?'
        page = filtros.get('page', 1)
        per_page = filtros.get('per_page', 50)
        offset = (page - 1) * per_page

        # Build WHERE clause
        conditions = []
        params = []

        if filtros.get('estado'):
            conditions.append(f"estado = {placeholder}")
            params.append(filtros['estado'])

        if filtros.get('proveedor_cuit'):
            conditions.append(f"proveedor_cuit = {placeholder}")
            params.append(filtros['proveedor_cuit'])

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get total count
            cursor.execute(f"""
                SELECT COUNT(*) FROM vmi_programa
                WHERE {where_clause}
            """, params)
            total = cursor.fetchone()[0]

            # Get paginated items
            cursor.execute(f"""
                SELECT id, proveedor_cuit, materiales_incluidos, min_stock,
                       max_stock, punto_pedido, lead_time_dias, tipo_reposicion,
                       consumo_diario_promedio, estado, creado_por, fecha_creacion
                FROM vmi_programa
                WHERE {where_clause}
                ORDER BY fecha_creacion DESC
                LIMIT {placeholder} OFFSET {placeholder}
            """, params + [per_page, offset])

            columns = [desc[0] for desc in cursor.description]
            items = [dict(zip(columns, row)) for row in cursor.fetchall()]

            return {
                'items': items,
                'total': total,
                'page': page,
                'per_page': per_page
            }

    except Exception as e:
        logger.error(f"Error obteniendo programas VMI: {str(e)}", exc_info=True)
        return {'items': [], 'total': 0, 'page': page, 'per_page': per_page}


def obtener_detalle_programa(programa_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtiene el detalle completo de un programa VMI.

    Args:
        programa_id: ID del programa

    Returns:
        Dict con programa, inventario_actual, reposiciones_pendientes, kpis
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get programa
            cursor.execute(f"""
                SELECT id, proveedor_cuit, materiales_incluidos, min_stock,
                       max_stock, punto_pedido, lead_time_dias, tipo_reposicion,
                       consumo_diario_promedio, estado, creado_por, fecha_creacion
                FROM vmi_programa
                WHERE id = {placeholder}
            """, (programa_id,))

            programa_row = cursor.fetchone()
            if not programa_row:
                return None

            columns = [desc[0] for desc in cursor.description]
            programa = dict(zip(columns, programa_row))

            # Get latest inventario
            cursor.execute(f"""
                SELECT id, fecha, stock_disponible, stock_transito,
                       stock_proyectado_7d, dias_inventario, alerta
                FROM vmi_inventario_compartido
                WHERE programa_id = {placeholder}
                ORDER BY fecha DESC
                LIMIT 1
            """, (programa_id,))

            inv_row = cursor.fetchone()
            inventario_actual = None
            if inv_row:
                inv_columns = [desc[0] for desc in cursor.description]
                inventario_actual = dict(zip(inv_columns, inv_row))

            # Get pending reposiciones
            cursor.execute(f"""
                SELECT id, tipo, cantidad_sugerida, cantidad_aprobada,
                       fecha_entrega_esperada, estado, creado_por, fecha_creacion
                FROM vmi_reposicion
                WHERE programa_id = {placeholder}
                AND estado IN ('pending', 'approved')
                ORDER BY fecha_creacion DESC
            """, (programa_id,))

            rep_columns = [desc[0] for desc in cursor.description]
            reposiciones_pendientes = [
                dict(zip(rep_columns, row)) for row in cursor.fetchall()
            ]

            # Get latest KPIs
            cursor.execute(f"""
                SELECT mes, stockout_count, fill_rate, avg_inventory_level,
                       reposiciones_count, on_time_delivery_rate
                FROM vmi_kpi_snapshot
                WHERE programa_id = {placeholder}
                ORDER BY mes DESC
                LIMIT 1
            """, (programa_id,))

            kpi_row = cursor.fetchone()
            kpis = None
            if kpi_row:
                kpi_columns = [desc[0] for desc in cursor.description]
                kpis = dict(zip(kpi_columns, kpi_row))

            return {
                'programa': programa,
                'inventario_actual': inventario_actual,
                'reposiciones_pendientes': reposiciones_pendientes,
                'kpis': kpis
            }

    except Exception as e:
        logger.error(f"Error obteniendo detalle de programa {programa_id}: {str(e)}", exc_info=True)
        return None


def actualizar_programa(programa_id: int, data: Dict[str, Any]) -> bool:
    """
    Actualiza un programa VMI.

    Args:
        programa_id: ID del programa
        data: Dict con campos a actualizar

    Returns:
        True si se actualizó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        # Build SET clause
        updates = []
        params = []

        if 'min_stock' in data:
            updates.append(f"min_stock = {placeholder}")
            params.append(data['min_stock'])

        if 'max_stock' in data:
            updates.append(f"max_stock = {placeholder}")
            params.append(data['max_stock'])

        if 'punto_pedido' in data:
            updates.append(f"punto_pedido = {placeholder}")
            params.append(data['punto_pedido'])

        if 'lead_time_dias' in data:
            updates.append(f"lead_time_dias = {placeholder}")
            params.append(data['lead_time_dias'])

        if 'tipo_reposicion' in data:
            updates.append(f"tipo_reposicion = {placeholder}")
            params.append(data['tipo_reposicion'])

        if 'consumo_diario_promedio' in data:
            updates.append(f"consumo_diario_promedio = {placeholder}")
            params.append(data['consumo_diario_promedio'])

        if 'estado' in data:
            updates.append(f"estado = {placeholder}")
            params.append(data['estado'])

        if not updates:
            return False

        params.append(programa_id)
        set_clause = ", ".join(updates)

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE vmi_programa
                SET {set_clause}
                WHERE id = {placeholder}
            """, params)

            logger.info(f"Programa VMI {programa_id} actualizado")
            return True

    except Exception as e:
        logger.error(f"Error actualizando programa {programa_id}: {str(e)}", exc_info=True)
        return False


def actualizar_inventario(programa_id: int, data: Dict[str, Any]) -> bool:
    """
    Actualiza el inventario compartido de un programa VMI.

    Args:
        programa_id: ID del programa
        data: Dict con stock_disponible, stock_transito

    Returns:
        True si se actualizó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        # Get programa for calculations
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(f"""
                SELECT min_stock, punto_pedido, consumo_diario_promedio
                FROM vmi_programa
                WHERE id = {placeholder}
            """, (programa_id,))

            programa_row = cursor.fetchone()
            if not programa_row:
                return False

            min_stock, punto_pedido, consumo_diario = programa_row

        # Calculate metrics
        stock_disponible = data.get('stock_disponible', 0)
        stock_transito = data.get('stock_transito', 0)

        # Días de inventario
        if consumo_diario > 0:
            dias_inventario = stock_disponible / consumo_diario
        else:
            dias_inventario = 999

        # Stock proyectado a 7 días
        stock_proyectado_7d = stock_disponible - (consumo_diario * 7)

        # Alerta
        if stock_disponible < min_stock:
            alerta = 'stock_bajo'
        elif stock_disponible < punto_pedido:
            alerta = 'reposicion_sugerida'
        else:
            alerta = 'ok'

        # UPSERT inventario
        fecha_actual = datetime.utcnow().date()

        with get_db_transaction() as (conn, cursor):
            if is_using_postgresql():
                cursor.execute(f"""
                    INSERT INTO vmi_inventario_compartido
                    (programa_id, fecha, stock_disponible, stock_transito,
                     stock_proyectado_7d, dias_inventario, alerta)
                    VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder},
                            {placeholder}, {placeholder}, {placeholder})
                    ON CONFLICT (programa_id, fecha)
                    DO UPDATE SET
                        stock_disponible = {placeholder},
                        stock_transito = {placeholder},
                        stock_proyectado_7d = {placeholder},
                        dias_inventario = {placeholder},
                        alerta = {placeholder}
                """, (
                    programa_id, fecha_actual, stock_disponible, stock_transito,
                    stock_proyectado_7d, dias_inventario, alerta,
                    stock_disponible, stock_transito, stock_proyectado_7d,
                    dias_inventario, alerta
                ))
            else:
                # SQLite: check if exists
                cursor.execute(f"""
                    SELECT id FROM vmi_inventario_compartido
                    WHERE programa_id = {placeholder} AND fecha = {placeholder}
                """, (programa_id, fecha_actual))

                if cursor.fetchone():
                    cursor.execute(f"""
                        UPDATE vmi_inventario_compartido
                        SET stock_disponible = {placeholder},
                            stock_transito = {placeholder},
                            stock_proyectado_7d = {placeholder},
                            dias_inventario = {placeholder},
                            alerta = {placeholder}
                        WHERE programa_id = {placeholder} AND fecha = {placeholder}
                    """, (
                        stock_disponible, stock_transito, stock_proyectado_7d,
                        dias_inventario, alerta, programa_id, fecha_actual
                    ))
                else:
                    cursor.execute(f"""
                        INSERT INTO vmi_inventario_compartido
                        (programa_id, fecha, stock_disponible, stock_transito,
                         stock_proyectado_7d, dias_inventario, alerta)
                        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder},
                                {placeholder}, {placeholder}, {placeholder})
                    """, (
                        programa_id, fecha_actual, stock_disponible, stock_transito,
                        stock_proyectado_7d, dias_inventario, alerta
                    ))

            logger.info(f"Inventario VMI actualizado para programa {programa_id}")
            return True

    except Exception as e:
        logger.error(f"Error actualizando inventario VMI: {str(e)}", exc_info=True)
        return False


def obtener_reposiciones(filtros: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Obtiene reposiciones VMI con filtros opcionales.

    Args:
        filtros: Dict opcional con estado

    Returns:
        Lista de reposiciones con contexto del programa
    """
    try:
        filtros = filtros or {}
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            if filtros.get('estado'):
                cursor.execute(f"""
                    SELECT
                        r.id, r.programa_id, r.tipo, r.cantidad_sugerida,
                        r.cantidad_aprobada, r.fecha_entrega_esperada, r.estado,
                        r.aprobado_por, r.razon_rechazo, r.creado_por, r.fecha_creacion,
                        p.proveedor_cuit, p.materiales_incluidos
                    FROM vmi_reposicion r
                    JOIN vmi_programa p ON r.programa_id = p.id
                    WHERE r.estado = {placeholder}
                    ORDER BY r.fecha_creacion DESC
                """, (filtros['estado'],))
            else:
                cursor.execute("""
                    SELECT
                        r.id, r.programa_id, r.tipo, r.cantidad_sugerida,
                        r.cantidad_aprobada, r.fecha_entrega_esperada, r.estado,
                        r.aprobado_por, r.razon_rechazo, r.creado_por, r.fecha_creacion,
                        p.proveedor_cuit, p.materiales_incluidos
                    FROM vmi_reposicion r
                    JOIN vmi_programa p ON r.programa_id = p.id
                    ORDER BY r.fecha_creacion DESC
                """)

            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]

    except Exception as e:
        logger.error(f"Error obteniendo reposiciones VMI: {str(e)}", exc_info=True)
        return []


def aprobar_reposicion(
    reposicion_id: int,
    user_id: int,
    cantidad_aprobada: Optional[float] = None
) -> bool:
    """
    Aprueba una reposición VMI.

    Args:
        reposicion_id: ID de la reposición
        user_id: ID del usuario que aprueba
        cantidad_aprobada: Cantidad aprobada (opcional, usa cantidad_sugerida si no se provee)

    Returns:
        True si se aprobó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # Get cantidad_sugerida if cantidad_aprobada not provided
            if cantidad_aprobada is None:
                cursor.execute(f"""
                    SELECT cantidad_sugerida FROM vmi_reposicion
                    WHERE id = {placeholder}
                """, (reposicion_id,))
                row = cursor.fetchone()
                if not row:
                    return False
                cantidad_aprobada = row[0]

            # Update reposicion
            cursor.execute(f"""
                UPDATE vmi_reposicion
                SET estado = 'approved',
                    cantidad_aprobada = {placeholder},
                    aprobado_por = {placeholder}
                WHERE id = {placeholder}
            """, (cantidad_aprobada, user_id, reposicion_id))

            # TODO: Optionally create OC stub here if needed
            # This would require integration with orden_compra table

            logger.info(f"Reposición VMI {reposicion_id} aprobada por usuario {user_id}")
            return True

    except Exception as e:
        logger.error(f"Error aprobando reposición {reposicion_id}: {str(e)}", exc_info=True)
        return False


def rechazar_reposicion(reposicion_id: int, user_id: int, razon: str) -> bool:
    """
    Rechaza una reposición VMI.

    Args:
        reposicion_id: ID de la reposición
        user_id: ID del usuario que rechaza
        razon: Razón del rechazo

    Returns:
        True si se rechazó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE vmi_reposicion
                SET estado = 'rejected',
                    aprobado_por = {placeholder},
                    razon_rechazo = {placeholder}
                WHERE id = {placeholder}
            """, (user_id, razon, reposicion_id))

            logger.info(f"Reposición VMI {reposicion_id} rechazada por usuario {user_id}")
            return True

    except Exception as e:
        logger.error(f"Error rechazando reposición {reposicion_id}: {str(e)}", exc_info=True)
        return False


def evaluar_reposiciones_diario() -> bool:
    """
    Evalúa programas VMI activos y crea reposiciones automáticas si es necesario.
    Llamado por Celery diariamente.

    Returns:
        True si se completó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'
        reposiciones_creadas = 0

        with get_db_transaction() as (conn, cursor):
            # Get active programs
            cursor.execute("""
                SELECT id, proveedor_cuit, min_stock, max_stock, punto_pedido,
                       lead_time_dias, tipo_reposicion, consumo_diario_promedio
                FROM vmi_programa
                WHERE estado = 'active'
            """)

            programas = cursor.fetchall()

            for programa in programas:
                prog_id, cuit, min_stock, max_stock, rop, lead_time, tipo_repo, consumo = programa

                # Get latest inventario
                cursor.execute(f"""
                    SELECT stock_disponible, stock_proyectado_7d
                    FROM vmi_inventario_compartido
                    WHERE programa_id = {placeholder}
                    ORDER BY fecha DESC
                    LIMIT 1
                """, (prog_id,))

                inv_row = cursor.fetchone()
                if not inv_row:
                    continue

                stock_disponible, stock_proyectado = inv_row

                # Check if reposicion needed
                if stock_proyectado < rop:
                    # Check if pending reposicion already exists
                    cursor.execute(f"""
                        SELECT COUNT(*) FROM vmi_reposicion
                        WHERE programa_id = {placeholder}
                        AND estado IN ('pending', 'approved')
                    """, (prog_id,))

                    pending_count = cursor.fetchone()[0]
                    if pending_count > 0:
                        continue  # Skip if already have pending

                    # Calculate cantidad_sugerida based on tipo_reposicion
                    if tipo_repo == 'min_max':
                        cantidad_sugerida = max_stock - stock_disponible
                    elif tipo_repo == 'eoq':
                        # Simplified EOQ: sqrt(2 * annual_demand * order_cost / holding_cost)
                        # For now, use (max - min) as approximation
                        cantidad_sugerida = max_stock - min_stock
                    elif tipo_repo == 'fixed_order':
                        cantidad_sugerida = rop * 2  # Simple 2x ROP
                    else:
                        cantidad_sugerida = max_stock - stock_disponible

                    # Calculate expected delivery date
                    fecha_entrega = datetime.utcnow() + timedelta(days=lead_time)

                    # Create reposicion
                    cursor.execute(f"""
                        INSERT INTO vmi_reposicion
                        (programa_id, tipo, cantidad_sugerida, fecha_entrega_esperada,
                         estado, creado_por, fecha_creacion)
                        VALUES ({placeholder}, 'automatic', {placeholder}, {placeholder},
                                'pending', 0, {placeholder})
                    """, (prog_id, cantidad_sugerida, fecha_entrega, datetime.utcnow()))

                    reposiciones_creadas += 1
                    logger.info(f"Reposición automática creada para programa VMI {prog_id}")

            logger.info(f"Evaluación VMI completada: {reposiciones_creadas} reposiciones creadas")
            return True

    except Exception as e:
        logger.error(f"Error evaluando reposiciones VMI: {str(e)}", exc_info=True)
        return False


def obtener_dashboard_vmi() -> Dict[str, Any]:
    """
    Obtiene KPIs agregados para el dashboard VMI.

    Returns:
        Dict con programas_activos, reposiciones_pendientes, avg_fill_rate
    """
    dashboard = {
        'programas_activos': 0,
        'reposiciones_pendientes': 0,
        'avg_fill_rate': 0.0
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
                WHERE estado = 'pending'
            """)
            dashboard['reposiciones_pendientes'] = cursor.fetchone()[0]

            # Average fill rate from latest snapshots
            cursor.execute("""
                SELECT AVG(fill_rate)
                FROM (
                    SELECT DISTINCT ON (programa_id) fill_rate
                    FROM vmi_kpi_snapshot
                    ORDER BY programa_id, mes DESC
                ) latest
            """ if is_using_postgresql() else """
                SELECT AVG(fill_rate)
                FROM vmi_kpi_snapshot
                WHERE (programa_id, mes) IN (
                    SELECT programa_id, MAX(mes)
                    FROM vmi_kpi_snapshot
                    GROUP BY programa_id
                )
            """)

            result = cursor.fetchone()[0]
            dashboard['avg_fill_rate'] = round(result or 0.0, 2)

            return dashboard

    except Exception as e:
        logger.error(f"Error obteniendo dashboard VMI: {str(e)}", exc_info=True)
        return dashboard


def calcular_kpis_mensual() -> bool:
    """
    Calcula KPIs mensuales para cada programa VMI activo.
    Llamado por Celery mensualmente.

    Returns:
        True si se completó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'
        mes_actual = datetime.utcnow().strftime('%Y-%m')

        with get_db_transaction() as (conn, cursor):
            # Get active programs
            cursor.execute("""
                SELECT id FROM vmi_programa
                WHERE estado = 'active'
            """)

            programas = cursor.fetchall()

            for programa_row in programas:
                prog_id = programa_row[0]

                # Calculate stockout count (days with stock < min)
                cursor.execute(f"""
                    SELECT COUNT(*)
                    FROM vmi_inventario_compartido inv
                    JOIN vmi_programa prog ON inv.programa_id = prog.id
                    WHERE inv.programa_id = {placeholder}
                    AND inv.fecha >= date_trunc('month', CURRENT_DATE)
                    AND inv.stock_disponible < prog.min_stock
                """ if is_using_postgresql() else f"""
                    SELECT COUNT(*)
                    FROM vmi_inventario_compartido inv
                    JOIN vmi_programa prog ON inv.programa_id = prog.id
                    WHERE inv.programa_id = {placeholder}
                    AND inv.fecha >= date('now', 'start of month')
                    AND inv.stock_disponible < prog.min_stock
                """, (prog_id,))

                stockout_count = cursor.fetchone()[0]

                # Calculate fill rate (simplified: days without stockout / total days)
                cursor.execute(f"""
                    SELECT COUNT(*)
                    FROM vmi_inventario_compartido
                    WHERE programa_id = {placeholder}
                    AND fecha >= date_trunc('month', CURRENT_DATE)
                """ if is_using_postgresql() else f"""
                    SELECT COUNT(*)
                    FROM vmi_inventario_compartido
                    WHERE programa_id = {placeholder}
                    AND fecha >= date('now', 'start of month')
                """, (prog_id,))

                total_days = cursor.fetchone()[0]
                if total_days > 0:
                    fill_rate = ((total_days - stockout_count) / total_days) * 100
                else:
                    fill_rate = 100.0

                # Average inventory level
                cursor.execute(f"""
                    SELECT AVG(stock_disponible)
                    FROM vmi_inventario_compartido
                    WHERE programa_id = {placeholder}
                    AND fecha >= date_trunc('month', CURRENT_DATE)
                """ if is_using_postgresql() else f"""
                    SELECT AVG(stock_disponible)
                    FROM vmi_inventario_compartido
                    WHERE programa_id = {placeholder}
                    AND fecha >= date('now', 'start of month')
                """, (prog_id,))

                avg_inv = cursor.fetchone()[0] or 0.0

                # Reposiciones count
                cursor.execute(f"""
                    SELECT COUNT(*)
                    FROM vmi_reposicion
                    WHERE programa_id = {placeholder}
                    AND fecha_creacion >= date_trunc('month', CURRENT_DATE)
                """ if is_using_postgresql() else f"""
                    SELECT COUNT(*)
                    FROM vmi_reposicion
                    WHERE programa_id = {placeholder}
                    AND fecha_creacion >= date('now', 'start of month')
                """, (prog_id,))

                reposiciones_count = cursor.fetchone()[0]

                # On-time delivery rate (simplified: approved repos / total repos)
                if reposiciones_count > 0:
                    cursor.execute(f"""
                        SELECT COUNT(*)
                        FROM vmi_reposicion
                        WHERE programa_id = {placeholder}
                        AND fecha_creacion >= date_trunc('month', CURRENT_DATE)
                        AND estado = 'approved'
                    """ if is_using_postgresql() else f"""
                        SELECT COUNT(*)
                        FROM vmi_reposicion
                        WHERE programa_id = {placeholder}
                        AND fecha_creacion >= date('now', 'start of month')
                        AND estado = 'approved'
                    """, (prog_id,))

                    approved_count = cursor.fetchone()[0]
                    on_time_rate = (approved_count / reposiciones_count) * 100
                else:
                    on_time_rate = 100.0

                # UPSERT KPI snapshot
                if is_using_postgresql():
                    cursor.execute(f"""
                        INSERT INTO vmi_kpi_snapshot
                        (programa_id, mes, stockout_count, fill_rate, avg_inventory_level,
                         reposiciones_count, on_time_delivery_rate)
                        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder},
                                {placeholder}, {placeholder}, {placeholder})
                        ON CONFLICT (programa_id, mes)
                        DO UPDATE SET
                            stockout_count = {placeholder},
                            fill_rate = {placeholder},
                            avg_inventory_level = {placeholder},
                            reposiciones_count = {placeholder},
                            on_time_delivery_rate = {placeholder}
                    """, (
                        prog_id, mes_actual, stockout_count, fill_rate, avg_inv,
                        reposiciones_count, on_time_rate,
                        stockout_count, fill_rate, avg_inv, reposiciones_count, on_time_rate
                    ))
                else:
                    cursor.execute(f"""
                        INSERT OR REPLACE INTO vmi_kpi_snapshot
                        (programa_id, mes, stockout_count, fill_rate, avg_inventory_level,
                         reposiciones_count, on_time_delivery_rate)
                        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder},
                                {placeholder}, {placeholder}, {placeholder})
                    """, (
                        prog_id, mes_actual, stockout_count, fill_rate, avg_inv,
                        reposiciones_count, on_time_rate
                    ))

                logger.info(f"KPIs VMI calculados para programa {prog_id}, mes {mes_actual}")

            logger.info(f"Cálculo de KPIs VMI completado para {len(programas)} programas")
            return True

    except Exception as e:
        logger.error(f"Error calculando KPIs VMI mensuales: {str(e)}", exc_info=True)
        return False
