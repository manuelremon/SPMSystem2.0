#!/usr/bin/env python3
"""
Migra datos desde SQLite (spm.db) a PostgreSQL.
"""

import sqlite3
import os
import sys

# Agregar path del proyecto
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("ERROR: psycopg2 no instalado. Ejecuta: pip install psycopg2-binary")
    sys.exit(1)


# Mapeo de tipos SQLite a PostgreSQL
TYPE_MAP = {
    "INTEGER": "INTEGER",
    "TEXT": "TEXT",
    "REAL": "REAL",
    "BLOB": "BYTEA",
    "BOOLEAN": "BOOLEAN",
    "DATETIME": "TIMESTAMP",
    "DATE": "DATE",
}


def get_sqlite_schema(sqlite_conn, table_name):
    """Obtiene el schema de una tabla SQLite."""
    cur = sqlite_conn.cursor()
    cur.execute(f"PRAGMA table_info({table_name})")
    columns = cur.fetchall()
    return columns  # (cid, name, type, notnull, dflt_value, pk)


def sqlite_to_pg_type(sqlite_type):
    """Convierte tipo SQLite a PostgreSQL."""
    sqlite_type = sqlite_type.upper() if sqlite_type else "TEXT"
    for key, val in TYPE_MAP.items():
        if key in sqlite_type:
            return val
    return "TEXT"


def create_pg_table(pg_conn, table_name, columns):
    """Crea una tabla en PostgreSQL basada en schema SQLite."""
    cur = pg_conn.cursor()

    col_defs = []
    for col in columns:
        cid, name, col_type, notnull, default, pk = col
        pg_type = sqlite_to_pg_type(col_type)

        # Para columnas con AUTOINCREMENT, usar SERIAL
        if pk and "INT" in (col_type or "").upper():
            col_def = f'"{name}" SERIAL PRIMARY KEY'
        elif pk:
            col_def = f'"{name}" {pg_type} PRIMARY KEY'
        else:
            col_def = f'"{name}" {pg_type}'
            if notnull:
                col_def += " NOT NULL"

        col_defs.append(col_def)

    create_sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({", ".join(col_defs)})'

    try:
        cur.execute(create_sql)
        pg_conn.commit()
        return True
    except Exception as e:
        print(f"  ERROR creando {table_name}: {e}")
        pg_conn.rollback()
        return False


def migrate_table(sqlite_conn, pg_conn, table_name):
    """Migra una tabla de SQLite a PostgreSQL."""
    sqlite_cur = sqlite_conn.cursor()
    pg_cur = pg_conn.cursor()

    # Obtener datos
    sqlite_cur.execute(f'SELECT * FROM "{table_name}"')
    rows = sqlite_cur.fetchall()

    if not rows:
        return 0

    # Obtener nombres de columnas
    columns = [desc[0] for desc in sqlite_cur.description]

    # Limpiar tabla destino
    try:
        pg_cur.execute(f'DELETE FROM "{table_name}"')
    except:
        pass

    # Insertar datos
    placeholders = ", ".join(["%s"] * len(columns))
    cols_quoted = ", ".join([f'"{c}"' for c in columns])
    insert_sql = f'INSERT INTO "{table_name}" ({cols_quoted}) VALUES ({placeholders})'

    try:
        for row in rows:
            # Convertir None a NULL y manejar tipos
            row_clean = tuple(None if v == '' else v for v in row)
            pg_cur.execute(insert_sql, row_clean)
        pg_conn.commit()
        return len(rows)
    except Exception as e:
        print(f"  ERROR insertando en {table_name}: {e}")
        pg_conn.rollback()
        return 0


def reset_sequences(pg_conn, table_name):
    """Resetea secuencias de SERIAL para que continuen desde el max ID."""
    cur = pg_conn.cursor()
    try:
        # Buscar columnas SERIAL
        cur.execute(f"""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = %s
            AND column_default LIKE 'nextval%%'
        """, (table_name,))

        for (col_name,) in cur.fetchall():
            cur.execute(f"""
                SELECT setval(pg_get_serial_sequence('"{table_name}"', '{col_name}'),
                       COALESCE((SELECT MAX("{col_name}") FROM "{table_name}"), 1))
            """)
        pg_conn.commit()
    except Exception as e:
        print(f"  WARN: No se pudo resetear secuencia de {table_name}: {e}")
        pg_conn.rollback()


def main():
    # Rutas
    sqlite_path = os.environ.get("SQLITE_PATH", "data/spm.db")
    pg_url = os.environ.get("DATABASE_URL")

    if not pg_url:
        print("ERROR: DATABASE_URL no configurada")
        sys.exit(1)

    print(f"Migrando desde: {sqlite_path}")
    print(f"Hacia PostgreSQL: {pg_url[:50]}...")

    # Conectar
    sqlite_conn = sqlite3.connect(sqlite_path)
    pg_conn = psycopg2.connect(pg_url)

    # Obtener tablas (excluir sqlite_sequence)
    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name")
    tables = [r[0] for r in sqlite_cur.fetchall()]

    print(f"\nTablas a migrar: {len(tables)}")

    total_rows = 0
    for table in tables:
        # Obtener schema
        columns = get_sqlite_schema(sqlite_conn, table)

        # Crear tabla en PG
        if create_pg_table(pg_conn, table, columns):
            # Migrar datos
            rows = migrate_table(sqlite_conn, pg_conn, table)
            total_rows += rows

            # Resetear secuencias
            reset_sequences(pg_conn, table)

            print(f"  {table}: {rows} registros migrados")
        else:
            print(f"  {table}: SALTADA (error al crear)")

    print(f"\nMigracion completada: {total_rows} registros en {len(tables)} tablas")

    sqlite_conn.close()
    pg_conn.close()


if __name__ == "__main__":
    main()
