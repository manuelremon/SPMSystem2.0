"""
Servicio de Engineering Change Orders (ECO).
Gestiona órdenes de cambio de ingeniería con flujo de aprobación.
"""

import logging
from datetime import datetime

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def crear_eco(data: dict) -> int:
    """
    Crea una nueva orden de cambio de ingeniería (ECO).

    Args:
        data: {
            'titulo': str,
            'descripcion': str,
            'tipo': str (design_change, bom_change, specification_change, process_change, other),
            'prioridad': str (low, medium, high, critical),
            'material_codigo': str (optional),
            'solicitante_id': int,
            'fecha_efectividad': str (optional),
            'costo_estimado': float (optional),
            'justificacion': str (optional)
        }

    Returns:
        ID del ECO creado
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        # Generar numero_eco (ECO-YYYY-NNNN)
        year = datetime.now().year
        if using_pg:
            cursor.execute(
                "SELECT COALESCE(MAX(id), 0) FROM eco WHERE numero_eco LIKE %s",
                (f'ECO-{year}-%',)
            )
        else:
            cursor.execute(
                "SELECT COALESCE(MAX(id), 0) FROM eco WHERE numero_eco LIKE ?",
                (f'ECO-{year}-%',)
            )
        max_id = cursor.fetchone()[0]
        numero_eco = f"ECO-{year}-{max_id + 1:04d}"

        # Insertar ECO
        if using_pg:
            cursor.execute("""
                INSERT INTO eco
                (numero_eco, titulo, descripcion, tipo, prioridad, material_codigo,
                 solicitante_id, fecha_efectividad, costo_estimado, justificacion,
                 estado, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (
                numero_eco,
                data['titulo'],
                data['descripcion'],
                data['tipo'],
                data['prioridad'],
                data.get('material_codigo'),
                data['solicitante_id'],
                data.get('fecha_efectividad'),
                data.get('costo_estimado'),
                data.get('justificacion'),
                'draft'
            ))
            eco_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO eco
                (numero_eco, titulo, descripcion, tipo, prioridad, material_codigo,
                 solicitante_id, fecha_efectividad, costo_estimado, justificacion,
                 estado, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (
                numero_eco,
                data['titulo'],
                data['descripcion'],
                data['tipo'],
                data['prioridad'],
                data.get('material_codigo'),
                data['solicitante_id'],
                data.get('fecha_efectividad'),
                data.get('costo_estimado'),
                data.get('justificacion'),
                'draft'
            ))
            eco_id = cursor.lastrowid

        # Insertar historial inicial
        if using_pg:
            cursor.execute("""
                INSERT INTO eco_historial (eco_id, estado, actor_id, comentarios, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (eco_id, 'draft', data['solicitante_id'], 'ECO creada'))
        else:
            cursor.execute("""
                INSERT INTO eco_historial (eco_id, estado, actor_id, comentarios, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            """, (eco_id, 'draft', data['solicitante_id'], 'ECO creada'))

        conn.commit()
        logger.info(f"ECO creada: {numero_eco} (ID: {eco_id})")
        return eco_id


def obtener_ecos(filtros: dict = None) -> dict:
    """
    Obtiene lista paginada de ECOs con filtros.

    Args:
        filtros: {
            'estado': str (optional),
            'tipo': str (optional),
            'prioridad': str (optional),
            'material_codigo': str (optional),
            'search': str (optional),
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

    # Construir WHERE clause
    where_clauses = []
    params = []

    if filtros.get('estado'):
        where_clauses.append(f"e.estado = {placeholder}")
        params.append(filtros['estado'])

    if filtros.get('tipo'):
        where_clauses.append(f"e.tipo = {placeholder}")
        params.append(filtros['tipo'])

    if filtros.get('prioridad'):
        where_clauses.append(f"e.prioridad = {placeholder}")
        params.append(filtros['prioridad'])

    if filtros.get('material_codigo'):
        where_clauses.append(f"e.material_codigo = {placeholder}")
        params.append(filtros['material_codigo'])

    if filtros.get('search'):
        where_clauses.append(f"(e.numero_eco LIKE {placeholder} OR e.titulo LIKE {placeholder})")
        search_term = f"%{filtros['search']}%"
        params.extend([search_term, search_term])

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Contar total
        cursor.execute(
            f"SELECT COUNT(*) FROM eco e {where_sql}",
            params
        )
        total = cursor.fetchone()[0]

        # Obtener items
        cursor.execute(
            f"""
            SELECT
                e.id, e.numero_eco, e.titulo, e.tipo, e.prioridad, e.estado,
                e.material_codigo, e.solicitante_id, u.nombre as solicitante_nombre,
                e.fecha_efectividad, e.costo_estimado, e.created_at
            FROM eco e
            LEFT JOIN usuarios u ON e.solicitante_id = u.id_spm
            {where_sql}
            ORDER BY e.created_at DESC
            LIMIT {placeholder} OFFSET {placeholder}
            """,
            params + [per_page, offset]
        )

        rows = cursor.fetchall()
        items = []
        for row in rows:
            items.append({
                'id': row[0],
                'numero_eco': row[1],
                'titulo': row[2],
                'tipo': row[3],
                'prioridad': row[4],
                'estado': row[5],
                'material_codigo': row[6],
                'solicitante_id': row[7],
                'solicitante_nombre': row[8],
                'fecha_efectividad': row[9],
                'costo_estimado': float(row[10]) if row[10] else 0,
                'created_at': row[11]
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


def obtener_detalle_eco(eco_id: int) -> dict:
    """
    Obtiene detalle completo de un ECO con cambios, aprobaciones e historial.

    Args:
        eco_id: ID del ECO

    Returns:
        Diccionario con datos completos del ECO
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener ECO
        cursor.execute(
            f"""
            SELECT
                e.id, e.numero_eco, e.titulo, e.descripcion, e.tipo, e.prioridad,
                e.estado, e.material_codigo, m.descripcion as material_descripcion,
                e.solicitante_id, u.nombre as solicitante_nombre,
                e.fecha_efectividad, e.costo_estimado, e.justificacion,
                e.created_at, e.updated_at
            FROM eco e
            LEFT JOIN catalogo_materiales m ON e.material_codigo = m.codigo
            LEFT JOIN usuarios u ON e.solicitante_id = u.id_spm
            WHERE e.id = {placeholder}
            """,
            (eco_id,)
        )

        row = cursor.fetchone()
        if not row:
            raise ValueError(f"ECO {eco_id} no encontrado")

        eco = {
            'id': row[0],
            'numero_eco': row[1],
            'titulo': row[2],
            'descripcion': row[3],
            'tipo': row[4],
            'prioridad': row[5],
            'estado': row[6],
            'material_codigo': row[7],
            'material_descripcion': row[8],
            'solicitante_id': row[9],
            'solicitante_nombre': row[10],
            'fecha_efectividad': row[11],
            'costo_estimado': float(row[12]) if row[12] else 0,
            'justificacion': row[13],
            'created_at': row[14],
            'updated_at': row[15]
        }

        # Obtener cambios
        cursor.execute(
            f"""
            SELECT
                id, campo, valor_anterior, valor_nuevo, razon, created_at
            FROM eco_cambio
            WHERE eco_id = {placeholder}
            ORDER BY created_at
            """,
            (eco_id,)
        )

        cambios = []
        for row in cursor.fetchall():
            cambios.append({
                'id': row[0],
                'campo': row[1],
                'valor_anterior': row[2],
                'valor_nuevo': row[3],
                'razon': row[4],
                'created_at': row[5]
            })

        eco['cambios'] = cambios

        # Obtener aprobaciones
        cursor.execute(
            f"""
            SELECT
                ea.id, ea.aprobador_id, u.nombre as aprobador_nombre,
                ea.estado, ea.comentarios, ea.fecha_aprobacion
            FROM eco_aprobacion ea
            LEFT JOIN usuarios u ON ea.aprobador_id = u.id_spm
            WHERE ea.eco_id = {placeholder}
            ORDER BY ea.created_at
            """,
            (eco_id,)
        )

        aprobaciones = []
        for row in cursor.fetchall():
            aprobaciones.append({
                'id': row[0],
                'aprobador_id': row[1],
                'aprobador_nombre': row[2],
                'estado': row[3],
                'comentarios': row[4],
                'fecha_aprobacion': row[5]
            })

        eco['aprobaciones'] = aprobaciones

        # Obtener historial
        cursor.execute(
            f"""
            SELECT
                eh.id, eh.estado, eh.actor_id, u.nombre as actor_nombre,
                eh.comentarios, eh.created_at
            FROM eco_historial eh
            LEFT JOIN usuarios u ON eh.actor_id = u.id_spm
            WHERE eh.eco_id = {placeholder}
            ORDER BY eh.created_at DESC
            """,
            (eco_id,)
        )

        historial = []
        for row in cursor.fetchall():
            historial.append({
                'id': row[0],
                'estado': row[1],
                'actor_id': row[2],
                'actor_nombre': row[3],
                'comentarios': row[4],
                'created_at': row[5]
            })

        eco['historial'] = historial

        return eco
    finally:
        cursor.close()
        conn.close()


def actualizar_eco(eco_id: int, data: dict) -> dict:
    """
    Actualiza un ECO (solo si está en estado draft).

    Args:
        eco_id: ID del ECO
        data: Campos a actualizar

    Returns:
        ECO actualizado
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Verificar estado
        cursor.execute(
            f"SELECT estado FROM eco WHERE id = {placeholder}",
            (eco_id,)
        )
        result = cursor.fetchone()
        if not result:
            raise ValueError(f"ECO {eco_id} no encontrado")
        if result[0] != 'draft':
            raise ValueError("Solo se pueden actualizar ECOs en estado draft")

        # Construir UPDATE
        updates = []
        params = []

        for field in ['titulo', 'descripcion', 'tipo', 'prioridad', 'material_codigo',
                      'fecha_efectividad', 'costo_estimado', 'justificacion']:
            if field in data:
                updates.append(f"{field} = {placeholder}")
                params.append(data[field])

        if updates:
            now_fn = "NOW()" if using_pg else "datetime('now')"
            updates.append(f"updated_at = {now_fn}")
            params.append(eco_id)

            cursor.execute(
                f"UPDATE eco SET {', '.join(updates)} WHERE id = {placeholder}",
                params
            )

        conn.commit()

        # Retornar ECO actualizado
        return obtener_detalle_eco(eco_id)


def agregar_cambios(eco_id: int, cambios: list) -> None:
    """
    Agrega cambios a un ECO.

    Args:
        eco_id: ID del ECO
        cambios: Lista de dicts [{campo, valor_anterior, valor_nuevo, razon}, ...]
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        for cambio in cambios:
            if using_pg:
                cursor.execute("""
                    INSERT INTO eco_cambio
                    (eco_id, campo, valor_anterior, valor_nuevo, razon, created_at)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                """, (
                    eco_id,
                    cambio['campo'],
                    cambio.get('valor_anterior'),
                    cambio['valor_nuevo'],
                    cambio.get('razon')
                ))
            else:
                cursor.execute("""
                    INSERT INTO eco_cambio
                    (eco_id, campo, valor_anterior, valor_nuevo, razon, created_at)
                    VALUES (?, ?, ?, ?, ?, datetime('now'))
                """, (
                    eco_id,
                    cambio['campo'],
                    cambio.get('valor_anterior'),
                    cambio['valor_nuevo'],
                    cambio.get('razon')
                ))

        conn.commit()
        logger.info(f"Agregados {len(cambios)} cambios al ECO {eco_id}")


def solicitar_aprobacion(eco_id: int, actor_id: int) -> None:
    """
    Solicita aprobación para un ECO.

    Args:
        eco_id: ID del ECO
        actor_id: ID del usuario solicitando aprobación
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Actualizar estado
        now_fn = "NOW()" if using_pg else "datetime('now')"
        cursor.execute(
            f"UPDATE eco SET estado = 'submitted', updated_at = {now_fn} WHERE id = {placeholder}",
            (eco_id,)
        )

        # Crear historial
        if using_pg:
            cursor.execute("""
                INSERT INTO eco_historial (eco_id, estado, actor_id, comentarios, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (eco_id, 'submitted', actor_id, 'ECO enviada para aprobación'))
        else:
            cursor.execute("""
                INSERT INTO eco_historial (eco_id, estado, actor_id, comentarios, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            """, (eco_id, 'submitted', actor_id, 'ECO enviada para aprobación'))

        # Crear registros de aprobación (simplificado: buscar usuarios con rol admin o jefe)
        cursor.execute(
            "SELECT id_spm FROM usuarios WHERE rol IN ('admin', 'jefe') AND activo = TRUE"
        )
        aprobadores = [row[0] for row in cursor.fetchall()]

        for aprobador_id in aprobadores:
            if using_pg:
                cursor.execute("""
                    INSERT INTO eco_aprobacion (eco_id, aprobador_id, estado, created_at)
                    VALUES (%s, %s, %s, NOW())
                """, (eco_id, aprobador_id, 'pending'))
            else:
                cursor.execute("""
                    INSERT INTO eco_aprobacion (eco_id, aprobador_id, estado, created_at)
                    VALUES (?, ?, ?, datetime('now'))
                """, (eco_id, aprobador_id, 'pending'))

        conn.commit()
        logger.info(f"ECO {eco_id} enviada para aprobación a {len(aprobadores)} aprobadores")


def aprobar_eco(eco_id: int, aprobador_id: int, comentarios: str = None) -> None:
    """
    Aprueba un ECO.

    Args:
        eco_id: ID del ECO
        aprobador_id: ID del aprobador
        comentarios: Comentarios opcionales
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'
    now_fn = "NOW()" if using_pg else "datetime('now')"

    with get_db_transaction() as (conn, cursor):
        # Actualizar aprobación
        cursor.execute(
            f"""
            UPDATE eco_aprobacion
            SET estado = 'approved', comentarios = {placeholder},
                fecha_aprobacion = {now_fn}
            WHERE eco_id = {placeholder} AND aprobador_id = {placeholder}
            """,
            (comentarios, eco_id, aprobador_id)
        )

        # Verificar si todas las aprobaciones están completas
        cursor.execute(
            f"""
            SELECT COUNT(*) FROM eco_aprobacion
            WHERE eco_id = {placeholder} AND estado = 'pending'
            """,
            (eco_id,)
        )
        pending = cursor.fetchone()[0]

        if pending == 0:
            # Todas aprobadas, actualizar ECO
            cursor.execute(
                f"UPDATE eco SET estado = 'approved', updated_at = {now_fn} WHERE id = {placeholder}",
                (eco_id,)
            )

            if using_pg:
                cursor.execute("""
                    INSERT INTO eco_historial (eco_id, estado, actor_id, comentarios, created_at)
                    VALUES (%s, %s, %s, %s, NOW())
                """, (eco_id, 'approved', aprobador_id, 'Todas las aprobaciones completadas'))
            else:
                cursor.execute("""
                    INSERT INTO eco_historial (eco_id, estado, actor_id, comentarios, created_at)
                    VALUES (?, ?, ?, ?, datetime('now'))
                """, (eco_id, 'approved', aprobador_id, 'Todas las aprobaciones completadas'))

        conn.commit()
        logger.info(f"ECO {eco_id} aprobada por usuario {aprobador_id}")


def rechazar_eco(eco_id: int, aprobador_id: int, comentarios: str = None) -> None:
    """
    Rechaza un ECO.

    Args:
        eco_id: ID del ECO
        aprobador_id: ID del aprobador
        comentarios: Comentarios opcionales
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'
    now_fn = "NOW()" if using_pg else "datetime('now')"

    with get_db_transaction() as (conn, cursor):
        # Actualizar aprobación
        cursor.execute(
            f"""
            UPDATE eco_aprobacion
            SET estado = 'rejected', comentarios = {placeholder},
                fecha_aprobacion = {now_fn}
            WHERE eco_id = {placeholder} AND aprobador_id = {placeholder}
            """,
            (comentarios, eco_id, aprobador_id)
        )

        # Actualizar ECO
        cursor.execute(
            f"UPDATE eco SET estado = 'rejected', updated_at = {now_fn} WHERE id = {placeholder}",
            (eco_id,)
        )

        # Crear historial
        if using_pg:
            cursor.execute("""
                INSERT INTO eco_historial (eco_id, estado, actor_id, comentarios, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (eco_id, 'rejected', aprobador_id, comentarios or 'ECO rechazada'))
        else:
            cursor.execute("""
                INSERT INTO eco_historial (eco_id, estado, actor_id, comentarios, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            """, (eco_id, 'rejected', aprobador_id, comentarios or 'ECO rechazada'))

        conn.commit()
        logger.info(f"ECO {eco_id} rechazada por usuario {aprobador_id}")


def implementar_eco(eco_id: int, actor_id: int) -> None:
    """
    Marca un ECO como implementado.

    Args:
        eco_id: ID del ECO
        actor_id: ID del usuario implementando
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'
    now_fn = "NOW()" if using_pg else "datetime('now')"

    with get_db_transaction() as (conn, cursor):
        # Verificar estado
        cursor.execute(
            f"SELECT estado FROM eco WHERE id = {placeholder}",
            (eco_id,)
        )
        result = cursor.fetchone()
        if not result:
            raise ValueError(f"ECO {eco_id} no encontrado")
        if result[0] != 'approved':
            raise ValueError("Solo se pueden implementar ECOs aprobados")

        # Actualizar estado
        cursor.execute(
            f"UPDATE eco SET estado = 'completed', updated_at = {now_fn} WHERE id = {placeholder}",
            (eco_id,)
        )

        # Crear historial
        if using_pg:
            cursor.execute("""
                INSERT INTO eco_historial (eco_id, estado, actor_id, comentarios, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (eco_id, 'completed', actor_id, 'ECO implementada'))
        else:
            cursor.execute("""
                INSERT INTO eco_historial (eco_id, estado, actor_id, comentarios, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            """, (eco_id, 'completed', actor_id, 'ECO implementada'))

        conn.commit()
        logger.info(f"ECO {eco_id} marcada como completada")


def obtener_impacto(eco_id: int) -> dict:
    """
    Obtiene el impacto de un ECO en el sistema.

    Args:
        eco_id: ID del ECO

    Returns:
        {ordenes_compra: [], contratos: [], stock_afectado: []}
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener material del ECO
        cursor.execute(
            f"SELECT material_codigo FROM eco WHERE id = {placeholder}",
            (eco_id,)
        )
        result = cursor.fetchone()
        if not result or not result[0]:
            return {'ordenes_compra': [], 'contratos': [], 'stock_afectado': []}

        material_codigo = result[0]

        # Órdenes de compra abiertas
        cursor.execute(
            f"""
            SELECT oc.id, oc.numero, oc.estado, oci.cantidad, oci.precio_unitario
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            WHERE oci.material_codigo = {placeholder}
            AND oc.estado IN ('draft', 'submitted', 'approved')
            """,
            (material_codigo,)
        )

        ordenes_compra = []
        for row in cursor.fetchall():
            ordenes_compra.append({
                'id': row[0],
                'numero': row[1],
                'estado': row[2],
                'cantidad': float(row[3]) if row[3] else 0,
                'precio_unitario': float(row[4]) if row[4] else 0
            })

        # Contratos activos
        cursor.execute(
            f"""
            SELECT c.id, c.numero_contrato, c.estado, ci.cantidad, ci.precio_unitario
            FROM contrato c
            JOIN contrato_item ci ON c.id = ci.contrato_id
            WHERE ci.material_codigo = {placeholder}
            AND c.estado = 'active'
            """,
            (material_codigo,)
        )

        contratos = []
        for row in cursor.fetchall():
            contratos.append({
                'id': row[0],
                'numero_contrato': row[1],
                'estado': row[2],
                'cantidad': float(row[3]) if row[3] else 0,
                'precio_unitario': float(row[4]) if row[4] else 0
            })

        # Stock actual
        cursor.execute(
            f"""
            SELECT almacen, stock, unidad
            FROM stock
            WHERE codigo_material = {placeholder}
            """,
            (material_codigo,)
        )

        stock_afectado = []
        for row in cursor.fetchall():
            stock_afectado.append({
                'almacen': row[0],
                'stock': float(row[1]) if row[1] else 0,
                'unidad': row[2]
            })

        return {
            'ordenes_compra': ordenes_compra,
            'contratos': contratos,
            'stock_afectado': stock_afectado
        }
    finally:
        cursor.close()
        conn.close()


def obtener_kpis() -> dict:
    """
    Obtiene KPIs del proceso de ECO.

    Returns:
        {
            'pendientes': int,
            'implementadas_mes': int,
            'rechazadas_mes': int,
            'tiempo_promedio_aprobacion': float
        }
    """
    using_pg = is_using_postgresql()

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Pendientes (submitted + under_review)
        cursor.execute("""
            SELECT COUNT(*) FROM eco
            WHERE estado IN ('submitted', 'under_review')
        """)
        pendientes = cursor.fetchone()[0]

        # Implementadas este mes
        if using_pg:
            cursor.execute("""
                SELECT COUNT(*) FROM eco
                WHERE estado = 'completed'
                AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', CURRENT_DATE)
            """)
        else:
            cursor.execute("""
                SELECT COUNT(*) FROM eco
                WHERE estado = 'completed'
                AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now')
            """)
        implementadas_mes = cursor.fetchone()[0]

        # Rechazadas este mes
        if using_pg:
            cursor.execute("""
                SELECT COUNT(*) FROM eco
                WHERE estado = 'rejected'
                AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', CURRENT_DATE)
            """)
        else:
            cursor.execute("""
                SELECT COUNT(*) FROM eco
                WHERE estado = 'rejected'
                AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now')
            """)
        rechazadas_mes = cursor.fetchone()[0]

        # Tiempo promedio de aprobación (días)
        if using_pg:
            cursor.execute("""
                SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)
                FROM eco
                WHERE estado IN ('approved', 'completed')
            """)
        else:
            cursor.execute("""
                SELECT AVG(JULIANDAY(updated_at) - JULIANDAY(created_at))
                FROM eco
                WHERE estado IN ('approved', 'completed')
            """)
        tiempo_promedio = cursor.fetchone()[0] or 0

        return {
            'pendientes': pendientes,
            'implementadas_mes': implementadas_mes,
            'rechazadas_mes': rechazadas_mes,
            'tiempo_promedio_aprobacion': round(float(tiempo_promedio), 2)
        }
    finally:
        cursor.close()
        conn.close()
