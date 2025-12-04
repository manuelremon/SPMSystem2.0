# Script final para corregir TODOS los imports restantes en routes/

$replacements = @(
    @{ find = "from \.\.config import"; replace = "from src.backend.core.config import" },
    @{ find = "from \.\.roles import"; replace = "from src.backend.middleware.roles import" },
    @{ find = "from \.\.routes\.solicitudes import"; replace = "from src.backend.routes.solicitudes import" },
    @{ find = "from \.\.health import"; replace = "from src.backend.api.health import" },
    @{ find = "from \.\.services import"; replace = "from src.backend.services import" }
)

$pyFiles = Get-ChildItem -Path "src\backend" -Filter "*.py" -Recurse

Write-Host "=== CORRECCION FINAL DE IMPORTS ===" -ForegroundColor Cyan
$totalFixed = 0

foreach ($file in $pyFiles) {
    $content = Get-Content $file.FullName -Raw
    $newContent = $content

    foreach ($replacement in $replacements) {
        if ($newContent -match $replacement.find) {
            $newContent = $newContent -replace $replacement.find, $replacement.replace
            $totalFixed++
        }
    }

    if ($newContent -ne $content) {
        Set-Content $file.FullName -Value $newContent -Force
        Write-Host "$(Split-Path $file.FullName -Leaf) - actualizado" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Total de reemplazos: $totalFixed" -ForegroundColor Green
