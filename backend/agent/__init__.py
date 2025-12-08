"""
Módulo de Agente ML con arquitectura ReAct (Reasoning + Acting).

El agente implementa un loop de reasoning where:
- Observa el estado actual
- Razona sobre qué herramienta usar
- Ejecuta la herramienta
- Observa el resultado
- Itera hasta alcanzar el objetivo

Estructura:
- core/ : Motor ReAct, memoria, razonador
- tools/ : Herramientas disponibles (loaders, trainers, evaluators)
- models/ : Esquemas Pydantic, modelos ML serializados
- pipelines/ : Pipelines de ML específicos (forecasting, clustering, scoring)
- prompts/ : Templates de prompts para el agente
"""

from .core.memory import Memory
from .core.react_agent import ReactAgent
from .routes import agent_bp, register_agent_routes

__all__ = [
    "ReactAgent",
    "Memory",
    "register_agent_routes",
    "agent_bp",
]

__version__ = "1.0.0"
