"""
Servicio de Kitting y Ensamblaje Ligero.
Gestiona BOMs de kits, órdenes de kitting y asignación de componentes.
"""

import logging
from datetime import datetime

from backend.core.db import (
    get_db_connection,
    get_db_transaction,
    insert_returning_id,
    is_using_postgresql,
    sql_datetime_now,
    sql_format_date,
)

logger = logging.getLogger(__name__)


def crear_bom(data: dict) -> dict:
    """
    Crea un nuevo BOM de kit.

    Args:
        data: {
            'nombre': str,
            'descripcion': str (optional),
            'kit_codigo': str (optional - auto-generated if missing),
            'version': str (optional, default '1'),
            'creado_por': int (optional)
        }

    Returns:
        Dict con datos del BOM creado
    """

    with get_db_transaction() as (conn, cursor):
        # Usar kit_codigo del frontend o generar uno
        kit_codigo = data.get('kit_codigo')
        if not kit_codigo:
            cursor.execute("SELECT COALESCE(MAX(id), 0) FROM kit_bom")
            max_id = cursor.fetchone()[0]
            kit_codigo = f"KIT-{max_id + 1:04d}"

        version = data.get('version', '1')
        creado_por = data.get('creado_por')

        # Insertar BOM
        bom_id = insert_returning_id(
            cursor,
            f"""
                INSERT INTO kit_bom
                (kit_codigo, nombre, descripcion, version, estado, creado_por, created_at)
                VALUES (?, ?, ?, ?, ?, ?, {sql_datetime_now()})
            """,
            (
                kit_codigo,
                data['nombre'],
                data.get('descripcion'),
                version,
                'draft',
                creado_por
            )
        )

        conn.commit()
        logger.info(f"BOM de kit creado: {kit_codigo} (ID: {bom_id})")
        return {
            'id': bom_id,
            'kit_codigo': kit_codigo,
            'nombre': data['nombre'],
            'estado': 'draft'
        }


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
            LEFT JOIN usuarios u ON CAST(kb.creado_por AS TEXT) = u.id_spm
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
            LEFT JOIN usuarios u ON CAST(kb.creado_por AS TEXT) = u.id_spm
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
    # Accept 'opcional' as alias for 'es_opcional' (frontend sends 'opcional')
    es_opcional = int(bool(data.get('es_opcional', data.get('opcional', False))))
    alternativa = data.get('alternativa_material', data.get('alternativa'))

    with get_db_transaction() as (conn, cursor):
        componente_id = insert_returning_id(
            cursor,
            """
                INSERT INTO kit_bom_componente
                (kit_bom_id, material_codigo, cantidad, unidad, es_opcional,
                 alternativa_material, secuencia, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                bom_id,
                data['material_codigo'],
                data['cantidad'],
                data['unidad'],
                es_opcional,
                alternativa,
                data.get('secuencia', 0),
                data.get('notas')
            )
        )

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


def crear_orden(data: dict) -> dict:
    """
    Crea una nueva orden de kitting.

    Args:
        data: {
            'kit_bom_id': int,
            'cantidad_kits': int,
            'fecha_requerida': str,
            'solicitante_id': int (optional),
            'prioridad': str (optional),
            'almacen_id': str (optional),
            'notas': str (optional)
        }

    Returns:
        Dict con datos de la orden creada
    """

    with get_db_transaction() as (conn, cursor):
        # Generar numero_orden (KO-YYYY-NNNN)
        year = datetime.now().year
        cursor.execute(
            "SELECT COALESCE(MAX(id), 0) FROM kit_orden WHERE numero_orden LIKE ?",
            (f'KO-{year}-%',)
        )
        max_id = cursor.fetchone()[0]
        numero_orden = f"KO-{year}-{max_id + 1:04d}"

        prioridad = data.get('prioridad', 'media')
        almacen_id = data.get('almacen_id')
        solicitante_id = data.get('solicitante_id')

        # Insertar orden
        orden_id = insert_returning_id(
            cursor,
            f"""
                INSERT INTO kit_orden
                (numero_orden, kit_bom_id, cantidad_kits, fecha_requerida,
                 solicitante_id, estado, prioridad, almacen_id, notas, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, {sql_datetime_now()})
            """,
            (
                numero_orden,
                data['kit_bom_id'],
                data['cantidad_kits'],
                data['fecha_requerida'],
                solicitante_id,
                'pendiente',
                prioridad,
                almacen_id,
                data.get('notas')
            )
        )

        conn.commit()
        logger.info(f"Orden de kitting creada: {numero_orden} (ID: {orden_id})")
        return {
            'id': orden_id,
            'numero_orden': numero_orden,
            'estado': 'pendiente'
        }


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
            LEFT JOIN usuarios u ON CAST(ko.solicitante_id AS TEXT) = u.id_spm
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
            LEFT JOIN usuarios u ON CAST(ko.solicitante_id AS TEXT) = u.id_spm
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
                kca.id, kbc.material_codigo, m.descripcion as material_descripcion,
                kca.cantidad_requerida, kca.cantidad_asignada,
                kca.cantidad_consumida, kca.estado
            FROM kit_componente_asignacion kca
            LEFT JOIN kit_bom_componente kbc ON kca.componente_id = kbc.id
            LEFT JOIN catalogo_materiales m ON kbc.material_codigo = m.codigo
            WHERE kca.orden_id = {placeholder}
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
                'cantidad_consumida': float(row[5]) if row[5] else 0,
                'estado': row[6]
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

        kit_bom_id = result[0]
        cantidad_kits = result[1]

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
        for row in cursor.fetchall():
            material_codigo = row[0]
            cantidad_unitaria = row[1]
            cantidad_requerida = float(cantidad_unitaria) * cantidad_kits

            # Obtener stock disponible
            cursor.execute(
                f"SELECT COALESCE(SUM(stock), 0) FROM stock WHERE material = {placeholder}",
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
        # Obtener orden y BOM
        cursor.execute(
            f"SELECT kit_bom_id, cantidad_kits FROM kit_orden WHERE id = {placeholder}",
            (orden_id,)
        )
        result = cursor.fetchone()
        if not result:
            raise ValueError(f"Orden {orden_id} no encontrada")

        kit_bom_id = result[0]
        cantidad_kits = result[1]

        # Obtener componentes del BOM
        cursor.execute(
            f"""
            SELECT id, material_codigo, cantidad
            FROM kit_bom_componente
            WHERE kit_bom_id = {placeholder}
            """,
            (kit_bom_id,)
        )
        componentes = cursor.fetchall()

        todas_suficientes = True

        for comp in componentes:
            comp_id = comp[0]
            material_codigo = comp[1]
            cantidad_unitaria = float(comp[2])
            cantidad_requerida = cantidad_unitaria * cantidad_kits

            # Obtener stock disponible
            cursor.execute(
                f"SELECT COALESCE(SUM(stock), 0) FROM stock WHERE material = {placeholder}",
                (material_codigo,)
            )
            stock_disponible = float(cursor.fetchone()[0] or 0)

            suficiente = stock_disponible >= cantidad_requerida
            if not suficiente:
                todas_suficientes = False
            cantidad_asignada = min(cantidad_requerida, stock_disponible)

            # Insertar asignación (tabla usa orden_id, componente_id)
            cursor.execute(f"""
                INSERT INTO kit_componente_asignacion
                (orden_id, componente_id, cantidad_requerida, cantidad_asignada, estado, created_at)
                VALUES (?, ?, ?, ?, ?, {sql_datetime_now()})
            """, (
                orden_id,
                comp_id,
                cantidad_requerida,
                cantidad_asignada,
                'allocated' if suficiente else 'short'
            ))

        # Determinar estado basado en disponibilidad
        estado_orden = 'asignado' if todas_suficientes else 'parcial'

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
            SET estado = 'en_proceso', fecha_inicio = {now_fn}
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
            SET estado = 'completado', fecha_completado = {now_fn}
            WHERE id = {placeholder}
            """,
            (orden_id,)
        )

        # Marcar asignaciones como consumed (CHECK constraint requires English)
        cursor.execute(
            f"UPDATE kit_componente_asignacion SET estado = 'consumed' WHERE orden_id = {placeholder}",
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

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Órdenes activas
        cursor.execute("""
            SELECT COUNT(*) FROM kit_orden
            WHERE estado IN ('pendiente', 'asignado', 'parcial', 'en_proceso')
        """)
        activas = cursor.fetchone()[0]

        mes_completado = sql_format_date("fecha_completado", "%Y-%m")
        mes_actual = sql_format_date(sql_datetime_now(), "%Y-%m")

        # Completadas este mes
        cursor.execute(f"""
            SELECT COUNT(*) FROM kit_orden
            WHERE estado = 'completado'
            AND {mes_completado} = {mes_actual}
        """)
        completadas_mes = cursor.fetchone()[0]

        # On-time (completadas antes de fecha_requerida)
        cursor.execute(f"""
            SELECT COUNT(*) FROM kit_orden
            WHERE estado = 'completado'
            AND fecha_completado <= fecha_requerida
            AND {mes_completado} = {mes_actual}
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
