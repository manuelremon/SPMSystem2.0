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
    request.args.get("incluir_alertas", "true").lower() == "true"

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
    from backend.core.db import get_db_connection
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

            # Calcular KPIs - use %s for PostgreSQL, status column (not estado)
            from backend.core.db import is_using_postgresql
            ph = "%s" if is_using_postgresql() else "?"
            fecha_filtro = ""
            params = []
            if periodo_inicio:
                fecha_filtro += f" AND created_at >= {ph}"
                params.append(periodo_inicio)
            if periodo_fin:
                fecha_filtro += f" AND created_at <= {ph}"
                params.append(periodo_fin)

            # Total solicitudes
            cursor.execute(
                f"""
                SELECT COUNT(*) as total FROM solicitud WHERE 1=1 {fecha_filtro}
            """,
                params,
            )
            total_row = cursor.fetchone()
            total = (total_row["total"] if isinstance(total_row, dict) else total_row[0]) or 0

            # Por estado (column is 'status' in solicitud table)
            cursor.execute(
                f"""
                SELECT status as estado, COUNT(*) as cantidad
                FROM solicitud WHERE 1=1 {fecha_filtro}
                GROUP BY status
            """,
                params,
            )
            por_estado = {}
            for row in cursor.fetchall():
                if isinstance(row, dict):
                    por_estado[row["estado"]] = row["cantidad"]
                else:
                    por_estado[row[0]] = row[1]

            # Monto total aprobado
            approved_params = [*params]
            cursor.execute(
                f"""
                SELECT SUM(total_monto) as monto
                FROM solicitud WHERE status = 'approved' {fecha_filtro}
            """,
                approved_params,
            )
            monto_row = cursor.fetchone()
            monto_aprobado = (monto_row["monto"] if isinstance(monto_row, dict) else monto_row[0]) or 0

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

    from backend.core.db import get_db_connection
    from backend.services.recommendation_engine import RecommendationEngine

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


# ============================================================================
# Reportes Programados - CRUD
# ============================================================================


@bp.route("/programados", methods=["GET"])
@require_auth
@rate_limit(requests=30, window_seconds=60)
def list_reportes_programados():
    """
    Lista reportes programados del usuario (o todos si es admin).

    Query params:
        - page: Página (default: 1)
        - per_page: Registros por página (default: 20)
        - tipo: Filtrar por tipo de reporte (opcional)

    Returns:
        Lista paginada de reportes programados
    """
    from backend.core.db import get_db_connection, is_using_postgresql

    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 50)
    tipo = request.args.get("tipo")
    user_id = g.user.get("id_spm")

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            conditions = []
            params = []

            # Filter by user unless admin
            if g.user.get("rol") != "admin":
                if is_using_postgresql():
                    conditions.append("creado_por = %s")
                else:
                    conditions.append("creado_por = ?")
                params.append(user_id)

            if tipo:
                if is_using_postgresql():
                    conditions.append("tipo = %s")
                else:
                    conditions.append("tipo = ?")
                params.append(tipo)

            where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

            # Get total count
            cursor.execute(f"SELECT COUNT(*) as total FROM reporte_programado {where}", params)
            total_row = cursor.fetchone()
            total = total_row["total"] if isinstance(total_row, dict) else total_row[0]

            # Get paginated results
            offset = (page - 1) * per_page
            if is_using_postgresql():
                cursor.execute(f"""
                    SELECT id, nombre, tipo, frecuencia, formato, activo,
                           ultimo_envio, proximo_envio, created_at
                    FROM reporte_programado
                    {where}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """, params + [per_page, offset])
            else:
                cursor.execute(f"""
                    SELECT id, nombre, tipo, frecuencia, formato, activo,
                           ultimo_envio, proximo_envio, created_at
                    FROM reporte_programado
                    {where}
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                """, params + [per_page, offset])

            reportes = [dict(row) for row in cursor.fetchall()]

        import math
        return jsonify({
            "ok": True,
            "data": {
                "reportes": reportes,
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": math.ceil(total / per_page) if per_page > 0 else 0,
            }
        })

    except Exception as e:
        logger.error(f"Error listando reportes programados: {e}")
        return jsonify({"ok": False, "error": {"code": "list_error", "message": str(e)}}), 500


@bp.route("/programados", methods=["POST"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def create_reporte_programado():
    """
    Crea un reporte programado.

    Body:
        {
            "nombre": "Mi Reporte Semanal",
            "tipo": "solicitudes|stock|presupuesto|kpis|materiales",
            "frecuencia": "diario|semanal|mensual|manual",
            "filtros_json": {...},
            "destinatarios_json": ["email1@example.com", "email2@example.com"],
            "formato": "xlsx|csv|pdf",
            "activo": 1
        }

    Returns:
        Reporte programado creado
    """
    import json
    from datetime import datetime, timedelta

    from backend.core.db import get_db_transaction, is_using_postgresql

    data = request.get_json() or {}
    user_id = g.user.get("id_spm")

    # Validate required fields
    nombre = data.get("nombre")
    tipo = data.get("tipo")
    frecuencia = data.get("frecuencia", "manual")
    formato = data.get("formato", "xlsx")

    if not nombre or not tipo:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "nombre y tipo son requeridos"}
        }), 400

    # Validate tipo
    tipos_validos = ["solicitudes", "stock", "presupuesto", "kpis", "materiales"]
    if tipo not in tipos_validos:
        return jsonify({
            "ok": False,
            "error": {"code": "invalid_tipo", "message": f"tipo debe ser uno de: {', '.join(tipos_validos)}"}
        }), 400

    # Validate frecuencia
    frecuencias_validas = ["diario", "semanal", "mensual", "manual"]
    if frecuencia not in frecuencias_validas:
        return jsonify({
            "ok": False,
            "error": {"code": "invalid_frecuencia", "message": f"frecuencia debe ser uno de: {', '.join(frecuencias_validas)}"}
        }), 400

    # Validate formato
    formatos_validos = ["xlsx", "csv", "pdf"]
    if formato not in formatos_validos:
        return jsonify({
            "ok": False,
            "error": {"code": "invalid_formato", "message": f"formato debe ser uno de: {', '.join(formatos_validos)}"}
        }), 400

    try:
        filtros_json = json.dumps(data.get("filtros_json", {}))
        destinatarios_json = json.dumps(data.get("destinatarios_json", []))
        activo = bool(data.get("activo", True))

        # Calculate proximo_envio based on frecuencia
        proximo_envio = None
        if frecuencia == "diario":
            proximo_envio = datetime.now() + timedelta(days=1)
        elif frecuencia == "semanal":
            proximo_envio = datetime.now() + timedelta(weeks=1)
        elif frecuencia == "mensual":
            proximo_envio = datetime.now() + timedelta(days=30)

        with get_db_transaction() as conn:
            cursor = conn.cursor()

            if is_using_postgresql():
                cursor.execute("""
                    INSERT INTO reporte_programado
                    (nombre, tipo, frecuencia, filtros_json, destinatarios_json,
                     formato, activo, creado_por, proximo_envio)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (nombre, tipo, frecuencia, filtros_json, destinatarios_json,
                      formato, activo, user_id, proximo_envio))
                reporte_id = cursor.fetchone()[0]
            else:
                cursor.execute("""
                    INSERT INTO reporte_programado
                    (nombre, tipo, frecuencia, filtros_json, destinatarios_json,
                     formato, activo, creado_por, proximo_envio)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (nombre, tipo, frecuencia, filtros_json, destinatarios_json,
                      formato, activo, user_id,
                      proximo_envio.isoformat() if proximo_envio else None))
                reporte_id = cursor.lastrowid

        return jsonify({
            "ok": True,
            "data": {
                "id": reporte_id,
                "nombre": nombre,
                "tipo": tipo,
                "frecuencia": frecuencia,
                "formato": formato,
                "activo": activo,
                "proximo_envio": proximo_envio.isoformat() if proximo_envio else None
            }
        }), 201

    except Exception as e:
        logger.error(f"Error creando reporte programado: {e}")
        return jsonify({"ok": False, "error": {"code": "create_error", "message": str(e)}}), 500


@bp.route("/programados/<int:reporte_id>", methods=["PUT"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def update_reporte_programado(reporte_id: int):
    """
    Actualiza un reporte programado.

    Body: Same as create (all fields optional)

    Returns:
        Reporte programado actualizado
    """
    import json
    from datetime import datetime, timedelta

    from backend.core.db import get_db_transaction, is_using_postgresql

    data = request.get_json() or {}
    user_id = g.user.get("id_spm")
    is_admin = g.user.get("rol") == "admin"

    try:
        # Validate ownership
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            if is_using_postgresql():
                cursor.execute("SELECT creado_por FROM reporte_programado WHERE id = %s", (reporte_id,))
            else:
                cursor.execute("SELECT creado_por FROM reporte_programado WHERE id = ?", (reporte_id,))

            row = cursor.fetchone()
            if not row:
                return jsonify({
                    "ok": False,
                    "error": {"code": "not_found", "message": "Reporte no encontrado"}
                }), 404

            creado_por = row["creado_por"] if isinstance(row, dict) else row[0]
            if creado_por != user_id and not is_admin:
                return jsonify({
                    "ok": False,
                    "error": {"code": "forbidden", "message": "No autorizado para modificar este reporte"}
                }), 403

            # Build update query
            updates = []
            params = []

            if "nombre" in data:
                updates.append("nombre = %s" if is_using_postgresql() else "nombre = ?")
                params.append(data["nombre"])
            if "tipo" in data:
                updates.append("tipo = %s" if is_using_postgresql() else "tipo = ?")
                params.append(data["tipo"])
            if "frecuencia" in data:
                frecuencia = data["frecuencia"]
                updates.append("frecuencia = %s" if is_using_postgresql() else "frecuencia = ?")
                params.append(frecuencia)

                # Recalculate proximo_envio if frecuencia changes
                proximo_envio = None
                if frecuencia == "diario":
                    proximo_envio = datetime.now() + timedelta(days=1)
                elif frecuencia == "semanal":
                    proximo_envio = datetime.now() + timedelta(weeks=1)
                elif frecuencia == "mensual":
                    proximo_envio = datetime.now() + timedelta(days=30)

                updates.append("proximo_envio = %s" if is_using_postgresql() else "proximo_envio = ?")
                params.append(proximo_envio.isoformat() if proximo_envio else None)

            if "filtros_json" in data:
                updates.append("filtros_json = %s" if is_using_postgresql() else "filtros_json = ?")
                params.append(json.dumps(data["filtros_json"]))
            if "destinatarios_json" in data:
                updates.append("destinatarios_json = %s" if is_using_postgresql() else "destinatarios_json = ?")
                params.append(json.dumps(data["destinatarios_json"]))
            if "formato" in data:
                updates.append("formato = %s" if is_using_postgresql() else "formato = ?")
                params.append(data["formato"])
            if "activo" in data:
                updates.append("activo = %s" if is_using_postgresql() else "activo = ?")
                params.append(bool(data["activo"]))

            if not updates:
                return jsonify({
                    "ok": False,
                    "error": {"code": "no_changes", "message": "No hay cambios para aplicar"}
                }), 400

            # Add updated_at
            if is_using_postgresql():
                updates.append("updated_at = NOW()")
            else:
                updates.append("updated_at = datetime('now')")

            # Execute update
            params.append(reporte_id)
            update_query = f"""
                UPDATE reporte_programado
                SET {', '.join(updates)}
                WHERE id = {'%s' if is_using_postgresql() else '?'}
            """
            cursor.execute(update_query, params)

        return jsonify({"ok": True, "data": {"id": reporte_id, "updated": True}})

    except Exception as e:
        logger.error(f"Error actualizando reporte programado: {e}")
        return jsonify({"ok": False, "error": {"code": "update_error", "message": str(e)}}), 500


@bp.route("/programados/<int:reporte_id>", methods=["DELETE"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def delete_reporte_programado(reporte_id: int):
    """
    Elimina un reporte programado.

    Returns:
        Confirmación de eliminación
    """
    from backend.core.db import get_db_transaction, is_using_postgresql

    user_id = g.user.get("id_spm")
    is_admin = g.user.get("rol") == "admin"

    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            # Validate ownership
            if is_using_postgresql():
                cursor.execute("SELECT creado_por FROM reporte_programado WHERE id = %s", (reporte_id,))
            else:
                cursor.execute("SELECT creado_por FROM reporte_programado WHERE id = ?", (reporte_id,))

            row = cursor.fetchone()
            if not row:
                return jsonify({
                    "ok": False,
                    "error": {"code": "not_found", "message": "Reporte no encontrado"}
                }), 404

            creado_por = row["creado_por"] if isinstance(row, dict) else row[0]
            if creado_por != user_id and not is_admin:
                return jsonify({
                    "ok": False,
                    "error": {"code": "forbidden", "message": "No autorizado para eliminar este reporte"}
                }), 403

            # Delete
            if is_using_postgresql():
                cursor.execute("DELETE FROM reporte_programado WHERE id = %s", (reporte_id,))
            else:
                cursor.execute("DELETE FROM reporte_programado WHERE id = ?", (reporte_id,))

        return jsonify({"ok": True, "data": {"id": reporte_id, "deleted": True}})

    except Exception as e:
        logger.error(f"Error eliminando reporte programado: {e}")
        return jsonify({"ok": False, "error": {"code": "delete_error", "message": str(e)}}), 500


@bp.route("/programados/<int:reporte_id>/ejecutar", methods=["POST"])
@require_auth
@rate_limit(requests=5, window_seconds=60)
def ejecutar_reporte_programado(reporte_id: int):
    """
    Ejecuta un reporte programado inmediatamente y retorna el archivo.

    Returns:
        Archivo descargable
    """
    import json

    from backend.core.db import get_db_connection, is_using_postgresql
    from backend.services.report_generator import ReportGenerator

    user_id = g.user.get("id_spm")
    is_admin = g.user.get("rol") == "admin"

    try:
        # Get report configuration
        with get_db_connection() as conn:
            cursor = conn.cursor()

            if is_using_postgresql():
                cursor.execute("""
                    SELECT nombre, tipo, filtros_json, formato, creado_por
                    FROM reporte_programado
                    WHERE id = %s
                """, (reporte_id,))
            else:
                cursor.execute("""
                    SELECT nombre, tipo, filtros_json, formato, creado_por
                    FROM reporte_programado
                    WHERE id = ?
                """, (reporte_id,))

            row = cursor.fetchone()
            if not row:
                return jsonify({
                    "ok": False,
                    "error": {"code": "not_found", "message": "Reporte no encontrado"}
                }), 404

            row_dict = dict(row)
            creado_por = row_dict["creado_por"]
            if creado_por != user_id and not is_admin:
                return jsonify({
                    "ok": False,
                    "error": {"code": "forbidden", "message": "No autorizado para ejecutar este reporte"}
                }), 403

            tipo = row_dict["tipo"]
            formato = row_dict["formato"]
            filtros_json = row_dict.get("filtros_json", "{}")
            filtros = json.loads(filtros_json) if filtros_json else {}

        # Generate report
        result = ReportGenerator.generate(tipo=tipo, filtros=filtros, formato=formato)

        if not result.get("success"):
            return jsonify({
                "ok": False,
                "error": {"code": "generation_error", "message": result.get("error", "Error desconocido")}
            }), 500

        return _make_download_response(result)

    except Exception as e:
        logger.error(f"Error ejecutando reporte programado: {e}")
        return jsonify({"ok": False, "error": {"code": "execution_error", "message": str(e)}}), 500


# ============================================================================
# Reportes Programados - Historial (Legacy - sin cambios)
# ============================================================================


@bp.route("/programados/historial", methods=["GET"])
@require_auth
@rate_limit(requests=30, window_seconds=60)
def listar_historial_reportes():
    """
    Lista historial de reportes programados generados.

    Query params:
        - page: Página (default: 1)
        - per_page: Registros por página (default: 20)
        - tipo: Filtrar por tipo de reporte (opcional)

    Returns:
        Lista paginada de reportes generados (tabla reporte_historial)
    """
    from backend.core.db import get_db_connection

    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 50)
    tipo = request.args.get("tipo")

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            conditions = []
            params = []
            if tipo:
                conditions.append("tipo_reporte = ?")
                params.append(tipo)

            where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

            cursor.execute(f"SELECT COUNT(*) as total FROM reporte_historial {where}", params)
            total_row = cursor.fetchone()
            total = total_row["total"] if isinstance(total_row, dict) else total_row[0]

            offset = (page - 1) * per_page
            cursor.execute(f"""
                SELECT id, tipo_reporte, frecuencia, estado, archivo_path, created_at
                FROM reporte_historial
                {where}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """, params + [per_page, offset])

            reportes = [dict(row) for row in cursor.fetchall()]

        import math
        return jsonify({
            "ok": True,
            "data": {
                "reportes": reportes,
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": math.ceil(total / per_page) if per_page > 0 else 0,
            }
        })

    except Exception as e:
        logger.error(f"Error listando historial de reportes: {e}")
        return jsonify({"ok": False, "error": {"code": "reportes_error", "message": str(e)}}), 500


@bp.route("/programados/ejecutar-manual", methods=["POST"])
@require_role("admin")
@rate_limit(requests=5, window_seconds=60)
def ejecutar_reporte_manual():
    """
    Dispara la generación de un reporte programado de forma manual (legacy endpoint).

    Body:
        {
            "tipo": "stock_health|solicitudes_resumen|kpis",
            "params": {} (opcional)
        }

    Returns:
        Confirmación de que el reporte fue encolado
    """
    data = request.get_json(silent=True) or {}
    tipo = data.get("tipo")

    tipos_validos = ["stock_health", "solicitudes_resumen", "kpis"]
    if not tipo or tipo not in tipos_validos:
        return jsonify({
            "ok": False,
            "error": {"code": "invalid_type", "message": f"Tipo debe ser uno de: {', '.join(tipos_validos)}"}
        }), 400

    try:
        from backend.core.tasks import generate_scheduled_report

        generate_scheduled_report.delay(
            report_type=tipo,
            frequency="manual",
            params=data.get("params", {}),
        )

        return jsonify({
            "ok": True,
            "data": {"message": f"Reporte '{tipo}' encolado para generación", "tipo": tipo}
        })

    except Exception as e:
        logger.error(f"Error encolando reporte programado: {e}")
        return jsonify({"ok": False, "error": {"code": "queue_error", "message": str(e)}}), 500


# ============================================================================
# Reportes Programados - Destinatarios (Email Distribution)
# ============================================================================


@bp.route("/programados/<int:reporte_id>/destinatarios", methods=["GET"])
@require_auth
@rate_limit(requests=30, window_seconds=60)
def list_destinatarios(reporte_id: int):
    """
    Lista destinatarios de un reporte programado.

    Returns:
        Lista de destinatarios con email y nombre
    """
    from backend.core.db import get_db_connection, is_using_postgresql

    user_id = g.user.get("id_spm")
    is_admin = g.user.get("rol") == "admin"

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            placeholder = "%s" if is_using_postgresql() else "?"

            # Validate ownership
            cursor.execute(f"""
                SELECT creado_por
                FROM reporte_programado
                WHERE id = {placeholder}
            """, (reporte_id,))

            row = cursor.fetchone()
            if not row:
                return jsonify({
                    "ok": False,
                    "error": {"code": "not_found", "message": "Reporte no encontrado"}
                }), 404

            creado_por = row["creado_por"] if isinstance(row, dict) else row[0]
            if creado_por != user_id and not is_admin:
                return jsonify({
                    "ok": False,
                    "error": {"code": "forbidden", "message": "No autorizado"}
                }), 403

            # Get destinatarios
            cursor.execute(f"""
                SELECT id, email, nombre, created_at
                FROM reporte_destinatario
                WHERE reporte_id = {placeholder}
                ORDER BY created_at DESC
            """, (reporte_id,))

            destinatarios = [dict(r) for r in cursor.fetchall()]

        return jsonify({
            "ok": True,
            "data": {
                "destinatarios": destinatarios,
                "count": len(destinatarios)
            }
        })

    except Exception as e:
        logger.error(f"Error listando destinatarios: {e}")
        return jsonify({"ok": False, "error": {"code": "list_error", "message": str(e)}}), 500


@bp.route("/programados/<int:reporte_id>/destinatarios", methods=["POST"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def add_destinatario(reporte_id: int):
    """
    Agrega un destinatario a un reporte programado.

    Body:
        {
            "email": "usuario@empresa.com",
            "nombre": "Usuario" (opcional)
        }

    Returns:
        Destinatario creado
    """
    import re

    from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

    user_id = g.user.get("id_spm")
    is_admin = g.user.get("rol") == "admin"
    data = request.get_json() or {}

    email = data.get("email", "").strip()
    nombre = data.get("nombre", "").strip()

    # Validate email
    if not email:
        return jsonify({
            "ok": False,
            "error": {"code": "validation_error", "message": "email es requerido"}
        }), 400

    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, email):
        return jsonify({
            "ok": False,
            "error": {"code": "invalid_email", "message": "email inválido"}
        }), 400

    try:
        # Validate ownership
        with get_db_connection() as conn:
            cursor = conn.cursor()
            placeholder = "%s" if is_using_postgresql() else "?"

            cursor.execute(f"""
                SELECT creado_por
                FROM reporte_programado
                WHERE id = {placeholder}
            """, (reporte_id,))

            row = cursor.fetchone()
            if not row:
                return jsonify({
                    "ok": False,
                    "error": {"code": "not_found", "message": "Reporte no encontrado"}
                }), 404

            creado_por = row["creado_por"] if isinstance(row, dict) else row[0]
            if creado_por != user_id and not is_admin:
                return jsonify({
                    "ok": False,
                    "error": {"code": "forbidden", "message": "No autorizado"}
                }), 403

        # Insert destinatario
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            if is_using_postgresql():
                cursor.execute("""
                    INSERT INTO reporte_destinatario (reporte_id, email, nombre)
                    VALUES (%s, %s, %s)
                    RETURNING id
                """, (reporte_id, email, nombre or None))
                destinatario_id = cursor.fetchone()[0]
            else:
                cursor.execute("""
                    INSERT INTO reporte_destinatario (reporte_id, email, nombre)
                    VALUES (?, ?, ?)
                """, (reporte_id, email, nombre or None))
                destinatario_id = cursor.lastrowid

        return jsonify({
            "ok": True,
            "data": {
                "id": destinatario_id,
                "reporte_id": reporte_id,
                "email": email,
                "nombre": nombre
            }
        }), 201

    except Exception as e:
        logger.error(f"Error agregando destinatario: {e}")
        return jsonify({"ok": False, "error": {"code": "create_error", "message": str(e)}}), 500


@bp.route("/programados/<int:reporte_id>/destinatarios/<int:dest_id>", methods=["DELETE"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def delete_destinatario(reporte_id: int, dest_id: int):
    """
    Elimina un destinatario de un reporte programado.

    Returns:
        Confirmación de eliminación
    """
    from backend.core.db import get_db_connection, get_db_transaction, is_using_postgresql

    user_id = g.user.get("id_spm")
    is_admin = g.user.get("rol") == "admin"

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            placeholder = "%s" if is_using_postgresql() else "?"

            # Validate ownership
            cursor.execute(f"""
                SELECT creado_por
                FROM reporte_programado
                WHERE id = {placeholder}
            """, (reporte_id,))

            row = cursor.fetchone()
            if not row:
                return jsonify({
                    "ok": False,
                    "error": {"code": "not_found", "message": "Reporte no encontrado"}
                }), 404

            creado_por = row["creado_por"] if isinstance(row, dict) else row[0]
            if creado_por != user_id and not is_admin:
                return jsonify({
                    "ok": False,
                    "error": {"code": "forbidden", "message": "No autorizado"}
                }), 403

        # Delete destinatario
        with get_db_transaction() as conn:
            cursor = conn.cursor()

            if is_using_postgresql():
                cursor.execute("""
                    DELETE FROM reporte_destinatario
                    WHERE id = %s AND reporte_id = %s
                """, (dest_id, reporte_id))
            else:
                cursor.execute("""
                    DELETE FROM reporte_destinatario
                    WHERE id = ? AND reporte_id = ?
                """, (dest_id, reporte_id))

            if cursor.rowcount == 0:
                return jsonify({
                    "ok": False,
                    "error": {"code": "not_found", "message": "Destinatario no encontrado"}
                }), 404

        return jsonify({
            "ok": True,
            "data": {"id": dest_id, "deleted": True}
        })

    except Exception as e:
        logger.error(f"Error eliminando destinatario: {e}")
        return jsonify({"ok": False, "error": {"code": "delete_error", "message": str(e)}}), 500


@bp.route("/programados/<int:reporte_id>/enviar", methods=["POST"])
@require_auth
@rate_limit(requests=5, window_seconds=60)
def enviar_reporte_por_email(reporte_id: int):
    """
    Envía un reporte programado por email a todos sus destinatarios.

    Returns:
        Resultado del envío (destinatarios, enviados, errores)
    """
    from backend.core.db import get_db_connection, is_using_postgresql
    from backend.services.report_generator import ReportGenerator

    user_id = g.user.get("id_spm")
    is_admin = g.user.get("rol") == "admin"

    try:
        # Validate ownership
        with get_db_connection() as conn:
            cursor = conn.cursor()
            placeholder = "%s" if is_using_postgresql() else "?"

            cursor.execute(f"""
                SELECT creado_por
                FROM reporte_programado
                WHERE id = {placeholder}
            """, (reporte_id,))

            row = cursor.fetchone()
            if not row:
                return jsonify({
                    "ok": False,
                    "error": {"code": "not_found", "message": "Reporte no encontrado"}
                }), 404

            creado_por = row["creado_por"] if isinstance(row, dict) else row[0]
            if creado_por != user_id and not is_admin:
                return jsonify({
                    "ok": False,
                    "error": {"code": "forbidden", "message": "No autorizado"}
                }), 403

        # Send report
        result = ReportGenerator.enviar_por_email(reporte_id)

        if not result.get('ok'):
            return jsonify({
                "ok": False,
                "error": {"code": "send_error", "message": result.get('error', 'Error desconocido')}
            }), 500

        return jsonify({
            "ok": True,
            "data": {
                "destinatarios_count": result.get('destinatarios_count', 0),
                "enviados_count": result.get('enviados_count', 0),
                "errores": result.get('errores', [])
            }
        })

    except Exception as e:
        logger.error(f"Error enviando reporte por email: {e}")
        return jsonify({"ok": False, "error": {"code": "send_error", "message": str(e)}}), 500
