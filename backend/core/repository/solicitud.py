"""
Repositorio para operaciones de Solicitud
"""

import json
import logging
from typing import Any, Dict, List, Optional

from backend.core.repository.base import _connect

logger = logging.getLogger(__name__)


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
