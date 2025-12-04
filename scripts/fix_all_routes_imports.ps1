# Script para corregir imports relativos en archivos routes/

$routesDir = "src\backend\routes"
$files = Get-ChildItem -Path $routesDir -Filter "*.py" | ForEach-Object { $_.Name }

Write-Host "=== CORRECCION DE IMPORTS EN routes/ ===" -ForegroundColor Cyan
Write-Host "Archivos encontrados: $($files.Count)" -ForegroundColor Cyan
Write-Host ""

$replacements = @(
    @{
        old = "from \.\.db import"
        new = "from src.backend.core.db import"
        desc = "../db -> src.backend.core.db"
    },
    @{
        old = "from \.\.schemas import"
        new = "from src.backend.models.schemas import"
        desc = "../schemas -> src.backend.models.schemas"
    },
    @{
        old = "from \.\.security import"
        new = "from src.backend.services.db.security import"
        desc = "../security -> src.backend.services.db.security"
    },
    @{
        old = "from \.\.models import"
        new = "from src.backend.models import"
        desc = "../models -> src.backend.models"
    },
    @{
        old = "from \.\.middleware import"
        new = "from src.backend.middleware import"
        desc = "../middleware -> src.backend.middleware"
    },
    @{
        old = "from \.\.api import"
        new = "from src.backend.api import"
        desc = "../api -> src.backend.api"
    }
)

$totalFixed = 0
foreach ($file in $files) {
    $fullPath = Join-Path $routesDir $file

    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        $newContent = $content
        $fixedInFile = 0

        foreach ($replacement in $replacements) {
            if ($newContent -match $replacement.old) {
                $newContent = $newContent -replace $replacement.old, $replacement.new
                $fixedInFile++
            }
        }

        if ($fixedInFile -gt 0) {
            Set-Content $fullPath -Value $newContent -Force
            Write-Host "$file - $fixedInFile imports corregidos" -ForegroundColor Green
            $totalFixed += $fixedInFile
        }
    }
}

Write-Host ""
Write-Host "=== RESUMEN ===" -ForegroundColor Green
Write-Host "Total de imports corregidos: $totalFixed" -ForegroundColor Green
