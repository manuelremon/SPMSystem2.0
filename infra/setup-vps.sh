#!/usr/bin/env bash
# ==============================================================================
# SPM System 2.0 - Setup VPS (Oracle Cloud / Ubuntu 24.04)
# ==============================================================================
# Uso: sudo bash setup-vps.sh [--domain planifica-materiales.com] [--repo URL]
#
# Este script configura una instancia limpia de Ubuntu 24.04 para produccion:
#   1. Actualiza el sistema
#   2. Instala Docker + Docker Compose
#   3. Configura firewall (iptables para Oracle Cloud)
#   4. Crea usuario 'deploy' con acceso Docker
#   5. Clona el repositorio en /opt/spm
#   6. Genera secrets seguros automaticamente
#   7. Construye y levanta containers Docker
#   8. Ejecuta migraciones de BD
#   9. Configura SSL con certbot (Let's Encrypt)
# ==============================================================================

set -euo pipefail

# === Colores para output ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# === Valores por defecto ===
DOMAIN="planifica-materiales.com"
REPO_URL="https://github.com/manu-gt/SPMSystem2.0.git"
DEPLOY_PATH="/opt/spm"
DEPLOY_USER="deploy"
NODE_VERSION="20"

# === Parsear argumentos ===
while [[ $# -gt 0 ]]; do
  case $1 in
    --domain)  DOMAIN="$2"; shift 2 ;;
    --repo)    REPO_URL="$2"; shift 2 ;;
    --path)    DEPLOY_PATH="$2"; shift 2 ;;
    --user)    DEPLOY_USER="$2"; shift 2 ;;
    --help)
      echo "Uso: sudo bash setup-vps.sh [opciones]"
      echo "  --domain DOMAIN   Dominio (default: planifica-materiales.com)"
      echo "  --repo URL        URL del repositorio Git"
      echo "  --path PATH       Ruta de instalacion (default: /opt/spm)"
      echo "  --user USER       Usuario de deploy (default: deploy)"
      exit 0
      ;;
    *) log_error "Argumento desconocido: $1"; exit 1 ;;
  esac
done

# === Verificaciones iniciales ===
if [[ $EUID -ne 0 ]]; then
  log_error "Este script debe ejecutarse como root (sudo)"
  exit 1
fi

log_info "=============================================="
log_info " SPM System 2.0 - Setup VPS"
log_info "=============================================="
log_info "Dominio:  $DOMAIN"
log_info "Repo:     $REPO_URL"
log_info "Path:     $DEPLOY_PATH"
log_info "Usuario:  $DEPLOY_USER"
log_info "=============================================="
echo ""

# ======================================================================
# PASO 1: Actualizar sistema
# ======================================================================
log_info "=== Paso 1/9: Actualizando sistema ==="

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get upgrade -y
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  unzip \
  htop \
  nano \
  fail2ban \
  ufw \
  software-properties-common \
  apt-transport-https

log_ok "Sistema actualizado"

# ======================================================================
# PASO 2: Instalar Docker + Docker Compose
# ======================================================================
log_info "=== Paso 2/9: Instalando Docker ==="

# Remover versiones viejas
apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Agregar repositorio oficial de Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verificar instalacion
docker --version
docker compose version

# Habilitar Docker al inicio
systemctl enable docker
systemctl start docker

log_ok "Docker instalado y habilitado"

# ======================================================================
# PASO 3: Instalar Node.js (para build del frontend)
# ======================================================================
log_info "=== Paso 3/9: Instalando Node.js $NODE_VERSION ==="

curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

node --version
npm --version

log_ok "Node.js $NODE_VERSION instalado"

# ======================================================================
# PASO 4: Configurar firewall (iptables para Oracle Cloud)
# ======================================================================
log_info "=== Paso 4/9: Configurando firewall ==="

# Oracle Cloud usa iptables (no ufw por defecto)
# Asegurarnos de que los puertos necesarios estan abiertos

# Flush reglas existentes con cuidado (mantener Docker)
# Solo agregar reglas si no existen

# Permitir loopback
iptables -C INPUT -i lo -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -i lo -j ACCEPT

# Permitir conexiones establecidas
iptables -C INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || \
  iptables -I INPUT 2 -m state --state ESTABLISHED,RELATED -j ACCEPT

# SSH (puerto 22)
iptables -C INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || \
  iptables -I INPUT 3 -p tcp --dport 22 -j ACCEPT

# HTTP (puerto 80)
iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || \
  iptables -I INPUT 4 -p tcp --dport 80 -j ACCEPT

# HTTPS (puerto 443)
iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || \
  iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT

# Guardar reglas para que persistan tras reboot
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4

# Crear servicio systemd para restaurar iptables al boot
cat > /etc/systemd/system/iptables-restore.service << 'IPTABLES_SERVICE'
[Unit]
Description=Restore iptables rules
Before=docker.service
After=network-pre.target

[Service]
Type=oneshot
ExecStart=/sbin/iptables-restore /etc/iptables/rules.v4
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
IPTABLES_SERVICE

systemctl daemon-reload
systemctl enable iptables-restore.service

# Crear script helper para post-Docker iptables fix
cat > /usr/local/bin/fix-iptables.sh << 'FIX_IPTABLES'
#!/bin/bash
# Fix iptables despues de restart de Docker (Oracle Cloud)
iptables -I INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || true
echo "iptables rules restored for ports 22, 80, 443"
FIX_IPTABLES
chmod +x /usr/local/bin/fix-iptables.sh

# Configurar fail2ban para SSH
cat > /etc/fail2ban/jail.local << 'FAIL2BAN'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
FAIL2BAN

systemctl enable fail2ban
systemctl restart fail2ban

log_ok "Firewall configurado (puertos 22, 80, 443 abiertos)"

# ======================================================================
# PASO 5: Crear usuario deploy
# ======================================================================
log_info "=== Paso 5/9: Creando usuario $DEPLOY_USER ==="

if id "$DEPLOY_USER" &>/dev/null; then
  log_warn "Usuario $DEPLOY_USER ya existe, verificando grupos..."
else
  useradd -m -s /bin/bash "$DEPLOY_USER"
  log_info "Usuario $DEPLOY_USER creado"
fi

# Agregar a grupo docker
usermod -aG docker "$DEPLOY_USER"

# Dar permisos sudo sin password para operaciones de deploy
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /sbin/iptables, /sbin/iptables-save, /sbin/iptables-restore, /usr/local/bin/fix-iptables.sh, /usr/bin/systemctl restart docker, /usr/bin/chown" \
  > "/etc/sudoers.d/$DEPLOY_USER"
chmod 440 "/etc/sudoers.d/$DEPLOY_USER"

# Copiar authorized_keys del usuario actual (ubuntu) al deploy user
if [[ -f /home/ubuntu/.ssh/authorized_keys ]]; then
  mkdir -p "/home/$DEPLOY_USER/.ssh"
  cp /home/ubuntu/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  chmod 700 "/home/$DEPLOY_USER/.ssh"
  chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
  log_ok "Claves SSH copiadas de ubuntu a $DEPLOY_USER"
fi

log_ok "Usuario $DEPLOY_USER configurado con acceso Docker"

# ======================================================================
# PASO 6: Clonar repositorio
# ======================================================================
log_info "=== Paso 6/9: Clonando repositorio ==="

mkdir -p "$(dirname "$DEPLOY_PATH")"

if [[ -d "$DEPLOY_PATH/.git" ]]; then
  log_warn "Repositorio ya existe en $DEPLOY_PATH, actualizando..."
  cd "$DEPLOY_PATH"
  git fetch origin main
  git reset --hard origin/main
else
  git clone "$REPO_URL" "$DEPLOY_PATH"
fi

chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
cd "$DEPLOY_PATH"

log_ok "Repositorio clonado en $DEPLOY_PATH"

# ======================================================================
# PASO 7: Generar secrets y configurar .env
# ======================================================================
log_info "=== Paso 7/9: Generando secrets ==="

# Generar secrets seguros
POSTGRES_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

# Crear .env en la raiz del proyecto (para deploy workflow)
cat > "$DEPLOY_PATH/.env" << ENVFILE
# Generado automaticamente por setup-vps.sh el $(date -Iseconds)
POSTGRES_USER=spm
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=spm_production
SECRET_KEY=${SECRET_KEY}
JWT_SECRET_KEY=${JWT_SECRET_KEY}
GOOGLE_AI_API_KEY=
CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
FLASK_ENV=production
LOG_LEVEL=INFO
ENVFILE

# Crear infra/.env (usado por docker-compose.prod.yml)
cat > "$DEPLOY_PATH/infra/.env" << ENVFILE
# Generado automaticamente por setup-vps.sh el $(date -Iseconds)
POSTGRES_USER=spm
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=spm_production
SECRET_KEY=${SECRET_KEY}
JWT_SECRET_KEY=${JWT_SECRET_KEY}
GOOGLE_AI_API_KEY=
CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
ENVFILE

# Proteger archivos .env
chmod 600 "$DEPLOY_PATH/.env" "$DEPLOY_PATH/infra/.env"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH/.env" "$DEPLOY_PATH/infra/.env"

log_ok "Secrets generados y .env creado"
log_warn "POSTGRES_PASSWORD: $POSTGRES_PASSWORD"
log_warn "Guarda estos valores de forma segura. Actualizalos en GitHub Secrets."
echo ""
log_info "GitHub Secrets a configurar:"
echo "  gh secret set POSTGRES_PASSWORD --body \"$POSTGRES_PASSWORD\""
echo "  gh secret set SECRET_KEY --body \"$SECRET_KEY\""
echo "  gh secret set JWT_SECRET_KEY --body \"$JWT_SECRET_KEY\""
echo ""

# ======================================================================
# PASO 8: Build frontend + Docker containers
# ======================================================================
log_info "=== Paso 8/9: Construyendo frontend y containers Docker ==="

cd "$DEPLOY_PATH"

# Build frontend
log_info "Instalando dependencias del frontend..."
cd frontend
npm install --force
log_info "Construyendo frontend..."
VITE_API_URL="https://${DOMAIN}" npm run build
cd ..

log_ok "Frontend construido"

# Crear directorio de backups
mkdir -p "$DEPLOY_PATH/backups"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH/backups"

# Crear directorio para certbot challenges
mkdir -p /var/www/certbot

# Crear directorio letsencrypt (necesario para nginx antes de tener certificados)
mkdir -p /etc/letsencrypt/live/"$DOMAIN"

# Crear certificado SSL temporal (nginx no arranca sin uno)
log_info "Generando certificado SSL temporal..."
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "/etc/letsencrypt/live/$DOMAIN/privkey.pem" \
  -out "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" \
  -subj "/CN=$DOMAIN" 2>/dev/null

log_info "Construyendo containers Docker..."

# Guardar iptables antes de Docker (Oracle Cloud fix)
iptables-save > /tmp/iptables-pre-docker.rules

# Build y start containers
cd "$DEPLOY_PATH"
docker compose -f infra/docker-compose.prod.yml build
docker compose -f infra/docker-compose.prod.yml up -d

# Esperar a que containers arranquen
log_info "Esperando a que los containers arranquen (30s)..."
sleep 30

# Restaurar iptables si Docker las rompio
if ! iptables -L INPUT -n 2>/dev/null | grep -q "dpt:443"; then
  log_warn "Docker rompio iptables, restaurando..."
  iptables-restore < /tmp/iptables-pre-docker.rules 2>/dev/null || true
  /usr/local/bin/fix-iptables.sh
fi

# Verificar que containers estan corriendo
log_info "Estado de containers:"
docker compose -f infra/docker-compose.prod.yml ps

# Verificar health
RETRIES=10
for i in $(seq 1 $RETRIES); do
  if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
    log_ok "Backend respondiendo en puerto 5000"
    break
  fi
  if [[ $i -eq $RETRIES ]]; then
    log_warn "Backend no responde despues de $RETRIES intentos"
    log_info "Logs del backend:"
    docker logs spm-backend --tail 50 2>&1 || true
  fi
  log_info "Esperando backend... intento $i/$RETRIES"
  sleep 10
done

log_ok "Containers Docker levantados"

# ======================================================================
# PASO 9: Ejecutar migraciones
# ======================================================================
log_info "=== Paso 9/9: Ejecutando migraciones de BD ==="

# Esperar a que PostgreSQL este listo
for i in $(seq 1 10); do
  if docker exec spm-postgres pg_isready -U spm -d spm_production > /dev/null 2>&1; then
    log_ok "PostgreSQL listo"
    break
  fi
  log_info "Esperando PostgreSQL... intento $i/10"
  sleep 5
done

# Ejecutar migraciones idempotentes
docker exec spm-backend python backend/migrations/020_catalogs_to_postgresql.py 2>&1 || \
  log_warn "Migracion 020 fallida o ya aplicada"

docker exec spm-backend python backend/migrations/022_vertex_ia_tables.py 2>&1 || \
  log_warn "Migracion 022 fallida o ya aplicada"

log_ok "Migraciones ejecutadas"

# ======================================================================
# CONFIGURACION SSL (instrucciones)
# ======================================================================
echo ""
log_info "=============================================="
log_info " SETUP COMPLETADO"
log_info "=============================================="
echo ""
log_ok "Servidor configurado exitosamente"
echo ""
log_info "Proximos pasos:"
echo ""
echo "  1. Apuntar DNS de $DOMAIN a esta IP"
echo ""
echo "  2. Una vez que el DNS propague, obtener certificado SSL real:"
echo "     # Parar nginx temporalmente (certbot necesita puerto 80)"
echo "     docker compose -f $DEPLOY_PATH/infra/docker-compose.prod.yml stop nginx"
echo ""
echo "     # Instalar certbot y obtener certificado"
echo "     apt-get install -y certbot"
echo "     certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN --email admin@$DOMAIN --agree-tos --non-interactive"
echo ""
echo "     # Reiniciar nginx con certificado real"
echo "     docker compose -f $DEPLOY_PATH/infra/docker-compose.prod.yml start nginx"
echo ""
echo "  3. Configurar auto-renovacion de certificados:"
echo "     echo '0 3 * * * root certbot renew --pre-hook \"docker compose -f $DEPLOY_PATH/infra/docker-compose.prod.yml stop nginx\" --post-hook \"docker compose -f $DEPLOY_PATH/infra/docker-compose.prod.yml start nginx\"' > /etc/cron.d/certbot-renew"
echo ""
echo "  4. Actualizar GitHub Secrets:"
echo "     gh secret set SERVER_IP --body \"\$(curl -s ifconfig.me)\""
echo "     gh secret set SERVER_USER --body \"$DEPLOY_USER\""
echo "     gh secret set POSTGRES_PASSWORD --body \"$POSTGRES_PASSWORD\""
echo "     gh secret set SECRET_KEY --body \"$SECRET_KEY\""
echo "     gh secret set JWT_SECRET_KEY --body \"$JWT_SECRET_KEY\""
echo "     gh secret set SSH_PRIVATE_KEY < /ruta/a/tu/clave_privada"
echo ""
echo "  5. Verificar que todo funciona:"
echo "     curl -k https://localhost/api/health"
echo "     docker compose -f $DEPLOY_PATH/infra/docker-compose.prod.yml ps"
echo "     docker logs spm-backend --tail 20"
echo ""
log_info "=============================================="
