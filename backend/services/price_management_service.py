"""
Servicio de gestión de listas de precios y negociaciones.
Maneja precios por proveedor, historial, y comparación de precios.
"""

import logging
from typing import Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def crear_lista(nombre: str, proveedor_cuit: str = None, moneda: str = 'ARS',
                fecha_desde: str = None, fecha_hasta: str = None, notas: str = None,
                created_by: int = None) -> int:
    """
    Crea una nueva lista de precios.

    Args:
        nombre: Nombre de la lista
        proveedor_cuit: CUIT del proveedor (opcional)
        moneda: Moneda (default: ARS)
        fecha_desde: Fecha inicio vigencia
        fecha_hasta: Fecha fin vigencia
        notas: Notas adicionales
        created_by: ID usuario creador

    Returns:
        ID de la lista creada
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            cursor.execute("""
                INSERT INTO lista_precios
                (nombre, proveedor_cuit, moneda, fecha_vigencia_desde, fecha_vigencia_hasta, notas, created_by, estado, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (nombre, proveedor_cuit, moneda, fecha_desde, fecha_hasta, notas, created_by, 'draft'))
            lista_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO lista_precios
                (nombre, proveedor_cuit, moneda, fecha_vigencia_desde, fecha_vigencia_hasta, notas, created_by, estado, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (nombre, proveedor_cuit, moneda, fecha_desde, fecha_hasta, notas, created_by, 'draft'))
            lista_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Lista de precios creada: {lista_id} ({nombre})")
        return lista_id


def obtener_listas(filtros: dict = None, page: int = 1, per_page: int = 50) -> dict:
    """
    Obtiene listas de precios con paginación y filtros.

    Args:
        filtros: {
            'estado': str (optional),
            'proveedor_cuit': str (optional),
            'moneda': str (optional)
        }
        page: Página actual
        per_page: Items por página

    Returns:
        {
            'items': [...],
            'total': int,
            'page': int,
            'per_page': int
        }
    """
    filtros = filtros or {}
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        where_clauses = []
        params = []

        if filtros.get('estado'):
            where_clauses.append(f"lp.estado = {placeholder}")
            params.append(filtros['estado'])

        if filtros.get('proveedor_cuit'):
            where_clauses.append(f"lp.proveedor_cuit = {placeholder}")
            params.append(filtros['proveedor_cuit'])

        if filtros.get('moneda'):
            where_clauses.append(f"lp.moneda = {placeholder}")
            params.append(filtros['moneda'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        # Count total
        cursor.execute(
            f"""
            SELECT COUNT(*)
            FROM lista_precios lp
            {where_sql}
            """,
            params
        )
        total = cursor.fetchone()[0]

        # Fetch items
        offset = (page - 1) * per_page
        params_with_limit = params + [per_page, offset]

        cursor.execute(
            f"""
            SELECT lp.id, lp.nombre, lp.proveedor_cuit, p.nombre as proveedor_nombre,
                   lp.moneda, lp.fecha_vigencia_desde, lp.fecha_vigencia_hasta,
                   lp.estado, lp.notas, lp.created_at,
                   (SELECT COUNT(*) FROM precio_item WHERE lista_id = lp.id) as items_count
            FROM lista_precios lp
            LEFT JOIN proveedores p ON lp.proveedor_cuit = p.id_proveedor
            {where_sql}
            ORDER BY lp.created_at DESC
            LIMIT {placeholder} OFFSET {placeholder}
            """,
            params_with_limit
        )

        items = []
        for row in cursor.fetchall():
            items.append({
                'id': row[0],
                'nombre': row[1],
                'proveedor_cuit': row[2],
                'proveedor_nombre': row[3],
                'moneda': row[4],
                'fecha_vigencia_desde': row[5],
                'fecha_vigencia_hasta': row[6],
                'estado': row[7],
                'notas': row[8],
                'created_at': row[9],
                'items_count': row[10]
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


def obtener_detalle_lista(lista_id: int) -> dict:
    """
    Obtiene detalle de una lista de precios con sus items.

    Args:
        lista_id: ID de la lista

    Returns:
        {
            'lista': {...},
            'items': [...]
        }
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Fetch lista info
        cursor.execute(
            f"""
            SELECT lp.id, lp.nombre, lp.proveedor_cuit, p.nombre as proveedor_nombre,
                   lp.moneda, lp.fecha_vigencia_desde, lp.fecha_vigencia_hasta,
                   lp.estado, lp.notas, lp.created_at
            FROM lista_precios lp
            LEFT JOIN proveedores p ON lp.proveedor_cuit = p.id_proveedor
            WHERE lp.id = {placeholder}
            """,
            (lista_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Lista de precios {lista_id} no encontrada")

        lista = {
            'id': row[0],
            'nombre': row[1],
            'proveedor_cuit': row[2],
            'proveedor_nombre': row[3],
            'moneda': row[4],
            'fecha_vigencia_desde': row[5],
            'fecha_vigencia_hasta': row[6],
            'estado': row[7],
            'notas': row[8],
            'created_at': row[9]
        }

        # Fetch items
        cursor.execute(
            f"""
            SELECT pi.id, pi.material_codigo, m.nombre as material_nombre,
                   pi.precio_unitario, pi.unidad, pi.cantidad_minima, pi.cantidad_maxima,
                   pi.descuento_pct, pi.created_at
            FROM precio_item pi
            LEFT JOIN (
                SELECT codigo, descripcion as nombre FROM catalogo_materiales
                UNION ALL
                SELECT codigo_material as codigo, descripcion as nombre FROM materiales_bbdd
            ) m ON pi.material_codigo = m.codigo
            WHERE pi.lista_id = {placeholder}
            ORDER BY pi.material_codigo
            """,
            (lista_id,)
        )

        items = []
        for row in cursor.fetchall():
            items.append({
                'id': row[0],
                'material_codigo': row[1],
                'material_nombre': row[2],
                'precio_unitario': float(row[3]) if row[3] else 0,
                'unidad': row[4],
                'cantidad_minima': row[5],
                'cantidad_maxima': row[6],
                'descuento_pct': float(row[7]) if row[7] else 0,
                'created_at': row[8]
            })

        return {'lista': lista, 'items': items}
    finally:
        cursor.close()
        conn.close()


def activar_lista(lista_id: int) -> None:
    """
    Activa una lista de precios (valida que no haya overlap de fechas).

    Args:
        lista_id: ID de la lista

    Raises:
        ValueError: Si hay overlap de fechas con otra lista activa del mismo proveedor
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Get lista info
        cursor.execute(
            f"SELECT proveedor_cuit, fecha_vigencia_desde, fecha_vigencia_hasta FROM lista_precios WHERE id = {placeholder}",
            (lista_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Lista {lista_id} no encontrada")

        proveedor_cuit, fecha_desde, fecha_hasta = row

        # Validate no overlap with other active lists for same supplier
        if proveedor_cuit:
            cursor.execute(
                f"""
                SELECT id FROM lista_precios
                WHERE proveedor_cuit = {placeholder}
                AND estado = 'active'
                AND id != {placeholder}
                AND (
                    (fecha_vigencia_desde <= {placeholder} AND fecha_vigencia_hasta >= {placeholder})
                    OR (fecha_vigencia_desde <= {placeholder} AND fecha_vigencia_hasta >= {placeholder})
                    OR (fecha_vigencia_desde >= {placeholder} AND fecha_vigencia_hasta <= {placeholder})
                )
                """,
                (proveedor_cuit, lista_id, fecha_desde, fecha_desde, fecha_hasta, fecha_hasta, fecha_desde, fecha_hasta)
            )
            if cursor.fetchone():
                raise ValueError(f"Existe overlap de fechas con otra lista activa para el proveedor {proveedor_cuit}")

        # Activate lista
        cursor.execute(
            f"UPDATE lista_precios SET estado = 'active' WHERE id = {placeholder}",
            (lista_id,)
        )

        conn.commit()
        logger.info(f"Lista de precios {lista_id} activada")


def agregar_precio_item(lista_id: int, material_codigo: str, precio_unitario: float,
                        unidad: str = None, cantidad_minima: int = 1, cantidad_maxima: int = None,
                        descuento_pct: float = 0) -> int:
    """
    Agrega un item de precio a una lista.

    Args:
        lista_id: ID de la lista
        material_codigo: Código del material
        precio_unitario: Precio unitario
        unidad: Unidad de medida
        cantidad_minima: Cantidad mínima para este precio
        cantidad_maxima: Cantidad máxima (opcional)
        descuento_pct: Descuento porcentual

    Returns:
        ID del item creado
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            cursor.execute("""
                INSERT INTO precio_item
                (lista_id, material_codigo, precio_unitario, unidad, cantidad_minima, cantidad_maxima, descuento_pct, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (lista_id, material_codigo, precio_unitario, unidad, cantidad_minima, cantidad_maxima, descuento_pct))
            item_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO precio_item
                (lista_id, material_codigo, precio_unitario, unidad, cantidad_minima, cantidad_maxima, descuento_pct, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (lista_id, material_codigo, precio_unitario, unidad, cantidad_minima, cantidad_maxima, descuento_pct))
            item_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Precio item creado: {item_id} (lista: {lista_id}, material: {material_codigo})")
        return item_id


def eliminar_precio_item(item_id: int) -> None:
    """
    Elimina un item de precio.

    Args:
        item_id: ID del item
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        cursor.execute(f"DELETE FROM precio_item WHERE id = {placeholder}", (item_id,))
        conn.commit()
        logger.info(f"Precio item {item_id} eliminado")


def obtener_precio_material(material_codigo: str, proveedor_cuit: str = None, cantidad: int = 1) -> Optional[dict]:
    """
    Obtiene el precio actual de un material (aplica tiered pricing por cantidad).

    Args:
        material_codigo: Código del material
        proveedor_cuit: CUIT del proveedor (opcional)
        cantidad: Cantidad para aplicar tiered pricing

    Returns:
        {
            'precio_unitario': float,
            'descuento_pct': float,
            'precio_final': float,
            'unidad': str,
            'lista_id': int,
            'lista_nombre': str,
            'proveedor_cuit': str,
            'proveedor_nombre': str
        } o None si no hay precio
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Build query conditions
        where_clauses = [
            "lp.estado = 'active'",
            f"pi.material_codigo = {placeholder}",
            f"pi.cantidad_minima <= {placeholder}"
        ]
        params = [material_codigo, cantidad]

        if proveedor_cuit:
            where_clauses.append(f"lp.proveedor_cuit = {placeholder}")
            params.append(proveedor_cuit)

        # Date validation (current date in range)
        if using_pg:
            where_clauses.append("(lp.fecha_vigencia_desde IS NULL OR lp.fecha_vigencia_desde <= CURRENT_DATE)")
            where_clauses.append("(lp.fecha_vigencia_hasta IS NULL OR lp.fecha_vigencia_hasta >= CURRENT_DATE)")
        else:
            where_clauses.append("(lp.fecha_vigencia_desde IS NULL OR lp.fecha_vigencia_desde <= date('now'))")
            where_clauses.append("(lp.fecha_vigencia_hasta IS NULL OR lp.fecha_vigencia_hasta >= date('now'))")

        where_sql = " AND ".join(where_clauses)

        # Search for best price with tiered pricing
        cursor.execute(
            f"""
            SELECT pi.precio_unitario, pi.descuento_pct, pi.unidad,
                   lp.id as lista_id, lp.nombre as lista_nombre,
                   lp.proveedor_cuit, p.nombre as proveedor_nombre,
                   pi.cantidad_minima
            FROM precio_item pi
            JOIN lista_precios lp ON pi.lista_id = lp.id
            LEFT JOIN proveedores p ON lp.proveedor_cuit = p.id_proveedor
            WHERE {where_sql}
            AND (pi.cantidad_maxima IS NULL OR pi.cantidad_maxima >= {placeholder})
            ORDER BY pi.cantidad_minima DESC, pi.precio_unitario ASC
            LIMIT 1
            """,
            params + [cantidad]
        )

        row = cursor.fetchone()
        if not row:
            return None

        precio_unitario = float(row[0])
        descuento_pct = float(row[1]) if row[1] else 0
        precio_final = precio_unitario * (1 - descuento_pct / 100)

        return {
            'precio_unitario': precio_unitario,
            'descuento_pct': descuento_pct,
            'precio_final': precio_final,
            'unidad': row[2],
            'lista_id': row[3],
            'lista_nombre': row[4],
            'proveedor_cuit': row[5],
            'proveedor_nombre': row[6]
        }
    finally:
        cursor.close()
        conn.close()


def comparar_precios(material_codigo: str, cantidad: int = 1) -> list:
    """
    Compara precios de un material entre todos los proveedores.

    Args:
        material_codigo: Código del material
        cantidad: Cantidad para aplicar tiered pricing

    Returns:
        Lista de precios ordenados de menor a mayor precio final
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Build date conditions
        if using_pg:
            date_cond = "(lp.fecha_vigencia_desde IS NULL OR lp.fecha_vigencia_desde <= CURRENT_DATE) AND (lp.fecha_vigencia_hasta IS NULL OR lp.fecha_vigencia_hasta >= CURRENT_DATE)"
        else:
            date_cond = "(lp.fecha_vigencia_desde IS NULL OR lp.fecha_vigencia_desde <= date('now')) AND (lp.fecha_vigencia_hasta IS NULL OR lp.fecha_vigencia_hasta >= date('now'))"

        # Search all active prices for this material
        cursor.execute(
            f"""
            SELECT DISTINCT ON (lp.proveedor_cuit)
                   pi.precio_unitario, pi.descuento_pct, pi.unidad,
                   lp.id as lista_id, lp.nombre as lista_nombre,
                   lp.proveedor_cuit, p.nombre as proveedor_nombre,
                   pi.cantidad_minima, pi.cantidad_maxima,
                   lp.fecha_vigencia_desde, lp.fecha_vigencia_hasta
            FROM precio_item pi
            JOIN lista_precios lp ON pi.lista_id = lp.id
            LEFT JOIN proveedores p ON lp.proveedor_cuit = p.id_proveedor
            WHERE lp.estado = 'active'
            AND pi.material_codigo = {placeholder}
            AND pi.cantidad_minima <= {placeholder}
            AND (pi.cantidad_maxima IS NULL OR pi.cantidad_maxima >= {placeholder})
            AND {date_cond}
            ORDER BY lp.proveedor_cuit, pi.cantidad_minima DESC, pi.precio_unitario ASC
            """ if using_pg else f"""
            SELECT pi.precio_unitario, pi.descuento_pct, pi.unidad,
                   lp.id as lista_id, lp.nombre as lista_nombre,
                   lp.proveedor_cuit, p.nombre as proveedor_nombre,
                   pi.cantidad_minima, pi.cantidad_maxima,
                   lp.fecha_vigencia_desde, lp.fecha_vigencia_hasta
            FROM precio_item pi
            JOIN lista_precios lp ON pi.lista_id = lp.id
            LEFT JOIN proveedores p ON lp.proveedor_cuit = p.id_proveedor
            WHERE lp.estado = 'active'
            AND pi.material_codigo = {placeholder}
            AND pi.cantidad_minima <= {placeholder}
            AND (pi.cantidad_maxima IS NULL OR pi.cantidad_maxima >= {placeholder})
            AND {date_cond}
            GROUP BY lp.proveedor_cuit
            HAVING MIN(pi.precio_unitario)
            ORDER BY pi.precio_unitario ASC
            """,
            (material_codigo, cantidad, cantidad)
        )

        precios = []
        for row in cursor.fetchall():
            precio_unitario = float(row[0])
            descuento_pct = float(row[1]) if row[1] else 0
            precio_final = precio_unitario * (1 - descuento_pct / 100)

            precios.append({
                'precio_unitario': precio_unitario,
                'descuento_pct': descuento_pct,
                'precio_final': precio_final,
                'unidad': row[2],
                'lista_id': row[3],
                'lista_nombre': row[4],
                'proveedor_cuit': row[5],
                'proveedor_nombre': row[6],
                'cantidad_minima': row[7],
                'cantidad_maxima': row[8],
                'fecha_vigencia_desde': row[9],
                'fecha_vigencia_hasta': row[10]
            })

        # Sort by precio_final ASC
        precios.sort(key=lambda x: x['precio_final'])
        return precios
    finally:
        cursor.close()
        conn.close()


def crear_negociacion(material_codigo: str, proveedor_cuit: str, precio_nuevo: float,
                      precio_anterior: float = None, descuento_pct: float = 0,
                      notas: str = None, negociado_por: int = None) -> int:
    """
    Crea una negociación de precio.

    Args:
        material_codigo: Código del material
        proveedor_cuit: CUIT del proveedor
        precio_nuevo: Precio negociado
        precio_anterior: Precio anterior (opcional)
        descuento_pct: Descuento negociado
        notas: Notas de la negociación
        negociado_por: ID usuario negociador

    Returns:
        ID de la negociación creada
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            cursor.execute("""
                INSERT INTO precio_negociacion
                (material_codigo, proveedor_cuit, precio_anterior, precio_nuevo, descuento_negociado_pct,
                 negociado_por, fecha, notas, estado, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, CURRENT_DATE, %s, %s, NOW())
                RETURNING id
            """, (material_codigo, proveedor_cuit, precio_anterior, precio_nuevo, descuento_pct,
                  negociado_por, notas, 'pending'))
            neg_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO precio_negociacion
                (material_codigo, proveedor_cuit, precio_anterior, precio_nuevo, descuento_negociado_pct,
                 negociado_por, fecha, notas, estado, created_at)
                VALUES (?, ?, ?, ?, ?, ?, date('now'), ?, ?, datetime('now'))
            """, (material_codigo, proveedor_cuit, precio_anterior, precio_nuevo, descuento_pct,
                  negociado_por, notas, 'pending'))
            neg_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Negociación creada: {neg_id} (material: {material_codigo}, proveedor: {proveedor_cuit})")
        return neg_id


def aprobar_negociacion(negociacion_id: int, aprobado_por: int) -> None:
    """
    Aprueba una negociación y registra en historial.

    Args:
        negociacion_id: ID de la negociación
        aprobado_por: ID usuario aprobador
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Get negociacion info
        cursor.execute(
            f"""
            SELECT material_codigo, proveedor_cuit, precio_nuevo, fecha
            FROM precio_negociacion
            WHERE id = {placeholder}
            """,
            (negociacion_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Negociación {negociacion_id} no encontrada")

        material_codigo, proveedor_cuit, precio_nuevo, fecha = row

        # Update estado
        cursor.execute(
            f"UPDATE precio_negociacion SET estado = 'approved', aprobado_por = {placeholder} WHERE id = {placeholder}",
            (aprobado_por, negociacion_id)
        )

        # Insert into historial
        if using_pg:
            cursor.execute("""
                INSERT INTO precio_historial
                (material_codigo, proveedor_cuit, precio, fecha_desde, fuente, referencia_id, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """, (material_codigo, proveedor_cuit, precio_nuevo, fecha, 'negociacion', negociacion_id))
        else:
            cursor.execute("""
                INSERT INTO precio_historial
                (material_codigo, proveedor_cuit, precio, fecha_desde, fuente, referencia_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            """, (material_codigo, proveedor_cuit, precio_nuevo, fecha, 'negociacion', negociacion_id))

        conn.commit()
        logger.info(f"Negociación {negociacion_id} aprobada por usuario {aprobado_por}")


def rechazar_negociacion(negociacion_id: int, aprobado_por: int) -> None:
    """
    Rechaza una negociación.

    Args:
        negociacion_id: ID de la negociación
        aprobado_por: ID usuario que rechaza
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        cursor.execute(
            f"UPDATE precio_negociacion SET estado = 'rejected', aprobado_por = {placeholder} WHERE id = {placeholder}",
            (aprobado_por, negociacion_id)
        )
        conn.commit()
        logger.info(f"Negociación {negociacion_id} rechazada por usuario {aprobado_por}")


def obtener_historial_precios(material_codigo: str, proveedor_cuit: str = None) -> list:
    """
    Obtiene historial de precios de un material.

    Args:
        material_codigo: Código del material
        proveedor_cuit: CUIT del proveedor (opcional)

    Returns:
        Lista de precios históricos ordenados por fecha descendente
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        where_clauses = [f"ph.material_codigo = {placeholder}"]
        params = [material_codigo]

        if proveedor_cuit:
            where_clauses.append(f"ph.proveedor_cuit = {placeholder}")
            params.append(proveedor_cuit)

        where_sql = " AND ".join(where_clauses)

        cursor.execute(
            f"""
            SELECT ph.precio, ph.fecha_desde, ph.fecha_hasta, ph.fuente,
                   ph.proveedor_cuit, p.nombre as proveedor_nombre, ph.created_at
            FROM precio_historial ph
            LEFT JOIN proveedores p ON ph.proveedor_cuit = p.id_proveedor
            WHERE {where_sql}
            ORDER BY ph.fecha_desde DESC, ph.created_at DESC
            """,
            params
        )

        historial = []
        for row in cursor.fetchall():
            historial.append({
                'precio': float(row[0]) if row[0] else 0,
                'fecha_desde': row[1],
                'fecha_hasta': row[2],
                'fuente': row[3],
                'proveedor_cuit': row[4],
                'proveedor_nombre': row[5],
                'created_at': row[6]
            })

        return historial
    finally:
        cursor.close()
        conn.close()
