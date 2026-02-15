"""
Rutas para el módulo de ahorro de costos.
Permite registrar ahorros, definir metas y exportar reportes.
"""

import io
from datetime import datetime

from flask import Blueprint, g, jsonify, request, send_file

from backend.core.roles import require_admin, require_auth
from backend.services import savings_service

bp = Blueprint('savings', __name__, url_prefix='/api/savings')


def _get_user_id():
    """Obtiene el ID del usuario actual desde g.user."""
    if not g.user:
        return None
    return g.user.get('id') if isinstance(g.user, dict) else g.user.id


@bp.route('/', methods=['POST'])
@require_auth
def registrar_ahorro():
    """
    Registra un nuevo ahorro de costo.

    Request JSON:
        {
            "categoria": "negotiated|contract|rfq|bulk|other",
            "tipo": "hard|soft",
            "monto": 5000.0,
            "moneda": "ARS",  // opcional, default ARS
            "material_codigo": "12345",  // opcional
            "proveedor_cuit": "20-12345678-9",  // opcional
            "solicitud_id": 123,  // opcional
            "descripcion": "Negociación de precio...",  // opcional
            "fecha_realizacion": "2026-02-15"  // opcional, default hoy
        }

    Returns:
        201: {"id": 1, "message": "Ahorro registrado exitosamente"}
        400: Error de validación
        500: Error del servidor
    """
    try:
        data = request.get_json()

        # Validaciones
        if not data:
            return jsonify({'error': 'No se recibieron datos'}), 400

        campos_requeridos = ['categoria', 'tipo', 'monto']
        for campo in campos_requeridos:
            if campo not in data:
                return jsonify({'error': f'Campo requerido: {campo}'}), 400

        categorias_validas = ['negotiated', 'contract', 'rfq', 'bulk', 'other']
        if data['categoria'] not in categorias_validas:
            return jsonify({'error': f'Categoría debe ser una de: {categorias_validas}'}), 400

        tipos_validos = ['hard', 'soft']
        if data['tipo'] not in tipos_validos:
            return jsonify({'error': f'Tipo debe ser uno de: {tipos_validos}'}), 400

        if not isinstance(data['monto'], (int, float)) or data['monto'] < 0:
            return jsonify({'error': 'Monto debe ser un número positivo'}), 400

        # Registrar ahorro
        user_id = _get_user_id()
        ahorro_id = savings_service.registrar_ahorro(data, user_id)

        return jsonify({
            'id': ahorro_id,
            'message': 'Ahorro registrado exitosamente'
        }), 201

    except Exception as e:
        return jsonify({'error': f'Error al registrar ahorro: {str(e)}'}), 500


@bp.route('/', methods=['GET'])
@require_auth
def listar_ahorros():
    """
    Lista ahorros con filtros y paginación.

    Query params:
        - fecha_desde: Filtrar desde fecha (YYYY-MM-DD)
        - fecha_hasta: Filtrar hasta fecha (YYYY-MM-DD)
        - categoria: Filtrar por categoría
        - tipo: Filtrar por tipo (hard/soft)
        - registrado_por: Filtrar por usuario que registró
        - page: Página (default: 1)
        - per_page: Items por página (default: 20)

    Returns:
        200: {
            "items": [...],
            "total": 100,
            "page": 1,
            "per_page": 20,
            "pages": 5
        }
        500: Error del servidor
    """
    try:
        filtros = {
            'fecha_desde': request.args.get('fecha_desde'),
            'fecha_hasta': request.args.get('fecha_hasta'),
            'categoria': request.args.get('categoria'),
            'tipo': request.args.get('tipo'),
            'registrado_por': request.args.get('registrado_por', type=int),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 20, type=int)
        }

        # Remover filtros None
        filtros = {k: v for k, v in filtros.items() if v is not None}

        resultado = savings_service.obtener_ahorros(filtros)
        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({'error': f'Error al obtener ahorros: {str(e)}'}), 500


@bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis():
    """
    Obtiene KPIs de ahorros (YTD, MTD, hard vs soft).

    Returns:
        200: {
            "ytd_total": 150000.0,
            "mtd_total": 25000.0,
            "hard_savings": 100000.0,
            "soft_savings": 50000.0,
            "por_categoria": {
                "negotiated": 80000.0,
                "contract": 40000.0,
                ...
            }
        }
        500: Error del servidor
    """
    try:
        kpis = savings_service.obtener_kpis_ahorro()
        return jsonify(kpis), 200

    except Exception as e:
        return jsonify({'error': f'Error al obtener KPIs: {str(e)}'}), 500


@bp.route('/goals', methods=['POST'])
@require_auth
@require_admin
def crear_meta():
    """
    Crea o actualiza una meta de ahorro (solo admin).

    Request JSON:
        {
            "categoria": "negotiated",
            "periodo": "202602",  // YYYYMM
            "meta_monto": 50000.0,
            "buyer_id": 5  // opcional, null para meta global
        }

    Returns:
        201: {"id": 1, "message": "Meta creada exitosamente"}
        400: Error de validación
        403: No autorizado
        500: Error del servidor
    """
    try:
        data = request.get_json()

        # Validaciones
        if not data:
            return jsonify({'error': 'No se recibieron datos'}), 400

        campos_requeridos = ['categoria', 'periodo', 'meta_monto']
        for campo in campos_requeridos:
            if campo not in data:
                return jsonify({'error': f'Campo requerido: {campo}'}), 400

        categorias_validas = ['negotiated', 'contract', 'rfq', 'bulk', 'other']
        if data['categoria'] not in categorias_validas:
            return jsonify({'error': f'Categoría debe ser una de: {categorias_validas}'}), 400

        # Validar formato periodo YYYYMM
        periodo = str(data['periodo'])
        if len(periodo) != 6 or not periodo.isdigit():
            return jsonify({'error': 'Periodo debe tener formato YYYYMM'}), 400

        if not isinstance(data['meta_monto'], (int, float)) or data['meta_monto'] < 0:
            return jsonify({'error': 'Meta monto debe ser un número positivo'}), 400

        # Crear meta
        user_id = _get_user_id()
        meta_id = savings_service.crear_meta(data, user_id)

        return jsonify({
            'id': meta_id,
            'message': 'Meta creada exitosamente'
        }), 201

    except Exception as e:
        return jsonify({'error': f'Error al crear meta: {str(e)}'}), 500


@bp.route('/goals', methods=['GET'])
@require_auth
def listar_metas():
    """
    Lista metas de ahorro para un periodo.

    Query params:
        - periodo: Periodo YYYYMM (default: mes actual)

    Returns:
        200: [
            {
                "id": 1,
                "categoria": "negotiated",
                "periodo": "202602",
                "meta_monto": 50000.0,
                "buyer_id": 5,
                "created_at": "...",
                "updated_at": "..."
            },
            ...
        ]
        500: Error del servidor
    """
    try:
        # Default: periodo actual
        now = datetime.now()
        periodo_default = f"{now.year}{now.month:02d}"
        periodo = request.args.get('periodo', periodo_default)

        # Validar formato
        if len(periodo) != 6 or not periodo.isdigit():
            return jsonify({'error': 'Periodo debe tener formato YYYYMM'}), 400

        metas = savings_service.obtener_metas(periodo)
        return jsonify(metas), 200

    except Exception as e:
        return jsonify({'error': f'Error al obtener metas: {str(e)}'}), 500


@bp.route('/goals/progress', methods=['GET'])
@require_auth
def obtener_progreso():
    """
    Obtiene progreso de metas vs ahorros reales.

    Query params:
        - periodo: Periodo YYYYMM (default: mes actual)

    Returns:
        200: [
            {
                "id": 1,
                "categoria": "negotiated",
                "periodo": "202602",
                "meta_monto": 50000.0,
                "buyer_id": 5,
                "monto_actual": 32000.0,
                "porcentaje_cumplimiento": 64.0
            },
            ...
        ]
        500: Error del servidor
    """
    try:
        # Default: periodo actual
        now = datetime.now()
        periodo_default = f"{now.year}{now.month:02d}"
        periodo = request.args.get('periodo', periodo_default)

        # Validar formato
        if len(periodo) != 6 or not periodo.isdigit():
            return jsonify({'error': 'Periodo debe tener formato YYYYMM'}), 400

        progreso = savings_service.obtener_progreso_metas(periodo)
        return jsonify(progreso), 200

    except Exception as e:
        return jsonify({'error': f'Error al obtener progreso: {str(e)}'}), 500


@bp.route('/export', methods=['GET'])
@require_auth
def exportar_excel():
    """
    Exporta ahorros a archivo Excel.

    Query params:
        - Mismos filtros que /api/savings/ (fecha_desde, fecha_hasta, categoria, tipo)

    Returns:
        200: Archivo Excel
        500: Error del servidor
    """
    try:
        filtros = {
            'fecha_desde': request.args.get('fecha_desde'),
            'fecha_hasta': request.args.get('fecha_hasta'),
            'categoria': request.args.get('categoria'),
            'tipo': request.args.get('tipo'),
            'registrado_por': request.args.get('registrado_por', type=int)
        }

        # Remover filtros None
        filtros = {k: v for k, v in filtros.items() if v is not None}

        # Generar Excel
        excel_bytes = savings_service.exportar_ahorros_excel(filtros)

        # Nombre de archivo con timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'ahorros_{timestamp}.xlsx'

        return send_file(
            io.BytesIO(excel_bytes),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )

    except ImportError:
        return jsonify({'error': 'openpyxl no está instalado en el servidor'}), 500
    except Exception as e:
        return jsonify({'error': f'Error al exportar: {str(e)}'}), 500
