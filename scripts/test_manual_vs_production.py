#!/usr/bin/env python3
"""
SPM 2.0 - Verificacion Manual de Usuario vs Produccion
========================================================
Prueba 116 endpoints mapeados a los 39 capitulos del manual.

Uso:
    python scripts/test_manual_vs_production.py
    python scripts/test_manual_vs_production.py --base http://localhost:5000  # dev local

Exit code: 0 si no hay FAIL, 1 si hay algun FAIL.
"""

import json
import sys
import time
import urllib.request
import urllib.error
import ssl
import argparse
from collections import defaultdict

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
DEFAULT_BASE = "https://planifica-materiales.com"
USERNAME = "1"
PASSWORD = "8300_@"

# Colores ANSI
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

# Contadores globales
counts = defaultdict(lambda: {"PASS": 0, "WARN": 0, "FAIL": 0})
all_results = []

# SSL context (no verificar cert auto-firmado si es necesario)
ssl_ctx = ssl.create_default_context()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def make_request(method, url, token=None, data=None, timeout=30):
    """Hace una request HTTP y devuelve (status_code, body_dict_or_str, error_str)."""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body_bytes = json.dumps(data).encode() if data else None

    req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=timeout, context=ssl_ctx)
        raw = resp.read().decode("utf-8", errors="replace")
        try:
            body = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            body = raw[:500]
        return resp.status, body, None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if e.fp else ""
        try:
            body = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            body = raw[:300]
        return e.code, body, None
    except urllib.error.URLError as e:
        return 0, None, str(e.reason)
    except Exception as e:
        return 0, None, str(e)


def classify(status):
    """Clasifica status HTTP en PASS/WARN/FAIL."""
    if 200 <= status <= 299:
        return "PASS"
    if 400 <= status <= 499:
        return "WARN"
    return "FAIL"


def print_result(part, chapter, desc, status, result, extra=""):
    """Imprime resultado coloreado y acumula stats."""
    tag = classify(status)
    color = {
        "PASS": GREEN,
        "WARN": YELLOW,
        "FAIL": RED,
    }[tag]

    status_str = str(status) if status else "ERR"
    extra_str = f"  {DIM}{extra}{RESET}" if extra else ""

    line = f"  {color}[{tag:4s}]{RESET} {status_str:>3s}  Ch{chapter:<3s} {desc[:58]:<58s}{extra_str}"
    print(line)

    counts[part][tag] += 1
    all_results.append((part, chapter, desc, tag, status))


def login(api_base):
    """Hace login y devuelve el access token."""
    url = f"{api_base}/auth/login"
    status, body, err = make_request("POST", url, data={
        "username": USERNAME,
        "password": PASSWORD,
    })
    if err:
        print(f"{RED}ERROR: No se pudo conectar para login: {err}{RESET}")
        sys.exit(1)
    if status != 200:
        print(f"{RED}ERROR: Login fallo con status {status}: {body}{RESET}")
        sys.exit(1)

    token = None
    if isinstance(body, dict):
        token = body.get("access_token") or body.get("token")
    if not token:
        print(f"{RED}ERROR: Login exitoso pero no se encontro token en respuesta{RESET}")
        print(f"  Respuesta: {body}")
        sys.exit(1)

    return token


def run_tests(part_name, tests, api_base, token):
    """Ejecuta una lista de tests [(chapter, desc, method, path, auth_required), ...]"""
    for chapter, desc, method, path, auth_req in tests:
        url = f"{api_base}{path}" if path.startswith("/") else path
        t = token if auth_req else None
        status, body, err = make_request(method, url, token=t)

        extra = ""
        if err:
            extra = err[:80]
        elif isinstance(body, dict) and "error" in body:
            extra = str(body["error"])[:80]
        elif isinstance(body, dict) and "message" in body:
            extra = str(body["message"])[:60]

        print_result(part_name, str(chapter), desc, status, body, extra)
        time.sleep(0.5)  # Evitar saturar connection pool de produccion (VPS 1GB)


# ---------------------------------------------------------------------------
# Tests por Parte del Manual
# ---------------------------------------------------------------------------

def get_solicitud_id(api_base, token):
    """Obtiene un ID de solicitud existente para tests de detalle."""
    status, body, _ = make_request("GET", f"{api_base}/solicitudes?limit=1", token=token)
    if status == 200 and isinstance(body, dict):
        items = body.get("solicitudes") or body.get("items") or body.get("data") or []
        if isinstance(body, list):
            items = body
        if items and isinstance(items, list) and len(items) > 0:
            return items[0].get("id") or items[0].get("id_solicitud")
    if status == 200 and isinstance(body, list) and len(body) > 0:
        return body[0].get("id") or body[0].get("id_solicitud")
    return 1  # fallback


def test_part_i(api_base, token, base_url):
    """PARTE I: Introduccion (Ch 1-4) - Health, Login, Mi Cuenta"""
    tests = [
        ("1", "Health basico", "GET", "/health", False),
        ("1", "Health API", "GET", "/api/health", False),
        ("1", "Health ready", "GET", "/api/health/ready", False),
        ("2", "Login (re-test)", "POST", "/api/auth/login", False),
        ("2", "CSRF token", "GET", "/api/auth/csrf", False),
        ("4", "Mi Cuenta", "GET", "/api/mi-cuenta", True),
        ("4", "Auth me", "GET", "/api/auth/me", True),
    ]
    # Health basico usa base_url, no api_base
    results = []
    for ch, desc, method, path, auth_req in tests:
        if path.startswith("/api/"):
            url = f"{api_base}{path[4:]}"  # strip /api
        elif path == "/health":
            url = f"{base_url}{path}"
        else:
            url = f"{api_base}{path}"

        t = token if auth_req else None
        # Login re-test needs data
        data = {"username": USERNAME, "password": PASSWORD} if "login" in path.lower() else None
        status, body, err = make_request(method, url, token=t, data=data)

        extra = ""
        if err:
            extra = err[:80]
        elif isinstance(body, dict) and "error" in body:
            extra = str(body["error"])[:80]

        print_result("I  Introduccion", ch, desc, status, body, extra)
        time.sleep(0.5)


def test_part_ii(api_base, token):
    """PARTE II: Solicitudes (Ch 5-8) - Catalogos, Solicitudes, FSM"""
    sol_id = get_solicitud_id(api_base, token)

    tests = [
        ("5", "Catalogos (form data)", "GET", "/catalogos", True),
        ("6", "Listar solicitudes", "GET", "/solicitudes", True),
        ("6", f"Detalle solicitud #{sol_id}", "GET", f"/solicitudes/{sol_id}", True),
        ("7", "Historial estados", "GET", f"/solicitudes/{sol_id}/historial-estados", True),
        ("7", "Transiciones posibles", "GET", f"/solicitudes/{sol_id}/transiciones-posibles", True),
    ]
    run_tests("II Solicitudes", tests, api_base, token)


def test_part_iii(api_base, token):
    """PARTE III: Aprobaciones (Ch 9-10) - BUR, Presupuesto"""
    tests = [
        ("10", "Lista BUR", "GET", "/budget-requests", True),
        ("10", "Ledger presupuesto", "GET", "/presupuesto-ledger", True),
        ("10", "BUR pendientes", "GET", "/budget-requests/pendientes", True),
    ]
    run_tests("III Aprobaciones", tests, api_base, token)


def test_part_iv(api_base, token):
    """PARTE IV: Planificacion (Ch 11-13) - Planner, MRP, Forecast"""
    tests = [
        ("11", "Planner dashboard", "GET", "/planner/dashboard", True),
        ("11", "Planner solicitudes", "GET", "/planner/solicitudes", True),
        ("12", "MRP portfolio", "GET", "/mrp/portfolio", True),
        ("12", "MRP alertas", "GET", "/mrp/alertas", True),
        ("12", "MRP KPIs", "GET", "/mrp/kpis", True),
        ("13", "Forecast models", "GET", "/ai/forecast/models", True),
        ("13", "Demand planning", "GET", "/demand-planning/plans", True),
        ("13", "Production plans", "GET", "/production/plans", True),
        ("13", "Kanban boards", "GET", "/kanban/boards", True),
    ]
    run_tests("IV Planificacion", tests, api_base, token)


def test_part_v(api_base, token):
    """PARTE V: Compras (Ch 14-19) - Procurement, RFQ, Contracts"""
    tests = [
        ("14", "Ordenes compra", "GET", "/ordenes-compra", True),
        ("14", "Procurement SOLPEDs", "GET", "/procurement/solpeds", True),
        ("15", "RFQ lista", "GET", "/rfq/", True),
        ("16", "Contratos", "GET", "/contracts/", True),
        ("16", "Compliance dashboard", "GET", "/compliance/dashboard", True),
        ("16", "Rebates", "GET", "/procurement/rebates", True),
        ("17", "Precios listas", "GET", "/prices/lists", True),
        ("18", "Supplier risk map", "GET", "/supplier-risk/map", True),
        ("18", "Certificaciones", "GET", "/supplier-audit/certifications", True),
        ("18", "Auditorias proveedores", "GET", "/supplier-audit/audits", True),
        ("18", "Supplier portal config", "GET", "/supplier-portal/config", True),
        ("18", "Supplier onboarding", "GET", "/supplier-onboarding/", True),
        ("19", "Facturas 3-way match", "GET", "/matching/invoices", True),
        ("19", "Financiamiento proveedores", "GET", "/supplier-finance/programs", True),
    ]
    run_tests("V  Compras", tests, api_base, token)


def test_part_vi(api_base, token):
    """PARTE VI: Inventario (Ch 20-22) - Warehouse, Stock, SLOB, VMI"""
    tests = [
        ("20", "Warehouse docks", "GET", "/warehouse/docks", True),
        ("20", "Putaway", "GET", "/warehouse/putaway", True),
        ("20", "Conteo ciclico", "GET", "/cycle-count/programs", True),
        ("21", "Catalogo materiales", "GET", "/materiales", True),
        ("21", "Equivalencias", "GET", "/equivalencias", True),
        ("21", "Stock (limit=5)", "GET", "/stock?limit=5", True),
        ("22", "SLOB aging", "GET", "/slob/aging", True),
        ("22", "VMI programas", "GET", "/vmi/programas", True),
        ("22", "Consignacion", "GET", "/consignment/programs", True),
        ("22", "Lotes", "GET", "/lots/", True),
        ("22", "Recalls", "GET", "/lots/recalls", True),
        ("22", "Optimizacion imbalances", "GET", "/inventory-optimization/imbalances", True),
        ("22", "Service levels", "GET", "/inventory-optimization/service-levels", True),
    ]
    run_tests("VI Inventario", tests, api_base, token)


def test_part_vii(api_base, token):
    """PARTE VII: Logistica (Ch 23-25) - TMS, Customs, FMS"""
    tests = [
        ("23", "TMS envios", "GET", "/tms/shipments", True),
        ("23", "TMS consolidacion", "GET", "/tms/consolidations", True),
        ("23", "TMS rutas", "GET", "/tms/routes", True),
        ("23", "TMS KPIs", "GET", "/tms/kpis", True),
        ("23", "Freight invoices", "GET", "/freight/invoices", True),
        ("23", "Freight tariffs", "GET", "/freight/tariffs", True),
        ("24", "Aduanas HS codes", "GET", "/customs/hs-codes", True),
        ("24", "Aduanas operations", "GET", "/customs/operations", True),
        ("24", "Packaging templates", "GET", "/packaging/templates", True),
        ("24", "Packaging lists", "GET", "/packaging/packing-lists", True),
        ("24", "Devoluciones RMA", "GET", "/returns/", True),
        ("24", "Garantias", "GET", "/warranty/", True),
        ("24", "Warranty claims", "GET", "/warranty/claims", True),
        ("25", "FMS vehiculos", "GET", "/fms/vehicles", True),
        ("25", "FMS work orders", "GET", "/fms/work-orders", True),
        ("25", "FMS KPIs", "GET", "/fms/kpis", True),
    ]
    run_tests("VII Logistica", tests, api_base, token)


def test_part_viii(api_base, token):
    """PARTE VIII: Calidad (Ch 26-29) - Quality, NCR, CAPA, ECO"""
    tests = [
        ("26", "Inspecciones", "GET", "/quality/inspections", True),
        ("27", "NCR", "GET", "/quality/ncr", True),
        ("28", "CAPA", "GET", "/quality/capa", True),
        ("28", "Quality KPIs", "GET", "/quality/kpis", True),
        ("29", "ECO", "GET", "/eco/", True),
        ("29", "Kitting BOMs", "GET", "/kitting/boms", True),
        ("29", "Kitting orders", "GET", "/kitting/orders", True),
    ]
    run_tests("VIII Calidad", tests, api_base, token)


def test_part_ix(api_base, token):
    """PARTE IX: Analytics (Ch 30-32) - Dashboards, Analytics, IA"""
    tests = [
        ("30", "Dashboard solicitudes", "GET", "/dashboard-data/solicitudes", True),
        ("30", "Dashboard resumen", "GET", "/dashboard-data/resumen", True),
        ("30", "Control Tower events", "GET", "/control-tower/events", True),
        ("30", "Control Tower KPIs", "GET", "/control-tower/kpis", True),
        ("30", "Executive dashboard", "GET", "/executive/dashboard", True),
        ("30", "Sostenibilidad", "GET", "/sustainability/dashboard", True),
        ("31", "Spend by-category", "GET", "/spend/by-category", True),
        ("31", "Spend Kraljic", "GET", "/spend/kraljic", True),
        ("31", "ABC analysis", "GET", "/ai/abc-analysis", True),
        ("31", "What-If inventario", "GET", "/mrp/what-if", True),
        ("31", "Cost savings", "GET", "/savings/", True),
        ("32", "Copilot insights", "GET", "/copilot/insights", True),
        ("32", "Vertex IA status", "GET", "/vertex/status", True),
        ("32", "IA alertas", "GET", "/ai/alertas", True),
        ("32", "Reportes programados", "GET", "/export/programados", True),
    ]
    run_tests("IX Analytics", tests, api_base, token)


def test_part_x(api_base, token):
    """PARTE X: Admin (Ch 33-36) - Usuarios, Config, Sistema"""
    tests = [
        ("33", "Usuarios", "GET", "/admin/usuarios", True),
        ("33", "Roles", "GET", "/admin/roles", True),
        ("33", "Planificadores", "GET", "/admin/planificadores", True),
        ("34", "Centros", "GET", "/admin/centros", True),
        ("34", "Sectores", "GET", "/admin/sectores", True),
        ("34", "Almacenes", "GET", "/admin/almacenes", True),
        ("34", "Puestos", "GET", "/admin/puestos", True),
        ("34", "Proveedores ext", "GET", "/admin/proveedores/externos", True),
        ("35", "Estado sistema", "GET", "/admin/estado", True),
        ("35", "DB overview", "GET", "/admin/database/overview", True),
        ("35", "Currency rates", "GET", "/currency/rates", True),
        ("36", "Admin presupuestos", "GET", "/admin/presupuestos", True),
        ("36", "Auto-aprobacion rules", "GET", "/admin/auto-approval-rules", True),
        ("36", "Escalado rules", "GET", "/admin/escalation-rules", True),
        ("36", "Webhooks", "GET", "/webhooks/", True),
        ("36", "Audit log", "GET", "/audit/logs", True),
        ("36", "Analisis puntual", "GET", "/admin/temp-data/status", True),
        ("36", "Portal proveedores", "GET", "/supplier-portal/config", True),
        ("36", "Onboarding proveedores", "GET", "/supplier-onboarding/", True),
    ]
    run_tests("X  Admin", tests, api_base, token)


def test_part_xi(api_base, token):
    """PARTE XI: Comunicacion (Ch 37-39) - Notificaciones, Foro, Mensajes"""
    tests = [
        ("37", "Notificaciones", "GET", "/notificaciones", True),
        ("37", "Centro interaccion", "GET", "/notificaciones/centro-interaccion", True),
        ("38", "Foro posts", "GET", "/foro/posts", True),
        ("39", "Mensajes inbox", "GET", "/mensajes/inbox", True),
        ("39", "Mensajes unread count", "GET", "/mensajes/unread-count", True),
    ]
    run_tests("XI Comunicacion", tests, api_base, token)


def test_frontend(base_url):
    """Frontend: HTML, PWA manifest, service worker"""
    part = "XII Frontend"
    tests = [
        ("FE", "React app HTML", base_url + "/"),
        ("FE", "PWA manifest", base_url + "/manifest.json"),
        ("FE", "Service worker", base_url + "/sw.js"),
    ]
    for ch, desc, url in tests:
        status, body, err = make_request("GET", url)
        extra = ""
        if err:
            extra = err[:80]
        elif status == 200 and isinstance(body, str):
            if "<!DOCTYPE" in body or "<html" in body:
                extra = "HTML OK"
            elif "manifest" in str(body) or "name" in str(body):
                extra = "JSON OK"
            elif "service" in str(body).lower() or "workbox" in str(body).lower():
                extra = "SW OK"
        print_result(part, ch, desc, status, body, extra)
        time.sleep(0.5)


# ---------------------------------------------------------------------------
# Resumen
# ---------------------------------------------------------------------------
def print_summary():
    """Imprime tabla resumen por parte."""
    parts_order = [
        "I  Introduccion",
        "II Solicitudes",
        "III Aprobaciones",
        "IV Planificacion",
        "V  Compras",
        "VI Inventario",
        "VII Logistica",
        "VIII Calidad",
        "IX Analytics",
        "X  Admin",
        "XI Comunicacion",
        "XII Frontend",
    ]

    print()
    print(f"{BOLD}{'=' * 66}{RESET}")
    print(f"{BOLD}        SPM 2.0 MANUAL vs PRODUCCION - RESUMEN{RESET}")
    print(f"{BOLD}{'=' * 66}{RESET}")
    print(f"  {'PARTE':<28s} {GREEN}PASS{RESET}  {YELLOW}WARN{RESET}  {RED}FAIL{RESET}  TOTAL")
    print(f"  {'-' * 60}")

    total_pass = total_warn = total_fail = 0
    for part in parts_order:
        c = counts[part]
        p, w, f = c["PASS"], c["WARN"], c["FAIL"]
        t = p + w + f
        if t == 0:
            continue
        total_pass += p
        total_warn += w
        total_fail += f

        fail_marker = f"  {RED}<--{RESET}" if f > 0 else ""
        print(f"  {part:<28s} {p:>4d}  {w:>4d}  {f:>4d}  {t:>5d}{fail_marker}")

    total = total_pass + total_warn + total_fail
    print(f"  {'-' * 60}")
    print(f"  {'TOTAL':<28s} {total_pass:>4d}  {total_warn:>4d}  {total_fail:>4d}  {total:>5d}")
    print()

    if total_fail > 0:
        print(f"  {RED}{BOLD}HAY {total_fail} ENDPOINT(S) CON FALLO (500+ o sin conexion){RESET}")
        print()
        print(f"  {BOLD}Endpoints fallidos:{RESET}")
        for part, ch, desc, tag, status in all_results:
            if tag == "FAIL":
                print(f"    {RED}[{status or 'ERR':>3}]{RESET}  Ch{ch}  {desc}")
        print()
    elif total_warn > 0:
        print(f"  {YELLOW}Todos los endpoints responden, {total_warn} con warnings (4xx){RESET}")
    else:
        print(f"  {GREEN}{BOLD}TODOS LOS ENDPOINTS RESPONDEN CORRECTAMENTE{RESET}")

    return total_fail


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="SPM 2.0 - Verificacion Manual vs Produccion")
    parser.add_argument("--base", default=DEFAULT_BASE, help="URL base (default: %(default)s)")
    args = parser.parse_args()

    base_url = args.base.rstrip("/")
    api_base = f"{base_url}/api"

    print()
    print(f"{BOLD}{'=' * 66}{RESET}")
    print(f"{BOLD}  SPM 2.0 - Verificacion Manual de Usuario vs Produccion{RESET}")
    print(f"{BOLD}{'=' * 66}{RESET}")
    print(f"  Target: {CYAN}{base_url}{RESET}")
    print(f"  User:   {USERNAME}")
    print(f"  Tests:  116 endpoints + 3 frontend")
    print()

    # Login
    print(f"{BOLD}  Autenticando...{RESET}", end=" ", flush=True)
    start = time.time()
    token = login(api_base)
    elapsed = time.time() - start
    print(f"{GREEN}OK{RESET} ({elapsed:.1f}s)")
    print()

    # Ejecutar todas las partes
    parts = [
        ("PARTE I: Introduccion (Ch 1-4)", lambda: test_part_i(api_base, token, base_url)),
        ("PARTE II: Solicitudes (Ch 5-8)", lambda: test_part_ii(api_base, token)),
        ("PARTE III: Aprobaciones (Ch 9-10)", lambda: test_part_iii(api_base, token)),
        ("PARTE IV: Planificacion (Ch 11-13)", lambda: test_part_iv(api_base, token)),
        ("PARTE V: Compras (Ch 14-19)", lambda: test_part_v(api_base, token)),
        ("PARTE VI: Inventario (Ch 20-22)", lambda: test_part_vi(api_base, token)),
        ("PARTE VII: Logistica (Ch 23-25)", lambda: test_part_vii(api_base, token)),
        ("PARTE VIII: Calidad (Ch 26-29)", lambda: test_part_viii(api_base, token)),
        ("PARTE IX: Analytics (Ch 30-32)", lambda: test_part_ix(api_base, token)),
        ("PARTE X: Admin (Ch 33-36)", lambda: test_part_x(api_base, token)),
        ("PARTE XI: Comunicacion (Ch 37-39)", lambda: test_part_xi(api_base, token)),
        ("FRONTEND: HTML, PWA, SW", lambda: test_frontend(base_url)),
    ]

    for title, fn in parts:
        print(f"\n{BOLD}  {title}{RESET}")
        print(f"  {'-' * 50}")
        fn()

    # Resumen
    fail_count = print_summary()
    sys.exit(1 if fail_count > 0 else 0)


if __name__ == "__main__":
    main()
