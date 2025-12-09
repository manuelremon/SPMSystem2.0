/**
 * AI Analytics Dashboard - Inteligencia Artificial y ML
 *
 * Features:
 * - Estado de pipelines ML
 * - Solicitudes priorizadas por IA
 * - Alertas inteligentes
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
  BarChart3
} from 'lucide-react'
import { useI18n } from '../context/i18n'
import aiService from '../services/ai'
import { useAuthStore } from '../store/authStore'
import { MetricCard } from '../components/ui/MetricCard'
import { ProgressCircle, ProgressBar } from '../components/ui/Charts'
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

const getScoreBadge = (score) => {
  if (score >= 0.8) return 'danger'
  if (score >= 0.5) return 'warning'
  return 'success'
}

export default function AIAnalytics() {
  const { t } = useI18n()
  const { user } = useAuthStore()

  // Estado
  const [status, setStatus] = useState(null)
  const [solicitudesPriorizadas, setSolicitudesPriorizadas] = useState([])
  const [alertas, setAlertas] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isTraining, setIsTraining] = useState(false)

  // Centro del usuario
  const centro = user?.centro || '1000'

  // Cargar datos
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const [statusData, solicitudesData, alertasData] = await Promise.all([
        aiService.getStatus(),
        aiService.priorizarSolicitudes({ limit: 10 }),
        aiService.getAlertasInteligentes(centro).catch(() => [])
      ])

      setStatus(statusData)
      setSolicitudesPriorizadas(solicitudesData)
      setAlertas(alertasData)
      setError(null)
    } catch (err) {
      console.error('Error loading AI data:', err)
      setError(t('ai_error_loading', 'Error al cargar datos de IA'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [centro, t])

  // Cargar al montar
  useEffect(() => {
    fetchData()
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('ai_dashboard', 'Analytics IA')}
          subtitle={t('ai_subtitle', 'Inteligencia artificial y aprendizaje automatico')}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
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
          title={t('ai_dashboard', 'Analytics IA')}
          subtitle={t('ai_subtitle', 'Inteligencia artificial y aprendizaje automatico')}
        />

        <div className="flex items-center gap-3">
          {/* Boton entrenar (solo admin/planner) */}
          {(user?.rol === 'admin' || user?.rol === 'planificador') && (
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
                  <Zap className="w-4 h-4 mr-2" />
                  {t('ai_train', 'Entrenar Modelos')}
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
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">{error}</Alert>
      )}

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
          <Sparkles className="w-4 h-4" />
          {t('ai_last_training', 'Ultimo entrenamiento')}:{' '}
          {new Date(status.last_training_date).toLocaleString()}
        </Alert>
      )}

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Solicitudes Priorizadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              {t('ai_prioridad', 'Solicitudes Priorizadas')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {solicitudesPriorizadas.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Brain className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>{t('ai_no_solicitudes', 'Sin solicitudes pendientes')}</p>
              </div>
            ) : (
              <div className="space-y-3">
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
              {alertas.length > 0 && (
                <Badge variant="warning">{alertas.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alertas.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                <p>{t('ai_no_alertas', 'Sin alertas detectadas')}</p>
                <p className="text-xs mt-1 text-slate-400">
                  {t('ai_alertas_hint', 'Los modelos ML analizan patrones automaticamente')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {alertas.map((alerta, idx) => (
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

      {/* Info adicional */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span>{t('ai_powered_by', 'Potenciado por ML')}</span>
            </div>
            <div>
              {status?.cache_size !== undefined && (
                <span>Cache: {status.cache_size} {t('ai_items', 'items')}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
