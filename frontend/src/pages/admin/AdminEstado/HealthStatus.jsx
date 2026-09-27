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
import { formatNumber } from '../../../utils/formatters'

/**
 * Indicador visual de estado
 */
function StatusDot({ status }) {
  const colors = {
    connected: 'var(--success-light)', // emerald-500
    healthy: 'var(--success-light)',
    warning: 'var(--warning-light)', // amber-500
    error: 'var(--danger-light)', // red-500
    disconnected: 'var(--danger-light)',
    unavailable: 'var(--fg-subtle)', // slate-400
  }
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        bgcolor: colors[status] || 'var(--fg-subtle)',
      }}
    />
  )
}

/**
 * Formatea el uptime en formato legible
 */
function formatUptime(seconds) {
  if (!seconds) return '—'
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
        borderRadius: 1,
        height: '100%',
      }}
    >
      <StatusDot status={status} />
      <Box>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
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
          {latency ? `${formatNumber(latency, 1)} ms` : '—'}
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
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
            {isHealthy
              ? t('system_healthy', 'Sistema operativo')
              : t('system_degraded', 'Sistema degradado')}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <AccessTimeIcon sx={{ fontSize: 16, color: 'info.main' }} />
            <Typography variant="body2" color="text.secondary">
              {t('admin_estado_tiempo_activo', 'Tiempo activo')}: {formatUptime(health?.uptime_seconds)}
            </Typography>
          </Stack>
          <Chip
            label={
              health?.status === 'healthy'
                ? t('admin_estado_saludable', 'Saludable')
                : health?.status === 'degraded'
                  ? t('admin_estado_degradado', 'Degradado')
                  : health?.status === 'unhealthy'
                    ? t('admin_estado_con_fallas', 'Con fallas')
                    : health?.status || t('admin_estado_desconocido', 'Desconocido')
            }
            size="small"
            color={isHealthy ? 'success' : 'warning'}
          />
        </Stack>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2 }}>
        <Grid container spacing={2}>
          {/* Bases de datos */}
          <Grid size={{ xs: 6, md: 2.4 }}>
            <DatabaseItem
              name="SPM"
              status={databases.spm?.status}
              latency={databases.spm?.latency_ms}
              tooltip={t('admin_estado_tt_spm', 'Base de datos principal: usuarios, solicitudes, autenticación')}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2.4 }}>
            <DatabaseItem
              name="SAP"
              status={databases.sap_data?.status}
              latency={databases.sap_data?.latency_ms}
              tooltip={t('admin_estado_tt_sap', 'Datos importados de SAP: stock, consumo histórico, pedidos')}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2.4 }}>
            <DatabaseItem
              name={t('admin_estado_equivalencias', 'Equivalencias')}
              status={databases.equivalentes?.status}
              latency={databases.equivalentes?.latency_ms}
              tooltip={t('admin_estado_tt_equiv', 'Equivalencias de materiales entre códigos SAP')}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2.4 }}>
            <DatabaseItem
              name={t('admin_estado_catalogo', 'Catálogo')}
              status={databases.catalogo_materiales?.status}
              latency={databases.catalogo_materiales?.latency_ms}
              tooltip={t('admin_estado_tt_catalogo', 'Catálogo completo de materiales SAP (~28.000 ítems)')}
            />
          </Grid>

          {/* Cache Status */}
          <Grid size={{ xs: 6, md: 2.4 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                bgcolor: 'grey.50',
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
                      fontWeight: 500,
                    }}
                  >
                    {t('admin_estado_cache', 'Caché')}
                  </Typography>
                  <Tooltip title={t('admin_estado_tt_cache', 'Porcentaje de consultas servidas desde la caché en memoria')} placement="top" arrow>
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
                  {formatNumber(cacheHitRate, 0)}% {t('admin_estado_aciertos', 'aciertos')}
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
}

export default HealthStatus
