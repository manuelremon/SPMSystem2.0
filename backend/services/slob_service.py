"""
Servicio de gestión de Inventory Aging y SLOB (Slow-moving and Obsolete)

Sprint 53: Inventory Aging & SLOB
- Generación de snapshots de aging
- Análisis de inventario SLOB
- Gestión de disposiciones
"""

from datetime import datetime

from backend.core.db import (
    get_db_connection,
    get_db_transaction,
    sql_date_diff_days,
    sql_datetime_now,
)


def generar_snapshot_aging():
    """
    Genera un snapshot de aging analysis basado en datos de stock y consumo.

    Lógica:
    - Consulta stock actual y fecha del último movimiento
    - Calcula días sin movimiento
    - Categoriza según aging (0-30, 31-60, 61-90, 91-180, 180+)
    - Marca SLOB (180+ días sin movimiento)

    Returns:
        dict: Estadísticas del snapshot generado
    """
    with get_db_transaction() as (conn, cursor):
        # Limpiar snapshot anterior
        cursor.execute("DELETE FROM inventario_aging")

        # Query para obtener stock con último movimiento
        # Nota: stock puede tener duplicados por material+almacen, se agrupan con SUM
        # Dias sin movimiento: diferencia entre ahora y el ultimo movimiento (portable)
        dias_sin_mov = sql_date_diff_days(sql_datetime_now(), "um.fecha_ultimo_movimiento")
        query = f"""
            WITH stock_agrupado AS (
                SELECT
                    material,
                    almacen,
                    SUM(stock) as cantidad,
                    SUM(stock_valorizado) as valor
                FROM stock
                WHERE stock > 0
                GROUP BY material, almacen
            ),
            ultimo_movimiento AS (
                SELECT
                    material,
                    almacen,
                    MAX(fecha) as fecha_ultimo_movimiento
                FROM consumo_historico
                GROUP BY material, almacen
            )
            SELECT
                s.material as material_codigo,
                s.almacen,
                s.cantidad,
                s.valor,
                um.fecha_ultimo_movimiento,
                CASE
                    WHEN um.fecha_ultimo_movimiento IS NULL THEN 365
                    ELSE CAST({dias_sin_mov} AS INTEGER)
                END as dias_sin_movimiento
            FROM stock_agrupado s
            LEFT JOIN ultimo_movimiento um
                ON s.material = um.material AND s.almacen = um.almacen
            """

        cursor.execute(query)
        rows = cursor.fetchall()

        # Insertar datos de aging
        registros_insertados = 0
        slob_count = 0

        for row in rows:
            material_codigo = row[0]
            almacen = row[1]
            cantidad = row[2]
            valor = row[3]
            fecha_ultimo_mov = row[4]
            dias = row[5]

            # Categorizar aging
            if dias <= 30:
                categoria = '0-30'
            elif dias <= 60:
                categoria = '31-60'
            elif dias <= 90:
                categoria = '61-90'
            elif dias <= 180:
                categoria = '91-180'
            else:
                categoria = '180+'

            # Marcar SLOB si 180+ días
            es_slob = 1 if dias >= 180 else 0
            if es_slob:
                slob_count += 1

            cursor.execute("""
            INSERT INTO inventario_aging (
                material_codigo, almacen, cantidad, valor,
                fecha_ultimo_movimiento, dias_sin_movimiento,
                categoria_aging, es_slob
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (material_codigo, almacen, cantidad, valor,
                  fecha_ultimo_mov, dias, categoria, es_slob))

            registros_insertados += 1

        conn.commit()

        return {
            'success': True,
            'registros_insertados': registros_insertados,
            'slob_detectados': slob_count,
            'fecha_snapshot': datetime.now().isoformat()
        }


def obtener_inventario_aging(filtros=None):
    """
    Obtiene inventario aging con filtros y paginación.

    Args:
        filtros (dict): {
            'categoria': str (0-30, 31-60, etc.),
            'almacen': str,
            'material': str (búsqueda parcial),
            'es_slob': bool,
            'page': int,
            'per_page': int
        }

    Returns:
        dict: {items: list, total: int, page: int, pages: int}
    """
    filtros = filtros or {}
    page = filtros.get('page', 1)
    per_page = filtros.get('per_page', 50)
    offset = (page - 1) * per_page

    conn = get_db_connection()
    cursor = conn.cursor()

    # Construir WHERE clause
    where_clauses = []
    params = []

    if filtros.get('categoria'):
        where_clauses.append("categoria_aging = %s")
        params.append(filtros['categoria'])

    if filtros.get('almacen'):
        where_clauses.append("almacen = %s")
        params.append(filtros['almacen'])

    if filtros.get('material'):
        where_clauses.append("material_codigo LIKE %s")
        params.append(f"%{filtros['material']}%")

    if filtros.get('es_slob') is not None:
        where_clauses.append("es_slob = %s")
        params.append(1 if filtros['es_slob'] else 0)

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    # Count total
    cursor.execute(f"SELECT COUNT(*) FROM inventario_aging WHERE {where_sql}", params)
    total = cursor.fetchone()[0]

    # Get paginated results — use subquery for descripcion to avoid JOIN duplicates
    query = f"""
    SELECT
        ia.id, ia.material_codigo, ia.almacen, ia.cantidad, ia.valor,
        ia.fecha_ultimo_movimiento, ia.dias_sin_movimiento,
        ia.categoria_aging, ia.es_slob, ia.snapshot_date,
        (SELECT m.descripcion FROM materiales_bbdd m
         WHERE m.codigo_material = ia.material_codigo LIMIT 1) as material_descripcion
    FROM inventario_aging ia
    WHERE {where_sql}
    ORDER BY ia.dias_sin_movimiento DESC, ia.valor DESC
    LIMIT %s OFFSET %s
    """

    cursor.execute(query, params + [per_page, offset])
    rows = cursor.fetchall()

    items = []
    for row in rows:
        items.append({
            'id': row[0],
            'material_codigo': row[1],
            'almacen': row[2],
            'cantidad': row[3],
            'valor': row[4],
            'fecha_ultimo_movimiento': row[5],
            'dias_sin_movimiento': row[6],
            'categoria_aging': row[7],
            'es_slob': bool(row[8]),
            'snapshot_date': row[9],
            'material_descripcion': row[10] if len(row) > 10 else None
        })

    conn.close()

    return {
        'items': items,
        'total': total,
        'page': page,
        'pages': (total + per_page - 1) // per_page
    }


def obtener_kpis_slob():
    """
    Obtiene KPIs de inventario SLOB.

    Returns:
        dict: KPIs agregados por categoría y disposiciones
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Valor por categoría de aging
    cursor.execute("""
    SELECT
        categoria_aging,
        COUNT(*) as cantidad_items,
        SUM(valor) as valor_total,
        SUM(cantidad) as cantidad_total
    FROM inventario_aging
    GROUP BY categoria_aging
    ORDER BY
        CASE categoria_aging
            WHEN '0-30' THEN 1
            WHEN '31-60' THEN 2
            WHEN '61-90' THEN 3
            WHEN '91-180' THEN 4
            WHEN '180+' THEN 5
        END
    """)

    aging_por_categoria = []
    for row in cursor.fetchall():
        aging_por_categoria.append({
            'categoria': row[0],
            'cantidad_items': row[1],
            'valor_total': row[2],
            'cantidad_total': row[3]
        })

    # SLOB stats
    cursor.execute("""
    SELECT
        COUNT(*) as slob_items,
        SUM(valor) as slob_valor_total,
        SUM(cantidad) as slob_cantidad_total
    FROM inventario_aging
    WHERE es_slob = 1
    """)

    slob_row = cursor.fetchone()
    slob_stats = {
        'items': slob_row[0] or 0,
        'valor_total': slob_row[1] or 0,
        'cantidad_total': slob_row[2] or 0
    }

    # Disposiciones por estado
    cursor.execute("""
    SELECT
        estado,
        tipo_disposicion,
        COUNT(*) as cantidad,
        SUM(costo_recuperado) as costo_recuperado_total
    FROM slob_disposicion
    GROUP BY estado, tipo_disposicion
    """)

    disposiciones = []
    for row in cursor.fetchall():
        disposiciones.append({
            'estado': row[0],
            'tipo_disposicion': row[1],
            'cantidad': row[2],
            'costo_recuperado_total': row[3] or 0
        })

    # Total recovery rate
    cursor.execute("""
    SELECT
        SUM(costo_recuperado) as total_recuperado
    FROM slob_disposicion
    WHERE estado = 'completed'
    """)

    total_recuperado = cursor.fetchone()[0] or 0

    conn.close()

    return {
        'aging_por_categoria': aging_por_categoria,
        'slob': slob_stats,
        'disposiciones': disposiciones,
        'total_recuperado': total_recuperado,
        'recovery_rate': (total_recuperado / slob_stats['valor_total'] * 100) if slob_stats['valor_total'] > 0 else 0
    }


def proponer_disposicion(data, user_id):
    """
    Propone una disposición de inventario SLOB.

    Args:
        data (dict): {
            'material_codigo': str,
            'almacen': str,
            'cantidad': float,
            'tipo_disposicion': str,
            'notas': str
        }
        user_id (int): ID del usuario que propone

    Returns:
        dict: Disposición creada
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO slob_disposicion (
        material_codigo, almacen, cantidad, tipo_disposicion,
        notas, propuesto_por
    ) VALUES (%s, %s, %s, %s, %s, %s)
    RETURNING id
    """, (
        data['material_codigo'],
        data['almacen'],
        data['cantidad'],
        data['tipo_disposicion'],
        data.get('notas', ''),
        user_id
    ))

    disp_id = cursor.fetchone()[0]
    conn.commit()

    # Obtener disposición creada
    cursor.execute("""
    SELECT * FROM slob_disposicion WHERE id = %s
    """, (disp_id,))

    row = cursor.fetchone()
    conn.close()

    return {
        'id': row[0],
        'material_codigo': row[1],
        'almacen': row[2],
        'cantidad': row[3],
        'tipo_disposicion': row[4],
        'estado': row[5],
        'notas': row[6],
        'costo_recuperado': row[7],
        'propuesto_por': row[8],
        'aprobado_por': row[9],
        'completado_at': row[10],
        'created_at': row[11]
    }


def aprobar_disposicion(disp_id, user_id):
    """
    Aprueba una disposición propuesta.

    Args:
        disp_id (int): ID de la disposición
        user_id (int): ID del usuario que aprueba

    Returns:
        dict: {success: bool, message: str}
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verificar que existe y está en estado proposed
    cursor.execute("""
    SELECT estado FROM slob_disposicion WHERE id = %s
    """, (disp_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return {'success': False, 'message': 'Disposición no encontrada'}

    if row[0] != 'proposed':
        conn.close()
        return {'success': False, 'message': f'Disposición en estado {row[0]}, no se puede aprobar'}

    # Actualizar estado
    cursor.execute("""
    UPDATE slob_disposicion
    SET estado = 'approved', aprobado_por = %s
    WHERE id = %s
    """, (user_id, disp_id))

    conn.commit()
    conn.close()

    return {'success': True, 'message': 'Disposición aprobada exitosamente'}


def completar_disposicion(disp_id, costo_recuperado):
    """
    Marca una disposición como completada.

    Args:
        disp_id (int): ID de la disposición
        costo_recuperado (float): Costo recuperado de la disposición

    Returns:
        dict: {success: bool, message: str}
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verificar que existe y está en estado approved
    cursor.execute("""
    SELECT estado FROM slob_disposicion WHERE id = %s
    """, (disp_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return {'success': False, 'message': 'Disposición no encontrada'}

    if row[0] != 'approved':
        conn.close()
        return {'success': False, 'message': f'Disposición en estado {row[0]}, debe estar aprobada'}

    # Actualizar estado
    cursor.execute("""
    UPDATE slob_disposicion
    SET estado = 'completed',
        costo_recuperado = %s,
        completado_at = CURRENT_TIMESTAMP
    WHERE id = %s
    """, (costo_recuperado, disp_id))

    conn.commit()
    conn.close()

    return {'success': True, 'message': 'Disposición completada exitosamente'}


def obtener_disposiciones(filtros=None):
    """
    Obtiene disposiciones con filtros y paginación.

    Args:
        filtros (dict): {
            'estado': str,
            'tipo_disposicion': str,
            'material': str,
            'page': int,
            'per_page': int
        }

    Returns:
        dict: {items: list, total: int, page: int, pages: int}
    """
    filtros = filtros or {}
    page = filtros.get('page', 1)
    per_page = filtros.get('per_page', 50)
    offset = (page - 1) * per_page

    conn = get_db_connection()
    cursor = conn.cursor()

    # Construir WHERE clause
    where_clauses = []
    params = []

    if filtros.get('estado'):
        where_clauses.append("sd.estado = %s")
        params.append(filtros['estado'])

    if filtros.get('tipo_disposicion'):
        where_clauses.append("sd.tipo_disposicion = %s")
        params.append(filtros['tipo_disposicion'])

    if filtros.get('material'):
        where_clauses.append("sd.material_codigo LIKE %s")
        params.append(f"%{filtros['material']}%")

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    # Count total
    cursor.execute(f"SELECT COUNT(*) FROM slob_disposicion sd WHERE {where_sql}", params)
    total = cursor.fetchone()[0]

    # Get paginated results — use subqueries to avoid JOIN duplicates
    query = f"""
    SELECT
        sd.id, sd.material_codigo, sd.almacen, sd.cantidad,
        sd.tipo_disposicion, sd.estado, sd.notas, sd.costo_recuperado,
        sd.propuesto_por, sd.aprobado_por, sd.completado_at, sd.created_at,
        (SELECT u.nombre FROM usuarios u WHERE u.id_spm = CAST(sd.propuesto_por AS TEXT) LIMIT 1) as propuesto_por_nombre,
        (SELECT u.nombre FROM usuarios u WHERE u.id_spm = CAST(sd.aprobado_por AS TEXT) LIMIT 1) as aprobado_por_nombre,
        (SELECT m.descripcion FROM materiales_bbdd m WHERE m.codigo_material = sd.material_codigo LIMIT 1) as material_descripcion
    FROM slob_disposicion sd
    WHERE {where_sql}
    ORDER BY sd.created_at DESC
    LIMIT %s OFFSET %s
    """

    cursor.execute(query, params + [per_page, offset])
    rows = cursor.fetchall()

    items = []
    for row in rows:
        items.append({
            'id': row[0],
            'material_codigo': row[1],
            'almacen': row[2],
            'cantidad': row[3],
            'tipo_disposicion': row[4],
            'estado': row[5],
            'notas': row[6],
            'costo_recuperado': row[7],
            'propuesto_por': row[8],
            'aprobado_por': row[9],
            'completado_at': row[10],
            'created_at': row[11],
            'propuesto_por_nombre': row[12] if len(row) > 12 else None,
            'aprobado_por_nombre': row[13] if len(row) > 13 else None,
            'material_descripcion': row[14] if len(row) > 14 else None
        })

    conn.close()

    return {
        'items': items,
        'total': total,
        'page': page,
        'pages': (total + per_page - 1) // per_page
    }
