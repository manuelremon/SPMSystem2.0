"""
Repositorio para operaciones de Tratamiento de Solicitud
"""

import json
from typing import Any, Dict, List, Optional

from backend.core.repository.base import _connect


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
