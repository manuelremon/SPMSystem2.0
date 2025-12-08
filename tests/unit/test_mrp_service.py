"""
Tests TDD para el servicio MRP (Material Requirements Planning).
Sprint 5.1 - Crear tests antes de implementacion.

El servicio MRP gestiona:
- Calculo de requerimientos netos
- Generacion de ordenes planificadas
- Calculo de punto de reorden
- Integracion con forecast de demanda
"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta


class TestCalculoRequerimientosNetos:
    """Tests para calcular requerimientos netos de materiales."""

    def test_requerimiento_neto_simple(self):
        """Requerimiento = Demanda - Stock - Pedidos en curso."""
        from backend.services.mrp_service import calcular_requerimiento_neto

        resultado = calcular_requerimiento_neto(
            demanda=100,
            stock_actual=30,
            pedidos_en_curso=20,
            stock_seguridad=10
        )

        # Necesidad = 100 - 30 - 20 + 10 (seguridad) = 60
        assert resultado["requerimiento_neto"] == 60
        assert resultado["necesita_reposicion"] is True

    def test_requerimiento_neto_sin_necesidad(self):
        """No hay necesidad si stock + pedidos > demanda + seguridad."""
        from backend.services.mrp_service import calcular_requerimiento_neto

        resultado = calcular_requerimiento_neto(
            demanda=50,
            stock_actual=100,
            pedidos_en_curso=20,
            stock_seguridad=10
        )

        assert resultado["requerimiento_neto"] == 0
        assert resultado["necesita_reposicion"] is False

    def test_requerimiento_neto_con_cobertura(self):
        """Incluye dias de cobertura del stock actual."""
        from backend.services.mrp_service import calcular_requerimiento_neto

        resultado = calcular_requerimiento_neto(
            demanda=100,
            stock_actual=50,
            pedidos_en_curso=0,
            stock_seguridad=20,
            consumo_diario=5
        )

        # Cobertura actual = 50 / 5 = 10 dias
        assert resultado["dias_cobertura"] == 10


class TestCalculoPuntoReorden:
    """Tests para calcular punto de reorden."""

    def test_punto_reorden_basico(self):
        """Punto reorden = (Lead time * Consumo diario) + Stock seguridad."""
        from backend.services.mrp_service import calcular_punto_reorden

        resultado = calcular_punto_reorden(
            consumo_diario=10,
            lead_time_dias=15,
            stock_seguridad=50
        )

        # Punto reorden = (15 * 10) + 50 = 200
        assert resultado["punto_reorden"] == 200

    def test_punto_reorden_con_variabilidad(self):
        """Considera variabilidad de demanda y lead time."""
        from backend.services.mrp_service import calcular_punto_reorden

        resultado = calcular_punto_reorden(
            consumo_diario=10,
            lead_time_dias=15,
            stock_seguridad=50,
            variabilidad_demanda=0.2,  # 20% de variacion
            variabilidad_lead_time=0.1  # 10% de variacion
        )

        # Debe ser mayor que el basico por la variabilidad
        assert resultado["punto_reorden"] > 200
        assert "factor_seguridad" in resultado


class TestCantidadOptimaPedido:
    """Tests para calcular cantidad optima de pedido (EOQ)."""

    def test_eoq_basico(self):
        """Calculo EOQ: sqrt(2 * Demanda * Costo Orden / Costo Mantenimiento)."""
        from backend.services.mrp_service import calcular_cantidad_optima

        resultado = calcular_cantidad_optima(
            demanda_anual=1200,
            costo_orden=50,
            costo_mantenimiento_unitario=2
        )

        # EOQ = sqrt(2 * 1200 * 50 / 2) = sqrt(60000) = ~245
        assert 240 <= resultado["cantidad_optima"] <= 250

    def test_eoq_con_restricciones(self):
        """EOQ respeta minimos y maximos."""
        from backend.services.mrp_service import calcular_cantidad_optima

        resultado = calcular_cantidad_optima(
            demanda_anual=1200,
            costo_orden=50,
            costo_mantenimiento_unitario=2,
            cantidad_minima=300,
            cantidad_maxima=500
        )

        # Debe respetar el minimo
        assert resultado["cantidad_optima"] >= 300
        assert resultado["ajustado"] is True


class TestGeneracionOrdenesPlanificadas:
    """Tests para generar ordenes planificadas."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch('backend.services.mrp_service.get_db_connection') as mock_conn, \
             patch('backend.services.mrp_service.get_db_transaction') as mock_trans:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            mock_trans.return_value.__enter__ = MagicMock(return_value=conn)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, mock_trans, conn, cursor

    def test_generar_orden_planificada(self, mock_db):
        """Debe generar orden planificada para material con necesidad."""
        from backend.services.mrp_service import generar_orden_planificada

        _, _, conn, cursor = mock_db
        cursor.lastrowid = 1

        resultado = generar_orden_planificada(
            material_codigo="MAT001",
            centro="1000",
            cantidad=100,
            fecha_necesidad="2025-01-15",
            tipo="compra"
        )

        assert resultado["id"] == 1
        assert resultado["estado"] == "planificada"

    def test_generar_multiples_ordenes(self, mock_db):
        """Genera ordenes para multiples materiales."""
        from backend.services.mrp_service import generar_ordenes_mrp

        _, _, conn, cursor = mock_db

        # Mock de materiales con necesidad
        cursor.fetchall.return_value = [
            {
                "codigo": "MAT001",
                "centro": "1000",
                "stock_actual": 20,
                "punto_pedido": 50,
                "stock_seguridad": 10,
                "consumo_promedio_mensual": 60,
                "lead_time_dias": 15
            },
            {
                "codigo": "MAT002",
                "centro": "1000",
                "stock_actual": 10,
                "punto_pedido": 30,
                "stock_seguridad": 5,
                "consumo_promedio_mensual": 40,
                "lead_time_dias": 10
            }
        ]

        resultado = generar_ordenes_mrp(centro="1000")

        assert resultado["ordenes_generadas"] >= 0


class TestIntegracionForecast:
    """Tests para integracion con forecast de demanda."""

    @pytest.fixture
    def mock_forecast(self):
        """Mock del pipeline de forecast."""
        with patch('backend.services.mrp_service.DemandForecastPipeline') as mock:
            pipeline = MagicMock()
            pipeline.predict.return_value = {
                "predicted_demand": 150,
                "confidence_lower": 120,
                "confidence_upper": 180
            }
            mock.return_value = pipeline
            yield mock, pipeline

    def test_obtener_demanda_proyectada(self, mock_forecast):
        """Obtiene demanda proyectada del modelo ML."""
        from backend.services.mrp_service import obtener_demanda_proyectada

        _, pipeline = mock_forecast

        resultado = obtener_demanda_proyectada(
            material_codigo="MAT001",
            centro="1000",
            dias=30
        )

        assert resultado["demanda_proyectada"] == 150
        assert resultado["metodo"] == "ml_forecast"

    def test_fallback_a_promedio_historico(self, mock_forecast):
        """Si ML falla, usa promedio historico."""
        from backend.services.mrp_service import obtener_demanda_proyectada

        _, pipeline = mock_forecast
        pipeline.predict.side_effect = Exception("Modelo no disponible")

        with patch('backend.services.mrp_service.get_db_connection') as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            cursor.fetchone.return_value = {"consumo_promedio": 100}
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            resultado = obtener_demanda_proyectada(
                material_codigo="MAT001",
                centro="1000",
                dias=30
            )

            assert resultado["metodo"] == "promedio_historico"


class TestAnalisisMRP:
    """Tests para analisis MRP completo."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch('backend.services.mrp_service.get_db_connection') as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, conn, cursor

    def test_analizar_material(self, mock_db):
        """Analisis completo de un material."""
        from backend.services.mrp_service import analizar_material

        _, conn, cursor = mock_db

        cursor.fetchone.return_value = {
            "codigo_material": "MAT001",
            "descripcion": "Valvula control",
            "stock_actual": 50,
            "stock_seguridad": 20,
            "punto_pedido": 80,
            "stock_maximo": 200,
            "pedidos_en_curso": 30,
            "consumo_promedio_mensual": 60,
            "lead_time_dias": 15
        }

        resultado = analizar_material(
            material_codigo="MAT001",
            centro="1000"
        )

        assert "estado" in resultado
        assert "requerimiento_neto" in resultado
        assert "recomendacion" in resultado
        assert "dias_cobertura" in resultado

    def test_analizar_centro_completo(self, mock_db):
        """Analisis MRP de todos los materiales de un centro."""
        from backend.services.mrp_service import analizar_centro

        _, conn, cursor = mock_db

        cursor.fetchall.return_value = [
            {
                "codigo_material": "MAT001",
                "stock_actual": 20,
                "punto_pedido": 50,
                "stock_seguridad": 10
            },
            {
                "codigo_material": "MAT002",
                "stock_actual": 100,
                "punto_pedido": 30,
                "stock_seguridad": 10
            },
            {
                "codigo_material": "MAT003",
                "stock_actual": 5,
                "punto_pedido": 40,
                "stock_seguridad": 15
            }
        ]

        resultado = analizar_centro(centro="1000")

        assert "materiales_analizados" in resultado
        assert "materiales_criticos" in resultado
        assert "resumen" in resultado


class TestRecomendacionesMRP:
    """Tests para recomendaciones de accion."""

    def test_recomendar_compra_urgente(self):
        """Recomienda compra urgente si stock < seguridad."""
        from backend.services.mrp_service import generar_recomendacion

        resultado = generar_recomendacion(
            stock_actual=5,
            stock_seguridad=20,
            punto_pedido=50,
            pedidos_en_curso=0
        )

        assert resultado["accion"] == "compra_urgente"
        assert resultado["prioridad"] == "alta"

    def test_recomendar_generar_solped(self):
        """Recomienda generar SolPed si bajo punto pedido."""
        from backend.services.mrp_service import generar_recomendacion

        resultado = generar_recomendacion(
            stock_actual=30,
            stock_seguridad=10,
            punto_pedido=50,
            pedidos_en_curso=0
        )

        assert resultado["accion"] == "generar_solped"
        assert resultado["prioridad"] == "media"

    def test_recomendar_acelerar_pedido(self):
        """Recomienda acelerar pedido si hay pedido pero stock critico."""
        from backend.services.mrp_service import generar_recomendacion

        resultado = generar_recomendacion(
            stock_actual=15,
            stock_seguridad=20,
            punto_pedido=50,
            pedidos_en_curso=100
        )

        assert resultado["accion"] == "acelerar_pedido"

    def test_no_accion_requerida(self):
        """No recomienda accion si stock OK."""
        from backend.services.mrp_service import generar_recomendacion

        resultado = generar_recomendacion(
            stock_actual=100,
            stock_seguridad=20,
            punto_pedido=50,
            pedidos_en_curso=0
        )

        assert resultado["accion"] == "ninguna"
        assert resultado["prioridad"] == "baja"


class TestAlertasAutomaticas:
    """Tests para sistema de alertas automaticas."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch('backend.services.mrp_service.get_db_transaction') as mock_trans:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_trans.return_value.__enter__ = MagicMock(return_value=conn)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_trans, conn, cursor

    def test_crear_alerta_reposicion(self, mock_db):
        """Crea alerta de reposicion automatica."""
        from backend.services.mrp_service import crear_alerta_mrp

        _, conn, cursor = mock_db
        cursor.lastrowid = 1

        resultado = crear_alerta_mrp(
            material_codigo="MAT001",
            centro="1000",
            tipo="bajo_punto_pedido",
            severidad="warning",
            mensaje="Stock por debajo del punto de pedido"
        )

        assert resultado["id"] == 1
        assert cursor.execute.called

    def test_obtener_alertas_activas(self):
        """Obtiene alertas MRP activas."""
        from backend.services.mrp_service import obtener_alertas_mrp

        with patch('backend.services.mrp_service.get_db_connection') as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            cursor.fetchall.return_value = [
                {"id": 1, "material": "MAT001", "tipo": "quiebre"},
                {"id": 2, "material": "MAT002", "tipo": "bajo_punto_pedido"}
            ]
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            resultado = obtener_alertas_mrp(centro="1000")

            assert len(resultado) == 2

    def test_resolver_alerta(self, mock_db):
        """Resuelve alerta MRP."""
        from backend.services.mrp_service import resolver_alerta_mrp

        _, conn, cursor = mock_db
        cursor.rowcount = 1

        resultado = resolver_alerta_mrp(
            alerta_id=1,
            resuelto_por="user_1",
            accion_tomada="Generada SolPed 12345"
        )

        assert resultado["resuelta"] is True
