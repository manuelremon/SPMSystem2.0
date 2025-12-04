#!/usr/bin/env python3
"""
Migracion 004: Configuracion de Almacenes y Proveedores

Esta migracion:
1. Crea tabla config_almacenes (politicas de transferencia por almacen)
2. Agrega datos iniciales de almacenes con sus politicas
"""

import sqlite3
from pathlib import Path

# Ubicacion de la BD
DB_PATH = Path("backend_v2/spm.db")

# ============================================================================
# 1. Tabla config_almacenes
# ============================================================================

CREATE_CONFIG_ALMACENES = """
CREATE TABLE IF NOT EXISTS config_almacenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    centro TEXT NOT NULL,
    almacen TEXT NOT NULL,
    nombre TEXT,
    libre_disponibilidad INTEGER DEFAULT 0,
    responsable_id TEXT,
    excluido INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(centro, almacen)
)
"""

CREATE_CONFIG_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_config_alm_centro ON config_almacenes(centro);
CREATE INDEX IF NOT EXISTS idx_config_alm_libre ON config_almacenes(libre_disponibilidad);
"""

# Datos iniciales para centro 1008
INSERT_DATA = [
    ("1008", "0001", "Stock Fisico Planta", 0, 0),
    ("1008", "0100", "Libre Disponibilidad", 1, 0),
    ("1008", "9999", "Stock Transaccional", 1, 0),
    ("1008", "9003", "Reserva Materiales", 0, 0),
    ("1008", "9002", "Calidad", 0, 0),
    ("1008", "9004", "Bloqueado", 0, 0),
    ("1008", "0005", "Consignacion", 0, 0),
    # Almacenes excluidos (no mostrar)
    ("1008", "1000", "Excluido - No usar", 0, 1),
    ("1008", "9000", "Excluido - No usar", 0, 1),
    ("1008", "9100", "Excluido - No usar", 0, 1),
    ("1008", "9200", "Excluido - No usar", 0, 1),
]

INSERT_SQL = """
INSERT OR IGNORE INTO config_almacenes (centro, almacen, nombre, libre_disponibilidad, excluido)
VALUES (?, ?, ?, ?, ?)
"""

# ============================================================================
# 2. Tabla config_lotes_excluidos
# ============================================================================

CREATE_LOTES_EXCLUIDOS = """
CREATE TABLE IF NOT EXISTS config_lotes_excluidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lote TEXT NOT NULL UNIQUE,
    motivo TEXT,
    created_at TEXT DEFAULT (datetime('now'))
)
"""

INSERT_LOTES = [
    ("GREZAG", "Lote no disponible para transferencia"),
    ("GAREPA", "Lote no disponible para transferencia"),
]

INSERT_LOTE_SQL = """
INSERT OR IGNORE INTO config_lotes_excluidos (lote, motivo) VALUES (?, ?)
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
        # 1. Crear tabla config_almacenes
        print(">> [1/4] Creando tabla config_almacenes...")
        cursor.execute(CREATE_CONFIG_ALMACENES)
        cursor.executescript(CREATE_CONFIG_INDEXES)
        print("   OK: Tabla e indices creados")

        # 2. Insertar datos iniciales
        print(">> [2/4] Insertando datos de almacenes...")
        for data in INSERT_DATA:
            cursor.execute(INSERT_SQL, data)
        conn.commit()
        cursor.execute("SELECT COUNT(*) FROM config_almacenes")
        count = cursor.fetchone()[0]
        print(f"   OK: {count} registros en config_almacenes")

        # 3. Crear tabla config_lotes_excluidos
        print(">> [3/4] Creando tabla config_lotes_excluidos...")
        cursor.execute(CREATE_LOTES_EXCLUIDOS)
        for data in INSERT_LOTES:
            cursor.execute(INSERT_LOTE_SQL, data)
        conn.commit()
        cursor.execute("SELECT COUNT(*) FROM config_lotes_excluidos")
        count = cursor.fetchone()[0]
        print(f"   OK: {count} lotes excluidos registrados")

        # 4. Verificar
        print(">> [4/4] Verificando tablas...")
        for table in ["config_almacenes", "config_lotes_excluidos"]:
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if cursor.fetchone():
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"   OK: {table} ({count} registros)")
            else:
                print(f"   ERROR: {table} no fue creada")
                return False

        # Mostrar datos
        print("\n>> Almacenes configurados:")
        cursor.execute(
            "SELECT centro, almacen, nombre, libre_disponibilidad, excluido FROM config_almacenes"
        )
        for row in cursor.fetchall():
            status = "EXCLUIDO" if row[4] else ("LIBRE" if row[3] else "CONSULTAR")
            print(f"   {row[0]}/{row[1]}: {row[2]} [{status}]")

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
    print("  MIGRACION 004: Configuracion de Almacenes")
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
