/**
 * Admin Estado - Dashboard de estado del sistema
 *
 * Reorganizado por importancia:
 * - TIER 1: Alertas, Salud del Sistema, Metricas de Negocio
 * - TIER 2: Metricas de Requests, Estado de BD
 * - TIER 3: Metricas Tecnicas (colapsables), Graficos Historicos
 * - TIER 4: Panel de Control
 */

import { PageHeader } from '../../../components/ui/PageHeader'
import { Alert } from '../../../components/ui/Alert'
import { Skeleton } from '../../../components/ui/Skeleton'
import { Button } from '../../../components/ui/Button'
import { RefreshCw, TrendingUp } from '../../../components/ui/Icons'
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card'
import { useI18n } from '../../../context/i18n'

// Custom hook
import { useAdminEstado } from '../../../hooks/useAdminEstado'

// Componentes existentes
import { AlertsPanel } from '../../../components/admin/AlertsPanel'
import { BusinessMetricsPanel } from '../../../components/admin/BusinessMetricsPanel'
import { CpuMemoryChart, LatencyErrorChart, SingleMetricChart } from '../../../components/admin/MetricsChart'

// Componentes nuevos
import { HealthStatus } from './HealthStatus'
import { RequestMetrics } from './RequestMetrics'
import { DatabaseStatus } from './DatabaseStatus'
import { TechnicalMetrics } from './TechnicalMetrics'
import { ControlPanel } from './ControlPanel'

/**
 * Panel de Graficos Historicos
 */
function HistoricalCharts({ historyData, selectedHours, onChangeHours }) {
  const { t } = useI18n()

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            {t('trends', 'Tendencias')} ({selectedHours}h)
          </CardTitle>
          <div className="flex gap-1">
            {[6, 12, 24].map(hours => (
              <Button
                key={hours}
                variant={selectedHours === hours ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => onChangeHours(hours)}
              >
                {hours}h
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {historyData && Object.keys(historyData).length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CpuMemoryChart data={historyData} height={200} />
            <LatencyErrorChart data={historyData} height={200} />
            <SingleMetricChart data={historyData} metricType="cache_hit" title="Cache Hit Rate" height={150} />
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('no_history_data', 'Sin datos historicos')}</p>
            <p className="text-sm mt-1">
              {t('history_hint', 'Los datos se recolectan automaticamente cada 5 minutos')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Estado de carga
 */
function LoadingState() {
  const { t } = useI18n()

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

/**
 * Componente principal
 */
export default function AdminEstado() {
  const { t } = useI18n()

  const {
    // Datos
    health,
    metrics,
    cacheMetrics,
    dbMetrics,
    dbStats,
    systemMetrics,
    businessMetrics,
    infrastructure,
    historyData,
    activeAlerts,

    // Valores calculados
    errorRate,
    overallCacheHit,

    // Estado UI
    selectedHours,
    setSelectedHours,
    error,
    loading,
    autoRefresh,
    lastUpdate,
    resetting,
    acknowledging,

    // Handlers
    fetchData,
    handleResetMetrics,
    handleExport,
    handleAcknowledgeAlert,
    handleAcknowledgeAllAlerts,
    toggleAutoRefresh,
    clearError,
  } = useAdminEstado()

  // Estado de carga inicial
  if (loading) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      {/* Header con ultimo update */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title={t('admin_estado', 'Estado del Sistema')}
          subtitle={t('admin_estado_subtitle', 'Monitoreo REAL TIME')}
        />

        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
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

      {/* Error */}
      {error && (
        <Alert variant="destructive" onDismiss={clearError}>
          {error}
        </Alert>
      )}

      {/* ===== TIER 1: CRITICO ===== */}

      {/* 1. Alertas Activas (solo si hay) */}
      {activeAlerts && activeAlerts.length > 0 && (
        <AlertsPanel
          alerts={activeAlerts}
          onAcknowledge={handleAcknowledgeAlert}
          onAcknowledgeAll={handleAcknowledgeAllAlerts}
          acknowledging={acknowledging}
        />
      )}

      {/* 2. Estado de Salud del Sistema */}
      <HealthStatus health={health} cacheHitRate={overallCacheHit} />

      {/* 3. Metricas de Negocio */}
      <BusinessMetricsPanel data={businessMetrics} isLoading={loading} />

      {/* ===== TIER 2: IMPORTANTE ===== */}

      {/* 4. Metricas de Requests */}
      <RequestMetrics metrics={metrics} health={health} errorRate={errorRate} />

      {/* 5. Estado de Base de Datos */}
      <DatabaseStatus dbStats={dbStats} />

      {/* ===== TIER 3: TECNICO (Colapsables) ===== */}

      {/* 6. Metricas Tecnicas (Latencia, Cache, Sistema, Infraestructura) */}
      <TechnicalMetrics
        metrics={metrics}
        cacheMetrics={cacheMetrics}
        dbMetrics={dbMetrics}
        systemMetrics={systemMetrics}
        health={health}
        infrastructure={infrastructure}
      />

      {/* 7. Graficos Historicos */}
      <HistoricalCharts
        historyData={historyData}
        selectedHours={selectedHours}
        onChangeHours={setSelectedHours}
      />

      {/* ===== TIER 4: ACCIONES ===== */}

      {/* 8. Panel de Control */}
      <ControlPanel
        onRefresh={fetchData}
        onResetMetrics={handleResetMetrics}
        onExport={handleExport}
        onToggleAutoRefresh={toggleAutoRefresh}
        autoRefresh={autoRefresh}
        loading={loading}
        resetting={resetting}
      />
    </div>
  )
}
