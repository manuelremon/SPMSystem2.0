"""
Herramienta para buscar materiales en la BD de catálogo.

Ejecuta búsquedas con múltiples queries y calcula scores de relevancia.
"""

import logging
from typing import Any, Dict, List

from .base import BaseTool, ToolMetadata

logger = logging.getLogger(__name__)


# Importar get_db_connection del core
try:
    from backend.core.db import get_db_connection
except ImportError:
    from core.db import get_db_connection


# BD de catálogo de materiales
CATALOGO_DB = "catalogo_materiales"


class MaterialMatcher(BaseTool):
    """
    Busca materiales en la base de datos de catálogo SAP.

    Ejecuta búsquedas LIKE por descripción/descripción_larga
    y calcula un score de relevancia para ordenar resultados.
    """

    def __init__(self):
        super().__init__(
            name="material_matcher",
            description="Busca materiales en catálogo SAP por queries de texto",
        )

    def execute(
        self,
        queries: List[str] = None,
        limit: int = 20,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Busca materiales que coincidan con las queries.

        Args:
            queries: Lista de términos de búsqueda
            limit: Máximo de resultados a retornar

        Returns:
            Diccionario con lista de materiales encontrados
        """
        if not queries:
            return {"materiales": [], "count": 0}

        materiales = self.search_materials(queries, limit)

        return {
            "materiales": materiales,
            "count": len(materiales),
            "queries_used": queries,
        }

    def search_materials(
        self,
        queries: List[str],
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Busca materiales que coincidan con las queries.

        Args:
            queries: Lista de términos de búsqueda
            limit: Máximo de resultados

        Returns:
            Lista de materiales ordenados por score
        """
        results: List[Dict[str, Any]] = []
        seen_codes: set = set()

        try:
            with get_db_connection(CATALOGO_DB) as conn:
                cur = conn.cursor()

                for query in queries:
                    if not query or len(query) < 2:
                        continue

                    # Buscar en descripción y descripción_larga
                    pattern = f"%{query}%"
                    sql = """
                        SELECT codigo, descripcion, descripcion_larga,
                               grupo_articulos, unidad_medida, precio_usd
                        FROM materiales
                        WHERE activo = 1
                          AND (descripcion LIKE ? OR descripcion_larga LIKE ?)
                        ORDER BY codigo ASC
                        LIMIT 15
                    """
                    cur.execute(sql, (pattern, pattern))
                    rows = cur.fetchall()

                    for row in rows:
                        row_dict = dict(row)
                        codigo = row_dict["codigo"]

                        if codigo not in seen_codes:
                            seen_codes.add(codigo)
                            # Calcular score de relevancia
                            score = self._calculate_score(query, row_dict)
                            results.append(
                                {
                                    "codigo": codigo,
                                    "descripcion": row_dict["descripcion"],
                                    "descripcion_larga": row_dict.get("descripcion_larga"),
                                    "grupo_articulos": row_dict.get("grupo_articulos"),
                                    "unidad_medida": row_dict.get("unidad_medida"),
                                    "precio_usd": row_dict.get("precio_usd"),
                                    "match_query": query,
                                    "match_score": score,
                                }
                            )

        except Exception as e:
            logger.error(f"Error buscando materiales: {e}")
            return []

        # Ordenar por score descendente
        results.sort(key=lambda x: x["match_score"], reverse=True)

        return results[:limit]

    def _calculate_score(self, query: str, material: Dict[str, Any]) -> float:
        """
        Calcula score de relevancia (0.0 - 1.0).

        Considera:
        - Coincidencia exacta de todas las palabras
        - Porcentaje de palabras que coinciden
        - Coincidencia en descripción vs descripción_larga

        Args:
            query: Término de búsqueda
            material: Diccionario con datos del material

        Returns:
            Score de 0.0 a 1.0
        """
        desc = (material.get("descripcion") or "").lower()
        desc_larga = (material.get("descripcion_larga") or "").lower()
        full_desc = f"{desc} {desc_larga}"

        query_words = query.lower().split()
        if not query_words:
            return 0.0

        # Contar palabras que coinciden
        matches_desc = sum(1 for w in query_words if w in desc)
        matches_full = sum(1 for w in query_words if w in full_desc)

        # Porcentaje de palabras que coinciden
        match_ratio = matches_full / len(query_words)

        # Bonus si todas las palabras coinciden
        exact_match = matches_full == len(query_words)

        # Bonus si coincide en descripción principal (no solo en larga)
        desc_match_bonus = 0.1 if matches_desc == len(query_words) else 0.0

        # Calcular score final
        score = match_ratio * 0.6
        if exact_match:
            score += 0.3
        score += desc_match_bonus

        return min(score, 1.0)

    def get_metadata(self) -> ToolMetadata:
        """Retorna metadatos de la herramienta."""
        return ToolMetadata(
            name=self.name,
            description=self.description,
            input_schema={
                "type": "object",
                "properties": {
                    "queries": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Lista de términos de búsqueda",
                    },
                    "limit": {
                        "type": "integer",
                        "default": 20,
                        "description": "Máximo de resultados",
                    },
                },
                "required": ["queries"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "materiales": {"type": "array"},
                    "count": {"type": "integer"},
                    "queries_used": {"type": "array"},
                },
            },
        )
