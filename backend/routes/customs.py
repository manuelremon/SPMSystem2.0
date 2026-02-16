"""
Customs & Trade Compliance Routes
Endpoints para gestión aduanera y comercio exterior
"""

from flask import Blueprint, jsonify, request

from backend.core.roles import require_auth
from backend.services import customs_service

customs_bp = Blueprint('customs', __name__, url_prefix='/api/customs')


@customs_bp.route('/hs-codes', methods=['GET'])
@require_auth
def obtener_hs_codes():
    """Obtener códigos HS con paginación y búsqueda."""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        search = request.args.get('search')

        resultado = customs_service.obtener_hs_codes(page=page, per_page=per_page, search=search)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@customs_bp.route('/hs-codes', methods=['POST'])
@require_auth
def crear_hs_code():
    """Crear código HS."""
    try:
        data = request.get_json()

        # Validación básica
        if not data.get('codigo'):
            return jsonify({'error': 'Código HS es requerido'}), 400

        hs_id = customs_service.crear_hs_code(data)
        return jsonify({'id': hs_id, 'message': 'Código HS creado exitosamente'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@customs_bp.route('/classifications', methods=['POST'])
@require_auth
def clasificar_material():
    """Clasificar material con código HS."""
    try:
        data = request.get_json()

        # Validación básica
        if not data.get('material_codigo') or not data.get('hs_code_id'):
            return jsonify({'error': 'material_codigo y hs_code_id son requeridos'}), 400

        clasificacion_id = customs_service.clasificar_material(
            material_codigo=data['material_codigo'],
            hs_code_id=data['hs_code_id'],
            pais_origen=data.get('pais_origen', 'AR'),
            pais_destino=data.get('pais_destino'),
            certificado_origen=data.get('certificado_origen')
        )
        return jsonify({'id': clasificacion_id, 'message': 'Material clasificado exitosamente'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@customs_bp.route('/classifications/<material>', methods=['GET'])
@require_auth
def obtener_clasificacion(material):
    """Obtener clasificación aduanera de un material."""
    try:
        pais_origen = request.args.get('pais_origen', 'AR')
        pais_destino = request.args.get('pais_destino')

        clasificacion = customs_service.obtener_clasificacion(
            material_codigo=material,
            pais_origen=pais_origen,
            pais_destino=pais_destino
        )

        if not clasificacion:
            return jsonify({'error': 'Clasificación no encontrada'}), 404

        return jsonify(clasificacion), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@customs_bp.route('/calculate-duties', methods=['POST'])
@require_auth
def calcular_tributos():
    """Calcular tributos aduaneros."""
    try:
        data = request.get_json()

        # Validación básica
        if not all(k in data for k in ['valor_fob', 'flete', 'seguro']):
            return jsonify({'error': 'valor_fob, flete y seguro son requeridos'}), 400

        tributos = customs_service.calcular_tributos(
            valor_fob=data['valor_fob'],
            flete=data['flete'],
            seguro=data['seguro'],
            hs_code_id=data.get('hs_code_id'),
            acuerdo_id=data.get('acuerdo_id')
        )

        return jsonify(tributos), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@customs_bp.route('/operations', methods=['GET'])
@require_auth
def obtener_operaciones():
    """Obtener operaciones aduaneras con filtros."""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        tipo = request.args.get('tipo')
        estado = request.args.get('estado')

        resultado = customs_service.obtener_operaciones(
            page=page,
            per_page=per_page,
            tipo=tipo,
            estado=estado
        )
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@customs_bp.route('/operations', methods=['POST'])
@require_auth
def crear_operacion():
    """Crear operación aduanera."""
    try:
        data = request.get_json()

        # Validación básica
        if not data.get('tipo') or not data.get('fecha_operacion'):
            return jsonify({'error': 'tipo y fecha_operacion son requeridos'}), 400

        if data['tipo'] not in ['importacion', 'exportacion']:
            return jsonify({'error': 'tipo debe ser importacion o exportacion'}), 400

        operacion_id = customs_service.crear_operacion(data)
        return jsonify({'id': operacion_id, 'message': 'Operación aduanera creada exitosamente'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@customs_bp.route('/operations/<int:id>', methods=['PUT'])
@require_auth
def actualizar_estado_operacion(id):
    """Actualizar estado de operación aduanera."""
    try:
        data = request.get_json()

        if not data.get('estado'):
            return jsonify({'error': 'estado es requerido'}), 400

        if data['estado'] not in ['en_proceso', 'despachado', 'liberado', 'observado']:
            return jsonify({'error': 'estado inválido'}), 400

        customs_service.actualizar_estado_operacion(
            operacion_id=id,
            estado=data['estado'],
            notas=data.get('notas')
        )

        return jsonify({'message': 'Estado actualizado exitosamente'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@customs_bp.route('/agreements', methods=['GET'])
@require_auth
def obtener_acuerdos():
    """Obtener acuerdos comerciales."""
    try:
        estado = request.args.get('estado', 'active')
        acuerdos = customs_service.obtener_acuerdos(estado=estado)
        return jsonify(acuerdos), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@customs_bp.route('/agreements', methods=['POST'])
@require_auth
def crear_acuerdo():
    """Crear acuerdo comercial."""
    try:
        data = request.get_json()

        # Validación básica
        if not data.get('nombre') or not data.get('tipo'):
            return jsonify({'error': 'nombre y tipo son requeridos'}), 400

        if data['tipo'] not in ['mercosur', 'bilateral', 'gsp', 'otro']:
            return jsonify({'error': 'tipo inválido'}), 400

        acuerdo_id = customs_service.crear_acuerdo(data)
        return jsonify({'id': acuerdo_id, 'message': 'Acuerdo comercial creado exitosamente'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@customs_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis():
    """Obtener KPIs de aduanas."""
    try:
        kpis = customs_service.obtener_kpis()
        return jsonify(kpis), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
