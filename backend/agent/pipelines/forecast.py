"""
Pipeline de Forecast de Demanda - Módulo Principal

Contiene clases y funciones para predicción de demanda de materiales
usando múltiples modelos de ML.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# =============================================================================
# Constantes y Configuración
# =============================================================================

MODELOS_DISPONIBLES = [
    "random_forest",
    "gradient_boosting",
    "linear",
    "ridge"
]

NOMBRES_MODELOS = {
    "random_forest": "Random Forest",
    "gradient_boosting": "Gradient Boosting",
    "linear": "Regresión Lineal",
    "ridge": "Ridge Regression",
    "xgboost": "XGBoost",
    "prophet": "Prophet",
    "arima": "ARIMA"
}


def obtener_estrategias_disponibles() -> List[str]:
    """Retorna lista de modelos de forecast disponibles."""
    return MODELOS_DISPONIBLES.copy()


def obtener_nombres_modelos() -> Dict[str, str]:
    """Retorna diccionario de nombres legibles de modelos."""
    return NOMBRES_MODELOS.copy()


# =============================================================================
# Dataclasses para Resultados
# =============================================================================

@dataclass
class ForecastResult:
    """Resultado de una predicción de forecast."""
    predicciones: List[Dict[str, Any]]
    metricas: Dict[str, float]
    modelo: str
    material: str
    fecha_generacion: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "predicciones": self.predicciones,
            "metricas": self.metricas,
            "modelo": self.modelo,
            "material": self.material,
            "fecha_generacion": self.fecha_generacion
        }


@dataclass
class BacktestReport:
    """Reporte de backtesting."""
    modelo: str
    metricas_promedio: Dict[str, float]
    metricas_por_paso: List[Dict[str, float]]
    predicciones_vs_real: List[Dict[str, Any]]
    ventana_test: int
    n_pasos: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "modelo": self.modelo,
            "metricas_promedio": self.metricas_promedio,
            "metricas_por_paso": self.metricas_por_paso,
            "predicciones_vs_real": self.predicciones_vs_real,
            "ventana_test": self.ventana_test,
            "n_pasos": self.n_pasos
        }


@dataclass
class AutoSelectResult:
    """Resultado de auto-selección de modelo."""
    mejor_modelo: str
    metricas: Dict[str, float]
    ranking: List[Dict[str, Any]]
    recomendacion: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mejor_modelo": self.mejor_modelo,
            "metricas": self.metricas,
            "ranking": self.ranking,
            "recomendacion": self.recomendacion
        }


@dataclass
class TuningResult:
    """Resultado de optimización de hiperparámetros."""
    modelo: str
    mejores_params: Dict[str, Any]
    score_antes: float
    score_despues: float
    mejora_porcentual: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "modelo": self.modelo,
            "mejores_params": self.mejores_params,
            "score_antes": self.score_antes,
            "score_despues": self.score_despues,
            "mejora_porcentual": self.mejora_porcentual
        }


# =============================================================================
# Clase Principal: DemandPredictor
# =============================================================================

class DemandPredictor:
    """
    Predictor de demanda de materiales usando múltiples modelos ML.
    """

    def __init__(self, modelo_tipo: str = "random_forest"):
        """
        Inicializa el predictor.

        Args:
            modelo_tipo: Tipo de modelo a usar
        """
        self.modelo_tipo = modelo_tipo
        self.modelo = None
        self.scaler = StandardScaler()
        self.feature_cols = []
        self.is_fitted = False

    def _crear_modelo(self, modelo_tipo: str = None):
        """Crea instancia del modelo especificado."""
        tipo = modelo_tipo or self.modelo_tipo

        if tipo == "random_forest":
            return RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
        elif tipo == "gradient_boosting":
            return GradientBoostingRegressor(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                random_state=42
            )
        elif tipo in ["linear", "ridge"]:
            return Ridge(alpha=1.0)
        else:
            logger.warning(f"Modelo {tipo} no soportado, usando random_forest")
            return RandomForestRegressor(n_estimators=100, random_state=42)

    def _preparar_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Prepara features temporales para el modelo.

        Args:
            df: DataFrame con columnas 'fecha' y 'cantidad'

        Returns:
            DataFrame con features adicionales
        """
        df = df.copy()

        # Asegurar que fecha sea datetime
        if not pd.api.types.is_datetime64_any_dtype(df['fecha']):
            df['fecha'] = pd.to_datetime(df['fecha'])

        # Features temporales
        df['dia_semana'] = df['fecha'].dt.dayofweek
        df['dia_mes'] = df['fecha'].dt.day
        df['mes'] = df['fecha'].dt.month
        df['trimestre'] = df['fecha'].dt.quarter
        df['es_fin_semana'] = (df['dia_semana'] >= 5).astype(int)
        df['semana_año'] = df['fecha'].dt.isocalendar().week.astype(int)

        # Ordenar por fecha
        df = df.sort_values('fecha').reset_index(drop=True)

        return df

    def _crear_lag_features(self, df: pd.DataFrame, lags: List[int] = None) -> pd.DataFrame:
        """
        Crea features de lag (valores pasados).

        Args:
            df: DataFrame con datos
            lags: Lista de periodos de lag

        Returns:
            DataFrame con lag features
        """
        if lags is None:
            lags = [1, 2, 3, 7, 14, 30]

        df = df.copy()

        for lag in lags:
            if lag < len(df):
                df[f'cantidad_lag_{lag}'] = df['cantidad'].shift(lag)

        # Rolling statistics
        for window in [7, 14, 30]:
            if window < len(df):
                df[f'cantidad_media_{window}d'] = df['cantidad'].rolling(window).mean()
                df[f'cantidad_std_{window}d'] = df['cantidad'].rolling(window).std()

        return df

    def fit(self, df: pd.DataFrame) -> 'DemandPredictor':
        """
        Entrena el modelo con datos históricos.

        Args:
            df: DataFrame con columnas 'fecha' y 'cantidad'

        Returns:
            self
        """
        # Preparar datos
        df_prep = self._preparar_features(df)
        df_prep = self._crear_lag_features(df_prep)

        # Eliminar filas con NaN
        df_prep = df_prep.dropna()

        if len(df_prep) < 10:
            raise ValueError(f"Datos insuficientes después de preparación: {len(df_prep)} filas")

        # Separar features y target
        self.feature_cols = [c for c in df_prep.columns if c not in ['fecha', 'cantidad']]
        X = df_prep[self.feature_cols].values
        y = df_prep['cantidad'].values

        # Escalar features
        X_scaled = self.scaler.fit_transform(X)

        # Crear y entrenar modelo
        self.modelo = self._crear_modelo()
        self.modelo.fit(X_scaled, y)
        self.is_fitted = True

        logger.info(f"Modelo {self.modelo_tipo} entrenado con {len(df_prep)} registros")

        return self

    def predict(self, df: pd.DataFrame, dias: int = 30) -> ForecastResult:
        """
        Genera predicciones para los próximos días.
        """
        if not self.is_fitted:
            self.fit(df)

        # Preparar datos base
        df_prep = self._preparar_features(df)
        df_prep = self._crear_lag_features(df_prep)
        df_prep = df_prep.dropna()

        predicciones = []
        ultima_fecha = df_prep['fecha'].max()

        # Use deque for efficient lag lookups instead of pd.concat in loop
        from collections import deque
        recent_values = deque(df_prep['cantidad'].tolist(), maxlen=max(30, dias))

        # Pre-compute std for confidence intervals
        std_estimado = df_prep['cantidad'].std() * 0.2

        for i in range(dias):
            fecha_pred = ultima_fecha + timedelta(days=i+1)

            # Build features from recent_values instead of full DataFrame
            fila_dict = {
                'fecha': fecha_pred,
                'cantidad': 0,
                'dia_semana': fecha_pred.weekday(),
                'dia_mes': fecha_pred.day,
                'mes': fecha_pred.month,
                'trimestre': (fecha_pred.month - 1) // 3 + 1,
                'es_fin_semana': 1 if fecha_pred.weekday() >= 5 else 0,
                'semana_año': fecha_pred.isocalendar()[1]
            }

            # Add lag features from deque
            vals = list(recent_values)
            for lag in [1, 2, 3, 7, 14, 30]:
                col_name = f'cantidad_lag_{lag}'
                if col_name in self.feature_cols:
                    if len(vals) >= lag:
                        fila_dict[col_name] = vals[-lag]
                    else:
                        fila_dict[col_name] = np.mean(vals) if vals else 0

            # Rolling features from deque
            for window in [7, 14, 30]:
                window_vals = vals[-window:] if len(vals) >= window else vals
                if f'cantidad_media_{window}d' in self.feature_cols:
                    fila_dict[f'cantidad_media_{window}d'] = np.mean(window_vals) if window_vals else 0
                if f'cantidad_std_{window}d' in self.feature_cols:
                    fila_dict[f'cantidad_std_{window}d'] = np.std(window_vals) if len(window_vals) > 1 else 0

            # Predict
            X_pred = pd.DataFrame([fila_dict])[self.feature_cols].values.reshape(1, -1)
            X_pred_scaled = self.scaler.transform(X_pred)

            pred = self.modelo.predict(X_pred_scaled)[0]
            pred = max(0, pred)

            predicciones.append({
                "fecha": fecha_pred.strftime("%Y-%m-%d"),
                "prediccion": round(pred, 2),
                "limite_inferior": round(max(0, pred - 1.96 * std_estimado), 2),
                "limite_superior": round(pred + 1.96 * std_estimado, 2)
            })

            # Append prediction to deque for next iteration's lags
            recent_values.append(pred)

        # Calcular métricas en datos de entrenamiento
        X_train = df_prep[self.feature_cols].values
        X_train_scaled = self.scaler.transform(X_train)
        y_train = df_prep['cantidad'].values
        y_pred_train = self.modelo.predict(X_train_scaled)

        metricas = {
            "mae": round(mean_absolute_error(y_train, y_pred_train), 2),
            "rmse": round(np.sqrt(mean_squared_error(y_train, y_pred_train)), 2),
            "r2": round(r2_score(y_train, y_pred_train), 4),
            "n_datos_entrenamiento": len(df_prep)
        }

        return ForecastResult(
            predicciones=predicciones,
            metricas=metricas,
            modelo=self.modelo_tipo,
            material=""
        )


# =============================================================================
# Backtester: Validación Walk-Forward
# =============================================================================

class Backtester:
    """
    Ejecuta backtesting con validación walk-forward.
    """

    def __init__(self, predictor_class, modelo_tipo: str = "random_forest"):
        """
        Inicializa el backtester.

        Args:
            predictor_class: Clase del predictor (DemandPredictor)
            modelo_tipo: Tipo de modelo a usar
        """
        self.predictor_class = predictor_class
        self.modelo_tipo = modelo_tipo

    def ejecutar(self, df: pd.DataFrame, ventana_test: int = 30, n_pasos: int = 5) -> BacktestReport:
        """Ejecuta backtesting walk-forward con paralelismo."""
        from concurrent.futures import ThreadPoolExecutor, as_completed

        df = df.copy()
        if not pd.api.types.is_datetime64_any_dtype(df['fecha']):
            df['fecha'] = pd.to_datetime(df['fecha'])
        df = df.sort_values('fecha').reset_index(drop=True)

        total_dias = len(df)
        min_train = max(60, total_dias // 2)

        def _run_paso(paso):
            test_end = total_dias - paso * ventana_test
            test_start = test_end - ventana_test
            train_end = test_start

            if train_end < min_train:
                return None, []

            df_train = df.iloc[:train_end]
            df_test = df.iloc[test_start:test_end]

            if len(df_test) == 0:
                return None, []

            predictor = self.predictor_class(modelo_tipo=self.modelo_tipo)
            try:
                result = predictor.fit(df_train).predict(df_train, dias=len(df_test))
                y_real = df_test['cantidad'].values
                y_pred = [p['prediccion'] for p in result.predicciones[:len(y_real)]]
                mae = mean_absolute_error(y_real, y_pred)
                rmse = np.sqrt(mean_squared_error(y_real, y_pred))

                metrica = {"paso": paso + 1, "mae": round(mae, 2), "rmse": round(rmse, 2), "n_dias": len(y_real)}
                preds = []
                for i in range(min(5, len(y_real))):
                    preds.append({
                        "fecha": result.predicciones[i]['fecha'],
                        "real": round(y_real[i], 2),
                        "prediccion": round(y_pred[i], 2),
                        "error": round(abs(y_real[i] - y_pred[i]), 2)
                    })
                return metrica, preds
            except Exception as e:
                logger.warning(f"Error en paso {paso}: {e}")
                return None, []

        metricas_pasos = []
        predicciones_vs_real = []

        with ThreadPoolExecutor(max_workers=min(4, n_pasos)) as executor:
            futures = {executor.submit(_run_paso, paso): paso for paso in range(n_pasos)}
            for future in as_completed(futures):
                metrica, preds = future.result()
                if metrica is not None:
                    metricas_pasos.append(metrica)
                    predicciones_vs_real.extend(preds)

        metricas_pasos.sort(key=lambda x: x['paso'])

        if metricas_pasos:
            metricas_promedio = {
                "mae": round(np.mean([m['mae'] for m in metricas_pasos]), 2),
                "rmse": round(np.mean([m['rmse'] for m in metricas_pasos]), 2),
                "n_pasos_exitosos": len(metricas_pasos)
            }
        else:
            metricas_promedio = {"mae": 0, "rmse": 0, "n_pasos_exitosos": 0}

        return BacktestReport(
            modelo=self.modelo_tipo,
            metricas_promedio=metricas_promedio,
            metricas_por_paso=metricas_pasos,
            predicciones_vs_real=predicciones_vs_real,
            ventana_test=ventana_test,
            n_pasos=n_pasos
        )


# =============================================================================
# ModelComparator: Comparación de Modelos
# =============================================================================

class ModelComparator:
    """
    Compara múltiples modelos de forecast.
    """

    def __init__(self, predictor_class):
        """
        Args:
            predictor_class: Clase del predictor
        """
        self.predictor_class = predictor_class

    def comparar(self, df: pd.DataFrame, modelos: List[str] = None) -> Dict[str, Any]:
        """Compara múltiples modelos usando backtesting con paralelismo."""
        from concurrent.futures import ThreadPoolExecutor, as_completed

        if modelos is None:
            modelos = MODELOS_DISPONIBLES

        resultados = {}

        def _eval_modelo(modelo):
            try:
                backtester = Backtester(self.predictor_class, modelo)
                report = backtester.ejecutar(df, ventana_test=30, n_pasos=3)
                return modelo, {
                    "mae": report.metricas_promedio['mae'],
                    "rmse": report.metricas_promedio['rmse'],
                    "nombre": NOMBRES_MODELOS.get(modelo, modelo),
                    "report": report
                }
            except Exception as e:
                logger.warning(f"Error comparando modelo {modelo}: {e}")
                return modelo, {
                    "mae": float('inf'),
                    "rmse": float('inf'),
                    "nombre": NOMBRES_MODELOS.get(modelo, modelo),
                    "error": str(e)
                }

        with ThreadPoolExecutor(max_workers=min(4, len(modelos))) as executor:
            futures = [executor.submit(_eval_modelo, m) for m in modelos]
            for future in as_completed(futures):
                modelo, result = future.result()
                resultados[modelo] = result

        ranking = sorted(
            [(m, r['mae']) for m, r in resultados.items()],
            key=lambda x: x[1]
        )

        mejor_modelo = ranking[0][0] if ranking else "random_forest"

        return {
            "mejor_modelo": mejor_modelo,
            "recomendacion": f"El modelo {NOMBRES_MODELOS.get(mejor_modelo, mejor_modelo)} tiene el menor error (MAE: {ranking[0][1]:.2f})",
            "ranking": [{"modelo": m, "mae": mae, "nombre": NOMBRES_MODELOS.get(m, m)} for m, mae in ranking],
            "resultados": resultados
        }


# =============================================================================
# AutoModelSelector: Selección Automática
# =============================================================================

class AutoModelSelector:
    """
    Selecciona automáticamente el mejor modelo.
    """

    def __init__(self, modelos: List[str] = None, optimizar_params: bool = False):
        """
        Args:
            modelos: Lista de modelos a evaluar
            optimizar_params: Si optimizar hiperparámetros
        """
        self.modelos = modelos or MODELOS_DISPONIBLES
        self.optimizar_params = optimizar_params

    def seleccionar(self, X: np.ndarray, y: np.ndarray) -> AutoSelectResult:
        """
        Selecciona el mejor modelo mediante cross-validation.

        Args:
            X: Features
            y: Target

        Returns:
            AutoSelectResult
        """
        resultados = []
        tscv = TimeSeriesSplit(n_splits=3)

        for modelo_tipo in self.modelos:
            try:
                if modelo_tipo == "random_forest":
                    modelo = RandomForestRegressor(n_estimators=50, max_depth=8, random_state=42)
                elif modelo_tipo == "gradient_boosting":
                    modelo = GradientBoostingRegressor(n_estimators=50, max_depth=4, random_state=42)
                elif modelo_tipo in ["linear", "ridge"]:
                    modelo = Ridge(alpha=1.0)
                else:
                    continue

                # Cross-validation
                scores = cross_val_score(modelo, X, y, cv=tscv, scoring='neg_mean_absolute_error')
                mae = -scores.mean()

                resultados.append({
                    "modelo": modelo_tipo,
                    "nombre": NOMBRES_MODELOS.get(modelo_tipo, modelo_tipo),
                    "mae": round(mae, 2),
                    "std": round(scores.std(), 2)
                })

            except Exception as e:
                logger.warning(f"Error evaluando {modelo_tipo}: {e}")

        # Ordenar por MAE
        resultados.sort(key=lambda x: x['mae'])

        if not resultados:
            return AutoSelectResult(
                mejor_modelo="random_forest",
                metricas={"mae": 0, "std": 0},
                ranking=[],
                recomendacion="No se pudieron evaluar los modelos"
            )

        mejor = resultados[0]

        return AutoSelectResult(
            mejor_modelo=mejor['modelo'],
            metricas={"mae": mejor['mae'], "std": mejor['std']},
            ranking=resultados,
            recomendacion=f"Se recomienda usar {mejor['nombre']} con MAE promedio de {mejor['mae']:.2f}"
        )


# =============================================================================
# HyperparameterTuner: Optimización de Hiperparámetros
# =============================================================================

class HyperparameterTuner:
    """
    Optimiza hiperparámetros de modelos.
    """

    def optimizar(self, X: np.ndarray, y: np.ndarray, modelo_tipo: str,
                  n_iter: int = 30, rapido: bool = True) -> TuningResult:
        """
        Optimiza hiperparámetros usando búsqueda aleatoria simplificada.

        Args:
            X: Features
            y: Target
            modelo_tipo: Tipo de modelo
            n_iter: Iteraciones de búsqueda
            rapido: Modo rápido con menos iteraciones

        Returns:
            TuningResult
        """
        if rapido:
            n_iter = min(n_iter, 10)

        # Evaluar modelo base
        if modelo_tipo == "random_forest":
            modelo_base = RandomForestRegressor(n_estimators=100, random_state=42)
            param_grid = {
                'n_estimators': [50, 100, 150],
                'max_depth': [5, 8, 10, 15],
                'min_samples_split': [2, 5, 10]
            }
        elif modelo_tipo == "gradient_boosting":
            modelo_base = GradientBoostingRegressor(n_estimators=100, random_state=42)
            param_grid = {
                'n_estimators': [50, 100, 150],
                'max_depth': [3, 4, 5, 6],
                'learning_rate': [0.05, 0.1, 0.15]
            }
        else:
            modelo_base = Ridge(alpha=1.0)
            param_grid = {
                'alpha': [0.1, 0.5, 1.0, 2.0, 5.0]
            }

        tscv = TimeSeriesSplit(n_splits=3)

        # Score base
        scores_base = cross_val_score(modelo_base, X, y, cv=tscv, scoring='neg_mean_absolute_error')
        score_base = -scores_base.mean()

        # Búsqueda simple de mejores params
        mejor_score = score_base
        mejores_params = {}

        for _ in range(n_iter):
            params = {k: np.random.choice(v) for k, v in param_grid.items()}

            try:
                if modelo_tipo == "random_forest":
                    modelo = RandomForestRegressor(**params, random_state=42)
                elif modelo_tipo == "gradient_boosting":
                    modelo = GradientBoostingRegressor(**params, random_state=42)
                else:
                    modelo = Ridge(**params)

                scores = cross_val_score(modelo, X, y, cv=tscv, scoring='neg_mean_absolute_error')
                score = -scores.mean()

                if score < mejor_score:
                    mejor_score = score
                    mejores_params = params

            except Exception:
                continue

        mejora = ((score_base - mejor_score) / score_base) * 100 if score_base > 0 else 0

        return TuningResult(
            modelo=modelo_tipo,
            mejores_params=mejores_params or {"default": True},
            score_antes=round(score_base, 2),
            score_despues=round(mejor_score, 2),
            mejora_porcentual=round(mejora, 2)
        )
