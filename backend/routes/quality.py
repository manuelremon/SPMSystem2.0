"""
Quality Routes
Endpoints para gestión de inspecciones de calidad, NCR y CAPA
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id, safe_error_response
from backend.core.roles import require_auth
from backend.services import capa_service, quality_service

logger = logging.getLogger(__name__)

quality_bp = Blueprint('quality', __name__, url_prefix='/api/quality')


# ==================== INSPECCIONES ====================

@quality_bp.route('/inspections', methods=['GET'])
@require_auth
def listar_inspecciones():
    """Listar inspecciones con filtros opcionales"""
    try:
        filtros = {
            'tipo': request.args.get('tipo'),
            'resultado': request.args.get('resultado'),
            'fecha_desde': request.args.get('fecha_desde'),
            'fecha_hasta': request.args.get('fecha_hasta'),
            'page': int(request.args.get('page', 1)),
            'per_page': int(request.args.get('per_page', 20))
        }

        resultado = quality_service.obtener_inspecciones(filtros)
        resultado['ok'] = True
        # Frontend espera 'inspections' (ingles)
        resultado['inspections'] = resultado.pop('inspecciones', [])
        return jsonify(resultado), 200

    except Exception as e:
        return safe_error_response(e, logger, context="quality")


@quality_bp.route('/inspections', methods=['POST'])
@require_auth
def crear_inspeccion():
    """Crear nueva inspección de entrada"""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        # Validar campos requeridos
        if not data.get('recepcion_id'):
            return jsonify({'error': 'recepcion_id es requerido'}), 400

        valid_tipos = ['sample', 'full', 'recepcion', 'proceso', 'final']
        if not data.get('tipo') or data['tipo'] not in valid_tipos:
            return jsonify({'error': f'tipo debe ser uno de: {", ".join(valid_tipos)}'}), 400

        inspeccion = quality_service.crear_inspeccion(data, user_id)
        inspeccion['ok'] = True
        inspeccion['inspection_id'] = inspeccion.get('id')
        return jsonify(inspeccion), 201

    except Exception as e:
        return safe_error_response(e, logger, context="quality")


@quality_bp.route('/inspections/<int:inspeccion_id>', methods=['GET'])
@require_auth
def obtener_inspeccion(inspeccion_id):
    """Obtener detalle de inspección con items"""
    try:
        inspeccion = quality_service.obtener_detalle_inspeccion(inspeccion_id)

        if not inspeccion:
            return jsonify({'error': 'Inspección no encontrada'}), 404

        return jsonify(inspeccion), 200

    except Exception as e:
        return safe_error_response(e, logger, context="quality")


@quality_bp.route('/inspections/<int:inspeccion_id>/results', methods=['PUT'])
@require_auth
def registrar_resultados_inspeccion(inspeccion_id):
    """Registrar resultados de inspección de items"""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        items = data.get('items', [])
        if not items:
            return jsonify({'error': 'items es requerido'}), 400

        # Validar estructura de items
        for item in items:
            if 'recepcion_item_id' not in item:
                return jsonify({'error': 'recepcion_item_id es requerido en cada item'}), 400

            if 'resultado' in item and item['resultado'] not in ['pass', 'fail', 'partial']:
                return jsonify({'error': 'resultado debe ser pass, fail o partial'}), 400

        resultado = quality_service.registrar_resultado_inspeccion(
            inspeccion_id, items, user_id
        )

        return jsonify(resultado), 200

    except Exception as e:
        return safe_error_response(e, logger, context="quality")


# ==================== NCR (Non-Conformance Reports) ====================

@quality_bp.route('/ncr', methods=['GET'])
@require_auth
def listar_ncrs():
    """Listar NCRs con filtros opcionales"""
    try:
        filtros = {
            'estado': request.args.get('estado'),
            'severidad': request.args.get('severidad'),
            'proveedor': request.args.get('proveedor'),
            'page': int(request.args.get('page', 1)),
            'per_page': int(request.args.get('per_page', 20))
        }

        resultado = quality_service.obtener_ncrs(filtros)
        resultado['ok'] = True
        return jsonify(resultado), 200

    except Exception as e:
        return safe_error_response(e, logger, context="quality")


@quality_bp.route('/ncr', methods=['POST'])
@require_auth
def crear_ncr():
    """Crear nuevo NCR manualmente"""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        # Validar campos requeridos
        if not data.get('descripcion'):
            return jsonify({'error': 'descripcion es requerida'}), 400

        if not data.get('severidad') or data['severidad'] not in ['critical', 'major', 'minor']:
            return jsonify({'error': 'severidad debe ser critical, major o minor'}), 400

        ncr = quality_service.generar_ncr(
            inspeccion_id=data.get('inspeccion_id'),
            proveedor_cuit=data.get('proveedor_cuit'),
            material_codigo=data.get('material_codigo'),
            cantidad=data.get('cantidad_afectada'),
            descripcion=data['descripcion'],
            severidad=data['severidad'],
            user_id=user_id
        )

        return jsonify(ncr), 201

    except Exception as e:
        return safe_error_response(e, logger, context="quality")


@quality_bp.route('/ncr/<int:ncr_id>', methods=['GET'])
@require_auth
def obtener_ncr(ncr_id):
    """Obtener detalle de NCR con historial"""
    try:
        ncr = quality_service.obtener_detalle_ncr(ncr_id)

        if not ncr:
            return jsonify({'error': 'NCR no encontrado'}), 404

        return jsonify(ncr), 200

    except Exception as e:
        return safe_error_response(e, logger, context="quality")


@quality_bp.route('/ncr/<int:ncr_id>/status', methods=['PUT'])
@require_auth
def cambiar_estado_ncr(ncr_id):
    """Cambiar estado de NCR"""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        nuevo_estado = data.get('estado')
        if not nuevo_estado:
            return jsonify({'error': 'estado es requerido'}), 400

        if nuevo_estado not in ['open', 'under_investigation', 'resolved', 'closed']:
            return jsonify({'error': 'estado inválido'}), 400

        resultado = quality_service.cambiar_estado_ncr(
            ncr_id,
            nuevo_estado,
            user_id,
            data.get('notas')
        )

        return jsonify(resultado), 200

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="quality.cambiar_estado_ncr")
    except Exception as e:
        return safe_error_response(e, logger, context="quality.cambiar_estado_ncr")


# ==================== KPIs DE CALIDAD ====================

@quality_bp.route('/kpis', methods=['GET'])
@require_auth
def obtener_kpis_calidad():
    """Obtener KPIs de calidad"""
    try:
        raw = quality_service.obtener_kpis_calidad()
        # Frontend espera: kpis.total, kpis.pass_rate, kpis.pending, kpis.failed
        kpis = {
            'total': raw.get('total_inspecciones', 0),
            'pass_rate': raw.get('pass_rate', 0),
            'pending': raw.get('ncrs_abiertos', 0),
            'failed': raw.get('ncr_por_severidad', {}).get('critical', 0)
                     + raw.get('ncr_por_severidad', {}).get('major', 0),
            'avg_resolution_days': raw.get('avg_resolution_days', 0),
            'ncr_por_severidad': raw.get('ncr_por_severidad', {}),
        }
        return jsonify({'ok': True, 'kpis': kpis}), 200

    except Exception as e:
        return safe_error_response(e, logger, context="quality")


@quality_bp.route('/supplier/<string:proveedor_cuit>/quality-trend', methods=['GET'])
@require_auth
def obtener_tendencia_calidad_proveedor(proveedor_cuit):
    """Obtener tendencia de calidad de proveedor (12 meses)"""
    try:
        periodo_meses = int(request.args.get('periodo', 12))

        # Calcular score general
        score_data = quality_service.calcular_score_calidad_proveedor(
            proveedor_cuit,
            periodo_meses
        )

        # Obtener tendencia mensual
        from backend.core.db import get_db_connection
        conn = get_db_connection()
        cursor = conn.cursor()

        from backend.core.db import is_using_postgresql
        ph = "%s" if is_using_postgresql() else "?"
        cursor.execute(f"""
            SELECT
                to_char(created_at, 'YYYY-MM') as mes,
                severidad,
                COUNT(*) as count
            FROM ncr
            WHERE proveedor_cuit = {ph}
            AND created_at >= CURRENT_DATE - ({ph} || ' months')::interval
            GROUP BY to_char(created_at, 'YYYY-MM'), severidad
            ORDER BY mes
        """, (proveedor_cuit, str(periodo_meses)))

        tendencia_rows = cursor.fetchall()
        conn.close()

        # Organizar tendencia por mes
        tendencia = {}
        for row in tendencia_rows:
            mes = row[0]
            severidad = row[1]
            count = row[2]

            if mes not in tendencia:
                tendencia[mes] = {'critical': 0, 'major': 0, 'minor': 0}

            tendencia[mes][severidad] = count

        return jsonify({
            'proveedor_cuit': proveedor_cuit,
            'score': score_data['score'],
            'periodo_meses': periodo_meses,
            'total_recepciones': score_data['total_recepciones'],
            'ncrs_totales': score_data['ncrs'],
            'tendencia': tendencia
        }), 200

    except Exception as e:
        return safe_error_response(e, logger, context="quality")


# ==================== CAPA (Corrective and Preventive Actions) ====================

@quality_bp.route('/capa', methods=['GET'])
@require_auth
def listar_capas():
    """Listar CAPAs con filtros opcionales"""
    try:
        filtros = {
            'tipo': request.args.get('tipo'),
            'estado': request.args.get('estado'),
            'responsable': request.args.get('responsable'),
            'page': int(request.args.get('page', 1)),
            'per_page': int(request.args.get('per_page', 20))
        }

        resultado = capa_service.obtener_capas(filtros)
        resultado['ok'] = True
        return jsonify(resultado), 200

    except Exception as e:
        return safe_error_response(e, logger, context="quality")


@quality_bp.route('/capa', methods=['POST'])
@require_auth
def crear_capa():
    """Crear nuevo CAPA (correctivo o preventivo)"""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        # Validar campos requeridos
        if not data.get('titulo'):
            return jsonify({'error': 'titulo es requerido'}), 400

        tipo = data.get('tipo', 'corrective')
        if tipo not in ['corrective', 'preventive']:
            return jsonify({'error': 'tipo debe ser corrective o preventive'}), 400

        # Si tiene NCR asociado, crear CAPA correctivo
        if data.get('ncr_id'):
            capa = capa_service.crear_capa_desde_ncr(
                data['ncr_id'],
                data,
                user_id
            )
        else:
            # Crear CAPA preventivo
            capa = capa_service.crear_capa_preventiva(data, user_id)

        return jsonify(capa), 201

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="quality.crear_capa")
    except Exception as e:
        return safe_error_response(e, logger, context="quality.crear_capa")


@quality_bp.route('/capa/<int:capa_id>', methods=['GET'])
@require_auth
def obtener_capa(capa_id):
    """Obtener detalle de CAPA con historial"""
    try:
        capa = capa_service.obtener_detalle_capa(capa_id)

        if not capa:
            return jsonify({'error': 'CAPA no encontrado'}), 404

        return jsonify(capa), 200

    except Exception as e:
        return safe_error_response(e, logger, context="quality")


@quality_bp.route('/capa/<int:capa_id>/status', methods=['PUT'])
@require_auth
def cambiar_estado_capa(capa_id):
    """Cambiar estado de CAPA"""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        nuevo_estado = data.get('estado')
        if not nuevo_estado:
            return jsonify({'error': 'estado es requerido'}), 400

        if nuevo_estado not in ['pending', 'in_progress', 'implemented', 'verified', 'closed']:
            return jsonify({'error': 'estado inválido'}), 400

        resultado = capa_service.cambiar_estado_capa(
            capa_id,
            nuevo_estado,
            user_id,
            data.get('notas')
        )

        return jsonify(resultado), 200

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="quality.cambiar_estado_capa")
    except Exception as e:
        return safe_error_response(e, logger, context="quality.cambiar_estado_capa")


@quality_bp.route('/capa/<int:capa_id>/verify', methods=['PUT'])
@require_auth
def verificar_efectividad_capa(capa_id):
    """Verificar efectividad de CAPA implementado"""
    try:
        data = request.get_json()
        user_id = _get_user_id()

        efectividad = data.get('efectividad')
        if not efectividad:
            return jsonify({'error': 'efectividad es requerida'}), 400

        resultado = capa_service.verificar_efectividad(
            capa_id,
            efectividad,
            user_id
        )

        return jsonify(resultado), 200

    except ValueError as e:
        return safe_error_response(e, logger, status_code=400, context="quality.verificar_efectividad_capa")
    except Exception as e:
        return safe_error_response(e, logger, context="quality.verificar_efectividad_capa")
