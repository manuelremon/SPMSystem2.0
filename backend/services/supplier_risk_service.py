"""
Servicio de evaluación de riesgo de proveedores.

Calcula scores de riesgo compuestos basados en múltiples factores:
- Riesgo de entrega
- Riesgo de calidad
- Riesgo de dependencia
- Riesgo financiero
- Riesgo geográfico
"""

from datetime import datetime

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql


def calcular_riesgo_proveedor(proveedor_cuit: str) -> dict:
    """
    Calcula el score de riesgo compuesto de un proveedor.

    Factores (ponderados):
    - Riesgo entrega (30%): Basado en evaluaciones de delivery
    - Riesgo calidad (25%): Basado en NCRs
    - Riesgo dependencia (20%): % del gasto total
    - Riesgo financiero (15%): Placeholder
    - Riesgo geográfico (10%): Placeholder

    Args:
        proveedor_cuit: CUIT del proveedor

    Returns:
        Diccionario con score de riesgo y nivel
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # 1. Riesgo de entrega (de evaluaciones)
        cursor.execute(
            f"""
            SELECT AVG(entrega_score) as avg_entrega
            FROM proveedor_evaluacion
            WHERE proveedor_id = {placeholder}
            """,
            (proveedor_cuit,)
        )
        result = cursor.fetchone()
        avg_entrega = result[0] if result and result[0] else 50

        # Invertir: score bajo = riesgo alto
        riesgo_entrega = 100 - float(avg_entrega)

        # 2. Riesgo de calidad (NCRs)
        cursor.execute(
            f"""
            SELECT COUNT(*) as ncr_count
            FROM ncr n
            WHERE n.proveedor_cuit = {placeholder}
            AND n.estado != 'closed'
            """,
            (proveedor_cuit,)
        )
        ncr_count = cursor.fetchone()[0] or 0

        # NCR score: escalar a 0-100 (0 NCR = 0 riesgo, 10+ NCR = 100 riesgo)
        riesgo_calidad = min(ncr_count * 10, 100)

        # 3. Riesgo de dependencia (% del gasto total)
        cursor.execute("""
            SELECT SUM(oci.cantidad * oci.precio_unitario) as gasto_total
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            WHERE oc.estado != 'cancelled'
        """)
        gasto_total_sistema = cursor.fetchone()[0] or 1

        cursor.execute(
            f"""
            SELECT SUM(oci.cantidad * oci.precio_unitario) as gasto_proveedor
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            WHERE oc.proveedor_cuit = {placeholder}
            AND oc.estado != 'cancelled'
            """,
            (proveedor_cuit,)
        )
        gasto_proveedor = cursor.fetchone()[0] or 0

        pct_gasto = (float(gasto_proveedor) / float(gasto_total_sistema)) * 100
        riesgo_dependencia = pct_gasto  # Directo: más % = más riesgo

        # 4. Riesgo financiero (placeholder)
        riesgo_financiero = 50  # TODO: Integrar con datos financieros externos

        # 5. Riesgo geográfico (placeholder)
        riesgo_geografico = 30  # TODO: Basado en país/región

        # Calcular score ponderado
        score_riesgo = (
            riesgo_entrega * 0.30 +
            riesgo_calidad * 0.25 +
            riesgo_dependencia * 0.20 +
            riesgo_financiero * 0.15 +
            riesgo_geografico * 0.10
        )

        # Clasificar nivel
        if score_riesgo < 25:
            nivel = 'low'
        elif score_riesgo < 50:
            nivel = 'medium'
        elif score_riesgo < 75:
            nivel = 'high'
        else:
            nivel = 'critical'

        # Verificar si es fuente única
        cursor.execute(
            f"""
            SELECT material_codigo
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            WHERE oc.proveedor_cuit = {placeholder}
            GROUP BY material_codigo
            HAVING COUNT(DISTINCT oc.proveedor_cuit) = 1
            """,
            (proveedor_cuit,)
        )
        materiales_unicos = cursor.fetchall()
        es_fuente_unica = 1 if len(materiales_unicos) > 0 else 0

        # Upsert en proveedor_riesgo (SELECT + UPDATE/INSERT pattern)
        cursor.execute(
            f"SELECT id FROM proveedor_riesgo WHERE proveedor_cuit = {placeholder}",
            (proveedor_cuit,)
        )
        existing = cursor.fetchone()
        if existing:
            cursor.execute(f"""
                UPDATE proveedor_riesgo
                SET score_riesgo = {placeholder}, nivel = {placeholder},
                    riesgo_entrega = {placeholder}, riesgo_calidad = {placeholder},
                    riesgo_dependencia = {placeholder}, riesgo_financiero = {placeholder},
                    riesgo_geografico = {placeholder}, es_fuente_unica = {placeholder},
                    updated_at = NOW()
                WHERE proveedor_cuit = {placeholder}
            """, (
                score_riesgo, nivel,
                riesgo_entrega, riesgo_calidad, riesgo_dependencia,
                riesgo_financiero, riesgo_geografico, es_fuente_unica,
                proveedor_cuit
            ))
        else:
            cursor.execute(f"""
                INSERT INTO proveedor_riesgo
                (proveedor_cuit, score_riesgo, nivel, riesgo_entrega, riesgo_calidad,
                 riesgo_dependencia, riesgo_financiero, riesgo_geografico,
                 es_fuente_unica, updated_at)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder}, {placeholder}, NOW())
            """, (
                proveedor_cuit, score_riesgo, nivel,
                riesgo_entrega, riesgo_calidad, riesgo_dependencia,
                riesgo_financiero, riesgo_geografico, es_fuente_unica
            ))

        # Insertar en historial
        periodo = datetime.now().strftime('%Y%m')
        cursor.execute(f"""
            INSERT INTO proveedor_riesgo_historial
            (proveedor_cuit, periodo, score_anterior, score_nuevo,
             nivel_anterior, nivel_nuevo, created_at)
            VALUES ({placeholder}, {placeholder}, 0, {placeholder},
                    'N/A', {placeholder}, NOW())
        """, (proveedor_cuit, periodo, score_riesgo, nivel))

        conn.commit()

        return {
            'proveedor_cuit': proveedor_cuit,
            'score_riesgo': round(score_riesgo, 2),
            'nivel': nivel,
            'riesgo_entrega': round(riesgo_entrega, 2),
            'riesgo_calidad': round(riesgo_calidad, 2),
            'riesgo_dependencia': round(riesgo_dependencia, 2),
            'riesgo_financiero': round(riesgo_financiero, 2),
            'riesgo_geografico': round(riesgo_geografico, 2),
            'es_fuente_unica': es_fuente_unica,
            'materiales_unicos': len(materiales_unicos),
            'pct_gasto': round(pct_gasto, 2)
        }


def detectar_fuentes_unicas() -> list:
    """
    Detecta materiales que solo tienen un proveedor (fuente única).

    Returns:
        Lista de materiales con único proveedor
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                oci.material_codigo,
                oc.proveedor_cuit,
                p.nombre as proveedor_nombre,
                m.descripcion as material_descripcion,
                COUNT(DISTINCT oc.id) as num_ordenes,
                SUM(oci.cantidad * oci.precio_unitario) as gasto_total
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            LEFT JOIN proveedores p ON oc.proveedor_cuit = p.id_proveedor
            LEFT JOIN catalogo_materiales m ON oci.material_codigo = m.codigo
            WHERE oc.estado != 'cancelled'
            GROUP BY oci.material_codigo, oc.proveedor_cuit, p.nombre, m.descripcion
            HAVING COUNT(DISTINCT oc.proveedor_cuit) = 1
            ORDER BY gasto_total DESC
        """)

        fuentes_unicas = []
        for row in cursor.fetchall():
            fuentes_unicas.append({
                'material_codigo': row[0],
                'proveedor_cuit': row[1],
                'proveedor_nombre': row[2],
                'material_descripcion': row[3],
                'num_ordenes': row[4],
                'gasto_total': float(row[5]) if row[5] else 0
            })

        return fuentes_unicas
    finally:
        cursor.close()
        conn.close()


def obtener_mapa_riesgo(filtros: dict) -> dict:
    """
    Obtiene lista paginada del mapa de riesgo de proveedores.

    Args:
        filtros: {
            'nivel': str (optional) - 'low', 'medium', 'high', 'critical',
            'search': str (optional) - busca por CUIT o nombre,
            'page': int,
            'per_page': int
        }

    Returns:
        {items: [...], total: int, page: int, pages: int}
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    page = filtros.get('page', 1)
    per_page = filtros.get('per_page', 20)
    offset = (page - 1) * per_page

    where_clauses = []
    params = []

    if filtros.get('nivel'):
        where_clauses.append(f"pr.nivel = {placeholder}")
        params.append(filtros['nivel'])

    if filtros.get('search'):
        where_clauses.append(f"(pr.proveedor_cuit LIKE {placeholder} OR p.nombre LIKE {placeholder})")
        search_term = f"%{filtros['search']}%"
        params.extend([search_term, search_term])

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Contar total
        cursor.execute(
            f"""
            SELECT COUNT(*)
            FROM proveedor_riesgo pr
            LEFT JOIN proveedores p ON pr.proveedor_cuit = p.id_proveedor
            {where_sql}
            """,
            params
        )
        total = cursor.fetchone()[0]

        # Obtener items
        cursor.execute(
            f"""
            SELECT
                pr.proveedor_cuit,
                p.nombre as proveedor_nombre,
                pr.score_riesgo,
                pr.nivel,
                pr.riesgo_entrega,
                pr.riesgo_calidad,
                pr.riesgo_dependencia,
                pr.riesgo_financiero,
                pr.riesgo_geografico,
                pr.es_fuente_unica,
                pr.updated_at
            FROM proveedor_riesgo pr
            LEFT JOIN proveedores p ON pr.proveedor_cuit = p.id_proveedor
            {where_sql}
            ORDER BY pr.score_riesgo DESC
            LIMIT {placeholder} OFFSET {placeholder}
            """,
            params + [per_page, offset]
        )

        items = []
        for row in cursor.fetchall():
            items.append({
                'proveedor_cuit': row[0],
                'proveedor_nombre': row[1],
                'score_riesgo': round(float(row[2]), 2) if row[2] else 0,
                'nivel': row[3],
                'riesgo_entrega': round(float(row[4]), 2) if row[4] else 0,
                'riesgo_calidad': round(float(row[5]), 2) if row[5] else 0,
                'riesgo_dependencia': round(float(row[6]), 2) if row[6] else 0,
                'riesgo_financiero': round(float(row[7]), 2) if row[7] else 0,
                'riesgo_geografico': round(float(row[8]), 2) if row[8] else 0,
                'es_fuente_unica': bool(row[9]),
                'updated_at': row[10]
            })

        pages = (total + per_page - 1) // per_page

        return {
            'items': items,
            'total': total,
            'page': page,
            'pages': pages
        }
    finally:
        cursor.close()
        conn.close()


def obtener_alertas_riesgo() -> list:
    """
    Obtiene alertas de proveedores con riesgo crítico o fuente única.

    Returns:
        Lista de alertas priorizadas
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                pr.proveedor_cuit,
                p.nombre as proveedor_nombre,
                pr.score_riesgo,
                pr.nivel,
                pr.es_fuente_unica,
                pr.riesgo_entrega,
                pr.riesgo_calidad,
                pr.riesgo_dependencia
            FROM proveedor_riesgo pr
            LEFT JOIN proveedores p ON pr.proveedor_cuit = p.id_proveedor
            WHERE pr.nivel = 'critical' OR pr.es_fuente_unica = 1
            ORDER BY pr.score_riesgo DESC
        """)

        alertas = []
        for row in cursor.fetchall():
            proveedor_cuit = row[0]
            proveedor_nombre = row[1]
            score_riesgo = float(row[2]) if row[2] else 0
            nivel = row[3]
            es_fuente_unica = bool(row[4])
            riesgo_entrega = float(row[5]) if row[5] else 0
            riesgo_calidad = float(row[6]) if row[6] else 0
            riesgo_dependencia = float(row[7]) if row[7] else 0

            # Generar mensaje de alerta
            mensajes = []
            if nivel == 'critical':
                mensajes.append(f"Riesgo crítico (score: {score_riesgo:.1f})")

            if es_fuente_unica:
                mensajes.append("Fuente única para materiales críticos")

            if riesgo_entrega > 70:
                mensajes.append("Alto riesgo de entrega")

            if riesgo_calidad > 70:
                mensajes.append("Alto riesgo de calidad")

            if riesgo_dependencia > 50:
                mensajes.append("Alta dependencia (>50% gasto)")

            alertas.append({
                'proveedor_cuit': proveedor_cuit,
                'proveedor_nombre': proveedor_nombre,
                'score_riesgo': round(score_riesgo, 2),
                'nivel': nivel,
                'es_fuente_unica': es_fuente_unica,
                'alerta': " | ".join(mensajes)
            })

        return alertas
    finally:
        cursor.close()
        conn.close()


def recalcular_todos() -> dict:
    """
    Recalcula el riesgo para todos los proveedores activos.

    Returns:
        Resumen de la operación
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener todos los proveedores con órdenes
        cursor.execute("""
            SELECT DISTINCT proveedor_cuit
            FROM orden_compra
            WHERE estado != 'cancelled'
        """)

        proveedores = [row[0] for row in cursor.fetchall()]
        recalculados = 0
        errores = 0

        for proveedor_cuit in proveedores:
            try:
                calcular_riesgo_proveedor(proveedor_cuit)
                recalculados += 1
            except Exception as e:
                print(f"Error calculando riesgo para {proveedor_cuit}: {e}")
                errores += 1

        return {
            'recalculados': recalculados,
            'errores': errores,
            'total': len(proveedores)
        }
    finally:
        cursor.close()
        conn.close()


def obtener_tendencia_riesgo(proveedor_cuit: str) -> list:
    """
    Obtiene la tendencia histórica de riesgo de un proveedor.

    Args:
        proveedor_cuit: CUIT del proveedor

    Returns:
        Lista de periodos con score y nivel
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            f"""
            SELECT periodo, score_nuevo, nivel_nuevo, created_at
            FROM proveedor_riesgo_historial
            WHERE proveedor_cuit = {placeholder}
            ORDER BY periodo DESC
            LIMIT 12
            """,
            (proveedor_cuit,)
        )

        tendencias = []
        for row in cursor.fetchall():
            tendencias.append({
                'periodo': row[0],
                'score': round(float(row[1]), 2) if row[1] else 0,
                'nivel': row[2],
                'created_at': row[3]
            })

        return tendencias
    finally:
        cursor.close()
        conn.close()
