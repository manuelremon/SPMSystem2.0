"""
Servicio de Datos Temporales.

Gestiona datos importados desde Excel para operar MRP y Forecast
sin afectar las bases de datos del sistema.

Uso:
    from backend.services.temp_data_service import temp_data_service

    # Verificar si modo temporal está activo
    if temp_data_service.is_active(user_id):
        stock = temp_data_service.get_stock(user_id)
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class TempDataStore:
    """Almacén de datos temporales para un usuario."""

    user_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)

    # DataFrames con los datos importados
    stock_df: Optional[pd.DataFrame] = None
    consumo_df: Optional[pd.DataFrame] = None
    parametros_mrp_df: Optional[pd.DataFrame] = None

    # Metadatos
    archivo_nombre: str = ""
    materiales_count: int = 0
    registros_stock: int = 0
    registros_consumo: int = 0
    rango_fechas: tuple = ("", "")
    advertencias: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convierte el store a diccionario para respuesta API."""
        return {
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat(),
            "archivo": self.archivo_nombre,
            "stats": {
                "materiales": self.materiales_count,
                "registros_stock": self.registros_stock,
                "registros_consumo": self.registros_consumo,
                "rango_fechas": list(self.rango_fechas)
            },
            "advertencias": self.advertencias
        }


class TempDataService:
    """
    Servicio que gestiona datos temporales importados desde Excel.

    Los datos se almacenan en memoria por sesión de usuario.
    Al cerrar sesión o desactivar manualmente, los datos se eliminan.
    """

    # Almacenamiento en memoria por user_id
    _stores: Dict[str, TempDataStore] = {}

    # Columnas requeridas por hoja
    REQUIRED_STOCK_COLS = ["material", "descripcion", "centro", "almacen", "stock", "um"]
    REQUIRED_CONSUMO_COLS = ["material", "fecha", "cantidad"]
    OPTIONAL_STOCK_COLS = ["precio_usd", "grupo_articulos", "ubicacion", "critico"]
    OPTIONAL_MRP_COLS = ["stock_seguridad", "punto_pedido", "stock_maximo", "lead_time_dias"]

    def import_from_dataframes(
        self,
        user_id: str,
        stock_df: pd.DataFrame,
        consumo_df: pd.DataFrame,
        parametros_mrp_df: Optional[pd.DataFrame] = None,
        archivo_nombre: str = "imported.xlsx"
    ) -> TempDataStore:
        """
        Importa datos desde DataFrames ya procesados.

        Args:
            user_id: ID del usuario admin
            stock_df: DataFrame con datos de stock
            consumo_df: DataFrame con consumo histórico
            parametros_mrp_df: DataFrame opcional con parámetros MRP
            archivo_nombre: Nombre del archivo original

        Returns:
            TempDataStore con los datos importados
        """
        advertencias = []

        # Normalizar nombres de columnas
        stock_df.columns = [c.lower().strip() for c in stock_df.columns]
        consumo_df.columns = [c.lower().strip() for c in consumo_df.columns]

        # Convertir tipos de datos en stock
        stock_df["material"] = stock_df["material"].astype(str).str.strip()
        stock_df["descripcion"] = stock_df["descripcion"].astype(str).str.strip()
        stock_df["centro"] = stock_df["centro"].astype(str).str.strip()
        stock_df["almacen"] = stock_df["almacen"].astype(str).str.strip()
        stock_df["stock"] = pd.to_numeric(stock_df["stock"], errors="coerce").fillna(0)
        stock_df["um"] = stock_df["um"].astype(str).str.strip()

        if "precio_usd" in stock_df.columns:
            stock_df["precio_usd"] = pd.to_numeric(stock_df["precio_usd"], errors="coerce").fillna(0)
        else:
            stock_df["precio_usd"] = 0.0

        if "critico" not in stock_df.columns:
            stock_df["critico"] = "NO"

        # Convertir tipos de datos en consumo
        consumo_df["material"] = consumo_df["material"].astype(str).str.strip()
        consumo_df["fecha"] = pd.to_datetime(consumo_df["fecha"], errors="coerce")
        consumo_df["cantidad"] = pd.to_numeric(consumo_df["cantidad"], errors="coerce").fillna(0)

        # Eliminar filas con fechas inválidas
        fechas_invalidas = consumo_df["fecha"].isna().sum()
        if fechas_invalidas > 0:
            advertencias.append(f"{fechas_invalidas} registros de consumo con fechas inválidas fueron ignorados")
            consumo_df = consumo_df.dropna(subset=["fecha"])

        if "centro" not in consumo_df.columns:
            # Usar el centro del primer registro de stock del material
            material_centro = stock_df.groupby("material")["centro"].first().to_dict()
            consumo_df["centro"] = consumo_df["material"].map(material_centro)

        # Validar que materiales en consumo existen en stock
        materiales_stock = set(stock_df["material"].unique())
        materiales_consumo = set(consumo_df["material"].unique())
        materiales_sin_stock = materiales_consumo - materiales_stock

        if materiales_sin_stock:
            advertencias.append(
                f"{len(materiales_sin_stock)} materiales en consumo no existen en stock: "
                f"{', '.join(list(materiales_sin_stock)[:5])}{'...' if len(materiales_sin_stock) > 5 else ''}"
            )

        # Verificar materiales sin consumo histórico
        materiales_sin_consumo = materiales_stock - materiales_consumo
        if materiales_sin_consumo:
            advertencias.append(
                f"{len(materiales_sin_consumo)} materiales sin consumo histórico (forecast limitado)"
            )

        # Verificar materiales con poco histórico
        consumo_por_material = consumo_df.groupby("material").size()
        materiales_poco_historico = consumo_por_material[consumo_por_material < 5].index.tolist()
        if materiales_poco_historico:
            advertencias.append(
                f"{len(materiales_poco_historico)} materiales con menos de 5 registros de consumo"
            )

        # Procesar parámetros MRP si se proporcionan
        if parametros_mrp_df is not None and not parametros_mrp_df.empty:
            parametros_mrp_df.columns = [c.lower().strip() for c in parametros_mrp_df.columns]
            parametros_mrp_df["material"] = parametros_mrp_df["material"].astype(str).str.strip()

            for col in self.OPTIONAL_MRP_COLS:
                if col in parametros_mrp_df.columns:
                    parametros_mrp_df[col] = pd.to_numeric(parametros_mrp_df[col], errors="coerce")

        # Calcular metadatos
        materiales_count = len(materiales_stock)
        registros_stock = len(stock_df)
        registros_consumo = len(consumo_df)

        fecha_min = consumo_df["fecha"].min()
        fecha_max = consumo_df["fecha"].max()
        rango_fechas = (
            fecha_min.strftime("%Y-%m-%d") if pd.notna(fecha_min) else "",
            fecha_max.strftime("%Y-%m-%d") if pd.notna(fecha_max) else ""
        )

        # Crear store
        store = TempDataStore(
            user_id=user_id,
            stock_df=stock_df,
            consumo_df=consumo_df,
            parametros_mrp_df=parametros_mrp_df,
            archivo_nombre=archivo_nombre,
            materiales_count=materiales_count,
            registros_stock=registros_stock,
            registros_consumo=registros_consumo,
            rango_fechas=rango_fechas,
            advertencias=advertencias
        )

        # Almacenar
        self._stores[user_id] = store

        logger.info(
            f"Datos temporales importados para usuario {user_id}: "
            f"{materiales_count} materiales, {registros_stock} stock, {registros_consumo} consumo"
        )

        return store

    def is_active(self, user_id: str) -> bool:
        """Verifica si el modo temporal está activo para el usuario."""
        return user_id in self._stores

    def get_status(self, user_id: str) -> Optional[dict]:
        """Obtiene el estado del modo temporal para el usuario."""
        if user_id not in self._stores:
            return None
        return self._stores[user_id].to_dict()

    def clear(self, user_id: str) -> bool:
        """
        Desactiva el modo temporal eliminando los datos.

        Returns:
            True si había datos que eliminar, False si no
        """
        if user_id in self._stores:
            del self._stores[user_id]
            logger.info(f"Datos temporales eliminados para usuario {user_id}")
            return True
        return False

    def get_stock(self, user_id: str, filters: Optional[dict] = None) -> List[dict]:
        """
        Obtiene datos de stock para MRP.

        Args:
            user_id: ID del usuario
            filters: Filtros opcionales (centro, almacen, material)

        Returns:
            Lista de diccionarios con datos de stock
        """
        if user_id not in self._stores:
            return []

        df = self._stores[user_id].stock_df.copy()

        # Aplicar filtros
        if filters:
            if filters.get("centro"):
                df = df[df["centro"] == filters["centro"]]
            if filters.get("almacen"):
                df = df[df["almacen"] == filters["almacen"]]
            if filters.get("material"):
                df = df[df["material"] == filters["material"]]
            if filters.get("search"):
                search = filters["search"].lower()
                df = df[
                    df["material"].str.lower().str.contains(search, na=False) |
                    df["descripcion"].str.lower().str.contains(search, na=False)
                ]

        return df.to_dict("records")

    def get_stock_by_material(self, user_id: str, material: str) -> Optional[dict]:
        """Obtiene datos de stock para un material específico."""
        if user_id not in self._stores:
            return None

        df = self._stores[user_id].stock_df
        row = df[df["material"] == material]

        if row.empty:
            return None

        return row.iloc[0].to_dict()

    def get_consumo_historico(
        self,
        user_id: str,
        material: Optional[str] = None,
        centro: Optional[str] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None
    ) -> List[dict]:
        """
        Obtiene consumo histórico para Forecast.

        Args:
            user_id: ID del usuario
            material: Filtrar por código de material
            centro: Filtrar por centro
            fecha_desde: Fecha inicio (YYYY-MM-DD)
            fecha_hasta: Fecha fin (YYYY-MM-DD)

        Returns:
            Lista de diccionarios con consumo histórico
        """
        if user_id not in self._stores:
            return []

        df = self._stores[user_id].consumo_df.copy()

        # Aplicar filtros
        if material:
            df = df[df["material"] == material]
        if centro:
            df = df[df["centro"] == centro]
        if fecha_desde:
            df = df[df["fecha"] >= pd.to_datetime(fecha_desde)]
        if fecha_hasta:
            df = df[df["fecha"] <= pd.to_datetime(fecha_hasta)]

        # Ordenar por fecha
        df = df.sort_values("fecha")

        # Convertir fecha a string para JSON
        df["fecha"] = df["fecha"].dt.strftime("%Y-%m-%d")

        return df.to_dict("records")

    def get_consumo_agregado_mensual(
        self,
        user_id: str,
        material: str,
        meses: int = 12
    ) -> List[dict]:
        """
        Obtiene consumo agregado por mes para un material.

        Args:
            user_id: ID del usuario
            material: Código del material
            meses: Cantidad de meses a retornar

        Returns:
            Lista con consumo mensual [{mes: "2024-01", cantidad: 150}, ...]
        """
        if user_id not in self._stores:
            return []

        df = self._stores[user_id].consumo_df.copy()
        df = df[df["material"] == material]

        if df.empty:
            return []

        # Agrupar por mes
        df["mes"] = df["fecha"].dt.to_period("M")
        mensual = df.groupby("mes")["cantidad"].sum().reset_index()
        mensual["mes"] = mensual["mes"].astype(str)

        # Tomar últimos N meses
        mensual = mensual.tail(meses)

        return mensual.to_dict("records")

    def get_parametros_mrp(self, user_id: str, material: str) -> dict:
        """
        Obtiene parámetros MRP para un material.

        Si no hay parámetros personalizados, calcula desde consumo histórico.

        Args:
            user_id: ID del usuario
            material: Código del material

        Returns:
            dict con stock_seguridad, punto_pedido, stock_maximo, lead_time_dias
        """
        default_params = {
            "stock_seguridad": 0,
            "punto_pedido": 0,
            "stock_maximo": 0,
            "lead_time_dias": 15
        }

        if user_id not in self._stores:
            return default_params

        store = self._stores[user_id]

        # Buscar en parámetros personalizados
        if store.parametros_mrp_df is not None and not store.parametros_mrp_df.empty:
            params_row = store.parametros_mrp_df[store.parametros_mrp_df["material"] == material]
            if not params_row.empty:
                row = params_row.iloc[0]
                return {
                    "stock_seguridad": row.get("stock_seguridad", 0) or 0,
                    "punto_pedido": row.get("punto_pedido", 0) or 0,
                    "stock_maximo": row.get("stock_maximo", 0) or 0,
                    "lead_time_dias": row.get("lead_time_dias", 15) or 15
                }

        # Calcular desde consumo histórico
        consumo = self.get_consumo_agregado_mensual(user_id, material, 12)

        if not consumo:
            # Sin histórico, usar valores por defecto basados en stock actual
            stock_info = self.get_stock_by_material(user_id, material)
            if stock_info:
                stock_actual = stock_info.get("stock", 0)
                return {
                    "stock_seguridad": stock_actual * 0.2,
                    "punto_pedido": stock_actual * 0.3,
                    "stock_maximo": stock_actual * 1.5,
                    "lead_time_dias": 15
                }
            return default_params

        # Calcular consumo mensual promedio
        consumo_mensual = sum(c["cantidad"] for c in consumo) / len(consumo)

        # Parámetros calculados (según lógica de MRP service)
        return {
            "stock_seguridad": consumo_mensual * 2,      # 2 meses
            "punto_pedido": consumo_mensual * 3,         # 3 meses
            "stock_maximo": consumo_mensual * 6,         # 6 meses
            "lead_time_dias": 15
        }

    def get_materiales_list(self, user_id: str) -> List[dict]:
        """
        Obtiene lista de materiales únicos con su descripción.

        Returns:
            Lista de {material, descripcion, um}
        """
        if user_id not in self._stores:
            return []

        df = self._stores[user_id].stock_df[["material", "descripcion", "um"]].drop_duplicates()
        return df.to_dict("records")

    def get_centros_list(self, user_id: str) -> List[str]:
        """Obtiene lista de centros únicos."""
        if user_id not in self._stores:
            return []

        return self._stores[user_id].stock_df["centro"].unique().tolist()

    def get_almacenes_list(self, user_id: str, centro: Optional[str] = None) -> List[str]:
        """Obtiene lista de almacenes únicos, opcionalmente filtrados por centro."""
        if user_id not in self._stores:
            return []

        df = self._stores[user_id].stock_df

        if centro:
            df = df[df["centro"] == centro]

        return df["almacen"].unique().tolist()


# Instancia singleton
temp_data_service = TempDataService()
