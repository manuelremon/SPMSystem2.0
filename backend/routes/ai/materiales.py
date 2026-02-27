"""
Material-related AI endpoints: similarity, search, analysis, suggestions, alerts, and EOQ.
"""

import logging

from flask import jsonify, request

from backend.core.helpers import _get_user_id
from backend.core.rate_limit import rate_limit
from backend.core.roles import require_auth
from backend.core.search_utils import build_description_search, expand_codes_from_catalog
from backend.routes.ai import bp
from backend.services.ai_service import get_ai_service
from backend.services.temp_data_service import temp_data_service

logger = logging.getLogger(__name__)


@bp.route("/materiales/similares/<material_codigo>", methods=["GET"])
@require_auth
def materiales_similares(material_codigo):
    """
    Encuentra materiales similares a uno dado.

    Path params:
        - material_codigo: Codigo del material de referencia

    Query params:
        - centro: Centro de costo
        - max: Maximo de resultados (default: 5)

    Returns:
        Lista de materiales similares
    """
    centro = request.args.get("centro", "1000")
    max_resultados = int(request.args.get("max", 5))

    try:
        service = get_ai_service()
        result = service.recomendar_materiales_similares(
            material_codigo=material_codigo, centro=centro, max_resultados=max_resultados
        )

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error buscando similares: {e}")
        return jsonify({"ok": False, "error": {"code": "similares_error", "message": str(e)}}), 500


@bp.route("/materiales/buscar-consumo", methods=["GET"])
@require_auth
def buscar_materiales_consumo():
    """
    Busca materiales que tienen historial de consumo en sap_data.db.

    Query params:
        q: Texto de busqueda (codigo o descripcion, minimo 2 caracteres)
        limit: Maximo de resultados (default 20, max 100)

    Returns:
        Lista de materiales con: codigo, descripcion
    """
    from backend.core.db import get_db_connection

    q = (request.args.get("q") or "").strip()
    limit = min(int(request.args.get("limit", 20)), 100)

    if len(q) < 2:
        return jsonify({"ok": True, "data": []})

    try:
        # Build search for consumo_historico columns
        search_ch = build_description_search(q, ["material", "descripcion"], require_all_words=False)
        # Expand search via catalogo_materiales.descripcion_larga
        catalog_codes = expand_codes_from_catalog(q)

        if not search_ch and not catalog_codes:
            return jsonify({"ok": True, "data": []})

        # Build WHERE for consumo_historico
        ch_parts = []
        ch_params = []
        if search_ch:
            ch_parts.append(search_ch.where_clause)
            ch_params.extend(search_ch.params)
        if catalog_codes:
            placeholders = ", ".join("?" for _ in catalog_codes)
            ch_parts.append(f"material IN ({placeholders})")
            ch_params.extend(catalog_codes)
        ch_where = " OR ".join(ch_parts)
        if len(ch_parts) > 1:
            ch_where = f"({ch_where})"

        # Build search for materiales_bbdd columns (with table alias)
        search_m = build_description_search(q, ["m.codigo_material", "m.descripcion"], require_all_words=False)
        # Build WHERE for materiales_bbdd
        m_parts = []
        m_params = []
        if search_m:
            m_parts.append(search_m.where_clause)
            m_params.extend(search_m.params)
        if catalog_codes:
            placeholders = ", ".join("?" for _ in catalog_codes)
            m_parts.append(f"m.codigo_material IN ({placeholders})")
            m_params.extend(catalog_codes)
        m_where = " OR ".join(m_parts)
        if len(m_parts) > 1:
            m_where = f"({m_where})"

        # Build search for LEFT JOIN condition (consumo_historico alias c)
        search_c = build_description_search(q, ["c.material", "c.descripcion"], require_all_words=False)
        c_parts = []
        c_params = []
        if search_c:
            c_parts.append(search_c.where_clause)
            c_params.extend(search_c.params)
        if catalog_codes:
            placeholders = ", ".join("?" for _ in catalog_codes)
            c_parts.append(f"c.material IN ({placeholders})")
            c_params.extend(catalog_codes)
        c_where = " OR ".join(c_parts)
        if len(c_parts) > 1:
            c_where = f"({c_where})"

        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()
            # Search in both consumo_historico and materiales_bbdd,
            # prioritizing materials that have consumption data
            all_params = ch_params + c_params + m_params + [limit]
            cur.execute(f"""
                SELECT codigo, descripcion, has_consumo FROM (
                    SELECT DISTINCT material AS codigo, descripcion, 1 AS has_consumo
                    FROM consumo_historico
                    WHERE {ch_where}

                    UNION ALL

                    SELECT DISTINCT m.codigo_material AS codigo, m.descripcion, 0 AS has_consumo
                    FROM materiales_bbdd m
                    LEFT JOIN consumo_historico c
                        ON m.codigo_material = c.material
                        AND ({c_where})
                    WHERE ({m_where})
                    AND c.material IS NULL
                )
                ORDER BY has_consumo DESC, codigo
                LIMIT ?
            """, all_params)
            rows = cur.fetchall()
            data = [{"codigo": r[0], "descripcion": r[1], "has_consumo": bool(r[2])} for r in rows]

        return jsonify({"ok": True, "data": data, "total": len(data)})
    except Exception as e:
        logger.error(f"Error buscando materiales con consumo: {e}")
        return jsonify({"ok": False, "error": {"code": "search_error", "message": str(e)}}), 500


@bp.route("/materiales/forecast/<material_codigo>", methods=["GET"])
@require_auth
@rate_limit(requests=5, window_seconds=60)
def forecast_demanda(material_codigo):
    """
    Proyecta demanda futura para un material.
    Soporta modo temporal con datos importados desde Excel.

    Path params:
        - material_codigo: Codigo del material

    Query params:
        - centro: Centro de costo (opcional)
        - almacen: Almacen (opcional)
        - dias: Dias a proyectar (default: 30)
        - modelo: Tipo de modelo ML (default: random_forest)
                  Opciones: random_forest, gradient_boosting, linear, xgboost, prophet, arima

    Returns:
        Proyeccion con intervalo de confianza
    """
    from backend.routes.ai.forecast import _forecast_from_temp_data

    # Soportar centro/almacen como multiselect (getlist) o string individual
    centro = request.args.getlist("centro") or request.args.get("centro", "")
    almacen = request.args.getlist("almacen") or request.args.get("almacen", "")
    # Si viene como lista de un solo elemento, convertir a string
    if isinstance(centro, list) and len(centro) == 1:
        centro = centro[0]
    if isinstance(almacen, list) and len(almacen) == 1:
        almacen = almacen[0]
    dias = int(request.args.get("dias", 30))
    modelo = request.args.get("modelo", "random_forest")
    meses_historico = int(request.args.get("meses_historico", 0))  # 0 = todo el historico

    # Verificar si modo temporal esta activo
    user_id = _get_user_id()
    if user_id and temp_data_service.is_active(user_id):
        return _forecast_from_temp_data(user_id, material_codigo, centro, dias, modelo)

    try:
        service = get_ai_service()
        result = service.proyectar_demanda(
            material_codigo=material_codigo, centro=centro, dias=dias,
            modelo_tipo=modelo, almacen=almacen, meses_historico=meses_historico
        )

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error proyectando demanda: {e}")
        return jsonify({"ok": False, "error": {"code": "forecast_error", "message": str(e)}}), 500


@bp.route("/materiales/analisis/<material_codigo>", methods=["GET"])
@require_auth
def analisis_material(material_codigo):
    """
    Analisis completo de un material integrando MRP y ML.

    Path params:
        - material_codigo: Codigo del material

    Query params:
        - centro: Centro de costo

    Returns:
        Analisis completo con stock status y recomendaciones IA
    """
    centro = request.args.get("centro", "1000")

    try:
        service = get_ai_service()
        result = service.analisis_completo_material(material_codigo=material_codigo, centro=centro)

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error en analisis: {e}")
        return jsonify({"ok": False, "error": {"code": "analisis_error", "message": str(e)}}), 500


@bp.route("/sugerir-accion", methods=["POST"])
@require_auth
def sugerir_accion():
    """
    Sugiere accion para una solicitud.

    Body:
        {
            "solicitud_id": 123,
            // O datos completos de solicitud:
            "solicitud": {
                "id": 123,
                "criticidad": "Alta",
                "total_monto": 50000,
                ...
            }
        }

    Returns:
        Accion sugerida con nivel de confianza
    """
    from backend.core.db import get_db_connection

    data = request.get_json() or {}

    try:
        service = get_ai_service()

        # Obtener solicitud
        if "solicitud" in data:
            solicitud = data["solicitud"]
        elif "solicitud_id" in data:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, criticidad, fecha_necesidad, total_monto, data_json
                    FROM solicitud WHERE id = ?
                """,
                    (data["solicitud_id"],),
                )
                row = cursor.fetchone()
                if not row:
                    return (
                        jsonify(
                            {
                                "ok": False,
                                "error": {
                                    "code": "not_found",
                                    "message": "Solicitud no encontrada",
                                },
                            }
                        ),
                        404,
                    )
                solicitud = dict(row)
        else:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": {
                            "code": "bad_request",
                            "message": "Falta solicitud_id o solicitud",
                        },
                    }
                ),
                400,
            )

        result = service.sugerir_accion(solicitud)

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error sugiriendo accion: {e}")
        return jsonify({"ok": False, "error": {"code": "suggest_error", "message": str(e)}}), 500


@bp.route("/alertas", methods=["GET"])
@require_auth
def alertas_inteligentes():
    """
    Genera alertas inteligentes basadas en patrones ML.

    Query params:
        - centro: Centro de costo (requerido)

    Returns:
        Lista de alertas con severidad y recomendaciones
    """
    centro = request.args.get("centro")

    if not centro:
        return (
            jsonify(
                {"ok": False, "error": {"code": "bad_request", "message": "centro es requerido"}}
            ),
            400,
        )

    try:
        service = get_ai_service()
        result = service.generar_alertas_inteligentes(centro=centro)

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error generando alertas: {e}")
        return jsonify({"ok": False, "error": {"code": "alertas_error", "message": str(e)}}), 500


@bp.route("/cantidad-optima", methods=["POST"])
@require_auth
def cantidad_optima():
    """
    Sugiere cantidad optima de pedido (EOQ).

    Body:
        {
            "material_codigo": "MAT001",
            "centro": "1000",
            "demanda_anual": 1200,  // Opcional
            "costo_orden": 50,      // Opcional
            "costo_mantenimiento": 2 // Opcional
        }

    Returns:
        Cantidad sugerida con justificacion
    """
    data = request.get_json() or {}

    material_codigo = data.get("material_codigo")
    centro = data.get("centro", "1000")

    if not material_codigo:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "bad_request", "message": "material_codigo es requerido"},
                }
            ),
            400,
        )

    try:
        service = get_ai_service()
        result = service.sugerir_cantidad_optima(
            material_codigo=material_codigo,
            centro=centro,
            demanda_anual=data.get("demanda_anual"),
            costo_orden=data.get("costo_orden", 50.0),
            costo_mantenimiento=data.get("costo_mantenimiento", 2.0),
        )

        return jsonify({"ok": True, "data": result})

    except Exception as e:
        logger.error(f"Error calculando cantidad optima: {e}")
        return jsonify({"ok": False, "error": {"code": "eoq_error", "message": str(e)}}), 500


@bp.route("/abc-analysis", methods=["GET"])
@require_auth
def abc_analysis():
    """
    ABC Analysis of materials based on consumption value.

    Query params:
        - centro: Centro de costo (opcional)
        - sector: Sector (opcional)
        - periodo_meses: Meses a analizar (default: 12)

    Returns:
        {
            "ok": True,
            "data": [
                {
                    "material": "MAT001",
                    "descripcion": "Material 1",
                    "valor_total": 50000.00,
                    "pct_acumulado": 35.5,
                    "clase": "A"
                },
                ...
            ],
            "kpis": {
                "total_valor": 140000.00,
                "items_a": 15,
                "items_b": 30,
                "items_c": 105,
                "pct_valor_a": 80.2
            }
        }
    """
    from backend.core.db import get_db_connection

    centro = request.args.get("centro", "")
    sector = request.args.get("sector", "")
    periodo_meses = int(request.args.get("periodo_meses", 12))

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            # Build WHERE clause
            where_parts = []
            params = []

            # Date filter - use PG-compatible interval arithmetic
            where_parts.append("fecha >= CURRENT_DATE - (%s * INTERVAL '1 month')")
            params.append(periodo_meses)

            if centro:
                where_parts.append("centro = %s")
                params.append(centro)

            if sector:
                where_parts.append("sector = %s")
                params.append(sector)

            where_clause = " AND ".join(where_parts)

            # Query total value consumed per material
            # Use cantidad as proxy for value (precio_unitario may not be available)
            # Note: PG GROUP BY strict mode - cannot use alias in HAVING, use subquery
            cur.execute(f"""
                SELECT material, descripcion, valor_total
                FROM (
                    SELECT
                        material,
                        MAX(descripcion) as descripcion,
                        SUM(cantidad) as valor_total
                    FROM consumo_historico
                    WHERE {where_clause}
                    GROUP BY material
                ) sub
                WHERE valor_total > 0
                ORDER BY valor_total DESC
            """, params)

            rows = cur.fetchall()

            if not rows:
                return jsonify({
                    "ok": True,
                    "data": [],
                    "kpis": {
                        "total_valor": 0.0,
                        "items_a": 0,
                        "items_b": 0,
                        "items_c": 0,
                        "pct_valor_a": 0.0
                    }
                })

            # Calculate cumulative percentage and classify
            # Use dict key access for DictRow compatibility
            total_valor = sum(float(r["valor_total"] or 0) for r in rows)
            acumulado = 0.0
            data = []
            items_a = items_b = items_c = 0
            valor_a = 0.0

            for row in rows:
                material = row["material"]
                descripcion = row["descripcion"]
                valor = float(row["valor_total"] or 0)
                acumulado += valor
                pct_acumulado = (acumulado / total_valor) * 100 if total_valor > 0 else 0

                # Classify: A (top 80%), B (next 15%), C (remaining 5%)
                if pct_acumulado <= 80:
                    clase = "A"
                    items_a += 1
                    valor_a += valor
                elif pct_acumulado <= 95:
                    clase = "B"
                    items_b += 1
                else:
                    clase = "C"
                    items_c += 1

                data.append({
                    "material": material,
                    "descripcion": descripcion or "",
                    "valor_total": round(valor, 2),
                    "pct_acumulado": round(pct_acumulado, 2),
                    "clase": clase
                })

            pct_valor_a = (valor_a / total_valor * 100) if total_valor > 0 else 0.0

            return jsonify({
                "ok": True,
                "data": data,
                "kpis": {
                    "total_valor": round(total_valor, 2),
                    "items_a": items_a,
                    "items_b": items_b,
                    "items_c": items_c,
                    "pct_valor_a": round(pct_valor_a, 2)
                }
            })

    except Exception as e:
        logger.error(f"Error en ABC analysis: {e}")
        return jsonify({"ok": False, "error": {"code": "abc_error", "message": str(e)}}), 500
