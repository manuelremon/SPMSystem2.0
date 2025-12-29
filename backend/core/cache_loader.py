"""
Cache centralizado para datos de SAP
Encapsula carga y caché en memoria de stock, equivalencias y consumo
Fuente: sap_data.db (migrado desde Excel)

FIX 4.3: Añadido TTL para invalidar cache automáticamente
"""

from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd

# FIX 4.3: TTL por defecto para cache (60 minutos)
DEFAULT_CACHE_TTL_MINUTES = 60

try:
    from backend.core.db import get_db_connection
except ImportError:
    from core.db import get_db_connection


class DataCacheLoader:
    """Gestor de caches con API simple - usa sap_data.db

    FIX 4.3: Ahora con soporte de TTL para invalidación automática
    """

    def __init__(self, ttl_minutes: int = DEFAULT_CACHE_TTL_MINUTES):
        self._stock_cache: Optional[pd.DataFrame] = None
        self._equivalencias_cache: Optional[pd.DataFrame] = None
        self._consumo_cache: Optional[pd.DataFrame] = None
        # FIX 4.3: Timestamps para TTL
        self._stock_cache_time: Optional[datetime] = None
        self._equivalencias_cache_time: Optional[datetime] = None
        self._consumo_cache_time: Optional[datetime] = None
        self._ttl = timedelta(minutes=ttl_minutes)

    def _is_cache_valid(self, cache_time: Optional[datetime]) -> bool:
        """FIX 4.3: Verifica si el cache sigue válido según TTL"""
        if cache_time is None:
            return False
        return datetime.now() - cache_time < self._ttl

    @staticmethod
    def _norm_codigo(val: str) -> str:
        """Normaliza código de material (elimina ceros, decimales)"""
        base = (val or "").strip()
        if base.endswith(".0"):
            base = base[:-2]
        return base.lstrip("0")

    def load_stock(self) -> pd.DataFrame:
        """Carga stock desde sap_data.db tabla 'stock'"""
        # FIX 4.3: Verificar TTL antes de retornar cache
        if self._stock_cache is not None and self._is_cache_valid(self._stock_cache_time):
            return self._stock_cache

        try:
            with get_db_connection("sap_data") as conn:
                df = pd.read_sql_query(
                    """
                    SELECT
                        material as codigo,
                        centro,
                        almacen,
                        lote,
                        stock
                    FROM stock
                    WHERE stock > 0
                    """,
                    conn,
                )

            # Asegurar tipos correctos
            df["stock"] = pd.to_numeric(df["stock"], errors="coerce").fillna(0).astype(float)
            df["codigo_norm"] = df["codigo"].astype(str).apply(self._norm_codigo)
            df["centro_norm"] = df["centro"].astype(str).apply(self._norm_codigo)
            df["almacen_norm"] = df["almacen"].astype(str).apply(self._norm_codigo)

            self._stock_cache = df
            self._stock_cache_time = datetime.now()  # FIX 4.3
            return self._stock_cache

        except Exception:
            self._stock_cache = pd.DataFrame()
            self._stock_cache_time = datetime.now()  # FIX 4.3
            return self._stock_cache

    def load_equivalencias(self) -> pd.DataFrame:
        """Carga equivalencias desde docs/equivalencias_total_normalizado.xlsx"""
        # FIX 4.3: Verificar TTL
        if self._equivalencias_cache is not None and self._is_cache_valid(self._equivalencias_cache_time):
            return self._equivalencias_cache

        path = Path("docs/equivalencias_total_normalizado.xlsx")
        if not path.exists():
            self._equivalencias_cache = pd.DataFrame()
            self._equivalencias_cache_time = datetime.now()  # FIX 4.3
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
        self._equivalencias_cache_time = datetime.now()  # FIX 4.3
        return self._equivalencias_cache

    def load_consumo(self) -> pd.DataFrame:
        """Carga consumo histórico desde sap_data.db tabla 'consumo_historico'"""
        # FIX 4.3: Verificar TTL
        if self._consumo_cache is not None and self._is_cache_valid(self._consumo_cache_time):
            return self._consumo_cache

        try:
            with get_db_connection("sap_data") as conn:
                df = pd.read_sql_query(
                    """
                    SELECT
                        material as codigo,
                        centro,
                        almacen,
                        cantidad,
                        fecha,
                        descripcion
                    FROM consumo_historico
                    ORDER BY fecha DESC
                    """,
                    conn,
                )

            # Asegurar tipos correctos
            df["cantidad"] = pd.to_numeric(df["cantidad"], errors="coerce").fillna(0).astype(float)
            df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
            df["codigo_norm"] = df["codigo"].astype(str).apply(self._norm_codigo)
            df["centro_norm"] = df["centro"].astype(str).apply(self._norm_codigo)
            df["almacen_norm"] = df["almacen"].astype(str).apply(self._norm_codigo)

            self._consumo_cache = df
            self._consumo_cache_time = datetime.now()  # FIX 4.3
            return self._consumo_cache

        except Exception:
            self._consumo_cache = pd.DataFrame()
            self._consumo_cache_time = datetime.now()  # FIX 4.3
            return self._consumo_cache

    def clear_all(self):
        """Limpia todos los caches (para tests o recargas)"""
        self._stock_cache = None
        self._equivalencias_cache = None
        self._consumo_cache = None
        # FIX 4.3: También limpiar timestamps
        self._stock_cache_time = None
        self._equivalencias_cache_time = None
        self._consumo_cache_time = None


# Instancia global única
_loader = DataCacheLoader()


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
