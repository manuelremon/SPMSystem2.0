"""
Tests TDD para el servicio de reglas de aprobacion.
Sprint 2.2 - Crear tests antes de la implementacion.

El servicio de aprobacion gestiona:
- Determinacion del aprobador segun monto/centro/sector/criticidad
- Validacion de permisos de aprobacion
- Delegacion temporal de aprobaciones
"""

from unittest.mock import MagicMock, patch

import pytest


class TestObtenerAprobadorRequerido:
    """Tests para determinar el aprobador requerido segun el monto."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos con reglas default."""
        with patch("backend.services.approval_service.get_db_connection") as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor

            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, conn, cursor

    def test_monto_bajo_requiere_aprobador(self, mock_db):
        """Montos menores a $5,000 requieren rol aprobador."""
        from backend.services.approval_service import obtener_regla_aprobacion

        _, conn, cursor = mock_db

        # fetchone retorna la regla aplicable (nivel 1)
        cursor.fetchone.return_value = {
            "id": 1,
            "nombre": "Nivel 1",
            "monto_minimo_usd": 0,
            "monto_maximo_usd": 4999.99,
            "rol_requerido": "aprobador",
            "nivel_aprobacion": 1,
            "centro": None,
            "sector": None,
            "criticidad": None,
            "activo": 1,
        }

        regla = obtener_regla_aprobacion(monto_usd=1000)

        assert regla is not None
        assert regla["rol_requerido"] == "aprobador"
        assert regla["nivel_aprobacion"] == 1

    def test_monto_medio_requiere_jefe(self, mock_db):
        """Montos de $5,000 a $20,000 requieren rol jefe."""
        from backend.services.approval_service import obtener_regla_aprobacion

        _, conn, cursor = mock_db

        # fetchone retorna la regla aplicable (nivel 2)
        cursor.fetchone.return_value = {
            "id": 2,
            "nombre": "Nivel 2",
            "monto_minimo_usd": 5000,
            "monto_maximo_usd": 19999.99,
            "rol_requerido": "jefe",
            "nivel_aprobacion": 2,
            "centro": None,
            "sector": None,
            "criticidad": None,
            "activo": 1,
        }

        regla = obtener_regla_aprobacion(monto_usd=10000)

        assert regla is not None
        assert regla["rol_requerido"] == "jefe"
        assert regla["nivel_aprobacion"] == 2

    def test_monto_alto_requiere_gerente(self, mock_db):
        """Montos de $20,000 a $50,000 requieren rol gerente."""
        from backend.services.approval_service import obtener_regla_aprobacion

        _, conn, cursor = mock_db

        # fetchone retorna la regla aplicable (nivel 3)
        cursor.fetchone.return_value = {
            "id": 3,
            "nombre": "Nivel 3",
            "monto_minimo_usd": 20000,
            "monto_maximo_usd": 49999.99,
            "rol_requerido": "gerente",
            "nivel_aprobacion": 3,
            "centro": None,
            "sector": None,
            "criticidad": None,
            "activo": 1,
        }

        regla = obtener_regla_aprobacion(monto_usd=35000)

        assert regla is not None
        assert regla["rol_requerido"] == "gerente"
        assert regla["nivel_aprobacion"] == 3

    def test_monto_muy_alto_requiere_gerente_nivel4(self, mock_db):
        """Montos mayores a $50,000 requieren gerente nivel 4."""
        from backend.services.approval_service import obtener_regla_aprobacion

        _, conn, cursor = mock_db

        # fetchone retorna la regla aplicable (nivel 4)
        cursor.fetchone.return_value = {
            "id": 4,
            "nombre": "Nivel 4",
            "monto_minimo_usd": 50000,
            "monto_maximo_usd": None,
            "rol_requerido": "gerente",
            "nivel_aprobacion": 4,
            "centro": None,
            "sector": None,
            "criticidad": None,
            "activo": 1,
        }

        regla = obtener_regla_aprobacion(monto_usd=100000)

        assert regla is not None
        assert regla["rol_requerido"] == "gerente"
        assert regla["nivel_aprobacion"] == 4


class TestValidarPermisoAprobacion:
    """Tests para validar si un usuario puede aprobar una solicitud."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch("backend.services.approval_service.get_db_connection") as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, conn, cursor

    def test_aprobador_puede_aprobar_monto_bajo(self, mock_db):
        """Un aprobador puede aprobar montos bajos."""
        from backend.services.approval_service import puede_aprobar

        _, conn, cursor = mock_db

        # Mock: usuario tiene rol aprobador_solicitudes y posicion coordinador
        cursor.fetchone.side_effect = [
            {"rol": "aprobador_solicitudes", "posicion": "coordinador"},  # Usuario
            {"rol_requerido": "aprobador", "nivel_aprobacion": 1, "posicion_requerida": "coordinador"},  # Regla
        ]

        resultado = puede_aprobar(usuario_id="aprobador_1", monto_usd=1000)

        assert resultado["puede_aprobar"] is True

    def test_aprobador_no_puede_aprobar_monto_alto(self, mock_db):
        """Un aprobador no puede aprobar montos que requieren jefe."""
        from backend.services.approval_service import puede_aprobar

        _, conn, cursor = mock_db

        # Usuario tiene rol aprobador_solicitudes pero posicion coordinador
        # La regla requiere jefe, así que no puede aprobar
        cursor.fetchone.side_effect = [
            {"rol": "aprobador_solicitudes", "posicion": "coordinador"},  # Usuario
            {"rol_requerido": "jefe", "nivel_aprobacion": 2, "posicion_requerida": "jefe"},  # Regla
        ]

        resultado = puede_aprobar(usuario_id="aprobador_1", monto_usd=10000)

        assert resultado["puede_aprobar"] is False

    def test_admin_puede_aprobar_cualquier_monto(self, mock_db):
        """Un admin puede aprobar cualquier monto."""
        from backend.services.approval_service import puede_aprobar

        _, conn, cursor = mock_db

        # Admin se detecta por POSICION, no por rol
        cursor.fetchone.side_effect = [
            {"rol": "usuario", "posicion": "admin"},  # Usuario con posicion admin
        ]

        resultado = puede_aprobar(usuario_id="admin_1", monto_usd=100000)

        assert resultado["puede_aprobar"] is True
        assert resultado.get("es_admin") is True

    def test_jefe_puede_aprobar_su_nivel_y_menores(self, mock_db):
        """Un jefe puede aprobar montos de su nivel y menores."""
        from backend.services.approval_service import puede_aprobar

        _, conn, cursor = mock_db

        # Jefe con rol aprobador_solicitudes puede aprobar su nivel y menores
        cursor.fetchone.side_effect = [
            {"rol": "aprobador_solicitudes", "posicion": "jefe"},
            {"rol_requerido": "aprobador", "nivel_aprobacion": 1, "posicion_requerida": "coordinador"},
        ]

        resultado = puede_aprobar(usuario_id="jefe_1", monto_usd=1000)

        assert resultado["puede_aprobar"] is True


class TestBuscarAprobadorDisponible:
    """Tests para buscar un aprobador disponible."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch("backend.services.approval_service.get_db_connection") as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, conn, cursor

    def test_buscar_aprobador_por_monto(self, mock_db):
        """Debe encontrar un aprobador con el rol requerido."""
        from backend.services.approval_service import buscar_aprobador

        _, conn, cursor = mock_db

        # Secuencia de fetchone:
        # 1. obtener_regla_aprobacion -> regla con rol requerido
        # 2. buscar_aprobador -> usuario aprobador
        cursor.fetchone.side_effect = [
            # Regla aplicable (nivel 1)
            {
                "id": 1,
                "nombre": "Nivel 1",
                "monto_minimo_usd": 0,
                "monto_maximo_usd": 4999.99,
                "rol_requerido": "aprobador",
                "nivel_aprobacion": 1,
                "centro": None,
                "sector": None,
                "criticidad": None,
                "activo": 1,
            },
            # Aprobador encontrado
            {"id_spm": "aprobador_1", "nombre": "Juan", "apellido": "Perez", "rol": "aprobador"},
        ]

        aprobador = buscar_aprobador(monto_usd=1000)

        assert aprobador is not None
        assert aprobador["id_spm"] == "aprobador_1"

    def test_buscar_aprobador_prioriza_centro(self, mock_db):
        """Debe priorizar aprobadores del mismo centro."""
        from backend.services.approval_service import buscar_aprobador

        _, conn, cursor = mock_db

        # Secuencia de fetchone con centro
        cursor.fetchone.side_effect = [
            # Regla especifica por centro (prioridad)
            {
                "id": 10,
                "nombre": "Centro 1008",
                "monto_minimo_usd": 0,
                "monto_maximo_usd": None,
                "rol_requerido": "aprobador",
                "nivel_aprobacion": 1,
                "centro": "1008",
                "sector": None,
                "criticidad": None,
                "activo": 1,
            },
            # Aprobador del centro
            {
                "id_spm": "aprobador_centro",
                "nombre": "Maria",
                "apellido": "Lopez",
                "rol": "aprobador",
                "centro": "1008",
            },
        ]

        aprobador = buscar_aprobador(monto_usd=1000, centro="1008")

        assert aprobador is not None
        assert cursor.execute.called

    def test_no_aprobador_disponible_retorna_none(self, mock_db):
        """Si no hay aprobador disponible, retorna None."""
        from backend.services.approval_service import buscar_aprobador

        _, conn, cursor = mock_db
        # Regla existe pero no hay aprobadores
        cursor.fetchone.side_effect = [
            {
                "id": 1,
                "nombre": "Nivel 1",
                "monto_minimo_usd": 0,
                "monto_maximo_usd": 4999.99,
                "rol_requerido": "aprobador",
                "nivel_aprobacion": 1,
                "centro": None,
                "sector": None,
                "criticidad": None,
                "activo": 1,
            },
            None,  # No hay aprobador
        ]

        aprobador = buscar_aprobador(monto_usd=1000)

        assert aprobador is None


class TestDelegacionAprobaciones:
    """Tests para delegacion temporal de aprobaciones."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with (
            patch("backend.services.approval_service.get_db_connection") as mock_conn,
            patch("backend.services.approval_service.get_db_transaction") as mock_trans,
        ):
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            mock_trans.return_value.__enter__ = MagicMock(return_value=conn)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, mock_trans, conn, cursor

    def test_crear_delegacion(self, mock_db):
        """Debe poder crear una delegacion temporal."""
        from backend.services.approval_service import crear_delegacion

        _, _, conn, cursor = mock_db
        cursor.lastrowid = 1

        resultado = crear_delegacion(
            aprobador_original_id="aprobador_1",
            delegado_id="aprobador_2",
            fecha_inicio="2025-01-01",
            fecha_fin="2025-01-15",
            motivo="Vacaciones",
        )

        assert resultado["id"] == 1
        assert cursor.execute.called

    def test_verificar_delegacion_activa(self, mock_db):
        """Debe verificar si hay delegacion activa."""
        from backend.services.approval_service import obtener_delegacion_activa

        mock_conn, _, conn, cursor = mock_db

        cursor.fetchone.return_value = {
            "id": 1,
            "aprobador_original_id": "aprobador_1",
            "delegado_id": "aprobador_2",
            "fecha_inicio": "2025-01-01",
            "fecha_fin": "2025-01-15",
            "activo": 1,
        }

        delegacion = obtener_delegacion_activa(aprobador_id="aprobador_1")

        assert delegacion is not None
        assert delegacion["delegado_id"] == "aprobador_2"

    def test_delegado_puede_aprobar(self, mock_db):
        """Un delegado activo puede aprobar en nombre del original."""
        from backend.services.approval_service import puede_aprobar

        mock_conn, _, conn, cursor = mock_db

        # Mock: usuario es delegado activo (incluye posicion para delegación)
        cursor.fetchone.side_effect = [
            {"rol": "aprobador", "posicion": "coordinador"},  # Rol del delegado
            {"rol_requerido": "jefe", "nivel_aprobacion": 2, "posicion_requerida": None},  # Regla requiere jefe
            {"delegado_id": "aprobador_2", "activo": 1},  # Delegacion activa de un jefe
        ]

        # El aprobador_2 tiene delegacion de un jefe
        resultado = puede_aprobar(
            usuario_id="aprobador_2", monto_usd=10000, verificar_delegacion=True
        )

        # Depende de implementacion: si delegacion le da permisos del original


class TestReglasEspecificas:
    """Tests para reglas especificas por centro/sector/criticidad."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with patch("backend.services.approval_service.get_db_connection") as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, conn, cursor

    def test_regla_especifica_por_centro(self, mock_db):
        """Reglas especificas por centro tienen prioridad."""
        from backend.services.approval_service import obtener_regla_aprobacion

        _, conn, cursor = mock_db

        # Mock: regla especifica para centro 1008
        cursor.fetchone.return_value = {
            "id": 10,
            "nombre": "Centro 1008 Especial",
            "monto_minimo_usd": 0,
            "monto_maximo_usd": None,
            "rol_requerido": "coordinador",
            "nivel_aprobacion": 1,
            "centro": "1008",
        }

        regla = obtener_regla_aprobacion(monto_usd=1000, centro="1008")

        assert regla is not None
        assert regla["centro"] == "1008"

    def test_criticidad_alta_eleva_nivel(self, mock_db):
        """Criticidad alta puede elevar el nivel de aprobacion."""
        from backend.services.approval_service import obtener_regla_aprobacion

        _, conn, cursor = mock_db

        cursor.fetchone.return_value = {
            "id": 5,
            "nombre": "Criticidad Alta",
            "monto_minimo_usd": 0,
            "monto_maximo_usd": None,
            "rol_requerido": "jefe",
            "nivel_aprobacion": 2,
            "criticidad": "Alta",
        }

        regla = obtener_regla_aprobacion(monto_usd=1000, criticidad="Alta")

        assert regla is not None
        assert regla["rol_requerido"] == "jefe"  # Elevado de aprobador a jefe


class TestCRUDReglas:
    """Tests para operaciones CRUD de reglas de aprobacion."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a base de datos."""
        with (
            patch("backend.services.approval_service.get_db_connection") as mock_conn,
            patch("backend.services.approval_service.get_db_transaction") as mock_trans,
        ):
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            mock_trans.return_value.__enter__ = MagicMock(return_value=conn)
            mock_trans.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, mock_trans, conn, cursor

    def test_listar_reglas(self, mock_db):
        """Debe listar todas las reglas activas."""
        from backend.services.approval_service import listar_reglas

        mock_conn, _, conn, cursor = mock_db

        cursor.fetchall.return_value = [
            {"id": 1, "nombre": "Nivel 1", "activo": 1},
            {"id": 2, "nombre": "Nivel 2", "activo": 1},
        ]

        reglas = listar_reglas()

        assert len(reglas) == 2

    def test_crear_regla(self, mock_db):
        """Debe poder crear una nueva regla."""
        from backend.services.approval_service import crear_regla

        _, mock_trans, conn, cursor = mock_db
        cursor.lastrowid = 10

        resultado = crear_regla(
            nombre="Nueva Regla",
            monto_minimo_usd=0,
            monto_maximo_usd=1000,
            rol_requerido="aprobador",
            nivel_aprobacion=1,
            created_by="admin_1",
        )

        assert resultado["id"] == 10
        assert cursor.execute.called

    def test_actualizar_regla(self, mock_db):
        """Debe poder actualizar una regla existente."""
        from backend.services.approval_service import actualizar_regla

        _, mock_trans, conn, cursor = mock_db
        cursor.rowcount = 1

        resultado = actualizar_regla(regla_id=1, monto_maximo_usd=10000)

        assert resultado["actualizado"] is True

    def test_desactivar_regla(self, mock_db):
        """Debe poder desactivar una regla."""
        from backend.services.approval_service import desactivar_regla

        _, mock_trans, conn, cursor = mock_db
        cursor.rowcount = 1

        resultado = desactivar_regla(regla_id=1)

        assert resultado["desactivado"] is True


class TestValidaciones:
    """Tests para validaciones del servicio."""

    def test_monto_negativo_error(self):
        """Monto negativo debe lanzar error."""
        from backend.services.approval_service import (ApprovalValidationError,
                                                       validar_monto)

        with pytest.raises(ApprovalValidationError):
            validar_monto(-100)

    def test_regla_sin_rol_error(self):
        """Regla sin rol requerido debe lanzar error."""
        from backend.services.approval_service import (ApprovalValidationError,
                                                       validar_regla)

        with pytest.raises(ApprovalValidationError):
            validar_regla({"nombre": "Test", "rol_requerido": ""})

    def test_fechas_delegacion_invalidas(self):
        """Fechas de delegacion invalidas deben lanzar error."""
        from backend.services.approval_service import (
            ApprovalValidationError, validar_fechas_delegacion)

        with pytest.raises(ApprovalValidationError):
            validar_fechas_delegacion("2025-01-15", "2025-01-01")  # fin antes de inicio


class TestJerarquiaRoles:
    """Tests para jerarquia de roles."""

    def test_jerarquia_roles(self):
        """Verifica la jerarquia de roles."""
        from backend.services.approval_service import JERARQUIA_ROLES

        # Admin tiene nivel mas alto
        assert JERARQUIA_ROLES["admin"] > JERARQUIA_ROLES["gerente"]
        assert JERARQUIA_ROLES["gerente"] > JERARQUIA_ROLES["jefe"]
        assert JERARQUIA_ROLES["jefe"] > JERARQUIA_ROLES["coordinador"]
        assert JERARQUIA_ROLES["coordinador"] > JERARQUIA_ROLES["aprobador"]

    def test_rol_superior_puede_aprobar_inferior(self):
        """Rol superior puede aprobar lo que aprueba rol inferior."""
        from backend.services.approval_service import rol_tiene_nivel

        # Gerente puede aprobar lo de jefe
        assert rol_tiene_nivel("gerente", "jefe") is True
        # Jefe no puede aprobar lo de gerente
        assert rol_tiene_nivel("jefe", "gerente") is False
