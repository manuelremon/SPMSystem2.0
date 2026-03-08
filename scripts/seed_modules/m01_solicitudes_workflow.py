"""
Seed Module 01: Solicitudes Workflow
Historial de estados, tratamientos y decisiones de abastecimiento.

Tablas:
- solicitud_items_tratamiento
- solicitud_tratamiento_eventos
- solicitud_tratamiento_log
- decision_abastecimiento
- decision_abastecimiento_fuentes
- notificaciones
"""

import json
import random

from ._base import (
    SeedModule,
    fake,
    now_str,
    pick,
    rand_datetime,
    rand_money,
    rand_pct,
)

DECISIONES = ["Aprobar", "Rechazar", "Equivalencia", "Transferencia", "Compra directa"]
TIPOS_EVENTOS = [
    "inicio_tratamiento",
    "decision_item",
    "consulta_stock",
    "solicitud_cotizacion",
    "finalizacion",
    "revision",
    "escalacion",
]
TIPOS_EQUIVALENCIA = ["E0_DUPLICADO", "E1_ESTRICTA", "E2_SUPLIBLE"]
TIPOS_FUENTE = ["stock", "transferencia", "proveedor", "equivalencia"]
TIPOS_NOTIFICACION = ["info", "warning", "success"]

ESTADOS_DECISION = ["pendiente", "parcial", "completo", "confirmado"]
ESTADOS_LOG = ["iniciado", "en_proceso", "completado", "pausado", "rechazado"]
TIPOS_LOG = ["decision", "consulta", "escalacion", "validacion", "observacion"]


class SolicitudesWorkflowSeed(SeedModule):
    name = "solicitudes"
    description = "Historial estados, tratamientos, decisiones"
    tables = [
        "notificaciones",
        "decision_abastecimiento_fuentes",
        "decision_abastecimiento",
        "solicitud_tratamiento_log",
        "solicitud_tratamiento_eventos",
        "solicitud_items_tratamiento",
    ]

    def seed(self):
        # Combine approved + processing solicitudes as the target set
        target_ids = list(self.refs.solicitud_approved_ids) + list(
            self.refs.solicitud_processing_ids
        )
        if not target_ids:
            self.log("No approved/processing solicitudes found, using all")
            target_ids = list(self.refs.solicitud_ids[:30])

        # Deduplicate while preserving order
        seen = set()
        unique_targets = []
        for sid in target_ids:
            if sid not in seen:
                seen.add(sid)
                unique_targets.append(sid)
        target_ids = unique_targets[:50]

        self._seed_items_tratamiento(target_ids)
        self._seed_tratamiento_eventos(target_ids)
        self._seed_tratamiento_log(target_ids)
        decision_ids = self._seed_decision_abastecimiento(target_ids)
        self._seed_decision_fuentes(decision_ids)
        self._seed_notificacioneses(target_ids)

    # ------------------------------------------------------------------
    # solicitud_items_tratamiento  (~200 records)
    # ------------------------------------------------------------------
    def _seed_items_tratamiento(self, solicitud_ids):
        count = 0
        for solicitud_id in solicitud_ids:
            num_items = random.randint(1, 5)
            for item_idx in range(num_items):
                decision = pick(DECISIONES)
                cantidad_aprobada = round(random.uniform(1, 100), 2)
                codigo_equiv = None
                proveedor_sug = None
                precio_est = None

                if decision == "Equivalencia":
                    codigo_equiv = self.refs.rand_material()
                elif decision in ("Aprobar", "Compra directa"):
                    proveedor_sug = self.refs.rand_proveedor()
                    precio_est = rand_money(500, 25000)

                row = {
                    "solicitud_id": solicitud_id,
                    "item_index": item_idx,
                    "decision": decision,
                    "cantidad_aprobada": cantidad_aprobada,
                    "codigo_equivalente": codigo_equiv,
                    "proveedor_sugerido": proveedor_sug,
                    "precio_unitario_estimado": precio_est,
                    "comentario": f"{fake.sentence(nb_words=8)}",
                    "updated_by": self.refs.rand_planner(),
                    "updated_at": rand_datetime(days_back=90),
                }
                try:
                    self.insert_no_return("solicitud_items_tratamiento", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"solicitud_items_tratamiento: {count} insertados")

    # ------------------------------------------------------------------
    # solicitud_tratamiento_eventos  (~500 records)
    # ------------------------------------------------------------------
    def _seed_tratamiento_eventos(self, solicitud_ids):
        count = 0
        for solicitud_id in solicitud_ids:
            num_events = random.randint(3, 12)
            for _ in range(num_events):
                tipo = pick(TIPOS_EVENTOS)
                payload = {
                    "tipo": tipo,
                    "solicitud_id": solicitud_id,
                    "item_index": random.randint(0, 4),
                    "decision": pick(DECISIONES),
                    "nota": f"{fake.sentence(nb_words=6)}",
                }
                row = {
                    "solicitud_id": solicitud_id,
                    "planner_id": self.refs.rand_planner(),
                    "tipo": tipo,
                    "payload_json": json.dumps(payload),
                    "created_at": rand_datetime(days_back=90),
                }
                try:
                    self.insert_no_return("solicitud_tratamiento_eventos", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"solicitud_tratamiento_eventos: {count} insertados")

    # ------------------------------------------------------------------
    # solicitud_tratamiento_log  (~800 records)
    # ------------------------------------------------------------------
    def _seed_tratamiento_log(self, solicitud_ids):
        count = 0
        for solicitud_id in solicitud_ids:
            num_logs = random.randint(5, 20)
            for _ in range(num_logs):
                item_idx = random.randint(0, 4)
                tipo = pick(TIPOS_LOG)
                estado = pick(ESTADOS_LOG)
                payload = {
                    "tipo": tipo,
                    "item_index": item_idx,
                    "valor_anterior": fake.word(),
                    "valor_nuevo": fake.word(),
                    "nota": f"{fake.sentence(nb_words=5)}",
                }
                row = {
                    "solicitud_id": solicitud_id,
                    "item_index": item_idx,
                    "actor_id": self.refs.rand_planner(),
                    "tipo": tipo,
                    "estado": estado,
                    "payload_json": json.dumps(payload),
                    "created_at": rand_datetime(days_back=90),
                }
                try:
                    self.insert_no_return("solicitud_tratamiento_log", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"solicitud_tratamiento_log: {count} insertados")

    # ------------------------------------------------------------------
    # decision_abastecimiento  (~100 records)
    # ------------------------------------------------------------------
    def _seed_decision_abastecimiento(self, solicitud_ids):
        decision_ids = []
        count = 0
        target = solicitud_ids[:40]
        for solicitud_id in target:
            num_items = random.randint(1, 4)
            for item_idx in range(num_items):
                cantidad_sol = round(random.uniform(5, 500), 2)
                cantidad_asig = round(cantidad_sol * random.uniform(0.5, 1.0), 2)
                estado = pick(ESTADOS_DECISION)

                row = {
                    "solicitud_id": solicitud_id,
                    "item_index": item_idx,
                    "cantidad_solicitada": cantidad_sol,
                    "cantidad_total_asignada": cantidad_asig,
                    "estado": estado,
                    "comentario": f"{fake.sentence(nb_words=7)}",
                    "planner_id": self.refs.rand_planner(),
                    "created_at": rand_datetime(days_back=60),
                    "updated_at": rand_datetime(days_back=30),
                }
                try:
                    did = self.insert("decision_abastecimiento", row)
                    if did:
                        decision_ids.append(did)
                    count += 1
                except Exception:
                    pass
        self.log(f"decision_abastecimiento: {count} insertados")
        return decision_ids

    # ------------------------------------------------------------------
    # decision_abastecimiento_fuentes  (~300 records)
    # ------------------------------------------------------------------
    def _seed_decision_fuentes(self, decision_ids):
        if not decision_ids:
            self.log("No decision_ids disponibles para fuentes")
            return

        count = 0
        for decision_id in decision_ids:
            num_fuentes = random.randint(1, 4)
            for orden in range(1, num_fuentes + 1):
                tipo_fuente = pick(TIPOS_FUENTE)
                centro_origen = None
                almacen_origen = None
                cuit_prov = None
                prov_nombre = None
                cod_equiv = None
                tipo_equiv = None

                if tipo_fuente in ("stock", "transferencia"):
                    centro_origen = self.refs.rand_centro()
                    almacen_origen = self.refs.rand_almacen()
                elif tipo_fuente == "proveedor":
                    cuit_prov = self.refs.rand_proveedor()
                    prov_nombre = fake.company()
                elif tipo_fuente == "equivalencia":
                    cod_equiv = self.refs.rand_material()
                    tipo_equiv = pick(TIPOS_EQUIVALENCIA)

                cantidad_asig = round(random.uniform(1, 200), 2)
                precio_unit = rand_money(100, 15000) if tipo_fuente == "proveedor" else None

                row = {
                    "decision_id": decision_id,
                    "tipo_fuente": tipo_fuente,
                    "centro_origen": centro_origen,
                    "almacen_origen": almacen_origen,
                    "cuit_proveedor": cuit_prov,
                    "proveedor_nombre": prov_nombre,
                    "codigo_material_equiv": cod_equiv,
                    "tipo_equivalencia": tipo_equiv,
                    "cantidad_asignada": cantidad_asig,
                    "precio_unitario": precio_unit,
                    "precio_es_negociado": random.randint(0, 1),
                    "plazo_dias": random.randint(1, 60) if tipo_fuente == "proveedor" else None,
                    "score_opcion": round(rand_pct(50, 100), 1),
                    "orden_prioridad": orden,
                    "notas": f"{fake.sentence(nb_words=5)}",
                    "created_at": rand_datetime(days_back=30),
                }
                try:
                    self.insert_no_return("decision_abastecimiento_fuentes", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"decision_abastecimiento_fuentes: {count} insertados")

    # ------------------------------------------------------------------
    # notificaciones  (~500 records)
    # ------------------------------------------------------------------
    def _seed_notificacioneses(self, solicitud_ids):
        count = 0
        # Generate roughly 10 notifications per solicitud
        for solicitud_id in solicitud_ids:
            num_notifs = random.randint(5, 15)
            for _ in range(num_notifs):
                tipo = pick(TIPOS_NOTIFICACION)
                leido = random.randint(0, 1)
                destinatario = self.refs.rand_user()

                mensaje_templates = [
                    f"Su solicitud #{solicitud_id} fue actualizada.",
                    f"Hay una decision pendiente en la solicitud #{solicitud_id}.",
                    f"El tratamiento de la solicitud #{solicitud_id} fue completado.",
                    f"Se requiere su aprobacion en la solicitud #{solicitud_id}.",
                    f"{fake.sentence(nb_words=10)}",
                ]
                row = {
                    "destinatario_id": destinatario,
                    "solicitud_id": solicitud_id,
                    "mensaje": pick(mensaje_templates),
                    "leido": leido,
                    "tipo": tipo,
                    "created_at": rand_datetime(days_back=90),
                }
                try:
                    self.insert_no_return("notificaciones", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"notificaciones: {count} insertados")

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
