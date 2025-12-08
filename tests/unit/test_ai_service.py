"""
Tests TDD para el servicio unificado de IA.
Sprint 6.2 - Servicio que orquesta todos los pipelines ML.

El servicio unificado integra:
- ClusteringPipeline (agrupacion de materiales/solicitudes)
- ScoringPipeline (priorizacion)
- DemandForecastPipeline (prediccion de demanda)
- MRP Service (integracion con stock y alertas)
"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta


class TestAIServiceInit:
    """Tests de inicializacion del servicio IA."""

    def test_init_creates_pipelines(self):
        """Inicializa todos los pipelines ML."""
        from backend.services.ai_service import AIService

        service = AIService()

        assert service.clustering is not None
        assert service.scoring is not None
        assert service.forecast is not None
        assert service._pipelines_trained is False

    def test_get_status_initial(self):
        """Status inicial muestra pipelines no entrenados."""
        from backend.services.ai_service import AIService

        service = AIService()
        status = service.get_status()

        assert status["clustering"]["is_fitted"] is False
        assert status["scoring"]["version"] == "1.0"
        assert status["forecast"]["is_fitted"] is False


class TestAIServiceTraining:
    """Tests para entrenamiento de modelos."""

    @pytest.fixture
    def sample_training_data(self):
        """Datos de entrenamiento de prueba."""
        base_date = datetime.now() - timedelta(days=60)
        solicitudes = []
        for material in ["MAT001", "MAT002", "MAT003", "MAT004", "MAT005", "MAT006"]:
            for i in range(5):
                solicitudes.append({
                    "id": len(solicitudes) + 1,
                    "created_at": (base_date + timedelta(days=i * 3)).isoformat(),
                    "material_codigo": material,
                    "centro": "1000",
                    "sector": "Produccion",
                    "criticidad": "Alta" if i % 2 == 0 else "Normal",
                    "total_monto": 1000 + (i * 100),
                    "data_json": {"items": list(range(i + 1))}
                })
        return solicitudes

    @pytest.fixture
    def sample_materials(self):
        """Materiales de prueba."""
        return [
            {"codigo": f"MAT00{i}", "descripcion": f"Material {i}", "precio_usd": i * 100, "unidad": "PZ"}
            for i in range(1, 7)
        ]

    def test_train_all_pipelines(self, sample_training_data, sample_materials):
        """Entrena todos los pipelines con datos historicos."""
        from backend.services.ai_service import AIService

        service = AIService()
        result = service.train_pipelines(
            solicitudes_data=sample_training_data,
            materiales_data=sample_materials
        )

        assert result["status"] == "trained"
        assert result["clustering"]["status"] == "fitted"
        assert result["forecast"]["status"] == "fitted"
        assert service._pipelines_trained is True

    def test_train_insufficient_data(self):
        """Maneja graciosamente datos insuficientes."""
        from backend.services.ai_service import AIService

        service = AIService()
        result = service.train_pipelines(
            solicitudes_data=[{"id": 1}],  # Insuficiente
            materiales_data=[{"codigo": "MAT001"}]
        )

        # Cuando datos son insuficientes, pipelines se saltan
        assert result["clustering"]["status"] == "skipped"
        assert result["forecast"]["status"] == "skipped"
        assert result["status"] == "skipped"
        # No se marca como entrenado porque ambos fueron saltados
        assert service._pipelines_trained is False


class TestAIServiceRecommendations:
    """Tests para recomendaciones inteligentes."""

    @pytest.fixture
    def trained_service(self):
        """Servicio con pipelines entrenados."""
        from backend.services.ai_service import AIService

        service = AIService()
        base_date = datetime.now() - timedelta(days=60)
        solicitudes = []
        for material in ["MAT001", "MAT002", "MAT003", "MAT004", "MAT005", "MAT006"]:
            for i in range(5):
                solicitudes.append({
                    "id": len(solicitudes) + 1,
                    "created_at": (base_date + timedelta(days=i * 3)).isoformat(),
                    "material_codigo": material,
                    "centro": "1000",
                    "sector": "Produccion",
                    "criticidad": "Alta" if i % 2 == 0 else "Normal",
                    "total_monto": 1000 + (i * 100),
                    "data_json": {"items": list(range(i + 1))}
                })
        materials = [
            {"codigo": f"MAT00{i}", "descripcion": f"Material {i}", "precio_usd": i * 100, "unidad": "PZ"}
            for i in range(1, 7)
        ]
        service.train_pipelines(solicitudes, materials)
        return service

    def test_recomendar_materiales_similares(self, trained_service):
        """Recomienda materiales similares a uno dado."""
        result = trained_service.recomendar_materiales_similares(
            material_codigo="MAT001",
            centro="1000",
            max_resultados=5
        )

        assert "material_referencia" in result
        assert "similares" in result
        assert isinstance(result["similares"], list)

    def test_priorizar_solicitudes(self, trained_service):
        """Prioriza lista de solicitudes."""
        solicitudes = [
            {"id": 1, "criticidad": "Normal", "total_monto": 1000, "data_json": {"items": [1]}},
            {"id": 2, "criticidad": "Alta", "total_monto": 50000, "data_json": {"items": [1, 2, 3]}},
        ]

        result = trained_service.priorizar_solicitudes(solicitudes)

        assert result["total_solicitudes"] == 2
        assert result["solicitudes_rankeadas"][0]["solicitud_id"] == 2  # Alta primero

    def test_proyectar_demanda(self, trained_service):
        """Proyecta demanda para material."""
        result = trained_service.proyectar_demanda(
            material_codigo="MAT001",
            centro="1000",
            dias=30
        )

        assert result["material_codigo"] == "MAT001"
        assert "predicted_demand" in result
        assert "confidence_lower" in result
        assert "confidence_upper" in result


class TestAIServiceSugerencias:
    """Tests para sugerencias automaticas."""

    @pytest.fixture
    def trained_service(self):
        """Servicio con pipelines entrenados."""
        from backend.services.ai_service import AIService

        service = AIService()
        base_date = datetime.now() - timedelta(days=60)
        solicitudes = []
        for material in ["MAT001", "MAT002", "MAT003", "MAT004", "MAT005", "MAT006"]:
            for i in range(5):
                solicitudes.append({
                    "id": len(solicitudes) + 1,
                    "created_at": (base_date + timedelta(days=i * 3)).isoformat(),
                    "material_codigo": material,
                    "centro": "1000",
                    "sector": "Produccion",
                    "criticidad": "Alta" if i % 2 == 0 else "Normal",
                    "total_monto": 1000 + (i * 100),
                    "data_json": {"items": list(range(i + 1))}
                })
        materials = [
            {"codigo": f"MAT00{i}", "descripcion": f"Material {i}", "precio_usd": i * 100, "unidad": "PZ"}
            for i in range(1, 7)
        ]
        service.train_pipelines(solicitudes, materials)
        return service

    def test_sugerir_accion_solicitud(self, trained_service):
        """Sugiere accion para una solicitud."""
        solicitud = {
            "id": 1,
            "criticidad": "Alta",
            "fecha_necesidad": (datetime.now() + timedelta(days=2)).isoformat(),
            "total_monto": 50000,
            "data_json": {"items": [{"material_codigo": "MAT001", "cantidad": 10}]}
        }

        result = trained_service.sugerir_accion(solicitud)

        assert "accion_sugerida" in result
        assert "confianza" in result
        assert "motivo" in result
        assert result["accion_sugerida"] in ["aprobar", "revisar", "rechazar", "escalar"]

    def test_sugerir_cantidad_optima(self, trained_service):
        """Sugiere cantidad optima de pedido."""
        result = trained_service.sugerir_cantidad_optima(
            material_codigo="MAT001",
            centro="1000",
            demanda_anual=1200
        )

        assert "cantidad_sugerida" in result
        assert "metodo" in result
        assert result["cantidad_sugerida"] > 0

    def test_alertas_inteligentes(self, trained_service):
        """Genera alertas basadas en patrones."""
        with patch('backend.services.ai_service.get_db_connection') as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            cursor.fetchall.return_value = [
                {"codigo": "MAT001", "stock_actual": 5, "punto_pedido": 50},
                {"codigo": "MAT002", "stock_actual": 100, "punto_pedido": 30},
            ]
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            result = trained_service.generar_alertas_inteligentes(centro="1000")

            assert "alertas" in result
            assert isinstance(result["alertas"], list)


class TestAIServiceIntegracionMRP:
    """Tests de integracion con servicio MRP."""

    def test_analisis_completo_material(self):
        """Analisis completo integrando MRP y ML."""
        from backend.services.ai_service import AIService

        with patch('backend.services.ai_service.get_db_connection') as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            cursor.fetchone.return_value = {
                "codigo_material": "MAT001",
                "descripcion": "Valvula control",
                "stock_actual": 50,
                "stock_seguridad": 20,
                "punto_pedido": 80,
                "consumo_promedio_mensual": 60,
                "precio_usd": 500
            }
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            service = AIService()
            result = service.analisis_completo_material(
                material_codigo="MAT001",
                centro="1000"
            )

            assert "material" in result
            assert "stock_status" in result
            assert "recomendacion_ia" in result


class TestAIServiceFallbacks:
    """Tests para comportamiento cuando ML no esta disponible."""

    def test_fallback_sin_entrenamiento(self):
        """Usa reglas simples si modelo no esta entrenado."""
        from backend.services.ai_service import AIService

        service = AIService()  # Sin entrenar
        solicitud = {
            "id": 1,
            "criticidad": "Alta",
            "total_monto": 50000,
            "data_json": {"items": [1]}
        }

        result = service.sugerir_accion(solicitud)

        assert "accion_sugerida" in result
        assert result["metodo"] == "reglas_basicas"

    def test_fallback_proyeccion_sin_modelo(self):
        """Usa promedio historico si forecast no entrenado."""
        from backend.services.ai_service import AIService

        service = AIService()  # Sin entrenar

        with patch('backend.services.ai_service.get_db_connection') as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            cursor.fetchone.return_value = {"consumo_promedio": 100}
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            result = service.proyectar_demanda("MAT001", "1000", 30)

            assert result["metodo"] == "promedio_historico"


class TestAIServiceCache:
    """Tests para cache de resultados."""

    def test_cache_recomendaciones(self):
        """Cachea recomendaciones frecuentes."""
        from backend.services.ai_service import AIService

        service = AIService()

        # Primera llamada
        result1 = service.get_cached_recommendation("MAT001", "prioridad")
        assert result1 is None  # No hay cache

        # Guardar en cache
        service.cache_recommendation("MAT001", "prioridad", {"score": 0.8})

        # Segunda llamada
        result2 = service.get_cached_recommendation("MAT001", "prioridad")
        assert result2 is not None
        assert result2["score"] == 0.8

    def test_cache_expiracion(self):
        """Cache expira despues de TTL."""
        from backend.services.ai_service import AIService

        service = AIService()
        service.cache_recommendation("MAT001", "test", {"value": 1}, ttl_seconds=0)

        # Deberia haber expirado inmediatamente
        result = service.get_cached_recommendation("MAT001", "test")
        assert result is None
