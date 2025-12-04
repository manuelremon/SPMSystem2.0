import sqlite3
from pathlib import Path

import pandas as pd
from flask import Blueprint, jsonify, request

try:
    from backend_v2.core.config import settings
except ImportError:
    from core.config import settings

bp_detalle = Blueprint("materiales_detalle", __name__, url_prefix="/api/materiales")

_STOCK_CACHE = None
_PEDIDOS_CACHE = None
_MRP_CACHE = None
_CONSUMO_CACHE = None


def _db_path() -> Path:
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _load_stock():
    global _STOCK_CACHE
    if _STOCK_CACHE is not None:
        return _STOCK_CACHE
    path = Path("backend_v2/stock.xlsx")
    if not path.exists():
        _STOCK_CACHE = pd.DataFrame()
        return _STOCK_CACHE
    df = pd.read_excel(path, dtype=str)
    # Normaliza nombres
    df = df.rename(
        columns={
            "Material": "codigo",
            "Centro": "centro",
            "Almac\u00e9n": "almacen",
            "Stock": "stock",
        }
    )
    # Asegura num\u00e9ricos
    df["stock"] = pd.to_numeric(df.get("stock", 0), errors="coerce").fillna(0)
    _STOCK_CACHE = df
    return _STOCK_CACHE


def _load_pedidos():
    global _PEDIDOS_CACHE
    if _PEDIDOS_CACHE is not None:
        return _PEDIDOS_CACHE
    path = Path("backend_v2/Copia de ZPEN ME2M SAP.xlsx")
    if not path.exists():
        _PEDIDOS_CACHE = pd.DataFrame()
        return _PEDIDOS_CACHE
    df = pd.read_excel(path, dtype=str)
    df = df.rename(
        columns={
            "MATERIAL": "codigo",
            "Centro": "centro",
            "Almacen": "almacen",
            "SALDO PEND": "saldo",
        }
    )
    df["saldo"] = pd.to_numeric(df.get("saldo", 0), errors="coerce").fillna(0)
    _PEDIDOS_CACHE = df
    return _PEDIDOS_CACHE


def _load_mrp():
    """Carga parámetros de reposición (MRP) desde docs/BBDD.xlsx"""
    global _MRP_CACHE
    if _MRP_CACHE is not None:
        return _MRP_CACHE
    path = Path("docs/BBDD.xlsx")
    if not path.exists():
        _MRP_CACHE = pd.DataFrame()
        return _MRP_CACHE
    df = pd.read_excel(path, sheet_name="BBDD", dtype=str)
    df = df.rename(
        columns={
            "Codigo Material": "codigo",
            "Centro": "centro",
            "Almacen": "almacen",
            "Sector": "sector",
            "Stock de seguridad": "stock_seguridad",
            "Punto de pedido": "punto_pedido",
            "Stock maximo": "stock_maximo",
        }
    )
    for col in ["stock_seguridad", "punto_pedido", "stock_maximo"]:
        df[col] = pd.to_numeric(df.get(col, 0), errors="coerce").fillna(0)
    _MRP_CACHE = df
    return _MRP_CACHE


def _load_consumo():
    """Carga consumo histórico desde docs/consumo historico.xlsx"""
    global _CONSUMO_CACHE
    if _CONSUMO_CACHE is not None:
        return _CONSUMO_CACHE
    path = Path("docs/consumo historico.xlsx")
    if not path.exists():
        _CONSUMO_CACHE = pd.DataFrame()
        return _CONSUMO_CACHE
    df = pd.read_excel(path, sheet_name="consumo historico")
    df = df.rename(
        columns={
            "Material": "codigo",
            "Centro": "centro",
            "Almacen": "almacen",
            "Cantidad": "cantidad",
            "Fecha": "fecha",
            "Descripcion": "descripcion",
        }
    )
    df["cantidad"] = pd.to_numeric(df.get("cantidad", 0), errors="coerce").fillna(0)
    df["fecha"] = pd.to_datetime(df.get("fecha"), errors="coerce")
    _CONSUMO_CACHE = df
    return _CONSUMO_CACHE


@bp_detalle.route("/<codigo>/detalle", methods=["GET"])
def detalle_material(codigo):
    codigo = str(codigo)
    centro_param = (request.args.get("centro") or "").strip()
    almacen_param = (request.args.get("almacen") or "").strip()
    detalle = _detalle_db(codigo)

    stock_df = _load_stock()
    pedidos_df = _load_pedidos()

    stock_total = 0
    stock_detalle = []
    stock_detalle_full = []
    pedidos_total = 0
    mrp_data = None
    consumo_data = None

    def _norm(val: str) -> str:
        return (val or "").strip().lstrip("0")

    if not stock_df.empty:
        df = stock_df.copy()
        df["codigo_norm"] = df["codigo"].map(_norm)
        mask = df["codigo_norm"] == _norm(codigo)

        df["centro_norm"] = df["centro"].map(_norm)
        df["almacen_norm"] = df["almacen"].map(_norm)

        if centro_param:
            mask_centro = mask & (df["centro_norm"] == _norm(centro_param))
        else:
            mask_centro = mask

        if almacen_param:
            mask = mask & (df["almacen_norm"] == _norm(almacen_param))
            mask_centro = mask_centro & (df["almacen_norm"] == _norm(almacen_param))

        stock_total = float(df.loc[mask, "stock"].sum())

        # Detalle por centro/almacen (centrado en el centro solicitado)
        cols = ["centro", "almacen", "lote", "stock"]
        if set(cols).issubset(df.columns):
            stock_detalle = (
                df.loc[mask_centro, cols]
                .fillna({"lote": ""})
                .rename(columns={"almacen": "almacen_consultado"})
                .to_dict(orient="records")
            )
            stock_detalle_full = (
                df.loc[mask, cols]
                .fillna({"lote": ""})
                .rename(columns={"almacen": "almacen_consultado"})
                .to_dict(orient="records")
            )
        else:
            stock_detalle = (
                df.loc[mask_centro, ["centro", "almacen", "stock"]]
                .rename(columns={"almacen": "almacen_consultado"})
                .to_dict(orient="records")
            )
            stock_detalle_full = (
                df.loc[mask, ["centro", "almacen", "stock"]]
                .rename(columns={"almacen": "almacen_consultado"})
                .to_dict(orient="records")
            )

    if not pedidos_df.empty:
        dfp = pedidos_df.copy()
        dfp["codigo_norm"] = dfp["codigo"].map(_norm)
        maskp = dfp["codigo_norm"] == _norm(codigo)
        if centro_param:
            dfp["centro_norm"] = dfp["centro"].map(_norm)
            maskp = maskp & (dfp["centro_norm"] == _norm(centro_param))
        if almacen_param:
            dfp["almacen_norm"] = dfp["almacen"].map(_norm)
            maskp = maskp & (dfp["almacen_norm"] == _norm(almacen_param))
        pedidos_total = float(dfp.loc[maskp, "saldo"].sum())

    # Parámetros MRP (reposicion automática)
    mrp_df = _load_mrp()
    if not mrp_df.empty:
        dfm = mrp_df.copy()
        dfm["codigo_norm"] = dfm["codigo"].map(_norm)
        maskm = dfm["codigo_norm"] == _norm(codigo)
        if centro_param:
            dfm["centro_norm"] = dfm["centro"].map(_norm)
            maskm = maskm & (dfm["centro_norm"] == _norm(centro_param))
        if almacen_param:
            dfm["almacen_norm"] = dfm["almacen"].map(_norm)
            maskm = maskm & (dfm["almacen_norm"] == _norm(almacen_param))
        row = dfm.loc[maskm].head(1)
        if not row.empty:
            r = row.iloc[0]
            mrp_data = {
                "planificado_mrp": True,
                "sector": r.get("sector"),
                "stock_seguridad": float(r.get("stock_seguridad", 0) or 0),
                "punto_pedido": float(r.get("punto_pedido", 0) or 0),
                "stock_maximo": float(r.get("stock_maximo", 0) or 0),
                "centro": r.get("centro"),
                "almacen": r.get("almacen"),
            }

    # Consumo histórico
    consumo_df = _load_consumo()
    if not consumo_df.empty:
        dfc = consumo_df.copy()
        dfc["codigo_norm"] = dfc["codigo"].astype(str).map(_norm)
        maskc_base = dfc["codigo_norm"] == _norm(codigo)

        def _filtrar(mask_extra):
            subset_local = dfc.loc[mask_extra].copy()
            if subset_local.empty:
                return None
            subset_local = subset_local.dropna(subset=["fecha"])
            subset_local["anio"] = subset_local["fecha"].dt.year
            total_consumo_local = float(subset_local["cantidad"].sum())
            if subset_local["anio"].empty:
                anios_local = 1
            else:
                anios_local = max(1, subset_local["anio"].max() - subset_local["anio"].min() + 1)
            promedio_anual_local = total_consumo_local / anios_local
            return {
                "total": total_consumo_local,
                "promedio_anual": promedio_anual_local,
                "anio_desde": (
                    int(subset_local["anio"].min()) if not subset_local["anio"].empty else None
                ),
                "anio_hasta": (
                    int(subset_local["anio"].max()) if not subset_local["anio"].empty else None
                ),
                "registros": subset_local.sort_values(by="fecha", ascending=False)
                .head(5)[["fecha", "cantidad", "centro", "almacen"]]
                .assign(fecha=lambda x: x["fecha"].dt.strftime("%Y-%m-%d"))
                .to_dict(orient="records"),
            }

        mask_full = maskc_base.copy()
        if centro_param:
            dfc["centro_norm"] = dfc["centro"].astype(str).map(_norm)
            mask_full = mask_full & (dfc["centro_norm"] == _norm(centro_param))
        if almacen_param:
            dfc["almacen_norm"] = dfc["almacen"].astype(str).map(_norm)
            mask_full = mask_full & (dfc["almacen_norm"] == _norm(almacen_param))

        consumo_data = _filtrar(mask_full)

        # Si no hay registros para centro+almacen, relajamos a solo centro
        if consumo_data is None and centro_param:
            mask_centro = maskc_base & (dfc["centro"].astype(str).map(_norm) == _norm(centro_param))
            consumo_data = _filtrar(mask_centro)

        # Si sigue vacio, tomamos consumo global por material
        if consumo_data is None:
            consumo_data = _filtrar(maskc_base)

    detalle.update(
        {
            "stock_total": stock_total,
            "stock_detalle": stock_detalle,
            "stock_detalle_full": stock_detalle_full,
            "pedidos_en_curso": pedidos_total,
            "centro_consultado": centro_param or None,
            "almacen_consultado": almacen_param or None,
            "mrp": mrp_data
            or {
                "planificado_mrp": False,
                "stock_seguridad": None,
                "punto_pedido": None,
                "stock_maximo": None,
                "sector": None,
            },
            "consumo": consumo_data
            or {
                "total": 0,
                "promedio_anual": None,
                "anio_desde": None,
                "anio_hasta": None,
                "registros": [],
            },
        }
    )
    return jsonify(detalle), 200


def _detalle_db(codigo: str) -> dict:
    path = _db_path()
    if not path.exists():
        return {}
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        "SELECT codigo, descripcion, descripcion_larga, unidad, precio_usd FROM materiales WHERE codigo=?",
        (codigo,),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return {}
    return dict(row)
