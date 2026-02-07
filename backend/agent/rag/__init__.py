"""
Módulo RAG (Retrieval-Augmented Generation) para SPM v2.0
=========================================================

Proporciona búsqueda semántica de materiales y generación de respuestas
usando LLMs (Google Gemini, Anthropic Claude, OpenAI GPT, Deepseek-r1 local).

Componentes:
- Embedder: Genera embeddings con SentenceTransformers
- VectorStore: Almacena y busca vectores con ChromaDB
- MaterialRetriever: Búsqueda semántica de materiales
- LLMClient: Cliente multi-provider (Gemini/Anthropic/OpenAI/Deepseek)
- RAGPipeline: Pipeline completo retrieve + generate

Uso básico (solo búsqueda):
    from backend.agent.rag import MaterialRetriever

    retriever = MaterialRetriever()
    retriever.index_materials()  # Una vez
    results = retriever.search("bomba centrífuga para agua")

Uso completo (RAG con LLM):
    from backend.agent.rag import RAGPipeline

    pipeline = RAGPipeline(llm_provider="anthropic")
    response = pipeline.query("Necesito una bomba para agua fría")

Requisitos:
    # Búsqueda semántica
    pip install sentence-transformers>=2.2.0 chromadb>=0.4.0

    # LLM (opcional, uno de los dos)
    pip install openai>=1.0.0      # Para GPT
    pip install anthropic>=0.18.0  # Para Claude

Variables de entorno:
    OPENAI_API_KEY: API key de OpenAI
    ANTHROPIC_API_KEY: API key de Anthropic
"""

import logging

logger = logging.getLogger(__name__)

# Flags de disponibilidad
RAG_AVAILABLE = False
LLM_AVAILABLE = False

# =============================================================================
# Componentes de búsqueda semántica
# =============================================================================
try:
    from .embedder import Embedder, get_embedder
    from .material_retriever import MaterialRetriever, get_material_retriever
    from .vector_store import VectorStore, get_vector_store

    RAG_AVAILABLE = True
    logger.info("Módulo RAG (búsqueda semántica) cargado correctamente")
except ImportError as e:
    logger.info(
        f"Búsqueda semántica no disponible: {e}. "
        "Instale: pip install sentence-transformers chromadb"
    )

    # Clases stub
    class Embedder:
        def __init__(self, *args, **kwargs):
            raise ImportError("sentence-transformers no instalado")

    class VectorStore:
        def __init__(self, *args, **kwargs):
            raise ImportError("chromadb no instalado")

    class MaterialRetriever:
        def __init__(self, *args, **kwargs):
            raise ImportError("Dependencias RAG no instaladas")

    def get_embedder(*args, **kwargs):
        raise ImportError("sentence-transformers no instalado")

    def get_vector_store(*args, **kwargs):
        raise ImportError("chromadb no instalado")

    def get_material_retriever(*args, **kwargs):
        raise ImportError("Dependencias RAG no instaladas")


# =============================================================================
# Componentes de LLM
# =============================================================================
try:
    from .llm_client import (
        AnthropicClient,
        BaseLLMClient,
        MockLLMClient,
        OpenAIClient,
        get_llm_client,
    )
    from .deepseek_client import (
        DeepseekClient,
        OllamaConnectionError,
        OllamaModelNotFoundError,
    )
    from .pipeline import RAGPipeline, get_rag_pipeline
    from .prompts import (
        TEMPLATES,
        PromptTemplate,
        get_template,
        list_templates,
    )

    LLM_AVAILABLE = True
    logger.info("Módulo LLM/RAG Pipeline cargado correctamente")
except ImportError as e:
    logger.debug(f"Componentes LLM no disponibles: {e}")

    # Clases stub para LLM
    class BaseLLMClient:
        def __init__(self, *args, **kwargs):
            raise ImportError("Dependencias LLM no instaladas")

    class OpenAIClient(BaseLLMClient):
        pass

    class AnthropicClient(BaseLLMClient):
        pass

    class DeepseekClient(BaseLLMClient):
        pass

    class MockLLMClient(BaseLLMClient):
        pass

    class OllamaConnectionError(Exception):
        pass

    class OllamaModelNotFoundError(Exception):
        pass

    class RAGPipeline:
        def __init__(self, *args, **kwargs):
            raise ImportError("Dependencias RAG no instaladas")

    class PromptTemplate:
        def __init__(self, *args, **kwargs):
            pass

    TEMPLATES = {}

    def get_llm_client(*args, **kwargs):
        raise ImportError("Dependencias LLM no instaladas")

    def get_rag_pipeline(*args, **kwargs):
        raise ImportError("Dependencias RAG no instaladas")

    def get_template(*args, **kwargs):
        raise ImportError("Dependencias RAG no instaladas")

    def list_templates():
        return []


# =============================================================================
# Funciones de utilidad
# =============================================================================

def is_available() -> bool:
    """Verifica si la búsqueda semántica está disponible."""
    return RAG_AVAILABLE


def is_llm_available() -> bool:
    """Verifica si el pipeline LLM está disponible."""
    return LLM_AVAILABLE and RAG_AVAILABLE


def get_status() -> dict:
    """Retorna estado completo del módulo RAG."""
    status = {
        "semantic_search": RAG_AVAILABLE,
        "llm_pipeline": LLM_AVAILABLE and RAG_AVAILABLE,
        "components": {
            "embedder": RAG_AVAILABLE,
            "vector_store": RAG_AVAILABLE,
            "material_retriever": RAG_AVAILABLE,
            "llm_client": LLM_AVAILABLE,
            "rag_pipeline": LLM_AVAILABLE and RAG_AVAILABLE,
        },
    }

    if RAG_AVAILABLE:
        try:
            retriever = get_material_retriever()
            status["indexed_materials"] = retriever.get_stats().get("indexed_count", 0)
        except Exception:
            status["indexed_materials"] = 0

    return status


# =============================================================================
# Exports
# =============================================================================

__all__ = [
    # Búsqueda semántica
    "Embedder",
    "VectorStore",
    "MaterialRetriever",
    "get_embedder",
    "get_vector_store",
    "get_material_retriever",
    # LLM
    "BaseLLMClient",
    "OpenAIClient",
    "AnthropicClient",
    "DeepseekClient",
    "MockLLMClient",
    "get_llm_client",
    # Deepseek/Ollama errores
    "OllamaConnectionError",
    "OllamaModelNotFoundError",
    # Prompts
    "PromptTemplate",
    "get_template",
    "list_templates",
    "TEMPLATES",
    # Pipeline
    "RAGPipeline",
    "get_rag_pipeline",
    # Utilidades
    "is_available",
    "is_llm_available",
    "get_status",
    "RAG_AVAILABLE",
    "LLM_AVAILABLE",
]
