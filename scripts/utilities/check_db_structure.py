#!/usr/bin/env python
"""Verificar estructura de la base de datos"""

from src.backend.app import create_app
from src.backend.core.db import get_db

try:
    app = create_app()
    with app.app_context():
        db = get_db()

        # Obtener todas las tablas
        tables = db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        print("=" * 50)
        print("TABLAS EN LA BASE DE DATOS:")
        print("=" * 50)

        if not tables:
            print("❌ No se encontraron tablas")
        else:
            print(f"✅ Total de tablas: {len(tables)}\n")
            for table_row in tables:
                table_name = (
                    table_row[0] if isinstance(table_row, (list, tuple)) else str(table_row)
                )
                print(f"📊 {table_name}")

                try:
                    # Obtener estructura de cada tabla
                    columns = db.execute(f"PRAGMA table_info({table_name})").fetchall()
                    for col in columns:
                        col_name = col[1]
                        col_type = col[2]
                        print(f"   - {col_name}: {col_type}")

                    # Contar registros
                    count = db.execute(f"SELECT COUNT(*) as count FROM {table_name}").fetchone()
                    record_count = count[0] if isinstance(count, (list, tuple)) else count
                    print(f"   � Total de registros: {record_count}\n")
                except Exception as e:
                    print(f"   ⚠️  Error al leer tabla: {e}\n")

        print("=" * 50)

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback

    traceback.print_exc()
