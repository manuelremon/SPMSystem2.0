#!/usr/bin/env pwsh
<#
.DESCRIPTION
Script para corregir imports en archivos de routes/

Cambios:
  from ..auth → from ...services.auth.auth
  (para 13 archivos en src/backend/routes/)
#>

$ErrorActionPreference = "Stop"

$routesPath = "src/backend/routes"
$filesToFix = @(
    "abastecimiento.py",
    "admin.py",
    "archivos.py",
    "auth_routes.py",
    "catalogos.py",
    "chatbot.py",
    "notificaciones.py",
    "planificador.py",
    "preferences.py",
    "presupuestos.py",
    "solicitudes.py",
    "solicitudes_archivos.py",
    "usuarios.py"
)

Write-Host "=== CORRECCIÓN DE IMPORTS EN routes/ ===" -ForegroundColor Green
Write-Host "`nArchivos a procesar: $($filesToFix.Count)`n" -ForegroundColor Cyan

foreach ($file in $filesToFix) {
    $fullPath = Join-Path $routesPath $file

    if (Test-Path $fullPath) {
        Write-Host "Procesando: $file" -ForegroundColor Yellow

        $content = Get-Content $fullPath -Raw

        # Reemplazar: from ..auth → from ...services.auth.auth
        $newContent = $content -replace "from \.\.auth import", "from ...services.auth.auth import"

        if ($content -ne $newContent) {
            Set-Content $fullPath -Value $newContent -Force
            Write-Host "  UPDATED" -ForegroundColor Green
        } else {
            Write-Host '  (no changes)' -ForegroundColor Gray
        }
    } else {
        Write-Host "ERROR: No encontrado: $file" -ForegroundColor Red
    }
}

Write-Host "`n=== VERIFICACIÓN ===" -ForegroundColor Green
Write-Host "Verificando imports..." -ForegroundColor Cyan

$remaining = @()
foreach ($file in $filesToFix) {
    $fullPath = Join-Path $routesPath $file
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath
        if ($content | Select-String "from \.\.auth") {
            $remaining += $file
        }
    }
}

if ($remaining.Count -gt 0) {
    Write-Host "`nWARNING: Pending files:" -ForegroundColor Yellow
    $remaining | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
} else {
    Write-Host '`nSUCCESS: All imports fixed' -ForegroundColor Green
}
