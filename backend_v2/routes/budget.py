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

import sqlite3
from pathlib import Path

from flask import Blueprint, jsonify, request

try:
    from backend_v2.core.budget_schemas import EstadoBUR, NivelAprobacion
    from backend_v2.core.config import settings
    from backend_v2.core.roles import is_admin, normalize_roles
    from backend_v2.routes.auth import _decode_token
    from backend_v2.services.budget_service import (BURService,
                                                    PresupuestoService)
    from backend_v2.services.notification_service import NotificationService
except ImportError:
    from core.budget_schemas import NivelAprobacion
    from core.config import settings
    from core.roles import normalize_roles
    from routes.auth import _decode_token
    from services.budget_service import BURService, PresupuestoService
    from services.notification_service import NotificationService


bp = Blueprint("budget", __name__, url_prefix="/api")


def _db_path() -> Path:
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _connect():
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def _get_user(user_id: str):
    """Obtiene usuario por ID"""
    conn = _connect()
    cur = conn.cursor()
    cur.execute("SELECT * FROM usuarios WHERE id_spm = ?", (str(user_id),))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def _require_auth():
    """Valida autenticacion y retorna payload o error"""
    payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(payload, tuple):
        return None, payload
    return payload, None


def _get_approvers_for_level(nivel: str) -> list:
    """
    Obtiene los IDs de usuarios que pueden aprobar un nivel dado.
    Admin SIEMPRE recibe notificacion.
    L1: Jefe, Gerente1, Gerente2 + Admin
    L2: Gerente1, Gerente2 + Admin
    ADMIN: Admin
    """
    conn = _connect()
    cur = conn.cursor()

    # Get users with matching roles (CSV format)
    cur.execute("SELECT id_spm, rol FROM usuarios WHERE estado_registro = 'Activo'")
    rows = cur.fetchall()
    conn.close()

    approvers = set()  # Usar set para evitar duplicados
    for row in rows:
        user_id = row["id_spm"]
        roles = [r.strip().lower() for r in (row["rol"] or "").split(",")]

        # Admin SIEMPRE recibe notificacion
        is_admin = any(r in ("admin", "administrador") for r in roles)
        if is_admin:
            approvers.add(user_id)
            continue

        # Otros roles segun nivel
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
    Si es numerico, busca en catalog_sectores.
    Si no encuentra, devuelve el valor original.
    """
    if not sector_value:
        return sector_value

    # Si es numerico, intentar buscar por ID
    if sector_value.isdigit():
        conn = _connect()
        cur = conn.cursor()
        cur.execute("SELECT nombre FROM catalog_sectores WHERE id = ?", (int(sector_value),))
        row = cur.fetchone()
        conn.close()
        if row:
            return row[0]

    return sector_value


# ============================================================================
# Presupuesto Info
# ============================================================================


@bp.route("/presupuesto/<centro>/<sector>", methods=["GET"])
def get_presupuesto_info(centro, sector):
    """Obtiene informacion de presupuesto para centro/sector"""
    payload, err = _require_auth()
    if err:
        return err

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
def get_ledger():
    """Obtiene historial de movimientos de presupuesto"""
    payload, err = _require_auth()
    if err:
        return err

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
def list_budget_requests():
    """Lista Budget Update Requests"""
    payload, err = _require_auth()
    if err:
        return err

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
def create_budget_request():
    """Crear Budget Update Request (solo jefe/admin)"""
    payload, err = _require_auth()
    if err:
        return err

    user_id = str(payload.get("user_id"))
    user = _get_user(user_id)
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "user_not_found", "message": "Usuario no encontrado"},
                }
            ),
            404,
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
def get_budget_request(bur_id):
    """Obtiene detalle de Budget Update Request"""
    payload, err = _require_auth()
    if err:
        return err

    bur = BURService.get_by_id(bur_id)
    if not bur:
        return (
            jsonify({"ok": False, "error": {"code": "not_found", "message": "BUR no encontrado"}}),
            404,
        )

    return jsonify({"ok": True, "request": bur.to_dict()}), 200


@bp.route("/budget-requests/<int:bur_id>/aprobar", methods=["POST"])
def aprobar_budget_request(bur_id):
    """Aprobar Budget Update Request"""
    payload, err = _require_auth()
    if err:
        return err

    user_id = str(payload.get("user_id"))
    user = _get_user(user_id)
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "user_not_found", "message": "Usuario no encontrado"},
                }
            ),
            404,
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
def rechazar_budget_request(bur_id):
    """Rechazar Budget Update Request"""
    payload, err = _require_auth()
    if err:
        return err

    user_id = str(payload.get("user_id"))
    user = _get_user(user_id)
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "user_not_found", "message": "Usuario no encontrado"},
                }
            ),
            404,
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


# ============================================================================
# Pendientes para aprobador
# ============================================================================


@bp.route("/budget-requests/pendientes", methods=["GET"])
def get_bur_pendientes():
    """Obtiene BURs pendientes que el usuario actual puede aprobar"""
    payload, err = _require_auth()
    if err:
        return err

    user_id = str(payload.get("user_id"))
    user = _get_user(user_id)
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "user_not_found", "message": "Usuario no encontrado"},
                }
            ),
            404,
        )

    user_roles = normalize_roles(user.get("rol", ""))

    # Determinar que niveles puede aprobar
    niveles_aprobables = []
    for nivel in [NivelAprobacion.L1, NivelAprobacion.L2, NivelAprobacion.ADMIN]:
        if BURService.puede_aprobar_bur(user_roles, nivel.value):
            niveles_aprobables.append(nivel.value)

    if not niveles_aprobables:
        return jsonify({"ok": True, "requests": [], "count": 0}), 200

    # Obtener BURs pendientes de los niveles que puede aprobar
    conn = _connect()
    cur = conn.cursor()

    placeholders = ",".join("?" * len(niveles_aprobables))
    cur.execute(
        f"""SELECT * FROM budget_update_requests
            WHERE estado IN ('pendiente', 'aprobado_l1', 'aprobado_l2')
            AND nivel_aprobacion_requerido IN ({placeholders})
            ORDER BY created_at DESC""",
        niveles_aprobables,
    )
    rows = cur.fetchall()
    conn.close()

    from backend_v2.core.budget_schemas import BudgetUpdateRequest

    burs = [BudgetUpdateRequest.from_row(dict(r)).to_dict() for r in rows]

    return jsonify({"ok": True, "requests": burs, "count": len(burs)}), 200
