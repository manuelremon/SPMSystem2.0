/**
 * Admin Estado - Dashboard de estado del sistema
 *
 * Features:
 * - Panel de salud con status de BDs
 * - Metricas de requests HTTP
 * - Cache performance
 * - Controles del sistema
 */

import { useEffect, useState, useCallback } from 'react'
import { system, admin } from '../../services/spm'
import metricsService from '../../services/metrics'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { MetricCard } from '../../components/ui/MetricCard'
import { ProgressCircle, ProgressBar } from '../../components/ui/Charts'
import {
  Activity,
  Database,
  HardDrive,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Server,
  Cpu,
  Download,
  Pause,
  Play,
  BarChart3,
  Users,
  Package,
  FileText,
  TrendingUp,
  GitCompare,
  Boxes
} from '../../components/ui/Icons'
import { useI18n } from '../../context/i18n'

// Umbrales de alertas
const THRESHOLDS = {
  latency: { good: 100, warning: 500 },
  errorRate: { good: 1, warning: 5 },
  cacheHit: { good: 90, warning: 70 }
}

function getVariant(value, metric) {
  const threshold = THRESHOLDS[metric]
  if (!threshold) return 'default'

  if (metric === 'cacheHit') {
    if (value >= threshold.good) return 'success'
    if (value >= threshold.warning) return 'warning'
    return 'danger'
  } else {
    if (value <= threshold.good) return 'success'
    if (value <= threshold.warning) return 'warning'
    return 'danger'
  }
}

function getColor(value, metric) {
  const threshold = THRESHOLDS[metric]
  if (!threshold) return '#64748B'

  if (metric === 'cacheHit') {
    if (value >= threshold.good) return '#10B981'
    if (value >= threshold.warning) return '#F59E0B'
    return '#EF4444'
  } else {
    if (value <= threshold.good) return '#10B981'
    if (value <= threshold.warning) return '#F59E0B'
    return '#EF4444'
  }
}

function StatusDot({ status }) {
  const colors = {
    connected: 'bg-emerald-500',
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    disconnected: 'bg-red-500'
  }
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status] || 'bg-slate-400'}`} />
  )
}

function formatUptime(seconds) {
  if (!seconds) return '--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h}h ${m}m ${s}s`
}

export default function AdminEstado() {
  const { t } = useI18n()
  const [health, setHealth] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [cacheMetrics, setCacheMetrics] = useState(null)
  const [dbMetrics, setDbMetrics] = useState(null)
  const [dbStats, setDbStats] = useState(null)
  const [systemMetrics, setSystemMetrics] = useState(null)
  const [businessMetrics, setBusinessMetrics] = useState(null)
  const [infrastructure, setInfrastructure] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [resetting, setResetting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setError('')
      const [healthRes, metricsRes, cacheRes, dbRes, dbStatsRes, sysRes, businessRes, infraRes] = await Promise.all([
        system.health().catch(() => ({ data: null })),
        system.metricsRequests().catch(() => ({ data: null })),
        system.metricsCache().catch(() => ({ data: null })),
        system.metricsDb().catch(() => ({ data: null })),
        system.metricsDbStats().catch(() => ({ data: null })),
        system.metricsSystem().catch(() => ({ data: null })),
        metricsService.getBusinessMetrics().catch(() => null),
        system.infrastructure().catch(() => ({ data: null }))
      ])

      setHealth(healthRes.data)
      setMetrics(metricsRes.data?.data)
      setCacheMetrics(cacheRes.data?.data)
      setDbMetrics(dbRes.data?.data)
      setDbStats(dbStatsRes.data?.data)
      setSystemMetrics(sysRes.data?.data)
      setBusinessMetrics(businessRes)
      setInfrastructure(infraRes.data)
      setLastUpdate(new Date())
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  const handleResetMetrics = async () => {
    if (!confirm(t('admin_confirm_reset', 'Reiniciar todas las metricas?'))) return
    setResetting(true)
    try {
      await system.resetMetrics()
      await fetchData()
    } catch (e) {
      setError(e.response?.data?.error || 'Error al reiniciar metricas')
    } finally {
      setResetting(false)
    }
  }

  const handleExport = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      health,
      metrics,
      cache: cacheMetrics,
      database: dbMetrics,
      system: systemMetrics,
      infrastructure
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `system-status-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const errorRate = metrics?.total_requests > 0
    ? (metrics.total_errors / metrics.total_requests * 100)
    : 0

  const overallCacheHit = cacheMetrics?.overall_hit_rate || 0

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('admin_estado', 'Estado del Sistema')}
          subtitle={t('admin_estado_subtitle', 'Monitoreo REAL TIME')}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title={t('admin_estado', 'Estado del Sistema')}
          subtitle={t('admin_estado_subtitle', 'Monitoreo REAL TIME')}
        />

        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-slate-500">
              {t('updated', 'Actualizado')}: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Panel de Estado General */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              {health?.status === 'healthy' ? t('system_healthy', 'Sistema Operativo') : t('system_degraded', 'Sistema Degradado')}
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-500" />
                Uptime: {formatUptime(health?.uptime_seconds)}
              </span>
              <Badge variant={health?.status === 'healthy' ? 'success' : 'warning'}>
                {health?.status || 'unknown'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* SPM Database */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <StatusDot status={health?.checks?.database?.spm?.status} />
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">SPM</p>
                <p className="text-sm font-semibold text-slate-800">
                  {health?.checks?.database?.spm?.latency_ms
                    ? `${health.checks.database.spm.latency_ms.toFixed(1)}ms`
                    : '--'}
                </p>
              </div>
            </div>

            {/* SAP Database */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <StatusDot status={health?.checks?.database?.sap_data?.status} />
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">SAP</p>
                <p className="text-sm font-semibold text-slate-800">
                  {health?.checks?.database?.sap_data?.latency_ms
                    ? `${health.checks.database.sap_data.latency_ms.toFixed(1)}ms`
                    : '--'}
                </p>
              </div>
            </div>

            {/* Equiv Database */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <StatusDot status={health?.checks?.database?.equivalentes?.status} />
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">EQUIV</p>
                <p className="text-sm font-semibold text-slate-800">
                  {health?.checks?.database?.equivalentes?.latency_ms
                    ? `${health.checks.database.equivalentes.latency_ms.toFixed(1)}ms`
                    : '--'}
                </p>
              </div>
            </div>

            {/* Catalogo Materiales Database */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <StatusDot status={health?.checks?.database?.catalogo_materiales?.status} />
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">CATALOGO</p>
                <p className="text-sm font-semibold text-slate-800">
                  {health?.checks?.database?.catalogo_materiales?.latency_ms
                    ? `${health.checks.database.catalogo_materiales.latency_ms.toFixed(1)}ms`
                    : '--'}
                </p>
              </div>
            </div>

            {/* Cache Status */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <StatusDot status={overallCacheHit >= 90 ? 'healthy' : overallCacheHit >= 70 ? 'warning' : 'error'} />
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Cache</p>
                <p className="text-sm font-semibold text-slate-800">
                  {overallCacheHit.toFixed(0)}% hit
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Activity}
          iconColor="text-pink-500"
          label={t('total_requests', 'Total Requests')}
          value={metrics?.total_requests?.toLocaleString() || '0'}
          variant="primary"
        />
        <MetricCard
          icon={AlertTriangle}
          label={t('errors', 'Errores')}
          value={`${metrics?.total_errors?.toLocaleString() || '0'} (${errorRate.toFixed(1)}%)`}
          variant={getVariant(errorRate, 'errorRate')}
        />
        <MetricCard
          icon={Zap}
          iconColor="text-amber-500"
          label={t('latency_p50', 'Latencia P50')}
          value={`${Math.round(metrics?.latency?.p50_ms || 0)}ms`}
          variant={getVariant(metrics?.latency?.p50_ms || 0, 'latency')}
        />
        <MetricCard
          icon={Clock}
          iconColor="text-cyan-500"
          label={t('uptime', 'Uptime')}
          value={formatUptime(health?.uptime_seconds)}
          variant="info"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latencia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              {t('latency', 'Latencia')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">P50</span>
                  <span className="text-lg font-bold text-slate-800">
                    {Math.round(metrics?.latency?.p50_ms || 0)}ms
                  </span>
                </div>
                <ProgressBar
                  value={metrics?.latency?.p50_ms || 0}
                  max={500}
                  height={6}
                  color={getColor(metrics?.latency?.p50_ms || 0, 'latency')}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">P95</span>
                  <span className="text-lg font-bold text-slate-800">
                    {Math.round(metrics?.latency?.p95_ms || 0)}ms
                  </span>
                </div>
                <ProgressBar
                  value={metrics?.latency?.p95_ms || 0}
                  max={500}
                  height={6}
                  color={getColor(metrics?.latency?.p95_ms || 0, 'latency')}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">P99</span>
                  <span className="text-lg font-bold text-slate-800">
                    {Math.round(metrics?.latency?.p99_ms || 0)}ms
                  </span>
                </div>
                <ProgressBar
                  value={metrics?.latency?.p99_ms || 0}
                  max={500}
                  height={6}
                  color={getColor(metrics?.latency?.p99_ms || 0, 'latency')}
                />
              </div>
            </div>

            {/* Status codes */}
            {metrics?.status_codes && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-slate-600 mb-3">{t('by_status', 'Por Status')}</p>
                <div className="space-y-2">
                  {Object.entries(metrics.status_codes).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        {status.startsWith('2') && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                        {status.startsWith('4') && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        {status.startsWith('5') && <XCircle className="w-4 h-4 text-red-500" />}
                        {status}xx
                      </span>
                      <span className="font-medium">{count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cache Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-purple-500" />
              {t('cache_performance', 'Cache Performance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <ProgressCircle
                percentage={Math.round(overallCacheHit)}
                size={120}
                strokeWidth={10}
                color={getColor(overallCacheHit, 'cacheHit')}
                label="Hit Rate"
              />
            </div>

            {cacheMetrics?.caches && Object.entries(cacheMetrics.caches).length > 0 && (
              <div className="mt-4 space-y-3">
                {Object.entries(cacheMetrics.caches).map(([name, cache]) => (
                  <div key={name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600 truncate">{name.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{(cache.hit_rate || 0).toFixed(1)}%</span>
                    </div>
                    <ProgressBar
                      value={cache.hit_rate || 0}
                      max={100}
                      height={4}
                      color={getColor(cache.hit_rate || 0, 'cacheHit')}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Database Pool */}
            {dbMetrics && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-slate-600 mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" />
                  {t('connection_pool', 'Pool de Conexiones')}
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">{t('active', 'Activas')}</span>
                    <p className="font-semibold text-slate-800">{dbMetrics.active_connections || 0}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Max</span>
                    <p className="font-semibold text-slate-800">{dbMetrics.max_connections || '--'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('total_queries', 'Queries')}</span>
                    <p className="font-semibold text-slate-800">{(dbMetrics.total_queries || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-500" />
              {t('system_resources', 'Recursos del Sistema')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {systemMetrics?.system ? (
              <div className="space-y-6">
                {/* System-wide metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-slate-600 mb-2">
                      <Cpu className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">CPU Sistema</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                      {systemMetrics.system.cpu_percent?.toFixed(1) || '--'}%
                    </p>
                    <ProgressBar
                      value={systemMetrics.system.cpu_percent || 0}
                      max={100}
                      height={4}
                      color={systemMetrics.system.cpu_percent > 80 ? '#EF4444' : systemMetrics.system.cpu_percent > 50 ? '#F59E0B' : '#10B981'}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-slate-600 mb-2">
                      <HardDrive className="w-4 h-4" />
                      <span className="text-sm">{t('memory', 'Memoria')} Sistema</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">
                      {systemMetrics.system.memory_percent?.toFixed(1) || '--'}%
                    </p>
                    <ProgressBar
                      value={systemMetrics.system.memory_percent || 0}
                      max={100}
                      height={4}
                      color={systemMetrics.system.memory_percent > 80 ? '#EF4444' : systemMetrics.system.memory_percent > 50 ? '#F59E0B' : '#10B981'}
                    />
                  </div>
                </div>

                {/* Process metrics */}
                {systemMetrics.process && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-600 mb-3">{t('process_metrics', 'Proceso SPM')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">CPU</span>
                        <p className="font-semibold text-slate-800">{systemMetrics.process.cpu_percent?.toFixed(1) || '--'}%</p>
                      </div>
                      <div>
                        <span className="text-slate-500">{t('memory', 'Memoria')}</span>
                        <p className="font-semibold text-slate-800">{systemMetrics.process.memory_mb?.toFixed(0) || '--'} MB</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Threads</span>
                        <p className="font-semibold text-slate-800">{systemMetrics.process.threads || '--'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">{t('open_files', 'Archivos')}</span>
                        <p className="font-semibold text-slate-800">{systemMetrics.process.open_files || '--'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                <Server className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('no_system_metrics', 'Sin metricas de sistema')}</p>
              </div>
            )}

            {health && (
              <div className="border-t mt-4 pt-4">
                <p className="text-sm font-medium text-slate-600 mb-3">{t('server_info', 'Informacion del Servidor')}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('version', 'Version')}</span>
                    <span className="font-medium">{health.version || 'SPM 2.0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('environment', 'Entorno')}</span>
                    <Badge variant="default">{health.environment || 'development'}</Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-slate-500" />
              {t('controls', 'Controles')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {t('refresh', 'Actualizar')}
              </Button>

              <Button
                variant={autoRefresh ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleResetMetrics}
                disabled={resetting}
              >
                <Activity className={`w-4 h-4 mr-2 ${resetting ? 'animate-spin' : ''}`} />
                {t('reset_metrics', 'Reiniciar Metricas')}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-2" />
                {t('export_json', 'Exportar JSON')}
              </Button>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-slate-500">
                {t('auto_refresh_info', 'Auto-refresh cada 30 segundos cuando esta activado. Las metricas se acumulan desde el ultimo reinicio del servidor.')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metricas de Negocio */}
      {businessMetrics && Object.keys(businessMetrics).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              {t('business_metrics', 'Metricas de Negocio')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(businessMetrics)
                .filter(([, value]) => typeof value !== 'object' || value === null)
                .map(([key, value]) => (
                <div key={key} className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xl font-bold text-slate-800">
                    {typeof value === 'number' ? value.toLocaleString() : String(value ?? '--')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estadisticas de Base de Datos */}
      {dbStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-500" />
              {t('db_statistics', 'Estadisticas de Base de Datos')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Totales */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-emerald-50 rounded-lg text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t('total_records', 'Total Registros')}
                </p>
                <p className="text-3xl font-bold text-emerald-700">
                  {dbStats.totals?.records?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t('total_size', 'Espacio Total')}
                </p>
                <p className="text-3xl font-bold text-blue-700">
                  {dbStats.totals?.size_mb?.toFixed(1) || '0'} MB
                </p>
              </div>
            </div>

            {/* Por base de datos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dbStats.databases && Object.entries(dbStats.databases).map(([dbName, dbInfo]) => (
                <div key={dbName} className="p-4 border rounded-lg bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-800 uppercase text-sm">
                      {dbName.replace(/_/g, ' ')}
                    </h4>
                    {dbInfo.size_mb !== undefined && (
                      <Badge variant="default">{dbInfo.size_mb} MB</Badge>
                    )}
                  </div>
                  {dbInfo.error ? (
                    <p className="text-sm text-red-500">{dbInfo.error}</p>
                  ) : dbInfo.counts ? (
                    <div className="space-y-1">
                      {Object.entries(dbInfo.counts).map(([table, count]) => (
                        <div key={table} className="flex justify-between text-sm">
                          <span className="text-slate-600">{table}</span>
                          <span className="font-medium text-slate-800">
                            {count.toLocaleString()}
                          </span>
                        </div>
                      ))}
                      <div className="pt-2 mt-2 border-t flex justify-between text-sm font-medium">
                        <span className="text-slate-600">{t('subtotal', 'Subtotal')}</span>
                        <span className="text-emerald-600">
                          {dbInfo.total_records?.toLocaleString() || '0'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">{t('no_data', 'Sin datos')}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Infraestructura */}
      {infrastructure && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-violet-500" />
              {t('infrastructure', 'Infraestructura')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Oracle Cloud Instance */}
            {infrastructure.oci?.available && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-slate-600">Oracle Cloud Instance</span>
                  <Badge variant="success" className="text-xs">{infrastructure.oci.instance?.state}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Instance Info */}
                  <div className="p-3 bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border border-red-100">
                    <p className="text-xs text-slate-500 mb-1">Instancia</p>
                    <p className="text-sm font-bold text-slate-800">{infrastructure.oci.instance?.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {infrastructure.oci.instance?.hostname}
                    </p>
                  </div>
                  {/* Shape */}
                  <div className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-slate-500 mb-1">Shape</p>
                    <p className="text-sm font-bold text-slate-800">{infrastructure.oci.shape?.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {infrastructure.oci.shape?.ocpus} OCPU • {infrastructure.oci.shape?.memory_gb} GB RAM
                    </p>
                  </div>
                  {/* Location */}
                  <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
                    <p className="text-xs text-slate-500 mb-1">Región</p>
                    <p className="text-sm font-bold text-slate-800">{infrastructure.oci.location?.region}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {infrastructure.oci.location?.availability_domain}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* System Metrics */}
            <div className={infrastructure.oci?.available ? "border-t pt-4" : ""}>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-slate-600">Recursos del Sistema</span>
                {infrastructure.system?.uptime && (
                  <Badge variant="default" className="text-xs">
                    Uptime: {infrastructure.system.uptime.formatted}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Memory */}
                {infrastructure.system?.memory && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Memoria RAM</p>
                    <p className="text-lg font-bold text-slate-800">
                      {infrastructure.system.memory.percent_used}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {infrastructure.system.memory.used_gb} / {infrastructure.system.memory.total_gb} GB
                    </p>
                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          infrastructure.system.memory.percent_used > 80
                            ? 'bg-red-500'
                            : infrastructure.system.memory.percent_used > 60
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${infrastructure.system.memory.percent_used}%` }}
                      />
                    </div>
                  </div>
                )}
                {/* Disk */}
                {infrastructure.services?.system?.disk && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Disco</p>
                    <p className="text-lg font-bold text-slate-800">
                      {infrastructure.services.system.disk.percent_used}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {infrastructure.services.system.disk.used_gb} / {infrastructure.services.system.disk.total_gb} GB
                    </p>
                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          infrastructure.services.system.disk.percent_used > 85
                            ? 'bg-red-500'
                            : infrastructure.services.system.disk.percent_used > 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${infrastructure.services.system.disk.percent_used}%` }}
                      />
                    </div>
                  </div>
                )}
                {/* Load Average */}
                {infrastructure.services?.system?.load && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">CPU Load</p>
                    <p className="text-lg font-bold text-slate-800">
                      {infrastructure.services.system.load['1min']}
                    </p>
                    <p className="text-xs text-slate-500">
                      5m: {infrastructure.services.system.load['5min']} • 15m: {infrastructure.services.system.load['15min']}
                    </p>
                  </div>
                )}
                {/* Network */}
                {infrastructure.oci?.shape?.network_gbps && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Network</p>
                    <p className="text-lg font-bold text-slate-800">
                      {infrastructure.oci.shape.network_gbps} Gbps
                    </p>
                    <p className="text-xs text-slate-500">Bandwidth disponible</p>
                  </div>
                )}
              </div>
            </div>

            {/* Docker Containers - Collapsed if not available */}
            {infrastructure.docker?.available && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Boxes className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-slate-600">Docker Containers</span>
                  <Badge variant="default" className="text-xs">
                    v{infrastructure.docker.docker_version}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {infrastructure.docker.containers?.map((container) => (
                    <div
                      key={container.name}
                      className={`p-3 rounded-lg border ${
                        container.running
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            container.running ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="font-medium text-sm text-slate-800 truncate">
                          {container.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{container.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Git Status - Collapsed if not available */}
            {infrastructure.git?.available && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <GitCompare className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium text-slate-600">Git Status</span>
                  <Badge variant="default">{infrastructure.git.branch}</Badge>
                </div>
                {infrastructure.git.last_commit && (
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded font-mono">
                        {infrastructure.git.last_commit.hash}
                      </code>
                      <span className="text-xs text-slate-500">
                        {infrastructure.git.last_commit.time_ago}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{infrastructure.git.last_commit.message}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
