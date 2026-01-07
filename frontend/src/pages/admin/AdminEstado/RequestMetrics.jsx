/**
 * RequestMetrics - Tarjetas de metricas de requests HTTP
 *
 * Muestra total de requests, errores, latencia y uptime
 */

import { MetricCard } from '../../../components/ui/MetricCard'
import { Activity, AlertTriangle, Zap, Clock } from '../../../components/ui/Icons'
import { useI18n } from '../../../context/i18n'
import { getVariantByMetric } from '../../../config/thresholds'

/**
 * Formatea el uptime en formato legible
 */
function formatUptime(seconds) {
  if (!seconds) return '--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h}h ${m}m ${s}s`
}

/**
 * Grid de metricas de requests
 */
export function RequestMetrics({ metrics, health, errorRate }) {
  const { t } = useI18n()

  return (
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
        variant={getVariantByMetric(errorRate, 'errorRate')}
      />
      <MetricCard
        icon={Zap}
        iconColor="text-amber-500"
        label={t('latency_p50', 'Latencia P50')}
        value={`${Math.round(metrics?.latency?.p50_ms || 0)}ms`}
        variant={getVariantByMetric(metrics?.latency?.p50_ms || 0, 'latency')}
      />
      <MetricCard
        icon={Clock}
        iconColor="text-cyan-500"
        label={t('uptime', 'Uptime')}
        value={formatUptime(health?.uptime_seconds)}
        variant="info"
      />
    </div>
  )
}

export default RequestMetrics
