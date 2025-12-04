#!/usr/bin/env python3
"""Script para ver esquema de usuarios"""

import sqlite3

DB_PATH = "src/backend/core/data/spm.db"

try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("=" * 70)
    print("ESQUEMA: usuarios")
    print("=" * 70)

    cursor.execute("PRAGMA table_info(usuarios);")
    columns = cursor.fetchall()
    for col in columns:
        print(f"  {col[1]}: {col[2]}")

    print("\n" + "=" * 70)
    print("PRIMEROS 3 USUARIOS")
    print("=" * 70)

    cursor.execute("SELECT * FROM usuarios LIMIT 3;")
    rows = cursor.fetchall()
    for row in rows:
        print(f"  {row}")

    conn.close()

except Exception as e:
    print(f"ERROR: {e}")
    import traceback

    traceback.print_exc()
