"""
Audit Log Routes - View and export audit trail.

Endpoints:
- GET /api/audit/logs - Paginated list (admin only)
- GET /api/audit/logs/<entidad>/<id> - Entity timeline (ownership or admin)
- GET /api/audit/export - Export Excel (admin only)
- GET /api/audit/stats - Summary stats (admin only)
"""

import logging

from flask import Blueprint, Response, jsonify, request

from backend.core.roles import require_admin, require_auth

logger = logging.getLogger(__name__)

bp = Blueprint("audit", __name__, url_prefix="/api/audit")


@bp.route("/logs", methods=["GET"])
@require_auth
@require_admin
def get_audit_logs():
    """Lista paginada de audit log (admin only)."""
    from backend.services.audit_query_service import buscar_auditoria

    filtros = {
        "page": request.args.get("page", 1, type=int),
        "per_page": request.args.get("per_page", 50, type=int),
        "actor_id": request.args.get("actor_id", type=int),
        "accion": request.args.get("accion"),
        "entidad": request.args.get("entidad"),
        "entidad_id": request.args.get("entidad_id"),
        "fecha_desde": request.args.get("fecha_desde"),
        "fecha_hasta": request.args.get("fecha_hasta"),
        "search": request.args.get("search"),
    }

    result = buscar_auditoria(filtros)
    return jsonify({"ok": True, **result})


@bp.route("/logs/<entidad>/<entidad_id>", methods=["GET"])
@require_auth
def get_entity_timeline(entidad, entidad_id):
    """Timeline de cambios de una entidad."""
    from backend.services.audit_query_service import obtener_timeline_entidad

    timeline = obtener_timeline_entidad(entidad, entidad_id)
    return jsonify({"ok": True, "timeline": timeline})


@bp.route("/export", methods=["GET"])
@require_auth
@require_admin
def export_audit_logs():
    """Exportar audit log a Excel (admin only)."""
    from backend.services.audit_query_service import exportar_auditoria_excel

    filtros = {
        "actor_id": request.args.get("actor_id", type=int),
        "accion": request.args.get("accion"),
        "entidad": request.args.get("entidad"),
        "fecha_desde": request.args.get("fecha_desde"),
        "fecha_hasta": request.args.get("fecha_hasta"),
        "search": request.args.get("search"),
    }

    data = exportar_auditoria_excel(filtros)
    if data is None:
        return jsonify({"ok": False, "error": "Error al exportar auditoria"}), 500

    return Response(
        data,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=audit_log.xlsx"},
    )


@bp.route("/stats", methods=["GET"])
@require_auth
@require_admin
def get_audit_stats():
    """Resumen de estadisticas del audit log (admin only)."""
    from backend.services.audit_query_service import obtener_stats_auditoria

    stats = obtener_stats_auditoria()
    return jsonify({"ok": True, **stats})
