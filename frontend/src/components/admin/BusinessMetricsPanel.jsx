/**
 * BusinessMetricsPanel - Panel de metricas de negocio
 *
 * Muestra contadores de solicitudes, usuarios y materiales
 */

import { Box, Paper, Typography, Stack, Skeleton, Tooltip } from '@mui/material'
import { useI18n } from '../../context/i18n'
import DescriptionIcon from '@mui/icons-material/Description'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PeopleIcon from '@mui/icons-material/People'
import InventoryIcon from '@mui/icons-material/Inventory'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

/**
 * Tarjeta de metrica individual con tooltip
 */
function MetricCard({ title, value, icon: Icon, variant = 'default', subtitle, tooltip }) {
  const variants = {
    default: {
      bgcolor: 'grey.50',
      borderColor: 'grey.200',
      color: 'text.primary',
    },
    primary: {
      bgcolor: 'primary.50',
      borderColor: 'primary.200',
      color: 'primary.dark',
    },
    success: {
      bgcolor: 'success.50',
      borderColor: 'success.200',
      color: 'success.dark',
    },
    warning: {
      bgcolor: 'warning.50',
      borderColor: 'warning.200',
      color: 'warning.dark',
    },
    danger: {
      bgcolor: 'error.50',
      borderColor: 'error.200',
      color: 'error.dark',
    },
  }

  const styles = variants[variant] || variants.default

  return (
    <Box
      sx={{
        border: 1,
        borderColor: styles.borderColor,
        borderRadius: 2,
        p: 2,
        bgcolor: styles.bgcolor,
        color: styles.color,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 500,
                opacity: 0.7,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {title}
            </Typography>
            {tooltip && (
              <Tooltip title={tooltip} placement="top">
                <HelpOutlineIcon sx={{ fontSize: 12, opacity: 0.5, cursor: 'help' }} />
              </Tooltip>
            )}
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ opacity: 0.6, mt: 0.5, display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ opacity: 0.5 }}>
          <Icon sx={{ fontSize: 24 }} />
        </Box>
      </Stack>
    </Box>
  )
}

/**
 * Mini grafico de barras para estados
 */
function EstadosChart({ estados }) {
  if (!estados || Object.keys(estados).length === 0) return null

  const total = Object.values(estados).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  // Colores por estado
  const estadoColors = {
    'Borrador': 'var(--fg-subtle)',
    'Enviada': 'var(--primary)',
    'En Revision': 'var(--warning)',
    'En Revisión': 'var(--warning)',
    'Aprobada': 'var(--success)',
    'Rechazada': 'var(--danger)',
    'En Planificacion': '#8b5cf6',
    'En Planificación': '#8b5cf6',
    'Despachada': '#06b6d4',
    'Cerrada': '#6b7280',
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
        Distribucion por estado
      </Typography>
      <Box
        sx={{
          height: 12,
          borderRadius: 6,
          overflow: 'hidden',
          display: 'flex',
          bgcolor: 'grey.100',
        }}
      >
        {Object.entries(estados).map(([estado, count]) => {
          const width = (count / total) * 100
          if (width < 1) return null
          return (
            <Tooltip key={estado} title={`${estado}: ${count}`}>
              <Box
                sx={{
                  width: `${width}%`,
                  height: '100%',
                  bgcolor: estadoColors[estado] || 'var(--fg-subtle)',
                }}
              />
            </Tooltip>
          )
        })}
      </Box>
      <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mt: 1 }}>
        {Object.entries(estados).map(([estado, count]) => (
          <Stack
            key={estado}
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ typography: 'caption' }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: estadoColors[estado] || 'var(--fg-subtle)',
              }}
            />
            <Typography
              variant="caption"
              sx={{ color: estadoColors[estado] || 'var(--fg-subtle)' }}
            >
              {estado}: {count}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  )
}

/**
 * Panel de metricas de negocio
 */
export function BusinessMetricsPanel({ data, isLoading = false }) {
  if (isLoading) {
    return (
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TrendingUpIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              Metricas de Negocio
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rounded" height={96} />
            ))}
          </Box>
        </Box>
      </Paper>
    )
  }

  if (!data) {
    return (
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TrendingUpIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              Metricas de Negocio
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No hay datos disponibles
          </Typography>
        </Box>
      </Paper>
    )
  }

  const { t } = useI18n()
  const { solicitudes = {}, usuarios = {}, materiales = {} } = data

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <TrendingUpIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
            Metricas de Negocio
          </Typography>
        </Stack>
      </Box>
      <Box sx={{ px: 2, pb: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          <MetricCard
            title={t("admin_metrics_requests_today", "Solicitudes Hoy")}
            value={solicitudes.hoy || 0}
            icon={DescriptionIcon}
            variant="primary"
            tooltip="Cantidad de solicitudes de materiales creadas en el dia actual"
          />
          <MetricCard
            title={t("admin_metrics_pending", "Pendientes")}
            value={solicitudes.pendientes || 0}
            icon={AccessTimeIcon}
            variant={solicitudes.pendientes > 10 ? 'warning' : 'default'}
            subtitle={solicitudes.pendientes > 10 ? t("admin_metrics_requires_attention", "Requiere atencion") : null}
            tooltip="Solicitudes en estado 'Enviada' esperando aprobacion o revision"
          />
          <MetricCard
            title={t("admin_metrics_active_users", "Usuarios Activos (24h)")}
            value={usuarios.activos_24h || 0}
            icon={PeopleIcon}
            variant="success"
            subtitle={`${usuarios.total || 0} total`}
            tooltip="Usuarios unicos que iniciaron sesion en las ultimas 24 horas"
          />
          <MetricCard
            title={t("admin_metrics_materials_month", "Materiales (Mes)")}
            value={materiales.unicos_mes || 0}
            icon={InventoryIcon}
            subtitle={t("admin_metrics_unique_requested", "Unicos solicitados")}
            tooltip="Cantidad de materiales distintos (por codigo SAP) solicitados en los ultimos 30 dias"
          />
        </Box>

        {/* Grafico de estados */}
        <EstadosChart estados={solicitudes.por_estado} />

        {/* Resumen */}
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Total solicitudes:
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {solicitudes.total || 0}
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Paper>
  )
}

export default BusinessMetricsPanel
