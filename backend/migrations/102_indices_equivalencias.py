"""
Migration 102: indices para el buscador de materiales.

materiales_equivalencias (~180k filas) no tiene indices; el buscador consulta por
material_base y material_equivalente. En PostgreSQL el nombre puede ser una vista:
se indexa la tabla base y sus columnas reales.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.core.db import get_db_connection, is_using_postgresql  # noqa: E402

TABLA = "materiales_equivalencias"
INDICES = (("idx_mat_equiv_base", "material_base"), ("idx_mat_equiv_equivalente", "material_equivalente"))


def _destino_pg(cur, columna: str) -> tuple[str, str]:
    """(tabla, columna) reales en PG, resolviendo la vista si hace falta."""
    cur.execute("SELECT table_type FROM information_schema.tables WHERE table_name = %s", (TABLA,))
    fila = cur.fetchone()
    if fila is None or fila["table_type"] != "VIEW":
        return TABLA, columna
    # La vista expone `columna`; buscar a que columna de la tabla base corresponde
    cur.execute("SELECT pg_get_viewdef(%s::regclass, true) AS def", (TABLA,))
    definicion = cur.fetchone()["def"]
    cur.execute(
        "SELECT DISTINCT table_name FROM information_schema.view_table_usage WHERE view_name = %s", (TABLA,)
    )
    bases = [f["table_name"] for f in cur.fetchall()]
    if len(bases) != 1:
        raise RuntimeError(f"No se pudo resolver la tabla base de {TABLA}: {bases}")
    base = bases[0]
    cur.execute(
        "SELECT column_name FROM information_schema.view_column_usage WHERE view_name = %s AND table_name = %s",
        (TABLA, base),
    )
    columnas_base = {f["column_name"] for f in cur.fetchall()}
    if columna in columnas_base:
        return base, columna
    raise RuntimeError(f"La vista {TABLA} renombra {columna}; revisar su definicion: {definicion}")


def up():
    pg = is_using_postgresql()
    with get_db_connection("master_materiales") as conn:
        cur = conn.cursor()
        for nombre, columna in INDICES:
            tabla, col = _destino_pg(cur, columna) if pg else (TABLA, columna)
            cur.execute(f"CREATE INDEX IF NOT EXISTS {nombre} ON {tabla} ({col})")
            print(f"  - {nombre} en {tabla}({col})")
        conn.commit()
    print("Migration 102: indices de materiales_equivalencias creados")


if __name__ == "__main__":
    up()
