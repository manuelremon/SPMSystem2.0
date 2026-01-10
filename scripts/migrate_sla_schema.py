#!/usr/bin/env python3
"""
Migración SLA Schema para PostgreSQL

Este script actualiza las tablas SLA en PostgreSQL para que coincidan
con el schema requerido por el código del backend.

Uso:
    python scripts/migrate_sla_schema.py [--verify]
"""

import os
import sys

# Agregar el directorio raíz al path para imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.db import get_db_connection


def migrate_sla_configuracion(cur):
    """Migra la tabla sla_configuracion al schema completo."""
    print("Migrando tabla sla_configuracion...")

    # Verificar columnas existentes
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'sla_configuracion'
    """)
    existing_columns = {row['column_name'] for row in cur.fetchall()}

    # Columnas requeridas que podrían faltar
    columns_to_add = {
        'nombre': "ALTER TABLE sla_configuracion ADD COLUMN IF NOT EXISTS nombre TEXT",
        'descripcion': "ALTER TABLE sla_configuracion ADD COLUMN IF NOT EXISTS descripcion TEXT",
        'estado_desde': "ALTER TABLE sla_configuracion ADD COLUMN IF NOT EXISTS estado_desde TEXT",
        'estado_hasta': "ALTER TABLE sla_configuracion ADD COLUMN IF NOT EXISTS estado_hasta TEXT",
        'tiempo_objetivo_horas': "ALTER TABLE sla_configuracion ADD COLUMN IF NOT EXISTS tiempo_objetivo_horas INTEGER",
        'tiempo_alerta_horas': "ALTER TABLE sla_configuracion ADD COLUMN IF NOT EXISTS tiempo_alerta_horas INTEGER",
        'notificar_al_vencer': "ALTER TABLE sla_configuracion ADD COLUMN IF NOT EXISTS notificar_al_vencer BOOLEAN DEFAULT TRUE",
        'escalar_al_vencer': "ALTER TABLE sla_configuracion ADD COLUMN IF NOT EXISTS escalar_al_vencer BOOLEAN DEFAULT FALSE",
        'escalar_a_rol': "ALTER TABLE sla_configuracion ADD COLUMN IF NOT EXISTS escalar_a_rol TEXT",
        'updated_at': "ALTER TABLE sla_configuracion ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        'created_by': "ALTER TABLE sla_configuracion ADD COLUMN IF NOT EXISTS created_by TEXT",
    }

    for col, sql in columns_to_add.items():
        if col not in existing_columns:
            print(f"  Agregando columna: {col}")
            cur.execute(sql)

    # Renombrar columnas si existen con nombres diferentes
    if 'tipo_solicitud' in existing_columns and 'estado_desde' not in existing_columns:
        print("  Renombrando tipo_solicitud -> estado_desde")
        cur.execute("ALTER TABLE sla_configuracion RENAME COLUMN tipo_solicitud TO estado_desde")

    if 'tiempo_limite_horas' in existing_columns and 'tiempo_objetivo_horas' not in existing_columns:
        print("  Renombrando tiempo_limite_horas -> tiempo_objetivo_horas")
        cur.execute("ALTER TABLE sla_configuracion RENAME COLUMN tiempo_limite_horas TO tiempo_objetivo_horas")

    # Crear índices
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sla_config_criticidad ON sla_configuracion(criticidad)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sla_config_estados ON sla_configuracion(estado_desde, estado_hasta)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sla_config_activo ON sla_configuracion(activo)")

    print("  Tabla sla_configuracion migrada")


def migrate_sla_alertas(cur):
    """Migra la tabla sla_alertas al schema completo."""
    print("Migrando tabla sla_alertas...")

    # Verificar columnas existentes
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'sla_alertas'
    """)
    existing_columns = {row['column_name'] for row in cur.fetchall()}

    # Columnas requeridas
    columns_to_add = {
        'sla_config_id': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS sla_config_id INTEGER",
        'tipo': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS tipo TEXT",
        'estado': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activa'",
        'fecha_inicio': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS fecha_inicio TEXT",
        'fecha_vencimiento': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS fecha_vencimiento TEXT",
        'fecha_resolucion': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS fecha_resolucion TEXT",
        'tiempo_transcurrido_horas': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS tiempo_transcurrido_horas REAL",
        'tiempo_objetivo_horas': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS tiempo_objetivo_horas INTEGER",
        'porcentaje_cumplimiento': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS porcentaje_cumplimiento REAL",
        'escalado': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS escalado BOOLEAN DEFAULT FALSE",
        'escalado_a': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS escalado_a TEXT",
        'fecha_escalamiento': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS fecha_escalamiento TEXT",
        'resuelto_por': "ALTER TABLE sla_alertas ADD COLUMN IF NOT EXISTS resuelto_por TEXT",
    }

    for col, sql in columns_to_add.items():
        if col not in existing_columns:
            print(f"  Agregando columna: {col}")
            cur.execute(sql)

    # Copiar datos de tipo_alerta a tipo si ambas existen
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'sla_alertas'
    """)
    current_columns = {row['column_name'] for row in cur.fetchall()}

    if 'tipo_alerta' in current_columns and 'tipo' in current_columns:
        print("  Copiando datos de tipo_alerta a tipo")
        cur.execute("UPDATE sla_alertas SET tipo = tipo_alerta WHERE tipo IS NULL")

    if 'resuelta' in existing_columns:
        # Migrar datos de resuelta (boolean) a estado (text)
        print("  Migrando datos de resuelta a estado")
        cur.execute("""
            UPDATE sla_alertas
            SET estado = CASE WHEN resuelta = TRUE THEN 'resuelta' ELSE 'activa' END
            WHERE estado IS NULL
        """)

    # Crear índices
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sla_alertas_solicitud ON sla_alertas(solicitud_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sla_alertas_estado ON sla_alertas(estado)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sla_alertas_tipo ON sla_alertas(tipo)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_sla_alertas_vencimiento ON sla_alertas(fecha_vencimiento)")

    print("  Tabla sla_alertas migrada")


def migrate_solicitudes_sla_columns(cur):
    """Agrega columnas SLA a la tabla solicitudes."""
    print("Agregando columnas SLA a solicitudes...")

    columns_to_add = [
        ("sla_fecha_limite", "TEXT"),
        ("sla_estado", "TEXT DEFAULT 'on_time'"),
        ("sla_tiempo_respuesta_horas", "REAL"),
    ]

    for col_name, col_type in columns_to_add:
        try:
            cur.execute(f"ALTER TABLE solicitudes ADD COLUMN {col_name} {col_type}")
            print(f"  Agregada columna: {col_name}")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print(f"  Columna {col_name} ya existe")
            else:
                raise

    print("  Columnas SLA agregadas a solicitudes")


def insert_default_config(cur):
    """Inserta configuración SLA por defecto si la tabla está vacía."""
    print("Verificando configuración SLA por defecto...")

    cur.execute("SELECT COUNT(*) as count FROM sla_configuracion WHERE nombre IS NOT NULL")
    result = cur.fetchone()
    count = result['count'] if isinstance(result, dict) else result[0]

    if count > 0:
        print(f"  Ya existen {count} configuraciones con nombre, omitiendo inserción")
        return

    print("  Insertando configuración SLA por defecto...")

    configs = [
        # SLA: Aprobación de solicitudes
        ('Aprobacion Urgente', 'Solicitudes urgentes deben aprobarse en 4 horas', 'Urgente', 'submitted', 'approved', 4, 2, True, False, None),
        ('Aprobacion Alta', 'Solicitudes alta prioridad en 8 horas', 'Alta', 'submitted', 'approved', 8, 4, True, False, None),
        ('Aprobacion Normal', 'Solicitudes normales en 24 horas', 'Normal', 'submitted', 'approved', 24, 12, True, False, None),
        ('Aprobacion Baja', 'Solicitudes baja prioridad en 48 horas', 'Baja', 'submitted', 'approved', 48, 24, True, False, None),

        # SLA: Planificación de solicitudes aprobadas
        ('Planificacion Urgente', 'Urgentes deben planificarse en 2 horas', 'Urgente', 'approved', 'in_treatment', 2, 1, True, False, None),
        ('Planificacion Alta', 'Alta prioridad en 4 horas', 'Alta', 'approved', 'in_treatment', 4, 2, True, False, None),
        ('Planificacion Normal', 'Normal en 8 horas', 'Normal', 'approved', 'in_treatment', 8, 4, True, False, None),
        ('Planificacion Baja', 'Baja prioridad en 24 horas', 'Baja', 'approved', 'in_treatment', 24, 12, True, False, None),

        # SLA: Tratamiento completo
        ('Tratamiento Urgente', 'Tratamiento urgente en 8 horas', 'Urgente', 'in_treatment', 'treated', 8, 4, True, True, 'jefe'),
        ('Tratamiento Alta', 'Tratamiento alta en 16 horas', 'Alta', 'in_treatment', 'treated', 16, 8, True, True, 'jefe'),
        ('Tratamiento Normal', 'Tratamiento normal en 48 horas', 'Normal', 'in_treatment', 'treated', 48, 24, True, False, None),
        ('Tratamiento Baja', 'Tratamiento baja en 72 horas', 'Baja', 'in_treatment', 'treated', 72, 48, True, False, None),

        # SLA: Tiempo total de ciclo
        ('Ciclo Total Urgente', 'Ciclo completo urgente en 24 horas', 'Urgente', 'submitted', 'completed', 24, 12, True, True, 'gerente'),
        ('Ciclo Total Alta', 'Ciclo completo alta en 48 horas', 'Alta', 'submitted', 'completed', 48, 24, True, True, 'gerente'),
        ('Ciclo Total Normal', 'Ciclo completo normal en 120 horas (5 dias)', 'Normal', 'submitted', 'completed', 120, 72, True, False, None),
        ('Ciclo Total Baja', 'Ciclo completo baja en 240 horas (10 dias)', 'Baja', 'submitted', 'completed', 240, 120, True, False, None),
    ]

    for config in configs:
        cur.execute("""
            INSERT INTO sla_configuracion
            (nombre, descripcion, criticidad, estado_desde, estado_hasta,
             tiempo_objetivo_horas, tiempo_alerta_horas, notificar_al_vencer,
             escalar_al_vencer, escalar_a_rol, activo, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, 'sistema')
        """, config)

    print(f"  Insertadas {len(configs)} configuraciones SLA")


def verify_migration(cur):
    """Verifica el estado de la migración."""
    print("\n=== Estado de la Migración SLA ===")

    # Verificar sla_configuracion
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'sla_configuracion'
        ORDER BY ordinal_position
    """)
    columns = [row['column_name'] for row in cur.fetchall()]
    print(f"\nsla_configuracion columnas ({len(columns)}):")
    print(f"  {', '.join(columns)}")

    cur.execute("SELECT COUNT(*) as count FROM sla_configuracion")
    result = cur.fetchone()
    count = result['count'] if isinstance(result, dict) else result[0]
    print(f"  Registros: {count}")

    # Verificar sla_alertas
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'sla_alertas'
        ORDER BY ordinal_position
    """)
    columns = [row['column_name'] for row in cur.fetchall()]
    print(f"\nsla_alertas columnas ({len(columns)}):")
    print(f"  {', '.join(columns)}")

    cur.execute("SELECT COUNT(*) as count FROM sla_alertas")
    result = cur.fetchone()
    count = result['count'] if isinstance(result, dict) else result[0]
    print(f"  Registros: {count}")

    # Verificar columnas SLA en solicitudes
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'solicitudes' AND column_name LIKE 'sla_%%'
        ORDER BY ordinal_position
    """)
    sla_columns = [row['column_name'] for row in cur.fetchall()]
    print(f"\nsolicitudes columnas SLA ({len(sla_columns)}):")
    print(f"  {', '.join(sla_columns) if sla_columns else 'Ninguna'}")


def run_migration():
    """Ejecuta la migración completa."""
    print("=== Migración SLA Schema para PostgreSQL ===\n")

    with get_db_connection() as conn:
        cur = conn.cursor()

        # 1. Migrar sla_configuracion
        migrate_sla_configuracion(cur)

        # 2. Migrar sla_alertas
        migrate_sla_alertas(cur)

        # 3. Agregar columnas a solicitudes
        migrate_solicitudes_sla_columns(cur)

        # 4. Insertar configuración por defecto
        insert_default_config(cur)

        conn.commit()

        # 5. Verificar
        verify_migration(cur)

    print("\n=== Migración SLA completada ===")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Migración SLA Schema para PostgreSQL")
    parser.add_argument("--verify", action="store_true", help="Solo verificar estado sin migrar")
    args = parser.parse_args()

    if args.verify:
        with get_db_connection() as conn:
            cur = conn.cursor()
            verify_migration(cur)
    else:
        run_migration()


if __name__ == "__main__":
    main()
