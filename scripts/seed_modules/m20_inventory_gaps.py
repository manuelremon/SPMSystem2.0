"""
Seed Module 20: Inventory Gaps
Tablas de inventario que impactan páginas visibles del frontend.

Tablas:
- nivel_servicio_objetivo (ServiceLevels.jsx)
- lote_genealogia (LotDetail.jsx - tab genealogía)
- slob_disposicion (InventoryOptimization.jsx SLOB) - solo si <5 rows
"""

import random

from ._base import (
    SEED_PREFIX,
    SeedModule,
    fake,
    pick,
    rand_datetime,
    rand_past_date,
    rand_pct,
)


class InventoryGapsSeed(SeedModule):
    name = "inventory_gaps"
    description = "Nivel servicio, genealogía lotes, SLOB disposición"
    tables = [
        # Clean in reverse dependency order
        "slob_disposicion",
        "lote_genealogia",
        "nivel_servicio_objetivo",
    ]

    def seed(self):
        self._seed_nivel_servicio_objetivo()
        self._seed_lote_genealogia()
        self._seed_slob_disposicion()

    # ------------------------------------------------------------------
    # nivel_servicio_objetivo  (~30 records)
    # Cols: material_codigo, almacen, nivel_servicio, stock_seguridad_calculado,
    #       punto_reorden_calculado, clasificacion_abc, ultimo_calculo,
    #       created_at, updated_at
    # ------------------------------------------------------------------
    def _seed_nivel_servicio_objetivo(self):
        count = 0
        clasificaciones = ["A", "B", "C"]
        materiales = self.refs.material_codes[:30] if len(self.refs.material_codes) >= 30 else self.refs.material_codes

        for mat in materiales:
            abc = pick(clasificaciones)
            # Nivel de servicio correlacionado con ABC
            nivel = {
                "A": round(random.uniform(0.95, 0.99), 4),
                "B": round(random.uniform(0.90, 0.96), 4),
                "C": round(random.uniform(0.80, 0.92), 4),
            }[abc]

            stock_seg = round(random.uniform(5, 200), 2)
            pto_reorden = round(stock_seg * random.uniform(1.5, 3.0), 2)

            row = {
                "material_codigo": mat,
                "almacen": self.refs.rand_almacen(),
                "nivel_servicio": nivel,
                "stock_seguridad_calculado": stock_seg,
                "punto_reorden_calculado": pto_reorden,
                "clasificacion_abc": abc,
                "ultimo_calculo": rand_datetime(days_back=30),
                "created_at": rand_datetime(days_back=90),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                self.insert_no_return("nivel_servicio_objetivo", row)
                count += 1
            except Exception:
                pass

        self.log(f"nivel_servicio_objetivo: {count} insertados")

    # ------------------------------------------------------------------
    # lote_genealogia  (~15 records)
    # Cols: lote_padre_id, lote_hijo_id, relacion, cantidad_utilizada, created_at
    # ------------------------------------------------------------------
    def _seed_lote_genealogia(self):
        count = 0

        # Query existing lote IDs
        try:
            cursor = self.conn.cursor()
            cursor.execute("SELECT id FROM lote ORDER BY id LIMIT 30")
            lote_ids = [r[0] for r in cursor.fetchall()]
        except Exception:
            lote_ids = []

        if len(lote_ids) < 2:
            self.log("lote_genealogia: 0 (necesita al menos 2 lotes)")
            return

        relaciones = ["origen", "derivado", "mezcla", "fraccionamiento", "reproceso"]
        used_pairs = set()

        for _ in range(min(15, len(lote_ids) * 2)):
            padre = pick(lote_ids)
            hijo = pick(lote_ids)
            # Evitar auto-referencia y duplicados
            attempts = 0
            while (padre == hijo or (padre, hijo) in used_pairs) and attempts < 10:
                padre = pick(lote_ids)
                hijo = pick(lote_ids)
                attempts += 1
            if padre == hijo:
                continue
            used_pairs.add((padre, hijo))

            row = {
                "lote_padre_id": padre,
                "lote_hijo_id": hijo,
                "relacion": pick(relaciones),
                "cantidad_utilizada": round(random.uniform(1, 100), 2),
                "created_at": rand_datetime(days_back=90),
            }
            try:
                self.insert_no_return("lote_genealogia", row)
                count += 1
            except Exception:
                pass

        self.log(f"lote_genealogia: {count} insertados")

    # ------------------------------------------------------------------
    # slob_disposicion  (~20 records, solo si hay <5 con SEED marker)
    # Cols: material_codigo, almacen, cantidad, tipo_disposicion, estado,
    #       notas, costo_recuperado, propuesto_por, aprobado_por,
    #       completado_at, created_at
    # ------------------------------------------------------------------
    def _seed_slob_disposicion(self):
        # Check existing count
        try:
            cursor = self.conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM slob_disposicion WHERE notas LIKE ?",
                (f"%{SEED_PREFIX}%",),
            )
            existing = cursor.fetchone()[0]
        except Exception:
            existing = 0

        if existing >= 5:
            self.log(f"slob_disposicion: ya hay {existing} seed records, skip")
            return

        count = 0
        tipos = ["reclasificar", "donar", "vender_descuento", "scrapping", "devolver_proveedor"]
        estados = ["propuesta", "aprobada", "en_ejecucion", "completada", "rechazada"]

        for _ in range(20):
            tipo = pick(tipos)
            estado = pick(estados)
            cantidad = round(random.uniform(5, 200), 2)

            row = {
                "material_codigo": self.refs.rand_material(),
                "almacen": self.refs.rand_almacen(),
                "cantidad": cantidad,
                "tipo_disposicion": tipo,
                "estado": estado,
                "notas": f"Disposición SLOB - {tipo}",
                "costo_recuperado": round(cantidad * random.uniform(0.1, 0.6), 2) if estado == "completada" else None,
                "propuesto_por": int(self.refs.rand_user()),
                "aprobado_por": int(self.refs.rand_admin()) if estado in ("aprobada", "en_ejecucion", "completada") else None,
                "completado_at": rand_datetime(days_back=15) if estado == "completada" else None,
                "created_at": rand_datetime(days_back=60),
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
