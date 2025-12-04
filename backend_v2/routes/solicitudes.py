"""
Solicitudes routes - SQLite-backed (demo)
"""

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

try:
    from backend_v2.core.config import settings
    from backend_v2.routes.auth import _decode_token
except ImportError:
    from core.config import settings
    from routes.auth import _decode_token

bp = Blueprint("solicitudes", __name__, url_prefix="/api/solicitudes")


def _db_path() -> Path:
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _connect():
    path = _db_path()
    return sqlite3.connect(path)


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


def _row_to_dict(row, cols):
    return {col: row[idx] for idx, col in enumerate(cols)}


@bp.route("", methods=["GET"])
def list_solicitudes():
    """Listar solicitudes (permite filtrar por usuario y estado)"""
    # Validación de paginación con límites seguros
    page = max(1, request.args.get("page", 1, type=int))
    page_size = min(max(1, request.args.get("page_size", 10, type=int)), 100)  # Máximo 100
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
        where.append("LOWER(s.status) = LOWER(?)")
        where_count.append("LOWER(status) = LOWER(?)")
        params.append(estado)

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    where_sql_count = f"WHERE {' AND '.join(where_count)}" if where_count else ""

    # Usar context manager para evitar fugas de conexión
    conn = _connect()
    try:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM solicitudes {where_sql_count}", params)
        total = cur.fetchone()[0]

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
    finally:
        conn.close()

    solicitudes_list = []
    for r in rows:
        d = dict(r)
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
    conn = _connect()
    try:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM solicitudes WHERE id=?", (solicitud_id,))
        row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return (
            jsonify(
                {"ok": False, "error": {"code": "not_found", "message": "Solicitud not found"}}
            ),
            404,
        )
    d = dict(row)
    try:
        extra = json.loads(d.get("data_json") or "{}")
    except json.JSONDecodeError:
        extra = {}
    d["items"] = extra.get("items", [])
    return jsonify({"ok": True, "solicitud": d}), 200


@bp.route("", methods=["POST"])
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

    total = _calcular_total(items)
    now = datetime.utcnow().isoformat()
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO solicitudes (id_usuario, centro, sector, justificacion, centro_costos, almacen_virtual, criticidad, fecha_necesidad, data_json, status, total_monto, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?, ?, ?)
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
            json.dumps({"items": items, "archivos": []}),
            "Borrador",
            total,
            now,
            now,
        ),
    )
    new_id = cur.lastrowid
    conn.commit()
    conn.close()

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
            conn2 = _connect()
            cur2 = conn2.cursor()
            cur2.execute("SELECT data_json FROM solicitudes WHERE id = ?", (new_id,))
            row = cur2.fetchone()
            data_json = json.loads(row[0]) if row and row[0] else {"items": [], "archivos": []}
            data_json["archivos"] = archivos_metadata
            cur2.execute(
                "UPDATE solicitudes SET data_json = ? WHERE id = ?", (json.dumps(data_json), new_id)
            )
            conn2.commit()
            conn2.close()

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

    conn = _connect()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM solicitudes WHERE id=?", (solicitud_id,))
        conn.commit()
    finally:
        conn.close()

    return jsonify({"ok": True, "message": "Solicitud eliminada correctamente"}), 200


@bp.route("/<int:solicitud_id>/draft", methods=["PATCH"])
def guardar_borrador(solicitud_id):
    """Guardar borrador con items y total"""
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    total = data.get("total_monto") or _calcular_total(items)
    _update_solicitud(
        solicitud_id,
        {
            "data_json": json.dumps({"items": items}),
            "total_monto": total,
            "status": "Borrador",
        },
    )
    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/enviar", methods=["PUT", "POST"])
def enviar_solicitud(solicitud_id):
    """Enviar solicitud para aprobación"""
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    total = data.get("total_monto") or _calcular_total(items)
    aprobador = _aprobador_por_monto(total)
    _update_solicitud(
        solicitud_id,
        {
            "data_json": json.dumps({"items": items}),
            "total_monto": total,
            "status": "Enviada",
            "aprobador_id": aprobador,
        },
    )
    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/aprobar", methods=["PUT", "POST"])
def aprobar_solicitud(solicitud_id):
    """Aprobar solicitud validando y consumiendo presupuesto"""
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

    # 3. Verificar estado valido
    estado_actual = (solicitud.get("status") or "").lower()
    if estado_actual not in ("enviada", "submitted", "pendiente"):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_state",
                        "message": f"Solicitud no puede aprobarse desde estado '{solicitud.get('status')}'",
                    },
                }
            ),
            400,
        )

    # 4. Calcular total
    items = json.loads(solicitud.get("data_json") or "{}").get("items", [])
    total = solicitud.get("total_monto") or _calcular_total(items)

    # 5. Validar y consumir presupuesto
    try:
        from backend_v2.services.budget_service import \
            aprobar_solicitud_con_presupuesto
    except ImportError:
        from services.budget_service import aprobar_solicitud_con_presupuesto

    # Obtener rol del aprobador
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT rol FROM usuarios WHERE id_spm = ?", (aprobador_id,))
    user_row = cur.fetchone()
    conn.close()
    aprobador_rol = user_row["rol"] if user_row else ""

    result = aprobar_solicitud_con_presupuesto(
        solicitud_id=solicitud_id,
        solicitud=solicitud,
        aprobador_id=aprobador_id,
        aprobador_rol=aprobador_rol,
        actor_ip=request.remote_addr or "",
    )

    if not result["ok"]:
        error_code = result.get("error_code", "budget_error")
        status_code = 400
        if error_code == "saldo_insuficiente":
            status_code = 422  # Unprocessable Entity
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

    # 6. Actualizar solicitud a Aprobada
    planificador = _planificador_para(solicitud.get("centro"), solicitud.get("sector"))
    _update_solicitud(
        solicitud_id,
        {
            "status": "Aprobada",
            "total_monto": total,
            "planner_id": planificador,
            "aprobador_id": aprobador_id,
        },
    )
    return get_solicitud(solicitud_id)


@bp.route("/<int:solicitud_id>/rechazar", methods=["PUT", "POST"])
def rechazar_solicitud(solicitud_id):
    """Rechazar solicitud"""
    data = request.get_json(silent=True) or {}
    motivo = data.get("motivo") or ""
    extra = {"motivo_rechazo": motivo}
    _update_solicitud(
        solicitud_id,
        {
            "status": "Rechazada",
            "data_json": json.dumps(extra),
        },
    )
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
    conn = _connect()
    try:
        cur = conn.cursor()
        # Verificar si existe la tabla de log
        cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='solicitud_tratamiento_log'"
        )
        if cur.fetchone():
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
            conn.commit()
    except Exception:
        pass  # Log error silently - consider proper logging in production
    finally:
        conn.close()

    return jsonify({"ok": True, "message": "Comentario agregado correctamente"}), 200


def _update_solicitud(solicitud_id: int, fields: dict):
    if not fields:
        return
    fields["updated_at"] = datetime.utcnow().isoformat()
    set_clause = ", ".join([f"{k}=?" for k in fields.keys()])
    params = list(fields.values()) + [solicitud_id]
    conn = _connect()
    cur = conn.cursor()
    cur.execute(f"UPDATE solicitudes SET {set_clause} WHERE id=?", params)
    conn.commit()
    conn.close()


def _get_raw(solicitud_id: int):
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM solicitudes WHERE id=?", (solicitud_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


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


def _aprobador_por_monto(total):
    try:
        t = float(total)
    except Exception:
        t = 0
    if t >= 50000:
        return "Gerente2"
    if t >= 20000:
        return "Gerente1"
    if t >= 5000:
        return "Jefe"
    return "Admin"


def _planificador_para(centro: str, sector: str) -> str:
    centro = (centro or "").strip()
    sector = (sector or "").strip()
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT planificador_id, centro, sector FROM planificador_asignacion")
    rows = cur.fetchall()
    conn.close()
    for r in rows:
        c = (r["centro"] or "").strip()
        s = (r["sector"] or "").strip()
        if (not centro or centro == c) and (not sector or sector == s):
            return r["planificador_id"]
    return "Admin"
