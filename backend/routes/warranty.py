"""
Rutas para gestión de garantías y reclamos
Fecha: 2026-02-15
"""
from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth
from backend.services import warranty_service

bp = Blueprint('warranty', __name__, url_prefix='/api/warranty')


@bp.route('/', methods=['GET'])
@require_auth
def get_garantias():
    """GET /api/warranty - Lista garantías con filtros"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        material_codigo = request.args.get('material_codigo')
        proveedor_cuit = request.args.get('proveedor_cuit')
        estado = request.args.get('estado')

        result = warranty_service.obtener_garantias(
            page=page,
            per_page=per_page,
            material_codigo=material_codigo,
            proveedor_cuit=proveedor_cuit,
            estado=estado
        )

        result['ok'] = True
        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/', methods=['POST'])
@require_auth
def create_garantia():
    """POST /api/warranty - Crea una garantía"""
    try:
        data = request.get_json()

        # Validar campos requeridos
        required = ['material_codigo', 'proveedor_cuit', 'tipo', 'duracion_meses', 'fecha_inicio']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Campo requerido: {field}'}), 400

        garantia_id = warranty_service.crear_garantia(
            material_codigo=data['material_codigo'],
            proveedor_cuit=data['proveedor_cuit'],
            tipo=data['tipo'],
            duracion_meses=data['duracion_meses'],
            fecha_inicio=data['fecha_inicio'],
            condiciones=data.get('condiciones'),
            lote_id=data.get('lote_id'),
            orden_compra_id=data.get('orden_compra_id')
        )

        return jsonify({'id': garantia_id, 'message': 'Garantía creada exitosamente'}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/claims', methods=['GET'])
@require_auth
def get_reclamos():
    """GET /api/warranty/claims - Lista reclamos con filtros"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        estado = request.args.get('estado')
        tipo = request.args.get('tipo')
        garantia_id = request.args.get('garantia_id')
        if garantia_id:
            garantia_id = int(garantia_id)

        result = warranty_service.obtener_reclamos(
            page=page,
            per_page=per_page,
            estado=estado,
            tipo=tipo,
            garantia_id=garantia_id
        )

        result['ok'] = True
        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/claims', methods=['POST'])
@require_auth
def create_reclamo():
    """POST /api/warranty/claims - Crea un reclamo"""
    try:
        data = request.get_json()

        # Validar campos requeridos
        required = ['garantia_id', 'tipo', 'descripcion']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Campo requerido: {field}'}), 400

        result = warranty_service.crear_reclamo(
            garantia_id=data['garantia_id'],
            tipo=data['tipo'],
            descripcion=data['descripcion'],
            cantidad_afectada=data.get('cantidad_afectada'),
            costo_estimado=data.get('costo_estimado'),
            responsable_id=_get_user_id()
        )

        return jsonify({
            'id': result['id'],
            'numero_reclamo': result['numero_reclamo'],
            'message': 'Reclamo creado exitosamente'
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/claims/<int:reclamo_id>', methods=['GET'])
@require_auth
def get_reclamo_detalle(reclamo_id):
    """GET /api/warranty/claims/<id> - Detalle de reclamo"""
    try:
        reclamo = warranty_service.obtener_detalle_reclamo(reclamo_id)

        if not reclamo:
            return jsonify({'error': 'Reclamo no encontrado'}), 404

        return jsonify(reclamo), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/claims/<int:reclamo_id>/submit', methods=['PUT'])
@require_auth
def submit_reclamo(reclamo_id):
    """PUT /api/warranty/claims/<id>/submit - Envía un reclamo"""
    try:
        success = warranty_service.enviar_reclamo(reclamo_id, _get_user_id())

        if not success:
            return jsonify({'error': 'No se pudo enviar el reclamo'}), 400

        return jsonify({'message': 'Reclamo enviado exitosamente'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/claims/<int:reclamo_id>/review', methods=['PUT'])
@require_auth
def review_reclamo(reclamo_id):
    """PUT /api/warranty/claims/<id>/review - Pone un reclamo en revisión"""
    try:
        data = request.get_json() or {}
        notas = data.get('notas')

        success = warranty_service.revisar_reclamo(reclamo_id, _get_user_id(), notas)

        if not success:
            return jsonify({'error': 'No se pudo revisar el reclamo'}), 400

        return jsonify({'message': 'Reclamo puesto en revisión'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/claims/<int:reclamo_id>/approve', methods=['PUT'])
@require_auth
def approve_reclamo(reclamo_id):
    """PUT /api/warranty/claims/<id>/approve - Aprueba un reclamo"""
    try:
        data = request.get_json() or {}
        notas = data.get('notas')

        success = warranty_service.aprobar_reclamo(reclamo_id, _get_user_id(), notas)

        if not success:
            return jsonify({'error': 'No se pudo aprobar el reclamo'}), 400

        return jsonify({'message': 'Reclamo aprobado exitosamente'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/claims/<int:reclamo_id>/reject', methods=['PUT'])
@require_auth
def reject_reclamo(reclamo_id):
    """PUT /api/warranty/claims/<id>/reject - Rechaza un reclamo"""
    try:
        data = request.get_json() or {}
        notas = data.get('notas')

        success = warranty_service.rechazar_reclamo(reclamo_id, _get_user_id(), notas)

        if not success:
            return jsonify({'error': 'No se pudo rechazar el reclamo'}), 400

        return jsonify({'message': 'Reclamo rechazado'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/claims/<int:reclamo_id>/resolve', methods=['PUT'])
@require_auth
def resolve_reclamo(reclamo_id):
    """PUT /api/warranty/claims/<id>/resolve - Resuelve un reclamo"""
    try:
        data = request.get_json()

        # Validar campos requeridos
        required = ['resolucion', 'monto_recuperado']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Campo requerido: {field}'}), 400

        success = warranty_service.resolver_reclamo(
            reclamo_id=reclamo_id,
            resolucion=data['resolucion'],
            monto_recuperado=data['monto_recuperado'],
            actor_id=_get_user_id(),
            notas=data.get('notas')
        )

        if not success:
            return jsonify({'error': 'No se pudo resolver el reclamo'}), 400

        return jsonify({'message': 'Reclamo resuelto exitosamente'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/claims/<int:reclamo_id>/documents', methods=['POST'])
@require_auth
def add_documento(reclamo_id):
    """POST /api/warranty/claims/<id>/documents - Agrega un documento"""
    try:
        data = request.get_json()

        # Validar campos requeridos
        required = ['nombre', 'tipo']
        for field in required:
            if field not in data:
                return jsonify({'error': f'Campo requerido: {field}'}), 400

        doc_id = warranty_service.agregar_documento_reclamo(
            reclamo_id=reclamo_id,
            nombre=data['nombre'],
            path=data.get('path'),
            tipo=data['tipo']
        )

        return jsonify({
            'id': doc_id,
            'message': 'Documento agregado exitosamente'
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/kpis', methods=['GET'])
@require_auth
def get_kpis():
    """GET /api/warranty/kpis - KPIs de garantías y reclamos"""
    try:
        kpis = warranty_service.obtener_kpis()
        return jsonify(kpis), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
