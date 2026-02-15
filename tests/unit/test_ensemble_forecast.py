"""
Tests para EnsembleStrategy
"""
import numpy as np
import pandas as pd
import pytest

from backend.agent.pipelines.forecast import (
    EnsembleStrategy,
    RandomForestStrategy,
    GradientBoostingStrategy,
    RidgeStrategy,
)


@pytest.fixture
def sample_data():
    """Datos de prueba para entrenamiento"""
    np.random.seed(42)
    dates = pd.date_range('2024-01-01', periods=100, freq='D')
    cantidad = 50 + np.random.randn(100) * 10 + np.sin(np.arange(100) * 0.1) * 20
    cantidad = np.maximum(cantidad, 0)  # No negativos

    return pd.DataFrame({
        'fecha': dates,
        'cantidad': cantidad
    })


def test_ensemble_initialization():
    """Test básico de inicialización"""
    ensemble = EnsembleStrategy()
    assert ensemble.nombre_modelo == "Ensemble (0 modelos)"
    assert not ensemble.requiere_features_adicionales


def test_ensemble_with_strategies():
    """Test de ensemble con estrategias"""
    strategies = [
        RandomForestStrategy(),
        GradientBoostingStrategy(),
        RidgeStrategy()
    ]
    ensemble = EnsembleStrategy(strategies=strategies)
    assert ensemble.nombre_modelo == "Ensemble (3 modelos)"
    assert len(ensemble.strategies) == 3


def test_ensemble_training(sample_data):
    """Test de entrenamiento del ensemble"""
    strategies = [
        RandomForestStrategy(),
        GradientBoostingStrategy(),
    ]
    ensemble = EnsembleStrategy(strategies=strategies)

    metrics = ensemble.entrenar(sample_data)

    assert ensemble.is_trained
    assert 'mae' in metrics
    assert 'rmse' in metrics
    assert 'r2' in metrics
    assert 'mape' in metrics
    assert metrics['mae'] >= 0
    assert metrics['rmse'] >= 0


def test_ensemble_prediction(sample_data):
    """Test de predicción del ensemble"""
    strategies = [
        RandomForestStrategy(),
        RidgeStrategy(),
    ]
    ensemble = EnsembleStrategy(strategies=strategies)

    # Entrenar
    ensemble.entrenar(sample_data)

    # Predecir
    predictions = ensemble.predecir(sample_data, periodos=10)

    assert len(predictions) == 10
    assert 'fecha' in predictions.columns
    assert 'prediccion' in predictions.columns
    assert 'limite_inferior' in predictions.columns
    assert 'limite_superior' in predictions.columns

    # Validar que las predicciones son razonables
    assert (predictions['prediccion'] >= 0).all()
    assert (predictions['limite_inferior'] >= 0).all()
    assert (predictions['limite_superior'] >= predictions['limite_inferior']).all()


def test_ensemble_weights(sample_data):
    """Test de cálculo de pesos"""
    strategies = [
        RandomForestStrategy(),
        GradientBoostingStrategy(),
    ]
    ensemble = EnsembleStrategy(strategies=strategies)

    # Entrenar
    ensemble.entrenar(sample_data)

    # Obtener pesos
    weights = ensemble.get_weights()

    assert len(weights) > 0
    assert all(0 <= w <= 1 for w in weights.values())
    # Los pesos deben sumar aproximadamente 1
    assert abs(sum(weights.values()) - 1.0) < 0.01


def test_ensemble_manual_weights(sample_data):
    """Test de pesos manuales"""
    strategies = [
        RandomForestStrategy(),
        GradientBoostingStrategy(),
    ]
    manual_weights = [0.7, 0.3]
    ensemble = EnsembleStrategy(strategies=strategies, weights=manual_weights)

    # Entrenar
    ensemble.entrenar(sample_data)

    # Verificar pesos
    weights = ensemble.get_weights()
    assert abs(sum(weights.values()) - 1.0) < 0.01


def test_ensemble_individual_predictions(sample_data):
    """Test de predicciones individuales"""
    strategies = [
        RandomForestStrategy(),
        RidgeStrategy(),
    ]
    ensemble = EnsembleStrategy(strategies=strategies)

    # Entrenar
    ensemble.entrenar(sample_data)

    # Obtener predicciones individuales
    individual_preds = ensemble.get_individual_predictions(sample_data, periodos=5)

    assert len(individual_preds) > 0
    for model_name, preds in individual_preds.items():
        assert isinstance(preds, pd.DataFrame)
        assert len(preds) == 5
        assert 'fecha' in preds.columns
        assert 'prediccion' in preds.columns


def test_ensemble_feature_importance(sample_data):
    """Test de feature importance agregado"""
    strategies = [
        RandomForestStrategy(),
        GradientBoostingStrategy(),
    ]
    ensemble = EnsembleStrategy(strategies=strategies)

    # Entrenar
    ensemble.entrenar(sample_data)

    # Obtener feature importance
    importance = ensemble.get_feature_importance()

    # Debe retornar un DataFrame (puede estar vacío si los modelos no tienen importances)
    assert isinstance(importance, pd.DataFrame)
    if not importance.empty:
        assert 'feature' in importance.columns
        assert 'importance' in importance.columns


def test_ensemble_empty_strategies():
    """Test de ensemble sin estrategias"""
    ensemble = EnsembleStrategy(strategies=[])

    # Crear datos mínimos
    df = pd.DataFrame({
        'fecha': pd.date_range('2024-01-01', periods=10, freq='D'),
        'cantidad': [10] * 10
    })

    metrics = ensemble.entrenar(df)

    # Debe fallar gracefully
    assert not ensemble.is_trained
    assert metrics['mape'] == 100


def test_ensemble_insufficient_data():
    """Test con datos insuficientes"""
    strategies = [RandomForestStrategy()]
    ensemble = EnsembleStrategy(strategies=strategies)

    # Datos muy limitados
    df = pd.DataFrame({
        'fecha': pd.date_range('2024-01-01', periods=3, freq='D'),
        'cantidad': [10, 15, 12]
    })

    metrics = ensemble.entrenar(df)

    # Debe manejar datos insuficientes
    assert 'mae' in metrics
    assert not ensemble.is_trained or metrics['mape'] == 100


def test_ensemble_parallel_training(sample_data):
    """Test de entrenamiento paralelo"""
    # Crear múltiples estrategias
    strategies = [
        RandomForestStrategy(),
        GradientBoostingStrategy(),
        RidgeStrategy(),
    ]
    ensemble = EnsembleStrategy(strategies=strategies)

    # Entrenar (usa ThreadPoolExecutor internamente)
    metrics = ensemble.entrenar(sample_data)

    # Debe completarse exitosamente
    assert ensemble.is_trained
    assert len(ensemble._weights) > 0
