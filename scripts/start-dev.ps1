<#
.SYNOPSIS
    Arranca el entorno de desarrollo local de SPMSystem 2.0 (backend Flask + frontend Vite).

.DESCRIPTION
    - Backend Flask en http://localhost:5000 usando SQLite (data/spm.db).
    - Frontend Vite en http://localhost:5173.
    - Fuerza SQLite via DATABASE_URL para no usar el PostgreSQL del .env (que apunta a produccion).
    - Define USE_TF=0 porque hay un TensorFlow roto en el Python global (conflicto de protobuf);
      con esta variable sentence_transformers usa PyTorch y la busqueda semantica funciona.
    - Libera los puertos 5000 y 5173 si estan ocupados antes de arrancar.

    Cada servicio abre en su propia ventana de PowerShell para ver los logs por separado.

.EXAMPLE
    ./scripts/start-dev.ps1
        Arranca backend y frontend.

.EXAMPLE
    ./scripts/start-dev.ps1 -BackendOnly
        Arranca solo el backend.
#>
param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = "Stop"

# Raiz del proyecto = carpeta padre de este script
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DbPath = Join-Path $ProjectRoot "data\spm.db"
$DbUrl = "sqlite:///" + ($DbPath -replace '\\', '/')

function Stop-Port($port) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        try {
            Write-Host "  Liberando puerto $port (PID $($c.OwningProcess))..." -ForegroundColor Yellow
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction Stop
        } catch {}
    }
}

Write-Host "== SPMSystem 2.0 - Entorno de desarrollo ==" -ForegroundColor Cyan
Write-Host "Proyecto: $ProjectRoot"
Write-Host "BD (SQLite): $DbPath"

if (-not (Test-Path $DbPath)) {
    Write-Host "ADVERTENCIA: no existe $DbPath. El backend intentara crearla al arrancar." -ForegroundColor Yellow
}

# --- Backend ---
if (-not $FrontendOnly) {
    Write-Host "`n[Backend] Liberando puerto 5000..." -ForegroundColor Cyan
    Stop-Port 5000

    $backendCmd = @"
`$env:USE_TF = '0'
`$env:USE_TORCH = '1'
`$env:ENV = 'development'
`$env:FLASK_ENV = 'development'
`$env:PORT = '5000'
`$env:DATABASE_URL = '$DbUrl'
Set-Location '$ProjectRoot'
Write-Host '== Backend Flask :5000 (SQLite) ==' -ForegroundColor Green
python wsgi.py
"@
    Write-Host "[Backend] Arrancando en nueva ventana -> http://localhost:5000" -ForegroundColor Green
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", $backendCmd
}

# --- Frontend ---
if (-not $BackendOnly) {
    Write-Host "`n[Frontend] Liberando puerto 5173..." -ForegroundColor Cyan
    Stop-Port 5173

    $frontendCmd = @"
Set-Location '$ProjectRoot\frontend'
Write-Host '== Frontend Vite :5173 ==' -ForegroundColor Green
npm run dev
"@
    Write-Host "[Frontend] Arrancando en nueva ventana -> http://localhost:5173" -ForegroundColor Green
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", $frontendCmd
}

Write-Host "`nListo. Abre http://localhost:5173 en el navegador." -ForegroundColor Cyan
Write-Host "Usuario admin: id_spm=1 (la contrasena depende de tu BD local)."
