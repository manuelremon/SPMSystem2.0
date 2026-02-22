"""
Servicio del Portal de Proveedores.
Gestiona usuarios portal, ASNs, y forecasts compartidos.
"""

import logging
from datetime import datetime

try:
    import bcrypt
    BCRYPT_AVAILABLE = True
except ImportError:  # noqa: E722
    BCRYPT_AVAILABLE = False

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def crear_usuario_portal(data: dict) -> int:
    """
    Crea un nuevo usuario del portal de proveedores.

    Args:
        data: {
            'proveedor_cuit': str,
            'email': str,
            'nombre': str,
            'password': str
        }

    Returns:
        ID del usuario creado
    """
    using_pg = is_using_postgresql()

    # Hash password
    if BCRYPT_AVAILABLE:
        password_hash = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    else:
        # Fallback para desarrollo (NO usar en producción)
        password_hash = data['password']
        logger.warning("bcrypt no disponible, usando password sin hash (NO USAR EN PRODUCCIÓN)")

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            cursor.execute("""
                INSERT INTO portal_proveedor_usuario
                (proveedor_cuit, email, nombre, password_hash, estado, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (
                data['proveedor_cuit'],
                data['email'],
                data['nombre'],
                password_hash,
                'active'
            ))
            user_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO portal_proveedor_usuario
                (proveedor_cuit, email, nombre, password_hash, estado, created_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            """, (
                data['proveedor_cuit'],
                data['email'],
                data['nombre'],
                password_hash,
                'active'
            ))
            user_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Usuario portal creado: {data['email']} (ID: {user_id})")
        return user_id


def autenticar_portal(email: str, password: str) -> dict:
    """
    Autentica un usuario del portal de proveedores.

    Args:
        email: Email del usuario
        password: Contraseña

    Returns:
        Diccionario con datos del usuario o None si falla
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            f"""
            SELECT id, proveedor_cuit, email, nombre, password_hash, estado
            FROM portal_proveedor_usuario
            WHERE email = {placeholder}
            """,
            (email,)
        )

        row = cursor.fetchone()
        if not row:
            return None

        user_id, proveedor_cuit, email_db, nombre, password_hash, estado = row

        if estado != 'active':
            logger.warning(f"Intento de login con usuario inactivo: {email}")
            return None

        # Verificar password
        if BCRYPT_AVAILABLE:
            if not bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8')):
                return None
        else:
            if password != password_hash:
                return None

        # Actualizar ultimo_login
        now_fn = "NOW()" if using_pg else "datetime('now')"
        cursor.execute(
            f"UPDATE portal_proveedor_usuario SET ultimo_login = {now_fn} WHERE id = {placeholder}",
            (user_id,)
        )
        conn.commit()

        # Registrar acceso
        registrar_acceso(user_id, 'login')

        logger.info(f"Usuario portal autenticado: {email}")

        return {
            'id': user_id,
            'proveedor_cuit': proveedor_cuit,
            'email': email_db,
            'nombre': nombre
        }
    finally:
        cursor.close()
        conn.close()


def obtener_usuarios_portal(filtros: dict = None) -> list:
    """
    Obtiene lista de usuarios del portal.

    Args:
        filtros: {
            'proveedor_cuit': str (optional),
            'estado': str (optional)
        }

    Returns:
        Lista de usuarios
    """
    filtros = filtros or {}
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        where_clauses = []
        params = []

        if filtros.get('proveedor_cuit'):
            where_clauses.append(f"ppu.proveedor_cuit = {placeholder}")
            params.append(filtros['proveedor_cuit'])

        if filtros.get('estado'):
            where_clauses.append(f"ppu.estado = {placeholder}")
            params.append(filtros['estado'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cursor.execute(
            f"""
            SELECT
                ppu.id, ppu.proveedor_cuit, p.nombre as proveedor_nombre,
                ppu.email, ppu.nombre, ppu.estado, ppu.ultimo_login, ppu.created_at
            FROM portal_proveedor_usuario ppu
            LEFT JOIN proveedores p ON ppu.proveedor_cuit = p.id_proveedor
            {where_sql}
            ORDER BY ppu.created_at DESC
            """,
            params
        )

        usuarios = []
        for row in cursor.fetchall():
            usuarios.append({
                'id': row[0],
                'proveedor_cuit': row[1],
                'proveedor_nombre': row[2],
                'email': row[3],
                'nombre': row[4],
                'estado': row[5],
                'ultimo_login': row[6],
                'created_at': row[7]
            })

        return usuarios
    finally:
        cursor.close()
        conn.close()


def actualizar_usuario_portal(user_id: int, data: dict) -> dict:
    """
    Actualiza un usuario del portal.

    Args:
        user_id: ID del usuario
        data: Campos a actualizar

    Returns:
        Usuario actualizado
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        updates = []
        params = []

        for field in ['nombre', 'estado']:
            if field in data:
                updates.append(f"{field} = {placeholder}")
                params.append(data[field])

        if 'password' in data and data['password']:
            if BCRYPT_AVAILABLE:
                password_hash = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            else:
                password_hash = data['password']
            updates.append(f"password_hash = {placeholder}")
            params.append(password_hash)

        if updates:
            params.append(user_id)
            cursor.execute(
                f"UPDATE portal_proveedor_usuario SET {', '.join(updates)} WHERE id = {placeholder}",
                params
            )

        conn.commit()

        # Obtener usuario actualizado
        cursor.execute(
            f"""
            SELECT id, proveedor_cuit, email, nombre, estado
            FROM portal_proveedor_usuario
            WHERE id = {placeholder}
            """,
            (user_id,)
        )
        row = cursor.fetchone()

        return {
            'id': row[0],
            'proveedor_cuit': row[1],
            'email': row[2],
            'nombre': row[3],
            'estado': row[4]
        }


def obtener_pos_proveedor(proveedor_cuit: str) -> list:
    """
    Obtiene órdenes de compra de un proveedor.

    Args:
        proveedor_cuit: CUIT del proveedor

    Returns:
        Lista de órdenes de compra
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            f"""
            SELECT
                id, numero, status, subtotal, moneda, created_at,
                proveedor_nombre, proveedor_email
            FROM orden_compra
            WHERE proveedor_email = {placeholder} OR proveedor_nombre = {placeholder}
            ORDER BY created_at DESC
            """,
            (proveedor_cuit, proveedor_cuit)
        )

        ordenes = []
        for row in cursor.fetchall():
            ordenes.append({
                'id': row[0],
                'numero': row[1],
                'fecha_emision': str(row[5]) if row[5] else None,
                'fecha_entrega_estimada': None,
                'monto_total': float(row[3]) if row[3] else 0,
                'moneda': row[4],
                'estado': row[2],
                'created_at': str(row[5]) if row[5] else None
            })

        return ordenes
    finally:
        cursor.close()
        conn.close()


def reconocer_po(oc_id: int, proveedor_cuit: str) -> None:
    """
    Registra que un proveedor reconoció una orden de compra.

    Args:
        oc_id: ID de la orden de compra
        proveedor_cuit: CUIT del proveedor
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Verificar que la OC pertenece al proveedor
        cursor.execute(
            f"SELECT id FROM orden_compra WHERE id = {placeholder} AND proveedor_cuit = {placeholder}",
            (oc_id, proveedor_cuit)
        )
        if not cursor.fetchone():
            raise ValueError("Orden de compra no encontrada o no pertenece al proveedor")

        # Marcar como reconocida (agregar campo si no existe en el esquema)
        cursor.execute(
            f"UPDATE orden_compra SET reconocida_por_proveedor = 1 WHERE id = {placeholder}",
            (oc_id,)
        )

        conn.commit()
        logger.info(f"OC {oc_id} reconocida por proveedor {proveedor_cuit}")


def crear_asn(data: dict) -> int:
    """
    Crea un nuevo Advanced Shipping Notice.

    Args:
        data: {
            'proveedor_cuit': str,
            'orden_compra_id': int,
            'numero_asn': str (optional, auto-generated),
            'fecha_envio': str,
            'fecha_entrega_estimada': str,
            'transportista': str (optional),
            'guia_rastreo': str (optional),
            'items': [
                {
                    'material_codigo': str,
                    'cantidad': float,
                    'lote': str (optional),
                    'fecha_vencimiento': str (optional)
                }
            ]
        }

    Returns:
        ID del ASN creado
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        # Generar numero_asn si no se proporciona
        numero_asn = data.get('numero_asn')
        if not numero_asn:
            year = datetime.now().year
            if using_pg:
                cursor.execute(
                    "SELECT COALESCE(MAX(id), 0) FROM asn WHERE numero_asn LIKE %s",
                    (f'ASN-{year}-%',)
                )
            else:
                cursor.execute(
                    "SELECT COALESCE(MAX(id), 0) FROM asn WHERE numero_asn LIKE ?",
                    (f'ASN-{year}-%',)
                )
            max_id = cursor.fetchone()[0]
            numero_asn = f"ASN-{year}-{max_id + 1:04d}"

        # Insertar ASN
        if using_pg:
            cursor.execute("""
                INSERT INTO asn
                (numero_asn, proveedor_cuit, orden_compra_id, fecha_envio,
                 fecha_entrega_estimada, transportista, guia_rastreo, estado, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (
                numero_asn,
                data['proveedor_cuit'],
                data['orden_compra_id'],
                data['fecha_envio'],
                data['fecha_entrega_estimada'],
                data.get('transportista'),
                data.get('guia_rastreo'),
                'in_transit'
            ))
            asn_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO asn
                (numero_asn, proveedor_cuit, orden_compra_id, fecha_envio,
                 fecha_entrega_estimada, transportista, guia_rastreo, estado, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (
                numero_asn,
                data['proveedor_cuit'],
                data['orden_compra_id'],
                data['fecha_envio'],
                data['fecha_entrega_estimada'],
                data.get('transportista'),
                data.get('guia_rastreo'),
                'in_transit'
            ))
            asn_id = cursor.lastrowid

        # Insertar items
        for item in data['items']:
            if using_pg:
                cursor.execute("""
                    INSERT INTO asn_item
                    (asn_id, material_codigo, cantidad, lote, fecha_vencimiento)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    asn_id,
                    item['material_codigo'],
                    item['cantidad'],
                    item.get('lote'),
                    item.get('fecha_vencimiento')
                ))
            else:
                cursor.execute("""
                    INSERT INTO asn_item
                    (asn_id, material_codigo, cantidad, lote, fecha_vencimiento)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    asn_id,
                    item['material_codigo'],
                    item['cantidad'],
                    item.get('lote'),
                    item.get('fecha_vencimiento')
                ))

        conn.commit()
        logger.info(f"ASN creado: {numero_asn} (ID: {asn_id})")
        return asn_id


def obtener_asns(proveedor_cuit: str = None, estado: str = None) -> list:
    """
    Obtiene lista de ASNs con filtros.

    Args:
        proveedor_cuit: CUIT del proveedor (optional)
        estado: Estado del ASN (optional)

    Returns:
        Lista de ASNs
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        where_clauses = []
        params = []

        if proveedor_cuit:
            where_clauses.append(f"a.proveedor_cuit = {placeholder}")
            params.append(proveedor_cuit)

        if estado:
            where_clauses.append(f"a.estado = {placeholder}")
            params.append(estado)

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cursor.execute(
            f"""
            SELECT
                a.id, a.numero_asn, a.proveedor_cuit, p.nombre as proveedor_nombre,
                a.orden_compra_id, oc.numero as orden_compra_numero,
                a.fecha_envio, a.fecha_entrega_estimada, a.transportista,
                a.guia_rastreo, a.estado, a.created_at
            FROM asn a
            LEFT JOIN proveedores p ON a.proveedor_cuit = p.id_proveedor
            LEFT JOIN orden_compra oc ON a.orden_compra_id = oc.id
            {where_sql}
            ORDER BY a.created_at DESC
            """,
            params
        )

        asns = []
        for row in cursor.fetchall():
            asns.append({
                'id': row[0],
                'numero_asn': row[1],
                'proveedor_cuit': row[2],
                'proveedor_nombre': row[3],
                'orden_compra_id': row[4],
                'orden_compra_numero': row[5],
                'fecha_envio': row[6],
                'fecha_entrega_estimada': row[7],
                'transportista': row[8],
                'guia_rastreo': row[9],
                'estado': row[10],
                'created_at': row[11]
            })

        return asns
    finally:
        cursor.close()
        conn.close()


def obtener_detalle_asn(asn_id: int) -> dict:
    """
    Obtiene detalle completo de un ASN.

    Args:
        asn_id: ID del ASN

    Returns:
        Diccionario con datos del ASN
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener ASN
        cursor.execute(
            f"""
            SELECT
                a.id, a.numero_asn, a.proveedor_cuit, p.nombre as proveedor_nombre,
                a.orden_compra_id, oc.numero as orden_compra_numero,
                a.fecha_envio, a.fecha_entrega_estimada, a.transportista,
                a.guia_rastreo, a.estado, a.created_at
            FROM asn a
            LEFT JOIN proveedores p ON a.proveedor_cuit = p.id_proveedor
            LEFT JOIN orden_compra oc ON a.orden_compra_id = oc.id
            WHERE a.id = {placeholder}
            """,
            (asn_id,)
        )

        row = cursor.fetchone()
        if not row:
            raise ValueError(f"ASN {asn_id} no encontrado")

        asn = {
            'id': row[0],
            'numero_asn': row[1],
            'proveedor_cuit': row[2],
            'proveedor_nombre': row[3],
            'orden_compra_id': row[4],
            'orden_compra_numero': row[5],
            'fecha_envio': row[6],
            'fecha_entrega_estimada': row[7],
            'transportista': row[8],
            'guia_rastreo': row[9],
            'estado': row[10],
            'created_at': row[11]
        }

        # Obtener items
        cursor.execute(
            f"""
            SELECT
                ai.id, ai.material_codigo, m.descripcion as material_descripcion,
                ai.cantidad, ai.lote, ai.fecha_vencimiento
            FROM asn_item ai
            LEFT JOIN catalogo_materiales m ON ai.material_codigo = m.codigo
            WHERE ai.asn_id = {placeholder}
            """,
            (asn_id,)
        )

        items = []
        for row in cursor.fetchall():
            items.append({
                'id': row[0],
                'material_codigo': row[1],
                'material_descripcion': row[2],
                'cantidad': float(row[3]) if row[3] else 0,
                'lote': row[4],
                'fecha_vencimiento': row[5]
            })

        asn['items'] = items

        return asn
    finally:
        cursor.close()
        conn.close()


def compartir_forecast(proveedor_cuit: str, materiales: list, periodos: list, compartido_por: int) -> None:
    """
    Comparte forecasts con un proveedor.

    Args:
        proveedor_cuit: CUIT del proveedor
        materiales: Lista de códigos de materiales
        periodos: Lista de periodos (formato 'YYYY-MM')
        compartido_por: ID del usuario compartiendo
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        for material_codigo in materiales:
            for periodo in periodos:
                # Obtener forecast proyectado (simplificado: usar cantidad fija o consultar forecast real)
                cantidad_proyectada = 1000  # Placeholder

                if using_pg:
                    cursor.execute("""
                        INSERT INTO forecast_compartido
                        (proveedor_cuit, material_codigo, periodo, cantidad_proyectada,
                         compartido_por, visto, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    """, (proveedor_cuit, material_codigo, periodo, cantidad_proyectada, compartido_por, False))
                else:
                    cursor.execute("""
                        INSERT INTO forecast_compartido
                        (proveedor_cuit, material_codigo, periodo, cantidad_proyectada,
                         compartido_por, visto, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                    """, (proveedor_cuit, material_codigo, periodo, cantidad_proyectada, compartido_por, 0))

        conn.commit()
        logger.info(f"Forecast compartido con {proveedor_cuit}: {len(materiales)} materiales, {len(periodos)} periodos")


def obtener_forecasts_compartidos(proveedor_cuit: str) -> list:
    """
    Obtiene forecasts compartidos con un proveedor.

    Args:
        proveedor_cuit: CUIT del proveedor

    Returns:
        Lista de forecasts
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            f"""
            SELECT
                fc.id, fc.material_codigo, m.descripcion as material_descripcion,
                fc.periodo, fc.cantidad_proyectada, fc.visto,
                fc.compartido_por, u.nombre as compartido_por_nombre, fc.created_at
            FROM forecast_compartido fc
            LEFT JOIN catalogo_materiales m ON fc.material_codigo = m.codigo
            LEFT JOIN usuarios u ON fc.compartido_por = u.id_spm
            WHERE fc.proveedor_cuit = {placeholder}
            ORDER BY fc.periodo DESC
            """,
            (proveedor_cuit,)
        )

        forecasts = []
        for row in cursor.fetchall():
            forecasts.append({
                'id': row[0],
                'material_codigo': row[1],
                'material_descripcion': row[2],
                'periodo': row[3],
                'cantidad_proyectada': float(row[4]) if row[4] else 0,
                'visto': bool(row[5]),
                'compartido_por': row[6],
                'compartido_por_nombre': row[7],
                'created_at': row[8]
            })

        return forecasts
    finally:
        cursor.close()
        conn.close()


def obtener_dashboard_portal(proveedor_cuit: str) -> dict:
    """
    Obtiene datos del dashboard del portal para un proveedor.

    Args:
        proveedor_cuit: CUIT del proveedor

    Returns:
        {ocs_pendientes: int, asns_en_transito: int, forecasts_nuevos: int}
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # OCs pendientes
        cursor.execute(
            f"""
            SELECT COUNT(*) FROM orden_compra
            WHERE proveedor_cuit = {placeholder}
            AND estado IN ('submitted', 'approved')
            """,
            (proveedor_cuit,)
        )
        ocs_pendientes = cursor.fetchone()[0]

        # ASNs en tránsito
        cursor.execute(
            f"""
            SELECT COUNT(*) FROM asn
            WHERE proveedor_cuit = {placeholder}
            AND estado = 'in_transit'
            """,
            (proveedor_cuit,)
        )
        asns_en_transito = cursor.fetchone()[0]

        # Forecasts no vistos
        cursor.execute(
            f"""
            SELECT COUNT(*) FROM forecast_compartido
            WHERE proveedor_cuit = {placeholder}
            AND visto = {'FALSE' if using_pg else '0'}
            """,
            (proveedor_cuit,)
        )
        forecasts_nuevos = cursor.fetchone()[0]

        return {
            'ocs_pendientes': ocs_pendientes,
            'asns_en_transito': asns_en_transito,
            'forecasts_nuevos': forecasts_nuevos
        }
    finally:
        cursor.close()
        conn.close()


def obtener_actividad_proveedores() -> list:
    """
    Obtiene actividad reciente de proveedores (admin view).

    Returns:
        Lista de registros de acceso
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                pal.id, pal.usuario_id, ppu.nombre as usuario_nombre,
                ppu.proveedor_cuit, p.nombre as proveedor_nombre,
                pal.accion, pal.entidad_tipo, pal.entidad_id,
                pal.ip, pal.created_at
            FROM portal_acceso_log pal
            LEFT JOIN portal_proveedor_usuario ppu ON pal.usuario_id = ppu.id
            LEFT JOIN proveedores p ON ppu.proveedor_cuit = p.id_proveedor
            ORDER BY pal.created_at DESC
            LIMIT 100
        """)

        actividad = []
        for row in cursor.fetchall():
            actividad.append({
                'id': row[0],
                'usuario_id': row[1],
                'usuario_nombre': row[2],
                'proveedor_cuit': row[3],
                'proveedor_nombre': row[4],
                'accion': row[5],
                'entidad_tipo': row[6],
                'entidad_id': row[7],
                'ip': row[8],
                'created_at': row[9]
            })

        return actividad
    finally:
        cursor.close()
        conn.close()


def registrar_acceso(usuario_id: int, accion: str, entidad_tipo: str = None,
                     entidad_id: int = None, ip: str = None, user_agent: str = None) -> None:
    """
    Registra un acceso en el log del portal.

    Args:
        usuario_id: ID del usuario
        accion: Acción realizada
        entidad_tipo: Tipo de entidad (optional)
        entidad_id: ID de la entidad (optional)
        ip: Dirección IP (optional)
        user_agent: User agent (optional)
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            cursor.execute("""
                INSERT INTO portal_acceso_log
                (usuario_id, accion, entidad_tipo, entidad_id, ip, user_agent, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """, (usuario_id, accion, entidad_tipo, entidad_id, ip, user_agent))
        else:
            cursor.execute("""
                INSERT INTO portal_acceso_log
                (usuario_id, accion, entidad_tipo, entidad_id, ip, user_agent, created_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            """, (usuario_id, accion, entidad_tipo, entidad_id, ip, user_agent))

        conn.commit()
