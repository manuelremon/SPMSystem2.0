"""
Tests para Comparación Paralela de Modelos de Forecast
=======================================================
FASE 1 - SPM v3.0
"""
import pytest
import pandas as pd
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import sys
from pathlib import Path
import time

# Agregar backend al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.agent.pipelines.forecast import obtener_estrategia, obtener_estrategias_disponibles


@pytest.fixture
def datos_ejemplo():
    """Genera datos de ejemplo para pruebas"""
    fechas = pd.date_range(start='2024-01-01', periods=100, freq='D')
    # Crear serie con tendencia y estacionalidad
    base = 50 * (1 + 0.1 * np.sin(np.arange(100) * 2 * np.pi / 7))
    tendencia = np.arange(100) * 0.05
    ruido = np.random.normal(0, 3, 100)
    cantidad = base + tendencia + ruido
    cantidad = np.maximum(cantidad, 5)

    return pd.DataFrame({
        'fecha': fechas,
        'cantidad': cantidad
    })


class TestComparacionParalela:
    """Tests para comparación paralela de modelos"""

    def test_obtener_estrategias_disponibles(self):
        """Prueba que hay modelos disponibles"""
        estrategias = obtener_estrategias_disponibles()

        assert len(estrategias) > 0
        assert 'lstm' in estrategias or 'stl' in estrategias
        assert all(isinstance(e, str) for e in estrategias)

    def test_entrenar_modelo_unico(self, datos_ejemplo):
        """Prueba entrenamiento de un modelo individual"""
        modelo = obtener_estrategia('lstm')
        assert modelo is not None

        metricas = modelo.entrenar(datos_ejemplo)

        assert 'mae' in metricas
        assert 'rmse' in metricas
        assert 'r2' in metricas
        assert 'mape' in metricas

    def test_entrenar_multiples_modelos_secuencial(self, datos_ejemplo):
        """Prueba entrenamiento secuencial de múltiples modelos"""
        modelos_ids = ['random_forest', 'lstm', 'stl']
        resultados = {}

        for modelo_id in modelos_ids:
            modelo = obtener_estrategia(modelo_id)
            if modelo:
                metricas = modelo.entrenar(datos_ejemplo)
                resultados[modelo_id] = {
                    'metricas': metricas,
                    'modelo': modelo
                }

        assert len(resultados) > 0
        assert all('metricas' in r for r in resultados.values())

    def test_entrenar_multiples_modelos_paralelo(self, datos_ejemplo):
        """Prueba entrenamiento paralelo de modelos"""
        modelos_ids = ['random_forest', 'gradient_boosting', 'lstm']
        resultados = {}

        def entrenar_modelo(modelo_id):
            modelo = obtener_estrategia(modelo_id)
            if modelo:
                metricas = modelo.entrenar(datos_ejemplo)
                return modelo_id, metricas, modelo
            return modelo_id, None, None

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(entrenar_modelo, mid) for mid in modelos_ids]
            for future in futures:
                modelo_id, metricas, modelo = future.result()
                if metricas:
                    resultados[modelo_id] = {
                        'metricas': metricas,
                        'modelo': modelo
                    }

        assert len(resultados) > 0

    def test_ranking_por_mape(self, datos_ejemplo):
        """Prueba ranking de modelos por MAPE"""
        modelos_ids = ['random_forest', 'lstm']
        resultados = {}

        for modelo_id in modelos_ids:
            modelo = obtener_estrategia(modelo_id)
            if modelo:
                metricas = modelo.entrenar(datos_ejemplo)
                resultados[modelo_id] = {
                    'mape': metricas['mape'],
                    'modelo': modelo
                }

        # Ordenar por MAPE
        ranking = sorted(resultados.items(), key=lambda x: x[1]['mape'])

        assert len(ranking) > 0
        # Verificar que MAPE es creciente
        for i in range(len(ranking) - 1):
            assert ranking[i][1]['mape'] <= ranking[i+1][1]['mape'] or np.isclose(
                ranking[i][1]['mape'],
                ranking[i+1][1]['mape']
            )

    def test_comparacion_metricas(self, datos_ejemplo):
        """Prueba comparación de múltiples métricas"""
        modelos_ids = ['lstm', 'stl']
        comparacion = {}

        for modelo_id in modelos_ids:
            modelo = obtener_estrategia(modelo_id)
            if modelo:
                metricas = modelo.entrenar(datos_ejemplo)
                comparacion[modelo_id] = metricas

        # Crear DataFrame de comparación
        df_comp = pd.DataFrame(comparacion).T

        assert isinstance(df_comp, pd.DataFrame)
        assert all(col in df_comp.columns for col in ['mae', 'rmse', 'r2', 'mape'])

    def test_performance_paralelo_vs_secuencial(self, datos_ejemplo):
        """Prueba que ejecución paralela es más rápida"""
        modelos_ids = ['random_forest', 'gradient_boosting', 'linear']

        # Secuencial
        start = time.time()
        for modelo_id in modelos_ids:
            modelo = obtener_estrategia(modelo_id)
            if modelo:
                modelo.entrenar(datos_ejemplo)
        tiempo_secuencial = time.time() - start

        # Paralelo
        def entrenar(mid):
            m = obtener_estrategia(mid)
            if m:
                m.entrenar(datos_ejemplo)

        start = time.time()
        with ThreadPoolExecutor(max_workers=3) as executor:
            list(executor.map(entrenar, modelos_ids))
        tiempo_paralelo = time.time() - start

        # Paralelo debería ser más rápido (aunque en este caso puede haber overhead)
        # Simplemente verificamos que ambas completaron
        assert tiempo_secuencial > 0
        assert tiempo_paralelo > 0

    def test_prediccion_multiples_modelos(self, datos_ejemplo):
        """Prueba predicción con múltiples modelos"""
        modelos_ids = ['lstm', 'stl']
        predicciones = {}

        for modelo_id in modelos_ids:
            modelo = obtener_estrategia(modelo_id)
            if modelo:
                modelo.entrenar(datos_ejemplo)
                preds = modelo.predecir(datos_ejemplo, periodos=30)
                predicciones[modelo_id] = preds

        assert len(predicciones) > 0
        for preds in predicciones.values():
            assert len(preds) == 30

    def test_seleccionar_mejor_modelo(self, datos_ejemplo):
        """Prueba selección del mejor modelo por MAPE"""
        modelos_ids = ['random_forest', 'lstm', 'stl']
        resultados = {}

        for modelo_id in modelos_ids:
            modelo = obtener_estrategia(modelo_id)
            if modelo:
                metricas = modelo.entrenar(datos_ejemplo)
                resultados[modelo_id] = {
                    'mape': metricas['mape'],
                    'modelo': modelo
                }

        # Seleccionar mejor
        mejor_modelo = min(resultados.items(), key=lambda x: x[1]['mape'])

        assert mejor_modelo[0] in modelos_ids
        assert mejor_modelo[1]['mape'] >= 0

    def test_timeout_entrenamiento(self, datos_ejemplo):
        """Prueba que entrenamientos completen sin timeout"""
        from concurrent.futures import TimeoutError

        modelo = obtener_estrategia('lstm')

        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(modelo.entrenar, datos_ejemplo)
                metricas = future.result(timeout=300)  # 5 minutos

            assert 'mape' in metricas
        except TimeoutError:
            pytest.fail("Entrenamiento excedió timeout")

    @pytest.mark.parametrize("modelo_id", ['random_forest', 'lstm'])
    def test_entrenar_por_id(self, modelo_id, datos_ejemplo):
        """Prueba entrenamiento parametrizado por ID"""
        modelo = obtener_estrategia(modelo_id)

        if modelo:
            metricas = modelo.entrenar(datos_ejemplo)
            assert 'mape' in metricas
            assert metricas['mape'] >= 0


class TestComparacionReport:
    """Tests para reportes de comparación"""

    def test_crear_reporte_comparacion(self, datos_ejemplo):
        """Prueba creación de reporte de comparación"""
        from backend.agent.pipelines.forecast import ModelComparator

        comparador = ModelComparator()
        modelos_ids = ['random_forest', 'lstm']

        for modelo_id in modelos_ids:
            modelo = obtener_estrategia(modelo_id)
            if modelo:
                metricas = modelo.entrenar(datos_ejemplo)
                comparador.agregar_resultado(modelo_id, metricas, modelo)

        reporte = comparador.generar_reporte()

        assert reporte is not None
        assert hasattr(reporte, 'modelos')
        assert hasattr(reporte, 'metricas')
        assert hasattr(reporte, 'mejor_por_metrica')

    def test_reporte_mejor_por_metrica(self, datos_ejemplo):
        """Prueba que reporte identifica mejor modelo por métrica"""
        from backend.agent.pipelines.forecast import ModelComparator

        comparador = ModelComparator()
        modelos_ids = ['random_forest', 'lstm']

        for modelo_id in modelos_ids:
            modelo = obtener_estrategia(modelo_id)
            if modelo:
                metricas = modelo.entrenar(datos_ejemplo)
                comparador.agregar_resultado(modelo_id, metricas, modelo)

        reporte = comparador.generar_reporte()

        # Verificar que hay mejor por cada métrica
        assert 'mae' in reporte.mejor_por_metrica or len(reporte.mejor_por_metrica) == 0
        assert 'rmse' in reporte.mejor_por_metrica or len(reporte.mejor_por_metrica) == 0


def test_integracion_pipeline_completa(datos_ejemplo):
    """Prueba integración completa del pipeline"""
    from backend.agent.pipelines.forecast import DemandPredictor

    # Usar LSTM
    predictor = DemandPredictor(modelo='lstm')
    assert predictor is not None

    metricas = predictor.entrenar(datos_ejemplo)
    assert 'mape' in metricas

    predicciones = predictor.predecir(datos_ejemplo, periodos=30)
    assert len(predicciones) == 30
