"""
Servicio de Customs & Trade Compliance.
Gestiona códigos HS, clasificación aduanera, operaciones de importación/exportación y acuerdos comerciales.
"""

import logging
from typing import Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def crear_hs_code(data: dict) -> int:
    """
    Crea un código HS.

    Args:
        data: {
            codigo: str,
            descripcion: str,
            arancel_pct: float (optional, default 0),
            unidad_medida: str (optional),
            capitulo: str (optional),
            partida: str (optional),
            subpartida: str (optional),
            notas: str (optional)
        }

    Returns:
        ID del código HS creado
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            cursor.execute("""
                INSERT INTO hs_code
                (codigo, descripcion, arancel_pct, unidad_medida, capitulo, partida, subpartida, notas, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (
                data['codigo'],
                data.get('descripcion'),
                data.get('arancel_pct', 0),
                data.get('unidad_medida'),
                data.get('capitulo'),
                data.get('partida'),
                data.get('subpartida'),
                data.get('notas')
            ))
            hs_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO hs_code
                (codigo, descripcion, arancel_pct, unidad_medida, capitulo, partida, subpartida, notas, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (
                data['codigo'],
                data.get('descripcion'),
                data.get('arancel_pct', 0),
                data.get('unidad_medida'),
                data.get('capitulo'),
                data.get('partida'),
                data.get('subpartida'),
                data.get('notas')
            ))
            hs_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Código HS creado: {hs_id} - {data['codigo']}")
        return hs_id


def obtener_hs_codes(page: int = 1, per_page: int = 50, search: str = None) -> dict:
    """
    Obtiene códigos HS con paginación y búsqueda.

    Args:
        page: Número de página (default 1)
        per_page: Registros por página (default 50)
        search: Término de búsqueda (busca en código y descripción)

    Returns:
        {
            codes: [...],
            total: int,
            page: int,
            per_page: int
        }
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        where_clause = ""
        params = []

        if search:
            where_clause = f"WHERE codigo LIKE {placeholder} OR descripcion LIKE {placeholder}"
            params = [f"%{search}%", f"%{search}%"]

        # Contar total
        cursor.execute(f"SELECT COUNT(*) FROM hs_code {where_clause}", params)
        total = cursor.fetchone()[0]

        # Obtener registros con paginación
        offset = (page - 1) * per_page
        cursor.execute(
            f"""
            SELECT id, codigo, descripcion, arancel_pct, unidad_medida, capitulo, partida, subpartida, notas, created_at
            FROM hs_code
            {where_clause}
            ORDER BY codigo ASC
            LIMIT {placeholder} OFFSET {placeholder}
            """,
            params + [per_page, offset]
        )

        codes = []
        for row in cursor.fetchall():
            codes.append({
                'id': row[0],
                'codigo': row[1],
                'descripcion': row[2],
                'arancel_pct': float(row[3]) if row[3] else 0,
                'unidad_medida': row[4],
                'capitulo': row[5],
                'partida': row[6],
                'subpartida': row[7],
                'notas': row[8],
                'created_at': row[9]
            })

        return {
            'codes': codes,
            'total': total,
            'page': page,
            'per_page': per_page
        }
    finally:
        cursor.close()
        conn.close()


def clasificar_material(material_codigo: str, hs_code_id: int, pais_origen: str = 'AR', pais_destino: str = None, certificado_origen: str = None) -> int:
    """
    Clasifica un material con un código HS.

    Args:
        material_codigo: Código del material
        hs_code_id: ID del código HS
        pais_origen: País de origen (default AR)
        pais_destino: País de destino (optional)
        certificado_origen: Certificado de origen (optional)

    Returns:
        ID de la clasificación creada
    """
    with get_db_transaction() as (conn, cursor):
        cursor.execute("""
            INSERT INTO material_clasificacion_aduanera
            (material_codigo, hs_code_id, pais_origen, pais_destino, certificado_origen, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (material_codigo, pais_origen, pais_destino) DO UPDATE
            SET hs_code_id = EXCLUDED.hs_code_id, certificado_origen = EXCLUDED.certificado_origen
            RETURNING id
        """, (material_codigo, hs_code_id, pais_origen, pais_destino, certificado_origen))
        clasificacion_id = cursor.fetchone()[0]

        conn.commit()
        logger.info(f"Material clasificado: {material_codigo} con HS code {hs_code_id}")
        return clasificacion_id


def obtener_clasificacion(material_codigo: str, pais_origen: str = 'AR', pais_destino: str = None) -> Optional[dict]:
    """
    Obtiene la clasificación aduanera de un material.

    Args:
        material_codigo: Código del material
        pais_origen: País de origen (default AR)
        pais_destino: País de destino (optional)

    Returns:
        Clasificación o None si no existe
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if pais_destino:
            cursor.execute(
                f"""
                SELECT mca.id, mca.material_codigo, mca.pais_origen, mca.pais_destino, mca.certificado_origen,
                       hs.id, hs.codigo, hs.descripcion, hs.arancel_pct, hs.unidad_medida
                FROM material_clasificacion_aduanera mca
                JOIN hs_code hs ON mca.hs_code_id = hs.id
                WHERE mca.material_codigo = {placeholder} AND mca.pais_origen = {placeholder} AND mca.pais_destino = {placeholder}
                """,
                (material_codigo, pais_origen, pais_destino)
            )
        else:
            cursor.execute(
                f"""
                SELECT mca.id, mca.material_codigo, mca.pais_origen, mca.pais_destino, mca.certificado_origen,
                       hs.id, hs.codigo, hs.descripcion, hs.arancel_pct, hs.unidad_medida
                FROM material_clasificacion_aduanera mca
                JOIN hs_code hs ON mca.hs_code_id = hs.id
                WHERE mca.material_codigo = {placeholder} AND mca.pais_origen = {placeholder}
                ORDER BY mca.id DESC
                LIMIT 1
                """,
                (material_codigo, pais_origen)
            )

        row = cursor.fetchone()
        if not row:
            return None

        return {
            'id': row[0],
            'material_codigo': row[1],
            'pais_origen': row[2],
            'pais_destino': row[3],
            'certificado_origen': row[4],
            'hs_code': {
                'id': row[5],
                'codigo': row[6],
                'descripcion': row[7],
                'arancel_pct': float(row[8]) if row[8] else 0,
                'unidad_medida': row[9]
            }
        }
    finally:
        cursor.close()
        conn.close()


def calcular_tributos(valor_fob: float, flete: float, seguro: float, hs_code_id: int = None, acuerdo_id: int = None) -> dict:
    """
    Calcula tributos aduaneros (CIF, aranceles).

    Args:
        valor_fob: Valor FOB
        flete: Flete
        seguro: Seguro
        hs_code_id: ID del código HS (optional, para obtener tarifa arancelaria)
        acuerdo_id: ID del acuerdo comercial (optional, para preferencia arancelaria)

    Returns:
        {
            valor_cif: float,
            arancel_pct: float,
            aranceles: float,
            total_tributos: float
        }
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    # CIF = FOB + Flete + Seguro
    valor_cif = valor_fob + flete + seguro

    arancel_pct = 0.0
    preferencia_pct = 0.0

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener tarifa arancelaria del código HS
        if hs_code_id:
            cursor.execute(
                f"SELECT arancel_pct FROM hs_code WHERE id = {placeholder}",
                (hs_code_id,)
            )
            row = cursor.fetchone()
            if row:
                arancel_pct = float(row[0]) if row[0] else 0

        # Obtener preferencia arancelaria del acuerdo comercial
        if acuerdo_id:
            cursor.execute(
                f"""
                SELECT preferencia_arancelaria_pct
                FROM acuerdo_comercial
                WHERE id = {placeholder} AND estado = 'active'
                """,
                (acuerdo_id,)
            )
            row = cursor.fetchone()
            if row:
                preferencia_pct = float(row[0]) if row[0] else 0

        # Aplicar preferencia arancelaria
        arancel_efectivo_pct = max(0, arancel_pct - preferencia_pct)

        # Calcular aranceles
        aranceles = valor_cif * (arancel_efectivo_pct / 100)

        # Total tributos (aranceles + IVA u otros impuestos adicionales)
        # Simplificación: total_tributos = aranceles
        total_tributos = aranceles

        return {
            'valor_cif': round(valor_cif, 2),
            'arancel_pct': round(arancel_pct, 2),
            'preferencia_pct': round(preferencia_pct, 2),
            'arancel_efectivo_pct': round(arancel_efectivo_pct, 2),
            'aranceles': round(aranceles, 2),
            'total_tributos': round(total_tributos, 2)
        }
    finally:
        cursor.close()
        conn.close()


def crear_operacion(data: dict) -> int:
    """
    Crea una operación aduanera.

    Args:
        data: {
            tipo: str (importacion/exportacion),
            numero_despacho: str (optional),
            proveedor_cuit: str (optional),
            fecha_operacion: str (YYYY-MM-DD),
            estado: str (default en_proceso),
            valor_fob: float,
            flete: float,
            seguro: float,
            aranceles: float (optional, calculado automáticamente),
            moneda: str (default USD),
            orden_compra_id: int (optional),
            notas: str (optional)
        }

    Returns:
        ID de la operación creada
    """
    using_pg = is_using_postgresql()

    valor_fob = data.get('valor_fob', 0)
    flete = data.get('flete', 0)
    seguro = data.get('seguro', 0)
    valor_cif = valor_fob + flete + seguro

    # Si no se especifican aranceles, calcular con tasa predeterminada
    aranceles = data.get('aranceles', valor_cif * 0.05)  # 5% default
    impuestos_adicionales = data.get('impuestos_adicionales', 0)
    total_tributos = aranceles + impuestos_adicionales

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            cursor.execute("""
                INSERT INTO operacion_aduanera
                (tipo, numero_despacho, proveedor_cuit, fecha_operacion, estado,
                 valor_fob, flete, seguro, valor_cif, aranceles, impuestos_adicionales,
                 total_tributos, moneda, orden_compra_id, notas, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (
                data['tipo'],
                data.get('numero_despacho'),
                data.get('proveedor_cuit'),
                data['fecha_operacion'],
                data.get('estado', 'en_proceso'),
                valor_fob,
                flete,
                seguro,
                valor_cif,
                aranceles,
                impuestos_adicionales,
                total_tributos,
                data.get('moneda', 'USD'),
                data.get('orden_compra_id'),
                data.get('notas')
            ))
            operacion_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO operacion_aduanera
                (tipo, numero_despacho, proveedor_cuit, fecha_operacion, estado,
                 valor_fob, flete, seguro, valor_cif, aranceles, impuestos_adicionales,
                 total_tributos, moneda, orden_compra_id, notas, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (
                data['tipo'],
                data.get('numero_despacho'),
                data.get('proveedor_cuit'),
                data['fecha_operacion'],
                data.get('estado', 'en_proceso'),
                valor_fob,
                flete,
                seguro,
                valor_cif,
                aranceles,
                impuestos_adicionales,
                total_tributos,
                data.get('moneda', 'USD'),
                data.get('orden_compra_id'),
                data.get('notas')
            ))
            operacion_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Operación aduanera creada: {operacion_id} ({data['tipo']})")
        return operacion_id


def obtener_operaciones(page: int = 1, per_page: int = 50, tipo: str = None, estado: str = None) -> dict:
    """
    Obtiene operaciones aduaneras con filtros.

    Args:
        page: Número de página
        per_page: Registros por página
        tipo: Filtro por tipo (optional)
        estado: Filtro por estado (optional)

    Returns:
        {
            operaciones: [...],
            total: int,
            page: int,
            per_page: int
        }
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        where_clauses = []
        params = []

        if tipo:
            where_clauses.append(f"tipo = {placeholder}")
            params.append(tipo)

        if estado:
            where_clauses.append(f"estado = {placeholder}")
            params.append(estado)

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        # Contar total
        cursor.execute(f"SELECT COUNT(*) FROM operacion_aduanera {where_sql}", params)
        total = cursor.fetchone()[0]

        # Obtener registros con paginación
        offset = (page - 1) * per_page
        cursor.execute(
            f"""
            SELECT id, tipo, numero_despacho, proveedor_cuit, fecha_operacion, estado,
                   valor_fob, flete, seguro, valor_cif, aranceles, impuestos_adicionales,
                   total_tributos, moneda, orden_compra_id, notas, created_at
            FROM operacion_aduanera
            {where_sql}
            ORDER BY fecha_operacion DESC, created_at DESC
            LIMIT {placeholder} OFFSET {placeholder}
            """,
            params + [per_page, offset]
        )

        operaciones = []
        for row in cursor.fetchall():
            operaciones.append({
                'id': row[0],
                'tipo': row[1],
                'numero_despacho': row[2],
                'proveedor_cuit': row[3],
                'fecha_operacion': row[4],
                'estado': row[5],
                'valor_fob': float(row[6]) if row[6] else 0,
                'flete': float(row[7]) if row[7] else 0,
                'seguro': float(row[8]) if row[8] else 0,
                'valor_cif': float(row[9]) if row[9] else 0,
                'aranceles': float(row[10]) if row[10] else 0,
                'impuestos_adicionales': float(row[11]) if row[11] else 0,
                'total_tributos': float(row[12]) if row[12] else 0,
                'moneda': row[13],
                'orden_compra_id': row[14],
                'notas': row[15],
                'created_at': row[16]
            })

        return {
            'operaciones': operaciones,
            'total': total,
            'page': page,
            'per_page': per_page
        }
    finally:
        cursor.close()
        conn.close()


def actualizar_estado_operacion(operacion_id: int, estado: str, notas: str = None) -> None:
    """
    Actualiza el estado de una operación aduanera.

    Args:
        operacion_id: ID de la operación
        estado: Nuevo estado
        notas: Notas adicionales (optional)
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        if notas:
            cursor.execute(
                f"UPDATE operacion_aduanera SET estado = {placeholder}, notas = {placeholder} WHERE id = {placeholder}",
                (estado, notas, operacion_id)
            )
        else:
            cursor.execute(
                f"UPDATE operacion_aduanera SET estado = {placeholder} WHERE id = {placeholder}",
                (estado, operacion_id)
            )

        conn.commit()
        logger.info(f"Operación {operacion_id} actualizada a estado {estado}")


def crear_acuerdo(data: dict) -> int:
    """
    Crea un acuerdo comercial.

    Args:
        data: {
            nombre: str,
            tipo: str (mercosur/bilateral/gsp/otro),
            pais_socio: str (optional),
            preferencia_arancelaria_pct: float,
            fecha_vigencia_desde: str (YYYY-MM-DD, optional),
            fecha_vigencia_hasta: str (YYYY-MM-DD, optional),
            requisitos_origen: str (optional)
        }

    Returns:
        ID del acuerdo creado
    """
    using_pg = is_using_postgresql()

    with get_db_transaction() as (conn, cursor):
        if using_pg:
            cursor.execute("""
                INSERT INTO acuerdo_comercial
                (nombre, tipo, pais_socio, preferencia_arancelaria_pct,
                 fecha_vigencia_desde, fecha_vigencia_hasta, requisitos_origen, estado, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'active', NOW())
                RETURNING id
            """, (
                data['nombre'],
                data['tipo'],
                data.get('pais_socio'),
                data.get('preferencia_arancelaria_pct', 0),
                data.get('fecha_vigencia_desde'),
                data.get('fecha_vigencia_hasta'),
                data.get('requisitos_origen')
            ))
            acuerdo_id = cursor.fetchone()[0]
        else:
            cursor.execute("""
                INSERT INTO acuerdo_comercial
                (nombre, tipo, pais_socio, preferencia_arancelaria_pct,
                 fecha_vigencia_desde, fecha_vigencia_hasta, requisitos_origen, estado, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
            """, (
                data['nombre'],
                data['tipo'],
                data.get('pais_socio'),
                data.get('preferencia_arancelaria_pct', 0),
                data.get('fecha_vigencia_desde'),
                data.get('fecha_vigencia_hasta'),
                data.get('requisitos_origen')
            ))
            acuerdo_id = cursor.lastrowid

        conn.commit()
        logger.info(f"Acuerdo comercial creado: {acuerdo_id} - {data['nombre']}")
        return acuerdo_id


def obtener_acuerdos(estado: str = 'active') -> list:
    """
    Obtiene acuerdos comerciales.

    Args:
        estado: Filtro por estado (default active)

    Returns:
        Lista de acuerdos
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            f"""
            SELECT id, nombre, tipo, pais_socio, preferencia_arancelaria_pct,
                   fecha_vigencia_desde, fecha_vigencia_hasta, estado, requisitos_origen, created_at
            FROM acuerdo_comercial
            WHERE estado = {placeholder}
            ORDER BY nombre ASC
            """,
            (estado,)
        )

        acuerdos = []
        for row in cursor.fetchall():
            acuerdos.append({
                'id': row[0],
                'nombre': row[1],
                'tipo': row[2],
                'pais_socio': row[3],
                'preferencia_arancelaria_pct': float(row[4]) if row[4] else 0,
                'fecha_vigencia_desde': row[5],
                'fecha_vigencia_hasta': row[6],
                'estado': row[7],
                'requisitos_origen': row[8],
                'created_at': row[9]
            })

        return acuerdos
    finally:
        cursor.close()
        conn.close()


def obtener_kpis() -> dict:
    """
    Obtiene KPIs de aduanas.

    Returns:
        {
            tributos_mes_actual: float,
            operaciones_pendientes: int,
            ahorro_acuerdos_comerciales: float
        }
    """
    using_pg = is_using_postgresql()

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Tributos del mes actual
        if using_pg:
            cursor.execute("""
                SELECT COALESCE(SUM(total_tributos), 0)
                FROM operacion_aduanera
                WHERE DATE_TRUNC('month', fecha_operacion) = DATE_TRUNC('month', CURRENT_DATE)
            """)
        else:
            cursor.execute("""
                SELECT COALESCE(SUM(total_tributos), 0)
                FROM operacion_aduanera
                WHERE strftime('%Y-%m', fecha_operacion) = strftime('%Y-%m', date('now'))
            """)
        tributos_mes_actual = float(cursor.fetchone()[0])

        # Operaciones pendientes
        cursor.execute("SELECT COUNT(*) FROM operacion_aduanera WHERE estado IN ('en_proceso', 'despachado')")
        operaciones_pendientes = cursor.fetchone()[0]

        # Ahorro estimado por acuerdos comerciales (simplificación: suma de preferencias aplicadas)
        # En un caso real, se calcularía comparando aranceles con y sin acuerdo
        ahorro_acuerdos = 0.0
        if using_pg:
            cursor.execute("""
                SELECT COALESCE(SUM(valor_cif * preferencia_arancelaria_pct / 100), 0)
                FROM operacion_aduanera oa
                JOIN acuerdo_comercial ac ON ac.estado = 'active'
                WHERE DATE_TRUNC('month', oa.fecha_operacion) = DATE_TRUNC('month', CURRENT_DATE)
                LIMIT 1
            """)
        else:
            cursor.execute("""
                SELECT COALESCE(SUM(valor_cif * preferencia_arancelaria_pct / 100), 0)
                FROM operacion_aduanera oa
                JOIN acuerdo_comercial ac ON ac.estado = 'active'
                WHERE strftime('%Y-%m', oa.fecha_operacion) = strftime('%Y-%m', date('now'))
                LIMIT 1
            """)
        ahorro_row = cursor.fetchone()
        if ahorro_row:
            ahorro_acuerdos = float(ahorro_row[0])

        return {
            'tributos_mes_actual': round(tributos_mes_actual, 2),
            'operaciones_pendientes': operaciones_pendientes,
            'ahorro_acuerdos_comerciales': round(ahorro_acuerdos, 2)
        }
    finally:
        cursor.close()
        conn.close()
