"""
Script de pruebas de produccion para el modulo de Procurement
Verifica endpoints, rendimiento y datos importados.

Uso:
    # Configurar credenciales (requerido)
    set TEST_ADMIN_PASSWORD=tu-password

    # Ejecutar pruebas
    python scripts/test_procurement_production.py

    # Con URL custom
    python scripts/test_procurement_production.py --url https://tu-dominio.com
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from typing import Dict, Any, Optional, Tuple

try:
    import requests
except ImportError:
    print("Error: requests no instalado. Ejecuta: pip install requests")
    sys.exit(1)


class ProcurementProductionTester:
    """Tester de produccion para endpoints de Procurement"""

    def __init__(self, base_url: str, admin_email: str, admin_password: str):
        self.base_url = base_url.rstrip('/')
        self.admin_email = admin_email
        self.admin_password = admin_password
        self.session = requests.Session()
        self.token = None
        self.csrf_token = None
        self.results = []

    def log(self, message: str, status: str = 'INFO'):
        """Log con timestamp"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        icon = {'PASS': '[OK]', 'FAIL': '[X]', 'INFO': '[i]', 'WARN': '[!]'}.get(status, '[?]')
        print(f"{timestamp} {icon} {message}")

    def add_result(self, test_name: str, passed: bool, details: str = '', duration_ms: float = 0):
        """Agrega resultado de test"""
        self.results.append({
            'test': test_name,
            'passed': passed,
            'details': details,
            'duration_ms': round(duration_ms, 2)
        })
        status = 'PASS' if passed else 'FAIL'
        duration_str = f" ({duration_ms:.0f}ms)" if duration_ms > 0 else ""
        self.log(f"{test_name}: {details}{duration_str}", status)

    def get_csrf_token(self) -> bool:
        """Obtiene token CSRF"""
        try:
            start = time.time()
            resp = self.session.get(f"{self.base_url}/api/csrf-token", timeout=10)
            duration = (time.time() - start) * 1000

            if resp.status_code == 200:
                data = resp.json()
                self.csrf_token = data.get('csrf_token')
                self.add_result('CSRF Token', True, 'Token obtenido', duration)
                return True
            else:
                self.add_result('CSRF Token', False, f'Status {resp.status_code}', duration)
                return False
        except Exception as e:
            self.add_result('CSRF Token', False, str(e))
            return False

    def login(self) -> bool:
        """Autentica con el servidor"""
        try:
            start = time.time()
            headers = {'X-CSRF-Token': self.csrf_token} if self.csrf_token else {}
            resp = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={'email': self.admin_email, 'password': self.admin_password},
                headers=headers,
                timeout=15
            )
            duration = (time.time() - start) * 1000

            if resp.status_code == 200:
                data = resp.json()
                self.token = data.get('access_token')
                self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                self.add_result('Login', True, f"Usuario: {data.get('user', {}).get('nombre', 'N/A')}", duration)
                return True
            else:
                self.add_result('Login', False, f'Status {resp.status_code}: {resp.text[:100]}', duration)
                return False
        except Exception as e:
            self.add_result('Login', False, str(e))
            return False

    def test_endpoint(self, name: str, method: str, endpoint: str,
                      expected_status: int = 200, data: Dict = None) -> Tuple[bool, Dict]:
        """Prueba un endpoint"""
        try:
            start = time.time()
            url = f"{self.base_url}{endpoint}"
            headers = {'X-CSRF-Token': self.csrf_token} if self.csrf_token else {}

            if method.upper() == 'GET':
                resp = self.session.get(url, headers=headers, timeout=30)
            elif method.upper() == 'POST':
                resp = self.session.post(url, json=data, headers=headers, timeout=30)
            else:
                raise ValueError(f"Metodo no soportado: {method}")

            duration = (time.time() - start) * 1000
            passed = resp.status_code == expected_status

            if passed:
                try:
                    response_data = resp.json()
                    # Extraer info relevante
                    if 'items' in response_data:
                        details = f"{len(response_data['items'])} items"
                    elif 'totales' in response_data:
                        details = f"solpeds={response_data['totales'].get('solpeds', 0)}"
                    else:
                        details = f"OK ({len(resp.content)} bytes)"
                except:
                    details = f"OK ({len(resp.content)} bytes)"
                    response_data = {}
            else:
                details = f"Status {resp.status_code}"
                response_data = {}

            self.add_result(name, passed, details, duration)
            return passed, response_data

        except Exception as e:
            self.add_result(name, False, str(e))
            return False, {}

    def run_all_tests(self) -> Dict[str, Any]:
        """Ejecuta todas las pruebas"""
        self.log("=" * 60, 'INFO')
        self.log("PRUEBAS DE PRODUCCION - MODULO PROCUREMENT", 'INFO')
        self.log(f"URL: {self.base_url}", 'INFO')
        self.log("=" * 60, 'INFO')

        # 1. Health Check
        self.test_endpoint('Health Check', 'GET', '/api/health')

        # 2. CSRF Token
        if not self.get_csrf_token():
            self.log("No se pudo obtener CSRF token, continuando...", 'WARN')

        # 3. Login
        if not self.login():
            self.log("Login fallido. Algunas pruebas pueden fallar.", 'WARN')

        # 4. Procurement Endpoints
        self.log("-" * 40, 'INFO')
        self.log("PRUEBAS ENDPOINTS PROCUREMENT", 'INFO')
        self.log("-" * 40, 'INFO')

        # KPIs General
        passed, kpis = self.test_endpoint(
            'Procurement KPIs',
            'GET',
            '/api/procurement/kpis?periodo=mes'
        )
        if passed and kpis:
            self.log(f"  - Lead time promedio: {kpis.get('lead_times', {}).get('total_dias', 'N/A')} dias", 'INFO')
            self.log(f"  - OTIF: {kpis.get('cumplimiento', {}).get('pct_otif', 'N/A')}%", 'INFO')

        # SOLPEDs
        self.test_endpoint('Listar SOLPEDs', 'GET', '/api/procurement/solpeds?per_page=10')
        self.test_endpoint('SOLPEDs por centro', 'GET', '/api/procurement/solpeds?centro=1008&per_page=5')

        # Purchase Orders
        self.test_endpoint('Listar Orders', 'GET', '/api/procurement/orders?per_page=10')
        self.test_endpoint('Orders recibidos', 'GET', '/api/procurement/orders?recibido=true&per_page=5')

        # KPIs Detallados
        self.test_endpoint('Lead Times', 'GET', '/api/procurement/kpis/lead-times?group_by=proveedor')
        self.test_endpoint('Cumplimiento OTIF', 'GET', '/api/procurement/kpis/compliance?min_pedidos=3')
        self.test_endpoint('Analisis Costos', 'GET', '/api/procurement/kpis/costs?min_transacciones=3')

        # Resumen y Pipeline
        self.test_endpoint('Resumen por Centro', 'GET', '/api/procurement/summary')
        self.test_endpoint('Pipeline Conversion', 'GET', '/api/procurement/pipeline')

        # Historial Importaciones
        self.test_endpoint('Historial Imports', 'GET', '/api/procurement/import/history?limit=5')

        # 5. Pruebas de Rendimiento
        self.log("-" * 40, 'INFO')
        self.log("PRUEBAS DE RENDIMIENTO", 'INFO')
        self.log("-" * 40, 'INFO')

        # Query grande
        self.test_endpoint('Query Grande (100 items)', 'GET', '/api/procurement/solpeds?per_page=100')

        # Multiples queries concurrentes (simulado secuencial)
        start = time.time()
        for i in range(3):
            self.session.get(f"{self.base_url}/api/procurement/kpis", timeout=30)
        duration = (time.time() - start) * 1000
        self.add_result('3 Queries KPIs', True, f'Total', duration)

        # 6. Resumen
        self.log("=" * 60, 'INFO')
        self.log("RESUMEN DE PRUEBAS", 'INFO')
        self.log("=" * 60, 'INFO')

        passed = sum(1 for r in self.results if r['passed'])
        failed = sum(1 for r in self.results if not r['passed'])
        total = len(self.results)
        avg_duration = sum(r['duration_ms'] for r in self.results) / total if total > 0 else 0

        self.log(f"Total: {total} tests", 'INFO')
        self.log(f"Pasados: {passed}", 'PASS' if passed == total else 'INFO')
        self.log(f"Fallidos: {failed}", 'FAIL' if failed > 0 else 'INFO')
        self.log(f"Tiempo promedio: {avg_duration:.0f}ms", 'INFO')

        return {
            'total': total,
            'passed': passed,
            'failed': failed,
            'avg_duration_ms': avg_duration,
            'results': self.results
        }


def main():
    parser = argparse.ArgumentParser(description='Pruebas de produccion para Procurement')
    parser.add_argument('--url', default='https://planifica-materiales.com',
                        help='URL base del servidor')
    parser.add_argument('--email', default='admin@spm.local',
                        help='Email del usuario admin')

    args = parser.parse_args()

    # Obtener password de variable de entorno
    password = os.environ.get('TEST_ADMIN_PASSWORD')
    if not password:
        print("Error: Debes configurar TEST_ADMIN_PASSWORD")
        print("  Windows CMD: set TEST_ADMIN_PASSWORD=tu-password")
        print("  Windows PS:  $env:TEST_ADMIN_PASSWORD='tu-password'")
        print("  Linux/Mac:   export TEST_ADMIN_PASSWORD='tu-password'")
        sys.exit(1)

    tester = ProcurementProductionTester(
        base_url=args.url,
        admin_email=args.email,
        admin_password=password
    )

    results = tester.run_all_tests()

    # Exit code basado en resultados
    sys.exit(0 if results['failed'] == 0 else 1)


if __name__ == '__main__':
    main()
