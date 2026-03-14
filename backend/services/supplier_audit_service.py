"""
Servicio de auditorías y certificaciones de proveedores.

Este módulo gestiona certificaciones de proveedores, auditorías de calidad,
hallazgos y alertas de vencimiento.
"""

from datetime import datetime, timedelta

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql


def registrar_certificacion(data: dict) -> int:
    """
    Registra una certificación de proveedor.

    Args:
        data: Dict con {proveedor_cuit, tipo, nombre, organismo_emisor,
                       numero_certificado, fecha_emision, fecha_vencimiento, estado}

    Returns:
        ID de la certificación creada
    """
    conn, cur = get_db_transaction()

    try:
        if is_using_postgresql():
            cur.execute("""
                INSERT INTO proveedor_certificacion
                    (proveedor_cuit, tipo, nombre, organismo_emisor,
                     numero_certificado, fecha_emision, fecha_vencimiento,
                     estado, archivo_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (data['proveedor_cuit'], data['tipo'], data['nombre'],
                  data['organismo_emisor'], data.get('numero_certificado'),
                  data['fecha_emision'], data.get('fecha_vencimiento'),
                  data.get('estado', 'active'), data.get('archivo_url')))
            cert_id = cur.fetchone()[0]
        else:
            cur.execute("""
                INSERT INTO proveedor_certificacion
                    (proveedor_cuit, tipo, nombre, organismo_emisor,
                     numero_certificado, fecha_emision, fecha_vencimiento,
                     estado, archivo_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (data['proveedor_cuit'], data['tipo'], data['nombre'],
                  data['organismo_emisor'], data.get('numero_certificado'),
                  data['fecha_emision'], data.get('fecha_vencimiento'),
                  data.get('estado', 'active'), data.get('archivo_url')))
            cert_id = cur.lastrowid

        conn.commit()
        return cert_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_certificaciones(filtros: dict) -> dict:
    """
    Obtiene certificaciones con paginación.

    Args:
        filtros: Dict con {proveedor_cuit?, tipo?, estado?, page=1, per_page=20}

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

        if filtros.get('proveedor_cuit'):
            where_clauses.append("proveedor_cuit = ?" if not is_using_postgresql() else "proveedor_cuit = %s")
            params.append(filtros['proveedor_cuit'])

        if filtros.get('tipo'):
            where_clauses.append("tipo = ?" if not is_using_postgresql() else "tipo = %s")
            params.append(filtros['tipo'])

        if filtros.get('estado'):
            where_clauses.append("estado = ?" if not is_using_postgresql() else "estado = %s")
            params.append(filtros['estado'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cur.execute(f"""
            SELECT COUNT(*) FROM proveedor_certificacion {where_sql}
        """, params)
        total = cur.fetchone()[0]

        params_with_limit = params + [per_page, offset]
        cur.execute(f"""
            SELECT * FROM proveedor_certificacion
            {where_sql}
            ORDER BY fecha_emision DESC
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


def actualizar_certificacion(cert_id: int, data: dict) -> dict:
    """
    Actualiza una certificación.

    Args:
        cert_id: ID de la certificación
        data: Dict con campos a actualizar

    Returns:
        Dict con la certificación actualizada
    """
    conn, cur = get_db_transaction()

    try:
        updates = []
        values = []

        allowed_fields = ['estado', 'fecha_vencimiento', 'archivo_url', 'notas']

        for field in allowed_fields:
            if field in data:
                updates.append(f"{field} = ?" if not is_using_postgresql() else f"{field} = %s")
                values.append(data[field])

        if not updates:
            raise ValueError("No hay campos para actualizar")

        updates.append("updated_at = CURRENT_TIMESTAMP" if not is_using_postgresql() else "updated_at = NOW()")
        values.append(cert_id)

        if is_using_postgresql():
            cur.execute(f"""
                UPDATE proveedor_certificacion
                SET {', '.join(updates)}
                WHERE id = %s
                RETURNING *
            """, values)
            row = cur.fetchone()
        else:
            cur.execute(f"""
                UPDATE proveedor_certificacion
                SET {', '.join(updates)}
                WHERE id = ?
            """, values)

            cur.execute("SELECT * FROM proveedor_certificacion WHERE id = ?", (cert_id,))
            row = cur.fetchone()

        conn.commit()

        return dict(row) if row else {}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def alertas_vencimiento(dias: int = 30) -> list:
    """
    Obtiene certificaciones por vencer.

    Args:
        dias: Número de días de anticipación (default 30)

    Returns:
        List de certificaciones por vencer
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        fecha_limite = (datetime.now() + timedelta(days=dias)).date()

        if is_using_postgresql():
            cur.execute("""
                SELECT id, proveedor_cuit, tipo, nombre, fecha_vencimiento,
                       EXTRACT(DAY FROM (fecha_vencimiento - CURRENT_DATE))::integer as dias_restantes
                FROM proveedor_certificacion
                WHERE estado = 'active'
                  AND fecha_vencimiento IS NOT NULL
                  AND fecha_vencimiento <= %s
                  AND fecha_vencimiento >= CURRENT_DATE
                ORDER BY fecha_vencimiento
            """, (fecha_limite,))
        else:
            cur.execute("""
                SELECT id, proveedor_cuit, tipo, nombre, fecha_vencimiento,
                       julianday(fecha_vencimiento) - julianday(DATE('now')) as dias_restantes
                FROM proveedor_certificacion
                WHERE estado = 'active'
                  AND fecha_vencimiento IS NOT NULL
                  AND fecha_vencimiento <= ?
                  AND fecha_vencimiento >= DATE('now')
                ORDER BY fecha_vencimiento
            """, (fecha_limite.isoformat(),))

        rows = cur.fetchall()
        return [dict(row) for row in rows]
    finally:
        cur.close()
        conn.close()


def crear_auditoria(data: dict, user_id: int) -> int:
    """
    Crea una auditoría de proveedor.

    Args:
        data: Dict con {proveedor_cuit, tipo, alcance, fecha_programada, auditor_id?}
        user_id: ID del usuario que crea

    Returns:
        ID de la auditoría creada
    """
    conn, cur = get_db_transaction()

    try:
        auditor_id = data.get('auditor_id', user_id)

        if is_using_postgresql():
            cur.execute("""
                INSERT INTO auditoria_proveedor
                    (proveedor_cuit, tipo, alcance, fecha_programada,
                     auditor_id, estado, creado_por)
                VALUES (%s, %s, %s, %s, %s, 'scheduled', %s)
                RETURNING id
            """, (data['proveedor_cuit'], data['tipo'], data['alcance'],
                  data['fecha_programada'], auditor_id, user_id))
            auditoria_id = cur.fetchone()[0]
        else:
            cur.execute("""
                INSERT INTO auditoria_proveedor
                    (proveedor_cuit, tipo, alcance, fecha_programada,
                     auditor_id, estado, creado_por)
                VALUES (?, ?, ?, ?, ?, 'scheduled', ?)
            """, (data['proveedor_cuit'], data['tipo'], data['alcance'],
                  data['fecha_programada'], auditor_id, user_id))
            auditoria_id = cur.lastrowid

        conn.commit()
        return auditoria_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_auditorias(filtros: dict) -> dict:
    """
    Obtiene auditorías con paginación.

    Args:
        filtros: Dict con {proveedor_cuit?, estado?, tipo?, page=1, per_page=20}

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

        if filtros.get('proveedor_cuit'):
            where_clauses.append("proveedor_cuit = ?" if not is_using_postgresql() else "proveedor_cuit = %s")
            params.append(filtros['proveedor_cuit'])

        if filtros.get('estado'):
            where_clauses.append("estado = ?" if not is_using_postgresql() else "estado = %s")
            params.append(filtros['estado'])

        if filtros.get('tipo'):
            where_clauses.append("tipo = ?" if not is_using_postgresql() else "tipo = %s")
            params.append(filtros['tipo'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cur.execute(f"""
            SELECT COUNT(*) FROM auditoria_proveedor {where_sql}
        """, params)
        total = cur.fetchone()[0]

        params_with_limit = params + [per_page, offset]
        cur.execute(f"""
            SELECT * FROM auditoria_proveedor
            {where_sql}
            ORDER BY fecha_programada DESC
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


def obtener_detalle_auditoria(auditoria_id: int) -> dict:
    """
    Obtiene detalles completos de una auditoría con hallazgos.

    Args:
        auditoria_id: ID de la auditoría

    Returns:
        Dict con datos de auditoría y lista de hallazgos
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Obtener auditoría
        cur.execute("""
            SELECT * FROM auditoria_proveedor WHERE id = ?
        """ if not is_using_postgresql() else """
            SELECT * FROM auditoria_proveedor WHERE id = %s
        """, (auditoria_id,))

        auditoria = cur.fetchone()
        if not auditoria:
            return {}

        auditoria_dict = dict(auditoria)

        # Obtener hallazgos
        cur.execute("""
            SELECT * FROM auditoria_hallazgo
            WHERE auditoria_id = ?
            ORDER BY severidad DESC, created_at
        """ if not is_using_postgresql() else """
            SELECT * FROM auditoria_hallazgo
            WHERE auditoria_id = %s
            ORDER BY severidad DESC, created_at
        """, (auditoria_id,))

        hallazgos = [dict(row) for row in cur.fetchall()]
        auditoria_dict['hallazgos'] = hallazgos

        return auditoria_dict
    finally:
        cur.close()
        conn.close()


def registrar_resultado(auditoria_id: int, data: dict) -> dict:
    """
    Registra el resultado de una auditoría.

    Args:
        auditoria_id: ID de la auditoría
        data: Dict con {resultado, score, hallazgos?: [{categoria, descripcion, severidad}]}

    Returns:
        Dict con la auditoría actualizada
    """
    conn, cur = get_db_transaction()

    try:
        hallazgos = data.get('hallazgos', [])

        # Contar hallazgos por severidad
        hallazgos_criticos = sum(1 for h in hallazgos if h.get('severidad') == 'critico')
        hallazgos_mayores = sum(1 for h in hallazgos if h.get('severidad') == 'mayor')
        hallazgos_menores = sum(1 for h in hallazgos if h.get('severidad') == 'menor')

        # Actualizar auditoría
        if is_using_postgresql():
            cur.execute("""
                UPDATE auditoria_proveedor
                SET resultado = %s,
                    score = %s,
                    fecha_realizada = NOW(),
                    estado = 'completed',
                    hallazgos_criticos = %s,
                    hallazgos_mayores = %s,
                    hallazgos_menores = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING *
            """, (data['resultado'], data.get('score'), hallazgos_criticos,
                  hallazgos_mayores, hallazgos_menores, auditoria_id))
            auditoria_row = cur.fetchone()
        else:
            cur.execute("""
                UPDATE auditoria_proveedor
                SET resultado = ?,
                    score = ?,
                    fecha_realizada = CURRENT_TIMESTAMP,
                    estado = 'completed',
                    hallazgos_criticos = ?,
                    hallazgos_mayores = ?,
                    hallazgos_menores = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (data['resultado'], data.get('score'), hallazgos_criticos,
                  hallazgos_mayores, hallazgos_menores, auditoria_id))

            cur.execute("SELECT * FROM auditoria_proveedor WHERE id = ?", (auditoria_id,))
            auditoria_row = cur.fetchone()

        # Insertar hallazgos
        for hallazgo in hallazgos:
            if is_using_postgresql():
                cur.execute("""
                    INSERT INTO auditoria_hallazgo
                        (auditoria_id, categoria, descripcion, severidad,
                         estado, accion_correctiva)
                    VALUES (%s, %s, %s, %s, 'open', %s)
                """, (auditoria_id, hallazgo['categoria'], hallazgo['descripcion'],
                      hallazgo['severidad'], hallazgo.get('accion_correctiva')))
            else:
                cur.execute("""
                    INSERT INTO auditoria_hallazgo
                        (auditoria_id, categoria, descripcion, severidad,
                         estado, accion_correctiva)
                    VALUES (?, ?, ?, ?, 'open', ?)
                """, (auditoria_id, hallazgo['categoria'], hallazgo['descripcion'],
                      hallazgo['severidad'], hallazgo.get('accion_correctiva')))

        conn.commit()

        return dict(auditoria_row) if auditoria_row else {}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def resolver_hallazgo(hallazgo_id: int, data: dict) -> dict:
    """
    Resuelve un hallazgo de auditoría.

    Args:
        hallazgo_id: ID del hallazgo
        data: Dict con {estado='resolved'|'closed', resolucion?, verificado_por?}

    Returns:
        Dict con el hallazgo actualizado
    """
    conn, cur = get_db_transaction()

    try:
        updates = []
        values = []

        if 'estado' in data:
            updates.append("estado = ?" if not is_using_postgresql() else "estado = %s")
            values.append(data['estado'])

        if 'resolucion' in data:
            updates.append("resolucion = ?" if not is_using_postgresql() else "resolucion = %s")
            values.append(data['resolucion'])

        if 'verificado_por' in data:
            updates.append("verificado_por = ?" if not is_using_postgresql() else "verificado_por = %s")
            values.append(data['verificado_por'])

        if data.get('estado') in ['resolved', 'closed']:
            updates.append("fecha_resolucion = CURRENT_TIMESTAMP" if not is_using_postgresql() else "fecha_resolucion = NOW()")

        if not updates:
            raise ValueError("No hay campos para actualizar")

        updates.append("updated_at = CURRENT_TIMESTAMP" if not is_using_postgresql() else "updated_at = NOW()")
        values.append(hallazgo_id)

        if is_using_postgresql():
            cur.execute(f"""
                UPDATE auditoria_hallazgo
                SET {', '.join(updates)}
                WHERE id = %s
                RETURNING *
            """, values)
            row = cur.fetchone()
        else:
            cur.execute(f"""
                UPDATE auditoria_hallazgo
                SET {', '.join(updates)}
                WHERE id = ?
            """, values)

            cur.execute("SELECT * FROM auditoria_hallazgo WHERE id = ?", (hallazgo_id,))
            row = cur.fetchone()

        conn.commit()

        return dict(row) if row else {}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        conn.close()


def obtener_kpis_auditorias() -> dict:
    """
    Obtiene KPIs de auditorías y certificaciones.

    Returns:
        Dict con {auditorias_total, pass_rate, hallazgos_abiertos,
                 certificaciones_activas, certificaciones_por_vencer}
    """
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Total de auditorías (últimos 12 meses)
        cur.execute("""
            SELECT COUNT(*) FROM auditoria_proveedor
            WHERE estado = 'completed'
              AND DATE(fecha_realizada) >= CURRENT_DATE - INTERVAL '12 months'
        """ if is_using_postgresql() else """
            SELECT COUNT(*) FROM auditoria_proveedor
            WHERE estado = 'completed'
              AND DATE(fecha_realizada) >= DATE('now', '-12 months')
        """)
        auditorias_total = cur.fetchone()[0] or 0

        # Pass rate (resultado='pass')
        cur.execute("""
            SELECT COUNT(*) FROM auditoria_proveedor
            WHERE estado = 'completed'
              AND resultado = 'pass'
              AND DATE(fecha_realizada) >= CURRENT_DATE - INTERVAL '12 months'
        """ if is_using_postgresql() else """
            SELECT COUNT(*) FROM auditoria_proveedor
            WHERE estado = 'completed'
              AND resultado = 'pass'
              AND DATE(fecha_realizada) >= DATE('now', '-12 months')
        """)
        auditorias_pass = cur.fetchone()[0] or 0
        pass_rate = (auditorias_pass / auditorias_total * 100) if auditorias_total > 0 else 0

        # Hallazgos abiertos
        cur.execute("""
            SELECT COUNT(*) FROM auditoria_hallazgo
            WHERE estado = 'open'
        """)
        hallazgos_abiertos = cur.fetchone()[0] or 0

        # Certificaciones activas
        cur.execute("""
            SELECT COUNT(*) FROM proveedor_certificacion
            WHERE estado = 'active'
        """)
        certificaciones_activas = cur.fetchone()[0] or 0

        # Certificaciones por vencer (próximos 30 días)
        certificaciones_por_vencer = len(alertas_vencimiento(30))

        return {
            'auditorias_total': auditorias_total,
            'pass_rate': round(pass_rate, 2),
            'hallazgos_abiertos': hallazgos_abiertos,
            'certificaciones_activas': certificaciones_activas,
            'certificaciones_por_vencer': certificaciones_por_vencer
        }
    finally:
        cur.close()
        conn.close()
