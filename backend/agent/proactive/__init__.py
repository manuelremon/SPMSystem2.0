"""
Modulo de alertas proactivas y sugerencias contextuales para Vertex IA.

Componentes:
- AlertEngine: Motor de alertas proactivas (stock, SLA, presupuesto)
- Suggester: Sugerencias contextuales basadas en pagina y actividad
"""

from backend.agent.proactive.alert_engine import AlertEngine
from backend.agent.proactive.suggester import ContextualSuggester

__all__ = ["AlertEngine", "ContextualSuggester"]
