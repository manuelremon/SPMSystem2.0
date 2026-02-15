"""
Servicio de auditoría de fletes y pagos a transportistas.

Este módulo gestiona facturas de flete, auditoría automática vs tarifas,
aprobaciones, disputas y análisis de rendimiento de transportistas.
"""

from typing import Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql


def registrar_factura_flete(data: dict) -> int:
    """
    Registra una factura de flete.

    Args:
        data: Dict con {numero_factura, transportista_cuit, envio_id?,
                       monto_facturado, fecha_factura, moneda?, items?}

    Returns:
        ID de la factura creada
    """
    conn, cur = get_db_transaction()

    try:
        if is_using_postgresql():
            cur.execute("""
                INSERT INTO factura_flete
                    (numero_factura, transportista_cuit, envio_id,
                     monto_facturado, fecha_factura, moneda, estado)
                VALUES (%s, %s, %s, %s, %s, %s, 'pending')
                RETURNING id
            """, (data['numero_factura'], data['transportista_cuit'],
                  data.get('envio_id'), data['monto_facturado'],
                  data['fecha_factura'], data.get('moneda', 'USD')))
            factura_id = cur.fetchone()[0]
        else:
            cur.execute("""
                INSERT INTO factura_flete
                    (numero_factura, transportista_cuit, envio_id,
                     monto_facturado, fecha_factura, moneda, estado)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            """, (data['numero_factura'], data['transportista_cuit'],
                  data.get('envio_id'), data['monto_facturado'],
                  data['fecha_factura'], data.get('moneda', 'USD')))
            factura_id = cur.lastrowid

        conn.commit()
        return factura_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def auditar_factura(factura_id: int) -> dict:
    """
    Audita automáticamente una factura contra tarifas.

    Compara monto facturado vs tarifas esperadas y crea registros de detalle.

    Args:
        factura_id: ID de la factura

    Returns:
        Dict con resultado de auditoría
    """
    conn, cur = get_db_transaction()

    try:
        # Obtener factura y envío
        cur.execute("""
            SELECT ff.*, e.ruta, e.distancia_km, e.peso_kg
            FROM factura_flete ff
            LEFT JOIN envio e ON ff.envio_id = e.id
            WHERE ff.id = ?
        """ if not is_using_postgresql() else """
            SELECT ff.*, e.ruta, e.distancia_km, e.peso_kg
            FROM factura_flete ff
            LEFT JOIN envio e ON ff.envio_id = e.id
            WHERE ff.id = %s
        """, (factura_id,))

        factura = cur.fetchone()
        if not factura:
            raise ValueError(f"Factura {factura_id} no encontrada")

        factura_dict = dict(factura)
        transportista_cuit = factura_dict['transportista_cuit']
        ruta = factura_dict.get('ruta')
        distancia_km = float(factura_dict.get('distancia_km') or 0)
        peso_kg = float(factura_dict.get('peso_kg') or 0)
        monto_facturado = float(factura_dict['monto_facturado'])

        # Buscar tarifa correspondiente
        if ruta:
            cur.execute("""
                SELECT * FROM freight_tarifa
                WHERE transportista_cuit = ?
                  AND ruta = ?
                  AND fecha_vigencia_desde <= ?
                  AND (fecha_vigencia_hasta IS NULL OR fecha_vigencia_hasta >= ?)
                ORDER BY fecha_vigencia_desde DESC
                LIMIT 1
            """ if not is_using_postgresql() else """
                SELECT * FROM freight_tarifa
                WHERE transportista_cuit = %s
                  AND ruta = %s
                  AND fecha_vigencia_desde <= %s
                  AND (fecha_vigencia_hasta IS NULL OR fecha_vigencia_hasta >= %s)
                ORDER BY fecha_vigencia_desde DESC
                LIMIT 1
            """, (transportista_cuit, ruta, factura_dict['fecha_factura'],
                  factura_dict['fecha_factura']))
        else:
            # Buscar tarifa general del transportista
            cur.execute("""
                SELECT * FROM freight_tarifa
                WHERE transportista_cuit = ?
                  AND ruta IS NULL
                  AND fecha_vigencia_desde <= ?
                  AND (fecha_vigencia_hasta IS NULL OR fecha_vigencia_hasta >= ?)
                ORDER BY fecha_vigencia_desde DESC
                LIMIT 1
            """ if not is_using_postgresql() else """
                SELECT * FROM freight_tarifa
                WHERE transportista_cuit = %s
                  AND ruta IS NULL
                  AND fecha_vigencia_desde <= %s
                  AND (fecha_vigencia_hasta IS NULL OR fecha_vigencia_hasta >= %s)
                ORDER BY fecha_vigencia_desde DESC
                LIMIT 1
            """, (transportista_cuit, factura_dict['fecha_factura'],
                  factura_dict['fecha_factura']))

        tarifa = cur.fetchone()

        if not tarifa:
            # Sin tarifa - marcar como no auditable
            if is_using_postgresql():
                cur.execute("""
                    UPDATE factura_flete
                    SET estado = 'audited',
                        diferencia = NULL,
                        updated_at = NOW()
                    WHERE id = %s
                """, (factura_id,))

                cur.execute("""
                    INSERT INTO freight_audit_detalle
                        (factura_id, concepto, monto_esperado, monto_facturado, observacion)
                    VALUES (%s, 'Sin tarifa', NULL, %s, 'No se encontró tarifa aplicable')
                """, (factura_id, monto_facturado))
            else:
                cur.execute("""
                    UPDATE factura_flete
                    SET estado = 'audited',
                        diferencia = NULL,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (factura_id,))

                cur.execute("""
                    INSERT INTO freight_audit_detalle
                        (factura_id, concepto, monto_esperado, monto_facturado, observacion)
                    VALUES (?, 'Sin tarifa', NULL, ?, 'No se encontró tarifa aplicable')
                """, (factura_id, monto_facturado))

            conn.commit()

            return {
                'factura_id': factura_id,
                'monto_facturado': monto_facturado,
                'monto_esperado': None,
                'diferencia': None,
                'resultado': 'sin_tarifa'
            }

        tarifa_dict = dict(tarifa)
        tarifa_base = float(tarifa_dict.get('tarifa_base') or 0)
        tarifa_por_km = float(tarifa_dict.get('tarifa_por_km') or 0)
        tarifa_por_kg = float(tarifa_dict.get('tarifa_por_kg') or 0)

        # Calcular monto esperado
        monto_esperado = tarifa_base
        detalles = []

        # Componente base
        detalles.append({
            'concepto': 'Tarifa base',
            'monto_esperado': tarifa_base,
            'monto_facturado': tarifa_base
        })

        # Componente por distancia
        if distancia_km > 0 and tarifa_por_km > 0:
            costo_km = distancia_km * tarifa_por_km
            monto_esperado += costo_km
            detalles.append({
                'concepto': f'Distancia ({distancia_km} km)',
                'monto_esperado': costo_km,
                'monto_facturado': costo_km
            })

        # Componente por peso
        if peso_kg > 0 and tarifa_por_kg > 0:
            costo_kg = peso_kg * tarifa_por_kg
            monto_esperado += costo_kg
            detalles.append({
                'concepto': f'Peso ({peso_kg} kg)',
                'monto_esperado': costo_kg,
                'monto_facturado': costo_kg
            })

        # Calcular diferencia
        diferencia = monto_facturado - monto_esperado
        diferencia_pct = (diferencia / monto_esperado * 100) if monto_esperado > 0 else 0

        # Registrar detalles de auditoría
        for detalle in detalles:
            if is_using_postgresql():
                cur.execute("""
                    INSERT INTO freight_audit_detalle
                        (factura_id, concepto, monto_esperado, monto_facturado, observacion)
                    VALUES (%s, %s, %s, %s, NULL)
                """, (factura_id, detalle['concepto'], detalle['monto_esperado'],
                      detalle['monto_facturado']))
            else:
                cur.execute("""
                    INSERT INTO freight_audit_detalle
                        (factura_id, concepto, monto_esperado, monto_facturado, observacion)
                    VALUES (?, ?, ?, ?, NULL)
                """, (factura_id, detalle['concepto'], detalle['monto_esperado'],
                      detalle['monto_facturado']))

        # Si hay diferencia significativa, registrarla
        if abs(diferencia_pct) > 5:  # Tolerancia 5%
            observacion = f"Diferencia de {diferencia_pct:.2f}% respecto a tarifa"
            if is_using_postgresql():
                cur.execute("""
                    INSERT INTO freight_audit_detalle
                        (factura_id, concepto, monto_esperado, monto_facturado, observacion)
                    VALUES (%s, 'Diferencia total', %s, %s, %s)
                """, (factura_id, monto_esperado, monto_facturado, observacion))
            else:
                cur.execute("""
                    INSERT INTO freight_audit_detalle
                        (factura_id, concepto, monto_esperado, monto_facturado, observacion)
                    VALUES (?, 'Diferencia total', ?, ?, ?)
                """, (factura_id, monto_esperado, monto_facturado, observacion))

        # Actualizar factura
        if is_using_postgresql():
            cur.execute("""
                UPDATE factura_flete
                SET estado = 'audited',
                    monto_esperado = %s,
                    diferencia = %s,
                    updated_at = NOW()
                WHERE id = %s
            """, (monto_esperado, diferencia, factura_id))
        else:
            cur.execute("""
                UPDATE factura_flete
                SET estado = 'audited',
                    monto_esperado = ?,
                    diferencia = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (monto_esperado, diferencia, factura_id))

        conn.commit()

        return {
            'factura_id': factura_id,
            'monto_facturado': monto_facturado,
            'monto_esperado': monto_esperado,
            'diferencia': round(diferencia, 2),
            'diferencia_pct': round(diferencia_pct, 2),
            'resultado': 'auditado'
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def aprobar_factura(factura_id: int, user_id: int, monto_aprobado: Optional[float] = None) -> dict:
    """
    Aprueba una factura de flete.

    Args:
        factura_id: ID de la factura
        user_id: ID del usuario que aprueba
        monto_aprobado: Monto aprobado (si None, usa monto_facturado)

    Returns:
        Dict con la factura actualizada
    """
    conn, cur = get_db_transaction()

    try:
        if monto_aprobado is None:
            # Obtener monto facturado
            cur.execute("""
                SELECT monto_facturado FROM factura_flete WHERE id = ?
            """ if not is_using_postgresql() else """
                SELECT monto_facturado FROM factura_flete WHERE id = %s
            """, (factura_id,))

            row = cur.fetchone()
            if row:
                monto_aprobado = float(row[0])
            else:
                raise ValueError(f"Factura {factura_id} no encontrada")

        if is_using_postgresql():
            cur.execute("""
                UPDATE factura_flete
                SET estado = 'approved',
                    monto_aprobado = %s,
                    aprobado_por = %s,
                    fecha_aprobacion = NOW(),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
            """, (monto_aprobado, user_id, factura_id))
            row = cur.fetchone()
        else:
            cur.execute("""
                UPDATE factura_flete
                SET estado = 'approved',
                    monto_aprobado = ?,
                    aprobado_por = ?,
                    fecha_aprobacion = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (monto_aprobado, user_id, factura_id))

            cur.execute("SELECT * FROM factura_flete WHERE id = ?", (factura_id,))
            row = cur.fetchone()

        conn.commit()

        return dict(row) if row else {}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def disputar_factura(factura_id: int, razon: str) -> dict:
    """
    Marca una factura como disputada.

    Args:
        factura_id: ID de la factura
        razon: Razón de la disputa

    Returns:
        Dict con la factura actualizada
    """
    conn, cur = get_db_transaction()

    try:
        if is_using_postgresql():
            cur.execute("""
                UPDATE factura_flete
                SET estado = 'disputed',
                    razon_disputa = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
            """, (razon, factura_id))
            row = cur.fetchone()
        else:
            cur.execute("""
                UPDATE factura_flete
                SET estado = 'disputed',
                    razon_disputa = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (razon, factura_id))

            cur.execute("SELECT * FROM factura_flete WHERE id = ?", (factura_id,))
            row = cur.fetchone()

        conn.commit()

        return dict(row) if row else {}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_facturas_flete(filtros: dict) -> dict:
    """
    Obtiene facturas de flete con paginación.

    Args:
        filtros: Dict con {estado?, transportista_cuit?, fecha_desde?, fecha_hasta?,
                          page=1, per_page=20}

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

        if filtros.get('transportista_cuit'):
            where_clauses.append("transportista_cuit = ?" if not is_using_postgresql() else "transportista_cuit = %s")
            params.append(filtros['transportista_cuit'])

        if filtros.get('fecha_desde'):
            where_clauses.append("fecha_factura >= ?" if not is_using_postgresql() else "fecha_factura >= %s")
            params.append(filtros['fecha_desde'])

        if filtros.get('fecha_hasta'):
            where_clauses.append("fecha_factura <= ?" if not is_using_postgresql() else "fecha_factura <= %s")
            params.append(filtros['fecha_hasta'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cur.execute(f"""
            SELECT COUNT(*) FROM factura_flete {where_sql}
        """, params)
        total = cur.fetchone()[0]

        params_with_limit = params + [per_page, offset]
        cur.execute(f"""
            SELECT * FROM factura_flete
            {where_sql}
            ORDER BY fecha_factura DESC
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


def obtener_detalle_factura_flete(factura_id: int) -> dict:
    """
    Obtiene detalle completo de una factura con auditoría.

    Args:
        factura_id: ID de la factura

    Returns:
        Dict con factura y detalles de auditoría
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Obtener factura
        cur.execute("""
            SELECT * FROM factura_flete WHERE id = ?
        """ if not is_using_postgresql() else """
            SELECT * FROM factura_flete WHERE id = %s
        """, (factura_id,))

        factura = cur.fetchone()
        if not factura:
            return {}

        factura_dict = dict(factura)

        # Obtener detalles de auditoría
        cur.execute("""
            SELECT * FROM freight_audit_detalle
            WHERE factura_id = ?
            ORDER BY id
        """ if not is_using_postgresql() else """
            SELECT * FROM freight_audit_detalle
            WHERE factura_id = %s
            ORDER BY id
        """, (factura_id,))

        detalles = [dict(row) for row in cur.fetchall()]
        factura_dict['detalles_auditoria'] = detalles

        return factura_dict
    finally:
        cur.close()
        conn.close()


def obtener_tarifas(filtros: dict) -> dict:
    """
    Obtiene tarifas de flete.

    Args:
        filtros: Dict con {transportista_cuit?, page=1, per_page=20}

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

        if filtros.get('transportista_cuit'):
            where_clauses.append("transportista_cuit = ?" if not is_using_postgresql() else "transportista_cuit = %s")
            params.append(filtros['transportista_cuit'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cur.execute(f"""
            SELECT COUNT(*) FROM freight_tarifa {where_sql}
        """, params)
        total = cur.fetchone()[0]

        params_with_limit = params + [per_page, offset]
        cur.execute(f"""
            SELECT * FROM freight_tarifa
            {where_sql}
            ORDER BY fecha_vigencia_desde DESC
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


def crear_tarifa(data: dict) -> int:
    """
    Crea una tarifa de flete.

    Args:
        data: Dict con {transportista_cuit, ruta?, tarifa_base,
                       tarifa_por_km?, tarifa_por_kg?, fecha_vigencia_desde,
                       fecha_vigencia_hasta?}

    Returns:
        ID de la tarifa creada
    """
    conn, cur = get_db_transaction()

    try:
        if is_using_postgresql():
            cur.execute("""
                INSERT INTO freight_tarifa
                    (transportista_cuit, ruta, tarifa_base, tarifa_por_km,
                     tarifa_por_kg, fecha_vigencia_desde, fecha_vigencia_hasta)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (data['transportista_cuit'], data.get('ruta'),
                  data['tarifa_base'], data.get('tarifa_por_km'),
                  data.get('tarifa_por_kg'), data['fecha_vigencia_desde'],
                  data.get('fecha_vigencia_hasta')))
            tarifa_id = cur.fetchone()[0]
        else:
            cur.execute("""
                INSERT INTO freight_tarifa
                    (transportista_cuit, ruta, tarifa_base, tarifa_por_km,
                     tarifa_por_kg, fecha_vigencia_desde, fecha_vigencia_hasta)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (data['transportista_cuit'], data.get('ruta'),
                  data['tarifa_base'], data.get('tarifa_por_km'),
                  data.get('tarifa_por_kg'), data['fecha_vigencia_desde'],
                  data.get('fecha_vigencia_hasta')))
            tarifa_id = cur.lastrowid

        conn.commit()
        return tarifa_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_kpis_freight() -> dict:
    """
    Obtiene KPIs de auditoría de fletes.

    Returns:
        Dict con {total_facturado, total_aprobado, diferencia_total,
                 tasa_disputa, facturas_pendientes}
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Total facturado (últimos 30 días)
        cur.execute("""
            SELECT SUM(monto_facturado)
            FROM factura_flete
            WHERE DATE(fecha_factura) >= CURRENT_DATE - INTERVAL '30 days'
        """ if is_using_postgresql() else """
            SELECT SUM(monto_facturado)
            FROM factura_flete
            WHERE DATE(fecha_factura) >= DATE('now', '-30 days')
        """)
        total_facturado = float(cur.fetchone()[0] or 0)

        # Total aprobado
        cur.execute("""
            SELECT SUM(monto_aprobado)
            FROM factura_flete
            WHERE estado = 'approved'
              AND DATE(fecha_factura) >= CURRENT_DATE - INTERVAL '30 days'
        """ if is_using_postgresql() else """
            SELECT SUM(monto_aprobado)
            FROM factura_flete
            WHERE estado = 'approved'
              AND DATE(fecha_factura) >= DATE('now', '-30 days')
        """)
        total_aprobado = float(cur.fetchone()[0] or 0)

        # Diferencia total (sobrecargos/descuentos)
        cur.execute("""
            SELECT SUM(diferencia)
            FROM factura_flete
            WHERE diferencia IS NOT NULL
              AND DATE(fecha_factura) >= CURRENT_DATE - INTERVAL '30 days'
        """ if is_using_postgresql() else """
            SELECT SUM(diferencia)
            FROM factura_flete
            WHERE diferencia IS NOT NULL
              AND DATE(fecha_factura) >= DATE('now', '-30 days')
        """)
        diferencia_total = float(cur.fetchone()[0] or 0)

        # Tasa de disputa
        cur.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN estado = 'disputed' THEN 1 ELSE 0 END) as disputadas
            FROM factura_flete
            WHERE DATE(fecha_factura) >= CURRENT_DATE - INTERVAL '30 days'
        """ if is_using_postgresql() else """
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN estado = 'disputed' THEN 1 ELSE 0 END) as disputadas
            FROM factura_flete
            WHERE DATE(fecha_factura) >= DATE('now', '-30 days')
        """)
        row = cur.fetchone()
        total = row[0] or 0
        disputadas = row[1] or 0
        tasa_disputa = (disputadas / total * 100) if total > 0 else 0

        # Facturas pendientes
        cur.execute("""
            SELECT COUNT(*) FROM factura_flete
            WHERE estado IN ('pending', 'audited')
        """)
        facturas_pendientes = cur.fetchone()[0] or 0

        return {
            'total_facturado': total_facturado,
            'total_aprobado': total_aprobado,
            'diferencia_total': diferencia_total,
            'tasa_disputa': round(tasa_disputa, 2),
            'facturas_pendientes': facturas_pendientes
        }
    finally:
        cur.close()
        conn.close()


def rendimiento_transportistas() -> list:
    """
    Calcula rendimiento de transportistas por auditoría.

    Returns:
        Lista de transportistas con métricas agregadas
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                transportista_cuit,
                COUNT(*) as total_facturas,
                SUM(monto_facturado) as total_facturado,
                SUM(monto_aprobado) as total_aprobado,
                SUM(CASE WHEN estado = 'disputed' THEN 1 ELSE 0 END) as facturas_disputadas,
                AVG(diferencia) as diferencia_promedio,
                AVG(CASE
                    WHEN monto_esperado > 0
                    THEN ABS(diferencia) / monto_esperado * 100
                    ELSE 0
                END) as desviacion_promedio_pct
            FROM factura_flete
            WHERE DATE(fecha_factura) >= CURRENT_DATE - INTERVAL '90 days'
            GROUP BY transportista_cuit
            ORDER BY total_facturado DESC
        """ if is_using_postgresql() else """
            SELECT
                transportista_cuit,
                COUNT(*) as total_facturas,
                SUM(monto_facturado) as total_facturado,
                SUM(monto_aprobado) as total_aprobado,
                SUM(CASE WHEN estado = 'disputed' THEN 1 ELSE 0 END) as facturas_disputadas,
                AVG(diferencia) as diferencia_promedio,
                AVG(CASE
                    WHEN monto_esperado > 0
                    THEN ABS(diferencia) / monto_esperado * 100
                    ELSE 0
                END) as desviacion_promedio_pct
            FROM factura_flete
            WHERE DATE(fecha_factura) >= DATE('now', '-90 days')
            GROUP BY transportista_cuit
            ORDER BY total_facturado DESC
        """)

        rows = cur.fetchall()
        return [dict(row) for row in rows]
    finally:
        cur.close()
        conn.close()
