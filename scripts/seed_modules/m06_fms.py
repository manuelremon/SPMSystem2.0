"""
Seed Module 06: FMS (Fleet Management System)
Vehículos, conductores, work orders, inspecciones.

Tablas:
- fms_vehicles
- fms_drivers
- fms_maintenance_plans
- fms_work_orders
- fms_wo_parts
- fms_vehicle_docs
- fms_inspections
- fms_inspection_items
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

MARCAS_MODELOS = {
    "Ford": ["F-4000", "Cargo 816", "Cargo 1317", "Transit"],
    "Mercedes": ["Accelo 1016", "Atego 1725", "Actros 2646"],
    "Volvo": ["FH 460", "FM 370", "FMX 460"],
    "Scania": ["R 450", "G 410", "P 280"],
    "Iveco": ["Daily 35S14", "Tector 240E28", "Stralis 440S46"],
}

TIPOS_VEHICULO = ["camion", "camioneta", "trailer", "van"]
TIPOS_COMBUSTIBLE = ["diesel", "gasolina"]

TIPOS_LICENCIA = ["A", "B", "C", "D", "federal"]

TIPOS_MANTENIMIENTO = ["preventivo", "predictivo"]

WO_ESTADOS = ["draft", "approved", "in_progress", "completed", "closed"]
WO_TIPOS = ["preventivo", "correctivo", "emergencia"]

PARTS_ESTADOS = ["pendiente", "solicitado", "recibido", "instalado"]

TIPOS_DOCUMENTO = [
    "seguro",
    "verificacion",
    "tarjeta_circulacion",
    "permiso_sct",
]

INSPECTION_TIPOS = ["pre_trip", "post_trip"]
INSPECTION_RESULTADOS = ["aprobado", "rechazado", "con_observaciones"]

CHECKLIST_ITEMS = [
    ("Frenos", "seguridad"),
    ("Luces delanteras", "electrico"),
    ("Luces traseras", "electrico"),
    ("Neumaticos", "seguridad"),
    ("Aceite motor", "mecanico"),
    ("Suspension", "mecanico"),
    ("Direccion", "mecanico"),
    ("Extintor", "seguridad"),
    ("Cinturones", "seguridad"),
    ("Espejos", "visibilidad"),
    ("Parabrisas", "visibilidad"),
    ("Bocina", "electrico"),
]


class FMSSeed(SeedModule):
    name = "fms"
    description = "Vehículos, conductores, work orders, inspecciones"
    tables = [
        "fms_inspections",
        "fms_vehicle_documents",
        "fms_wo_parts",
        "fms_work_orders",
        "fms_maintenance_plans",
        "fms_drivers",
        "fms_vehicles",
    ]

    def seed(self):
        vehicle_ids = self._seed_vehicles()
        driver_ids = self._seed_drivers()
        plan_ids = self._seed_maintenance_plans(vehicle_ids)
        wo_ids = self._seed_work_orders(vehicle_ids, plan_ids)
        self._seed_wo_parts(wo_ids)
        self._seed_vehicle_documents(vehicle_ids)
        self._seed_inspections(vehicle_ids, driver_ids)

    # ------------------------------------------------------------------
    # fms_vehicles  (~15 records)
    # ------------------------------------------------------------------
    def _seed_vehicles(self):
        vehicle_ids = []
        estados = ["disponible", "en_ruta", "en_mantenimiento"]

        for i in range(1, 16):
            marca = pick(list(MARCAS_MODELOS.keys()))
            modelo = pick(MARCAS_MODELOS[marca])
            anio = random.randint(2018, 2024)
            cap_peso = round(random.uniform(3500, 35000), 0)
            cap_vol = round(random.uniform(10, 100), 1)
            odometro = random.randint(5000, 300000)

            row = {
                "patente": f"{SEED_PREFIX}{fake.bothify('??###??').upper()}",
                "codigo": seed_code("VEH", i),
                "tipo": pick(TIPOS_VEHICULO),
                "marca": marca,
                "modelo": modelo,
                "anio": anio,
                "capacidad_kg": cap_peso,
                "capacidad_m3": cap_vol,
                "km_actual": odometro,
                "estado": pick(estados),
                "requiere_frio": bool(random.randint(0, 1)),
                "requiere_hazmat": bool(random.randint(0, 1)),
                "proximo_mantenimiento": rand_future_date(days_min=7, days_max=120),
                "activo": True,
                "created_at": rand_datetime(days_back=730),
            }
            try:
                vid = self.insert("fms_vehicles", row)
                if vid:
                    vehicle_ids.append(vid)
            except Exception:
                pass

        self.log(f"fms_vehicles: {len(vehicle_ids)} insertados")
        return vehicle_ids

    # ------------------------------------------------------------------
    # fms_drivers  (~10 records)
    # ------------------------------------------------------------------
    def _seed_drivers(self):
        driver_ids = []
        for i in range(1, 11):
            row = {
                "nombre": f"{fake.first_name()} {fake.last_name()}",
                "documento": f"{SEED_PREFIX}{fake.bothify('LIC-#######')}",
                "licencia_tipo": pick(TIPOS_LICENCIA),
                "licencia_vencimiento": rand_future_date(days_min=30, days_max=730),
                "hazmat_cert": bool(random.randint(0, 1)),
                "estado": "activo",
                "telefono": fake.phone_number(),
                "created_at": rand_datetime(days_back=730),
            }
            try:
                did = self.insert("fms_drivers", row)
                if did:
                    driver_ids.append(did)
            except Exception:
                pass

        self.log(f"fms_drivers: {len(driver_ids)} insertados")
        return driver_ids

    # ------------------------------------------------------------------
    # fms_maintenance_plans  (~20 records, 1-2 per vehicle)
    # ------------------------------------------------------------------
    def _seed_maintenance_plans(self, vehicle_ids):
        plan_ids = []
        descripciones = [
            "Cambio de aceite y filtros",
            "Revision de frenos completa",
            "Inspeccion suspension y direccion",
            "Cambio de neumaticos",
            "Servicio electrico general",
            "Revision sistema de escape",
            "Calibracion inyectores",
            "Cambio de liquido de frenos",
        ]
        for vid in vehicle_ids:
            num_plans = random.randint(1, 2)
            for _ in range(num_plans):
                tipo = pick(TIPOS_MANTENIMIENTO)
                descripcion = pick(descripciones)
                intervalo_km = random.choice([5000, 10000, 20000, 50000])
                intervalo_dias = random.choice([30, 60, 90, 180, 365])

                import json as _json_mp
                items_data = [{"item": name, "categoria": cat} for name, cat in random.sample(CHECKLIST_ITEMS, 4)]
                row = {
                    "vehicle_id": vid,
                    "tipo": tipo,
                    "nombre": f"{descripcion}",
                    "intervalo_km": intervalo_km,
                    "intervalo_dias": intervalo_dias,
                    "items_json": _json_mp.dumps(items_data),
                    "activo": True,
                    "created_at": rand_datetime(days_back=365),
                }
                try:
                    pid = self.insert("fms_maintenance_plans", row)
                    if pid:
                        plan_ids.append(pid)
                except Exception:
                    pass

        self.log(f"fms_maintenance_plans: {len(plan_ids)} insertados")
        return plan_ids

    # ------------------------------------------------------------------
    # fms_work_orders  (~25 records)
    # ------------------------------------------------------------------
    def _seed_work_orders(self, vehicle_ids, plan_ids):
        wo_ids = []
        talleres = [
            "Taller Central SA", "Mecanica Express SRL", "AutoService Pro",
            "Tecnica Vehicular", "Repuestos & Servicio Ltda",
        ]

        for i in range(1, 26):
            vid = pick(vehicle_ids) if vehicle_ids else None
            estado = pick(WO_ESTADOS)
            tipo = pick(WO_TIPOS)

            fecha_ingreso = rand_past_date(days_min=1, days_max=90)
            fecha_prometida = rand_future_date(days_min=1, days_max=21)
            fecha_completado = None
            notas_extra = None

            if estado in ("completed", "closed"):
                fecha_completado = rand_past_date(days_min=1, days_max=30)
                notas_extra = f"{fake.sentence(nb_words=12)}"

            costo_mo = rand_money(1000, 20000)
            costo_partes = rand_money(500, 50000)

            row = {
                "codigo": seed_code("WO", i),
                "vehicle_id": vid,
                "tipo": tipo,
                "estado": estado,
                "prioridad": random.randint(1, 5),
                "descripcion": f"{fake.sentence(nb_words=10)}",
                "km_actual": random.randint(5000, 300000),
                "fecha_inicio": fecha_ingreso,
                "fecha_programada": fecha_prometida,
                "fecha_fin": fecha_completado,
                "costo_estimado": rand_money(500, 30000),
                "costo_real": round(costo_mo + costo_partes, 2),
                "tecnico": pick(talleres),
                "notas": f"{notas_extra}" if notas_extra else None,
                "created_by": self.refs.rand_user(),
                "created_at": rand_datetime(days_back=90),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                wid = self.insert("fms_work_orders", row)
                if wid:
                    wo_ids.append(wid)
            except Exception:
                pass

        self.log(f"fms_work_orders: {len(wo_ids)} insertados")
        return wo_ids

    # ------------------------------------------------------------------
    # fms_wo_parts  (~50 records, 2 per work order)
    # ------------------------------------------------------------------
    def _seed_wo_parts(self, wo_ids):
        count = 0
        for wo_id in wo_ids:
            for _ in range(2):
                cantidad = round(random.uniform(1, 10), 0)
                costo_unit = rand_money(200, 15000)
                row = {
                    "work_order_id": wo_id,
                    "material_id": self.refs.rand_material(),
                    "descripcion": f"{fake.catch_phrase()}",
                    "cantidad": cantidad,
                    "unidad": pick(["UN", "KG", "LT", "M"]),
                    "costo": round(cantidad * costo_unit, 2),
                    "solicitud_spm_id": None,
                }
                try:
                    self.insert_no_return("fms_wo_parts", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"fms_wo_parts: {count} insertados")

    # ------------------------------------------------------------------
    # fms_vehicle_documents  (~30 records, 2 per vehicle)
    # Cols: vehicle_id, tipo, numero, fecha_emision, fecha_vencimiento, archivo_url, notas
    # ------------------------------------------------------------------
    def _seed_vehicle_documents(self, vehicle_ids):
        count = 0
        for vid in vehicle_ids:
            doc_tipos = random.sample(TIPOS_DOCUMENTO, min(2, len(TIPOS_DOCUMENTO)))
            for tipo in doc_tipos:
                row = {
                    "vehicle_id": vid,
                    "tipo": tipo,
                    "numero": f"{SEED_PREFIX}{fake.bothify('DOC-#####')}",
                    "fecha_emision": rand_past_date(days_min=30, days_max=730),
                    "fecha_vencimiento": rand_future_date(days_min=30, days_max=730),
                    "archivo_url": None,
                    "notas": f"{fake.sentence(nb_words=7)}",
                    "created_at": rand_datetime(days_back=365),
                }
                try:
                    self.insert_no_return("fms_vehicle_documents", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"fms_vehicle_documents: {count} insertados")

    # ------------------------------------------------------------------
    # fms_inspections  (~20 records)
    # Cols: vehicle_id, driver_id, tipo, estado, items_json, firma_digital,
    #       observaciones, created_by, created_at, completed_at
    # ------------------------------------------------------------------
    def _seed_inspections(self, vehicle_ids, driver_ids):
        count = 0
        driver_pool = driver_ids if driver_ids else [None]
        estados_item = ["ok", "mal", "na"]

        for _ in range(20):
            vid = pick(vehicle_ids) if vehicle_ids else None
            did = pick(driver_pool)
            resultado = pick(INSPECTION_RESULTADOS)
            observaciones = None
            if resultado in ("rechazado", "con_observaciones"):
                observaciones = f"{fake.sentence(nb_words=10)}"
            else:
                observaciones = f"Inspeccion sin novedad"

            # Build items_json with checklist items
            items = random.sample(CHECKLIST_ITEMS, min(4, len(CHECKLIST_ITEMS)))
            items_data = []
            for item_name, categoria in items:
                estado_item = pick(estados_item)
                items_data.append({
                    "item": item_name,
                    "categoria": categoria,
                    "estado": estado_item,
                    "es_critico": categoria == "seguridad",
                    "observacion": fake.sentence(nb_words=5) if estado_item == "mal" else None,
                })

            import json as _json
            estado_map = {"aprobado": "completado", "rechazado": "rechazado", "con_observaciones": "completado"}
            row = {
                "vehicle_id": vid,
                "driver_id": did,
                "tipo": pick(INSPECTION_TIPOS),
                "estado": estado_map.get(resultado, "completado"),
                "items_json": _json.dumps(items_data),
                "observaciones": observaciones,
                "created_by": self.refs.rand_user(),
                "created_at": rand_datetime(days_back=90),
                "completed_at": rand_datetime(days_back=60) if resultado != "pendiente" else None,
            }
            try:
                self.insert_no_return("fms_inspections", row)
                count += 1
            except Exception:
                pass

        self.log(f"fms_inspections: {count} insertados")

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
