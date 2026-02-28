"""
Seed Module 18: Kitting
BOM (Bill of Materials), ordenes de ensamblado de kits, detalles y asignacion de componentes.

Tablas:
- kit_bom
- kit_bom_componente
- kit_orden
- kit_orden_detalle
- kit_componente_asignacion
"""

import random

from ._base import (
    SEED_PREFIX,
    SEED_TAG,
    UNIDADES,
    SeedModule,
    fake,
    pick,
    rand_datetime,
    rand_future_date,
    rand_past_date,
    seed_code,
)

BOM_DESCRIPTIONS = [
    "Kit mantenimiento valvulas de proceso",
    "Kit inspeccion equipos rotativos",
    "Kit reparacion bombas centrifugas",
    "Kit instrumentacion de campo",
    "Kit herramientas electricas certificadas",
    "Kit seguridad personal EPP completo",
    "Kit lubricacion y engrase preventivo",
    "Kit soldadura y corte industrial",
]

KIT_ESTADO_OPTIONS = ["activo", "draft", "obsoleto"]

KIT_ORDEN_ESTADO_OPTIONS = ["pendiente", "en_proceso", "completado", "cancelado"]

KIT_PRIORIDAD_OPTIONS = ["baja", "media", "alta", "critica"]

COMPONENTE_ESTADO_OPTIONS = ["pending", "allocated", "picked", "consumed", "short"]

# Rack aisle-bay-level format: e.g. "A-02-01"
AISLES = ["A", "B", "C", "D", "E"]


def _rand_ubicacion():
    """Generate a random warehouse location in the format 'X-NN-NN'."""
    aisle = pick(AISLES)
    bay = random.randint(1, 12)
    level = random.randint(1, 5)
    return f"{aisle}-{bay:02d}-{level:02d}"


class KittingSeed(SeedModule):
    name = "kitting"
    description = "BOM, kit ordenes, detalles, asignacion"
    tables = [
        "kit_componente_asignacion",
        "kit_orden_detalle",
        "kit_orden",
        "kit_bom_componente",
        "kit_bom",
    ]

    def seed(self):
        bom_ids = self._seed_kit_bom()
        componente_ids = self._seed_kit_bom_componente(bom_ids)
        orden_ids = self._seed_kit_orden(bom_ids)
        self._seed_kit_orden_detalle(orden_ids, componente_ids)
        self._seed_kit_componente_asignacion(orden_ids, componente_ids)

    # ------------------------------------------------------------------
    # kit_bom  (~8 records)
    # ------------------------------------------------------------------
    def _seed_kit_bom(self):
        bom_ids = []

        for i, desc in enumerate(BOM_DESCRIPTIONS, start=1):
            estado = pick(KIT_ESTADO_OPTIONS)
            version = random.randint(1, 3)

            row = {
                "kit_codigo": seed_code("BOM", i),
                "nombre": f"{SEED_TAG} {desc}",
                "descripcion": f"{SEED_TAG} {fake.paragraph(nb_sentences=2)}",
                "estado": estado,
                "version": version,
                "creado_por": self.refs.rand_user(),
                "created_at": rand_datetime(days_back=365),
            }
            try:
                bid = self.insert("kit_bom", row)
                if bid:
                    bom_ids.append(bid)
            except Exception:
                pass

        self.log(f"kit_bom: {len(bom_ids)} insertados")
        return bom_ids

    # ------------------------------------------------------------------
    # kit_bom_componente  (~40 records, 5 per BOM)
    # ------------------------------------------------------------------
    def _seed_kit_bom_componente(self, bom_ids):
        componente_ids = []
        count = 0

        bom_pool = bom_ids if bom_ids else [1]

        for bom_id in bom_pool:
            for secuencia in range(1, 6):
                material = self.refs.rand_material()
                cantidad = round(random.uniform(1, 20), 2)
                unidad = pick(UNIDADES)
                es_opcional = random.randint(0, 1)

                # ~30% of components have an alternative material
                alternativa = self.refs.rand_material() if random.random() > 0.7 else None

                row = {
                    "kit_bom_id": bom_id,
                    "material_codigo": material,
                    "cantidad": cantidad,
                    "unidad": unidad,
                    "es_opcional": es_opcional,
                    "alternativa_material": alternativa,
                    "secuencia": secuencia,
                    "notas": f"{SEED_TAG} {fake.sentence(nb_words=7)}",
                    "created_at": rand_datetime(days_back=300),
                }
                try:
                    cid = self.insert("kit_bom_componente", row)
                    if cid:
                        componente_ids.append(cid)
                    count += 1
                except Exception:
                    pass

        self.log(f"kit_bom_componente: {count} insertados")
        return componente_ids

    # ------------------------------------------------------------------
    # kit_orden  (~12 records)
    # ------------------------------------------------------------------
    def _seed_kit_orden(self, bom_ids):
        orden_ids = []
        bom_pool = bom_ids if bom_ids else [1]

        for i in range(1, 13):
            estado = pick(KIT_ORDEN_ESTADO_OPTIONS)
            bom_id = pick(bom_pool)

            fecha_requerida = rand_future_date(days_min=5, days_max=90)

            fecha_inicio = None
            if estado in ("en_proceso", "completado"):
                fecha_inicio = rand_past_date(days_min=1, days_max=30)

            fecha_completado = None
            if estado == "completado":
                fecha_completado = rand_past_date(days_min=1, days_max=15)

            row = {
                "numero_orden": seed_code("KIT", i),
                "kit_bom_id": bom_id,
                "cantidad_kits": random.randint(1, 20),
                "estado": estado,
                "prioridad": pick(KIT_PRIORIDAD_OPTIONS),
                "almacen_id": self.refs.rand_almacen(),
                "solicitante_id": self.refs.rand_user(),
                "fecha_requerida": fecha_requerida,
                "fecha_inicio": fecha_inicio,
                "fecha_completado": fecha_completado,
                "notas": f"{SEED_TAG} {fake.sentence(nb_words=9)}",
                "created_at": rand_datetime(days_back=180),
            }
            try:
                oid = self.insert("kit_orden", row)
                if oid:
                    orden_ids.append((oid, estado))
            except Exception:
                pass

        self.log(f"kit_orden: {len(orden_ids)} insertados")
        return orden_ids

    # ------------------------------------------------------------------
    # kit_orden_detalle  (~60 records, 5 per orden)
    # ------------------------------------------------------------------
    def _seed_kit_orden_detalle(self, orden_ids, componente_ids):
        count = 0
        comp_pool = componente_ids if componente_ids else [1]

        for orden_id, estado_orden in orden_ids:
            for _ in range(5):
                componente_id = pick(comp_pool)
                cantidad_requerida = round(random.uniform(1, 50), 2)

                # Determine detail state based on kit order state
                if estado_orden == "pendiente":
                    estado_det = "pending"
                    cantidad_asignada = 0.0
                    cantidad_consumida = 0.0
                elif estado_orden == "en_proceso":
                    estado_det = pick(["asignado", "faltante"])
                    cantidad_asignada = (
                        round(cantidad_requerida * random.uniform(0.5, 1.0), 2)
                        if estado_det == "asignado"
                        else 0.0
                    )
                    cantidad_consumida = 0.0
                elif estado_orden == "completado":
                    estado_det = "consumido"
                    cantidad_asignada = cantidad_requerida
                    cantidad_consumida = cantidad_requerida
                else:
                    # cancelado
                    estado_det = pick(["pending", "faltante"])
                    cantidad_asignada = 0.0
                    cantidad_consumida = 0.0

                # ~40% of details reference a lot
                lote_id = random.randint(1, 200) if random.random() > 0.6 else None

                row = {
                    "orden_id": orden_id,
                    "componente_id": componente_id,
                    "lote_id": lote_id,
                    "cantidad_requerida": cantidad_requerida,
                    "cantidad_asignada": cantidad_asignada,
                    "cantidad_consumida": cantidad_consumida,
                    "estado": estado_det,
                    "ubicacion_origen": _rand_ubicacion(),
                    "created_at": rand_datetime(days_back=150),
                }
                try:
                    self.insert_no_return("kit_orden_detalle", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"kit_orden_detalle: {count} insertados")

    # ------------------------------------------------------------------
    # kit_componente_asignacion  (~60 records, 5 per orden)
    # ------------------------------------------------------------------
    def _seed_kit_componente_asignacion(self, orden_ids, componente_ids):
        count = 0
        comp_pool = componente_ids if componente_ids else [1]

        for orden_id, estado_orden in orden_ids:
            for _ in range(5):
                componente_id = pick(comp_pool)
                cantidad_requerida = round(random.uniform(1, 50), 2)

                # Determine assignment state based on kit order state
                if estado_orden == "pendiente":
                    estado_comp = "pending"
                    cantidad_asignada = 0.0
                    cantidad_consumida = 0.0
                elif estado_orden == "en_proceso":
                    estado_comp = pick(["allocated", "short"])
                    cantidad_asignada = (
                        round(cantidad_requerida * random.uniform(0.5, 1.0), 2)
                        if estado_comp == "allocated"
                        else 0.0
                    )
                    cantidad_consumida = 0.0
                elif estado_orden == "completado":
                    estado_comp = "consumed"
                    cantidad_asignada = cantidad_requerida
                    cantidad_consumida = cantidad_requerida
                else:
                    # cancelado
                    estado_comp = pick(["pending", "short"])
                    cantidad_asignada = 0.0
                    cantidad_consumida = 0.0

                # ~40% of assignments reference a lot
                lote_id = random.randint(1, 200) if random.random() > 0.6 else None

                row = {
                    "orden_id": orden_id,
                    "componente_id": componente_id,
                    "lote_id": lote_id,
                    "cantidad_requerida": cantidad_requerida,
                    "cantidad_asignada": cantidad_asignada,
                    "cantidad_consumida": cantidad_consumida,
                    "estado": estado_comp,
                    "ubicacion_origen": _rand_ubicacion(),
                    "created_at": rand_datetime(days_back=150),
                }
                try:
                    self.insert_no_return("kit_componente_asignacion", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"kit_componente_asignacion: {count} insertados")

    def clean(self):
        cursor = self.conn.cursor()
        clean_map = {
            "kit_componente_asignacion": None,
            "kit_orden_detalle": None,
            "kit_orden": "numero_orden",
            "kit_bom_componente": "notas",
            "kit_bom": "kit_codigo",
        }
        for table, col in clean_map.items():
            if col is None:
                continue
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
