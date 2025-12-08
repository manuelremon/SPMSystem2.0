#!/usr/bin/env python3
"""
Migracion 006: Tablas para FSM y Auditoria

Esta migracion:
1. Crea tabla solicitudes_historial_estados (historial de transiciones FSM)
2. Crea tabla audit_trail (trazabilidad completa de acciones)
3. Crea indices para consultas eficientes
"""

import sqlite3
from pathlib import Path

# Ubicacion de la BD
DB_PATH = Path("data/spm.db")

# ============================================================================
# 1. Tabla solicitudes_historial_estados
# ============================================================================

CREATE_HISTORIAL_ESTADOS = """
CREATE TABLE IF NOT EXISTS solicitudes_historial_estados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id INTEGER NOT NULL,
    estado_anterior TEXT NOT NULL,
    estado_nuevo TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    razon TEXT,
    metadata_json TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE
)
"""

CREATE_HISTORIAL_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_historial_solicitud ON solicitudes_historial_estados(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_historial_estado_nuevo ON solicitudes_historial_estados(estado_nuevo);
CREATE INDEX IF NOT EXISTS idx_historial_actor ON solicitudes_historial_estados(actor_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON solicitudes_historial_estados(created_at);
"""

# ============================================================================
# 2. Tabla audit_trail
# ============================================================================

CREATE_AUDIT_TRAIL = """
CREATE TABLE IF NOT EXISTS audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entidad TEXT NOT NULL,
    entidad_id TEXT NOT NULL,
    accion TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    campo_modificado TEXT,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    actor_rol TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
"""

CREATE_AUDIT_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_audit_entidad ON audit_trail(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_trail(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_fecha ON audit_trail(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_accion ON audit_trail(accion);
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

            # 1. Crear tabla historial_estados
            print("Creando tabla solicitudes_historial_estados...")
            cursor.executescript(CREATE_HISTORIAL_ESTADOS)

            # 2. Crear indices para historial
            print("Creando indices para historial_estados...")
            cursor.executescript(CREATE_HISTORIAL_INDEXES)

            # 3. Crear tabla audit_trail
            print("Creando tabla audit_trail...")
            cursor.executescript(CREATE_AUDIT_TRAIL)

            # 4. Crear indices para audit
            print("Creando indices para audit_trail...")
            cursor.executescript(CREATE_AUDIT_INDEXES)

            conn.commit()

            # Verificar creacion
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN (?, ?)",
                ('solicitudes_historial_estados', 'audit_trail')
            )
            tables = cursor.fetchall()
            if len(tables) == 2:
                print("Migracion 006 completada exitosamente")
                return True
            else:
                print(f"Error: Solo se crearon {len(tables)} de 2 tablas")
                return False

    except Exception as e:
        print(f"Error en migracion: {e}")
        return False


def rollback(db_path: Path = DB_PATH) -> bool:
    """
    Revierte la migracion (elimina las tablas creadas).

    Args:
        db_path: Ruta a la base de datos

    Returns:
        True si el rollback fue exitoso
    """
    if not db_path.exists():
        print(f"Base de datos no encontrada: {db_path}")
        return False

    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()

            print("Eliminando tabla audit_trail...")
            cursor.execute("DROP TABLE IF EXISTS audit_trail")

            print("Eliminando tabla solicitudes_historial_estados...")
            cursor.execute("DROP TABLE IF EXISTS solicitudes_historial_estados")

            conn.commit()
            print("Rollback de migracion 006 completado")
            return True

    except Exception as e:
        print(f"Error en rollback: {e}")
        return False


def check_status(db_path: Path = DB_PATH) -> dict:
    """
    Verifica el estado de la migracion.

    Args:
        db_path: Ruta a la base de datos

    Returns:
        Dict con estado de cada tabla
    """
    if not db_path.exists():
        return {"error": "Base de datos no encontrada"}

    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()

            # Verificar tablas
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN (?, ?)",
                ('solicitudes_historial_estados', 'audit_trail')
            )
            tables = [row[0] for row in cursor.fetchall()]

            # Contar registros
            counts = {}
            for table in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                counts[table] = cursor.fetchone()[0]

            return {
                "tablas_creadas": tables,
                "tablas_faltantes": [
                    t for t in ['solicitudes_historial_estados', 'audit_trail']
                    if t not in tables
                ],
                "registros": counts
            }

    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "rollback":
            rollback()
        elif command == "status":
            status = check_status()
            print(f"Estado de migracion 006: {status}")
        else:
            print(f"Comando desconocido: {command}")
            print("Uso: python 006_fsm_audit_tables.py [rollback|status]")
    else:
        run_migration()
