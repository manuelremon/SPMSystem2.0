"""
Planner routes - Gestión de planificación de solicitudes

Refactorizado para usar FSM centralizado (Sprint 1.7)
"""

import json
import logging
import traceback
from pathlib import Path

import pandas as pd
from flask import Blueprint, jsonify, request

try:
    from backend.core.db import get_db_connection, get_db_transaction
    from backend.core.errors import (
        api_error,
        error_forbidden,
        error_internal,
        error_not_found,
        error_validation,
    )
    from backend.core.fsm import (
        EstadoSolicitud,
        SolicitudNoEncontradaError,
        TransicionInvalidaError,
        cambiar_estado,
        estado_para_display,
        normalizar_estado,
        validar_transicion,
    )
    from backend.core.repository_legacy import (
        DecisionAbastecimientoRepository,
        MrpRepository,
        ProveedorPreciosRepository,
    )
    from backend.core.schemas import ResultadoPaso1, ResultadoPaso2, ResultadoPaso3
    from backend.services.planner_service import (
        # Nuevas funciones V2 multi-fuente
        guardar_decision_multifuente,
        obtener_resumen_decisiones,
        paso_1_analizar_solicitud,
        paso_2_opciones_abastecimiento,
        paso_3_guardar_tratamiento,
    )
    from backend.core.user_helpers import get_user_by_id
    from backend.routes.auth import _decode_token
    from backend.services.audit_service import auditar_modificacion
except ImportError:
    from core.db import get_db_connection, get_db_transaction
    from core.errors import error_forbidden, error_internal, error_not_found, error_validation
    from core.fsm import (
        EstadoSolicitud,
        SolicitudNoEncontradaError,
        TransicionInvalidaError,
        cambiar_estado,
        normalizar_estado,
    )
    from core.repository_legacy import (
        DecisionAbastecimientoRepository,
        MrpRepository,
        ProveedorPreciosRepository,
    )
    from services.planner_service import (
        # Nuevas funciones V2 multi-fuente
        guardar_decision_multifuente,
        obtener_resumen_decisiones,
        paso_1_analizar_solicitud,
        paso_2_opciones_abastecimiento,
        paso_3_guardar_tratamiento,
    )
    from core.user_helpers import get_user_by_id

    from routes.auth import _decode_token

# Blueprint histórico (/api/planner) con dashboard simple
# TODO: [Refactor] Replace generic "except Exception" with specific exceptions
#       (sqlite3.Error, ValueError, KeyError) to improve error debugging.
#       See analysis: 11 occurrences in this file.
planner_bp = Blueprint("planner", __name__)


# Blueprint nuevo para gestión planificador
bp = Blueprint("planner_api", __name__, url_prefix="/api/planificador")

_STOCK_XLS_CACHE = None
_EQUIV_XLS_CACHE = None
_CONSUMO_XLS_CACHE = None


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
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            if _table_exists(conn, "solicitudes"):
                cur.execute("SELECT status, COUNT(*) as cnt FROM solicitudes GROUP BY status")
                rows = cur.fetchall() or []
                counts = {}
                for row in rows:
                    if isinstance(row, dict):
                        counts[row["status"]] = row["cnt"]
                    else:
                        counts[row[0]] = row[1]
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
                cur.execute("SELECT SUM(saldo_usd) as total FROM presupuestos")
                total_saldo = cur.fetchone()
                # Compatibilidad PostgreSQL (dict) y SQLite (tuple)
                if total_saldo:
                    if isinstance(total_saldo, dict):
                        stats["presupuesto_disponible"] = float(total_saldo.get("total", 0) or 0)
                    else:
                        stats["presupuesto_disponible"] = float(total_saldo[0] or 0)
                else:
                    stats["presupuesto_disponible"] = 0.0

        return jsonify({"ok": True, "data": stats}), 200
    except Exception as exc:
        return (
            jsonify({"ok": False, "error": {"code": "dashboard_error", "message": str(exc)}}),
            500,
        )


# Alias para compatibilidad con código existente
_get_user = get_user_by_id


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

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT planner_id FROM solicitudes WHERE id=?", (solicitud_id,))
        row = cur.fetchone()

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


def _load_stock_db():
    """Lee stock desde sap_data.db tabla 'stock'."""
    global _STOCK_XLS_CACHE
    if _STOCK_XLS_CACHE is not None:
        return _STOCK_XLS_CACHE

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT material as codigo, centro, almacen, lote, stock
                FROM stock WHERE stock > 0
            """
            )
            rows = [dict(row) for row in cur.fetchall()]
        # Pre-normalizar códigos para búsqueda rápida
        for r in rows:
            r["codigo_norm"] = _norm_codigo(r.get("codigo", ""))
            r["centro_norm"] = _norm_codigo(r.get("centro", ""))
            r["almacen_norm"] = _norm_codigo(r.get("almacen", ""))
        _STOCK_XLS_CACHE = rows
        return _STOCK_XLS_CACHE
    except Exception:
        _STOCK_XLS_CACHE = []
        return _STOCK_XLS_CACHE


# Alias para compatibilidad
def _load_stock_xlsx():
    return _load_stock_db()


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
    """Obtiene stock disponible priorizando tabla stock_almacenes; cae a sap_data.db si no existe."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='stock_almacenes'"
            )
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
                if row is not None:
                    val = row["cantidad"] if isinstance(row, dict) else row[0]
                    return float(val or 0)
    except Exception:
        pass

    # Fallback a sap_data.db
    stock_rows = stock_df if stock_df is not None else _load_stock_db()
    if not stock_rows:
        return 0.0

    codigo_norm = _norm_codigo(codigo)
    centro_norm = _norm_codigo(centro) if centro else None
    almacen_norm = _norm_codigo(almacen) if almacen else None

    total = 0.0
    for r in stock_rows:
        if r.get("codigo_norm") != codigo_norm:
            continue
        if centro_norm and r.get("centro_norm") != centro_norm:
            continue
        if almacen_norm and r.get("almacen_norm") != almacen_norm:
            continue
        total += float(r.get("stock") or 0)
    return total


def _rankear_proveedores(cur, cantidad: float, precio_unitario: float):
    """
    Retorna proveedores externos ordenados por score (costo+plazo+calificación).

    Usa la nueva tabla proveedores_externos que tiene:
    - cuit como PK
    - lead_time_dias en lugar de plazo_entrega_dias
    - calificacion ('cumplidor', 'incumplidor', 'sin_calificar') en lugar de rating numérico
    """
    cur.execute(
        """
        SELECT
            pe.cuit,
            pe.nombre,
            pe.lead_time_dias,
            pe.calificacion,
            pe.rubro,
            pe.origen,
            (SELECT email FROM proveedor_ext_emails
             WHERE cuit_proveedor = pe.cuit AND es_principal = 1
             LIMIT 1) as email_principal
        FROM proveedores_externos pe
        WHERE pe.activo = 1
        """
    )
    proveedores = cur.fetchall() or []
    ranked = []

    # Mapeo de calificación a score numérico (0-5 escala)
    CALIFICACION_SCORE = {
        "cumplidor": 5.0,
        "sin_calificar": 2.5,
        "incumplidor": 1.0,
    }

    for prov in proveedores:
        plazo = prov["lead_time_dias"] or 30  # Default 30 días si no tiene
        calificacion = prov["calificacion"] or "sin_calificar"
        rating = CALIFICACION_SCORE.get(calificacion, 2.5)
        costo_total = (precio_unitario or 0) * (cantidad or 0)

        # Score: menor costo + menor plazo + mejor calificación
        score = (
            (100 / (1 + costo_total)) * 0.4 + (100 / (1 + plazo)) * 0.4 + (rating / 5 * 100) * 0.2
        )
        ranked.append(
            {
                "id_proveedor": prov["cuit"],  # Compatibilidad con código existente
                "cuit": prov["cuit"],
                "nombre": prov["nombre"],
                "lead_time_dias": plazo,
                "calificacion": calificacion,
                "rubro": prov["rubro"],
                "origen": prov["origen"],
                "email": prov["email_principal"],
                "score": score,
                "costo_total": costo_total,
            }
        )

    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked


def _load_consumo_db():
    """Carga consumo histórico desde sap_data.db tabla 'consumo_historico'."""
    global _CONSUMO_XLS_CACHE
    if _CONSUMO_XLS_CACHE is not None:
        return _CONSUMO_XLS_CACHE

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT material as codigo, centro, almacen, cantidad, fecha, descripcion
                FROM consumo_historico
                ORDER BY fecha DESC
            """
            )
            rows = [dict(row) for row in cur.fetchall()]
        # Pre-normalizar códigos para búsqueda rápida
        for r in rows:
            r["codigo_norm"] = _norm_codigo(r.get("codigo", ""))
            r["centro_norm"] = _norm_codigo(r.get("centro", ""))
            r["almacen_norm"] = _norm_codigo(r.get("almacen", ""))
        _CONSUMO_XLS_CACHE = rows
        return _CONSUMO_XLS_CACHE
    except Exception:
        _CONSUMO_XLS_CACHE = []
        return _CONSUMO_XLS_CACHE


# Alias para compatibilidad
def _load_consumo_stock():
    return _load_consumo_db()


def _get_consumo_sql(codigo: str, centro: str = None, almacen: str = None) -> tuple:
    """
    OPTIMIZACIÓN PERF-006: Consulta consumo filtrado directamente en SQL.
    Evita cargar los 20,000+ registros en memoria.

    Returns:
        tuple: (consumo_total, consumo_promedio_anual)
    """
    codigo_norm = _norm_codigo(codigo)
    if not codigo_norm:
        return None, None

    try:
        with get_db_connection("sap_data") as conn:
            cur = conn.cursor()

            # Construir query con filtros
            params = [f"%{codigo_norm}"]
            where_clauses = [
                "REPLACE(REPLACE(material, ' ', ''), '0', '') LIKE REPLACE(REPLACE(?, ' ', ''), '0', '')"
            ]

            # Filtro más simple usando LIKE para códigos normalizados
            where_sql = "WHERE material LIKE ?"
            params = [f"%{codigo_norm}%"]

            if centro:
                where_sql += " AND centro = ?"
                params.append(centro)
            if almacen:
                where_sql += " AND almacen = ?"
                params.append(almacen)

            # Query agregada: suma total y rango de años
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
            row = cur.fetchone()

            if not row or row["total"] == 0:
                return None, None

            total = float(row["total"])
            try:
                anio_min = int(row["anio_min"]) if row["anio_min"] else None
                anio_max = int(row["anio_max"]) if row["anio_max"] else None
                if anio_min and anio_max and anio_min > 2000:
                    n_anios = max(1, anio_max - anio_min + 1)
                    return total, total / n_anios
            except (ValueError, TypeError):
                pass

            return total, None

    except Exception:
        return None, None


def _calcular_consumo_promedio(consumo_rows, codigo_norm, centro_norm, almacen_norm):
    """Calcula consumo total y promedio anual para un material/centro/almacen."""
    if not consumo_rows:
        return None, None

    # Filtrar por material/centro/almacen
    filtered = [
        r
        for r in consumo_rows
        if r.get("codigo_norm") == codigo_norm
        and r.get("centro_norm") == centro_norm
        and r.get("almacen_norm") == almacen_norm
        and r.get("fecha")
    ]

    if not filtered:
        return None, None

    # Calcular totales y años
    total = 0.0
    years = set()
    for r in filtered:
        total += float(r.get("cantidad") or 0)
        try:
            year = int(str(r.get("fecha", ""))[:4])
            if year > 2000:
                years.add(year)
        except (ValueError, TypeError):
            pass

    if not years:
        return total, None

    n_anios = max(1, max(years) - min(years) + 1)
    return total, total / n_anios


def _stock_detalle(codigo: str, centro: str = None, almacen: str = None, stock_df=None):
    """Detalle por centro/almacén del stock disponible."""
    detalle = []
    # OPTIMIZACIÓN PERF-006: Ya no cargamos todo el consumo en memoria
    # Usamos _get_consumo_sql() que consulta directamente en SQL

    codigo_norm = _norm_codigo(codigo)
    centro_norm = _norm_codigo(centro) if centro else None
    almacen_norm = _norm_codigo(almacen) if almacen else None

    # Primero intentar tabla stock_almacenes en spm.db
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='stock_almacenes'"
            )
            if cur.fetchone():
                params = [codigo_norm]
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
                    # OPTIMIZACIÓN: Consulta SQL directa en lugar de filtrar en memoria
                    # Compatibilidad PostgreSQL (dict) y SQLite (tuple)
                    if isinstance(row, dict):
                        r_centro = row["centro"]
                        r_almacen = row["almacen"]
                        r_cantidad = row["cantidad"]
                    else:
                        r_centro = row[0]
                        r_almacen = row[1]
                        r_cantidad = row[2]
                    consumo_total, consumo_prom = _get_consumo_sql(codigo, r_centro, r_almacen)
                    detalle.append(
                        {
                            "centro": r_centro,
                            "almacen": r_almacen,
                            "cantidad": float(r_cantidad or 0),
                            "consumo_total": consumo_total,
                            "consumo_promedio": consumo_prom,
                            "libre_disponibilidad": str(r_almacen) in ("0100", "9999"),
                        }
                    )
                return detalle
    except Exception:
        pass

    # Fallback a sap_data.db
    stock_rows = stock_df if stock_df is not None else _load_stock_db()
    if not stock_rows:
        return detalle

    # Filtrar por material
    filtered = [r for r in stock_rows if r.get("codigo_norm") == codigo_norm]
    if centro_norm:
        filtered = [r for r in filtered if r.get("centro_norm") == centro_norm]
    if almacen_norm:
        filtered = [r for r in filtered if r.get("almacen_norm") == almacen_norm]

    # Si no hay resultado para centro/almacen solicitado, mostrar todos
    if not filtered:
        filtered = [r for r in stock_rows if r.get("codigo_norm") == codigo_norm]

    # Agrupar por centro/almacen
    grouped = {}
    for r in filtered:
        key = (r.get("centro"), r.get("almacen"))
        if key not in grouped:
            grouped[key] = 0.0
        grouped[key] += float(r.get("stock") or 0)

    for (c, a), stock_val in grouped.items():
        # OPTIMIZACIÓN: Consulta SQL directa en lugar de filtrar en memoria
        consumo_total, consumo_prom = _get_consumo_sql(codigo, c, a)
        detalle.append(
            {
                "centro": c,
                "almacen": a,
                "cantidad": stock_val,
                "consumo_total": consumo_total,
                "consumo_promedio": consumo_prom,
                "libre_disponibilidad": str(a) in ("0100", "9999"),
            }
        )

    return detalle


def _load_solicitudes(filters: dict):
    # FSM: Soportar tanto estados legacy como nuevos (normalizados)
    where = [
        """(
            s.status IN ('Aprobada', 'En Progreso', 'En tratamiento', 'Tratado', 'Finalizada', 'Completada')
            OR s.status IN ('approved', 'in_planning', 'in_treatment', 'treated', 'completed')
        )"""
    ]
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

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            f"""
            SELECT
                s.id, s.id_usuario, s.centro, s.sector, s.justificacion, s.centro_costos, s.almacen_virtual,
                s.criticidad, s.fecha_necesidad, s.status, s.total_monto, s.planner_id, s.created_at, s.updated_at, s.data_json, s.aprobador_id,
                u.nombre AS solicitante_nombre, u.apellido AS solicitante_apellido,
                ua.nombre AS aprobador_nombre, ua.apellido AS aprobador_apellido,
                up.nombre AS planner_nombre, up.apellido AS planner_apellido
            FROM solicitudes s
            LEFT JOIN usuarios u ON s.id_usuario = u.id_spm
            LEFT JOIN usuarios ua ON s.aprobador_id = ua.id_spm
            LEFT JOIN usuarios up ON s.planner_id = up.id_spm
            {where_sql}
            ORDER BY s.updated_at DESC
            """,
            params,
        )
        rows = cur.fetchall()

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

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT centro, sector, monto_usd, saldo_usd FROM presupuestos WHERE centro=? AND sector=?",
            (centro, sector),
        )
        row = cur.fetchone()

    if not row:
        return jsonify({"centro": centro, "sector": sector, "monto_usd": 0, "saldo_usd": 0}), 200
    d = dict(row)
    return jsonify(d), 200


@bp.route("/solicitudes/<int:solicitud_id>/aceptar", methods=["POST"])
def aceptar_solicitud(solicitud_id):
    """Planificador acepta y marca como en tratamiento - Usa FSM"""
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    actor_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")

    # Usar FSM para cambiar estado (approved/in_planning -> in_treatment)
    try:
        resultado = cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.IN_TREATMENT,
            actor_id=actor_id,
            razon="Planificador acepta tratamiento",
            metadata={"paso": "aceptacion"},
        )
        _log_evento(
            solicitud_id, None, "planificador_acepta", resultado["estado_nuevo"], {}, actor=actor_id
        )
        return jsonify({"ok": True, "estado": resultado["estado_nuevo"]}), 200

    except TransicionInvalidaError as e:
        logging.warning(f"Transición inválida aceptar solicitud {solicitud_id}: {e}")
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_transition",
                        "message": "Transición de estado no permitida",
                    },
                }
            ),
            400,
        )
    except SolicitudNoEncontradaError:
        return error_not_found("Solicitud", solicitud_id)


@bp.route("/solicitudes/<int:solicitud_id>/finalizar", methods=["POST"])
def finalizar_solicitud(solicitud_id):
    """Planificador finaliza tratamiento - Usa FSM"""
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    actor_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")

    # Usar FSM para cambiar estado (in_treatment -> treated)
    try:
        resultado = cambiar_estado(
            solicitud_id=solicitud_id,
            nuevo_estado=EstadoSolicitud.TREATED,
            actor_id=actor_id,
            razon="Planificador finaliza tratamiento",
            metadata={"paso": "finalizacion"},
        )
        _log_evento(
            solicitud_id,
            None,
            "planificador_finaliza",
            resultado["estado_nuevo"],
            {},
            actor=actor_id,
        )
        return jsonify({"ok": True, "estado": resultado["estado_nuevo"]}), 200

    except TransicionInvalidaError as e:
        logging.warning(f"Transición inválida finalizar solicitud {solicitud_id}: {e}")
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "code": "invalid_transition",
                        "message": "Transición de estado no permitida",
                    },
                }
            ),
            400,
        )
    except SolicitudNoEncontradaError:
        return error_not_found("Solicitud", solicitud_id)


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

    # Validacion basica de items de tratamiento (Sprint 3.4)
    if not items:
        return error_validation("Se requiere al menos un item para tratar")

    errores = []
    for idx, it in enumerate(items):
        if it.get("item_index") is None:
            errores.append(f"Item {idx}: item_index es requerido")
            continue

        # Validar cantidad_aprobada
        cant = it.get("cantidad_aprobada")
        if cant is not None:
            try:
                cant = float(cant)
                if cant < 0:
                    errores.append(f"Item {idx}: cantidad_aprobada no puede ser negativa")
            except (TypeError, ValueError):
                errores.append(f"Item {idx}: cantidad_aprobada debe ser un numero")

        # Validar precio_unitario_estimado
        precio = it.get("precio_unitario_estimado")
        if precio is not None:
            try:
                precio = float(precio)
                if precio < 0:
                    errores.append(f"Item {idx}: precio_unitario_estimado no puede ser negativo")
            except (TypeError, ValueError):
                errores.append(f"Item {idx}: precio_unitario_estimado debe ser un numero")

    if errores:
        return error_validation("; ".join(errores))

    with get_db_transaction() as conn:
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
            _log_evento(
                solicitud_id, idx, "item_tratado", it.get("decision") or "", it, actor=actor
            )

    # Usar FSM para asegurar estado correcto (si no está ya en tratamiento)
    try:
        # Solo cambiar si no está ya en in_treatment
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT status FROM solicitudes WHERE id=?", (solicitud_id,))
            row = cur.fetchone()
            if row:
                estado_actual = normalizar_estado(row["status"])
                if estado_actual != "in_treatment":
                    cambiar_estado(
                        solicitud_id=solicitud_id,
                        nuevo_estado=EstadoSolicitud.IN_TREATMENT,
                        actor_id=actor,
                        razon="Items tratados",
                        metadata={"items_count": len(items)},
                    )
    except TransicionInvalidaError:
        # Si la transición no es válida, solo actualizar el timestamp
        pass

    return jsonify({"ok": True}), 200


@bp.route("/solicitudes/<int:solicitud_id>/tratamiento", methods=["GET"])
def obtener_tratamiento(solicitud_id):
    """Rehidrata decisiones previas para mostrarlas al planificador."""
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT item_index, decision, cantidad_aprobada, codigo_equivalente, proveedor_sugerido,
                      precio_unitario_estimado, comentario, updated_by, updated_at
               FROM solicitud_items_tratamiento WHERE solicitud_id=?""",
            (solicitud_id,),
        )
        rows = cur.fetchall()

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
        logging.warning(f"Validación paso1 solicitud {solicitud_id}: {e}")
        return error_validation("solicitud_id", "Solicitud no válida o no encontrada")
    except Exception as e:
        logging.error(f"Error en paso1_analisis solicitud {solicitud_id}: {e}")
        return error_internal("Error al analizar solicitud")


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


def _update_estado(solicitud_id: int, estado: str, actor_id: str = "system"):
    """
    Actualiza estado de solicitud.

    NOTA: Preferir usar cambiar_estado() del FSM directamente para
    validación de transiciones y registro de historial.
    Esta función se mantiene para compatibilidad legacy.
    """
    # Normalizar estado para almacenamiento consistente
    estado_normalizado = normalizar_estado(estado)

    with get_db_transaction() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE solicitudes SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (estado_normalizado, solicitud_id),
        )


def _log_evento(
    solicitud_id: int, item_index, tipo: str, estado: str, payload: dict, actor: str = "planner"
):
    with get_db_transaction() as conn:
        cur = conn.cursor()
        # Usar columnas que existen en la tabla
        cur.execute(
            "INSERT INTO solicitud_tratamiento_log (solicitud_id, item_index, actor_id, tipo, estado, payload_json) VALUES (?,?,?,?,?,?)",
            (solicitud_id, item_index, actor or "planner", tipo, estado, json.dumps(payload)),
        )


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
        logging.warning(f"Validación opciones item {item_idx} solicitud {solicitud_id}: {e}")
        return error_validation("item_idx", "Item no válido o fuera de rango")
    except Exception as e:
        logging.error(f"Error obteniendo opciones item {item_idx} solicitud {solicitud_id}: {e}")
        return error_internal("Error al obtener opciones de abastecimiento")


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
        logging.warning(f"Validación decisiones solicitud {solicitud_id}: {e}")
        return error_validation("decisiones", "Datos de decisiones no válidos")
    except Exception as e:
        logging.error(f"Error guardando tratamiento solicitud {solicitud_id}: {e}")
        return error_internal("Error al guardar el tratamiento")


# =============================================================================
# NUEVOS ENDPOINTS V2: Multi-Fuente
# =============================================================================


@bp.route(
    "/solicitudes/<int:solicitud_id>/items/<int:item_idx>/decision-multifuente",
    methods=["POST"],
)
def guardar_decision_multifuente_endpoint(solicitud_id, item_idx):
    """
    Guarda decisión multi-fuente para un item.

    Body JSON esperado:
    {
        "cantidad_solicitada": 100,
        "fuentes": [
            {
                "tipo_fuente": "stock",
                "centro_origen": "1008",
                "almacen_origen": "0100",
                "cantidad_asignada": 50,
                "precio_unitario": 10.5,
                "notas": "Stock local"
            },
            {
                "tipo_fuente": "proveedor",
                "cuit_proveedor": "30-12345678-9",
                "proveedor_nombre": "Proveedor ABC",
                "cantidad_asignada": 50,
                "precio_unitario": 12.0,
                "plazo_dias": 15,
                "precio_es_negociado": true
            }
        ],
        "comentario": "Decisión dividida entre stock y proveedor"
    }
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        data = request.get_json(silent=True) or {}
        cantidad_solicitada = data.get("cantidad_solicitada", 0)
        fuentes = data.get("fuentes", [])
        comentario = data.get("comentario", "")
        planner_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")

        if not fuentes:
            return error_validation("fuentes", "Se requiere al menos una fuente de abastecimiento")

        # Validar que la suma de cantidades coincida
        total_asignado = sum(f.get("cantidad_asignada", 0) for f in fuentes)
        if total_asignado <= 0:
            return error_validation(
                "cantidad_asignada", "La cantidad total asignada debe ser mayor a 0"
            )

        resultado = guardar_decision_multifuente(
            solicitud_id=solicitud_id,
            item_idx=item_idx,
            cantidad_solicitada=cantidad_solicitada,
            fuentes=fuentes,
            planner_id=planner_id,
            comentario=comentario,
        )

        # Registrar evento
        _log_evento(
            solicitud_id,
            item_idx,
            "decision_multifuente",
            resultado.get("estado", "pendiente"),
            {"fuentes": len(fuentes), "total_asignado": total_asignado},
            actor=planner_id,
        )

        return jsonify({"ok": True, "data": resultado}), 200

    except ValueError as e:
        logging.warning(f"Validación fuentes item {item_idx} solicitud {solicitud_id}: {e}")
        return error_validation("fuentes", "Datos de fuentes no válidos")
    except Exception as e:
        logging.error(
            f"Error guardando decisión multifuente item {item_idx} solicitud {solicitud_id}: {e}"
        )
        return error_internal("Error al guardar la decisión")


@bp.route("/solicitudes/<int:solicitud_id>/decisiones-resumen", methods=["GET"])
def obtener_resumen_decisiones_endpoint(solicitud_id):
    """
    Obtiene resumen de todas las decisiones multi-fuente de una solicitud.

    Retorna:
    {
        "solicitud_id": 123,
        "total_items": 5,
        "items_completos": 3,
        "items_parciales": 1,
        "items_pendientes": 1,
        "decisiones": [
            {
                "item_index": 0,
                "estado": "completo",
                "cantidad_solicitada": 100,
                "cantidad_asignada": 100,
                "fuentes": [...]
            },
            ...
        ]
    }
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        resultado = obtener_resumen_decisiones(solicitud_id)
        return jsonify({"ok": True, "data": resultado}), 200
    except Exception as e:
        logging.error(f"Error obteniendo resumen decisiones solicitud {solicitud_id}: {e}")
        return error_internal("Error al obtener resumen de decisiones")


@bp.route(
    "/solicitudes/<int:solicitud_id>/items/<int:item_idx>/mrp",
    methods=["GET"],
)
def obtener_detalle_mrp(solicitud_id, item_idx):
    """
    Obtiene detalle completo de parámetros MRP para un item.

    Retorna información de:
    - Punto de pedido
    - Stock de seguridad
    - Stock máximo
    - Lote de pedido
    - Pedidos en curso
    - Consumo histórico
    - Alertas activas
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        # Obtener la solicitud para conseguir centro y código material
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT centro, data_json FROM solicitudes WHERE id=?",
                (solicitud_id,),
            )
            row = cur.fetchone()
            if not row:
                return error_not_found("Solicitud", solicitud_id)

            centro = row["centro"]
            data_json = json.loads(row["data_json"] or "{}")
            items = data_json.get("items", [])

            if item_idx < 0 or item_idx >= len(items):
                return error_validation("item_idx", f"Item {item_idx} no existe en la solicitud")

            item = items[item_idx]
            codigo_material = item.get("codigo") or item.get("codigo_material", "")

        # Obtener parámetros MRP desde sap_data.db
        mrp_params = MrpRepository.get_parametros_mrp(codigo_material, centro)
        pedidos = MrpRepository.get_pedidos_en_curso(codigo_material, centro)
        consumo = MrpRepository.get_consumo_historico(codigo_material, centro, meses=12)

        # Calcular alertas
        alertas = []
        if mrp_params:
            stock_actual = _stock_disponible(codigo_material, centro)
            punto_pedido = mrp_params.get("punto_pedido", 0)
            stock_seguridad = mrp_params.get("stock_seguridad", 0)

            if stock_actual < punto_pedido:
                alertas.append(
                    {
                        "tipo": "bajo_punto_pedido",
                        "severidad": "warning",
                        "mensaje": f"Stock ({stock_actual}) bajo punto de pedido ({punto_pedido})",
                    }
                )
            if stock_actual < stock_seguridad:
                alertas.append(
                    {
                        "tipo": "bajo_stock_seguridad",
                        "severidad": "critical",
                        "mensaje": f"Stock ({stock_actual}) bajo stock de seguridad ({stock_seguridad})",
                    }
                )

        resultado = {
            "codigo_material": codigo_material,
            "centro": centro,
            "parametros_mrp": mrp_params or {},
            "pedidos_en_curso": pedidos,
            "consumo_historico": consumo,
            "alertas": alertas,
            "planificado_mrp": bool(mrp_params),
        }

        return jsonify({"ok": True, "data": resultado}), 200

    except Exception as e:
        logging.error(f"Error obteniendo detalle MRP item {item_idx} solicitud {solicitud_id}: {e}")
        return error_internal("Error al obtener información MRP")


# =============================================================================
# ENDPOINTS: Precios Negociados
# =============================================================================


@bp.route("/proveedores/<cuit>/precios", methods=["GET"])
def listar_precios_proveedor(cuit):
    """
    Lista todos los precios negociados de un proveedor.

    Query params opcionales:
    - activo: 1/0 (filtra solo activos)
    - material: código de material específico
    """
    user = _current_user()
    if isinstance(user, tuple):
        return user
    guard, _ = _require_planner_role(user)
    if guard:
        return guard

    try:
        solo_activos = request.args.get("activo", "1") == "1"
        material = request.args.get("material")

        precios = ProveedorPreciosRepository.listar_por_proveedor(cuit, solo_activos=solo_activos)

        # Filtrar por material si se especifica
        if material:
            precios = [p for p in precios if p.get("codigo_material") == material]

        return jsonify({"ok": True, "data": precios}), 200

    except Exception as e:
        logging.error(f"Error listando precios proveedor {cuit}: {e}")
        return error_internal("Error al obtener precios del proveedor")


@bp.route("/proveedores/<cuit>/precios", methods=["POST"])
def crear_precio_negociado(cuit):
    """
    Crea o actualiza un precio negociado para proveedor/material.

    Body JSON esperado:
    {
        "codigo_material": "12345678",
        "precio_usd": 150.50,
        "moneda": "USD",
        "fecha_vigencia_desde": "2024-01-01",
        "fecha_vigencia_hasta": "2024-12-31",
        "condicion_pago": "30 días",
        "cantidad_minima": 10,
        "notas": "Precio especial por volumen"
    }
    """
    user = _current_user()
    if isinstance(user, tuple):
        return user
    guard, _ = _require_planner_role(user)
    if guard:
        return guard

    try:
        data = request.get_json(silent=True) or {}

        # Validaciones
        codigo_material = data.get("codigo_material")
        precio_usd = data.get("precio_usd")
        fecha_desde = data.get("fecha_vigencia_desde")

        if not codigo_material:
            return error_validation("codigo_material", "Código de material requerido")
        if not precio_usd or precio_usd <= 0:
            return error_validation("precio_usd", "Precio USD debe ser mayor a 0")
        if not fecha_desde:
            return error_validation("fecha_vigencia_desde", "Fecha de vigencia requerida")

        precio_id = ProveedorPreciosRepository.crear_precio(
            cuit_proveedor=cuit,
            codigo_material=codigo_material,
            precio_usd=float(precio_usd),
            moneda=data.get("moneda", "USD"),
            fecha_vigencia_desde=fecha_desde,
            fecha_vigencia_hasta=data.get("fecha_vigencia_hasta"),
            condicion_pago=data.get("condicion_pago"),
            cantidad_minima=data.get("cantidad_minima", 1),
            notas=data.get("notas"),
        )

        return (
            jsonify(
                {
                    "ok": True,
                    "data": {"id": precio_id, "mensaje": "Precio negociado creado correctamente"},
                }
            ),
            201,
        )

    except Exception as e:
        logging.error(f"Error creando precio proveedor {cuit}: {e}")
        return error_internal("Error al crear precio negociado")


@bp.route("/materiales/<codigo>/mejores-precios", methods=["GET"])
def obtener_mejores_precios_material(codigo):
    """
    Obtiene los mejores precios negociados para un material.

    Query params:
    - limit: número máximo de resultados (default 5)
    """
    user = _current_user()
    if isinstance(user, tuple):
        return user
    guard, _ = _require_planner_role(user)
    if guard:
        return guard

    try:
        limit = int(request.args.get("limit", 5))
        precios = ProveedorPreciosRepository.get_mejores_precios(codigo, limit=limit)
        return jsonify({"ok": True, "data": precios}), 200

    except Exception as e:
        logging.error(f"Error obteniendo mejores precios material {codigo}: {e}")
        return error_internal("Error al obtener precios del material")


# =============================================================================
# ENDPOINT: Decisiones por Item (lectura)
# =============================================================================


@bp.route(
    "/solicitudes/<int:solicitud_id>/items/<int:item_idx>/decision",
    methods=["GET"],
)
def obtener_decision_item(solicitud_id, item_idx):
    """
    Obtiene la decisión guardada para un item específico.
    Incluye todas las fuentes seleccionadas con sus cantidades.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        decision = DecisionAbastecimientoRepository.get_decision(solicitud_id, item_idx)

        if not decision:
            return (
                jsonify(
                    {"ok": True, "data": None, "mensaje": "No hay decisión guardada para este item"}
                ),
                200,
            )

        # Obtener fuentes de la decisión
        fuentes = DecisionAbastecimientoRepository.get_fuentes(decision["id"])

        resultado = {
            **decision,
            "fuentes": fuentes,
        }

        return jsonify({"ok": True, "data": resultado}), 200

    except Exception as e:
        logging.error(f"Error obteniendo decisión item {item_idx} solicitud {solicitud_id}: {e}")
        return error_internal("Error al obtener decisión del item")


# =============================================================================
# ENDPOINTS: Acciones Post-Tratamiento (Paso 4)
# =============================================================================


@bp.route("/solicitudes/<int:solicitud_id>/ejecutar-acciones", methods=["POST"])
def ejecutar_acciones_post_tratamiento(solicitud_id):
    """
    PASO 4: Ejecutar acciones post-tratamiento.

    Procesa cada decisión de abastecimiento y ejecuta las acciones correspondientes:
    - Stock mismo centro: Notificación al almacén para traspaso
    - Stock otro centro: Consulta al referente del centro
    - Compra proveedor: Marca como pendiente SOLPED (futuro SAP)
    - Opcional: Enviar resumen al solicitante para aceptación

    Body JSON esperado:
    {
        "enviar_resumen_solicitante": true/false  // Opcional
    }

    Retorna resumen de acciones ejecutadas por ítem.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        # Leer opciones del body
        body_data = request.get_json(silent=True) or {}
        enviar_resumen_solicitante = body_data.get("enviar_resumen_solicitante", False)

        # Importar NotificationService y MessageService
        try:
            from backend.services.message_service import MessageService
            from backend.services.notification_service import NotificationService
        except ImportError:
            from services.message_service import MessageService
            from services.notification_service import NotificationService

        # Obtener datos de la solicitud
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT centro, id_usuario, data_json FROM solicitudes WHERE id=?",
                (solicitud_id,),
            )
            sol_row = cur.fetchone()
            if not sol_row:
                return error_not_found("Solicitud", solicitud_id)

            centro_solicitud = sol_row["centro"]
            solicitante_id = sol_row["id_usuario"]
            data_json = json.loads(sol_row["data_json"] or "{}")
            items = data_json.get("items", [])

        # Obtener todas las decisiones de la solicitud
        decisiones = DecisionAbastecimientoRepository.get_decisiones_solicitud(solicitud_id)

        acciones_ejecutadas = []
        planner_id = str(user.get("id_spm") or user.get("usuario") or user.get("id") or "planner")

        for decision in decisiones:
            item_idx = decision.get("item_index", 0)
            item = items[item_idx] if item_idx < len(items) else {}
            codigo_material = item.get("codigo") or item.get("codigo_material", "")
            descripcion = item.get("descripcion", "")

            # Obtener fuentes de esta decisión
            fuentes = DecisionAbastecimientoRepository.get_fuentes(decision["id"])

            for fuente in fuentes:
                tipo_fuente = fuente.get("tipo_fuente", "")
                centro_origen = fuente.get("centro_origen", "")
                almacen_origen = fuente.get("almacen_origen", "")
                cantidad = fuente.get("cantidad_asignada", 0)

                accion = {
                    "decision_id": decision["id"],
                    "item_index": item_idx,
                    "codigo_material": codigo_material,
                    "descripcion": descripcion,
                    "tipo_fuente": tipo_fuente,
                    "cantidad": cantidad,
                    "estado": "pendiente",
                    "destinatario": None,
                    "mensaje": None,
                }

                # Determinar acción según tipo de fuente
                if tipo_fuente in ("stock", "transferencia"):
                    if centro_origen == centro_solicitud:
                        # Stock mismo centro -> notificar almacén
                        accion["estado"] = "transferencia_solicitada"
                        accion["destinatario"] = f"Almacén {centro_origen}/{almacen_origen}"
                        accion["mensaje"] = (
                            f"Traspaso requerido: {cantidad} unidades de {codigo_material} "
                            f"({descripcion}) desde almacén {almacen_origen}"
                        )

                        # Buscar responsable del almacén y notificar
                        responsable_id = _get_responsable_almacen(centro_origen, almacen_origen)
                        if responsable_id:
                            NotificationService.create_notification(
                                destinatario_id=responsable_id,
                                mensaje=accion["mensaje"],
                                tipo="solicitud_planned",
                                solicitud_id=solicitud_id,
                            )
                            accion["notificacion_enviada"] = True
                    else:
                        # Stock otro centro -> consulta a referente
                        accion["estado"] = "esperando_confirmacion"
                        accion["destinatario"] = f"Referente {centro_origen}"
                        accion["mensaje"] = (
                            f"Consulta de disponibilidad: {cantidad} unidades de {codigo_material} "
                            f"({descripcion}) desde centro {centro_origen}, almacén {almacen_origen}"
                        )

                        # Buscar referente del centro y crear consulta
                        referente_id = _get_referente_centro(centro_origen)
                        if referente_id:
                            NotificationService.create_notification(
                                destinatario_id=referente_id,
                                mensaje=accion["mensaje"],
                                tipo="warning",
                                solicitud_id=solicitud_id,
                            )
                            accion["notificacion_enviada"] = True
                            accion["requiere_respuesta"] = True

                elif tipo_fuente == "equivalencia":
                    # G3: Manejo de equivalencias - tratar como stock interno
                    codigo_equiv = fuente.get("codigo_material_equiv", codigo_material)
                    tipo_equiv = fuente.get("tipo_equivalencia", "E1_ESTRICTA")

                    if centro_origen == centro_solicitud or not centro_origen:
                        # Equivalencia del mismo centro -> traspaso
                        accion["estado"] = "transferencia_solicitada"
                        accion["destinatario"] = f"Almacén {centro_origen or centro_solicitud}/{almacen_origen or '0001'}"
                        accion["mensaje"] = (
                            f"Traspaso de equivalencia ({tipo_equiv}): {cantidad} unidades de {codigo_equiv} "
                            f"en lugar de {codigo_material} ({descripcion})"
                        )
                        accion["es_equivalencia"] = True
                        accion["codigo_equivalente"] = codigo_equiv

                        responsable_id = _get_responsable_almacen(
                            centro_origen or centro_solicitud, almacen_origen or "0001"
                        )
                        if responsable_id:
                            NotificationService.create_notification(
                                destinatario_id=responsable_id,
                                mensaje=accion["mensaje"],
                                tipo="solicitud_planned",
                                solicitud_id=solicitud_id,
                            )
                            accion["notificacion_enviada"] = True
                    else:
                        # Equivalencia de otro centro -> consulta
                        accion["estado"] = "esperando_confirmacion"
                        accion["destinatario"] = f"Referente {centro_origen}"
                        accion["mensaje"] = (
                            f"Consulta equivalencia ({tipo_equiv}): {cantidad} unidades de {codigo_equiv} "
                            f"desde centro {centro_origen} - reemplaza {codigo_material}"
                        )
                        accion["es_equivalencia"] = True
                        accion["codigo_equivalente"] = codigo_equiv

                        referente_id = _get_referente_centro(centro_origen)
                        if referente_id:
                            NotificationService.create_notification(
                                destinatario_id=referente_id,
                                mensaje=accion["mensaje"],
                                tipo="warning",
                                solicitud_id=solicitud_id,
                            )
                            accion["notificacion_enviada"] = True
                            accion["requiere_respuesta"] = True

                elif tipo_fuente == "proveedor":
                    # Compra a proveedor -> pendiente SOLPED
                    proveedor = fuente.get("proveedor_nombre", "")
                    accion["estado"] = "solped_pendiente"
                    accion["destinatario"] = proveedor
                    accion["mensaje"] = (
                        f"Pendiente generar SOLPED: {cantidad} unidades de {codigo_material} "
                        f"({descripcion}) - Proveedor: {proveedor}"
                    )
                    accion["requiere_sap"] = True

                # Actualizar estado de la decisión en BD
                _actualizar_estado_decision(decision["id"], accion["estado"])

                acciones_ejecutadas.append(accion)

        # Registrar evento
        _log_evento(
            solicitud_id,
            None,
            "acciones_ejecutadas",
            "paso_4",
            {"total_acciones": len(acciones_ejecutadas)},
            actor=planner_id,
        )

        # Agrupar por tipo para el resumen
        resumen = {
            "solicitud_id": solicitud_id,
            "total_acciones": len(acciones_ejecutadas),
            "traspasos_solicitados": len(
                [a for a in acciones_ejecutadas if a["estado"] == "transferencia_solicitada" and not a.get("es_equivalencia")]
            ),
            "equivalencias_solicitadas": len(
                [a for a in acciones_ejecutadas if a.get("es_equivalencia")]
            ),
            "consultas_pendientes": len(
                [a for a in acciones_ejecutadas if a["estado"] == "esperando_confirmacion"]
            ),
            "solped_pendientes": len(
                [a for a in acciones_ejecutadas if a["estado"] == "solped_pendiente"]
            ),
            "acciones": acciones_ejecutadas,
            "resumen_enviado_solicitante": False,
        }

        # Enviar resumen al solicitante si se solicitó
        if enviar_resumen_solicitante and solicitante_id:
            try:
                # Construir mensaje de resumen
                resumen_items = []
                for accion in acciones_ejecutadas:
                    estado_label = {
                        "transferencia_solicitada": "Traspaso de almacén",
                        "esperando_confirmacion": "Pendiente confirmación",
                        "solped_pendiente": "Compra a proveedor",
                    }.get(accion["estado"], accion["estado"])
                    resumen_items.append(
                        f"- {accion['codigo_material']}: {accion['cantidad']} unidades ({estado_label})"
                    )

                mensaje_resumen = (
                    f"Se ha completado el tratamiento de su solicitud #{solicitud_id}.\n\n"
                    f"Resumen del abastecimiento propuesto:\n"
                    f"{chr(10).join(resumen_items)}\n\n"
                    f"Traspasos de stock: {resumen['traspasos_solicitados']}\n"
                    f"Consultas pendientes: {resumen['consultas_pendientes']}\n"
                    f"Compras a proveedores: {resumen['solped_pendientes']}\n\n"
                    f"Por favor, revise el tratamiento propuesto y confirme su aceptación."
                )

                # Enviar notificación al solicitante
                NotificationService.create_notification(
                    destinatario_id=solicitante_id,
                    mensaje=f"Tratamiento de solicitud #{solicitud_id} completado - Pendiente su aceptación",
                    tipo="info",
                    solicitud_id=solicitud_id,
                )

                # Enviar mensaje detallado
                MessageService.enviar_mensaje(
                    remitente_id=planner_id,
                    destinatario_id=solicitante_id,
                    asunto=f"Resumen de tratamiento - Solicitud #{solicitud_id}",
                    mensaje=mensaje_resumen,
                    solicitud_id=solicitud_id,
                    tipo="resumen_tratamiento",
                )

                resumen["resumen_enviado_solicitante"] = True

            except Exception as e:
                # No fallar si no se puede enviar el resumen
                resumen["error_envio_resumen"] = str(e)

        return jsonify({"ok": True, "data": resumen}), 200

    except Exception as e:
        logging.error(f"Error en ejecutar_acciones_post_tratamiento solicitud {solicitud_id}: {e}")
        logging.error(traceback.format_exc())
        return error_internal("Error al ejecutar acciones de tratamiento")


@bp.route("/responder-consulta/<int:decision_id>", methods=["POST"])
def responder_consulta_referente(decision_id):
    """
    Endpoint para que referentes respondan consultas de disponibilidad de stock.

    Body JSON esperado:
    {
        "acepta": true/false,
        "comentario": "Motivo de rechazo o confirmación",
        "cantidad_confirmada": 50  // opcional, si confirma parcialmente
    }

    Actualiza estado de la decisión a 'confirmado' o 'rechazado'.
    """
    user = _current_user()
    if isinstance(user, tuple):
        return user

    try:
        data = request.get_json(silent=True) or {}
        acepta = data.get("acepta", False)
        comentario = data.get("comentario", "")
        cantidad_confirmada = data.get("cantidad_confirmada")

        # Obtener la decisión
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, solicitud_id, estado, item_index FROM decision_abastecimiento WHERE id=?",
                (decision_id,),
            )
            decision = cur.fetchone()

        if not decision:
            return error_not_found("Decisión", decision_id)

        if decision["estado"] not in ("esperando_confirmacion", "pendiente"):
            return error_validation(
                "estado", f"La decisión ya fue procesada (estado: {decision['estado']})"
            )

        # Actualizar estado
        nuevo_estado = "confirmado" if acepta else "rechazado"
        usuario_id = str(user.get("id_spm") or user.get("usuario") or user.get("id"))

        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE decision_abastecimiento
                SET estado = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (nuevo_estado, decision_id),
            )

        # Registrar evento
        _log_evento(
            decision["solicitud_id"],
            decision["item_index"],
            "respuesta_referente",
            nuevo_estado,
            {
                "acepta": acepta,
                "comentario": comentario,
                "cantidad_confirmada": cantidad_confirmada,
            },
            actor=usuario_id,
        )

        # Notificar al planificador
        try:
            from backend.services.notification_service import NotificationService
        except ImportError:
            from services.notification_service import NotificationService

        # Obtener planner_id de la solicitud
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT planner_id FROM solicitudes WHERE id=?",
                (decision["solicitud_id"],),
            )
            sol = cur.fetchone()
            if sol and sol["planner_id"]:
                mensaje = (
                    f"Respuesta de referente para solicitud #{decision['solicitud_id']}: "
                    f"{'Confirmado' if acepta else 'Rechazado'}"
                )
                if comentario:
                    mensaje += f" - {comentario}"

                NotificationService.create_notification(
                    destinatario_id=sol["planner_id"],
                    mensaje=mensaje,
                    tipo="info" if acepta else "warning",
                    solicitud_id=decision["solicitud_id"],
                )

        return (
            jsonify(
                {
                    "ok": True,
                    "data": {
                        "decision_id": decision_id,
                        "nuevo_estado": nuevo_estado,
                        "mensaje": "Respuesta registrada correctamente",
                    },
                }
            ),
            200,
        )

    except Exception as e:
        logging.error(f"Error respondiendo consulta decisión {decision_id}: {e}")
        return error_internal("Error al registrar respuesta")


@bp.route("/solicitudes/<int:solicitud_id>/estado-acciones", methods=["GET"])
def obtener_estado_acciones(solicitud_id):
    """
    Obtiene el estado actual de todas las acciones post-tratamiento de una solicitud.

    Retorna estado de cada decisión y sus fuentes.
    """
    guard, user = _require_solicitud_access(solicitud_id)
    if guard:
        return guard

    try:
        # Obtener datos de la solicitud
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT data_json FROM solicitudes WHERE id=?",
                (solicitud_id,),
            )
            sol_row = cur.fetchone()
            if not sol_row:
                return error_not_found("Solicitud", solicitud_id)

            data_json = json.loads(sol_row["data_json"] or "{}")
            items = data_json.get("items", [])

        # Obtener todas las decisiones
        decisiones = DecisionAbastecimientoRepository.get_decisiones_solicitud(solicitud_id)

        estados = []
        for decision in decisiones:
            item_idx = decision.get("item_index", 0)
            item = items[item_idx] if item_idx < len(items) else {}

            fuentes = DecisionAbastecimientoRepository.get_fuentes(decision["id"])

            estados.append(
                {
                    "decision_id": decision["id"],
                    "item_index": item_idx,
                    "codigo_material": item.get("codigo") or item.get("codigo_material", ""),
                    "descripcion": item.get("descripcion", ""),
                    "estado": decision.get("estado", "pendiente"),
                    "cantidad_solicitada": decision.get("cantidad_solicitada", 0),
                    "cantidad_asignada": decision.get("cantidad_asignada", 0),
                    "fuentes": fuentes,
                    "updated_at": decision.get("updated_at"),
                }
            )

        # Resumen de estados
        resumen = {
            "solicitud_id": solicitud_id,
            "total_items": len(estados),
            "estados": {
                "pendiente": len([e for e in estados if e["estado"] == "pendiente"]),
                "transferencia_solicitada": len(
                    [e for e in estados if e["estado"] == "transferencia_solicitada"]
                ),
                "esperando_confirmacion": len(
                    [e for e in estados if e["estado"] == "esperando_confirmacion"]
                ),
                "confirmado": len([e for e in estados if e["estado"] == "confirmado"]),
                "rechazado": len([e for e in estados if e["estado"] == "rechazado"]),
                "solped_pendiente": len([e for e in estados if e["estado"] == "solped_pendiente"]),
            },
            "items": estados,
        }

        return jsonify({"ok": True, "data": resumen}), 200

    except Exception as e:
        logging.error(f"Error obteniendo estado acciones solicitud {solicitud_id}: {e}")
        return error_internal("Error al obtener estado de acciones")


def _get_responsable_almacen(centro: str, almacen: str) -> str | None:
    """Busca el responsable de un almacén específico."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Buscar en config_almacenes o usuarios con rol almacenero
            cur.execute(
                """
                SELECT u.id_spm
                FROM usuarios u
                WHERE u.centro = ? AND u.rol LIKE '%%almacen%%'
                LIMIT 1
                """,
                (centro,),
            )
            row = cur.fetchone()
            return row["id_spm"] if row else None
    except Exception:
        return None


def _get_referente_centro(centro: str) -> str | None:
    """Busca el referente de un centro específico."""
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Buscar usuario con rol coordinador o jefe del centro
            cur.execute(
                """
                SELECT u.id_spm
                FROM usuarios u
                WHERE u.centro = ? AND (u.rol LIKE '%%coordinador%%' OR u.rol LIKE '%%jefe%%')
                LIMIT 1
                """,
                (centro,),
            )
            row = cur.fetchone()
            return row["id_spm"] if row else None
    except Exception:
        return None


def _actualizar_estado_decision(decision_id: int, nuevo_estado: str):
    """Actualiza el estado de una decisión de abastecimiento."""
    try:
        with get_db_transaction() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE decision_abastecimiento
                SET estado = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (nuevo_estado, decision_id),
            )
    except Exception as e:
        print(f"Error actualizando estado decisión: {e}")
