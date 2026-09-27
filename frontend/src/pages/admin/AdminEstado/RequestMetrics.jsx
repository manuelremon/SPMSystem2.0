/**
 * RequestMetrics - Tarjetas de metricas de requests HTTP
 *
 * Muestra total de requests, errores, latencia y uptime
 */

import { MetricCard } from '../../../components/ui/MetricCard'
import { Activity, AlertTriangle, Zap, Clock } from '../../../components/ui/Icons'
import { useI18n } from '../../../context/i18n'
import { getVariantByMetric } from '../../../config/thresholds'
import { formatNumber } from '../../../utils/formatters'

/**
 * Formatea el uptime en formato legible
 */
function formatUptime(seconds) {
  if (!seconds) return '—'
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
        label={t('admin_estado_total_peticiones', 'Total de peticiones')}
        value={formatNumber(metrics?.total_requests || 0)}
        variant="primary"
        tooltip={t('admin_estado_tt_peticiones', 'Total de peticiones HTTP procesadas desde el último reinicio del servidor')}
      />
      <MetricCard
        icon={AlertTriangle}
        label={t('admin_estado_errors', 'Errores')}
        value={`${formatNumber(metrics?.total_errors || 0)} (${formatNumber(errorRate, 1)}%)`}
        variant={getVariantByMetric(errorRate, 'errorRate')}
        tooltip={t('admin_estado_tt_errores', 'Peticiones que devolvieron error (4xx o 5xx). Porcentaje respecto del total')}
      />
      <MetricCard
        icon={Zap}
        iconColor="text-amber-500"
        label={t('latency_p50', 'Latencia P50')}
        value={`${formatNumber(Math.round(metrics?.latency?.p50_ms || 0))} ms`}
        variant={getVariantByMetric(metrics?.latency?.p50_ms || 0, 'latency')}
        tooltip={t('admin_estado_tt_latencia', 'Tiempo de respuesta mediano (el 50 % de las peticiones es más rápido que este valor)')}
      />
      <MetricCard
        icon={Clock}
        iconColor="text-cyan-500"
        label={t('admin_estado_tiempo_activo', 'Tiempo activo')}
        value={formatUptime(health?.uptime_seconds)}
        variant="info"
        tooltip={t('admin_estado_tt_uptime', 'Tiempo desde el último reinicio del servidor')}
      />
    </div>
  )
}

export default RequestMetrics
