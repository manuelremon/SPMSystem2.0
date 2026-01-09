#!/usr/bin/env python3
"""
Test simple del endpoint de aprobador
"""

import json
import sqlite3

# Conectar a la BD y obtener solicitud directamente
conn = sqlite3.connect("database/spm.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Obtener una solicitud pendiente
c.execute(
    """
    SELECT id, id_usuario, aprobador_id, centro, sector, status, total_monto, created_at, justificacion
    FROM solicitudes
    WHERE status = 'pending_approval'
    LIMIT 1
"""
)

sol = c.fetchone()
if sol:
    print("=" * 70)
    print("SOLICITUD ENCONTRADA")
    print("=" * 70)
    print(json.dumps(dict(sol), indent=2))

    # Obtener items
    sol_id = sol["id"]
    c.execute(
        """
        SELECT id_item, solicitud_id, material_codigo, cantidad, precio_unitario
        FROM solicitud_items
        WHERE solicitud_id = ?
    """,
        (sol_id,),
    )

    items = c.fetchall()
    print(f"\nItems ({len(items)}):")
    for item in items:
        print(json.dumps(dict(item), indent=2))
else:
    print("No hay solicitudes pendientes")

conn.close()
