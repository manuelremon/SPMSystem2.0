"""
Mi Cuenta routes - Gestión de perfil de usuario
Permite al usuario ver y actualizar su información personal
"""

from __future__ import annotations

import json
import logging
from datetime import datetime

import bcrypt
from flask import Blueprint, g, jsonify, request

from backend.core.db import get_db_connection, get_db_transaction, insert_returning_id
from backend.core.rate_limit import rate_limit
from backend.core.roles import normalize_roles, require_admin, require_auth
from backend.core.user_helpers import get_user_by_id, get_user_name
from backend.services.notification_service import NotificationService

bp = Blueprint("mi_cuenta", __name__)
logger = logging.getLogger(__name__)


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
@require_auth
def get_mi_cuenta():
    """
    Obtiene el perfil completo del usuario autenticado.

    Returns:
        200: Datos del perfil del usuario
        401: No autenticado
        404: Usuario no encontrado
    """
    user_id = g.user.get("user_id")

    # Obtener datos del usuario
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({"ok": False, "error": {"message": "Usuario no encontrado"}}), 404

    # Parse campos JSON/CSV
    centros = _parse_json_field(user.get("centros"))
    almacenes = _parse_json_field(user.get("almacenes"))

    # Sector ya está almacenado como nombre textual (ej: "Mantenimiento")
    sector_nombre = user.get("sector") or "-"

    # Buscar nombres de jefe y gerentes (usa get_user_name centralizado)
    def _resolve_name(user_id_ref):
        if not user_id_ref:
            return "-"
        name = get_user_name(user_id_ref)
        return name if name != str(user_id_ref) else user_id_ref

    jefe_nombre = _resolve_name(user.get("jefe"))
    gerente1_nombre = _resolve_name(user.get("gerente1"))
    gerente2_nombre = _resolve_name(user.get("gerente2"))

    # Parse roles usando módulo centralizado
    roles_array = normalize_roles(user.get("rol", ""))

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
@require_auth
@rate_limit(requests=5, window_seconds=300)  # 5 intentos cada 5 minutos (prevenir fuerza bruta)
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
    user_id = g.user.get("user_id")

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
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute("UPDATE usuario SET contrasena=%s WHERE id_spm=%s", (password_hash, user_id))
            affected = cur.rowcount

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
@require_auth
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
    user_id = g.user.get("user_id")

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
        updates.append("telefono=%s")
        values.append(telefono)

    if mail_respaldo:
        updates.append("mail_respaldo=%s")
        values.append(mail_respaldo)

    values.append(user_id)

    try:
        with get_db_transaction() as conn:
            cur = conn.cursor()
            query = f"UPDATE usuario SET {', '.join(updates)} WHERE id_spm=%s"
            cur.execute(query, values)
            affected = cur.rowcount

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
@require_auth
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
    user_id = g.user.get("user_id")

    data = request.get_json(silent=True) or {}

    # Validar que al menos un campo esté presente
    campos_validos = [
        "sector_nuevo",
        "centros_nuevos",
        "almacenes_nuevos",
        "jefe_nuevo",
        "gerente1_nuevo",
        "gerente2_nuevo",
        "rol_solicitado",
        "justificacion",
    ]

    cambios = {k: v for k, v in data.items() if k in campos_validos and v}

    if not cambios:
        return (
            jsonify({"ok": False, "error": {"message": "Debe solicitar al menos un cambio"}}),
            400,
        )

    try:
        payload_json = json.dumps(cambios, ensure_ascii=False)
        now = datetime.utcnow().isoformat()

        with get_db_transaction() as conn:
            cur = conn.cursor()
            request_id = insert_returning_id(
                cur,
                """INSERT INTO usuario_solicitud_perfil
                   (usuario_id, tipo, payload, estado, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (user_id, "cambio_perfil", payload_json, "pendiente", now, now),
            )

            cur.execute("SELECT nombre, apellido FROM usuario WHERE id_spm=%s", (user_id,))
            solicitante = cur.fetchone()
            nombre_solicitante = f"{solicitante[0]} {solicitante[1]}" if solicitante else user_id

            cur.execute(
                "SELECT id_spm FROM usuario WHERE rol LIKE '%admin%' OR rol LIKE '%Admin%'"
            )
            admins = cur.fetchall()

            mensaje = f"Nueva solicitud de cambio de perfil de {nombre_solicitante}. Campos: {', '.join(cambios.keys())}"

            for admin in admins:
                admin_id = admin[0]
                cur.execute(
                    """INSERT INTO notificacion (destinatario_id, solicitud_id, mensaje, leido, created_at)
                       VALUES (%s, %s, %s, 0, %s)""",
                    (admin_id, request_id, mensaje, now),
                )

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
@require_auth
def listar_cambios_perfil():
    """
    Lista las solicitudes de cambio de perfil del usuario autenticado.

    Returns:
        200: Lista de solicitudes
        401: No autenticado
    """
    user_id = g.user.get("user_id")

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """SELECT id, tipo, payload, estado, created_at, updated_at
                   FROM usuario_solicitud_perfil
                   WHERE usuario_id=%s
                   ORDER BY created_at DESC
                   LIMIT 50""",
                (user_id,),
            )
            rows = cur.fetchall()

        # Formatear respuesta
        solicitudes = []
        for row in rows:
            row_dict = dict(row)

            # Parse payload JSON (column renamed from valor_nuevo to payload)
            try:
                payload = json.loads(row_dict.get("payload", "{}"))
            except (json.JSONDecodeError, TypeError):
                payload = {}

            # Extraer campos modificados
            campos = list(payload.keys())

            # Formatear fecha
            fecha_str = row_dict.get("created_at", "")
            try:
                fecha_str_s = str(fecha_str) if fecha_str else ""
                if "T" in fecha_str_s:
                    fecha_dt = datetime.fromisoformat(fecha_str_s.replace("Z", ""))
                    fecha_formateada = fecha_dt.strftime("%d/%m/%Y %H:%M")
                else:
                    fecha_formateada = fecha_str_s
            except (ValueError, TypeError):
                fecha_formateada = str(fecha_str) if fecha_str else ""

            solicitudes.append(
                {
                    "id": row_dict.get("id"),
                    "fecha": fecha_formateada,
                    "campos": campos,
                    "estado": row_dict.get("estado", "pendiente"),
                    "comentario": "",
                    "detalles": payload,
                }
            )

        return jsonify(solicitudes), 200

    except Exception as e:
        logger.error(f"Error listando solicitudes de cambio: {e}")
        return jsonify([]), 200  # Devolver lista vacía en caso de error para no romper el frontend


# ============================================================================


@bp.route("/mi-cuenta/solicitudes-cambio-perfil/<int:request_id>/cancelar", methods=["POST"])
@require_auth
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
    user_id = g.user.get("user_id")

    try:
        # Verificar que la solicitud existe y pertenece al usuario
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM usuario_solicitud_perfil WHERE id=%s", (request_id,))
            req = cur.fetchone()

        if not req:
            return jsonify({"ok": False, "error": {"message": "Solicitud no encontrada"}}), 404

        if req["usuario_id"] != user_id:
            return jsonify({"ok": False, "error": {"message": "No autorizado"}}), 403

        if req["estado"] != "pendiente":
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
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE usuario_solicitud_perfil SET estado=%s, updated_at=%s WHERE id=%s",
                ("cancelado", now, request_id),
            )

        logger.info(f"Solicitud de perfil {request_id} cancelada por usuario {user_id}")

        return jsonify({"ok": True, "message": "Solicitud cancelada correctamente"}), 200

    except Exception as e:
        logger.error(f"Error cancelando solicitud: {e}")
        return jsonify({"ok": False, "error": {"message": str(e)}}), 500


@bp.route("/mi-cuenta/solicitudes-cambio-perfil/<int:request_id>/mensaje", methods=["POST"])
@require_auth
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
    user_id = g.user.get("user_id")

    data = request.get_json(silent=True) or {}
    mensaje = data.get("mensaje", "").strip()

    if not mensaje:
        return jsonify({"ok": False, "error": {"message": "Debe proporcionar un mensaje"}}), 400

    try:
        # Verificar que la solicitud existe y pertenece al usuario
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM usuario_solicitud_perfil WHERE id=%s", (request_id,))
            req = cur.fetchone()

            if not req:
                return jsonify({"ok": False, "error": {"message": "Solicitud no encontrada"}}), 404

            if req["usuario_id"] != user_id:
                return jsonify({"ok": False, "error": {"message": "No autorizado"}}), 403

            # Obtener el primer admin disponible
            cur.execute(
                "SELECT id_spm FROM usuario WHERE rol LIKE '%admin%' OR rol LIKE '%Admin%' LIMIT 1"
            )
            admin = cur.fetchone()

        if not admin:
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
        asunto = f"Consulta sobre solicitud de cambio de perfil #{request_id}"

        # Crear mensaje en la tabla mensajes
        with get_db_transaction() as conn:
            cur = conn.cursor()
            mensaje_id = insert_returning_id(
                cur,
                """INSERT INTO mensaje (remitente_id, destinatario_id, asunto, mensaje, leido, created_at)
                   VALUES (%s, %s, %s, %s, 0, %s)""",
                (user_id, destinatario_id, asunto, mensaje, now),
            )

            # Obtener nombre del remitente para la notificación
            cur.execute("SELECT nombre, apellido FROM usuario WHERE id_spm=%s", (user_id,))
            remitente = cur.fetchone()
            nombre_remitente = f"{remitente[0]} {remitente[1]}" if remitente else user_id

        # Crear notificación para el admin
        NotificationService.create_notification(
            destinatario_id=destinatario_id,
            mensaje=f"Nuevo mensaje de {nombre_remitente}: {asunto}",
            tipo="mensaje_nuevo",
            solicitud_id=request_id,
        )

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


@bp.route("/mi-cuenta/admin/profile-requests", methods=["GET"])
@require_admin
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
    estado_filter = request.args.get("estado", "")

    try:
        query = """
            SELECT
                upr.id, upr.usuario_id, upr.tipo, upr.payload,
                upr.estado, upr.created_at, upr.updated_at,
                u.nombre, u.apellido, u.mail, u.posicion, u.sector
            FROM usuario_solicitud_perfil upr
            JOIN usuario u ON upr.usuario_id = u.id_spm
        """
        params = []

        if estado_filter:
            query += " WHERE upr.estado = %s"
            params.append(estado_filter)

        query += " ORDER BY upr.created_at DESC LIMIT 100"

        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(query, params)
            rows = cur.fetchall()

        requests = []
        for row in rows:
            row_dict = dict(row)

            # Parse payload JSON
            payload_raw = row_dict.get("payload", "")
            tipo = row_dict.get("tipo", "")
            try:
                payload = json.loads(payload_raw) if payload_raw else {}
            except (json.JSONDecodeError, TypeError):
                payload = {tipo: payload_raw} if tipo else {}

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
                    "tipo": tipo,
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
@require_admin
def admin_get_profile_request(request_id: int):
    """
    Obtiene detalle de una solicitud de cambio de perfil.
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT
                    upr.*, u.nombre, u.apellido, u.mail, u.posicion, u.sector,
                    u.centros, u.almacenes, u.jefe, u.gerente1, u.gerente2
                FROM usuario_solicitud_perfil upr
                JOIN usuario u ON upr.usuario_id = u.id_spm
                WHERE upr.id = %s
            """,
                (request_id,),
            )
            row = cur.fetchone()

        if not row:
            return jsonify({"ok": False, "error": {"message": "Solicitud no encontrada"}}), 404

        row_dict = dict(row)

        # Parse payload JSON (columns are tipo and payload, not tipo_cambio/valor_nuevo)
        tipo = row_dict.get("tipo", "")
        payload_raw = row_dict.get("payload", "")
        try:
            payload = json.loads(payload_raw) if payload_raw else {}
        except (json.JSONDecodeError, TypeError):
            payload = {tipo: payload_raw} if tipo else {}

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
            "sector": "sector",
            "centros": "centros",
            "almacenes": "almacenes",
            "rol": "rol",
        }

        for key, db_field in field_mapping.items():
            if key in payload or key == tipo:
                current_val = row_dict.get(db_field, "")
                # Parse JSON si es necesario
                if isinstance(current_val, str) and current_val.startswith("["):
                    try:
                        current_val = json.loads(current_val)
                    except (json.JSONDecodeError, TypeError):
                        pass
                current_values[db_field] = current_val
                requested_values[db_field] = payload.get(key)

        result = {
            "id": row_dict.get("id"),
            "usuario_id": row_dict.get("usuario_id"),
            "solicitante": {
                "nombre": f"{row_dict.get('nombre', '')} {row_dict.get('apellido', '')}".strip(),
                "mail": row_dict.get("mail", ""),
                "posicion": row_dict.get("posicion", ""),
                "sector": row_dict.get("sector", ""),
            },
            "tipo": tipo,
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
@require_admin
def admin_aprobar_profile_request(request_id: int):
    """
    Aprueba una solicitud de cambio de perfil y aplica los cambios.

    Body:
        comentario (str, opcional): Comentario de aprobación
    """
    data = request.get_json(silent=True) or {}
    comentario = data.get("comentario", "")

    try:
        # Fase 1: Lecturas para validación y obtener datos necesarios
        with get_db_connection() as conn:
            cur = conn.cursor()

            # Obtener la solicitud
            cur.execute("SELECT * FROM usuario_solicitud_perfil WHERE id=%s", (request_id,))
            req = cur.fetchone()

            if not req:
                return jsonify({"ok": False, "error": {"message": "Solicitud no encontrada"}}), 404

            if req["estado"] != "pendiente":
                return (
                    jsonify({"ok": False, "error": {"message": "La solicitud ya fue procesada"}}),
                    400,
                )

            usuario_id = req["usuario_id"]

            # Obtener datos actuales del usuario para poder AGREGAR centros/almacenes
            cur.execute("SELECT centros, almacenes FROM usuario WHERE id_spm=%s", (usuario_id,))
            usuario_actual = cur.fetchone()

        # Parse payload y preparar cambios (column is now 'payload', not 'valor_nuevo')
        try:
            payload = json.loads(req["payload"])
        except (json.JSONDecodeError, TypeError):
            payload = {}

        centros_actuales = _parse_json_field(usuario_actual["centros"] if usuario_actual else None)
        almacenes_actuales = _parse_json_field(
            usuario_actual["almacenes"] if usuario_actual else None
        )
        now = datetime.utcnow().isoformat()

        # Mapeo de campos del payload a columnas de la BD
        updates = []
        values = []

        # Campos que simplemente se reemplazan
        simple_fields = {
            "sector_nuevo": "sector",
            "jefe_nuevo": "jefe",
            "gerente1_nuevo": "gerente1",
            "gerente2_nuevo": "gerente2",
            "rol_solicitado": "rol",
        }

        for payload_key, db_column in simple_fields.items():
            if payload_key in payload and payload[payload_key]:
                updates.append(f"{db_column}=%s")
                values.append(payload[payload_key])

        # Campos que se AGREGAN a los existentes (centros y almacenes)
        if "centros_nuevos" in payload and payload["centros_nuevos"]:
            nuevos_centros = payload["centros_nuevos"]
            if isinstance(nuevos_centros, list):
                todos_centros = list(set(centros_actuales + nuevos_centros))
                updates.append("centros=%s")
                values.append(",".join(str(c) for c in todos_centros))

        if "almacenes_nuevos" in payload and payload["almacenes_nuevos"]:
            nuevos_almacenes = payload["almacenes_nuevos"]
            if isinstance(nuevos_almacenes, list):
                todos_almacenes = list(set(almacenes_actuales + nuevos_almacenes))
                updates.append("almacenes=%s")
                values.append(",".join(str(a) for a in todos_almacenes))

        # Fase 2: Escrituras en transacción
        with get_db_transaction() as conn:
            cur = conn.cursor()

            # Aplicar cambios al usuario
            if updates:
                values.append(usuario_id)
                update_query = f"UPDATE usuario SET {', '.join(updates)} WHERE id_spm=%s"
                cur.execute(update_query, values)
                logger.info(f"Cambios aplicados a usuario {usuario_id}: {updates}")

            # Actualizar estado de la solicitud
            cur.execute(
                "UPDATE usuario_solicitud_perfil SET estado=%s, updated_at=%s WHERE id=%s",
                ("aprobado", now, request_id),
            )

            # Crear notificación para el solicitante
            mensaje = f"Tu solicitud de cambio de perfil #{request_id} ha sido aprobada"
            if comentario:
                mensaje += f": {comentario}"

            cur.execute(
                """INSERT INTO notificacion (destinatario_id, solicitud_id, mensaje, tipo, leido, created_at)
                   VALUES (%s, %s, %s, %s, 0, %s)""",
                (usuario_id, request_id, mensaje, "profile_approved", now),
            )

        logger.info(f"Solicitud de perfil {request_id} aprobada por {g.user.get('user_id')}")

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
@require_admin
def admin_rechazar_profile_request(request_id: int):
    """
    Rechaza una solicitud de cambio de perfil.

    Body:
        motivo (str, requerido): Motivo del rechazo
    """
    data = request.get_json(silent=True) or {}
    motivo = data.get("motivo", "").strip()

    if not motivo:
        return (
            jsonify({"ok": False, "error": {"message": "Debe proporcionar un motivo de rechazo"}}),
            400,
        )

    try:
        # Fase 1: Lectura para validar
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM usuario_solicitud_perfil WHERE id=%s", (request_id,))
            req = cur.fetchone()

        if not req:
            return jsonify({"ok": False, "error": {"message": "Solicitud no encontrada"}}), 404

        if req["estado"] != "pendiente":
            return (
                jsonify({"ok": False, "error": {"message": "La solicitud ya fue procesada"}}),
                400,
            )

        usuario_id = req["usuario_id"]
        now = datetime.utcnow().isoformat()
        mensaje = f"Tu solicitud de cambio de perfil #{request_id} ha sido rechazada: {motivo}"

        # Fase 2: Escrituras en transacción
        with get_db_transaction() as conn:
            cur = conn.cursor()

            # Actualizar estado
            cur.execute(
                "UPDATE usuario_solicitud_perfil SET estado=%s, updated_at=%s WHERE id=%s",
                ("rechazado", now, request_id),
            )

            # Crear notificación para el solicitante
            cur.execute(
                """INSERT INTO notificacion (destinatario_id, solicitud_id, mensaje, tipo, leido, created_at)
                   VALUES (%s, %s, %s, %s, 0, %s)""",
                (usuario_id, request_id, mensaje, "profile_rejected", now),
            )

        logger.info(f"Solicitud de perfil {request_id} rechazada por {g.user.get('user_id')}: {motivo}")

        return jsonify({"ok": True, "message": "Solicitud rechazada"}), 200

    except Exception as e:
        logger.error(f"Error rechazando profile request: {e}")
        return jsonify({"ok": False, "error": {"message": str(e)}}), 500


@bp.route("/mi-cuenta/admin/profile-requests/<int:request_id>/mensaje", methods=["POST"])
@require_admin
def admin_enviar_mensaje_profile_request(request_id: int):
    """
    Envía un mensaje al solicitante sobre su solicitud de cambio de perfil.

    Body:
        mensaje (str, requerido): Contenido del mensaje
    """
    user_id = g.user.get("user_id")  # Necesario para registrar como remitente

    data = request.get_json(silent=True) or {}
    mensaje = data.get("mensaje", "").strip()

    if not mensaje:
        return jsonify({"ok": False, "error": {"message": "Debe proporcionar un mensaje"}}), 400

    try:
        # Fase 1: Lectura para validar
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT upr.*, u.nombre, u.apellido
                FROM usuario_solicitud_perfil upr
                JOIN usuario u ON upr.usuario_id = u.id_spm
                WHERE upr.id = %s
            """,
                (request_id,),
            )
            req = cur.fetchone()

        if not req:
            return jsonify({"ok": False, "error": {"message": "Solicitud no encontrada"}}), 404

        destinatario_id = req["usuario_id"]
        now = datetime.utcnow().isoformat()
        asunto = f"Sobre tu solicitud de cambio de perfil #{request_id}"

        # Fase 2: Escritura en transacción
        with get_db_transaction() as conn:
            cur = conn.cursor()
            mensaje_id = insert_returning_id(
                cur,
                """INSERT INTO mensaje (remitente_id, destinatario_id, asunto, mensaje, leido, created_at)
                   VALUES (%s, %s, %s, %s, 0, %s)""",
                (user_id, destinatario_id, asunto, mensaje, now),
            )

        logger.info(f"Mensaje enviado a {destinatario_id} sobre solicitud {request_id}")

        return jsonify({"ok": True, "message": "Mensaje enviado", "mensaje_id": mensaje_id}), 200

    except Exception as e:
        logger.error(f"Error enviando mensaje: {e}")
        return jsonify({"ok": False, "error": {"message": str(e)}}), 500


# ============================================================================
# PREFERENCIAS DE NOTIFICACION
# ============================================================================


@bp.route("/mi-cuenta/notification-preferences", methods=["GET"])
@require_auth
def get_notification_preferences():
    """
    Obtiene las preferencias de notificacion del usuario.

    Returns:
        200: Preferencias del usuario
        401: No autenticado
    """
    user_id = g.user.get("user_id")

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """SELECT push_enabled, sound_enabled, notif_solicitudes, notif_aprobaciones,
                          notif_mensajes, notif_presupuestos, notif_mrp, notif_sla
                   FROM usuario_preferencia_notificacion
                   WHERE user_id = %s""",
                (str(user_id),),
            )
            row = cur.fetchone()

        if row:
            prefs = dict(row) if hasattr(row, "keys") else {
                "push_enabled": row[0],
                "sound_enabled": row[1],
                "notif_solicitudes": row[2],
                "notif_aprobaciones": row[3],
                "notif_mensajes": row[4],
                "notif_presupuestos": row[5],
                "notif_mrp": row[6],
                "notif_sla": row[7],
            }
        else:
            # Si no hay preferencias, crear con valores por defecto (PG syntax)
            with get_db_transaction() as conn:
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO usuario_preferencia_notificacion (user_id) VALUES (%s) ON CONFLICT (user_id) DO NOTHING",
                    (str(user_id),),
                )

            prefs = {
                "push_enabled": 1,
                "sound_enabled": 1,
                "notif_solicitudes": 1,
                "notif_aprobaciones": 1,
                "notif_mensajes": 1,
                "notif_presupuestos": 1,
                "notif_mrp": 1,
                "notif_sla": 1,
            }

        # Convertir a booleanos para el frontend
        return jsonify({
            "ok": True,
            "preferences": {
                "pushEnabled": bool(prefs.get("push_enabled", 1)),
                "soundEnabled": bool(prefs.get("sound_enabled", 1)),
                "notifSolicitudes": bool(prefs.get("notif_solicitudes", 1)),
                "notifAprobaciones": bool(prefs.get("notif_aprobaciones", 1)),
                "notifMensajes": bool(prefs.get("notif_mensajes", 1)),
                "notifPresupuestos": bool(prefs.get("notif_presupuestos", 1)),
                "notifMrp": bool(prefs.get("notif_mrp", 1)),
                "notifSla": bool(prefs.get("notif_sla", 1)),
            },
        }), 200

    except Exception as e:
        logger.error(f"Error obteniendo preferencias de notificacion: {e}")
        return jsonify({"ok": False, "error": {"message": str(e)}}), 500


@bp.route("/mi-cuenta/notification-preferences", methods=["PUT"])
@require_auth
def update_notification_preferences():
    """
    Actualiza las preferencias de notificacion del usuario.

    Body:
        pushEnabled (bool, opcional): Web Push habilitado
        soundEnabled (bool, opcional): Sonido habilitado
        notifSolicitudes (bool, opcional): Notificaciones de solicitudes
        notifAprobaciones (bool, opcional): Notificaciones de aprobaciones
        notifMensajes (bool, opcional): Notificaciones de mensajes
        notifPresupuestos (bool, opcional): Notificaciones de presupuesto
        notifMrp (bool, opcional): Notificaciones MRP
        notifSla (bool, opcional): Notificaciones SLA

    Returns:
        200: Preferencias actualizadas
        401: No autenticado
    """
    user_id = g.user.get("user_id")

    data = request.get_json(silent=True) or {}

    # Mapeo de camelCase a snake_case
    field_mapping = {
        "pushEnabled": "push_enabled",
        "soundEnabled": "sound_enabled",
        "notifSolicitudes": "notif_solicitudes",
        "notifAprobaciones": "notif_aprobaciones",
        "notifMensajes": "notif_mensajes",
        "notifPresupuestos": "notif_presupuestos",
        "notifMrp": "notif_mrp",
        "notifSla": "notif_sla",
    }

    updates = []
    values = []

    for camel_key, snake_key in field_mapping.items():
        if camel_key in data:
            updates.append(f"{snake_key} = %s")
            values.append(1 if data[camel_key] else 0)

    if not updates:
        return jsonify({"ok": False, "error": {"message": "No hay preferencias para actualizar"}}), 400

    # Agregar updated_at
    updates.append("updated_at = %s")
    values.append(datetime.utcnow().isoformat())
    values.append(str(user_id))

    try:
        with get_db_transaction() as conn:
            cur = conn.cursor()

            # Primero intentar INSERT si no existe
            cur.execute(
                "INSERT INTO usuario_preferencia_notificacion (user_id) VALUES (%s) ON CONFLICT (user_id) DO NOTHING",
                (str(user_id),),
            )

            # Luego UPDATE
            query = f"UPDATE usuario_preferencia_notificacion SET {', '.join(updates)} WHERE user_id = %s"
            cur.execute(query, values)

        logger.info(f"Preferencias de notificacion actualizadas para usuario {user_id}")
        return jsonify({"ok": True, "message": "Preferencias actualizadas"}), 200

    except Exception as e:
        logger.error(f"Error actualizando preferencias: {e}")
        return jsonify({"ok": False, "error": {"message": str(e)}}), 500
