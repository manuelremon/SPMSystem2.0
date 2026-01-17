"""
Motor de sugerencias contextuales para Vertex IA.

Genera sugerencias basadas en:
- Pagina actual del usuario
- Historial de acciones
- Materiales frecuentes
- Hora del dia y patrones de uso
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ContextualSuggester:
    """Genera sugerencias contextuales para el usuario."""

    # Sugerencias por pagina/contexto
    PAGE_SUGGESTIONS = {
        "dashboard": [
            "Queres ver el resumen de tus solicitudes pendientes?",
            "Te muestro las alertas de stock de tus materiales frecuentes?",
            "Reviso como esta el presupuesto de tu centro?",
        ],
        "crear_solicitud": [
            "Necesitas ayuda para encontrar un material?",
            "Te sugiero materiales basados en lo que pediste antes?",
            "Queres que verifique el stock antes de agregar?",
        ],
        "create": [  # Alias
            "Necesitas ayuda para encontrar un material?",
            "Te sugiero materiales basados en lo que pediste antes?",
            "Queres que verifique el stock antes de agregar?",
        ],
        "mis_solicitudes": [
            "Queres que te resuma el estado de tus solicitudes?",
            "Hay alguna solicitud que te preocupe por el SLA?",
            "Te ayudo a hacer seguimiento de alguna?",
        ],
        "solicitudes": [  # Alias
            "Queres que te resuma el estado de tus solicitudes?",
            "Hay alguna solicitud que te preocupe por el SLA?",
            "Te ayudo a hacer seguimiento de alguna?",
        ],
        "materiales": [
            "Buscas algo en particular? Describime lo que necesitas",
            "Te muestro materiales equivalentes?",
            "Queres ver el historial de consumo de algun material?",
        ],
        "materials": [  # Alias ingles
            "Buscas algo en particular? Describime lo que necesitas",
            "Te muestro materiales equivalentes?",
            "Queres ver el historial de consumo de algun material?",
        ],
        "planner": [
            "Necesitas ayuda para priorizar solicitudes?",
            "Te analizo el impacto en presupuesto?",
            "Queres que te sugiera fuentes de abastecimiento?",
        ],
        "planificador": [  # Alias
            "Necesitas ayuda para priorizar solicitudes?",
            "Te analizo el impacto en presupuesto?",
            "Queres que te sugiera fuentes de abastecimiento?",
        ],
        "presupuesto": [
            "Queres ver el estado actual del presupuesto?",
            "Te muestro las solicitudes que mas impactan?",
            "Puedo ayudarte a crear un BUR si necesitas?",
        ],
        "budget": [  # Alias
            "Queres ver el estado actual del presupuesto?",
            "Te muestro las solicitudes que mas impactan?",
            "Puedo ayudarte a crear un BUR si necesitas?",
        ],
        "mrp": [
            "Te muestro las alertas de reabastecimiento?",
            "Queres analizar la proyeccion de demanda?",
            "Puedo sugerirte cantidades optimas de pedido",
        ],
        "forecast": [
            "Queres ver la proyeccion de demanda de algun material?",
            "Te muestro los materiales con mayor variabilidad?",
            "Puedo analizar tendencias estacionales",
        ],
        "default": [
            "En que te puedo ayudar?",
            "Tenes alguna consulta sobre materiales o solicitudes?",
            "Puedo buscar informacion del sistema si necesitas",
        ],
    }

    def __init__(self, user_id: int, memory: Optional[Any] = None):
        """
        Inicializa el generador de sugerencias.

        Args:
            user_id: ID del usuario
            memory: Instancia de VertexMemory (opcional)
        """
        self.user_id = user_id
        self.memory = memory

    def get_suggestions(self, context: Dict[str, Any]) -> List[str]:
        """
        Genera sugerencias basadas en el contexto actual.

        Args:
            context: {
                'page': 'dashboard',
                'solicitud_id': 123,  # opcional
                'material_codigo': 'ABC123',  # opcional
                'action': 'viewing',  # viewing, creating, editing
            }

        Returns:
            Lista de sugerencias (max 4)
        """
        suggestions = []
        page = context.get("page", "default")

        # 1. Sugerencias basadas en pagina
        page_sugs = self.PAGE_SUGGESTIONS.get(page, self.PAGE_SUGGESTIONS["default"])
        suggestions.extend(page_sugs[:2])  # Max 2 de pagina

        # 2. Sugerencias basadas en memoria (si disponible)
        if self.memory:
            try:
                frecuentes = self.memory.recall_fact("materiales_frecuentes")
                if frecuentes and page in ["crear_solicitud", "create", "materiales", "materials"]:
                    mat_desc = frecuentes[0].get("descripcion", "material")[:25]
                    suggestions.append(f"Te busco mas de '{mat_desc}...'?")
            except Exception:
                pass

        # 3. Sugerencias basadas en hora del dia
        hour = datetime.now().hour
        if 14 <= hour <= 16 and page in ["dashboard", "default"]:
            suggestions.append("Es buen momento para revisar solicitudes del dia")

        # 4. Sugerencias basadas en historial reciente
        if self.memory:
            try:
                recent_topics = self.memory.get_recent_topics(days=3, limit=1)
                if recent_topics:
                    topic = recent_topics[0][:25]
                    suggestions.append(f"Seguimos con '{topic}...'?")
            except Exception:
                pass

        return suggestions[:4]  # Max 4 sugerencias

    def get_greeting(self, context: Dict[str, Any]) -> str:
        """
        Genera saludo personalizado.

        Args:
            context: {
                'user_name': 'Manuel',
                'page': 'dashboard'
            }

        Returns:
            Saludo personalizado
        """
        hour = datetime.now().hour

        # Obtener nombre del usuario
        user_name = context.get("user_name", "")
        name_part = f", {user_name.split()[0]}" if user_name else ""

        if 5 <= hour < 12:
            greeting = f"Buen dia{name_part}!"
        elif 12 <= hour < 19:
            greeting = f"Buenas tardes{name_part}!"
        else:
            greeting = f"Buenas noches{name_part}!"

        # Agregar contexto segun pagina
        page = context.get("page", "default")

        page_intros = {
            "crear_solicitud": " Aca estoy para ayudarte a armar tu solicitud.",
            "create": " Aca estoy para ayudarte a armar tu solicitud.",
            "mis_solicitudes": " Revisamos tus solicitudes?",
            "solicitudes": " Revisamos tus solicitudes?",
            "materiales": " Contame que material estas buscando.",
            "materials": " Contame que material estas buscando.",
            "planner": " Te ayudo a planificar?",
            "planificador": " Te ayudo a planificar?",
            "dashboard": " En que te puedo ayudar hoy?",
        }

        intro = page_intros.get(page, " En que te puedo ayudar?")
        return greeting + intro

    @staticmethod
    def get_page_suggestions(page: str) -> List[str]:
        """
        Obtiene sugerencias estaticas para una pagina.

        Args:
            page: Nombre de la pagina

        Returns:
            Lista de sugerencias (max 3)
        """
        return ContextualSuggester.PAGE_SUGGESTIONS.get(
            page,
            ContextualSuggester.PAGE_SUGGESTIONS["default"]
        )[:3]
