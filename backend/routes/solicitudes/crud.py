"""
Solicitudes CRUD routes - Crear, leer, listar y eliminar solicitudes.

Incluye: list_solicitudes, get_solicitud, create_solicitud,
eliminar_solicitud, guardar_borrador.
"""

import json
import logging
import os
import shutil
import uuid
from datetime import date, datetime
from pathlib import Path

from flask import g, jsonify, request, send_file
from werkzeug.utils import secure_filename

from backend.core.db import get_db_connection, get_db_transaction
from backend.core.fsm import normalizar_estado
from backend.core.helpers import row_to_dict as _row_to_dict
from backend.core.item_schemas import CRITICIDADES_VALIDAS, validar_items
from backend.core.roles import is_admin, require_auth
from backend.routes.solicitudes import bp
from backend.routes.solicitudes.helpers import (
    _archivos_publicos,
    _calcular_total,
    _get_raw,
    _get_uploads_dir,
    _puede_ver_solicitud,
    _rol_usuario_actual,
    _save_uploaded_file,
    _tiene_vision_amplia,
    _update_solicitud,
    _validar_adjuntos,
)
from backend.services.audit_service import auditar_creacion_solicitud
from backend.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


@bp.route("", methods=["GET"])
@require_auth
def list_solicitudes():
    """Listar solicitudes (permite filtrar por usuario y estado)"""
    # Validacion de paginacion con limites seguros
    page = max(1, request.args.get("page", 1, type=int))
    page_size = min(max(1, request.args.get("page_size", 10, type=int)), 2000)  # Maximo 2000
    user_id = request.args.get("user_id")
    estado = request.args.get("estado")

    # SEGURIDAD: sin rol de vision amplia, solo se listan las propias solicitudes
    current_user_id = str(g.user.get("user_id", ""))
    if not _tiene_vision_amplia(_rol_usuario_actual(current_user_id)):
        user_id = current_user_id

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
                s.ai_priority, s.ai_score,
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
        items = extra.get("items", [])
        d["items"] = items
        # Recalcular total_monto si es NULL o 0
        if not d.get("total_monto") and items:
            d["total_monto"] = sum(
                float(it.get("precio_unitario", 0) or it.get("precio", 0) or 0)
                * float(it.get("cantidad", 0) or 0)
                for it in items
            )
        # No enviar data_json raw al frontend (ya se extrajo items)
        d.pop("data_json", None)
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
    """Obtener una solicitud especifica"""
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
        cur.execute(
            """SELECT id, id_usuario, centro, sector, justificacion,
                    centro_costos, almacen_virtual, criticidad, fecha_necesidad,
                    data_json, status, aprobador_id, planner_id, total_monto,
                    notificado_at, ai_score, ai_priority, created_at, updated_at
             FROM solicitud WHERE id=?""",
            (solicitud_id,),
        )
        row = cur.fetchone()
        if not row:
            return (
                jsonify(
                    {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
                ),
                404,
            )
        d = _row_to_dict(row, cur)

    # SEGURIDAD: Verificar ownership - solo el dueno, admin, aprobadores o planificadores pueden ver
    solicitud_owner = str(d.get("id_usuario", ""))
    if str(user_id) != solicitud_owner and not _tiene_vision_amplia(user_rol):
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
    d["archivos"] = _archivos_publicos(extra.get("archivos"))

    # Nombres de solicitante / aprobador / planificador para mostrar en la UI
    ids = {str(d.get(k)) for k in ("id_usuario", "aprobador_id", "planner_id") if d.get(k)}
    nombres = {}
    if ids:
        with get_db_connection() as conn:
            cur = conn.cursor()
            placeholders = ",".join("?" * len(ids))
            cur.execute(
                f"SELECT id_spm, nombre, apellido FROM usuario WHERE id_spm IN ({placeholders})",
                tuple(ids),
            )
            for row in cur.fetchall():
                nombres[str(row["id_spm"])] = " ".join(
                    x for x in ((row["nombre"] or "").strip(), (row["apellido"] or "").strip()) if x
                )
    d["solicitante_nombre"] = nombres.get(str(d.get("id_usuario") or ""))
    d["aprobador_nombre"] = nombres.get(str(d.get("aprobador_id") or ""))
    d["planner_nombre"] = nombres.get(str(d.get("planner_id") or ""))
    # No exponer data_json crudo (contiene rutas del servidor)
    d.pop("data_json", None)

    # FIX: Si total_monto es None o 0, recalcularlo desde los items
    if not d.get("total_monto") and d["items"]:
        d["total_monto"] = _calcular_total(d["items"])

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
        try:
            items = json.loads(items_str) if items_str else []
        except (json.JSONDecodeError, TypeError):
            return (
                jsonify({"ok": False, "error": {"code": "validation_error", "message": "items no es JSON valido"}}),
                400,
            )
        # Archivos se procesan despues de crear la solicitud
        uploaded_files = request.files.getlist("archivos")
    else:
        # JSON tradicional
        data = request.get_json(silent=True) or {}
        items = data.get("items") or []
        uploaded_files = []

    # Validar cabecera (tipos, obligatorios, criticidad, fecha, longitudes)
    if not isinstance(data, dict):
        data = {}
    error_cabecera = _validar_cabecera(data)
    if error_cabecera:
        return (
            jsonify({"ok": False, "error": {"code": "validation_error", "message": error_cabecera}}),
            400,
        )
    # SEGURIDAD: solo se puede pedir para los centros del usuario (misma regla que /auth/mi-acceso)
    centro_pedido = (data.get("centro") or "").strip()
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT rol, centros FROM usuario WHERE id_spm = ?", (str(user_id),))
        urow = cur.fetchone()
    if urow and not is_admin(urow["rol"] or ""):
        centros_usuario = [c.strip() for c in (urow["centros"] or "").split(",") if c.strip()]
        if centros_usuario and centro_pedido not in centros_usuario:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {"code": "forbidden", "message": "No tiene acceso al centro indicado"},
                    }
                ),
                403,
            )

    error_adjuntos = _validar_adjuntos(uploaded_files)
    if error_adjuntos:
        return (
            jsonify({"ok": False, "error": {"code": "validation_error", "message": error_adjuntos}}),
            400,
        )

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

    # FIX 3.1: Validar que centro y sector existan en catalogos
    centro = data.get("centro", "").strip()
    sector = data.get("sector", "").strip()

    if centro or sector:
        with get_db_connection() as conn:
            cur = conn.cursor()

            if centro:
                cur.execute(
                    "SELECT 1 FROM catalogo_centro WHERE (codigo = ? OR nombre = ?) AND activo = TRUE",
                    (centro, centro),
                )
                if not cur.fetchone():
                    return (
                        jsonify(
                            {
                                "ok": False,
                                "error": {
                                    "code": "invalid_centro",
                                    "message": f"Centro '{centro}' no existe o no esta activo",
                                },
                            }
                        ),
                        400,
                    )

            if sector:
                cur.execute(
                    "SELECT 1 FROM catalogo_sector WHERE nombre = ? AND activo = TRUE",
                    (sector,),
                )
                if not cur.fetchone():
                    return (
                        jsonify(
                            {
                                "ok": False,
                                "error": {
                                    "code": "invalid_sector",
                                    "message": f"Sector '{sector}' no existe o no esta activo",
                                },
                            }
                        ),
                        400,
                    )

    # Usar items validados y total calculado por el validador
    items_validos = [item.to_dict() for item in validacion["items"]]
    total = validacion["total"]
    now = datetime.utcnow().isoformat()

    # FIX: Procesar archivos ANTES de la transaccion para incluirlos en el INSERT
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
                    "draft",
                    total,
                    now,
                    now,
                ),
            )
            row = cur.fetchone()
            new_id = row["id"] if isinstance(row, dict) else row[0]

            # Renombrar archivos con el ID real de la solicitud (dentro de la transaccion logica)
            if archivos_guardados:
                temp_dir = Path(archivos_guardados[0]).parent
                final_dir = temp_dir.parent / str(new_id)
                try:
                    if final_dir.exists():
                        for f in temp_dir.iterdir():
                            os.replace(f, final_dir / f.name)
                        temp_dir.rmdir()
                    else:
                        os.rename(temp_dir, final_dir)
                    for meta in archivos_metadata:
                        meta["path"] = str(final_dir / meta["nombre_almacenado"])
                        meta["ruta"] = (meta.get("ruta") or "").replace(temp_prefix, str(new_id))
                        meta["solicitud_id"] = new_id
                    archivos_guardados = [m["path"] for m in archivos_metadata]
                except OSError as e:
                    logger.warning(f"No se pudieron mover los adjuntos de {temp_dir}: {e}")

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

    # Auditar creacion
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

    # Validar que el usuario sea el dueno de la solicitud o admin
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

    # Solo borradores (tambien para admin): una solicitud enviada/aprobada tiene
    # historial y movimientos de presupuesto; se cancela, no se borra.
    estado = normalizar_estado(solicitud.get("status") or "")
    if estado != "draft":
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
        # Dependencias sin ON DELETE CASCADE
        cur.execute("DELETE FROM notificacion WHERE solicitud_id=?", (solicitud_id,))
        cur.execute("DELETE FROM solicitud_historial_estado WHERE solicitud_id=?", (solicitud_id,))
        cur.execute("UPDATE mensaje SET solicitud_id=NULL WHERE solicitud_id=?", (solicitud_id,))
        cur.execute("DELETE FROM solicitud WHERE id=?", (solicitud_id,))

    # Borrar adjuntos del disco
    shutil.rmtree(_get_uploads_dir(solicitud_id), ignore_errors=True)

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

    # SEGURIDAD: Validar ownership - solo el dueno puede editar el borrador
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

    # M1: Congelar items post-aprobacion - solo borradores pueden editarse
    estado_actual = normalizar_estado(solicitud.get("status") or "")
    if estado_actual != "draft":
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "forbidden",
                        "message": "Solo se pueden editar solicitudes en estado Borrador",
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
        total = 0

    try:
        data_json_actual = json.loads(solicitud.get("data_json") or "{}")
        if not isinstance(data_json_actual, dict):
            data_json_actual = {}
    except (json.JSONDecodeError, TypeError):
        data_json_actual = {}
    data_json_actual["items"] = items_validos

    _update_solicitud(
        solicitud_id,
        {
            "data_json": json.dumps(data_json_actual),
            "total_monto": total,
            "status": "draft",
        },
    )
    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/archivos/<archivo_id>", methods=["GET"])
@require_auth
def descargar_adjunto(solicitud_id, archivo_id):
    """Descargar un adjunto de la solicitud (mismo control de acceso que el detalle)."""
    user_id = str(g.user.get("user_id", ""))
    solicitud = _get_raw(solicitud_id)
    if not solicitud:
        return jsonify({"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}), 404
    if not _puede_ver_solicitud(solicitud, user_id):
        return (
            jsonify({"ok": False, "error": {"code": "forbidden", "message": "No tiene permiso para ver esta solicitud"}}),
            403,
        )

    try:
        archivos = json.loads(solicitud.get("data_json") or "{}").get("archivos") or []
    except (json.JSONDecodeError, TypeError, AttributeError):
        archivos = []
    meta = next((a for a in archivos if isinstance(a, dict) and str(a.get("id")) == str(archivo_id)), None)
    if not meta:
        return jsonify({"ok": False, "error": {"code": "not_found", "message": "Archivo no encontrado"}}), 404

    # Resolver dentro de la carpeta de la solicitud (nunca rutas arbitrarias)
    carpeta = _get_uploads_dir(solicitud_id).resolve()
    ruta = (carpeta / secure_filename(meta.get("nombre_almacenado") or "")).resolve()
    if ruta.parent != carpeta or not ruta.is_file():
        return jsonify({"ok": False, "error": {"code": "not_found", "message": "Archivo no encontrado"}}), 404

    return send_file(ruta, as_attachment=True, download_name=meta.get("nombre") or ruta.name)


_CABECERA_TEXTO = {
    "centro": 50,
    "sector": 100,
    "justificacion": 2000,
    "centro_costos": 100,
    "almacen_virtual": 50,
    "almacen": 50,
    "criticidad": 20,
    "fecha_necesidad": 30,
}


def _validar_cabecera(data: dict) -> str:
    """Valida la cabecera de una solicitud nueva. Devuelve mensaje de error o cadena vacia."""
    for campo, maximo in _CABECERA_TEXTO.items():
        valor = data.get(campo)
        if valor is None:
            continue
        if not isinstance(valor, str):
            return f"{campo} debe ser texto"
        if len(valor) > maximo:
            return f"{campo} supera el largo maximo ({maximo})"

    if not (data.get("centro") or "").strip():
        return "centro es requerido"
    if not (data.get("sector") or "").strip():
        return "sector es requerido"

    criticidad = (data.get("criticidad") or "Normal").strip()
    if criticidad not in CRITICIDADES_VALIDAS:
        return f"criticidad debe ser una de: {', '.join(sorted(CRITICIDADES_VALIDAS))}"

    fecha = (data.get("fecha_necesidad") or "").strip()
    if fecha:
        try:
            fecha_necesidad = date.fromisoformat(fecha[:10])
        except ValueError:
            return "fecha_necesidad debe tener formato AAAA-MM-DD"
        if fecha_necesidad < datetime.utcnow().date():
            return "fecha_necesidad no puede ser anterior a hoy"
    return ""

