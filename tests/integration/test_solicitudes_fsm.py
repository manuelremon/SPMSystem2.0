"""
Tests de integracion para el FSM de solicitudes.

Verifica el flujo completo de estados a traves de los endpoints API.
Sprint 1.8 - TDD Integration Tests
"""

import json
import sqlite3
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def mock_db_with_tables():
    """
    Crea una base de datos SQLite en memoria con las tablas necesarias.
    """
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Crear tablas necesarias
    cursor.executescript(
        """
        CREATE TABLE usuarios (
            id INTEGER PRIMARY KEY,
            id_spm TEXT UNIQUE,
            nombre TEXT,
            apellido TEXT,
            email TEXT,
            rol TEXT,
            centro TEXT
        );

        CREATE TABLE solicitudes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_usuario TEXT,
            centro TEXT,
            sector TEXT,
            justificacion TEXT,
            centro_costos TEXT,
            almacen_virtual TEXT,
            criticidad TEXT DEFAULT 'Normal',
            fecha_necesidad TEXT,
            status TEXT DEFAULT 'draft',
            total_monto REAL DEFAULT 0,
            aprobador_id TEXT,
            planner_id TEXT,
            created_at TEXT,
            updated_at TEXT,
            data_json TEXT
        );

        CREATE TABLE solicitudes_historial_estados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            solicitud_id INTEGER NOT NULL,
            estado_anterior TEXT NOT NULL,
            estado_nuevo TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            razon TEXT,
            metadata_json TEXT,
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE audit_trail (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entidad TEXT NOT NULL,
            entidad_id TEXT NOT NULL,
            accion TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            campo_modificado TEXT,
            valor_anterior TEXT,
            valor_nuevo TEXT,
            actor_rol TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE notificaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            destinatario_id TEXT,
            solicitud_id INTEGER,
            mensaje TEXT,
            tipo TEXT DEFAULT 'info',
            leida INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE presupuestos (
            id INTEGER PRIMARY KEY,
            centro TEXT,
            sector TEXT,
            monto_usd REAL,
            saldo_usd REAL
        );

        CREATE TABLE planificador_asignaciones (
            id INTEGER PRIMARY KEY,
            planificador_id TEXT,
            centro TEXT,
            sector TEXT
        );

        -- Insertar datos de prueba
        INSERT INTO usuarios (id_spm, nombre, apellido, email, rol) VALUES
            ('user_1', 'Test', 'User', 'test@test.com', 'usuario'),
            ('aprobador_1', 'Test', 'Aprobador', 'aprobador@test.com', 'aprobador'),
            ('planner_1', 'Test', 'Planner', 'planner@test.com', 'planificador');

        INSERT INTO presupuestos (centro, sector, monto_usd, saldo_usd) VALUES
            ('1008', 'Mantenimiento', 100000, 50000);

        INSERT INTO planificador_asignaciones (planificador_id, centro, sector) VALUES
            ('planner_1', '1008', 'Mantenimiento');
    """
    )

    conn.commit()
    yield conn
    conn.close()


@pytest.fixture
def app_client(mock_db_with_tables):
    """Crea un cliente de test de Flask con la BD mockeada."""

    # Mock de conexion que retorna nuestra BD en memoria
    @contextmanager
    def mock_get_db_connection(db_name=None):
        yield mock_db_with_tables

    @contextmanager
    def mock_get_db_transaction(db_name=None):
        yield mock_db_with_tables

    with (
        patch("backend.core.db.get_db_connection", mock_get_db_connection),
        patch("backend.core.db.get_db_transaction", mock_get_db_transaction),
        patch("backend.core.fsm.get_db_connection", mock_get_db_connection),
        patch("backend.core.fsm.get_db_transaction", mock_get_db_transaction),
        patch("backend.services.audit_service.get_db_connection", mock_get_db_connection),
        patch("backend.services.audit_service.get_db_transaction", mock_get_db_transaction),
    ):
        try:
            from backend.app import create_app

            app = create_app()
            app.config["TESTING"] = True
            with app.test_client() as client:
                yield client, mock_db_with_tables
        except ImportError:
            pytest.skip("No se puede importar la aplicacion Flask")


class TestFSMIntegration:
    """Tests de integracion para el flujo FSM completo."""

    def test_crear_solicitud_estado_inicial_draft(self, mock_db_with_tables):
        """Una solicitud nueva debe tener estado draft."""
        from backend.core.fsm import normalizar_estado

        cursor = mock_db_with_tables.cursor()
        cursor.execute(
            """
            INSERT INTO solicitudes (id_usuario, centro, sector, status, data_json)
            VALUES ('user_1', '1008', 'Mantenimiento', 'draft', '{"items": []}')
        """
        )
        mock_db_with_tables.commit()
        solicitud_id = cursor.lastrowid

        cursor.execute("SELECT status FROM solicitudes WHERE id = ?", (solicitud_id,))
        row = cursor.fetchone()

        assert normalizar_estado(row["status"]) == "draft"

    def test_flujo_completo_draft_to_completed(self, mock_db_with_tables):
        """Test del flujo completo: draft -> submitted -> approved -> in_planning -> in_treatment -> treated -> completed."""
        from backend.core.fsm import (EstadoSolicitud, cambiar_estado,
                                      obtener_historial_estados)

        # Crear solicitud
        cursor = mock_db_with_tables.cursor()
        cursor.execute(
            """
            INSERT INTO solicitudes (id_usuario, centro, sector, status, data_json, planner_id)
            VALUES ('user_1', '1008', 'Mantenimiento', 'draft', '{"items": []}', 'planner_1')
        """
        )
        mock_db_with_tables.commit()
        solicitud_id = cursor.lastrowid

        # Transicion 1: draft -> submitted
        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            resultado = cambiar_estado(
                solicitud_id=solicitud_id,
                nuevo_estado=EstadoSolicitud.SUBMITTED,
                actor_id="user_1",
                razon="Envio para aprobacion",
            )
            assert resultado["success"] is True
            assert resultado["estado_nuevo"] == "submitted"

        # Verificar estado en BD
        cursor.execute("SELECT status FROM solicitudes WHERE id = ?", (solicitud_id,))
        assert cursor.fetchone()["status"] == "submitted"

        # Transicion 2: submitted -> approved
        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            resultado = cambiar_estado(
                solicitud_id=solicitud_id,
                nuevo_estado=EstadoSolicitud.APPROVED,
                actor_id="aprobador_1",
                razon="Aprobado",
            )
            assert resultado["success"] is True
            assert resultado["estado_nuevo"] == "approved"

        # Transicion 3: approved -> in_planning
        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            resultado = cambiar_estado(
                solicitud_id=solicitud_id,
                nuevo_estado=EstadoSolicitud.IN_PLANNING,
                actor_id="planner_1",
                razon="En planificacion",
            )
            assert resultado["success"] is True

        # Transicion 4: in_planning -> in_treatment
        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            resultado = cambiar_estado(
                solicitud_id=solicitud_id,
                nuevo_estado=EstadoSolicitud.IN_TREATMENT,
                actor_id="planner_1",
                razon="Tratando",
            )
            assert resultado["success"] is True

        # Transicion 5: in_treatment -> treated
        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            resultado = cambiar_estado(
                solicitud_id=solicitud_id,
                nuevo_estado=EstadoSolicitud.TREATED,
                actor_id="planner_1",
                razon="Tratado",
            )
            assert resultado["success"] is True

        # Transicion 6: treated -> completed
        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            resultado = cambiar_estado(
                solicitud_id=solicitud_id,
                nuevo_estado=EstadoSolicitud.COMPLETED,
                actor_id="planner_1",
                razon="Completado",
            )
            assert resultado["success"] is True
            assert resultado["estado_nuevo"] == "completed"

        # Verificar historial completo
        with patch("backend.core.fsm.get_db_connection") as mock_conn:
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            historial = obtener_historial_estados(solicitud_id)
            assert len(historial) == 6  # 6 transiciones

    def test_transicion_invalida_rechazada(self, mock_db_with_tables):
        """Transiciones invalidas deben fallar con TransicionInvalidaError."""
        from backend.core.fsm import (EstadoSolicitud, TransicionInvalidaError,
                                      cambiar_estado)

        # Crear solicitud en draft
        cursor = mock_db_with_tables.cursor()
        cursor.execute(
            """
            INSERT INTO solicitudes (id_usuario, centro, sector, status, data_json)
            VALUES ('user_1', '1008', 'Mantenimiento', 'draft', '{"items": []}')
        """
        )
        mock_db_with_tables.commit()
        solicitud_id = cursor.lastrowid

        # Intentar transicion invalida: draft -> approved (debe pasar por submitted)
        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            with pytest.raises(TransicionInvalidaError) as exc_info:
                cambiar_estado(
                    solicitud_id=solicitud_id,
                    nuevo_estado=EstadoSolicitud.APPROVED,
                    actor_id="aprobador_1",
                    razon="Intento invalido",
                )

            assert "draft" in str(exc_info.value).lower()
            assert "approved" in str(exc_info.value).lower()

    def test_estado_completed_es_terminal(self, mock_db_with_tables):
        """Un estado completed no debe permitir mas transiciones."""
        from backend.core.fsm import (EstadoSolicitud, TransicionInvalidaError,
                                      cambiar_estado)

        # Crear solicitud en completed
        cursor = mock_db_with_tables.cursor()
        cursor.execute(
            """
            INSERT INTO solicitudes (id_usuario, centro, sector, status, data_json)
            VALUES ('user_1', '1008', 'Mantenimiento', 'completed', '{"items": []}')
        """
        )
        mock_db_with_tables.commit()
        solicitud_id = cursor.lastrowid

        # Intentar cualquier transicion desde completed
        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            with pytest.raises(TransicionInvalidaError):
                cambiar_estado(
                    solicitud_id=solicitud_id,
                    nuevo_estado=EstadoSolicitud.DRAFT,
                    actor_id="user_1",
                    razon="Volver a draft",
                )


class TestHistorialEstados:
    """Tests para el historial de estados."""

    def test_historial_registra_todas_transiciones(self, mock_db_with_tables):
        """Cada transicion debe quedar registrada en el historial."""
        from backend.core.fsm import (EstadoSolicitud, cambiar_estado,
                                      obtener_historial_estados)

        # Crear solicitud
        cursor = mock_db_with_tables.cursor()
        cursor.execute(
            """
            INSERT INTO solicitudes (id_usuario, centro, sector, status, data_json, planner_id)
            VALUES ('user_1', '1008', 'Mantenimiento', 'draft', '{"items": []}', 'planner_1')
        """
        )
        mock_db_with_tables.commit()
        solicitud_id = cursor.lastrowid

        # Realizar 2 transiciones
        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            cambiar_estado(solicitud_id, EstadoSolicitud.SUBMITTED, "user_1", "Test")

        cursor.execute("UPDATE solicitudes SET status = 'submitted' WHERE id = ?", (solicitud_id,))
        mock_db_with_tables.commit()

        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            cambiar_estado(solicitud_id, EstadoSolicitud.APPROVED, "aprobador_1", "Aprobado")

        # Verificar historial
        with patch("backend.core.fsm.get_db_connection") as mock_conn:
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            historial = obtener_historial_estados(solicitud_id)

        assert len(historial) == 2
        assert historial[0]["estado_anterior"] == "draft"
        assert historial[0]["estado_nuevo"] == "submitted"
        assert historial[1]["estado_anterior"] == "submitted"
        assert historial[1]["estado_nuevo"] == "approved"

    def test_historial_incluye_metadata(self, mock_db_with_tables):
        """El historial debe incluir metadata si se proporciona."""
        from backend.core.fsm import EstadoSolicitud, cambiar_estado

        cursor = mock_db_with_tables.cursor()
        cursor.execute(
            """
            INSERT INTO solicitudes (id_usuario, centro, sector, status, data_json, planner_id)
            VALUES ('user_1', '1008', 'Mantenimiento', 'draft', '{"items": []}', 'planner_1')
        """
        )
        mock_db_with_tables.commit()
        solicitud_id = cursor.lastrowid

        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            cambiar_estado(
                solicitud_id=solicitud_id,
                nuevo_estado=EstadoSolicitud.SUBMITTED,
                actor_id="user_1",
                razon="Envio con metadata",
                metadata={"total_items": 5, "monto_total": 1000.50},
            )

        # Verificar que metadata se guardo
        cursor.execute(
            "SELECT metadata_json FROM solicitudes_historial_estados WHERE solicitud_id = ?",
            (solicitud_id,),
        )
        row = cursor.fetchone()
        assert row is not None
        metadata = json.loads(row["metadata_json"])
        assert metadata["total_items"] == 5
        assert metadata["monto_total"] == 1000.50


class TestBackwardCompatibility:
    """Tests para backward compatibility con estados legacy."""

    def test_estado_legacy_se_normaliza(self, mock_db_with_tables):
        """Estados legacy deben normalizarse correctamente."""
        from backend.core.fsm import normalizar_estado

        assert normalizar_estado("Borrador") == "draft"
        assert normalizar_estado("Enviada") == "submitted"
        assert normalizar_estado("Aprobada") == "approved"
        assert normalizar_estado("Rechazada") == "rejected"
        assert normalizar_estado("En Progreso") == "in_planning"
        assert normalizar_estado("En tratamiento") == "in_treatment"
        assert normalizar_estado("Tratado") == "treated"
        assert normalizar_estado("Finalizada") == "completed"

    def test_estado_display_correcto(self, mock_db_with_tables):
        """Estados normalizados deben convertirse a display correcto."""
        from backend.core.fsm import estado_para_display

        assert estado_para_display("draft") == "Borrador"
        assert estado_para_display("submitted") == "Enviada"
        assert estado_para_display("approved") == "Aprobada"
        assert estado_para_display("rejected") == "Rechazada"
        assert estado_para_display("in_planning") == "En Progreso"
        assert estado_para_display("in_treatment") == "En tratamiento"
        assert estado_para_display("treated") == "Tratado"
        assert estado_para_display("completed") == "Finalizada"

    def test_transicion_funciona_con_estado_legacy(self, mock_db_with_tables):
        """Transiciones deben funcionar con solicitudes en estado legacy."""
        from backend.core.fsm import EstadoSolicitud, cambiar_estado

        # Crear solicitud con estado legacy
        cursor = mock_db_with_tables.cursor()
        cursor.execute(
            """
            INSERT INTO solicitudes (id_usuario, centro, sector, status, data_json, planner_id)
            VALUES ('user_1', '1008', 'Mantenimiento', 'Borrador', '{"items": []}', 'planner_1')
        """
        )
        mock_db_with_tables.commit()
        solicitud_id = cursor.lastrowid

        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            resultado = cambiar_estado(
                solicitud_id=solicitud_id,
                nuevo_estado=EstadoSolicitud.SUBMITTED,
                actor_id="user_1",
                razon="Envio",
            )

        assert resultado["success"] is True
        assert resultado["estado_nuevo"] == "submitted"


class TestNotificaciones:
    """Tests para notificaciones disparadas por el FSM."""

    def test_aprobacion_crea_notificacion(self, mock_db_with_tables):
        """Aprobar una solicitud debe crear notificacion para el planificador."""
        from backend.core.fsm import EstadoSolicitud, cambiar_estado

        cursor = mock_db_with_tables.cursor()
        cursor.execute(
            """
            INSERT INTO solicitudes (id_usuario, centro, sector, status, data_json, planner_id)
            VALUES ('user_1', '1008', 'Mantenimiento', 'submitted', '{"items": []}', 'planner_1')
        """
        )
        mock_db_with_tables.commit()
        solicitud_id = cursor.lastrowid

        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            cambiar_estado(
                solicitud_id=solicitud_id,
                nuevo_estado=EstadoSolicitud.APPROVED,
                actor_id="aprobador_1",
                razon="Aprobado",
            )

        # Verificar que se creo notificacion
        cursor.execute(
            "SELECT * FROM notificaciones WHERE solicitud_id = ? AND destinatario_id = ?",
            (solicitud_id, "planner_1"),
        )
        notif = cursor.fetchone()
        assert notif is not None
        assert "aprobada" in notif["mensaje"].lower()

    def test_rechazo_crea_notificacion(self, mock_db_with_tables):
        """Rechazar una solicitud debe crear notificacion para el solicitante."""
        from backend.core.fsm import EstadoSolicitud, cambiar_estado

        cursor = mock_db_with_tables.cursor()
        cursor.execute(
            """
            INSERT INTO solicitudes (id_usuario, centro, sector, status, data_json, planner_id)
            VALUES ('user_1', '1008', 'Mantenimiento', 'submitted', '{"items": []}', 'planner_1')
        """
        )
        mock_db_with_tables.commit()
        solicitud_id = cursor.lastrowid

        with (
            patch("backend.core.fsm.get_db_transaction") as mock_trans,
            patch("backend.core.fsm.get_db_connection") as mock_conn,
        ):
            mock_trans.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            mock_conn.return_value.__enter__ = MagicMock(return_value=mock_db_with_tables)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)

            cambiar_estado(
                solicitud_id=solicitud_id,
                nuevo_estado=EstadoSolicitud.REJECTED,
                actor_id="aprobador_1",
                razon="Presupuesto insuficiente",
            )

        # Verificar que se creo notificacion
        cursor.execute(
            "SELECT * FROM notificaciones WHERE solicitud_id = ? AND destinatario_id = ?",
            (solicitud_id, "user_1"),
        )
        notif = cursor.fetchone()
        assert notif is not None
        assert "rechazada" in notif["mensaje"].lower()
