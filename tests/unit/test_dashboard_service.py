"""
Tests unitarios para DashboardService.

Cobertura:
- CRUD de dashboards
- Gestion de hojas
- Comparticion y permisos
"""

import pytest
import json
from unittest.mock import MagicMock, patch

# Importar modulos a testear
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.core.dashboard_schemas import (
    Dashboard,
    DashboardSheet,
    DashboardShare,
    DashboardGrupo,
    CreateDashboardRequest,
    UpdateDashboardRequest,
    CreateShareRequest,
    generate_uuid,
    generate_share_token,
    get_default_sheet_data,
)


# ============================================================================
# Tests de Schemas
# ============================================================================


class TestDashboardSchemas:
    """Tests para los schemas de dashboard"""

    def test_generate_uuid(self):
        """UUID debe tener formato correcto"""
        uuid1 = generate_uuid()
        uuid2 = generate_uuid()

        assert len(uuid1) == 36  # formato UUID
        assert uuid1 != uuid2  # UUIDs unicos

    def test_generate_share_token(self):
        """Token de comparticion debe tener longitud correcta"""
        token = generate_share_token()

        assert len(token) == 24
        assert "-" not in token  # Sin guiones

    def test_get_default_sheet_data(self):
        """Datos por defecto de hoja deben tener estructura correcta"""
        data = get_default_sheet_data()

        assert "name" in data
        assert "celldata" in data
        assert data["row"] == 100
        assert data["column"] == 26
        assert "config" in data

    def test_dashboard_from_row(self):
        """Dashboard debe construirse correctamente desde fila de BD"""
        row = {
            "id": 1,
            "uuid": "test-uuid",
            "nombre": "Test Dashboard",
            "descripcion": "Descripcion",
            "owner_id": "user123",
            "grupo_id": None,
            "tipo": "spreadsheet",
            "es_publico": 0,
            "es_favorito": 1,
            "icono": "table",
            "color": "#3b82f6",
            "config": '{"key": "value"}',
            "version": 1,
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }

        dashboard = Dashboard.from_row(row)

        assert dashboard.id == 1
        assert dashboard.uuid == "test-uuid"
        assert dashboard.nombre == "Test Dashboard"
        assert dashboard.es_favorito is True
        assert dashboard.config == {"key": "value"}

    def test_dashboard_to_dict(self):
        """Dashboard.to_dict debe incluir todos los campos"""
        dashboard = Dashboard(
            id=1,
            uuid="test-uuid",
            nombre="Test",
            owner_id="user123",
        )

        result = dashboard.to_dict()

        assert result["id"] == 1
        assert result["uuid"] == "test-uuid"
        assert "created_at" in result
        assert "updated_at" in result

    def test_dashboard_sheet_from_row(self):
        """DashboardSheet debe parsear JSON correctamente"""
        row = {
            "id": 1,
            "dashboard_id": 1,
            "sheet_index": 0,
            "nombre": "Hoja 1",
            "data": '{"celldata": []}',
            "config": None,
            "es_visible": 1,
            "es_protegida": 0,
        }

        sheet = DashboardSheet.from_row(row)

        assert sheet.id == 1
        assert sheet.data == {"celldata": []}
        assert sheet.es_visible is True

    def test_dashboard_share_validation(self):
        """DashboardShare debe validar estado correctamente"""
        # Share valido
        share = DashboardShare(
            id=1,
            dashboard_id=1,
            token="abc123",
            permiso="view",
            esta_activo=True,
            expira_en=None,
            max_accesos=None,
            accesos_actuales=0,
            creado_por="user123",
        )

        assert share.es_valido is True
        assert share.esta_expirado is False
        assert share.tiene_accesos_disponibles is True

    def test_dashboard_share_expired(self):
        """Share expirado debe reportarse correctamente"""
        share = DashboardShare(
            id=1,
            dashboard_id=1,
            token="abc123",
            expira_en="2020-01-01T00:00:00Z",  # Pasado
            esta_activo=True,
            creado_por="user123",
        )

        assert share.esta_expirado is True
        assert share.es_valido is False

    def test_dashboard_share_max_accesos(self):
        """Share con accesos maximos alcanzados"""
        share = DashboardShare(
            id=1,
            dashboard_id=1,
            token="abc123",
            max_accesos=10,
            accesos_actuales=10,
            esta_activo=True,
            creado_por="user123",
        )

        assert share.tiene_accesos_disponibles is False
        assert share.es_valido is False

    def test_create_dashboard_request(self):
        """CreateDashboardRequest debe parsear correctamente"""
        data = {
            "nombre": "Nuevo Dashboard",
            "descripcion": "Descripcion",
            "tipo": "spreadsheet",
            "icono": "chart",
        }

        request = CreateDashboardRequest.from_dict(data, "user123")

        assert request.nombre == "Nuevo Dashboard"
        assert request.owner_id == "user123"
        assert request.icono == "chart"

    def test_update_dashboard_request(self):
        """UpdateDashboardRequest debe manejar campos opcionales"""
        data = {
            "nombre": "Nuevo Nombre",
            "es_favorito": True,
        }

        request = UpdateDashboardRequest.from_dict(data)

        assert request.nombre == "Nuevo Nombre"
        assert request.es_favorito is True
        assert request.descripcion is None  # No incluido

    def test_dashboard_grupo_from_row(self):
        """DashboardGrupo debe construirse correctamente"""
        row = {
            "id": 1,
            "nombre": "General",
            "descripcion": "Grupo general",
            "icono": "folder",
            "color": "#6366f1",
            "orden": 0,
            "owner_id": "system",
            "es_publico": 1,
        }

        grupo = DashboardGrupo.from_row(row)

        assert grupo.id == 1
        assert grupo.nombre == "General"
        assert grupo.es_publico is True


# ============================================================================
# Tests de Formulas
# ============================================================================


class TestDashboardFormulas:
    """Tests para el catalogo de formulas SPM"""

    def test_formula_catalog_exists(self):
        """Catalogo de formulas debe existir"""
        from backend.core.dashboard_schemas import SPM_FORMULAS_CATALOG

        assert len(SPM_FORMULAS_CATALOG) > 0

    def test_formula_catalog_structure(self):
        """Cada formula debe tener estructura correcta"""
        from backend.core.dashboard_schemas import SPM_FORMULAS_CATALOG

        required_keys = ["categoria", "descripcion", "sintaxis", "params", "ejemplo"]

        for name, info in SPM_FORMULAS_CATALOG.items():
            for key in required_keys:
                assert key in info, f"Formula {name} falta clave '{key}'"

    def test_formula_stock_exists(self):
        """Formula SPM.STOCK debe existir"""
        from backend.core.dashboard_schemas import SPM_FORMULAS_CATALOG

        assert "SPM.STOCK" in SPM_FORMULAS_CATALOG
        assert SPM_FORMULAS_CATALOG["SPM.STOCK"]["params"] == ["material", "centro", "campo"]

    def test_formula_budget_exists(self):
        """Formula SPM.BUDGET debe existir"""
        from backend.core.dashboard_schemas import SPM_FORMULAS_CATALOG

        assert "SPM.BUDGET" in SPM_FORMULAS_CATALOG

    def test_formula_solicitudes_count_exists(self):
        """Formula SPM.SOLICITUDES.COUNT debe existir"""
        from backend.core.dashboard_schemas import SPM_FORMULAS_CATALOG

        assert "SPM.SOLICITUDES.COUNT" in SPM_FORMULAS_CATALOG

    def test_formula_forecast_exists(self):
        """Formula SPM.FORECAST debe existir"""
        from backend.core.dashboard_schemas import SPM_FORMULAS_CATALOG

        assert "SPM.FORECAST" in SPM_FORMULAS_CATALOG

    def test_formula_mrp_alertas_exists(self):
        """Formula SPM.MRP.ALERTAS debe existir"""
        from backend.core.dashboard_schemas import SPM_FORMULAS_CATALOG

        assert "SPM.MRP.ALERTAS" in SPM_FORMULAS_CATALOG


# ============================================================================
# Tests de CreateShareRequest
# ============================================================================


class TestCreateShareRequest:
    """Tests para CreateShareRequest"""

    def test_basic_share_request(self):
        """Request basico de comparticion"""
        data = {"permiso": "view"}

        request = CreateShareRequest.from_dict(data, 1, "user123")

        assert request.dashboard_id == 1
        assert request.creado_por == "user123"
        assert request.permiso == "view"
        assert request.password is None
        assert request.max_accesos is None

    def test_share_request_with_password(self):
        """Request con password"""
        data = {
            "permiso": "edit",
            "password": "secret123",
            "max_accesos": 5,
        }

        request = CreateShareRequest.from_dict(data, 1, "user123")

        assert request.password == "secret123"
        assert request.max_accesos == 5

    def test_share_request_with_expiry(self):
        """Request con fecha de expiracion"""
        data = {
            "permiso": "view",
            "expira_en": "2026-12-31T23:59:59Z",
            "nota": "Para equipo de ventas",
        }

        request = CreateShareRequest.from_dict(data, 1, "user123")

        assert request.expira_en == "2026-12-31T23:59:59Z"
        assert request.nota == "Para equipo de ventas"


# ============================================================================
# Tests de Enums
# ============================================================================


class TestEnums:
    """Tests para enums del modulo"""

    def test_tipo_dashboard_values(self):
        """TipoDashboard debe tener valores correctos"""
        from backend.core.dashboard_schemas import TipoDashboard

        assert TipoDashboard.SPREADSHEET.value == "spreadsheet"
        assert TipoDashboard.CHART.value == "chart"
        assert TipoDashboard.MIXED.value == "mixed"

    def test_tipo_datasource_values(self):
        """TipoDataSource debe tener todos los tipos"""
        from backend.core.dashboard_schemas import TipoDataSource

        expected = ["stock", "budget", "solicitudes", "forecast", "mrp", "custom"]

        for tipo in expected:
            assert hasattr(TipoDataSource, tipo.upper())

    def test_permiso_nivel_values(self):
        """PermisoNivel debe tener niveles correctos"""
        from backend.core.dashboard_schemas import PermisoNivel

        assert PermisoNivel.VIEW.value == "view"
        assert PermisoNivel.EDIT.value == "edit"
        assert PermisoNivel.ADMIN.value == "admin"

    def test_formula_categoria_values(self):
        """FormulaCategoria debe tener todas las categorias"""
        from backend.core.dashboard_schemas import FormulaCategoria

        expected = ["stock", "budget", "solicitudes", "forecast", "mrp"]

        for cat in expected:
            assert hasattr(FormulaCategoria, cat.upper())
