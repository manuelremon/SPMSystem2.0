#!/bin/bash
#
# backup-postgres.sh - Backup automatico de PostgreSQL para SPM v2.0
#
# Uso:
#   ./scripts/backup-postgres.sh
#
# Cron (cada dia a las 3AM):
#   0 3 * * * /home/ubuntu/SPMv2.0/scripts/backup-postgres.sh >> /var/log/spm-backup.log 2>&1
#
# Variables de entorno requeridas:
#   POSTGRES_USER - Usuario de PostgreSQL (default: spm)
#   POSTGRES_DB - Nombre de la BD (default: spm_production)
#   BACKUP_DIR - Directorio de backups (default: /home/ubuntu/backups)
#   BACKUP_RETENTION_DAYS - Dias a mantener backups (default: 7)
#

set -e

# Configuracion
POSTGRES_USER="${POSTGRES_USER:-spm}"
POSTGRES_DB="${POSTGRES_DB:-spm_production}"
BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="spm_backup_${DATE}.sql.gz"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Crear directorio de backups si no existe
mkdir -p "${BACKUP_DIR}"

log_info "Iniciando backup de PostgreSQL..."
log_info "Base de datos: ${POSTGRES_DB}"
log_info "Directorio: ${BACKUP_DIR}"

# Verificar que el contenedor de PostgreSQL esta corriendo
if ! docker ps | grep -q spm-postgres; then
    log_error "El contenedor spm-postgres no esta corriendo"
    exit 1
fi

# Crear backup comprimido
log_info "Creando backup: ${FILENAME}"
if docker exec spm-postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${BACKUP_DIR}/${FILENAME}"; then
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
    log_info "Backup creado exitosamente: ${FILENAME} (${BACKUP_SIZE})"
else
    log_error "Error al crear backup"
    exit 1
fi

# Verificar integridad del backup
if ! gunzip -t "${BACKUP_DIR}/${FILENAME}" 2>/dev/null; then
    log_error "El archivo de backup esta corrupto"
    rm -f "${BACKUP_DIR}/${FILENAME}"
    exit 1
fi
log_info "Integridad verificada OK"

# Limpiar backups antiguos
log_info "Limpiando backups con mas de ${BACKUP_RETENTION_DAYS} dias..."
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "spm_backup_*.sql.gz" -mtime +${BACKUP_RETENTION_DAYS} -delete -print | wc -l)
if [ "${DELETED_COUNT}" -gt 0 ]; then
    log_info "Se eliminaron ${DELETED_COUNT} backup(s) antiguos"
else
    log_info "No hay backups antiguos para eliminar"
fi

# Mostrar backups actuales
log_info "Backups actuales:"
ls -lh "${BACKUP_DIR}"/spm_backup_*.sql.gz 2>/dev/null | tail -5 || log_warn "No hay backups en el directorio"

# Calcular espacio usado
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
log_info "Espacio total usado en backups: ${TOTAL_SIZE}"

log_info "Backup completado exitosamente"
