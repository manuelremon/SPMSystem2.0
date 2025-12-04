#!/usr/bin/env python3
"""Inspect database schema."""

import sqlite3

DB_PATH = "src/backend/core/data/spm.db"

try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get schema for solicitudes
    cursor.execute("PRAGMA table_info(solicitudes);")
    columns = cursor.fetchall()

    print("=" * 60)
    print("ESQUEMA: solicitudes")
    print("=" * 60)
    for col in columns:
        print(f"  {col[1]}: {col[2]}")

    print("\n" + "=" * 60)
    print("PRIMEROS 3 REGISTROS DE solicitudes")
    print("=" * 60)

    cursor.execute("SELECT * FROM solicitudes LIMIT 3;")
    rows = cursor.fetchall()
    for row in rows:
        print(f"  {row}")

    conn.close()

except Exception as e:
    print(f"ERROR: {e}")
    import traceback

    traceback.print_exc()
