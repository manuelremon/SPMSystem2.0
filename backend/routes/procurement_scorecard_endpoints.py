"""
Procurement Scorecard Endpoints
New endpoints to add to procurement.py for Sprint 39

Append these to the end of procurement.py
"""

# ============================================================================
# Provider Scorecard (Sprint 39)
# ============================================================================


@procurement_bp.route("/scorecard/<proveedor_id>", methods=["GET"])
@require_auth
def get_scorecard(proveedor_id):
    """
    Returns current + historical scorecard data for a provider.

    Query params:
        - meses: Number of months to look back (default: 12)

    Returns:
        {
            current: {calidad, entrega, precio, servicio, global},
            historial: [{periodo, scores...}],
            meta: {...}
        }
    """
    try:
        meses = request.args.get("meses", 12, type=int)
        meses = min(meses, 24)  # Max 2 years

        with get_db_connection() as conn:
            cur = conn.cursor()

            # 1. Current period evaluation (most recent)
            cur.execute("""
                SELECT calidad_score, entrega_score, precio_score, servicio_score,
                       score_global, periodo, evaluado_por, notas, created_at
                FROM proveedor_evaluacion
                WHERE proveedor_id = ?
                ORDER BY created_at DESC
                LIMIT 1
            """, (proveedor_id,))
            current_row = cur.fetchone()

            current = _row_to_dict(current_row) if current_row else {
                "calidad_score": 0,
                "entrega_score": 0,
                "precio_score": 0,
                "servicio_score": 0,
                "score_global": 0,
                "periodo": None
            }

            # 2. Historical evaluations (last N months)
            if is_postgres():
                cur.execute("""
                    SELECT periodo, calidad_score, entrega_score, precio_score,
                           servicio_score, score_global, evaluado_por, created_at
                    FROM proveedor_evaluacion
                    WHERE proveedor_id = ?
                    AND created_at >= NOW() - INTERVAL '%s months'
                    ORDER BY periodo DESC
                """, (proveedor_id, meses))
            else:
                cur.execute("""
                    SELECT periodo, calidad_score, entrega_score, precio_score,
                           servicio_score, score_global, evaluado_por, created_at
                    FROM proveedor_evaluacion
                    WHERE proveedor_id = ?
                    AND created_at >= datetime('now', '-' || ? || ' months')
                    ORDER BY periodo DESC
                """, (proveedor_id, meses))

            historial = [_row_to_dict(r) for r in cur.fetchall()]

            # 3. Metadata
            cur.execute("""
                SELECT meta_key, meta_value, updated_at
                FROM proveedor_meta
                WHERE proveedor_id = ?
            """, (proveedor_id,))
            meta_rows = cur.fetchall()

            meta = {row["meta_key"]: row["meta_value"] for row in meta_rows}

        return jsonify({
            "ok": True,
            "proveedor_id": proveedor_id,
            "current": current,
            "historial": historial,
            "meta": meta
        })

    except Exception as e:
        logger.error(f"Error obteniendo scorecard de proveedor {proveedor_id}: {e}")
        return jsonify({"error": "Error al obtener scorecard"}), 500


@procurement_bp.route("/scorecard/<proveedor_id>/evaluar", methods=["POST"])
@require_auth
@require_role(["Admin", "Administrador"])
def evaluar_proveedor(proveedor_id):
    """
    Manual evaluation of a provider.

    JSON body:
        {
            calidad_score: float (0-100),
            entrega_score: float (0-100),
            precio_score: float (0-100),
            servicio_score: float (0-100),
            notas: str (optional)
        }

    Returns:
        Created evaluation record
    """
    try:
        from backend.core.helpers import _get_user_id

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        calidad = float(data.get("calidad_score", 0))
        entrega = float(data.get("entrega_score", 0))
        precio = float(data.get("precio_score", 0))
        servicio = float(data.get("servicio_score", 0))
        notas = data.get("notas", "").strip()

        # Validate scores
        for score in [calidad, entrega, precio, servicio]:
            if not (0 <= score <= 100):
                return jsonify({"error": "Scores must be between 0 and 100"}), 400

        # Calculate weighted global score
        # entrega 35%, calidad 30%, precio 20%, servicio 15%
        score_global = round(
            entrega * 0.35 + calidad * 0.30 + precio * 0.20 + servicio * 0.15, 2
        )

        # Get current period (YYYY-MM)
        from datetime import datetime
        periodo = datetime.utcnow().strftime("%Y-%m")

        # Get provider name
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT proveedor_nombre FROM sap_purchase_orders
                WHERE proveedor_cuit = ?
                LIMIT 1
            """, (proveedor_id,))
            row = cur.fetchone()
            proveedor_nombre = row["proveedor_nombre"] if row else None

        user_id = _get_user_id()

        # Insert evaluation
        with get_db_transaction() as conn:
            cur = conn.cursor()

            if is_postgres():
                cur.execute("""
                    INSERT INTO proveedor_evaluacion
                    (proveedor_id, proveedor_nombre, periodo, calidad_score, entrega_score,
                     precio_score, servicio_score, score_global, evaluado_por, notas)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (proveedor_id, proveedor_nombre, periodo, calidad, entrega, precio,
                      servicio, score_global, user_id, notas))
                eval_id = cur.fetchone()["id"]
            else:
                cur.execute("""
                    INSERT INTO proveedor_evaluacion
                    (proveedor_id, proveedor_nombre, periodo, calidad_score, entrega_score,
                     precio_score, servicio_score, score_global, evaluado_por, notas)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (proveedor_id, proveedor_nombre, periodo, calidad, entrega, precio,
                      servicio, score_global, user_id, notas))
                eval_id = cur.lastrowid

            # Fetch created record
            cur.execute("SELECT * FROM proveedor_evaluacion WHERE id = ?", (eval_id,))
            result = _row_to_dict(cur.fetchone())

        logger.info(f"Provider {proveedor_id} evaluated by user {user_id}: score={score_global}")

        return jsonify({
            "ok": True,
            "evaluacion": result
        })

    except ValueError as e:
        return jsonify({"error": f"Invalid score value: {str(e)}"}), 400
    except Exception as e:
        logger.error(f"Error evaluando proveedor {proveedor_id}: {e}")
        return jsonify({"error": "Error al evaluar proveedor"}), 500


@procurement_bp.route("/scorecard/ranking", methods=["GET"])
@require_auth
def scorecard_ranking():
    """
    Returns ranked list of providers by score_global.

    Query params:
        - periodo: Filter by period YYYY-MM (default: current month)
        - limit: Max results (default: 20, max: 100)

    Returns:
        {
            ok: true,
            ranking: [{proveedor_id, nombre, scores, tendencia}]
        }
    """
    try:
        from datetime import datetime

        periodo_filter = request.args.get("periodo")
        if not periodo_filter:
            periodo_filter = datetime.utcnow().strftime("%Y-%m")

        limit = min(request.args.get("limit", 20, type=int), 100)

        with get_db_connection() as conn:
            cur = conn.cursor()

            # Get evaluations for specified period
            cur.execute("""
                SELECT proveedor_id, proveedor_nombre, periodo,
                       calidad_score, entrega_score, precio_score, servicio_score,
                       score_global, created_at
                FROM proveedor_evaluacion
                WHERE periodo = ?
                ORDER BY score_global DESC
                LIMIT ?
            """, (periodo_filter, limit))
            current_evals = cur.fetchall()

            # Get previous period for tendencia
            # Extract year and month, subtract 1 month
            year, month = map(int, periodo_filter.split("-"))
            if month == 1:
                prev_year, prev_month = year - 1, 12
            else:
                prev_year, prev_month = year, month - 1
            periodo_anterior = f"{prev_year:04d}-{prev_month:02d}"

            ranking = []
            for row in current_evals:
                current = _row_to_dict(row)
                proveedor_id = current.get("proveedor_id")

                # Get previous period score for tendencia
                cur.execute("""
                    SELECT score_global FROM proveedor_evaluacion
                    WHERE proveedor_id = ? AND periodo = ?
                    LIMIT 1
                """, (proveedor_id, periodo_anterior))
                prev_row = cur.fetchone()

                tendencia = None
                if prev_row:
                    prev_score = prev_row["score_global"]
                    diff = current["score_global"] - prev_score
                    if diff > 1:
                        tendencia = "up"
                    elif diff < -1:
                        tendencia = "down"
                    else:
                        tendencia = "stable"

                ranking.append({
                    "proveedor_id": proveedor_id,
                    "proveedor_nombre": current.get("proveedor_nombre"),
                    "calidad_score": current.get("calidad_score"),
                    "entrega_score": current.get("entrega_score"),
                    "precio_score": current.get("precio_score"),
                    "servicio_score": current.get("servicio_score"),
                    "score_global": current.get("score_global"),
                    "tendencia": tendencia
                })

        return jsonify({
            "ok": True,
            "periodo": periodo_filter,
            "ranking": ranking
        })

    except Exception as e:
        logger.error(f"Error obteniendo ranking de scorecard: {e}")
        return jsonify({"error": "Error al obtener ranking"}), 500
