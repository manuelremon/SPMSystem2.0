#!/usr/bin/env python
"""Debug script to check user access tables"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.backend.core.db import get_connection

with get_connection() as con:
    # Check tables exist
    try:
        rows = con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('usuario_centros', 'usuario_almacenes')"
        ).fetchall()
        print("Tablas encontradas:", [r["name"] for r in rows])
    except Exception as e:
        print("Error:", e)

    # Check data for user 2
    try:
        centros = con.execute("SELECT * FROM usuario_centros WHERE usuario_id = '2'").fetchall()
        print(f"Centros para usuario 2: {len(centros)} registros")
        for c in centros:
            print(f"  - {dict(c)}")
    except Exception as e:
        print("Error centros:", e)

    try:
        almacenes = con.execute("SELECT * FROM usuario_almacenes WHERE usuario_id = '2'").fetchall()
        print(f"Almacenes para usuario 2: {len(almacenes)} registros")
        for a in almacenes:
            print(f"  - {dict(a)}")
    except Exception as e:
        print("Error almacenes:", e)
