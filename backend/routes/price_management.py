"""
Price Management Routes
Endpoints para gestión de listas de precios, negociaciones y comparación de precios (Sprint 82)
"""

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth
from backend.services import price_management_service

price_mgmt_bp = Blueprint('price_mgmt', __name__, url_prefix='/api/prices')


@price_mgmt_bp.route('/lists', methods=['GET'])
@require_auth
def obtener_listas():
    """Obtener listas de precios con filtros y paginación."""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'proveedor_cuit': request.args.get('proveedor_cuit'),
            'moneda': request.args.get('moneda')
        }
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        resultado = price_management_service.obtener_listas(filtros, page, per_page)
        return jsonify({'ok': True, **resultado}), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@price_mgmt_bp.route('/lists', methods=['POST'])
@require_auth
def crear_lista():
    """Crear nueva lista de precios."""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        lista_id = price_management_service.crear_lista(
            nombre=data.get('nombre'),
            proveedor_cuit=data.get('proveedor_cuit'),
            moneda=data.get('moneda', 'ARS'),
            fecha_desde=data.get('fecha_vigencia_desde'),
            fecha_hasta=data.get('fecha_vigencia_hasta'),
            notas=data.get('notas'),
            created_by=user_id
        )

        return jsonify({'ok': True, 'lista_id': lista_id}), 201
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@price_mgmt_bp.route('/lists/<int:id>', methods=['GET'])
@require_auth
def obtener_detalle_lista(id):
    """Obtener detalle de una lista con sus items."""
    try:
        detalle = price_management_service.obtener_detalle_lista(id)
        return jsonify({'ok': True, **detalle}), 200
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@price_mgmt_bp.route('/lists/<int:id>/activate', methods=['PUT'])
@require_auth
def activar_lista(id):
    """Activar una lista de precios."""
    try:
        price_management_service.activar_lista(id)
        return jsonify({'ok': True, 'message': 'Lista activada exitosamente'}), 200
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@price_mgmt_bp.route('/lists/<int:id>/items', methods=['POST'])
@require_auth
def agregar_precio_item(id):
    """Agregar item de precio a una lista."""
    try:
        data = request.get_json()

        item_id = price_management_service.agregar_precio_item(
            lista_id=id,
            material_codigo=data.get('material_codigo'),
            precio_unitario=data.get('precio_unitario'),
            unidad=data.get('unidad'),
            cantidad_minima=data.get('cantidad_minima', 1),
            cantidad_maxima=data.get('cantidad_maxima'),
            descuento_pct=data.get('descuento_pct', 0)
        )

        return jsonify({'ok': True, 'item_id': item_id}), 201
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@price_mgmt_bp.route('/lists/<int:lista_id>/items/<int:item_id>', methods=['DELETE'])
@require_auth
def eliminar_precio_item(lista_id, item_id):
    """Eliminar item de precio."""
    try:
        price_management_service.eliminar_precio_item(item_id)
        return jsonify({'ok': True, 'message': 'Item eliminado exitosamente'}), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@price_mgmt_bp.route('/material/<codigo>/price', methods=['GET'])
@require_auth
def obtener_precio_material(codigo):
    """Obtener precio actual de un material (con tiered pricing)."""
    try:
        proveedor_cuit = request.args.get('proveedor_cuit')
        cantidad = request.args.get('cantidad', 1, type=int)

        precio = price_management_service.obtener_precio_material(
            material_codigo=codigo,
            proveedor_cuit=proveedor_cuit,
            cantidad=cantidad
        )

        if precio:
            return jsonify({'ok': True, 'precio': precio}), 200
        else:
            return jsonify({'ok': False, 'error': 'No se encontró precio para este material'}), 404
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@price_mgmt_bp.route('/material/<codigo>/compare', methods=['GET'])
@require_auth
def comparar_precios(codigo):
    """Comparar precios de un material entre proveedores."""
    try:
        cantidad = request.args.get('cantidad', 1, type=int)

        precios = price_management_service.comparar_precios(
            material_codigo=codigo,
            cantidad=cantidad
        )

        return jsonify({'ok': True, 'precios': precios}), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@price_mgmt_bp.route('/negotiations', methods=['GET'])
@require_auth
def obtener_negociaciones():
    """Obtener negociaciones de precio (filtro por estado)."""
    try:
        estado = request.args.get('estado', 'pending')

        # Use DB directly for simple query
        from backend.core.db import get_db_connection, is_using_postgresql
        using_pg = is_using_postgresql()
        placeholder = '%s' if using_pg else '?'

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                f"""
                SELECT pn.id, pn.material_codigo, m.nombre as material_nombre,
                       pn.proveedor_cuit, p.nombre as proveedor_nombre,
                       pn.precio_anterior, pn.precio_nuevo, pn.descuento_negociado_pct,
                       pn.negociado_por, u.nombre as negociado_por_nombre,
                       pn.fecha, pn.notas, pn.estado, pn.created_at
                FROM precio_negociacion pn
                LEFT JOIN (
                    SELECT codigo, descripcion as nombre FROM catalogo_materiales
                    UNION ALL
                    SELECT codigo_material as codigo, descripcion as nombre FROM materiales_bbdd
                ) m ON pn.material_codigo = m.codigo
                LEFT JOIN proveedores p ON pn.proveedor_cuit = p.id_proveedor
                LEFT JOIN usuarios u ON pn.negociado_por = u.id_spm
                WHERE pn.estado = {placeholder}
                ORDER BY pn.created_at DESC
                LIMIT 100
                """,
                (estado,)
            )

            negociaciones = []
            for row in cursor.fetchall():
                negociaciones.append({
                    'id': row[0],
                    'material_codigo': row[1],
                    'material_nombre': row[2],
                    'proveedor_cuit': row[3],
                    'proveedor_nombre': row[4],
                    'precio_anterior': float(row[5]) if row[5] else None,
                    'precio_nuevo': float(row[6]) if row[6] else 0,
                    'descuento_negociado_pct': float(row[7]) if row[7] else 0,
                    'negociado_por': row[8],
                    'negociado_por_nombre': row[9],
                    'fecha': row[10],
                    'notas': row[11],
                    'estado': row[12],
                    'created_at': row[13]
                })

            return jsonify({'ok': True, 'negociaciones': negociaciones}), 200
        finally:
            cursor.close()
            conn.close()

    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@price_mgmt_bp.route('/negotiations', methods=['POST'])
@require_auth
def crear_negociacion():
    """Crear nueva negociación de precio."""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        neg_id = price_management_service.crear_negociacion(
            material_codigo=data.get('material_codigo'),
            proveedor_cuit=data.get('proveedor_cuit'),
            precio_nuevo=data.get('precio_nuevo'),
            precio_anterior=data.get('precio_anterior'),
            descuento_pct=data.get('descuento_pct', 0),
            notas=data.get('notas'),
            negociado_por=user_id
        )

        return jsonify({'ok': True, 'negociacion_id': neg_id}), 201
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 400
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@price_mgmt_bp.route('/negotiations/<int:id>/approve', methods=['PUT'])
@require_auth
def aprobar_negociacion(id):
    """Aprobar una negociación de precio."""
    try:
        user_id = _get_user_id()
        price_management_service.aprobar_negociacion(id, user_id)
        return jsonify({'ok': True, 'message': 'Negociación aprobada exitosamente'}), 200
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@price_mgmt_bp.route('/negotiations/<int:id>/reject', methods=['PUT'])
@require_auth
def rechazar_negociacion(id):
    """Rechazar una negociación de precio."""
    try:
        user_id = _get_user_id()
        price_management_service.rechazar_negociacion(id, user_id)
        return jsonify({'ok': True, 'message': 'Negociación rechazada'}), 200
    except ValueError as e:
        return jsonify({'ok': False, 'error': str(e)}), 404
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@price_mgmt_bp.route('/material/<codigo>/history', methods=['GET'])
@require_auth
def obtener_historial_precios(codigo):
    """Obtener historial de precios de un material."""
    try:
        proveedor_cuit = request.args.get('proveedor_cuit')

        historial = price_management_service.obtener_historial_precios(
            material_codigo=codigo,
            proveedor_cuit=proveedor_cuit
        )

        return jsonify({'ok': True, 'historial': historial}), 200
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500
