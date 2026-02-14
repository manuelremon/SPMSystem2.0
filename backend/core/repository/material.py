"""
Repositorio para operaciones de Material
"""

import logging
from typing import Any, Dict, List, Optional

from backend.core.repository.base import _connect, _connect_catalogo, _table_exists
from backend.core.repository.config import ConfigAlmacenesRepository

logger = logging.getLogger(__name__)


class MaterialRepository:
    """Repositorio para operaciones de Material (usa master_materiales.db)"""

    @staticmethod
    def get_info(codigo: str) -> Optional[Dict[str, Any]]:
        """Obtiene información de material desde master_materiales.db - tabla catalogo_materiales"""
        conn = _connect_catalogo()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT descripcion, precio_usd FROM catalogo_materiales WHERE codigo = ?", (codigo,)
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    @staticmethod
    def get_stock_detalle(
        codigo: str, centro: Optional[str] = None, almacen: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Obtiene detalle de stock por centro/almacén.
        Filtra almacenes excluidos y lotes excluidos según config.
        Enriquece con libre_disponibilidad y responsable desde config_almacenes.
        """
        # Obtener config de almacenes y lotes excluidos
        almacenes_config = ConfigAlmacenesRepository.get_all()
        lotes_excluidos = ConfigAlmacenesRepository.get_lotes_excluidos()

        # Crear sets para filtrado rápido
        almacenes_excluidos = {
            f"{c['centro']}_{c['almacen']}" for c in almacenes_config if c.get("excluido")
        }
        lotes_excluidos_set = {x.upper() for x in lotes_excluidos}

        # Crear mapa de config por centro_almacen
        config_map = {f"{c['centro']}_{c['almacen']}": c for c in almacenes_config}

        conn = _connect()
        rows_raw = []
        try:
            cur = conn.cursor()
            # En PostgreSQL usamos stock_detalle (view), en SQLite stock_almacenes
            if _table_exists(conn, "stock_detalle"):
                # PostgreSQL: stock_detalle tiene columna 'codigo'
                params = [codigo]
                sql = "SELECT centro, almacen, SUM(cantidad) as cantidad FROM stock_detalle WHERE codigo = ?"
                if centro:
                    sql += " AND centro = ?"
                    params.append(centro)
                if almacen:
                    sql += " AND almacen = ?"
                    params.append(almacen)
                sql += " GROUP BY centro, almacen"

                cur.execute(sql, params)
                rows_raw = [dict(row) for row in cur.fetchall()]
            elif _table_exists(conn, "stock_almacenes"):
                # SQLite fallback: stock_almacenes tiene columna 'codigo_material'
                params = [codigo]
                sql = "SELECT centro, almacen, SUM(cantidad) as cantidad FROM stock_almacenes WHERE codigo_material = ?"
                if centro:
                    sql += " AND centro = ?"
                    params.append(centro)
                if almacen:
                    sql += " AND almacen = ?"
                    params.append(almacen)
                sql += " GROUP BY centro, almacen"

                cur.execute(sql, params)
                rows_raw = [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()

        # Si no hay datos en BD, usar Excel cache
        if not rows_raw:
            from backend.core.cache_loader import get_stock_cache
            df = get_stock_cache()
            if df is not None and not df.empty:

                def _norm(val: str) -> str:
                    base = (val or "").strip()
                    if base.endswith(".0"):
                        base = base[:-2]
                    return base.lstrip("0")

                mask = df["codigo_norm"] == _norm(codigo)
                if centro:
                    mask = mask & (df["centro_norm"] == _norm(centro))
                if almacen:
                    mask = mask & (df["almacen_norm"] == _norm(almacen))
                df_filtered = df.loc[mask]
                if df_filtered.empty:
                    df_filtered = df[df["codigo_norm"] == _norm(codigo)]

                for _, r in (
                    df_filtered.groupby(["centro", "almacen"])
                    .sum(numeric_only=True)
                    .reset_index()
                    .iterrows()
                ):
                    lote_val = None
                    if "lote" in df_filtered.columns:
                        match = df_filtered[
                            (df_filtered["centro"] == r["centro"])
                            & (df_filtered["almacen"] == r["almacen"])
                        ]
                        lote_val = match["lote"].iloc[0] if not match.empty else None
                    elif "Lote" in df_filtered.columns:
                        match = df_filtered[
                            (df_filtered["centro"] == r["centro"])
                            & (df_filtered["almacen"] == r["almacen"])
                        ]
                        lote_val = match["Lote"].iloc[0] if not match.empty else None

                    rows_raw.append(
                        {
                            "centro": str(r["centro"]),
                            "almacen": str(r["almacen"]),
                            "cantidad": float(r["stock"] or 0),
                            "lote": str(lote_val) if lote_val is not None else None,
                        }
                    )

        # Filtrar y enriquecer
        result = []
        for row in rows_raw:
            centro_val = str(row.get("centro") or "").strip()
            almacen_raw = str(row.get("almacen") or "").strip()
            lote_val = (row.get("lote") or "").upper()

            # Excluir registros con centro o almacén vacío
            if not centro_val or not almacen_raw:
                continue

            almacen_val = almacen_raw.zfill(4)

            # Excluir almacenes según config
            key = f"{centro_val}_{almacen_val}"
            if key in almacenes_excluidos:
                continue

            # Excluir lotes según config
            if lote_val and lote_val in lotes_excluidos_set:
                continue

            # Enriquecer con config
            config = config_map.get(key, {})
            row["almacen"] = almacen_val
            row["libre_disponibilidad"] = bool(config.get("libre_disponibilidad", False))
            row["responsable"] = config.get("responsable_nombre")
            row["nombre_almacen"] = config.get("nombre")

            result.append(row)

        return result
