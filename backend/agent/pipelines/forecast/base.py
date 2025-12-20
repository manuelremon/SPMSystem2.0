"""
Base Strategy para Modelos de Forecasting
==========================================
Clase abstracta que define la interfaz para todas las estrategias de forecasting.

Adaptado de ForecastDemandaMateriales para SPM v2.0
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging

from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

logger = logging.getLogger(__name__)


class ForecastStrategy(ABC):
    """
    Estrategia base abstracta para modelos de forecasting.

    Todos los modelos deben implementar esta interfaz para
    garantizar compatibilidad con DemandPredictor.
    """

    def __init__(self):
        self.modelo = None
        self.scaler = StandardScaler()
        self.is_trained = False
        self.metrics: Dict[str, float] = {}
        self.feature_names: List[str] = []
        self._media_historica: float = 0.0
        self._std_historica: float = 0.0
        self._ultimo_valor: float = 0.0
        self._usar_modelo_simple: bool = False

    @property
    @abstractmethod
    def nombre_modelo(self) -> str:
        """Nombre legible del modelo"""
        pass

    @property
    def requiere_features_adicionales(self) -> bool:
        """Indica si el modelo necesita feature engineering externo"""
        return True  # Por defecto, modelos sklearn necesitan features

    @abstractmethod
    def entrenar(
        self,
        df: pd.DataFrame,
        columna_objetivo: str = 'cantidad',
        test_size: float = 0.2
    ) -> Dict[str, float]:
        """
        Entrena el modelo con datos históricos.

        Args:
            df: DataFrame con ['fecha', 'cantidad'] mínimo
            columna_objetivo: Columna a predecir
            test_size: Proporción para test

        Returns:
            Dict con métricas: {'mae', 'rmse', 'r2', 'mape'}
        """
        pass

    @abstractmethod
    def predecir(
        self,
        df_historico: pd.DataFrame,
        periodos: int = 30
    ) -> pd.DataFrame:
        """
        Genera predicciones futuras.

        Args:
            df_historico: Datos históricos recientes
            periodos: Número de períodos a predecir

        Returns:
            DataFrame con ['fecha', 'prediccion', 'limite_inferior', 'limite_superior']
        """
        pass

    @abstractmethod
    def get_feature_importance(self) -> pd.DataFrame:
        """
        Retorna importancia de features (si aplica).

        Returns:
            DataFrame con ['feature', 'importance'] o vacío
        """
        pass

    def validar_datos(self, df: pd.DataFrame, min_registros: int = 5) -> bool:
        """Valida que hay suficientes datos para entrenar"""
        if df is None or len(df) < min_registros:
            return False
        if 'fecha' not in df.columns or 'cantidad' not in df.columns:
            return False
        return True

    def _preparar_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Prepara features temporales para el modelo.
        Método compartido por estrategias que necesitan feature engineering.
        """
        df = df.copy()
        df['fecha'] = pd.to_datetime(df['fecha'])

        # Features temporales
        df['dia_semana'] = df['fecha'].dt.dayofweek
        df['dia_mes'] = df['fecha'].dt.day
        df['mes'] = df['fecha'].dt.month
        df['trimestre'] = df['fecha'].dt.quarter
        df['semana_ano'] = df['fecha'].dt.isocalendar().week
        df['es_fin_mes'] = (df['fecha'].dt.is_month_end).astype(int)
        df['es_inicio_mes'] = (df['fecha'].dt.is_month_start).astype(int)

        # Codificación cíclica para mes
        df['mes_sin'] = np.sin(2 * np.pi * df['mes'] / 12)
        df['mes_cos'] = np.cos(2 * np.pi * df['mes'] / 12)

        # Codificación cíclica para día de la semana
        df['dia_sin'] = np.sin(2 * np.pi * df['dia_semana'] / 7)
        df['dia_cos'] = np.cos(2 * np.pi * df['dia_semana'] / 7)

        return df

    def _crear_lag_features(
        self,
        df: pd.DataFrame,
        columna: str = 'cantidad',
        lags: List[int] = None
    ) -> pd.DataFrame:
        """
        Crea features de lag (valores anteriores).
        """
        if lags is None:
            lags = [1, 7, 14, 30]

        df = df.copy()

        for lag in lags:
            df[f'{columna}_lag_{lag}'] = df[columna].shift(lag)

        # Media móvil
        df[f'{columna}_ma_7'] = df[columna].rolling(window=7, min_periods=1).mean()
        df[f'{columna}_ma_30'] = df[columna].rolling(window=30, min_periods=1).mean()

        # Desviación estándar móvil
        df[f'{columna}_std_7'] = df[columna].rolling(window=7, min_periods=1).std()

        # Tendencia
        df[f'{columna}_diff'] = df[columna].diff()

        return df

    def _calcular_metricas(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray
    ) -> Dict[str, float]:
        """Calcula métricas estándar de evaluación"""
        return {
            'mae': mean_absolute_error(y_true, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_true, y_pred)),
            'r2': r2_score(y_true, y_pred) if len(y_true) > 1 else 0.0,
            'mape': np.mean(np.abs((y_true - y_pred) / (y_true + 1))) * 100
        }

    def _prediccion_modelo_simple(
        self,
        df_historico: pd.DataFrame,
        periodos: int
    ) -> pd.DataFrame:
        """
        Genera predicciones usando modelo simple (para datos insuficientes).
        """
        df_historico['fecha'] = pd.to_datetime(df_historico['fecha'])
        ultima_fecha = df_historico['fecha'].max()

        predicciones = []

        # Calcular tendencia simple
        if len(df_historico) >= 3:
            valores_recientes = df_historico['cantidad'].tail(7).values
            tendencia = (valores_recientes[-1] - valores_recientes[0]) / len(valores_recientes) if len(valores_recientes) > 1 else 0
        else:
            tendencia = 0

        for i in range(1, periodos + 1):
            fecha_pred = ultima_fecha + timedelta(days=i)

            pred = self._media_historica + (tendencia * i * 0.1)
            pred = max(0, pred)

            std = self._std_historica if self._std_historica > 0 else self._media_historica * 0.2

            predicciones.append({
                'fecha': fecha_pred,
                'prediccion': pred,
                'limite_inferior': max(0, pred - 1.5 * std),
                'limite_superior': pred + 1.5 * std
            })

        return pd.DataFrame(predicciones)
