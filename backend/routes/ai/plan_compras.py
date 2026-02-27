"""
Purchase plan endpoint: intelligent procurement planning combining forecast + stock + suppliers.
"""

import logging

from flask import jsonify, request

from backend.core.roles import require_auth, require_role
from backend.routes.ai import bp

logger = logging.getLogger(__name__)


@bp.route('/plan-compras/<centro>', methods=['GET'])
@require_auth
@require_role(['Admin', 'Administrador', 'Planificador', 'Planner'])
def get_plan_compras(centro):
    """
    Feature 4.4: Genera plan de compras inteligente combinando forecast + stock + proveedores.

    Para cada material A/B del centro:
    1. Ejecuta forecast de demanda
    2. Compara con stock actual y pedidos en curso
    3. Identifica proveedor optimo (mejor OTIF)
    4. Calcula cantidad optima (EOQ)
    5. Sugiere fecha de compra

    Query params:
        - limit: Maximo de items (default: 50, max: 200)
    """
    try:
        from datetime import datetime, timedelta

        from backend.core.db import get_db_connection
        from backend.services.mrp_service import (
            calcular_cantidad_optima,
        )

        limite = min(int(request.args.get('limit', 50)), 200)

        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            # Get A/B materials needing reorder
            cur.execute("""
                SELECT
                    m.codigo_material,
                    m.descripcion,
                    m.centro,
                    m.stock_actual,
                    m.stock_seguridad,
                    m.punto_pedido,
                    m.consumo_promedio_mensual,
                    m.lead_time_dias,
                    m.pedidos_en_curso,
                    m.categoria_abc,
                    m.critico
                FROM materiales_mrp m
                WHERE m.centro = %s
                  AND UPPER(COALESCE(m.categoria_abc, 'C')) IN ('A', 'B')
                  AND m.stock_actual < m.punto_pedido
                ORDER BY
                    CASE WHEN m.stock_actual <= 0 THEN 0
                         WHEN m.stock_actual < COALESCE(m.stock_seguridad, 0) THEN 1
                         ELSE 2 END,
                    m.codigo_material
                LIMIT %s
            """, (centro, limite))
            materiales = cur.fetchall()

            plan = []
            for mat_row in materiales:
                mat = dict(mat_row) if hasattr(mat_row, 'keys') else {
                    'codigo_material': mat_row[0], 'descripcion': mat_row[1],
                    'centro': mat_row[2], 'stock_actual': mat_row[3],
                    'stock_seguridad': mat_row[4], 'punto_pedido': mat_row[5],
                    'consumo_promedio_mensual': mat_row[6], 'lead_time_dias': mat_row[7],
                    'pedidos_en_curso': mat_row[8], 'categoria_abc': mat_row[9],
                    'critico': mat_row[10]
                }
                codigo = mat.get('codigo_material') or mat_row[0]
                stock = mat.get('stock_actual') or 0
                ss = mat.get('stock_seguridad') or 0
                pp = mat.get('punto_pedido') or 0
                consumo = mat.get('consumo_promedio_mensual') or 0
                lead_time = mat.get('lead_time_dias') or 30
                mat.get('pedidos_en_curso') or 0

                # Calculate optimal quantity
                demanda_anual = consumo * 12
                try:
                    eoq_result = calcular_cantidad_optima(
                        demanda_anual=demanda_anual,
                        costo_orden=100,
                        costo_mantenimiento_unitario=max(demanda_anual * 0.2 / 12, 0.01)
                    )
                    cantidad = eoq_result['cantidad_optima']
                except Exception:
                    cantidad = max(pp - stock, consumo) if consumo > 0 else 100

                # Find best provider for this material
                cur.execute("""
                    SELECT
                        p.proveedor_nombre,
                        p.proveedor_cuit,
                        COUNT(*) as entregas,
                        SUM(CASE
                            WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
                             AND p.cantidad_recepcionada >= p.cantidad_pedida
                            THEN 1 ELSE 0
                        END) as otif_count,
                        AVG(s.precio_unitario) as precio_promedio
                    FROM sap_purchase_orders p
                    INNER JOIN sap_solpeds s
                        ON p.solped_id = s.solped_id AND p.solped_posicion = s.posicion
                    WHERE s.material_codigo = %s
                      AND p.fecha_recepcion IS NOT NULL
                      AND p.proveedor_nombre IS NOT NULL
                    GROUP BY p.proveedor_cuit, p.proveedor_nombre
                    HAVING COUNT(*) >= 2
                    ORDER BY (SUM(CASE
                        WHEN p.fecha_recepcion <= s.fecha_entrega_solicitada
                         AND p.cantidad_recepcionada >= p.cantidad_pedida
                        THEN 1 ELSE 0 END)::float / COUNT(*)) DESC
                    LIMIT 1
                """, (codigo,))
                best_provider = cur.fetchone()

                provider_info = None
                precio_estimado = 0
                if best_provider:
                    bp_row = dict(best_provider) if hasattr(best_provider, 'keys') else {
                        'proveedor_nombre': best_provider[0], 'proveedor_cuit': best_provider[1],
                        'entregas': best_provider[2], 'otif_count': best_provider[3],
                        'precio_promedio': best_provider[4]
                    }
                    entregas = bp_row.get('entregas') or bp_row.get(2) or 1
                    otif = bp_row.get('otif_count') or bp_row.get(3) or 0
                    precio_estimado = float(bp_row.get('precio_promedio') or bp_row.get(4) or 0)
                    provider_info = {
                        "nombre": bp_row.get('proveedor_nombre') or bp_row[0],
                        "cuit": bp_row.get('proveedor_cuit') or bp_row[1],
                        "otif_pct": round(100 * otif / entregas, 1),
                        "entregas": entregas,
                        "precio_promedio": round(precio_estimado, 2)
                    }

                # Suggested order date
                consumo_diario = consumo / 30 if consumo > 0 else 0
                dias_hasta_quiebre = round(stock / consumo_diario) if consumo_diario > 0 else 999
                fecha_pedido = datetime.now() + timedelta(days=max(0, dias_hasta_quiebre - lead_time))

                # Urgency
                if stock <= 0:
                    urgencia = "critica"
                elif stock < ss:
                    urgencia = "alta"
                elif stock < pp:
                    urgencia = "media"
                else:
                    urgencia = "baja"

                plan.append({
                    "material_codigo": codigo,
                    "descripcion": mat.get('descripcion') or mat_row[1] or '',
                    "stock_actual": stock,
                    "punto_pedido": pp,
                    "stock_seguridad": ss,
                    "cantidad_sugerida": cantidad,
                    "costo_estimado": round(cantidad * precio_estimado, 2) if precio_estimado else None,
                    "proveedor_optimo": provider_info,
                    "fecha_sugerida": fecha_pedido.strftime('%Y-%m-%d'),
                    "urgencia": urgencia,
                    "categoria_abc": mat.get('categoria_abc'),
                    "cobertura_actual_dias": round(stock / consumo_diario, 1) if consumo_diario > 0 else None,
                    "cobertura_post_compra_dias": round((stock + cantidad) / consumo_diario, 1) if consumo_diario > 0 else None
                })

        return jsonify({
            "centro": centro,
            "total_items": len(plan),
            "costo_total_estimado": round(sum(p.get('costo_estimado') or 0 for p in plan), 2),
            "plan": plan
        })

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error generando plan de compras: {e}")
        return jsonify({"error": "Error al generar plan de compras"}), 500
