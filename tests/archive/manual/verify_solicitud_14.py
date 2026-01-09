#!/usr/bin/env python
"""
Verificar detalles completos de la solicitud 14 después de aprobación.
"""

import json
import sqlite3

DB_PATH = "src/backend/core/data/spm.db"

with sqlite3.connect(DB_PATH) as con:
    con.row_factory = lambda cursor, row: {
        col[0]: row[idx] for idx, col in enumerate(cursor.description)
    }

    print("=" * 60)
    print("SOLICITUD 14 - ESTADO COMPLETO DESPUÉS DE APROBACIÓN")
    print("=" * 60)

    sol = con.execute("SELECT * FROM solicitudes WHERE id=14").fetchone()

    # Mostrar campos principales
    print(f"\nID: {sol['id']}")
    print(f"Usuario Creador: {sol['id_usuario']}")
    print(f"Aprobador: {sol['aprobador_id']}")
    print(f"Planificador: {sol['planner_id']}")
    print(f"Status: {sol['status']}")
    print(f"Total Monto: ${sol['total_monto']:,.2f}")
    print(f"Centro: {sol['centro']}")
    print(f"Sector: {sol['sector']}")
    print(f"Criticidad: {sol['criticidad']}")
    print(f"Created: {sol['created_at']}")
    print(f"Updated: {sol['updated_at']}")

    # Mostrar data_json
    print("\n" + "=" * 60)
    print("DATA_JSON (información de decisión)")
    print("=" * 60)
    data_json = json.loads(sol["data_json"])
    print(json.dumps(data_json, indent=2, ensure_ascii=False))

    # Si hay planificador asignado, ver detalles
    if sol["planner_id"]:
        print("\n" + "=" * 60)
        print(f"PLANIFICADOR ASIGNADO: {sol['planner_id']}")
        print("=" * 60)
        planner = con.execute(
            "SELECT id_spm, nombre, apellido, sector FROM usuarios WHERE id_spm=?",
            (sol["planner_id"],),
        ).fetchone()
        if planner:
            print(json.dumps(planner, indent=2, ensure_ascii=False))
