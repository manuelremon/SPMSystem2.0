"""
Contracts Routes
Endpoints para gestión de contratos (Sprints 54-56)

Blueprint: contracts_bp
Prefix: /api/contracts

Endpoints:
- GET / - Listar contratos con filtros y paginación
- POST / - Crear contrato en estado draft
- GET /<id> - Detalle de contrato con historial
- PUT /<id> - Actualizar contrato (draft/negotiation)
- DELETE /<id> - Soft delete (draft only, admin)
- PUT /<id>/status - Cambiar estado con FSM
- POST /<id>/items - Agregar items al contrato
- GET /<id>/items - Listar items del contrato
- PUT /<id>/items/<item_id> - Actualizar item
- DELETE /<id>/items/<item_id> - Eliminar item
- GET /price-lookup - Buscar precio contractual
- POST /<id>/documents - Subir documento
- GET /<id>/documents - Listar documentos
- GET /<id>/documents/<doc_id>/download - Descargar documento
- DELETE /<id>/documents/<doc_id> - Eliminar documento
"""

import logging
import os

from flask import Blueprint, jsonify, request, send_file

from backend.core.errors import BusinessRuleError, NotFoundError, ValidationError
from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_admin, require_auth
from backend.services import contract_service

logger = logging.getLogger(__name__)

bp = Blueprint('contracts', __name__, url_prefix='/api/contracts')


# ============================================================================
# CRUD CONTRATOS
# ============================================================================

@bp.route('/', methods=['GET'])
@require_auth
def listar_contratos():
    """
    Listar contratos con filtros y paginación.

    Query params:
        - estado: draft, under_negotiation, active, suspended, expired, terminated
        - tipo: blanket_po, fixed_price, time_materials, framework
        - proveedor: buscar en CUIT o nombre
        - centro: filtrar por centro
        - fecha_desde: YYYY-MM-DD
        - fecha_hasta: YYYY-MM-DD
        - search: buscar en numero, proveedor, notas
        - page: página (default 1)
        - per_page: items por página (default 20)
    """
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'tipo': request.args.get('tipo'),
            'proveedor': request.args.get('proveedor'),
            'centro': request.args.get('centro'),
            'fecha_desde': request.args.get('fecha_desde'),
            'fecha_hasta': request.args.get('fecha_hasta'),
            'search': request.args.get('search'),
            'page': int(request.args.get('page', 1)),
            'per_page': int(request.args.get('per_page', 20))
        }

        resultado = contract_service.obtener_contratos(filtros)
        resultado['ok'] = True
        return jsonify(resultado), 200

    except Exception as e:
        return safe_error_response(e, logger, context="contracts")


@bp.route('/', methods=['POST'])
@require_auth
def crear_contrato():
    """
    Crear nuevo contrato en estado draft.

    Body:
        {
            "tipo": "blanket_po",
            "proveedor_cuit": "30-12345678-9",
            "proveedor_nombre": "Proveedor SA",
            "fecha_inicio": "2026-01-01",
            "fecha_vencimiento": "2026-12-31",
            "valor_total": 1000000,
            "moneda": "ARS",
            "centro": "BA01",
            "notas": "Contrato marco anual"
        }
    """
    try:
        data = request.get_json()
        user_id = _get_user_id()

        contrato_id = contract_service.crear_contrato(data, user_id)

        return jsonify({
            'ok': True,
            'id': contrato_id,
            'mensaje': 'Contrato creado exitosamente'
        }), 201

    except ValidationError as e:
        return safe_error_response(e, logger, status_code=400, context="contracts.crear_contrato")
    except Exception as e:
        return safe_error_response(e, logger, context="contracts.crear_contrato")


@bp.route('/<int:contrato_id>', methods=['GET'])
@require_auth
def obtener_detalle_contrato(contrato_id):
    """
    Obtener detalle de contrato con historial de cambios.

    Returns:
        {
            "contrato": {...},
            "historial": [...]
        }
    """
    try:
        detalle = contract_service.obtener_detalle_contrato(contrato_id)
        detalle['ok'] = True
        # Frontend expects res.data.contract
        if 'contrato' in detalle and 'contract' not in detalle:
            detalle['contract'] = detalle['contrato']
        return jsonify(detalle), 200

    except NotFoundError as e:
        return safe_error_response(e, logger, status_code=404, context="contracts.obtener_detalle_contrato")
    except Exception as e:
        return safe_error_response(e, logger, context="contracts.obtener_detalle_contrato")


@bp.route('/<int:contrato_id>', methods=['PUT'])
@require_auth
def actualizar_contrato(contrato_id):
    """
    Actualizar campos de un contrato.
    Solo permitido en estados: draft, under_negotiation

    Body:
        {
            "tipo": "fixed_price",
            "valor_total": 1500000,
            "notas": "Contrato actualizado"
        }
    """
    try:
        data = request.get_json()
        user_id = _get_user_id()

        contract_service.actualizar_contrato(contrato_id, data, user_id)

        return jsonify({'ok': True, 'mensaje': 'Contrato actualizado exitosamente'}), 200

    except NotFoundError as e:
        return safe_error_response(e, logger, status_code=404, context="contracts.actualizar_contrato")
    except BusinessRuleError as e:
        return safe_error_response(e, logger, status_code=400, context="contracts.actualizar_contrato")
    except Exception as e:
        return safe_error_response(e, logger, context="contracts.actualizar_contrato")


@bp.route('/<int:contrato_id>', methods=['DELETE'])
@require_auth
@require_admin
def eliminar_contrato(contrato_id):
    """
    Soft delete de un contrato.
    Solo permitido en estado draft y requiere rol admin.
    """
    try:
        user_id = _get_user_id()
        contract_service.soft_delete_contrato(contrato_id, user_id)

        return jsonify({'ok': True, 'mensaje': 'Contrato eliminado exitosamente'}), 200

    except NotFoundError as e:
        return safe_error_response(e, logger, status_code=404, context="contracts.eliminar_contrato")
    except BusinessRuleError as e:
        return safe_error_response(e, logger, status_code=400, context="contracts.eliminar_contrato")
    except Exception as e:
        return safe_error_response(e, logger, context="contracts.eliminar_contrato")


@bp.route('/<int:contrato_id>/status', methods=['PUT'])
@require_auth
def cambiar_estado_contrato(contrato_id):
    """
    Cambiar estado de un contrato con validación FSM.

    Body:
        {
            "estado": "active",
            "razon": "Negociación completada"
        }

    Transiciones válidas:
        draft -> under_negotiation
        under_negotiation -> active
        active -> suspended, expired, terminated
        suspended -> active
        draft/under_negotiation -> terminated
    """
    try:
        data = request.get_json()
        user_id = _get_user_id()

        if 'estado' not in data:
            raise ValidationError("estado", "Campo requerido")

        contract_service.cambiar_estado_contrato(
            contrato_id,
            data['estado'],
            user_id,
            data.get('razon')
        )

        return jsonify({'ok': True, 'mensaje': f'Estado cambiado a {data["estado"]}'}), 200

    except NotFoundError as e:
        return safe_error_response(e, logger, status_code=404, context="contracts.cambiar_estado_contrato")
    except ValidationError as e:
        return safe_error_response(e, logger, status_code=400, context="contracts.cambiar_estado_contrato")
    except BusinessRuleError as e:
        return safe_error_response(e, logger, status_code=400, context="contracts.cambiar_estado_contrato")
    except Exception as e:
        return safe_error_response(e, logger, context="contracts.cambiar_estado_contrato")


# ============================================================================
# ITEMS DE CONTRATO
# ============================================================================

@bp.route('/<int:contrato_id>/items', methods=['POST'])
@require_auth
def agregar_items(contrato_id):
    """
    Agregar items/líneas a un contrato.

    Body:
        {
            "items": [
                {
                    "material_codigo": "MAT001",
                    "material_descripcion": "Tornillo M8",
                    "precio_unitario": 50.00,
                    "moneda": "ARS",
                    "cantidad_comprometida": 1000,
                    "unidad": "UN",
                    "fecha_vigencia_desde": "2026-01-01",
                    "fecha_vigencia_hasta": "2026-12-31"
                }
            ]
        }
    """
    try:
        data = request.get_json()

        if 'items' not in data or not isinstance(data['items'], list):
            raise ValidationError("items", "Se requiere un array 'items'")

        contract_service.agregar_items_contrato(contrato_id, data['items'])

        return jsonify({
            'ok': True,
            'mensaje': f'{len(data["items"])} items agregados exitosamente'
        }), 201

    except NotFoundError as e:
        return safe_error_response(e, logger, status_code=404, context="contracts.agregar_items")
    except ValidationError as e:
        return safe_error_response(e, logger, status_code=400, context="contracts.agregar_items")
    except Exception as e:
        return safe_error_response(e, logger, context="contracts.agregar_items")


@bp.route('/<int:contrato_id>/items', methods=['GET'])
@require_auth
def listar_items(contrato_id):
    """
    Listar items de un contrato con progreso de consumo.

    Returns:
        [
            {
                "id": 1,
                "material_codigo": "MAT001",
                "precio_unitario": 50.00,
                "cantidad_comprometida": 1000,
                "cantidad_consumida": 250,
                "porcentaje_consumido": 25.0
            }
        ]
    """
    try:
        items = contract_service.obtener_items_contrato(contrato_id)
        return jsonify({'ok': True, 'items': items}), 200

    except Exception as e:
        return safe_error_response(e, logger, context="contracts")


@bp.route('/<int:contrato_id>/items/<int:item_id>', methods=['PUT'])
@require_auth
def actualizar_item(contrato_id, item_id):
    """
    Actualizar campos de un item de contrato.

    Body:
        {
            "precio_unitario": 55.00,
            "cantidad_comprometida": 1500
        }
    """
    try:
        data = request.get_json()
        contract_service.actualizar_item_contrato(item_id, data)

        return jsonify({'ok': True, 'mensaje': 'Item actualizado exitosamente'}), 200

    except NotFoundError as e:
        return safe_error_response(e, logger, status_code=404, context="contracts.actualizar_item")
    except Exception as e:
        return safe_error_response(e, logger, context="contracts.actualizar_item")


@bp.route('/<int:contrato_id>/items/<int:item_id>', methods=['DELETE'])
@require_auth
def eliminar_item(contrato_id, item_id):
    """Eliminar un item de contrato"""
    try:
        contract_service.eliminar_item_contrato(item_id)
        return jsonify({'ok': True, 'mensaje': 'Item eliminado exitosamente'}), 200

    except Exception as e:
        return safe_error_response(e, logger, context="contracts")


@bp.route('/price-lookup', methods=['GET'])
@require_auth
def buscar_precio_contractual():
    """
    Buscar precio contractual para material + proveedor + fecha.

    Query params:
        - material: Código SAP del material
        - proveedor: CUIT del proveedor
        - fecha: Fecha de consulta (YYYY-MM-DD, default: hoy)

    Returns:
        {
            "precio_unitario": 50.00,
            "moneda": "ARS",
            "encontrado": true
        }
    """
    try:
        material_codigo = request.args.get('material')
        proveedor_cuit = request.args.get('proveedor')
        fecha = request.args.get('fecha')

        if not material_codigo or not proveedor_cuit:
            raise ValidationError("params", "Se requieren los parámetros 'material' y 'proveedor'")

        precio = contract_service.obtener_precio_contractual(
            material_codigo,
            proveedor_cuit,
            fecha
        )

        if precio is not None:
            return jsonify({
                'precio_unitario': precio,
                'encontrado': True
            }), 200
        else:
            return jsonify({
                'precio_unitario': None,
                'encontrado': False,
                'mensaje': 'No se encontró precio contractual para los parámetros dados'
            }), 404

    except ValidationError as e:
        return safe_error_response(e, logger, status_code=400, context="contracts.buscar_precio_contractual")
    except Exception as e:
        return safe_error_response(e, logger, context="contracts.buscar_precio_contractual")


# ============================================================================
# DOCUMENTOS
# ============================================================================

@bp.route('/<int:contrato_id>/documents', methods=['POST'])
@require_auth
def subir_documento(contrato_id):
    """
    Subir documento adjunto a un contrato.

    Form data:
        - file: archivo (multipart/form-data)
        - tipo: terms, specs, amendment, other
    """
    try:
        if 'file' not in request.files:
            raise ValidationError("file", "No se envió ningún archivo")

        archivo = request.files['file']
        tipo = request.form.get('tipo', 'other')
        user_id = _get_user_id()

        if archivo.filename == '':
            raise ValidationError("file", "Nombre de archivo vacío")

        doc_id = contract_service.subir_documento(contrato_id, archivo, tipo, user_id)

        return jsonify({
            'ok': True,
            'id': doc_id,
            'mensaje': 'Documento subido exitosamente'
        }), 201

    except ValidationError as e:
        return safe_error_response(e, logger, status_code=400, context="contracts.subir_documento")
    except Exception as e:
        return safe_error_response(e, logger, context="contracts.subir_documento")


@bp.route('/<int:contrato_id>/documents', methods=['GET'])
@require_auth
def listar_documentos(contrato_id):
    """
    Listar documentos de un contrato.

    Returns:
        [
            {
                "id": 1,
                "tipo": "terms",
                "nombre_archivo": "contrato.pdf",
                "tamanio_bytes": 512000,
                "mime_type": "application/pdf",
                "subido_por_nombre": "Juan Pérez",
                "created_at": "2026-02-15 10:00:00"
            }
        ]
    """
    try:
        documentos = contract_service.obtener_documentos(contrato_id)
        return jsonify({'ok': True, 'items': documentos}), 200

    except Exception as e:
        return safe_error_response(e, logger, context="contracts")


@bp.route('/<int:contrato_id>/documents/<int:doc_id>/download', methods=['GET'])
@require_auth
def descargar_documento(contrato_id, doc_id):
    """
    Descargar archivo de documento.

    Returns:
        Archivo adjunto con content-disposition
    """
    try:
        documentos = contract_service.obtener_documentos(contrato_id)
        documento = next((d for d in documentos if d['id'] == doc_id), None)

        if not documento:
            raise NotFoundError(f"Documento {doc_id} no encontrado")

        filepath = documento['ruta_archivo']

        if not os.path.exists(filepath):
            raise NotFoundError("Archivo físico no encontrado")

        return send_file(
            filepath,
            as_attachment=True,
            download_name=documento['nombre_archivo'],
            mimetype=documento['mime_type']
        )

    except NotFoundError as e:
        return safe_error_response(e, logger, status_code=404, context="contracts.descargar_documento")
    except Exception as e:
        return safe_error_response(e, logger, context="contracts.descargar_documento")


@bp.route('/<int:contrato_id>/documents/<int:doc_id>', methods=['DELETE'])
@require_auth
def eliminar_documento(contrato_id, doc_id):
    """
    Eliminar documento de contrato.
    Solo puede hacerlo el usuario que subió el archivo o un admin.
    """
    try:
        user_id = _get_user_id()
        contract_service.eliminar_documento(doc_id, user_id)

        return jsonify({'ok': True, 'mensaje': 'Documento eliminado exitosamente'}), 200

    except NotFoundError as e:
        return safe_error_response(e, logger, status_code=404, context="contracts.eliminar_documento")
    except BusinessRuleError as e:
        return safe_error_response(e, logger, status_code=403, context="contracts.eliminar_documento")
    except Exception as e:
        return safe_error_response(e, logger, context="contracts.eliminar_documento")


# ============================================================================
# REGISTRO DE BLUEPRINT
# ============================================================================

def init_app(app):
    """Registrar blueprint en la app Flask"""
    app.register_blueprint(bp)
