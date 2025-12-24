"""
Migración 020: Crear tablas de catálogos en PostgreSQL

Esta migración crea las tablas necesarias para migrar los datos de:
- catalogo_materiales.db (materiales)
- sap_data.db (stock, pedidos_sap, materiales_bbdd, consumo_historico)
- equivalentes.db (equivalencias)

Fecha: 2025-12-24
"""

import logging
import os

import psycopg2

logger = logging.getLogger(__name__)

# DDL para PostgreSQL
DDL_STATEMENTS = [
    # =========================================================================
    # Tabla: materiales (de catalogo_materiales.db)
    # =========================================================================
    """
    CREATE TABLE IF NOT EXISTS cat_materiales (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        descripcion TEXT,
        descripcion_larga TEXT,
        grupo_articulos INTEGER,
        unidad_medida VARCHAR(20),
        precio_usd DECIMAL(15, 4),
        activo INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_cat_materiales_codigo ON cat_materiales(codigo)",
    "CREATE INDEX IF NOT EXISTS idx_cat_materiales_grupo ON cat_materiales(grupo_articulos)",

    # =========================================================================
    # Tabla: stock (de sap_data.db) - 149,997 registros
    # =========================================================================
    """
    CREATE TABLE IF NOT EXISTS sap_stock (
        id SERIAL PRIMARY KEY,
        dia DATE,
        acreedor VARCHAR(50),
        acreedor_descripcion TEXT,
        regional VARCHAR(50),
        centro VARCHAR(20),
        centro_descripcion TEXT,
        ypf_ute_desc TEXT,
        almacen VARCHAR(20),
        grupo_de_articulos VARCHAR(50),
        gpo_articulos_descripcion TEXT,
        material VARCHAR(50),
        material_descripcion TEXT,
        cat_valoracion VARCHAR(50),
        elemento_pep VARCHAR(100),
        lote VARCHAR(50),
        stock DECIMAL(15, 3),
        um VARCHAR(20),
        precio DECIMAL(15, 4),
        stock_valorizado DECIMAL(15, 4),
        moneda VARCHAR(10),
        ubicacion VARCHAR(100),
        planificacion_categorias TEXT,
        sub_categorias TEXT,
        inmovilizado VARCHAR(20),
        critico VARCHAR(20),
        prevision_por_obsolescencia TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_sap_stock_material ON sap_stock(material)",
    "CREATE INDEX IF NOT EXISTS idx_sap_stock_centro ON sap_stock(centro)",
    "CREATE INDEX IF NOT EXISTS idx_sap_stock_almacen ON sap_stock(almacen)",
    "CREATE INDEX IF NOT EXISTS idx_sap_stock_dia ON sap_stock(dia)",

    # =========================================================================
    # Tabla: pedidos_sap (de sap_data.db) - 602 registros
    # =========================================================================
    """
    CREATE TABLE IF NOT EXISTS sap_pedidos (
        id SERIAL PRIMARY KEY,
        centro VARCHAR(20),
        almacen VARCHAR(20),
        pedido VARCHAR(50),
        posicion_pedido INTEGER,
        material VARCHAR(50),
        descripcion TEXT,
        ctdpedida DECIMAL(15, 3),
        ctdentregada DECIMAL(15, 3),
        saldo_pend DECIMAL(15, 3),
        um VARCHAR(20),
        fecdocum DATE,
        fecentre DATE,
        cls VARCHAR(20),
        solicitante VARCHAR(100),
        nombre_1 TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_sap_pedidos_material ON sap_pedidos(material)",
    "CREATE INDEX IF NOT EXISTS idx_sap_pedidos_centro ON sap_pedidos(centro)",

    # =========================================================================
    # Tabla: materiales_bbdd (de sap_data.db) - 7,309 registros
    # =========================================================================
    """
    CREATE TABLE IF NOT EXISTS sap_materiales_bbdd (
        id SERIAL PRIMARY KEY,
        sector VARCHAR(50),
        almacen VARCHAR(20),
        centro VARCHAR(20),
        codigo_material VARCHAR(50),
        descripcion TEXT,
        stock_de_seguridad INTEGER DEFAULT 0,
        punto_de_pedido INTEGER DEFAULT 0,
        stock_maximo INTEGER DEFAULT 0
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_sap_materiales_bbdd_codigo ON sap_materiales_bbdd(codigo_material)",
    "CREATE INDEX IF NOT EXISTS idx_sap_materiales_bbdd_centro ON sap_materiales_bbdd(centro)",

    # =========================================================================
    # Tabla: consumo_historico (de sap_data.db) - 20,424 registros
    # =========================================================================
    """
    CREATE TABLE IF NOT EXISTS sap_consumo_historico (
        id SERIAL PRIMARY KEY,
        fecha DATE,
        centro VARCHAR(20),
        almacen VARCHAR(20),
        cantidad DECIMAL(15, 3),
        material VARCHAR(50),
        descripcion TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_sap_consumo_material ON sap_consumo_historico(material)",
    "CREATE INDEX IF NOT EXISTS idx_sap_consumo_centro ON sap_consumo_historico(centro)",
    "CREATE INDEX IF NOT EXISTS idx_sap_consumo_fecha ON sap_consumo_historico(fecha)",

    # =========================================================================
    # Tabla: equivalencias (de equivalentes.db) - 34,865 registros
    # =========================================================================
    """
    CREATE TABLE IF NOT EXISTS cat_equivalencias (
        id SERIAL PRIMARY KEY,
        material_base VARCHAR(50),
        texto_breve_base TEXT,
        material_equivalente VARCHAR(50),
        texto_breve_equivalente TEXT,
        tipo_equiv VARCHAR(50),
        criterio TEXT,
        motivo_equivalencia TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_cat_equiv_base ON cat_equivalencias(material_base)",
    "CREATE INDEX IF NOT EXISTS idx_cat_equiv_equivalente ON cat_equivalencias(material_equivalente)",

    # =========================================================================
    # Vistas de Compatibilidad (nombres SQLite → PostgreSQL)
    # =========================================================================

    # Vista: equivalencias (tabla original de equivalentes.db)
    """
    CREATE OR REPLACE VIEW equivalencias AS
    SELECT
        id as rowid,
        id,
        material_base,
        texto_breve_base,
        material_equivalente,
        texto_breve_equivalente,
        tipo_equiv,
        criterio,
        motivo_equivalencia
    FROM cat_equivalencias
    """,

    # Vista: stock (tabla original de sap_data.db)
    """
    CREATE OR REPLACE VIEW stock AS
    SELECT
        id as rowid,
        id,
        dia,
        acreedor,
        acreedor_descripcion,
        regional,
        centro,
        centro_descripcion,
        ypf_ute_desc as "ypf/ute_desc",
        almacen,
        grupo_de_articulos,
        gpo_articulos_descripcion,
        material,
        material_descripcion,
        cat_valoracion,
        elemento_pep,
        lote,
        stock,
        um,
        precio,
        stock_valorizado,
        moneda,
        ubicacion,
        planificacion_categorias,
        sub_categorias,
        inmovilizado,
        critico,
        prevision_por_obsolescencia
    FROM sap_stock
    """,

    # Vista: pedidos_sap (tabla original de sap_data.db)
    "CREATE OR REPLACE VIEW pedidos_sap AS SELECT * FROM sap_pedidos",

    # Vista: materiales_bbdd (tabla original de sap_data.db)
    "CREATE OR REPLACE VIEW materiales_bbdd AS SELECT * FROM sap_materiales_bbdd",

    # Vista: consumo_historico (tabla original de sap_data.db)
    "CREATE OR REPLACE VIEW consumo_historico AS SELECT * FROM sap_consumo_historico",
]


def run_migration():
    """Ejecuta la migración para crear las tablas de catálogos."""
    database_url = os.environ.get("DATABASE_URL")

    if not database_url or not database_url.startswith("postgresql://"):
        logger.warning("DATABASE_URL no es PostgreSQL. Saltando migración.")
        return False

    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = True
        cursor = conn.cursor()

        for i, ddl in enumerate(DDL_STATEMENTS, 1):
            try:
                cursor.execute(ddl)
                logger.info(f"[{i}/{len(DDL_STATEMENTS)}] DDL ejecutado correctamente")
            except Exception as e:
                logger.warning(f"[{i}/{len(DDL_STATEMENTS)}] Error (puede ser normal): {e}")

        cursor.close()
        conn.close()

        logger.info("Migración 020 completada: tablas de catálogos creadas")
        return True

    except Exception as e:
        logger.error(f"Error en migración 020: {e}")
        return False


def rollback_migration():
    """Revierte la migración eliminando las tablas y vistas creadas."""
    database_url = os.environ.get("DATABASE_URL")

    if not database_url or not database_url.startswith("postgresql://"):
        return False

    # Primero eliminar vistas (dependen de las tablas)
    views = [
        "equivalencias",
        "stock",
        "pedidos_sap",
        "materiales_bbdd",
        "consumo_historico",
    ]

    tables = [
        "cat_materiales",
        "sap_stock",
        "sap_pedidos",
        "sap_materiales_bbdd",
        "sap_consumo_historico",
        "cat_equivalencias",
    ]

    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = True
        cursor = conn.cursor()

        for view in views:
            cursor.execute(f"DROP VIEW IF EXISTS {view} CASCADE")
            logger.info(f"Vista {view} eliminada")

        for table in tables:
            cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
            logger.info(f"Tabla {table} eliminada")

        cursor.close()
        conn.close()

        logger.info("Rollback de migración 020 completado")
        return True

    except Exception as e:
        logger.error(f"Error en rollback 020: {e}")
        return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migration()
