"""
Servicio de 3-Way Matching (PO vs Recepción vs Factura).

Maneja la validación cruzada entre órdenes de compra, recepciones y facturas de proveedores.
Detecta discrepancias y facilita el proceso de resolución.
"""

from datetime import datetime

from backend.core.db import (
    get_db_connection,
    get_db_transaction,
    insert_returning_id,
    is_using_postgresql,
    sql_datetime_now,
)


def registrar_factura(data: dict, user_id: int) -> int:
    """
    Registra una nueva factura de proveedor con sus items.

    Args:
        data: {
            'proveedor_cuit': str,
            'orden_compra_id': int (optional),
            'numero_factura': str (optional, auto-generated if not provided),
            'fecha_factura': str,
            'monto_total': float,
            'moneda': str,
            'items': [
                {
                    'material_codigo': str,
                    'cantidad': float,
                    'precio_unitario': float,
                    'descripcion': str (optional)
                }
            ]
        }
        user_id: ID del usuario registrando la factura

    Returns:
        ID de la factura creada
    """
    with get_db_transaction() as (conn, cursor):
        # Generar numero_factura si no se proporciona
        numero_factura = data.get('numero_factura')
        if not numero_factura:
            fecha_now = datetime.now().strftime('%Y%m%d')
            # Contar facturas del día
            cursor.execute(
                "SELECT COUNT(*) FROM factura_proveedor WHERE numero_factura LIKE ?",
                (f'INV-{fecha_now}-%',)
            )
            count = cursor.fetchone()[0] + 1
            numero_factura = f"INV-{fecha_now}-{count:04d}"

        # Insertar factura
        factura_id = insert_returning_id(
            cursor,
            f"""
                INSERT INTO factura_proveedor
                (proveedor_cuit, orden_compra_id, numero_factura, fecha_factura,
                 monto_total, moneda, estado, subido_por, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, {sql_datetime_now()})
            """,
            (
                data['proveedor_cuit'],
                data.get('orden_compra_id'),
                numero_factura,
                data['fecha_factura'],
                data['monto_total'],
                data.get('moneda', 'USD'),
                'pending',
                user_id
            )
        )

        # Insertar items
        for item in data['items']:
            precio_unitario = item['precio_unitario']
            cantidad = item['cantidad']
            precio_total = round(precio_unitario * cantidad, 2)
            cursor.execute("""
                INSERT INTO factura_item
                (factura_id, material_codigo, cantidad_facturada, precio_unitario, precio_total)
                VALUES (?, ?, ?, ?, ?)
            """, (
                factura_id,
                item['material_codigo'],
                cantidad,
                precio_unitario,
                precio_total
            ))

        conn.commit()
        return factura_id


def ejecutar_matching(factura_id: int) -> dict:
    """
    Ejecuta el proceso de 3-way matching para una factura.

    Compara:
    - Factura vs Orden de Compra (cantidades y precios)
    - Factura vs Recepción (cantidades recibidas)

    Args:
        factura_id: ID de la factura a validar

    Returns:
        Resumen de resultados del matching
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Obtener factura
        cursor.execute(
            f"SELECT orden_compra_id, proveedor_cuit FROM factura_proveedor WHERE id = {placeholder}",
            (factura_id,)
        )
        factura = cursor.fetchone()
        if not factura:
            raise ValueError(f"Factura {factura_id} no encontrada")

        orden_compra_id = factura[0]
        if not orden_compra_id:
            raise ValueError("Factura no tiene orden_compra_id asociada")

        # Obtener items de factura
        cursor.execute(
            f"""
            SELECT id, material_codigo, cantidad_facturada, precio_unitario
            FROM factura_item
            WHERE factura_id = {placeholder}
            """,
            (factura_id,)
        )
        factura_items = cursor.fetchall()

        resultados = []
        matched_count = 0
        partial_count = 0
        disputed_count = 0

        for fi_row in factura_items:
            fi_row[0]  # item_id (not used in matching_resultado INSERT)
            material_codigo = fi_row[1]
            cantidad_factura = fi_row[2]
            precio_factura = fi_row[3]
            # Obtener datos de OC
            cursor.execute(
                f"""
                SELECT cantidad, precio_unitario
                FROM orden_compra_item
                WHERE orden_compra_id = {placeholder} AND material_codigo = {placeholder}
                """,
                (orden_compra_id, material_codigo)
            )
            oc_data = cursor.fetchone()

            cantidad_oc = oc_data[0] if oc_data else 0
            precio_oc = oc_data[1] if oc_data else 0

            # inspeccion_entrada doesn't have orden_compra_id or material_codigo,
            # so receipt matching is not available through inspection tables.
            # Default to OC quantity as the "received" amount for matching purposes.
            cantidad_recibida = float(cantidad_oc)

            # Calcular diferencias (tolerancia 5%)
            diff_cantidad = abs(cantidad_factura - cantidad_recibida)
            tolerancia_cantidad = cantidad_oc * 0.05
            cantidad_ok = diff_cantidad <= tolerancia_cantidad

            diff_precio = abs(precio_factura - precio_oc)
            tolerancia_precio = precio_oc * 0.05
            precio_ok = diff_precio <= tolerancia_precio

            # Determinar estado
            # matching_resultado CHECK: 'match', 'quantity_mismatch', 'price_mismatch', 'both_mismatch', 'no_receipt'
            if cantidad_ok and precio_ok:
                estado_match = 'match'
                matched_count += 1
            elif not cantidad_ok and not precio_ok:
                estado_match = 'both_mismatch'
                disputed_count += 1
            elif not cantidad_ok:
                estado_match = 'quantity_mismatch'
                partial_count += 1
            else:
                estado_match = 'price_mismatch'
                partial_count += 1

            # Insertar resultado
            # matching_resultado columns: factura_id, orden_compra_id, recepcion_id,
            #   estado, diferencia_cantidad, diferencia_precio, tolerancia_aplicada,
            #   aprobado_por, notas
            notas_detalle = (
                f"Material: {material_codigo}, "
                f"Cant factura: {cantidad_factura}, Cant OC: {cantidad_oc}, "
                f"Precio factura: {precio_factura}, Precio OC: {precio_oc}"
            )
            cursor.execute(f"""
                INSERT INTO matching_resultado
                (factura_id, orden_compra_id, estado, diferencia_cantidad,
                 diferencia_precio, tolerancia_aplicada, notas, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, {sql_datetime_now()})
            """, (
                factura_id, orden_compra_id, estado_match,
                diff_cantidad, diff_precio,
                tolerancia_cantidad, notas_detalle
            ))

            resultados.append({
                'material_codigo': material_codigo,
                'estado': estado_match,
                'diferencia_cantidad': float(diff_cantidad),
                'diferencia_precio': float(diff_precio)
            })

        # Actualizar estado de factura
        if disputed_count > 0:
            estado_factura = 'disputed'
        elif partial_count > 0:
            estado_factura = 'partial_match'
        else:
            estado_factura = 'matched'

        cursor.execute(
            f"UPDATE factura_proveedor SET estado = {placeholder} WHERE id = {placeholder}",
            (estado_factura, factura_id)
        )

        conn.commit()

        return {
            'factura_id': factura_id,
            'estado': estado_factura,
            'total_items': len(factura_items),
            'matched': matched_count,
            'partial_match': partial_count,
            'disputed': disputed_count,
            'resultados': resultados
        }


def obtener_facturas(filtros: dict) -> dict:
    """
    Obtiene lista paginada de facturas con filtros.

    Args:
        filtros: {
            'estado': str (optional),
            'proveedor_cuit': str (optional),
            'fecha_desde': str (optional),
            'fecha_hasta': str (optional),
            'search': str (optional, busca por numero_factura),
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

    # Construir WHERE clause
    where_clauses = []
    params = []

    if filtros.get('estado'):
        where_clauses.append(f"fp.estado = {placeholder}")
        params.append(filtros['estado'])

    if filtros.get('proveedor_cuit'):
        where_clauses.append(f"fp.proveedor_cuit = {placeholder}")
        params.append(filtros['proveedor_cuit'])

    if filtros.get('fecha_desde'):
        where_clauses.append(f"fp.fecha_factura >= {placeholder}")
        params.append(filtros['fecha_desde'])

    if filtros.get('fecha_hasta'):
        where_clauses.append(f"fp.fecha_factura <= {placeholder}")
        params.append(filtros['fecha_hasta'])

    if filtros.get('search'):
        where_clauses.append(f"fp.numero_factura LIKE {placeholder}")
        params.append(f"%{filtros['search']}%")

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Contar total
        cursor.execute(
            f"SELECT COUNT(*) FROM factura_proveedor fp {where_sql}",
            params
        )
        total = cursor.fetchone()[0]

        # Obtener items
        cursor.execute(
            f"""
            SELECT
                fp.id, fp.numero_factura, fp.fecha_factura, fp.proveedor_cuit,
                p.nombre as proveedor_nombre, fp.monto_total, fp.moneda, fp.estado,
                fp.created_at, oc.numero_oc as orden_compra_numero
            FROM factura_proveedor fp
            LEFT JOIN proveedores p ON fp.proveedor_cuit = p.id_proveedor
            LEFT JOIN orden_compra oc ON fp.orden_compra_id = oc.id
            {where_sql}
            ORDER BY fp.created_at DESC
            LIMIT {placeholder} OFFSET {placeholder}
            """,
            params + [per_page, offset]
        )

        rows = cursor.fetchall()
        items = []
        for row in rows:
            items.append({
                'id': row[0],
                'numero_factura': row[1],
                'fecha_factura': row[2],
                'proveedor_cuit': row[3],
                'proveedor_nombre': row[4],
                'monto_total': float(row[5]) if row[5] else 0,
                'moneda': row[6],
                'estado': row[7],
                'created_at': row[8],
                'orden_compra_numero': row[9]
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


def obtener_detalle_factura(factura_id: int) -> dict:
    """
    Obtiene detalle completo de una factura con items y resultados de matching.

    Args:
        factura_id: ID de la factura

    Returns:
        Diccionario con datos completos de la factura
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener factura
        cursor.execute(
            f"""
            SELECT
                fp.id, fp.numero_factura, fp.fecha_factura, fp.proveedor_cuit,
                p.nombre as proveedor_nombre, fp.monto_total, fp.moneda, fp.estado,
                fp.orden_compra_id, oc.numero_oc as orden_compra_numero,
                fp.created_at, fp.subido_por,
                u.nombre as subido_por_nombre
            FROM factura_proveedor fp
            LEFT JOIN proveedores p ON fp.proveedor_cuit = p.id_proveedor
            LEFT JOIN orden_compra oc ON fp.orden_compra_id = oc.id
            LEFT JOIN usuarios u ON CAST(fp.subido_por AS TEXT) = u.id_spm
            WHERE fp.id = {placeholder}
            """,
            (factura_id,)
        )

        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Factura {factura_id} no encontrada")

        factura = {
            'id': row[0],
            'numero_factura': row[1],
            'fecha_factura': row[2],
            'proveedor_cuit': row[3],
            'proveedor_nombre': row[4],
            'monto_total': float(row[5]) if row[5] else 0,
            'moneda': row[6],
            'estado': row[7],
            'orden_compra_id': row[8],
            'orden_compra_numero': row[9],
            'created_at': row[10],
            'subido_por': row[11],
            'subido_por_nombre': row[12]
        }

        # Obtener items
        cursor.execute(
            f"""
            SELECT
                fi.id, fi.material_codigo, fi.cantidad_facturada, fi.precio_unitario,
                fi.precio_total, m.descripcion as material_descripcion
            FROM factura_item fi
            LEFT JOIN catalogo_materiales m ON fi.material_codigo = m.codigo
            WHERE fi.factura_id = {placeholder}
            """,
            (factura_id,)
        )

        items = []
        for row in cursor.fetchall():
            items.append({
                'id': row[0],
                'material_codigo': row[1],
                'cantidad': float(row[2]) if row[2] else 0,
                'precio_unitario': float(row[3]) if row[3] else 0,
                'precio_total': float(row[4]) if row[4] else 0,
                'material_descripcion': row[5]
            })

        factura['items'] = items

        # Obtener resultados de matching
        # matching_resultado actual columns: id, factura_id, orden_compra_id,
        #   recepcion_id, estado, diferencia_cantidad, diferencia_precio,
        #   tolerancia_aplicada, aprobado_por, notas, created_at
        cursor.execute(
            f"""
            SELECT
                mr.id, mr.estado, mr.diferencia_cantidad, mr.diferencia_precio,
                mr.tolerancia_aplicada, mr.aprobado_por,
                u.nombre as aprobado_por_nombre, mr.notas
            FROM matching_resultado mr
            LEFT JOIN usuarios u ON CAST(mr.aprobado_por AS TEXT) = u.id_spm
            WHERE mr.factura_id = {placeholder}
            """,
            (factura_id,)
        )

        matching_results = []
        for row in cursor.fetchall():
            matching_results.append({
                'id': row[0],
                'estado': row[1],
                'diferencia_cantidad': float(row[2]) if row[2] else 0,
                'diferencia_precio': float(row[3]) if row[3] else 0,
                'tolerancia_aplicada': float(row[4]) if row[4] else 0,
                'aprobado_por': row[5],
                'aprobado_por_nombre': row[6],
                'notas': row[7]
            })

        factura['matching_results'] = matching_results

        return factura
    finally:
        cursor.close()
        conn.close()


def resolver_discrepancia(resultado_id: int, data: dict, user_id: int) -> dict:
    """
    Resuelve una discrepancia de matching.

    Args:
        resultado_id: ID del matching_resultado
        data: {
            'notas': str (optional)
        }
        user_id: ID del usuario aprobando

    Returns:
        Resultado actualizado
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Actualizar resultado
        cursor.execute(
            f"""
            UPDATE matching_resultado
            SET aprobado_por = {placeholder}, notas = {placeholder}
            WHERE id = {placeholder}
            """,
            (user_id, data.get('notas'), resultado_id)
        )

        # Obtener factura_id
        cursor.execute(
            f"SELECT factura_id FROM matching_resultado WHERE id = {placeholder}",
            (resultado_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Resultado de matching {resultado_id} no encontrado")
        factura_id = row[0]

        # Verificar si todos los resultados están resueltos
        cursor.execute(
            f"""
            SELECT COUNT(*) FROM matching_resultado
            WHERE factura_id = {placeholder}
              AND estado IN ('quantity_mismatch', 'price_mismatch', 'both_mismatch')
              AND aprobado_por IS NULL
            """,
            (factura_id,)
        )
        pending_count = cursor.fetchone()[0]

        # Si no hay pendientes, aprobar factura
        if pending_count == 0:
            cursor.execute(
                f"UPDATE factura_proveedor SET estado = 'approved' WHERE id = {placeholder}",
                (factura_id,)
            )

        conn.commit()

        # Obtener resultado actualizado
        cursor.execute(
            f"""
            SELECT
                id, factura_id, estado,
                diferencia_cantidad, diferencia_precio, aprobado_por, notas
            FROM matching_resultado
            WHERE id = {placeholder}
            """,
            (resultado_id,)
        )
        row = cursor.fetchone()

        return {
            'id': row[0],
            'factura_id': row[1],
            'estado': row[2],
            'diferencia_cantidad': float(row[3]) if row[3] else 0,
            'diferencia_precio': float(row[4]) if row[4] else 0,
            'aprobado_por': row[5],
            'notas': row[6],
            'factura_estado_actualizado': pending_count == 0
        }


def obtener_kpis_matching() -> dict:
    """
    Obtiene KPIs del proceso de matching.

    Returns:
        {
            'total_facturas': int,
            'matched_pct': float,
            'disputed_pct': float,
            'avg_diferencia_precio': float,
            'pending_count': int
        }
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Total de facturas
        cursor.execute("SELECT COUNT(*) FROM factura_proveedor")
        total_facturas = cursor.fetchone()[0]

        # Facturas por estado
        cursor.execute("""
            SELECT estado, COUNT(*)
            FROM factura_proveedor
            GROUP BY estado
        """)
        estados = {row[0]: row[1] for row in cursor.fetchall()}

        matched_count = estados.get('matched', 0)
        disputed_count = estados.get('disputed', 0)
        pending_count = estados.get('pending', 0)

        matched_pct = (matched_count / total_facturas * 100) if total_facturas > 0 else 0
        disputed_pct = (disputed_count / total_facturas * 100) if total_facturas > 0 else 0

        # Diferencia promedio de precio
        cursor.execute("""
            SELECT AVG(diferencia_precio)
            FROM matching_resultado
            WHERE diferencia_precio IS NOT NULL
        """)
        avg_diferencia_precio = cursor.fetchone()[0] or 0

        return {
            'total_facturas': total_facturas,
            'matched_pct': round(matched_pct, 2),
            'disputed_pct': round(disputed_pct, 2),
            'avg_diferencia_precio': round(float(avg_diferencia_precio), 2),
            'pending_count': pending_count,
            'por_estado': estados
        }
    finally:
        cursor.close()
        conn.close()


def obtener_comparacion(factura_id: int) -> dict:
    """
    Obtiene comparación lado a lado: PO vs Receipt vs Invoice.

    Args:
        factura_id: ID de la factura

    Returns:
        Lista de líneas comparativas
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener orden_compra_id
        cursor.execute(
            f"SELECT orden_compra_id FROM factura_proveedor WHERE id = {placeholder}",
            (factura_id,)
        )
        result = cursor.fetchone()
        if not result or not result[0]:
            return {'comparaciones': []}

        orden_compra_id = result[0]

        # Obtener todos los materiales involucrados
        cursor.execute(
            f"""
            SELECT DISTINCT material_codigo FROM (
                SELECT material_codigo FROM factura_item WHERE factura_id = {placeholder}
                UNION
                SELECT material_codigo FROM orden_compra_item WHERE orden_compra_id = {placeholder}
            ) materiales
            """,
            (factura_id, orden_compra_id)
        )

        materiales = [row[0] for row in cursor.fetchall()]
        comparaciones = []

        for material_codigo in materiales:
            # Datos de OC
            cursor.execute(
                f"""
                SELECT cantidad, precio_unitario
                FROM orden_compra_item
                WHERE orden_compra_id = {placeholder} AND material_codigo = {placeholder}
                """,
                (orden_compra_id, material_codigo)
            )
            oc_data = cursor.fetchone()

            # Receipt data not available via inspeccion_entrada (no orden_compra_id column)
            # Default to OC quantity
            recepcion_cantidad = float(oc_data[0]) if oc_data and oc_data[0] else 0

            # Datos de factura
            cursor.execute(
                f"""
                SELECT cantidad_facturada, precio_unitario
                FROM factura_item
                WHERE factura_id = {placeholder} AND material_codigo = {placeholder}
                """,
                (factura_id, material_codigo)
            )
            factura_data = cursor.fetchone()

            comparaciones.append({
                'material_codigo': material_codigo,
                'po': {
                    'cantidad': float(oc_data[0]) if oc_data and oc_data[0] else 0,
                    'precio_unitario': float(oc_data[1]) if oc_data and oc_data[1] else 0
                },
                'receipt': {
                    'cantidad': recepcion_cantidad
                },
                'invoice': {
                    'cantidad': float(factura_data[0]) if factura_data and factura_data[0] else 0,
                    'precio_unitario': float(factura_data[1]) if factura_data and factura_data[1] else 0
                }
            })

        return {'comparaciones': comparaciones}
    finally:
        cursor.close()
        conn.close()
