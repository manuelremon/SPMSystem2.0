"""
Contract Service
Gestión de contratos con proveedores (Sprints 54-56)

Funciones:
- CRUD de contratos (blanket PO, fixed price, time & materials, framework)
- Gestión de estados (draft, under_negotiation, active, suspended, expired, terminated)
- Items de contrato con precios contractuales
- Documentos adjuntos
- Alertas de vencimiento
- Consumo de cantidades comprometidas
"""

import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql
from backend.core.errors import BusinessRuleError, NotFoundError, ValidationError

# ============================================================================
# CONTRATOS - CRUD
# ============================================================================

def crear_contrato(data: Dict[str, Any], user_id: int) -> int:
    """
    Crear un nuevo contrato en estado draft.
    Auto-genera numero_contrato con formato CONT-YYYYMMDD-XXX

    Args:
        data: tipo, proveedor_cuit, proveedor_nombre, fecha_inicio, fecha_vencimiento,
              valor_total, moneda, centro, notas
        user_id: ID del usuario creador

    Returns:
        ID del contrato creado
    """
    required = ['tipo', 'proveedor_cuit', 'proveedor_nombre']
    for field in required:
        if field not in data or not data[field]:
            raise ValidationError(f"Campo requerido: {field}")

    # Validar tipo
    tipos_validos = ['blanket_po', 'fixed_price', 'time_materials', 'framework']
    if data['tipo'] not in tipos_validos:
        raise ValidationError(f"Tipo de contrato inválido. Debe ser uno de: {tipos_validos}")

    # Generar numero_contrato
    numero_contrato = _generar_numero_contrato()

    with get_db_transaction() as (conn, cursor):
        cursor.execute("""
            INSERT INTO contrato (
                numero_contrato, tipo, proveedor_cuit, proveedor_nombre,
                estado, fecha_inicio, fecha_vencimiento, valor_total,
                moneda, centro, notas, creado_por
            ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)
        """, (
            numero_contrato,
            data['tipo'],
            data['proveedor_cuit'],
            data['proveedor_nombre'],
            data.get('fecha_inicio'),
            data.get('fecha_vencimiento'),
            data.get('valor_total', 0),
            data.get('moneda', 'ARS'),
            data.get('centro'),
            data.get('notas'),
            user_id
        ))

        contrato_id = cursor.lastrowid

        # Registrar historial inicial
        cursor.execute("""
            INSERT INTO contrato_historial (contrato_id, estado_anterior, estado_nuevo, actor_id, razon)
            VALUES (?, NULL, 'draft', ?, 'Contrato creado')
        """, (contrato_id, user_id))

        conn.commit()
        return contrato_id


def _generar_numero_contrato() -> str:
    """Generar número de contrato único con formato CONT-YYYYMMDD-XXX"""
    fecha_str = datetime.now().strftime("%Y%m%d")
    prefijo = f"CONT-{fecha_str}"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM contrato
            WHERE numero_contrato LIKE ?
        """, (f"{prefijo}%",))
        count = cursor.fetchone()[0]

    secuencia = str(count + 1).zfill(3)
    return f"{prefijo}-{secuencia}"


def obtener_contratos(filtros: Dict[str, Any]) -> Dict[str, Any]:
    """
    Listar contratos con paginación y filtros.

    Filtros:
        - estado: draft, under_negotiation, active, suspended, expired, terminated
        - tipo: blanket_po, fixed_price, time_materials, framework
        - proveedor: buscar en proveedor_cuit o proveedor_nombre
        - centro: filtrar por centro
        - fecha_desde: contratos con fecha_inicio >= fecha
        - fecha_hasta: contratos con fecha_vencimiento <= fecha
        - search: buscar en numero_contrato, proveedor_nombre, notas
        - page, per_page: paginación

    Returns:
        {contratos: [...], total: X, page: Y, per_page: Z, total_pages: W}
    """
    page = filtros.get('page', 1)
    per_page = filtros.get('per_page', 20)
    offset = (page - 1) * per_page

    # Construir WHERE clause
    where_clauses = ["deleted = 0"]
    params = []

    if filtros.get('estado'):
        where_clauses.append("estado = ?")
        params.append(filtros['estado'])

    if filtros.get('tipo'):
        where_clauses.append("tipo = ?")
        params.append(filtros['tipo'])

    if filtros.get('proveedor'):
        where_clauses.append("(proveedor_cuit LIKE ? OR proveedor_nombre LIKE ?)")
        like_val = f"%{filtros['proveedor']}%"
        params.extend([like_val, like_val])

    if filtros.get('centro'):
        where_clauses.append("centro = ?")
        params.append(filtros['centro'])

    if filtros.get('fecha_desde'):
        where_clauses.append("fecha_inicio >= ?")
        params.append(filtros['fecha_desde'])

    if filtros.get('fecha_hasta'):
        where_clauses.append("fecha_vencimiento <= ?")
        params.append(filtros['fecha_hasta'])

    if filtros.get('search'):
        where_clauses.append("(numero_contrato LIKE ? OR proveedor_nombre LIKE ? OR notas LIKE ?)")
        like_search = f"%{filtros['search']}%"
        params.extend([like_search, like_search, like_search])

    where_sql = " AND ".join(where_clauses)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Count total
        cursor.execute(f"SELECT COUNT(*) FROM contrato WHERE {where_sql}", params)
        total = cursor.fetchone()[0]

        # Fetch page
        cursor.execute(f"""
            SELECT id, numero_contrato, tipo, proveedor_cuit, proveedor_nombre,
                   estado, fecha_inicio, fecha_vencimiento, valor_total, moneda,
                   centro, creado_por, aprobado_por, alerta_vencimiento, created_at
            FROM contrato
            WHERE {where_sql}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """, params + [per_page, offset])

        rows = cursor.fetchall()
        contratos = [dict(row) for row in rows]

    total_pages = (total + per_page - 1) // per_page

    return {
        'contratos': contratos,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages
    }


def obtener_detalle_contrato(contrato_id: int) -> Dict[str, Any]:
    """
    Obtener detalle completo de un contrato incluyendo historial.

    Returns:
        {contrato: {...}, historial: [...]}
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Contrato
        cursor.execute("""
            SELECT * FROM contrato WHERE id = ? AND deleted = 0
        """, (contrato_id,))
        row = cursor.fetchone()

        if not row:
            raise NotFoundError(f"Contrato {contrato_id} no encontrado")

        contrato = dict(row)

        # Historial
        cursor.execute("""
            SELECT h.*, u.nombre as actor_nombre
            FROM contrato_historial h
            LEFT JOIN usuarios u ON h.actor_id = u.id
            WHERE h.contrato_id = ?
            ORDER BY h.created_at DESC
        """, (contrato_id,))

        historial = [dict(r) for r in cursor.fetchall()]

    return {
        'contrato': contrato,
        'historial': historial
    }


def actualizar_contrato(contrato_id: int, data: Dict[str, Any], user_id: int) -> None:
    """
    Actualizar campos de un contrato.
    Solo permitido en estados: draft, under_negotiation

    Args:
        contrato_id: ID del contrato
        data: campos a actualizar (tipo, proveedor_*, fecha_*, valor_total, moneda, centro, notas)
        user_id: ID del usuario que actualiza
    """
    with get_db_transaction() as (conn, cursor):
        # Verificar estado actual
        cursor.execute("SELECT estado FROM contrato WHERE id = ? AND deleted = 0", (contrato_id,))
        row = cursor.fetchone()

        if not row:
            raise NotFoundError(f"Contrato {contrato_id} no encontrado")

        estado_actual = row['estado']
        if estado_actual not in ['draft', 'under_negotiation']:
            raise BusinessRuleError(f"No se puede actualizar un contrato en estado {estado_actual}")

        # Construir UPDATE
        campos_permitidos = [
            'tipo', 'proveedor_cuit', 'proveedor_nombre', 'fecha_inicio',
            'fecha_vencimiento', 'valor_total', 'moneda', 'centro', 'notas'
        ]

        update_fields = []
        params = []

        for campo in campos_permitidos:
            if campo in data:
                update_fields.append(f"{campo} = ?")
                params.append(data[campo])

        if not update_fields:
            return  # Nada que actualizar

        # Agregar updated_at
        is_pg = is_using_postgresql()
        if is_pg:
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
        else:
            update_fields.append("updated_at = CURRENT_TIMESTAMP")

        params.append(contrato_id)

        cursor.execute(f"""
            UPDATE contrato
            SET {', '.join(update_fields)}
            WHERE id = ?
        """, params)

        conn.commit()


def soft_delete_contrato(contrato_id: int, user_id: int) -> None:
    """
    Soft delete de un contrato.
    Solo permitido en estado draft.
    """
    with get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT estado FROM contrato WHERE id = ?", (contrato_id,))
        row = cursor.fetchone()

        if not row:
            raise NotFoundError(f"Contrato {contrato_id} no encontrado")

        if row['estado'] != 'draft':
            raise BusinessRuleError("Solo se pueden eliminar contratos en estado draft")

        cursor.execute("UPDATE contrato SET deleted = 1 WHERE id = ?", (contrato_id,))
        conn.commit()


# ============================================================================
# ESTADOS - FSM
# ============================================================================

def cambiar_estado_contrato(contrato_id: int, nuevo_estado: str, user_id: int, razon: str = None) -> None:
    """
    Cambiar estado de un contrato con validación FSM.

    Transiciones válidas:
        draft -> under_negotiation
        under_negotiation -> active
        active -> suspended
        active -> expired
        active -> terminated
        suspended -> active
        draft -> terminated
        under_negotiation -> terminated

    Args:
        contrato_id: ID del contrato
        nuevo_estado: Estado destino
        user_id: ID del usuario que realiza el cambio
        razon: Razón del cambio de estado
    """
    estados_validos = ['draft', 'under_negotiation', 'active', 'suspended', 'expired', 'terminated']

    if nuevo_estado not in estados_validos:
        raise ValidationError(f"Estado inválido: {nuevo_estado}")

    with get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT estado FROM contrato WHERE id = ? AND deleted = 0", (contrato_id,))
        row = cursor.fetchone()

        if not row:
            raise NotFoundError(f"Contrato {contrato_id} no encontrado")

        estado_actual = row['estado']

        # Validar transición
        transiciones = {
            'draft': ['under_negotiation', 'terminated'],
            'under_negotiation': ['active', 'terminated'],
            'active': ['suspended', 'expired', 'terminated'],
            'suspended': ['active'],
        }

        if estado_actual not in transiciones:
            raise BusinessRuleError(f"El estado {estado_actual} no permite transiciones")

        if nuevo_estado not in transiciones[estado_actual]:
            raise BusinessRuleError(
                f"Transición inválida: {estado_actual} -> {nuevo_estado}. "
                f"Estados permitidos: {transiciones[estado_actual]}"
            )

        # Actualizar estado
        cursor.execute("""
            UPDATE contrato
            SET estado = ?, aprobado_por = ?
            WHERE id = ?
        """, (nuevo_estado, user_id if nuevo_estado == 'active' else None, contrato_id))

        # Registrar historial
        cursor.execute("""
            INSERT INTO contrato_historial (contrato_id, estado_anterior, estado_nuevo, actor_id, razon)
            VALUES (?, ?, ?, ?, ?)
        """, (contrato_id, estado_actual, nuevo_estado, user_id, razon))

        conn.commit()


# ============================================================================
# ITEMS DE CONTRATO
# ============================================================================

def agregar_items_contrato(contrato_id: int, items: List[Dict[str, Any]]) -> None:
    """
    Agregar items/líneas a un contrato (bulk insert).

    Args:
        contrato_id: ID del contrato
        items: Lista de dicts con {material_codigo, material_descripcion, precio_unitario,
                                     moneda, cantidad_comprometida, unidad, fecha_vigencia_desde, fecha_vigencia_hasta}
    """
    if not items:
        raise ValidationError("Debe proporcionar al menos un item")

    with get_db_transaction() as (conn, cursor):
        # Verificar que el contrato existe
        cursor.execute("SELECT id FROM contrato WHERE id = ? AND deleted = 0", (contrato_id,))
        if not cursor.fetchone():
            raise NotFoundError(f"Contrato {contrato_id} no encontrado")

        for item in items:
            if 'material_codigo' not in item or 'precio_unitario' not in item:
                raise ValidationError("Cada item debe tener material_codigo y precio_unitario")

            cursor.execute("""
                INSERT INTO contrato_item (
                    contrato_id, material_codigo, material_descripcion, precio_unitario,
                    moneda, cantidad_comprometida, unidad, fecha_vigencia_desde, fecha_vigencia_hasta
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                contrato_id,
                item['material_codigo'],
                item.get('material_descripcion'),
                item['precio_unitario'],
                item.get('moneda', 'ARS'),
                item.get('cantidad_comprometida'),
                item.get('unidad', 'UN'),
                item.get('fecha_vigencia_desde'),
                item.get('fecha_vigencia_hasta')
            ))

        conn.commit()


def obtener_items_contrato(contrato_id: int) -> List[Dict[str, Any]]:
    """
    Listar items de un contrato con progreso de consumo.

    Returns:
        Lista de items con porcentaje_consumido calculado
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM contrato_item
            WHERE contrato_id = ?
            ORDER BY created_at
        """, (contrato_id,))

        items = [dict(row) for row in cursor.fetchall()]

        # Calcular porcentaje consumido
        for item in items:
            if item['cantidad_comprometida'] and item['cantidad_comprometida'] > 0:
                item['porcentaje_consumido'] = round(
                    (item['cantidad_consumida'] / item['cantidad_comprometida']) * 100, 2
                )
            else:
                item['porcentaje_consumido'] = 0

    return items


def actualizar_item_contrato(item_id: int, data: Dict[str, Any]) -> None:
    """
    Actualizar campos de un item de contrato.

    Args:
        item_id: ID del item
        data: Campos a actualizar
    """
    with get_db_transaction() as (conn, cursor):
        cursor.execute("SELECT id FROM contrato_item WHERE id = ?", (item_id,))
        if not cursor.fetchone():
            raise NotFoundError(f"Item {item_id} no encontrado")

        campos_permitidos = [
            'material_descripcion', 'precio_unitario', 'moneda',
            'cantidad_comprometida', 'unidad', 'fecha_vigencia_desde',
            'fecha_vigencia_hasta', 'activo'
        ]

        update_fields = []
        params = []

        for campo in campos_permitidos:
            if campo in data:
                update_fields.append(f"{campo} = ?")
                params.append(data[campo])

        if not update_fields:
            return

        params.append(item_id)

        cursor.execute(f"""
            UPDATE contrato_item
            SET {', '.join(update_fields)}
            WHERE id = ?
        """, params)

        conn.commit()


def eliminar_item_contrato(item_id: int) -> None:
    """Eliminar un item de contrato"""
    with get_db_transaction() as (conn, cursor):
        cursor.execute("DELETE FROM contrato_item WHERE id = ?", (item_id,))
        conn.commit()


def obtener_precio_contractual(material_codigo: str, proveedor_cuit: str, fecha: str = None) -> Optional[float]:
    """
    Buscar precio contractual para un material + proveedor en una fecha.

    Args:
        material_codigo: Código SAP del material
        proveedor_cuit: CUIT del proveedor
        fecha: Fecha de consulta (default: hoy). Formato YYYY-MM-DD

    Returns:
        precio_unitario o None si no hay contrato activo
    """
    if not fecha:
        fecha = datetime.now().strftime("%Y-%m-%d")

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Buscar item activo en contrato activo que cubra la fecha
        cursor.execute("""
            SELECT ci.precio_unitario, ci.moneda
            FROM contrato_item ci
            INNER JOIN contrato c ON ci.contrato_id = c.id
            WHERE c.proveedor_cuit = ?
              AND c.estado = 'active'
              AND c.deleted = 0
              AND ci.material_codigo = ?
              AND ci.activo = 1
              AND (ci.fecha_vigencia_desde IS NULL OR ci.fecha_vigencia_desde <= ?)
              AND (ci.fecha_vigencia_hasta IS NULL OR ci.fecha_vigencia_hasta >= ?)
            ORDER BY ci.created_at DESC
            LIMIT 1
        """, (proveedor_cuit, material_codigo, fecha, fecha))

        row = cursor.fetchone()

        if row:
            return row['precio_unitario']

        return None


def actualizar_cantidad_consumida(contrato_id: int, material_codigo: str, cantidad: float) -> None:
    """
    Incrementar cantidad_consumida de un item de contrato.

    Args:
        contrato_id: ID del contrato
        material_codigo: Código del material
        cantidad: Cantidad a sumar
    """
    with get_db_transaction() as (conn, cursor):
        cursor.execute("""
            UPDATE contrato_item
            SET cantidad_consumida = cantidad_consumida + ?
            WHERE contrato_id = ? AND material_codigo = ? AND activo = 1
        """, (cantidad, contrato_id, material_codigo))

        conn.commit()


# ============================================================================
# DOCUMENTOS
# ============================================================================

def subir_documento(
    contrato_id: int,
    archivo: Any,  # werkzeug FileStorage
    tipo: str,
    user_id: int
) -> int:
    """
    Subir documento adjunto a un contrato.

    Args:
        contrato_id: ID del contrato
        archivo: Objeto FileStorage de Flask
        tipo: terms, specs, amendment, other
        user_id: ID del usuario que sube

    Returns:
        ID del documento creado
    """
    tipos_validos = ['terms', 'specs', 'amendment', 'other']
    if tipo not in tipos_validos:
        raise ValidationError(f"Tipo de documento inválido: {tipo}")

    # Crear directorio si no existe
    upload_dir = os.path.join('data', 'contracts', str(contrato_id))
    os.makedirs(upload_dir, exist_ok=True)

    # Guardar archivo
    filename = archivo.filename
    filepath = os.path.join(upload_dir, filename)
    archivo.save(filepath)

    # Obtener tamaño y mime type
    file_size = os.path.getsize(filepath)
    mime_type = archivo.content_type

    with get_db_transaction() as (conn, cursor):
        cursor.execute("""
            INSERT INTO contrato_documento (
                contrato_id, tipo, nombre_archivo, ruta_archivo,
                tamanio_bytes, mime_type, subido_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (contrato_id, tipo, filename, filepath, file_size, mime_type, user_id))

        doc_id = cursor.lastrowid
        conn.commit()
        return doc_id


def obtener_documentos(contrato_id: int) -> List[Dict[str, Any]]:
    """Listar documentos de un contrato"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT d.*, u.nombre as subido_por_nombre
            FROM contrato_documento d
            LEFT JOIN usuarios u ON d.subido_por = u.id
            WHERE d.contrato_id = ?
            ORDER BY d.created_at DESC
        """, (contrato_id,))

        return [dict(row) for row in cursor.fetchall()]


def eliminar_documento(doc_id: int, user_id: int) -> None:
    """
    Eliminar documento de contrato.
    Solo puede hacerlo el usuario que subió el archivo o un admin.

    Args:
        doc_id: ID del documento
        user_id: ID del usuario solicitante
    """
    with get_db_transaction() as (conn, cursor):
        cursor.execute("""
            SELECT ruta_archivo, subido_por FROM contrato_documento WHERE id = ?
        """, (doc_id,))
        row = cursor.fetchone()

        if not row:
            raise NotFoundError(f"Documento {doc_id} no encontrado")

        # Verificar permisos (debe ser uploader o admin)
        cursor.execute("SELECT rol FROM usuarios WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()

        if not user_row:
            raise ValidationError("Usuario no válido")

        is_admin = user_row['rol'] == 'admin'
        is_uploader = row['subido_por'] == user_id

        if not (is_admin or is_uploader):
            raise BusinessRuleError("No tiene permisos para eliminar este documento")

        # Eliminar archivo físico
        filepath = row['ruta_archivo']
        if os.path.exists(filepath):
            os.remove(filepath)

        # Eliminar registro
        cursor.execute("DELETE FROM contrato_documento WHERE id = ?", (doc_id,))
        conn.commit()


# ============================================================================
# ALERTAS
# ============================================================================

def verificar_contratos_proximos_vencer() -> List[Dict[str, Any]]:
    """
    Verificar contratos que vencen en los próximos 30 días.
    Marca alerta_vencimiento = 1 para evitar notificaciones duplicadas.

    Returns:
        Lista de contratos próximos a vencer
    """
    fecha_limite = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

    with get_db_transaction() as (conn, cursor):
        cursor.execute("""
            SELECT * FROM contrato
            WHERE estado = 'active'
              AND deleted = 0
              AND fecha_vencimiento <= ?
              AND alerta_vencimiento = 0
        """, (fecha_limite,))

        contratos = [dict(row) for row in cursor.fetchall()]

        # Marcar alertas como enviadas
        if contratos:
            ids = [c['id'] for c in contratos]
            placeholders = ','.join('?' * len(ids))
            cursor.execute(f"""
                UPDATE contrato
                SET alerta_vencimiento = 1
                WHERE id IN ({placeholders})
            """, ids)

        conn.commit()
        return contratos
