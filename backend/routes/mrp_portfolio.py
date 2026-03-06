"""
MRP Portfolio endpoint.
Returns materials planned by MRP with their planning parameters.
"""

import logging

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection
from backend.core.helpers import safe_error_response
from backend.core.roles import require_auth
from backend.core.search_utils import build_description_search_with_catalog

logger = logging.getLogger(__name__)

bp = Blueprint("mrp_portfolio", __name__, url_prefix="/api/mrp")


@bp.route("/portfolio", methods=["GET"])
@require_auth
def get_mrp_portfolio():
    """
    Get MRP portfolio - materials with MRP planning parameters.

    Query params:
    - centro: filter by plant code
    - almacen: filter by warehouse code
    - sector: filter by sector
    - material: filter by material code (partial match)
    - descripcion: filter by description (partial match)
    - limit: max results (default 500, max 2000)
    - offset: pagination offset

    Returns:
    {
        ok: true,
        data: [{
            codigo_material, descripcion, centro, almacen, sector,
            stock_de_seguridad, punto_de_pedido, stock_maximo
        }],
        total: count,
        filtros: {centros: [], almacenes: [], sectores: []}
    }
    """
    # Get query params
    centro = request.args.get("centro", "").strip()
    almacen = request.args.get("almacen", "").strip()
    sector = request.args.get("sector", "").strip()
    material = request.args.get("material", "").strip()
    descripcion = request.args.get("descripcion", "").strip()
    limit = min(int(request.args.get("limit", 500)), 2000)
    offset = int(request.args.get("offset", 0))

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            # Build WHERE clauses - only include materials with MRP params
            where_clauses = ["(punto_de_pedido > 0 OR stock_de_seguridad > 0 OR stock_maximo > 0)"]
            params = []

            if centro:
                where_clauses.append("centro = ?")
                params.append(centro)

            if almacen:
                where_clauses.append("almacen = ?")
                params.append(almacen)

            if sector:
                where_clauses.append("sector = ?")
                params.append(sector)

            if material:
                where_clauses.append("codigo_material LIKE ?")
                params.append(f"%{material}%")

            if descripcion:
                search = build_description_search_with_catalog(
                    descripcion, ["descripcion"], "codigo_material"
                )
                if search:
                    where_clauses.append(search.where_clause)
                    params.extend(search.params)

            where_sql = " AND ".join(where_clauses)

            # Get total count
            count_query = f"SELECT COUNT(*) as total FROM materiales_bbdd WHERE {where_sql}"
            cur.execute(count_query, params)
            total = cur.fetchone()["total"]

            # Get paginated results
            query = f"""
                SELECT
                    codigo_material,
                    descripcion,
                    centro,
                    almacen,
                    sector,
                    COALESCE(stock_de_seguridad, 0) as stock_de_seguridad,
                    COALESCE(punto_de_pedido, 0) as punto_de_pedido,
                    COALESCE(stock_maximo, 0) as stock_maximo
                FROM materiales_bbdd
                WHERE {where_sql}
                ORDER BY centro, almacen, codigo_material
                LIMIT {limit} OFFSET {offset}
            """
            cur.execute(query, params)

            results = [dict(row) for row in cur.fetchall()]

            # Get filter options
            cur.execute("""
                SELECT DISTINCT centro FROM materiales_bbdd
                WHERE punto_de_pedido > 0 OR stock_de_seguridad > 0 OR stock_maximo > 0
                ORDER BY centro
            """)
            centros = [row["centro"] for row in cur.fetchall()]

            cur.execute("""
                SELECT DISTINCT almacen FROM materiales_bbdd
                WHERE punto_de_pedido > 0 OR stock_de_seguridad > 0 OR stock_maximo > 0
                ORDER BY almacen
            """)
            almacenes = [row["almacen"] for row in cur.fetchall()]

            cur.execute("""
                SELECT DISTINCT sector FROM materiales_bbdd
                WHERE (punto_de_pedido > 0 OR stock_de_seguridad > 0 OR stock_maximo > 0)
                AND sector IS NOT NULL AND sector != ''
                ORDER BY sector
            """)
            sectores = [row["sector"] for row in cur.fetchall()]

            return jsonify({
                "ok": True,
                "data": results,
                "total": total,
                "filtros": {
                    "centros": centros,
                    "almacenes": almacenes,
                    "sectores": sectores
                }
            })

    except Exception as e:
        return safe_error_response(e, logger, context="mrp_portfolio.get_mrp_portfolio")
