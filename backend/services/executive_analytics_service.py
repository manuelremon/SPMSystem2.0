"""
Executive Analytics Service
Servicio para dashboard ejecutivo de procurement
"""
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.core.db import get_db_connection


def obtener_kpis_configurados() -> List[Dict[str, Any]]:
    """Obtiene KPIs configurados activos"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, categoria, kpi_key, nombre, descripcion, unidad,
               formula, target_value, warning_threshold, critical_threshold, activo
        FROM executive_kpi
        WHERE activo = TRUE
        ORDER BY categoria, nombre
    """)

    kpis = []
    for row in cursor.fetchall():
        kpis.append({
            'id': row[0],
            'categoria': row[1],
            'kpi_key': row[2],
            'nombre': row[3],
            'descripcion': row[4],
            'unidad': row[5],
            'formula': row[6],
            'target_value': row[7],
            'warning_threshold': row[8],
            'critical_threshold': row[9],
            'activo': row[10]
        })

    conn.close()
    return kpis


def crear_kpi(data: Dict[str, Any]) -> int:
    """Crea un nuevo KPI ejecutivo"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO executive_kpi (
            categoria, kpi_key, nombre, descripcion, unidad,
            formula, target_value, warning_threshold, critical_threshold
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    kpi_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return kpi_id


def actualizar_kpi(kpi_id: int, data: Dict[str, Any]) -> bool:
    """Actualiza configuración de KPI"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE executive_kpi
        SET target_value = ?, warning_threshold = ?, critical_threshold = ?, activo = ?
        WHERE id = ?
    """, (
        data.get('target_value'),
        data.get('warning_threshold'),
        data.get('critical_threshold'),
        bool(data.get('activo', True)),
        kpi_id
    ))

    conn.commit()
    conn.close()

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
            WHERE strftime('%Y-%m', fecha_emision) = strftime('%Y-%m', 'now')
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
            WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now')
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
            WHERE strftime('%Y-%m', fecha_recepcion_real) = strftime('%Y-%m', 'now')
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
            WHERE strftime('%Y-%m', fecha_inspeccion) = strftime('%Y-%m', 'now')
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
            WHERE fecha_emision >= date('now', '-12 months')
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
            SELECT AVG(risk_score)
            FROM proveedor_riesgo
            WHERE activo = TRUE
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
            WHERE periodo = strftime('%Y-%m', 'now')
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
            SELECT AVG(julianday(fecha_pago) - julianday(fecha_factura))
            FROM factura_proveedor
            WHERE estado = 'paid'
            AND fecha_pago >= date('now', '-30 days')
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
            WHERE strftime('%Y-%m', fecha_check) = strftime('%Y-%m', 'now')
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
                WHERE s.created_at >= date('now', '-30 days')
            )
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

    conn = get_db_connection()
    cursor = conn.cursor()

    # Obtener valores del mes anterior para calcular variación
    periodo_anterior = (datetime.now().replace(day=1) - timedelta(days=1)).strftime('%Y-%m')

    for kpi_key, valor in kpis_valores.items():
        # Calcular variación
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

        # Insertar snapshot
        cursor.execute("""
            INSERT OR REPLACE INTO executive_snapshot
            (kpi_key, periodo, valor, variacion_pct, trend, detalles)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (kpi_key, periodo, valor, variacion_pct, trend, json.dumps({})))

    conn.commit()
    conn.close()


def obtener_dashboard() -> Dict[str, Any]:
    """Obtiene datos completos del dashboard ejecutivo"""
    kpis_config = obtener_kpis_configurados()
    kpis_valores = calcular_kpis_actuales()

    # Obtener benchmarks
    conn = get_db_connection()
    cursor = conn.cursor()

    dashboard = []

    for kpi in kpis_config:
        kpi_key = kpi['kpi_key']
        valor_actual = kpis_valores.get(kpi_key, 0)

        # Obtener último snapshot para trend
        cursor.execute("""
            SELECT variacion_pct, trend
            FROM executive_snapshot
            WHERE kpi_key = ?
            ORDER BY periodo DESC
            LIMIT 1
        """, (kpi_key,))

        snapshot = cursor.fetchone()
        variacion = snapshot[0] if snapshot else 0
        trend = snapshot[1] if snapshot else 'stable'

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
                'mediana': benchmark_row[0],
                'percentil_25': benchmark_row[1],
                'percentil_75': benchmark_row[2],
                'industria': benchmark_row[3],
                'region': benchmark_row[4]
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

    conn.close()

    return {
        'kpis': dashboard,
        'periodo': datetime.now().strftime('%Y-%m'),
        'ultima_actualizacion': datetime.now().isoformat()
    }


def obtener_tendencias(kpi_key: str, meses: int = 12) -> List[Dict[str, Any]]:
    """Obtiene tendencia histórica de un KPI"""
    conn = get_db_connection()
    cursor = conn.cursor()

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
            'detalles': json.loads(row[4]) if row[4] else {}
        })

    conn.close()

    return list(reversed(tendencias))  # Orden cronológico


def crear_benchmark(data: Dict[str, Any]) -> int:
    """Crea un benchmark de industria"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO benchmark (
            kpi_key, industria, region, percentil_25, mediana,
            percentil_75, fuente, periodo_dato
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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

    benchmark_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return benchmark_id


def obtener_benchmarks(kpi_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """Obtiene benchmarks disponibles"""
    conn = get_db_connection()
    cursor = conn.cursor()

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

    conn.close()
    return benchmarks


def generar_scorecard(usuario_id: int, categorias: Optional[List[str]] = None) -> int:
    """Genera un scorecard de procurement evaluando todas las categorías"""
    if categorias is None:
        categorias = ['procurement', 'sourcing', 'quality', 'logistics', 'finance', 'sustainability']

    dashboard_data = obtener_dashboard()
    kpis = dashboard_data['kpis']

    # Filtrar por categorías solicitadas
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
            recomendaciones.append(f"Atención: {kpi['nombre']} requiere mejora - target {kpi['target_value']}{kpi['unidad']}")

    # Guardar scorecard
    conn = get_db_connection()
    cursor = conn.cursor()

    periodo = datetime.now().strftime('%Y-%m')
    nombre = f"Procurement Scorecard {periodo}"

    cursor.execute("""
        INSERT INTO procurement_scorecard (
            nombre, periodo, categorias_evaluadas, score_total,
            fortalezas, debilidades, recomendaciones, generado_por
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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

    scorecard_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return scorecard_id


def obtener_scorecards(limit: int = 10) -> List[Dict[str, Any]]:
    """Obtiene scorecards históricos"""
    conn = get_db_connection()
    cursor = conn.cursor()

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
            'categorias_evaluadas': json.loads(row[3]) if row[3] else [],
            'score_total': row[4],
            'fortalezas': json.loads(row[5]) if row[5] else [],
            'debilidades': json.loads(row[6]) if row[6] else [],
            'recomendaciones': json.loads(row[7]) if row[7] else [],
            'generado_por': row[8],
            'created_at': row[9]
        })

    conn.close()
    return scorecards


def obtener_scorecard_detalle(scorecard_id: int) -> Optional[Dict[str, Any]]:
    """Obtiene detalle de un scorecard específico"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, nombre, periodo, categorias_evaluadas, score_total,
               fortalezas, debilidades, recomendaciones, generado_por, created_at
        FROM procurement_scorecard
        WHERE id = ?
    """, (scorecard_id,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        'id': row[0],
        'nombre': row[1],
        'periodo': row[2],
        'categorias_evaluadas': json.loads(row[3]) if row[3] else [],
        'score_total': row[4],
        'fortalezas': json.loads(row[5]) if row[5] else [],
        'debilidades': json.loads(row[6]) if row[6] else [],
        'recomendaciones': json.loads(row[7]) if row[7] else [],
        'generado_por': row[8],
        'created_at': row[9]
    }
