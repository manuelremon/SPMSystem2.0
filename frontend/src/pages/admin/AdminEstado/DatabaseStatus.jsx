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
} from "@mui/material";

// MUI Icons
import StorageIcon from "@mui/icons-material/Storage";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

import { useI18n } from '../../../context/i18n'

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
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              textTransform: 'uppercase',
              fontSize: '0.75rem',
            }}
          >
            {name.replace(/_/g, ' ')}
          </Typography>
          <Chip label="Error" color="error" size="small" />
        </Stack>
        <Typography variant="body2" color="error.main">
          {info.error}
        </Typography>
      </Paper>
    )
  }

  if (!info?.counts) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              textTransform: 'uppercase',
              fontSize: '0.75rem',
            }}
          >
            {name.replace(/_/g, ' ')}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t('no_data', 'Sin datos')}
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            textTransform: 'uppercase',
            fontSize: '0.75rem',
          }}
        >
          {name.replace(/_/g, ' ')}
        </Typography>
        {info.size_mb !== undefined && (
          <Chip label={`${info.size_mb} MB`} size="small" />
        )}
      </Stack>
      <Stack spacing={0.5}>
        {Object.entries(info.counts).map(([table, count]) => (
          <Stack key={table} direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {table}
            </Typography>
            <Typography variant="body2" fontWeight={500} color="text.primary">
              {count.toLocaleString()}
            </Typography>
          </Stack>
        ))}
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
              {t('subtotal', 'Subtotal')}
            </Typography>
            <Typography variant="body2" fontWeight={600} color="success.main">
              {info.total_records?.toLocaleString() || '0'}
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  )
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
          <StorageIcon sx={{ width: 20, height: 20, color: 'success.main' }} />
          <Typography variant="h6" fontWeight={600}>
            {t('db_statistics', 'Estadisticas de Base de Datos')}
          </Typography>
        </Stack>
      </Box>
      <Box sx={{ p: 2 }}>
        {/* Totales */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6}>
            <Paper
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'success.lighter',
                textAlign: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  mb: 0.5,
                  display: 'block',
                }}
              >
                {t('total_records', 'Total Registros')}
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="success.dark">
                {dbStats.totals?.records?.toLocaleString() || '0'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6}>
            <Paper
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'info.lighter',
                textAlign: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  mb: 0.5,
                  display: 'block',
                }}
              >
                {t('total_size', 'Espacio Total')}
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="info.dark">
                {dbStats.totals?.size_mb?.toFixed(1) || '0'} MB
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Por base de datos */}
        <Grid container spacing={2}>
          {dbStats.databases && Object.entries(dbStats.databases).map(([dbName, dbInfo]) => (
            <Grid item xs={12} md={6} key={dbName}>
              <DatabaseCard name={dbName} info={dbInfo} />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Paper>
  )
}

export default DatabaseStatus
