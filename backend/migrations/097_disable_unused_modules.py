"""
Migracion 097: Deshabilitar modulos Compras, Logistica y Calidad.

Simplificacion del sistema: estos modulos no se usan por ahora. Se ocultan del
menu y sus rutas quedan bloqueadas en el frontend (ProtectedRoute). El codigo y
los datos se conservan; se pueden reactivar desde Admin > Modulos.

Fecha: 2026-09-27
"""

import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

MODULE_KEYS = ("compras", "logistica", "calidad")


def _set_enabled(enabled):
    from backend.core.db import get_db_connection, is_using_postgresql

    placeholder = "%s" if is_using_postgresql() else "?"
    with get_db_connection() as conn:
        cursor = conn.cursor()
        for key in MODULE_KEYS:
            cursor.execute(
                f"UPDATE system_modules SET enabled = {placeholder} WHERE module_key = {placeholder}",
                (enabled, key),
            )
        conn.commit()


def up():
    _set_enabled(False)
    print("Migration 097: modulos compras, logistica y calidad deshabilitados")


def down():
    _set_enabled(True)
    print("Migration 097 rolled back: modulos compras, logistica y calidad habilitados")


if __name__ == "__main__":
    up()
