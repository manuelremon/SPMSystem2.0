"""
Repositorio para configuración de almacenes y lotes
"""

from typing import Any, Dict, List, Optional

from backend.core.repository.base import _connect, _table_exists


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
                LEFT JOIN usuario u ON ca.responsable_id = u.id_spm
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
