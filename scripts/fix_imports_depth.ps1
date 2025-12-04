# Script para corregir la profundidad de imports (... -> ..)
# Los archivos en routes/ deben usar .. para llegar a backend/services/

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

Write-Host "=== CORRECCION DE PROFUNDIDAD DE IMPORTS ===" -ForegroundColor Cyan
Write-Host "De: from ...services.auth.auth" -ForegroundColor Yellow
Write-Host "Para: from ..services.auth.auth" -ForegroundColor Green
Write-Host ""

$fixed = 0
foreach ($file in $files) {
    $fullPath = Join-Path $routesDir $file

    if (Test-Path $fullPath) {
        Write-Host "Procesando: $file" -ForegroundColor Yellow
        $content = Get-Content $fullPath -Raw

        # Reemplazo: ... -> ..
        $newContent = $content -replace "from \.\.\.services\.auth\.auth import", "from ..services.auth.auth import"

        if ($content -ne $newContent) {
            Set-Content $fullPath -Value $newContent -Force
            Write-Host "  -> CORREGIDO (3 puntos -> 2 puntos)" -ForegroundColor Green
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
