"""
Rutas para gestion de SLA (Service Level Agreement).

Sprint 4.5 - Endpoints de metricas y configuracion SLA.
"""

from flask import Blueprint, jsonify, request

from backend.routes.auth import _decode_token
from backend.services.sla_service import (
    actualizar_configuracion_sla,
    crear_configuracion_sla,
    eliminar_configuracion_sla,
    listar_configuraciones_sla,
    obtener_alertas_activas,
    obtener_metricas_sla,
    resolver_alerta_sla,
)


bp = Blueprint("sla", __name__, url_prefix="/api/sla")


# =============================================================================
# Metricas SLA (Dashboard)
# =============================================================================


@bp.route("/metricas", methods=["GET"])
def get_metricas_sla():
    """
    Obtener metricas de cumplimiento SLA.

    Query params:
        - periodo_dias: Dias hacia atras (default: 30)
        - por_criticidad: Incluir desglose por criticidad (default: false)

    Returns:
        - total_solicitudes: Total en el periodo
        - on_time: Cantidad a tiempo
        - warning: Cantidad con warning
        - breach: Cantidad incumplidas
        - porcentaje_cumplimiento: % de cumplimiento
        - por_criticidad: Desglose (si se solicita)
    """
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    periodo_dias = request.args.get("periodo_dias", 30, type=int)
    por_criticidad = request.args.get("por_criticidad", "false").lower() == "true"

    metricas = obtener_metricas_sla(periodo_dias=periodo_dias, por_criticidad=por_criticidad)

    return jsonify({"ok": True, "data": metricas})


@bp.route("/alertas", methods=["GET"])
def get_alertas_activas():
    """
    Obtener alertas SLA activas.

    Query params:
        - solicitud_id: Filtrar por solicitud (opcional)
        - tipo: Filtrar por tipo (warning, breach, escalated)

    Returns:
        Lista de alertas activas
    """
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    solicitud_id = request.args.get("solicitud_id", type=int)
    tipo = request.args.get("tipo")

    alertas = obtener_alertas_activas(solicitud_id=solicitud_id, tipo=tipo)

    return jsonify({"ok": True, "data": alertas, "total": len(alertas)})


@bp.route("/alertas/<int:alerta_id>/resolver", methods=["PUT", "POST"])
def resolver_alerta(alerta_id):
    """
    Resolver una alerta SLA.

    Path params:
        - alerta_id: ID de la alerta

    Returns:
        Resultado de la operacion
    """
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    user_id = str(user_payload.get("user_id", "system"))

    resultado = resolver_alerta_sla(alerta_id=alerta_id, resuelto_por=user_id)

    if resultado.get("resuelto"):
        return jsonify({"ok": True, "message": "Alerta resuelta correctamente"})
    else:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "not_found", "message": "Alerta no encontrada o ya resuelta"},
                }
            ),
            404,
        )


# =============================================================================
# CRUD Configuracion SLA (Admin)
# =============================================================================


@bp.route("/configuraciones", methods=["GET"])
def get_configuraciones():
    """
    Listar configuraciones SLA.

    Query params:
        - activo: Filtrar por estado activo (true/false)

    Returns:
        Lista de configuraciones SLA
    """
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    activo_param = request.args.get("activo")
    activo = None
    if activo_param:
        activo = activo_param.lower() == "true"

    configs = listar_configuraciones_sla(activo=activo)

    return jsonify({"ok": True, "data": configs, "total": len(configs)})


@bp.route("/configuraciones", methods=["POST"])
def create_configuracion():
    """
    Crear nueva configuracion SLA.

    Body:
        - nombre: Nombre descriptivo
        - estado_desde: Estado inicial
        - estado_hasta: Estado destino
        - tiempo_objetivo_horas: Tiempo objetivo
        - criticidad: Criticidad (opcional)
        - descripcion: Descripcion (opcional)
        - tiempo_alerta_horas: Horas para alertar (opcional)
        - notificar_al_vencer: bool (default: true)
        - escalar_al_vencer: bool (default: false)
        - escalar_a_rol: Rol de escalamiento (opcional)

    Returns:
        ID de la configuracion creada
    """
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    # Verificar rol admin
    rol = user_payload.get("rol", "")
    if rol not in ("admin", "gerente"):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "Solo administradores pueden crear configuraciones SLA",
                    },
                }
            ),
            403,
        )

    data = request.get_json(silent=True) or {}

    # Validar campos requeridos
    required = ["nombre", "estado_desde", "estado_hasta", "tiempo_objetivo_horas"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "validation_error",
                        "message": f"Campos requeridos faltantes: {', '.join(missing)}",
                    },
                }
            ),
            400,
        )

    user_id = str(user_payload.get("user_id", "system"))

    resultado = crear_configuracion_sla(
        nombre=data["nombre"],
        estado_desde=data["estado_desde"],
        estado_hasta=data["estado_hasta"],
        tiempo_objetivo_horas=int(data["tiempo_objetivo_horas"]),
        criticidad=data.get("criticidad"),
        descripcion=data.get("descripcion"),
        tiempo_alerta_horas=(
            int(data["tiempo_alerta_horas"]) if data.get("tiempo_alerta_horas") else None
        ),
        notificar_al_vencer=data.get("notificar_al_vencer", True),
        escalar_al_vencer=data.get("escalar_al_vencer", False),
        escalar_a_rol=data.get("escalar_a_rol"),
        created_by=user_id,
    )

    return (
        jsonify(
            {"ok": True, "data": resultado, "message": "Configuracion SLA creada correctamente"}
        ),
        201,
    )


@bp.route("/configuraciones/<int:config_id>", methods=["PUT"])
def update_configuracion(config_id):
    """
    Actualizar configuracion SLA existente.

    Path params:
        - config_id: ID de la configuracion

    Body:
        Campos a actualizar (todos opcionales)

    Returns:
        Resultado de la operacion
    """
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    # Verificar rol admin
    rol = user_payload.get("rol", "")
    if rol not in ("admin", "gerente"):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "Solo administradores pueden modificar configuraciones SLA",
                    },
                }
            ),
            403,
        )

    data = request.get_json(silent=True) or {}

    if not data:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "validation_error",
                        "message": "No hay campos para actualizar",
                    },
                }
            ),
            400,
        )

    resultado = actualizar_configuracion_sla(config_id, **data)

    if resultado.get("actualizado"):
        return jsonify({"ok": True, "message": "Configuracion SLA actualizada correctamente"})
    else:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "not_found",
                        "message": resultado.get("mensaje", "Configuracion no encontrada"),
                    },
                }
            ),
            404,
        )


@bp.route("/configuraciones/<int:config_id>", methods=["DELETE"])
def delete_configuracion(config_id):
    """
    Eliminar (desactivar) configuracion SLA.

    Path params:
        - config_id: ID de la configuracion

    Returns:
        Resultado de la operacion
    """
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    # Verificar rol admin
    rol = user_payload.get("rol", "")
    if rol not in ("admin", "gerente"):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "Solo administradores pueden eliminar configuraciones SLA",
                    },
                }
            ),
            403,
        )

    resultado = eliminar_configuracion_sla(config_id)

    if resultado.get("eliminado"):
        return jsonify({"ok": True, "message": "Configuracion SLA eliminada correctamente"})
    else:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "not_found", "message": "Configuracion no encontrada"},
                }
            ),
            404,
        )
