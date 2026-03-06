"""
Core AI endpoints: status, training, and request prioritization.
"""

import logging

from flask import jsonify, request

from backend.core.helpers import safe_error_response
from backend.core.rate_limit import rate_limit
from backend.core.roles import require_auth, require_role
from backend.routes.ai import bp
from backend.services.ai_service import get_ai_service

logger = logging.getLogger(__name__)


@bp.route("/status", methods=["GET"])
@require_auth
@rate_limit(requests=20, window_seconds=60)
def get_status():
    """
    Obtiene estado de los pipelines ML.

    Returns:
        Estado de cada pipeline y del servicio
    """
    try:
        service = get_ai_service()
        status = service.get_status()

        return jsonify({"ok": True, "data": status})

    except Exception as e:
        return safe_error_response(e, logger, context="ai_core.get_status")


@bp.route("/train", methods=["POST"])
@require_auth
@require_role(["admin", "planner"])
@rate_limit(requests=2, window_seconds=60)
def train_models():
    """
    Entrena modelos ML con datos historicos.

    Body (opcional):
        {
            "force": true  // Forzar reentrenamiento
        }

    Returns:
        Resultado del entrenamiento
    """
    from backend.core.db import get_db_connection, sql_now_minus

    try:
        service = get_ai_service()

        # Obtener datos de la BD
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Solicitudes historicas
            cursor.execute(
                f"""
                SELECT id, created_at, material_codigo, centro, sector,
                       criticidad, total_monto, data_json
                FROM solicitud
                WHERE created_at > {sql_now_minus("90 days")}
            """
            )
            solicitudes = [dict(row) for row in cursor.fetchall()]

            # Materiales
            cursor.execute(
                """
                SELECT codigo, descripcion, precio_usd, unidad, activo
                FROM catalogo_materiales
                WHERE activo = TRUE
            """
            )
            materiales = [dict(row) for row in cursor.fetchall()]

        # Entrenar
        result = service.train_pipelines(solicitudes, materiales)

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        return safe_error_response(e, logger, context="ai_core.train_models")


@bp.route("/solicitudes/priorizar", methods=["GET"])
@require_auth
def priorizar_solicitudes():
    """
    Prioriza solicitudes pendientes.

    Query params:
        - status: Filtrar por status (default: submitted)
        - centro: Filtrar por centro
        - limit: Limite de resultados (default: 20)

    Returns:
        Solicitudes rankeadas por prioridad
    """
    from backend.core.db import get_db_connection

    # Accept both 'status' and 'estado' for backwards compatibility with frontend
    status = request.args.get("status") or request.args.get("estado", "submitted")
    centro = request.args.get("centro")
    limit = int(request.args.get("limit", 20))

    try:
        service = get_ai_service()

        with get_db_connection() as conn:
            cursor = conn.cursor()

            query = """
                SELECT id, criticidad, fecha_necesidad, total_monto, data_json,
                       status, centro, sector, created_at
                FROM solicitud
                WHERE status = ?
            """
            params = [status]

            if centro:
                query += " AND centro = ?"
                params.append(centro)

            query += " LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            solicitudes = [dict(row) for row in cursor.fetchall()]

        result = service.priorizar_solicitudes(solicitudes)

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        return safe_error_response(e, logger, context="ai_core.priorizar_solicitudes")
