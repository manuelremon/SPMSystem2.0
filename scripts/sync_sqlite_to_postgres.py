#!/usr/bin/env python3
"""
Sincroniza datos desde SQLite local a PostgreSQL producción.

Estrategia:
- USUARIOS: UPSERT completo desde SQLite (reemplazar datos)
- CATÁLOGOS: MERGE (insertar nuevos, actualizar existentes, NO eliminar extras)
- REGLAS/SOLICITUDES/PRESUPUESTOS: NO TOCAR (producción tiene más datos)

Uso:
    python scripts/sync_sqlite_to_postgres.py

Requiere:
    - Acceso SSH al servidor de producción
    - Variable DATABASE_URL configurada en el servidor
"""

import sqlite3
import subprocess
import json
import sys
from pathlib import Path

# Configuración
SQLITE_PATH = Path(__file__).parent.parent / "data" / "spm.db"
SSH_HOST = "ubuntu@<SERVER_IP>"
SSH_KEY = Path.home() / ".ssh" / "oracle_vps.key"

# Tablas a sincronizar
TABLAS_UPSERT = ["usuarios"]  # Reemplazo completo por primary key
TABLAS_MERGE = [
    "catalog_centros",
    "catalog_sectores",
    "catalog_almacenes",
    "catalog_puestos",
    "catalog_roles",
]


def get_sqlite_data(table: str) -> list[dict]:
    """Lee datos de una tabla SQLite local."""
    conn = sqlite3.connect(str(SQLITE_PATH))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(f"SELECT * FROM {table}")
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows


def get_table_columns(table: str) -> list[str]:
    """Obtiene las columnas de una tabla SQLite."""
    conn = sqlite3.connect(str(SQLITE_PATH))
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cur.fetchall()]
    conn.close()
    return columns


def execute_postgres_sql(sql: str, params: list = None) -> str:
    """Ejecuta SQL en PostgreSQL producción via SSH."""
    # Escapar comillas simples en SQL
    escaped_sql = sql.replace("'", "''") if params is None else sql

    python_code = f'''
import sys
sys.path.insert(0, "/app")
from backend.core.db import get_db_connection

sql = """{sql}"""
params = {params}

try:
    with get_db_connection() as conn:
        cur = conn.cursor()
        if params:
            cur.execute(sql, tuple(params))
        else:
            cur.execute(sql)
        conn.commit()
        if cur.description:
            rows = cur.fetchall()
            for r in rows:
                print(dict(r) if isinstance(r, dict) else r)
        print(f"Affected rows: {{cur.rowcount}}")
except Exception as e:
    print(f"ERROR: {{e}}")
    sys.exit(1)
'''

    cmd = [
        "ssh", "-i", str(SSH_KEY), SSH_HOST,
        f"docker exec spm-backend python3 -c '{python_code}'"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return None
    return result.stdout


def sync_usuarios():
    """Sincroniza tabla usuarios con UPSERT."""
    print("\n=== Sincronizando USUARIOS ===")

    rows = get_sqlite_data("usuarios")
    print(f"Encontrados {len(rows)} usuarios en SQLite local")

    for row in rows:
        # Construir UPSERT para PostgreSQL
        columns = list(row.keys())
        values = list(row.values())

        # Escapar valores string
        escaped_values = []
        for v in values:
            if v is None:
                escaped_values.append("NULL")
            elif isinstance(v, str):
                escaped_values.append(f"'{v.replace(chr(39), chr(39)+chr(39))}'")
            else:
                escaped_values.append(str(v))

        cols_str = ", ".join(columns)
        vals_str = ", ".join(escaped_values)

        # UPDATE clause para conflicto
        update_pairs = [f"{col} = EXCLUDED.{col}" for col in columns if col != "id_spm"]
        update_str = ", ".join(update_pairs)

        sql = f"""
INSERT INTO usuarios ({cols_str})
VALUES ({vals_str})
ON CONFLICT (id_spm) DO UPDATE SET {update_str};
"""

        print(f"  Sincronizando usuario {row.get('id_spm')}: {row.get('nombre')} {row.get('apellido')}")

        # Ejecutar via SSH
        python_code = f'''
import sys
sys.path.insert(0, "/app")
from backend.core.db import get_db_connection

sql = """{sql}"""

try:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()
        print(f"OK: {{cur.rowcount}} row(s)")
except Exception as e:
    print(f"ERROR: {{e}}")
'''

        cmd = [
            "ssh", "-i", str(SSH_KEY), SSH_HOST,
            f"docker exec spm-backend python3 -c '{python_code}'"
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"    Error: {result.stderr}")
        else:
            print(f"    {result.stdout.strip()}")


def sync_catalog(table: str, pk_column: str = None):
    """Sincroniza tabla de catálogo con MERGE (no elimina extras)."""
    print(f"\n=== Sincronizando {table.upper()} ===")

    rows = get_sqlite_data(table)
    columns = get_table_columns(table)

    # Determinar primary key (primer columna por defecto)
    if pk_column is None:
        pk_column = columns[0]

    print(f"Encontrados {len(rows)} registros en SQLite local")

    for row in rows:
        # Escapar valores
        escaped_values = []
        for col in columns:
            v = row.get(col)
            if v is None:
                escaped_values.append("NULL")
            elif isinstance(v, str):
                escaped_values.append(f"'{v.replace(chr(39), chr(39)+chr(39))}'")
            else:
                escaped_values.append(str(v))

        cols_str = ", ".join(columns)
        vals_str = ", ".join(escaped_values)

        # UPDATE clause
        update_pairs = [f"{col} = EXCLUDED.{col}" for col in columns if col != pk_column]
        update_str = ", ".join(update_pairs) if update_pairs else f"{pk_column} = EXCLUDED.{pk_column}"

        sql = f"""
INSERT INTO {table} ({cols_str})
VALUES ({vals_str})
ON CONFLICT ({pk_column}) DO UPDATE SET {update_str};
"""

        pk_value = row.get(pk_column)
        print(f"  Sincronizando {pk_column}={pk_value}")

        python_code = f'''
import sys
sys.path.insert(0, "/app")
from backend.core.db import get_db_connection

sql = """{sql}"""

try:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()
        print(f"OK")
except Exception as e:
    print(f"ERROR: {{e}}")
'''

        cmd = [
            "ssh", "-i", str(SSH_KEY), SSH_HOST,
            f"docker exec spm-backend python3 -c '{python_code}'"
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"    Error: {result.stderr}")
        else:
            output = result.stdout.strip()
            if output:
                print(f"    {output}")


def verify_sync():
    """Verifica que la sincronización fue exitosa."""
    print("\n=== VERIFICACIÓN ===")

    python_code = '''
import sys
sys.path.insert(0, "/app")
from backend.core.db import get_db_connection

with get_db_connection() as conn:
    cur = conn.cursor()

    # Verificar usuarios
    cur.execute("SELECT id_spm, nombre, apellido, rol FROM usuarios ORDER BY id_spm")
    rows = cur.fetchall()
    print("USUARIOS en PostgreSQL:")
    for r in rows:
        print(f"  {r['id_spm']} | {r['nombre']} {r['apellido']} | {r['rol']}")
'''

    cmd = [
        "ssh", "-i", str(SSH_KEY), SSH_HOST,
        f"docker exec spm-backend python3 -c '{python_code}'"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(f"Warnings: {result.stderr}")


def main():
    print("=" * 60)
    print("SINCRONIZACIÓN SQLite Local → PostgreSQL Producción")
    print("=" * 60)

    # Verificar que SQLite existe
    if not SQLITE_PATH.exists():
        print(f"Error: No se encuentra {SQLITE_PATH}")
        sys.exit(1)

    print(f"SQLite: {SQLITE_PATH}")
    print(f"Destino: {SSH_HOST}")

    # Sincronizar usuarios
    sync_usuarios()

    # Sincronizar catálogos
    catalog_pks = {
        "catalog_centros": "codigo",
        "catalog_sectores": "nombre",
        "catalog_almacenes": "codigo",
        "catalog_puestos": "nombre",
        "catalog_roles": "nombre",
    }

    for table in TABLAS_MERGE:
        pk = catalog_pks.get(table)
        sync_catalog(table, pk)

    # Verificar
    verify_sync()

    print("\n" + "=" * 60)
    print("SINCRONIZACIÓN COMPLETADA")
    print("=" * 60)


if __name__ == "__main__":
    main()
