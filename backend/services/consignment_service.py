"""
Servicio de Consignment Inventory.
Gestiona programas de inventario en consignación (supplier-owned inventory at customer location).
"""

import logging
from typing import Optional

from backend.core.db import (
    get_db_connection,
    get_db_transaction,
    insert_returning_id,
    sql_datetime_now,
    sql_format_date,
)

logger = logging.getLogger(__name__)

# Placeholder portable: '?' es aceptado por SQLite y PostgresCursorWrapper lo
# convierte a '%s' para PostgreSQL.
PH = '?'


def crear_programa(datos: dict) -> int:
    """Crea un nuevo programa de consignación."""
    with get_db_transaction() as (conn, cursor):
        programa_id = insert_returning_id(
            cursor,
            f"""
            INSERT INTO consignment_programa
            (proveedor_cuit, almacen_id, nombre, descripcion, condiciones_pago, porcentaje_margen, periodo_reconciliacion, created_at, updated_at)
            VALUES ({PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {PH}, {sql_datetime_now()}, {sql_datetime_now()})
            """,
            (
                datos['proveedor_cuit'],
                datos.get('almacen_id'),
                datos['nombre'],
                datos.get('descripcion'),
                datos.get('condiciones_pago'),
                datos.get('porcentaje_margen'),
                datos.get('periodo_reconciliacion', 'mensual'),
            ),
        )
        conn.commit()
        logger.info(f"Programa de consignación creado: {programa_id}")
        return programa_id


def obtener_programas(filtros: dict = None) -> dict:
    """Obtiene programas de consignación con paginación."""
    filtros = filtros or {}
    page = filtros.get('page', 1)
    per_page = filtros.get('per_page', 50)
    offset = (page - 1) * per_page

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        where_clauses = []
        params = []

        if filtros.get('estado'):
            where_clauses.append(f"cp.estado = {PH}")
            params.append(filtros['estado'])

        if filtros.get('proveedor_cuit'):
            where_clauses.append(f"cp.proveedor_cuit = {PH}")
            params.append(filtros['proveedor_cuit'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cursor.execute(f"SELECT COUNT(*) as cnt FROM consignment_programa cp {where_sql}", params)
        total = cursor.fetchone()['cnt']

        cursor.execute(f"""
            SELECT
                cp.id, cp.proveedor_cuit, p.nombre as proveedor_nombre,
                cp.almacen_id, cp.nombre, cp.descripcion, cp.estado,
                cp.condiciones_pago, cp.porcentaje_margen, cp.periodo_reconciliacion,
                cp.created_at, cp.updated_at
            FROM consignment_programa cp
            LEFT JOIN proveedores p ON cp.proveedor_cuit = p.id_proveedor
            {where_sql}
            ORDER BY cp.created_at DESC
            LIMIT {PH} OFFSET {PH}
        """, params + [per_page, offset])

        items = []
        for row in cursor.fetchall():
            r = dict(row)
            if r.get('porcentaje_margen') is not None:
                r['porcentaje_margen'] = float(r['porcentaje_margen'])
            items.append(r)

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
    """Obtiene detalle completo de un programa de consignación."""
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
            LEFT JOIN proveedores p ON cp.proveedor_cuit = p.id_proveedor
            WHERE cp.id = {PH}
        """, (programa_id,))

        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Programa {programa_id} no encontrado")

        programa = dict(row)
        if programa.get('porcentaje_margen') is not None:
            programa['porcentaje_margen'] = float(programa['porcentaje_margen'])

        # 2. Stock actual
        cursor.execute(f"""
            SELECT
                id, material_codigo, cantidad_disponible,
                cantidad_consumida_acumulada, valor_unitario, ultima_actualizacion
            FROM consignment_stock
            WHERE programa_id = {PH}
            ORDER BY material_codigo
        """, (programa_id,))

        stock = []
        for row in cursor.fetchall():
            r = dict(row)
            r['cantidad_disponible'] = float(r['cantidad_disponible']) if r['cantidad_disponible'] else 0
            r['cantidad_consumida_acumulada'] = float(r['cantidad_consumida_acumulada']) if r['cantidad_consumida_acumulada'] else 0
            r['valor_unitario'] = float(r['valor_unitario']) if r['valor_unitario'] else None
            stock.append(r)

        # 3. Consumos recientes (últimos 100)
        cursor.execute(f"""
            SELECT
                cc.id, cc.stock_id, cs.material_codigo, cc.cantidad,
                cc.solicitud_id, cc.usuario_id, cc.fecha_consumo, cc.facturado,
                cc.factura_id
            FROM consignment_consumo cc
            JOIN consignment_stock cs ON cc.stock_id = cs.id
            WHERE cs.programa_id = {PH}
            ORDER BY cc.fecha_consumo DESC
            LIMIT 100
        """, (programa_id,))

        consumos_recientes = []
        for row in cursor.fetchall():
            r = dict(row)
            r['cantidad'] = float(r['cantidad']) if r['cantidad'] else 0
            r['facturado'] = bool(r['facturado'])
            consumos_recientes.append(r)

        # 4. Reconciliaciones
        cursor.execute(f"""
            SELECT
                id, periodo, cantidad_consumida_total, monto_total, estado,
                fecha_envio, fecha_confirmacion, notas, created_at, updated_at
            FROM consignment_reconciliacion
            WHERE programa_id = {PH}
            ORDER BY periodo DESC
        """, (programa_id,))

        reconciliaciones = []
        for row in cursor.fetchall():
            r = dict(row)
            r['cantidad_consumida_total'] = float(r['cantidad_consumida_total']) if r['cantidad_consumida_total'] else 0
            r['monto_total'] = float(r['monto_total']) if r['monto_total'] else 0
            reconciliaciones.append(r)

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
    """Actualiza stock de un material en consignación (UPSERT).

    Usa UPDATE-then-INSERT en lugar de ON CONFLICT...RETURNING (PG-only y
    dependiente de una constraint UNIQUE que puede no existir). Portable SQLite/PG.
    """
    with get_db_transaction() as (conn, cursor):
        cursor.execute(
            f"""
            UPDATE consignment_stock
            SET cantidad_disponible = {PH},
                valor_unitario = COALESCE({PH}, valor_unitario),
                ultima_actualizacion = {sql_datetime_now()}
            WHERE programa_id = {PH} AND material_codigo = {PH}
            """,
            (cantidad_disponible, valor_unitario, programa_id, material_codigo),
        )

        if cursor.rowcount and cursor.rowcount > 0:
            cursor.execute(
                f"SELECT id FROM consignment_stock WHERE programa_id = {PH} AND material_codigo = {PH}",
                (programa_id, material_codigo),
            )
            row = cursor.fetchone()
            stock_id = row["id"] if isinstance(row, dict) else row[0]
        else:
            stock_id = insert_returning_id(
                cursor,
                f"""
                INSERT INTO consignment_stock
                (programa_id, material_codigo, cantidad_disponible, valor_unitario, ultima_actualizacion, created_at)
                VALUES ({PH}, {PH}, {PH}, {PH}, {sql_datetime_now()}, {sql_datetime_now()})
                """,
                (programa_id, material_codigo, cantidad_disponible, valor_unitario),
            )

        conn.commit()
        logger.info(f"Stock actualizado: programa={programa_id}, material={material_codigo}, qty={cantidad_disponible}")
        return stock_id


def registrar_consumo(stock_id: int, cantidad: float, solicitud_id: Optional[int] = None, usuario_id: Optional[int] = None) -> int:
    """Registra consumo de material en consignación."""
    with get_db_transaction() as (conn, cursor):
        cursor.execute(f"""
            UPDATE consignment_stock
            SET cantidad_disponible = cantidad_disponible - {PH},
                cantidad_consumida_acumulada = cantidad_consumida_acumulada + {PH},
                ultima_actualizacion = {sql_datetime_now()}
            WHERE id = {PH}
        """, (cantidad, cantidad, stock_id))

        consumo_id = insert_returning_id(
            cursor,
            f"""
            INSERT INTO consignment_consumo
            (stock_id, cantidad, solicitud_id, usuario_id, fecha_consumo, facturado, created_at)
            VALUES ({PH}, {PH}, {PH}, {PH}, {sql_datetime_now()}, 0, {sql_datetime_now()})
            """,
            (stock_id, cantidad, solicitud_id, usuario_id),
        )

        conn.commit()
        logger.info(f"Consumo registrado: stock={stock_id}, cantidad={cantidad}, consumo_id={consumo_id}")
        return consumo_id


def generar_reconciliacion(programa_id: int, periodo: str) -> int:
    """Genera reconciliación de consumos no facturados."""
    with get_db_transaction() as (conn, cursor):
        cursor.execute(f"""
            SELECT COALESCE(SUM(cc.cantidad), 0) as qty_total,
                   COALESCE(SUM(cc.cantidad * cs.valor_unitario), 0) as monto_total
            FROM consignment_consumo cc
            JOIN consignment_stock cs ON cc.stock_id = cs.id
            WHERE cs.programa_id = {PH}
            AND cc.facturado = 0
            AND {sql_format_date('cc.fecha_consumo', '%Y-%m')} = {PH}
        """, (programa_id, periodo))

        row = cursor.fetchone()
        cantidad_total = float(row['qty_total'])
        monto_total = float(row['monto_total'])

        recon_id = insert_returning_id(
            cursor,
            f"""
            INSERT INTO consignment_reconciliacion
            (programa_id, periodo, cantidad_consumida_total, monto_total, estado, created_at, updated_at)
            VALUES ({PH}, {PH}, {PH}, {PH}, 'draft', {sql_datetime_now()}, {sql_datetime_now()})
            """,
            (programa_id, periodo, cantidad_total, monto_total),
        )

        conn.commit()
        logger.info(f"Reconciliación generada: programa={programa_id}, periodo={periodo}, total={monto_total}")
        return recon_id


def enviar_reconciliacion(reconciliacion_id: int, notas: Optional[str] = None) -> None:
    """Envía reconciliación al proveedor."""
    with get_db_transaction() as (conn, cursor):
        cursor.execute(f"""
            UPDATE consignment_reconciliacion
            SET estado = 'enviado',
                fecha_envio = {sql_datetime_now()},
                notas = {PH},
                updated_at = {sql_datetime_now()}
            WHERE id = {PH}
        """, (notas, reconciliacion_id))
        conn.commit()
        logger.info(f"Reconciliación enviada: {reconciliacion_id}")


def confirmar_reconciliacion(reconciliacion_id: int, notas: Optional[str] = None) -> None:
    """Confirma reconciliación desde el proveedor."""
    with get_db_transaction() as (conn, cursor):
        cursor.execute(f"""
            UPDATE consignment_reconciliacion
            SET estado = 'confirmado',
                fecha_confirmacion = {sql_datetime_now()},
                notas = COALESCE({PH}, notas),
                updated_at = {sql_datetime_now()}
            WHERE id = {PH}
        """, (notas, reconciliacion_id))
        conn.commit()
        logger.info(f"Reconciliación confirmada: {reconciliacion_id}")


def obtener_kpis(programa_id: Optional[int] = None) -> dict:
    """Obtiene KPIs de consignación."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Total consigned value
        if programa_id:
            cursor.execute(f"""
                SELECT COALESCE(SUM(cantidad_disponible * valor_unitario), 0) as val
                FROM consignment_stock WHERE programa_id = {PH}
            """, (programa_id,))
        else:
            cursor.execute("SELECT COALESCE(SUM(cantidad_disponible * valor_unitario), 0) as val FROM consignment_stock")
        total_consigned_value = float(cursor.fetchone()['val'])

        # 2. Consumo del mes actual
        if programa_id:
            cursor.execute(f"""
                SELECT COALESCE(SUM(cc.cantidad * cs.valor_unitario), 0) as val
                FROM consignment_consumo cc
                JOIN consignment_stock cs ON cc.stock_id = cs.id
                WHERE cs.programa_id = {PH}
                AND {sql_format_date('cc.fecha_consumo', '%Y-%m')} = {sql_format_date(sql_datetime_now(), '%Y-%m')}
            """, (programa_id,))
        else:
            cursor.execute(f"""
                SELECT COALESCE(SUM(cc.cantidad * cs.valor_unitario), 0) as val
                FROM consignment_consumo cc
                JOIN consignment_stock cs ON cc.stock_id = cs.id
                WHERE {sql_format_date('cc.fecha_consumo', '%Y-%m')} = {sql_format_date(sql_datetime_now(), '%Y-%m')}
            """)
        month_consumption = float(cursor.fetchone()['val'])

        # 3. Reconciliaciones pendientes
        if programa_id:
            cursor.execute(f"""
                SELECT COUNT(*) as cnt FROM consignment_reconciliacion
                WHERE programa_id = {PH} AND estado IN ('draft', 'enviado')
            """, (programa_id,))
        else:
            cursor.execute("SELECT COUNT(*) as cnt FROM consignment_reconciliacion WHERE estado IN ('draft', 'enviado')")
        pending_reconciliations = cursor.fetchone()['cnt']

        return {
            'total_consigned_value': total_consigned_value,
            'month_consumption': month_consumption,
            'pending_reconciliations': pending_reconciliations
        }
    finally:
        cursor.close()
        conn.close()


def actualizar_programa(programa_id: int, datos: dict) -> None:
    """Actualiza un programa de consignación."""
    allowed_fields = ['nombre', 'descripcion', 'estado', 'condiciones_pago', 'porcentaje_margen', 'periodo_reconciliacion']
    updates = []
    params = []

    for field in allowed_fields:
        if field in datos:
            updates.append(f"{field} = {PH}")
            params.append(datos[field])

    if not updates:
        return

    updates.append("updated_at = {sql_datetime_now()}")
    params.append(programa_id)

    with get_db_transaction() as (conn, cursor):
        sql = f"UPDATE consignment_programa SET {', '.join(updates)} WHERE id = {PH}"
        cursor.execute(sql, params)
        conn.commit()
        logger.info(f"Programa actualizado: {programa_id}")
