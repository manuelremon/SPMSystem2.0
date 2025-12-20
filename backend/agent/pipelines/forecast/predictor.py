"""
Predictores de Machine Learning para MRP
=========================================
Modelos de demanda, clasificación y optimización de stock.

Soporta múltiples modelos de forecasting:
- Random Forest (sklearn)
- Gradient Boosting (sklearn)
- XGBoost (si está instalado)
- Prophet (si está instalado)
- ARIMA/SARIMAX (si está instalado)

Adaptado de ForecastDemandaMateriales para SPM v2.0
"""
import pandas as pd
import numpy as np
import hashlib
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
import threading
import logging

# Scikit-learn imports
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from scipy import stats
import joblib

logger = logging.getLogger(__name__)

# Importar sistema de estrategias
from . import (
    obtener_estrategia,
    obtener_estrategias_disponibles,
    obtener_nombres_modelos,
    listar_estrategias
)

# ============================================================================
# Cache de Modelos ML con Persistencia en Disco
# ============================================================================
_model_cache: Dict[str, 'DemandPredictor'] = {}
_cache_lock = threading.Lock()
_cache_max_size = 20

# Directorio para persistir modelos en disco
_MODELS_DIR = Path(__file__).parent.parent.parent.parent / "data" / "models"
_MODELS_DIR.mkdir(parents=True, exist_ok=True)


def _compute_data_hash(df: pd.DataFrame, codigo: str = None) -> str:
    """Calcula hash único para los datos de entrenamiento"""
    if df is None or len(df) == 0:
        return "empty"
    sample = f"{codigo or 'global'}_{len(df)}_{df['cantidad'].sum() if 'cantidad' in df.columns else 0}"
    if 'fecha' in df.columns:
        sample += f"_{df['fecha'].min()}_{df['fecha'].max()}"
    return hashlib.md5(sample.encode()).hexdigest()[:16]


def _get_model_path(cache_key: str) -> Path:
    """Obtiene la ruta del archivo de modelo en disco"""
    return _MODELS_DIR / f"{cache_key}.joblib"


def _load_from_disk(cache_key: str) -> Optional['DemandPredictor']:
    """Intenta cargar un modelo desde disco"""
    model_path = _get_model_path(cache_key)
    if model_path.exists():
        try:
            predictor = joblib.load(model_path)
            logger.debug(f"Modelo cargado desde disco: {cache_key}")
            return predictor
        except Exception as e:
            logger.warning(f"Error cargando modelo desde disco: {e}")
            model_path.unlink(missing_ok=True)
    return None


def _save_to_disk(cache_key: str, predictor: 'DemandPredictor') -> bool:
    """Guarda un modelo en disco"""
    try:
        model_path = _get_model_path(cache_key)
        joblib.dump(predictor, model_path, compress=3)
        logger.debug(f"Modelo guardado en disco: {cache_key}")
        return True
    except Exception as e:
        logger.warning(f"Error guardando modelo en disco: {e}")
        return False


def get_cached_predictor(
    df: pd.DataFrame,
    codigo: str = None,
    modelo_tipo: str = "random_forest"
) -> Tuple['DemandPredictor', bool]:
    """
    Obtiene predictor desde cache (memoria o disco) o crea uno nuevo.
    """
    cache_key = f"{modelo_tipo}_{_compute_data_hash(df, codigo)}"

    with _cache_lock:
        if cache_key in _model_cache:
            logger.debug(f"Cache memoria hit: {cache_key}")
            return _model_cache[cache_key], True

    predictor = _load_from_disk(cache_key)
    if predictor is not None:
        with _cache_lock:
            if len(_model_cache) >= _cache_max_size:
                oldest_key = next(iter(_model_cache))
                del _model_cache[oldest_key]
            _model_cache[cache_key] = predictor
        return predictor, True

    predictor = DemandPredictor(modelo=modelo_tipo)

    if df is None or len(df) == 0:
        return predictor, False

    try:
        predictor.entrenar(df)
        _save_to_disk(cache_key, predictor)

        with _cache_lock:
            if len(_model_cache) >= _cache_max_size:
                oldest_key = next(iter(_model_cache))
                del _model_cache[oldest_key]
            _model_cache[cache_key] = predictor

    except Exception as e:
        logger.error(f"Error entrenando predictor: {e}")

    return predictor, False


def clear_model_cache(clear_disk: bool = False):
    """Limpia el cache de modelos"""
    global _model_cache
    with _cache_lock:
        _model_cache.clear()

    if clear_disk:
        try:
            for model_file in _MODELS_DIR.glob("*.joblib"):
                model_file.unlink()
            logger.debug("Cache de modelos en disco limpiado")
        except Exception as e:
            logger.warning(f"Error limpiando cache de disco: {e}")

    logger.debug("Cache de modelos en memoria limpiado")


class DemandPredictor:
    """
    Predictor de demanda basado en series temporales y ML.

    Soporta múltiples modelos de forecasting mediante el patrón Strategy.
    """

    def __init__(self, modelo: str = "random_forest", **kwargs):
        self.modelo_tipo = modelo
        self._kwargs = kwargs

        self._estrategia = obtener_estrategia(modelo, **kwargs)

        if self._estrategia is not None:
            self._usar_legacy = False
            logger.debug(f"Usando estrategia: {self._estrategia.nombre_modelo}")
        else:
            self._usar_legacy = True
            logger.debug(f"Usando implementación legacy para: {modelo}")

        self.modelo = None
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names = []
        self.metrics = {}

    @staticmethod
    def modelos_disponibles() -> Dict[str, str]:
        """Retorna diccionario de modelos disponibles."""
        return obtener_nombres_modelos()

    @staticmethod
    def listar_modelos() -> List[str]:
        """Lista los identificadores de modelos disponibles."""
        return obtener_estrategias_disponibles()

    def _preparar_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepara features temporales para el modelo"""
        df = df.copy()
        df['fecha'] = pd.to_datetime(df['fecha'])

        df['dia_semana'] = df['fecha'].dt.dayofweek
        df['dia_mes'] = df['fecha'].dt.day
        df['mes'] = df['fecha'].dt.month
        df['trimestre'] = df['fecha'].dt.quarter
        df['semana_ano'] = df['fecha'].dt.isocalendar().week
        df['es_fin_mes'] = (df['fecha'].dt.is_month_end).astype(int)
        df['es_inicio_mes'] = (df['fecha'].dt.is_month_start).astype(int)

        df['mes_sin'] = np.sin(2 * np.pi * df['mes'] / 12)
        df['mes_cos'] = np.cos(2 * np.pi * df['mes'] / 12)
        df['dia_sin'] = np.sin(2 * np.pi * df['dia_semana'] / 7)
        df['dia_cos'] = np.cos(2 * np.pi * df['dia_semana'] / 7)

        return df

    def _crear_lag_features(
        self,
        df: pd.DataFrame,
        columna: str = 'cantidad',
        lags: List[int] = [1, 7, 14, 30]
    ) -> pd.DataFrame:
        """Crea features de lag (valores anteriores)"""
        df = df.copy()

        for lag in lags:
            df[f'{columna}_lag_{lag}'] = df[columna].shift(lag)

        df[f'{columna}_ma_7'] = df[columna].rolling(window=7, min_periods=1).mean()
        df[f'{columna}_ma_30'] = df[columna].rolling(window=30, min_periods=1).mean()
        df[f'{columna}_std_7'] = df[columna].rolling(window=7, min_periods=1).std()
        df[f'{columna}_diff'] = df[columna].diff()

        return df

    def entrenar(
        self,
        df: pd.DataFrame,
        columna_objetivo: str = 'cantidad',
        test_size: float = 0.2
    ) -> Dict[str, float]:
        """Entrena el modelo con datos históricos."""
        if not self._usar_legacy and self._estrategia is not None:
            self.metrics = self._estrategia.entrenar(df, columna_objetivo, test_size)
            self.is_trained = self._estrategia.is_trained
            self.feature_names = self._estrategia.feature_names
            self.modelo = self._estrategia.modelo
            self.scaler = self._estrategia.scaler
            self._media_historica = self._estrategia._media_historica
            self._std_historica = self._estrategia._std_historica
            self._usar_modelo_simple = self._estrategia._usar_modelo_simple
            return self.metrics

        # Legacy implementation
        self._media_historica = df[columna_objetivo].mean()
        self._std_historica = df[columna_objetivo].std()
        self._ultimo_valor = df[columna_objetivo].iloc[-1] if len(df) > 0 else 0

        df_prep = self._preparar_features(df)
        n_samples = len(df_prep)

        if n_samples < 35:
            lags = [1]
            if n_samples >= 7:
                lags.append(7)
        else:
            lags = [1, 7, 14, 30]

        df_prep = self._crear_lag_features(df_prep, columna_objetivo, lags=lags)
        df_prep = df_prep.dropna()

        if len(df_prep) < 5:
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

        self.feature_names = base_features + lag_features + rolling_features
        self.feature_names = [f for f in self.feature_names if f in df_prep.columns]

        X = df_prep[self.feature_names]
        y = df_prep[columna_objetivo]

        n_available = len(X)
        if n_available < 4:
            X_train, y_train = X, y
            X_test, y_test = X.tail(1), y.tail(1)
        else:
            max_test_size = (n_available - 3) / n_available
            actual_test_size = min(test_size, max_test_size)
            actual_test_size = max(actual_test_size, 1 / n_available)

            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=actual_test_size, shuffle=False
            )

        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        if self.modelo_tipo == "random_forest":
            self.modelo = RandomForestRegressor(
                n_estimators=min(100, max(10, n_available * 2)),
                max_depth=min(10, max(3, n_available // 3)),
                min_samples_split=max(2, min(5, n_available // 4)),
                random_state=42,
                n_jobs=-1
            )
        elif self.modelo_tipo == "gradient_boosting":
            self.modelo = GradientBoostingRegressor(
                n_estimators=min(100, max(10, n_available * 2)),
                max_depth=min(5, max(2, n_available // 5)),
                learning_rate=0.1,
                random_state=42
            )
        else:
            self.modelo = Ridge(alpha=1.0)

        self.modelo.fit(X_train_scaled, y_train)

        y_pred = self.modelo.predict(X_test_scaled)

        self.metrics = {
            'mae': mean_absolute_error(y_test, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
            'r2': r2_score(y_test, y_pred) if len(y_test) > 1 else 0.0,
            'mape': np.mean(np.abs((y_test - y_pred) / (y_test + 1))) * 100
        }

        self.is_trained = True
        return self.metrics

    def predecir(
        self,
        df_historico: pd.DataFrame,
        periodos: int = 30
    ) -> pd.DataFrame:
        """Genera predicciones para períodos futuros."""
        if not self.is_trained:
            raise ValueError("El modelo no ha sido entrenado.")

        if not self._usar_legacy and self._estrategia is not None:
            return self._estrategia.predecir(df_historico, periodos)

        predicciones = []
        df_historico = df_historico.copy()
        df_historico['fecha'] = pd.to_datetime(df_historico['fecha'])
        ultima_fecha = df_historico['fecha'].max()

        if getattr(self, '_usar_modelo_simple', False):
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

        df = self._preparar_features(df_historico)
        n_samples = len(df)
        if n_samples < 35:
            lags = [1]
            if n_samples >= 7:
                lags.append(7)
        else:
            lags = [1, 7, 14, 30]

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
        """Retorna la importancia de cada feature."""
        if not self._usar_legacy and self._estrategia is not None:
            return self._estrategia.get_feature_importance()

        if not self.is_trained or not hasattr(self.modelo, 'feature_importances_'):
            return pd.DataFrame()

        return pd.DataFrame({
            'feature': self.feature_names,
            'importance': self.modelo.feature_importances_
        }).sort_values('importance', ascending=False)

    @property
    def nombre_modelo(self) -> str:
        """Retorna el nombre legible del modelo"""
        if not self._usar_legacy and self._estrategia is not None:
            return self._estrategia.nombre_modelo

        nombres = {
            'random_forest': 'Random Forest',
            'gradient_boosting': 'Gradient Boosting',
            'linear': 'Ridge Regression',
            'xgboost': 'XGBoost',
            'prophet': 'Prophet',
            'arima': 'ARIMA'
        }
        return nombres.get(self.modelo_tipo, self.modelo_tipo)


class StockOptimizer:
    """
    Optimizador de niveles de stock usando ML.
    """

    def __init__(self):
        self.modelo_variabilidad = None
        self.scaler = StandardScaler()

    def calcular_stock_seguridad_ml(
        self,
        df_consumo: pd.DataFrame,
        nivel_servicio: float = 0.95,
        lead_time_dias: int = 14
    ) -> pd.DataFrame:
        """Calcula stock de seguridad óptimo por material"""
        resultados = []
        z = stats.norm.ppf(nivel_servicio)

        for codigo, grupo in df_consumo.groupby('codigo'):
            grupo = grupo.sort_values('fecha')

            demanda_diaria = grupo['cantidad'].mean()
            std_demanda = grupo['cantidad'].std()
            cv = std_demanda / demanda_diaria if demanda_diaria > 0 else 0

            ss = z * std_demanda * np.sqrt(lead_time_dias)
            rop = (demanda_diaria * lead_time_dias) + ss

            demanda_anual = demanda_diaria * 365
            costo_orden = 50
            costo_mantenimiento = 0.2

            if demanda_anual > 0:
                eoq = np.sqrt((2 * demanda_anual * costo_orden) / costo_mantenimiento)
            else:
                eoq = 0

            resultados.append({
                'codigo': codigo,
                'demanda_diaria_promedio': round(demanda_diaria, 2),
                'desviacion_demanda': round(std_demanda, 2),
                'coeficiente_variacion': round(cv, 3),
                'stock_seguridad_optimo': round(ss, 0),
                'punto_reorden_optimo': round(rop, 0),
                'eoq_sugerido': round(eoq, 0),
                'nivel_servicio': nivel_servicio,
                'lead_time_dias': lead_time_dias
            })

        return pd.DataFrame(resultados)
