"""
RAG Pipeline - Retrieval-Augmented Generation para Materiales.

Pipeline completo que:
1. Recibe una consulta del usuario
2. Busca materiales relevantes (retrieval)
3. Genera respuesta contextualizada (generation)

Uso:
    from backend.agent.rag import RAGPipeline

    pipeline = RAGPipeline()
    response = pipeline.query("Necesito una bomba para agua")
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class RAGPipeline:
    """
    Pipeline RAG completo para consultas de materiales.

    Combina búsqueda semántica con generación de respuestas LLM
    para proporcionar asistencia inteligente en gestión de materiales.
    """

    def __init__(
        self,
        retriever=None,
        llm_client=None,
        llm_provider: str = "auto",
        n_results: int = 5,
        min_similarity: float = 0.3,
    ):
        """
        Inicializa el pipeline RAG.

        Args:
            retriever: MaterialRetriever (si None, crea uno)
            llm_client: Cliente LLM (si None, crea uno)
            llm_provider: Proveedor LLM ('openai', 'anthropic', 'auto', 'mock')
            n_results: Número de documentos a recuperar
            min_similarity: Similitud mínima para incluir documentos
        """
        # Lazy imports
        from .material_retriever import get_material_retriever
        from .llm_client import get_llm_client

        self.retriever = retriever or get_material_retriever()
        self.llm = llm_client or get_llm_client(provider=llm_provider)
        self.n_results = n_results
        self.min_similarity = min_similarity

        logger.info(
            f"RAGPipeline inicializado: "
            f"LLM={self.llm.provider}/{self.llm.model_name}, "
            f"n_results={n_results}"
        )

    def query(
        self,
        query: str,
        template: str = "general",
        include_stock: bool = True,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Procesa una consulta completa de RAG.

        Args:
            query: Pregunta del usuario
            template: Tipo de template a usar
            include_stock: Incluir información de stock
            **kwargs: Parámetros adicionales para el template

        Returns:
            Dict con:
            - response: Respuesta generada
            - sources: Documentos usados como contexto
            - query: Consulta original
            - template_used: Template utilizado
        """
        from .prompts import get_template

        # 1. Recuperar documentos relevantes
        logger.debug(f"Buscando documentos para: {query}")
        sources = self.retriever.search(
            query=query,
            n_results=self.n_results,
            min_similarity=self.min_similarity,
        )

        if not sources:
            return {
                "response": (
                    "No encontré materiales relevantes para tu consulta. "
                    "Intenta con términos más específicos o diferentes."
                ),
                "sources": [],
                "query": query,
                "template_used": template,
                "status": "no_results",
            }

        # 2. Obtener template
        try:
            prompt_template = get_template(template)
        except KeyError:
            logger.warning(f"Template '{template}' no encontrado, usando 'general'")
            prompt_template = get_template("general")

        # 3. Formatear contexto
        context_text = prompt_template.format_context(sources)

        # 4. Preparar parámetros del prompt
        prompt_params = {
            "context": context_text,
            "query": query,
            **kwargs,
        }

        # Agregar parámetros de stock si están disponibles
        if include_stock and sources:
            first_source = sources[0]
            prompt_params.setdefault("stock_total", first_source.get("stock", "N/A"))
            prompt_params.setdefault("demanda_diaria", kwargs.get("demanda_diaria", "N/A"))
            prompt_params.setdefault("lead_time", kwargs.get("lead_time", 14))
            prompt_params.setdefault("urgencia", kwargs.get("urgencia", "N/A"))
            prompt_params.setdefault("dias_cobertura", kwargs.get("dias_cobertura", "N/A"))
            prompt_params.setdefault("nivel_servicio", kwargs.get("nivel_servicio", 95))
            prompt_params.setdefault("material_original", query)

        # 5. Formatear prompt
        try:
            formatted_prompt = prompt_template.format(**prompt_params)
        except KeyError as e:
            logger.warning(f"Parámetro faltante en template: {e}")
            # Fallback a template general
            prompt_template = get_template("general")
            formatted_prompt = prompt_template.format(
                context=context_text,
                query=query,
            )

        # 6. Generar respuesta
        logger.debug(f"Generando respuesta con {self.llm.provider}")
        try:
            response = self.llm.generate(
                prompt=formatted_prompt,
                system_prompt=prompt_template.system_prompt,
                max_tokens=1024,
                temperature=0.7,
            )
        except Exception as e:
            logger.error(f"Error generando respuesta: {e}")
            response = (
                f"Error al generar respuesta: {e}\n\n"
                f"Materiales encontrados:\n{context_text}"
            )

        return {
            "response": response,
            "sources": sources,
            "query": query,
            "template_used": prompt_template.name,
            "status": "success",
            "llm": {
                "provider": self.llm.provider,
                "model": self.llm.model_name,
            },
        }

    def search(
        self,
        query: str,
        n_results: int = None,
    ) -> List[Dict[str, Any]]:
        """
        Solo búsqueda, sin generación LLM.

        Args:
            query: Consulta de búsqueda
            n_results: Número de resultados

        Returns:
            Lista de materiales encontrados
        """
        return self.retriever.search(
            query=query,
            n_results=n_results or self.n_results,
            min_similarity=self.min_similarity,
        )

    def find_equivalents(
        self,
        material_codigo: str,
        n_results: int = 5,
    ) -> Dict[str, Any]:
        """
        Encuentra materiales equivalentes.

        Args:
            material_codigo: Código del material original
            n_results: Número de alternativas a buscar

        Returns:
            Dict con equivalentes y explicación
        """
        # Buscar materiales similares
        similares = self.retriever.search_similar(
            material_codigo=material_codigo,
            n_results=n_results,
        )

        if not similares:
            return {
                "response": f"No encontré materiales similares a {material_codigo}",
                "equivalents": [],
                "material_original": material_codigo,
                "status": "no_results",
            }

        # Generar explicación con LLM
        from .prompts import get_template
        template = get_template("equivalents")

        context_text = template.format_context(similares)
        formatted_prompt = template.format(
            material_original=material_codigo,
            context=context_text,
            query=f"¿Cuáles de estos pueden sustituir al material {material_codigo}?",
        )

        try:
            response = self.llm.generate(
                prompt=formatted_prompt,
                system_prompt=template.system_prompt,
            )
        except Exception as e:
            response = f"Error generando análisis: {e}"

        return {
            "response": response,
            "equivalents": similares,
            "material_original": material_codigo,
            "status": "success",
        }

    def analyze_stock(
        self,
        query: str,
        stock_info: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Análisis de stock con contexto.

        Args:
            query: Pregunta sobre stock
            stock_info: Información de stock del DataLoader

        Returns:
            Dict con análisis y recomendaciones
        """
        stock_info = stock_info or {}

        return self.query(
            query=query,
            template="stock",
            stock_total=stock_info.get("stock_total", "N/A"),
            demanda_diaria=stock_info.get("demanda_promedio_diaria", "N/A"),
            lead_time=stock_info.get("lead_time", 14),
            urgencia=stock_info.get("urgencia", "N/A"),
            dias_cobertura=stock_info.get("dias_cobertura", "N/A"),
        )

    def get_info(self) -> Dict[str, Any]:
        """Retorna información del pipeline."""
        return {
            "retriever": self.retriever.get_stats(),
            "llm": {
                "provider": self.llm.provider,
                "model": self.llm.model_name,
            },
            "config": {
                "n_results": self.n_results,
                "min_similarity": self.min_similarity,
            },
        }


# Singleton
_pipeline_instance: Optional[RAGPipeline] = None


def get_rag_pipeline(
    llm_provider: str = "auto",
    force_new: bool = False,
) -> RAGPipeline:
    """
    Obtiene instancia singleton del pipeline RAG.

    Args:
        llm_provider: Proveedor LLM
        force_new: Forzar nueva instancia

    Returns:
        RAGPipeline configurado
    """
    global _pipeline_instance

    if _pipeline_instance is None or force_new:
        _pipeline_instance = RAGPipeline(llm_provider=llm_provider)

    return _pipeline_instance
