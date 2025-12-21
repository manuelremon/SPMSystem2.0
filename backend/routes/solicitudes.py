"""
Solicitudes routes - SQLite-backed (demo)

Refactorizado para usar FSM centralizado (Sprint 1.6)
"""

import json
import logging
import uuid
from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

logger = logging.getLogger(__name__)

try:
    from backend.core.db import get_db_connection, get_db_transaction
    from backend.core.fsm import (
        EstadoSolicitud,
        SolicitudNoEncontradaError,
        TransicionInvalidaError,
        cambiar_estado,
        estado_para_display,
        normalizar_estado,
        validar_transicion,
    )
    from backend.core.item_schemas import (
        ItemValidationError,
        SolicitudValidationError,
        validar_items,
        validar_solicitud_create,
    )
    from backend.core.rate_limit import rate_limit
    from backend.core.roles import has_any_role, is_admin
    from backend.routes.auth import _decode_token
    from backend.services.approval_service import (
        obtener_aprobador_por_monto,
        obtener_regla_aprobacion,
        puede_aprobar,
    )
    from backend.services.audit_service import (
        auditar_aprobacion,
        auditar_creacion_solicitud,
        auditar_rechazo,
    )
    from backend.services.sla_service import (
        actualizar_sla_solicitud,
        calcular_fecha_limite,
        obtener_configuracion_sla,
        resolver_alertas_solicitud,
    )
except ImportError:
    from core.db import get_db_connection, get_db_transaction
    from core.fsm import (
        EstadoSolicitud,
        SolicitudNoEncontradaError,
        TransicionInvalidaError,
        cambiar_estado,
        estado_para_display,
        normalizar_estado,
        validar_transicion,
    )
    from core.item_schemas import (
        validar_items,
    )
    from core.rate_limit import rate_limit
    from core.roles import has_any_role, is_admin
    from services.approval_service import (
        obtener_aprobador_por_monto,
        puede_aprobar,
    )
    from services.audit_service import (
        auditar_aprobacion,
        auditar_creacion_solicitud,
        auditar_rechazo,
    )
    from services.sla_service import (
        actualizar_sla_solicitud,
        calcular_fecha_limite,
        obtener_configuracion_sla,
        resolver_alertas_solicitud,
    )

    from routes.auth import _decode_token


def _row_to_dict(row, cursor):
    """Convierte una fila de BD a diccionario"""
    if row is None:
        return None
    # PostgreSQL wrapper ya retorna dicts, SQLite retorna Row
    if isinstance(row, dict):
        return row
    return dict(row)


bp = Blueprint("solicitudes", __name__, url_prefix="/api/solicitudes")


def _get_uploads_dir(solicitud_id: int) -> Path:
    """Obtiene el directorio de uploads para una solicitud específica"""
    base_dir = Path(__file__).parent.parent.parent / "uploads" / "solicitudes" / str(solicitud_id)
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir


def _save_uploaded_file(file, solicitud_id: int) -> dict:
    """Guarda un archivo subido y retorna su metadata"""
    if not file or not file.filename:
        return None

    # Generar nombre único para evitar colisiones
    original_filename = secure_filename(file.filename)
    file_ext = Path(original_filename).suffix
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"

    # Guardar archivo
    upload_dir = _get_uploads_dir(solicitud_id)
    file_path = upload_dir / unique_filename
    file.save(str(file_path))

    # Obtener tamaño
    file_size = file_path.stat().st_size

    return {
        "id": uuid.uuid4().hex[:8],
        "nombre": original_filename,
        "nombre_almacenado": unique_filename,
        "ruta": str(file_path.relative_to(Path(__file__).parent.parent.parent)),
        "mime_type": file.content_type or "application/octet-stream",
        "tamanio": file_size,
        "created_at": datetime.utcnow().isoformat(),
    }




@bp.route("", methods=["GET"])
def list_solicitudes():
    """Listar solicitudes (permite filtrar por usuario y estado)"""
    # SEGURIDAD: Verificar autenticacion
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    # Validación de paginación con límites seguros
    page = max(1, request.args.get("page", 1, type=int))
    page_size = min(max(1, request.args.get("page_size", 10, type=int)), 100)  # Máximo 100
    user_id = request.args.get("user_id")
    estado = request.args.get("estado")

    # DEBUG LOG
    import logging

    logging.getLogger(__name__).info(
        f"[DEBUG] list_solicitudes: estado={estado}, aprobador_id={request.args.get('aprobador_id')}, all_args={dict(request.args)}"
    )

    where = []
    where_count = []
    params = []
    if user_id:
        where.append("s.id_usuario = ?")
        where_count.append("id_usuario = ?")
        params.append(str(user_id))
    if estado:
        # Normalizar estado legacy (ej: "Enviada" -> "submitted")
        estado_normalizado = normalizar_estado(estado)
        where.append("LOWER(s.status) = LOWER(?)")
        where_count.append("LOWER(status) = LOWER(?)")
        params.append(estado_normalizado)

    # Filtrar por aprobador_id si se pasa el parametro
    aprobador_id = request.args.get("aprobador_id")
    if aprobador_id:
        where.append("s.aprobador_id = ?")
        where_count.append("aprobador_id = ?")
        params.append(str(aprobador_id))

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    where_sql_count = f"WHERE {' AND '.join(where_count)}" if where_count else ""

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) AS count FROM solicitudes {where_sql_count}", params)
        row = cur.fetchone()
        total = row["count"] if isinstance(row, dict) else row[0]

        offset = (page - 1) * page_size
        cur.execute(
            f"""
            SELECT
                s.id, s.id_usuario, s.centro, s.sector, s.justificacion, s.centro_costos, s.almacen_virtual, s.criticidad,
                s.fecha_necesidad, s.status, s.total_monto, s.aprobador_id, s.planner_id, s.created_at, s.updated_at, s.data_json,
                u.nombre AS solicitante_nombre, u.apellido AS solicitante_apellido,
                a.nombre AS aprobador_nombre, a.apellido AS aprobador_apellido,
                p.nombre AS planner_nombre, p.apellido AS planner_apellido
            FROM solicitudes s
            LEFT JOIN usuarios u ON s.id_usuario = u.id_spm
            LEFT JOIN usuarios a ON s.aprobador_id = a.id_spm
            LEFT JOIN usuarios p ON s.planner_id = p.id_spm
            {where_sql}
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
            """,
            params + [page_size, offset],
        )
        rows = cur.fetchall()
    solicitudes_list = []
    for r in rows:
        # PostgreSQL wrapper ya retorna dicts, SQLite retorna Row
        d = r if isinstance(r, dict) else dict(r)
        try:
            extra = json.loads(d.get("data_json") or "{}")
        except Exception:
            extra = {}
        d["items"] = extra.get("items", [])
        solicitudes_list.append(d)

    return (
        jsonify(
            {
                "ok": True,
                "total": total,
                "page": page,
                "page_size": page_size,
                "solicitudes": solicitudes_list,
            }
        ),
        200,
    )


@bp.route("/<int:solicitud_id>", methods=["GET"])
def get_solicitud(solicitud_id):
    """Obtener una solicitud específica"""
    # SEGURIDAD: Verificar autenticacion
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    user_id = user_payload.get("user_id")
    user_rol = user_payload.get("rol", "")

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM solicitudes WHERE id=%s", (solicitud_id,))
        row = cur.fetchone()
        if not row:
            return (
                jsonify(
                    {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
                ),
                404,
            )
        d = _row_to_dict(row, cur)

    # SEGURIDAD: Verificar ownership - solo el dueño, admin, aprobadores o planificadores pueden ver
    solicitud_owner = str(d.get("id_usuario", ""))
    roles_permitidos = [
        "aprobador",
        "aprobador_solicitudes",
        "aprobador_presupuestos",
        "approver",
        "coordinador",
        "coordinator",
        "planificador",
        "planner",
        "jefe",
        "gerente1",
        "gerente2",
    ]
    if (
        str(user_id) != solicitud_owner
        and not is_admin(user_rol)
        and not has_any_role(user_rol, roles_permitidos)
    ):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "No tiene permiso para ver esta solicitud",
                    },
                }
            ),
            403,
        )

    try:
        extra = json.loads(d.get("data_json") or "{}")
    except json.JSONDecodeError:
        extra = {}
    d["items"] = extra.get("items", [])
    return jsonify({"ok": True, "solicitud": d}), 200


@bp.route("", methods=["POST"])
# Rate limit removido temporalmente - usar rate limiting global
def create_solicitud():
    """Crear una nueva solicitud (soporta JSON o multipart/form-data con archivos)"""
    # SEGURIDAD: Requiere autenticación válida
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        # Token inválido o ausente - retornar error de autenticación
        return user_payload

    user_id = user_payload.get("user_id")
    if not user_id:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "unauthorized",
                        "message": "Usuario no identificado en token",
                    },
                }
            ),
            401,
        )

    # Soportar tanto JSON como multipart/form-data
    if request.content_type and "multipart/form-data" in request.content_type:
        # Multipart: obtener campos del formulario
        data = {
            "centro": request.form.get("centro") or request.form.get("centro_id") or "",
            "sector": request.form.get("sector") or request.form.get("sector_id") or "",
            "justificacion": request.form.get("justificacion") or "",
            "centro_costos": request.form.get("centro_costos") or "",
            "almacen_virtual": request.form.get("almacen_virtual")
            or request.form.get("almacen")
            or "",
            "criticidad": request.form.get("criticidad") or "Normal",
            "fecha_necesidad": request.form.get("fecha_necesidad") or "",
        }
        # Items pueden venir como JSON string
        items_str = request.form.get("items")
        items = json.loads(items_str) if items_str else []
        # Archivos se procesan después de crear la solicitud
        uploaded_files = request.files.getlist("archivos")
    else:
        # JSON tradicional
        data = request.get_json(silent=True) or {}
        items = data.get("items") or []
        uploaded_files = []

    # Validar items (Sprint 3.3)
    validacion = validar_items(items)
    if not validacion["ok"]:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "validation_error",
                        "message": validacion.get("mensaje", "Error de validacion en items"),
                        "errores": validacion.get("errores", []),
                        "items_validos": validacion.get("items_validos", 0),
                    },
                }
            ),
            400,
        )

    # Usar items validados y total calculado por el validador
    items_validos = [item.to_dict() for item in validacion["items"]]
    total = validacion["total"]
    now = datetime.utcnow().isoformat()

    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO solicitudes (id_usuario, centro, sector, justificacion, centro_costos, almacen_virtual, criticidad, fecha_necesidad, data_json, status, total_monto, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            RETURNING id
            """,
            (
                str(user_id),
                data.get("centro") or data.get("centro_id") or "",
                data.get("sector") or data.get("sector_id") or "",
                data.get("justificacion") or "",
                data.get("centro_costos") or "",
                data.get("almacen_virtual") or data.get("almacen") or "",
                data.get("criticidad") or "Normal",
                data.get("fecha_necesidad") or "",
                json.dumps({"items": items_validos, "archivos": []}),
                "Borrador",
                total,
                now,
                now,
            ),
        )
        row = cur.fetchone()
        new_id = row["id"] if isinstance(row, dict) else row[0]

    # Procesar archivos adjuntos si los hay
    archivos_metadata = []
    if uploaded_files:
        for file in uploaded_files:
            if file and file.filename:
                metadata = _save_uploaded_file(file, new_id)
                if metadata:
                    archivos_metadata.append(metadata)

        # Actualizar data_json con metadata de archivos
        if archivos_metadata:
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute("SELECT data_json FROM solicitudes WHERE id = %s", (new_id,))
                row = cur.fetchone()
                data_json_raw = row["data_json"] if isinstance(row, dict) else row[0]
                data_json = json.loads(data_json_raw) if row and data_json_raw else {"items": [], "archivos": []}

            data_json["archivos"] = archivos_metadata
            with get_db_transaction() as conn:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE solicitudes SET data_json = ? WHERE id = ?",
                    (json.dumps(data_json), new_id),
                )

    # Auditar creación
    try:
        auditar_creacion_solicitud(
            solicitud_id=new_id,
            actor_id=str(user_id),
            datos_solicitud={
                "centro": data.get("centro"),
                "sector": data.get("sector"),
                "items_count": len(items),
                "total_monto": total,
            },
            ip_address=request.remote_addr,
        )
    except Exception as e:
        logger.warning(f"Auditoria de creacion fallo para solicitud {new_id}: {e}")

    return get_solicitud(new_id)


@bp.route("/<int:solicitud_id>", methods=["DELETE"])
def eliminar_solicitud(solicitud_id):
    """Eliminar una solicitud (solo borradores propios)"""
    # Validar autenticación
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    user_id = user_payload.get("user_id")
    if not user_id:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "unauthorized",
                        "message": "Usuario no identificado en token",
                    },
                }
            ),
            401,
        )

    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # Validar que el usuario sea el dueño de la solicitud
    if str(solicitud.get("id_usuario")) != str(user_id):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "No tienes permiso para eliminar esta solicitud",
                    },
                }
            ),
            403,
        )

    estado = (solicitud.get("status") or "").lower()
    if estado != "borrador":
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "Solo se pueden eliminar solicitudes en estado Borrador",
                    },
                }
            ),
            403,
        )

    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM solicitudes WHERE id=%s", (solicitud_id,))

    return jsonify({"ok": True, "message": "Solicitud eliminada correctamente"}), 200


@bp.route("/<int:solicitud_id>/draft", methods=["PATCH"])
def guardar_borrador(solicitud_id):
    """Guardar borrador con items y total"""
    # SEGURIDAD: Requiere autenticación
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    user_id = user_payload.get("user_id")
    if not user_id:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "unauthorized",
                        "message": "Usuario no identificado en token",
                    },
                }
            ),
            401,
        )

    # SEGURIDAD: Validar ownership - solo el dueño puede editar el borrador
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    if str(solicitud.get("id_usuario")) != str(user_id):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "No tienes permiso para editar esta solicitud",
                    },
                }
            ),
            403,
        )

    data = request.get_json(silent=True) or {}
    items = data.get("items") or []

    # Validar items si se proporcionan (Sprint 3.3)
    if items:
        validacion = validar_items(items)
        if not validacion["ok"]:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "validation_error",
                            "message": validacion.get("mensaje", "Error de validacion en items"),
                            "errores": validacion.get("errores", []),
                        },
                    }
                ),
                400,
            )
        items_validos = [item.to_dict() for item in validacion["items"]]
        total = validacion["total"]
    else:
        items_validos = []
        total = data.get("total_monto", 0)

    _update_solicitud(
        solicitud_id,
        {
            "data_json": json.dumps({"items": items_validos}),
            "total_monto": total,
            "status": "Borrador",
        },
    )
    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/enviar", methods=["PUT", "POST"])
def enviar_solicitud(solicitud_id):
    """Enviar solicitud para aprobación - Usa FSM centralizado"""
    # SEGURIDAD: Requiere autenticación
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    user_id = str(user_payload.get("user_id", "system"))
    if not user_id or user_id == "system":
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "unauthorized",
                        "message": "Usuario no identificado en token",
                    },
                }
            ),
            401,
        )

    # SEGURIDAD: Validar ownership - solo el dueño puede enviar la solicitud
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    if str(solicitud.get("id_usuario")) != str(user_id):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "No tienes permiso para enviar esta solicitud",
                    },
                }
            ),
            403,
        )

    data = request.get_json(silent=True) or {}
    items = data.get("items") or []

    # Validar items antes de enviar (Sprint 3.3)
    # Si no se envian items, obtener los existentes de la solicitud
    if not items:
        # Ya tenemos la solicitud cargada arriba
        if solicitud:
            try:
                data_json = json.loads(solicitud.get("data_json") or "{}")
                items = data_json.get("items", [])
            except (json.JSONDecodeError, TypeError):
                items = []

    if items:
        validacion = validar_items(items)
        if not validacion["ok"]:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "validation_error",
                            "message": validacion.get("mensaje", "Error de validacion en items"),
                            "errores": validacion.get("errores", []),
                        },
                    }
                ),
                400,
            )
        items_validos = [item.to_dict() for item in validacion["items"]]
        total = validacion["total"]
    else:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "validation_error",
                        "message": "Se requiere al menos un item para enviar la solicitud",
                    },
                }
            ),
            400,
        )

    aprobador = _aprobador_por_monto(total)

    # Actualizar items y total antes de cambiar estado
    _update_solicitud(
        solicitud_id,
        {
            "data_json": json.dumps({"items": items_validos}),
            "total_monto": total,
            "aprobador_id": aprobador,
        },
    )

    # Usar FSM para cambiar estado (valida transición y registra historial)
    try:
        resultado = cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.SUBMITTED,
            actor_id=user_id,
            razon="Solicitud enviada para aprobación",
            metadata={"total_monto": total, "aprobador_asignado": aprobador},
        )
    except SolicitudNoEncontradaError:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud no encontrada"}}
            ),
            404,
        )
    except TransicionInvalidaError as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_transition",
                        "message": str(e),
                        "estado_actual": e.estado_actual,
                        "estado_solicitado": e.estado_nuevo,
                    },
                }
            ),
            400,
        )

    # Sprint 4.4: Calcular SLA para la transicion submitted -> approved
    try:
        sol = _get_raw(solicitud_id)
        criticidad = sol.get("criticidad") or "Normal" if sol else "Normal"

        sla_config = obtener_configuracion_sla(
            criticidad=criticidad, estado_desde="submitted", estado_hasta="approved"
        )

        if sla_config:
            fecha_limite = calcular_fecha_limite(
                fecha_inicio=datetime.utcnow(), horas=sla_config["tiempo_objetivo_horas"]
            )
            actualizar_sla_solicitud(
                solicitud_id=solicitud_id,
                fecha_limite=fecha_limite.isoformat() + "Z",
                estado_sla="on_time",
            )
    except Exception as e:
        # SLA es informativo, no debe bloquear el flujo principal
        logger.warning(f"Actualizacion SLA fallo para solicitud {solicitud_id}: {e}")

    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/aprobar", methods=["PUT", "POST"])
def aprobar_solicitud(solicitud_id):
    """Aprobar solicitud validando presupuesto - Usa FSM centralizado"""
    # 1. Validar autenticacion
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    aprobador_id = str(user_payload.get("user_id"))
    if not aprobador_id:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "unauthorized",
                        "message": "Usuario no identificado en token",
                    },
                }
            ),
            401,
        )

    # 2. Obtener solicitud
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # 3. Validar transición con FSM (submitted -> approved)
    estado_actual = normalizar_estado(solicitud.get("status") or "")
    if not validar_transicion(estado_actual, EstadoSolicitud.APPROVED):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_transition",
                        "message": f"Solicitud no puede aprobarse desde estado '{estado_para_display(estado_actual)}'",
                        "estado_actual": estado_actual,
                    },
                }
            ),
            400,
        )

    # 4. Calcular total
    items = json.loads(solicitud.get("data_json") or "{}").get("items", [])
    total = solicitud.get("total_monto") or _calcular_total(items)

    # 4.5 Validar permisos de aprobacion (matriz parametrizable)
    permiso = puede_aprobar(
        usuario_id=aprobador_id,
        monto_usd=total,
        centro=solicitud.get("centro"),
        sector=solicitud.get("sector"),
    )
    if not permiso.get("puede_aprobar"):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "insufficient_permission",
                        "message": permiso.get(
                            "razon", "No tiene permisos para aprobar este monto"
                        ),
                        "rol_usuario": permiso.get("rol_usuario"),
                        "rol_requerido": permiso.get("rol_requerido"),
                        "nivel_aprobacion": permiso.get("nivel_aprobacion"),
                    },
                }
            ),
            403,
        )

    # 5. Validar y consumir presupuesto
    try:
        from backend.services.budget_service import aprobar_solicitud_con_presupuesto
    except ImportError:
        from services.budget_service import aprobar_solicitud_con_presupuesto

    # Obtener rol del aprobador
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuarios WHERE id_spm = %s", (aprobador_id,))
        user_row = cur.fetchone()

    aprobador_rol = _row_to_dict(user_row, cur).get("rol", "") if user_row else ""

    result = aprobar_solicitud_con_presupuesto(
        solicitud_id=solicitud_id,
        solicitud=solicitud,
        aprobador_id=aprobador_id,
        aprobador_rol=aprobador_rol,
        actor_ip=request.remote_addr or "",
    )

    if not result["ok"]:
        error_code = result.get("error_code", "budget_error")
        status_code = 422 if error_code == "saldo_insuficiente" else 400
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": error_code,
                        "message": result.get("error_message", "Error de presupuesto"),
                        "saldo_disponible": result.get("saldo_disponible_usd"),
                        "monto_requerido": result.get("monto_requerido_usd"),
                    },
                }
            ),
            status_code,
        )

    # 6. Asignar planificador
    planificador = _planificador_para(solicitud.get("centro"), solicitud.get("sector"))
    _update_solicitud(
        solicitud_id,
        {"total_monto": total, "planner_id": planificador, "aprobador_id": aprobador_id},
    )

    # 7. Usar FSM para cambiar estado (registra historial y dispara notificaciones)
    try:
        resultado = cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.APPROVED,
            actor_id=aprobador_id,
            razon="Solicitud aprobada",
            metadata={
                "total_monto": total,
                "planificador_asignado": planificador,
                "presupuesto_consumido": result.get("monto_consumido_cents"),
            },
        )

        # Registrar en auditoria
        auditar_aprobacion(
            solicitud_id=solicitud_id,
            actor_id=aprobador_id,
            actor_rol=aprobador_rol,
            ip_address=request.remote_addr,
        )

    except TransicionInvalidaError as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "invalid_transition", "message": str(e)},
                }
            ),
            400,
        )

    # Sprint 4.4: Resolver alertas SLA y calcular nuevo SLA para siguiente etapa
    try:
        # Resolver alertas de la transicion submitted -> approved
        resolver_alertas_solicitud(solicitud_id=solicitud_id, resuelto_por=aprobador_id)

        # Calcular SLA para la siguiente transicion: approved -> in_treatment
        criticidad = solicitud.get("criticidad") or "Normal"
        sla_config = obtener_configuracion_sla(
            criticidad=criticidad, estado_desde="approved", estado_hasta="in_treatment"
        )

        if sla_config:
            fecha_limite = calcular_fecha_limite(
                fecha_inicio=datetime.utcnow(), horas=sla_config["tiempo_objetivo_horas"]
            )
            actualizar_sla_solicitud(
                solicitud_id=solicitud_id,
                fecha_limite=fecha_limite.isoformat() + "Z",
                estado_sla="on_time",
            )
    except Exception:
        # SLA es informativo, no debe bloquear el flujo principal
        pass

    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/rechazar", methods=["PUT", "POST"])
def rechazar_solicitud(solicitud_id):
    """Rechazar solicitud - Usa FSM centralizado"""
    # SEGURIDAD: Requiere autenticación
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    actor_id = str(user_payload.get("user_id", "system"))
    if not actor_id or actor_id == "system":
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "unauthorized",
                        "message": "Usuario no identificado en token",
                    },
                }
            ),
            401,
        )

    # Obtener rol del actor ANTES de procesar (necesario para validar autorización)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuarios WHERE id_spm = %s", (actor_id,))
        user_row = cur.fetchone()
    actor_rol = _row_to_dict(user_row, cur).get("rol", "") if user_row else ""

    # SEGURIDAD: Validar autorización - solo aprobadores/coordinadores/admin pueden rechazar
    roles_rechazo = [
        "aprobador",
        "approver",
        "coordinador",
        "coordinator",
        "admin",
        "administrador",
    ]
    if not is_admin(actor_rol) and not has_any_role(actor_rol, roles_rechazo):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "No tiene permisos para rechazar solicitudes",
                    },
                }
            ),
            403,
        )

    # Obtener solicitud
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # Validar transición con FSM
    estado_actual = normalizar_estado(solicitud.get("status") or "")
    if not validar_transicion(estado_actual, EstadoSolicitud.REJECTED):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_transition",
                        "message": f"Solicitud no puede rechazarse desde estado '{estado_para_display(estado_actual)}'",
                        "estado_actual": estado_actual,
                    },
                }
            ),
            400,
        )

    data = request.get_json(silent=True) or {}
    motivo = data.get("motivo") or ""

    # Usar FSM para cambiar estado (registra historial y dispara notificaciones)
    try:
        resultado = cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.REJECTED,
            actor_id=actor_id,
            razon=motivo or "Rechazada",
            metadata={"motivo_rechazo": motivo},
        )

        # Registrar en auditoria
        auditar_rechazo(
            solicitud_id=solicitud_id,
            actor_id=actor_id,
            motivo=motivo,
            actor_rol=actor_rol,
            ip_address=request.remote_addr,
        )

    except TransicionInvalidaError as e:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "invalid_transition", "message": str(e)},
                }
            ),
            400,
        )

    # Sprint 4.4: Resolver todas las alertas SLA al rechazar
    try:
        resolver_alertas_solicitud(solicitud_id=solicitud_id, resuelto_por=actor_id)
        # Limpiar SLA de la solicitud
        actualizar_sla_solicitud(solicitud_id=solicitud_id, fecha_limite=None, estado_sla="closed")
    except Exception:
        # SLA es informativo, no debe bloquear el flujo principal
        pass

    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/comentar", methods=["POST"])
def comentar_solicitud(solicitud_id):
    """Agregar comentario/notificación a una solicitud"""
    # SEGURIDAD: Requiere autenticación
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    actor_id = str(user_payload.get("user_id") or "system")

    data = request.get_json(silent=True) or {}
    comentario = data.get("comentario", "").strip()

    if not comentario:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "comentario_required",
                        "message": "El comentario es requerido",
                    },
                }
            ),
            400,
        )

    # Registrar el comentario en el log (si existe la tabla)
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Verificar si existe la tabla de log
            cur.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_name='solicitud_tratamiento_log'"
            )
            table_exists = cur.fetchone() is not None

        if table_exists:
            with get_db_transaction() as conn:
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO solicitud_tratamiento_log (solicitud_id, item_index, actor_id, tipo, estado, payload_json) VALUES (?,?,?,?,?,?)",
                    (
                        solicitud_id,
                        None,
                        actor_id,
                        "comentario_agregado",
                        "comentario",
                        json.dumps({"comentario": comentario}),
                    ),
                )
    except Exception:
        pass  # Log error silently - consider proper logging in production

    return jsonify({"ok": True, "message": "Comentario agregado correctamente"}), 200


@bp.route("/<int:solicitud_id>/historial-estados", methods=["GET"])
def get_historial_estados(solicitud_id):
    """
    Obtener historial de transiciones de estado de una solicitud.

    Endpoint v2 que usa el FSM centralizado.
    """
    # SEGURIDAD: Requiere autenticación
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    # Importar función del FSM
    try:
        from backend.core.fsm import estado_para_display, obtener_historial_estados
    except ImportError:
        from core.fsm import estado_para_display, obtener_historial_estados

    # Verificar que la solicitud existe
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # Obtener historial
    historial = obtener_historial_estados(solicitud_id)

    # Enriquecer con nombres de display
    for item in historial:
        item["estado_anterior_display"] = estado_para_display(item["estado_anterior"])
        item["estado_nuevo_display"] = estado_para_display(item["estado_nuevo"])

    return (
        jsonify(
            {
                "ok": True,
                "solicitud_id": solicitud_id,
                "estado_actual": normalizar_estado(solicitud.get("status") or ""),
                "estado_actual_display": estado_para_display(solicitud.get("status") or ""),
                "historial": historial,
                "total_transiciones": len(historial),
            }
        ),
        200,
    )


@bp.route("/<int:solicitud_id>/transiciones-posibles", methods=["GET"])
def get_transiciones_posibles(solicitud_id):
    """
    Obtener las transiciones de estado posibles desde el estado actual.

    Útil para que el frontend muestre solo las acciones permitidas.
    """
    # SEGURIDAD: Requiere autenticación
    user_payload = _decode_token(expected_type="access", cookie_name="spm_token")
    if isinstance(user_payload, tuple):
        return user_payload

    # Importar función del FSM
    try:
        from backend.core.fsm import get_transiciones_posibles as fsm_transiciones
    except ImportError:
        from core.fsm import get_transiciones_posibles as fsm_transiciones

    # Verificar que la solicitud existe
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    estado_actual = normalizar_estado(solicitud.get("status") or "")
    transiciones = fsm_transiciones(estado_actual)

    return (
        jsonify(
            {
                "ok": True,
                "solicitud_id": solicitud_id,
                "estado_actual": estado_actual,
                "estado_actual_display": estado_para_display(estado_actual),
                "transiciones_posibles": transiciones,
            }
        ),
        200,
    )


def _update_solicitud(solicitud_id: int, fields: dict):
    if not fields:
        return
    fields["updated_at"] = datetime.utcnow().isoformat()
    set_clause = ", ".join([f"{k}=%s" for k in fields.keys()])
    params = list(fields.values()) + [solicitud_id]
    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute(f"UPDATE solicitudes SET {set_clause} WHERE id=%s", params)


def _get_raw(solicitud_id: int):
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM solicitudes WHERE id=%s", (solicitud_id,))
        row = cur.fetchone()
        if row is None:
            return None
        return _row_to_dict(row, cur)


def _calcular_total(items):
    total = 0
    for it in items:
        try:
            qty = float(it.get("cantidad") or 0)
            price = float(it.get("precio_unitario") or 0)
            total += qty * price
        except Exception:
            continue
    return total


def _aprobador_por_monto(total, centro: str = None):
    """Obtiene el ID del aprobador según el monto de la solicitud.

    Refactorizado para usar ApprovalService (Sprint 2.4).
    Delega la lógica de reglas de aprobación al servicio centralizado.

    Args:
        total: Monto total de la solicitud
        centro: Centro de costo (opcional, para priorizar aprobadores)

    Returns:
        ID del aprobador asignado
    """
    try:
        monto = float(total)
    except (TypeError, ValueError):
        monto = 0

    return obtener_aprobador_por_monto(monto, centro)


def _planificador_para(centro: str, sector: str) -> str:
    """Obtiene el ID del planificador asignado para un centro/sector.
    Si no hay asignación específica, busca un planificador en la base de datos.
    """
    centro = (centro or "").strip()
    sector = (sector or "").strip()

    # Primero buscar en asignaciones específicas
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT planificador_id, centro, sector FROM planificador_asignaciones")
        rows = cur.fetchall()

    for r in rows:
        c = (r["centro"] or "").strip()
        s = (r["sector"] or "").strip()
        if (not centro or centro == c) and (not sector or sector == s):
            planificador_id = r["planificador_id"]
            # Verificar que el ID existe en la tabla usuarios
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute("SELECT id_spm FROM usuarios WHERE id_spm = %s", (planificador_id,))
                if cur.fetchone():
                    return planificador_id

    # Fallback: buscar cualquier usuario con rol de planificador
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_spm FROM usuarios
            WHERE LOWER(rol) LIKE '%planificador%'
            LIMIT 1
        """
        )
        row = cur.fetchone()

    if row:
        return str(row["id_spm"])

    # Fallback final: retornar "1" (admin por defecto)
    return "1"
