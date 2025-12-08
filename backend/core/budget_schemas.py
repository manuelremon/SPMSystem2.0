"""
Schemas/DTOs para el sistema de presupuestos.

Define estructuras de datos para:
- Transacciones de presupuesto (ledger)
- Budget Update Requests (BUR)
- Validaciones y resultados
"""

from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

# ============================================================================
# Enums
# ============================================================================


class TipoMovimiento(str, Enum):
    """Tipos de movimiento en el ledger"""

    CONSUMO_APROBACION = "consumo_aprobacion"
    REVERSION_RECHAZO = "reversion_rechazo"
    AJUSTE_MANUAL = "ajuste_manual"
    BUR_APROBADO = "bur_aprobado"


class NivelAprobacion(str, Enum):
    """Niveles de aprobacion para BUR"""

    L1 = "L1"  # <= 200,000 USD
    L2 = "L2"  # <= 1,000,000 USD
    ADMIN = "ADMIN"  # > 1,000,000 USD


class EstadoBUR(str, Enum):
    """Estados de Budget Update Request"""

    PENDIENTE = "pendiente"
    APROBADO_L1 = "aprobado_l1"
    APROBADO_L2 = "aprobado_l2"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"


# ============================================================================
# Umbrales de aprobacion (en centavos)
# ============================================================================

# 200,000 USD = 20,000,000 cents
UMBRAL_L1_CENTS = 20_000_000

# 1,000,000 USD = 100,000,000 cents
UMBRAL_L2_CENTS = 100_000_000


def determinar_nivel_aprobacion(monto_cents: int) -> NivelAprobacion:
    """Determina nivel de aprobacion requerido segun monto"""
    if monto_cents <= UMBRAL_L1_CENTS:
        return NivelAprobacion.L1
    elif monto_cents <= UMBRAL_L2_CENTS:
        return NivelAprobacion.L2
    return NivelAprobacion.ADMIN


# ============================================================================
# Dataclasses para Presupuesto
# ============================================================================


@dataclass
class PresupuestoInfo:
    """Estado actual de presupuesto de un centro/sector"""

    centro: str
    sector: str
    monto_cents: int
    saldo_cents: int
    version: int = 1

    @property
    def monto_usd(self) -> float:
        return self.monto_cents / 100

    @property
    def saldo_usd(self) -> float:
        return self.saldo_cents / 100

    @property
    def consumido_cents(self) -> int:
        return self.monto_cents - self.saldo_cents

    @property
    def consumido_usd(self) -> float:
        return self.consumido_cents / 100

    @property
    def porcentaje_consumido(self) -> float:
        if self.monto_cents == 0:
            return 0.0
        return (self.consumido_cents / self.monto_cents) * 100

    def to_dict(self) -> Dict[str, Any]:
        return {
            "centro": self.centro,
            "sector": self.sector,
            "monto_cents": self.monto_cents,
            "monto_usd": self.monto_usd,
            "saldo_cents": self.saldo_cents,
            "saldo_usd": self.saldo_usd,
            "consumido_cents": self.consumido_cents,
            "consumido_usd": self.consumido_usd,
            "porcentaje_consumido": round(self.porcentaje_consumido, 2),
            "version": self.version,
        }


@dataclass
class LedgerEntry:
    """Entrada inmutable en el ledger de presupuesto"""

    id: int
    idempotency_key: str
    centro: str
    sector: str
    tipo_movimiento: str
    monto_cents: int
    saldo_anterior_cents: int
    saldo_posterior_cents: int
    referencia_tipo: Optional[str] = None
    referencia_id: Optional[int] = None
    actor_id: str = ""
    actor_rol: Optional[str] = None
    motivo: Optional[str] = None
    created_at: str = ""

    @property
    def monto_usd(self) -> float:
        return self.monto_cents / 100

    @property
    def saldo_anterior_usd(self) -> float:
        return self.saldo_anterior_cents / 100

    @property
    def saldo_posterior_usd(self) -> float:
        return self.saldo_posterior_cents / 100

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "idempotency_key": self.idempotency_key,
            "centro": self.centro,
            "sector": self.sector,
            "tipo_movimiento": self.tipo_movimiento,
            "monto_cents": self.monto_cents,
            "monto_usd": self.monto_usd,
            "saldo_anterior_cents": self.saldo_anterior_cents,
            "saldo_anterior_usd": self.saldo_anterior_usd,
            "saldo_posterior_cents": self.saldo_posterior_cents,
            "saldo_posterior_usd": self.saldo_posterior_usd,
            "referencia_tipo": self.referencia_tipo,
            "referencia_id": self.referencia_id,
            "actor_id": self.actor_id,
            "actor_rol": self.actor_rol,
            "motivo": self.motivo,
            "created_at": self.created_at,
        }

    @classmethod
    def from_row(cls, row: Dict[str, Any]) -> "LedgerEntry":
        """Construye desde fila de BD"""
        return cls(
            id=row.get("id", 0),
            idempotency_key=row.get("idempotency_key", ""),
            centro=row.get("centro", ""),
            sector=row.get("sector", ""),
            tipo_movimiento=row.get("tipo_movimiento", ""),
            monto_cents=row.get("monto_cents", 0),
            saldo_anterior_cents=row.get("saldo_anterior_cents", 0),
            saldo_posterior_cents=row.get("saldo_posterior_cents", 0),
            referencia_tipo=row.get("referencia_tipo"),
            referencia_id=row.get("referencia_id"),
            actor_id=row.get("actor_id", ""),
            actor_rol=row.get("actor_rol"),
            motivo=row.get("motivo"),
            created_at=row.get("created_at", ""),
        )


# ============================================================================
# Dataclasses para Budget Update Request
# ============================================================================


@dataclass
class BudgetUpdateRequest:
    """Solicitud de aumento de presupuesto"""

    id: int
    centro: str
    sector: str
    monto_solicitado_cents: int
    saldo_actual_cents: int
    nivel_aprobacion_requerido: str
    estado: str
    solicitante_id: str
    solicitante_rol: Optional[str] = None
    justificacion: str = ""
    # Aprobadores L1
    aprobador_l1_id: Optional[str] = None
    aprobador_l1_fecha: Optional[str] = None
    aprobador_l1_comentario: Optional[str] = None
    # Aprobadores L2
    aprobador_l2_id: Optional[str] = None
    aprobador_l2_fecha: Optional[str] = None
    aprobador_l2_comentario: Optional[str] = None
    # Aprobador final (ADMIN)
    aprobador_final_id: Optional[str] = None
    aprobador_final_fecha: Optional[str] = None
    aprobador_final_comentario: Optional[str] = None
    # Rechazo
    rechazado_por: Optional[str] = None
    motivo_rechazo: Optional[str] = None
    fecha_rechazo: Optional[str] = None
    # Timestamps
    created_at: str = ""
    updated_at: str = ""

    @property
    def monto_solicitado_usd(self) -> float:
        return self.monto_solicitado_cents / 100

    @property
    def saldo_actual_usd(self) -> float:
        return self.saldo_actual_cents / 100

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "centro": self.centro,
            "sector": self.sector,
            "monto_solicitado_cents": self.monto_solicitado_cents,
            "monto_solicitado_usd": self.monto_solicitado_usd,
            "saldo_actual_cents": self.saldo_actual_cents,
            "saldo_actual_usd": self.saldo_actual_usd,
            "nivel_aprobacion_requerido": self.nivel_aprobacion_requerido,
            "estado": self.estado,
            "solicitante_id": self.solicitante_id,
            "solicitante_rol": self.solicitante_rol,
            "justificacion": self.justificacion,
            "aprobador_l1_id": self.aprobador_l1_id,
            "aprobador_l1_fecha": self.aprobador_l1_fecha,
            "aprobador_l1_comentario": self.aprobador_l1_comentario,
            "aprobador_l2_id": self.aprobador_l2_id,
            "aprobador_l2_fecha": self.aprobador_l2_fecha,
            "aprobador_l2_comentario": self.aprobador_l2_comentario,
            "aprobador_final_id": self.aprobador_final_id,
            "aprobador_final_fecha": self.aprobador_final_fecha,
            "aprobador_final_comentario": self.aprobador_final_comentario,
            "rechazado_por": self.rechazado_por,
            "motivo_rechazo": self.motivo_rechazo,
            "fecha_rechazo": self.fecha_rechazo,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_row(cls, row: Dict[str, Any]) -> "BudgetUpdateRequest":
        """Construye desde fila de BD"""
        return cls(
            id=row.get("id", 0),
            centro=row.get("centro", ""),
            sector=row.get("sector", ""),
            monto_solicitado_cents=row.get("monto_solicitado_cents", 0),
            saldo_actual_cents=row.get("saldo_actual_cents", 0),
            nivel_aprobacion_requerido=row.get("nivel_aprobacion_requerido", "L1"),
            estado=row.get("estado", "pendiente"),
            solicitante_id=row.get("solicitante_id", ""),
            solicitante_rol=row.get("solicitante_rol"),
            justificacion=row.get("justificacion", ""),
            aprobador_l1_id=row.get("aprobador_l1_id"),
            aprobador_l1_fecha=row.get("aprobador_l1_fecha"),
            aprobador_l1_comentario=row.get("aprobador_l1_comentario"),
            aprobador_l2_id=row.get("aprobador_l2_id"),
            aprobador_l2_fecha=row.get("aprobador_l2_fecha"),
            aprobador_l2_comentario=row.get("aprobador_l2_comentario"),
            aprobador_final_id=row.get("aprobador_final_id"),
            aprobador_final_fecha=row.get("aprobador_final_fecha"),
            aprobador_final_comentario=row.get("aprobador_final_comentario"),
            rechazado_por=row.get("rechazado_por"),
            motivo_rechazo=row.get("motivo_rechazo"),
            fecha_rechazo=row.get("fecha_rechazo"),
            created_at=row.get("created_at", ""),
            updated_at=row.get("updated_at", ""),
        )


# ============================================================================
# Resultados de operaciones
# ============================================================================


@dataclass
class BudgetOperationResult:
    """Resultado de operacion de presupuesto (consumir/revertir)"""

    success: bool
    saldo_anterior_cents: int = 0
    saldo_posterior_cents: int = 0
    ledger_id: Optional[int] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None

    @property
    def saldo_anterior_usd(self) -> float:
        return self.saldo_anterior_cents / 100

    @property
    def saldo_posterior_usd(self) -> float:
        return self.saldo_posterior_cents / 100

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "success": self.success,
            "saldo_anterior_cents": self.saldo_anterior_cents,
            "saldo_anterior_usd": self.saldo_anterior_usd,
            "saldo_posterior_cents": self.saldo_posterior_cents,
            "saldo_posterior_usd": self.saldo_posterior_usd,
        }
        if self.ledger_id:
            result["ledger_id"] = self.ledger_id
        if self.error_code:
            result["error_code"] = self.error_code
            result["error_message"] = self.error_message
        return result


@dataclass
class ValidacionPresupuesto:
    """Resultado de validacion de saldo disponible"""

    tiene_saldo: bool
    saldo_disponible_cents: int
    monto_requerido_cents: int
    deficit_cents: int = 0
    mensaje: str = ""

    @property
    def saldo_disponible_usd(self) -> float:
        return self.saldo_disponible_cents / 100

    @property
    def monto_requerido_usd(self) -> float:
        return self.monto_requerido_cents / 100

    @property
    def deficit_usd(self) -> float:
        return self.deficit_cents / 100

    @property
    def puede_aprobar(self) -> bool:
        return self.tiene_saldo and self.deficit_cents == 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tiene_saldo": self.tiene_saldo,
            "puede_aprobar": self.puede_aprobar,
            "saldo_disponible_cents": self.saldo_disponible_cents,
            "saldo_disponible_usd": self.saldo_disponible_usd,
            "monto_requerido_cents": self.monto_requerido_cents,
            "monto_requerido_usd": self.monto_requerido_usd,
            "deficit_cents": self.deficit_cents,
            "deficit_usd": self.deficit_usd,
            "mensaje": self.mensaje,
        }


# ============================================================================
# Contexto de transaccion
# ============================================================================


@dataclass
class TransactionContext:
    """Contexto para transacciones de presupuesto"""

    trace_id: str
    actor_id: str
    actor_rol: str = ""
    actor_ip: str = ""
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
