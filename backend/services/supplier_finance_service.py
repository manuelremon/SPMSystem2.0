"""
Servicio para gestión de financiamiento de proveedores y descuentos dinámicos.
Sprint 89: Supplier Finance
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from backend.core.db import get_db_connection


def crear_programa(
    nombre: str,
    tipo: str,
    descuento_base_pct: float,
    dias_anticipacion: Optional[int] = None,
    formula: Optional[str] = None,
    presupuesto_anual: Optional[float] = None
) -> int:
    """Crear programa de descuento dinámico."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO programa_descuento
        (nombre, tipo, descuento_base_pct, dias_anticipacion, formula, presupuesto_anual)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (nombre, tipo, descuento_base_pct, dias_anticipacion, formula, presupuesto_anual))

    programa_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return programa_id


def obtener_programas(estado: Optional[str] = None) -> List[Dict]:
    """Obtener programas de descuento."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if estado:
        cursor.execute("""
            SELECT id, nombre, tipo, descuento_base_pct, dias_anticipacion,
                   formula, estado, presupuesto_anual, utilizado_anual, created_at
            FROM programa_descuento
            WHERE estado = ?
            ORDER BY created_at DESC
        """, (estado,))
    else:
        cursor.execute("""
            SELECT id, nombre, tipo, descuento_base_pct, dias_anticipacion,
                   formula, estado, presupuesto_anual, utilizado_anual, created_at
            FROM programa_descuento
            ORDER BY created_at DESC
        """)

    programas = []
    for row in cursor.fetchall():
        programa = {
            'id': row[0],
            'nombre': row[1],
            'tipo': row[2],
            'descuento_base_pct': row[3],
            'dias_anticipacion': row[4],
            'formula': row[5],
            'estado': row[6],
            'presupuesto_anual': row[7],
            'utilizado_anual': row[8],
            'created_at': row[9],
            'presupuesto_disponible': (row[7] - row[8]) if row[7] else None
        }
        programas.append(programa)

    conn.close()
    return programas


def _calcular_descuento(
    monto: float,
    descuento_base_pct: float,
    dias_anticipacion: int,
    fecha_original: datetime,
    fecha_anticipado: datetime,
    formula: Optional[str] = None
) -> float:
    """Calcular descuento según fórmula o base."""
    if formula:
        # Evaluar fórmula personalizada (ej: "base_pct * (dias_ant / 30)")
        dias_ant = (fecha_original - fecha_anticipado).days
        try:
            # Contexto seguro para eval
            context = {
                'base_pct': descuento_base_pct,
                'dias_ant': dias_ant,
                'monto': monto
            }
            descuento_pct = eval(formula, {"__builtins__": {}}, context)
            return min(descuento_pct, descuento_base_pct)  # Cap al base
        except Exception:
            # Fallback a base
            return descuento_base_pct
    else:
        # Descuento base simple
        return descuento_base_pct


def generar_ofertas(programa_id: int, dias_horizonte: int = 30) -> List[int]:
    """Generar ofertas de descuento para facturas elegibles."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener programa
    cursor.execute("""
        SELECT descuento_base_pct, dias_anticipacion, formula, presupuesto_anual, utilizado_anual
        FROM programa_descuento
        WHERE id = ? AND estado = 'active'
    """, (programa_id,))
    programa = cursor.fetchone()
    if not programa:
        conn.close()
        return []

    descuento_base_pct, dias_anticipacion, formula, presupuesto_anual, utilizado_anual = programa

    # Obtener facturas elegibles (no pagadas, dentro del horizonte)
    # Suponiendo que factura_proveedor tiene estado y fecha_vencimiento
    fecha_limite = (datetime.now() + timedelta(days=dias_horizonte)).strftime('%Y-%m-%d')

    cursor.execute("""
        SELECT id, proveedor_cuit, monto_total, fecha_vencimiento
        FROM factura_proveedor
        WHERE estado IN ('pendiente', 'aprobada')
        AND fecha_vencimiento <= ?
        AND id NOT IN (SELECT factura_id FROM oferta_descuento WHERE factura_id IS NOT NULL)
        ORDER BY fecha_vencimiento ASC
    """, (fecha_limite,))

    facturas = cursor.fetchall()
    ofertas_creadas = []

    for factura in facturas:
        factura_id, proveedor_cuit, monto_total, fecha_vencimiento = factura
        fecha_original = datetime.strptime(fecha_vencimiento, '%Y-%m-%d')
        fecha_anticipado = datetime.now() + timedelta(days=dias_anticipacion if dias_anticipacion else 7)

        # Calcular descuento
        descuento_pct = _calcular_descuento(
            monto_total, descuento_base_pct, dias_anticipacion or 0,
            fecha_original, fecha_anticipado, formula
        )
        monto_descuento = monto_total * (descuento_pct / 100)

        # Verificar presupuesto disponible
        if presupuesto_anual:
            if (utilizado_anual + monto_descuento) > presupuesto_anual:
                continue  # Saltar si excede presupuesto

        # Crear oferta
        cursor.execute("""
            INSERT INTO oferta_descuento
            (programa_id, factura_id, proveedor_cuit, monto_factura,
             descuento_ofrecido_pct, monto_descuento, fecha_pago_original, fecha_pago_anticipado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (programa_id, factura_id, proveedor_cuit, monto_total,
              descuento_pct, monto_descuento, fecha_vencimiento,
              fecha_anticipado.strftime('%Y-%m-%d')))

        ofertas_creadas.append(cursor.lastrowid)

    conn.commit()
    conn.close()

    return ofertas_creadas


def obtener_ofertas(
    estado: Optional[str] = None,
    proveedor_cuit: Optional[str] = None
) -> List[Dict]:
    """Obtener ofertas de descuento."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT o.id, o.programa_id, o.factura_id, o.proveedor_cuit,
               o.monto_factura, o.descuento_ofrecido_pct, o.monto_descuento,
               o.fecha_pago_original, o.fecha_pago_anticipado, o.estado,
               o.aceptada_por, o.fecha_aceptacion, o.created_at,
               p.nombre as programa_nombre
        FROM oferta_descuento o
        LEFT JOIN programa_descuento p ON o.programa_id = p.id
        WHERE 1=1
    """
    params = []

    if estado:
        query += " AND o.estado = ?"
        params.append(estado)

    if proveedor_cuit:
        query += " AND o.proveedor_cuit = ?"
        params.append(proveedor_cuit)

    query += " ORDER BY o.created_at DESC"

    cursor.execute(query, params)

    ofertas = []
    for row in cursor.fetchall():
        oferta = {
            'id': row[0],
            'programa_id': row[1],
            'factura_id': row[2],
            'proveedor_cuit': row[3],
            'monto_factura': row[4],
            'descuento_ofrecido_pct': row[5],
            'monto_descuento': row[6],
            'fecha_pago_original': row[7],
            'fecha_pago_anticipado': row[8],
            'estado': row[9],
            'aceptada_por': row[10],
            'fecha_aceptacion': row[11],
            'created_at': row[12],
            'programa_nombre': row[13]
        }
        ofertas.append(oferta)

    conn.close()
    return ofertas


def aceptar_oferta(oferta_id: int, usuario_id: int) -> bool:
    """Aceptar oferta de descuento."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verificar que oferta existe y está pendiente
    cursor.execute("""
        SELECT estado FROM oferta_descuento WHERE id = ?
    """, (oferta_id,))
    row = cursor.fetchone()
    if not row or row[0] != 'pendiente':
        conn.close()
        return False

    # Actualizar oferta
    cursor.execute("""
        UPDATE oferta_descuento
        SET estado = 'aceptada',
            aceptada_por = ?,
            fecha_aceptacion = ?
        WHERE id = ?
    """, (usuario_id, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), oferta_id))

    conn.commit()
    conn.close()

    return True


def rechazar_oferta(oferta_id: int) -> bool:
    """Rechazar oferta de descuento."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE oferta_descuento
        SET estado = 'rechazada'
        WHERE id = ? AND estado = 'pendiente'
    """, (oferta_id,))

    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()

    return rows_affected > 0


def marcar_pagada(oferta_id: int) -> bool:
    """Marcar oferta como pagada y actualizar presupuesto utilizado."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener datos de oferta
    cursor.execute("""
        SELECT programa_id, monto_descuento, estado
        FROM oferta_descuento
        WHERE id = ?
    """, (oferta_id,))
    row = cursor.fetchone()
    if not row or row[2] != 'aceptada':
        conn.close()
        return False

    programa_id, monto_descuento = row[0], row[1]

    # Actualizar oferta
    cursor.execute("""
        UPDATE oferta_descuento
        SET estado = 'pagada'
        WHERE id = ?
    """, (oferta_id,))

    # Actualizar presupuesto utilizado
    cursor.execute("""
        UPDATE programa_descuento
        SET utilizado_anual = utilizado_anual + ?
        WHERE id = ?
    """, (monto_descuento, programa_id))

    conn.commit()
    conn.close()

    return True


def obtener_terminos_proveedor(proveedor_cuit: Optional[str] = None) -> List[Dict]:
    """Obtener términos de pago de proveedores."""
    conn = get_db_connection()
    cursor = conn.cursor()

    if proveedor_cuit:
        cursor.execute("""
            SELECT id, proveedor_cuit, termino_estandar_dias, termino_negociado_dias,
                   descuento_pronto_pago_pct, historico_cumplimiento_pct, ultima_revision, created_at
            FROM terminos_pago_proveedor
            WHERE proveedor_cuit = ?
        """, (proveedor_cuit,))
    else:
        cursor.execute("""
            SELECT id, proveedor_cuit, termino_estandar_dias, termino_negociado_dias,
                   descuento_pronto_pago_pct, historico_cumplimiento_pct, ultima_revision, created_at
            FROM terminos_pago_proveedor
            ORDER BY proveedor_cuit
        """)

    terminos = []
    for row in cursor.fetchall():
        termino = {
            'id': row[0],
            'proveedor_cuit': row[1],
            'termino_estandar_dias': row[2],
            'termino_negociado_dias': row[3],
            'descuento_pronto_pago_pct': row[4],
            'historico_cumplimiento_pct': row[5],
            'ultima_revision': row[6],
            'created_at': row[7]
        }
        terminos.append(termino)

    conn.close()
    return terminos


def actualizar_terminos(
    proveedor_cuit: str,
    termino_estandar_dias: Optional[int] = None,
    termino_negociado_dias: Optional[int] = None,
    descuento_pronto_pago_pct: Optional[float] = None
) -> bool:
    """Actualizar términos de pago de proveedor."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verificar si existe
    cursor.execute("""
        SELECT id FROM terminos_pago_proveedor WHERE proveedor_cuit = ?
    """, (proveedor_cuit,))

    if cursor.fetchone():
        # Update
        updates = []
        params = []

        if termino_estandar_dias is not None:
            updates.append("termino_estandar_dias = ?")
            params.append(termino_estandar_dias)

        if termino_negociado_dias is not None:
            updates.append("termino_negociado_dias = ?")
            params.append(termino_negociado_dias)

        if descuento_pronto_pago_pct is not None:
            updates.append("descuento_pronto_pago_pct = ?")
            params.append(descuento_pronto_pago_pct)

        updates.append("ultima_revision = ?")
        params.append(datetime.now().strftime('%Y-%m-%d'))

        params.append(proveedor_cuit)

        cursor.execute(f"""
            UPDATE terminos_pago_proveedor
            SET {', '.join(updates)}
            WHERE proveedor_cuit = ?
        """, params)
    else:
        # Insert
        cursor.execute("""
            INSERT INTO terminos_pago_proveedor
            (proveedor_cuit, termino_estandar_dias, termino_negociado_dias, descuento_pronto_pago_pct, ultima_revision)
            VALUES (?, ?, ?, ?, ?)
        """, (proveedor_cuit, termino_estandar_dias or 30, termino_negociado_dias,
              descuento_pronto_pago_pct, datetime.now().strftime('%Y-%m-%d')))

    conn.commit()
    conn.close()

    return True


def simular_cashflow(
    escenario: str,
    dias_anticipacion: int,
    descuento_pct: float,
    porcentaje_facturas_elegibles: float,
    created_by: int
) -> List[Dict]:
    """Simular impacto en cashflow por 6 meses."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener facturas históricas para proyección
    cursor.execute("""
        SELECT
            strftime('%Y-%m', fecha_emision) as periodo,
            SUM(monto_total) as monto_mes
        FROM factura_proveedor
        WHERE fecha_emision >= date('now', '-6 months')
        GROUP BY strftime('%Y-%m', fecha_emision)
        ORDER BY periodo DESC
    """)

    historico = cursor.fetchall()
    promedio_mensual = sum(row[1] for row in historico) / len(historico) if historico else 0

    # Proyectar 6 meses
    simulaciones = []
    fecha_inicio = datetime.now()

    for i in range(6):
        periodo_fecha = fecha_inicio + timedelta(days=30 * i)
        periodo = periodo_fecha.strftime('%Y-%m')

        monto_facturas = promedio_mensual
        monto_elegible = monto_facturas * (porcentaje_facturas_elegibles / 100)
        monto_descuentos = monto_elegible * (descuento_pct / 100)
        ahorro_neto = monto_descuentos  # Simplificado (sin considerar costo de capital)

        # DPO antes: 30 días, después: 30 - dias_anticipacion
        dias_pago_promedio = 30 - (dias_anticipacion * (porcentaje_facturas_elegibles / 100))

        cursor.execute("""
            INSERT INTO cashflow_simulacion
            (escenario, periodo, monto_facturas, monto_descuentos, ahorro_neto, dias_pago_promedio, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (escenario, periodo, monto_facturas, monto_descuentos, ahorro_neto, dias_pago_promedio, created_by))

        simulaciones.append({
            'periodo': periodo,
            'monto_facturas': monto_facturas,
            'monto_descuentos': monto_descuentos,
            'ahorro_neto': ahorro_neto,
            'dias_pago_promedio': dias_pago_promedio
        })

    conn.commit()
    conn.close()

    return simulaciones


def obtener_kpis() -> Dict:
    """Obtener KPIs de financiamiento de proveedores."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Total ahorros acumulados
    cursor.execute("""
        SELECT SUM(monto_descuento)
        FROM oferta_descuento
        WHERE estado = 'pagada'
    """)
    total_savings = cursor.fetchone()[0] or 0

    # Ofertas pendientes
    cursor.execute("""
        SELECT COUNT(*), SUM(monto_descuento)
        FROM oferta_descuento
        WHERE estado = 'pendiente'
    """)
    row = cursor.fetchone()
    pending_offers_count = row[0] or 0
    pending_savings_potential = row[1] or 0

    # DPO promedio (calculado desde facturas pagadas en últimos 90 días)
    cursor.execute("""
        SELECT AVG(julianday(fecha_pago) - julianday(fecha_emision)) as dpo
        FROM factura_proveedor
        WHERE estado = 'pagada'
        AND fecha_pago >= date('now', '-90 days')
    """)
    avg_dpo = cursor.fetchone()[0] or 30

    # Presupuesto restante (suma de todos los programas activos)
    cursor.execute("""
        SELECT
            SUM(presupuesto_anual) as total_budget,
            SUM(utilizado_anual) as total_used
        FROM programa_descuento
        WHERE estado = 'active' AND presupuesto_anual IS NOT NULL
    """)
    row = cursor.fetchone()
    total_budget = row[0] or 0
    total_used = row[1] or 0
    remaining_budget = total_budget - total_used

    conn.close()

    return {
        'total_savings': total_savings,
        'pending_offers_count': pending_offers_count,
        'pending_savings_potential': pending_savings_potential,
        'avg_dpo': round(avg_dpo, 1),
        'remaining_budget': remaining_budget,
        'budget_utilization_pct': round((total_used / total_budget * 100), 1) if total_budget > 0 else 0
    }
