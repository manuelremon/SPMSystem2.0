#!/usr/bin/env python
"""Verificar valores de status reales en la base de datos"""

from src.backend.core.db import get_connection

with get_connection() as con:
    con.row_factory = None  # Get raw tuples
    rows = con.execute("SELECT DISTINCT status FROM solicitudes").fetchall()
    print("Status values in database:")
    for row in rows:
        if isinstance(row, dict):
            print(f"  - '{row.get('status')}'")
        else:
            print(f"  - '{row[0] if row else 'None'}'")
