"""
Mi Cuenta routes - Gestión de perfil de usuario
Permite al usuario ver y actualizar su información personal
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime
from pathlib import Path

import bcrypt
from flask import Blueprint, jsonify, request

try:
    from backend_v2.core.config import settings
    from backend_v2.routes.auth import _decode_token
except ImportError:
    from core.config import settings
    from routes.auth import _decode_token

bp = Blueprint("mi_cuenta", __name__)
logger = logging.getLogger(__name__)


def _db_path() -> Path:
    """Obtiene la ruta a la base de datos"""
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _connect():
    """Crea conexión a la base de datos"""
    return sqlite3.connect(_db_path())


def _get_current_user_id():
    """
    Obtiene el ID del usuario autenticado desde el token JWT.
    Retorna (user_id, error_response)
    """
    payload = _decode_token("access", "spm_token")
    if isinstance(payload, tuple):
        # Es una respuesta de error
        return None, payload

    user_id = payload.get("user_id")
    if not user_id:
        return None, (jsonify({"ok": False, "error": {"message": "Token inválido"}}), 401)

    return user_id, None


def _get_user_data(user_id: str) -> dict | None:
    """Obtiene datos completos del usuario desde la BD"""
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT * FROM usuarios WHERE id_spm=?", (str(user_id),))
    row = cur.fetchone()
    conn.close()

    return dict(row) if row else None


def _parse_json_field(value: str | None) -> list:
    """Parse un campo JSON de la BD, retorna lista"""
    if not value:
        return []
    if isinstance(value, list):
        return value
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        # Si es string con comas, split
        if isinstance(value, str) and "," in value:
            return [v.strip() for v in value.split(",") if v.strip()]
        return []


@bp.route("/mi-cuenta", methods=["GET"])
def get_mi_cuenta():
    """
    Obtiene el perfil completo del usuario autenticado.

    Returns:
        200: Datos del perfil del usuario
        401: No autenticado
        404: Usuario no encontrado
    """
    # Verificar autenticación
    user_id, error = _get_current_user_id()
    if error:
        return error

    # Obtener datos del usuario
    user = _get_user_data(user_id)
    if not user:
        return jsonify({"ok": False, "error": {"message": "Usuario no encontrado"}}), 404

    # Parse campos JSON/CSV
    centros = _parse_json_field(user.get("centros"))
    almacenes = _parse_json_field(user.get("almacenes"))

    # Sector ya está almacenado como nombre textual (ej: "Mantenimiento")
    sector_nombre = user.get("sector") or "-"

    # Buscar nombres de jefe y gerentes
    def get_user_name(user_id_ref):
        if not user_id_ref:
            return "-"
        conn = _connect()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT nombre, apellido FROM usuarios WHERE id_spm=?", (user_id_ref,))
        row = cur.fetchone()
        conn.close()
        if row:
            return f"{row['nombre']} {row['apellido']}".strip()
        return user_id_ref

    jefe_nombre = get_user_name(user.get("jefe"))
    gerente1_nombre = get_user_name(user.get("gerente1"))
    gerente2_nombre = get_user_name(user.get("gerente2"))

    # Parse roles - formato CSV: "Admin, Planificador, Solicitante"
    rol_value = user.get("rol", "")
    if rol_value:
        roles_array = [r.strip() for r in rol_value.split(",") if r.strip()]
    else:
        roles_array = []

    # Rol principal para mostrar (primer rol o rol único)
    rol_principal = roles_array[0] if roles_array else ""

    # Construir respuesta
    profile = {
        "nombre_apellido": f"{user.get('nombre', '')} {user.get('apellido', '')}".strip(),
        "id_usuario_spm": user.get("id_spm", ""),
        "nombre_usuario": user.get("id_spm", ""),  # En este sistema el username es el id_spm
        "mail": user.get("mail", ""),
        "mail_respaldo": user.get("mail_respaldo", ""),
        "telefono": user.get("telefono", ""),
        "rol_spm": rol_principal,  # Rol principal para display
        "roles": roles_array,  # Array completo de roles
        "puesto": user.get("posicion", ""),
        "sector_actual": sector_nombre,
        "centros_actuales": centros,
        "almacenes_actuales": almacenes,
        "jefe_actual": jefe_nombre,
        "gerente1_actual": gerente1_nombre,
        "gerente2_actual": gerente2_nombre,
        "estado_registro": user.get("estado_registro", ""),
    }

    return jsonify(profile), 200


@bp.route("/mi-cuenta/password", methods=["PUT"])
def update_password():
    """
    Actualiza la contraseña del usuario autenticado.

    Body:
        password_nueva (str): Nueva contraseña (mín. 8 caracteres)
        password_nueva_repetida (str): Repetición de la nueva contraseña

    Returns:
        200: Contraseña actualizada
        400: Datos inválidos
        401: No autenticado
    """
    # Verificar autenticación
    user_id, error = _get_current_user_id()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    password_nueva = data.get("password_nueva", "").strip()
    password_repetida = data.get("password_nueva_repetida", "").strip()

    # Validaciones
    if not password_nueva:
        return jsonify({"ok": False, "error": {"message": "La nueva contraseña es requerida"}}), 400

    if len(password_nueva) < 8:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"message": "La contraseña debe tener al menos 8 caracteres"},
                }
            ),
            400,
        )

    if password_nueva != password_repetida:
        return jsonify({"ok": False, "error": {"message": "Las contraseñas no coinciden"}}), 400

    # Hash de la contraseña con bcrypt
    try:
        password_hash = bcrypt.hashpw(password_nueva.encode("utf-8"), bcrypt.gensalt()).decode(
            "utf-8"
        )
    except Exception as e:
        logger.error(f"Error hasheando contraseña: {e}")
        return jsonify({"ok": False, "error": {"message": "Error al procesar la contraseña"}}), 500

    # Actualizar en la BD
    try:
        conn = _connect()
        cur = conn.cursor()
        cur.execute("UPDATE usuarios SET contrasena=? WHERE id_spm=?", (password_hash, user_id))
        conn.commit()
        affected = cur.rowcount
        conn.close()

        if affected == 0:
            return jsonify({"ok": False, "error": {"message": "Usuario no encontrado"}}), 404

        logger.info(f"Contraseña actualizada para usuario {user_id}")
        return jsonify({"ok": True, "message": "Contraseña actualizada correctamente"}), 200

    except Exception as e:
        logger.error(f"Error actualizando contraseña: {e}")
        return (
            jsonify({"ok": False, "error": {"message": "Error al actualizar la contraseña"}}),
            500,
        )


@bp.route("/mi-cuenta/contacto", methods=["PUT"])
def update_contacto():
    """
    Actualiza información de contacto del usuario (teléfono, mail respaldo).

    Body:
        telefono (str, opcional): Nuevo teléfono
        mail_respaldo (str, opcional): Mail de respaldo

    Returns:
        200: Contacto actualizado
        400: Datos inválidos
        401: No autenticado
    """
    # Verificar autenticación
    user_id, error = _get_current_user_id()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    telefono = data.get("telefono", "").strip()
    mail_respaldo = data.get("mail_respaldo", "").strip()

    # Al menos uno debe estar presente
    if not telefono and not mail_respaldo:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"message": "Debe proporcionar al menos teléfono o mail de respaldo"},
                }
            ),
            400,
        )

    # Validar teléfono si se proporciona
    if telefono and len(telefono) < 6:
        return (
            jsonify({"ok": False, "error": {"message": "Teléfono inválido (mínimo 6 caracteres)"}}),
            400,
        )

    # Construir UPDATE dinámico
    updates = []
    values = []

    if telefono:
        updates.append("telefono=?")
        values.append(telefono)

    if mail_respaldo:
        updates.append("mail_respaldo=?")
        values.append(mail_respaldo)

    values.append(user_id)

    try:
        conn = _connect()

        # Verificar si existe columna mail_respaldo
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(usuarios)")
        columns = [col[1] for col in cur.fetchall()]

        # Si no existe mail_respaldo, solo actualizar teléfono
        if "mail_respaldo" not in columns and mail_respaldo:
            logger.warning("Columna mail_respaldo no existe en usuarios, se omitirá")
            updates = [u for u in updates if "mail_respaldo" not in u]
            values = [v for i, v in enumerate(values) if i == 0 or (i == len(values) - 1)]

        if not updates:
            conn.close()
            return (
                jsonify(
                    {"ok": False, "error": {"message": "No hay campos válidos para actualizar"}}
                ),
                400,
            )

        query = f"UPDATE usuarios SET {', '.join(updates)} WHERE id_spm=?"
        cur.execute(query, values)
        conn.commit()
        affected = cur.rowcount
        conn.close()

        if affected == 0:
            return jsonify({"ok": False, "error": {"message": "Usuario no encontrado"}}), 404

        logger.info(f"Contacto actualizado para usuario {user_id}")
        return (
            jsonify(
                {
                    "ok": True,
                    "message": "Información de contacto actualizada",
                    "updated": {
                        k: v for k, v in zip(["telefono", "mail_respaldo"], values[:-1]) if v
                    },
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error actualizando contacto: {e}")
        return jsonify({"ok": False, "error": {"message": f"Error al actualizar: {str(e)}"}}), 500


@bp.route("/mi-cuenta/solicitud-cambio-perfil", methods=["POST"])
def solicitar_cambio_perfil():
    """
    Registra una solicitud de cambio de perfil para aprobación administrativa.

    Body:
        sector_nuevo (str, opcional): ID del nuevo sector
        centros_nuevos (list, opcional): Lista de IDs de centros
        almacenes_nuevos (list, opcional): Lista de IDs de almacenes
        jefe_nuevo (str, opcional): ID del nuevo jefe
        gerente1_nuevo (str, opcional): ID del nuevo gerente nivel 1
        gerente2_nuevo (str, opcional): ID del nuevo gerente nivel 2

    Returns:
        200: Solicitud registrada
        400: Datos inválidos
        401: No autenticado
    """
    # Verificar autenticación
    user_id, error = _get_current_user_id()
    if error:
        return error

    data = request.get_json(silent=True) or {}

    # Validar que al menos un campo esté presente
    campos_validos = [
        "sector_nuevo",
        "centros_nuevos",
        "almacenes_nuevos",
        "jefe_nuevo",
        "gerente1_nuevo",
        "gerente2_nuevo",
    ]

    cambios = {k: v for k, v in data.items() if k in campos_validos and v}

    if not cambios:
        return (
            jsonify({"ok": False, "error": {"message": "Debe solicitar al menos un cambio"}}),
            400,
        )

    try:
        conn = _connect()
        cur = conn.cursor()

        # Guardar en tabla user_profile_requests
        payload_json = json.dumps(cambios, ensure_ascii=False)
        now = datetime.utcnow().isoformat()

        cur.execute(
            """INSERT INTO user_profile_requests
               (usuario_id, tipo, payload, estado, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (user_id, "cambio_perfil", payload_json, "pendiente", now, now),
        )

        conn.commit()
        request_id = cur.lastrowid

        # Obtener nombre del solicitante para el mensaje
        cur.execute("SELECT nombre, apellido FROM usuarios WHERE id_spm=?", (user_id,))
        solicitante = cur.fetchone()
        nombre_solicitante = f"{solicitante[0]} {solicitante[1]}" if solicitante else user_id

        # Crear notificaciones para todos los administradores
        cur.execute("SELECT id_spm FROM usuarios WHERE rol LIKE '%admin%' OR rol LIKE '%Admin%'")
        admins = cur.fetchall()

        mensaje = f"Nueva solicitud de cambio de perfil de {nombre_solicitante}. Campos: {', '.join(cambios.keys())}"

        for admin in admins:
            admin_id = admin[0]
            cur.execute(
                """INSERT INTO notificaciones (destinatario_id, solicitud_id, mensaje, leido, created_at)
                   VALUES (?, ?, ?, 0, ?)""",
                (admin_id, request_id, mensaje, now),
            )

        conn.commit()
        conn.close()

        logger.info(
            f"Solicitud de cambio de perfil registrada: {request_id} para usuario {user_id}. Notificados {len(admins)} admin(s)"
        )

        return (
            jsonify(
                {
                    "ok": True,
                    "message": "Solicitud registrada. Será revisada por un administrador",
                    "id": request_id,
                    "campos_solicitados": list(cambios.keys()),
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error registrando solicitud de cambio: {e}")
        return (
            jsonify({"ok": False, "error": {"message": f"Error al registrar solicitud: {str(e)}"}}),
            500,
        )


@bp.route("/mi-cuenta/solicitudes-cambio-perfil", methods=["GET"])
def listar_cambios_perfil():
    """
    Lista las solicitudes de cambio de perfil del usuario autenticado.

    Returns:
        200: Lista de solicitudes
        401: No autenticado
    """
    # Verificar autenticación
    user_id, error = _get_current_user_id()
    if error:
        return error

    try:
        conn = _connect()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute(
            """SELECT id, tipo, payload, estado, created_at, updated_at
               FROM user_profile_requests
               WHERE usuario_id=?
               ORDER BY created_at DESC
               LIMIT 50""",
            (user_id,),
        )

        rows = cur.fetchall()
        conn.close()

        # Formatear respuesta
        solicitudes = []
        for row in rows:
            row_dict = dict(row)

            # Parse payload JSON
            try:
                payload = json.loads(row_dict.get("payload", "{}"))
            except (json.JSONDecodeError, TypeError):
                payload = {}

            # Extraer campos modificados
            campos = list(payload.keys())

            # Formatear fecha
            fecha_str = row_dict.get("created_at", "")
            try:
                if "T" in fecha_str:
                    fecha_dt = datetime.fromisoformat(fecha_str.replace("Z", ""))
                    fecha_formateada = fecha_dt.strftime("%d/%m/%Y %H:%M")
                else:
                    fecha_formateada = fecha_str
            except:
                fecha_formateada = fecha_str

            solicitudes.append(
                {
                    "id": row_dict.get("id"),
                    "fecha": fecha_formateada,
                    "campos": campos,
                    "estado": row_dict.get("estado", "pendiente"),
                    "comentario": "",  # TODO: agregar campo comentario a la tabla si se necesita
                    "detalles": payload,
                }
            )

        return jsonify(solicitudes), 200

    except Exception as e:
        logger.error(f"Error listando solicitudes de cambio: {e}")
        return jsonify([]), 200  # Devolver lista vacía en caso de error para no romper el frontend


# ============================================================================


@bp.route("/mi-cuenta/solicitudes-cambio-perfil/<int:request_id>/cancelar", methods=["POST"])
def cancelar_solicitud_cambio(request_id: int):
    """
    Cancela una solicitud de cambio de perfil pendiente.

    Returns:
        200: Solicitud cancelada
        400: La solicitud no puede ser cancelada (ya fue procesada)
        401: No autenticado
        403: No autorizado (la solicitud no pertenece al usuario)
        404: Solicitud no encontrada
    """
    user_id, error = _get_current_user_id()
    if error:
        return error

    try:
        conn = _connect()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Verificar que la solicitud existe y pertenece al usuario
        cur.execute("SELECT * FROM user_profile_requests WHERE id=?", (request_id,))
        req = cur.fetchone()

        if not req:
            conn.close()
            return jsonify({"ok": False, "error": {"message": "Solicitud no encontrada"}}), 404

        if req["usuario_id"] != user_id:
            conn.close()
            return jsonify({"ok": False, "error": {"message": "No autorizado"}}), 403

        if req["estado"] != "pendiente":
            conn.close()
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {"message": "Solo se pueden cancelar solicitudes pendientes"},
                    }
                ),
                400,
            )

        # Cancelar la solicitud
        now = datetime.utcnow().isoformat()
        cur.execute(
            "UPDATE user_profile_requests SET estado=?, updated_at=? WHERE id=?",
            ("cancelado", now, request_id),
        )

        conn.commit()
        conn.close()

        logger.info(f"Solicitud de perfil {request_id} cancelada por usuario {user_id}")

        return jsonify({"ok": True, "message": "Solicitud cancelada correctamente"}), 200

    except Exception as e:
        logger.error(f"Error cancelando solicitud: {e}")
        return jsonify({"ok": False, "error": {"message": str(e)}}), 500


@bp.route("/mi-cuenta/solicitudes-cambio-perfil/<int:request_id>/mensaje", methods=["POST"])
def enviar_mensaje_solicitud(request_id: int):
    """
    Envía un mensaje al admin sobre una solicitud de cambio de perfil.

    Body:
        mensaje (str, requerido): Contenido del mensaje

    Returns:
        200: Mensaje enviado
        400: Datos inválidos
        401: No autenticado
        403: No autorizado (la solicitud no pertenece al usuario)
        404: Solicitud no encontrada
    """
    user_id, error = _get_current_user_id()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    mensaje = data.get("mensaje", "").strip()

    if not mensaje:
        return jsonify({"ok": False, "error": {"message": "Debe proporcionar un mensaje"}}), 400

    try:
        conn = _connect()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Verificar que la solicitud existe y pertenece al usuario
        cur.execute("SELECT * FROM user_profile_requests WHERE id=?", (request_id,))
        req = cur.fetchone()

        if not req:
            conn.close()
            return jsonify({"ok": False, "error": {"message": "Solicitud no encontrada"}}), 404

        if req["usuario_id"] != user_id:
            conn.close()
            return jsonify({"ok": False, "error": {"message": "No autorizado"}}), 403

        # Obtener el primer admin disponible (o todos)
        cur.execute(
            "SELECT id_spm FROM usuarios WHERE rol LIKE '%admin%' OR rol LIKE '%Admin%' LIMIT 1"
        )
        admin = cur.fetchone()

        if not admin:
            conn.close()
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "message": "No se encontró un administrador para enviar el mensaje"
                        },
                    }
                ),
                500,
            )

        destinatario_id = admin["id_spm"]
        now = datetime.utcnow().isoformat()

        # Crear mensaje en la tabla mensajes
        asunto = f"Consulta sobre solicitud de cambio de perfil #{request_id}"

        cur.execute(
            """INSERT INTO mensajes (remitente_id, destinatario_id, asunto, mensaje, leido, created_at)
               VALUES (?, ?, ?, ?, 0, ?)""",
            (user_id, destinatario_id, asunto, mensaje, now),
        )

        conn.commit()
        mensaje_id = cur.lastrowid
        conn.close()

        logger.info(f"Usuario {user_id} envió mensaje al admin sobre solicitud {request_id}")

        return (
            jsonify(
                {
                    "ok": True,
                    "message": "Mensaje enviado al administrador",
                    "mensaje_id": mensaje_id,
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error enviando mensaje: {e}")
        return jsonify({"ok": False, "error": {"message": str(e)}}), 500


# ENDPOINTS DE ADMINISTRACIÓN - Gestión de solicitudes de cambio de perfil
# ============================================================================


def _is_admin(user_id: str) -> bool:
    """Verifica si el usuario es administrador"""
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT rol FROM usuarios WHERE id_spm=?", (user_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return False

    # Roles en formato CSV: "Admin, Planificador, Solicitante"
    rol = row["rol"] or ""
    roles = [r.strip().lower() for r in rol.split(",") if r.strip()]

    return any(r in ("admin", "administrador") for r in roles)


@bp.route("/mi-cuenta/admin/profile-requests", methods=["GET"])
def admin_listar_profile_requests():
    """
    Lista todas las solicitudes de cambio de perfil (solo admins).

    Query params:
        estado: filtrar por estado (pendiente, aprobado, rechazado)

    Returns:
        200: Lista de solicitudes con datos del solicitante
        401: No autenticado
        403: No autorizado
    """
    user_id, error = _get_current_user_id()
    if error:
        return error

    if not _is_admin(user_id):
        return jsonify({"ok": False, "error": {"message": "No autorizado"}}), 403

    estado_filter = request.args.get("estado", "")

    try:
        conn = _connect()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        query = """
            SELECT
                upr.id, upr.usuario_id, upr.tipo, upr.payload,
                upr.estado, upr.created_at, upr.updated_at,
                u.nombre, u.apellido, u.mail, u.posicion, u.sector
            FROM user_profile_requests upr
            JOIN usuarios u ON upr.usuario_id = u.id_spm
        """
        params = []

        if estado_filter:
            query += " WHERE upr.estado = ?"
            params.append(estado_filter)

        query += " ORDER BY upr.created_at DESC LIMIT 100"

        cur.execute(query, params)
        rows = cur.fetchall()
        conn.close()

        requests = []
        for row in rows:
            row_dict = dict(row)

            # Parse payload
            try:
                payload = json.loads(row_dict.get("payload", "{}"))
            except:
                payload = {}

            requests.append(
                {
                    "id": row_dict.get("id"),
                    "usuario_id": row_dict.get("usuario_id"),
                    "solicitante": {
                        "nombre": f"{row_dict.get('nombre', '')} {row_dict.get('apellido', '')}".strip(),
                        "mail": row_dict.get("mail", ""),
                        "posicion": row_dict.get("posicion", ""),
                        "sector": row_dict.get("sector", ""),
                    },
                    "tipo": row_dict.get("tipo"),
                    "cambios_solicitados": payload,
                    "estado": row_dict.get("estado"),
                    "created_at": row_dict.get("created_at"),
                    "updated_at": row_dict.get("updated_at"),
                }
            )

        return jsonify({"ok": True, "requests": requests}), 200

    except Exception as e:
        logger.error(f"Error listando profile requests: {e}")
        return jsonify({"ok": False, "error": {"message": str(e)}}), 500


@bp.route("/mi-cuenta/admin/profile-requests/<int:request_id>", methods=["GET"])
def admin_get_profile_request(request_id: int):
    """
    Obtiene detalle de una solicitud de cambio de perfil.
    """
    user_id, error = _get_current_user_id()
    if error:
        return error

    if not _is_admin(user_id):
        return jsonify({"ok": False, "error": {"message": "No autorizado"}}), 403

    try:
        conn = _connect()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                upr.*, u.nombre, u.apellido, u.mail, u.posicion, u.sector,
                u.centros, u.almacenes, u.jefe, u.gerente1, u.gerente2
            FROM user_profile_requests upr
            JOIN usuarios u ON upr.usuario_id = u.id_spm
            WHERE upr.id = ?
        """,
            (request_id,),
        )

        row = cur.fetchone()
        conn.close()

        if not row:
            return jsonify({"ok": False, "error": {"message": "Solicitud no encontrada"}}), 404

        row_dict = dict(row)

        # Parse payload
        try:
            payload = json.loads(row_dict.get("payload", "{}"))
        except:
            payload = {}

        # Obtener valores actuales vs solicitados
        current_values = {}
        requested_values = {}

        field_mapping = {
            "sector_nuevo": "sector",
            "centros_nuevos": "centros",
            "almacenes_nuevos": "almacenes",
            "jefe_nuevo": "jefe",
            "gerente1_nuevo": "gerente1",
            "gerente2_nuevo": "gerente2",
        }

        for key, db_field in field_mapping.items():
            if key in payload:
                current_val = row_dict.get(db_field, "")
                # Parse JSON si es necesario
                if isinstance(current_val, str) and current_val.startswith("["):
                    try:
                        current_val = json.loads(current_val)
                    except:
                        pass
                current_values[db_field] = current_val
                requested_values[db_field] = payload[key]

        result = {
            "id": row_dict.get("id"),
            "usuario_id": row_dict.get("usuario_id"),
            "solicitante": {
                "nombre": f"{row_dict.get('nombre', '')} {row_dict.get('apellido', '')}".strip(),
                "mail": row_dict.get("mail", ""),
                "posicion": row_dict.get("posicion", ""),
                "sector": row_dict.get("sector", ""),
            },
            "estado": row_dict.get("estado"),
            "created_at": row_dict.get("created_at"),
            "current_values": current_values,
            "requested_values": requested_values,
            "raw_payload": payload,
        }

        return jsonify({"ok": True, "request": result}), 200

    except Exception as e:
        logger.error(f"Error obteniendo profile request: {e}")
        return jsonify({"ok": False, "error": {"message": str(e)}}), 500


@bp.route("/mi-cuenta/admin/profile-requests/<int:request_id>/aprobar", methods=["POST"])
def admin_aprobar_profile_request(request_id: int):
    """
    Aprueba una solicitud de cambio de perfil y aplica los cambios.

    Body:
        comentario (str, opcional): Comentario de aprobación
    """
    user_id, error = _get_current_user_id()
    if error:
        return error

    if not _is_admin(user_id):
        return jsonify({"ok": False, "error": {"message": "No autorizado"}}), 403

    data = request.get_json(silent=True) or {}
    comentario = data.get("comentario", "")

    try:
        conn = _connect()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Obtener la solicitud
        cur.execute("SELECT * FROM user_profile_requests WHERE id=?", (request_id,))
        req = cur.fetchone()

        if not req:
            conn.close()
            return jsonify({"ok": False, "error": {"message": "Solicitud no encontrada"}}), 404

        if req["estado"] != "pendiente":
            conn.close()
            return (
                jsonify({"ok": False, "error": {"message": "La solicitud ya fue procesada"}}),
                400,
            )

        # Parse payload y aplicar cambios
        try:
            payload = json.loads(req["payload"])
        except:
            payload = {}

        usuario_id = req["usuario_id"]
        now = datetime.utcnow().isoformat()

        # Obtener datos actuales del usuario para poder AGREGAR centros/almacenes
        cur.execute("SELECT centros, almacenes FROM usuarios WHERE id_spm=?", (usuario_id,))
        usuario_actual = cur.fetchone()
        centros_actuales = _parse_json_field(usuario_actual["centros"] if usuario_actual else None)
        almacenes_actuales = _parse_json_field(
            usuario_actual["almacenes"] if usuario_actual else None
        )

        # Mapeo de campos del payload a columnas de la BD
        updates = []
        values = []

        # Campos que simplemente se reemplazan
        simple_fields = {
            "sector_nuevo": "sector",
            "jefe_nuevo": "jefe",
            "gerente1_nuevo": "gerente1",
            "gerente2_nuevo": "gerente2",
        }

        for payload_key, db_column in simple_fields.items():
            if payload_key in payload and payload[payload_key]:
                updates.append(f"{db_column}=?")
                values.append(payload[payload_key])

        # Campos que se AGREGAN a los existentes (centros y almacenes)
        if "centros_nuevos" in payload and payload["centros_nuevos"]:
            nuevos_centros = payload["centros_nuevos"]
            if isinstance(nuevos_centros, list):
                # Combinar existentes + nuevos, eliminando duplicados
                todos_centros = list(set(centros_actuales + nuevos_centros))
                # Guardar como CSV (consistente con admin.py)
                updates.append("centros=?")
                values.append(",".join(str(c) for c in todos_centros))

        if "almacenes_nuevos" in payload and payload["almacenes_nuevos"]:
            nuevos_almacenes = payload["almacenes_nuevos"]
            if isinstance(nuevos_almacenes, list):
                # Combinar existentes + nuevos, eliminando duplicados
                todos_almacenes = list(set(almacenes_actuales + nuevos_almacenes))
                # Guardar como CSV (consistente con admin.py)
                updates.append("almacenes=?")
                values.append(",".join(str(a) for a in todos_almacenes))

        # Aplicar cambios al usuario
        if updates:
            values.append(usuario_id)
            update_query = f"UPDATE usuarios SET {', '.join(updates)} WHERE id_spm=?"
            cur.execute(update_query, values)
            logger.info(f"Cambios aplicados a usuario {usuario_id}: {updates}")

        # Actualizar estado de la solicitud
        cur.execute(
            "UPDATE user_profile_requests SET estado=?, updated_at=? WHERE id=?",
            ("aprobado", now, request_id),
        )

        # Crear notificación para el solicitante
        mensaje = f"Tu solicitud de cambio de perfil #{request_id} ha sido aprobada"
        if comentario:
            mensaje += f": {comentario}"

        cur.execute(
            """INSERT INTO notificaciones (destinatario_id, solicitud_id, mensaje, tipo, leido, created_at)
               VALUES (?, ?, ?, ?, 0, ?)""",
            (usuario_id, request_id, mensaje, "profile_approved", now),
        )

        conn.commit()
        conn.close()

        logger.info(f"Solicitud de perfil {request_id} aprobada por {user_id}")

        return (
            jsonify(
                {
                    "ok": True,
                    "message": "Solicitud aprobada y cambios aplicados",
                    "campos_actualizados": list(payload.keys()),
                }
            ),
            200,
        )

    except Exception as e:
        logger.error(f"Error aprobando profile request: {e}")
        return jsonify({"ok": False, "error": {"message": str(e)}}), 500


@bp.route("/mi-cuenta/admin/profile-requests/<int:request_id>/rechazar", methods=["POST"])
def admin_rechazar_profile_request(request_id: int):
    """
    Rechaza una solicitud de cambio de perfil.

    Body:
        motivo (str, requerido): Motivo del rechazo
    """
    user_id, error = _get_current_user_id()
    if error:
        return error

    if not _is_admin(user_id):
        return jsonify({"ok": False, "error": {"message": "No autorizado"}}), 403

    data = request.get_json(silent=True) or {}
    motivo = data.get("motivo", "").strip()

    if not motivo:
        return (
            jsonify({"ok": False, "error": {"message": "Debe proporcionar un motivo de rechazo"}}),
            400,
        )

    try:
        conn = _connect()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Obtener la solicitud
        cur.execute("SELECT * FROM user_profile_requests WHERE id=?", (request_id,))
        req = cur.fetchone()

        if not req:
            conn.close()
            return jsonify({"ok": False, "error": {"message": "Solicitud no encontrada"}}), 404

        if req["estado"] != "pendiente":
            conn.close()
            return (
                jsonify({"ok": False, "error": {"message": "La solicitud ya fue procesada"}}),
                400,
            )

        usuario_id = req["usuario_id"]
        now = datetime.utcnow().isoformat()

        # Actualizar estado
        cur.execute(
            "UPDATE user_profile_requests SET estado=?, updated_at=? WHERE id=?",
            ("rechazado", now, request_id),
        )

        # Crear notificación para el solicitante
        mensaje = f"Tu solicitud de cambio de perfil #{request_id} ha sido rechazada: {motivo}"

        cur.execute(
            """INSERT INTO notificaciones (destinatario_id, solicitud_id, mensaje, tipo, leido, created_at)
               VALUES (?, ?, ?, ?, 0, ?)""",
            (usuario_id, request_id, mensaje, "profile_rejected", now),
        )

        conn.commit()
        conn.close()

        logger.info(f"Solicitud de perfil {request_id} rechazada por {user_id}: {motivo}")

        return jsonify({"ok": True, "message": "Solicitud rechazada"}), 200

    except Exception as e:
        logger.error(f"Error rechazando profile request: {e}")
        return jsonify({"ok": False, "error": {"message": str(e)}}), 500


@bp.route("/mi-cuenta/admin/profile-requests/<int:request_id>/mensaje", methods=["POST"])
def admin_enviar_mensaje_profile_request(request_id: int):
    """
    Envía un mensaje al solicitante sobre su solicitud de cambio de perfil.

    Body:
        mensaje (str, requerido): Contenido del mensaje
    """
    user_id, error = _get_current_user_id()
    if error:
        return error

    if not _is_admin(user_id):
        return jsonify({"ok": False, "error": {"message": "No autorizado"}}), 403

    data = request.get_json(silent=True) or {}
    mensaje = data.get("mensaje", "").strip()

    if not mensaje:
        return jsonify({"ok": False, "error": {"message": "Debe proporcionar un mensaje"}}), 400

    try:
        conn = _connect()
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Obtener la solicitud y datos del solicitante
        cur.execute(
            """
            SELECT upr.*, u.nombre, u.apellido
            FROM user_profile_requests upr
            JOIN usuarios u ON upr.usuario_id = u.id_spm
            WHERE upr.id = ?
        """,
            (request_id,),
        )
        req = cur.fetchone()

        if not req:
            conn.close()
            return jsonify({"ok": False, "error": {"message": "Solicitud no encontrada"}}), 404

        destinatario_id = req["usuario_id"]
        now = datetime.utcnow().isoformat()

        # Crear mensaje en la tabla mensajes
        asunto = f"Sobre tu solicitud de cambio de perfil #{request_id}"

        cur.execute(
            """INSERT INTO mensajes (remitente_id, destinatario_id, asunto, mensaje, leido, created_at)
               VALUES (?, ?, ?, ?, 0, ?)""",
            (user_id, destinatario_id, asunto, mensaje, now),
        )

        conn.commit()
        mensaje_id = cur.lastrowid
        conn.close()

        logger.info(f"Mensaje enviado a {destinatario_id} sobre solicitud {request_id}")

        return jsonify({"ok": True, "message": "Mensaje enviado", "mensaje_id": mensaje_id}), 200

    except Exception as e:
        logger.error(f"Error enviando mensaje: {e}")
        return jsonify({"ok": False, "error": {"message": str(e)}}), 500
