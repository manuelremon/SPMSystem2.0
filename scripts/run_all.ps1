# Reinicia servicios de backend y frontend usando el venv local.
# Ejecuta este script desde la raíz del proyecto:
#   powershell -ExecutionPolicy Bypass -File .\scripts\run_all.ps1

param(
    [string]$FrontendPort = "5173"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$venvActivate = Join-Path $root ".venv\Scripts\Activate.ps1"
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

if (-not (Test-Path $venvActivate)) {
    Write-Error "No se encontró el venv en .venv. Crea uno con: python -m venv .venv"
    exit 1
}

# Cierra procesos previos (silencioso)
Get-Process -Name "python","node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Levanta backend en nueva ventana de PowerShell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$backendDir`"; `"$venvActivate`"; python -m app.app"

# Levanta frontend en nueva ventana de PowerShell (ajusta puerto con -FrontendPort si está ocupado)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$frontendDir`"; `"$venvActivate`"; npm run dev -- --host --port $FrontendPort"

Write-Host "Backend: http://127.0.0.1:5000"
Write-Host "Frontend: http://localhost:$FrontendPort (si el puerto está libre)"
