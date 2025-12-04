"""
Gestor de transacciones atomicas para presupuesto.

Usa BEGIN IMMEDIATE para obtener write-lock al inicio,
previniendo race conditions en operaciones concurrentes.
"""

import sqlite3
from pathlib import Path
from typing import Optional

try:
    from backend_v2.core.budget_schemas import (BudgetOperationResult,
                                                TipoMovimiento,
                                                TransactionContext)
    from backend_v2.core.config import settings
except ImportError:
    from core.budget_schemas import (BudgetOperationResult, TipoMovimiento,
                                     TransactionContext)
    from core.config import settings


def _db_path() -> Path:
    """Obtiene ruta a base de datos desde configuracion"""
    if settings.DATABASE_URL.startswith("sqlite:///"):
        return Path(settings.DATABASE_URL.split("sqlite:///", 1)[1])
    return Path("spm.db")


class AtomicBudgetTransaction:
    """
    Gestor de transacciones atomicas para presupuesto.

    Usa BEGIN IMMEDIATE para obtener write-lock al inicio,
    previniendo race conditions en operaciones concurrentes.

    Uso:
        with AtomicBudgetTransaction() as txn:
            result = txn.consumir_presupuesto(...)
            if not result.success:
                # La transaccion se revierte automaticamente
                return result
            # Continuar con mas operaciones...
        # Commit automatico al salir del with
    """

    def __init__(self, db_path: Optional[str] = None):
        self._db_path = Path(db_path) if db_path else _db_path()
        self._conn: Optional[sqlite3.Connection] = None

    def __enter__(self):
        self._conn = sqlite3.connect(str(self._db_path), timeout=30)
        self._conn.row_factory = sqlite3.Row
        # IMMEDIATE = adquirir write-lock inmediatamente (evita race conditions)
        self._conn.execute("BEGIN IMMEDIATE")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._conn:
            if exc_type is not None:
                self._conn.rollback()
            else:
                self._conn.commit()
            self._conn.close()
        return False

    @property
    def cursor(self) -> sqlite3.Cursor:
        """Acceso al cursor para operaciones adicionales"""
        if not self._conn:
            raise RuntimeError("Transaccion no iniciada")
        return self._conn.cursor()

    def consumir_presupuesto(
        self,
        centro: str,
        sector: str,
        monto_cents: int,
        solicitud_id: int,
        ctx: TransactionContext,
        idempotency_key: Optional[str] = None,
    ) -> BudgetOperationResult:
        """
        Consume presupuesto de forma atomica.

        Args:
            centro: Centro de costos
            sector: Sector
            monto_cents: Monto a consumir en centavos (positivo)
            solicitud_id: ID de solicitud relacionada
            ctx: Contexto de transaccion
            idempotency_key: Clave para idempotencia (opcional)

        Returns:
            BudgetOperationResult con el resultado de la operacion
        """
        if monto_cents <= 0:
            return BudgetOperationResult(
                success=False, error_code="invalid_amount", error_message="Monto debe ser positivo"
            )

        idem_key = idempotency_key or f"consumo_{solicitud_id}_{ctx.timestamp}"
        cur = self.cursor

        # Verificar idempotencia (operacion ya ejecutada?)
        cur.execute(
            "SELECT id, saldo_posterior_cents FROM presupuesto_ledger WHERE idempotency_key = ?",
            (idem_key,),
        )
        existing = cur.fetchone()
        if existing:
            # Operacion ya ejecutada - retornar resultado previo
            return BudgetOperationResult(
                success=True,
                saldo_anterior_cents=0,
                saldo_posterior_cents=existing["saldo_posterior_cents"],
                ledger_id=existing["id"],
            )

        # Obtener saldo actual (ya tenemos write-lock por BEGIN IMMEDIATE)
        cur.execute(
            "SELECT saldo_cents, version FROM presupuestos WHERE centro = ? AND sector = ?",
            (centro, sector),
        )
        row = cur.fetchone()

        if not row:
            return BudgetOperationResult(
                success=False,
                error_code="presupuesto_not_found",
                error_message=f"No existe presupuesto para centro={centro}, sector={sector}",
            )

        saldo_actual = row["saldo_cents"]
        version_actual = row["version"]

        if saldo_actual < monto_cents:
            return BudgetOperationResult(
                success=False,
                saldo_anterior_cents=saldo_actual,
                saldo_posterior_cents=saldo_actual,
                error_code="saldo_insuficiente",
                error_message=f"Saldo insuficiente: disponible=${saldo_actual / 100:.2f}, requerido=${monto_cents / 100:.2f}",
            )

        nuevo_saldo = saldo_actual - monto_cents

        # Actualizar presupuesto con optimistic locking
        cur.execute(
            """
            UPDATE presupuestos
            SET saldo_cents = ?,
                saldo_usd = ?,
                version = version + 1,
                updated_by = ?
            WHERE centro = ? AND sector = ? AND version = ?
            """,
            (nuevo_saldo, nuevo_saldo / 100, ctx.actor_id, centro, sector, version_actual),
        )

        if cur.rowcount == 0:
            return BudgetOperationResult(
                success=False,
                saldo_anterior_cents=saldo_actual,
                saldo_posterior_cents=saldo_actual,
                error_code="concurrent_modification",
                error_message="El presupuesto fue modificado por otro proceso",
            )

        # Insertar en ledger inmutable (monto negativo = debito)
        cur.execute(
            """
            INSERT INTO presupuesto_ledger (
                idempotency_key, centro, sector, tipo_movimiento,
                monto_cents, saldo_anterior_cents, saldo_posterior_cents,
                referencia_tipo, referencia_id,
                actor_id, actor_rol, motivo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                idem_key,
                centro,
                sector,
                TipoMovimiento.CONSUMO_APROBACION.value,
                -monto_cents,
                saldo_actual,
                nuevo_saldo,
                "solicitud",
                solicitud_id,
                ctx.actor_id,
                ctx.actor_rol,
                f"Aprobacion solicitud #{solicitud_id}",
            ),
        )

        ledger_id = cur.lastrowid

        return BudgetOperationResult(
            success=True,
            saldo_anterior_cents=saldo_actual,
            saldo_posterior_cents=nuevo_saldo,
            ledger_id=ledger_id,
        )

    def revertir_consumo(
        self,
        centro: str,
        sector: str,
        monto_cents: int,
        solicitud_id: int,
        ctx: TransactionContext,
        motivo: str = "Reversion por rechazo",
    ) -> BudgetOperationResult:
        """
        Revierte un consumo previo (devuelve saldo).

        Args:
            centro: Centro de costos
            sector: Sector
            monto_cents: Monto a devolver en centavos (positivo)
            solicitud_id: ID de solicitud relacionada
            ctx: Contexto de transaccion
            motivo: Razon de la reversion

        Returns:
            BudgetOperationResult con el resultado
        """
        idem_key = f"reversion_{solicitud_id}_{ctx.timestamp}"
        cur = self.cursor

        # Verificar que exista el consumo original
        cur.execute(
            """
            SELECT id FROM presupuesto_ledger
            WHERE referencia_tipo = 'solicitud'
            AND referencia_id = ?
            AND tipo_movimiento = ?
            """,
            (solicitud_id, TipoMovimiento.CONSUMO_APROBACION.value),
        )
        if not cur.fetchone():
            return BudgetOperationResult(
                success=False,
                error_code="consumo_not_found",
                error_message="No se encontro consumo original para revertir",
            )

        # Obtener saldo actual
        cur.execute(
            "SELECT saldo_cents FROM presupuestos WHERE centro = ? AND sector = ?", (centro, sector)
        )
        row = cur.fetchone()
        if not row:
            return BudgetOperationResult(
                success=False,
                error_code="presupuesto_not_found",
                error_message=f"No existe presupuesto para centro={centro}, sector={sector}",
            )

        saldo_actual = row["saldo_cents"]
        nuevo_saldo = saldo_actual + monto_cents

        # Actualizar presupuesto
        cur.execute(
            """
            UPDATE presupuestos
            SET saldo_cents = ?,
                saldo_usd = ?,
                version = version + 1,
                updated_by = ?
            WHERE centro = ? AND sector = ?
            """,
            (nuevo_saldo, nuevo_saldo / 100, ctx.actor_id, centro, sector),
        )

        # Insertar en ledger (monto positivo = credito)
        cur.execute(
            """
            INSERT INTO presupuesto_ledger (
                idempotency_key, centro, sector, tipo_movimiento,
                monto_cents, saldo_anterior_cents, saldo_posterior_cents,
                referencia_tipo, referencia_id,
                actor_id, actor_rol, motivo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                idem_key,
                centro,
                sector,
                TipoMovimiento.REVERSION_RECHAZO.value,
                monto_cents,
                saldo_actual,
                nuevo_saldo,
                "solicitud",
                solicitud_id,
                ctx.actor_id,
                ctx.actor_rol,
                motivo,
            ),
        )

        return BudgetOperationResult(
            success=True,
            saldo_anterior_cents=saldo_actual,
            saldo_posterior_cents=nuevo_saldo,
            ledger_id=cur.lastrowid,
        )

    def aplicar_bur(
        self, centro: str, sector: str, monto_cents: int, bur_id: int, ctx: TransactionContext
    ) -> BudgetOperationResult:
        """
        Aplica Budget Update Request aprobado (aumenta saldo).

        Args:
            centro: Centro de costos
            sector: Sector
            monto_cents: Monto a agregar en centavos
            bur_id: ID del Budget Update Request
            ctx: Contexto de transaccion

        Returns:
            BudgetOperationResult con el resultado
        """
        idem_key = f"bur_{bur_id}_{ctx.timestamp}"
        cur = self.cursor

        # Obtener saldo actual
        cur.execute(
            "SELECT monto_cents, saldo_cents FROM presupuestos WHERE centro = ? AND sector = ?",
            (centro, sector),
        )
        row = cur.fetchone()
        if not row:
            return BudgetOperationResult(
                success=False,
                error_code="presupuesto_not_found",
                error_message=f"No existe presupuesto para centro={centro}, sector={sector}",
            )

        monto_actual = row["monto_cents"]
        saldo_actual = row["saldo_cents"]
        nuevo_monto = monto_actual + monto_cents
        nuevo_saldo = saldo_actual + monto_cents

        # Actualizar presupuesto (monto total y saldo)
        cur.execute(
            """
            UPDATE presupuestos
            SET monto_cents = ?,
                monto_usd = ?,
                saldo_cents = ?,
                saldo_usd = ?,
                version = version + 1,
                updated_by = ?
            WHERE centro = ? AND sector = ?
            """,
            (
                nuevo_monto,
                nuevo_monto / 100,
                nuevo_saldo,
                nuevo_saldo / 100,
                ctx.actor_id,
                centro,
                sector,
            ),
        )

        # Insertar en ledger
        cur.execute(
            """
            INSERT INTO presupuesto_ledger (
                idempotency_key, centro, sector, tipo_movimiento,
                monto_cents, saldo_anterior_cents, saldo_posterior_cents,
                referencia_tipo, referencia_id,
                actor_id, actor_rol, motivo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                idem_key,
                centro,
                sector,
                TipoMovimiento.BUR_APROBADO.value,
                monto_cents,
                saldo_actual,
                nuevo_saldo,
                "bur",
                bur_id,
                ctx.actor_id,
                ctx.actor_rol,
                f"BUR #{bur_id} aprobado",
            ),
        )

        return BudgetOperationResult(
            success=True,
            saldo_anterior_cents=saldo_actual,
            saldo_posterior_cents=nuevo_saldo,
            ledger_id=cur.lastrowid,
        )
