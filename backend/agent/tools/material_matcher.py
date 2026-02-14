"""
Herramienta para buscar materiales en la BD de catálogo.

Ejecuta búsquedas con múltiples queries y calcula scores de relevancia.

Soporta dos modos de búsqueda:
1. SQL LIKE (por defecto): Coincidencia de subcadenas
2. Semántica (opcional): Usa embeddings para entender significado

Para habilitar búsqueda semántica:
    pip install sentence-transformers chromadb
"""

import logging
from typing import Any, Dict, List, Optional

from .base import BaseTool, ToolMetadata

logger = logging.getLogger(__name__)

# Flag para búsqueda semántica
_SEMANTIC_AVAILABLE = False
_semantic_retriever = None

try:
    from backend.agent.rag import is_available as rag_available
    if rag_available():
        _SEMANTIC_AVAILABLE = True
        logger.info("Búsqueda semántica disponible")
except ImportError:
    pass


# Importar get_db_connection del core
from backend.core.db import get_db_connection
from backend.core.search_utils import build_description_search


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
        use_semantic: bool = False,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Busca materiales que coincidan con las queries.

        Args:
            queries: Lista de términos de búsqueda
            limit: Máximo de resultados a retornar
            use_semantic: Usar búsqueda semántica (requiere RAG)

        Returns:
            Diccionario con lista de materiales encontrados
        """
        if not queries:
            return {"materiales": [], "count": 0}

        # Usar búsqueda semántica si está disponible y solicitada
        if use_semantic and _SEMANTIC_AVAILABLE:
            materiales = self.search_semantic(queries, limit)
            method = "semantic"
        else:
            materiales = self.search_materials(queries, limit)
            method = "sql_like"

        return {
            "materiales": materiales,
            "count": len(materiales),
            "queries_used": queries,
            "search_method": method,
            "semantic_available": _SEMANTIC_AVAILABLE,
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
                    search = build_description_search(query, ["descripcion", "descripcion_larga"])
                    if not search:
                        continue
                    sql = f"""
                        SELECT codigo, descripcion, descripcion_larga,
                               grupo_articulos, unidad_medida, precio_usd
                        FROM catalogo_materiales
                        WHERE activo = 1
                          AND {search.where_clause}
                        ORDER BY codigo ASC
                        LIMIT 15
                    """
                    cur.execute(sql, search.params)
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

    def search_semantic(
        self,
        queries: List[str],
        limit: int = 20,
        min_similarity: float = 0.3,
    ) -> List[Dict[str, Any]]:
        """
        Búsqueda semántica usando embeddings.

        Entiende el significado de la consulta, no solo coincidencia de palabras.

        Args:
            queries: Lista de términos de búsqueda
            limit: Máximo de resultados
            min_similarity: Similitud mínima (0-1)

        Returns:
            Lista de materiales ordenados por similitud semántica
        """
        global _semantic_retriever

        if not _SEMANTIC_AVAILABLE:
            logger.warning("Búsqueda semántica no disponible, usando fallback SQL")
            return self.search_materials(queries, limit)

        try:
            # Lazy load del retriever
            if _semantic_retriever is None:
                from backend.agent.rag import get_material_retriever
                _semantic_retriever = get_material_retriever()

                # Verificar si hay materiales indexados
                stats = _semantic_retriever.get_stats()
                if stats["indexed_count"] == 0:
                    logger.info("Indexando materiales para búsqueda semántica...")
                    _semantic_retriever.index_materials()

            # Combinar queries en una sola búsqueda
            combined_query = " ".join(queries)

            results = _semantic_retriever.search(
                query=combined_query,
                n_results=limit,
                min_similarity=min_similarity,
            )

            # Formatear resultados para compatibilidad con formato existente
            formatted = []
            for r in results:
                formatted.append({
                    "codigo": r["codigo"],
                    "descripcion": r.get("descripcion", ""),
                    "descripcion_larga": r.get("descripcion", ""),  # RAG no tiene desc_larga
                    "grupo_articulos": None,
                    "unidad_medida": r.get("unidad"),
                    "precio_usd": r.get("precio"),
                    "stock": r.get("stock"),
                    "match_query": combined_query,
                    "match_score": r.get("similarity", 0),
                    "match_percent": r.get("match_percent", 0),
                    "search_type": "semantic",
                })

            return formatted

        except Exception as e:
            logger.error(f"Error en búsqueda semántica: {e}")
            logger.info("Fallback a búsqueda SQL LIKE")
            return self.search_materials(queries, limit)

    @staticmethod
    def is_semantic_available() -> bool:
        """Verifica si la búsqueda semántica está disponible."""
        return _SEMANTIC_AVAILABLE

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
