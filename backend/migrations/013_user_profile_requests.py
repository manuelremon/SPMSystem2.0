#!/usr/bin/env python3
"""
Migracion 013: Tabla de Solicitudes de Cambio de Perfil

Esta migracion:
1. Crea tabla user_profile_requests para gestionar solicitudes de cambio de perfil
"""

import sqlite3
from pathlib import Path

DB_PATH = Path("data/spm.db")

# =============================================================================
# 1. Tabla user_profile_requests
# =============================================================================

CREATE_USER_PROFILE_REQUESTS = """
CREATE TABLE IF NOT EXISTS user_profile_requests(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    payload TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id_spm)
)
"""

CREATE_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_profile_requests_usuario ON user_profile_requests(usuario_id);
CREATE INDEX IF NOT EXISTS idx_profile_requests_estado ON user_profile_requests(estado);
CREATE INDEX IF NOT EXISTS idx_profile_requests_created ON user_profile_requests(created_at);
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

            # 1. Crear tabla
            print("Creando tabla user_profile_requests...")
            cursor.executescript(CREATE_USER_PROFILE_REQUESTS)

            # 2. Crear indices
            print("Creando indices...")
            cursor.executescript(CREATE_INDEXES)

            conn.commit()

            # Verificar creacion
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
                ("user_profile_requests",),
            )
            table = cursor.fetchone()
            if table:
                print("Migracion 013 completada exitosamente")
                return True
            else:
                print("Error: Tabla no fue creada")
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

            print("Eliminando tabla user_profile_requests...")
            cursor.execute("DROP TABLE IF EXISTS user_profile_requests")

            conn.commit()
            print("Rollback de migracion 013 completado")
            return True

    except Exception as e:
        print(f"Error en rollback: {e}")
        return False


def check_status(db_path: Path = DB_PATH) -> dict:
    """Verifica el estado de la migracion."""
    if not db_path.exists():
        return {"error": "Base de datos no encontrada"}

    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()

            # Verificar tabla
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
                ("user_profile_requests",),
            )
            table = cursor.fetchone()

            if not table:
                return {"status": "not_applied", "table_exists": False}

            # Contar registros
            cursor.execute("SELECT COUNT(*) FROM user_profile_requests")
            count = cursor.fetchone()[0]

            # Obtener columnas
            cursor.execute("PRAGMA table_info(user_profile_requests)")
            columns = [row[1] for row in cursor.fetchall()]

            return {
                "status": "applied",
                "table_exists": True,
                "record_count": count,
                "columns": columns,
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
            print(f"Estado de migracion 013: {status}")
        else:
            print(f"Comando desconocido: {command}")
            print("Uso: python 013_user_profile_requests.py [rollback|status]")
    else:
        run_migration()
