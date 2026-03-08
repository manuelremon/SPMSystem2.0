"""
Seed Module 03: Quality
Inspecciones, NCR, CAPA, recalls.

Tablas:
- inspeccion_entrada
- inspeccion_item
- ncr
- ncr_historial
- capa
- capa_historial
- recall
- recall_lote
"""

import json
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

TIPOS_INSPECCION = ["recepcion", "proceso", "final", "auditoria", "periodica"]
RESULTADOS_INSPECCION = ["aprobado", "rechazado", "condicional"]
DEFECTOS = [
    "dimension fuera de rango",
    "superficie danada",
    "corrosion",
    "contaminacion",
    "etiquetado incorrecto",
    "cantidad incorrecta",
    "material incorrecto",
    "sin certificado",
    "vencido",
    "empaque deteriorado",
]

NCR_SEVERIDADES = ["baja", "media", "alta", "critica"]
NCR_ESTADOS = ["abierta", "en_investigacion", "accion_correctiva", "cerrada", "rechazada"]

CAPA_TIPOS = ["correctiva", "preventiva"]
CAPA_ESTADOS = ["draft", "open", "implementing", "verification", "closed", "cancelled"]

RECALL_SEVERIDADES = ["baja", "media", "alta", "critica"]
RECALL_TIPOS = ["voluntario", "mandatorio"]
RECALL_ESTADOS = ["initiated", "en_proceso", "completed", "cerrado"]
ESTADOS_RECUPERACION = ["pending", "identified", "retrieved", "disposed"]

# NCR state machine transitions (ordered by workflow)
NCR_TRANSITIONS = [
    ("abierta", "en_investigacion"),
    ("en_investigacion", "accion_correctiva"),
    ("accion_correctiva", "cerrada"),
    ("abierta", "rechazada"),
    ("en_investigacion", "cerrada"),
]

# CAPA state machine transitions
CAPA_TRANSITIONS = [
    ("draft", "open"),
    ("open", "implementing"),
    ("implementing", "verification"),
    ("verification", "closed"),
    ("open", "cancelled"),
    ("implementing", "cancelled"),
]


class QualitySeed(SeedModule):
    name = "quality"
    description = "Inspecciones, NCR, CAPA, recalls"
    tables = [
        "recall_lote",
        "recall",
        "capa_historial",
        "capa",
        "ncr_historial",
        "ncr",
        "inspeccion_item",
        "inspeccion_entrada",
    ]

    def seed(self):
        insp_ids = self._seed_inspeccion_entrada()
        self._seed_inspeccion_items(insp_ids)
        ncr_ids = self._seed_ncr(insp_ids)
        self._seed_ncr_historial(ncr_ids)
        capa_ids = self._seed_capa(ncr_ids)
        self._seed_capa_historial(capa_ids)
        recall_ids = self._seed_recall()
        self._seed_recall_lotes(recall_ids)

    # ------------------------------------------------------------------
    # inspeccion_entrada  (~30 records)
    # ------------------------------------------------------------------
    def _seed_inspeccion_entrada(self):
        insp_ids = []
        for i in range(1, 31):
            resultado = pick(RESULTADOS_INSPECCION)
            row = {
                "recepcion_id": None,
                "numero_inspeccion": seed_code("INSP", i),
                "tipo": pick(TIPOS_INSPECCION),
                "inspector_id": self.refs.rand_user(),
                "fecha": rand_past_date(days_min=1, days_max=180),
                "resultado": resultado,
                "notas": f"{fake.sentence(nb_words=10)}",
                "created_at": rand_datetime(days_back=180),
            }
            try:
                iid = self.insert("inspeccion_entrada", row)
                if iid:
                    insp_ids.append(iid)
            except Exception:
                pass

        self.log(f"inspeccion_entrada: {len(insp_ids)} insertados")
        return insp_ids

    # ------------------------------------------------------------------
    # inspeccion_item  (~100 records, 3-4 per inspection)
    # ------------------------------------------------------------------
    def _seed_inspeccion_items(self, insp_ids):
        count = 0
        for insp_id in insp_ids:
            num_items = random.randint(3, 4)
            for _ in range(num_items):
                cantidad_insp = round(random.uniform(1, 200), 2)
                # Aprobada must be <= inspeccionada
                cantidad_aprobada = round(cantidad_insp * random.uniform(0.0, 1.0), 2)
                cantidad_rechazada = round(cantidad_insp - cantidad_aprobada, 2)
                resultado = pick(RESULTADOS_INSPECCION)
                row = {
                    "inspeccion_id": insp_id,
                    "recepcion_item_id": None,
                    "cantidad_inspeccionada": cantidad_insp,
                    "cantidad_aprobada": cantidad_aprobada,
                    "cantidad_rechazada": cantidad_rechazada,
                    "resultado": resultado,
                    "defectos": pick(DEFECTOS) if resultado != "aprobado" else None,
                    "created_at": rand_datetime(days_back=180),
                }
                try:
                    self.insert_no_return("inspeccion_item", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"inspeccion_item: {count} insertados")

    # ------------------------------------------------------------------
    # ncr  (~25 records)
    # ------------------------------------------------------------------
    def _seed_ncr(self, insp_ids):
        ncr_ids = []
        for i in range(1, 26):
            estado = pick(NCR_ESTADOS)
            insp_id = pick(insp_ids) if insp_ids and random.random() > 0.3 else None
            fecha_resolucion = None
            accion_correctiva = None

            if estado == "cerrada":
                fecha_resolucion = rand_past_date(days_min=1, days_max=60)
                accion_correctiva = f"{fake.sentence(nb_words=12)}"

            row = {
                "numero_ncr": seed_code("NCR", i),
                "inspeccion_id": insp_id,
                "proveedor_cuit": self.refs.rand_proveedor(),
                "material_codigo": self.refs.rand_material(),
                "cantidad_afectada": round(random.uniform(1, 500), 2),
                "descripcion": f"{fake.paragraph(nb_sentences=2)}",
                "severidad": pick(NCR_SEVERIDADES),
                "estado": estado,
                "reportado_por": self.refs.rand_user(),
                "asignado_a": self.refs.rand_user(),
                "fecha_resolucion": fecha_resolucion,
                "accion_correctiva": accion_correctiva,
                "created_at": rand_datetime(days_back=180),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                nid = self.insert("ncr", row)
                if nid:
                    ncr_ids.append((nid, estado))
            except Exception:
                pass

        self.log(f"ncr: {len(ncr_ids)} insertados")
        return ncr_ids

    # ------------------------------------------------------------------
    # ncr_historial  (~80 records)
    # ------------------------------------------------------------------
    def _seed_ncr_historial(self, ncr_ids):
        count = 0
        for ncr_id, estado_final in ncr_ids:
            # Build a realistic forward transition chain ending at estado_final
            chain = self._build_ncr_chain(estado_final)
            for estado_anterior, estado_nuevo in chain:
                row = {
                    "ncr_id": ncr_id,
                    "estado_anterior": estado_anterior,
                    "estado_nuevo": estado_nuevo,
                    "actor_id": self.refs.rand_user(),
                    "notas": f"{fake.sentence(nb_words=7)}",
                    "created_at": rand_datetime(days_back=90),
                }
                try:
                    self.insert_no_return("ncr_historial", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"ncr_historial: {count} insertados")

    def _build_ncr_chain(self, estado_final):
        """Build a sequence of (prev, next) state pairs leading to estado_final."""
        full_path = ["abierta", "en_investigacion", "accion_correctiva", "cerrada"]
        if estado_final == "rechazada":
            full_path = ["abierta", "rechazada"]
        elif estado_final in full_path:
            idx = full_path.index(estado_final)
            full_path = full_path[: idx + 1]
        else:
            full_path = ["abierta"]

        chain = []
        for k in range(len(full_path) - 1):
            chain.append((full_path[k], full_path[k + 1]))
        return chain

    # ------------------------------------------------------------------
    # capa  (~15 records)
    # ------------------------------------------------------------------
    def _seed_capa(self, ncr_ids):
        capa_ids = []
        # Pick a subset of NCRs to associate CAPAs with
        target_ncrs = random.sample(ncr_ids, min(15, len(ncr_ids))) if ncr_ids else []

        for i, (ncr_id, _) in enumerate(target_ncrs, start=1):
            estado = pick(CAPA_ESTADOS)
            fecha_objetivo = rand_future_date(days_min=10, days_max=180)
            fecha_implementacion = None
            fecha_verificacion = None
            accion_implementada = None
            efectividad = None

            if estado in ("verification", "closed"):
                fecha_implementacion = rand_past_date(days_min=1, days_max=60)
                accion_implementada = f"{fake.sentence(nb_words=14)}"
            if estado == "closed":
                fecha_verificacion = rand_past_date(days_min=1, days_max=30)
                efectividad = random.randint(1, 5)

            row = {
                "numero_capa": seed_code("CAPA", i),
                "ncr_id": ncr_id,
                "tipo": pick(CAPA_TIPOS),
                "titulo": f"{fake.catch_phrase()}",
                "descripcion": f"{fake.sentence(nb_words=10)}",
                "descripcion_problema": f"{fake.paragraph(nb_sentences=2)}",
                "accion_propuesta": f"{fake.sentence(nb_words=15)}",
                "accion_implementada": accion_implementada,
                "responsable_id": self.refs.rand_user(),
                "verificador_id": self.refs.rand_admin(),
                "fecha_objetivo": fecha_objetivo,
                "fecha_implementacion": fecha_implementacion,
                "fecha_verificacion": fecha_verificacion,
                "estado": estado,
                "efectividad": efectividad,
                "created_at": rand_datetime(days_back=180),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                cid = self.insert("capa", row)
                if cid:
                    capa_ids.append((cid, estado))
            except Exception:
                pass

        self.log(f"capa: {len(capa_ids)} insertados")
        return capa_ids

    # ------------------------------------------------------------------
    # capa_historial  (~50 records)
    # ------------------------------------------------------------------
    def _seed_capa_historial(self, capa_ids):
        count = 0
        for capa_id, estado_final in capa_ids:
            chain = self._build_capa_chain(estado_final)
            for estado_anterior, estado_nuevo in chain:
                row = {
                    "capa_id": capa_id,
                    "estado_anterior": estado_anterior,
                    "estado_nuevo": estado_nuevo,
                    "actor_id": self.refs.rand_user(),
                    "notas": f"{fake.sentence(nb_words=8)}",
                    "created_at": rand_datetime(days_back=90),
                }
                try:
                    self.insert_no_return("capa_historial", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"capa_historial: {count} insertados")

    def _build_capa_chain(self, estado_final):
        """Build a sequence of (prev, next) state pairs leading to estado_final."""
        full_path = ["draft", "open", "implementing", "verification", "closed"]
        if estado_final == "cancelled":
            # Cancelled from a random point in the path
            cut = random.randint(1, 3)
            full_path = full_path[:cut] + ["cancelled"]
        elif estado_final in full_path:
            idx = full_path.index(estado_final)
            full_path = full_path[: idx + 1]
        else:
            full_path = ["draft"]

        chain = []
        for k in range(len(full_path) - 1):
            chain.append((full_path[k], full_path[k + 1]))
        return chain

    # ------------------------------------------------------------------
    # recall  (~5 records)
    # ------------------------------------------------------------------
    def _seed_recall(self):
        recall_ids = []
        for i in range(1, 6):
            estado = pick(RECALL_ESTADOS)
            fecha_cierre = None
            if estado == "cerrado":
                fecha_cierre = rand_past_date(days_min=1, days_max=60)

            # Build JSON list of affected lot identifiers
            num_lotes = random.randint(2, 5)
            lotes_afectados = [f"LOTE-{random.randint(10000, 99999)}" for _ in range(num_lotes)]

            row = {
                "numero_recall": seed_code("RECALL", i),
                "titulo": f"{fake.catch_phrase()}",
                "descripcion": f"{fake.paragraph(nb_sentences=2)}",
                "severidad": pick(RECALL_SEVERIDADES),
                "tipo": pick(RECALL_TIPOS),
                "material_codigo": self.refs.rand_material(),
                "proveedor_cuit": self.refs.rand_proveedor(),
                "lotes_afectados": json.dumps(lotes_afectados),
                "cantidad_afectada": round(random.uniform(10, 5000), 2),
                "fecha_inicio": rand_past_date(days_min=10, days_max=120),
                "fecha_cierre": fecha_cierre,
                "estado": estado,
                "responsable_id": self.refs.rand_admin(),
                "accion_requerida": f"{fake.paragraph(nb_sentences=3)}",
                "created_at": rand_datetime(days_back=180),
            }
            try:
                rid = self.insert("recall", row)
                if rid:
                    recall_ids.append(rid)
            except Exception:
                pass

        self.log(f"recall: {len(recall_ids)} insertados")
        return recall_ids

    # ------------------------------------------------------------------
    # recall_lote  (~15 records, 3 per recall)
    # ------------------------------------------------------------------
    def _seed_recall_lotes(self, recall_ids):
        # Get real lote IDs for assignment
        cursor = self.conn.cursor()
        cursor.execute("SELECT id FROM lote ORDER BY id")
        lote_ids = [r[0] for r in cursor.fetchall()]

        count = 0
        lote_idx = 0
        for recall_id in recall_ids:
            for _ in range(3):
                estado_recuperacion = pick(ESTADOS_RECUPERACION)
                fecha_recuperacion = None
                if estado_recuperacion == "recuperado":
                    fecha_recuperacion = rand_past_date(days_min=1, days_max=45)

                assigned_lote_id = lote_ids[lote_idx % len(lote_ids)] if lote_ids else None
                lote_idx += 1

                row = {
                    "recall_id": recall_id,
                    "lote_id": assigned_lote_id,
                    "cantidad_afectada": round(random.uniform(1, 1000), 2),
                    "ubicacion_actual": f"{self.refs.rand_centro()} / {self.refs.rand_almacen()}",
                    "estado_recuperacion": estado_recuperacion,
                    "fecha_recuperacion": fecha_recuperacion,
                    "created_at": rand_datetime(days_back=90),
                }
                try:
                    self.insert_no_return("recall_lote", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"recall_lote: {count} insertados")

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
