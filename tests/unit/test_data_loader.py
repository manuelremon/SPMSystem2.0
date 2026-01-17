"""
Tests para DataLoader - Carga de datos SPM y SAP.

Cubre:
- Carga de solicitudes, materiales, presupuestos
- Carga de stock y consumo histórico desde SAP
- Cálculo de métricas de stock (ratio, días cobertura)
- Manejo de errores cuando BD no existe
- Filtros aplicados correctamente
"""

import sqlite3
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from backend.agent.tools.data_loader import DataLoader


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def temp_spm_db(tmp_path):
    """Crea una base de datos SPM temporal con datos de prueba."""
    db_path = tmp_path / "test_spm.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Crear tabla solicitudes (con todas las columnas que espera DataLoader)
    cursor.execute("""
        CREATE TABLE solicitudes (
            id INTEGER PRIMARY KEY,
            id_usuario INTEGER,
            centro TEXT,
            sector TEXT,
            status TEXT,
            criticidad TEXT,
            total_monto REAL,
            descripcion TEXT,
            created_at TEXT
        )
    """)

    # Insertar datos de prueba
    cursor.executemany(
        "INSERT INTO solicitudes (id_usuario, centro, sector, status, criticidad, total_monto, descripcion, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (1, "CENTRO1", "MANTENIMIENTO", "submitted", "media", 1500.00, "Solicitud bomba", "2024-01-01"),
            (1, "CENTRO1", "MANTENIMIENTO", "approved", "alta", 2500.00, "Solicitud válvula", "2024-01-02"),
            (2, "CENTRO2", "PRODUCCION", "submitted", "baja", 500.00, "Solicitud motor", "2024-01-03"),
            (2, "CENTRO2", "PRODUCCION", "rejected", "media", 1200.00, "Solicitud sensor", "2024-01-04"),
            (1, "CENTRO1", "MANTENIMIENTO", "submitted", "alta", 3500.00, "Solicitud filtro", "2024-01-05"),
        ],
    )

    # Crear tabla materiales
    cursor.execute("""
        CREATE TABLE materiales (
            id INTEGER PRIMARY KEY,
            codigo TEXT,
            descripcion TEXT,
            unidad TEXT,
            precio REAL
        )
    """)

    cursor.executemany(
        "INSERT INTO materiales (codigo, descripcion, unidad, precio) VALUES (?, ?, ?, ?)",
        [
            ("MAT001", "BOMBA CENTRIFUGA 2HP", "UN", 1500.00),
            ("MAT002", "VALVULA ESFERA 3/4", "UN", 250.00),
            ("MAT003", "MOTOR ELECTRICO 5HP", "UN", 3500.00),
            ("MAT004", "FILTRO ACEITE", "UN", 45.00),
            ("MAT005", "SELLO MECANICO BOMBA", "UN", 180.00),
        ],
    )

    # Crear tabla presupuestos
    cursor.execute("""
        CREATE TABLE presupuestos (
            id INTEGER PRIMARY KEY,
            centro TEXT,
            sector TEXT,
            monto REAL,
            disponible REAL
        )
    """)

    cursor.executemany(
        "INSERT INTO presupuestos (centro, sector, monto, disponible) VALUES (?, ?, ?, ?)",
        [
            ("CENTRO1", "MANTENIMIENTO", 100000.00, 75000.00),
            ("CENTRO1", "PRODUCCION", 200000.00, 180000.00),
            ("CENTRO2", "MANTENIMIENTO", 80000.00, 60000.00),
        ],
    )

    # Crear tablas de catálogos
    cursor.execute("""
        CREATE TABLE catalog_centros (id INTEGER PRIMARY KEY, codigo TEXT, nombre TEXT)
    """)
    cursor.execute("""
        CREATE TABLE catalog_sectores (id INTEGER PRIMARY KEY, codigo TEXT, nombre TEXT)
    """)
    cursor.execute("""
        CREATE TABLE catalog_almacenes (id INTEGER PRIMARY KEY, codigo TEXT, nombre TEXT)
    """)

    cursor.execute("INSERT INTO catalog_centros (codigo, nombre) VALUES ('C1', 'Centro 1')")
    cursor.execute("INSERT INTO catalog_sectores (codigo, nombre) VALUES ('S1', 'Sector 1')")
    cursor.execute("INSERT INTO catalog_almacenes (codigo, nombre) VALUES ('A1', 'Almacen 1')")

    conn.commit()
    conn.close()

    return db_path


@pytest.fixture
def temp_sap_db(tmp_path):
    """Crea una base de datos SAP temporal con datos de stock y consumo."""
    db_path = tmp_path / "sap_data.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Crear tabla stock
    cursor.execute("""
        CREATE TABLE stock (
            id INTEGER PRIMARY KEY,
            material TEXT,
            material_descripcion TEXT,
            stock REAL,
            precio REAL,
            stock_valorizado REAL,
            um TEXT,
            centro TEXT,
            centro_descripcion TEXT,
            almacen TEXT,
            regional TEXT,
            critico INTEGER,
            dia TEXT
        )
    """)

    # Datos de stock para varios materiales
    cursor.executemany(
        """INSERT INTO stock (
            material, material_descripcion, stock, precio, stock_valorizado,
            um, centro, centro_descripcion, almacen, regional, critico, dia
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            ("MAT001", "BOMBA CENTRIFUGA", 10.0, 1500.00, 15000.00, "UN", "C001", "Centro 1", "A01", "NORTE", 1, "2024-01-15"),
            ("MAT001", "BOMBA CENTRIFUGA", 5.0, 1500.00, 7500.00, "UN", "C002", "Centro 2", "A02", "SUR", 1, "2024-01-15"),
            ("MAT002", "VALVULA ESFERA", 100.0, 50.00, 5000.00, "UN", "C001", "Centro 1", "A01", "NORTE", 0, "2024-01-15"),
            ("MAT003", "MOTOR ELECTRICO", 2.0, 3500.00, 7000.00, "UN", "C001", "Centro 1", "A01", "NORTE", 1, "2024-01-15"),
            ("MAT004", "SIN STOCK ITEM", 0.0, 100.00, 0.0, "UN", "C001", "Centro 1", "A01", "NORTE", 0, "2024-01-15"),
        ],
    )

    # Crear tabla consumo_historico
    cursor.execute("""
        CREATE TABLE consumo_historico (
            id INTEGER PRIMARY KEY,
            fecha TEXT,
            material TEXT,
            descripcion TEXT,
            cantidad REAL,
            centro TEXT,
            almacen TEXT
        )
    """)

    # Datos de consumo histórico para MAT001 (30 días de datos)
    consumo_entries = []
    for day in range(1, 31):
        consumo_entries.append((
            f"2024-01-{day:02d}",
            "MAT001",
            "BOMBA CENTRIFUGA",
            1.0,  # 1 unidad por día
            "C001",
            "A01",
        ))
    # Agregar consumo para MAT002
    consumo_entries.extend([
        ("2024-01-10", "MAT002", "VALVULA ESFERA", 5.0, "C001", "A01"),
        ("2024-01-15", "MAT002", "VALVULA ESFERA", 3.0, "C001", "A01"),
        ("2024-01-20", "MAT002", "VALVULA ESFERA", 2.0, "C001", "A01"),
    ])

    cursor.executemany(
        """INSERT INTO consumo_historico (fecha, material, descripcion, cantidad, centro, almacen)
        VALUES (?, ?, ?, ?, ?, ?)""",
        consumo_entries,
    )

    conn.commit()
    conn.close()

    return db_path


@pytest.fixture
def data_loader(temp_spm_db, temp_sap_db):
    """Crea un DataLoader mockeando las conexiones a BD."""
    import sqlite3

    # Mock para conexión PostgreSQL (devuelve conexión a SQLite temporal)
    def mock_get_db_connection():
        conn = sqlite3.connect(temp_spm_db)
        conn.row_factory = sqlite3.Row
        return conn

    with patch('backend.agent.tools.data_loader._get_db_connection', mock_get_db_connection):
        with patch('backend.agent.tools.data_loader.SAP_DATA_DB', temp_sap_db):
            with patch('backend.agent.tools.data_loader.CATALOGO_MATERIALES_DB', temp_spm_db):
                loader = DataLoader()
                # Store patches for use in tests
                loader._mock_db_path = temp_spm_db
                loader._mock_sap_path = temp_sap_db
                yield loader


# =============================================================================
# Tests de Solicitudes
# =============================================================================


class TestLoadSolicitudes:
    """Tests para carga de solicitudes."""

    def test_load_all_solicitudes(self, data_loader):
        """Debería cargar todas las solicitudes."""
        result = data_loader.execute(data_type="solicitudes")

        assert result["data_type"] == "solicitudes"
        assert result["count"] == 5
        assert len(result["data"]) == 5

    def test_filter_by_estado(self, data_loader):
        """Debería filtrar por estado."""
        result = data_loader.execute(
            data_type="solicitudes",
            filters={"estado": "submitted"},
        )

        assert result["count"] == 3
        for sol in result["data"]:
            assert sol["status"] == "submitted"

    def test_filter_by_usuario(self, data_loader):
        """Debería filtrar por usuario."""
        result = data_loader.execute(
            data_type="solicitudes",
            filters={"usuario_id": 1},
        )

        assert result["count"] == 3
        for sol in result["data"]:
            assert sol["id_usuario"] == 1

    def test_filter_by_centro(self, data_loader):
        """Debería filtrar por centro."""
        result = data_loader.execute(
            data_type="solicitudes",
            filters={"centro": "CENTRO2"},
        )

        assert result["count"] == 2
        for sol in result["data"]:
            assert sol["centro"] == "CENTRO2"

    def test_limit_results(self, data_loader):
        """Debería respetar el límite de resultados."""
        result = data_loader.execute(data_type="solicitudes", limit=2)

        assert result["count"] == 2
        assert len(result["data"]) == 2


# =============================================================================
# Tests de Materiales
# =============================================================================


class TestLoadMateriales:
    """Tests para carga de materiales."""

    def test_load_all_materiales(self, data_loader):
        """Debería cargar todos los materiales."""
        result = data_loader.execute(data_type="materiales")

        assert result["data_type"] == "materiales"
        assert result["count"] == 5

    def test_search_by_descripcion(self, data_loader):
        """Debería buscar por descripción."""
        result = data_loader.execute(
            data_type="materiales",
            filters={"search": "BOMBA"},
        )

        assert result["count"] >= 1
        assert "BOMBA" in result["data"][0]["descripcion"].upper()

    def test_filter_by_codigo(self, data_loader):
        """Debería filtrar por código exacto."""
        result = data_loader.execute(
            data_type="materiales",
            filters={"codigo": "MAT001"},
        )

        assert result["count"] == 1
        assert result["data"][0]["codigo"] == "MAT001"


# =============================================================================
# Tests de Stock (SAP)
# =============================================================================


class TestLoadStock:
    """Tests para carga de stock desde SAP."""

    def test_load_stock_without_sap_db(self, data_loader):
        """Debería manejar ausencia de BD SAP graciosamente."""
        with patch("backend.agent.tools.data_loader.SAP_DATA_DB", Path("/nonexistent/path.db")):
            result = data_loader._load_stock({}, limit=100)

        assert result["data_type"] == "stock"
        assert result["count"] == 0
        assert "error" in result or len(result["data"]) == 0

    def test_load_stock_with_filters(self, temp_sap_db, temp_spm_db):
        """Debería filtrar stock correctamente."""
        with patch("backend.agent.tools.data_loader.SAP_DATA_DB", temp_sap_db):
            loader = DataLoader(db_path=str(temp_spm_db))
            result = loader.execute(
                data_type="stock",
                filters={"material": "MAT001"},
            )

        assert result["data_type"] == "stock"
        assert result["count"] == 2  # MAT001 en 2 centros
        for item in result["data"]:
            assert item["material"] == "MAT001"

    def test_load_stock_excludes_zero_by_default(self, temp_sap_db, temp_spm_db):
        """Debería excluir items con stock 0 por defecto."""
        with patch("backend.agent.tools.data_loader.SAP_DATA_DB", temp_sap_db):
            loader = DataLoader(db_path=str(temp_spm_db))
            result = loader.execute(data_type="stock")

        # MAT004 tiene stock 0, no debería aparecer
        materials = [item["material"] for item in result["data"]]
        assert "MAT004" not in materials

    def test_load_stock_include_zero(self, temp_sap_db, temp_spm_db):
        """Debería incluir items con stock 0 si se solicita."""
        with patch("backend.agent.tools.data_loader.SAP_DATA_DB", temp_sap_db):
            loader = DataLoader(db_path=str(temp_spm_db))
            result = loader.execute(
                data_type="stock",
                filters={"include_zero_stock": True},
            )

        materials = [item["material"] for item in result["data"]]
        assert "MAT004" in materials

    def test_load_stock_filter_by_centro(self, temp_sap_db, temp_spm_db):
        """Debería filtrar por centro."""
        with patch("backend.agent.tools.data_loader.SAP_DATA_DB", temp_sap_db):
            loader = DataLoader(db_path=str(temp_spm_db))
            result = loader.execute(
                data_type="stock",
                filters={"centro": "C001"},
            )

        for item in result["data"]:
            assert item["centro"] == "C001"


# =============================================================================
# Tests de Consumo Histórico (SAP)
# =============================================================================


class TestLoadConsumoHistorico:
    """Tests para carga de consumo histórico."""

    def test_load_consumo_without_sap_db(self, data_loader):
        """Debería manejar ausencia de BD SAP graciosamente."""
        with patch("backend.agent.tools.data_loader.SAP_DATA_DB", Path("/nonexistent/path.db")):
            result = data_loader._load_consumo_historico({}, limit=100)

        assert result["data_type"] == "consumo_historico"
        assert result["count"] == 0

    def test_load_consumo_for_material(self, temp_sap_db, temp_spm_db):
        """Debería cargar consumo para un material específico."""
        with patch("backend.agent.tools.data_loader.SAP_DATA_DB", temp_sap_db):
            loader = DataLoader(db_path=str(temp_spm_db))
            result = loader.execute(
                data_type="consumo_historico",
                filters={"material": "MAT001"},
            )

        assert result["data_type"] == "consumo_historico"
        assert result["count"] == 30  # 30 días de datos
        for item in result["data"]:
            assert item["material"] == "MAT001"

    def test_load_consumo_with_date_filter(self, temp_sap_db, temp_spm_db):
        """Debería filtrar por rango de fechas."""
        with patch("backend.agent.tools.data_loader.SAP_DATA_DB", temp_sap_db):
            loader = DataLoader(db_path=str(temp_spm_db))
            result = loader.execute(
                data_type="consumo_historico",
                filters={
                    "material": "MAT001",
                    "fecha_desde": "2024-01-10",
                    "fecha_hasta": "2024-01-15",
                },
            )

        assert result["count"] == 6  # 10-15 enero
        for item in result["data"]:
            assert "2024-01-10" <= item["fecha"] <= "2024-01-15"


# =============================================================================
# Tests de get_stock_for_material
# =============================================================================


class TestGetStockForMaterial:
    """Tests para cálculo de métricas de stock."""

    def test_stock_metrics_calculation(self, temp_sap_db, temp_spm_db):
        """Debería calcular métricas de stock correctamente."""
        with patch("backend.agent.tools.data_loader.SAP_DATA_DB", temp_sap_db):
            loader = DataLoader(db_path=str(temp_spm_db))
            result = loader.get_stock_for_material("MAT001")

        assert result["material"] == "MAT001"
        assert result["stock_total"] == 15.0  # 10 + 5
        assert len(result["stock_por_centro"]) == 2
        assert result["demanda_promedio_diaria"] == 1.0  # 30 unidades en 30 días
        assert result["dias_cobertura"] == 15.0  # 15 unidades / 1 por día

    def test_stock_metrics_no_consumo(self, temp_sap_db, temp_spm_db):
        """Debería manejar materiales sin histórico de consumo."""
        with patch("backend.agent.tools.data_loader.SAP_DATA_DB", temp_sap_db):
            loader = DataLoader(db_path=str(temp_spm_db))
            result = loader.get_stock_for_material("MAT003")

        assert result["material"] == "MAT003"
        assert result["stock_total"] == 2.0
        assert result["demanda_promedio_diaria"] == 0.0
        assert result["ratio_stock_demanda"] is None
        assert result["dias_cobertura"] is None

    def test_stock_metrics_no_stock(self, temp_sap_db, temp_spm_db):
        """Debería manejar materiales sin stock."""
        with patch("backend.agent.tools.data_loader.SAP_DATA_DB", temp_sap_db):
            loader = DataLoader(db_path=str(temp_spm_db))
            # Material que no existe en stock
            result = loader.get_stock_for_material("INEXISTENTE")

        assert result["stock_total"] == 0.0
        assert result["stock_por_centro"] == []


# =============================================================================
# Tests de Presupuestos
# =============================================================================


class TestLoadPresupuestos:
    """Tests para carga de presupuestos."""

    def test_load_all_presupuestos(self, data_loader):
        """Debería cargar todos los presupuestos."""
        result = data_loader.execute(data_type="presupuestos")

        assert result["data_type"] == "presupuestos"
        assert result["count"] == 3

    def test_filter_by_centro(self, data_loader):
        """Debería filtrar por centro."""
        result = data_loader.execute(
            data_type="presupuestos",
            filters={"centro": "CENTRO1"},
        )

        assert result["count"] == 2
        for pres in result["data"]:
            assert pres["centro"] == "CENTRO1"

    def test_filter_by_sector(self, data_loader):
        """Debería filtrar por sector."""
        result = data_loader.execute(
            data_type="presupuestos",
            filters={"sector": "MANTENIMIENTO"},
        )

        assert result["count"] == 2
        for pres in result["data"]:
            assert pres["sector"] == "MANTENIMIENTO"


# =============================================================================
# Tests de Catálogos
# =============================================================================


class TestLoadCatalogs:
    """Tests para carga de catálogos."""

    def test_load_catalogs(self, data_loader):
        """Debería cargar todos los catálogos."""
        result = data_loader.execute(data_type="catalogs")

        assert result["data_type"] == "catalogs"
        assert "centros" in result["data"]
        assert "sectores" in result["data"]
        assert "almacenes" in result["data"]
        assert len(result["data"]["centros"]) >= 1


# =============================================================================
# Tests de Manejo de Errores
# =============================================================================


class TestErrorHandling:
    """Tests para manejo de errores."""

    def test_invalid_data_type(self, data_loader):
        """Debería lanzar error para tipo de dato inválido."""
        from backend.agent.tools.base import ToolError

        with pytest.raises(ToolError, match="Tipo de dato no soportado"):
            data_loader.execute(data_type="invalid_type")

    def test_missing_database(self, tmp_path):
        """Debería manejar BD inexistente."""
        loader = DataLoader(db_path=str(tmp_path / "nonexistent.db"))

        # Debería lanzar error al intentar cargar
        from backend.agent.tools.base import ToolError
        with pytest.raises(ToolError):
            loader.execute(data_type="solicitudes")


# =============================================================================
# Tests de Metadata
# =============================================================================


class TestMetadata:
    """Tests para metadatos de la herramienta."""

    def test_get_metadata(self, data_loader):
        """Debería retornar metadatos válidos."""
        metadata = data_loader.get_metadata()

        assert metadata.name == "load_data"
        assert "data_type" in metadata.input_schema["properties"]
        assert "stock" in metadata.input_schema["properties"]["data_type"]["enum"]
        assert "consumo_historico" in metadata.input_schema["properties"]["data_type"]["enum"]
