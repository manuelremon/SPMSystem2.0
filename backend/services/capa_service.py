"""
CAPA Service
Gestión de Acciones Correctivas y Preventivas (Corrective and Preventive Actions)
"""

from datetime import datetime

from backend.core.db import get_db_connection, get_db_transaction


def crear_capa_desde_ncr(ncr_id, data, user_id):
    """
    Crear CAPA vinculado a un NCR

    Args:
        ncr_id: ID del NCR
        data: dict con tipo, titulo, descripcion_problema, accion_propuesta,
              responsable_id, verificador_id, fecha_objetivo
        user_id: ID del usuario creador

    Returns:
        dict con CAPA creado
    """
    with get_db_transaction() as (conn, cursor):
        try:
            # Verificar que el NCR existe
            cursor.execute("SELECT id FROM ncr WHERE id = %s", (ncr_id,))
            if not cursor.fetchone():
                raise ValueError(f"NCR {ncr_id} no encontrado")

            # Generar número de CAPA único: CAPA-YYYYMMDD-XXX
            fecha_hoy = datetime.now().strftime('%Y%m%d')
            cursor.execute("""
                SELECT COUNT(*) FROM capa
                WHERE numero_capa LIKE %s
            """, (f"CAPA-{fecha_hoy}-%",))

            count = cursor.fetchone()[0]
            numero_capa = f"CAPA-{fecha_hoy}-{count + 1:03d}"

            # Insertar CAPA
            cursor.execute("""
                INSERT INTO capa
                (numero_capa, ncr_id, tipo, titulo, descripcion_problema,
                 accion_propuesta, responsable_id, verificador_id, fecha_objetivo, estado)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
                RETURNING id
            """, (
                numero_capa,
                ncr_id,
                data.get('tipo', 'corrective'),
                data['titulo'],
                data.get('descripcion_problema'),
                data.get('accion_propuesta'),
                data.get('responsable_id'),
                data.get('verificador_id'),
                data.get('fecha_objetivo')
            ))

            capa_id = cursor.fetchone()[0]

            # Insertar historial
            cursor.execute("""
                INSERT INTO capa_historial
                (capa_id, estado_anterior, estado_nuevo, actor_id, notas)
                VALUES (%s, NULL, 'pending', %s, 'CAPA creado desde NCR')
            """, (capa_id, user_id))

            conn.commit()

            # Recuperar CAPA creado
            cursor.execute("""
                SELECT id, numero_capa, ncr_id, tipo, titulo, descripcion_problema,
                       accion_propuesta, accion_implementada, responsable_id, verificador_id,
                       fecha_objetivo, fecha_implementacion, fecha_verificacion,
                       estado, efectividad, created_at, updated_at
                FROM capa
                WHERE id = %s
            """, (capa_id,))

            row = cursor.fetchone()

            return {
                'id': row[0],
                'numero_capa': row[1],
                'ncr_id': row[2],
                'tipo': row[3],
                'titulo': row[4],
                'descripcion_problema': row[5],
                'accion_propuesta': row[6],
                'accion_implementada': row[7],
                'responsable_id': row[8],
                'verificador_id': row[9],
                'fecha_objetivo': row[10],
                'fecha_implementacion': row[11],
                'fecha_verificacion': row[12],
                'estado': row[13],
                'efectividad': row[14],
                'created_at': row[15],
                'updated_at': row[16]
            }

        except Exception:
            conn.rollback()
            raise


def crear_capa_preventiva(data, user_id):
    """
    Crear CAPA preventiva (sin vinculación a NCR)

    Args:
        data: dict con tipo, titulo, descripcion_problema, accion_propuesta,
              responsable_id, verificador_id, fecha_objetivo
        user_id: ID del usuario creador

    Returns:
        dict con CAPA creado
    """
    with get_db_transaction() as (conn, cursor):
        try:
            # Generar número de CAPA único: CAPA-YYYYMMDD-XXX
            fecha_hoy = datetime.now().strftime('%Y%m%d')
            cursor.execute("""
                SELECT COUNT(*) FROM capa
                WHERE numero_capa LIKE %s
            """, (f"CAPA-{fecha_hoy}-%",))

            count = cursor.fetchone()[0]
            numero_capa = f"CAPA-{fecha_hoy}-{count + 1:03d}"

            # Insertar CAPA
            cursor.execute("""
                INSERT INTO capa
                (numero_capa, tipo, titulo, descripcion_problema,
                 accion_propuesta, responsable_id, verificador_id, fecha_objetivo, estado)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending')
                RETURNING id
            """, (
                numero_capa,
                data.get('tipo', 'preventive'),
                data['titulo'],
                data.get('descripcion_problema'),
                data.get('accion_propuesta'),
                data.get('responsable_id'),
                data.get('verificador_id'),
                data.get('fecha_objetivo')
            ))

            capa_id = cursor.fetchone()[0]

            # Insertar historial
            cursor.execute("""
                INSERT INTO capa_historial
                (capa_id, estado_anterior, estado_nuevo, actor_id, notas)
                VALUES (%s, NULL, 'pending', %s, 'CAPA preventivo creado')
            """, (capa_id, user_id))

            conn.commit()

            # Recuperar CAPA creado
            cursor.execute("""
                SELECT id, numero_capa, ncr_id, tipo, titulo, descripcion_problema,
                       accion_propuesta, accion_implementada, responsable_id, verificador_id,
                       fecha_objetivo, fecha_implementacion, fecha_verificacion,
                       estado, efectividad, created_at, updated_at
                FROM capa
                WHERE id = %s
            """, (capa_id,))

            row = cursor.fetchone()

            return {
                'id': row[0],
                'numero_capa': row[1],
                'ncr_id': row[2],
                'tipo': row[3],
                'titulo': row[4],
                'descripcion_problema': row[5],
                'accion_propuesta': row[6],
                'accion_implementada': row[7],
                'responsable_id': row[8],
                'verificador_id': row[9],
                'fecha_objetivo': row[10],
                'fecha_implementacion': row[11],
                'fecha_verificacion': row[12],
                'estado': row[13],
                'efectividad': row[14],
                'created_at': row[15],
                'updated_at': row[16]
            }

        except Exception:
            conn.rollback()
            raise


def obtener_capas(filtros=None):
    """
    Obtener lista paginada de CAPAs

    Args:
        filtros: dict con tipo, estado, responsable, page, per_page

    Returns:
        dict con CAPAs y paginación
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

    if filtros.get('tipo'):
        where_clauses.append("tipo = %s")
        params.append(filtros['tipo'])

    if filtros.get('estado'):
        where_clauses.append("estado = %s")
        params.append(filtros['estado'])

    if filtros.get('responsable'):
        where_clauses.append("responsable_id = %s")
        params.append(filtros['responsable'])

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    # Contar total
    cursor.execute(f"""
        SELECT COUNT(*) FROM capa
        WHERE {where_sql}
    """, params)
    total = cursor.fetchone()[0]

    # Obtener CAPAs paginados
    cursor.execute(f"""
        SELECT id, numero_capa, ncr_id, tipo, titulo, descripcion_problema,
               accion_propuesta, accion_implementada, responsable_id, verificador_id,
               fecha_objetivo, fecha_implementacion, fecha_verificacion,
               estado, efectividad, created_at, updated_at
        FROM capa
        WHERE {where_sql}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
    """, params + [per_page, offset])

    rows = cursor.fetchall()
    conn.close()

    capas = [{
        'id': row[0],
        'numero_capa': row[1],
        'ncr_id': row[2],
        'tipo': row[3],
        'titulo': row[4],
        'descripcion_problema': row[5],
        'accion_propuesta': row[6],
        'accion_implementada': row[7],
        'responsable_id': row[8],
        'verificador_id': row[9],
        'fecha_objetivo': row[10],
        'fecha_implementacion': row[11],
        'fecha_verificacion': row[12],
        'estado': row[13],
        'efectividad': row[14],
        'created_at': row[15],
        'updated_at': row[16]
    } for row in rows]

    return {
        'capas': capas,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }


def obtener_detalle_capa(capa_id):
    """
    Obtener detalle de CAPA con historial

    Args:
        capa_id: ID del CAPA

    Returns:
        dict con CAPA e historial
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener CAPA
    cursor.execute("""
        SELECT id, numero_capa, ncr_id, tipo, titulo, descripcion_problema,
               accion_propuesta, accion_implementada, responsable_id, verificador_id,
               fecha_objetivo, fecha_implementacion, fecha_verificacion,
               estado, efectividad, created_at, updated_at
        FROM capa
        WHERE id = %s
    """, (capa_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    capa = {
        'id': row[0],
        'numero_capa': row[1],
        'ncr_id': row[2],
        'tipo': row[3],
        'titulo': row[4],
        'descripcion_problema': row[5],
        'accion_propuesta': row[6],
        'accion_implementada': row[7],
        'responsable_id': row[8],
        'verificador_id': row[9],
        'fecha_objetivo': row[10],
        'fecha_implementacion': row[11],
        'fecha_verificacion': row[12],
        'estado': row[13],
        'efectividad': row[14],
        'created_at': row[15],
        'updated_at': row[16]
    }

    # Obtener historial
    cursor.execute("""
        SELECT id, estado_anterior, estado_nuevo, actor_id, notas, created_at
        FROM capa_historial
        WHERE capa_id = %s
        ORDER BY created_at DESC
    """, (capa_id,))

    historial = [{
        'id': row[0],
        'estado_anterior': row[1],
        'estado_nuevo': row[2],
        'actor_id': row[3],
        'notas': row[4],
        'created_at': row[5]
    } for row in cursor.fetchall()]

    conn.close()

    capa['historial'] = historial
    return capa


def cambiar_estado_capa(capa_id, nuevo_estado, user_id, notas=None):
    """
    Cambiar estado de CAPA con validación FSM

    Transiciones válidas:
    - pending -> in_progress
    - in_progress -> implemented
    - implemented -> verified
    - verified -> closed

    Args:
        capa_id: ID del CAPA
        nuevo_estado: Nuevo estado
        user_id: ID del usuario
        notas: Notas adicionales

    Returns:
        dict con resultado
    """
    TRANSICIONES_VALIDAS = {
        'pending': ['in_progress'],
        'in_progress': ['implemented', 'pending'],
        'implemented': ['verified', 'in_progress'],
        'verified': ['closed', 'implemented'],
        'closed': []
    }

    with get_db_transaction() as (conn, cursor):
        try:
            # Obtener estado actual
            cursor.execute("SELECT estado FROM capa WHERE id = %s", (capa_id,))
            row = cursor.fetchone()

            if not row:
                raise ValueError(f"CAPA {capa_id} no encontrado")

            estado_actual = row[0]

            # Validar transición
            if nuevo_estado not in TRANSICIONES_VALIDAS.get(estado_actual, []):
                raise ValueError(
                    f"Transición inválida: {estado_actual} -> {nuevo_estado}"
                )

            # Actualizar estado
            update_fields = ["estado = %s", "updated_at = CURRENT_TIMESTAMP"]
            params = [nuevo_estado]

            # Actualizar fechas según estado
            if nuevo_estado == 'implemented':
                update_fields.append("fecha_implementacion = CURRENT_TIMESTAMP")
            elif nuevo_estado == 'verified':
                update_fields.append("fecha_verificacion = CURRENT_TIMESTAMP")

            cursor.execute(f"""
                UPDATE capa
                SET {', '.join(update_fields)}
                WHERE id = %s
            """, params + [capa_id])

            # Insertar historial
            cursor.execute("""
                INSERT INTO capa_historial
                (capa_id, estado_anterior, estado_nuevo, actor_id, notas)
                VALUES (%s, %s, %s, %s, %s)
            """, (capa_id, estado_actual, nuevo_estado, user_id, notas))

            conn.commit()

            return {
                'capa_id': capa_id,
                'estado_anterior': estado_actual,
                'estado_nuevo': nuevo_estado,
                'success': True
            }

        except Exception:
            conn.rollback()
            raise


def verificar_efectividad(capa_id, efectividad, user_id):
    """
    Verificar efectividad de CAPA implementado

    Args:
        capa_id: ID del CAPA
        efectividad: Texto describiendo la efectividad
        user_id: ID del verificador

    Returns:
        dict con resultado
    """
    with get_db_transaction() as (conn, cursor):
        try:
            # Obtener estado actual
            cursor.execute("SELECT estado FROM capa WHERE id = %s", (capa_id,))
            row = cursor.fetchone()

            if not row:
                raise ValueError(f"CAPA {capa_id} no encontrado")

            estado_actual = row[0]

            if estado_actual != 'implemented':
                raise ValueError(
                    f"CAPA debe estar en estado 'implemented' para verificar efectividad. "
                    f"Estado actual: {estado_actual}"
                )

            # Actualizar efectividad y cambiar a verified
            cursor.execute("""
                UPDATE capa
                SET efectividad = %s,
                    estado = 'verified',
                    fecha_verificacion = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (efectividad, capa_id))

            # Insertar historial
            cursor.execute("""
                INSERT INTO capa_historial
                (capa_id, estado_anterior, estado_nuevo, actor_id, notas)
                VALUES (%s, %s, %s, %s, %s)
            """, (capa_id, estado_actual, 'verified', user_id, f"Efectividad verificada: {efectividad}"))

            conn.commit()

            return {
                'capa_id': capa_id,
                'estado_anterior': estado_actual,
                'estado_nuevo': 'verified',
                'efectividad': efectividad,
                'success': True
            }

        except Exception:
            conn.rollback()
            raise
