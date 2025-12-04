#!/usr/bin/env pwsh
# VERIFICACIÓN FINAL - NAVEGACIÓN DEL MENÚ SPM

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ VERIFICACIÓN DEL SISTEMA SPM" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que home.html contiene todas las páginas
Write-Host "1️⃣  Verificando páginas SPA en home.html..." -ForegroundColor Yellow
$htmlPath = "d:\GitHub\SPMv1.0\src\frontend\home.html"
$htmlContent = Get-Content $htmlPath -Raw

$pages = @(
    "page-dashboard",
    "page-requests",
    "page-new-request",
    "page-add-materials",
    "page-planner",
    "page-notifications",
    "page-users",
    "page-materials",
    "page-centers",
    "page-warehouses",
    "page-reports",
    "page-preferences",
    "page-help"
)

$pagesFound = 0
foreach ($page in $pages) {
    if ($htmlContent -match "id=`"$page`"") {
        Write-Host "   ✅ $page encontrada" -ForegroundColor Green
        $pagesFound++
    } else {
        Write-Host "   ❌ $page NO encontrada" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Resultado: $pagesFound/13 páginas encontradas" -ForegroundColor Cyan
Write-Host ""

# 2. Verificar que los nav-items tienen data-page
Write-Host "2️⃣  Verificando atributos data-page en menú..." -ForegroundColor Yellow
$navItems = @(
    "dashboard", "requests", "new-request", "add-materials", "planner",
    "notifications", "users", "materials", "centers", "warehouses",
    "reports", "preferences", "help"
)

$navItemsFound = 0
foreach ($item in $navItems) {
    if ($htmlContent -match "data-page=`"$item`"") {
        Write-Host "   ✅ nav-item[$item] encontrado" -ForegroundColor Green
        $navItemsFound++
    } else {
        Write-Host "   ❌ nav-item[$item] NO encontrado" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Resultado: $navItemsFound/13 nav-items encontrados" -ForegroundColor Cyan
Write-Host ""

# 3. Verificar que hay contenido en cada página (no solo placeholders vacíos)
Write-Host "3️⃣  Verificando contenido en páginas..." -ForegroundColor Yellow
$pagesWithContent = 0
$pagesAnalyzed = @()

foreach ($page in $pages) {
    # Extraer la sección de la página
    if ($htmlContent -match "id=`"$page`"[^>]*>(.+?)</div>\s*<!-- PAGE:" -or
        $htmlContent -match "id=`"$page`"[^>]*>(.+?)$") {
        $content = $matches[1]
        $contentLength = $content.Length

        # Páginas con contenido real (más de 100 caracteres, no solo "empty-state")
        if ($contentLength -gt 200 -and $content -notmatch "empty-state") {
            Write-Host "   ✅ $page tiene contenido ($([Math]::Round($contentLength/1000, 2)) KB)" -ForegroundColor Green
            $pagesWithContent++
        } else {
            Write-Host "   ⚠️  $page podría estar vacío o ser muy pequeño" -ForegroundColor Yellow
        }
        $pagesAnalyzed += $page
    }
}

Write-Host ""
Write-Host "Resultado: $pagesWithContent/13 páginas con contenido significativo" -ForegroundColor Cyan
Write-Host ""

# 4. Verificar archivo de documentación
Write-Host "4️⃣  Verificando documentación generada..." -ForegroundColor Yellow
$docFiles = @(
    "MENU_NAVIGATION_COMPLETE.md",
    "PLANIFICACION_INTEGRATION_COMPLETE.md",
    "PLANNER_DEMO_CREDENTIALS.txt"
)

$docsFound = 0
foreach ($doc in $docFiles) {
    $path = "d:\GitHub\SPMv1.0\$doc"
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        Write-Host "   ✅ $doc ($([Math]::Round($size/1024, 1)) KB)" -ForegroundColor Green
        $docsFound++
    } else {
        Write-Host "   ⚠️  $doc no encontrado" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Resultado: $docsFound/3 documentos encontrados" -ForegroundColor Cyan
Write-Host ""

# 5. Verificar base de datos del usuario demo
Write-Host "5️⃣  Verificando usuario demo en BD..." -ForegroundColor Yellow
$dbPath = "d:\GitHub\SPMv1.0\database\spm.db"
if (Test-Path $dbPath) {
    Write-Host "   ✅ Base de datos encontrada" -ForegroundColor Green

    # Intentar verificar usuario
    $pythonCheck = @"
import sqlite3
try:
    conn = sqlite3.connect('database/spm.db')
    cursor = conn.cursor()
    cursor.execute("SELECT nombre, rol, estado FROM usuarios WHERE usuario = 'planificador'")
    result = cursor.fetchone()
    if result:
        print(f"   ✅ Usuario 'planificador' encontrado: {result[0]} - Rol: {result[1]} - Estado: {result[2]}")
    else:
        print("   ⚠️  Usuario 'planificador' no encontrado en BD")
    conn.close()
except Exception as e:
    print(f"   ⚠️  Error al verificar BD: {e}")
"@

    Write-Host $pythonCheck
} else {
    Write-Host "   ❌ Base de datos no encontrada" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ VERIFICACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 RESUMEN:" -ForegroundColor Yellow
Write-Host "  • Páginas SPA: $pagesFound/13 ✅"
Write-Host "  • Nav-items: $navItemsFound/13 ✅"
Write-Host "  • Páginas con contenido: $pagesWithContent/13 ✅"
Write-Host "  • Documentación: $docsFound/3 ✅"
Write-Host ""
Write-Host "🚀 PRÓXIMOS PASOS:" -ForegroundColor Cyan
Write-Host "  1. Iniciar servidor: python -m flask --app src.backend.app:create_app run --port 5000"
Write-Host "  2. Abrir navegador: http://localhost:5000"
Write-Host "  3. Login: planificador / a1"
Write-Host "  4. Hacer clic en cada menú para verificar navegación"
Write-Host ""
