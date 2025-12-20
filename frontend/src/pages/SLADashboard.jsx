/**
 * SLA Dashboard - Metricas de cumplimiento y alertas
 *
 * Features:
 * - Metricas de cumplimiento (on-time, warning, breach)
 * - Alertas activas con acciones
 * - Filtros por periodo y criticidad
 * - Auto-refresh
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle,
  RefreshCw,
  Filter,
  ChevronDown
} from '../components/ui/Icons'
import { useI18n } from '../context/i18n'
import slaService from '../services/sla'
import { MetricCard } from '../components/ui/MetricCard'
import { ProgressCircle, MiniBarChart } from '../components/ui/Charts'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { Alert } from '../components/ui/Alert'

// Colores por tipo de alerta
const ALERT_COLORS = {
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'warning' },
  breach: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'danger' },
  escalated: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'info' }
}

// Periodos disponibles
const PERIODOS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' }
]

export default function SLADashboard() {
  const { t } = useI18n()

  // Estado
  const [metricas, setMetricas] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [periodoDias, setPeriodoDias] = useState(30)
  const [tipoFiltro, setTipoFiltro] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Cargar datos
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true)
    else setIsLoading(true)

    try {
      const [metricasData, alertasData] = await Promise.all([
        slaService.getMetricas({ periodoDias, porCriticidad: true }),
        slaService.getAlertas({ tipo: tipoFiltro })
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

  // Color del porcentaje de cumplimiento
  const getCumplimientoColor = (porcentaje) => {
    if (porcentaje >= 90) return '#10B981' // green
    if (porcentaje >= 70) return '#F59E0B' // amber
    return '#EF4444' // red
  }

  // Datos para grafico de barras por criticidad
  const chartData = metricas?.por_criticidad?.map(c => c.on_time) || []
  const chartLabels = metricas?.por_criticidad?.map(c => c.criticidad) || []

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('sla_dashboard', 'Dashboard SLA')}
          subtitle={t('sla_subtitle', 'Metricas de cumplimiento de niveles de servicio')}
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title={t('sla_dashboard', 'Dashboard SLA')}
          subtitle={t('sla_subtitle', 'Metricas de cumplimiento de niveles de servicio')}
        />

        <div className="flex items-center gap-3">
          {/* Selector de periodo */}
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

      {/* Metricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Clock}
          label={t('sla_total', 'Total Solicitudes')}
          value={metricas?.total_solicitudes || 0}
          variant="primary"
        />
        <MetricCard
          icon={CheckCircle}
          label={t('sla_on_time', 'A Tiempo')}
          value={metricas?.on_time || 0}
          variant="success"
        />
        <MetricCard
          icon={AlertTriangle}
          label={t('sla_warning', 'En Riesgo')}
          value={metricas?.warning || 0}
          variant="warning"
          highlight={metricas?.warning > 0}
        />
        <MetricCard
          icon={XCircle}
          label={t('sla_breach', 'Incumplidas')}
          value={metricas?.breach || 0}
          variant="danger"
          highlight={metricas?.breach > 0}
        />
      </div>

      {/* Fila de graficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumplimiento general */}
        <Card>
          <CardHeader>
            <CardTitle>{t('sla_cumplimiento', 'Cumplimiento General')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <ProgressCircle
                percentage={Math.round(metricas?.porcentaje_cumplimiento || 0)}
                size={160}
                strokeWidth={12}
                color={getCumplimientoColor(metricas?.porcentaje_cumplimiento || 0)}
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
            {metricas?.por_criticidad?.length > 0 ? (
              <div className="space-y-4">
                {metricas.por_criticidad.map((item, idx) => (
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
                {chartData.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-2">{t('sla_chart_label', 'A tiempo por criticidad')}</p>
                    <MiniBarChart data={chartData} color="#10B981" height={48} />
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

      {/* Alertas activas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t('sla_alertas_activas', 'Alertas Activas')}
              {alertas.length > 0 && (
                <Badge variant="danger">{alertas.length}</Badge>
              )}
            </CardTitle>

            {/* Filtro de tipo */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={tipoFiltro || ''}
                onChange={(e) => setTipoFiltro(e.target.value || null)}
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
          {alertas.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
              <p>{t('sla_sin_alertas', 'No hay alertas activas')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alertas.map((alerta) => {
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
                        onClick={() => handleResolverAlerta(alerta.id)}
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
    </div>
  )
}
