"""
Seed Module 17: Executive
KPIs ejecutivos, snapshots mensuales, benchmarks de industria, scorecards trimestrales.

Tablas:
- executive_kpi
- executive_snapshot
- benchmark
- procurement_scorecard
"""

import json
import random
from datetime import datetime

from ._base import (
    SEED_PREFIX,
    SEED_TAG,
    SeedModule,
    fake,
    pick,
    rand_datetime,
)

# KPI catalogue: (categoria, key_suffix, nombre_display, unidad, formula, target, warning, critical)
KPI_CATALOGUE = [
    (
        "procurement",
        "otd_pct",
        "On-Time Delivery",
        "percentage",
        "orders_on_time / total_orders * 100",
        95.0, 90.0, 80.0,
    ),
    (
        "procurement",
        "po_cycle_days",
        "Ciclo de Orden de Compra",
        "days",
        "avg(fecha_recepcion - fecha_emision)",
        7.0, 12.0, 20.0,
    ),
    (
        "procurement",
        "supplier_defect_ppm",
        "Defectos por Proveedor (PPM)",
        "count",
        "defectos / total_unidades * 1000000",
        500.0, 1500.0, 5000.0,
    ),
    (
        "logistics",
        "fleet_utilization_pct",
        "Utilizacion de Flota",
        "percentage",
        "km_recorridos / km_planificados * 100",
        88.0, 75.0, 60.0,
    ),
    (
        "logistics",
        "freight_cost_per_ton",
        "Costo Flete por Tonelada",
        "currency",
        "costo_total_flete / toneladas_transportadas",
        1800.0, 2500.0, 4000.0,
    ),
    (
        "quality",
        "ncr_open_count",
        "NCRs Abiertas",
        "count",
        "count(ncr WHERE estado = 'abierta')",
        5.0, 15.0, 30.0,
    ),
    (
        "quality",
        "inspection_pass_pct",
        "Tasa de Aprobacion en Inspeccion",
        "percentage",
        "inspecciones_aprobadas / total_inspecciones * 100",
        98.0, 94.0, 88.0,
    ),
    (
        "finance",
        "budget_execution_pct",
        "Ejecucion Presupuestaria",
        "percentage",
        "monto_ejecutado / presupuesto_aprobado * 100",
        95.0, 80.0, 60.0,
    ),
    (
        "finance",
        "savings_vs_budget_pct",
        "Ahorro vs Presupuesto",
        "percentage",
        "(presupuesto_aprobado - monto_ejecutado) / presupuesto_aprobado * 100",
        5.0, 2.0, 0.0,
    ),
    (
        "logistics",
        "stockout_rate_pct",
        "Tasa de Quiebre de Stock",
        "percentage",
        "materiales_sin_stock / total_materiales * 100",
        2.0, 5.0, 10.0,
    ),
    (
        "logistics",
        "inventory_turnover_ratio",
        "Rotacion de Inventario",
        "ratio",
        "costo_ventas / inventario_promedio",
        6.0, 4.0, 2.0,
    ),
    (
        "logistics",
        "excess_stock_pct",
        "Stock en Exceso",
        "percentage",
        "unidades_exceso / unidades_totales * 100",
        8.0, 15.0, 25.0,
    ),
    (
        "sourcing",
        "forecast_accuracy_pct",
        "Precision del Forecast",
        "percentage",
        "(1 - abs(forecast - actual) / actual) * 100",
        90.0, 80.0, 65.0,
    ),
    (
        "sourcing",
        "mrp_coverage_days",
        "Cobertura MRP en Dias",
        "days",
        "avg(stock_disponible / consumo_diario)",
        45.0, 20.0, 7.0,
    ),
    (
        "sourcing",
        "requisition_fulfilment_pct",
        "Cumplimiento de Requisiciones",
        "percentage",
        "requisiciones_atendidas / total_requisiciones * 100",
        97.0, 90.0, 80.0,
    ),
]

TREND_OPTIONS = ["up", "down", "stable"]

INDUSTRIAS = ["oil_gas", "manufacturing", "mining"]
REGIONES = ["argentina", "latam", "global"]

FUENTES_BENCHMARK = [
    "Gartner Supply Chain Report",
    "APQC Benchmarking Study",
    "Deloitte Global CPO Survey",
    "McKinsey Operations Excellence",
    "IBF Forecast Benchmark",
    "CSCMP State of Logistics",
    "Aberdeen Group Research",
]

QUARTER_LABELS = ["Q1-2025", "Q2-2025", "Q3-2025", "Q4-2025"]

CATEGORIAS_EVALUADAS_OPTIONS = [
    "procurement, logistics, quality, finance",
    "procurement, inventory, planning",
    "logistics, quality, finance, inventory",
    "procurement, logistics, quality, finance, inventory, planning",
    "quality, finance, planning, inventory",
    "procurement, logistics, planning",
    "procurement, quality, inventory, finance, logistics",
    "logistics, quality, planning",
]

FORTALEZAS_OPTIONS = [
    "Alta tasa de cumplimiento de entregas a tiempo.",
    "Reduccion sostenida de NCRs abiertas en el trimestre.",
    "Excelente ejecucion presupuestaria con ahorros registrados.",
    "Precision de forecast por encima del benchmark de industria.",
    "Flota con alta tasa de utilizacion y bajo costo por tonelada.",
]

DEBILIDADES_OPTIONS = [
    "Ciclo de OC superior al objetivo en categorias criticas.",
    "Incremento de stock en exceso por variabilidad de demanda.",
    "Tasa de quiebre de stock en materiales clase A.",
    "Cobertura MRP por debajo de objetivo en centros regionales.",
    "Tasa de defectos de proveedores requiere plan de accion.",
]

RECOMENDACIONES_OPTIONS = [
    "Implementar acuerdos de marco con proveedores estrategicos para reducir ciclo OC.",
    "Revisar parametros de reorden en materiales con alta rotacion.",
    "Capacitar equipo de planificacion en tecnicas avanzadas de forecasting.",
    "Ampliar programa de homologacion de proveedores alternativos.",
    "Establecer KPIs de trazabilidad de envio en tiempo real.",
]


def _months_back(n):
    """Return a YYYY-MM string for n months ago."""
    now = datetime.now()
    year = now.year
    month = now.month - n
    while month <= 0:
        month += 12
        year -= 1
    return f"{year}-{month:02d}"


class ExecutiveSeed(SeedModule):
    name = "executive"
    description = "KPIs ejecutivos, snapshots, scorecards"
    tables = [
        "procurement_scorecard",
        "benchmark",
        "executive_snapshot",
        "executive_kpi",
    ]

    def seed(self):
        kpi_keys = self._seed_executive_kpi()
        self._seed_executive_snapshot(kpi_keys)
        self._seed_benchmark(kpi_keys)
        self._seed_procurement_scorecard()

    # ------------------------------------------------------------------
    # executive_kpi  (~15 records)
    # Columns: id, categoria, kpi_key, nombre, descripcion, unidad,
    #          formula, target_value, warning_threshold, critical_threshold,
    #          activo (integer default 1), created_at
    # ------------------------------------------------------------------
    def _seed_executive_kpi(self):
        kpi_keys = []

        for (
            categoria,
            key_suffix,
            nombre_display,
            unidad,
            formula,
            target,
            warning,
            critical,
        ) in KPI_CATALOGUE:
            clave = f"{SEED_PREFIX}{key_suffix}"
            row = {
                "categoria": categoria,
                "kpi_key": clave,
                "nombre": f"{SEED_TAG} {nombre_display}",
                "descripcion": f"{SEED_TAG} {fake.sentence(nb_words=10)}",
                "unidad": unidad,
                "formula": formula,
                "target_value": target,
                "warning_threshold": warning,
                "critical_threshold": critical,
                "activo": 1,
                "created_at": rand_datetime(days_back=730),
            }
            try:
                self.insert_no_return("executive_kpi", row)
                kpi_keys.append(clave)
            except Exception:
                pass

        self.log(f"executive_kpi: {len(kpi_keys)} insertados")
        return kpi_keys

    # ------------------------------------------------------------------
    # executive_snapshot  (~90 records, 6 months x 15 KPIs)
    # Columns: id, kpi_key, periodo, valor, variacion_pct,
    #          trend (default 'stable'), detalles (text/json), created_at
    # UNIQUE(kpi_key, periodo)
    # ------------------------------------------------------------------
    def _seed_executive_snapshot(self, kpi_keys):
        count = 0
        used = set()

        kpi_pool = kpi_keys if kpi_keys else [f"{SEED_PREFIX}otd_pct"]

        for months_ago in range(1, 7):
            periodo = _months_back(months_ago)
            for kpi_key in kpi_pool:
                combo = (kpi_key, periodo)
                if combo in used:
                    continue
                used.add(combo)

                valor = round(random.uniform(50, 100), 2)
                variacion = round(random.uniform(-20, 20), 2)
                trend = pick(TREND_OPTIONS)

                detalles = json.dumps({
                    "by_centro": {
                        "1000": round(random.uniform(60, 100), 2),
                        "1100": round(random.uniform(60, 100), 2),
                        "1200": round(random.uniform(60, 100), 2),
                    },
                    "sample_size": random.randint(50, 500),
                    "notes": f"{SEED_TAG} {fake.sentence(nb_words=6)}",
                })

                row = {
                    "kpi_key": kpi_key,
                    "periodo": periodo,
                    "valor": valor,
                    "variacion_pct": variacion,
                    "trend": trend,
                    "detalles": detalles,
                    "created_at": rand_datetime(days_back=months_ago * 30),
                }
                try:
                    self.insert_no_return("executive_snapshot", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"executive_snapshot: {count} insertados")

    # ------------------------------------------------------------------
    # benchmark  (~30 records)
    # Columns: id, kpi_key, industria, region, percentil_25, mediana,
    #          percentil_75, fuente, periodo_dato, created_at
    # ------------------------------------------------------------------
    def _seed_benchmark(self, kpi_keys):
        count = 0
        kpi_pool = kpi_keys if kpi_keys else [f"{SEED_PREFIX}otd_pct"]

        # Use a subset of KPIs for benchmarks (about half)
        benchmark_kpis = random.sample(kpi_pool, min(10, len(kpi_pool)))

        for kpi_key in benchmark_kpis:
            for industria in random.sample(INDUSTRIAS, k=random.randint(1, 3)):
                region = pick(REGIONES)
                p25 = round(random.uniform(50, 75), 2)
                mediana = round(p25 + random.uniform(5, 15), 2)
                p75 = round(mediana + random.uniform(5, 15), 2)

                periodo_dato = _months_back(random.randint(3, 18))
                fuente = pick(FUENTES_BENCHMARK)

                row = {
                    "kpi_key": kpi_key,
                    "industria": industria,
                    "region": region,
                    "percentil_25": p25,
                    "mediana": mediana,
                    "percentil_75": p75,
                    "fuente": f"{SEED_TAG} {fuente}",
                    "periodo_dato": periodo_dato,
                    "created_at": rand_datetime(days_back=270),
                }
                try:
                    self.insert_no_return("benchmark", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"benchmark: {count} insertados")

    # ------------------------------------------------------------------
    # procurement_scorecard  (~4 records, quarterly)
    # Columns: id, nombre (text NOT NULL), periodo (text),
    #          categorias_evaluadas (text), score_total (real),
    #          fortalezas (text), debilidades (text),
    #          recomendaciones (text), generado_por (integer), created_at
    # ------------------------------------------------------------------
    def _seed_procurement_scorecard(self):
        count = 0

        for q_label in QUARTER_LABELS:
            score = round(random.uniform(55, 98), 2)
            categorias = pick(CATEGORIAS_EVALUADAS_OPTIONS)
            fortaleza = pick(FORTALEZAS_OPTIONS)
            debilidad = pick(DEBILIDADES_OPTIONS)
            recomendacion = pick(RECOMENDACIONES_OPTIONS)

            row = {
                "nombre": f"{SEED_TAG} Scorecard Procurement {q_label}",
                "periodo": q_label,
                "categorias_evaluadas": f"{SEED_TAG} {categorias}",
                "score_total": score,
                "fortalezas": f"{SEED_TAG} {fortaleza}",
                "debilidades": f"{SEED_TAG} {debilidad}",
                "recomendaciones": f"{SEED_TAG} {recomendacion}",
                "generado_por": int(self.refs.rand_user()),
                "created_at": rand_datetime(days_back=270),
            }
            try:
                self.insert_no_return("procurement_scorecard", row)
                count += 1
            except Exception:
                pass

        self.log(f"procurement_scorecard: {count} insertados")

    def clean(self):
        cursor = self.conn.cursor()
        clean_map = {
            "procurement_scorecard": "nombre",
            "benchmark": "fuente",
            "executive_snapshot": "kpi_key",
            "executive_kpi": "kpi_key",
        }
        for table, col in clean_map.items():
            try:
                cursor.execute(
                    f"DELETE FROM {table} WHERE {col} LIKE ?",
                    (f"%{SEED_PREFIX}%",),
                )
                if cursor.rowcount and cursor.rowcount > 0:
                    self.log(f"Cleaned {cursor.rowcount} rows from {table}")
            except Exception as e:
                self.log(f"Warning cleaning {table}: {e}")
        self.conn.commit()
