#!/bin/bash
# =============================================================================
# SPM v2.0 - SSL Setup Script with Let's Encrypt
# =============================================================================
# Ejecutar DESPUES de deploy.sh y configurar DNS
# Uso: bash setup-ssl.sh [--staging]
# =============================================================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuracion
DOMAIN="planifica-materiales.com"
EMAIL="${SSL_EMAIL:-admin@planifica-materiales.com}"
SPM_DIR="${SPM_DIR:-$HOME/spm}"
INFRA_DIR="$SPM_DIR/infra"

# Staging flag (para pruebas)
STAGING=false
for arg in "$@"; do
    case $arg in
        --staging)
            STAGING=true
            shift
            ;;
    esac
done

echo -e "${GREEN}=== SPM v2.0 - SSL Setup con Let's Encrypt ===${NC}"
echo -e "Dominio: ${BLUE}$DOMAIN${NC}"
echo -e "Email: ${BLUE}$EMAIL${NC}"
if [ "$STAGING" = true ]; then
    echo -e "${YELLOW}MODO STAGING (certificados de prueba)${NC}"
fi
echo ""

# -----------------------------------------------------------------------------
# 1. Verificar DNS
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/5] Verificando DNS...${NC}"

# Obtener IP del VPS
VPS_IP=$(curl -s ifconfig.me)
echo -e "IP del VPS: ${BLUE}$VPS_IP${NC}"

# Verificar que el dominio apunta al VPS
DOMAIN_IP=$(dig +short $DOMAIN | head -1)
WWW_IP=$(dig +short www.$DOMAIN | head -1)

echo -e "IP de $DOMAIN: ${BLUE}$DOMAIN_IP${NC}"
echo -e "IP de www.$DOMAIN: ${BLUE}$WWW_IP${NC}"

if [ "$DOMAIN_IP" != "$VPS_IP" ]; then
    echo -e "${RED}ERROR: $DOMAIN no apunta a la IP del VPS ($VPS_IP)${NC}"
    echo -e "Configura el DNS en Namecheap antes de continuar"
    exit 1
fi

echo -e "${GREEN}DNS configurado correctamente${NC}"

# -----------------------------------------------------------------------------
# 2. Instalar Certbot
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/5] Instalando Certbot...${NC}"

if ! command -v certbot &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y certbot
    echo -e "${GREEN}Certbot instalado${NC}"
else
    echo -e "${GREEN}Certbot ya instalado${NC}"
fi

# -----------------------------------------------------------------------------
# 3. Detener nginx temporalmente y crear directorio certbot
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/5] Preparando para certificado...${NC}"

cd "$INFRA_DIR"

# Detener nginx
docker-compose -f docker-compose.prod.yml stop nginx || true

# Crear directorio para challenge
sudo mkdir -p /var/www/certbot

# -----------------------------------------------------------------------------
# 4. Obtener certificado
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4/5] Obteniendo certificado SSL...${NC}"

STAGING_FLAG=""
if [ "$STAGING" = true ]; then
    STAGING_FLAG="--staging"
fi

sudo certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --domains "$DOMAIN" \
    --domains "www.$DOMAIN" \
    $STAGING_FLAG

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Certificado obtenido correctamente${NC}"
else
    echo -e "${RED}Error obteniendo certificado${NC}"
    exit 1
fi

# -----------------------------------------------------------------------------
# 5. Actualizar nginx y reiniciar
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[5/5] Configurando nginx con SSL...${NC}"

# Usar la configuracion con SSL
cp "$INFRA_DIR/nginx/default.conf" "$INFRA_DIR/nginx/default.conf.backup" 2>/dev/null || true

# Verificar que los certificados existen
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${RED}Certificados no encontrados${NC}"
    exit 1
fi

# Reiniciar nginx con SSL
docker-compose -f docker-compose.prod.yml up -d nginx

# Esperar y verificar
sleep 5

# Test HTTPS
if curl -sf "https://$DOMAIN/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}HTTPS funcionando correctamente${NC}"
else
    echo -e "${YELLOW}Advertencia: HTTPS puede tardar unos segundos en estar disponible${NC}"
fi

# -----------------------------------------------------------------------------
# 6. Configurar renovacion automatica
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Configurando renovacion automatica...${NC}"

# Agregar cron job para renovacion
CRON_JOB="0 3 * * * certbot renew --quiet --post-hook 'docker restart spm-nginx'"

# Verificar si ya existe
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo -e "${GREEN}Renovacion automatica configurada (diaria a las 3am)${NC}"
else
    echo -e "${GREEN}Renovacion automatica ya configurada${NC}"
fi

# -----------------------------------------------------------------------------
# Resumen
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}SSL configurado correctamente!${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""
echo -e "Tu sitio ahora es accesible en:"
echo -e "  ${BLUE}https://planifica-materiales.com${NC}"
echo -e "  ${BLUE}https://www.planifica-materiales.com${NC}"
echo ""
echo -e "Certificado valido hasta:"
sudo certbot certificates 2>/dev/null | grep "Expiry" || echo "Ver con: sudo certbot certificates"
echo ""
echo -e "Comandos utiles:"
echo -e "  Ver certificados: ${YELLOW}sudo certbot certificates${NC}"
echo -e "  Renovar manual:   ${YELLOW}sudo certbot renew --dry-run${NC}"
echo -e "  Logs nginx:       ${YELLOW}docker logs spm-nginx${NC}"
