"""
Capa Repositorio: Abstracción de acceso a datos SQLite
Centraliza todas las operaciones CRUD para facilitar tests, migraciones y cambios de BD
"""

import json
import logging
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Import con manejo de rutas relativas
try:
    from backend_v2.core.config import settings
except ImportError:
    from core.config import settings


def _db_path() -> Path:
    """Obtiene ruta a base de datos desde configuración"""
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


def _connect() -> sqlite3.Connection:
    """Crea conexión a BD con row factory habilitado"""
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    return conn


class SolicitudRepository:
    """Repositorio para operaciones de Solicitud"""

    @staticmethod
    def get_by_id(solicitud_id: int) -> Optional[Dict[str, Any]]:
        """Obtiene solicitud por ID"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id, id_usuario, centro, sector, justificacion, centro_costos,
                       almacen_virtual, criticidad, fecha_necesidad, status, total_monto,
                       planner_id, created_at, updated_at, data_json, aprobador_id
                FROM solicitudes WHERE id = ?
            """,
                (solicitud_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    @staticmethod
    def get_items(solicitud_id: int) -> List[Dict[str, Any]]:
        """Obtiene items de solicitud desde data_json"""
        solicitud = SolicitudRepository.get_by_id(solicitud_id)
        if not solicitud:
            return []
        try:
            data = json.loads(solicitud.get("data_json") or "{}")
            return data.get("items", [])
        except json.JSONDecodeError as e:
            logger.warning(f"Error parseando data_json de solicitud {solicitud_id}: {e}")
            return []

    @staticmethod
    def update_status(solicitud_id: int, status: str) -> bool:
        """Actualiza status de solicitud"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                "UPDATE solicitudes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (status, solicitud_id),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()

    @staticmethod
    def list_aprobadas_para_planner(
        planner_id: Optional[str] = None, centro: Optional[str] = None, sector: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Lista solicitudes aprobadas/en progreso/en tratamiento"""
        conn = _connect()
        try:
            where = ["(status = 'Aprobada' OR status = 'En Progreso' OR status = 'En tratamiento')"]
            params = []

            if planner_id:
                where.append("planner_id = ?")
                params.append(planner_id)
            if centro:
                where.append("centro = ?")
                params.append(centro)
            if sector:
                where.append("sector = ?")
                params.append(sector)

            where_sql = "WHERE " + " AND ".join(where)
            cur = conn.cursor()
            cur.execute(
                f"""
                SELECT id, id_usuario, centro, sector, justificacion, centro_costos,
                       almacen_virtual, criticidad, fecha_necesidad, status, total_monto,
                       planner_id, created_at, updated_at, data_json, aprobador_id
                FROM solicitudes {where_sql}
                ORDER BY updated_at DESC
            """,
                params,
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()


class PresupuestoRepository:
    """Repositorio para operaciones de Presupuesto"""

    @staticmethod
    def get_disponible(centro: str, sector: str) -> Dict[str, float]:
        """Obtiene presupuesto y saldo por centro/sector"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT monto_usd, saldo_usd FROM presupuestos WHERE centro = ? AND sector = ?",
                (centro, sector),
            )
            row = cur.fetchone()
            if row:
                return {"monto": row["monto_usd"], "saldo": row["saldo_usd"]}
            return {"monto": 0, "saldo": 0}
        finally:
            conn.close()


class TratamientoRepository:
    """Repositorio para operaciones de Tratamiento de Solicitud"""

    @staticmethod
    def save_decision(
        solicitud_id: int,
        item_idx: int,
        decision_tipo: str,
        cantidad_aprobada: float,
        codigo_material: Optional[str],
        proveedor_id: Optional[str],
        precio_unitario: Optional[float],
        observaciones: Optional[str],
        updated_by: str,
    ) -> bool:
        """Guarda decisión de tratamiento para un item (UPSERT)"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO solicitud_items_tratamiento
                (solicitud_id, item_index, decision, cantidad_aprobada, codigo_equivalente,
                 proveedor_sugerido, precio_unitario_estimado, comentario, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(solicitud_id, item_index) DO UPDATE SET
                    decision = excluded.decision,
                    cantidad_aprobada = excluded.cantidad_aprobada,
                    codigo_equivalente = excluded.codigo_equivalente,
                    proveedor_sugerido = excluded.proveedor_sugerido,
                    precio_unitario_estimado = excluded.precio_unitario_estimado,
                    comentario = excluded.comentario,
                    updated_by = excluded.updated_by,
                    updated_at = CURRENT_TIMESTAMP
            """,
                (
                    solicitud_id,
                    item_idx,
                    decision_tipo,
                    cantidad_aprobada,
                    codigo_material,
                    proveedor_id,
                    precio_unitario,
                    observaciones,
                    updated_by,
                ),
            )
            conn.commit()
            return True
        except Exception as e:
            conn.close()
            raise e
        finally:
            conn.close()

    @staticmethod
    def get_decisiones(solicitud_id: int) -> List[Dict[str, Any]]:
        """Obtiene decisiones previas de una solicitud"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT item_index, decision, cantidad_aprobada, codigo_equivalente,
                       proveedor_sugerido, precio_unitario_estimado, comentario,
                       updated_by, updated_at
                FROM solicitud_items_tratamiento WHERE solicitud_id = ?
            """,
                (solicitud_id,),
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()

    @staticmethod
    def log_evento(
        solicitud_id: int,
        item_idx: Optional[int],
        tipo: str,
        estado: str,
        payload: Dict[str, Any],
        actor_id: str,
    ) -> bool:
        """Registra evento en auditoria"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO solicitud_tratamiento_log
                (solicitud_id, item_index, actor_id, tipo, estado, payload_json)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (solicitud_id, item_idx, actor_id, tipo, estado, json.dumps(payload)),
            )
            conn.commit()
            return True
        finally:
            conn.close()


class ProveedorRepository:
    """Repositorio para operaciones de Proveedor"""

    @staticmethod
    def list_externos_activos() -> List[Dict[str, Any]]:
        """Lista proveedores externos y activos"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id_proveedor, nombre, plazo_entrega_dias, rating
                FROM proveedores
                WHERE tipo = 'externo' AND activo = 1
            """
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()


class MaterialRepository:
    """Repositorio para operaciones de Material"""

    @staticmethod
    def get_info(codigo: str) -> Optional[Dict[str, Any]]:
        """Obtiene información de material"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT descripcion, precio_usd FROM materiales WHERE codigo = ?", (codigo,)
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    @staticmethod
    def get_stock_detalle(
        codigo: str, centro: Optional[str] = None, almacen: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Obtiene detalle de stock por centro/almacén.
        Filtra almacenes excluidos y lotes excluidos según config.
        Enriquece con libre_disponibilidad y responsable desde config_almacenes.
        """
        # Obtener config de almacenes y lotes excluidos
        almacenes_config = ConfigAlmacenesRepository.get_all()
        lotes_excluidos = ConfigAlmacenesRepository.get_lotes_excluidos()

        # Crear sets para filtrado rápido
        almacenes_excluidos = {
            f"{c['centro']}_{c['almacen']}" for c in almacenes_config if c.get("excluido")
        }
        lotes_excluidos_set = {l.upper() for l in lotes_excluidos}

        # Crear mapa de config por centro_almacen
        config_map = {f"{c['centro']}_{c['almacen']}": c for c in almacenes_config}

        conn = _connect()
        rows_raw = []
        try:
            cur = conn.cursor()
            # Verificar existencia tabla
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='stock_almacenes'"
            )
            if cur.fetchone():
                params = [codigo]
                sql = "SELECT centro, almacen, SUM(cantidad) as cantidad FROM stock_almacenes WHERE codigo_material = ?"
                if centro:
                    sql += " AND centro = ?"
                    params.append(centro)
                if almacen:
                    sql += " AND almacen = ?"
                    params.append(almacen)
                sql += " GROUP BY centro, almacen"

                cur.execute(sql, params)
                rows_raw = [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()

        # Si no hay datos en BD, usar Excel cache
        if not rows_raw:
            try:
                from backend_v2.core.cache_loader import get_stock_cache
            except ImportError:
                from core.cache_loader import get_stock_cache
            df = get_stock_cache()
            if df is not None and not df.empty:

                def _norm(val: str) -> str:
                    base = (val or "").strip()
                    if base.endswith(".0"):
                        base = base[:-2]
                    return base.lstrip("0")

                mask = df["codigo_norm"] == _norm(codigo)
                if centro:
                    mask = mask & (df["centro_norm"] == _norm(centro))
                if almacen:
                    mask = mask & (df["almacen_norm"] == _norm(almacen))
                df_filtered = df.loc[mask]
                if df_filtered.empty:
                    df_filtered = df[df["codigo_norm"] == _norm(codigo)]

                for _, r in (
                    df_filtered.groupby(["centro", "almacen"])
                    .sum(numeric_only=True)
                    .reset_index()
                    .iterrows()
                ):
                    lote_val = None
                    if "lote" in df_filtered.columns:
                        match = df_filtered[
                            (df_filtered["centro"] == r["centro"])
                            & (df_filtered["almacen"] == r["almacen"])
                        ]
                        lote_val = match["lote"].iloc[0] if not match.empty else None
                    elif "Lote" in df_filtered.columns:
                        match = df_filtered[
                            (df_filtered["centro"] == r["centro"])
                            & (df_filtered["almacen"] == r["almacen"])
                        ]
                        lote_val = match["Lote"].iloc[0] if not match.empty else None

                    rows_raw.append(
                        {
                            "centro": str(r["centro"]),
                            "almacen": str(r["almacen"]),
                            "cantidad": float(r["stock"] or 0),
                            "lote": str(lote_val) if lote_val is not None else None,
                        }
                    )

        # Filtrar y enriquecer
        result = []
        for row in rows_raw:
            centro_val = str(row.get("centro", ""))
            almacen_val = str(row.get("almacen", "")).zfill(4)
            lote_val = (row.get("lote") or "").upper()

            # Excluir almacenes según config
            key = f"{centro_val}_{almacen_val}"
            if key in almacenes_excluidos:
                continue

            # Excluir lotes según config
            if lote_val and lote_val in lotes_excluidos_set:
                continue

            # Enriquecer con config
            config = config_map.get(key, {})
            row["almacen"] = almacen_val
            row["libre_disponibilidad"] = bool(config.get("libre_disponibilidad", False))
            row["responsable"] = config.get("responsable_nombre")
            row["nombre_almacen"] = config.get("nombre")

            result.append(row)

        return result


class ConfigAlmacenesRepository:
    """Repositorio para configuración de almacenes y lotes"""

    @staticmethod
    def get_all() -> List[Dict[str, Any]]:
        """Obtiene toda la configuración de almacenes con responsables"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='config_almacenes'"
            )
            if not cur.fetchone():
                return []

            cur.execute(
                """
                SELECT ca.id, ca.centro, ca.almacen, ca.nombre, ca.libre_disponibilidad,
                       ca.responsable_id, ca.excluido, u.nombre as responsable_nombre
                FROM config_almacenes ca
                LEFT JOIN usuarios u ON ca.responsable_id = u.id_spm
                ORDER BY ca.centro, ca.almacen
            """
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()

    @staticmethod
    def get_lotes_excluidos() -> List[str]:
        """Obtiene lista de lotes excluidos"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='config_lotes_excluidos'"
            )
            if not cur.fetchone():
                return []

            cur.execute("SELECT lote FROM config_lotes_excluidos")
            return [row["lote"] for row in cur.fetchall()]
        finally:
            conn.close()

    @staticmethod
    def upsert(
        centro: str,
        almacen: str,
        nombre: str,
        libre_disponibilidad: bool,
        responsable_id: Optional[str],
        excluido: bool = False,
    ) -> bool:
        """Crea o actualiza configuración de almacén"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO config_almacenes (centro, almacen, nombre, libre_disponibilidad, responsable_id, excluido, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(centro, almacen) DO UPDATE SET
                    nombre = excluded.nombre,
                    libre_disponibilidad = excluded.libre_disponibilidad,
                    responsable_id = excluded.responsable_id,
                    excluido = excluded.excluido,
                    updated_at = datetime('now')
            """,
                (
                    centro,
                    almacen,
                    nombre,
                    1 if libre_disponibilidad else 0,
                    responsable_id,
                    1 if excluido else 0,
                ),
            )
            conn.commit()
            return True
        finally:
            conn.close()

    @staticmethod
    def delete(centro: str, almacen: str) -> bool:
        """Elimina configuración de almacén"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                "DELETE FROM config_almacenes WHERE centro = ? AND almacen = ?", (centro, almacen)
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()
