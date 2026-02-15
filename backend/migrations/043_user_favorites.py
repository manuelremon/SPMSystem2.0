"""
Migration 043: User Material Favorites
Creates table for user favorite materials.
"""
import logging
import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

logger = logging.getLogger(__name__)

PG_DDL = """
CREATE TABLE IF NOT EXISTS user_material_favorito (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    material_codigo TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, material_codigo)
);

CREATE INDEX IF NOT EXISTS idx_user_material_favorito_user_id
    ON user_material_favorito(user_id);
CREATE INDEX IF NOT EXISTS idx_user_material_favorito_material
    ON user_material_favorito(material_codigo);
"""

SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS user_material_favorito (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    material_codigo TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, material_codigo)
);

CREATE INDEX IF NOT EXISTS idx_user_material_favorito_user_id
    ON user_material_favorito(user_id);
CREATE INDEX IF NOT EXISTS idx_user_material_favorito_material
    ON user_material_favorito(material_codigo);
"""


def run_migration():
    from backend.core.db import get_db_transaction, is_using_postgresql

    pg = is_using_postgresql()
    ddl = PG_DDL if pg else SQLITE_DDL

    with get_db_transaction() as conn:
        cur = conn.cursor()
        for statement in ddl.strip().split(";"):
            statement = statement.strip()
            if statement:
                cur.execute(statement)

    db_type = "PostgreSQL" if pg else "SQLite"
    logger.info(f"[Migration 043] user_material_favorito table created ({db_type})")
    print(f"Migration 043 applied successfully ({db_type})")


def rollback_migration():
    from backend.core.db import get_db_transaction

    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS user_material_favorito")
    print("Migration 043 rolled back")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "run"
    if command == "rollback":
        rollback_migration()
    else:
        run_migration()
