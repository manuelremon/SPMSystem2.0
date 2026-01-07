/**
 * HealthStatus - Panel de estado de salud del sistema
 *
 * Muestra el estado de las bases de datos y el cache
 */

import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Activity, Clock } from '../../../components/ui/Icons'
import { useI18n } from '../../../context/i18n'

/**
 * Indicador visual de estado
 */
function StatusDot({ status }) {
  const colors = {
    connected: 'bg-emerald-500',
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    disconnected: 'bg-red-500',
    unavailable: 'bg-slate-400'
  }
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status] || 'bg-slate-400'}`} />
  )
}

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
 * Item individual de base de datos
 */
function DatabaseItem({ name, status, latency }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
      <StatusDot status={status} />
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">{name}</p>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {latency ? `${latency.toFixed(1)}ms` : '--'}
        </p>
      </div>
    </div>
  )
}

/**
 * Panel de estado de salud del sistema
 */
export function HealthStatus({ health, cacheHitRate = 0 }) {
  const { t } = useI18n()

  const isHealthy = health?.status === 'healthy'
  const databases = health?.checks?.database || {}

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            {isHealthy
              ? t('system_healthy', 'Sistema Operativo')
              : t('system_degraded', 'Sistema Degradado')}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-500" />
              Uptime: {formatUptime(health?.uptime_seconds)}
            </span>
            <Badge variant={isHealthy ? 'success' : 'warning'}>
              {health?.status || 'unknown'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Bases de datos */}
          <DatabaseItem
            name="SPM"
            status={databases.spm?.status}
            latency={databases.spm?.latency_ms}
          />
          <DatabaseItem
            name="SAP"
            status={databases.sap_data?.status}
            latency={databases.sap_data?.latency_ms}
          />
          <DatabaseItem
            name="EQUIV"
            status={databases.equivalentes?.status}
            latency={databases.equivalentes?.latency_ms}
          />
          <DatabaseItem
            name="CATALOGO"
            status={databases.catalogo_materiales?.status}
            latency={databases.catalogo_materiales?.latency_ms}
          />

          {/* Cache Status */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <StatusDot
              status={cacheHitRate >= 90 ? 'healthy' : cacheHitRate >= 70 ? 'warning' : 'error'}
            />
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Cache</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {cacheHitRate.toFixed(0)}% hit
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default HealthStatus
