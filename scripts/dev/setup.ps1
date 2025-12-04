# 🚀 Setup Script para SPM Development
# Automatiza la configuración inicial del proyecto

param(
    [switch]$Full = $false,
    [switch]$Help = $false
)

function Show-Help {
    Write-Host @"
📖 SPM Development Setup

Uso:
  .\scripts\dev\setup.ps1                # Setup rápido
  .\scripts\dev\setup.ps1 -Full          # Setup completo (con npm)
  .\scripts\dev\setup.ps1 -Help          # Mostrar esta ayuda

Qué hace:
  • Crear/activar entorno virtual
  • Instalar dependencias Python
  • Configurar variables de entorno
  • Validar instalación
  • (Full) Instalar dependencias Node

Variables de entorno configuradas:
  • PORT=5000
  • SPM_SECRET_KEY=dev-temp-key
  • AUTH_BYPASS=1
  • SPM_ENV=development
  • SPM_DEBUG=1

"@
    exit 0
}

if ($Help) { Show-Help }

Write-Host "🚀 Configurando SPM Development Environment..." -ForegroundColor Green

# 1. Crear entorno virtual
if (-not (Test-Path ".venv")) {
    Write-Host "📦 Creando entorno virtual..." -ForegroundColor Cyan
    python -m venv .venv
} else {
    Write-Host "✓ Entorno virtual ya existe" -ForegroundColor Green
}

# 2. Activar entorno
Write-Host "🔌 Activando entorno virtual..." -ForegroundColor Cyan
& ".\.venv\Scripts\Activate.ps1"

# 3. Instalar/actualizar pip
Write-Host "📥 Actualizando pip..." -ForegroundColor Cyan
python -m pip install --upgrade pip -q

# 4. Instalar dependencias Python
Write-Host "📚 Instalando dependencias Python..." -ForegroundColor Cyan
if (Test-Path "requirements.txt") {
    pip install -r requirements.txt -q
    Write-Host "✓ Dependencias Python instaladas" -ForegroundColor Green
} else {
    Write-Host "⚠️ requirements.txt no encontrado" -ForegroundColor Yellow
}

# 5. Crear .env si no existe
if (-not (Test-Path ".env")) {
    Write-Host "⚙️ Creando .env..." -ForegroundColor Cyan
    @"
# SPM Environment Configuration
PORT=5000
SPM_SECRET_KEY=dev-temp-key
AUTH_BYPASS=1
SPM_ENV=development
SPM_DEBUG=1
SPM_DB_PATH=./spm.db
SPM_LOG_PATH=./logs/app.log
SPM_UPLOAD_DIR=./uploads
FRONTEND_ORIGIN=http://localhost:5000
"@ | Out-File -Encoding UTF8 .env
    Write-Host "✓ .env creado" -ForegroundColor Green
} else {
    Write-Host "✓ .env ya existe" -ForegroundColor Green
}

# 6. Crear directorios necesarios
$dirs = @("logs", "uploads", "database/backup")
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
}

# 7. Instalar dependencias Node (opcional)
if ($Full) {
    Write-Host "📱 Instalando dependencias Node..." -ForegroundColor Cyan
    if (Test-Path "src/frontend") {
        Push-Location src/frontend
        npm install -q
        npm run build -q
        Pop-Location
        Write-Host "✓ Dependencias Node instaladas y frontend compilado" -ForegroundColor Green
    }
}

# 8. Validar instalación
Write-Host "`n✅ Validando instalación..." -ForegroundColor Green
Write-Host ""

$checks = @(
    @{ Name = "Python"; Cmd = "python --version" },
    @{ Name = "Pip"; Cmd = "pip --version" },
    @{ Name = "Requirements.txt"; Path = "requirements.txt" },
    @{ Name = ".env"; Path = ".env" }
)

foreach ($check in $checks) {
    try {
        if ($check.Path) {
            if (Test-Path $check.Path) {
                Write-Host "  ✓ $($check.Name)" -ForegroundColor Green
            } else {
                Write-Host "  ✗ $($check.Name) - NO ENCONTRADO" -ForegroundColor Red
            }
        } else {
            $result = Invoke-Expression $check.Cmd 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ $($check.Name)" -ForegroundColor Green
            }
        }
    }
    catch {
        Write-Host "  ✗ $($check.Name) - ERROR" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✨ ¡Setup completado!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Cyan
Write-Host "  1. python .\src\backend\app.py        # Ejecutar servidor"
Write-Host "  2. http://127.0.0.1:5000/             # Abrir en navegador"
Write-Host ""
Write-Host "Para más info: STRUCTURE.md o README-dev.md" -ForegroundColor Gray
