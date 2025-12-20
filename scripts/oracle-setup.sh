#!/bin/bash
# =============================================================================
# SPM v2.0 - Oracle Cloud VPS Initial Setup Script
# =============================================================================
# Ejecutar en el VPS despues de conectar por SSH
# Uso: bash oracle-setup.sh
# =============================================================================

set -e  # Salir si hay error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== SPM v2.0 - Setup Oracle Cloud VPS ===${NC}"
echo ""

# -----------------------------------------------------------------------------
# 1. Actualizar sistema
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/7] Actualizando sistema...${NC}"
sudo apt-get update && sudo apt-get upgrade -y

# -----------------------------------------------------------------------------
# 2. Instalar dependencias basicas
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/7] Instalando dependencias basicas...${NC}"
sudo apt-get install -y \
    curl \
    git \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    iptables-persistent

# -----------------------------------------------------------------------------
# 3. Instalar Docker
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/7] Instalando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}Docker instalado${NC}"
else
    echo -e "${GREEN}Docker ya esta instalado${NC}"
fi

# -----------------------------------------------------------------------------
# 4. Instalar Docker Compose
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4/7] Instalando Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}Docker Compose instalado: ${COMPOSE_VERSION}${NC}"
else
    echo -e "${GREEN}Docker Compose ya esta instalado${NC}"
fi

# -----------------------------------------------------------------------------
# 5. Configurar Firewall (iptables)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[5/7] Configurando firewall...${NC}"
# Abrir puerto 80 (HTTP)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
# Abrir puerto 443 (HTTPS - para futuro SSL)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
# Guardar reglas
sudo netfilter-persistent save
echo -e "${GREEN}Firewall configurado (puertos 80, 443 abiertos)${NC}"

# -----------------------------------------------------------------------------
# 6. Crear Swap (2GB) - Importante para Ampere ARM con poca RAM
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[6/7] Configurando swap...${NC}"
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo -e "${GREEN}Swap de 2GB creado${NC}"
else
    echo -e "${GREEN}Swap ya existe${NC}"
fi

# -----------------------------------------------------------------------------
# 7. Crear directorio para la aplicacion
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[7/7] Preparando directorio de aplicacion...${NC}"
mkdir -p ~/spm
cd ~/spm

echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}Setup completado!${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""
echo -e "Pasos siguientes:"
echo -e "1. ${YELLOW}Cerrar sesion SSH y reconectar${NC} (para aplicar grupo docker)"
echo -e "2. Clonar repositorio: ${YELLOW}git clone https://github.com/TU_USUARIO/SPMv2.0.git ~/spm${NC}"
echo -e "3. Crear archivo .env: ${YELLOW}cp ~/spm/infra/.env.production.example ~/spm/infra/.env.production${NC}"
echo -e "4. Editar .env.production con tus valores"
echo -e "5. Ejecutar deploy: ${YELLOW}bash ~/spm/scripts/deploy.sh${NC}"
echo ""
echo -e "${RED}IMPORTANTE: Reconecta SSH antes de continuar${NC}"
