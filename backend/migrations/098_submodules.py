"""
Migracion 098: Submodulos de Planificacion e Inventario (deshabilitados).

Agrega submodulos toggleables con module_key "padre.hijo":
  planificacion.kanban, planificacion.mps,
  inventario.vmi, inventario.consignacion, inventario.lotes,
  inventario.retiros, inventario.conteo_ciclico, inventario.ubicaciones, inventario.slob
Se crean deshabilitados (simplificacion del sistema). Se reactivan desde
Admin > Modulos.

Renumera display_order de los modulos existentes de 10 en 10 para que los
submodulos queden listados debajo de su padre.

Fecha: 2026-09-27
"""

import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

TOP_LEVEL_ORDER = {
    "solicitudes": 10,
    "compras": 20,
    "planificacion": 30,
    "inventario": 40,
    "logistica": 50,
    "calidad": 60,
    "analytics": 70,
    "admin": 80,
}

# (module_key, label_key, label_fallback, icon, description, display_order)
SUBMODULES = [
    ("planificacion.kanban", "nav_kanban", "Kanban", "EventNote", "Planificacion: tablero y configuracion Kanban", 31),
    ("planificacion.mps", "nav_production", "Produccion (MPS)", "EventNote", "Planificacion: plan maestro de produccion (MPS)", 32),
    ("inventario.vmi", "nav_vmi", "VMI", "Inventory", "Inventario: stock gestionado por el proveedor (VMI)", 41),
    ("inventario.consignacion", "nav_consignment", "Consignacion", "Inventory", "Inventario: programas de consignacion", 42),
    ("inventario.lotes", "nav_lots", "Lotes", "Inventory", "Inventario: lotes y trazabilidad", 43),
    ("inventario.retiros", "nav_recalls", "Retiros de Mercado", "Inventory", "Inventario: retiros de mercado (recalls)", 44),
    ("inventario.conteo_ciclico", "nav_cycle_count", "Conteo Ciclico", "Inventory", "Inventario: conteo ciclico", 45),
    ("inventario.ubicaciones", "nav_putaway", "Ubicaciones", "Inventory", "Inventario: ubicaciones (putaway)", 46),
    ("inventario.slob", "nav_slob", "Antiguedad e Inmovilizado", "Inventory", "Inventario: antiguedad e inmovilizado (SLOB)", 47),
]


def up():
    from backend.core.db import get_db_connection, is_using_postgresql

    ph = "%s" if is_using_postgresql() else "?"
    with get_db_connection() as conn:
        cursor = conn.cursor()
        for key, order in TOP_LEVEL_ORDER.items():
            cursor.execute(
                f"UPDATE system_modules SET display_order = {ph} WHERE module_key = {ph}",
                (order, key),
            )
        for key, label_key, fallback, icon, desc, order in SUBMODULES:
            cursor.execute(
                f"""
                INSERT INTO system_modules
                    (module_key, label_key, label_fallback, icon, description, enabled, is_core, display_order)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                ON CONFLICT (module_key) DO NOTHING
                """,
                (key, label_key, fallback, icon, desc, False, False, order),
            )
            # Si ya existia, igualmente dejarlo deshabilitado
            cursor.execute(
                f"UPDATE system_modules SET enabled = {ph} WHERE module_key = {ph}",
                (False, key),
            )
        conn.commit()
    print("Migration 098: submodulos de planificacion e inventario creados (deshabilitados)")


def down():
    from backend.core.db import get_db_connection, is_using_postgresql

    ph = "%s" if is_using_postgresql() else "?"
    with get_db_connection() as conn:
        cursor = conn.cursor()
        for key, *_ in SUBMODULES:
            cursor.execute(f"DELETE FROM system_modules WHERE module_key = {ph}", (key,))
        for key, order in TOP_LEVEL_ORDER.items():
            cursor.execute(
                f"UPDATE system_modules SET display_order = {ph} WHERE module_key = {ph}",
                (order // 10, key),
            )
        conn.commit()
    print("Migration 098 rolled back")


if __name__ == "__main__":
    up()
