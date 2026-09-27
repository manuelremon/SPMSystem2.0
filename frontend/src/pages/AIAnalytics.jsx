/**
 * AI Analytics Dashboard - Inteligencia Artificial, ML y SLA
 *
 * Features:
 * - Estado de pipelines ML (clustering, scoring, forecast)
 * - Solicitudes priorizadas por IA
 * - Alertas inteligentes ML
 * - Metricas SLA (cumplimiento, alertas)
 * - Proyeccion de demanda
 */

import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../context/i18n'
import aiService from '../services/ai'
import slaService from '../services/sla'
import { useAuthStore } from '../store/authStore'
import PageLayout from '../components/ui/PageLayout'
import { MetricCard } from '../components/ui/MetricCard'
import { formatDateTime, formatNumber } from '../utils/formatters'

// Chart.js Components
import { SPMDoughnut } from '../components/ui/SPMChartJS'

// MUI Components
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Skeleton from '@mui/material/Skeleton'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'

// MUI Icons
import PsychologyIcon from '@mui/icons-material/Psychology'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RefreshIcon from '@mui/icons-material/Refresh'
import BoltIcon from '@mui/icons-material/Bolt'
import GpsFixedIcon from '@mui/icons-material/GpsFixed'
import BarChartIcon from '@mui/icons-material/BarChart'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CancelIcon from '@mui/icons-material/Cancel'

// Periodos disponibles para SLA
const PERIODOS = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' }
]

// Colores por score de prioridad
const getScoreColor = (score) => {
  if (score >= 0.8) return 'var(--danger)'
  if (score >= 0.5) return 'var(--warning-light)'
  return 'var(--success)'
}

// Colores por tipo de alerta SLA
const ALERT_COLORS = {
  warning: { bg: 'var(--warning-bg)', border: 'var(--warning-border)', text: 'var(--warning-text)', chip: 'warning' },
  breach: { bg: 'var(--danger-bg)', border: 'var(--danger-border)', text: 'var(--danger-text)', chip: 'error' },
  escalated: { bg: 'var(--purple-bg-light)', border: 'var(--purple)', text: 'var(--purple-dark)', chip: 'secondary' }
}

// Color del porcentaje de cumplimiento
const getCumplimientoColor = (porcentaje) => {
  if (porcentaje >= 90) return 'var(--success)'
  if (porcentaje >= 70) return 'var(--warning-light)'
  return 'var(--danger)'
}

// Etiquetas de tipo de alerta SLA
const ALERT_TIPO_LABELS = {
  warning: ['sla_tipo_warning', 'En riesgo'],
  breach: ['sla_tipo_breach', 'Incumplida'],
  escalated: ['sla_tipo_escalated', 'Escalada'],
}

// Etiquetas de criticidad / severidad
const NIVEL_LABELS = {
  alta: ['common_alta', 'Alta'],
  high: ['common_alta', 'Alta'],
  media: ['common_media', 'Media'],
  medium: ['common_media', 'Media'],
  baja: ['common_baja', 'Baja'],
  low: ['common_baja', 'Baja'],
  info: ['ai_nivel_info', 'Informativa'],
}

// Componente ProgressCircle (usando Chart.js SPMDoughnut)
const ProgressCircle = ({ percentage, size = 140, color = 'var(--primary)', label }) => (
  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
    <SPMDoughnut
      data={[
        { label: 'Cumplimiento', value: percentage, color: color },
        { label: 'Restante', value: 100 - percentage, color: 'var(--border)' }
      ]}
      height={size}
      centerText={`${percentage}%`}
      options={{
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }}
    />
    {label && (
      <Typography variant="body2" fontWeight={500} color="text.secondary" sx={{ mt: 1 }}>
        {label}
      </Typography>
    )}
  </Box>
)

export default function AIAnalytics() {
  const { t } = useI18n()
  const { user } = useAuthStore()
  const nivelLabel = (v) => (NIVEL_LABELS[v] ? t(...NIVEL_LABELS[v]) : v)
  const tipoAlertaLabel = (v) => (ALERT_TIPO_LABELS[v] ? t(...ALERT_TIPO_LABELS[v]) : v)

  // Estado AI
  const [status, setStatus] = useState(null)
  const [solicitudesPriorizadas, setSolicitudesPriorizadas] = useState([])
  const [alertasIA, setAlertasIA] = useState([])

  // Estado SLA
  const [metricasSLA, setMetricasSLA] = useState(null)
  const [alertasSLA, setAlertasSLA] = useState([])
  const [periodoDias, setPeriodoDias] = useState(30)
  const [tipoFiltroSLA, setTipoFiltroSLA] = useState('')

  // Estado general
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isTraining, setIsTraining] = useState(false)

  // Tab activa (0=AI, 1=SLA)
  const [activeTab, setActiveTab] = useState(0)

  // Centro del usuario
  const centro = user?.centro || '1000'

  // Cargar datos
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const [statusData, solicitudesData, alertasIAData, metricasSLAData, alertasSLAData] = await Promise.all([
        aiService.getStatus().catch(() => null),
        aiService.priorizarSolicitudes({ limit: 10 }).catch(() => []),
        aiService.getAlertasInteligentes(centro).catch(() => []),
        slaService.getMetricas({ periodoDias, porCriticidad: true }).catch(() => null),
        slaService.getAlertas({ tipo: tipoFiltroSLA || undefined }).catch(() => [])
      ])

      setStatus(statusData)
      setSolicitudesPriorizadas(solicitudesData)
      setAlertasIA(alertasIAData)
      setMetricasSLA(metricasSLAData)
      setAlertasSLA(alertasSLAData)
      setError(null)
    } catch (err) {
      setError(t('ai_error_loading', 'Error al cargar datos'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centro, periodoDias, tipoFiltroSLA])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleTrain = async () => {
    setIsTraining(true)
    try {
      await aiService.trainModels({ force: true })
      await fetchData(true)
    } catch (err) {
      setError(t('ai_train_error', 'Error al entrenar modelos'))
    } finally {
      setIsTraining(false)
    }
  }

  const handleResolverAlertaSLA = async (alertaId) => {
    try {
      await slaService.resolverAlerta(alertaId)
      setAlertasSLA(prev => prev.filter(a => a.id !== alertaId))
    } catch {
      setError(t('sla_error_resolver', 'No se pudo resolver la alerta'))
    }
  }

  const getPipelineStatus = (pipelineStatus) => {
    if (!pipelineStatus) return { text: t('ai_pipeline_no_disponible', 'No disponible'), color: 'var(--fg-subtle)' }
    if (pipelineStatus === 'fitted' || pipelineStatus === 'ready') {
      return { text: t('ai_pipeline_listo', 'Listo'), color: 'var(--success)' }
    }
    if (pipelineStatus === 'training') {
      return { text: t('ai_pipeline_entrenando', 'Entrenando'), color: 'var(--warning-light)' }
    }
    return { text: t('ai_pipeline_pendiente', 'Pendiente'), color: 'var(--fg-subtle)' }
  }

  if (isLoading) {
    return (
      <PageLayout title={t('ai_analytics_titulo', 'Análisis con IA')}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
            {[1, 2, 3].map(i => (
              <Skeleton key={i} variant="rectangular" height={100} />
            ))}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3 }}>
            <Skeleton variant="rectangular" height={350} />
            <Skeleton variant="rectangular" height={350} />
          </Box>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title={t('ai_analytics_titulo', 'Análisis con IA')}
      actions={
        <>
          {activeTab === 1 && (
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>{t('sla_periodo', 'Período')}</InputLabel>
              <Select
                value={periodoDias}
                onChange={(e) => setPeriodoDias(Number(e.target.value))}
                label={t('sla_periodo', 'Período')}
              >
                {PERIODOS.map(p => (
                  <MenuItem key={p.value} value={p.value}>{p.value} {t('sla_dias', 'días')}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {(user?.rol === 'admin' || user?.rol === 'planificador' || user?.rol === 'administrador') && activeTab === 0 && (
            <Button
              variant="outlined"
              size="small"
              onClick={handleTrain}
              disabled={isTraining}
              startIcon={isTraining ? <CircularProgress size={16} /> : <BoltIcon />}
              sx={{ textTransform: "none" }}
            >
              {isTraining ? t('ai_training', 'Entrenando...') : t('ai_train', 'Entrenar modelos')}
            </Button>
          )}

          <Tooltip title={t('common_actualizar', 'Actualizar')}>
            <span>
              <IconButton
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                size="small"
                aria-label={t('common_actualizar', 'Actualizar')}
                sx={{ color: "var(--fg-muted)" }}
              >
                <RefreshIcon className={isRefreshing ? 'animate-spin' : ''} />
              </IconButton>
            </span>
          </Tooltip>
        </>
      }
    >
      {error && (
        <Alert severity="error">{error}</Alert>
      )}

      {/* Tabs */}
      <Box>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{
            minHeight: 44,
            bgcolor: "var(--card)",
            borderRadius: "var(--radius-md) var(--radius-md) 0 0",
            borderBottom: "2px solid var(--border)",
            "& .MuiTab-root": {
              minHeight: 44,
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "var(--fg-muted)",
              "&.Mui-selected": { color: "var(--primary)" },
              "&:hover": { color: "var(--primary)", bgcolor: "var(--primary-bg-light)" },
            },
            "& .MuiTabs-indicator": { bgcolor: "var(--primary)", height: 3 },
          }}
        >
          <Tab label={t('ai_tab_ml', 'Modelos e IA')} disableRipple />
          <Tab label={t('ai_tab_sla', 'Nivel de servicio (SLA)')} disableRipple />
        </Tabs>
      </Box>

      {/* ======================= TAB: ML & IA ======================= */}
      {activeTab === 0 && (
        <>
          {/* Estado de Pipelines */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid var(--border)" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ p: 1.5, bgcolor: "var(--purple-bg-light)" }}>
                  <PsychologyIcon sx={{ fontSize: 24, color: "var(--purple-dark)" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">{t('ai_clustering_label', 'Agrupamiento')}</Typography>
                  <Typography variant="h6" fontWeight={600} sx={{ color: getPipelineStatus(status?.clustering?.status).color }}>
                    {getPipelineStatus(status?.clustering?.status).text}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid var(--border)" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ p: 1.5, bgcolor: "var(--warning-bg)" }}>
                  <GpsFixedIcon sx={{ fontSize: 24, color: "var(--warning-light)" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">{t('ai_scoring_label', 'Priorización')}</Typography>
                  <Typography variant="h6" fontWeight={600} sx={{ color: getPipelineStatus(status?.scoring?.status).color }}>
                    {getPipelineStatus(status?.scoring?.status).text}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid var(--border)" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ p: 1.5, bgcolor: "var(--success-bg)" }}>
                  <TrendingUpIcon sx={{ fontSize: 24, color: "var(--success)" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">{t('ai_forecast_label', 'Pronóstico')}</Typography>
                  <Typography variant="h6" fontWeight={600} sx={{ color: getPipelineStatus(status?.forecast?.status).color }}>
                    {getPipelineStatus(status?.forecast?.status).text}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* Info de entrenamiento */}
          {status?.pipelines_trained && status?.last_training_date && (
            <Alert severity="info" icon={<AutoAwesomeIcon />}>
              {t('ai_last_training', 'Último entrenamiento')}:{' '}
              {formatDateTime(status.last_training_date)}
            </Alert>
          )}

          {/* Contenido principal AI */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3 }}>
            {/* Solicitudes Priorizadas */}
            <Paper elevation={0} sx={{ border: "1px solid var(--border)" }}>
              <Box sx={{ p: 2.5, borderBottom: "1px solid var(--border)" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <BarChartIcon sx={{ color: "var(--chart-8)" }} />
                  <Typography variant="subtitle1" fontWeight={600} color="var(--fg-strong)">
                    {t('ai_prioridad', 'Solicitudes priorizadas')}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ p: 2.5, maxHeight: 380, overflowY: "auto" }}>
                {solicitudesPriorizadas.length === 0 ? (
                  <Box sx={{ textAlign: "center", py: 6 }}>
                    <PsychologyIcon sx={{ fontSize: 48, color: "var(--purple-light)", mb: 1.5 }} />
                    <Typography variant="body2" color="text.secondary">
                      {t('ai_no_solicitudes', 'Sin solicitudes pendientes')}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {solicitudesPriorizadas.map((sol, idx) => (
                      <Paper
                        key={sol.id || idx}
                        elevation={0}
                        sx={{ p: 2, bgcolor: "var(--bg)", border: "1px solid var(--border)" }}
                      >
                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                              <Typography variant="body2" fontWeight={600} color="var(--fg-strong)">
                                #{sol.id}
                              </Typography>
                              {sol.criticidad && (
                                <Chip
                                  label={nivelLabel(sol.criticidad)}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: "0.65rem",
                                    bgcolor: sol.criticidad === 'alta' ? 'var(--danger-bg)' : sol.criticidad === 'media' ? 'var(--warning-bg)' : 'var(--bg-soft)',
                                    color: sol.criticidad === 'alta' ? 'var(--danger-text)' : sol.criticidad === 'media' ? 'var(--warning-text)' : 'var(--fg-muted)'
                                  }}
                                />
                              )}
                            </Box>
                            {sol.razon && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {sol.razon}
                              </Typography>
                            )}
                            {sol.recomendacion && (
                              <Typography variant="caption" color="var(--primary)" fontWeight={500} display="block" sx={{ mt: 0.5 }}>
                                {sol.recomendacion}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ textAlign: "right", ml: 2 }}>
                            {sol.score !== undefined && (
                              <Typography variant="h6" fontWeight={700} sx={{ color: getScoreColor(sol.score) }}>
                                {Math.round(sol.score * 100)}%
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">{t('ai_puntaje', 'Puntaje')}</Typography>
                          </Box>
                        </Box>
                        {sol.score !== undefined && (
                          <LinearProgress
                            variant="determinate"
                            value={sol.score * 100}
                            sx={{
                              mt: 1.5,
                              height: 4,
                              borderRadius: 2,
                              bgcolor: "var(--border)",
                              "& .MuiLinearProgress-bar": {
                                bgcolor: getScoreColor(sol.score),
                                borderRadius: 2
                              }
                            }}
                          />
                        )}
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Alertas Inteligentes */}
            <Paper elevation={0} sx={{ border: "1px solid var(--border)" }}>
              <Box sx={{ p: 2.5, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <WarningAmberIcon sx={{ color: "var(--warning-light)" }} />
                  <Typography variant="subtitle1" fontWeight={600} color="var(--fg-strong)">
                    {t('ai_alertas', 'Alertas inteligentes')}
                  </Typography>
                </Box>
                {alertasIA.length > 0 && (
                  <Chip label={alertasIA.length} size="small" color="warning" />
                )}
              </Box>
              <Box sx={{ p: 2.5, maxHeight: 380, overflowY: "auto" }}>
                {alertasIA.length === 0 ? (
                  <Box sx={{ textAlign: "center", py: 6 }}>
                    <CheckCircleIcon sx={{ fontSize: 48, color: "var(--success-light)", mb: 1.5 }} />
                    <Typography variant="body2" color="text.secondary">
                      {t('ai_no_alertas', 'Sin alertas detectadas')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      {t('ai_alertas_hint', 'Los modelos ML analizan patrones automáticamente')}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {alertasIA.map((alerta, idx) => {
                      const severity = alerta.severidad || alerta.severity || 'info'
                      const isHigh = severity === 'alta' || severity === 'high'
                      const isMedium = severity === 'media' || severity === 'medium'
                      return (
                        <Paper
                          key={alerta.id || idx}
                          elevation={0}
                          sx={{
                            p: 2,
                            bgcolor: isHigh ? 'var(--danger-bg)' : isMedium ? 'var(--warning-bg)' : 'var(--info-bg)',
                            border: `1px solid ${isHigh ? 'var(--danger-border)' : isMedium ? 'var(--warning-border)' : 'var(--info-border)'}`
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                            <WarningAmberIcon
                              sx={{
                                fontSize: 18,
                                mt: 0.25,
                                color: isHigh ? 'var(--danger)' : isMedium ? 'var(--warning-light)' : 'var(--primary)'
                              }}
                            />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" fontWeight={500} color="var(--fg-strong)">
                                {alerta.titulo || alerta.title || alerta.mensaje || alerta.message}
                              </Typography>
                              {(alerta.descripcion || alerta.description) && (
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                  {alerta.descripcion || alerta.description}
                                </Typography>
                              )}
                              {(alerta.recomendacion || alerta.recommendation) && (
                                <Typography variant="caption" color="var(--primary)" fontWeight={500} display="block" sx={{ mt: 0.5 }}>
                                  {alerta.recomendacion || alerta.recommendation}
                                </Typography>
                              )}
                            </Box>
                            <Chip
                              label={nivelLabel(severity)}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: "0.65rem",
                                bgcolor: isHigh ? 'var(--danger-bg)' : isMedium ? 'var(--warning-bg)' : 'var(--info-bg)',
                                color: isHigh ? 'var(--danger-text)' : isMedium ? 'var(--warning-text)' : 'var(--info-text)'
                              }}
                            />
                          </Box>
                        </Paper>
                      )
                    })}
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>
        </>
      )}

      {/* ======================= TAB: SLA ======================= */}
      {activeTab === 1 && (
        <>
          {/* Metricas SLA principales */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
            <MetricCard
              size="lg"
              icon={AccessTimeIcon}
              label={t('sla_total', 'Total de solicitudes')}
              value={formatNumber(metricasSLA?.total_solicitudes || 0)}
              variant="primary"
            />
            <MetricCard
              size="lg"
              icon={CheckCircleIcon}
              label={t('sla_on_time', 'A tiempo')}
              value={formatNumber(metricasSLA?.on_time || 0)}
              variant="success"
            />
            <MetricCard
              size="lg"
              icon={WarningAmberIcon}
              label={t('sla_warning', 'En riesgo')}
              value={formatNumber(metricasSLA?.warning || 0)}
              variant="warning"
              active={metricasSLA?.warning > 0}
            />
            <MetricCard
              size="lg"
              icon={CancelIcon}
              label={t('sla_breach', 'Incumplidas')}
              value={formatNumber(metricasSLA?.breach || 0)}
              variant="danger"
              active={metricasSLA?.breach > 0}
            />
          </Box>

          {/* Graficos SLA */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3 }}>
            {/* Cumplimiento general */}
            <Paper elevation={0} sx={{ border: "1px solid var(--border)" }}>
              <Box sx={{ p: 2.5, borderBottom: "1px solid var(--border)" }}>
                <Typography variant="subtitle1" fontWeight={600} color="var(--fg-strong)">
                  {t('sla_cumplimiento_general', 'Cumplimiento general')}
                </Typography>
              </Box>
              <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
                <ProgressCircle
                  percentage={Math.round(metricasSLA?.porcentaje_cumplimiento || 0)}
                  size={160}
                  color={getCumplimientoColor(metricasSLA?.porcentaje_cumplimiento || 0)}
                  label={t('sla_cumplimiento', 'Cumplimiento')}
                />
              </Box>
              <Box sx={{ px: 2.5, pb: 2.5, textAlign: "center" }}>
                <Typography variant="caption" color="text.secondary">
                  {t('sla_periodo', 'Período')}: {t('sla_ultimos', 'Últimos')} {periodoDias} {t('sla_dias', 'días')}
                </Typography>
              </Box>
            </Paper>

            {/* Por criticidad */}
            <Paper elevation={0} sx={{ border: "1px solid var(--border)" }}>
              <Box sx={{ p: 2.5, borderBottom: "1px solid var(--border)" }}>
                <Typography variant="subtitle1" fontWeight={600} color="var(--fg-strong)">
                  {t('sla_por_criticidad', 'Por criticidad')}
                </Typography>
              </Box>
              <Box sx={{ p: 2.5 }}>
                {metricasSLA?.por_criticidad?.length > 0 ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {metricasSLA.por_criticidad.map((item, idx) => (
                      <Box key={idx} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Chip
                            label={nivelLabel(item.criticidad)}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: "0.7rem",
                              bgcolor: item.criticidad === 'alta' ? 'var(--danger-bg)' : item.criticidad === 'media' ? 'var(--warning-bg)' : 'var(--bg-soft)',
                              color: item.criticidad === 'alta' ? 'var(--danger-text)' : item.criticidad === 'media' ? 'var(--warning-text)' : 'var(--fg-muted)'
                            }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {item.total} {t('sla_solicitudes', 'solicitudes')}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Typography variant="body2" fontWeight={500} color="var(--success)">
                            {item.on_time} {t('sla_a_tiempo_corto', 'a tiempo')}
                          </Typography>
                          {item.breach > 0 && (
                            <Typography variant="body2" fontWeight={500} color="var(--danger)">
                              {item.breach} {t('sla_incumplidas_corto', 'incumplidas')}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ textAlign: "center", py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('sla_no_data', 'Sin datos de criticidad')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>

          {/* Alertas SLA activas */}
          <Paper elevation={0} sx={{ border: "1px solid var(--border)" }}>
            <Box sx={{ p: 2.5, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <WarningAmberIcon sx={{ color: "var(--warning-light)" }} />
                <Typography variant="subtitle1" fontWeight={600} color="var(--fg-strong)">
                  {t('sla_alertas_activas', 'Alertas SLA activas')}
                </Typography>
                {alertasSLA.length > 0 && (
                  <Chip label={alertasSLA.length} size="small" color="error" />
                )}
              </Box>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={tipoFiltroSLA}
                  onChange={(e) => setTipoFiltroSLA(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">{t('sla_todos', 'Todos')}</MenuItem>
                  <MenuItem value="warning">{tipoAlertaLabel('warning')}</MenuItem>
                  <MenuItem value="breach">{tipoAlertaLabel('breach')}</MenuItem>
                  <MenuItem value="escalated">{tipoAlertaLabel('escalated')}</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ p: 2.5, maxHeight: 350, overflowY: "auto" }}>
              {alertasSLA.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <CheckCircleIcon sx={{ fontSize: 48, color: "var(--success-light)", mb: 1.5 }} />
                  <Typography variant="body2" color="text.secondary">
                    {t('sla_sin_alertas', 'No hay alertas activas')}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {alertasSLA.map((alerta) => {
                    const colors = ALERT_COLORS[alerta.tipo] || ALERT_COLORS.warning
                    return (
                      <Paper
                        key={alerta.id}
                        elevation={0}
                        sx={{
                          p: 2,
                          bgcolor: colors.bg,
                          border: `1px solid ${colors.border}`
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                              <Chip
                                label={tipoAlertaLabel(alerta.tipo)}
                                size="small"
                                color={colors.chip}
                                sx={{ height: 20, fontSize: "0.65rem" }}
                              />
                              <Typography variant="body2" fontWeight={500} color="var(--fg-strong)">
                                {t('sla_solicitud', 'Solicitud')} #{alerta.solicitud_id}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: colors.text }}>
                              {alerta.mensaje || t('sla_alerta_default', 'Alerta de SLA activa')}
                            </Typography>
                            {alerta.tiempo_transcurrido_horas && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                                {t('sla_tiempo_transcurrido', 'Tiempo transcurrido')}:{' '}
                                {Math.round(alerta.tiempo_transcurrido_horas)}h /{' '}
                                {alerta.tiempo_objetivo_horas}h {t('sla_objetivo', 'objetivo')}
                              </Typography>
                            )}
                          </Box>
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => handleResolverAlertaSLA(alerta.id)}
                            startIcon={<CheckCircleIcon />}
                            sx={{ color: "var(--success)", ml: 2, whiteSpace: "nowrap" }}
                          >
                            {t('sla_resolver', 'Resolver')}
                          </Button>
                        </Box>
                      </Paper>
                    )
                  })}
                </Box>
              )}
            </Box>
          </Paper>
        </>
      )}

      {/* Info adicional */}
      <Paper elevation={0} sx={{ p: 2, border: "1px solid var(--border)" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PsychologyIcon sx={{ fontSize: 18, color: "var(--purple-dark)" }} />
            <Typography variant="caption" color="text.secondary">
              {t('ai_powered_by', 'Potenciado por aprendizaje automático')}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
            {metricasSLA?.total_solicitudes !== undefined && (
              <Typography variant="caption" color="text.secondary">
                SLA: {formatNumber(metricasSLA.total_solicitudes)} {t('sla_solicitudes', 'solicitudes')}
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>
    </PageLayout>
  )
}
