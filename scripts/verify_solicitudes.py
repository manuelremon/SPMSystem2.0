#!/usr/bin/env python3
"""Verificar que las solicitudes se guardaron correctamente"""

import sqlite3

con = sqlite3.connect("../backend_v2/spm.db")
con.row_factory = sqlite3.Row

print("=== Verificacion de Solicitudes #4 y #5 ===\n")

for sol_id in [4, 5]:
    row = con.execute(
        """SELECT id, centro, sector, criticidad, almacen_virtual,
                  centro_costos, fecha_necesidad, total_monto, justificacion
           FROM solicitudes WHERE id = ?""",
        (sol_id,),
    ).fetchone()

    if row:
        print(f"Solicitud #{row['id']}:")
        print(f"  Centro: {row['centro']}")
        print(f"  Sector: {row['sector']}")
        print(f"  Criticidad: {row['criticidad']}")
        print(f"  Almacen Virtual: {row['almacen_virtual']}")
        print(f"  Centro Costos: {row['centro_costos']}")
        print(f"  Fecha Necesidad: {row['fecha_necesidad']}")
        print(f"  Total: ${row['total_monto']}")
        print(f"  Justificacion: {row['justificacion']}")
        print()
    else:
        print(f"[ERROR] Solicitud #{sol_id} no encontrada\n")

con.close()

print("=== Analisis ===")
print("Solicitud #4 (JSON):     Deberia tener criticidad='Normal'")
print("Solicitud #5 (FormData): Deberia tener criticidad='Alta'")
print("Ambas deberias tener almacen_virtual='ALM0001'")
