# Script para iniciar el servidor Flask
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "🚀 INICIANDO SERVIDOR FLASK - SPM v1.0" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📍 URL:      http://127.0.0.1:5000" -ForegroundColor Cyan
Write-Host "📍 Modo:     Development (Threaded)" -ForegroundColor Cyan
Write-Host "📍 Debug:    OFF" -ForegroundColor Cyan
Write-Host "📍 Materiales: 44,461 disponibles" -ForegroundColor Cyan
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# Ejecutar el servidor desde la raíz del proyecto
$projectRoot = Resolve-Path "$PSScriptRoot/.."
Push-Location $projectRoot
python scripts/dev/run_server.py
Pop-Location
