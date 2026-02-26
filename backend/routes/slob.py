"""
API Routes para Inventory Aging y SLOB Management

Sprint 53: Inventory Aging & SLOB
Endpoints:
- GET /api/slob/aging - Análisis de aging con filtros
- GET /api/slob/kpis - KPIs SLOB
- POST /api/slob/snapshot - Refresh manual snapshot
- POST /api/slob/disposition - Proponer disposición
- GET /api/slob/disposition - Listar disposiciones
- PUT /api/slob/disposition/<id>/approve - Aprobar disposición
- PUT /api/slob/disposition/<id>/complete - Completar disposición
"""

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_admin, require_auth
from backend.services import slob_service

slob_bp = Blueprint('slob', __name__, url_prefix='/api/slob')


@slob_bp.route('/aging', methods=['GET'])
@require_auth
def get_aging_analysis():
    """
    Obtiene análisis de inventory aging con filtros.

    Query params:
    - categoria: str (0-30, 31-60, 61-90, 91-180, 180+)
    - almacen: str
    - material: str (búsqueda parcial)
    - es_slob: bool (true/false)
    - page: int
    - per_page: int

    Returns:
        200: {items: list, total: int, page: int, pages: int}
        500: {error: str}
    """
    try:
        filtros = {
            'categoria': request.args.get('categoria'),
            'almacen': request.args.get('almacen'),
            'material': request.args.get('material'),
            'es_slob': request.args.get('es_slob') == 'true' if request.args.get('es_slob') else None,
            'page': int(request.args.get('page', 1)),
            'per_page': int(request.args.get('per_page', 50))
        }

        resultado = slob_service.obtener_inventario_aging(filtros)
        return jsonify(resultado), 200

    except ValueError as e:
        return jsonify({'error': f'Parámetros inválidos: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Error al obtener aging analysis: {str(e)}'}), 500


@slob_bp.route('/kpis', methods=['GET'])
@require_auth
def get_slob_kpis():
    """
    Obtiene KPIs de inventario SLOB.

    Returns:
        200: {
            aging_por_categoria: list,
            slob: dict,
            disposiciones: list,
            total_recuperado: float,
            recovery_rate: float
        }
        500: {error: str}
    """
    try:
        kpis = slob_service.obtener_kpis_slob()
        return jsonify(kpis), 200

    except Exception as e:
        return jsonify({'error': f'Error al obtener KPIs SLOB: {str(e)}'}), 500


@slob_bp.route('/snapshot', methods=['POST'])
@require_auth
@require_admin
def refresh_snapshot():
    """
    Genera un nuevo snapshot de aging analysis.
    Requiere permisos de administrador.

    Returns:
        200: {
            success: bool,
            registros_insertados: int,
            slob_detectados: int,
            fecha_snapshot: str
        }
        500: {error: str}
    """
    try:
        resultado = slob_service.generar_snapshot_aging()
        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({'error': f'Error al generar snapshot: {str(e)}'}), 500


@slob_bp.route('/disposition', methods=['POST'])
@require_auth
def propose_disposition():
    """
    Propone una disposición de inventario SLOB.

    Body:
    {
        "material_codigo": str,
        "almacen": str,
        "cantidad": float,
        "tipo_disposicion": str (scrap/transfer/discount_sale/rework/donate),
        "notas": str (opcional)
    }

    Returns:
        201: Disposición creada
        400: {error: str}
        500: {error: str}
    """
    try:
        data = request.get_json()

        # Validar campos requeridos
        required_fields = ['material_codigo', 'almacen', 'cantidad', 'tipo_disposicion']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Campo requerido: {field}'}), 400

        # Validar tipo_disposicion
        tipos_validos = ['scrap', 'transfer', 'discount_sale', 'rework', 'donate']
        if data['tipo_disposicion'] not in tipos_validos:
            return jsonify({'error': f'Tipo de disposición inválido. Debe ser uno de: {", ".join(tipos_validos)}'}), 400

        # Validar cantidad
        if not isinstance(data['cantidad'], (int, float)) or data['cantidad'] <= 0:
            return jsonify({'error': 'Cantidad debe ser mayor a 0'}), 400

        user_id = _get_user_id()
        disposicion = slob_service.proponer_disposicion(data, user_id)

        return jsonify(disposicion), 201

    except KeyError as e:
        return jsonify({'error': f'Campo faltante: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Error al proponer disposición: {str(e)}'}), 500


@slob_bp.route('/disposition', methods=['GET'])
@require_auth
def list_dispositions():
    """
    Lista disposiciones con filtros.

    Query params:
    - estado: str (proposed/approved/completed)
    - tipo_disposicion: str
    - material: str (búsqueda parcial)
    - page: int
    - per_page: int

    Returns:
        200: {items: list, total: int, page: int, pages: int}
        500: {error: str}
    """
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'tipo_disposicion': request.args.get('tipo_disposicion'),
            'material': request.args.get('material'),
            'page': int(request.args.get('page', 1)),
            'per_page': int(request.args.get('per_page', 50))
        }

        resultado = slob_service.obtener_disposiciones(filtros)
        return jsonify(resultado), 200

    except ValueError as e:
        return jsonify({'error': f'Parámetros inválidos: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Error al obtener disposiciones: {str(e)}'}), 500


@slob_bp.route('/disposition/<int:disp_id>/approve', methods=['PUT'])
@require_auth
@require_admin
def approve_disposition(disp_id):
    """
    Aprueba una disposición propuesta.
    Requiere permisos de administrador.

    Args:
        disp_id (int): ID de la disposición

    Returns:
        200: {success: bool, message: str}
        400: {success: bool, message: str}
        500: {error: str}
    """
    try:
        user_id = _get_user_id()
        resultado = slob_service.aprobar_disposicion(disp_id, user_id)

        if resultado['success']:
            return jsonify(resultado), 200
        else:
            return jsonify(resultado), 400

    except Exception as e:
        return jsonify({'error': f'Error al aprobar disposición: {str(e)}'}), 500


@slob_bp.route('/disposition/<int:disp_id>/complete', methods=['PUT'])
@require_auth
def complete_disposition(disp_id):
    """
    Marca una disposición como completada.

    Body:
    {
        "costo_recuperado": float
    }

    Args:
        disp_id (int): ID de la disposición

    Returns:
        200: {success: bool, message: str}
        400: {success: bool, message: str}
        500: {error: str}
    """
    try:
        data = request.get_json()

        # Validar costo_recuperado
        if 'costo_recuperado' not in data:
            return jsonify({'error': 'Campo requerido: costo_recuperado'}), 400

        if not isinstance(data['costo_recuperado'], (int, float)) or data['costo_recuperado'] < 0:
            return jsonify({'error': 'Costo recuperado debe ser mayor o igual a 0'}), 400

        resultado = slob_service.completar_disposicion(disp_id, data['costo_recuperado'])

        if resultado['success']:
            return jsonify(resultado), 200
        else:
            return jsonify(resultado), 400

    except Exception as e:
        return jsonify({'error': f'Error al completar disposición: {str(e)}'}), 500


# Health check para testing
@slob_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'slob'}), 200
