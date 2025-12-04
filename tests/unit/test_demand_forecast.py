"""
Tests unitarios para DemandForecastPipeline
backend_v2/agent/pipelines/demand_forecast.py

Generado por Sugar Autonomous System
"""

import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend_v2.agent.pipelines.demand_forecast import DemandForecastPipeline


class TestDemandForecastInitialization:
    """Tests para inicialización del pipeline"""

    def test_init_default_window(self):
        """Pipeline debe inicializar con ventana de 90 días por defecto"""
        pipeline = DemandForecastPipeline()
        assert pipeline.historical_window_days == 90

    def test_init_custom_window(self):
        """Pipeline debe aceptar ventana personalizada"""
        pipeline = DemandForecastPipeline(historical_window_days=180)
        assert pipeline.historical_window_days == 180

    def test_init_model_is_none(self):
        """Modelo debe ser None al inicializar"""
        pipeline = DemandForecastPipeline()
        assert pipeline.model is None

    def test_init_scaler_exists(self):
        """Scaler debe existir al inicializar"""
        pipeline = DemandForecastPipeline()
        assert pipeline.scaler is not None


class TestDemandForecastFit:
    """Tests para el método fit"""

    @pytest.fixture
    def sample_data(self):
        """Genera datos de prueba suficientes con grupos de 3+ registros"""
        base_date = datetime.now()
        data = []
        # Crear datos con múltiples registros por grupo material/centro
        materials = ["MAT001", "MAT002", "MAT003"]
        centros = ["C1", "C2"]
        for mat in materials:
            for centro in centros:
                # 5 registros por cada combinación material/centro
                for j in range(5):
                    data.append(
                        {
                            "created_at": (base_date - timedelta(days=j * 3)).isoformat(),
                            "material_codigo": mat,
                            "centro": centro,
                            "total_monto": 100.0 + j * 20,
                        }
                    )
        return data

    @pytest.fixture
    def pipeline(self):
        return DemandForecastPipeline(historical_window_days=90)

    def test_fit_returns_dict(self, pipeline, sample_data):
        """fit debe retornar diccionario con información"""
        result = pipeline.fit(sample_data)
        assert isinstance(result, dict)
        assert "status" in result

    def test_fit_sets_model(self, pipeline, sample_data):
        """fit debe establecer el modelo"""
        pipeline.fit(sample_data)
        assert pipeline.model is not None

    def test_fit_sets_last_fit_date(self, pipeline, sample_data):
        """fit debe establecer fecha de entrenamiento"""
        pipeline.fit(sample_data)
        assert pipeline.last_fit_date is not None

    def test_fit_returns_train_score(self, pipeline, sample_data):
        """fit debe retornar train_score"""
        result = pipeline.fit(sample_data)
        assert "train_score" in result
        assert 0.0 <= result["train_score"] <= 1.0

    def test_fit_requires_minimum_data(self, pipeline):
        """fit debe requerir mínimo 10 registros"""
        small_data = [
            {
                "created_at": datetime.now().isoformat(),
                "material_codigo": "M1",
                "centro": "C1",
                "total_monto": 100,
            }
            for _ in range(5)
        ]
        with pytest.raises(ValueError, match="al menos 10 registros"):
            pipeline.fit(small_data)

    def test_fit_feature_importance(self, pipeline, sample_data):
        """fit debe calcular importancia de features"""
        result = pipeline.fit(sample_data)
        assert "feature_importance" in result
        assert isinstance(result["feature_importance"], dict)


class TestDemandForecastPredict:
    """Tests para el método predict"""

    @pytest.fixture
    def trained_pipeline(self):
        """Pipeline entrenado con datos de prueba"""
        pipeline = DemandForecastPipeline()
        base_date = datetime.now()
        data = []
        # Crear datos con grupos de 5 registros cada uno
        materials = ["MAT001", "MAT002", "MAT003"]
        centros = ["C1", "C2"]
        for mat in materials:
            for centro in centros:
                for j in range(5):
                    data.append(
                        {
                            "created_at": (base_date - timedelta(days=j * 3)).isoformat(),
                            "material_codigo": mat,
                            "centro": centro,
                            "total_monto": 100.0 + j * 20,
                        }
                    )
        pipeline.fit(data)
        return pipeline

    def test_predict_returns_dict(self, trained_pipeline):
        """predict debe retornar diccionario"""
        result = trained_pipeline.predict("MAT001", "C1", days_ahead=30)
        assert isinstance(result, dict)

    def test_predict_contains_forecast(self, trained_pipeline):
        """predict debe contener pronóstico"""
        result = trained_pipeline.predict("MAT001", "C1")
        assert "predicted_demand" in result
        assert isinstance(result["predicted_demand"], float)

    def test_predict_contains_confidence_interval(self, trained_pipeline):
        """predict debe contener intervalo de confianza"""
        result = trained_pipeline.predict("MAT001", "C1")
        assert "confidence_lower" in result
        assert "confidence_upper" in result
        assert result["confidence_lower"] <= result["predicted_demand"]
        assert result["predicted_demand"] <= result["confidence_upper"]

    def test_predict_without_fit_raises(self):
        """predict sin fit debe lanzar error"""
        pipeline = DemandForecastPipeline()
        with pytest.raises(ValueError, match="Modelo no entrenado"):
            pipeline.predict("MAT001", "C1")

    def test_predict_respects_confidence_level(self, trained_pipeline):
        """predict debe respetar nivel de confianza"""
        result_95 = trained_pipeline.predict("MAT001", "C1", confidence_level=0.95)
        result_99 = trained_pipeline.predict("MAT001", "C1", confidence_level=0.99)

        # Intervalo de 99% debe ser más amplio
        width_95 = result_95["confidence_upper"] - result_95["confidence_lower"]
        width_99 = result_99["confidence_upper"] - result_99["confidence_lower"]
        assert width_99 >= width_95


class TestDemandForecastMultiple:
    """Tests para forecast_multiple"""

    @pytest.fixture
    def trained_pipeline(self):
        pipeline = DemandForecastPipeline()
        base_date = datetime.now()
        data = []
        materials = ["MAT001", "MAT002", "MAT003"]
        centros = ["C1", "C2"]
        for mat in materials:
            for centro in centros:
                for j in range(5):
                    data.append(
                        {
                            "created_at": (base_date - timedelta(days=j * 3)).isoformat(),
                            "material_codigo": mat,
                            "centro": centro,
                            "total_monto": 100.0 + j * 20,
                        }
                    )
        pipeline.fit(data)
        return pipeline

    def test_forecast_multiple_returns_list(self, trained_pipeline):
        """forecast_multiple debe retornar lista de pronósticos"""
        materials = [
            {"material_codigo": "MAT001", "centro": "C1"},
            {"material_codigo": "MAT002", "centro": "C2"},
        ]
        result = trained_pipeline.forecast_multiple(materials)
        assert "forecasts" in result
        assert len(result["forecasts"]) == 2

    def test_forecast_multiple_handles_errors(self, trained_pipeline):
        """forecast_multiple debe manejar errores individuales"""
        materials = [
            {"material_codigo": "MAT001", "centro": "C1"},
            {"material_codigo": "MAT002", "centro": "C2"},
        ]
        result = trained_pipeline.forecast_multiple(materials)
        assert result["n_forecasts"] == 2


class TestDemandForecastHelpers:
    """Tests para métodos auxiliares"""

    def test_get_feature_names(self):
        """Debe retornar lista de nombres de features"""
        pipeline = DemandForecastPipeline()
        names = pipeline._get_feature_names()
        assert isinstance(names, list)
        assert len(names) > 0
        assert "total_demanda" in names

    def test_get_z_score_95(self):
        """z-score para 95% debe ser ~1.96"""
        pipeline = DemandForecastPipeline()
        z = pipeline._get_z_score(0.95)
        assert abs(z - 1.96) < 0.01

    def test_get_z_score_99(self):
        """z-score para 99% debe ser ~2.576"""
        pipeline = DemandForecastPipeline()
        z = pipeline._get_z_score(0.99)
        assert abs(z - 2.576) < 0.01

    def test_get_status_not_fitted(self):
        """get_status debe indicar si no está entrenado"""
        pipeline = DemandForecastPipeline()
        status = pipeline.get_status()
        assert status["is_fitted"] == False

    def test_get_status_fitted(self):
        """get_status debe indicar si está entrenado"""
        pipeline = DemandForecastPipeline()
        base_date = datetime.now()
        data = []
        materials = ["MAT001", "MAT002", "MAT003"]
        centros = ["C1", "C2"]
        for mat in materials:
            for centro in centros:
                for j in range(5):
                    data.append(
                        {
                            "created_at": (base_date - timedelta(days=j * 3)).isoformat(),
                            "material_codigo": mat,
                            "centro": centro,
                            "total_monto": 100.0 + j * 20,
                        }
                    )
        pipeline.fit(data)
        status = pipeline.get_status()
        assert status["is_fitted"] == True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
