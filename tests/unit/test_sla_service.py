"""
Tests TDD para el servicio de SLA (Service Level Agreement).
Sprint 4.2 - Crear tests antes de implementacion.

El servicio SLA gestiona:
- Configuracion de tiempos objetivo por criticidad/estado
- Calculo de fechas limite
- Deteccion de alertas y breaches
- Metricas de cumplimiento
"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta


class TestObtenerConfiguracionSLA:
    """Tests para obtener configuracion SLA aplicable."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch('backend.services.sla_service.get_db_connection') as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, conn, cursor

    def test_obtener_sla_por_criticidad_y_transicion(self, mock_db):
        """Debe obtener SLA especifico para criticidad y transicion."""
        from backend.services.sla_service import obtener_configuracion_sla

        _, conn, cursor = mock_db

        cursor.fetchone.return_value = {
            'id': 1,
            'nombre': 'Aprobacion Urgente',
            'criticidad': 'Urgente',
            'estado_desde': 'submitted',
            'estado_hasta': 'approved',
            'tiempo_objetivo_horas': 4,
            'tiempo_alerta_horas': 2
        }

        config = obtener_configuracion_sla(
            criticidad='Urgente',
            estado_desde='submitted',
            estado_hasta='approved'
        )

        assert config is not None
        assert config['tiempo_objetivo_horas'] == 4

    def test_obtener_sla_general_si_no_hay_especifico(self, mock_db):
        """Si no hay SLA especifico, debe buscar uno general."""
        from backend.services.sla_service import obtener_configuracion_sla

        _, conn, cursor = mock_db

        # Primera busqueda (especifico) no encuentra, segunda (general) si
        cursor.fetchone.side_effect = [
            None,  # No hay especifico
            {
                'id': 10,
                'nombre': 'Aprobacion General',
                'criticidad': None,
                'estado_desde': 'submitted',
                'estado_hasta': 'approved',
                'tiempo_objetivo_horas': 24
            }
        ]

        config = obtener_configuracion_sla(
            criticidad='Nueva',  # Criticidad sin config especifica
            estado_desde='submitted',
            estado_hasta='approved'
        )

        assert config is not None
        assert config['tiempo_objetivo_horas'] == 24

    def test_retorna_none_si_no_hay_sla(self, mock_db):
        """Retorna None si no hay SLA configurado."""
        from backend.services.sla_service import obtener_configuracion_sla

        _, conn, cursor = mock_db
        cursor.fetchone.return_value = None

        config = obtener_configuracion_sla(
            criticidad='Test',
            estado_desde='unknown',
            estado_hasta='unknown'
        )

        assert config is None


class TestCalcularFechaLimite:
    """Tests para calcular fecha limite SLA."""

    def test_calcular_fecha_limite_desde_ahora(self):
        """Debe calcular fecha limite correctamente."""
        from backend.services.sla_service import calcular_fecha_limite

        fecha_inicio = datetime(2025, 1, 1, 10, 0, 0)
        horas = 24

        fecha_limite = calcular_fecha_limite(fecha_inicio, horas)

        esperado = datetime(2025, 1, 2, 10, 0, 0)
        assert fecha_limite == esperado

    def test_calcular_fecha_limite_con_horas_laborales(self):
        """Opcionalmente calcula solo horas laborales (9-18)."""
        from backend.services.sla_service import calcular_fecha_limite

        fecha_inicio = datetime(2025, 1, 1, 17, 0, 0)  # 5pm miercoles
        horas = 4

        # Sin horas laborales: termina a las 9pm
        fecha_limite = calcular_fecha_limite(fecha_inicio, horas, solo_horas_laborales=False)
        assert fecha_limite == datetime(2025, 1, 1, 21, 0, 0)

    def test_calcular_fecha_limite_horas_fraccionarias(self):
        """Debe manejar horas fraccionarias."""
        from backend.services.sla_service import calcular_fecha_limite

        fecha_inicio = datetime(2025, 1, 1, 10, 0, 0)
        horas = 2.5

        fecha_limite = calcular_fecha_limite(fecha_inicio, horas)

        esperado = datetime(2025, 1, 1, 12, 30, 0)
        assert fecha_limite == esperado


class TestVerificarEstadoSLA:
    """Tests para verificar estado de cumplimiento SLA."""

    def test_sla_on_time(self):
        """Solicitud dentro del tiempo es 'on_time'."""
        from backend.services.sla_service import verificar_estado_sla

        ahora = datetime(2025, 1, 1, 12, 0, 0)
        fecha_limite = datetime(2025, 1, 1, 18, 0, 0)

        estado = verificar_estado_sla(fecha_limite, ahora)

        assert estado['estado'] == 'on_time'
        assert estado['horas_restantes'] > 0

    def test_sla_warning(self):
        """Solicitud cerca de vencer es 'warning'."""
        from backend.services.sla_service import verificar_estado_sla

        ahora = datetime(2025, 1, 1, 16, 0, 0)
        fecha_limite = datetime(2025, 1, 1, 18, 0, 0)
        umbral_alerta_horas = 4

        estado = verificar_estado_sla(fecha_limite, ahora, umbral_alerta_horas)

        assert estado['estado'] == 'warning'
        assert estado['horas_restantes'] == 2

    def test_sla_breach(self):
        """Solicitud vencida es 'breach'."""
        from backend.services.sla_service import verificar_estado_sla

        ahora = datetime(2025, 1, 1, 20, 0, 0)
        fecha_limite = datetime(2025, 1, 1, 18, 0, 0)

        estado = verificar_estado_sla(fecha_limite, ahora)

        assert estado['estado'] == 'breach'
        assert estado['horas_restantes'] < 0
        assert estado['horas_excedidas'] == 2


class TestRegistrarAlertaSLA:
    """Tests para registrar alertas de SLA."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch('backend.services.sla_service.get_db_connection') as mock_conn, \
             patch('backend.services.sla_service.get_db_transaction') as mock_trans:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            mock_trans.return_value.__enter__ = MagicMock(return_value=conn)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, mock_trans, conn, cursor

    def test_registrar_alerta_warning(self, mock_db):
        """Debe registrar alerta tipo warning."""
        from backend.services.sla_service import registrar_alerta_sla

        _, _, conn, cursor = mock_db
        cursor.lastrowid = 1

        resultado = registrar_alerta_sla(
            solicitud_id=100,
            sla_config_id=1,
            tipo='warning',
            fecha_inicio='2025-01-01T10:00:00Z',
            fecha_vencimiento='2025-01-01T18:00:00Z'
        )

        assert resultado['id'] == 1
        assert cursor.execute.called

    def test_registrar_alerta_breach(self, mock_db):
        """Debe registrar alerta tipo breach."""
        from backend.services.sla_service import registrar_alerta_sla

        _, _, conn, cursor = mock_db
        cursor.lastrowid = 2

        resultado = registrar_alerta_sla(
            solicitud_id=100,
            sla_config_id=1,
            tipo='breach',
            fecha_inicio='2025-01-01T10:00:00Z',
            fecha_vencimiento='2025-01-01T18:00:00Z',
            tiempo_transcurrido_horas=10,
            tiempo_objetivo_horas=8
        )

        assert resultado['id'] == 2


class TestResolverAlertaSLA:
    """Tests para resolver alertas de SLA."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch('backend.services.sla_service.get_db_transaction') as mock_trans:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_trans.return_value.__enter__ = MagicMock(return_value=conn)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_trans, conn, cursor

    def test_resolver_alerta(self, mock_db):
        """Debe marcar alerta como resuelta."""
        from backend.services.sla_service import resolver_alerta_sla

        _, conn, cursor = mock_db
        cursor.rowcount = 1

        resultado = resolver_alerta_sla(
            alerta_id=1,
            resuelto_por='user_1'
        )

        assert resultado['resuelto'] is True

    def test_resolver_alertas_por_solicitud(self, mock_db):
        """Debe resolver todas las alertas de una solicitud."""
        from backend.services.sla_service import resolver_alertas_solicitud

        _, conn, cursor = mock_db
        cursor.rowcount = 3

        resultado = resolver_alertas_solicitud(
            solicitud_id=100,
            resuelto_por='user_1'
        )

        assert resultado['alertas_resueltas'] == 3


class TestMetricasSLA:
    """Tests para metricas de cumplimiento SLA."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch('backend.services.sla_service.get_db_connection') as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, conn, cursor

    def test_obtener_metricas_cumplimiento(self, mock_db):
        """Debe calcular porcentaje de cumplimiento."""
        from backend.services.sla_service import obtener_metricas_sla

        _, conn, cursor = mock_db

        cursor.fetchone.side_effect = [
            {'total': 100},  # Total solicitudes
            {'on_time': 85},  # A tiempo
            {'warning': 10},  # Con warning
            {'breach': 5}  # Incumplidas
        ]

        metricas = obtener_metricas_sla(periodo_dias=30)

        assert metricas['total_solicitudes'] == 100
        assert metricas['porcentaje_cumplimiento'] == 85.0

    def test_obtener_metricas_por_criticidad(self, mock_db):
        """Debe desglosar metricas por criticidad."""
        from backend.services.sla_service import obtener_metricas_sla

        _, conn, cursor = mock_db

        # La implementacion hace 4 fetchone() antes del fetchall()
        cursor.fetchone.side_effect = [
            {'total': 100},  # Total solicitudes
            {'on_time': 85},  # A tiempo
            {'warning': 10},  # Con warning
            {'breach': 5}  # Incumplidas
        ]

        cursor.fetchall.return_value = [
            {'criticidad': 'Urgente', 'total': 10, 'on_time': 8, 'breach': 2},
            {'criticidad': 'Alta', 'total': 20, 'on_time': 18, 'breach': 2},
            {'criticidad': 'Normal', 'total': 50, 'on_time': 48, 'breach': 2},
            {'criticidad': 'Baja', 'total': 20, 'on_time': 20, 'breach': 0},
        ]

        metricas = obtener_metricas_sla(periodo_dias=30, por_criticidad=True)

        assert 'por_criticidad' in metricas
        assert len(metricas['por_criticidad']) == 4

    def test_obtener_alertas_activas(self, mock_db):
        """Debe listar alertas activas."""
        from backend.services.sla_service import obtener_alertas_activas

        _, conn, cursor = mock_db

        cursor.fetchall.return_value = [
            {'id': 1, 'solicitud_id': 100, 'tipo': 'warning'},
            {'id': 2, 'solicitud_id': 101, 'tipo': 'breach'},
        ]

        alertas = obtener_alertas_activas()

        assert len(alertas) == 2


class TestActualizarSLASolicitud:
    """Tests para actualizar estado SLA de solicitud."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch('backend.services.sla_service.get_db_connection') as mock_conn, \
             patch('backend.services.sla_service.get_db_transaction') as mock_trans:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            mock_trans.return_value.__enter__ = MagicMock(return_value=conn)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, mock_trans, conn, cursor

    def test_actualizar_fecha_limite_solicitud(self, mock_db):
        """Debe actualizar fecha limite en solicitud."""
        from backend.services.sla_service import actualizar_sla_solicitud

        _, _, conn, cursor = mock_db
        cursor.rowcount = 1

        resultado = actualizar_sla_solicitud(
            solicitud_id=100,
            fecha_limite='2025-01-02T10:00:00Z',
            estado_sla='on_time'
        )

        assert resultado['actualizado'] is True

    def test_calcular_tiempo_respuesta(self, mock_db):
        """Debe calcular tiempo de respuesta al completar."""
        from backend.services.sla_service import calcular_tiempo_respuesta

        fecha_inicio = datetime(2025, 1, 1, 10, 0, 0)
        fecha_fin = datetime(2025, 1, 1, 14, 30, 0)

        horas = calcular_tiempo_respuesta(fecha_inicio, fecha_fin)

        assert horas == 4.5


class TestCRUDConfiguracionSLA:
    """Tests para CRUD de configuracion SLA."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch('backend.services.sla_service.get_db_connection') as mock_conn, \
             patch('backend.services.sla_service.get_db_transaction') as mock_trans:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            mock_trans.return_value.__enter__ = MagicMock(return_value=conn)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, mock_trans, conn, cursor

    def test_listar_configuraciones_sla(self, mock_db):
        """Debe listar todas las configuraciones."""
        from backend.services.sla_service import listar_configuraciones_sla

        mock_conn, _, conn, cursor = mock_db

        cursor.fetchall.return_value = [
            {'id': 1, 'nombre': 'Config 1', 'activo': 1},
            {'id': 2, 'nombre': 'Config 2', 'activo': 1},
        ]

        configs = listar_configuraciones_sla()

        assert len(configs) == 2

    def test_crear_configuracion_sla(self, mock_db):
        """Debe crear nueva configuracion."""
        from backend.services.sla_service import crear_configuracion_sla

        _, _, conn, cursor = mock_db
        cursor.lastrowid = 10

        resultado = crear_configuracion_sla(
            nombre='Nueva Config',
            estado_desde='submitted',
            estado_hasta='approved',
            tiempo_objetivo_horas=12,
            criticidad='Alta'
        )

        assert resultado['id'] == 10

    def test_actualizar_configuracion_sla(self, mock_db):
        """Debe actualizar configuracion existente."""
        from backend.services.sla_service import actualizar_configuracion_sla

        _, _, conn, cursor = mock_db
        cursor.rowcount = 1

        resultado = actualizar_configuracion_sla(
            config_id=1,
            tiempo_objetivo_horas=8
        )

        assert resultado['actualizado'] is True
