#!/usr/bin/env python3
"""
Migracion 023: Tabla budget_history para historial de cambios en presupuestos

Esta migracion crea la tabla budget_history que registra todos los cambios
realizados a los presupuestos (ajustes, creacion, etc.)
"""

import sqlite3
from pathlib import Path

# Ubicacion de la BD
DB_PATH = Path(__file__).parent.parent.parent / "data" / "spm.db"

CREATE_BUDGET_HISTORY = """
CREATE TABLE IF NOT EXISTS budget_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro TEXT NOT NULL,
    sector TEXT NOT NULL,
    tipo_cambio TEXT NOT NULL,
    monto_anterior_usd REAL,
    monto_nuevo_usd REAL,
    saldo_anterior_usd REAL,
    saldo_nuevo_usd REAL,
    diferencia_usd REAL,
    solicitante_id TEXT,
    solicitante_nombre TEXT,
    aprobador_id TEXT,
    aprobador_nombre TEXT,
    justificacion TEXT,
    bur_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
"""

CREATE_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_budget_history_centro_sector ON budget_history(centro, sector);
CREATE INDEX IF NOT EXISTS idx_budget_history_tipo ON budget_history(tipo_cambio);
CREATE INDEX IF NOT EXISTS idx_budget_history_fecha ON budget_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_history_bur ON budget_history(bur_id);
"""


def run_migration():
    """Ejecutar migracion"""
    print(f">> Conectando a {DB_PATH}...")

    if not DB_PATH.exists():
        print(f"ERROR: Base de datos no encontrada en {DB_PATH}")
        return False

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 1. Crear tabla budget_history
        print(">> [1/2] Creando tabla budget_history...")
        cursor.execute(CREATE_BUDGET_HISTORY)
        print("   OK: Tabla creada")

        # 2. Crear indices
        print(">> [2/2] Creando indices...")
        cursor.executescript(CREATE_INDEXES)
        print("   OK: Indices creados")

        # Commit
        conn.commit()

        # Verificar tabla creada
        print("\n>> Verificando tabla...")
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='budget_history'"
        )
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(budget_history)")
            columns = [row[1] for row in cursor.fetchall()]
            print(f"   OK: budget_history creada con columnas: {columns}")
        else:
            print("   ERROR: budget_history no fue creada")
            return False

        return True

    except Exception as e:
        print(f"ERROR durante migracion: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()
        print(">> Conexion cerrada")


def main():
    print("=" * 70)
    print("  MIGRACION 023: Tabla budget_history")
    print("=" * 70)
    print()

    success = run_migration()

    print()
    if success:
        print("OK: Migracion completada con exito!")
    else:
        print("ERROR: Migracion fallo. Revisa los errores arriba.")
    print()


if __name__ == "__main__":
    main()
