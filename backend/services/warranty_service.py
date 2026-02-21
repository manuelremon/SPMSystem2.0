"""
Servicio para gestión de garantías y reclamos
Fecha: 2026-02-15
"""
from datetime import datetime, timedelta

from backend.core.db import get_db_connection


def crear_garantia(material_codigo, proveedor_cuit, tipo, duracion_meses, fecha_inicio,
                   condiciones=None, lote_id=None, orden_compra_id=None):
    """Crea una nueva garantía para un material/proveedor"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Calcular fecha fin
    fecha_inicio_dt = datetime.fromisoformat(fecha_inicio.replace('Z', '+00:00')) if isinstance(fecha_inicio, str) else fecha_inicio
    fecha_fin = fecha_inicio_dt + timedelta(days=30 * duracion_meses)

    cursor.execute("""
        INSERT INTO garantia (
            material_codigo, proveedor_cuit, lote_id, orden_compra_id,
            tipo, duracion_meses, fecha_inicio, fecha_fin, condiciones, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    """, (material_codigo, proveedor_cuit, lote_id, orden_compra_id,
          tipo, duracion_meses, fecha_inicio, fecha_fin.isoformat(), condiciones))

    garantia_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return garantia_id


def obtener_garantias(page=1, per_page=50, material_codigo=None, proveedor_cuit=None, estado=None):
    """Obtiene garantías con filtros y paginación"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Construir query con filtros
    where_clauses = []
    params = []

    if material_codigo:
        where_clauses.append("g.material_codigo = ?")
        params.append(material_codigo)
    if proveedor_cuit:
        where_clauses.append("g.proveedor_cuit = ?")
        params.append(proveedor_cuit)
    if estado:
        where_clauses.append("g.estado = ?")
        params.append(estado)

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    # Contar total
    cursor.execute(f"SELECT COUNT(*) FROM garantia g {where_sql}", params)
    total = cursor.fetchone()[0]

    # Query paginada con joins
    offset = (page - 1) * per_page
    query = f"""
        SELECT
            g.*,
            m.descripcion as material_desc,
            p.razon_social as proveedor_nombre,
            COUNT(DISTINCT r.id) as reclamos_count
        FROM garantia g
        LEFT JOIN materiales_bbdd m ON g.material_codigo = m.codigo_material
        LEFT JOIN proveedores p ON g.proveedor_cuit = p.id_proveedor
        LEFT JOIN reclamo_garantia r ON r.garantia_id = g.id
        {where_sql}
        GROUP BY g.id
        ORDER BY g.created_at DESC
        LIMIT ? OFFSET ?
    """

    params.extend([per_page, offset])
    cursor.execute(query, params)

    garantias = []
    for row in cursor.fetchall():
        garantias.append({
            'id': row[0],
            'material_codigo': row[1],
            'proveedor_cuit': row[2],
            'lote_id': row[3],
            'orden_compra_id': row[4],
            'tipo': row[5],
            'duracion_meses': row[6],
            'fecha_inicio': row[7],
            'fecha_fin': row[8],
            'condiciones': row[9],
            'estado': row[10],
            'created_at': row[11],
            'material_desc': row[12],
            'proveedor_nombre': row[13],
            'reclamos_count': row[14]
        })

    conn.close()

    return {
        'garantias': garantias,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }


def crear_reclamo(garantia_id, tipo, descripcion, cantidad_afectada=None,
                  costo_estimado=None, responsable_id=None):
    """Crea un nuevo reclamo de garantía"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Generar número de reclamo RCL-W-YYYY-NNNN
    año = datetime.now().year
    cursor.execute("""
        SELECT COUNT(*) FROM reclamo_garantia
        WHERE numero_reclamo LIKE ?
    """, (f'RCL-W-{año}-%',))
    count = cursor.fetchone()[0]
    numero_reclamo = f'RCL-W-{año}-{count + 1:04d}'

    cursor.execute("""
        INSERT INTO reclamo_garantia (
            numero_reclamo, garantia_id, tipo, descripcion,
            cantidad_afectada, costo_estimado, responsable_id, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')
    """, (numero_reclamo, garantia_id, tipo, descripcion,
          cantidad_afectada, costo_estimado, responsable_id))

    reclamo_id = cursor.lastrowid

    # Registrar en historial
    cursor.execute("""
        INSERT INTO reclamo_historial (
            reclamo_id, estado_anterior, estado_nuevo, actor_id, notas
        ) VALUES (?, NULL, 'draft', ?, 'Reclamo creado')
    """, (reclamo_id, responsable_id))

    conn.commit()
    conn.close()

    return {
        'id': reclamo_id,
        'numero_reclamo': numero_reclamo
    }


def obtener_reclamos(page=1, per_page=50, estado=None, tipo=None, garantia_id=None):
    """Obtiene reclamos con filtros y paginación"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Construir query con filtros
    where_clauses = []
    params = []

    if estado:
        where_clauses.append("r.estado = ?")
        params.append(estado)
    if tipo:
        where_clauses.append("r.tipo = ?")
        params.append(tipo)
    if garantia_id:
        where_clauses.append("r.garantia_id = ?")
        params.append(garantia_id)

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    # Contar total
    cursor.execute(f"SELECT COUNT(*) FROM reclamo_garantia r {where_sql}", params)
    total = cursor.fetchone()[0]

    # Query paginada con joins
    offset = (page - 1) * per_page
    query = f"""
        SELECT
            r.*,
            g.material_codigo,
            g.proveedor_cuit,
            m.descripcion as material_desc,
            p.razon_social as proveedor_nombre,
            u.nombre as responsable_nombre,
            COUNT(DISTINCT d.id) as documentos_count
        FROM reclamo_garantia r
        LEFT JOIN garantia g ON r.garantia_id = g.id
        LEFT JOIN materiales_bbdd m ON g.material_codigo = m.codigo_material
        LEFT JOIN proveedores p ON g.proveedor_cuit = p.id_proveedor
        LEFT JOIN usuarios u ON r.responsable_id = u.id_spm
        LEFT JOIN reclamo_documento d ON d.reclamo_id = r.id
        {where_sql}
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    """

    params.extend([per_page, offset])
    cursor.execute(query, params)

    reclamos = []
    for row in cursor.fetchall():
        reclamos.append({
            'id': row[0],
            'numero_reclamo': row[1],
            'garantia_id': row[2],
            'tipo': row[3],
            'descripcion': row[4],
            'cantidad_afectada': row[5],
            'costo_estimado': row[6],
            'estado': row[7],
            'resolucion': row[8],
            'monto_recuperado': row[9],
            'responsable_id': row[10],
            'fecha_resolucion': row[11],
            'created_at': row[12],
            'material_codigo': row[13],
            'proveedor_cuit': row[14],
            'material_desc': row[15],
            'proveedor_nombre': row[16],
            'responsable_nombre': row[17],
            'documentos_count': row[18]
        })

    conn.close()

    return {
        'reclamos': reclamos,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    }


def obtener_detalle_reclamo(reclamo_id):
    """Obtiene el detalle completo de un reclamo"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Datos principales
    cursor.execute("""
        SELECT
            r.*,
            g.material_codigo,
            g.proveedor_cuit,
            g.tipo as garantia_tipo,
            g.duracion_meses,
            g.fecha_inicio,
            g.fecha_fin,
            m.descripcion as material_desc,
            p.razon_social as proveedor_nombre,
            u.nombre as responsable_nombre
        FROM reclamo_garantia r
        LEFT JOIN garantia g ON r.garantia_id = g.id
        LEFT JOIN materiales_bbdd m ON g.material_codigo = m.codigo_material
        LEFT JOIN proveedores p ON g.proveedor_cuit = p.id_proveedor
        LEFT JOIN usuarios u ON r.responsable_id = u.id_spm
        WHERE r.id = ?
    """, (reclamo_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    reclamo = {
        'id': row[0],
        'numero_reclamo': row[1],
        'garantia_id': row[2],
        'tipo': row[3],
        'descripcion': row[4],
        'cantidad_afectada': row[5],
        'costo_estimado': row[6],
        'estado': row[7],
        'resolucion': row[8],
        'monto_recuperado': row[9],
        'responsable_id': row[10],
        'fecha_resolucion': row[11],
        'created_at': row[12],
        'garantia': {
            'material_codigo': row[13],
            'proveedor_cuit': row[14],
            'tipo': row[15],
            'duracion_meses': row[16],
            'fecha_inicio': row[17],
            'fecha_fin': row[18],
            'material_desc': row[19],
            'proveedor_nombre': row[20]
        },
        'responsable_nombre': row[21]
    }

    # Documentos
    cursor.execute("""
        SELECT id, nombre, path, tipo, created_at
        FROM reclamo_documento
        WHERE reclamo_id = ?
        ORDER BY created_at DESC
    """, (reclamo_id,))

    reclamo['documentos'] = [
        {
            'id': r[0],
            'nombre': r[1],
            'path': r[2],
            'tipo': r[3],
            'created_at': r[4]
        } for r in cursor.fetchall()
    ]

    # Historial
    cursor.execute("""
        SELECT h.id, h.estado_anterior, h.estado_nuevo, h.actor_id, h.notas, h.created_at,
               u.nombre as actor_nombre
        FROM reclamo_historial h
        LEFT JOIN usuarios u ON h.actor_id = u.id_spm
        WHERE h.reclamo_id = ?
        ORDER BY h.created_at DESC
    """, (reclamo_id,))

    reclamo['historial'] = [
        {
            'id': r[0],
            'estado_anterior': r[1],
            'estado_nuevo': r[2],
            'actor_id': r[3],
            'notas': r[4],
            'created_at': r[5],
            'actor_nombre': r[6]
        } for r in cursor.fetchall()
    ]

    conn.close()
    return reclamo


def _cambiar_estado_reclamo(reclamo_id, nuevo_estado, actor_id, notas=None):
    """Helper para cambiar estado de reclamo y registrar en historial"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener estado actual
    cursor.execute("SELECT estado FROM reclamo_garantia WHERE id = ?", (reclamo_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    estado_anterior = row[0]

    # Actualizar estado
    cursor.execute("""
        UPDATE reclamo_garantia
        SET estado = ?
        WHERE id = ?
    """, (nuevo_estado, reclamo_id))

    # Registrar en historial
    cursor.execute("""
        INSERT INTO reclamo_historial (
            reclamo_id, estado_anterior, estado_nuevo, actor_id, notas
        ) VALUES (?, ?, ?, ?, ?)
    """, (reclamo_id, estado_anterior, nuevo_estado, actor_id, notas))

    conn.commit()
    conn.close()
    return True


def enviar_reclamo(reclamo_id, actor_id):
    """Envía un reclamo (draft -> submitted)"""
    return _cambiar_estado_reclamo(reclamo_id, 'submitted', actor_id, 'Reclamo enviado para revisión')


def revisar_reclamo(reclamo_id, actor_id, notas=None):
    """Pone un reclamo en revisión (submitted -> under_review)"""
    return _cambiar_estado_reclamo(reclamo_id, 'under_review', actor_id, notas or 'Reclamo en revisión')


def aprobar_reclamo(reclamo_id, actor_id, notas=None):
    """Aprueba un reclamo (under_review -> approved)"""
    return _cambiar_estado_reclamo(reclamo_id, 'approved', actor_id, notas or 'Reclamo aprobado')


def rechazar_reclamo(reclamo_id, actor_id, notas=None):
    """Rechaza un reclamo (under_review -> rejected)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener estado actual
    cursor.execute("SELECT estado FROM reclamo_garantia WHERE id = ?", (reclamo_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    estado_anterior = row[0]

    # Actualizar estado y resolución
    cursor.execute("""
        UPDATE reclamo_garantia
        SET estado = 'rejected', resolucion = 'rechazo'
        WHERE id = ?
    """, (reclamo_id,))

    # Registrar en historial
    cursor.execute("""
        INSERT INTO reclamo_historial (
            reclamo_id, estado_anterior, estado_nuevo, actor_id, notas
        ) VALUES (?, ?, 'rejected', ?, ?)
    """, (reclamo_id, estado_anterior, actor_id, notas or 'Reclamo rechazado'))

    conn.commit()
    conn.close()
    return True


def resolver_reclamo(reclamo_id, resolucion, monto_recuperado, actor_id, notas=None):
    """Resuelve un reclamo (approved -> resolved)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener estado actual
    cursor.execute("SELECT estado FROM reclamo_garantia WHERE id = ?", (reclamo_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    estado_anterior = row[0]

    # Actualizar estado, resolución y monto
    cursor.execute("""
        UPDATE reclamo_garantia
        SET estado = 'resolved',
            resolucion = ?,
            monto_recuperado = ?,
            fecha_resolucion = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (resolucion, monto_recuperado, reclamo_id))

    # Registrar en historial
    cursor.execute("""
        INSERT INTO reclamo_historial (
            reclamo_id, estado_anterior, estado_nuevo, actor_id, notas
        ) VALUES (?, ?, 'resolved', ?, ?)
    """, (reclamo_id, estado_anterior, actor_id,
          notas or f'Reclamo resuelto: {resolucion}, monto recuperado: ${monto_recuperado}'))

    conn.commit()
    conn.close()
    return True


def agregar_documento_reclamo(reclamo_id, nombre, path, tipo):
    """Agrega un documento a un reclamo"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO reclamo_documento (
            reclamo_id, nombre, path, tipo
        ) VALUES (?, ?, ?, ?)
    """, (reclamo_id, nombre, path, tipo))

    doc_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return doc_id


def check_garantias_por_vencer(dias_anticipacion=30):
    """Verifica garantías próximas a vencer (para Celery task)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Fecha límite (hoy + dias_anticipacion)
    fecha_limite = (datetime.now() + timedelta(days=dias_anticipacion)).isoformat()

    cursor.execute("""
        SELECT
            g.id,
            g.material_codigo,
            g.proveedor_cuit,
            g.fecha_fin,
            m.descripcion as material_desc,
            p.razon_social as proveedor_nombre
        FROM garantia g
        LEFT JOIN materiales_bbdd m ON g.material_codigo = m.codigo_material
        LEFT JOIN proveedores p ON g.proveedor_cuit = p.id_proveedor
        WHERE g.estado = 'active'
        AND g.fecha_fin <= ?
        AND g.fecha_fin >= date('now')
        ORDER BY g.fecha_fin ASC
    """, (fecha_limite,))

    garantias_por_vencer = [
        {
            'id': r[0],
            'material_codigo': r[1],
            'proveedor_cuit': r[2],
            'fecha_fin': r[3],
            'material_desc': r[4],
            'proveedor_nombre': r[5],
            'dias_restantes': (datetime.fromisoformat(r[3]) - datetime.now()).days
        } for r in cursor.fetchall()
    ]

    # Actualizar garantías vencidas
    cursor.execute("""
        UPDATE garantia
        SET estado = 'expired'
        WHERE estado = 'active'
        AND fecha_fin < date('now')
    """)

    conn.commit()
    conn.close()

    return garantias_por_vencer


def obtener_kpis():
    """Obtiene KPIs de garantías y reclamos"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Reclamos abiertos
    cursor.execute("""
        SELECT COUNT(*)
        FROM reclamo_garantia
        WHERE estado IN ('draft', 'submitted', 'under_review', 'approved')
    """)
    reclamos_abiertos = cursor.fetchone()[0]

    # Monto recuperado (último mes)
    cursor.execute("""
        SELECT COALESCE(SUM(monto_recuperado), 0)
        FROM reclamo_garantia
        WHERE estado = 'resolved'
        AND fecha_resolucion >= date('now', '-30 days')
    """)
    monto_recuperado = cursor.fetchone()[0]

    # Tasa de aprobación (últimos 3 meses)
    cursor.execute("""
        SELECT
            COUNT(CASE WHEN estado IN ('approved', 'resolved') THEN 1 END) as aprobados,
            COUNT(CASE WHEN estado = 'rejected' THEN 1 END) as rechazados
        FROM reclamo_garantia
        WHERE estado IN ('approved', 'rejected', 'resolved')
        AND created_at >= date('now', '-90 days')
    """)
    row = cursor.fetchone()
    aprobados = row[0] or 0
    rechazados = row[1] or 0
    tasa_aprobacion = (aprobados / (aprobados + rechazados) * 100) if (aprobados + rechazados) > 0 else 0

    # Garantías por vencer (próximos 30 días)
    cursor.execute("""
        SELECT COUNT(*)
        FROM garantia
        WHERE estado = 'active'
        AND fecha_fin <= date('now', '+30 days')
        AND fecha_fin >= date('now')
    """)
    garantias_por_vencer = cursor.fetchone()[0]

    conn.close()

    return {
        'reclamos_abiertos': reclamos_abiertos,
        'monto_recuperado': round(monto_recuperado, 2),
        'tasa_aprobacion': round(tasa_aprobacion, 1),
        'garantias_por_vencer': garantias_por_vencer
    }
