"""
Database Administration Routes
Endpoints para administrar las bases de datos del sistema.
Solo accesible por usuarios con rol admin.
Incluye operaciones CRUD completas con validacion y audit trail.
"""

import csv
import io
import json
import logging
import os
import sqlite3
import time
from datetime import datetime
from functools import wraps

from flask import Blueprint, g, jsonify, request, send_file

logger = logging.getLogger(__name__)

from backend.core.config import settings
from backend.core.db import get_db_connection
from backend.core.db_optimization import (
    analyze_tables,
    create_indexes,
    get_all_pool_stats,
    get_db_stats,
    optimize_database,
)
from backend.core.rate_limit import rate_limit
from backend.core.roles import require_auth

bp = Blueprint("database", __name__, url_prefix="/api/admin/database")

# Whitelist de bases de datos permitidas
ALLOWED_DATABASES = {"spm", "sap_data", "equivalentes", "catalogo_materiales"}

# Whitelist de tablas por BD (para prevenir SQL injection)
# Actualizado 2026-01-09 con TODAS las tablas de PostgreSQL produccion
ALLOWED_TABLES = {
    "spm": [
        # Core - Solicitudes y workflow
        "usuarios", "solicitudes", "solicitud_items_tratamiento", "solicitud_tratamiento_eventos",
        "solicitud_tratamiento_log", "solicitudes_historial_estados",
        # Decisiones y planificacion
        "decision_abastecimiento", "decision_abastecimiento_fuentes", "ordenes_planificadas",
        "planificador_asignaciones", "solicitud_pedido_sap", "orden_compra", "solicitud_traslado",
        # Presupuestos
        "presupuestos", "presupuesto_ledger", "presupuesto_incorporaciones",
        "budget_update_requests", "budget_history",
        # Proveedores
        "proveedores", "proveedores_externos", "proveedores_internos",
        "proveedor_ext_contactos", "proveedor_ext_emails", "proveedor_ext_telefonos",
        "proveedor_precios_negociados",
        # Materiales y equivalencias
        "materiales", "material_equivalencias", "cat_materiales", "cat_equivalencias",
        # SAP data (migrada a PostgreSQL)
        "sap_stock", "sap_consumo_historico", "sap_pedidos", "sap_materiales_bbdd",
        # Catalogos
        "catalogo_centro", "catalogo_almacen", "catalogo_sector", "catalogo_rol", "catalogo_puesto",
        # Comunicacion
        "mensajes", "notificaciones", "notificacion_push_suscripcion", "email_bandeja_salida",
        "usuario_preferencia_notificacion",
        # Foro
        "foro_posts", "foro_respuestas", "foro_likes",
        # Trivias
        "trivia_score",
        # Configuracion
        "config_almacenes", "config_equivalencia_scores", "config_lotes_excluidos",
        "reglas_aprobacion", "aprobadores_delegados",
        # SLA y alertas
        "sla_configuracion", "sla_alertas", "alertas_mrp", "system_alerts",
        # Metricas
        "metrics_history",
        # Usuario
        "usuario_solicitud_perfil", "archivos_adjuntos",
        # Audit (read-only)
        "audit_trail", "schema_migrations",
    ],
    "sap_data": ["stock", "consumo_historico", "pedidos_sap", "materiales_bbdd"],
    "equivalentes": ["equivalencias"],
    "catalogo_materiales": ["materiales"],
}

# Tablas protegidas (solo lectura - no se pueden modificar via CRUD)
READ_ONLY_TABLES = {
    "spm": ["audit_trail", "schema_migrations"],
}

# Columnas protegidas (nunca visibles ni editables)
PROTECTED_COLUMNS = {
    "password_hash", "token_reset", "token_verificacion", "refresh_token",
    "vapid_private_key", "secret_key",
}

# Columnas auto-gestionadas (no editables manualmente)
AUTO_MANAGED_COLUMNS = {
    "created_at", "updated_at", "fecha_creacion", "fecha_actualizacion",
}


def require_admin(f):
    """Decorator que requiere rol admin"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, "user") or not g.user:
            return jsonify({"ok": False, "error": {"code": "unauthorized", "message": "No autenticado"}}), 401

        rol = (g.user.get("rol") or "").lower()
        if "admin" not in rol:
            return jsonify({"ok": False, "error": {"code": "forbidden", "message": "Requiere rol admin"}}), 403

        return f(*args, **kwargs)
    return decorated


def get_sqlite_path(db_name: str) -> str:
    """Obtiene la ruta del archivo SQLite"""
    base_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
    return os.path.join(base_path, f"{db_name}.db")


def is_postgres() -> bool:
    """Verifica si estamos usando PostgreSQL"""
    db_url = os.environ.get("DATABASE_URL", "")
    return db_url.startswith("postgresql")


def _get_value(row, key_or_index, default=None):
    """
    Extrae un valor de una fila que puede ser dict (PostgreSQL RealDictCursor) o tuple (SQLite).
    key_or_index: nombre de columna (str) para dict, o indice (int) para tuple.
    """
    if row is None:
        return default
    if isinstance(row, dict):
        # Para dict, key_or_index puede ser str (nombre) o int (posicion)
        if isinstance(key_or_index, str):
            return row.get(key_or_index, default)
        # Si es int, obtener por posicion en los valores
        values = list(row.values())
        return values[key_or_index] if key_or_index < len(values) else default
    # Para tuple/list
    try:
        return row[key_or_index]
    except (IndexError, KeyError):
        return default


@bp.route("/overview", methods=["GET"])
@require_auth
@require_admin
def get_overview():
    """Vista general de todas las bases de datos"""
    databases = []

    for db_name in ALLOWED_DATABASES:
        db_info = {
            "name": db_name,
            "type": "postgresql" if (db_name == "spm" and is_postgres()) else "sqlite",
            "status": "unknown",
            "size_mb": 0,
            "tables": 0,
            "records": 0,
            "latency_ms": 0,
        }

        try:
            start = time.time()

            if db_name == "spm" and is_postgres():
                # PostgreSQL
                with get_db_connection() as conn:
                    cur = conn.cursor()
                    cur.execute("SELECT 1")
                    db_info["latency_ms"] = round((time.time() - start) * 1000, 2)

                    # Contar tablas
                    cur.execute("""
                        SELECT COUNT(*) FROM information_schema.tables
                        WHERE table_schema = 'public'
                    """)
                    db_info["tables"] = _get_value(cur.fetchone(), 0, 0)

                    # Tamaño de la BD
                    cur.execute("SELECT pg_database_size(current_database())")
                    db_info["size_mb"] = round(_get_value(cur.fetchone(), 0, 0) / (1024 * 1024), 2)

                    db_info["status"] = "online"
            else:
                # SQLite
                db_path = get_sqlite_path(db_name)
                if os.path.exists(db_path):
                    db_info["size_mb"] = round(os.path.getsize(db_path) / (1024 * 1024), 2)

                    conn = sqlite3.connect(db_path)
                    conn.row_factory = sqlite3.Row
                    cur = conn.cursor()

                    cur.execute("SELECT 1")
                    db_info["latency_ms"] = round((time.time() - start) * 1000, 2)

                    # Contar tablas
                    cur.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                    db_info["tables"] = cur.fetchone()[0]

                    # Contar registros totales
                    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                    tables = [row[0] for row in cur.fetchall()]
                    total_records = 0
                    for table in tables:
                        try:
                            cur.execute(f"SELECT COUNT(*) FROM [{table}]")
                            total_records += cur.fetchone()[0]
                        except Exception:
                            pass
                    db_info["records"] = total_records

                    conn.close()
                    db_info["status"] = "online"
                else:
                    db_info["status"] = "not_found"

        except Exception as e:
            db_info["status"] = "error"
            db_info["error"] = str(e)

        databases.append(db_info)

    return jsonify({
        "ok": True,
        "databases": databases,
        "is_production": is_postgres(),
    }), 200


@bp.route("/tables", methods=["GET"])
@require_auth
@require_admin
def get_tables():
    """Lista todas las tablas de una BD"""
    db_name = request.args.get("db", "spm")

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida: {db_name}"}}), 400

    tables = []

    # Obtener whitelist de tablas para esta BD
    allowed_tables_for_db = set(ALLOWED_TABLES.get(db_name, []))

    try:
        if db_name == "spm" and is_postgres():
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """)
                for row in cur.fetchall():
                    table_name = _get_value(row, 'table_name') or _get_value(row, 0)
                    # Validar contra whitelist antes de ejecutar query
                    if table_name not in allowed_tables_for_db:
                        continue
                    cur.execute(f"SELECT COUNT(*) FROM \"{table_name}\"")
                    count = _get_value(cur.fetchone(), 0, 0)
                    tables.append({"name": table_name, "records": count})
        else:
            db_path = get_sqlite_path(db_name)
            if not os.path.exists(db_path):
                return jsonify({"ok": False, "error": {"code": "not_found", "message": f"BD no encontrada: {db_name}"}}), 404

            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            for row in cur.fetchall():
                table_name = row[0]
                # Validar contra whitelist antes de ejecutar query
                if table_name not in allowed_tables_for_db:
                    continue
                try:
                    cur.execute(f"SELECT COUNT(*) FROM [{table_name}]")
                    count = cur.fetchone()[0]
                except Exception:
                    count = 0
                tables.append({"name": table_name, "records": count})

            conn.close()

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500

    return jsonify({"ok": True, "database": db_name, "tables": tables}), 200


@bp.route("/tables/<table>/structure", methods=["GET"])
@require_auth
@require_admin
def get_table_structure(table: str):
    """Obtiene la estructura de una tabla"""
    db_name = request.args.get("db", "spm")

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida"}}), 400

    # Validar tabla contra whitelist
    allowed = ALLOWED_TABLES.get(db_name, [])
    if table not in allowed:
        return jsonify({"ok": False, "error": {"code": "forbidden", "message": f"Tabla no permitida: {table}"}}), 403

    columns = []
    indexes = []

    try:
        if db_name == "spm" and is_postgres():
            with get_db_connection() as conn:
                cur = conn.cursor()

                # Columnas
                cur.execute("""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = %s
                    ORDER BY ordinal_position
                """, (table,))
                for row in cur.fetchall():
                    columns.append({
                        "name": _get_value(row, 'column_name') or _get_value(row, 0),
                        "type": _get_value(row, 'data_type') or _get_value(row, 1),
                        "nullable": (_get_value(row, 'is_nullable') or _get_value(row, 2)) == "YES",
                        "default": _get_value(row, 'column_default') or _get_value(row, 3),
                    })

                # Indices
                cur.execute("""
                    SELECT indexname, indexdef
                    FROM pg_indexes
                    WHERE tablename = %s
                """, (table,))
                for row in cur.fetchall():
                    indexes.append({
                        "name": _get_value(row, 'indexname') or _get_value(row, 0),
                        "definition": _get_value(row, 'indexdef') or _get_value(row, 1),
                    })
        else:
            db_path = get_sqlite_path(db_name)
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            # Columnas
            cur.execute(f"PRAGMA table_info([{table}])")
            for row in cur.fetchall():
                columns.append({
                    "name": row[1],
                    "type": row[2],
                    "nullable": row[3] == 0,
                    "default": row[4],
                    "pk": row[5] == 1,
                })

            # Indices
            cur.execute(f"PRAGMA index_list([{table}])")
            for row in cur.fetchall():
                idx_name = row[1]
                cur.execute(f"PRAGMA index_info([{idx_name}])")
                idx_cols = [r[2] for r in cur.fetchall()]
                indexes.append({
                    "name": idx_name,
                    "unique": row[2] == 1,
                    "columns": idx_cols,
                })

            conn.close()

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500

    return jsonify({
        "ok": True,
        "table": table,
        "database": db_name,
        "columns": columns,
        "indexes": indexes,
    }), 200


@bp.route("/tables/<table>/preview", methods=["GET"])
@require_auth
@require_admin
def get_table_preview(table: str):
    """Vista previa de datos de una tabla (primeras 50 filas)"""
    db_name = request.args.get("db", "spm")
    limit = min(int(request.args.get("limit", 50)), 100)
    offset = int(request.args.get("offset", 0))

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida"}}), 400

    rows = []
    columns = []
    total = 0

    try:
        if db_name == "spm" and is_postgres():
            with get_db_connection() as conn:
                cur = conn.cursor()

                # Obtener columnas
                cur.execute("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = %s ORDER BY ordinal_position
                """, (table,))
                columns = [_get_value(row, 'column_name') or _get_value(row, 0) for row in cur.fetchall()]

                # Contar total
                cur.execute(f"SELECT COUNT(*) FROM \"{table}\"")
                total = _get_value(cur.fetchone(), 0, 0)

                # Obtener datos
                cur.execute(f"SELECT * FROM \"{table}\" LIMIT %s OFFSET %s", (limit, offset))
                for row in cur.fetchall():
                    # RealDictCursor devuelve diccionarios directamente
                    if isinstance(row, dict):
                        rows.append({k: str(v) if v is not None else None for k, v in row.items()})
                    else:
                        rows.append(dict(zip(columns, [str(v) if v is not None else None for v in row])))
        else:
            db_path = get_sqlite_path(db_name)
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()

            # Obtener columnas
            cur.execute(f"PRAGMA table_info([{table}])")
            columns = [row[1] for row in cur.fetchall()]

            # Contar total
            cur.execute(f"SELECT COUNT(*) FROM [{table}]")
            total = cur.fetchone()[0]

            # Obtener datos
            cur.execute(f"SELECT * FROM [{table}] LIMIT ? OFFSET ?", (limit, offset))
            for row in cur.fetchall():
                rows.append({col: str(row[col]) if row[col] is not None else None for col in columns})

            conn.close()

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500

    return jsonify({
        "ok": True,
        "table": table,
        "database": db_name,
        "columns": columns,
        "rows": rows,
        "total": total,
        "limit": limit,
        "offset": offset,
    }), 200


@bp.route("/optimize", methods=["POST"])
@require_auth
@require_admin
@rate_limit(5, 60)  # 5 requests per minute - operacion costosa
def run_optimize():
    """Ejecuta optimizacion completa (indices + analyze + vacuum)"""
    db_name = request.json.get("db", "spm") if request.json else "spm"

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida"}}), 400

    try:
        if is_postgres() and db_name == "spm":
            # PostgreSQL: VACUUM ANALYZE (equivalente a optimizacion completa)
            with get_db_connection() as conn:
                # PostgreSQL necesita autocommit para VACUUM
                old_autocommit = conn.autocommit
                conn.autocommit = True
                cur = conn.cursor()
                cur.execute("VACUUM ANALYZE")
                conn.autocommit = old_autocommit
            return jsonify({"ok": True, "message": f"PostgreSQL {db_name} optimizado (VACUUM ANALYZE)"}), 200
        else:
            result = optimize_database(db_name)
            return jsonify({"ok": True, "message": f"BD {db_name} optimizada", "result": result}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "optimize_error", "message": str(e)}}), 500


@bp.route("/vacuum", methods=["POST"])
@require_auth
@require_admin
@rate_limit(5, 60)  # 5 requests per minute - operacion costosa
def run_vacuum():
    """Ejecuta VACUUM para compactar la BD"""
    db_name = request.json.get("db", "spm") if request.json else "spm"

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida"}}), 400

    try:
        if is_postgres() and db_name == "spm":
            # PostgreSQL VACUUM
            with get_db_connection() as conn:
                old_autocommit = conn.autocommit
                conn.autocommit = True
                cur = conn.cursor()
                cur.execute("VACUUM")
                conn.autocommit = old_autocommit
            return jsonify({"ok": True, "message": "PostgreSQL VACUUM completado"}), 200
        else:
            db_path = get_sqlite_path(db_name)
            conn = sqlite3.connect(db_path)
            conn.execute("VACUUM")
            conn.close()

            new_size = os.path.getsize(db_path) / (1024 * 1024)
            return jsonify({"ok": True, "message": f"VACUUM completado", "new_size_mb": round(new_size, 2)}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "vacuum_error", "message": str(e)}}), 500


@bp.route("/analyze", methods=["POST"])
@require_auth
@require_admin
@rate_limit(10, 60)  # 10 requests per minute
def run_analyze():
    """Ejecuta ANALYZE para actualizar estadisticas"""
    db_name = request.json.get("db", "spm") if request.json else "spm"

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida"}}), 400

    try:
        if is_postgres() and db_name == "spm":
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute("ANALYZE")
                conn.commit()
        else:
            result = analyze_tables(db_name)

        return jsonify({"ok": True, "message": f"ANALYZE completado para {db_name}"}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "analyze_error", "message": str(e)}}), 500


@bp.route("/integrity-check", methods=["POST"])
@require_auth
@require_admin
@rate_limit(5, 60)  # 5 requests per minute - operacion costosa
def run_integrity_check():
    """Verifica integridad de la BD"""
    db_name = request.json.get("db", "spm") if request.json else "spm"

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida"}}), 400

    try:
        if is_postgres() and db_name == "spm":
            # PostgreSQL: verificar estadisticas de tablas e indices invalidos
            with get_db_connection() as conn:
                cur = conn.cursor()
                # Verificar indices invalidos
                cur.execute("""
                    SELECT indexrelid::regclass AS index_name,
                           indrelid::regclass AS table_name,
                           indisvalid
                    FROM pg_index
                    WHERE NOT indisvalid
                """)
                invalid_indexes = cur.fetchall()

                # Verificar tablas con bloat (fragmentacion)
                cur.execute("""
                    SELECT relname, n_dead_tup, n_live_tup
                    FROM pg_stat_user_tables
                    WHERE n_dead_tup > 1000
                    ORDER BY n_dead_tup DESC
                    LIMIT 10
                """)
                bloated_tables = cur.fetchall()

                is_ok = len(invalid_indexes) == 0

            return jsonify({
                "ok": True,
                "database": db_name,
                "type": "postgresql",
                "integrity_ok": is_ok,
                "invalid_indexes": [{"index": str(r[0]), "table": str(r[1])} for r in invalid_indexes],
                "bloated_tables": [{"table": r[0], "dead_tuples": r[1], "live_tuples": r[2]} for r in bloated_tables],
            }), 200
        else:
            db_path = get_sqlite_path(db_name)
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            # Integrity check
            cur.execute("PRAGMA integrity_check")
            integrity_result = cur.fetchall()

            # Foreign key check
            cur.execute("PRAGMA foreign_key_check")
            fk_result = cur.fetchall()

            conn.close()

            is_ok = len(integrity_result) == 1 and integrity_result[0][0] == "ok"

            return jsonify({
                "ok": True,
                "database": db_name,
                "type": "sqlite",
                "integrity_ok": is_ok,
                "integrity_result": [r[0] for r in integrity_result],
                "foreign_key_issues": len(fk_result),
                "foreign_key_details": [{"table": r[0], "rowid": r[1], "parent": r[2]} for r in fk_result[:10]],
            }), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "integrity_error", "message": str(e)}}), 500


@bp.route("/create-indexes", methods=["POST"])
@require_auth
@require_admin
@rate_limit(5, 60)  # 5 requests per minute - operacion costosa
def run_create_indexes():
    """Crea indices recomendados"""
    db_name = request.json.get("db", "spm") if request.json else "spm"

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida"}}), 400

    if is_postgres() and db_name == "spm":
        return jsonify({"ok": False, "error": {"code": "not_supported", "message": "Crear indices no disponible para PostgreSQL desde aqui"}}), 400

    try:
        result = create_indexes(db_name)
        return jsonify({"ok": True, "message": f"Indices creados para {db_name}", "result": result}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "index_error", "message": str(e)}}), 500


@bp.route("/pool-stats", methods=["GET"])
@require_auth
@require_admin
def get_pool_stats():
    """Estadisticas del pool de conexiones"""
    try:
        stats = get_all_pool_stats()
        return jsonify({"ok": True, "pools": stats}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "pool_error", "message": str(e)}}), 500


@bp.route("/export/<db_name>", methods=["GET"])
@require_auth
@require_admin
def export_database(db_name: str):
    """Descarga una copia de la BD SQLite"""
    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida"}}), 400

    if is_postgres() and db_name == "spm":
        return jsonify({"ok": False, "error": {"code": "not_supported", "message": "Export no disponible para PostgreSQL"}}), 400

    try:
        db_path = get_sqlite_path(db_name)
        if not os.path.exists(db_path):
            return jsonify({"ok": False, "error": {"code": "not_found", "message": f"BD no encontrada"}}), 404

        return send_file(
            db_path,
            as_attachment=True,
            download_name=f"{db_name}_{time.strftime('%Y%m%d_%H%M%S')}.db",
            mimetype="application/x-sqlite3",
        )
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "export_error", "message": str(e)}}), 500


@bp.route("/tables/<table>/export-csv", methods=["GET"])
@require_auth
@require_admin
def export_table_csv(table: str):
    """Exporta una tabla a CSV"""
    db_name = request.args.get("db", "spm")

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida"}}), 400

    try:
        output = io.StringIO()
        writer = csv.writer(output)

        if db_name == "spm" and is_postgres():
            with get_db_connection() as conn:
                cur = conn.cursor()

                # Obtener columnas
                cur.execute("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = %s ORDER BY ordinal_position
                """, (table,))
                columns = [row[0] for row in cur.fetchall()]
                writer.writerow(columns)

                # Obtener datos
                cur.execute(f"SELECT * FROM {table}")
                for row in cur.fetchall():
                    writer.writerow([str(v) if v is not None else "" for v in row])
        else:
            db_path = get_sqlite_path(db_name)
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            # Obtener columnas
            cur.execute(f"PRAGMA table_info([{table}])")
            columns = [row[1] for row in cur.fetchall()]
            writer.writerow(columns)

            # Obtener datos
            cur.execute(f"SELECT * FROM [{table}]")
            for row in cur.fetchall():
                writer.writerow([str(v) if v is not None else "" for v in row])

            conn.close()

        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode("utf-8")),
            as_attachment=True,
            download_name=f"{table}_{time.strftime('%Y%m%d_%H%M%S')}.csv",
            mimetype="text/csv",
        )
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "export_error", "message": str(e)}}), 500


# ==================== CRUD OPERATIONS ====================

def _get_table_pk(db_name: str, table: str):
    """Obtiene la(s) columna(s) de la primary key de una tabla"""
    pk_columns = []

    try:
        if db_name == "spm" and is_postgres():
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT a.attname
                    FROM pg_index i
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                    WHERE i.indrelid = %s::regclass AND i.indisprimary
                """, (table,))
                pk_columns = [row[0] for row in cur.fetchall()]
        else:
            db_path = get_sqlite_path(db_name)
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute(f"PRAGMA table_info([{table}])")
            for row in cur.fetchall():
                if row[5] == 1:  # pk flag
                    pk_columns.append(row[1])
            conn.close()
    except (sqlite3.Error, Exception) as e:
        logger.warning(f"Error obteniendo primary keys para {db_name}.{table}: {e}")

    return pk_columns


def _get_table_columns_info(db_name: str, table: str):
    """Obtiene informacion de columnas de una tabla"""
    columns = []

    try:
        if db_name == "spm" and is_postgres():
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = %s
                    ORDER BY ordinal_position
                """, (table,))
                for row in cur.fetchall():
                    columns.append({
                        "name": row[0],
                        "type": row[1],
                        "nullable": row[2] == "YES",
                        "default": row[3],
                    })
        else:
            db_path = get_sqlite_path(db_name)
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute(f"PRAGMA table_info([{table}])")
            for row in cur.fetchall():
                columns.append({
                    "name": row[1],
                    "type": row[2],
                    "nullable": row[3] == 0,
                    "default": row[4],
                    "pk": row[5] == 1,
                })
            conn.close()
    except (sqlite3.Error, Exception) as e:
        logger.warning(f"Error obteniendo columnas para {db_name}.{table}: {e}")

    return columns


def _log_crud_operation(operation: str, table: str, db_name: str, data: dict, user_id: int):
    """Registra operacion CRUD en audit_trail"""
    try:
        entity_id = data.get("id") or (data.get("pk", {}) or {}).get("id")
        details = json.dumps(data, default=str)
        if db_name == "spm" and is_postgres():
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO audit_trail (actor_id, accion, entidad, entidad_id, valor_nuevo, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    str(user_id),
                    f"DB_{operation}",
                    f"table:{table}",
                    str(entity_id) if entity_id else None,
                    details,
                    datetime.utcnow(),
                ))
                conn.commit()
        else:
            db_path = get_sqlite_path("spm")
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO audit_trail (actor_id, accion, entidad, entidad_id, valor_nuevo, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                str(user_id),
                f"DB_{operation}",
                f"table:{table}",
                str(entity_id) if entity_id else None,
                details,
                datetime.utcnow().isoformat(),
            ))
            conn.commit()
            conn.close()
    except Exception as e:
        # No fallar si el audit log falla
        logger.warning(f"Error logging CRUD operation: {e}")


def _filter_protected_columns(columns: list, for_display: bool = True) -> list:
    """Filtra columnas protegidas"""
    if for_display:
        return [c for c in columns if c.get("name") not in PROTECTED_COLUMNS]
    return [c for c in columns if c not in PROTECTED_COLUMNS]


def _is_table_read_only(db_name: str, table: str) -> bool:
    """Verifica si una tabla es de solo lectura"""
    read_only = READ_ONLY_TABLES.get(db_name, [])
    return table in read_only


@bp.route("/tables/<table>/pk", methods=["GET"])
@require_auth
@require_admin
@rate_limit(requests=30, window_seconds=60)
def get_table_pk(table: str):
    """Obtiene la primary key de una tabla"""
    db_name = request.args.get("db", "spm")

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": "BD no permitida"}}), 400

    allowed = ALLOWED_TABLES.get(db_name, [])
    if table not in allowed:
        return jsonify({"ok": False, "error": {"code": "forbidden", "message": f"Tabla no permitida: {table}"}}), 403

    pk_columns = _get_table_pk(db_name, table)

    return jsonify({
        "ok": True,
        "table": table,
        "database": db_name,
        "primary_key": pk_columns,
    }), 200


@bp.route("/tables/<table>/rows", methods=["POST"])
@require_auth
@require_admin
@rate_limit(requests=10, window_seconds=60)
def create_row(table: str):
    """Crear un nuevo registro en una tabla"""
    data = request.json or {}
    db_name = data.get("db", "spm")
    row_data = data.get("data", {})

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": "BD no permitida"}}), 400

    allowed = ALLOWED_TABLES.get(db_name, [])
    if table not in allowed:
        return jsonify({"ok": False, "error": {"code": "forbidden", "message": f"Tabla no permitida: {table}"}}), 403

    # Verificar si la tabla es de solo lectura
    if _is_table_read_only(db_name, table):
        return jsonify({"ok": False, "error": {"code": "read_only", "message": f"Tabla {table} es de solo lectura"}}), 403

    if not row_data:
        return jsonify({"ok": False, "error": {"code": "invalid_data", "message": "No se proporcionaron datos"}}), 400

    # Filtrar columnas protegidas y auto-gestionadas
    filtered_data = {k: v for k, v in row_data.items()
                     if k not in PROTECTED_COLUMNS and k not in AUTO_MANAGED_COLUMNS}

    if not filtered_data:
        return jsonify({"ok": False, "error": {"code": "invalid_data", "message": "No hay columnas validas para insertar"}}), 400

    # Validar columnas contra estructura de la tabla
    table_columns = _get_table_columns_info(db_name, table)
    valid_column_names = {c["name"] for c in table_columns}

    invalid_columns = [k for k in filtered_data.keys() if k not in valid_column_names]
    if invalid_columns:
        return jsonify({"ok": False, "error": {"code": "invalid_columns", "message": f"Columnas invalidas: {invalid_columns}"}}), 400

    try:
        columns = list(filtered_data.keys())
        values = list(filtered_data.values())

        if db_name == "spm" and is_postgres():
            with get_db_connection() as conn:
                cur = conn.cursor()
                placeholders = ", ".join(["%s"] * len(values))
                col_names = ", ".join(columns)

                # Intentar obtener el ID devuelto
                pk_columns = _get_table_pk(db_name, table)
                if pk_columns:
                    query = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders}) RETURNING {pk_columns[0]}"
                    cur.execute(query, values)
                    new_id = cur.fetchone()[0]
                else:
                    query = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})"
                    cur.execute(query, values)
                    new_id = None

                conn.commit()
        else:
            db_path = get_sqlite_path(db_name)
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            placeholders = ", ".join(["?"] * len(values))
            col_names = ", ".join([f"[{c}]" for c in columns])

            query = f"INSERT INTO [{table}] ({col_names}) VALUES ({placeholders})"
            cur.execute(query, values)
            new_id = cur.lastrowid

            conn.commit()
            conn.close()

        # Log de auditoria
        user_id = g.user.get("id_spm") or g.user.get("user_id") or 0
        _log_crud_operation("INSERT", table, db_name, {"id": new_id, "data": filtered_data}, user_id)

        return jsonify({
            "ok": True,
            "id": new_id,
            "message": f"Registro creado exitosamente en {table}",
        }), 201

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "insert_error", "message": str(e)}}), 500


@bp.route("/tables/<table>/rows", methods=["PUT"])
@require_auth
@require_admin
@rate_limit(requests=10, window_seconds=60)
def update_row(table: str):
    """Actualizar un registro existente"""
    data = request.json or {}
    db_name = data.get("db", "spm")
    pk_data = data.get("pk", {})
    row_data = data.get("data", {})

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": "BD no permitida"}}), 400

    allowed = ALLOWED_TABLES.get(db_name, [])
    if table not in allowed:
        return jsonify({"ok": False, "error": {"code": "forbidden", "message": f"Tabla no permitida: {table}"}}), 403

    # Verificar si la tabla es de solo lectura
    if _is_table_read_only(db_name, table):
        return jsonify({"ok": False, "error": {"code": "read_only", "message": f"Tabla {table} es de solo lectura"}}), 403

    if not pk_data:
        return jsonify({"ok": False, "error": {"code": "invalid_pk", "message": "No se proporciono primary key"}}), 400

    if not row_data:
        return jsonify({"ok": False, "error": {"code": "invalid_data", "message": "No se proporcionaron datos"}}), 400

    # Filtrar columnas protegidas y auto-gestionadas
    filtered_data = {k: v for k, v in row_data.items()
                     if k not in PROTECTED_COLUMNS and k not in AUTO_MANAGED_COLUMNS}

    # No permitir modificar PK
    pk_columns = _get_table_pk(db_name, table)
    for pk_col in pk_columns:
        if pk_col in filtered_data:
            del filtered_data[pk_col]

    if not filtered_data:
        return jsonify({"ok": False, "error": {"code": "invalid_data", "message": "No hay columnas validas para actualizar"}}), 400

    # Validar columnas contra estructura de la tabla
    table_columns = _get_table_columns_info(db_name, table)
    valid_column_names = {c["name"] for c in table_columns}

    invalid_columns = [k for k in filtered_data.keys() if k not in valid_column_names]
    if invalid_columns:
        return jsonify({"ok": False, "error": {"code": "invalid_columns", "message": f"Columnas invalidas: {invalid_columns}"}}), 400

    try:
        columns = list(filtered_data.keys())
        values = list(filtered_data.values())

        if db_name == "spm" and is_postgres():
            with get_db_connection() as conn:
                cur = conn.cursor()

                # Construir SET clause
                set_clause = ", ".join([f"{col} = %s" for col in columns])

                # Construir WHERE clause con PK
                where_parts = []
                where_values = []
                for pk_col, pk_val in pk_data.items():
                    where_parts.append(f"{pk_col} = %s")
                    where_values.append(pk_val)

                where_clause = " AND ".join(where_parts)

                query = f"UPDATE {table} SET {set_clause} WHERE {where_clause}"
                cur.execute(query, values + where_values)
                updated = cur.rowcount

                conn.commit()
        else:
            db_path = get_sqlite_path(db_name)
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            # Construir SET clause
            set_clause = ", ".join([f"[{col}] = ?" for col in columns])

            # Construir WHERE clause con PK
            where_parts = []
            where_values = []
            for pk_col, pk_val in pk_data.items():
                where_parts.append(f"[{pk_col}] = ?")
                where_values.append(pk_val)

            where_clause = " AND ".join(where_parts)

            query = f"UPDATE [{table}] SET {set_clause} WHERE {where_clause}"
            cur.execute(query, values + where_values)
            updated = cur.rowcount

            conn.commit()
            conn.close()

        if updated == 0:
            return jsonify({"ok": False, "error": {"code": "not_found", "message": "Registro no encontrado"}}), 404

        # Log de auditoria
        user_id = g.user.get("id_spm") or g.user.get("user_id") or 0
        _log_crud_operation("UPDATE", table, db_name, {"pk": pk_data, "data": filtered_data}, user_id)

        return jsonify({
            "ok": True,
            "updated": updated,
            "message": f"Registro actualizado en {table}",
        }), 200

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "update_error", "message": str(e)}}), 500


@bp.route("/tables/<table>/rows", methods=["DELETE"])
@require_auth
@require_admin
@rate_limit(requests=5, window_seconds=60)
def delete_row(table: str):
    """Eliminar un registro"""
    data = request.json or {}
    db_name = data.get("db", "spm")
    pk_data = data.get("pk", {})
    soft_delete = data.get("soft_delete", False)

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": "BD no permitida"}}), 400

    allowed = ALLOWED_TABLES.get(db_name, [])
    if table not in allowed:
        return jsonify({"ok": False, "error": {"code": "forbidden", "message": f"Tabla no permitida: {table}"}}), 403

    # Verificar si la tabla es de solo lectura
    if _is_table_read_only(db_name, table):
        return jsonify({"ok": False, "error": {"code": "read_only", "message": f"Tabla {table} es de solo lectura"}}), 403

    if not pk_data:
        return jsonify({"ok": False, "error": {"code": "invalid_pk", "message": "No se proporciono primary key"}}), 400

    try:
        # Obtener datos antes de eliminar para audit
        record_data = {}

        if db_name == "spm" and is_postgres():
            with get_db_connection() as conn:
                cur = conn.cursor()

                # Construir WHERE clause con PK
                where_parts = []
                where_values = []
                for pk_col, pk_val in pk_data.items():
                    where_parts.append(f"{pk_col} = %s")
                    where_values.append(pk_val)

                where_clause = " AND ".join(where_parts)

                # Obtener registro antes de eliminar
                cur.execute(f"SELECT * FROM {table} WHERE {where_clause}", where_values)
                row = cur.fetchone()
                if row:
                    cur.execute("""
                        SELECT column_name FROM information_schema.columns
                        WHERE table_name = %s ORDER BY ordinal_position
                    """, (table,))
                    columns = [r[0] for r in cur.fetchall()]
                    record_data = dict(zip(columns, [str(v) if v is not None else None for v in row]))

                if soft_delete:
                    # Soft delete: actualizar campo activo
                    table_columns = _get_table_columns_info(db_name, table)
                    col_names = {c["name"] for c in table_columns}

                    if "activo" in col_names:
                        cur.execute(f"UPDATE {table} SET activo = false WHERE {where_clause}", where_values)
                    elif "active" in col_names:
                        cur.execute(f"UPDATE {table} SET active = false WHERE {where_clause}", where_values)
                    elif "deleted" in col_names:
                        cur.execute(f"UPDATE {table} SET deleted = true WHERE {where_clause}", where_values)
                    else:
                        return jsonify({"ok": False, "error": {"code": "soft_delete_not_supported", "message": "Tabla no soporta soft delete"}}), 400
                    deleted = cur.rowcount
                else:
                    # Hard delete
                    cur.execute(f"DELETE FROM {table} WHERE {where_clause}", where_values)
                    deleted = cur.rowcount

                conn.commit()
        else:
            db_path = get_sqlite_path(db_name)
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()

            # Construir WHERE clause con PK
            where_parts = []
            where_values = []
            for pk_col, pk_val in pk_data.items():
                where_parts.append(f"[{pk_col}] = ?")
                where_values.append(pk_val)

            where_clause = " AND ".join(where_parts)

            # Obtener registro antes de eliminar
            cur.execute(f"SELECT * FROM [{table}] WHERE {where_clause}", where_values)
            row = cur.fetchone()
            if row:
                record_data = dict(row)

            if soft_delete:
                # Soft delete
                table_columns = _get_table_columns_info(db_name, table)
                col_names = {c["name"] for c in table_columns}

                if "activo" in col_names:
                    cur.execute(f"UPDATE [{table}] SET activo = 0 WHERE {where_clause}", where_values)
                elif "active" in col_names:
                    cur.execute(f"UPDATE [{table}] SET active = 0 WHERE {where_clause}", where_values)
                elif "deleted" in col_names:
                    cur.execute(f"UPDATE [{table}] SET deleted = 1 WHERE {where_clause}", where_values)
                else:
                    conn.close()
                    return jsonify({"ok": False, "error": {"code": "soft_delete_not_supported", "message": "Tabla no soporta soft delete"}}), 400
                deleted = cur.rowcount
            else:
                # Hard delete
                cur.execute(f"DELETE FROM [{table}] WHERE {where_clause}", where_values)
                deleted = cur.rowcount

            conn.commit()
            conn.close()

        if deleted == 0:
            return jsonify({"ok": False, "error": {"code": "not_found", "message": "Registro no encontrado"}}), 404

        # Log de auditoria
        user_id = g.user.get("id_spm") or g.user.get("user_id") or 0
        operation = "SOFT_DELETE" if soft_delete else "DELETE"
        _log_crud_operation(operation, table, db_name, {"pk": pk_data, "deleted_data": record_data}, user_id)

        return jsonify({
            "ok": True,
            "deleted": deleted,
            "message": f"Registro {'desactivado' if soft_delete else 'eliminado'} de {table}",
        }), 200

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "delete_error", "message": str(e)}}), 500


@bp.route("/tables/<table>/columns", methods=["GET"])
@require_auth
@require_admin
@rate_limit(requests=30, window_seconds=60)
def get_table_columns_for_crud(table: str):
    """Obtiene columnas de una tabla filtrando las protegidas (para forms CRUD)"""
    db_name = request.args.get("db", "spm")

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": "BD no permitida"}}), 400

    allowed = ALLOWED_TABLES.get(db_name, [])
    if table not in allowed:
        return jsonify({"ok": False, "error": {"code": "forbidden", "message": f"Tabla no permitida: {table}"}}), 403

    columns = _get_table_columns_info(db_name, table)
    pk_columns = _get_table_pk(db_name, table)

    # Filtrar columnas protegidas para el display
    safe_columns = []
    for col in columns:
        if col["name"] in PROTECTED_COLUMNS:
            continue
        col["is_pk"] = col["name"] in pk_columns
        col["is_auto"] = col["name"] in AUTO_MANAGED_COLUMNS
        col["editable"] = col["name"] not in PROTECTED_COLUMNS and col["name"] not in pk_columns
        safe_columns.append(col)

    return jsonify({
        "ok": True,
        "table": table,
        "database": db_name,
        "columns": safe_columns,
        "primary_key": pk_columns,
        "read_only": _is_table_read_only(db_name, table),
    }), 200


# ==================== STATISTICS & AUDIT ====================

@bp.route("/tables/<table>/stats", methods=["GET"])
@require_auth
@require_admin
@rate_limit(requests=30, window_seconds=60)
def get_table_stats(table: str):
    """Obtiene estadisticas detalladas de una tabla"""
    db_name = request.args.get("db", "spm")

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": "BD no permitida"}}), 400

    allowed = ALLOWED_TABLES.get(db_name, [])
    if table not in allowed:
        return jsonify({"ok": False, "error": {"code": "forbidden", "message": f"Tabla no permitida: {table}"}}), 403

    try:
        if is_postgres() and db_name == "spm":
            with get_db_connection() as conn:
                cur = conn.cursor()

                # Tamaño de la tabla
                cur.execute("""
                    SELECT pg_total_relation_size(%s::regclass) as total_size,
                           pg_relation_size(%s::regclass) as table_size,
                           pg_indexes_size(%s::regclass) as index_size
                """, (table, table, table))
                size_row = cur.fetchone()

                # Estadisticas de filas
                cur.execute("""
                    SELECT reltuples::bigint as estimated_rows,
                           n_live_tup, n_dead_tup,
                           last_vacuum, last_autovacuum,
                           last_analyze, last_autoanalyze
                    FROM pg_stat_user_tables
                    WHERE relname = %s
                """, (table,))
                stats_row = cur.fetchone()

                # Numero de indices
                cur.execute("""
                    SELECT COUNT(*) FROM pg_indexes WHERE tablename = %s
                """, (table,))
                index_count = cur.fetchone()[0]

                # Conteo real de filas
                cur.execute(f'SELECT COUNT(*) FROM "{table}"')
                actual_rows = cur.fetchone()[0]

            return jsonify({
                "ok": True,
                "table": table,
                "database": db_name,
                "type": "postgresql",
                "stats": {
                    "total_size_bytes": size_row[0] if size_row else 0,
                    "table_size_bytes": size_row[1] if size_row else 0,
                    "index_size_bytes": size_row[2] if size_row else 0,
                    "total_size_mb": round((size_row[0] or 0) / (1024 * 1024), 2),
                    "estimated_rows": stats_row[0] if stats_row else 0,
                    "actual_rows": actual_rows,
                    "live_tuples": stats_row[1] if stats_row else 0,
                    "dead_tuples": stats_row[2] if stats_row else 0,
                    "last_vacuum": stats_row[3].isoformat() if stats_row and stats_row[3] else None,
                    "last_autovacuum": stats_row[4].isoformat() if stats_row and stats_row[4] else None,
                    "last_analyze": stats_row[5].isoformat() if stats_row and stats_row[5] else None,
                    "last_autoanalyze": stats_row[6].isoformat() if stats_row and stats_row[6] else None,
                    "index_count": index_count,
                    "fragmentation_pct": round(100 * (stats_row[2] or 0) / max((stats_row[1] or 0) + (stats_row[2] or 0), 1), 2) if stats_row else 0,
                },
            }), 200
        else:
            db_path = get_sqlite_path(db_name)
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            # Conteo de filas
            cur.execute(f"SELECT COUNT(*) FROM [{table}]")
            row_count = cur.fetchone()[0]

            # Numero de indices
            cur.execute(f"SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=?", (table,))
            index_count = cur.fetchone()[0]

            # Tamaño aproximado (paginas usadas)
            cur.execute("PRAGMA page_count")
            page_count = cur.fetchone()[0]
            cur.execute("PRAGMA page_size")
            page_size = cur.fetchone()[0]

            conn.close()

            # Tamaño del archivo
            file_size = os.path.getsize(db_path)

            return jsonify({
                "ok": True,
                "table": table,
                "database": db_name,
                "type": "sqlite",
                "stats": {
                    "total_size_bytes": file_size,
                    "total_size_mb": round(file_size / (1024 * 1024), 2),
                    "actual_rows": row_count,
                    "index_count": index_count,
                    "page_count": page_count,
                    "page_size": page_size,
                },
            }), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "stats_error", "message": str(e)}}), 500


@bp.route("/audit-logs", methods=["GET"])
@require_auth
@require_admin
@rate_limit(requests=30, window_seconds=60)
def get_audit_logs():
    """Obtiene los logs de auditoria con filtros"""
    table = request.args.get("table")
    user_id = request.args.get("user_id", type=int)
    operation = request.args.get("operation")  # CREATE, UPDATE, DELETE, DB_CREATE, etc.
    days = request.args.get("days", 7, type=int)
    limit = min(request.args.get("limit", 100, type=int), 500)
    offset = request.args.get("offset", 0, type=int)

    try:
        if is_postgres():
            with get_db_connection() as conn:
                cur = conn.cursor()

                # Verificar si la tabla audit_trail existe en PostgreSQL
                # fetchone() retorna dict en PostgresCursorWrapper
                cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_trail') as table_exists")
                result = cur.fetchone()
                if not result or not result.get('table_exists', False):
                    return jsonify({"ok": True, "logs": [], "total": 0, "message": "Tabla audit_trail no existe"}), 200

                # Construir query con filtros
                conditions = ["created_at >= CURRENT_DATE - %s * INTERVAL '1 day'"]
                params = [days]

                if table:
                    conditions.append("entidad LIKE %s")
                    params.append(f"%{table}%")
                if user_id:
                    conditions.append("actor_id = %s")
                    params.append(str(user_id))
                if operation:
                    conditions.append("accion LIKE %s")
                    params.append(f"%{operation}%")

                where_clause = " AND ".join(conditions)

                # Contar total - fetchone() retorna dict
                cur.execute(f"""
                    SELECT COUNT(*) as total FROM audit_trail WHERE {where_clause}
                """, params)
                count_row = cur.fetchone()
                total = count_row.get('total', 0) if count_row else 0

                # Obtener logs
                params.extend([limit, offset])
                cur.execute(f"""
                    SELECT id, actor_id, accion, entidad, entidad_id,
                           COALESCE(valor_nuevo, valor_anterior, campo_modificado) as details,
                           created_at, ip_address
                    FROM audit_trail
                    WHERE {where_clause}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """, params)

                logs = []
                for row in cur.fetchall():
                    details = row.get('details')
                    if isinstance(details, str):
                        try:
                            details = json.loads(details)
                        except (json.JSONDecodeError, TypeError):
                            pass
                    created_at = row.get('created_at')
                    logs.append({
                        "id": row.get('id'),
                        "user_id": row.get('actor_id'),
                        "action": row.get('accion'),
                        "entity_type": row.get('entidad'),
                        "entity_id": row.get('entidad_id'),
                        "details": details,
                        "created_at": created_at.isoformat() if hasattr(created_at, 'isoformat') else created_at,
                        "ip_address": row.get('ip_address'),
                    })

            return jsonify({
                "ok": True,
                "logs": logs,
                "total": total,
                "limit": limit,
                "offset": offset,
            }), 200
        else:
            # SQLite fallback
            db_path = get_sqlite_path("spm")
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            # Verificar si la tabla audit_trail existe
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_trail'")
            if not cur.fetchone():
                conn.close()
                return jsonify({"ok": True, "logs": [], "total": 0, "message": "Tabla audit_trail no existe"}), 200

            # Construir query - usar nombres de columnas correctos de SQLite
            # La tabla usa: actor_id, accion, entidad, entidad_id
            conditions = ["datetime(created_at) >= datetime('now', ?)"]
            params = [f"-{days} days"]

            if table:
                conditions.append("entidad LIKE ?")
                params.append(f"%{table}%")
            if user_id:
                conditions.append("actor_id = ?")
                params.append(str(user_id))
            if operation:
                conditions.append("accion LIKE ?")
                params.append(f"%{operation}%")

            where_clause = " AND ".join(conditions)

            # Contar
            cur.execute(f"SELECT COUNT(*) FROM audit_trail WHERE {where_clause}", params)
            total = cur.fetchone()[0]

            # Obtener logs
            params.extend([limit, offset])
            cur.execute(f"""
                SELECT id, actor_id, accion, entidad, entidad_id,
                       COALESCE(valor_nuevo, valor_anterior, campo_modificado) as details,
                       created_at, ip_address
                FROM audit_trail
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """, params)

            logs = []
            for row in cur.fetchall():
                details = row[5]
                try:
                    details = json.loads(details) if details else None
                except (json.JSONDecodeError, TypeError):
                    pass
                logs.append({
                    "id": row[0],
                    "user_id": row[1],
                    "action": row[2],
                    "entity_type": row[3],
                    "entity_id": row[4],
                    "details": details,
                    "created_at": row[6],
                    "ip_address": row[7] if len(row) > 7 else None,
                })

            conn.close()

            return jsonify({
                "ok": True,
                "logs": logs,
                "total": total,
                "limit": limit,
                "offset": offset,
            }), 200

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "audit_error", "message": str(e)}}), 500


@bp.route("/connections", methods=["GET"])
@require_auth
@require_admin
@rate_limit(requests=30, window_seconds=60)
def get_active_connections():
    """Obtiene conexiones activas de PostgreSQL"""
    if not is_postgres():
        return jsonify({"ok": False, "error": {"code": "not_supported", "message": "Solo disponible para PostgreSQL"}}), 400

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT pid, usename, application_name, client_addr,
                       state, query_start, state_change,
                       EXTRACT(EPOCH FROM (now() - query_start))::int as query_duration_sec
                FROM pg_stat_activity
                WHERE datname = current_database()
                  AND pid <> pg_backend_pid()
                ORDER BY query_start DESC NULLS LAST
                LIMIT 50
            """)

            connections = []
            for row in cur.fetchall():
                connections.append({
                    "pid": row[0],
                    "user": row[1],
                    "application": row[2],
                    "client_addr": str(row[3]) if row[3] else None,
                    "state": row[4],
                    "query_start": row[5].isoformat() if row[5] else None,
                    "state_change": row[6].isoformat() if row[6] else None,
                    "query_duration_sec": row[7],
                })

        return jsonify({
            "ok": True,
            "connections": connections,
            "count": len(connections),
        }), 200

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "connections_error", "message": str(e)}}), 500
