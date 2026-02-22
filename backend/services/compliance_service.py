"""
Servicio de compliance contractual y rebates.

Este módulo gestiona la verificación de compliance de órdenes de compra
contra contratos, cálculo de rebates y gestión de claims.
"""

from datetime import datetime

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql


def verificar_compliance_oc(oc_id: int) -> list:
    """
    Verifica compliance de una orden de compra contra contratos.

    Para cada item de la OC, busca el contrato correspondiente por material
    y compara precios.

    Args:
        oc_id: ID de la orden de compra

    Returns:
        List de dicts con [{material, precio_contrato, precio_real, es_compliant, desviacion_porcentaje}]
    """
    conn, cur = get_db_transaction()

    try:
        # Obtener items de la OC
        cur.execute("""
            SELECT oci.id, oci.material_codigo, oci.precio_unitario, oci.cantidad,
                   oc.proveedor_cuit, oc.fecha_emision
            FROM orden_compra_item oci
            JOIN orden_compra oc ON oci.orden_compra_id = oc.id
            WHERE oc.id = ?
        """ if not is_using_postgresql() else """
            SELECT oci.id, oci.material_codigo, oci.precio_unitario, oci.cantidad,
                   oc.proveedor_cuit, oc.fecha_emision
            FROM orden_compra_item oci
            JOIN orden_compra oc ON oci.orden_compra_id = oc.id
            WHERE oc.id = %s
        """, (oc_id,))

        items = cur.fetchall()
        results = []

        for item in items:
            item_id, material_codigo, precio_real, cantidad, proveedor_cuit, fecha_emision = item

            # Buscar contrato correspondiente
            cur.execute("""
                SELECT ci.precio_unitario, c.id as contrato_id
                FROM contrato_item ci
                JOIN contrato c ON ci.contrato_id = c.id
                WHERE ci.material_codigo = ?
                  AND c.proveedor_cuit = ?
                  AND c.estado = 'active'
                  AND c.fecha_inicio <= ?
                  AND (c.fecha_fin IS NULL OR c.fecha_fin >= ?)
                ORDER BY c.fecha_inicio DESC
                LIMIT 1
            """ if not is_using_postgresql() else """
                SELECT ci.precio_unitario, c.id as contrato_id
                FROM contrato_item ci
                JOIN contrato c ON ci.contrato_id = c.id
                WHERE ci.material_codigo = %s
                  AND c.proveedor_cuit = %s
                  AND c.estado = 'active'
                  AND c.fecha_inicio <= %s
                  AND (c.fecha_fin IS NULL OR c.fecha_fin >= %s)
                ORDER BY c.fecha_inicio DESC
                LIMIT 1
            """, (material_codigo, proveedor_cuit, fecha_emision, fecha_emision))

            contrato = cur.fetchone()

            if contrato:
                precio_contrato = float(contrato[0])
                contrato_id = contrato[1]
                desviacion = ((precio_real - precio_contrato) / precio_contrato * 100) if precio_contrato > 0 else 0
                es_compliant = abs(desviacion) <= 5  # Tolerancia 5%

                # Registrar compliance check
                if is_using_postgresql():
                    cur.execute("""
                        INSERT INTO compliance_check
                            (contrato_id, orden_compra_id, orden_compra_item_id,
                             material_codigo, precio_contrato, precio_real,
                             es_compliant, desviacion_porcentaje)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (contrato_id, oc_id, item_id, material_codigo,
                          precio_contrato, precio_real, es_compliant, desviacion))
                else:
                    cur.execute("""
                        INSERT INTO compliance_check
                            (contrato_id, orden_compra_id, orden_compra_item_id,
                             material_codigo, precio_contrato, precio_real,
                             es_compliant, desviacion_porcentaje)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (contrato_id, oc_id, item_id, material_codigo,
                          precio_contrato, precio_real, es_compliant, desviacion))

                results.append({
                    'material': material_codigo,
                    'precio_contrato': precio_contrato,
                    'precio_real': precio_real,
                    'es_compliant': es_compliant,
                    'desviacion_porcentaje': round(desviacion, 2)
                })
            else:
                # No hay contrato - registrar como no compliant
                if is_using_postgresql():
                    cur.execute("""
                        INSERT INTO compliance_check
                            (orden_compra_id, orden_compra_item_id, material_codigo,
                             precio_real, es_compliant, notas)
                        VALUES (%s, %s, %s, %s, FALSE, 'Sin contrato')
                    """, (oc_id, item_id, material_codigo, precio_real))
                else:
                    cur.execute("""
                        INSERT INTO compliance_check
                            (orden_compra_id, orden_compra_item_id, material_codigo,
                             precio_real, es_compliant, notas)
                        VALUES (?, ?, ?, ?, 0, 'Sin contrato')
                    """, (oc_id, item_id, material_codigo, precio_real))

                results.append({
                    'material': material_codigo,
                    'precio_contrato': None,
                    'precio_real': precio_real,
                    'es_compliant': False,
                    'desviacion_porcentaje': None
                })

        conn.commit()
        return results
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_compliance_dashboard() -> dict:
    """
    Obtiene métricas del dashboard de compliance.

    Returns:
        Dict con {total_checks, compliant_pct, non_compliant_count,
                 desviacion_promedio, top_desviaciones}
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Total checks y compliance rate
        cur.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN es_compliant = 1 THEN 1 ELSE 0 END) as compliant_count
            FROM compliance_check
            WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days'
        """ if is_using_postgresql() else """
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN es_compliant = 1 THEN 1 ELSE 0 END) as compliant_count
            FROM compliance_check
            WHERE DATE(created_at) >= DATE('now', '-30 days')
        """)

        row = cur.fetchone()
        total_checks = row[0] or 0
        compliant_count = row[1] or 0
        compliant_pct = (compliant_count / total_checks * 100) if total_checks > 0 else 0
        non_compliant_count = total_checks - compliant_count

        # Desviación promedio
        cur.execute("""
            SELECT AVG(ABS(desviacion_porcentaje))
            FROM compliance_check
            WHERE desviacion_porcentaje IS NOT NULL
              AND DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days'
        """ if is_using_postgresql() else """
            SELECT AVG(ABS(desviacion_porcentaje))
            FROM compliance_check
            WHERE desviacion_porcentaje IS NOT NULL
              AND DATE(created_at) >= DATE('now', '-30 days')
        """)
        desviacion_promedio = cur.fetchone()[0] or 0

        # Top desviaciones
        cur.execute("""
            SELECT material_codigo, precio_contrato, precio_real, desviacion_porcentaje
            FROM compliance_check
            WHERE es_compliant = ?
              AND DATE(created_at) >= ?
            ORDER BY ABS(desviacion_porcentaje) DESC
            LIMIT 10
        """ if not is_using_postgresql() else """
            SELECT material_codigo, precio_contrato, precio_real, desviacion_porcentaje
            FROM compliance_check
            WHERE es_compliant = 0
              AND DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY ABS(desviacion_porcentaje) DESC
            LIMIT 10
        """, () if is_using_postgresql() else (0, (datetime.now().date() - datetime.timedelta(days=30)).isoformat()))

        top_desviaciones = [dict(row) for row in cur.fetchall()]

        return {
            'total_checks': total_checks,
            'compliant_pct': round(compliant_pct, 2),
            'non_compliant_count': non_compliant_count,
            'desviacion_promedio': round(desviacion_promedio, 2),
            'top_desviaciones': top_desviaciones
        }
    finally:
        cur.close()
        conn.close()


def obtener_checks(filtros: dict) -> dict:
    """
    Obtiene compliance checks con paginación.

    Args:
        filtros: Dict con {contrato_id?, es_compliant?, page=1, per_page=20}

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

        if filtros.get('contrato_id'):
            where_clauses.append("contrato_id = ?" if not is_using_postgresql() else "contrato_id = %s")
            params.append(filtros['contrato_id'])

        if 'es_compliant' in filtros:
            where_clauses.append("es_compliant = ?" if not is_using_postgresql() else "es_compliant = %s")
            params.append(filtros['es_compliant'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        # Count total
        cur.execute(f"""
            SELECT COUNT(*) FROM compliance_check {where_sql}
        """, params)
        total = cur.fetchone()[0]

        # Get paginated items
        params_with_limit = params + [per_page, offset]
        cur.execute(f"""
            SELECT * FROM compliance_check
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


def crear_programa_rebate(data: dict) -> int:
    """
    Crea un programa de rebates.

    Args:
        data: Dict con {contrato_id, nombre, tipo, umbral_volumen?, porcentaje_rebate?,
                       monto_fijo?, periodo_inicio, periodo_fin}

    Returns:
        ID del programa creado
    """
    conn, cur = get_db_transaction()

    try:
        if is_using_postgresql():
            cur.execute("""
                INSERT INTO rebate_programa
                    (contrato_id, nombre, tipo, umbral_volumen, porcentaje_rebate,
                     monto_fijo, periodo_inicio, periodo_fin, estado)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active')
                RETURNING id
            """, (data['contrato_id'], data['nombre'], data['tipo'],
                  data.get('umbral_volumen'), data.get('porcentaje_rebate'),
                  data.get('monto_fijo'), data['periodo_inicio'], data['periodo_fin']))
            programa_id = cur.fetchone()[0]
        else:
            cur.execute("""
                INSERT INTO rebate_programa
                    (contrato_id, nombre, tipo, umbral_volumen, porcentaje_rebate,
                     monto_fijo, periodo_inicio, periodo_fin, estado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            """, (data['contrato_id'], data['nombre'], data['tipo'],
                  data.get('umbral_volumen'), data.get('porcentaje_rebate'),
                  data.get('monto_fijo'), data['periodo_inicio'], data['periodo_fin']))
            programa_id = cur.lastrowid

        conn.commit()
        return programa_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_programas_rebate(filtros: dict) -> dict:
    """
    Obtiene programas de rebates con paginación.

    Args:
        filtros: Dict con {contrato_id?, estado?, page=1, per_page=20}

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

        if filtros.get('contrato_id'):
            where_clauses.append("contrato_id = ?" if not is_using_postgresql() else "contrato_id = %s")
            params.append(filtros['contrato_id'])

        if filtros.get('estado'):
            where_clauses.append("estado = ?" if not is_using_postgresql() else "estado = %s")
            params.append(filtros['estado'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cur.execute(f"""
            SELECT COUNT(*) FROM rebate_programa {where_sql}
        """, params)
        total = cur.fetchone()[0]

        params_with_limit = params + [per_page, offset]
        cur.execute(f"""
            SELECT * FROM rebate_programa
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


def calcular_rebates(programa_id: int) -> dict:
    """
    Calcula rebates para un programa.

    Args:
        programa_id: ID del programa

    Returns:
        Dict con el cálculo del rebate
    """
    conn, cur = get_db_transaction()

    try:
        # Obtener detalles del programa
        cur.execute("""
            SELECT * FROM rebate_programa WHERE id = ?
        """ if not is_using_postgresql() else """
            SELECT * FROM rebate_programa WHERE id = %s
        """, (programa_id,))

        programa = dict(cur.fetchone())

        # Obtener OC items dentro del periodo
        cur.execute("""
            SELECT SUM(oci.cantidad * oci.precio_unitario) as total_comprado,
                   SUM(oci.cantidad) as cantidad_total
            FROM orden_compra_item oci
            JOIN orden_compra oc ON oci.orden_compra_id = oc.id
            JOIN contrato c ON c.proveedor_cuit = oc.proveedor_cuit
            WHERE c.id = ?
              AND oc.fecha_emision >= ?
              AND oc.fecha_emision <= ?
        """ if not is_using_postgresql() else """
            SELECT SUM(oci.cantidad * oci.precio_unitario) as total_comprado,
                   SUM(oci.cantidad) as cantidad_total
            FROM orden_compra_item oci
            JOIN orden_compra oc ON oci.orden_compra_id = oc.id
            JOIN contrato c ON c.proveedor_cuit = oc.proveedor_cuit
            WHERE c.id = %s
              AND oc.fecha_emision >= %s
              AND oc.fecha_emision <= %s
        """, (programa['contrato_id'], programa['periodo_inicio'], programa['periodo_fin']))

        stats = cur.fetchone()
        total_comprado = float(stats[0] or 0)
        cantidad_total = float(stats[1] or 0)

        monto_rebate = 0
        califica = False

        # Calcular según tipo
        if programa['tipo'] == 'volume':
            if cantidad_total >= (programa['umbral_volumen'] or 0):
                monto_rebate = total_comprado * (programa['porcentaje_rebate'] or 0) / 100
                califica = True
        elif programa['tipo'] == 'growth':
            # Comparar con periodo anterior (simplificado)
            monto_rebate = total_comprado * (programa['porcentaje_rebate'] or 0) / 100
            califica = True
        elif programa['tipo'] == 'flat':
            monto_rebate = programa['monto_fijo'] or 0
            califica = True

        # Insertar cálculo
        if is_using_postgresql():
            cur.execute("""
                INSERT INTO rebate_calculo
                    (programa_id, periodo_inicio, periodo_fin, total_comprado,
                     monto_rebate, estado, fecha_calculo)
                VALUES (%s, %s, %s, %s, %s, 'calculated', NOW())
                RETURNING id
            """, (programa_id, programa['periodo_inicio'], programa['periodo_fin'],
                  total_comprado, monto_rebate))
            calculo_id = cur.fetchone()[0]
        else:
            cur.execute("""
                INSERT INTO rebate_calculo
                    (programa_id, periodo_inicio, periodo_fin, total_comprado,
                     monto_rebate, estado, fecha_calculo)
                VALUES (?, ?, ?, ?, ?, 'calculated', CURRENT_TIMESTAMP)
            """, (programa_id, programa['periodo_inicio'], programa['periodo_fin'],
                  total_comprado, monto_rebate))
            calculo_id = cur.lastrowid

        conn.commit()

        return {
            'id': calculo_id,
            'programa_id': programa_id,
            'total_comprado': total_comprado,
            'cantidad_total': cantidad_total,
            'monto_rebate': monto_rebate,
            'califica': califica
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_claims(filtros: dict) -> dict:
    """
    Obtiene claims de rebate con paginación.

    Args:
        filtros: Dict con {programa_id?, estado?, page=1, per_page=20}

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

        if filtros.get('programa_id'):
            where_clauses.append("programa_id = ?" if not is_using_postgresql() else "programa_id = %s")
            params.append(filtros['programa_id'])

        if filtros.get('estado'):
            where_clauses.append("estado = ?" if not is_using_postgresql() else "estado = %s")
            params.append(filtros['estado'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cur.execute(f"""
            SELECT COUNT(*) FROM rebate_calculo {where_sql}
        """, params)
        total = cur.fetchone()[0]

        params_with_limit = params + [per_page, offset]
        cur.execute(f"""
            SELECT * FROM rebate_calculo
            {where_sql}
            ORDER BY fecha_calculo DESC
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


def cambiar_estado_claim(calculo_id: int, nuevo_estado: str, user_id: int) -> dict:
    """
    Cambia el estado de un claim de rebate.

    Args:
        calculo_id: ID del cálculo
        nuevo_estado: Nuevo estado (claimed, approved, paid)
        user_id: ID del usuario que cambia el estado

    Returns:
        Dict con el claim actualizado
    """
    conn, cur = get_db_transaction()

    try:
        if is_using_postgresql():
            cur.execute("""
                UPDATE rebate_calculo
                SET estado = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
            """, (nuevo_estado, calculo_id))
            row = cur.fetchone()
        else:
            cur.execute("""
                UPDATE rebate_calculo
                SET estado = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (nuevo_estado, calculo_id))

            cur.execute("SELECT * FROM rebate_calculo WHERE id = ?", (calculo_id,))
            row = cur.fetchone()

        conn.commit()

        return dict(row) if row else {}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_kpis_compliance() -> dict:
    """
    Obtiene KPIs de compliance y rebates.

    Returns:
        Dict con {compliance_rate, total_rebate_calculado, total_rebate_pagado, programas_activos}
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Compliance rate (últimos 30 días)
        cur.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN es_compliant = 1 THEN 1 ELSE 0 END) as compliant
            FROM compliance_check
            WHERE DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days'
        """ if is_using_postgresql() else """
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN es_compliant = 1 THEN 1 ELSE 0 END) as compliant
            FROM compliance_check
            WHERE DATE(created_at) >= DATE('now', '-30 days')
        """)

        row = cur.fetchone()
        total_checks = row[0] or 0
        compliant = row[1] or 0
        compliance_rate = (compliant / total_checks * 100) if total_checks > 0 else 0

        # Rebates calculados
        cur.execute("""
            SELECT SUM(monto_rebate)
            FROM rebate_calculo
            WHERE estado IN ('calculated', 'claimed', 'approved', 'paid')
        """)
        total_rebate_calculado = float(cur.fetchone()[0] or 0)

        # Rebates pagados
        cur.execute("""
            SELECT SUM(monto_rebate)
            FROM rebate_calculo
            WHERE estado = 'paid'
        """)
        total_rebate_pagado = float(cur.fetchone()[0] or 0)

        # Programas activos
        cur.execute("""
            SELECT COUNT(*) FROM rebate_programa WHERE estado = 'active'
        """)
        programas_activos = cur.fetchone()[0] or 0

        return {
            'compliance_rate': round(compliance_rate, 2),
            'total_rebate_calculado': total_rebate_calculado,
            'total_rebate_pagado': total_rebate_pagado,
            'programas_activos': programas_activos
        }
    finally:
        cur.close()
        conn.close()
