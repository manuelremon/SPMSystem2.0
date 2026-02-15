"""
Migration 036: Reportes Programados
Creates table for scheduled report configuration.
"""
import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

PG_DDL = """
CREATE TABLE IF NOT EXISTS reporte_programado (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    frecuencia TEXT NOT NULL DEFAULT 'manual',
    filtros_json TEXT,
    destinatarios_json TEXT,
    formato TEXT NOT NULL DEFAULT 'xlsx',
    activo INTEGER NOT NULL DEFAULT 1,
    creado_por INTEGER NOT NULL,
    ultimo_envio TIMESTAMP,
    proximo_envio TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_tipo CHECK (tipo IN ('solicitudes', 'stock', 'presupuesto', 'kpis', 'materiales')),
    CONSTRAINT chk_frecuencia CHECK (frecuencia IN ('diario', 'semanal', 'mensual', 'manual')),
    CONSTRAINT chk_formato CHECK (formato IN ('xlsx', 'csv', 'pdf'))
);

CREATE INDEX IF NOT EXISTS idx_reporte_programado_tipo
    ON reporte_programado(tipo);
CREATE INDEX IF NOT EXISTS idx_reporte_programado_activo
    ON reporte_programado(activo);
CREATE INDEX IF NOT EXISTS idx_reporte_programado_proximo_envio
    ON reporte_programado(proximo_envio);
CREATE INDEX IF NOT EXISTS idx_reporte_programado_creado_por
    ON reporte_programado(creado_por);
"""

SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS reporte_programado (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    frecuencia TEXT NOT NULL DEFAULT 'manual',
    filtros_json TEXT,
    destinatarios_json TEXT,
    formato TEXT NOT NULL DEFAULT 'xlsx',
    activo INTEGER NOT NULL DEFAULT 1,
    creado_por INTEGER NOT NULL,
    ultimo_envio TEXT,
    proximo_envio TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reporte_programado_tipo
    ON reporte_programado(tipo);
CREATE INDEX IF NOT EXISTS idx_reporte_programado_activo
    ON reporte_programado(activo);
CREATE INDEX IF NOT EXISTS idx_reporte_programado_proximo_envio
    ON reporte_programado(proximo_envio);
CREATE INDEX IF NOT EXISTS idx_reporte_programado_creado_por
    ON reporte_programado(creado_por);
"""


def run_migration():
    from backend.core.db import get_db_transaction, is_using_postgresql

    pg = is_using_postgresql()
    ddl = PG_DDL if pg else SQLITE_DDL

    with get_db_transaction() as conn:
        cur = conn.cursor()
        for statement in ddl.strip().split(";"):
            statement = statement.strip()
            if statement:
                cur.execute(statement)

    db_type = "PostgreSQL" if pg else "SQLite"
    logger.info(f"[Migration 036] reporte_programado table created ({db_type})")
    print(f"Migration 036 applied successfully ({db_type})")


def rollback_migration():
    from backend.core.db import get_db_transaction

    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS reporte_programado")
    print("Migration 036 rolled back")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "run"
    if command == "rollback":
        rollback_migration()
    else:
        run_migration()
