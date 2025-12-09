#!/usr/bin/env python3
"""
Migracion 009: Tablas para ordenes planificadas y alertas MRP

Esta migracion:
1. Crea tabla ordenes_planificadas
2. Crea tabla alertas_mrp
"""

import sqlite3
from pathlib import Path

DB_PATH = Path("data/spm.db")


CREATE_ORDENES_PLANIFICADAS = """
CREATE TABLE IF NOT EXISTS ordenes_planificadas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_codigo TEXT NOT NULL,
    centro TEXT NOT NULL,
    cantidad REAL NOT NULL,
    fecha_necesidad TEXT NOT NULL,
    tipo TEXT NOT NULL,  -- 'compra', 'transferencia', 'produccion'
    prioridad TEXT DEFAULT 'normal',  -- 'alta', 'normal', 'baja'
    estado TEXT DEFAULT 'planificada',  -- 'planificada', 'convertida', 'cancelada'

    -- Referencia a SolPed si se convierte
    solped_id INTEGER,

    -- Audit
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_by TEXT,

    FOREIGN KEY (solped_id) REFERENCES solpeds(id)
)
"""

CREATE_ALERTAS_MRP = """
CREATE TABLE IF NOT EXISTS alertas_mrp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_codigo TEXT NOT NULL,
    centro TEXT NOT NULL,
    tipo TEXT NOT NULL,  -- 'quiebre', 'bajo_punto_pedido', 'sobrestock', etc.
    severidad TEXT NOT NULL,  -- 'danger', 'warning', 'info'
    mensaje TEXT,
    estado TEXT DEFAULT 'activa',  -- 'activa', 'resuelta', 'ignorada'

    -- Resolucion
    resuelto_por TEXT,
    accion_tomada TEXT,
    fecha_resolucion TEXT,

    -- Audit
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
"""

CREATE_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_ordenes_material ON ordenes_planificadas(material_codigo);
CREATE INDEX IF NOT EXISTS idx_ordenes_centro ON ordenes_planificadas(centro);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes_planificadas(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_fecha ON ordenes_planificadas(fecha_necesidad);

CREATE INDEX IF NOT EXISTS idx_alertas_mrp_material ON alertas_mrp(material_codigo);
CREATE INDEX IF NOT EXISTS idx_alertas_mrp_centro ON alertas_mrp(centro);
CREATE INDEX IF NOT EXISTS idx_alertas_mrp_estado ON alertas_mrp(estado);
CREATE INDEX IF NOT EXISTS idx_alertas_mrp_tipo ON alertas_mrp(tipo);
"""


def run_migration(db_path: Path = DB_PATH) -> bool:
    """
    Ejecuta la migracion.

    Args:
        db_path: Ruta a la base de datos

    Returns:
        True si la migracion fue exitosa
    """
    if not db_path.exists():
        print(f"Base de datos no encontrada: {db_path}")
        return False

    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()

            print("Creando tabla ordenes_planificadas...")
            cursor.executescript(CREATE_ORDENES_PLANIFICADAS)

            print("Creando tabla alertas_mrp...")
            cursor.executescript(CREATE_ALERTAS_MRP)

            print("Creando indices...")
            cursor.executescript(CREATE_INDEXES)

            conn.commit()

            # Verificar creacion
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN (?, ?)",
                ("ordenes_planificadas", "alertas_mrp"),
            )
            tables = cursor.fetchall()
            if len(tables) == 2:
                print("Migracion 009 completada exitosamente")
                return True
            else:
                print(f"Error: Solo se crearon {len(tables)} de 2 tablas")
                return False

    except Exception as e:
        print(f"Error en migracion: {e}")
        return False


def rollback(db_path: Path = DB_PATH) -> bool:
    """Revierte la migracion."""
    if not db_path.exists():
        print(f"Base de datos no encontrada: {db_path}")
        return False

    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()

            print("Eliminando tabla alertas_mrp...")
            cursor.execute("DROP TABLE IF EXISTS alertas_mrp")

            print("Eliminando tabla ordenes_planificadas...")
            cursor.execute("DROP TABLE IF EXISTS ordenes_planificadas")

            conn.commit()
            print("Rollback de migracion 009 completado")
            return True

    except Exception as e:
        print(f"Error en rollback: {e}")
        return False


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "rollback":
            rollback()
        else:
            print(f"Comando desconocido: {command}")
    else:
        run_migration()
