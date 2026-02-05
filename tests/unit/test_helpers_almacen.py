"""
Tests para funciones de almacén en helpers.py
Sprint 25 - Auditoría Post-Migración
"""

import json
import pytest
from unittest.mock import patch, MagicMock

from backend.core.helpers import (
    get_user_almacenes,
    validate_almacen_access,
)


class TestGetUserAlmacenes:
    """Tests para get_user_almacenes()"""

    def test_returns_empty_for_none_user_id(self):
        """Debe retornar lista vacía si user_id es None"""
        result = get_user_almacenes(None)
        assert result == []

    def test_returns_empty_for_empty_user_id(self):
        """Debe retornar lista vacía si user_id está vacío"""
        result = get_user_almacenes("")
        assert result == []

    @patch("backend.core.helpers.get_db_connection")
    def test_returns_empty_for_admin_role(self, mock_db):
        """Admins tienen acceso a todos los almacenes (lista vacía)"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {"almacenes": "AA001", "rol": "admin"}
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_db.return_value = mock_conn

        result = get_user_almacenes("user1")
        assert result == []  # Admin = sin restricción

    @patch("backend.core.helpers.get_db_connection")
    def test_parses_json_array(self, mock_db):
        """Debe parsear almacenes en formato JSON array"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "almacenes": '["AA001", "II003"]',
            "rol": "usuario"
        }
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_db.return_value = mock_conn

        result = get_user_almacenes("user1")
        assert result == ["AA001", "II003"]

    @patch("backend.core.helpers.get_db_connection")
    def test_parses_csv_string(self, mock_db):
        """Debe parsear almacenes en formato CSV"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "almacenes": "AA001,II003,AA100",
            "rol": "planificador"
        }
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_db.return_value = mock_conn

        result = get_user_almacenes("user1")
        assert result == ["AA001", "II003", "AA100"]

    @patch("backend.core.helpers.get_db_connection")
    def test_parses_single_value(self, mock_db):
        """Debe parsear almacén único"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "almacenes": "AA001",
            "rol": "usuario"
        }
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_db.return_value = mock_conn

        result = get_user_almacenes("user1")
        assert result == ["AA001"]

    @patch("backend.core.helpers.get_db_connection")
    def test_normalizes_to_uppercase(self, mock_db):
        """Debe normalizar códigos a mayúsculas"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "almacenes": "aa001,ii003",
            "rol": "usuario"
        }
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_db.return_value = mock_conn

        result = get_user_almacenes("user1")
        assert result == ["AA001", "II003"]

    @patch("backend.core.helpers.get_db_connection")
    def test_returns_empty_for_null_almacenes(self, mock_db):
        """Debe retornar lista vacía si almacenes es NULL"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "almacenes": None,
            "rol": "usuario"
        }
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_db.return_value = mock_conn

        result = get_user_almacenes("user1")
        assert result == []

    @patch("backend.core.helpers.get_db_connection")
    def test_returns_empty_for_user_not_found(self, mock_db):
        """Debe retornar lista vacía si usuario no existe"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_db.return_value = mock_conn

        result = get_user_almacenes("nonexistent")
        assert result == []


class TestValidateAlmacenAccess:
    """Tests para validate_almacen_access()"""

    def test_returns_true_for_empty_almacen(self):
        """Debe retornar True si no se especifica almacén"""
        result = validate_almacen_access("user1", "")
        assert result is True

        result = validate_almacen_access("user1", None)
        assert result is True

    @patch("backend.core.helpers.get_user_almacenes")
    def test_returns_true_for_admin(self, mock_get_almacenes):
        """Admin tiene acceso a todos los almacenes"""
        mock_get_almacenes.return_value = []  # Lista vacía = sin restricción
        result = validate_almacen_access("admin_user", "AA001")
        assert result is True

    @patch("backend.core.helpers.get_user_almacenes")
    def test_returns_true_for_permitted_almacen(self, mock_get_almacenes):
        """Debe retornar True si almacén está en lista permitida"""
        mock_get_almacenes.return_value = ["AA001", "II003"]
        result = validate_almacen_access("user1", "AA001")
        assert result is True

    @patch("backend.core.helpers.get_user_almacenes")
    def test_returns_false_for_non_permitted_almacen(self, mock_get_almacenes):
        """Debe retornar False si almacén no está en lista permitida"""
        mock_get_almacenes.return_value = ["AA001", "II003"]
        result = validate_almacen_access("user1", "AA999")
        assert result is False

    @patch("backend.core.helpers.get_user_almacenes")
    def test_normalizes_almacen_to_uppercase(self, mock_get_almacenes):
        """Debe normalizar almacén a mayúsculas para comparación"""
        mock_get_almacenes.return_value = ["AA001", "II003"]
        result = validate_almacen_access("user1", "aa001")  # minúsculas
        assert result is True

    @patch("backend.core.helpers.get_user_almacenes")
    def test_handles_whitespace(self, mock_get_almacenes):
        """Debe manejar espacios en el código de almacén"""
        mock_get_almacenes.return_value = ["AA001", "II003"]
        result = validate_almacen_access("user1", "  AA001  ")
        assert result is True
