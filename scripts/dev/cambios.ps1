# Script para gestionar cambios y backups
# Uso: .\scripts\dev\cambios.ps1 -accion backup|revert|status

param(
    [string]$accion = "help",
    [string]$archivo = "",
    [string]$fecha = ""
)

$proyectoRaiz = "d:\GitHub\SPMv1.0"
$dirBackups = "$proyectoRaiz\src\frontend\backups"
$registroCambios = "$proyectoRaiz\docs\history\CAMBIOS_REGISTRO.md"

# Crear directorio de backups si no existe
if (-not (Test-Path $dirBackups)) {
    New-Item -ItemType Directory -Path $dirBackups -Force | Out-Null
    Write-Host "✅ Directorio de backups creado: $dirBackups" -ForegroundColor Green
}

function Show-Help {
    Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║  GESTOR DE CAMBIOS - SPM v1.0 Refactorización                ║
╚═══════════════════════════════════════════════════════════════╝

ACCIONES:

  backup [archivo]
    → Crear backup de un archivo específico
    → Si no se especifica, respalda los archivos principales
    Ejemplo: .\scripts\dev\cambios.ps1 -accion backup -archivo "app.js"

  revert [archivo] [fecha]
    → Revertir un archivo a una versión anterior
    → Si no se especifica fecha, usa el más reciente
    Ejemplo: .\scripts\dev\cambios.ps1 -accion revert -archivo "app.js"

  status
    → Ver estado: cambios sin respaldar, backups disponibles
    Ejemplo: .\scripts\dev\cambios.ps1 -accion status

  list-backups
    → Listar todos los backups disponibles
    Ejemplo: .\scripts\dev\cambios.ps1 -accion list-backups

  clean-old
    → Eliminar backups más antiguos de 30 días
    Ejemplo: .\scripts\dev\cambios.ps1 -accion clean-old

  git-info
    → Ver información de Git (últimos commits, cambios)
    Ejemplo: .\scripts\dev\cambios.ps1 -accion git-info

  help
    → Mostrar esta ayuda
    Ejemplo: .\scripts\dev\cambios.ps1 -accion help

═══════════════════════════════════════════════════════════════

ARCHIVOS PRINCIPALES QUE SE RESPALDAN:
  • app.js
  • index.html
  • styles.css
  • vite.config.js

═══════════════════════════════════════════════════════════════
"@
}

function New-Backup {
    param($archivo)

    $timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
    $nombreArchivo = Split-Path -Leaf $archivo
    $rutaBackup = "$dirBackups\$nombreArchivo.backup-$timestamp"

    if (-not (Test-Path "$proyectoRaiz\src\frontend\$archivo")) {
        Write-Host "❌ Archivo no encontrado: $archivo" -ForegroundColor Red
        return
    }

    Copy-Item "$proyectoRaiz\src\frontend\$archivo" $rutaBackup
    Write-Host "✅ Backup creado: $rutaBackup" -ForegroundColor Green
    Write-Host "   📅 Timestamp: $timestamp" -ForegroundColor Cyan
}

function Revert-File {
    param($archivo, $backupFecha)

    $nombreArchivo = Split-Path -Leaf $archivo

    # Si no se especifica fecha, usar el más reciente
    if (-not $backupFecha) {
        $backupMasReciente = Get-ChildItem "$dirBackups\$nombreArchivo.backup-*" -ErrorAction SilentlyContinue | Sort-Object -Descending | Select-Object -First 1

        if (-not $backupMasReciente) {
            Write-Host "❌ No hay backups disponibles para: $nombreArchivo" -ForegroundColor Red
            return
        }

        $rutaBackup = $backupMasReciente.FullName
    } else {
        $rutaBackup = "$dirBackups\$nombreArchivo.backup-$backupFecha"
    }

    if (-not (Test-Path $rutaBackup)) {
        Write-Host "❌ Backup no encontrado: $rutaBackup" -ForegroundColor Red
        return
    }

    # Crear backup del archivo actual antes de revertir
    $timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
    $backupActual = "$dirBackups\$nombreArchivo.current-$timestamp"
    Copy-Item "$proyectoRaiz\src\frontend\$archivo" $backupActual

    # Revertir
    Copy-Item $rutaBackup "$proyectoRaiz\src\frontend\$archivo" -Force
    Write-Host "✅ Archivo revertido: $archivo" -ForegroundColor Green
    Write-Host "   📋 Backup actual guardado en: $backupActual" -ForegroundColor Cyan
    Write-Host "   ⏮️  Restaurado desde: $rutaBackup" -ForegroundColor Cyan
}

function Show-Status {
    Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║  ESTADO DEL PROYECTO                                          ║
╚═══════════════════════════════════════════════════════════════╝

📁 DIRECTORIOS:
"@ -ForegroundColor Cyan

    Write-Host "   Raíz: $proyectoRaiz"
    Write-Host "   Backups: $dirBackups"
    Write-Host "   Registro: $registroCambios"

    Write-Host "`n📋 CAMBIOS EN GIT:" -ForegroundColor Cyan
    & git -C $proyectoRaiz status --short

    Write-Host "`n💾 BACKUPS DISPONIBLES:" -ForegroundColor Cyan
    $backups = Get-ChildItem $dirBackups -Filter "*.backup-*" -ErrorAction SilentlyContinue | Sort-Object -Descending

    if ($backups) {
        $backups | ForEach-Object {
            Write-Host "   📦 $($_.Name)"
            Write-Host "      Tamaño: $('{0:N0}' -f $_.Length) bytes"
            Write-Host "      Fecha: $($_.LastWriteTime)"
        }
    } else {
        Write-Host "   ℹ️  No hay backups aún" -ForegroundColor Yellow
    }
}

function List-Backups {
    Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║  BACKUPS DISPONIBLES                                          ║
╚═══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

    $backups = Get-ChildItem $dirBackups -Filter "*.backup-*" -ErrorAction SilentlyContinue | Sort-Object -Descending

    if ($backups) {
        $backups | ForEach-Object {
            $nombre = $_.Name
            $tamaño = '{0:N0}' -f $_.Length
            $fecha = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
            Write-Host "📦 $nombre | $tamaño bytes | $fecha"
        }
    } else {
        Write-Host "❌ No hay backups disponibles" -ForegroundColor Yellow
    }
}

function Clean-OldBackups {
    Write-Host "🧹 Limpiando backups antiguos (>30 días)..." -ForegroundColor Yellow

    $fechaLimite = (Get-Date).AddDays(-30)
    $backupsAntiguos = Get-ChildItem $dirBackups -Filter "*.backup-*" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $fechaLimite }

    if ($backupsAntiguos) {
        $backupsAntiguos | ForEach-Object {
            Remove-Item $_.FullName -Force
            Write-Host "   ❌ Eliminado: $($_.Name)"
        }
        Write-Host "✅ Limpieza completada" -ForegroundColor Green
    } else {
        Write-Host "✅ No hay backups para limpiar" -ForegroundColor Green
    }
}

function Show-GitInfo {
    Write-Host @"
╔═══════════════════════════════════════════════════════════════╗
║  INFORMACIÓN DE GIT                                           ║
╚═══════════════════════════════════════════════════════════════╝

📊 ÚLTIMOS 10 COMMITS:
"@ -ForegroundColor Cyan

    & git -C $proyectoRaiz log --oneline -10

    Write-Host "`n📝 CAMBIOS SIN GUARDAR:" -ForegroundColor Cyan
    & git -C $proyectoRaiz status --short

    Write-Host "`n🔄 RAMA ACTUAL:" -ForegroundColor Cyan
    & git -C $proyectoRaiz branch --show-current
}

# Ejecutar acción
switch ($accion.ToLower()) {
    "backup" {
        if ($archivo) {
            New-Backup -archivo $archivo
        } else {
            Write-Host "🔄 Respaldando archivos principales..." -ForegroundColor Yellow
            @("app.js", "index.html", "styles.css", "vite.config.js") | ForEach-Object {
                New-Backup -archivo $_
            }
        }
    }

    "revert" {
        if ($archivo) {
            Revert-File -archivo $archivo -backupFecha $fecha
        } else {
            Write-Host "❌ Debe especificar el archivo" -ForegroundColor Red
            Show-Help
        }
    }

    "status" { Show-Status }
    "list-backups" { List-Backups }
    "clean-old" { Clean-OldBackups }
    "git-info" { Show-GitInfo }
    "help" { Show-Help }
    default {
        Write-Host "❌ Acción desconocida: $accion" -ForegroundColor Red
        Show-Help
    }
}
