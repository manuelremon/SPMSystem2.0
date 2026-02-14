"""
Solicitudes routes - SQLite-backed (demo)

Refactorizado para usar FSM centralizado (Sprint 1.6)
"""

import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path

from flask import Blueprint, g, jsonify, request
from werkzeug.utils import secure_filename

logger = logging.getLogger(__name__)

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
from backend.core.roles import has_any_role, is_admin, require_auth
# Note: _decode_token is no longer imported directly - using @require_auth decorator instead
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
from backend.services.notification_service import NotificationService
from backend.core.helpers import row_to_dict as _row_to_dict

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
        "path": str(file_path),  # Clave 'path' con ruta absoluta
        "ruta": str(file_path.relative_to(Path(__file__).parent.parent.parent)),
        "mime_type": file.content_type or "application/octet-stream",
        "tamanio": file_size,
        "created_at": datetime.utcnow().isoformat(),
    }




@bp.route("", methods=["GET"])
@require_auth
def list_solicitudes():
    """Listar solicitudes (permite filtrar por usuario y estado)"""
    # Validación de paginación con límites seguros
    page = max(1, request.args.get("page", 1, type=int))
    page_size = min(max(1, request.args.get("page_size", 10, type=int)), 2000)  # Máximo 2000
    user_id = request.args.get("user_id")
    estado = request.args.get("estado")

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
        cur.execute(f"SELECT COUNT(*) AS count FROM solicitud {where_sql_count}", params)
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
            FROM solicitud s
            LEFT JOIN usuario u ON s.id_usuario = u.id_spm
            LEFT JOIN usuario a ON s.aprobador_id = a.id_spm
            LEFT JOIN usuario p ON s.planner_id = p.id_spm
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
@require_auth
def get_solicitud(solicitud_id):
    """Obtener una solicitud específica"""
    user_id = g.user.get("user_id")
    # Obtener rol de g.user (set by @require_auth)
    user_rol = g.user.get("rol", "")
    if not user_rol and user_id:
        # Fallback: buscar rol en BD
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT rol FROM usuario WHERE id_spm=?", (str(user_id),))
            row = cur.fetchone()
            if row:
                user_rol = row["rol"] if isinstance(row, dict) else row[0]

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM solicitud WHERE id=?", (solicitud_id,))
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
        "aprobador solicitudes",
        "aprobador de solicitudes",
        "aprobador_presupuestos",
        "aprobador presupuestos",
        "aprobador de presupuesto",
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

    # FIX: Si monto_total es None o 0, recalcularlo desde los items
    # (bug: monto_total no se guardó correctamente en la BD)
    if not d.get("monto_total") and d["items"]:
        d["monto_total"] = _calcular_total(d["items"])

    return jsonify({"ok": True, "solicitud": d}), 200


@bp.route("", methods=["POST"])
@require_auth
# Rate limit removido temporalmente - usar rate limiting global
def create_solicitud():
    """Crear una nueva solicitud (soporta JSON o multipart/form-data con archivos)"""
    user_id = g.user.get("user_id")

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

    # FIX 3.1: Validar que centro y sector existan en catálogos
    centro = data.get("centro", "").strip()
    sector = data.get("sector", "").strip()

    if centro or sector:
        with get_db_connection() as conn:
            cur = conn.cursor()

            if centro:
                cur.execute(
                    "SELECT 1 FROM catalogo_centro WHERE (codigo = ? OR nombre = ?) AND activo = 1",
                    (centro, centro),
                )
                if not cur.fetchone():
                    return (
                        jsonify(
                            {
                                "ok": False,
                                "error": {
                                    "code": "invalid_centro",
                                    "message": f"Centro '{centro}' no existe o no está activo",
                                },
                            }
                        ),
                        400,
                    )

            if sector:
                cur.execute(
                    "SELECT 1 FROM catalogo_sector WHERE nombre = ? AND activo = 1",
                    (sector,),
                )
                if not cur.fetchone():
                    return (
                        jsonify(
                            {
                                "ok": False,
                                "error": {
                                    "code": "invalid_sector",
                                    "message": f"Sector '{sector}' no existe o no está activo",
                                },
                            }
                        ),
                        400,
                    )

    # Usar items validados y total calculado por el validador
    items_validos = [item.to_dict() for item in validacion["items"]]
    total = validacion["total"]
    now = datetime.utcnow().isoformat()

    # FIX: Procesar archivos ANTES de la transacción para incluirlos en el INSERT
    # Esto evita race condition donde la solicitud se crea sin archivos
    archivos_metadata = []
    archivos_guardados = []  # Para rollback si falla el INSERT

    if uploaded_files:
        # Generar un ID temporal para guardar archivos (usaremos timestamp + random)
        temp_prefix = f"temp_{uuid.uuid4().hex[:8]}"

        for file in uploaded_files:
            if file and file.filename:
                # Guardar archivo con prefijo temporal
                metadata = _save_uploaded_file(file, temp_prefix)
                if metadata:
                    archivos_metadata.append(metadata)
                    archivos_guardados.append(metadata.get("path"))

    try:
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO solicitud (id_usuario, centro, sector, justificacion, centro_costos, almacen_virtual, criticidad, fecha_necesidad, data_json, status, total_monto, created_at, updated_at)
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
                    json.dumps({"items": items_validos, "archivos": archivos_metadata}),
                    "Borrador",
                    total,
                    now,
                    now,
                ),
            )
            row = cur.fetchone()
            new_id = row["id"] if isinstance(row, dict) else row[0]

            # Renombrar archivos con el ID real de la solicitud (dentro de la transacción lógica)
            if archivos_guardados:
                for i, old_path in enumerate(archivos_guardados):
                    if old_path and os.path.exists(old_path):
                        # Actualizar path en metadata
                        new_path = old_path.replace(temp_prefix, str(new_id))
                        try:
                            os.rename(old_path, new_path)
                            archivos_metadata[i]["path"] = new_path
                            archivos_metadata[i]["solicitud_id"] = new_id
                        except OSError as e:
                            logger.warning(f"No se pudo renombrar archivo {old_path}: {e}")

                # Actualizar data_json con paths correctos
                cur.execute(
                    "UPDATE solicitud SET data_json = ? WHERE id = ?",
                    (json.dumps({"items": items_validos, "archivos": archivos_metadata}), new_id),
                )

    except Exception as e:
        # Rollback: limpiar archivos guardados si falla el INSERT
        for path in archivos_guardados:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
        logger.error(f"Error creando solicitud: {e}")
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "database_error",
                        "message": "Error al crear la solicitud",
                    },
                }
            ),
            500,
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

    # Notificar al usuario que su solicitud fue creada
    try:
        NotificationService.create_notification(
            destinatario_id=str(user_id),
            mensaje=f"Solicitud #{new_id} creada exitosamente como borrador",
            tipo="solicitud_created",
            solicitud_id=new_id,
        )
    except Exception as e:
        logger.warning(f"Notificacion de creacion fallo para solicitud {new_id}: {e}")

    return get_solicitud(new_id)


@bp.route("/<int:solicitud_id>", methods=["DELETE"])
@require_auth
def eliminar_solicitud(solicitud_id):
    """Eliminar una solicitud (solo borradores propios)"""
    user_id = g.user.get("user_id")

    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # FIX 3.2: Obtener rol del usuario para validar permisos
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuario WHERE id_spm = ?", (user_id,))
        user_row = cur.fetchone()
        user_rol = (user_row["rol"] if user_row else "") or ""
        es_admin = "admin" in user_rol.lower()

    # Validar que el usuario sea el dueño de la solicitud o admin
    es_owner = str(solicitud.get("id_usuario")) == str(user_id)
    if not es_owner and not es_admin:
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

    # FIX 3.2: Admin puede eliminar cualquier solicitud, usuarios solo borradores
    estado = normalizar_estado(solicitud.get("status") or "")
    if estado != "draft" and not es_admin:
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
        cur.execute("DELETE FROM solicitud WHERE id=?", (solicitud_id,))

    # Notificar al usuario que su solicitud fue eliminada
    try:
        NotificationService.create_notification(
            destinatario_id=str(user_id),
            mensaje=f"Solicitud #{solicitud_id} eliminada correctamente",
            tipo="info",
            solicitud_id=None,  # Ya no existe
        )
    except Exception as e:
        logger.warning(f"Notificacion de eliminacion fallo para solicitud {solicitud_id}: {e}")

    return jsonify({"ok": True, "message": "Solicitud eliminada correctamente"}), 200


@bp.route("/<int:solicitud_id>/draft", methods=["PATCH"])
@require_auth
def guardar_borrador(solicitud_id):
    """Guardar borrador con items y total"""
    user_id = g.user.get("user_id")

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
@require_auth
def enviar_solicitud(solicitud_id):
    """Enviar solicitud para aprobación - Usa FSM centralizado"""
    user_id = str(g.user.get("user_id", ""))

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

    # Calcular score IA de prioridad (no bloqueante)
    try:
        from backend.services.ai_service import get_ai_service
        sol_data = _get_raw(solicitud_id)
        if sol_data:
            service = get_ai_service()
            scored = service.priorizar_solicitudes([dict(sol_data)])
            if scored and scored.get("solicitudes_rankeadas"):
                ranked = scored["solicitudes_rankeadas"][0]
                ai_score = ranked.get("total_score", 0)
                priority_level = ranked.get("priority_level", "Media")
                _update_solicitud(solicitud_id, {
                    "ai_score": round(ai_score, 4),
                    "ai_priority": priority_level,
                })
    except Exception as e:
        logger.warning(f"AI scoring fallo para solicitud {solicitud_id}: {e}")

    # Feature 4.1: Auto-Aprobación con IA (no bloqueante)
    try:
        auto_aprobada = _check_auto_approval(solicitud_id)
        if auto_aprobada:
            logger.info(f"[AUTO-APROBACION] Solicitud {solicitud_id} auto-aprobada por IA")
    except Exception as e:
        logger.warning(f"Auto-aprobación fallo para solicitud {solicitud_id}: {e}")

    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/aprobar", methods=["PUT", "POST"])
@require_auth
def aprobar_solicitud(solicitud_id):
    """Aprobar solicitud validando presupuesto - Usa FSM centralizado"""
    logger.info(f"[APROBAR-DEBUG] Inicio aprobar_solicitud({solicitud_id})")
    aprobador_id = str(g.user.get("user_id", ""))
    logger.info(f"[APROBAR-DEBUG] aprobador_id={aprobador_id}")

    # 2. Obtener solicitud
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # FIX 4.2: Validar que el usuario solicitante sigue activo
    solicitante_id = solicitud.get("id_usuario")
    if solicitante_id:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT estado_registro FROM usuario WHERE id_spm = ?",
                (str(solicitante_id),),
            )
            row = cur.fetchone()
            if row:
                estado_usuario = row["estado_registro"] if isinstance(row, dict) else row[0]
                if estado_usuario and estado_usuario != "Activo":
                    return (
                        jsonify(
                            {
                                "ok": False,
                                "error": {
                                    "code": "user_inactive",
                                    "message": "El usuario solicitante ya no está activo en el sistema",
                                },
                            }
                        ),
                        422,
                    )

    # 2.5 SEGURIDAD: Validar que el aprobador sea el asignado (si hay uno asignado)
    aprobador_asignado = solicitud.get("aprobador_id") or solicitud.get("aprobador_asignado")
    logger.info(f"[APROBAR] Solicitud {solicitud_id}: aprobador_asignado={aprobador_asignado!r}, aprobador_id_token={aprobador_id!r}, match={str(aprobador_asignado) == str(aprobador_id)}")

    # Obtener rol del usuario que intenta aprobar
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuario WHERE id_spm = ?", (aprobador_id,))
        row = cur.fetchone()
        user_rol = _row_to_dict(row, cur).get("rol", "") if row else ""

    logger.info(f"[APROBAR] Usuario {aprobador_id} rol={user_rol!r}, is_admin={is_admin(user_rol)}")

    if aprobador_asignado and str(aprobador_asignado) != str(aprobador_id):
        # Verificar si es admin (admins pueden aprobar cualquier solicitud)
        if not is_admin(user_rol):
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "forbidden",
                            "message": "Solo el aprobador asignado puede aprobar esta solicitud",
                            "aprobador_asignado": str(aprobador_asignado),
                        },
                    }
                ),
                403,
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

    # 4.6 SPRINT 1.2: Validar que no haya consumo previo sin revertir
    # Esto previene doble consumo cuando una solicitud se reenvía
    balanceado, consumos, reversiones = _validar_consumo_previo_balanceado(solicitud_id)
    if not balanceado:
        logger.error(
            f"[DOBLE_CONSUMO] Solicitud {solicitud_id} tiene consumos no balanceados: "
            f"consumos={consumos}, reversiones={reversiones}"
        )
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "unbalanced_budget_entries",
                        "message": "Esta solicitud tiene consumos de presupuesto previos no revertidos. "
                                   "Contacte al administrador.",
                        "consumos": consumos,
                        "reversiones": reversiones,
                    },
                }
            ),
            422,
        )

    # 5. Validar y consumir presupuesto
    from backend.services.budget_service import aprobar_solicitud_con_presupuesto

    # Obtener rol del aprobador
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuario WHERE id_spm = ?", (aprobador_id,))
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
    # FIX: Si falla el FSM, revertir el presupuesto consumido (pattern de compensación)
    budget_result = result.get("budget_result", {})
    presupuesto_consumido = budget_result.get("saldo_anterior_cents", 0) - budget_result.get(
        "saldo_posterior_cents", 0
    )

    try:
        resultado = cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.APPROVED,
            actor_id=aprobador_id,
            razon="Solicitud aprobada",
            metadata={
                "total_monto": total,
                "planificador_asignado": planificador,
                "presupuesto_consumido_cents": presupuesto_consumido,
                "saldo_anterior_cents": budget_result.get("saldo_anterior_cents"),
                "saldo_posterior_cents": budget_result.get("saldo_posterior_cents"),
                "ledger_id": budget_result.get("ledger_id"),
            },
        )

        # Registrar en auditoria (tolerante a fallos - tabla audit_trail puede no existir)
        try:
            auditar_aprobacion(
                solicitud_id=solicitud_id,
                actor_id=aprobador_id,
                actor_rol=aprobador_rol,
                ip_address=request.remote_addr,
            )
        except Exception as e:
            # Auditoría es informativa, no debe bloquear el flujo principal
            logger.warning(f"[AUDIT] Error registrando aprobación en audit_trail: {e}")

        # NOTA: Notificación al solicitante ya se crea automáticamente en FSM
        # (cambiar_estado -> _disparar_notificaciones) - NO duplicar aquí

    except TransicionInvalidaError as e:
        # FIX: Revertir presupuesto consumido si falla el cambio de estado
        _revertir_presupuesto_aprobacion_fallida(
            solicitud_id=solicitud_id,
            solicitud=solicitud,
            monto_cents=presupuesto_consumido,
            aprobador_id=aprobador_id,
            aprobador_rol=aprobador_rol,
            razon=f"Compensación: FSM falló con error {str(e)}",
        )
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "invalid_transition", "message": str(e)},
                }
            ),
            400,
        )
    except Exception as e:
        # FIX: Cualquier otro error también debe revertir el presupuesto
        import traceback
        logger.error(f"Error inesperado en aprobación de solicitud {solicitud_id}: {e}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        _revertir_presupuesto_aprobacion_fallida(
            solicitud_id=solicitud_id,
            solicitud=solicitud,
            monto_cents=presupuesto_consumido,
            aprobador_id=aprobador_id,
            aprobador_rol=aprobador_rol,
            razon=f"Compensación: Error inesperado {str(e)}",
        )
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "internal_error", "message": "Error interno al aprobar"},
                }
            ),
            500,
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
@require_auth
def rechazar_solicitud(solicitud_id):
    """Rechazar solicitud - Usa FSM centralizado"""
    actor_id = str(g.user.get("user_id", ""))

    # Obtener rol del actor ANTES de procesar (necesario para validar autorización)
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuario WHERE id_spm = ?", (actor_id,))
        user_row = cur.fetchone()
    actor_rol = _row_to_dict(user_row, cur).get("rol", "") if user_row else ""

    # SEGURIDAD: Validar autorización - solo aprobadores/coordinadores/admin pueden rechazar
    roles_rechazo = [
        "aprobador",
        "aprobador_solicitudes",
        "aprobador solicitudes",
        "aprobador de solicitudes",
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

    # SEGURIDAD: Validar que el rechazante sea el aprobador asignado (si hay uno)
    aprobador_asignado = solicitud.get("aprobador_id") or solicitud.get("aprobador_asignado")
    if aprobador_asignado and str(aprobador_asignado) != str(actor_id):
        if not is_admin(actor_rol):
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "forbidden",
                            "message": "Solo el aprobador asignado puede rechazar esta solicitud",
                            "aprobador_asignado": str(aprobador_asignado),
                        },
                    }
                ),
                403,
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

    # SPRINT 1.1: Revertir presupuesto si la solicitud estaba APPROVED
    # Esto previene fuga de dinero cuando se rechaza una solicitud ya aprobada
    if estado_actual == EstadoSolicitud.APPROVED.value or estado_actual == "approved":
        monto_consumido = _obtener_monto_consumo_solicitud(solicitud_id)
        if monto_consumido > 0:
            logger.info(
                f"[REVERSION_RECHAZO] Revirtiendo ${monto_consumido/100:.2f} para solicitud {solicitud_id} "
                f"(estado previo: approved)"
            )
            _revertir_presupuesto_aprobacion_fallida(
                solicitud_id=solicitud_id,
                solicitud=solicitud,
                monto_cents=monto_consumido,
                aprobador_id=actor_id,
                aprobador_rol=actor_rol,
                razon=f"Reversion por rechazo de solicitud aprobada. Motivo: {motivo or 'No especificado'}",
            )

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
        # Registrar en auditoria (tolerante a fallos - tabla audit_trail puede no existir)
        try:
            auditar_rechazo(
                solicitud_id=solicitud_id,
                actor_id=actor_id,
                motivo=motivo,
                actor_rol=actor_rol,
                ip_address=request.remote_addr,
            )
        except Exception as e:
            # Auditoría es informativa, no debe bloquear el flujo principal
            logger.warning(f"[AUDIT] Error registrando rechazo en audit_trail: {e}")

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


@bp.route("/<int:solicitud_id>/cancelar", methods=["PUT", "POST"])
@require_auth
def cancelar_solicitud(solicitud_id):
    """
    SPRINT 1.3: Cancelar solicitud con reversión automática de presupuesto.
    Solo el solicitante o admin pueden cancelar.
    Si la solicitud estaba APPROVED, el presupuesto consumido se revierte.
    """
    actor_id = str(g.user.get("user_id", ""))

    # 2. Obtener rol del actor
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol FROM usuario WHERE id_spm = ?", (actor_id,))
        user_row = cur.fetchone()
    actor_rol = _row_to_dict(user_row, cur).get("rol", "") if user_row else ""

    # 3. Obtener solicitud
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # 4. SEGURIDAD: Solo el owner o admin pueden cancelar
    owner_id = str(solicitud.get("id_usuario") or solicitud.get("solicitante_id") or "")
    es_owner = str(actor_id) == owner_id
    es_admin_user = is_admin(actor_rol)

    if not es_owner and not es_admin_user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "Solo el solicitante o admin puede cancelar esta solicitud",
                    },
                }
            ),
            403,
        )

    # 5. Validar transición con FSM
    estado_actual = normalizar_estado(solicitud.get("status") or "")
    if not validar_transicion(estado_actual, EstadoSolicitud.CANCELLED):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_transition",
                        "message": f"Solicitud no puede cancelarse desde estado '{estado_para_display(estado_actual)}'",
                        "estado_actual": estado_actual,
                    },
                }
            ),
            400,
        )

    # 6. Obtener motivo de cancelación (requerido)
    data = request.get_json(silent=True) or {}
    motivo = data.get("motivo") or data.get("motivo_cancelacion") or ""
    if not motivo.strip():
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "motivo_required",
                        "message": "El motivo de cancelación es requerido",
                    },
                }
            ),
            400,
        )

    # 7. SPRINT 1.3: Revertir presupuesto si la solicitud estaba APPROVED
    if estado_actual == EstadoSolicitud.APPROVED.value or estado_actual == "approved":
        monto_consumido = _obtener_monto_consumo_solicitud(solicitud_id)
        if monto_consumido > 0:
            logger.info(
                f"[REVERSION_CANCELACION] Revirtiendo ${monto_consumido/100:.2f} para solicitud {solicitud_id} "
                f"(estado previo: approved)"
            )
            _revertir_presupuesto_aprobacion_fallida(
                solicitud_id=solicitud_id,
                solicitud=solicitud,
                monto_cents=monto_consumido,
                aprobador_id=actor_id,
                aprobador_rol=actor_rol,
                razon=f"Reversion por cancelacion de solicitud. Motivo: {motivo}",
            )

    # 8. Usar FSM para cambiar estado
    try:
        resultado = cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.CANCELLED,
            actor_id=actor_id,
            razon=motivo,
            metadata={"motivo_cancelacion": motivo, "cancelado_por": actor_id},
        )
        logger.info(f"[CANCELACION] Solicitud {solicitud_id} cancelada por usuario {actor_id}")

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

    # 9. Resolver alertas SLA
    try:
        resolver_alertas_solicitud(solicitud_id=solicitud_id, resuelto_por=actor_id)
        actualizar_sla_solicitud(solicitud_id=solicitud_id, fecha_limite=None, estado_sla="closed")
    except Exception:
        pass  # SLA es informativo

    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/reenviar", methods=["PUT", "POST"])
@require_auth
def reenviar_solicitud(solicitud_id):
    """
    Reenviar solicitud rechazada para nueva aprobación.
    Transición: rejected → submitted
    Máximo 2 reenvíos permitidos (validación de reenvíos).
    """
    actor_id = str(g.user.get("user_id", ""))

    # 1. Obtener solicitud
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )

    # 2. SEGURIDAD: Solo el owner puede reenviar
    owner_id = str(solicitud.get("id_usuario") or solicitud.get("solicitante_id") or "")
    if str(actor_id) != owner_id:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "Solo el solicitante puede reenviar esta solicitud",
                    },
                }
            ),
            403,
        )

    # 3. Validar que esté en estado rejected
    estado_actual = normalizar_estado(solicitud.get("status") or "")
    if estado_actual != "rejected":
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_state",
                        "message": f"Solicitud debe estar rechazada, estado actual: {estado_actual}",
                    },
                }
            ),
            400,
        )

    # 4. Validar máximo de reenvíos (máximo 2)
    with get_db_connection() as conn:
        cur = conn.cursor()
        # Contar transiciones de rejected → submitted
        cur.execute(
            """SELECT COUNT(*) as reenvios FROM solicitud_historial_estado
               WHERE solicitud_id = ? AND estado_anterior = 'rejected' AND estado_nuevo = 'submitted'""",
            (solicitud_id,),
        )
        row = cur.fetchone()
        reenvios = row["reenvios"] if isinstance(row, dict) else row[0]

    if reenvios >= 2:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "max_reenvios_exceeded",
                        "message": f"Número máximo de reenvíos (2) excedido. Reenvíos actuales: {reenvios}",
                    },
                }
            ),
            400,
        )

    # 5. Transicionar a submitted
    data = request.get_json(silent=True) or {}
    razon_reenvio = (data.get("razon_reenvio") or "").strip()

    # 6. Hacer transición
    cambio_estado(
        solicitud_id=solicitud_id,
        estado_nuevo=EstadoSolicitud.SUBMITTED,
        actor_id=actor_id,
        razon=razon_reenvio or f"Reenvío #{reenvios + 1}",
    )

    logger.info(f"[REENVIAR] Solicitud {solicitud_id} reenviada (reenvío #{reenvios + 1})")

    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/comentar", methods=["POST"])
@require_auth
def comentar_solicitud(solicitud_id):
    """Agregar comentario/notificación a una solicitud"""
    actor_id = str(g.user.get("user_id") or "system")

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
@require_auth
def get_historial_estados(solicitud_id):
    """
    Obtener historial de transiciones de estado de una solicitud.

    Endpoint v2 que usa el FSM centralizado.
    """
    # Importar función del FSM
    from backend.core.fsm import estado_para_display, obtener_historial_estados

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
@require_auth
def get_transiciones_posibles(solicitud_id):
    """
    Obtener las transiciones de estado posibles desde el estado actual.

    Útil para que el frontend muestre solo las acciones permitidas.
    Incluye validación de permisos para cada transición.
    """
    user_id = g.user.get("user_id")

    # Importar función del FSM
    from backend.core.fsm import get_transiciones_posibles as fsm_transiciones, normalizar_estado

    # Importar servicio de aprobación para validar permisos
    from backend.services.approval_service import puede_aprobar

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
    transiciones_display = fsm_transiciones(estado_actual)  # Retorna strings display names

    # Obtener información del usuario para validar permisos
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol, centros FROM usuario WHERE id_spm = ?", (user_id,))
        user_row = cur.fetchone()
        user_rol = user_row["rol"] if isinstance(user_row, dict) else user_row[0] if user_row else ""
        user_centro = user_row["centros"] if isinstance(user_row, dict) else user_row[1] if user_row else None

    # FIX 2.1: Enriquecer transiciones con validación de permisos
    transiciones_con_permisos = []
    owner_id = str(solicitud.get("id_usuario", ""))
    es_owner = str(user_id) == owner_id
    es_admin = "admin" in (user_rol or "").lower()

    # Calcular total de la solicitud para validar aprobación
    items_json = solicitud.get("data_json") or "{}"
    try:
        extra = json.loads(items_json) if isinstance(items_json, str) else items_json
        items = extra.get("items", [])
    except (json.JSONDecodeError, TypeError):
        items = []
    total_solicitud = _calcular_total(items)

    for estado_display in transiciones_display:
        # estado_display es un string como "Aprobada", "Enviada", etc.
        # Convertir de nuevo a estado interno para comparaciones
        from backend.core.fsm import normalizar_estado
        estado_destino = normalizar_estado(estado_display)

        validacion = {
            "estado": estado_destino,
            "estado_display": estado_display,
            "permitido": True,
            "razon": None,
        }

        # Validar permisos específicos por tipo de transición
        if estado_destino == "approved":
            # Solo aprobadores pueden aprobar
            permiso = puede_aprobar(
                usuario_id=user_id,
                monto_usd=total_solicitud,
                centro=solicitud.get("centro"),
                sector=solicitud.get("sector"),
            )
            if not permiso.get("puede_aprobar"):
                validacion["permitido"] = False
                validacion["razon"] = permiso.get("razon", "Sin permisos de aprobación")

        elif estado_destino == "rejected":
            # Solo aprobadores o admin pueden rechazar
            es_aprobador = "aprobador" in (user_rol or "").lower() or "coordinador" in (user_rol or "").lower()
            if not es_aprobador and not es_admin:
                validacion["permitido"] = False
                validacion["razon"] = "Solo aprobadores pueden rechazar solicitudes"

        elif estado_destino == "cancelled":
            # Solo el owner o admin pueden cancelar
            if not es_owner and not es_admin:
                validacion["permitido"] = False
                validacion["razon"] = "Solo el solicitante o admin puede cancelar"

        elif estado_destino == "in_planning":
            # Solo planificadores o admin pueden mover a planificación
            es_planner = "planner" in (user_rol or "").lower() or "planificador" in (user_rol or "").lower()
            if not es_planner and not es_admin:
                validacion["permitido"] = False
                validacion["razon"] = "Solo planificadores pueden iniciar planificación"
            else:
                # FIX 4.1: Validar límite de retrocesos (in_treatment -> in_planning)
                if estado_actual == "in_treatment":
                    with get_db_connection() as conn_ret:
                        cur_ret = conn_ret.cursor()
                        cur_ret.execute(
                            """
                            SELECT COUNT(*) as retrocesos FROM solicitud_historial_estado
                            WHERE solicitud_id = ?
                              AND estado_anterior = 'in_treatment'
                              AND estado_nuevo = 'in_planning'
                            """,
                            (solicitud_id,),
                        )
                        row_ret = cur_ret.fetchone()
                        retrocesos = row_ret["retrocesos"] if isinstance(row_ret, dict) else row_ret[0] if row_ret else 0
                        if retrocesos >= 3:
                            validacion["permitido"] = False
                            validacion["razon"] = "Límite de 3 retrocesos alcanzado para esta solicitud"

        elif estado_destino == "submitted":
            # Solo el owner puede enviar (desde draft)
            if estado_actual == "draft" and not es_owner and not es_admin:
                validacion["permitido"] = False
                validacion["razon"] = "Solo el solicitante puede enviar su solicitud"

        transiciones_con_permisos.append(validacion)

    return (
        jsonify(
            {
                "ok": True,
                "solicitud_id": solicitud_id,
                "estado_actual": estado_actual,
                "estado_actual_display": estado_para_display(estado_actual),
                "transiciones_posibles": transiciones_con_permisos,
            }
        ),
        200,
    )


def _update_solicitud(solicitud_id: int, fields: dict):
    if not fields:
        return
    fields["updated_at"] = datetime.utcnow().isoformat()
    set_clause = ", ".join([f"{k}=?" for k in fields.keys()])
    params = list(fields.values()) + [solicitud_id]
    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute(f"UPDATE solicitud SET {set_clause} WHERE id=?", params)


def _get_raw(solicitud_id: int):
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM solicitud WHERE id=?", (solicitud_id,))
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


def _validar_consumo_previo_balanceado(solicitud_id: int) -> tuple:
    """
    SPRINT 1.2: Valida que los consumos previos estén balanceados con reversiones.
    Previene doble consumo cuando una solicitud se reenvía.

    Returns:
        Tuple (balanceado: bool, consumos: int, reversiones: int)
    """
    from backend.core.budget_schemas import TipoMovimiento

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Contar consumos (referencia_id es TEXT en PG, castear solicitud_id)
            cur.execute(
                """
                SELECT COUNT(*) as cnt FROM presupuesto_ledger
                WHERE referencia_tipo = 'solicitud'
                AND referencia_id = ?
                AND tipo_movimiento = ?
                """,
                (str(solicitud_id), TipoMovimiento.CONSUMO_APROBACION.value),
            )
            row = cur.fetchone()
            consumos = row["cnt"] if isinstance(row, dict) else row[0]

            # Contar reversiones
            cur.execute(
                """
                SELECT COUNT(*) as cnt FROM presupuesto_ledger
                WHERE referencia_tipo = 'solicitud'
                AND referencia_id = ?
                AND tipo_movimiento = ?
                """,
                (str(solicitud_id), TipoMovimiento.REVERSION_RECHAZO.value),
            )
            row = cur.fetchone()
            reversiones = row["cnt"] if isinstance(row, dict) else row[0]

            return (consumos == reversiones, consumos, reversiones)
    except Exception as e:
        logger.error(f"Error validando consumo previo para solicitud {solicitud_id}: {e}")
        # En caso de error, asumir balanceado para no bloquear
        return (True, 0, 0)


def _obtener_monto_consumo_solicitud(solicitud_id: int) -> int:
    """
    Obtiene el monto del consumo de presupuesto original para una solicitud.
    Busca en el ledger el movimiento de tipo CONSUMO_APROBACION.

    Returns:
        Monto en centavos (positivo) o 0 si no hay consumo registrado.
    """
    from backend.core.budget_schemas import TipoMovimiento

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT monto_cents FROM presupuesto_ledger
                WHERE referencia_tipo = 'solicitud'
                AND referencia_id = ?
                AND tipo_movimiento = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (str(solicitud_id), TipoMovimiento.CONSUMO_APROBACION.value),
            )
            row = cur.fetchone()
            if row:
                # monto_cents está guardado como negativo (débito)
                return abs(row["monto_cents"])
    except Exception as e:
        logger.error(f"Error buscando consumo para solicitud {solicitud_id}: {e}")
    return 0


def _revertir_presupuesto_aprobacion_fallida(
    solicitud_id: int,
    solicitud: dict,
    monto_cents: int,
    aprobador_id: str,
    aprobador_rol: str,
    razon: str,
) -> None:
    """
    Revierte el presupuesto consumido si falla el cambio de estado FSM.
    Implementa el patrón de compensación para mantener consistencia.
    """
    if monto_cents <= 0:
        return  # Nada que revertir

    from backend.core.budget_transaction import AtomicBudgetTransaction, TransactionContext

    centro = solicitud.get("centro", "")
    sector = solicitud.get("sector", "")

    ctx = TransactionContext(
        trace_id=str(uuid.uuid4()),
        actor_id=aprobador_id,
        actor_rol=aprobador_rol,
        actor_ip="",
    )

    try:
        with AtomicBudgetTransaction() as txn:
            result = txn.revertir_consumo(
                centro=centro,
                sector=sector,
                monto_cents=monto_cents,
                solicitud_id=solicitud_id,
                ctx=ctx,
                motivo=razon,
            )
            if result.success:
                logger.info(
                    f"[COMPENSACION] Presupuesto revertido para solicitud {solicitud_id}: "
                    f"{monto_cents} cents devueltos a {centro}/{sector}"
                )
            else:
                logger.error(
                    f"[COMPENSACION] Fallo al revertir presupuesto para solicitud {solicitud_id}: "
                    f"{result.error_message}"
                )
    except Exception as e:
        logger.error(
            f"[COMPENSACION] Excepcion al revertir presupuesto para solicitud {solicitud_id}: {e}"
        )


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
                cur.execute("SELECT id_spm FROM usuario WHERE id_spm = ?", (planificador_id,))
                if cur.fetchone():
                    return planificador_id

    # Fallback: buscar cualquier usuario con rol de planificador
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id_spm FROM usuario
            WHERE LOWER(rol) LIKE '%planificador%'
            LIMIT 1
        """
        )
        row = cur.fetchone()

    if row:
        return str(row["id_spm"])

    # Fallback final: retornar "1" (admin por defecto)
    return "1"


def _check_auto_approval(solicitud_id: int) -> bool:
    """
    Feature 4.1: Verifica si la solicitud califica para auto-aprobación con IA.

    Criterios:
    - Material clase C
    - Monto < $500 USD (50000 cents)
    - Usuario con 95%+ tasa de aprobación histórica

    Returns:
        True si fue auto-aprobada, False si no
    """
    try:
        solicitud = _get_raw(solicitud_id)
        if not solicitud:
            return False

        # Obtener datos de la solicitud
        total_monto = solicitud.get("total_monto", 0) or 0
        user_id = solicitud.get("id_usuario")

        # Criterio 1: Monto < $500 USD
        if total_monto >= 50000:  # 50000 cents = $500 USD
            return False

        # Criterio 2: Calcular tasa de aprobación del usuario
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'approved' OR status = 'Aprobada' THEN 1 ELSE 0 END) as aprobadas
                FROM solicitud
                WHERE id_usuario = ? AND status IN ('approved', 'rejected', 'Aprobada', 'Rechazada')
                """,
                (str(user_id),)
            )
            row = cur.fetchone()

            if not row:
                return False

            total = row["total"] if isinstance(row, dict) else row[0]
            aprobadas = row["aprobadas"] if isinstance(row, dict) else row[1]

            # Requerir al menos 10 solicitudes históricas para evitar falsos positivos
            if total < 10:
                return False

            tasa_aprobacion = (aprobadas / total) if total > 0 else 0

            # Criterio 3: Tasa de aprobación >= 95%
            if tasa_aprobacion < 0.95:
                return False

        # Criterio 4: Verificar si los items son clase C (simplificado: si monto bajo, asumir clase C)
        # En producción, se debería verificar la clase ABC de cada material

        # Todos los criterios cumplidos - auto-aprobar
        motivo = (
            f"Auto-aprobado por IA: Usuario con {round(tasa_aprobacion * 100, 1)}% "
            f"tasa aprobación ({aprobadas}/{total}), monto ${total_monto/100:.2f} USD"
        )

        # Cambiar estado a approved
        cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.APPROVED,
            actor_id="system_ia",
            razon=motivo,
            metadata={
                "auto_aprobado": True,
                "tasa_aprobacion": tasa_aprobacion,
                "total_historico": total,
                "aprobadas_historico": aprobadas,
            }
        )

        # Actualizar campos de auto-aprobación
        _update_solicitud(solicitud_id, {
            "auto_aprobado": 1,
            "auto_aprobado_motivo": motivo,
        })

        # Notificar al usuario
        try:
            NotificationService.create_notification(
                destinatario_id=str(user_id),
                mensaje=f"Su solicitud #{solicitud_id} fue auto-aprobada por IA",
                tipo="solicitud_approved",
                solicitud_id=solicitud_id,
            )
        except Exception:
            pass

        # Notificar al aprobador original
        aprobador_id = solicitud.get("aprobador_id")
        if aprobador_id:
            try:
                NotificationService.create_notification(
                    destinatario_id=str(aprobador_id),
                    mensaje=f"Solicitud #{solicitud_id} fue auto-aprobada por IA (no requiere su acción)",
                    tipo="info",
                    solicitud_id=solicitud_id,
                )
            except Exception:
                pass

        return True

    except Exception as e:
        logger.error(f"Error en auto-aprobación para solicitud {solicitud_id}: {e}")
        return False
