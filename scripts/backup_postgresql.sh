#!/bin/bash
# =============================================================================
# SPM PostgreSQL Daily Backup Script
# =============================================================================
# Cron: 0 3 * * * /opt/spm/scripts/backup_postgresql.sh >> /var/log/spm_backup.log 2>&1
#
# Features:
# - pg_dump with custom format (compressed)
# - 7-day retention policy
# - Logs to stdout for cron capture
# =============================================================================

set -euo pipefail

BACKUP_DIR="/opt/spm/backups/daily"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting PostgreSQL backup..."

# Check if PostgreSQL container is running
if ! docker exec spm-postgres pg_isready -U spm -d spm_production > /dev/null 2>&1; then
    echo "[$(date)] ERROR: PostgreSQL container not running or not ready"
    exit 1
fi

# Perform backup
DUMP_FILE="$BACKUP_DIR/spm_pg_$TIMESTAMP.dump"

docker exec spm-postgres pg_dump -U spm -d spm_production \
    --format=custom --compress=6 \
    -f /tmp/spm_daily_backup.dump && \
docker cp spm-postgres:/tmp/spm_daily_backup.dump "$DUMP_FILE" && \
docker exec spm-postgres rm -f /tmp/spm_daily_backup.dump

if [ -f "$DUMP_FILE" ]; then
    SIZE=$(du -h "$DUMP_FILE" | cut -f1)
    echo "[$(date)] Backup completed: $DUMP_FILE ($SIZE)"
else
    echo "[$(date)] ERROR: Backup file not created"
    exit 1
fi

# Cleanup old backups (older than RETENTION_DAYS)
DELETED=$(find "$BACKUP_DIR" -name "spm_pg_*.dump" -mtime +$RETENTION_DAYS -delete -print | wc -l)
echo "[$(date)] Cleaned up $DELETED old backups (>${RETENTION_DAYS} days)"

echo "[$(date)] Backup process completed successfully"
