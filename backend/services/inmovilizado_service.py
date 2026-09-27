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
            -- precio medio de la clave: precio x stock = valorizado
            SUM(s.stock_valorizado) / NULLIF(SUM(s.stock), 0) AS precio,
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


# ---------------------------------------------------------------------------
# stock_vista (PostgreSQL, migraciones 094/103)
# ---------------------------------------------------------------------------

def tiene_stock_vista(cur) -> bool:
    """True si existe la vista materializada stock_vista (solo PostgreSQL)."""
    try:
        cur.execute("SELECT 1 FROM pg_matviews WHERE matviewname = 'stock_vista' LIMIT 1")
        return cur.fetchone() is not None
    except Exception:
        return False


def fecha_corte_vista(cur) -> date:
    """Fecha de corte con la que se calculo stock_vista (migracion 103)."""
    cur.execute("SELECT MAX(fecha_corte) FROM stock_vista")
    fila = cur.fetchone()
    return a_fecha(fila[0] if fila else None) or fecha_corte(cur)


# ---------------------------------------------------------------------------
# KPI "Stock inmovilizado global" (/api/kpis/stock-inmovilizado)
# ---------------------------------------------------------------------------

def _item_kpi(fila) -> dict:
    desc = fila[1] or fila[0] or ""
    return {
        "codigo": fila[0] or "",
        "descripcion": desc[:40] + "..." if len(desc) > 40 else desc,
        "lote": fila[2] or "",
        "stock": float(fila[3] or 0),
        "valor": float(fila[4] or 0),
    }


def _kpi_desde_vista(cur, centros, almacen, limit) -> dict:
    """KPI leyendo stock_vista: mismas cifras que /api/stock y /resumen en PG."""
    where, params = ["sv.inmovilizado = true"], []
    if centros:
        where.append(f"sv.centro IN ({','.join(['%s'] * len(centros))})")
        params.extend(centros)
    if almacen:
        where.append("sv.almacen = %s")
        params.append(almacen)
    where_sql = " AND ".join(where)

    cur.execute("SELECT COUNT(*), COALESCE(SUM(stock_valorizado), 0) FROM stock_vista sv WHERE sv.inmovilizado = true")
    g = cur.fetchone()
    # La vista no tiene lote: los items se agrupan por material
    cur.execute(
        f"""SELECT sv.material, MAX(sv.descripcion), NULL, SUM(sv.stock), SUM(sv.stock_valorizado) AS valor
            FROM stock_vista sv WHERE {where_sql}
            GROUP BY sv.material ORDER BY valor DESC LIMIT %s""",
        params + [int(limit)],
    )
    items = [_item_kpi(f) for f in cur.fetchall()]
    cur.execute(f"SELECT COUNT(*), COALESCE(SUM(sv.stock_valorizado), 0) FROM stock_vista sv WHERE {where_sql}", params)
    t = cur.fetchone()
    cur.execute("SELECT DISTINCT centro FROM stock_vista WHERE inmovilizado = true ORDER BY centro")
    centros_disp = [r[0] for r in cur.fetchall()]
    cur.execute("SELECT DISTINCT almacen FROM stock_vista WHERE inmovilizado = true ORDER BY almacen")
    almacenes_disp = [r[0] for r in cur.fetchall()]
    return {
        "items": items, "total": int(t[0] or 0), "valorTotal": float(t[1] or 0),
        "globalTotal": int(g[0] or 0), "globalValorTotal": float(g[1] or 0),
        "fecha_corte": fecha_corte_vista(cur).isoformat(),
        "filtros": {"centros": centros_disp, "almacenes": almacenes_disp},
    }


def _kpi_en_vivo(cur, centros, almacen, periodo_anos, limit) -> dict:
    """KPI calculado sobre las tablas crudas (SQLite dev, PG sin vista o periodo > 1 ano)."""
    corte = fecha_corte(cur)
    cond_12m = sql_inmovilizado("s")
    params_12m = params_ventana(corte)
    clave = "s.material || '-' || s.centro || '-' || s.almacen"

    cur.execute(
        f"SELECT COUNT(DISTINCT {clave}), COALESCE(SUM(s.stock_valorizado), 0) FROM stock s"
        f" WHERE s.stock > 0 AND {cond_12m}",
        params_12m,
    )
    g = cur.fetchone()

    where = ["s.stock > 0", sql_inmovilizado("s")]
    params = params_ventana(corte, VENTANA_DIAS * max(periodo_anos, 1))
    if centros:
        where.append(f"s.centro IN ({','.join(['%s'] * len(centros))})")
        params.extend(centros)
    if almacen:
        where.append("s.almacen = %s")
        params.append(almacen)
    where_sql = " AND ".join(where)

    cur.execute(
        f"""SELECT s.material, s.material_descripcion, s.lote, SUM(s.stock), SUM(s.stock_valorizado) AS valor
            FROM stock s WHERE {where_sql}
            GROUP BY s.material, s.material_descripcion, s.lote
            ORDER BY valor DESC LIMIT %s""",
        params + [int(limit)],
    )
    items = [_item_kpi(f) for f in cur.fetchall()]
    cur.execute(
        f"SELECT COUNT(DISTINCT {clave}), COALESCE(SUM(s.stock_valorizado), 0) FROM stock s WHERE {where_sql}",
        params,
    )
    t = cur.fetchone()
    cur.execute(
        f"SELECT DISTINCT s.centro FROM stock s WHERE s.stock > 0 AND {cond_12m} ORDER BY s.centro", params_12m
    )
    centros_disp = [r[0] for r in cur.fetchall()]
    cur.execute(
        f"SELECT DISTINCT s.almacen FROM stock s WHERE s.stock > 0 AND {cond_12m} ORDER BY s.almacen", params_12m
    )
    almacenes_disp = [r[0] for r in cur.fetchall()]
    return {
        "items": items, "total": int(t[0] or 0), "valorTotal": float(t[1] or 0),
        "globalTotal": int(g[0] or 0), "globalValorTotal": float(g[1] or 0),
        "fecha_corte": corte.isoformat(),
        "filtros": {"centros": centros_disp, "almacenes": almacenes_disp},
    }


def kpi_stock_inmovilizado(cur, centros=(), almacen=None, periodo_anos=0, limit=50,
                           usar_vista: bool = False) -> dict:
    """KPI de stock inmovilizado.

    Con `usar_vista` (PG con stock_vista) y ventana de 12 meses lee la vista, asi
    coincide con /api/stock y /resumen aunque la vista no se haya refrescado.
    Con periodo_anos > 1 la ventana es mayor que la de la vista: calculo en vivo.
    """
    if usar_vista and periodo_anos <= 1:
        return _kpi_desde_vista(cur, list(centros), almacen, limit)
    return _kpi_en_vivo(cur, list(centros), almacen, periodo_anos, limit)
