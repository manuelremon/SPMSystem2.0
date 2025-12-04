"""
Tests para el módulo de normalización de roles (backend_v2/core/roles.py)

Estos tests verifican que la normalización de roles funciona correctamente
con todos los formatos posibles de entrada.
"""

import sys
from pathlib import Path

import pytest

# Agregar backend_v2 al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend_v2"))

from core.roles import (ADMIN_ROLES, format_user_response, has_any_role,
                        has_role, is_admin, normalize_roles)


class TestNormalizeRoles:
    """Tests para la función normalize_roles"""

    def test_none_input(self):
        """None retorna lista vacía"""
        assert normalize_roles(None) == []

    def test_empty_string(self):
        """String vacío retorna lista vacía"""
        assert normalize_roles("") == []
        assert normalize_roles("   ") == []

    def test_simple_string(self):
        """String simple se convierte a lista lowercase"""
        assert normalize_roles("Admin") == ["admin"]
        assert normalize_roles("PLANIFICADOR") == ["planificador"]
        assert normalize_roles("  User  ") == ["user"]

    def test_json_array(self):
        """JSON array se parsea correctamente"""
        assert normalize_roles('["admin", "planner"]') == ["admin", "planner"]
        assert normalize_roles('["Admin", "PLANNER"]') == ["admin", "planner"]
        assert normalize_roles('["usuario"]') == ["usuario"]

    def test_json_array_with_spaces(self):
        """JSON array con espacios se normaliza"""
        assert normalize_roles('[" admin ", " planner "]') == ["admin", "planner"]

    def test_invalid_json(self):
        """JSON inválido se trata como string"""
        assert normalize_roles("[invalid") == ["[invalid"]
        assert normalize_roles('["unclosed') == ['["unclosed']

    def test_comma_separated(self):
        """String separado por comas"""
        assert normalize_roles("Admin,Planner") == ["admin", "planner"]
        assert normalize_roles("admin, planner, user") == ["admin", "planner", "user"]
        assert normalize_roles("Admin,  ,Planner") == ["admin", "planner"]  # vacíos filtrados

    def test_semicolon_separated(self):
        """String separado por punto y coma"""
        assert normalize_roles("Admin;Planner") == ["admin", "planner"]
        assert normalize_roles("admin; planner; user") == ["admin", "planner", "user"]

    def test_mixed_separators(self):
        """String con separadores mixtos"""
        assert normalize_roles("Admin,Planner;User") == ["admin", "planner", "user"]

    def test_list_input(self):
        """Lista Python como entrada"""
        assert normalize_roles(["Admin", "Planner"]) == ["admin", "planner"]
        assert normalize_roles(["admin"]) == ["admin"]

    def test_tuple_input(self):
        """Tuple como entrada"""
        assert normalize_roles(("Admin", "Planner")) == ["admin", "planner"]

    def test_no_duplicates(self):
        """No debe haber duplicados"""
        assert normalize_roles("admin,Admin,ADMIN") == ["admin"]
        assert normalize_roles('["admin", "admin"]') == ["admin"]

    def test_non_string_in_list(self):
        """Elementos no-string en lista se convierten"""
        assert normalize_roles([123, "admin"]) == ["123", "admin"]


class TestIsAdmin:
    """Tests para la función is_admin"""

    def test_admin_string(self):
        """'admin' es admin"""
        assert is_admin("admin") is True
        assert is_admin("Admin") is True
        assert is_admin("ADMIN") is True

    def test_administrador(self):
        """'administrador' es admin"""
        assert is_admin("administrador") is True
        assert is_admin("Administrador") is True

    def test_superadmin(self):
        """'superadmin' es admin"""
        assert is_admin("superadmin") is True

    def test_not_admin_substring(self):
        """Substring 'admin' no es suficiente si no está en ADMIN_ROLES"""
        # 'admin_assistant' no es admin porque no está en el set exacto
        assert is_admin("admin_assistant") is False
        assert is_admin("superadministrator") is False

    def test_planner_not_admin(self):
        """'planner' no es admin"""
        assert is_admin("planner") is False
        assert is_admin("planificador") is False

    def test_user_not_admin(self):
        """'user' no es admin"""
        assert is_admin("user") is False
        assert is_admin("usuario") is False

    def test_json_array_with_admin(self):
        """JSON array que contiene admin"""
        assert is_admin('["admin", "planner"]') is True
        assert is_admin('["planner", "user"]') is False

    def test_comma_separated_with_admin(self):
        """String separado por comas que contiene admin"""
        assert is_admin("planner,admin") is True
        assert is_admin("planner,user") is False

    def test_empty_not_admin(self):
        """Vacío no es admin"""
        assert is_admin("") is False
        assert is_admin(None) is False


class TestHasRole:
    """Tests para la función has_role"""

    def test_exact_match(self):
        """Match exacto de rol"""
        assert has_role("planner", "planner") is True
        assert has_role("Planner", "planner") is True
        assert has_role("PLANNER", "planner") is True

    def test_json_array(self):
        """Match en JSON array"""
        assert has_role('["admin", "planner"]', "planner") is True
        assert has_role('["admin", "planner"]', "user") is False

    def test_comma_separated(self):
        """Match en string separado por comas"""
        assert has_role("admin,planner", "planner") is True
        assert has_role("admin,planner", "user") is False


class TestHasAnyRole:
    """Tests para la función has_any_role"""

    def test_match_one(self):
        """Match de al menos uno de los roles"""
        assert has_any_role("planner", ["admin", "planner"]) is True
        assert has_any_role("user", ["admin", "planner"]) is False

    def test_json_array(self):
        """Match en JSON array"""
        assert has_any_role('["user", "planner"]', ["admin", "planner"]) is True
        assert has_any_role('["user", "viewer"]', ["admin", "planner"]) is False

    def test_empty_required(self):
        """Lista de requeridos vacía siempre falla"""
        assert has_any_role("admin", []) is False


class TestFormatUserResponse:
    """Tests para la función format_user_response"""

    def test_basic_user(self):
        """Usuario básico se formatea correctamente"""
        user = {
            "id_spm": "user1",
            "mail": "user@test.com",
            "nombre": "Juan",
            "apellido": "Pérez",
            "rol": "admin",
            "sector": "IT",
            "centros": "1001",
        }
        result = format_user_response(user)

        assert result["id"] == "user1"
        assert result["username"] == "user1"
        assert result["email"] == "user@test.com"
        assert result["nombre"] == "Juan Pérez"
        assert result["rol"] == "admin"  # Original
        assert result["roles"] == ["admin"]  # Normalizado
        assert result["is_admin"] is True

    def test_user_with_json_roles(self):
        """Usuario con roles JSON"""
        user = {
            "id_spm": "planner1",
            "mail": "planner@test.com",
            "nombre": "María",
            "apellido": "García",
            "rol": '["planificador", "user"]',
            "sector": "Operations",
            "centros": "1002",
        }
        result = format_user_response(user)

        assert result["roles"] == ["planificador", "user"]
        assert result["is_admin"] is False

    def test_user_with_missing_fields(self):
        """Usuario con campos faltantes"""
        user = {"id_spm": "test"}
        result = format_user_response(user)

        assert result["id"] == "test"
        assert result["nombre"] == ""
        assert result["roles"] == []
        assert result["is_admin"] is False


class TestAdminRolesConstant:
    """Tests para verificar la constante ADMIN_ROLES"""

    def test_expected_admin_roles(self):
        """Verificar roles admin esperados"""
        assert "admin" in ADMIN_ROLES
        assert "administrador" in ADMIN_ROLES
        assert "administrator" in ADMIN_ROLES
        assert "superadmin" in ADMIN_ROLES

    def test_no_unexpected_admin_roles(self):
        """Verificar que no hay roles inesperados"""
        # Solo 4 roles admin definidos
        assert len(ADMIN_ROLES) == 4

    def test_immutable(self):
        """ADMIN_ROLES debe ser inmutable (frozenset)"""
        with pytest.raises(AttributeError):
            ADMIN_ROLES.add("hacker")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
