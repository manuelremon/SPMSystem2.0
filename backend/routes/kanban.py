"""
Kanban Routes
Endpoints para sistema kanban y reposición pull (Sprint 85)
"""

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth
from backend.services import kanban_service

kanban_bp = Blueprint('kanban', __name__, url_prefix='/api/kanban')


@kanban_bp.route('/boards', methods=['GET'])
@require_auth
def obtener_tableros():
    """Obtener lista de tableros kanban."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'centro_id': request.args.get('centro_id', type=int),
            'almacen_id': request.args.get('almacen_id', type=int)
        }
        tableros = kanban_service.obtener_tableros(filtros)
        return jsonify(tableros), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kanban_bp.route('/boards', methods=['POST'])
@require_auth
def crear_tablero():
    """Crear nuevo tablero kanban."""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        nombre = data.get('nombre')
        if not nombre:
            return jsonify({'error': 'El nombre del tablero es requerido'}), 400

        tablero = kanban_service.crear_tablero(
            nombre=nombre,
            almacen_id=data.get('almacen_id'),
            centro_id=data.get('centro_id'),
            descripcion=data.get('descripcion'),
            created_by=user_id
        )
        return jsonify(tablero), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kanban_bp.route('/boards/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_tablero(id):
    """Obtener detalle de tablero con tarjetas y señales."""
    try:
        tablero = kanban_service.obtener_detalle_tablero(id)
        if not tablero:
            return jsonify({'error': 'Tablero no encontrado'}), 404
        return jsonify(tablero), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kanban_bp.route('/boards/<int:id>/cards', methods=['POST'])
@require_auth
def crear_tarjeta(id):
    """Crear nueva tarjeta kanban en un tablero."""
    try:
        data = request.get_json()

        material_codigo = data.get('material_codigo')
        tipo = data.get('tipo')
        cantidad_contenedor = data.get('cantidad_contenedor')
        punto_reorden = data.get('punto_reorden', 1)
        lead_time_horas = data.get('lead_time_horas')

        if not all([material_codigo, tipo, cantidad_contenedor]):
            return jsonify({'error': 'Faltan campos requeridos: material_codigo, tipo, cantidad_contenedor'}), 400

        if tipo not in ['produccion', 'transporte', 'proveedor']:
            return jsonify({'error': 'Tipo de tarjeta inválido'}), 400

        tarjeta = kanban_service.crear_tarjeta(
            tablero_id=id,
            material_codigo=material_codigo,
            tipo=tipo,
            cantidad_contenedor=cantidad_contenedor,
            punto_reorden=punto_reorden,
            lead_time_horas=lead_time_horas,
            ubicacion_supermarket=data.get('ubicacion_supermarket'),
            proveedor_cuit=data.get('proveedor_cuit')
        )
        return jsonify(tarjeta), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kanban_bp.route('/cards/<int:id>', methods=['PUT'])
@require_auth
def actualizar_tarjeta(id):
    """Actualizar configuración de tarjeta kanban."""
    try:
        data = request.get_json()
        resultado = kanban_service.actualizar_tarjeta(id, data)
        if not resultado.get('success'):
            return jsonify(resultado), 400
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kanban_bp.route('/cards/<int:id>/empty', methods=['PUT'])
@require_auth
def vaciar_tarjeta(id):
    """Vaciar tarjeta (consumo) y generar señal de reposición."""
    try:
        user_id = _get_user_id()
        data = request.get_json() or {}
        notas = data.get('notas')

        resultado = kanban_service.vaciar_tarjeta(id, user_id, notas)
        if not resultado.get('success'):
            return jsonify(resultado), 400
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kanban_bp.route('/cards/<int:id>/fill', methods=['PUT'])
@require_auth
def llenar_tarjeta(id):
    """Llenar tarjeta (reposición completada)."""
    try:
        user_id = _get_user_id()
        data = request.get_json() or {}
        senal_id = data.get('senal_id')
        notas = data.get('notas')

        resultado = kanban_service.llenar_tarjeta(id, user_id, senal_id, notas)
        if not resultado.get('success'):
            return jsonify(resultado), 400
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kanban_bp.route('/signals', methods=['GET'])
@require_auth
def obtener_senales():
    """Obtener señales de reposición (pendientes por defecto)."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'tipo': request.args.get('tipo'),
            'tablero_id': request.args.get('tablero_id', type=int)
        }
        senales = kanban_service.obtener_senales_pendientes(filtros)
        return jsonify(senales), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kanban_bp.route('/signals/<int:id>/complete', methods=['PUT'])
@require_auth
def completar_senal(id):
    """Completar señal de reposición."""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        cantidad_entregada = data.get('cantidad_entregada')
        if cantidad_entregada is None:
            return jsonify({'error': 'cantidad_entregada es requerida'}), 400

        resultado = kanban_service.completar_senal(
            senal_id=id,
            cantidad_entregada=cantidad_entregada,
            ejecutado_por=user_id,
            orden_asociada_id=data.get('orden_asociada_id')
        )
        if not resultado.get('success'):
            return jsonify(resultado), 400
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kanban_bp.route('/signals', methods=['POST'])
@require_auth
def generar_senal():
    """Generar señal manual de reposición/producción/compra."""
    try:
        data = request.get_json()

        tarjeta_id = data.get('tarjeta_id')
        tipo = data.get('tipo')
        cantidad_solicitada = data.get('cantidad_solicitada')

        if not all([tarjeta_id, tipo, cantidad_solicitada]):
            return jsonify({'error': 'Faltan campos requeridos: tarjeta_id, tipo, cantidad_solicitada'}), 400

        if tipo not in ['reposicion', 'produccion', 'compra']:
            return jsonify({'error': 'Tipo de señal inválido'}), 400

        resultado = kanban_service.generar_senal(
            tarjeta_id=tarjeta_id,
            tipo=tipo,
            cantidad_solicitada=cantidad_solicitada,
            orden_asociada_id=data.get('orden_asociada_id')
        )
        if not resultado.get('success'):
            return jsonify(resultado), 400
        return jsonify(resultado), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kanban_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis():
    """Obtener KPIs del sistema kanban."""
    try:
        kpis = kanban_service.obtener_kpis()
        return jsonify(kpis), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
