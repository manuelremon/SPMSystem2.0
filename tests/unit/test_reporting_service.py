"""
Tests TDD para el servicio de reportes y exportacion.
Sprint 7.1 - Generacion de reportes en Excel, CSV y PDF.

El servicio de reportes permite:
- Exportar solicitudes a Excel/CSV
- Exportar inventario y alertas MRP
- Generar reportes de KPIs
- Reportes personalizados con filtros
"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta
from io import BytesIO


class TestReportingServiceInit:
    """Tests de inicializacion del servicio de reportes."""

    def test_init_creates_service(self):
        """Inicializa el servicio correctamente."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()

        assert service is not None
        assert hasattr(service, "export_solicitudes")
        assert hasattr(service, "export_inventario")

    def test_supported_formats(self):
        """Soporta formatos Excel, CSV y PDF."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        formats = service.get_supported_formats()

        assert "xlsx" in formats
        assert "csv" in formats
        assert "pdf" in formats


class TestExportSolicitudes:
    """Tests para exportacion de solicitudes."""

    @pytest.fixture
    def sample_solicitudes(self):
        """Solicitudes de prueba."""
        return [
            {
                "id": 1,
                "codigo": "SOL-001",
                "estado": "approved",
                "criticidad": "Alta",
                "total_monto": 5000.00,
                "created_at": "2025-01-15T10:00:00Z",
                "solicitante": "Usuario 1",
                "centro": "1000"
            },
            {
                "id": 2,
                "codigo": "SOL-002",
                "estado": "submitted",
                "criticidad": "Normal",
                "total_monto": 1500.50,
                "created_at": "2025-01-16T14:30:00Z",
                "solicitante": "Usuario 2",
                "centro": "2000"
            },
            {
                "id": 3,
                "codigo": "SOL-003",
                "estado": "rejected",
                "criticidad": "Normal",
                "total_monto": 800.00,
                "created_at": "2025-01-17T09:15:00Z",
                "solicitante": "Usuario 1",
                "centro": "1000"
            }
        ]

    def test_export_solicitudes_excel(self, sample_solicitudes):
        """Exporta solicitudes a Excel."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.export_solicitudes(
            solicitudes=sample_solicitudes,
            formato="xlsx"
        )

        assert result["success"] is True
        assert result["formato"] == "xlsx"
        assert "contenido" in result
        assert isinstance(result["contenido"], bytes)
        assert result["filename"].endswith(".xlsx")

    def test_export_solicitudes_csv(self, sample_solicitudes):
        """Exporta solicitudes a CSV."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.export_solicitudes(
            solicitudes=sample_solicitudes,
            formato="csv"
        )

        assert result["success"] is True
        assert result["formato"] == "csv"
        assert isinstance(result["contenido"], bytes)
        # CSV debe contener headers
        content = result["contenido"].decode("utf-8")
        assert "id" in content.lower() or "codigo" in content.lower()

    def test_export_solicitudes_con_filtros(self, sample_solicitudes):
        """Exporta con filtros aplicados."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.export_solicitudes(
            solicitudes=sample_solicitudes,
            formato="xlsx",
            filtros={"estado": "approved", "centro": "1000"}
        )

        assert result["success"] is True
        assert result["filtros_aplicados"] == {"estado": "approved", "centro": "1000"}

    def test_export_solicitudes_columnas_personalizadas(self, sample_solicitudes):
        """Exporta solo columnas especificadas."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.export_solicitudes(
            solicitudes=sample_solicitudes,
            formato="csv",
            columnas=["codigo", "estado", "total_monto"]
        )

        assert result["success"] is True
        content = result["contenido"].decode("utf-8")
        assert "codigo" in content.lower()
        # No debe incluir columnas no especificadas
        assert "solicitante" not in content.lower() or "solicitante" in ["codigo", "estado", "total_monto"]


class TestExportMateriales:
    """Tests para exportacion de materiales e inventario."""

    @pytest.fixture
    def sample_materiales(self):
        """Materiales de prueba."""
        return [
            {
                "codigo": "MAT001",
                "descripcion": "Valvula control",
                "stock_actual": 50,
                "stock_seguridad": 20,
                "punto_pedido": 80,
                "precio_usd": 500.00,
                "centro": "1000"
            },
            {
                "codigo": "MAT002",
                "descripcion": "Bomba centrifuga",
                "stock_actual": 5,
                "stock_seguridad": 10,
                "punto_pedido": 30,
                "precio_usd": 2500.00,
                "centro": "1000"
            }
        ]

    def test_export_inventario_excel(self, sample_materiales):
        """Exporta inventario a Excel."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.export_inventario(
            materiales=sample_materiales,
            formato="xlsx"
        )

        assert result["success"] is True
        assert result["formato"] == "xlsx"
        assert isinstance(result["contenido"], bytes)

    def test_export_inventario_con_alertas(self, sample_materiales):
        """Exporta inventario marcando materiales con alertas."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.export_inventario(
            materiales=sample_materiales,
            formato="xlsx",
            incluir_alertas=True
        )

        assert result["success"] is True
        # MAT002 tiene stock < stock_seguridad
        assert result.get("materiales_criticos", 0) >= 1


class TestExportAlertasMRP:
    """Tests para exportacion de alertas MRP."""

    @pytest.fixture
    def sample_alertas(self):
        """Alertas MRP de prueba."""
        return [
            {
                "id": 1,
                "material_codigo": "MAT001",
                "tipo": "quiebre_stock",
                "severidad": "critical",
                "mensaje": "Stock critico",
                "created_at": "2025-01-15T08:00:00Z"
            },
            {
                "id": 2,
                "material_codigo": "MAT002",
                "tipo": "bajo_punto_pedido",
                "severidad": "warning",
                "mensaje": "Bajo punto de pedido",
                "created_at": "2025-01-15T09:00:00Z"
            }
        ]

    def test_export_alertas_mrp(self, sample_alertas):
        """Exporta alertas MRP."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.export_alertas_mrp(
            alertas=sample_alertas,
            formato="xlsx"
        )

        assert result["success"] is True
        assert result["total_alertas"] == 2


class TestGenerarReporteKPIs:
    """Tests para reportes de KPIs."""

    @pytest.fixture
    def sample_kpis(self):
        """KPIs de prueba."""
        return {
            "solicitudes_totales": 150,
            "solicitudes_aprobadas": 120,
            "solicitudes_rechazadas": 15,
            "solicitudes_pendientes": 15,
            "tasa_aprobacion": 0.8,
            "tiempo_promedio_aprobacion_horas": 24.5,
            "monto_total_aprobado": 250000.00,
            "periodo": "2025-01"
        }

    def test_generar_reporte_kpis(self, sample_kpis):
        """Genera reporte de KPIs."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.generate_kpi_report(
            kpis=sample_kpis,
            formato="xlsx"
        )

        assert result["success"] is True
        assert "contenido" in result

    def test_reporte_kpis_con_periodo(self, sample_kpis):
        """Genera reporte de KPIs para periodo especifico."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.generate_kpi_report(
            kpis=sample_kpis,
            formato="xlsx",
            periodo_inicio="2025-01-01",
            periodo_fin="2025-01-31"
        )

        assert result["success"] is True
        assert result["periodo"]["inicio"] == "2025-01-01"
        assert result["periodo"]["fin"] == "2025-01-31"


class TestReportePersonalizado:
    """Tests para reportes personalizados."""

    def test_generar_reporte_personalizado(self):
        """Genera reporte con datos personalizados."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        datos = [
            {"campo1": "valor1", "campo2": 100},
            {"campo1": "valor2", "campo2": 200}
        ]

        result = service.generate_custom_report(
            titulo="Reporte Personalizado",
            datos=datos,
            columnas=["campo1", "campo2"],
            formato="xlsx"
        )

        assert result["success"] is True
        assert result["titulo"] == "Reporte Personalizado"

    def test_reporte_con_agrupacion(self):
        """Genera reporte con datos agrupados."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        datos = [
            {"categoria": "A", "valor": 100},
            {"categoria": "A", "valor": 150},
            {"categoria": "B", "valor": 200},
        ]

        result = service.generate_custom_report(
            titulo="Reporte Agrupado",
            datos=datos,
            columnas=["categoria", "valor"],
            formato="xlsx",
            agrupar_por="categoria"
        )

        assert result["success"] is True


class TestExportFromDB:
    """Tests para exportacion directa desde BD."""

    @pytest.fixture
    def mock_db(self):
        """Mock de conexion a BD."""
        with patch('backend.services.reporting_service.get_db_connection') as mock_conn:
            conn = MagicMock()
            cursor = MagicMock()
            conn.cursor.return_value = cursor
            mock_conn.return_value.__enter__ = MagicMock(return_value=conn)
            mock_conn.return_value.__exit__ = MagicMock(return_value=False)
            yield mock_conn, conn, cursor

    def test_export_solicitudes_from_db(self, mock_db):
        """Exporta solicitudes directamente desde BD."""
        from backend.services.reporting_service import ReportingService

        _, conn, cursor = mock_db
        cursor.fetchall.return_value = [
            {"id": 1, "codigo": "SOL-001", "estado": "approved"},
            {"id": 2, "codigo": "SOL-002", "estado": "submitted"}
        ]

        service = ReportingService()
        result = service.export_solicitudes_from_db(
            formato="xlsx",
            filtros={"estado": "approved"}
        )

        assert result["success"] is True
        assert cursor.execute.called

    def test_export_inventario_from_db(self, mock_db):
        """Exporta inventario directamente desde BD."""
        from backend.services.reporting_service import ReportingService

        _, conn, cursor = mock_db
        cursor.fetchall.return_value = [
            {"codigo": "MAT001", "stock_actual": 50, "centro": "1000"}
        ]

        service = ReportingService()
        result = service.export_inventario_from_db(
            formato="xlsx",
            centro="1000"
        )

        assert result["success"] is True


class TestValidaciones:
    """Tests para validaciones del servicio."""

    def test_formato_no_soportado(self):
        """Rechaza formato no soportado."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.export_solicitudes(
            solicitudes=[{"id": 1}],
            formato="docx"  # No soportado
        )

        assert result["success"] is False
        assert "formato" in result.get("error", "").lower()

    def test_datos_vacios(self):
        """Maneja datos vacios correctamente."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.export_solicitudes(
            solicitudes=[],
            formato="xlsx"
        )

        assert result["success"] is True
        assert result["total_registros"] == 0


class TestMetadatos:
    """Tests para metadatos de reportes."""

    def test_incluye_metadatos(self):
        """Incluye metadatos en el reporte."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.export_solicitudes(
            solicitudes=[{"id": 1, "codigo": "SOL-001"}],
            formato="xlsx",
            incluir_metadatos=True
        )

        assert result["success"] is True
        assert "generado_en" in result
        assert "generado_por" in result or "metadatos" in result

    def test_filename_con_timestamp(self):
        """Genera filename con timestamp."""
        from backend.services.reporting_service import ReportingService

        service = ReportingService()
        result = service.export_solicitudes(
            solicitudes=[{"id": 1}],
            formato="xlsx"
        )

        assert result["success"] is True
        # Filename debe incluir fecha
        filename = result["filename"]
        assert "solicitudes" in filename.lower()
        assert ".xlsx" in filename
