#!/usr/bin/env python
"""Inspeccionar el schema de la tabla solicitudes"""

from src.backend.core.db import get_connection

with get_connection() as con:
    # Get table schema
    schema = con.execute("PRAGMA table_info(solicitudes)").fetchall()
    print("=" * 80)
    print("Schema de tabla 'solicitudes':")
    print("=" * 80)
    for row in schema:
        print(row)

    # Get CHECK constraints
    print("\n" + "=" * 80)
    print("SQL de creación de tabla:")
    print("=" * 80)
    sql = con.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='solicitudes'"
    ).fetchone()
    if sql:
        if isinstance(sql, dict):
            print(sql.get("sql", "No SQL found"))
        else:
            print(sql[0] if sql else "No SQL found")

    # Try to get actual status values
    print("\n" + "=" * 80)
    print("Valores de status existentes:")
    print("=" * 80)
    statuses = con.execute("SELECT DISTINCT status FROM solicitudes").fetchall()
    for row in statuses:
        if isinstance(row, dict):
            print(f"  - '{row.get('status')}'")
        else:
            print(f"  - '{row[0]}'")
