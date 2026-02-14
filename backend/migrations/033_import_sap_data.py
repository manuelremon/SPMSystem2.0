"""
Migración 033: Importar datos SAP de SQLite a PostgreSQL

Este script lee datos de las bases de datos SQLite locales y los importa
a PostgreSQL de producción. Es idempotente (usa ON CONFLICT DO NOTHING).

Tablas importadas:
- sap_data.db → stock → sap_stock (~150K registros)
- sap_data.db → consumo_historico → sap_consumo_historico (~20K registros)
- sap_data.db → pedidos_sap → sap_pedidos (~600 registros)
- sap_data.db → materiales_bbdd → sap_materiales_bbdd (~7K registros)
- master_materiales.db → catalogo_materiales → cat_materiales (~44K registros)
- master_materiales.db → materiales_equivalencias → cat_equivalencias (~180K registros)

Requisitos:
- Migración 020 ejecutada previamente (crea tablas y vistas)
- Acceso a PostgreSQL (DATABASE_URL)
- Archivos SQLite en data/

Uso:
    # Con DATABASE_URL como variable de entorno
    python backend/migrations/033_import_sap_data.py

    # Con DATABASE_URL como argumento
    python backend/migrations/033_import_sap_data.py postgresql://user:pass@host:5432/db

Fecha: 2026-02-14
"""

import logging
import os
import sqlite3
import sys
import time
from pathlib import Path

logger = logging.getLogger(__name__)

# Batch size for inserts
BATCH_SIZE = 5000

# Paths to SQLite databases
BASE_DIR = Path(__file__).resolve().parent.parent.parent
SAP_DATA_DB = BASE_DIR / "data" / "sap_data.db"
MASTER_MATERIALES_DB = BASE_DIR / "data" / "master_materiales.db"


def _get_pg_connection(database_url: str):
    """Create a PostgreSQL connection."""
    import psycopg2

    conn = psycopg2.connect(database_url)
    return conn


def _ensure_tables_exist(pg_conn):
    """Run migration 020 DDL to ensure target tables exist."""
    import importlib.util

    migration_path = Path(__file__).parent / "020_catalogs_to_postgresql.py"
    spec = importlib.util.spec_from_file_location("m020", migration_path)
    m020 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m020)

    cursor = pg_conn.cursor()
    pg_conn.autocommit = True

    for i, ddl in enumerate(m020.DDL_STATEMENTS, 1):
        try:
            cursor.execute(ddl)
        except Exception as e:
            logger.debug(f"DDL {i}: {e}")

    pg_conn.autocommit = False
    logger.info("Target tables verified/created")

    # Create catalogo_materiales view if missing
    try:
        pg_conn.autocommit = True
        cursor.execute("""
            CREATE OR REPLACE VIEW catalogo_materiales AS
            SELECT
                id,
                codigo,
                descripcion,
                descripcion_larga,
                grupo_articulos,
                unidad_medida,
                precio_usd,
                activo,
                created_at
            FROM cat_materiales
        """)
        pg_conn.autocommit = False
        logger.info("View 'catalogo_materiales' created/updated")
    except Exception as e:
        pg_conn.autocommit = False
        logger.warning(f"Could not create catalogo_materiales view: {e}")

    # Create materiales_equivalencias view if missing
    try:
        pg_conn.autocommit = True
        cursor.execute("""
            CREATE OR REPLACE VIEW materiales_equivalencias AS
            SELECT
                id,
                material_base,
                texto_breve_base,
                material_equivalente,
                texto_breve_equivalente,
                tipo_equiv,
                criterio,
                motivo_equivalencia
            FROM cat_equivalencias
        """)
        pg_conn.autocommit = False
        logger.info("View 'materiales_equivalencias' created/updated")
    except Exception as e:
        pg_conn.autocommit = False
        logger.warning(f"Could not create materiales_equivalencias view: {e}")


def _import_table(
    pg_conn,
    sqlite_path: Path,
    sqlite_table: str,
    pg_table: str,
    columns_map: dict,
    conflict_column: str = None,
):
    """
    Import data from a SQLite table to PostgreSQL.

    Args:
        pg_conn: PostgreSQL connection
        sqlite_path: Path to SQLite database
        sqlite_table: Source table name in SQLite
        pg_table: Target table name in PostgreSQL
        columns_map: Dict mapping SQLite column names to PG column names
        conflict_column: Column for ON CONFLICT (None = no conflict handling)
    """
    if not sqlite_path.exists():
        logger.error(f"SQLite database not found: {sqlite_path}")
        return 0

    # Read from SQLite
    sqlite_conn = sqlite3.connect(str(sqlite_path))
    sqlite_conn.row_factory = sqlite3.Row
    cursor_sqlite = sqlite_conn.cursor()

    sqlite_cols = list(columns_map.keys())
    pg_cols = list(columns_map.values())

    try:
        cursor_sqlite.execute(f"SELECT COUNT(*) FROM {sqlite_table}")
        total_rows = cursor_sqlite.fetchone()[0]
        logger.info(f"  Source: {sqlite_table} ({total_rows} rows)")

        cursor_sqlite.execute(f"SELECT {', '.join(f'[{c}]' for c in sqlite_cols)} FROM {sqlite_table}")
    except Exception as e:
        logger.error(f"  Error reading {sqlite_table}: {e}")
        sqlite_conn.close()
        return 0

    # Insert into PostgreSQL in batches
    pg_cursor = pg_conn.cursor()
    placeholders = ", ".join(["%s"] * len(pg_cols))
    cols_str = ", ".join(pg_cols)

    if conflict_column:
        insert_sql = f"INSERT INTO {pg_table} ({cols_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
    else:
        insert_sql = f"INSERT INTO {pg_table} ({cols_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"

    inserted = 0
    batch = []
    start_time = time.time()

    for row in cursor_sqlite:
        values = tuple(row[col] for col in sqlite_cols)
        batch.append(values)

        if len(batch) >= BATCH_SIZE:
            try:
                pg_cursor.executemany(insert_sql, batch)
                pg_conn.commit()
                inserted += len(batch)
                elapsed = time.time() - start_time
                logger.info(f"  Inserted {inserted}/{total_rows} ({elapsed:.1f}s)")
            except Exception as e:
                pg_conn.rollback()
                logger.error(f"  Batch insert error: {e}")
                # Try one by one for this batch
                for vals in batch:
                    try:
                        pg_cursor.execute(insert_sql, vals)
                        pg_conn.commit()
                        inserted += 1
                    except Exception:
                        pg_conn.rollback()
            batch = []

    # Insert remaining
    if batch:
        try:
            pg_cursor.executemany(insert_sql, batch)
            pg_conn.commit()
            inserted += len(batch)
        except Exception as e:
            pg_conn.rollback()
            logger.error(f"  Final batch error: {e}")
            for vals in batch:
                try:
                    pg_cursor.execute(insert_sql, vals)
                    pg_conn.commit()
                    inserted += 1
                except Exception:
                    pg_conn.rollback()

    elapsed = time.time() - start_time
    logger.info(f"  -> {pg_table}: {inserted} rows imported in {elapsed:.1f}s")

    sqlite_conn.close()
    return inserted


def _truncate_table(pg_conn, table_name: str):
    """Truncate a PostgreSQL table (for clean reimport)."""
    try:
        cursor = pg_conn.cursor()
        cursor.execute(f"TRUNCATE TABLE {table_name} RESTART IDENTITY CASCADE")
        pg_conn.commit()
        logger.info(f"  Truncated {table_name}")
    except Exception as e:
        pg_conn.rollback()
        logger.warning(f"  Could not truncate {table_name}: {e}")


def run_migration(database_url: str = None, clean: bool = False):
    """
    Execute the SAP data import migration.

    Args:
        database_url: PostgreSQL connection string
        clean: If True, truncate tables before importing
    """
    if not database_url:
        database_url = os.environ.get("DATABASE_URL")

    if not database_url or not database_url.startswith("postgresql://"):
        logger.error("DATABASE_URL must be a PostgreSQL connection string")
        return False

    logger.info("=" * 60)
    logger.info("Migration 033: Import SAP data to PostgreSQL")
    logger.info("=" * 60)

    try:
        pg_conn = _get_pg_connection(database_url)
    except Exception as e:
        logger.error(f"Could not connect to PostgreSQL: {e}")
        return False

    # Step 1: Ensure tables exist (run migration 020 DDL)
    logger.info("\n[1/7] Ensuring target tables exist...")
    _ensure_tables_exist(pg_conn)

    # Step 2: Optionally truncate
    if clean:
        logger.info("\n[CLEAN] Truncating existing data...")
        for table in [
            "sap_stock",
            "sap_consumo_historico",
            "sap_pedidos",
            "sap_materiales_bbdd",
            "cat_materiales",
            "cat_equivalencias",
        ]:
            _truncate_table(pg_conn, table)

    total_imported = 0

    # Step 3: Import stock (sap_data.db → sap_stock)
    logger.info("\n[2/7] Importing stock...")
    stock_cols = {
        "dia": "dia",
        "acreedor": "acreedor",
        "acreedor_descripcion": "acreedor_descripcion",
        "regional": "regional",
        "centro": "centro",
        "centro_descripcion": "centro_descripcion",
        "ypf/ute_desc": "ypf_ute_desc",
        "almacen": "almacen",
        "grupo_de_articulos": "grupo_de_articulos",
        "gpo_articulos_descripcion": "gpo_articulos_descripcion",
        "material": "material",
        "material_descripcion": "material_descripcion",
        "cat_valoracion": "cat_valoracion",
        "elemento_pep": "elemento_pep",
        "lote": "lote",
        "stock": "stock",
        "um": "um",
        "precio": "precio",
        "stock_valorizado": "stock_valorizado",
        "moneda": "moneda",
        "ubicacion": "ubicacion",
        "planificacion_categorias": "planificacion_categorias",
        "sub_categorias": "sub_categorias",
        "inmovilizado": "inmovilizado",
        "critico": "critico",
        "prevision_por_obsolescencia": "prevision_por_obsolescencia",
    }
    total_imported += _import_table(
        pg_conn, SAP_DATA_DB, "stock", "sap_stock", stock_cols
    )

    # Step 4: Import consumo_historico (sap_data.db → sap_consumo_historico)
    logger.info("\n[3/7] Importing consumo_historico...")
    consumo_cols = {
        "fecha": "fecha",
        "centro": "centro",
        "almacen": "almacen",
        "cantidad": "cantidad",
        "material": "material",
        "descripcion": "descripcion",
    }
    total_imported += _import_table(
        pg_conn, SAP_DATA_DB, "consumo_historico", "sap_consumo_historico", consumo_cols
    )

    # Step 5: Import pedidos_sap (sap_data.db → sap_pedidos)
    logger.info("\n[4/7] Importing pedidos_sap...")
    pedidos_cols = {
        "centro": "centro",
        "almacen": "almacen",
        "pedido": "pedido",
        "posicion_pedido": "posicion_pedido",
        "material": "material",
        "descripcion": "descripcion",
        "ctdpedida": "ctdpedida",
        "ctdentregada": "ctdentregada",
        "saldo_pend": "saldo_pend",
        "um": "um",
        "fecdocum": "fecdocum",
        "fecentre": "fecentre",
        "cls": "cls",
        "solicitante": "solicitante",
        "nombre_1": "nombre_1",
    }
    total_imported += _import_table(
        pg_conn, SAP_DATA_DB, "pedidos_sap", "sap_pedidos", pedidos_cols
    )

    # Step 6: Import materiales_bbdd (sap_data.db → sap_materiales_bbdd)
    logger.info("\n[5/7] Importing materiales_bbdd...")
    materiales_bbdd_cols = {
        "sector": "sector",
        "almacen": "almacen",
        "centro": "centro",
        "codigo_material": "codigo_material",
        "descripcion": "descripcion",
        "stock_de_seguridad": "stock_de_seguridad",
        "punto_de_pedido": "punto_de_pedido",
        "stock_maximo": "stock_maximo",
    }
    total_imported += _import_table(
        pg_conn,
        SAP_DATA_DB,
        "materiales_bbdd",
        "sap_materiales_bbdd",
        materiales_bbdd_cols,
    )

    # Step 7: Import catalogo_materiales (master_materiales.db → cat_materiales)
    logger.info("\n[6/7] Importing catalogo_materiales...")
    catalogo_cols = {
        "codigo": "codigo",
        "descripcion": "descripcion",
        "descripcion_larga": "descripcion_larga",
        "grupo_articulos": "grupo_articulos",
        "unidad_medida": "unidad_medida",
        "precio_usd": "precio_usd",
        "activo": "activo",
        "created_at": "created_at",
    }
    total_imported += _import_table(
        pg_conn,
        MASTER_MATERIALES_DB,
        "catalogo_materiales",
        "cat_materiales",
        catalogo_cols,
    )

    # Step 8: Import materiales_equivalencias (master_materiales.db → cat_equivalencias)
    logger.info("\n[7/7] Importing materiales_equivalencias...")
    equiv_cols = {
        "material_base": "material_base",
        "texto_breve_base": "texto_breve_base",
        "material_equivalente": "material_equivalente",
        "texto_breve_equivalente": "texto_breve_equivalente",
        "tipo_equiv": "tipo_equiv",
        "criterio": "criterio",
        "motivo_equivalencia": "motivo_equivalencia",
    }
    total_imported += _import_table(
        pg_conn,
        MASTER_MATERIALES_DB,
        "materiales_equivalencias",
        "cat_equivalencias",
        equiv_cols,
    )

    # Verify
    logger.info("\n" + "=" * 60)
    logger.info("Verification:")
    cursor = pg_conn.cursor()
    for table in [
        "sap_stock",
        "sap_consumo_historico",
        "sap_pedidos",
        "sap_materiales_bbdd",
        "cat_materiales",
        "cat_equivalencias",
    ]:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            logger.info(f"  {table}: {count} rows")
        except Exception as e:
            logger.error(f"  {table}: ERROR - {e}")
            pg_conn.rollback()

    pg_conn.close()
    logger.info(f"\nTotal imported: {total_imported} rows")
    logger.info("Migration 033 completed successfully")
    return True


def rollback_migration(database_url: str = None):
    """Truncate all imported SAP data tables."""
    if not database_url:
        database_url = os.environ.get("DATABASE_URL")

    if not database_url or not database_url.startswith("postgresql://"):
        return False

    try:
        pg_conn = _get_pg_connection(database_url)
        for table in [
            "sap_stock",
            "sap_consumo_historico",
            "sap_pedidos",
            "sap_materiales_bbdd",
            "cat_materiales",
            "cat_equivalencias",
        ]:
            _truncate_table(pg_conn, table)
        pg_conn.close()
        logger.info("Rollback 033 completed: all SAP data truncated")
        return True
    except Exception as e:
        logger.error(f"Rollback error: {e}")
        return False


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    # Accept DATABASE_URL as argument or env var
    db_url = sys.argv[1] if len(sys.argv) > 1 else None
    clean = "--clean" in sys.argv

    if clean:
        logger.info("CLEAN mode: will truncate tables before importing")

    success = run_migration(database_url=db_url, clean=clean)
    sys.exit(0 if success else 1)
