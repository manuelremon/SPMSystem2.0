#!/usr/bin/env python3
"""
Script para inicializar la base de datos desde el schema
"""

import os
import sqlite3
import sys

DB_PATH = "database/spm.db"
SCHEMA_PATH = "database/schemas/refactored_schema.sql"

# Asegurar que el directorio existe
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# Eliminar BD anterior si existe
if os.path.exists(DB_PATH):
    print(f"⚠️  Base de datos existente encontrada: {DB_PATH}")
    # Si se pasa argumento 'force', no preguntar
    if len(sys.argv) > 1 and sys.argv[1] == "force":
        os.remove(DB_PATH)
        print("Eliminada (force mode).")
    else:
        response = input("¿Deseas eliminarla e inicializar desde cero? (s/n): ").lower()
        if response == "s":
            os.remove(DB_PATH)
            print("Eliminada.")
        else:
            print("Abortado.")
            exit(1)

# Leer el schema
print(f"📖 Leyendo schema desde: {SCHEMA_PATH}")
with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
    schema_sql = f.read()

# Ejecutar el schema
print(f"🔧 Inicializando base de datos en: {DB_PATH}")
try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Dividir en statements y ejecutar cada uno
    statements = schema_sql.split(";")
    for i, statement in enumerate(statements):
        statement = statement.strip()
        if statement:
            print(f"  Ejecutando statement {i + 1}...")
            cursor.execute(statement)

    conn.commit()
    print("✅ Base de datos inicializada exitosamente!")

    # Verificar tablas creadas
    print("\n📊 Tablas creadas:")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = cursor.fetchall()
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
        count = cursor.fetchone()[0]
        print(f"  - {table[0]} ({count} registros)")

    conn.close()

except Exception as e:
    print(f"❌ Error al inicializar: {e}")
    import traceback

    traceback.print_exc()
    exit(1)

print("\n✅ LISTO! La base de datos ha sido inicializada.")
