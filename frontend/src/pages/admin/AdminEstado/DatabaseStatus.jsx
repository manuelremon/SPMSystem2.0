/**
 * DatabaseStatus - Panel de estadisticas de bases de datos
 * Enterprise Design - MUI Components
 *
 * Muestra conteo de registros y tamano de cada BD
 */

import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Grid,
  Tooltip,
} from "@mui/material";

// MUI Icons
import StorageIcon from "@mui/icons-material/Storage";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

import { useI18n } from '../../../context/i18n'
import { formatNumber } from '../../../utils/formatters'

const DB_LABELS = {
  master_materiales: 'Maestro de materiales',
  sap_data: 'Datos SAP',
  spm: 'SPM',
}

function dbLabel(name) {
  return DB_LABELS[name] || name.replace(/_/g, ' ')
}

/**
 * Tarjeta individual de base de datos
 */
function DatabaseCard({ name, info }) {
  const { t } = useI18n()

  if (info?.error) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              fontSize: '0.8125rem',
            }}
          >
            {dbLabel(name)}
          </Typography>
          <Chip label={t('common_error', 'Error')} color="error" size="small" />
        </Stack>
        <Typography variant="body2" color="error.main">
          {info.error}
        </Typography>
      </Paper>
    );
  }

  if (!info?.counts) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              fontSize: '0.8125rem',
            }}
          >
            {dbLabel(name)}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t('no_data', 'Sin datos')}
        </Typography>
      </Paper>
    );
  }

  const values = Object.values(info.counts)
  const validValues = values.filter((c) => typeof c === 'number' && c >= 0)
  const failedCount = values.length - validValues.length
  const validCount = validValues.length
  const subtotal = validValues.reduce((sum, c) => sum + c, 0)

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: '100%',
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            fontSize: '0.8125rem',
          }}
        >
          {dbLabel(name)}
        </Typography>
        {info.size_mb !== undefined && (
          <Chip label={`${formatNumber(info.size_mb, 2)} MB`} size="small" sx={{ flexShrink: 0 }} />
        )}
      </Stack>
      <Stack spacing={0.5}>
        {Object.entries(info.counts).map(([table, count]) => {
          const failed = typeof count !== 'number' || count < 0
          return (
            <Stack key={table} direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
              <Typography variant="body2" color="text.secondary" noWrap title={table} sx={{ minWidth: 0 }}>
                {table}
              </Typography>
              {failed ? (
                <Tooltip title={t('admin_estado_tabla_no_disponible', 'No se pudieron contar los registros de esta tabla')}>
                  <Typography variant="body2" color="text.disabled" sx={{ flexShrink: 0 }}>
                    —
                  </Typography>
                </Tooltip>
              ) : (
                <Typography variant="body2" fontWeight={500} color="text.primary" sx={{ flexShrink: 0 }}>
                  {formatNumber(count)}
                </Typography>
              )}
            </Stack>
          )
        })}
        {failedCount > 0 && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ pt: 0.5 }}>
            <ErrorOutlineIcon sx={{ fontSize: 14, color: 'warning.main' }} />
            <Typography variant="caption" color="text.secondary">
              {t('admin_estado_tablas_sin_conteo', 'Hay tablas sin conteo disponible')}
            </Typography>
          </Stack>
        )}
        <Box
          sx={{
            pt: 1.5,
            mt: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" fontWeight={500} color="text.secondary">
              {t('admin_estado_subtotal', 'Subtotal')}
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {validCount > 0 || failedCount === 0 ? formatNumber(subtotal) : '—'}
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

/**
 * Panel de estadisticas de bases de datos
 */
export function DatabaseStatus({ dbStats }) {
  const { t } = useI18n()

  if (!dbStats) return null

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <StorageIcon sx={{ width: 20, height: 20, color: 'primary.main' }} />
          <Typography variant="subtitle1" component="h2" fontWeight={600}>
            {t('db_statistics', 'Estadísticas de bases de datos')}
          </Typography>
        </Stack>
      </Box>
      <Box sx={{ p: 2 }}>
        {/* Totales */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={6}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', height: '100%' }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  mb: 0.5,
                  display: 'block',
                }}
              >
                {t('total_records', 'Total de registros')}
              </Typography>
              <Typography variant="h5" fontWeight={700} color="text.primary">
                {formatNumber(dbStats.totals?.records || 0)}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={6}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', height: '100%' }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  mb: 0.5,
                  display: 'block',
                }}
              >
                {t('total_size', 'Espacio total')}
              </Typography>
              <Typography variant="h5" fontWeight={700} color="text.primary">
                {formatNumber(dbStats.totals?.size_mb || 0, 1)} MB
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Por base de datos */}
        <Grid container spacing={2}>
          {dbStats.databases && Object.entries(dbStats.databases).map(([dbName, dbInfo]) => (
            <Grid
              key={dbName}
              size={{ xs: 12, sm: 6, lg: 4 }}>
              <DatabaseCard name={dbName} info={dbInfo} />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Paper>
  );
}

export default DatabaseStatus
