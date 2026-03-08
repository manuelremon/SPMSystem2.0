"""
Servicio de Supply Chain Control Tower.
Agrega eventos, KPIs y alertas de toda la cadena de suministro.

Esquema real (migración 064):
- control_tower_event: id, evento_tipo, entidad_tipo, entidad_id, severidad(info/warning/critical/success),
    titulo, descripcion, centro_id, proveedor_cuit, categoria(procurement/logistics/quality/planning/finance),
    metadata, leido, created_at
- control_tower_alerta_agregada: id, tipo(sla_breach/stock_critical/quality_issue/supplier_risk),
    prioridad(baja/media/alta/critica), cantidad, titulo, entidades, categoria,
    ultima_ocurrencia, estado(active/acknowledged/resolved), created_at
- control_tower_kpi_snapshot: id, periodo, kpi_key, valor, categoria, created_at
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

logger = logging.getLogger(__name__)

# Mapeo de severidad del servicio a valores válidos en la BD
_SEVERIDAD_MAP = {
    'info': 'info',
    'low': 'info',
    'medium': 'warning',
    'warning': 'warning',
    'high': 'critical',
    'error': 'critical',
    'critical': 'critical',
    'success': 'success',
}

# Mapeo de prioridad numérica a texto válido en la BD
_PRIORIDAD_MAP = {
    range(0, 4): 'baja',
    range(4, 6): 'media',
    range(6, 8): 'alta',
    range(8, 11): 'critica',
}


def _map_severidad(sev: str) -> str:
    return _SEVERIDAD_MAP.get(sev, 'info')


def _map_prioridad_num(num: int) -> str:
    for rng, label in _PRIORIDAD_MAP.items():
        if num in rng:
            return label
    return 'media'


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
    """Registra un evento en el Control Tower."""
    try:
        placeholder = '%s' if is_using_postgresql() else '?'
        sev = _map_severidad(severidad)

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                INSERT INTO control_tower_event
                (evento_tipo, entidad_tipo, entidad_id, severidad, titulo, descripcion,
                 centro_id, proveedor_cuit, categoria, metadata, created_at)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder}, {placeholder},
                        {placeholder}, {placeholder}, {placeholder})
            """, (
                evento_tipo, entidad_tipo, entidad_id, sev, titulo, descripcion,
                centro_id, proveedor_cuit, categoria,
                json.dumps(metadata) if metadata else None,
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
    """Obtiene eventos del timeline con paginación y filtros."""
    page = filtros.get('page', 1)
    per_page = filtros.get('per_page', 50)

    try:
        placeholder = '%s' if is_using_postgresql() else '?'
        offset = (page - 1) * per_page

        conditions = []
        params = []

        if filtros.get('categoria'):
            conditions.append(f"categoria = {placeholder}")
            params.append(filtros['categoria'])

        if filtros.get('severidad'):
            sev = _map_severidad(filtros['severidad'])
            conditions.append(f"severidad = {placeholder}")
            params.append(sev)

        if filtros.get('fecha_desde'):
            conditions.append(f"created_at >= {placeholder}")
            params.append(filtros['fecha_desde'])

        if filtros.get('fecha_hasta'):
            conditions.append(f"created_at <= {placeholder}")
            params.append(filtros['fecha_hasta'])

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(f"""
                SELECT COUNT(*) FROM control_tower_event
                WHERE {where_clause}
            """, params)
            total = cursor.fetchone()[0]

            cursor.execute(f"""
                SELECT id, evento_tipo, entidad_tipo, entidad_id, severidad,
                       titulo, descripcion, centro_id, proveedor_cuit, categoria,
                       metadata, created_at
                FROM control_tower_event
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT {placeholder} OFFSET {placeholder}
            """, params + [per_page, offset])

            rows = cursor.fetchall()

            # Mapear a formato esperado por frontend
            events = []
            for row in rows:
                events.append({
                    'id': row['id'],
                    'fecha': str(row['created_at']) if row.get('created_at') else None,
                    'tipo': row.get('evento_tipo', ''),
                    'categoria': row.get('categoria', ''),
                    'severidad': row.get('severidad', ''),
                    'titulo': row.get('titulo', ''),
                    'entidad': f"{row.get('entidad_tipo', '')} #{row.get('entidad_id', '')}",
                    'descripcion': row.get('descripcion', ''),
                })

            return {
                'events': events,
                'total': total,
                'page': page,
                'per_page': per_page
            }

    except Exception as e:
        logger.error(f"Error obteniendo eventos timeline: {str(e)}", exc_info=True)
        return {'events': [], 'total': 0, 'page': page, 'per_page': per_page}


def obtener_kpis_agregados() -> Dict[str, Any]:
    """Obtiene KPIs agregados de toda la cadena de suministro."""
    kpis = {
        'solicitudes_pendientes': 0,
        'ocs_activas': 0,
        'envios_en_transito': 0,
        'inspecciones_pendientes': 0,
        'alertas_activas': 0,
        'sla_porcentaje': 0.0,
        'contratos_por_vencer': 0,
        'rfqs_abiertas': 0
    }

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Solicitudes pendientes
            try:
                cursor.execute("""
                    SELECT COUNT(*) FROM solicitudes
                    WHERE status IN ('submitted', 'approved')
                """)
                kpis['solicitudes_pendientes'] = cursor.fetchone()[0]
            except Exception as e:
                logger.debug(f"Error contando solicitudes: {e}")

            # Ordenes de compra activas
            try:
                cursor.execute("""
                    SELECT COUNT(*) FROM orden_compra
                    WHERE estado IN ('draft', 'approved', 'in_progress')
                """)
                kpis['ocs_activas'] = cursor.fetchone()[0]
            except Exception as e:
                logger.debug(f"Error contando ordenes: {e}")

            # Envios en transito (tabla envio puede no existir)
            try:
                cursor.execute("""
                    SELECT COUNT(*) FROM envio
                    WHERE estado = 'in_transit'
                """)
                kpis['envios_en_transito'] = cursor.fetchone()[0]
            except Exception:
                # Intentar con ordenes de compra en estado enviado
                try:
                    cursor.execute("""
                        SELECT COUNT(*) FROM orden_compra
                        WHERE estado = 'shipped'
                    """)
                    kpis['envios_en_transito'] = cursor.fetchone()[0]
                except Exception as e:
                    logger.debug(f"No se pudo obtener envios en transito: {e}")

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

            # SLA cumplimiento: % solicitudes cerradas vs total (ultimos 30 dias)
            try:
                fecha_inicio = datetime.utcnow() - timedelta(days=30)
                placeholder = '%s' if is_using_postgresql() else '?'
                cursor.execute(f"""
                    SELECT
                        CASE WHEN COUNT(*) > 0
                            THEN COUNT(CASE WHEN status = 'closed' THEN 1 END) * 100.0 / COUNT(*)
                            ELSE 0
                        END
                    FROM solicitudes
                    WHERE created_at >= {placeholder}
                    AND status != 'draft'
                """, (fecha_inicio,))
                result = cursor.fetchone()[0]
                kpis['sla_porcentaje'] = round(float(result or 0.0), 1)
            except Exception as e:
                logger.debug(f"Error calculando SLA: {e}")

            # Contratos por vencer (proximos 30 dias)
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
                kpis['rfqs_abiertas'] = cursor.fetchone()[0]
            except Exception as e:
                logger.debug(f"Tabla rfq no disponible: {e}")

            return kpis

    except Exception as e:
        logger.error(f"Error obteniendo KPIs agregados: {str(e)}", exc_info=True)
        return kpis


def obtener_alertas_agregadas(filtros: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Obtiene alertas agregadas con filtros opcionales."""
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
                SELECT id, tipo, prioridad, cantidad, titulo, entidades,
                       categoria, ultima_ocurrencia, estado, created_at
                FROM control_tower_alerta_agregada
                WHERE {where_clause}
                ORDER BY
                    CASE estado
                        WHEN 'active' THEN 0
                        WHEN 'acknowledged' THEN 1
                        WHEN 'resolved' THEN 2
                    END,
                    CASE prioridad
                        WHEN 'critica' THEN 0
                        WHEN 'alta' THEN 1
                        WHEN 'media' THEN 2
                        WHEN 'baja' THEN 3
                    END,
                    created_at DESC
            """, params)

            rows = cursor.fetchall()

            # Mapear a formato esperado por frontend
            alerts = []
            for row in rows:
                alerts.append({
                    'id': row['id'],
                    'tipo': row.get('tipo', ''),
                    'prioridad': row.get('prioridad', ''),
                    'cantidad': row.get('cantidad', 0),
                    'titulo': row.get('titulo', ''),
                    'estado': row.get('estado', 'active'),
                    'categoria': row.get('categoria', ''),
                    'entidades': row.get('entidades', ''),
                    'ultima_ocurrencia': str(row['ultima_ocurrencia']) if row.get('ultima_ocurrencia') else None,
                    'created_at': str(row['created_at']) if row.get('created_at') else None,
                })

            return alerts

    except Exception as e:
        logger.error(f"Error obteniendo alertas agregadas: {str(e)}", exc_info=True)
        return []


def marcar_alerta(alerta_id: int, nuevo_estado: str) -> Dict[str, Any]:
    """Marca una alerta con un nuevo estado."""
    try:
        placeholder = '%s' if is_using_postgresql() else '?'

        with get_db_transaction() as (conn, cursor):
            cursor.execute(f"""
                UPDATE control_tower_alerta_agregada
                SET estado = {placeholder},
                    ultima_ocurrencia = {placeholder}
                WHERE id = {placeholder}
            """, (nuevo_estado, datetime.utcnow(), alerta_id))

            if cursor.rowcount == 0:
                return {'ok': False, 'error': 'Alerta no encontrada'}

            logger.info(f"Alerta {alerta_id} marcada como {nuevo_estado}")
            return {'ok': True}

    except Exception as e:
        logger.error(f"Error marcando alerta {alerta_id}: {str(e)}", exc_info=True)
        return {'ok': False, 'error': 'Error interno'}


def obtener_tendencias(kpi_key: Optional[str] = None, periodos: int = 12) -> Dict[str, Any]:
    """
    Obtiene tendencias de KPIs historicos.
    Agrupa por kpi_key y devuelve valor_actual, variacion y sparkline.
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
                """, (periodos * 10,))

            rows = cursor.fetchall()

        # Agrupar por kpi_key
        kpi_groups: Dict[str, List] = {}
        for row in rows:
            key = row['kpi_key']
            if key not in kpi_groups:
                kpi_groups[key] = []
            kpi_groups[key].append(row)

        # Construir trends para frontend
        _KPI_LABELS = {
            'solicitudes_pendientes': 'Solicitudes Pendientes',
            'ocs_activas': 'OCs Activas',
            'ordenes_compra_activas': 'OCs Activas',
            'envios_en_transito': 'Envios en Transito',
            'inspecciones_pendientes': 'Inspecciones Pendientes',
            'alertas_activas': 'Alertas Activas',
            'sla_porcentaje': 'Cumplimiento SLA %',
            'sla_cumplimiento': 'Cumplimiento SLA %',
            'contratos_por_vencer': 'Contratos por Vencer',
            'rfqs_abiertas': 'RFQs Abiertas',
            'rfq_abiertas': 'RFQs Abiertas',
            'otif_pct': 'OTIF %',
            'lead_time_avg': 'Tiempo de Entrega Promedio',
            'quality_defect_rate': 'Tasa de Defectos %',
            'stock_turnover': 'Rotacion de Inventario',
            'cost_savings_pct': 'Ahorro de Costos %',
            'supplier_risk_score': 'Score Riesgo Proveedor',
        }

        trends = []
        for key, snapshots in kpi_groups.items():
            # Ordenar por periodo ascendente para sparkline
            snapshots.sort(key=lambda x: x['periodo'])
            valores = [float(s['valor'] or 0) for s in snapshots]

            valor_actual = valores[-1] if valores else 0
            if len(valores) >= 2 and valores[-2] != 0:
                variacion = ((valores[-1] - valores[-2]) / abs(valores[-2])) * 100
            else:
                variacion = 0

            trends.append({
                'id': key,
                'nombre': _KPI_LABELS.get(key, key.replace('_', ' ').title()),
                'valor_actual': round(valor_actual, 1),
                'variacion': round(variacion, 1),
                'sparkline': valores[-periodos:],
                'periodo': snapshots[-1]['periodo'] if snapshots else '',
            })

        return {'trends': trends}

    except Exception as e:
        logger.error(f"Error obteniendo tendencias: {str(e)}", exc_info=True)
        return {'trends': []}


def snapshot_kpis() -> bool:
    """Toma snapshot de KPIs actuales (llamado por Celery)."""
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

            logger.info(f"Snapshot de KPIs completado para periodo {periodo_actual}")
            return True

    except Exception as e:
        logger.error(f"Error tomando snapshot de KPIs: {str(e)}", exc_info=True)
        return False


def actualizar_alertas_agregadas() -> bool:
    """Actualiza alertas agregadas basadas en condiciones de negocio (llamado por Celery)."""
    try:
        placeholder = '%s' if is_using_postgresql() else '?'
        alertas_creadas = 0

        with get_db_transaction() as (conn, cursor):
            # 1. SLA Breaches (solicitudes > 72 horas)
            try:
                fecha_limite = datetime.utcnow() - timedelta(hours=72)
                cursor.execute(f"""
                    SELECT COUNT(*) FROM solicitudes
                    WHERE status = 'submitted'
                    AND created_at < {placeholder}
                """, (fecha_limite,))
                count = cursor.fetchone()[0]
                if count > 0:
                    _upsert_alerta(
                        cursor,
                        tipo='sla_breach',
                        prioridad='critica',
                        cantidad=count,
                        titulo=f'{count} solicitudes con SLA vencido (>72h)',
                        entidades=None,
                        categoria='procurement',
                    )
                    alertas_creadas += 1
            except Exception as e:
                logger.debug(f"Error verificando SLA breaches: {e}")

            # 2. Stock critico (materiales con stock = 0 marcados como criticos)
            try:
                cursor.execute("""
                    SELECT COUNT(*)
                    FROM sap_stock
                    WHERE critico = 'SI'
                    AND (stock <= 0 OR stock IS NULL)
                """)
                count = cursor.fetchone()[0]
                if count > 0:
                    _upsert_alerta(
                        cursor,
                        tipo='stock_critical',
                        prioridad='alta',
                        cantidad=count,
                        titulo=f'{count} materiales criticos sin stock',
                        entidades=None,
                        categoria='planning',
                    )
                    alertas_creadas += 1
            except Exception as e:
                logger.debug(f"Error verificando stock critico: {e}")

            # 3. Quality Issues (NCRs activos)
            try:
                cursor.execute("""
                    SELECT COUNT(*) FROM ncr
                    WHERE estado IN ('open', 'in_progress')
                """)
                count = cursor.fetchone()[0]
                if count > 0:
                    _upsert_alerta(
                        cursor,
                        tipo='quality_issue',
                        prioridad='media',
                        cantidad=count,
                        titulo=f'{count} NCRs activos',
                        entidades=None,
                        categoria='quality',
                    )
                    alertas_creadas += 1
            except Exception as e:
                logger.debug(f"Tabla NCR no disponible: {e}")

            # 4. Supplier Risk (high risk)
            try:
                cursor.execute("""
                    SELECT COUNT(*) FROM proveedor_riesgo
                    WHERE overall_score > 70
                """)
                count = cursor.fetchone()[0]
                if count > 0:
                    _upsert_alerta(
                        cursor,
                        tipo='supplier_risk',
                        prioridad='alta',
                        cantidad=count,
                        titulo=f'{count} proveedores con riesgo alto',
                        entidades=None,
                        categoria='procurement',
                    )
                    alertas_creadas += 1
            except Exception as e:
                logger.debug(f"Tabla proveedor_riesgo no disponible: {e}")

            logger.info(f"Actualizacion de alertas completada: {alertas_creadas} alertas procesadas")
            return True

    except Exception as e:
        logger.error(f"Error actualizando alertas agregadas: {str(e)}", exc_info=True)
        return False


def _upsert_alerta(cursor, tipo, prioridad, cantidad, titulo, entidades, categoria):
    """Helper para insertar o actualizar alerta agregada (SELECT+UPDATE/INSERT pattern)."""
    placeholder = '%s' if is_using_postgresql() else '?'
    now = datetime.utcnow()

    # Buscar alerta existente no resuelta del mismo tipo
    cursor.execute(f"""
        SELECT id FROM control_tower_alerta_agregada
        WHERE tipo = {placeholder} AND estado != 'resolved'
        LIMIT 1
    """, (tipo,))

    existing = cursor.fetchone()

    if existing:
        cursor.execute(f"""
            UPDATE control_tower_alerta_agregada
            SET prioridad = {placeholder},
                cantidad = {placeholder},
                titulo = {placeholder},
                entidades = {placeholder},
                categoria = {placeholder},
                ultima_ocurrencia = {placeholder}
            WHERE id = {placeholder}
        """, (prioridad, cantidad, titulo, entidades, categoria, now, existing[0]))
    else:
        cursor.execute(f"""
            INSERT INTO control_tower_alerta_agregada
            (tipo, prioridad, cantidad, titulo, entidades, categoria,
             ultima_ocurrencia, estado, created_at)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder},
                    {placeholder}, {placeholder}, {placeholder}, 'active', {placeholder})
        """, (tipo, prioridad, cantidad, titulo, entidades, categoria, now, now))
