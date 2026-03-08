"""
Seed Module 13: Returns & Warranty
Devoluciones, garantías, reclamos de garantía.

Tablas reales en PG:
- devolucion (numero_rma, tipo, proveedor_cuit, motivo, estado, monto_credito_esperado/recibido, creado_por)
- devolucion_item (devolucion_id, material_codigo, cantidad, motivo_detalle)
- devolucion_historial (devolucion_id, estado_anterior, estado_nuevo, actor_id, notas)
- garantia (material_codigo, proveedor_cuit, tipo, duracion_meses, fecha_inicio, fecha_fin, condiciones, estado)
- reclamo_garantia (garantia_id, tipo, descripcion, estado, reportado_por, asignado_a, resolucion)
- garantia_historial (garantia_id, tipo, descripcion, cantidad_afectada, costo_estimado, estado, resolucion, monto_recuperado, responsable_id)
- garantia_reclamo (garantia_historial_id, nombre, path, tipo) - docs for claims
- recall, recall_lote, recall_accion
"""

import random

from ._base import (
    SEED_PREFIX,
    SeedModule,
    fake,
    now_str,
    pick,
    rand_datetime,
    rand_future_date,
    rand_money,
    rand_past_date,
    seed_code,
)

DEVOLUCION_TIPOS = ["devolucion", "reclamo", "cambio"]
DEVOLUCION_ESTADOS = [
    "borrador", "aprobada", "en_proceso", "enviada", "credito_recibido", "cancelada",
]

GARANTIA_TIPOS = ["fabricante", "proveedor", "extendida"]
GARANTIA_DURACIONES = [6, 12, 24, 36]

RECLAMO_TIPOS = ["defecto", "rendimiento", "incumplimiento"]
RECLAMO_ESTADOS = ["abierto", "en_evaluacion", "aprobado", "rechazado", "resuelto"]

MOTIVOS_DEVOLUCION = [
    "Producto defectuoso al recibir",
    "Cantidad incorrecta entregada",
    "Material no corresponde a OC",
    "Empaque dañado en tránsito",
    "Fecha de vencimiento vencida",
    "Dimensiones fuera de especificación",
]


def _devolucion_transition_chain(estado_final):
    full_path = ["borrador", "aprobada", "en_proceso", "enviada", "credito_recibido"]
    if estado_final == "cancelada":
        cut = random.randint(1, 2)
        path = full_path[:cut] + ["cancelada"]
    elif estado_final in full_path:
        idx = full_path.index(estado_final)
        path = full_path[:idx + 1]
    else:
        path = ["borrador"]
    return [(path[k], path[k + 1]) for k in range(len(path) - 1)]


class ReturnsWarrantySeed(SeedModule):
    name = "returns"
    description = "Devoluciones, garantías, reclamos"
    tables = [
        "garantia_reclamo",
        "garantia_historial",
        "reclamo_garantia",
        "garantia",
        "recall_accion",
        "recall_lote",
        "recall",
        "devolucion_historial",
        "devolucion_item",
        "devolucion",
    ]

    def seed(self):
        dev_ids = self._seed_devoluciones()
        self._seed_devolucion_items(dev_ids)
        self._seed_devolucion_historial(dev_ids)
        garantia_ids = self._seed_garantias()
        reclamo_ids = self._seed_reclamos(garantia_ids)
        hist_ids = self._seed_garantia_historial(garantia_ids)
        self._seed_garantia_reclamo_docs(hist_ids)
        recall_ids = self._seed_recalls()
        self._seed_recall_lotes(recall_ids)
        self._seed_recall_acciones(recall_ids)

    # ------------------------------------------------------------------
    # devolucion  (~15 records)
    # ------------------------------------------------------------------
    def _seed_devoluciones(self):
        dev_ids = []
        for i in range(1, 16):
            estado = pick(DEVOLUCION_ESTADOS)
            monto_esperado = rand_money(500, 80000)
            monto_recibido = None
            if estado == "credito_recibido":
                monto_recibido = round(monto_esperado * random.uniform(0.80, 1.0), 2)

            row = {
                "numero_rma": seed_code("RMA", i),
                "tipo": pick(DEVOLUCION_TIPOS),
                "orden_compra_id": None,
                "ncr_id": None,
                "proveedor_cuit": self.refs.rand_proveedor(),
                "motivo": f"{pick(MOTIVOS_DEVOLUCION)}",
                "estado": estado,
                "monto_credito_esperado": monto_esperado,
                "monto_credito_recibido": monto_recibido,
                "creado_por": self.refs.rand_user(),
                "created_at": rand_datetime(days_back=270),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                did = self.insert("devolucion", row)
                if did:
                    dev_ids.append((did, estado))
            except Exception:
                pass

        self.log(f"devolucion: {len(dev_ids)} insertados")
        return dev_ids

    # ------------------------------------------------------------------
    # devolucion_item  (~40 records)
    # ------------------------------------------------------------------
    def _seed_devolucion_items(self, dev_ids):
        count = 0
        for dev_id, _ in dev_ids:
            for _ in range(random.randint(2, 3)):
                row = {
                    "devolucion_id": dev_id,
                    "material_codigo": self.refs.rand_material(),
                    "cantidad": round(random.uniform(1, 200), 2),
                    "motivo_detalle": f"{fake.sentence(nb_words=10)}",
                }
                try:
                    self.insert_no_return("devolucion_item", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"devolucion_item: {count} insertados")

    # ------------------------------------------------------------------
    # devolucion_historial  (~45 records)
    # ------------------------------------------------------------------
    def _seed_devolucion_historial(self, dev_ids):
        count = 0
        for dev_id, estado_final in dev_ids:
            chain = _devolucion_transition_chain(estado_final)
            for step, (estado_anterior, estado_nuevo) in enumerate(chain):
                row = {
                    "devolucion_id": dev_id,
                    "estado_anterior": estado_anterior,
                    "estado_nuevo": estado_nuevo,
                    "actor_id": self.refs.rand_user(),
                    "notas": f"{fake.sentence(nb_words=8)}",
                    "created_at": rand_datetime(days_back=180 - step * 10),
                }
                try:
                    self.insert_no_return("devolucion_historial", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"devolucion_historial: {count} insertados")

    # ------------------------------------------------------------------
    # garantia  (~15 records)
    # ------------------------------------------------------------------
    def _seed_garantias(self):
        garantia_ids = []
        for i in range(1, 16):
            duracion = pick(GARANTIA_DURACIONES)
            fecha_inicio = rand_past_date(days_min=30, days_max=365)

            from datetime import datetime, timedelta
            fi = datetime.strptime(fecha_inicio, "%Y-%m-%d")
            ff = fi + timedelta(days=duracion * 30)
            fecha_fin = ff.strftime("%Y-%m-%d")

            now = datetime.now()
            estado = pick(["vencida", "reclamada"]) if ff < now else pick(["activa", "reclamada"])

            row = {
                "material_codigo": self.refs.rand_material(),
                "proveedor_cuit": self.refs.rand_proveedor(),
                "lote_id": None,
                "orden_compra_id": None,
                "tipo": pick(GARANTIA_TIPOS),
                "duracion_meses": duracion,
                "fecha_inicio": fecha_inicio,
                "fecha_fin": fecha_fin,
                "condiciones": f"{fake.paragraph(nb_sentences=2)}",
                "estado": estado,
                "created_at": rand_datetime(days_back=400),
            }
            try:
                gid = self.insert("garantia", row)
                if gid:
                    garantia_ids.append(gid)
            except Exception:
                pass

        self.log(f"garantia: {len(garantia_ids)} insertados")
        return garantia_ids

    # ------------------------------------------------------------------
    # reclamo_garantia  (~10 records)
    # Cols: garantia_id, tipo, descripcion, estado, reportado_por, asignado_a, resolucion
    # ------------------------------------------------------------------
    def _seed_reclamos(self, garantia_ids):
        reclamo_ids = []
        garantia_pool = garantia_ids if garantia_ids else [1]

        for i in range(1, 11):
            estado = pick(RECLAMO_ESTADOS)
            resolucion = None
            if estado in ("aprobado", "resuelto", "rechazado"):
                resolucion = f"{fake.sentence(nb_words=12)}"

            row = {
                "garantia_id": pick(garantia_pool),
                "tipo": pick(RECLAMO_TIPOS),
                "descripcion": f"{fake.paragraph(nb_sentences=2)}",
                "estado": estado,
                "reportado_por": random.randint(1, 121),
                "asignado_a": random.randint(1, 121),
                "resolucion": resolucion,
                "created_at": rand_datetime(days_back=200),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                rid = self.insert("reclamo_garantia", row)
                if rid:
                    reclamo_ids.append(rid)
            except Exception:
                pass

        self.log(f"reclamo_garantia: {len(reclamo_ids)} insertados")
        return reclamo_ids

    # ------------------------------------------------------------------
    # garantia_historial  (~20 records)
    # Cols: garantia_id, tipo, descripcion, cantidad_afectada, costo_estimado,
    #       estado, resolucion, monto_recuperado, responsable_id, fecha_resolucion
    # ------------------------------------------------------------------
    def _seed_garantia_historial(self, garantia_ids):
        hist_ids = []
        garantia_pool = garantia_ids if garantia_ids else [1]

        for i in range(1, 21):
            estado = pick(RECLAMO_ESTADOS)
            resolucion = None
            monto_recuperado = None
            fecha_resolucion = None
            if estado in ("aprobado", "resuelto"):
                resolucion = f"{fake.sentence(nb_words=10)}"
                monto_recuperado = rand_money(100, 50000)
            if estado == "resuelto":
                fecha_resolucion = rand_past_date(days_min=1, days_max=60)

            row = {
                "garantia_id": pick(garantia_pool),
                "tipo": pick(RECLAMO_TIPOS),
                "descripcion": f"{fake.paragraph(nb_sentences=1)}",
                "cantidad_afectada": round(random.uniform(1, 200), 2),
                "costo_estimado": rand_money(1000, 80000),
                "estado": estado,
                "resolucion": resolucion,
                "monto_recuperado": monto_recuperado,
                "responsable_id": random.randint(1, 121),
                "fecha_resolucion": fecha_resolucion,
                "created_at": rand_datetime(days_back=200),
            }
            try:
                hid = self.insert("garantia_historial", row)
                if hid:
                    hist_ids.append(hid)
            except Exception:
                pass

        self.log(f"garantia_historial: {len(hist_ids)} insertados")
        return hist_ids

    # ------------------------------------------------------------------
    # garantia_reclamo  (~15 records) - docs for warranty claims
    # Cols: garantia_historial_id, nombre, path, tipo
    # ------------------------------------------------------------------
    def _seed_garantia_reclamo_docs(self, hist_ids):
        count = 0
        doc_tipos = ["foto", "informe", "certificado"]
        hist_pool = hist_ids if hist_ids else [1]

        for i in range(1, 16):
            tipo = pick(doc_tipos)
            ext = "jpg" if tipo == "foto" else "pdf"
            row = {
                "garantia_historial_id": pick(hist_pool),
                "nombre": f"{SEED_PREFIX}garantia_{tipo}_{i:04d}.{ext}",
                "path": "/uploads/garantia/",
                "tipo": tipo,
                "created_at": rand_datetime(days_back=90),
            }
            try:
                self.insert_no_return("garantia_reclamo", row)
                count += 1
            except Exception:
                pass

        self.log(f"garantia_reclamo: {count} insertados")

    # ------------------------------------------------------------------
    # recall  (~5 records)
    # Cols: numero_recall, titulo, descripcion, tipo, severidad, estado,
    #       material_codigo, proveedor_cuit, lotes_afectados, cantidad_afectada,
    #       responsable_id, fecha_inicio, fecha_cierre, accion_requerida
    # ------------------------------------------------------------------
    def _seed_recalls(self):
        import json
        recall_ids = []
        severidades = ["baja", "media", "alta"]
        tipos = ["voluntario", "mandatorio"]
        estados = ["draft", "activo", "en_proceso", "cerrado"]

        for i in range(1, 6):
            estado = pick(estados)
            lotes = [f"LOT-{random.randint(1000,9999)}" for _ in range(3)]
            row = {
                "numero_recall": seed_code("RECALL", i),
                "titulo": f"Recall {fake.catch_phrase()}",
                "descripcion": f"{fake.paragraph(nb_sentences=2)}",
                "tipo": pick(tipos),
                "severidad": pick(severidades),
                "estado": estado,
                "material_codigo": self.refs.rand_material(),
                "proveedor_cuit": self.refs.rand_proveedor(),
                "lotes_afectados": json.dumps(lotes),
                "cantidad_afectada": round(random.uniform(10, 5000), 2),
                "responsable_id": random.randint(1, 121),
                "fecha_inicio": rand_past_date(days_min=10, days_max=180),
                "fecha_cierre": rand_past_date(days_min=1, days_max=30) if estado == "cerrado" else None,
                "accion_requerida": f"{fake.sentence(nb_words=12)}",
                "created_at": rand_datetime(days_back=200),
                "updated_at": rand_datetime(days_back=30),
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
        count = 0
        for rid in recall_ids:
            for _ in range(3):
                row = {
                    "recall_id": rid,
                    "lote_id": None,
                    "cantidad_afectada": round(random.uniform(10, 1000), 2),
                    "ubicacion_actual": f"{fake.city()}, {fake.province()}",
                    "estado_recuperacion": pick(["pendiente", "en_proceso", "recuperado"]),
                    "fecha_recuperacion": rand_past_date(days_min=1, days_max=30) if random.random() > 0.5 else None,
                    "created_at": rand_datetime(days_back=120),
                }
                try:
                    self.insert_no_return("recall_lote", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"recall_lote: {count} insertados")

    # ------------------------------------------------------------------
    # recall_accion  (~10 records, 2 per recall)
    # Cols: recall_id, tipo, descripcion, responsable_id, estado, fecha_completado
    # ------------------------------------------------------------------
    def _seed_recall_acciones(self, recall_ids):
        count = 0
        tipos_accion = ["retiro", "notificacion", "reemplazo", "inspeccion", "contencion"]
        for rid in recall_ids:
            for _ in range(2):
                estado = pick(["pendiente", "en_proceso", "completado"])
                row = {
                    "recall_id": rid,
                    "tipo": pick(tipos_accion),
                    "descripcion": f"{fake.sentence(nb_words=10)}",
                    "responsable_id": random.randint(1, 121),
                    "estado": estado,
                    "fecha_completado": rand_past_date(days_min=1, days_max=30) if estado == "completado" else None,
                    "created_at": rand_datetime(days_back=120),
                }
                try:
                    self.insert_no_return("recall_accion", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"recall_accion: {count} insertados")

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
