#!/bin/bash
# =============================================================================
# SPM v2.0 - Script de Deployment Completo (Desde Local)
# Automatiza: Git commit/push -> SSH al servidor Oracle -> Docker rebuild
# =============================================================================
# USO: ./scripts/deploy-full.sh [opciones]
#
# PREREQUISITOS:
#   1. Clave SSH configurada en ~/.ssh/oracle_vps.key
#   2. Acceso SSH al servidor Oracle
#
# PRIMERA VEZ:
#   cp "docs/ssh-key-2025-12-19 (3).key" ~/.ssh/oracle_vps.key
#   chmod 600 ~/.ssh/oracle_vps.key
# =============================================================================

set -e

# ============================================================================
# CONFIGURACION
# ============================================================================
SERVER_IP="<SERVER_IP>"
SERVER_USER="ubuntu"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oracle_vps.key}"
REMOTE_DIR="/home/ubuntu/SPMv2.0"
GITHUB_REPO="https://github.com/manuelremon/SPMSystem2.0.git"
DOMAIN="planifica-materiales.com"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================
print_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}${BOLD}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

print_step() {
    echo -e "${YELLOW}[$1] $2${NC}"
}

print_success() {
    echo -e "${GREEN}    ✓ $1${NC}"
}

print_error() {
    echo -e "${RED}    ✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}    → $1${NC}"
}

# SSH command wrapper
ssh_exec() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=30 "$SERVER_USER@$SERVER_IP" "$@"
}

# ============================================================================
# VERIFICACIONES INICIALES
# ============================================================================
check_prerequisites() {
    print_header "VERIFICANDO PREREQUISITOS"

    # Git
    if ! command -v git &> /dev/null; then
        print_error "Git no esta instalado"
        exit 1
    fi
    print_success "Git OK"

    # SSH key
    if [ ! -f "$SSH_KEY" ]; then
        print_error "Clave SSH no encontrada: $SSH_KEY"
        echo ""
        echo -e "${YELLOW}Para configurar la clave SSH:${NC}"
        echo ""
        echo "  cp \"docs/ssh-key-2025-12-19 (3).key\" ~/.ssh/oracle_vps.key"
        echo "  chmod 600 ~/.ssh/oracle_vps.key"
        echo ""
        echo "O especifica otra ruta con:"
        echo "  SSH_KEY=/ruta/a/clave ./scripts/deploy-full.sh"
        exit 1
    fi

    # Verificar permisos de la clave SSH
    KEY_PERMS=$(stat -c "%a" "$SSH_KEY" 2>/dev/null || stat -f "%OLp" "$SSH_KEY" 2>/dev/null)
    if [ "$KEY_PERMS" != "600" ] && [ "$KEY_PERMS" != "400" ]; then
        print_info "Corrigiendo permisos de clave SSH..."
        chmod 600 "$SSH_KEY"
    fi
    print_success "Clave SSH OK"

    # Conexion SSH
    print_info "Probando conexion SSH a $SERVER_IP..."
    if ssh_exec "echo 'OK'" &>/dev/null; then
        print_success "Conexion SSH OK"
    else
        print_error "No se puede conectar al servidor $SERVER_IP"
        echo ""
        echo "Verifica:"
        echo "  - IP: $SERVER_IP"
        echo "  - Usuario: $SERVER_USER"
        echo "  - Clave: $SSH_KEY"
        exit 1
    fi
}

# ============================================================================
# GIT: COMMIT Y PUSH
# ============================================================================
git_operations() {
    print_header "GIT: COMMIT Y PUSH"

    # Ir al directorio del proyecto
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR/.."
    PROJECT_DIR="$(pwd)"

    # Verificar rama
    CURRENT_BRANCH=$(git branch --show-current)
    print_info "Rama actual: $CURRENT_BRANCH"

    # Verificar si hay cambios
    if git diff --quiet HEAD 2>/dev/null && git diff --staged --quiet 2>/dev/null; then
        print_info "No hay cambios locales para commit"
    else
        # Mostrar cambios
        print_step "1/3" "Cambios detectados:"
        git status --short
        echo ""

        # Mensaje de commit
        if [ -z "$COMMIT_MSG" ]; then
            echo -ne "${YELLOW}Mensaje de commit (Enter para auto): ${NC}"
            read COMMIT_MSG
            COMMIT_MSG=${COMMIT_MSG:-"deploy: actualizacion $(date '+%Y-%m-%d %H:%M')"}
        fi

        # Add y commit
        print_step "2/3" "Haciendo commit..."
        git add -A
        git commit -m "$COMMIT_MSG

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>" || true
        print_success "Commit OK"
    fi

    # Push
    print_step "3/3" "Pushing a GitHub..."
    if git push origin "$CURRENT_BRANCH" 2>&1; then
        print_success "Push OK"
    else
        print_error "Error en push"
        exit 1
    fi
}

# ============================================================================
# SERVIDOR: PULL Y REBUILD
# ============================================================================
server_deploy() {
    print_header "SERVIDOR: DEPLOY EN $SERVER_IP"

    # Verificar si el directorio existe, si no, clonar
    print_step "1/9" "Verificando repositorio en servidor..."
    if ! ssh_exec "test -d $REMOTE_DIR"; then
        print_info "Clonando repositorio por primera vez..."
        ssh_exec "git clone $GITHUB_REPO $REMOTE_DIR"
        print_success "Repositorio clonado"
    else
        print_success "Repositorio existe"
    fi

    print_step "2/9" "Actualizando codigo (git pull)..."
    ssh_exec "cd $REMOTE_DIR && git fetch origin && git reset --hard origin/main"
    print_success "Codigo actualizado"

    print_step "3/9" "Verificando Node.js..."
    if ! ssh_exec "command -v node" &>/dev/null; then
        print_info "Instalando Node.js..."
        ssh_exec "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    fi
    print_success "Node.js OK"

    print_step "4/9" "Instalando dependencias frontend..."
    ssh_exec "cd $REMOTE_DIR/frontend && npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps"
    print_success "Dependencias instaladas"

    print_step "5/9" "Construyendo frontend (React/Vite)..."
    ssh_exec "cd $REMOTE_DIR/frontend && npm run build"
    print_success "Frontend build OK"

    print_step "6/9" "Reconstruyendo contenedores Docker..."
    ssh_exec "cd $REMOTE_DIR/infra && docker-compose -f docker-compose.prod.yml --env-file .env.production build"
    print_success "Docker build OK"

    print_step "7/9" "Reiniciando servicios..."
    ssh_exec "cd $REMOTE_DIR/infra && docker-compose -f docker-compose.prod.yml --env-file .env.production down 2>/dev/null || true"
    ssh_exec "cd $REMOTE_DIR/infra && docker-compose -f docker-compose.prod.yml --env-file .env.production up -d"
    print_success "Servicios reiniciados"

    print_step "8/9" "Ejecutando migraciones de base de datos..."
    # Esperar que PostgreSQL este listo
    sleep 5
    # Ejecutar todas las migraciones SQL en orden
    ssh_exec "cd $REMOTE_DIR && for f in infra/migrations/*.sql; do [ -f \"\$f\" ] && docker exec -i spm-postgres psql -U \${POSTGRES_USER:-spm} -d \${POSTGRES_DB:-spm_production} < \"\$f\" 2>/dev/null || true; done"
    print_success "Migraciones ejecutadas"

    print_step "9/9" "Limpiando cache de nginx..."
    ssh_exec "docker exec spm-nginx nginx -s reload 2>/dev/null || true"
    print_success "Cache de nginx limpiado"
}

# ============================================================================
# VERIFICACION POST-DEPLOY
# ============================================================================
verify_deployment() {
    print_header "VERIFICANDO DEPLOYMENT"

    print_step "1/2" "Esperando que los servicios inicien (15s)..."
    sleep 15

    print_step "2/2" "Health check..."
    MAX_RETRIES=12
    RETRY_COUNT=0

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        # Intentar con HTTPS primero, luego HTTP
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$DOMAIN/api/health" 2>/dev/null || \
                    curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://$SERVER_IP/api/health" 2>/dev/null || \
                    echo "000")

        if [ "$HTTP_CODE" = "200" ]; then
            print_success "Health check OK (HTTP $HTTP_CODE)"
            return 0
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        print_info "Intento $RETRY_COUNT/$MAX_RETRIES (HTTP $HTTP_CODE)..."
        sleep 5
    done

    print_error "Health check fallo despues de $MAX_RETRIES intentos"
    echo ""
    echo -e "${YELLOW}Revisa los logs:${NC}"
    echo "  ./scripts/deploy-full.sh --logs"
    echo ""
    echo "O conectate al servidor:"
    echo "  ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP"
    echo "  cd $REMOTE_DIR/infra && docker compose -f docker-compose.prod.yml logs backend"
    return 1
}

# ============================================================================
# MOSTRAR RESUMEN FINAL
# ============================================================================
show_summary() {
    print_header "DEPLOYMENT COMPLETADO EXITOSAMENTE"
    echo ""
    echo -e "${GREEN}URLs:${NC}"
    echo "  - Frontend: https://$DOMAIN"
    echo "  - API:      https://$DOMAIN/api/health"
    echo "  - IP:       http://$SERVER_IP"
    echo ""
    echo -e "${GREEN}Comandos utiles:${NC}"
    echo "  Ver logs:     ./scripts/deploy-full.sh --logs"
    echo "  Estado:       ./scripts/deploy-full.sh --status"
    echo "  Conectar:     ./scripts/deploy-full.sh --ssh"
    echo "  Clear cache:  ./scripts/deploy-full.sh --clear-cache"
    echo ""
    echo -e "${YELLOW}Para limpiar cache del navegador (Service Worker):${NC}"
    echo "  1. Abre DevTools (F12) -> Application -> Service Workers"
    echo "  2. Marca 'Update on reload' y recarga la pagina"
    echo "  3. O haz click en 'Unregister' y recarga"
    echo ""
}

# ============================================================================
# COMANDOS AUXILIARES
# ============================================================================
show_status() {
    print_header "ESTADO DEL SERVIDOR"
    ssh_exec "cd $REMOTE_DIR/infra && docker-compose -f docker-compose.prod.yml ps"
}

show_logs() {
    echo -e "${CYAN}Mostrando logs (Ctrl+C para salir)...${NC}"
    ssh_exec "cd $REMOTE_DIR/infra && docker-compose -f docker-compose.prod.yml logs -f --tail=100"
}

connect_ssh() {
    echo -e "${CYAN}Conectando al servidor...${NC}"
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP"
}

restart_services() {
    print_header "REINICIANDO SERVICIOS"
    ssh_exec "cd $REMOTE_DIR/infra && docker-compose -f docker-compose.prod.yml restart"
    print_success "Servicios reiniciados"
    sleep 10
    verify_deployment
}

clear_cache() {
    print_header "LIMPIANDO CACHE"

    print_step "1/3" "Recargando configuracion nginx..."
    ssh_exec "docker exec spm-nginx nginx -s reload"
    print_success "Nginx recargado"

    print_step "2/3" "Verificando version de Service Worker..."
    SW_VERSION=$(curl -s "https://$DOMAIN/sw.js" | grep "SW_VERSION" | head -1 | grep -oP "'[^']+'" | tr -d "'")
    print_success "SW Version: $SW_VERSION"

    print_step "3/3" "Verificando headers de cache..."
    CACHE_HEADERS=$(curl -sI "https://$DOMAIN/sw.js" | grep -i "cache-control")
    if echo "$CACHE_HEADERS" | grep -qi "no-cache\|no-store"; then
        print_success "Headers anti-cache OK"
    else
        print_error "Headers de cache incorrectos: $CACHE_HEADERS"
    fi

    echo ""
    echo -e "${YELLOW}Para forzar actualizacion en el navegador:${NC}"
    echo "  1. Abre DevTools (F12) -> Application -> Service Workers"
    echo "  2. Click en 'Update' junto al Service Worker"
    echo "  3. O marca 'Update on reload' y recarga (F5)"
    echo "  4. Alternativa: 'Unregister' y recargar la pagina"
    echo ""
}

# ============================================================================
# MAIN
# ============================================================================
main() {
    print_header "SPM v2.0 - DEPLOYMENT AUTOMATICO"
    echo -e "Servidor: ${BOLD}$SERVER_USER@$SERVER_IP${NC}"
    echo -e "Dominio:  ${BOLD}https://$DOMAIN${NC}"
    echo ""

    check_prerequisites
    git_operations
    server_deploy
    if verify_deployment; then
        show_summary
    fi
}

# ============================================================================
# OPCIONES DE LINEA DE COMANDOS
# ============================================================================
show_help() {
    echo -e "${BOLD}SPM v2.0 - Script de Deployment Completo${NC}"
    echo ""
    echo "USO: $0 [opcion]"
    echo ""
    echo "OPCIONES:"
    echo "  (sin opcion)     Deploy completo: git push + servidor + verificacion"
    echo "  --skip-git       Solo deploy en servidor (sin commit/push)"
    echo "  --git-only       Solo git commit y push (sin deploy)"
    echo "  --status         Ver estado de contenedores"
    echo "  --logs           Ver logs en tiempo real"
    echo "  --ssh            Conectar al servidor via SSH"
    echo "  --restart        Reiniciar servicios sin rebuild"
    echo "  --clear-cache    Limpiar cache de nginx y verificar Service Worker"
    echo "  --help, -h       Mostrar esta ayuda"
    echo ""
    echo "VARIABLES DE ENTORNO:"
    echo "  SSH_KEY          Ruta a la clave SSH (default: ~/.ssh/oracle_vps.key)"
    echo "  COMMIT_MSG       Mensaje de commit (evita prompt interactivo)"
    echo ""
    echo "EJEMPLOS:"
    echo "  ./scripts/deploy-full.sh                                # Deploy completo"
    echo "  COMMIT_MSG='fix: bug critico' ./scripts/deploy-full.sh  # Con mensaje"
    echo "  ./scripts/deploy-full.sh --skip-git                     # Solo servidor"
    echo "  ./scripts/deploy-full.sh --logs                         # Ver logs"
    echo ""
    echo "PRIMERA VEZ (configurar clave SSH):"
    echo "  cp \"docs/ssh-key-2025-12-19 (3).key\" ~/.ssh/oracle_vps.key"
    echo "  chmod 600 ~/.ssh/oracle_vps.key"
    echo ""
}

case "${1:-}" in
    --skip-git)
        check_prerequisites
        server_deploy
        verify_deployment && show_summary
        ;;
    --git-only)
        git_operations
        ;;
    --status)
        check_prerequisites
        show_status
        ;;
    --logs)
        check_prerequisites
        show_logs
        ;;
    --ssh)
        check_prerequisites
        connect_ssh
        ;;
    --restart)
        check_prerequisites
        restart_services
        ;;
    --clear-cache)
        check_prerequisites
        clear_cache
        ;;
    --help|-h)
        show_help
        ;;
    "")
        main
        ;;
    *)
        echo -e "${RED}Opcion desconocida: $1${NC}"
        echo "Usa --help para ver las opciones disponibles"
        exit 1
        ;;
esac
