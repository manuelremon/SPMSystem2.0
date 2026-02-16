"""
Kanban Service
Lógica de negocio para sistema kanban y reposición pull (Sprint 85)
"""

from datetime import datetime

from backend.core.db import get_db_connection


def crear_tablero(nombre, almacen_id, centro_id, descripcion, created_by):
    """Crear nuevo tablero kanban."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO kanban_tablero (nombre, almacen_id, centro_id, descripcion, created_by)
        VALUES (?, ?, ?, ?, ?)
    """, (nombre, almacen_id, centro_id, descripcion, created_by))

    tablero_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {'id': tablero_id, 'nombre': nombre, 'estado': 'active'}


def obtener_tableros(filtros=None):
    """Obtener lista de tableros kanban."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT id, nombre, almacen_id, centro_id, descripcion, estado, created_by, created_at FROM kanban_tablero WHERE 1=1"
    params = []

    if filtros:
        if filtros.get('estado'):
            query += " AND estado = ?"
            params.append(filtros['estado'])
        if filtros.get('centro_id'):
            query += " AND centro_id = ?"
            params.append(filtros['centro_id'])
        if filtros.get('almacen_id'):
            query += " AND almacen_id = ?"
            params.append(filtros['almacen_id'])

    query += " ORDER BY created_at DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    tableros = []
    for row in rows:
        tableros.append({
            'id': row[0],
            'nombre': row[1],
            'almacen_id': row[2],
            'centro_id': row[3],
            'descripcion': row[4],
            'estado': row[5],
            'created_by': row[6],
            'created_at': row[7]
        })

    conn.close()
    return tableros


def obtener_detalle_tablero(tablero_id):
    """Obtener tablero con sus tarjetas y señales pendientes."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener tablero
    cursor.execute("""
        SELECT id, nombre, almacen_id, centro_id, descripcion, estado, created_by, created_at
        FROM kanban_tablero
        WHERE id = ?
    """, (tablero_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    tablero = {
        'id': row[0],
        'nombre': row[1],
        'almacen_id': row[2],
        'centro_id': row[3],
        'descripcion': row[4],
        'estado': row[5],
        'created_by': row[6],
        'created_at': row[7]
    }

    # Obtener tarjetas del tablero
    cursor.execute("""
        SELECT id, tablero_id, material_codigo, tipo, estado, cantidad_contenedor,
               punto_reorden, lead_time_horas, ubicacion_supermarket, proveedor_cuit,
               ciclos_totales, ultimo_ciclo_at, created_at
        FROM kanban_tarjeta
        WHERE tablero_id = ?
        ORDER BY estado DESC, material_codigo
    """, (tablero_id,))

    tarjetas = []
    for trow in cursor.fetchall():
        tarjetas.append({
            'id': trow[0],
            'tablero_id': trow[1],
            'material_codigo': trow[2],
            'tipo': trow[3],
            'estado': trow[4],
            'cantidad_contenedor': trow[5],
            'punto_reorden': trow[6],
            'lead_time_horas': trow[7],
            'ubicacion_supermarket': trow[8],
            'proveedor_cuit': trow[9],
            'ciclos_totales': trow[10],
            'ultimo_ciclo_at': trow[11],
            'created_at': trow[12]
        })

    tablero['tarjetas'] = tarjetas

    # Obtener señales pendientes del tablero
    cursor.execute("""
        SELECT s.id, s.tarjeta_id, s.tipo, s.estado, s.cantidad_solicitada,
               s.cantidad_entregada, s.fecha_generacion, s.fecha_completado,
               s.orden_asociada_id, t.material_codigo
        FROM kanban_senal s
        JOIN kanban_tarjeta t ON s.tarjeta_id = t.id
        WHERE t.tablero_id = ? AND s.estado IN ('generada', 'en_proceso')
        ORDER BY s.fecha_generacion
    """, (tablero_id,))

    senales = []
    for srow in cursor.fetchall():
        senales.append({
            'id': srow[0],
            'tarjeta_id': srow[1],
            'tipo': srow[2],
            'estado': srow[3],
            'cantidad_solicitada': srow[4],
            'cantidad_entregada': srow[5],
            'fecha_generacion': srow[6],
            'fecha_completado': srow[7],
            'orden_asociada_id': srow[8],
            'material_codigo': srow[9]
        })

    tablero['senales_pendientes'] = senales

    conn.close()
    return tablero


def crear_tarjeta(tablero_id, material_codigo, tipo, cantidad_contenedor,
                  punto_reorden, lead_time_horas, ubicacion_supermarket=None,
                  proveedor_cuit=None):
    """Crear nueva tarjeta kanban."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO kanban_tarjeta
        (tablero_id, material_codigo, tipo, cantidad_contenedor, punto_reorden,
         lead_time_horas, ubicacion_supermarket, proveedor_cuit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (tablero_id, material_codigo, tipo, cantidad_contenedor, punto_reorden,
          lead_time_horas, ubicacion_supermarket, proveedor_cuit))

    tarjeta_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        'id': tarjeta_id,
        'tablero_id': tablero_id,
        'material_codigo': material_codigo,
        'tipo': tipo,
        'estado': 'full',
        'cantidad_contenedor': cantidad_contenedor,
        'punto_reorden': punto_reorden,
        'lead_time_horas': lead_time_horas,
        'ubicacion_supermarket': ubicacion_supermarket,
        'proveedor_cuit': proveedor_cuit,
        'ciclos_totales': 0
    }


def actualizar_tarjeta(tarjeta_id, datos):
    """Actualizar configuración de tarjeta kanban."""
    conn = get_db_connection()
    cursor = conn.cursor()

    updates = []
    params = []

    if 'cantidad_contenedor' in datos:
        updates.append("cantidad_contenedor = ?")
        params.append(datos['cantidad_contenedor'])

    if 'punto_reorden' in datos:
        updates.append("punto_reorden = ?")
        params.append(datos['punto_reorden'])

    if 'lead_time_horas' in datos:
        updates.append("lead_time_horas = ?")
        params.append(datos['lead_time_horas'])

    if 'ubicacion_supermarket' in datos:
        updates.append("ubicacion_supermarket = ?")
        params.append(datos['ubicacion_supermarket'])

    if 'proveedor_cuit' in datos:
        updates.append("proveedor_cuit = ?")
        params.append(datos['proveedor_cuit'])

    if not updates:
        conn.close()
        return {'success': False, 'error': 'No hay datos para actualizar'}

    params.append(tarjeta_id)
    query = f"UPDATE kanban_tarjeta SET {', '.join(updates)} WHERE id = ?"

    cursor.execute(query, params)
    conn.commit()
    conn.close()

    return {'success': True}


def vaciar_tarjeta(tarjeta_id, actor_id, notas=None):
    """Vaciar tarjeta (consumo) y generar señal automática si es necesario."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener tarjeta actual
    cursor.execute("""
        SELECT estado, cantidad_contenedor, tipo, material_codigo, punto_reorden
        FROM kanban_tarjeta
        WHERE id = ?
    """, (tarjeta_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return {'success': False, 'error': 'Tarjeta no encontrada'}

    estado_anterior = row[0]
    cantidad_contenedor = row[1]
    tipo = row[2]
    _material_codigo = row[3]  # noqa: F841
    _punto_reorden = row[4]  # noqa: F841

    if estado_anterior == 'empty':
        conn.close()
        return {'success': False, 'error': 'La tarjeta ya está vacía'}

    # Actualizar estado a empty
    cursor.execute("""
        UPDATE kanban_tarjeta
        SET estado = 'empty'
        WHERE id = ?
    """, (tarjeta_id,))

    # Registrar en historial
    cursor.execute("""
        INSERT INTO kanban_historial (tarjeta_id, estado_anterior, estado_nuevo, actor_id, notas)
        VALUES (?, ?, 'empty', ?, ?)
    """, (tarjeta_id, estado_anterior, actor_id, notas))

    conn.commit()

    # Generar señal automática de reposición
    tipo_senal = 'compra' if tipo == 'proveedor' else 'reposicion'

    cursor.execute("""
        INSERT INTO kanban_senal (tarjeta_id, tipo, cantidad_solicitada)
        VALUES (?, ?, ?)
    """, (tarjeta_id, tipo_senal, cantidad_contenedor))

    senal_id = cursor.lastrowid

    # Registrar señal en historial
    cursor.execute("""
        INSERT INTO kanban_historial (tarjeta_id, estado_anterior, estado_nuevo, senal_id, actor_id, notas)
        VALUES (?, 'empty', 'empty', ?, ?, 'Señal generada automáticamente')
    """, (tarjeta_id, senal_id, actor_id))

    conn.commit()
    conn.close()

    return {
        'success': True,
        'tarjeta_id': tarjeta_id,
        'estado_nuevo': 'empty',
        'senal_generada': {
            'id': senal_id,
            'tipo': tipo_senal,
            'cantidad': cantidad_contenedor
        }
    }


def llenar_tarjeta(tarjeta_id, actor_id, senal_id=None, notas=None):
    """Llenar tarjeta (reposición completada)."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener tarjeta actual
    cursor.execute("""
        SELECT estado, ciclos_totales
        FROM kanban_tarjeta
        WHERE id = ?
    """, (tarjeta_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return {'success': False, 'error': 'Tarjeta no encontrada'}

    estado_anterior = row[0]
    ciclos_totales = row[1]

    if estado_anterior == 'full':
        conn.close()
        return {'success': False, 'error': 'La tarjeta ya está llena'}

    # Actualizar estado a full e incrementar ciclos
    now = datetime.now().isoformat()
    cursor.execute("""
        UPDATE kanban_tarjeta
        SET estado = 'full', ciclos_totales = ?, ultimo_ciclo_at = ?
        WHERE id = ?
    """, (ciclos_totales + 1, now, tarjeta_id))

    # Registrar en historial
    cursor.execute("""
        INSERT INTO kanban_historial (tarjeta_id, estado_anterior, estado_nuevo, senal_id, actor_id, notas)
        VALUES (?, ?, 'full', ?, ?, ?)
    """, (tarjeta_id, estado_anterior, senal_id, actor_id, notas))

    # Si hay señal asociada, marcarla como completada
    if senal_id:
        cursor.execute("""
            UPDATE kanban_senal
            SET estado = 'completada', fecha_completado = ?, ejecutado_por = ?
            WHERE id = ?
        """, (now, actor_id, senal_id))

    conn.commit()
    conn.close()

    return {
        'success': True,
        'tarjeta_id': tarjeta_id,
        'estado_nuevo': 'full',
        'ciclos_totales': ciclos_totales + 1
    }


def generar_senal(tarjeta_id, tipo, cantidad_solicitada, orden_asociada_id=None):
    """Generar señal manual de reposición/producción/compra."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verificar que la tarjeta existe
    cursor.execute("SELECT id FROM kanban_tarjeta WHERE id = ?", (tarjeta_id,))
    if not cursor.fetchone():
        conn.close()
        return {'success': False, 'error': 'Tarjeta no encontrada'}

    cursor.execute("""
        INSERT INTO kanban_senal (tarjeta_id, tipo, cantidad_solicitada, orden_asociada_id)
        VALUES (?, ?, ?, ?)
    """, (tarjeta_id, tipo, cantidad_solicitada, orden_asociada_id))

    senal_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        'success': True,
        'senal_id': senal_id,
        'tipo': tipo,
        'cantidad_solicitada': cantidad_solicitada
    }


def completar_senal(senal_id, cantidad_entregada, ejecutado_por, orden_asociada_id=None):
    """Completar señal de reposición."""
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.now().isoformat()

    cursor.execute("""
        UPDATE kanban_senal
        SET estado = 'completada',
            cantidad_entregada = ?,
            fecha_completado = ?,
            ejecutado_por = ?,
            orden_asociada_id = COALESCE(?, orden_asociada_id)
        WHERE id = ?
    """, (cantidad_entregada, now, ejecutado_por, orden_asociada_id, senal_id))

    if cursor.rowcount == 0:
        conn.close()
        return {'success': False, 'error': 'Señal no encontrada'}

    conn.commit()
    conn.close()

    return {
        'success': True,
        'senal_id': senal_id,
        'estado': 'completada',
        'fecha_completado': now
    }


def obtener_senales_pendientes(filtros=None):
    """Obtener señales pendientes de reposición."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT s.id, s.tarjeta_id, s.tipo, s.estado, s.cantidad_solicitada,
               s.cantidad_entregada, s.fecha_generacion, s.fecha_completado,
               s.orden_asociada_id, t.material_codigo, t.tipo as tarjeta_tipo,
               t.proveedor_cuit, tb.nombre as tablero_nombre
        FROM kanban_senal s
        JOIN kanban_tarjeta t ON s.tarjeta_id = t.id
        JOIN kanban_tablero tb ON t.tablero_id = tb.id
        WHERE 1=1
    """
    params = []

    if filtros:
        if filtros.get('estado'):
            query += " AND s.estado = ?"
            params.append(filtros['estado'])
        else:
            query += " AND s.estado IN ('generada', 'en_proceso')"

        if filtros.get('tipo'):
            query += " AND s.tipo = ?"
            params.append(filtros['tipo'])

        if filtros.get('tablero_id'):
            query += " AND t.tablero_id = ?"
            params.append(filtros['tablero_id'])
    else:
        query += " AND s.estado IN ('generada', 'en_proceso')"

    query += " ORDER BY s.fecha_generacion"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    senales = []
    for row in rows:
        senales.append({
            'id': row[0],
            'tarjeta_id': row[1],
            'tipo': row[2],
            'estado': row[3],
            'cantidad_solicitada': row[4],
            'cantidad_entregada': row[5],
            'fecha_generacion': row[6],
            'fecha_completado': row[7],
            'orden_asociada_id': row[8],
            'material_codigo': row[9],
            'tarjeta_tipo': row[10],
            'proveedor_cuit': row[11],
            'tablero_nombre': row[12]
        })

    conn.close()
    return senales


def evaluar_reposicion_automatica():
    """
    Evaluar tarjetas que requieren reposición automática.
    Busca tarjetas vacías que han superado su lead time sin señal pendiente.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Calcular tiempo límite (ahora - lead_time_horas)
    now = datetime.now()

    # Encontrar tarjetas vacías sin señales pendientes
    cursor.execute("""
        SELECT t.id, t.material_codigo, t.cantidad_contenedor, t.tipo,
               t.lead_time_horas, t.ultimo_ciclo_at
        FROM kanban_tarjeta t
        WHERE t.estado = 'empty'
          AND t.lead_time_horas IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM kanban_senal s
              WHERE s.tarjeta_id = t.id
                AND s.estado IN ('generada', 'en_proceso')
          )
    """)

    tarjetas = cursor.fetchall()
    senales_generadas = []

    for row in tarjetas:
        tarjeta_id = row[0]
        material_codigo = row[1]
        cantidad = row[2]
        tipo = row[3]
        lead_time_horas = row[4]
        ultimo_ciclo_at = row[5]

        # Si no hay último ciclo, omitir
        if not ultimo_ciclo_at:
            continue

        # Parsear fecha de último ciclo
        try:
            ultimo_ciclo = datetime.fromisoformat(ultimo_ciclo_at)
        except Exception:
            continue

        # Verificar si ha pasado el lead time
        tiempo_transcurrido = (now - ultimo_ciclo).total_seconds() / 3600  # horas

        if tiempo_transcurrido >= lead_time_horas:
            # Generar señal automática
            tipo_senal = 'compra' if tipo == 'proveedor' else 'reposicion'

            cursor.execute("""
                INSERT INTO kanban_senal (tarjeta_id, tipo, cantidad_solicitada)
                VALUES (?, ?, ?)
            """, (tarjeta_id, tipo_senal, cantidad))

            senal_id = cursor.lastrowid
            senales_generadas.append({
                'senal_id': senal_id,
                'tarjeta_id': tarjeta_id,
                'material_codigo': material_codigo,
                'tipo': tipo_senal,
                'cantidad': cantidad,
                'lead_time_excedido_horas': round(tiempo_transcurrido, 2)
            })

    conn.commit()
    conn.close()

    return {
        'evaluadas': len(tarjetas),
        'senales_generadas': len(senales_generadas),
        'detalle': senales_generadas
    }


def obtener_kpis():
    """Obtener KPIs del sistema kanban."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Tarjetas vacías
    cursor.execute("SELECT COUNT(*) FROM kanban_tarjeta WHERE estado = 'empty'")
    tarjetas_vacias = cursor.fetchone()[0]

    # Tarjetas en tránsito
    cursor.execute("SELECT COUNT(*) FROM kanban_tarjeta WHERE estado = 'in_transit'")
    tarjetas_transito = cursor.fetchone()[0]

    # Tarjetas llenas
    cursor.execute("SELECT COUNT(*) FROM kanban_tarjeta WHERE estado = 'full'")
    tarjetas_llenas = cursor.fetchone()[0]

    # Señales pendientes
    cursor.execute("SELECT COUNT(*) FROM kanban_senal WHERE estado IN ('generada', 'en_proceso')")
    senales_pendientes = cursor.fetchone()[0]

    # Señales completadas hoy
    today = datetime.now().date().isoformat()
    cursor.execute("""
        SELECT COUNT(*) FROM kanban_senal
        WHERE estado = 'completada' AND DATE(fecha_completado) = ?
    """, (today,))
    senales_hoy = cursor.fetchone()[0]

    # Promedio de ciclos por tarjeta
    cursor.execute("SELECT AVG(ciclos_totales) FROM kanban_tarjeta WHERE ciclos_totales > 0")
    avg_ciclos = cursor.fetchone()[0] or 0

    # Promedio de lead time
    cursor.execute("SELECT AVG(lead_time_horas) FROM kanban_tarjeta WHERE lead_time_horas IS NOT NULL")
    avg_lead_time = cursor.fetchone()[0] or 0

    # Total de tableros activos
    cursor.execute("SELECT COUNT(*) FROM kanban_tablero WHERE estado = 'active'")
    tableros_activos = cursor.fetchone()[0]

    conn.close()

    return {
        'tarjetas_vacias': tarjetas_vacias,
        'tarjetas_transito': tarjetas_transito,
        'tarjetas_llenas': tarjetas_llenas,
        'total_tarjetas': tarjetas_vacias + tarjetas_transito + tarjetas_llenas,
        'senales_pendientes': senales_pendientes,
        'senales_completadas_hoy': senales_hoy,
        'promedio_ciclos': round(avg_ciclos, 2),
        'promedio_lead_time_horas': round(avg_lead_time, 2),
        'tableros_activos': tableros_activos
    }
