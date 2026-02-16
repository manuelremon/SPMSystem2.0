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
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../context/i18n'
import aiService from '../services/ai'
import slaService from '../services/sla'
import { useAuthStore } from '../store/authStore'

// Chart.js Components
import { SPMDoughnut } from '../components/ui/SPMChartJS'

// MUI Components
import Container from '@mui/material/Container'
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

// MUI Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
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

// Componente MetricCard MUI
const MetricCard = ({ icon: Icon, label, value, color = 'var(--primary)', highlight = false }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2.5,
      border: highlight ? `2px solid ${color}` : "1px solid var(--border)",
      borderRadius: 2,
      bgcolor: highlight ? `${color}08` : "var(--card)"
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Box sx={{
        p: 1.5,
        bgcolor: `${color}15`,
        borderRadius: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <Icon sx={{ fontSize: 24, color }} />
      </Box>
      <Box>
        <Typography variant="h5" fontWeight={700} color="var(--fg-strong)">
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Box>
  </Paper>
)

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
  const navigate = useNavigate()
  const { user } = useAuthStore()

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
  }, [centro, periodoDias, tipoFiltroSLA, t])

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
    } catch (err) {
    }
  }

  const getPipelineStatus = (pipelineStatus) => {
    if (!pipelineStatus) return { text: 'No disponible', color: 'var(--fg-subtle)' }
    if (pipelineStatus === 'fitted' || pipelineStatus === 'ready') {
      return { text: 'Listo', color: 'var(--success)' }
    }
    if (pipelineStatus === 'training') {
      return { text: 'Entrenando', color: 'var(--warning-light)' }
    }
    return { text: 'Pendiente', color: 'var(--fg-subtle)' }
  }

  if (isLoading) {
    return (
      <Container maxWidth={false} sx={{ py: 2, px: "75px" }}>
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="text" width={300} height={40} />
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, mb: 3 }}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
          <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 2 }} />
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth={false} sx={{ py: 2, px: "75px" }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: "var(--fg-muted)" }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('ai_dashboard', 'IA ANALYTICS')}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {activeTab === 1 && (
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel sx={{ fontSize: "0.75rem" }}>Período</InputLabel>
              <Select
                value={periodoDias}
                onChange={(e) => setPeriodoDias(Number(e.target.value))}
                label="Período"
                sx={{ fontSize: "0.75rem" }}
              >
                {PERIODOS.map(p => (
                  <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
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
              sx={{ color: isTraining ? undefined : "var(--warning-light)", borderColor: isTraining ? undefined : "var(--warning-light)" }}
            >
              {isTraining ? t('ai_training', 'Entrenando...') : t('ai_train', 'Entrenar')}
            </Button>
          )}

          <IconButton
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            size="small"
            sx={{ color: "var(--fg-muted)" }}
          >
            <RefreshIcon className={isRefreshing ? 'animate-spin' : ''} />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      {/* Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{
            minHeight: 44,
            bgcolor: "var(--card)",
            borderRadius: "8px 8px 0 0",
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
          <Tab label="ML & IA" disableRipple />
          <Tab label="SLA" disableRipple />
        </Tabs>
      </Box>

      {/* ======================= TAB: ML & IA ======================= */}
      {activeTab === 0 && (
        <>
          {/* Estado de Pipelines */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mb: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid var(--border)", borderRadius: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ p: 1.5, bgcolor: "var(--purple-bg-light)", borderRadius: 2 }}>
                  <PsychologyIcon sx={{ fontSize: 24, color: "var(--purple-dark)" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">{t('ai_clustering', 'Clustering')}</Typography>
                  <Typography variant="h6" fontWeight={600} sx={{ color: getPipelineStatus(status?.clustering?.status).color }}>
                    {getPipelineStatus(status?.clustering?.status).text}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid var(--border)", borderRadius: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ p: 1.5, bgcolor: "var(--warning-bg)", borderRadius: 2 }}>
                  <GpsFixedIcon sx={{ fontSize: 24, color: "var(--warning-light)" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">{t('ai_scoring', 'Scoring')}</Typography>
                  <Typography variant="h6" fontWeight={600} sx={{ color: getPipelineStatus(status?.scoring?.status).color }}>
                    {getPipelineStatus(status?.scoring?.status).text}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 2.5, border: "1px solid var(--border)", borderRadius: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ p: 1.5, bgcolor: "var(--success-bg)", borderRadius: 2 }}>
                  <TrendingUpIcon sx={{ fontSize: 24, color: "var(--success)" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">{t('ai_forecast', 'Forecast')}</Typography>
                  <Typography variant="h6" fontWeight={600} sx={{ color: getPipelineStatus(status?.forecast?.status).color }}>
                    {getPipelineStatus(status?.forecast?.status).text}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* Info de entrenamiento */}
          {status?.pipelines_trained && status?.last_training_date && (
            <Alert severity="info" icon={<AutoAwesomeIcon />} sx={{ mb: 3 }}>
              {t('ai_last_training', 'Último entrenamiento')}:{' '}
              {new Date(status.last_training_date).toLocaleString()}
            </Alert>
          )}

          {/* Contenido principal AI */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3 }}>
            {/* Solicitudes Priorizadas */}
            <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2 }}>
              <Box sx={{ p: 2.5, borderBottom: "1px solid var(--border)" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <BarChartIcon sx={{ color: "var(--chart-8)" }} />
                  <Typography variant="subtitle1" fontWeight={600} color="var(--fg-strong)">
                    {t('ai_prioridad', 'Solicitudes Priorizadas')}
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
                        sx={{ p: 2, bgcolor: "var(--bg)", border: "1px solid var(--border)", borderRadius: 1.5 }}
                      >
                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                              <Typography variant="body2" fontWeight={600} color="var(--fg-strong)">
                                #{sol.id}
                              </Typography>
                              {sol.criticidad && (
                                <Chip
                                  label={sol.criticidad}
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
                            <Typography variant="caption" color="text.secondary">Score</Typography>
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
            <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2 }}>
              <Box sx={{ p: 2.5, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <WarningAmberIcon sx={{ color: "var(--warning-light)" }} />
                  <Typography variant="subtitle1" fontWeight={600} color="var(--fg-strong)">
                    {t('ai_alertas', 'Alertas Inteligentes')}
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
                            border: `1px solid ${isHigh ? 'var(--danger-border)' : isMedium ? 'var(--warning-border)' : 'var(--info-border)'}`,
                            borderRadius: 1.5
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
                              label={severity}
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
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
            <MetricCard
              icon={AccessTimeIcon}
              label={t('sla_total', 'Total Solicitudes')}
              value={metricasSLA?.total_solicitudes || 0}
              color="var(--primary)"
            />
            <MetricCard
              icon={CheckCircleIcon}
              label={t('sla_on_time', 'A Tiempo')}
              value={metricasSLA?.on_time || 0}
              color="var(--success)"
            />
            <MetricCard
              icon={WarningAmberIcon}
              label={t('sla_warning', 'En Riesgo')}
              value={metricasSLA?.warning || 0}
              color="var(--warning-light)"
              highlight={metricasSLA?.warning > 0}
            />
            <MetricCard
              icon={CancelIcon}
              label={t('sla_breach', 'Incumplidas')}
              value={metricasSLA?.breach || 0}
              color="var(--danger)"
              highlight={metricasSLA?.breach > 0}
            />
          </Box>

          {/* Graficos SLA */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, mb: 3 }}>
            {/* Cumplimiento general */}
            <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2 }}>
              <Box sx={{ p: 2.5, borderBottom: "1px solid var(--border)" }}>
                <Typography variant="subtitle1" fontWeight={600} color="var(--fg-strong)">
                  {t('sla_cumplimiento', 'Cumplimiento General')}
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
            <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2 }}>
              <Box sx={{ p: 2.5, borderBottom: "1px solid var(--border)" }}>
                <Typography variant="subtitle1" fontWeight={600} color="var(--fg-strong)">
                  {t('sla_por_criticidad', 'Por Criticidad')}
                </Typography>
              </Box>
              <Box sx={{ p: 2.5 }}>
                {metricasSLA?.por_criticidad?.length > 0 ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {metricasSLA.por_criticidad.map((item, idx) => (
                      <Box key={idx} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Chip
                            label={item.criticidad}
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
                            {item.on_time} OK
                          </Typography>
                          {item.breach > 0 && (
                            <Typography variant="body2" fontWeight={500} color="var(--danger)">
                              {item.breach} SLA
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
          <Paper elevation={0} sx={{ border: "1px solid var(--border)", borderRadius: 2 }}>
            <Box sx={{ p: 2.5, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <WarningAmberIcon sx={{ color: "var(--warning-light)" }} />
                <Typography variant="subtitle1" fontWeight={600} color="var(--fg-strong)">
                  {t('sla_alertas_activas', 'Alertas SLA Activas')}
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
                  sx={{ fontSize: "0.75rem" }}
                >
                  <MenuItem value="">{t('sla_todos', 'Todos')}</MenuItem>
                  <MenuItem value="warning">Warning</MenuItem>
                  <MenuItem value="breach">Breach</MenuItem>
                  <MenuItem value="escalated">Escalated</MenuItem>
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
                          border: `1px solid ${colors.border}`,
                          borderRadius: 1.5
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                              <Chip
                                label={alerta.tipo?.toUpperCase()}
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
      <Paper elevation={0} sx={{ mt: 3, p: 2, border: "1px solid var(--border)", borderRadius: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PsychologyIcon sx={{ fontSize: 18, color: "var(--purple-dark)" }} />
            <Typography variant="caption" color="text.secondary">
              {t('ai_powered_by', 'Potenciado por ML')}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
            {status?.cache_size !== undefined && (
              <Typography variant="caption" color="text.secondary">
                Cache: {status.cache_size} {t('ai_items', 'items')}
              </Typography>
            )}
            {metricasSLA?.total_solicitudes !== undefined && (
              <Typography variant="caption" color="text.secondary">
                SLA: {metricasSLA.total_solicitudes} solicitudes
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>
    </Container>
  )
}
