"""
Rutas del Asistente NLP para sugerir materiales.

Endpoint principal para procesar descripciones de problemas
en lenguaje natural y sugerir materiales relevantes.
"""

import logging

from flask import Blueprint, jsonify, request

try:
    from backend.agent.tools.material_matcher import MaterialMatcher
    from backend.agent.tools.nlp_processor import NLPProcessor
except ImportError:
    from agent.tools.material_matcher import MaterialMatcher
    from agent.tools.nlp_processor import NLPProcessor


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
            }
        ),
        200,
    )
