import json
from typing import Any, Dict, List, Optional

from flask import Blueprint, jsonify, request

from backend.core.db import get_db_connection

bp_detalle = Blueprint("materiales_detalle", __name__, url_prefix="/api/materiales")

# Caches para datos de sap_data.db
_STOCK_CACHE: Optional[List[Dict[str, Any]]] = None
_PEDIDOS_CACHE: Optional[List[Dict[str, Any]]] = None
_MRP_CACHE: Optional[List[Dict[str, Any]]] = None
_CONSUMO_CACHE: Optional[List[Dict[str, Any]]] = None


def _normalize_code(val: str) -> str:
    """Normaliza código para comparación: quita ceros a la izquierda"""
    return (str(val) if val else "").strip().lstrip("0")


# =============================================================================
# FUNCIONES OPTIMIZADAS (PERF-004): Consultas SQL con filtros
# =============================================================================


def _get_stock_filtrado(
    codigo: str, centro: str = None, almacen: str = None
) -> List[Dict[str, Any]]:
    """
    OPTIMIZACIÓN PERF-004: Consulta stock filtrado directamente en SQL.
    Evita cargar los 150,000 registros en memoria.
    """
    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            params = [f"%{_normalize_code(codigo)}%"]
            where_sql = "WHERE material LIKE ? AND stock > 0"

            if centro:
                where_sql += " AND centro = ?"
                params.append(centro)
            if almacen:
                where_sql += " AND almacen = ?"
                params.append(almacen)

            cur.execute(
                f"""
                SELECT material as codigo, centro, almacen, lote, stock
                FROM stock
                {where_sql}
                """,
                params,
            )
            return [dict(row) for row in cur.fetchall()]
    except Exception:
        return []


def _get_consumo_filtrado(codigo: str, centro: str = None, almacen: str = None) -> Dict[str, Any]:
    """
    OPTIMIZACIÓN PERF-004: Consulta consumo agregado directamente en SQL.
    Retorna totales y registros recientes sin cargar todo en memoria.
    """
    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            params = [f"%{_normalize_code(codigo)}%"]
            where_sql = "WHERE material LIKE ?"

            if centro:
                where_sql += " AND centro = ?"
                params.append(centro)
            if almacen:
                where_sql += " AND almacen = ?"
                params.append(almacen)

            # Query agregada
            cur.execute(
                f"""
                SELECT
                    COALESCE(SUM(cantidad), 0) as total,
                    MIN(substr(fecha, 1, 4)) as anio_min,
                    MAX(substr(fecha, 1, 4)) as anio_max
                FROM consumo_historico
                {where_sql}
                AND fecha IS NOT NULL
                """,
                params,
            )
            agg_row = cur.fetchone()

            if not agg_row or agg_row["total"] == 0:
                return None

            total = float(agg_row["total"])
            anio_min = int(agg_row["anio_min"]) if agg_row["anio_min"] else None
            anio_max = int(agg_row["anio_max"]) if agg_row["anio_max"] else None

            promedio = None
            if anio_min and anio_max and anio_min > 2000:
                n_anios = max(1, anio_max - anio_min + 1)
                promedio = total / n_anios

            # Obtener últimos 5 registros
            cur.execute(
                f"""
                SELECT fecha, cantidad, centro, almacen
                FROM consumo_historico
                {where_sql}
                AND fecha IS NOT NULL
                ORDER BY fecha DESC
                LIMIT 5
                """,
                params,
            )
            registros = [
                {
                    "fecha": row["fecha"][:10] if row["fecha"] else "",
                    "cantidad": float(row["cantidad"] or 0),
                    "centro": row["centro"],
                    "almacen": row["almacen"],
                }
                for row in cur.fetchall()
            ]

            return {
                "total": total,
                "promedio_anual": promedio,
                "anio_desde": anio_min,
                "anio_hasta": anio_max,
                "registros": registros,
            }

    except Exception:
        return None


def _get_consumo_por_ubicacion(codigo: str) -> List[Dict[str, Any]]:
    """
    Obtiene consumo histórico agrupado por Centro/Almacén con promedio anual.
    Retorna lista de ubicaciones con sus consumos.
    """
    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            # Query agrupada por centro, almacen con promedio anual
            cur.execute(
                """
                SELECT
                    centro,
                    almacen,
                    COALESCE(SUM(cantidad), 0) as total,
                    MIN(substr(fecha, 1, 4)) as anio_min,
                    MAX(substr(fecha, 1, 4)) as anio_max,
                    COUNT(DISTINCT substr(fecha, 1, 4)) as n_anios
                FROM consumo_historico
                WHERE material LIKE ?
                AND fecha IS NOT NULL
                GROUP BY centro, almacen
                ORDER BY centro, almacen
                """,
                (f"%{_normalize_code(codigo)}%",),
            )
            rows = cur.fetchall()

            result = []
            for row in rows:
                total = float(row["total"] or 0)
                anio_min = int(row["anio_min"]) if row["anio_min"] else None
                anio_max = int(row["anio_max"]) if row["anio_max"] else None
                n_anios = int(row["n_anios"]) if row["n_anios"] else 1

                # Calcular promedio anual
                promedio_anual = total / max(1, n_anios) if total > 0 else 0

                result.append(
                    {
                        "centro": row["centro"],
                        "almacen": row["almacen"],
                        "total": total,
                        "promedio_anual": round(promedio_anual, 2),
                        "anio_desde": anio_min,
                        "anio_hasta": anio_max,
                        "n_anios": n_anios,
                    }
                )

            return result
    except Exception:
        return []


def _load_stock() -> List[Dict[str, Any]]:
    """Carga stock desde sap_data.db tabla 'stock'"""
    global _STOCK_CACHE
    if _STOCK_CACHE is not None:
        return _STOCK_CACHE

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT material as codigo, centro, almacen, lote, stock
                FROM stock
                WHERE stock > 0
            """
            )
            rows = [dict(row) for row in cur.fetchall()]
        _STOCK_CACHE = rows
        return _STOCK_CACHE
    except Exception:
        _STOCK_CACHE = []
        return _STOCK_CACHE


def _load_pedidos() -> List[Dict[str, Any]]:
    """Carga pedidos en curso desde sap_data.db tabla 'pedidos_sap'"""
    global _PEDIDOS_CACHE
    if _PEDIDOS_CACHE is not None:
        return _PEDIDOS_CACHE

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT material as codigo, centro, almacen, saldo_pend as saldo
                FROM pedidos_sap
                WHERE saldo_pend > 0
            """
            )
            rows = [dict(row) for row in cur.fetchall()]
        _PEDIDOS_CACHE = rows
        return _PEDIDOS_CACHE
    except Exception:
        _PEDIDOS_CACHE = []
        return _PEDIDOS_CACHE


def _load_mrp() -> List[Dict[str, Any]]:
    """Carga parámetros MRP desde sap_data.db tabla 'materiales_bbdd'"""
    global _MRP_CACHE
    if _MRP_CACHE is not None:
        return _MRP_CACHE

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT
                    codigo_material as codigo,
                    centro,
                    almacen,
                    sector,
                    stock_de_seguridad as stock_seguridad,
                    punto_de_pedido as punto_pedido,
                    stock_maximo
                FROM materiales_bbdd
            """
            )
            rows = [dict(row) for row in cur.fetchall()]
        _MRP_CACHE = rows
        return _MRP_CACHE
    except Exception:
        _MRP_CACHE = []
        return _MRP_CACHE


def _load_consumo() -> List[Dict[str, Any]]:
    """Carga consumo histórico desde sap_data.db tabla 'consumo_historico'"""
    global _CONSUMO_CACHE
    if _CONSUMO_CACHE is not None:
        return _CONSUMO_CACHE

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT
                    material as codigo,
                    centro,
                    almacen,
                    cantidad,
                    fecha,
                    descripcion
                FROM consumo_historico
                ORDER BY fecha DESC
            """
            )
            rows = [dict(row) for row in cur.fetchall()]
        _CONSUMO_CACHE = rows
        return _CONSUMO_CACHE
    except Exception:
        _CONSUMO_CACHE = []
        return _CONSUMO_CACHE


@bp_detalle.route("/<codigo>/detalle", methods=["GET"])
def detalle_material(codigo):
    """
    Obtiene detalle completo de un material: stock, pedidos, MRP y consumo.
    Ahora usa sap_data.db en lugar de archivos Excel.
    """
    codigo = str(codigo)
    centro_param = (request.args.get("centro") or "").strip()
    almacen_param = (request.args.get("almacen") or "").strip()
    detalle = _detalle_db(codigo)

    stock_total = 0.0
    stock_detalle = []
    stock_detalle_full = []
    pedidos_total = 0.0
    mrp_data = None
    mrp_list = []  # Lista completa de parámetros MRP por centro/almacén
    consumo_data = None

    codigo_norm = _normalize_code(codigo)
    centro_norm = _normalize_code(centro_param) if centro_param else None
    almacen_norm = _normalize_code(almacen_param) if almacen_param else None

    # === STOCK === (OPTIMIZADO PERF-004: consulta SQL directa)
    # Primero obtenemos todo el stock del material para stock_detalle_full
    stock_rows_all = _get_stock_filtrado(codigo)
    for row in stock_rows_all:
        stock_val = float(row.get("stock") or 0)
        stock_detalle_full.append(
            {
                "centro": row.get("centro"),
                "almacen_consultado": row.get("almacen"),
                "lote": row.get("lote") or "",
                "stock": stock_val,
            }
        )

    # Luego obtenemos stock filtrado por centro/almacen para stock_detalle
    stock_rows = _get_stock_filtrado(codigo, centro_param or None, almacen_param or None)
    for row in stock_rows:
        row_almacen_norm = _normalize_code(row.get("almacen", ""))
        stock_val = float(row.get("stock") or 0)

        # Match para stock total
        matches_almacen = almacen_norm is None or row_almacen_norm == almacen_norm
        if matches_almacen:
            stock_total += stock_val

        stock_detalle.append(
            {
                "centro": row.get("centro"),
                "almacen_consultado": row.get("almacen"),
                "lote": row.get("lote") or "",
                "stock": stock_val,
            }
        )

    # === PEDIDOS EN CURSO ===
    pedidos_rows = _load_pedidos()
    if pedidos_rows:
        for row in pedidos_rows:
            row_codigo_norm = _normalize_code(row.get("codigo", ""))
            if row_codigo_norm != codigo_norm:
                continue

            row_centro_norm = _normalize_code(row.get("centro", ""))
            row_almacen_norm = _normalize_code(row.get("almacen", ""))

            matches = True
            if centro_norm and row_centro_norm != centro_norm:
                matches = False
            if almacen_norm and row_almacen_norm != almacen_norm:
                matches = False

            if matches:
                pedidos_total += float(row.get("saldo") or 0)

    # === PARÁMETROS MRP ===
    mrp_rows = _load_mrp()
    if mrp_rows:
        for row in mrp_rows:
            row_codigo_norm = _normalize_code(row.get("codigo", ""))
            if row_codigo_norm != codigo_norm:
                continue

            # Agregar a la lista completa de MRP
            mrp_item = {
                "planificado_mrp": True,
                "sector": row.get("sector"),
                "stock_seguridad": float(row.get("stock_seguridad") or 0),
                "punto_pedido": float(row.get("punto_pedido") or 0),
                "stock_maximo": float(row.get("stock_maximo") or 0),
                "centro": row.get("centro"),
                "almacen": row.get("almacen"),
            }
            mrp_list.append(mrp_item)

            # Mantener mrp_data para compatibilidad (filtrado por centro/almacen)
            row_centro_norm = _normalize_code(row.get("centro", ""))
            row_almacen_norm = _normalize_code(row.get("almacen", ""))

            matches = True
            if centro_norm and row_centro_norm != centro_norm:
                matches = False
            if almacen_norm and row_almacen_norm != almacen_norm:
                matches = False

            if matches and mrp_data is None:
                mrp_data = mrp_item

    # === CONSUMO HISTÓRICO === (OPTIMIZADO PERF-004: consulta SQL directa)
    # Obtener consumo por ubicación (centro/almacen) con promedio anual
    consumo_list = _get_consumo_por_ubicacion(codigo)

    # Intentar con filtros completos primero
    if centro_param or almacen_param:
        consumo_data = _get_consumo_filtrado(codigo, centro_param or None, almacen_param or None)

    # Fallback: solo centro
    if consumo_data is None and centro_param:
        consumo_data = _get_consumo_filtrado(codigo, centro_param, None)

    # Fallback: global por material
    if consumo_data is None:
        consumo_data = _get_consumo_filtrado(codigo, None, None)

    # Construir respuesta
    detalle.update(
        {
            "stock_total": stock_total,
            "stock_detalle": stock_detalle,
            "stock_detalle_full": stock_detalle_full,
            "pedidos_en_curso": pedidos_total,
            "centro_consultado": centro_param or None,
            "almacen_consultado": almacen_param or None,
            "mrp": mrp_data
            or {
                "planificado_mrp": False,
                "stock_seguridad": None,
                "punto_pedido": None,
                "stock_maximo": None,
                "sector": None,
            },
            "mrp_list": mrp_list,  # Lista completa de parámetros MRP por centro/almacén
            "consumo": consumo_data
            or {
                "total": 0,
                "promedio_anual": None,
                "anio_desde": None,
                "anio_hasta": None,
                "registros": [],
            },
            "consumo_list": consumo_list,  # Lista de consumo por centro/almacén con promedio anual
        }
    )
    return jsonify(detalle), 200


def _detalle_db(codigo: str) -> dict:
    """Obtiene detalle de un material desde cat_materiales (PostgreSQL) o catalogo_materiales.db (SQLite)."""
    try:
        with get_db_connection("catalogo_materiales") as conn:
            cur = conn.cursor()
            # En PostgreSQL usa cat_materiales, en SQLite usa materiales
            from core.db import is_using_postgresql
            tabla = "cat_materiales" if is_using_postgresql() else "materiales"
            cur.execute(
                f"SELECT codigo, descripcion, descripcion_larga, unidad_medida, precio_usd FROM {tabla} WHERE codigo=?",
                (codigo,),
            )
            row = cur.fetchone()

        if not row:
            return {}
        # Mapear unidad_medida a unidad para compatibilidad
        result = dict(row)
        result["unidad"] = result.pop("unidad_medida", "UN")
        return result
    except Exception:
        return {}


@bp_detalle.route("/<codigo>/solicitudes", methods=["GET"])
def solicitudes_por_material(codigo):
    """
    Obtiene las solicitudes SPM activas que contienen un material específico.

    Busca en el campo data_json de solicitudes para encontrar las que
    incluyen el código de material dado.

    Query params:
        limit: Número máximo de resultados (default 20)
    """
    limit = min(int(request.args.get("limit", 20)), 50)
    codigo = str(codigo).strip()

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # Estados activos de solicitudes
            estados_activos = ["submitted", "approved", "processing"]

            # Buscar solicitudes con el material en data_json
            cursor.execute(
                """
                SELECT
                    s.id,
                    s.status,
                    s.created_at,
                    s.data_json,
                    u.nombre as solicitante_nombre
                FROM solicitudes s
                LEFT JOIN usuarios u ON s.id_usuario = u.id_spm
                WHERE s.status = ANY(%s)
                ORDER BY s.created_at DESC
            """,
                (estados_activos,),
            )
            rows = cursor.fetchall()

        solicitudes_con_material = []

        for row in rows:
            try:
                data = json.loads(row["data_json"] or "{}")
                items = data.get("items", [])

                # Buscar si el material está en esta solicitud
                cantidad_solicitada = 0
                material_encontrado = False

                for item in items:
                    item_codigo = str(item.get("codigo") or item.get("codigo_sap", "")).strip()
                    # Comparar normalizando (sin ceros a la izquierda)
                    if item_codigo.lstrip("0") == codigo.lstrip("0") or item_codigo == codigo:
                        material_encontrado = True
                        cantidad_solicitada += float(item.get("cantidad", 0) or 0)

                if material_encontrado:
                    solicitudes_con_material.append(
                        {
                            "id": row["id"],
                            "estado": row["status"],
                            "fecha": row["created_at"],
                            "solicitante": row["solicitante_nombre"] or "Sin nombre",
                            "cantidad_solicitada": cantidad_solicitada,
                            "centro": data.get("centro"),
                            "sector": data.get("sector"),
                        }
                    )

                    if len(solicitudes_con_material) >= limit:
                        break

            except (json.JSONDecodeError, TypeError):
                continue

        return jsonify(
            {
                "ok": True,
                "codigo": codigo,
                "solicitudes": solicitudes_con_material,
                "total": len(solicitudes_con_material),
            }
        )

    except Exception as e:
        return jsonify({"ok": False, "error": {"code": "db_error", "message": str(e)}}), 500
