#!/usr/bin/env python3
"""Inserta directamente en la BD una solicitud de prueba sin usar Flask."""

import json
import os
import sqlite3
from datetime import datetime

# Use absolute path
DB_PATH = os.path.join(os.path.dirname(__file__), "src", "backend", "core", "data", "spm.db")

# Connect
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

try:
    # Determinar el próximo ID de solicitud
    max_id_row = c.execute("SELECT MAX(id) as max_id FROM solicitudes").fetchone()
    next_id = (max_id_row["max_id"] or 0) + 1

    # Preparar data_json con items
    items = [
        {
            "codigo": "1000562340",
            "descripcion": "ABRAZADERA 6X10",
            "cantidad": 10,
            "precio_unitario": 1500.0,
            "comentario": "",
        },
        {
            "codigo": "1000028839",
            "descripcion": "RODAMIENTO NSK",
            "cantidad": 2,
            "precio_unitario": 5000.0,
            "comentario": "",
        },
    ]
    data_json = json.dumps(
        {
            "centro": "1008",
            "sector": "Mantenimiento",
            "justificacion": "Prueba de flujo: crear solicitud",
            "centro_costos": "CC-1008",
            "almacen_virtual": "ALM-1008",
            "fecha_necesidad": "2025-10-31",
            "items": items,
        }
    )

    # Calcular total_monto
    total = sum(item["cantidad"] * item["precio_unitario"] for item in items)

    # Insertar solicitud
    now = datetime.now().isoformat()
    c.execute(
        """
        INSERT INTO solicitudes
        (id_usuario, centro, sector, justificacion, data_json, status, total_monto, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            "admin",
            "1008",
            "Mantenimiento",
            "Prueba de flujo: crear solicitud",
            data_json,
            "pendiente_de_aprobacion",
            total,
            now,
            now,
        ),
    )

    conn.commit()

    print(f"✓ Solicitud {next_id} creada exitosamente")
    print("  - Usuario: admin")
    print("  - Status: pendiente_de_aprobacion")
    print(f"  - Items: {len(items)}")
    print(f"  - Total: ${total:,.2f}")

    # Leer para confirmar
    sol = c.execute(
        "SELECT id, status, total_monto, created_at FROM solicitudes WHERE id=?", (next_id,)
    ).fetchone()
    if sol:
        print("\n✓ Confirmación en BD:")
        print(
            f"  - ID: {sol['id']}, Status: {sol['status']}, Total: ${sol['total_monto']}, Fecha: {sol['created_at']}"
        )

except Exception as e:
    print(f"✗ Error: {e}")
    import traceback

    traceback.print_exc()
finally:
    conn.close()
