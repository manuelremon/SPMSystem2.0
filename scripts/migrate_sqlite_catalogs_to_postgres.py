#!/usr/bin/env python3
"""
Script de Migración: SQLite Catálogos → PostgreSQL

Migra los datos de las 3 bases de datos SQLite secundarias a PostgreSQL:
- catalogo_materiales.db → cat_materiales
- sap_data.db → sap_stock, sap_pedidos, sap_materiales_bbdd, sap_consumo_historico
- equivalentes.db → cat_equivalencias

Uso:
    # Desde el directorio del proyecto:
    DATABASE_URL="postgresql://user:pass@host:5432/db" python scripts/migrate_sqlite_catalogs_to_postgres.py

    # O en producción:
    ssh -i ~/.ssh/oracle_vps.key ubuntu@<SERVER_IP> "docker exec spm-backend python scripts/migrate_sqlite_catalogs_to_postgres.py"

Fecha: 2025-12-24
"""

import logging
import os
import sqlite3
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Rutas de las bases de datos SQLite
BASE_DIR = Path(__file__).parent.parent
# En Docker, los archivos están en /app/data
# En desarrollo, están en proyecto/data
DATA_DIR = Path("/app/data") if Path("/app/data").exists() else BASE_DIR / "data"

SQLITE_DBS = {
    "catalogo_materiales": DATA_DIR / "catalogo_materiales.db",
    "sap_data": DATA_DIR / "sap_data.db",
    "equivalentes": DATA_DIR / "equivalentes.db",
}

# Mapeo de tablas SQLite → PostgreSQL
TABLE_MAPPINGS = {
    # catalogo_materiales.db
    "catalogo_materiales": {
        "materiales": {
            "pg_table": "cat_materiales",
            "columns": [
                "codigo",
                "descripcion",
                "descripcion_larga",
                "grupo_articulos",
                "unidad_medida",
                "precio_usd",
                "activo",
                "created_at",
            ],
        }
    },
    # sap_data.db
    "sap_data": {
        "stock": {
            "pg_table": "sap_stock",
            "columns": [
                "dia",
                "acreedor",
                "acreedor_descripcion",
                "regional",
                "centro",
                "centro_descripcion",
                "ypf/ute_desc",  # Renombrado a ypf_ute_desc en PG
                "almacen",
                "grupo_de_articulos",
                "gpo_articulos_descripcion",
                "material",
                "material_descripcion",
                "cat_valoracion",
                "elemento_pep",
                "lote",
                "stock",
                "um",
                "precio",
                "stock_valorizado",
                "moneda",
                "ubicacion",
                "planificacion_categorias",
                "sub_categorias",
                "inmovilizado",
                "critico",
                "prevision_por_obsolescencia",
            ],
            "pg_columns": [
                "dia",
                "acreedor",
                "acreedor_descripcion",
                "regional",
                "centro",
                "centro_descripcion",
                "ypf_ute_desc",
                "almacen",
                "grupo_de_articulos",
                "gpo_articulos_descripcion",
                "material",
                "material_descripcion",
                "cat_valoracion",
                "elemento_pep",
                "lote",
                "stock",
                "um",
                "precio",
                "stock_valorizado",
                "moneda",
                "ubicacion",
                "planificacion_categorias",
                "sub_categorias",
                "inmovilizado",
                "critico",
                "prevision_por_obsolescencia",
            ],
        },
        "pedidos_sap": {
            "pg_table": "sap_pedidos",
            "columns": [
                "centro",
                "almacen",
                "pedido",
                "posicion_pedido",
                "material",
                "descripcion",
                "ctdpedida",
                "ctdentregada",
                "saldo_pend",
                "um",
                "fecdocum",
                "fecentre",
                "cls",
                "solicitante",
                "nombre_1",
            ],
        },
        "materiales_bbdd": {
            "pg_table": "sap_materiales_bbdd",
            "columns": [
                "sector",
                "almacen",
                "centro",
                "codigo_material",
                "descripcion",
                "stock_de_seguridad",
                "punto_de_pedido",
                "stock_maximo",
            ],
        },
        "consumo_historico": {
            "pg_table": "sap_consumo_historico",
            "columns": [
                "fecha",
                "centro",
                "almacen",
                "cantidad",
                "material",
                "descripcion",
            ],
        },
    },
    # equivalentes.db
    "equivalentes": {
        "equivalencias": {
            "pg_table": "cat_equivalencias",
            "columns": [
                "material_base",
                "texto_breve_base",
                "material_equivalente",
                "texto_breve_equivalente",
                "tipo_equiv",
                "criterio",
                "motivo_equivalencia",
            ],
        }
    },
}


def get_sqlite_connection(db_name: str):
    """Obtiene conexión a base de datos SQLite."""
    db_path = SQLITE_DBS.get(db_name)
    if not db_path or not db_path.exists():
        raise FileNotFoundError(f"Base de datos SQLite no encontrada: {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def get_postgres_connection():
    """Obtiene conexión a PostgreSQL."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL no está configurado")

    return psycopg2.connect(database_url)


def migrate_table(
    sqlite_conn,
    pg_conn,
    sqlite_table: str,
    pg_table: str,
    columns: list,
    pg_columns: list = None,
    batch_size: int = 5000,
):
    """
    Migra una tabla de SQLite a PostgreSQL.

    Args:
        sqlite_conn: Conexión SQLite
        pg_conn: Conexión PostgreSQL
        sqlite_table: Nombre de la tabla en SQLite
        pg_table: Nombre de la tabla en PostgreSQL
        columns: Lista de columnas en SQLite
        pg_columns: Lista de columnas en PostgreSQL (si difieren)
        batch_size: Tamaño del batch para inserción
    """
    pg_columns = pg_columns or columns

    logger.info(f"Migrando {sqlite_table} → {pg_table}...")

    # Leer datos de SQLite
    sqlite_cursor = sqlite_conn.cursor()
    columns_sql = ", ".join([f'"{c}"' for c in columns])
    sqlite_cursor.execute(f"SELECT {columns_sql} FROM {sqlite_table}")

    rows = sqlite_cursor.fetchall()
    total = len(rows)
    logger.info(f"  Leídos {total:,} registros de SQLite")

    if total == 0:
        logger.warning(f"  Tabla {sqlite_table} está vacía")
        return 0

    # Limpiar tabla PostgreSQL antes de insertar
    pg_cursor = pg_conn.cursor()
    pg_cursor.execute(f"TRUNCATE TABLE {pg_table} RESTART IDENTITY CASCADE")
    logger.info(f"  Tabla {pg_table} truncada")

    # Insertar en PostgreSQL por batches
    pg_columns_sql = ", ".join(pg_columns)
    inserted = 0

    for i in range(0, total, batch_size):
        batch = rows[i : i + batch_size]
        values = [tuple(row) for row in batch]

        try:
            execute_values(
                pg_cursor,
                f"INSERT INTO {pg_table} ({pg_columns_sql}) VALUES %s",
                values,
                page_size=batch_size,
            )
            inserted += len(batch)
            logger.info(f"  Insertados {inserted:,}/{total:,} ({100*inserted//total}%)")
        except Exception as e:
            logger.error(f"  Error insertando batch: {e}")
            pg_conn.rollback()
            raise

    pg_conn.commit()
    logger.info(f"  ✓ Migrados {inserted:,} registros a {pg_table}")
    return inserted


def run_migration():
    """Ejecuta la migración completa."""
    logger.info("=" * 60)
    logger.info("MIGRACIÓN: SQLite Catálogos → PostgreSQL")
    logger.info("=" * 60)

    # Verificar que existen las BDs SQLite
    for db_name, db_path in SQLITE_DBS.items():
        if not db_path.exists():
            logger.error(f"BD SQLite no encontrada: {db_path}")
            sys.exit(1)
        logger.info(f"✓ {db_name}: {db_path}")

    # Conectar a PostgreSQL
    try:
        pg_conn = get_postgres_connection()
        logger.info("✓ Conectado a PostgreSQL")
    except Exception as e:
        logger.error(f"Error conectando a PostgreSQL: {e}")
        sys.exit(1)

    # Estadísticas
    stats = {}

    # Migrar cada base de datos
    for db_name, tables in TABLE_MAPPINGS.items():
        logger.info(f"\n--- Procesando {db_name}.db ---")

        try:
            sqlite_conn = get_sqlite_connection(db_name)
        except FileNotFoundError as e:
            logger.error(str(e))
            continue

        for sqlite_table, config in tables.items():
            pg_table = config["pg_table"]
            columns = config["columns"]
            pg_columns = config.get("pg_columns", columns)

            try:
                count = migrate_table(
                    sqlite_conn=sqlite_conn,
                    pg_conn=pg_conn,
                    sqlite_table=sqlite_table,
                    pg_table=pg_table,
                    columns=columns,
                    pg_columns=pg_columns,
                )
                stats[pg_table] = count
            except Exception as e:
                logger.error(f"Error migrando {sqlite_table}: {e}")
                stats[pg_table] = f"ERROR: {e}"

        sqlite_conn.close()

    pg_conn.close()

    # Resumen
    logger.info("\n" + "=" * 60)
    logger.info("RESUMEN DE MIGRACIÓN")
    logger.info("=" * 60)
    for table, count in stats.items():
        if isinstance(count, int):
            logger.info(f"  {table}: {count:,} registros")
        else:
            logger.error(f"  {table}: {count}")

    total_registros = sum(c for c in stats.values() if isinstance(c, int))
    logger.info(f"\nTotal migrados: {total_registros:,} registros")
    logger.info("=" * 60)


def verify_migration():
    """Verifica que la migración se completó correctamente."""
    logger.info("\nVERIFICANDO MIGRACIÓN...")

    pg_conn = get_postgres_connection()
    cursor = pg_conn.cursor()

    expected = {
        "cat_materiales": 44461,
        "sap_stock": 149997,
        "sap_pedidos": 602,
        "sap_materiales_bbdd": 7309,
        "sap_consumo_historico": 20424,
        "cat_equivalencias": 34865,
    }

    all_ok = True
    for table, expected_count in expected.items():
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        actual = cursor.fetchone()[0]
        status = "✓" if actual == expected_count else "✗"
        logger.info(f"  {status} {table}: {actual:,} (esperado: {expected_count:,})")
        if actual != expected_count:
            all_ok = False

    pg_conn.close()

    if all_ok:
        logger.info("\n✓ Migración verificada correctamente")
    else:
        logger.warning("\n⚠ Hay diferencias en los conteos")

    return all_ok


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Migrar catálogos SQLite a PostgreSQL")
    parser.add_argument("--verify", action="store_true", help="Solo verificar, no migrar")
    args = parser.parse_args()

    if args.verify:
        verify_migration()
    else:
        run_migration()
        verify_migration()
