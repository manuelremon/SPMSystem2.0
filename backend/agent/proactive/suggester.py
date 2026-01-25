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

    # Sugerencias por pagina/contexto - Accionables y especificas
    PAGE_SUGGESTIONS = {
        "dashboard": [
            "Mostrame mis solicitudes pendientes",
            "Cual es el estado de mi ultima solicitud?",
            "Hay alertas de stock que deba revisar?",
        ],
        "crear_solicitud": [
            "Buscar material por codigo SAP",
            "Que materiales similares hay disponibles?",
            "Verificar stock antes de agregar",
        ],
        "create": [  # Alias
            "Buscar material por codigo SAP",
            "Que materiales similares hay disponibles?",
            "Verificar stock antes de agregar",
        ],
        "mis_solicitudes": [
            "Cual es el estado de mi ultima solicitud?",
            "Hay solicitudes proximas a vencer?",
            "Mostrame el historial de una solicitud",
        ],
        "solicitudes": [  # Alias
            "Cual es el estado de mi ultima solicitud?",
            "Hay solicitudes proximas a vencer?",
            "Mostrame el historial de una solicitud",
        ],
        "materiales": [
            "Buscar material por codigo o nombre",
            "Ver materiales equivalentes",
            "Consultar historial de consumo",
        ],
        "materials": [  # Alias ingles
            "Buscar material por codigo o nombre",
            "Ver materiales equivalentes",
            "Consultar historial de consumo",
        ],
        "planner": [
            "Que solicitudes debo priorizar?",
            "Analizar impacto en presupuesto",
            "Sugerir fuentes de abastecimiento",
        ],
        "planificador": [  # Alias
            "Que solicitudes debo priorizar?",
            "Analizar impacto en presupuesto",
            "Sugerir fuentes de abastecimiento",
        ],
        "presupuesto": [
            "Cuanto presupuesto me queda?",
            "Ver movimientos del mes",
            "Proyectar consumo del trimestre",
        ],
        "budget": [  # Alias
            "Cuanto presupuesto me queda?",
            "Ver movimientos del mes",
            "Proyectar consumo del trimestre",
        ],
        "mrp": [
            "Que materiales tienen stock critico?",
            "Mostrar alertas de reposicion",
            "Calcular punto de reorden",
        ],
        "alertas": [  # Alias
            "Que materiales tienen stock critico?",
            "Mostrar alertas de reposicion",
            "Calcular punto de reorden",
        ],
        "forecast": [
            "Proyectar demanda del proximo mes",
            "Comparar modelos de pronostico",
            "Ver tendencia de consumo historico",
        ],
        "aprobaciones": [
            "Cuantas solicitudes tengo pendientes?",
            "Mostrar solicitudes por monto",
            "Ver historial de aprobaciones",
        ],
        "default": [
            "Buscar un material por codigo o descripcion",
            "Ver mis solicitudes pendientes",
            "Consultar stock de un material",
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

        # Saludo conciso - las sugerencias comunican las acciones disponibles
        return greeting + " Soy Vertex, tu asistente."

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
