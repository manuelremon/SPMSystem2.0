"""
Repositorio para decisiones de abastecimiento multi-fuente
"""

from typing import Any, Dict, List, Optional

from backend.core.db import is_using_postgresql
from backend.core.repository.base import _connect


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
