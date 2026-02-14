"""
Endpoints API para exportacion de reportes.
Sprint 7.3 - Exportar datos a Excel, CSV y PDF.

Endpoints:
- GET  /api/export/solicitudes       - Exportar solicitudes
- GET  /api/export/inventario        - Exportar inventario
- GET  /api/export/alertas-mrp       - Exportar alertas MRP
- GET  /api/export/kpis              - Exportar KPIs
- GET  /api/export/usuarios          - Exportar usuarios (admin solo)
- POST /api/export/custom            - Reporte personalizado
- GET  /api/export/formatos          - Lista formatos disponibles
"""

import logging

from flask import Blueprint, Response, g, jsonify, request

from backend.core.rate_limit import rate_limit
from backend.core.roles import require_auth, require_role
from backend.services.reporting_service import get_reporting_service


logger = logging.getLogger(__name__)

bp = Blueprint("export", __name__, url_prefix="/api/export")


def _get_content_type(formato: str) -> str:
    """Retorna content type segun formato."""
    content_types = {
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "csv": "text/csv; charset=utf-8",
        "pdf": "application/pdf",
    }
    return content_types.get(formato, "application/octet-stream")


def _make_download_response(result: dict) -> Response:
    """Crea respuesta de descarga desde resultado del servicio."""
    if not result.get("success"):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "export_error",
                        "message": result.get("error", "Error desconocido"),
                    },
                }
            ),
            400,
        )

    contenido = result["contenido"]
    filename = result["filename"]
    formato = result["formato"]

    response = Response(
        contenido,
        mimetype=_get_content_type(formato),
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(contenido)),
        },
    )
    return response


@bp.route("/solicitudes", methods=["GET"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def export_solicitudes():
    """
    Exporta solicitudes.

    Query params:
        - formato: xlsx, csv, pdf (default: xlsx)
        - estado: Filtrar por estado
        - centro: Filtrar por centro
        - fecha_desde: Fecha inicio (YYYY-MM-DD)
        - fecha_hasta: Fecha fin (YYYY-MM-DD)
        - columnas: Columnas a incluir (separadas por coma)

    Returns:
        Archivo descargable
    """
    formato = request.args.get("formato", "xlsx")
    filtros = {}

    if request.args.get("estado"):
        filtros["estado"] = request.args.get("estado")
    if request.args.get("centro"):
        filtros["centro"] = request.args.get("centro")
    if request.args.get("fecha_desde"):
        filtros["fecha_desde"] = request.args.get("fecha_desde")
    if request.args.get("fecha_hasta"):
        filtros["fecha_hasta"] = request.args.get("fecha_hasta")

    try:
        service = get_reporting_service()
        result = service.export_solicitudes_from_db(
            formato=formato, filtros=filtros if filtros else None
        )

        return _make_download_response(result)

    except Exception as e:
        logger.error(f"Error exportando solicitudes: {e}")
        return jsonify({"ok": False, "error": {"code": "export_error", "message": str(e)}}), 500


@bp.route("/inventario", methods=["GET"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def export_inventario():
    """
    Exporta inventario de materiales.

    Query params:
        - formato: xlsx, csv, pdf (default: xlsx)
        - centro: Filtrar por centro
        - incluir_alertas: true/false (marcar materiales criticos)

    Returns:
        Archivo descargable
    """
    formato = request.args.get("formato", "xlsx")
    centro = request.args.get("centro")
    incluir_alertas = request.args.get("incluir_alertas", "true").lower() == "true"

    try:
        service = get_reporting_service()
        result = service.export_inventario_from_db(formato=formato, centro=centro)

        return _make_download_response(result)

    except Exception as e:
        logger.error(f"Error exportando inventario: {e}")
        return jsonify({"ok": False, "error": {"code": "export_error", "message": str(e)}}), 500


@bp.route("/alertas-mrp", methods=["GET"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def export_alertas_mrp():
    """
    Exporta alertas MRP usando calculo dinamico (mismo que tablero).

    Query params:
        - formato: xlsx, csv, pdf (default: xlsx)
        - centro: Filtrar por centro
        - severidad: Filtrar por severidad (CRITICAL, HIGH, MEDIUM, LOW, INFO)
        - estado: Filtrar por estado de material (quiebre, bajo punto, etc.)

    Returns:
        Archivo descargable
    """
    from backend.core.db import get_db_connection, is_using_postgresql
    from backend.routes.mrp import calcular_estado_material

    formato = request.args.get("formato", "xlsx")
    centro = request.args.get("centro")
    severidad = request.args.get("severidad")
    estado = request.args.get("estado")

    try:
        db_name = "sap_data"
        with get_db_connection(db_name) as conn:
            cursor = conn.cursor()

            query = """
                SELECT
                    m.codigo_material as codigo,
                    m.descripcion,
                    m.centro,
                    m.almacen,
                    m.sector,
                    m.stock_de_seguridad,
                    m.punto_de_pedido,
                    m.stock_maximo,
                    COALESCE(m.Demanda_estimada_anual, 0) as demanda_estimada_anual,
                    COALESCE(m.consumo_promedio_anual, 0) as consumo_promedio_anual,
                    COALESCE(s.stock_actual, 0) as stock_actual,
                    COALESCE(s.unidad, 'UNI') as unidad,
                    COALESCE(s.precio_unitario, 0) as precio_unitario
                FROM materiales_bbdd m
                LEFT JOIN (
                    SELECT
                        material, centro, almacen,
                        SUM(stock) as stock_actual,
                        um as unidad,
                        AVG(precio) as precio_unitario
                    FROM stock
                    GROUP BY material, centro, almacen, um
                ) s ON m.codigo_material = s.material
                    AND m.centro = s.centro
                    AND m.almacen = s.almacen
                WHERE 1=1
            """
            params = []

            if centro:
                query += " AND m.centro = ?"
                params.append(centro)

            query += " ORDER BY m.codigo_material"
            cursor.execute(query, params)
            materiales = [dict(row) for row in cursor.fetchall()]

        alertas = []
        for mat in materiales:
            stock_actual = float(mat["stock_actual"] or 0)
            stock_seguridad = float(mat["stock_de_seguridad"] or 0)
            punto_pedido = float(mat["punto_de_pedido"] or 0)
            stock_maximo = float(mat["stock_maximo"] or 0)
            consumo_anual = float(mat["consumo_promedio_anual"] or 0)

            estado_info = calcular_estado_material(
                stock_actual=stock_actual,
                stock_seguridad=stock_seguridad,
                punto_pedido=punto_pedido,
                stock_maximo=stock_maximo,
                consumo_promedio=consumo_anual / 12 if consumo_anual > 0 else 0,
                pedidos_en_curso=0,
            )

            if severidad and estado_info["severidad"].lower() != severidad.lower():
                continue
            if estado and estado.lower() not in estado_info["estado"].lower():
                continue

            alertas.append({
                "codigo": mat["codigo"],
                "descripcion": mat["descripcion"] or mat["codigo"],
                "centro": mat["centro"],
                "almacen": mat["almacen"] or "",
                "sector": mat["sector"] or "",
                "unidad": mat["unidad"] or "UNI",
                "stock_actual": round(stock_actual, 0),
                "stock_seguridad": round(stock_seguridad, 0),
                "punto_pedido": round(punto_pedido, 0),
                "stock_maximo": round(stock_maximo, 0),
                "consumo_promedio_anual": round(consumo_anual, 2),
                "estado": estado_info["estado"],
                "severidad": estado_info["severidad"],
                "sugerencia": estado_info["sugerencia"],
            })

        service = get_reporting_service()
        result = service.export_alertas_mrp(alertas=alertas, formato=formato)

        return _make_download_response(result)

    except Exception as e:
        logger.error(f"Error exportando alertas MRP: {e}")
        return jsonify({"ok": False, "error": {"code": "export_error", "message": str(e)}}), 500


@bp.route("/kpis", methods=["GET"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def export_kpis():
    """
    Exporta reporte de KPIs.

    Query params:
        - formato: xlsx, csv, pdf (default: xlsx)
        - periodo_inicio: Fecha inicio (YYYY-MM-DD)
        - periodo_fin: Fecha fin (YYYY-MM-DD)

    Returns:
        Archivo descargable
    """
    from backend.core.db import get_db_connection

    formato = request.args.get("formato", "xlsx")
    periodo_inicio = request.args.get("periodo_inicio")
    periodo_fin = request.args.get("periodo_fin")

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Calcular KPIs
            fecha_filtro = ""
            params = []
            if periodo_inicio:
                fecha_filtro += " AND created_at >= ?"
                params.append(periodo_inicio)
            if periodo_fin:
                fecha_filtro += " AND created_at <= ?"
                params.append(periodo_fin)

            # Total solicitudes
            cursor.execute(
                f"""
                SELECT COUNT(*) as total FROM solicitud WHERE 1=1 {fecha_filtro}
            """,
                params,
            )
            total = cursor.fetchone()["total"] or 0

            # Por estado
            cursor.execute(
                f"""
                SELECT estado, COUNT(*) as cantidad
                FROM solicitud WHERE 1=1 {fecha_filtro}
                GROUP BY estado
            """,
                params,
            )
            por_estado = {row["estado"]: row["cantidad"] for row in cursor.fetchall()}

            # Monto total aprobado
            cursor.execute(
                f"""
                SELECT SUM(total_monto) as monto
                FROM solicitud WHERE estado = 'approved' {fecha_filtro}
            """,
                params,
            )
            monto_aprobado = cursor.fetchone()["monto"] or 0

        kpis = {
            "solicitudes_totales": total,
            "aprobadas": por_estado.get("approved", 0),
            "rechazadas": por_estado.get("rejected", 0),
            "pendientes": por_estado.get("submitted", 0),
            "en_proceso": por_estado.get("processing", 0),
            "tasa_aprobacion": (
                round(por_estado.get("approved", 0) / total, 2) if total > 0 else 0
            ),
            "monto_total_aprobado_usd": monto_aprobado,
        }

        service = get_reporting_service()
        result = service.generate_kpi_report(
            kpis=kpis, formato=formato, periodo_inicio=periodo_inicio, periodo_fin=periodo_fin
        )

        return _make_download_response(result)

    except Exception as e:
        logger.error(f"Error exportando KPIs: {e}")
        return jsonify({"ok": False, "error": {"code": "export_error", "message": str(e)}}), 500


@bp.route("/usuarios", methods=["GET"])
@require_auth
@require_role(["admin"])
@rate_limit(requests=10, window_seconds=60)
def export_usuarios():
    """
    Exporta usuarios.

    Query params:
        - formato: xlsx, csv, pdf (default: xlsx)
        - estado: Filtrar por estado (Activo, Inactivo, Suspendido)
        - rol: Filtrar por rol (búsqueda parcial)

    Returns:
        Archivo descargable

    Nota: Solo accesible para usuarios con rol admin
    """
    formato = request.args.get("formato", "xlsx").lower()
    filtros = {}

    if request.args.get("estado"):
        filtros["estado"] = request.args.get("estado")
    if request.args.get("rol"):
        filtros["rol"] = request.args.get("rol")

    try:
        # Validar formato
        if formato not in ["xlsx", "csv", "pdf"]:
            return jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_format",
                        "message": f"Formato no válido: {formato}. Use: xlsx, csv, pdf",
                    },
                }
            ), 400

        service = get_reporting_service()
        result = service.export_usuarios_from_db(
            formato=formato, filtros=filtros if filtros else None
        )

        if not result.get("success"):
            logger.error(f"Error en export_usuarios_from_db: {result.get('error')}")

        return _make_download_response(result)

    except Exception as e:
        logger.error(f"Error exportando usuarios: {e}", exc_info=True)
        return jsonify(
            {
                "ok": False,
                "error": {
                    "code": "export_error",
                    "message": f"Error al exportar usuarios: {str(e)}",
                },
            }
        ), 500


@bp.route("/custom", methods=["POST"])
@require_auth
@require_role(["admin", "planner"])
@rate_limit(requests=10, window_seconds=60)
def export_custom():
    """
    Genera reporte personalizado.

    Body:
        {
            "titulo": "Mi Reporte",
            "query": "SELECT * FROM tabla WHERE ...",  // Solo admin
            "datos": [...],  // O datos directos
            "columnas": ["col1", "col2"],
            "formato": "xlsx"
        }

    Returns:
        Archivo descargable
    """
    data = request.get_json() or {}

    titulo = data.get("titulo", "Reporte Personalizado")
    formato = data.get("formato", "xlsx")
    columnas = data.get("columnas", [])
    datos = data.get("datos", [])

    # Si hay query y es admin, ejecutar
    if "query" in data and g.user.get("rol") == "admin":
        from backend.core.db import get_db_connection

        query = data["query"]
        # Solo SELECT permitido
        if not query.strip().upper().startswith("SELECT"):
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "forbidden",
                            "message": "Solo consultas SELECT permitidas",
                        },
                    }
                ),
                403,
            )

        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query)
                datos = [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            return jsonify({"ok": False, "error": {"code": "query_error", "message": str(e)}}), 400

    if not datos:
        return (
            jsonify(
                {"ok": False, "error": {"code": "no_data", "message": "No hay datos para exportar"}}
            ),
            400,
        )

    # Determinar columnas si no se especifican
    if not columnas and datos:
        columnas = list(datos[0].keys())

    try:
        service = get_reporting_service()
        result = service.generate_custom_report(
            titulo=titulo, datos=datos, columnas=columnas, formato=formato
        )

        return _make_download_response(result)

    except Exception as e:
        logger.error(f"Error generando reporte custom: {e}")
        return jsonify({"ok": False, "error": {"code": "export_error", "message": str(e)}}), 500


@bp.route("/recomendaciones", methods=["GET"])
@require_auth
@require_role(["admin", "planner"])
@rate_limit(requests=10, window_seconds=60)
def export_recomendaciones():
    """
    Exporta recomendaciones de compra a Excel.

    Query params:
        - formato: xlsx, csv (default: xlsx)
        - centro: Centro de distribución (requerido)
        - limit: Máximo de recomendaciones (default: 50)

    Returns:
        Archivo descargable
    """
    from backend.core.db import get_db_connection, is_using_postgresql
    from backend.services.recommendation_engine import RecommendationEngine
    import numpy as np

    formato = request.args.get("formato", "xlsx")
    centro = request.args.get("centro")
    limit = min(int(request.args.get("limit", 50)), 100)

    if not centro:
        return jsonify({
            "ok": False,
            "error": {"code": "bad_request", "message": "centro es requerido"}
        }), 400

    try:
        engine = RecommendationEngine()
        db_name = "sap_data"

        with get_db_connection(db_name) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT
                    m.codigo_material as codigo,
                    m.descripcion,
                    COALESCE(m.consumo_promedio_anual, 0) as consumo_anual,
                    COALESCE(m.punto_de_pedido, 0) as punto_pedido,
                    COALESCE(s.stock_actual, 0) as stock_actual,
                    COALESCE(s.precio_unitario, 0) as precio_unitario
                FROM materiales_bbdd m
                LEFT JOIN (
                    SELECT material, centro,
                        SUM(stock) as stock_actual,
                        AVG(precio) as precio_unitario
                    FROM stock
                    GROUP BY material, centro
                ) s ON m.codigo_material = s.material AND m.centro = s.centro
                WHERE m.centro = ?
                ORDER BY m.consumo_promedio_anual DESC
                LIMIT ?
            """, (centro, limit * 3))
            materiales_raw = [dict(row) for row in cursor.fetchall()]

        materiales_para_engine = []
        for mat in materiales_raw:
            consumo_anual = float(mat.get("consumo_anual") or 0)
            demanda_diaria = consumo_anual / 365 if consumo_anual > 0 else 0.1
            stock_actual = float(mat.get("stock_actual") or 0)
            punto_pedido = float(mat.get("punto_pedido") or 0)

            if consumo_anual > 0 or stock_actual > 0:
                materiales_para_engine.append({
                    'codigo': mat['codigo'],
                    'descripcion': mat.get('descripcion', ''),
                    'stock_actual': stock_actual,
                    'rop': punto_pedido if punto_pedido > 0 else demanda_diaria * 14,
                    'consumo_historico': [demanda_diaria] * 30,
                    'demanda_promedio': demanda_diaria,
                    'demanda_std': demanda_diaria * 0.3,
                    'abc_clase': 'A' if consumo_anual > 10000 else 'B' if consumo_anual > 1000 else 'C',
                    'lead_time_dias': 14,
                    'precio_unitario': float(mat.get("precio_unitario") or 0),
                    'cantidad_eoq': 0
                })

        recomendaciones = engine.generar_top_recomendaciones(materiales_para_engine, limit=limit)

        # Formatear para export
        datos_export = []
        for rec in recomendaciones:
            datos_export.append({
                "Material": rec['material'],
                "Score": round(rec['score_total'], 2),
                "Urgencia": rec['urgencia_texto'],
                "Clase ABC": rec['abc_clase'],
                "Stock Actual": rec['stock_actual'],
                "ROP": rec['rop'],
                "Días Cobertura": round(rec['dias_cobertura'], 1),
                "Cantidad Sugerida": rec['cantidad_sugerida'],
                "Precio Estimado USD": round(rec['precio_estimado'], 2),
                "Justificación": "; ".join(rec['justificacion']),
            })

        service = get_reporting_service()
        result = service.generate_custom_report(
            titulo=f"Recomendaciones de Compra - Centro {centro}",
            datos=datos_export,
            columnas=list(datos_export[0].keys()) if datos_export else [],
            formato=formato
        )

        return _make_download_response(result)

    except Exception as e:
        logger.error(f"Error exportando recomendaciones: {e}")
        return jsonify({"ok": False, "error": {"code": "export_error", "message": str(e)}}), 500


@bp.route("/formatos", methods=["GET"])
@rate_limit(requests=30, window_seconds=60)
def get_formatos():
    """
    Lista formatos de exportacion soportados.

    Returns:
        Lista de formatos disponibles
    """
    service = get_reporting_service()
    return jsonify(
        {"ok": True, "data": {"formatos": service.get_supported_formats(), "default": "xlsx"}}
    )
