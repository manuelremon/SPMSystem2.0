#!/usr/bin/env python3
"""Inspeccionar estructura de tablas vacías"""

import sqlite3

conn = sqlite3.connect("src/backend/core/data/spm.db")
cursor = conn.cursor()

tablas_vacias = [
    "archivos_adjuntos",
    "notificaciones",
    "outbox_emails",
    "planificador_asignaciones",
    "planificadores",
    "presupuesto_incorporaciones",
    "purchase_orders",
    "schema_migrations",
    "solicitud_items_tratamiento",
    "solicitud_tratamiento_eventos",
    "solicitud_tratamiento_log",
    "solpeds",
    "traslados",
    "user_profile_requests",
]

for tabla in tablas_vacias:
    print(f"\n{'=' * 70}")
    print(f"TABLA: {tabla}")
    print("=" * 70)
    cursor.execute(f"PRAGMA table_info({tabla})")
    columnas = cursor.fetchall()
    for col in columnas:
        print(f"  {col[1]:30} {col[2]:15} null:{col[3]:1} default:{col[4]}")

conn.close()
