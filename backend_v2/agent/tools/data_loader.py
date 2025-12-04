"""
Herramienta para cargar datos del sistema SPM.

Carga solicitudes, materiales, stock, presupuestos desde BD.
"""

import logging
import sqlite3
from pathlib import Path
from typing import Any, Dict, Optional

from .base import BaseTool, ToolError, ToolMetadata

logger = logging.getLogger(__name__)


class DataLoader(BaseTool):
    """
    Herramienta para cargar datos del sistema SPM.

    Soporta:
    - Solicitudes (todas, por usuario, por estado)
    - Materiales (búsqueda, filtros)
    - Stock disponible
    - Presupuestos por centro/sector
    - Información de centros, sectores, almacenes
    """

    def __init__(self, db_path: str = "backend_v2/spm.db"):
        """
        Inicializa el cargador de datos.

        Args:
            db_path: Ruta a la BD SQLite
        """
        super().__init__(
            name="load_data",
            description="Carga datos del sistema SPM (solicitudes, materiales, stock, etc.)",
        )
        self.db_path = Path(db_path)
        if not self.db_path.exists():
            logger.warning(f"BD no encontrada: {db_path}")

    def execute(
        self,
        data_type: str = "solicitudes",
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """
        Carga datos según el tipo especificado.

        Args:
            data_type: Tipo de datos ('solicitudes', 'materiales', 'stock', 'presupuestos')
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
        elif data_type == "presupuestos":
            return self._load_presupuestos(filters)
        elif data_type == "catalogs":
            return self._load_catalogs()
        else:
            raise ToolError(f"Tipo de dato no soportado: {data_type}")

    def _load_solicitudes(self, filters: Dict[str, Any], limit: int) -> Dict[str, Any]:
        """Carga solicitudes de la BD."""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = "SELECT * FROM solicitudes WHERE 1=1"
            params = []

            # Aplicar filtros
            if "estado" in filters:
                query += " AND status = ?"
                params.append(filters["estado"])

            if "usuario_id" in filters:
                query += " AND id_usuario = ?"
                params.append(filters["usuario_id"])

            if "centro" in filters:
                query += " AND centro = ?"
                params.append(filters["centro"])

            query += f" LIMIT {limit}"

            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()

            solicitudes = [dict(row) for row in rows]

            return {
                "data_type": "solicitudes",
                "count": len(solicitudes),
                "data": solicitudes,
                "filters_applied": filters,
            }

        except Exception as e:
            logger.error(f"Error cargando solicitudes: {e}")
            raise ToolError(f"No se pudieron cargar solicitudes: {e}")

    def _load_materiales(self, filters: Dict[str, Any], limit: int) -> Dict[str, Any]:
        """Carga materiales de la BD."""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = "SELECT * FROM materiales WHERE 1=1"
            params = []

            # Búsqueda por descripción
            if "search" in filters:
                query += " AND descripcion LIKE ?"
                params.append(f"%{filters['search']}%")

            # Filtro por código
            if "codigo" in filters:
                query += " AND codigo = ?"
                params.append(filters["codigo"])

            query += f" LIMIT {limit}"

            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()

            materiales = [dict(row) for row in rows]

            return {
                "data_type": "materiales",
                "count": len(materiales),
                "data": materiales,
                "filters_applied": filters,
            }

        except Exception as e:
            logger.error(f"Error cargando materiales: {e}")
            raise ToolError(f"No se pudieron cargar materiales: {e}")

    def _load_stock(self, filters: Dict[str, Any], limit: int) -> Dict[str, Any]:
        """Carga datos de stock (desde Excel o tabla en BD)."""
        # Nota: Implementación simplificada
        # En producción, conectaría con sistema de stock real

        return {
            "data_type": "stock",
            "count": 0,
            "data": [],
            "note": "Stock loader no implementado",
        }

    def _load_presupuestos(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Carga presupuestos por centro/sector."""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            query = "SELECT * FROM presupuestos WHERE 1=1"
            params = []

            if "centro" in filters:
                query += " AND centro = ?"
                params.append(filters["centro"])

            if "sector" in filters:
                query += " AND sector = ?"
                params.append(filters["sector"])

            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()

            presupuestos = [dict(row) for row in rows]

            return {"data_type": "presupuestos", "count": len(presupuestos), "data": presupuestos}

        except Exception as e:
            logger.error(f"Error cargando presupuestos: {e}")
            return {"data_type": "presupuestos", "count": 0, "data": [], "error": str(e)}

    def _load_catalogs(self) -> Dict[str, Any]:
        """Carga catálogos (centros, sectores, almacenes)."""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Cargar cada catálogo
            catalogs = {}

            cursor.execute("SELECT * FROM catalog_centros LIMIT 100")
            catalogs["centros"] = [dict(row) for row in cursor.fetchall()]

            cursor.execute("SELECT * FROM catalog_sectores LIMIT 100")
            catalogs["sectores"] = [dict(row) for row in cursor.fetchall()]

            cursor.execute("SELECT * FROM catalog_almacenes LIMIT 100")
            catalogs["almacenes"] = [dict(row) for row in cursor.fetchall()]

            conn.close()

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
                        "enum": ["solicitudes", "materiales", "stock", "presupuestos", "catalogs"],
                        "description": "Tipo de datos a cargar",
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
                },
            },
        )
