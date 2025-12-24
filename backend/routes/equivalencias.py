"""
Rutas para gestión de equivalencias de materiales
CRUD completo con permisos para Admin y Planificador
"""

from functools import wraps

from flask import Blueprint, g, jsonify, request

try:
    from backend.core.db import get_db_connection, get_db_transaction, insert_returning_id
except ImportError:
    from core.db import get_db_connection, get_db_transaction, insert_returning_id

bp = Blueprint("equivalencias", __name__, url_prefix="/api/equivalencias")


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
    Lista equivalencias de materiales SAP con búsqueda opcional.

    Query params:
        q: Búsqueda por código o descripción
        limit: Número de resultados (default 50, max 200)
        offset: Offset para paginación (default 0)
    """
    q = request.args.get("q", "").strip()
    limit = min(int(request.args.get("limit", 50)), 200)
    offset = int(request.args.get("offset", 0))

    try:
        # Consultar equivalentes.db (datos SAP reales)
        with get_db_connection("equivalentes") as conn:
            cursor = conn.cursor()

            # Query base
            base_query = """
                SELECT
                    rowid as id,
                    material_base,
                    texto_breve_base,
                    material_equivalente,
                    texto_breve_equivalente,
                    tipo_equiv,
                    criterio,
                    motivo_equivalencia
                FROM equivalencias
                WHERE 1=1
            """

            params = []

            if q:
                base_query += """
                    AND (
                        CAST(material_base AS TEXT) LIKE ? OR
                        CAST(material_equivalente AS TEXT) LIKE ? OR
                        texto_breve_base LIKE ? OR
                        texto_breve_equivalente LIKE ?
                    )
                """
                search_term = f"%{q}%"
                params.extend([search_term, search_term, search_term, search_term])

            # Contar total
            count_query = f"SELECT COUNT(*) FROM ({base_query})"
            cursor.execute(count_query, params)
            total = cursor.fetchone()[0]

            # Obtener resultados con paginación
            base_query += " ORDER BY material_base LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cursor.execute(base_query, params)
            rows = cursor.fetchall()

        equivalencias = []
        for row in rows:
            equivalencias.append(
                {
                    "id": row["id"],
                    "codigo_original": str(row["material_base"]),
                    "descripcion_original": row["texto_breve_base"] or "Sin descripción",
                    "codigo_equivalente": str(row["material_equivalente"]),
                    "descripcion_equivalente": row["texto_breve_equivalente"] or "Sin descripción",
                    "tipo_equivalencia": row["tipo_equiv"],
                    "criterio": row["criterio"],
                    "motivo": row["motivo_equivalencia"],
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


@bp.route("/<codigo>", methods=["GET"])
@require_auth
def equivalencias_por_material(codigo):
    """
    Obtiene todas las equivalencias de un material específico.

    Retorna materiales que pueden sustituir al código dado.
    Busca en equivalentes.db tabla equivalencias.
    """
    try:
        # Buscar en equivalentes.db (tabla real con datos SAP)
        with get_db_connection("equivalentes") as conn:
            cursor = conn.cursor()
            # Buscar donde el material es base O es equivalente (bidireccional)
            cursor.execute(
                """
                SELECT
                    material_base,
                    texto_breve_base,
                    material_equivalente,
                    texto_breve_equivalente,
                    tipo_equiv,
                    criterio,
                    motivo_equivalencia
                FROM equivalencias
                WHERE material_base = ? OR material_equivalente = ?
            """,
                (codigo, codigo),
            )
            rows = cursor.fetchall()

        equivalencias = []
        for row in rows:
            # Determinar cuál es el material equivalente (el que NO es el buscado)
            if str(row["material_base"]) == str(codigo):
                equiv_codigo = row["material_equivalente"]
                equiv_desc = row["texto_breve_equivalente"]
            else:
                equiv_codigo = row["material_base"]
                equiv_desc = row["texto_breve_base"]

            equivalencias.append(
                {
                    "codigo_equivalente": str(equiv_codigo),
                    "descripcion_equivalente": equiv_desc or "Sin descripción",
                    "tipo_equivalencia": row["tipo_equiv"],
                    "criterio": row["criterio"],
                    "motivo": row["motivo_equivalencia"],
                }
            )

        return jsonify({"ok": True, "codigo": codigo, "equivalencias": equivalencias})

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500


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

    # Fase 1: Verificar que los materiales existen en cat_materiales (PostgreSQL) o catalogo_materiales.db (SQLite)
    try:
        with get_db_connection("catalogo_materiales") as conn:
            cursor = conn.cursor()
            # En PostgreSQL usa cat_materiales, en SQLite usa materiales
            from core.db import is_using_postgresql
            tabla = "cat_materiales" if is_using_postgresql() else "materiales"
            cursor.execute(f"SELECT codigo FROM {tabla} WHERE codigo = ?", (codigo_original,))
            original_exists = cursor.fetchone() is not None

            cursor.execute(f"SELECT codigo FROM {tabla} WHERE codigo = ?", (codigo_equivalente,))
            equivalente_exists = cursor.fetchone() is not None

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500

    # Fase 1b: Verificar que no exista ya la equivalencia en spm.db
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id_equivalencia FROM material_equivalencias
                WHERE codigo_original = ? AND codigo_equivalente = ?
            """,
                (codigo_original, codigo_equivalente),
            )
            already_exists = cursor.fetchone() is not None

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500

    if not original_exists:
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

    if not equivalente_exists:
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

    if already_exists:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "duplicate", "message": "Esta equivalencia ya existe"},
                }
            ),
            409,
        )

    # Fase 2: Insertar (WRITE)
    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            new_id = insert_returning_id(
                cursor,
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

        return (
            jsonify({"ok": True, "message": "Equivalencia creada exitosamente", "id": new_id}),
            201,
        )

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500


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

    # Fase 1: Verificar que existe (READ)
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id_equivalencia FROM material_equivalencias WHERE id_equivalencia = ?",
                (id_equivalencia,),
            )
            exists = cursor.fetchone() is not None

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500

    if not exists:
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

    # Fase 2: UPDATE (WRITE)
    try:
        params.append(id_equivalencia)
        query = f"UPDATE material_equivalencias SET {', '.join(updates)} WHERE id_equivalencia = ?"

        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)

        return jsonify({"ok": True, "message": "Equivalencia actualizada exitosamente"})

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500


@bp.route("/<int:id_equivalencia>", methods=["DELETE"])
@require_admin_or_planner
def eliminar_equivalencia(id_equivalencia):
    """
    Elimina (desactiva) una equivalencia.

    Soft delete: marca activo = 0 en lugar de eliminar.
    """
    # Fase 1: Verificar que existe (READ)
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id_equivalencia FROM material_equivalencias WHERE id_equivalencia = ?",
                (id_equivalencia,),
            )
            exists = cursor.fetchone() is not None

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500

    if not exists:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "not_found", "message": "Equivalencia no encontrada"},
                }
            ),
            404,
        )

    # Fase 2: Soft delete (WRITE)
    try:
        with get_db_transaction() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE material_equivalencias SET activo = 0 WHERE id_equivalencia = ?",
                (id_equivalencia,),
            )

        return jsonify({"ok": True, "message": "Equivalencia eliminada exitosamente"})

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500
