"""
MaterialRetriever - Búsqueda semántica de materiales.

Proporciona búsqueda de materiales por descripción natural
usando embeddings y similitud semántica.

Mejora sobre MaterialMatcher (SQL LIKE):
- Entiende sinónimos y variaciones
- Búsqueda por concepto, no solo palabras clave
- Resultados ordenados por relevancia semántica
"""

import logging
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Rutas a bases de datos
SAP_DATA_DB = Path("data/sap_data.db")
MASTER_MATERIALES_DB = Path("data/master_materiales.db")
# Alias para compatibilidad
CATALOGO_DB = MASTER_MATERIALES_DB

# Nombre de la colección para materiales
MATERIALS_COLLECTION = "materiales"

# Singleton
_retriever_instance: Optional["MaterialRetriever"] = None


class MaterialRetriever:
    """
    Buscador semántico de materiales.

    Usa embeddings para encontrar materiales por descripción natural,
    entendiendo el significado más allá de coincidencia de palabras.

    Ejemplo:
        retriever = MaterialRetriever()
        retriever.index_materials()  # Una vez
        results = retriever.search("bomba para agua")
    """

    def __init__(
        self,
        embedder=None,
        vector_store=None,
        batch_size: int = 500,
    ):
        """
        Inicializa el retriever.

        Args:
            embedder: Instancia de Embedder (si None, crea uno)
            vector_store: Instancia de VectorStore (si None, crea uno)
            batch_size: Tamaño de batch para indexación
        """
        from .embedder import get_embedder
        from .vector_store import get_vector_store

        self.embedder = embedder or get_embedder()
        self.vector_store = vector_store or get_vector_store(
            collection_name=MATERIALS_COLLECTION
        )
        self.batch_size = batch_size
        self._indexed = False

    def index_materials(
        self,
        source: str = "sap",
        force_reindex: bool = False,
    ) -> Dict[str, Any]:
        """
        Indexa materiales desde la base de datos.

        Args:
            source: Fuente de datos ('sap' o 'catalogo')
            force_reindex: Forzar reindexación completa

        Returns:
            Dict con estadísticas de indexación
        """
        # Verificar si ya hay datos indexados
        current_count = self.vector_store.count(MATERIALS_COLLECTION)
        if current_count > 0 and not force_reindex:
            logger.info(f"Ya hay {current_count} materiales indexados. Use force_reindex=True para reindexar.")
            self._indexed = True
            return {
                "status": "skipped",
                "reason": "already_indexed",
                "count": current_count,
            }

        # Resetear colección si force_reindex
        if force_reindex:
            self.vector_store.reset_collection(MATERIALS_COLLECTION)

        # Cargar materiales
        materiales = self._load_materials_from_db(source)
        if not materiales:
            return {
                "status": "error",
                "reason": "no_materials_found",
                "source": source,
            }

        logger.info(f"Indexando {len(materiales)} materiales...")

        # Procesar en batches
        total_indexed = 0
        for i in range(0, len(materiales), self.batch_size):
            batch = materiales[i : i + self.batch_size]

            # Preparar datos
            ids = [m["codigo"] for m in batch]
            texts = [self._prepare_text(m) for m in batch]
            metadatas = [
                {
                    "codigo": m["codigo"],
                    "descripcion": m.get("descripcion", ""),
                    "centro": m.get("centro", ""),
                    "unidad": m.get("unidad_medida", m.get("um", "")),
                    "precio": float(m.get("precio", 0) or 0),
                    "stock": float(m.get("stock", 0) or 0),
                }
                for m in batch
            ]

            # Generar embeddings
            embeddings = self.embedder.encode(texts, show_progress=False)

            # Insertar en vector store
            self.vector_store.upsert(
                ids=ids,
                embeddings=embeddings.tolist(),
                documents=texts,
                metadatas=metadatas,
                collection_name=MATERIALS_COLLECTION,
            )

            total_indexed += len(batch)
            if (i + self.batch_size) % 1000 == 0:
                logger.info(f"Progreso: {total_indexed}/{len(materiales)} materiales")

        self._indexed = True
        logger.info(f"Indexación completada: {total_indexed} materiales")

        return {
            "status": "success",
            "indexed": total_indexed,
            "source": source,
            "collection": MATERIALS_COLLECTION,
        }

    def index_from_catalogo(self, force_reindex: bool = False) -> Dict[str, Any]:
        """
        Indexa materiales desde catalogo_materiales.db.

        Este método es específico para indexar el catálogo completo de materiales
        que incluye descripciones largas, precios y grupos de artículos.

        Args:
            force_reindex: Forzar reindexación aunque ya existan datos

        Returns:
            Dict con estadísticas de indexación:
            {"status": "success", "indexed": int} o
            {"status": "skipped", "indexed": int, "reason": str}
        """
        # Verificar si ya hay suficientes datos indexados
        current_count = self.vector_store.count(MATERIALS_COLLECTION)
        if current_count > 40000 and not force_reindex:
            logger.info(f"RAG: Ya hay {current_count} materiales indexados. Use force_reindex=True para reindexar.")
            self._indexed = True
            return {
                "status": "skipped",
                "indexed": current_count,
                "reason": "already_indexed",
            }

        # Resetear colección si force_reindex
        if force_reindex and current_count > 0:
            logger.info("RAG: Reseteando colección para reindexación...")
            self.vector_store.reset_collection(MATERIALS_COLLECTION)

        # Verificar que la BD existe
        if not CATALOGO_DB.exists():
            logger.error(f"RAG: BD no encontrada: {CATALOGO_DB}")
            return {
                "status": "error",
                "reason": "database_not_found",
                "path": str(CATALOGO_DB),
            }

        try:
            conn = sqlite3.connect(CATALOGO_DB)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()

            # Query optimizada para catálogo de materiales (master_materiales.db)
            cur.execute("""
                SELECT
                    codigo,
                    descripcion,
                    descripcion_larga,
                    precio_usd,
                    grupo_articulos,
                    unidad_medida
                FROM catalogo_materiales
                WHERE activo = 1
                AND codigo IS NOT NULL
                AND descripcion IS NOT NULL
            """)

            materials = [dict(row) for row in cur.fetchall()]
            conn.close()

            if not materials:
                logger.warning("RAG: No se encontraron materiales activos en el catálogo")
                return {
                    "status": "error",
                    "reason": "no_materials_found",
                }

            logger.info(f"RAG: Indexando {len(materials)} materiales desde catálogo...")

            # Indexar en batches
            indexed = 0
            for i in range(0, len(materials), self.batch_size):
                batch = materials[i:i + self.batch_size]

                ids = [m["codigo"] for m in batch]

                # Texto para embedding: combinar descripción y descripción larga
                texts = []
                for m in batch:
                    text_parts = [m["descripcion"]]
                    if m.get("descripcion_larga"):
                        text_parts.append(m["descripcion_larga"])
                    texts.append(" | ".join(text_parts))

                # Metadata con información adicional
                metadatas = [{
                    "codigo": m["codigo"],
                    "descripcion": (m["descripcion"] or "")[:200],
                    "precio": float(m.get("precio_usd") or 0),
                    "grupo": int(m.get("grupo_articulos") or 0),
                    "unidad": m.get("unidad_medida") or "UNI",
                } for m in batch]

                # Generar embeddings
                embeddings = self.embedder.encode(texts, show_progress=False)

                # Insertar en ChromaDB
                self.vector_store.upsert(
                    ids=ids,
                    embeddings=embeddings.tolist(),
                    documents=texts,
                    metadatas=metadatas,
                    collection_name=MATERIALS_COLLECTION,
                )

                indexed += len(batch)

                # Log progreso cada 2000 materiales
                if indexed % 2000 == 0:
                    logger.info(f"RAG: Indexados {indexed}/{len(materials)} materiales")

            self._indexed = True
            logger.info(f"RAG: Indexación completada: {indexed} materiales")

            return {
                "status": "success",
                "indexed": indexed,
                "collection": MATERIALS_COLLECTION,
            }

        except Exception as e:
            logger.error(f"RAG: Error indexando catálogo: {e}")
            return {
                "status": "error",
                "reason": str(e),
            }

    def search(
        self,
        query: str,
        n_results: int = 10,
        min_similarity: float = 0.3,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Busca materiales por descripción semántica.

        Args:
            query: Descripción en lenguaje natural
            n_results: Número máximo de resultados
            min_similarity: Similitud mínima (0-1)
            filters: Filtros adicionales de metadata

        Returns:
            Lista de materiales con score de similitud
        """
        if not self._indexed and self.vector_store.count(MATERIALS_COLLECTION) == 0:
            raise ValueError(
                "No hay materiales indexados. Ejecute index_materials() primero."
            )

        # Generar embedding de la query
        query_embedding = self.embedder.encode_single(query)

        # Buscar en vector store
        results = self.vector_store.search(
            query_embedding=query_embedding.tolist(),
            n_results=n_results * 2,  # Pedir más para filtrar luego
            where=filters,
            collection_name=MATERIALS_COLLECTION,
        )

        # Filtrar por similitud mínima y formatear
        formatted = []
        for r in results:
            similarity = r.get("similarity", 0)
            if similarity >= min_similarity:
                item = {
                    "codigo": r["id"],
                    "descripcion": r.get("document", ""),
                    "similarity": round(similarity, 4),
                    "match_percent": round(similarity * 100, 1),
                }
                if r.get("metadata"):
                    item.update({
                        "centro": r["metadata"].get("centro"),
                        "unidad": r["metadata"].get("unidad"),
                        "precio": r["metadata"].get("precio"),
                        "stock": r["metadata"].get("stock"),
                    })
                formatted.append(item)

        # Limitar a n_results
        return formatted[:n_results]

    def search_similar(
        self,
        material_codigo: str,
        n_results: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Encuentra materiales similares a uno dado.

        Args:
            material_codigo: Código del material de referencia
            n_results: Número de resultados

        Returns:
            Lista de materiales similares
        """
        # Obtener embedding del material
        collection = self.vector_store.get_or_create_collection(MATERIALS_COLLECTION)
        try:
            result = collection.get(
                ids=[material_codigo],
                include=["embeddings", "documents"],
            )
            if not result["ids"]:
                raise ValueError(f"Material {material_codigo} no encontrado")

            embedding = result["embeddings"][0]
            document = result["documents"][0] if result.get("documents") else ""

        except Exception as e:
            raise ValueError(f"Error obteniendo material {material_codigo}: {e}")

        # Buscar similares (excluyendo el mismo)
        results = self.vector_store.search(
            query_embedding=embedding,
            n_results=n_results + 1,
            collection_name=MATERIALS_COLLECTION,
        )

        # Filtrar el material original y formatear
        formatted = []
        for r in results:
            if r["id"] != material_codigo:
                item = {
                    "codigo": r["id"],
                    "descripcion": r.get("document", ""),
                    "similarity": round(r.get("similarity", 0), 4),
                }
                if r.get("metadata"):
                    item.update(r["metadata"])
                formatted.append(item)

        return formatted[:n_results]

    def _load_materials_from_db(self, source: str) -> List[Dict[str, Any]]:
        """Carga materiales desde la base de datos."""
        if source == "sap":
            db_path = SAP_DATA_DB
            query = """
                SELECT DISTINCT
                    material as codigo,
                    material_descripcion as descripcion,
                    centro,
                    um as unidad_medida,
                    precio,
                    stock
                FROM stock
                WHERE material IS NOT NULL
                AND material_descripcion IS NOT NULL
            """
        elif source == "catalogo":
            db_path = CATALOGO_DB
            query = """
                SELECT DISTINCT
                    codigo,
                    descripcion,
                    unidad_medida
                FROM catalogo_materiales
                WHERE codigo IS NOT NULL
                AND descripcion IS NOT NULL
            """
        else:
            raise ValueError(f"Fuente no soportada: {source}")

        if not db_path.exists():
            logger.warning(f"BD no encontrada: {db_path}")
            return []

        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(query)
            rows = cursor.fetchall()
            conn.close()

            materiales = [dict(row) for row in rows]
            logger.info(f"Cargados {len(materiales)} materiales de {source}")
            return materiales

        except Exception as e:
            logger.error(f"Error cargando materiales de {source}: {e}")
            return []

    def _prepare_text(self, material: Dict[str, Any]) -> str:
        """Prepara texto para embedding."""
        parts = []

        # Descripción principal
        if material.get("descripcion"):
            parts.append(material["descripcion"])

        # Código (puede ayudar para búsquedas exactas)
        if material.get("codigo"):
            parts.append(f"código {material['codigo']}")

        # Unidad de medida
        if material.get("unidad_medida") or material.get("um"):
            um = material.get("unidad_medida") or material.get("um")
            parts.append(f"unidad {um}")

        return " | ".join(parts)

    def get_stats(self) -> Dict[str, Any]:
        """Retorna estadísticas del retriever."""
        return {
            "indexed_count": self.vector_store.count(MATERIALS_COLLECTION),
            "collection": MATERIALS_COLLECTION,
            "embedder": self.embedder.get_info(),
            "is_indexed": self._indexed,
        }


def get_material_retriever(
    force_new: bool = False,
) -> MaterialRetriever:
    """
    Obtiene instancia singleton del retriever.

    Args:
        force_new: Forzar creación de nueva instancia

    Returns:
        Instancia de MaterialRetriever
    """
    global _retriever_instance

    if _retriever_instance is None or force_new:
        _retriever_instance = MaterialRetriever()

    return _retriever_instance
