# Script simple para corregir imports en archivos de rutas
# Cambio: from ..auth import X -> from ...services.auth.auth import X

$routesDir = "src\backend\routes"
$files = @(
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

Write-Host "=== CORRECCION DE IMPORTS ===" -ForegroundColor Cyan
Write-Host "Directorio: $routesDir" -ForegroundColor Cyan
Write-Host "Archivos: $($files.Count)" -ForegroundColor Cyan
Write-Host ""

$fixed = 0
foreach ($file in $files) {
    $fullPath = Join-Path $routesDir $file

    if (Test-Path $fullPath) {
        Write-Host "Procesando: $file" -ForegroundColor Yellow
        $content = Get-Content $fullPath -Raw

        # Reemplazo
        $newContent = $content -replace "from \.\.auth import", "from ...services.auth.auth import"

        if ($content -ne $newContent) {
            Set-Content $fullPath -Value $newContent -Force
            Write-Host "  -> ACTUALIZADO" -ForegroundColor Green
            $fixed++
        } else {
            Write-Host "  -> sin cambios" -ForegroundColor Gray
        }
    } else {
        Write-Host "ERROR: No encontrado $fullPath" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== RESUMEN ===" -ForegroundColor Green
Write-Host "Archivos procesados: $($files.Count)" -ForegroundColor Cyan
Write-Host "Archivos corregidos: $fixed" -ForegroundColor Green
