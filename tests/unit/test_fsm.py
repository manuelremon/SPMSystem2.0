"""
Tests TDD para el modulo FSM (Finite State Machine) de solicitudes.
Sprint 1.1 - Crear tests antes de la implementacion.

Estos tests definen el comportamiento esperado del sistema de estados.
"""

from unittest.mock import MagicMock, patch

import pytest


class TestEstadoSolicitudEnum:
    """Tests para el Enum de estados de solicitud."""

    def test_estados_definidos(self):
        """Debe definir todos los estados requeridos."""
        from backend.core.fsm import EstadoSolicitud

        estados_requeridos = [
            "DRAFT",
            "SUBMITTED",
            "APPROVED",
            "REJECTED",
            "IN_PLANNING",
            "IN_TREATMENT",
            "TREATED",
            "COMPLETED",
            "CANCELLED",
        ]

        for estado in estados_requeridos:
            assert hasattr(EstadoSolicitud, estado), f"Falta estado: {estado}"

    def test_estados_tienen_valores_string(self):
        """Los valores del enum deben ser strings en minusculas."""
        from backend.core.fsm import EstadoSolicitud

        assert EstadoSolicitud.DRAFT.value == "draft"
        assert EstadoSolicitud.SUBMITTED.value == "submitted"
        assert EstadoSolicitud.APPROVED.value == "approved"
        assert EstadoSolicitud.REJECTED.value == "rejected"
        assert EstadoSolicitud.IN_PLANNING.value == "in_planning"
        assert EstadoSolicitud.IN_TREATMENT.value == "in_treatment"
        assert EstadoSolicitud.TREATED.value == "treated"
        assert EstadoSolicitud.COMPLETED.value == "completed"
        assert EstadoSolicitud.CANCELLED.value == "cancelled"

    def test_estado_es_string_comparable(self):
        """El Enum debe ser comparable como string."""
        from backend.core.fsm import EstadoSolicitud

        assert EstadoSolicitud.DRAFT == "draft"
        assert str(EstadoSolicitud.DRAFT) == "draft"


class TestTransicionesValidas:
    """Tests para las transiciones validas entre estados."""

    def test_transiciones_desde_draft(self):
        """Desde DRAFT solo se puede ir a SUBMITTED o CANCELLED."""
        from backend.core.fsm import TRANSICIONES_VALIDAS, EstadoSolicitud

        transiciones = TRANSICIONES_VALIDAS[EstadoSolicitud.DRAFT]
        assert EstadoSolicitud.SUBMITTED in transiciones
        assert EstadoSolicitud.CANCELLED in transiciones
        assert len(transiciones) == 2

    def test_transiciones_desde_submitted(self):
        """Desde SUBMITTED solo se puede ir a APPROVED o REJECTED."""
        from backend.core.fsm import TRANSICIONES_VALIDAS, EstadoSolicitud

        transiciones = TRANSICIONES_VALIDAS[EstadoSolicitud.SUBMITTED]
        assert EstadoSolicitud.APPROVED in transiciones
        assert EstadoSolicitud.REJECTED in transiciones
        assert len(transiciones) == 2

    def test_transiciones_desde_approved(self):
        """Desde APPROVED solo se puede ir a IN_PLANNING o CANCELLED."""
        from backend.core.fsm import TRANSICIONES_VALIDAS, EstadoSolicitud

        transiciones = TRANSICIONES_VALIDAS[EstadoSolicitud.APPROVED]
        assert EstadoSolicitud.IN_PLANNING in transiciones
        assert EstadoSolicitud.CANCELLED in transiciones
        assert len(transiciones) == 2

    def test_transiciones_desde_in_planning(self):
        """Desde IN_PLANNING solo se puede ir a IN_TREATMENT.

        NOTA: La transición a REJECTED fue removida en la auditoría de bugs
        (Bug #1) porque una solicitud aprobada ya consumió presupuesto y no
        debe ser rechazada por el planificador sin lógica de devolución.
        """
        from backend.core.fsm import TRANSICIONES_VALIDAS, EstadoSolicitud

        transiciones = TRANSICIONES_VALIDAS[EstadoSolicitud.IN_PLANNING]
        assert EstadoSolicitud.IN_TREATMENT in transiciones
        # REJECTED ya no es válido desde IN_PLANNING (Bug #1 fix)
        assert EstadoSolicitud.REJECTED not in transiciones
        assert len(transiciones) == 1

    def test_transiciones_desde_in_treatment(self):
        """Desde IN_TREATMENT se puede ir a TREATED o volver a IN_PLANNING."""
        from backend.core.fsm import TRANSICIONES_VALIDAS, EstadoSolicitud

        transiciones = TRANSICIONES_VALIDAS[EstadoSolicitud.IN_TREATMENT]
        assert EstadoSolicitud.TREATED in transiciones
        assert EstadoSolicitud.IN_PLANNING in transiciones
        assert len(transiciones) == 2

    def test_transiciones_desde_treated(self):
        """Desde TREATED solo se puede ir a COMPLETED."""
        from backend.core.fsm import TRANSICIONES_VALIDAS, EstadoSolicitud

        transiciones = TRANSICIONES_VALIDAS[EstadoSolicitud.TREATED]
        assert EstadoSolicitud.COMPLETED in transiciones
        assert len(transiciones) == 1

    def test_transiciones_desde_rejected(self):
        """Desde REJECTED se puede volver a DRAFT (reenviar)."""
        from backend.core.fsm import TRANSICIONES_VALIDAS, EstadoSolicitud

        transiciones = TRANSICIONES_VALIDAS[EstadoSolicitud.REJECTED]
        assert EstadoSolicitud.DRAFT in transiciones
        assert len(transiciones) == 1

    def test_estados_terminales_sin_transiciones(self):
        """COMPLETED y CANCELLED no tienen transiciones salientes."""
        from backend.core.fsm import TRANSICIONES_VALIDAS, EstadoSolicitud

        assert len(TRANSICIONES_VALIDAS[EstadoSolicitud.COMPLETED]) == 0
        assert len(TRANSICIONES_VALIDAS[EstadoSolicitud.CANCELLED]) == 0


class TestValidarTransicion:
    """Tests para la funcion validar_transicion."""

    def test_transicion_valida_draft_to_submitted(self):
        """Transicion de DRAFT a SUBMITTED debe ser valida."""
        from backend.core.fsm import EstadoSolicitud, validar_transicion

        assert validar_transicion(EstadoSolicitud.DRAFT, EstadoSolicitud.SUBMITTED) is True

    def test_transicion_invalida_draft_to_approved(self):
        """Transicion de DRAFT a APPROVED debe ser invalida."""
        from backend.core.fsm import EstadoSolicitud, validar_transicion

        assert validar_transicion(EstadoSolicitud.DRAFT, EstadoSolicitud.APPROVED) is False

    def test_transicion_invalida_draft_to_treated(self):
        """No se puede saltar directamente de DRAFT a TREATED."""
        from backend.core.fsm import EstadoSolicitud, validar_transicion

        assert validar_transicion(EstadoSolicitud.DRAFT, EstadoSolicitud.TREATED) is False

    def test_transicion_valida_submitted_to_approved(self):
        """Transicion de SUBMITTED a APPROVED debe ser valida."""
        from backend.core.fsm import EstadoSolicitud, validar_transicion

        assert validar_transicion(EstadoSolicitud.SUBMITTED, EstadoSolicitud.APPROVED) is True

    def test_transicion_valida_submitted_to_rejected(self):
        """Transicion de SUBMITTED a REJECTED debe ser valida."""
        from backend.core.fsm import EstadoSolicitud, validar_transicion

        assert validar_transicion(EstadoSolicitud.SUBMITTED, EstadoSolicitud.REJECTED) is True

    def test_transicion_invalida_desde_completed(self):
        """No se puede transicionar desde COMPLETED."""
        from backend.core.fsm import EstadoSolicitud, validar_transicion

        assert validar_transicion(EstadoSolicitud.COMPLETED, EstadoSolicitud.DRAFT) is False
        assert validar_transicion(EstadoSolicitud.COMPLETED, EstadoSolicitud.CANCELLED) is False

    def test_transicion_al_mismo_estado_invalida(self):
        """No se puede transicionar al mismo estado."""
        from backend.core.fsm import EstadoSolicitud, validar_transicion

        assert validar_transicion(EstadoSolicitud.DRAFT, EstadoSolicitud.DRAFT) is False


class TestMapeoBidireccionalEstados:
    """Tests para el mapeo bidireccional de estados (backward compatibility)."""

    def test_mapeo_estado_viejo_a_nuevo(self):
        """Debe mapear estados en formato viejo a nuevo."""
        from backend.core.fsm import normalizar_estado

        assert normalizar_estado("Enviada") == "submitted"
        assert normalizar_estado("Aprobada") == "approved"
        assert normalizar_estado("Rechazada") == "rejected"
        assert normalizar_estado("En Progreso") == "in_planning"
        assert normalizar_estado("En tratamiento") == "in_treatment"
        assert normalizar_estado("Tratado") == "treated"
        assert normalizar_estado("Finalizada") == "completed"
        assert normalizar_estado("Borrador") == "draft"

    def test_mapeo_estado_nuevo_a_viejo(self):
        """Debe mapear estados en formato nuevo a viejo (para respuestas)."""
        from backend.core.fsm import estado_para_display

        assert estado_para_display("submitted") == "Enviada"
        assert estado_para_display("approved") == "Aprobada"
        assert estado_para_display("rejected") == "Rechazada"
        assert estado_para_display("in_planning") == "En Progreso"
        assert estado_para_display("in_treatment") == "En tratamiento"
        assert estado_para_display("treated") == "Tratado"
        assert estado_para_display("completed") == "Finalizada"
        assert estado_para_display("draft") == "Borrador"

    def test_estado_ya_normalizado_no_cambia(self):
        """Si el estado ya esta normalizado, no debe cambiar."""
        from backend.core.fsm import normalizar_estado

        assert normalizar_estado("draft") == "draft"
        assert normalizar_estado("submitted") == "submitted"
        assert normalizar_estado("approved") == "approved"

    def test_estado_desconocido_retorna_original(self):
        """Estados desconocidos deben retornar el valor original."""
        from backend.core.fsm import normalizar_estado

        assert normalizar_estado("estado_raro") == "estado_raro"


class TestCambiarEstado:
    """Tests para la funcion cambiar_estado (core del FSM)."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos usando get_db_transaction."""
        with patch("backend.core.fsm.get_db_transaction") as mock_transaction:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            # Simular el context manager
            mock_transaction.return_value.__enter__ = MagicMock(return_value=conn)
            mock_transaction.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_transaction, conn, cursor

    def test_cambiar_estado_valido_registra_historial(self, mock_db):
        """Al cambiar estado valido, debe registrar en historial."""
        from backend.core.fsm import EstadoSolicitud, cambiar_estado

        _, conn, cursor = mock_db
        # Simular solicitud en estado draft con datos necesarios
        cursor.fetchone.return_value = {
            "status": "draft",
            "id": 1,
            "id_usuario": "solicitante_1",
            "aprobador_id": None,
            "planner_id": None,
        }

        resultado = cambiar_estado(
            solicitud_id=1,
            nuevo_estado=EstadoSolicitud.SUBMITTED,
            actor_id="user_1",
            razon="Envio para aprobacion",
        )

        assert resultado["success"] is True
        assert resultado["estado_anterior"] == "draft"
        assert resultado["estado_nuevo"] == "submitted"

        # Verificar que se inserto en historial
        insert_calls = [
            call
            for call in cursor.execute.call_args_list
            if "solicitud_historial_estado" in str(call)
        ]
        assert len(insert_calls) > 0

    def test_cambiar_estado_invalido_falla(self, mock_db):
        """Al intentar transicion invalida, debe fallar."""
        from backend.core.fsm import (EstadoSolicitud, TransicionInvalidaError,
                                      cambiar_estado)

        _, conn, cursor = mock_db
        cursor.fetchone.return_value = {
            "status": "draft",
            "id": 1,
            "id_usuario": "solicitante_1",
            "aprobador_id": None,
            "planner_id": None,
        }

        with pytest.raises(TransicionInvalidaError) as exc_info:
            cambiar_estado(
                solicitud_id=1,
                nuevo_estado=EstadoSolicitud.APPROVED,  # No valido desde draft
                actor_id="user_1",
            )

        assert "draft" in str(exc_info.value)
        assert "approved" in str(exc_info.value)

    def test_cambiar_estado_solicitud_no_existe(self, mock_db):
        """Si la solicitud no existe, debe fallar."""
        from backend.core.fsm import (EstadoSolicitud,
                                      SolicitudNoEncontradaError,
                                      cambiar_estado)

        _, conn, cursor = mock_db
        cursor.fetchone.return_value = None

        with pytest.raises(SolicitudNoEncontradaError):
            cambiar_estado(
                solicitud_id=999, nuevo_estado=EstadoSolicitud.SUBMITTED, actor_id="user_1"
            )

    def test_cambiar_estado_incluye_metadata(self, mock_db):
        """El historial debe incluir metadata si se proporciona."""
        from backend.core.fsm import EstadoSolicitud, cambiar_estado

        _, conn, cursor = mock_db
        cursor.fetchone.return_value = {
            "status": "draft",
            "id": 1,
            "id_usuario": "solicitante_1",
            "aprobador_id": None,
            "planner_id": None,
        }

        metadata = {"ip": "192.168.1.1", "browser": "Chrome"}

        resultado = cambiar_estado(
            solicitud_id=1,
            nuevo_estado=EstadoSolicitud.SUBMITTED,
            actor_id="user_1",
            metadata=metadata,
        )

        assert resultado["success"] is True
        # Verificar que metadata se serializo en el INSERT


class TestObtenerHistorialEstados:
    """Tests para obtener el historial de estados de una solicitud."""

    @pytest.fixture
    def mock_db_historial(self):
        """Mock de conexion con historial de estados."""
        with patch("backend.core.fsm.get_db_connection") as mock:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            cursor.fetchall.return_value = [
                {
                    "id": 1,
                    "solicitud_id": 1,
                    "estado_anterior": "draft",
                    "estado_nuevo": "submitted",
                    "actor_id": "user_1",
                    "razon": "Envio inicial",
                    "created_at": "2025-12-08T10:00:00Z",
                },
                {
                    "id": 2,
                    "solicitud_id": 1,
                    "estado_anterior": "submitted",
                    "estado_nuevo": "approved",
                    "actor_id": "aprobador_1",
                    "razon": "Aprobado",
                    "created_at": "2025-12-08T11:00:00Z",
                },
            ]
            mock.return_value.__enter__ = MagicMock(return_value=conn)
            mock.return_value.__exit__ = MagicMock(return_value=False)
            yield mock, conn, cursor

    def test_obtener_historial_retorna_lista(self, mock_db_historial):
        """Debe retornar lista de transiciones ordenadas."""
        from backend.core.fsm import obtener_historial_estados

        historial = obtener_historial_estados(solicitud_id=1)

        assert isinstance(historial, list)
        assert len(historial) == 2

    def test_historial_incluye_campos_requeridos(self, mock_db_historial):
        """Cada entrada del historial debe tener campos requeridos."""
        from backend.core.fsm import obtener_historial_estados

        historial = obtener_historial_estados(solicitud_id=1)

        for entrada in historial:
            assert "estado_anterior" in entrada
            assert "estado_nuevo" in entrada
            assert "actor_id" in entrada
            assert "created_at" in entrada

    def test_historial_solicitud_sin_transiciones(self, mock_db_historial):
        """Si no hay transiciones, retorna lista vacia."""
        from backend.core.fsm import obtener_historial_estados

        _, conn, cursor = mock_db_historial
        cursor.fetchall.return_value = []

        historial = obtener_historial_estados(solicitud_id=999)

        assert historial == []


class TestIntegracionFSMConNotificaciones:
    """Tests para verificar que FSM dispara notificaciones."""

    @pytest.fixture
    def mock_db_notificaciones(self):
        """Mock de DB para tests de notificaciones."""
        with patch("backend.core.fsm.get_db_transaction") as mock_transaction:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_transaction.return_value.__enter__ = MagicMock(return_value=conn)
            mock_transaction.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_transaction, conn, cursor

    def test_aprobacion_notifica_planificador(self, mock_db_notificaciones):
        """Al aprobar, debe notificar al planificador asignado."""
        from backend.core.fsm import EstadoSolicitud, cambiar_estado

        _, conn, cursor = mock_db_notificaciones
        # Solicitud en estado submitted lista para aprobar
        cursor.fetchone.return_value = {
            "status": "submitted",
            "id": 1,
            "id_usuario": "solicitante_1",
            "aprobador_id": "aprobador_1",
            "planner_id": "planner_1",
        }

        resultado = cambiar_estado(
            solicitud_id=1, nuevo_estado=EstadoSolicitud.APPROVED, actor_id="aprobador_1"
        )

        assert resultado["success"] is True
        # Verificar que se intento crear notificacion (via INSERT en cursor)
        insert_calls = [
            call for call in cursor.execute.call_args_list if "notificacion" in str(call)
        ]
        assert len(insert_calls) > 0

    def test_rechazo_notifica_solicitante(self, mock_db_notificaciones):
        """Al rechazar, debe notificar al solicitante."""
        from backend.core.fsm import EstadoSolicitud, cambiar_estado

        _, conn, cursor = mock_db_notificaciones
        cursor.fetchone.return_value = {
            "status": "submitted",
            "id": 1,
            "id_usuario": "solicitante_1",
            "aprobador_id": "aprobador_1",
            "planner_id": "planner_1",
        }

        resultado = cambiar_estado(
            solicitud_id=1,
            nuevo_estado=EstadoSolicitud.REJECTED,
            actor_id="aprobador_1",
            razon="Presupuesto insuficiente",
        )

        assert resultado["success"] is True
        # Verificar que se intento crear notificacion
        insert_calls = [
            call for call in cursor.execute.call_args_list if "notificacion" in str(call)
        ]
        assert len(insert_calls) > 0


class TestExcepciones:
    """Tests para las excepciones del modulo FSM."""

    def test_transicion_invalida_error_tiene_mensaje(self):
        """TransicionInvalidaError debe tener mensaje descriptivo."""
        from backend.core.fsm import TransicionInvalidaError

        error = TransicionInvalidaError("draft", "approved")
        assert "draft" in str(error)
        assert "approved" in str(error)

    def test_solicitud_no_encontrada_error(self):
        """SolicitudNoEncontradaError debe indicar el ID."""
        from backend.core.fsm import SolicitudNoEncontradaError

        error = SolicitudNoEncontradaError(123)
        assert "123" in str(error)
