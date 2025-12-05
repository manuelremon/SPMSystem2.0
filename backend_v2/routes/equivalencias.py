"""
Rutas para gestión de equivalencias de materiales
CRUD completo con permisos para Admin y Planificador
"""

import sqlite3
from functools import wraps

from flask import Blueprint, g, jsonify, request

bp = Blueprint("equivalencias", __name__, url_prefix="/api/equivalencias")


def get_db_connection():
    """Obtiene conexión directa a SQLite"""
    from flask import current_app

    db_path = current_app.config.get("SQLALCHEMY_DATABASE_URI", "").replace("sqlite:///", "")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def require_auth(f):
    """Decorator que requiere autenticación"""

    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, "user") or not g.user:
            return (
                jsonify(
                    {"ok": False, "error": {"code": "unauthorized", "message": "No autenticado"}}
                ),
                401,
            )
        return f(*args, **kwargs)

    return decorated


def require_admin_or_planner(f):
    """Decorator que requiere rol Admin o Planificador"""

    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, "user") or not g.user:
            return (
                jsonify(
                    {"ok": False, "error": {"code": "unauthorized", "message": "No autenticado"}}
                ),
                401,
            )

        roles = g.user.get("rol", "").lower()
        is_admin = "admin" in roles
        is_planner = "planificador" in roles

        if not (is_admin or is_planner):
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "forbidden",
                            "message": "Requiere rol Admin o Planificador",
                        },
                    }
                ),
                403,
            )

        return f(*args, **kwargs)

    return decorated


@bp.route("", methods=["GET"])
@require_auth
def listar_equivalencias():
    """
    Lista equivalencias de materiales con búsqueda opcional.

    Query params:
        q: Búsqueda por código o descripción
        limit: Número de resultados (default 50, max 200)
        offset: Offset para paginación (default 0)
    """
    q = request.args.get("q", "").strip()
    limit = min(int(request.args.get("limit", 50)), 200)
    offset = int(request.args.get("offset", 0))

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Query base con JOIN a materiales para obtener descripciones
        base_query = """
            SELECT
                e.id_equivalencia,
                e.codigo_original,
                m1.descripcion as descripcion_original,
                e.codigo_equivalente,
                m2.descripcion as descripcion_equivalente,
                e.compatibilidad_pct,
                e.descripcion,
                e.notas,
                e.activo,
                e.created_at
            FROM material_equivalencias e
            LEFT JOIN materiales m1 ON e.codigo_original = m1.codigo
            LEFT JOIN materiales m2 ON e.codigo_equivalente = m2.codigo
            WHERE e.activo = 1
        """

        params = []

        if q:
            base_query += """
                AND (
                    e.codigo_original LIKE ? OR
                    e.codigo_equivalente LIKE ? OR
                    m1.descripcion LIKE ? OR
                    m2.descripcion LIKE ?
                )
            """
            search_term = f"%{q}%"
            params.extend([search_term, search_term, search_term, search_term])

        # Contar total
        count_query = f"SELECT COUNT(*) FROM ({base_query})"
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]

        # Obtener resultados con paginación
        base_query += " ORDER BY e.codigo_original, e.compatibilidad_pct DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor.execute(base_query, params)
        rows = cursor.fetchall()

        equivalencias = []
        for row in rows:
            equivalencias.append(
                {
                    "id": row["id_equivalencia"],
                    "codigo_original": row["codigo_original"],
                    "descripcion_original": row["descripcion_original"] or "Sin descripción",
                    "codigo_equivalente": row["codigo_equivalente"],
                    "descripcion_equivalente": row["descripcion_equivalente"] or "Sin descripción",
                    "compatibilidad_pct": row["compatibilidad_pct"],
                    "descripcion": row["descripcion"],
                    "notas": row["notas"],
                    "activo": bool(row["activo"]),
                    "created_at": row["created_at"],
                }
            )

        return jsonify(
            {
                "ok": True,
                "data": equivalencias,
                "pagination": {
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                    "has_more": (offset + limit) < total,
                },
            }
        )

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500
    finally:
        conn.close()


@bp.route("/<codigo>", methods=["GET"])
@require_auth
def equivalencias_por_material(codigo):
    """
    Obtiene todas las equivalencias de un material específico.

    Retorna materiales que pueden sustituir al código dado.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            SELECT
                e.id_equivalencia,
                e.codigo_original,
                m1.descripcion as descripcion_original,
                e.codigo_equivalente,
                m2.descripcion as descripcion_equivalente,
                m2.unidad,
                m2.precio_usd,
                e.compatibilidad_pct,
                e.descripcion,
                e.notas,
                e.activo
            FROM material_equivalencias e
            LEFT JOIN materiales m1 ON e.codigo_original = m1.codigo
            LEFT JOIN materiales m2 ON e.codigo_equivalente = m2.codigo
            WHERE e.activo = 1 AND e.codigo_original = ?
            ORDER BY e.compatibilidad_pct DESC
        """,
            (codigo,),
        )

        rows = cursor.fetchall()

        equivalencias = []
        for row in rows:
            equivalencias.append(
                {
                    "id": row["id_equivalencia"],
                    "codigo_equivalente": row["codigo_equivalente"],
                    "descripcion_equivalente": row["descripcion_equivalente"] or "Sin descripción",
                    "unidad": row["unidad"],
                    "precio_usd": row["precio_usd"],
                    "compatibilidad_pct": row["compatibilidad_pct"],
                    "descripcion": row["descripcion"],
                    "notas": row["notas"],
                }
            )

        return jsonify({"ok": True, "codigo": codigo, "equivalencias": equivalencias})

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500
    finally:
        conn.close()


@bp.route("", methods=["POST"])
@require_admin_or_planner
def crear_equivalencia():
    """
    Crea una nueva equivalencia de material.

    Body JSON:
        codigo_original: Código SAP del material original (requerido)
        codigo_equivalente: Código SAP del material equivalente (requerido)
        compatibilidad_pct: Porcentaje de compatibilidad 0-100 (requerido)
        descripcion: Descripción de la equivalencia (opcional)
        notas: Notas adicionales (opcional)
    """
    data = request.get_json()

    if not data:
        return (
            jsonify(
                {"ok": False, "error": {"code": "invalid_body", "message": "Se requiere body JSON"}}
            ),
            400,
        )

    codigo_original = data.get("codigo_original", "").strip()
    codigo_equivalente = data.get("codigo_equivalente", "").strip()
    compatibilidad_pct = data.get("compatibilidad_pct")
    descripcion = data.get("descripcion", "").strip()
    notas = data.get("notas", "").strip()

    # Validaciones
    if not codigo_original or not codigo_equivalente:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "missing_fields",
                        "message": "Se requiere codigo_original y codigo_equivalente",
                    },
                }
            ),
            400,
        )

    if codigo_original == codigo_equivalente:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_data",
                        "message": "El material no puede ser equivalente a sí mismo",
                    },
                }
            ),
            400,
        )

    if compatibilidad_pct is None or not (0 <= compatibilidad_pct <= 100):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_data",
                        "message": "compatibilidad_pct debe estar entre 0 y 100",
                    },
                }
            ),
            400,
        )

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Verificar que los materiales existen
        cursor.execute("SELECT codigo FROM materiales WHERE codigo = ?", (codigo_original,))
        if not cursor.fetchone():
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "not_found",
                            "message": f"Material original {codigo_original} no encontrado",
                        },
                    }
                ),
                404,
            )

        cursor.execute("SELECT codigo FROM materiales WHERE codigo = ?", (codigo_equivalente,))
        if not cursor.fetchone():
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "not_found",
                            "message": f"Material equivalente {codigo_equivalente} no encontrado",
                        },
                    }
                ),
                404,
            )

        # Verificar que no exista ya la equivalencia
        cursor.execute(
            """
            SELECT id_equivalencia FROM material_equivalencias
            WHERE codigo_original = ? AND codigo_equivalente = ?
        """,
            (codigo_original, codigo_equivalente),
        )

        if cursor.fetchone():
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {"code": "duplicate", "message": "Esta equivalencia ya existe"},
                    }
                ),
                409,
            )

        # Insertar
        cursor.execute(
            """
            INSERT INTO material_equivalencias
            (codigo_original, codigo_equivalente, compatibilidad_pct, descripcion, notas, activo)
            VALUES (?, ?, ?, ?, ?, 1)
        """,
            (
                codigo_original,
                codigo_equivalente,
                compatibilidad_pct,
                descripcion or None,
                notas or None,
            ),
        )

        conn.commit()
        new_id = cursor.lastrowid

        return (
            jsonify({"ok": True, "message": "Equivalencia creada exitosamente", "id": new_id}),
            201,
        )

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500
    finally:
        conn.close()


@bp.route("/<int:id_equivalencia>", methods=["PUT"])
@require_admin_or_planner
def actualizar_equivalencia(id_equivalencia):
    """
    Actualiza una equivalencia existente.

    Body JSON (todos opcionales):
        compatibilidad_pct: Nuevo porcentaje de compatibilidad
        descripcion: Nueva descripción
        notas: Nuevas notas
        activo: Estado activo/inactivo
    """
    data = request.get_json()

    if not data:
        return (
            jsonify(
                {"ok": False, "error": {"code": "invalid_body", "message": "Se requiere body JSON"}}
            ),
            400,
        )

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Verificar que existe
        cursor.execute(
            "SELECT id_equivalencia FROM material_equivalencias WHERE id_equivalencia = ?",
            (id_equivalencia,),
        )
        if not cursor.fetchone():
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {"code": "not_found", "message": "Equivalencia no encontrada"},
                    }
                ),
                404,
            )

        # Construir UPDATE dinámico
        updates = []
        params = []

        if "compatibilidad_pct" in data:
            pct = data["compatibilidad_pct"]
            if not (0 <= pct <= 100):
                return (
                    jsonify(
                        {
                            "ok": False,
                            "error": {
                                "code": "invalid_data",
                                "message": "compatibilidad_pct debe estar entre 0 y 100",
                            },
                        }
                    ),
                    400,
                )
            updates.append("compatibilidad_pct = ?")
            params.append(pct)

        if "descripcion" in data:
            updates.append("descripcion = ?")
            params.append(data["descripcion"].strip() or None)

        if "notas" in data:
            updates.append("notas = ?")
            params.append(data["notas"].strip() or None)

        if "activo" in data:
            updates.append("activo = ?")
            params.append(1 if data["activo"] else 0)

        if not updates:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "no_changes",
                            "message": "No se especificaron campos para actualizar",
                        },
                    }
                ),
                400,
            )

        params.append(id_equivalencia)
        query = f"UPDATE material_equivalencias SET {', '.join(updates)} WHERE id_equivalencia = ?"

        cursor.execute(query, params)
        conn.commit()

        return jsonify({"ok": True, "message": "Equivalencia actualizada exitosamente"})

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500
    finally:
        conn.close()


@bp.route("/<int:id_equivalencia>", methods=["DELETE"])
@require_admin_or_planner
def eliminar_equivalencia(id_equivalencia):
    """
    Elimina (desactiva) una equivalencia.

    Soft delete: marca activo = 0 en lugar de eliminar.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Verificar que existe
        cursor.execute(
            "SELECT id_equivalencia FROM material_equivalencias WHERE id_equivalencia = ?",
            (id_equivalencia,),
        )
        if not cursor.fetchone():
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {"code": "not_found", "message": "Equivalencia no encontrada"},
                    }
                ),
                404,
            )

        # Soft delete
        cursor.execute(
            "UPDATE material_equivalencias SET activo = 0 WHERE id_equivalencia = ?",
            (id_equivalencia,),
        )
        conn.commit()

        return jsonify({"ok": True, "message": "Equivalencia eliminada exitosamente"})

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500
    finally:
        conn.close()
