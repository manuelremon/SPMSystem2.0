"""
Seed Module 07: Contracts
Contratos con proveedores, items, documentos adjuntos, alertas e historial.

Tablas:
- contrato
- contrato_item
- contrato_documento
- contrato_historial
"""

import random

from ._base import (
    MONEDAS,
    SEED_PREFIX,
    SEED_TAG,
    UNIDADES,
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

CONTRATO_TIPOS = ["marco", "orden_abierta", "servicio", "suministro"]

CONTRATO_ESTADOS = ["borrador", "activo", "vencido", "cancelado", "renovado"]

# State transitions that are valid for the historial
ESTADO_TRANSITIONS = [
    ("borrador", "activo"),
    ("activo", "vencido"),
    ("activo", "cancelado"),
    ("activo", "renovado"),
    ("vencido", "renovado"),
    ("borrador", "cancelado"),
]

DOCUMENTO_TIPOS = ["contrato", "anexo", "addendum", "certificado"]


class ContractsSeed(SeedModule):
    name = "contracts"
    description = "Contratos, items, documentos, alertas"
    tables = [
        "contrato_historial",
        "contrato_documento",
        "contrato_item",
        "contrato",
    ]

    def seed(self):
        contrato_ids = self._seed_contratos()
        self._seed_contrato_items(contrato_ids)
        self._seed_contrato_documentos(contrato_ids)
        self._seed_contrato_historial(contrato_ids)

    # ------------------------------------------------------------------
    # contrato  (~20 records)
    # ------------------------------------------------------------------
    def _seed_contratos(self):
        contrato_ids = []

        for i in range(1, 21):
            estado = pick(CONTRATO_ESTADOS)
            cuit = self.refs.rand_proveedor()
            centro = self.refs.rand_centro()
            creado_por = self.refs.rand_user()
            aprobado_por = None

            # Contracts past borrador have an approver
            if estado != "borrador":
                aprobado_por = self.refs.rand_admin()

            fecha_inicio = rand_past_date(days_min=30, days_max=365)
            fecha_vencimiento = rand_future_date(days_min=30, days_max=730)

            # Vencidos/cancelados have past end dates
            if estado in ("vencido", "cancelado"):
                fecha_vencimiento = rand_past_date(days_min=1, days_max=180)

            valor_total = rand_money(50000, 5000000)
            moneda = pick(["USD", "ARS"])

            row = {
                "numero_contrato": seed_code("CTR", i),
                "tipo": pick(CONTRATO_TIPOS),
                "proveedor_cuit": cuit,
                "proveedor_nombre": fake.company(),
                "estado": estado,
                "fecha_inicio": fecha_inicio,
                "fecha_vencimiento": fecha_vencimiento,
                "valor_total": valor_total,
                "moneda": moneda,
                "centro": centro,
                "notas": f"{SEED_TAG} {fake.sentence(nb_words=10)}",
                "creado_por": creado_por,
                "aprobado_por": aprobado_por,
                "alerta_vencimiento": 30,
                "deleted": 0,
                "created_at": rand_datetime(days_back=400),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                cid = self.insert("contrato", row)
                if cid:
                    contrato_ids.append(cid)
            except Exception:
                pass

        self.log(f"contrato: {len(contrato_ids)} insertados")
        return contrato_ids

    # ------------------------------------------------------------------
    # contrato_item  (~60 records, 3 per contract)
    # ------------------------------------------------------------------
    def _seed_contrato_items(self, contrato_ids):
        count = 0

        for cid in contrato_ids:
            for _ in range(3):
                precio_unit = rand_money(100, 25000)
                cantidad_comprometida = round(random.uniform(10, 1000), 2)
                # Consumed quantity is 0-90% of committed
                cantidad_consumida = round(
                    cantidad_comprometida * random.uniform(0, 0.9), 2
                )
                fecha_desde = rand_past_date(days_min=30, days_max=365)
                fecha_hasta = rand_future_date(days_min=30, days_max=730)

                row = {
                    "contrato_id": cid,
                    "material_codigo": self.refs.rand_material(),
                    "material_descripcion": f"{SEED_TAG} {fake.catch_phrase()}",
                    "precio_unitario": precio_unit,
                    "moneda": pick(["USD", "ARS"]),
                    "cantidad_comprometida": cantidad_comprometida,
                    "cantidad_consumida": cantidad_consumida,
                    "unidad": pick(UNIDADES),
                    "fecha_vigencia_desde": fecha_desde,
                    "fecha_vigencia_hasta": fecha_hasta,
                    "activo": 1,
                    "created_at": rand_datetime(days_back=365),
                }
                try:
                    self.insert_no_return("contrato_item", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"contrato_item: {count} insertados")

    # ------------------------------------------------------------------
    # contrato_documento  (~30 records, 1-2 docs per contract)
    # ------------------------------------------------------------------
    def _seed_contrato_documentos(self, contrato_ids):
        count = 0

        for idx, cid in enumerate(contrato_ids):
            num_docs = random.randint(1, 2)
            doc_tipos = random.sample(DOCUMENTO_TIPOS, min(num_docs, len(DOCUMENTO_TIPOS)))

            for doc_num, tipo in enumerate(doc_tipos):
                n = idx * 2 + doc_num + 1
                nombre_archivo = f"{SEED_PREFIX}{tipo}_{n:04d}.pdf"
                tamanio_bytes = random.randint(50000, 5000000)

                row = {
                    "contrato_id": cid,
                    "tipo": tipo,
                    "nombre_archivo": nombre_archivo,
                    "ruta_archivo": f"/uploads/contratos/seed_doc_{n}.pdf",
                    "tamanio_bytes": tamanio_bytes,
                    "mime_type": "application/pdf",
                    "subido_por": self.refs.rand_user(),
                    "created_at": rand_datetime(days_back=300),
                }
                try:
                    self.insert_no_return("contrato_documento", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"contrato_documento: {count} insertados")

    # ------------------------------------------------------------------
    # contrato_historial  (~60 records, ~3 transitions per contract)
    # ------------------------------------------------------------------
    def _seed_contrato_historial(self, contrato_ids):
        count = 0

        for cid in contrato_ids:
            # Build a short state transition chain (2-4 steps)
            chain_len = random.randint(2, 4)
            # Always start from borrador
            previous = "borrador"
            valid_next = [t[1] for t in ESTADO_TRANSITIONS if t[0] == previous]

            for step in range(chain_len):
                if not valid_next:
                    break
                next_estado = pick(valid_next)
                row = {
                    "contrato_id": cid,
                    "estado_anterior": previous,
                    "estado_nuevo": next_estado,
                    "actor_id": self.refs.rand_admin(),
                    "razon": f"{SEED_TAG} {fake.sentence(nb_words=8)}",
                    "created_at": rand_datetime(days_back=365 - step * 30),
                }
                try:
                    self.insert_no_return("contrato_historial", row)
                    count += 1
                except Exception:
                    pass
                previous = next_estado
                valid_next = [t[1] for t in ESTADO_TRANSITIONS if t[0] == previous]

        self.log(f"contrato_historial: {count} insertados")

    def clean(self):
        cursor = self.conn.cursor()
        clean_map = {
            "contrato_historial": "razon",
            "contrato_documento": "nombre_archivo",
            "contrato_item": "material_descripcion",
            "contrato": "numero_contrato",
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
