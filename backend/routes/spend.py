"""
Spend Analytics Routes
Endpoints para analisis de gasto y Kraljic (Sprint 62)
Blueprint: spend_bp, Prefix: /api/spend
"""

from flask import Blueprint, jsonify, request

from backend.core.roles import require_admin, require_auth
from backend.services import spend_service

spend_bp = Blueprint('spend', __name__, url_prefix='/api/spend')


@spend_bp.route('/by-category', methods=['GET'])
@require_auth
def obtener_gasto_por_categoria():
    """Calcular gasto total por categoria en periodo especificado."""
    try:
        periodo_desde = request.args.get('periodo_desde')
        periodo_hasta = request.args.get('periodo_hasta')

        if not periodo_desde or not periodo_hasta:
            return jsonify({'error': 'periodo_desde y periodo_hasta son requeridos'}), 400

        resultado = spend_service.calcular_gasto_por_categoria(periodo_desde, periodo_hasta)
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@spend_bp.route('/maverick', methods=['GET'])
@require_auth
def detectar_maverick_spend():
    """Detectar compras maverick (fuera de contrato) en periodo."""
    try:
        periodo = request.args.get('periodo')
        if not periodo:
            return jsonify({'error': 'periodo es requerido'}), 400

        resultado = spend_service.detectar_maverick_spend(periodo)
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@spend_bp.route('/kraljic', methods=['GET'])
@require_auth
def generar_kraljic_matrix():
    """Generar matriz de Kraljic para clasificacion de materiales."""
    try:
        resultado = spend_service.generar_kraljic_matrix()
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@spend_bp.route('/trend', methods=['GET'])
@require_auth
def obtener_tendencia_gasto():
    """Obtener tendencia de gasto en ultimos N meses."""
    try:
        meses = int(request.args.get('meses', 12))
        if meses < 1 or meses > 36:
            return jsonify({'error': 'meses debe estar entre 1 y 36'}), 400

        resultado = spend_service.obtener_tendencia_gasto(meses)
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@spend_bp.route('/tco/<material>', methods=['GET'])
@require_auth
def obtener_tco_material(material):
    """Calcular Total Cost of Ownership para un material."""
    try:
        resultado = spend_service.obtener_tco_material(material)
        if not resultado:
            return jsonify({'error': 'Material no encontrado'}), 404
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@spend_bp.route('/snapshot', methods=['POST'])
@require_admin
def tomar_snapshot_periodo():
    """Tomar snapshot de gasto para periodo (solo admin)."""
    try:
        data = request.get_json()
        if not data or 'periodo' not in data:
            return jsonify({'error': 'periodo es requerido'}), 400

        resultado = spend_service.tomar_snapshot_periodo(data['periodo'])
        return jsonify(resultado), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
