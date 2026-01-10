"""
Prompt Templates para RAG de Materiales.

Templates especializados para diferentes tareas:
- Búsqueda de materiales
- Comparación de alternativas
- Análisis de stock
- Recomendaciones de compra
"""

from typing import Any, Dict, List, Optional


class PromptTemplate:
    """Template base para prompts."""

    def __init__(
        self,
        template: str,
        system_prompt: str = "",
        name: str = "default",
    ):
        self.template = template
        self.system_prompt = system_prompt
        self.name = name

    def format(self, **kwargs) -> str:
        """Formatea el template con los parámetros dados."""
        return self.template.format(**kwargs)

    def format_context(self, context: List[Dict[str, Any]]) -> str:
        """Formatea lista de documentos de contexto."""
        parts = []
        for i, doc in enumerate(context, 1):
            codigo = doc.get("codigo", doc.get("id", f"Doc{i}"))
            descripcion = doc.get("descripcion", doc.get("document", ""))
            similarity = doc.get("similarity", doc.get("match_score", 0))
            stock = doc.get("stock", "N/A")
            precio = doc.get("precio", doc.get("precio_usd", "N/A"))
            unidad = doc.get("unidad", doc.get("unidad_medida", ""))

            parts.append(
                f"[{i}] {codigo}: {descripcion}\n"
                f"    Stock: {stock} {unidad} | Precio: ${precio} | Relevancia: {similarity:.1%}"
            )
        return "\n".join(parts)


# =============================================================================
# Templates para Búsqueda de Materiales
# =============================================================================

MATERIAL_SEARCH = PromptTemplate(
    name="material_search",
    system_prompt="""Eres un asistente experto en gestión de materiales e inventario SAP.
Tu rol es ayudar a los usuarios a encontrar materiales en el catálogo.
Responde de forma clara y concisa en español.
Si no encuentras materiales relevantes, sugiere términos de búsqueda alternativos.""",
    template="""Basándote en los siguientes materiales encontrados:

{context}

Responde la consulta del usuario: {query}

Proporciona:
1. Los materiales más relevantes para la consulta
2. Una breve explicación de por qué son adecuados
3. Si hay alternativas o equivalentes, menciónalos"""
)

MATERIAL_COMPARISON = PromptTemplate(
    name="material_comparison",
    system_prompt="""Eres un experto en análisis comparativo de materiales industriales.
Ayudas a los usuarios a elegir entre diferentes opciones de materiales.
Considera factores como: precio, disponibilidad, especificaciones técnicas y aplicación.""",
    template="""Compara los siguientes materiales:

{context}

El usuario necesita: {query}

Proporciona:
1. Tabla comparativa de características principales
2. Ventajas y desventajas de cada opción
3. Recomendación final basada en la necesidad del usuario"""
)

# =============================================================================
# Templates para Análisis de Stock
# =============================================================================

STOCK_ANALYSIS = PromptTemplate(
    name="stock_analysis",
    system_prompt="""Eres un analista de inventario y planificación de materiales (MRP).
Ayudas a identificar problemas de stock y oportunidades de optimización.
Usa terminología de gestión de inventario (ROP, EOQ, Safety Stock, Lead Time).""",
    template="""Analiza el estado de stock de los siguientes materiales:

{context}

Información adicional de stock:
- Stock total: {stock_total}
- Demanda promedio diaria: {demanda_diaria}
- Lead time: {lead_time} días
- Nivel de urgencia: {urgencia}

Pregunta del usuario: {query}

Proporciona:
1. Diagnóstico del estado actual del stock
2. Riesgos identificados (desabasto, sobrestock)
3. Recomendaciones de acción inmediata
4. Sugerencias para optimización a largo plazo"""
)

REORDER_RECOMMENDATION = PromptTemplate(
    name="reorder_recommendation",
    system_prompt="""Eres un especialista en planificación de compras y reabastecimiento.
Ayudas a determinar cuándo y cuánto comprar de cada material.
Considera factores económicos (EOQ) y de servicio (nivel de servicio, safety stock).""",
    template="""Basándote en los siguientes datos de materiales:

{context}

Parámetros de reabastecimiento:
- Días de cobertura actual: {dias_cobertura}
- Lead time del proveedor: {lead_time} días
- Nivel de servicio objetivo: {nivel_servicio}%

Consulta: {query}

Proporciona:
1. Punto de reorden (ROP) recomendado
2. Cantidad económica de pedido (EOQ) sugerida
3. Stock de seguridad necesario
4. Fecha sugerida para próximo pedido"""
)

# =============================================================================
# Templates para Asistente General
# =============================================================================

GENERAL_ASSISTANT = PromptTemplate(
    name="general_assistant",
    system_prompt="""Eres el Asistente SPM, un experto en gestión de materiales y suministros.
Ayudas con:
- Búsqueda de materiales en el catálogo SAP
- Análisis de stock e inventario
- Planificación de compras y reabastecimiento
- Identificación de materiales equivalentes
- Respuesta a preguntas sobre procesos de solicitud

Responde siempre en español, de forma clara y profesional.
Si no tienes información suficiente, pregunta para clarificar.""",
    template="""Contexto de materiales relevantes:

{context}

Pregunta del usuario: {query}

Responde de forma útil y completa."""
)

EQUIVALENTS_FINDER = PromptTemplate(
    name="equivalents_finder",
    system_prompt="""Eres un experto en identificación de materiales equivalentes y alternativos.
Ayudas a encontrar sustitutos cuando un material no está disponible.
Considera compatibilidad técnica, diferencias de especificación y disponibilidad.""",
    template="""El usuario busca equivalentes para:

Material original: {material_original}

Materiales candidatos encontrados:

{context}

Consulta: {query}

Proporciona:
1. Materiales que pueden servir como equivalentes directos
2. Diferencias técnicas importantes a considerar
3. Materiales que NO son buenos sustitutos y por qué
4. Recomendación final"""
)


# =============================================================================
# Registry de Templates
# =============================================================================

TEMPLATES = {
    "search": MATERIAL_SEARCH,
    "compare": MATERIAL_COMPARISON,
    "stock": STOCK_ANALYSIS,
    "reorder": REORDER_RECOMMENDATION,
    "general": GENERAL_ASSISTANT,
    "equivalents": EQUIVALENTS_FINDER,
}


def get_template(name: str) -> PromptTemplate:
    """
    Obtiene un template por nombre.

    Args:
        name: Nombre del template

    Returns:
        PromptTemplate

    Raises:
        KeyError si el template no existe
    """
    if name not in TEMPLATES:
        available = ", ".join(TEMPLATES.keys())
        raise KeyError(f"Template '{name}' no encontrado. Disponibles: {available}")
    return TEMPLATES[name]


def list_templates() -> List[str]:
    """Lista nombres de templates disponibles."""
    return list(TEMPLATES.keys())
