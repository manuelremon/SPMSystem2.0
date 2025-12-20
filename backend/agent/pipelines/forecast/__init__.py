"""
Módulo de Forecasting Avanzado para SPM v2.0
=============================================

Sistema multi-modelo de predicción de demanda con:
- 6 estrategias ML: Random Forest, Gradient Boosting, Ridge, XGBoost, Prophet, ARIMA
- Backtesting con validación walk-forward
- Auto-tuning de hiperparámetros
- Registro y persistencia de modelos

Uso básico:
    from backend.agent.pipelines.forecast import (
        DemandPredictor,
        get_cached_predictor,
        obtener_estrategias_disponibles
    )

    # Obtener modelos disponibles
    modelos = obtener_estrategias_disponibles()
    # ['random_forest', 'gradient_boosting', 'linear', 'xgboost', ...]

    # Crear predictor
    predictor = DemandPredictor(modelo='random_forest')
    metricas = predictor.entrenar(df_historico)
    predicciones = predictor.predecir(df_historico, periodos=30)

    # O usar cache para mejor rendimiento
    predictor, from_cache = get_cached_predictor(df, codigo='MAT001', modelo_tipo='xgboost')

Adaptado de ForecastDemandaMateriales para SPM v2.0
"""
from typing import Dict, Type, Optional, List
import logging

from .base import ForecastStrategy

logger = logging.getLogger(__name__)

# Registro de estrategias disponibles
_STRATEGIES: Dict[str, Type[ForecastStrategy]] = {}


def registrar_estrategia(nombre: str, clase: Type[ForecastStrategy]):
    """
    Registra una estrategia de forecasting.

    Args:
        nombre: Identificador único del modelo
        clase: Clase que implementa ForecastStrategy
    """
    _STRATEGIES[nombre] = clase
    logger.debug(f"Estrategia registrada: {nombre}")


def obtener_estrategia(nombre: str, **kwargs) -> Optional[ForecastStrategy]:
    """
    Factory para obtener una estrategia de forecasting.

    Args:
        nombre: Nombre del modelo (random_forest, xgboost, prophet, arima, etc.)
        **kwargs: Parámetros del modelo

    Returns:
        Instancia de ForecastStrategy o None si no existe/no está disponible
    """
    if nombre not in _STRATEGIES:
        logger.warning(f"Estrategia '{nombre}' no encontrada")
        return None

    try:
        return _STRATEGIES[nombre](**kwargs)
    except ImportError as e:
        logger.warning(f"Estrategia '{nombre}' no disponible: {e}")
        return None
    except Exception as e:
        logger.error(f"Error creando estrategia '{nombre}': {e}")
        return None


def listar_estrategias() -> Dict[str, bool]:
    """
    Lista todas las estrategias registradas y su disponibilidad.

    Returns:
        Dict {nombre: disponible}
    """
    disponibles = {}
    for nombre, clase in _STRATEGIES.items():
        try:
            clase()
            disponibles[nombre] = True
        except ImportError:
            disponibles[nombre] = False
        except Exception:
            disponibles[nombre] = False
    return disponibles


def obtener_estrategias_disponibles() -> List[str]:
    """
    Retorna lista de nombres de estrategias disponibles (instaladas).

    Returns:
        Lista de nombres de estrategias que se pueden usar
    """
    return [nombre for nombre, disponible in listar_estrategias().items() if disponible]


def obtener_nombres_modelos() -> Dict[str, str]:
    """
    Retorna diccionario de identificador -> nombre legible.

    Útil para mostrar en UI.
    """
    nombres = {}
    for nombre in obtener_estrategias_disponibles():
        try:
            estrategia = obtener_estrategia(nombre)
            if estrategia:
                nombres[nombre] = estrategia.nombre_modelo
        except Exception:
            pass
    return nombres


# =============================================================================
# Registro de Estrategias
# =============================================================================

# Estrategias sklearn (siempre disponibles)
from .sklearn_models import (
    RandomForestStrategy,
    GradientBoostingStrategy,
    RidgeStrategy
)

registrar_estrategia('random_forest', RandomForestStrategy)
registrar_estrategia('gradient_boosting', GradientBoostingStrategy)
registrar_estrategia('linear', RidgeStrategy)

# XGBoost (opcional)
try:
    from .xgboost_model import XGBoostStrategy
    registrar_estrategia('xgboost', XGBoostStrategy)
except ImportError:
    logger.info("XGBoost no disponible")

# Prophet (opcional)
try:
    from .prophet_model import ProphetStrategy
    registrar_estrategia('prophet', ProphetStrategy)
except ImportError:
    logger.info("Prophet no disponible")

# ARIMA (opcional)
try:
    from .arima_model import ARIMAStrategy
    registrar_estrategia('arima', ARIMAStrategy)
except ImportError:
    logger.info("ARIMA no disponible")


# =============================================================================
# Imports principales
# =============================================================================
from .predictor import (
    DemandPredictor,
    StockOptimizer,
    get_cached_predictor,
    clear_model_cache
)

from .backtesting import (
    Backtester,
    BacktestReport,
    BacktestStep,
    ModelComparator,
    ejecutar_backtest_rapido,
    comparar_modelos_rapido
)

from .tuning import (
    HyperparameterTuner,
    AutoModelSelector,
    TuningResult,
    AutoSelectResult,
    optimizar_rapido,
    seleccionar_mejor_modelo,
    obtener_params_default
)

from .model_registry import (
    ModelRegistry,
    ModelMetadata,
    ModelInfo,
    crear_metadata,
    obtener_registry
)


# Exports públicos
__all__ = [
    # Core
    'ForecastStrategy',
    'DemandPredictor',
    'StockOptimizer',

    # Cache
    'get_cached_predictor',
    'clear_model_cache',

    # Estrategias
    'RandomForestStrategy',
    'GradientBoostingStrategy',
    'RidgeStrategy',

    # Factory
    'obtener_estrategia',
    'listar_estrategias',
    'obtener_estrategias_disponibles',
    'obtener_nombres_modelos',
    'registrar_estrategia',

    # Backtesting
    'Backtester',
    'BacktestReport',
    'BacktestStep',
    'ModelComparator',
    'ejecutar_backtest_rapido',
    'comparar_modelos_rapido',

    # Tuning
    'HyperparameterTuner',
    'AutoModelSelector',
    'TuningResult',
    'AutoSelectResult',
    'optimizar_rapido',
    'seleccionar_mejor_modelo',
    'obtener_params_default',

    # Registry
    'ModelRegistry',
    'ModelMetadata',
    'ModelInfo',
    'crear_metadata',
    'obtener_registry',
]
