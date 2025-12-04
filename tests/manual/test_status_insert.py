#!/usr/bin/env python
"""Verificar solicitudes existentes y sus estados"""

from src.backend.core.db import get_connection

with get_connection() as con:
    print("Solicitudes existentes:")
    print("=" * 100)
    solicitudes = con.execute(
        """
        SELECT id, id_usuario, status, aprobador_id, created_at
        FROM solicitudes
        ORDER BY id DESC
    """
    ).fetchall()

    for row in solicitudes:
        if isinstance(row, dict):
            print(
                f"ID: {row.get('id')}, Usuario: {row.get('id_usuario')}, Status: '{row.get('status')}', Aprobador: {row.get('aprobador_id')}"
            )
        else:
            print(f"ID: {row[0]}, Usuario: {row[1]}, Status: '{row[2]}', Aprobador: {row[3]}")

    print("\n" + "=" * 100)
    print("Intento de insertar con status en ESPAÑOL:")
    print("=" * 100)

    try:
        con.execute(
            """
            INSERT INTO solicitudes
            (id_usuario, centro, sector, justificacion, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        """,
            ("admin@spm.com", "CENTRO001", "Sector A", "Test solicitud", "pendiente_de_aprobacion"),
        )
        con.commit()
        print("✓ Inserción exitosa con status='pendiente_de_aprobacion'")
    except Exception as e:
        print(f"✗ Error: {e}")
        con.rollback()
