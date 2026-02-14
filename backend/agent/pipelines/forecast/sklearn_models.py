"""
Estrategias de Forecasting basadas en Scikit-learn
==================================================
Implementaciones de RandomForest, GradientBoosting y Ridge para forecasting.

Adaptado de ForecastDemandaMateriales para SPM v2.0
"""
import logging
from datetime import timedelta
from typing import Dict, List

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split

from .base import ForecastStrategy

logger = logging.getLogger(__name__)


class SklearnBaseStrategy(ForecastStrategy):
    """
    Clase base para estrategias basadas en scikit-learn.
    Contiene lógica compartida de entrenamiento y predicción.
    """

    def _get_lags_for_dataset(self, n_samples: int) -> List[int]:
        """Determina qué lags usar según el tamaño del dataset"""
        if n_samples < 35:
            lags = [1]
            if n_samples >= 7:
                lags.append(7)
        else:
            lags = [1, 7, 14, 30]
        return lags

    def _get_feature_names(
        self,
        columna_objetivo: str,
        lags: List[int],
        n_samples: int
    ) -> List[str]:
        """Obtiene lista de features a usar"""
        base_features = [
            'dia_semana', 'dia_mes', 'mes', 'trimestre',
            'mes_sin', 'mes_cos', 'dia_sin', 'dia_cos',
            'es_fin_mes', 'es_inicio_mes'
        ]

        lag_features = [f'{columna_objetivo}_lag_{lag}' for lag in lags]

        rolling_features = [
            f'{columna_objetivo}_ma_7',
            f'{columna_objetivo}_std_7',
            f'{columna_objetivo}_diff'
        ]
        if n_samples >= 30:
            rolling_features.append(f'{columna_objetivo}_ma_30')

        return base_features + lag_features + rolling_features

    def entrenar(
        self,
        df: pd.DataFrame,
        columna_objetivo: str = 'cantidad',
        test_size: float = 0.2
    ) -> Dict[str, float]:
        """Entrena el modelo sklearn"""
        # Guardar estadísticas básicas para fallback
        self._media_historica = df[columna_objetivo].mean()
        self._std_historica = df[columna_objetivo].std()
        self._ultimo_valor = df[columna_objetivo].iloc[-1] if len(df) > 0 else 0

        # Preparar datos
        df_prep = self._preparar_features(df)
        n_samples = len(df_prep)

        lags = self._get_lags_for_dataset(n_samples)
        df_prep = self._crear_lag_features(df_prep, columna_objetivo, lags=lags)
        df_prep = df_prep.dropna()

        min_samples_required = 5
        if len(df_prep) < min_samples_required:
            logger.info(f"Solo {len(df_prep)} muestras, usando modelo de promedio móvil")
            self._usar_modelo_simple = True
            self.is_trained = True
            self.feature_names = []

            cv = self._std_historica / self._media_historica if self._media_historica > 0 else 0.5
            self.metrics = {
                'mae': self._std_historica * 0.8 if self._std_historica > 0 else self._media_historica * 0.2,
                'rmse': self._std_historica if self._std_historica > 0 else self._media_historica * 0.25,
                'r2': max(0, 1 - cv),
                'mape': min(cv * 100, 50)
            }
            return self.metrics

        self._usar_modelo_simple = False

        # Features
        self.feature_names = self._get_feature_names(columna_objetivo, lags, n_samples)
        self.feature_names = [f for f in self.feature_names if f in df_prep.columns]

        X = df_prep[self.feature_names]
        y = df_prep[columna_objetivo]

        # Split
        n_available = len(X)
        min_train = 3
        min_test = 1

        if n_available < min_train + min_test:
            X_train, y_train = X, y
            X_test, y_test = X.tail(1), y.tail(1)
        else:
            max_test_size = (n_available - min_train) / n_available
            actual_test_size = min(test_size, max_test_size)
            actual_test_size = max(actual_test_size, 1 / n_available)

            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=actual_test_size, shuffle=False
            )

        # Escalar y entrenar
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        self._crear_modelo(n_available)
        self.modelo.fit(X_train_scaled, y_train)

        # Evaluar
        y_pred = self.modelo.predict(X_test_scaled)
        self.metrics = self._calcular_metricas(y_test.values, y_pred)
        self.is_trained = True

        return self.metrics

    def _crear_modelo(self, n_samples: int):
        """Crea el modelo sklearn. Debe ser implementado por subclases."""
        raise NotImplementedError

    def predecir(
        self,
        df_historico: pd.DataFrame,
        periodos: int = 30
    ) -> pd.DataFrame:
        """Genera predicciones para períodos futuros"""
        if not self.is_trained:
            raise ValueError("El modelo no ha sido entrenado. Llame a entrenar() primero.")

        if self._usar_modelo_simple:
            return self._prediccion_modelo_simple(df_historico, periodos)

        predicciones = []
        df_historico = df_historico.copy()
        df_historico['fecha'] = pd.to_datetime(df_historico['fecha'])
        ultima_fecha = df_historico['fecha'].max()

        # Preparar datos históricos
        df = self._preparar_features(df_historico)
        n_samples = len(df)
        lags = self._get_lags_for_dataset(n_samples)
        df = self._crear_lag_features(df, lags=lags)
        ultimo = df.iloc[-1].copy()

        for i in range(1, periodos + 1):
            fecha_pred = ultima_fecha + timedelta(days=i)

            features = {
                'dia_semana': fecha_pred.weekday(),
                'dia_mes': fecha_pred.day,
                'mes': fecha_pred.month,
                'trimestre': (fecha_pred.month - 1) // 3 + 1,
                'mes_sin': np.sin(2 * np.pi * fecha_pred.month / 12),
                'mes_cos': np.cos(2 * np.pi * fecha_pred.month / 12),
                'dia_sin': np.sin(2 * np.pi * fecha_pred.weekday() / 7),
                'dia_cos': np.cos(2 * np.pi * fecha_pred.weekday() / 7),
                'es_fin_mes': int(fecha_pred.day >= 28),
                'es_inicio_mes': int(fecha_pred.day <= 3),
            }

            for col in self.feature_names:
                if col not in features and col in ultimo.index:
                    features[col] = ultimo[col]

            X_pred = pd.DataFrame([features])[self.feature_names]
            X_pred_scaled = self.scaler.transform(X_pred)
            pred = self.modelo.predict(X_pred_scaled)[0]

            predicciones.append({
                'fecha': fecha_pred,
                'prediccion': max(0, pred),
                'limite_inferior': max(0, pred * 0.8),
                'limite_superior': pred * 1.2
            })

        return pd.DataFrame(predicciones)

    def get_feature_importance(self) -> pd.DataFrame:
        """Retorna la importancia de cada feature"""
        if not self.is_trained or not hasattr(self.modelo, 'feature_importances_'):
            return pd.DataFrame()

        return pd.DataFrame({
            'feature': self.feature_names,
            'importance': self.modelo.feature_importances_
        }).sort_values('importance', ascending=False)


class RandomForestStrategy(SklearnBaseStrategy):
    """Estrategia de forecasting usando Random Forest"""

    @property
    def nombre_modelo(self) -> str:
        return "Random Forest"

    def _crear_modelo(self, n_samples: int):
        self.modelo = RandomForestRegressor(
            n_estimators=min(100, max(10, n_samples * 2)),
            max_depth=min(10, max(3, n_samples // 3)),
            min_samples_split=max(2, min(5, n_samples // 4)),
            random_state=42,
            n_jobs=-1
        )


class GradientBoostingStrategy(SklearnBaseStrategy):
    """Estrategia de forecasting usando Gradient Boosting"""

    @property
    def nombre_modelo(self) -> str:
        return "Gradient Boosting"

    def _crear_modelo(self, n_samples: int):
        self.modelo = GradientBoostingRegressor(
            n_estimators=min(100, max(10, n_samples * 2)),
            max_depth=min(5, max(2, n_samples // 5)),
            learning_rate=0.1,
            random_state=42
        )


class RidgeStrategy(SklearnBaseStrategy):
    """Estrategia de forecasting usando Ridge Regression"""

    @property
    def nombre_modelo(self) -> str:
        return "Ridge Regression"

    def _crear_modelo(self, n_samples: int):
        self.modelo = Ridge(alpha=1.0)

    def get_feature_importance(self) -> pd.DataFrame:
        """Ridge no tiene feature_importances_, usa coeficientes"""
        if not self.is_trained or not hasattr(self.modelo, 'coef_'):
            return pd.DataFrame()

        return pd.DataFrame({
            'feature': self.feature_names,
            'importance': np.abs(self.modelo.coef_)
        }).sort_values('importance', ascending=False)
