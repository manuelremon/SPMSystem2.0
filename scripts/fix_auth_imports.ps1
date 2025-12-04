# Script para corregir todos los imports en services/auth/auth.py

$filePath = "src\backend\services\auth\auth.py"

Write-Host "=== CORRECCION DE IMPORTS EN auth.py ===" -ForegroundColor Cyan
Write-Host "Archivo: $filePath" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $filePath) {
    $content = Get-Content $filePath -Raw

    # Lista de reemplazos
    $replacements = @(
        @{
            old = "from \.\.\.middleware\.csrf import"
            new = "from src.backend.middleware.csrf import"
        },
        @{
            old = "from \.\.\.middleware\.ratelimit import"
            new = "from src.backend.middleware.ratelimit import"
        },
        @{
            old = "from \.\.\.middleware\.auth_helpers import"
            new = "from src.backend.middleware.auth_helpers import"
        },
        @{
            old = "from \.\.\.core\.config import"
            new = "from src.backend.core.config import"
        },
        @{
            old = "from \.\.\.middleware\.decorators import"
            new = "from src.backend.middleware.decorators import"
        },
        @{
            old = "from \.\.\.core\.db import"
            new = "from src.backend.core.db import"
        },
        @{
            old = "from \.\.\.middleware\.security import"
            new = "from src.backend.middleware.security import"
        }
    )

    $newContent = $content
    $fixedCount = 0

    foreach ($replacement in $replacements) {
        if ($newContent -match $replacement.old) {
            Write-Host "Reemplazando: $($replacement.old)" -ForegroundColor Yellow
            $newContent = $newContent -replace $replacement.old, $replacement.new
            Write-Host "  -> $($replacement.new)" -ForegroundColor Green
            $fixedCount++
        }
    }

    if ($fixedCount -gt 0) {
        Set-Content $filePath -Value $newContent -Force
        Write-Host ""
        Write-Host "=== RESULTADO ===" -ForegroundColor Green
        Write-Host "Imports corregidos: $fixedCount" -ForegroundColor Green
    } else {
        Write-Host "No se encontraron imports para corregir" -ForegroundColor Yellow
    }
} else {
    Write-Host "ERROR: No encontrado $filePath" -ForegroundColor Red
}
