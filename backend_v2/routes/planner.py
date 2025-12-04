import json
import sqlite3
from pathlib import Path

import pandas as pd
from flask import Blueprint, jsonify, request

try:
    from backend_v2.core.config import settings
    from backend_v2.core.errors import (api_error, error_forbidden,
                                        error_internal, error_not_found,
                                        error_validation)
    from backend_v2.core.schemas import (ResultadoPaso1, ResultadoPaso2,
                                         ResultadoPaso3)
    from backend_v2.core.services.planner_service import (
        paso_1_analizar_solicitud, paso_2_opciones_abastecimiento,
        paso_3_guardar_tratamiento)
    from backend_v2.routes.auth import _decode_token
except ImportError:
    from core.config import settings
    from core.errors import (error_forbidden, error_internal, error_not_found,
                             error_validation)
    from core.services.planner_service import (paso_1_analizar_solicitud,
                                               paso_2_opciones_abastecimiento,
                                               paso_3_guardar_tratamiento)
    from routes.auth import _decode_token

# Blueprint histórico (/api/planner) con dashboard simple
planner_bp = Blueprint("planner", __name__)


# Blueprint nuevo para gestión planificador
bp = Blueprint("planner_api", __name__, url_prefix="/api/planificador")

_STOCK_XLS_CACHE = None
_EQUIV_XLS_CACHE = None
_CONSUMO_XLS_CACHE = None


def _db_path() -> Path:
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _connect():
    return sqlite3.connect(_db_path())


def _table_exists(conn, name: str) -> bool:
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cur.fetchone() is not None


@bp.route("/dashboard", methods=["GET"])
def dashboard_stats():
    """Estadísticas para el dashboard del planificador/admin"""
    stats = {
        "total_solicitudes": 0,
        "en_aprobacion": 0,
        "en_planificacion": 0,
        "presupuesto_disponible": 0,
    }
    conn = _connect()
    try:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        if _table_exists(conn, "solicitudes"):
            cur.execute("SELECT status, COUNT(*) FROM solicitudes GROUP BY status")
            counts = {row[0]: row[1] for row in cur.fetchall() or []}
            stats["total_solicitudes"] = int(sum(counts.values()))
            stats["en_aprobacion"] = int(
                counts.get("En Progreso", 0)
                + counts.get("Enviada", 0)
                + counts.get("En Aprobación", 0)
                + counts.get("En aprobacion", 0)
            )
            stats["en_planificacion"] = int(
                counts.get("Aprobada", 0)
                + counts.get("En tratamiento", 0)
                + counts.get("Tratado", 0)
            )

        if _table_exists(conn, "presupuestos"):
            cur.execute("SELECT SUM(saldo_usd) FROM presupuestos")
            total_saldo = cur.fetchone()
            stats["presupuesto_disponible"] = float(total_saldo[0] or 0) if total_saldo else 0.0

        return jsonify({"ok": True, "data": stats}), 200
    except Exception as exc:
        return (
            jsonify({"ok": False, "error": {"code": "dashboard_error", "message": str(exc)}}),
            500,
        )
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _get_user(user_id: str):
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM usuarios WHERE id_spm=?", (str(user_id),))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)


def _current_user():
    payload = _decode_token("access", "spm_token")
    if isinstance(payload, tuple):
        return payload
    user = _get_user(payload.get("user_id"))
    if not user:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {"code": "user_not_found", "message": "Usuario no encontrado"},
                }
            ),
            404,
        )
    return user


def _require_planner_role(user: dict):
    """
    Verifica que el usuario tenga rol de planificador o administrador.

    Returns:
        tuple: (error_response, is_admin)
            - (None, True) si es admin
            - (None, False) si es planificador
            - (error_response, False) si no tiene permisos
    """
    user_rol = user.get("rol", "")

    # Parsear roles (puede ser string simple o JSON array)
    roles = []
    if isinstance(user_rol, str):
        if user_rol.startswith("["):
            try:
                parsed = json.loads(user_rol)
                roles = parsed if isinstance(parsed, list) else [user_rol]
            except Exception:
                roles = [user_rol]
        else:
            roles = [user_rol]

    # Verificar si es Admin (tiene acceso total)
    is_admin = any("admin" in str(r).lower() for r in roles)
    if is_admin:
        return None, True

    # Verificar si es Planificador
    is_planner = any("planificador" in str(r).lower() or "planner" in str(r).lower() for r in roles)
    if is_planner:
        return None, False

    return error_forbidden("Rol requerido: planificador o administrador"), False


def _require_solicitud_access(solicitud_id: int):
    user = _current_user()
    if isinstance(user, tuple):
        return user, None
    guard, is_admin = _require_planner_role(user)
    if guard:
        return guard, None
    if is_admin:
        return None, user
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT planner_id FROM solicitudes WHERE id=?", (solicitud_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return error_not_found("Solicitud", solicitud_id), None
    planner_id = (row["planner_id"] or "").strip()
    if planner_id and planner_id != str(
        user.get("id_spm") or user.get("usuario") or user.get("id")
    ):
        return error_forbidden("No tiene permiso para operar esta solicitud"), None
    return None, user


def _norm_codigo(val: str) -> str:
    base = (val or "").strip()
    if base.endswith(".0"):
        base = base[:-2]
    return base.lstrip("0")


def _load_stock_xlsx():
    """Lee stock de backend_v2/stock.xlsx para validar equivalencias con stock."""
    global _STOCK_XLS_CACHE
    if _STOCK_XLS_CACHE is not None:
        return _STOCK_XLS_CACHE
    path = Path("backend_v2/stock.xlsx")
    if not path.exists():
        _STOCK_XLS_CACHE = pd.DataFrame()
        return _STOCK_XLS_CACHE
    df = pd.read_excel(path, dtype=str)
    df = df.rename(
        columns={
            "Material": "codigo",
            "Centro": "centro",
            "Almac\u00e9n": "almacen",
            "Stock": "stock",
        }
    )
    df["stock"] = pd.to_numeric(df.get("stock", 0), errors="coerce").fillna(0)
    df["codigo_norm"] = df["codigo"].astype(str).map(_norm_codigo)
    df["centro_norm"] = df["centro"].astype(str).map(_norm_codigo)
    df["almacen_norm"] = df["almacen"].astype(str).map(_norm_codigo)
    _STOCK_XLS_CACHE = df
    return _STOCK_XLS_CACHE


def _load_equivalencias_catalogo():
    """Carga equivalencias desde docs/equivalencias_total_normalizado.xlsx"""
    global _EQUIV_XLS_CACHE
    if _EQUIV_XLS_CACHE is not None:
        return _EQUIV_XLS_CACHE
    path = Path("docs/equivalencias_total_normalizado.xlsx")
    if not path.exists():
        _EQUIV_XLS_CACHE = pd.DataFrame()
        return _EQUIV_XLS_CACHE
    df = pd.read_excel(path, sheet_name="Sheet1")
    df = df.rename(
        columns={
            "Material_base": "codigo_base",
            "Texto_breve_base": "descripcion_base",
            "Material_equivalente": "codigo_equivalente",
            "Texto_breve_equivalente": "descripcion_equivalente",
            "Tipo_equiv": "tipo_equiv",
            "Criterio": "criterio",
            "Motivo_equivalencia": "motivo",
        }
    )
    df["codigo_base_norm"] = df["codigo_base"].astype(str).map(_norm_codigo)
    df["codigo_equivalente_norm"] = df["codigo_equivalente"].astype(str).map(_norm_codigo)
    _EQUIV_XLS_CACHE = df
    return _EQUIV_XLS_CACHE


def _stock_disponible(codigo: str, centro: str = None, almacen: str = None, stock_df=None) -> float:
    """Obtiene stock disponible priorizando tabla stock_almacenes; cae a XLS si no existe."""
    try:
        conn = _connect()
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_almacenes'")
        if cur.fetchone():
            params = [_norm_codigo(codigo)]
            sql = "SELECT COALESCE(SUM(cantidad),0) FROM stock_almacenes WHERE codigo_material = ?"
            if centro:
                sql += " AND centro = ?"
                params.append(centro)
            if almacen:
                sql += " AND almacen = ?"
                params.append(almacen)
            cur.execute(sql, params)
            row = cur.fetchone()
            conn.close()
            if row is not None:
                return float(row[0] or 0)
        else:
            conn.close()
    except Exception:
        try:
            conn.close()
        except Exception:
            pass

    # Fallback XLS
    sdf = stock_df if stock_df is not None else _load_stock_xlsx()
    if sdf is None or sdf.empty:
        return 0.0
    mask = sdf["codigo_norm"] == _norm_codigo(codigo)
    if centro:
        mask = mask & (sdf["centro_norm"] == _norm_codigo(centro))
    if almacen:
        mask = mask & (sdf["almacen_norm"] == _norm_codigo(almacen))
    return float(sdf.loc[mask, "stock"].sum())


def _rankear_proveedores(cur, cantidad: float, precio_unitario: float):
    """Retorna proveedores ordenados por score (costo+plazo+rating)."""
    cur.execute(
        """
        SELECT id_proveedor, nombre, plazo_entrega_dias, rating
        FROM proveedores
        WHERE tipo = 'externo' AND activo = 1
        """
    )
    proveedores = cur.fetchall() or []
    ranked = []
    for prov in proveedores:
        plazo = prov["plazo_entrega_dias"] or 0
        rating = prov["rating"] or 0
        costo_total = (precio_unitario or 0) * (cantidad or 0)
        score = (
            (100 / (1 + costo_total)) * 0.4 + (100 / (1 + plazo)) * 0.4 + (rating / 5 * 100) * 0.2
        )
        ranked.append({**dict(prov), "score": score, "costo_total": costo_total})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked


def _load_consumo_stock():
    """Carga consumo histórico para calcular promedio por centro/almacén."""
    global _CONSUMO_XLS_CACHE
    if _CONSUMO_XLS_CACHE is not None:
        return _CONSUMO_XLS_CACHE
    path = Path("docs/consumo historico.xlsx")
    if not path.exists():
        _CONSUMO_XLS_CACHE = pd.DataFrame()
        return _CONSUMO_XLS_CACHE
    df = pd.read_excel(path, sheet_name="consumo historico")
    df = df.rename(
        columns={
            "Material": "codigo",
            "Centro": "centro",
            "Almacen": "almacen",
            "Cantidad": "cantidad",
            "Fecha": "fecha",
            "Descripcion": "descripcion",
        }
    )
    df["cantidad"] = pd.to_numeric(df.get("cantidad", 0), errors="coerce").fillna(0)
    df["fecha"] = pd.to_datetime(df.get("fecha"), errors="coerce")
    df["codigo_norm"] = df["codigo"].astype(str).map(_norm_codigo)
    df["centro_norm"] = df["centro"].astype(str).map(_norm_codigo)
    df["almacen_norm"] = df["almacen"].astype(str).map(_norm_codigo)
    _CONSUMO_XLS_CACHE = df
    return _CONSUMO_XLS_CACHE


def _stock_detalle(codigo: str, centro: str = None, almacen: str = None, stock_df=None):
    """Detalle por centro/almacén del stock disponible."""
    detalle = []
    consumo_df = _load_consumo_stock()
    consumo_disponible = not consumo_df.empty
    # Primero intentar tabla stock_almacenes
    try:
        conn = _connect()
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_almacenes'")
        if cur.fetchone():
            params = [_norm_codigo(codigo)]
            sql = "SELECT centro, almacen, SUM(cantidad) as cantidad FROM stock_almacenes WHERE codigo_material=?"
            if centro:
                sql += " AND centro=?"
                params.append(centro)
            if almacen:
                sql += " AND almacen=?"
                params.append(almacen)
            sql += " GROUP BY centro, almacen"
            cur.execute(sql, params)
            for row in cur.fetchall() or []:
                consumo_prom = None
                consumo_total = None
                if consumo_disponible:
                    mask = (
                        (consumo_df["codigo_norm"] == _norm_codigo(codigo))
                        & (consumo_df["centro_norm"] == _norm_codigo(row[0]))
                        & (consumo_df["almacen_norm"] == _norm_codigo(row[1]))
                        & consumo_df["fecha"].notna()
                    )
                    subset = consumo_df.loc[mask].copy()
                    if not subset.empty:
                        subset["anio"] = subset["fecha"].dt.year
                        consumo_total = float(subset["cantidad"].sum())
                        anios = max(1, subset["anio"].max() - subset["anio"].min() + 1)
                        consumo_prom = consumo_total / anios
                detalle.append(
                    {
                        "centro": row[0],
                        "almacen": row[1],
                        "cantidad": float(row[2] or 0),
                        "consumo_total": consumo_total,
                        "consumo_promedio": consumo_prom,
                        "libre_disponibilidad": str(row[1]) in ("0100", "9999"),
                    }
                )
            conn.close()
            return detalle
        conn.close()
    except Exception:
        try:
            conn.close()
        except Exception:
            pass

    # Fallback XLS
    sdf = stock_df if stock_df is not None else _load_stock_xlsx()
    if sdf is None or sdf.empty:
        return detalle
    mask = sdf["codigo_norm"] == _norm_codigo(codigo)
    if centro:
        mask = mask & (sdf["centro_norm"] == _norm_codigo(centro))
    if almacen:
        mask = mask & (sdf["almacen_norm"] == _norm_codigo(almacen))
    df_filtered = sdf.loc[mask]
    # Si no hay resultado para centro/almacen solicitado, mostrar todos los centros/almacenes
    if df_filtered.empty:
        df_filtered = sdf[sdf["codigo_norm"] == _norm_codigo(codigo)]
    for _, r in (
        df_filtered.groupby(["centro", "almacen"]).sum(numeric_only=True).reset_index().iterrows()
    ):
        consumo_prom = None
        consumo_total = None
        if consumo_disponible:
            maskc = (
                (consumo_df["codigo_norm"] == _norm_codigo(codigo))
                & (consumo_df["centro_norm"] == _norm_codigo(r.get("centro")))
                & (consumo_df["almacen_norm"] == _norm_codigo(r.get("almacen")))
                & consumo_df["fecha"].notna()
            )
            subset = consumo_df.loc[maskc].copy()
            if not subset.empty:
                subset["anio"] = subset["fecha"].dt.year
                consumo_total = float(subset["cantidad"].sum())
                anios = max(1, subset["anio"].max() - subset["anio"].min() + 1)
                consumo_prom = consumo_total / anios
        detalle.append(
            {
                "centro": r.get("centro"),
                "almacen": r.get("almacen"),
                "cantidad": float(r.get("stock") or 0),
                "consumo_total": consumo_total,
                "consumo_promedio": consumo_prom,
                "libre_disponibilidad": str(r.get("almacen")) in ("0100", "9999"),
            }
        )
    return detalle


def _load_solicitudes(filters: dict):
    where = ["(s.status = 'Aprobada' OR s.status = 'En Progreso' OR s.status = 'En tratamiento')"]
    params = []
    if filters.get("planner_id"):
        where.append("s.planner_id = ?")
        params.append(filters["planner_id"])
    if filters.get("centro"):
        where.append("s.centro = ?")
        params.append(filters["centro"])
    if filters.get("sector"):
        where.append("s.sector = ?")
        params.append(filters["sector"])
    where_sql = "WHERE " + " AND ".join(where)
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        f"""
        SELECT
            s.id, s.id_usuario, s.centro, s.sector, s.justificacion, s.centro_costos, s.almacen_virtual,
            s.criticidad, s.fecha_necesidad, s.status, s.total_monto, s.planner_id, s.created_at, s.updated_at, s.data_json, s.aprobador_id,
            u.nombre AS solicitante_nombre, u.apellido AS solicitante_apellido
        FROM solicitudes s
        LEFT JOIN usuarios u ON s.id_usuario = u.id_spm
        {where_sql}
        ORDER BY s.updated_at DESC
        """,
        params,
    )
    rows = cur.fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        extra = {}
        try:
            extra = json.loads(d.get("data_json") or "{}")
        except Exception:
            extra = {}
        d["items"] = extra.get("items", [])
        results.append(d)
    return results


@bp.route("/solicitudes", methods=["GET"])
def listar_solicitudes_aprobadas():
    """Solicitudes aprobadas/asignadas para planificador"""
    user = _current_user()
    if isinstance(user, tuple):
        return user
    guard, is_admin = _require_planner_role(user)
    if guard:
        return guard
    planner_id = user.get("id_spm") if not is_admin else request.args.get("planner_id")
    centro = request.args.get("centro")
    sector = request.args.get("sector")
    data = _load_solicitudes({"planner_id": planner_id, "centro": centro, "sector": sector})
    return jsonify(data), 200


@bp.route("/presupuesto", methods=["GET"])
def obtener_presupuesto():
    """Retorna presupuesto y saldo por centro/sector para validaciones rápidas"""
    centro = request.args.get("centro")
    sector = request.args.get("sector")
    if not centro or not sector:
        return jsonify({"error": "centro y sector son requeridos"}), 400
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        "SELECT centro, sector, monto_usd, saldo_usd FROM presupuestos WHERE centro=? AND sector=?",
        (centro, sector),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return jsonify({"centro": centro, "sector": sector, "monto_usd": 0, "saldo_usd": 0}), 200
    d = dict(row)
    return jsonify(d), 200


@bp.route("/solicitudes/<int:solicitud_id>/aceptar", methods=["POST"])
def aceptar_solicitud(solicitud_id):
    """Planificador marca como en progreso"""
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard
    actor_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")
    _update_estado(solicitud_id, "En tratamiento")
    _log_evento(solicitud_id, None, "planificador_acepta", "En tratamiento", {}, actor=actor_id)
    return jsonify({"ok": True}), 200


@bp.route("/solicitudes/<int:solicitud_id>/finalizar", methods=["POST"])
def finalizar_solicitud(solicitud_id):
    """Planificador finaliza tratamiento"""
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard
    actor_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")
    _update_estado(solicitud_id, "Tratado")
    _log_evento(solicitud_id, None, "planificador_finaliza", "Tratado", {}, actor=actor_id)
    return jsonify({"ok": True}), 200


@bp.route("/solicitudes/<int:solicitud_id>/comentar", methods=["POST"])
def comentar_solicitud(solicitud_id):
    """Agregar comentario/notificación a una solicitud"""
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    data = request.get_json(silent=True) or {}
    comentario = data.get("comentario", "").strip()

    if not comentario:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "comentario_required",
                        "message": "El comentario es requerido",
                    },
                }
            ),
            400,
        )

    actor_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")

    # Registrar el comentario en el log
    _log_evento(
        solicitud_id,
        None,
        "comentario_agregado",
        "comentario",
        {"comentario": comentario},
        actor=actor_id,
    )

    return jsonify({"ok": True, "message": "Comentario agregado correctamente"}), 200


@bp.route("/solicitudes/<int:solicitud_id>/items", methods=["PATCH"])
def tratar_items(solicitud_id):
    """
    Guarda tratamiento de ítems: espera un array items con item_index, decision, cantidad_aprobada, comentario, etc.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard
    data = request.get_json(silent=True) or {}
    items = data.get("items") or []
    actor = str(
        user.get("id_spm")
        or user.get("usuario")
        or user.get("id")
        or data.get("actor_id")
        or "planner"
    )
    conn = _connect()
    cur = conn.cursor()
    for it in items:
        idx = it.get("item_index")
        if idx is None:
            continue
        cur.execute(
            """
            INSERT INTO solicitud_items_tratamiento (solicitud_id, item_index, decision, cantidad_aprobada, codigo_equivalente, proveedor_sugerido, precio_unitario_estimado, comentario, updated_by)
            VALUES (?,?,?,?,?,?,?,?,?)
            ON CONFLICT(solicitud_id, item_index) DO UPDATE SET
                decision=excluded.decision,
                cantidad_aprobada=excluded.cantidad_aprobada,
                codigo_equivalente=excluded.codigo_equivalente,
                proveedor_sugerido=excluded.proveedor_sugerido,
                precio_unitario_estimado=excluded.precio_unitario_estimado,
                comentario=excluded.comentario,
                updated_by=excluded.updated_by,
                updated_at=CURRENT_TIMESTAMP
            """,
            (
                solicitud_id,
                idx,
                it.get("decision") or "",
                it.get("cantidad_aprobada") or 0,
                it.get("codigo_equivalente") or "",
                it.get("proveedor_sugerido") or "",
                it.get("precio_unitario_estimado") or 0,
                it.get("comentario") or "",
                actor,
            ),
        )
        _log_evento(solicitud_id, idx, "item_tratado", it.get("decision") or "", it, actor=actor)
    conn.commit()
    conn.close()
    _update_estado(solicitud_id, "En tratamiento")
    return jsonify({"ok": True}), 200


@bp.route("/solicitudes/<int:solicitud_id>/tratamiento", methods=["GET"])
def obtener_tratamiento(solicitud_id):
    """Rehidrata decisiones previas para mostrarlas al planificador."""
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """SELECT item_index, decision, cantidad_aprobada, codigo_equivalente, proveedor_sugerido,
                  precio_unitario_estimado, comentario, updated_by, updated_at
           FROM solicitud_items_tratamiento WHERE solicitud_id=?""",
        (solicitud_id,),
    )
    rows = cur.fetchall()
    conn.close()
    data = [dict(r) for r in rows]
    return jsonify({"ok": True, "data": data}), 200


@bp.route("/solicitudes/<int:solicitud_id>/analizar", methods=["POST"])
def analizar_solicitud(solicitud_id):
    """
    PASO 1: Análisis integral de solicitud para tratamiento

    Delega a paso_1_analizar_solicitud() en el servicio.
    Retorna objeto de análisis con métricas presupuesto, conflictos, avisos y recomendaciones.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        resultado = paso_1_analizar_solicitud(solicitud_id)
        return jsonify({"ok": True, "data": resultado}), 200
    except ValueError as e:
        return error_validation("solicitud_id", str(e))
    except Exception as e:
        return error_internal(str(e))


def _generar_recomendaciones(conflictos: list, avisos: list) -> list:
    """Genera recomendaciones basadas en conflictos y avisos"""
    recomendaciones = []

    for conflicto in conflictos:
        if conflicto["tipo"] == "stock_insuficiente":
            recomendaciones.append(
                {
                    "prioridad": "alta",
                    "accion": "Buscar proveedores externos",
                    "razon": f"Stock insuficiente para item {conflicto['item_idx']}",
                }
            )
        elif conflicto["tipo"] == "presupuesto_insuficiente":
            recomendaciones.append(
                {
                    "prioridad": "muy_alta",
                    "accion": "Solicitar ampliación de presupuesto",
                    "razon": f"Item {conflicto['item_idx']} requiere ${conflicto['costo_item']}",
                }
            )

    if len(avisos) > 0:
        recomendaciones.append(
            {
                "prioridad": "media",
                "accion": "Revisar avisos especiales antes de continuar",
                "razon": f"Hay {len(avisos)} avisos que requieren atención",
            }
        )

    return recomendaciones


def _update_estado(solicitud_id: int, estado: str):
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "UPDATE solicitudes SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (estado, solicitud_id),
    )
    conn.commit()
    conn.close()


def _log_evento(
    solicitud_id: int, item_index, tipo: str, estado: str, payload: dict, actor: str = "planner"
):
    conn = _connect()
    cur = conn.cursor()
    # Usar columnas que existen en la tabla
    cur.execute(
        "INSERT INTO solicitud_tratamiento_log (solicitud_id, item_index, actor_id, tipo, estado, payload_json) VALUES (?,?,?,?,?,?)",
        (solicitud_id, item_index, actor or "planner", tipo, estado, json.dumps(payload)),
    )
    conn.commit()
    conn.close()


@bp.route(
    "/solicitudes/<int:solicitud_id>/items/<int:item_idx>/opciones-abastecimiento", methods=["GET"]
)
def obtener_opciones_abastecimiento(solicitud_id, item_idx):
    """
    PASO 2: Obtener opciones de abastecimiento para un item.

    Delega a paso_2_opciones_abastecimiento() en el servicio.
    Retorna lista de opciones (stock, proveedores, equivalencias, mix).
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        resultado = paso_2_opciones_abastecimiento(solicitud_id, item_idx)
        return jsonify({"ok": True, "data": resultado}), 200
    except ValueError as e:
        return error_validation("item_idx", str(e))
    except Exception as e:
        return error_internal(str(e))


@bp.route("/solicitudes/<int:solicitud_id>/guardar-tratamiento", methods=["POST"])
def guardar_tratamiento(solicitud_id):
    """
    PASO 3: Guardar decisiones de tratamiento para toda la solicitud.

    Delega a paso_3_guardar_tratamiento() en el servicio.
    Persiste decisiones en BD, actualiza status de solicitud, registra evento.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        data = request.get_json(silent=True) or {}
        decisiones = data.get("decisiones", [])
        usuario_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "sistema")

        if not decisiones:
            return error_validation(
                "decisiones", "Se requieren decisiones para guardar el tratamiento"
            )

        resultado = paso_3_guardar_tratamiento(solicitud_id, decisiones, usuario_id)
        return jsonify({"ok": True, "data": resultado}), 200

    except ValueError as e:
        return error_validation("decisiones", str(e))
    except Exception as e:
        return error_internal(str(e))
