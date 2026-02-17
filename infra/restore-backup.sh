#!/usr/bin/env bash
# ==============================================================================
# SPM System 2.0 - Restaurar Backup de PostgreSQL
# ==============================================================================
# Uso:
#   sudo bash restore-backup.sh <archivo.dump>
#   sudo bash restore-backup.sh /opt/spm/backups/spm_pg_20260217_120000.dump
#   sudo bash restore-backup.sh --from-remote <user>@<old-ip> <remote-path>
#
# Este script restaura un backup de PostgreSQL (formato custom de pg_dump)
# en el container spm-postgres de la instancia actual.
#
# Escenarios:
#   1. Tienes el archivo .dump localmente
#   2. Tienes acceso SSH a la instancia vieja y quieres copiar + restaurar
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

DEPLOY_PATH="/opt/spm"
POSTGRES_CONTAINER="spm-postgres"
POSTGRES_USER="spm"
POSTGRES_DB="spm_production"

usage() {
  echo "Uso:"
  echo "  $0 <archivo.dump>                              Restaurar desde archivo local"
  echo "  $0 --from-remote <user@host> <ruta-remota>     Copiar desde servidor viejo y restaurar"
  echo "  $0 --list                                      Listar backups disponibles localmente"
  echo ""
  echo "Ejemplos:"
  echo "  $0 /opt/spm/backups/spm_pg_20260217_120000.dump"
  echo "  $0 --from-remote ubuntu@<SERVER_IP> /opt/spm/backups/"
  echo "  $0 --list"
}

# === Listar backups disponibles ===
list_backups() {
  log_info "Backups disponibles en $DEPLOY_PATH/backups/:"
  echo ""
  if ls -la "$DEPLOY_PATH/backups"/spm_pg_*.dump 2>/dev/null; then
    echo ""
    log_info "Usa: $0 <ruta-al-archivo.dump> para restaurar"
  else
    log_warn "No se encontraron backups de PostgreSQL"
  fi
}

# === Verificar que PostgreSQL esta corriendo ===
check_postgres() {
  if ! docker exec "$POSTGRES_CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; then
    log_error "PostgreSQL no esta corriendo. Levanta los containers primero:"
    echo "  cd $DEPLOY_PATH && docker compose -f infra/docker-compose.prod.yml up -d postgres"
    exit 1
  fi
  log_ok "PostgreSQL esta corriendo"
}

# === Crear backup pre-restauracion ===
pre_restore_backup() {
  local timestamp
  timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_file="$DEPLOY_PATH/backups/spm_pg_pre_restore_$timestamp.dump"

  log_info "Creando backup pre-restauracion..."
  mkdir -p "$DEPLOY_PATH/backups"

  docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --format=custom --compress=6 \
    -f /tmp/pre_restore_backup.dump 2>/dev/null && \
  docker cp "$POSTGRES_CONTAINER:/tmp/pre_restore_backup.dump" "$backup_file" && \
  docker exec "$POSTGRES_CONTAINER" rm -f /tmp/pre_restore_backup.dump && \
  log_ok "Backup pre-restauracion guardado en: $backup_file" || \
  log_warn "No se pudo crear backup pre-restauracion (BD posiblemente vacia)"
}

# === Restaurar desde archivo local ===
restore_from_file() {
  local dump_file="$1"

  if [[ ! -f "$dump_file" ]]; then
    log_error "Archivo no encontrado: $dump_file"
    exit 1
  fi

  local file_size
  file_size=$(du -h "$dump_file" | cut -f1)
  log_info "Archivo de backup: $dump_file ($file_size)"

  # Verificar que es un archivo pg_dump valido
  if ! file "$dump_file" | grep -qi "PostgreSQL\|data"; then
    log_warn "El archivo podria no ser un dump valido de PostgreSQL"
    read -p "Continuar de todas formas? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi

  check_postgres
  pre_restore_backup

  log_info "Copiando dump al container..."
  docker cp "$dump_file" "$POSTGRES_CONTAINER:/tmp/restore.dump"

  log_info "Restaurando base de datos (esto puede tomar varios minutos)..."
  log_warn "Las conexiones activas seran terminadas durante la restauracion"

  # Terminar conexiones activas antes de restaurar
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();" \
    2>/dev/null || true

  # Restaurar (--clean elimina objetos existentes, --if-exists evita errores)
  if docker exec "$POSTGRES_CONTAINER" pg_restore \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --verbose \
    /tmp/restore.dump 2>&1; then
    log_ok "Restauracion completada exitosamente"
  else
    # pg_restore retorna codigo != 0 incluso con warnings no-fatales
    log_warn "pg_restore termino con warnings (esto es normal si algunas tablas no existian)"
    log_info "Verificando integridad..."
  fi

  # Limpiar archivo temporal
  docker exec "$POSTGRES_CONTAINER" rm -f /tmp/restore.dump

  # Verificar restauracion
  log_info "Verificando restauracion..."
  local table_count
  table_count=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

  local user_count
  user_count=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
    "SELECT count(*) FROM usuarios;" 2>/dev/null | tr -d ' ' || echo "0")

  echo ""
  log_ok "Base de datos restaurada:"
  echo "  - Tablas: $table_count"
  echo "  - Usuarios: $user_count"
  echo ""

  # Reiniciar backend para que tome las nuevas conexiones
  log_info "Reiniciando backend..."
  docker restart spm-backend 2>/dev/null || true
  sleep 10

  # Health check
  if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
    log_ok "Backend respondiendo correctamente tras restauracion"
  else
    log_warn "Backend no responde. Revisa los logs:"
    echo "  docker logs spm-backend --tail 30"
  fi
}

# === Copiar backup desde servidor remoto y restaurar ===
restore_from_remote() {
  local remote_host="$1"
  local remote_path="$2"

  log_info "Buscando backups en $remote_host:$remote_path..."

  # Si remote_path es un directorio, listar y usar el mas reciente
  if ssh -o ConnectTimeout=10 "$remote_host" "test -d '$remote_path'" 2>/dev/null; then
    log_info "Listando backups disponibles en el servidor remoto:"
    ssh "$remote_host" "ls -lh ${remote_path}/spm_pg_*.dump 2>/dev/null" || {
      log_error "No se encontraron backups en $remote_path"
      exit 1
    }

    # Obtener el mas reciente
    local latest_remote
    latest_remote=$(ssh "$remote_host" "ls -t ${remote_path}/spm_pg_*.dump 2>/dev/null | head -1")

    if [[ -z "$latest_remote" ]]; then
      log_error "No se encontraron archivos .dump"
      exit 1
    fi

    log_info "Backup mas reciente: $latest_remote"
    remote_path="$latest_remote"
  fi

  # Copiar archivo
  local local_file="$DEPLOY_PATH/backups/$(basename "$remote_path")"
  log_info "Copiando backup desde servidor remoto..."
  scp -o ConnectTimeout=10 "$remote_host:$remote_path" "$local_file"

  if [[ ! -f "$local_file" ]]; then
    log_error "No se pudo copiar el archivo"
    exit 1
  fi

  log_ok "Archivo copiado a: $local_file"

  # Restaurar
  restore_from_file "$local_file"
}

# === Main ===
if [[ $# -eq 0 ]]; then
  usage
  exit 1
fi

case "$1" in
  --list)
    list_backups
    ;;
  --from-remote)
    if [[ $# -lt 3 ]]; then
      log_error "Faltan argumentos: --from-remote <user@host> <ruta-remota>"
      usage
      exit 1
    fi
    restore_from_remote "$2" "$3"
    ;;
  --help|-h)
    usage
    ;;
  *)
    restore_from_file "$1"
    ;;
esac
