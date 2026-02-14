"""
Servicio de Formulas SPM para Dashboards.

Ejecuta formulas personalizadas que conectan con los datos de SPM:
- SPM.STOCK: Datos de inventario
- SPM.BUDGET: Datos de presupuesto
- SPM.SOLICITUDES: Datos de solicitudes
- SPM.FORECAST: Predicciones de demanda
- SPM.MRP: Alertas y KPIs MRP
"""

import threading
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.core.dashboard_schemas import FormulaResult
from backend.core.db import get_db_connection, is_using_postgresql


class _ConnectionWrapper:
    """Wrapper para conexion"""

    def __init__(self, ctx):
        self._ctx = ctx
        self._conn = None

    def __enter__(self):
        self._conn = self._ctx.__enter__()
        return self

    def __exit__(self, *args):
        return self._ctx.__exit__(*args)

    def cursor(self):
        return self._conn.cursor()

    def close(self):
        try:
            self._ctx.__exit__(None, None, None)
        except Exception:
            pass


def _connect():
    wrapper = _ConnectionWrapper(get_db_connection())
    wrapper.__enter__()
    return wrapper


def _execute(cursor, sql, params=None):
    if is_using_postgresql():
        sql = sql.replace("?", "%s")
    return cursor.execute(sql, params or ())


def _fetchone(cursor):
    row = cursor.fetchone()
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    return dict(row) if hasattr(row, "keys") else row


def _fetchall(cursor):
    rows = cursor.fetchall()
    if not rows:
        return []
    if isinstance(rows[0], dict):
        return rows
    return [dict(row) if hasattr(row, "keys") else row for row in rows]


# ============================================================================
# Cache simple en memoria
# ============================================================================

_formula_cache: Dict[str, Dict[str, Any]] = {}
_cache_ttl = 60  # segundos
_formula_cache_lock = threading.Lock()


def _get_cache_key(formula: str, params: List[Any]) -> str:
    """Genera clave de cache unica"""
    return f"{formula}:{':'.join(str(p) for p in params)}"


def _get_cached(key: str) -> Optional[Any]:
    """Obtiene valor de cache si no ha expirado"""
    with _formula_cache_lock:
        if key in _formula_cache:
            entry = _formula_cache[key]
            if time.time() - entry["timestamp"] < _cache_ttl:
                return entry["value"]
            del _formula_cache[key]
        return None


def _set_cache(key: str, value: Any):
    """Guarda valor en cache"""
    with _formula_cache_lock:
        # Enforce max size of 200 entries
        if len(_formula_cache) >= 200:
            # Remove oldest quarter
            oldest = sorted(_formula_cache.items(), key=lambda x: x[1]["timestamp"])[:50]
            for k, _ in oldest:
                del _formula_cache[k]
        _formula_cache[key] = {
            "value": value,
            "timestamp": time.time(),
        }


# ============================================================================
# Ejecutores de Formulas
# ============================================================================


class StockFormulas:
    """Formulas de inventario/stock"""

    # Campos que vienen de la tabla stock (agregados)
    _STOCK_FIELDS = {"stock_actual", "stock_valorizado"}
    # Campos que vienen de materiales_bbdd
    _MATERIAL_FIELDS = {"punto_reorden", "stock_seguridad", "stock_maximo", "consumo_promedio"}

    @staticmethod
    def stock(material: str, centro: str, campo: str) -> FormulaResult:
        """
        =SPM.STOCK(material, centro, campo)

        Campos disponibles:
        - stock_actual: Stock disponible (suma de stock en todos los almacenes)
        - stock_valorizado: Valor total del stock
        - punto_reorden: Punto de pedido (de materiales_bbdd)
        - stock_seguridad: Stock de seguridad (de materiales_bbdd)
        - stock_maximo: Stock maximo (de materiales_bbdd)
        - consumo_promedio: Consumo promedio anual (de materiales_bbdd)
        """
        start = time.time()
        cache_key = _get_cache_key("SPM.STOCK", [material, centro, campo])
        cached = _get_cached(cache_key)
        if cached is not None:
            return FormulaResult(success=True, value=cached, cached=True, execution_time_ms=(time.time() - start) * 1000)

        all_fields = StockFormulas._STOCK_FIELDS | StockFormulas._MATERIAL_FIELDS
        if campo not in all_fields:
            return FormulaResult(
                success=False,
                error_code="INVALID_FIELD",
                error_message=f"Campo '{campo}' no valido. Opciones: {sorted(all_fields)}",
                execution_time_ms=(time.time() - start) * 1000,
            )

        conn = _ConnectionWrapper(get_db_connection("sap_data"))
        conn.__enter__()
        try:
            cur = conn.cursor()

            if campo in StockFormulas._STOCK_FIELDS:
                col = "stock" if campo == "stock_actual" else "stock_valorizado"
                _execute(
                    cur,
                    f"SELECT COALESCE(SUM({col}), 0) as valor FROM stock WHERE material = ? AND centro = ?",
                    (material, centro),
                )
            else:
                col_map = {
                    "punto_reorden": "punto_de_pedido",
                    "stock_seguridad": "stock_de_seguridad",
                    "stock_maximo": "stock_maximo",
                    "consumo_promedio": "consumo_promedio_anual",
                }
                col = col_map[campo]
                _execute(
                    cur,
                    f"SELECT COALESCE({col}, 0) as valor FROM materiales_bbdd WHERE codigo_material = ? AND centro = ?",
                    (material, centro),
                )

            row = _fetchone(cur)

            if not row:
                return FormulaResult(
                    success=False,
                    error_code="NOT_FOUND",
                    error_message=f"Material {material} no encontrado en centro {centro}",
                    execution_time_ms=(time.time() - start) * 1000,
                )

            value = row.get("valor", 0) or 0
            _set_cache(cache_key, value)

            return FormulaResult(
                success=True,
                value=value,
                execution_time_ms=(time.time() - start) * 1000,
            )
        finally:
            conn.close()


class MRPFormulas:
    """Formulas de MRP"""

    @staticmethod
    def alertas(centro: str, severidad: str = None) -> FormulaResult:
        """
        =SPM.MRP.ALERTAS(centro, severidad)

        Cuenta alertas MRP por centro y opcionalmente severidad.
        Severidades: danger, warning, info
        """
        start = time.time()
        cache_key = _get_cache_key("SPM.MRP.ALERTAS", [centro, severidad or "all"])
        cached = _get_cached(cache_key)
        if cached is not None:
            return FormulaResult(success=True, value=cached, cached=True, execution_time_ms=(time.time() - start) * 1000)

        conn = _connect()
        try:
            cur = conn.cursor()

            if severidad:
                _execute(
                    cur,
                    "SELECT COUNT(*) as cnt FROM alertas_mrp WHERE centro = ? AND severidad = ? AND estado = 'activa'",
                    (centro, severidad),
                )
            else:
                _execute(
                    cur,
                    "SELECT COUNT(*) as cnt FROM alertas_mrp WHERE centro = ? AND estado = 'activa'",
                    (centro,),
                )

            row = _fetchone(cur)
            value = row["cnt"] if row else 0
            _set_cache(cache_key, value)

            return FormulaResult(
                success=True,
                value=value,
                execution_time_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            return FormulaResult(
                success=False,
                value=0,
                error_code="QUERY_ERROR",
                error_message=f"Error consultando alertas MRP: {e}",
                execution_time_ms=(time.time() - start) * 1000,
            )
        finally:
            conn.close()


class BudgetFormulas:
    """Formulas de presupuesto"""

    @staticmethod
    def budget(centro: str, sector: str, campo: str) -> FormulaResult:
        """
        =SPM.BUDGET(centro, sector, campo)

        Campos disponibles:
        - monto_usd: Presupuesto total
        - saldo_usd: Saldo disponible
        - consumido_usd: Monto consumido
        - porcentaje_consumido: Porcentaje consumido
        """
        start = time.time()
        cache_key = _get_cache_key("SPM.BUDGET", [centro, sector, campo])
        cached = _get_cached(cache_key)
        if cached is not None:
            return FormulaResult(success=True, value=cached, cached=True, execution_time_ms=(time.time() - start) * 1000)

        conn = _connect()
        try:
            cur = conn.cursor()

            _execute(
                cur,
                "SELECT monto_cents, saldo_cents FROM presupuesto WHERE centro = ? AND sector = ?",
                (centro, sector),
            )
            row = _fetchone(cur)

            if not row:
                return FormulaResult(
                    success=False,
                    error_code="NOT_FOUND",
                    error_message=f"Presupuesto no encontrado para centro {centro}, sector {sector}",
                    execution_time_ms=(time.time() - start) * 1000,
                )

            monto_cents = row.get("monto_cents", 0)
            saldo_cents = row.get("saldo_cents", 0)
            consumido_cents = monto_cents - saldo_cents

            campo_values = {
                "monto_usd": monto_cents / 100,
                "saldo_usd": saldo_cents / 100,
                "consumido_usd": consumido_cents / 100,
                "porcentaje_consumido": (consumido_cents / monto_cents * 100) if monto_cents > 0 else 0,
            }

            if campo not in campo_values:
                return FormulaResult(
                    success=False,
                    error_code="INVALID_FIELD",
                    error_message=f"Campo '{campo}' no valido. Opciones: {list(campo_values.keys())}",
                    execution_time_ms=(time.time() - start) * 1000,
                )

            value = campo_values[campo]
            _set_cache(cache_key, value)

            return FormulaResult(
                success=True,
                value=round(value, 2),
                execution_time_ms=(time.time() - start) * 1000,
            )
        finally:
            conn.close()

    @staticmethod
    def ledger(centro: str, desde: str = None, hasta: str = None) -> FormulaResult:
        """
        =SPM.BUDGET.LEDGER(centro, desde, hasta)

        Retorna movimientos del ledger de presupuesto.
        """
        start = time.time()

        conn = _connect()
        try:
            cur = conn.cursor()

            sql = "SELECT * FROM presupuesto_ledger WHERE centro = ?"
            params = [centro]

            if desde:
                sql += " AND created_at >= ?"
                params.append(desde)
            if hasta:
                sql += " AND created_at <= ?"
                params.append(hasta)

            sql += " ORDER BY created_at DESC LIMIT 100"

            _execute(cur, sql, tuple(params))
            rows = _fetchall(cur)

            # Convertir a lista de dicts simplificados
            entries = []
            for row in rows:
                entries.append({
                    "id": row.get("id"),
                    "tipo": row.get("tipo_movimiento"),
                    "monto_usd": row.get("monto_cents", 0) / 100,
                    "saldo_usd": row.get("saldo_posterior_cents", 0) / 100,
                    "fecha": row.get("created_at"),
                })

            return FormulaResult(
                success=True,
                value=entries,
                execution_time_ms=(time.time() - start) * 1000,
            )
        finally:
            conn.close()


class SolicitudesFormulas:
    """Formulas de solicitudes"""

    @staticmethod
    def count(estado: str = None, centro: str = None, desde: str = None, hasta: str = None) -> FormulaResult:
        """
        =SPM.SOLICITUDES.COUNT(estado, centro, desde, hasta)

        Cuenta solicitudes por criterios.
        """
        start = time.time()
        cache_key = _get_cache_key("SPM.SOLICITUDES.COUNT", [estado or "", centro or "", desde or "", hasta or ""])
        cached = _get_cached(cache_key)
        if cached is not None:
            return FormulaResult(success=True, value=cached, cached=True, execution_time_ms=(time.time() - start) * 1000)

        conn = _connect()
        try:
            cur = conn.cursor()

            sql = "SELECT COUNT(*) as cnt FROM solicitud WHERE 1=1"
            params = []

            if estado:
                sql += " AND estado = ?"
                params.append(estado)
            if centro:
                sql += " AND centro = ?"
                params.append(centro)
            if desde:
                sql += " AND created_at >= ?"
                params.append(desde)
            if hasta:
                sql += " AND created_at <= ?"
                params.append(hasta)

            _execute(cur, sql, tuple(params))
            row = _fetchone(cur)

            value = row["cnt"] if row else 0
            _set_cache(cache_key, value)

            return FormulaResult(
                success=True,
                value=value,
                execution_time_ms=(time.time() - start) * 1000,
            )
        finally:
            conn.close()

    @staticmethod
    def sum(campo: str, filtros: Dict[str, Any] = None) -> FormulaResult:
        """
        =SPM.SOLICITUDES.SUM(campo, filtros)

        Suma un campo de solicitudes con filtros opcionales.
        """
        start = time.time()

        # Campos validos para sumar (whitelist por seguridad)
        campos_validos = ["monto_total", "cantidad_items"]

        if campo not in campos_validos:
            return FormulaResult(
                success=False,
                error_code="INVALID_FIELD",
                error_message=f"Campo '{campo}' no valido para suma. Opciones: {campos_validos}",
                execution_time_ms=(time.time() - start) * 1000,
            )

        conn = _connect()
        try:
            cur = conn.cursor()

            sql = f"SELECT COALESCE(SUM({campo}), 0) as total FROM solicitud WHERE 1=1"
            params = []

            if filtros:
                if filtros.get("estado"):
                    sql += " AND estado = ?"
                    params.append(filtros["estado"])
                if filtros.get("centro"):
                    sql += " AND centro = ?"
                    params.append(filtros["centro"])

            _execute(cur, sql, tuple(params))
            row = _fetchone(cur)

            value = row["total"] if row else 0

            return FormulaResult(
                success=True,
                value=value,
                execution_time_ms=(time.time() - start) * 1000,
            )
        finally:
            conn.close()


class ForecastFormulas:
    """Formulas de forecast/prediccion"""

    @staticmethod
    def forecast(material: str, dias: int = 30, modelo: str = "arima") -> FormulaResult:
        """
        =SPM.FORECAST(material, dias, modelo)

        Obtiene prediccion de demanda para un material.
        Modelos: arima, prophet, xgboost
        """
        start = time.time()
        cache_key = _get_cache_key("SPM.FORECAST", [material, dias, modelo])
        cached = _get_cached(cache_key)
        if cached is not None:
            return FormulaResult(success=True, value=cached, cached=True, execution_time_ms=(time.time() - start) * 1000)

        try:
            # Intentar usar el servicio de AI
            from backend.services.ai_service import AIService

            result = AIService.get_demand_forecast(material, dias, modelo)

            if result and "prediction" in result:
                value = result["prediction"]
                _set_cache(cache_key, value)
                return FormulaResult(
                    success=True,
                    value=value,
                    execution_time_ms=(time.time() - start) * 1000,
                )

            return FormulaResult(
                success=False,
                error_code="FORECAST_ERROR",
                error_message="No se pudo generar prediccion",
                execution_time_ms=(time.time() - start) * 1000,
            )

        except ImportError:
            return FormulaResult(
                success=False,
                error_code="NOT_AVAILABLE",
                error_message="Servicio de forecast no disponible",
                execution_time_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            return FormulaResult(
                success=False,
                error_code="FORECAST_ERROR",
                error_message=str(e),
                execution_time_ms=(time.time() - start) * 1000,
            )

    @staticmethod
    def accuracy(material: str, modelo: str = "arima") -> FormulaResult:
        """
        =SPM.FORECAST.ACCURACY(material, modelo)

        Obtiene metricas de precision del modelo.
        """
        start = time.time()

        try:
            from backend.services.ai_service import AIService

            result = AIService.get_model_accuracy(material, modelo)

            if result:
                return FormulaResult(
                    success=True,
                    value=result,
                    execution_time_ms=(time.time() - start) * 1000,
                )

            return FormulaResult(
                success=False,
                error_code="NOT_FOUND",
                error_message="Metricas no disponibles para este material/modelo",
                execution_time_ms=(time.time() - start) * 1000,
            )

        except ImportError:
            return FormulaResult(
                success=False,
                error_code="NOT_AVAILABLE",
                error_message="Servicio de forecast no disponible",
                execution_time_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            return FormulaResult(
                success=False,
                error_code="ERROR",
                error_message=str(e),
                execution_time_ms=(time.time() - start) * 1000,
            )


# ============================================================================
# Ejecutor Principal
# ============================================================================


class FormulaExecutor:
    """Ejecutor principal de formulas SPM"""

    # Registro de formulas
    FORMULAS = {
        "SPM.STOCK": StockFormulas.stock,
        "SPM.MRP.ALERTAS": MRPFormulas.alertas,
        "SPM.BUDGET": BudgetFormulas.budget,
        "SPM.BUDGET.LEDGER": BudgetFormulas.ledger,
        "SPM.SOLICITUDES.COUNT": SolicitudesFormulas.count,
        "SPM.SOLICITUDES.SUM": SolicitudesFormulas.sum,
        "SPM.FORECAST": ForecastFormulas.forecast,
        "SPM.FORECAST.ACCURACY": ForecastFormulas.accuracy,
    }

    @staticmethod
    def execute(formula: str, params: List[Any], user_id: str = None, user_roles: List[str] = None) -> FormulaResult:
        """
        Ejecuta una formula SPM.

        Args:
            formula: Nombre de la formula (ej: "SPM.STOCK")
            params: Lista de parametros
            user_id: ID del usuario (para verificacion de permisos)
            user_roles: Roles del usuario

        Returns:
            FormulaResult con el resultado o error
        """
        start = time.time()

        # Normalizar nombre de formula
        formula_upper = formula.upper().replace("=", "").strip()

        if formula_upper not in FormulaExecutor.FORMULAS:
            return FormulaResult(
                success=False,
                error_code="UNKNOWN_FORMULA",
                error_message=f"Formula '{formula}' no reconocida. Formulas disponibles: {list(FormulaExecutor.FORMULAS.keys())}",
                execution_time_ms=(time.time() - start) * 1000,
            )

        try:
            # Obtener funcion y ejecutar con parametros
            func = FormulaExecutor.FORMULAS[formula_upper]
            return func(*params)

        except TypeError as e:
            return FormulaResult(
                success=False,
                error_code="INVALID_PARAMS",
                error_message=f"Parametros invalidos: {str(e)}",
                execution_time_ms=(time.time() - start) * 1000,
            )
        except Exception as e:
            return FormulaResult(
                success=False,
                error_code="EXECUTION_ERROR",
                error_message=str(e),
                execution_time_ms=(time.time() - start) * 1000,
            )

    @staticmethod
    def clear_cache():
        """Limpia la cache de formulas"""
        with _formula_cache_lock:
            _formula_cache.clear()

    @staticmethod
    def set_cache_ttl(ttl_seconds: int):
        """Configura el TTL de la cache"""
        global _cache_ttl
        _cache_ttl = ttl_seconds
