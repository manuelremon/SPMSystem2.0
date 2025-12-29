"""
Planner Data Loaders - Funciones para cargar datos de stock, consumo, etc.
"""

import logging
from pathlib import Path

import pandas as pd

from backend.core.db import get_db_connection
from backend.routes.planner_helpers.helpers import _norm_codigo, _table_exists

logger = logging.getLogger(__name__)

# Caches globales
_STOCK_XLS_CACHE = None
_EQUIV_XLS_CACHE = None
_CONSUMO_XLS_CACHE = None


def _load_stock_db():
    """Lee stock desde sap_data.db tabla 'stock'."""
    global _STOCK_XLS_CACHE
    if _STOCK_XLS_CACHE is not None:
        return _STOCK_XLS_CACHE

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT material as codigo, centro, almacen, lote, stock
                FROM stock WHERE stock > 0
            """
            )
            rows = [dict(row) for row in cur.fetchall()]
        # Pre-normalizar códigos para búsqueda rápida
        for r in rows:
            r["codigo_norm"] = _norm_codigo(r.get("codigo", ""))
            r["centro_norm"] = _norm_codigo(r.get("centro", ""))
            r["almacen_norm"] = _norm_codigo(r.get("almacen", ""))
        _STOCK_XLS_CACHE = rows
        return _STOCK_XLS_CACHE
    except Exception:
        _STOCK_XLS_CACHE = []
        return _STOCK_XLS_CACHE


# Alias para compatibilidad
def _load_stock_xlsx():
    return _load_stock_db()


def _load_equivalencias_catalogo():
    """Carga equivalencias desde docs/equivalencias_total_normalizado.xlsx"""
    global _EQUIV_XLS_CACHE
    if _EQUIV_XLS_CACHE is not None:
        return _EQUIV_XLS_CACHE
    path = Path("docs/equivalencias_total_normalizado.xlsx")
    if not path.exists():
        _EQUIV_XLS_CACHE = pd.DataFrame()
        return _EQUIV_XLS_CACHE
    df = pd.read_excel(path, sheet_name="Sheet1")
    df = df.rename(
        columns={
            "Material_base": "codigo_base",
            "Texto_breve_base": "descripcion_base",
            "Material_equivalente": "codigo_equivalente",
            "Texto_breve_equivalente": "descripcion_equivalente",
            "Tipo_equiv": "tipo_equiv",
            "Criterio": "criterio",
            "Motivo_equivalencia": "motivo",
        }
    )
    df["codigo_base_norm"] = df["codigo_base"].astype(str).map(_norm_codigo)
    df["codigo_equivalente_norm"] = df["codigo_equivalente"].astype(str).map(_norm_codigo)
    _EQUIV_XLS_CACHE = df
    return _EQUIV_XLS_CACHE


def _stock_disponible(codigo: str, centro: str = None, almacen: str = None, stock_df=None) -> float:
    """Obtiene stock disponible priorizando tabla stock_almacenes; cae a sap_data.db si no existe."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='stock_almacenes'"
            )
            if cur.fetchone():
                params = [_norm_codigo(codigo)]
                sql = "SELECT COALESCE(SUM(cantidad),0) FROM stock_almacenes WHERE codigo_material = ?"
                if centro:
                    sql += " AND centro = ?"
                    params.append(centro)
                if almacen:
                    sql += " AND almacen = ?"
                    params.append(almacen)
                cur.execute(sql, params)
                row = cur.fetchone()
                if row is not None:
                    val = row["cantidad"] if isinstance(row, dict) else row[0]
                    return float(val or 0)
    except Exception:
        pass

    # Fallback a sap_data.db
    stock_rows = stock_df if stock_df is not None else _load_stock_db()
    if not stock_rows:
        return 0.0

    codigo_norm = _norm_codigo(codigo)
    centro_norm = _norm_codigo(centro) if centro else None
    almacen_norm = _norm_codigo(almacen) if almacen else None

    total = 0.0
    for r in stock_rows:
        if r.get("codigo_norm") != codigo_norm:
            continue
        if centro_norm and r.get("centro_norm") != centro_norm:
            continue
        if almacen_norm and r.get("almacen_norm") != almacen_norm:
            continue
        total += float(r.get("stock") or 0)
    return total


def _rankear_proveedores(cur, cantidad: float, precio_unitario: float):
    """
    Retorna proveedores externos ordenados por score (costo+plazo+calificación).
    """
    cur.execute(
        """
        SELECT
            pe.cuit,
            pe.nombre,
            pe.lead_time_dias,
            pe.calificacion,
            pe.rubro,
            pe.origen,
            (SELECT email FROM proveedor_ext_emails
             WHERE cuit_proveedor = pe.cuit AND es_principal = 1
             LIMIT 1) as email_principal
        FROM proveedores_externos pe
        WHERE pe.activo = 1
        """
    )
    proveedores = cur.fetchall() or []
    ranked = []

    # Mapeo de calificación a score numérico (0-5 escala)
    CALIFICACION_SCORE = {
        "cumplidor": 5.0,
        "sin_calificar": 2.5,
        "incumplidor": 1.0,
    }

    for prov in proveedores:
        plazo = prov["lead_time_dias"] or 30
        calificacion = prov["calificacion"] or "sin_calificar"
        rating = CALIFICACION_SCORE.get(calificacion, 2.5)
        costo_total = (precio_unitario or 0) * (cantidad or 0)

        score = (
            (100 / (1 + costo_total)) * 0.4 + (100 / (1 + plazo)) * 0.4 + (rating / 5 * 100) * 0.2
        )
        ranked.append(
            {
                "id_proveedor": prov["cuit"],
                "cuit": prov["cuit"],
                "nombre": prov["nombre"],
                "lead_time_dias": plazo,
                "calificacion": calificacion,
                "rubro": prov["rubro"],
                "origen": prov["origen"],
                "email": prov["email_principal"],
                "score": score,
                "costo_total": costo_total,
            }
        )

    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked


def _load_consumo_db():
    """Carga consumo histórico desde sap_data.db tabla 'consumo_historico'."""
    global _CONSUMO_XLS_CACHE
    if _CONSUMO_XLS_CACHE is not None:
        return _CONSUMO_XLS_CACHE

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT material as codigo, centro, almacen, cantidad, fecha, descripcion
                FROM consumo_historico
                ORDER BY fecha DESC
            """
            )
            rows = [dict(row) for row in cur.fetchall()]
        for r in rows:
            r["codigo_norm"] = _norm_codigo(r.get("codigo", ""))
            r["centro_norm"] = _norm_codigo(r.get("centro", ""))
            r["almacen_norm"] = _norm_codigo(r.get("almacen", ""))
        _CONSUMO_XLS_CACHE = rows
        return _CONSUMO_XLS_CACHE
    except Exception:
        _CONSUMO_XLS_CACHE = []
        return _CONSUMO_XLS_CACHE


# Alias para compatibilidad
def _load_consumo_stock():
    return _load_consumo_db()


def _get_consumo_sql(codigo: str, centro: str = None, almacen: str = None) -> tuple:
    """
    OPTIMIZACIÓN PERF-006: Consulta consumo filtrado directamente en SQL.
    Returns:
        tuple: (consumo_total, consumo_promedio_anual)
    """
    codigo_norm = _norm_codigo(codigo)
    if not codigo_norm:
        return None, None

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            where_sql = "WHERE material LIKE ?"
            params = [f"%{codigo_norm}%"]

            if centro:
                where_sql += " AND centro = ?"
                params.append(centro)
            if almacen:
                where_sql += " AND almacen = ?"
                params.append(almacen)

            cur.execute(
                f"""
                SELECT
                    COALESCE(SUM(cantidad), 0) as total,
                    MIN(substr(fecha, 1, 4)) as anio_min,
                    MAX(substr(fecha, 1, 4)) as anio_max
                FROM consumo_historico
                {where_sql}
                AND fecha IS NOT NULL
                """,
                params,
            )
            row = cur.fetchone()

            if not row or row["total"] == 0:
                return None, None

            total = float(row["total"])
            try:
                anio_min = int(row["anio_min"]) if row["anio_min"] else None
                anio_max = int(row["anio_max"]) if row["anio_max"] else None
                if anio_min and anio_max and anio_min > 2000:
                    n_anios = max(1, anio_max - anio_min + 1)
                    return total, total / n_anios
            except (ValueError, TypeError):
                pass

            return total, None

    except Exception:
        return None, None


def _calcular_consumo_promedio(consumo_rows, codigo_norm, centro_norm, almacen_norm):
    """Calcula consumo total y promedio anual para un material/centro/almacen."""
    if not consumo_rows:
        return None, None

    filtered = [
        r
        for r in consumo_rows
        if r.get("codigo_norm") == codigo_norm
        and r.get("centro_norm") == centro_norm
        and r.get("almacen_norm") == almacen_norm
        and r.get("fecha")
    ]

    if not filtered:
        return None, None

    total = 0.0
    years = set()
    for r in filtered:
        total += float(r.get("cantidad") or 0)
        try:
            year = int(str(r.get("fecha", ""))[:4])
            if year > 2000:
                years.add(year)
        except (ValueError, TypeError):
            pass

    if not years:
        return total, None

    n_anios = max(years) - min(years) + 1
    return total, total / n_anios if n_anios > 0 else None


def _stock_detalle(codigo: str, centro: str = None, almacen: str = None, stock_df=None):
    """Detalle por centro/almacén del stock disponible."""
    detalle = []
    codigo_norm = _norm_codigo(codigo)
    centro_norm = _norm_codigo(centro) if centro else None
    almacen_norm = _norm_codigo(almacen) if almacen else None

    # Primero intentar tabla stock_almacenes en spm.db
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='stock_almacenes'"
            )
            if cur.fetchone():
                params = [codigo_norm]
                sql = "SELECT centro, almacen, SUM(cantidad) as cantidad FROM stock_almacenes WHERE codigo_material=?"
                if centro:
                    sql += " AND centro=?"
                    params.append(centro)
                if almacen:
                    sql += " AND almacen=?"
                    params.append(almacen)
                sql += " GROUP BY centro, almacen"
                cur.execute(sql, params)
                for row in cur.fetchall() or []:
                    if isinstance(row, dict):
                        r_centro = row["centro"]
                        r_almacen = row["almacen"]
                        r_cantidad = row["cantidad"]
                    else:
                        r_centro = row[0]
                        r_almacen = row[1]
                        r_cantidad = row[2]
                    consumo_total, consumo_prom = _get_consumo_sql(codigo, r_centro, r_almacen)
                    detalle.append(
                        {
                            "centro": r_centro,
                            "almacen": r_almacen,
                            "cantidad": float(r_cantidad or 0),
                            "consumo_total": consumo_total,
                            "consumo_promedio": consumo_prom,
                            "libre_disponibilidad": str(r_almacen) in ("0100", "9999"),
                        }
                    )
                return detalle
    except Exception:
        pass

    # Fallback a sap_data.db
    stock_rows = stock_df if stock_df is not None else _load_stock_db()
    if not stock_rows:
        return detalle

    # Filtrar por material
    filtered = [r for r in stock_rows if r.get("codigo_norm") == codigo_norm]
    if centro_norm:
        filtered = [r for r in filtered if r.get("centro_norm") == centro_norm]
    if almacen_norm:
        filtered = [r for r in filtered if r.get("almacen_norm") == almacen_norm]

    # Si no hay resultado para centro/almacen solicitado, mostrar todos
    if not filtered:
        filtered = [r for r in stock_rows if r.get("codigo_norm") == codigo_norm]

    # Agrupar por centro/almacen
    grouped = {}
    for r in filtered:
        key = (r.get("centro"), r.get("almacen"))
        if key not in grouped:
            grouped[key] = 0.0
        grouped[key] += float(r.get("stock") or 0)

    for (c, a), stock_val in grouped.items():
        consumo_total, consumo_prom = _get_consumo_sql(codigo, c, a)
        detalle.append(
            {
                "centro": c,
                "almacen": a,
                "cantidad": stock_val,
                "consumo_total": consumo_total,
                "consumo_promedio": consumo_prom,
                "libre_disponibilidad": str(a) in ("0100", "9999"),
            }
        )

    return detalle
