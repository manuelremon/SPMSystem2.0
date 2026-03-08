"""
Servicio de optimización de inventario multi-ubicación.

Este módulo gestiona la detección de desbalances de stock entre almacenes,
propuestas de transferencias y cálculo de niveles de servicio.
"""

import math
from datetime import datetime
from typing import Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql


def detectar_desbalances() -> list:
    """
    Detecta desbalances de inventario entre almacenes.

    Encuentra materiales donde un almacén tiene exceso (>2x safety stock)
    y otro tiene déficit (<safety stock).

    Returns:
        List de dicts con [{material_codigo, almacen_exceso, almacen_deficit,
                          qty_exceso, qty_deficit}]
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Obtener niveles de servicio y stock actual
        cur.execute("""
            SELECT
                ns.material_codigo,
                ns.almacen,
                ns.stock_seguridad_calculado,
                COALESCE(s.stock, 0) as stock_actual
            FROM nivel_servicio_objetivo ns
            LEFT JOIN stock s ON ns.material_codigo = s.material
                              AND ns.almacen = s.centro
            WHERE ns.stock_seguridad_calculado > 0
        """)

        stock_data = {}
        for row in cur.fetchall():
            material = row[0]
            almacen = row[1]
            safety_stock = float(row[2])
            stock_actual = float(row[3])

            if material not in stock_data:
                stock_data[material] = {}

            stock_data[material][almacen] = {
                'safety_stock': safety_stock,
                'stock_actual': stock_actual,
                'ratio': stock_actual / safety_stock if safety_stock > 0 else 0
            }

        # Detectar desbalances
        desbalances = []

        for material, almacenes in stock_data.items():
            if len(almacenes) < 2:
                continue

            # Encontrar almacén con exceso y déficit
            for almacen_exc, data_exc in almacenes.items():
                if data_exc['ratio'] > 2:  # Exceso: más de 2x safety stock
                    for almacen_def, data_def in almacenes.items():
                        if almacen_def != almacen_exc and data_def['ratio'] < 1:  # Déficit
                            qty_exceso = data_exc['stock_actual'] - data_exc['safety_stock']
                            qty_deficit = data_def['safety_stock'] - data_def['stock_actual']

                            desbalances.append({
                                'material_codigo': material,
                                'almacen_exceso': almacen_exc,
                                'almacen_deficit': almacen_def,
                                'qty_exceso': round(qty_exceso, 2),
                                'qty_deficit': round(qty_deficit, 2)
                            })

        return desbalances
    finally:
        cur.close()
        conn.close()


def proponer_transferencias(desbalances: Optional[list] = None) -> list:
    """
    Propone transferencias de inventario basadas en desbalances.

    Args:
        desbalances: Lista de desbalances (si None, detecta automáticamente)

    Returns:
        Lista de IDs de transferencias creadas
    """
    if desbalances is None:
        desbalances = detectar_desbalances()

    conn, cur = get_db_transaction()

    try:
        transferencia_ids = []

        for desbalance in desbalances:
            # Calcular cantidad a transferir (el menor entre exceso y déficit)
            cantidad = min(desbalance['qty_exceso'], desbalance['qty_deficit'])

            if cantidad <= 0:
                continue

            # Generar número de transferencia
            if is_using_postgresql():
                cur.execute("""
                    SELECT COUNT(*) FROM transferencia_inventario
                    WHERE DATE(created_at) = CURRENT_DATE
                """)
            else:
                cur.execute("""
                    SELECT COUNT(*) FROM transferencia_inventario
                    WHERE DATE(created_at) = DATE('now')
                """)

            count = cur.fetchone()[0] + 1
            numero_transferencia = f"TRF-{datetime.now().strftime('%Y%m%d')}-{count:04d}"

            # Crear transferencia
            if is_using_postgresql():
                cur.execute("""
                    INSERT INTO transferencia_inventario
                        (numero_transferencia, material_codigo, almacen_origen,
                         almacen_destino, cantidad, estado, tipo_transferencia)
                    VALUES (%s, %s, %s, %s, %s, 'proposed', 'balanceo')
                    RETURNING id
                """, (numero_transferencia, desbalance['material_codigo'],
                      desbalance['almacen_exceso'], desbalance['almacen_deficit'],
                      cantidad))
                transferencia_id = cur.fetchone()[0]
            else:
                cur.execute("""
                    INSERT INTO transferencia_inventario
                        (numero_transferencia, material_codigo, almacen_origen,
                         almacen_destino, cantidad, estado, tipo_transferencia)
                    VALUES (?, ?, ?, ?, ?, 'proposed', 'balanceo')
                """, (numero_transferencia, desbalance['material_codigo'],
                      desbalance['almacen_exceso'], desbalance['almacen_deficit'],
                      cantidad))
                transferencia_id = cur.lastrowid

            transferencia_ids.append(transferencia_id)

        conn.commit()
        return transferencia_ids
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_transferencias(filtros: dict) -> dict:
    """
    Obtiene transferencias de inventario con paginación.

    Args:
        filtros: Dict con {estado?, material_codigo?, almacen?, page=1, per_page=20}

    Returns:
        Dict con {items, total, page, pages}
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        page = filtros.get('page', 1)
        per_page = min(filtros.get('per_page', 20), 100)
        offset = (page - 1) * per_page

        where_clauses = []
        params = []

        if filtros.get('estado'):
            where_clauses.append("estado = ?" if not is_using_postgresql() else "estado = %s")
            params.append(filtros['estado'])

        if filtros.get('material_codigo'):
            where_clauses.append("material_codigo = ?" if not is_using_postgresql() else "material_codigo = %s")
            params.append(filtros['material_codigo'])

        if filtros.get('almacen'):
            where_clauses.append(
                "(almacen_origen = ? OR almacen_destino = ?)" if not is_using_postgresql()
                else "(almacen_origen = %s OR almacen_destino = %s)"
            )
            params.extend([filtros['almacen'], filtros['almacen']])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cur.execute(f"""
            SELECT COUNT(*) FROM transferencia_inventario {where_sql}
        """, params)
        total = cur.fetchone()[0]

        params_with_limit = params + [per_page, offset]
        cur.execute(f"""
            SELECT * FROM transferencia_inventario
            {where_sql}
            ORDER BY created_at DESC
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


def aprobar_transferencia(transferencia_id: int, user_id: int) -> dict:
    """
    Aprueba una transferencia de inventario.

    Args:
        transferencia_id: ID de la transferencia
        user_id: ID del usuario que aprueba

    Returns:
        Dict con la transferencia actualizada
    """
    conn, cur = get_db_transaction()

    try:
        if is_using_postgresql():
            cur.execute("""
                UPDATE transferencia_inventario
                SET estado = 'approved',
                    aprobado_por = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
            """, (user_id, transferencia_id))
            row = cur.fetchone()
        else:
            cur.execute("""
                UPDATE transferencia_inventario
                SET estado = 'approved',
                    aprobado_por = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (user_id, transferencia_id))

            cur.execute("SELECT * FROM transferencia_inventario WHERE id = ?", (transferencia_id,))
            row = cur.fetchone()

        conn.commit()

        return dict(row) if row else {}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def completar_transferencia(transferencia_id: int, user_id: int) -> dict:
    """
    Marca una transferencia como recibida/completada.

    Args:
        transferencia_id: ID de la transferencia
        user_id: ID del usuario que completa

    Returns:
        Dict con la transferencia actualizada
    """
    conn, cur = get_db_transaction()

    try:
        if is_using_postgresql():
            cur.execute("""
                UPDATE transferencia_inventario
                SET estado = 'received',
                    fecha_recepcion = NOW(),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
            """, (transferencia_id,))
            row = cur.fetchone()
        else:
            cur.execute("""
                UPDATE transferencia_inventario
                SET estado = 'received',
                    fecha_recepcion = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (transferencia_id,))

            cur.execute("SELECT * FROM transferencia_inventario WHERE id = ?", (transferencia_id,))
            row = cur.fetchone()

        conn.commit()

        return dict(row) if row else {}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def calcular_niveles_servicio(material_codigo: str, almacen: str) -> dict:
    """
    Calcula niveles de servicio para un material en un almacén.

    Usa la fórmula: Safety Stock = Z * σ * √L
    Donde Z = factor de servicio, σ = desviación estándar de demanda, L = lead time

    Args:
        material_codigo: Código del material
        almacen: Código del almacén

    Returns:
        Dict con {safety_stock, reorder_point, service_level}
    """
    conn, cur = get_db_transaction()

    try:
        # Obtener histórico de consumo (últimos 90 días)
        cur.execute("""
            SELECT cantidad, fecha_consumo
            FROM consumo_historico
            WHERE codigo = ?
              AND almacen = ?
              AND DATE(fecha_consumo) >= ?
            ORDER BY fecha_consumo
        """ if not is_using_postgresql() else """
            SELECT cantidad, fecha_consumo
            FROM consumo_historico
            WHERE codigo = %s
              AND almacen = %s
              AND DATE(fecha_consumo) >= CURRENT_DATE - INTERVAL '90 days'
            ORDER BY fecha_consumo
        """, (material_codigo, almacen) if is_using_postgresql()
             else (material_codigo, almacen, (datetime.now().date() - datetime.timedelta(days=90)).isoformat()))

        consumos = [float(row[0]) for row in cur.fetchall()]

        if len(consumos) < 10:
            # No hay suficientes datos
            return {
                'safety_stock': 0,
                'reorder_point': 0,
                'service_level': 0,
                'error': 'Datos insuficientes'
            }

        # Calcular estadísticas
        promedio = sum(consumos) / len(consumos)
        varianza = sum((x - promedio) ** 2 for x in consumos) / len(consumos)
        desviacion = math.sqrt(varianza)

        # Parámetros por defecto
        service_level = 95  # 95% service level
        z_score = 1.65  # Para 95% service level
        lead_time_days = 7  # Asumimos 7 días de lead time

        # Calcular safety stock
        safety_stock = z_score * desviacion * math.sqrt(lead_time_days)

        # Reorder point = demanda promedio durante lead time + safety stock
        reorder_point = (promedio * lead_time_days) + safety_stock

        # Upsert nivel_servicio_objetivo using actual schema columns
        cur.execute("""
            INSERT INTO nivel_servicio_objetivo
                (material_codigo, almacen, nivel_servicio,
                 stock_seguridad_calculado, punto_reorden_calculado,
                 ultimo_calculo, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (material_codigo, almacen)
            DO UPDATE SET
                nivel_servicio = EXCLUDED.nivel_servicio,
                stock_seguridad_calculado = EXCLUDED.stock_seguridad_calculado,
                punto_reorden_calculado = EXCLUDED.punto_reorden_calculado,
                ultimo_calculo = NOW(),
                updated_at = NOW()
        """, (material_codigo, almacen, service_level, safety_stock, reorder_point))

        conn.commit()

        return {
            'material_codigo': material_codigo,
            'almacen': almacen,
            'safety_stock': round(safety_stock, 2),
            'reorder_point': round(reorder_point, 2),
            'service_level': service_level,
            'demanda_promedio': round(promedio, 2),
            'desviacion_estandar': round(desviacion, 2)
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_niveles_servicio(filtros: dict) -> dict:
    """
    Obtiene niveles de servicio con paginación.

    Args:
        filtros: Dict con {material_codigo?, almacen?, page=1, per_page=20}

    Returns:
        Dict con {items, total, page, pages}
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        page = filtros.get('page', 1)
        per_page = min(filtros.get('per_page', 20), 100)
        offset = (page - 1) * per_page

        where_clauses = []
        params = []

        if filtros.get('material_codigo'):
            where_clauses.append("material_codigo = ?" if not is_using_postgresql() else "material_codigo = %s")
            params.append(filtros['material_codigo'])

        if filtros.get('almacen'):
            where_clauses.append("almacen = ?" if not is_using_postgresql() else "almacen = %s")
            params.append(filtros['almacen'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cur.execute(f"""
            SELECT COUNT(*) FROM nivel_servicio_objetivo {where_sql}
        """, params)
        total = cur.fetchone()[0]

        params_with_limit = params + [per_page, offset]
        cur.execute(f"""
            SELECT * FROM nivel_servicio_objetivo
            {where_sql}
            ORDER BY updated_at DESC
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


def recalcular_todos_niveles() -> dict:
    """
    Recalcula niveles de servicio para todos los materiales/almacenes.

    Returns:
        Dict con {recalculados: N}
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Obtener todas las combinaciones material-almacén del histórico
        cur.execute("""
            SELECT DISTINCT codigo, almacen
            FROM consumo_historico
            WHERE DATE(fecha_consumo) >= CURRENT_DATE - INTERVAL '90 days'
        """ if is_using_postgresql() else """
            SELECT DISTINCT codigo, almacen
            FROM consumo_historico
            WHERE DATE(fecha_consumo) >= DATE('now', '-90 days')
        """)

        combinaciones = cur.fetchall()
        recalculados = 0

        for material_codigo, almacen in combinaciones:
            try:
                calcular_niveles_servicio(material_codigo, almacen)
                recalculados += 1
            except Exception:
                # Continuar con el siguiente si falla uno
                continue

        return {'recalculados': recalculados}
    finally:
        cur.close()
        conn.close()


def obtener_kpis_optimizacion() -> dict:
    """
    Obtiene KPIs de optimización de inventario.

    Returns:
        Dict con {transferencias_pendientes, transferencias_completadas,
                 desbalances_detectados, nivel_servicio_promedio}
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Transferencias pendientes
        cur.execute("""
            SELECT COUNT(*) FROM transferencia_inventario
            WHERE estado IN ('proposed', 'approved')
        """)
        transferencias_pendientes = cur.fetchone()[0] or 0

        # Transferencias completadas (últimos 30 días)
        cur.execute("""
            SELECT COUNT(*) FROM transferencia_inventario
            WHERE estado = 'received'
              AND DATE(fecha_recepcion) >= CURRENT_DATE - INTERVAL '30 days'
        """ if is_using_postgresql() else """
            SELECT COUNT(*) FROM transferencia_inventario
            WHERE estado = 'received'
              AND DATE(fecha_recepcion) >= DATE('now', '-30 days')
        """)
        transferencias_completadas = cur.fetchone()[0] or 0

        # Desbalances detectados
        desbalances = detectar_desbalances()
        desbalances_detectados = len(desbalances)

        # Nivel de servicio promedio
        cur.execute("""
            SELECT AVG(nivel_servicio) FROM nivel_servicio_objetivo
        """)
        nivel_servicio_promedio = cur.fetchone()[0] or 0

        return {
            'transferencias_pendientes': transferencias_pendientes,
            'transferencias_completadas': transferencias_completadas,
            'desbalances_detectados': desbalances_detectados,
            'nivel_servicio_promedio': round(nivel_servicio_promedio, 2)
        }
    finally:
        cur.close()
        conn.close()
