"""
Servicio de operaciones de almacén (recepción y putaway).

Este módulo gestiona las operaciones de warehouse: docks de recepción,
asignación de vehículos, tiempos de descarga y tareas de putaway.
"""

from datetime import datetime
from typing import Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql


def obtener_docks(almacen: Optional[str] = None) -> list:
    """
    Lista todos los docks de recepción con filtro opcional por almacén.

    Args:
        almacen: Código de almacén para filtrar (opcional)

    Returns:
        List de dicts con estructura [{id, numero_dock, almacen, estado, capacidad_pallets}]
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        if almacen:
            cur.execute("""
                SELECT id, numero_dock, almacen, estado, capacidad_pallets,
                       created_at, updated_at
                FROM dock_recepcion
                WHERE almacen = ?
                ORDER BY numero_dock
            """ if not is_using_postgresql() else """
                SELECT id, numero_dock, almacen, estado, capacidad_pallets,
                       created_at, updated_at
                FROM dock_recepcion
                WHERE almacen = %s
                ORDER BY numero_dock
            """, (almacen,))
        else:
            cur.execute("""
                SELECT id, numero_dock, almacen, estado, capacidad_pallets,
                       created_at, updated_at
                FROM dock_recepcion
                ORDER BY almacen, numero_dock
            """)

        rows = cur.fetchall()
        return [dict(row) for row in rows]
    finally:
        cur.close()
        conn.close()


def crear_dock(data: dict) -> int:
    """
    Crea un nuevo dock de recepción.

    Args:
        data: Dict con {numero_dock, almacen, capacidad_pallets, estado='available'}

    Returns:
        ID del dock creado
    """
    conn, cur = get_db_transaction()

    try:
        estado = data.get('estado', 'available')

        if is_using_postgresql():
            cur.execute("""
                INSERT INTO dock_recepcion (numero_dock, almacen, estado, capacidad_pallets)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (data['numero_dock'], data['almacen'], estado, data['capacidad_pallets']))
            dock_id = cur.fetchone()[0]
        else:
            cur.execute("""
                INSERT INTO dock_recepcion (numero_dock, almacen, estado, capacidad_pallets)
                VALUES (?, ?, ?, ?)
            """, (data['numero_dock'], data['almacen'], estado, data['capacidad_pallets']))
            dock_id = cur.lastrowid

        conn.commit()
        return dock_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def asignar_dock(dock_id: int, recepcion_id: int, user_id: int) -> dict:
    """
    Asigna un dock a una recepción.

    Verifica que el dock esté disponible, lo marca como ocupado y
    crea el registro de asignación.

    Args:
        dock_id: ID del dock a asignar
        recepcion_id: ID de la orden de compra/recepción
        user_id: ID del usuario que asigna

    Returns:
        Dict con los datos de la asignación

    Raises:
        ValueError: Si el dock no está disponible
    """
    conn, cur = get_db_transaction()

    try:
        # Verificar estado del dock
        cur.execute("""
            SELECT estado FROM dock_recepcion WHERE id = ?
        """ if not is_using_postgresql() else """
            SELECT estado FROM dock_recepcion WHERE id = %s
        """, (dock_id,))

        row = cur.fetchone()
        if not row or row[0] != 'available':
            raise ValueError(f"Dock {dock_id} no está disponible")

        # Marcar dock como ocupado
        if is_using_postgresql():
            cur.execute("""
                UPDATE dock_recepcion
                SET estado = 'occupied', updated_at = NOW()
                WHERE id = %s
            """, (dock_id,))
        else:
            cur.execute("""
                UPDATE dock_recepcion
                SET estado = 'occupied', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (dock_id,))

        # Crear registro de asignación
        if is_using_postgresql():
            cur.execute("""
                INSERT INTO recepcion_dock (dock_id, recepcion_id, hora_llegada, asignado_por)
                VALUES (%s, %s, NOW(), %s)
                RETURNING id, hora_llegada
            """, (dock_id, recepcion_id, user_id))
            assignment_id, hora_llegada = cur.fetchone()
        else:
            cur.execute("""
                INSERT INTO recepcion_dock (dock_id, recepcion_id, hora_llegada, asignado_por)
                VALUES (?, ?, CURRENT_TIMESTAMP, ?)
            """, (dock_id, recepcion_id, user_id))
            assignment_id = cur.lastrowid
            hora_llegada = datetime.now()

        conn.commit()

        return {
            'id': assignment_id,
            'dock_id': dock_id,
            'recepcion_id': recepcion_id,
            'hora_llegada': hora_llegada,
            'asignado_por': user_id
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def registrar_tiempos_dock(dock_id: int, data: dict) -> dict:
    """
    Registra tiempos de descarga en un dock.

    Args:
        dock_id: ID del dock
        data: Dict con {hora_inicio_descarga?, hora_fin_descarga?}

    Returns:
        Dict con el registro actualizado
    """
    conn, cur = get_db_transaction()

    try:
        updates = []
        values = []

        if 'hora_inicio_descarga' in data:
            updates.append("hora_inicio_descarga = ?" if not is_using_postgresql() else "hora_inicio_descarga = %s")
            values.append(data['hora_inicio_descarga'])

        if 'hora_fin_descarga' in data:
            updates.append("hora_fin_descarga = ?" if not is_using_postgresql() else "hora_fin_descarga = %s")
            values.append(data['hora_fin_descarga'])

        if not updates:
            raise ValueError("No hay tiempos para registrar")

        updates.append("updated_at = CURRENT_TIMESTAMP" if not is_using_postgresql() else "updated_at = NOW()")
        values.append(dock_id)

        # Actualizar recepcion_dock
        cur.execute(f"""
            UPDATE recepcion_dock
            SET {', '.join(updates)}
            WHERE dock_id = {"?" if not is_using_postgresql() else "%s"}
              AND hora_fin_descarga IS NULL
        """, values)

        # Si se completó la descarga, liberar el dock
        if 'hora_fin_descarga' in data:
            if is_using_postgresql():
                cur.execute("""
                    UPDATE dock_recepcion
                    SET estado = 'available', updated_at = NOW()
                    WHERE id = %s
                """, (dock_id,))
            else:
                cur.execute("""
                    UPDATE dock_recepcion
                    SET estado = 'available', updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (dock_id,))

        # Obtener registro actualizado
        cur.execute("""
            SELECT * FROM recepcion_dock
            WHERE dock_id = ?
            ORDER BY hora_llegada DESC
            LIMIT 1
        """ if not is_using_postgresql() else """
            SELECT * FROM recepcion_dock
            WHERE dock_id = %s
            ORDER BY hora_llegada DESC
            LIMIT 1
        """, (dock_id,))

        row = cur.fetchone()
        conn.commit()

        return dict(row) if row else {}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def generar_tareas_putaway(recepcion_id: int) -> list:
    """
    Genera automáticamente tareas de putaway para una recepción.

    Args:
        recepcion_id: ID de la orden de compra/recepción

    Returns:
        Lista de IDs de tareas creadas
    """
    conn, cur = get_db_transaction()

    try:
        # Obtener items de la recepción (asumiendo tabla orden_compra_item)
        cur.execute("""
            SELECT oci.material_codigo, oci.cantidad, oc.almacen
            FROM orden_compra_item oci
            JOIN orden_compra oc ON oci.orden_compra_id = oc.id
            WHERE oc.id = ?
        """ if not is_using_postgresql() else """
            SELECT oci.material_codigo, oci.cantidad, oc.almacen
            FROM orden_compra_item oci
            JOIN orden_compra oc ON oci.orden_compra_id = oc.id
            WHERE oc.id = %s
        """, (recepcion_id,))

        items = cur.fetchall()
        task_ids = []

        for item in items:
            material_codigo, cantidad, almacen = item

            # Auto-asignar prioridad según cantidad (lógica simple)
            prioridad = 'alta' if cantidad > 1000 else 'media' if cantidad > 100 else 'baja'

            if is_using_postgresql():
                cur.execute("""
                    INSERT INTO putaway_tarea (recepcion_id, material_codigo, cantidad,
                                              almacen, prioridad, estado)
                    VALUES (%s, %s, %s, %s, %s, 'pendiente')
                    RETURNING id
                """, (recepcion_id, material_codigo, cantidad, almacen, prioridad))
                task_id = cur.fetchone()[0]
            else:
                cur.execute("""
                    INSERT INTO putaway_tarea (recepcion_id, material_codigo, cantidad,
                                              almacen, prioridad, estado)
                    VALUES (?, ?, ?, ?, ?, 'pendiente')
                """, (recepcion_id, material_codigo, cantidad, almacen, prioridad))
                task_id = cur.lastrowid

            task_ids.append(task_id)

        conn.commit()
        return task_ids
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_tareas_putaway(filtros: dict) -> dict:
    """
    Obtiene tareas de putaway con paginación y filtros.

    Args:
        filtros: Dict con {estado?, almacen?, prioridad?, asignado_a?, page=1, per_page=20}

    Returns:
        Dict con {items, total, page, pages}
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        page = filtros.get('page', 1)
        per_page = min(filtros.get('per_page', 20), 100)
        offset = (page - 1) * per_page

        # Construir WHERE clause
        where_clauses = []
        params = []

        if filtros.get('estado'):
            where_clauses.append("estado = ?" if not is_using_postgresql() else "estado = %s")
            params.append(filtros['estado'])

        if filtros.get('almacen'):
            where_clauses.append("almacen = ?" if not is_using_postgresql() else "almacen = %s")
            params.append(filtros['almacen'])

        if filtros.get('prioridad'):
            where_clauses.append("prioridad = ?" if not is_using_postgresql() else "prioridad = %s")
            params.append(filtros['prioridad'])

        if filtros.get('asignado_a'):
            where_clauses.append("asignado_a = ?" if not is_using_postgresql() else "asignado_a = %s")
            params.append(filtros['asignado_a'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        # Count total
        cur.execute(f"""
            SELECT COUNT(*) FROM putaway_tarea {where_sql}
        """, params)
        total = cur.fetchone()[0]

        # Get paginated items
        params_with_limit = params + [per_page, offset]
        cur.execute(f"""
            SELECT * FROM putaway_tarea
            {where_sql}
            ORDER BY
                CASE prioridad
                    WHEN 'alta' THEN 1
                    WHEN 'media' THEN 2
                    WHEN 'baja' THEN 3
                END,
                created_at DESC
            LIMIT {"?" if not is_using_postgresql() else "%s"}
            OFFSET {"?" if not is_using_postgresql() else "%s"}
        """, params_with_limit)

        rows = cur.fetchall()
        items = [dict(row) for row in rows]

        pages = (total + per_page - 1) // per_page

        return {
            'items': items,
            'total': total,
            'page': page,
            'pages': pages,
            'per_page': per_page
        }
    finally:
        cur.close()
        conn.close()


def completar_putaway(tarea_id: int, user_id: int) -> dict:
    """
    Marca una tarea de putaway como completada.

    Args:
        tarea_id: ID de la tarea
        user_id: ID del usuario que completa

    Returns:
        Dict con la tarea actualizada
    """
    conn, cur = get_db_transaction()

    try:
        if is_using_postgresql():
            cur.execute("""
                UPDATE putaway_tarea
                SET estado = 'completed',
                    completado_por = %s,
                    fecha_completado = NOW(),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
            """, (user_id, tarea_id))
            row = cur.fetchone()
        else:
            cur.execute("""
                UPDATE putaway_tarea
                SET estado = 'completed',
                    completado_por = ?,
                    fecha_completado = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (user_id, tarea_id))

            cur.execute("SELECT * FROM putaway_tarea WHERE id = ?", (tarea_id,))
            row = cur.fetchone()

        conn.commit()

        return dict(row) if row else {}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_kpis_warehouse() -> dict:
    """
    Calcula KPIs del warehouse.

    Returns:
        Dict con {docks_disponibles, docks_ocupados, tareas_pendientes,
                 tareas_completadas_hoy, tiempo_promedio_descarga_min}
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Docks disponibles/ocupados
        cur.execute("""
            SELECT estado, COUNT(*) FROM dock_recepcion GROUP BY estado
        """)
        dock_stats = {row[0]: row[1] for row in cur.fetchall()}

        # Tareas pendientes
        cur.execute("""
            SELECT COUNT(*) FROM putaway_tarea WHERE estado = 'pendiente'
        """)
        tareas_pendientes = cur.fetchone()[0]

        # Tareas completadas hoy
        cur.execute("""
            SELECT COUNT(*) FROM putaway_tarea
            WHERE estado = 'completed'
              AND DATE(fecha_completado) = CURRENT_DATE
        """ if is_using_postgresql() else """
            SELECT COUNT(*) FROM putaway_tarea
            WHERE estado = 'completed'
              AND DATE(fecha_completado) = DATE('now')
        """)
        tareas_completadas_hoy = cur.fetchone()[0]

        # Tiempo promedio descarga (en minutos)
        cur.execute("""
            SELECT AVG(
                EXTRACT(EPOCH FROM (hora_fin_descarga - hora_inicio_descarga)) / 60
            )
            FROM recepcion_dock
            WHERE hora_fin_descarga IS NOT NULL
              AND hora_inicio_descarga IS NOT NULL
              AND DATE(hora_fin_descarga) >= CURRENT_DATE - INTERVAL '30 days'
        """ if is_using_postgresql() else """
            SELECT AVG(
                (julianday(hora_fin_descarga) - julianday(hora_inicio_descarga)) * 24 * 60
            )
            FROM recepcion_dock
            WHERE hora_fin_descarga IS NOT NULL
              AND hora_inicio_descarga IS NOT NULL
              AND DATE(hora_fin_descarga) >= DATE('now', '-30 days')
        """)
        tiempo_promedio = cur.fetchone()[0] or 0

        return {
            'docks_disponibles': dock_stats.get('available', 0),
            'docks_ocupados': dock_stats.get('occupied', 0),
            'tareas_pendientes': tareas_pendientes,
            'tareas_completadas_hoy': tareas_completadas_hoy,
            'tiempo_promedio_descarga_min': round(tiempo_promedio, 2)
        }
    finally:
        cur.close()
        conn.close()
