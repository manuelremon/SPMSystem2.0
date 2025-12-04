"""
Admin routes - CRUD para catálogos y gestión básica
Protegido: requiere rol admin (token access)
"""

import sqlite3
import sys
from pathlib import Path

from flask import Blueprint, jsonify, request

try:
    from backend_v2.core.config import settings
    from backend_v2.routes.auth import _decode_token
except ImportError:
    from core.config import settings
    from routes.auth import _decode_token

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _db_path() -> Path:
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _connect():
    return sqlite3.connect(_db_path())


def _get_user(user_id: str):
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM usuarios WHERE id_spm=?", (str(user_id),))
    row = cur.fetchone()
    conn.close()
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

    # Obtener roles - formato CSV: "Admin, Planificador, Solicitante"
    rol_value = (user or {}).get("rol", "")

    # Parsear como CSV
    if rol_value:
        roles = [r.strip() for r in rol_value.split(",")]
    else:
        roles = []

    # Normalizar roles a lowercase para comparación
    roles_lower = [str(r).lower() for r in roles]

    # Verificar si tiene rol de admin
    if not any(r in ("administrador", "admin") for r in roles_lower):
        return jsonify({"ok": False, "error": "Requiere rol Administrador"}), 403

    return None


@bp.route("/centros", methods=["GET", "POST"])
def admin_centros():
    guard = _admin_guard()
    if guard:
        return guard
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("codigo"):
            return jsonify({"ok": False, "error": "codigo es requerido"}), 400
        cur.execute(
            "INSERT INTO catalog_centros (codigo, nombre, activo) VALUES (?,?,?)",
            (data["codigo"], data.get("nombre"), 1),
        )
        conn.commit()
    cur.execute("SELECT * FROM catalog_centros")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify(rows), 200


@bp.route("/centros/<centro_codigo>", methods=["PUT", "DELETE"])
def admin_centros_mod(centro_codigo):
    guard = _admin_guard()
    if guard:
        return guard
    conn = _connect()
    cur = conn.cursor()
    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        cur.execute(
            "UPDATE catalog_centros SET nombre=?, activo=? WHERE codigo=?",
            (
                data.get("nombre"),
                data.get("activo", 1),
                centro_codigo,
            ),
        )
    else:
        cur.execute("UPDATE catalog_centros SET activo=0 WHERE codigo=?", (centro_codigo,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True}), 200


@bp.route("/almacenes", methods=["GET", "POST"])
def admin_almacenes():
    guard = _admin_guard()
    if guard:
        return guard
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("codigo"):
            return jsonify({"ok": False, "error": "codigo requerido"}), 400
        cur.execute(
            "INSERT INTO catalog_almacenes (codigo, nombre, activo) VALUES (?,?,?)",
            (data["codigo"], data.get("nombre"), 1),
        )
        conn.commit()
    cur.execute("SELECT * FROM catalog_almacenes")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify(rows), 200


@bp.route("/almacenes/<almacen_codigo>", methods=["PUT", "DELETE"])
def admin_almacenes_mod(almacen_codigo):
    guard = _admin_guard()
    if guard:
        return guard
    conn = _connect()
    cur = conn.cursor()
    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        cur.execute(
            "UPDATE catalog_almacenes SET nombre=?, activo=? WHERE codigo=?",
            (
                data.get("nombre"),
                data.get("activo", 1),
                almacen_codigo,
            ),
        )
    else:
        cur.execute("UPDATE catalog_almacenes SET activo=0 WHERE codigo=?", (almacen_codigo,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True}), 200


@bp.route("/sectores", methods=["GET", "POST"])
def admin_sectores():
    guard = _admin_guard()
    if guard:
        return guard
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("nombre"):
            return jsonify({"ok": False, "error": "nombre requerido"}), 400
        cur.execute(
            "INSERT INTO catalog_sectores (nombre, activo) VALUES (?,?)",
            (data["nombre"], 1),
        )
        conn.commit()
    cur.execute("SELECT * FROM catalog_sectores")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify(rows), 200


@bp.route("/sectores/<sector_nombre>", methods=["PUT", "DELETE"])
def admin_sectores_mod(sector_nombre):
    guard = _admin_guard()
    if guard:
        return guard
    conn = _connect()
    cur = conn.cursor()
    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        cur.execute(
            "UPDATE catalog_sectores SET activo=? WHERE nombre=?",
            (data.get("activo", 1), sector_nombre),
        )
    else:
        cur.execute("UPDATE catalog_sectores SET activo=0 WHERE nombre=?", (sector_nombre,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True}), 200


@bp.route("/usuarios", methods=["GET", "POST"])
def admin_usuarios():
    guard = _admin_guard()
    if guard:
        return guard
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
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

        cur.execute(
            """INSERT INTO usuarios (id_spm, nombre, apellido, rol, contrasena, mail, posicion, sector, centros, jefe, gerente1, gerente2, telefono, estado_registro, id_ypf)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                data["id_spm"],
                data["nombre"],
                data["apellido"],
                rol_csv,  # Guardamos como CSV
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
        conn.commit()

    # Obtener usuarios y normalizar formato de roles
    cur.execute("SELECT * FROM usuarios")
    rows = []
    for r in cur.fetchall():
        row_dict = dict(r)
        # Parsear campo rol CSV → roles como array
        rol_value = row_dict.get("rol", "")
        if rol_value:
            roles_array = [r.strip() for r in rol_value.split(",")]
        else:
            roles_array = []

        row_dict["roles"] = roles_array  # Agregar campo 'roles' (plural)
        rows.append(row_dict)

    conn.close()
    return jsonify(rows), 200


@bp.route("/usuarios/<id_spm>", methods=["GET", "PUT", "DELETE"])
def admin_usuarios_mod(id_spm):
    guard = _admin_guard()
    if guard:
        return guard
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    if request.method == "GET":
        cur.execute("SELECT * FROM usuarios WHERE id_spm=?", (id_spm,))
        row = cur.fetchone()
        conn.close()
        if not row:
            return jsonify({"ok": False, "error": "Usuario no encontrado"}), 404

        # Parsear roles CSV a array
        row_dict = dict(row)
        rol_value = row_dict.get("rol", "")
        if rol_value:
            roles_array = [r.strip() for r in rol_value.split(",")]
        else:
            roles_array = []

        row_dict["roles"] = roles_array
        return jsonify(row_dict), 200

    elif request.method == "PUT":
        data = request.get_json(silent=True) or {}
        print(f"[DEBUG] Actualizando usuario {id_spm} con datos: {data}")

        # Construir UPDATE dinámicamente solo con los campos presentes
        update_fields = []
        values = []

        # Mapeo de campos permitidos
        allowed_fields = {
            "nombre": "nombre",
            "apellido": "apellido",
            "rol": "rol",
            "roles": "rol",  # Frontend envía 'roles', guardamos en 'rol'
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
            "puesto": "posicion",  # Frontend envía 'puesto', guardamos en 'posicion'
            "id_ypf": "id_ypf",
            "mail_respaldo": "mail_respaldo",
            "almacenes": "almacenes",
        }

        # Flag para evitar procesar 'rol' dos veces
        rol_processed = False

        for key, db_field in allowed_fields.items():
            if key in data:
                value = data[key]

                # Manejo especial para roles: convertir array a CSV
                if key in ["roles", "rol"]:
                    # Si ya procesamos el campo rol, saltar
                    if rol_processed:
                        continue

                    if isinstance(value, list):
                        value = ", ".join(value)
                    # Validar que no esté vacío
                    if not value:
                        conn.close()
                        return (
                            jsonify({"ok": False, "error": "Campo roles no puede estar vacío"}),
                            400,
                        )

                    update_fields.append("rol=?")
                    values.append(value)
                    rol_processed = True
                    continue

                # Manejo especial para centros y almacenes: convertir array a string CSV
                if key in ["centros", "almacenes"] and isinstance(value, list):
                    value = ",".join(str(v) for v in value)

                update_fields.append(f"{db_field}=?")
                values.append(value)

        if not update_fields:
            conn.close()
            return jsonify({"ok": False, "error": "No hay campos para actualizar"}), 400

        values.append(id_spm)

        try:
            query = f"UPDATE usuarios SET {', '.join(update_fields)} WHERE id_spm=?"
            print(f"[DEBUG] Ejecutando query: {query}")
            print(f"[DEBUG] Con valores: {values}")
            cur.execute(query, values)
            print(f"[DEBUG] Filas afectadas: {cur.rowcount}")
        except Exception as e:
            print(f"[ERROR] Error en UPDATE: {e}")
            conn.close()
            return jsonify({"ok": False, "error": str(e)}), 500
    else:
        cur.execute("UPDATE usuarios SET estado_registro='Inactivo' WHERE id_spm=?", (id_spm,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True}), 200


@bp.route("/planificadores", methods=["GET", "POST"])
def admin_planificadores():
    guard = _admin_guard()
    if guard:
        return guard
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("usuario_id"):
            return jsonify({"ok": False, "error": "usuario_id requerido"}), 400
        # Agregar asignaciones directamente
        asignaciones = data.get("asignaciones") or []
        for a in asignaciones:
            cur.execute(
                "INSERT OR IGNORE INTO planificador_asignaciones (planificador_id, centro, sector, almacen_virtual, activo) VALUES (?,?,?,?,1)",
                (data["usuario_id"], a.get("centro"), a.get("sector"), a.get("almacen_virtual")),
            )
        conn.commit()
    # Obtener usuarios con rol Planificador
    cur.execute(
        "SELECT id_spm, nombre, apellido, rol FROM usuarios WHERE rol LIKE '%Planificador%'"
    )
    planners = []
    for r in cur.fetchall():
        planners.append(
            {"usuario_id": r["id_spm"], "nombre": f"{r['nombre']} {r['apellido']}", "activo": 1}
        )
    cur.execute("SELECT * FROM planificador_asignaciones")
    asign = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({"planificadores": planners, "asignaciones": asign}), 200


@bp.route("/planificadores/<usuario_id>", methods=["PUT", "DELETE"])
def admin_planificadores_mod(usuario_id):
    guard = _admin_guard()
    if guard:
        return guard
    conn = _connect()
    cur = conn.cursor()
    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        # Reset asignaciones
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
        # Desactivar asignaciones del planificador
        cur.execute(
            "UPDATE planificador_asignaciones SET activo=0 WHERE planificador_id=?", (usuario_id,)
        )
    conn.commit()
    conn.close()
    return jsonify({"ok": True}), 200


@bp.route("/presupuestos", methods=["GET", "POST"])
def admin_presupuestos():
    guard = _admin_guard()
    if guard:
        return guard
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("centro") or not data.get("sector"):
            return jsonify({"ok": False, "error": "centro y sector son requeridos"}), 400
        cur.execute(
            "INSERT OR REPLACE INTO presupuestos (centro, sector, monto_usd, saldo_usd) VALUES (?,?,?,?)",
            (
                data["centro"],
                data["sector"],
                data.get("monto_usd", 0),
                data.get("saldo_usd", data.get("monto_usd", 0)),
            ),
        )
        conn.commit()
    cur.execute("SELECT * FROM presupuestos")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify(rows), 200


@bp.route("/presupuestos/<centro>/<sector>", methods=["PUT", "DELETE"])
def admin_presupuestos_mod(centro, sector):
    guard = _admin_guard()
    if guard:
        return guard
    conn = _connect()
    cur = conn.cursor()
    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        cur.execute(
            "UPDATE presupuestos SET monto_usd=?, saldo_usd=? WHERE centro=? AND sector=?",
            (data.get("monto_usd", 0), data.get("saldo_usd", 0), centro, sector),
        )
    else:
        cur.execute("DELETE FROM presupuestos WHERE centro=? AND sector=?", (centro, sector))
    conn.commit()
    conn.close()
    return jsonify({"ok": True}), 200


@bp.route("/estado", methods=["GET"])
def admin_estado():
    guard = _admin_guard()
    if guard:
        return guard
    db_exists = _db_path().exists()
    return (
        jsonify(
            {
                "ok": True,
                "version_spm": "v2.0",
                "python_version": sys.version,
                "db_path": str(_db_path()),
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
    conn = _connect()
    cur = conn.cursor()
    counts = {}

    # Whitelist de tablas permitidas para evitar SQL injection
    ALLOWED_TABLES = {"usuarios", "materiales", "solicitudes"}
    table_key_map = [
        ("usuarios", "usuarios"),
        ("materiales", "materiales"),
        ("solicitudes", "solicitudes_totales"),
    ]

    for table, key in table_key_map:
        if table not in ALLOWED_TABLES:
            counts[key] = 0
            continue
        try:
            # Seguro porque table está en whitelist
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            counts[key] = cur.fetchone()[0]
        except Exception as e:
            import logging

            logging.getLogger(__name__).warning(f"Error contando {table}: {e}")
            counts[key] = 0
    try:
        cur.execute("SELECT status, COUNT(*) FROM solicitudes GROUP BY status")
        for status, c in cur.fetchall():
            counts[f"solicitudes_{status.lower()}"] = c
    except Exception as e:
        import logging

        logging.getLogger(__name__).warning(f"Error obteniendo status de solicitudes: {e}")
    conn.close()
    return jsonify(counts), 200


# ==============================================================================
# PROVEEDORES INTERNOS (Config Almacenes)
# ==============================================================================


@bp.route("/proveedores/internos", methods=["GET", "POST"])
def admin_proveedores_internos():
    guard = _admin_guard()
    if guard:
        return guard

    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("centro") or not data.get("almacen"):
            conn.close()
            return jsonify({"ok": False, "error": "centro y almacen son requeridos"}), 400

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
        conn.commit()

    # Obtener todos los almacenes con info del responsable
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

    conn.close()
    return jsonify(rows), 200


@bp.route("/proveedores/internos/<centro>/<almacen>", methods=["PUT", "DELETE"])
def admin_proveedores_internos_mod(centro, almacen):
    guard = _admin_guard()
    if guard:
        return guard

    conn = _connect()
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

    conn.commit()
    conn.close()
    return jsonify({"ok": True}), 200


# ==============================================================================
# PROVEEDORES EXTERNOS
# ==============================================================================


@bp.route("/proveedores/externos", methods=["GET", "POST"])
def admin_proveedores_externos():
    guard = _admin_guard()
    if guard:
        return guard

    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if not data.get("nombre"):
            conn.close()
            return jsonify({"ok": False, "error": "nombre es requerido"}), 400

        # Generar id_proveedor si no existe
        id_prov = data.get("id_proveedor")
        if not id_prov:
            cur.execute(
                "SELECT MAX(CAST(SUBSTR(id_proveedor, 5) AS INTEGER)) FROM proveedores WHERE id_proveedor LIKE 'PROV%'"
            )
            max_num = cur.fetchone()[0] or 0
            id_prov = f"PROV{str(max_num + 1).zfill(3)}"

        cur.execute(
            """
            INSERT INTO proveedores (id_proveedor, nombre, tipo, plazo_entrega_dias, rating, activo, created_at)
            VALUES (?, ?, 'externo', ?, ?, 1, datetime('now'))
            ON CONFLICT(id_proveedor) DO UPDATE SET
                nombre = excluded.nombre,
                plazo_entrega_dias = excluded.plazo_entrega_dias,
                rating = excluded.rating,
                activo = excluded.activo
        """,
            (id_prov, data["nombre"], data.get("plazo_entrega_dias", 7), data.get("rating", 3.0)),
        )
        conn.commit()

    # Obtener proveedores externos
    cur.execute("SELECT * FROM proveedores WHERE tipo = 'externo' ORDER BY nombre")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify(rows), 200


@bp.route("/proveedores/externos/<id_proveedor>", methods=["PUT", "DELETE"])
def admin_proveedores_externos_mod(id_proveedor):
    guard = _admin_guard()
    if guard:
        return guard

    conn = _connect()
    cur = conn.cursor()

    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        cur.execute(
            """
            UPDATE proveedores
            SET nombre = ?, plazo_entrega_dias = ?, rating = ?, activo = ?
            WHERE id_proveedor = ?
        """,
            (
                data.get("nombre"),
                data.get("plazo_entrega_dias", 7),
                data.get("rating", 3.0),
                1 if data.get("activo", True) else 0,
                id_proveedor,
            ),
        )
    else:
        # Soft delete - solo desactivar
        cur.execute("UPDATE proveedores SET activo = 0 WHERE id_proveedor = ?", (id_proveedor,))

    conn.commit()
    conn.close()
    return jsonify({"ok": True}), 200
