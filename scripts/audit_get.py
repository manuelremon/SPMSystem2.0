"""Audit all GET endpoints for 500 errors against PostgreSQL."""
import requests
import sys
import time

BASE = "http://localhost:5000"

s = requests.Session()
r = s.post(f"{BASE}/api/auth/login", json={"username": "1", "password": "spm-123"})
token = r.json().get("access_token")
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# All GET endpoints extracted from Flask URL map, with sample params filled in
endpoints = [
    # === HEALTH ===
    "/health",
    "/api/health",
    "/api/health/dependencies",
    "/api/health/infrastructure",
    "/api/health/jobs",
    "/api/health/live",
    "/api/health/ready",
    "/api/health/routes",

    # === AUTH ===
    "/api/auth/csrf",
    "/api/auth/me",
    "/api/auth/mi-acceso",

    # === ADMIN ===
    "/api/admin/almacenes",
    "/api/admin/auto-approval-rules",
    "/api/admin/auto-approval/historial",
    "/api/admin/cache/stats",
    "/api/admin/centros",
    "/api/admin/config/almacenes",
    "/api/admin/database/audit-logs",
    "/api/admin/database/connections",
    "/api/admin/database/overview",
    "/api/admin/database/pool-stats",
    "/api/admin/database/tables",
    "/api/admin/database/tables/usuarios/columns",
    "/api/admin/database/tables/usuarios/export-csv",
    "/api/admin/database/tables/usuarios/pk",
    "/api/admin/database/tables/usuarios/preview",
    "/api/admin/database/tables/usuarios/stats",
    "/api/admin/database/tables/usuarios/structure",
    "/api/admin/delegaciones-aprobacion",
    "/api/admin/escalation-rules",
    "/api/admin/estado",
    "/api/admin/metricas",
    "/api/admin/planificadores",
    "/api/admin/presupuestos",
    "/api/admin/presupuestos/historial",
    "/api/admin/proveedores/externos",
    "/api/admin/proveedores/externos/20-12345678-9",
    "/api/admin/proveedores/internos",
    "/api/admin/proveedores/internos/BA01/ALM1",
    "/api/admin/puestos",
    "/api/admin/reglas-aprobacion",
    "/api/admin/reglas-aprobacion/1",
    "/api/admin/roles",
    "/api/admin/sectores",
    "/api/admin/temp-data/status",
    "/api/admin/temp-data/template",
    "/api/admin/usuarios",
    "/api/admin/usuarios/1",

    # === AI ===
    "/api/ai/abc-analysis",
    "/api/ai/alertas",
    "/api/ai/forecast/models",
    "/api/ai/materiales/buscar-consumo",
    "/api/ai/materiales/analisis/MAT-001",
    "/api/ai/materiales/forecast/MAT-001",
    "/api/ai/materiales/similares/MAT-001",
    "/api/ai/plan-compras/BA01",
    "/api/ai/recomendaciones/BA01",
    "/api/ai/recomendaciones/material/MAT-001",
    "/api/ai/recomendaciones/top",
    "/api/ai/solicitudes/priorizar",
    "/api/ai/status",
    "/api/ai/forecast/ensemble/MAT-001",

    # === ASSISTANT ===
    "/api/assistant/health",
    "/api/assistant/rag/status",

    # === AUDIT ===
    "/api/audit/logs",
    "/api/audit/logs/solicitud/1",
    "/api/audit/stats",
    "/api/audit/export",

    # === BUDGET REQUESTS ===
    "/api/budget-requests",
    "/api/budget-requests/1",
    "/api/budget-requests/pendientes",

    # === CATALOGOS ===
    "/api/catalogos",
    "/api/catalogos/almacenes",
    "/api/catalogos/centros",
    "/api/catalogos/roles",
    "/api/catalogos/sectores",
    "/api/catalogos/usuarios",

    # === COMPLIANCE ===
    "/api/compliance/checks",
    "/api/compliance/dashboard",
    "/api/compliance/rebates/claims",
    "/api/compliance/rebates/programs",

    # === CONSIGNMENT ===
    "/api/consignment/kpis",
    "/api/consignment/programs",
    "/api/consignment/programs/1",

    # === CONTRACTS ===
    "/api/contracts/",
    "/api/contracts/1",
    "/api/contracts/1/documents",
    "/api/contracts/1/items",
    "/api/contracts/price-lookup?material=MAT-001&proveedor=20-12345678-9",

    # === CONTROL TOWER ===
    "/api/control-tower/alerts",
    "/api/control-tower/events",
    "/api/control-tower/kpis",
    "/api/control-tower/trends",

    # === COPILOT ===
    "/api/copilot/conversations",
    "/api/copilot/conversations/1",
    "/api/copilot/insights",
    "/api/copilot/spend-patterns",
    "/api/copilot/suggestions",

    # === CURRENCY ===
    "/api/currency/dashboard",
    "/api/currency/exposure",
    "/api/currency/gain-loss",
    "/api/currency/rates",
    "/api/currency/rates/latest",

    # === CUSTOMS ===
    "/api/customs/agreements",
    "/api/customs/classifications/MAT-001",
    "/api/customs/hs-codes",
    "/api/customs/kpis",
    "/api/customs/operations",

    # === CYCLE COUNT ===
    "/api/cycle-count/counts",
    "/api/cycle-count/counts/1",
    "/api/cycle-count/kpis",
    "/api/cycle-count/programs",

    # === DASHBOARDS ===
    "/api/dashboard-data/resumen",
    "/api/dashboard-data/solicitudes",
    "/api/dashboard-data/drill/total_solicitudes",
    "/api/dashboard-functions/catalog",
    "/api/dashboard-grupos",
    "/api/dashboards",
    "/api/dashboards/resumen-ejecutivo",

    # === DEMAND PLANNING ===
    "/api/demand-planning/accuracy",
    "/api/demand-planning/cycles",
    "/api/demand-planning/cycles/1",

    # === DOCS ===
    "/api/docs",
    "/api/docs/",
    "/api/docs/info",
    "/api/docs/openapi",
    "/api/docs/openapi.json",

    # === ECO ===
    "/api/eco/",
    "/api/eco/1",
    "/api/eco/1/impact",
    "/api/eco/kpis",

    # === EQUIVALENCIAS ===
    "/api/equivalencias",
    "/api/equivalencias/MAT-001",
    "/api/equivalencias/tipos",

    # === EXECUTIVE ===
    "/api/executive/benchmarks",
    "/api/executive/dashboard",
    "/api/executive/kpis",
    "/api/executive/scorecards",
    "/api/executive/scorecards/1",
    "/api/executive/trends/total_spend",

    # === EXPORT ===
    "/api/export/alertas-mrp",
    "/api/export/formatos",
    "/api/export/inventario",
    "/api/export/kpis",
    "/api/export/programados",
    "/api/export/programados/1/destinatarios",
    "/api/export/programados/historial",
    "/api/export/recomendaciones",
    "/api/export/solicitudes",
    "/api/export/usuarios",

    # === FMS ===
    "/api/fms/documents/expiring",
    "/api/fms/drivers",
    "/api/fms/drivers/1",
    "/api/fms/drivers/available",
    "/api/fms/inspections",
    "/api/fms/inspections/1",
    "/api/fms/kpis",
    "/api/fms/vehicles",
    "/api/fms/vehicles/1",
    "/api/fms/vehicles/1/documents",
    "/api/fms/vehicles/1/maintenance-plans",
    "/api/fms/vehicles/available",
    "/api/fms/work-orders",
    "/api/fms/work-orders/1",

    # === FORO ===
    "/api/foro/posts",

    # === FREIGHT ===
    "/api/freight/carrier-performance",
    "/api/freight/invoices",
    "/api/freight/invoices/1",
    "/api/freight/kpis",
    "/api/freight/tariffs",

    # === INVENTORY OPTIMIZATION ===
    "/api/inventory-optimization/imbalances",
    "/api/inventory-optimization/kpis",
    "/api/inventory-optimization/service-levels",
    "/api/inventory-optimization/transfers",

    # === KANBAN ===
    "/api/kanban/boards",
    "/api/kanban/boards/1",
    "/api/kanban/kpis",
    "/api/kanban/signals",

    # === KITTING ===
    "/api/kitting/boms",
    "/api/kitting/boms/1",
    "/api/kitting/kpis",
    "/api/kitting/orders",
    "/api/kitting/orders/1",
    "/api/kitting/orders/1/availability",

    # === KPIS ===
    "/api/kpis",
    "/api/kpis/compras-evitadas-detalle",
    "/api/kpis/stock-inmovilizado",

    # === LOTS ===
    "/api/lots/",
    "/api/lots/1",
    "/api/lots/1/traceability/backward",
    "/api/lots/1/traceability/forward",
    "/api/lots/recalls",
    "/api/lots/recalls/1",

    # === MATCHING ===
    "/api/matching/invoices",
    "/api/matching/invoices/1",
    "/api/matching/invoices/1/comparison",
    "/api/matching/kpis",

    # === MATERIALES ===
    "/api/materiales",
    "/api/materiales/MAT-001",
    "/api/materiales/MAT-001/detalle",
    "/api/materiales/MAT-001/solicitudes",
    "/api/materiales/favoritos",
    "/api/materiales/grupos",
    "/api/materiales/stats",

    # === MENSAJES ===
    "/api/mensajes/inbox",
    "/api/mensajes/outbox",
    "/api/mensajes/unread-count",
    "/api/mensajes/1/thread",

    # === METRICS ===
    "/api/metrics",
    "/api/metrics/",
    "/api/metrics/alerts",
    "/api/metrics/business",
    "/api/metrics/cache",
    "/api/metrics/db",
    "/api/metrics/db-stats",
    "/api/metrics/endpoints",
    "/api/metrics/history",
    "/api/metrics/prometheus",
    "/api/metrics/requests",
    "/api/metrics/system",

    # === MI CUENTA ===
    "/api/mi-cuenta",
    "/api/mi-cuenta/admin/profile-requests",
    "/api/mi-cuenta/admin/profile-requests/1",
    "/api/mi-cuenta/notification-preferences",
    "/api/mi-cuenta/solicitudes-cambio-perfil",

    # === MRP ===
    "/api/mrp/alertas",
    "/api/mrp/alertas-mrp",
    "/api/mrp/analisis/MAT-001",
    "/api/mrp/analisis/centro/BA01",
    "/api/mrp/catalogos",
    "/api/mrp/configuracion",
    "/api/mrp/forecast/MAT-001",
    "/api/mrp/kpis",
    "/api/mrp/portfolio",
    "/api/mrp/what-if",

    # === NOTIFICACIONES ===
    "/api/notificaciones",
    "/api/notificaciones/centro-interaccion",

    # === ORDENES COMPRA ===
    "/api/ordenes-compra",
    "/api/ordenes-compra/1",
    "/api/ordenes-compra/1/pdf",
    "/api/ordenes-compra/estadisticas",

    # === PACKAGING ===
    "/api/packaging/kpis",
    "/api/packaging/packing-lists",
    "/api/packaging/packing-lists/1",
    "/api/packaging/templates",

    # === PLANIFICADOR ===
    "/api/planificador/dashboard",
    "/api/planificador/materiales/MAT-001/mejores-precios",
    "/api/planificador/mis-consultas-pendientes",
    "/api/planificador/presupuesto",
    "/api/planificador/proveedores/20-12345678-9/precios",
    "/api/planificador/solicitudes",
    "/api/planificador/solicitudes/1/decisiones-resumen",
    "/api/planificador/solicitudes/1/estado-acciones",
    "/api/planificador/solicitudes/1/items/0/decision",
    "/api/planificador/solicitudes/1/items/0/mrp",
    "/api/planificador/solicitudes/1/items/0/opciones-abastecimiento",
    "/api/planificador/solicitudes/1/tratamiento",

    # === PRESUPUESTO ===
    "/api/presupuesto-ledger",
    "/api/presupuesto/BA01/SEC1",

    # === PRICES ===
    "/api/prices/lists",
    "/api/prices/lists/1",
    "/api/prices/material/MAT-001/compare",
    "/api/prices/material/MAT-001/history",
    "/api/prices/material/MAT-001/price",
    "/api/prices/negotiations",

    # === PROCUREMENT ===
    "/api/procurement/analytics",
    "/api/procurement/comparar",
    "/api/procurement/import/history",
    "/api/procurement/kpis",
    "/api/procurement/kpis/compliance",
    "/api/procurement/kpis/costs",
    "/api/procurement/kpis/lead-times",
    "/api/procurement/orders",
    "/api/procurement/orders/PO-001",
    "/api/procurement/pipeline",
    "/api/procurement/price-history/MAT-001",
    "/api/procurement/ranking",
    "/api/procurement/scorecard/20-12345678-9",
    "/api/procurement/scorecard/20-12345678-9/historial",
    "/api/procurement/scorecard/ranking",
    "/api/procurement/solpeds",
    "/api/procurement/solpeds/SP-001",
    "/api/procurement/summary",

    # === PRODUCTION ===
    "/api/production/capacity",
    "/api/production/kpis",
    "/api/production/plans",
    "/api/production/plans/1",
    "/api/production/work-centers",

    # === PUSH ===
    "/api/push/status",
    "/api/push/vapid-key",

    # === QUALITY ===
    "/api/quality/capa",
    "/api/quality/capa/1",
    "/api/quality/inspections",
    "/api/quality/inspections/1",
    "/api/quality/kpis",
    "/api/quality/ncr",
    "/api/quality/ncr/1",
    "/api/quality/supplier/20-12345678-9/quality-trend",

    # === RETURNS ===
    "/api/returns/",
    "/api/returns/1",
    "/api/returns/kpis",

    # === RFQ ===
    "/api/rfq/",
    "/api/rfq/1",
    "/api/rfq/1/bids",
    "/api/rfq/1/comparison",

    # === SAVINGS ===
    "/api/savings/",
    "/api/savings/export",
    "/api/savings/goals",
    "/api/savings/goals/progress",
    "/api/savings/kpis",

    # === SCANNER ===
    "/api/scanner/session/test-session/codes",

    # === SLA ===
    "/api/sla/alertas",
    "/api/sla/configuraciones",
    "/api/sla/metricas",

    # === SLOB ===
    "/api/slob/aging",
    "/api/slob/disposition",
    "/api/slob/health",
    "/api/slob/kpis",

    # === SOLICITUDES ===
    "/api/solicitudes",
    "/api/solicitudes/1",
    "/api/solicitudes/1/historial-estados",
    "/api/solicitudes/1/transiciones-posibles",

    # === SPEND ===
    "/api/spend/by-category",
    "/api/spend/kraljic",
    "/api/spend/maverick",
    "/api/spend/tco/MAT-001",
    "/api/spend/trend",

    # === STOCK ===
    "/api/stock",
    "/api/stock/health",
    "/api/stock/resumen",

    # === SUPPLIER AUDIT ===
    "/api/supplier-audit/audits",
    "/api/supplier-audit/audits/1",
    "/api/supplier-audit/certifications",
    "/api/supplier-audit/certifications/expiring",
    "/api/supplier-audit/kpis",

    # === SUPPLIER FINANCE ===
    "/api/supplier-finance/kpis",
    "/api/supplier-finance/offers",
    "/api/supplier-finance/payment-terms",
    "/api/supplier-finance/programs",

    # === SUPPLIER ONBOARDING ===
    "/api/supplier-onboarding/",
    "/api/supplier-onboarding/1",
    "/api/supplier-onboarding/kpis",

    # === SUPPLIER PORTAL ===
    "/api/supplier-portal/admin/activity",
    "/api/supplier-portal/admin/users",
    "/api/supplier-portal/asns",
    "/api/supplier-portal/dashboard",
    "/api/supplier-portal/forecasts",
    "/api/supplier-portal/pos",

    # === SUPPLIER RISK ===
    "/api/supplier-risk/20-12345678-9",
    "/api/supplier-risk/20-12345678-9/trend",
    "/api/supplier-risk/alerts",
    "/api/supplier-risk/map",
    "/api/supplier-risk/single-source",

    # === SUSTAINABILITY ===
    "/api/sustainability/dashboard",
    "/api/sustainability/emissions",
    "/api/sustainability/esg-scores",
    "/api/sustainability/goals",
    "/api/sustainability/materials/footprint",
    "/api/sustainability/orden-compra/1/footprint",

    # === TMS ===
    "/api/tms/config",
    "/api/tms/consolidations",
    "/api/tms/consolidations/suggest",
    "/api/tms/kpis",
    "/api/tms/routes",
    "/api/tms/routes/1",
    "/api/tms/settlements",
    "/api/tms/shipments",
    "/api/tms/shipments/1",
    "/api/tms/shipments/1/calculate-freight",
    "/api/tms/shipments/1/costs",
    "/api/tms/shipments/1/settlement",
    "/api/tms/shipments/1/tracking",
    "/api/tms/tariffs",
    "/api/tms/tracking/in-transit",

    # === TRIVIAS ===
    "/api/trivias/my-stats",
    "/api/trivias/rankings",

    # === VERTEX ===
    "/api/vertex/alerts",
    "/api/vertex/history",
    "/api/vertex/session/resume",
    "/api/vertex/status",
    "/api/vertex/suggestions",
    "/api/vertex/tts/voices",

    # === VMI ===
    "/api/vmi/dashboard",
    "/api/vmi/programas",
    "/api/vmi/programas/1",
    "/api/vmi/reposiciones",

    # === WAREHOUSE ===
    "/api/warehouse/docks",
    "/api/warehouse/kpis",
    "/api/warehouse/putaway",

    # === WARRANTY ===
    "/api/warranty/",
    "/api/warranty/claims",
    "/api/warranty/claims/1",
    "/api/warranty/kpis",

    # === WEBHOOKS ===
    "/api/webhooks/",
    "/api/webhooks/1/deliveries",
]

results_500 = []
results_ok = []
results_timeout = []

total = len(endpoints)
print(f"Testing {total} GET endpoints...\n")

for i, url in enumerate(endpoints, 1):
    try:
        full_url = f"{BASE}{url}"
        r = s.get(full_url, headers=headers, timeout=10)

        if r.status_code == 500:
            err = ""
            try:
                err = r.json().get("error", "")
                if isinstance(err, dict):
                    err = err.get("message", str(err))
                err = str(err)[:150]
            except Exception:
                err = r.text[:150]
            results_500.append((url, r.status_code, err))
        else:
            results_ok.append((url, r.status_code))
    except requests.exceptions.Timeout:
        results_timeout.append((url, 0, "TIMEOUT (10s)"))
    except Exception as e:
        results_500.append((url, 0, str(e)[:100]))

    # Progress indicator
    if i % 50 == 0:
        print(f"  [{i}/{total}] tested...")

print(f"\n{'='*70}")
print(f"GET AUDIT RESULTS: {len(results_ok)} OK/4xx, {len(results_500)} errors 500, {len(results_timeout)} timeouts")
print(f"{'='*70}")

if results_500:
    print(f"\n--- 500 ERRORS ({len(results_500)}) ---")
    for u, code, e in results_500:
        print(f"\n  GET {u}")
        print(f"    => {e}")

if results_timeout:
    print(f"\n--- TIMEOUTS ({len(results_timeout)}) ---")
    for u, code, e in results_timeout:
        print(f"  GET {u}")

print(f"\n--- OK/4xx ({len(results_ok)}) ---")
for u, code in results_ok:
    tag = "OK" if code < 300 else f"{code}"
    print(f"  {tag:>4} GET {u}")
