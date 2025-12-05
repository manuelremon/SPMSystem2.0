#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test Production Deployment - SPM v2.0
Verifica que todos los componentes de producción funcionen correctamente
"""

import requests
import json
import sys
import time
from datetime import datetime
from urllib.parse import urljoin

# ============================================
# Configuración
# ============================================
BACKEND_URL = "https://spmsystem2-0.onrender.com"
FRONTEND_URL = "https://spmv2-0.vercel.app"  # Actualizar con URL real de Vercel

ADMIN_EMAIL = "admin@spm.local"
ADMIN_PASSWORD = "a1"

# Colores para terminal
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

# ============================================
# Utilidades
# ============================================
def print_header(text):
    """Imprime encabezado"""
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{text}{Colors.RESET}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.RESET}\n")

def print_success(text):
    """Imprime mensaje de éxito"""
    print(f"{Colors.GREEN}✓ {text}{Colors.RESET}")

def print_error(text):
    """Imprime mensaje de error"""
    print(f"{Colors.RED}✗ {text}{Colors.RESET}")

def print_warning(text):
    """Imprime advertencia"""
    print(f"{Colors.YELLOW}⚠ {text}{Colors.RESET}")

def print_info(text):
    """Imprime información"""
    print(f"{Colors.BLUE}ℹ {text}{Colors.RESET}")

# ============================================
# Tests
# ============================================

class ProductionTests:
    def __init__(self):
        self.session = requests.Session()
        self.results = []
        self.passed = 0
        self.failed = 0
        self.csrf_token = None
        self.jwt_token = None

    def test_backend_health(self):
        """Test 1: Verificar que backend está online"""
        print_header("TEST 1: Backend Health Check")
        try:
            response = requests.get(BACKEND_URL, timeout=10)
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print_success("Backend está online")
                print_info(f"API Version: {data.get('message', 'N/A')}")
                print_info(f"Endpoints disponibles: {len(data.get('endpoints', {}))}")
                self.passed += 1
                self.results.append(("Backend Health", True))
                return True
            else:
                print_error(f"Backend retornó status {response.status_code}")
                self.failed += 1
                self.results.append(("Backend Health", False))
                return False
        except Exception as e:
            print_error(f"No se pudo conectar al backend: {str(e)}")
            self.failed += 1
            self.results.append(("Backend Health", False))
            return False

    def test_csrf_token(self):
        """Test 2: Obtener token CSRF"""
        print_header("TEST 2: CSRF Token")
        try:
            response = self.session.get(
                urljoin(BACKEND_URL, "/api/auth/csrf"),
                timeout=10
            )
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                csrf_token = response.headers.get('X-CSRF-Token')
                if csrf_token:
                    self.csrf_token = csrf_token
                    print_success(f"CSRF Token obtenido: {csrf_token[:20]}...")
                    self.passed += 1
                    self.results.append(("CSRF Token", True))
                    return True
                else:
                    print_error("No se obtuvo X-CSRF-Token en headers")
                    self.failed += 1
                    self.results.append(("CSRF Token", False))
                    return False
            else:
                print_error(f"CSRF endpoint retornó {response.status_code}")
                self.failed += 1
                self.results.append(("CSRF Token", False))
                return False
        except Exception as e:
            print_error(f"Error obteniendo CSRF: {str(e)}")
            self.failed += 1
            self.results.append(("CSRF Token", False))
            return False

    def test_login(self):
        """Test 3: Login con credenciales admin"""
        print_header("TEST 3: Authentication (Login)")
        if not self.csrf_token:
            print_warning("CSRF token no disponible, saltando test")
            return False

        try:
            headers = {'X-CSRF-Token': self.csrf_token}
            data = {
                'email': ADMIN_EMAIL,
                'password': ADMIN_PASSWORD
            }
            
            response = self.session.post(
                urljoin(BACKEND_URL, "/api/auth/login"),
                json=data,
                headers=headers,
                timeout=10
            )
            print_info(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                resp_data = response.json()
                self.jwt_token = resp_data.get('token')
                if self.jwt_token:
                    print_success(f"Login exitoso con {ADMIN_EMAIL}")
                    print_info(f"JWT Token: {self.jwt_token[:20]}...")
                    self.passed += 1
                    self.results.append(("Login", True))
                    return True
                else:
                    print_error("Respuesta no contiene JWT token")
                    self.failed += 1
                    self.results.append(("Login", False))
                    return False
            else:
                error_msg = response.text if response.text else f"Status {response.status_code}"
                print_error(f"Login falló: {error_msg}")
                self.failed += 1
                self.results.append(("Login", False))
                return False
        except Exception as e:
            print_error(f"Error en login: {str(e)}")
            self.failed += 1
            self.results.append(("Login", False))
            return False

    def test_api_endpoints(self):
        """Test 4: Verificar endpoints de la API"""
        print_header("TEST 4: API Endpoints")
        if not self.jwt_token:
            print_warning("JWT token no disponible, saltando test")
            return False

        endpoints = [
            ("/api/materials", "GET"),
            ("/api/requests", "GET"),
            ("/api/users/profile", "GET"),
        ]

        all_passed = True
        for endpoint, method in endpoints:
            try:
                headers = {'Authorization': f'Bearer {self.jwt_token}'}
                url = urljoin(BACKEND_URL, endpoint)
                
                if method == "GET":
                    response = self.session.get(url, headers=headers, timeout=10)
                else:
                    response = self.session.post(url, headers=headers, timeout=10)
                
                if response.status_code in [200, 201]:
                    print_success(f"{method} {endpoint} - OK")
                else:
                    print_warning(f"{method} {endpoint} - Status {response.status_code}")
                    all_passed = False
            except Exception as e:
                print_error(f"{method} {endpoint} - Error: {str(e)}")
                all_passed = False

        if all_passed:
            self.passed += 1
            self.results.append(("API Endpoints", True))
        else:
            self.failed += 1
            self.results.append(("API Endpoints", False))
        
        return all_passed

    def test_cors(self):
        """Test 5: Verificar CORS"""
        print_header("TEST 5: CORS Configuration")
        try:
            headers = {
                'Origin': FRONTEND_URL
            }
            response = requests.options(
                urljoin(BACKEND_URL, "/api/materials"),
                headers=headers,
                timeout=10
            )
            
            allow_origin = response.headers.get('Access-Control-Allow-Origin')
            allow_methods = response.headers.get('Access-Control-Allow-Methods')
            
            print_info(f"Status Code: {response.status_code}")
            print_info(f"Allow-Origin: {allow_origin}")
            print_info(f"Allow-Methods: {allow_methods}")
            
            if response.status_code == 200 and allow_origin:
                print_success("CORS correctamente configurado")
                self.passed += 1
                self.results.append(("CORS", True))
                return True
            else:
                print_warning("CORS podría no estar correctamente configurado")
                self.failed += 1
                self.results.append(("CORS", False))
                return False
        except Exception as e:
            print_warning(f"No se pudo verificar CORS: {str(e)}")
            self.failed += 1
            self.results.append(("CORS", False))
            return False

    def test_database(self):
        """Test 6: Verificar acceso a base de datos"""
        print_header("TEST 6: Database Connection")
        if not self.jwt_token:
            print_warning("JWT token no disponible, saltando test")
            return False

        try:
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            response = self.session.get(
                urljoin(BACKEND_URL, "/api/materials"),
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success("Base de datos accesible")
                print_info(f"Materiales disponibles: {len(data) if isinstance(data, list) else 'N/A'}")
                self.passed += 1
                self.results.append(("Database", True))
                return True
            else:
                print_error(f"Error accediendo BD: {response.status_code}")
                self.failed += 1
                self.results.append(("Database", False))
                return False
        except Exception as e:
            print_error(f"Error en conexión BD: {str(e)}")
            self.failed += 1
            self.results.append(("Database", False))
            return False

    def print_summary(self):
        """Imprime resumen final"""
        print_header("RESUMEN DE RESULTADOS")
        
        print(f"{Colors.BOLD}Pruebas Completadas:{Colors.RESET}\n")
        for test_name, passed in self.results:
            status = f"{Colors.GREEN}✓ PASS{Colors.RESET}" if passed else f"{Colors.RED}✗ FAIL{Colors.RESET}"
            print(f"  {status} - {test_name}")
        
        print(f"\n{Colors.BOLD}Estadísticas:{Colors.RESET}")
        print(f"  {Colors.GREEN}Exitosas: {self.passed}{Colors.RESET}")
        print(f"  {Colors.RED}Fallidas: {self.failed}{Colors.RESET}")
        print(f"  {Colors.BLUE}Total: {self.passed + self.failed}{Colors.RESET}")
        
        success_rate = (self.passed / (self.passed + self.failed) * 100) if (self.passed + self.failed) > 0 else 0
        print(f"  {Colors.BOLD}Tasa de éxito: {success_rate:.1f}%{Colors.RESET}\n")
        
        if self.failed == 0:
            print(f"{Colors.GREEN}{Colors.BOLD}🎉 TODOS LOS TESTS PASARON - PRODUCCIÓN LISTA{Colors.RESET}\n")
            return 0
        else:
            print(f"{Colors.RED}{Colors.BOLD}❌ ALGUNOS TESTS FALLARON - REVISAR LOGS{Colors.RESET}\n")
            return 1

    def run_all(self):
        """Ejecuta todos los tests"""
        print(f"\n{Colors.BOLD}{Colors.BLUE}")
        print("╔════════════════════════════════════════════════════════╗")
        print("║     SPM v2.0 - PRODUCTION DEPLOYMENT TESTS            ║")
        print("╚════════════════════════════════════════════════════════╝")
        print(f"{Colors.RESET}\n")
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Frontend URL: {FRONTEND_URL}\n")
        
        # Ejecutar tests
        self.test_backend_health()
        time.sleep(1)
        
        self.test_csrf_token()
        time.sleep(1)
        
        self.test_login()
        time.sleep(1)
        
        self.test_api_endpoints()
        time.sleep(1)
        
        self.test_cors()
        time.sleep(1)
        
        self.test_database()
        
        # Resumen
        return self.print_summary()

# ============================================
# Main
# ============================================
if __name__ == "__main__":
    try:
        tester = ProductionTests()
        exit_code = tester.run_all()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Tests interrumpidos por usuario{Colors.RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.RED}Error inesperado: {str(e)}{Colors.RESET}")
        sys.exit(1)
