"""
Tests TDD para pipelines ML existentes.
Sprint 6.1 - Tests comprehensivos para clustering, scoring y demand forecast.

Estos tests validan el comportamiento de los pipelines ML que se integran
con el servicio unificado de IA en Sprint 6.2.
"""

import pytest
import numpy as np
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta


# ============================================================================
# Tests para ClusteringPipeline
# ============================================================================

class TestClusteringPipelineInit:
    """Tests de inicializacion del pipeline de clustering."""

    def test_init_default_parameters(self):
        """Verifica parametros por defecto."""
        from backend.agent.pipelines.clustering import ClusteringPipeline

        pipeline = ClusteringPipeline()

        assert pipeline.n_clusters is None  # Auto-detect
        assert pipeline.max_clusters == 10
        assert pipeline.model is None
        assert pipeline.cluster_centers is None
        assert pipeline.silhouette is None

    def test_init_custom_clusters(self):
        """Permite especificar numero de clusters."""
        from backend.agent.pipelines.clustering import ClusteringPipeline

        pipeline = ClusteringPipeline(n_clusters=5, max_clusters=15)

        assert pipeline.n_clusters == 5
        assert pipeline.max_clusters == 15


class TestClusteringMaterialClusters:
    """Tests para clustering de materiales."""

    @pytest.fixture
    def sample_materials(self):
        """Datos de materiales de prueba."""
        return [
            {"codigo": "MAT001", "descripcion": "Valvula control", "precio_usd": 100, "unidad": "PZ", "activo": True},
            {"codigo": "MAT002", "descripcion": "Valvula seguridad", "precio_usd": 150, "unidad": "PZ", "activo": True},
            {"codigo": "MAT003", "descripcion": "Bomba centrifuga", "precio_usd": 5000, "unidad": "UN", "activo": True},
            {"codigo": "MAT004", "descripcion": "Bomba sumergible", "precio_usd": 4500, "unidad": "UN", "activo": True},
            {"codigo": "MAT005", "descripcion": "Tornillo M8", "precio_usd": 0.5, "unidad": "PZ", "activo": True},
            {"codigo": "MAT006", "descripcion": "Tornillo M10", "precio_usd": 0.8, "unidad": "PZ", "activo": True},
        ]

    def test_fit_material_clusters_success(self, sample_materials):
        """Entrena clustering con materiales validos."""
        from backend.agent.pipelines.clustering import ClusteringPipeline

        pipeline = ClusteringPipeline(n_clusters=3)
        result = pipeline.fit_material_clusters(sample_materials)

        assert result["status"] == "fitted"
        assert result["n_clusters"] == 3
        assert result["n_materials"] == 6
        assert "silhouette_score" in result
        assert "inertia" in result
        assert pipeline.model is not None

    def test_fit_material_clusters_auto_k(self, sample_materials):
        """Detecta automaticamente numero optimo de clusters."""
        from backend.agent.pipelines.clustering import ClusteringPipeline

        pipeline = ClusteringPipeline()  # n_clusters=None
        result = pipeline.fit_material_clusters(sample_materials)

        assert result["status"] == "fitted"
        assert 2 <= result["n_clusters"] <= 5  # Auto-detected

    def test_fit_material_clusters_insufficient_data(self):
        """Falla con menos de 3 materiales."""
        from backend.agent.pipelines.clustering import ClusteringPipeline

        pipeline = ClusteringPipeline()
        few_materials = [
            {"codigo": "MAT001", "descripcion": "Test", "precio_usd": 100},
            {"codigo": "MAT002", "descripcion": "Test2", "precio_usd": 200},
        ]

        with pytest.raises(ValueError, match="al menos 3 materiales"):
            pipeline.fit_material_clusters(few_materials)

    def test_predict_material_clusters(self, sample_materials):
        """Predice clusters para nuevos materiales."""
        from backend.agent.pipelines.clustering import ClusteringPipeline

        pipeline = ClusteringPipeline(n_clusters=2)
        pipeline.fit_material_clusters(sample_materials)

        new_materials = [
            {"codigo": "NEW001", "descripcion": "Valvula nueva", "precio_usd": 120, "unidad": "PZ"},
            {"codigo": "NEW002", "descripcion": "Bomba nueva", "precio_usd": 4800, "unidad": "UN"},
        ]

        result = pipeline.predict_material_clusters(new_materials)

        assert result["n_clusters"] <= 2
        assert result["total_materials"] == 2
        assert "clusters" in result
        assert "cluster_sizes" in result

    def test_predict_without_fit_fails(self):
        """Falla si no se entreno el modelo."""
        from backend.agent.pipelines.clustering import ClusteringPipeline

        pipeline = ClusteringPipeline()

        with pytest.raises(ValueError, match="Modelo no entrenado"):
            pipeline.predict_material_clusters([{"codigo": "TEST"}])


class TestClusteringSolicitudClusters:
    """Tests para clustering de solicitudes."""

    @pytest.fixture
    def sample_solicitudes(self):
        """Datos de solicitudes de prueba."""
        return [
            {"id": 1, "sector": "Produccion", "criticidad": "Alta", "total_monto": 5000, "data_json": {"items": [1, 2, 3]}},
            {"id": 2, "sector": "Produccion", "criticidad": "Alta", "total_monto": 4500, "data_json": {"items": [1, 2]}},
            {"id": 3, "sector": "Mantenimiento", "criticidad": "Normal", "total_monto": 500, "data_json": {"items": [1]}},
            {"id": 4, "sector": "Mantenimiento", "criticidad": "Normal", "total_monto": 600, "data_json": {"items": [1]}},
            {"id": 5, "sector": "Logistica", "criticidad": "Alta", "total_monto": 10000, "data_json": {"items": [1, 2, 3, 4, 5]}},
        ]

    def test_fit_solicitud_clusters_success(self, sample_solicitudes):
        """Entrena clustering con solicitudes validas."""
        from backend.agent.pipelines.clustering import ClusteringPipeline

        pipeline = ClusteringPipeline(n_clusters=2)
        result = pipeline.fit_solicitud_clusters(sample_solicitudes)

        assert result["status"] == "fitted"
        assert result["n_clusters"] == 2
        assert result["n_solicitudes"] == 5
        assert "silhouette_score" in result

    def test_fit_solicitud_clusters_insufficient(self):
        """Falla con menos de 3 solicitudes."""
        from backend.agent.pipelines.clustering import ClusteringPipeline

        pipeline = ClusteringPipeline()

        with pytest.raises(ValueError, match="al menos 3 solicitudes"):
            pipeline.fit_solicitud_clusters([{"id": 1}, {"id": 2}])


class TestClusteringUtilities:
    """Tests para utilidades del pipeline."""

    def test_get_status_unfitted(self):
        """Status muestra modelo no entrenado."""
        from backend.agent.pipelines.clustering import ClusteringPipeline

        pipeline = ClusteringPipeline()
        status = pipeline.get_status()

        assert status["is_fitted"] is False
        assert status["silhouette_score"] is None

    def test_get_status_fitted(self):
        """Status muestra modelo entrenado."""
        from backend.agent.pipelines.clustering import ClusteringPipeline

        pipeline = ClusteringPipeline(n_clusters=2)
        materials = [
            {"codigo": f"MAT{i}", "descripcion": f"Material {i}", "precio_usd": i * 100}
            for i in range(5)
        ]
        pipeline.fit_material_clusters(materials)

        status = pipeline.get_status()

        assert status["is_fitted"] is True
        assert status["silhouette_score"] is not None
        assert status["cluster_centers"] is not None

    def test_reset_pipeline(self):
        """Resetea el pipeline a estado inicial."""
        from backend.agent.pipelines.clustering import ClusteringPipeline

        pipeline = ClusteringPipeline(n_clusters=2)
        materials = [
            {"codigo": f"MAT{i}", "descripcion": f"Material {i}", "precio_usd": i * 100}
            for i in range(5)
        ]
        pipeline.fit_material_clusters(materials)

        pipeline.reset()

        assert pipeline.model is None
        assert pipeline.cluster_centers is None
        assert pipeline.silhouette is None


# ============================================================================
# Tests para ScoringPipeline
# ============================================================================

class TestScoringPipelineInit:
    """Tests de inicializacion del pipeline de scoring."""

    def test_init_default_weights(self):
        """Verifica pesos por defecto."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()

        assert "criticidad" in pipeline.weights
        assert "fecha_urgencia" in pipeline.weights
        assert "monto" in pipeline.weights
        assert abs(sum(pipeline.weights.values()) - 1.0) < 0.01


class TestScoringScoreSolicitud:
    """Tests para scoring de solicitudes."""

    def test_score_solicitud_critica(self):
        """Solicitud critica tiene score alto."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        solicitud = {
            "id": 1,
            "criticidad": "Alta",
            "fecha_necesidad": (datetime.now() + timedelta(days=1)).isoformat(),
            "total_monto": 50000,
            "data_json": {"items": [1, 2, 3, 4, 5]}
        }

        result = pipeline.score_solicitud(solicitud)

        assert result["solicitud_id"] == 1
        assert result["total_score"] > 0.5
        assert result["priority_level"] in ["crítica", "alta"]
        assert result["scores"]["criticidad"] == 1.0

    def test_score_solicitud_normal(self):
        """Solicitud normal tiene score medio."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        solicitud = {
            "id": 2,
            "criticidad": "Normal",
            "fecha_necesidad": (datetime.now() + timedelta(days=30)).isoformat(),
            "total_monto": 1000,
            "data_json": {"items": [1]}
        }

        result = pipeline.score_solicitud(solicitud)

        assert result["scores"]["criticidad"] == 0.5
        assert result["priority_level"] in ["media", "baja"]

    def test_score_solicitud_urgencia_vencida(self):
        """Solicitud con fecha vencida tiene urgencia maxima."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        solicitud = {
            "id": 3,
            "criticidad": "Normal",
            "fecha_necesidad": (datetime.now() - timedelta(days=5)).isoformat(),
            "total_monto": 1000,
            "data_json": {"items": [1]}
        }

        result = pipeline.score_solicitud(solicitud)

        assert result["scores"]["fecha_urgencia"] == 1.0  # Urgente

    def test_score_solicitud_con_presupuesto_insuficiente(self):
        """Ajusta score si presupuesto es insuficiente."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        solicitud = {
            "id": 4,
            "criticidad": "Alta",
            "total_monto": 50000,
            "data_json": {"items": [1]}
        }

        result = pipeline.score_solicitud(solicitud, presupuesto_disponible=10000)

        assert result["puede_procesarse"] is False
        assert result["presupuesto_ajuste"] == -0.2

    def test_score_solicitud_con_presupuesto_suficiente(self):
        """No penaliza si presupuesto es suficiente."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        solicitud = {
            "id": 5,
            "criticidad": "Normal",
            "total_monto": 5000,
            "data_json": {"items": [1]}
        }

        result = pipeline.score_solicitud(solicitud, presupuesto_disponible=10000)

        assert result["puede_procesarse"] is True
        assert "presupuesto_ajuste" not in result


class TestScoringScoreMaterial:
    """Tests para scoring de materiales."""

    def test_score_material_alta_demanda(self):
        """Material con alta demanda tiene score alto."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        material = {
            "codigo": "MAT001",
            "descripcion": "Valvula critica",
            "precio_usd": 500
        }

        result = pipeline.score_material(
            material,
            demanda_historica=800,
            disponibilidad=1.0,
            tiempo_entrega_dias=3
        )

        assert result["material_codigo"] == "MAT001"
        assert result["total_score"] > 0.5
        assert result["scores"]["demanda"] == 0.8

    def test_score_material_baja_disponibilidad(self):
        """Material con baja disponibilidad afecta score."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        material = {"codigo": "MAT002", "descripcion": "Test", "precio_usd": 100}

        result = pipeline.score_material(
            material,
            demanda_historica=100,
            disponibilidad=0.2,
            tiempo_entrega_dias=20
        )

        assert result["scores"]["disponibilidad"] == 0.2

    def test_score_material_recomendacion(self):
        """Genera recomendacion basada en score."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        material = {"codigo": "MAT003", "descripcion": "Test", "precio_usd": 50}

        result = pipeline.score_material(
            material,
            demanda_historica=900,
            disponibilidad=0.9,
            tiempo_entrega_dias=2
        )

        assert "recomendacion" in result
        assert result["priority"] in ["crítica", "alta", "media", "baja"]


class TestScoringRanking:
    """Tests para ranking de solicitudes y materiales."""

    @pytest.fixture
    def sample_solicitudes(self):
        """Solicitudes de prueba para ranking."""
        return [
            {"id": 1, "criticidad": "Normal", "total_monto": 1000, "data_json": {"items": [1]}},
            {"id": 2, "criticidad": "Alta", "total_monto": 50000, "data_json": {"items": [1, 2, 3]}},
            {"id": 3, "criticidad": "Normal", "total_monto": 500, "data_json": {"items": [1]}},
        ]

    def test_rank_solicitudes(self, sample_solicitudes):
        """Rankea solicitudes por prioridad."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        result = pipeline.rank_solicitudes(sample_solicitudes)

        assert result["total_solicitudes"] == 3
        assert len(result["solicitudes_rankeadas"]) == 3
        assert result["solicitudes_rankeadas"][0]["rank"] == 1
        # La solicitud critica (id=2) debe estar arriba
        assert result["solicitudes_rankeadas"][0]["solicitud_id"] == 2

    def test_rank_materiales(self):
        """Rankea materiales por prioridad."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        materiales = [
            {"codigo": "MAT001", "descripcion": "Barato", "precio_usd": 10},
            {"codigo": "MAT002", "descripcion": "Caro", "precio_usd": 9000},
            {"codigo": "MAT003", "descripcion": "Medio", "precio_usd": 500},
        ]

        result = pipeline.rank_materiales(materiales)

        assert result["total_materiales"] == 3
        assert len(result["materiales_rankeados"]) == 3
        assert result["materiales_rankeados"][0]["rank"] == 1

    def test_get_next_priority_solicitud(self, sample_solicitudes):
        """Obtiene la siguiente solicitud a procesar."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        result = pipeline.get_next_priority_solicitud(sample_solicitudes)

        assert result is not None
        assert result["rank"] == 1

    def test_get_next_priority_empty_list(self):
        """Retorna None si no hay solicitudes."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        result = pipeline.get_next_priority_solicitud([])

        assert result is None


class TestScoringConfiguration:
    """Tests para configuracion de pesos."""

    def test_configure_weights_valid(self):
        """Configura pesos validos."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        new_weights = {
            "criticidad": 0.4,
            "fecha_urgencia": 0.3,
            "monto": 0.15,
            "complejidad": 0.1,
            "impacto": 0.05
        }

        result = pipeline.configure_weights(new_weights)

        assert result["status"] == "configurado"
        assert pipeline.weights["criticidad"] == 0.4

    def test_configure_weights_invalid_sum(self):
        """Rechaza pesos que no suman ~1.0."""
        from backend.agent.pipelines.scoring import ScoringPipeline

        pipeline = ScoringPipeline()
        invalid_weights = {"criticidad": 0.5, "monto": 0.1}  # Suma 0.6

        with pytest.raises(ValueError, match="deben sumar"):
            pipeline.configure_weights(invalid_weights)


# ============================================================================
# Tests para DemandForecastPipeline
# ============================================================================

class TestDemandForecastInit:
    """Tests de inicializacion del pipeline de forecast."""

    def test_init_default_window(self):
        """Verifica ventana historica por defecto."""
        from backend.agent.pipelines.demand_forecast import DemandForecastPipeline

        pipeline = DemandForecastPipeline()

        assert pipeline.historical_window_days == 90
        assert pipeline.model is None
        assert pipeline.last_fit_date is None

    def test_init_custom_window(self):
        """Permite ventana historica personalizada."""
        from backend.agent.pipelines.demand_forecast import DemandForecastPipeline

        pipeline = DemandForecastPipeline(historical_window_days=180)

        assert pipeline.historical_window_days == 180


class TestDemandForecastFit:
    """Tests para entrenamiento del modelo de forecast."""

    @pytest.fixture
    def sample_historical_data(self):
        """Datos historicos de prueba - requiere al menos 5 grupos (material/centro) con 3+ registros."""
        base_date = datetime.now() - timedelta(days=60)
        data = []
        # Crear al menos 5 grupos distintos con 5+ registros cada uno
        # Pipeline agrupa por (material_codigo, centro) y requiere >= 3 por grupo
        # Luego valida que haya al menos 5 features (grupos) despues del preprocesamiento
        for material in ["MAT001", "MAT002", "MAT003", "MAT004", "MAT005", "MAT006"]:
            for i in range(5):  # 5 registros por material
                data.append({
                    "created_at": (base_date + timedelta(days=i * 3)).isoformat(),
                    "material_codigo": material,
                    "centro": "1000",
                    "total_monto": 1000 + (i * 100)
                })
        return data

    def test_fit_success(self, sample_historical_data):
        """Entrena modelo con datos suficientes."""
        from backend.agent.pipelines.demand_forecast import DemandForecastPipeline

        pipeline = DemandForecastPipeline()
        result = pipeline.fit(sample_historical_data)

        assert result["status"] == "fitted"
        assert result["n_samples"] >= 1
        assert "train_score" in result
        assert "feature_importance" in result
        assert pipeline.model is not None

    def test_fit_insufficient_data(self):
        """Falla con menos de 10 registros."""
        from backend.agent.pipelines.demand_forecast import DemandForecastPipeline

        pipeline = DemandForecastPipeline()
        few_records = [
            {"created_at": datetime.now().isoformat(), "material_codigo": "MAT001", "centro": "1000", "total_monto": 100}
            for _ in range(5)
        ]

        with pytest.raises(ValueError, match="al menos 10 registros"):
            pipeline.fit(few_records)


class TestDemandForecastPredict:
    """Tests para prediccion de demanda."""

    @pytest.fixture
    def trained_pipeline(self):
        """Pipeline entrenado para tests."""
        from backend.agent.pipelines.demand_forecast import DemandForecastPipeline

        pipeline = DemandForecastPipeline()

        # Crear datos de entrenamiento - al menos 5 grupos con 3+ registros
        base_date = datetime.now() - timedelta(days=60)
        data = []
        for material in ["MAT001", "MAT002", "MAT003", "MAT004", "MAT005", "MAT006"]:
            for i in range(5):
                data.append({
                    "created_at": (base_date + timedelta(days=i * 3)).isoformat(),
                    "material_codigo": material,
                    "centro": "1000",
                    "total_monto": 1000 + (i * 100)
                })

        pipeline.fit(data)
        return pipeline

    def test_predict_single_material(self, trained_pipeline):
        """Predice demanda para un material."""
        result = trained_pipeline.predict(
            material_codigo="MAT001",
            centro="1000",
            days_ahead=30
        )

        assert result["material_codigo"] == "MAT001"
        assert result["centro"] == "1000"
        assert result["days_ahead"] == 30
        assert "predicted_demand" in result
        assert "confidence_lower" in result
        assert "confidence_upper" in result
        assert result["confidence_lower"] <= result["predicted_demand"] <= result["confidence_upper"]

    def test_predict_without_fit_fails(self):
        """Falla si modelo no esta entrenado."""
        from backend.agent.pipelines.demand_forecast import DemandForecastPipeline

        pipeline = DemandForecastPipeline()

        with pytest.raises(ValueError, match="Modelo no entrenado"):
            pipeline.predict("MAT001", "1000", 30)

    def test_predict_confidence_level(self, trained_pipeline):
        """Respeta nivel de confianza especificado."""
        result_95 = trained_pipeline.predict("MAT001", "1000", 30, confidence_level=0.95)
        result_99 = trained_pipeline.predict("MAT001", "1000", 30, confidence_level=0.99)

        # Mayor confianza = intervalo mas amplio
        interval_95 = result_95["confidence_upper"] - result_95["confidence_lower"]
        interval_99 = result_99["confidence_upper"] - result_99["confidence_lower"]

        assert interval_99 >= interval_95


class TestDemandForecastMultiple:
    """Tests para forecast de multiples materiales."""

    @pytest.fixture
    def trained_pipeline(self):
        """Pipeline entrenado para tests."""
        from backend.agent.pipelines.demand_forecast import DemandForecastPipeline

        pipeline = DemandForecastPipeline()
        base_date = datetime.now() - timedelta(days=60)
        data = []
        for material in ["MAT001", "MAT002", "MAT003", "MAT004", "MAT005", "MAT006"]:
            for i in range(5):
                data.append({
                    "created_at": (base_date + timedelta(days=i * 3)).isoformat(),
                    "material_codigo": material,
                    "centro": "1000",
                    "total_monto": 1000 + (i * 100)
                })
        pipeline.fit(data)
        return pipeline

    def test_forecast_multiple_materials(self, trained_pipeline):
        """Forecast para multiples materiales."""
        materials = [
            {"material_codigo": "MAT001", "centro": "1000"},
            {"material_codigo": "MAT002", "centro": "1000"},
            {"material_codigo": "MAT003", "centro": "2000"},
        ]

        result = trained_pipeline.forecast_multiple(materials, days_ahead=60)

        assert result["n_forecasts"] == 3
        assert result["days_ahead"] == 60
        assert len(result["forecasts"]) == 3
        assert "generated_at" in result


class TestDemandForecastStatus:
    """Tests para estado del pipeline."""

    def test_get_status_unfitted(self):
        """Status de pipeline no entrenado."""
        from backend.agent.pipelines.demand_forecast import DemandForecastPipeline

        pipeline = DemandForecastPipeline()
        status = pipeline.get_status()

        assert status["is_fitted"] is False
        assert status["last_fit_date"] is None
        assert status["historical_window_days"] == 90

    def test_get_status_fitted(self):
        """Status de pipeline entrenado."""
        from backend.agent.pipelines.demand_forecast import DemandForecastPipeline

        pipeline = DemandForecastPipeline()
        base_date = datetime.now() - timedelta(days=60)
        data = []
        for material in ["MAT001", "MAT002", "MAT003", "MAT004", "MAT005", "MAT006"]:
            for i in range(5):
                data.append({
                    "created_at": (base_date + timedelta(days=i * 3)).isoformat(),
                    "material_codigo": material,
                    "centro": "1000",
                    "total_monto": 1000 + (i * 100)
                })
        pipeline.fit(data)

        status = pipeline.get_status()

        assert status["is_fitted"] is True
        assert status["last_fit_date"] is not None
        assert len(status["feature_names"]) > 0


# ============================================================================
# Tests de Integracion entre Pipelines
# ============================================================================

class TestPipelineIntegration:
    """Tests de integracion entre los tres pipelines."""

    def test_clustering_then_scoring(self):
        """Clustering seguido de scoring de clusters."""
        from backend.agent.pipelines.clustering import ClusteringPipeline
        from backend.agent.pipelines.scoring import ScoringPipeline

        # Crear materiales
        materials = [
            {"codigo": f"MAT{i}", "descripcion": f"Material {i}", "precio_usd": i * 100}
            for i in range(1, 6)
        ]

        # Clustering
        cluster_pipeline = ClusteringPipeline(n_clusters=2)
        cluster_result = cluster_pipeline.fit_material_clusters(materials)

        assert cluster_result["status"] == "fitted"

        # Scoring de materiales
        scoring_pipeline = ScoringPipeline()
        ranking = scoring_pipeline.rank_materiales(materials)

        assert ranking["total_materiales"] == 5
        assert ranking["materiales_rankeados"][0]["rank"] == 1

    def test_forecast_informs_scoring(self):
        """Forecast alimenta scoring de materiales."""
        from backend.agent.pipelines.demand_forecast import DemandForecastPipeline
        from backend.agent.pipelines.scoring import ScoringPipeline

        # Entrenar forecast con al menos 5 grupos de 3+ registros
        forecast_pipeline = DemandForecastPipeline()
        base_date = datetime.now() - timedelta(days=60)
        historical_data = []
        for material in ["MAT001", "MAT002", "MAT003", "MAT004", "MAT005", "MAT006"]:
            for i in range(5):
                historical_data.append({
                    "created_at": (base_date + timedelta(days=i * 3)).isoformat(),
                    "material_codigo": material,
                    "centro": "1000",
                    "total_monto": 1000 + (i * 50)
                })
        forecast_pipeline.fit(historical_data)

        # Obtener forecast
        forecast = forecast_pipeline.predict("MAT001", "1000", 30)

        # Usar demanda proyectada para scoring
        scoring_pipeline = ScoringPipeline()
        material = {"codigo": "MAT001", "descripcion": "Test", "precio_usd": 500}

        score_result = scoring_pipeline.score_material(
            material,
            demanda_historica=forecast["predicted_demand"],
            disponibilidad=0.8
        )

        assert score_result["scores"]["demanda"] >= 0

    def test_all_pipelines_status(self):
        """Verifica status de todos los pipelines."""
        from backend.agent.pipelines.clustering import ClusteringPipeline
        from backend.agent.pipelines.scoring import ScoringPipeline
        from backend.agent.pipelines.demand_forecast import DemandForecastPipeline

        clustering = ClusteringPipeline()
        scoring = ScoringPipeline()
        forecast = DemandForecastPipeline()

        # Status inicial
        assert clustering.get_status()["is_fitted"] is False
        assert scoring.get_status()["version"] == "1.0"
        assert forecast.get_status()["is_fitted"] is False
