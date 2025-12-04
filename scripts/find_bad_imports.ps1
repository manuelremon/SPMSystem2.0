# Script para encontrar y corregir TODOS los imports incorrectos en backend/

Write-Host "=== BUSQUEDA DE IMPORTS PROBLEMATICOS ===" -ForegroundColor Cyan
Write-Host ""

$pyFiles = Get-ChildItem -Path "src\backend" -Filter "*.py" -Recurse | ForEach-Object { $_.FullName }
Write-Host "Archivos encontrados: $($pyFiles.Count)" -ForegroundColor Cyan

$allReplacements = @()

foreach ($file in $pyFiles) {
    $content = Get-Content $file -Raw

    # Detectar imports problemáticos
    if ($content -match "from \.\. (?!services|core|middleware|models|api|routes)") {
        # from .. que no son los modulos esperados
        $matches = [regex]::Matches($content, "from \.\. [a-zA-Z_]+ import")
        foreach ($match in $matches) {
            Write-Host "PROBLEMA en $(Split-Path $file -Leaf): $($match.Value)" -ForegroundColor Yellow
        }
    }

    # Encontrar todos los from .. para verificación manual
    if ($content -match "from \.\. import|from \.\.[a-zA-Z]") {
        $matches = [regex]::Matches($content, "from \.\.\.?[a-zA-Z_.]+( import)?")
        foreach ($match in $matches) {
            $found = $false
            foreach ($item in $allReplacements) {
                if ($item.file -eq $file -and $item.pattern -eq $match.Value) {
                    $found = $true
                    break
                }
            }
            if (-not $found) {
                $allReplacements += @{ file = $file; pattern = $match.Value }
            }
        }
    }
}

Write-Host ""
Write-Host "=== IMPORTS CON .. ENCONTRADOS ===" -ForegroundColor Cyan
$allReplacements | ForEach-Object {
    Write-Host "$(Split-Path $_.file -Leaf): $($_.pattern)" -ForegroundColor Yellow
}
