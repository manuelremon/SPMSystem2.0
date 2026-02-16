"""
Herramienta para cargar datos del sistema SPM.

Carga solicitudes, materiales, stock, presupuestos desde BD.
- En producción: todo desde PostgreSQL
- En desarrollo: spm desde SQLite, datos SAP desde SQLite separados
"""

import logging
from typing import Any, Dict, List, Optional

from backend.core.search_utils import build_description_search

from .base import BaseTool, ToolError, ToolMetadata

logger = logging.getLogger(__name__)


def _get_db_connection(db_name: str = "spm"):
    """Obtiene conexión a la BD especificada."""
    from backend.core.db import get_db_connection
    return get_db_connection(db_name)


class DataLoader(BaseTool):
    """
    Herramienta para cargar datos del sistema SPM.

    Soporta:
    - Solicitudes (todas, por usuario, por estado) - PostgreSQL
    - Materiales (búsqueda, filtros) - SQLite (catalogo_materiales.db)
    - Stock disponible - SQLite (sap_data.db)
    - Presupuestos por centro/sector - PostgreSQL
    - Información de centros, sectores, almacenes - PostgreSQL
    """

    def __init__(self):
        """Inicializa el cargador de datos."""
        super().__init__(
            name="load_data",
            description="Carga datos del sistema SPM (solicitudes, materiales, stock, etc.)",
        )

    def execute(
        self,
        data_type: str = "solicitudes",
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """
        Carga datos según el tipo especificado.

        Args:
            data_type: Tipo de datos:
                - 'solicitudes': Solicitudes de materiales (PostgreSQL)
                - 'materiales': Catálogo de materiales (SQLite)
                - 'stock': Stock actual desde SAP (SQLite)
                - 'consumo_historico': Historial de consumo SAP (SQLite)
                - 'presupuestos': Presupuestos por centro/sector (PostgreSQL)
                - 'catalogs': Catálogos (centros, sectores, almacenes) (PostgreSQL)
            filters: Filtros a aplicar (ej: {"estado": "aprobada"})
            limit: Límite de registros

        Returns:
            Diccionario con datos cargados
        """
        filters = filters or {}

        if data_type == "solicitudes":
            return self._load_solicitudes(filters, limit)
        elif data_type == "materiales":
            return self._load_materiales(filters, limit)
        elif data_type == "stock":
            return self._load_stock(filters, limit)
        elif data_type == "consumo_historico":
            return self._load_consumo_historico(filters, limit)
        elif data_type == "presupuestos":
            return self._load_presupuestos(filters)
        elif data_type == "catalogs":
            return self._load_catalogs()
        else:
            raise ToolError(f"Tipo de dato no soportado: {data_type}")

    def _load_solicitudes(self, filters: Dict[str, Any], limit: int) -> Dict[str, Any]:
        """Carga solicitudes desde PostgreSQL."""
        try:
            with _get_db_connection() as conn:
                cursor = conn.cursor()

                query = "SELECT id, status, criticidad, centro, sector, total_monto, created_at, id_usuario FROM solicitud WHERE 1=1"
                params = []

                # Aplicar filtros
                if "estado" in filters:
                    query += " AND status = %s"
                    params.append(filters["estado"])

                if "usuario_id" in filters:
                    query += " AND id_usuario = %s"
                    params.append(filters["usuario_id"])

                if "centro" in filters:
                    query += " AND centro = %s"
                    params.append(filters["centro"])

                query += f" ORDER BY created_at DESC LIMIT {limit}"

                cursor.execute(query, params)
                rows = cursor.fetchall()

                solicitudes = [dict(row) for row in rows]

                return {
                    "data_type": "solicitudes",
                    "count": len(solicitudes),
                    "data": solicitudes,
                    "filters_applied": filters,
                }

        except Exception as e:
            logger.error(f"Error cargando solicitudes: {e}")
            return {
                "data_type": "solicitudes",
                "count": 0,
                "data": [],
                "error": str(e),
            }

    def _load_materiales(self, filters: Dict[str, Any], limit: int) -> Dict[str, Any]:
        """Carga materiales desde master_materiales (vista compatible en PG y SQLite)."""
        try:
            with _get_db_connection("master_materiales") as conn:
                cursor = conn.cursor()

                query = "SELECT codigo, descripcion, descripcion_larga, unidad_medida, precio_usd FROM catalogo_materiales WHERE 1=1"
                params = []

                # Búsqueda por descripción
                if "search" in filters:
                    search = build_description_search(filters["search"], ["descripcion", "descripcion_larga"])
                    if search:
                        query += f" AND {search.where_clause}"
                        params.extend(search.params)

                # Filtro por código
                if "codigo" in filters:
                    query += " AND codigo = ?"
                    params.append(filters["codigo"])

                query += f" LIMIT {limit}"

                cursor.execute(query, params)
                rows = cursor.fetchall()

                materiales = [dict(row) for row in rows]

                return {
                    "data_type": "materiales",
                    "count": len(materiales),
                    "data": materiales,
                    "filters_applied": filters,
                }

        except Exception as e:
            logger.error(f"Error cargando materiales: {e}")
            return {
                "data_type": "materiales",
                "count": 0,
                "data": [],
                "error": str(e),
            }

    def _load_stock(self, filters: Dict[str, Any], limit: int) -> Dict[str, Any]:
        """
        Carga datos de stock (vista compatible en PG y SQLite).

        Filtros soportados:
            - material: código de material (exacto o parcial con %)
            - centro: código de centro
            - almacen: código de almacén
            - min_stock: stock mínimo (para filtrar items sin stock)
        """
        try:
            with _get_db_connection("sap_data") as conn:
                cursor = conn.cursor()

                query = """
                    SELECT
                        material,
                        material_descripcion as descripcion,
                        stock,
                        precio,
                        stock_valorizado,
                        um as unidad_medida,
                        centro,
                        centro_descripcion,
                        almacen,
                        regional,
                        critico,
                        dia as fecha_actualizacion
                    FROM stock
                    WHERE 1=1
                """
                params: List[Any] = []

                if "material" in filters:
                    material = filters["material"]
                    if "%" in material:
                        query += " AND material LIKE ?"
                    else:
                        query += " AND material = ?"
                    params.append(material)

                if "centro" in filters:
                    query += " AND centro = ?"
                    params.append(filters["centro"])

                if "almacen" in filters:
                    query += " AND almacen = ?"
                    params.append(filters["almacen"])

                if "min_stock" in filters:
                    query += " AND stock >= ?"
                    params.append(filters["min_stock"])

                if filters.get("include_zero_stock", False) is False:
                    query += " AND stock > 0"

                query += f" ORDER BY stock DESC LIMIT {limit}"

                cursor.execute(query, params)
                rows = cursor.fetchall()

                stock_data = [dict(row) for row in rows]

                return {
                    "data_type": "stock",
                    "count": len(stock_data),
                    "data": stock_data,
                    "filters_applied": filters,
                }

        except Exception as e:
            logger.error(f"Error cargando stock: {e}")
            return {
                "data_type": "stock",
                "count": 0,
                "data": [],
                "error": str(e),
            }

    def _load_consumo_historico(
        self, filters: Dict[str, Any], limit: int
    ) -> Dict[str, Any]:
        """
        Carga historial de consumo (vista compatible en PG y SQLite).

        Filtros soportados:
            - material: código de material
            - centro: código de centro
            - fecha_desde: fecha mínima (YYYY-MM-DD)
            - fecha_hasta: fecha máxima (YYYY-MM-DD)
        """
        try:
            with _get_db_connection("sap_data") as conn:
                cursor = conn.cursor()

                query = """
                    SELECT
                        fecha,
                        material,
                        descripcion,
                        cantidad,
                        centro,
                        almacen
                    FROM consumo_historico
                    WHERE 1=1
                """
                params: List[Any] = []

                if "material" in filters:
                    query += " AND material = ?"
                    params.append(filters["material"])

                if "centro" in filters:
                    query += " AND centro = ?"
                    params.append(filters["centro"])

                if "fecha_desde" in filters:
                    query += " AND fecha >= ?"
                    params.append(filters["fecha_desde"])

                if "fecha_hasta" in filters:
                    query += " AND fecha <= ?"
                    params.append(filters["fecha_hasta"])

                query += f" ORDER BY fecha DESC LIMIT {limit}"

                cursor.execute(query, params)
                rows = cursor.fetchall()

                consumo_data = [dict(row) for row in rows]

                return {
                    "data_type": "consumo_historico",
                    "count": len(consumo_data),
                    "data": consumo_data,
                    "filters_applied": filters,
                }

        except Exception as e:
            logger.error(f"Error cargando consumo histórico: {e}")
            return {
                "data_type": "consumo_historico",
                "count": 0,
                "data": [],
                "error": str(e),
            }

    def get_stock_for_material(self, material_codigo: str) -> Dict[str, Any]:
        """
        Obtiene stock actual y métricas para un material específico.

        Args:
            material_codigo: Código del material

        Returns:
            Dict con:
            - stock_total: suma de stock en todos los centros
            - stock_por_centro: desglose por centro
            - demanda_promedio: promedio de consumo diario (si hay histórico)
            - ratio_stock_demanda: stock_total / demanda_promedio
            - dias_cobertura: días que cubre el stock actual
        """
        result = {
            "material": material_codigo,
            "stock_total": 0.0,
            "stock_por_centro": [],
            "demanda_promedio_diaria": 0.0,
            "ratio_stock_demanda": None,
            "dias_cobertura": None,
        }

        # Cargar stock
        stock_data = self._load_stock({"material": material_codigo}, limit=100)
        if stock_data["data"]:
            result["stock_total"] = sum(item["stock"] for item in stock_data["data"])
            result["stock_por_centro"] = [
                {
                    "centro": item["centro"],
                    "almacen": item.get("almacen"),
                    "stock": item["stock"],
                    "precio": item.get("precio"),
                }
                for item in stock_data["data"]
            ]

        # Cargar consumo histórico
        consumo_data = self._load_consumo_historico(
            {"material": material_codigo}, limit=365
        )
        if consumo_data["data"]:
            total_consumo = sum(item["cantidad"] for item in consumo_data["data"])
            dias_con_datos = len(set(item["fecha"] for item in consumo_data["data"]))

            if dias_con_datos > 0:
                result["demanda_promedio_diaria"] = total_consumo / dias_con_datos

                if result["demanda_promedio_diaria"] > 0:
                    result["ratio_stock_demanda"] = (
                        result["stock_total"] / result["demanda_promedio_diaria"]
                    )
                    result["dias_cobertura"] = result["ratio_stock_demanda"]

        return result

    def _load_presupuestos(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Carga presupuestos desde PostgreSQL."""
        try:
            with _get_db_connection() as conn:
                cursor = conn.cursor()

                query = "SELECT * FROM presupuesto WHERE 1=1"
                params = []

                if "centro" in filters:
                    query += " AND centro_id = %s"
                    params.append(filters["centro"])

                if "sector" in filters:
                    query += " AND sector_id = %s"
                    params.append(filters["sector"])

                cursor.execute(query, params)
                rows = cursor.fetchall()

                presupuestos = [dict(row) for row in rows]

                return {
                    "data_type": "presupuestos",
                    "count": len(presupuestos),
                    "data": presupuestos,
                }

        except Exception as e:
            logger.error(f"Error cargando presupuestos: {e}")
            return {"data_type": "presupuestos", "count": 0, "data": [], "error": str(e)}

    def _load_catalogs(self) -> Dict[str, Any]:
        """Carga catálogos desde PostgreSQL."""
        try:
            catalogs = {}

            with _get_db_connection() as conn:
                cursor = conn.cursor()

                # Centros
                cursor.execute("SELECT * FROM catalogo_centro LIMIT 100")
                catalogs["centros"] = [dict(row) for row in cursor.fetchall()]

                # Sectores
                cursor.execute("SELECT * FROM catalogo_sector LIMIT 100")
                catalogs["sectores"] = [dict(row) for row in cursor.fetchall()]

                # Almacenes (si existe)
                try:
                    cursor.execute("SELECT * FROM catalogo_almacen LIMIT 100")
                    catalogs["almacenes"] = [dict(row) for row in cursor.fetchall()]
                except Exception:
                    catalogs["almacenes"] = []

            return {"data_type": "catalogs", "data": catalogs}

        except Exception as e:
            logger.error(f"Error cargando catálogos: {e}")
            return {"data_type": "catalogs", "data": {}, "error": str(e)}

    def get_metadata(self) -> ToolMetadata:
        """Retorna metadatos de la herramienta."""
        return ToolMetadata(
            name=self.name,
            description=self.description,
            input_schema={
                "type": "object",
                "properties": {
                    "data_type": {
                        "type": "string",
                        "enum": [
                            "solicitudes",
                            "materiales",
                            "stock",
                            "consumo_historico",
                            "presupuestos",
                            "catalogs",
                        ],
                        "description": (
                            "Tipo de datos a cargar. 'stock' y 'consumo_historico' "
                            "provienen de sap_data.db (SQLite)"
                        ),
                    },
                    "filters": {"type": "object", "description": "Filtros a aplicar"},
                    "limit": {
                        "type": "integer",
                        "default": 100,
                        "description": "Límite de registros",
                    },
                },
                "required": ["data_type"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "data_type": {"type": "string"},
                    "count": {"type": "integer"},
                    "data": {"type": "array"},
                    "source": {"type": "string"},
                },
            },
        )
