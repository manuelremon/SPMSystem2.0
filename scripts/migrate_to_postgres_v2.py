#!/usr/bin/env python3
"""
Migra datos desde SQLite (spm.db) a PostgreSQL - Version mejorada.
Maneja: booleanos, claves compuestas, NULLs.
"""

import sqlite3
import os
import sys

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 no instalado")
    sys.exit(1)


def get_sqlite_tables(conn):
    """Obtiene lista de tablas."""
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name")
    return [r[0] for r in cur.fetchall()]


def get_table_info(conn, table):
    """Obtiene info de columnas."""
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    return cur.fetchall()


def migrate_table_data(sqlite_conn, pg_conn, table_name, bool_columns=None):
    """Migra datos de una tabla."""
    if bool_columns is None:
        bool_columns = []

    sqlite_cur = sqlite_conn.cursor()
    pg_cur = pg_conn.cursor()

    # Verificar si tabla existe en PG
    pg_cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = %s ORDER BY ordinal_position
    """, (table_name,))
    pg_columns = [r[0] for r in pg_cur.fetchall()]

    if not pg_columns:
        return 0, f"tabla no existe en PG"

    # Obtener datos de SQLite
    sqlite_cur.execute(f'SELECT * FROM "{table_name}"')
    rows = sqlite_cur.fetchall()
    if not rows:
        return 0, "sin datos"

    # Columnas SQLite
    sqlite_columns = [desc[0] for desc in sqlite_cur.description]

    # Solo migrar columnas que existen en ambas
    common_columns = [c for c in sqlite_columns if c in pg_columns]
    if not common_columns:
        return 0, "sin columnas comunes"

    # Indices de columnas a migrar
    col_indices = [sqlite_columns.index(c) for c in common_columns]

    # Limpiar tabla
    try:
        pg_cur.execute(f'DELETE FROM "{table_name}"')
    except Exception as e:
        pg_conn.rollback()
        return 0, f"error limpiando: {e}"

    # Preparar INSERT
    placeholders = ", ".join(["%s"] * len(common_columns))
    cols_str = ", ".join([f'"{c}"' for c in common_columns])
    insert_sql = f'INSERT INTO "{table_name}" ({cols_str}) VALUES ({placeholders})'

    inserted = 0
    errors = []
    for row in rows:
        # Extraer solo columnas comunes
        values = []
        for i, col in zip(col_indices, common_columns):
            val = row[i]
            # Convertir booleanos
            if col in bool_columns:
                if val == 1 or val == "1" or val == True:
                    val = True
                elif val == 0 or val == "0" or val == False:
                    val = False
                else:
                    val = None
            # Convertir strings vacíos a None
            if val == "":
                val = None
            values.append(val)

        try:
            pg_cur.execute(insert_sql, tuple(values))
            inserted += 1
        except Exception as e:
            errors.append(str(e)[:100])
            pg_conn.rollback()
            # Continuar con siguiente fila
            continue

    try:
        pg_conn.commit()
    except:
        pg_conn.rollback()

    if errors:
        return inserted, f"{len(errors)} errores"
    return inserted, "OK"


def reset_sequence(pg_conn, table_name):
    """Resetea secuencias SERIAL."""
    cur = pg_conn.cursor()
    try:
        cur.execute(f"""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = %s AND column_default LIKE 'nextval%%'
        """, (table_name,))
        for (col,) in cur.fetchall():
            cur.execute(f"""
                SELECT setval(pg_get_serial_sequence('{table_name}', '{col}'),
                       COALESCE((SELECT MAX("{col}") FROM "{table_name}"), 1))
            """)
        pg_conn.commit()
    except:
        pg_conn.rollback()


def main():
    sqlite_path = os.environ.get("SQLITE_PATH", "/tmp/spm.db")
    pg_url = os.environ.get("DATABASE_URL")

    if not pg_url:
        print("ERROR: DATABASE_URL no configurada")
        sys.exit(1)

    print(f"Migrando: {sqlite_path} -> PostgreSQL")

    sqlite_conn = sqlite3.connect(sqlite_path)
    pg_conn = psycopg2.connect(pg_url)

    # Columnas booleanas conocidas
    bool_cols = {
        "activo", "es_principal", "leido", "notnull", "pk",
        "libre_disponibilidad", "is_active", "enabled", "visible"
    }

    tables = get_sqlite_tables(sqlite_conn)
    print(f"Tablas: {len(tables)}\n")

    total = 0
    for table in tables:
        count, status = migrate_table_data(sqlite_conn, pg_conn, table, bool_cols)
        total += count
        reset_sequence(pg_conn, table)
        print(f"  {table}: {count} ({status})")

    print(f"\nTotal: {total} registros migrados")

    # Verificar usuarios
    pg_cur = pg_conn.cursor()
    pg_cur.execute("SELECT COUNT(*) FROM usuarios")
    users = pg_cur.fetchone()[0]
    print(f"Usuarios en PostgreSQL: {users}")

    sqlite_conn.close()
    pg_conn.close()


if __name__ == "__main__":
    main()
