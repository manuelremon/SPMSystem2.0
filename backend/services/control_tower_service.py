"""
Servicio de Supply Chain Control Tower.
Agrega eventos, KPIs y alertas de toda la cadena de suministro.
"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)


def registrar_evento(
    evento_tipo: str,
    entidad_tipo: str,
    entidad_id: int,
    severidad: str,
    titulo: str,
    descripcion: str,
    centro_id: Optional[int] = None,
    proveedor_cuit: Optional[str] = None,
    categoria: str = 'procurement',
    metadata: Optional[Dict[str, Any]] = None
) -> Optional[int]:
    """
    Registra un evento en el Control Tower.

    Args:
        evento_tipo: Tipo de evento (ej: 'sla_breach', 'stock_alert')
        entidad_tipo: Tipo de entidad (ej: 'solicitud', 'orden_compra')
        entidad_id: ID de la entidad
        severidad: Severidad ('info', 'warning', 'error', 'critical')
        titulo: Título del evento
        descripcion: Descripción detallada
        centro_id: ID del centro (opcional)
        proveedor_cuit: CUIT del proveedor (opcional)
        categoria: Categoría ('procurement', 'logistics', 'quality', 'finance')
        metadata: Metadata JSON adicional

    Returns:
        ID del evento creado o None si falla
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                INSERT INTO control_tower_event
                (evento_tipo, entidad_tipo, entidad_id, severidad, titulo, descripcion,
                 centro_id, proveedor_cuit, categoria, metadata, timestamp)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder})
            """, (
                evento_tipo, entidad_tipo, entidad_id, severidad, titulo, descripcion,
                centro_id, proveedor_cuit, categoria,
                str(metadata) if metadata else None,
                datetime.utcnow()
            ))

            if is_using_postgresql():
                cursor.execute("SELECT lastval()")
            else:
                cursor.execute("SELECT last_insert_rowid()")

            event_id = cursor.fetchone()[0]
            logger.info(f"Control Tower evento registrado: {event_id} - {titulo}")
            return event_id

    except Exception as e:
        logger.error(f"Error registrando evento Control Tower: {str(e)}", exc_info=True)
        return None


def obtener_eventos_timeline(filtros: Dict[str, Any]) -> Dict[str, Any]:
    """
    Obtiene eventos del timeline con paginación y filtros.

    Args:
        filtros: Dict con categoria, severidad, fecha_desde, fecha_hasta, page, per_page

    Returns:
        Dict con items, total, page, per_page
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'
        page = filtros.get('page', 1)
        per_page = filtros.get('per_page', 50)
        offset = (page - 1) * per_page

        # Build WHERE clause
        conditions = []
        params = []

        if filtros.get('categoria'):
            conditions.append(f"categoria = {placeholder}")
            params.append(filtros['categoria'])

        if filtros.get('severidad'):
            conditions.append(f"severidad = {placeholder}")
            params.append(filtros['severidad'])

        if filtros.get('fecha_desde'):
            conditions.append(f"timestamp >= {placeholder}")
            params.append(filtros['fecha_desde'])

        if filtros.get('fecha_hasta'):
            conditions.append(f"timestamp <= {placeholder}")
            params.append(filtros['fecha_hasta'])

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Get total count
            cursor.execute(f"""
                SELECT COUNT(*) FROM control_tower_event
                WHERE {where_clause}
            """, params)
            total = cursor.fetchone()[0]

            # Get paginated items
            cursor.execute(f"""
                SELECT id, evento_tipo, entidad_tipo, entidad_id, severidad,
                       titulo, descripcion, centro_id, proveedor_cuit, categoria,
                       metadata, timestamp
                FROM control_tower_event
                WHERE {where_clause}
                ORDER BY timestamp DESC
                LIMIT {placeholder} OFFSET {placeholder}
            """, params + [per_page, offset])

            columns = [desc[0] for desc in cursor.description]
            items = [dict(zip(columns, row)) for row in cursor.fetchall()]

            return {
                'items': items,
                'total': total,
                'page': page,
                'per_page': per_page
            }

    except Exception as e:
        logger.error(f"Error obteniendo eventos timeline: {str(e)}", exc_info=True)
        return {'items': [], 'total': 0, 'page': page, 'per_page': per_page}


def obtener_kpis_agregados() -> Dict[str, Any]:
    """
    Obtiene KPIs agregados de toda la cadena de suministro.

    Returns:
        Dict con todos los KPIs
    """
    kpis = {
        'solicitudes_pendientes': 0,
        'ordenes_compra_activas': 0,
        'envios_en_transito': 0,
        'inspecciones_pendientes': 0,
        'alertas_activas': 0,
        'sla_cumplimiento': 0.0,
        'contratos_por_vencer': 0,
        'rfq_abiertas': 0
    }

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Solicitudes pendientes
            try:
                cursor.execute("""
                    SELECT COUNT(*) FROM solicitud
                    WHERE status IN ('submitted', 'approved')
                """)
                kpis['solicitudes_pendientes'] = cursor.fetchone()[0]
            except Exception as e:
                logger.debug(f"Error contando solicitudes: {e}")

            # Órdenes de compra activas
            try:
                cursor.execute("""
                    SELECT COUNT(*) FROM orden_compra
                    WHERE estado IN ('draft', 'approved', 'in_progress')
                """)
                kpis['ordenes_compra_activas'] = cursor.fetchone()[0]
            except Exception as e:
                logger.debug(f"Error contando órdenes: {e}")

            # Envíos en tránsito
            try:
                cursor.execute("""
                    SELECT COUNT(*) FROM envio
                    WHERE estado = 'in_transit'
                """)
                kpis['envios_en_transito'] = cursor.fetchone()[0]
            except Exception as e:
                logger.debug(f"Tabla envio no disponible: {e}")

            # Inspecciones pendientes
            try:
                cursor.execute("""
                    SELECT COUNT(*) FROM inspeccion_entrada
                    WHERE estado = 'pending'
                """)
                kpis['inspecciones_pendientes'] = cursor.fetchone()[0]
            except Exception as e:
                logger.debug(f"Tabla inspeccion_entrada no disponible: {e}")

            # Alertas activas
            try:
                cursor.execute("""
                    SELECT COUNT(*) FROM control_tower_alerta_agregada
                    WHERE estado = 'active'
                """)
                kpis['alertas_activas'] = cursor.fetchone()[0]
            except Exception as e:
                logger.debug(f"Error contando alertas: {e}")

            # SLA cumplimiento (últimos 30 días)
            try:
                fecha_inicio = datetime.utcnow() - timedelta(days=30)
                placeholder = '%s' if is_using_postgresql() else '?'
                cursor.execute(f"""
                    SELECT
                        COUNT(CASE WHEN sla_cumplido = 1 THEN 1 END) * 100.0 / COUNT(*)
                    FROM solicitud
                    WHERE created_at >= {placeholder}
                    AND status = 'closed'
                """, (fecha_inicio,))
                result = cursor.fetchone()[0]
                kpis['sla_cumplimiento'] = round(result or 0.0, 2)
            except Exception as e:
                logger.debug(f"Error calculando SLA: {e}")

            # Contratos por vencer (próximos 30 días)
            try:
                fecha_limite = datetime.utcnow() + timedelta(days=30)
                placeholder = '%s' if is_using_postgresql() else '?'
                cursor.execute(f"""
                    SELECT COUNT(*) FROM contrato
                    WHERE fecha_fin <= {placeholder}
                    AND fecha_fin >= {placeholder}
                    AND estado = 'active'
                """, (fecha_limite, datetime.utcnow()))
                kpis['contratos_por_vencer'] = cursor.fetchone()[0]
            except Exception as e:
                logger.debug(f"Tabla contrato no disponible: {e}")

            # RFQs abiertas
            try:
                cursor.execute("""
                    SELECT COUNT(*) FROM rfq
                    WHERE estado IN ('draft', 'published')
                """)
                kpis['rfq_abiertas'] = cursor.fetchone()[0]
            except Exception as e:
                logger.debug(f"Tabla rfq no disponible: {e}")

            return kpis

    except Exception as e:
        logger.error(f"Error obteniendo KPIs agregados: {str(e)}", exc_info=True)
        return kpis


def obtener_alertas_agregadas(filtros: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Obtiene alertas agregadas con filtros opcionales.

    Args:
        filtros: Dict opcional con estado, tipo

    Returns:
        Lista de alertas
    """
    try:
        filtros = filtros or {}
        placeholder = '%s' if is_using_postgresql() else '?'

        conditions = []
        params = []

        if filtros.get('estado'):
            conditions.append(f"estado = {placeholder}")
            params.append(filtros['estado'])

        if filtros.get('tipo'):
            conditions.append(f"tipo = {placeholder}")
            params.append(filtros['tipo'])

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(f"""
                SELECT id, tipo, titulo, descripcion, severidad, prioridad,
                       estado, entidad_tipo, entidad_id, metadata,
                       fecha_creacion, fecha_actualizacion
                FROM control_tower_alerta_agregada
                WHERE {where_clause}
                ORDER BY prioridad DESC, fecha_creacion DESC
            """, params)

            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]

    except Exception as e:
        logger.error(f"Error obteniendo alertas agregadas: {str(e)}", exc_info=True)
        return []


def marcar_alerta(alerta_id: int, nuevo_estado: str) -> bool:
    """
    Marca una alerta con un nuevo estado.

    Args:
        alerta_id: ID de la alerta
        nuevo_estado: Nuevo estado ('active', 'acknowledged', 'resolved')

    Returns:
        True si se actualizó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE control_tower_alerta_agregada
                SET estado = {placeholder},
                    fecha_actualizacion = {placeholder}
                WHERE id = {placeholder}
            """, (nuevo_estado, datetime.utcnow(), alerta_id))

            logger.info(f"Alerta {alerta_id} marcada como {nuevo_estado}")
            return True

    except Exception as e:
        logger.error(f"Error marcando alerta {alerta_id}: {str(e)}", exc_info=True)
        return False


def obtener_tendencias(kpi_key: Optional[str] = None, periodos: int = 24) -> List[Dict[str, Any]]:
    """
    Obtiene tendencias de KPIs históricos.

    Args:
        kpi_key: Clave específica de KPI (opcional, None = todos)
        periodos: Número de períodos a retornar

    Returns:
        Lista de {periodo, kpi_key, valor}
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_connection() as conn:
            cursor = conn.cursor()

            if kpi_key:
                cursor.execute(f"""
                    SELECT periodo, kpi_key, valor
                    FROM control_tower_kpi_snapshot
                    WHERE kpi_key = {placeholder}
                    ORDER BY periodo DESC
                    LIMIT {placeholder}
                """, (kpi_key, periodos))
            else:
                cursor.execute(f"""
                    SELECT periodo, kpi_key, valor
                    FROM control_tower_kpi_snapshot
                    ORDER BY periodo DESC
                    LIMIT {placeholder}
                """, (periodos,))

            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]

    except Exception as e:
        logger.error(f"Error obteniendo tendencias: {str(e)}", exc_info=True)
        return []


def snapshot_kpis() -> bool:
    """
    Toma snapshot de KPIs actuales (llamado por Celery).

    Returns:
        True si se completó exitosamente
    """
    try:
        kpis = obtener_kpis_agregados()
        periodo_actual = datetime.utcnow().strftime('%Y-%m-%d %H:00')
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            for kpi_key, valor in kpis.items():
                if is_using_postgresql():
                    cursor.execute(f"""
                        INSERT INTO control_tower_kpi_snapshot
                        (periodo, kpi_key, valor)
                        VALUES ({placeholder}, {placeholder}, {placeholder})
                        ON CONFLICT (periodo, kpi_key)
                        DO UPDATE SET valor = {placeholder}
                    """, (periodo_actual, kpi_key, valor, valor))
                else:
                    cursor.execute(f"""
                        INSERT OR REPLACE INTO control_tower_kpi_snapshot
                        (periodo, kpi_key, valor)
                        VALUES ({placeholder}, {placeholder}, {placeholder})
                    """, (periodo_actual, kpi_key, valor))

            logger.info(f"Snapshot de KPIs completado para período {periodo_actual}")
            return True

    except Exception as e:
        logger.error(f"Error tomando snapshot de KPIs: {str(e)}", exc_info=True)
        return False


def actualizar_alertas_agregadas() -> bool:
    """
    Actualiza alertas agregadas basadas en condiciones de negocio (llamado por Celery).

    Returns:
        True si se completó exitosamente
    """
    try:
        placeholder = '%s' if is_using_postgresql() else '?'
        alertas_creadas = 0

        with get_db_transaction() as (conn, cursor):
            # 1. SLA Breaches (solicitudes > 72 horas)
            try:
                fecha_limite = datetime.utcnow() - timedelta(hours=72)
                cursor.execute(f"""
                    SELECT id, material_codigo, centro_id
                    FROM solicitud
                    WHERE status = 'submitted'
                    AND created_at < {placeholder}
                """, (fecha_limite,))

                for row in cursor.fetchall():
                    sol_id, material, centro = row
                    _upsert_alerta(
                        cursor,
                        tipo='sla_breach',
                        titulo=f'SLA vencido - Solicitud {sol_id}',
                        descripcion=f'Solicitud {sol_id} lleva más de 72h sin aprobar',
                        severidad='high',
                        prioridad=8,
                        entidad_tipo='solicitud',
                        entidad_id=sol_id,
                        metadata={'material': material, 'centro_id': centro}
                    )
                    alertas_creadas += 1
            except Exception as e:
                logger.debug(f"Error verificando SLA breaches: {e}")

            # 2. Stock crítico (< 30% punto de pedido)
            try:
                cursor.execute("""
                    SELECT s.material_codigo, s.stock_disponible, m.punto_pedido
                    FROM stock s
                    LEFT JOIN materiales_bbdd m ON s.material_codigo = m.codigo_sap
                    WHERE m.punto_pedido IS NOT NULL
                    AND s.stock_disponible < (m.punto_pedido * 0.3)
                """)

                for row in cursor.fetchall():
                    material, stock, rop = row
                    _upsert_alerta(
                        cursor,
                        tipo='stock_critical',
                        titulo=f'Stock crítico - {material}',
                        descripcion=f'Stock ({stock}) por debajo del 30% del punto de pedido ({rop})',
                        severidad='critical',
                        prioridad=9,
                        entidad_tipo='material',
                        entidad_id=0,
                        metadata={'material_codigo': material, 'stock': stock, 'rop': rop}
                    )
                    alertas_creadas += 1
            except Exception as e:
                logger.debug(f"Error verificando stock crítico: {e}")

            # 3. Quality Issues (NCRs activos)
            try:
                cursor.execute("""
                    SELECT COUNT(*), proveedor_cuit
                    FROM ncr
                    WHERE estado IN ('open', 'in_progress')
                    GROUP BY proveedor_cuit
                    HAVING COUNT(*) > 2
                """)

                for row in cursor.fetchall():
                    count, cuit = row
                    _upsert_alerta(
                        cursor,
                        tipo='quality_issue',
                        titulo=f'Problemas de calidad - Proveedor {cuit}',
                        descripcion=f'Proveedor tiene {count} NCRs activos',
                        severidad='medium',
                        prioridad=6,
                        entidad_tipo='proveedor',
                        entidad_id=0,
                        metadata={'proveedor_cuit': cuit, 'ncr_count': count}
                    )
                    alertas_creadas += 1
            except Exception as e:
                logger.debug(f"Tabla NCR no disponible: {e}")

            # 4. Supplier Risk (high risk)
            try:
                cursor.execute("""
                    SELECT proveedor_cuit, overall_score
                    FROM proveedor_riesgo
                    WHERE overall_score > 70
                """)

                for row in cursor.fetchall():
                    cuit, score = row
                    _upsert_alerta(
                        cursor,
                        tipo='supplier_risk',
                        titulo=f'Riesgo alto - Proveedor {cuit}',
                        descripcion=f'Proveedor con score de riesgo {score}',
                        severidad='high',
                        prioridad=7,
                        entidad_tipo='proveedor',
                        entidad_id=0,
                        metadata={'proveedor_cuit': cuit, 'risk_score': score}
                    )
                    alertas_creadas += 1
            except Exception as e:
                logger.debug(f"Tabla proveedor_riesgo no disponible: {e}")

            logger.info(f"Actualización de alertas completada: {alertas_creadas} alertas procesadas")
            return True

    except Exception as e:
        logger.error(f"Error actualizando alertas agregadas: {str(e)}", exc_info=True)
        return False


def _upsert_alerta(cursor, tipo, titulo, descripcion, severidad, prioridad,
                   entidad_tipo, entidad_id, metadata):
    """Helper para insertar o actualizar alerta."""
    placeholder = '%s' if is_using_postgresql() else '?'

    if is_using_postgresql():
        cursor.execute(f"""
            INSERT INTO control_tower_alerta_agregada
            (tipo, titulo, descripcion, severidad, prioridad, estado,
             entidad_tipo, entidad_id, metadata, fecha_creacion, fecha_actualizacion)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder},
                    {placeholder}, 'active', {placeholder}, {placeholder},
                    {placeholder}, {placeholder}, {placeholder})
            ON CONFLICT (tipo, entidad_tipo, entidad_id)
            DO UPDATE SET
                titulo = {placeholder},
                descripcion = {placeholder},
                severidad = {placeholder},
                prioridad = {placeholder},
                fecha_actualizacion = {placeholder}
        """, (
            tipo, titulo, descripcion, severidad, prioridad,
            entidad_tipo, entidad_id, str(metadata),
            datetime.utcnow(), datetime.utcnow(),
            titulo, descripcion, severidad, prioridad, datetime.utcnow()
        ))
    else:
        # SQLite: check if exists first
        cursor.execute(f"""
            SELECT id FROM control_tower_alerta_agregada
            WHERE tipo = {placeholder}
            AND entidad_tipo = {placeholder}
            AND entidad_id = {placeholder}
        """, (tipo, entidad_tipo, entidad_id))

        existing = cursor.fetchone()

        if existing:
            cursor.execute(f"""
                UPDATE control_tower_alerta_agregada
                SET titulo = {placeholder},
                    descripcion = {placeholder},
                    severidad = {placeholder},
                    prioridad = {placeholder},
                    fecha_actualizacion = {placeholder}
                WHERE id = {placeholder}
            """, (titulo, descripcion, severidad, prioridad,
                  datetime.utcnow(), existing[0]))
        else:
            cursor.execute(f"""
                INSERT INTO control_tower_alerta_agregada
                (tipo, titulo, descripcion, severidad, prioridad, estado,
                 entidad_tipo, entidad_id, metadata, fecha_creacion, fecha_actualizacion)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, 'active', {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder})
            """, (
                tipo, titulo, descripcion, severidad, prioridad,
                entidad_tipo, entidad_id, str(metadata),
                datetime.utcnow(), datetime.utcnow()
            ))
