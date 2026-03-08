"""
Seed Module 08: Finance
Facturas proveedor, matching 3-way, spend analytics, ahorro de costos, metas.

Tablas:
- factura_proveedor
- factura_item
- matching_resultado
- spend_categoria
- spend_snapshot
- ahorro_costo
- meta_ahorro
"""

import random
from datetime import datetime, timedelta

from ._base import (
    SEED_PREFIX,
    SeedModule,
    fake,
    pick,
    rand_datetime,
    rand_future_date,
    rand_money,
    rand_past_date,
    seed_code,
)

FACTURA_ESTADOS = ["pending", "matched", "partial_match", "disputed", "approved", "paid"]

TIPO_COMPROBANTE = ["factura_a", "factura_b", "nota_credito", "nota_debito"]

MATCHING_ESTADOS = [
    "match",
    "quantity_mismatch",
    "price_mismatch",
    "both_mismatch",
    "no_receipt",
]

AHORRO_CATEGORIAS = [
    "negotiated",
    "contract",
    "rfq",
    "bulk",
    "other",
]

AHORRO_TIPOS = ["hard", "soft"]

SPEND_CATEGORY_NAMES = [
    "Materiales Directos",
    "Repuestos y Componentes",
    "Servicios de Mantenimiento",
    "Equipos y Herramientas",
    "Quimicos y Lubricantes",
    "Electricidad e Instrumentacion",
    "Logistica y Transporte",
    "Insumos Generales",
]

GRUPO_MATERIAL_MAP = {
    "Materiales Directos": "MDIR",
    "Repuestos y Componentes": "REPU",
    "Servicios de Mantenimiento": "SERV",
    "Equipos y Herramientas": "EQUI",
    "Quimicos y Lubricantes": "QUIM",
    "Electricidad e Instrumentacion": "ELEC",
    "Logistica y Transporte": "LOGI",
    "Insumos Generales": "INSU",
}


class FinanceSeed(SeedModule):
    name = "finance"
    description = "Facturas, matching, spend, ahorro, tipo cambio"
    tables = [
        "meta_ahorro",
        "ahorro_costo",
        "spend_snapshot",
        "spend_categoria",
        "matching_resultado",
        "factura_item",
        "factura_proveedor",
    ]

    def seed(self):
        factura_ids = self._seed_facturas()
        self._seed_factura_items(factura_ids)
        self._seed_matching(factura_ids)
        categoria_ids = self._seed_spend_categorias()
        self._seed_spend_snapshots(categoria_ids)
        self._seed_ahorro_costos()
        self._seed_metas_ahorro()

    # ------------------------------------------------------------------
    # factura_proveedor  (~30 records)
    # ------------------------------------------------------------------
    def _seed_facturas(self):
        factura_ids = []

        for i in range(1, 31):
            estado = pick(FACTURA_ESTADOS)
            cuit = self.refs.rand_proveedor()
            fecha_factura = rand_past_date(days_min=5, days_max=120)
            fecha_vencimiento_pago = rand_future_date(days_min=15, days_max=90)

            # Paid and disputed have past due dates
            if estado in ("paid", "disputed"):
                fecha_vencimiento_pago = rand_past_date(days_min=1, days_max=60)

            monto_total = rand_money(5000, 500000)
            moneda = pick(["ARS", "USD"])

            # Nullable FKs: randomly link to OC and recepcion
            orden_compra_id = (
                self.refs.rand_solicitud()
                if random.random() > 0.4
                else None
            )
            recepcion_id = (
                random.randint(1, 50)
                if random.random() > 0.5
                else None
            )

            row = {
                "numero_factura": seed_code("FAC", i),
                "orden_compra_id": orden_compra_id,
                "proveedor_cuit": cuit,
                "monto_total": monto_total,
                "moneda": moneda,
                "fecha_factura": fecha_factura,
                "fecha_vencimiento_pago": fecha_vencimiento_pago,
                "estado": estado,
                "recepcion_id": recepcion_id,
                "tipo_comprobante": pick(TIPO_COMPROBANTE),
                "subido_por": int(self.refs.rand_user()),
                "created_at": rand_datetime(days_back=120),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                fid = self.insert("factura_proveedor", row)
                if fid:
                    factura_ids.append(fid)
            except Exception:
                pass

        self.log(f"factura_proveedor: {len(factura_ids)} insertados")
        return factura_ids

    # ------------------------------------------------------------------
    # factura_item  (~90 records, 3 per factura)
    # ------------------------------------------------------------------
    def _seed_factura_items(self, factura_ids):
        count = 0

        for fid in factura_ids:
            for _ in range(3):
                cantidad = round(random.uniform(1, 200), 2)
                precio_unit = rand_money(100, 20000)
                precio_total = round(cantidad * precio_unit, 2)

                oc_item_id = (
                    random.randint(1, 150)
                    if random.random() > 0.5
                    else None
                )

                row = {
                    "factura_id": fid,
                    "orden_compra_item_id": oc_item_id,
                    "material_codigo": self.refs.rand_material(),
                    "cantidad_facturada": cantidad,
                    "precio_unitario": precio_unit,
                    "precio_total": precio_total,
                }
                try:
                    self.insert_no_return("factura_item", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"factura_item: {count} insertados")

    # ------------------------------------------------------------------
    # matching_resultado  (~20 records, 3-way matching)
    # ------------------------------------------------------------------
    def _seed_matching(self, factura_ids):
        count = 0
        # Take a subset of facturas to match
        matching_pool = factura_ids[: min(20, len(factura_ids))]

        for fid in matching_pool:
            estado = pick(MATCHING_ESTADOS)
            aprobado_por = None
            if estado == "match":
                aprobado_por = int(self.refs.rand_admin())

            diff_cantidad = 0.0
            diff_precio = 0.0
            if estado == "quantity_mismatch":
                diff_cantidad = round(random.uniform(1, 50), 2)
            elif estado == "price_mismatch":
                diff_precio = round(random.uniform(100, 5000), 2)
            elif estado == "both_mismatch":
                diff_cantidad = round(random.uniform(1, 50), 2)
                diff_precio = round(random.uniform(100, 5000), 2)

            oc_id = (
                self.refs.rand_solicitud()
                if random.random() > 0.3
                else None
            )
            recepcion_id = (
                random.randint(1, 50)
                if random.random() > 0.4
                else None
            )

            row = {
                "factura_id": fid,
                "orden_compra_id": oc_id,
                "recepcion_id": recepcion_id,
                "estado": estado,
                "diferencia_cantidad": diff_cantidad,
                "diferencia_precio": diff_precio,
                "tolerancia_aplicada": round(random.uniform(0, 5), 2),
                "aprobado_por": aprobado_por,
                "notas": f"{fake.sentence(nb_words=8)}",
                "created_at": rand_datetime(days_back=90),
            }
            try:
                self.insert_no_return("matching_resultado", row)
                count += 1
            except Exception:
                pass

        self.log(f"matching_resultado: {count} insertados")

    # ------------------------------------------------------------------
    # spend_categoria  (~8 records)
    # ------------------------------------------------------------------
    def _seed_spend_categorias(self):
        categoria_ids = []

        for cat_name in SPEND_CATEGORY_NAMES:
            grupo = GRUPO_MATERIAL_MAP.get(cat_name, "OTRO")
            row = {
                "nombre": f"{SEED_PREFIX}{cat_name}",
                "descripcion": f"{fake.sentence(nb_words=8)}",
                "grupo_material": grupo,
                "created_at": rand_datetime(days_back=365),
            }
            try:
                cid = self.insert("spend_categoria", row)
                if cid:
                    categoria_ids.append(cid)
            except Exception:
                pass

        self.log(f"spend_categoria: {len(categoria_ids)} insertados")
        return categoria_ids

    # ------------------------------------------------------------------
    # spend_snapshot  (~48 records, 6 months x 8 categories)
    # ------------------------------------------------------------------
    def _seed_spend_snapshots(self, categoria_ids):
        count = 0

        # Generate periods for the last 6 months
        today = datetime.now()
        periodos = []
        for m in range(6):
            d = today - timedelta(days=30 * m)
            periodos.append(d.strftime("%Y-%m"))

        for categoria_id in categoria_ids:
            for periodo in periodos:
                gasto_total = rand_money(10000, 2000000)
                gasto_contrato = round(gasto_total * random.uniform(0.4, 0.9), 2)
                gasto_maverick = round(gasto_total - gasto_contrato, 2)

                row = {
                    "periodo": periodo,
                    "categoria_id": categoria_id,
                    "gasto_total": gasto_total,
                    "gasto_contrato": gasto_contrato,
                    "gasto_maverick": gasto_maverick,
                    "num_proveedores": random.randint(1, 20),
                    "num_ordenes": random.randint(1, 50),
                    "created_at": rand_datetime(days_back=180),
                }
                try:
                    self.insert_no_return("spend_snapshot", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"spend_snapshot: {count} insertados")

    # ------------------------------------------------------------------
    # ahorro_costo  (~25 records)
    # ------------------------------------------------------------------
    def _seed_ahorro_costos(self):
        count = 0

        for _ in range(25):
            categoria = pick(AHORRO_CATEGORIAS)
            tipo = pick(AHORRO_TIPOS)
            monto = rand_money(1000, 200000)
            cuit = self.refs.rand_proveedor()
            material_codigo = self.refs.rand_material()

            solicitud_id = (
                self.refs.rand_solicitud()
                if random.random() > 0.5
                else None
            )

            row = {
                "categoria": categoria,
                "tipo": tipo,
                "monto": monto,
                "moneda": "USD",
                "material_codigo": material_codigo,
                "proveedor_cuit": cuit,
                "solicitud_id": solicitud_id,
                "descripcion": f"{fake.sentence(nb_words=12)}",
                "registrado_por": int(self.refs.rand_user()),
                "fecha_realizacion": rand_past_date(days_min=1, days_max=180),
                "created_at": rand_datetime(days_back=180),
            }
            try:
                self.insert_no_return("ahorro_costo", row)
                count += 1
            except Exception:
                pass

        self.log(f"ahorro_costo: {count} insertados")

    # ------------------------------------------------------------------
    # meta_ahorro  (~5 records)
    # ------------------------------------------------------------------
    def _seed_metas_ahorro(self):
        count = 0
        today = datetime.now()

        # One meta per category for the current year-month, different buyers
        used = set()
        for i, categoria in enumerate(AHORRO_CATEGORIAS):
            periodo = today.strftime("%Y%m")
            buyer_id = int(self.refs.rand_user())
            key = (categoria, periodo, buyer_id)
            # Avoid UNIQUE(categoria, periodo, buyer_id) violation
            attempts = 0
            while key in used and attempts < 5:
                buyer_id = int(self.refs.rand_user())
                key = (categoria, periodo, buyer_id)
                attempts += 1
            used.add(key)

            meta_monto = rand_money(50000, 1000000)

            row = {
                "categoria": categoria,
                "periodo": periodo,
                "meta_monto": meta_monto,
                "buyer_id": buyer_id,
                "created_at": rand_datetime(days_back=60),
                "updated_at": rand_datetime(days_back=10),
            }
            try:
                self.insert_no_return("meta_ahorro", row)
                count += 1
            except Exception:
                pass

        self.log(f"meta_ahorro: {count} insertados")

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
