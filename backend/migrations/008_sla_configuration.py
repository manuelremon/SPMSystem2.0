#!/usr/bin/env python3
"""
Migracion 008: Configuracion de SLA (Service Level Agreement)

Esta migracion:
1. Crea tabla sla_configuracion (tiempos por criticidad/estado)
2. Crea tabla sla_alertas (alertas de incumplimiento)
3. Agrega columnas de tracking de tiempos en solicitudes
4. Inserta configuracion SLA por defecto
"""

import sqlite3
from pathlib import Path

DB_PATH = Path("data/spm.db")

# =============================================================================
# 1. Tabla sla_configuracion
# =============================================================================

CREATE_SLA_CONFIGURACION = """
CREATE TABLE IF NOT EXISTS sla_configuracion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,

    -- Condiciones de aplicacion
    criticidad TEXT,  -- Baja, Normal, Alta, Urgente (NULL = todas)
    estado_desde TEXT NOT NULL,  -- Estado inicial (submitted, approved, etc.)
    estado_hasta TEXT NOT NULL,  -- Estado destino

    -- Tiempos en horas
    tiempo_objetivo_horas INTEGER NOT NULL,
    tiempo_alerta_horas INTEGER,  -- Cuando alertar (antes de vencer)

    -- Configuracion
    activo INTEGER DEFAULT 1,
    notificar_al_vencer INTEGER DEFAULT 1,
    escalar_al_vencer INTEGER DEFAULT 0,
    escalar_a_rol TEXT,  -- Rol al que escalar si vence

    -- Audit
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_by TEXT
)
"""

CREATE_SLA_CONFIG_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_sla_config_criticidad ON sla_configuracion(criticidad);
CREATE INDEX IF NOT EXISTS idx_sla_config_estados ON sla_configuracion(estado_desde, estado_hasta);
CREATE INDEX IF NOT EXISTS idx_sla_config_activo ON sla_configuracion(activo);
"""

# =============================================================================
# 2. Tabla sla_alertas
# =============================================================================

CREATE_SLA_ALERTAS = """
CREATE TABLE IF NOT EXISTS sla_alertas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id INTEGER NOT NULL,
    sla_config_id INTEGER NOT NULL,

    -- Estado de la alerta
    tipo TEXT NOT NULL,  -- 'warning', 'breach', 'escalated'
    estado TEXT DEFAULT 'activa',  -- 'activa', 'resuelta', 'ignorada'

    -- Tiempos
    fecha_inicio TEXT NOT NULL,  -- Cuando inicio el contador
    fecha_vencimiento TEXT NOT NULL,  -- Cuando vence/vencio
    fecha_resolucion TEXT,  -- Cuando se resolvio (si aplica)

    -- Detalles
    tiempo_transcurrido_horas REAL,
    tiempo_objetivo_horas INTEGER,
    porcentaje_cumplimiento REAL,
    mensaje TEXT,

    -- Escalamiento
    escalado INTEGER DEFAULT 0,
    escalado_a TEXT,
    fecha_escalamiento TEXT,

    -- Audit
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    resuelto_por TEXT,

    FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id),
    FOREIGN KEY (sla_config_id) REFERENCES sla_configuracion(id)
)
"""

CREATE_SLA_ALERTAS_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_sla_alertas_solicitud ON sla_alertas(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_sla_alertas_estado ON sla_alertas(estado);
CREATE INDEX IF NOT EXISTS idx_sla_alertas_tipo ON sla_alertas(tipo);
CREATE INDEX IF NOT EXISTS idx_sla_alertas_vencimiento ON sla_alertas(fecha_vencimiento);
"""

# =============================================================================
# 3. Columnas adicionales en solicitudes
# =============================================================================

ALTER_SOLICITUDES = """
-- Agregar columnas de tracking SLA si no existen
ALTER TABLE solicitudes ADD COLUMN sla_fecha_limite TEXT;
ALTER TABLE solicitudes ADD COLUMN sla_estado TEXT DEFAULT 'on_time';
ALTER TABLE solicitudes ADD COLUMN sla_tiempo_respuesta_horas REAL;
"""

# =============================================================================
# 4. Configuracion SLA por defecto
# =============================================================================

SLA_DEFAULTS = """
-- SLA: Aprobacion de solicitudes
INSERT INTO sla_configuracion
    (nombre, descripcion, criticidad, estado_desde, estado_hasta, tiempo_objetivo_horas, tiempo_alerta_horas, notificar_al_vencer, created_by)
VALUES
    ('Aprobacion Urgente', 'Solicitudes urgentes deben aprobarse en 4 horas', 'Urgente', 'submitted', 'approved', 4, 2, 1, 'sistema'),
    ('Aprobacion Alta', 'Solicitudes alta prioridad en 8 horas', 'Alta', 'submitted', 'approved', 8, 4, 1, 'sistema'),
    ('Aprobacion Normal', 'Solicitudes normales en 24 horas', 'Normal', 'submitted', 'approved', 24, 12, 1, 'sistema'),
    ('Aprobacion Baja', 'Solicitudes baja prioridad en 48 horas', 'Baja', 'submitted', 'approved', 48, 24, 1, 'sistema');

-- SLA: Planificacion de solicitudes aprobadas
INSERT INTO sla_configuracion
    (nombre, descripcion, criticidad, estado_desde, estado_hasta, tiempo_objetivo_horas, tiempo_alerta_horas, notificar_al_vencer, created_by)
VALUES
    ('Planificacion Urgente', 'Urgentes deben planificarse en 2 horas', 'Urgente', 'approved', 'in_treatment', 2, 1, 1, 'sistema'),
    ('Planificacion Alta', 'Alta prioridad en 4 horas', 'Alta', 'approved', 'in_treatment', 4, 2, 1, 'sistema'),
    ('Planificacion Normal', 'Normal en 8 horas', 'Normal', 'approved', 'in_treatment', 8, 4, 1, 'sistema'),
    ('Planificacion Baja', 'Baja prioridad en 24 horas', 'Baja', 'approved', 'in_treatment', 24, 12, 1, 'sistema');

-- SLA: Tratamiento completo
INSERT INTO sla_configuracion
    (nombre, descripcion, criticidad, estado_desde, estado_hasta, tiempo_objetivo_horas, tiempo_alerta_horas, notificar_al_vencer, escalar_al_vencer, escalar_a_rol, created_by)
VALUES
    ('Tratamiento Urgente', 'Tratamiento urgente en 8 horas', 'Urgente', 'in_treatment', 'treated', 8, 4, 1, 1, 'jefe', 'sistema'),
    ('Tratamiento Alta', 'Tratamiento alta en 16 horas', 'Alta', 'in_treatment', 'treated', 16, 8, 1, 1, 'jefe', 'sistema'),
    ('Tratamiento Normal', 'Tratamiento normal en 48 horas', 'Normal', 'in_treatment', 'treated', 48, 24, 1, 0, NULL, 'sistema'),
    ('Tratamiento Baja', 'Tratamiento baja en 72 horas', 'Baja', 'in_treatment', 'treated', 72, 48, 1, 0, NULL, 'sistema');

-- SLA: Tiempo total de ciclo (end-to-end)
INSERT INTO sla_configuracion
    (nombre, descripcion, criticidad, estado_desde, estado_hasta, tiempo_objetivo_horas, tiempo_alerta_horas, notificar_al_vencer, escalar_al_vencer, escalar_a_rol, created_by)
VALUES
    ('Ciclo Total Urgente', 'Ciclo completo urgente en 24 horas', 'Urgente', 'submitted', 'completed', 24, 12, 1, 1, 'gerente', 'sistema'),
    ('Ciclo Total Alta', 'Ciclo completo alta en 48 horas', 'Alta', 'submitted', 'completed', 48, 24, 1, 1, 'gerente', 'sistema'),
    ('Ciclo Total Normal', 'Ciclo completo normal en 120 horas (5 dias)', 'Normal', 'submitted', 'completed', 120, 72, 1, 0, NULL, 'sistema'),
    ('Ciclo Total Baja', 'Ciclo completo baja en 240 horas (10 dias)', 'Baja', 'submitted', 'completed', 240, 120, 1, 0, NULL, 'sistema');
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

            # 1. Crear tabla sla_configuracion
            print("Creando tabla sla_configuracion...")
            cursor.executescript(CREATE_SLA_CONFIGURACION)

            # 2. Crear indices
            print("Creando indices para sla_configuracion...")
            cursor.executescript(CREATE_SLA_CONFIG_INDEXES)

            # 3. Crear tabla sla_alertas
            print("Creando tabla sla_alertas...")
            cursor.executescript(CREATE_SLA_ALERTAS)

            # 4. Crear indices alertas
            print("Creando indices para sla_alertas...")
            cursor.executescript(CREATE_SLA_ALERTAS_INDEXES)

            # 5. Agregar columnas a solicitudes (ignorar si ya existen)
            print("Agregando columnas SLA a solicitudes...")
            for stmt in ALTER_SOLICITUDES.strip().split(";"):
                stmt = stmt.strip()
                if stmt and not stmt.startswith("--"):
                    try:
                        cursor.execute(stmt)
                    except sqlite3.OperationalError as e:
                        if "duplicate column name" in str(e).lower():
                            print(f"  Columna ya existe, continuando...")
                        else:
                            raise

            # 6. Insertar configuracion por defecto (solo si tabla esta vacia)
            cursor.execute("SELECT COUNT(*) FROM sla_configuracion")
            count = cursor.fetchone()[0]
            if count == 0:
                print("Insertando configuracion SLA por defecto...")
                cursor.executescript(SLA_DEFAULTS)
            else:
                print(f"Tabla sla_configuracion ya tiene {count} registros, no se insertan defaults")

            conn.commit()

            # Verificar creacion
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN (?, ?)",
                ('sla_configuracion', 'sla_alertas')
            )
            tables = cursor.fetchall()
            if len(tables) == 2:
                print("Migracion 008 completada exitosamente")
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

            print("Eliminando tabla sla_alertas...")
            cursor.execute("DROP TABLE IF EXISTS sla_alertas")

            print("Eliminando tabla sla_configuracion...")
            cursor.execute("DROP TABLE IF EXISTS sla_configuracion")

            # No eliminar columnas de solicitudes (SQLite no soporta DROP COLUMN facilmente)
            print("Nota: Las columnas SLA en solicitudes no se eliminan")

            conn.commit()
            print("Rollback de migracion 008 completado")
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
                ('sla_configuracion', 'sla_alertas')
            )
            tables = [row[0] for row in cursor.fetchall()]

            # Contar registros
            counts = {}
            for table in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                counts[table] = cursor.fetchone()[0]

            # Verificar columnas en solicitudes
            cursor.execute("PRAGMA table_info(solicitudes)")
            columns = [row[1] for row in cursor.fetchall()]
            sla_columns = [c for c in columns if c.startswith('sla_')]

            return {
                "tablas_creadas": tables,
                "tablas_faltantes": [
                    t for t in ['sla_configuracion', 'sla_alertas']
                    if t not in tables
                ],
                "registros": counts,
                "columnas_sla_en_solicitudes": sla_columns
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
            print(f"Estado de migracion 008: {status}")
        else:
            print(f"Comando desconocido: {command}")
            print("Uso: python 008_sla_configuration.py [rollback|status]")
    else:
        run_migration()
