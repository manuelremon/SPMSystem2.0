"""
Seed Module 19: Missing Tables
Tablas vacías que impactan en páginas del frontend.

Prioridad 1 (previenen errores):
- tipo_cambio

Prioridad 2 (páginas completamente vacías):
- consignment_programa, consignment_consumo, consignment_reconciliacion
- emision_carbono, material_huella_carbono, meta_sostenibilidad
- cycle_count_programa, cycle_count_item
- kanban_tablero, kanban_senal, kanban_historial

Prioridad 3 (planificación):
- control_tower_event, control_tower_kpi_snapshot, control_tower_alerta_agregada
- plan_produccion_item, plan_produccion_material, plan_produccion_historial
- plan_demanda_detalle, plan_demanda_consenso

Prioridad 4 (comunidad):
- foro_posts, foro_respuestas
- trivia_questions, trivia_answers
"""

import json
import random
from datetime import datetime, timedelta

from ._base import (
    SEED_PREFIX,
    SEED_TAG,
    SeedModule,
    fake,
    now_str,
    pick,
    rand_datetime,
    rand_future_date,
    rand_money,
    rand_past_date,
    rand_pct,
    seed_code,
)


class MissingTablesSeed(SeedModule):
    name = "missing"
    description = "Tablas vacías críticas para frontend (tipo_cambio, kanban, consignment, sustainability, etc.)"
    tables = [
        # Clean in reverse dependency order
        "trivia_answers",
        "trivia_questions",
        "foro_respuestas",
        "foro_posts",
        "plan_demanda_consenso",
        "plan_demanda_detalle",
        "plan_produccion_historial",
        "plan_produccion_material",
        "plan_produccion_item",
        "control_tower_alerta_agregada",
        "control_tower_kpi_snapshot",
        "control_tower_event",
        "kanban_historial",
        "kanban_senal",
        "kanban_tablero",
        "cycle_count_item",
        "cycle_count_programa",
        "meta_sostenibilidad",
        "material_huella_carbono",
        "emision_carbono",
        "consignment_reconciliacion",
        "consignment_consumo",
        "consignment_stock",
        "consignment_programa",
        "tipo_cambio",
    ]

    def seed(self):
        self._seed_tipo_cambio()
        consignment_ids = self._seed_consignment()
        self._seed_consignment_stock(consignment_ids)
        self._seed_consignment_consumo(consignment_ids)
        self._seed_consignment_reconciliacion(consignment_ids)
        self._seed_emision_carbono()
        self._seed_material_huella_carbono()
        self._seed_meta_sostenibilidad()
        cc_programa_ids = self._seed_cycle_count_programa()
        self._seed_cycle_count_item(cc_programa_ids)
        tablero_ids = self._seed_kanban_tablero()
        tarjeta_ids = self._seed_kanban_tarjetas(tablero_ids)
        self._seed_kanban_senales(tarjeta_ids)
        self._seed_kanban_historial(tarjeta_ids)
        self._seed_control_tower_events()
        self._seed_control_tower_kpi_snapshots()
        self._seed_control_tower_alertas()
        self._seed_plan_produccion_items()
        self._seed_plan_demanda_detalle()
        self._seed_foro()
        self._seed_trivia()

    # ------------------------------------------------------------------
    # tipo_cambio  (~12 records - CRITICAL: prevents 500 errors)
    # ------------------------------------------------------------------
    def _seed_tipo_cambio(self):
        count = 0
        pares = [
            ("USD", "ARS", 1050.0, 50.0),
            ("EUR", "ARS", 1150.0, 60.0),
            ("EUR", "USD", 1.08, 0.02),
            ("ARS", "USD", 0.00095, 0.00005),
            ("ARS", "EUR", 0.00087, 0.00005),
            ("USD", "EUR", 0.92, 0.02),
        ]
        # Current rates + historical
        for moneda_o, moneda_d, base_rate, variacion in pares:
            for days_back in [0, 30]:
                tasa = round(base_rate + random.uniform(-variacion, variacion), 6)
                fecha = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
                row = {
                    "moneda_origen": moneda_o,
                    "moneda_destino": moneda_d,
                    "tasa": tasa,
                    "fecha": fecha,
                    "fuente": f"{SEED_TAG} BCRA/Market",
                }
                try:
                    self.insert_no_return("tipo_cambio", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"tipo_cambio: {count} insertados")

    # ------------------------------------------------------------------
    # consignment_programa  (~5 records)
    # ------------------------------------------------------------------
    def _seed_consignment(self):
        ids = []
        nombres = [
            "Consignación Lubricantes Planta Norte",
            "Consignación Repuestos Mecánicos",
            "Consignación EPP Seguridad",
            "Consignación Materiales Eléctricos",
            "Consignación Válvulas Industriales",
        ]
        for i, nombre in enumerate(nombres):
            row = {
                "proveedor_cuit": self.refs.rand_proveedor(),
                "nombre": f"{SEED_TAG} {nombre}",
                "descripcion": f"{SEED_TAG} {fake.paragraph(nb_sentences=2)}",
                "estado": pick(["active", "active", "active", "suspended"]),
                "condiciones_pago": pick(["30 días", "60 días", "contado"]),
                "porcentaje_margen": round(random.uniform(5, 20), 1),
                "periodo_reconciliacion": pick(["mensual", "quincenal"]),
                "created_at": rand_datetime(days_back=180),
            }
            try:
                pid = self.insert("consignment_programa", row)
                if pid:
                    ids.append(pid)
            except Exception:
                pass
        self.log(f"consignment_programa: {len(ids)} insertados")
        return ids

    # ------------------------------------------------------------------
    # consignment_stock  (~15 records, needed for consignment_consumo FK)
    # Cols: programa_id, material_codigo, cantidad_disponible,
    #       cantidad_consumida_acumulada, valor_unitario,
    #       ultima_actualizacion, created_at
    # ------------------------------------------------------------------
    def _seed_consignment_stock(self, programa_ids):
        count = 0
        if not programa_ids:
            return

        # Check if stock already exists
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM consignment_stock")
            existing = cursor.fetchone()[0]
        except Exception:
            existing = 0

        if existing >= 10:
            self.log(f"consignment_stock: ya hay {existing} records, skip")
            return

        for prog_id in programa_ids:
            for _ in range(3):
                cant_disp = round(random.uniform(10, 500), 2)
                cant_cons = round(random.uniform(0, cant_disp * 0.6), 2)
                row = {
                    "programa_id": prog_id,
                    "material_codigo": self.refs.rand_material(),
                    "cantidad_disponible": cant_disp,
                    "cantidad_consumida_acumulada": cant_cons,
                    "valor_unitario": rand_money(10, 2000),
                    "ultima_actualizacion": rand_datetime(days_back=30),
                    "created_at": rand_datetime(days_back=90),
                }
                try:
                    self.insert_no_return("consignment_stock", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"consignment_stock: {count} insertados")

    # ------------------------------------------------------------------
    # consignment_consumo  (~15 records)
    # ------------------------------------------------------------------
    def _seed_consignment_consumo(self, programa_ids):
        count = 0
        # Get consignment_stock IDs if any exist
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT id FROM consignment_stock LIMIT 20")
            stock_ids = [r[0] for r in cursor.fetchall()]
        except Exception:
            stock_ids = []

        if not stock_ids:
            self.log("consignment_consumo: 0 (no consignment_stock)")
            return

        for _ in range(15):
            row = {
                "stock_id": pick(stock_ids),
                "cantidad": round(random.uniform(1, 50), 2),
                "solicitud_id": self.refs.rand_solicitud() if random.random() > 0.3 else None,
                "usuario_id": int(self.refs.rand_user()),
                "fecha_consumo": rand_datetime(days_back=60),
                "facturado": random.choice([0, 0, 1]),
            }
            try:
                self.insert_no_return("consignment_consumo", row)
                count += 1
            except Exception:
                pass
        self.log(f"consignment_consumo: {count} insertados")

    # ------------------------------------------------------------------
    # consignment_reconciliacion  (~8 records)
    # ------------------------------------------------------------------
    def _seed_consignment_reconciliacion(self, programa_ids):
        count = 0
        if not programa_ids:
            return
        for prog_id in programa_ids:
            for month_back in [1, 2]:
                periodo = (datetime.now() - timedelta(days=30 * month_back)).strftime('%Y-%m')
                row = {
                    "programa_id": prog_id,
                    "periodo": f"{SEED_TAG} {periodo}",
                    "cantidad_consumida_total": round(random.uniform(50, 500), 2),
                    "monto_total": rand_money(5000, 200000),
                    "estado": pick(["draft", "enviado", "confirmado", "facturado"]),
                    "notas": f"{SEED_TAG} Reconciliación período {periodo}",
                    "created_at": rand_datetime(days_back=60),
                }
                if row["estado"] in ("enviado", "confirmado", "facturado"):
                    row["fecha_envio"] = rand_datetime(days_back=30)
                if row["estado"] in ("confirmado", "facturado"):
                    row["fecha_confirmacion"] = rand_datetime(days_back=15)
                try:
                    self.insert_no_return("consignment_reconciliacion", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"consignment_reconciliacion: {count} insertados")

    # ------------------------------------------------------------------
    # emision_carbono  (~30 records)
    # ------------------------------------------------------------------
    def _seed_emision_carbono(self):
        count = 0
        scopes = ["scope_1", "scope_2", "scope_3"]
        categorias = ["transporte", "fabricacion", "energia", "residuos"]
        origenes = ["material", "envio", "proveedor", "orden_compra"]

        for _ in range(30):
            scope = pick(scopes)
            cat = pick(categorias)
            origen = pick(origenes)
            periodo = (datetime.now() - timedelta(days=random.randint(0, 180))).strftime('%Y-%m')

            row = {
                "origen_tipo": origen,
                "origen_id": random.randint(1, 50),
                "scope": scope,
                "categoria": cat,
                "cantidad": round(random.uniform(0.5, 500), 2),
                "material_codigo": self.refs.rand_material() if origen == "material" else None,
                "proveedor_cuit": self.refs.rand_proveedor() if origen == "proveedor" else None,
                "periodo": f"{SEED_TAG} {periodo}",
                "created_at": rand_datetime(days_back=180),
            }
            try:
                self.insert_no_return("emision_carbono", row)
                count += 1
            except Exception:
                pass
        self.log(f"emision_carbono: {count} insertados")

    # ------------------------------------------------------------------
    # material_huella_carbono  (~20 records)
    # ------------------------------------------------------------------
    def _seed_material_huella_carbono(self):
        count = 0
        materiales = self.refs.material_codes[:20] if len(self.refs.material_codes) >= 20 else self.refs.material_codes
        fuentes = ["IPCC 2021", "EPA GHG Inventory", "Ecoinvent v3.9", "Cálculo interno"]

        for mat in materiales:
            row = {
                "material_codigo": mat,
                "huella_base": round(random.uniform(0.1, 50), 3),
                "unidad_base": pick(["kg CO2e/kg", "kg CO2e/m3", "kg CO2e/UN", "kg CO2e/LT"]),
                "fuente_dato": f"{SEED_TAG} {pick(fuentes)}",
                "fecha_actualizacion": rand_datetime(days_back=365),
            }
            try:
                self.insert_no_return("material_huella_carbono", row)
                count += 1
            except Exception:
                pass
        self.log(f"material_huella_carbono: {count} insertados")

    # ------------------------------------------------------------------
    # meta_sostenibilidad  (~6 records)
    # ------------------------------------------------------------------
    def _seed_meta_sostenibilidad(self):
        count = 0
        metas = [
            ("Reducción 20% emisiones Scope 1", "reduccion_emisiones", 20.0, "%", 0.35),
            ("100% energía renovable planta norte", "energia_renovable", 100.0, "%", 0.60),
            ("Zero waste en packaging", "residuo_cero", 0.0, "tn", 0.45),
            ("Packaging 80% reciclable", "packaging_sostenible", 80.0, "%", 0.55),
            ("Reducción 30% huella carbono transporte", "reduccion_emisiones", 30.0, "%", 0.20),
            ("Eliminar plásticos single-use", "packaging_sostenible", 0.0, "UN", 0.70),
        ]
        for nombre, tipo, valor_meta, unidad, progreso in metas:
            row = {
                "nombre": f"{SEED_TAG} {nombre}",
                "tipo": tipo,
                "valor_meta": valor_meta,
                "unidad": unidad,
                "fecha_inicio": rand_past_date(days_min=180, days_max=365),
                "fecha_objetivo": rand_future_date(days_min=180, days_max=730),
                "responsable_id": int(self.refs.rand_admin()),
                "estado": "active",
                "progreso_actual": round(valor_meta * progreso, 1),
                "created_at": rand_datetime(days_back=365),
            }
            try:
                self.insert_no_return("meta_sostenibilidad", row)
                count += 1
            except Exception:
                pass
        self.log(f"meta_sostenibilidad: {count} insertados")

    # ------------------------------------------------------------------
    # cycle_count_programa  (~4 records)
    # ------------------------------------------------------------------
    def _seed_cycle_count_programa(self):
        ids = []
        programas = [
            ("Conteo ABC Almacén Principal", "abc", 30, 60, 90),
            ("Conteo Frecuencia Alta", "frequency", 15, 30, 60),
            ("Conteo Random Trimestral", "random", 45, 90, 180),
            ("Conteo ABC Almacén Secundario", "abc", 30, 60, 90),
        ]
        for nombre, tipo, fa, fb, fc in programas:
            row = {
                "nombre": f"{SEED_TAG} {nombre}",
                "tipo": tipo,
                "frecuencia_a_dias": fa,
                "frecuencia_b_dias": fb,
                "frecuencia_c_dias": fc,
                "estado": "active",
                "proximo_conteo": rand_future_date(days_min=5, days_max=30),
                "created_at": rand_datetime(days_back=180),
            }
            try:
                pid = self.insert("cycle_count_programa", row)
                if pid:
                    ids.append(pid)
            except Exception:
                pass
        self.log(f"cycle_count_programa: {len(ids)} insertados")
        return ids

    # ------------------------------------------------------------------
    # cycle_count_item  (~30 records, linked to existing cycle_count)
    # ------------------------------------------------------------------
    def _seed_cycle_count_item(self, programa_ids):
        count = 0
        # Get existing cycle_count IDs
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT id FROM cycle_count LIMIT 20")
            count_ids = [r[0] for r in cursor.fetchall()]
        except Exception:
            count_ids = []

        if not count_ids:
            self.log("cycle_count_item: 0 (no cycle_count records)")
            return

        estados = ["pending", "counted", "verified", "adjusted"]
        for count_id in count_ids:
            num_items = random.randint(3, 6)
            for _ in range(num_items):
                cant_sistema = round(random.uniform(10, 500), 2)
                varianza_pct = random.choice([0, 0, 0, 2, 5, -3, -5, 10, -8])
                cant_contada = round(cant_sistema * (1 + varianza_pct / 100), 2)
                varianza = round(cant_contada - cant_sistema, 2)
                estado = pick(estados)

                row = {
                    "count_id": count_id,
                    "material_codigo": self.refs.rand_material(),
                    "ubicacion": f"A{random.randint(1,5)}-R{random.randint(1,10)}-N{random.randint(1,4)}",
                    "cantidad_sistema": cant_sistema,
                    "cantidad_contada": cant_contada if estado != "pending" else None,
                    "varianza": varianza if estado != "pending" else None,
                    "varianza_pct": varianza_pct if estado != "pending" else None,
                    "estado": estado,
                    "contado_por": int(self.refs.rand_user()) if estado != "pending" else None,
                    "fecha_conteo": rand_datetime(days_back=30) if estado != "pending" else None,
                    "created_at": rand_datetime(days_back=60),
                }
                try:
                    self.insert_no_return("cycle_count_item", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"cycle_count_item: {count} insertados")

    # ------------------------------------------------------------------
    # kanban_tablero  (~4 records)
    # ------------------------------------------------------------------
    def _seed_kanban_tablero(self):
        ids = []
        tableros = [
            "Kanban Producción Línea 1",
            "Kanban Almacén Principal",
            "Kanban Proveedores Críticos",
            "Kanban Mantenimiento",
        ]
        for nombre in tableros:
            row = {
                "nombre": f"{SEED_TAG} {nombre}",
                "descripcion": f"{SEED_TAG} Tablero {nombre.lower()}",
                "estado": "active",
                "created_by": int(self.refs.rand_admin()),
                "created_at": rand_datetime(days_back=180),
            }
            try:
                tid = self.insert("kanban_tablero", row)
                if tid:
                    ids.append(tid)
            except Exception:
                pass
        self.log(f"kanban_tablero: {len(ids)} insertados")
        return ids

    # ------------------------------------------------------------------
    # kanban_tarjeta  (use existing tarjetas, link to new tableros)
    # ------------------------------------------------------------------
    def _seed_kanban_tarjetas(self, tablero_ids):
        """Link existing kanban_tarjeta to new tableros, or create new ones."""
        # Check if tarjetas already exist
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT id FROM kanban_tarjeta LIMIT 30")
            existing = [r[0] for r in cursor.fetchall()]
        except Exception:
            existing = []

        if existing:
            self.log(f"kanban_tarjeta: {len(existing)} ya existen")
            return existing

        # Create new tarjetas linked to tableros
        ids = []
        if not tablero_ids:
            return ids

        tipos = ["produccion", "transporte", "proveedor"]
        estados = ["empty", "in_transit", "full"]
        for tablero_id in tablero_ids:
            for _ in range(4):
                row = {
                    "tablero_id": tablero_id,
                    "material_codigo": self.refs.rand_material(),
                    "tipo": pick(tipos),
                    "estado": pick(estados),
                    "cantidad_contenedor": round(random.uniform(10, 200), 0),
                    "punto_reorden": random.randint(1, 3),
                    "lead_time_horas": random.randint(4, 72),
                    "ubicacion_supermarket": f"SM-{random.randint(1,5)}-{random.randint(1,10)}",
                    "proveedor_cuit": self.refs.rand_proveedor() if random.random() > 0.5 else None,
                    "ciclos_totales": random.randint(0, 50),
                    "created_at": rand_datetime(days_back=180),
                }
                try:
                    tid = self.insert("kanban_tarjeta", row)
                    if tid:
                        ids.append(tid)
                except Exception:
                    pass
        self.log(f"kanban_tarjeta: {len(ids)} insertados")
        return ids

    # ------------------------------------------------------------------
    # kanban_senal  (~15 records)
    # ------------------------------------------------------------------
    def _seed_kanban_senales(self, tarjeta_ids):
        count = 0
        if not tarjeta_ids:
            return
        tipos = ["reposicion", "produccion", "compra"]
        estados = ["generada", "en_proceso", "completada", "cancelada"]

        for _ in range(15):
            estado = pick(estados)
            cant_sol = round(random.uniform(10, 200), 2)
            row = {
                "tarjeta_id": pick(tarjeta_ids),
                "tipo": pick(tipos),
                "estado": estado,
                "cantidad_solicitada": cant_sol,
                "cantidad_entregada": round(cant_sol * random.uniform(0, 1), 2) if estado == "completada" else 0,
                "fecha_generacion": rand_datetime(days_back=30),
                "fecha_completado": rand_datetime(days_back=10) if estado == "completada" else None,
                "ejecutado_por": int(self.refs.rand_user()) if estado in ("en_proceso", "completada") else None,
                "created_at": rand_datetime(days_back=30),
            }
            try:
                self.insert_no_return("kanban_senal", row)
                count += 1
            except Exception:
                pass
        self.log(f"kanban_senal: {count} insertados")

    # ------------------------------------------------------------------
    # kanban_historial  (~20 records)
    # ------------------------------------------------------------------
    def _seed_kanban_historial(self, tarjeta_ids):
        count = 0
        if not tarjeta_ids:
            return
        transitions = [("full", "empty"), ("empty", "in_transit"), ("in_transit", "full")]

        for _ in range(20):
            ant, nuevo = pick(transitions)
            row = {
                "tarjeta_id": pick(tarjeta_ids),
                "estado_anterior": ant,
                "estado_nuevo": nuevo,
                "actor_id": int(self.refs.rand_user()),
                "notas": f"{SEED_TAG} Cambio de estado kanban",
                "created_at": rand_datetime(days_back=60),
            }
            try:
                self.insert_no_return("kanban_historial", row)
                count += 1
            except Exception:
                pass
        self.log(f"kanban_historial: {count} insertados")

    # ------------------------------------------------------------------
    # control_tower_event  (~25 records)
    # ------------------------------------------------------------------
    def _seed_control_tower_events(self):
        count = 0
        eventos = [
            ("sla_breach", "SLA incumplido en entrega", "critical", "procurement"),
            ("stock_alert", "Stock bajo nivel crítico", "warning", "logistics"),
            ("quality_hold", "Material en hold de calidad", "warning", "quality"),
            ("delivery_delay", "Retraso en entrega proveedor", "warning", "logistics"),
            ("approval_pending", "Aprobación pendiente >48h", "info", "procurement"),
            ("price_change", "Cambio de precio detectado", "info", "finance"),
            ("ncr_opened", "NCR abierto para material", "critical", "quality"),
            ("budget_exceeded", "Presupuesto excedido 110%", "critical", "finance"),
            ("supplier_risk", "Riesgo proveedor elevado", "warning", "procurement"),
            ("shipment_arrived", "Envío recibido en planta", "success", "logistics"),
        ]

        for _ in range(25):
            evt = pick(eventos)
            row = {
                "evento_tipo": evt[0],
                "entidad_tipo": pick(["solicitud", "orden_compra", "envio", "material"]),
                "entidad_id": random.randint(1, 100),
                "severidad": evt[2],
                "titulo": f"{SEED_TAG} {evt[1]}",
                "descripcion": f"{SEED_TAG} {fake.sentence(nb_words=12)}",
                "categoria": evt[3],
                "leido": random.choice([0, 0, 1]),
                "created_at": rand_datetime(days_back=30),
            }
            try:
                self.insert_no_return("control_tower_event", row)
                count += 1
            except Exception:
                pass
        self.log(f"control_tower_event: {count} insertados")

    # ------------------------------------------------------------------
    # control_tower_kpi_snapshot  (~40 records)
    # ------------------------------------------------------------------
    def _seed_control_tower_kpi_snapshots(self):
        count = 0
        kpi_keys = [
            ("otif_pct", "procurement"),
            ("lead_time_avg", "logistics"),
            ("quality_defect_rate", "quality"),
            ("stock_turnover", "logistics"),
            ("cost_savings_pct", "finance"),
            ("supplier_risk_score", "procurement"),
        ]
        # 6 months of weekly snapshots
        for weeks_back in range(0, 24, 3):
            periodo = (datetime.now() - timedelta(weeks=weeks_back)).strftime('%Y-W%U')
            for kpi_key, cat in kpi_keys:
                base_vals = {
                    "otif_pct": 75 + random.uniform(-10, 15),
                    "lead_time_avg": 25 + random.uniform(-5, 10),
                    "quality_defect_rate": 2 + random.uniform(-1, 3),
                    "stock_turnover": 4 + random.uniform(-1, 2),
                    "cost_savings_pct": 8 + random.uniform(-3, 5),
                    "supplier_risk_score": 30 + random.uniform(-10, 20),
                }
                row = {
                    "periodo": periodo,
                    "kpi_key": kpi_key,
                    "valor": round(base_vals.get(kpi_key, 50), 2),
                    "categoria": cat,
                    "created_at": rand_datetime(days_back=weeks_back * 7 + 1),
                }
                try:
                    self.insert_no_return("control_tower_kpi_snapshot", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"control_tower_kpi_snapshot: {count} insertados")

    # ------------------------------------------------------------------
    # control_tower_alerta_agregada  (~10 records)
    # ------------------------------------------------------------------
    def _seed_control_tower_alertas(self):
        count = 0
        alertas = [
            ("sla_breach", "alta", "SLA vencidos en solicitudes", "procurement", 5),
            ("stock_critical", "critica", "Materiales bajo punto de reorden", "logistics", 12),
            ("quality_issue", "media", "NCRs abiertos sin resolución", "quality", 3),
            ("supplier_risk", "alta", "Proveedores con riesgo elevado", "procurement", 4),
            ("sla_breach", "media", "Entregas fuera de plazo", "logistics", 8),
            ("stock_critical", "baja", "Stock slow-moving detectado", "logistics", 15),
            ("quality_issue", "alta", "CAPAs vencidos", "quality", 2),
            ("supplier_risk", "critica", "Proveedor único sin backup", "procurement", 1),
            ("sla_breach", "media", "Aprobaciones pendientes", "procurement", 6),
            ("stock_critical", "alta", "Roturas de stock último mes", "logistics", 7),
        ]
        for tipo, prioridad, titulo, cat, cantidad in alertas:
            row = {
                "tipo": tipo,
                "prioridad": prioridad,
                "cantidad": cantidad,
                "titulo": f"{SEED_TAG} {titulo}",
                "categoria": cat,
                "ultima_ocurrencia": rand_datetime(days_back=7),
                "estado": pick(["active", "active", "acknowledged"]),
                "created_at": rand_datetime(days_back=14),
            }
            try:
                self.insert_no_return("control_tower_alerta_agregada", row)
                count += 1
            except Exception:
                pass
        self.log(f"control_tower_alerta_agregada: {count} insertados")

    # ------------------------------------------------------------------
    # plan_produccion_item + plan_produccion_material  (~20 each)
    # ------------------------------------------------------------------
    def _seed_plan_produccion_items(self):
        count_items = 0
        count_mat = 0

        # Get existing plan_produccion IDs
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT id FROM plan_produccion LIMIT 20")
            plan_ids = [r[0] for r in cursor.fetchall()]
        except Exception:
            plan_ids = []

        if not plan_ids:
            self.log("plan_produccion_item: 0 (no plan_produccion)")
            return

        # Get work_center IDs
        try:
            cursor.execute("SELECT id FROM work_center LIMIT 10")
            wc_ids = [r[0] for r in cursor.fetchall()]
        except Exception:
            wc_ids = []

        prioridades = ["baja", "media", "alta"]
        estados = ["pendiente", "en_proceso", "completado", "retrasado"]

        for plan_id in plan_ids:
            for _ in range(random.randint(2, 4)):
                mat = self.refs.rand_material()
                cant_plan = round(random.uniform(50, 500), 0)
                estado = pick(estados)
                cant_prod = round(cant_plan * random.uniform(0, 1), 0) if estado in ("en_proceso", "completado") else 0

                item_row = {
                    "plan_id": plan_id,
                    "material_codigo": mat,
                    "work_center_id": pick(wc_ids) if wc_ids else None,
                    "fecha_programada": rand_future_date(days_min=1, days_max=60),
                    "cantidad_planificada": cant_plan,
                    "cantidad_producida": cant_prod,
                    "prioridad": pick(prioridades),
                    "estado": estado,
                    "notas": f"{SEED_TAG} Item producción",
                    "created_at": rand_datetime(days_back=30),
                }
                try:
                    self.insert_no_return("plan_produccion_item", item_row)
                    count_items += 1
                except Exception:
                    pass

                # Corresponding material entry
                mat_row = {
                    "plan_id": plan_id,
                    "material_codigo": mat,
                    "work_center_id": pick(wc_ids) if wc_ids else None,
                    "fecha_programada": item_row["fecha_programada"],
                    "cantidad_planificada": cant_plan,
                    "cantidad_producida": cant_prod,
                    "prioridad": pick(prioridades),
                    "estado": estado,
                    "notas": f"{SEED_TAG} Material requerido",
                    "created_at": rand_datetime(days_back=30),
                }
                try:
                    self.insert_no_return("plan_produccion_material", mat_row)
                    count_mat += 1
                except Exception:
                    pass

        # plan_produccion_historial
        count_hist = 0
        for plan_id in plan_ids:
            for wc_id in (wc_ids[:3] if wc_ids else [None]):
                for days_back in [7, 14, 21]:
                    fecha = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
                    hist_row = {
                        "plan_id": plan_id,
                        "trabajo_centro_id": wc_id,
                        "fecha": fecha,
                        "capacidad_disponible": round(random.uniform(100, 500), 1),
                        "capacidad_utilizada": round(random.uniform(50, 400), 1),
                        "capacidad_comprometida": round(random.uniform(20, 200), 1),
                        "created_at": rand_datetime(days_back=days_back),
                    }
                    try:
                        self.insert_no_return("plan_produccion_historial", hist_row)
                        count_hist += 1
                    except Exception:
                        pass

        self.log(f"plan_produccion_item: {count_items} insertados")
        self.log(f"plan_produccion_material: {count_mat} insertados")
        self.log(f"plan_produccion_historial: {count_hist} insertados")

    # ------------------------------------------------------------------
    # plan_demanda_detalle + plan_demanda_consenso
    # ------------------------------------------------------------------
    def _seed_plan_demanda_detalle(self):
        count_det = 0
        count_con = 0

        # Get existing plan_demanda IDs
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT id FROM plan_demanda LIMIT 10")
            plan_ids = [r[0] for r in cursor.fetchall()]
        except Exception:
            plan_ids = []

        if not plan_ids:
            self.log("plan_demanda_detalle: 0 (no plan_demanda)")
            return

        fuentes = ["historico", "forecast_ml", "input_comercial", "input_planner"]

        for plan_id in plan_ids:
            mats = random.sample(self.refs.material_codes, min(5, len(self.refs.material_codes)))
            for mat in mats:
                cant = round(random.uniform(50, 1000), 0)
                # Detalle entry
                det_row = {
                    "plan_id": plan_id,
                    "material_codigo": mat,
                    "usuario_id": int(self.refs.rand_user()),
                    "fuente": pick(fuentes),
                    "cantidad_pronosticada": cant,
                    "confianza": round(random.uniform(0.5, 0.95), 2),
                    "notas": f"{SEED_TAG} Pronóstico demanda",
                    "created_at": rand_datetime(days_back=30),
                }
                try:
                    self.insert_no_return("plan_demanda_detalle", det_row)
                    count_det += 1
                except Exception:
                    pass

                # Consenso entry
                cant_ml = round(cant * random.uniform(0.85, 1.15), 0)
                cant_avg = round((cant + cant_ml) / 2, 0)
                con_row = {
                    "plan_id": plan_id,
                    "material_codigo": mat,
                    "cantidad_consenso": round(cant_avg * random.uniform(0.95, 1.05), 0),
                    "cantidad_ml_baseline": cant_ml,
                    "cantidad_promedio_entradas": cant_avg,
                    "ajuste_manual": round(random.uniform(-50, 50), 0),
                    "aprobado_por": int(self.refs.rand_admin()) if random.random() > 0.3 else None,
                    "created_at": rand_datetime(days_back=20),
                }
                try:
                    self.insert_no_return("plan_demanda_consenso", con_row)
                    count_con += 1
                except Exception:
                    pass

        self.log(f"plan_demanda_detalle: {count_det} insertados")
        self.log(f"plan_demanda_consenso: {count_con} insertados")

    # ------------------------------------------------------------------
    # foro_posts + foro_respuestas
    # ------------------------------------------------------------------
    def _seed_foro(self):
        count_posts = 0
        count_resp = 0

        posts_data = [
            ("general", "Bienvenidos al foro de Supply Chain",
             "Este es el espacio para compartir ideas, mejores prácticas y consultas sobre gestión de materiales."),
            ("procurement", "Mejores prácticas para evaluación de proveedores",
             "Comparto algunos criterios que hemos implementado para evaluar proveedores críticos: calidad, plazo de entrega, precio y flexibilidad."),
            ("logistics", "Optimización de rutas de transporte",
             "Hemos logrado reducir un 15% los costos de transporte implementando consolidación de envíos. ¿Alguien más ha tenido experiencia similar?"),
            ("quality", "Nuevo procedimiento de inspección de entrada",
             "Se implementó un nuevo protocolo de inspección por muestreo AQL 2.5. Favor revisar el documento adjunto."),
            ("planning", "Tips para mejorar precisión del forecast",
             "Después de 6 meses usando el modelo ML, compartimos algunos tips: 1) Limpiar outliers, 2) Considerar estacionalidad, 3) Ajustar manualmente eventos conocidos."),
        ]

        post_ids = []
        for cat, titulo, contenido in posts_data:
            user_id = self.refs.rand_user()
            row = {
                "autor_id": str(user_id),
                "autor_nombre": fake.name(),
                "titulo": f"{SEED_TAG} {titulo}",
                "contenido": f"{SEED_TAG} {contenido}",
                "categoria": cat,
                "likes": random.randint(0, 25),
                "created_at": rand_datetime(days_back=60),
            }
            try:
                pid = self.insert("foro_posts", row)
                if pid:
                    post_ids.append(pid)
                    count_posts += 1
            except Exception:
                pass

        # Respuestas
        respuestas = [
            "Excelente aporte, gracias por compartir!",
            "Totalmente de acuerdo. En nuestra planta también lo implementamos.",
            "Interesante perspectiva. ¿Podrías compartir más detalles?",
            "Nosotros tuvimos una experiencia similar el año pasado.",
            "Muy útil esta información. La voy a implementar.",
            "Gracias por el tip, me sirvió mucho.",
        ]
        for post_id in post_ids:
            num_resp = random.randint(1, 3)
            for _ in range(num_resp):
                row = {
                    "post_id": post_id,
                    "autor_id": str(self.refs.rand_user()),
                    "autor_nombre": fake.name(),
                    "contenido": f"{SEED_TAG} {pick(respuestas)}",
                    "created_at": rand_datetime(days_back=30),
                }
                try:
                    self.insert_no_return("foro_respuestas", row)
                    count_resp += 1
                except Exception:
                    pass

        self.log(f"foro_posts: {count_posts} insertados")
        self.log(f"foro_respuestas: {count_resp} insertados")

    # ------------------------------------------------------------------
    # trivia_questions + trivia_answers
    # ------------------------------------------------------------------
    def _seed_trivia(self):
        count_q = 0
        count_a = 0

        preguntas = [
            {
                "pregunta": "¿Qué significa OTIF en logística?",
                "opciones": ["On Time In Full", "Order Tracking Information Flow", "Optimal Transport Integration Framework", "Outbound Transfer Inspection Form"],
                "correcta": 0, "categoria": "logistics", "dificultad": "facil",
            },
            {
                "pregunta": "¿Cuál es el objetivo principal del análisis ABC de inventario?",
                "opciones": ["Clasificar items por valor de consumo", "Ordenar alfabéticamente", "Calcular costos de transporte", "Evaluar proveedores"],
                "correcta": 0, "categoria": "inventory", "dificultad": "facil",
            },
            {
                "pregunta": "¿Qué es un lead time en procurement?",
                "opciones": ["El tiempo total desde el pedido hasta la recepción", "El margen de ganancia", "El costo de almacenamiento", "La capacidad productiva"],
                "correcta": 0, "categoria": "procurement", "dificultad": "facil",
            },
            {
                "pregunta": "¿Qué representa el Scope 3 en emisiones de carbono?",
                "opciones": ["Emisiones indirectas de la cadena de valor", "Emisiones directas de la planta", "Emisiones de energía comprada", "Emisiones del transporte propio"],
                "correcta": 0, "categoria": "sustainability", "dificultad": "media",
            },
            {
                "pregunta": "¿Qué es la matriz de Kraljic?",
                "opciones": ["Herramienta para clasificar compras por riesgo e impacto", "Método de control de calidad", "Sistema de gestión de inventario", "Técnica de negociación"],
                "correcta": 0, "categoria": "procurement", "dificultad": "media",
            },
            {
                "pregunta": "¿Qué significa MRP?",
                "opciones": ["Material Requirements Planning", "Manufacturing Resource Protocol", "Market Research Planning", "Maintenance Repair Process"],
                "correcta": 0, "categoria": "planning", "dificultad": "facil",
            },
            {
                "pregunta": "¿Cuál es un beneficio del sistema Kanban?",
                "opciones": ["Reducir inventario en proceso", "Aumentar la burocracia", "Eliminar proveedores", "Aumentar stocks de seguridad"],
                "correcta": 0, "categoria": "planning", "dificultad": "media",
            },
            {
                "pregunta": "¿Qué es un NCR en gestión de calidad?",
                "opciones": ["Non-Conformance Report", "New Contract Request", "National Compliance Rule", "Net Cost Reduction"],
                "correcta": 0, "categoria": "quality", "dificultad": "facil",
            },
            {
                "pregunta": "¿Qué mide el KPI 'rotación de inventario'?",
                "opciones": ["Cuántas veces se renueva el stock en un período", "La velocidad del transporte", "El costo por unidad", "La satisfacción del cliente"],
                "correcta": 0, "categoria": "inventory", "dificultad": "media",
            },
            {
                "pregunta": "¿Qué es VMI (Vendor Managed Inventory)?",
                "opciones": ["El proveedor gestiona los niveles de stock del cliente", "Verificación de materiales importados", "Valoración de materias primas", "Variación del margen de inversión"],
                "correcta": 0, "categoria": "inventory", "dificultad": "dificil",
            },
        ]

        question_ids = []
        for q in preguntas:
            row = {
                "pregunta": f"{SEED_TAG} {q['pregunta']}",
                "opciones_json": json.dumps(q["opciones"]),
                "respuesta_correcta": q["correcta"],
                "categoria": q["categoria"],
                "dificultad": q["dificultad"],
                "activo": True,
                "created_at": rand_datetime(days_back=90),
            }
            try:
                qid = self.insert("trivia_questions", row)
                if qid:
                    question_ids.append(qid)
                    count_q += 1
            except Exception:
                pass

        # Some answers
        for qid in question_ids:
            for _ in range(random.randint(2, 5)):
                correcta = random.random() > 0.3
                row = {
                    "question_id": qid,
                    "user_id": str(self.refs.rand_user()),
                    "respuesta": 0 if correcta else random.randint(1, 3),
                    "correcta": correcta,
                    "tiempo_ms": random.randint(3000, 30000),
                    "created_at": rand_datetime(days_back=30),
                }
                try:
                    self.insert_no_return("trivia_answers", row)
                    count_a += 1
                except Exception:
                    pass

        self.log(f"trivia_questions: {count_q} insertados")
        self.log(f"trivia_answers: {count_a} insertados")

    def clean(self):
        cursor = self.conn.cursor()
        clean_map = {
            "trivia_answers": None,
            "trivia_questions": "pregunta",
            "foro_respuestas": "contenido",
            "foro_posts": "titulo",
            "plan_demanda_consenso": None,
            "plan_demanda_detalle": "notas",
            "plan_produccion_historial": None,
            "plan_produccion_material": "notas",
            "plan_produccion_item": "notas",
            "control_tower_alerta_agregada": "titulo",
            "control_tower_kpi_snapshot": None,
            "control_tower_event": "titulo",
            "kanban_historial": "notas",
            "kanban_senal": None,
            "kanban_tablero": "nombre",
            "cycle_count_item": None,
            "cycle_count_programa": "nombre",
            "meta_sostenibilidad": "nombre",
            "material_huella_carbono": "fuente_dato",
            "emision_carbono": "periodo",
            "consignment_reconciliacion": "periodo",
            "consignment_consumo": None,
            "consignment_stock": None,
            "consignment_programa": "nombre",
            "tipo_cambio": "fuente",
        }
        for table, col in clean_map.items():
            try:
                if col:
                    cursor.execute(
                        f"DELETE FROM {table} WHERE {col} LIKE ?",
                        (f"%{SEED_PREFIX}%",),
                    )
                else:
                    # For tables without identifiable SEED marker, skip
                    # (they'll be cleaned by parent table cascade or manually)
                    pass
                if cursor.rowcount and cursor.rowcount > 0:
                    self.log(f"Cleaned {cursor.rowcount} rows from {table}")
            except Exception as e:
                self.log(f"Warning cleaning {table}: {e}")
        self.conn.commit()
