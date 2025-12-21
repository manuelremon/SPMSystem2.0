#!/usr/bin/env python3
"""
Migracion 010: Preferencias de Notificacion de Usuario

Esta migracion:
1. Crea tabla user_notification_preferences
2. Inserta preferencias por defecto para usuarios existentes
"""

import sqlite3
from pathlib import Path

DB_PATH = Path("data/spm.db")

# =============================================================================
# 1. Tabla user_notification_preferences
# =============================================================================

CREATE_NOTIFICATION_PREFERENCES = """
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id TEXT PRIMARY KEY,

    -- Preferencias generales
    push_enabled INTEGER DEFAULT 1,  -- Web Push habilitado
    sound_enabled INTEGER DEFAULT 1,  -- Sonido en notificaciones

    -- Preferencias por tipo de evento
    notif_solicitudes INTEGER DEFAULT 1,  -- Crear, eliminar, cambios
    notif_aprobaciones INTEGER DEFAULT 1,  -- Aprobadas, rechazadas
    notif_mensajes INTEGER DEFAULT 1,  -- Mensajes directos
    notif_presupuestos INTEGER DEFAULT 1,  -- Alertas de presupuesto
    notif_mrp INTEGER DEFAULT 1,  -- Alertas MRP
    notif_sla INTEGER DEFAULT 1,  -- Alertas SLA

    -- Audit
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)
"""

CREATE_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_notif_prefs_push ON user_notification_preferences(push_enabled);
"""

# =============================================================================
# 2. Insertar preferencias por defecto para usuarios existentes
# =============================================================================

INSERT_DEFAULTS = """
INSERT OR IGNORE INTO user_notification_preferences (user_id)
SELECT id_spm FROM usuarios WHERE id_spm IS NOT NULL
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
            print("Creando tabla user_notification_preferences...")
            cursor.executescript(CREATE_NOTIFICATION_PREFERENCES)

            # 2. Crear indices
            print("Creando indices...")
            cursor.executescript(CREATE_INDEXES)

            # 3. Insertar preferencias para usuarios existentes
            print("Insertando preferencias por defecto para usuarios existentes...")
            cursor.execute(INSERT_DEFAULTS)
            inserted = cursor.rowcount
            print(f"  {inserted} usuarios con preferencias inicializadas")

            conn.commit()

            # Verificar creacion
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
                ("user_notification_preferences",),
            )
            table = cursor.fetchone()
            if table:
                print("Migracion 010 completada exitosamente")
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

            print("Eliminando tabla user_notification_preferences...")
            cursor.execute("DROP TABLE IF EXISTS user_notification_preferences")

            conn.commit()
            print("Rollback de migracion 010 completado")
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
                ("user_notification_preferences",),
            )
            table = cursor.fetchone()

            if not table:
                return {"status": "not_applied", "table_exists": False}

            # Contar registros
            cursor.execute("SELECT COUNT(*) FROM user_notification_preferences")
            count = cursor.fetchone()[0]

            # Obtener columnas
            cursor.execute("PRAGMA table_info(user_notification_preferences)")
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
            print(f"Estado de migracion 010: {status}")
        else:
            print(f"Comando desconocido: {command}")
            print("Uso: python 010_notification_preferences.py [rollback|status]")
    else:
        run_migration()
