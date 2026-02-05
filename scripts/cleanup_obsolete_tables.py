#!/usr/bin/env python3
"""
Elimina tablas obsoletas de migración completada en catalogo_materiales.db.

Tablas a eliminar:
- codigo_mapping: Tabla temporal de migración (002_create_mapping_table.py)
- materiales_backup: Backup pre-migración (003_migrate_material_codes.py)

Estas tablas ya no son referenciadas por ningún código activo del proyecto.
"""
import sqlite3
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
CATALOGO_DB = DATA_DIR / "catalogo_materiales.db"

TABLES_TO_DROP = ["codigo_mapping", "materiales_backup"]


def main():
    if not CATALOGO_DB.exists():
        print(f"Error: No se encontró la base de datos en {CATALOGO_DB}")
        return 1

    # Mostrar tamaño inicial
    initial_size = CATALOGO_DB.stat().st_size / (1024 * 1024)
    print(f"Tamaño inicial: {initial_size:.2f} MB")

    conn = sqlite3.connect(CATALOGO_DB)
    cursor = conn.cursor()

    # Verificar tablas existentes antes
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables_before = [row[0] for row in cursor.fetchall()]
    print(f"Tablas antes: {tables_before}")

    # Eliminar tablas obsoletas
    for table in TABLES_TO_DROP:
        if table in tables_before:
            cursor.execute(f"DROP TABLE IF EXISTS {table}")
            print(f"✓ Eliminada: {table}")
        else:
            print(f"- Tabla no existe: {table}")

    conn.commit()

    # Recuperar espacio con VACUUM
    print("Ejecutando VACUUM para recuperar espacio...")
    conn.execute("VACUUM")
    conn.close()

    # Mostrar tablas restantes y tamaño final
    conn = sqlite3.connect(CATALOGO_DB)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables_after = [row[0] for row in cursor.fetchall()]
    print(f"Tablas después: {tables_after}")
    conn.close()

    final_size = CATALOGO_DB.stat().st_size / (1024 * 1024)
    saved = initial_size - final_size
    print(f"Tamaño final: {final_size:.2f} MB")
    print(f"Espacio recuperado: {saved:.2f} MB")
    print("\n✓ Limpieza completada.")
    return 0


if __name__ == "__main__":
    exit(main())
