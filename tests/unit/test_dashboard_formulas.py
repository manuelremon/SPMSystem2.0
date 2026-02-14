"""
Tests unitarios para el ejecutor de formulas SPM.

Cobertura:
- Parseo y validacion de formulas
- Ejecucion de cada tipo de formula
- Manejo de errores
- Cache de resultados
"""

import pytest
from unittest.mock import MagicMock, patch
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.core.dashboard_schemas import FormulaResult


# ============================================================================
# Tests de FormulaResult
# ============================================================================


class TestFormulaResult:
    """Tests para FormulaResult"""

    def test_success_result(self):
        """Resultado exitoso debe tener estructura correcta"""
        result = FormulaResult(
            success=True,
            value=100,
            execution_time_ms=5.5,
        )

        assert result.success is True
        assert result.value == 100
        assert result.error_code is None

    def test_error_result(self):
        """Resultado de error debe incluir codigo y mensaje"""
        result = FormulaResult(
            success=False,
            error_code="NOT_FOUND",
            error_message="Material no encontrado",
            execution_time_ms=1.2,
        )

        assert result.success is False
        assert result.error_code == "NOT_FOUND"
        assert result.error_message == "Material no encontrado"

    def test_cached_result(self):
        """Resultado cacheado debe indicarlo"""
        result = FormulaResult(
            success=True,
            value=50,
            cached=True,
            execution_time_ms=0.1,
        )

        assert result.cached is True

    def test_to_dict(self):
        """to_dict debe generar diccionario correcto"""
        result = FormulaResult(
            success=True,
            value={"total": 100},
            execution_time_ms=3.0,
        )

        d = result.to_dict()

        assert d["success"] is True
        assert d["value"] == {"total": 100}
        assert d["execution_time_ms"] == 3.0
        assert "error_code" not in d

    def test_error_to_dict(self):
        """to_dict de error debe incluir codigo y mensaje"""
        result = FormulaResult(
            success=False,
            error_code="INVALID_PARAMS",
            error_message="Parametros invalidos",
        )

        d = result.to_dict()

        assert d["success"] is False
        assert d["error_code"] == "INVALID_PARAMS"
        assert d["error_message"] == "Parametros invalidos"


# ============================================================================
# Tests del ejecutor de formulas (con mocks)
# ============================================================================


class TestFormulaExecutor:
    """Tests para FormulaExecutor con mocks de BD"""

    @pytest.fixture
    def mock_connection(self):
        """Mock de conexion a BD"""
        with patch("backend.services.dashboard_formulas._connect") as mock:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_conn.cursor.return_value = mock_cursor
            mock.return_value = mock_conn
            yield mock_cursor

    def test_executor_registry(self):
        """FormulaExecutor debe tener todas las formulas registradas"""
        from backend.services.dashboard_formulas import FormulaExecutor

        expected_formulas = [
            "SPM.STOCK",
            "SPM.MRP.ALERTAS",
            "SPM.BUDGET",
            "SPM.BUDGET.LEDGER",
            "SPM.SOLICITUDES.COUNT",
            "SPM.SOLICITUDES.SUM",
            "SPM.FORECAST",
            "SPM.FORECAST.ACCURACY",
        ]

        for formula in expected_formulas:
            assert formula in FormulaExecutor.FORMULAS

    def test_unknown_formula(self):
        """Formula desconocida debe retornar error"""
        from backend.services.dashboard_formulas import FormulaExecutor

        result = FormulaExecutor.execute("SPM.UNKNOWN", [])

        assert result.success is False
        assert result.error_code == "UNKNOWN_FORMULA"

    def test_formula_normalization(self):
        """Formula debe normalizarse (mayusculas, sin =)"""
        from backend.services.dashboard_formulas import FormulaExecutor

        # Con mock para evitar error de BD
        with patch("backend.services.dashboard_formulas._connect") as mock:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = None
            mock_conn.cursor.return_value = mock_cursor
            mock.return_value = mock_conn

            # Variaciones que deben normalizarse
            result1 = FormulaExecutor.execute("=spm.stock", ["MAT", "1000", "stock_actual"])
            result2 = FormulaExecutor.execute("SPM.STOCK", ["MAT", "1000", "stock_actual"])

            # Ambas deben intentar ejecutar (aunque fallen por mock)
            assert result1.error_code in [None, "NOT_FOUND"]
            assert result2.error_code in [None, "NOT_FOUND"]

    def test_invalid_params(self):
        """Parametros invalidos deben retornar error"""
        from backend.services.dashboard_formulas import FormulaExecutor

        # Formula que espera 3 parametros, pasamos 1
        result = FormulaExecutor.execute("SPM.STOCK", ["solo_uno"])

        assert result.success is False
        assert result.error_code == "INVALID_PARAMS"


# ============================================================================
# Tests de cache
# ============================================================================


class TestFormulaCache:
    """Tests para el sistema de cache de formulas"""

    def test_cache_functions_exist(self):
        """Funciones de cache deben existir"""
        from backend.services.dashboard_formulas import (
            _get_cache_key,
            _get_cached,
            _set_cache,
        )

        # Verificar que existen
        assert callable(_get_cache_key)
        assert callable(_get_cached)
        assert callable(_set_cache)

    def test_cache_key_generation(self):
        """Cache key debe ser unica por formula+params"""
        from backend.services.dashboard_formulas import _get_cache_key

        key1 = _get_cache_key("SPM.STOCK", ["MAT001", "1000", "stock_actual"])
        key2 = _get_cache_key("SPM.STOCK", ["MAT001", "1000", "stock_actual"])
        key3 = _get_cache_key("SPM.STOCK", ["MAT002", "1000", "stock_actual"])

        assert key1 == key2  # Mismos params, misma key
        assert key1 != key3  # Diferente material, diferente key

    def test_clear_cache(self):
        """clear_cache debe limpiar toda la cache"""
        from backend.services.dashboard_formulas import (
            FormulaExecutor,
            _set_cache,
            _get_cached,
        )

        # Agregar algo a la cache
        _set_cache("test_key", "test_value")
        assert _get_cached("test_key") == "test_value"

        # Limpiar
        FormulaExecutor.clear_cache()

        # Ya no debe estar
        assert _get_cached("test_key") is None

    def test_set_cache_ttl(self):
        """set_cache_ttl debe configurar el TTL"""
        from backend.services.dashboard_formulas import FormulaExecutor

        # No debe lanzar error
        FormulaExecutor.set_cache_ttl(120)


# ============================================================================
# Tests de formulas individuales con mocks
# ============================================================================


class TestStockFormulas:
    """Tests para formulas de stock"""

    def test_stock_formula_valid_fields(self):
        """Stock formula debe aceptar campos validos"""
        from backend.services.dashboard_formulas import StockFormulas

        with patch("backend.services.dashboard_formulas.get_db_connection") as mock_gdb:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = {"valor": 100}
            mock_conn.cursor.return_value = mock_cursor
            mock_ctx = MagicMock()
            mock_ctx.__enter__ = MagicMock(return_value=mock_conn)
            mock_ctx.__exit__ = MagicMock(return_value=False)
            mock_gdb.return_value = mock_ctx

            result = StockFormulas.stock("MAT001", "1000", "stock_actual")

            assert result.success is True
            assert result.value == 100

    def test_stock_formula_invalid_field(self):
        """Stock formula debe rechazar campos invalidos"""
        from backend.services.dashboard_formulas import StockFormulas

        result = StockFormulas.stock("MAT001", "1000", "campo_invalido")

        assert result.success is False
        assert result.error_code == "INVALID_FIELD"


class TestBudgetFormulas:
    """Tests para formulas de presupuesto"""

    def test_budget_formula_valid_fields(self):
        """Budget formula debe calcular campos correctamente"""
        from backend.services.dashboard_formulas import BudgetFormulas

        with patch("backend.services.dashboard_formulas._connect") as mock:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = {
                "monto_cents": 1000000,  # $10,000
                "saldo_cents": 600000,  # $6,000
            }
            mock_conn.cursor.return_value = mock_cursor
            mock.return_value = mock_conn

            result = BudgetFormulas.budget("1000", "MTTO", "saldo_usd")

            assert result.success is True
            assert result.value == 6000.0

    def test_budget_formula_percentage(self):
        """Budget formula debe calcular porcentaje consumido"""
        from backend.services.dashboard_formulas import BudgetFormulas

        with patch("backend.services.dashboard_formulas._connect") as mock:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = {
                "monto_cents": 1000000,  # $10,000
                "saldo_cents": 600000,  # $6,000
            }
            mock_conn.cursor.return_value = mock_cursor
            mock.return_value = mock_conn

            result = BudgetFormulas.budget("1000", "MTTO", "porcentaje_consumido")

            assert result.success is True
            assert result.value == 40.0  # 40% consumido


class TestSolicitudesFormulas:
    """Tests para formulas de solicitudes"""

    def test_solicitudes_count(self):
        """Solicitudes count debe retornar cantidad"""
        from backend.services.dashboard_formulas import SolicitudesFormulas

        with patch("backend.services.dashboard_formulas._connect") as mock:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = {"cnt": 15}
            mock_conn.cursor.return_value = mock_cursor
            mock.return_value = mock_conn

            result = SolicitudesFormulas.count("approved", "1000")

            assert result.success is True
            assert result.value == 15

    def test_solicitudes_sum_valid_field(self):
        """Solicitudes sum debe aceptar campos validos"""
        from backend.services.dashboard_formulas import SolicitudesFormulas

        with patch("backend.services.dashboard_formulas._connect") as mock:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = {"total": 50000}
            mock_conn.cursor.return_value = mock_cursor
            mock.return_value = mock_conn

            result = SolicitudesFormulas.sum("monto_total", {"estado": "approved"})

            assert result.success is True
            assert result.value == 50000

    def test_solicitudes_sum_invalid_field(self):
        """Solicitudes sum debe rechazar campos no permitidos"""
        from backend.services.dashboard_formulas import SolicitudesFormulas

        result = SolicitudesFormulas.sum("password", {})  # Campo no permitido

        assert result.success is False
        assert result.error_code == "INVALID_FIELD"


class TestMRPFormulas:
    """Tests para formulas de MRP"""

    def test_mrp_alertas_all(self):
        """MRP alertas sin severidad debe contar todas"""
        from backend.services.dashboard_formulas import MRPFormulas

        with patch("backend.services.dashboard_formulas._connect") as mock:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = {"cnt": 25}
            mock_conn.cursor.return_value = mock_cursor
            mock.return_value = mock_conn

            result = MRPFormulas.alertas("1000")

            assert result.success is True
            assert result.value == 25

    def test_mrp_alertas_by_severity(self):
        """MRP alertas con severidad debe filtrar"""
        from backend.services.dashboard_formulas import MRPFormulas

        with patch("backend.services.dashboard_formulas._connect") as mock:
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            mock_cursor.fetchone.return_value = {"cnt": 5}
            mock_conn.cursor.return_value = mock_cursor
            mock.return_value = mock_conn

            result = MRPFormulas.alertas("1000", "alta")

            assert result.success is True
            assert result.value == 5
