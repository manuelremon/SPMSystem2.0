#!/usr/bin/env python3
"""
Migracion 003: Sistema de Presupuestos con Ledger y Budget Update Requests

Esta migracion:
1. Agrega columnas de centavos y versionado a tabla presupuestos
2. Crea tabla presupuesto_ledger (transacciones inmutables)
3. Crea tabla budget_update_requests (solicitudes de aumento)
4. Migra datos existentes de USD a centavos
"""

import sqlite3
from pathlib import Path

# Ubicacion de la BD
DB_PATH = Path("backend_v2/spm.db")

# ============================================================================
# 1. Modificar tabla presupuestos existente
# ============================================================================

ALTER_PRESUPUESTOS = [
    "ALTER TABLE presupuestos ADD COLUMN monto_cents INTEGER DEFAULT 0",
    "ALTER TABLE presupuestos ADD COLUMN saldo_cents INTEGER DEFAULT 0",
    "ALTER TABLE presupuestos ADD COLUMN version INTEGER DEFAULT 1",
    "ALTER TABLE presupuestos ADD COLUMN updated_by TEXT",
]

MIGRATE_CENTS = """
UPDATE presupuestos SET
    monto_cents = CAST(ROUND(COALESCE(monto_usd, 0) * 100) AS INTEGER),
    saldo_cents = CAST(ROUND(COALESCE(saldo_usd, 0) * 100) AS INTEGER)
WHERE monto_cents = 0 OR monto_cents IS NULL
"""

# ============================================================================
# 2. Tabla presupuesto_ledger (inmutable)
# ============================================================================

CREATE_LEDGER = """
CREATE TABLE IF NOT EXISTS presupuesto_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key TEXT UNIQUE NOT NULL,
    centro TEXT NOT NULL,
    sector TEXT NOT NULL,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN (
        'consumo_aprobacion',
        'reversion_rechazo',
        'ajuste_manual',
        'bur_aprobado'
    )),
    monto_cents INTEGER NOT NULL,
    saldo_anterior_cents INTEGER NOT NULL,
    saldo_posterior_cents INTEGER NOT NULL,
    referencia_tipo TEXT,
    referencia_id INTEGER,
    actor_id TEXT NOT NULL,
    actor_rol TEXT,
    motivo TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
"""

CREATE_LEDGER_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_ledger_centro_sector ON presupuesto_ledger(centro, sector);
CREATE INDEX IF NOT EXISTS idx_ledger_tipo ON presupuesto_ledger(tipo_movimiento);
CREATE INDEX IF NOT EXISTS idx_ledger_referencia ON presupuesto_ledger(referencia_tipo, referencia_id);
CREATE INDEX IF NOT EXISTS idx_ledger_actor ON presupuesto_ledger(actor_id);
CREATE INDEX IF NOT EXISTS idx_ledger_fecha ON presupuesto_ledger(created_at DESC);
"""

# ============================================================================
# 3. Tabla budget_update_requests
# ============================================================================

CREATE_BUR = """
CREATE TABLE IF NOT EXISTS budget_update_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro TEXT NOT NULL,
    sector TEXT NOT NULL,
    monto_solicitado_cents INTEGER NOT NULL,
    saldo_actual_cents INTEGER NOT NULL,
    nivel_aprobacion_requerido TEXT NOT NULL CHECK (nivel_aprobacion_requerido IN ('L1', 'L2', 'ADMIN')),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
        'pendiente', 'aprobado_l1', 'aprobado_l2', 'aprobado', 'rechazado'
    )),
    solicitante_id TEXT NOT NULL,
    solicitante_rol TEXT,
    justificacion TEXT NOT NULL,
    aprobador_l1_id TEXT,
    aprobador_l1_fecha TEXT,
    aprobador_l1_comentario TEXT,
    aprobador_l2_id TEXT,
    aprobador_l2_fecha TEXT,
    aprobador_l2_comentario TEXT,
    aprobador_final_id TEXT,
    aprobador_final_fecha TEXT,
    aprobador_final_comentario TEXT,
    rechazado_por TEXT,
    motivo_rechazo TEXT,
    fecha_rechazo TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
"""

CREATE_BUR_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_bur_estado ON budget_update_requests(estado);
CREATE INDEX IF NOT EXISTS idx_bur_centro_sector ON budget_update_requests(centro, sector);
CREATE INDEX IF NOT EXISTS idx_bur_solicitante ON budget_update_requests(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_bur_nivel ON budget_update_requests(nivel_aprobacion_requerido);
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
        # 1. Modificar tabla presupuestos
        print(">> [1/5] Agregando columnas a tabla presupuestos...")
        for sql in ALTER_PRESUPUESTOS:
            try:
                cursor.execute(sql)
                col_name = sql.split("ADD COLUMN ")[1].split(" ")[0]
                print(f"   OK: Columna '{col_name}' agregada")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower():
                    col_name = sql.split("ADD COLUMN ")[1].split(" ")[0]
                    print(f"   SKIP: Columna '{col_name}' ya existe")
                else:
                    print(f"   WARN: {e}")

        # 2. Migrar datos USD -> cents
        print(">> [2/5] Migrando datos USD a centavos...")
        cursor.execute(MIGRATE_CENTS)
        migrated = cursor.rowcount
        print(f"   OK: {migrated} registros migrados")

        # 3. Crear tabla ledger
        print(">> [3/5] Creando tabla presupuesto_ledger...")
        cursor.execute(CREATE_LEDGER)
        cursor.executescript(CREATE_LEDGER_INDEXES)
        print("   OK: Tabla e indices creados")

        # 4. Crear tabla BUR
        print(">> [4/5] Creando tabla budget_update_requests...")
        cursor.execute(CREATE_BUR)
        cursor.executescript(CREATE_BUR_INDEXES)
        print("   OK: Tabla e indices creados")

        # 5. Commit
        print(">> [5/5] Guardando cambios...")
        conn.commit()

        # Verificar tablas creadas
        print("\n>> Verificando tablas...")
        for table in ["presupuesto_ledger", "budget_update_requests"]:
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if cursor.fetchone():
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"   OK: {table} (registros: {count})")
            else:
                print(f"   ERROR: {table} no fue creada")
                return False

        # Verificar columnas en presupuestos
        cursor.execute("PRAGMA table_info(presupuestos)")
        columns = {row[1] for row in cursor.fetchall()}
        required = {"monto_cents", "saldo_cents", "version", "updated_by"}
        missing = required - columns
        if missing:
            print(f"   ERROR: Columnas faltantes en presupuestos: {missing}")
            return False
        print("   OK: presupuestos tiene columnas nuevas")

        # Mostrar muestra de datos migrados
        cursor.execute(
            "SELECT centro, sector, monto_usd, monto_cents, saldo_usd, saldo_cents FROM presupuestos LIMIT 3"
        )
        rows = cursor.fetchall()
        if rows:
            print("\n>> Muestra de datos migrados:")
            for row in rows:
                print(
                    f"   {row[0]}/{row[1]}: ${row[2]:.2f} -> {row[3]} cents, saldo ${row[4]:.2f} -> {row[5]} cents"
                )

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
    print("  MIGRACION 003: Sistema de Presupuestos con Ledger y BUR")
    print("=" * 70)
    print()

    success = run_migration()

    print()
    if success:
        print("OK: Migracion completada con exito!")
        print("\nProximos pasos:")
        print(
            "  1. Verificar: python -c \"from backend_v2.core.budget_schemas import *; print('OK')\""
        )
        print("  2. Reiniciar backend: python wsgi.py")
    else:
        print("ERROR: Migracion fallo. Revisa los errores arriba.")
    print()


if __name__ == "__main__":
    main()
