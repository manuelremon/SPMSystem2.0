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

    # DataFrames con los datos importados (5 hojas)
    stock_df: Optional[pd.DataFrame] = None
    consumo_df: Optional[pd.DataFrame] = None
    solpeds_df: Optional[pd.DataFrame] = None
    pedidos_df: Optional[pd.DataFrame] = None
    parametros_mrp_df: Optional[pd.DataFrame] = None

    # Metadatos
    archivo_nombre: str = ""
    materiales_count: int = 0
    registros_stock: int = 0
    registros_consumo: int = 0
    registros_solpeds: int = 0
    registros_pedidos: int = 0
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
                "registros_solpeds": self.registros_solpeds,
                "registros_pedidos": self.registros_pedidos,
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
    REQUIRED_SOLPED_COLS = [
        "solped", "posicion_solped", "material", "cantidad_solped", "um",
        "fecha_creacion_solped", "centro"
    ]
    REQUIRED_PEDIDO_COLS = [
        "pedido", "posicion_pedido", "material", "cantidad_pedida", "um",
        "fecha_pedido", "centro"
    ]

    # Columnas opcionales - STOCK
    OPTIONAL_STOCK_COLS = [
        "precio_usd", "grupo_articulos", "ubicacion", "criticidad", "sector",
        "nombre_proveedor", "area_pl_nec", "cap", "lp", "hem", "pzec", "vd", "clase_objeto"
    ]

    # Columnas opcionales - CONSUMO
    OPTIONAL_CONSUMO_COLS = ["centro", "almacen"]

    # Columnas opcionales - SOLPEDS (modelo SAP completo)
    OPTIONAL_SOLPED_COLS = [
        # Identificación
        "grupo_compras", "clase_documento",
        # Material
        "descripcion_material", "grupo_articulos",
        # Timeline Solped
        "fecha_entrega_solped", "liberacion_solped", "fecha_liberacion_solped",
        # Financiero Solped
        "precio_unitario_solped", "importe_total_solped", "moneda_solped",
        "centro_costos", "imputacion",
        # Datos del Pedido (si existe)
        "pedido", "posicion_pedido", "clase_pedido", "fecha_pedido",
        "fecha_liberacion_pedido", "estrategia_liberacion_pedido", "fecha_entrega_pedido",
        # Cantidades y Recepción
        "cantidad_pedida", "cantidad_recepcionada", "fecha_recepcion",
        # Valores Pedido
        "valor_pedido", "valor_recibido", "moneda_pedido",
        "valor_facturado", "moneda_facturada",
        # Proveedor y Contrato
        "proveedor", "nombre_proveedor", "contrato_marco", "posicion_contrato_marco",
        # Usuarios
        "creado_por", "solicitante", "num_necesidad", "concluida"
    ]

    # Columnas opcionales - PEDIDOS (modelo completo)
    OPTIONAL_PEDIDO_COLS = [
        # Identificación
        "grupo_compras", "clase_pedido",
        # Material
        "descripcion_material", "grupo_articulos",
        # Timeline
        "fecha_liberacion_pedido", "estrategia_liberacion", "fecha_entrega_pedido", "fecha_recepcion",
        # Cantidades
        "cantidad_recepcionada",
        # Valores
        "valor_pedido", "valor_recibido", "moneda_pedido",
        "valor_facturado", "moneda_facturada",
        # Proveedor y Contrato
        "proveedor", "nombre_proveedor", "contrato_marco", "posicion_contrato_marco",
        # Solped Origen
        "solped_origen", "posicion_solped"
    ]

    # Columnas opcionales - MRP
    OPTIONAL_MRP_COLS = [
        "demanda_estimada_anual", "stock_seguridad", "punto_pedido", "stock_maximo", "lead_time_dias"
    ]

    # Columnas de fecha para conversión
    SOLPED_DATE_COLS = [
        "fecha_creacion_solped", "fecha_entrega_solped", "fecha_liberacion_solped",
        "fecha_pedido", "fecha_liberacion_pedido", "fecha_entrega_pedido", "fecha_recepcion"
    ]
    PEDIDO_DATE_COLS = [
        "fecha_pedido", "fecha_liberacion_pedido", "fecha_entrega_pedido", "fecha_recepcion"
    ]

    # Mapeo de nombres antiguos a nuevos para compatibilidad
    SOLPED_OLD_TO_NEW_COLS = {
        "fecha_creacion": "fecha_creacion_solped",
        "fecha_entrega": "fecha_entrega_solped",
        "liberacion": "liberacion_solped",
        "fecha_liberacion": "fecha_liberacion_solped",
        "precio_unitario": "precio_unitario_solped",
        "importe_total": "importe_total_solped",
        "moneda": "moneda_solped",
    }
    PEDIDO_OLD_TO_NEW_COLS = {
        "fecha_entrega": "fecha_entrega_pedido",
        "moneda": "moneda_pedido",
    }

    def import_from_dataframes(
        self,
        user_id: str,
        stock_df: pd.DataFrame,
        consumo_df: pd.DataFrame,
        solpeds_df: Optional[pd.DataFrame] = None,
        pedidos_df: Optional[pd.DataFrame] = None,
        parametros_mrp_df: Optional[pd.DataFrame] = None,
        archivo_nombre: str = "imported.xlsx"
    ) -> TempDataStore:
        """
        Importa datos desde DataFrames ya procesados.

        Args:
            user_id: ID del usuario admin
            stock_df: DataFrame con datos de stock
            consumo_df: DataFrame con consumo histórico
            solpeds_df: DataFrame opcional con solpeds en curso
            pedidos_df: DataFrame opcional con pedidos en curso
            parametros_mrp_df: DataFrame opcional con parámetros MRP
            archivo_nombre: Nombre del archivo original

        Returns:
            TempDataStore con los datos importados
        """
        advertencias = []

        # Normalizar nombres de columnas
        stock_df.columns = [c.lower().strip().replace(" ", "_") for c in stock_df.columns]
        consumo_df.columns = [c.lower().strip().replace(" ", "_") for c in consumo_df.columns]

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

        if "grupo_articulos" in stock_df.columns:
            stock_df["grupo_articulos"] = pd.to_numeric(stock_df["grupo_articulos"], errors="coerce").fillna(0).astype(int)

        # Manejar criticidad (puede ser A/B/C o SI/NO)
        if "criticidad" not in stock_df.columns:
            if "critico" in stock_df.columns:
                stock_df["criticidad"] = stock_df["critico"].apply(
                    lambda x: "A" if str(x).upper() in ["SI", "S", "YES", "Y", "A"] else "C"
                )
            else:
                stock_df["criticidad"] = "C"

        # Convertir tipos de datos en consumo
        consumo_df["material"] = consumo_df["material"].astype(str).str.strip()
        consumo_df["fecha"] = pd.to_datetime(consumo_df["fecha"], dayfirst=True, errors="coerce")
        consumo_df["cantidad"] = pd.to_numeric(consumo_df["cantidad"], errors="coerce").fillna(0)

        # Eliminar filas con fechas inválidas
        fechas_invalidas = consumo_df["fecha"].isna().sum()
        if fechas_invalidas > 0:
            advertencias.append(f"{fechas_invalidas} registros de consumo con fechas inválidas fueron ignorados")
            consumo_df = consumo_df.dropna(subset=["fecha"])

        if "centro" not in consumo_df.columns:
            material_centro = stock_df.groupby("material")["centro"].first().to_dict()
            consumo_df["centro"] = consumo_df["material"].map(material_centro)

        # Procesar SOLPEDS en curso
        registros_solpeds = 0
        if solpeds_df is not None and not solpeds_df.empty:
            solpeds_df.columns = [c.lower().strip().replace(" ", "_") for c in solpeds_df.columns]
            solpeds_df["material"] = solpeds_df["material"].astype(str).str.strip()
            solpeds_df["solped"] = pd.to_numeric(solpeds_df["solped"], errors="coerce")
            solpeds_df["cantidad_solped"] = pd.to_numeric(solpeds_df["cantidad_solped"], errors="coerce").fillna(0)

            # Rename old column names to new for consistency
            for old_name, new_name in self.SOLPED_OLD_TO_NEW_COLS.items():
                if old_name in solpeds_df.columns and new_name not in solpeds_df.columns:
                    solpeds_df[new_name] = solpeds_df[old_name]

            # Handle date columns - convert to datetime
            for date_col in self.SOLPED_DATE_COLS:
                if date_col in solpeds_df.columns:
                    solpeds_df[date_col] = pd.to_datetime(solpeds_df[date_col], dayfirst=True, errors="coerce")

            registros_solpeds = len(solpeds_df)

        # Procesar PEDIDOS en curso
        registros_pedidos = 0
        if pedidos_df is not None and not pedidos_df.empty:
            pedidos_df.columns = [c.lower().strip().replace(" ", "_") for c in pedidos_df.columns]
            pedidos_df["material"] = pedidos_df["material"].astype(str).str.strip()
            pedidos_df["pedido"] = pd.to_numeric(pedidos_df["pedido"], errors="coerce")
            pedidos_df["cantidad_pedida"] = pd.to_numeric(pedidos_df["cantidad_pedida"], errors="coerce").fillna(0)
            if "cantidad_recepcionada" in pedidos_df.columns:
                pedidos_df["cantidad_recepcionada"] = pd.to_numeric(pedidos_df["cantidad_recepcionada"], errors="coerce").fillna(0)
            else:
                pedidos_df["cantidad_recepcionada"] = 0

            # Rename old column names to new for consistency
            for old_name, new_name in self.PEDIDO_OLD_TO_NEW_COLS.items():
                if old_name in pedidos_df.columns and new_name not in pedidos_df.columns:
                    pedidos_df[new_name] = pedidos_df[old_name]

            # Handle date columns - convert to datetime
            for date_col in self.PEDIDO_DATE_COLS:
                if date_col in pedidos_df.columns:
                    pedidos_df[date_col] = pd.to_datetime(pedidos_df[date_col], dayfirst=True, errors="coerce")

            registros_pedidos = len(pedidos_df)

        # Validar materiales
        materiales_stock = set(stock_df["material"].unique())
        materiales_consumo = set(consumo_df["material"].unique())
        materiales_sin_stock = materiales_consumo - materiales_stock

        if materiales_sin_stock:
            advertencias.append(
                f"{len(materiales_sin_stock)} materiales en consumo no existen en stock: "
                f"{', '.join(list(materiales_sin_stock)[:5])}{'...' if len(materiales_sin_stock) > 5 else ''}"
            )

        materiales_sin_consumo = materiales_stock - materiales_consumo
        if materiales_sin_consumo:
            advertencias.append(
                f"{len(materiales_sin_consumo)} materiales sin consumo histórico (forecast limitado)"
            )

        consumo_por_material = consumo_df.groupby("material").size()
        materiales_poco_historico = consumo_por_material[consumo_por_material < 5].index.tolist()
        if materiales_poco_historico:
            advertencias.append(
                f"{len(materiales_poco_historico)} materiales con menos de 5 registros de consumo"
            )

        # Procesar parámetros MRP si se proporcionan
        if parametros_mrp_df is not None and not parametros_mrp_df.empty:
            parametros_mrp_df.columns = [c.lower().strip().replace(" ", "_") for c in parametros_mrp_df.columns]
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
            solpeds_df=solpeds_df,
            pedidos_df=pedidos_df,
            parametros_mrp_df=parametros_mrp_df,
            archivo_nombre=archivo_nombre,
            materiales_count=materiales_count,
            registros_stock=registros_stock,
            registros_consumo=registros_consumo,
            registros_solpeds=registros_solpeds,
            registros_pedidos=registros_pedidos,
            rango_fechas=rango_fechas,
            advertencias=advertencias
        )

        # Almacenar
        self._stores[user_id] = store

        logger.info(
            f"Datos temporales importados para usuario {user_id}: "
            f"{materiales_count} materiales, {registros_stock} stock, {registros_consumo} consumo, "
            f"{registros_solpeds} solpeds, {registros_pedidos} pedidos"
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

    def get_solpeds_en_curso(
        self,
        user_id: str,
        material: Optional[str] = None,
        centro: Optional[str] = None,
        liberacion: Optional[str] = None
    ) -> List[dict]:
        """
        Obtiene solicitudes de pedido (SOLPED) en curso.

        Args:
            user_id: ID del usuario
            material: Filtrar por código de material
            centro: Filtrar por centro
            liberacion: Filtrar por estado (S/ EST.LIB, LIBERADA)

        Returns:
            Lista de diccionarios con solpeds en curso
        """
        if user_id not in self._stores:
            return []

        store = self._stores[user_id]
        if store.solpeds_df is None or store.solpeds_df.empty:
            return []

        df = store.solpeds_df.copy()

        # Aplicar filtros
        if material:
            df = df[df["material"] == str(material)]
        if centro:
            df = df[df["centro"].astype(str) == str(centro)]
        if liberacion:
            # Soportar ambos nombres de columna
            lib_col = "liberacion_solped" if "liberacion_solped" in df.columns else "liberacion"
            if lib_col in df.columns:
                df = df[df[lib_col] == liberacion]

        # Convertir fechas a string para JSON
        for col in self.SOLPED_DATE_COLS:
            if col in df.columns:
                df[col] = df[col].apply(
                    lambda x: x.strftime("%Y-%m-%d") if pd.notna(x) and hasattr(x, 'strftime') else (str(x) if pd.notna(x) else None)
                )

        return df.to_dict("records")

    def get_pedidos_en_curso(
        self,
        user_id: str,
        material: Optional[str] = None,
        centro: Optional[str] = None
    ) -> List[dict]:
        """
        Obtiene pedidos (órdenes de compra) en curso.

        Args:
            user_id: ID del usuario
            material: Filtrar por código de material
            centro: Filtrar por centro

        Returns:
            Lista de diccionarios con pedidos en curso, incluyendo cantidad_pendiente
        """
        if user_id not in self._stores:
            return []

        store = self._stores[user_id]
        if store.pedidos_df is None or store.pedidos_df.empty:
            return []

        df = store.pedidos_df.copy()

        # Aplicar filtros
        if material:
            df = df[df["material"] == str(material)]
        if centro:
            df = df[df["centro"].astype(str) == str(centro)]

        # Calcular cantidad pendiente
        df["cantidad_pendiente"] = df["cantidad_pedida"] - df["cantidad_recepcionada"].fillna(0)

        # Filtrar solo los que tienen cantidad pendiente > 0
        df = df[df["cantidad_pendiente"] > 0]

        # Calcular valor pendiente si hay columnas de valor
        if "valor_pedido" in df.columns and "valor_recibido" in df.columns:
            df["valor_pendiente"] = df["valor_pedido"].fillna(0) - df["valor_recibido"].fillna(0)

        # Convertir fechas a string para JSON
        for col in self.PEDIDO_DATE_COLS:
            if col in df.columns:
                df[col] = df[col].apply(
                    lambda x: x.strftime("%Y-%m-%d") if pd.notna(x) and hasattr(x, 'strftime') else (str(x) if pd.notna(x) else None)
                )

        return df.to_dict("records")

    def get_cantidad_en_transito(self, user_id: str, material: str) -> float:
        """
        Calcula la cantidad total en tránsito para un material.

        Incluye:
        - Cantidad pendiente de pedidos en curso
        - Cantidad de solpeds liberadas (próximas a convertirse en pedidos)

        Args:
            user_id: ID del usuario
            material: Código del material

        Returns:
            Cantidad total en tránsito
        """
        cantidad = 0.0

        # Sumar pedidos pendientes
        pedidos = self.get_pedidos_en_curso(user_id, material=material)
        for p in pedidos:
            cantidad += p.get("cantidad_pendiente", 0)

        # Sumar solpeds liberadas (están por convertirse en pedido)
        solpeds = self.get_solpeds_en_curso(user_id, material=material, liberacion="LIBERADA")
        for s in solpeds:
            cantidad += s.get("cantidad_solped", 0)

        return cantidad

    def get_demanda_estimada_anual(self, user_id: str, material: str) -> Optional[float]:
        """
        Obtiene la demanda estimada anual para un material.

        Args:
            user_id: ID del usuario
            material: Código del material

        Returns:
            Demanda estimada anual o None si no está disponible
        """
        if user_id not in self._stores:
            return None

        store = self._stores[user_id]

        # Buscar en parámetros MRP
        if store.parametros_mrp_df is not None and not store.parametros_mrp_df.empty:
            params_row = store.parametros_mrp_df[store.parametros_mrp_df["material"] == material]
            if not params_row.empty:
                demanda = params_row.iloc[0].get("demanda_estimada_anual")
                if pd.notna(demanda):
                    return float(demanda)

        # Si no hay parámetro, calcular desde consumo histórico
        consumo = self.get_consumo_historico(user_id, material=material)
        if consumo:
            # Calcular promedio mensual y extrapolar a anual
            total = sum(c["cantidad"] for c in consumo)
            meses = len(set(c["fecha"][:7] for c in consumo))  # Meses únicos
            if meses > 0:
                return (total / meses) * 12

        return None

    # =========================================================================
    # MÉTODOS DE KPIs
    # =========================================================================

    def get_kpi_tiempos_ciclo(self, user_id: str, material: Optional[str] = None) -> dict:
        """
        Calcula tiempos promedio del ciclo de compras.

        Args:
            user_id: ID del usuario
            material: Filtrar por material (opcional)

        Returns:
            Dict con tiempos promedio en días:
            - tiempo_aprobacion_solped: Días desde creación hasta liberación
            - tiempo_solped_a_pedido: Días desde liberación hasta pedido
            - ciclo_total_compras: Días desde creación hasta recepción
            - lead_time_proveedor: Días desde pedido hasta recepción
        """
        result = {
            "tiempo_aprobacion_solped": None,
            "tiempo_solped_a_pedido": None,
            "ciclo_total_compras": None,
            "lead_time_proveedor": None,
            "registros_analizados": 0
        }

        if user_id not in self._stores:
            return result

        store = self._stores[user_id]
        if store.solpeds_df is None or store.solpeds_df.empty:
            return result

        df = store.solpeds_df.copy()

        if material:
            df = df[df["material"] == str(material)]

        result["registros_analizados"] = len(df)

        # Columnas de fecha (soportar ambos formatos)
        col_creacion = "fecha_creacion_solped" if "fecha_creacion_solped" in df.columns else "fecha_creacion"
        col_lib_solped = "fecha_liberacion_solped" if "fecha_liberacion_solped" in df.columns else "fecha_liberacion"

        # Tiempo de aprobación: liberación - creación
        if col_creacion in df.columns and col_lib_solped in df.columns:
            df_valid = df.dropna(subset=[col_creacion, col_lib_solped])
            if len(df_valid) > 0:
                df_valid[col_creacion] = pd.to_datetime(df_valid[col_creacion], dayfirst=True, errors="coerce")
                df_valid[col_lib_solped] = pd.to_datetime(df_valid[col_lib_solped], dayfirst=True, errors="coerce")
                tiempos = (df_valid[col_lib_solped] - df_valid[col_creacion]).dt.days
                tiempos = tiempos[tiempos >= 0]
                if len(tiempos) > 0:
                    result["tiempo_aprobacion_solped"] = round(tiempos.mean(), 1)

        # Tiempo solped a pedido: fecha_pedido - fecha_liberacion_solped
        if col_lib_solped in df.columns and "fecha_pedido" in df.columns:
            df_valid = df.dropna(subset=[col_lib_solped, "fecha_pedido"])
            if len(df_valid) > 0:
                df_valid[col_lib_solped] = pd.to_datetime(df_valid[col_lib_solped], dayfirst=True, errors="coerce")
                df_valid["fecha_pedido"] = pd.to_datetime(df_valid["fecha_pedido"], dayfirst=True, errors="coerce")
                tiempos = (df_valid["fecha_pedido"] - df_valid[col_lib_solped]).dt.days
                tiempos = tiempos[tiempos >= 0]
                if len(tiempos) > 0:
                    result["tiempo_solped_a_pedido"] = round(tiempos.mean(), 1)

        # Ciclo total: fecha_recepcion - fecha_creacion_solped
        if col_creacion in df.columns and "fecha_recepcion" in df.columns:
            df_valid = df.dropna(subset=[col_creacion, "fecha_recepcion"])
            if len(df_valid) > 0:
                df_valid[col_creacion] = pd.to_datetime(df_valid[col_creacion], dayfirst=True, errors="coerce")
                df_valid["fecha_recepcion"] = pd.to_datetime(df_valid["fecha_recepcion"], dayfirst=True, errors="coerce")
                tiempos = (df_valid["fecha_recepcion"] - df_valid[col_creacion]).dt.days
                tiempos = tiempos[tiempos >= 0]
                if len(tiempos) > 0:
                    result["ciclo_total_compras"] = round(tiempos.mean(), 1)

        # Lead time proveedor: fecha_recepcion - fecha_pedido
        if "fecha_pedido" in df.columns and "fecha_recepcion" in df.columns:
            df_valid = df.dropna(subset=["fecha_pedido", "fecha_recepcion"])
            if len(df_valid) > 0:
                df_valid["fecha_pedido"] = pd.to_datetime(df_valid["fecha_pedido"], dayfirst=True, errors="coerce")
                df_valid["fecha_recepcion"] = pd.to_datetime(df_valid["fecha_recepcion"], dayfirst=True, errors="coerce")
                tiempos = (df_valid["fecha_recepcion"] - df_valid["fecha_pedido"]).dt.days
                tiempos = tiempos[tiempos >= 0]
                if len(tiempos) > 0:
                    result["lead_time_proveedor"] = round(tiempos.mean(), 1)

        return result

    def get_kpi_cumplimiento(self, user_id: str) -> dict:
        """
        Calcula tasas de cumplimiento.

        Returns:
            Dict con:
            - entregas_a_tiempo: % de entregas dentro de fecha esperada
            - tasa_recepcion: % de cantidad recepcionada vs pedida
            - exactitud_factura: % de facturas que coinciden con pedido
        """
        result = {
            "entregas_a_tiempo": None,
            "tasa_recepcion": None,
            "exactitud_factura": None,
            "pedidos_analizados": 0
        }

        if user_id not in self._stores:
            return result

        store = self._stores[user_id]
        if store.solpeds_df is None or store.solpeds_df.empty:
            return result

        df = store.solpeds_df.copy()

        # Filtrar solo los que tienen pedido y recepción
        df_con_recepcion = df.dropna(subset=["fecha_recepcion"])
        result["pedidos_analizados"] = len(df_con_recepcion)

        if len(df_con_recepcion) == 0:
            return result

        # Entregas a tiempo: fecha_recepcion <= fecha_entrega_pedido
        col_entrega = "fecha_entrega_pedido" if "fecha_entrega_pedido" in df_con_recepcion.columns else "fecha_entrega"
        if col_entrega in df_con_recepcion.columns:
            df_valid = df_con_recepcion.dropna(subset=[col_entrega])
            if len(df_valid) > 0:
                df_valid["fecha_recepcion"] = pd.to_datetime(df_valid["fecha_recepcion"], dayfirst=True, errors="coerce")
                df_valid[col_entrega] = pd.to_datetime(df_valid[col_entrega], dayfirst=True, errors="coerce")
                a_tiempo = (df_valid["fecha_recepcion"] <= df_valid[col_entrega]).sum()
                result["entregas_a_tiempo"] = round((a_tiempo / len(df_valid)) * 100, 1)

        # Tasa de recepción
        if "cantidad_pedida" in df_con_recepcion.columns and "cantidad_recepcionada" in df_con_recepcion.columns:
            total_pedido = df_con_recepcion["cantidad_pedida"].sum()
            total_recibido = df_con_recepcion["cantidad_recepcionada"].sum()
            if total_pedido > 0:
                result["tasa_recepcion"] = round((total_recibido / total_pedido) * 100, 1)

        # Exactitud de factura
        if "valor_pedido" in df_con_recepcion.columns and "valor_facturado" in df_con_recepcion.columns:
            df_valid = df_con_recepcion.dropna(subset=["valor_pedido", "valor_facturado"])
            if len(df_valid) > 0:
                total_pedido = df_valid["valor_pedido"].sum()
                total_facturado = df_valid["valor_facturado"].sum()
                if total_pedido > 0:
                    # Calcular como % de coincidencia (100% = exacto)
                    ratio = total_facturado / total_pedido
                    result["exactitud_factura"] = round(min(ratio, 1 / ratio if ratio > 0 else 0) * 100, 1)

        return result

    def get_kpi_uso_contratos(self, user_id: str) -> dict:
        """
        Calcula métricas de uso de contratos marco.

        Returns:
            Dict con:
            - porcentaje_con_contrato: % de solpeds/pedidos con contrato marco
            - valor_bajo_contrato: Valor total bajo contratos marco
            - top_contratos: Lista de contratos más utilizados
        """
        result = {
            "porcentaje_con_contrato": None,
            "valor_bajo_contrato": 0.0,
            "total_solpeds": 0,
            "solpeds_con_contrato": 0,
            "top_contratos": []
        }

        if user_id not in self._stores:
            return result

        store = self._stores[user_id]
        if store.solpeds_df is None or store.solpeds_df.empty:
            return result

        df = store.solpeds_df.copy()
        result["total_solpeds"] = len(df)

        if "contrato_marco" not in df.columns:
            return result

        # Contar solpeds con contrato
        con_contrato = df["contrato_marco"].notna()
        result["solpeds_con_contrato"] = con_contrato.sum()

        if result["total_solpeds"] > 0:
            result["porcentaje_con_contrato"] = round(
                (result["solpeds_con_contrato"] / result["total_solpeds"]) * 100, 1
            )

        # Valor bajo contrato
        if "valor_pedido" in df.columns:
            result["valor_bajo_contrato"] = float(df[con_contrato]["valor_pedido"].sum())

        # Top contratos
        contratos = df[con_contrato]["contrato_marco"].value_counts().head(5)
        result["top_contratos"] = [
            {"contrato": str(c), "cantidad": int(v)}
            for c, v in contratos.items()
        ]

        return result

    def get_solpeds_sin_pedido(self, user_id: str) -> List[dict]:
        """
        Obtiene solpeds liberadas que aún no tienen pedido creado.

        Returns:
            Lista de solpeds sin pedido
        """
        if user_id not in self._stores:
            return []

        store = self._stores[user_id]
        if store.solpeds_df is None or store.solpeds_df.empty:
            return []

        df = store.solpeds_df.copy()

        # Filtrar liberadas sin pedido
        lib_col = "liberacion_solped" if "liberacion_solped" in df.columns else "liberacion"
        if lib_col in df.columns:
            mask = (df[lib_col] == "LIBERADA") & (df["pedido"].isna())
            return df[mask].to_dict("records")

        return []

    def get_solpeds_pendientes_recepcion(self, user_id: str) -> List[dict]:
        """
        Obtiene solpeds con pedido pero sin recepción completa.

        Returns:
            Lista de solpeds pendientes de recepción
        """
        if user_id not in self._stores:
            return []

        store = self._stores[user_id]
        if store.solpeds_df is None or store.solpeds_df.empty:
            return []

        df = store.solpeds_df.copy()

        # Filtrar con pedido pero sin recepción completa
        if "pedido" in df.columns and "cantidad_pedida" in df.columns:
            mask = (
                df["pedido"].notna() &
                (
                    df["cantidad_recepcionada"].isna() |
                    (df["cantidad_recepcionada"] < df["cantidad_pedida"])
                )
            )
            return df[mask].to_dict("records")

        return []

    def get_pedidos_retrasados(self, user_id: str) -> List[dict]:
        """
        Obtiene pedidos donde la recepción fue después de la fecha esperada.

        Returns:
            Lista de pedidos retrasados con días de retraso
        """
        if user_id not in self._stores:
            return []

        store = self._stores[user_id]
        if store.solpeds_df is None or store.solpeds_df.empty:
            return []

        df = store.solpeds_df.copy()

        col_entrega = "fecha_entrega_pedido" if "fecha_entrega_pedido" in df.columns else "fecha_entrega"

        if "fecha_recepcion" not in df.columns or col_entrega not in df.columns:
            return []

        df_valid = df.dropna(subset=["fecha_recepcion", col_entrega]).copy()

        if len(df_valid) == 0:
            return []

        df_valid["fecha_recepcion"] = pd.to_datetime(df_valid["fecha_recepcion"], dayfirst=True, errors="coerce")
        df_valid[col_entrega] = pd.to_datetime(df_valid[col_entrega], dayfirst=True, errors="coerce")

        # Calcular retraso
        df_valid["dias_retraso"] = (df_valid["fecha_recepcion"] - df_valid[col_entrega]).dt.days

        # Filtrar retrasados
        retrasados = df_valid[df_valid["dias_retraso"] > 0]

        return retrasados.to_dict("records")

    def get_pedidos_por_vencer(self, user_id: str, dias: int = 7) -> List[dict]:
        """
        Obtiene pedidos con fecha de entrega en los próximos N días.

        Args:
            user_id: ID del usuario
            dias: Número de días hacia adelante (default: 7)

        Returns:
            Lista de pedidos por vencer
        """
        if user_id not in self._stores:
            return []

        store = self._stores[user_id]
        if store.solpeds_df is None or store.solpeds_df.empty:
            return []

        df = store.solpeds_df.copy()

        col_entrega = "fecha_entrega_pedido" if "fecha_entrega_pedido" in df.columns else "fecha_entrega"

        if col_entrega not in df.columns:
            return []

        # Filtrar solo los que tienen pedido pero no recepción
        if "pedido" in df.columns:
            df = df[df["pedido"].notna()]

        if "fecha_recepcion" in df.columns:
            df = df[df["fecha_recepcion"].isna()]

        if len(df) == 0:
            return []

        df[col_entrega] = pd.to_datetime(df[col_entrega], dayfirst=True, errors="coerce")
        df = df.dropna(subset=[col_entrega])

        hoy = pd.Timestamp.now()
        limite = hoy + pd.Timedelta(days=dias)

        # Filtrar por vencer
        por_vencer = df[(df[col_entrega] >= hoy) & (df[col_entrega] <= limite)]

        # Calcular días restantes
        por_vencer = por_vencer.copy()
        por_vencer["dias_para_vencer"] = (por_vencer[col_entrega] - hoy).dt.days

        return por_vencer.to_dict("records")


# Instancia singleton
temp_data_service = TempDataService()
