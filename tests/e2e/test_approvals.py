#!/usr/bin/env python3
"""
Test script to verify the approvals workflow
"""

import os
import sqlite3
from pathlib import Path


def get_db_path():
    """Get the database path"""
    root = Path(__file__).parent
    db_path = root / "database" / "spm.db"
    return str(db_path)


def main():
    db_path = get_db_path()

    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print("=" * 60)
    print("🔍 VERIFICACIÓN DEL SISTEMA DE APROBACIONES")
    print("=" * 60)

    # 1. Contar solicitudes por estado
    print("\n📊 SOLICITUDES POR ESTADO:")
    cursor.execute("SELECT DISTINCT status FROM solicitudes ORDER BY status")

    total = 0
    for row in cursor.fetchall():
        status = row["status"]
        cursor.execute("SELECT COUNT(*) as count FROM solicitudes WHERE status = ?", (status,))
        count = cursor.fetchone()["count"]
        if count > 0:
            print(f"  • {status:30s}: {count:3d}")
            total += count

    print(f"  {'TOTAL':30s}: {total:3d}")

    # 2. Listar solicitudes pending_approval
    print("\n📋 SOLICITUDES EN pending_approval (primeras 5):")
    cursor.execute(
        """
        SELECT s.id, s.id_usuario, s.centro, s.status, s.total_monto, u.nombre
        FROM solicitudes s
        LEFT JOIN usuarios u ON s.id_usuario = u.id_spm
        WHERE s.status = 'pending_approval'
        LIMIT 5
    """
    )

    solicitudes = cursor.fetchall()
    if solicitudes:
        for sol in solicitudes:
            usuario_nombre = sol["nombre"] or "DESCONOCIDO"
            print(
                f"  • ID: {sol['id']:3d} | Usuario: {usuario_nombre:20s} | Centro: {sol['centro']:10s} | Monto: ${sol['total_monto']:>10.2f}"
            )
    else:
        print("  ⚠️  No hay solicitudes en estado pending_approval")
        print("  Nota: Puedes crear test solicitudes con status='pending_approval'")

    # 3. Verificar aprobadores
    print("\n👥 INFORMACIÓN DE USUARIOS:")
    cursor.execute(
        """
        SELECT COUNT(*) as count FROM usuarios
    """
    )
    total_users = cursor.fetchone()["count"]
    print(f"  • Total de usuarios: {total_users}")

    # Listar tablas para ver si existe tabla de roles
    cursor.execute(
        """
        SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    """
    )
    tables = cursor.fetchall()
    print("\n📋 TABLAS EN LA BASE DE DATOS:")
    for table in tables:
        print(f"  • {table['name']}")

    # 4. Estadísticas de aprobación
    print("\n📈 ESTADÍSTICAS DE APROBACIÓN:")
    cursor.execute("SELECT COUNT(*) as count FROM solicitudes WHERE status = 'pending_approval'")
    pending = cursor.fetchone()["count"]

    cursor.execute(
        "SELECT COUNT(*) as count FROM solicitudes WHERE status IN ('approved', 'aprobada')"
    )
    approved = cursor.fetchone()["count"]

    cursor.execute(
        "SELECT COUNT(*) as count FROM solicitudes WHERE status IN ('rejected', 'rechazada')"
    )
    rejected = cursor.fetchone()["count"]

    total_aprobables = pending + approved + rejected
    if total_aprobables > 0:
        approval_rate = (approved / total_aprobables) * 100
        print(f"  • Pendientes:   {pending:3d}")
        print(f"  • Aprobadas:    {approved:3d}")
        print(f"  • Rechazadas:   {rejected:3d}")
        print(f"  • Tasa aprob.:  {approval_rate:5.1f}%")

    print("\n✅ VERIFICACIÓN COMPLETADA")
    print("=" * 60)

    conn.close()


if __name__ == "__main__":
    main()
