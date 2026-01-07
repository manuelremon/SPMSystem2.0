/**
 * TechnicalMetrics - Panel colapsable de metricas tecnicas
 *
 * Incluye: Latencia, Cache, Sistema, Infraestructura
 */

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { ProgressBar, ProgressCircle } from '../../../components/ui/Charts'
import {
  Zap, HardDrive, Server, Cpu, Database, Activity,
  CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp,
  Boxes, GitCompare
} from '../../../components/ui/Icons'
import { useI18n } from '../../../context/i18n'
import { getColorByMetric, getVariantByMetric } from '../../../config/thresholds'

/**
 * Seccion colapsable
 */
function CollapsibleSection({ title, icon: Icon, iconColor, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <span className="font-medium text-slate-800 dark:text-slate-100">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 bg-white dark:bg-slate-900/50">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Panel de Latencia
 */
function LatencyPanel({ metrics }) {
  const { t } = useI18n()

  return (
    <div className="space-y-4">
      {/* Barras de latencia */}
      <div className="space-y-4">
        {['p50', 'p95', 'p99'].map((percentile) => {
          const value = metrics?.latency?.[`${percentile}_ms`] || 0
          const label = percentile.toUpperCase()
          return (
            <div key={percentile}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {Math.round(value)}ms
                </span>
              </div>
              <ProgressBar
                value={value}
                max={500}
                height={6}
                color={getColorByMetric(value, 'latency')}
              />
            </div>
          )
        })}
      </div>

      {/* Status codes */}
      {metrics?.status_codes && (
        <div className="border-t dark:border-slate-700 pt-4 mt-4">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
            {t('by_status', 'Por Status')}
          </p>
          <div className="space-y-2">
            {Object.entries(metrics.status_codes).map(([status, count]) => (
              <div key={status} className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  {status.startsWith('2') && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  {status.startsWith('4') && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  {status.startsWith('5') && <XCircle className="w-4 h-4 text-red-500" />}
                  <span className="text-slate-700 dark:text-slate-300">{status}xx</span>
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Panel de Cache
 */
function CachePanel({ cacheMetrics, dbMetrics }) {
  const { t } = useI18n()
  const overallHitRate = cacheMetrics?.overall_hit_rate || 0

  return (
    <div>
      <div className="flex items-center justify-center py-4">
        <ProgressCircle
          percentage={Math.round(overallHitRate)}
          size={120}
          strokeWidth={10}
          color={getColorByMetric(overallHitRate, 'cacheHit')}
          label="Hit Rate"
        />
      </div>

      {cacheMetrics?.caches && Object.entries(cacheMetrics.caches).length > 0 && (
        <div className="mt-4 space-y-3">
          {Object.entries(cacheMetrics.caches).map(([name, cache]) => (
            <div key={name}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600 dark:text-slate-400 truncate">
                  {name.replace(/_/g, ' ')}
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {(cache.hit_rate || 0).toFixed(1)}%
                </span>
              </div>
              <ProgressBar
                value={cache.hit_rate || 0}
                max={100}
                height={4}
                color={getColorByMetric(cache.hit_rate || 0, 'cacheHit')}
              />
            </div>
          ))}
        </div>
      )}

      {/* Database Pool */}
      {dbMetrics && (
        <div className="border-t dark:border-slate-700 pt-4 mt-4">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-500" />
            {t('connection_pool', 'Pool de Conexiones')}
          </p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400">{t('active', 'Activas')}</span>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {dbMetrics.active_connections || 0}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Max</span>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {dbMetrics.max_connections || '--'}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">{t('total_queries', 'Queries')}</span>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {(dbMetrics.total_queries || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Panel de Sistema
 */
function SystemPanel({ systemMetrics, health }) {
  const { t } = useI18n()

  if (!systemMetrics?.system) {
    return (
      <div className="text-center text-slate-500 dark:text-slate-400 py-8">
        <Server className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>{t('no_system_metrics', 'Sin metricas de sistema')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* System-wide metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-2">
            <Cpu className="w-4 h-4 text-blue-500" />
            <span className="text-sm">CPU Sistema</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {systemMetrics.system.cpu_percent?.toFixed(1) || '--'}%
          </p>
          <ProgressBar
            value={systemMetrics.system.cpu_percent || 0}
            max={100}
            height={4}
            color={getColorByMetric(systemMetrics.system.cpu_percent || 0, 'cpu')}
          />
        </div>
        <div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-2">
            <HardDrive className="w-4 h-4" />
            <span className="text-sm">{t('memory', 'Memoria')} Sistema</span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {systemMetrics.system.memory_percent?.toFixed(1) || '--'}%
          </p>
          <ProgressBar
            value={systemMetrics.system.memory_percent || 0}
            max={100}
            height={4}
            color={getColorByMetric(systemMetrics.system.memory_percent || 0, 'memory')}
          />
        </div>
      </div>

      {/* Process metrics */}
      {systemMetrics.process && (
        <div className="border-t dark:border-slate-700 pt-4">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
            {t('process_metrics', 'Proceso SPM')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400">CPU</span>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {systemMetrics.process.cpu_percent?.toFixed(1) || '--'}%
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">{t('memory', 'Memoria')}</span>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {systemMetrics.process.memory_mb?.toFixed(0) || '--'} MB
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Threads</span>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {systemMetrics.process.threads || '--'}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">{t('open_files', 'Archivos')}</span>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {systemMetrics.process.open_files || '--'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Server info */}
      {health && (
        <div className="border-t dark:border-slate-700 pt-4">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
            {t('server_info', 'Informacion del Servidor')}
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('version', 'Version')}</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {health.version || 'SPM 2.0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('environment', 'Entorno')}</span>
              <Badge variant="default">{health.environment || 'development'}</Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Panel de Infraestructura
 */
function InfrastructurePanel({ infrastructure }) {
  const { t } = useI18n()

  if (!infrastructure) return null

  return (
    <div className="space-y-6">
      {/* Oracle Cloud Instance */}
      {infrastructure.oci?.available && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Oracle Cloud Instance
            </span>
            <Badge variant="success" className="text-xs">
              {infrastructure.oci.instance?.state}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg border border-red-100 dark:border-red-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Instancia</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {infrastructure.oci.instance?.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {infrastructure.oci.instance?.hostname}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-100 dark:border-blue-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Shape</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {infrastructure.oci.shape?.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {infrastructure.oci.shape?.ocpus} OCPU - {infrastructure.oci.shape?.memory_gb} GB RAM
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Region</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {infrastructure.oci.location?.region}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {infrastructure.oci.location?.availability_domain}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* System resources */}
      <div className={infrastructure.oci?.available ? 'border-t dark:border-slate-700 pt-4' : ''}>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Recursos del Sistema
          </span>
          {infrastructure.system?.uptime && (
            <Badge variant="default" className="text-xs">
              Uptime: {infrastructure.system.uptime.formatted}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Memory */}
          {infrastructure.system?.memory && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Memoria RAM</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {infrastructure.system.memory.percent_used}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {infrastructure.system.memory.used_gb} / {infrastructure.system.memory.total_gb} GB
              </p>
              <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
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
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Disco</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {infrastructure.services.system.disk.percent_used}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {infrastructure.services.system.disk.used_gb} / {infrastructure.services.system.disk.total_gb} GB
              </p>
              <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
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
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">CPU Load</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {infrastructure.services.system.load['1min']}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                5m: {infrastructure.services.system.load['5min']} - 15m: {infrastructure.services.system.load['15min']}
              </p>
            </div>
          )}
          {/* Network */}
          {infrastructure.oci?.shape?.network_gbps && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Network</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {infrastructure.oci.shape.network_gbps} Gbps
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Bandwidth disponible</p>
            </div>
          )}
        </div>
      </div>

      {/* Docker Containers */}
      {infrastructure.docker?.available && (
        <div className="border-t dark:border-slate-700 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Boxes className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Docker Containers
            </span>
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
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      container.running ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">
                    {container.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {container.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Git Status */}
      {infrastructure.git?.available && (
        <div className="border-t dark:border-slate-700 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <GitCompare className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Git Status
            </span>
            <Badge variant="default">{infrastructure.git.branch}</Badge>
          </div>
          {infrastructure.git.last_commit && (
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <code className="text-xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono text-slate-700 dark:text-slate-300">
                  {infrastructure.git.last_commit.hash}
                </code>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {infrastructure.git.last_commit.time_ago}
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {infrastructure.git.last_commit.message}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Panel principal de metricas tecnicas (colapsable)
 */
export function TechnicalMetrics({
  metrics,
  cacheMetrics,
  dbMetrics,
  systemMetrics,
  health,
  infrastructure
}) {
  const { t } = useI18n()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="w-5 h-5 text-violet-500" />
          {t('technical_metrics', 'Metricas Tecnicas')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CollapsibleSection
          title={t('latency', 'Latencia')}
          icon={Zap}
          iconColor="text-amber-500"
          defaultOpen={false}
        >
          <LatencyPanel metrics={metrics} />
        </CollapsibleSection>

        <CollapsibleSection
          title={t('cache_performance', 'Cache Performance')}
          icon={HardDrive}
          iconColor="text-purple-500"
          defaultOpen={false}
        >
          <CachePanel cacheMetrics={cacheMetrics} dbMetrics={dbMetrics} />
        </CollapsibleSection>

        <CollapsibleSection
          title={t('system_resources', 'Recursos del Sistema')}
          icon={Server}
          iconColor="text-blue-500"
          defaultOpen={false}
        >
          <SystemPanel systemMetrics={systemMetrics} health={health} />
        </CollapsibleSection>

        {infrastructure && (
          <CollapsibleSection
            title={t('infrastructure', 'Infraestructura')}
            icon={Boxes}
            iconColor="text-violet-500"
            defaultOpen={false}
          >
            <InfrastructurePanel infrastructure={infrastructure} />
          </CollapsibleSection>
        )}
      </CardContent>
    </Card>
  )
}

export default TechnicalMetrics
