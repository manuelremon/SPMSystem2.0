"""
Seed Module 02: Procurement
OC, RFQ, SOLPEDs, POs SAP.

Tablas:
- orden_compra
- orden_compra_item
- orden_compra_historial
- rfq
- rfq_item
- rfq_proveedor
- rfq_oferta
- rfq_criterio_evaluacion
- rfq_evaluacion
- rfq_adjudicacion
- solpeds              (base table for solicitud_pedido_sap view)
- purchase_orders       (legacy POs)
- sap_solpeds           (SAP requisitions - used by procurement dashboard)
- sap_purchase_orders   (SAP POs - used by procurement dashboard)
- sap_import_log        (import history)
"""

import random

from ._base import (
    MONEDAS,
    SEED_PREFIX,
    UNIDADES,
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

OC_ESTADOS = [
    "borrador",
    "pendiente_aprobacion",
    "aprobada",
    "enviada",
    "recepcion_parcial",
    "completada",
    "cancelada",
]

RFQ_ESTADOS = ["draft", "published", "bidding", "evaluation", "awarded", "cancelled"]

RFQ_CRITERIOS = ["price", "lead_time", "quality", "payment_terms"]

TERMINOS_PAGO = ["30 dias", "60 dias", "90 dias", "contado", "50% adelanto / 50% entrega"]

SOLPED_ESTADOS = ["creada", "enviada", "confirmada", "recibida"]

PO_ESTADOS = ["borrador", "emitida", "confirmada", "recibida", "cancelada"]


ESTRATEGIAS_LIBERACION = ["LIBERADA", "BLOQUEADA", "EN_PROCESO", "PENDIENTE"]

PROVEEDORES_SAP = [
    ("20-30546789-3", "Aceros Patagonia SA"),
    ("30-71234567-8", "Metalurgica del Norte SRL"),
    ("20-25678901-4", "Repuestos Industriales SA"),
    ("30-64523891-2", "Quimica del Litoral SA"),
    ("20-31987654-7", "Ferreteria Industrial Cordoba"),
    ("30-70234567-1", "Electronica Austral SRL"),
    ("20-28765432-9", "Lubricantes del Sur SA"),
    ("30-65789012-5", "Importadora Mendoza SA"),
    ("20-34567890-6", "Plasticos La Plata SRL"),
    ("30-72345678-0", "Herramientas Rosario SA"),
]


class ProcurementSeed(SeedModule):
    name = "procurement"
    description = "OC, RFQ, SOLPEDs, POs SAP, dashboard procurement"
    tables = [
        "sap_import_log",
        "sap_purchase_orders",
        "sap_solpeds",
        "purchase_orders",
        "solpeds",
        "rfq_adjudicacion",
        "rfq_evaluacion",
        "rfq_criterio_evaluacion",
        "rfq_oferta",
        "rfq_proveedor",
        "rfq_item",
        "rfq",
        "orden_compra_historial",
        "orden_compra_item",
        "orden_compra",
    ]

    def seed(self):
        oc_ids = self._seed_orden_compra()
        self._seed_orden_compra_items(oc_ids)
        self._seed_orden_compra_historial(oc_ids)
        rfq_ids, rfq_item_ids = self._seed_rfq()
        self._seed_rfq_proveedores(rfq_ids)
        self._seed_rfq_ofertas(rfq_ids, rfq_item_ids)
        self._seed_rfq_criterios(rfq_ids)
        self._seed_rfq_evaluaciones(rfq_ids)
        self._seed_rfq_adjudicaciones(rfq_ids, rfq_item_ids, oc_ids)
        solped_ids = self._seed_solpeds()
        self._seed_purchase_orders(solped_ids)
        # SAP procurement tables (used by procurement dashboard)
        sap_solped_data = self._seed_sap_solpeds()
        self._seed_sap_purchase_orders(sap_solped_data)
        self._seed_sap_import_log()

    # ------------------------------------------------------------------
    # orden_compra  (~40 records)
    # ------------------------------------------------------------------
    def _seed_orden_compra(self):
        oc_ids = []
        estados_dist = OC_ESTADOS * 6  # weight distribution across 40 OCs

        # Check existing OC count to offset numbering and avoid UNIQUE collisions
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM orden_compra")
            existing_count = cursor.fetchone()[0] or 0
        except Exception:
            existing_count = 0
        offset = existing_count

        for i in range(1, 41):
            estado = pick(estados_dist)
            solicitud_id = (
                self.refs.rand_solicitud()
                if random.random() > 0.2
                else None
            )
            cuit = self.refs.rand_proveedor()
            fecha_emision = rand_past_date(days_min=5, days_max=180)
            fecha_entrega_est = rand_future_date(days_min=10, days_max=120)
            fecha_entrega_real = None
            aprobado_por = None

            if estado in ("completada", "recepcion_parcial"):
                fecha_entrega_real = rand_past_date(days_min=1, days_max=30)
            if estado not in ("borrador",):
                aprobado_por = int(self.refs.rand_admin())

            monto_total = rand_money(5000, 500000)

            row = {
                "numero_oc": seed_code("OC", offset + i) + f"-{random.randint(100,999)}",
                "solicitud_id": solicitud_id,
                "proveedor_cuit": cuit,
                "proveedor_nombre": fake.company(),
                "centro": self.refs.rand_centro(),
                "estado": estado,
                "monto_total": monto_total,
                "moneda": "ARS",
                "fecha_emision": fecha_emision,
                "fecha_entrega_estimada": fecha_entrega_est,
                "fecha_entrega_real": fecha_entrega_real,
                "notas": f"{fake.sentence(nb_words=8)}",
                "creado_por": int(self.refs.rand_planner()),
                "aprobado_por": aprobado_por,
                "created_at": rand_datetime(days_back=180),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                oid = self.insert("orden_compra", row)
                if oid:
                    oc_ids.append(oid)
            except Exception:
                pass

        self.log(f"orden_compra: {len(oc_ids)} insertados")
        return oc_ids

    # ------------------------------------------------------------------
    # orden_compra_item  (~150 records, 3-5 per OC)
    # ------------------------------------------------------------------
    def _seed_orden_compra_items(self, oc_ids):
        count = 0
        for oc_id in oc_ids:
            num_items = random.randint(3, 5)
            for _ in range(num_items):
                cantidad = round(random.uniform(1, 200), 2)
                precio_unit = rand_money(100, 20000)
                precio_total = round(cantidad * precio_unit, 2)
                row = {
                    "orden_compra_id": oc_id,
                    "material_codigo": self.refs.rand_material(),
                    "material_descripcion": f"{fake.catch_phrase()}",
                    "cantidad": cantidad,
                    "cantidad_recibida": round(cantidad * random.uniform(0, 1), 2),
                    "precio_unitario": precio_unit,
                    "precio_total": precio_total,
                    "unidad": pick(UNIDADES),
                    "created_at": rand_datetime(days_back=90),
                }
                try:
                    self.insert_no_return("orden_compra_item", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"orden_compra_item: {count} insertados")

    # ------------------------------------------------------------------
    # orden_compra_historial  (~200 records)
    # ------------------------------------------------------------------
    def _seed_orden_compra_historial(self, oc_ids):
        count = 0
        for oc_id in oc_ids:
            # Build a realistic state chain
            chain_len = random.randint(2, 6)
            prev_estado = "borrador"
            estados_chain = OC_ESTADOS[: chain_len + 1]

            for k, nuevo_estado in enumerate(estados_chain[1:]):
                row = {
                    "orden_compra_id": oc_id,
                    "estado_anterior": prev_estado if k > 0 else None,
                    "estado_nuevo": nuevo_estado,
                    "actor_id": int(self.refs.rand_admin()),
                    "razon": f"{fake.sentence(nb_words=6)}",
                    "created_at": rand_datetime(days_back=90 - k * 5),
                }
                try:
                    self.insert_no_return("orden_compra_historial", row)
                    count += 1
                    prev_estado = nuevo_estado
                except Exception:
                    pass
        self.log(f"orden_compra_historial: {count} insertados")

    # ------------------------------------------------------------------
    # rfq  (~15 records)
    # ------------------------------------------------------------------
    def _seed_rfq(self):
        rfq_ids = []
        rfq_item_ids = []

        for i in range(1, 16):
            estado = pick(RFQ_ESTADOS)
            solicitud_id = (
                self.refs.rand_solicitud()
                if random.random() > 0.3
                else None
            )
            fecha_pub = rand_past_date(days_min=10, days_max=90)
            fecha_cierre = rand_future_date(days_min=5, days_max=60)

            row = {
                "numero_rfq": seed_code("RFQ", i),
                "estado": estado,
                "titulo": f"{fake.catch_phrase()}",
                "descripcion": f"{fake.paragraph(nb_sentences=2)}",
                "fecha_publicacion": fecha_pub,
                "fecha_cierre_ofertas": fecha_cierre,
                "solicitud_id": solicitud_id,
                "creado_por": self.refs.rand_planner(),
                "created_at": rand_datetime(days_back=90),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                rfq_id = self.insert("rfq", row)
                if rfq_id:
                    rfq_ids.append(rfq_id)
                    # Create 3-4 items per RFQ immediately
                    for _ in range(random.randint(3, 4)):
                        item_row = {
                            "rfq_id": rfq_id,
                            "material_codigo": self.refs.rand_material(),
                            "material_descripcion": f"{fake.catch_phrase()}",
                            "cantidad_solicitada": round(random.uniform(5, 300), 2),
                            "unidad": pick(UNIDADES),
                            "especificaciones": f"{fake.sentence(nb_words=10)}",
                            "created_at": rand_datetime(days_back=60),
                        }
                        try:
                            item_id = self.insert("rfq_item", item_row)
                            if item_id:
                                rfq_item_ids.append((rfq_id, item_id))
                        except Exception:
                            pass
            except Exception:
                pass

        self.log(f"rfq: {len(rfq_ids)} insertados")
        self.log(f"rfq_item: {len(rfq_item_ids)} insertados")
        return rfq_ids, rfq_item_ids

    # ------------------------------------------------------------------
    # rfq_proveedor  (~45 records, 3 per RFQ)
    # ------------------------------------------------------------------
    def _seed_rfq_proveedores(self, rfq_ids):
        count = 0
        estados_respuesta = ["invited", "declined", "submitted"]
        for rfq_id in rfq_ids:
            used_cuits = set()
            for _ in range(3):
                cuit = self.refs.rand_proveedor()
                # Avoid duplicate (rfq_id, cuit) if possible
                attempts = 0
                while cuit in used_cuits and attempts < 5:
                    cuit = self.refs.rand_proveedor()
                    attempts += 1
                used_cuits.add(cuit)
                row = {
                    "rfq_id": rfq_id,
                    "proveedor_cuit": cuit,
                    "proveedor_nombre": fake.company(),
                    "estado_respuesta": pick(estados_respuesta),
                    "created_at": rand_datetime(days_back=60),
                }
                try:
                    self.insert_no_return("rfq_proveedor", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"rfq_proveedor: {count} insertados")

    # ------------------------------------------------------------------
    # rfq_oferta  (~100 records)
    # ------------------------------------------------------------------
    def _seed_rfq_ofertas(self, rfq_ids, rfq_item_ids):
        count = 0
        # Group items by rfq_id
        items_by_rfq = {}
        for rfq_id, item_id in rfq_item_ids:
            items_by_rfq.setdefault(rfq_id, []).append(item_id)

        for rfq_id in rfq_ids:
            items = items_by_rfq.get(rfq_id, [])
            if not items:
                continue
            # 2-3 suppliers each bid on all items
            num_suppliers = random.randint(2, 3)
            cuits = [self.refs.rand_proveedor() for _ in range(num_suppliers)]
            for cuit in cuits:
                for item_id in items:
                    row = {
                        "rfq_id": rfq_id,
                        "rfq_item_id": item_id,
                        "proveedor_cuit": cuit,
                        "precio_unitario": rand_money(100, 30000),
                        "moneda": pick(MONEDAS[:2]),  # ARS or USD
                        "lead_time_dias": random.randint(5, 90),
                        "terminos_pago": pick(TERMINOS_PAGO),
                        "notas": f"{fake.sentence(nb_words=6)}",
                        "submitted_at": rand_datetime(days_back=45),
                    }
                    try:
                        self.insert_no_return("rfq_oferta", row)
                        count += 1
                    except Exception:
                        pass
        self.log(f"rfq_oferta: {count} insertados")

    # ------------------------------------------------------------------
    # rfq_criterio_evaluacion  (~60 records, 4 per RFQ)
    # ------------------------------------------------------------------
    def _seed_rfq_criterios(self, rfq_ids):
        count = 0
        for rfq_id in rfq_ids:
            # Distribute 100% across 4 criteria with random weights
            pesos = [random.randint(10, 40) for _ in range(4)]
            total = sum(pesos)
            pesos_norm = [round(p / total * 100, 2) for p in pesos]
            # Fix rounding so sum == 100
            diff = round(100 - sum(pesos_norm), 2)
            pesos_norm[-1] = round(pesos_norm[-1] + diff, 2)

            for criterio, peso in zip(RFQ_CRITERIOS, pesos_norm):
                row = {
                    "rfq_id": rfq_id,
                    "criterio": criterio,
                    "peso_porcentaje": peso,
                    "created_at": rand_datetime(days_back=60),
                }
                try:
                    self.insert_no_return("rfq_criterio_evaluacion", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"rfq_criterio_evaluacion: {count} insertados")

    # ------------------------------------------------------------------
    # rfq_evaluacion  (~30 records)
    # ------------------------------------------------------------------
    def _seed_rfq_evaluaciones(self, rfq_ids):
        count = 0
        for rfq_id in rfq_ids:
            num_suppliers = random.randint(1, 3)
            used_cuits = set()
            for _ in range(num_suppliers):
                cuit = self.refs.rand_proveedor()
                attempts = 0
                while cuit in used_cuits and attempts < 5:
                    cuit = self.refs.rand_proveedor()
                    attempts += 1
                used_cuits.add(cuit)

                p_precio = round(rand_pct(40, 100), 1)
                p_lead = round(rand_pct(40, 100), 1)
                p_calidad = round(rand_pct(40, 100), 1)
                p_terminos = round(rand_pct(40, 100), 1)
                total = round((p_precio + p_lead + p_calidad + p_terminos) / 4, 1)

                row = {
                    "rfq_id": rfq_id,
                    "proveedor_cuit": cuit,
                    "puntaje_total": total,
                    "puntaje_precio": p_precio,
                    "puntaje_lead_time": p_lead,
                    "puntaje_calidad": p_calidad,
                    "puntaje_terminos": p_terminos,
                    "evaluado_por": self.refs.rand_planner(),
                    "created_at": rand_datetime(days_back=30),
                }
                try:
                    self.insert_no_return("rfq_evaluacion", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"rfq_evaluacion: {count} insertados")

    # ------------------------------------------------------------------
    # rfq_adjudicacion  (~20 records, only for "awarded" state RFQs)
    # ------------------------------------------------------------------
    def _seed_rfq_adjudicaciones(self, rfq_ids, rfq_item_ids, oc_ids):
        count = 0
        # We don't know which rfq_ids are "awarded"; just pick a subset
        awarded_rfq_ids = rfq_ids[: max(1, len(rfq_ids) // 3)]

        items_by_rfq = {}
        for rfq_id, item_id in rfq_item_ids:
            items_by_rfq.setdefault(rfq_id, []).append(item_id)

        oc_pool = oc_ids[:] if oc_ids else [None]

        for rfq_id in awarded_rfq_ids:
            items = items_by_rfq.get(rfq_id, [])
            for item_id in items[:2]:  # up to 2 items adjudicated per RFQ
                oc_id = pick(oc_pool) if oc_pool and random.random() > 0.4 else None
                row = {
                    "rfq_id": rfq_id,
                    "rfq_item_id": item_id,
                    "proveedor_ganador_cuit": self.refs.rand_proveedor(),
                    "precio_adjudicado": rand_money(500, 50000),
                    "cantidad_adjudicada": round(random.uniform(10, 300), 2),
                    "orden_compra_id": oc_id,
                    "created_at": rand_datetime(days_back=20),
                }
                try:
                    self.insert_no_return("rfq_adjudicacion", row)
                    count += 1
                except Exception:
                    pass
        self.log(f"rfq_adjudicacion: {count} insertados")

    # ------------------------------------------------------------------
    # solpeds (base table for solicitud_pedido_sap view)  (~30 records)
    # ------------------------------------------------------------------
    def _seed_solpeds(self):
        solped_ids = []
        for i in range(1, 31):
            solicitud_id = self.refs.rand_solicitud()
            estado = pick(SOLPED_ESTADOS)
            row = {
                "solicitud_id": solicitud_id,
                "item_index": random.randint(0, 4),
                "material": self.refs.rand_material(),
                "um": pick(UNIDADES),
                "cantidad": round(random.uniform(1, 500), 2),
                "precio_unitario_est": rand_money(100, 25000),
                "status": estado,
                "numero": seed_code("SOLPED", i),
                "created_by": self.refs.rand_planner(),
                "created_at": rand_datetime(days_back=180),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                sid = self.insert("solpeds", row)
                if sid:
                    solped_ids.append(sid)
            except Exception:
                pass

        self.log(f"solpeds: {len(solped_ids)} insertados")
        return solped_ids

    # ------------------------------------------------------------------
    # purchase_orders (legacy)  (~15 records)
    # ------------------------------------------------------------------
    def _seed_purchase_orders(self, solped_ids):
        count = 0
        solped_pool = solped_ids[:] if solped_ids else [None]

        for i in range(1, 16):
            solped_id = pick(solped_pool) if solped_pool else None
            solicitud_id = self.refs.rand_solicitud()
            estado = pick(PO_ESTADOS)
            subtotal = rand_money(2000, 200000)

            row = {
                "solped_id": solped_id,
                "solicitud_id": solicitud_id,
                "proveedor_email": fake.company_email(),
                "proveedor_nombre": fake.company(),
                "numero": seed_code("PO", i),
                "status": estado,
                "subtotal": subtotal,
                "moneda": pick(MONEDAS[:2]),
                "created_by": self.refs.rand_planner(),
                "created_at": rand_datetime(days_back=180),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                self.insert_no_return("purchase_orders", row)
                count += 1
            except Exception:
                pass

        self.log(f"purchase_orders: {count} insertados")

    # ------------------------------------------------------------------
    # sap_solpeds  (~80 records - SAP requisitions for procurement dashboard)
    # ------------------------------------------------------------------
    def _seed_sap_solpeds(self):
        """Seed sap_solpeds table used by procurement dashboard KPIs."""
        from datetime import datetime, timedelta
        sap_solped_data = []
        centros = self.refs.centros or ["1000", "1100", "1200", "1300", "1400"]

        for i in range(1, 81):
            solped_id = f"{SEED_PREFIX}SOLPED-{5000000 + i}"
            num_posiciones = random.randint(1, 4)

            # Create date first - all positions share the same SOLPED creation date
            days_ago = random.randint(14, 180)
            base_date = datetime.now() - timedelta(days=days_ago)
            fecha_creacion = base_date.strftime('%Y-%m-%d %H:%M:%S')
            # Delivery requested 30-120 days AFTER creation
            delivery_offset = random.randint(30, 120)
            fecha_entrega = (base_date + timedelta(days=delivery_offset)).strftime('%Y-%m-%d %H:%M:%S')

            for pos in range(1, num_posiciones + 1):
                posicion = f"{pos * 10:04d}"
                material = self.refs.rand_material()
                centro = pick(centros)
                cantidad = round(random.uniform(5, 500), 2)
                precio_unit = rand_money(50, 15000)
                importe = round(cantidad * precio_unit, 2)

                estrategia = pick(ESTRATEGIAS_LIBERACION)

                row = {
                    "solped_id": solped_id,
                    "posicion": posicion,
                    "material_codigo": material,
                    "material_descripcion": f"{fake.catch_phrase()}",
                    "centro": centro,
                    "fecha_creacion": fecha_creacion,
                    "cantidad": cantidad,
                    "precio_unitario": precio_unit,
                    "importe_total": importe,
                    "moneda": pick(MONEDAS[:2]),
                    "estrategia_liberacion": estrategia,
                    "fecha_entrega_solicitada": fecha_entrega,
                    "creado_por": self.refs.rand_user(),
                    "solicitante": fake.name(),
                }
                try:
                    self.insert_no_return("sap_solpeds", row)
                    sap_solped_data.append({
                        "solped_id": solped_id,
                        "posicion": posicion,
                        "centro": centro,
                        "fecha_creacion": fecha_creacion,
                        "fecha_entrega": fecha_entrega,
                        "material": material,
                        "cantidad": cantidad,
                        "importe": importe,
                        "estrategia": estrategia,
                        "days_ago": days_ago,
                    })
                except Exception:
                    pass

        self.log(f"sap_solpeds: {len(sap_solped_data)} insertados")
        return sap_solped_data

    # ------------------------------------------------------------------
    # sap_purchase_orders  (~120 records - SAP POs for procurement dashboard)
    # ------------------------------------------------------------------
    def _seed_sap_purchase_orders(self, sap_solped_data):
        """Seed sap_purchase_orders linked to sap_solpeds for dashboard KPIs."""
        from datetime import datetime, timedelta
        count = 0

        # ~60% of released solpeds get a PO
        released = [s for s in sap_solped_data if s["estrategia"] == "LIBERADA"]
        # Also some non-released ones for variety
        others = [s for s in sap_solped_data if s["estrategia"] != "LIBERADA"]
        po_candidates = released + random.sample(others, min(20, len(others)))

        for idx, solped in enumerate(po_candidates):
            pedido_id = f"{SEED_PREFIX}PO-{4500000 + idx + 1}"
            proveedor = pick(PROVEEDORES_SAP)
            cantidad_pedida = solped["cantidad"]
            valor_pedido = solped["importe"]

            # PO date: 3-15 days AFTER solped creation (realistic approval time)
            solped_date = datetime.strptime(solped["fecha_creacion"], '%Y-%m-%d %H:%M:%S')
            po_offset = random.randint(3, 15)
            fecha_pedido_dt = solped_date + timedelta(days=po_offset)
            fecha_pedido = fecha_pedido_dt.strftime('%Y-%m-%d %H:%M:%S')

            # ~70% have been received
            has_reception = random.random() < 0.70
            fecha_recepcion = None
            cantidad_recepcionada = 0.0
            valor_recibido = 0.0

            if has_reception:
                # Reception: 10-60 days AFTER PO date
                recv_offset = random.randint(10, 60)
                fecha_recepcion_dt = fecha_pedido_dt + timedelta(days=recv_offset)
                # Only if reception date is in the past
                if fecha_recepcion_dt <= datetime.now():
                    fecha_recepcion = fecha_recepcion_dt.strftime('%Y-%m-%d %H:%M:%S')
                    # Some partial, some full
                    pct_received = random.choice([0.5, 0.75, 0.9, 1.0, 1.0, 1.0])
                    cantidad_recepcionada = round(cantidad_pedida * pct_received, 2)
                    valor_recibido = round(valor_pedido * pct_received, 2)

            row = {
                "pedido_id": pedido_id,
                "solped_id": solped["solped_id"],
                "solped_posicion": solped["posicion"],
                "proveedor_cuit": proveedor[0],
                "proveedor_nombre": proveedor[1],
                "centro": solped["centro"],
                "material_codigo": solped["material"],
                "cantidad_pedida": cantidad_pedida,
                "cantidad_recepcionada": cantidad_recepcionada,
                "valor_pedido": valor_pedido,
                "valor_recibido": valor_recibido,
                "fecha_pedido": fecha_pedido,
                "fecha_recepcion": fecha_recepcion,
                "moneda_pedido": pick(MONEDAS[:2]),
            }
            try:
                self.insert_no_return("sap_purchase_orders", row)
                count += 1
            except Exception:
                pass

        self.log(f"sap_purchase_orders: {count} insertados")

    # ------------------------------------------------------------------
    # sap_import_log  (~3 records - import history)
    # ------------------------------------------------------------------
    def _seed_sap_import_log(self):
        count = 0
        filenames = [
            "SAP_SOLPEDS_2026_Q1.xlsx",
            "SAP_PO_Export_Enero.csv",
            "SAP_Procurement_Feb2026.xlsx",
        ]
        for fname in filenames:
            started = rand_datetime(days_back=30)
            row = {
                "filename": f"{fname}",
                "user_id": self.refs.rand_admin(),
                "started_at": started,
                "finished_at": rand_datetime(days_back=29),
                "records_inserted": random.randint(50, 200),
                "records_updated": random.randint(5, 30),
                "records_error": random.randint(0, 3),
                "status": "completed",
                "error_message": None,
            }
            try:
                self.insert_no_return("sap_import_log", row)
                count += 1
            except Exception:
                pass
        self.log(f"sap_import_log: {count} insertados")

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
