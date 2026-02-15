"""
Quality Service
Gestión de inspecciones de calidad y NCRs (Non-Conformance Reports)
"""

from datetime import datetime

from backend.core.db import get_db_connection, get_db_transaction


def crear_inspeccion(data, user_id):
    """
    Crear nueva inspección de entrada

    Args:
        data: dict con recepcion_id, tipo, notas
        user_id: ID del inspector

    Returns:
        dict con inspeccion creada
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Generar número de inspección único: INS-YYYYMMDD-XXX
    fecha_hoy = datetime.now().strftime('%Y%m%d')
    cursor.execute("""
        SELECT COUNT(*) FROM inspeccion_entrada
        WHERE numero_inspeccion LIKE ?
    """, (f"INS-{fecha_hoy}-%",))

    count = cursor.fetchone()[0]
    numero_inspeccion = f"INS-{fecha_hoy}-{count + 1:03d}"

    # Insertar inspección
    cursor.execute("""
        INSERT INTO inspeccion_entrada
        (numero_inspeccion, recepcion_id, tipo, inspector_id, notas, resultado)
        VALUES (?, ?, ?, ?, ?, 'pass')
    """, (
        numero_inspeccion,
        data.get('recepcion_id'),
        data.get('tipo', 'sample'),
        user_id,
        data.get('notas')
    ))

    inspeccion_id = cursor.lastrowid
    conn.commit()

    # Recuperar inspección creada
    cursor.execute("""
        SELECT id, numero_inspeccion, recepcion_id, tipo, inspector_id,
               fecha, resultado, notas, created_at
        FROM inspeccion_entrada
        WHERE id = ?
    """, (inspeccion_id,))

    row = cursor.fetchone()
    conn.close()

    return {
        'id': row[0],
        'numero_inspeccion': row[1],
        'recepcion_id': row[2],
        'tipo': row[3],
        'inspector_id': row[4],
        'fecha': row[5],
        'resultado': row[6],
        'notas': row[7],
        'created_at': row[8]
    }


def registrar_resultado_inspeccion(inspeccion_id, items, user_id):
    """
    Registrar resultados de inspección de items

    Args:
        inspeccion_id: ID de la inspección
        items: lista de dicts con recepcion_item_id, cantidad_inspeccionada,
               cantidad_aprobada, cantidad_rechazada, resultado, defectos
        user_id: ID del usuario

    Returns:
        dict con resultado final de la inspección
    """
    conn, cursor = get_db_transaction()

    try:
        # Insertar o actualizar items inspeccionados
        tiene_fallas = False
        todos_passed = True
        ncrs_creados = []

        for item in items:
            cursor.execute("""
                INSERT INTO inspeccion_item
                (inspeccion_id, recepcion_item_id, cantidad_inspeccionada,
                 cantidad_aprobada, cantidad_rechazada, resultado, defectos)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                inspeccion_id,
                item.get('recepcion_item_id'),
                item.get('cantidad_inspeccionada'),
                item.get('cantidad_aprobada', 0),
                item.get('cantidad_rechazada', 0),
                item.get('resultado', 'pass'),
                item.get('defectos')
            ))

            resultado = item.get('resultado', 'pass')
            if resultado == 'fail':
                tiene_fallas = True
                todos_passed = False

                # Auto-crear NCR para items fallidos
                if item.get('cantidad_rechazada', 0) > 0:
                    ncr = _generar_ncr_desde_item(
                        inspeccion_id,
                        item,
                        user_id,
                        cursor
                    )
                    ncrs_creados.append(ncr)

            elif resultado == 'partial':
                todos_passed = False

        # Determinar resultado final de la inspección
        if todos_passed:
            resultado_final = 'pass'
        elif tiene_fallas:
            resultado_final = 'fail'
        else:
            resultado_final = 'partial'

        # Actualizar resultado de la inspección
        cursor.execute("""
            UPDATE inspeccion_entrada
            SET resultado = ?
            WHERE id = ?
        """, (resultado_final, inspeccion_id))

        conn.commit()

        return {
            'inspeccion_id': inspeccion_id,
            'resultado': resultado_final,
            'items_procesados': len(items),
            'ncrs_creados': ncrs_creados
        }

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def _generar_ncr_desde_item(inspeccion_id, item, user_id, cursor):
    """Helper para generar NCR desde un item fallido"""
    # Generar número NCR
    fecha_hoy = datetime.now().strftime('%Y%m%d')
    cursor.execute("""
        SELECT COUNT(*) FROM ncr
        WHERE numero_ncr LIKE ?
    """, (f"NCR-{fecha_hoy}-%",))

    count = cursor.fetchone()[0]
    numero_ncr = f"NCR-{fecha_hoy}-{count + 1:03d}"

    # Obtener info del item
    cursor.execute("""
        SELECT ri.material_codigo, ri.proveedor_cuit
        FROM recepcion_item ri
        WHERE ri.id = ?
    """, (item.get('recepcion_item_id'),))

    item_info = cursor.fetchone()
    material_codigo = item_info[0] if item_info else None
    proveedor_cuit = item_info[1] if item_info else None

    # Determinar severidad basada en defectos
    defectos = item.get('defectos', '').lower()
    if 'critico' in defectos or 'crítico' in defectos:
        severidad = 'critical'
    elif 'mayor' in defectos:
        severidad = 'major'
    else:
        severidad = 'minor'

    # Insertar NCR
    cursor.execute("""
        INSERT INTO ncr
        (numero_ncr, inspeccion_id, proveedor_cuit, material_codigo,
         cantidad_afectada, descripcion, severidad, reportado_por, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
    """, (
        numero_ncr,
        inspeccion_id,
        proveedor_cuit,
        material_codigo,
        item.get('cantidad_rechazada'),
        f"Defectos encontrados: {item.get('defectos', 'No especificado')}",
        severidad,
        user_id
    ))

    ncr_id = cursor.lastrowid

    # Insertar historial
    cursor.execute("""
        INSERT INTO ncr_historial (ncr_id, estado_anterior, estado_nuevo, actor_id, notas)
        VALUES (?, NULL, 'open', ?, 'NCR creado automáticamente desde inspección')
    """, (ncr_id, user_id))

    return {
        'id': ncr_id,
        'numero_ncr': numero_ncr,
        'severidad': severidad
    }


def generar_ncr(inspeccion_id, proveedor_cuit, material_codigo, cantidad,
                descripcion, severidad, user_id):
    """
    Generar NCR manualmente

    Args:
        inspeccion_id: ID de inspección (opcional)
        proveedor_cuit: CUIT del proveedor
        material_codigo: Código SAP del material
        cantidad: Cantidad afectada
        descripcion: Descripción de la no conformidad
        severidad: critical/major/minor
        user_id: ID del usuario reportante

    Returns:
        dict con NCR creado
    """
    conn, cursor = get_db_transaction()

    try:
        # Generar número NCR
        fecha_hoy = datetime.now().strftime('%Y%m%d')
        cursor.execute("""
            SELECT COUNT(*) FROM ncr
            WHERE numero_ncr LIKE ?
        """, (f"NCR-{fecha_hoy}-%",))

        count = cursor.fetchone()[0]
        numero_ncr = f"NCR-{fecha_hoy}-{count + 1:03d}"

        # Insertar NCR
        cursor.execute("""
            INSERT INTO ncr
            (numero_ncr, inspeccion_id, proveedor_cuit, material_codigo,
             cantidad_afectada, descripcion, severidad, reportado_por, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
        """, (
            numero_ncr,
            inspeccion_id,
            proveedor_cuit,
            material_codigo,
            cantidad,
            descripcion,
            severidad,
            user_id
        ))

        ncr_id = cursor.lastrowid

        # Insertar historial
        cursor.execute("""
            INSERT INTO ncr_historial (ncr_id, estado_anterior, estado_nuevo, actor_id, notas)
            VALUES (?, NULL, 'open', ?, 'NCR creado manualmente')
        """, (ncr_id, user_id))

        conn.commit()

        # Recuperar NCR creado
        cursor.execute("""
            SELECT id, numero_ncr, inspeccion_id, proveedor_cuit, material_codigo,
                   cantidad_afectada, descripcion, severidad, estado, reportado_por,
                   asignado_a, fecha_resolucion, accion_correctiva, created_at, updated_at
            FROM ncr
            WHERE id = ?
        """, (ncr_id,))

        row = cursor.fetchone()

        return {
            'id': row[0],
            'numero_ncr': row[1],
            'inspeccion_id': row[2],
            'proveedor_cuit': row[3],
            'material_codigo': row[4],
            'cantidad_afectada': row[5],
            'descripcion': row[6],
            'severidad': row[7],
            'estado': row[8],
            'reportado_por': row[9],
            'asignado_a': row[10],
            'fecha_resolucion': row[11],
            'accion_correctiva': row[12],
            'created_at': row[13],
            'updated_at': row[14]
        }

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def obtener_inspecciones(filtros=None):
    """
    Obtener lista paginada de inspecciones

    Args:
        filtros: dict con resultado, fecha_desde, fecha_hasta, page, per_page

    Returns:
        dict con inspecciones y paginación
    """
    filtros = filtros or {}
    page = filtros.get('page', 1)
    per_page = filtros.get('per_page', 20)
    offset = (page - 1) * per_page

    conn = get_db_connection()
    cursor = conn.cursor()

    # Construir query con filtros
    where_clauses = []
    params = []

    if filtros.get('resultado'):
        where_clauses.append("resultado = ?")
        params.append(filtros['resultado'])

    if filtros.get('fecha_desde'):
        where_clauses.append("fecha >= ?")
        params.append(filtros['fecha_desde'])

    if filtros.get('fecha_hasta'):
        where_clauses.append("fecha <= ?")
        params.append(filtros['fecha_hasta'])

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    # Contar total
    cursor.execute(f"""
        SELECT COUNT(*) FROM inspeccion_entrada
        WHERE {where_sql}
    """, params)
    total = cursor.fetchone()[0]

    # Obtener inspecciones paginadas
    cursor.execute(f"""
        SELECT id, numero_inspeccion, recepcion_id, tipo, inspector_id,
               fecha, resultado, notas, created_at
        FROM inspeccion_entrada
        WHERE {where_sql}
        ORDER BY fecha DESC
        LIMIT ? OFFSET ?
    """, params + [per_page, offset])

    rows = cursor.fetchall()
    conn.close()

    inspecciones = [{
        'id': row[0],
        'numero_inspeccion': row[1],
        'recepcion_id': row[2],
        'tipo': row[3],
        'inspector_id': row[4],
        'fecha': row[5],
        'resultado': row[6],
        'notas': row[7],
        'created_at': row[8]
    } for row in rows]

    return {
        'inspecciones': inspecciones,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }


def obtener_detalle_inspeccion(inspeccion_id):
    """
    Obtener detalle de inspección con items

    Args:
        inspeccion_id: ID de la inspección

    Returns:
        dict con inspección y items
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener inspección
    cursor.execute("""
        SELECT id, numero_inspeccion, recepcion_id, tipo, inspector_id,
               fecha, resultado, notas, created_at
        FROM inspeccion_entrada
        WHERE id = ?
    """, (inspeccion_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    inspeccion = {
        'id': row[0],
        'numero_inspeccion': row[1],
        'recepcion_id': row[2],
        'tipo': row[3],
        'inspector_id': row[4],
        'fecha': row[5],
        'resultado': row[6],
        'notas': row[7],
        'created_at': row[8]
    }

    # Obtener items
    cursor.execute("""
        SELECT id, recepcion_item_id, cantidad_inspeccionada,
               cantidad_aprobada, cantidad_rechazada, resultado, defectos, created_at
        FROM inspeccion_item
        WHERE inspeccion_id = ?
        ORDER BY id
    """, (inspeccion_id,))

    items = [{
        'id': row[0],
        'recepcion_item_id': row[1],
        'cantidad_inspeccionada': row[2],
        'cantidad_aprobada': row[3],
        'cantidad_rechazada': row[4],
        'resultado': row[5],
        'defectos': row[6],
        'created_at': row[7]
    } for row in cursor.fetchall()]

    conn.close()

    inspeccion['items'] = items
    return inspeccion


def obtener_ncrs(filtros=None):
    """
    Obtener lista paginada de NCRs

    Args:
        filtros: dict con estado, severidad, proveedor, page, per_page

    Returns:
        dict con NCRs y paginación
    """
    filtros = filtros or {}
    page = filtros.get('page', 1)
    per_page = filtros.get('per_page', 20)
    offset = (page - 1) * per_page

    conn = get_db_connection()
    cursor = conn.cursor()

    # Construir query con filtros
    where_clauses = []
    params = []

    if filtros.get('estado'):
        where_clauses.append("estado = ?")
        params.append(filtros['estado'])

    if filtros.get('severidad'):
        where_clauses.append("severidad = ?")
        params.append(filtros['severidad'])

    if filtros.get('proveedor'):
        where_clauses.append("proveedor_cuit = ?")
        params.append(filtros['proveedor'])

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    # Contar total
    cursor.execute(f"""
        SELECT COUNT(*) FROM ncr
        WHERE {where_sql}
    """, params)
    total = cursor.fetchone()[0]

    # Obtener NCRs paginados
    cursor.execute(f"""
        SELECT id, numero_ncr, inspeccion_id, proveedor_cuit, material_codigo,
               cantidad_afectada, descripcion, severidad, estado, reportado_por,
               asignado_a, fecha_resolucion, accion_correctiva, created_at, updated_at
        FROM ncr
        WHERE {where_sql}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    """, params + [per_page, offset])

    rows = cursor.fetchall()
    conn.close()

    ncrs = [{
        'id': row[0],
        'numero_ncr': row[1],
        'inspeccion_id': row[2],
        'proveedor_cuit': row[3],
        'material_codigo': row[4],
        'cantidad_afectada': row[5],
        'descripcion': row[6],
        'severidad': row[7],
        'estado': row[8],
        'reportado_por': row[9],
        'asignado_a': row[10],
        'fecha_resolucion': row[11],
        'accion_correctiva': row[12],
        'created_at': row[13],
        'updated_at': row[14]
    } for row in rows]

    return {
        'ncrs': ncrs,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }


def obtener_detalle_ncr(ncr_id):
    """
    Obtener detalle de NCR con historial

    Args:
        ncr_id: ID del NCR

    Returns:
        dict con NCR e historial
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener NCR
    cursor.execute("""
        SELECT id, numero_ncr, inspeccion_id, proveedor_cuit, material_codigo,
               cantidad_afectada, descripcion, severidad, estado, reportado_por,
               asignado_a, fecha_resolucion, accion_correctiva, created_at, updated_at
        FROM ncr
        WHERE id = ?
    """, (ncr_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    ncr = {
        'id': row[0],
        'numero_ncr': row[1],
        'inspeccion_id': row[2],
        'proveedor_cuit': row[3],
        'material_codigo': row[4],
        'cantidad_afectada': row[5],
        'descripcion': row[6],
        'severidad': row[7],
        'estado': row[8],
        'reportado_por': row[9],
        'asignado_a': row[10],
        'fecha_resolucion': row[11],
        'accion_correctiva': row[12],
        'created_at': row[13],
        'updated_at': row[14]
    }

    # Obtener historial
    cursor.execute("""
        SELECT id, estado_anterior, estado_nuevo, actor_id, notas, created_at
        FROM ncr_historial
        WHERE ncr_id = ?
        ORDER BY created_at DESC
    """, (ncr_id,))

    historial = [{
        'id': row[0],
        'estado_anterior': row[1],
        'estado_nuevo': row[2],
        'actor_id': row[3],
        'notas': row[4],
        'created_at': row[5]
    } for row in cursor.fetchall()]

    conn.close()

    ncr['historial'] = historial
    return ncr


def cambiar_estado_ncr(ncr_id, nuevo_estado, user_id, notas=None):
    """
    Cambiar estado de NCR con validación FSM

    Transiciones válidas:
    - open -> under_investigation
    - under_investigation -> resolved
    - resolved -> closed

    Args:
        ncr_id: ID del NCR
        nuevo_estado: Nuevo estado
        user_id: ID del usuario
        notas: Notas adicionales

    Returns:
        dict con resultado
    """
    TRANSICIONES_VALIDAS = {
        'open': ['under_investigation'],
        'under_investigation': ['resolved', 'open'],
        'resolved': ['closed', 'under_investigation'],
        'closed': []
    }

    conn, cursor = get_db_transaction()

    try:
        # Obtener estado actual
        cursor.execute("SELECT estado FROM ncr WHERE id = ?", (ncr_id,))
        row = cursor.fetchone()

        if not row:
            conn.close()
            raise ValueError(f"NCR {ncr_id} no encontrado")

        estado_actual = row[0]

        # Validar transición
        if nuevo_estado not in TRANSICIONES_VALIDAS.get(estado_actual, []):
            conn.close()
            raise ValueError(
                f"Transición inválida: {estado_actual} -> {nuevo_estado}"
            )

        # Actualizar estado
        update_fields = ["estado = ?", "updated_at = CURRENT_TIMESTAMP"]
        params = [nuevo_estado]

        if nuevo_estado == 'resolved':
            update_fields.append("fecha_resolucion = CURRENT_TIMESTAMP")

        cursor.execute(f"""
            UPDATE ncr
            SET {', '.join(update_fields)}
            WHERE id = ?
        """, params + [ncr_id])

        # Insertar historial
        cursor.execute("""
            INSERT INTO ncr_historial
            (ncr_id, estado_anterior, estado_nuevo, actor_id, notas)
            VALUES (?, ?, ?, ?, ?)
        """, (ncr_id, estado_actual, nuevo_estado, user_id, notas))

        conn.commit()

        return {
            'ncr_id': ncr_id,
            'estado_anterior': estado_actual,
            'estado_nuevo': nuevo_estado,
            'success': True
        }

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def obtener_kpis_calidad():
    """
    Obtener KPIs de calidad

    Returns:
        dict con métricas de calidad
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Pass rate de inspecciones (últimos 30 días)
    cursor.execute("""
        SELECT
            COUNT(CASE WHEN resultado = 'pass' THEN 1 END) * 100.0 / COUNT(*) as pass_rate,
            COUNT(*) as total_inspecciones
        FROM inspeccion_entrada
        WHERE fecha >= datetime('now', '-30 days')
    """)
    row = cursor.fetchone()
    pass_rate = row[0] or 0
    total_inspecciones = row[1] or 0

    # NCRs por severidad
    cursor.execute("""
        SELECT severidad, COUNT(*) as count
        FROM ncr
        GROUP BY severidad
    """)
    ncr_por_severidad = {row[0]: row[1] for row in cursor.fetchall()}

    # NCRs abiertos
    cursor.execute("""
        SELECT COUNT(*) FROM ncr
        WHERE estado IN ('open', 'under_investigation')
    """)
    ncrs_abiertos = cursor.fetchone()[0]

    # Tiempo promedio de resolución (en días)
    cursor.execute("""
        SELECT AVG(
            CAST((julianday(fecha_resolucion) - julianday(created_at)) AS REAL)
        ) as avg_days
        FROM ncr
        WHERE estado = 'resolved' OR estado = 'closed'
    """)
    row = cursor.fetchone()
    avg_resolution_days = row[0] or 0

    conn.close()

    return {
        'pass_rate': round(pass_rate, 2),
        'total_inspecciones': total_inspecciones,
        'ncr_por_severidad': ncr_por_severidad,
        'ncrs_abiertos': ncrs_abiertos,
        'avg_resolution_days': round(avg_resolution_days, 1)
    }


def calcular_score_calidad_proveedor(proveedor_cuit, periodo_meses=12):
    """
    Calcular score de calidad de proveedor

    Fórmula: 100 - (critical*10 + major*5 + minor*1) / total_recepciones

    Args:
        proveedor_cuit: CUIT del proveedor
        periodo_meses: Periodo de análisis en meses

    Returns:
        dict con score y detalles
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Contar NCRs por severidad
    cursor.execute("""
        SELECT severidad, COUNT(*) as count
        FROM ncr
        WHERE proveedor_cuit = ?
        AND created_at >= datetime('now', ? || ' months')
        GROUP BY severidad
    """, (proveedor_cuit, f'-{periodo_meses}'))

    ncrs = {row[0]: row[1] for row in cursor.fetchall()}
    critical = ncrs.get('critical', 0)
    major = ncrs.get('major', 0)
    minor = ncrs.get('minor', 0)

    # Contar total de recepciones del proveedor
    cursor.execute("""
        SELECT COUNT(DISTINCT r.id)
        FROM recepcion r
        WHERE r.proveedor_cuit = ?
        AND r.fecha >= datetime('now', ? || ' months')
    """, (proveedor_cuit, f'-{periodo_meses}'))

    total_recepciones = cursor.fetchone()[0] or 1  # Evitar división por cero

    conn.close()

    # Calcular score
    penalizacion = (critical * 10 + major * 5 + minor * 1)
    score = max(0, 100 - (penalizacion / total_recepciones))

    return {
        'proveedor_cuit': proveedor_cuit,
        'score': round(score, 2),
        'periodo_meses': periodo_meses,
        'total_recepciones': total_recepciones,
        'ncrs': {
            'critical': critical,
            'major': major,
            'minor': minor,
            'total': critical + major + minor
        }
    }
