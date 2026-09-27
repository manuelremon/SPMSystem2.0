"""
Stock inmovilizado: definicion UNICA para todo el sistema.

Una clave de stock (material + centro + almacen) esta inmovilizada si NO tuvo
consumo en los 12 meses previos a la fecha de corte del stock:

    fecha > corte - 365 dias AND fecha <= corte

- Fecha de corte = MAX(dia) de la tabla de stock (o la fecha actual si no hay).
- dias_sin_movimiento = corte - ultimo consumo (<= corte) de la clave; None si
  nunca hubo consumo.
- La marca SAP (stock.inmovilizado = 'INMOVILIZADO') es solo informativa
  (`inmovilizado_sap`), no decide.

Todos los consumidores (listado y resumen de /api/stock, vista materializada
stock_vista en PostgreSQL, KPI /api/kpis/stock-inmovilizado) usan las
expresiones de este modulo.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

VENTANA_DIAS = 365

# Columnas por las que se puede ordenar el listado
COLUMNAS_ORDEN = {
    "material", "descripcion", "centro", "almacen", "stock",
    "stock_valorizado", "dias_sin_movimiento", "inmovilizado", "mrp",
}


# ---------------------------------------------------------------------------
# Fecha de corte
# ---------------------------------------------------------------------------

def a_fecha(valor) -> date | None:
    """Normaliza date/datetime/'YYYY-MM-DD...' a date (None si no se puede)."""
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    try:
        return datetime.strptime(str(valor)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def fecha_corte(cur, tabla_stock: str = "stock") -> date:
    """Fecha de corte del stock: MAX(dia); si no hay, la fecha actual."""
    cur.execute(f"SELECT MAX(dia) AS corte FROM {tabla_stock}")
    fila = cur.fetchone()
    return a_fecha(fila[0] if fila else None) or date.today()


def params_ventana(corte: date, dias: int = VENTANA_DIAS) -> list[str]:
    """Parametros [desde, corte] para `sql_inmovilizado` con placeholders."""
    return [(corte - timedelta(days=dias)).isoformat(), corte.isoformat()]


def dias_sin_movimiento(ultimo_consumo, corte: date) -> int | None:
    """Dias entre el ultimo consumo y el corte; None si nunca hubo consumo."""
    ultimo = a_fecha(ultimo_consumo)
    return (corte - ultimo).days if ultimo else None


# ---------------------------------------------------------------------------
# Expresiones SQL (placeholders %s por defecto; en la vista PG se pasan
# expresiones SQL en lugar de placeholders)
# ---------------------------------------------------------------------------

def _misma_clave(alias: str) -> str:
    return (f"ch.material = {alias}.material AND ch.centro = {alias}.centro"
            f" AND ch.almacen = {alias}.almacen")


def sql_inmovilizado(alias: str = "s", tabla_consumo: str = "consumo_historico",
                     desde: str = "%s", corte: str = "%s") -> str:
    """Condicion booleana: la clave de `alias` no tuvo consumo en (desde, corte].

    Con los valores por defecto lleva 2 placeholders: `params_ventana(corte)`.
    """
    return (
        f"NOT EXISTS (SELECT 1 FROM {tabla_consumo} ch WHERE {_misma_clave(alias)}"
        f" AND ch.fecha > {desde} AND ch.fecha <= {corte})"
    )


def sql_ultimo_consumo(alias: str = "s", tabla_consumo: str = "consumo_historico",
                       corte: str = "%s") -> str:
    """Subconsulta: ultimo consumo de la clave hasta el corte (1 placeholder: corte)."""
    return (
        f"(SELECT MAX(ch.fecha) FROM {tabla_consumo} ch WHERE {_misma_clave(alias)}"
        f" AND ch.fecha <= {corte})"
    )


def sql_mrp(alias: str = "s", tabla_mrp: str = "materiales_bbdd") -> str:
    return (
        f"EXISTS (SELECT 1 FROM {tabla_mrp} m WHERE m.codigo_material = {alias}.material"
        f" AND m.centro = {alias}.centro AND m.almacen = {alias}.almacen"
        " AND (m.punto_de_pedido > 0 OR m.stock_de_seguridad > 0))"
    )


def sql_stock_por_clave(where_sql: str = "1=1", tabla_stock: str = "stock",
                        tabla_consumo: str = "consumo_historico", tabla_mrp: str = "materiales_bbdd",
                        desde: str = "%s", corte: str = "%s") -> str:
    """Una fila por material+centro+almacen con stock > 0 e indicadores.

    Placeholders (con valores por defecto): desde, corte, corte + los de `where_sql`.
    Ver `params_stock_por_clave`.
    """
    return f"""
        SELECT
            s.material,
            MAX(s.material_descripcion) AS descripcion,
            s.centro,
            MAX(s.centro_descripcion) AS centro_descripcion,
            s.almacen,
            SUM(s.stock) AS stock,
            MAX(s.um) AS um,
            MAX(s.precio) AS precio,
            SUM(s.stock_valorizado) AS stock_valorizado,
            CASE WHEN {sql_inmovilizado("s", tabla_consumo, desde, corte)} THEN 1 ELSE 0 END AS inmovilizado,
            MAX(CASE WHEN s.inmovilizado = 'INMOVILIZADO' THEN 1 ELSE 0 END) AS inmovilizado_sap,
            CASE WHEN {sql_mrp("s", tabla_mrp)} THEN 1 ELSE 0 END AS mrp,
            {sql_ultimo_consumo("s", tabla_consumo, corte)} AS ultimo_consumo
        FROM {tabla_stock} s
        WHERE s.stock > 0 AND {where_sql}
        GROUP BY s.material, s.centro, s.almacen
    """


def params_stock_por_clave(corte: date, where_params=()) -> list:
    desde, hasta = params_ventana(corte)
    return [desde, hasta, hasta, *where_params]


# ---------------------------------------------------------------------------
# Consultas sobre tablas crudas (SQLite dev / PG sin stock_vista)
# ---------------------------------------------------------------------------

def _where_stock(centro=None, almacen=None, material=None, descripcion=None):
    clauses, params = [], []
    if centro:
        clauses.append("s.centro = %s")
        params.append(centro)
    if almacen:
        clauses.append("s.almacen = %s")
        params.append(almacen)
    if material:
        clauses.append("s.material LIKE %s")
        params.append(f"%{material}%")
    if descripcion:
        from backend.core.search_utils import build_description_search_with_catalog

        search = build_description_search_with_catalog(descripcion, ["s.material_descripcion"], "s.material")
        if search:
            clauses.append(search.where_clause)
            params.extend(search.params)
    return (" AND ".join(clauses) if clauses else "1=1"), params


def _filtro_bool(columna: str, valor) -> str | None:
    if valor == "true":
        return f"k.{columna} = 1"
    if valor == "false":
        return f"k.{columna} = 0"
    return None


def orden_sql(sort: str, order: str, alias: str = "k") -> str:
    """ORDER BY seguro (whitelist). dias_sin_movimiento: null = nunca consumio = el mayor."""
    sort = sort if sort in COLUMNAS_ORDEN else "stock_valorizado"
    order = "ASC" if str(order).lower() == "asc" else "DESC"
    if sort == "dias_sin_movimiento":
        # mas dias = ultimo consumo mas antiguo; sin consumo va como el maximo
        inverso = "DESC" if order == "ASC" else "ASC"
        nulos = "NULLS FIRST" if order == "DESC" else "NULLS LAST"
        return f"{alias}.ultimo_consumo {inverso} {nulos}, {alias}.material"
    return f"{alias}.{sort} {order}, {alias}.material"


def fila_stock(fila, corte: date) -> dict:
    """Normaliza una fila de stock por clave para la API."""
    item = dict(fila)
    uc = a_fecha(item.get("ultimo_consumo"))
    item["ultimo_consumo"] = uc.isoformat() if uc else None
    item["dias_sin_movimiento"] = dias_sin_movimiento(uc, corte)
    for col in ("inmovilizado", "inmovilizado_sap", "mrp"):
        item[col] = bool(item.get(col))
    for col in ("stock", "precio", "stock_valorizado"):
        if item.get(col) is not None:
            item[col] = float(item[col])
    return item


def listar_stock(cur, centro=None, almacen=None, material=None, descripcion=None,
                 inmovilizado=None, mrp=None, limit=100, offset=0,
                 sort="stock_valorizado", order="desc", corte: date | None = None):
    """Listado paginado por clave. Devuelve (filas, total)."""
    corte = corte or fecha_corte(cur)
    where_sql, where_params = _where_stock(centro, almacen, material, descripcion)
    base = sql_stock_por_clave(where_sql)
    params = params_stock_por_clave(corte, where_params)
    filtros = [f for f in (_filtro_bool("inmovilizado", inmovilizado), _filtro_bool("mrp", mrp)) if f]
    where_k = " AND ".join(filtros) if filtros else "1=1"

    cur.execute(f"SELECT COUNT(*) AS total FROM ({base}) k WHERE {where_k}", params)
    total = cur.fetchone()[0]
    cur.execute(
        f"SELECT * FROM ({base}) k WHERE {where_k} ORDER BY {orden_sql(sort, order)} LIMIT %s OFFSET %s",
        params + [int(limit), int(offset)],
    )
    return [fila_stock(f, corte) for f in cur.fetchall()], total


def resumen_stock(cur, centro=None, almacen=None, corte: date | None = None) -> dict:
    """Resumen por clave con la misma definicion que `listar_stock`."""
    corte = corte or fecha_corte(cur)
    where_sql, where_params = _where_stock(centro, almacen)
    base = sql_stock_por_clave(where_sql)
    cur.execute(
        f"""
        SELECT
            COUNT(*) AS total_items,
            COALESCE(SUM(k.stock), 0) AS stock_total,
            COALESCE(SUM(k.stock_valorizado), 0) AS valor_total,
            COALESCE(SUM(k.inmovilizado), 0) AS inmovilizado_items,
            COALESCE(SUM(CASE WHEN k.inmovilizado = 1 THEN k.stock_valorizado ELSE 0 END), 0) AS inmovilizado_valor,
            COALESCE(SUM(k.mrp), 0) AS mrp_items
        FROM ({base}) k
        """,
        params_stock_por_clave(corte, where_params),
    )
    f = cur.fetchone()
    inm = int(f[3] or 0)
    return {
        "total_items": int(f[0] or 0),
        "stock_total": float(f[1] or 0),
        "valor_total": float(f[2] or 0),
        "inmovilizado_items": inm,
        "inmovilizado_valor": float(f[4] or 0),
        "mrp_items": int(f[5] or 0),
        # Clave JSON historica: ahora significa "sin consumo en los 12 meses al corte"
        # (= inmovilizado con la definicion unica)
        "sin_consumo_365d": inm,
        "fecha_corte": corte.isoformat(),
    }
