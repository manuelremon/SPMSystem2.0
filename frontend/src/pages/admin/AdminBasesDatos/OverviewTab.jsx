/**
 * OverviewTab - Vista general de bases de datos
 */

import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Grid,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import StorageIcon from '@mui/icons-material/Storage';
import DnsIcon from '@mui/icons-material/Dns';
import { useI18n } from "../../../context/i18n";
import { formatNumber } from "../../../utils/formatters";
import { formatSize } from "./useAdminDatabase";

const DB_TYPE_LABELS = {
  sqlite: "SQLite",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
};

function InfoRow({ label, value, valueColor = "text.primary" }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
      <Typography variant="caption" color="text.secondary" fontWeight={500}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 600, color: valueColor, textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}

export function OverviewTab({
  loading,
  databases,
  poolStats,
  onRefresh,
}) {
  const { t } = useI18n();

  const statusLabel = (status) =>
    status === "online" ? t("db_status_en_linea", "En línea") : t("db_status_sin_conexion", "Sin conexión");

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Refresh Button */}
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="outlined"
          size="small"
          startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={onRefresh}
          disabled={loading}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {t("common_actualizar", "Actualizar")}
        </Button>
      </Stack>

      {/* Database Cards */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {databases.map((db) => {
            const maxSize = Math.max(...databases.map(d => d.size_mb || 1), 1);
            const pct = ((db.size_mb || 0) / maxSize) * 100;
            return (
              <Grid key={db.name} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    overflow: 'hidden',
                    height: '100%',
                    transition: 'border-color 0.2s',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  {/* Card Header */}
                  <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                        <StorageIcon sx={{ fontSize: 18, color: 'primary.main', flexShrink: 0 }} />
                        <Typography variant="body2" fontWeight={700} noWrap title={db.name}>
                          {db.name}
                        </Typography>
                      </Stack>
                      <Chip
                        label={statusLabel(db.status)}
                        size="small"
                        color={db.status === "online" ? "success" : "error"}
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.6875rem', fontWeight: 600, flexShrink: 0 }}
                      />
                    </Stack>
                  </Box>

                  {/* Card Content */}
                  <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <InfoRow
                      label={t("db_label_tipo", "Tipo")}
                      value={DB_TYPE_LABELS[(db.type || "").toLowerCase()] || db.type || "—"}
                    />
                    <InfoRow label={t("db_label_tablas", "Tablas")} value={formatNumber(db.tables || 0)} />
                    <InfoRow label={t("db_label_registros", "Registros")} value={formatNumber(db.records || 0)} />
                    <InfoRow
                      label={t("db_label_latencia", "Latencia")}
                      value={db.latency_ms != null ? `${formatNumber(db.latency_ms)} ms` : "—"}
                    />

                    {/* Size bar */}
                    <Box sx={{ mt: 0.5 }}>
                      <Box sx={{ mb: 0.5 }}>
                        <InfoRow
                          label={t("db_label_tamano", "Tamaño")}
                          value={formatSize(db.size_mb || 0)}
                          valueColor="primary.main"
                        />
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          height: 4,
                          borderRadius: 2,
                          bgcolor: 'grey.100',
                        }}
                      />
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Pool Stats */}
      {poolStats && Object.keys(poolStats).length > 0 && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <DnsIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="body2" fontWeight={700}>
                {t("db_pool_stats", "Pool de conexiones")}
              </Typography>
            </Stack>
          </Box>

          <Box sx={{ p: 2 }}>
            <Grid container spacing={2}>
              {Object.entries(poolStats).map(([name, stats]) => (
                <Grid key={name} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                      {name}
                    </Typography>
                    <Stack spacing={0.75}>
                      <InfoRow label={t("db_pool_creadas", "Creadas")} value={formatNumber(stats.created || 0)} />
                      <InfoRow label={t("db_pool_reutilizadas", "Reutilizadas")} value={formatNumber(stats.reused || 0)} />
                      <InfoRow label={t("db_pool_expiradas", "Expiradas")} value={formatNumber(stats.expired || 0)} />
                      <InfoRow
                        label={t("db_pool_errores", "Errores")}
                        value={formatNumber(stats.errors || 0)}
                        valueColor={stats.errors > 0 ? 'error.main' : 'text.primary'}
                      />
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
