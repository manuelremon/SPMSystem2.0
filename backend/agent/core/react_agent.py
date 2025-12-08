"""
Motor ReAct (Reasoning + Acting) para el Agente ML.

Implementa el loop principal:
1. Observa estado actual
2. Piensa sobre qué hacer
3. Actúa (ejecuta herramienta)
4. Observa resultado
5. Itera hasta objetivo alcanzado
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from .memory import Memory
from .reasoner import Reasoner

logger = logging.getLogger(__name__)


class AgentState(str, Enum):
    """Estados del agente."""

    IDLE = "idle"
    THINKING = "thinking"
    ACTING = "acting"
    OBSERVING = "observing"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class ToolCall:
    """Representación de una llamada a herramienta."""

    tool_name: str
    parameters: Dict[str, Any]
    timestamp: str = ""


@dataclass
class ToolResult:
    """Resultado de ejecutar una herramienta."""

    tool_name: str
    success: bool
    result: Dict[str, Any]
    error: Optional[str] = None


class ReactAgent:
    """
    Agente con arquitectura ReAct (Reasoning + Acting).

    Loop principal:
    - Observa el estado del problema
    - Razona sobre la mejor acción
    - Ejecuta la acción (herramienta)
    - Observa el resultado
    - Itera hasta alcanzar objetivo
    """

    def __init__(self, name: str = "SPM-Agent-v1", max_iterations: int = 10, memory_size: int = 50):
        """
        Inicializa el agente ReAct.

        Args:
            name: Nombre del agente
            max_iterations: Máximo de iteraciones del loop
            memory_size: Tamaño de memoria corto plazo
        """
        self.name = name
        self.max_iterations = max_iterations
        self.memory = Memory(max_short_term=memory_size)
        self.reasoner = Reasoner()
        self.state = AgentState.IDLE
        self.tools: Dict[str, Callable] = {}
        self.iterations = 0
        self.execution_log: List[Dict[str, Any]] = []

    def register_tool(self, name: str, tool_func: Callable) -> None:
        """
        Registra una herramienta disponible para el agente.

        Args:
            name: Nombre de la herramienta
            tool_func: Función que implementa la herramienta
        """
        self.tools[name] = tool_func
        logger.info(f"Herramienta registrada: {name}")

    def act(
        self,
        goal: str,
        context: Optional[Dict[str, Any]] = None,
        max_iterations: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Ejecuta el loop ReAct para alcanzar un objetivo.

        Args:
            goal: Objetivo a alcanzar
            context: Contexto inicial (opcional)
            max_iterations: Máximo de iteraciones (override de configuración)
            timeout_seconds: Timeout en segundos (no implementado aún)

        Returns:
            Diccionario con resultado de la ejecución
        """
        logger.info(f"Iniciando agente con objetivo: {goal}")

        # Inicializar contexto de ejecución
        iterations_limit, context, observations = self._initialize_execution(
            context, max_iterations
        )

        try:
            # Ejecutar loop ReAct
            self._run_react_loop(goal, context, observations, iterations_limit)

            # Finalizar y retornar resultado
            return self._finalize_result(observations, goal)

        except Exception as e:
            return self._handle_execution_error(e)

    def _initialize_execution(
        self, context: Optional[Dict[str, Any]], max_iterations: Optional[int]
    ) -> tuple[int, Dict[str, Any], List[str]]:
        """
        Inicializa el estado del agente para una nueva ejecución.

        Args:
            context: Contexto inicial (opcional)
            max_iterations: Máximo de iteraciones (override de configuración)

        Returns:
            Tupla de (iterations_limit, context, observations)
        """
        self.state = AgentState.THINKING
        self.iterations = 0
        self.execution_log = []

        iterations_limit = max_iterations if max_iterations is not None else self.max_iterations
        context = context or {}
        observations: List[str] = []

        return iterations_limit, context, observations

    def _run_react_loop(
        self, goal: str, context: Dict[str, Any], observations: List[str], iterations_limit: int
    ) -> None:
        """
        Ejecuta el loop principal ReAct (Observe → Think → Act).

        Args:
            goal: Objetivo a alcanzar
            context: Contexto de ejecución
            observations: Lista de observaciones acumuladas
            iterations_limit: Límite máximo de iteraciones
        """
        while self.iterations < iterations_limit:
            self.iterations += 1
            logger.debug(f"Iteración {self.iterations}/{iterations_limit}")

            # Ejecutar una iteración del ciclo ReAct
            should_continue = self._execute_react_iteration(goal, context, observations)

            if not should_continue:
                logger.info("Objetivo alcanzado, deteniendo iteraciones")
                break

    def _execute_react_iteration(
        self, goal: str, context: Dict[str, Any], observations: List[str]
    ) -> bool:
        """
        Ejecuta una iteración del ciclo ReAct (Observe → Think → Act).

        Args:
            goal: Objetivo a alcanzar
            context: Contexto de ejecución
            observations: Lista de observaciones acumuladas

        Returns:
            True si debe continuar iterando, False si alcanzó el objetivo
        """
        # 1. OBSERVAR: Obtener estado actual
        self.state = AgentState.OBSERVING
        current_observation = self._observe(goal, context, observations)
        observations.append(current_observation)
        self.memory.remember_observation({"text": current_observation})

        # Verificar si alcanzó objetivo
        if not self.reasoner.should_continue(goal, observations, self.iterations):
            return False

        # 2. PENSAR: Razonar sobre qué hacer
        self.state = AgentState.THINKING
        thought, tool_name, tool_params = self._think(goal, current_observation, context)
        self.memory.remember_thought(thought)

        # 3. ACTUAR: Ejecutar herramienta
        self._perform_action(tool_name, tool_params, current_observation, thought)

        return True

    def _perform_action(
        self, tool_name: str, tool_params: Dict[str, Any], observation: str, thought: str
    ) -> None:
        """
        Ejecuta una acción (herramienta) y registra el resultado.

        Args:
            tool_name: Nombre de la herramienta
            tool_params: Parámetros de la herramienta
            observation: Observación actual
            thought: Pensamiento que llevó a esta acción
        """
        self.state = AgentState.ACTING

        if tool_name not in self.tools:
            raise ValueError(f"Herramienta no registrada: {tool_name}")

        try:
            tool_result = self._execute_tool(tool_name, tool_params)
            self.memory.remember_action(tool_name, tool_params)
            self.memory.remember_result(tool_result.result, tool_result.success)

            # Log de ejecución exitosa
            self.execution_log.append(
                {
                    "iteration": self.iterations,
                    "observation": observation,
                    "thought": thought,
                    "tool": tool_name,
                    "result": tool_result.result,
                    "success": tool_result.success,
                }
            )

        except Exception as e:
            logger.error(f"Error ejecutando herramienta {tool_name}: {e}")
            self.memory.remember_result({"error": str(e)}, False)
            self.execution_log.append({"iteration": self.iterations, "error": str(e)})

    def _finalize_result(self, observations: List[str], goal: str) -> Dict[str, Any]:
        """
        Finaliza la ejecución y sintetiza el resultado.

        Args:
            observations: Lista de observaciones acumuladas
            goal: Objetivo original

        Returns:
            Diccionario con el resultado final de la ejecución
        """
        self.state = AgentState.COMPLETED

        result = self.reasoner.synthesize_result(observations, goal)
        result["agent"] = self.name
        result["iterations_used"] = self.iterations
        result["execution_log"] = self.execution_log

        return result

    def _handle_execution_error(self, error: Exception) -> Dict[str, Any]:
        """
        Maneja errores fatales durante la ejecución.

        Args:
            error: Excepción capturada

        Returns:
            Diccionario con información del error
        """
        logger.error(f"Error fatal en agente: {error}")
        self.state = AgentState.ERROR

        return {
            "success": False,
            "error": str(error),
            "agent": self.name,
            "iterations_used": self.iterations,
        }

    def _observe(self, goal: str, context: Dict[str, Any], prev_observations: List[str]) -> str:
        """
        OBSERVA el estado actual del sistema.

        Args:
            goal: Objetivo
            context: Contexto
            prev_observations: Observaciones previas

        Returns:
            Descripción de la observación actual
        """
        # Lógica simple de observación
        if self.iterations == 1:
            return f"Iniciando para alcanzar: {goal}"

        # Simula observación del estado
        if prev_observations:
            return f"Progresando hacia objetivo después de {self.iterations - 1} iteraciones"

        return "Estado actual desconocido"

    def _think(
        self, goal: str, observation: str, context: Dict[str, Any]
    ) -> tuple[str, str, Dict[str, Any]]:
        """
        PIENSA sobre qué hacer.

        Args:
            goal: Objetivo
            observation: Observación actual
            context: Contexto

        Returns:
            Tupla de (thought, tool_name, tool_params)
        """
        available_tools = list(self.tools.keys())

        if not available_tools:
            return ("No hay herramientas disponibles", "pass", {})

        # Razonador elige herramienta
        tool_name, tool_params, confidence = self.reasoner.choose_tool(
            observation, available_tools, context
        )

        thought = (
            f"Objetivo: {goal}. "
            f"Observación: {observation}. "
            f"Usaré: {tool_name} (confianza: {confidence:.0%})"
        )

        return thought, tool_name, tool_params

    def _execute_tool(self, tool_name: str, params: Dict[str, Any]) -> ToolResult:
        """
        ACTÚA ejecutando una herramienta.

        Args:
            tool_name: Nombre de la herramienta
            params: Parámetros

        Returns:
            Resultado de la ejecución
        """
        if tool_name not in self.tools:
            return ToolResult(
                tool_name=tool_name,
                success=False,
                result={},
                error=f"Herramienta no encontrada: {tool_name}",
            )

        try:
            tool_func = self.tools[tool_name]
            result = tool_func(**params)

            return ToolResult(
                tool_name=tool_name,
                success=True,
                result=result if isinstance(result, dict) else {"output": result},
            )

        except TypeError as e:
            return ToolResult(
                tool_name=tool_name, success=False, result={}, error=f"Error de parámetros: {e}"
            )
        except Exception as e:
            return ToolResult(tool_name=tool_name, success=False, result={}, error=str(e))

    def get_memory_context(self, depth: int = 5) -> List[Dict[str, Any]]:
        """Retorna el contexto de memoria reciente."""
        return self.memory.get_context(depth)

    def get_reasoning_trace(self) -> str:
        """Retorna el trace de razonamiento."""
        return self.reasoner.get_reasoning_trace()

    def reset(self) -> None:
        """Resetea el agente para nueva ejecución."""
        self.state = AgentState.IDLE
        self.iterations = 0
        self.execution_log = []
        self.memory.clear_short_term()
        logger.info(f"Agente {self.name} reseteado")

    def __repr__(self) -> str:
        return (
            f"ReactAgent(name={self.name}, state={self.state}, "
            f"tools={len(self.tools)}, iterations={self.iterations})"
        )
