"""
Tests unitarios para ScoringPipeline
backend_v2/agent/pipelines/scoring.py

Generado por Sugar Autonomous System
"""

import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend_v2.agent.pipelines.scoring import ScoringPipeline


class TestScoringInitialization:
    """Tests para inicialización del pipeline"""

    def test_init_has_weights(self):
        """Pipeline debe tener pesos por defecto"""
        pipeline = ScoringPipeline()
        assert pipeline.weights is not None
        assert len(pipeline.weights) > 0

    def test_init_has_material_weights(self):
        """Pipeline debe tener pesos de materiales"""
        pipeline = ScoringPipeline()
        assert pipeline.material_weights is not None
        assert len(pipeline.material_weights) > 0

    def test_weights_sum_to_one(self):
        """Los pesos deben sumar aproximadamente 1.0"""
        pipeline = ScoringPipeline()
        total = sum(pipeline.weights.values())
        assert 0.9 <= total <= 1.1

    def test_material_weights_sum_to_one(self):
        """Los pesos de materiales deben sumar aproximadamente 1.0"""
        pipeline = ScoringPipeline()
        total = sum(pipeline.material_weights.values())
        assert 0.9 <= total <= 1.1


class TestSolicitudScoring:
    """Tests para score_solicitud"""

    @pytest.fixture
    def pipeline(self):
        return ScoringPipeline()

    @pytest.fixture
    def sample_solicitud(self):
        return {
            "id": 1,
            "criticidad": "Alta",
            "fecha_necesidad": (datetime.now() + timedelta(days=5)).isoformat(),
            "total_monto": 5000.0,
            "data_json": {"items": [{"codigo": f"M{i}"} for i in range(5)]},
        }

    def test_score_solicitud_returns_dict(self, pipeline, sample_solicitud):
        """score_solicitud debe retornar diccionario"""
        result = pipeline.score_solicitud(sample_solicitud)
        assert isinstance(result, dict)

    def test_score_solicitud_has_total_score(self, pipeline, sample_solicitud):
        """Resultado debe tener total_score"""
        result = pipeline.score_solicitud(sample_solicitud)
        assert "total_score" in result
        assert isinstance(result["total_score"], float)

    def test_score_solicitud_has_priority_level(self, pipeline, sample_solicitud):
        """Resultado debe tener priority_level"""
        result = pipeline.score_solicitud(sample_solicitud)
        assert "priority_level" in result
        assert result["priority_level"] in ["crítica", "alta", "media", "baja"]

    def test_high_criticality_increases_score(self, pipeline):
        """Criticidad alta debe aumentar score"""
        alta = {"criticidad": "Alta", "total_monto": 100, "data_json": {"items": []}}
        normal = {"criticidad": "Normal", "total_monto": 100, "data_json": {"items": []}}

        score_alta = pipeline.score_solicitud(alta)["total_score"]
        score_normal = pipeline.score_solicitud(normal)["total_score"]

        assert score_alta > score_normal

    def test_urgent_date_increases_score(self, pipeline):
        """Fecha urgente debe aumentar score"""
        urgent = {
            "criticidad": "Normal",
            "fecha_necesidad": (datetime.now() + timedelta(days=1)).isoformat(),
            "total_monto": 100,
            "data_json": {"items": []},
        }
        not_urgent = {
            "criticidad": "Normal",
            "fecha_necesidad": (datetime.now() + timedelta(days=60)).isoformat(),
            "total_monto": 100,
            "data_json": {"items": []},
        }

        score_urgent = pipeline.score_solicitud(urgent)["total_score"]
        score_not_urgent = pipeline.score_solicitud(not_urgent)["total_score"]

        assert score_urgent > score_not_urgent

    def test_presupuesto_check(self, pipeline, sample_solicitud):
        """Debe verificar presupuesto si se proporciona"""
        # Con presupuesto suficiente
        result = pipeline.score_solicitud(sample_solicitud, presupuesto_disponible=10000)
        assert result.get("puede_procesarse") == True

        # Con presupuesto insuficiente
        result = pipeline.score_solicitud(sample_solicitud, presupuesto_disponible=100)
        assert result.get("puede_procesarse") == False


class TestMaterialScoring:
    """Tests para score_material"""

    @pytest.fixture
    def pipeline(self):
        return ScoringPipeline()

    @pytest.fixture
    def sample_material(self):
        return {"codigo": "MAT001", "descripcion": "Material de prueba", "precio_usd": 500.0}

    def test_score_material_returns_dict(self, pipeline, sample_material):
        """score_material debe retornar diccionario"""
        result = pipeline.score_material(sample_material)
        assert isinstance(result, dict)

    def test_score_material_has_total_score(self, pipeline, sample_material):
        """Resultado debe tener total_score"""
        result = pipeline.score_material(sample_material)
        assert "total_score" in result
        assert 0.0 <= result["total_score"] <= 1.0

    def test_score_material_has_recommendation(self, pipeline, sample_material):
        """Resultado debe tener recomendación"""
        result = pipeline.score_material(sample_material)
        assert "recomendacion" in result
        assert isinstance(result["recomendacion"], str)

    def test_high_demand_increases_score(self, pipeline, sample_material):
        """Alta demanda debe aumentar score"""
        score_high = pipeline.score_material(sample_material, demanda_historica=900)
        score_low = pipeline.score_material(sample_material, demanda_historica=10)

        assert score_high["total_score"] > score_low["total_score"]

    def test_low_price_increases_score(self, pipeline):
        """Precio bajo debe aumentar score (costo inverso)"""
        cheap = {"codigo": "M1", "precio_usd": 10}
        expensive = {"codigo": "M2", "precio_usd": 9000}

        score_cheap = pipeline.score_material(cheap)
        score_expensive = pipeline.score_material(expensive)

        assert score_cheap["total_score"] > score_expensive["total_score"]


class TestRankingSolicitudes:
    """Tests para rank_solicitudes"""

    @pytest.fixture
    def pipeline(self):
        return ScoringPipeline()

    @pytest.fixture
    def sample_solicitudes(self):
        base = datetime.now()
        return [
            {
                "id": 1,
                "criticidad": "Alta",
                "total_monto": 1000,
                "fecha_necesidad": (base + timedelta(days=2)).isoformat(),
                "data_json": {"items": []},
            },
            {
                "id": 2,
                "criticidad": "Normal",
                "total_monto": 500,
                "fecha_necesidad": (base + timedelta(days=30)).isoformat(),
                "data_json": {"items": []},
            },
            {
                "id": 3,
                "criticidad": "Alta",
                "total_monto": 2000,
                "fecha_necesidad": (base + timedelta(days=1)).isoformat(),
                "data_json": {"items": []},
            },
        ]

    def test_rank_returns_dict(self, pipeline, sample_solicitudes):
        """rank_solicitudes debe retornar diccionario"""
        result = pipeline.rank_solicitudes(sample_solicitudes)
        assert isinstance(result, dict)

    def test_rank_contains_ranked_list(self, pipeline, sample_solicitudes):
        """Resultado debe contener lista rankeada"""
        result = pipeline.rank_solicitudes(sample_solicitudes)
        assert "solicitudes_rankeadas" in result
        assert len(result["solicitudes_rankeadas"]) == 3

    def test_rank_assigns_positions(self, pipeline, sample_solicitudes):
        """Cada solicitud debe tener rank"""
        result = pipeline.rank_solicitudes(sample_solicitudes)
        for solicitud in result["solicitudes_rankeadas"]:
            assert "rank" in solicitud

    def test_rank_ordered_by_score(self, pipeline, sample_solicitudes):
        """Lista debe estar ordenada por score descendente"""
        result = pipeline.rank_solicitudes(sample_solicitudes)
        scores = [s["total_score"] for s in result["solicitudes_rankeadas"]]
        assert scores == sorted(scores, reverse=True)

    def test_most_urgent_first(self, pipeline, sample_solicitudes):
        """Solicitud más urgente debe estar primero"""
        result = pipeline.rank_solicitudes(sample_solicitudes)
        # Solicitud 3 es la más urgente (1 día, Alta, alto monto)
        first = result["solicitudes_rankeadas"][0]
        assert first["solicitud_id"] == 3


class TestRankingMateriales:
    """Tests para rank_materiales"""

    @pytest.fixture
    def pipeline(self):
        return ScoringPipeline()

    @pytest.fixture
    def sample_materiales(self):
        return [
            {"codigo": "M1", "descripcion": "Mat 1", "precio_usd": 100},
            {"codigo": "M2", "descripcion": "Mat 2", "precio_usd": 5000},
            {"codigo": "M3", "descripcion": "Mat 3", "precio_usd": 50},
        ]

    def test_rank_materiales_returns_dict(self, pipeline, sample_materiales):
        """rank_materiales debe retornar diccionario"""
        result = pipeline.rank_materiales(sample_materiales)
        assert isinstance(result, dict)

    def test_rank_materiales_has_list(self, pipeline, sample_materiales):
        """Resultado debe contener lista rankeada"""
        result = pipeline.rank_materiales(sample_materiales)
        assert "materiales_rankeados" in result
        assert len(result["materiales_rankeados"]) == 3


class TestNextPrioritySolicitud:
    """Tests para get_next_priority_solicitud"""

    @pytest.fixture
    def pipeline(self):
        return ScoringPipeline()

    def test_returns_highest_priority(self, pipeline):
        """Debe retornar solicitud de mayor prioridad"""
        solicitudes = [
            {"id": 1, "criticidad": "Normal", "total_monto": 100, "data_json": {"items": []}},
            {
                "id": 2,
                "criticidad": "Alta",
                "total_monto": 5000,
                "fecha_necesidad": datetime.now().isoformat(),
                "data_json": {"items": []},
            },
        ]
        result = pipeline.get_next_priority_solicitud(solicitudes)
        assert result is not None
        assert result["solicitud_id"] == 2

    def test_empty_list_returns_none(self, pipeline):
        """Lista vacía debe retornar None"""
        result = pipeline.get_next_priority_solicitud([])
        assert result is None


class TestUrgencyScore:
    """Tests para _urgency_score"""

    @pytest.fixture
    def pipeline(self):
        return ScoringPipeline()

    def test_past_due_is_max(self, pipeline):
        """Fecha pasada debe tener score máximo"""
        score = pipeline._urgency_score(-5)
        assert score == 1.0

    def test_same_day_is_max(self, pipeline):
        """Mismo día debe tener score máximo"""
        score = pipeline._urgency_score(0)
        assert score == 1.0

    def test_score_decreases_with_time(self, pipeline):
        """Score debe disminuir con más días"""
        score_3 = pipeline._urgency_score(3)
        score_7 = pipeline._urgency_score(7)
        score_30 = pipeline._urgency_score(30)
        score_60 = pipeline._urgency_score(60)

        assert score_3 > score_7
        assert score_7 > score_30
        assert score_30 > score_60


class TestPriorityLevel:
    """Tests para _get_priority_level"""

    @pytest.fixture
    def pipeline(self):
        return ScoringPipeline()

    def test_high_score_is_critical(self, pipeline):
        """Score alto debe ser crítico"""
        assert pipeline._get_priority_level(0.9) == "crítica"

    def test_medium_high_is_alta(self, pipeline):
        """Score medio-alto debe ser alta"""
        assert pipeline._get_priority_level(0.7) == "alta"

    def test_medium_is_media(self, pipeline):
        """Score medio debe ser media"""
        assert pipeline._get_priority_level(0.5) == "media"

    def test_low_is_baja(self, pipeline):
        """Score bajo debe ser baja"""
        assert pipeline._get_priority_level(0.2) == "baja"


class TestConfigureWeights:
    """Tests para configure_weights"""

    @pytest.fixture
    def pipeline(self):
        return ScoringPipeline()

    def test_configure_updates_weights(self, pipeline):
        """configure_weights debe actualizar pesos"""
        new_weights = {
            "criticidad": 0.5,
            "fecha_urgencia": 0.2,
            "monto": 0.1,
            "complejidad": 0.1,
            "impacto": 0.1,
        }
        result = pipeline.configure_weights(new_weights)
        assert result["weights"]["criticidad"] == 0.5

    def test_configure_validates_sum(self, pipeline):
        """configure_weights debe validar que sumen ~1.0"""
        bad_weights = {
            "criticidad": 0.9,
            "fecha_urgencia": 0.9,
            "monto": 0.9,
            "complejidad": 0.9,
            "impacto": 0.9,
        }
        with pytest.raises(ValueError, match="sumar"):
            pipeline.configure_weights(bad_weights)


class TestGetStatus:
    """Tests para get_status"""

    def test_returns_dict(self):
        """get_status debe retornar diccionario"""
        pipeline = ScoringPipeline()
        status = pipeline.get_status()
        assert isinstance(status, dict)

    def test_contains_weights(self):
        """Status debe contener pesos"""
        pipeline = ScoringPipeline()
        status = pipeline.get_status()
        assert "weights" in status
        assert "material_weights" in status


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
