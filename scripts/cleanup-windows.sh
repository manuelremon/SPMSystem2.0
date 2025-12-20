#!/bin/bash
# =============================================================================
# SPM v2.0 - Script de Limpieza de Carpetas Windows
# Ejecutar en el servidor Linux despues de subir el codigo desde Windows
# =============================================================================

set -e

echo "=========================================="
echo "SPM v2.0 - Limpieza de Carpetas Windows"
echo "=========================================="

# Directorio base (donde esta el codigo)
BASE_DIR="${1:-$(pwd)}"
cd "$BASE_DIR"

echo ""
echo "[1/6] Eliminando node_modules..."
rm -rf node_modules 2>/dev/null || true
rm -rf frontend/node_modules 2>/dev/null || true
echo "      OK"

echo ""
echo "[2/6] Eliminando entornos virtuales Python..."
rm -rf .venv 2>/dev/null || true
rm -rf venv 2>/dev/null || true
rm -rf env 2>/dev/null || true
echo "      OK"

echo ""
echo "[3/6] Eliminando archivos Python compilados..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
find . -type f -name "*.pyo" -delete 2>/dev/null || true
echo "      OK"

echo ""
echo "[4/6] Eliminando carpetas de IDE..."
rm -rf .git 2>/dev/null || true
rm -rf .idea 2>/dev/null || true
rm -rf .vscode 2>/dev/null || true
echo "      OK"

echo ""
echo "[5/6] Eliminando archivos temporales..."
rm -rf .tmp.driveupload 2>/dev/null || true
rm -rf frontend/dist 2>/dev/null || true
rm -rf frontend/.vite 2>/dev/null || true
rm -rf .cache 2>/dev/null || true
rm -rf .mypy_cache 2>/dev/null || true
rm -rf .pytest_cache 2>/dev/null || true
echo "      OK"

echo ""
echo "[6/6] Eliminando archivos de log..."
find . -name "*.log" -type f -delete 2>/dev/null || true
echo "      OK"

echo ""
echo "=========================================="
echo "Limpieza completada!"
echo ""
echo "Espacio liberado:"
du -sh . 2>/dev/null || echo "(no se pudo calcular)"
echo ""
echo "Siguiente paso:"
echo "  cd $BASE_DIR"
echo "  chmod +x scripts/deploy-ip.sh"
echo "  ./scripts/deploy-ip.sh"
echo "=========================================="
