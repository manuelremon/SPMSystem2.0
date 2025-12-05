# ============================================================================
# SPM - Iniciador para GitHub Pages
# ============================================================================
# Este script inicia todo lo necesario para usar SPM con GitHub Pages:
#   1. Backend Flask (localhost:5000)
#   2. Cloudflare Tunnel (expone backend a internet)
#   3. Actualiza .env.production con URL del tunnel
#   4. Reconstruye frontend y despliega a GitHub Pages
#
# Uso: Doble click en INICIAR_SPM.bat o ejecutar este script
# ============================================================================

param(
    [switch]$SkipDeploy,      # Solo iniciar backend + tunnel, sin deploy
    [switch]$TunnelOnly,       # Solo iniciar tunnel (backend ya corriendo)
    [int]$BackendPort = 5000
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "SPM - GitHub Pages Launcher"

# Colores
function Write-Header { param($text) Write-Host "`n$text" -ForegroundColor Cyan }
function Write-Success { param($text) Write-Host $text -ForegroundColor Green }
function Write-Warning { param($text) Write-Host $text -ForegroundColor Yellow }
function Write-Error { param($text) Write-Host $text -ForegroundColor Red }
function Write-Info { param($text) Write-Host $text -ForegroundColor White }

# Rutas
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $ProjectRoot "frontend"
$VenvActivate = Join-Path $ProjectRoot ".venv\Scripts\Activate.ps1"
$EnvProduction = Join-Path $FrontendDir ".env.production"

# Banner
Clear-Host
Write-Host @"
============================================================
   ____  ____  __  __   _____           _
  / ___||  _ \|  \/  | / ____|         | |
  \___ \| |_) | \  / | \___  \  _   _  | |_   ___  _ __
   ___) |  __/| |\/| |  ___) || | | | | __| / _ \| '_ \
  |____/|_|   |_|  |_| |____/ | |_| | | |_ |  __/| | | |
                              \__, |  \__| \___||_| |_|
                               __/ |
  GitHub Pages Launcher       |___/   v1.0
============================================================
"@ -ForegroundColor Cyan

Write-Host ""
Write-Info "Este script iniciara:"
Write-Info "  1. Backend Flask en localhost:$BackendPort"
Write-Info "  2. Cloudflare Tunnel para exponer el backend"
if (-not $SkipDeploy) {
    Write-Info "  3. Reconstruir y desplegar frontend a GitHub Pages"
}
Write-Host ""

# ============================================================================
# PASO 1: Verificar requisitos
# ============================================================================
Write-Header "PASO 1: Verificando requisitos..."

# Python
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Error "ERROR: Python no encontrado en PATH"
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Success "  [OK] Python: $(python --version)"

# Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Error "ERROR: Node.js no encontrado en PATH"
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Success "  [OK] Node.js: $(node --version)"

# Cloudflared
$cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cfCmd) {
    Write-Error "ERROR: cloudflared no encontrado. Instalar con: winget install Cloudflare.cloudflared"
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Success "  [OK] Cloudflared: $(cloudflared --version)"

# Git
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    Write-Error "ERROR: Git no encontrado en PATH"
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Success "  [OK] Git instalado"

# Venv
if (-not (Test-Path $VenvActivate)) {
    Write-Warning "  [!] Entorno virtual no encontrado. Creando..."
    python -m venv (Join-Path $ProjectRoot ".venv")
}
Write-Success "  [OK] Entorno virtual encontrado"

# ============================================================================
# PASO 2: Iniciar Backend Flask
# ============================================================================
Write-Header "PASO 2: Iniciando Backend Flask..."

# Verificar si ya hay algo en el puerto
$portInUse = Get-NetTCPConnection -LocalPort $BackendPort -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Warning "  Puerto $BackendPort en uso. Intentando cerrar proceso anterior..."
    $processes = Get-Process -Id $portInUse.OwningProcess -ErrorAction SilentlyContinue
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Iniciar backend en nueva ventana
$backendScript = @"
Set-Location '$ProjectRoot'
& '$VenvActivate'
`$env:FLASK_APP = 'wsgi.py'
`$env:FLASK_ENV = 'development'
`$env:SPM_DEBUG = '1'
Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'SPM Backend - Flask Server' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
python wsgi.py
"@

$backendProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript -PassThru
Write-Success "  [OK] Backend iniciando en ventana separada (PID: $($backendProc.Id))"

# Esperar a que el backend este listo
Write-Info "  Esperando a que el backend este listo..."
$maxRetries = 30
$retry = 0
do {
    Start-Sleep -Seconds 1
    $retry++
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$BackendPort/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Success "  [OK] Backend listo en http://localhost:$BackendPort"
            break
        }
    } catch {
        Write-Host "." -NoNewline
    }
} while ($retry -lt $maxRetries)

if ($retry -ge $maxRetries) {
    Write-Warning "  [!] Backend no respondio a tiempo. Continuando de todos modos..."
}

# ============================================================================
# PASO 3: Iniciar Cloudflare Tunnel
# ============================================================================
Write-Header "PASO 3: Iniciando Cloudflare Tunnel..."

$tunnelLogFile = Join-Path $ProjectRoot "tunnel.log"
if (Test-Path $tunnelLogFile) { Remove-Item $tunnelLogFile -Force }

# Iniciar tunnel en background y capturar la URL
$tunnelScript = @"
Set-Location '$ProjectRoot'
Write-Host '========================================' -ForegroundColor Magenta
Write-Host 'SPM - Cloudflare Tunnel' -ForegroundColor Magenta
Write-Host '========================================' -ForegroundColor Magenta
Write-Host ''
Write-Host 'Iniciando tunnel hacia localhost:$BackendPort...' -ForegroundColor Yellow
Write-Host ''
cloudflared tunnel --url http://localhost:$BackendPort 2>&1 | Tee-Object -FilePath '$tunnelLogFile'
"@

$tunnelProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", $tunnelScript -PassThru
Write-Info "  Tunnel iniciando... (PID: $($tunnelProc.Id))"

# Esperar y capturar la URL del tunnel
Write-Info "  Esperando URL del tunnel..."
$tunnelUrl = $null
$maxRetries = 60
$retry = 0

do {
    Start-Sleep -Seconds 2
    $retry++

    if (Test-Path $tunnelLogFile) {
        $logContent = Get-Content $tunnelLogFile -Raw -ErrorAction SilentlyContinue
        if ($logContent -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
            $tunnelUrl = $matches[0]
            break
        }
    }
    Write-Host "." -NoNewline
} while ($retry -lt $maxRetries)

Write-Host ""

if (-not $tunnelUrl) {
    Write-Error "  ERROR: No se pudo obtener la URL del tunnel"
    Write-Warning "  Revisa la ventana del tunnel para ver el error"
    Read-Host "Presiona Enter para continuar de todos modos"
} else {
    Write-Host ""
    Write-Host "  ============================================" -ForegroundColor Green
    Write-Host "  URL DEL TUNNEL:" -ForegroundColor Green
    Write-Host "  $tunnelUrl" -ForegroundColor Yellow
    Write-Host "  ============================================" -ForegroundColor Green
    Write-Host ""

    # Copiar al portapapeles
    $tunnelUrl | Set-Clipboard
    Write-Success "  [OK] URL copiada al portapapeles"
}

# ============================================================================
# PASO 4: Actualizar .env.production y Deploy
# ============================================================================
if (-not $SkipDeploy -and $tunnelUrl) {
    Write-Header "PASO 4: Actualizando configuracion y desplegando..."

    # Actualizar .env.production
    $envContent = "# URL del backend via Cloudflare Tunnel`n"
    $envContent += "# Generado automaticamente el $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"
    $envContent += "VITE_API_URL=$tunnelUrl/api`n"

    Set-Content -Path $EnvProduction -Value $envContent -Encoding UTF8
    Write-Success "  [OK] .env.production actualizado"

    # Build frontend
    Write-Info "  Construyendo frontend para produccion..."
    Set-Location $FrontendDir

    $env:GITHUB_PAGES = "true"
    npm run build 2>&1 | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Success "  [OK] Build completado"

        # Deploy a GitHub Pages
        Write-Info "  Desplegando a GitHub Pages..."

        # Usar gh-pages o git subtree
        $distDir = Join-Path $FrontendDir "dist"

        # Commit y push
        Set-Location $ProjectRoot
        git add frontend/dist -f 2>&1 | Out-Null
        git add frontend/.env.production 2>&1 | Out-Null

        # Crear rama gh-pages si no existe
        $ghPagesBranch = git branch --list gh-pages 2>&1
        if (-not $ghPagesBranch) {
            git checkout --orphan gh-pages 2>&1 | Out-Null
            git rm -rf . 2>&1 | Out-Null
            git checkout main 2>&1 | Out-Null
        }

        # Push subtree a gh-pages
        git subtree push --prefix frontend/dist origin gh-pages 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Success "  [OK] Desplegado a GitHub Pages"
        } else {
            Write-Warning "  [!] Error en deploy. Intenta manualmente:"
            Write-Info "      git subtree push --prefix frontend/dist origin gh-pages"
        }
    } else {
        Write-Error "  ERROR: Fallo el build del frontend"
    }

    Set-Location $ProjectRoot
}

# ============================================================================
# RESUMEN FINAL
# ============================================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "                    SPM INICIADO" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend Local:     " -NoNewline; Write-Host "http://localhost:$BackendPort" -ForegroundColor Yellow
if ($tunnelUrl) {
    Write-Host "  Backend Tunnel:    " -NoNewline; Write-Host $tunnelUrl -ForegroundColor Yellow
    Write-Host "  API Tunnel:        " -NoNewline; Write-Host "$tunnelUrl/api" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "  GitHub Pages:      " -NoNewline; Write-Host "https://manuelremon.github.io/SPMSystem2.0/" -ForegroundColor Green
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Warning "IMPORTANTE: Mantener esta ventana y las de Backend/Tunnel abiertas"
Write-Host ""

# Abrir navegador
Start-Process "https://manuelremon.github.io/SPMSystem2.0/"

Write-Host "Presiona Ctrl+C o cierra esta ventana para detener todo." -ForegroundColor Gray
Write-Host ""

# Mantener script corriendo
try {
    while ($true) {
        Start-Sleep -Seconds 60
        # Verificar que los procesos siguen vivos
        if ($backendProc.HasExited -and $tunnelProc.HasExited) {
            Write-Warning "Los procesos han terminado."
            break
        }
    }
} finally {
    # Cleanup al salir
    Write-Info "`nCerrando procesos..."
    if (-not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue }
    if (-not $tunnelProc.HasExited) { Stop-Process -Id $tunnelProc.Id -Force -ErrorAction SilentlyContinue }
    Write-Success "Procesos cerrados."
}
