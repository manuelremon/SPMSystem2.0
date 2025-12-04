"""
Herramienta para entrenar modelos ML.

Entrena modelos de sklearn para predicción y clasificación
usando datos de SPM.
"""

import logging
from pathlib import Path
from typing import Any, Dict, Optional

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor

from .base import BaseTool, ToolError, ToolMetadata

logger = logging.getLogger(__name__)


class MLTrainer(BaseTool):
    """
    Herramienta para entrenar modelos de ML.

    Soporta:
    - Clasificación (RandomForest)
    - Regresión (RandomForest)
    - Normalización de datos
    - Serialización de modelos
    """

    MODELS_DIR = Path("backend_v2/agent/models")

    def __init__(self):
        """Inicializa el entrenador de modelos."""
        super().__init__(name="train_model", description="Entrena modelos ML con scikit-learn")
        self.MODELS_DIR.mkdir(parents=True, exist_ok=True)

    def execute(
        self,
        model_type: str = "random_forest_classifier",
        X_train: Optional[np.ndarray] = None,
        y_train: Optional[np.ndarray] = None,
        hyperparams: Optional[Dict[str, Any]] = None,
        model_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Entrena un modelo ML.

        Args:
            model_type: Tipo de modelo ('random_forest_classifier', 'random_forest_regressor')
            X_train: Datos de entrenamiento (features)
            y_train: Datos de entrenamiento (target)
            hyperparams: Hiperparámetros del modelo
            model_name: Nombre para guardar el modelo

        Returns:
            Información del modelo entrenado
        """
        if X_train is None or y_train is None:
            raise ToolError("X_train e y_train son requeridos")

        hyperparams = hyperparams or {}

        try:
            # Crear y entrenar modelo
            if model_type == "random_forest_classifier":
                model = RandomForestClassifier(
                    n_estimators=hyperparams.get("n_estimators", 100),
                    max_depth=hyperparams.get("max_depth", 10),
                    random_state=hyperparams.get("random_state", 42),
                    n_jobs=-1,
                )

            elif model_type == "random_forest_regressor":
                model = RandomForestRegressor(
                    n_estimators=hyperparams.get("n_estimators", 100),
                    max_depth=hyperparams.get("max_depth", 10),
                    random_state=hyperparams.get("random_state", 42),
                    n_jobs=-1,
                )

            else:
                raise ToolError(f"Modelo no soportado: {model_type}")

            # Entrenar
            logger.info(f"Entrenando {model_type}...")
            model.fit(X_train, y_train)

            # Guardar modelo si se proporciona nombre
            model_name = model_name or f"{model_type}_model.pkl"
            model_path = self.MODELS_DIR / model_name

            joblib.dump(model, model_path)
            logger.info(f"Modelo guardado en {model_path}")

            # Información del modelo
            result = {
                "model_type": model_type,
                "model_name": model_name,
                "model_path": str(model_path),
                "n_features": X_train.shape[1],
                "n_samples": X_train.shape[0],
                "hyperparams": hyperparams,
                "training_successful": True,
            }

            # Agregar feature importance si disponible
            if hasattr(model, "feature_importances_"):
                result["feature_importances"] = model.feature_importances_.tolist()

            return result

        except Exception as e:
            logger.error(f"Error entrenando modelo: {e}")
            raise ToolError(f"Error en entrenamiento: {e}")

    def load_model(self, model_path: str) -> Any:
        """Carga un modelo entrenado."""
        path = Path(model_path)
        if not path.exists():
            raise ToolError(f"Archivo de modelo no encontrado: {model_path}")

        return joblib.load(path)

    def get_metadata(self) -> ToolMetadata:
        """Retorna metadatos de la herramienta."""
        return ToolMetadata(
            name=self.name,
            description=self.description,
            input_schema={
                "type": "object",
                "properties": {
                    "model_type": {
                        "type": "string",
                        "enum": ["random_forest_classifier", "random_forest_regressor"],
                        "description": "Tipo de modelo",
                    },
                    "hyperparams": {
                        "type": "object",
                        "description": "Hiperparámetros (n_estimators, max_depth, etc.)",
                    },
                    "model_name": {
                        "type": "string",
                        "description": "Nombre para guardar el modelo",
                    },
                },
                "required": ["model_type"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "model_type": {"type": "string"},
                    "model_name": {"type": "string"},
                    "training_successful": {"type": "boolean"},
                },
            },
        )
