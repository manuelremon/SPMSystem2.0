"""
Servicio para gestión de garantías y reclamos
Fecha: 2026-02-15
"""
import logging
from datetime import datetime, timedelta

from backend.core.db import get_db_connection, is_using_postgresql

logger = logging.getLogger(__name__)


def _ph():
    return "%s" if is_using_postgresql() else "?"


def crear_garantia(material_codigo, proveedor_cuit, tipo, duracion_meses, fecha_inicio,
                   condiciones=None, lote_id=None, orden_compra_id=None):
    """Crea una nueva garantía para un material/proveedor"""
    conn = get_db_connection()
    cursor = conn.cursor()
    ph = _ph()

    # Calcular fecha fin
    fecha_inicio_dt = datetime.fromisoformat(fecha_inicio.replace('Z', '+00:00')) if isinstance(fecha_inicio, str) else fecha_inicio
    fecha_fin = fecha_inicio_dt + timedelta(days=30 * duracion_meses)

    cursor.execute(f"""
        INSERT INTO garantia (
            material_codigo, proveedor_cuit, lote_id, orden_compra_id,
            tipo, duracion_meses, fecha_inicio, fecha_fin, condiciones, estado
        ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, 'active')
        RETURNING id
    """, (material_codigo, proveedor_cuit, lote_id, orden_compra_id,
          tipo, duracion_meses, fecha_inicio, fecha_fin.isoformat(), condiciones))

    garantia_id = cursor.fetchone()[0]
    conn.commit()
    conn.close()

    return garantia_id


def obtener_garantias(page=1, per_page=50, material_codigo=None, proveedor_cuit=None, estado=None):
    """Obtiene garantías con filtros y paginación"""
    conn = get_db_connection()
    cursor = conn.cursor()
    ph = _ph()

    # Construir query con filtros
    where_clauses = []
    params = []

    if material_codigo:
        where_clauses.append(f"g.material_codigo = {ph}")
        params.append(material_codigo)
    if proveedor_cuit:
        where_clauses.append(f"g.proveedor_cuit = {ph}")
        params.append(proveedor_cuit)
    if estado:
        where_clauses.append(f"g.estado = {ph}")
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
        GROUP BY g.id, m.descripcion, p.razon_social
        ORDER BY g.created_at DESC
        LIMIT {ph} OFFSET {ph}
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
            'created_at': str(row[11]) if row[11] else None,
            'material_desc': row[12],
            'proveedor_nombre': row[13],
            'reclamos_count': row[14],
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
    """Crea un nuevo reclamo de garantía.

    Columnas reales de reclamo_garantia:
    id, garantia_id, tipo, descripcion, estado, reportado_por, asignado_a, resolucion, created_at, updated_at
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    ph = _ph()

    cursor.execute(f"""
        INSERT INTO reclamo_garantia (
            garantia_id, tipo, descripcion, estado, reportado_por, asignado_a
        ) VALUES ({ph}, {ph}, {ph}, 'draft', {ph}, {ph})
        RETURNING id
    """, (garantia_id, tipo, descripcion, responsable_id, responsable_id))

    reclamo_id = cursor.fetchone()[0]

    # Registrar en historial (table may not exist yet)
    try:
        cursor.execute(f"""
            INSERT INTO reclamo_historial (
                reclamo_id, estado_anterior, estado_nuevo, actor_id, notas
            ) VALUES ({ph}, NULL, 'draft', {ph}, 'Reclamo creado')
        """, (reclamo_id, responsable_id))
    except Exception:
        pass  # reclamo_historial table may not exist

    conn.commit()
    conn.close()

    # Generate numero_reclamo for the route response
    numero_reclamo = f"RCL-{reclamo_id:06d}"

    return {
        'id': reclamo_id,
        'numero_reclamo': numero_reclamo,
    }


def obtener_reclamos(page=1, per_page=50, estado=None, tipo=None, garantia_id=None):
    """Obtiene reclamos con filtros y paginación"""
    conn = get_db_connection()
    cursor = conn.cursor()
    ph = _ph()

    # Construir query con filtros
    where_clauses = []
    params = []

    if estado:
        where_clauses.append(f"r.estado = {ph}")
        params.append(estado)
    if tipo:
        where_clauses.append(f"r.tipo = {ph}")
        params.append(tipo)
    if garantia_id:
        where_clauses.append(f"r.garantia_id = {ph}")
        params.append(garantia_id)

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    # Contar total
    cursor.execute(f"SELECT COUNT(*) FROM reclamo_garantia r {where_sql}", params)
    total = cursor.fetchone()[0]

    # Query paginada con joins — columnas reales de reclamo_garantia:
    # id, garantia_id, tipo, descripcion, estado, reportado_por, asignado_a, resolucion, created_at, updated_at
    offset = (page - 1) * per_page
    query = f"""
        SELECT
            r.id, r.garantia_id, r.tipo, r.descripcion, r.estado,
            r.reportado_por, r.asignado_a, r.resolucion,
            r.created_at, r.updated_at,
            g.material_codigo, g.proveedor_cuit,
            m.descripcion as material_desc,
            p.razon_social as proveedor_nombre,
            u.nombre as responsable_nombre
        FROM reclamo_garantia r
        LEFT JOIN garantia g ON r.garantia_id = g.id
        LEFT JOIN materiales_bbdd m ON g.material_codigo = m.codigo_material
        LEFT JOIN proveedores p ON g.proveedor_cuit = p.id_proveedor
        LEFT JOIN usuarios u ON r.asignado_a::text = u.id_spm
        {where_sql}
        GROUP BY r.id, r.garantia_id, r.tipo, r.descripcion, r.estado,
                 r.reportado_por, r.asignado_a, r.resolucion,
                 r.created_at, r.updated_at,
                 g.material_codigo, g.proveedor_cuit,
                 m.descripcion, p.razon_social, u.nombre
        ORDER BY r.created_at DESC
        LIMIT {ph} OFFSET {ph}
    """

    params.extend([per_page, offset])
    cursor.execute(query, params)

    reclamos = []
    for row in cursor.fetchall():
        reclamos.append({
            'id': row[0],
            'garantia_id': row[1],
            'tipo': row[2],
            'descripcion': row[3],
            'estado': row[4],
            'reportado_por': row[5],
            'asignado_a': row[6],
            'resolucion': row[7],
            'created_at': str(row[8]) if row[8] else None,
            'updated_at': str(row[9]) if row[9] else None,
            'material_codigo': row[10],
            'proveedor_cuit': row[11],
            'material_desc': row[12],
            'proveedor_nombre': row[13],
            'responsable_nombre': row[14],
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
    ph = _ph()

    # Datos principales — columnas reales de reclamo_garantia:
    # id, garantia_id, tipo, descripcion, estado, reportado_por, asignado_a, resolucion, created_at, updated_at
    cursor.execute(f"""
        SELECT
            r.id, r.garantia_id, r.tipo, r.descripcion, r.estado,
            r.reportado_por, r.asignado_a, r.resolucion,
            r.created_at, r.updated_at,
            g.material_codigo, g.proveedor_cuit,
            g.tipo as garantia_tipo, g.duracion_meses,
            g.fecha_inicio, g.fecha_fin,
            m.descripcion as material_desc,
            p.razon_social as proveedor_nombre,
            u.nombre as responsable_nombre
        FROM reclamo_garantia r
        LEFT JOIN garantia g ON r.garantia_id = g.id
        LEFT JOIN materiales_bbdd m ON g.material_codigo = m.codigo_material
        LEFT JOIN proveedores p ON g.proveedor_cuit = p.id_proveedor
        LEFT JOIN usuarios u ON r.asignado_a::text = u.id_spm
        WHERE r.id = {ph}
    """, (reclamo_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    reclamo = {
        'id': row[0],
        'garantia_id': row[1],
        'tipo': row[2],
        'descripcion': row[3],
        'estado': row[4],
        'reportado_por': row[5],
        'asignado_a': row[6],
        'resolucion': row[7],
        'created_at': str(row[8]) if row[8] else None,
        'updated_at': str(row[9]) if row[9] else None,
        'garantia': {
            'material_codigo': row[10],
            'proveedor_cuit': row[11],
            'tipo': row[12],
            'duracion_meses': row[13],
            'fecha_inicio': str(row[14]) if row[14] else None,
            'fecha_fin': str(row[15]) if row[15] else None,
            'material_desc': row[16],
            'proveedor_nombre': row[17],
        },
        'responsable_nombre': row[18],
    }

    # Historial
    cursor.execute(f"""
        SELECT h.id, h.estado_anterior, h.estado_nuevo, h.actor_id, h.notas, h.created_at,
               u.nombre as actor_nombre
        FROM reclamo_historial h
        LEFT JOIN usuarios u ON h.actor_id::text = u.id_spm
        WHERE h.reclamo_id = {ph}
        ORDER BY h.created_at DESC
    """, (reclamo_id,))

    reclamo['historial'] = [
        {
            'id': r[0],
            'estado_anterior': r[1],
            'estado_nuevo': r[2],
            'actor_id': r[3],
            'notas': r[4],
            'created_at': str(r[5]) if r[5] else None,
            'actor_nombre': r[6],
        } for r in cursor.fetchall()
    ]

    reclamo['documentos'] = []

    conn.close()
    return reclamo


def _cambiar_estado_reclamo(reclamo_id, nuevo_estado, actor_id, notas=None):
    """Helper para cambiar estado de reclamo y registrar en historial"""
    conn = get_db_connection()
    cursor = conn.cursor()
    ph = _ph()

    # Obtener estado actual
    cursor.execute(f"SELECT estado FROM reclamo_garantia WHERE id = {ph}", (reclamo_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    estado_anterior = row[0]

    # Actualizar estado
    cursor.execute(f"""
        UPDATE reclamo_garantia
        SET estado = {ph}
        WHERE id = {ph}
    """, (nuevo_estado, reclamo_id))

    # Registrar en historial
    cursor.execute(f"""
        INSERT INTO reclamo_historial (
            reclamo_id, estado_anterior, estado_nuevo, actor_id, notas
        ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
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
    ph = _ph()

    # Obtener estado actual
    cursor.execute(f"SELECT estado FROM reclamo_garantia WHERE id = {ph}", (reclamo_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    estado_anterior = row[0]

    # Actualizar estado y resolución
    cursor.execute(f"""
        UPDATE reclamo_garantia
        SET estado = 'rejected', resolucion = 'rechazo'
        WHERE id = {ph}
    """, (reclamo_id,))

    # Registrar en historial
    cursor.execute(f"""
        INSERT INTO reclamo_historial (
            reclamo_id, estado_anterior, estado_nuevo, actor_id, notas
        ) VALUES ({ph}, {ph}, 'rejected', {ph}, {ph})
    """, (reclamo_id, estado_anterior, actor_id, notas or 'Reclamo rechazado'))

    conn.commit()
    conn.close()
    return True


def resolver_reclamo(reclamo_id, resolucion, monto_recuperado, actor_id, notas=None):
    """Resuelve un reclamo (approved -> resolved)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    ph = _ph()

    # Obtener estado actual
    cursor.execute(f"SELECT estado FROM reclamo_garantia WHERE id = {ph}", (reclamo_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    estado_anterior = row[0]

    # Actualizar estado y resolución (columnas reales: estado, resolucion)
    cursor.execute(f"""
        UPDATE reclamo_garantia
        SET estado = 'resolved',
            resolucion = {ph}
        WHERE id = {ph}
    """, (resolucion, reclamo_id))

    # Registrar en historial
    cursor.execute(f"""
        INSERT INTO reclamo_historial (
            reclamo_id, estado_anterior, estado_nuevo, actor_id, notas
        ) VALUES ({ph}, {ph}, 'resolved', {ph}, {ph})
    """, (reclamo_id, estado_anterior, actor_id,
          notas or f'Reclamo resuelto: {resolucion}'))

    conn.commit()
    conn.close()
    return True


def agregar_documento_reclamo(reclamo_id, nombre, path, tipo):
    """Agrega un documento a un reclamo"""
    conn = get_db_connection()
    cursor = conn.cursor()
    ph = _ph()

    cursor.execute(f"""
        INSERT INTO reclamo_documento (
            reclamo_id, nombre, path, tipo
        ) VALUES ({ph}, {ph}, {ph}, {ph})
        RETURNING id
    """, (reclamo_id, nombre, path, tipo))

    doc_id = cursor.fetchone()[0]
    conn.commit()
    conn.close()

    return doc_id


def check_garantias_por_vencer(dias_anticipacion=30):
    """Verifica garantías próximas a vencer (para Celery task)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    ph = _ph()

    # Fecha límite (hoy + dias_anticipacion)
    fecha_limite = (datetime.now() + timedelta(days=dias_anticipacion)).isoformat()

    cursor.execute(f"""
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
        AND g.fecha_fin <= {ph}
        AND g.fecha_fin >= CURRENT_DATE
        ORDER BY g.fecha_fin ASC
    """, (fecha_limite,))

    garantias_por_vencer = [
        {
            'id': r[0],
            'material_codigo': r[1],
            'proveedor_cuit': r[2],
            'fecha_fin': str(r[3]) if r[3] else None,
            'material_desc': r[4],
            'proveedor_nombre': r[5],
            'dias_restantes': (datetime.fromisoformat(str(r[3])) - datetime.now()).days if r[3] else 0,
        } for r in cursor.fetchall()
    ]

    # Actualizar garantías vencidas
    cursor.execute("""
        UPDATE garantia
        SET estado = 'expired'
        WHERE estado = 'active'
        AND fecha_fin < CURRENT_DATE
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

    # monto_recuperado: columna no existe en tabla actual
    monto_recuperado = 0

    # Tasa de aprobación (últimos 3 meses)
    cursor.execute("""
        SELECT
            COUNT(CASE WHEN estado IN ('approved', 'resolved') THEN 1 END) as aprobados,
            COUNT(CASE WHEN estado = 'rejected' THEN 1 END) as rechazados
        FROM reclamo_garantia
        WHERE estado IN ('approved', 'rejected', 'resolved')
        AND created_at >= CURRENT_DATE - INTERVAL '90 days'
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
        AND fecha_fin <= CURRENT_DATE + INTERVAL '30 days'
        AND fecha_fin >= CURRENT_DATE
    """)
    garantias_por_vencer = cursor.fetchone()[0]

    conn.close()

    return {
        'reclamos_abiertos': reclamos_abiertos,
        'monto_recuperado': round(monto_recuperado, 2),
        'tasa_aprobacion': round(tasa_aprobacion, 1),
        'garantias_por_vencer': garantias_por_vencer
    }
