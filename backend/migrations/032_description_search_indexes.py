"""Migration 032: Add indexes on description columns for search performance."""

import logging

logger = logging.getLogger(__name__)

# Index definitions: (index_name, table, column)
# Organized by database for SQLite, all in one schema for PostgreSQL.
_SAP_DATA_INDEXES = [
    ("idx_stock_material_desc", "stock", "material_descripcion"),
    ("idx_consumo_descripcion", "consumo_historico", "descripcion"),
    ("idx_materiales_bbdd_desc", "materiales_bbdd", "descripcion"),
]

_CATALOGO_INDEXES = [
    ("idx_catalogo_descripcion", "catalogo_materiales", "descripcion"),
    ("idx_catalogo_desc_larga", "catalogo_materiales", "descripcion_larga"),
]

_EQUIV_INDEXES = [
    ("idx_equiv_texto_base", "materiales_equivalencias", "texto_breve_base"),
    ("idx_equiv_texto_equiv", "materiales_equivalencias", "texto_breve_equivalente"),
]

# PostgreSQL table name mapping (production uses renamed tables)
_PG_TABLE_MAP = {
    "stock": "stock",
    "consumo_historico": "consumo_historico",
    "materiales_bbdd": "materiales_bbdd",
    "catalogo_materiales": "cat_materiales",
    "materiales_equivalencias": "cat_equivalencias",
}


def migrate(conn, is_postgresql=False):
    """Create B-tree indexes on description columns used in search queries."""
    cursor = conn.cursor()
    created = 0

    all_indexes = _SAP_DATA_INDEXES + _CATALOGO_INDEXES + _EQUIV_INDEXES

    for idx_name, table, column in all_indexes:
        if is_postgresql:
            table = _PG_TABLE_MAP.get(table, table)

        try:
            cursor.execute(
                f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({column})"
            )
            created += 1
        except Exception as e:
            # Table may not exist in this database — skip silently
            logger.debug(f"Skipping index {idx_name} on {table}.{column}: {e}")

    conn.commit()
    logger.info(f"Migration 032: {created} description search indexes created/verified")
