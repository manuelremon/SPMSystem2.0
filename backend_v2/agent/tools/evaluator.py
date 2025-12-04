"""
Herramienta para evaluar modelos ML.

Calcula métricas: accuracy, F1, MAE, RMSE, etc.
"""

import logging
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.metrics import (accuracy_score, f1_score, mean_absolute_error,
                             mean_squared_error, precision_score, recall_score,
                             roc_auc_score)

from .base import BaseTool, ToolError, ToolMetadata

logger = logging.getLogger(__name__)


class Evaluator(BaseTool):
    """
    Herramienta para evaluar modelos ML.

    Calcula métricas de clasificación y regresión.
    """

    def __init__(self):
        """Inicializa el evaluador."""
        super().__init__(name="evaluate", description="Evalúa modelos ML con métricas estándar")

    def execute(
        self,
        y_true: List[Any],
        y_pred: List[Any],
        metrics: Optional[List[str]] = None,
        problem_type: str = "classification",
    ) -> Dict[str, Any]:
        """
        Evalúa predicciones de un modelo.

        Args:
            y_true: Valores reales
            y_pred: Predicciones del modelo
            metrics: Métricas a calcular (si None, calcula todas)
            problem_type: 'classification' o 'regression'

        Returns:
            Diccionario con resultados de evaluación
        """
        try:
            y_true = np.array(y_true)
            y_pred = np.array(y_pred)

            if len(y_true) != len(y_pred):
                raise ToolError("y_true e y_pred tienen longitudes diferentes")

            results = {"problem_type": problem_type, "n_samples": len(y_true), "metrics": {}}

            if problem_type == "classification":
                results["metrics"] = self._classification_metrics(y_true, y_pred, metrics)

            elif problem_type == "regression":
                results["metrics"] = self._regression_metrics(y_true, y_pred, metrics)

            else:
                raise ToolError(f"problem_type no válido: {problem_type}")

            return results

        except Exception as e:
            logger.error(f"Error evaluando modelo: {e}")
            raise ToolError(f"Error en evaluación: {e}")

    def _classification_metrics(
        self, y_true: np.ndarray, y_pred: np.ndarray, metrics: Optional[List[str]] = None
    ) -> Dict[str, float]:
        """Calcula métricas de clasificación."""
        metrics = metrics or ["accuracy", "precision", "recall", "f1"]
        results = {}

        try:
            if "accuracy" in metrics:
                results["accuracy"] = float(accuracy_score(y_true, y_pred))

            if "precision" in metrics:
                results["precision"] = float(
                    precision_score(y_true, y_pred, average="weighted", zero_division=0)
                )

            if "recall" in metrics:
                results["recall"] = float(
                    recall_score(y_true, y_pred, average="weighted", zero_division=0)
                )

            if "f1" in metrics:
                results["f1"] = float(f1_score(y_true, y_pred, average="weighted", zero_division=0))

            # ROC-AUC solo para problemas binarios
            if "roc_auc" in metrics and len(np.unique(y_true)) == 2:
                try:
                    results["roc_auc"] = float(roc_auc_score(y_true, y_pred))
                except:
                    pass

        except Exception as e:
            logger.warning(f"No se pudieron calcular algunas métricas: {e}")

        return results

    def _regression_metrics(
        self, y_true: np.ndarray, y_pred: np.ndarray, metrics: Optional[List[str]] = None
    ) -> Dict[str, float]:
        """Calcula métricas de regresión."""
        metrics = metrics or ["mae", "mse", "rmse"]
        results = {}

        try:
            if "mae" in metrics:
                results["mae"] = float(mean_absolute_error(y_true, y_pred))

            if "mse" in metrics:
                results["mse"] = float(mean_squared_error(y_true, y_pred))

            if "rmse" in metrics:
                results["rmse"] = float(np.sqrt(mean_squared_error(y_true, y_pred)))

            # R² score
            if "r2" in metrics:
                from sklearn.metrics import r2_score

                results["r2"] = float(r2_score(y_true, y_pred))

        except Exception as e:
            logger.warning(f"Error calculando métricas de regresión: {e}")

        return results

    def get_metadata(self) -> ToolMetadata:
        """Retorna metadatos de la herramienta."""
        return ToolMetadata(
            name=self.name,
            description=self.description,
            input_schema={
                "type": "object",
                "properties": {
                    "y_true": {"type": "array", "description": "Valores reales"},
                    "y_pred": {"type": "array", "description": "Predicciones del modelo"},
                    "problem_type": {
                        "type": "string",
                        "enum": ["classification", "regression"],
                        "description": "Tipo de problema",
                    },
                    "metrics": {"type": "array", "description": "Métricas a calcular"},
                },
                "required": ["y_true", "y_pred"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "problem_type": {"type": "string"},
                    "n_samples": {"type": "integer"},
                    "metrics": {"type": "object"},
                },
            },
        )
