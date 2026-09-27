"""
Migracion 103: curar el consumo historico y unificar "stock inmovilizado".

1. Borra los duplicados EXACTOS del consumo historico (mismas fecha, centro,
   almacen, material, cantidad y descripcion), dejando una fila por grupo
   (PG: la de menor id en sap_consumo_historico; SQLite: menor rowid en
   consumo_historico de sap_data.db).
2. PG: recrea la vista materializada stock_vista con la definicion unica de
   inmovilizado (backend/services/inmovilizado_service.py): una fila por
   material+centro+almacen, inmovilizado = sin consumo en los 12 meses previos
   a la fecha de corte del stock (MAX(dia)). La marca SAP queda como
   `inmovilizado_sap` (informativa). Agrega ultimo_consumo,
   dias_sin_movimiento (null si nunca hubo consumo) y fecha_corte.

Idempotente. Fecha: 2026-09-27
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.core.db import get_db_connection, is_using_postgresql  # noqa: E402
from backend.services import inmovilizado_service as inm  # noqa: E402

COLUMNAS_CLAVE = "fecha, centro, almacen, material, cantidad, descripcion"

# Mismos indices que la migracion 094 sobre stock_vista
INDICES_VISTA = (
    "CREATE INDEX IF NOT EXISTS idx_sv_centro ON stock_vista (centro)",
    "CREATE INDEX IF NOT EXISTS idx_sv_almacen ON stock_vista (almacen)",
    "CREATE INDEX IF NOT EXISTS idx_sv_material ON stock_vista (material)",
    "CREATE INDEX IF NOT EXISTS idx_sv_descripcion ON stock_vista (descripcion text_pattern_ops)",
    "CREATE INDEX IF NOT EXISTS idx_sv_valorizado ON stock_vista (stock_valorizado DESC)",
    "CREATE INDEX IF NOT EXISTS idx_sv_inmovilizado ON stock_vista (inmovilizado)",
    "CREATE INDEX IF NOT EXISTS idx_sv_mrp ON stock_vista (mrp)",
)


def _contar(cur, tabla):
    cur.execute(f"SELECT COUNT(*) FROM {tabla}")
    total = cur.fetchone()[0]
    cur.execute(
        f"SELECT COUNT(*), COALESCE(SUM(n - 1), 0) FROM "
        f"(SELECT COUNT(*) AS n FROM {tabla} GROUP BY {COLUMNAS_CLAVE} HAVING COUNT(*) > 1) d"
    )
    # Acceso por indice: en PG la fila es un DictRow (desempaquetarla da los nombres)
    fila = cur.fetchone()
    return total, fila[0], fila[1]


def _deduplicar(cur, tabla, columna_id):
    cur.execute(
        f"DELETE FROM {tabla} WHERE {columna_id} NOT IN "
        f"(SELECT MIN({columna_id}) FROM {tabla} GROUP BY {COLUMNAS_CLAVE})"
    )
    return cur.rowcount or 0


def sql_stock_vista() -> str:
    """CREATE de stock_vista con la definicion unica (sin placeholders)."""
    base = inm.sql_stock_por_clave(
        tabla_stock="sap_stock",
        tabla_consumo="sap_consumo_historico",
        tabla_mrp="sap_materiales_bbdd",
        desde=f"(fc.corte - {inm.VENTANA_DIAS})",
        corte="fc.corte",
    )
    return f"""
        CREATE MATERIALIZED VIEW stock_vista AS
        SELECT
            k.material, k.descripcion, k.centro, k.centro_descripcion, k.almacen,
            k.stock, k.um, k.precio, k.stock_valorizado,
            (k.inmovilizado = 1) AS inmovilizado,
            (k.inmovilizado_sap = 1) AS inmovilizado_sap,
            (k.mrp = 1) AS mrp,
            k.ultimo_consumo,
            (fc.corte - k.ultimo_consumo) AS dias_sin_movimiento,
            fc.corte AS fecha_corte
        FROM (SELECT COALESCE(MAX(dia), CURRENT_DATE) AS corte FROM sap_stock) fc
        CROSS JOIN LATERAL ({base}) k
    """


def _recrear_vista(cur):
    cur.execute("DROP MATERIALIZED VIEW IF EXISTS stock_vista CASCADE")
    cur.execute(sql_stock_vista())
    for sql in INDICES_VISTA:
        cur.execute(sql)
    # CREATE MATERIALIZED VIEW ... AS ya la deja poblada: no hace falta REFRESH
    cur.execute(
        "SELECT COUNT(*), COUNT(*) FILTER (WHERE inmovilizado), "
        "COUNT(*) FILTER (WHERE inmovilizado_sap), MAX(fecha_corte) FROM stock_vista"
    )
    fila = cur.fetchone()
    claves, inmov, marca_sap, corte = fila[0], fila[1], fila[2], fila[3]
    print(f"  - stock_vista: {claves} claves, {inmov} inmovilizadas (definicion unica), "
          f"{marca_sap} con marca SAP, corte {corte}")


def up():
    pg = is_using_postgresql()
    tabla, columna_id = ("sap_consumo_historico", "id") if pg else ("consumo_historico", "rowid")
    with get_db_connection("sap_data") as conn:
        cur = conn.cursor()
        total, grupos, sobrantes = _contar(cur, tabla)
        print(f"  - {tabla}: {total} filas, {grupos} grupos duplicados ({sobrantes} filas sobrantes)")
        borradas = _deduplicar(cur, tabla, columna_id)
        print(f"  - {tabla}: {borradas} filas duplicadas borradas")
        total, grupos, sobrantes = _contar(cur, tabla)
        if grupos:
            conn.rollback()
            raise RuntimeError(f"Migracion 103: quedan {grupos} grupos duplicados en {tabla}")
        print(f"  - {tabla}: {total} filas, 0 duplicados exactos")
        if pg:
            _recrear_vista(cur)
        conn.commit()
    print("Migration 103: consumo sin duplicados y stock inmovilizado unificado")


if __name__ == "__main__":
    up()
