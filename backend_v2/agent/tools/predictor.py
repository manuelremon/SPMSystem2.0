"""
Herramienta para hacer predicciones con modelos ML entrenados.

Carga modelos persistidos y realiza predicciones sobre nuevos datos.
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np

from .base import BaseTool, ToolError, ToolMetadata

logger = logging.getLogger(__name__)


class Predictor(BaseTool):
    """
    Herramienta para hacer predicciones con modelos ML.

    Características:
    - Carga modelos persistidos
    - Realiza predicciones e inferencia
    - Calcula confianza/probabilidades
    - Soporta clasificación y regresión
    """

    MODELS_DIR = Path("backend_v2/agent/models")

    def __init__(self):
        """Inicializa el predictor."""
        super().__init__(
            name="predict", description="Realiza predicciones con modelos ML entrenados"
        )
        self._loaded_models: Dict[str, Any] = {}

    def execute(
        self,
        model_name: str,
        X_test: Optional[np.ndarray] = None,
        return_probabilities: bool = False,
        prediction_type: str = "default",
    ) -> Dict[str, Any]:
        """
        Realiza predicciones con un modelo.

        Args:
            model_name: Nombre del archivo del modelo (.pkl)
            X_test: Datos de prueba (features)
            return_probabilities: Si True, retorna probabilidades para clasificación
            prediction_type: 'default' o 'confidence'

        Returns:
            Diccionario con predicciones y metadatos
        """
        if X_test is None:
            raise ToolError("X_test es requerido para hacer predicciones")

        try:
            X_test = np.array(X_test)

            if X_test.ndim != 2:
                raise ToolError("X_test debe ser una matriz 2D (n_muestras, n_features)")

            # Cargar modelo
            model = self._load_model(model_name)

            # Hacer predicciones
            predictions = model.predict(X_test)

            results = {
                "model_name": model_name,
                "n_predictions": len(predictions),
                "predictions": predictions.tolist(),
                "model_type": self._infer_model_type(model),
            }

            # Probabilidades para clasificación
            if return_probabilities and hasattr(model, "predict_proba"):
                try:
                    probabilities = model.predict_proba(X_test)
                    results["probabilities"] = probabilities.tolist()
                    results["classes"] = model.classes_.tolist()

                    # Agregar confianza (max probability)
                    if prediction_type == "confidence":
                        confidence = np.max(probabilities, axis=1)
                        results["confidence"] = confidence.tolist()
                except Exception as e:
                    logger.warning(f"No se pudieron calcular probabilidades: {e}")

            # Feature importance si está disponible
            if hasattr(model, "feature_importances_"):
                results["feature_importances"] = model.feature_importances_.tolist()

            return results

        except Exception as e:
            logger.error(f"Error en predicción: {e}")
            raise ToolError(f"Error en predicción: {e}")

    def batch_predict(
        self, model_name: str, X_batches: List[np.ndarray], return_probabilities: bool = False
    ) -> Dict[str, Any]:
        """
        Realiza predicciones en lotes.

        Útil para procesar grandes volúmenes de datos.

        Args:
            model_name: Nombre del modelo
            X_batches: Lista de arrays (cada uno es un lote)
            return_probabilities: Si True, retorna probabilidades

        Returns:
            Predicciones agrupadas por lote
        """
        try:
            model = self._load_model(model_name)
            batch_results = []

            for batch_idx, X_batch in enumerate(X_batches):
                X_batch = np.array(X_batch)
                predictions = model.predict(X_batch)

                batch_result = {
                    "batch_idx": batch_idx,
                    "batch_size": len(predictions),
                    "predictions": predictions.tolist(),
                }

                if return_probabilities and hasattr(model, "predict_proba"):
                    try:
                        probabilities = model.predict_proba(X_batch)
                        batch_result["probabilities"] = probabilities.tolist()
                        confidence = np.max(probabilities, axis=1)
                        batch_result["confidence"] = confidence.tolist()
                    except:
                        pass

                batch_results.append(batch_result)

            return {
                "model_name": model_name,
                "total_predictions": sum(b["batch_size"] for b in batch_results),
                "n_batches": len(batch_results),
                "batches": batch_results,
            }

        except Exception as e:
            logger.error(f"Error en predicción por lotes: {e}")
            raise ToolError(f"Error en predicción por lotes: {e}")

    def get_model_info(self, model_name: str) -> Dict[str, Any]:
        """
        Retorna información sobre un modelo.

        Args:
            model_name: Nombre del modelo

        Returns:
            Información del modelo (tipo, parámetros, etc.)
        """
        try:
            model = self._load_model(model_name)
            model_path = self.MODELS_DIR / model_name

            info = {
                "model_name": model_name,
                "model_type": self._infer_model_type(model),
                "model_class": model.__class__.__name__,
                "path": str(model_path),
                "file_size_mb": model_path.stat().st_size / (1024 * 1024),
            }

            # Parámetros del modelo
            if hasattr(model, "get_params"):
                info["parameters"] = model.get_params()

            # Clases (si es clasificador)
            if hasattr(model, "classes_"):
                info["classes"] = model.classes_.tolist()

            # N features esperadas
            if hasattr(model, "n_features_in_"):
                info["n_features_expected"] = int(model.n_features_in_)

            return info

        except Exception as e:
            logger.error(f"Error obteniendo info del modelo: {e}")
            raise ToolError(f"Error obteniendo info del modelo: {e}")

    def _load_model(self, model_name: str) -> Any:
        """
        Carga un modelo del disco (con caché).

        Args:
            model_name: Nombre del archivo del modelo

        Returns:
            Modelo cargado
        """
        # Verificar caché
        if model_name in self._loaded_models:
            logger.info(f"Usando modelo cacheado: {model_name}")
            return self._loaded_models[model_name]

        # Cargar del disco
        model_path = self.MODELS_DIR / model_name

        if not model_path.exists():
            raise ToolError(f"Modelo no encontrado: {model_path}")

        try:
            model = joblib.load(model_path)
            self._loaded_models[model_name] = model
            logger.info(f"Modelo cargado: {model_name}")
            return model
        except Exception as e:
            raise ToolError(f"Error cargando modelo {model_name}: {e}")

    def _infer_model_type(self, model: Any) -> str:
        """
        Infiere si el modelo es de clasificación o regresión.

        Args:
            model: Modelo sklearn

        Returns:
            "classification" o "regression"
        """
        model_class = model.__class__.__name__.lower()

        if "classifier" in model_class:
            return "classification"
        elif "regressor" in model_class:
            return "regression"
        else:
            return "unknown"

    def clear_cache(self) -> Dict[str, Any]:
        """
        Limpia el caché de modelos cargados.

        Útil para liberar memoria.

        Returns:
            Info sobre modelos descargados
        """
        cleared = list(self._loaded_models.keys())
        self._loaded_models.clear()

        return {"message": "Caché limpiado", "cleared_models": cleared, "count": len(cleared)}

    def get_metadata(self) -> ToolMetadata:
        """Retorna metadatos de la herramienta."""
        return ToolMetadata(
            name=self.name,
            description=self.description,
            input_schema={
                "type": "object",
                "properties": {
                    "model_name": {
                        "type": "string",
                        "description": "Nombre del archivo del modelo (.pkl)",
                    },
                    "X_test": {"type": "array", "description": "Datos de prueba (matriz 2D)"},
                    "return_probabilities": {
                        "type": "boolean",
                        "description": "Si True, retorna probabilidades para clasificación",
                        "default": False,
                    },
                    "prediction_type": {
                        "type": "string",
                        "enum": ["default", "confidence"],
                        "description": "Tipo de predicción",
                        "default": "default",
                    },
                },
                "required": ["model_name", "X_test"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "model_name": {"type": "string"},
                    "n_predictions": {"type": "integer"},
                    "predictions": {"type": "array"},
                    "model_type": {"type": "string"},
                    "probabilities": {"type": "array"},
                    "confidence": {"type": "array"},
                },
            },
        )
