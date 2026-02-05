"""
Repositorio para operaciones de Presupuesto
"""

from typing import Dict

from backend.core.repository.base import _connect


class PresupuestoRepository:
    """Repositorio para operaciones de Presupuesto"""

    @staticmethod
    def get_disponible(centro: str, sector: str) -> Dict[str, float]:
        """Obtiene presupuesto y saldo por centro/sector"""
        conn = _connect()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT monto_usd, saldo_usd FROM presupuesto WHERE centro = ? AND sector = ?",
                (centro, sector),
            )
            row = cur.fetchone()
            if row:
                return {"monto": row["monto_usd"], "saldo": row["saldo_usd"]}
            return {"monto": 0, "saldo": 0}
        finally:
            conn.close()
