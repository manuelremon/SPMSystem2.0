"""
Admin routes - CRUD para catálogos y gestión básica
Protegido: requiere rol admin (token access)
"""

import logging
import sys

import bcrypt
from flask import Blueprint, g, jsonify, request

logger = logging.getLogger(__name__)

from backend.core.cache import get_cache_stats, invalidate_catalog_cache, invalidate_user_cache
from backend.core.config import settings
from backend.core.db import get_db_connection, get_db_transaction, get_spm_db_path
from backend.core.rate_limit import rate_limit
from backend.core.roles import normalize_roles, require_admin
from backend.core.user_helpers import get_user_by_id

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


# Alias para compatibilidad con código existente
_get_user = get_user_by_id


@bp.route("/centros", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_centros():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("codigo"):
            return jsonify({"ok": False, "error": "codigo es requerido"}), 400
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO catalogo_centro (codigo, nombre, activo) VALUES (?,?,?)",
                (data["codigo"], data.get("nombre"), True),
            )
        invalidate_catalog_cache()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT codigo, nombre, activo, created_at, updated_at FROM catalogo_centro")
        rows = [dict(r) for r in cur.fetchall()]
    return jsonify(rows), 200


@bp.route("/centros/<centro_codigo>", methods=["PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def admin_centros_mod(centro_codigo):
    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                "UPDATE catalogo_centro SET nombre=?, activo=? WHERE codigo=?",
                (data.get("nombre"), bool(data.get("activo", True)), centro_codigo),
            )
        else:
            cur.execute("UPDATE catalogo_centro SET activo=FALSE WHERE codigo=?", (centro_codigo,))

    invalidate_catalog_cache()
    return jsonify({"ok": True}), 200


@bp.route("/almacenes", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_almacenes():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("codigo"):
            return jsonify({"ok": False, "error": "codigo requerido"}), 400
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO catalogo_almacen (codigo, nombre, activo) VALUES (?,?,?)",
                (data["codigo"], data.get("nombre"), True),
            )
        invalidate_catalog_cache()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT codigo, nombre, activo, created_at, updated_at FROM catalogo_almacen")
        rows = [dict(r) for r in cur.fetchall()]
    return jsonify(rows), 200


@bp.route("/almacenes/<almacen_codigo>", methods=["PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def admin_almacenes_mod(almacen_codigo):
    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                "UPDATE catalogo_almacen SET nombre=?, activo=? WHERE codigo=?",
                (data.get("nombre"), bool(data.get("activo", True)), almacen_codigo),
            )
        else:
            cur.execute("UPDATE catalogo_almacen SET activo=FALSE WHERE codigo=?", (almacen_codigo,))

    invalidate_catalog_cache()
    return jsonify({"ok": True}), 200


@bp.route("/sectores", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_sectores():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("nombre"):
            return jsonify({"ok": False, "error": "nombre requerido"}), 400
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO catalogo_sector (nombre, activo) VALUES (?,?)",
                (data["nombre"], True),
            )
        invalidate_catalog_cache()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT nombre, activo, created_at, updated_at FROM catalogo_sector")
        rows = [dict(r) for r in cur.fetchall()]
    return jsonify(rows), 200


@bp.route("/sectores/<sector_nombre>", methods=["PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def admin_sectores_mod(sector_nombre):
    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                "UPDATE catalogo_sector SET activo=? WHERE nombre=?",
                (bool(data.get("activo", True)), sector_nombre),
            )
        else:
            cur.execute("UPDATE catalogo_sector SET activo=FALSE WHERE nombre=?", (sector_nombre,))

    invalidate_catalog_cache()
    return jsonify({"ok": True}), 200


# ======================== ROLES ========================
@bp.route("/roles", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_roles():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("nombre"):
            return jsonify({"ok": False, "error": "nombre requerido"}), 400
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO catalogo_rol (nombre, activo, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
                (data["nombre"], bool(data.get("activo", True))),
            )
        invalidate_catalog_cache()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT nombre, activo, created_at, updated_at FROM catalogo_rol ORDER BY nombre")
        rows = [dict(r) for r in cur.fetchall()]
    return jsonify(rows), 200


@bp.route("/roles/<rol_nombre>", methods=["PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def admin_roles_mod(rol_nombre):
    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                "UPDATE catalogo_rol SET activo=?, updated_at=CURRENT_TIMESTAMP WHERE nombre=?",
                (bool(data.get("activo", True)), rol_nombre),
            )
        else:
            cur.execute(
                "UPDATE catalogo_rol SET activo=FALSE, updated_at=CURRENT_TIMESTAMP WHERE nombre=?",
                (rol_nombre,),
            )

    invalidate_catalog_cache()
    return jsonify({"ok": True}), 200


# ======================== PUESTOS ========================
@bp.route("/puestos", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_puestos():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("nombre"):
            return jsonify({"ok": False, "error": "nombre requerido"}), 400
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO catalogo_puesto (nombre, activo, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
                (data["nombre"], bool(data.get("activo", True))),
            )
        invalidate_catalog_cache()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT nombre, activo, created_at, updated_at FROM catalogo_puesto ORDER BY nombre")
        rows = [dict(r) for r in cur.fetchall()]
    return jsonify(rows), 200


@bp.route("/puestos/<puesto_nombre>", methods=["PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def admin_puestos_mod(puesto_nombre):
    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                "UPDATE catalogo_puesto SET activo=?, updated_at=CURRENT_TIMESTAMP WHERE nombre=?",
                (bool(data.get("activo", True)), puesto_nombre),
            )
        else:
            cur.execute(
                "UPDATE catalogo_puesto SET activo=FALSE, updated_at=CURRENT_TIMESTAMP WHERE nombre=?",
                (puesto_nombre,),
            )

    invalidate_catalog_cache()
    return jsonify({"ok": True}), 200


@bp.route("/usuarios", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)  # Proteccion contra brute force
def admin_usuarios():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}

        # El frontend envía 'roles' (plural), pero BD usa 'rol' (singular)
        roles_data = data.get("roles") or data.get("rol")
        if not roles_data:
            return jsonify({"ok": False, "error": "Campo roles es requerido"}), 400

        # Convertir roles a CSV si es array
        if isinstance(roles_data, list):
            rol_csv = ", ".join(roles_data)
        else:
            rol_csv = roles_data

        required = ["id_spm", "nombre", "apellido", "contrasena"]
        if not all(data.get(k) for k in required):
            return jsonify({"ok": False, "error": "Faltan campos obligatorios"}), 400

        # Hash de la contraseña con bcrypt antes de guardar
        password_hash = bcrypt.hashpw(
            data["contrasena"].encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO usuario (id_spm, nombre, apellido, rol, contrasena, mail, posicion, sector, centros, jefe, gerente1, gerente2, telefono, estado_registro, id_ypf)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    data["id_spm"],
                    data["nombre"],
                    data["apellido"],
                    rol_csv,
                    password_hash,
                    data.get("mail"),
                    data.get("posicion"),
                    data.get("sector"),
                    data.get("centros"),
                    data.get("jefe"),
                    data.get("gerente1"),
                    data.get("gerente2"),
                    data.get("telefono"),
                    data.get("estado_registro", "Activo"),
                    data.get("id_ypf"),
                ),
            )
        invalidate_user_cache()
        invalidate_catalog_cache()

    # Obtener usuarios y normalizar formato de roles
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id_spm, nombre, apellido, rol, mail, posicion, sector, centros, jefe, gerente1, gerente2, telefono, estado_registro, id_ypf, mail_respaldo, almacenes FROM usuario")
        rows = []
        for r in cur.fetchall():
            row_dict = dict(r)
            row_dict["roles"] = normalize_roles(row_dict.get("rol", ""))
            rows.append(row_dict)

    return jsonify(rows), 200


@bp.route("/usuarios/<id_spm>", methods=["GET", "PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)  # Proteccion contra enumeracion/brute force
def admin_usuarios_mod(id_spm):
    if request.method == "GET":
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id_spm, nombre, apellido, rol, mail, posicion, sector, centros, jefe, gerente1, gerente2, telefono, estado_registro, id_ypf, mail_respaldo, almacenes FROM usuario WHERE id_spm=?", (id_spm,))
            row = cur.fetchone()
            if not row:
                return jsonify({"ok": False, "error": "Usuario no encontrado"}), 404

            row_dict = dict(row)
            row_dict["roles"] = normalize_roles(row_dict.get("rol", ""))
        return jsonify(row_dict), 200

    elif request.method == "PUT":
        data = request.get_json(silent=True) or {}
        logger.debug(f"Actualizando usuario {id_spm} con campos: {list(data.keys())}")

        update_fields = []
        values = []

        allowed_fields = {
            "nombre": "nombre",
            "apellido": "apellido",
            "rol": "rol",
            "roles": "rol",
            "mail": "mail",
            "telefono": "telefono",
            "sector": "sector",
            "centros": "centros",
            "jefe": "jefe",
            "gerente1": "gerente1",
            "gerente2": "gerente2",
            "estado_registro": "estado_registro",
            "contrasena": "contrasena",
            "posicion": "posicion",
            "puesto": "posicion",
            "id_ypf": "id_ypf",
            "mail_respaldo": "mail_respaldo",
            "almacenes": "almacenes",
        }

        rol_processed = False

        for key, db_field in allowed_fields.items():
            if key in data:
                value = data[key]

                if key in ["roles", "rol"]:
                    if rol_processed:
                        continue
                    if isinstance(value, list):
                        value = ", ".join(value)
                    if not value:
                        return (
                            jsonify({"ok": False, "error": "Campo roles no puede estar vacío"}),
                            400,
                        )
                    update_fields.append("rol=?")
                    values.append(value)
                    rol_processed = True
                    continue

                # Hash de contraseña con bcrypt si se está actualizando
                if key == "contrasena" and value:
                    value = bcrypt.hashpw(
                        value.encode("utf-8"), bcrypt.gensalt()
                    ).decode("utf-8")

                if key in ["centros", "almacenes"] and isinstance(value, list):
                    value = ",".join(str(v) for v in value)

                update_fields.append(f"{db_field}=?")
                values.append(value)

        if not update_fields:
            return jsonify({"ok": False, "error": "No hay campos para actualizar"}), 400

        values.append(id_spm)

        try:
            with get_db_transaction() as conn:
                cur = conn.cursor()
                query = f"UPDATE usuario SET {', '.join(update_fields)} WHERE id_spm=?"
                logger.debug(f"Ejecutando UPDATE usuario {id_spm}, campos: {update_fields}")
                cur.execute(query, values)
                logger.debug(f"Usuario {id_spm} actualizado, filas afectadas: {cur.rowcount}")
        except Exception as e:
            logger.error(f"Error actualizando usuario {id_spm}: {e}", exc_info=True)
            return jsonify({"ok": False, "error": "Error interno al actualizar usuario"}), 500
    else:
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute("UPDATE usuario SET estado_registro='Inactivo' WHERE id_spm=?", (id_spm,))

    invalidate_user_cache(id_spm)
    invalidate_catalog_cache()
    return jsonify({"ok": True}), 200


@bp.route("/planificadores", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_planificadores():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("usuario_id"):
            return jsonify({"ok": False, "error": "usuario_id requerido"}), 400
        asignaciones = data.get("asignaciones") or []
        with get_db_transaction() as conn:
            cur = conn.cursor()
            for a in asignaciones:
                cur.execute(
                    "INSERT INTO planificador_asignaciones (planificador_id, centro, sector, almacen_virtual, activo) VALUES (%s,%s,%s,%s,TRUE) ON CONFLICT DO NOTHING",
                    (
                        data["usuario_id"],
                        a.get("centro"),
                        a.get("sector"),
                        a.get("almacen_virtual"),
                    ),
                )

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id_spm, nombre, apellido, rol FROM usuario WHERE rol LIKE '%Planificador%'"
        )
        planners = [
            {"usuario_id": r["id_spm"], "nombre": f"{r['nombre']} {r['apellido']}", "activo": 1}
            for r in cur.fetchall()
        ]
        cur.execute("SELECT id, planificador_id, centro, sector, almacen_virtual, prioridad, activo, created_at FROM planificador_asignaciones")
        asign = [dict(r) for r in cur.fetchall()]

    return jsonify({"planificadores": planners, "asignaciones": asign}), 200


@bp.route("/planificadores/<usuario_id>", methods=["PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def admin_planificadores_mod(usuario_id):
    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            if "asignaciones" in data:
                cur.execute(
                    "DELETE FROM planificador_asignaciones WHERE planificador_id=%s", (usuario_id,)
                )
                for a in data.get("asignaciones") or []:
                    cur.execute(
                        "INSERT INTO planificador_asignaciones (planificador_id, centro, sector, almacen_virtual, activo) VALUES (%s,%s,%s,%s,TRUE) ON CONFLICT DO NOTHING",
                        (usuario_id, a.get("centro"), a.get("sector"), a.get("almacen_virtual")),
                    )
        else:
            cur.execute(
                "UPDATE planificador_asignaciones SET activo=FALSE WHERE planificador_id=%s",
                (usuario_id,),
            )

    return jsonify({"ok": True}), 200


def _get_current_user_info():
    """Obtiene info del usuario actual desde g.user (set by @require_admin)."""
    user_id = g.user.get("user_id") if hasattr(g, "user") and g.user else None
    if not user_id:
        return None, None
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, nombre FROM usuario WHERE id = ?", (user_id,))
        row = cur.fetchone()
        if row:
            return row["id"], row["nombre"]
    return user_id, "Sistema"


def _registrar_historial_presupuesto(
    conn,
    centro,
    sector,
    tipo_cambio,
    monto_ant,
    monto_new,
    saldo_ant,
    saldo_new,
    justificacion=None,
    bur_id=None,
):
    """Registra un cambio en el historial de presupuestos."""
    user_id, user_nombre = _get_current_user_info()
    diferencia = (monto_new or 0) - (monto_ant or 0)

    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO budget_history
        (centro, sector, tipo_cambio, monto_anterior_usd, monto_nuevo_usd,
         saldo_anterior_usd, saldo_nuevo_usd, diferencia_usd,
         solicitante_id, solicitante_nombre, aprobador_id, aprobador_nombre,
         justificacion, bur_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            centro,
            sector,
            tipo_cambio,
            monto_ant,
            monto_new,
            saldo_ant,
            saldo_new,
            diferencia,
            user_id,
            user_nombre,
            user_id,
            user_nombre,
            justificacion,
            bur_id,
        ),
    )


@bp.route("/presupuestos", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_presupuestos():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("centro") or not data.get("sector"):
            return jsonify({"ok": False, "error": "centro y sector son requeridos"}), 400

        centro = data["centro"]
        sector = data["sector"]
        monto_new = data.get("monto_usd", 0)
        saldo_new = data.get("saldo_usd", monto_new)
        justificacion = data.get("justificacion", "Creación inicial de presupuesto")

        with get_db_transaction() as conn:
            cur = conn.cursor()
            # Verificar si existe
            cur.execute(
                "SELECT monto_usd, saldo_usd FROM presupuesto WHERE centro=? AND sector=?",
                (centro, sector),
            )
            existing = cur.fetchone()

            cur.execute(
                """INSERT INTO presupuesto (centro, sector, monto_usd, saldo_usd) VALUES (%s,%s,%s,%s)
                ON CONFLICT (centro, sector) DO UPDATE SET monto_usd = EXCLUDED.monto_usd, saldo_usd = EXCLUDED.saldo_usd""",
                (centro, sector, monto_new, saldo_new),
            )

            # Registrar en historial
            if existing:
                _registrar_historial_presupuesto(
                    conn,
                    centro,
                    sector,
                    "ajuste",
                    existing["monto_usd"],
                    monto_new,
                    existing["saldo_usd"],
                    saldo_new,
                    justificacion,
                )
            else:
                _registrar_historial_presupuesto(
                    conn,
                    centro,
                    sector,
                    "creacion",
                    None,
                    monto_new,
                    None,
                    saldo_new,
                    justificacion,
                )

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT centro, sector, monto_usd, saldo_usd, version, updated_by, monto_cents, saldo_cents FROM presupuesto")
        rows = [dict(r) for r in cur.fetchall()]

    return jsonify(rows), 200


@bp.route("/presupuestos/historial", methods=["GET"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_presupuestos_historial():
    """Obtiene el historial de cambios en presupuestos."""
    centro = request.args.get("centro")
    sector = request.args.get("sector")
    limit = min(request.args.get("limit", 50, type=int), 200)

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            if centro and sector:
                cur.execute(
                    """
                    SELECT * FROM budget_history
                    WHERE centro = ? AND sector = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                """,
                    (centro, sector, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT * FROM budget_history
                    ORDER BY created_at DESC
                    LIMIT ?
                """,
                    (limit,),
                )

            rows = [dict(r) for r in cur.fetchall()]

        return jsonify({"ok": True, "historial": rows}), 200
    except Exception:
        return jsonify({"ok": True, "historial": []}), 200


@bp.route("/presupuestos/<centro>/<sector>", methods=["PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def admin_presupuestos_mod(centro, sector):
    with get_db_transaction() as conn:
        cur = conn.cursor()

        # Obtener valores actuales para el historial
        cur.execute(
            "SELECT monto_usd, saldo_usd FROM presupuesto WHERE centro=? AND sector=?",
            (centro, sector),
        )
        existing = cur.fetchone()
        monto_ant = existing["monto_usd"] if existing else None
        saldo_ant = existing["saldo_usd"] if existing else None

        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            monto_new = data.get("monto_usd", 0)
            saldo_new = data.get("saldo_usd", 0)
            justificacion = data.get("justificacion", "Actualización manual")

            cur.execute(
                "UPDATE presupuesto SET monto_usd=?, saldo_usd=? WHERE centro=? AND sector=?",
                (monto_new, saldo_new, centro, sector),
            )

            # Determinar tipo de cambio
            if monto_new > (monto_ant or 0):
                tipo = "aumento"
            elif monto_new < (monto_ant or 0):
                tipo = "reduccion"
            else:
                tipo = "ajuste"

            _registrar_historial_presupuesto(
                conn,
                centro,
                sector,
                tipo,
                monto_ant,
                monto_new,
                saldo_ant,
                saldo_new,
                justificacion,
            )
        else:
            cur.execute("DELETE FROM presupuesto WHERE centro=? AND sector=?", (centro, sector))
            _registrar_historial_presupuesto(
                conn,
                centro,
                sector,
                "eliminacion",
                monto_ant,
                0,
                saldo_ant,
                0,
                "Eliminación de presupuesto",
            )

    return jsonify({"ok": True}), 200


@bp.route("/estado", methods=["GET"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_estado():
    db_path = get_spm_db_path()
    db_exists = db_path.exists()
    return (
        jsonify(
            {
                "ok": True,
                "version_spm": "v2.0",
                "python_version": sys.version,
                "db_path": str(db_path),
                "db_exists": db_exists,
                "env": {
                    "ENV": settings.ENV,
                    "DEBUG": settings.DEBUG,
                },
            }
        ),
        200,
    )


@bp.route("/metricas", methods=["GET"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_metricas():
    import logging

    counts = {}
    ALLOWED_TABLES = {"usuario", "materiales", "solicitud"}
    table_key_map = [
        ("usuario", "usuarios"),
        ("materiales", "materiales"),
        ("solicitud", "solicitudes_totales"),
    ]

    with get_db_connection() as conn:
        cur = conn.cursor()
        for table, key in table_key_map:
            if table not in ALLOWED_TABLES:
                counts[key] = 0
                continue
            try:
                cur.execute(f"SELECT COUNT(*) AS count FROM {table}")
                row = cur.fetchone()
                counts[key] = row["count"] if isinstance(row, dict) else row[0]
            except Exception as e:
                logging.getLogger(__name__).warning(f"Error contando {table}: {e}")
                counts[key] = 0
        try:
            cur.execute("SELECT status, COUNT(*) AS count FROM solicitud GROUP BY status")
            for row in cur.fetchall():
                if isinstance(row, dict):
                    status, c = row["status"], row["count"]
                else:
                    status, c = row[0], row[1]
                counts[f"solicitudes_{status.lower()}"] = c
        except Exception as e:
            logging.getLogger(__name__).warning(f"Error obteniendo status de solicitudes: {e}")

    return jsonify(counts), 200


# ==============================================================================
# CONFIG ALMACENES (Libre disponibilidad, exclusiones)
# ==============================================================================


@bp.route("/config/almacenes", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_config_almacenes():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("centro") or not data.get("almacen"):
            return jsonify({"ok": False, "error": "centro y almacen son requeridos"}), 400

        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO config_almacenes (centro, almacen, nombre, libre_disponibilidad, responsable_id, excluido, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(centro, almacen) DO UPDATE SET
                    nombre = excluded.nombre,
                    libre_disponibilidad = excluded.libre_disponibilidad,
                    responsable_id = excluded.responsable_id,
                    excluido = excluded.excluido,
                    updated_at = CURRENT_TIMESTAMP
            """,
                (
                    data["centro"],
                    data["almacen"],
                    data.get("nombre"),
                    bool(data.get("libre_disponibilidad")),
                    data.get("responsable_id"),
                    bool(data.get("excluido")),
                ),
            )

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT ca.*, u.nombre as responsable_nombre, u.apellido as responsable_apellido
            FROM config_almacenes ca
            LEFT JOIN usuario u ON ca.responsable_id = u.id_spm
            ORDER BY ca.centro, ca.almacen
        """
        )
        rows = []
        for r in cur.fetchall():
            row_dict = dict(r)
            if row_dict.get("responsable_nombre"):
                row_dict["responsable_display"] = (
                    f"{row_dict['responsable_nombre']} {row_dict.get('responsable_apellido', '')}".strip()
                )
            else:
                row_dict["responsable_display"] = None
            rows.append(row_dict)

    return jsonify(rows), 200


@bp.route("/config/almacenes/<centro>/<almacen>", methods=["PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def admin_config_almacenes_mod(centro, almacen):
    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                """
                UPDATE config_almacenes
                SET nombre = ?, libre_disponibilidad = ?, responsable_id = ?, excluido = ?, updated_at = CURRENT_TIMESTAMP
                WHERE centro = ? AND almacen = ?
            """,
                (
                    data.get("nombre"),
                    bool(data.get("libre_disponibilidad")),
                    data.get("responsable_id"),
                    bool(data.get("excluido")),
                    centro,
                    almacen,
                ),
            )
        else:
            cur.execute(
                "DELETE FROM config_almacenes WHERE centro = ? AND almacen = ?", (centro, almacen)
            )

    return jsonify({"ok": True}), 200


# ==============================================================================
# PROVEEDORES EXTERNOS (Nueva estructura con CUIT como PK)
# ==============================================================================


@bp.route("/proveedores/externos", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_proveedores_externos():
    """
    GET: Lista proveedores externos con sus contactos/emails
    POST: Crea un nuevo proveedor externo
    """
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("cuit"):
            return jsonify({"ok": False, "error": "cuit es requerido"}), 400
        if not data.get("nombre"):
            return jsonify({"ok": False, "error": "nombre es requerido"}), 400

        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO proveedor_externo
                    (cuit, nombre, direccion, localidad, pais, origen, lead_time_dias, rubro, calificacion, activo, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
                ON CONFLICT(cuit) DO UPDATE SET
                    nombre = excluded.nombre,
                    direccion = excluded.direccion,
                    localidad = excluded.localidad,
                    pais = excluded.pais,
                    origen = excluded.origen,
                    lead_time_dias = excluded.lead_time_dias,
                    rubro = excluded.rubro,
                    calificacion = excluded.calificacion,
                    notas = excluded.notas,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    data["cuit"],
                    data["nombre"],
                    data.get("direccion"),
                    data.get("localidad"),
                    data.get("pais", "Argentina"),
                    data.get("origen", "local"),
                    data.get("lead_time_dias", 7),
                    data.get("rubro"),
                    data.get("calificacion", "sin_calificar"),
                    data.get("notas"),
                ),
            )

            # Agregar email principal si se proporciona
            if data.get("email"):
                # Primero eliminar emails principales existentes para este proveedor
                cur.execute(
                    "DELETE FROM proveedor_externo_email WHERE cuit_proveedor = %s AND es_principal = TRUE",
                    (data["cuit"],),
                )
                # Insertar el nuevo email principal
                cur.execute(
                    """
                    INSERT INTO proveedor_externo_email (cuit_proveedor, email, tipo, es_principal)
                    VALUES (%s, %s, 'comercial', TRUE)
                    """,
                    (data["cuit"], data["email"]),
                )

    # GET: Listar proveedores con su email principal
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                pe.*,
                (SELECT email FROM proveedor_externo_email WHERE cuit_proveedor = pe.cuit AND es_principal = TRUE LIMIT 1) as email_principal,
                (SELECT COUNT(*) FROM proveedor_externo_contacto WHERE cuit_proveedor = pe.cuit) as num_contactos
            FROM proveedor_externo pe
            ORDER BY pe.nombre
        """
        )
        rows = [dict(r) for r in cur.fetchall()]

    return jsonify(rows), 200


@bp.route("/proveedores/externos/<cuit>", methods=["GET", "PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def admin_proveedores_externos_mod(cuit):
    """
    GET: Detalle completo de un proveedor (con contactos, emails, teléfonos)
    PUT: Actualiza un proveedor
    DELETE: Desactiva un proveedor (soft delete)
    """
    if request.method == "GET":
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Datos principales
            cur.execute("SELECT cuit, nombre, direccion, localidad, pais, origen, lead_time_dias, rubro, calificacion, activo, notas, created_at, updated_at, provee_grupo_de_articulos FROM proveedor_externo WHERE cuit = ?", (cuit,))
            prov = cur.fetchone()
            if not prov:
                return jsonify({"ok": False, "error": "Proveedor no encontrado"}), 404

            result = dict(prov)

            # Contactos
            cur.execute(
                "SELECT id, cuit_proveedor, nombre, apellido, cargo, es_principal, created_at FROM proveedor_externo_contacto WHERE cuit_proveedor = ? ORDER BY es_principal DESC",
                (cuit,),
            )
            result["contactos"] = [dict(r) for r in cur.fetchall()]

            # Emails
            cur.execute(
                "SELECT id, cuit_proveedor, email, tipo, es_principal, created_at FROM proveedor_externo_email WHERE cuit_proveedor = ? ORDER BY es_principal DESC",
                (cuit,),
            )
            result["emails"] = [dict(r) for r in cur.fetchall()]

            # Teléfonos
            cur.execute("SELECT id, cuit_proveedor, telefono, tipo, created_at FROM proveedor_externo_telefono WHERE cuit_proveedor = ?", (cuit,))
            result["telefonos"] = [dict(r) for r in cur.fetchall()]

        return jsonify(result), 200

    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                """
                UPDATE proveedor_externo
                SET nombre = ?, direccion = ?, localidad = ?, pais = ?,
                    origen = ?, lead_time_dias = ?, rubro = ?,
                    calificacion = ?, activo = ?, notas = ?, updated_at = CURRENT_TIMESTAMP
                WHERE cuit = ?
                """,
                (
                    data.get("nombre"),
                    data.get("direccion"),
                    data.get("localidad"),
                    data.get("pais", "Argentina"),
                    data.get("origen", "local"),
                    data.get("lead_time_dias", 7),
                    data.get("rubro"),
                    data.get("calificacion", "sin_calificar"),
                    bool(data.get("activo", True)),
                    data.get("notas"),
                    cuit,
                ),
            )
        else:  # DELETE
            cur.execute(
                "UPDATE proveedor_externo SET activo = FALSE, updated_at = CURRENT_TIMESTAMP WHERE cuit = ?",
                (cuit,),
            )

    return jsonify({"ok": True}), 200


# ==============================================================================
# PROVEEDORES INTERNOS (Almacenes Internos)
# ==============================================================================


@bp.route("/proveedores/internos", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_proveedores_internos():
    """
    GET: Lista proveedores internos (almacenes)
    POST: Crea/actualiza un proveedor interno
    """
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("centro") or not data.get("almacen"):
            return jsonify({"ok": False, "error": "centro y almacen son requeridos"}), 400

        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO proveedor_interno
                    (centro, almacen, centro_nombre, almacen_nombre, sector,
                     contacto_centro, responsable_centro, referente_id, referente_nombre, referente_email,
                     activo, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
                ON CONFLICT(centro, almacen) DO UPDATE SET
                    centro_nombre = excluded.centro_nombre,
                    almacen_nombre = excluded.almacen_nombre,
                    sector = excluded.sector,
                    contacto_centro = excluded.contacto_centro,
                    responsable_centro = excluded.responsable_centro,
                    referente_id = excluded.referente_id,
                    referente_nombre = excluded.referente_nombre,
                    referente_email = excluded.referente_email,
                    notas = excluded.notas,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    data["centro"],
                    data["almacen"],
                    data.get("centro_nombre"),
                    data.get("almacen_nombre"),
                    data.get("sector"),
                    data.get("contacto_centro"),
                    data.get("responsable_centro"),
                    data.get("referente_id"),
                    data.get("referente_nombre"),
                    data.get("referente_email"),
                    data.get("notas"),
                ),
            )

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT pi.*, u.nombre || ' ' || u.apellido as referente_usuario_nombre
            FROM proveedor_interno pi
            LEFT JOIN usuario u ON pi.referente_id = u.id_spm
            ORDER BY pi.centro, pi.almacen
        """
        )
        rows = [dict(r) for r in cur.fetchall()]

    return jsonify(rows), 200


@bp.route("/proveedores/internos/<centro>/<almacen>", methods=["GET", "PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def admin_proveedores_internos_mod(centro, almacen):
    """
    GET: Detalle de un proveedor interno
    PUT: Actualiza un proveedor interno
    DELETE: Desactiva un proveedor interno
    """
    if request.method == "GET":
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT pi.*, u.nombre || ' ' || u.apellido as referente_usuario_nombre
                FROM proveedor_interno pi
                LEFT JOIN usuario u ON pi.referente_id = u.id_spm
                WHERE pi.centro = ? AND pi.almacen = ?
            """,
                (centro, almacen),
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"ok": False, "error": "Proveedor interno no encontrado"}), 404

        return jsonify(dict(row)), 200

    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                """
                UPDATE proveedor_interno
                SET centro_nombre = ?, almacen_nombre = ?, sector = ?,
                    contacto_centro = ?, responsable_centro = ?,
                    referente_id = ?, referente_nombre = ?, referente_email = ?,
                    activo = ?, notas = ?, updated_at = CURRENT_TIMESTAMP
                WHERE centro = ? AND almacen = ?
                """,
                (
                    data.get("centro_nombre"),
                    data.get("almacen_nombre"),
                    data.get("sector"),
                    data.get("contacto_centro"),
                    data.get("responsable_centro"),
                    data.get("referente_id"),
                    data.get("referente_nombre"),
                    data.get("referente_email"),
                    bool(data.get("activo", True)),
                    data.get("notas"),
                    centro,
                    almacen,
                ),
            )
        else:  # DELETE
            cur.execute(
                "UPDATE proveedor_interno SET activo = FALSE, updated_at = CURRENT_TIMESTAMP WHERE centro = ? AND almacen = ?",
                (centro, almacen),
            )

    return jsonify({"ok": True}), 200


# ==============================================================================
# CACHE STATS (for monitoring)
# ==============================================================================


@bp.route("/cache/stats", methods=["GET"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_cache_stats():
    """Get cache statistics for monitoring performance"""
    stats = get_cache_stats()
    return jsonify({"ok": True, "cache": stats}), 200


@bp.route("/cache/clear", methods=["POST"])
@require_admin
@rate_limit(requests=10, window_seconds=60)
def admin_cache_clear():
    """Clear all caches (use after major data changes)"""
    invalidate_catalog_cache()
    invalidate_user_cache()

    return jsonify({"ok": True, "message": "All caches cleared"}), 200


# ==============================================================================
# REGLAS DE APROBACION (Sprint 2.5)
# ==============================================================================


from backend.services.approval_service import (
    ApprovalValidationError,
    actualizar_regla,
    crear_delegacion,
    crear_regla,
    desactivar_regla,
    listar_reglas,
)


@bp.route("/reglas-aprobacion", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_reglas_aprobacion():
    """
    GET: Lista todas las reglas de aprobacion
    POST: Crea una nueva regla de aprobacion
    """
    if request.method == "POST":
        data = request.get_json(silent=True) or {}

        # Validar campos requeridos
        if not data.get("nombre"):
            return jsonify({"ok": False, "error": "nombre es requerido"}), 400
        if not data.get("rol_requerido"):
            return jsonify({"ok": False, "error": "rol_requerido es requerido"}), 400

        try:
            # Obtener usuario que crea la regla (from g.user set by @require_admin)
            created_by = g.user.get("user_id") if hasattr(g, "user") and g.user else None

            resultado = crear_regla(
                nombre=data["nombre"],
                rol_requerido=data["rol_requerido"],
                nivel_aprobacion=data.get("nivel_aprobacion", 1),
                monto_minimo_usd=data.get("monto_minimo_usd", 0),
                monto_maximo_usd=data.get("monto_maximo_usd"),
                centro=data.get("centro"),
                sector=data.get("sector"),
                criticidad=data.get("criticidad"),
                requiere_justificacion=data.get("requiere_justificacion", False),
                requiere_documentacion=data.get("requiere_documentacion", False),
                descripcion=data.get("descripcion"),
                created_by=str(created_by) if created_by else None,
            )

            return jsonify({"ok": True, "id": resultado["id"]}), 201

        except ApprovalValidationError as e:
            return jsonify({"ok": False, "error": str(e)}), 400
        except Exception as e:
            logger.error(f"Error creando regla de aprobación: {e}")
            return jsonify({"ok": False, "error": "Error interno al crear la regla"}), 500

    # GET: Listar reglas
    solo_activas = request.args.get("activas", "true").lower() == "true"
    reglas = listar_reglas(solo_activas=solo_activas)

    return jsonify(reglas), 200


@bp.route("/reglas-aprobacion/<int:regla_id>", methods=["GET", "PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def admin_reglas_aprobacion_mod(regla_id):
    """
    GET: Obtiene detalle de una regla
    PUT: Actualiza una regla
    DELETE: Desactiva una regla (soft delete)
    """
    if request.method == "GET":
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id, nivel_aprobacion, monto_minimo_usd, monto_maximo_usd, centro, sector, criticidad, rol_requerido, descripcion, activo, created_at FROM reglas_aprobacion WHERE id = ?", (regla_id,))
            row = cur.fetchone()
            if not row:
                return jsonify({"ok": False, "error": "Regla no encontrada"}), 404
        return jsonify(dict(row)), 200

    elif request.method == "PUT":
        data = request.get_json(silent=True) or {}

        # Campos permitidos para actualizar
        campos_permitidos = {
            "nombre",
            "descripcion",
            "monto_minimo_usd",
            "monto_maximo_usd",
            "centro",
            "sector",
            "criticidad",
            "rol_requerido",
            "nivel_aprobacion",
            "requiere_justificacion",
            "requiere_documentacion",
            "activo",
        }

        campos = {k: v for k, v in data.items() if k in campos_permitidos}

        if not campos:
            return jsonify({"ok": False, "error": "No hay campos para actualizar"}), 400

        try:
            resultado = actualizar_regla(regla_id, **campos)
            if not resultado.get("actualizado"):
                return jsonify({"ok": False, "error": "Regla no encontrada o sin cambios"}), 404
            return jsonify({"ok": True}), 200
        except Exception as e:
            logger.error(f"Error actualizando regla: {e}")
            return jsonify({"ok": False, "error": "Error interno al procesar la solicitud"}), 500

    else:  # DELETE
        resultado = desactivar_regla(regla_id)
        if not resultado.get("desactivado"):
            return jsonify({"ok": False, "error": "Regla no encontrada"}), 404
        return jsonify({"ok": True}), 200


@bp.route("/delegaciones-aprobacion", methods=["GET", "POST"])
@require_admin
@rate_limit(requests=30, window_seconds=60)
def admin_delegaciones_aprobacion():
    """
    GET: Lista delegaciones de aprobacion activas
    POST: Crea una nueva delegacion temporal
    """
    if request.method == "POST":
        data = request.get_json(silent=True) or {}

        # Validar campos requeridos
        required = ["aprobador_original_id", "delegado_id", "fecha_inicio", "fecha_fin"]
        for field in required:
            if not data.get(field):
                return jsonify({"ok": False, "error": f"{field} es requerido"}), 400

        try:
            # Obtener usuario que crea la delegación (from g.user set by @require_admin)
            created_by = g.user.get("user_id") if hasattr(g, "user") and g.user else None

            resultado = crear_delegacion(
                aprobador_original_id=data["aprobador_original_id"],
                delegado_id=data["delegado_id"],
                fecha_inicio=data["fecha_inicio"],
                fecha_fin=data["fecha_fin"],
                motivo=data.get("motivo"),
                created_by=str(created_by) if created_by else None,
            )

            return jsonify({"ok": True, "id": resultado["id"]}), 201

        except ApprovalValidationError as e:
            return jsonify({"ok": False, "error": str(e)}), 400
        except Exception as e:
            logger.error(f"Error creando delegación: {e}")
            return jsonify({"ok": False, "error": "Error interno al crear la delegación"}), 500

    # GET: Listar delegaciones activas
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                d.*,
                u1.nombre || ' ' || u1.apellido as aprobador_nombre,
                u2.nombre || ' ' || u2.apellido as delegado_nombre
            FROM aprobadores_delegados d
            LEFT JOIN usuario u1 ON d.aprobador_original_id = u1.id_spm
            LEFT JOIN usuario u2 ON d.delegado_id = u2.id_spm
            WHERE d.activo = TRUE
            ORDER BY d.fecha_fin DESC
        """
        )
        rows = [dict(r) for r in cur.fetchall()]

    return jsonify(rows), 200


@bp.route("/delegaciones-aprobacion/<int:delegacion_id>", methods=["PUT", "DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def admin_delegaciones_aprobacion_mod(delegacion_id):
    """
    PUT: Actualiza una delegacion
    DELETE: Desactiva una delegacion
    """
    with get_db_transaction() as conn:
        cur = conn.cursor()

        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            campos = []
            valores = []

            if "fecha_fin" in data:
                campos.append("fecha_fin = ?")
                valores.append(data["fecha_fin"])
            if "motivo" in data:
                campos.append("motivo = ?")
                valores.append(data["motivo"])
            if "activo" in data:
                campos.append("activo = ?")
                valores.append(bool(data["activo"]))

            if not campos:
                return jsonify({"ok": False, "error": "No hay campos para actualizar"}), 400

            valores.append(delegacion_id)
            cur.execute(
                f"UPDATE aprobadores_delegados SET {', '.join(campos)} WHERE id = ?", valores
            )

        else:  # DELETE
            cur.execute(
                "UPDATE aprobadores_delegados SET activo = FALSE WHERE id = ?", (delegacion_id,)
            )

        if cur.rowcount == 0:
            return jsonify({"ok": False, "error": "Delegacion no encontrada"}), 404

    return jsonify({"ok": True}), 200


# ============================================================================
# Auto-Approval Rules (Sprint 40)
# ============================================================================


@bp.route("/auto-approval-rules", methods=["GET"])
@require_admin
def list_auto_approval_rules():
    """List all auto-approval rules."""
    import json

    try:
        from backend.services.auto_approval_service import AutoApprovalService

        rules = AutoApprovalService.get_rules()

        for rule in rules:
            if "condiciones_json" in rule:
                try:
                    rule["condiciones"] = json.loads(rule["condiciones_json"])
                except (json.JSONDecodeError, TypeError):
                    rule["condiciones"] = {}

        return jsonify({"ok": True, "rules": rules})

    except Exception as e:
        logger.error(f"Error listing auto-approval rules: {e}")
        return jsonify({"error": "Error al listar reglas"}), 500


@bp.route("/auto-approval-rules", methods=["POST"])
@require_admin
def create_auto_approval_rule():
    """Create a new auto-approval rule."""
    try:
        from backend.core.helpers import _get_user_id
        from backend.services.auto_approval_service import AutoApprovalService

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        user_id = _get_user_id()
        rule = AutoApprovalService.create_rule(data, user_id)

        if not rule:
            return jsonify({"error": "Failed to create rule"}), 400

        return jsonify({"ok": True, "rule": rule}), 201

    except Exception as e:
        logger.error(f"Error creating auto-approval rule: {e}")
        return jsonify({"error": "Error al crear regla"}), 500


@bp.route("/auto-approval-rules/<int:rule_id>", methods=["PUT"])
@require_admin
def update_auto_approval_rule(rule_id):
    """Update an existing auto-approval rule."""
    try:
        from backend.core.helpers import _get_user_id
        from backend.services.auto_approval_service import AutoApprovalService

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        user_id = _get_user_id()
        rule = AutoApprovalService.update_rule(rule_id, data, user_id)

        if not rule:
            return jsonify({"error": "Rule not found or update failed"}), 404

        return jsonify({"ok": True, "rule": rule})

    except Exception as e:
        logger.error(f"Error updating auto-approval rule {rule_id}: {e}")
        return jsonify({"error": "Error al actualizar regla"}), 500


@bp.route("/auto-approval-rules/<int:rule_id>", methods=["DELETE"])
@require_admin
def delete_auto_approval_rule(rule_id):
    """Delete an auto-approval rule."""
    try:
        from backend.core.helpers import _get_user_id
        from backend.services.auto_approval_service import AutoApprovalService

        user_id = _get_user_id()
        deleted = AutoApprovalService.delete_rule(rule_id, user_id)

        if not deleted:
            return jsonify({"error": "Rule not found"}), 404

        return jsonify({"ok": True, "message": "Rule deleted successfully"})

    except Exception as e:
        logger.error(f"Error deleting auto-approval rule {rule_id}: {e}")
        return jsonify({"error": "Error al eliminar regla"}), 500


@bp.route("/auto-approval-rules/simulate", methods=["POST"])
@require_admin
def simulate_auto_approval():
    """Simulate auto-approval on recent solicitudes."""
    try:
        from backend.services.auto_approval_service import AutoApprovalService

        data = request.get_json() or {}
        rule_id = data.get("rule_id")
        dias = min(data.get("dias", 30), 90)

        result = AutoApprovalService.simulate(rule_id=rule_id, dias=dias)

        return jsonify({"ok": True, **result})

    except Exception as e:
        logger.error(f"Error simulating auto-approval: {e}")
        return jsonify({"error": "Error al simular auto-aprobación"}), 500


@bp.route("/auto-approval/historial", methods=["GET"])
@require_admin
def auto_approval_historial():
    """
    Obtiene historial de solicitudes auto-aprobadas.

    Query params:
        limit: Límite de resultados (default: 50, max: 200)
        regla_id: Filtrar por regla específica (opcional)

    Returns:
        {
            "ok": true,
            "historial": [
                {
                    "solicitud_id": 123,
                    "fecha": "2026-02-15",
                    "regla_id": 1,
                    "regla_nombre": "Materiales bajo costo",
                    "confianza": 0.95,
                    "solicitante": "Juan Perez",
                    "monto_usd": 5000
                }
            ],
            "total": 10
        }
    """
    limit = min(int(request.args.get("limit", 50)), 200)
    regla_id = request.args.get("regla_id")

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Buscar en audit_trail eventos de auto_approval
            query = """
                SELECT
                    al.id,
                    al.event_type,
                    al.event_data,
                    al.created_at,
                    al.user_id,
                    u.nombre || ' ' || u.apellido as solicitante
                FROM audit_trail al
                LEFT JOIN usuario u ON al.user_id = u.id_spm
                WHERE al.event_type = 'auto_approval'
            """
            params = []

            if regla_id:
                # Event_data es JSON, buscar regla_id en el texto
                query += " AND al.event_data LIKE ?"
                params.append(f'%"regla_id":{regla_id}%')

            query += " ORDER BY al.created_at DESC LIMIT ?"
            params.append(limit)

            try:
                cursor.execute(query, params)
                audit_rows = [dict(r) for r in cursor.fetchall()]
            except Exception:
                # Tabla audit_trail puede no existir o no tener índice
                audit_rows = []

            # Alternativa: buscar solicitudes con estado=approved y flag auto_aprobada
            # (asumiendo que hay un campo auto_aprobada o similar)
            query_sol = """
                SELECT
                    s.id as solicitud_id,
                    s.created_at as fecha,
                    s.monto_usd,
                    u.nombre || ' ' || u.apellido as solicitante,
                    s.status
                FROM solicitud s
                LEFT JOIN usuario u ON s.solicitante_id = u.id
                WHERE s.status = 'approved'
                  AND s.auto_aprobada = 1
                ORDER BY s.created_at DESC
                LIMIT ?
            """
            try:
                cursor.execute(query_sol, (limit,))
                sol_rows = [dict(r) for r in cursor.fetchall()]
            except Exception:
                # Campo auto_aprobada puede no existir
                sol_rows = []

        # Combinar resultados
        historial = []

        for row in audit_rows:
            import json
            event_data = {}
            try:
                event_data = json.loads(row.get("event_data", "{}"))
            except (json.JSONDecodeError, TypeError):
                pass

            historial.append({
                "solicitud_id": event_data.get("solicitud_id"),
                "fecha": row.get("created_at"),
                "regla_id": event_data.get("regla_id"),
                "regla_nombre": event_data.get("regla_nombre", "Sin nombre"),
                "confianza": event_data.get("confianza", 1.0),
                "solicitante": row.get("solicitante", "Sistema"),
                "monto_usd": event_data.get("monto_usd", 0),
            })

        # Agregar solicitudes auto-aprobadas (si existen)
        for row in sol_rows:
            # Evitar duplicados
            if any(h["solicitud_id"] == row["solicitud_id"] for h in historial):
                continue

            historial.append({
                "solicitud_id": row["solicitud_id"],
                "fecha": row["fecha"],
                "regla_id": None,
                "regla_nombre": "Regla desconocida",
                "confianza": None,
                "solicitante": row["solicitante"],
                "monto_usd": row.get("monto_usd", 0),
            })

        # Ordenar por fecha descendente
        historial.sort(key=lambda x: x.get("fecha") or "", reverse=True)

        # Limitar resultados finales
        historial = historial[:limit]

        return jsonify({
            "ok": True,
            "historial": historial,
            "total": len(historial),
        })

    except Exception as e:
        logger.error(f"Error obteniendo historial auto-aprobación: {e}", exc_info=True)
        return jsonify({"ok": False, "error": {"code": "server_error", "message": str(e)}}), 500


# =============================================================================
# Escalation Rules CRUD
# =============================================================================


@bp.route("/escalation-rules", methods=["GET"])
@require_admin
def list_escalation_rules():
    """List all escalation rules."""
    try:
        from backend.services.escalation_service import EscalationService

        rules = EscalationService.get_rules(activo_only=False)
        return jsonify({"ok": True, "rules": rules})
    except Exception as e:
        logger.error(f"Error listing escalation rules: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@bp.route("/escalation-rules", methods=["POST"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def create_escalation_rule():
    """Create a new escalation rule."""
    try:
        from backend.services.escalation_service import EscalationService

        data = request.get_json() or {}
        centro = data.get("centro") or None
        criticidad = data.get("criticidad", "media")
        timeout_dias = max(1, int(data.get("timeout_dias", 3)))
        escalate_to_role = data.get("escalate_to_role", "admin")

        rule_id = EscalationService.create_rule(
            centro=centro,
            criticidad=criticidad,
            timeout_dias=timeout_dias,
            escalate_to_role=escalate_to_role,
        )

        return jsonify({"ok": True, "id": rule_id}), 201
    except Exception as e:
        logger.error(f"Error creating escalation rule: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@bp.route("/escalation-rules/<int:rule_id>", methods=["PUT"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def update_escalation_rule(rule_id):
    """Update an escalation rule."""
    try:
        from backend.services.escalation_service import EscalationService

        data = request.get_json() or {}
        updated = EscalationService.update_rule(rule_id, **data)

        if updated:
            return jsonify({"ok": True})
        return jsonify({"ok": False, "error": "Regla no encontrada"}), 404
    except Exception as e:
        logger.error(f"Error updating escalation rule: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@bp.route("/escalation-rules/<int:rule_id>", methods=["DELETE"])
@require_admin
@rate_limit(requests=20, window_seconds=60)
def delete_escalation_rule(rule_id):
    """Delete an escalation rule."""
    try:
        from backend.services.escalation_service import EscalationService

        deleted = EscalationService.delete_rule(rule_id)

        if deleted:
            return jsonify({"ok": True})
        return jsonify({"ok": False, "error": "Regla no encontrada"}), 404
    except Exception as e:
        logger.error(f"Error deleting escalation rule: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500
