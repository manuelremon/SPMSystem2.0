#!/bin/bash
# =============================================================================
# SPM v2.0 - Deployment Script for Oracle Cloud VPS
# =============================================================================
# Ejecutar despues de oracle-setup.sh
# Uso: bash deploy.sh [--rebuild] [--logs]
# =============================================================================

set -e  # Salir si hay error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directorio base
SPM_DIR="${SPM_DIR:-$HOME/spm}"
INFRA_DIR="$SPM_DIR/infra"

# Argumentos
REBUILD=false
SHOW_LOGS=false

for arg in "$@"; do
    case $arg in
        --rebuild)
            REBUILD=true
            shift
            ;;
        --logs)
            SHOW_LOGS=true
            shift
            ;;
    esac
done

echo -e "${GREEN}=== SPM v2.0 - Deploy Script ===${NC}"
echo -e "Directorio: ${BLUE}$SPM_DIR${NC}"
echo ""

# -----------------------------------------------------------------------------
# Verificar prerequisitos
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/7] Verificando prerequisitos...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker no instalado. Ejecuta oracle-setup.sh primero${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose no instalado${NC}"
    exit 1
fi

if [ ! -f "$INFRA_DIR/.env.production" ]; then
    echo -e "${RED}Error: Archivo .env.production no encontrado${NC}"
    echo -e "Crea el archivo: cp $INFRA_DIR/.env.production.example $INFRA_DIR/.env.production"
    echo -e "Y edita los valores con tus credenciales"
    exit 1
fi

echo -e "${GREEN}Prerequisitos OK${NC}"

# -----------------------------------------------------------------------------
# Pull latest code
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/7] Actualizando codigo...${NC}"
cd "$SPM_DIR"
git fetch origin
git pull origin main
echo -e "${GREEN}Codigo actualizado${NC}"

# -----------------------------------------------------------------------------
# Install Node.js if needed and build frontend
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/7] Construyendo frontend...${NC}"

# Verificar si Node.js esta instalado
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Instalando Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

cd "$SPM_DIR/frontend"
npm ci --production=false  # Necesitamos devDependencies para build
npm run build
echo -e "${GREEN}Frontend construido${NC}"

# -----------------------------------------------------------------------------
# Build Docker images
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4/7] Construyendo imagenes Docker...${NC}"
cd "$INFRA_DIR"

# Cargar variables de entorno
set -a
source .env.production
set +a

if [ "$REBUILD" = true ]; then
    echo -e "${YELLOW}Forzando rebuild de imagenes...${NC}"
    docker-compose -f docker-compose.prod.yml build --no-cache
else
    docker-compose -f docker-compose.prod.yml build
fi

echo -e "${GREEN}Imagenes construidas${NC}"

# -----------------------------------------------------------------------------
# Stop existing containers
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[5/7] Deteniendo containers existentes...${NC}"
docker-compose -f docker-compose.prod.yml down --remove-orphans || true
echo -e "${GREEN}Containers detenidos${NC}"

# -----------------------------------------------------------------------------
# Start containers
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[6/7] Iniciando containers...${NC}"
docker-compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}Containers iniciados${NC}"

# -----------------------------------------------------------------------------
# Health check
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[7/7] Verificando salud del servicio...${NC}"
sleep 15  # Esperar a que los servicios inicien

# Verificar que el backend responda
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf http://localhost/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}Health check: OK${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -e "${YELLOW}Esperando servicio... (intento $RETRY_COUNT/$MAX_RETRIES)${NC}"
    sleep 5
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}Health check FAILED${NC}"
    echo -e "Revisa los logs: docker-compose -f docker-compose.prod.yml logs"
    exit 1
fi

# -----------------------------------------------------------------------------
# Mostrar estado final
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}Deploy completado!${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""
echo -e "Containers activos:"
docker-compose -f docker-compose.prod.yml ps
echo ""
echo -e "Accede a la aplicacion en: ${BLUE}http://$(curl -s ifconfig.me)${NC}"
echo ""

# Mostrar logs si se solicito
if [ "$SHOW_LOGS" = true ]; then
    echo -e "${YELLOW}=== Logs ===${NC}"
    docker-compose -f docker-compose.prod.yml logs --tail=50
fi

echo -e "Comandos utiles:"
echo -e "  Ver logs:     ${YELLOW}docker-compose -f $INFRA_DIR/docker-compose.prod.yml logs -f${NC}"
echo -e "  Reiniciar:    ${YELLOW}docker-compose -f $INFRA_DIR/docker-compose.prod.yml restart${NC}"
echo -e "  Detener:      ${YELLOW}docker-compose -f $INFRA_DIR/docker-compose.prod.yml down${NC}"
echo -e "  Backup BD:    ${YELLOW}docker exec spm-postgres pg_dump -U spm spm_production > backup.sql${NC}"
