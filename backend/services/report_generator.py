"""
Report Generator Service
Generates reports in multiple formats (xlsx, csv, pdf) from different data sources.
Reuses reporting_service.py for format generation.
"""

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class ReportGenerator:
    """
    Central report generator for scheduled reports.

    Supported report types:
    - solicitudes: Solicitudes with filters
    - stock: Stock levels from sap_data
    - presupuesto: Budget data
    - kpis: KPI metrics
    - materiales: Materials catalog
    """

    @staticmethod
    def generate(tipo: str, filtros: Optional[Dict[str, Any]] = None, formato: str = 'xlsx') -> Dict[str, Any]:
        """
        Generate a report based on type.

        Args:
            tipo: Report type (solicitudes, stock, presupuesto, kpis, materiales)
            filtros: Optional filters dict
            formato: Output format (xlsx, csv, pdf)

        Returns:
            Dict with success, contenido (bytes), filename, formato, error
        """
        filtros = filtros or {}

        try:
            if tipo == 'solicitudes':
                return ReportGenerator._generar_solicitudes(filtros, formato)
            elif tipo == 'stock':
                return ReportGenerator._generar_stock(filtros, formato)
            elif tipo == 'presupuesto':
                return ReportGenerator._generar_presupuesto(filtros, formato)
            elif tipo == 'kpis':
                return ReportGenerator._generar_kpis(filtros, formato)
            elif tipo == 'materiales':
                return ReportGenerator._generar_materiales(filtros, formato)
            else:
                return {
                    'success': False,
                    'error': f'Tipo de reporte no soportado: {tipo}'
                }

        except Exception as e:
            logger.error(f"Error generando reporte {tipo}: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def _generar_solicitudes(filtros: Dict[str, Any], formato: str) -> Dict[str, Any]:
        """
        Generate solicitudes report.

        Filtros:
            - estado: Filter by status
            - centro: Filter by centro
            - fecha_desde: Start date (YYYY-MM-DD)
            - fecha_hasta: End date (YYYY-MM-DD)
        """
        from backend.core.db import get_db_connection
        from backend.core.fsm import ESTADO_NUEVO_A_DISPLAY
        from backend.services.reporting_service import get_reporting_service

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()

                query = """
                    SELECT id, status as estado, criticidad, total_monto,
                           created_at, id_usuario, centro, sector, justificacion
                    FROM solicitud
                    WHERE 1=1
                """
                params = []

                if filtros.get('estado'):
                    query += " AND status = ?"
                    params.append(filtros['estado'])
                if filtros.get('centro'):
                    query += " AND centro = ?"
                    params.append(filtros['centro'])
                if filtros.get('fecha_desde'):
                    query += " AND created_at >= ?"
                    params.append(filtros['fecha_desde'])
                if filtros.get('fecha_hasta'):
                    query += " AND created_at <= ?"
                    params.append(filtros['fecha_hasta'])

                query += " ORDER BY created_at DESC LIMIT 1000"

                cursor.execute(query, params)
                solicitudes = [dict(row) for row in cursor.fetchall()]

                # Translate states to Spanish
                for sol in solicitudes:
                    estado_raw = sol.get("estado", "")
                    sol["estado"] = ESTADO_NUEVO_A_DISPLAY.get(estado_raw, estado_raw)

            service = get_reporting_service()
            result = service.export_solicitudes(solicitudes=solicitudes, formato=formato)

            return result

        except Exception as e:
            logger.error(f"Error generando reporte solicitudes: {e}")
            return {'success': False, 'error': str(e)}

    @staticmethod
    def _generar_stock(filtros: Dict[str, Any], formato: str) -> Dict[str, Any]:
        """
        Generate stock report from sap_data.

        Filtros:
            - centro: Filter by centro
            - material: Filter by material code (partial match)
        """
        from backend.core.db import get_db_connection
        from backend.services.reporting_service import get_reporting_service

        try:
            db_name = "sap_data"
            with get_db_connection(db_name) as conn:
                cursor = conn.cursor()

                query = """
                    SELECT
                        s.material as codigo,
                        m.descripcion,
                        s.centro,
                        s.almacen,
                        SUM(s.stock) as stock_actual,
                        s.um as unidad,
                        AVG(s.precio) as precio_unitario,
                        m.stock_de_seguridad,
                        m.punto_de_pedido,
                        m.stock_maximo
                    FROM stock s
                    LEFT JOIN materiales_bbdd m
                        ON s.material = m.codigo_material
                        AND s.centro = m.centro
                    WHERE 1=1
                """
                params = []

                if filtros.get('centro'):
                    query += " AND s.centro = ?"
                    params.append(filtros['centro'])
                if filtros.get('material'):
                    query += " AND s.material LIKE ?"
                    params.append(f"%{filtros['material']}%")

                query += """
                    GROUP BY s.material, m.descripcion, s.centro, s.almacen, s.um,
                             m.stock_de_seguridad, m.punto_de_pedido, m.stock_maximo
                    ORDER BY s.centro, s.material
                    LIMIT 5000
                """

                cursor.execute(query, params)
                stock_data = [dict(row) for row in cursor.fetchall()]

            service = get_reporting_service()
            result = service.generate_custom_report(
                titulo="Reporte de Stock",
                datos=stock_data,
                columnas=list(stock_data[0].keys()) if stock_data else [],
                formato=formato
            )

            return result

        except Exception as e:
            logger.error(f"Error generando reporte stock: {e}")
            return {'success': False, 'error': str(e)}

    @staticmethod
    def _generar_presupuesto(filtros: Dict[str, Any], formato: str) -> Dict[str, Any]:
        """
        Generate presupuesto report.

        Filtros:
            - centro: Filter by centro
            - sector: Filter by sector
        """
        from backend.core.db import get_db_connection
        from backend.services.reporting_service import get_reporting_service

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()

                query = """
                    SELECT
                        centro,
                        sector,
                        monto_usd,
                        saldo_usd,
                        version
                    FROM presupuesto
                    WHERE 1=1
                """
                params = []

                if filtros.get('centro'):
                    query += " AND centro = ?"
                    params.append(filtros['centro'])
                if filtros.get('sector'):
                    query += " AND sector = ?"
                    params.append(filtros['sector'])

                query += " ORDER BY centro, sector LIMIT 500"

                cursor.execute(query, params)
                presupuesto_data = [dict(row) for row in cursor.fetchall()]

            service = get_reporting_service()
            result = service.generate_custom_report(
                titulo="Reporte de Presupuesto",
                datos=presupuesto_data,
                columnas=list(presupuesto_data[0].keys()) if presupuesto_data else [],
                formato=formato
            )

            return result

        except Exception as e:
            logger.error(f"Error generando reporte presupuesto: {e}")
            return {'success': False, 'error': str(e)}

    @staticmethod
    def _generar_kpis(filtros: Dict[str, Any], formato: str) -> Dict[str, Any]:
        """
        Generate KPIs report.

        Filtros:
            - fecha_desde: Start date for metrics
            - fecha_hasta: End date for metrics
        """
        from backend.core.db import get_db_connection
        from backend.services.reporting_service import get_reporting_service

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()

                fecha_filtro = ""
                params = []
                if filtros.get('fecha_desde'):
                    fecha_filtro += " AND created_at >= ?"
                    params.append(filtros['fecha_desde'])
                if filtros.get('fecha_hasta'):
                    fecha_filtro += " AND created_at <= ?"
                    params.append(filtros['fecha_hasta'])

                # Total solicitudes
                cursor.execute(
                    f"SELECT COUNT(*) as total FROM solicitud WHERE 1=1 {fecha_filtro}",
                    params
                )
                total = cursor.fetchone()["total"] or 0

                # Por estado
                cursor.execute(
                    f"""
                    SELECT status, COUNT(*) as cantidad
                    FROM solicitud WHERE 1=1 {fecha_filtro}
                    GROUP BY status
                    """,
                    params
                )
                por_estado = {row["status"]: row["cantidad"] for row in cursor.fetchall()}

                # Monto total aprobado
                cursor.execute(
                    f"""
                    SELECT SUM(total_monto) as monto
                    FROM solicitud WHERE status = 'approved' {fecha_filtro}
                    """,
                    params
                )
                monto_aprobado = cursor.fetchone()["monto"] or 0

            # Build KPIs data
            kpis_data = [
                {'metrica': 'Solicitudes Totales', 'valor': total},
                {'metrica': 'Aprobadas', 'valor': por_estado.get('approved', 0)},
                {'metrica': 'Rechazadas', 'valor': por_estado.get('rejected', 0)},
                {'metrica': 'Pendientes', 'valor': por_estado.get('submitted', 0)},
                {'metrica': 'En Proceso', 'valor': por_estado.get('processing', 0)},
                {'metrica': 'Tasa Aprobacion (%)', 'valor': round(por_estado.get('approved', 0) / total * 100, 2) if total > 0 else 0},
                {'metrica': 'Monto Total Aprobado (USD)', 'valor': round(monto_aprobado, 2)},
            ]

            service = get_reporting_service()
            result = service.generate_custom_report(
                titulo="Reporte de KPIs",
                datos=kpis_data,
                columnas=['metrica', 'valor'],
                formato=formato
            )

            return result

        except Exception as e:
            logger.error(f"Error generando reporte kpis: {e}")
            return {'success': False, 'error': str(e)}

    @staticmethod
    def _generar_materiales(filtros: Dict[str, Any], formato: str) -> Dict[str, Any]:
        """
        Generate materiales catalog report.

        Filtros:
            - centro: Filter by centro
            - sector: Filter by sector
        """
        from backend.core.db import get_db_connection
        from backend.services.reporting_service import get_reporting_service

        try:
            db_name = "sap_data"
            with get_db_connection(db_name) as conn:
                cursor = conn.cursor()

                query = """
                    SELECT
                        codigo_material,
                        descripcion,
                        centro,
                        sector,
                        almacen,
                        stock_de_seguridad,
                        punto_de_pedido,
                        stock_maximo
                    FROM materiales_bbdd
                    WHERE 1=1
                """
                params = []

                if filtros.get('centro'):
                    query += " AND centro = ?"
                    params.append(filtros['centro'])
                if filtros.get('sector'):
                    query += " AND sector = ?"
                    params.append(filtros['sector'])

                query += " ORDER BY centro, codigo_material LIMIT 5000"

                cursor.execute(query, params)
                materiales_data = [dict(row) for row in cursor.fetchall()]

            service = get_reporting_service()
            result = service.generate_custom_report(
                titulo="Catalogo de Materiales",
                datos=materiales_data,
                columnas=list(materiales_data[0].keys()) if materiales_data else [],
                formato=formato
            )

            return result

        except Exception as e:
            logger.error(f"Error generando reporte materiales: {e}")
            return {'success': False, 'error': str(e)}
