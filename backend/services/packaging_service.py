"""
Packaging Service
Gestión de empaque, packing lists y etiquetas de envío
"""
from datetime import datetime
from typing import Dict, List, Optional

from backend.core.db import get_db_connection


def crear_template(datos: Dict) -> Dict:
    """Crear template de empaque"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO packaging_template
        (nombre, tipo, largo, ancho, alto, peso_max, unidad_medida, material_empaque, costo_unitario, estado)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        datos['nombre'],
        datos['tipo'],
        datos.get('largo'),
        datos.get('ancho'),
        datos.get('alto'),
        datos.get('peso_max'),
        datos.get('unidad_medida', 'cm'),
        datos.get('material_empaque'),
        datos.get('costo_unitario', 0),
        datos.get('estado', 'active')
    ))

    template_id = cursor.fetchone()[0]
    conn.commit()

    cursor.execute("SELECT * FROM packaging_template WHERE id = %s", (template_id,))
    template = dict(zip([d[0] for d in cursor.description], cursor.fetchone()))

    conn.close()
    return template


def obtener_templates(tipo: Optional[str] = None, estado: str = 'active') -> List[Dict]:
    """Obtener templates de empaque"""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM packaging_template WHERE estado = %s"
    params = [estado]

    if tipo:
        query += " AND tipo = %s"
        params.append(tipo)

    query += " ORDER BY tipo, nombre"

    cursor.execute(query, params)
    columns = [d[0] for d in cursor.description]
    templates = [dict(zip(columns, row)) for row in cursor.fetchall()]

    conn.close()
    return templates


def _generar_numero_packing() -> str:
    """Generar número de packing list PL-YYYY-NNNN"""
    conn = get_db_connection()
    cursor = conn.cursor()

    year = datetime.now().year
    cursor.execute("""
        SELECT numero FROM packing_list
        WHERE numero LIKE %s
        ORDER BY numero DESC LIMIT 1
    """, (f"PL-{year}-%",))

    row = cursor.fetchone()
    if row:
        ultimo = int(row[0].split('-')[2])
        numero = f"PL-{year}-{ultimo + 1:04d}"
    else:
        numero = f"PL-{year}-0001"

    conn.close()
    return numero


def crear_packing_list(datos: Dict, usuario_id: int) -> Dict:
    """Crear packing list"""
    conn = get_db_connection()
    cursor = conn.cursor()

    numero = _generar_numero_packing()

    cursor.execute("""
        INSERT INTO packing_list
        (numero, envio_id, orden_compra_id, notas, created_by)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
    """, (
        numero,
        datos.get('envio_id'),
        datos.get('orden_compra_id'),
        datos.get('notas'),
        usuario_id
    ))

    packing_id = cursor.fetchone()[0]
    conn.commit()

    cursor.execute("SELECT * FROM packing_list WHERE id = %s", (packing_id,))
    packing = dict(zip([d[0] for d in cursor.description], cursor.fetchone()))

    conn.close()
    return packing


def obtener_packing_lists(estado: Optional[str] = None, orden_compra_id: Optional[int] = None) -> List[Dict]:
    """Obtener packing lists"""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM packing_list WHERE 1=1"
    params = []

    if estado:
        query += " AND estado = %s"
        params.append(estado)

    if orden_compra_id:
        query += " AND orden_compra_id = %s"
        params.append(orden_compra_id)

    query += " ORDER BY created_at DESC"

    cursor.execute(query, params)
    columns = [d[0] for d in cursor.description]
    packings = [dict(zip(columns, row)) for row in cursor.fetchall()]

    conn.close()
    return packings


def obtener_detalle_packing(packing_id: int) -> Dict:
    """Obtener detalle de packing list con items y etiquetas"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Packing list
    cursor.execute("SELECT * FROM packing_list WHERE id = %s", (packing_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    columns = [d[0] for d in cursor.description]
    packing = dict(zip(columns, row))

    # Items
    cursor.execute("""
        SELECT
            pi.*,
            pt.nombre as template_nombre,
            pt.tipo as template_tipo
        FROM packing_item pi
        LEFT JOIN packaging_template pt ON pi.template_id = pt.id
        WHERE pi.packing_list_id = %s
        ORDER BY pi.bulto_numero, pi.id
    """, (packing_id,))

    columns = [d[0] for d in cursor.description]
    packing['items'] = [dict(zip(columns, row)) for row in cursor.fetchall()]

    # Etiquetas
    cursor.execute("""
        SELECT * FROM shipping_label
        WHERE packing_list_id = %s
        ORDER BY bulto_numero
    """, (packing_id,))

    columns = [d[0] for d in cursor.description]
    packing['etiquetas'] = [dict(zip(columns, row)) for row in cursor.fetchall()]

    conn.close()
    return packing


def agregar_item(packing_id: int, datos: Dict) -> Dict:
    """Agregar item a packing list y actualizar totales"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verificar que esté en draft
    cursor.execute("SELECT estado FROM packing_list WHERE id = %s", (packing_id,))
    row = cursor.fetchone()
    if not row or row[0] != 'draft':
        conn.close()
        raise ValueError("Solo se pueden agregar items a packing lists en estado draft")

    # Insertar item
    cursor.execute("""
        INSERT INTO packing_item
        (packing_list_id, material_codigo, cantidad, lote_id, template_id, bulto_numero, peso_item, notas)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        packing_id,
        datos['material_codigo'],
        datos['cantidad'],
        datos.get('lote_id'),
        datos.get('template_id'),
        datos.get('bulto_numero'),
        datos.get('peso_item', 0),
        datos.get('notas')
    ))

    item_id = cursor.fetchone()[0]

    # Recalcular totales
    cursor.execute("""
        SELECT
            COALESCE(SUM(peso_item), 0) as peso_total,
            COUNT(DISTINCT bulto_numero) as bultos_total
        FROM packing_item
        WHERE packing_list_id = %s AND bulto_numero IS NOT NULL
    """, (packing_id,))

    totales = cursor.fetchone()
    peso_total = totales[0] or 0
    bultos_total = totales[1] or 0

    cursor.execute("""
        UPDATE packing_list
        SET peso_total = %s, bultos_total = %s
        WHERE id = %s
    """, (peso_total, bultos_total, packing_id))

    conn.commit()

    cursor.execute("SELECT * FROM packing_item WHERE id = %s", (item_id,))
    item = dict(zip([d[0] for d in cursor.description], cursor.fetchone()))

    conn.close()
    return item


def eliminar_item(packing_id: int, item_id: int) -> bool:
    """Eliminar item y recalcular totales"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verificar que esté en draft
    cursor.execute("SELECT estado FROM packing_list WHERE id = %s", (packing_id,))
    row = cursor.fetchone()
    if not row or row[0] != 'draft':
        conn.close()
        raise ValueError("Solo se pueden eliminar items de packing lists en estado draft")

    cursor.execute("""
        DELETE FROM packing_item
        WHERE id = %s AND packing_list_id = %s
    """, (item_id, packing_id))

    # Recalcular totales
    cursor.execute("""
        SELECT
            COALESCE(SUM(peso_item), 0) as peso_total,
            COUNT(DISTINCT bulto_numero) as bultos_total
        FROM packing_item
        WHERE packing_list_id = %s AND bulto_numero IS NOT NULL
    """, (packing_id,))

    totales = cursor.fetchone()
    peso_total = totales[0] or 0
    bultos_total = totales[1] or 0

    cursor.execute("""
        UPDATE packing_list
        SET peso_total = %s, bultos_total = %s
        WHERE id = %s
    """, (peso_total, bultos_total, packing_id))

    conn.commit()
    conn.close()
    return True


def optimizar_empaque(packing_id: int) -> Dict:
    """
    Optimizar distribución de items en bultos (bin packing)
    Algoritmo: First Fit Decreasing por peso
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener items sin bulto asignado
    cursor.execute("""
        SELECT
            pi.id,
            pi.peso_item,
            pi.template_id,
            pt.peso_max
        FROM packing_item pi
        LEFT JOIN packaging_template pt ON pi.template_id = pt.id
        WHERE pi.packing_list_id = %s AND pi.bulto_numero IS NULL
        ORDER BY pi.peso_item DESC
    """, (packing_id,))

    items = cursor.fetchall()
    if not items:
        conn.close()
        return {
            'bultos_creados': 0,
            'items_asignados': 0,
            'peso_total': 0
        }

    # Obtener peso máximo del template más común
    cursor.execute("""
        SELECT pt.peso_max
        FROM packaging_template pt
        INNER JOIN packing_item pi ON pi.template_id = pt.id
        WHERE pi.packing_list_id = %s
        GROUP BY pt.peso_max
        ORDER BY COUNT(*) DESC
        LIMIT 1
    """, (packing_id,))

    row = cursor.fetchone()
    peso_max_default = row[0] if row else 1000.0

    # Bin packing: First Fit Decreasing
    bultos = []  # Lista de (peso_actual, [item_ids])
    bulto_numero = 1

    # Obtener max bulto_numero existente
    cursor.execute("""
        SELECT MAX(bulto_numero) FROM packing_item
        WHERE packing_list_id = %s
    """, (packing_id,))
    max_bulto = cursor.fetchone()[0]
    if max_bulto:
        bulto_numero = max_bulto + 1

    for item_row in items:
        item_id = item_row[0]
        peso_item = item_row[1] or 0
        # item_row[2] is template_id (not needed here)
        peso_max = item_row[3]
        limite_peso = peso_max or peso_max_default

        # Buscar bulto con capacidad
        asignado = False
        for i, (peso_actual, item_ids) in enumerate(bultos):
            if peso_actual + peso_item <= limite_peso:
                bultos[i] = (peso_actual + peso_item, item_ids + [item_id])
                asignado = True
                break

        # Crear nuevo bulto si no cabe
        if not asignado:
            bultos.append((peso_item, [item_id]))

    # Asignar números de bulto
    items_asignados = 0
    peso_total_asignado = 0

    for peso_bulto, item_ids in bultos:
        for item_id in item_ids:
            cursor.execute("""
                UPDATE packing_item
                SET bulto_numero = %s
                WHERE id = %s
            """, (bulto_numero, item_id))
            items_asignados += 1

        peso_total_asignado += peso_bulto
        bulto_numero += 1

    # Recalcular totales
    cursor.execute("""
        SELECT
            COALESCE(SUM(peso_item), 0) as peso_total,
            COUNT(DISTINCT bulto_numero) as bultos_total
        FROM packing_item
        WHERE packing_list_id = %s AND bulto_numero IS NOT NULL
    """, (packing_id,))

    totales = cursor.fetchone()
    cursor.execute("""
        UPDATE packing_list
        SET peso_total = %s, bultos_total = %s
        WHERE id = %s
    """, (totales[0], totales[1], packing_id))

    conn.commit()
    conn.close()

    return {
        'bultos_creados': len(bultos),
        'items_asignados': items_asignados,
        'peso_total': peso_total_asignado
    }


def empacar(packing_id: int) -> Dict:
    """Cambiar estado a empacado"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT estado FROM packing_list WHERE id = %s", (packing_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ValueError("Packing list no encontrado")

    if row[0] != 'draft':
        conn.close()
        raise ValueError("Solo se pueden empacar packing lists en estado draft")

    cursor.execute("""
        UPDATE packing_list
        SET estado = 'empacado'
        WHERE id = %s
    """, (packing_id,))

    conn.commit()

    cursor.execute("SELECT * FROM packing_list WHERE id = %s", (packing_id,))
    packing = dict(zip([d[0] for d in cursor.description], cursor.fetchone()))

    conn.close()
    return packing


def despachar(packing_id: int) -> Dict:
    """Cambiar estado a despachado"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT estado FROM packing_list WHERE id = %s", (packing_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ValueError("Packing list no encontrado")

    if row[0] != 'empacado':
        conn.close()
        raise ValueError("Solo se pueden despachar packing lists empacados")

    cursor.execute("""
        UPDATE packing_list
        SET estado = 'despachado'
        WHERE id = %s
    """, (packing_id,))

    conn.commit()

    cursor.execute("SELECT * FROM packing_list WHERE id = %s", (packing_id,))
    packing = dict(zip([d[0] for d in cursor.description], cursor.fetchone()))

    conn.close()
    return packing


def generar_etiqueta(packing_id: int, bulto_numero: int, tipo: str = 'shipping', formato: str = 'pdf') -> Dict:
    """Generar etiqueta de envío"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener datos del packing
    cursor.execute("""
        SELECT numero, peso_total FROM packing_list WHERE id = %s
    """, (packing_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ValueError("Packing list no encontrado")

    numero_packing = row[0]
    # row[1] is peso_total (not needed for label generation)

    # Obtener items del bulto
    cursor.execute("""
        SELECT material_codigo, cantidad, peso_item
        FROM packing_item
        WHERE packing_list_id = %s AND bulto_numero = %s
    """, (packing_id, bulto_numero))

    items = cursor.fetchall()
    if not items:
        conn.close()
        raise ValueError(f"No hay items en el bulto {bulto_numero}")

    # Generar contenido de etiqueta
    contenido_items = []
    peso_bulto = 0
    for item_row in items:
        material_codigo = item_row[0]
        cantidad = item_row[1]
        peso_item = item_row[2]
        contenido_items.append(f"{material_codigo}: {cantidad} unidades")
        peso_bulto += (peso_item or 0)

    contenido = {
        'packing_numero': numero_packing,
        'bulto_numero': bulto_numero,
        'items': contenido_items,
        'peso_bulto': peso_bulto,
        'tipo': tipo
    }

    # Simular generación de URL (en producción sería S3/storage)
    url_label = f"/labels/{numero_packing}-{bulto_numero}.{formato}"

    import json
    cursor.execute("""
        INSERT INTO shipping_label
        (packing_list_id, bulto_numero, tipo, contenido, formato, url_label)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        packing_id,
        bulto_numero,
        tipo,
        json.dumps(contenido),
        formato,
        url_label
    ))

    label_id = cursor.fetchone()[0]
    conn.commit()

    cursor.execute("SELECT * FROM shipping_label WHERE id = %s", (label_id,))
    label = dict(zip([d[0] for d in cursor.description], cursor.fetchone()))

    conn.close()
    return label


def obtener_kpis() -> Dict:
    """Obtener KPIs de packaging"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Packing lists activos
    cursor.execute("""
        SELECT COUNT(*) FROM packing_list
        WHERE estado IN ('draft', 'empacado')
    """)
    activos = cursor.fetchone()[0]

    # Bultos empacados este mes
    cursor.execute("""
        SELECT COALESCE(SUM(bultos_total), 0)
        FROM packing_list
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        AND estado != 'draft'
    """)
    bultos_mes = cursor.fetchone()[0]

    # Etiquetas generadas
    cursor.execute("SELECT COUNT(*) FROM shipping_label")
    etiquetas_generadas = cursor.fetchone()[0]

    # Peso total despachado este mes
    cursor.execute("""
        SELECT COALESCE(SUM(peso_total), 0)
        FROM packing_list
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        AND estado = 'despachado'
    """)
    peso_mes = cursor.fetchone()[0]

    conn.close()

    return {
        'packing_lists_activos': activos,
        'bultos_mes': bultos_mes,
        'etiquetas_generadas': etiquetas_generadas,
        'peso_despachado_mes_kg': round(peso_mes, 2)
    }
