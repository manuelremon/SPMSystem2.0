"""
Módulo de Razonamiento (Reasoner) para el Agente ReAct.

Responsable de:
- Analizar el estado actual
- Decidir qué herramienta usar
- Evaluar si el objetivo fue alcanzado
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple


@dataclass
class ReasoningStep:
    """Un paso en el proceso de razonamiento."""

    observation: str
    thought: str
    chosen_tool: str
    confidence: float
    rationale: str


class Reasoner:
    """
    Módulo de decisión para el agente ReAct.

    Implementa heurísticas y lógica para elegir herramientas
    basado en el estado actual y los objetivos.
    """

    def __init__(self):
        """Inicializa el razonador."""
        self.reasoning_history: List[ReasoningStep] = []
        self.max_iterations = 10

    def analyze_goal(self, goal: str, context: List[Dict[str, Any]]) -> str:
        """
        Analiza un objetivo y retorna recomendaciones.

        Args:
            goal: Objetivo a alcanzar
            context: Contexto de memoria reciente

        Returns:
            Análisis del objetivo como string
        """
        analysis = f"""
ANÁLISIS DE OBJETIVO:
- Objetivo: {goal}
- Contexto disponible: {len(context)} entradas
- Necesita: [Planificación]
        """
        return analysis.strip()

    def choose_tool(
        self, observation: str, available_tools: List[str], context: Dict[str, Any]
    ) -> Tuple[str, Dict[str, Any], float]:
        """
        Elige la mejor herramienta para usar.

        Args:
            observation: Observación actual
            available_tools: Lista de herramientas disponibles
            context: Contexto de ejecución

        Returns:
            Tupla de (tool_name, parameters, confidence_score)
        """
        # Lógica simple de razonamiento
        tool_scores = self._score_tools(observation, available_tools, context)
        best_tool = max(tool_scores, key=tool_scores.get)

        return (best_tool, self._get_tool_params(best_tool, context), tool_scores[best_tool])

    def should_continue(self, goal: str, observations: List[str], iteration: int) -> bool:
        """
        Decide si se debe continuar iterando.

        Args:
            goal: Objetivo original
            observations: Observaciones acumuladas
            iteration: Iteración actual

        Returns:
            True si debe continuar, False si alcanzó el objetivo
        """
        # Criterios de parada
        if iteration >= self.max_iterations:
            return False

        if not observations:
            return True

        last_obs = observations[-1].lower()

        # Palabras clave de conclusión
        conclusive_keywords = [
            "objetivo alcanzado",
            "completado",
            "éxito",
            "finalizado",
            "no hay más",
        ]

        return not any(kw in last_obs for kw in conclusive_keywords)

    def synthesize_result(self, observations: List[str], goal: str) -> Dict[str, Any]:
        """
        Sintetiza el resultado final basado en observaciones.

        Args:
            observations: Observaciones acumuladas
            goal: Objetivo original

        Returns:
            Diccionario con resultado sintetizado
        """
        return {
            "goal": goal,
            "success": bool(observations),
            "iterations": len(observations),
            "summary": "\n".join(observations[-3:]) if observations else "Sin resultado",
            "observations": observations,
        }

    def _score_tools(
        self, observation: str, tools: List[str], context: Dict[str, Any]
    ) -> Dict[str, float]:
        """
        Puntúa herramientas basado en la observación.

        Implementación simple: lógica basada en palabras clave
        """
        scores = {}
        obs_lower = observation.lower()

        for tool in tools:
            score = 0.5  # Score base

            # Palabras clave para cada tipo de herramienta
            if tool == "load_data" and any(
                w in obs_lower for w in ["cargar", "obtener", "leer", "datos"]
            ):
                score = 0.9
            elif tool == "train_model" and any(
                w in obs_lower for w in ["entrenar", "aprender", "modelo", "datos"]
            ):
                score = 0.9
            elif tool == "evaluate" and any(
                w in obs_lower for w in ["evaluar", "verificar", "validar", "métricas"]
            ):
                score = 0.9
            elif tool == "predict" and any(
                w in obs_lower for w in ["predecir", "pronóstico", "estimar", "recomendación"]
            ):
                score = 0.9

            scores[tool] = score

        return scores

    def _get_tool_params(self, tool: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Extrae parámetros para una herramienta del contexto."""
        params = {}

        # Parámetros por defecto según herramienta
        if tool == "load_data":
            params = {"source": context.get("data_source", "default")}
        elif tool == "train_model":
            params = {
                "model_type": context.get("model_type", "random_forest"),
                "hyperparams": context.get("hyperparams", {}),
            }
        elif tool == "evaluate":
            params = {"metrics": context.get("metrics", ["accuracy", "f1"])}
        elif tool == "predict":
            params = {"input": context.get("input_data")}

        return params

    def record_step(self, step: ReasoningStep) -> None:
        """Registra un paso de razonamiento."""
        self.reasoning_history.append(step)

    def get_reasoning_trace(self) -> str:
        """Retorna el trace de razonamiento como string."""
        if not self.reasoning_history:
            return "Sin historial de razonamiento"

        trace = "TRACE DE RAZONAMIENTO:\n"
        for i, step in enumerate(self.reasoning_history, 1):
            trace += f"\nPaso {i}:\n"
            trace += f"  Observación: {step.observation}\n"
            trace += f"  Pensamiento: {step.thought}\n"
            trace += f"  Herramienta: {step.chosen_tool} (confianza: {step.confidence:.2%})\n"

        return trace
