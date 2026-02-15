"""
AI Copilot Routes
Endpoints para asistente de IA conversacional (Sprint 75)
"""

from flask import Blueprint, jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.roles import require_auth
from backend.services import copilot_service

copilot_bp = Blueprint('copilot', __name__, url_prefix='/api/copilot')


@copilot_bp.route('/conversations', methods=['GET'])
@require_auth
def obtener_conversaciones():
    """Obtener conversaciones del usuario."""
    try:
        user_id = _get_user_id()
        conversaciones = copilot_service.obtener_conversaciones(user_id)
        return jsonify(conversaciones), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@copilot_bp.route('/conversations', methods=['POST'])
@require_auth
def iniciar_conversacion():
    """Iniciar nueva conversación."""
    try:
        data = request.get_json()
        user_id = _get_user_id()
        titulo = data.get('titulo')
        contexto_tipo = data.get('contexto_tipo', 'procurement')
        conversacion = copilot_service.iniciar_conversacion(user_id, titulo, contexto_tipo)
        return jsonify(conversacion), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@copilot_bp.route('/conversations/<int:id>', methods=['GET'])
@require_auth
def obtener_mensajes(id):
    """Obtener mensajes de una conversación."""
    try:
        mensajes = copilot_service.obtener_mensajes(id)
        return jsonify(mensajes), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@copilot_bp.route('/conversations/<int:id>/messages', methods=['POST'])
@require_auth
def enviar_mensaje(id):
    """Enviar mensaje en una conversación."""
    try:
        data = request.get_json()
        contenido = data.get('contenido')
        user_id = _get_user_id()
        mensaje = copilot_service.enviar_mensaje(id, contenido, user_id)
        return jsonify(mensaje), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@copilot_bp.route('/suggestions', methods=['GET'])
@require_auth
def obtener_sugerencias():
    """Obtener sugerencias de IA con filtros."""
    try:
        filtros = {
            'tipo': request.args.get('tipo'),
            'estado': request.args.get('estado'),
            'page': request.args.get('page', 1, type=int),
            'per_page': request.args.get('per_page', 50, type=int)
        }
        sugerencias = copilot_service.obtener_sugerencias(filtros)
        return jsonify(sugerencias), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@copilot_bp.route('/suggestions/sourcing/<material>', methods=['POST'])
@require_auth
def generar_sugerencia_sourcing(material):
    """Generar sugerencia de sourcing para un material."""
    try:
        sugerencia = copilot_service.generar_sugerencia_sourcing(material)
        return jsonify(sugerencia), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@copilot_bp.route('/suggestions/rfq-draft/<int:solicitud_id>', methods=['POST'])
@require_auth
def auto_draft_rfq(solicitud_id):
    """Auto-generar borrador de RFQ desde solicitud."""
    try:
        rfq_draft = copilot_service.auto_draft_rfq(solicitud_id)
        return jsonify(rfq_draft), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@copilot_bp.route('/suggestions/<int:id>/feedback', methods=['PUT'])
@require_auth
def feedback_sugerencia(id):
    """Enviar feedback sobre sugerencia de IA."""
    try:
        data = request.get_json()
        accion = data.get('accion')
        feedback = data.get('feedback')
        resultado = copilot_service.feedback_sugerencia(id, accion, feedback)
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@copilot_bp.route('/insights', methods=['GET'])
@require_auth
def obtener_insights_dashboard():
    """Obtener insights del dashboard de IA."""
    try:
        insights = copilot_service.obtener_insights_dashboard()
        return jsonify(insights), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@copilot_bp.route('/spend-patterns', methods=['GET'])
@require_auth
def analizar_patron_gasto():
    """Analizar patrones de gasto."""
    try:
        periodo = request.args.get('periodo')
        patrones = copilot_service.analizar_patron_gasto(periodo)
        return jsonify(patrones), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
