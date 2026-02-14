"""
Rutas del Asistente NLP para sugerir materiales.

Endpoints:
- /api/assistant/solicitudes/sugerir: Sugerencias basadas en NLP
- /api/assistant/rag/query: Consultas RAG con LLM (si disponible)
- /api/assistant/rag/search: Búsqueda semántica (si disponible)
"""

import logging

from flask import Blueprint, jsonify, request

from backend.agent.tools.material_matcher import MaterialMatcher
from backend.agent.tools.nlp_processor import NLPProcessor

# Importar RAG si está disponible
try:
    from backend.agent.rag import (
        get_status as get_rag_status,
    )
    from backend.agent.rag import (
        is_available as rag_available,
    )
    from backend.agent.rag import (
        is_llm_available,
    )
    RAG_ENABLED = rag_available()
except ImportError:
    RAG_ENABLED = False

    def rag_available():
        return False

    def is_llm_available():
        return False

    def get_rag_status():
        return {"semantic_search": False, "llm_pipeline": False}


logger = logging.getLogger(__name__)

bp = Blueprint("assistant", __name__, url_prefix="/api/assistant")

# Inicializar herramientas
nlp = NLPProcessor()
matcher = MaterialMatcher()


@bp.route("/solicitudes/sugerir", methods=["POST"])
def sugerir_materiales():
    """
    Analiza descripción de problema y sugiere materiales.

    Request JSON:
    {
        "descripcion": "Se rompió la bomba de agua de la línea 3, pierde por el sello mecánico",
        "sector_id": 12,          # opcional
        "criticidad": "alta"      # baja|normal|alta (default: normal)
    }

    Response:
    {
        "ok": true,
        "analisis": {
            "equipos_detectados": ["bomba"],
            "componentes_detectados": ["sello"],
            "tipo_falla": ["fuga", "rotura"],
            "keywords": ["agua", "linea", "mecanico"]
        },
        "sugerencias": [
            {
                "material_id": "1234567",
                "codigo_sap": "1234567",
                "descripcion": "SELLO MECANICO BOMBA AGUA",
                "descripcion_larga": "Sello mecánico para bomba de agua...",
                "cantidad_sugerida": 2,
                "unidad": "UN",
                "precio_unitario": 150.00,
                "motivo": "Coincide con 'sello bomba'",
                "score": 0.92
            }
        ],
        "justificacion_generada": "Solicitud de repuestos para bomba - fuga, rotura"
    }
    """
    try:
        data = request.get_json() or {}
        descripcion = data.get("descripcion", "").strip()
        criticidad = data.get("criticidad", "normal").lower()

        if not descripcion:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "missing_description",
                            "message": "Se requiere una descripción del problema",
                        },
                    }
                ),
                400,
            )

        # 1. Extraer entidades del texto
        nlp_result = nlp.execute(text=descripcion)
        entities = {
            "equipos": nlp_result.get("equipos", []),
            "componentes": nlp_result.get("componentes", []),
            "tipo_falla": nlp_result.get("tipo_falla", []),
            "keywords": nlp_result.get("keywords", []),
        }
        queries = nlp_result.get("search_queries", [])

        logger.info(
            f"NLP extracted: equipos={entities['equipos']}, componentes={entities['componentes']}"
        )
        logger.info(f"Search queries: {queries}")

        # 2. Buscar materiales
        if queries:
            match_result = matcher.execute(queries=queries, limit=15)
            materiales = match_result.get("materiales", [])
        else:
            materiales = []

        # 3. Ajustar cantidades según criticidad
        sugerencias = []
        for mat in materiales:
            cantidad = 1
            unidad = mat.get("unidad_medida", "UN")

            # Criticidad alta: sugerir repuesto adicional
            if criticidad == "alta":
                cantidad = 2
            # Unidades a granel: sugerir cantidad mayor
            elif unidad in ["M", "KG", "LT", "L", "MT"]:
                cantidad = 5

            sugerencias.append(
                {
                    "material_id": mat["codigo"],
                    "codigo_sap": mat["codigo"],
                    "descripcion": mat["descripcion"],
                    "descripcion_larga": mat.get("descripcion_larga"),
                    "cantidad_sugerida": cantidad,
                    "unidad": unidad,
                    "precio_unitario": mat.get("precio_usd") or 0,
                    "motivo": f"Coincide con '{mat.get('match_query', '')}'",
                    "score": round(mat.get("match_score", 0), 2),
                }
            )

        # 4. Generar justificación automática
        equipos_str = ", ".join(entities["equipos"]) if entities["equipos"] else "equipo"
        falla_str = ", ".join(entities["tipo_falla"]) if entities["tipo_falla"] else "mantenimiento"
        justificacion = f"Solicitud de repuestos para {equipos_str} - {falla_str}"

        return (
            jsonify(
                {
                    "ok": True,
                    "analisis": {
                        "equipos_detectados": entities["equipos"],
                        "componentes_detectados": entities["componentes"],
                        "tipo_falla": entities["tipo_falla"],
                        "keywords": entities["keywords"][:10],
                    },
                    "sugerencias": sugerencias,
                    "justificacion_generada": justificacion,
                }
            ),
            200,
        )

    except Exception as e:
        logger.exception(f"Error en sugerir_materiales: {e}")
        return jsonify({"ok": False, "error": {"code": "internal_error", "message": str(e)}}), 500


@bp.route("/health", methods=["GET"])
def health():
    """Health check del módulo assistant."""
    return (
        jsonify(
            {
                "ok": True,
                "module": "assistant",
                "tools": ["nlp_processor", "material_matcher"],
                "rag_available": RAG_ENABLED,
                "rag_status": get_rag_status() if RAG_ENABLED else None,
            }
        ),
        200,
    )


# =============================================================================
# Endpoints RAG (Retrieval-Augmented Generation)
# =============================================================================


@bp.route("/rag/status", methods=["GET"])
def rag_status():
    """
    Estado del módulo RAG.

    Response:
    {
        "available": true,
        "semantic_search": true,
        "llm_pipeline": true,
        "indexed_materials": 28000
    }
    """
    status = get_rag_status()
    return jsonify({
        "ok": True,
        "available": RAG_ENABLED,
        **status,
    }), 200


@bp.route("/rag/search", methods=["POST"])
def rag_search():
    """
    Búsqueda semántica de materiales.

    Request JSON:
    {
        "query": "bomba centrífuga para agua fría",
        "n_results": 10,
        "min_similarity": 0.3
    }

    Response:
    {
        "ok": true,
        "results": [...],
        "count": 10,
        "method": "semantic"
    }
    """
    if not RAG_ENABLED:
        return jsonify({
            "ok": False,
            "error": {
                "code": "rag_not_available",
                "message": "RAG no disponible. Instale: pip install sentence-transformers chromadb",
            },
        }), 503

    try:
        from backend.agent.rag import get_material_retriever

        data = request.get_json() or {}
        query = data.get("query", "").strip()

        if not query:
            return jsonify({
                "ok": False,
                "error": {"code": "missing_query", "message": "Se requiere un query"},
            }), 400

        n_results = data.get("n_results", 10)
        min_similarity = data.get("min_similarity", 0.3)

        retriever = get_material_retriever()

        # Verificar si hay materiales indexados
        stats = retriever.get_stats()
        if stats.get("indexed_count", 0) == 0:
            logger.info("Indexando materiales para RAG...")
            retriever.index_materials()

        results = retriever.search(
            query=query,
            n_results=n_results,
            min_similarity=min_similarity,
        )

        return jsonify({
            "ok": True,
            "results": results,
            "count": len(results),
            "method": "semantic",
            "query": query,
        }), 200

    except Exception as e:
        logger.exception(f"Error en búsqueda RAG: {e}")
        return jsonify({
            "ok": False,
            "error": {"code": "rag_error", "message": str(e)},
        }), 500


@bp.route("/rag/query", methods=["POST"])
def rag_query():
    """
    Consulta RAG completa (retrieve + generate).

    Requiere API key de OpenAI o Anthropic configurada.

    Request JSON:
    {
        "query": "Necesito una bomba para agua fría, ¿cuál me recomiendas?",
        "template": "search",  // search, compare, stock, general
        "n_results": 5
    }

    Response:
    {
        "ok": true,
        "response": "Basándome en tu consulta, te recomiendo...",
        "sources": [...],
        "template_used": "search"
    }
    """
    if not RAG_ENABLED:
        return jsonify({
            "ok": False,
            "error": {
                "code": "rag_not_available",
                "message": "RAG no disponible. Instale: pip install sentence-transformers chromadb",
            },
        }), 503

    if not is_llm_available():
        return jsonify({
            "ok": False,
            "error": {
                "code": "llm_not_available",
                "message": "LLM no disponible. Configure OPENAI_API_KEY o ANTHROPIC_API_KEY",
            },
        }), 503

    try:
        from backend.agent.rag import get_rag_pipeline

        data = request.get_json() or {}
        query = data.get("query", "").strip()

        if not query:
            return jsonify({
                "ok": False,
                "error": {"code": "missing_query", "message": "Se requiere un query"},
            }), 400

        template = data.get("template", "general")
        n_results = data.get("n_results", 5)

        pipeline = get_rag_pipeline()
        pipeline.n_results = n_results

        result = pipeline.query(query=query, template=template)

        return jsonify({
            "ok": True,
            "response": result.get("response"),
            "sources": result.get("sources", []),
            "template_used": result.get("template_used"),
            "status": result.get("status"),
            "llm": result.get("llm"),
        }), 200

    except Exception as e:
        logger.exception(f"Error en query RAG: {e}")
        return jsonify({
            "ok": False,
            "error": {"code": "rag_error", "message": str(e)},
        }), 500


@bp.route("/rag/equivalents", methods=["POST"])
def rag_find_equivalents():
    """
    Encuentra materiales equivalentes usando RAG.

    Request JSON:
    {
        "material_codigo": "1000295076",
        "n_results": 5
    }

    Response:
    {
        "ok": true,
        "response": "Los siguientes materiales pueden servir como equivalentes...",
        "equivalents": [...],
        "material_original": "1000295076"
    }
    """
    if not RAG_ENABLED:
        return jsonify({
            "ok": False,
            "error": {"code": "rag_not_available", "message": "RAG no disponible"},
        }), 503

    try:
        from backend.agent.rag import get_rag_pipeline

        data = request.get_json() or {}
        material_codigo = data.get("material_codigo", "").strip()

        if not material_codigo:
            return jsonify({
                "ok": False,
                "error": {"code": "missing_material", "message": "Se requiere material_codigo"},
            }), 400

        n_results = data.get("n_results", 5)

        pipeline = get_rag_pipeline()
        result = pipeline.find_equivalents(
            material_codigo=material_codigo,
            n_results=n_results,
        )

        return jsonify({
            "ok": True,
            "response": result.get("response"),
            "equivalents": result.get("equivalents", []),
            "material_original": material_codigo,
            "status": result.get("status"),
        }), 200

    except Exception as e:
        logger.exception(f"Error buscando equivalentes: {e}")
        return jsonify({
            "ok": False,
            "error": {"code": "rag_error", "message": str(e)},
        }), 500
