"""
Executive Analytics Service
Servicio para dashboard ejecutivo de procurement
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection, get_db_transaction

logger = logging.getLogger(__name__)


def _safe_json(value, default=None):
    """Parse JSON de forma segura; si falla, devuelve el texto como lista/dict o el default."""
    if not value:
        return default if default is not None else []
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        # Si es texto plano, devolver como lista de un elemento o como string
        if isinstance(default, list):
            return [str(value)]
        if isinstance(default, dict):
            return {'raw': str(value)}
        return str(value)


def obtener_kpis_configurados() -> List[Dict[str, Any]]:
    """Obtiene KPIs configurados activos"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT id, categoria, kpi_key, nombre, descripcion, unidad,
                   formula, target_value, warning_threshold, critical_threshold, activo
            FROM executive_kpi
            WHERE activo = 1
            ORDER BY categoria, nombre
        """)

        kpis = []
        for row in cursor.fetchall():
            kpis.append({
                'id': row['id'],
                'categoria': row['categoria'],
                'kpi_key': row['kpi_key'],
                'nombre': row['nombre'],
                'descripcion': row['descripcion'],
                'unidad': row['unidad'],
                'formula': row['formula'],
                'target_value': row['target_value'],
                'warning_threshold': row['warning_threshold'],
                'critical_threshold': row['critical_threshold'],
                'activo': row['activo']
            })

        return kpis
    finally:
        conn.close()


def crear_kpi(data: Dict[str, Any]) -> int:
    """Crea un nuevo KPI ejecutivo"""
    with get_db_transaction() as (conn, cursor):
        cursor.execute("""
            INSERT INTO executive_kpi (
                categoria, kpi_key, nombre, descripcion, unidad,
                formula, target_value, warning_threshold, critical_threshold
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        """, (
            data['categoria'],
            data['kpi_key'],
            data['nombre'],
            data.get('descripcion'),
            data.get('unidad'),
            data.get('formula'),
            data.get('target_value'),
            data.get('warning_threshold'),
            data.get('critical_threshold')
        ))

        kpi_id = cursor.fetchone()[0]
        conn.commit()
        return kpi_id


def actualizar_kpi(kpi_id: int, data: Dict[str, Any]) -> bool:
    """Actualiza configuracion de KPI"""
    with get_db_transaction() as (conn, cursor):
        cursor.execute("""
            UPDATE executive_kpi
            SET target_value = ?, warning_threshold = ?, critical_threshold = ?, activo = ?
            WHERE id = ?
        """, (
            data.get('target_value'),
            data.get('warning_threshold'),
            data.get('critical_threshold'),
            1 if data.get('activo', True) else 0,
            kpi_id
        ))

        conn.commit()
        return True


def calcular_kpis_actuales() -> Dict[str, Any]:
    """Calcula valores actuales de todos los KPIs ejecutivos"""
    kpis_valores = {}

    # Total Spend
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COALESCE(SUM(total), 0)
            FROM orden_compra
            WHERE TO_CHAR(fecha_emision, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
        """)
        kpis_valores['total_spend'] = cursor.fetchone()[0]
        conn.close()
    except Exception:
        kpis_valores['total_spend'] = 0

    # Savings Rate
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COALESCE(SUM(ahorro_real), 0), COALESCE(SUM(baseline_cost), 1)
            FROM ahorro_costo
            WHERE TO_CHAR(fecha, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
        """)
        row = cursor.fetchone()
        savings = row[0]
        baseline = row[1] if row[1] > 0 else 1
        kpis_valores['savings_rate'] = (savings / baseline) * 100
        conn.close()
    except Exception:
        kpis_valores['savings_rate'] = 0

    # On-Time Delivery Rate
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN fecha_recepcion_real <= fecha_entrega_prometida THEN 1 ELSE 0 END) as on_time
            FROM recepcion_dock
            WHERE TO_CHAR(fecha_recepcion_real, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
        """)
        row = cursor.fetchone()
        total = row[0] if row[0] else 1
        on_time = row[1] if row[1] else 0
        kpis_valores['on_time_delivery'] = (on_time / total) * 100
        conn.close()
    except Exception:
        kpis_valores['on_time_delivery'] = 0

    # Quality Rate (Inspection Pass Rate)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN resultado_final = 'approved' THEN 1 ELSE 0 END) as approved
            FROM inspeccion_entrada
            WHERE TO_CHAR(fecha_inspeccion, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
        """)
        row = cursor.fetchone()
        total = row[0] if row[0] else 1
        approved = row[1] if row[1] else 0
        kpis_valores['quality_rate'] = (approved / total) * 100
        conn.close()
    except Exception:
        kpis_valores['quality_rate'] = 0

    # Inventory Turns (annual rate)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COALESCE(SUM(costo), 0) FROM orden_compra
            WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months'
        """)
        annual_cogs = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COALESCE(SUM(cantidad * precio_unit), 0)
            FROM stock
        """)
        avg_inventory = cursor.fetchone()[0]

        kpis_valores['inventory_turns'] = annual_cogs / avg_inventory if avg_inventory > 0 else 0
        conn.close()
    except Exception:
        kpis_valores['inventory_turns'] = 0

    # Supplier Risk Score (promedio ponderado)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT AVG(score_riesgo)
            FROM proveedor_riesgo
        """)
        row = cursor.fetchone()
        kpis_valores['supplier_risk_avg'] = row[0] if row[0] else 0
        conn.close()
    except Exception:
        kpis_valores['supplier_risk_avg'] = 0

    # Sustainability Score (promedio ESG)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT AVG(score_total)
            FROM proveedor_esg_score
            WHERE periodo = TO_CHAR(NOW(), 'YYYY-MM')
        """)
        row = cursor.fetchone()
        kpis_valores['sustainability_score'] = row[0] if row[0] else 0
        conn.close()
    except Exception:
        kpis_valores['sustainability_score'] = 0

    # Days Payable Outstanding (DPO)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT AVG(EXTRACT(EPOCH FROM (fecha_pago::timestamp - fecha_factura::timestamp)) / 86400)
            FROM factura_proveedor
            WHERE estado = 'paid'
            AND fecha_pago >= CURRENT_DATE - INTERVAL '30 days'
        """)
        row = cursor.fetchone()
        kpis_valores['dpo'] = row[0] if row[0] else 0
        conn.close()
    except Exception:
        kpis_valores['dpo'] = 0

    # Contract Compliance Rate
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN estado = 'compliant' THEN 1 ELSE 0 END) as compliant
            FROM compliance_check
            WHERE TO_CHAR(fecha_check, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
        """)
        row = cursor.fetchone()
        total = row[0] if row[0] else 1
        compliant = row[1] if row[1] else 0
        kpis_valores['contract_compliance'] = (compliant / total) * 100
        conn.close()
    except Exception:
        kpis_valores['contract_compliance'] = 0

    # Fill Rate (order fulfillment)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                SUM(cantidad_solicitada) as requested,
                SUM(cantidad_entregada) as delivered
            FROM (
                SELECT s.cantidad as cantidad_solicitada, COALESCE(r.cantidad, 0) as cantidad_entregada
                FROM solicitud_item s
                LEFT JOIN recepcion_dock r ON s.solicitud_id = r.solicitud_id
                WHERE s.created_at >= CURRENT_DATE - INTERVAL '30 days'
            ) sub
        """)
        row = cursor.fetchone()
        requested = row[0] if row[0] else 1
        delivered = row[1] if row[1] else 0
        kpis_valores['fill_rate'] = (delivered / requested) * 100
        conn.close()
    except Exception:
        kpis_valores['fill_rate'] = 0

    return kpis_valores


def snapshot_kpis_mensual() -> None:
    """Tarea Celery: captura snapshot mensual de KPIs"""
    periodo = datetime.now().strftime('%Y-%m')
    kpis_valores = calcular_kpis_actuales()

    with get_db_transaction() as (conn, cursor):
        # Obtener valores del mes anterior para calcular variacion
        periodo_anterior = (datetime.now().replace(day=1) - timedelta(days=1)).strftime('%Y-%m')

        for kpi_key, valor in kpis_valores.items():
            # Calcular variacion
            cursor.execute("""
                SELECT valor FROM executive_snapshot
                WHERE kpi_key = ? AND periodo = ?
            """, (kpi_key, periodo_anterior))

            row = cursor.fetchone()
            valor_anterior = row[0] if row else valor
            variacion_pct = ((valor - valor_anterior) / valor_anterior * 100) if valor_anterior != 0 else 0

            # Determinar trend
            if variacion_pct > 2:
                trend = 'up'
            elif variacion_pct < -2:
                trend = 'down'
            else:
                trend = 'stable'

            # Insertar snapshot (upsert)
            cursor.execute("""
                INSERT INTO executive_snapshot
                (kpi_key, periodo, valor, variacion_pct, trend, detalles)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (kpi_key, periodo) DO UPDATE SET
                    valor = EXCLUDED.valor,
                    variacion_pct = EXCLUDED.variacion_pct,
                    trend = EXCLUDED.trend,
                    detalles = EXCLUDED.detalles
            """, (kpi_key, periodo, valor, variacion_pct, trend, json.dumps({})))

        conn.commit()


def obtener_dashboard() -> Dict[str, Any]:
    """Obtiene datos completos del dashboard ejecutivo"""
    kpis_config = obtener_kpis_configurados()
    kpis_valores = calcular_kpis_actuales()

    # Obtener benchmarks
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        dashboard = []

        for kpi in kpis_config:
            kpi_key = kpi['kpi_key']
            valor_actual = kpis_valores.get(kpi_key, 0)

            # Obtener ultimo snapshot para trend y valor fallback
            cursor.execute("""
                SELECT valor, variacion_pct, trend
                FROM executive_snapshot
                WHERE kpi_key = ?
                ORDER BY periodo DESC
                LIMIT 1
            """, (kpi_key,))

            snapshot = cursor.fetchone()
            snapshot_valor = snapshot['valor'] if snapshot else None
            variacion = snapshot['variacion_pct'] if snapshot else 0
            trend = snapshot['trend'] if snapshot else 'stable'

            # Usar valor del snapshot si calcular_kpis_actuales no tiene este kpi_key
            if (valor_actual == 0 or valor_actual is None) and snapshot_valor is not None:
                valor_actual = snapshot_valor

            # Obtener benchmark
            cursor.execute("""
                SELECT mediana, percentil_25, percentil_75, industria, region
                FROM benchmark
                WHERE kpi_key = ?
                ORDER BY created_at DESC
                LIMIT 1
            """, (kpi_key,))

            benchmark_row = cursor.fetchone()
            benchmark = None
            if benchmark_row:
                benchmark = {
                    'mediana': benchmark_row['mediana'],
                    'percentil_25': benchmark_row['percentil_25'],
                    'percentil_75': benchmark_row['percentil_75'],
                    'industria': benchmark_row['industria'],
                    'region': benchmark_row['region']
                }

            # Determinar estado basado en thresholds
            estado = 'normal'
            if kpi['critical_threshold'] is not None and valor_actual < kpi['critical_threshold']:
                estado = 'critical'
            elif kpi['warning_threshold'] is not None and valor_actual < kpi['warning_threshold']:
                estado = 'warning'
            elif kpi['target_value'] is not None and valor_actual >= kpi['target_value']:
                estado = 'excellent'

            dashboard.append({
                **kpi,
                'valor_actual': valor_actual,
                'variacion_pct': variacion,
                'trend': trend,
                'benchmark': benchmark,
                'estado': estado
            })

        return {
            'kpis': dashboard,
            'periodo': datetime.now().strftime('%Y-%m'),
            'ultima_actualizacion': datetime.now().isoformat()
        }
    finally:
        conn.close()


def obtener_tendencias(kpi_key: str, meses: int = 12) -> List[Dict[str, Any]]:
    """Obtiene tendencia historica de un KPI"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT periodo, valor, variacion_pct, trend, detalles
            FROM executive_snapshot
            WHERE kpi_key = ?
            ORDER BY periodo DESC
            LIMIT ?
        """, (kpi_key, meses))

        tendencias = []
        for row in cursor.fetchall():
            tendencias.append({
                'periodo': row[0],
                'valor': row[1],
                'variacion_pct': row[2],
                'trend': row[3],
                'detalles': _safe_json(row[4], {})
            })

        return list(reversed(tendencias))  # Orden cronologico
    finally:
        conn.close()


def crear_benchmark(data: Dict[str, Any]) -> int:
    """Crea un benchmark de industria"""
    with get_db_transaction() as (conn, cursor):
        cursor.execute("""
            INSERT INTO benchmark (
                kpi_key, industria, region, percentil_25, mediana,
                percentil_75, fuente, periodo_dato
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        """, (
            data['kpi_key'],
            data['industria'],
            data['region'],
            data['percentil_25'],
            data['mediana'],
            data['percentil_75'],
            data.get('fuente'),
            data.get('periodo_dato')
        ))

        benchmark_id = cursor.fetchone()[0]
        conn.commit()
        return benchmark_id


def obtener_benchmarks(kpi_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """Obtiene benchmarks disponibles"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if kpi_key:
            cursor.execute("""
                SELECT id, kpi_key, industria, region, percentil_25, mediana,
                       percentil_75, fuente, periodo_dato, created_at
                FROM benchmark
                WHERE kpi_key = ?
                ORDER BY created_at DESC
            """, (kpi_key,))
        else:
            cursor.execute("""
                SELECT id, kpi_key, industria, region, percentil_25, mediana,
                       percentil_75, fuente, periodo_dato, created_at
                FROM benchmark
                ORDER BY kpi_key, created_at DESC
            """)

        benchmarks = []
        for row in cursor.fetchall():
            benchmarks.append({
                'id': row[0],
                'kpi_key': row[1],
                'industria': row[2],
                'region': row[3],
                'percentil_25': row[4],
                'mediana': row[5],
                'percentil_75': row[6],
                'fuente': row[7],
                'periodo_dato': row[8],
                'created_at': row[9]
            })

        return benchmarks
    finally:
        conn.close()


def generar_scorecard(usuario_id: int, categorias: Optional[List[str]] = None) -> int:
    """Genera un scorecard de procurement evaluando todas las categorias"""
    if categorias is None:
        categorias = ['procurement', 'sourcing', 'quality', 'logistics', 'finance', 'sustainability']

    dashboard_data = obtener_dashboard()
    kpis = dashboard_data['kpis']

    # Filtrar por categorias solicitadas
    kpis_evaluados = [k for k in kpis if k['categoria'] in categorias]

    # Calcular score total (promedio de cumplimiento de targets)
    scores = []
    for kpi in kpis_evaluados:
        if kpi['target_value'] is not None and kpi['target_value'] > 0:
            score = min(100, (kpi['valor_actual'] / kpi['target_value']) * 100)
            scores.append(score)

    score_total = sum(scores) / len(scores) if scores else 0

    # Identificar fortalezas (KPIs sobre target)
    fortalezas = []
    for kpi in kpis_evaluados:
        if kpi['estado'] == 'excellent':
            fortalezas.append(f"{kpi['nombre']}: {kpi['valor_actual']:.1f}{kpi['unidad']} (Target: {kpi['target_value']}{kpi['unidad']})")

    # Identificar debilidades (KPIs bajo warning)
    debilidades = []
    for kpi in kpis_evaluados:
        if kpi['estado'] in ['warning', 'critical']:
            debilidades.append(f"{kpi['nombre']}: {kpi['valor_actual']:.1f}{kpi['unidad']} (Target: {kpi['target_value']}{kpi['unidad']})")

    # Generar recomendaciones
    recomendaciones = []
    for kpi in kpis_evaluados:
        if kpi['estado'] == 'critical':
            recomendaciones.append(f"URGENTE: Mejorar {kpi['nombre']} - actualmente {kpi['valor_actual']:.1f}{kpi['unidad']}")
        elif kpi['estado'] == 'warning':
            recomendaciones.append(f"Atencion: {kpi['nombre']} requiere mejora - target {kpi['target_value']}{kpi['unidad']}")

    # Guardar scorecard
    with get_db_transaction() as (conn, cursor):
        periodo = datetime.now().strftime('%Y-%m')
        nombre = f"Procurement Scorecard {periodo}"

        cursor.execute("""
            INSERT INTO procurement_scorecard (
                nombre, periodo, categorias_evaluadas, score_total,
                fortalezas, debilidades, recomendaciones, generado_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        """, (
            nombre,
            periodo,
            json.dumps(categorias),
            score_total,
            json.dumps(fortalezas),
            json.dumps(debilidades),
            json.dumps(recomendaciones),
            usuario_id
        ))

        scorecard_id = cursor.fetchone()[0]
        conn.commit()
        return scorecard_id


def obtener_scorecards(limit: int = 10) -> List[Dict[str, Any]]:
    """Obtiene scorecards historicos"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT id, nombre, periodo, categorias_evaluadas, score_total,
                   fortalezas, debilidades, recomendaciones, generado_por, created_at
            FROM procurement_scorecard
            ORDER BY created_at DESC
            LIMIT ?
        """, (limit,))

        scorecards = []
        for row in cursor.fetchall():
            scorecards.append({
                'id': row[0],
                'nombre': row[1],
                'periodo': row[2],
                'categorias_evaluadas': _safe_json(row[3], []),
                'score_total': row[4],
                'fortalezas': _safe_json(row[5], []),
                'debilidades': _safe_json(row[6], []),
                'recomendaciones': _safe_json(row[7], []),
                'generado_por': row[8],
                'created_at': row[9]
            })

        return scorecards
    finally:
        conn.close()


def obtener_scorecard_detalle(scorecard_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene detalle de un scorecard especifico"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT id, nombre, periodo, categorias_evaluadas, score_total,
                   fortalezas, debilidades, recomendaciones, generado_por, created_at
            FROM procurement_scorecard
            WHERE id = ?
        """, (scorecard_id,))

        row = cursor.fetchone()
        if not row:
            return None

        return {
            'id': row[0],
            'nombre': row[1],
            'periodo': row[2],
            'categorias_evaluadas': _safe_json(row[3], []),
            'score_total': row[4],
            'fortalezas': _safe_json(row[5], []),
            'debilidades': _safe_json(row[6], []),
            'recomendaciones': _safe_json(row[7], []),
            'generado_por': row[8],
            'created_at': row[9]
        }
    finally:
        conn.close()
