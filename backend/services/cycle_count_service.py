"""
Servicio de Conteo Cíclico e Inventario Físico.
Proporciona funciones para programación de conteos, ejecución y ajustes de inventario.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def crear_programa(data: Dict[str, Any]) -> int:
    """
    Crea un programa de conteo cíclico.

    Args:
        data: Dict con nombre, tipo, almacen_id, frecuencia_a_dias,
              frecuencia_b_dias, frecuencia_c_dias

    Returns:
        int: ID del programa creado
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                INSERT INTO cycle_count_programa (
                    nombre, tipo, almacen_id, frecuencia_a_dias,
                    frecuencia_b_dias, frecuencia_c_dias
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
            """, (
                data['nombre'],
                data['tipo'],
                data.get('almacen_id'),
                data.get('frecuencia_a_dias', 30),
                data.get('frecuencia_b_dias', 90),
                data.get('frecuencia_c_dias', 180)
            ))

            if is_using_postgresql():
                cursor.execute("SELECT currval(pg_get_serial_sequence('cycle_count_programa', 'id'))")
                programa_id = cursor.fetchone()[0]
            else:
                programa_id = cursor.lastrowid

            conn.commit()
            logger.info(f"Programa de conteo creado: {programa_id} - {data['nombre']}")
            return programa_id

    except Exception as e:
        logger.error(f"Error al crear programa: {e}")
        raise


def obtener_programas() -> List[Dict[str, Any]]:
    """
    Obtiene todos los programas de conteo cíclico.

    Returns:
        Lista de programas
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT id, nombre, tipo, almacen_id, frecuencia_a_dias,
                       frecuencia_b_dias, frecuencia_c_dias, estado,
                       proximo_conteo, created_at
                FROM cycle_count_programa
                ORDER BY created_at DESC
            """)

            programas = []
            for row in cursor.fetchall():
                programas.append({
                    'id': row[0],
                    'nombre': row[1],
                    'tipo': row[2],
                    'almacen_id': row[3],
                    'freq_a_dias': row[4],
                    'freq_b_dias': row[5],
                    'freq_c_dias': row[6],
                    'estado': row[7],
                    'proximo_conteo': row[8].isoformat() if row[8] else None,
                    'created_at': row[9].isoformat() if row[9] else None
                })

            return programas

    except Exception as e:
        logger.error(f"Error al obtener programas: {e}")
        raise


def actualizar_programa(programa_id: int, data: Dict[str, Any]) -> bool:
    """
    Actualiza un programa de conteo cíclico.

    Args:
        programa_id: ID del programa
        data: Dict con campos a actualizar

    Returns:
        bool: True si se actualizó exitosamente
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # Build UPDATE clause dynamically
            updates = []
            params = []

            if 'nombre' in data:
                updates.append(f"nombre = {ph}")
                params.append(data['nombre'])

            if 'tipo' in data:
                updates.append(f"tipo = {ph}")
                params.append(data['tipo'])

            if 'almacen_id' in data:
                updates.append(f"almacen_id = {ph}")
                params.append(data['almacen_id'])

            if 'frecuencia_a_dias' in data:
                updates.append(f"frecuencia_a_dias = {ph}")
                params.append(data['frecuencia_a_dias'])

            if 'frecuencia_b_dias' in data:
                updates.append(f"frecuencia_b_dias = {ph}")
                params.append(data['frecuencia_b_dias'])

            if 'frecuencia_c_dias' in data:
                updates.append(f"frecuencia_c_dias = {ph}")
                params.append(data['frecuencia_c_dias'])

            if not updates:
                return False

            params.append(programa_id)

            cursor.execute(f"""
                UPDATE cycle_count_programa
                SET {', '.join(updates)}
                WHERE id = {ph}
            """, params)

            conn.commit()
            logger.info(f"Programa {programa_id} actualizado")
            return True

    except Exception as e:
        logger.error(f"Error al actualizar programa {programa_id}: {e}")
        raise


def generar_conteo(tipo: str, almacen_id: int, programa_id: Optional[int] = None,
                   asignado_a: Optional[int] = None) -> int:
    """
    Genera un nuevo conteo cíclico.

    Args:
        tipo: Tipo de conteo (abc_scheduled, spot, full_physical)
        almacen_id: ID del almacén
        programa_id: ID del programa (opcional)
        asignado_a: ID del usuario asignado (opcional)

    Returns:
        int: ID del conteo creado
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # Create cycle_count
            cursor.execute(f"""
                INSERT INTO cycle_count (
                    tipo, almacen_id, programa_id, asignado_a, estado
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
            """, (tipo, almacen_id, programa_id, asignado_a, 'planned'))

            if is_using_postgresql():
                cursor.execute("SELECT currval(pg_get_serial_sequence('cycle_count', 'id'))")
                count_id = cursor.fetchone()[0]
            else:
                count_id = cursor.lastrowid

            # Get materials based on tipo
            if tipo == 'abc_scheduled':
                # Get materials and classify by ABC
                cursor.execute(f"""
                    SELECT s.material_codigo, s.cantidad, s.unidad, s.precio_unitario
                    FROM stock s
                    WHERE s.almacen_id = {ph}
                      AND s.cantidad > 0
                """, (almacen_id,))

                materials_data = cursor.fetchall()

                # Calculate value and classify
                materials_with_value = []
                for mat in materials_data:
                    value = float(mat[1] or 0) * float(mat[3] or 0)
                    materials_with_value.append({
                        'codigo': mat[0],
                        'cantidad': mat[1],
                        'unidad': mat[2],
                        'value': value
                    })

                # Sort by value desc
                materials_with_value.sort(key=lambda x: x['value'], reverse=True)
                total_value = sum(m['value'] for m in materials_with_value)

                # Classify ABC
                cumulative = 0
                classified_materials = []
                for mat in materials_with_value:
                    cumulative += mat['value']
                    pct = (cumulative / total_value * 100) if total_value > 0 else 0

                    if pct <= 80:
                        categoria = 'A'
                    elif pct <= 95:
                        categoria = 'B'
                    else:
                        categoria = 'C'

                    mat['categoria_abc'] = categoria
                    classified_materials.append(mat)

                # Get frequency from programa
                freq_a = 30
                freq_b = 90
                freq_c = 180

                if programa_id:
                    cursor.execute(f"""
                        SELECT frecuencia_a_dias, frecuencia_b_dias, frecuencia_c_dias
                        FROM cycle_count_programa
                        WHERE id = {ph}
                    """, (programa_id,))
                    prog_row = cursor.fetchone()
                    if prog_row:
                        freq_a, freq_b, freq_c = prog_row

                # Select materials due for count
                fecha_limite_a = (datetime.now() - timedelta(days=freq_a)).date()
                fecha_limite_b = (datetime.now() - timedelta(days=freq_b)).date()
                fecha_limite_c = (datetime.now() - timedelta(days=freq_c)).date()

                selected_materials = []
                for mat in classified_materials:
                    # Check last count date
                    cursor.execute(f"""
                        SELECT MAX(fecha_cierre)
                        FROM cycle_count cc
                        JOIN cycle_count_item cci ON cci.count_id = cc.id
                        WHERE cci.material_codigo = {ph}
                          AND cc.almacen_id = {ph}
                          AND cc.estado = {ph}
                    """, (mat['codigo'], almacen_id, 'completed'))

                    last_count_row = cursor.fetchone()
                    last_count_date = last_count_row[0] if last_count_row and last_count_row[0] else None

                    should_count = False
                    if mat['categoria_abc'] == 'A':
                        should_count = (not last_count_date or last_count_date < fecha_limite_a)
                    elif mat['categoria_abc'] == 'B':
                        should_count = (not last_count_date or last_count_date < fecha_limite_b)
                    else:  # C
                        should_count = (not last_count_date or last_count_date < fecha_limite_c)

                    if should_count:
                        selected_materials.append(mat)

            elif tipo == 'spot':
                # Random 10% of materials
                cursor.execute(f"""
                    SELECT material_codigo, cantidad, unidad
                    FROM stock
                    WHERE almacen_id = {ph}
                      AND cantidad > 0
                    ORDER BY RANDOM()
                    LIMIT (SELECT CAST(COUNT(*) * 0.1 AS INTEGER) FROM stock WHERE almacen_id = {ph})
                """ if not is_using_postgresql() else f"""
                    SELECT material_codigo, cantidad, unidad
                    FROM stock
                    WHERE almacen_id = {ph}
                      AND cantidad > 0
                    ORDER BY RANDOM()
                    LIMIT (SELECT CAST(COUNT(*) * 0.1 AS INTEGER) FROM stock WHERE almacen_id = {ph})
                """, (almacen_id, almacen_id))

                selected_materials = [
                    {'codigo': row[0], 'cantidad': row[1], 'unidad': row[2]}
                    for row in cursor.fetchall()
                ]

            else:  # full_physical
                # All materials
                cursor.execute(f"""
                    SELECT material_codigo, cantidad, unidad
                    FROM stock
                    WHERE almacen_id = {ph}
                """, (almacen_id,))

                selected_materials = [
                    {'codigo': row[0], 'cantidad': row[1], 'unidad': row[2]}
                    for row in cursor.fetchall()
                ]

            # Create cycle_count_items
            for mat in selected_materials:
                cursor.execute(f"""
                    INSERT INTO cycle_count_item (
                        count_id, material_codigo, cantidad_sistema, estado
                    ) VALUES ({ph}, {ph}, {ph}, {ph})
                """, (
                    count_id,
                    mat['codigo'],
                    mat.get('cantidad', 0),
                    'pending'
                ))

            conn.commit()
            logger.info(f"Conteo {count_id} generado con {len(selected_materials)} items")
            return count_id

    except Exception as e:
        logger.error(f"Error al generar conteo: {e}")
        raise


def obtener_conteos(filtros: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Obtiene conteos con filtros y paginación.

    Args:
        filtros: Dict con estado, almacen_id, tipo, page, per_page

    Returns:
        Dict con items, total, page, per_page
    """
    try:
        filtros = filtros or {}
        ph = '%s' if is_using_postgresql() else '?'
        page = filtros.get('page', 1)
        per_page = filtros.get('per_page', 50)
        offset = (page - 1) * per_page

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Build WHERE clause
            conditions = []
            params = []

            if filtros.get('estado'):
                conditions.append(f"cc.estado = {ph}")
                params.append(filtros['estado'])

            if filtros.get('almacen_id'):
                conditions.append(f"cc.almacen_id = {ph}")
                params.append(filtros['almacen_id'])

            if filtros.get('tipo'):
                conditions.append(f"cc.tipo = {ph}")
                params.append(filtros['tipo'])

            where_clause = ' AND '.join(conditions) if conditions else '1=1'

            # Count total
            cursor.execute(f"SELECT COUNT(*) FROM cycle_count cc WHERE {where_clause}", params)
            total = cursor.fetchone()[0]

            # Get items
            cursor.execute(f"""
                SELECT cc.id, cc.tipo, cc.almacen_id, cc.programa_id, cc.asignado_a,
                       cc.estado, cc.fecha_planificada, cc.fecha_inicio, cc.fecha_cierre,
                       COUNT(cci.id) as total_items,
                       SUM(CASE WHEN cci.estado = 'counted' THEN 1 ELSE 0 END) as items_contados
                FROM cycle_count cc
                LEFT JOIN cycle_count_item cci ON cci.count_id = cc.id
                WHERE {where_clause}
                GROUP BY cc.id, cc.tipo, cc.almacen_id, cc.programa_id, cc.asignado_a,
                         cc.estado, cc.fecha_planificada, cc.fecha_inicio, cc.fecha_cierre, cc.created_at
                ORDER BY cc.created_at DESC
                LIMIT {ph} OFFSET {ph}
            """, params + [per_page, offset])

            items = []
            for row in cursor.fetchall():
                items.append({
                    'id': row[0],
                    'tipo': row[1],
                    'almacen_id': row[2],
                    'programa_id': row[3],
                    'asignado_a': row[4],
                    'estado': row[5],
                    'fecha_planificada': row[6].isoformat() if row[6] else None,
                    'fecha_inicio': row[7].isoformat() if row[7] else None,
                    'fecha_cierre': row[8].isoformat() if row[8] else None,
                    'items_count': row[9] or 0,
                    'items_contados': row[10] or 0
                })

            return {
                'items': items,
                'total': total,
                'page': page,
                'per_page': per_page
            }

    except Exception as e:
        logger.error(f"Error al obtener conteos: {e}")
        raise


def obtener_detalle_conteo(count_id: int) -> Optional[Dict[str, Any]]:
    """
    Obtiene detalle completo de un conteo.

    Args:
        count_id: ID del conteo

    Returns:
        Dict con datos del conteo e items
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get conteo
            cursor.execute(f"""
                SELECT id, tipo, almacen_id, programa_id, asignado_a, estado,
                       fecha_inicio, fecha_cierre, created_at
                FROM cycle_count
                WHERE id = {ph}
            """, (count_id,))

            row = cursor.fetchone()
            if not row:
                return None

            conteo = {
                'id': row[0],
                'tipo': row[1],
                'almacen_id': row[2],
                'programa_id': row[3],
                'asignado_a': row[4],
                'estado': row[5],
                'fecha_inicio': row[6].isoformat() if row[6] else None,
                'fecha_cierre': row[7].isoformat() if row[7] else None,
                'created_at': row[8].isoformat() if row[8] else None
            }

            # Get items
            cursor.execute(f"""
                SELECT id, material_codigo, cantidad_sistema, cantidad_contada,
                       varianza, varianza_pct, estado, contado_por, fecha_conteo
                FROM cycle_count_item
                WHERE count_id = {ph}
                ORDER BY material_codigo
            """, (count_id,))

            items = []
            stats = {
                'counted': 0,
                'pending': 0,
                'with_variance': 0
            }

            for item_row in cursor.fetchall():
                item = {
                    'id': item_row[0],
                    'material_codigo': item_row[1],
                    'cantidad_sistema': float(item_row[2]) if item_row[2] is not None else 0,
                    'cantidad_contada': float(item_row[3]) if item_row[3] is not None else None,
                    'varianza': float(item_row[4]) if item_row[4] is not None else None,
                    'varianza_pct': float(item_row[5]) if item_row[5] is not None else None,
                    'estado': item_row[6],
                    'contado_por': item_row[7],
                    'fecha_conteo': item_row[8].isoformat() if item_row[8] else None,
                    'categoria_abc': None
                }
                items.append(item)

                # Update stats
                if item['estado'] == 'counted':
                    stats['counted'] += 1
                    if item['varianza'] and item['varianza'] != 0:
                        stats['with_variance'] += 1
                else:
                    stats['pending'] += 1

            conteo['items'] = items
            conteo['stats'] = stats
            return conteo

    except Exception as e:
        logger.error(f"Error al obtener detalle de conteo {count_id}: {e}")
        raise


def iniciar_conteo(count_id: int) -> bool:
    """
    Inicia un conteo cíclico.

    Args:
        count_id: ID del conteo

    Returns:
        bool: True si se inició exitosamente
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE cycle_count
                SET estado = {ph}, fecha_inicio = {ph}
                WHERE id = {ph}
            """, ('in_progress', datetime.now(), count_id))

            conn.commit()
            logger.info(f"Conteo {count_id} iniciado")
            return True

    except Exception as e:
        logger.error(f"Error al iniciar conteo {count_id}: {e}")
        raise


def registrar_conteo_item(count_id: int, item_id: int, cantidad_contada: float,
                         contado_por: int) -> bool:
    """
    Registra el conteo de un item.

    Args:
        count_id: ID del conteo
        item_id: ID del item
        cantidad_contada: Cantidad contada físicamente
        contado_por: ID del usuario que contó

    Returns:
        bool: True si se registró exitosamente
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # Get cantidad_sistema
            cursor.execute(f"""
                SELECT cantidad_sistema
                FROM cycle_count_item
                WHERE id = {ph} AND count_id = {ph}
            """, (item_id, count_id))

            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Item {item_id} no encontrado en conteo {count_id}")

            cantidad_sistema = float(row[0]) if row[0] is not None else 0

            # Calculate variance
            varianza = cantidad_contada - cantidad_sistema
            varianza_pct = (varianza / cantidad_sistema * 100) if cantidad_sistema != 0 else 0

            # Update item
            cursor.execute(f"""
                UPDATE cycle_count_item
                SET cantidad_contada = {ph}, varianza = {ph}, varianza_pct = {ph},
                    estado = {ph}, contado_por = {ph}, fecha_conteo = {ph}
                WHERE id = {ph}
            """, (cantidad_contada, varianza, varianza_pct, 'counted', contado_por,
                  datetime.now(), item_id))

            conn.commit()
            logger.info(f"Item {item_id} contado: sistema={cantidad_sistema}, contado={cantidad_contada}, varianza={varianza}")
            return True

    except Exception as e:
        logger.error(f"Error al registrar conteo de item {item_id}: {e}")
        raise


def completar_conteo(count_id: int) -> bool:
    """
    Completa un conteo y genera ajustes para varianzas.

    Args:
        count_id: ID del conteo

    Returns:
        bool: True si se completó exitosamente
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            # Update conteo
            cursor.execute(f"""
                UPDATE cycle_count
                SET estado = {ph}, fecha_cierre = {ph}
                WHERE id = {ph}
            """, ('completed', datetime.now(), count_id))

            # Get items with variance
            cursor.execute(f"""
                SELECT id, material_codigo, cantidad_sistema, cantidad_contada,
                       varianza, contado_por
                FROM cycle_count_item
                WHERE count_id = {ph}
                  AND estado = {ph}
                  AND varianza IS NOT NULL
                  AND varianza != 0
            """, (count_id, 'counted'))

            items_with_variance = cursor.fetchall()

            # Create ajuste_inventario for each variance
            for item_row in items_with_variance:
                item_id = item_row[0]
                material_codigo = item_row[1]
                cantidad_sistema = item_row[2]
                cantidad_contada = item_row[3]
                varianza = item_row[4]
                contado_por = item_row[5]

                cursor.execute(f"""
                    INSERT INTO ajuste_inventario (
                        count_item_id, material_codigo, cantidad_sistema,
                        cantidad_contada, varianza, razon, estado, creado_por
                    ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                """, (
                    item_id,
                    material_codigo,
                    cantidad_sistema,
                    cantidad_contada,
                    varianza,
                    f"Ajuste por conteo cíclico #{count_id}",
                    'pending',
                    contado_por
                ))

            conn.commit()
            logger.info(f"Conteo {count_id} completado con {len(items_with_variance)} ajustes")
            return True

    except Exception as e:
        logger.error(f"Error al completar conteo {count_id}: {e}")
        raise


def aprobar_ajuste(ajuste_id: int, aprobado_por: int) -> bool:
    """
    Aprueba un ajuste de inventario.

    Args:
        ajuste_id: ID del ajuste
        aprobado_por: ID del usuario que aprueba

    Returns:
        bool: True si se aprobó exitosamente
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE ajuste_inventario
                SET estado = {ph}, aprobado_por = {ph}, fecha_aprobacion = {ph}
                WHERE id = {ph}
            """, ('approved', aprobado_por, datetime.now(), ajuste_id))

            # TODO: Optionally update actual stock table
            # This would require getting material_codigo and varianza, then:
            # UPDATE stock SET cantidad = cantidad + varianza WHERE material_codigo = ...

            conn.commit()
            logger.info(f"Ajuste {ajuste_id} aprobado por usuario {aprobado_por}")
            return True

    except Exception as e:
        logger.error(f"Error al aprobar ajuste {ajuste_id}: {e}")
        raise


def obtener_kpis() -> Dict[str, Any]:
    """
    Obtiene KPIs del sistema de conteo cíclico.

    Returns:
        Dict con accuracy_rate, conteos_pendientes, varianza_total_abs, ajustes_pendientes
    """
    try:
        ph = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Accuracy rate (% items with variance < 5%)
            cursor.execute(f"""
                SELECT
                    COUNT(*) as total_items,
                    SUM(CASE WHEN ABS(varianza_pct) < 5 THEN 1 ELSE 0 END) as accurate_items
                FROM cycle_count_item
                WHERE estado = {ph}
                  AND varianza_pct IS NOT NULL
            """, ('counted',))

            row = cursor.fetchone()
            total_items = row[0] or 0
            accurate_items = row[1] or 0
            accuracy_rate = (accurate_items / total_items * 100) if total_items > 0 else 0

            # Conteos pendientes
            cursor.execute(f"""
                SELECT COUNT(*) FROM cycle_count
                WHERE estado IN ({ph}, {ph})
            """, ('planned', 'in_progress'))
            conteos_pendientes = cursor.fetchone()[0] or 0

            # Varianza total absoluta
            cursor.execute(f"""
                SELECT SUM(ABS(varianza))
                FROM cycle_count_item
                WHERE estado = {ph}
                  AND varianza IS NOT NULL
            """, ('counted',))
            varianza_total_abs = float(cursor.fetchone()[0] or 0)

            # Ajustes pendientes (ajuste_inventario no tiene columna estado)
            cursor.execute("""
                SELECT COUNT(*) FROM ajuste_inventario
                WHERE aprobado_por IS NULL
            """)
            ajustes_pendientes = cursor.fetchone()[0] or 0

            return {
                'accuracy_rate': round(accuracy_rate, 2),
                'conteos_pendientes': conteos_pendientes,
                'varianza_total': round(varianza_total_abs, 2),
                'ajustes_pendientes': ajustes_pendientes
            }

    except Exception as e:
        logger.error(f"Error al obtener KPIs: {e}")
        raise
