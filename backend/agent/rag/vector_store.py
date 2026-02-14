"""
VectorStore para almacenamiento y búsqueda de embeddings.

Wrapper sobre ChromaDB con soporte para:
- Persistencia en disco
- Colecciones múltiples
- Búsqueda por similitud
- Metadata filtering
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Directorio por defecto para persistencia
DEFAULT_PERSIST_DIR = Path(__file__).parent.parent.parent.parent / "data" / "chroma"

# Singleton
_vector_store_instance: Optional["VectorStore"] = None


class VectorStore:
    """
    Almacén de vectores basado en ChromaDB.

    Proporciona:
    - Almacenamiento persistente de embeddings
    - Búsqueda por similitud coseno
    - Filtrado por metadata
    - Múltiples colecciones
    """

    def __init__(
        self,
        persist_directory: Optional[Path] = None,
        collection_name: str = "default",
    ):
        """
        Inicializa el vector store.

        Args:
            persist_directory: Directorio para persistencia
            collection_name: Nombre de la colección por defecto
        """
        try:
            import chromadb
            from chromadb.config import Settings
        except ImportError:
            raise ImportError(
                "chromadb no instalado. "
                "Ejecute: pip install chromadb>=0.4.0"
            )

        self.persist_directory = persist_directory or DEFAULT_PERSIST_DIR
        self.persist_directory = Path(self.persist_directory)
        self.persist_directory.mkdir(parents=True, exist_ok=True)

        logger.info(f"Inicializando ChromaDB en: {self.persist_directory}")

        # Crear cliente persistente
        self.client = chromadb.PersistentClient(
            path=str(self.persist_directory),
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True,
            ),
        )

        self.default_collection_name = collection_name
        self._collections: Dict[str, Any] = {}

    def get_or_create_collection(
        self,
        name: str = None,
        metadata: Dict[str, Any] = None,
    ):
        """
        Obtiene o crea una colección.

        Args:
            name: Nombre de la colección
            metadata: Metadata de la colección

        Returns:
            Colección de ChromaDB
        """
        name = name or self.default_collection_name

        if name not in self._collections:
            self._collections[name] = self.client.get_or_create_collection(
                name=name,
                metadata=metadata or {"hnsw:space": "cosine"},
            )
            logger.debug(f"Colección obtenida/creada: {name}")

        return self._collections[name]

    def add(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        documents: Optional[List[str]] = None,
        metadatas: Optional[List[Dict[str, Any]]] = None,
        collection_name: str = None,
    ) -> None:
        """
        Agrega documentos a la colección.

        Args:
            ids: IDs únicos de los documentos
            embeddings: Vectores de embedding
            documents: Textos originales (opcional)
            metadatas: Metadata por documento (opcional)
            collection_name: Nombre de la colección
        """
        collection = self.get_or_create_collection(collection_name)

        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

        logger.debug(f"Agregados {len(ids)} documentos a {collection_name or self.default_collection_name}")

    def upsert(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        documents: Optional[List[str]] = None,
        metadatas: Optional[List[Dict[str, Any]]] = None,
        collection_name: str = None,
    ) -> None:
        """
        Inserta o actualiza documentos.

        Args:
            ids: IDs únicos de los documentos
            embeddings: Vectores de embedding
            documents: Textos originales (opcional)
            metadatas: Metadata por documento (opcional)
            collection_name: Nombre de la colección
        """
        collection = self.get_or_create_collection(collection_name)

        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

        logger.debug(f"Upsert {len(ids)} documentos en {collection_name or self.default_collection_name}")

    def query(
        self,
        query_embeddings: List[List[float]],
        n_results: int = 10,
        where: Optional[Dict[str, Any]] = None,
        where_document: Optional[Dict[str, Any]] = None,
        include: List[str] = None,
        collection_name: str = None,
    ) -> Dict[str, Any]:
        """
        Busca documentos similares.

        Args:
            query_embeddings: Vectores de consulta
            n_results: Número de resultados por query
            where: Filtro de metadata
            where_document: Filtro de contenido
            include: Campos a incluir ('documents', 'metadatas', 'distances')
            collection_name: Nombre de la colección

        Returns:
            Dict con 'ids', 'documents', 'metadatas', 'distances'
        """
        collection = self.get_or_create_collection(collection_name)

        include = include or ["documents", "metadatas", "distances"]

        results = collection.query(
            query_embeddings=query_embeddings,
            n_results=n_results,
            where=where,
            where_document=where_document,
            include=include,
        )

        return results

    def search(
        self,
        query_embedding: List[float],
        n_results: int = 10,
        where: Optional[Dict[str, Any]] = None,
        collection_name: str = None,
    ) -> List[Dict[str, Any]]:
        """
        Búsqueda simplificada para una query.

        Args:
            query_embedding: Vector de consulta
            n_results: Número de resultados
            where: Filtro de metadata
            collection_name: Nombre de la colección

        Returns:
            Lista de resultados con 'id', 'document', 'metadata', 'distance'
        """
        results = self.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
            collection_name=collection_name,
        )

        # Convertir a formato más simple
        formatted = []
        for i, id_ in enumerate(results["ids"][0]):
            item = {
                "id": id_,
                "distance": results["distances"][0][i] if results.get("distances") else None,
                "document": results["documents"][0][i] if results.get("documents") else None,
                "metadata": results["metadatas"][0][i] if results.get("metadatas") else None,
            }
            # Convertir distancia a similitud (1 - distancia para coseno)
            if item["distance"] is not None:
                item["similarity"] = 1 - item["distance"]
            formatted.append(item)

        return formatted

    def count(self, collection_name: str = None) -> int:
        """Retorna número de documentos en la colección."""
        collection = self.get_or_create_collection(collection_name)
        return collection.count()

    def delete(
        self,
        ids: Optional[List[str]] = None,
        where: Optional[Dict[str, Any]] = None,
        collection_name: str = None,
    ) -> None:
        """
        Elimina documentos de la colección.

        Args:
            ids: IDs a eliminar
            where: Filtro de metadata
            collection_name: Nombre de la colección
        """
        collection = self.get_or_create_collection(collection_name)
        collection.delete(ids=ids, where=where)

    def reset_collection(self, collection_name: str = None) -> None:
        """Elimina y recrea la colección."""
        name = collection_name or self.default_collection_name
        try:
            self.client.delete_collection(name)
            logger.info(f"Colección eliminada: {name}")
        except Exception:
            pass  # La colección no existía

        if name in self._collections:
            del self._collections[name]

        self.get_or_create_collection(name)
        logger.info(f"Colección recreada: {name}")

    def list_collections(self) -> List[str]:
        """Lista todas las colecciones."""
        return [col.name for col in self.client.list_collections()]

    def get_info(self) -> Dict[str, Any]:
        """Retorna información del store."""
        collections = {}
        for name in self.list_collections():
            try:
                col = self.get_or_create_collection(name)
                collections[name] = {"count": col.count()}
            except Exception:
                collections[name] = {"count": 0, "error": "No disponible"}

        return {
            "persist_directory": str(self.persist_directory),
            "collections": collections,
            "total_collections": len(collections),
        }


def get_vector_store(
    persist_directory: Optional[Path] = None,
    collection_name: str = "default",
    force_new: bool = False,
) -> VectorStore:
    """
    Obtiene instancia singleton del vector store.

    Args:
        persist_directory: Directorio para persistencia
        collection_name: Nombre de la colección por defecto
        force_new: Forzar creación de nueva instancia

    Returns:
        Instancia de VectorStore
    """
    global _vector_store_instance

    if _vector_store_instance is None or force_new:
        _vector_store_instance = VectorStore(
            persist_directory=persist_directory,
            collection_name=collection_name,
        )

    return _vector_store_instance
