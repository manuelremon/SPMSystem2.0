"""
Optimizaciones de Base de Datos para SPM v2.0.
Sprint 8.2 - Pool de conexiones, indices y queries optimizadas.

Provee:
- Pool de conexiones SQLite thread-safe
- Indices optimizados para queries frecuentes
- Queries cacheadas para operaciones costosas
- Helpers de diagnostico y monitoreo
"""

import logging
import sqlite3
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from queue import Empty, Queue
from typing import Any, Dict, Generator, List

from backend.core.cache import cached, catalog_cache, query_cache
from backend.core.config import settings

logger = logging.getLogger(__name__)


# =============================================================================
# Connection Pool para SQLite
# =============================================================================


@dataclass
class PooledConnection:
    """Wrapper para conexiones del pool."""

    conn: sqlite3.Connection
    created_at: float
    last_used: float
    in_use: bool = False


class SQLiteConnectionPool:
    """
    Pool de conexiones SQLite thread-safe.

    SQLite con WAL mode permite multiples lectores concurrentes.
    Este pool gestiona conexiones para reducir overhead de creacion.

    Usage:
        pool = SQLiteConnectionPool(db_path, max_size=5)
        with pool.connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT ...")
    """

    def __init__(
        self,
        db_path: Path,
        max_size: int = 5,
        max_age: int = 300,  # 5 minutos
        check_same_thread: bool = False,
    ):
        """
        Inicializa el pool.

        Args:
            db_path: Ruta al archivo SQLite
            max_size: Maximo numero de conexiones en el pool
            max_age: Edad maxima de una conexion en segundos
            check_same_thread: Si False, permite compartir entre threads
        """
        self._db_path = db_path
        self._max_size = max_size
        self._max_age = max_age
        self._check_same_thread = check_same_thread
        self._pool: Queue = Queue(maxsize=max_size)
        self._active_connections = 0
        self._lock = threading.RLock()
        self._stats = {"created": 0, "reused": 0, "expired": 0, "errors": 0}

    def _create_connection(self) -> sqlite3.Connection:
        """Crea una nueva conexion optimizada."""
        conn = sqlite3.connect(
            str(self._db_path), check_same_thread=self._check_same_thread, timeout=30.0
        )
        conn.row_factory = sqlite3.Row

        # Optimizaciones SQLite
        conn.execute("PRAGMA journal_mode=WAL")  # Write-Ahead Logging
        conn.execute("PRAGMA synchronous=NORMAL")  # Balance seguridad/velocidad
        conn.execute("PRAGMA cache_size=-64000")  # 64MB cache
        conn.execute("PRAGMA temp_store=MEMORY")  # Temp tables en memoria
        conn.execute("PRAGMA mmap_size=268435456")  # 256MB mmap

        self._stats["created"] += 1
        return conn

    @contextmanager
    def connection(self) -> Generator[sqlite3.Connection, None, None]:
        """
        Obtiene una conexion del pool.

        Yields:
            Conexion SQLite configurada
        """
        conn = None
        try:
            conn = self._acquire()
            yield conn
        finally:
            if conn:
                self._release(conn)

    def _acquire(self) -> sqlite3.Connection:
        """Adquiere una conexion del pool o crea una nueva."""
        now = time.time()

        # Intentar reutilizar del pool
        try:
            pooled = self._pool.get_nowait()

            # Verificar si esta expirada
            if now - pooled.created_at > self._max_age:
                try:
                    pooled.conn.close()
                except Exception:
                    pass
                self._stats["expired"] += 1
                return self._create_connection()

            self._stats["reused"] += 1
            return pooled.conn

        except Empty:
            pass

        # Pool vacio - crear nueva conexion
        with self._lock:
            if self._active_connections < self._max_size:
                self._active_connections += 1
                return self._create_connection()

        # Pool lleno - esperar
        try:
            pooled = self._pool.get(timeout=5.0)
            self._stats["reused"] += 1
            return pooled.conn
        except Empty:
            self._stats["errors"] += 1
            raise RuntimeError("Connection pool exhausted")

    def _release(self, conn: sqlite3.Connection) -> None:
        """Devuelve una conexion al pool."""
        try:
            # Verificar que la conexion esta OK
            conn.execute("SELECT 1")

            pooled = PooledConnection(conn=conn, created_at=time.time(), last_used=time.time())

            try:
                self._pool.put_nowait(pooled)
            except Exception:
                # Pool lleno - cerrar conexion
                conn.close()
                with self._lock:
                    self._active_connections -= 1

        except Exception:
            # Conexion corrupta - cerrar
            try:
                conn.close()
            except Exception:
                pass
            with self._lock:
                self._active_connections -= 1

    def close_all(self) -> None:
        """Cierra todas las conexiones del pool."""
        while not self._pool.empty():
            try:
                pooled = self._pool.get_nowait()
                pooled.conn.close()
            except Exception:
                pass

        with self._lock:
            self._active_connections = 0

    def stats(self) -> Dict[str, Any]:
        """Retorna estadisticas del pool."""
        return {
            **self._stats,
            "pool_size": self._pool.qsize(),
            "active": self._active_connections,
            "max_size": self._max_size,
        }


# =============================================================================
# Pools globales para cada BD
# =============================================================================

_pools: Dict[str, SQLiteConnectionPool] = {}
_pools_lock = threading.Lock()


def get_pool(db_name: str = "spm") -> SQLiteConnectionPool:
    """
    Obtiene el pool de conexiones para una BD.

    Args:
        db_name: Nombre de la BD ("spm", "equivalentes", "sap_data")

    Returns:
        Pool de conexiones para esa BD
    """
    with _pools_lock:
        if db_name not in _pools:
            # Determinar ruta de BD
            if settings.DATABASE_URL.startswith("sqlite:///"):
                base_path = Path(settings.DATABASE_URL.split("sqlite:///", 1)[1]).parent
            else:
                base_path = Path("data")

            db_files = {
                "spm": "spm.db",
                "sap_data": "sap_data.db",
                "master_materiales": "master_materiales.db",
                "equivalentes": "master_materiales.db",
                "catalogo_materiales": "master_materiales.db",
            }

            filename = db_files.get(db_name, f"{db_name}.db")
            db_path = base_path / filename

            _pools[db_name] = SQLiteConnectionPool(db_path, max_size=5)

        return _pools[db_name]


@contextmanager
def get_pooled_connection(db_name: str = "spm") -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager para conexion del pool.

    Args:
        db_name: Nombre de la BD

    Yields:
        Conexion SQLite del pool
    """
    pool = get_pool(db_name)
    with pool.connection() as conn:
        yield conn


# =============================================================================
# Indices Optimizados
# =============================================================================

# Indices recomendados para queries frecuentes
RECOMMENDED_INDEXES = {
    "spm": [
        # Solicitudes
        ("idx_solicitudes_estado", "solicitud", "estado"),
        ("idx_solicitudes_centro", "solicitud", "centro"),
        ("idx_solicitudes_sector", "solicitud", "sector"),
        ("idx_solicitudes_fecha", "solicitud", "created_at"),
        ("idx_solicitudes_usuario", "solicitud", "usuario_id"),
        ("idx_solicitudes_estado_fecha", "solicitud", "estado, created_at"),
        # Solicitud Items (Sprint 5.4)
        ("idx_items_solicitud_id", "solicitud_items", "solicitud_id"),
        ("idx_items_material", "solicitud_items", "codigo_material"),
        # Usuarios
        ("idx_usuarios_email", "usuarios", "email"),
        ("idx_usuarios_rol", "usuarios", "rol"),
        ("idx_usuarios_centro_rol", "usuarios", "centro, rol"),
        ("idx_usuarios_activo", "usuarios", "activo"),
        # Notificaciones
        ("idx_notificaciones_usuario", "notificaciones", "usuario_id"),
        ("idx_notificaciones_leida", "notificaciones", "leida"),
        ("idx_notificaciones_usuario_leida", "notificaciones", "usuario_id, leida"),
        # Mensajes
        ("idx_mensajes_solicitud", "mensajes", "solicitud_id"),
        ("idx_mensajes_remitente", "mensajes", "remitente_id"),
        # Audit Log (Sprint 5.4)
        ("idx_audit_usuario", "audit_log", "user_id"),
        ("idx_audit_fecha", "audit_log", "timestamp"),
        ("idx_audit_accion", "audit_log", "action"),
        ("idx_audit_usuario_fecha", "audit_log", "user_id, timestamp"),
        # Presupuestos
        ("idx_presupuestos_centro", "presupuestos", "centro"),
        ("idx_presupuestos_sector", "presupuestos", "sector"),
        ("idx_presupuestos_anio", "presupuestos", "anio"),
    ],
    "sap_data": [
        # Stock
        ("idx_stock_material", "stock_materiales", "material_codigo"),
        ("idx_stock_centro", "stock_materiales", "centro"),
        ("idx_stock_material_centro", "stock_materiales", "material_codigo, centro"),
        # Consumo
        ("idx_consumo_material", "consumo_historico", "material_codigo"),
        ("idx_consumo_fecha", "consumo_historico", "fecha"),
        # Pedidos
        ("idx_pedidos_material", "pedidos_pendientes", "material_codigo"),
        ("idx_pedidos_estado", "pedidos_pendientes", "estado"),
    ],
    "equivalentes": [
        # Equivalencias
        ("idx_equiv_material", "equivalencias", "material_original"),
        ("idx_equiv_equivalente", "equivalencias", "material_equivalente"),
    ],
}


def create_indexes(db_name: str = "spm") -> Dict[str, Any]:
    """
    Crea indices optimizados para una BD.

    Args:
        db_name: Nombre de la BD

    Returns:
        Resultado de la operacion
    """
    indexes = RECOMMENDED_INDEXES.get(db_name, [])
    if not indexes:
        return {"ok": True, "message": "No indexes defined", "created": 0}

    created = 0
    errors = []

    with get_pooled_connection(db_name) as conn:
        cursor = conn.cursor()

        for idx_name, table, columns in indexes:
            try:
                sql = f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({columns})"
                cursor.execute(sql)
                created += 1
            except Exception as e:
                errors.append(f"{idx_name}: {str(e)}")

        conn.commit()

    return {"ok": len(errors) == 0, "created": created, "errors": errors}


def analyze_tables(db_name: str = "spm") -> Dict[str, Any]:
    """
    Ejecuta ANALYZE en todas las tablas para optimizar queries.

    Args:
        db_name: Nombre de la BD

    Returns:
        Resultado de la operacion
    """
    with get_pooled_connection(db_name) as conn:
        cursor = conn.cursor()

        # Obtener tablas
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]

        # Analizar cada tabla
        for table in tables:
            cursor.execute(f"ANALYZE {table}")

        conn.commit()

    return {"ok": True, "tables_analyzed": len(tables), "tables": tables}


# =============================================================================
# Queries Cacheadas
# =============================================================================


@cached(catalog_cache, "centros", ttl=600)
def get_centros_cached() -> List[Dict]:
    """Obtiene lista de centros (cacheada 10 min)."""
    with get_pooled_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM centros WHERE activo = TRUE ORDER BY nombre")
        return [dict(row) for row in cursor.fetchall()]


@cached(catalog_cache, "sectores", ttl=600)
def get_sectores_cached() -> List[Dict]:
    """Obtiene lista de sectores (cacheada 10 min)."""
    with get_pooled_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sectores WHERE activo = TRUE ORDER BY nombre")
        return [dict(row) for row in cursor.fetchall()]


@cached(catalog_cache, "almacenes", ttl=600)
def get_almacenes_cached() -> List[Dict]:
    """Obtiene lista de almacenes (cacheada 10 min)."""
    with get_pooled_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM almacenes WHERE activo = TRUE ORDER BY nombre")
        return [dict(row) for row in cursor.fetchall()]


@cached(query_cache, "solicitudes_count", ttl=30)
def get_solicitudes_count_by_estado() -> Dict[str, int]:
    """Cuenta solicitudes por estado (cacheada 30 seg)."""
    with get_pooled_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT estado, COUNT(*) as count
            FROM solicitud
            GROUP BY estado
        """
        )
        return {row["estado"]: row["count"] for row in cursor.fetchall()}


@cached(query_cache, "materiales_criticos", ttl=60)
def get_materiales_criticos(centro: str) -> List[Dict]:
    """
    Obtiene materiales con stock critico (cacheada 1 min).

    Args:
        centro: Codigo del centro

    Returns:
        Lista de materiales criticos
    """
    with get_pooled_connection("sap_data") as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                material_codigo,
                descripcion,
                stock_actual,
                stock_seguridad,
                punto_pedido,
                (stock_actual - stock_seguridad) as diferencia
            FROM stock_materiales
            WHERE centro = ?
            AND stock_actual < stock_seguridad
            ORDER BY diferencia ASC
            LIMIT 50
        """,
            (centro,),
        )
        return [dict(row) for row in cursor.fetchall()]


# =============================================================================
# Diagnostico y Monitoreo
# =============================================================================


def get_db_stats(db_name: str = "spm") -> Dict[str, Any]:
    """
    Obtiene estadisticas de la BD.

    Args:
        db_name: Nombre de la BD

    Returns:
        Estadisticas de la BD
    """
    with get_pooled_connection(db_name) as conn:
        cursor = conn.cursor()

        # Tamano de la BD
        cursor.execute("PRAGMA page_count")
        page_count = cursor.fetchone()[0]
        cursor.execute("PRAGMA page_size")
        page_size = cursor.fetchone()[0]
        size_bytes = page_count * page_size

        # Conteo de tablas
        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
        table_count = cursor.fetchone()[0]

        # Conteo de indices
        cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='index'")
        index_count = cursor.fetchone()[0]

        # WAL size
        cursor.execute("PRAGMA wal_checkpoint(PASSIVE)")
        wal_info = cursor.fetchone()

        return {
            "db_name": db_name,
            "size_mb": round(size_bytes / (1024 * 1024), 2),
            "page_count": page_count,
            "page_size": page_size,
            "table_count": table_count,
            "index_count": index_count,
            "wal_pages": wal_info[1] if wal_info else 0,
        }


def get_all_pool_stats() -> Dict[str, Any]:
    """Obtiene estadisticas de todos los pools."""
    with _pools_lock:
        return {name: pool.stats() for name, pool in _pools.items()}


def explain_query(db_name: str, query: str) -> List[Dict]:
    """
    Explica el plan de ejecucion de una query.

    ADVERTENCIA: Esta función ejecuta queries arbitrarias. Solo usar con
    queries generadas internamente, NUNCA con entrada de usuario.

    Args:
        db_name: Nombre de la BD
        query: Query SQL a analizar (solo SELECT permitido)

    Returns:
        Plan de ejecucion

    Raises:
        ValueError: Si la query no es SELECT
    """
    # Validación básica: solo permitir SELECT para evitar modificaciones
    query_upper = query.strip().upper()
    if not query_upper.startswith("SELECT"):
        raise ValueError("Solo se permiten queries SELECT para explain")

    with get_pooled_connection(db_name) as conn:
        cursor = conn.cursor()
        cursor.execute(f"EXPLAIN QUERY PLAN {query}")
        return [dict(row) for row in cursor.fetchall()]


def optimize_database(db_name: str = "spm") -> Dict[str, Any]:
    """
    Ejecuta optimizaciones en la BD.

    Args:
        db_name: Nombre de la BD

    Returns:
        Resultado de las optimizaciones
    """
    results = {}

    # Crear indices
    results["indexes"] = create_indexes(db_name)

    # Analizar tablas
    results["analyze"] = analyze_tables(db_name)

    # VACUUM (compactar BD)
    with get_pooled_connection(db_name) as conn:
        try:
            conn.execute("VACUUM")
            results["vacuum"] = {"ok": True}
        except Exception as e:
            results["vacuum"] = {"ok": False, "error": str(e)}

    return results
