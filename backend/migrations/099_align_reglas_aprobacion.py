"""
Migracion 099: Alinear reglas_aprobacion con el esquema de produccion.

PROBLEMA:
  La migracion 007 crea reglas_aprobacion con columnas *_usd / rol_requerido /
  nivel_aprobacion, pero produccion (PostgreSQL) tiene el esquema que usa el
  codigo (core/approval_strategies.py, services/approval_service.py):
    id, rol_solicitante, monto_minimo, monto_maximo, rol_aprobador,
    niveles_requeridos, activo, created_at
  En una BD creada con la 007 (SQLite de desarrollo) enviar/aprobar una
  solicitud falla con "no such column: monto_minimo".

SOLUCION:
  Si la tabla tiene el esquema viejo, se renombra a reglas_aprobacion_legacy_007
  y se crea la tabla con el esquema de produccion, vacia (en produccion no hay
  reglas cargadas). Si ya tiene el esquema correcto, no hace nada.

Fecha: 2026-09-27
"""

import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def _columns(cursor, is_pg):
    if is_pg:
        cursor.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'reglas_aprobacion'"
        )
        return {r[0] for r in cursor.fetchall()}
    cursor.execute("PRAGMA table_info(reglas_aprobacion)")
    return {r[1] for r in cursor.fetchall()}


def up():
    from backend.core.db import get_db_connection, is_using_postgresql

    is_pg = is_using_postgresql()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cols = _columns(cursor, is_pg)
        if cols and "monto_minimo" in cols:
            print("Migration 099: reglas_aprobacion ya tiene el esquema correcto")
            return

        if cols:
            cursor.execute("ALTER TABLE reglas_aprobacion RENAME TO reglas_aprobacion_legacy_007")

        if is_pg:
            cursor.execute(
                """
                CREATE TABLE reglas_aprobacion (
                    id SERIAL PRIMARY KEY,
                    rol_solicitante TEXT,
                    monto_minimo NUMERIC DEFAULT 0,
                    monto_maximo NUMERIC,
                    rol_aprobador TEXT,
                    niveles_requeridos INTEGER DEFAULT 1,
                    activo BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW()
                )
                """
            )
        else:
            cursor.execute(
                """
                CREATE TABLE reglas_aprobacion (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rol_solicitante TEXT,
                    monto_minimo REAL DEFAULT 0,
                    monto_maximo REAL,
                    rol_aprobador TEXT,
                    niveles_requeridos INTEGER DEFAULT 1,
                    activo BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        conn.commit()
    print("Migration 099: reglas_aprobacion alineada con el esquema de produccion")


def down():
    from backend.core.db import get_db_connection

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS reglas_aprobacion")
        try:
            cursor.execute("ALTER TABLE reglas_aprobacion_legacy_007 RENAME TO reglas_aprobacion")
        except Exception:
            pass
        conn.commit()


if __name__ == "__main__":
    up()
