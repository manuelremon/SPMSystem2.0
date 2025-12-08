"""
Admin routes - CRUD para catálogos y gestión básica
Protegido: requiere rol admin (token access)
"""

import sys

from flask import Blueprint, jsonify, request

try:
    from backend.core.cache import get_cache_stats, invalidate_catalog_cache, invalidate_user_cache
    from backend.core.config import settings
    from backend.core.db import get_db_connection, get_db_transaction, get_spm_db_path
    from backend.core.roles import is_admin, normalize_roles
    from backend.routes.auth import _decode_token
except ImportError:
    from core.cache import get_cache_stats, invalidate_catalog_cache, invalidate_user_cache
    from core.config import settings
    from core.db import get_db_connection, get_db_transaction, get_spm_db_path
    from core.roles import is_admin, normalize_roles

    from routes.auth import _decode_token

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _get_user(user_id: str):
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM usuarios WHERE id_spm=?", (str(user_id),))
        row = cur.fetchone()
        return dict(row) if row else None


def _require_admin():
    payload = _decode_token("access", "spm_token")
    if isinstance(payload, tuple):
        return None, payload
    return payload, None


def _admin_guard():
    payload, err = _require_admin()
    if err:
        return err
    user = _get_user(payload.get("user_id"))

    # Usar módulo centralizado de roles
    if not is_admin((user or {}).get("rol", "")):
        return jsonify({"ok": False, "error": "Requiere rol Administrador"}), 403

    return None


@bp.route("/centros", methods=["GET", "POST"])
def admin_centros():
    guard = _admin_guard()
    if guard:
        return guard

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("codigo"):
            return jsonify({"ok": False, "error": "codigo es requerido"}), 400
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO catalog_centros (codigo, nombre, activo) VALUES (?,?,?)",
                (data["codigo"], data.get("nombre"), 1),
            )
        invalidate_catalog_cache()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM catalog_centros")
        rows = [dict(r) for r in cur.fetchall()]
    return jsonify(rows), 200


@bp.route("/centros/<centro_codigo>", methods=["PUT", "DELETE"])
def admin_centros_mod(centro_codigo):
    guard = _admin_guard()
    if guard:
        return guard

    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                "UPDATE catalog_centros SET nombre=?, activo=? WHERE codigo=?",
                (data.get("nombre"), data.get("activo", 1), centro_codigo),
            )
        else:
            cur.execute("UPDATE catalog_centros SET activo=0 WHERE codigo=?", (centro_codigo,))

    invalidate_catalog_cache()
    return jsonify({"ok": True}), 200


@bp.route("/almacenes", methods=["GET", "POST"])
def admin_almacenes():
    guard = _admin_guard()
    if guard:
        return guard

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("codigo"):
            return jsonify({"ok": False, "error": "codigo requerido"}), 400
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO catalog_almacenes (codigo, nombre, activo) VALUES (?,?,?)",
                (data["codigo"], data.get("nombre"), 1),
            )
        invalidate_catalog_cache()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM catalog_almacenes")
        rows = [dict(r) for r in cur.fetchall()]
    return jsonify(rows), 200


@bp.route("/almacenes/<almacen_codigo>", methods=["PUT", "DELETE"])
def admin_almacenes_mod(almacen_codigo):
    guard = _admin_guard()
    if guard:
        return guard

    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                "UPDATE catalog_almacenes SET nombre=?, activo=? WHERE codigo=?",
                (data.get("nombre"), data.get("activo", 1), almacen_codigo),
            )
        else:
            cur.execute("UPDATE catalog_almacenes SET activo=0 WHERE codigo=?", (almacen_codigo,))

    invalidate_catalog_cache()
    return jsonify({"ok": True}), 200


@bp.route("/sectores", methods=["GET", "POST"])
def admin_sectores():
    guard = _admin_guard()
    if guard:
        return guard

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("nombre"):
            return jsonify({"ok": False, "error": "nombre requerido"}), 400
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO catalog_sectores (nombre, activo) VALUES (?,?)",
                (data["nombre"], 1),
            )
        invalidate_catalog_cache()

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM catalog_sectores")
        rows = [dict(r) for r in cur.fetchall()]
    return jsonify(rows), 200


@bp.route("/sectores/<sector_nombre>", methods=["PUT", "DELETE"])
def admin_sectores_mod(sector_nombre):
    guard = _admin_guard()
    if guard:
        return guard

    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                "UPDATE catalog_sectores SET activo=? WHERE nombre=?",
                (data.get("activo", 1), sector_nombre),
            )
        else:
            cur.execute("UPDATE catalog_sectores SET activo=0 WHERE nombre=?", (sector_nombre,))

    invalidate_catalog_cache()
    return jsonify({"ok": True}), 200


@bp.route("/usuarios", methods=["GET", "POST"])
def admin_usuarios():
    guard = _admin_guard()
    if guard:
        return guard

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

        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO usuarios (id_spm, nombre, apellido, rol, contrasena, mail, posicion, sector, centros, jefe, gerente1, gerente2, telefono, estado_registro, id_ypf)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    data["id_spm"],
                    data["nombre"],
                    data["apellido"],
                    rol_csv,
                    data["contrasena"],
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
        cur.execute("SELECT * FROM usuarios")
        rows = []
        for r in cur.fetchall():
            row_dict = dict(r)
            row_dict["roles"] = normalize_roles(row_dict.get("rol", ""))
            rows.append(row_dict)

    return jsonify(rows), 200


@bp.route("/usuarios/<id_spm>", methods=["GET", "PUT", "DELETE"])
def admin_usuarios_mod(id_spm):
    guard = _admin_guard()
    if guard:
        return guard

    if request.method == "GET":
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM usuarios WHERE id_spm=?", (id_spm,))
            row = cur.fetchone()
            if not row:
                return jsonify({"ok": False, "error": "Usuario no encontrado"}), 404

            row_dict = dict(row)
            row_dict["roles"] = normalize_roles(row_dict.get("rol", ""))
        return jsonify(row_dict), 200

    elif request.method == "PUT":
        data = request.get_json(silent=True) or {}
        print(f"[DEBUG] Actualizando usuario {id_spm} con datos: {data}")

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
                query = f"UPDATE usuarios SET {', '.join(update_fields)} WHERE id_spm=?"
                print(f"[DEBUG] Ejecutando query: {query}")
                print(f"[DEBUG] Con valores: {values}")
                cur.execute(query, values)
                print(f"[DEBUG] Filas afectadas: {cur.rowcount}")
        except Exception as e:
            print(f"[ERROR] Error en UPDATE: {e}")
            return jsonify({"ok": False, "error": str(e)}), 500
    else:
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute("UPDATE usuarios SET estado_registro='Inactivo' WHERE id_spm=?", (id_spm,))

    invalidate_user_cache(id_spm)
    invalidate_catalog_cache()
    return jsonify({"ok": True}), 200


@bp.route("/planificadores", methods=["GET", "POST"])
def admin_planificadores():
    guard = _admin_guard()
    if guard:
        return guard

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("usuario_id"):
            return jsonify({"ok": False, "error": "usuario_id requerido"}), 400
        asignaciones = data.get("asignaciones") or []
        with get_db_transaction() as conn:
            cur = conn.cursor()
            for a in asignaciones:
                cur.execute(
                    "INSERT OR IGNORE INTO planificador_asignaciones (planificador_id, centro, sector, almacen_virtual, activo) VALUES (?,?,?,?,1)",
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
            "SELECT id_spm, nombre, apellido, rol FROM usuarios WHERE rol LIKE '%Planificador%'"
        )
        planners = [
            {"usuario_id": r["id_spm"], "nombre": f"{r['nombre']} {r['apellido']}", "activo": 1}
            for r in cur.fetchall()
        ]
        cur.execute("SELECT * FROM planificador_asignaciones")
        asign = [dict(r) for r in cur.fetchall()]

    return jsonify({"planificadores": planners, "asignaciones": asign}), 200


@bp.route("/planificadores/<usuario_id>", methods=["PUT", "DELETE"])
def admin_planificadores_mod(usuario_id):
    guard = _admin_guard()
    if guard:
        return guard

    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            if "asignaciones" in data:
                cur.execute(
                    "DELETE FROM planificador_asignaciones WHERE planificador_id=?", (usuario_id,)
                )
                for a in data.get("asignaciones") or []:
                    cur.execute(
                        "INSERT OR IGNORE INTO planificador_asignaciones (planificador_id, centro, sector, almacen_virtual, activo) VALUES (?,?,?,?,1)",
                        (usuario_id, a.get("centro"), a.get("sector"), a.get("almacen_virtual")),
                    )
        else:
            cur.execute(
                "UPDATE planificador_asignaciones SET activo=0 WHERE planificador_id=?",
                (usuario_id,),
            )

    return jsonify({"ok": True}), 200


@bp.route("/presupuestos", methods=["GET", "POST"])
def admin_presupuestos():
    guard = _admin_guard()
    if guard:
        return guard

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("centro") or not data.get("sector"):
            return jsonify({"ok": False, "error": "centro y sector son requeridos"}), 400
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT OR REPLACE INTO presupuestos (centro, sector, monto_usd, saldo_usd) VALUES (?,?,?,?)",
                (
                    data["centro"],
                    data["sector"],
                    data.get("monto_usd", 0),
                    data.get("saldo_usd", data.get("monto_usd", 0)),
                ),
            )

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM presupuestos")
        rows = [dict(r) for r in cur.fetchall()]

    return jsonify(rows), 200


@bp.route("/presupuestos/<centro>/<sector>", methods=["PUT", "DELETE"])
def admin_presupuestos_mod(centro, sector):
    guard = _admin_guard()
    if guard:
        return guard

    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                "UPDATE presupuestos SET monto_usd=?, saldo_usd=? WHERE centro=? AND sector=?",
                (data.get("monto_usd", 0), data.get("saldo_usd", 0), centro, sector),
            )
        else:
            cur.execute("DELETE FROM presupuestos WHERE centro=? AND sector=?", (centro, sector))

    return jsonify({"ok": True}), 200


@bp.route("/estado", methods=["GET"])
def admin_estado():
    guard = _admin_guard()
    if guard:
        return guard

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
def admin_metricas():
    guard = _admin_guard()
    if guard:
        return guard

    import logging

    counts = {}
    ALLOWED_TABLES = {"usuarios", "materiales", "solicitudes"}
    table_key_map = [
        ("usuarios", "usuarios"),
        ("materiales", "materiales"),
        ("solicitudes", "solicitudes_totales"),
    ]

    with get_db_connection() as conn:
        cur = conn.cursor()
        for table, key in table_key_map:
            if table not in ALLOWED_TABLES:
                counts[key] = 0
                continue
            try:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                counts[key] = cur.fetchone()[0]
            except Exception as e:
                logging.getLogger(__name__).warning(f"Error contando {table}: {e}")
                counts[key] = 0
        try:
            cur.execute("SELECT status, COUNT(*) FROM solicitudes GROUP BY status")
            for status, c in cur.fetchall():
                counts[f"solicitudes_{status.lower()}"] = c
        except Exception as e:
            logging.getLogger(__name__).warning(f"Error obteniendo status de solicitudes: {e}")

    return jsonify(counts), 200


# ==============================================================================
# CONFIG ALMACENES (Libre disponibilidad, exclusiones)
# ==============================================================================


@bp.route("/config/almacenes", methods=["GET", "POST"])
def admin_config_almacenes():
    guard = _admin_guard()
    if guard:
        return guard

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("centro") or not data.get("almacen"):
            return jsonify({"ok": False, "error": "centro y almacen son requeridos"}), 400

        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO config_almacenes (centro, almacen, nombre, libre_disponibilidad, responsable_id, excluido, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(centro, almacen) DO UPDATE SET
                    nombre = excluded.nombre,
                    libre_disponibilidad = excluded.libre_disponibilidad,
                    responsable_id = excluded.responsable_id,
                    excluido = excluded.excluido,
                    updated_at = datetime('now')
            """,
                (
                    data["centro"],
                    data["almacen"],
                    data.get("nombre"),
                    1 if data.get("libre_disponibilidad") else 0,
                    data.get("responsable_id"),
                    1 if data.get("excluido") else 0,
                ),
            )

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT ca.*, u.nombre as responsable_nombre, u.apellido as responsable_apellido
            FROM config_almacenes ca
            LEFT JOIN usuarios u ON ca.responsable_id = u.id_spm
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
def admin_config_almacenes_mod(centro, almacen):
    guard = _admin_guard()
    if guard:
        return guard

    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                """
                UPDATE config_almacenes
                SET nombre = ?, libre_disponibilidad = ?, responsable_id = ?, excluido = ?, updated_at = datetime('now')
                WHERE centro = ? AND almacen = ?
            """,
                (
                    data.get("nombre"),
                    1 if data.get("libre_disponibilidad") else 0,
                    data.get("responsable_id"),
                    1 if data.get("excluido") else 0,
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
def admin_proveedores_externos():
    """
    GET: Lista proveedores externos con sus contactos/emails
    POST: Crea un nuevo proveedor externo
    """
    guard = _admin_guard()
    if guard:
        return guard

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
                INSERT INTO proveedores_externos
                    (cuit, nombre, direccion, localidad, pais, origen, lead_time_dias, rubro, calificacion, activo, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
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
                    updated_at = datetime('now')
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
                cur.execute(
                    """
                    INSERT OR REPLACE INTO proveedor_ext_emails (cuit_proveedor, email, tipo, es_principal)
                    VALUES (?, ?, 'comercial', 1)
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
                (SELECT email FROM proveedor_ext_emails WHERE cuit_proveedor = pe.cuit AND es_principal = 1 LIMIT 1) as email_principal,
                (SELECT COUNT(*) FROM proveedor_ext_contactos WHERE cuit_proveedor = pe.cuit) as num_contactos
            FROM proveedores_externos pe
            ORDER BY pe.nombre
        """
        )
        rows = [dict(r) for r in cur.fetchall()]

    return jsonify(rows), 200


@bp.route("/proveedores/externos/<cuit>", methods=["GET", "PUT", "DELETE"])
def admin_proveedores_externos_mod(cuit):
    """
    GET: Detalle completo de un proveedor (con contactos, emails, teléfonos)
    PUT: Actualiza un proveedor
    DELETE: Desactiva un proveedor (soft delete)
    """
    guard = _admin_guard()
    if guard:
        return guard

    if request.method == "GET":
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Datos principales
            cur.execute("SELECT * FROM proveedores_externos WHERE cuit = ?", (cuit,))
            prov = cur.fetchone()
            if not prov:
                return jsonify({"ok": False, "error": "Proveedor no encontrado"}), 404

            result = dict(prov)

            # Contactos
            cur.execute(
                "SELECT * FROM proveedor_ext_contactos WHERE cuit_proveedor = ? ORDER BY es_principal DESC",
                (cuit,),
            )
            result["contactos"] = [dict(r) for r in cur.fetchall()]

            # Emails
            cur.execute(
                "SELECT * FROM proveedor_ext_emails WHERE cuit_proveedor = ? ORDER BY es_principal DESC",
                (cuit,),
            )
            result["emails"] = [dict(r) for r in cur.fetchall()]

            # Teléfonos
            cur.execute("SELECT * FROM proveedor_ext_telefonos WHERE cuit_proveedor = ?", (cuit,))
            result["telefonos"] = [dict(r) for r in cur.fetchall()]

        return jsonify(result), 200

    with get_db_transaction() as conn:
        cur = conn.cursor()
        if request.method == "PUT":
            data = request.get_json(silent=True) or {}
            cur.execute(
                """
                UPDATE proveedores_externos
                SET nombre = ?, direccion = ?, localidad = ?, pais = ?,
                    origen = ?, lead_time_dias = ?, rubro = ?,
                    calificacion = ?, activo = ?, notas = ?, updated_at = datetime('now')
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
                    1 if data.get("activo", True) else 0,
                    data.get("notas"),
                    cuit,
                ),
            )
        else:  # DELETE
            cur.execute(
                "UPDATE proveedores_externos SET activo = 0, updated_at = datetime('now') WHERE cuit = ?",
                (cuit,),
            )

    return jsonify({"ok": True}), 200


# ==============================================================================
# PROVEEDORES INTERNOS (Almacenes YPF)
# ==============================================================================


@bp.route("/proveedores/internos", methods=["GET", "POST"])
def admin_proveedores_internos():
    """
    GET: Lista proveedores internos (almacenes)
    POST: Crea/actualiza un proveedor interno
    """
    guard = _admin_guard()
    if guard:
        return guard

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("centro") or not data.get("almacen"):
            return jsonify({"ok": False, "error": "centro y almacen son requeridos"}), 400

        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO proveedores_internos
                    (centro, almacen, centro_nombre, almacen_nombre, sector,
                     contacto_centro, responsable_centro, referente_id, referente_nombre, referente_email,
                     activo, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
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
                    updated_at = datetime('now')
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
            FROM proveedores_internos pi
            LEFT JOIN usuarios u ON pi.referente_id = u.id_spm
            ORDER BY pi.centro, pi.almacen
        """
        )
        rows = [dict(r) for r in cur.fetchall()]

    return jsonify(rows), 200


@bp.route("/proveedores/internos/<centro>/<almacen>", methods=["GET", "PUT", "DELETE"])
def admin_proveedores_internos_mod(centro, almacen):
    """
    GET: Detalle de un proveedor interno
    PUT: Actualiza un proveedor interno
    DELETE: Desactiva un proveedor interno
    """
    guard = _admin_guard()
    if guard:
        return guard

    if request.method == "GET":
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT pi.*, u.nombre || ' ' || u.apellido as referente_usuario_nombre
                FROM proveedores_internos pi
                LEFT JOIN usuarios u ON pi.referente_id = u.id_spm
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
                UPDATE proveedores_internos
                SET centro_nombre = ?, almacen_nombre = ?, sector = ?,
                    contacto_centro = ?, responsable_centro = ?,
                    referente_id = ?, referente_nombre = ?, referente_email = ?,
                    activo = ?, notas = ?, updated_at = datetime('now')
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
                    1 if data.get("activo", True) else 0,
                    data.get("notas"),
                    centro,
                    almacen,
                ),
            )
        else:  # DELETE
            cur.execute(
                "UPDATE proveedores_internos SET activo = 0, updated_at = datetime('now') WHERE centro = ? AND almacen = ?",
                (centro, almacen),
            )

    return jsonify({"ok": True}), 200


# ==============================================================================
# CACHE STATS (for monitoring)
# ==============================================================================


@bp.route("/cache/stats", methods=["GET"])
def admin_cache_stats():
    """Get cache statistics for monitoring performance"""
    guard = _admin_guard()
    if guard:
        return guard

    stats = get_cache_stats()
    return jsonify({"ok": True, "cache": stats}), 200


@bp.route("/cache/clear", methods=["POST"])
def admin_cache_clear():
    """Clear all caches (use after major data changes)"""
    guard = _admin_guard()
    if guard:
        return guard

    invalidate_catalog_cache()
    invalidate_user_cache()

    return jsonify({"ok": True, "message": "All caches cleared"}), 200
