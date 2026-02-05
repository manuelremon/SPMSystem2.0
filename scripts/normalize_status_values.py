#!/usr/bin/env python3
"""
Normaliza los valores de status en la tabla solicitudes para usar estados modernos.

Migración de estados legacy:
- "processing" -> "in_planning" (estado moderno del FSM)

El estado "closed" se mantiene porque es un estado terminal válido similar a "completed".
"""
import sqlite3
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
SPM_DB = DATA_DIR / "spm.db"

# Mapeo de estados legacy a modernos
STATUS_MIGRATIONS = {
    "processing": "in_planning",
    # "closed" se mantiene - es un estado terminal válido
}


def main():
    if not SPM_DB.exists():
        print(f"Error: No se encontró la base de datos en {SPM_DB}")
        return 1

    conn = sqlite3.connect(SPM_DB)
    cursor = conn.cursor()

    # Mostrar distribución actual
    print("=== Estado actual ===")
    cursor.execute("SELECT status, COUNT(*) as cnt FROM solicitudes GROUP BY status ORDER BY cnt DESC")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]}")

    # Realizar migraciones
    print("\n=== Migrando estados ===")
    for old_status, new_status in STATUS_MIGRATIONS.items():
        cursor.execute(
            "UPDATE solicitudes SET status = ? WHERE status = ?",
            (new_status, old_status)
        )
        affected = cursor.rowcount
        if affected > 0:
            print(f"  ✓ {old_status} -> {new_status}: {affected} registros")
        else:
            print(f"  - {old_status}: sin registros")

    conn.commit()

    # Mostrar distribución final
    print("\n=== Estado final ===")
    cursor.execute("SELECT status, COUNT(*) as cnt FROM solicitudes GROUP BY status ORDER BY cnt DESC")
    total = 0
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]}")
        total += row[1]
    print(f"\n  Total: {total}")

    conn.close()
    print("\n✓ Migración completada.")
    return 0


if __name__ == "__main__":
    exit(main())
