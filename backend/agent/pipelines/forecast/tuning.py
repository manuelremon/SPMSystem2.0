"""
Módulo de Hyperparameter Tuning para Forecast

Proporciona herramientas para optimización automática de hiperparámetros
y selección automática del mejor modelo.

Adaptado de ForecastDemandaMateriales para SPM v2.0
"""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from datetime import datetime
import logging
import warnings
import time

warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

# Número máximo de workers para paralelización
MAX_WORKERS = 4

# Importaciones sklearn
try:
    from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit, cross_val_score
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    from sklearn.linear_model import Ridge, Lasso
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("sklearn no disponible para tuning")

try:
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False


@dataclass
class TuningResult:
    """Resultado de optimización de hiperparámetros"""
    modelo_tipo: str
    mejores_params: Dict[str, Any]
    mejor_score: float
    cv_scores: List[float]
    tiempo_busqueda: float
    n_iteraciones: int
    todos_resultados: Optional[pd.DataFrame] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'modelo_tipo': self.modelo_tipo,
            'mejores_params': self.mejores_params,
            'mejor_score': round(self.mejor_score, 4),
            'cv_score_mean': round(np.mean(self.cv_scores), 4),
            'cv_score_std': round(np.std(self.cv_scores), 4),
            'tiempo_busqueda': round(self.tiempo_busqueda, 2),
            'n_iteraciones': self.n_iteraciones
        }


@dataclass
class AutoSelectResult:
    """Resultado de auto-selección de modelo"""
    mejor_modelo: str
    comparacion: Dict[str, Dict[str, Any]]
    ranking: List[Dict[str, Any]]
    recomendacion: str
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'mejor_modelo': self.mejor_modelo,
            'comparacion': self.comparacion,
            'ranking': self.ranking,
            'recomendacion': self.recomendacion,
            'timestamp': self.timestamp.isoformat()
        }


class HyperparameterTuner:
    """
    Optimizador de hiperparámetros para modelos de forecast.
    """

    PARAM_GRIDS = {
        'random_forest': {
            'n_estimators': [50, 100, 150, 200, 300],
            'max_depth': [5, 10, 15, 20, 25, None],
            'min_samples_split': [2, 5, 10, 15],
            'min_samples_leaf': [1, 2, 4, 6],
            'max_features': ['sqrt', 'log2', 0.5, 0.7, None],
            'bootstrap': [True, False]
        },
        'gradient_boosting': {
            'n_estimators': [50, 100, 150, 200],
            'max_depth': [3, 4, 5, 6, 7],
            'learning_rate': [0.01, 0.05, 0.1, 0.15, 0.2],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4],
            'subsample': [0.7, 0.8, 0.9, 1.0]
        },
        'xgboost': {
            'n_estimators': [50, 100, 150, 200, 300],
            'max_depth': [3, 4, 5, 6, 7, 8],
            'learning_rate': [0.01, 0.03, 0.05, 0.1, 0.15],
            'subsample': [0.6, 0.7, 0.8, 0.9, 1.0],
            'colsample_bytree': [0.6, 0.7, 0.8, 0.9, 1.0],
            'min_child_weight': [1, 3, 5, 7],
            'gamma': [0, 0.1, 0.2, 0.3]
        },
        'ridge': {
            'alpha': [0.001, 0.01, 0.1, 1.0, 10.0, 100.0, 1000.0]
        }
    }

    PARAM_GRIDS_RAPIDO = {
        'random_forest': {
            'n_estimators': [50, 100, 200],
            'max_depth': [5, 10, 15, None],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4]
        },
        'gradient_boosting': {
            'n_estimators': [50, 100, 150],
            'max_depth': [3, 5, 7],
            'learning_rate': [0.05, 0.1, 0.2],
            'subsample': [0.8, 1.0]
        },
        'xgboost': {
            'n_estimators': [50, 100, 200],
            'max_depth': [3, 5, 7],
            'learning_rate': [0.05, 0.1, 0.2],
            'subsample': [0.8, 1.0]
        }
    }

    def __init__(self, cv_splits: int = 5, scoring: str = 'neg_mean_absolute_error'):
        if not SKLEARN_AVAILABLE:
            raise ImportError("sklearn es requerido para HyperparameterTuner")

        self.cv_splits = cv_splits
        self.scoring = scoring
        self.cv = TimeSeriesSplit(n_splits=cv_splits)

    def obtener_modelo_base(self, modelo_tipo: str):
        """Obtiene instancia base del modelo"""
        modelos = {
            'random_forest': RandomForestRegressor(random_state=42, n_jobs=-1),
            'gradient_boosting': GradientBoostingRegressor(random_state=42),
            'ridge': Ridge(random_state=42),
            'lasso': Lasso(random_state=42)
        }

        if modelo_tipo == 'xgboost':
            if not XGBOOST_AVAILABLE:
                raise ImportError("xgboost no disponible")
            return XGBRegressor(random_state=42, n_jobs=-1, verbosity=0)

        if modelo_tipo not in modelos:
            raise ValueError(f"Modelo '{modelo_tipo}' no soportado")

        return modelos[modelo_tipo]

    def optimizar(
        self,
        X: np.ndarray,
        y: np.ndarray,
        modelo_tipo: str = 'random_forest',
        n_iter: int = 50,
        rapido: bool = False,
        param_grid: Optional[Dict[str, Any]] = None
    ) -> TuningResult:
        """Optimiza hiperparámetros usando RandomizedSearchCV."""
        logger.info(f"Optimizando hiperparámetros para {modelo_tipo} ({n_iter} iteraciones)")
        inicio = time.time()

        modelo = self.obtener_modelo_base(modelo_tipo)

        if param_grid is None:
            grids = self.PARAM_GRIDS_RAPIDO if rapido else self.PARAM_GRIDS
            param_grid = grids.get(modelo_tipo, {})

        if not param_grid:
            cv_scores = cross_val_score(modelo, X, y, cv=self.cv, scoring=self.scoring)
            return TuningResult(
                modelo_tipo=modelo_tipo,
                mejores_params={},
                mejor_score=-np.mean(cv_scores),
                cv_scores=list(-cv_scores),
                tiempo_busqueda=time.time() - inicio,
                n_iteraciones=1
            )

        n_combinaciones = 1
        for valores in param_grid.values():
            n_combinaciones *= len(valores) if isinstance(valores, list) else 1
        n_iter = min(n_iter, n_combinaciones)

        search = RandomizedSearchCV(
            estimator=modelo,
            param_distributions=param_grid,
            n_iter=n_iter,
            cv=self.cv,
            scoring=self.scoring,
            random_state=42,
            n_jobs=-1,
            verbose=0
        )

        search.fit(X, y)

        tiempo_total = time.time() - inicio
        resultados_df = pd.DataFrame(search.cv_results_).sort_values('rank_test_score')

        logger.info(
            f"Optimización completada en {tiempo_total:.1f}s. "
            f"Mejor score: {-search.best_score_:.4f}"
        )

        return TuningResult(
            modelo_tipo=modelo_tipo,
            mejores_params=search.best_params_,
            mejor_score=-search.best_score_,
            cv_scores=list(-search.cv_results_['mean_test_score'][:n_iter]),
            tiempo_busqueda=tiempo_total,
            n_iteraciones=n_iter,
            todos_resultados=resultados_df
        )

    def evaluar_modelo(
        self,
        X: np.ndarray,
        y: np.ndarray,
        modelo_tipo: str,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, float]:
        """Evalúa un modelo con parámetros específicos."""
        modelo = self.obtener_modelo_base(modelo_tipo)
        if params:
            modelo.set_params(**params)

        scores_mae = -cross_val_score(modelo, X, y, cv=self.cv, scoring='neg_mean_absolute_error')
        scores_rmse = np.sqrt(-cross_val_score(modelo, X, y, cv=self.cv, scoring='neg_mean_squared_error'))
        scores_r2 = cross_val_score(modelo, X, y, cv=self.cv, scoring='r2')

        return {
            'mae_mean': np.mean(scores_mae),
            'mae_std': np.std(scores_mae),
            'rmse_mean': np.mean(scores_rmse),
            'rmse_std': np.std(scores_rmse),
            'r2_mean': np.mean(scores_r2),
            'r2_std': np.std(scores_r2)
        }


class AutoModelSelector:
    """Selector automático del mejor modelo."""

    MODELOS_DEFAULT = ['random_forest', 'gradient_boosting', 'linear']

    def __init__(
        self,
        modelos: Optional[List[str]] = None,
        cv_splits: int = 5,
        optimizar_params: bool = False,
        n_iter_tuning: int = 20
    ):
        self.modelos = modelos or self.MODELOS_DEFAULT
        self.cv_splits = cv_splits
        self.optimizar_params = optimizar_params
        self.n_iter_tuning = n_iter_tuning
        self.tuner = HyperparameterTuner(cv_splits=cv_splits)

    def seleccionar(
        self,
        X: np.ndarray,
        y: np.ndarray,
        criterio: str = 'mae',
        paralelo: bool = True
    ) -> AutoSelectResult:
        """
        Selecciona el mejor modelo automáticamente.

        Args:
            X: Features de entrenamiento
            y: Target de entrenamiento
            criterio: Criterio de selección ('mae', 'rmse', 'r2')
            paralelo: Si True, evalúa modelos en paralelo (default True)
        """
        logger.info(f"Auto-selección de modelo entre {len(self.modelos)} candidatos (paralelo={paralelo})")

        if paralelo and len(self.modelos) > 1:
            comparacion = self._seleccionar_paralelo(X, y)
        else:
            comparacion = self._seleccionar_secuencial(X, y)

        modelos_validos = {k: v for k, v in comparacion.items() if 'error' not in v}

        if not modelos_validos:
            raise ValueError("No se pudo evaluar ningún modelo")

        if criterio == 'mae':
            mejor = min(modelos_validos.keys(), key=lambda x: modelos_validos[x]['mae_mean'])
        elif criterio == 'rmse':
            mejor = min(modelos_validos.keys(), key=lambda x: modelos_validos[x]['rmse_mean'])
        elif criterio == 'r2':
            mejor = max(modelos_validos.keys(), key=lambda x: modelos_validos[x]['r2_mean'])
        else:
            raise ValueError(f"Criterio '{criterio}' no soportado")

        ranking = self._crear_ranking(comparacion, criterio)
        recomendacion = self._generar_recomendacion(comparacion, mejor, criterio)

        logger.info(f"Modelo seleccionado: {mejor}")

        return AutoSelectResult(
            mejor_modelo=mejor,
            comparacion=comparacion,
            ranking=ranking,
            recomendacion=recomendacion
        )

    def _seleccionar_secuencial(self, X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
        """Evalúa modelos secuencialmente."""
        comparacion = {}
        for modelo in self.modelos:
            try:
                logger.info(f"  Evaluando {modelo}...")
                metricas = self._evaluar_un_modelo(X, y, modelo)
                comparacion[modelo] = metricas
                logger.info(f"    MAE: {metricas['mae_mean']:.2f} (±{metricas['mae_std']:.2f})")
            except Exception as e:
                logger.warning(f"Error evaluando {modelo}: {e}")
                comparacion[modelo] = {'error': str(e)}
        return comparacion

    def _seleccionar_paralelo(self, X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
        """
        Evalúa modelos en paralelo usando ThreadPoolExecutor.

        ThreadPoolExecutor es apropiado porque sklearn libera el GIL
        durante operaciones intensivas.
        """
        def evaluar_modelo(modelo):
            try:
                logger.info(f"  Evaluando {modelo}...")
                metricas = self._evaluar_un_modelo(X, y, modelo)
                logger.info(f"    MAE: {metricas['mae_mean']:.2f} (±{metricas['mae_std']:.2f})")
                return modelo, metricas
            except Exception as e:
                logger.warning(f"Error evaluando {modelo}: {e}")
                return modelo, {'error': str(e)}

        # Ejecutar en paralelo
        n_workers = min(MAX_WORKERS, len(self.modelos))
        with ThreadPoolExecutor(max_workers=n_workers) as executor:
            results = list(executor.map(evaluar_modelo, self.modelos))

        return dict(results)

    def _evaluar_un_modelo(self, X: np.ndarray, y: np.ndarray, modelo: str) -> Dict[str, Any]:
        """Evalúa un modelo individual."""
        if self.optimizar_params:
            result = self.tuner.optimizar(
                X, y, modelo,
                n_iter=self.n_iter_tuning,
                rapido=True
            )
            metricas = self.tuner.evaluar_modelo(X, y, modelo, result.mejores_params)
            metricas['mejores_params'] = result.mejores_params
            metricas['tiempo_tuning'] = result.tiempo_busqueda
        else:
            metricas = self.tuner.evaluar_modelo(X, y, modelo)
            metricas['mejores_params'] = {}
            metricas['tiempo_tuning'] = 0
        return metricas

    def _crear_ranking(
        self,
        comparacion: Dict[str, Dict[str, Any]],
        criterio: str
    ) -> List[Dict[str, Any]]:
        ranking = []

        for modelo, datos in comparacion.items():
            if 'error' not in datos:
                ranking.append({
                    'modelo': modelo,
                    'mae': datos['mae_mean'],
                    'mae_std': datos['mae_std'],
                    'rmse': datos['rmse_mean'],
                    'r2': datos['r2_mean'],
                    'params_optimizados': bool(datos.get('mejores_params'))
                })

        if criterio == 'r2':
            ranking.sort(key=lambda x: x['r2'], reverse=True)
        else:
            ranking.sort(key=lambda x: x.get(criterio, x['mae']))

        for i, item in enumerate(ranking):
            item['posicion'] = i + 1

        return ranking

    def _generar_recomendacion(
        self,
        comparacion: Dict[str, Dict[str, Any]],
        mejor: str,
        criterio: str
    ) -> str:
        datos = comparacion[mejor]
        partes = [f"El mejor modelo es {mejor}."]

        r2 = datos['r2_mean']
        if r2 > 0.9:
            partes.append(f"Excelente capacidad predictiva (R²={r2:.2f}).")
        elif r2 > 0.7:
            partes.append(f"Buena capacidad predictiva (R²={r2:.2f}).")
        elif r2 > 0.5:
            partes.append(f"Capacidad predictiva moderada (R²={r2:.2f}).")
        else:
            partes.append(f"Capacidad predictiva limitada (R²={r2:.2f}).")

        n_evaluados = len([v for v in comparacion.values() if 'error' not in v])
        if n_evaluados > 1:
            partes.append(f"Evaluado contra {n_evaluados-1} alternativas.")

        cv_mae = datos['mae_std'] / datos['mae_mean'] if datos['mae_mean'] > 0 else 0
        if cv_mae > 0.3:
            partes.append("Alta variabilidad entre folds.")

        return " ".join(partes)


def optimizar_rapido(
    X: np.ndarray,
    y: np.ndarray,
    modelo: str = 'random_forest',
    n_iter: int = 30
) -> TuningResult:
    """Función de conveniencia para optimización rápida."""
    tuner = HyperparameterTuner()
    return tuner.optimizar(X, y, modelo, n_iter, rapido=True)


def seleccionar_mejor_modelo(
    X: np.ndarray,
    y: np.ndarray,
    modelos: Optional[List[str]] = None,
    optimizar: bool = False
) -> AutoSelectResult:
    """Función de conveniencia para selección de modelo."""
    selector = AutoModelSelector(
        modelos=modelos,
        optimizar_params=optimizar
    )
    return selector.seleccionar(X, y)


def obtener_params_default(modelo_tipo: str) -> Dict[str, Any]:
    """Obtiene parámetros por defecto recomendados."""
    defaults = {
        'random_forest': {
            'n_estimators': 100,
            'max_depth': 15,
            'min_samples_split': 5,
            'min_samples_leaf': 2
        },
        'gradient_boosting': {
            'n_estimators': 100,
            'max_depth': 5,
            'learning_rate': 0.1,
            'subsample': 0.8
        },
        'xgboost': {
            'n_estimators': 100,
            'max_depth': 5,
            'learning_rate': 0.1,
            'subsample': 0.8
        },
        'linear': {},
        'ridge': {'alpha': 1.0}
    }

    return defaults.get(modelo_tipo, {})
