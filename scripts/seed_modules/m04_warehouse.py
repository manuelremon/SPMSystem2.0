"""
Seed Module 04: Warehouse
Recepciones, docks, ASN, putaway, ajustes, SLOB.

Tablas reales en PG:
- dock_recepcion       (master dock table)
- recepcion
- recepcion_dock       (junction: recepcion <-> dock)
- recepcion_item
- asn
- asn_item
- putaway_tarea
- ajuste_inventario
- slob_disposicion
"""

import random

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

RECEPCION_TIPOS = ["normal", "urgente", "devolucion", "transferencia"]
RECEPCION_ESTADOS = ["pending", "in_progress", "completed", "cancelled"]
RECEPCION_ITEM_ESTADOS = ["aceptado", "rechazado", "parcial"]

ASN_ESTADOS = ["draft", "submitted", "in_transit", "received", "cancelled"]

PUTAWAY_ESTADOS = ["pending", "in_progress", "completed", "cancelled"]

AJUSTE_TIPOS = ["adjustment", "write_off", "recount"]

SLOB_TIPOS_DISPOSICION = ["rework", "scrap", "transferencia", "venta", "donacion"]
SLOB_ESTADOS = ["proposed", "approved", "in_progress", "completed"]

DOCK_TIPOS = ["inbound", "outbound", "dual"]
DOCK_ESTADOS = ["available", "occupied", "maintenance"]

TRANSPORTISTAS = [
    "TransArgentina SA", "Logistica Sur SRL", "Cargas del Norte",
    "Express Patagonia", "TransAndina SA", "Fletes Rapidos SRL",
]


class WarehouseSeed(SeedModule):
    name = "warehouse"
    description = "Recepciones, docks, ASN, putaway, ajustes, SLOB"
    tables = [
        # Reverse dependency order (children first) for cleanup
        "slob_disposicion",
        "ajuste_inventario",
        "putaway_tarea",
        "asn_item",
        "asn",
        "recepcion_item",
        "recepcion_dock",
        "recepcion",
        "dock_recepcion",
    ]

    def seed(self):
        dock_ids = self._seed_dock_recepcion()
        rec_ids = self._seed_recepcion(dock_ids)
        self._seed_recepcion_dock(rec_ids, dock_ids)
        self._seed_recepcion_items(rec_ids)
        asn_ids = self._seed_asn()
        self._seed_asn_items(asn_ids)
        self._seed_putaway_tarea(rec_ids)
        self._seed_ajuste_inventario()
        self._seed_slob_disposicion()

    # ------------------------------------------------------------------
    # dock_recepcion  (~8 records)  — master dock table
    # Cols: numero_dock, almacen, estado, capacidad_pallets, created_at, updated_at
    # ------------------------------------------------------------------
    def _seed_dock_recepcion(self):
        dock_ids = []
        almacenes = ["ALM-NORTE", "ALM-NORTE", "ALM-SUR", "ALM-SUR",
                      "ALM-ESTE", "ALM-OESTE", "ALM-CENTRAL", "ALM-CENTRAL"]
        for i in range(1, 9):
            row = {
                "numero_dock": seed_code("DCK", i),
                "almacen": almacenes[i - 1],
                "estado": pick(DOCK_ESTADOS),
                "capacidad_pallets": random.randint(2, 20),
                "created_at": rand_datetime(days_back=365),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                did = self.insert("dock_recepcion", row)
                if did:
                    dock_ids.append(did)
            except Exception:
                pass

        self.log(f"dock_recepcion: {len(dock_ids)} insertados")
        return dock_ids

    # ------------------------------------------------------------------
    # recepcion_dock  (~20 records)  — junction: recepcion <-> dock
    # Cols: recepcion_id, dock_id, hora_llegada, hora_inicio_descarga,
    #       hora_fin_descarga, asignado_por, created_at
    # ------------------------------------------------------------------
    def _seed_recepcion_dock(self, rec_ids, dock_ids):
        count = 0
        if not rec_ids or not dock_ids:
            self.log("recepcion_dock: skipped (no recepciones or docks)")
            return

        for rec_id in rec_ids:
            dock_id = pick(dock_ids)
            hora_llegada = rand_past_date(days_min=1, days_max=180)
            hora_inicio = rand_past_date(days_min=1, days_max=179)
            hora_fin = rand_past_date(days_min=1, days_max=178) if random.random() > 0.3 else None

            row = {
                "recepcion_id": rec_id,
                "dock_id": dock_id,
                "hora_llegada": hora_llegada,
                "hora_inicio_descarga": hora_inicio,
                "hora_fin_descarga": hora_fin,
                "asignado_por": int(self.refs.rand_user()),
                "created_at": rand_datetime(days_back=180),
            }
            try:
                self.insert_no_return("recepcion_dock", row)
                count += 1
            except Exception:
                pass

        self.log(f"recepcion_dock: {count} insertados")

    # ------------------------------------------------------------------
    # recepcion  (~20 records)
    # Cols: orden_compra_id, numero_recepcion, fecha_recepcion,
    #       recibido_por, notas, created_at
    # ------------------------------------------------------------------
    def _seed_recepcion(self, dock_ids):
        rec_ids = []

        # Get valid OC IDs from DB since orden_compra_id is NOT NULL
        oc_ids = []
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT id FROM orden_compra ORDER BY id LIMIT 100")
            oc_ids = [r[0] for r in cursor.fetchall()]
        except Exception:
            pass
        if not oc_ids:
            self.log("recepcion: skipped (no orden_compra records found)")
            return rec_ids

        for i in range(1, 21):
            row = {
                "numero_recepcion": seed_code("REC", i),
                "orden_compra_id": pick(oc_ids),
                "fecha_recepcion": rand_past_date(days_min=1, days_max=180),
                "recibido_por": int(self.refs.rand_user()),
                "notas": f"{fake.sentence(nb_words=9)}",
                "created_at": rand_datetime(days_back=180),
            }
            try:
                rid = self.insert("recepcion", row)
                if rid:
                    rec_ids.append(rid)
            except Exception:
                pass

        self.log(f"recepcion: {len(rec_ids)} insertados")
        return rec_ids

    # ------------------------------------------------------------------
    # recepcion_item  (~60 records, 3 per recepcion)
    # Cols: recepcion_id, orden_compra_item_id, cantidad_recibida,
    #       estado_calidad, notas
    # ------------------------------------------------------------------
    def _seed_recepcion_items(self, rec_ids):
        count = 0
        for rec_id in rec_ids:
            for _ in range(3):
                cantidad_recibida = round(random.uniform(10, 500), 2)
                estado = pick(RECEPCION_ITEM_ESTADOS)
                notas = None
                if estado in ("rechazado", "parcial"):
                    notas = f"{fake.sentence(nb_words=6)}"
                else:
                    notas = f"Recibido OK"

                row = {
                    "recepcion_id": rec_id,
                    "orden_compra_item_id": random.randint(1, 100),
                    "cantidad_recibida": cantidad_recibida,
                    "estado_calidad": estado,
                    "notas": notas,
                }
                try:
                    self.insert_no_return("recepcion_item", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"recepcion_item: {count} insertados")

    # ------------------------------------------------------------------
    # asn  (~10 records)
    # Cols: numero_asn, proveedor_cuit, orden_compra_id, fecha_envio_estimada,
    #       transportista, guia_despacho, cantidad_total, estado, notas,
    #       creado_por_portal, created_at
    # ------------------------------------------------------------------
    def _seed_asn(self):
        asn_ids = []
        for i in range(1, 11):
            estado = pick(ASN_ESTADOS)
            fecha_estimada = None
            if estado in ("in_transit", "received"):
                fecha_estimada = rand_future_date(days_min=1, days_max=14)
            elif estado in ("draft", "submitted"):
                fecha_estimada = rand_future_date(days_min=3, days_max=30)

            row = {
                "numero_asn": seed_code("ASN", i),
                "proveedor_cuit": self.refs.rand_proveedor(),
                "orden_compra_id": random.randint(1, 50) if random.random() > 0.3 else None,
                "fecha_envio_estimada": fecha_estimada,
                "transportista": f"{pick(TRANSPORTISTAS)}",
                "guia_despacho": f"GD-{random.randint(100000, 999999)}",
                "cantidad_total": round(random.uniform(10, 5000), 2),
                "estado": estado,
                "notas": f"{fake.sentence(nb_words=8)}",
                "creado_por_portal": int(self.refs.rand_user()) if random.random() > 0.5 else None,
                "created_at": rand_datetime(days_back=90),
            }
            try:
                aid = self.insert("asn", row)
                if aid:
                    asn_ids.append(aid)
            except Exception:
                pass

        self.log(f"asn: {len(asn_ids)} insertados")
        return asn_ids

    # ------------------------------------------------------------------
    # asn_item  (~30 records, 3 per ASN)
    # Cols: asn_id, orden_compra_item_id, material_codigo, cantidad_enviada,
    #       numero_lote, fecha_vencimiento, created_at
    # ------------------------------------------------------------------
    def _seed_asn_items(self, asn_ids):
        count = 0
        for asn_id in asn_ids:
            for _ in range(3):
                row = {
                    "asn_id": asn_id,
                    "orden_compra_item_id": random.randint(1, 100) if random.random() > 0.3 else None,
                    "material_codigo": self.refs.rand_material(),
                    "cantidad_enviada": round(random.uniform(5, 500), 2),
                    "numero_lote": f"{SEED_PREFIX}LOTE-{random.randint(10000, 99999)}" if random.random() > 0.4 else None,
                    "fecha_vencimiento": rand_future_date(days_min=30, days_max=730) if random.random() > 0.5 else None,
                    "created_at": rand_datetime(days_back=90),
                }
                try:
                    self.insert_no_return("asn_item", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"asn_item: {count} insertados")

    # ------------------------------------------------------------------
    # putaway_tarea  (~20 records)
    # Cols: recepcion_item_id, material_codigo, cantidad,
    #       ubicacion_destino, almacen, estado, asignado_a,
    #       prioridad (text), created_at, updated_at
    # ------------------------------------------------------------------
    def _seed_putaway_tarea(self, rec_ids):
        count = 0
        prioridades = ["low", "normal", "high", "urgent"]

        for _ in range(20):
            estado = pick(PUTAWAY_ESTADOS)
            asignado_a = None

            if estado in ("in_progress", "completed"):
                asignado_a = int(self.refs.rand_user())

            row = {
                "recepcion_item_id": random.randint(1, 60) if random.random() > 0.2 else None,
                "material_codigo": self.refs.rand_material(),
                "cantidad": round(random.uniform(10, 500), 0),
                "ubicacion_destino": f"{pick(['A', 'B', 'C', 'D'])}-{random.randint(1, 50):02d}-{random.randint(1, 5)}",
                "almacen": self.refs.rand_almacen(),
                "estado": estado,
                "asignado_a": asignado_a,
                "prioridad": pick(prioridades),
                "created_at": rand_datetime(days_back=90),
            }
            try:
                self.insert_no_return("putaway_tarea", row)
                count += 1
            except Exception:
                pass

        self.log(f"putaway_tarea: {count} insertados")

    # ------------------------------------------------------------------
    # ajuste_inventario  (~15 records)
    # Cols: count_item_id, material_codigo, almacen_id (int),
    #       cantidad_antes, cantidad_despues, tipo, razon,
    #       aprobado_por, created_at
    # ------------------------------------------------------------------
    def _seed_ajuste_inventario(self):
        count = 0
        for i in range(1, 16):
            tipo = pick(AJUSTE_TIPOS)
            aprobado_por = None
            if random.random() > 0.4:
                aprobado_por = int(self.refs.rand_admin())

            cantidad_antes = round(random.uniform(10, 500), 2)
            delta = round(random.uniform(1, 100), 2)
            if tipo == "write_off":
                cantidad_despues = round(max(0, cantidad_antes - delta), 2)
            else:
                cantidad_despues = round(cantidad_antes + delta, 2)

            row = {
                "count_item_id": random.randint(1, 50) if random.random() > 0.3 else None,
                "material_codigo": self.refs.rand_material(),
                "almacen_id": random.randint(1, 10) if random.random() > 0.2 else None,
                "cantidad_antes": cantidad_antes,
                "cantidad_despues": cantidad_despues,
                "tipo": tipo,
                "razon": f"{fake.sentence(nb_words=8)}",
                "aprobado_por": aprobado_por,
                "created_at": rand_datetime(days_back=180),
            }
            try:
                self.insert_no_return("ajuste_inventario", row)
                count += 1
            except Exception:
                pass

        self.log(f"ajuste_inventario: {count} insertados")

    # ------------------------------------------------------------------
    # slob_disposicion  (~10 records)
    # Cols: material_codigo, almacen, cantidad, tipo_disposicion, estado,
    #       notas, costo_recuperado, propuesto_por, aprobado_por,
    #       completado_at, created_at
    # ------------------------------------------------------------------
    def _seed_slob_disposicion(self):
        count = 0
        for _ in range(10):
            estado = pick(SLOB_ESTADOS)
            costo_recuperado = 0
            aprobado_por = None
            completado_at = None

            if estado in ("approved", "in_progress", "completed"):
                aprobado_por = self.refs.rand_admin()
            if estado == "completed":
                costo_recuperado = rand_money(100, 50000)
                completado_at = rand_datetime(days_back=30)

            row = {
                "material_codigo": self.refs.rand_material(),
                "almacen": self.refs.rand_almacen(),
                "cantidad": round(random.uniform(1, 2000), 2),
                "tipo_disposicion": pick(SLOB_TIPOS_DISPOSICION),
                "estado": estado,
                "notas": f"{fake.sentence(nb_words=10)}",
                "costo_recuperado": costo_recuperado,
                "propuesto_por": self.refs.rand_user(),
                "aprobado_por": aprobado_por,
                "completado_at": completado_at,
                "created_at": rand_datetime(days_back=180),
            }
            try:
                self.insert_no_return("slob_disposicion", row)
                count += 1
            except Exception:
                pass

        self.log(f"slob_disposicion: {count} insertados")

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
