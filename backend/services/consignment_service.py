"""
Servicio de Consignment Inventory.
Gestiona programas de inventario en consignación (supplier-owned inventory at customer location).
"""

import logging
from typing import Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def crear_programa(datos: dict) -> int:
    """
    Crea un nuevo programa de consignación.

    Args:
        datos: {
            proveedor_cuit: str,
            almacen_id: int (optional),
            nombre: str,
            descripcion: str (optional),
            condiciones_pago: str (optional),
            porcentaje_margen: float (optional),
            periodo_reconciliacion: str (optional, 'mensual' | 'quincenal')
        }

    Returns:
        ID del programa creado
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            cursor.execute("""
                INSERT INTO consignment_programa
                (proveedor_cuit, almacen_id, nombre, descripcion, condiciones_pago, porcentaje_margen, periodo_reconciliacion, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                RETURNING id
            """, (
                datos['proveedor_cuit'],
                datos.get('almacen_id'),
                datos['nombre'],
                datos.get('descripcion'),
                datos.get('condiciones_pago'),
                datos.get('porcentaje_margen'),
                datos.get('periodo_reconciliacion', 'mensual')
            ))
            programa_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO consignment_programa
                (proveedor_cuit, almacen_id, nombre, descripcion, condiciones_pago, porcentaje_margen, periodo_reconciliacion, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (
                datos['proveedor_cuit'],
                datos.get('almacen_id'),
                datos['nombre'],
                datos.get('descripcion'),
                datos.get('condiciones_pago'),
                datos.get('porcentaje_margen'),
                datos.get('periodo_reconciliacion', 'mensual')
            ))
            programa_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Programa de consignación creado: {programa_id}")
        return programa_id


def obtener_programas(filtros: dict = None) -> dict:
    """
    Obtiene programas de consignación con paginación.

    Args:
        filtros: {
            estado: str (optional),
            proveedor_cuit: str (optional),
            page: int (default: 1),
            per_page: int (default: 50)
        }

    Returns:
        {
            items: [...],
            total: int,
            page: int,
            per_page: int
        }
    """
    filtros = filtros or {}
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    page = filtros.get('page', 1)
    per_page = filtros.get('per_page', 50)
    offset = (page - 1) * per_page

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Build WHERE clauses
        where_clauses = []
        params = []

        if filtros.get('estado'):
            where_clauses.append(f"cp.estado = {placeholder}")
            params.append(filtros['estado'])

        if filtros.get('proveedor_cuit'):
            where_clauses.append(f"cp.proveedor_cuit = {placeholder}")
            params.append(filtros['proveedor_cuit'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        # Count total
        cursor.execute(f"SELECT COUNT(*) FROM consignment_programa cp {where_sql}", params)
        total = cursor.fetchone()[0]

        # Get paginated data
        cursor.execute(f"""
            SELECT
                cp.id, cp.proveedor_cuit, p.nombre as proveedor_nombre,
                cp.almacen_id, cp.nombre, cp.descripcion, cp.estado,
                cp.condiciones_pago, cp.porcentaje_margen, cp.periodo_reconciliacion,
                cp.created_at, cp.updated_at
            FROM consignment_programa cp
            LEFT JOIN proveedores p ON cp.proveedor_cuit = p.cuit
            {where_sql}
            ORDER BY cp.created_at DESC
            LIMIT {placeholder} OFFSET {placeholder}
        """, params + [per_page, offset])

        items = []
        for row in cursor.fetchall():
            items.append({
                'id': row[0],
                'proveedor_cuit': row[1],
                'proveedor_nombre': row[2],
                'almacen_id': row[3],
                'nombre': row[4],
                'descripcion': row[5],
                'estado': row[6],
                'condiciones_pago': row[7],
                'porcentaje_margen': float(row[8]) if row[8] else None,
                'periodo_reconciliacion': row[9],
                'created_at': row[10],
                'updated_at': row[11]
            })

        return {
            'items': items,
            'total': total,
            'page': page,
            'per_page': per_page
        }
    finally:
        cursor.close()
        conn.close()


def obtener_detalle_programa(programa_id: int) -> dict:
    """
    Obtiene detalle completo de un programa de consignación.

    Args:
        programa_id: ID del programa

    Returns:
        {
            programa: {...},
            stock: [...],
            consumos_recientes: [...],
            reconciliaciones: [...]
        }
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Programa
        cursor.execute(f"""
            SELECT
                cp.id, cp.proveedor_cuit, p.nombre as proveedor_nombre,
                cp.almacen_id, cp.nombre, cp.descripcion, cp.estado,
                cp.condiciones_pago, cp.porcentaje_margen, cp.periodo_reconciliacion,
                cp.created_at, cp.updated_at
            FROM consignment_programa cp
            LEFT JOIN proveedores p ON cp.proveedor_cuit = p.cuit
            WHERE cp.id = {placeholder}
        """, (programa_id,))

        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Programa {programa_id} no encontrado")

        programa = {
            'id': row[0],
            'proveedor_cuit': row[1],
            'proveedor_nombre': row[2],
            'almacen_id': row[3],
            'nombre': row[4],
            'descripcion': row[5],
            'estado': row[6],
            'condiciones_pago': row[7],
            'porcentaje_margen': float(row[8]) if row[8] else None,
            'periodo_reconciliacion': row[9],
            'created_at': row[10],
            'updated_at': row[11]
        }

        # 2. Stock actual
        cursor.execute(f"""
            SELECT
                cs.id, cs.material_codigo, cs.cantidad_disponible,
                cs.cantidad_consumida_acumulada, cs.valor_unitario, cs.ultima_actualizacion
            FROM consignment_stock cs
            WHERE cs.programa_id = {placeholder}
            ORDER BY cs.material_codigo
        """, (programa_id,))

        stock = []
        for row in cursor.fetchall():
            stock.append({
                'id': row[0],
                'material_codigo': row[1],
                'cantidad_disponible': float(row[2]) if row[2] else 0,
                'cantidad_consumida_acumulada': float(row[3]) if row[3] else 0,
                'valor_unitario': float(row[4]) if row[4] else None,
                'ultima_actualizacion': row[5]
            })

        # 3. Consumos recientes (últimos 100)
        cursor.execute(f"""
            SELECT
                cc.id, cc.stock_id, cs.material_codigo, cc.cantidad,
                cc.solicitud_id, cc.usuario_id, cc.fecha_consumo, cc.facturado,
                cc.factura_id
            FROM consignment_consumo cc
            JOIN consignment_stock cs ON cc.stock_id = cs.id
            WHERE cs.programa_id = {placeholder}
            ORDER BY cc.fecha_consumo DESC
            LIMIT 100
        """, (programa_id,))

        consumos_recientes = []
        for row in cursor.fetchall():
            consumos_recientes.append({
                'id': row[0],
                'stock_id': row[1],
                'material_codigo': row[2],
                'cantidad': float(row[3]) if row[3] else 0,
                'solicitud_id': row[4],
                'usuario_id': row[5],
                'fecha_consumo': row[6],
                'facturado': bool(row[7]),
                'factura_id': row[8]
            })

        # 4. Reconciliaciones
        cursor.execute(f"""
            SELECT
                id, periodo, cantidad_consumida_total, monto_total, estado,
                fecha_envio, fecha_confirmacion, notas, created_at, updated_at
            FROM consignment_reconciliacion
            WHERE programa_id = {placeholder}
            ORDER BY periodo DESC
        """, (programa_id,))

        reconciliaciones = []
        for row in cursor.fetchall():
            reconciliaciones.append({
                'id': row[0],
                'periodo': row[1],
                'cantidad_consumida_total': float(row[2]) if row[2] else 0,
                'monto_total': float(row[3]) if row[3] else 0,
                'estado': row[4],
                'fecha_envio': row[5],
                'fecha_confirmacion': row[6],
                'notas': row[7],
                'created_at': row[8],
                'updated_at': row[9]
            })

        return {
            'programa': programa,
            'stock': stock,
            'consumos_recientes': consumos_recientes,
            'reconciliaciones': reconciliaciones
        }
    finally:
        cursor.close()
        conn.close()


def actualizar_stock(programa_id: int, material_codigo: str, cantidad_disponible: float, valor_unitario: Optional[float] = None) -> int:
    """
    Actualiza stock de un material en consignación (UPSERT).

    Args:
        programa_id: ID del programa
        material_codigo: Código del material
        cantidad_disponible: Cantidad disponible actual
        valor_unitario: Valor unitario (optional)

    Returns:
        ID del stock creado/actualizado
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            # PostgreSQL: ON CONFLICT
            cursor.execute("""
                INSERT INTO consignment_stock
                (programa_id, material_codigo, cantidad_disponible, valor_unitario, ultima_actualizacion, created_at)
                VALUES (%s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (programa_id, material_codigo)
                DO UPDATE SET
                    cantidad_disponible = EXCLUDED.cantidad_disponible,
                    valor_unitario = COALESCE(EXCLUDED.valor_unitario, consignment_stock.valor_unitario),
                    ultima_actualizacion = NOW()
                RETURNING id
            """, (programa_id, material_codigo, cantidad_disponible, valor_unitario))
            stock_id = cursor.fetchone()[0]
        else:
            # SQLite: INSERT OR REPLACE
            # First, check if exists
            cursor.execute("""
                SELECT id FROM consignment_stock
                WHERE programa_id = ? AND material_codigo = ?
            """, (programa_id, material_codigo))
            existing = cursor.fetchone()

            if existing:
                stock_id = existing[0]
                cursor.execute("""
                    UPDATE consignment_stock
                    SET cantidad_disponible = ?,
                        valor_unitario = COALESCE(?, valor_unitario),
                        ultima_actualizacion = datetime('now')
                    WHERE id = ?
                """, (cantidad_disponible, valor_unitario, stock_id))
            else:
                cursor.execute("""
                    INSERT INTO consignment_stock
                    (programa_id, material_codigo, cantidad_disponible, valor_unitario, ultima_actualizacion, created_at)
                    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
                """, (programa_id, material_codigo, cantidad_disponible, valor_unitario))
                stock_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Stock actualizado: programa={programa_id}, material={material_codigo}, qty={cantidad_disponible}")
        return stock_id


def registrar_consumo(stock_id: int, cantidad: float, solicitud_id: Optional[int] = None, usuario_id: Optional[int] = None) -> int:
    """
    Registra consumo de material en consignación.

    Args:
        stock_id: ID del stock
        cantidad: Cantidad consumida
        solicitud_id: ID de la solicitud (optional)
        usuario_id: ID del usuario (optional)

    Returns:
        ID del consumo registrado
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # 1. Decrementar stock disponible, incrementar consumida_acumulada
        cursor.execute(f"""
            UPDATE consignment_stock
            SET cantidad_disponible = cantidad_disponible - {placeholder},
                cantidad_consumida_acumulada = cantidad_consumida_acumulada + {placeholder},
                ultima_actualizacion = {'NOW()' if using_pg else "datetime('now')"}
            WHERE id = {placeholder}
        """, (cantidad, cantidad, stock_id))

        # 2. Insertar registro de consumo
        if using_pg:
            cursor.execute("""
                INSERT INTO consignment_consumo
                (stock_id, cantidad, solicitud_id, usuario_id, fecha_consumo, facturado, created_at)
                VALUES (%s, %s, %s, %s, NOW(), 0, NOW())
                RETURNING id
            """, (stock_id, cantidad, solicitud_id, usuario_id))
            consumo_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO consignment_consumo
                (stock_id, cantidad, solicitud_id, usuario_id, fecha_consumo, facturado, created_at)
                VALUES (?, ?, ?, ?, datetime('now'), 0, datetime('now'))
            """, (stock_id, cantidad, solicitud_id, usuario_id))
            consumo_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Consumo registrado: stock={stock_id}, cantidad={cantidad}, consumo_id={consumo_id}")
        return consumo_id


def generar_reconciliacion(programa_id: int, periodo: str) -> int:
    """
    Genera reconciliación de consumos no facturados.

    Args:
        programa_id: ID del programa
        periodo: Periodo (formato YYYY-MM)

    Returns:
        ID de la reconciliación creada
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # 1. Sumar consumos no facturados del periodo
        if using_pg:
            cursor.execute(f"""
                SELECT SUM(cc.cantidad), SUM(cc.cantidad * cs.valor_unitario)
                FROM consignment_consumo cc
                JOIN consignment_stock cs ON cc.stock_id = cs.id
                WHERE cs.programa_id = {placeholder}
                AND cc.facturado = 0
                AND DATE_TRUNC('month', cc.fecha_consumo) = TO_DATE({placeholder}, 'YYYY-MM')
            """, (programa_id, periodo))
        else:
            cursor.execute(f"""
                SELECT SUM(cc.cantidad), SUM(cc.cantidad * cs.valor_unitario)
                FROM consignment_consumo cc
                JOIN consignment_stock cs ON cc.stock_id = cs.id
                WHERE cs.programa_id = {placeholder}
                AND cc.facturado = 0
                AND strftime('%Y-%m', cc.fecha_consumo) = {placeholder}
            """, (programa_id, periodo))

        row = cursor.fetchone()
        cantidad_total = float(row[0]) if row[0] else 0
        monto_total = float(row[1]) if row[1] else 0

        # 2. Crear reconciliación
        if using_pg:
            cursor.execute("""
                INSERT INTO consignment_reconciliacion
                (programa_id, periodo, cantidad_consumida_total, monto_total, estado, created_at, updated_at)
                VALUES (%s, %s, %s, %s, 'draft', NOW(), NOW())
                RETURNING id
            """, (programa_id, periodo, cantidad_total, monto_total))
            recon_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO consignment_reconciliacion
                (programa_id, periodo, cantidad_consumida_total, monto_total, estado, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))
            """, (programa_id, periodo, cantidad_total, monto_total))
            recon_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Reconciliación generada: programa={programa_id}, periodo={periodo}, total={monto_total}")
        return recon_id


def enviar_reconciliacion(reconciliacion_id: int, notas: Optional[str] = None) -> None:
    """
    Envía reconciliación al proveedor.

    Args:
        reconciliacion_id: ID de la reconciliación
        notas: Notas adicionales (optional)
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        cursor.execute(f"""
            UPDATE consignment_reconciliacion
            SET estado = 'enviado',
                fecha_envio = {'NOW()' if using_pg else "datetime('now')"},
                notas = {placeholder},
                updated_at = {'NOW()' if using_pg else "datetime('now')"}
            WHERE id = {placeholder}
        """, (notas, reconciliacion_id))

        conn.commit()
        logger.info(f"Reconciliación enviada: {reconciliacion_id}")


def confirmar_reconciliacion(reconciliacion_id: int, notas: Optional[str] = None) -> None:
    """
    Confirma reconciliación desde el proveedor.

    Args:
        reconciliacion_id: ID de la reconciliación
        notas: Notas adicionales (optional)
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        cursor.execute(f"""
            UPDATE consignment_reconciliacion
            SET estado = 'confirmado',
                fecha_confirmacion = {'NOW()' if using_pg else "datetime('now')"},
                notas = COALESCE({placeholder}, notas),
                updated_at = {'NOW()' if using_pg else "datetime('now')"}
            WHERE id = {placeholder}
        """, (notas, reconciliacion_id))

        conn.commit()
        logger.info(f"Reconciliación confirmada: {reconciliacion_id}")


def obtener_kpis(programa_id: Optional[int] = None) -> dict:
    """
    Obtiene KPIs de consignación.

    Args:
        programa_id: ID del programa (opcional, si None devuelve KPIs globales)

    Returns:
        {
            total_consigned_value: float,
            month_consumption: float,
            pending_reconciliations: int
        }
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Total consigned value (stock disponible)
        if programa_id:
            cursor.execute(f"""
                SELECT COALESCE(SUM(cantidad_disponible * valor_unitario), 0)
                FROM consignment_stock
                WHERE programa_id = {placeholder}
            """, (programa_id,))
        else:
            cursor.execute("""
                SELECT COALESCE(SUM(cantidad_disponible * valor_unitario), 0)
                FROM consignment_stock
            """)
        total_consigned_value = float(cursor.fetchone()[0])

        # 2. Consumo del mes actual
        if using_pg:
            if programa_id:
                cursor.execute(f"""
                    SELECT COALESCE(SUM(cc.cantidad * cs.valor_unitario), 0)
                    FROM consignment_consumo cc
                    JOIN consignment_stock cs ON cc.stock_id = cs.id
                    WHERE cs.programa_id = {placeholder}
                    AND DATE_TRUNC('month', cc.fecha_consumo) = DATE_TRUNC('month', CURRENT_DATE)
                """, (programa_id,))
            else:
                cursor.execute("""
                    SELECT COALESCE(SUM(cc.cantidad * cs.valor_unitario), 0)
                    FROM consignment_consumo cc
                    JOIN consignment_stock cs ON cc.stock_id = cs.id
                    WHERE DATE_TRUNC('month', cc.fecha_consumo) = DATE_TRUNC('month', CURRENT_DATE)
                """)
        else:
            if programa_id:
                cursor.execute(f"""
                    SELECT COALESCE(SUM(cc.cantidad * cs.valor_unitario), 0)
                    FROM consignment_consumo cc
                    JOIN consignment_stock cs ON cc.stock_id = cs.id
                    WHERE cs.programa_id = {placeholder}
                    AND strftime('%Y-%m', cc.fecha_consumo) = strftime('%Y-%m', 'now')
                """, (programa_id,))
            else:
                cursor.execute("""
                    SELECT COALESCE(SUM(cc.cantidad * cs.valor_unitario), 0)
                    FROM consignment_consumo cc
                    JOIN consignment_stock cs ON cc.stock_id = cs.id
                    WHERE strftime('%Y-%m', cc.fecha_consumo) = strftime('%Y-%m', 'now')
                """)
        month_consumption = float(cursor.fetchone()[0])

        # 3. Reconciliaciones pendientes
        if programa_id:
            cursor.execute(f"""
                SELECT COUNT(*)
                FROM consignment_reconciliacion
                WHERE programa_id = {placeholder}
                AND estado IN ('draft', 'enviado')
            """, (programa_id,))
        else:
            cursor.execute("""
                SELECT COUNT(*)
                FROM consignment_reconciliacion
                WHERE estado IN ('draft', 'enviado')
            """)
        pending_reconciliations = cursor.fetchone()[0]

        return {
            'total_consigned_value': total_consigned_value,
            'month_consumption': month_consumption,
            'pending_reconciliations': pending_reconciliations
        }
    finally:
        cursor.close()
        conn.close()


def actualizar_programa(programa_id: int, datos: dict) -> None:
    """
    Actualiza un programa de consignación.

    Args:
        programa_id: ID del programa
        datos: Campos a actualizar
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    allowed_fields = ['nombre', 'descripcion', 'estado', 'condiciones_pago', 'porcentaje_margen', 'periodo_reconciliacion']
    updates = []
    params = []

    for field in allowed_fields:
        if field in datos:
            updates.append(f"{field} = {placeholder}")
            params.append(datos[field])

    if not updates:
        return

    now_expr = "NOW()" if using_pg else "datetime('now')"
    updates.append(f"updated_at = {now_expr}")
    params.append(programa_id)

    with get_db_transaction() as (conn, cursor):
        sql = f"UPDATE consignment_programa SET {', '.join(updates)} WHERE id = {placeholder}"
        cursor.execute(sql, params)
        conn.commit()
        logger.info(f"Programa actualizado: {programa_id}")
