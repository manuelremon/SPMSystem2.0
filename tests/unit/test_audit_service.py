"""
Tests TDD para el servicio de auditoria.
Sprint 1.3 - Crear tests antes de la implementacion.

El servicio de auditoria proporciona trazabilidad completa
de todas las acciones en el sistema.
"""

import json
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest


class TestRegistrarAccion:
    """Tests para la funcion registrar_accion."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch("backend.services.audit_service.get_db_transaction") as mock_transaction:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_transaction.return_value.__enter__ = MagicMock(return_value=conn)
            mock_transaction.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_transaction, conn, cursor

    def test_registrar_accion_basica(self, mock_db):
        """Debe registrar una accion con campos minimos."""
        from backend.services.audit_service import registrar_accion

        _, conn, cursor = mock_db

        registrar_accion(entidad="solicitud", entidad_id="123", accion="crear", actor_id="user_1")

        # Verificar que se ejecuto un INSERT
        assert cursor.execute.called
        insert_call = cursor.execute.call_args[0][0]
        assert "INSERT INTO audit_trail" in insert_call

    def test_registrar_accion_con_valores(self, mock_db):
        """Debe registrar cambio de valor (anterior y nuevo)."""
        from backend.services.audit_service import registrar_accion

        _, conn, cursor = mock_db

        registrar_accion(
            entidad="solicitud",
            entidad_id="123",
            accion="modificar",
            actor_id="user_1",
            campo_modificado="status",
            valor_anterior="draft",
            valor_nuevo="submitted",
        )

        # Verificar que los parametros incluyen los valores
        call_args = cursor.execute.call_args
        params = call_args[0][1] if len(call_args[0]) > 1 else call_args[1]
        assert "status" in str(params) or "status" in str(call_args)

    def test_registrar_accion_con_metadata(self, mock_db):
        """Debe registrar IP y user agent si se proporcionan."""
        from backend.services.audit_service import registrar_accion

        _, conn, cursor = mock_db

        registrar_accion(
            entidad="solicitud",
            entidad_id="123",
            accion="aprobar",
            actor_id="aprobador_1",
            actor_rol="aprobador",
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0...",
        )

        assert cursor.execute.called

    def test_registrar_accion_retorna_id(self, mock_db):
        """Debe retornar el ID del registro de auditoria creado."""
        from backend.services.audit_service import registrar_accion

        _, conn, cursor = mock_db
        cursor.lastrowid = 42

        resultado = registrar_accion(
            entidad="solicitud", entidad_id="123", accion="crear", actor_id="user_1"
        )

        assert resultado == 42


class TestObtenerAuditoria:
    """Tests para consultar registros de auditoria."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch("backend.services.audit_service.get_db_connection") as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, conn, cursor

    def test_obtener_auditoria_por_entidad(self, mock_db):
        """Debe obtener todos los registros de una entidad."""
        from backend.services.audit_service import obtener_auditoria

        _, conn, cursor = mock_db
        cursor.fetchall.return_value = [
            {
                "id": 1,
                "entidad": "solicitud",
                "entidad_id": "123",
                "accion": "crear",
                "actor_id": "user_1",
                "created_at": "2025-12-08T10:00:00Z",
            },
            {
                "id": 2,
                "entidad": "solicitud",
                "entidad_id": "123",
                "accion": "aprobar",
                "actor_id": "aprobador_1",
                "created_at": "2025-12-08T11:00:00Z",
            },
        ]

        resultado = obtener_auditoria(entidad="solicitud", entidad_id="123")

        assert len(resultado) == 2
        assert resultado[0]["accion"] == "crear"
        assert resultado[1]["accion"] == "aprobar"

    def test_obtener_auditoria_vacia(self, mock_db):
        """Debe retornar lista vacia si no hay registros."""
        from backend.services.audit_service import obtener_auditoria

        _, conn, cursor = mock_db
        cursor.fetchall.return_value = []

        resultado = obtener_auditoria(entidad="solicitud", entidad_id="999")

        assert resultado == []

    def test_obtener_auditoria_ordenada_cronologicamente(self, mock_db):
        """Los registros deben estar ordenados por fecha."""
        from backend.services.audit_service import obtener_auditoria

        _, conn, cursor = mock_db

        obtener_auditoria(entidad="solicitud", entidad_id="123")

        # Verificar que el query incluye ORDER BY
        query = cursor.execute.call_args[0][0]
        assert "ORDER BY" in query


class TestObtenerAuditoriaPorActor:
    """Tests para obtener auditoria filtrada por actor."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch("backend.services.audit_service.get_db_connection") as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, conn, cursor

    def test_obtener_acciones_de_usuario(self, mock_db):
        """Debe obtener todas las acciones realizadas por un usuario."""
        from backend.services.audit_service import obtener_auditoria_por_actor

        _, conn, cursor = mock_db
        cursor.fetchall.return_value = [
            {
                "id": 1,
                "entidad": "solicitud",
                "entidad_id": "100",
                "accion": "crear",
                "actor_id": "user_1",
                "created_at": "2025-12-08T10:00:00Z",
            },
            {
                "id": 3,
                "entidad": "solicitud",
                "entidad_id": "101",
                "accion": "crear",
                "actor_id": "user_1",
                "created_at": "2025-12-08T12:00:00Z",
            },
        ]

        resultado = obtener_auditoria_por_actor(actor_id="user_1")

        assert len(resultado) == 2
        assert all(r["actor_id"] == "user_1" for r in resultado)


class TestObtenerAuditoriaPorFecha:
    """Tests para filtrar auditoria por rango de fechas."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch("backend.services.audit_service.get_db_connection") as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, conn, cursor

    def test_filtrar_por_fecha_desde(self, mock_db):
        """Debe filtrar registros desde una fecha."""
        from backend.services.audit_service import obtener_auditoria

        _, conn, cursor = mock_db
        cursor.fetchall.return_value = []

        obtener_auditoria(entidad="solicitud", entidad_id="123", fecha_desde="2025-12-01")

        # Verificar que el query incluye filtro de fecha
        query = cursor.execute.call_args[0][0]
        assert "created_at >=" in query or "fecha" in query.lower()

    def test_filtrar_por_rango_fechas(self, mock_db):
        """Debe filtrar registros en un rango de fechas."""
        from backend.services.audit_service import obtener_auditoria

        _, conn, cursor = mock_db
        cursor.fetchall.return_value = []

        obtener_auditoria(
            entidad="solicitud",
            entidad_id="123",
            fecha_desde="2025-12-01",
            fecha_hasta="2025-12-31",
        )

        query = cursor.execute.call_args[0][0]
        # Debe tener condiciones para ambas fechas
        assert ">=" in query or "BETWEEN" in query


class TestAccionesConvenientes:
    """Tests para funciones de conveniencia de auditoria."""

    @pytest.fixture
    def mock_registrar(self):
        """Mock de la funcion registrar_accion."""
        with patch("backend.services.audit_service.registrar_accion") as mock:
            mock.return_value = 1
            yield mock

    def test_auditar_creacion_solicitud(self, mock_registrar):
        """Funcion conveniente para auditar creacion de solicitud."""
        from backend.services.audit_service import auditar_creacion_solicitud

        auditar_creacion_solicitud(
            solicitud_id=123,
            actor_id="user_1",
            datos_solicitud={"centro": "1008", "sector": "Mantenimiento"},
        )

        mock_registrar.assert_called_once()
        call_kwargs = mock_registrar.call_args[1]
        assert call_kwargs["entidad"] == "solicitud"
        assert call_kwargs["accion"] == "crear"

    def test_auditar_aprobacion_solicitud(self, mock_registrar):
        """Funcion conveniente para auditar aprobacion."""
        from backend.services.audit_service import auditar_aprobacion

        auditar_aprobacion(solicitud_id=123, actor_id="aprobador_1", actor_rol="coordinador")

        mock_registrar.assert_called_once()
        call_kwargs = mock_registrar.call_args[1]
        assert call_kwargs["accion"] == "aprobar"

    def test_auditar_rechazo_solicitud(self, mock_registrar):
        """Funcion conveniente para auditar rechazo."""
        from backend.services.audit_service import auditar_rechazo

        auditar_rechazo(solicitud_id=123, actor_id="aprobador_1", motivo="Presupuesto insuficiente")

        mock_registrar.assert_called_once()
        call_kwargs = mock_registrar.call_args[1]
        assert call_kwargs["accion"] == "rechazar"

    def test_auditar_modificacion_campo(self, mock_registrar):
        """Funcion conveniente para auditar cambio de campo."""
        from backend.services.audit_service import auditar_modificacion

        auditar_modificacion(
            entidad="solicitud",
            entidad_id="123",
            actor_id="user_1",
            campo="centro",
            valor_anterior="1008",
            valor_nuevo="1050",
        )

        mock_registrar.assert_called_once()
        call_kwargs = mock_registrar.call_args[1]
        assert call_kwargs["campo_modificado"] == "centro"
        assert call_kwargs["valor_anterior"] == "1008"
        assert call_kwargs["valor_nuevo"] == "1050"


class TestAuditoriaPresupuesto:
    """Tests para auditoria especifica de presupuestos."""

    @pytest.fixture
    def mock_registrar(self):
        """Mock de la funcion registrar_accion."""
        with patch("backend.services.audit_service.registrar_accion") as mock:
            mock.return_value = 1
            yield mock

    def test_auditar_consumo_presupuesto(self, mock_registrar):
        """Debe auditar cuando se consume presupuesto."""
        from backend.services.audit_service import auditar_consumo_presupuesto

        auditar_consumo_presupuesto(
            centro="1008",
            sector="Mantenimiento",
            monto_cents=500000,
            solicitud_id=123,
            actor_id="sistema",
        )

        mock_registrar.assert_called_once()
        call_kwargs = mock_registrar.call_args[1]
        assert call_kwargs["entidad"] == "presupuesto"
        assert call_kwargs["accion"] == "consumo"

    def test_auditar_reversion_presupuesto(self, mock_registrar):
        """Debe auditar cuando se revierte presupuesto."""
        from backend.services.audit_service import \
            auditar_reversion_presupuesto

        auditar_reversion_presupuesto(
            centro="1008",
            sector="Mantenimiento",
            monto_cents=500000,
            solicitud_id=123,
            motivo="Solicitud rechazada",
            actor_id="sistema",
        )

        mock_registrar.assert_called_once()
        call_kwargs = mock_registrar.call_args[1]
        assert call_kwargs["accion"] == "reversion"


class TestFormatoRegistroAuditoria:
    """Tests para el formato de los registros de auditoria."""

    def test_registro_tiene_timestamp_iso8601(self):
        """El timestamp debe estar en formato ISO 8601."""
        from backend.services.audit_service import formatear_timestamp

        timestamp = formatear_timestamp()

        # Debe ser un string con formato ISO
        assert isinstance(timestamp, str)
        assert "T" in timestamp
        # Debe poder parsearse como datetime
        datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

    def test_serializar_datos_a_json(self):
        """Datos adicionales deben serializarse como JSON."""
        from backend.services.audit_service import serializar_datos

        datos = {"key1": "value1", "key2": 123}
        resultado = serializar_datos(datos)

        assert isinstance(resultado, str)
        parsed = json.loads(resultado)
        assert parsed == datos

    def test_serializar_none_retorna_none(self):
        """Si los datos son None, debe retornar None."""
        from backend.services.audit_service import serializar_datos

        resultado = serializar_datos(None)
        assert resultado is None


class TestValidacionesAuditoria:
    """Tests para validaciones de entrada en auditoria."""

    def test_entidad_no_puede_ser_vacia(self):
        """La entidad es obligatoria."""
        from backend.services.audit_service import (AuditoriaValidationError,
                                                    validar_entrada_auditoria)

        with pytest.raises(AuditoriaValidationError):
            validar_entrada_auditoria(
                entidad="", entidad_id="123", accion="crear", actor_id="user_1"
            )

    def test_accion_no_puede_ser_vacia(self):
        """La accion es obligatoria."""
        from backend.services.audit_service import (AuditoriaValidationError,
                                                    validar_entrada_auditoria)

        with pytest.raises(AuditoriaValidationError):
            validar_entrada_auditoria(
                entidad="solicitud", entidad_id="123", accion="", actor_id="user_1"
            )

    def test_actor_id_no_puede_ser_vacio(self):
        """El actor_id es obligatorio."""
        from backend.services.audit_service import (AuditoriaValidationError,
                                                    validar_entrada_auditoria)

        with pytest.raises(AuditoriaValidationError):
            validar_entrada_auditoria(
                entidad="solicitud", entidad_id="123", accion="crear", actor_id=""
            )

    def test_entrada_valida_no_lanza_excepcion(self):
        """Una entrada valida no debe lanzar excepcion."""
        from backend.services.audit_service import validar_entrada_auditoria

        # No debe lanzar excepcion
        validar_entrada_auditoria(
            entidad="solicitud", entidad_id="123", accion="crear", actor_id="user_1"
        )


class TestExcepcionesAuditoria:
    """Tests para excepciones del servicio de auditoria."""

    def test_auditoria_validation_error_mensaje(self):
        """AuditoriaValidationError debe tener mensaje descriptivo."""
        from backend.services.audit_service import AuditoriaValidationError

        error = AuditoriaValidationError("Campo 'entidad' es requerido")
        assert "entidad" in str(error)
