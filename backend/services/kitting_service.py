"""
Servicio de Kitting y Ensamblaje Ligero.
Gestiona BOMs de kits, órdenes de kitting y asignación de componentes.
"""

import logging
from datetime import datetime

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def crear_bom(data: dict) -> int:
    """
    Crea un nuevo BOM de kit.

    Args:
        data: {
            'nombre': str,
            'descripcion': str (optional),
            'version': str,
            'creado_por': int
        }

    Returns:
        ID del BOM creado
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        # Generar kit_codigo (KIT-NNNN)
        if using_pg:
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM kit_bom")
        else:
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM kit_bom")
        max_id = cursor.fetchone()[0]
        kit_codigo = f"KIT-{max_id + 1:04d}"

        # Insertar BOM
        if using_pg:
            cursor.execute("""
                INSERT INTO kit_bom
                (kit_codigo, nombre, descripcion, version, estado, creado_por, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (
                kit_codigo,
                data['nombre'],
                data.get('descripcion'),
                data['version'],
                'draft',
                data['creado_por']
            ))
            bom_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO kit_bom
                (kit_codigo, nombre, descripcion, version, estado, creado_por, created_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            """, (
                kit_codigo,
                data['nombre'],
                data.get('descripcion'),
                data['version'],
                'draft',
                data['creado_por']
            ))
            bom_id = cursor.lastrowid

        conn.commit()
        logger.info(f"BOM de kit creado: {kit_codigo} (ID: {bom_id})")
        return bom_id


def obtener_boms(filtros: dict = None) -> list:
    """
    Obtiene lista de BOMs de kits con filtros.

    Args:
        filtros: {
            'estado': str (optional)
        }

    Returns:
        Lista de BOMs
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
            where_clauses.append(f"kb.estado = {placeholder}")
            params.append(filtros['estado'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cursor.execute(
            f"""
            SELECT
                kb.id, kb.kit_codigo, kb.nombre, kb.descripcion, kb.version,
                kb.estado, kb.creado_por, u.nombre as creado_por_nombre,
                kb.created_at
            FROM kit_bom kb
            LEFT JOIN usuarios u ON kb.creado_por = u.id
            {where_sql}
            ORDER BY kb.created_at DESC
            """,
            params
        )

        boms = []
        for row in cursor.fetchall():
            boms.append({
                'id': row[0],
                'kit_codigo': row[1],
                'nombre': row[2],
                'descripcion': row[3],
                'version': row[4],
                'estado': row[5],
                'creado_por': row[6],
                'creado_por_nombre': row[7],
                'created_at': row[8]
            })

        return boms
    finally:
        cursor.close()
        conn.close()


def obtener_detalle_bom(bom_id: int) -> dict:
    """
    Obtiene detalle de un BOM con sus componentes.

    Args:
        bom_id: ID del BOM

    Returns:
        Diccionario con BOM y componentes
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener BOM
        cursor.execute(
            f"""
            SELECT
                kb.id, kb.kit_codigo, kb.nombre, kb.descripcion, kb.version,
                kb.estado, kb.creado_por, u.nombre as creado_por_nombre,
                kb.created_at
            FROM kit_bom kb
            LEFT JOIN usuarios u ON kb.creado_por = u.id
            WHERE kb.id = {placeholder}
            """,
            (bom_id,)
        )

        row = cursor.fetchone()
        if not row:
            raise ValueError(f"BOM {bom_id} no encontrado")

        bom = {
            'id': row[0],
            'kit_codigo': row[1],
            'nombre': row[2],
            'descripcion': row[3],
            'version': row[4],
            'estado': row[5],
            'creado_por': row[6],
            'creado_por_nombre': row[7],
            'created_at': row[8]
        }

        # Obtener componentes
        cursor.execute(
            f"""
            SELECT
                kbc.id, kbc.material_codigo, m.descripcion as material_descripcion,
                kbc.cantidad, kbc.unidad, kbc.es_opcional, kbc.alternativa_material,
                kbc.secuencia, kbc.notas
            FROM kit_bom_componente kbc
            LEFT JOIN catalogo_materiales m ON kbc.material_codigo = m.codigo
            WHERE kbc.kit_bom_id = {placeholder}
            ORDER BY kbc.secuencia
            """,
            (bom_id,)
        )

        componentes = []
        for row in cursor.fetchall():
            componentes.append({
                'id': row[0],
                'material_codigo': row[1],
                'material_descripcion': row[2],
                'cantidad': float(row[3]) if row[3] else 0,
                'unidad': row[4],
                'es_opcional': bool(row[5]),
                'alternativa_material': row[6],
                'secuencia': row[7],
                'notas': row[8]
            })

        bom['componentes'] = componentes

        return bom
    finally:
        cursor.close()
        conn.close()


def actualizar_bom(bom_id: int, data: dict) -> dict:
    """
    Actualiza un BOM.

    Args:
        bom_id: ID del BOM
        data: Campos a actualizar

    Returns:
        BOM actualizado
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        updates = []
        params = []

        for field in ['nombre', 'descripcion', 'version', 'estado']:
            if field in data:
                updates.append(f"{field} = {placeholder}")
                params.append(data[field])

        if updates:
            params.append(bom_id)
            cursor.execute(
                f"UPDATE kit_bom SET {', '.join(updates)} WHERE id = {placeholder}",
                params
            )

        conn.commit()

        return obtener_detalle_bom(bom_id)


def agregar_componente(bom_id: int, data: dict) -> int:
    """
    Agrega un componente a un BOM.

    Args:
        bom_id: ID del BOM
        data: {
            'material_codigo': str,
            'cantidad': float,
            'unidad': str,
            'es_opcional': bool (optional),
            'alternativa_material': str (optional),
            'secuencia': int (optional),
            'notas': str (optional)
        }

    Returns:
        ID del componente creado
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            cursor.execute("""
                INSERT INTO kit_bom_componente
                (kit_bom_id, material_codigo, cantidad, unidad, es_opcional,
                 alternativa_material, secuencia, notas)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                bom_id,
                data['material_codigo'],
                data['cantidad'],
                data['unidad'],
                data.get('es_opcional', False),
                data.get('alternativa_material'),
                data.get('secuencia', 0),
                data.get('notas')
            ))
            componente_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO kit_bom_componente
                (kit_bom_id, material_codigo, cantidad, unidad, es_opcional,
                 alternativa_material, secuencia, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                bom_id,
                data['material_codigo'],
                data['cantidad'],
                data['unidad'],
                data.get('es_opcional', False),
                data.get('alternativa_material'),
                data.get('secuencia', 0),
                data.get('notas')
            ))
            componente_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Componente {data['material_codigo']} agregado al BOM {bom_id}")
        return componente_id


def eliminar_componente(bom_id: int, componente_id: int) -> None:
    """
    Elimina un componente de un BOM.

    Args:
        bom_id: ID del BOM
        componente_id: ID del componente
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        cursor.execute(
            f"DELETE FROM kit_bom_componente WHERE id = {placeholder} AND kit_bom_id = {placeholder}",
            (componente_id, bom_id)
        )
        conn.commit()
        logger.info(f"Componente {componente_id} eliminado del BOM {bom_id}")


def crear_orden(data: dict) -> int:
    """
    Crea una nueva orden de kitting.

    Args:
        data: {
            'kit_bom_id': int,
            'cantidad_kits': int,
            'fecha_requerida': str,
            'solicitante_id': int,
            'notas': str (optional)
        }

    Returns:
        ID de la orden creada
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        # Generar numero_orden (KO-YYYY-NNNN)
        year = datetime.now().year
        if using_pg:
            cursor.execute(
                "SELECT COALESCE(MAX(id), 0) FROM kit_orden WHERE numero_orden LIKE %s",
                (f'KO-{year}-%',)
            )
        else:
            cursor.execute(
                "SELECT COALESCE(MAX(id), 0) FROM kit_orden WHERE numero_orden LIKE ?",
                (f'KO-{year}-%',)
            )
        max_id = cursor.fetchone()[0]
        numero_orden = f"KO-{year}-{max_id + 1:04d}"

        # Insertar orden
        if using_pg:
            cursor.execute("""
                INSERT INTO kit_orden
                (numero_orden, kit_bom_id, cantidad_kits, fecha_requerida,
                 solicitante_id, estado, notas, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (
                numero_orden,
                data['kit_bom_id'],
                data['cantidad_kits'],
                data['fecha_requerida'],
                data['solicitante_id'],
                'pending',
                data.get('notas')
            ))
            orden_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO kit_orden
                (numero_orden, kit_bom_id, cantidad_kits, fecha_requerida,
                 solicitante_id, estado, notas, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (
                numero_orden,
                data['kit_bom_id'],
                data['cantidad_kits'],
                data['fecha_requerida'],
                data['solicitante_id'],
                'pending',
                data.get('notas')
            ))
            orden_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Orden de kitting creada: {numero_orden} (ID: {orden_id})")
        return orden_id


def obtener_ordenes(filtros: dict = None) -> dict:
    """
    Obtiene lista paginada de órdenes de kitting.

    Args:
        filtros: {
            'estado': str (optional),
            'kit_bom_id': int (optional),
            'page': int,
            'per_page': int
        }

    Returns:
        {items: [...], total: int, page: int, pages: int}
    """
    filtros = filtros or {}
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    page = filtros.get('page', 1)
    per_page = filtros.get('per_page', 20)
    offset = (page - 1) * per_page

    where_clauses = []
    params = []

    if filtros.get('estado'):
        where_clauses.append(f"ko.estado = {placeholder}")
        params.append(filtros['estado'])

    if filtros.get('kit_bom_id'):
        where_clauses.append(f"ko.kit_bom_id = {placeholder}")
        params.append(filtros['kit_bom_id'])

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Contar total
        cursor.execute(
            f"SELECT COUNT(*) FROM kit_orden ko {where_sql}",
            params
        )
        total = cursor.fetchone()[0]

        # Obtener items
        cursor.execute(
            f"""
            SELECT
                ko.id, ko.numero_orden, ko.kit_bom_id, kb.kit_codigo, kb.nombre as kit_nombre,
                ko.cantidad_kits, ko.fecha_requerida, ko.estado,
                ko.solicitante_id, u.nombre as solicitante_nombre,
                ko.fecha_inicio, ko.fecha_completado, ko.created_at
            FROM kit_orden ko
            LEFT JOIN kit_bom kb ON ko.kit_bom_id = kb.id
            LEFT JOIN usuarios u ON ko.solicitante_id = u.id
            {where_sql}
            ORDER BY ko.created_at DESC
            LIMIT {placeholder} OFFSET {placeholder}
            """,
            params + [per_page, offset]
        )

        items = []
        for row in cursor.fetchall():
            items.append({
                'id': row[0],
                'numero_orden': row[1],
                'kit_bom_id': row[2],
                'kit_codigo': row[3],
                'kit_nombre': row[4],
                'cantidad_kits': row[5],
                'fecha_requerida': row[6],
                'estado': row[7],
                'solicitante_id': row[8],
                'solicitante_nombre': row[9],
                'fecha_inicio': row[10],
                'fecha_completado': row[11],
                'created_at': row[12]
            })

        pages = (total + per_page - 1) // per_page

        return {
            'items': items,
            'total': total,
            'page': page,
            'pages': pages
        }
    finally:
        cursor.close()
        conn.close()


def obtener_detalle_orden(orden_id: int) -> dict:
    """
    Obtiene detalle completo de una orden de kitting.

    Args:
        orden_id: ID de la orden

    Returns:
        Diccionario con datos completos de la orden
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener orden
        cursor.execute(
            f"""
            SELECT
                ko.id, ko.numero_orden, ko.kit_bom_id, kb.kit_codigo, kb.nombre as kit_nombre,
                ko.cantidad_kits, ko.fecha_requerida, ko.estado,
                ko.solicitante_id, u.nombre as solicitante_nombre,
                ko.fecha_inicio, ko.fecha_completado, ko.notas, ko.created_at
            FROM kit_orden ko
            LEFT JOIN kit_bom kb ON ko.kit_bom_id = kb.id
            LEFT JOIN usuarios u ON ko.solicitante_id = u.id
            WHERE ko.id = {placeholder}
            """,
            (orden_id,)
        )

        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Orden {orden_id} no encontrada")

        orden = {
            'id': row[0],
            'numero_orden': row[1],
            'kit_bom_id': row[2],
            'kit_codigo': row[3],
            'kit_nombre': row[4],
            'cantidad_kits': row[5],
            'fecha_requerida': row[6],
            'estado': row[7],
            'solicitante_id': row[8],
            'solicitante_nombre': row[9],
            'fecha_inicio': row[10],
            'fecha_completado': row[11],
            'notas': row[12],
            'created_at': row[13]
        }

        # Obtener asignaciones de componentes
        cursor.execute(
            f"""
            SELECT
                kca.id, kca.material_codigo, m.descripcion as material_descripcion,
                kca.cantidad_requerida, kca.cantidad_asignada, kca.estado
            FROM kit_componente_asignacion kca
            LEFT JOIN catalogo_materiales m ON kca.material_codigo = m.codigo
            WHERE kca.kit_orden_id = {placeholder}
            """,
            (orden_id,)
        )

        asignaciones = []
        for row in cursor.fetchall():
            asignaciones.append({
                'id': row[0],
                'material_codigo': row[1],
                'material_descripcion': row[2],
                'cantidad_requerida': float(row[3]) if row[3] else 0,
                'cantidad_asignada': float(row[4]) if row[4] else 0,
                'estado': row[5]
            })

        orden['asignaciones'] = asignaciones

        return orden
    finally:
        cursor.close()
        conn.close()


def verificar_disponibilidad(orden_id: int) -> list:
    """
    Verifica disponibilidad de componentes para una orden.

    Args:
        orden_id: ID de la orden

    Returns:
        Lista de disponibilidad por componente
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener orden
        cursor.execute(
            f"SELECT kit_bom_id, cantidad_kits FROM kit_orden WHERE id = {placeholder}",
            (orden_id,)
        )
        result = cursor.fetchone()
        if not result:
            raise ValueError(f"Orden {orden_id} no encontrada")

        kit_bom_id, cantidad_kits = result

        # Obtener componentes del BOM
        cursor.execute(
            f"""
            SELECT material_codigo, cantidad, unidad
            FROM kit_bom_componente
            WHERE kit_bom_id = {placeholder}
            """,
            (kit_bom_id,)
        )

        disponibilidad = []
        for material_codigo, cantidad_unitaria, unidad in cursor.fetchall():
            cantidad_requerida = float(cantidad_unitaria) * cantidad_kits

            # Obtener stock disponible
            cursor.execute(
                f"SELECT COALESCE(SUM(stock), 0) FROM stock WHERE codigo_material = {placeholder}",
                (material_codigo,)
            )
            stock_disponible = cursor.fetchone()[0] or 0

            disponibilidad.append({
                'material_codigo': material_codigo,
                'requerido': cantidad_requerida,
                'disponible': float(stock_disponible),
                'suficiente': float(stock_disponible) >= cantidad_requerida
            })

        return disponibilidad
    finally:
        cursor.close()
        conn.close()


def asignar_componentes(orden_id: int) -> None:
    """
    Asigna componentes a una orden de kitting (reserva stock).

    Args:
        orden_id: ID de la orden
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        disponibilidad = verificar_disponibilidad(orden_id)

        # Determinar estado basado en disponibilidad
        todas_suficientes = all(item['suficiente'] for item in disponibilidad)
        estado_orden = 'ready' if todas_suficientes else 'partial'

        for item in disponibilidad:
            cantidad_asignada = min(item['requerido'], item['disponible'])

            # Insertar asignación
            if using_pg:
                cursor.execute("""
                    INSERT INTO kit_componente_asignacion
                    (kit_orden_id, material_codigo, cantidad_requerida, cantidad_asignada, estado)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    orden_id,
                    item['material_codigo'],
                    item['requerido'],
                    cantidad_asignada,
                    'assigned' if item['suficiente'] else 'partial'
                ))
            else:
                cursor.execute("""
                    INSERT INTO kit_componente_asignacion
                    (kit_orden_id, material_codigo, cantidad_requerida, cantidad_asignada, estado)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    orden_id,
                    item['material_codigo'],
                    item['requerido'],
                    cantidad_asignada,
                    'assigned' if item['suficiente'] else 'partial'
                ))

        # Actualizar estado de la orden
        cursor.execute(
            f"UPDATE kit_orden SET estado = {placeholder} WHERE id = {placeholder}",
            (estado_orden, orden_id)
        )

        conn.commit()
        logger.info(f"Componentes asignados a orden {orden_id}, estado: {estado_orden}")


def iniciar_produccion(orden_id: int) -> None:
    """
    Inicia la producción de una orden de kitting.

    Args:
        orden_id: ID de la orden
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'
    now_fn = "NOW()" if using_pg else "datetime('now')"

    with get_db_transaction() as (conn, cursor):
        cursor.execute(
            f"""
            UPDATE kit_orden
            SET estado = 'in_progress', fecha_inicio = {now_fn}
            WHERE id = {placeholder}
            """,
            (orden_id,)
        )
        conn.commit()
        logger.info(f"Producción iniciada para orden {orden_id}")


def completar_orden(orden_id: int) -> None:
    """
    Completa una orden de kitting.

    Args:
        orden_id: ID de la orden
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'
    now_fn = "NOW()" if using_pg else "datetime('now')"

    with get_db_transaction() as (conn, cursor):
        # Actualizar orden
        cursor.execute(
            f"""
            UPDATE kit_orden
            SET estado = 'completed', fecha_completado = {now_fn}
            WHERE id = {placeholder}
            """,
            (orden_id,)
        )

        # Marcar asignaciones como consumed
        cursor.execute(
            f"UPDATE kit_componente_asignacion SET estado = 'consumed' WHERE kit_orden_id = {placeholder}",
            (orden_id,)
        )

        conn.commit()
        logger.info(f"Orden {orden_id} completada")


def obtener_kpis() -> dict:
    """
    Obtiene KPIs del proceso de kitting.

    Returns:
        {
            'activas': int,
            'completadas_mes': int,
            'on_time_pct': float
        }
    """
    using_pg = is_using_postgresql()

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Órdenes activas
        cursor.execute("""
            SELECT COUNT(*) FROM kit_orden
            WHERE estado IN ('pending', 'ready', 'in_progress')
        """)
        activas = cursor.fetchone()[0]

        # Completadas este mes
        if using_pg:
            cursor.execute("""
                SELECT COUNT(*) FROM kit_orden
                WHERE estado = 'completed'
                AND DATE_TRUNC('month', fecha_completado) = DATE_TRUNC('month', CURRENT_DATE)
            """)
        else:
            cursor.execute("""
                SELECT COUNT(*) FROM kit_orden
                WHERE estado = 'completed'
                AND strftime('%Y-%m', fecha_completado) = strftime('%Y-%m', 'now')
            """)
        completadas_mes = cursor.fetchone()[0]

        # On-time (completadas antes de fecha_requerida)
        if using_pg:
            cursor.execute("""
                SELECT COUNT(*) FROM kit_orden
                WHERE estado = 'completed'
                AND fecha_completado <= fecha_requerida
                AND DATE_TRUNC('month', fecha_completado) = DATE_TRUNC('month', CURRENT_DATE)
            """)
        else:
            cursor.execute("""
                SELECT COUNT(*) FROM kit_orden
                WHERE estado = 'completed'
                AND fecha_completado <= fecha_requerida
                AND strftime('%Y-%m', fecha_completado) = strftime('%Y-%m', 'now')
            """)
        on_time = cursor.fetchone()[0]

        on_time_pct = (on_time / completadas_mes * 100) if completadas_mes > 0 else 0

        return {
            'activas': activas,
            'completadas_mes': completadas_mes,
            'on_time_pct': round(on_time_pct, 2)
        }
    finally:
        cursor.close()
        conn.close()
