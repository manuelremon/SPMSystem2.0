"""
Tests para el modulo de schemas de presupuesto (backend_v2/core/budget_schemas.py)

Verifica:
- Dataclasses se instancian correctamente
- Enums tienen valores esperados
- Helpers (determinar_nivel_aprobacion) funcionan correctamente
- Constantes UMBRAL_* son correctas
"""

import sys
from pathlib import Path

import pytest

# Agregar backend_v2 al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend_v2"))

from core.budget_schemas import (UMBRAL_L1_CENTS, UMBRAL_L2_CENTS,
                                 BudgetOperationResult, BudgetUpdateRequest,
                                 EstadoBUR, LedgerEntry, NivelAprobacion,
                                 PresupuestoInfo, TipoMovimiento,
                                 TransactionContext, ValidacionPresupuesto,
                                 determinar_nivel_aprobacion)


class TestConstantes:
    """Tests para constantes de umbrales"""

    def test_umbral_l1_es_200k(self):
        """L1 = $200,000 USD = 20,000,000 centavos"""
        assert UMBRAL_L1_CENTS == 20_000_000

    def test_umbral_l2_es_1m(self):
        """L2 = $1,000,000 USD = 100,000,000 centavos"""
        assert UMBRAL_L2_CENTS == 100_000_000

    def test_l1_menor_que_l2(self):
        """L1 debe ser menor que L2"""
        assert UMBRAL_L1_CENTS < UMBRAL_L2_CENTS


class TestEnums:
    """Tests para Enums"""

    def test_tipo_movimiento_valores(self):
        """TipoMovimiento tiene valores esperados"""
        assert TipoMovimiento.CONSUMO_APROBACION.value == "consumo_aprobacion"
        assert TipoMovimiento.REVERSION_RECHAZO.value == "reversion_rechazo"
        assert TipoMovimiento.BUR_APROBADO.value == "bur_aprobado"
        assert TipoMovimiento.AJUSTE_MANUAL.value == "ajuste_manual"

    def test_nivel_aprobacion_valores(self):
        """NivelAprobacion tiene valores esperados"""
        assert NivelAprobacion.L1.value == "L1"
        assert NivelAprobacion.L2.value == "L2"
        assert NivelAprobacion.ADMIN.value == "ADMIN"

    def test_estado_bur_valores(self):
        """EstadoBUR tiene todos los estados"""
        assert EstadoBUR.PENDIENTE.value == "pendiente"
        assert EstadoBUR.APROBADO_L1.value == "aprobado_l1"
        assert EstadoBUR.APROBADO_L2.value == "aprobado_l2"
        assert EstadoBUR.APROBADO.value == "aprobado"
        assert EstadoBUR.RECHAZADO.value == "rechazado"


class TestDeterminarNivelAprobacion:
    """Tests para la funcion determinar_nivel_aprobacion"""

    def test_monto_bajo_es_l1(self):
        """Montos <= $200K son nivel L1"""
        assert determinar_nivel_aprobacion(0) == NivelAprobacion.L1
        assert determinar_nivel_aprobacion(100) == NivelAprobacion.L1  # $1
        assert determinar_nivel_aprobacion(10_000_000) == NivelAprobacion.L1  # $100K
        assert (
            determinar_nivel_aprobacion(UMBRAL_L1_CENTS) == NivelAprobacion.L1
        )  # exactamente $200K

    def test_monto_medio_es_l2(self):
        """Montos > $200K y <= $1M son nivel L2"""
        assert (
            determinar_nivel_aprobacion(UMBRAL_L1_CENTS + 1) == NivelAprobacion.L2
        )  # $200K + 1 cent
        assert determinar_nivel_aprobacion(50_000_000) == NivelAprobacion.L2  # $500K
        assert determinar_nivel_aprobacion(UMBRAL_L2_CENTS) == NivelAprobacion.L2  # exactamente $1M

    def test_monto_alto_es_admin(self):
        """Montos > $1M son nivel ADMIN"""
        assert (
            determinar_nivel_aprobacion(UMBRAL_L2_CENTS + 1) == NivelAprobacion.ADMIN
        )  # $1M + 1 cent
        assert determinar_nivel_aprobacion(200_000_000) == NivelAprobacion.ADMIN  # $2M
        assert determinar_nivel_aprobacion(1_000_000_000) == NivelAprobacion.ADMIN  # $10M


class TestPresupuestoInfo:
    """Tests para dataclass PresupuestoInfo"""

    def test_creacion_basica(self):
        """PresupuestoInfo se crea correctamente"""
        info = PresupuestoInfo(
            centro="1001",
            sector="Mantenimiento",
            monto_cents=10_000_000,  # $100K
            saldo_cents=7_500_000,  # $75K
        )
        assert info.centro == "1001"
        assert info.sector == "Mantenimiento"
        assert info.monto_usd == 100000.0  # property
        assert info.saldo_usd == 75000.0  # property

    def test_to_dict(self):
        """to_dict retorna diccionario correcto"""
        info = PresupuestoInfo(
            centro="1001",
            sector="Ops",
            monto_cents=5_000_000,  # $50K
            saldo_cents=5_000_000,  # $50K
        )
        d = info.to_dict()
        assert d["centro"] == "1001"
        assert d["sector"] == "Ops"
        assert d["monto_usd"] == 50000.0
        assert d["saldo_usd"] == 50000.0


class TestBudgetOperationResult:
    """Tests para dataclass BudgetOperationResult"""

    def test_resultado_exitoso(self):
        """Resultado exitoso tiene success=True"""
        result = BudgetOperationResult(
            success=True,
            saldo_anterior_cents=100_000,
            saldo_posterior_cents=90_000,
            ledger_id=42,
        )
        assert result.success is True
        assert result.saldo_anterior_cents == 100_000
        assert result.saldo_posterior_cents == 90_000
        assert result.ledger_id == 42
        assert result.error_code is None
        assert result.error_message is None

    def test_resultado_fallido(self):
        """Resultado fallido tiene success=False y error"""
        result = BudgetOperationResult(
            success=False,
            error_code="saldo_insuficiente",
            error_message="Saldo insuficiente",
        )
        assert result.success is False
        assert result.error_code == "saldo_insuficiente"
        assert result.error_message == "Saldo insuficiente"


class TestValidacionPresupuesto:
    """Tests para dataclass ValidacionPresupuesto"""

    def test_presupuesto_valido(self):
        """Presupuesto valido con saldo suficiente"""
        val = ValidacionPresupuesto(
            tiene_saldo=True,
            saldo_disponible_cents=500_000,
            monto_requerido_cents=100_000,
        )
        assert val.tiene_saldo is True
        assert val.saldo_disponible_cents >= val.monto_requerido_cents
        assert val.puede_aprobar is True

    def test_presupuesto_insuficiente(self):
        """Presupuesto insuficiente"""
        val = ValidacionPresupuesto(
            tiene_saldo=False,
            saldo_disponible_cents=50_000,
            monto_requerido_cents=100_000,
            deficit_cents=50_000,
            mensaje="Saldo insuficiente",
        )
        assert val.tiene_saldo is False
        assert val.mensaje == "Saldo insuficiente"
        assert val.puede_aprobar is False


class TestTransactionContext:
    """Tests para dataclass TransactionContext"""

    def test_contexto_basico(self):
        """TransactionContext guarda info del actor"""
        ctx = TransactionContext(
            trace_id="trace_123",
            actor_id="user123",
            actor_rol="admin",
            actor_ip="192.168.1.1",
        )
        assert ctx.trace_id == "trace_123"
        assert ctx.actor_id == "user123"
        assert ctx.actor_rol == "admin"
        assert ctx.actor_ip == "192.168.1.1"
        assert ctx.timestamp is not None  # auto-generated


class TestBudgetUpdateRequest:
    """Tests para dataclass BudgetUpdateRequest"""

    def test_from_row_basico(self):
        """from_row crea BUR desde dict de fila DB"""
        row = {
            "id": 1,
            "centro": "1001",
            "sector": "Ops",
            "monto_solicitado_cents": 5_000_000,
            "saldo_actual_cents": 10_000_000,
            "justificacion": "Proyecto nuevo",
            "estado": "pendiente",
            "nivel_aprobacion_requerido": "L1",
            "solicitante_id": "user1",
            "solicitante_rol": "jefe",
            "created_at": "2025-01-01T00:00:00",
            "updated_at": "2025-01-01T00:00:00",
        }
        bur = BudgetUpdateRequest.from_row(row)
        assert bur.id == 1
        assert bur.centro == "1001"
        assert bur.monto_solicitado_cents == 5_000_000
        assert bur.monto_solicitado_usd == 50000.0  # 5M cents = $50K
        assert bur.estado == "pendiente"

    def test_to_dict(self):
        """to_dict retorna diccionario serializable"""
        bur = BudgetUpdateRequest(
            id=2,
            centro="1002",
            sector="IT",
            monto_solicitado_cents=10_000_000,
            saldo_actual_cents=50_000_000,
            nivel_aprobacion_requerido="L1",
            estado="pendiente",
            solicitante_id="user2",
            solicitante_rol="jefe",
            justificacion="Equipos",
            created_at="2025-01-01",
            updated_at="2025-01-01",
        )
        d = bur.to_dict()
        assert d["id"] == 2
        assert d["centro"] == "1002"
        assert d["monto_solicitado_usd"] == 100000.0  # 10M cents = $100K


class TestLedgerEntry:
    """Tests para dataclass LedgerEntry"""

    def test_from_row(self):
        """from_row crea entry desde dict"""
        row = {
            "id": 10,
            "idempotency_key": "consumo_1_2025",
            "centro": "1001",
            "sector": "Ops",
            "tipo_movimiento": "consumo_aprobacion",
            "monto_cents": -50_000,
            "saldo_anterior_cents": 100_000,
            "saldo_posterior_cents": 50_000,
            "referencia_tipo": "solicitud",
            "referencia_id": 1,
            "actor_id": "user1",
            "actor_rol": "admin",
            "motivo": "Aprobacion solicitud #1",
            "created_at": "2025-01-01T00:00:00",
        }
        entry = LedgerEntry.from_row(row)
        assert entry.id == 10
        assert entry.tipo_movimiento == "consumo_aprobacion"
        assert entry.monto_cents == -50_000  # negativo = debito
        assert entry.monto_usd == -500.0  # -50K cents = -$500

    def test_to_dict(self):
        """to_dict retorna diccionario"""
        entry = LedgerEntry(
            id=1,
            idempotency_key="test",
            centro="1001",
            sector="Ops",
            tipo_movimiento="carga_inicial",
            monto_cents=100_000,
            saldo_anterior_cents=0,
            saldo_posterior_cents=100_000,
            referencia_tipo="manual",
            referencia_id=0,
            actor_id="admin",
            actor_rol="admin",
            motivo="Carga inicial",
            created_at="2025-01-01",
        )
        d = entry.to_dict()
        assert d["monto_usd"] == 1000.0  # 100K cents = $1000


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
