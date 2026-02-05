"""
Tests para LSTM Forecast Model
==============================
FASE 1 - SPM v3.0
"""
import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
from pathlib import Path

# Agregar backend al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.agent.pipelines.forecast.lstm_model import LSTMStrategy


@pytest.fixture
def datos_ejemplo():
    """Genera datos de ejemplo para pruebas"""
    fechas = pd.date_range(start='2024-01-01', periods=100, freq='D')
    # Crear serie con tendencia y estacionalidad semanal
    base = np.sin(np.arange(100) * 2 * np.pi / 7) * 10  # Estacionalidad semanal
    tendencia = np.arange(100) * 0.1  # Tendencia creciente
    ruido = np.random.normal(0, 2, 100)
    cantidad = 50 + base + tendencia + ruido
    cantidad = np.maximum(cantidad, 5)  # Valores no negativos

    return pd.DataFrame({
        'fecha': fechas,
        'cantidad': cantidad
    })


class TestLSTMStrategy:
    """Tests para LSTMStrategy"""

    def test_inicializacion(self):
        """Prueba inicialización correcta"""
        lstm = LSTMStrategy(lookback=30, epochs=50)
        assert lstm.lookback == 30
        assert lstm.epochs == 50
        assert lstm.nombre_modelo == "LSTM Neural Network"
        assert not lstm.requiere_features_adicionales

    def test_entrenamiento_basico(self, datos_ejemplo):
        """Prueba entrenamiento con datos suficientes"""
        lstm = LSTMStrategy(lookback=10, epochs=10, batch_size=8)
        metricas = lstm.entrenar(datos_ejemplo)

        assert lstm.is_trained
        assert 'mae' in metricas
        assert 'rmse' in metricas
        assert 'r2' in metricas
        assert 'mape' in metricas
        assert metricas['mae'] >= 0
        assert metricas['mape'] >= 0

    def test_entrenamiento_datos_insuficientes(self):
        """Prueba que maneja datos insuficientes"""
        df_pequeno = pd.DataFrame({
            'fecha': pd.date_range('2024-01-01', periods=3),
            'cantidad': [10, 12, 15]
        })

        lstm = LSTMStrategy()
        metricas = lstm.entrenar(df_pequeno)

        # Debe usar fallback
        assert lstm._usar_modelo_simple
        assert metricas['mae'] == 0.0  # Fallback retorna 0

    def test_prediccion_basica(self, datos_ejemplo):
        """Prueba predicción básica"""
        lstm = LSTMStrategy(lookback=10, epochs=5)
        lstm.entrenar(datos_ejemplo)

        predicciones = lstm.predecir(datos_ejemplo, periodos=30)

        assert len(predicciones) == 30
        assert 'fecha' in predicciones.columns
        assert 'prediccion' in predicciones.columns
        assert 'limite_inferior' in predicciones.columns
        assert 'limite_superior' in predicciones.columns

        # Validar que predicciones son positivas
        assert (predicciones['prediccion'] >= 0).all()
        assert (predicciones['limite_inferior'] >= 0).all()

    def test_intervalos_confianza(self, datos_ejemplo):
        """Prueba que límites superior > predicción > límite inferior"""
        lstm = LSTMStrategy(lookback=10, epochs=5)
        lstm.entrenar(datos_ejemplo)

        predicciones = lstm.predecir(datos_ejemplo, periodos=20)

        assert (predicciones['limite_superior'] >= predicciones['prediccion']).all()
        assert (predicciones['prediccion'] >= predicciones['limite_inferior']).all()

    def test_prediccion_datos_insuficientes(self):
        """Prueba predicción con datos insuficientes"""
        df_pequeno = pd.DataFrame({
            'fecha': pd.date_range('2024-01-01', periods=5),
            'cantidad': [10, 12, 15, 14, 13]
        })

        lstm = LSTMStrategy()
        lstm.entrenar(df_pequeno)
        predicciones = lstm.predecir(df_pequeno, periodos=10)

        assert len(predicciones) == 10
        assert not predicciones['prediccion'].isna().any()

    def test_feature_importance(self, datos_ejemplo):
        """Prueba que feature importance retorna DataFrame vacío (LSTM no tiene)"""
        lstm = LSTMStrategy(lookback=10, epochs=5)
        lstm.entrenar(datos_ejemplo)

        fi = lstm.get_feature_importance()
        assert isinstance(fi, pd.DataFrame)
        assert len(fi) == 0

    def test_validacion_datos(self):
        """Prueba validación de datos"""
        lstm = LSTMStrategy()

        # Sin 'fecha'
        df_sin_fecha = pd.DataFrame({'cantidad': [1, 2, 3]})
        assert not lstm.validar_datos(df_sin_fecha)

        # Sin 'cantidad'
        df_sin_cantidad = pd.DataFrame({'fecha': pd.date_range('2024-01-01', periods=3)})
        assert not lstm.validar_datos(df_sin_cantidad)

        # Pocos datos
        df_pocos = pd.DataFrame({
            'fecha': pd.date_range('2024-01-01', periods=2),
            'cantidad': [1, 2]
        })
        assert not lstm.validar_datos(df_pocos, min_registros=5)

    def test_crear_secuencias(self, datos_ejemplo):
        """Prueba creación de secuencias"""
        lstm = LSTMStrategy(lookback=10)

        datos = datos_ejemplo['cantidad'].values.reshape(-1, 1)
        datos_escalados = lstm.scaler.fit_transform(datos)

        X, y = lstm._crear_secuencias(datos_escalados, lookback=10)

        assert len(X) == len(datos) - 10
        assert len(y) == len(datos) - 10
        assert X.shape == (len(datos) - 10, 10, 1)
        assert y.shape == (len(datos) - 10, 1)

    def test_prediccion_multiperíodo(self, datos_ejemplo):
        """Prueba predicción con múltiples períodos"""
        lstm = LSTMStrategy(lookback=10, epochs=5)
        lstm.entrenar(datos_ejemplo)

        # Diferentes períodos
        for periodos in [7, 14, 30, 60]:
            predicciones = lstm.predecir(datos_ejemplo, periodos=periodos)
            assert len(predicciones) == periodos

    def test_metricas_fallback(self, datos_ejemplo):
        """Prueba que metricas fallback son válidas"""
        lstm = LSTMStrategy()
        metricas = lstm._metricas_fallback()

        assert metricas['mae'] >= 0
        assert metricas['rmse'] >= 0
        assert 0 <= metricas['r2'] <= 1
        assert metricas['mape'] >= 0

    def test_reproducibilidad(self, datos_ejemplo):
        """Prueba que predicciones son similares en múltiples ejecuciones"""
        lstm1 = LSTMStrategy(lookback=10, epochs=5)
        lstm1.entrenar(datos_ejemplo)
        pred1 = lstm1.predecir(datos_ejemplo, periodos=10)

        lstm2 = LSTMStrategy(lookback=10, epochs=5)
        lstm2.entrenar(datos_ejemplo)
        pred2 = lstm2.predecir(datos_ejemplo, periodos=10)

        # Las predicciones pueden variar debido a TensorFlow, pero no deberían ser
        # completamente diferentes
        correlacion = np.corrcoef(
            pred1['prediccion'].values,
            pred2['prediccion'].values
        )[0, 1]

        # Esperar correlación razonable
        assert correlacion > 0.5 or np.isnan(correlacion)  # NaN si correlación indeterminada


@pytest.mark.parametrize("periodos", [7, 14, 30])
def test_prediccion_periodos(periodos, datos_ejemplo):
    """Prueba predicción parametrizada"""
    lstm = LSTMStrategy(lookback=10, epochs=5)
    lstm.entrenar(datos_ejemplo)
    predicciones = lstm.predecir(datos_ejemplo, periodos=periodos)

    assert len(predicciones) == periodos
    assert not predicciones['prediccion'].isna().any()


def test_integracion_con_pipeline(datos_ejemplo):
    """Prueba integración con sistema de pipelines"""
    from backend.agent.pipelines.forecast import obtener_estrategia

    lstm = obtener_estrategia('lstm')
    assert lstm is not None
    assert isinstance(lstm, LSTMStrategy)

    metricas = lstm.entrenar(datos_ejemplo)
    assert lstm.is_trained
    assert 'mape' in metricas
