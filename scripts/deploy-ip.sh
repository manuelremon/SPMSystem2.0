#!/bin/bash
# =============================================================================
# SPM v2.0 - Script de Despliegue para Acceso por IP (Sin SSL)
# =============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}SPM v2.0 - Despliegue por IP (Sin SSL)${NC}"
echo -e "${GREEN}==========================================${NC}"

# Directorio base
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BASE_DIR"

echo ""
echo -e "${YELLOW}[1/7] Verificando prerequisitos...${NC}"

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}ERROR: Docker no esta instalado${NC}"
    echo "Ejecuta primero: ./scripts/oracle-setup.sh"
    exit 1
fi

# Verificar Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}ERROR: Docker Compose no esta instalado${NC}"
    echo "Ejecuta primero: ./scripts/oracle-setup.sh"
    exit 1
fi
echo -e "${GREEN}      Docker y Docker Compose OK${NC}"

# Verificar archivo .env.production
if [ ! -f "infra/.env.production" ]; then
    echo -e "${RED}ERROR: No existe infra/.env.production${NC}"
    echo "Copia el template y configura:"
    echo "  cp infra/.env.production.example infra/.env.production"
    echo "  nano infra/.env.production"
    exit 1
fi
echo -e "${GREEN}      .env.production OK${NC}"

echo ""
echo -e "${YELLOW}[2/7] Instalando dependencias del frontend...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    npm ci --legacy-peer-deps
else
    echo "      node_modules existe, saltando..."
fi
echo -e "${GREEN}      npm ci OK${NC}"

echo ""
echo -e "${YELLOW}[3/7] Construyendo frontend (React/Vite)...${NC}"
npm run build
echo -e "${GREEN}      Build completado${NC}"

echo ""
echo -e "${YELLOW}[4/7] Volviendo al directorio base...${NC}"
cd "$BASE_DIR"

echo ""
echo -e "${YELLOW}[5/7] Construyendo imagenes Docker...${NC}"
cd infra
docker-compose -f docker-compose.ip.yml --env-file .env.production build --no-cache
echo -e "${GREEN}      Build Docker OK${NC}"

echo ""
echo -e "${YELLOW}[6/7] Deteniendo containers existentes...${NC}"
docker-compose -f docker-compose.ip.yml --env-file .env.production down 2>/dev/null || true
echo -e "${GREEN}      Containers detenidos${NC}"

echo ""
echo -e "${YELLOW}[7/7] Iniciando servicios...${NC}"
docker-compose -f docker-compose.ip.yml --env-file .env.production up -d
echo -e "${GREEN}      Servicios iniciados${NC}"

# Esperar a que los servicios esten listos
echo ""
echo -e "${YELLOW}Esperando a que los servicios esten listos...${NC}"
sleep 10

# Health check
echo ""
echo -e "${YELLOW}Verificando health...${NC}"
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health | grep -q "200"; then
        echo -e "${GREEN}      Health check OK${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "      Intento $RETRY_COUNT de $MAX_RETRIES..."
    sleep 5
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}ADVERTENCIA: Health check no paso. Revisa los logs:${NC}"
    echo "  docker-compose -f docker-compose.ip.yml logs backend"
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}DESPLIEGUE COMPLETADO${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "Acceso:"
echo "  - Frontend: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'TU_IP')"
echo "  - API:      http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'TU_IP')/api/health"
echo ""
echo "Comandos utiles:"
echo "  - Ver logs:      docker-compose -f infra/docker-compose.ip.yml logs -f"
echo "  - Ver backend:   docker-compose -f infra/docker-compose.ip.yml logs backend"
echo "  - Ver nginx:     docker-compose -f infra/docker-compose.ip.yml logs nginx"
echo "  - Ver postgres:  docker-compose -f infra/docker-compose.ip.yml logs postgres"
echo "  - Reiniciar:     docker-compose -f infra/docker-compose.ip.yml restart"
echo "  - Detener:       docker-compose -f infra/docker-compose.ip.yml down"
echo ""
echo "Si quieres configurar SSL mas tarde:"
echo "  1. Configura DNS para apuntar al VPS"
echo "  2. Ejecuta: ./scripts/setup-ssl.sh"
echo -e "${GREEN}==========================================${NC}"
