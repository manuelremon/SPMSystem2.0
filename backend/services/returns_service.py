"""
Servicio de devoluciones y logística inversa (RMA - Return Merchandise Authorization).

Gestiona el proceso completo de devoluciones a proveedores:
- Creación de RMA desde inspecciones/NCR
- Seguimiento de estado
- Registro de créditos
- KPIs de recuperación
"""

from datetime import datetime

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

# FSM para estados de devolución
ESTADOS_VALIDOS = {
    'draft': ['pending_approval', 'cancelled'],
    'pending_approval': ['approved', 'cancelled'],
    'approved': ['in_transit', 'cancelled'],
    'in_transit': ['received_by_supplier'],
    'received_by_supplier': ['credit_issued'],
    'credit_issued': ['closed'],
    'closed': [],
    'cancelled': []
}


def crear_devolucion(data: dict, user_id: int) -> int:
    """
    Crea una nueva devolución (RMA).

    Args:
        data: {
            'proveedor_cuit': str,
            'orden_compra_id': int (optional),
            'tipo': str ('defecto', 'exceso', 'incorrecto', 'otro'),
            'motivo': str,
            'items': [
                {
                    'material_codigo': str,
                    'cantidad': float,
                    'motivo_detalle': str (optional)
                }
            ]
        }
        user_id: ID del usuario creando la devolución

    Returns:
        ID de la devolución creada
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        # Generar numero_rma
        fecha_now = datetime.now()
        fecha_str = fecha_now.strftime('%Y%m%d')

        if using_pg:
            cursor.execute(
                "SELECT COUNT(*) FROM devolucion WHERE numero_rma LIKE %s",
                (f'RMA-{fecha_str}-%',)
            )
        else:
            cursor.execute(
                "SELECT COUNT(*) FROM devolucion WHERE numero_rma LIKE ?",
                (f'RMA-{fecha_str}-%',)
            )

        count = cursor.fetchone()[0] + 1
        numero_rma = f"RMA-{fecha_str}-{count:04d}"

        # Insertar devolución
        if using_pg:
            cursor.execute("""
                INSERT INTO devolucion
                (numero_rma, proveedor_cuit, orden_compra_id, tipo, motivo,
                 estado, creado_por, created_at)
                VALUES (%s, %s, %s, %s, %s, 'draft', %s, NOW())
                RETURNING id
            """, (
                numero_rma,
                data['proveedor_cuit'],
                data.get('orden_compra_id'),
                data['tipo'],
                data['motivo'],
                user_id
            ))
            devolucion_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO devolucion
                (numero_rma, proveedor_cuit, orden_compra_id, tipo, motivo,
                 estado, creado_por, created_at)
                VALUES (?, ?, ?, ?, ?, 'draft', ?, datetime('now'))
            """, (
                numero_rma,
                data['proveedor_cuit'],
                data.get('orden_compra_id'),
                data['tipo'],
                data['motivo'],
                user_id
            ))
            devolucion_id = cursor.lastrowid

        # Insertar items
        for item in data['items']:
            if using_pg:
                cursor.execute("""
                    INSERT INTO devolucion_item
                    (devolucion_id, material_codigo, cantidad, motivo_detalle)
                    VALUES (%s, %s, %s, %s)
                """, (
                    devolucion_id,
                    item['material_codigo'],
                    item['cantidad'],
                    item.get('motivo_detalle')
                ))
            else:
                cursor.execute("""
                    INSERT INTO devolucion_item
                    (devolucion_id, material_codigo, cantidad, motivo_detalle)
                    VALUES (?, ?, ?, ?)
                """, (
                    devolucion_id,
                    item['material_codigo'],
                    item['cantidad'],
                    item.get('motivo_detalle')
                ))

        # Insertar historial inicial
        if using_pg:
            cursor.execute("""
                INSERT INTO devolucion_historial
                (devolucion_id, estado, user_id, notas, created_at)
                VALUES (%s, 'draft', %s, 'Devolución creada', NOW())
            """, (devolucion_id, user_id))
        else:
            cursor.execute("""
                INSERT INTO devolucion_historial
                (devolucion_id, estado, user_id, notas, created_at)
                VALUES (?, 'draft', ?, 'Devolución creada', datetime('now'))
            """, (devolucion_id, user_id))

        conn.commit()
        return devolucion_id


def crear_desde_ncr(ncr_id: int, user_id: int) -> int:
    """
    Crea una devolución automáticamente desde un NCR.

    Args:
        ncr_id: ID del NCR
        user_id: ID del usuario creando la devolución

    Returns:
        ID de la devolución creada
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener datos del NCR
        cursor.execute(
            f"""
            SELECT
                n.id, n.descripcion,
                ie.orden_compra_id, oc.proveedor_cuit,
                ii.material_codigo, ii.cantidad_recibida
            FROM ncr n
            JOIN inspeccion_item ii ON n.inspeccion_item_id = ii.id
            JOIN inspeccion_entrada ie ON ii.inspeccion_id = ie.id
            JOIN orden_compra oc ON ie.orden_compra_id = oc.id
            WHERE n.id = {placeholder}
            """,
            (ncr_id,)
        )

        row = cursor.fetchone()
        if not row:
            raise ValueError(f"NCR {ncr_id} no encontrado")

        row[0]
        descripcion = row[1]
        orden_compra_id = row[2]
        proveedor_cuit = row[3]
        material_codigo = row[4]
        cantidad = row[5]

        # Crear devolución
        data = {
            'proveedor_cuit': proveedor_cuit,
            'orden_compra_id': orden_compra_id,
            'tipo': 'defecto',
            'motivo': f"NCR {ncr_id}: {descripcion}",
            'items': [
                {
                    'material_codigo': material_codigo,
                    'cantidad': cantidad,
                    'motivo_detalle': descripcion
                }
            ]
        }

        return crear_devolucion(data, user_id)

    finally:
        cursor.close()
        conn.close()


def obtener_devoluciones(filtros: dict) -> dict:
    """
    Obtiene lista paginada de devoluciones.

    Args:
        filtros: {
            'estado': str (optional),
            'tipo': str (optional),
            'proveedor_cuit': str (optional),
            'search': str (optional, busca por numero_rma),
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

    if filtros.get('estado'):
        where_clauses.append(f"d.estado = {placeholder}")
        params.append(filtros['estado'])

    if filtros.get('tipo'):
        where_clauses.append(f"d.tipo = {placeholder}")
        params.append(filtros['tipo'])

    if filtros.get('proveedor_cuit'):
        where_clauses.append(f"d.proveedor_cuit = {placeholder}")
        params.append(filtros['proveedor_cuit'])

    if filtros.get('search'):
        where_clauses.append(f"d.numero_rma LIKE {placeholder}")
        params.append(f"%{filtros['search']}%")

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Contar total
        cursor.execute(
            f"SELECT COUNT(*) FROM devolucion d {where_sql}",
            params
        )
        total = cursor.fetchone()[0]

        # Obtener items
        cursor.execute(
            f"""
            SELECT
                d.id, d.numero_rma, d.proveedor_cuit,
                p.nombre as proveedor_nombre,
                d.tipo, d.estado, d.monto_credito_esperado,
                d.monto_credito_recibido, d.created_at,
                oc.numero_oc as orden_compra_numero,
                COUNT(di.id) as num_items
            FROM devolucion d
            LEFT JOIN proveedores p ON d.proveedor_cuit = p.id_proveedor
            LEFT JOIN orden_compra oc ON d.orden_compra_id = oc.id
            LEFT JOIN devolucion_item di ON d.id = di.devolucion_id
            {where_sql}
            GROUP BY d.id, d.numero_rma, d.proveedor_cuit, p.nombre,
                     d.tipo, d.estado, d.monto_credito_esperado,
                     d.monto_credito_recibido, d.created_at, oc.numero_oc
            ORDER BY d.created_at DESC
            LIMIT {placeholder} OFFSET {placeholder}
            """,
            params + [per_page, offset]
        )

        items = []
        for row in cursor.fetchall():
            items.append({
                'id': row[0],
                'numero_rma': row[1],
                'proveedor_cuit': row[2],
                'proveedor_nombre': row[3],
                'tipo': row[4],
                'estado': row[5],
                'monto_credito_esperado': float(row[6]) if row[6] else 0,
                'monto_credito_recibido': float(row[7]) if row[7] else 0,
                'created_at': row[8],
                'orden_compra_numero': row[9],
                'num_items': row[10]
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


def obtener_detalle_devolucion(devolucion_id: int) -> dict:
    """
    Obtiene detalle completo de una devolución.

    Args:
        devolucion_id: ID de la devolución

    Returns:
        Diccionario con datos completos
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener devolución
        cursor.execute(
            f"""
            SELECT
                d.id, d.numero_rma, d.proveedor_cuit,
                p.nombre as proveedor_nombre,
                d.orden_compra_id, oc.numero_oc as orden_compra_numero,
                d.tipo, d.motivo, d.estado,
                d.monto_credito_esperado, d.monto_credito_recibido,
                d.fecha_envio, d.fecha_recepcion_proveedor,
                d.created_at, d.creado_por,
                u.nombre as creado_por_nombre
            FROM devolucion d
            LEFT JOIN proveedores p ON d.proveedor_cuit = p.id_proveedor
            LEFT JOIN orden_compra oc ON d.orden_compra_id = oc.id
            LEFT JOIN usuarios u ON d.creado_por = u.id_spm
            WHERE d.id = {placeholder}
            """,
            (devolucion_id,)
        )

        row = cursor.fetchone()
        if not row:
            raise ValueError(f"Devolución {devolucion_id} no encontrada")

        devolucion = {
            'id': row[0],
            'numero_rma': row[1],
            'proveedor_cuit': row[2],
            'proveedor_nombre': row[3],
            'orden_compra_id': row[4],
            'orden_compra_numero': row[5],
            'tipo': row[6],
            'motivo': row[7],
            'estado': row[8],
            'monto_credito_esperado': float(row[9]) if row[9] else 0,
            'monto_credito_recibido': float(row[10]) if row[10] else 0,
            'fecha_envio': row[11],
            'fecha_recepcion_proveedor': row[12],
            'created_at': row[13],
            'creado_por': row[14],
            'creado_por_nombre': row[15]
        }

        # Obtener items
        cursor.execute(
            f"""
            SELECT
                di.id, di.material_codigo, m.descripcion as material_descripcion,
                di.cantidad, di.motivo_detalle
            FROM devolucion_item di
            LEFT JOIN catalogo_materiales m ON di.material_codigo = m.codigo
            WHERE di.devolucion_id = {placeholder}
            """,
            (devolucion_id,)
        )

        items = []
        for row in cursor.fetchall():
            items.append({
                'id': row[0],
                'material_codigo': row[1],
                'material_descripcion': row[2],
                'cantidad': float(row[3]) if row[3] else 0,
                'motivo_detalle': row[4]
            })

        devolucion['items'] = items

        # Obtener historial
        cursor.execute(
            f"""
            SELECT
                dh.estado, dh.user_id, u.nombre as user_nombre,
                dh.notas, dh.created_at
            FROM devolucion_historial dh
            LEFT JOIN usuarios u ON dh.user_id = u.id_spm
            WHERE dh.devolucion_id = {placeholder}
            ORDER BY dh.created_at ASC
            """,
            (devolucion_id,)
        )

        historial = []
        for row in cursor.fetchall():
            historial.append({
                'estado': row[0],
                'user_id': row[1],
                'user_nombre': row[2],
                'notas': row[3],
                'created_at': row[4]
            })

        devolucion['historial'] = historial

        return devolucion
    finally:
        cursor.close()
        conn.close()


def cambiar_estado(devolucion_id: int, nuevo_estado: str, user_id: int, notas: str = None) -> dict:
    """
    Cambia el estado de una devolución (FSM).

    Args:
        devolucion_id: ID de la devolución
        nuevo_estado: Nuevo estado destino
        user_id: ID del usuario realizando el cambio
        notas: Notas adicionales (opcional)

    Returns:
        Devolución actualizada
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Obtener estado actual
        cursor.execute(
            f"SELECT estado FROM devolucion WHERE id = {placeholder}",
            (devolucion_id,)
        )
        result = cursor.fetchone()
        if not result:
            raise ValueError(f"Devolución {devolucion_id} no encontrada")

        estado_actual = result[0]

        # Validar transición
        if nuevo_estado not in ESTADOS_VALIDOS.get(estado_actual, []):
            raise ValueError(
                f"Transición inválida: {estado_actual} → {nuevo_estado}. "
                f"Estados permitidos: {ESTADOS_VALIDOS.get(estado_actual, [])}"
            )

        # Actualizar fechas según estado
        updates = [f"estado = {placeholder}"]
        params = [nuevo_estado]

        if nuevo_estado == 'in_transit':
            if using_pg:
                updates.append("fecha_envio = NOW()")
            else:
                updates.append("fecha_envio = datetime('now')")

        if nuevo_estado == 'received_by_supplier':
            if using_pg:
                updates.append("fecha_recepcion_proveedor = NOW()")
            else:
                updates.append("fecha_recepcion_proveedor = datetime('now')")

        params.append(devolucion_id)

        # Actualizar estado
        cursor.execute(
            f"UPDATE devolucion SET {', '.join(updates)} WHERE id = {placeholder}",
            params
        )

        # Insertar en historial
        if using_pg:
            cursor.execute("""
                INSERT INTO devolucion_historial
                (devolucion_id, estado, user_id, notas, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (devolucion_id, nuevo_estado, user_id, notas))
        else:
            cursor.execute("""
                INSERT INTO devolucion_historial
                (devolucion_id, estado, user_id, notas, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            """, (devolucion_id, nuevo_estado, user_id, notas))

        conn.commit()

        # Obtener devolución actualizada
        cursor.execute(
            f"""
            SELECT id, numero_rma, estado, fecha_envio, fecha_recepcion_proveedor
            FROM devolucion
            WHERE id = {placeholder}
            """,
            (devolucion_id,)
        )
        row = cursor.fetchone()

        return {
            'id': row[0],
            'numero_rma': row[1],
            'estado': row[2],
            'fecha_envio': row[3],
            'fecha_recepcion_proveedor': row[4]
        }


def registrar_credito(devolucion_id: int, monto: float, user_id: int) -> dict:
    """
    Registra el crédito recibido del proveedor.

    Args:
        devolucion_id: ID de la devolución
        monto: Monto del crédito recibido
        user_id: ID del usuario registrando

    Returns:
        Devolución actualizada
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Obtener estado actual
        cursor.execute(
            f"SELECT estado FROM devolucion WHERE id = {placeholder}",
            (devolucion_id,)
        )
        result = cursor.fetchone()
        if not result:
            raise ValueError(f"Devolución {devolucion_id} no encontrada")

        estado_actual = result[0]

        # Actualizar monto
        cursor.execute(
            f"UPDATE devolucion SET monto_credito_recibido = {placeholder} WHERE id = {placeholder}",
            (monto, devolucion_id)
        )

        # Si el estado es received_by_supplier, cambiar a credit_issued
        if estado_actual == 'received_by_supplier':
            cursor.execute(
                f"UPDATE devolucion SET estado = 'credit_issued' WHERE id = {placeholder}",
                (devolucion_id,)
            )

            # Insertar en historial
            if using_pg:
                cursor.execute("""
                    INSERT INTO devolucion_historial
                    (devolucion_id, estado, user_id, notas, created_at)
                    VALUES (%s, 'credit_issued', %s, %s, NOW())
                """, (devolucion_id, user_id, f"Crédito registrado: ${monto:.2f}"))
            else:
                cursor.execute("""
                    INSERT INTO devolucion_historial
                    (devolucion_id, estado, user_id, notas, created_at)
                    VALUES (?, 'credit_issued', ?, ?, datetime('now'))
                """, (devolucion_id, user_id, f"Crédito registrado: ${monto:.2f}"))

        conn.commit()

        # Obtener devolución actualizada
        cursor.execute(
            f"""
            SELECT id, numero_rma, estado, monto_credito_recibido
            FROM devolucion
            WHERE id = {placeholder}
            """,
            (devolucion_id,)
        )
        row = cursor.fetchone()

        return {
            'id': row[0],
            'numero_rma': row[1],
            'estado': row[2],
            'monto_credito_recibido': float(row[3]) if row[3] else 0
        }


def obtener_kpis_devoluciones() -> dict:
    """
    Obtiene KPIs del proceso de devoluciones.

    Returns:
        {
            'total': int,
            'por_estado': {...},
            'monto_credito_esperado': float,
            'monto_credito_recibido': float,
            'tasa_recuperacion': float (%)
        }
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Total de devoluciones
        cursor.execute("SELECT COUNT(*) FROM devolucion")
        total = cursor.fetchone()[0]

        # Por estado
        cursor.execute("""
            SELECT estado, COUNT(*)
            FROM devolucion
            GROUP BY estado
        """)
        por_estado = {row[0]: row[1] for row in cursor.fetchall()}

        # Montos
        cursor.execute("""
            SELECT
                SUM(monto_credito_esperado) as esperado,
                SUM(monto_credito_recibido) as recibido
            FROM devolucion
            WHERE estado != 'cancelled'
        """)
        row = cursor.fetchone()
        monto_esperado = float(row[0]) if row and row[0] else 0
        monto_recibido = float(row[1]) if row and row[1] else 0

        tasa_recuperacion = (monto_recibido / monto_esperado * 100) if monto_esperado > 0 else 0

        return {
            'total': total,
            'por_estado': por_estado,
            'monto_credito_esperado': round(monto_esperado, 2),
            'monto_credito_recibido': round(monto_recibido, 2),
            'tasa_recuperacion': round(tasa_recuperacion, 2)
        }
    finally:
        cursor.close()
        conn.close()
