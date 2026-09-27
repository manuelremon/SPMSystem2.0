/**
 * BusinessMetricsPanel - Panel de metricas de negocio
 *
 * Muestra contadores de solicitudes, usuarios y materiales
 */

import { Box, Paper, Typography, Stack, Skeleton, Tooltip } from '@mui/material'
import { useI18n } from '../../context/i18n'
import { formatNumber } from '../../utils/formatters'
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
  const valueColor = variant === 'warning' ? 'warning.dark' : 'text.primary'

  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>
              {title}
            </Typography>
            {tooltip && (
              <Tooltip title={tooltip} placement="top">
                <HelpOutlineIcon sx={{ fontSize: 12, color: 'text.disabled', cursor: 'help' }} />
              </Tooltip>
            )}
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: valueColor }}>
            {typeof value === 'number' ? formatNumber(value) : value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Icon sx={{ fontSize: 24, color: 'primary.main', opacity: 0.6, flexShrink: 0 }} />
      </Stack>
    </Paper>
  )
}

/**
 * Estados de la FSM de solicitudes (claves en inglés o español) -> etiqueta y color
 */
const ESTADOS_SOLICITUD = {
  draft: { label: 'Borrador', color: 'var(--neutral)' },
  borrador: { label: 'Borrador', color: 'var(--neutral)' },
  submitted: { label: 'Enviada', color: 'var(--info)' },
  enviada: { label: 'Enviada', color: 'var(--info)' },
  pendiente: { label: 'Pendiente', color: 'var(--info)' },
  in_review: { label: 'En revisión', color: 'var(--warning)' },
  en_revision: { label: 'En revisión', color: 'var(--warning)' },
  approved: { label: 'Aprobada', color: 'var(--success)' },
  aprobada: { label: 'Aprobada', color: 'var(--success)' },
  rejected: { label: 'Rechazada', color: 'var(--danger)' },
  rechazada: { label: 'Rechazada', color: 'var(--danger)' },
  in_planning: { label: 'En planificación', color: 'var(--purple)' },
  en_planificacion: { label: 'En planificación', color: 'var(--purple)' },
  processing: { label: 'En proceso', color: 'var(--indigo)' },
  en_proceso: { label: 'En proceso', color: 'var(--indigo)' },
  in_treatment: { label: 'En tratamiento', color: 'var(--orange)' },
  en_tratamiento: { label: 'En tratamiento', color: 'var(--orange)' },
  treated: { label: 'Tratada', color: 'var(--cyan-dark)' },
  tratado: { label: 'Tratada', color: 'var(--cyan-dark)' },
  dispatched: { label: 'Despachada', color: 'var(--cyan)' },
  despachada: { label: 'Despachada', color: 'var(--cyan)' },
  completed: { label: 'Completada', color: 'var(--success-light)' },
  completada: { label: 'Completada', color: 'var(--success-light)' },
  closed: { label: 'Cerrada', color: 'var(--primary-dark)' },
  cerrada: { label: 'Cerrada', color: 'var(--primary-dark)' },
  cancelled: { label: 'Cancelada', color: 'var(--fg-subtle)' },
  cancelada: { label: 'Cancelada', color: 'var(--fg-subtle)' },
}

function normalizarEstado(estado) {
  return (estado || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

function getEstadoInfo(estado) {
  const info = ESTADOS_SOLICITUD[normalizarEstado(estado)]
  if (info) return info
  const texto = (estado || '').toString().replace(/_/g, ' ')
  return { label: texto.charAt(0).toUpperCase() + texto.slice(1), color: 'var(--fg-subtle)' }
}

/**
 * Mini grafico de barras para estados
 */
function EstadosChart({ estados }) {
  const { t } = useI18n()
  if (!estados || Object.keys(estados).length === 0) return null

  const total = Object.values(estados).reduce((a, b) => a + (Number(b) || 0), 0)
  if (total === 0) return null

  const items = Object.entries(estados)
    .map(([estado, count]) => {
      const info = getEstadoInfo(estado)
      return {
        key: estado,
        label: t(`admin_metrics_estado_${normalizarEstado(estado)}`, info.label),
        color: info.color,
        count: Number(count) || 0,
      }
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
        {t('admin_metrics_status_distribution', 'Distribución por estado')}
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
        {items.map((item) => (
          <Tooltip key={item.key} title={`${item.label}: ${formatNumber(item.count)}`}>
            <Box
              sx={{
                width: `${(item.count / total) * 100}%`,
                height: '100%',
                bgcolor: item.color,
              }}
            />
          </Tooltip>
        ))}
      </Box>
      <Stack direction="row" flexWrap="wrap" columnGap={2} rowGap={0.5} sx={{ mt: 1 }}>
        {items.map((item) => (
          <Stack key={item.key} direction="row" alignItems="center" spacing={0.5}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: item.color,
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {item.label}: <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{formatNumber(item.count)}</Box>
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
  const { t } = useI18n()
  if (isLoading) {
    return (
      <Paper variant="outlined">
        <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TrendingUpIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
              {t('admin_metrics_title', 'Métricas de negocio')}
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
      <Paper variant="outlined">
        <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TrendingUpIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
              {t('admin_metrics_title', 'Métricas de negocio')}
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('admin_metrics_no_data', 'No hay datos disponibles')}
          </Typography>
        </Box>
      </Paper>
    )
  }

  const { solicitudes = {}, usuarios = {}, materiales = {} } = data

  return (
    <Paper variant="outlined">
      <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <TrendingUpIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
            {t('admin_metrics_title', 'Métricas de negocio')}
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
            title={t("admin_metrics_requests_today", "Solicitudes de hoy")}
            value={solicitudes.hoy || 0}
            icon={DescriptionIcon}
            variant="default"
            tooltip={t("admin_metrics_tt_today", "Cantidad de solicitudes de materiales creadas en el día")}
          />
          <MetricCard
            title={t("admin_metrics_pending", "Pendientes")}
            value={solicitudes.pendientes || 0}
            icon={AccessTimeIcon}
            variant={solicitudes.pendientes > 10 ? 'warning' : 'default'}
            subtitle={solicitudes.pendientes > 10 ? t("admin_metrics_requires_attention", "Requiere atención") : null}
            tooltip={t("admin_metrics_tt_pending", "Solicitudes enviadas que esperan aprobación o revisión")}
          />
          <MetricCard
            title={t("admin_metrics_active_users", "Usuarios activos (24 h)")}
            value={usuarios.activos_24h || 0}
            icon={PeopleIcon}
            variant="default"
            subtitle={`${t("admin_metrics_of_total", "de")} ${formatNumber(usuarios.total || 0)} ${t("admin_metrics_registered", "registrados")}`}
            tooltip={t("admin_metrics_tt_active_users", "Usuarios únicos que iniciaron sesión en las últimas 24 horas")}
          />
          <MetricCard
            title={t("admin_metrics_materials_month", "Materiales (mes)")}
            value={materiales.unicos_mes || 0}
            icon={InventoryIcon}
            subtitle={t("admin_metrics_unique_requested", "Únicos solicitados")}
            tooltip={t("admin_metrics_tt_materials", "Cantidad de materiales distintos (por código SAP) solicitados en los últimos 30 días")}
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
              {t('admin_metrics_total_requests', 'Total de solicitudes')}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatNumber(solicitudes.total || 0)}
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Paper>
  )
}

export default BusinessMetricsPanel
