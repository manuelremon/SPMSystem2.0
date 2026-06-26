"""
Servicio del AI Procurement Copilot.
Gestiona conversaciones, sugerencias y aprendizaje del copiloto.
"""

import logging

from backend.core.db import (
    get_db_connection,
    get_db_transaction,
    insert_returning_id,
    is_using_postgresql,
    sql_date_relative,
    sql_datetime_now,
    sql_format_date,
)

# Try to import Vertex AI client if available
try:
    from backend.agent.rag.gemini_client import GeminiClient
    VERTEX_AVAILABLE = True
except ImportError:  # noqa: E722
    VERTEX_AVAILABLE = False

logger = logging.getLogger(__name__)


def iniciar_conversacion(usuario_id: int, titulo: str = None, contexto_tipo: str = 'procurement') -> int:
    """
    Inicia una nueva conversación con el copiloto.

    Args:
        usuario_id: ID del usuario
        titulo: Título de la conversación (optional)
        contexto_tipo: Tipo de contexto (default: 'procurement')

    Returns:
        ID de la conversación creada
    """
    with get_db_transaction() as (conn, cursor):
        now_sql = sql_datetime_now()
        conv_id = insert_returning_id(
            cursor,
            f"""
                INSERT INTO copilot_conversacion
                (usuario_id, titulo, contexto_tipo, created_at, updated_at)
                VALUES (?, ?, ?, {now_sql}, {now_sql})
            """,
            (usuario_id, titulo or 'Nueva conversación', contexto_tipo),
        )

        conn.commit()
        logger.info(f"Conversación iniciada: {conv_id} (usuario: {usuario_id})")
        return conv_id


def obtener_conversaciones(usuario_id: int) -> list:
    """
    Obtiene conversaciones de un usuario.

    Args:
        usuario_id: ID del usuario

    Returns:
        Lista de conversaciones
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            f"""
            SELECT id, titulo, contexto_tipo, created_at, updated_at
            FROM copilot_conversacion
            WHERE usuario_id = {placeholder}
            ORDER BY updated_at DESC
            """,
            (usuario_id,)
        )

        conversaciones = []
        for row in cursor.fetchall():
            conversaciones.append({
                'id': row[0],
                'titulo': row[1],
                'contexto_tipo': row[2],
                'created_at': row[3],
                'updated_at': row[4]
            })

        return conversaciones
    finally:
        cursor.close()
        conn.close()


def obtener_mensajes(conversacion_id: int) -> list:
    """
    Obtiene mensajes de una conversación.

    Args:
        conversacion_id: ID de la conversación

    Returns:
        Lista de mensajes
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            f"""
            SELECT id, rol, contenido, metadata, created_at
            FROM copilot_mensaje
            WHERE conversacion_id = {placeholder}
            ORDER BY created_at ASC
            """,
            (conversacion_id,)
        )

        mensajes = []
        for row in cursor.fetchall():
            mensajes.append({
                'id': row[0],
                'rol': row[1],
                'contenido': row[2],
                'metadata': row[3],
                'created_at': row[4]
            })

        return mensajes
    finally:
        cursor.close()
        conn.close()


def enviar_mensaje(conversacion_id: int, contenido: str, usuario_id: int) -> dict:
    """
    Envía un mensaje del usuario y genera respuesta del asistente.

    Args:
        conversacion_id: ID de la conversación
        contenido: Contenido del mensaje del usuario
        usuario_id: ID del usuario

    Returns:
        Mensaje de respuesta del asistente
    """
    with get_db_transaction() as (conn, cursor):
        now_sql = sql_datetime_now()

        # Insertar mensaje del usuario
        cursor.execute(f"""
            INSERT INTO copilot_mensaje
            (conversacion_id, rol, contenido, created_at)
            VALUES (?, ?, ?, {now_sql})
        """, (conversacion_id, 'user', contenido))

        # Generar respuesta del asistente
        respuesta = _generar_respuesta(conversacion_id, contenido, usuario_id, conn)

        # Insertar mensaje del asistente
        mensaje_id = insert_returning_id(
            cursor,
            f"""
                INSERT INTO copilot_mensaje
                (conversacion_id, rol, contenido, metadata, created_at)
                VALUES (?, ?, ?, ?, {now_sql})
            """,
            (conversacion_id, 'assistant', respuesta['contenido'], respuesta.get('metadata')),
        )

        # Actualizar timestamp de conversación
        cursor.execute(
            f"UPDATE copilot_conversacion SET updated_at = {now_sql} WHERE id = ?",
            (conversacion_id,)
        )

        conn.commit()

        return {
            'id': mensaje_id,
            'rol': 'assistant',
            'contenido': respuesta['contenido'],
            'metadata': respuesta.get('metadata')
        }


def _generar_respuesta(conversacion_id: int, contenido: str, usuario_id: int, conn) -> dict:
    """
    Genera respuesta del asistente (internal).

    Args:
        conversacion_id: ID de la conversación
        contenido: Mensaje del usuario
        usuario_id: ID del usuario
        conn: Conexión de BD

    Returns:
        {contenido: str, metadata: str (optional)}
    """
    # Intentar usar Vertex AI si está disponible
    if VERTEX_AVAILABLE:
        try:
            client = GeminiClient()
            # Build context from recent conversation
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT rol, contenido FROM copilot_mensaje WHERE conversacion_id = {'%s' if is_using_postgresql() else '?'} ORDER BY created_at DESC LIMIT 10",
                (conversacion_id,)
            )
            historial = cursor.fetchall()
            cursor.close()

            # Build prompt with context
            contexto = "\n".join([f"{rol}: {msg}" for rol, msg in reversed(historial)])
            prompt = f"""Eres un asistente experto en procurement y supply chain management.
Historial de conversación:
{contexto}

Usuario: {contenido}

Proporciona una respuesta útil y concisa basada en las mejores prácticas de procurement."""

            respuesta = client.generate_text(prompt)
            return {'contenido': respuesta, 'metadata': 'vertex_ai'}
        except Exception as e:  # noqa: E722
            logger.warning(f"Error usando Vertex AI, fallback a respuesta template: {e}")

    # Fallback: respuesta basada en templates/patrones
    contenido_lower = contenido.lower()

    if 'precio' in contenido_lower or 'costo' in contenido_lower:
        return {
            'contenido': 'Para análisis de precios, te recomiendo revisar el módulo de Spend Analytics donde puedes ver tendencias de precios por material y comparar entre proveedores. También puedes usar el TCO (Total Cost of Ownership) para análisis más completo.',
            'metadata': 'template_pricing'
        }
    elif 'proveedor' in contenido_lower or 'supplier' in contenido_lower:
        return {
            'contenido': 'Puedo ayudarte con análisis de proveedores. Revisa el Scorecard de Proveedores para ver evaluaciones detalladas, o el Mapa de Riesgo para identificar proveedores de alto riesgo. ¿Necesitas algo específico sobre algún proveedor?',
            'metadata': 'template_supplier'
        }
    elif 'stock' in contenido_lower or 'inventario' in contenido_lower:
        return {
            'contenido': 'Para consultas de stock, puedes usar el módulo de Inventario que muestra niveles actuales, puntos de reorden y recomendaciones de transferencias. El módulo de Optimización de Inventario puede ayudarte a balancear niveles entre ubicaciones.',
            'metadata': 'template_inventory'
        }
    elif 'forecast' in contenido_lower or 'pronóstico' in contenido_lower:
        return {
            'contenido': 'El sistema cuenta con modelos avanzados de forecasting (ARIMA, Prophet, XGBoost) que puedes usar para proyecciones de demanda. También está disponible el módulo de S&OP para planificación colaborativa.',
            'metadata': 'template_forecast'
        }
    else:
        return {
            'contenido': 'Puedo ayudarte con: análisis de precios, evaluación de proveedores, optimización de inventario, forecasting de demanda, y mucho más. ¿En qué área específica necesitas asistencia?',
            'metadata': 'template_general'
        }


def generar_sugerencia_sourcing(material_codigo: str) -> dict:
    """
    Genera sugerencia de estrategia de sourcing para un material.

    Args:
        material_codigo: Código del material

    Returns:
        Sugerencia creada
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Analizar datos del material
        # 1. Proveedores actuales (de órdenes de compra)
        cursor.execute(
            f"""
            SELECT DISTINCT p.id_proveedor, p.nombre, AVG(oci.precio_unitario) as precio_promedio
            FROM orden_compra oc
            JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
            JOIN proveedores p ON oc.proveedor_cuit = p.id_proveedor
            WHERE oci.material_codigo = {placeholder}
            AND oc.estado IN ('completed', 'approved')
            GROUP BY p.id_proveedor, p.nombre
            ORDER BY precio_promedio ASC
            LIMIT 5
            """,
            (material_codigo,)
        )
        proveedores = cursor.fetchall()

        # 2. Obtener risk scores si existen
        cursor.execute(
            f"""
            SELECT pr.proveedor_cuit, pr.score_riesgo
            FROM proveedor_riesgo pr
            WHERE pr.proveedor_cuit IN (
                SELECT DISTINCT proveedor_cuit FROM orden_compra oc
                JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
                WHERE oci.material_codigo = {placeholder}
            )
            """,
            (material_codigo,)
        )
        risk_scores = {row[0]: row[1] for row in cursor.fetchall()}

        # Construir recomendación
        if len(proveedores) == 0:
            contenido = f"Material {material_codigo}: No se encontraron proveedores históricos. Recomendación: Iniciar proceso de RFQ para identificar nuevas fuentes."
        elif len(proveedores) == 1:
            contenido = f"Material {material_codigo}: Fuente única ({proveedores[0][1]}). RIESGO ALTO. Recomendación: Buscar proveedores alternativos urgentemente."
        else:
            mejor_proveedor = proveedores[0]
            risk = risk_scores.get(mejor_proveedor[0], 'N/A')
            contenido = f"Material {material_codigo}: {len(proveedores)} proveedores activos. Mejor precio: {mejor_proveedor[1]} (${mejor_proveedor[2]:.2f}, Risk Score: {risk}). Recomendación: Mantener dual sourcing, revisar contratos para mejores términos."

        # Insertar sugerencia
        with get_db_transaction() as (conn_tx, cursor_tx):
            sugerencia_id = insert_returning_id(
                cursor_tx,
                f"""
                    INSERT INTO copilot_sugerencia
                    (tipo, titulo, contenido, datos_soporte, estado, material_codigo, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, {sql_datetime_now()})
                """,
                (
                    'sourcing_strategy',
                    f'Estrategia de Sourcing - {material_codigo}',
                    contenido,
                    f'{{"num_proveedores": {len(proveedores)}}}',
                    'pending',
                    material_codigo
                ),
            )

            conn_tx.commit()

        logger.info(f"Sugerencia de sourcing generada: {sugerencia_id} para material {material_codigo}")

        return {
            'id': sugerencia_id,
            'tipo': 'sourcing_strategy',
            'titulo': f'Estrategia de Sourcing - {material_codigo}',
            'contenido': contenido
        }
    finally:
        cursor.close()
        conn.close()


def auto_draft_rfq(solicitud_id: int) -> dict:
    """
    Genera borrador automático de RFQ para una solicitud.

    Args:
        solicitud_id: ID de la solicitud

    Returns:
        Sugerencia creada
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Obtener items de la solicitud
        cursor.execute(
            f"""
            SELECT i.material_codigo, i.cantidad, i.unidad
            FROM items i
            WHERE i.solicitud_id = {placeholder}
            """,
            (solicitud_id,)
        )
        items = cursor.fetchall()

        if not items:
            raise ValueError(f"Solicitud {solicitud_id} no tiene items")

        # Por cada material, encontrar proveedores potenciales
        proveedores_sugeridos = set()
        for material_codigo, cantidad, unidad in items:
            cursor.execute(
                f"""
                SELECT DISTINCT p.id_proveedor, p.nombre
                FROM orden_compra oc
                JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
                JOIN proveedores p ON oc.proveedor_cuit = p.id_proveedor
                WHERE oci.material_codigo = {placeholder}
                AND oc.estado IN ('completed', 'approved')
                LIMIT 3
                """,
                (material_codigo,)
            )
            proveedores_sugeridos.update(row[0] for row in cursor.fetchall())

        # Construir contenido
        materiales_str = ", ".join([f"{code} ({qty} {unit})" for code, qty, unit in items])
        proveedores_str = ", ".join(proveedores_sugeridos) if proveedores_sugeridos else "No se encontraron proveedores históricos"

        contenido = f"""Borrador de RFQ para Solicitud #{solicitud_id}

Materiales solicitados:
{materiales_str}

Proveedores sugeridos:
{proveedores_str}

Próximos pasos:
1. Revisar y ajustar especificaciones
2. Añadir proveedores adicionales si es necesario
3. Definir criterios de evaluación
4. Establecer fecha límite de respuesta
5. Enviar RFQ"""

        # Insertar sugerencia
        with get_db_transaction() as (conn_tx, cursor_tx):
            sugerencia_id = insert_returning_id(
                cursor_tx,
                f"""
                    INSERT INTO copilot_sugerencia
                    (tipo, titulo, contenido, datos_soporte, estado, created_at)
                    VALUES (?, ?, ?, ?, ?, {sql_datetime_now()})
                """,
                (
                    'rfq_draft',
                    f'Borrador RFQ - Solicitud #{solicitud_id}',
                    contenido,
                    f'{{"solicitud_id": {solicitud_id}, "num_proveedores": {len(proveedores_sugeridos)}}}',
                    'pending'
                ),
            )

            conn_tx.commit()

        logger.info(f"Borrador de RFQ generado: {sugerencia_id} para solicitud {solicitud_id}")

        return {
            'id': sugerencia_id,
            'tipo': 'rfq_draft',
            'titulo': f'Borrador RFQ - Solicitud #{solicitud_id}',
            'contenido': contenido
        }
    finally:
        cursor.close()
        conn.close()


def obtener_sugerencias(filtros: dict = None) -> list:
    """
    Obtiene sugerencias con filtros.

    Args:
        filtros: {
            'tipo': str (optional),
            'estado': str (optional)
        }

    Returns:
        Lista de sugerencias
    """
    filtros = filtros or {}
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        where_clauses = []
        params = []

        if filtros.get('tipo'):
            where_clauses.append(f"tipo = {placeholder}")
            params.append(filtros['tipo'])

        if filtros.get('estado'):
            where_clauses.append(f"estado = {placeholder}")
            params.append(filtros['estado'])

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        cursor.execute(
            f"""
            SELECT id, tipo, titulo, contenido, datos_soporte, estado, created_at
            FROM copilot_sugerencia
            {where_sql}
            ORDER BY created_at DESC
            LIMIT 50
            """,
            params
        )

        sugerencias = []
        for row in cursor.fetchall():
            sugerencias.append({
                'id': row[0],
                'tipo': row[1],
                'titulo': row[2],
                'contenido': row[3],
                'datos_soporte': row[4],
                'estado': row[5],
                'created_at': row[6]
            })

        return sugerencias
    finally:
        cursor.close()
        conn.close()


def feedback_sugerencia(sugerencia_id: int, accion: str, feedback: str = None) -> None:
    """
    Registra feedback sobre una sugerencia.

    Args:
        sugerencia_id: ID de la sugerencia
        accion: Acción tomada (accepted, rejected, modified)
        feedback: Feedback opcional
    """
    using_pg = is_using_postgresql()
    placeholder = '%s' if using_pg else '?'

    with get_db_transaction() as (conn, cursor):
        # Actualizar estado de sugerencia
        nuevo_estado = 'accepted' if accion == 'accepted' else 'rejected' if accion == 'rejected' else 'modified'
        cursor.execute(
            f"UPDATE copilot_sugerencia SET estado = {placeholder} WHERE id = {placeholder}",
            (nuevo_estado, sugerencia_id)
        )

        # Insertar registro de aprendizaje
        cursor.execute(f"""
            INSERT INTO copilot_learning
            (sugerencia_id, accion, feedback, created_at)
            VALUES (?, ?, ?, {sql_datetime_now()})
        """, (sugerencia_id, accion, feedback))

        conn.commit()
        logger.info(f"Feedback registrado para sugerencia {sugerencia_id}: {accion}")


def obtener_insights_dashboard() -> dict:
    """
    Obtiene insights principales para el dashboard del copiloto.

    Returns:
        {
            'savings_opportunities': [...],
            'risk_alerts': [...],
            'sourcing_gaps': [...]
        }
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Oportunidades de ahorro (comparar precios entre proveedores)
        cursor.execute("""
            SELECT
                material_codigo,
                MAX(precio_unitario) - MIN(precio_unitario) as diferencia,
                COUNT(DISTINCT proveedor_cuit) as num_proveedores
            FROM (
                SELECT oci.material_codigo, oc.proveedor_cuit, AVG(oci.precio_unitario) as precio_unitario
                FROM orden_compra oc
                JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
                WHERE oc.estado IN ('completed', 'approved')
                GROUP BY oci.material_codigo, oc.proveedor_cuit
            ) precios
            GROUP BY material_codigo
            HAVING COUNT(DISTINCT proveedor_cuit) > 1
            ORDER BY diferencia DESC
            LIMIT 5
        """)

        savings_opportunities = []
        for row in cursor.fetchall():
            savings_opportunities.append({
                'material_codigo': row[0],
                'potencial_ahorro': float(row[1]) if row[1] else 0,
                'num_proveedores': row[2]
            })

        # 2. Alertas de riesgo (proveedores de alto riesgo con OCs activas)
        cursor.execute("""
            SELECT DISTINCT
                p.id_proveedor, p.nombre, pr.score_riesgo,
                COUNT(DISTINCT oc.id) as ocs_activas
            FROM proveedores p
            JOIN proveedor_riesgo pr ON p.id_proveedor = pr.proveedor_cuit
            JOIN orden_compra oc ON p.id_proveedor = oc.proveedor_cuit
            WHERE pr.score_riesgo >= 70
            AND oc.estado IN ('submitted', 'approved')
            GROUP BY p.id_proveedor, p.nombre, pr.score_riesgo
            ORDER BY pr.score_riesgo DESC
            LIMIT 5
        """)

        risk_alerts = []
        for row in cursor.fetchall():
            risk_alerts.append({
                'proveedor_cuit': row[0],
                'proveedor_nombre': row[1],
                'risk_score': float(row[2]) if row[2] else 0,
                'ocs_activas': row[3]
            })

        # 3. Brechas de sourcing (materiales con fuente única)
        cursor.execute("""
            SELECT material_codigo, COUNT(DISTINCT proveedor_cuit) as num_proveedores
            FROM (
                SELECT oci.material_codigo, oc.proveedor_cuit
                FROM orden_compra oc
                JOIN orden_compra_item oci ON oc.id = oci.orden_compra_id
                WHERE oc.estado IN ('completed', 'approved')
            ) proveedores_por_material
            GROUP BY material_codigo
            HAVING COUNT(DISTINCT proveedor_cuit) = 1
            LIMIT 10
        """)

        sourcing_gaps = []
        for row in cursor.fetchall():
            sourcing_gaps.append({
                'material_codigo': row[0],
                'num_proveedores': row[1]
            })

        return {
            'savings_opportunities': savings_opportunities,
            'risk_alerts': risk_alerts,
            'sourcing_gaps': sourcing_gaps
        }
    finally:
        cursor.close()
        conn.close()


def analizar_patron_gasto(periodo: str = None) -> dict:
    """
    Analiza patrones de gasto.

    Args:
        periodo: Periodo a analizar (formato 'YYYY-MM', optional, default: último mes)

    Returns:
        Análisis de gasto
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Determinar periodo
        if not periodo:
            cursor.execute(
                f"SELECT {sql_format_date(sql_date_relative(months=-1), '%Y-%m')}"
            )
            periodo = cursor.fetchone()[0]

        # Top categorías de gasto por proveedor (orden_compra has no categoria_spend_id)
        cursor.execute(f"""
            SELECT oc.proveedor_nombre as categoria, SUM(oc.monto_total) as gasto_total
            FROM orden_compra oc
            WHERE {sql_format_date('oc.fecha_emision', '%Y-%m')} = ?
            AND oc.estado IN ('completada', 'aprobada', 'completed', 'approved')
            GROUP BY oc.proveedor_nombre ORDER BY gasto_total DESC LIMIT 5
        """, (periodo,))

        top_categorias = []
        for row in cursor.fetchall():
            top_categorias.append({
                'categoria': row[0] or 'Sin categoría',
                'gasto_total': float(row[1]) if row[1] else 0
            })

        # Maverick spend (OCs sin contrato)
        cursor.execute(f"""
            SELECT COUNT(*), COALESCE(SUM(monto_total), 0)
            FROM orden_compra WHERE contrato_id IS NULL
            AND {sql_format_date('fecha_emision', '%Y-%m')} = ?
        """, (periodo,))
        maverick_data = cursor.fetchone()

        return {
            'periodo': periodo,
            'top_categorias': top_categorias,
            'maverick_spend': {
                'count': maverick_data[0],
                'total': float(maverick_data[1]) if maverick_data[1] else 0
            }
        }
    finally:
        cursor.close()
        conn.close()
