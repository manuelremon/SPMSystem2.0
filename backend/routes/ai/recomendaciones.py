"""
Recommendation endpoints: purchase recommendations, anomaly detection, and material clustering.
"""

import logging

from flask import jsonify, request

from backend.core.rate_limit import rate_limit
from backend.core.roles import require_auth, require_role
from backend.routes.ai import bp

logger = logging.getLogger(__name__)


# ============================================================================
# Recomendaciones de Compra (RecommendationEngine)
# ============================================================================

@bp.route("/recomendaciones/<centro>", methods=["GET"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def get_recomendaciones(centro):
    """
    Genera recomendaciones de compra para un centro.

    Path params:
        - centro: Centro de distribucion

    Query params:
        - limit: Maximo de recomendaciones (default: 10, max: 50)

    Returns:
        Lista de recomendaciones ordenadas por score
    """

    from backend.core.db import get_db_connection
    from backend.services.recommendation_engine import RecommendationEngine

    limit = min(int(request.args.get("limit", 10)), 50)

    try:
        engine = RecommendationEngine()
        db_name = "sap_data"

        with get_db_connection(db_name) as conn:
            cursor = conn.cursor()

            # Obtener materiales con stock y consumo
            cursor.execute("""
                SELECT
                    m.codigo_material as codigo,
                    m.descripcion,
                    COALESCE(m.stock_de_seguridad, 0) as stock_seguridad,
                    COALESCE(m.punto_de_pedido, 0) as punto_pedido,
                    COALESCE(m.consumo_promedio_anual, 0) as consumo_anual,
                    COALESCE(s.stock_actual, 0) as stock_actual,
                    COALESCE(s.precio_unitario, 0) as precio_unitario
                FROM materiales_bbdd m
                LEFT JOIN (
                    SELECT material, centro,
                        SUM(stock) as stock_actual,
                        AVG(precio) as precio_unitario
                    FROM stock
                    GROUP BY material, centro
                ) s ON m.codigo_material = s.material AND m.centro = s.centro
                WHERE m.centro = ?
                ORDER BY m.codigo_material
                LIMIT 200
            """, (centro,))
            materiales_raw = [dict(row) for row in cursor.fetchall()]

        materiales_para_engine = []
        for mat in materiales_raw:
            consumo_anual = float(mat.get("consumo_anual") or 0)
            demanda_diaria = consumo_anual / 365 if consumo_anual > 0 else 0.1
            stock_actual = float(mat.get("stock_actual") or 0)
            punto_pedido = float(mat.get("punto_pedido") or 0)

            # Solo incluir materiales con datos significativos
            if consumo_anual > 0 or stock_actual > 0:
                materiales_para_engine.append({
                    'codigo': mat['codigo'],
                    'descripcion': mat.get('descripcion', ''),
                    'stock_actual': stock_actual,
                    'rop': punto_pedido if punto_pedido > 0 else demanda_diaria * 14,
                    'consumo_historico': [demanda_diaria] * 30,
                    'demanda_promedio': demanda_diaria,
                    'demanda_std': demanda_diaria * 0.3,
                    'abc_clase': 'A' if consumo_anual > 10000 else 'B' if consumo_anual > 1000 else 'C',
                    'lead_time_dias': 14,
                    'precio_unitario': float(mat.get("precio_unitario") or 0),
                    'cantidad_eoq': 0
                })

        recomendaciones = engine.generar_top_recomendaciones(materiales_para_engine, limit=limit)

        return jsonify({
            "ok": True,
            "data": {
                "centro": centro,
                "recomendaciones": recomendaciones,
                "total": len(recomendaciones)
            }
        })

    except Exception as e:
        logger.error(f"Error generando recomendaciones: {e}")
        return jsonify({"ok": False, "error": {"code": "recomendaciones_error", "message": str(e)}}), 500


@bp.route("/recomendaciones/material/<material_codigo>", methods=["GET"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def get_recomendacion_material(material_codigo):
    """
    Genera recomendacion para un material especifico.

    Path params:
        - material_codigo: Codigo del material

    Query params:
        - centro: Centro (default: primer centro encontrado)

    Returns:
        Recomendacion con scoring detallado
    """
    import numpy as np

    from backend.core.db import get_db_connection
    from backend.services.recommendation_engine import RecommendationEngine

    centro = request.args.get("centro", "")

    try:
        engine = RecommendationEngine()
        db_name = "sap_data"

        with get_db_connection(db_name) as conn:
            cursor = conn.cursor()

            # Info del material
            query = """
                SELECT
                    m.codigo_material as codigo,
                    m.descripcion,
                    m.centro,
                    COALESCE(m.stock_de_seguridad, 0) as stock_seguridad,
                    COALESCE(m.punto_de_pedido, 0) as punto_pedido,
                    COALESCE(m.consumo_promedio_anual, 0) as consumo_anual,
                    COALESCE(s.stock_actual, 0) as stock_actual,
                    COALESCE(s.precio_unitario, 0) as precio_unitario
                FROM materiales_bbdd m
                LEFT JOIN (
                    SELECT material, centro,
                        SUM(stock) as stock_actual,
                        AVG(precio) as precio_unitario
                    FROM stock
                    GROUP BY material, centro
                ) s ON m.codigo_material = s.material AND m.centro = s.centro
                WHERE m.codigo_material = ?
            """
            params = [material_codigo]
            if centro:
                query += " AND m.centro = ?"
                params.append(centro)
            query += " LIMIT 1"

            cursor.execute(query, params)
            row = cursor.fetchone()

            if not row:
                return jsonify({
                    "ok": False,
                    "error": {"code": "not_found", "message": "Material no encontrado"}
                }), 404

            mat = dict(row)

            # Obtener consumo historico
            cursor.execute("""
                SELECT cantidad FROM consumo_historico
                WHERE material = ?
                ORDER BY fecha DESC LIMIT 30
            """, (material_codigo,))
            consumo_rows = cursor.fetchall()
            consumo_historico = [float(r[0] if not isinstance(r, dict) else r.get('cantidad', 0)) for r in consumo_rows]

        if not consumo_historico:
            consumo_historico = [0.0] * 30

        consumo_anual = float(mat.get("consumo_anual") or 0)
        demanda_promedio = np.mean(consumo_historico) if consumo_historico else (consumo_anual / 365 if consumo_anual > 0 else 0.1)
        demanda_std = np.std(consumo_historico) if len(consumo_historico) > 1 else demanda_promedio * 0.3
        punto_pedido = float(mat.get("punto_pedido") or 0)

        rec = engine.generar_recomendacion(
            material_codigo=material_codigo,
            stock_actual=float(mat.get("stock_actual") or 0),
            rop=punto_pedido if punto_pedido > 0 else demanda_promedio * 14,
            consumo_historico=consumo_historico,
            demanda_promedio=demanda_promedio,
            demanda_std=demanda_std,
            abc_clase='A' if consumo_anual > 10000 else 'B' if consumo_anual > 1000 else 'C',
            lead_time_dias=14,
            precio_unitario=float(mat.get("precio_unitario") or 0),
            cantidad_eoq=0
        )

        rec['descripcion'] = mat.get('descripcion', '')
        rec['centro'] = mat.get('centro', centro)

        return jsonify({"ok": True, "data": rec})

    except Exception as e:
        logger.error(f"Error en recomendacion de material: {e}")
        return jsonify({"ok": False, "error": {"code": "recomendacion_error", "message": str(e)}}), 500


# ============================================================================
# Top Recomendaciones Globales (todos los centros)
# ============================================================================


@bp.route("/recomendaciones/top", methods=["GET"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def get_top_recomendaciones():
    """
    Top recomendaciones de compra globales (todos los centros).

    Query params:
        - limit: Maximo de recomendaciones (default: 10, max: 50)

    Returns:
        Top N recomendaciones ordenadas por score
    """

    from backend.core.db import get_db_connection
    from backend.services.recommendation_engine import RecommendationEngine

    limit = min(int(request.args.get("limit", 10)), 50)

    try:
        engine = RecommendationEngine()

        with get_db_connection("sap_data") as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT
                    m.codigo_material as codigo,
                    m.descripcion,
                    m.centro,
                    COALESCE(m.punto_de_pedido, 0) as punto_pedido,
                    COALESCE(m.consumo_promedio_anual, 0) as consumo_anual,
                    COALESCE(s.stock_actual, 0) as stock_actual,
                    COALESCE(s.precio_unitario, 0) as precio_unitario
                FROM materiales_bbdd m
                LEFT JOIN (
                    SELECT material, centro,
                        SUM(stock) as stock_actual,
                        AVG(precio) as precio_unitario
                    FROM stock
                    GROUP BY material, centro
                ) s ON m.codigo_material = s.material AND m.centro = s.centro
                WHERE m.consumo_promedio_anual > 0
                ORDER BY m.consumo_promedio_anual DESC
                LIMIT 500
            """)
            materiales_raw = [dict(row) for row in cursor.fetchall()]

        materiales_para_engine = []
        for mat in materiales_raw:
            consumo_anual = float(mat.get("consumo_anual") or 0)
            demanda_diaria = consumo_anual / 365 if consumo_anual > 0 else 0.1
            stock_actual = float(mat.get("stock_actual") or 0)
            punto_pedido = float(mat.get("punto_pedido") or 0)

            if consumo_anual > 0 or stock_actual > 0:
                materiales_para_engine.append({
                    'codigo': mat['codigo'],
                    'descripcion': mat.get('descripcion', ''),
                    'centro': mat.get('centro', ''),
                    'stock_actual': stock_actual,
                    'rop': punto_pedido if punto_pedido > 0 else demanda_diaria * 14,
                    'consumo_historico': [demanda_diaria] * 30,
                    'demanda_promedio': demanda_diaria,
                    'demanda_std': demanda_diaria * 0.3,
                    'abc_clase': 'A' if consumo_anual > 10000 else 'B' if consumo_anual > 1000 else 'C',
                    'lead_time_dias': 14,
                    'precio_unitario': float(mat.get("precio_unitario") or 0),
                    'cantidad_eoq': 0,
                })

        recomendaciones = engine.generar_top_recomendaciones(materiales_para_engine, limit=limit)

        # Enrich with description and centro
        mat_map = {m['codigo']: m for m in materiales_para_engine}
        for rec in recomendaciones:
            info = mat_map.get(rec['material'], {})
            rec['descripcion'] = info.get('descripcion', '')
            rec['centro'] = info.get('centro', '')

        return jsonify({
            "ok": True,
            "data": {
                "recomendaciones": recomendaciones,
                "total": len(recomendaciones),
                "materiales_evaluados": len(materiales_para_engine),
            }
        })

    except Exception as e:
        logger.error(f"Error en top recomendaciones: {e}")
        return jsonify({"ok": False, "error": {"code": "recomendaciones_error", "message": str(e)}}), 500


# ============================================================================
# Deteccion de Anomalias
# ============================================================================

@bp.route("/anomalias/<material_codigo>", methods=["POST"])
@require_auth
@rate_limit(requests=10, window_seconds=60)
def detectar_anomalias(material_codigo):
    """
    Detecta anomalias en consumo de un material.

    Path params:
        - material_codigo: Codigo del material

    Body (opcional):
        {
            "centro": "AA101",
            "dias": 90,
            "threshold": 0.5
        }

    Returns:
        Anomalias detectadas con explicaciones
    """
    import pandas as pd

    from backend.core.db import get_db_connection

    data = request.get_json() or {}
    centro = data.get("centro", "")
    dias = int(data.get("dias", 90))
    threshold = float(data.get("threshold", 0.5))

    try:
        from backend.agent.pipelines.anomaly_detection import AnomalyDetector

        db_name = "sap_data"

        with get_db_connection(db_name) as conn:
            query = "SELECT fecha, SUM(cantidad) as cantidad FROM consumo_historico WHERE material = ?"
            params = [material_codigo]

            if centro:
                query += " AND centro = ?"
                params.append(centro)

            query += " GROUP BY fecha ORDER BY fecha"

            df = pd.read_sql_query(query, conn, params=params)

        if len(df) < 5:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": f"Datos insuficientes: {len(df)} registros (minimo 5)"}
            }), 400

        detector = AnomalyDetector()
        df_anomalias, prop = detector.detectar(df)

        # Filtrar significativas
        anomalias_sig = detector.obtener_anomalias_significativas(df_anomalias, threshold_score=threshold)

        # Explicar cada anomalia
        explicaciones = []
        for _, row in anomalias_sig.head(20).iterrows():
            explicaciones.append(detector.explicar_anomalia(row, {
                'material_nombre': material_codigo,
                'centro': centro
            }))

        return jsonify({
            "ok": True,
            "data": {
                "material": material_codigo,
                "centro": centro,
                "total_registros": len(df),
                "anomalias_detectadas": int(df_anomalias['es_anomalia'].sum()),
                "proporcion_anomalias": round(float(prop), 4),
                "anomalias_significativas": len(anomalias_sig),
                "explicaciones": explicaciones,
                "periodo_analizado_dias": dias
            }
        })

    except ImportError:
        return jsonify({
            "ok": False,
            "error": {"code": "dependency_missing", "message": "sklearn es requerido para deteccion de anomalias"}
        }), 501
    except Exception as e:
        logger.error(f"Error detectando anomalias: {e}")
        return jsonify({"ok": False, "error": {"code": "anomalias_error", "message": str(e)}}), 500


# ============================================================================
# Clustering de Materiales
# ============================================================================

@bp.route("/clustering", methods=["POST"])
@require_auth
@require_role(["admin", "planner"])
@rate_limit(requests=5, window_seconds=60)
def clustering_materiales():
    """
    Agrupa materiales por similitud usando K-Means.

    Body:
        {
            "centro": "AA101",
            "n_clusters": 5,
            "limit": 200
        }

    Returns:
        Clusters con materiales asignados y caracteristicas
    """
    import numpy as np

    from backend.core.db import get_db_connection

    data = request.get_json() or {}
    centro = data.get("centro", "")
    n_clusters = min(int(data.get("n_clusters", 5)), 10)
    limit = min(int(data.get("limit", 200)), 500)

    try:
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import StandardScaler

        db_name = "sap_data"

        with get_db_connection(db_name) as conn:
            cursor = conn.cursor()

            query = """
                SELECT
                    m.codigo_material as codigo,
                    m.descripcion,
                    COALESCE(m.consumo_promedio_anual, 0) as consumo_anual,
                    COALESCE(m.stock_de_seguridad, 0) as stock_seguridad,
                    COALESCE(m.punto_de_pedido, 0) as punto_pedido,
                    COALESCE(s.stock_actual, 0) as stock_actual,
                    COALESCE(s.precio_unitario, 0) as precio_unitario
                FROM materiales_bbdd m
                LEFT JOIN (
                    SELECT material, centro,
                        SUM(stock) as stock_actual,
                        AVG(precio) as precio_unitario
                    FROM stock
                    GROUP BY material, centro
                ) s ON m.codigo_material = s.material AND m.centro = s.centro
                WHERE 1=1
            """
            params = []
            if centro:
                query += " AND m.centro = ?"
                params.append(centro)

            query += " ORDER BY m.consumo_promedio_anual DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            materiales = [dict(row) for row in cursor.fetchall()]

        if len(materiales) < n_clusters:
            return jsonify({
                "ok": False,
                "error": {"code": "insufficient_data", "message": f"Solo {len(materiales)} materiales, se necesitan al menos {n_clusters}"}
            }), 400

        # Preparar features
        features = []
        codigos = []
        descripciones = []
        for mat in materiales:
            features.append([
                float(mat.get("consumo_anual") or 0),
                float(mat.get("stock_actual") or 0),
                float(mat.get("precio_unitario") or 0),
                float(mat.get("stock_seguridad") or 0),
                float(mat.get("punto_pedido") or 0),
            ])
            codigos.append(mat['codigo'])
            descripciones.append(mat.get('descripcion', ''))

        X = np.array(features)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_scaled)

        # Organizar resultados por cluster
        clusters = {}
        for i in range(n_clusters):
            mask = labels == i
            cluster_indices = np.where(mask)[0]
            cluster_features = X[mask]

            miembros = []
            for idx in cluster_indices:
                miembros.append({
                    'codigo': codigos[idx],
                    'descripcion': descripciones[idx][:60],
                    'consumo_anual': float(features[idx][0]),
                    'stock_actual': float(features[idx][1]),
                    'precio_unitario': float(features[idx][2]),
                })

            clusters[f"cluster_{i}"] = {
                'id': i,
                'total_materiales': int(mask.sum()),
                'consumo_promedio': float(cluster_features[:, 0].mean()) if len(cluster_features) > 0 else 0,
                'precio_promedio': float(cluster_features[:, 2].mean()) if len(cluster_features) > 0 else 0,
                'stock_promedio': float(cluster_features[:, 1].mean()) if len(cluster_features) > 0 else 0,
                'miembros': miembros[:20],  # Limitar miembros por cluster
            }

        return jsonify({
            "ok": True,
            "data": {
                "centro": centro,
                "n_clusters": n_clusters,
                "total_materiales": len(materiales),
                "clusters": clusters,
                "inertia": float(kmeans.inertia_)
            }
        })

    except ImportError:
        return jsonify({
            "ok": False,
            "error": {"code": "dependency_missing", "message": "sklearn es requerido para clustering"}
        }), 501
    except Exception as e:
        logger.error(f"Error en clustering: {e}")
        return jsonify({"ok": False, "error": {"code": "clustering_error", "message": str(e)}}), 500
