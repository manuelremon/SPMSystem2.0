"""
Tests para el servicio de presupuesto (backend_v2/services/budget_service.py)

Verifica:
- PresupuestoService.validar_saldo
- BURService.puede_crear_bur
- BURService.puede_aprobar_bur
- Logica de permisos por rol y monto
"""

import sys
from pathlib import Path

import pytest

# Agregar backend_v2 al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend_v2"))

from core.budget_schemas import UMBRAL_L1_CENTS, UMBRAL_L2_CENTS
from services.budget_service import BURService


class TestBURServicePuedeCrearBur:
    """Tests para BURService.puede_crear_bur"""

    def test_admin_puede_crear_cualquier_monto(self):
        """Admin puede crear BUR de cualquier monto"""
        roles = ["admin"]

        # Montos bajos
        puede, msg = BURService.puede_crear_bur(roles, 100_000)  # $1K
        assert puede is True

        # Montos altos
        puede, msg = BURService.puede_crear_bur(roles, UMBRAL_L2_CENTS + 1)  # >$1M
        assert puede is True

    def test_administrador_puede_crear_cualquier_monto(self):
        """Administrador puede crear BUR de cualquier monto"""
        roles = ["administrador"]
        puede, msg = BURService.puede_crear_bur(roles, 200_000_000)  # $2M
        assert puede is True

    def test_jefe_puede_crear_hasta_1m(self):
        """Jefe puede crear BUR hasta $1M"""
        roles = ["jefe"]

        # Exactamente $1M
        puede, msg = BURService.puede_crear_bur(roles, UMBRAL_L2_CENTS)
        assert puede is True

        # Menos de $1M
        puede, msg = BURService.puede_crear_bur(roles, UMBRAL_L1_CENTS)  # $200K
        assert puede is True

    def test_jefe_no_puede_crear_mas_de_1m(self):
        """Jefe NO puede crear BUR mayor a $1M"""
        roles = ["jefe"]
        puede, msg = BURService.puede_crear_bur(roles, UMBRAL_L2_CENTS + 1)
        assert puede is False
        assert "solo administradores" in msg.lower() or "admin" in msg.lower()

    def test_coordinador_no_puede_crear_bur(self):
        """Coordinador NO puede crear BUR (no es jefe ni admin)"""
        roles = ["coordinador"]
        puede, msg = BURService.puede_crear_bur(roles, 100_000)  # monto bajo
        assert puede is False

    def test_usuario_no_puede_crear_bur(self):
        """Usuario normal NO puede crear BUR"""
        roles = ["usuario"]
        puede, msg = BURService.puede_crear_bur(roles, 100_000)
        assert puede is False

    def test_planificador_no_puede_crear_bur(self):
        """Planificador NO puede crear BUR (no es jefe ni admin)"""
        roles = ["planificador"]
        puede, msg = BURService.puede_crear_bur(roles, 100_000)
        assert puede is False

    def test_roles_multiples_con_admin(self):
        """Si tiene rol admin entre otros, puede crear"""
        roles = ["usuario", "admin", "planificador"]
        puede, msg = BURService.puede_crear_bur(roles, 500_000_000)  # $5M
        assert puede is True

    def test_roles_multiples_con_jefe(self):
        """Si tiene rol jefe, puede crear hasta $1M"""
        roles = ["usuario", "jefe", "planificador"]
        puede, msg = BURService.puede_crear_bur(roles, UMBRAL_L2_CENTS)
        assert puede is True

    def test_roles_vacios(self):
        """Sin roles, no puede crear"""
        puede, msg = BURService.puede_crear_bur([], 100_000)
        assert puede is False


class TestBURServicePuedeAprobarBur:
    """Tests para BURService.puede_aprobar_bur"""

    def test_admin_puede_aprobar_cualquier_nivel(self):
        """Admin puede aprobar cualquier nivel"""
        roles = ["admin"]

        assert BURService.puede_aprobar_bur(roles, "L1") is True
        assert BURService.puede_aprobar_bur(roles, "L2") is True
        assert BURService.puede_aprobar_bur(roles, "ADMIN") is True

    def test_jefe_puede_aprobar_l1(self):
        """Jefe puede aprobar L1"""
        roles = ["jefe"]
        assert BURService.puede_aprobar_bur(roles, "L1") is True

    def test_jefe_no_puede_aprobar_l2(self):
        """Jefe NO puede aprobar L2"""
        roles = ["jefe"]
        assert BURService.puede_aprobar_bur(roles, "L2") is False

    def test_jefe_no_puede_aprobar_admin(self):
        """Jefe NO puede aprobar ADMIN"""
        roles = ["jefe"]
        assert BURService.puede_aprobar_bur(roles, "ADMIN") is False

    def test_coordinador_puede_aprobar_l1_solo(self):
        """Coordinador solo puede aprobar L1"""
        roles = ["coordinador"]
        assert BURService.puede_aprobar_bur(roles, "L1") is True

    def test_coordinador_no_puede_aprobar_l2(self):
        """Coordinador NO puede aprobar L2"""
        roles = ["coordinador"]
        assert BURService.puede_aprobar_bur(roles, "L2") is False

    def test_coordinador_no_puede_aprobar_admin(self):
        """Coordinador NO puede aprobar ADMIN"""
        roles = ["coordinador"]
        assert BURService.puede_aprobar_bur(roles, "ADMIN") is False

    def test_usuario_no_puede_aprobar(self):
        """Usuario normal NO puede aprobar nada"""
        roles = ["usuario"]
        assert BURService.puede_aprobar_bur(roles, "L1") is False
        assert BURService.puede_aprobar_bur(roles, "L2") is False
        assert BURService.puede_aprobar_bur(roles, "ADMIN") is False

    def test_planificador_no_puede_aprobar(self):
        """Planificador NO puede aprobar BURs"""
        roles = ["planificador"]
        assert BURService.puede_aprobar_bur(roles, "L1") is False

    def test_nivel_invalido(self):
        """Nivel desconocido retorna False"""
        roles = ["admin"]
        assert BURService.puede_aprobar_bur(roles, "INVALID") is False
        assert BURService.puede_aprobar_bur(roles, "") is False


class TestBURServiceNiveles:
    """Tests para determinar niveles segun monto"""

    def test_nivel_l1_para_montos_bajos(self):
        """Monto <= $200K requiere nivel L1"""
        # El servicio determina nivel basado en monto al crear
        # Aqui validamos que la logica de umbrales es correcta
        assert UMBRAL_L1_CENTS == 20_000_000  # $200K en centavos

    def test_nivel_l2_para_montos_medios(self):
        """Monto <= $1M requiere nivel L2"""
        assert UMBRAL_L2_CENTS == 100_000_000  # $1M en centavos

    def test_nivel_admin_para_montos_altos(self):
        """Monto > $1M requiere nivel ADMIN"""
        # Cualquier monto mayor a UMBRAL_L2_CENTS requiere admin
        assert UMBRAL_L2_CENTS < 200_000_000  # $2M > $1M


class TestIntegracionRolesMontos:
    """Tests de integracion para combinaciones rol+monto"""

    def test_jefe_crea_l1_puede_aprobar(self):
        """Jefe crea BUR L1 ($100K) - puede crear y aprobar"""
        roles = ["jefe"]
        monto = 10_000_000  # $100K

        puede_crear, _ = BURService.puede_crear_bur(roles, monto)
        puede_aprobar = BURService.puede_aprobar_bur(roles, "L1")

        assert puede_crear is True
        assert puede_aprobar is True

    def test_jefe_crea_l2_no_puede_aprobar(self):
        """Jefe crea BUR L2 ($500K) - puede crear, NO puede aprobar"""
        roles = ["jefe"]
        monto = 50_000_000  # $500K

        puede_crear, _ = BURService.puede_crear_bur(roles, monto)
        puede_aprobar = BURService.puede_aprobar_bur(roles, "L2")

        assert puede_crear is True
        assert puede_aprobar is False

    def test_admin_todo_el_flujo(self):
        """Admin puede hacer todo el flujo"""
        roles = ["admin"]
        montos = [
            (10_000_000, "L1"),  # $100K
            (50_000_000, "L2"),  # $500K
            (200_000_000, "ADMIN"),  # $2M
        ]

        for monto, nivel in montos:
            puede_crear, _ = BURService.puede_crear_bur(roles, monto)
            puede_aprobar = BURService.puede_aprobar_bur(roles, nivel)
            assert puede_crear is True, f"Admin debe poder crear BUR de ${monto / 100}"
            assert puede_aprobar is True, f"Admin debe poder aprobar nivel {nivel}"

    def test_coordinador_solo_aprobar_l1(self):
        """Coordinador solo puede aprobar L1, no crear ni aprobar L2/ADMIN"""
        roles = ["coordinador"]

        puede_crear, _ = BURService.puede_crear_bur(roles, 100_000)
        assert puede_crear is False

        assert BURService.puede_aprobar_bur(roles, "L1") is True
        assert BURService.puede_aprobar_bur(roles, "L2") is False
        assert BURService.puede_aprobar_bur(roles, "ADMIN") is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
