#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Production Setup Verification - SPM v2.0
Verifica que todos los pasos de configuración estén completados
"""

import os
import sys
import json
import requests
from pathlib import Path
from datetime import datetime

# ============================================
# Configuración
# ============================================
BACKEND_URL = "https://spmsystem2-0.onrender.com"
WORKSPACE_ROOT = Path(__file__).parent

# Colores
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

# ============================================
# Funciones de verificación
# ============================================

def check_file_exists(filepath, description):
    """Verifica si un archivo existe"""
    path = WORKSPACE_ROOT / filepath
    exists = path.exists()
    status = f"{Colors.GREEN}✓{Colors.RESET}" if exists else f"{Colors.RED}✗{Colors.RESET}"
    print(f"  {status} {description}")
    print(f"     └─ {filepath}")
    return exists

def check_env_file():
    """Verifica archivo .env"""
    print(f"\n{Colors.BOLD}🔧 Variables de Entorno{Colors.RESET}")
    
    env_file = WORKSPACE_ROOT / ".env"
    if env_file.exists():
        with open(env_file, 'r') as f:
            content = f.read()
            
        checks = {
            'FLASK_ENV': 'FLASK_ENV' in content,
            'SECRET_KEY': 'SECRET_KEY' in content,
            'JWT_SECRET_KEY': 'JWT_SECRET_KEY' in content,
            'FRONTEND_URL': 'FRONTEND_URL' in content,
        }
        
        for var, present in checks.items():
            status = f"{Colors.GREEN}✓{Colors.RESET}" if present else f"{Colors.RED}✗{Colors.RESET}"
            print(f"  {status} {var}")
        
        return all(checks.values())
    else:
        print(f"  {Colors.RED}✗ Archivo .env no encontrado{Colors.RESET}")
        return False

def check_backend_files():
    """Verifica archivos críticos del backend"""
    print(f"\n{Colors.BOLD}🔗 Archivos Backend{Colors.RESET}")
    
    files = [
        ("backend_v2/app.py", "Flask app"),
        ("backend_v2/core/config.py", "Configuración"),
        ("backend_v2/core/csrf.py", "CSRF protection"),
        ("wsgi.py", "WSGI entry point"),
        ("init_db_production.py", "DB initialization (producción)"),
    ]
    
    results = []
    for filepath, desc in files:
        exists = check_file_exists(filepath, desc)
        results.append(exists)
    
    return all(results)

def check_frontend_files():
    """Verifica archivos críticos del frontend"""
    print(f"\n{Colors.BOLD}🎨 Archivos Frontend{Colors.RESET}")
    
    files = [
        ("frontend/package.json", "Package.json"),
        ("frontend/vite.config.js", "Vite config"),
        ("frontend/vercel.json", "Vercel config"),
        ("frontend/src/services/api.js", "API service"),
        ("frontend/src/store/authStore.js", "Auth store"),
    ]
    
    results = []
    for filepath, desc in files:
        exists = check_file_exists(filepath, desc)
        results.append(exists)
    
    return all(results)

def check_documentation():
    """Verifica documentación"""
    print(f"\n{Colors.BOLD}📚 Documentación{Colors.RESET}")
    
    files = [
        ("docs/GUIA_DEPLOYMENT_PRODUCCION.md", "Guía deployment"),
        ("README.md", "README"),
        (".env.example", "Ejemplo .env"),
    ]
    
    results = []
    for filepath, desc in files:
        exists = check_file_exists(filepath, desc)
        results.append(exists)
    
    return all(results)

def check_backend_connectivity():
    """Verifica conectividad al backend"""
    print(f"\n{Colors.BOLD}🌐 Conectividad Backend{Colors.RESET}")
    
    try:
        response = requests.get(BACKEND_URL, timeout=5)
        if response.status_code == 200:
            print(f"  {Colors.GREEN}✓{Colors.RESET} Backend en línea ({BACKEND_URL})")
            print(f"     └─ Status: {response.status_code}")
            return True
        else:
            print(f"  {Colors.YELLOW}⚠{Colors.RESET} Backend retorna {response.status_code}")
            return False
    except Exception as e:
        print(f"  {Colors.RED}✗{Colors.RESET} No se puede conectar al backend")
        print(f"     └─ Error: {str(e)}")
        return False

def check_render_service():
    """Verifica estado del servicio en Render"""
    print(f"\n{Colors.BOLD}📦 Servicio Render{Colors.RESET}")
    
    try:
        response = requests.get(BACKEND_URL, timeout=5)
        print(f"  {Colors.GREEN}✓{Colors.RESET} Servicio activo en Render")
        
        # Intentar obtener info del API
        try:
            data = response.json()
            print(f"     └─ API Version: {data.get('message', 'N/A')}")
        except:
            print(f"     └─ Status: {response.status_code}")
        return True
    except:
        print(f"  {Colors.YELLOW}⚠{Colors.RESET} Servicio Render no disponible o en startup")
        print(f"     └─ Puede estar en proceso de reinicio")
        return False

def check_code_quality():
    """Verifica calidad de código (básico)"""
    print(f"\n{Colors.BOLD}🔍 Calidad de Código{Colors.RESET}")
    
    issues = []
    
    # Verificar encoding en principales archivos
    main_files = [
        "frontend/src/pages/Materials.jsx",
        "backend_v2/models/material.py",
    ]
    
    for filepath in main_files:
        path = WORKSPACE_ROOT / filepath
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'CÃ³digo' in content or 'Ã±' in content:
                        issues.append(f"Encoding issues en {filepath}")
            except:
                pass
    
    if issues:
        for issue in issues:
            print(f"  {Colors.YELLOW}⚠{Colors.RESET} {issue}")
        return False
    else:
        print(f"  {Colors.GREEN}✓{Colors.RESET} No se detectaron problemas de encoding")
        return True

def check_security():
    """Verifica configuración de seguridad"""
    print(f"\n{Colors.BOLD}🔐 Configuración de Seguridad{Colors.RESET}")
    
    checks = {
        "CSRF Protection": check_csrf_implementation(),
        "JWT Implementation": check_jwt_implementation(),
        "CORS Configuration": check_cors_implementation(),
    }
    
    for check_name, result in checks.items():
        status = f"{Colors.GREEN}✓{Colors.RESET}" if result else f"{Colors.RED}✗{Colors.RESET}"
        print(f"  {status} {check_name}")
    
    return all(checks.values())

def check_csrf_implementation():
    """Verifica CSRF"""
    path = WORKSPACE_ROOT / "backend_v2/core/csrf.py"
    if path.exists():
        with open(path, 'r') as f:
            return 'exempt_paths' in f.read()
    return False

def check_jwt_implementation():
    """Verifica JWT"""
    path = WORKSPACE_ROOT / "backend_v2/core/config.py"
    if path.exists():
        with open(path, 'r') as f:
            return 'JWT_SECRET_KEY' in f.read()
    return False

def check_cors_implementation():
    """Verifica CORS"""
    path = WORKSPACE_ROOT / "backend_v2/core/config.py"
    if path.exists():
        with open(path, 'r') as f:
            return 'CORS' in f.read()
    return False

def check_deployment_readiness():
    """Verificación final de readiness"""
    print(f"\n{Colors.BOLD}✅ Estado de Deployment{Colors.RESET}")
    
    checks = {
        "Backend files": check_backend_files(),
        "Frontend files": check_frontend_files(),
        "Documentation": check_documentation(),
        "Security": check_security(),
        "Backend running": check_backend_connectivity(),
    }
    
    return checks

def print_summary(all_checks):
    """Imprime resumen final"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}")
    print("═" * 60)
    print("RESUMEN DE VERIFICACIÓN")
    print("═" * 60)
    print(f"{Colors.RESET}\n")
    
    # Contar resultados
    backend_files = all([
        check_file_exists("backend_v2/app.py", ""),
        check_file_exists("backend_v2/core/config.py", ""),
        check_file_exists("wsgi.py", ""),
    ])
    
    frontend_files = all([
        check_file_exists("frontend/package.json", ""),
        check_file_exists("frontend/vercel.json", ""),
    ])
    
    items = {
        "Archivos Backend": backend_files,
        "Archivos Frontend": frontend_files,
        "Documentación": all_checks.get("Documentation", True),
        "Seguridad": all_checks.get("Security", True),
        "Backend Online": all_checks.get("Backend running", False),
    }
    
    passed = sum(1 for v in items.values() if v)
    total = len(items)
    
    for name, status in items.items():
        icon = f"{Colors.GREEN}✓{Colors.RESET}" if status else f"{Colors.RED}✗{Colors.RESET}"
        print(f"  {icon} {name}")
    
    print(f"\n{Colors.BOLD}Resultado: {passed}/{total} checks pasados{Colors.RESET}")
    
    if passed == total:
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 LISTO PARA PRODUCCIÓN{Colors.RESET}\n")
        return True
    elif passed >= 4:
        print(f"{Colors.YELLOW}{Colors.BOLD}⚠ CASI LISTO - Revisar items faltantes{Colors.RESET}\n")
        return True
    else:
        print(f"{Colors.RED}{Colors.BOLD}❌ CONFIGURACIÓN INCOMPLETA{Colors.RESET}\n")
        return False

# ============================================
# Main
# ============================================
def main():
    print(f"\n{Colors.BOLD}{Colors.BLUE}")
    print("╔════════════════════════════════════════════════════════╗")
    print("║   SPM v2.0 - PRODUCTION SETUP VERIFICATION            ║")
    print("╚════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}\n")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Workspace: {WORKSPACE_ROOT}\n")
    
    # Ejecutar todas las verificaciones
    print("═" * 60)
    print(f"{Colors.BOLD}VERIFICACIÓN DETALLADA{Colors.RESET}")
    print("═" * 60)
    
    checks = {
        "Backend files": check_backend_files(),
        "Frontend files": check_frontend_files(),
        "Documentation": check_documentation(),
        "Environment": check_env_file(),
        "Code Quality": check_code_quality(),
        "Security": check_security(),
        "Backend running": check_backend_connectivity(),
        "Render Service": check_render_service(),
    }
    
    # Resumen
    ready = print_summary(checks)
    
    # Instrucciones siguientes
    if ready:
        print(f"{Colors.BOLD}📋 Próximos pasos:{Colors.RESET}")
        print("  1. Verificar variables de entorno en Render dashboard")
        print("  2. Ejecutar: python test_production.py")
        print("  3. Desplegar frontend en Vercel")
        print("  4. Configurar dominio personalizado\n")
    
    return 0 if ready else 1

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Verificación interrumpida{Colors.RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.RED}Error: {str(e)}{Colors.RESET}")
        sys.exit(1)
