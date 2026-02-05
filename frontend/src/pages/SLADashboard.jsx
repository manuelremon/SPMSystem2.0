/**
 * SLA Dashboard - Metricas de cumplimiento y alertas
 *
 * Features:
 * - Metricas de cumplimiento (on-time, warning, breach)
 * - Alertas activas con acciones
 * - Filtros por periodo y criticidad
 * - Auto-refresh
 *
 * Migrated to Chart.js (SPMChartJS)
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Grid,
  Chip,
  Select,
  MenuItem,
  FormControl,
  Skeleton,
  Alert,
  IconButton,
  CircularProgress
} from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CancelIcon from '@mui/icons-material/Cancel'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RefreshIcon from '@mui/icons-material/Refresh'
import FilterListIcon from '@mui/icons-material/FilterList'
import { useI18n } from '../context/i18n'
import slaService from '../services/sla'
import { SPMGauge, SPMBar } from '../components/ui/SPMChartJS'

// Colores por tipo de alerta - MUI sx styles
const ALERT_COLORS = {
  warning: { bg: 'warning.lighter', border: 'warning.light', text: 'warning.dark', chipColor: 'warning' },
  breach: { bg: 'error.lighter', border: 'error.light', text: 'error.dark', chipColor: 'error' },
  escalated: { bg: 'secondary.lighter', border: 'secondary.light', text: 'secondary.dark', chipColor: 'secondary' }
}

// Periodos disponibles
const PERIODOS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' }
]

// Variantes de MetricCard para MUI
const METRIC_VARIANTS = {
  primary: { bg: 'primary.lighter', icon: 'primary.main', border: 'primary.main' },
  success: { bg: 'success.lighter', icon: 'success.main', border: 'success.main' },
  warning: { bg: 'warning.lighter', icon: 'warning.main', border: 'warning.main' },
  danger: { bg: 'error.lighter', icon: 'error.main', border: 'error.main' }
}

// MUI MetricCard component
const MUIMetricCard = ({ icon: Icon, label, value, variant = 'primary', highlight = false }) => {
  const colors = highlight ? METRIC_VARIANTS.warning : METRIC_VARIANTS[variant] || METRIC_VARIANTS.primary

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        borderLeft: 4,
        borderColor: colors.border,
        bgcolor: highlight ? 'warning.lighter' : 'background.paper',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 3 }
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box
          sx={{
            p: 1,
            borderRadius: 2,
            bgcolor: colors.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon sx={{ fontSize: 20, color: colors.icon }} />
        </Box>
        <Box>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              textTransform: 'uppercase',
              fontWeight: 500,
              letterSpacing: 0.5
            }}
          >
            {label}
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 'bold',
              color: highlight ? 'warning.dark' : 'text.primary',
              fontFeatureSettings: '"tnum"'
            }}
          >
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  )
}

export default function SLADashboard() {
  const { t } = useI18n()

  // Estado
  const [metricas, setMetricas] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [periodoDias, setPeriodoDias] = useState(30)
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Cargar datos
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const [metricasData, alertasData] = await Promise.all([
        slaService.getMetricas({ periodoDias, porCriticidad: true }),
        slaService.getAlertas({ tipo: tipoFiltro || null })
      ])

      setMetricas(metricasData)
      setAlertas(alertasData)
      setError(null)
    } catch (err) {
      console.error('Error loading SLA data:', err)
      setError(t('sla_error_loading', 'Error al cargar datos SLA'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [periodoDias, tipoFiltro, t])

  // Cargar al montar y cuando cambian filtros
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh cada 60 segundos
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Resolver alerta
  const handleResolverAlerta = async (alertaId) => {
    try {
      await slaService.resolverAlerta(alertaId)
      setAlertas(prev => prev.filter(a => a.id !== alertaId))
    } catch (err) {
      console.error('Error resolving alert:', err)
    }
  }

  // Color del porcentaje de cumplimiento - MUI Palette
  const getCumplimientoColor = (porcentaje) => {
    if (porcentaje >= 90) return '#2e7d32' // MUI Green 800
    if (porcentaje >= 70) return '#ed6c02' // MUI Orange 800
    return '#d32f2f' // MUI Red 700
  }

  // Datos para grafico de barras por criticidad
  const chartData = metricas?.por_criticidad?.map(c => c.on_time) || []

  // Loading skeleton
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Header skeleton */}
        <Box>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="text" width={350} height={24} />
        </Box>

        {/* Metrics skeleton */}
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={6} md={3} key={i}>
              <Skeleton variant="rounded" height={96} />
            </Grid>
          ))}
        </Grid>

        {/* Charts skeleton */}
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Skeleton variant="rounded" height={256} />
          </Grid>
          <Grid item xs={12} lg={6}>
            <Skeleton variant="rounded" height={256} />
          </Grid>
        </Grid>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('sla_dashboard', 'Dashboard SLA')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('sla_subtitle', 'Metricas de cumplimiento de niveles de servicio')}
          </Typography>
        </Box>

        <Stack direction="row" alignItems="center" spacing={1.5}>
          {/* Selector de periodo */}
          <FormControl size="small">
            <Select
              value={periodoDias}
              onChange={(e) => setPeriodoDias(Number(e.target.value))}
              sx={{
                minWidth: 100,
                bgcolor: 'background.paper',
                '& .MuiSelect-select': { py: 1, px: 1.5 }
              }}
            >
              {PERIODOS.map(p => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Boton refresh */}
          <IconButton
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            sx={{ color: 'primary.main' }}
          >
            {isRefreshing ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <RefreshIcon />
            )}
          </IconButton>
        </Stack>
      </Stack>

      {/* Error */}
      {error && (
        <Alert severity="error">{error}</Alert>
      )}

      {/* Metricas principales */}
      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <MUIMetricCard
            icon={AccessTimeIcon}
            label={t('sla_total', 'Total Solicitudes')}
            value={metricas?.total_solicitudes || 0}
            variant="primary"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <MUIMetricCard
            icon={CheckCircleIcon}
            label={t('sla_on_time', 'A Tiempo')}
            value={metricas?.on_time || 0}
            variant="success"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <MUIMetricCard
            icon={WarningAmberIcon}
            label={t('sla_warning', 'En Riesgo')}
            value={metricas?.warning || 0}
            variant="warning"
            highlight={metricas?.warning > 0}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <MUIMetricCard
            icon={CancelIcon}
            label={t('sla_breach', 'Incumplidas')}
            value={metricas?.breach || 0}
            variant="danger"
            highlight={metricas?.breach > 0}
          />
        </Grid>
      </Grid>

      {/* Fila de graficos */}
      <Grid container spacing={3}>
        {/* Cumplimiento general */}
        <Grid item xs={12} lg={6}>
          <Paper elevation={1} sx={{ height: '100%' }}>
            <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {t('sla_cumplimiento', 'Cumplimiento General')}
              </Typography>
            </Box>
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <SPMGauge
                  value={Math.round(metricas?.porcentaje_cumplimiento || 0)}
                  max={100}
                  height={180}
                  thresholds={{ warning: 70, danger: 90 }}
                  label={t('sla_cumplimiento', 'Cumplimiento')}
                  unit="%"
                />
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 2, textAlign: 'center' }}
              >
                {t('sla_periodo', 'Periodo')}: {t('sla_ultimos', 'Ultimos')} {periodoDias} {t('sla_dias', 'dias')}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Por criticidad */}
        <Grid item xs={12} lg={6}>
          <Paper elevation={1} sx={{ height: '100%' }}>
            <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {t('sla_por_criticidad', 'Por Criticidad')}
              </Typography>
            </Box>
            <Box sx={{ p: 3 }}>
              {metricas?.por_criticidad?.length > 0 ? (
                <Stack spacing={2}>
                  {metricas.por_criticidad.map((item, idx) => (
                    <Stack
                      key={idx}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Chip
                          label={item.criticidad}
                          size="small"
                          color={
                            item.criticidad === 'alta' ? 'error' :
                            item.criticidad === 'media' ? 'warning' : 'default'
                          }
                        />
                        <Typography variant="body2" color="text.secondary">
                          {item.total} {t('sla_solicitudes', 'solicitudes')}
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" fontWeight={500} color="success.main">
                          {item.on_time} {t('sla_on_time_short', 'OK')}
                        </Typography>
                        {item.breach > 0 && (
                          <Typography variant="body2" fontWeight={500} color="error.main">
                            {item.breach} {t('sla_breach_short', 'SLA')}
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                  ))}

                  {/* Mini chart */}
                  {chartData.length > 0 && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        {t('sla_chart_label', 'A tiempo por criticidad')}
                      </Typography>
                      <SPMBar
                        labels={metricas?.por_criticidad?.map(c => c.criticidad) || []}
                        datasets={[{
                          label: t('sla_on_time_short', 'OK'),
                          data: chartData,
                          backgroundColor: '#2e7d32'
                        }]}
                        height={80}
                        options={{
                          plugins: { legend: { display: false } },
                          scales: {
                            x: { display: false },
                            y: { display: false }
                          }
                        }}
                      />
                    </Box>
                  )}
                </Stack>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  {t('sla_no_data', 'Sin datos de criticidad')}
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Alertas activas */}
      <Paper elevation={1}>
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600}>
              {t('sla_alertas_activas', 'Alertas Activas')}
            </Typography>
            {alertas.length > 0 && (
              <Chip label={alertas.length} size="small" color="error" />
            )}
          </Stack>

          {/* Filtro de tipo */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <FilterListIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
            <FormControl size="small">
              <Select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                displayEmpty
                sx={{
                  minWidth: 120,
                  '& .MuiSelect-select': { py: 0.75, px: 1.5, fontSize: '0.875rem' }
                }}
              >
                <MenuItem value="">{t('sla_todos', 'Todos')}</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="breach">Breach</MenuItem>
                <MenuItem value="escalated">Escalated</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Box>

        <Box sx={{ p: 3 }}>
          {alertas.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1.5 }} />
              <Typography color="text.secondary">
                {t('sla_sin_alertas', 'No hay alertas activas')}
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {alertas.map((alerta) => {
                const colors = ALERT_COLORS[alerta.tipo] || ALERT_COLORS.warning
                return (
                  <Paper
                    key={alerta.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      bgcolor: colors.bg,
                      borderColor: colors.border
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
                      spacing={1}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          <Chip
                            label={alerta.tipo?.toUpperCase()}
                            size="small"
                            color={colors.chipColor}
                          />
                          <Typography variant="body2" fontWeight={500} color="text.primary">
                            {t('sla_solicitud', 'Solicitud')} #{alerta.solicitud_id}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: colors.text }}>
                          {alerta.mensaje || t('sla_alerta_default', 'Alerta de SLA activa')}
                        </Typography>
                        {alerta.tiempo_transcurrido_horas && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            {t('sla_tiempo_transcurrido', 'Tiempo transcurrido')}:{' '}
                            {Math.round(alerta.tiempo_transcurrido_horas)}h /{' '}
                            {alerta.tiempo_objetivo_horas}h {t('sla_objetivo', 'objetivo')}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => handleResolverAlerta(alerta.id)}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': { color: 'success.main' }
                        }}
                      >
                        {t('sla_resolver', 'Resolver')}
                      </Button>
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          )}
        </Box>
      </Paper>
    </Box>
  )
}
