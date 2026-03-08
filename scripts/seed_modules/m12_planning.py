"""
Seed Module 12: Planning
MRP, demand planning, producción, capacidad.

Tablas reales en PG:
- work_center
- plan_produccion
- plan_demanda
- plan_demanda_entrada
- ordenes_planificadas
- alertas_mrp
- produccion_capacidad
"""

import random

from ._base import (
    SeedModule,
    fake,
    pick,
    rand_datetime,
    rand_future_date,
    rand_past_date,
    seed_code,
)

WORK_CENTER_TIPOS = ["assembly", "machining", "packaging", "testing"]
WORK_CENTER_ESTADOS = ["active", "inactive", "maintenance"]

PLAN_PROD_ESTADOS = ["draft", "publicado", "en_ejecucion", "completado", "cancelado"]

PLAN_DEMANDA_ESTADOS = ["draft", "collecting", "review", "consensus", "approved", "closed"]
PLAN_DEMANDA_METODOS = ["manual", "historico", "ml", "consenso"]

ORDEN_TIPOS = ["compra", "produccion", "transferencia"]
ORDEN_ESTADOS = ["planificada", "confirmada", "liberada", "completada", "cancelada"]

ALERTA_TIPOS = ["stockout_risk", "overstock", "lead_time_exceeded", "demand_spike", "capacity_constraint"]
ALERTA_SEVERIDADES = ["baja", "media", "alta", "critica"]
ALERTA_ESTADOS = ["activa", "resuelta", "ignorada"]


def _fake_periodo():
    """Devuelve un string YYYY-MM aleatorio dentro de los últimos 12 meses."""
    from datetime import datetime, timedelta

    delta = random.randint(0, 12)
    dt = datetime.now() - timedelta(days=delta * 30)
    return dt.strftime("%Y-%m")


class PlanningSeed(SeedModule):
    name = "planning"
    description = "MRP, demand planning, producción, capacidad"
    tables = [
        # Reverse dependency order (children first) for cleanup
        "produccion_capacidad",
        "alertas_mrp",
        "ordenes_planificadas",
        "plan_demanda_entrada",
        "plan_demanda",
        "plan_produccion",
        "work_center",
    ]

    def seed(self):
        work_center_ids = self._seed_work_centers()
        prod_ids = self._seed_plan_produccion(work_center_ids)
        plan_ids = self._seed_plan_demanda()
        self._seed_plan_demanda_entradas(plan_ids)
        self._seed_ordenes_planificadas()
        self._seed_alertas_mrp()
        self._seed_produccion_capacidad(work_center_ids)

    # ------------------------------------------------------------------
    # work_center  (~8 records)
    # Cols: nombre, codigo, tipo, capacidad_diaria, unidad, turnos,
    #       eficiencia_pct, costo_hora, estado, ubicacion, created_at
    # ------------------------------------------------------------------
    def _seed_work_centers(self):
        work_center_ids = []

        nombres = [
            "Línea Ensamble A",
            "Centro Inspección Calidad",
            "Línea Empaque 1",
            "Taller Fabricación",
            "Centro Pruebas Funcionales",
            "Línea Producción B",
            "Celda Soldadura",
            "Zona Almacenamiento Intermedio",
        ]

        for i, nombre_base in enumerate(nombres, start=1):
            tipo = pick(WORK_CENTER_TIPOS)
            eficiencia = round(random.uniform(70, 98), 2)
            capacidad = round(random.uniform(4, 24), 2)

            # First 4 WCs always active, rest random
            estado = "active" if i <= 4 else pick(WORK_CENTER_ESTADOS)

            row = {
                "nombre": f"{nombre_base}",
                "codigo": seed_code("WC", i),
                "tipo": tipo,
                "capacidad_diaria": capacidad,
                "unidad": "horas",
                "turnos": random.randint(1, 3),
                "eficiencia_pct": eficiencia,
                "costo_hora": round(random.uniform(150, 1500), 2),
                "estado": estado,
                "ubicacion": f"Planta {pick(['A', 'B', 'C'])} - Sector {random.randint(1, 5)}",
                "created_at": rand_datetime(days_back=365),
            }
            try:
                wcid = self.insert("work_center", row)
                if wcid:
                    work_center_ids.append(wcid)
            except Exception:
                pass

        self.log(f"work_center: {len(work_center_ids)} insertados")
        return work_center_ids

    # ------------------------------------------------------------------
    # plan_produccion  (~15 records)
    # Cols: nombre, periodo, estado, work_center_id, material_codigo,
    #       cantidad_planificada, cantidad_producida, fecha_inicio,
    #       fecha_fin, prioridad, notas, created_by, created_at, updated_at
    # ------------------------------------------------------------------
    def _seed_plan_produccion(self, work_center_ids):
        prod_ids = []

        nombres = [
            "Plan Producción Enero 2026",
            "Plan Producción Febrero 2026",
            "Plan Producción Marzo 2026",
            "Plan Producción Q1 2026",
            "Plan Producción Revisado Especial",
            "Plan Producción Línea A - Sem 1",
            "Plan Producción Línea A - Sem 2",
            "Plan Producción Línea B - Sem 1",
            "Plan Producción Línea B - Sem 2",
            "Plan Producción Urgente Feb",
            "Plan Producción Empaque Q1",
            "Plan Producción Soldadura Ene",
            "Plan Producción Calidad Q1",
            "Plan Producción Turno Noche",
            "Plan Producción Fin de Semana",
        ]

        for nombre_base in nombres:
            estado = pick(PLAN_PROD_ESTADOS)
            periodo_desde = rand_past_date(1, 180)
            periodo_hasta = rand_future_date(1, 90)

            row = {
                "nombre": f"{nombre_base}",
                "periodo_desde": periodo_desde,
                "periodo_hasta": periodo_hasta,
                "estado": estado,
                "responsable_id": self.refs.rand_user(),
                "notas": f"{fake.sentence(nb_words=9)}",
                "created_at": rand_datetime(days_back=150),
            }
            try:
                pid = self.insert("plan_produccion", row)
                if pid:
                    prod_ids.append(pid)
            except Exception:
                pass

        self.log(f"plan_produccion: {len(prod_ids)} insertados")
        return prod_ids

    # ------------------------------------------------------------------
    # plan_demanda  (~10 records)
    # Cols: nombre, periodo, estado, metodo, created_by, created_at,
    #       updated_at
    # ------------------------------------------------------------------
    def _seed_plan_demanda(self):
        plan_ids = []

        nombres = [
            "Plan Demanda Q1 2026",
            "Plan Demanda Q2 2026",
            "Plan Demanda Anual 2025",
            "Plan Demanda Revisión Especial",
            "Plan Demanda H2 2025",
            "Plan Demanda Q3 2026",
            "Plan Demanda Q4 2026",
            "Plan Demanda Materiales Críticos",
            "Plan Demanda Lubricantes 2026",
            "Plan Demanda Repuestos Mecánicos",
        ]

        for nombre_base in nombres:
            estado = pick(PLAN_DEMANDA_ESTADOS)

            row = {
                "nombre": f"{nombre_base}",
                "periodo_desde": rand_past_date(30, 365),
                "periodo_hasta": rand_future_date(30, 365),
                "estado": estado,
                "creado_por": self.refs.rand_user(),
                "aprobado_por": self.refs.rand_admin() if estado in ("approved", "closed") else None,
                "created_at": rand_datetime(days_back=180),
            }
            try:
                pid = self.insert("plan_demanda", row)
                if pid:
                    plan_ids.append(pid)
            except Exception:
                pass

        self.log(f"plan_demanda: {len(plan_ids)} insertados")
        return plan_ids

    # ------------------------------------------------------------------
    # plan_demanda_entrada  (~25 records, 5 per plan)
    # Cols: plan_id, material_codigo, usuario_id, fuente,
    #       cantidad_pronosticada, confianza, notas, created_at
    # ------------------------------------------------------------------
    def _seed_plan_demanda_entradas(self, plan_ids):
        count = 0
        fuentes = ["historico", "manual", "ml", "consenso"]

        for pid in plan_ids:
            for _ in range(5):
                row = {
                    "plan_id": pid,
                    "material_codigo": self.refs.rand_material(),
                    "usuario_id": self.refs.rand_user(),
                    "fuente": pick(fuentes),
                    "cantidad_pronosticada": round(random.uniform(10, 2000), 2),
                    "confianza": round(random.uniform(0.5, 1.0), 2),
                    "notas": f"{fake.sentence(nb_words=8)}",
                    "created_at": rand_datetime(days_back=120),
                }
                try:
                    self.insert_no_return("plan_demanda_entrada", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"plan_demanda_entrada: {count} insertados")

    # ------------------------------------------------------------------
    # ordenes_planificadas  (~30 records)
    # Cols: material_codigo, cantidad, fecha_necesidad, tipo, estado,
    #       proveedor_sugerido, lead_time_dias, costo_estimado,
    #       mrp_run_id, notas, created_at
    # ------------------------------------------------------------------
    def _seed_ordenes_planificadas(self):
        count = 0

        for i in range(1, 31):
            tipo = pick(ORDEN_TIPOS)
            estado = pick(ORDEN_ESTADOS)
            cantidad = round(random.uniform(5, 1500), 2)

            row = {
                "material_codigo": self.refs.rand_material(),
                "centro": self.refs.rand_centro(),
                "cantidad": cantidad,
                "fecha_necesidad": rand_future_date(1, 90),
                "tipo": tipo,
                "prioridad": random.randint(1, 5),
                "estado": estado,
                "solped_id": random.randint(1, 30) if random.random() > 0.5 else None,
                "created_by": self.refs.rand_user(),
                "created_at": rand_datetime(days_back=60),
            }
            try:
                self.insert_no_return("ordenes_planificadas", row)
                count += 1
            except Exception:
                pass

        self.log(f"ordenes_planificadas: {count} insertados")

    # ------------------------------------------------------------------
    # alertas_mrp  (~20 records)
    # Cols: tipo, material_codigo, mensaje, severidad, estado, created_at
    # ------------------------------------------------------------------
    def _seed_alertas_mrp(self):
        count = 0

        for i in range(1, 21):
            tipo = pick(ALERTA_TIPOS)
            estado = pick(ALERTA_ESTADOS)

            resuelto_por = None
            accion_tomada = None
            fecha_resolucion = None
            if estado == "resuelta":
                resuelto_por = self.refs.rand_user()
                accion_tomada = f"{fake.sentence(nb_words=8)}"
                fecha_resolucion = rand_datetime(days_back=15)

            row = {
                "material_codigo": self.refs.rand_material(),
                "centro": self.refs.rand_centro(),
                "tipo": tipo,
                "severidad": pick(ALERTA_SEVERIDADES),
                "estado": estado,
                "resuelto_por": resuelto_por,
                "accion_tomada": accion_tomada,
                "fecha_resolucion": fecha_resolucion,
                "created_at": rand_datetime(days_back=30),
            }
            try:
                self.insert_no_return("alertas_mrp", row)
                count += 1
            except Exception:
                pass

        self.log(f"alertas_mrp: {count} insertados")

    # ------------------------------------------------------------------
    # produccion_capacidad  (~40 records, 5 days per work center)
    # Cols: work_center_id, fecha, capacidad_disponible, capacidad_utilizada,
    #       capacidad_comprometida, created_at
    # UNIQUE(work_center_id, fecha)
    # ------------------------------------------------------------------
    def _seed_produccion_capacidad(self, work_center_ids):
        count = 0

        if not work_center_ids:
            return

        for wcid in work_center_ids:
            used_fechas = set()
            for _ in range(5):
                fecha = rand_past_date(1, 30)
                attempts = 0
                while fecha in used_fechas and attempts < 20:
                    fecha = rand_past_date(1, 30)
                    attempts += 1
                used_fechas.add(fecha)

                capacidad_disp = round(random.uniform(4, 24), 2)
                capacidad_utilizada = round(capacidad_disp * random.uniform(0.3, 0.95), 2)
                capacidad_comprometida = round(capacidad_disp * random.uniform(0.1, 0.5), 2)

                row = {
                    "work_center_id": wcid,
                    "fecha": fecha,
                    "capacidad_disponible": capacidad_disp,
                    "capacidad_utilizada": capacidad_utilizada,
                    "capacidad_comprometida": capacidad_comprometida,
                    "created_at": rand_datetime(days_back=30),
                }
                try:
                    self.insert_no_return("produccion_capacidad", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"produccion_capacidad: {count} insertados")

    def clean(self):
        cursor = self.conn.cursor()
        for table in self.tables:
            try:
                cursor.execute(f"DELETE FROM {table}")
                if cursor.rowcount and cursor.rowcount > 0:
                    self.log(f"Cleaned {cursor.rowcount} rows from {table}")
            except Exception as e:
                self.log(f"Warning cleaning {table}: {e}")
        self.conn.commit()
