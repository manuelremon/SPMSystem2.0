"""
Tests para STL Decomposition Model
==================================
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

from backend.agent.pipelines.forecast.stl_decomposition import STLDecompositionStrategy


@pytest.fixture
def datos_ejemplo():
    """Genera datos con patrón estacional fuerte"""
    fechas = pd.date_range(start='2023-01-01', periods=365, freq='D')
    # Crear serie con estacionalidad semanal clara
    estacionalidad = 30 * np.sin(np.arange(365) * 2 * np.pi / 7)
    tendencia = 100 + np.arange(365) * 0.05
    ruido = np.random.normal(0, 5, 365)
    cantidad = tendencia + estacionalidad + ruido
    cantidad = np.maximum(cantidad, 10)

    return pd.DataFrame({
        'fecha': fechas,
        'cantidad': cantidad
    })


@pytest.fixture
def datos_cortos():
    """Genera datos más cortos para pruebas de series cortas.

    Uses only 10 data points which is fewer than seasonal*2 (7*2=14),
    so STL will fall back to the simple model.
    """
    fechas = pd.date_range(start='2024-01-01', periods=10, freq='D')
    cantidad = 50 + np.random.normal(0, 5, 10)
    return pd.DataFrame({
        'fecha': fechas,
        'cantidad': np.maximum(cantidad, 10)
    })


class TestSTLDecompositionStrategy:
    """Tests para STLDecompositionStrategy"""

    def test_inicializacion(self):
        """Prueba inicialización correcta"""
        stl = STLDecompositionStrategy(seasonal=7, trend=31)
        assert stl.seasonal == 7
        assert stl.trend == 31
        assert stl.nombre_modelo == "STL Decomposition"
        assert not stl.requiere_features_adicionales

    def test_entrenamiento_basico(self, datos_ejemplo):
        """Prueba entrenamiento con datos suficientes"""
        stl = STLDecompositionStrategy(seasonal=7, trend=31)
        metricas = stl.entrenar(datos_ejemplo)

        assert stl.is_trained
        assert 'mae' in metricas
        assert 'rmse' in metricas
        assert 'r2' in metricas
        assert 'mape' in metricas
        assert all(m >= 0 for m in [metricas['mae'], metricas['rmse'], metricas['mape']])

    def test_entrenamiento_datos_cortos(self, datos_cortos):
        """Prueba que maneja datos cortos usando fallback"""
        stl = STLDecompositionStrategy(seasonal=7, trend=31)
        metricas = stl.entrenar(datos_cortos)

        # Debe usar modelo simple por falta de datos para período estacional
        assert stl._usar_modelo_simple
        assert stl.is_trained

    def test_descomposicion_componentes(self, datos_ejemplo):
        """Prueba que STL retorna componentes correctamente"""
        stl = STLDecompositionStrategy(seasonal=7, trend=31)
        stl.entrenar(datos_ejemplo)

        descomposicion = stl.get_descomposicion()

        assert descomposicion is not None
        assert 'trend' in descomposicion
        assert 'seasonal' in descomposicion
        assert 'residual' in descomposicion
        assert 'fechas' in descomposicion

        # Validar formas
        assert len(descomposicion['trend']) == len(datos_ejemplo)
        assert len(descomposicion['seasonal']) == len(datos_ejemplo)
        assert len(descomposicion['residual']) == len(datos_ejemplo)
        assert len(descomposicion['fechas']) == len(datos_ejemplo)

    def test_prediccion_basica(self, datos_ejemplo):
        """Prueba predicción básica"""
        stl = STLDecompositionStrategy(seasonal=7, trend=31)
        stl.entrenar(datos_ejemplo)

        predicciones = stl.predecir(datos_ejemplo, periodos=30)

        assert len(predicciones) == 30
        assert 'fecha' in predicciones.columns
        assert 'prediccion' in predicciones.columns
        assert 'limite_inferior' in predicciones.columns
        assert 'limite_superior' in predicciones.columns

    def test_intervalos_confianza(self, datos_ejemplo):
        """Prueba que límites superior > predicción > límite inferior"""
        stl = STLDecompositionStrategy(seasonal=7, trend=31)
        stl.entrenar(datos_ejemplo)

        predicciones = stl.predecir(datos_ejemplo, periodos=20)

        assert (predicciones['limite_superior'] >= predicciones['prediccion']).all()
        assert (predicciones['prediccion'] >= predicciones['limite_inferior']).all()

    def test_prediccion_valores_positivos(self, datos_ejemplo):
        """Prueba que predicciones son no-negativas"""
        stl = STLDecompositionStrategy(seasonal=7, trend=31)
        stl.entrenar(datos_ejemplo)

        predicciones = stl.predecir(datos_ejemplo, periodos=30)

        assert (predicciones['prediccion'] >= 0).all()
        assert (predicciones['limite_inferior'] >= 0).all()

    def test_feature_importance(self, datos_ejemplo):
        """Prueba que feature importance retorna DataFrame vacío"""
        stl = STLDecompositionStrategy(seasonal=7, trend=31)
        stl.entrenar(datos_ejemplo)

        fi = stl.get_feature_importance()
        assert isinstance(fi, pd.DataFrame)
        assert len(fi) == 0

    def test_validacion_datos(self):
        """Prueba validación de datos"""
        stl = STLDecompositionStrategy()

        # Sin 'fecha'
        df_sin_fecha = pd.DataFrame({'cantidad': [1, 2, 3]})
        assert not stl.validar_datos(df_sin_fecha)

        # Sin 'cantidad'
        df_sin_cantidad = pd.DataFrame({'fecha': pd.date_range('2024-01-01', periods=3)})
        assert not stl.validar_datos(df_sin_cantidad)

        # Válido
        df_valido = pd.DataFrame({
            'fecha': pd.date_range('2024-01-01', periods=30),
            'cantidad': np.random.randint(10, 50, 30)
        })
        assert stl.validar_datos(df_valido)

    def test_pronosticar_componente_trend(self, datos_ejemplo):
        """Prueba pronóstico de componente trend"""
        stl = STLDecompositionStrategy(seasonal=7)
        stl.entrenar(datos_ejemplo)

        descomp = stl.get_descomposicion()
        trend = descomp['trend']

        # Pronosticar trend (usa regresión lineal)
        forecast_trend = stl._pronosticar_componente(trend, periodos=30, trend=True)

        assert len(forecast_trend) == 30
        assert not np.any(np.isnan(forecast_trend))

    def test_pronosticar_componente_seasonal(self, datos_ejemplo):
        """Prueba pronóstico de componente seasonal"""
        stl = STLDecompositionStrategy(seasonal=7)
        stl.entrenar(datos_ejemplo)

        descomp = stl.get_descomposicion()
        seasonal = descomp['seasonal']

        # Pronosticar seasonal (repite ciclo)
        forecast_seasonal = stl._pronosticar_componente(seasonal, periodos=30, trend=False)

        assert len(forecast_seasonal) == 30
        assert not np.any(np.isnan(forecast_seasonal))

    def test_prediccion_multiperíodo(self, datos_ejemplo):
        """Prueba predicción con múltiples períodos"""
        stl = STLDecompositionStrategy(seasonal=7)
        stl.entrenar(datos_ejemplo)

        for periodos in [7, 14, 30, 60]:
            predicciones = stl.predecir(datos_ejemplo, periodos=periodos)
            assert len(predicciones) == periodos

    def test_fechas_prediccion(self, datos_ejemplo):
        """Prueba que las fechas de predicción son correctas"""
        stl = STLDecompositionStrategy(seasonal=7)
        stl.entrenar(datos_ejemplo)

        predicciones = stl.predecir(datos_ejemplo, periodos=10)

        ultima_fecha = pd.to_datetime(datos_ejemplo['fecha'].max())
        for i, row in predicciones.iterrows():
            fecha_esperada = ultima_fecha + timedelta(days=i+1)
            assert pd.to_datetime(row['fecha']).date() == fecha_esperada.date()

    def test_metricas_fallback(self):
        """Prueba que métricas fallback son válidas"""
        stl = STLDecompositionStrategy()
        stl._media_historica = 50.0
        stl._std_historica = 10.0

        metricas = stl._metricas_fallback()

        assert metricas['mae'] >= 0
        assert metricas['rmse'] >= 0
        assert 0 <= metricas['r2'] <= 1
        assert metricas['mape'] >= 0

    def test_diferente_periodo_estacional(self):
        """Prueba con diferente período estacional"""
        fechas = pd.date_range(start='2023-01-01', periods=365, freq='D')
        # Estacionalidad mensual
        estacionalidad = 20 * np.sin(np.arange(365) * 2 * np.pi / 30)
        cantidad = 100 + estacionalidad + np.random.normal(0, 5, 365)

        df = pd.DataFrame({
            'fecha': fechas,
            'cantidad': np.maximum(cantidad, 10)
        })

        # Usar período mensual
        stl = STLDecompositionStrategy(seasonal=30, trend=61)
        metricas = stl.entrenar(df)

        assert stl.is_trained
        assert metricas['mape'] >= 0


@pytest.mark.parametrize("periodos", [7, 14, 30])
def test_prediccion_periodos_parametrizado(periodos, datos_ejemplo):
    """Prueba predicción parametrizada"""
    stl = STLDecompositionStrategy(seasonal=7)
    stl.entrenar(datos_ejemplo)

    predicciones = stl.predecir(datos_ejemplo, periodos=periodos)
    assert len(predicciones) == periodos


def test_integracion_con_pipeline(datos_ejemplo):
    """Prueba integración con sistema de pipelines"""
    from backend.agent.pipelines.forecast import obtener_estrategia

    stl = obtener_estrategia('stl')
    assert stl is not None
    assert isinstance(stl, STLDecompositionStrategy)

    metricas = stl.entrenar(datos_ejemplo)
    assert stl.is_trained
    assert 'mape' in metricas

    descomp = stl.get_descomposicion()
    assert descomp is not None
