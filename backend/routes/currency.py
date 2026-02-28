"""
Currency Management & Foreign Exchange Routes
Endpoints para gestión de tipos de cambio (Sprint 71)
"""

from flask import Blueprint, jsonify, request

from backend.core.roles import require_auth
from backend.services import currency_service

currency_bp = Blueprint('currency', __name__, url_prefix='/api/currency')


@currency_bp.route('/rates', methods=['GET'])
@require_auth
def obtener_tasas_historicas():
    """Obtener tasas de cambio históricas."""
    try:
        moneda_origen = request.args.get('moneda_origen')
        moneda_destino = request.args.get('moneda_destino')
        dias = request.args.get('dias', 30, type=int)
        tasas = currency_service.obtener_tasas_historicas(moneda_origen, moneda_destino, dias)
        return jsonify({'ok': True, 'items': tasas}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@currency_bp.route('/rates', methods=['POST'])
@require_auth
def registrar_tasa():
    """Registrar nueva tasa de cambio."""
    try:
        data = request.get_json()
        tasa = currency_service.registrar_tasa(
            moneda_origen=data.get('moneda_origen'),
            moneda_destino=data.get('moneda_destino'),
            tasa=data.get('tasa'),
            fecha=data.get('fecha'),
            fuente=data.get('fuente')
        )
        return jsonify(tasa), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@currency_bp.route('/rates/latest', methods=['GET'])
@require_auth
def obtener_tasas_ultimas():
    """Obtener tasas de cambio más recientes."""
    try:
        tasas = currency_service.obtener_tasas_ultimas()
        return jsonify(tasas), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@currency_bp.route('/convert', methods=['POST'])
@require_auth
def convertir_monto():
    """Convertir monto entre monedas."""
    try:
        data = request.get_json()
        resultado = currency_service.convertir_monto(
            monto=data.get('monto'),
            moneda_origen=data.get('moneda_origen'),
            moneda_destino=data.get('moneda_destino'),
            fecha=data.get('fecha'),
            entidad_tipo=data.get('entidad_tipo'),
            entidad_id=data.get('entidad_id')
        )
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@currency_bp.route('/exposure', methods=['GET'])
@require_auth
def calcular_exposicion_cambiaria():
    """Calcular exposición cambiaria."""
    try:
        exposicion = currency_service.calcular_exposicion_cambiaria()
        exposicion['ok'] = True
        return jsonify(exposicion), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@currency_bp.route('/gain-loss', methods=['GET'])
@require_auth
def calcular_ganancia_perdida():
    """Calcular ganancia/pérdida por tipo de cambio."""
    try:
        periodo = request.args.get('periodo')
        resultado = currency_service.calcular_ganancia_perdida(periodo)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@currency_bp.route('/dashboard', methods=['GET'])
@require_auth
def obtener_dashboard_monedas():
    """Obtener dashboard de monedas."""
    try:
        dashboard = currency_service.obtener_dashboard_monedas()
        dashboard['ok'] = True
        return jsonify(dashboard), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
