# Reinicia backend y frontend usando .venv y Vite.
# Ejecuta desde la raiz del proyecto:
#   powershell -ExecutionPolicy Bypass -File .\restart_services.ps1 [-BackendPort 5000] [-FrontendPort 5173]

param(
    [string]$BackendPort = "5000",
    [string]$FrontendPort = "5173"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent $scriptDir
$venvActivate = Join-Path $projectRoot ".venv\\Scripts\\Activate.ps1"
$backendEntry = Join-Path $scriptDir "run_backend.py"
$frontendDir = Join-Path $projectRoot "frontend"

function Stop-PortProcess {
    param([string]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if (-not $connections) {
        Write-Host "No hay procesos usando el puerto $Port"
        return
    }

    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $pids) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "Proceso detenido: PID $processId (puerto $Port)"
        }
        catch {
            Write-Warning "No se pudo detener PID $processId : $($_.Exception.Message)"
        }
    }
}

if (-not (Test-Path $venvActivate)) {
    Write-Error "No se encontro el entorno .venv. Crea uno con: python -m venv .venv"
    exit 1
}

if (-not (Test-Path $backendEntry)) {
    Write-Error "No se encontro run_backend.py en la raiz"
    exit 1
}

if (-not (Test-Path $frontendDir)) {
    Write-Error "No se encontro el directorio frontend"
    exit 1
}

Write-Host "Cerrando procesos previos..."
Stop-PortProcess -Port $BackendPort
Stop-PortProcess -Port $FrontendPort

$backendCmd = "cd `"$projectRoot`"; `"$venvActivate`"; python `"$backendEntry`""
$frontendCmd = "cd `"$frontendDir`"; npm run dev -- --host --port $FrontendPort"

Write-Host "Levantando backend en nueva ventana..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

Write-Host "Levantando frontend (Vite) en nueva ventana..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host "Backend: http://127.0.0.1:$BackendPort"
Write-Host "Frontend: http://localhost:$FrontendPort"
