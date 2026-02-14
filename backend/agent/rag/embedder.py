"""
Embedder para generación de vectores semánticos.

Wrapper sobre SentenceTransformers con soporte para:
- Modelos multilingües (español/inglés)
- Batch processing para eficiencia
- Cache de modelo singleton
"""

import logging
from typing import List, Optional, Union

import numpy as np

logger = logging.getLogger(__name__)

# Modelo recomendado para español/multilingüe
DEFAULT_MODEL = "distiluse-base-multilingual-cased-v2"
# Alternativa más pequeña y rápida
LIGHTWEIGHT_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"

# Singleton para evitar cargar el modelo múltiples veces
_embedder_instance: Optional["Embedder"] = None


class Embedder:
    """
    Generador de embeddings semánticos.

    Usa SentenceTransformers para convertir texto a vectores densos
    que capturan el significado semántico.
    """

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
        device: str = "cpu",
        cache_folder: Optional[str] = None,
    ):
        """
        Inicializa el embedder.

        Args:
            model_name: Nombre del modelo de SentenceTransformers
            device: Dispositivo ('cpu', 'cuda', 'mps')
            cache_folder: Directorio para cache de modelos
        """
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise ImportError(
                "sentence-transformers no instalado. "
                "Ejecute: pip install sentence-transformers>=2.2.0"
            )

        self.model_name = model_name
        self.device = device

        logger.info(f"Cargando modelo de embeddings: {model_name}")
        self.model = SentenceTransformer(
            model_name,
            device=device,
            cache_folder=cache_folder,
        )
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        logger.info(
            f"Modelo cargado: {model_name} (dim={self.embedding_dim}, device={device})"
        )

    def encode(
        self,
        texts: Union[str, List[str]],
        batch_size: int = 32,
        show_progress: bool = False,
        normalize: bool = True,
    ) -> np.ndarray:
        """
        Genera embeddings para texto(s).

        Args:
            texts: Texto único o lista de textos
            batch_size: Tamaño de batch para procesamiento
            show_progress: Mostrar barra de progreso
            normalize: Normalizar vectores (recomendado para similitud coseno)

        Returns:
            Array de embeddings (n_texts, embedding_dim)
        """
        if isinstance(texts, str):
            texts = [texts]

        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=show_progress,
            normalize_embeddings=normalize,
            convert_to_numpy=True,
        )

        return embeddings

    def encode_single(self, text: str, normalize: bool = True) -> np.ndarray:
        """
        Genera embedding para un texto único.

        Args:
            text: Texto a codificar
            normalize: Normalizar vector

        Returns:
            Vector de embedding (embedding_dim,)
        """
        return self.encode([text], normalize=normalize)[0]

    def similarity(
        self,
        query: Union[str, np.ndarray],
        documents: Union[List[str], np.ndarray],
        top_k: int = 10,
    ) -> List[tuple]:
        """
        Calcula similitud entre query y documentos.

        Args:
            query: Texto o embedding de consulta
            documents: Lista de textos o matriz de embeddings
            top_k: Número de resultados más similares

        Returns:
            Lista de (índice, score) ordenados por similitud descendente
        """
        # Obtener embedding de query si es texto
        if isinstance(query, str):
            query_emb = self.encode_single(query)
        else:
            query_emb = query

        # Obtener embeddings de documentos si son textos
        if isinstance(documents, list) and isinstance(documents[0], str):
            doc_embs = self.encode(documents)
        else:
            doc_embs = documents

        # Calcular similitud coseno (embeddings ya normalizados)
        similarities = np.dot(doc_embs, query_emb)

        # Obtener top-k
        top_indices = np.argsort(similarities)[::-1][:top_k]
        results = [(int(idx), float(similarities[idx])) for idx in top_indices]

        return results

    def get_info(self) -> dict:
        """Retorna información del modelo."""
        return {
            "model_name": self.model_name,
            "embedding_dim": self.embedding_dim,
            "device": self.device,
            "max_seq_length": self.model.max_seq_length,
        }


def get_embedder(
    model_name: str = DEFAULT_MODEL,
    device: str = "cpu",
    force_new: bool = False,
) -> Embedder:
    """
    Obtiene instancia singleton del embedder.

    Args:
        model_name: Nombre del modelo
        device: Dispositivo a usar
        force_new: Forzar creación de nueva instancia

    Returns:
        Instancia de Embedder
    """
    global _embedder_instance

    if _embedder_instance is None or force_new:
        _embedder_instance = Embedder(model_name=model_name, device=device)

    return _embedder_instance
