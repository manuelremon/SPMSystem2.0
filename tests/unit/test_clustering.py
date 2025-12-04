"""
Tests unitarios para ClusteringPipeline
backend_v2/agent/pipelines/clustering.py

Generado por Sugar Autonomous System
"""

import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend_v2.agent.pipelines.clustering import ClusteringPipeline


class TestClusteringInitialization:
    """Tests para inicialización del pipeline"""

    def test_init_default_clusters(self):
        """Pipeline debe inicializar con n_clusters=None (auto)"""
        pipeline = ClusteringPipeline()
        assert pipeline.n_clusters is None

    def test_init_custom_clusters(self):
        """Pipeline debe aceptar n_clusters personalizado"""
        pipeline = ClusteringPipeline(n_clusters=5)
        assert pipeline.n_clusters == 5

    def test_init_max_clusters(self):
        """Pipeline debe tener max_clusters por defecto"""
        pipeline = ClusteringPipeline()
        assert pipeline.max_clusters == 10

    def test_init_model_is_none(self):
        """Modelo debe ser None al inicializar"""
        pipeline = ClusteringPipeline()
        assert pipeline.model is None

    def test_init_silhouette_is_none(self):
        """Silhouette score debe ser None al inicializar"""
        pipeline = ClusteringPipeline()
        assert pipeline.silhouette is None


class TestClusteringMaterials:
    """Tests para clustering de materiales"""

    @pytest.fixture
    def sample_materials(self):
        """Genera datos de materiales de prueba"""
        return [
            {
                "codigo": f"MAT{i:03d}",
                "descripcion": f"Material {i}",
                "precio_usd": 10.0 + i * 5,
                "activo": True,
                "unidad": "UNI",
            }
            for i in range(15)
        ]

    @pytest.fixture
    def pipeline(self):
        return ClusteringPipeline(n_clusters=3)

    def test_fit_material_clusters_returns_dict(self, pipeline, sample_materials):
        """fit_material_clusters debe retornar diccionario"""
        result = pipeline.fit_material_clusters(sample_materials)
        assert isinstance(result, dict)
        assert "status" in result

    def test_fit_material_clusters_sets_model(self, pipeline, sample_materials):
        """fit_material_clusters debe establecer modelo"""
        pipeline.fit_material_clusters(sample_materials)
        assert pipeline.model is not None

    def test_fit_material_clusters_calculates_silhouette(self, pipeline, sample_materials):
        """fit_material_clusters debe calcular silhouette score"""
        result = pipeline.fit_material_clusters(sample_materials)
        assert "silhouette_score" in result
        assert -1.0 <= result["silhouette_score"] <= 1.0

    def test_fit_material_clusters_respects_n_clusters(self, sample_materials):
        """Debe respetar n_clusters especificado"""
        pipeline = ClusteringPipeline(n_clusters=4)
        result = pipeline.fit_material_clusters(sample_materials)
        assert result["n_clusters"] == 4

    def test_fit_material_clusters_requires_minimum(self):
        """Debe requerir mínimo 3 materiales"""
        pipeline = ClusteringPipeline()
        small_data = [{"codigo": "M1", "descripcion": "Mat1", "precio_usd": 10}]
        with pytest.raises(ValueError, match="al menos 3 materiales"):
            pipeline.fit_material_clusters(small_data)


class TestClusteringPredictMaterials:
    """Tests para predicción de clusters de materiales"""

    @pytest.fixture
    def trained_pipeline(self):
        """Pipeline entrenado"""
        pipeline = ClusteringPipeline(n_clusters=3)
        materials = [
            {
                "codigo": f"MAT{i:03d}",
                "descripcion": f"Material {i}",
                "precio_usd": 10.0 + i * 5,
                "activo": True,
                "unidad": "UNI",
            }
            for i in range(15)
        ]
        pipeline.fit_material_clusters(materials)
        return pipeline

    def test_predict_returns_dict(self, trained_pipeline):
        """predict_material_clusters debe retornar diccionario"""
        materials = [{"codigo": "NEW01", "descripcion": "Nuevo", "precio_usd": 50, "unidad": "UNI"}]
        result = trained_pipeline.predict_material_clusters(materials)
        assert isinstance(result, dict)

    def test_predict_assigns_clusters(self, trained_pipeline):
        """predict debe asignar clusters a materiales"""
        materials = [
            {"codigo": "NEW01", "descripcion": "Nuevo 1", "precio_usd": 50, "unidad": "UNI"},
            {"codigo": "NEW02", "descripcion": "Nuevo 2", "precio_usd": 100, "unidad": "KG"},
        ]
        result = trained_pipeline.predict_material_clusters(materials)
        assert "clusters" in result
        assert result["total_materials"] == 2

    def test_predict_without_fit_raises(self):
        """predict sin fit debe lanzar error"""
        pipeline = ClusteringPipeline()
        with pytest.raises(ValueError, match="Modelo no entrenado"):
            pipeline.predict_material_clusters([{"codigo": "M1"}])


class TestClusteringSolicitudes:
    """Tests para clustering de solicitudes"""

    @pytest.fixture
    def sample_solicitudes(self):
        """Genera datos de solicitudes de prueba"""
        return [
            {
                "id": i,
                "data_json": {"items": [{"codigo": f"M{j}"} for j in range(i % 5 + 1)]},
                "total_monto": 100.0 * (i + 1),
                "criticidad": "Alta" if i % 2 == 0 else "Normal",
                "sector": f"Sector{i % 3}",
            }
            for i in range(12)
        ]

    @pytest.fixture
    def pipeline(self):
        return ClusteringPipeline(n_clusters=3)

    def test_fit_solicitud_clusters_returns_dict(self, pipeline, sample_solicitudes):
        """fit_solicitud_clusters debe retornar diccionario"""
        result = pipeline.fit_solicitud_clusters(sample_solicitudes)
        assert isinstance(result, dict)

    def test_fit_solicitud_clusters_sets_model(self, pipeline, sample_solicitudes):
        """fit_solicitud_clusters debe establecer modelo"""
        pipeline.fit_solicitud_clusters(sample_solicitudes)
        assert pipeline.model is not None

    def test_fit_solicitud_clusters_requires_minimum(self):
        """Debe requerir mínimo 3 solicitudes"""
        pipeline = ClusteringPipeline()
        small_data = [{"id": 1, "total_monto": 100}]
        with pytest.raises(ValueError, match="al menos 3 solicitudes"):
            pipeline.fit_solicitud_clusters(small_data)


class TestClusteringAutoK:
    """Tests para detección automática de número de clusters"""

    def test_find_optimal_clusters_returns_int(self):
        """_find_optimal_clusters debe retornar entero"""
        pipeline = ClusteringPipeline()
        # Crear datos con clusters claros
        X = np.vstack(
            [
                np.random.randn(10, 4) + [0, 0, 0, 0],
                np.random.randn(10, 4) + [5, 5, 5, 5],
                np.random.randn(10, 4) + [10, 10, 10, 10],
            ]
        )
        k = pipeline._find_optimal_clusters(X)
        assert isinstance(k, int)
        assert k >= 2

    def test_auto_clusters_respects_max(self):
        """Auto k debe respetar max_clusters"""
        pipeline = ClusteringPipeline(max_clusters=5)
        X = np.random.randn(20, 4)
        k = pipeline._find_optimal_clusters(X)
        assert k <= 5


class TestClusteringHelpers:
    """Tests para métodos auxiliares"""

    def test_get_status_not_fitted(self):
        """get_status debe indicar si no está entrenado"""
        pipeline = ClusteringPipeline()
        status = pipeline.get_status()
        assert status["is_fitted"] == False

    def test_get_status_fitted(self):
        """get_status debe indicar si está entrenado"""
        pipeline = ClusteringPipeline(n_clusters=3)
        materials = [
            {"codigo": f"M{i}", "descripcion": f"Mat{i}", "precio_usd": i * 10} for i in range(10)
        ]
        pipeline.fit_material_clusters(materials)
        status = pipeline.get_status()
        assert status["is_fitted"] == True

    def test_reset_clears_model(self):
        """reset debe limpiar el modelo"""
        pipeline = ClusteringPipeline(n_clusters=3)
        materials = [
            {"codigo": f"M{i}", "descripcion": f"Mat{i}", "precio_usd": i * 10} for i in range(10)
        ]
        pipeline.fit_material_clusters(materials)
        assert pipeline.model is not None

        pipeline.reset()
        assert pipeline.model is None
        assert pipeline.silhouette is None


class TestClusteringGroupSimilar:
    """Tests para group_similar_materials"""

    def test_group_similar_requires_fit(self):
        """group_similar_materials requiere modelo entrenado"""
        pipeline = ClusteringPipeline()
        with pytest.raises(ValueError, match="no entrenado"):
            pipeline.group_similar_materials("MAT001")

    def test_group_similar_returns_dict(self):
        """group_similar_materials debe retornar diccionario"""
        pipeline = ClusteringPipeline(n_clusters=3)
        materials = [
            {"codigo": f"M{i}", "descripcion": f"Mat{i}", "precio_usd": i * 10} for i in range(10)
        ]
        pipeline.fit_material_clusters(materials)
        result = pipeline.group_similar_materials("M001", similitud_minima=0.7)
        assert isinstance(result, dict)
        assert "material_referencia" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
