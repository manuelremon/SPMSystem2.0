"""
Capa Repositorio: Abstracción de acceso a datos SQLite/PostgreSQL
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
    from backend.core.config import settings
    from backend.core.db import is_using_postgresql, _get_postgres_connection
except ImportError:
    from core.config import settings
    from core.db import is_using_postgresql, _get_postgres_connection


def _db_path() -> Path:
    """Obtiene ruta a base de datos desde configuración"""
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    # Para PostgreSQL, retorna path al directorio data para BDs secundarias
    return Path("data/spm.db")


def _connect():
    """Crea conexión a BD con row factory habilitado

    Retorna conexión PostgreSQL cuando está configurado, SQLite en caso contrario.
    Ambos retornan rows tipo dict para compatibilidad.
    """
    if is_using_postgresql():
        return _get_postgres_connection()
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def _table_exists(conn, table_name: str) -> bool:
    """Verifica si una tabla existe (compatible PostgreSQL y SQLite)"""
    cur = conn.cursor()
    try:
        if is_using_postgresql():
            cur.execute(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s)",
                (table_name,),
            )
            result = cur.fetchone()
            if not result:
                return False
            # PostgresCursorWrapper retorna dict-like, accedemos por clave 'exists'
            if hasattr(result, 'get'):
                return bool(result.get('exists', False))
            return bool(result[0]) if result else False
        else:
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table_name,),
            )
            return cur.fetchone() is not None
    except Exception:
        return False


def _connect_catalogo():
    """Crea conexión a BD de catálogo de materiales

    En producción (PostgreSQL), todos los datos están en la misma BD.
    En desarrollo (SQLite), conecta a catalogo_materiales.db separado.
    """
    if is_using_postgresql():
        return _get_postgres_connection()
    catalogo_path = _db_path().parent / "catalogo_materiales.db"
    conn = sqlite3.connect(catalogo_path)
    conn.row_factory = sqlite3.Row
    return conn


def _connect_equivalentes():
    """Crea conexión a BD de equivalencias

    En producción (PostgreSQL), todos los datos están en la misma BD.
    En desarrollo (SQLite), conecta a equivalentes.db separado.
    """
    if is_using_postgresql():
        return _get_postgres_connection()
    equiv_path = _db_path().parent / "equivalentes.db"
    conn = sqlite3.connect(equiv_path)
    conn.row_factory = sqlite3.Row
    return conn


def _connect_sap_data():
    """Crea conexión a BD de datos SAP

    En producción (PostgreSQL), todos los datos están en la misma BD.
    En desarrollo (SQLite), conecta a sap_data.db separado.
    """
    if is_using_postgresql():
        # En PostgreSQL, stock y demás tablas están en la BD principal
        return _get_postgres_connection()
    sap_path = _db_path().parent / "sap_data.db"
    conn = sqlite3.connect(sap_path)
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
            # No cerrar aquí - finally siempre se ejecuta
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
    """Repositorio para operaciones de Material (usa catalogo_materiales.db)"""

    @staticmethod
    def get_info(codigo: str) -> Optional[Dict[str, Any]]:
        """Obtiene información de material desde catalogo_materiales.db"""
        conn = _connect_catalogo()
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
            # En PostgreSQL usamos stock_detalle (view), en SQLite stock_almacenes
            if _table_exists(conn, "stock_detalle"):
                # PostgreSQL: stock_detalle tiene columna 'codigo'
                params = [codigo]
                sql = "SELECT centro, almacen, SUM(cantidad) as cantidad FROM stock_detalle WHERE codigo = ?"
                if centro:
                    sql += " AND centro = ?"
                    params.append(centro)
                if almacen:
                    sql += " AND almacen = ?"
                    params.append(almacen)
                sql += " GROUP BY centro, almacen"

                cur.execute(sql, params)
                rows_raw = [dict(row) for row in cur.fetchall()]
            elif _table_exists(conn, "stock_almacenes"):
                # SQLite fallback: stock_almacenes tiene columna 'codigo_material'
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
                from backend.core.cache_loader import get_stock_cache
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
            centro_val = str(row.get("centro") or "").strip()
            almacen_raw = str(row.get("almacen") or "").strip()
            lote_val = (row.get("lote") or "").upper()

            # Excluir registros con centro o almacén vacío
            if not centro_val or not almacen_raw:
                continue

            almacen_val = almacen_raw.zfill(4)

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
            if not _table_exists(conn, "config_almacenes"):
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
            if not _table_exists(conn, "config_lotes_excluidos"):
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
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(centro, almacen) DO UPDATE SET
                    nombre = excluded.nombre,
                    libre_disponibilidad = excluded.libre_disponibilidad,
                    responsable_id = excluded.responsable_id,
                    excluido = excluded.excluido,
                    updated_at = CURRENT_TIMESTAMP
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


# =============================================================================
# NUEVOS REPOSITORIES PARA INTEGRACIÓN DEL PLANIFICADOR
# =============================================================================


class ProveedorPreciosRepository:
    """Repositorio para precios negociados con proveedores externos"""

    @staticmethod
    def get_precio_vigente(cuit: str, codigo_material: str) -> Optional[Dict[str, Any]]:
        """Obtiene precio negociado vigente para proveedor/material"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id, cuit_proveedor, codigo_material, precio_usd, moneda,
                       fecha_vigencia_desde, fecha_vigencia_hasta, condicion_pago,
                       cantidad_minima, notas
                FROM proveedor_precios_negociados
                WHERE cuit_proveedor = ? AND codigo_material = ? AND activo = 1
                  AND fecha_vigencia_desde <= date('now')
                  AND (fecha_vigencia_hasta IS NULL OR fecha_vigencia_hasta >= date('now'))
                ORDER BY fecha_vigencia_desde DESC
                LIMIT 1
            """,
                (cuit, codigo_material),
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    @staticmethod
    def get_mejores_precios(codigo_material: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Top proveedores con mejor precio para un material"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT p.id, p.cuit_proveedor, p.codigo_material, p.precio_usd, p.moneda,
                       p.condicion_pago, p.cantidad_minima, pe.nombre as proveedor_nombre
                FROM proveedor_precios_negociados p
                LEFT JOIN proveedores_externos pe ON p.cuit_proveedor = pe.cuit
                WHERE p.codigo_material = ? AND p.activo = 1
                  AND p.fecha_vigencia_desde <= date('now')
                  AND (p.fecha_vigencia_hasta IS NULL OR p.fecha_vigencia_hasta >= date('now'))
                ORDER BY p.precio_usd ASC
                LIMIT ?
            """,
                (codigo_material, limit),
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()

    @staticmethod
    def crear_precio(
        cuit_proveedor: str,
        codigo_material: str,
        precio_usd: float,
        fecha_vigencia_desde: str,
        fecha_vigencia_hasta: Optional[str] = None,
        condicion_pago: Optional[str] = None,
        cantidad_minima: int = 1,
        notas: Optional[str] = None,
    ) -> int:
        """Crea un nuevo precio negociado"""
        conn = _connect()
        try:
            cur = conn.cursor()
            sql = """
                INSERT INTO proveedor_precios_negociados
                (cuit_proveedor, codigo_material, precio_usd, fecha_vigencia_desde,
                 fecha_vigencia_hasta, condicion_pago, cantidad_minima, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
            params = (
                cuit_proveedor,
                codigo_material,
                precio_usd,
                fecha_vigencia_desde,
                fecha_vigencia_hasta,
                condicion_pago,
                cantidad_minima,
                notas,
            )
            if is_using_postgresql():
                sql = sql.replace("?", "%s") + " RETURNING id"
                cur.execute(sql, params)
                row = cur.fetchone()
                new_id = row["id"] if isinstance(row, dict) else row[0]
            else:
                cur.execute(sql, params)
                new_id = cur.lastrowid
            conn.commit()
            return new_id
        finally:
            conn.close()

    @staticmethod
    def listar_por_proveedor(cuit: str) -> List[Dict[str, Any]]:
        """Lista todos los precios de un proveedor"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id, cuit_proveedor, codigo_material, precio_usd, moneda,
                       fecha_vigencia_desde, fecha_vigencia_hasta, condicion_pago,
                       cantidad_minima, notas, activo
                FROM proveedor_precios_negociados
                WHERE cuit_proveedor = ?
                ORDER BY codigo_material, fecha_vigencia_desde DESC
            """,
                (cuit,),
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()


class ProveedorInternoRepository:
    """Repositorio para proveedores internos (centros/almacenes con stock)"""

    @staticmethod
    def get_opciones_transferencia(
        codigo_material: str, centro_destino: str
    ) -> List[Dict[str, Any]]:
        """
        Lista centros/almacenes con stock disponible para transferir.
        Excluye el centro destino y almacenes excluidos/sin libre disponibilidad.
        """
        # Obtener config de almacenes
        almacenes_config = ConfigAlmacenesRepository.get_all()
        almacenes_excluidos = {
            f"{c['centro']}_{c['almacen']}" for c in almacenes_config if c.get("excluido")
        }

        # Obtener stock de sap_data.db
        conn_sap = _connect_sap_data()
        opciones = []
        try:
            cur_sap = conn_sap.cursor()

            # Normalizar código de material (quitar ceros a la izquierda si es necesario)
            codigo_norm = codigo_material.lstrip("0") if codigo_material else ""

            # Buscar en tabla stock (la tabla principal de sap_data.db)
            cur_sap.execute(
                """
                SELECT centro, almacen, SUM(stock) as stock_disponible
                FROM stock
                WHERE material = ? AND centro != ? AND stock > 0
                GROUP BY centro, almacen
                ORDER BY SUM(stock) DESC
            """,
                (codigo_material, centro_destino),
            )
            rows = cur_sap.fetchall()

            for row in rows:
                centro = str(row["centro"] or "").strip()
                almacen_raw = str(row["almacen"] or "").strip()

                # Excluir registros con centro o almacén vacío
                if not centro or not almacen_raw:
                    continue

                almacen = almacen_raw.zfill(4)
                key = f"{centro}_{almacen}"

                # Excluir almacenes según config
                if key in almacenes_excluidos:
                    continue

                # Obtener info del proveedor interno
                proveedor_info = ProveedorInternoRepository._get_info_centro(centro, almacen)

                opciones.append(
                    {
                        "centro": centro,
                        "almacen": almacen,
                        "stock_disponible": float(row["stock_disponible"]),
                        "centro_nombre": proveedor_info.get("centro_nombre", f"Centro {centro}"),
                        "almacen_nombre": proveedor_info.get(
                            "almacen_nombre", f"Almacén {almacen}"
                        ),
                        "referente_nombre": proveedor_info.get("referente_nombre"),
                        "referente_email": proveedor_info.get("referente_email"),
                        "contacto_centro": proveedor_info.get("contacto_centro"),
                    }
                )
        except Exception as e:
            logger.warning(f"Error obteniendo opciones transferencia: {e}")
        finally:
            conn_sap.close()

        return opciones

    @staticmethod
    def _get_info_centro(centro: str, almacen: str) -> Dict[str, Any]:
        """Obtiene información del centro/almacén desde proveedores_internos"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT centro_nombre, almacen_nombre, sector, contacto_centro,
                       responsable_centro, referente_nombre, referente_email
                FROM proveedores_internos
                WHERE centro = ? AND almacen = ?
            """,
                (centro, almacen),
            )
            row = cur.fetchone()
            if row:
                return dict(row)
            # Si no está en proveedores_internos, buscar en catalog_centros
            cur.execute("SELECT nombre FROM catalog_centros WHERE codigo = ?", (centro,))
            centro_row = cur.fetchone()
            return {"centro_nombre": centro_row["nombre"] if centro_row else f"Centro {centro}"}
        finally:
            conn.close()

    @staticmethod
    def get_lead_time_transferencia(centro_origen: str, centro_destino: str) -> int:
        """
        Estima días de transferencia entre centros.
        Por defecto 3 días. Podría parametrizarse en el futuro.
        """
        # TODO: Parametrizar según distancia/logística real
        if centro_origen == centro_destino:
            return 1
        return 3


class EquivalenciasRepository:
    """Repositorio para equivalencias de materiales desde equivalentes.db"""

    @staticmethod
    def get_equivalencias_con_score(codigo_material: str) -> List[Dict[str, Any]]:
        """
        Obtiene equivalencias desde equivalentes.db con score dinámico.
        Integra con config_equivalencia_scores para obtener compatibilidad_pct.
        """
        # Primero obtener los scores de configuración
        scores_config = EquivalenciasRepository._get_scores_config()

        conn_equiv = _connect_equivalentes()
        equivalencias = []
        try:
            cur = conn_equiv.cursor()
            # Intentar diferentes estructuras de tabla
            cur.execute(
                """
                SELECT name FROM sqlite_master WHERE type='table'
            """
            )
            tables = [row[0] for row in cur.fetchall()]

            # Buscar tabla de equivalencias
            equiv_table = None
            for t in tables:
                if "equiv" in t.lower():
                    equiv_table = t
                    break

            if not equiv_table:
                logger.warning("No se encontró tabla de equivalencias en equivalentes.db")
                return []

            # Obtener columnas de la tabla
            cur.execute(f"PRAGMA table_info({equiv_table})")
            columns = {row[1].lower() for row in cur.fetchall()}

            # Construir query según columnas disponibles
            if "codigo_original" in columns and "codigo_equivalente" in columns:
                cur.execute(
                    f"""
                    SELECT * FROM {equiv_table}
                    WHERE codigo_original = ? OR codigo_equivalente = ?
                """,
                    (codigo_material, codigo_material),
                )
            elif "material" in columns and "equivalente" in columns:
                cur.execute(
                    f"""
                    SELECT * FROM {equiv_table}
                    WHERE material = ? OR equivalente = ?
                """,
                    (codigo_material, codigo_material),
                )
            else:
                # Query genérica
                cur.execute(f"SELECT * FROM {equiv_table} LIMIT 100")

            for row in cur.fetchall():
                row_dict = dict(row)
                # Normalizar campos
                codigo_equiv = row_dict.get("codigo_equivalente", row_dict.get("equivalente", ""))
                tipo_equiv = row_dict.get("tipo_equiv", row_dict.get("tipo", "E1_ESTRICTA"))

                # Obtener compatibilidad desde config
                compatibilidad = scores_config.get(tipo_equiv, 85)

                equivalencias.append(
                    {
                        "codigo_original": codigo_material,
                        "codigo_equivalente": codigo_equiv,
                        "descripcion_equivalente": row_dict.get(
                            "descripcion", row_dict.get("desc_equivalente", "")
                        ),
                        "tipo_equiv": tipo_equiv,
                        "criterio": row_dict.get("criterio", ""),
                        "motivo_equivalencia": row_dict.get("motivo", row_dict.get("notas", "")),
                        "compatibilidad_pct": compatibilidad,
                    }
                )
        except Exception as e:
            logger.warning(f"Error obteniendo equivalencias: {e}")
        finally:
            conn_equiv.close()

        return equivalencias

    @staticmethod
    def _get_scores_config() -> Dict[str, int]:
        """Obtiene configuración de scores desde config_equivalencia_scores"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT tipo_equiv, compatibilidad_pct
                FROM config_equivalencia_scores WHERE activo = 1
            """
            )
            return {row["tipo_equiv"]: row["compatibilidad_pct"] for row in cur.fetchall()}
        except Exception:
            # Valores por defecto si la tabla no existe
            return {"E0_DUPLICADO": 100, "E1_ESTRICTA": 95, "E2_SUPLIBLE": 85}
        finally:
            conn.close()


class MrpRepository:
    """Repositorio para parámetros MRP desde sap_data.db"""

    @staticmethod
    def get_parametros_mrp(codigo_material: str, centro: str) -> Optional[Dict[str, Any]]:
        """Obtiene parámetros MRP desde sap_data.db"""
        conn_sap = _connect_sap_data()
        try:
            cur = conn_sap.cursor()
            # Buscar tabla MRP
            cur.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type='table' AND (name LIKE '%%mrp%%' OR name LIKE '%%param%%')
            """
            )
            mrp_tables = [row[0] for row in cur.fetchall()]

            if not mrp_tables:
                return None

            # Intentar con la primera tabla MRP encontrada
            for table in mrp_tables:
                try:
                    cur.execute(f"PRAGMA table_info({table})")
                    columns = {row[1].lower() for row in cur.fetchall()}

                    if "material" in columns or "codigo" in columns:
                        material_col = "material" if "material" in columns else "codigo"
                        centro_col = "centro" if "centro" in columns else None

                        if centro_col:
                            cur.execute(
                                f"SELECT * FROM {table} WHERE {material_col} = ? AND {centro_col} = ?",
                                (codigo_material, centro),
                            )
                        else:
                            cur.execute(
                                f"SELECT * FROM {table} WHERE {material_col} = ?",
                                (codigo_material,),
                            )

                        row = cur.fetchone()
                        if row:
                            row_dict = dict(row)
                            return {
                                "punto_pedido": row_dict.get(
                                    "punto_pedido", row_dict.get("pto_pedido", 0)
                                ),
                                "stock_seguridad": row_dict.get(
                                    "stock_seguridad", row_dict.get("stk_seg", 0)
                                ),
                                "stock_maximo": row_dict.get(
                                    "stock_maximo", row_dict.get("stk_max", 0)
                                ),
                                "lote_pedido": row_dict.get("lote_pedido", row_dict.get("lote", 0)),
                                "lead_time": row_dict.get(
                                    "lead_time", row_dict.get("plazo_entrega", 0)
                                ),
                            }
                except Exception as e:
                    logger.debug(f"Error consultando tabla {table}: {e}")
                    continue
        except Exception as e:
            logger.warning(f"Error obteniendo parámetros MRP: {e}")
        finally:
            conn_sap.close()

        return None

    @staticmethod
    def get_pedidos_en_curso(codigo_material: str, centro: str) -> List[Dict[str, Any]]:
        """Lista pedidos pendientes de recepción"""
        conn_sap = _connect_sap_data()
        pedidos = []
        try:
            cur = conn_sap.cursor()
            # Buscar tabla de pedidos
            cur.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type='table' AND (name LIKE '%%pedido%%' OR name LIKE '%%orden%%')
            """
            )
            pedido_tables = [row[0] for row in cur.fetchall()]

            for table in pedido_tables:
                try:
                    cur.execute(f"PRAGMA table_info({table})")
                    columns = {row[1].lower() for row in cur.fetchall()}

                    if "material" in columns or "codigo" in columns:
                        material_col = "material" if "material" in columns else "codigo"
                        cur.execute(
                            f"""
                            SELECT * FROM {table}
                            WHERE {material_col} = ?
                            ORDER BY fecha_entrega
                            LIMIT 10
                        """,
                            (codigo_material,),
                        )
                        for row in cur.fetchall():
                            pedidos.append(dict(row))
                        break
                except Exception:
                    continue
        except Exception as e:
            logger.warning(f"Error obteniendo pedidos en curso: {e}")
        finally:
            conn_sap.close()

        return pedidos

    @staticmethod
    def get_consumo_historico(codigo_material: str, centro: str, meses: int = 12) -> Dict[str, Any]:
        """Obtiene consumo histórico promedio"""
        conn_sap = _connect_sap_data()
        try:
            cur = conn_sap.cursor()
            # Buscar tabla de consumo
            cur.execute(
                """
                SELECT name FROM sqlite_master
                WHERE type='table' AND name LIKE '%%consumo%%'
            """
            )
            consumo_tables = [row[0] for row in cur.fetchall()]

            for table in consumo_tables:
                try:
                    cur.execute(f"PRAGMA table_info({table})")
                    columns = {row[1].lower() for row in cur.fetchall()}

                    if "material" in columns or "codigo" in columns:
                        material_col = "material" if "material" in columns else "codigo"
                        cur.execute(
                            f"""
                            SELECT AVG(cantidad) as promedio, SUM(cantidad) as total,
                                   COUNT(*) as registros
                            FROM {table}
                            WHERE {material_col} = ?
                        """,
                            (codigo_material,),
                        )
                        row = cur.fetchone()
                        if row:
                            return {
                                "promedio_mensual": float(row["promedio"] or 0),
                                "total": float(row["total"] or 0),
                                "registros": int(row["registros"] or 0),
                            }
                except Exception:
                    continue
        except Exception as e:
            logger.warning(f"Error obteniendo consumo histórico: {e}")
        finally:
            conn_sap.close()

        return {"promedio_mensual": 0, "total": 0, "registros": 0}


class DecisionAbastecimientoRepository:
    """Repositorio para decisiones de abastecimiento multi-fuente"""

    @staticmethod
    def get_decision(solicitud_id: int, item_index: int) -> Optional[Dict[str, Any]]:
        """Obtiene decisión de abastecimiento para un item"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id, solicitud_id, item_index, cantidad_solicitada,
                       cantidad_total_asignada, estado, comentario, planner_id,
                       created_at, updated_at
                FROM decision_abastecimiento
                WHERE solicitud_id = ? AND item_index = ?
            """,
                (solicitud_id, item_index),
            )
            row = cur.fetchone()
            if not row:
                return None

            decision = dict(row)
            # Obtener fuentes asociadas
            decision["fuentes"] = DecisionAbastecimientoRepository.get_fuentes(decision["id"])
            return decision
        finally:
            conn.close()

    @staticmethod
    def get_fuentes(decision_id: int) -> List[Dict[str, Any]]:
        """Obtiene fuentes de una decisión"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id, decision_id, tipo_fuente, centro_origen, almacen_origen,
                       cuit_proveedor, proveedor_nombre, codigo_material_equiv,
                       tipo_equivalencia, cantidad_asignada, precio_unitario,
                       precio_es_negociado, plazo_dias, score_opcion, orden_prioridad, notas
                FROM decision_abastecimiento_fuentes
                WHERE decision_id = ?
                ORDER BY orden_prioridad
            """,
                (decision_id,),
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()

    @staticmethod
    def get_decisiones_solicitud(solicitud_id: int) -> List[Dict[str, Any]]:
        """Obtiene todas las decisiones de una solicitud"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT id, solicitud_id, item_index, cantidad_solicitada,
                       cantidad_total_asignada, estado, comentario, planner_id,
                       created_at, updated_at
                FROM decision_abastecimiento
                WHERE solicitud_id = ?
                ORDER BY item_index
            """,
                (solicitud_id,),
            )
            decisiones = []
            for row in cur.fetchall():
                decision = dict(row)
                decision["fuentes"] = DecisionAbastecimientoRepository.get_fuentes(decision["id"])
                decisiones.append(decision)
            return decisiones
        finally:
            conn.close()

    @staticmethod
    def crear_o_actualizar_decision(
        solicitud_id: int,
        item_index: int,
        cantidad_solicitada: float,
        planner_id: str,
        comentario: Optional[str] = None,
    ) -> int:
        """Crea o actualiza cabecera de decisión (UPSERT)"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO decision_abastecimiento
                (solicitud_id, item_index, cantidad_solicitada, planner_id, comentario)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(solicitud_id, item_index) DO UPDATE SET
                    cantidad_solicitada = excluded.cantidad_solicitada,
                    comentario = COALESCE(excluded.comentario, decision_abastecimiento.comentario),
                    updated_at = CURRENT_TIMESTAMP
            """,
                (solicitud_id, item_index, cantidad_solicitada, planner_id, comentario),
            )
            conn.commit()

            # Obtener ID
            cur.execute(
                """
                SELECT id FROM decision_abastecimiento
                WHERE solicitud_id = ? AND item_index = ?
            """,
                (solicitud_id, item_index),
            )
            return cur.fetchone()["id"]
        finally:
            conn.close()

    @staticmethod
    def agregar_fuente(
        decision_id: int,
        tipo_fuente: str,
        cantidad_asignada: float,
        centro_origen: Optional[str] = None,
        almacen_origen: Optional[str] = None,
        cuit_proveedor: Optional[str] = None,
        proveedor_nombre: Optional[str] = None,
        codigo_material_equiv: Optional[str] = None,
        tipo_equivalencia: Optional[str] = None,
        precio_unitario: Optional[float] = None,
        precio_es_negociado: bool = False,
        plazo_dias: Optional[int] = None,
        score_opcion: Optional[float] = None,
        orden_prioridad: int = 1,
        notas: Optional[str] = None,
    ) -> int:
        """Agrega una fuente a la decisión"""
        conn = _connect()
        try:
            cur = conn.cursor()
            sql = """
                INSERT INTO decision_abastecimiento_fuentes
                (decision_id, tipo_fuente, cantidad_asignada, centro_origen, almacen_origen,
                 cuit_proveedor, proveedor_nombre, codigo_material_equiv, tipo_equivalencia,
                 precio_unitario, precio_es_negociado, plazo_dias, score_opcion,
                 orden_prioridad, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            params = (
                decision_id,
                tipo_fuente,
                cantidad_asignada,
                centro_origen,
                almacen_origen,
                cuit_proveedor,
                proveedor_nombre,
                codigo_material_equiv,
                tipo_equivalencia,
                precio_unitario,
                1 if precio_es_negociado else 0,
                plazo_dias,
                score_opcion,
                orden_prioridad,
                notas,
            )
            if is_using_postgresql():
                sql = sql.replace("?", "%s") + " RETURNING id"
                cur.execute(sql, params)
                row = cur.fetchone()
                new_id = row["id"] if isinstance(row, dict) else row[0]
            else:
                cur.execute(sql, params)
                new_id = cur.lastrowid
            conn.commit()

            # Actualizar cantidad total asignada en cabecera
            DecisionAbastecimientoRepository._actualizar_totales(decision_id)

            return new_id
        finally:
            conn.close()

    @staticmethod
    def eliminar_fuente(fuente_id: int) -> bool:
        """Elimina una fuente de la decisión"""
        conn = _connect()
        try:
            cur = conn.cursor()
            # Obtener decision_id antes de eliminar
            cur.execute(
                "SELECT decision_id FROM decision_abastecimiento_fuentes WHERE id = ?",
                (fuente_id,),
            )
            row = cur.fetchone()
            if not row:
                return False

            decision_id = row["decision_id"]

            cur.execute("DELETE FROM decision_abastecimiento_fuentes WHERE id = ?", (fuente_id,))
            conn.commit()

            # Actualizar totales
            DecisionAbastecimientoRepository._actualizar_totales(decision_id)

            return cur.rowcount > 0
        finally:
            conn.close()

    @staticmethod
    def actualizar_cantidad_fuente(fuente_id: int, nueva_cantidad: float) -> bool:
        """Actualiza la cantidad asignada a una fuente"""
        conn = _connect()
        try:
            cur = conn.cursor()
            # Obtener decision_id
            cur.execute(
                "SELECT decision_id FROM decision_abastecimiento_fuentes WHERE id = ?",
                (fuente_id,),
            )
            row = cur.fetchone()
            if not row:
                return False

            decision_id = row["decision_id"]

            cur.execute(
                "UPDATE decision_abastecimiento_fuentes SET cantidad_asignada = ? WHERE id = ?",
                (nueva_cantidad, fuente_id),
            )
            conn.commit()

            # Actualizar totales
            DecisionAbastecimientoRepository._actualizar_totales(decision_id)

            return cur.rowcount > 0
        finally:
            conn.close()

    @staticmethod
    def _actualizar_totales(decision_id: int):
        """Actualiza cantidad total y estado de la decisión"""
        conn = _connect()
        try:
            cur = conn.cursor()
            # Calcular total asignado
            cur.execute(
                """
                SELECT COALESCE(SUM(cantidad_asignada), 0) as total
                FROM decision_abastecimiento_fuentes WHERE decision_id = ?
            """,
                (decision_id,),
            )
            total = cur.fetchone()["total"]

            # Obtener cantidad solicitada
            cur.execute(
                "SELECT cantidad_solicitada FROM decision_abastecimiento WHERE id = ?",
                (decision_id,),
            )
            row = cur.fetchone()
            if not row:
                return

            cantidad_solicitada = row["cantidad_solicitada"]

            # Determinar estado
            if total == 0:
                estado = "pendiente"
            elif total >= cantidad_solicitada:
                estado = "completo"
            else:
                estado = "parcial"

            # Actualizar cabecera
            cur.execute(
                """
                UPDATE decision_abastecimiento
                SET cantidad_total_asignada = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """,
                (total, estado, decision_id),
            )
            conn.commit()
        finally:
            conn.close()

    @staticmethod
    def confirmar_decision(decision_id: int) -> bool:
        """Marca la decisión como confirmada"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE decision_abastecimiento
                SET estado = 'confirmado', updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND estado = 'completo'
            """,
                (decision_id,),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()

    @staticmethod
    def limpiar_fuentes(decision_id: int) -> bool:
        """Elimina todas las fuentes de una decisión"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                "DELETE FROM decision_abastecimiento_fuentes WHERE decision_id = ?",
                (decision_id,),
            )
            conn.commit()

            # Actualizar totales
            DecisionAbastecimientoRepository._actualizar_totales(decision_id)

            return True
        finally:
            conn.close()


class ProveedorExternoRepository:
    """Repositorio para proveedores externos con info completa"""

    @staticmethod
    def list_activos_con_contacto() -> List[Dict[str, Any]]:
        """Lista proveedores externos activos con email y teléfono principal"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT pe.cuit, pe.nombre, pe.direccion, pe.localidad, pe.pais, pe.origen,
                       pe.lead_time_dias, pe.rubro, pe.calificacion,
                       (SELECT email FROM proveedor_ext_emails
                        WHERE cuit_proveedor = pe.cuit AND es_principal = 1 LIMIT 1) as email_principal,
                       (SELECT telefono FROM proveedor_ext_telefonos
                        WHERE cuit_proveedor = pe.cuit LIMIT 1) as telefono_principal
                FROM proveedores_externos pe
                WHERE pe.activo = 1
                ORDER BY pe.nombre
            """
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()

    @staticmethod
    def get_by_cuit(cuit: str) -> Optional[Dict[str, Any]]:
        """Obtiene proveedor externo por CUIT con contactos"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT * FROM proveedores_externos WHERE cuit = ?
            """,
                (cuit,),
            )
            row = cur.fetchone()
            if not row:
                return None

            proveedor = dict(row)

            # Obtener contactos
            cur.execute(
                """
                SELECT * FROM proveedor_ext_contactos WHERE cuit_proveedor = ?
            """,
                (cuit,),
            )
            proveedor["contactos"] = [dict(r) for r in cur.fetchall()]

            # Obtener emails
            cur.execute(
                """
                SELECT * FROM proveedor_ext_emails WHERE cuit_proveedor = ?
            """,
                (cuit,),
            )
            proveedor["emails"] = [dict(r) for r in cur.fetchall()]

            # Obtener teléfonos
            cur.execute(
                """
                SELECT * FROM proveedor_ext_telefonos WHERE cuit_proveedor = ?
            """,
                (cuit,),
            )
            proveedor["telefonos"] = [dict(r) for r in cur.fetchall()]

            return proveedor
        finally:
            conn.close()
