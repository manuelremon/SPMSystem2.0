"""
Unit tests for ExcelValidator.

Tests the Excel file validation for MRP/Forecast data import.
"""

import pytest
import pandas as pd
from io import BytesIO
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta

from backend.core.excel_validator import ExcelValidator, ValidationResult


@pytest.fixture
def validator():
    """Create ExcelValidator instance."""
    return ExcelValidator()


@pytest.fixture
def valid_stock_df():
    """Valid stock DataFrame."""
    return pd.DataFrame({
        "material": ["MAT001", "MAT002", "MAT003"],
        "descripcion": ["Tuerca M16", "Aceite Hidraulico", "Rodamiento"],
        "centro": ["1008", "1008", "1010"],
        "almacen": ["0001", "0001", "0002"],
        "stock": [150, 45, 200],
        "um": ["UNI", "LT", "UNI"]
    })


@pytest.fixture
def valid_consumo_df():
    """Valid consumo historico DataFrame."""
    base_date = datetime.now() - timedelta(days=180)
    records = []
    for i in range(36):  # 3 materials, 12 records each
        date = base_date + timedelta(days=i * 5)
        records.append({
            "material": f"MAT00{(i % 3) + 1}",
            "fecha": date,
            "cantidad": 20 + i
        })
    return pd.DataFrame(records)


def create_mock_file_storage(content: bytes, size_mb: float = 1.0):
    """Create a mock FileStorage object."""
    mock = MagicMock()
    mock.read.return_value = content
    mock.seek = MagicMock()

    # Mock size calculation
    def seek_side_effect(pos, whence=0):
        if whence == 2:  # SEEK_END
            mock.tell.return_value = int(size_mb * 1024 * 1024)
        else:
            mock.tell.return_value = 0

    mock.seek.side_effect = seek_side_effect
    return mock


def create_excel_bytes(sheets: dict) -> bytes:
    """Create Excel file bytes from DataFrames dict."""
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        for sheet_name, df in sheets.items():
            df.to_excel(writer, sheet_name=sheet_name, index=False)
    output.seek(0)
    return output.read()


class TestValidationResult:
    """Tests for ValidationResult dataclass."""

    def test_default_state_is_valid(self):
        """Test that default ValidationResult is valid."""
        result = ValidationResult()

        assert result.valid is True
        assert result.errors == []
        assert result.warnings == []

    def test_add_error_marks_invalid(self):
        """Test add_error marks result as invalid."""
        result = ValidationResult()
        result.add_error("Test error")

        assert result.valid is False
        assert "Test error" in result.errors

    def test_add_warning_keeps_valid(self):
        """Test add_warning does not invalidate."""
        result = ValidationResult()
        result.add_warning("Test warning")

        assert result.valid is True
        assert "Test warning" in result.warnings

    def test_to_dict_returns_proper_structure(self):
        """Test to_dict returns proper API response structure."""
        result = ValidationResult()
        result.add_warning("Warning 1")
        result.materiales_count = 10
        result.registros_stock = 10
        result.registros_consumo = 100

        data = result.to_dict()

        assert "valid" in data
        assert "errors" in data
        assert "warnings" in data
        assert "resumen" in data
        assert data["resumen"]["materiales"] == 10


class TestExcelValidatorFileValidation:
    """Tests for file-level validation."""

    def test_invalid_extension_rejected(self, validator):
        """Test that invalid file extensions are rejected."""
        mock_file = create_mock_file_storage(b"content")

        result = validator.validate_file(mock_file, "test.csv")

        assert result.valid is False
        assert any("Formato no soportado" in e for e in result.errors)

    def test_xlsx_extension_accepted(self, validator, valid_stock_df, valid_consumo_df):
        """Test that .xlsx extension is accepted."""
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": valid_consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        # File format should be accepted (may have other validation issues)
        assert not any("Formato no soportado" in e for e in result.errors)

    def test_file_too_large_rejected(self, validator):
        """Test that files exceeding size limit are rejected."""
        mock_file = create_mock_file_storage(b"content", size_mb=60.0)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert result.valid is False
        assert any("muy grande" in e for e in result.errors)

    def test_corrupted_excel_rejected(self, validator):
        """Test that corrupted Excel files are rejected."""
        mock_file = create_mock_file_storage(b"not a valid excel file")

        result = validator.validate_file(mock_file, "test.xlsx")

        assert result.valid is False
        assert any("Error al leer" in e for e in result.errors)


class TestExcelValidatorSheetValidation:
    """Tests for sheet-level validation."""

    def test_missing_stock_sheet_rejected(self, validator, valid_consumo_df):
        """Test that missing 'stock' sheet is rejected."""
        excel_bytes = create_excel_bytes({
            "consumo_historico": valid_consumo_df
            # Missing 'stock' sheet
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert result.valid is False
        assert any("stock" in e.lower() and "no encontrada" in e.lower() for e in result.errors)

    def test_missing_consumo_sheet_rejected(self, validator, valid_stock_df):
        """Test that missing 'consumo_historico' sheet is rejected."""
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df
            # Missing 'consumo_historico' sheet
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert result.valid is False
        assert any("consumo_historico" in e.lower() for e in result.errors)

    def test_case_insensitive_sheet_names(self, validator, valid_stock_df, valid_consumo_df):
        """Test that sheet names are case-insensitive."""
        excel_bytes = create_excel_bytes({
            "STOCK": valid_stock_df,
            "Consumo_Historico": valid_consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        # Should not fail due to sheet names
        assert not any("no encontrada" in e.lower() for e in result.errors)

    def test_optional_mrp_sheet_generates_warning(self, validator, valid_stock_df, valid_consumo_df):
        """Test that missing optional 'parametros_mrp' sheet generates warning."""
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": valid_consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert any("parametros_mrp" in w.lower() for w in result.warnings)


class TestExcelValidatorStockSheet:
    """Tests for stock sheet validation."""

    def test_missing_required_columns_rejected(self, validator, valid_consumo_df):
        """Test that missing required columns are rejected."""
        stock_df = pd.DataFrame({
            "material": ["MAT001"],
            "descripcion": ["Test"]
            # Missing: centro, almacen, stock, um
        })
        excel_bytes = create_excel_bytes({
            "stock": stock_df,
            "consumo_historico": valid_consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert result.valid is False
        assert any("Columnas faltantes" in e for e in result.errors)

    def test_empty_stock_sheet_rejected(self, validator, valid_consumo_df):
        """Test that empty stock sheet is rejected."""
        stock_df = pd.DataFrame(columns=["material", "descripcion", "centro", "almacen", "stock", "um"])
        excel_bytes = create_excel_bytes({
            "stock": stock_df,
            "consumo_historico": valid_consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert result.valid is False
        assert any("No hay registros" in e for e in result.errors)

    def test_empty_material_codes_error(self, validator, valid_consumo_df):
        """Test that empty material codes generate error."""
        stock_df = pd.DataFrame({
            "material": ["MAT001", "", "MAT003"],
            "descripcion": ["A", "B", "C"],
            "centro": ["1008", "1008", "1008"],
            "almacen": ["0001", "0001", "0001"],
            "stock": [100, 200, 300],
            "um": ["UNI", "UNI", "UNI"]
        })
        excel_bytes = create_excel_bytes({
            "stock": stock_df,
            "consumo_historico": valid_consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        # Check for error about empty/missing material codes
        assert any("sin c" in e.lower() and "material" in e.lower() for e in result.errors)

    def test_invalid_stock_values_warning(self, validator, valid_consumo_df):
        """Test that invalid stock values generate warning."""
        stock_df = pd.DataFrame({
            "material": ["MAT001", "MAT002"],
            "descripcion": ["A", "B"],
            "centro": ["1008", "1008"],
            "almacen": ["0001", "0001"],
            "stock": [100, "invalid"],
            "um": ["UNI", "UNI"]
        })
        excel_bytes = create_excel_bytes({
            "stock": stock_df,
            "consumo_historico": valid_consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        # Check for warning about invalid stock values
        assert any("stock" in w.lower() and "inv" in w.lower() for w in result.warnings)

    def test_negative_stock_warning(self, validator, valid_consumo_df):
        """Test that negative stock values generate warning."""
        stock_df = pd.DataFrame({
            "material": ["MAT001", "MAT002"],
            "descripcion": ["A", "B"],
            "centro": ["1008", "1008"],
            "almacen": ["0001", "0001"],
            "stock": [100, -50],
            "um": ["UNI", "UNI"]
        })
        excel_bytes = create_excel_bytes({
            "stock": stock_df,
            "consumo_historico": valid_consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert any("stock negativo" in w.lower() for w in result.warnings)

    def test_duplicate_records_warning(self, validator, valid_consumo_df):
        """Test that duplicate records generate warning."""
        stock_df = pd.DataFrame({
            "material": ["MAT001", "MAT001"],  # Same material+centro+almacen
            "descripcion": ["A", "A"],
            "centro": ["1008", "1008"],
            "almacen": ["0001", "0001"],
            "stock": [100, 200],
            "um": ["UNI", "UNI"]
        })
        excel_bytes = create_excel_bytes({
            "stock": stock_df,
            "consumo_historico": valid_consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert any("duplicados" in w.lower() for w in result.warnings)


class TestExcelValidatorConsumoSheet:
    """Tests for consumo_historico sheet validation."""

    def test_missing_required_columns_rejected(self, validator, valid_stock_df):
        """Test that missing required columns are rejected."""
        consumo_df = pd.DataFrame({
            "material": ["MAT001"]
            # Missing: fecha, cantidad
        })
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert result.valid is False
        assert any("Columnas faltantes" in e for e in result.errors)

    def test_empty_consumo_sheet_rejected(self, validator, valid_stock_df):
        """Test that empty consumo sheet is rejected."""
        consumo_df = pd.DataFrame(columns=["material", "fecha", "cantidad"])
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert result.valid is False
        assert any("No hay registros" in e for e in result.errors)

    def test_invalid_dates_warning(self, validator, valid_stock_df):
        """Test that invalid dates generate warning."""
        consumo_df = pd.DataFrame({
            "material": ["MAT001", "MAT001"],
            "fecha": ["2024-01-15", "not_a_date"],
            "cantidad": [10, 20]
        })
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        # Check for warning about invalid dates
        assert any("fecha" in w.lower() and "inv" in w.lower() for w in result.warnings)

    def test_invalid_quantities_warning(self, validator, valid_stock_df):
        """Test that invalid quantities generate warning."""
        consumo_df = pd.DataFrame({
            "material": ["MAT001", "MAT001"],
            "fecha": [datetime.now(), datetime.now()],
            "cantidad": [10, "invalid"]
        })
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        # Check for warning about invalid quantities
        assert any("cantidad" in w.lower() and "inv" in w.lower() for w in result.warnings)

    def test_short_history_warning(self, validator, valid_stock_df):
        """Test that short history generates warning."""
        # Only 15 days of history
        consumo_df = pd.DataFrame({
            "material": ["MAT001"] * 3,
            "fecha": [datetime.now() - timedelta(days=i * 5) for i in range(3)],
            "cantidad": [10, 20, 30]
        })
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert any("muy corto" in w.lower() or "minimo" in w.lower() for w in result.warnings)

    def test_low_record_count_warning(self, validator, valid_stock_df):
        """Test that low record count per material generates warning."""
        # Only 3 records per material
        consumo_df = pd.DataFrame({
            "material": ["MAT001"] * 3,
            "fecha": [datetime.now() - timedelta(days=i * 30) for i in range(3)],
            "cantidad": [10, 20, 30]
        })
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert any("menos de 5 registros" in w.lower() for w in result.warnings)


class TestExcelValidatorCrossValidation:
    """Tests for cross-sheet validation."""

    def test_materials_in_consumo_not_in_stock_warning(self, validator, valid_stock_df):
        """Test warning when consumo has materials not in stock."""
        consumo_df = pd.DataFrame({
            "material": ["MAT001", "MAT999"],  # MAT999 not in stock
            "fecha": [datetime.now(), datetime.now()],
            "cantidad": [10, 20]
        })
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert any("no existen en stock" in w.lower() for w in result.warnings)

    def test_materials_without_consumo_warning(self, validator, valid_stock_df):
        """Test warning when stock has materials without consumo."""
        consumo_df = pd.DataFrame({
            "material": ["MAT001"],  # Only MAT001, not MAT002 or MAT003
            "fecha": [datetime.now()],
            "cantidad": [10]
        })
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        # Check for warning about materials without consumption history
        assert any("sin consumo" in w.lower() or "forecast limitado" in w.lower() for w in result.warnings)


class TestExcelValidatorMRPSheet:
    """Tests for optional parametros_mrp sheet validation."""

    def test_mrp_sheet_missing_material_column_error(self, validator, valid_stock_df, valid_consumo_df):
        """Test that missing 'material' column in MRP sheet is an error."""
        mrp_df = pd.DataFrame({
            "stock_seguridad": [50],
            "punto_pedido": [75]
            # Missing 'material' column
        })
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": valid_consumo_df,
            "parametros_mrp": mrp_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert any("material" in e.lower() and "requerida" in e.lower() for e in result.errors)

    def test_mrp_sheet_valid_structure(self, validator, valid_stock_df, valid_consumo_df):
        """Test that valid MRP sheet is accepted."""
        mrp_df = pd.DataFrame({
            "material": ["MAT001", "MAT002"],
            "stock_seguridad": [50, 10],
            "punto_pedido": [75, 15],
            "stock_maximo": [300, 60],
            "lead_time_dias": [10, 7]
        })
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": valid_consumo_df,
            "parametros_mrp": mrp_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert result.parametros_mrp_df is not None


class TestExcelValidatorFullValidation:
    """Integration tests for full file validation."""

    def test_valid_file_passes(self, validator, valid_stock_df, valid_consumo_df):
        """Test that a valid file passes all validations."""
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": valid_consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert result.valid is True
        assert result.stock_df is not None
        assert result.consumo_df is not None
        assert result.materiales_count == 3

    def test_resumen_counts_are_correct(self, validator, valid_stock_df, valid_consumo_df):
        """Test that resumen counts are calculated correctly."""
        excel_bytes = create_excel_bytes({
            "stock": valid_stock_df,
            "consumo_historico": valid_consumo_df
        })
        mock_file = create_mock_file_storage(excel_bytes)

        result = validator.validate_file(mock_file, "test.xlsx")

        assert result.registros_stock == 3
        assert result.registros_consumo == 36
        assert result.materiales_count == 3
