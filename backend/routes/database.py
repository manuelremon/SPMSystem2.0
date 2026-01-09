"""
Database Administration Routes
Endpoints para administrar las bases de datos del sistema.
Solo accesible por usuarios con rol admin.
"""

import csv
import io
import os
import sqlite3
import time
from functools import wraps

from flask import Blueprint, g, jsonify, request, send_file

try:
    from backend.core.config import settings
    from backend.core.db import get_db_connection
    from backend.core.db_optimization import (
        analyze_tables,
        create_indexes,
        get_all_pool_stats,
        get_db_stats,
        optimize_database,
    )
    from backend.core.roles import require_auth
except ImportError:
    from core.config import settings
    from core.db import get_db_connection
    from core.db_optimization import (
        analyze_tables,
        create_indexes,
        get_all_pool_stats,
        get_db_stats,
        optimize_database,
    )
    from core.roles import require_auth

bp = Blueprint("database", __name__, url_prefix="/api/admin/database")

# Whitelist de bases de datos permitidas
ALLOWED_DATABASES = {"spm", "sap_data", "equivalentes", "catalogo_materiales"}

# Whitelist de tablas por BD (para prevenir SQL injection)
ALLOWED_TABLES = {
    "spm": [
        "usuarios", "solicitudes", "solicitud_items_tratamiento", "decision_abastecimiento",
        "decision_abastecimiento_fuentes", "presupuestos", "presupuesto_ledger",
        "budget_update_requests", "presupuesto_incorporaciones", "proveedores",
        "proveedores_externos", "proveedor_ext_contactos", "proveedor_ext_emails",
        "proveedor_ext_telefonos", "proveedores_internos", "proveedor_precios_negociados",
        "config_equivalencia_scores", "traslados", "solpeds", "purchase_orders",
        "solicitud_tratamiento_eventos", "solicitud_tratamiento_log", "mensajes",
        "notificaciones", "outbox_emails", "catalog_centros", "catalog_almacenes",
        "catalog_sectores", "catalog_roles", "catalog_puestos", "planificador_asignaciones",
        "config_almacenes", "config_lotes_excluidos", "user_profile_requests",
        "trivias_scores", "foro_posts", "foro_respuestas", "foro_likes",
        "archivos_adjuntos", "schema_migrations",
    ],
    "sap_data": ["stock", "consumo", "pedidos", "materiales"],
    "equivalentes": ["equivalencias", "materiales_base"],
    "catalogo_materiales": ["materiales", "categorias"],
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
                    db_info["tables"] = cur.fetchone()[0]

                    # Tamaño de la BD
                    cur.execute("SELECT pg_database_size(current_database())")
                    db_info["size_mb"] = round(cur.fetchone()[0] / (1024 * 1024), 2)

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
                    table_name = row[0]
                    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
                    count = cur.fetchone()[0]
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

    # Validar tabla
    allowed = ALLOWED_TABLES.get(db_name, [])
    if table not in allowed:
        # Intentar obtener tablas dinamicamente
        pass  # Permitir cualquier tabla existente

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
                        "name": row[0],
                        "type": row[1],
                        "nullable": row[2] == "YES",
                        "default": row[3],
                    })

                # Indices
                cur.execute("""
                    SELECT indexname, indexdef
                    FROM pg_indexes
                    WHERE tablename = %s
                """, (table,))
                for row in cur.fetchall():
                    indexes.append({"name": row[0], "definition": row[1]})
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
                columns = [row[0] for row in cur.fetchall()]

                # Contar total
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                total = cur.fetchone()[0]

                # Obtener datos
                cur.execute(f"SELECT * FROM {table} LIMIT %s OFFSET %s", (limit, offset))
                for row in cur.fetchall():
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
def run_optimize():
    """Ejecuta optimizacion completa (indices + analyze + vacuum)"""
    db_name = request.json.get("db", "spm") if request.json else "spm"

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida"}}), 400

    if is_postgres() and db_name == "spm":
        return jsonify({"ok": False, "error": {"code": "not_supported", "message": "Optimizacion no disponible para PostgreSQL desde aqui"}}), 400

    try:
        result = optimize_database(db_name)
        return jsonify({"ok": True, "message": f"BD {db_name} optimizada", "result": result}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "optimize_error", "message": str(e)}}), 500


@bp.route("/vacuum", methods=["POST"])
@require_auth
@require_admin
def run_vacuum():
    """Ejecuta VACUUM para compactar la BD"""
    db_name = request.json.get("db", "spm") if request.json else "spm"

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida"}}), 400

    if is_postgres() and db_name == "spm":
        return jsonify({"ok": False, "error": {"code": "not_supported", "message": "VACUUM no disponible para PostgreSQL desde aqui"}}), 400

    try:
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
def run_integrity_check():
    """Verifica integridad de la BD"""
    db_name = request.json.get("db", "spm") if request.json else "spm"

    if db_name not in ALLOWED_DATABASES:
        return jsonify({"ok": False, "error": {"code": "invalid_db", "message": f"BD no permitida"}}), 400

    if is_postgres() and db_name == "spm":
        return jsonify({"ok": False, "error": {"code": "not_supported", "message": "Integrity check no disponible para PostgreSQL"}}), 400

    try:
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
