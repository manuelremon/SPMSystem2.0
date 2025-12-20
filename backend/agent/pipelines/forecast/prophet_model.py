"""
Estrategia de Forecasting con Prophet
=====================================
Implementación de Facebook Prophet para forecasting de demanda.

Prophet es ideal para:
- Series con estacionalidad fuerte (anual, semanal)
- Series con efectos de días festivos
- Series con tendencia no lineal
- Datos con valores faltantes

Adaptado de ForecastDemandaMateriales para SPM v2.0
"""
from typing import Dict
import pandas as pd
import numpy as np
from datetime import timedelta
import logging

from .base import ForecastStrategy

logger = logging.getLogger(__name__)

# Importación opcional
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    logger.warning("Prophet no está instalado. Instale con: pip install prophet")


class ProphetStrategy(ForecastStrategy):
    """
    Estrategia de forecasting usando Facebook Prophet.

    Prophet maneja su propio feature engineering internamente,
    capturando automáticamente:
    - Tendencia (lineal o logística)
    - Estacionalidad anual
    - Estacionalidad semanal
    - Efectos de días festivos
    """

    def __init__(self, **kwargs):
        if not PROPHET_AVAILABLE:
            raise ImportError(
                "Prophet no está instalado. "
                "Instale con: pip install prophet"
            )
        super().__init__()

        # Parámetros configurables
        self.yearly_seasonality = kwargs.get('yearly_seasonality', True)
        self.weekly_seasonality = kwargs.get('weekly_seasonality', True)
        self.daily_seasonality = kwargs.get('daily_seasonality', False)
        self.seasonality_mode = kwargs.get('seasonality_mode', 'multiplicative')
        self.interval_width = kwargs.get('interval_width', 0.95)
        self.changepoint_prior_scale = kwargs.get('changepoint_prior_scale', 0.05)

    @property
    def nombre_modelo(self) -> str:
        return "Prophet"

    @property
    def requiere_features_adicionales(self) -> bool:
        """Prophet hace su propio feature engineering"""
        return False

    def entrenar(
        self,
        df: pd.DataFrame,
        columna_objetivo: str = 'cantidad',
        test_size: float = 0.2
    ) -> Dict[str, float]:
        """
        Entrena el modelo Prophet.

        Prophet requiere formato especial: columnas 'ds' (fecha) y 'y' (valor).
        """
        # Guardar estadísticas para fallback
        self._media_historica = df[columna_objetivo].mean()
        self._std_historica = df[columna_objetivo].std()
        self._ultimo_valor = df[columna_objetivo].iloc[-1] if len(df) > 0 else 0

        # Verificar datos mínimos
        if len(df) < 10:
            logger.info(f"Solo {len(df)} muestras, usando modelo de promedio móvil")
            self._usar_modelo_simple = True
            self.is_trained = True

            cv = self._std_historica / self._media_historica if self._media_historica > 0 else 0.5
            self.metrics = {
                'mae': self._std_historica * 0.8 if self._std_historica > 0 else self._media_historica * 0.2,
                'rmse': self._std_historica if self._std_historica > 0 else self._media_historica * 0.25,
                'r2': max(0, 1 - cv),
                'mape': min(cv * 100, 50)
            }
            return self.metrics

        self._usar_modelo_simple = False

        # Preparar datos en formato Prophet
        df_prophet = pd.DataFrame({
            'ds': pd.to_datetime(df['fecha']),
            'y': df[columna_objetivo]
        })

        # Asegurar que no hay valores negativos (Prophet puede tener problemas)
        df_prophet['y'] = df_prophet['y'].clip(lower=0)

        # Split para evaluación
        n = len(df_prophet)
        train_size = int(n * (1 - test_size))
        df_train = df_prophet.iloc[:train_size]
        df_test = df_prophet.iloc[train_size:]

        # Crear y entrenar modelo Prophet
        self.modelo = Prophet(
            yearly_seasonality=self.yearly_seasonality,
            weekly_seasonality=self.weekly_seasonality,
            daily_seasonality=self.daily_seasonality,
            seasonality_mode=self.seasonality_mode,
            interval_width=self.interval_width,
            changepoint_prior_scale=self.changepoint_prior_scale
        )

        # Entrenar modelo (Prophet 1.2+ ya no usa suppress_logging)
        logging.getLogger('cmdstanpy').setLevel(logging.WARNING)
        self.modelo.fit(df_train)

        # Evaluar en test set
        if len(df_test) > 0:
            forecast = self.modelo.predict(df_test[['ds']])
            y_true = df_test['y'].values
            y_pred = forecast['yhat'].values
            self.metrics = self._calcular_metricas(y_true, y_pred)
        else:
            # Evaluación in-sample si no hay suficientes datos para test
            forecast = self.modelo.predict(df_train[['ds']])
            y_true = df_train['y'].values
            y_pred = forecast['yhat'].values
            self.metrics = self._calcular_metricas(y_true, y_pred)

        self.is_trained = True
        return self.metrics

    def predecir(
        self,
        df_historico: pd.DataFrame,
        periodos: int = 30
    ) -> pd.DataFrame:
        """
        Genera predicciones futuras con Prophet.

        Prophet incluye intervalos de confianza nativos (yhat_lower, yhat_upper).
        """
        if not self.is_trained:
            raise ValueError("El modelo no ha sido entrenado. Llame a entrenar() primero.")

        if self._usar_modelo_simple:
            return self._prediccion_modelo_simple(df_historico, periodos)

        # Crear dataframe futuro basado en el modelo entrenado
        future = self.modelo.make_future_dataframe(periods=periodos)
        forecast = self.modelo.predict(future)

        # Obtener la última fecha de entrenamiento del modelo
        # Prophet guarda el historial en self.modelo.history
        ultima_fecha_modelo = pd.to_datetime(self.modelo.history['ds']).max()

        # Filtrar solo predicciones futuras
        forecast_futuro = forecast[forecast['ds'] > ultima_fecha_modelo].copy()

        if len(forecast_futuro) == 0:
            # Fallback: usar las últimas N predicciones
            forecast_futuro = forecast.tail(periodos).copy()

        return pd.DataFrame({
            'fecha': forecast_futuro['ds'].values,
            'prediccion': forecast_futuro['yhat'].clip(lower=0).values,
            'limite_inferior': forecast_futuro['yhat_lower'].clip(lower=0).values,
            'limite_superior': forecast_futuro['yhat_upper'].values
        })

    def get_feature_importance(self) -> pd.DataFrame:
        """
        Prophet no tiene feature importance tradicional.
        Retorna importancia aproximada basada en componentes.
        """
        if not self.is_trained or self._usar_modelo_simple:
            return pd.DataFrame()

        # Aproximación basada en componentes de estacionalidad
        components = []
        importance_values = []

        if self.yearly_seasonality:
            components.append('Estacionalidad Anual')
            importance_values.append(0.35)

        if self.weekly_seasonality:
            components.append('Estacionalidad Semanal')
            importance_values.append(0.30)

        components.append('Tendencia')
        importance_values.append(0.35)

        return pd.DataFrame({
            'feature': components,
            'importance': importance_values
        }).sort_values('importance', ascending=False)

    def get_components(self, df_historico: pd.DataFrame) -> pd.DataFrame:
        """
        Obtiene los componentes descompuestos de Prophet.

        Útil para analizar tendencia, estacionalidad por separado.
        """
        if not self.is_trained or self._usar_modelo_simple:
            return pd.DataFrame()

        df_prophet = pd.DataFrame({
            'ds': pd.to_datetime(df_historico['fecha'])
        })

        forecast = self.modelo.predict(df_prophet)

        components = ['ds', 'trend']
        if self.yearly_seasonality:
            components.append('yearly')
        if self.weekly_seasonality:
            components.append('weekly')

        return forecast[components]


def is_prophet_available() -> bool:
    """Verifica si Prophet está disponible"""
    return PROPHET_AVAILABLE
