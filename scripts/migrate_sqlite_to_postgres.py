#!/usr/bin/env python3
"""
SPM v2.0 - Script de Migracion SQLite a PostgreSQL

Migra datos de spm.db (SQLite) a PostgreSQL en produccion.

Uso:
    python migrate_sqlite_to_postgres.py --sqlite data/spm.db --postgres postgresql://user:pass@host:5432/db

Opciones:
    --sqlite    Ruta al archivo SQLite (default: data/spm.db)
    --postgres  URL de conexion PostgreSQL
    --schema    Ruta al schema SQL (default: backend/core/schema.sql)
    --dry-run   Solo mostrar lo que se haria, sin ejecutar
"""

import argparse
import sqlite3
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import execute_batch
except ImportError:
    print("Error: psycopg2-binary no instalado")
    print("Ejecuta: pip install psycopg2-binary")
    sys.exit(1)


# Tablas a migrar en orden (respeta foreign keys)
TABLES_TO_MIGRATE = [
    'usuarios',
    'solicitudes',
    'items_solicitud',
    'mensajes',
    'notificaciones',
    'audit_log',
    'push_subscriptions',
    'approval_delegations',
    'budget_ledger',
]


def get_sqlite_tables(sqlite_conn):
    """Obtiene lista de tablas en SQLite"""
    cursor = sqlite_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    return [row[0] for row in cursor.fetchall()]


def get_table_columns(sqlite_conn, table_name):
    """Obtiene columnas de una tabla SQLite"""
    cursor = sqlite_conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]


def create_postgres_schema(pg_conn, schema_path):
    """Crea el schema en PostgreSQL desde archivo SQL"""
    print(f"Creando schema desde: {schema_path}")

    schema_sql = Path(schema_path).read_text(encoding='utf-8')

    # Convertir sintaxis SQLite a PostgreSQL
    schema_sql = convert_sqlite_to_postgres_schema(schema_sql)

    cursor = pg_conn.cursor()
    try:
        cursor.execute(schema_sql)
        pg_conn.commit()
        print("Schema creado correctamente")
    except Exception as e:
        pg_conn.rollback()
        print(f"Error creando schema: {e}")
        raise


def convert_sqlite_to_postgres_schema(sql):
    """Convierte sintaxis SQLite a PostgreSQL"""
    conversions = [
        # AUTOINCREMENT -> SERIAL
        ('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY'),
        ('INTEGER PRIMARY KEY', 'SERIAL PRIMARY KEY'),
        # DATETIME -> TIMESTAMP
        ('DATETIME', 'TIMESTAMP'),
        # Boolean handling
        ('BOOLEAN DEFAULT 0', 'BOOLEAN DEFAULT FALSE'),
        ('BOOLEAN DEFAULT 1', 'BOOLEAN DEFAULT TRUE'),
        # Text handling (ya compatible)
    ]

    for sqlite_syntax, pg_syntax in conversions:
        sql = sql.replace(sqlite_syntax, pg_syntax)

    return sql


def migrate_table(sqlite_conn, pg_conn, table_name, dry_run=False):
    """Migra una tabla de SQLite a PostgreSQL"""
    sqlite_cursor = sqlite_conn.cursor()

    # Obtener datos
    sqlite_cursor.execute(f"SELECT * FROM {table_name}")
    rows = sqlite_cursor.fetchall()

    if not rows:
        print(f"  {table_name}: 0 registros (tabla vacia)")
        return 0

    # Obtener columnas
    columns = get_table_columns(sqlite_conn, table_name)

    if dry_run:
        print(f"  {table_name}: {len(rows)} registros (dry-run)")
        return len(rows)

    # Preparar INSERT
    placeholders = ','.join(['%s'] * len(columns))
    columns_str = ','.join(columns)

    insert_sql = f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})"

    # Insertar en PostgreSQL
    pg_cursor = pg_conn.cursor()
    try:
        # Desactivar triggers temporalmente para performance
        pg_cursor.execute(f"ALTER TABLE {table_name} DISABLE TRIGGER ALL")

        execute_batch(pg_cursor, insert_sql, rows, page_size=1000)

        # Reactivar triggers
        pg_cursor.execute(f"ALTER TABLE {table_name} ENABLE TRIGGER ALL")

        # Actualizar secuencias (para columnas SERIAL)
        if 'id' in columns:
            pg_cursor.execute(f"""
                SELECT setval(pg_get_serial_sequence('{table_name}', 'id'),
                       COALESCE((SELECT MAX(id) FROM {table_name}), 1))
            """)

        pg_conn.commit()
        print(f"  {table_name}: {len(rows)} registros migrados")
        return len(rows)

    except Exception as e:
        pg_conn.rollback()
        print(f"  {table_name}: ERROR - {e}")
        raise


def main():
    parser = argparse.ArgumentParser(description='Migrar SPM de SQLite a PostgreSQL')
    parser.add_argument('--sqlite', default='data/spm.db',
                        help='Ruta al archivo SQLite')
    parser.add_argument('--postgres', required=True,
                        help='URL de conexion PostgreSQL')
    parser.add_argument('--schema', default='backend/core/schema.sql',
                        help='Ruta al archivo schema.sql')
    parser.add_argument('--dry-run', action='store_true',
                        help='Solo mostrar lo que se haria')
    parser.add_argument('--skip-schema', action='store_true',
                        help='No crear schema (asume que ya existe)')

    args = parser.parse_args()

    print("=" * 60)
    print("SPM v2.0 - Migracion SQLite a PostgreSQL")
    print("=" * 60)

    if args.dry_run:
        print("MODO: Dry-run (no se ejecutaran cambios)")

    print(f"SQLite: {args.sqlite}")
    print(f"PostgreSQL: {args.postgres[:50]}...")
    print("")

    # Verificar archivos
    if not Path(args.sqlite).exists():
        print(f"Error: No se encuentra {args.sqlite}")
        sys.exit(1)

    # Conectar a SQLite
    print("Conectando a SQLite...")
    sqlite_conn = sqlite3.connect(args.sqlite)
    sqlite_conn.row_factory = sqlite3.Row

    # Conectar a PostgreSQL
    print("Conectando a PostgreSQL...")
    try:
        pg_conn = psycopg2.connect(args.postgres)
    except Exception as e:
        print(f"Error conectando a PostgreSQL: {e}")
        sys.exit(1)

    # Obtener tablas disponibles en SQLite
    available_tables = get_sqlite_tables(sqlite_conn)
    print(f"Tablas en SQLite: {', '.join(available_tables)}")
    print("")

    # Crear schema si no existe
    if not args.skip_schema and not args.dry_run:
        if Path(args.schema).exists():
            create_postgres_schema(pg_conn, args.schema)
        else:
            print(f"Advertencia: Schema no encontrado en {args.schema}")
            print("Asumiendo que las tablas ya existen en PostgreSQL")

    # Migrar tablas
    print("")
    print("Migrando tablas:")
    total_rows = 0

    for table in TABLES_TO_MIGRATE:
        if table in available_tables:
            total_rows += migrate_table(sqlite_conn, pg_conn, table, args.dry_run)
        else:
            print(f"  {table}: SKIP (no existe en SQLite)")

    # Cerrar conexiones
    sqlite_conn.close()
    pg_conn.close()

    print("")
    print("=" * 60)
    print(f"Migracion completada: {total_rows} registros totales")
    print("=" * 60)

    if args.dry_run:
        print("")
        print("Este fue un dry-run. Ejecuta sin --dry-run para migrar.")


if __name__ == '__main__':
    main()
