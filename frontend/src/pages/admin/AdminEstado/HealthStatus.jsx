/**
 * HealthStatus - Panel de estado de salud del sistema
 *
 * Muestra el estado de las bases de datos y el cache
 */

import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material'
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import { useI18n } from '../../../context/i18n'

/**
 * Indicador visual de estado
 */
function StatusDot({ status }) {
  const colors = {
    connected: '#10b981', // emerald-500
    healthy: '#10b981',
    warning: '#f59e0b', // amber-500
    error: '#ef4444', // red-500
    disconnected: '#ef4444',
    unavailable: '#94a3b8', // slate-400
  }
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        bgcolor: colors[status] || '#94a3b8',
      }}
    />
  )
}

/**
 * Formatea el uptime en formato legible
 */
function formatUptime(seconds) {
  if (!seconds) return '--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h}h ${m}m ${s}s`
}

/**
 * Item individual de base de datos
 */
function DatabaseItem({ name, status, latency, tooltip }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        bgcolor: 'grey.50',
        borderRadius: 2,
      }}
    >
      <StatusDot status={status} />
      <Box>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              textTransform: 'uppercase',
              fontWeight: 500,
            }}
          >
            {name}
          </Typography>
          {tooltip && (
            <Tooltip title={tooltip} placement="top" arrow>
              <HelpOutlineIcon
                sx={{
                  fontSize: 12,
                  color: 'grey.400',
                  cursor: 'help',
                }}
              />
            </Tooltip>
          )}
        </Stack>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
          }}
        >
          {latency ? `${latency.toFixed(1)}ms` : '--'}
        </Typography>
      </Box>
    </Box>
  )
}

/**
 * Panel de estado de salud del sistema
 */
export function HealthStatus({ health, cacheHitRate = 0 }) {
  const { t } = useI18n()

  const isHealthy = health?.status === 'healthy'
  const databases = health?.checks?.database || {}

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <MonitorHeartIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" component="h2">
            {isHealthy
              ? t('system_healthy', 'Sistema Operativo')
              : t('system_degraded', 'Sistema Degradado')}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <AccessTimeIcon sx={{ fontSize: 16, color: 'info.main' }} />
            <Typography variant="body2" color="text.secondary">
              Uptime: {formatUptime(health?.uptime_seconds)}
            </Typography>
          </Stack>
          <Chip
            label={health?.status || 'unknown'}
            size="small"
            color={isHealthy ? 'success' : 'warning'}
          />
        </Stack>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2 }}>
        <Grid container spacing={2}>
          {/* Bases de datos */}
          <Grid item xs={6} md={2.4}>
            <DatabaseItem
              name="SPM"
              status={databases.spm?.status}
              latency={databases.spm?.latency_ms}
              tooltip="Base de datos principal: usuarios, solicitudes, autenticacion"
            />
          </Grid>
          <Grid item xs={6} md={2.4}>
            <DatabaseItem
              name="SAP"
              status={databases.sap_data?.status}
              latency={databases.sap_data?.latency_ms}
              tooltip="Datos importados de SAP: stock, consumo historico, pedidos"
            />
          </Grid>
          <Grid item xs={6} md={2.4}>
            <DatabaseItem
              name="EQUIV"
              status={databases.equivalentes?.status}
              latency={databases.equivalentes?.latency_ms}
              tooltip="Equivalencias de materiales entre codigos SAP"
            />
          </Grid>
          <Grid item xs={6} md={2.4}>
            <DatabaseItem
              name="CATALOGO"
              status={databases.catalogo_materiales?.status}
              latency={databases.catalogo_materiales?.latency_ms}
              tooltip="Catalogo completo de materiales SAP (~28,000 items)"
            />
          </Grid>

          {/* Cache Status */}
          <Grid item xs={6} md={2.4}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                bgcolor: 'grey.50',
                borderRadius: 2,
              }}
            >
              <StatusDot
                status={cacheHitRate >= 90 ? 'healthy' : cacheHitRate >= 70 ? 'warning' : 'error'}
              />
              <Box>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      fontWeight: 500,
                    }}
                  >
                    Cache
                  </Typography>
                  <Tooltip title="Porcentaje de consultas servidas desde cache en memoria" placement="top" arrow>
                    <HelpOutlineIcon
                      sx={{
                        fontSize: 12,
                        color: 'grey.400',
                        cursor: 'help',
                      }}
                    />
                  </Tooltip>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                  }}
                >
                  {cacheHitRate.toFixed(0)}% {t('admin_hit', 'hit')}
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  )
}

export default HealthStatus
