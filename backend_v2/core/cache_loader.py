"""
Cache centralizado para datos de Excel
Encapsula carga y caché en memoria de stock, equivalencias y consumo
Permite sustitución futura por tablas BD sin cambiar interfaz
"""

from pathlib import Path
from typing import Optional

import pandas as pd


class ExcelCacheLoader:
    """Gestor de caches Excel con API simple"""

    def __init__(self):
        self._stock_cache: Optional[pd.DataFrame] = None
        self._equivalencias_cache: Optional[pd.DataFrame] = None
        self._consumo_cache: Optional[pd.DataFrame] = None

    @staticmethod
    def _norm_codigo(val: str) -> str:
        """Normaliza código de material (elimina ceros, decimales)"""
        base = (val or "").strip()
        if base.endswith(".0"):
            base = base[:-2]
        return base.lstrip("0")

    def load_stock(self) -> pd.DataFrame:
        """Carga stock desde backend_v2/stock.xlsx"""
        if self._stock_cache is not None:
            return self._stock_cache

        path = Path("backend_v2/stock.xlsx")
        if not path.exists():
            self._stock_cache = pd.DataFrame()
            return self._stock_cache

        df = pd.read_excel(path, dtype=str)
        df = df.rename(
            columns={
                "Material": "codigo",
                "Centro": "centro",
                "Almacén": "almacen",
                "Stock": "stock",
            }
        )
        df["stock"] = pd.to_numeric(df.get("stock", 0), errors="coerce").fillna(0).astype(float)
        df["codigo_norm"] = df["codigo"].astype(str).apply(self._norm_codigo)
        df["centro_norm"] = df["centro"].astype(str).apply(self._norm_codigo)
        df["almacen_norm"] = df["almacen"].astype(str).apply(self._norm_codigo)

        self._stock_cache = df
        return self._stock_cache

    def load_equivalencias(self) -> pd.DataFrame:
        """Carga equivalencias desde docs/equivalencias_total_normalizado.xlsx"""
        if self._equivalencias_cache is not None:
            return self._equivalencias_cache

        path = Path("docs/equivalencias_total_normalizado.xlsx")
        if not path.exists():
            self._equivalencias_cache = pd.DataFrame()
            return self._equivalencias_cache

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
        df["codigo_base_norm"] = df["codigo_base"].astype(str).apply(self._norm_codigo)
        df["codigo_equivalente_norm"] = (
            df["codigo_equivalente"].astype(str).apply(self._norm_codigo)
        )

        self._equivalencias_cache = df
        return self._equivalencias_cache

    def load_consumo(self) -> pd.DataFrame:
        """Carga consumo histórico desde docs/consumo historico.xlsx"""
        if self._consumo_cache is not None:
            return self._consumo_cache

        path = Path("docs/consumo historico.xlsx")
        if not path.exists():
            self._consumo_cache = pd.DataFrame()
            return self._consumo_cache

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
        df["cantidad"] = (
            pd.to_numeric(df.get("cantidad", 0), errors="coerce").fillna(0).astype(float)
        )
        df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
        df["codigo_norm"] = df["codigo"].astype(str).apply(self._norm_codigo)
        df["centro_norm"] = df["centro"].astype(str).apply(self._norm_codigo)
        df["almacen_norm"] = df["almacen"].astype(str).apply(self._norm_codigo)

        self._consumo_cache = df
        return self._consumo_cache

    def clear_all(self):
        """Limpia todos los caches (para tests o recargas)"""
        self._stock_cache = None
        self._equivalencias_cache = None
        self._consumo_cache = None


# Instancia global única
_loader = ExcelCacheLoader()


def get_stock_cache() -> pd.DataFrame:
    """API global para obtener cache de stock"""
    return _loader.load_stock()


def get_equivalencias_cache() -> pd.DataFrame:
    """API global para obtener cache de equivalencias"""
    return _loader.load_equivalencias()


def get_consumo_cache() -> pd.DataFrame:
    """API global para obtener cache de consumo"""
    return _loader.load_consumo()


def clear_cache():
    """API global para limpiar caches"""
    _loader.clear_all()
