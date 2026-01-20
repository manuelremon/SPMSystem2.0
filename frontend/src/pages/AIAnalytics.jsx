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
import {
  Brain,
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  Zap,
  Target,
  BarChart3,
  Clock,
  XCircle,
  AlertTriangle,
  Filter
} from '../components/ui/Icons'
import { useI18n } from '../context/i18n'
import aiService from '../services/ai'
import slaService from '../services/sla'
import { useAuthStore } from '../store/authStore'
import { MetricCard } from '../components/ui/MetricCard'
import { ProgressCircle, ProgressBar, MiniBarChart } from '../components/ui/Charts'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { Alert } from '../components/ui/Alert'

// Colores por score de prioridad
const getScoreColor = (score) => {
  if (score >= 0.8) return 'text-red-600'
  if (score >= 0.5) return 'text-amber-600'
  return 'text-emerald-600'
}

// Colores por tipo de alerta SLA
const ALERT_COLORS = {
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'warning' },
  breach: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'danger' },
  escalated: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'info' }
}

// Periodos disponibles para SLA
const PERIODOS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' }
]

// Color del porcentaje de cumplimiento
const getCumplimientoColor = (porcentaje) => {
  if (porcentaje >= 90) return '#10B981' // green
  if (porcentaje >= 70) return '#F59E0B' // amber
  return '#EF4444' // red
}

export default function AIAnalytics() {
  const { t } = useI18n()
  const { user } = useAuthStore()

  // Estado AI
  const [status, setStatus] = useState(null)
  const [solicitudesPriorizadas, setSolicitudesPriorizadas] = useState([])
  const [alertasIA, setAlertasIA] = useState([])

  // Estado SLA
  const [metricasSLA, setMetricasSLA] = useState(null)
  const [alertasSLA, setAlertasSLA] = useState([])
  const [periodoDias, setPeriodoDias] = useState(30)
  const [tipoFiltroSLA, setTipoFiltroSLA] = useState(null)

  // Estado general
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isTraining, setIsTraining] = useState(false)

  // Tab activa (ai o sla)
  const [activeTab, setActiveTab] = useState('ai')

  // Centro del usuario
  const centro = user?.centro || '1000'

  // Cargar datos
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      // Cargar AI y SLA en paralelo
      const [statusData, solicitudesData, alertasIAData, metricasSLAData, alertasSLAData] = await Promise.all([
        aiService.getStatus().catch(() => null),
        aiService.priorizarSolicitudes({ limit: 10 }).catch(() => []),
        aiService.getAlertasInteligentes(centro).catch(() => []),
        slaService.getMetricas({ periodoDias, porCriticidad: true }).catch(() => null),
        slaService.getAlertas({ tipo: tipoFiltroSLA }).catch(() => [])
      ])

      setStatus(statusData)
      setSolicitudesPriorizadas(solicitudesData)
      setAlertasIA(alertasIAData)
      setMetricasSLA(metricasSLAData)
      setAlertasSLA(alertasSLAData)
      setError(null)
    } catch (err) {
      console.error('Error loading data:', err)
      setError(t('ai_error_loading', 'Error al cargar datos'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [centro, periodoDias, tipoFiltroSLA, t])

  // Cargar al montar
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh cada 60 segundos
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Entrenar modelos
  const handleTrain = async () => {
    setIsTraining(true)
    try {
      await aiService.trainModels({ force: true })
      await fetchData(true)
    } catch (err) {
      console.error('Error training models:', err)
      setError(t('ai_train_error', 'Error al entrenar modelos'))
    } finally {
      setIsTraining(false)
    }
  }

  // Resolver alerta SLA
  const handleResolverAlertaSLA = async (alertaId) => {
    try {
      await slaService.resolverAlerta(alertaId)
      setAlertasSLA(prev => prev.filter(a => a.id !== alertaId))
    } catch (err) {
      console.error('Error resolving alert:', err)
    }
  }

  // Estado del pipeline como texto
  const getPipelineStatus = (pipelineStatus) => {
    if (!pipelineStatus) return { text: 'No disponible', variant: 'default' }
    if (pipelineStatus === 'fitted' || pipelineStatus === 'ready') {
      return { text: 'Listo', variant: 'success' }
    }
    if (pipelineStatus === 'training') {
      return { text: 'Entrenando', variant: 'warning' }
    }
    return { text: 'Pendiente', variant: 'default' }
  }

  // Datos para grafico SLA por criticidad
  const chartDataSLA = metricasSLA?.por_criticidad?.map(c => c.on_time) || []

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('ai_dashboard', 'IA Analytics')}
          subtitle={t('ai_subtitle', 'Inteligencia artificial, ML y metricas SLA')}
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title={t('ai_dashboard', 'IA Analytics')}
          subtitle={t('ai_subtitle', 'Inteligencia artificial, ML y metricas SLA')}
        />

        <div className="flex items-center gap-3">
          {/* Selector de periodo SLA */}
          {activeTab === 'sla' && (
            <div className="relative">
              <select
                value={periodoDias}
                onChange={(e) => setPeriodoDias(Number(e.target.value))}
                className="appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PERIODOS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          )}

          {/* Boton entrenar (solo admin/planner) */}
          {(user?.rol === 'admin' || user?.rol === 'planificador' || user?.rol === 'administrador') && activeTab === 'ai' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTrain}
              disabled={isTraining}
            >
              {isTraining ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {t('ai_training', 'Entrenando...')}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2 text-amber-500" />
                  {t('ai_train', 'Entrenar')}
                </>
              )}
            </Button>
          )}

          {/* Boton refresh */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">{error}</Alert>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'ai'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Brain className="w-4 h-4 inline mr-2" />
          ML & IA
        </button>
        <button
          onClick={() => setActiveTab('sla')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'sla'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          SLA
        </button>
      </div>

      {/* ======================= TAB: ML & IA ======================= */}
      {activeTab === 'ai' && (
        <>
          {/* Estado de Pipelines */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              icon={Brain}
              label={t('ai_clustering', 'Clustering')}
              value={getPipelineStatus(status?.clustering?.status).text}
              variant={getPipelineStatus(status?.clustering?.status).variant === 'success' ? 'success' : 'default'}
            />
            <MetricCard
              icon={Target}
              label={t('ai_scoring', 'Scoring')}
              value={getPipelineStatus(status?.scoring?.status).text}
              variant={getPipelineStatus(status?.scoring?.status).variant === 'success' ? 'success' : 'default'}
            />
            <MetricCard
              icon={TrendingUp}
              label={t('ai_forecast', 'Forecast')}
              value={getPipelineStatus(status?.forecast?.status).text}
              variant={getPipelineStatus(status?.forecast?.status).variant === 'success' ? 'success' : 'default'}
            />
          </div>

          {/* Info de entrenamiento */}
          {status?.pipelines_trained && status?.last_training_date && (
            <Alert variant="info" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              {t('ai_last_training', 'Ultimo entrenamiento')}:{' '}
              {new Date(status.last_training_date).toLocaleString()}
            </Alert>
          )}

          {/* Contenido principal AI */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Solicitudes Priorizadas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-pink-500" />
                  {t('ai_prioridad', 'Solicitudes Priorizadas')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {solicitudesPriorizadas.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Brain className="w-12 h-12 mx-auto mb-3 text-purple-300" />
                    <p>{t('ai_no_solicitudes', 'Sin solicitudes pendientes')}</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {solicitudesPriorizadas.map((sol, idx) => (
                      <div
                        key={sol.id || idx}
                        className="p-3 bg-slate-50 rounded-lg border border-slate-100"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-slate-700">
                                #{sol.id}
                              </span>
                              {sol.criticidad && (
                                <Badge variant={
                                  sol.criticidad === 'alta' ? 'danger' :
                                  sol.criticidad === 'media' ? 'warning' : 'default'
                                }>
                                  {sol.criticidad}
                                </Badge>
                              )}
                            </div>
                            {sol.razon && (
                              <p className="text-xs text-slate-500 mt-1">
                                {sol.razon}
                              </p>
                            )}
                            {sol.recomendacion && (
                              <p className="text-xs text-blue-600 mt-1 font-medium">
                                {sol.recomendacion}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {sol.score !== undefined && (
                              <div className={`text-lg font-bold ${getScoreColor(sol.score)}`}>
                                {Math.round(sol.score * 100)}%
                              </div>
                            )}
                            <span className="text-xs text-slate-400">
                              {t('ai_score', 'Score')}
                            </span>
                          </div>
                        </div>
                        {sol.score !== undefined && (
                          <div className="mt-2">
                            <ProgressBar
                              value={sol.score * 100}
                              max={100}
                              height={4}
                              color={sol.score >= 0.8 ? '#EF4444' : sol.score >= 0.5 ? '#F59E0B' : '#10B981'}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alertas Inteligentes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  {t('ai_alertas', 'Alertas Inteligentes')}
                  {alertasIA.length > 0 && (
                    <Badge variant="warning">{alertasIA.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {alertasIA.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
                    <p>{t('ai_no_alertas', 'Sin alertas detectadas')}</p>
                    <p className="text-xs mt-1 text-slate-400">
                      {t('ai_alertas_hint', 'Los modelos ML analizan patrones automaticamente')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {alertasIA.map((alerta, idx) => (
                      <div
                        key={alerta.id || idx}
                        className={`p-3 rounded-lg border ${
                          alerta.severidad === 'alta' || alerta.severity === 'high'
                            ? 'bg-red-50 border-red-200'
                            : alerta.severidad === 'media' || alerta.severity === 'medium'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            alerta.severidad === 'alta' || alerta.severity === 'high'
                              ? 'text-red-500'
                              : alerta.severidad === 'media' || alerta.severity === 'medium'
                              ? 'text-amber-500'
                              : 'text-blue-500'
                          }`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-700">
                              {alerta.titulo || alerta.title || alerta.mensaje || alerta.message}
                            </p>
                            {(alerta.descripcion || alerta.description) && (
                              <p className="text-xs text-slate-500 mt-1">
                                {alerta.descripcion || alerta.description}
                              </p>
                            )}
                            {(alerta.recomendacion || alerta.recommendation) && (
                              <p className="text-xs text-blue-600 mt-1 font-medium">
                                {alerta.recomendacion || alerta.recommendation}
                              </p>
                            )}
                          </div>
                          <Badge variant={
                            alerta.severidad === 'alta' || alerta.severity === 'high' ? 'danger' :
                            alerta.severidad === 'media' || alerta.severity === 'medium' ? 'warning' : 'info'
                          }>
                            {alerta.severidad || alerta.severity || 'info'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ======================= TAB: SLA ======================= */}
      {activeTab === 'sla' && (
        <>
          {/* Metricas SLA principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Clock}
              label={t('sla_total', 'Total Solicitudes')}
              value={metricasSLA?.total_solicitudes || 0}
              variant="primary"
            />
            <MetricCard
              icon={CheckCircle}
              label={t('sla_on_time', 'A Tiempo')}
              value={metricasSLA?.on_time || 0}
              variant="success"
            />
            <MetricCard
              icon={AlertTriangle}
              label={t('sla_warning', 'En Riesgo')}
              value={metricasSLA?.warning || 0}
              variant="warning"
              highlight={metricasSLA?.warning > 0}
            />
            <MetricCard
              icon={XCircle}
              label={t('sla_breach', 'Incumplidas')}
              value={metricasSLA?.breach || 0}
              variant="danger"
              highlight={metricasSLA?.breach > 0}
            />
          </div>

          {/* Graficos SLA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cumplimiento general */}
            <Card>
              <CardHeader>
                <CardTitle>{t('sla_cumplimiento', 'Cumplimiento General')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-4">
                  <ProgressCircle
                    percentage={Math.round(metricasSLA?.porcentaje_cumplimiento || 0)}
                    size={160}
                    strokeWidth={12}
                    color={getCumplimientoColor(metricasSLA?.porcentaje_cumplimiento || 0)}
                    label={t('sla_cumplimiento', 'Cumplimiento')}
                  />
                </div>
                <div className="mt-4 text-center text-sm text-slate-500">
                  {t('sla_periodo', 'Periodo')}: {t('sla_ultimos', 'Ultimos')} {periodoDias} {t('sla_dias', 'dias')}
                </div>
              </CardContent>
            </Card>

            {/* Por criticidad */}
            <Card>
              <CardHeader>
                <CardTitle>{t('sla_por_criticidad', 'Por Criticidad')}</CardTitle>
              </CardHeader>
              <CardContent>
                {metricasSLA?.por_criticidad?.length > 0 ? (
                  <div className="space-y-4">
                    {metricasSLA.por_criticidad.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant={
                            item.criticidad === 'alta' ? 'danger' :
                            item.criticidad === 'media' ? 'warning' : 'default'
                          }>
                            {item.criticidad}
                          </Badge>
                          <span className="text-sm text-slate-600">
                            {item.total} {t('sla_solicitudes', 'solicitudes')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-emerald-600">
                            {item.on_time} {t('sla_on_time_short', 'OK')}
                          </span>
                          {item.breach > 0 && (
                            <span className="text-sm font-medium text-red-600">
                              {item.breach} {t('sla_breach_short', 'SLA')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Mini chart */}
                    {chartDataSLA.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-500 mb-2">{t('sla_chart_label', 'A tiempo por criticidad')}</p>
                        <MiniBarChart data={chartDataSLA} color="#10B981" height={48} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-8">
                    {t('sla_no_data', 'Sin datos de criticidad')}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alertas SLA activas */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  {t('sla_alertas_activas', 'Alertas SLA Activas')}
                  {alertasSLA.length > 0 && (
                    <Badge variant="danger">{alertasSLA.length}</Badge>
                  )}
                </CardTitle>

                {/* Filtro de tipo */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    value={tipoFiltroSLA || ''}
                    onChange={(e) => setTipoFiltroSLA(e.target.value || null)}
                    className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('sla_todos', 'Todos')}</option>
                    <option value="warning">Warning</option>
                    <option value="breach">Breach</option>
                    <option value="escalated">Escalated</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {alertasSLA.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
                  <p>{t('sla_sin_alertas', 'No hay alertas activas')}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {alertasSLA.map((alerta) => {
                    const colors = ALERT_COLORS[alerta.tipo] || ALERT_COLORS.warning
                    return (
                      <div
                        key={alerta.id}
                        className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={colors.badge}>
                                {alerta.tipo?.toUpperCase()}
                              </Badge>
                              <span className="text-sm font-medium text-slate-700">
                                {t('sla_solicitud', 'Solicitud')} #{alerta.solicitud_id}
                              </span>
                            </div>
                            <p className={`text-sm ${colors.text}`}>
                              {alerta.mensaje || t('sla_alerta_default', 'Alerta de SLA activa')}
                            </p>
                            {alerta.tiempo_transcurrido_horas && (
                              <p className="text-xs text-slate-500 mt-1">
                                {t('sla_tiempo_transcurrido', 'Tiempo transcurrido')}:{' '}
                                {Math.round(alerta.tiempo_transcurrido_horas)}h /{' '}
                                {alerta.tiempo_objetivo_horas}h {t('sla_objetivo', 'objetivo')}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResolverAlertaSLA(alerta.id)}
                            className="text-slate-600 hover:text-emerald-600"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            {t('sla_resolver', 'Resolver')}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Info adicional */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-500" />
              <span>{t('ai_powered_by', 'Potenciado por ML')}</span>
            </div>
            <div className="flex items-center gap-4">
              {status?.cache_size !== undefined && (
                <span>Cache: {status.cache_size} {t('ai_items', 'items')}</span>
              )}
              {metricasSLA?.total_solicitudes !== undefined && (
                <span>SLA: {metricasSLA.total_solicitudes} solicitudes</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
