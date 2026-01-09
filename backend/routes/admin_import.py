"""
Rutas de administración para importación de datos temporales.

Endpoints para importar Excel y gestionar modo temporal de MRP/Forecast.
Solo accesible por usuarios con rol admin.
"""

import logging
from io import BytesIO

from flask import Blueprint, jsonify, request, send_file

from backend.core.excel_validator import excel_validator
from backend.core.roles import require_auth, is_admin
from backend.services.temp_data_service import temp_data_service

logger = logging.getLogger(__name__)

bp = Blueprint("admin_import", __name__, url_prefix="/api/admin")


def _get_user_id() -> str:
    """Obtiene el user_id del request context."""
    from flask import g
    # El auth middleware setea g.user con los datos del usuario
    user = getattr(g, "user", None)
    if user:
        return user.get("id_spm", "")
    # Fallback a formatos legacy
    return getattr(g, "user_id", None) or getattr(g, "current_user", {}).get("id_spm", "")


def _check_admin():
    """Verifica que el usuario sea admin. Retorna error response o None."""
    from flask import g

    user = getattr(g, "user", None)
    if not user:
        return jsonify({"ok": False, "error": "No autenticado"}), 401

    user_rol = user.get("rol", "")
    if not is_admin(user_rol):
        return jsonify({"ok": False, "error": "Acceso denegado. Se requiere rol admin."}), 403

    return None


@bp.route("/import-excel", methods=["POST"])
@require_auth
def import_excel():
    """
    Importa un archivo Excel para modo temporal MRP/Forecast.

    Request:
        Content-Type: multipart/form-data
        file: archivo Excel (.xlsx)

    Response:
        {
            "ok": true,
            "session_id": "temp_...",
            "resumen": {...},
            "advertencias": [...]
        }
    """
    # Verificar admin
    error_response = _check_admin()
    if error_response:
        return error_response

    # Verificar archivo
    if "file" not in request.files:
        return jsonify({
            "ok": False,
            "error": "No se proporcionó archivo"
        }), 400

    file = request.files["file"]

    if not file.filename:
        return jsonify({
            "ok": False,
            "error": "Nombre de archivo vacío"
        }), 400

    # Validar Excel
    validation = excel_validator.validate_file(file, file.filename)

    if not validation.valid:
        return jsonify({
            "ok": False,
            "error": "Archivo inválido",
            "errores": validation.errors,
            "advertencias": validation.warnings
        }), 400

    # Importar datos
    user_id = _get_user_id()

    try:
        store = temp_data_service.import_from_dataframes(
            user_id=user_id,
            stock_df=validation.stock_df,
            consumo_df=validation.consumo_df,
            parametros_mrp_df=validation.parametros_mrp_df,
            archivo_nombre=file.filename
        )

        logger.info(f"Excel importado exitosamente por usuario {user_id}: {file.filename}")

        return jsonify({
            "ok": True,
            "message": "Modo temporal activado",
            "session_id": f"temp_{user_id}",
            "resumen": {
                "materiales": store.materiales_count,
                "registros_stock": store.registros_stock,
                "registros_consumo": store.registros_consumo,
                "rango_fechas": list(store.rango_fechas)
            },
            "advertencias": store.advertencias + validation.warnings
        })

    except Exception as e:
        logger.error(f"Error importando Excel: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": f"Error al procesar datos: {str(e)}"
        }), 500


@bp.route("/temp-data/status", methods=["GET"])
@require_auth
def temp_data_status():
    """
    Obtiene el estado del modo temporal para el usuario actual.

    Response:
        {
            "ok": true,
            "active": true/false,
            "data": {...} o null
        }
    """
    error_response = _check_admin()
    if error_response:
        return error_response

    user_id = _get_user_id()
    status = temp_data_service.get_status(user_id)

    return jsonify({
        "ok": True,
        "active": status is not None,
        "data": status
    })


@bp.route("/temp-data/clear", methods=["POST"])
@require_auth
def clear_temp_data():
    """
    Desactiva el modo temporal eliminando los datos importados.

    Response:
        {
            "ok": true,
            "message": "Modo temporal desactivado"
        }
    """
    error_response = _check_admin()
    if error_response:
        return error_response

    user_id = _get_user_id()
    was_active = temp_data_service.clear(user_id)

    if was_active:
        logger.info(f"Modo temporal desactivado por usuario {user_id}")

    return jsonify({
        "ok": True,
        "was_active": was_active,
        "message": "Modo temporal desactivado" if was_active else "No había modo temporal activo"
    })


@bp.route("/temp-data/template", methods=["GET"])
@require_auth
def download_template():
    """
    Descarga una plantilla Excel vacía con la estructura correcta.

    Response:
        Archivo Excel (.xlsx)
    """
    error_response = _check_admin()
    if error_response:
        return error_response

    try:
        import pandas as pd

        # Crear DataFrames de ejemplo
        stock_example = pd.DataFrame({
            "material": ["MAT001", "MAT002", "MAT003"],
            "descripcion": ["Tuerca M16 Acero", "Aceite Hidraulico 20L", "Filtro de Aire"],
            "centro": ["1008", "1008", "1500"],
            "almacen": ["0001", "0001", "0002"],
            "stock": [150, 45, 200],
            "um": ["UNI", "LT", "UNI"],
            "precio_usd": [2.50, 15.00, 8.75],
            "grupo_articulos": ["FERRETERIA", "LUBRICANTES", "FILTROS"],
            "ubicacion": ["A-01-03", "B-02-01", "C-03-02"],
            "critico": ["NO", "SI", "NO"]
        })

        consumo_example = pd.DataFrame({
            "material": [
                "MAT001", "MAT001", "MAT001", "MAT001", "MAT001", "MAT001",
                "MAT002", "MAT002", "MAT002", "MAT002", "MAT002", "MAT002",
                "MAT003", "MAT003", "MAT003", "MAT003", "MAT003", "MAT003"
            ],
            "fecha": [
                "2024-01-15", "2024-02-15", "2024-03-15", "2024-04-15", "2024-05-15", "2024-06-15",
                "2024-01-15", "2024-02-15", "2024-03-15", "2024-04-15", "2024-05-15", "2024-06-15",
                "2024-01-15", "2024-02-15", "2024-03-15", "2024-04-15", "2024-05-15", "2024-06-15"
            ],
            "cantidad": [
                25, 30, 28, 35, 22, 40,
                8, 10, 7, 12, 9, 11,
                15, 18, 20, 16, 22, 19
            ],
            "centro": [
                "1008", "1008", "1008", "1008", "1008", "1008",
                "1008", "1008", "1008", "1008", "1008", "1008",
                "1500", "1500", "1500", "1500", "1500", "1500"
            ]
        })

        parametros_example = pd.DataFrame({
            "material": ["MAT001", "MAT002", "MAT003"],
            "stock_seguridad": [50, 20, 40],
            "punto_pedido": [100, 30, 80],
            "stock_maximo": [300, 100, 250],
            "lead_time_dias": [15, 30, 10]
        })

        # Crear Excel en memoria
        output = BytesIO()

        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            stock_example.to_excel(writer, sheet_name="stock", index=False)
            consumo_example.to_excel(writer, sheet_name="consumo_historico", index=False)
            parametros_example.to_excel(writer, sheet_name="parametros_mrp", index=False)

        output.seek(0)

        return send_file(
            output,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="plantilla_mrp_forecast.xlsx"
        )

    except ImportError:
        return jsonify({
            "ok": False,
            "error": "openpyxl no está instalado. Ejecute: pip install openpyxl"
        }), 500
    except Exception as e:
        logger.error(f"Error generando plantilla: {e}", exc_info=True)
        return jsonify({
            "ok": False,
            "error": f"Error al generar plantilla: {str(e)}"
        }), 500


@bp.route("/temp-data/preview", methods=["POST"])
@require_auth
def preview_excel():
    """
    Valida un Excel y retorna preview sin importar.

    Request:
        Content-Type: multipart/form-data
        file: archivo Excel (.xlsx)

    Response:
        {
            "ok": true,
            "valid": true/false,
            "errores": [...],
            "advertencias": [...],
            "preview": {
                "stock": [...primeros 10],
                "consumo": [...primeros 10]
            }
        }
    """
    error_response = _check_admin()
    if error_response:
        return error_response

    if "file" not in request.files:
        return jsonify({
            "ok": False,
            "error": "No se proporcionó archivo"
        }), 400

    file = request.files["file"]

    if not file.filename:
        return jsonify({
            "ok": False,
            "error": "Nombre de archivo vacío"
        }), 400

    # Validar
    validation = excel_validator.validate_file(file, file.filename)

    response = {
        "ok": True,
        "valid": validation.valid,
        "errores": validation.errors,
        "advertencias": validation.warnings,
        "resumen": validation.to_dict()["resumen"]
    }

    # Agregar preview si es válido
    if validation.valid and validation.stock_df is not None:
        response["preview"] = {
            "stock": validation.stock_df.head(10).fillna("").to_dict("records"),
            "consumo": validation.consumo_df.head(10).fillna("").to_dict("records") if validation.consumo_df is not None else []
        }

    return jsonify(response)
