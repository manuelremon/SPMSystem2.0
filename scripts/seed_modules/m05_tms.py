"""
Seed Module 05: TMS (Transport Management System)
Shipments, tracking, costos, consolidaciones.

Tablas reales en PG:
- tms_routes
- tms_shipments
- tms_tracking_events
- tms_shipment_costs
- tms_consolidations
- tms_settlements
- tms_tariffs
- tms_fuel_log
- tms_config
- tms_audit_log
"""

import json
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
    rand_pct,
    seed_code,
)

SHIPMENT_ESTADOS = [
    "draft", "confirmed", "assigned", "in_transit", "delivered", "cancelled",
]

TRACKING_EVENTOS = ["salida", "parada", "checkpoint", "entrega", "posicion"]

CONSOLIDACION_ESTADOS = ["open", "full", "dispatched", "closed"]

SETTLEMENT_ESTADOS = ["pendiente", "cerrado", "aprobado"]


class TMSSeed(SeedModule):
    name = "tms"
    description = "Shipments, tracking, costos, consolidaciones"
    tables = [
        "tms_settlements",
        "tms_fuel_log",
        "tms_shipment_costs",
        "tms_tracking_events",
        "tms_consolidations",
        "tms_shipments",
        "tms_tariffs",
        "tms_routes",
        "tms_config",
        "tms_audit_log",
    ]

    def seed(self):
        route_ids = self._seed_routes()
        shipment_ids, delivered_ids = self._seed_shipments(route_ids)
        self._seed_tracking_events(delivered_ids)
        self._seed_shipment_costs(shipment_ids)
        self._seed_consolidations()
        self._seed_settlements(delivered_ids)
        self._seed_tariffs()
        self._seed_fuel_log(shipment_ids)
        self._seed_config()
        self._seed_audit_log()

    # ------------------------------------------------------------------
    # tms_routes  (~8 records)
    # Cols: nombre, origen, destino, distancia_km, tiempo_estimado_hrs, activo
    # ------------------------------------------------------------------
    def _seed_routes(self):
        route_ids = []
        for i in range(1, 9):
            origen = self.refs.rand_centro()
            destino = self.refs.rand_centro()
            for _ in range(5):
                if destino != origen:
                    break
                destino = self.refs.rand_centro()

            distancia = random.randint(100, 2000)
            tiempo_hrs = round(distancia / random.uniform(60, 100), 1)

            row = {
                "nombre": f"Ruta {origen}-{destino}",
                "origen": origen,
                "destino": destino,
                "distancia_km": distancia,
                "tiempo_estimado_hrs": tiempo_hrs,
                "activo": True,
                "created_at": rand_datetime(days_back=365),
            }
            try:
                rid = self.insert("tms_routes", row)
                if rid:
                    route_ids.append(rid)
            except Exception:
                pass

        self.log(f"tms_routes: {len(route_ids)} insertados")
        return route_ids

    # ------------------------------------------------------------------
    # tms_shipments  (~30 records)
    # Cols: codigo, solicitud_id, origen, destino, transportista, conductor,
    #       vehiculo_id, conductor_id, peso_kg, volumen_m3, estado, prioridad,
    #       tipo, fecha_salida, fecha_llegada_est, fecha_llegada_real,
    #       notas, consolidation_id, route_id, created_by, created_at, updated_at
    # ------------------------------------------------------------------
    def _seed_shipments(self, route_ids):
        shipment_ids = []
        delivered_ids = []
        tipos = ["standard", "express", "ltl", "ftl", "consolidado"]
        transportistas = ["TransArgentina SA", "Logistica Sur SRL", "Cargas del Norte",
                          "Express Patagonia", "TransAndina SA"]
        route_pool = route_ids if route_ids else [None]

        for i in range(1, 31):
            estado = pick(SHIPMENT_ESTADOS)
            origen = self.refs.rand_centro()
            destino = self.refs.rand_centro()
            for _ in range(5):
                if destino != origen:
                    break
                destino = self.refs.rand_centro()

            fecha_salida = None
            fecha_llegada_real = None
            if estado in ("in_transit", "delivered", "assigned"):
                fecha_salida = rand_past_date(days_min=1, days_max=30)
            if estado == "delivered":
                fecha_llegada_real = rand_past_date(days_min=1, days_max=14)

            vehiculo_id = None
            conductor_id = None
            if estado in ("assigned", "in_transit", "delivered"):
                vehiculo_id = random.randint(1, 15)
                conductor_id = random.randint(1, 10)

            row = {
                "codigo": seed_code("SHP", i),
                "solicitud_id": self.refs.rand_solicitud() if random.random() > 0.4 else None,
                "origen": origen,
                "destino": destino,
                "transportista": f"{pick(transportistas)}",
                "conductor": fake.name() if conductor_id else None,
                "vehiculo_id": vehiculo_id,
                "conductor_id": conductor_id,
                "peso_kg": round(random.uniform(100, 20000), 2),
                "volumen_m3": round(random.uniform(0.5, 80), 2),
                "estado": estado,
                "prioridad": pick(["baja", "normal", "alta", "urgente"]),
                "tipo": pick(tipos),
                "fecha_salida": fecha_salida,
                "fecha_llegada_est": rand_future_date(days_min=1, days_max=30),
                "fecha_llegada_real": fecha_llegada_real,
                "notas": f"{fake.sentence(nb_words=8)}",
                "consolidation_id": None,
                "route_id": pick(route_pool) if random.random() > 0.3 else None,
                "created_by": self.refs.rand_user(),
                "created_at": rand_datetime(days_back=120),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                sid = self.insert("tms_shipments", row)
                if sid:
                    shipment_ids.append(sid)
                    if estado == "delivered":
                        delivered_ids.append(sid)
            except Exception:
                pass

        self.log(f"tms_shipments: {len(shipment_ids)} (delivered: {len(delivered_ids)})")
        return shipment_ids, delivered_ids

    # ------------------------------------------------------------------
    # tms_tracking_events  (~150 records)
    # Cols: shipment_id, evento, ubicacion, latitud, longitud, notas, created_by
    # ------------------------------------------------------------------
    def _seed_tracking_events(self, delivered_ids):
        count = 0
        for shp_id in delivered_ids:
            for step in range(5):
                evento = TRACKING_EVENTOS[min(step, len(TRACKING_EVENTOS) - 1)]
                row = {
                    "shipment_id": shp_id,
                    "evento": evento,
                    "ubicacion": f"{fake.city()}, {fake.province()}",
                    "latitud": round(random.uniform(-38, -34), 6),
                    "longitud": round(random.uniform(-70, -58), 6),
                    "notas": f"{fake.sentence(nb_words=7)}",
                    "created_by": self.refs.rand_user(),
                    "created_at": rand_datetime(days_back=60),
                }
                try:
                    self.insert_no_return("tms_tracking_events", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"tms_tracking_events: {count} insertados")

    # ------------------------------------------------------------------
    # tms_shipment_costs  (~60 records)
    # Cols: shipment_id, concepto, monto, moneda, tipo, created_by
    # ------------------------------------------------------------------
    def _seed_shipment_costs(self, shipment_ids):
        count = 0
        conceptos = [
            ("Combustible", "variable"), ("Peajes", "variable"),
            ("Viaticos", "fijo"), ("Seguro carga", "fijo"),
            ("Flete externo", "variable"), ("Carga/descarga", "variable"),
        ]
        shp_sample = random.sample(shipment_ids, min(30, len(shipment_ids)))
        for shp_id in shp_sample:
            for _ in range(2):
                concepto, tipo = pick(conceptos)
                row = {
                    "shipment_id": shp_id,
                    "concepto": f"{concepto}",
                    "monto": rand_money(500, 30000),
                    "moneda": pick(["ARS", "USD"]),
                    "tipo": tipo,
                    "created_by": self.refs.rand_user(),
                    "created_at": rand_datetime(days_back=90),
                }
                try:
                    self.insert_no_return("tms_shipment_costs", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"tms_shipment_costs: {count} insertados")

    # ------------------------------------------------------------------
    # tms_consolidations  (~5 records)
    # Cols: codigo, estado, tipo, destino, fecha_corte, peso_total, volumen_total,
    #       shipments_count, ahorro_estimado, created_by
    # ------------------------------------------------------------------
    def _seed_consolidations(self):
        count = 0
        tipos = ["LTL", "FTL", "intermodal"]
        for i in range(1, 6):
            row = {
                "codigo": seed_code("CON", i),
                "estado": pick(CONSOLIDACION_ESTADOS),
                "tipo": pick(tipos),
                "destino": self.refs.rand_centro(),
                "fecha_corte": rand_future_date(days_min=1, days_max=14),
                "peso_total": round(random.uniform(2000, 20000), 2),
                "volumen_total": round(random.uniform(5, 100), 2),
                "shipments_count": random.randint(2, 10),
                "ahorro_estimado": rand_money(1000, 50000),
                "created_by": self.refs.rand_user(),
                "created_at": rand_datetime(days_back=90),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                self.insert_no_return("tms_consolidations", row)
                count += 1
            except Exception:
                pass

        self.log(f"tms_consolidations: {count} insertados")

    # ------------------------------------------------------------------
    # tms_settlements  (~10 records)
    # Cols: shipment_id, estado, total_costos, total_cobrado, diferencia, notas
    # ------------------------------------------------------------------
    def _seed_settlements(self, delivered_ids):
        count = 0
        pool = delivered_ids[:10] if len(delivered_ids) >= 10 else delivered_ids
        for shp_id in pool:
            total_costos = rand_money(5000, 80000)
            total_cobrado = rand_money(total_costos * 1.05, total_costos * 1.4)
            diferencia = round(total_cobrado - total_costos, 2)

            row = {
                "shipment_id": shp_id,
                "estado": pick(SETTLEMENT_ESTADOS),
                "total_costos": total_costos,
                "total_cobrado": round(total_cobrado, 2),
                "diferencia": diferencia,
                "notas": f"{fake.sentence(nb_words=8)}",
                "created_at": rand_datetime(days_back=45),
            }
            try:
                self.insert_no_return("tms_settlements", row)
                count += 1
            except Exception:
                pass

        self.log(f"tms_settlements: {count} insertados")

    # ------------------------------------------------------------------
    # tms_tariffs  (~6 records)
    # Cols: transportista, origen, destino, tipo_servicio, tarifa_base,
    #       tarifa_kg, tarifa_m3, moneda, vigencia_desde, vigencia_hasta, activo
    # ------------------------------------------------------------------
    def _seed_tariffs(self):
        count = 0
        transportistas = ["TransArgentina SA", "Logistica Sur SRL", "Cargas del Norte",
                          "Express Patagonia", "TransAndina SA", "Fletes Rapidos SRL"]
        servicios = ["standard", "express", "economia", "hazmat"]
        for i in range(1, 7):
            row = {
                "transportista": f"{transportistas[i-1]}",
                "origen": self.refs.rand_centro(),
                "destino": self.refs.rand_centro(),
                "tipo_servicio": pick(servicios),
                "tarifa_base": rand_money(5000, 50000),
                "tarifa_kg": round(random.uniform(0.5, 5.0), 2),
                "tarifa_m3": round(random.uniform(100, 800), 2),
                "moneda": pick(["ARS", "USD"]),
                "vigencia_desde": rand_past_date(days_min=30, days_max=365),
                "vigencia_hasta": rand_future_date(days_min=30, days_max=365),
                "activo": True,
                "created_at": rand_datetime(days_back=365),
            }
            try:
                self.insert_no_return("tms_tariffs", row)
                count += 1
            except Exception:
                pass

        self.log(f"tms_tariffs: {count} insertados")

    # ------------------------------------------------------------------
    # tms_fuel_log  (~15 records)
    # Cols: vehicle_id, shipment_id, litros, costo, odometro, estacion, created_by
    # ------------------------------------------------------------------
    def _seed_fuel_log(self, shipment_ids):
        count = 0
        estaciones = ["YPF", "Shell", "Axion", "Petrobras", "Puma"]
        for i in range(1, 16):
            litros = round(random.uniform(30, 200), 2)
            costo = round(litros * random.uniform(1, 3), 2)
            shp = pick(shipment_ids) if shipment_ids and random.random() > 0.3 else None

            row = {
                "vehicle_id": random.randint(1, 15),
                "shipment_id": shp,
                "litros": litros,
                "costo": costo,
                "odometro": random.randint(5000, 300000),
                "estacion": f"{pick(estaciones)} {fake.city()}",
                "created_by": self.refs.rand_user(),
                "created_at": rand_datetime(days_back=180),
            }
            try:
                self.insert_no_return("tms_fuel_log", row)
                count += 1
            except Exception:
                pass

        self.log(f"tms_fuel_log: {count} insertados")

    # ------------------------------------------------------------------
    # tms_config  (~5 records)
    # Cols: clave (UNIQUE), valor, updated_by, updated_at
    # ------------------------------------------------------------------
    def _seed_config(self):
        count = 0
        configs = [
            ("tms.max_weight_kg", "10000"),
            ("tms.sla_express_hs", "24"),
            ("tms.sla_standard_hs", "72"),
            ("tms.fuel_surcharge_pct", "8.5"),
            ("tms.tracking_interval", "15"),
        ]
        for key, valor in configs:
            row = {
                "clave": f"{SEED_PREFIX}{key}",
                "valor": valor,
                "updated_by": str(self.refs.rand_user()),
                "updated_at": rand_datetime(days_back=90),
            }
            try:
                self.insert_no_return("tms_config", row)
                count += 1
            except Exception:
                pass

        self.log(f"tms_config: {count} insertados")

    # ------------------------------------------------------------------
    # tms_audit_log  (~20 records)
    # Cols: entidad, entidad_id, accion, datos_antes, datos_despues, usuario_id, ip_address
    # ------------------------------------------------------------------
    def _seed_audit_log(self):
        count = 0
        entidades = ["shipment", "vehicle", "driver", "route"]
        acciones = ["create", "update", "delete"]

        for i in range(1, 21):
            entidad = pick(entidades)
            accion = pick(acciones)
            datos_antes = None
            if accion in ("update", "delete"):
                datos_antes = json.dumps({"estado": "anterior", "campo": fake.word()})

            datos_despues = json.dumps({"estado": "nuevo", "campo": fake.word()})
            ip = f"{random.randint(10,200)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"

            row = {
                "entidad": entidad,
                "entidad_id": str(random.randint(1, 200)),
                "accion": accion,
                "datos_antes": datos_antes,
                "datos_despues": datos_despues,
                "usuario_id": self.refs.rand_user(),
                "ip_address": ip,
                "created_at": rand_datetime(days_back=180),
            }
            try:
                self.insert_no_return("tms_audit_log", row)
                count += 1
            except Exception:
                pass

        self.log(f"tms_audit_log: {count} insertados")

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
