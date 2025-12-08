#!/usr/bin/env python3
"""
Migracion 007: Tabla de Reglas de Aprobacion Parametrizables

Esta migracion:
1. Crea tabla reglas_aprobacion (matriz de limites y roles)
2. Crea tabla aprobadores_delegados (delegacion temporal)
3. Inserta reglas por defecto basadas en los valores hardcodeados actuales
"""

import sqlite3
from pathlib import Path

DB_PATH = Path("data/spm.db")

# =============================================================================
# 1. Tabla reglas_aprobacion
# =============================================================================

CREATE_REGLAS_APROBACION = """
CREATE TABLE IF NOT EXISTS reglas_aprobacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,

    -- Condiciones de aplicacion
    monto_minimo_usd REAL DEFAULT 0,
    monto_maximo_usd REAL,
    centro TEXT,
    sector TEXT,
    criticidad TEXT,

    -- Rol requerido para aprobar
    rol_requerido TEXT NOT NULL,
    nivel_aprobacion INTEGER DEFAULT 1,

    -- Configuracion
    activo INTEGER DEFAULT 1,
    requiere_justificacion INTEGER DEFAULT 0,
    requiere_documentacion INTEGER DEFAULT 0,

    -- Audit
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_by TEXT
)
"""

CREATE_REGLAS_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_reglas_monto ON reglas_aprobacion(monto_minimo_usd, monto_maximo_usd);
CREATE INDEX IF NOT EXISTS idx_reglas_centro ON reglas_aprobacion(centro);
CREATE INDEX IF NOT EXISTS idx_reglas_activo ON reglas_aprobacion(activo);
"""

# =============================================================================
# 2. Tabla aprobadores_delegados
# =============================================================================

CREATE_APROBADORES_DELEGADOS = """
CREATE TABLE IF NOT EXISTS aprobadores_delegados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aprobador_original_id TEXT NOT NULL,
    delegado_id TEXT NOT NULL,
    fecha_inicio TEXT NOT NULL,
    fecha_fin TEXT NOT NULL,
    motivo TEXT,
    activo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_by TEXT,

    UNIQUE(aprobador_original_id, delegado_id, fecha_inicio)
)
"""

CREATE_DELEGADOS_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_delegados_original ON aprobadores_delegados(aprobador_original_id);
CREATE INDEX IF NOT EXISTS idx_delegados_fechas ON aprobadores_delegados(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_delegados_activo ON aprobadores_delegados(activo);
"""

# =============================================================================
# 3. Reglas por defecto (basadas en valores actuales hardcodeados)
# =============================================================================

REGLAS_DEFAULT = """
-- Regla 1: Montos bajos (< $5,000) - Aprobador standard
INSERT INTO reglas_aprobacion
    (nombre, descripcion, monto_minimo_usd, monto_maximo_usd, rol_requerido, nivel_aprobacion, created_by)
VALUES
    ('Aprobacion Nivel 1', 'Solicitudes hasta $5,000 USD', 0, 4999.99, 'aprobador', 1, 'sistema');

-- Regla 2: Montos medios ($5,000 - $20,000) - Jefe
INSERT INTO reglas_aprobacion
    (nombre, descripcion, monto_minimo_usd, monto_maximo_usd, rol_requerido, nivel_aprobacion, requiere_justificacion, created_by)
VALUES
    ('Aprobacion Nivel 2', 'Solicitudes de $5,000 a $20,000 USD', 5000, 19999.99, 'jefe', 2, 1, 'sistema');

-- Regla 3: Montos altos ($20,000 - $50,000) - Gerente
INSERT INTO reglas_aprobacion
    (nombre, descripcion, monto_minimo_usd, monto_maximo_usd, rol_requerido, nivel_aprobacion, requiere_justificacion, requiere_documentacion, created_by)
VALUES
    ('Aprobacion Nivel 3', 'Solicitudes de $20,000 a $50,000 USD', 20000, 49999.99, 'gerente', 3, 1, 1, 'sistema');

-- Regla 4: Montos muy altos (>= $50,000) - Gerente General
INSERT INTO reglas_aprobacion
    (nombre, descripcion, monto_minimo_usd, monto_maximo_usd, rol_requerido, nivel_aprobacion, requiere_justificacion, requiere_documentacion, created_by)
VALUES
    ('Aprobacion Nivel 4', 'Solicitudes mayores a $50,000 USD', 50000, NULL, 'gerente', 4, 1, 1, 'sistema');

-- Regla 5: Criticidad Alta - siempre requiere Jefe minimo
INSERT INTO reglas_aprobacion
    (nombre, descripcion, monto_minimo_usd, monto_maximo_usd, criticidad, rol_requerido, nivel_aprobacion, requiere_justificacion, created_by)
VALUES
    ('Criticidad Alta', 'Solicitudes con criticidad alta requieren Jefe', 0, NULL, 'Alta', 'jefe', 2, 1, 'sistema');

-- Regla 6: Admin tiene acceso total
INSERT INTO reglas_aprobacion
    (nombre, descripcion, monto_minimo_usd, monto_maximo_usd, rol_requerido, nivel_aprobacion, created_by)
VALUES
    ('Admin Override', 'Administradores pueden aprobar cualquier monto', 0, NULL, 'admin', 0, 'sistema');
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

            # 1. Crear tabla reglas_aprobacion
            print("Creando tabla reglas_aprobacion...")
            cursor.executescript(CREATE_REGLAS_APROBACION)

            # 2. Crear indices
            print("Creando indices para reglas_aprobacion...")
            cursor.executescript(CREATE_REGLAS_INDEXES)

            # 3. Crear tabla aprobadores_delegados
            print("Creando tabla aprobadores_delegados...")
            cursor.executescript(CREATE_APROBADORES_DELEGADOS)

            # 4. Crear indices delegados
            print("Creando indices para aprobadores_delegados...")
            cursor.executescript(CREATE_DELEGADOS_INDEXES)

            # 5. Insertar reglas por defecto (solo si tabla esta vacia)
            cursor.execute("SELECT COUNT(*) FROM reglas_aprobacion")
            count = cursor.fetchone()[0]
            if count == 0:
                print("Insertando reglas de aprobacion por defecto...")
                cursor.executescript(REGLAS_DEFAULT)
            else:
                print(f"Tabla reglas_aprobacion ya tiene {count} registros, no se insertan defaults")

            conn.commit()

            # Verificar creacion
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN (?, ?)",
                ('reglas_aprobacion', 'aprobadores_delegados')
            )
            tables = cursor.fetchall()
            if len(tables) == 2:
                print("Migracion 007 completada exitosamente")
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

            print("Eliminando tabla aprobadores_delegados...")
            cursor.execute("DROP TABLE IF EXISTS aprobadores_delegados")

            print("Eliminando tabla reglas_aprobacion...")
            cursor.execute("DROP TABLE IF EXISTS reglas_aprobacion")

            conn.commit()
            print("Rollback de migracion 007 completado")
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

            # Verificar tablas
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN (?, ?)",
                ('reglas_aprobacion', 'aprobadores_delegados')
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
                    t for t in ['reglas_aprobacion', 'aprobadores_delegados']
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
            print(f"Estado de migracion 007: {status}")
        else:
            print(f"Comando desconocido: {command}")
            print("Uso: python 007_approval_rules.py [rollback|status]")
    else:
        run_migration()
