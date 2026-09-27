"""
Rutas para gestión de equivalencias de materiales
CRUD completo con permisos para Admin y Planificador
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.db import (
    get_db_connection,
    insert_returning_id,
    is_using_postgresql,
)
from backend.core.helpers import safe_error_response
from backend.core.rate_limit import rate_limit
from backend.core.roles import require_auth, require_role
from backend.core.search_utils import build_description_search
from backend.services.buscador_materiales_service import responder as responder_buscador

logger = logging.getLogger(__name__)

bp = Blueprint("equivalencias", __name__, url_prefix="/api/equivalencias")

# Configuración de BDs - en producción PG usa vistas de compatibilidad
_PG = is_using_postgresql()
_DB_EQUIV = "master_materiales"  # En SQLite materiales_equivalencias vive en master_materiales.db; en PG get_db_connection ignora el nombre
_TABLA_EQUIV = "materiales_equivalencias"  # Vista PG con columnas SAP (material_base, texto_breve_base, etc.)
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
            select_query = f"""
                SELECT
                    {_col_id()} AS id,
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
        return safe_error_response(e, logger, context="equivalencias.listar_equivalencias")


MAX_MENSAJE_ASISTENTE = 300


@bp.route("/asistente", methods=["POST"])
@require_auth
@rate_limit(requests=30, window_seconds=60)
def asistente_materiales():
    """Buscador conversacional de materiales (sin LLM)."""
    data = request.get_json(silent=True)
    mensaje = data.get("mensaje", "") if isinstance(data, dict) else None
    if not isinstance(mensaje, str) or len(mensaje.strip()) > MAX_MENSAJE_ASISTENTE:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "validation_error",
                        "message": f"El mensaje debe ser un texto de hasta {MAX_MENSAJE_ASISTENTE} caracteres",
                    },
                }
            ),
            400,
        )
    try:
        return jsonify({"ok": True, **responder_buscador(mensaje.strip())})
    except Exception as e:
        return safe_error_response(e, logger, 500, "asistente_materiales")


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
        return safe_error_response(e, logger, context="equivalencias.get_tipos_equivalencia")


@bp.route("/<codigo>", methods=["GET"])
@require_auth
def equivalencias_por_material(codigo):
    """
    Obtiene todas las equivalencias de un material específico (bidireccional).

    Cada fila incluye `id` (PG: id; SQLite: rowid) y el sentido original
    (`codigo_original`/`codigo_destino`) para poder editarla o borrarla.
    """
    try:
        with get_db_connection(_DB_EQUIV) as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT
                    {_col_id()} AS id,
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
                    "id": row["id"],
                    "codigo_original": str(row["material_base"]),
                    "codigo_destino": str(row["material_equivalente"]),
                    "codigo_equivalente": str(equiv_codigo),
                    "descripcion_equivalente": equiv_desc or "Sin descripción",
                    "tipo_equivalencia": row["tipo_equiv"],
                    "criterio": row["criterio"],
                    "motivo": row["motivo_equivalencia"],
                }
            )

        return jsonify({"ok": True, "codigo": codigo, "equivalencias": equivalencias})

    except Exception as e:
        return safe_error_response(e, logger, context="equivalencias.equivalencias_por_material")


# ---------------------------------------------------------------------------
# CRUD: escribe en la misma tabla que leen el listado y el buscador.
# SQLite: materiales_equivalencias (sin columna id -> rowid).
# PostgreSQL: materiales_equivalencias es una vista sobre cat_equivalencias (id SERIAL).
# ---------------------------------------------------------------------------
TIPOS_VALIDOS = ("E0_DUPLICADO", "E1_ESTRICTA", "E2_SUPLIBLE")
MAX_TEXTO_EQUIV = 500


def _col_id() -> str:
    """Columna que identifica una equivalencia en la API.

    PG: id SERIAL de cat_equivalencias (estable). SQLite (solo dev): la tabla no
    tiene id y se usa el rowid, que NO es estable: VACUUM o una reimportacion de
    master_materiales.db pueden renumerarlo, asi que un id guardado en el cliente
    puede apuntar a otra fila despues de esas operaciones.
    """
    return "id" if _PG else "rowid"


def _tabla_escritura() -> str:
    return "cat_equivalencias" if _PG else _TABLA_EQUIV


def _error(status: int, code: str, message: str):
    return jsonify({"ok": False, "error": {"code": code, "message": message}}), status


def _texto_opcional(data: dict, campo: str):
    """(valor normalizado, error). None si viene vacío; error si no es texto o supera el máximo."""
    valor = data.get(campo)
    if valor is None:
        return None, None
    if not isinstance(valor, str):
        return None, f"{campo} debe ser texto"
    valor = valor.strip()
    if len(valor) > MAX_TEXTO_EQUIV:
        return None, f"{campo} admite hasta {MAX_TEXTO_EQUIV} caracteres"
    return valor or None, None


def _existe_equivalencia(cursor, id_equivalencia: int) -> bool:
    cursor.execute(
        f"SELECT {_col_id()} AS id FROM {_tabla_escritura()} WHERE {_col_id()} = ?",
        (id_equivalencia,),
    )
    return cursor.fetchone() is not None


@bp.route("", methods=["POST"])
@require_role(["admin", "planificador"])
def crear_equivalencia():
    """
    Crea una equivalencia de material.

    Body JSON:
        codigo_original: Código SAP del material base (requerido)
        codigo_equivalente: Código SAP del material equivalente (requerido)
        tipo_equivalencia: E0_DUPLICADO | E1_ESTRICTA | E2_SUPLIBLE (requerido)
        criterio: texto opcional (<= 500)
        motivo: texto opcional (<= 500)
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return _error(400, "invalid_body", "Se requiere body JSON")

    codigo_original = data.get("codigo_original")
    codigo_equivalente = data.get("codigo_equivalente")
    tipo = data.get("tipo_equivalencia")
    if not isinstance(codigo_original, str) or not isinstance(codigo_equivalente, str):
        return _error(400, "missing_fields", "Se requiere codigo_original y codigo_equivalente")
    codigo_original = codigo_original.strip()
    codigo_equivalente = codigo_equivalente.strip()
    if not codigo_original or not codigo_equivalente:
        return _error(400, "missing_fields", "Se requiere codigo_original y codigo_equivalente")
    if codigo_original == codigo_equivalente:
        return _error(400, "invalid_data", "El material no puede ser equivalente a sí mismo")
    if tipo not in TIPOS_VALIDOS:
        return _error(400, "invalid_data", "tipo_equivalencia no válido")
    criterio, err = _texto_opcional(data, "criterio")
    if err:
        return _error(400, "invalid_data", err)
    motivo, err = _texto_opcional(data, "motivo")
    if err:
        return _error(400, "invalid_data", err)

    try:
        with get_db_connection(_DB_CATALOGO) as conn:
            cursor = conn.cursor()
            descripciones = {}
            for codigo in (codigo_original, codigo_equivalente):
                cursor.execute(
                    f"SELECT {_COL_MAT_ID} AS codigo, descripcion FROM {_TABLA_CATALOGO} WHERE {_COL_MAT_ID} = ?",
                    (codigo,),
                )
                fila = cursor.fetchone()
                if fila is not None:
                    descripciones[codigo] = fila["descripcion"]
    except Exception as e:
        return safe_error_response(e, logger, context="equivalencias.crear_equivalencia.verify_materials")

    for codigo, etiqueta in ((codigo_original, "original"), (codigo_equivalente, "equivalente")):
        if codigo not in descripciones:
            return _error(404, "not_found", f"Material {etiqueta} {codigo} no encontrado")

    try:
        with get_db_connection(_DB_EQUIV) as conn:
            cursor = conn.cursor()
            # Mismo par (en cualquier sentido) con el mismo tipo -> duplicado
            cursor.execute(
                f"""
                SELECT 1 FROM {_tabla_escritura()}
                WHERE tipo_equiv = ?
                  AND ((material_base = ? AND material_equivalente = ?)
                    OR (material_base = ? AND material_equivalente = ?))
                """,
                (tipo, codigo_original, codigo_equivalente, codigo_equivalente, codigo_original),
            )
            if cursor.fetchone() is not None:
                return _error(409, "duplicate", "Esta equivalencia ya existe")

            new_id = insert_returning_id(
                cursor,
                f"""
                INSERT INTO {_tabla_escritura()}
                (material_base, texto_breve_base, material_equivalente, texto_breve_equivalente,
                 tipo_equiv, criterio, motivo_equivalencia)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    codigo_original,
                    descripciones[codigo_original],
                    codigo_equivalente,
                    descripciones[codigo_equivalente],
                    tipo,
                    criterio,
                    motivo,
                ),
            )
            conn.commit()

        return jsonify({"ok": True, "message": "Equivalencia creada exitosamente", "id": new_id}), 201

    except Exception as e:
        return safe_error_response(e, logger, context="equivalencias.crear_equivalencia")


@bp.route("/<int:id_equivalencia>", methods=["PUT"])
@require_role(["admin", "planificador"])
def actualizar_equivalencia(id_equivalencia):
    """
    Actualiza tipo, criterio y/o motivo de una equivalencia.

    Body JSON (al menos uno): tipo_equivalencia, criterio, motivo
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return _error(400, "invalid_body", "Se requiere body JSON")

    updates = []
    params = []
    if "tipo_equivalencia" in data:
        if data["tipo_equivalencia"] not in TIPOS_VALIDOS:
            return _error(400, "invalid_data", "tipo_equivalencia no válido")
        updates.append("tipo_equiv = ?")
        params.append(data["tipo_equivalencia"])
    for campo, columna in (("criterio", "criterio"), ("motivo", "motivo_equivalencia")):
        if campo in data:
            valor, err = _texto_opcional(data, campo)
            if err:
                return _error(400, "invalid_data", err)
            updates.append(f"{columna} = ?")
            params.append(valor)

    if not updates:
        return _error(400, "no_changes", "No se especificaron campos para actualizar")

    try:
        with get_db_connection(_DB_EQUIV) as conn:
            cursor = conn.cursor()
            if not _existe_equivalencia(cursor, id_equivalencia):
                return _error(404, "not_found", "Equivalencia no encontrada")
            cursor.execute(
                f"UPDATE {_tabla_escritura()} SET {', '.join(updates)} WHERE {_col_id()} = ?",
                (*params, id_equivalencia),
            )
            conn.commit()

        return jsonify({"ok": True, "message": "Equivalencia actualizada exitosamente"})

    except Exception as e:
        return safe_error_response(e, logger, context="equivalencias.actualizar_equivalencia")


@bp.route("/<int:id_equivalencia>", methods=["DELETE"])
@require_role(["admin", "planificador"])
def eliminar_equivalencia(id_equivalencia):
    """Elimina (borrado físico) una equivalencia: la tabla no tiene columna `activo`."""
    try:
        with get_db_connection(_DB_EQUIV) as conn:
            cursor = conn.cursor()
            if not _existe_equivalencia(cursor, id_equivalencia):
                return _error(404, "not_found", "Equivalencia no encontrada")
            cursor.execute(
                f"DELETE FROM {_tabla_escritura()} WHERE {_col_id()} = ?",
                (id_equivalencia,),
            )
            conn.commit()

        return jsonify({"ok": True, "message": "Equivalencia eliminada exitosamente"})

    except Exception as e:
        return safe_error_response(e, logger, context="equivalencias.eliminar_equivalencia")
