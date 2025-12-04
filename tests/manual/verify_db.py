#!/usr/bin/env python
"""Script para verificar que la BD está disponible"""

import sqlite3

try:
    con = sqlite3.connect("./src/backend/core/data/spm.db")
    con.row_factory = sqlite3.Row

    # Contar materiales
    result = con.execute("SELECT COUNT(*) as count FROM materiales").fetchone()
    material_count = result["count"]

    # Contar usuarios
    result = con.execute("SELECT COUNT(*) as count FROM usuarios").fetchone()
    user_count = result["count"]

    # Contar solicitudes
    result = con.execute("SELECT COUNT(*) as count FROM solicitudes").fetchone()
    solicitud_count = result["count"]

    con.close()

    print("=" * 60)
    print("✓ Base de datos verificada exitosamente")
    print("=" * 60)
    print(f"  Materiales:  {material_count:,} registros")
    print(f"  Usuarios:    {user_count} registros")
    print(f"  Solicitudes: {solicitud_count} registros")
    print("=" * 60)
    print("\n✓ Sistema listo para testing")

except Exception as e:
    print(f"✗ Error: {e}")
    exit(1)
