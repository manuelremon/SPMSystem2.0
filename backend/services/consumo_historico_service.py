"""
Consumo historico de materiales (Inventario): filtros, agregados y valorizacion.

Datos en `consumo_historico` (SQLite `data/sap_data.db`; en PostgreSQL es una vista
sobre `sap_consumo_historico`, misma BD que el resto). Precios en
`catalogo_materiales.precio_usd` (`master_materiales.db` / misma BD en PG).

En SQLite dev, consumo y catalogo son archivos distintos: NO se hace JOIN entre
bases, los precios se piden con una segunda consulta `WHERE codigo IN (...)`
sobre los materiales resultantes (en lotes si hace falta).
"""

from __future__ import annotations

from datetime import date, datetime

from backend.core.db import get_db_connection
from backend.core.search_utils import build_description_search

TABLA = "consumo_historico"
LIMITE_DETALLE = 25000
LOTE_PRECIOS = 500
AGRUPACIONES = {"detalle", "material"}


class FiltroInvalido(ValueError):
    """Fecha con formato invalido (la ruta la traduce a un 400)."""


def parsear_fecha(valor: str | None) -> date | None:
    """Convierte 'YYYY-MM-DD' a date. None si no hay valor; FiltroInvalido si el formato es incorrecto."""
    if not valor:
        return None
    try:
        return datetime.strptime(valor, "%Y-%m-%d").date()
    except ValueError as exc:
        raise FiltroInvalido(f"Fecha invalida: {valor}") from exc


def _valor(fila, indice: int, clave: str):
    return fila[clave] if isinstance(fila, dict) else fila[indice]


def _fecha_iso(valor) -> str | None:
    return str(valor)[:10] if valor is not None else None


# ---------------------------------------------------------------------------
# Metadatos: rango de fechas disponible y catalogos validos (centro/almacen)
# ---------------------------------------------------------------------------


def rango_datos(cur) -> dict:
    """Rango de fechas (min/max) de TODA la tabla, sin aplicar filtros."""
    cur.execute(f"SELECT MIN(fecha) AS minimo, MAX(fecha) AS maximo FROM {TABLA}")
    fila = cur.fetchone()
    if not fila:
        return {"min": None, "max": None}
    return {
        "min": _fecha_iso(_valor(fila, 0, "minimo")),
        "max": _fecha_iso(_valor(fila, 1, "maximo")),
    }


def catalogos_validos(cur) -> dict:
    """Centros y almacenes presentes en consumo_historico (para validar filtros y poblar selects)."""
    cur.execute(f"SELECT DISTINCT centro FROM {TABLA} WHERE centro IS NOT NULL ORDER BY centro")
    centros = [_valor(f, 0, "centro") for f in cur.fetchall()]
    cur.execute(f"SELECT DISTINCT almacen FROM {TABLA} WHERE almacen IS NOT NULL ORDER BY almacen")
    almacenes = [_valor(f, 0, "almacen") for f in cur.fetchall()]
    return {"centros": centros, "almacenes": almacenes}


# ---------------------------------------------------------------------------
# Filtro SQL
# ---------------------------------------------------------------------------


def construir_filtro(
    desde: date | None = None,
    hasta: date | None = None,
    centro: str | None = None,
    almacen: str | None = None,
    material: str | None = None,
) -> tuple[str, list]:
    """WHERE + params para consultas sobre `consumo_historico` (placeholders '?')."""
    clauses: list[str] = []
    params: list = []

    if desde:
        clauses.append("fecha >= ?")
        params.append(desde.isoformat())
    if hasta:
        clauses.append("fecha <= ?")
        params.append(hasta.isoformat())
    if centro:
        clauses.append("centro = ?")
        params.append(centro)
    if almacen:
        clauses.append("almacen = ?")
        params.append(almacen)
    if material:
        material = material.strip()
        sub_clauses = ["material LIKE ?"]
        sub_params = [f"%{material}%"]
        busqueda = build_description_search(material, ["descripcion"])
        if busqueda:
            sub_clauses.append(busqueda.where_clause)
            sub_params.extend(busqueda.params)
        clauses.append("(" + " OR ".join(sub_clauses) + ")")
        params.extend(sub_params)

    where_sql = " AND ".join(clauses) if clauses else "1=1"
    return where_sql, params


# ---------------------------------------------------------------------------
# Consultas sobre consumo_historico
# ---------------------------------------------------------------------------


def listar_detalle(cur, where_sql: str, params: list, limite: int | None = None):
    """Filas crudas (sin valorizar) ordenadas por fecha desc. Devuelve (filas, truncado)."""
    limite = LIMITE_DETALLE if limite is None else limite
    cur.execute(
        f"SELECT fecha, centro, almacen, material, descripcion, cantidad"
        f" FROM {TABLA} WHERE {where_sql} ORDER BY fecha DESC LIMIT ?",
        [*params, limite + 1],
    )
    filas = [dict(f) for f in cur.fetchall()]
    truncado = len(filas) > limite
    return filas[:limite], truncado


def agregados_por_material(cur, where_sql: str, params: list) -> list[dict]:
    """Una fila por material con movimientos/cantidad/primer-ultimo consumo (sin truncar)."""
    cur.execute(
        f"""
        SELECT material, MAX(descripcion) AS descripcion, COUNT(*) AS movimientos,
               COALESCE(SUM(cantidad), 0) AS cantidad_total,
               MIN(fecha) AS primer_consumo, MAX(fecha) AS ultimo_consumo
        FROM {TABLA}
        WHERE {where_sql}
        GROUP BY material
        """,
        params,
    )
    return [dict(f) for f in cur.fetchall()]


def agregados_mensuales_por_material(cur, where_sql: str, params: list) -> list[dict]:
    """Cantidad/movimientos por (mes, material), base para el grafico mensual valorizado."""
    mes_expr = "SUBSTR(CAST(fecha AS TEXT), 1, 7)"
    cur.execute(
        f"SELECT {mes_expr} AS mes, material, COUNT(*) AS movimientos,"
        f" COALESCE(SUM(cantidad), 0) AS cantidad"
        f" FROM {TABLA} WHERE {where_sql} GROUP BY mes, material",
        params,
    )
    return [dict(f) for f in cur.fetchall()]


# ---------------------------------------------------------------------------
# Precios (BD distinta: master_materiales)
# ---------------------------------------------------------------------------


def obtener_precios(codigos, conn_factory=None) -> dict:
    """{codigo: (precio_usd | None, unidad_medida | None)} para los codigos dados, en lotes."""
    factory = conn_factory or get_db_connection
    codigos_unicos = sorted({c for c in codigos if c})
    precios: dict[str, tuple] = {}
    if not codigos_unicos:
        return precios

    with factory("master_materiales") as conn:
        cur = conn.cursor()
        for inicio in range(0, len(codigos_unicos), LOTE_PRECIOS):
            lote = codigos_unicos[inicio:inicio + LOTE_PRECIOS]
            placeholders = ", ".join("?" for _ in lote)
            cur.execute(
                f"SELECT codigo, precio_usd, unidad_medida FROM catalogo_materiales"
                f" WHERE codigo IN ({placeholders})",
                lote,
            )
            for fila in cur.fetchall():
                codigo = _valor(fila, 0, "codigo")
                precio = _valor(fila, 1, "precio_usd")
                unidad = _valor(fila, 2, "unidad_medida")
                precios[codigo] = (float(precio) if precio is not None else None, unidad)

    return precios


# ---------------------------------------------------------------------------
# Ensamblado de la respuesta
# ---------------------------------------------------------------------------


def construir_detalle_valorizado(filas: list[dict], precios: dict) -> list[dict]:
    resultado = []
    for fila in filas:
        precio, unidad = precios.get(fila["material"], (None, None))
        cantidad = float(fila["cantidad"] or 0)
        resultado.append({
            "fecha": _fecha_iso(fila["fecha"]),
            "centro": fila["centro"],
            "almacen": fila["almacen"],
            "material": fila["material"],
            "descripcion": fila["descripcion"],
            "cantidad": cantidad,
            "unidad": unidad,
            "precio_usd": precio,
            "valor_usd": (cantidad * precio) if precio is not None else None,
        })
    return resultado


def construir_por_material(filas: list[dict], precios: dict) -> list[dict]:
    resultado = []
    for fila in filas:
        precio, unidad = precios.get(fila["material"], (None, None))
        cantidad_total = float(fila["cantidad_total"] or 0)
        valor_usd = (cantidad_total * precio) if precio is not None else None
        resultado.append({
            "material": fila["material"],
            "descripcion": fila["descripcion"],
            "unidad": unidad,
            "movimientos": int(fila["movimientos"] or 0),
            "cantidad_total": cantidad_total,
            "primer_consumo": _fecha_iso(fila["primer_consumo"]),
            "ultimo_consumo": _fecha_iso(fila["ultimo_consumo"]),
            "precio_usd": precio,
            "valor_usd": valor_usd,
        })
    # Orden por valor desc; los nulos (sin precio) al final.
    resultado.sort(key=lambda r: (r["valor_usd"] is None, -(r["valor_usd"] or 0)))
    return resultado


def construir_mensual(filas_mensuales: list[dict], precios: dict) -> list[dict]:
    por_mes: dict[str, dict] = {}
    for fila in filas_mensuales:
        mes = fila["mes"]
        agregado = por_mes.setdefault(mes, {"mes": mes, "movimientos": 0, "cantidad": 0.0, "valor_usd": 0.0})
        cantidad = float(fila["cantidad"] or 0)
        agregado["movimientos"] += int(fila["movimientos"] or 0)
        agregado["cantidad"] += cantidad
        precio = precios.get(fila["material"], (None, None))[0]
        if precio is not None:
            agregado["valor_usd"] += cantidad * precio
    return [por_mes[mes] for mes in sorted(por_mes)]


def construir_resumen(material_valorizado: list[dict], desde: date | None, hasta: date | None) -> dict:
    movimientos = sum(r["movimientos"] for r in material_valorizado)
    cantidad_total = sum(r["cantidad_total"] for r in material_valorizado)
    valor_usd = sum(r["valor_usd"] for r in material_valorizado if r["valor_usd"] is not None)
    return {
        "movimientos": movimientos,
        "cantidad_total": cantidad_total,
        "materiales": len(material_valorizado),
        "valor_usd": valor_usd,
        "desde": desde.isoformat() if desde else None,
        "hasta": hasta.isoformat() if hasta else None,
    }


def obtener_consumo(
    cur,
    desde: date | None = None,
    hasta: date | None = None,
    centro: str | None = None,
    almacen: str | None = None,
    material: str | None = None,
    agrupar: str = "detalle",
    conn_factory=None,
) -> dict:
    """Arma la respuesta completa del endpoint (resumen, mensual, rango_datos y data)."""
    where_sql, params = construir_filtro(desde, hasta, centro, almacen, material)

    filas_material = agregados_por_material(cur, where_sql, params)
    filas_mensuales = agregados_mensuales_por_material(cur, where_sql, params)

    codigos = {f["material"] for f in filas_material}
    precios = obtener_precios(codigos, conn_factory=conn_factory)

    material_valorizado = construir_por_material(filas_material, precios)
    resultado = {
        "resumen": construir_resumen(material_valorizado, desde, hasta),
        "mensual": construir_mensual(filas_mensuales, precios),
        "rango_datos": rango_datos(cur),
    }

    if agrupar == "material":
        resultado["data"] = material_valorizado
        resultado["truncado"] = False
    else:
        filas_detalle, truncado = listar_detalle(cur, where_sql, params)
        resultado["data"] = construir_detalle_valorizado(filas_detalle, precios)
        resultado["truncado"] = truncado

    return resultado
