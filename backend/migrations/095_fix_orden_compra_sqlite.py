"""
Migración 095: Recrea orden_compra con estructura moderna (SQLite)

La tabla orden_compra fue creada originalmente con una estructura legacy
(columnas: status, subtotal, numero, created_by) incompatible con el seed
y los servicios actuales que esperan (estado, monto_total, numero_oc, creado_por).

Esta migración:
1. Renombra la tabla legacy a orden_compra_legacy (preserva datos)
2. Crea la tabla nueva con la estructura correcta de migración 034
3. Solo actúa en SQLite; en PostgreSQL la migración 034 ya crea la tabla correcta.

Fecha: 2026-05-25
"""

import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

logger = logging.getLogger(__name__)


def run_migration(conn=None):
    """
    Recrea orden_compra con estructura moderna.
    Acepta una conexión SQLite explícita (para runners que no usan Flask DB).
    """
    import sqlite3 as _sqlite3

    try:
        # Si se pasa una conexión externa (runner directo), usarla
        if conn is not None:
            _run(conn)
            return True

        # Si no, intentar con el stack de Flask
        try:
            from backend.core.db import is_using_postgresql
            if is_using_postgresql():
                logger.info("Migración 095: no aplica a PostgreSQL")
                return True
        except Exception:
            pass

        db_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "data", "spm.db"
        )
        _conn = _sqlite3.connect(db_path)
        try:
            _run(_conn)
            _conn.commit()
        finally:
            _conn.close()

        return True

    except Exception as e:
        logger.error("Migración 095 falló: %s", e)
        import traceback
        traceback.print_exc()
        return False


def _run(conn):
    cursor = conn.cursor()

    # Verificar si la tabla tiene estructura legacy (columna 'status' en lugar de 'estado')
    cols = cursor.execute("PRAGMA table_info(orden_compra)").fetchall()
    col_names = [c[1] for c in cols]

    if 'estado' in col_names:
        logger.info("Migración 095: orden_compra ya tiene estructura correcta, omitiendo")
        return

    if 'status' in col_names:
        logger.info("Migración 095: renombrando tabla legacy y creando tabla nueva")
        cursor.execute("ALTER TABLE orden_compra RENAME TO orden_compra_legacy")

    # Crear tabla con estructura correcta (SQLite)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orden_compra (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_oc TEXT UNIQUE NOT NULL,
            solicitud_id INTEGER,
            proveedor_cuit TEXT NOT NULL,
            proveedor_nombre TEXT NOT NULL,
            centro TEXT NOT NULL,
            estado TEXT NOT NULL DEFAULT 'borrador'
                CHECK(estado IN (
                    'borrador', 'pendiente_aprobacion', 'aprobada',
                    'enviada', 'recepcion_parcial', 'completada', 'cancelada'
                )),
            monto_total REAL DEFAULT 0,
            moneda TEXT DEFAULT 'ARS',
            fecha_emision TEXT,
            fecha_entrega_estimada TEXT,
            fecha_entrega_real TEXT,
            notas TEXT,
            creado_por INTEGER NOT NULL,
            aprobado_por INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_oc_estado ON orden_compra(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_oc_proveedor ON orden_compra(proveedor_cuit)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_oc_solicitud ON orden_compra(solicitud_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_oc_centro ON orden_compra(centro)")
    conn.commit()
    logger.info("Migración 095: orden_compra recreada exitosamente")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migration()
