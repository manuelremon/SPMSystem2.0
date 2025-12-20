"""
Estrategia de Forecasting con XGBoost
=====================================
Implementación de XGBoost para forecasting de demanda.

Ventajas sobre GradientBoosting de sklearn:
- Más rápido (paralelización nativa)
- Mejor manejo de valores faltantes
- Regularización L1/L2 incluida
- Early stopping nativo

Adaptado de ForecastDemandaMateriales para SPM v2.0
"""
from typing import Dict
import pandas as pd
import numpy as np
import logging

from .sklearn_models import SklearnBaseStrategy

logger = logging.getLogger(__name__)

# Importación opcional
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    logger.warning("XGBoost no está instalado. Instale con: pip install xgboost")


class XGBoostStrategy(SklearnBaseStrategy):
    """
    Estrategia de forecasting usando XGBoost.

    XGBoost ofrece mejor rendimiento que GradientBoosting de sklearn
    con regularización incorporada y mejor manejo de datos.
    """

    def __init__(self, **kwargs):
        if not XGBOOST_AVAILABLE:
            raise ImportError(
                "XGBoost no está instalado. "
                "Instale con: pip install xgboost"
            )
        super().__init__()

        # Parámetros configurables
        self.params = {
            'n_estimators': kwargs.get('n_estimators', 100),
            'max_depth': kwargs.get('max_depth', 6),
            'learning_rate': kwargs.get('learning_rate', 0.1),
            'subsample': kwargs.get('subsample', 0.8),
            'colsample_bytree': kwargs.get('colsample_bytree', 0.8),
            'reg_alpha': kwargs.get('reg_alpha', 0.1),  # L1
            'reg_lambda': kwargs.get('reg_lambda', 1.0),  # L2
            'random_state': 42,
            'n_jobs': -1
        }

    @property
    def nombre_modelo(self) -> str:
        return "XGBoost"

    def _crear_modelo(self, n_samples: int):
        """Crea modelo XGBoost con parámetros ajustados al dataset"""
        # Ajustar parámetros para datasets pequeños
        adjusted_params = self.params.copy()
        adjusted_params['n_estimators'] = min(
            self.params['n_estimators'],
            max(10, n_samples * 2)
        )
        adjusted_params['max_depth'] = min(
            self.params['max_depth'],
            max(3, n_samples // 5)
        )

        self.modelo = xgb.XGBRegressor(**adjusted_params)

    def get_feature_importance(self) -> pd.DataFrame:
        """Retorna importancia de features de XGBoost"""
        if not self.is_trained or self.modelo is None:
            return pd.DataFrame()

        try:
            importance = self.modelo.feature_importances_
            return pd.DataFrame({
                'feature': self.feature_names,
                'importance': importance
            }).sort_values('importance', ascending=False)
        except Exception:
            return pd.DataFrame()


def is_xgboost_available() -> bool:
    """Verifica si XGBoost está disponible"""
    return XGBOOST_AVAILABLE
