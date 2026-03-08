"""
Seed Module 09: Prices
Listas de precios de proveedores, historial de precios, negociaciones, rebates.

Tablas:
- lista_precios
- precio_item
- precio_historial
- precio_negociacion
- rebate_programa
- rebate_calculo
"""

import random

from ._base import (
    UNIDADES,
    SeedModule,
    fake,
    pick,
    rand_datetime,
    rand_future_date,
    rand_money,
    rand_past_date,
    rand_pct,
    seed_code,
)

LISTA_ESTADOS = ["active", "expired", "draft"]

NEGOCIACION_ESTADOS = ["pending", "approved", "rejected"]

REBATE_TIPOS = ["volume", "growth", "flat"]

REBATE_ESTADOS = ["active", "paused", "expired"]

REBATE_CALCULO_ESTADOS = ["calculated", "claimed", "approved", "paid"]


class PricesSeed(SeedModule):
    name = "prices"
    description = "Listas precios, historial, negociaciones, rebates"
    tables = [
        "rebate_calculo",
        "rebate_programa",
        "precio_negociacion",
        "precio_historial",
        "precio_item",
        "lista_precios",
    ]

    def seed(self):
        lista_ids = self._seed_listas_precios()
        self._seed_precio_items(lista_ids)
        self._seed_precio_historial()
        self._seed_negociaciones()
        programa_ids = self._seed_rebate_programas()
        self._seed_rebate_calculos(programa_ids)

    # ------------------------------------------------------------------
    # lista_precios  (~8 records)
    # ------------------------------------------------------------------
    def _seed_listas_precios(self):
        lista_ids = []

        nombres = [
            "Lista General Anual",
            "Precios Especiales Volumen",
            "Tarifa Mantenimiento Correctivo",
            "Precios Acuerdo Marco",
            "Lista Spot Emergencias",
            "Precios Contrato Suministro",
            "Tarifa Repuestos Originales",
            "Lista Insumos Industriales",
        ]

        for i in range(8):
            cuit = self.refs.rand_proveedor()
            estado = pick(LISTA_ESTADOS)
            moneda = pick(["USD", "ARS"])
            nombre = nombres[i % len(nombres)]

            vigencia_desde = rand_past_date(days_min=30, days_max=365)
            vigencia_hasta = rand_future_date(days_min=30, days_max=365)

            if estado == "expired":
                vigencia_hasta = rand_past_date(days_min=1, days_max=180)

            created_at = rand_datetime(days_back=400)

            row = {
                "nombre": f"{nombre} {i + 1:02d}",
                "proveedor_cuit": cuit,
                "moneda": moneda,
                "fecha_vigencia_desde": vigencia_desde,
                "fecha_vigencia_hasta": vigencia_hasta,
                "estado": estado,
                "notas": f"{fake.sentence(nb_words=8)}",
                "created_by": int(self.refs.rand_user()),
                "created_at": created_at,
            }
            try:
                lid = self.insert("lista_precios", row)
                if lid:
                    lista_ids.append(lid)
            except Exception:
                pass

        self.log(f"lista_precios: {len(lista_ids)} insertados")
        return lista_ids

    # ------------------------------------------------------------------
    # precio_item  (~40 records, 5 per lista)
    # ------------------------------------------------------------------
    def _seed_precio_items(self, lista_ids):
        count = 0

        for lid in lista_ids:
            used_materials = set()
            for _ in range(5):
                material_codigo = self.refs.rand_material()

                # Avoid duplicate (lista_id, material_codigo)
                attempts = 0
                while material_codigo in used_materials and attempts < 10:
                    material_codigo = self.refs.rand_material()
                    attempts += 1
                used_materials.add(material_codigo)

                precio_unit = rand_money(50, 30000)
                descuento = round(rand_pct(0, 15), 2)
                cantidad_min = random.randint(1, 10)
                cantidad_max = random.randint(cantidad_min + 1, 500) if random.random() > 0.5 else None

                row = {
                    "lista_id": lid,
                    "material_codigo": material_codigo,
                    "precio_unitario": precio_unit,
                    "unidad": pick(UNIDADES),
                    "cantidad_minima": cantidad_min,
                    "cantidad_maxima": cantidad_max,
                    "descuento_pct": descuento,
                    "created_at": rand_datetime(days_back=365),
                }
                try:
                    self.insert_no_return("precio_item", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"precio_item: {count} insertados")

    # ------------------------------------------------------------------
    # precio_historial  (~50 records)
    # ------------------------------------------------------------------
    def _seed_precio_historial(self):
        count = 0

        fuentes = ["lista_precios", "negociacion", "contrato", "manual"]

        for _ in range(50):
            cuit = self.refs.rand_proveedor()
            material_codigo = self.refs.rand_material()

            precio = rand_money(100, 40000)
            fecha_desde = rand_past_date(days_min=30, days_max=730)
            fecha_hasta = rand_future_date(days_min=30, days_max=365) if random.random() > 0.3 else None
            fuente = pick(fuentes)

            row = {
                "material_codigo": material_codigo,
                "proveedor_cuit": cuit,
                "precio": precio,
                "fecha_desde": fecha_desde,
                "fecha_hasta": fecha_hasta,
                "fuente": fuente,
                "referencia_id": random.randint(1, 50) if random.random() > 0.5 else None,
                "created_at": rand_datetime(days_back=730),
            }
            try:
                self.insert_no_return("precio_historial", row)
                count += 1
            except Exception:
                pass

        self.log(f"precio_historial: {count} insertados")

    # ------------------------------------------------------------------
    # precio_negociacion  (~10 records)
    # ------------------------------------------------------------------
    def _seed_negociaciones(self):
        count = 0

        for i in range(10):
            estado = pick(NEGOCIACION_ESTADOS)
            cuit = self.refs.rand_proveedor()
            material_codigo = self.refs.rand_material()

            precio_anterior = rand_money(500, 50000)
            # precio_nuevo is 5-15% lower than anterior when approved
            descuento_negociado = 0.0
            if estado == "approved":
                reduccion = round(random.uniform(0.05, 0.15), 4)
                descuento_negociado = round(reduccion * 100, 2)
            precio_nuevo = round(precio_anterior * (1 - descuento_negociado / 100), 2)

            aprobado_por = int(self.refs.rand_admin()) if estado == "approved" else None
            fecha = rand_past_date(days_min=1, days_max=365)
            created_at = rand_datetime(days_back=365)

            row = {
                "material_codigo": material_codigo,
                "proveedor_cuit": cuit,
                "precio_anterior": precio_anterior,
                "precio_nuevo": precio_nuevo,
                "descuento_negociado_pct": descuento_negociado,
                "negociado_por": int(self.refs.rand_user()),
                "fecha": fecha,
                "notas": f"Negociación {seed_code('NEG', i + 1)}",
                "estado": estado,
                "aprobado_por": aprobado_por,
                "created_at": created_at,
            }
            try:
                self.insert("precio_negociacion", row)
                count += 1
            except Exception:
                pass

        self.log(f"precio_negociacion: {count} insertados")

    # ------------------------------------------------------------------
    # rebate_programa  (~6 records)
    # ------------------------------------------------------------------
    def _seed_rebate_programas(self):
        programa_ids = []

        nombres_programa = [
            "Programa Rebate Volumen Anual",
            "Incentivo Crecimiento Q1",
            "Rebate Fidelidad Proveedor",
            "Programa Descuento Escalonado",
            "Rebate Meta Trimestral",
            "Incentivo Compra Anticipada",
        ]

        for i in range(6):
            tipo = pick(REBATE_TIPOS)
            estado = pick(REBATE_ESTADOS)

            periodo_inicio = rand_past_date(days_min=30, days_max=365)
            periodo_fin = rand_future_date(days_min=30, days_max=365)

            if estado == "expired":
                periodo_fin = rand_past_date(days_min=1, days_max=60)

            porcentaje_rebate = round(random.uniform(1, 8), 2)

            created_at = rand_datetime(days_back=400)

            row = {
                "contrato_id": random.randint(1, 50) if random.random() > 0.3 else None,
                "nombre": f"{nombres_programa[i]}",
                "tipo": tipo,
                "umbral_cantidad": round(random.uniform(100, 10000), 2),
                "umbral_monto": rand_money(100000, 5000000),
                "porcentaje_rebate": porcentaje_rebate,
                "monto_fijo": round(random.uniform(500, 50000), 2) if random.random() > 0.5 else None,
                "periodo_inicio": periodo_inicio,
                "periodo_fin": periodo_fin,
                "estado": estado,
                "created_at": created_at,
                "updated_at": created_at,
            }
            try:
                pid = self.insert("rebate_programa", row)
                if pid:
                    programa_ids.append(pid)
            except Exception:
                pass

        self.log(f"rebate_programa: {len(programa_ids)} insertados")
        return programa_ids

    # ------------------------------------------------------------------
    # rebate_calculo  (~18 records, 3 per programa)
    # ------------------------------------------------------------------
    def _seed_rebate_calculos(self, programa_ids):
        count = 0

        periodos = ["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4",
                     "2026-Q1", "2026-Q2"]

        for pid in programa_ids:
            used_periodos = set()
            for _ in range(3):
                periodo = pick(periodos)
                attempts = 0
                while periodo in used_periodos and attempts < 10:
                    periodo = pick(periodos)
                    attempts += 1
                used_periodos.add(periodo)

                monto_base = rand_money(50000, 2000000)
                monto_rebate = round(monto_base * random.uniform(0.01, 0.08), 2)
                estado = pick(REBATE_CALCULO_ESTADOS)

                row = {
                    "programa_id": pid,
                    "periodo": periodo,
                    "monto_base": monto_base,
                    "cantidad_comprada": round(random.uniform(100, 10000), 2),
                    "monto_rebate": monto_rebate,
                    "estado": estado,
                    "created_at": rand_datetime(days_back=365),
                }
                try:
                    self.insert_no_return("rebate_calculo", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"rebate_calculo: {count} insertados")

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
