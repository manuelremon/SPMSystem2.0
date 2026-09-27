"""
Migracion 104: el precio del catalogo pasa a ser el precio SAP del stock.

catalogo_materiales.precio_usd era relleno (mediana ~114x el precio SAP). Ahora:
- precio_usd = precio SAP ponderado del material, redondeado a 2 decimales:
  SUM(stock_valorizado) / NULLIF(SUM(stock), 0) sobre filas con stock > 0
  (SQLite: tabla `stock` de sap_data.db; PG: tabla base `sap_stock`). El precio
  SAP ya viene anonimizado (migracion 100): se usa tal cual.
- Los materiales sin precio SAP (sin stock, valorizado 0 o precio que redondea
  a 0,00) quedan con precio_usd NULL y no se pueden solicitar hasta que se cargue
  (backend/core/item_schemas.py -> _SIN_PRECIO).
- El valor anterior se guarda en precio_usd_relleno (solo la primera vez) para
  poder revertir: UPDATE ... SET precio_usd = precio_usd_relleno.
- Las solicitudes historicas no se recalculan.

PG: catalogo_materiales es una vista (SELECT * FROM cat_materiales). La columna
nueva se agrega a la tabla base y la vista no se toca (no la necesita).

Idempotente: una segunda ejecucion no cambia nada. Fecha: 2026-09-27
"""

import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.core.db import get_db_connection, is_using_postgresql  # noqa: E402

VISTA = "catalogo_materiales"
COLUMNA_RELLENO = "precio_usd_relleno"
LOTE = 1000

# Precio SAP ponderado por material (portable SQLite/PG)
SQL_PRECIO_SAP = """
    SELECT material,
           ROUND(CAST(SUM(stock_valorizado) AS NUMERIC) / NULLIF(CAST(SUM(stock) AS NUMERIC), 0), 2) AS p
    FROM {tabla}
    WHERE stock > 0 AND material IS NOT NULL
    GROUP BY material
"""


# ---------------------------------------------------------------------------
# Introspeccion
# ---------------------------------------------------------------------------


def _tabla_base_pg(cur) -> str:
    """Tabla real detras de catalogo_materiales en PG (como la migracion 102)."""
    cur.execute("SELECT table_type FROM information_schema.tables WHERE table_name = %s", (VISTA,))
    fila = cur.fetchone()
    if fila is None or fila["table_type"] != "VIEW":
        return VISTA
    cur.execute(
        "SELECT DISTINCT table_name FROM information_schema.view_table_usage WHERE view_name = %s", (VISTA,)
    )
    bases = [f["table_name"] for f in cur.fetchall()]
    if len(bases) != 1:
        raise RuntimeError(f"No se pudo resolver la tabla base de {VISTA}: {bases}")
    base = bases[0]
    cur.execute(
        "SELECT column_name FROM information_schema.view_column_usage WHERE view_name = %s AND table_name = %s",
        (VISTA, base),
    )
    columnas = {f["column_name"] for f in cur.fetchall()}
    if not {"codigo", "precio_usd"} <= columnas:
        raise RuntimeError(f"La vista {VISTA} renombra codigo/precio_usd; revisar su definicion")
    return base


def _columnas_pg(cur, tabla: str) -> set:
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = %s", (tabla,))
    return {f["column_name"] for f in cur.fetchall()}


def _columnas_sqlite(cur, tabla: str) -> set:
    cur.execute(f"PRAGMA table_info({tabla})")
    return {f[1] for f in cur.fetchall()}


# ---------------------------------------------------------------------------
# Pasos comunes
# ---------------------------------------------------------------------------


def _mediana(cur, tabla):
    cur.execute(f"SELECT precio_usd FROM {tabla} WHERE precio_usd IS NOT NULL")
    valores = [float(f[0]) for f in cur.fetchall()]
    return statistics.median(valores) if valores else None


def _guardar_relleno(cur, tabla, columnas) -> bool:
    """Crea precio_usd_relleno y copia el precio actual solo si esta vacia. True si copio."""
    if COLUMNA_RELLENO not in columnas:
        cur.execute(f"ALTER TABLE {tabla} ADD COLUMN {COLUMNA_RELLENO} NUMERIC(15, 4)")
    cur.execute(f"SELECT COUNT({COLUMNA_RELLENO}) FROM {tabla}")
    if cur.fetchone()[0]:
        return False
    cur.execute(f"UPDATE {tabla} SET {COLUMNA_RELLENO} = precio_usd")
    return True


def _conteos(cur, tabla):
    cur.execute(f"SELECT COUNT(*), COUNT(precio_usd) FROM {tabla}")
    fila = cur.fetchone()  # por indice: en PG es DictRow
    return fila[1], fila[0] - fila[1]


# ---------------------------------------------------------------------------
# SQLite: catalogo y stock en archivos distintos
# ---------------------------------------------------------------------------


def _precios_sap_sqlite() -> dict:
    with get_db_connection("sap_data") as conn:
        cur = conn.cursor()
        cur.execute(SQL_PRECIO_SAP.format(tabla="stock"))
        precios = {}
        for f in cur.fetchall():
            p = round(float(f[1]), 2) if f[1] is not None else 0.0
            if p > 0:
                precios[f[0]] = p
        return precios


def _aplicar_sqlite(cur, tabla, precios):
    cur.execute(f"SELECT codigo, precio_usd FROM {tabla}")
    actualizar, anular = [], []
    for f in cur.fetchall():
        codigo, actual = f[0], f[1]
        nuevo = precios.get(codigo)
        if nuevo is None:
            if actual is not None:
                anular.append((codigo,))
        elif actual is None or float(actual) != nuevo:
            actualizar.append((nuevo, codigo))
    for i in range(0, len(actualizar), LOTE):
        cur.executemany(f"UPDATE {tabla} SET precio_usd = %s WHERE codigo = %s", actualizar[i : i + LOTE])
    for i in range(0, len(anular), LOTE):
        cur.executemany(f"UPDATE {tabla} SET precio_usd = NULL WHERE codigo = %s", anular[i : i + LOTE])
    return len(actualizar), len(anular)


# ---------------------------------------------------------------------------
# PG: catalogo y stock en la misma BD
# ---------------------------------------------------------------------------


def _aplicar_pg(cur, tabla):
    sap = f"SELECT material, p FROM ({SQL_PRECIO_SAP.format(tabla='sap_stock')}) sp WHERE p > 0"
    cur.execute(
        f"UPDATE {tabla} SET precio_usd = s.p FROM ({sap}) s "
        f"WHERE {tabla}.codigo = s.material AND {tabla}.precio_usd IS DISTINCT FROM s.p"
    )
    actualizados = cur.rowcount or 0
    cur.execute(
        f"UPDATE {tabla} SET precio_usd = NULL WHERE precio_usd IS NOT NULL "
        f"AND NOT EXISTS (SELECT 1 FROM ({sap}) s WHERE s.material = {tabla}.codigo)"
    )
    return actualizados, cur.rowcount or 0


def up():
    pg = is_using_postgresql()
    precios = None if pg else _precios_sap_sqlite()
    with get_db_connection("master_materiales") as conn:
        cur = conn.cursor()
        tabla = _tabla_base_pg(cur) if pg else VISTA
        columnas = _columnas_pg(cur, tabla) if pg else _columnas_sqlite(cur, tabla)
        mediana_antes = _mediana(cur, tabla)
        relleno_copiado = _guardar_relleno(cur, tabla, columnas)
        if pg:
            actualizados, anulados = _aplicar_pg(cur, tabla)
        else:
            actualizados, anulados = _aplicar_sqlite(cur, tabla, precios)
        con_precio, sin_precio = _conteos(cur, tabla)
        mediana_despues = _mediana(cur, tabla)
        conn.commit()

    # Si corre dentro del proceso del backend, que no queden precios viejos en cache.
    # (Corriendo aparte, el backend en marcha debe reiniciarse; el deploy lo hace.)
    from backend.core.item_schemas import limpiar_cache_materiales

    limpiar_cache_materiales()

    stats = {
        "tabla": tabla,
        "relleno_copiado": relleno_copiado,
        "actualizados": actualizados,
        "anulados": anulados,
        "con_precio_sap": con_precio,
        "sin_precio": sin_precio,
        "mediana_antes": mediana_antes,
        "mediana_despues": mediana_despues,
    }
    print(f"  - {tabla}: precio anterior {'copiado' if relleno_copiado else 'ya estaba'} en {COLUMNA_RELLENO}")
    print(f"  - {actualizados} materiales actualizados con precio SAP, {anulados} puestos sin precio (NULL)")
    print(f"  - total: {con_precio} con precio SAP, {sin_precio} sin precio")
    print(f"  - mediana precio_usd: antes {mediana_antes}, despues {mediana_despues}")
    print("Migration 104: precios del catalogo = precio SAP ponderado del stock")
    return stats


if __name__ == "__main__":
    up()
