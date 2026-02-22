"""
Servicio de Spend Analytics y Kraljic Matrix.

Proporciona análisis de gasto por categoría, detección de maverick spend,
clasificación Kraljic y cálculo de TCO (Total Cost of Ownership).
"""

from datetime import datetime, timedelta

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql


def calcular_gasto_por_categoria(periodo_desde: str = None, periodo_hasta: str = None) -> list:
    """
    Calcula el gasto total agrupado por categoría de material.

    Args:
        periodo_desde: Fecha inicio (YYYY-MM-DD), opcional
        periodo_hasta: Fecha fin (YYYY-MM-DD), opcional

    Returns:
        Lista de categorías con gasto, ordenes y proveedores
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        where_clauses = ["oc.status != 'cancelled'"]
        params = []

        if periodo_desde:
            where_clauses.append(f"oc.created_at >= {placeholder}")
            params.append(periodo_desde)

        if periodo_hasta:
            where_clauses.append(f"oc.created_at <= {placeholder}")
            params.append(periodo_hasta)

        where_sql = " AND ".join(where_clauses)

        cursor.execute(
            f"""
            SELECT
                COALESCE(sr.categoria, 'Sin Categoría') as categoria,
                SUM(oci.cantidad * oci.precio_unitario) as gasto_total,
                COUNT(DISTINCT oc.id) as num_ordenes,
                COUNT(DISTINCT oc.proveedor_nombre) as num_proveedores
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            LEFT JOIN spend_registro sr ON oci.material_codigo = sr.material_codigo
            WHERE {where_sql}
            GROUP BY COALESCE(sr.categoria, 'Sin Categoría')
            ORDER BY gasto_total DESC
            """,
            params
        )

        categorias = []
        for row in cursor.fetchall():
            categorias.append({
                'categoria': row[0],
                'gasto_total': float(row[1]) if row[1] else 0,
                'num_ordenes': row[2],
                'num_proveedores': row[3]
            })

        return categorias
    finally:
        cursor.close()
        conn.close()


def detectar_maverick_spend(periodo: str = None) -> dict:
    """
    Detecta órdenes de compra sin contrato asociado (maverick spend).

    Args:
        periodo: Periodo en formato YYYYMM, opcional

    Returns:
        {
            'total_spend': float,
            'maverick_spend': float,
            'maverick_pct': float,
            'items': [...]
        }
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        where_clauses = ["oc.status != 'cancelled'"]
        params = []

        if periodo:
            # Convertir YYYYMM a rango de fechas
            year = int(periodo[:4])
            month = int(periodo[4:6])
            fecha_inicio = f"{year}-{month:02d}-01"

            if month == 12:
                fecha_fin = f"{year + 1}-01-01"
            else:
                fecha_fin = f"{year}-{month + 1:02d}-01"

            where_clauses.append(f"oc.created_at >= {placeholder}")
            where_clauses.append(f"oc.created_at < {placeholder}")
            params.extend([fecha_inicio, fecha_fin])

        where_sql = " AND ".join(where_clauses)

        # Total spend
        cursor.execute(
            f"""
            SELECT SUM(oci.cantidad * oci.precio_unitario)
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            WHERE {where_sql}
            """,
            params
        )
        total_spend = cursor.fetchone()[0] or 0

        # Maverick spend (sin contrato)
        cursor.execute(
            f"""
            SELECT SUM(oci.cantidad * oci.precio_unitario)
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            WHERE {where_sql} AND oci.contrato_id IS NULL
            """,
            params
        )
        maverick_spend = cursor.fetchone()[0] or 0

        maverick_pct = (maverick_spend / total_spend * 100) if total_spend > 0 else 0

        # Detalle de items maverick
        cursor.execute(
            f"""
            SELECT
                oc.id, oc.numero, oc.created_at, oc.proveedor_nombre,
                p.nombre as proveedor_nombre,
                SUM(oci.cantidad * oci.precio_unitario) as monto
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            LEFT JOIN proveedores p ON oc.proveedor_nombre = p.nombre
            WHERE {where_sql} AND oci.contrato_id IS NULL
            GROUP BY oc.id, oc.numero, oc.created_at, oc.proveedor_nombre, p.nombre
            ORDER BY monto DESC
            LIMIT 50
            """,
            params
        )

        items = []
        for row in cursor.fetchall():
            items.append({
                'orden_compra_id': row[0],
                'numero': row[1],
                'fecha_orden': row[2],
                'proveedor_cuit': row[3],
                'proveedor_nombre': row[4],
                'monto': float(row[5]) if row[5] else 0
            })

        return {
            'total_spend': float(total_spend),
            'maverick_spend': float(maverick_spend),
            'maverick_pct': round(maverick_pct, 2),
            'items': items
        }
    finally:
        cursor.close()
        conn.close()


def generar_kraljic_matrix() -> list:
    """
    Genera la matriz de Kraljic para categorías de materiales.

    Clasifica categorías en 4 cuadrantes:
    - Strategic: Alto riesgo, alto impacto
    - Leverage: Bajo riesgo, alto impacto
    - Bottleneck: Alto riesgo, bajo impacto
    - Non-critical: Bajo riesgo, bajo impacto

    Returns:
        Lista de categorías con clasificación Kraljic
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener datos por categoría
        cursor.execute("""
            SELECT
                COALESCE(sr.categoria, 'Sin Categoría') as categoria,
                COUNT(DISTINCT oc.proveedor_nombre) as num_proveedores,
                0 as avg_lead_time,
                SUM(oci.cantidad * oci.precio_unitario) as gasto_total
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            LEFT JOIN spend_registro sr ON oci.material_codigo = sr.material_codigo
            WHERE oc.status != 'cancelled'
            GROUP BY COALESCE(sr.categoria, 'Sin Categoría')
        """)

        categorias = []
        max_gasto = 0
        max_riesgo = 0

        # Primera pasada: calcular valores base
        for row in cursor.fetchall():
            num_proveedores = row[1] or 1
            avg_lead_time = row[2] or 0
            gasto_total = float(row[3]) if row[3] else 0

            # Supply risk: menos proveedores = más riesgo, más lead time = más riesgo
            supply_risk = (1 / num_proveedores) * 100 + (avg_lead_time / 30) * 100

            categorias.append({
                'categoria': row[0],
                'supply_risk': supply_risk,
                'profit_impact': gasto_total,
                'num_proveedores': num_proveedores,
                'avg_lead_time': float(avg_lead_time)
            })

            max_gasto = max(max_gasto, gasto_total)
            max_riesgo = max(max_riesgo, supply_risk)

        # Normalizar y clasificar
        for cat in categorias:
            # Normalizar a escala 0-100
            cat['supply_risk_norm'] = (cat['supply_risk'] / max_riesgo * 100) if max_riesgo > 0 else 0
            cat['profit_impact_norm'] = (cat['profit_impact'] / max_gasto * 100) if max_gasto > 0 else 0

            # Clasificar (umbral 50)
            if cat['supply_risk_norm'] >= 50 and cat['profit_impact_norm'] >= 50:
                cat['clasificacion'] = 'Strategic'
            elif cat['supply_risk_norm'] < 50 and cat['profit_impact_norm'] >= 50:
                cat['clasificacion'] = 'Leverage'
            elif cat['supply_risk_norm'] >= 50 and cat['profit_impact_norm'] < 50:
                cat['clasificacion'] = 'Bottleneck'
            else:
                cat['clasificacion'] = 'Non-critical'

            # Redondear valores
            cat['supply_risk'] = round(cat['supply_risk'], 2)
            cat['supply_risk_norm'] = round(cat['supply_risk_norm'], 2)
            cat['profit_impact'] = round(cat['profit_impact'], 2)
            cat['profit_impact_norm'] = round(cat['profit_impact_norm'], 2)

        return categorias
    finally:
        cursor.close()
        conn.close()


def obtener_tendencia_gasto(meses: int = 12) -> list:
    """
    Obtiene la tendencia de gasto por mes.

    Args:
        meses: Número de meses hacia atrás

    Returns:
        Lista de periodos con gasto total, gasto con contrato y maverick
    """
    using_pg = is_using_postgresql()

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Calcular fecha de inicio
        fecha_inicio = (datetime.now() - timedelta(days=meses * 30)).strftime('%Y-%m-01')

        if using_pg:
            cursor.execute("""
                SELECT
                    TO_CHAR(oc.created_at, 'YYYY-MM') as periodo,
                    SUM(oci.cantidad * oci.precio_unitario) as gasto_total,
                    SUM(CASE WHEN oci.contrato_id IS NOT NULL THEN oci.cantidad * oci.precio_unitario ELSE 0 END) as gasto_contrato,
                    SUM(CASE WHEN oci.contrato_id IS NULL THEN oci.cantidad * oci.precio_unitario ELSE 0 END) as gasto_maverick
                FROM orden_compra oc
                JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
                WHERE oc.created_at >= %s AND oc.status != 'cancelled'
                GROUP BY TO_CHAR(oc.created_at, 'YYYY-MM')
                ORDER BY periodo
            """, (fecha_inicio,))
        else:
            cursor.execute("""
                SELECT
                    strftime('%Y-%m', oc.created_at) as periodo,
                    SUM(oci.cantidad * oci.precio_unitario) as gasto_total,
                    SUM(CASE WHEN oci.contrato_id IS NOT NULL THEN oci.cantidad * oci.precio_unitario ELSE 0 END) as gasto_contrato,
                    SUM(CASE WHEN oci.contrato_id IS NULL THEN oci.cantidad * oci.precio_unitario ELSE 0 END) as gasto_maverick
                FROM orden_compra oc
                JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
                WHERE oc.created_at >= ? AND oc.status != 'cancelled'
                GROUP BY strftime('%Y-%m', oc.created_at)
                ORDER BY periodo
            """, (fecha_inicio,))

        tendencias = []
        for row in cursor.fetchall():
            tendencias.append({
                'periodo': row[0],
                'gasto_total': float(row[1]) if row[1] else 0,
                'gasto_contrato': float(row[2]) if row[2] else 0,
                'gasto_maverick': float(row[3]) if row[3] else 0
            })

        return tendencias
    finally:
        cursor.close()
        conn.close()


def tomar_snapshot_periodo(periodo: str) -> dict:
    """
    Toma un snapshot del gasto por categoría para un periodo.

    Args:
        periodo: Periodo en formato YYYYMM

    Returns:
        Resumen del snapshot
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    # Convertir YYYYMM a rango de fechas
    year = int(periodo[:4])
    month = int(periodo[4:6])
    fecha_inicio = f"{year}-{month:02d}-01"

    if month == 12:
        fecha_fin = f"{year + 1}-01-01"
    else:
        fecha_fin = f"{year}-{month + 1:02d}-01"

    with get_db_transaction() as (conn, cursor):
        # Obtener gasto por categoría
        cursor.execute(
            f"""
            SELECT
                COALESCE(sr.categoria, 'Sin Categoría') as categoria,
                SUM(oci.cantidad * oci.precio_unitario) as gasto_total,
                COUNT(DISTINCT oc.id) as num_ordenes,
                COUNT(DISTINCT oc.proveedor_nombre) as num_proveedores,
                SUM(CASE WHEN oci.contrato_id IS NOT NULL THEN oci.cantidad * oci.precio_unitario ELSE 0 END) as gasto_contrato
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            LEFT JOIN spend_registro sr ON oci.material_codigo = sr.material_codigo
            WHERE oc.created_at >= {placeholder} AND oc.created_at < {placeholder}
            AND oc.status != 'cancelled'
            GROUP BY COALESCE(sr.categoria, 'Sin Categoría')
            """,
            (fecha_inicio, fecha_fin)
        )

        categorias = cursor.fetchall()
        inserted_count = 0

        for row in categorias:
            categoria = row[0]
            gasto_total = float(row[1]) if row[1] else 0
            num_ordenes = row[2]
            num_proveedores = row[3]
            gasto_contrato = float(row[4]) if row[4] else 0
            gasto_maverick = gasto_total - gasto_contrato

            # Insertar snapshot
            if using_pg:
                cursor.execute("""
                    INSERT INTO spend_snapshot
                    (periodo, categoria, gasto_total, gasto_contrato, gasto_maverick,
                     num_ordenes, num_proveedores, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (periodo, categoria) DO UPDATE SET
                        gasto_total = EXCLUDED.gasto_total,
                        gasto_contrato = EXCLUDED.gasto_contrato,
                        gasto_maverick = EXCLUDED.gasto_maverick,
                        num_ordenes = EXCLUDED.num_ordenes,
                        num_proveedores = EXCLUDED.num_proveedores,
                        created_at = NOW()
                """, (periodo, categoria, gasto_total, gasto_contrato, gasto_maverick,
                      num_ordenes, num_proveedores))
            else:
                cursor.execute("""
                    INSERT OR REPLACE INTO spend_snapshot
                    (periodo, categoria, gasto_total, gasto_contrato, gasto_maverick,
                     num_ordenes, num_proveedores, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                """, (periodo, categoria, gasto_total, gasto_contrato, gasto_maverick,
                      num_ordenes, num_proveedores))

            inserted_count += 1

        conn.commit()

        return {
            'periodo': periodo,
            'categorias_procesadas': inserted_count
        }


def obtener_tco_material(material_codigo: str) -> dict:
    """
    Calcula el Total Cost of Ownership (TCO) de un material.

    TCO = Precio de compra + Costos de flete + Costos de calidad (NCR)

    Args:
        material_codigo: Código SAP del material

    Returns:
        Desglose de TCO
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Precio de compra promedio (últimas 10 órdenes)
        cursor.execute(
            f"""
            SELECT AVG(oci.precio_unitario)
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            WHERE oci.material_codigo = {placeholder}
            AND oc.status != 'cancelled'
            ORDER BY oc.created_at DESC
            LIMIT 10
            """,
            (material_codigo,)
        )
        precio_compra = cursor.fetchone()[0] or 0

        # Costo de flete promedio (si existe en orden_compra)
        cursor.execute(
            f"""
            SELECT AVG(oc.costo_envio / oci.cantidad)
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            WHERE oci.material_codigo = {placeholder}
            AND oc.costo_envio > 0
            AND oci.cantidad > 0
            """,
            (material_codigo,)
        )
        costo_flete = cursor.fetchone()[0] or 0

        # Costo de calidad (NCR) - estimar por defectos
        cursor.execute(
            f"""
            SELECT COUNT(*) as ncr_count
            FROM ncr n
            JOIN inspeccion_item ii ON n.inspeccion_item_id = ii.id
            WHERE ii.material_codigo = {placeholder}
            """,
            (material_codigo,)
        )
        ncr_count = cursor.fetchone()[0] or 0

        # Estimar costo de calidad como % del precio (5% por cada NCR, max 50%)
        costo_calidad_pct = min(ncr_count * 5, 50)
        costo_calidad = float(precio_compra) * (costo_calidad_pct / 100)

        # TCO total
        tco_total = float(precio_compra) + float(costo_flete) + costo_calidad

        return {
            'material_codigo': material_codigo,
            'precio_compra': round(float(precio_compra), 2),
            'costo_flete': round(float(costo_flete), 2),
            'costo_calidad': round(costo_calidad, 2),
            'costo_calidad_pct': costo_calidad_pct,
            'ncr_count': ncr_count,
            'tco_total': round(tco_total, 2)
        }
    finally:
        cursor.close()
        conn.close()
