"""
Service de Planificación de Producción (MPS)
Gestión de work centers, planes de producción y capacidad
"""
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection


def crear_work_center(data: Dict[str, Any]) -> int:
    """Crear un nuevo work center"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO work_center
        (nombre, codigo, tipo, capacidad_diaria, unidad, turnos, eficiencia_pct, costo_hora, estado, ubicacion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data['nombre'],
        data['codigo'],
        data.get('tipo'),
        data.get('capacidad_diaria'),
        data.get('unidad', 'horas'),
        data.get('turnos', 1),
        data.get('eficiencia_pct', 85),
        data.get('costo_hora'),
        data.get('estado', 'active'),
        data.get('ubicacion')
    ))

    wc_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return wc_id


def obtener_work_centers(filtros: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Obtener lista de work centers con filtros opcionales"""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM work_center WHERE 1=1"
    params = []

    if filtros:
        if filtros.get('tipo'):
            query += " AND tipo = ?"
            params.append(filtros['tipo'])
        if filtros.get('estado'):
            query += " AND estado = ?"
            params.append(filtros['estado'])
        if filtros.get('codigo'):
            query += " AND codigo LIKE ?"
            params.append(f"%{filtros['codigo']}%")

    query += " ORDER BY codigo"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def actualizar_work_center(wc_id: int, data: Dict[str, Any]) -> bool:
    """Actualizar un work center existente"""
    conn = get_db_connection()
    cursor = conn.cursor()

    campos_update = []
    params = []

    campos_permitidos = ['nombre', 'tipo', 'capacidad_diaria', 'unidad', 'turnos',
                         'eficiencia_pct', 'costo_hora', 'estado', 'ubicacion']

    for campo in campos_permitidos:
        if campo in data:
            campos_update.append(f"{campo} = ?")
            params.append(data[campo])

    if not campos_update:
        conn.close()
        return False

    params.append(wc_id)
    query = f"UPDATE work_center SET {', '.join(campos_update)} WHERE id = ?"

    cursor.execute(query, params)
    conn.commit()
    conn.close()

    return True


def crear_plan(data: Dict[str, Any]) -> int:
    """Crear un nuevo plan de producción"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO plan_produccion
        (nombre, periodo_desde, periodo_hasta, estado, responsable_id, notas)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        data['nombre'],
        data.get('periodo_desde'),
        data.get('periodo_hasta'),
        data.get('estado', 'draft'),
        data.get('responsable_id'),
        data.get('notas')
    ))

    plan_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return plan_id


def obtener_planes(filtros: Optional[Dict[str, Any]] = None, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
    """Obtener planes de producción con paginación"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Query base para contar
    count_query = "SELECT COUNT(*) as total FROM plan_produccion WHERE 1=1"
    params_count = []

    # Query para datos
    query = """
        SELECT pp.*,
               u.nombre_completo as responsable_nombre,
               (SELECT COUNT(*) FROM plan_produccion_item WHERE plan_id = pp.id) as total_items,
               (SELECT COUNT(*) FROM plan_produccion_item WHERE plan_id = pp.id AND estado = 'completado') as items_completados
        FROM plan_produccion pp
        LEFT JOIN usuarios u ON pp.responsable_id = u.id
        WHERE 1=1
    """
    params = []

    # Filtros
    if filtros:
        if filtros.get('estado'):
            condition = " AND pp.estado = ?"
            query += condition
            count_query += condition.replace('pp.', '')
            params.append(filtros['estado'])
            params_count.append(filtros['estado'])

        if filtros.get('responsable_id'):
            condition = " AND pp.responsable_id = ?"
            query += condition
            count_query += condition.replace('pp.', '')
            params.append(filtros['responsable_id'])
            params_count.append(filtros['responsable_id'])

        if filtros.get('periodo_desde'):
            condition = " AND pp.periodo_hasta >= ?"
            query += condition
            count_query += condition.replace('pp.', '')
            params.append(filtros['periodo_desde'])
            params_count.append(filtros['periodo_desde'])

    # Contar total
    cursor.execute(count_query, params_count)
    total = cursor.fetchone()['total']

    # Paginación
    query += " ORDER BY pp.created_at DESC LIMIT ? OFFSET ?"
    params.extend([page_size, (page - 1) * page_size])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return {
        'planes': [dict(row) for row in rows],
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': (total + page_size - 1) // page_size
    }


def obtener_detalle_plan(plan_id: int) -> Optional[Dict[str, Any]]:
    """Obtener detalle completo de un plan con sus items"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener plan
    cursor.execute("""
        SELECT pp.*, u.nombre_completo as responsable_nombre
        FROM plan_produccion pp
        LEFT JOIN usuarios u ON pp.responsable_id = u.id
        WHERE pp.id = ?
    """, (plan_id,))

    plan = cursor.fetchone()
    if not plan:
        conn.close()
        return None

    plan_dict = dict(plan)

    # Obtener items del plan
    cursor.execute("""
        SELECT ppi.*,
               wc.nombre as work_center_nombre,
               wc.codigo as work_center_codigo,
               kb.nombre as kit_nombre
        FROM plan_produccion_item ppi
        LEFT JOIN work_center wc ON ppi.work_center_id = wc.id
        LEFT JOIN kit_bom kb ON ppi.kit_bom_id = kb.id
        WHERE ppi.plan_id = ?
        ORDER BY ppi.fecha_programada, ppi.prioridad DESC
    """, (plan_id,))

    items = cursor.fetchall()
    plan_dict['items'] = [dict(item) for item in items]

    conn.close()
    return plan_dict


def agregar_item_plan(plan_id: int, data: Dict[str, Any]) -> int:
    """Agregar un item a un plan de producción"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO plan_produccion_item
        (plan_id, material_codigo, work_center_id, fecha_programada, cantidad_planificada,
         prioridad, estado, kit_bom_id, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        plan_id,
        data['material_codigo'],
        data.get('work_center_id'),
        data['fecha_programada'],
        data['cantidad_planificada'],
        data.get('prioridad', 'media'),
        data.get('estado', 'pendiente'),
        data.get('kit_bom_id'),
        data.get('notas')
    ))

    item_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return item_id


def publicar_plan(plan_id: int) -> bool:
    """Publicar un plan de producción y calcular capacidad comprometida"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verificar que el plan existe y está en draft
    cursor.execute("SELECT estado FROM plan_produccion WHERE id = ?", (plan_id,))
    plan = cursor.fetchone()

    if not plan or plan['estado'] != 'draft':
        conn.close()
        return False

    # Actualizar estado del plan
    cursor.execute("""
        UPDATE plan_produccion
        SET estado = 'publicado', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (plan_id,))

    # Obtener items del plan para actualizar capacidad
    cursor.execute("""
        SELECT ppi.work_center_id, ppi.fecha_programada,
               SUM(ppi.cantidad_planificada) as total_cantidad
        FROM plan_produccion_item ppi
        WHERE ppi.plan_id = ?
        GROUP BY ppi.work_center_id, ppi.fecha_programada
    """, (plan_id,))

    items_agrupados = cursor.fetchall()

    # Actualizar capacidad comprometida
    for item in items_agrupados:
        # Intentar actualizar si existe
        cursor.execute("""
            UPDATE produccion_capacidad
            SET capacidad_comprometida = capacidad_comprometida + ?
            WHERE work_center_id = ? AND fecha = ?
        """, (item['total_cantidad'], item['work_center_id'], item['fecha_programada']))

        # Si no existía, crear registro
        if cursor.rowcount == 0:
            # Obtener capacidad del work center
            cursor.execute("""
                SELECT capacidad_diaria * turnos * eficiencia_pct / 100 as cap_disponible
                FROM work_center
                WHERE id = ?
            """, (item['work_center_id'],))

            wc = cursor.fetchone()
            cap_disponible = wc['cap_disponible'] if wc else 0

            cursor.execute("""
                INSERT INTO produccion_capacidad
                (work_center_id, fecha, capacidad_disponible, capacidad_comprometida)
                VALUES (?, ?, ?, ?)
            """, (item['work_center_id'], item['fecha_programada'], cap_disponible, item['total_cantidad']))

    conn.commit()
    conn.close()

    return True


def validar_capacidad(plan_id: int) -> Dict[str, Any]:
    """Validar que el plan no exceda capacidad disponible de work centers"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener items agrupados por work center y fecha
    cursor.execute("""
        SELECT ppi.work_center_id, ppi.fecha_programada,
               wc.nombre as work_center_nombre,
               wc.codigo as work_center_codigo,
               wc.capacidad_diaria, wc.turnos, wc.eficiencia_pct,
               SUM(ppi.cantidad_planificada) as total_planificado
        FROM plan_produccion_item ppi
        JOIN work_center wc ON ppi.work_center_id = wc.id
        WHERE ppi.plan_id = ?
        GROUP BY ppi.work_center_id, ppi.fecha_programada
    """, (plan_id,))

    items_agrupados = cursor.fetchall()

    excesos = []
    total_capacidad_requerida = 0
    total_capacidad_disponible = 0

    for item in items_agrupados:
        # Calcular capacidad disponible efectiva
        cap_disponible = (item['capacidad_diaria'] or 0) * (item['turnos'] or 1) * (item['eficiencia_pct'] or 85) / 100

        # Obtener capacidad ya comprometida en esa fecha
        cursor.execute("""
            SELECT COALESCE(capacidad_comprometida, 0) as comprometida
            FROM produccion_capacidad
            WHERE work_center_id = ? AND fecha = ?
        """, (item['work_center_id'], item['fecha_programada']))

        cap_row = cursor.fetchone()
        cap_comprometida = cap_row['comprometida'] if cap_row else 0

        cap_disponible_neta = cap_disponible - cap_comprometida
        total_planificado = item['total_planificado']

        total_capacidad_requerida += total_planificado
        total_capacidad_disponible += cap_disponible_neta

        if total_planificado > cap_disponible_neta:
            excesos.append({
                'work_center_id': item['work_center_id'],
                'work_center_nombre': item['work_center_nombre'],
                'work_center_codigo': item['work_center_codigo'],
                'fecha': item['fecha_programada'],
                'capacidad_disponible': cap_disponible_neta,
                'capacidad_requerida': total_planificado,
                'exceso': total_planificado - cap_disponible_neta,
                'exceso_pct': ((total_planificado - cap_disponible_neta) / cap_disponible_neta * 100) if cap_disponible_neta > 0 else 100
            })

    conn.close()

    return {
        'valido': len(excesos) == 0,
        'excesos': excesos,
        'total_excesos': len(excesos),
        'total_capacidad_requerida': total_capacidad_requerida,
        'total_capacidad_disponible': total_capacidad_disponible,
        'utilizacion_pct': (total_capacidad_requerida / total_capacidad_disponible * 100) if total_capacidad_disponible > 0 else 0
    }


def reportar_produccion(item_id: int, cantidad_producida: float, notas: Optional[str] = None) -> bool:
    """Reportar cantidad producida para un item del plan"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener item actual
    cursor.execute("""
        SELECT cantidad_planificada, cantidad_producida, work_center_id, fecha_programada
        FROM plan_produccion_item
        WHERE id = ?
    """, (item_id,))

    item = cursor.fetchone()
    if not item:
        conn.close()
        return False

    nueva_cantidad = item['cantidad_producida'] + cantidad_producida
    nueva_cantidad = min(nueva_cantidad, item['cantidad_planificada'])  # No exceder planificado

    # Determinar nuevo estado
    if nueva_cantidad >= item['cantidad_planificada']:
        nuevo_estado = 'completado'
    elif nueva_cantidad > 0:
        nuevo_estado = 'en_proceso'
    else:
        nuevo_estado = 'pendiente'

    # Actualizar item
    update_query = "UPDATE plan_produccion_item SET cantidad_producida = ?, estado = ?"
    params = [nueva_cantidad, nuevo_estado]

    if notas:
        update_query += ", notas = ?"
        params.append(notas)

    update_query += " WHERE id = ?"
    params.append(item_id)

    cursor.execute(update_query, params)

    # Actualizar capacidad utilizada
    cursor.execute("""
        UPDATE produccion_capacidad
        SET capacidad_utilizada = capacidad_utilizada + ?
        WHERE work_center_id = ? AND fecha = ?
    """, (cantidad_producida, item['work_center_id'], item['fecha_programada']))

    conn.commit()
    conn.close()

    return True


def completar_plan(plan_id: int) -> bool:
    """Marcar un plan como completado"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verificar que todos los items estén completados
    cursor.execute("""
        SELECT COUNT(*) as total,
               SUM(CASE WHEN estado = 'completado' THEN 1 ELSE 0 END) as completados
        FROM plan_produccion_item
        WHERE plan_id = ?
    """, (plan_id,))

    stats = cursor.fetchone()

    if stats['total'] > 0 and stats['total'] == stats['completados']:
        cursor.execute("""
            UPDATE plan_produccion
            SET estado = 'completado', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (plan_id,))

        conn.commit()
        conn.close()
        return True

    conn.close()
    return False


def obtener_utilizacion(filtros: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Obtener utilización de capacidad por work center y periodo"""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            pc.work_center_id,
            wc.nombre as work_center_nombre,
            wc.codigo as work_center_codigo,
            pc.fecha,
            pc.capacidad_disponible,
            pc.capacidad_utilizada,
            pc.capacidad_comprometida,
            CASE
                WHEN pc.capacidad_disponible > 0
                THEN (pc.capacidad_utilizada / pc.capacidad_disponible * 100)
                ELSE 0
            END as utilizacion_pct,
            CASE
                WHEN pc.capacidad_disponible > 0
                THEN ((pc.capacidad_comprometida - pc.capacidad_utilizada) / pc.capacidad_disponible * 100)
                ELSE 0
            END as pendiente_pct
        FROM produccion_capacidad pc
        JOIN work_center wc ON pc.work_center_id = wc.id
        WHERE 1=1
    """
    params = []

    if filtros.get('work_center_id'):
        query += " AND pc.work_center_id = ?"
        params.append(filtros['work_center_id'])

    if filtros.get('fecha_desde'):
        query += " AND pc.fecha >= ?"
        params.append(filtros['fecha_desde'])

    if filtros.get('fecha_hasta'):
        query += " AND pc.fecha <= ?"
        params.append(filtros['fecha_hasta'])

    query += " ORDER BY pc.fecha, wc.codigo"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def obtener_kpis() -> Dict[str, Any]:
    """Obtener KPIs de producción"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Planes activos
    cursor.execute("""
        SELECT COUNT(*) as total
        FROM plan_produccion
        WHERE estado IN ('publicado', 'en_ejecucion')
    """)
    planes_activos = cursor.fetchone()['total']

    # Items retrasados (fecha programada pasada y no completados)
    cursor.execute("""
        SELECT COUNT(*) as total
        FROM plan_produccion_item ppi
        JOIN plan_produccion pp ON ppi.plan_id = pp.id
        WHERE pp.estado IN ('publicado', 'en_ejecucion')
          AND ppi.estado != 'completado'
          AND ppi.fecha_programada < date('now')
    """)
    items_retrasados = cursor.fetchone()['total']

    # Utilización promedio (últimos 7 días)
    cursor.execute("""
        SELECT AVG(
            CASE
                WHEN capacidad_disponible > 0
                THEN (capacidad_utilizada / capacidad_disponible * 100)
                ELSE 0
            END
        ) as utilizacion_promedio
        FROM produccion_capacidad
        WHERE fecha >= date('now', '-7 days')
          AND fecha < date('now')
    """)
    result = cursor.fetchone()
    utilizacion_promedio = result['utilizacion_promedio'] if result['utilizacion_promedio'] else 0

    # Work centers activos
    cursor.execute("""
        SELECT COUNT(*) as total
        FROM work_center
        WHERE estado = 'active'
    """)
    work_centers_activos = cursor.fetchone()['total']

    # Items completados hoy
    cursor.execute("""
        SELECT COUNT(*) as total
        FROM plan_produccion_item ppi
        JOIN plan_produccion pp ON ppi.plan_id = pp.id
        WHERE ppi.estado = 'completado'
          AND date(ppi.created_at) = date('now')
    """)
    items_completados_hoy = cursor.fetchone()['total']

    conn.close()

    return {
        'planes_activos': planes_activos,
        'items_retrasados': items_retrasados,
        'utilizacion_promedio': round(utilizacion_promedio, 1),
        'work_centers_activos': work_centers_activos,
        'items_completados_hoy': items_completados_hoy
    }
