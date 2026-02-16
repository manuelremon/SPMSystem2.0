"""
Executive Analytics Routes
Dashboard ejecutivo de procurement y benchmarking
"""
from flask import Blueprint, g, jsonify, request

from backend.core.auth_middleware import require_admin, require_auth
from backend.core.request_validation import validate_json
from backend.services import executive_analytics_service

executive_bp = Blueprint('executive', __name__, url_prefix='/api/executive')


@executive_bp.route('/dashboard', methods=['GET'])
@require_auth
def get_dashboard():
    """GET /api/executive/dashboard - Dashboard ejecutivo completo"""
    try:
        dashboard = executive_analytics_service.obtener_dashboard()
        return jsonify(dashboard), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@executive_bp.route('/kpis', methods=['GET'])
@require_auth
def get_kpis():
    """GET /api/executive/kpis - Lista de KPIs configurados"""
    try:
        kpis = executive_analytics_service.obtener_kpis_configurados()
        return jsonify({'kpis': kpis}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@executive_bp.route('/kpis', methods=['POST'])
@require_admin
@validate_json({
    'categoria': str,
    'kpi_key': str,
    'nombre': str
})
def create_kpi():
    """POST /api/executive/kpis - Crear nuevo KPI (admin)"""
    try:
        data = request.get_json()
        kpi_id = executive_analytics_service.crear_kpi(data)

        return jsonify({
            'message': 'KPI creado exitosamente',
            'kpi_id': kpi_id
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@executive_bp.route('/kpis/<int:kpi_id>', methods=['PUT'])
@require_admin
def update_kpi(kpi_id):
    """PUT /api/executive/kpis/<id> - Actualizar KPI (admin)"""
    try:
        data = request.get_json()
        executive_analytics_service.actualizar_kpi(kpi_id, data)

        return jsonify({'message': 'KPI actualizado exitosamente'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@executive_bp.route('/trends/<kpi_key>', methods=['GET'])
@require_auth
def get_trends(kpi_key):
    """GET /api/executive/trends/<kpi_key> - Tendencia histórica (12 meses)"""
    try:
        meses = int(request.args.get('meses', 12))
        tendencias = executive_analytics_service.obtener_tendencias(kpi_key, meses)

        return jsonify({
            'kpi_key': kpi_key,
            'tendencias': tendencias
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@executive_bp.route('/benchmarks', methods=['GET'])
@require_auth
def get_benchmarks():
    """GET /api/executive/benchmarks - Benchmarks disponibles"""
    try:
        kpi_key = request.args.get('kpi_key')
        benchmarks = executive_analytics_service.obtener_benchmarks(kpi_key)

        return jsonify({'benchmarks': benchmarks}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@executive_bp.route('/benchmarks', methods=['POST'])
@require_admin
@validate_json({
    'kpi_key': str,
    'industria': str,
    'region': str,
    'percentil_25': (int, float),
    'mediana': (int, float),
    'percentil_75': (int, float)
})
def create_benchmark():
    """POST /api/executive/benchmarks - Crear benchmark (admin)"""
    try:
        data = request.get_json()
        benchmark_id = executive_analytics_service.crear_benchmark(data)

        return jsonify({
            'message': 'Benchmark creado exitosamente',
            'benchmark_id': benchmark_id
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@executive_bp.route('/scorecards/generate', methods=['POST'])
@require_auth
def generate_scorecard():
    """POST /api/executive/scorecards/generate - Generar scorecard"""
    try:
        data = request.get_json() or {}
        categorias = data.get('categorias')

        scorecard_id = executive_analytics_service.generar_scorecard(
            usuario_id=g.user['id'],
            categorias=categorias
        )

        return jsonify({
            'message': 'Scorecard generado exitosamente',
            'scorecard_id': scorecard_id
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@executive_bp.route('/scorecards', methods=['GET'])
@require_auth
def get_scorecards():
    """GET /api/executive/scorecards - Scorecards históricos"""
    try:
        limit = int(request.args.get('limit', 10))
        scorecards = executive_analytics_service.obtener_scorecards(limit)

        return jsonify({'scorecards': scorecards}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@executive_bp.route('/scorecards/<int:scorecard_id>', methods=['GET'])
@require_auth
def get_scorecard_detail(scorecard_id):
    """GET /api/executive/scorecards/<id> - Detalle de scorecard"""
    try:
        scorecard = executive_analytics_service.obtener_scorecard_detalle(scorecard_id)

        if not scorecard:
            return jsonify({'error': 'Scorecard no encontrado'}), 404

        return jsonify(scorecard), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
