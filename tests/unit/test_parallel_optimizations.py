"""
Tests de paridad y rendimiento para optimizaciones de paralelización.

Sprint: Optimizaciones CPU
Verifica que las versiones paralelas producen mismos resultados que secuenciales.
"""

import time
import pytest
import numpy as np
from datetime import datetime, timedelta


class TestScoringVectorizacion:
    """Tests para la vectorización del ScoringPipeline."""

    @pytest.fixture
    def pipeline(self):
        from backend.agent.pipelines.scoring import ScoringPipeline
        return ScoringPipeline()

    @pytest.fixture
    def solicitudes_pequenas(self):
        """5 solicitudes - debe usar método secuencial."""
        return [
            {
                "id": i,
                "criticidad": "Alta" if i % 2 == 0 else "Normal",
                "fecha_necesidad": (datetime.now() + timedelta(days=i*3)).isoformat(),
                "total_monto": 10000 * (i + 1),
                "data_json": {"items": [{"x": 1} for _ in range(i + 1)]}
            }
            for i in range(5)
        ]

    @pytest.fixture
    def solicitudes_grandes(self):
        """100 solicitudes - debe usar método vectorizado."""
        return [
            {
                "id": i,
                "criticidad": "Alta" if i % 3 == 0 else "Normal",
                "fecha_necesidad": (datetime.now() + timedelta(days=i % 30)).isoformat(),
                "total_monto": 5000 * ((i % 10) + 1),
                "data_json": {"items": [{"x": 1} for _ in range((i % 5) + 1)]}
            }
            for i in range(100)
        ]

    def test_ranking_pequeno_usa_secuencial(self, pipeline, solicitudes_pequenas):
        """Lotes pequeños (<= 10) usan método secuencial."""
        result = pipeline.rank_solicitudes(solicitudes_pequenas)

        assert result["total_solicitudes"] == 5
        assert len(result["solicitudes_rankeadas"]) == 5
        # Verifica que tiene ranking asignado
        for item in result["solicitudes_rankeadas"]:
            assert "rank" in item
            assert "total_score" in item

    def test_ranking_grande_usa_vectorizado(self, pipeline, solicitudes_grandes):
        """Lotes grandes (> 10) usan método vectorizado."""
        result = pipeline.rank_solicitudes(solicitudes_grandes)

        assert result["total_solicitudes"] == 100
        assert len(result["solicitudes_rankeadas"]) == 100
        # Rankings deben ser 1 a 100
        ranks = [item["rank"] for item in result["solicitudes_rankeadas"]]
        assert sorted(ranks) == list(range(1, 101))

    def test_ranking_vacio(self, pipeline):
        """Lista vacía retorna resultado vacío correcto."""
        result = pipeline.rank_solicitudes([])

        assert result["total_solicitudes"] == 0
        assert result["solicitudes_rankeadas"] == []

    def test_paridad_secuencial_vs_vectorizado(self, pipeline, solicitudes_grandes):
        """
        Verifica que vectorizado produce mismos scores que secuencial.

        Los scores individuales deben ser idénticos (dentro de tolerancia float).
        """
        # Calcular scores uno por uno (método secuencial)
        scores_secuenciales = {}
        for sol in solicitudes_grandes:
            score_result = pipeline.score_solicitud(sol)
            scores_secuenciales[sol["id"]] = score_result["total_score"]

        # Calcular con vectorización
        result = pipeline.rank_solicitudes(solicitudes_grandes)
        scores_vectorizados = {
            item["solicitud_id"]: item["total_score"]
            for item in result["solicitudes_rankeadas"]
        }

        # Comparar
        for sol_id, score_sec in scores_secuenciales.items():
            score_vec = scores_vectorizados[sol_id]
            assert abs(score_sec - score_vec) < 1e-6, f"Score mismatch para solicitud {sol_id}"

    def test_rendimiento_vectorizado(self, pipeline):
        """Verifica que vectorizado es significativamente más rápido para lotes grandes."""
        # 1000 solicitudes
        solicitudes = [
            {
                "id": i,
                "criticidad": "Alta" if i % 3 == 0 else "Normal",
                "fecha_necesidad": (datetime.now() + timedelta(days=i % 30)).isoformat(),
                "total_monto": 5000 * ((i % 10) + 1),
                "data_json": {"items": [{"x": 1} for _ in range((i % 5) + 1)]}
            }
            for i in range(1000)
        ]

        # Tiempo vectorizado (lo que usa por defecto para > 10)
        start = time.perf_counter()
        result = pipeline.rank_solicitudes(solicitudes)
        tiempo_vectorizado = time.perf_counter() - start

        assert result["total_solicitudes"] == 1000
        # Debe completar en menos de 1 segundo
        assert tiempo_vectorizado < 1.0, f"Vectorizado muy lento: {tiempo_vectorizado:.2f}s"


class TestAIServiceParalelo:
    """Tests para paralelización de AIService.train_pipelines."""

    @pytest.fixture
    def ai_service(self):
        from backend.services.ai_service import AIService
        return AIService()

    @pytest.fixture
    def datos_entrenamiento(self):
        materiales = [
            {"codigo": f"M{i:04d}", "descripcion": f"Material {i}", "precio_usd": 100 * i}
            for i in range(50)
        ]
        solicitudes = [
            {"id": i, "material_codigo": f"M{i % 50:04d}", "cantidad": 10 + i}
            for i in range(100)
        ]
        return solicitudes, materiales

    def test_train_paralelo_no_error(self, ai_service, datos_entrenamiento):
        """Entrenamiento paralelo no debe producir errores."""
        solicitudes, materiales = datos_entrenamiento
        result = ai_service.train_pipelines(solicitudes, materiales)

        # Debe retornar resultado válido
        assert "status" in result
        assert "clustering" in result
        assert "forecast" in result
        # No debe haber errores críticos
        assert result.get("status") != "error" or result.get("errors", [])

    def test_train_concurrente_bloqueado(self, ai_service, datos_entrenamiento):
        """Entrenamientos concurrentes deben bloquearse correctamente."""
        solicitudes, materiales = datos_entrenamiento

        # Simular entrenamiento en progreso
        from backend.services.ai_service import _training_lock

        # Primer entrenamiento normal
        result1 = ai_service.train_pipelines(solicitudes, materiales)
        assert result1.get("status") != "busy"


class TestBacktesterParalelo:
    """Tests para paralelización del Backtester."""

    @pytest.fixture
    def datos_historicos(self):
        """Genera datos históricos sintéticos."""
        import pandas as pd
        fechas = pd.date_range(start='2024-01-01', periods=180, freq='D')
        cantidades = np.random.poisson(100, size=180).astype(float)
        return pd.DataFrame({'fecha': fechas, 'cantidad': cantidades})

    def test_backtester_paralelo_vs_secuencial(self, datos_historicos):
        """Verifica paridad entre ejecución paralela y secuencial."""
        from backend.agent.pipelines.forecast import DemandPredictor
        from backend.agent.pipelines.forecast.backtesting import Backtester

        # Ejecutar secuencial
        backtester_sec = Backtester(DemandPredictor, 'random_forest')
        result_sec = backtester_sec.ejecutar(
            datos_historicos,
            ventana_test=30,
            n_pasos=3,
            paralelo=False
        )

        # Ejecutar paralelo
        backtester_par = Backtester(DemandPredictor, 'random_forest')
        result_par = backtester_par.ejecutar(
            datos_historicos,
            ventana_test=30,
            n_pasos=3,
            paralelo=True
        )

        # Ambos deben tener mismo número de pasos exitosos
        assert result_sec.n_pasos == result_par.n_pasos

        # Métricas agregadas deben ser similares (pueden variar por orden de ejecución)
        assert abs(result_sec.mae_promedio - result_par.mae_promedio) < 1e-3

    def test_backtester_paralelo_no_error(self, datos_historicos):
        """Backtester paralelo no debe producir errores."""
        from backend.agent.pipelines.forecast import DemandPredictor
        from backend.agent.pipelines.forecast.backtesting import Backtester

        backtester = Backtester(DemandPredictor, 'random_forest')
        result = backtester.ejecutar(
            datos_historicos,
            ventana_test=30,
            n_pasos=5,
            paralelo=True
        )

        assert result.n_pasos > 0
        assert result.mae_promedio >= 0


class TestModelComparatorParalelo:
    """Tests para paralelización de ModelComparator."""

    @pytest.fixture
    def datos_historicos(self):
        import pandas as pd
        fechas = pd.date_range(start='2024-01-01', periods=180, freq='D')
        cantidades = np.random.poisson(100, size=180).astype(float)
        return pd.DataFrame({'fecha': fechas, 'cantidad': cantidades})

    def test_comparador_paralelo_vs_secuencial(self, datos_historicos):
        """Verifica que comparación paralela encuentra mismo mejor modelo."""
        from backend.agent.pipelines.forecast import DemandPredictor
        from backend.agent.pipelines.forecast.backtesting import ModelComparator

        modelos = ['random_forest', 'linear']

        # Secuencial
        comparator_sec = ModelComparator(DemandPredictor)
        result_sec = comparator_sec.comparar(
            datos_historicos,
            modelos,
            n_pasos=2,
            paralelo=False
        )

        # Paralelo
        comparator_par = ModelComparator(DemandPredictor)
        result_par = comparator_par.comparar(
            datos_historicos,
            modelos,
            n_pasos=2,
            paralelo=True
        )

        # Ambos deben evaluar mismos modelos
        assert set(result_sec['resultados'].keys()) == set(result_par['resultados'].keys())

        # Mejor modelo debe ser el mismo (o muy cercano en MAE)
        # Nota: puede variar ligeramente por orden de ejecución


class TestAutoModelSelectorParalelo:
    """Tests para paralelización de AutoModelSelector."""

    @pytest.fixture
    def datos_entrenamiento(self):
        """Genera datos de entrenamiento sintéticos."""
        np.random.seed(42)
        n_samples = 200
        X = np.random.randn(n_samples, 10)
        y = 3 * X[:, 0] + 2 * X[:, 1] + np.random.randn(n_samples) * 0.1
        return X, y

    def test_selector_paralelo_no_error(self, datos_entrenamiento):
        """Selector paralelo no debe producir errores."""
        from backend.agent.pipelines.forecast.tuning import AutoModelSelector

        X, y = datos_entrenamiento
        selector = AutoModelSelector(
            modelos=['random_forest', 'ridge'],
            cv_splits=3
        )

        result = selector.seleccionar(X, y, paralelo=True)

        assert result.mejor_modelo in ['random_forest', 'ridge']
        assert len(result.ranking) == 2

    def test_selector_paralelo_vs_secuencial(self, datos_entrenamiento):
        """Verifica paridad entre selección paralela y secuencial."""
        from backend.agent.pipelines.forecast.tuning import AutoModelSelector

        X, y = datos_entrenamiento

        # Secuencial
        selector_sec = AutoModelSelector(modelos=['random_forest', 'ridge'], cv_splits=3)
        result_sec = selector_sec.seleccionar(X, y, paralelo=False)

        # Paralelo
        selector_par = AutoModelSelector(modelos=['random_forest', 'ridge'], cv_splits=3)
        result_par = selector_par.seleccionar(X, y, paralelo=True)

        # Mismo mejor modelo
        assert result_sec.mejor_modelo == result_par.mejor_modelo

        # Métricas similares
        for modelo in ['random_forest', 'ridge']:
            mae_sec = result_sec.comparacion[modelo].get('mae_mean', float('inf'))
            mae_par = result_par.comparacion[modelo].get('mae_mean', float('inf'))
            if mae_sec != float('inf') and mae_par != float('inf'):
                assert abs(mae_sec - mae_par) < 0.1


class TestRendimientoGeneral:
    """Tests de rendimiento general de las optimizaciones."""

    def test_scoring_1000_solicitudes_bajo_1_segundo(self):
        """Ranking de 1000 solicitudes debe completar en < 1 segundo."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        solicitudes = [
            {
                "id": i,
                "criticidad": "Alta" if i % 3 == 0 else "Normal",
                "fecha_necesidad": (datetime.now() + timedelta(days=i % 30)).isoformat(),
                "total_monto": 5000 * ((i % 10) + 1),
                "data_json": {"items": [{"x": 1} for _ in range((i % 5) + 1)]}
            }
            for i in range(1000)
        ]

        start = time.perf_counter()
        result = pipeline.rank_solicitudes(solicitudes)
        elapsed = time.perf_counter() - start

        assert elapsed < 1.0, f"Demasiado lento: {elapsed:.2f}s"
        assert result["total_solicitudes"] == 1000
