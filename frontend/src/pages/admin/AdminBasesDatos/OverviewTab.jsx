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
import { formatSize } from "./useAdminDatabase";

export function OverviewTab({
  loading,
  databases,
  poolStats,
  onRefresh,
}) {
  const { t } = useI18n();

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
              <Grid item xs={12} sm={6} lg={6} key={db.name}>
                <Paper
                  variant="outlined"
                  sx={{
                    overflow: 'hidden',
                    transition: 'border-color 0.2s',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  {/* Card Header */}
                  <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <StorageIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                        <Typography variant="body2" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {db.name}
                        </Typography>
                      </Stack>
                      <Chip
                        label={db.status}
                        size="small"
                        color={db.status === "online" ? "success" : "error"}
                        sx={{ height: 20, fontSize: '0.625rem', fontWeight: 700 }}
                      />
                    </Stack>
                  </Box>

                  {/* Card Content */}
                  <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {[
                      { label: 'Tipo', value: db.type },
                      { label: 'Tablas', value: db.tables },
                      { label: 'Registros', value: db.records?.toLocaleString() || "0" },
                      { label: 'Latencia', value: `${db.latency_ms} ms` },
                    ].map(({ label, value }) => (
                      <Stack key={label} direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          {label}
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {value}
                        </Typography>
                      </Stack>
                    ))}

                    {/* Size bar */}
                    <Box sx={{ mt: 0.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          Tamano
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'primary.main' }}>
                          {formatSize(db.size_mb)}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          height: 4,
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
              <Typography variant="body2" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t("db_pool_stats", "Pool de Conexiones")}
              </Typography>
            </Stack>
          </Box>

          <Box sx={{ p: 2 }}>
            <Grid container spacing={2}>
              {Object.entries(poolStats).map(([name, stats]) => (
                <Grid item xs={12} md={4} key={name}>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'grey.50',
                      border: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
                      {name}
                    </Typography>
                    <Stack spacing={0.5}>
                      {[
                        { label: 'Creadas', value: stats.created || 0, color: 'success.main' },
                        { label: 'Reutilizadas', value: stats.reused || 0, color: 'info.main' },
                        { label: 'Expiradas', value: stats.expired || 0, color: 'warning.main' },
                        { label: 'Errores', value: stats.errors || 0, color: stats.errors > 0 ? 'error.main' : 'text.secondary' },
                      ].map(({ label, value, color }) => (
                        <Stack key={label} direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            {label}
                          </Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, color }}>
                            {value}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
