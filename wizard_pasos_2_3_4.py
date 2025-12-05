#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pasos 2-4 Deployment Wizard
Guia interactiva para desplegar frontend y completar produccion
"""

import sys
import time

def print_section(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}\n")

def print_step(step_num, title, time_est):
    print(f"\n[PASO {step_num}] {title} ({time_est} min)")
    print("-" * 70)

def print_instruction(instruction):
    print(f"  {instruction}")

def print_checklist(items):
    for i, item in enumerate(items, 1):
        print(f"  [ ] {i}. {item}")

def print_test_command(command):
    print(f"\n  Ejecuta en PowerShell:")
    print(f"  > {command}\n")

def main():
    print("\n" + "="*70)
    print("  SPM v2.0 - DEPLOYMENT WIZARD: PASOS 2-4")
    print("="*70)
    
    print("\nBienvenido al wizard de deployment final.")
    print("Este guia te ayudara a completar los ultimos 3 pasos (8 minutos totales).\n")
    
    # PASO 2
    print_step(2, "DESPLEGAR FRONTEND EN VERCEL", "5")
    
    print_instruction("PARTE 1: Configurar en Vercel")
    print_checklist([
        "Abre: https://vercel.com/new",
        "Click 'Import Git Repository'",
        "Busca: manuelremon/SPMSystem2.0",
        "Selecciona el repositorio",
        "Vercel detectara la configuracion",
        "Framework: Vite (debe estar preseleccionado)",
        "Root Directory: ./frontend",
        "Build Command: npm run build",
        "Output Directory: dist",
    ])
    
    print_instruction("\nPARTE 2: Agregar variable de entorno")
    print_checklist([
        "En Vercel, busca 'Environment Variables'",
        "Click 'Add Environment Variable'",
        "Name: VITE_API_URL",
        "Value: https://spmsystem2-0.onrender.com/api",
        "Agrega la variable",
    ])
    
    print_instruction("\nPARTE 3: Deploy")
    print_checklist([
        "Click boton 'Deploy'",
        "Espera 2-3 minutos (ver barra de progreso)",
        "Cuando termine, Vercel mostrara una URL",
        "COPIA esta URL: https://spmv2-0-xxxxx.vercel.app",
        "Esta URL la necesitas para PASO 3",
    ])
    
    print_instruction("\nPARTE 4: Verifica que funciona")
    print_checklist([
        "Abre en navegador tu URL de Vercel",
        "Debe mostrar la aplicacion SPM",
        "Si ves error, revisar logs en Vercel dashboard",
    ])
    
    # PASO 3
    print_step(3, "ACTUALIZAR CORS EN RENDER", "1")
    
    print_instruction("PARTE 1: Acceder a Render")
    print_checklist([
        "Abre: https://dashboard.render.com",
        "Busca servicio: spmsystem2-0",
        "Click en Settings",
        "Busca Environment Variables",
    ])
    
    print_instruction("\nPARTE 2: Actualizar variables")
    print_instruction("Necesitas editar 2 variables. Usa la URL de Vercel del PASO 2.")
    print_instruction("Ejemplo: https://spmv2-0-123abc.vercel.app")
    print_checklist([
        "VARIABLE 1 - FRONTEND_URL",
        "  Valor viejo: (vacio o localhost)",
        "  Valor nuevo: https://tu-url-vercel.vercel.app",
        "",
        "VARIABLE 2 - CORS_ORIGINS", 
        "  Valor viejo: http://localhost:5173,https://spmsystem2-0.onrender.com",
        "  Valor nuevo: https://tu-url-vercel.vercel.app,https://spmsystem2-0.onrender.com",
    ])
    
    print_instruction("\nPARTE 3: Guardar y redeploy")
    print_checklist([
        "Click 'Save changes' en Render",
        "Click 'Manual Deploy'",
        "Click 'Latest Commit'",
        "Espera 2-3 minutos a que se reinicie",
        "Ver logs para confirmar que reinicio correctamente",
    ])
    
    # PASO 4
    print_step(4, "TESTING Y VERIFICACION", "2")
    
    print_instruction("TEST 1: Backend responde")
    print_test_command("curl.exe https://spmsystem2-0.onrender.com/")
    print_instruction("Esperado: JSON con message 'SPM API v2.0' y status 'API activo'")
    
    print_instruction("\nTEST 2: Frontend carga")
    print_checklist([
        "Abre en navegador: https://tu-url-vercel.vercel.app",
        "Debes ver la pagina de LOGIN",
        "Intenta login con: admin / a1",
        "Debes ver el dashboard con materiales y solicitudes",
    ])
    
    print_instruction("\nTEST 3: Tests automaticos (opcional)")
    print_test_command("cd C:\\Users\\MANUE\\SPMv2.0; python test_production.py")
    print_instruction("Esperado: Todos los tests en VERDE")
    
    # TROUBLESHOOTING
    print_section("TROUBLESHOOTING RAPIDO")
    
    issues = [
        ("Backend 502 Bad Gateway", [
            "Ir a Render Dashboard → Logs",
            "Buscar el error",
            "Generalmente: variable mal escrita o CORS incorrecto"
        ]),
        ("Frontend no carga / Error 404", [
            "Abrir DevTools (F12)",
            "Ver Console",
            "Buscar errores CORS o fetch"
        ]),
        ("Login no funciona", [
            "Verificar JWT_SECRET_KEY en Render environment",
            "Verificar CORS_ORIGINS contiene tu URL de Vercel",
            "Revisar logs de Render"
        ]),
        ("Solicitudes no se cargan en frontend", [
            "Abrir DevTools → Network",
            "Buscar requests a API",
            "Ver si retornan 401/403/500",
            "Revisar logs de Render"
        ]),
    ]
    
    for issue, solutions in issues:
        print(f"\nSi: {issue}")
        for sol in solutions:
            print(f"  → {sol}")
    
    # VERIFICACION FINAL
    print_section("VERIFICACION FINAL")
    
    print("Checklist final - Si TODO esto funciona, estas en PRODUCCION:\n")
    print("  [ ] Backend online: https://spmsystem2-0.onrender.com/")
    print("  [ ] Frontend carga: https://tu-url-vercel.vercel.app")
    print("  [ ] Login con admin/a1 funciona")
    print("  [ ] Dashboard carga materiales y solicitudes")
    print("  [ ] Tests pasan sin errores (si los ejecutaste)")
    
    # PROXIMOS PASOS
    print_section("PROXIMOS PASOS (IMPORTANTE)")
    
    print("1. CAMBIAR CONTRASEÑA ADMIN")
    print("   - Login con: admin / a1")
    print("   - Settings → Change Password")
    print("   - Crear contraseña fuerte")
    print("   - GUARDAR\n")
    
    print("2. (Opcional) Configurar dominio personalizado")
    print("   - Render: Settings → Custom Domain")
    print("   - Vercel: Settings → Domains\n")
    
    print("3. Monitoreo")
    print("   - Render: Dashboard → Logs")
    print("   - Vercel: Dashboard → Analytics\n")
    
    # ENLACES UTILES
    print_section("ENLACES UTILES")
    
    links = [
        ("Backend", "https://spmsystem2-0.onrender.com"),
        ("GitHub", "https://github.com/manuelremon/SPMSystem2.0"),
        ("Render Dashboard", "https://dashboard.render.com"),
        ("Vercel Dashboard", "https://vercel.com/dashboard"),
    ]
    
    for name, url in links:
        print(f"  {name:<25} {url}")
    
    # RESUMEN
    print_section("RESUMEN")
    print(f"""
PASO 2 (5 min):  Vercel deployment
PASO 3 (1 min):  CORS update en Render
PASO 4 (2 min):  Testing
────────────────────
TOTAL:           8 minutos

RESULTADO: Aplicacion completamente en produccion!
""")
    
    print("\n" + "="*70)
    print("  BUENA SUERTE! Estamos casi alli!")
    print("="*70 + "\n")

if __name__ == "__main__":
    main()
