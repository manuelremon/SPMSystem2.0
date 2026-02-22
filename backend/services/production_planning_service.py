"""
Service de Planificacion de Produccion (MPS)
Gestion de work centers, planes de produccion y capacidad
"""
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, is_using_postgresql


def _ph():
    """Return the correct placeholder character for the current DB."""
    return "%s" if is_using_postgresql() else "?"


def crear_work_center(data: Dict[str, Any]) -> int:
    """Crear un nuevo work center"""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(f"""
            INSERT INTO work_center
            (nombre, codigo, tipo, capacidad_diaria, unidad, turnos, eficiencia_pct, costo_hora, estado, ubicacion)
            VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
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

        if is_using_postgresql():
            row = cursor.fetchone()
            wc_id = (row['id'] if isinstance(row, dict) else row[0]) if row else None
        else:
            wc_id = cursor.lastrowid

        return wc_id


def obtener_work_centers(filtros: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Obtener lista de work centers con filtros opcionales"""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        query = "SELECT * FROM work_center WHERE 1=1"
        params = []

        if filtros:
            if filtros.get('tipo'):
                query += f" AND tipo = {ph}"
                params.append(filtros['tipo'])
            if filtros.get('estado'):
                query += f" AND estado = {ph}"
                params.append(filtros['estado'])
            if filtros.get('codigo'):
                query += f" AND codigo LIKE {ph}"
                params.append(f"%{filtros['codigo']}%")

        query += " ORDER BY codigo"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        return [dict(row) for row in rows]


def actualizar_work_center(wc_id: int, data: Dict[str, Any]) -> bool:
    """Actualizar un work center existente"""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        campos_update = []
        params = []

        campos_permitidos = ['nombre', 'tipo', 'capacidad_diaria', 'unidad', 'turnos',
                             'eficiencia_pct', 'costo_hora', 'estado', 'ubicacion']

        for campo in campos_permitidos:
            if campo in data:
                campos_update.append(f"{campo} = {ph}")
                params.append(data[campo])

        if not campos_update:
            return False

        params.append(wc_id)
        query = f"UPDATE work_center SET {', '.join(campos_update)} WHERE id = {ph}"

        cursor.execute(query, params)
        return cursor.rowcount > 0


def crear_plan(data: Dict[str, Any]) -> int:
    """Crear un nuevo plan de produccion"""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if is_using_postgresql():
            cursor.execute(f"""
                INSERT INTO plan_produccion
                (nombre, periodo_desde, periodo_hasta, estado, responsable_id, notas)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                RETURNING id
            """, (
                data['nombre'],
                data.get('periodo_desde'),
                data.get('periodo_hasta'),
                data.get('estado', 'draft'),
                data.get('responsable_id'),
                data.get('notas')
            ))
            row = cursor.fetchone()
            return (row['id'] if isinstance(row, dict) else row[0]) if row else None
        else:
            cursor.execute(f"""
                INSERT INTO plan_produccion
                (nombre, periodo_desde, periodo_hasta, estado, responsable_id, notas)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
            """, (
                data['nombre'],
                data.get('periodo_desde'),
                data.get('periodo_hasta'),
                data.get('estado', 'draft'),
                data.get('responsable_id'),
                data.get('notas')
            ))
            return cursor.lastrowid


def obtener_planes(filtros: Optional[Dict[str, Any]] = None, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
    """Obtener planes de produccion con paginacion"""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Query base para contar
        count_query = "SELECT COUNT(*) as total FROM plan_produccion WHERE 1=1"
        params_count = []

        # Query para datos
        query = f"""
            SELECT pp.*,
                   u.nombre as responsable_nombre,
                   (SELECT COUNT(*) FROM plan_produccion_item WHERE plan_id = pp.id) as total_items,
                   (SELECT COUNT(*) FROM plan_produccion_item WHERE plan_id = pp.id AND estado = 'completado') as items_completados
            FROM plan_produccion pp
            LEFT JOIN usuarios u ON pp.responsable_id::text = u.id_spm::text
            WHERE 1=1
        """ if is_using_postgresql() else """
            SELECT pp.*,
                   u.nombre as responsable_nombre,
                   (SELECT COUNT(*) FROM plan_produccion_item WHERE plan_id = pp.id) as total_items,
                   (SELECT COUNT(*) FROM plan_produccion_item WHERE plan_id = pp.id AND estado = 'completado') as items_completados
            FROM plan_produccion pp
            LEFT JOIN usuarios u ON pp.responsable_id = u.id_spm
            WHERE 1=1
        """
        params = []

        # Filtros
        if filtros:
            if filtros.get('estado'):
                query += f" AND pp.estado = {ph}"
                count_query += f" AND estado = {ph}"
                params.append(filtros['estado'])
                params_count.append(filtros['estado'])

            if filtros.get('responsable_id'):
                query += f" AND pp.responsable_id = {ph}"
                count_query += f" AND responsable_id = {ph}"
                params.append(filtros['responsable_id'])
                params_count.append(filtros['responsable_id'])

            if filtros.get('periodo_desde'):
                query += f" AND pp.periodo_hasta >= {ph}"
                count_query += f" AND periodo_hasta >= {ph}"
                params.append(filtros['periodo_desde'])
                params_count.append(filtros['periodo_desde'])

        # Contar total
        cursor.execute(count_query, params_count)
        total_row = cursor.fetchone()
        total = (total_row['total'] if isinstance(total_row, dict) else total_row[0]) if total_row else 0

        # Paginacion
        query += f" ORDER BY pp.created_at DESC LIMIT {ph} OFFSET {ph}"
        params.extend([page_size, (page - 1) * page_size])

        cursor.execute(query, params)
        rows = cursor.fetchall()

        return {
            'planes': [dict(row) for row in rows],
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size
        }


def obtener_detalle_plan(plan_id: int) -> Optional[Dict[str, Any]]:
    """Obtener detalle completo de un plan con sus items"""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Obtener plan - usuarios.nombre (not nombre_completo)
        if is_using_postgresql():
            cursor.execute(f"""
                SELECT pp.*, u.nombre as responsable_nombre
                FROM plan_produccion pp
                LEFT JOIN usuarios u ON pp.responsable_id::text = u.id_spm::text
                WHERE pp.id = {ph}
            """, (plan_id,))
        else:
            cursor.execute(f"""
                SELECT pp.*, u.nombre as responsable_nombre
                FROM plan_produccion pp
                LEFT JOIN usuarios u ON pp.responsable_id = u.id_spm
                WHERE pp.id = {ph}
            """, (plan_id,))

        plan = cursor.fetchone()
        if not plan:
            return None

        plan_dict = dict(plan)

        # Obtener items del plan
        cursor.execute(f"""
            SELECT ppi.*,
                   wc.nombre as work_center_nombre,
                   wc.codigo as work_center_codigo,
                   kb.nombre as kit_nombre
            FROM plan_produccion_item ppi
            LEFT JOIN work_center wc ON ppi.work_center_id = wc.id
            LEFT JOIN kit_bom kb ON ppi.kit_bom_id = kb.id
            WHERE ppi.plan_id = {ph}
            ORDER BY ppi.fecha_programada, ppi.prioridad DESC
        """, (plan_id,))

        items = cursor.fetchall()
        plan_dict['items'] = [dict(item) for item in items]

        return plan_dict


def agregar_item_plan(plan_id: int, data: Dict[str, Any]) -> int:
    """Agregar un item a un plan de produccion"""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        if is_using_postgresql():
            cursor.execute(f"""
                INSERT INTO plan_produccion_item
                (plan_id, material_codigo, work_center_id, fecha_programada, cantidad_planificada,
                 prioridad, estado, kit_bom_id, notas)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                RETURNING id
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
            row = cursor.fetchone()
            return (row['id'] if isinstance(row, dict) else row[0]) if row else None
        else:
            cursor.execute(f"""
                INSERT INTO plan_produccion_item
                (plan_id, material_codigo, work_center_id, fecha_programada, cantidad_planificada,
                 prioridad, estado, kit_bom_id, notas)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
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
            return cursor.lastrowid


def publicar_plan(plan_id: int) -> bool:
    """Publicar un plan de produccion y calcular capacidad comprometida"""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Verificar que el plan existe y esta en draft
        cursor.execute(f"SELECT estado FROM plan_produccion WHERE id = {ph}", (plan_id,))
        plan = cursor.fetchone()

        if not plan:
            return False
        plan_estado = plan['estado'] if isinstance(plan, dict) else plan[0]
        if plan_estado != 'draft':
            return False

        # Actualizar estado del plan
        cursor.execute(f"""
            UPDATE plan_produccion
            SET estado = 'publicado', updated_at = CURRENT_TIMESTAMP
            WHERE id = {ph}
        """, (plan_id,))

        # Obtener items del plan para actualizar capacidad
        cursor.execute(f"""
            SELECT ppi.work_center_id, ppi.fecha_programada,
                   SUM(ppi.cantidad_planificada) as total_cantidad
            FROM plan_produccion_item ppi
            WHERE ppi.plan_id = {ph}
            GROUP BY ppi.work_center_id, ppi.fecha_programada
        """, (plan_id,))

        items_agrupados = cursor.fetchall()

        # Actualizar capacidad comprometida
        for item in items_agrupados:
            item_d = dict(item)
            cursor.execute(f"""
                UPDATE produccion_capacidad
                SET capacidad_comprometida = capacidad_comprometida + {ph}
                WHERE work_center_id = {ph} AND fecha = {ph}
            """, (item_d['total_cantidad'], item_d['work_center_id'], item_d['fecha_programada']))

            if cursor.rowcount == 0:
                cursor.execute(f"""
                    SELECT capacidad_diaria * turnos * eficiencia_pct / 100 as cap_disponible
                    FROM work_center
                    WHERE id = {ph}
                """, (item_d['work_center_id'],))
                wc = cursor.fetchone()
                cap_disponible = (wc['cap_disponible'] if isinstance(wc, dict) else wc[0]) if wc else 0

                cursor.execute(f"""
                    INSERT INTO produccion_capacidad
                    (work_center_id, fecha, capacidad_disponible, capacidad_comprometida)
                    VALUES ({ph}, {ph}, {ph}, {ph})
                """, (item_d['work_center_id'], item_d['fecha_programada'], cap_disponible, item_d['total_cantidad']))

        return True


def validar_capacidad(plan_id: int) -> Dict[str, Any]:
    """Validar que el plan no exceda capacidad disponible de work centers"""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(f"""
            SELECT ppi.work_center_id, ppi.fecha_programada,
                   wc.nombre as work_center_nombre,
                   wc.codigo as work_center_codigo,
                   wc.capacidad_diaria, wc.turnos, wc.eficiencia_pct,
                   SUM(ppi.cantidad_planificada) as total_planificado
            FROM plan_produccion_item ppi
            JOIN work_center wc ON ppi.work_center_id = wc.id
            WHERE ppi.plan_id = {ph}
            GROUP BY ppi.work_center_id, ppi.fecha_programada, wc.nombre, wc.codigo, wc.capacidad_diaria, wc.turnos, wc.eficiencia_pct
        """, (plan_id,))

        items_agrupados = cursor.fetchall()

        excesos = []
        total_capacidad_requerida = 0
        total_capacidad_disponible = 0

        for item in items_agrupados:
            item_d = dict(item)
            cap_disponible = (item_d.get('capacidad_diaria') or 0) * (item_d.get('turnos') or 1) * (item_d.get('eficiencia_pct') or 85) / 100

            cursor.execute(f"""
                SELECT COALESCE(capacidad_comprometida, 0) as comprometida
                FROM produccion_capacidad
                WHERE work_center_id = {ph} AND fecha = {ph}
            """, (item_d['work_center_id'], item_d['fecha_programada']))

            cap_row = cursor.fetchone()
            cap_comprometida = (cap_row['comprometida'] if isinstance(cap_row, dict) else cap_row[0]) if cap_row else 0

            cap_disponible_neta = cap_disponible - float(cap_comprometida)
            total_planificado = float(item_d['total_planificado'] or 0)

            total_capacidad_requerida += total_planificado
            total_capacidad_disponible += cap_disponible_neta

            if total_planificado > cap_disponible_neta:
                excesos.append({
                    'work_center_id': item_d['work_center_id'],
                    'work_center_nombre': item_d['work_center_nombre'],
                    'work_center_codigo': item_d['work_center_codigo'],
                    'fecha': str(item_d['fecha_programada']),
                    'capacidad_disponible': cap_disponible_neta,
                    'capacidad_requerida': total_planificado,
                    'exceso': total_planificado - cap_disponible_neta,
                    'exceso_pct': ((total_planificado - cap_disponible_neta) / cap_disponible_neta * 100) if cap_disponible_neta > 0 else 100
                })

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
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(f"""
            SELECT cantidad_planificada, cantidad_producida, work_center_id, fecha_programada
            FROM plan_produccion_item
            WHERE id = {ph}
        """, (item_id,))

        item = cursor.fetchone()
        if not item:
            return False

        item_d = dict(item)
        nueva_cantidad = float(item_d['cantidad_producida'] or 0) + cantidad_producida
        nueva_cantidad = min(nueva_cantidad, float(item_d['cantidad_planificada'] or 0))

        if nueva_cantidad >= float(item_d['cantidad_planificada'] or 0):
            nuevo_estado = 'completado'
        elif nueva_cantidad > 0:
            nuevo_estado = 'en_proceso'
        else:
            nuevo_estado = 'pendiente'

        params = [nueva_cantidad, nuevo_estado]
        update_query = f"UPDATE plan_produccion_item SET cantidad_producida = {ph}, estado = {ph}"

        if notas:
            update_query += f", notas = {ph}"
            params.append(notas)

        update_query += f" WHERE id = {ph}"
        params.append(item_id)

        cursor.execute(update_query, params)

        cursor.execute(f"""
            UPDATE produccion_capacidad
            SET capacidad_utilizada = capacidad_utilizada + {ph}
            WHERE work_center_id = {ph} AND fecha = {ph}
        """, (cantidad_producida, item_d['work_center_id'], item_d['fecha_programada']))

        return True


def completar_plan(plan_id: int) -> bool:
    """Marcar un plan como completado"""
    ph = _ph()
    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(f"""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN estado = 'completado' THEN 1 ELSE 0 END) as completados
            FROM plan_produccion_item
            WHERE plan_id = {ph}
        """, (plan_id,))

        stats = cursor.fetchone()
        stats_d = dict(stats) if stats else {}
        total = stats_d.get('total') or 0
        completados = stats_d.get('completados') or 0

        if total > 0 and total == completados:
            cursor.execute(f"""
                UPDATE plan_produccion
                SET estado = 'completado', updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph}
            """, (plan_id,))
            return True

        return False


def obtener_utilizacion(filtros: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Obtener utilizacion de capacidad por work center y periodo"""
    ph = _ph()
    with get_db_connection() as conn:
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
            query += f" AND pc.work_center_id = {ph}"
            params.append(filtros['work_center_id'])

        if filtros.get('fecha_desde'):
            query += f" AND pc.fecha >= {ph}"
            params.append(filtros['fecha_desde'])

        if filtros.get('fecha_hasta'):
            query += f" AND pc.fecha <= {ph}"
            params.append(filtros['fecha_hasta'])

        query += " ORDER BY pc.fecha, wc.codigo"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        return [dict(row) for row in rows]


def obtener_kpis() -> Dict[str, Any]:
    """Obtener KPIs de produccion"""
    # Use DB-compatible date expressions
    if is_using_postgresql():
        date_now = "CURRENT_DATE"
        date_7_ago = "CURRENT_DATE - INTERVAL '7 days'"
        date_cast = "ppi.created_at::date = CURRENT_DATE"
    else:
        date_now = "date('now')"
        date_7_ago = "date('now', '-7 days')"
        date_cast = "date(ppi.created_at) = date('now')"

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Planes activos
        cursor.execute("""
            SELECT COUNT(*) as total
            FROM plan_produccion
            WHERE estado IN ('publicado', 'en_ejecucion')
        """)
        row = cursor.fetchone()
        planes_activos = (row['total'] if isinstance(row, dict) else row[0]) if row else 0

        # Items retrasados (fecha programada pasada y no completados)
        cursor.execute(f"""
            SELECT COUNT(*) as total
            FROM plan_produccion_item ppi
            JOIN plan_produccion pp ON ppi.plan_id = pp.id
            WHERE pp.estado IN ('publicado', 'en_ejecucion')
              AND ppi.estado != 'completado'
              AND ppi.fecha_programada < {date_now}
        """)
        row = cursor.fetchone()
        items_retrasados = (row['total'] if isinstance(row, dict) else row[0]) if row else 0

        # Utilizacion promedio (ultimos 7 dias)
        cursor.execute(f"""
            SELECT AVG(
                CASE
                    WHEN capacidad_disponible > 0
                    THEN (capacidad_utilizada / capacidad_disponible * 100)
                    ELSE 0
                END
            ) as utilizacion_promedio
            FROM produccion_capacidad
            WHERE fecha >= {date_7_ago}
              AND fecha < {date_now}
        """)
        result = cursor.fetchone()
        utilizacion_promedio = 0
        if result:
            val = result['utilizacion_promedio'] if isinstance(result, dict) else result[0]
            utilizacion_promedio = val if val else 0

        # Work centers activos
        cursor.execute("SELECT COUNT(*) as total FROM work_center WHERE estado = 'active'")
        row = cursor.fetchone()
        work_centers_activos = (row['total'] if isinstance(row, dict) else row[0]) if row else 0

        # Items completados hoy
        cursor.execute(f"""
            SELECT COUNT(*) as total
            FROM plan_produccion_item ppi
            JOIN plan_produccion pp ON ppi.plan_id = pp.id
            WHERE ppi.estado = 'completado'
              AND {date_cast}
        """)
        row = cursor.fetchone()
        items_completados_hoy = (row['total'] if isinstance(row, dict) else row[0]) if row else 0

        return {
            'planes_activos': planes_activos,
            'items_retrasados': items_retrasados,
            'utilizacion_promedio': round(float(utilizacion_promedio), 1),
            'work_centers_activos': work_centers_activos,
            'items_completados_hoy': items_completados_hoy
        }
