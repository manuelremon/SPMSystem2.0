"""
Registry de módulos de seed para SPM System 2.0.

Cada módulo implementa SeedModule y se registra aquí.
El orden de ejecución respeta dependencias entre módulos.
"""

from scripts.seed_modules.m01_solicitudes_workflow import SolicitudesWorkflowSeed
from scripts.seed_modules.m02_procurement import ProcurementSeed
from scripts.seed_modules.m03_quality import QualitySeed
from scripts.seed_modules.m04_warehouse import WarehouseSeed
from scripts.seed_modules.m05_tms import TMSSeed
from scripts.seed_modules.m06_fms import FMSSeed
from scripts.seed_modules.m07_contracts import ContractsSeed
from scripts.seed_modules.m08_finance import FinanceSeed
from scripts.seed_modules.m09_prices import PricesSeed
from scripts.seed_modules.m10_supplier_mgmt import SupplierMgmtSeed
from scripts.seed_modules.m11_inventory import InventorySeed
from scripts.seed_modules.m12_planning import PlanningSeed
from scripts.seed_modules.m13_returns_warranty import ReturnsWarrantySeed
from scripts.seed_modules.m14_customs_eco import CustomsEcoSeed
from scripts.seed_modules.m15_communication import CommunicationSeed
from scripts.seed_modules.m16_admin_config import AdminConfigSeed
from scripts.seed_modules.m17_executive import ExecutiveSeed
from scripts.seed_modules.m18_kitting import KittingSeed
from scripts.seed_modules.m19_missing_tables import MissingTablesSeed
from scripts.seed_modules.m20_inventory_gaps import InventoryGapsSeed
from scripts.seed_modules.m21_compliance_copilot import ComplianceCopilotSeed

# Orden de ejecución (respeta dependencias)
SEED_MODULES = [
    SolicitudesWorkflowSeed,  # Fase 1: necesita usuarios, solicitudes existentes
    ProcurementSeed,          # Fase 2: necesita solicitudes, proveedores, materiales
    QualitySeed,              # Fase 3
    WarehouseSeed,            # Fase 3
    TMSSeed,                  # Fase 3
    FMSSeed,                  # Fase 3
    ContractsSeed,            # Fase 4
    FinanceSeed,              # Fase 4
    PricesSeed,               # Fase 4
    SupplierMgmtSeed,         # Fase 5
    InventorySeed,            # Fase 5
    PlanningSeed,             # Fase 5
    ReturnsWarrantySeed,      # Fase 5
    CustomsEcoSeed,           # Fase 5
    CommunicationSeed,        # Fase 5
    AdminConfigSeed,          # Fase 5
    ExecutiveSeed,            # Fase 5
    KittingSeed,              # Fase 5
    MissingTablesSeed,        # Fase 6: tablas restantes vacías
    InventoryGapsSeed,        # Fase 7: nivel servicio, genealogía lotes, SLOB
    ComplianceCopilotSeed,    # Fase 7: compliance checks, AI copilot
]

MODULE_MAP = {m.name: m for m in SEED_MODULES}
