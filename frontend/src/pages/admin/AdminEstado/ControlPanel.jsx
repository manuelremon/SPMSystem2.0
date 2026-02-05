/**
 * ControlPanel - Panel de controles del sistema
 *
 * Refresh, auto-refresh, reset metricas, exportar
 */

import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Divider,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import TimelineIcon from '@mui/icons-material/Timeline'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import { useI18n } from '../../../context/i18n'

/**
 * Panel de controles del administrador
 */
export function ControlPanel({
  onRefresh,
  onResetMetrics,
  onExport,
  onToggleAutoRefresh,
  autoRefresh,
  loading,
  resetting
}) {
  const { t } = useI18n()

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <RefreshIcon sx={{ color: 'grey.500' }} />
          <Typography variant="h6" component="h2">
            {t('controls', 'Controles')}
          </Typography>
        </Stack>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" flexWrap="wrap" gap={1.5}>
            <Button
              variant="outlined"
              size="small"
              onClick={onRefresh}
              disabled={loading}
              startIcon={
                <RefreshIcon
                  sx={{
                    animation: loading ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              }
            >
              {t('refresh', 'Actualizar')}
            </Button>

            <Button
              variant={autoRefresh ? 'contained' : 'outlined'}
              size="small"
              onClick={onToggleAutoRefresh}
              startIcon={autoRefresh ? <PauseIcon /> : <PlayArrowIcon />}
            >
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={onResetMetrics}
              disabled={resetting}
              startIcon={
                <TimelineIcon
                  sx={{
                    animation: resetting ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' },
                    },
                  }}
                />
              }
            >
              {t('reset_metrics', 'Reiniciar Metricas')}
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={onExport}
              startIcon={<FileDownloadIcon />}
            >
              {t('export_json', 'Exportar JSON')}
            </Button>
          </Stack>

          <Divider />

          <Typography variant="caption" color="text.secondary">
            {t('auto_refresh_info', 'Auto-refresh cada 30 segundos cuando esta activado. Las metricas se acumulan desde el ultimo reinicio del servidor.')}
          </Typography>
        </Stack>
      </Box>
    </Paper>
  )
}

export default ControlPanel
