"""
Routes de Planificación de Producción (MPS)
"""
from flask import Blueprint, g, jsonify, request

from backend.core.roles import require_auth
from backend.services import production_planning_service as prod_service

bp = Blueprint('production', __name__, url_prefix='/api/production')


@bp.route('/work-centers', methods=['GET'])
@require_auth
def get_work_centers():
    """Obtener lista de work centers"""
    try:
        filtros = {}
        if request.args.get('tipo'):
            filtros['tipo'] = request.args.get('tipo')
        if request.args.get('estado'):
            filtros['estado'] = request.args.get('estado')
        if request.args.get('codigo'):
            filtros['codigo'] = request.args.get('codigo')

        work_centers = prod_service.obtener_work_centers(filtros)

        return jsonify({
            'ok': True,
            'work_centers': work_centers
        }), 200

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al obtener work centers: {str(e)}'
        }), 500


@bp.route('/work-centers', methods=['POST'])
@require_auth
def create_work_center():
    """Crear un nuevo work center"""
    try:
        data = request.get_json()

        # Validaciones
        if not data.get('nombre'):
            return jsonify({'ok': False, 'mensaje': 'Nombre requerido'}), 400
        if not data.get('codigo'):
            return jsonify({'ok': False, 'mensaje': 'Código requerido'}), 400

        wc_id = prod_service.crear_work_center(data)

        return jsonify({
            'ok': True,
            'mensaje': 'Work center creado exitosamente',
            'id': wc_id
        }), 201

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al crear work center: {str(e)}'
        }), 500


@bp.route('/work-centers/<int:wc_id>', methods=['PUT'])
@require_auth
def update_work_center(wc_id):
    """Actualizar un work center"""
    try:
        data = request.get_json()

        success = prod_service.actualizar_work_center(wc_id, data)

        if not success:
            return jsonify({
                'ok': False,
                'mensaje': 'Work center no encontrado o sin cambios'
            }), 404

        return jsonify({
            'ok': True,
            'mensaje': 'Work center actualizado exitosamente'
        }), 200

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al actualizar work center: {str(e)}'
        }), 500


@bp.route('/plans', methods=['GET'])
@require_auth
def get_plans():
    """Obtener lista de planes de producción con paginación"""
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 20))

        filtros = {}
        if request.args.get('estado'):
            filtros['estado'] = request.args.get('estado')
        if request.args.get('responsable_id'):
            filtros['responsable_id'] = int(request.args.get('responsable_id'))
        if request.args.get('periodo_desde'):
            filtros['periodo_desde'] = request.args.get('periodo_desde')

        resultado = prod_service.obtener_planes(filtros, page, page_size)

        return jsonify({
            'ok': True,
            **resultado
        }), 200

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al obtener planes: {str(e)}'
        }), 500


@bp.route('/plans', methods=['POST'])
@require_auth
def create_plan():
    """Crear un nuevo plan de producción"""
    try:
        data = request.get_json()

        # Validaciones
        if not data.get('nombre'):
            return jsonify({'ok': False, 'mensaje': 'Nombre del plan requerido'}), 400

        # Asignar responsable si no viene en el request
        if not data.get('responsable_id'):
            data['responsable_id'] = g.user.get('id')

        plan_id = prod_service.crear_plan(data)

        return jsonify({
            'ok': True,
            'mensaje': 'Plan de producción creado exitosamente',
            'id': plan_id
        }), 201

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al crear plan: {str(e)}'
        }), 500


@bp.route('/plans/<int:plan_id>', methods=['GET'])
@require_auth
def get_plan_detail(plan_id):
    """Obtener detalle completo de un plan con sus items"""
    try:
        plan = prod_service.obtener_detalle_plan(plan_id)

        if not plan:
            return jsonify({
                'ok': False,
                'mensaje': 'Plan no encontrado'
            }), 404

        return jsonify({
            'ok': True,
            'plan': plan
        }), 200

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al obtener detalle del plan: {str(e)}'
        }), 500


@bp.route('/plans/<int:plan_id>/items', methods=['POST'])
@require_auth
def add_plan_item(plan_id):
    """Agregar un item a un plan de producción"""
    try:
        data = request.get_json()

        # Validaciones
        if not data.get('material_codigo'):
            return jsonify({'ok': False, 'mensaje': 'Código de material requerido'}), 400
        if not data.get('fecha_programada'):
            return jsonify({'ok': False, 'mensaje': 'Fecha programada requerida'}), 400
        if not data.get('cantidad_planificada') or data['cantidad_planificada'] <= 0:
            return jsonify({'ok': False, 'mensaje': 'Cantidad planificada debe ser mayor a 0'}), 400

        item_id = prod_service.agregar_item_plan(plan_id, data)

        return jsonify({
            'ok': True,
            'mensaje': 'Item agregado al plan exitosamente',
            'id': item_id
        }), 201

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al agregar item al plan: {str(e)}'
        }), 500


@bp.route('/plans/<int:plan_id>/publish', methods=['PUT'])
@require_auth
def publish_plan(plan_id):
    """Publicar un plan de producción"""
    try:
        success = prod_service.publicar_plan(plan_id)

        if not success:
            return jsonify({
                'ok': False,
                'mensaje': 'No se puede publicar el plan (ya está publicado o no existe)'
            }), 400

        return jsonify({
            'ok': True,
            'mensaje': 'Plan publicado exitosamente'
        }), 200

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al publicar plan: {str(e)}'
        }), 500


@bp.route('/plans/<int:plan_id>/items/<int:item_id>/report', methods=['PUT'])
@require_auth
def report_production(plan_id, item_id):
    """Reportar producción para un item del plan"""
    try:
        data = request.get_json()

        cantidad = data.get('cantidad_producida')
        if cantidad is None or cantidad <= 0:
            return jsonify({'ok': False, 'mensaje': 'Cantidad producida debe ser mayor a 0'}), 400

        notas = data.get('notas')

        success = prod_service.reportar_produccion(item_id, cantidad, notas)

        if not success:
            return jsonify({
                'ok': False,
                'mensaje': 'Item no encontrado'
            }), 404

        return jsonify({
            'ok': True,
            'mensaje': 'Producción reportada exitosamente'
        }), 200

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al reportar producción: {str(e)}'
        }), 500


@bp.route('/plans/<int:plan_id>/complete', methods=['PUT'])
@require_auth
def complete_plan(plan_id):
    """Completar un plan de producción"""
    try:
        success = prod_service.completar_plan(plan_id)

        if not success:
            return jsonify({
                'ok': False,
                'mensaje': 'No se puede completar el plan (items pendientes o plan no encontrado)'
            }), 400

        return jsonify({
            'ok': True,
            'mensaje': 'Plan completado exitosamente'
        }), 200

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al completar plan: {str(e)}'
        }), 500


@bp.route('/capacity', methods=['GET'])
@require_auth
def get_capacity_utilization():
    """Obtener utilización de capacidad por periodo"""
    try:
        filtros = {}
        if request.args.get('work_center_id'):
            filtros['work_center_id'] = int(request.args.get('work_center_id'))
        if request.args.get('fecha_desde'):
            filtros['fecha_desde'] = request.args.get('fecha_desde')
        if request.args.get('fecha_hasta'):
            filtros['fecha_hasta'] = request.args.get('fecha_hasta')

        utilizacion = prod_service.obtener_utilizacion(filtros)

        return jsonify({
            'ok': True,
            'utilizacion': utilizacion
        }), 200

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al obtener utilización: {str(e)}'
        }), 500


@bp.route('/plans/<int:plan_id>/validate', methods=['POST'])
@require_auth
def validate_plan_capacity(plan_id):
    """Validar capacidad del plan"""
    try:
        resultado = prod_service.validar_capacidad(plan_id)

        return jsonify({
            'ok': True,
            **resultado
        }), 200

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al validar capacidad: {str(e)}'
        }), 500


@bp.route('/kpis', methods=['GET'])
@require_auth
def get_kpis():
    """Obtener KPIs de producción"""
    try:
        kpis = prod_service.obtener_kpis()

        return jsonify({
            'ok': True,
            'kpis': kpis
        }), 200

    except Exception as e:
        return jsonify({
            'ok': False,
            'mensaje': f'Error al obtener KPIs: {str(e)}'
        }), 500
