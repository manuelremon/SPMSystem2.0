"""
Rutas para gestión de equivalencias de materiales
CRUD completo con permisos para Admin y Planificador
"""

from flask import Blueprint, jsonify, request

from backend.core.db import (
    get_db_connection,
    get_db_transaction,
    insert_returning_id,
    is_using_postgresql,
)
from backend.core.roles import require_auth, require_role
from backend.core.search_utils import build_description_search

bp = Blueprint("equivalencias", __name__, url_prefix="/api/equivalencias")

# Configuración de BDs - en producción PG usa vistas de compatibilidad
_PG = is_using_postgresql()
_DB_EQUIV = "spm"  # Cambiado de "equivalentes" a "spm"
_TABLA_EQUIV = "material_equivalencias" # Nombre correcto de la tabla en spm.db/Postgres
_DB_CATALOGO = "master_materiales" # Cambiado de "catalogo_materiales"
_TABLA_CATALOGO = "catalogo_materiales"
_COL_MAT_ID = "codigo"


@bp.route("", methods=["GET"])
@require_auth
def listar_equivalencias():
    """
    Lista equivalencias de materiales SAP con búsqueda opcional.

    Query params:
        q: Búsqueda general por código o descripción (legacy)
        codigo: Búsqueda por código de material (parcial)
        descripcion: Búsqueda por descripción (parcial)
        tipo: Filtro por tipo de equivalencia (E0_DUPLICADO, E1_ESTRICTA, E2_SUPLIBLE)
        limit: Número de resultados (default 50, max 200)
        offset: Offset para paginación (default 0)
    """
    q = request.args.get("q", "").strip()
    q_codigo = request.args.get("codigo", "").strip()
    q_descripcion = request.args.get("descripcion", "").strip()
    q_tipo = request.args.get("tipo", "").strip()
    limit = min(int(request.args.get("limit", 50)), 200)
    offset = int(request.args.get("offset", 0))

    try:
        # Consultar equivalencias SAP (PG: cat_equivalencias, SQLite: equivalentes.db)
        with get_db_connection(_DB_EQUIV) as conn:
            cursor = conn.cursor()

            # Construir clausula WHERE dinamicamente
            where_clauses = ["1=1"]
            params = []

            # Legacy search (q parameter)
            if q:
                search = build_description_search(
                    q,
                    ["CAST(material_base AS TEXT)", "CAST(material_equivalente AS TEXT)",
                     "texto_breve_base", "texto_breve_equivalente"],
                    require_all_words=False,
                )
                if search:
                    where_clauses.append(search.where_clause)
                    params.extend(search.params)

            # Filtro por código
            if q_codigo:
                where_clauses.append("""
                    (
                        CAST(material_base AS TEXT) LIKE ? OR
                        CAST(material_equivalente AS TEXT) LIKE ?
                    )
                """)
                codigo_term = f"%{q_codigo}%"
                params.extend([codigo_term, codigo_term])

            # Filtro por descripción
            if q_descripcion:
                search = build_description_search(q_descripcion, ["texto_breve_base", "texto_breve_equivalente"])
                if search:
                    where_clauses.append(search.where_clause)
                    params.extend(search.params)

            # Filtro por tipo de equivalencia
            if q_tipo:
                where_clauses.append("tipo_equiv = ?")
                params.append(q_tipo)

            # Construir WHERE
            where_clause = " AND ".join(where_clauses)

            # Contar total (sin subquery para compatibilidad SQLite)
            count_query = f"""
                SELECT COUNT(*) as total
                FROM {_TABLA_EQUIV}
                WHERE {where_clause}
            """
            cursor.execute(count_query, params)
            count_row = cursor.fetchone()
            total = count_row["total"] if isinstance(count_row, dict) else count_row[0]

            # Query para obtener resultados con paginación
            _col_id = "id" if _PG else "ROWID"
            select_query = f"""
                SELECT
                    {_col_id} AS id,
                    material_base,
                    texto_breve_base,
                    material_equivalente,
                    texto_breve_equivalente,
                    tipo_equiv,
                    criterio,
                    motivo_equivalencia
                FROM {_TABLA_EQUIV}
                WHERE {where_clause}
                ORDER BY material_base
                LIMIT ? OFFSET ?
            """
            select_params = params + [limit, offset]
            cursor.execute(select_query, select_params)
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


@bp.route("/tipos", methods=["GET"])
@require_auth
def get_tipos_equivalencia():
    """
    Obtiene la lista de tipos de equivalencia únicos para el dropdown de filtro.

    Returns:
        Lista de tipos de equivalencia únicos con sus etiquetas
    """
    try:
        with get_db_connection(_DB_EQUIV) as conn:
            cursor = conn.cursor()
            query = f"""
                SELECT DISTINCT tipo_equiv
                FROM {_TABLA_EQUIV}
                WHERE tipo_equiv IS NOT NULL
                ORDER BY tipo_equiv
            """
            cursor.execute(query)
            rows = cursor.fetchall()

        tipos = []
        label_map = {
            "E0_DUPLICADO": "Duplicado",
            "E1_ESTRICTA": "Estricta",
            "E2_SUPLIBLE": "Suplible",
        }
        for row in rows:
            tipo = row["tipo_equiv"] if isinstance(row, dict) else row[0]
            if tipo:
                tipos.append({
                    "value": tipo,
                    "label": label_map.get(tipo, tipo)
                })

        return jsonify({"ok": True, "data": tipos})

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
        # Buscar equivalencias SAP (PG: cat_equivalencias, SQLite: equivalentes.db)
        with get_db_connection(_DB_EQUIV) as conn:
            cursor = conn.cursor()
            # Buscar donde el material es base O es equivalente (bidireccional)
            cursor.execute(
                f"""
                SELECT
                    material_base,
                    texto_breve_base,
                    material_equivalente,
                    texto_breve_equivalente,
                    tipo_equiv,
                    criterio,
                    motivo_equivalencia
                FROM {_TABLA_EQUIV}
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
@require_role(["admin", "planificador"])
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

    # Fase 1: Verificar que los materiales existen en catálogo
    try:
        with get_db_connection(_DB_CATALOGO) as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT {_COL_MAT_ID} FROM {_TABLA_CATALOGO} WHERE {_COL_MAT_ID} = ?", (codigo_original,))
            original_exists = cursor.fetchone() is not None

            cursor.execute(f"SELECT {_COL_MAT_ID} FROM {_TABLA_CATALOGO} WHERE {_COL_MAT_ID} = ?", (codigo_equivalente,))
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
                VALUES (?, ?, ?, ?, ?, TRUE)
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
@require_role(["admin", "planificador"])
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
        params.append(bool(data["activo"]))

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
@require_role(["admin", "planificador"])
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
                "UPDATE material_equivalencias SET activo = FALSE WHERE id_equivalencia = ?",
                (id_equivalencia,),
            )

        return jsonify({"ok": True, "message": "Equivalencia eliminada exitosamente"})

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500
