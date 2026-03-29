"""
Shared Files - Endpoints para subir y gestionar archivos compartidos.
Accesible para usuarios con rol 'compartidos' y administradores.
Sin restricción de formato ni tamaño.
"""

import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, g, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from backend.core.db import get_db_connection, is_using_postgresql
from backend.core.roles import require_auth, require_role

logger = logging.getLogger(__name__)

bp = Blueprint("shared_files", __name__, url_prefix="/api/shared-files")

UPLOADS_BASE = Path(__file__).parent.parent.parent / "uploads" / "compartidos"


def _ensure_uploads_dir(subfolder=""):
    """Crea el directorio de uploads si no existe."""
    target = UPLOADS_BASE / subfolder if subfolder else UPLOADS_BASE
    target.mkdir(parents=True, exist_ok=True)
    return target


def _init_table():
    """Crea la tabla shared_files si no existe."""
    conn = get_db_connection()
    cursor = conn.cursor()
    pg = is_using_postgresql()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS shared_files (
            id TEXT PRIMARY KEY,
            nombre_original TEXT NOT NULL,
            nombre_almacenado TEXT NOT NULL,
            ruta_relativa TEXT NOT NULL,
            carpeta TEXT DEFAULT '',
            mime_type TEXT DEFAULT 'application/octet-stream',
            tamanio INTEGER DEFAULT 0,
            subido_por TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


# Inicializar tabla al importar el módulo
try:
    _init_table()
except Exception as e:
    logger.warning(f"shared_files: No se pudo inicializar tabla: {e}")


@bp.route("", methods=["GET"])
@require_auth
@require_role(["compartidos", "admin", "administrador"])
def list_files():
    """Lista todos los archivos compartidos, opcionalmente filtrados por carpeta."""
    carpeta = request.args.get("carpeta", "")

    conn = get_db_connection()
    cursor = conn.cursor()

    if carpeta:
        cursor.execute(
            "SELECT * FROM shared_files WHERE carpeta = ? ORDER BY created_at DESC",
            (carpeta,),
        )
    else:
        cursor.execute("SELECT * FROM shared_files ORDER BY created_at DESC")

    files = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # Obtener lista de carpetas únicas
    carpetas = sorted(set(f.get("carpeta", "") for f in files if f.get("carpeta")))

    return jsonify({"ok": True, "files": files, "carpetas": carpetas}), 200


@bp.route("/upload", methods=["POST"])
@require_auth
@require_role(["compartidos", "admin", "administrador"])
def upload_files():
    """Sube uno o más archivos. Soporta cualquier formato sin restricción."""
    if "files" not in request.files and "file" not in request.files:
        return jsonify({"ok": False, "error": {"code": "no_files", "message": "No se enviaron archivos"}}), 400

    carpeta = request.form.get("carpeta", "")
    upload_dir = _ensure_uploads_dir(carpeta)

    file_list = request.files.getlist("files") or request.files.getlist("file")
    if not file_list:
        return jsonify({"ok": False, "error": {"code": "no_files", "message": "No se enviaron archivos"}}), 400

    user_id = g.user.get("id_spm") or g.user.get("id")
    uploaded = []
    conn = get_db_connection()
    cursor = conn.cursor()

    for file_obj in file_list:
        if not file_obj.filename:
            continue

        original_name = file_obj.filename
        safe_name = secure_filename(original_name) or "archivo"
        ext = Path(original_name).suffix
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = upload_dir / unique_name

        file_obj.save(str(file_path))
        file_size = file_path.stat().st_size
        file_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc).isoformat()

        cursor.execute(
            """INSERT INTO shared_files (id, nombre_original, nombre_almacenado, ruta_relativa, carpeta, mime_type, tamanio, subido_por, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                file_id,
                original_name,
                unique_name,
                str(Path("uploads/compartidos") / carpeta / unique_name),
                carpeta,
                file_obj.content_type or "application/octet-stream",
                file_size,
                str(user_id),
                now,
            ),
        )

        uploaded.append({
            "id": file_id,
            "nombre_original": original_name,
            "carpeta": carpeta,
            "mime_type": file_obj.content_type or "application/octet-stream",
            "tamanio": file_size,
            "created_at": now,
        })

    conn.commit()
    conn.close()

    logger.info(f"Usuario {user_id} subió {len(uploaded)} archivo(s) a carpeta '{carpeta}'")
    return jsonify({"ok": True, "files": uploaded, "count": len(uploaded)}), 201


@bp.route("/download/<file_id>", methods=["GET"])
@require_auth
@require_role(["compartidos", "admin", "administrador"])
def download_file(file_id):
    """Descarga un archivo por su ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM shared_files WHERE id = ?", (file_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"ok": False, "error": {"code": "not_found", "message": "Archivo no encontrado"}}), 404

    carpeta = row.get("carpeta", "") if hasattr(row, 'get') else ""
    directory = UPLOADS_BASE / carpeta if carpeta else UPLOADS_BASE

    return send_from_directory(
        str(directory),
        row["nombre_almacenado"],
        as_attachment=True,
        download_name=row["nombre_original"],
    )


@bp.route("/<file_id>", methods=["DELETE"])
@require_auth
@require_role(["compartidos", "admin", "administrador"])
def delete_file(file_id):
    """Elimina un archivo por su ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM shared_files WHERE id = ?", (file_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({"ok": False, "error": {"code": "not_found", "message": "Archivo no encontrado"}}), 404

    # Eliminar archivo físico
    carpeta = row.get("carpeta", "") if hasattr(row, 'get') else ""
    directory = UPLOADS_BASE / carpeta if carpeta else UPLOADS_BASE
    file_path = directory / row["nombre_almacenado"]
    if file_path.exists():
        file_path.unlink()

    # Eliminar registro
    cursor.execute("DELETE FROM shared_files WHERE id = ?", (file_id,))
    conn.commit()
    conn.close()

    logger.info(f"Archivo {file_id} ({row['nombre_original']}) eliminado")
    return jsonify({"ok": True, "message": "Archivo eliminado"}), 200


@bp.route("/carpetas", methods=["GET"])
@require_auth
@require_role(["compartidos", "admin", "administrador"])
def list_carpetas():
    """Lista todas las carpetas disponibles."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT carpeta FROM shared_files WHERE carpeta != '' ORDER BY carpeta")
    carpetas = [row[0] for row in cursor.fetchall()]
    conn.close()
    return jsonify({"ok": True, "carpetas": carpetas}), 200
