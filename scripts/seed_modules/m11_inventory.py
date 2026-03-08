"""
Seed Module 11: Inventory
Lotes, cycle count, kanban, VMI, consignment, transferencias.

Tablas reales en PG:
- lote
- lote_movimiento
- cycle_count
- cycle_count_item
- kanban_tarjeta
- consignment_stock
- vmi_programa
- vmi_reposicion
- vmi_inventario_compartido
- vmi_kpi_snapshot
- transferencia_inventario
"""

import random

from ._base import (
    SeedModule,
    fake,
    pick,
    rand_datetime,
    rand_future_date,
    rand_past_date,
    seed_code,
)

LOTE_ESTADOS = ["disponible", "reservado", "bloqueado", "agotado"]

LOTE_MOV_TIPOS = ["recepcion", "despacho", "ajuste", "transferencia", "consumo"]

CYCLE_COUNT_TIPOS = ["abc_scheduled", "spot", "full_physical"]
CYCLE_COUNT_ESTADOS = ["planned", "in_progress", "completed", "cancelled"]

KANBAN_TIPOS = ["produccion", "transporte", "proveedor"]
KANBAN_ESTADOS = ["empty", "in_transit", "full"]

VMI_ESTADOS = ["draft", "active", "suspended", "terminated"]
VMI_TIPO_REPOSICION = ["min_max", "eoq", "periodic", "forecast_based"]
VMI_ALERTAS = ["ok", "low", "critical"]
VMI_REPOSICION_ESTADOS = ["suggested", "approved", "rejected", "in_transit", "completed"]

CONSIGNMENT_ESTADOS = ["active", "paused", "closed"]

TRANSFERENCIA_ESTADOS = ["proposed", "approved", "in_transit", "received", "cancelled"]
TRANSFERENCIA_PRIORIDADES = ["low", "normal", "high", "urgent"]


def _fake_periodo(months_back=12):
    """Genera string YYYY-MM aleatorio dentro de los últimos N meses."""
    from datetime import datetime, timedelta

    delta = random.randint(0, months_back)
    dt = datetime.now() - timedelta(days=delta * 30)
    return dt.strftime("%Y-%m")


class InventorySeed(SeedModule):
    name = "inventory"
    description = "Lotes, cycle count, kanban, consignment, VMI, transferencias"
    tables = [
        # Reverse dependency order (children first) for cleanup
        "transferencia_inventario",
        "vmi_kpi_snapshot",
        "vmi_inventario_compartido",
        "vmi_reposicion",
        "vmi_programa",
        "consignment_stock",
        "kanban_tarjeta",
        "cycle_count_item",
        "cycle_count",
        "lote_movimiento",
        "lote",
    ]

    def seed(self):
        lote_ids = self._seed_lotes()
        self._seed_lote_movimientos(lote_ids)
        count_ids = self._seed_cycle_counts()
        self._seed_cycle_count_items(count_ids)
        self._seed_kanban_tarjetas()
        self._seed_consignment_stock()
        vmi_ids = self._seed_vmi_programas()
        self._seed_vmi_reposiciones(vmi_ids)
        self._seed_vmi_inventario_compartido(vmi_ids)
        self._seed_vmi_kpi_snapshots(vmi_ids)
        self._seed_transferencia_inventario()

    # ------------------------------------------------------------------
    # lote  (~20 records)
    # Cols: material_codigo, almacen, numero_lote, cantidad, fecha_produccion,
    #       fecha_vencimiento, estado, proveedor_cuit, created_at
    # ------------------------------------------------------------------
    def _seed_lotes(self):
        lote_ids = []

        for i in range(1, 21):
            estado = pick(LOTE_ESTADOS)
            cantidad_inicial = round(random.uniform(10, 500), 2)
            cantidad_disponible = round(cantidad_inicial * random.uniform(0.3, 1.0), 2)
            if estado == "agotado":
                cantidad_disponible = 0.0

            fecha_fab = rand_past_date(30, 730)
            fecha_venc = rand_future_date(30, 1095) if random.random() > 0.3 else None

            row = {
                "numero_lote": seed_code("LOT", i),
                "material_codigo": self.refs.rand_material(),
                "cantidad_inicial": cantidad_inicial,
                "cantidad_disponible": cantidad_disponible,
                "unidad": pick(["UN", "KG", "LT", "MT"]),
                "fecha_fabricacion": fecha_fab,
                "fecha_vencimiento": fecha_venc,
                "fecha_recepcion": rand_past_date(10, 365),
                "estado": estado,
                "proveedor_cuit": self.refs.rand_proveedor(),
                "almacen_id": random.randint(1, 10) if random.random() > 0.3 else None,
                "ubicacion": f"{pick(['A', 'B', 'C'])}-{random.randint(1, 20):02d}" if random.random() > 0.4 else None,
                "created_at": rand_datetime(days_back=180),
            }
            try:
                lid = self.insert("lote", row)
                if lid:
                    lote_ids.append(lid)
            except Exception:
                pass

        self.log(f"lote: {len(lote_ids)} insertados")
        return lote_ids

    # ------------------------------------------------------------------
    # lote_movimiento  (~40 records, 2 per lote)
    # Cols: lote_id, tipo, cantidad, almacen_origen, almacen_destino,
    #       referencia, usuario_id, created_at
    # ------------------------------------------------------------------
    def _seed_lote_movimientos(self, lote_ids):
        count = 0

        for lid in lote_ids:
            for _ in range(2):
                tipo = pick(LOTE_MOV_TIPOS)
                cantidad = round(random.uniform(1, 100), 2)
                almacen_o = str(self.refs.rand_almacen() or "0001")
                almacen_d = str(self.refs.rand_almacen() or "0002")

                row = {
                    "lote_id": lid,
                    "tipo": tipo,
                    "cantidad": cantidad,
                    "almacen_origen": almacen_o if tipo != "recepcion" else None,
                    "almacen_destino": almacen_d if tipo != "despacho" else None,
                    "referencia": f"{fake.sentence(nb_words=6)}",
                    "usuario_id": self.refs.rand_user(),
                    "created_at": rand_datetime(days_back=90),
                }
                try:
                    self.insert_no_return("lote_movimiento", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"lote_movimiento: {count} insertados")

    # ------------------------------------------------------------------
    # cycle_count  (~8 records)
    # Cols: programa_id, almacen, tipo, estado, fecha_programada,
    #       fecha_ejecucion, responsable_id, observaciones, created_at
    # ------------------------------------------------------------------
    def _seed_cycle_counts(self):
        count_ids = []

        for i in range(1, 9):
            estado = pick(CYCLE_COUNT_ESTADOS)
            fecha_plan = rand_past_date(1, 90)
            fecha_inicio = rand_past_date(1, 60) if estado in ("completed", "in_progress") else None
            fecha_cierre = rand_past_date(1, 30) if estado == "completed" else None

            row = {
                "almacen_id": random.randint(1, 10),
                "tipo": pick(CYCLE_COUNT_TIPOS),
                "estado": estado,
                "fecha_planificada": fecha_plan,
                "fecha_inicio": fecha_inicio,
                "fecha_cierre": fecha_cierre,
                "asignado_a": self.refs.rand_user(),
                "notas": f"Conteo {i:02d} - {fake.sentence(nb_words=6)}",
                "created_at": rand_datetime(days_back=120),
            }
            try:
                cid = self.insert("cycle_count", row)
                if cid:
                    count_ids.append(cid)
            except Exception:
                pass

        self.log(f"cycle_count: {len(count_ids)} insertados")
        return count_ids

    # ------------------------------------------------------------------
    # cycle_count_item  (~40 records, 5 per cycle_count)
    # Cols: cycle_count_id, material_codigo, stock_sistema, stock_fisico,
    #       diferencia, ajustado, notas
    # ------------------------------------------------------------------
    def _seed_cycle_count_items(self, count_ids):
        count = 0

        for cid in count_ids:
            for _ in range(5):
                stock_sistema = round(random.uniform(0, 200), 2)
                stock_fisico = round(stock_sistema * random.uniform(0.85, 1.15), 2)
                diferencia = round(stock_fisico - stock_sistema, 2)
                ajustado = random.random() > 0.6

                row = {
                    "cycle_count_id": cid,
                    "material_codigo": self.refs.rand_material(),
                    "stock_sistema": stock_sistema,
                    "stock_fisico": stock_fisico,
                    "diferencia": diferencia,
                    "ajustado": ajustado,
                    "notas": f"{fake.sentence(nb_words=5)}",
                }
                try:
                    self.insert_no_return("cycle_count_item", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"cycle_count_item: {count} insertados")

    # ------------------------------------------------------------------
    # kanban_tarjeta  (~15 records)
    # Cols: material_codigo, almacen, tipo, estado, cantidad_kanban,
    #       punto_reorden, proveedor_cuit, lead_time_dias, num_tarjetas,
    #       tarjetas_activas, notas, created_at, updated_at
    # ------------------------------------------------------------------
    def _seed_kanban_tarjetas(self):
        count = 0

        for i in range(1, 16):
            tipo = pick(KANBAN_TIPOS)
            estado = pick(KANBAN_ESTADOS)
            proveedor = self.refs.rand_proveedor() if tipo == "proveedor" else None

            row = {
                "tablero_id": random.randint(1, 5) if random.random() > 0.3 else None,
                "material_codigo": self.refs.rand_material(),
                "tipo": tipo,
                "estado": estado,
                "cantidad_contenedor": round(random.uniform(5, 200), 2),
                "punto_reorden": random.randint(10, 100),
                "lead_time_horas": random.randint(1, 720),
                "ubicacion_supermarket": f"SM-{pick(['A', 'B', 'C'])}{random.randint(1, 20):02d}",
                "proveedor_cuit": proveedor,
                "ciclos_totales": random.randint(0, 50),
                "ultimo_ciclo_at": rand_datetime(days_back=30) if random.random() > 0.4 else None,
            }
            try:
                self.insert_no_return("kanban_tarjeta", row)
                count += 1
            except Exception:
                pass

        self.log(f"kanban_tarjeta: {count} insertados")

    # ------------------------------------------------------------------
    # consignment_stock  (~12 records)
    # Cols: proveedor_cuit, material_codigo, almacen, cantidad,
    #       precio_unitario, fecha_ingreso, fecha_vencimiento, estado,
    #       created_at
    # ------------------------------------------------------------------
    def _seed_consignment_stock(self):
        count = 0

        for _ in range(12):
            cantidad_disp = round(random.uniform(5, 500), 2)
            cantidad_consumida = round(random.uniform(0, 200), 2)

            row = {
                "programa_id": random.randint(1, 10),
                "material_codigo": self.refs.rand_material(),
                "cantidad_disponible": cantidad_disp,
                "cantidad_consumida_acumulada": cantidad_consumida,
                "valor_unitario": round(random.uniform(50, 5000), 2),
                "ultima_actualizacion": rand_datetime(days_back=30),
            }
            try:
                self.insert_no_return("consignment_stock", row)
                count += 1
            except Exception:
                pass

        self.log(f"consignment_stock: {count} insertados")

    # ------------------------------------------------------------------
    # vmi_programa  (~6 records)
    # Cols: proveedor_cuit, nombre, material_codigo, centro_id, almacen_id,
    #       estado, tipo_reposicion, min_stock, max_stock, punto_pedido,
    #       cantidad_pedido, frecuencia_dias, responsable_proveedor,
    #       responsable_interno, fecha_inicio, fecha_fin, created_at
    # ------------------------------------------------------------------
    def _seed_vmi_programas(self):
        vmi_ids = []

        for i in range(1, 7):
            min_stock = round(random.uniform(10, 100), 2)
            max_stock = round(min_stock * random.uniform(3, 8), 2)
            punto_pedido = round(min_stock * random.uniform(1.5, 2.5), 2)
            cantidad_pedido = round((max_stock - min_stock) * random.uniform(0.8, 1.0), 2)
            fecha_inicio = rand_past_date(30, 365)
            fecha_fin = rand_future_date(30, 365) if random.random() > 0.4 else None

            row = {
                "proveedor_cuit": self.refs.rand_proveedor(),
                "nombre": f"VMI Programa {i:02d}",
                "material_codigo": self.refs.rand_material(),
                "centro_id": random.randint(1, 10),
                "almacen_id": random.randint(1, 10),
                "estado": pick(VMI_ESTADOS),
                "tipo_reposicion": pick(VMI_TIPO_REPOSICION),
                "min_stock": min_stock,
                "max_stock": max_stock,
                "punto_pedido": punto_pedido,
                "cantidad_pedido": cantidad_pedido,
                "frecuencia_dias": pick([7, 14, 30]),
                "responsable_proveedor": fake.name(),
                "responsable_interno": self.refs.rand_user(),
                "fecha_inicio": fecha_inicio,
                "fecha_fin": fecha_fin,
                "created_at": rand_datetime(days_back=365),
            }
            try:
                vid = self.insert("vmi_programa", row)
                if vid:
                    vmi_ids.append(vid)
            except Exception:
                pass

        self.log(f"vmi_programa: {len(vmi_ids)} insertados")
        return vmi_ids

    # ------------------------------------------------------------------
    # vmi_reposicion  (~12 records, 2 per VMI programa)
    # Cols: programa_id, tipo, cantidad_sugerida, cantidad_aprobada,
    #       fecha_sugerida, fecha_entrega_esperada, estado,
    #       orden_compra_id, razon_rechazo, aprobado_por, created_at
    # ------------------------------------------------------------------
    def _seed_vmi_reposiciones(self, vmi_ids):
        count = 0

        for vid in vmi_ids:
            for _ in range(2):
                estado = pick(VMI_REPOSICION_ESTADOS)
                cantidad_sug = round(random.uniform(10, 300), 2)
                cantidad_apr = (
                    round(cantidad_sug * random.uniform(0.8, 1.0), 2)
                    if estado in ("approved", "in_transit", "completed")
                    else None
                )
                aprobado_por = self.refs.rand_admin() if cantidad_apr else None
                razon_rechazo = (
                    f"{fake.sentence(nb_words=8)}"
                    if estado == "rejected"
                    else None
                )

                row = {
                    "programa_id": vid,
                    "tipo": pick(["automatic", "manual", "emergency"]),
                    "cantidad_sugerida": cantidad_sug,
                    "cantidad_aprobada": cantidad_apr,
                    "fecha_sugerida": rand_past_date(1, 30),
                    "fecha_entrega_esperada": rand_future_date(1, 30),
                    "estado": estado,
                    "razon_rechazo": razon_rechazo,
                    "aprobado_por": aprobado_por,
                    "created_at": rand_datetime(days_back=60),
                }
                try:
                    self.insert_no_return("vmi_reposicion", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"vmi_reposicion: {count} insertados")

    # ------------------------------------------------------------------
    # vmi_inventario_compartido  (~18 records, 3 per VMI programa)
    # Cols: programa_id, fecha, stock_disponible, stock_reservado,
    #       stock_en_transito, consumo_diario_promedio, dias_inventario,
    #       stock_proyectado_7d, alerta, sincronizado_por, created_at
    # ------------------------------------------------------------------
    def _seed_vmi_inventario_compartido(self, vmi_ids):
        count = 0

        for vid in vmi_ids:
            used_fechas = set()
            for _ in range(3):
                fecha = rand_past_date(1, 60)
                attempts = 0
                while fecha in used_fechas and attempts < 20:
                    fecha = rand_past_date(1, 60)
                    attempts += 1
                used_fechas.add(fecha)

                stock_disp = round(random.uniform(10, 500), 2)
                stock_res = round(stock_disp * random.uniform(0, 0.3), 2)
                stock_trans = round(random.uniform(0, 100), 2)
                consumo_avg = round(random.uniform(1, 30), 2)
                dias_inv = round(stock_disp / consumo_avg, 1) if consumo_avg > 0 else 0
                stock_7d = round(stock_disp - consumo_avg * 7 + stock_trans, 2)

                alerta = "ok"
                if dias_inv < 3:
                    alerta = "critical"
                elif dias_inv < 7:
                    alerta = "low"

                row = {
                    "programa_id": vid,
                    "fecha": fecha,
                    "stock_disponible": stock_disp,
                    "stock_reservado": stock_res,
                    "stock_en_transito": stock_trans,
                    "consumo_diario_promedio": consumo_avg,
                    "dias_inventario": dias_inv,
                    "stock_proyectado_7d": stock_7d,
                    "alerta": alerta,
                    "sincronizado_por": pick(["internal", "supplier", "system"]),
                    "created_at": rand_datetime(days_back=60),
                }
                try:
                    self.insert_no_return("vmi_inventario_compartido", row)
                    count += 1
                except Exception:
                    pass

        self.log(f"vmi_inventario_compartido: {count} insertados")

    # ------------------------------------------------------------------
    # vmi_kpi_snapshot  (~6 records, 1 per VMI programa)
    # Cols: programa_id, periodo, stockout_count, dias_stockout, fill_rate,
    #       inventory_turnover, lead_time_avg, costo_almacenamiento, created_at
    # ------------------------------------------------------------------
    def _seed_vmi_kpi_snapshots(self, vmi_ids):
        count = 0

        for vid in vmi_ids:
            periodo = _fake_periodo(months_back=6)
            fill_rate = round(random.uniform(85, 100), 2)

            row = {
                "programa_id": vid,
                "periodo": periodo,
                "stockout_count": random.randint(0, 3),
                "dias_stockout": random.randint(0, 5),
                "fill_rate": fill_rate,
                "inventory_turnover": round(random.uniform(2, 12), 2),
                "lead_time_avg": round(random.uniform(1, 14), 1),
                "costo_almacenamiento": round(random.uniform(500, 15000), 2),
                "created_at": rand_datetime(days_back=120),
            }
            try:
                self.insert_no_return("vmi_kpi_snapshot", row)
                count += 1
            except Exception:
                pass

        self.log(f"vmi_kpi_snapshot: {count} insertados")

    # ------------------------------------------------------------------
    # transferencia_inventario  (~15 records)
    # Cols: numero_transferencia, material_codigo, almacen_origen,
    #       almacen_destino, cantidad, estado, prioridad, razon,
    #       propuesto_por, aprobado_por, fecha_envio, fecha_recepcion,
    #       created_at, updated_at
    # ------------------------------------------------------------------
    def _seed_transferencia_inventario(self):
        count = 0

        razones = [
            "Rebalanceo de stock",
            "Demanda urgente en destino",
            "Exceso de inventario en origen",
            "Consolidación de almacenes",
            "Requerimiento de producción",
            "Optimización logística",
        ]

        for i in range(1, 16):
            estado = pick(TRANSFERENCIA_ESTADOS)
            aprobado_por = None
            fecha_envio = None
            fecha_recepcion = None

            if estado in ("approved", "in_transit", "received"):
                aprobado_por = self.refs.rand_admin()
            if estado in ("in_transit", "received"):
                fecha_envio = rand_past_date(1, 30)
            if estado == "received":
                fecha_recepcion = rand_past_date(1, 15)

            row = {
                "numero_transferencia": seed_code("TRF", i),
                "material_codigo": self.refs.rand_material(),
                "almacen_origen": str(self.refs.rand_almacen() or "0001"),
                "almacen_destino": str(self.refs.rand_almacen() or "0002"),
                "cantidad": round(random.uniform(1, 500), 2),
                "estado": estado,
                "prioridad": pick(TRANSFERENCIA_PRIORIDADES),
                "razon": f"{pick(razones)}",
                "propuesto_por": self.refs.rand_user(),
                "aprobado_por": aprobado_por,
                "fecha_envio": fecha_envio,
                "fecha_recepcion": fecha_recepcion,
                "created_at": rand_datetime(days_back=120),
                "updated_at": rand_datetime(days_back=30),
            }
            try:
                self.insert_no_return("transferencia_inventario", row)
                count += 1
            except Exception:
                pass

        self.log(f"transferencia_inventario: {count} insertados")

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
