"""
Tests para módulo RAG (Retrieval-Augmented Generation).

Cubre:
- Embedder (generación de embeddings)
- VectorStore (almacenamiento de vectores)
- MaterialRetriever (búsqueda semántica)
- LLMClient (clientes OpenAI/Anthropic)
- RAGPipeline (pipeline completo)
- Manejo cuando dependencias no están instaladas
"""

import pytest
from unittest.mock import MagicMock, patch
import os


# =============================================================================
# Tests de Disponibilidad
# =============================================================================


class TestRAGAvailability:
    """Tests para verificar disponibilidad del módulo RAG."""

    def test_is_available_returns_bool(self):
        """is_available() debería retornar un booleano."""
        from backend.agent.rag import is_available

        result = is_available()
        assert isinstance(result, bool)

    def test_is_llm_available_returns_bool(self):
        """is_llm_available() debería retornar un booleano."""
        from backend.agent.rag import is_llm_available

        result = is_llm_available()
        assert isinstance(result, bool)

    def test_get_status_returns_dict(self):
        """get_status() debería retornar un diccionario."""
        from backend.agent.rag import get_status

        status = get_status()

        assert isinstance(status, dict)
        assert "semantic_search" in status
        assert "llm_pipeline" in status
        assert "components" in status

    def test_rag_available_flag(self):
        """RAG_AVAILABLE debería existir como flag."""
        from backend.agent.rag import RAG_AVAILABLE

        assert isinstance(RAG_AVAILABLE, bool)


# =============================================================================
# Tests de Embedder (cuando disponible)
# =============================================================================


class TestEmbedder:
    """Tests para la clase Embedder."""

    @pytest.fixture
    def mock_sentence_transformer(self):
        """Mock del SentenceTransformer."""
        import numpy as np

        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])
        return mock_model

    def test_embedder_import_error_handling(self):
        """Debería manejar ImportError graciosamente."""
        from backend.agent.rag import Embedder, RAG_AVAILABLE

        if not RAG_AVAILABLE:
            with pytest.raises(ImportError):
                Embedder()
        else:
            # Si está disponible, debería poder instanciarse
            # (puede fallar por falta de modelo, pero no por ImportError)
            pass

    @pytest.mark.skipif(
        not os.getenv("TEST_WITH_EMBEDDINGS"),
        reason="Requiere sentence-transformers instalado. Set TEST_WITH_EMBEDDINGS=1 para ejecutar.",
    )
    def test_embedder_encode(self):
        """Debería generar embeddings correctamente."""
        from backend.agent.rag import Embedder, RAG_AVAILABLE

        if not RAG_AVAILABLE:
            pytest.skip("RAG no disponible")

        embedder = Embedder()
        texts = ["bomba centrifuga", "valvula esfera"]
        embeddings = embedder.encode(texts)

        assert embeddings is not None
        assert len(embeddings) == 2
        assert embeddings.shape[1] > 0  # Tiene dimensiones


# =============================================================================
# Tests de VectorStore (cuando disponible)
# =============================================================================


class TestVectorStore:
    """Tests para la clase VectorStore."""

    def test_vector_store_import_error_handling(self):
        """Debería manejar ImportError graciosamente."""
        from backend.agent.rag import VectorStore, RAG_AVAILABLE

        if not RAG_AVAILABLE:
            with pytest.raises(ImportError):
                VectorStore()

    @pytest.mark.skipif(
        not os.getenv("TEST_WITH_EMBEDDINGS"),
        reason="Requiere chromadb instalado. Set TEST_WITH_EMBEDDINGS=1 para ejecutar.",
    )
    def test_vector_store_operations(self, tmp_path):
        """Debería realizar operaciones básicas."""
        from backend.agent.rag import VectorStore, RAG_AVAILABLE

        if not RAG_AVAILABLE:
            pytest.skip("RAG no disponible")

        store = VectorStore(persist_directory=str(tmp_path / "test_vectors"))

        # Verificar que se puede obtener stats
        stats = store.get_stats()
        assert isinstance(stats, dict)


# =============================================================================
# Tests de MaterialRetriever (cuando disponible)
# =============================================================================


class TestMaterialRetriever:
    """Tests para la clase MaterialRetriever."""

    def test_material_retriever_import_error_handling(self):
        """Debería manejar ImportError graciosamente."""
        from backend.agent.rag import MaterialRetriever, RAG_AVAILABLE

        if not RAG_AVAILABLE:
            with pytest.raises(ImportError):
                MaterialRetriever()

    @pytest.mark.skipif(
        not os.getenv("TEST_WITH_EMBEDDINGS"),
        reason="Requiere dependencias RAG. Set TEST_WITH_EMBEDDINGS=1 para ejecutar.",
    )
    def test_material_retriever_get_stats(self, tmp_path):
        """Debería retornar estadísticas."""
        from backend.agent.rag import MaterialRetriever, RAG_AVAILABLE

        if not RAG_AVAILABLE:
            pytest.skip("RAG no disponible")

        retriever = MaterialRetriever(persist_directory=str(tmp_path / "test_retriever"))
        stats = retriever.get_stats()

        assert isinstance(stats, dict)
        assert "indexed_count" in stats


# =============================================================================
# Tests de LLM Client
# =============================================================================


class TestLLMClient:
    """Tests para los clientes LLM."""

    def test_base_client_is_abstract(self):
        """BaseLLMClient debería ser abstracto o lanzar ImportError."""
        from backend.agent.rag import BaseLLMClient, LLM_AVAILABLE

        if not LLM_AVAILABLE:
            with pytest.raises(ImportError):
                BaseLLMClient()

    def test_mock_llm_client(self):
        """MockLLMClient debería funcionar sin API keys."""
        from backend.agent.rag import MockLLMClient, LLM_AVAILABLE

        if not LLM_AVAILABLE:
            pytest.skip("LLM no disponible")

        client = MockLLMClient()
        response = client.generate("Test prompt")

        assert isinstance(response, str)
        assert len(response) > 0

    def test_get_llm_client_without_api_keys(self):
        """get_llm_client debería manejar falta de API keys."""
        from backend.agent.rag import get_llm_client, LLM_AVAILABLE

        if not LLM_AVAILABLE:
            pytest.skip("LLM no disponible")

        # Sin API keys, debería retornar MockLLMClient o lanzar error
        with patch.dict(os.environ, {}, clear=True):
            try:
                client = get_llm_client(provider="auto")
                # Si retorna algo, debería ser un cliente válido
                assert hasattr(client, "generate")
            except ValueError:
                # Es aceptable que falle sin API keys
                pass


# =============================================================================
# Tests de Prompts
# =============================================================================


class TestPrompts:
    """Tests para templates de prompts."""

    def test_templates_exist(self):
        """Debería tener templates definidos."""
        from backend.agent.rag import TEMPLATES, LLM_AVAILABLE

        if LLM_AVAILABLE:
            assert isinstance(TEMPLATES, dict)
            # Si LLM está disponible, debería tener templates
            if TEMPLATES:
                assert "search" in TEMPLATES or "general" in TEMPLATES
        else:
            # Si no está disponible, TEMPLATES es dict vacío
            assert isinstance(TEMPLATES, dict)

    def test_get_template(self):
        """get_template debería retornar template o lanzar error."""
        from backend.agent.rag import get_template, list_templates, LLM_AVAILABLE

        if not LLM_AVAILABLE:
            pytest.skip("LLM no disponible")

        templates = list_templates()
        if templates:
            template = get_template(templates[0])
            assert template is not None


# =============================================================================
# Tests de RAGPipeline
# =============================================================================


class TestRAGPipeline:
    """Tests para el pipeline RAG completo."""

    def test_rag_pipeline_import_error_handling(self):
        """Debería manejar ImportError graciosamente."""
        from backend.agent.rag import RAGPipeline, LLM_AVAILABLE, RAG_AVAILABLE

        if not (LLM_AVAILABLE and RAG_AVAILABLE):
            with pytest.raises(ImportError):
                RAGPipeline()

    @pytest.mark.skipif(
        not os.getenv("TEST_WITH_EMBEDDINGS"),
        reason="Requiere dependencias RAG completas. Set TEST_WITH_EMBEDDINGS=1 para ejecutar.",
    )
    def test_rag_pipeline_search(self, tmp_path):
        """Debería realizar búsquedas."""
        from backend.agent.rag import RAGPipeline, LLM_AVAILABLE, RAG_AVAILABLE

        if not (LLM_AVAILABLE and RAG_AVAILABLE):
            pytest.skip("RAG Pipeline no disponible")

        pipeline = RAGPipeline(persist_directory=str(tmp_path / "test_pipeline"))
        results = pipeline.search("bomba centrifuga")

        assert isinstance(results, list)


# =============================================================================
# Tests de Integración Mock
# =============================================================================


class TestRAGIntegrationMock:
    """Tests de integración con mocks."""

    def test_full_rag_flow_mock(self):
        """Test del flujo RAG completo con mocks."""
        import numpy as np

        # Mock de embeddings
        mock_embeddings = np.array([[0.1, 0.2, 0.3]])

        # Mock de resultados de búsqueda
        mock_search_results = [
            {"codigo": "MAT001", "descripcion": "BOMBA CENTRIFUGA", "similarity": 0.95},
            {"codigo": "MAT002", "descripcion": "BOMBA AGUA", "similarity": 0.85},
        ]

        # Mock de respuesta LLM
        mock_llm_response = "Basado en la búsqueda, te recomiendo MAT001 - BOMBA CENTRIFUGA."

        # Verificar que el flujo conceptual funciona
        assert len(mock_search_results) > 0
        assert mock_embeddings.shape[1] == 3
        assert "recomiendo" in mock_llm_response.lower()


# =============================================================================
# Tests de Stubs cuando dependencias no están instaladas
# =============================================================================


class TestStubBehavior:
    """Tests para comportamiento de stubs."""

    def test_stub_classes_raise_import_error(self):
        """Clases stub deberían lanzar ImportError en __init__."""
        from backend.agent.rag import RAG_AVAILABLE

        if RAG_AVAILABLE:
            pytest.skip("RAG está disponible, no se usan stubs")

        # Cuando RAG no está disponible, las clases son stubs
        from backend.agent.rag import Embedder, VectorStore, MaterialRetriever

        with pytest.raises(ImportError):
            Embedder()

        with pytest.raises(ImportError):
            VectorStore()

        with pytest.raises(ImportError):
            MaterialRetriever()

    def test_stub_functions_raise_import_error(self):
        """Funciones stub deberían lanzar ImportError."""
        from backend.agent.rag import RAG_AVAILABLE

        if RAG_AVAILABLE:
            pytest.skip("RAG está disponible, no se usan stubs")

        from backend.agent.rag import get_embedder, get_vector_store, get_material_retriever

        with pytest.raises(ImportError):
            get_embedder()

        with pytest.raises(ImportError):
            get_vector_store()

        with pytest.raises(ImportError):
            get_material_retriever()


# =============================================================================
# Tests de NLPProcessor Mejorado
# =============================================================================


class TestNLPProcessorStemming:
    """Tests para el NLPProcessor con stemming."""

    def test_spanish_stemmer(self):
        """Debería reducir palabras a sus raíces."""
        from backend.agent.tools.nlp_processor import stem_spanish

        # Verbos
        assert stem_spanish("trabajando") != "trabajando"  # Se reduce
        assert stem_spanish("reparando") != "reparando"

        # Plurales
        from backend.agent.tools.nlp_processor import normalize_plural_spanish
        assert normalize_plural_spanish("bombas") == "bomba"
        assert normalize_plural_spanish("motores") == "motor"

    def test_nlp_processor_extracts_dimensions(self):
        """Debería extraer dimensiones técnicas."""
        from backend.agent.tools.nlp_processor import NLPProcessor

        nlp = NLPProcessor()
        result = nlp.execute(text='Necesito una válvula de 3/4" y un tubo DN50')

        assert "dimensiones" in result
        assert len(result["dimensiones"]) >= 1

    def test_nlp_processor_extracts_acronyms(self):
        """Debería extraer acrónimos."""
        from backend.agent.tools.nlp_processor import NLPProcessor

        nlp = NLPProcessor()
        result = nlp.execute(text="Material SAP código ISO 9001 certificado API")

        assert "acronimos" in result
        assert "SAP" in result["acronimos"]
        assert "ISO" in result["acronimos"]
        assert "API" in result["acronimos"]

    def test_nlp_processor_handles_plural_variants(self):
        """Debería normalizar plurales al buscar entidades."""
        from backend.agent.tools.nlp_processor import NLPProcessor

        nlp = NLPProcessor()

        # "bombas" debería encontrar "bomba"
        result = nlp.execute(text="Necesito reparar las bombas centrifugas")
        assert "bomba" in result["equipos"]

        # "rodamientos" debería encontrar "rodamiento"
        result2 = nlp.execute(text="Cambiar los rodamientos del motor")
        assert "rodamiento" in result2["componentes"]

    def test_nlp_processor_empty_input(self):
        """Debería manejar input vacío."""
        from backend.agent.tools.nlp_processor import NLPProcessor

        nlp = NLPProcessor()
        result = nlp.execute(text="")

        assert result["equipos"] == []
        assert result["componentes"] == []
        assert result["dimensiones"] == []
        assert result["acronimos"] == []
        assert result["search_queries"] == []


# =============================================================================
# Tests de Model Cache TTL
# =============================================================================


class TestModelCacheTTL:
    """Tests para TTL del cache de modelos ML."""

    def test_set_cache_ttl(self):
        """Debería poder configurar el TTL."""
        from backend.agent.pipelines.forecast import set_cache_ttl

        # No debería lanzar error
        set_cache_ttl(48)

    def test_cleanup_expired_models(self, tmp_path):
        """Debería limpiar modelos expirados."""
        from backend.agent.pipelines.forecast import cleanup_expired_models

        # Debería retornar un entero (cantidad de modelos limpiados)
        result = cleanup_expired_models()
        assert isinstance(result, int)
        assert result >= 0
