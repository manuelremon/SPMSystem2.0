"""
Budget routes - Gestion de presupuestos y Budget Update Requests

Endpoints:
- GET  /api/budget-requests          - Listar BURs
- POST /api/budget-requests          - Crear BUR (jefe/admin)
- GET  /api/budget-requests/:id      - Detalle BUR
- POST /api/budget-requests/:id/aprobar  - Aprobar BUR
- POST /api/budget-requests/:id/rechazar - Rechazar BUR
- GET  /api/presupuesto-ledger       - Historial de movimientos
- GET  /api/presupuesto/:centro/:sector  - Info de presupuesto
"""

from flask import Blueprint, g, jsonify, request

from backend.core.budget_schemas import EstadoBUR, NivelAprobacion
from backend.core.db import get_db_connection
from backend.core.roles import is_admin, normalize_roles, require_auth
from backend.core.user_helpers import get_user_by_id
from backend.services.budget_service import BURService, PresupuestoService
from backend.services.notification_service import NotificationService


bp = Blueprint("budget", __name__, url_prefix="/api")


# Alias para compatibilidad con código existente
_get_user = get_user_by_id


def _get_approvers_for_level(nivel: str) -> list:
    """
    Obtiene los IDs de usuarios que pueden aprobar un nivel dado.
    Admin SIEMPRE recibe notificacion.
    L1: Jefe, Gerente1, Gerente2 + Admin
    L2: Gerente1, Gerente2 + Admin
    ADMIN: Admin
    """
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_spm, rol FROM usuario WHERE estado_registro = 'Activo'")
        rows = cur.fetchall()

    approvers = set()
    for row in rows:
        user_id = row["id_spm"]
        roles = [r.strip().lower() for r in (row["rol"] or "").split(",")]

        is_user_admin = any(r in ("admin", "administrador") for r in roles)
        if is_user_admin:
            approvers.add(user_id)
            continue

        can_approve = False
        if nivel == "L2":
            can_approve = any(
                r in ("gerente1", "gerente2", "aprobador_presupuestos") for r in roles
            )
        elif nivel == "L1":
            can_approve = any(
                r in ("jefe", "gerente1", "gerente2", "aprobador_presupuestos") for r in roles
            )

        if can_approve:
            approvers.add(user_id)

    return list(approvers)


def _resolve_sector_name(sector_value: str) -> str:
    """
    Resuelve el nombre del sector dado un ID o nombre.
    Si es numerico, busca en catalogo_sector.
    Si no encuentra, devuelve el valor original.
    """
    if not sector_value:
        return sector_value

    if sector_value.isdigit():
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT nombre FROM catalogo_sector WHERE id = ?", (int(sector_value),))
            row = cur.fetchone()
            if row:
                # Compatibilidad PostgreSQL (dict) y SQLite (tuple)
                if isinstance(row, dict):
                    return row.get("nombre", sector_value)
                return row[0]

    return sector_value


# ============================================================================
# Presupuesto Info
# ============================================================================


@bp.route("/presupuesto/<centro>/<sector>", methods=["GET"])
@require_auth
def get_presupuesto_info(centro, sector):
    """Obtiene informacion de presupuesto para centro/sector"""

    # Resolver sector ID a nombre si es necesario
    sector_name = _resolve_sector_name(sector)

    info = PresupuestoService.get_info(centro, sector_name)
    if not info:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "not_found",
                        "message": f"No existe presupuesto para {centro}/{sector_name}",
                    },
                }
            ),
            404,
        )

    return jsonify({"ok": True, "presupuesto": info.to_dict()}), 200


# ============================================================================
# Ledger
# ============================================================================


@bp.route("/presupuesto-ledger", methods=["GET"])
@require_auth
def get_ledger():
    """Obtiene historial de movimientos de presupuesto"""
    centro = request.args.get("centro")
    sector = request.args.get("sector")
    limit = min(request.args.get("limit", 50, type=int), 200)
    offset = request.args.get("offset", 0, type=int)

    entries = PresupuestoService.get_ledger(
        centro=centro, sector=sector, limit=limit, offset=offset
    )

    return (
        jsonify(
            {
                "ok": True,
                "entries": [e.to_dict() for e in entries],
                "limit": limit,
                "offset": offset,
            }
        ),
        200,
    )


# ============================================================================
# Budget Update Requests
# ============================================================================


@bp.route("/budget-requests", methods=["GET"])
@require_auth
def list_budget_requests():
    """Lista Budget Update Requests"""
    estado = request.args.get("estado")
    centro = request.args.get("centro")
    sector = request.args.get("sector")
    limit = min(request.args.get("limit", 50, type=int), 200)
    offset = request.args.get("offset", 0, type=int)

    burs = BURService.listar(
        estado=estado, centro=centro, sector=sector, limit=limit, offset=offset
    )

    return (
        jsonify(
            {"ok": True, "requests": [b.to_dict() for b in burs], "limit": limit, "offset": offset}
        ),
        200,
    )


@bp.route("/budget-requests", methods=["POST"])
@require_auth
def create_budget_request():
    """Crear Budget Update Request (solo jefe/admin)"""
    user_id = str(g.user.get("id_spm") or g.user.get("user_id"))
    user = _get_user(user_id)
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "user_not_found", "message": "Usuario no encontrado"},
                }
            ),
            401,
        )

    user_roles = normalize_roles(user.get("rol", ""))

    data = request.get_json(silent=True) or {}

    # Validar campos requeridos
    centro = data.get("centro", "").strip()
    sector = data.get("sector", "").strip()
    monto_usd = data.get("monto_solicitado", 0)
    justificacion = data.get("justificacion", "").strip()

    if not centro or not sector:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "missing_fields",
                        "message": "Centro y sector son requeridos",
                    },
                }
            ),
            400,
        )

    if not monto_usd or float(monto_usd) <= 0:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "invalid_amount", "message": "Monto debe ser mayor a 0"},
                }
            ),
            400,
        )

    if len(justificacion) < 10:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "justificacion_required",
                        "message": "Justificacion debe tener al menos 10 caracteres",
                    },
                }
            ),
            400,
        )

    monto_cents = int(round(float(monto_usd) * 100))

    # Verificar permiso para crear BUR
    puede, mensaje = BURService.puede_crear_bur(user_roles, monto_cents)
    if not puede:
        return jsonify({"ok": False, "error": {"code": "forbidden", "message": mensaje}}), 403

    # Crear BUR
    result = BURService.crear(
        centro=centro,
        sector=sector,
        monto_solicitado_cents=monto_cents,
        justificacion=justificacion,
        solicitante_id=user_id,
        solicitante_rol=user.get("rol", ""),
    )

    if not result["ok"]:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "create_failed",
                        "message": result.get("error", "Error al crear BUR"),
                    },
                }
            ),
            500,
        )

    # Notificar a aprobadores
    bur_data = result.get("bur", {})
    nivel = bur_data.get("nivel_aprobacion_requerido", "L1")
    monto = float(monto_usd)
    approvers = _get_approvers_for_level(nivel)

    for approver_id in approvers:
        if approver_id != user_id:  # No notificar al creador
            NotificationService.create_notification(
                destinatario_id=approver_id,
                mensaje=f"Nueva solicitud de presupuesto por ${monto:,.2f} para {centro}/{sector} requiere tu aprobacion",
                tipo="warning",
            )

    return jsonify(result), 201


@bp.route("/budget-requests/<int:bur_id>", methods=["GET"])
@require_auth
def get_budget_request(bur_id):
    """Obtiene detalle de Budget Update Request"""
    bur = BURService.get_by_id(bur_id)
    if not bur:
        return (
            jsonify({"ok": False, "error": {"code": "not_found", "message": "BUR no encontrado"}}),
            404,
        )

    return jsonify({"ok": True, "request": bur.to_dict()}), 200


@bp.route("/budget-requests/<int:bur_id>/aprobar", methods=["POST"])
@require_auth
def aprobar_budget_request(bur_id):
    """Aprobar Budget Update Request"""
    user_id = str(g.user.get("id_spm") or g.user.get("user_id"))
    user = _get_user(user_id)
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "user_not_found", "message": "Usuario no encontrado"},
                }
            ),
            401,
        )

    user_roles = normalize_roles(user.get("rol", ""))

    # Obtener BUR
    bur = BURService.get_by_id(bur_id)
    if not bur:
        return (
            jsonify({"ok": False, "error": {"code": "not_found", "message": "BUR no encontrado"}}),
            404,
        )

    # Verificar permiso para aprobar
    if not BURService.puede_aprobar_bur(user_roles, bur.nivel_aprobacion_requerido):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": f"No tiene permiso para aprobar BURs de nivel {bur.nivel_aprobacion_requerido}",
                    },
                }
            ),
            403,
        )

    data = request.get_json(silent=True) or {}
    comentario = data.get("comentario", "")

    result = BURService.aprobar(
        bur_id=bur_id,
        aprobador_id=user_id,
        aprobador_rol=user.get("rol", ""),
        comentario=comentario,
    )

    if not result["ok"]:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": result.get("code", "error"),
                        "message": result.get("error", "Error"),
                    },
                }
            ),
            400,
        )

    # Notificar al solicitante
    solicitante_id = bur.solicitante_id
    monto_usd = bur.monto_solicitado_cents / 100
    nuevo_estado = result.get("nuevo_estado", "aprobado")

    if nuevo_estado == "aprobado":
        NotificationService.create_notification(
            destinatario_id=solicitante_id,
            mensaje=f"Tu solicitud de presupuesto por ${monto_usd:,.2f} para {bur.centro}/{bur.sector} fue APROBADA",
            tipo="success",
        )
    else:
        # Aprobacion parcial (L1 o L2) - notificar que paso al siguiente nivel
        NotificationService.create_notification(
            destinatario_id=solicitante_id,
            mensaje=f"Tu solicitud de presupuesto por ${monto_usd:,.2f} avanzo al siguiente nivel de aprobacion ({nuevo_estado})",
            tipo="info",
        )

    return jsonify(result), 200


@bp.route("/budget-requests/<int:bur_id>/rechazar", methods=["POST"])
@require_auth
def rechazar_budget_request(bur_id):
    """Rechazar Budget Update Request"""
    user_id = str(g.user.get("id_spm") or g.user.get("user_id"))
    user = _get_user(user_id)
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "user_not_found", "message": "Usuario no encontrado"},
                }
            ),
            401,
        )

    user_roles = normalize_roles(user.get("rol", ""))

    # Obtener BUR
    bur = BURService.get_by_id(bur_id)
    if not bur:
        return (
            jsonify({"ok": False, "error": {"code": "not_found", "message": "BUR no encontrado"}}),
            404,
        )

    # Verificar permiso para rechazar (mismos roles que aprobar)
    if not BURService.puede_aprobar_bur(user_roles, bur.nivel_aprobacion_requerido):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": f"No tiene permiso para rechazar BURs de nivel {bur.nivel_aprobacion_requerido}",
                    },
                }
            ),
            403,
        )

    data = request.get_json(silent=True) or {}
    motivo = data.get("motivo", "").strip()

    if len(motivo) < 5:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "motivo_required",
                        "message": "Debe proporcionar un motivo de rechazo",
                    },
                }
            ),
            400,
        )

    result = BURService.rechazar(bur_id=bur_id, rechazado_por=user_id, motivo=motivo)

    if not result["ok"]:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": result.get("code", "error"),
                        "message": result.get("error", "Error"),
                    },
                }
            ),
            400,
        )

    # Notificar al solicitante sobre el rechazo
    solicitante_id = bur.solicitante_id
    monto_usd = bur.monto_solicitado_cents / 100
    NotificationService.create_notification(
        destinatario_id=solicitante_id,
        mensaje=f"Tu solicitud de presupuesto por ${monto_usd:,.2f} para {bur.centro}/{bur.sector} fue RECHAZADA. Motivo: {motivo}",
        tipo="error",
    )

    return jsonify(result), 200


@bp.route("/budget-requests/<int:bur_id>/revertir", methods=["POST"])
@require_auth
def revertir_budget_request(bur_id):
    """
    SPRINT 2.3: Revertir un BUR aprobado (solo admin).
    Resta el monto del presupuesto y marca el BUR como revertido.
    """
    user_id = str(g.user.get("id_spm") or g.user.get("user_id"))
    user = _get_user(user_id)
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "user_not_found", "message": "Usuario no encontrado"},
                }
            ),
            401,
        )

    user_roles = normalize_roles(user.get("rol", ""))

    # Solo admin puede revertir BURs
    if not any(r in user_roles for r in ["admin", "administrador", "superadmin"]):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "Solo administradores pueden revertir BURs aprobados",
                    },
                }
            ),
            403,
        )

    data = request.get_json(silent=True) or {}
    motivo = data.get("motivo", "").strip()

    if len(motivo) < 5:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "motivo_required",
                        "message": "Debe proporcionar un motivo de reversión (mínimo 5 caracteres)",
                    },
                }
            ),
            400,
        )

    result = BURService.revertir(bur_id=bur_id, revertido_por=user_id, motivo=motivo)

    if not result["ok"]:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": result.get("code", "error"),
                        "message": result.get("error", "Error"),
                    },
                }
            ),
            400,
        )

    # Obtener BUR para notificar
    bur = BURService.get_by_id(bur_id)
    if bur:
        monto_usd = bur.monto_solicitado_cents / 100
        NotificationService.create_notification(
            destinatario_id=bur.solicitante_id,
            mensaje=f"Tu solicitud de presupuesto por ${monto_usd:,.2f} para {bur.centro}/{bur.sector} fue REVERTIDA por un administrador. Motivo: {motivo}",
            tipo="warning",
        )

    return jsonify(result), 200


# ============================================================================
# Pendientes para aprobador
# ============================================================================


@bp.route("/budget-requests/pendientes", methods=["GET"])
@require_auth
def get_bur_pendientes():
    """Obtiene BURs pendientes que el usuario actual puede aprobar"""
    user_id = str(g.user.get("id_spm") or g.user.get("user_id"))
    user = _get_user(user_id)
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "user_not_found", "message": "Usuario no encontrado"},
                }
            ),
            401,
        )

    user_roles = normalize_roles(user.get("rol", ""))

    # Determinar que niveles puede aprobar
    niveles_aprobables = []
    for nivel in [NivelAprobacion.L1, NivelAprobacion.L2, NivelAprobacion.ADMIN]:
        if BURService.puede_aprobar_bur(user_roles, nivel.value):
            niveles_aprobables.append(nivel.value)

    if not niveles_aprobables:
        return jsonify({"ok": True, "requests": [], "count": 0}), 200

    from backend.core.budget_schemas import BudgetUpdateRequest

    with get_db_connection() as conn:
        cur = conn.cursor()
        # Construir placeholders dinamicos para IN clause (compatible SQLite/PostgreSQL)
        placeholders = ",".join(["?"] * len(niveles_aprobables))
        cur.execute(
            f"""SELECT * FROM presupuesto_solicitud_cambio
                WHERE estado IN ('pendiente', 'aprobado_l1', 'aprobado_l2')
                AND nivel_aprobacion_requerido IN ({placeholders})
                ORDER BY created_at DESC""",
            tuple(niveles_aprobables),
        )
        rows = cur.fetchall()
        burs = [BudgetUpdateRequest.from_row(dict(r)).to_dict() for r in rows]

    return jsonify({"ok": True, "requests": burs, "count": len(burs)}), 200
