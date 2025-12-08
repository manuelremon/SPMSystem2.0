"""
Pipelines ML para análisis y predicciones en SPM.

Módulos:
- demand_forecast: Predicción de demanda de materiales
- clustering: Agrupación de materiales y solicitudes
- scoring: Sistema de puntuación para priorización
"""

from .clustering import ClusteringPipeline
from .demand_forecast import DemandForecastPipeline
from .scoring import ScoringPipeline

__all__ = ["DemandForecastPipeline", "ClusteringPipeline", "ScoringPipeline"]
