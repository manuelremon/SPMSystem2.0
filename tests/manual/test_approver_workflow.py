#!/usr/bin/env python3
"""Test script for approver workflow"""

import sqlite3


def test_approver_data():
    """Check if there are solicitudes to approve"""
    conn = sqlite3.connect("database/spm.db")
    c = conn.cursor()

    print("=" * 60)
    print("SOLICITUDES PENDIENTES DE APROBACIÓN")
    print("=" * 60)

    c.execute(
        """
        SELECT id, id_usuario, centro, sector, status, total_monto
        FROM solicitudes
        WHERE status='pendiente_de_aprobacion'
        ORDER BY id DESC
        LIMIT 10
    """
    )

    pending_rows = c.fetchall()
    if pending_rows:
        print(f"Found {len(pending_rows)} pending solicitudes:")
        for row in pending_rows:
            print(
                f"  ID: {row[0]}, Usuario: {row[1]}, Centro: {row[2]}, Sector: {row[3]}, Monto: {row[5]}"
            )
    else:
        print("No hay solicitudes pendientes de aprobación")

    print("\n" + "=" * 60)
    print("SOLICITUDES EN DRAFT")
    print("=" * 60)

    c.execute(
        """
        SELECT id, id_usuario, centro, sector, status, total_monto
        FROM solicitudes
        WHERE status='draft'
        ORDER BY id DESC
        LIMIT 10
    """
    )

    draft_rows = c.fetchall()
    if draft_rows:
        print(f"Found {len(draft_rows)} draft solicitudes:")
        for row in draft_rows:
            print(
                f"  ID: {row[0]}, Usuario: {row[1]}, Centro: {row[2]}, Sector: {row[3]}, Monto: {row[5]}"
            )
    else:
        print("No hay solicitudes en draft")

    print("\n" + "=" * 60)
    print("USUARIOS APROBADORES")
    print("=" * 60)

    c.execute(
        """
        SELECT id_spm, nombre, apellido, rol, mail
        FROM usuarios
        WHERE rol LIKE '%Aprobador%' OR rol LIKE '%Administrador%'
    """
    )

    users = c.fetchall()
    for user in users:
        print(f"  ID: {user[0]}, Nombre: {user[1]} {user[2]}")
        print(f"    Email: {user[4]}, Rol: {user[3]}")

    conn.close()

    print("\n" + "=" * 60)
    print("TEST INSTRUCTIONS")
    print("=" * 60)
    print(
        """
1. Go to http://localhost:5000/home.html
2. Login with:
   - Email: robertorosas@ypf.com
   - Password: (check console output or use admin account)
3. Look for "Aprobaciones" menu item (should be visible if role is correct)
4. Click "Aprobaciones" to load pending solicitudes
5. Verify the list loads and displays pending items
6. Click "Revisar" on any solicitud to open the modal
7. Test "Aprobar" or "Rechazar" buttons
8. Verify status changes and list updates
"""
    )


if __name__ == "__main__":
    test_approver_data()
