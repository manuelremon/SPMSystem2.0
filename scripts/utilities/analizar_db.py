#!/usr/bin/env python3
import sqlite3
from pathlib import Path

db_path = Path("src/backend/core/data/spm.db")

if not db_path.exists():
    print(f"❌ Base de datos no encontrada: {db_path}")
    exit(1)

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

# Obtener todas las tablas
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()

print("\n" + "=" * 80)
print("ANÁLISIS DE BASE DE DATOS: spm.db")
print("=" * 80)

print(f"\n📊 TABLAS ENCONTRADAS: {len(tables)}\n")

for (table_name,) in tables:
    # Obtener estructura de la tabla
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()

    # Obtener cantidad de registros
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = cursor.fetchone()[0]

    print(f"\n🔹 TABLE: {table_name}")
    print(f"   Registros: {count}")
    print("   Columnas:")
    for col_id, name, type_, notnull, default, pk in columns:
        pk_marker = " [PK]" if pk else ""
        nn_marker = " [NOT NULL]" if notnull else ""
        print(f"      • {name}: {type_}{pk_marker}{nn_marker}")

# Mostrar información de relaciones (foreign keys)
print("\n\n" + "=" * 80)
print("RELACIONES (FOREIGN KEYS)")
print("=" * 80)

for (table_name,) in tables:
    cursor.execute(f"PRAGMA foreign_key_list({table_name})")
    fks = cursor.fetchall()
    if fks:
        print(f"\n🔗 {table_name}:")
        for fk_info in fks:
            # PRAGMA devuelve: (seq, table, from, to, on_delete, on_update, match, ...)
            seq, table, from_, to_ = fk_info[0], fk_info[1], fk_info[2], fk_info[3]
            print(f"   {from_} -> {table}.{to_}")

# Mostrar índices
print("\n\n" + "=" * 80)
print("ÍNDICES")
print("=" * 80)

cursor.execute(
    "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name"
)
indexes = cursor.fetchall()

if indexes:
    current_table = None
    for idx_name, tbl_name in indexes:
        if tbl_name != current_table:
            print(f"\n  {tbl_name}:")
            current_table = tbl_name
        print(f"    • {idx_name}")
else:
    print("\n  (Sin índices personalizados)")

conn.close()

print("\n" + "=" * 80)
print("✅ Análisis completado")
print("=" * 80 + "\n")
