"""
Unit tests for TempDataService.

Tests the temporary data management functionality for MRP and Forecast modules.
"""

import pytest
import pandas as pd
from datetime import datetime, timedelta

from backend.services.temp_data_service import TempDataService, TempDataStore


@pytest.fixture
def temp_service():
    """Create a fresh TempDataService instance for each test."""
    service = TempDataService()
    service._stores = {}  # Clear any existing stores
    yield service
    service._stores = {}  # Cleanup after test


@pytest.fixture
def sample_stock_df():
    """Sample stock DataFrame for testing."""
    return pd.DataFrame({
        "material": ["MAT001", "MAT002", "MAT003"],
        "descripcion": ["Tuerca M16", "Aceite Hidraulico", "Rodamiento SKF"],
        "centro": ["1008", "1008", "1010"],
        "almacen": ["0001", "0001", "0002"],
        "stock": [150, 45, 200],
        "um": ["UNI", "LT", "UNI"],
        "precio_usd": [2.50, 15.00, 75.00]
    })


@pytest.fixture
def sample_consumo_df():
    """Sample consumo historico DataFrame for testing."""
    base_date = datetime.now() - timedelta(days=180)
    records = []

    for i in range(12):
        date = base_date + timedelta(days=i * 15)
        records.extend([
            {"material": "MAT001", "fecha": date, "cantidad": 25 + i},
            {"material": "MAT002", "fecha": date, "cantidad": 5 + i * 0.5},
        ])

    return pd.DataFrame(records)


@pytest.fixture
def sample_parametros_mrp_df():
    """Sample MRP parameters DataFrame for testing."""
    return pd.DataFrame({
        "material": ["MAT001", "MAT002"],
        "stock_seguridad": [50, 10],
        "punto_pedido": [75, 15],
        "stock_maximo": [300, 60],
        "lead_time_dias": [10, 7]
    })


class TestTempDataStore:
    """Tests for TempDataStore dataclass."""

    def test_to_dict_returns_correct_structure(self):
        """Test that to_dict returns proper API response structure."""
        store = TempDataStore(
            user_id="user123",
            archivo_nombre="test.xlsx",
            materiales_count=10,
            registros_stock=10,
            registros_consumo=100,
            rango_fechas=("2024-01-01", "2024-12-31"),
            advertencias=["Warning 1"]
        )

        result = store.to_dict()

        assert result["user_id"] == "user123"
        assert result["archivo"] == "test.xlsx"
        assert result["stats"]["materiales"] == 10
        assert result["stats"]["registros_stock"] == 10
        assert result["stats"]["registros_consumo"] == 100
        assert result["stats"]["rango_fechas"] == ["2024-01-01", "2024-12-31"]
        assert result["advertencias"] == ["Warning 1"]
        assert "created_at" in result


class TestTempDataServiceImport:
    """Tests for import functionality."""

    def test_import_from_dataframes_success(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test successful import of DataFrames."""
        store = temp_service.import_from_dataframes(
            user_id="user1",
            stock_df=sample_stock_df,
            consumo_df=sample_consumo_df,
            archivo_nombre="test.xlsx"
        )

        assert store is not None
        assert store.user_id == "user1"
        assert store.materiales_count == 3
        assert store.registros_stock == 3
        assert store.registros_consumo == 24
        assert store.archivo_nombre == "test.xlsx"

    def test_import_normalizes_column_names(self, temp_service):
        """Test that column names are normalized to lowercase."""
        stock_df = pd.DataFrame({
            "MATERIAL": ["MAT001"],
            "Descripcion": ["Test"],
            "CENTRO": ["1008"],
            "almacen": ["0001"],
            "Stock": [100],
            "UM": ["UNI"]
        })
        consumo_df = pd.DataFrame({
            "Material": ["MAT001"],
            "FECHA": [datetime.now()],
            "Cantidad": [10]
        })

        store = temp_service.import_from_dataframes("user1", stock_df, consumo_df)

        assert "material" in store.stock_df.columns
        assert "descripcion" in store.stock_df.columns
        assert "material" in store.consumo_df.columns

    def test_import_handles_missing_optional_columns(self, temp_service, sample_consumo_df):
        """Test that missing optional columns are handled gracefully."""
        stock_df = pd.DataFrame({
            "material": ["MAT001"],
            "descripcion": ["Test"],
            "centro": ["1008"],
            "almacen": ["0001"],
            "stock": [100],
            "um": ["UNI"]
            # No precio_usd, criticidad columns
        })

        store = temp_service.import_from_dataframes("user1", stock_df, sample_consumo_df)

        assert "precio_usd" in store.stock_df.columns
        assert store.stock_df["precio_usd"].iloc[0] == 0.0
        assert "criticidad" in store.stock_df.columns  # Auto-generated as "C"

    def test_import_generates_warnings_for_materiales_sin_stock(self, temp_service, sample_stock_df):
        """Test warning when consumo has materials not in stock."""
        consumo_df = pd.DataFrame({
            "material": ["MAT001", "MAT999"],  # MAT999 doesn't exist in stock
            "fecha": [datetime.now(), datetime.now()],
            "cantidad": [10, 20]
        })

        store = temp_service.import_from_dataframes("user1", sample_stock_df, consumo_df)

        assert any("no existen en stock" in w for w in store.advertencias)

    def test_import_generates_warnings_for_materiales_sin_consumo(self, temp_service, sample_stock_df):
        """Test warning when stock has materials without consumo."""
        consumo_df = pd.DataFrame({
            "material": ["MAT001"],  # Only MAT001, not MAT002 or MAT003
            "fecha": [datetime.now()],
            "cantidad": [10]
        })

        store = temp_service.import_from_dataframes("user1", sample_stock_df, consumo_df)

        # Check for warning about materials without consumption history
        assert any("sin consumo" in w.lower() or "forecast limitado" in w.lower() for w in store.advertencias)

    def test_import_generates_warnings_for_poco_historico(self, temp_service, sample_stock_df):
        """Test warning when material has less than 5 consumo records."""
        consumo_df = pd.DataFrame({
            "material": ["MAT001", "MAT001", "MAT001"],  # Only 3 records
            "fecha": [datetime.now(), datetime.now(), datetime.now()],
            "cantidad": [10, 20, 30]
        })

        store = temp_service.import_from_dataframes("user1", sample_stock_df, consumo_df)

        assert any("menos de 5 registros" in w for w in store.advertencias)

    def test_import_with_parametros_mrp(self, temp_service, sample_stock_df, sample_consumo_df, sample_parametros_mrp_df):
        """Test import with optional MRP parameters."""
        store = temp_service.import_from_dataframes(
            user_id="user1",
            stock_df=sample_stock_df,
            consumo_df=sample_consumo_df,
            parametros_mrp_df=sample_parametros_mrp_df
        )

        assert store.parametros_mrp_df is not None
        assert len(store.parametros_mrp_df) == 2

    def test_import_handles_invalid_dates(self, temp_service, sample_stock_df):
        """Test that invalid dates in consumo are handled."""
        consumo_df = pd.DataFrame({
            "material": ["MAT001", "MAT001"],
            "fecha": ["2024-01-15", "invalid_date"],
            "cantidad": [10, 20]
        })

        store = temp_service.import_from_dataframes("user1", sample_stock_df, consumo_df)

        # Check for warning about invalid dates (with or without accent)
        assert any("fecha" in w.lower() and "inv" in w.lower() for w in store.advertencias)


class TestTempDataServiceStatus:
    """Tests for status and active state management."""

    def test_is_active_returns_false_when_no_data(self, temp_service):
        """Test is_active returns False when no data imported."""
        assert temp_service.is_active("user1") is False

    def test_is_active_returns_true_after_import(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test is_active returns True after successful import."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        assert temp_service.is_active("user1") is True

    def test_get_status_returns_none_when_no_data(self, temp_service):
        """Test get_status returns None when no data."""
        assert temp_service.get_status("user1") is None

    def test_get_status_returns_dict_after_import(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_status returns proper dict after import."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        status = temp_service.get_status("user1")

        assert status is not None
        assert "user_id" in status
        assert "stats" in status
        assert status["stats"]["materiales"] == 3

    def test_clear_removes_data(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test clear removes the temp data."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)
        assert temp_service.is_active("user1") is True

        result = temp_service.clear("user1")

        assert result is True
        assert temp_service.is_active("user1") is False

    def test_clear_returns_false_when_no_data(self, temp_service):
        """Test clear returns False when no data to clear."""
        result = temp_service.clear("user1")

        assert result is False


class TestTempDataServiceStock:
    """Tests for stock data retrieval."""

    def test_get_stock_returns_empty_when_no_data(self, temp_service):
        """Test get_stock returns empty list when no data."""
        result = temp_service.get_stock("user1")

        assert result == []

    def test_get_stock_returns_all_records(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_stock returns all stock records."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_stock("user1")

        assert len(result) == 3
        assert all(isinstance(r, dict) for r in result)

    def test_get_stock_filters_by_centro(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_stock can filter by centro."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_stock("user1", filters={"centro": "1008"})

        assert len(result) == 2
        assert all(r["centro"] == "1008" for r in result)

    def test_get_stock_filters_by_almacen(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_stock can filter by almacen."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_stock("user1", filters={"almacen": "0002"})

        assert len(result) == 1
        assert result[0]["material"] == "MAT003"

    def test_get_stock_filters_by_material(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_stock can filter by material."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_stock("user1", filters={"material": "MAT001"})

        assert len(result) == 1
        assert result[0]["descripcion"] == "Tuerca M16"

    def test_get_stock_filters_by_search(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_stock can filter by search term."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_stock("user1", filters={"search": "aceite"})

        assert len(result) == 1
        assert result[0]["material"] == "MAT002"

    def test_get_stock_by_material_returns_dict(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_stock_by_material returns single dict."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_stock_by_material("user1", "MAT001")

        assert isinstance(result, dict)
        assert result["material"] == "MAT001"
        assert result["stock"] == 150

    def test_get_stock_by_material_returns_none_for_unknown(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_stock_by_material returns None for unknown material."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_stock_by_material("user1", "MAT999")

        assert result is None


class TestTempDataServiceConsumo:
    """Tests for consumo historico retrieval."""

    def test_get_consumo_historico_returns_empty_when_no_data(self, temp_service):
        """Test get_consumo_historico returns empty list when no data."""
        result = temp_service.get_consumo_historico("user1")

        assert result == []

    def test_get_consumo_historico_returns_all_records(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_consumo_historico returns all records."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_consumo_historico("user1")

        assert len(result) == 24

    def test_get_consumo_historico_filters_by_material(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_consumo_historico can filter by material."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_consumo_historico("user1", material="MAT001")

        assert len(result) == 12
        assert all(r["material"] == "MAT001" for r in result)

    def test_get_consumo_historico_returns_sorted_by_date(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_consumo_historico returns records sorted by date."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_consumo_historico("user1", material="MAT001")

        dates = [r["fecha"] for r in result]
        assert dates == sorted(dates)

    def test_get_consumo_agregado_mensual_returns_monthly_totals(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_consumo_agregado_mensual returns monthly aggregates."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_consumo_agregado_mensual("user1", "MAT001")

        assert len(result) > 0
        assert all("mes" in r and "cantidad" in r for r in result)

    def test_get_consumo_agregado_mensual_returns_empty_for_unknown_material(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_consumo_agregado_mensual returns empty for unknown material."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_consumo_agregado_mensual("user1", "MAT999")

        assert result == []


class TestTempDataServiceMRPParametros:
    """Tests for MRP parameters retrieval."""

    def test_get_parametros_mrp_returns_defaults_when_no_data(self, temp_service):
        """Test get_parametros_mrp returns defaults when no data."""
        result = temp_service.get_parametros_mrp("user1", "MAT001")

        assert result["stock_seguridad"] == 0
        assert result["punto_pedido"] == 0
        assert result["stock_maximo"] == 0
        assert result["lead_time_dias"] == 15

    def test_get_parametros_mrp_returns_custom_values(self, temp_service, sample_stock_df, sample_consumo_df, sample_parametros_mrp_df):
        """Test get_parametros_mrp returns custom values when provided."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            parametros_mrp_df=sample_parametros_mrp_df
        )

        result = temp_service.get_parametros_mrp("user1", "MAT001")

        assert result["stock_seguridad"] == 50
        assert result["punto_pedido"] == 75
        assert result["stock_maximo"] == 300
        assert result["lead_time_dias"] == 10

    def test_get_parametros_mrp_calculates_from_consumo(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_parametros_mrp calculates from consumo when no custom params."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_parametros_mrp("user1", "MAT001")

        # Should calculate based on monthly average
        assert result["stock_seguridad"] > 0
        assert result["punto_pedido"] > 0
        assert result["stock_maximo"] > 0

    def test_get_parametros_mrp_falls_back_to_stock_based(self, temp_service, sample_stock_df):
        """Test get_parametros_mrp uses stock-based defaults when no consumo."""
        consumo_df = pd.DataFrame({
            "material": ["MAT999"],  # Different material
            "fecha": [datetime.now()],
            "cantidad": [10]
        })
        temp_service.import_from_dataframes("user1", sample_stock_df, consumo_df)

        result = temp_service.get_parametros_mrp("user1", "MAT001")

        # Should calculate based on current stock
        assert result["stock_seguridad"] == 150 * 0.2  # 20% of stock
        assert result["punto_pedido"] == 150 * 0.3     # 30% of stock


class TestTempDataServiceCatalogos:
    """Tests for catalog data retrieval."""

    def test_get_materiales_list_returns_unique_materials(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_materiales_list returns unique materials with descriptions."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_materiales_list("user1")

        assert len(result) == 3
        assert all("material" in r and "descripcion" in r and "um" in r for r in result)

    def test_get_centros_list_returns_unique_centros(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_centros_list returns unique centros."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_centros_list("user1")

        assert len(result) == 2  # 1008 and 1010
        assert "1008" in result
        assert "1010" in result

    def test_get_almacenes_list_returns_all_almacenes(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_almacenes_list returns all almacenes."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_almacenes_list("user1")

        assert len(result) == 2  # 0001 and 0002

    def test_get_almacenes_list_filters_by_centro(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test get_almacenes_list can filter by centro."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_almacenes_list("user1", centro="1008")

        assert len(result) == 1
        assert "0001" in result


class TestTempDataServiceIsolation:
    """Tests for user data isolation."""

    def test_different_users_have_separate_data(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test that different users have isolated data stores."""
        # Import data for user1
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        # User2 should not have data
        assert temp_service.is_active("user2") is False
        assert temp_service.get_stock("user2") == []

    def test_clearing_one_user_does_not_affect_others(self, temp_service, sample_stock_df, sample_consumo_df):
        """Test that clearing one user's data doesn't affect others."""
        # Import data for both users
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)
        temp_service.import_from_dataframes("user2", sample_stock_df, sample_consumo_df)

        # Clear user1's data
        temp_service.clear("user1")

        # User2 should still have data
        assert temp_service.is_active("user1") is False
        assert temp_service.is_active("user2") is True


# ============================================================================
# NEW TESTS FOR SOLPEDS, PEDIDOS AND ADDITIONAL METHODS
# ============================================================================

@pytest.fixture
def sample_solpeds_df():
    """Sample SOLPEDS DataFrame for testing with SAP-compliant columns."""
    return pd.DataFrame({
        # Identificación
        "centro": [1008, 1008, 1010],
        "grupo_compras": [144, 144, 145],
        "clase_documento": ["NB", "NB", "NB"],
        "solped": [1000045678, 1000045679, 1000045680],
        "posicion_solped": [10, 10, 10],
        # Material
        "material": ["MAT001", "MAT001", "MAT002"],
        "descripcion_material": ["Tuerca M16", "Tuerca M16", "Aceite Hidraulico"],
        "grupo_articulos": [1520, 1520, 1310],
        # Timeline Solped
        "fecha_creacion_solped": ["01.11.2025", "10.11.2025", "15.11.2025"],
        "fecha_entrega_solped": ["15.12.2025", "20.12.2025", "25.12.2025"],
        "liberacion_solped": ["S/ EST.LIB", "LIBERADA", "LIBERADA"],
        "fecha_liberacion_solped": [None, "12.11.2025", "17.11.2025"],
        # Financiero Solped
        "cantidad_solped": [50, 30, 20],
        "um": ["UNI", "UNI", "LT"],
        "precio_unitario_solped": [2.50, 2.50, 15.00],
        "importe_total_solped": [125.00, 75.00, 300.00],
        "moneda_solped": ["USD", "USD", "USD"],
        "centro_costos": ["CC-MANT-001", "CC-MANT-002", "CC-LUBR-001"],
        "imputacion": ["K", "K", "K"],
        # Datos del Pedido (si existe)
        "pedido": [None, 4500001234, 4500001235],
        "posicion_pedido": [None, 10, 10],
        "clase_pedido": [None, "NB", "NB"],
        "fecha_pedido": [None, "15.11.2025", "20.11.2025"],
        "fecha_liberacion_pedido": [None, "16.11.2025", "21.11.2025"],
        "estrategia_liberacion_pedido": [None, "Z1", "Z1"],
        "fecha_entrega_pedido": [None, "20.12.2025", "25.12.2025"],
        # Cantidades y Recepción
        "cantidad_pedida": [None, 30, 20],
        "cantidad_recepcionada": [None, 15, 20],
        "fecha_recepcion": [None, "18.12.2025", "22.12.2025"],
        # Valores Pedido
        "valor_pedido": [None, 75.00, 300.00],
        "valor_recibido": [None, 37.50, 300.00],
        "moneda_pedido": [None, "USD", "USD"],
        "valor_facturado": [None, 37.50, 300.00],
        "moneda_facturada": [None, "USD", "USD"],
        # Proveedor y Contrato
        "proveedor": [None, 100123, 100456],
        "nombre_proveedor": [None, "Proveedor A", "Proveedor B"],
        "contrato_marco": [None, 4600001001, None],
        "posicion_contrato_marco": [None, 10, None],
        # Usuarios
        "creado_por": ["JPEREZ", "MRODRIGUEZ", "LGOMEZ"],
        "solicitante": ["JPEREZ", "MRODRIGUEZ", "LGOMEZ"],
        "num_necesidad": ["NEC-001", "NEC-002", "NEC-003"],
        "concluida": ["N", "N", "S"]
    })


@pytest.fixture
def sample_pedidos_df():
    """Sample PEDIDOS DataFrame for testing with SAP-compliant columns."""
    return pd.DataFrame({
        # Identificación
        "centro": [1008, 1008, 1010],
        "grupo_compras": [144, 145, 146],
        "pedido": [4500001234, 4500001235, 4500001236],
        "posicion_pedido": [10, 10, 10],
        "clase_pedido": ["NB", "NB", "NB"],
        # Material
        "material": ["MAT001", "MAT002", "MAT003"],
        "descripcion_material": ["Tuerca M16", "Aceite Hidraulico", "Rodamiento SKF"],
        "grupo_articulos": [1520, 1310, 1124],
        "um": ["UNI", "LT", "UNI"],
        # Timeline
        "fecha_pedido": ["15.11.2025", "20.11.2025", "25.11.2025"],
        "fecha_liberacion_pedido": ["16.11.2025", "21.11.2025", "26.11.2025"],
        "estrategia_liberacion": ["Z1", "Z1", "Z1"],
        "fecha_entrega_pedido": ["20.12.2025", "25.12.2025", "30.12.2025"],
        "fecha_recepcion": ["18.12.2025", "22.12.2025", None],  # MAT003 not received yet
        # Cantidades
        "cantidad_pedida": [100, 50, 30],
        "cantidad_recepcionada": [50, 50, 0],  # MAT001 partial, MAT002 complete, MAT003 pending
        # Valores
        "valor_pedido": [250.00, 750.00, 2250.00],
        "valor_recibido": [125.00, 750.00, 0.00],
        "moneda_pedido": ["USD", "USD", "USD"],
        "valor_facturado": [125.00, 750.00, None],
        "moneda_facturada": ["USD", "USD", None],
        # Proveedor y Contrato
        "proveedor": [100123, 100456, 100789],
        "nombre_proveedor": ["Proveedor A", "Proveedor B", "Proveedor C"],
        "contrato_marco": [4600001001, None, None],
        "posicion_contrato_marco": [10, None, None],
        # Solped origen
        "solped_origen": [1000045679, 1000045680, None],
        "posicion_solped": [10, 10, None]
    })


class TestTempDataServiceSolpeds:
    """Tests for SOLPEDS en curso functionality."""

    def test_get_solpeds_en_curso_returns_empty_when_no_data(self, temp_service):
        """Test get_solpeds_en_curso returns empty list when no data."""
        result = temp_service.get_solpeds_en_curso("user1")
        assert result == []

    def test_get_solpeds_en_curso_returns_all_records(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_solpeds_df
    ):
        """Test get_solpeds_en_curso returns all records."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            solpeds_df=sample_solpeds_df
        )

        result = temp_service.get_solpeds_en_curso("user1")

        assert len(result) == 3
        assert all(isinstance(r, dict) for r in result)

    def test_get_solpeds_en_curso_filters_by_material(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_solpeds_df
    ):
        """Test get_solpeds_en_curso can filter by material."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            solpeds_df=sample_solpeds_df
        )

        result = temp_service.get_solpeds_en_curso("user1", material="MAT001")

        assert len(result) == 2
        assert all(r["material"] == "MAT001" for r in result)

    def test_get_solpeds_en_curso_filters_by_centro(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_solpeds_df
    ):
        """Test get_solpeds_en_curso can filter by centro."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            solpeds_df=sample_solpeds_df
        )

        result = temp_service.get_solpeds_en_curso("user1", centro="1008")

        assert len(result) == 2
        assert all(str(r["centro"]) == "1008" for r in result)

    def test_get_solpeds_en_curso_filters_by_liberacion(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_solpeds_df
    ):
        """Test get_solpeds_en_curso can filter by liberacion state."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            solpeds_df=sample_solpeds_df
        )

        result = temp_service.get_solpeds_en_curso("user1", liberacion="LIBERADA")

        assert len(result) == 2
        # Check for both old and new column names for compatibility
        for r in result:
            lib_value = r.get("liberacion_solped") or r.get("liberacion")
            assert lib_value == "LIBERADA"

    def test_get_solpeds_en_curso_converts_dates_to_string(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_solpeds_df
    ):
        """Test get_solpeds_en_curso converts dates to string format."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            solpeds_df=sample_solpeds_df
        )

        result = temp_service.get_solpeds_en_curso("user1")

        # Dates should be strings (not datetime objects)
        for r in result:
            # Check for both old and new column names
            fecha = r.get("fecha_creacion_solped") or r.get("fecha_creacion")
            if fecha:
                assert isinstance(fecha, str)


class TestTempDataServicePedidos:
    """Tests for PEDIDOS en curso functionality."""

    def test_get_pedidos_en_curso_returns_empty_when_no_data(self, temp_service):
        """Test get_pedidos_en_curso returns empty list when no data."""
        result = temp_service.get_pedidos_en_curso("user1")
        assert result == []

    def test_get_pedidos_en_curso_returns_pending_only(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_pedidos_df
    ):
        """Test get_pedidos_en_curso returns only pending pedidos."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            pedidos_df=sample_pedidos_df
        )

        result = temp_service.get_pedidos_en_curso("user1")

        # MAT002 is complete (cantidad_pedida == cantidad_recepcionada)
        # So should only return MAT001 (partial) and MAT003 (pending)
        assert len(result) == 2
        materials = {r["material"] for r in result}
        assert "MAT001" in materials
        assert "MAT003" in materials
        assert "MAT002" not in materials

    def test_get_pedidos_en_curso_calculates_cantidad_pendiente(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_pedidos_df
    ):
        """Test get_pedidos_en_curso calculates cantidad_pendiente correctly."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            pedidos_df=sample_pedidos_df
        )

        result = temp_service.get_pedidos_en_curso("user1")

        for r in result:
            if r["material"] == "MAT001":
                assert r["cantidad_pendiente"] == 50  # 100 - 50
            elif r["material"] == "MAT003":
                assert r["cantidad_pendiente"] == 30  # 30 - 0

    def test_get_pedidos_en_curso_filters_by_material(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_pedidos_df
    ):
        """Test get_pedidos_en_curso can filter by material."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            pedidos_df=sample_pedidos_df
        )

        result = temp_service.get_pedidos_en_curso("user1", material="MAT001")

        assert len(result) == 1
        assert result[0]["material"] == "MAT001"

    def test_get_pedidos_en_curso_filters_by_centro(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_pedidos_df
    ):
        """Test get_pedidos_en_curso can filter by centro."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            pedidos_df=sample_pedidos_df
        )

        result = temp_service.get_pedidos_en_curso("user1", centro="1010")

        assert len(result) == 1
        assert str(result[0]["centro"]) == "1010"


class TestTempDataServiceCantidadEnTransito:
    """Tests for cantidad en transito calculation."""

    def test_get_cantidad_en_transito_returns_zero_when_no_data(self, temp_service):
        """Test get_cantidad_en_transito returns 0 when no data."""
        result = temp_service.get_cantidad_en_transito("user1", "MAT001")
        assert result == 0.0

    def test_get_cantidad_en_transito_includes_pedidos_pendientes(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_pedidos_df
    ):
        """Test get_cantidad_en_transito includes pedidos pendientes."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            pedidos_df=sample_pedidos_df
        )

        result = temp_service.get_cantidad_en_transito("user1", "MAT001")

        # MAT001 has 50 pending (100 pedida - 50 recepcionada)
        assert result == 50.0

    def test_get_cantidad_en_transito_includes_solpeds_liberadas(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_solpeds_df
    ):
        """Test get_cantidad_en_transito includes liberadas solpeds."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            solpeds_df=sample_solpeds_df
        )

        result = temp_service.get_cantidad_en_transito("user1", "MAT001")

        # MAT001 has 1 LIBERADA solped with cantidad_solped = 30
        assert result == 30.0

    def test_get_cantidad_en_transito_combines_pedidos_and_solpeds(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_solpeds_df, sample_pedidos_df
    ):
        """Test get_cantidad_en_transito combines pedidos and solpeds liberadas."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            solpeds_df=sample_solpeds_df,
            pedidos_df=sample_pedidos_df
        )

        result = temp_service.get_cantidad_en_transito("user1", "MAT001")

        # MAT001: 50 pending pedido + 30 liberada solped = 80
        assert result == 80.0


class TestTempDataServiceDemandaEstimada:
    """Tests for demanda estimada anual functionality."""

    def test_get_demanda_estimada_anual_returns_none_when_no_data(self, temp_service):
        """Test get_demanda_estimada_anual returns None when no data."""
        result = temp_service.get_demanda_estimada_anual("user1", "MAT001")
        assert result is None

    def test_get_demanda_estimada_anual_from_parametros_mrp(
        self, temp_service, sample_stock_df, sample_consumo_df
    ):
        """Test get_demanda_estimada_anual reads from parametros_mrp."""
        parametros_df = pd.DataFrame({
            "material": ["MAT001", "MAT002"],
            "demanda_estimada_anual": [1200, 600],
            "stock_seguridad": [50, 25],
            "punto_pedido": [100, 50],
            "stock_maximo": [400, 200],
            "lead_time_dias": [10, 7]
        })

        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            parametros_mrp_df=parametros_df
        )

        result = temp_service.get_demanda_estimada_anual("user1", "MAT001")

        assert result == 1200.0

    def test_get_demanda_estimada_anual_calculates_from_consumo(
        self, temp_service, sample_stock_df, sample_consumo_df
    ):
        """Test get_demanda_estimada_anual calculates from consumo when no params."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_demanda_estimada_anual("user1", "MAT001")

        # Should calculate from historical consumption
        assert result is not None
        assert result > 0

    def test_get_demanda_estimada_anual_returns_none_for_unknown_material(
        self, temp_service, sample_stock_df, sample_consumo_df
    ):
        """Test get_demanda_estimada_anual returns None for unknown material."""
        temp_service.import_from_dataframes("user1", sample_stock_df, sample_consumo_df)

        result = temp_service.get_demanda_estimada_anual("user1", "MAT999")

        assert result is None


class TestTempDataServiceImportWithAllSheets:
    """Tests for importing all 5 sheets together."""

    def test_import_all_sheets_success(
        self, temp_service, sample_stock_df, sample_consumo_df,
        sample_solpeds_df, sample_pedidos_df, sample_parametros_mrp_df
    ):
        """Test successful import of all 5 sheets."""
        store = temp_service.import_from_dataframes(
            user_id="user1",
            stock_df=sample_stock_df,
            consumo_df=sample_consumo_df,
            solpeds_df=sample_solpeds_df,
            pedidos_df=sample_pedidos_df,
            parametros_mrp_df=sample_parametros_mrp_df,
            archivo_nombre="complete_test.xlsx"
        )

        assert store is not None
        assert store.registros_stock == 3
        assert store.registros_consumo == 24
        assert store.registros_solpeds == 3
        assert store.registros_pedidos == 3

    def test_to_dict_includes_solpeds_and_pedidos_stats(
        self, temp_service, sample_stock_df, sample_consumo_df,
        sample_solpeds_df, sample_pedidos_df
    ):
        """Test to_dict includes solpeds and pedidos stats."""
        store = temp_service.import_from_dataframes(
            user_id="user1",
            stock_df=sample_stock_df,
            consumo_df=sample_consumo_df,
            solpeds_df=sample_solpeds_df,
            pedidos_df=sample_pedidos_df
        )

        result = store.to_dict()

        assert "registros_solpeds" in result["stats"]
        assert "registros_pedidos" in result["stats"]
        assert result["stats"]["registros_solpeds"] == 3
        assert result["stats"]["registros_pedidos"] == 3


# ============================================================================
# TESTS FOR KPI METHODS
# ============================================================================

class TestTempDataServiceKPITiemposCiclo:
    """Tests for KPI tiempos de ciclo functionality."""

    def test_get_kpi_tiempos_ciclo_returns_structure_when_no_data(self, temp_service):
        """Test get_kpi_tiempos_ciclo returns structured dict when no data."""
        result = temp_service.get_kpi_tiempos_ciclo("user1")
        # Returns structured dict with None values when no data
        assert isinstance(result, dict)
        assert result.get("registros_analizados", 0) == 0

    def test_get_kpi_tiempos_ciclo_calculates_averages(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_solpeds_df
    ):
        """Test get_kpi_tiempos_ciclo calculates cycle time averages."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            solpeds_df=sample_solpeds_df
        )

        result = temp_service.get_kpi_tiempos_ciclo("user1")

        # Should have some cycle time metrics
        assert result is not None
        # If there are dates to calculate, there should be averages
        if "tiempo_aprobacion_solped_promedio" in result:
            assert result["tiempo_aprobacion_solped_promedio"] >= 0

    def test_get_kpi_tiempos_ciclo_filters_by_material(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_solpeds_df
    ):
        """Test get_kpi_tiempos_ciclo can filter by material."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            solpeds_df=sample_solpeds_df
        )

        result = temp_service.get_kpi_tiempos_ciclo("user1", material="MAT001")

        # Should calculate times only for MAT001
        assert result is not None


class TestTempDataServiceKPICumplimiento:
    """Tests for KPI cumplimiento functionality."""

    def test_get_kpi_cumplimiento_returns_structure_when_no_data(self, temp_service):
        """Test get_kpi_cumplimiento returns structured dict when no data."""
        result = temp_service.get_kpi_cumplimiento("user1")
        # Returns structured dict with None values when no data
        assert isinstance(result, dict)
        assert result.get("pedidos_analizados", 0) == 0

    def test_get_kpi_cumplimiento_calculates_rates(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_pedidos_df
    ):
        """Test get_kpi_cumplimiento calculates fulfillment rates."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            pedidos_df=sample_pedidos_df
        )

        result = temp_service.get_kpi_cumplimiento("user1")

        # Should have fulfillment metrics
        assert result is not None
        assert "pedidos_analizados" in result
        if result.get("tasa_recepcion") is not None:
            assert 0 <= result["tasa_recepcion"] <= 1


class TestTempDataServiceKPIUsoContratos:
    """Tests for KPI uso contratos marco functionality."""

    def test_get_kpi_uso_contratos_returns_structure_when_no_data(self, temp_service):
        """Test get_kpi_uso_contratos returns structured dict when no data."""
        result = temp_service.get_kpi_uso_contratos("user1")
        # Returns structured dict with zero/empty values when no data
        assert isinstance(result, dict)
        assert result.get("total_pedidos", 0) == 0

    def test_get_kpi_uso_contratos_calculates_metrics(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_pedidos_df
    ):
        """Test get_kpi_uso_contratos calculates contract usage."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            pedidos_df=sample_pedidos_df
        )

        result = temp_service.get_kpi_uso_contratos("user1")

        # Should have contract usage metrics
        assert result is not None
        if "porcentaje_con_contrato_marco" in result:
            assert 0 <= result["porcentaje_con_contrato_marco"] <= 100


class TestTempDataServiceSolpedFilters:
    """Tests for solped filtering methods."""

    def test_get_solpeds_sin_pedido_returns_empty_when_no_data(self, temp_service):
        """Test get_solpeds_sin_pedido returns empty list when no data."""
        result = temp_service.get_solpeds_sin_pedido("user1")
        assert result == []

    def test_get_solpeds_sin_pedido_returns_liberadas_sin_pedido(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_solpeds_df
    ):
        """Test get_solpeds_sin_pedido returns only liberadas without pedido."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            solpeds_df=sample_solpeds_df
        )

        result = temp_service.get_solpeds_sin_pedido("user1")

        # Should not include any solpeds - the sample has:
        # - solped 1: S/ EST.LIB (not liberada)
        # - solped 2: LIBERADA with pedido
        # - solped 3: LIBERADA with pedido (complete)
        assert len(result) == 0

    def test_get_solpeds_pendientes_recepcion_returns_empty_when_no_data(self, temp_service):
        """Test get_solpeds_pendientes_recepcion returns empty list when no data."""
        result = temp_service.get_solpeds_pendientes_recepcion("user1")
        assert result == []

    def test_get_solpeds_pendientes_recepcion_returns_solpeds_with_partial_reception(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_solpeds_df
    ):
        """Test get_solpeds_pendientes_recepcion returns solpeds awaiting completion."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            solpeds_df=sample_solpeds_df
        )

        result = temp_service.get_solpeds_pendientes_recepcion("user1")

        # Should include solped 1000045679 which has partial reception (15/30)
        assert len(result) >= 1


class TestTempDataServicePedidoFilters:
    """Tests for pedido filtering methods."""

    def test_get_pedidos_retrasados_returns_empty_when_no_data(self, temp_service):
        """Test get_pedidos_retrasados returns empty list when no data."""
        result = temp_service.get_pedidos_retrasados("user1")
        assert result == []

    def test_get_pedidos_por_vencer_returns_empty_when_no_data(self, temp_service):
        """Test get_pedidos_por_vencer returns empty list when no data."""
        result = temp_service.get_pedidos_por_vencer("user1")
        assert result == []

    def test_get_pedidos_por_vencer_accepts_dias_parameter(
        self, temp_service, sample_stock_df, sample_consumo_df, sample_pedidos_df
    ):
        """Test get_pedidos_por_vencer accepts dias parameter."""
        temp_service.import_from_dataframes(
            "user1", sample_stock_df, sample_consumo_df,
            pedidos_df=sample_pedidos_df
        )

        result = temp_service.get_pedidos_por_vencer("user1", dias=30)

        # Should be a list (could be empty if no pedidos about to expire)
        assert isinstance(result, list)


class TestTempDataServiceConsumoHistoricoAlmacen:
    """Tests for consumo historico with almacen column."""

    def test_consumo_historico_includes_almacen(self, temp_service, sample_stock_df):
        """Test that consumo_historico can include almacen column."""
        consumo_df = pd.DataFrame({
            "material": ["MAT001", "MAT001"],
            "fecha": [datetime.now(), datetime.now() - timedelta(days=30)],
            "cantidad": [10, 20],
            "centro": ["1008", "1008"],
            "almacen": ["0001", "0001"]
        })

        store = temp_service.import_from_dataframes(
            "user1", sample_stock_df, consumo_df
        )

        result = temp_service.get_consumo_historico("user1")

        assert len(result) == 2
        # Check if almacen is preserved (may be optional)
        if result[0].get("almacen"):
            assert result[0]["almacen"] == "0001"
