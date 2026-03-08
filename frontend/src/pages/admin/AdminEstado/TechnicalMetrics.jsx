/**
 * TechnicalMetrics - Panel colapsable de metricas tecnicas
 * Enterprise Design - MUI Components
 *
 * Incluye: Latencia, Cache, Sistema, Infraestructura
 */

import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  IconButton,
  Collapse,
  Grid,
} from "@mui/material";

// MUI Icons
import FlashOnIcon from "@mui/icons-material/FlashOn";
import StorageIcon from "@mui/icons-material/Storage";
import DnsIcon from "@mui/icons-material/Dns";
import MemoryIcon from "@mui/icons-material/Memory";
import DataUsageIcon from "@mui/icons-material/DataUsage";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import CancelIcon from "@mui/icons-material/Cancel";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import GitHubIcon from "@mui/icons-material/GitHub";

import { ProgressBar, ProgressCircle } from '../../../components/ui/SPMChartJS'
import { useI18n } from '../../../context/i18n'
import { getColorByMetric } from '../../../config/thresholds'

/**
 * Seccion colapsable
 */
function CollapsibleSection({ title, icon: Icon, iconColor, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        component="button"
        onClick={() => setIsOpen(!isOpen)}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          transition: 'opacity 0.2s',
          bgcolor: 'action.hover',
          border: 'none',
          cursor: 'pointer',
          '&:hover': {
            opacity: 0.9,
          },
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Icon sx={{ width: 20, height: 20, color: iconColor }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 500, color: 'text.primary' }}>
            {title}
          </Typography>
        </Stack>
        {isOpen ? (
          <ExpandLessIcon sx={{ width: 20, height: 20, color: 'text.secondary' }} />
        ) : (
          <ExpandMoreIcon sx={{ width: 20, height: 20, color: 'text.secondary' }} />
        )}
      </Box>
      <Collapse in={isOpen}>
        <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
          {children}
        </Box>
      </Collapse>
    </Paper>
  )
}

/**
 * Panel de Latencia
 */
function LatencyPanel({ metrics }) {
  const { t } = useI18n()

  return (
    <Stack spacing={2}>
      {/* Barras de latencia */}
      <Stack spacing={2}>
        {['p50', 'p95', 'p99'].map((percentile) => {
          const value = metrics?.latency?.[`${percentile}_ms`] || 0
          const label = percentile.toUpperCase()
          return (
            <Box key={percentile}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
                <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                  {Math.round(value)}ms
                </Typography>
              </Stack>
              <ProgressBar
                value={value}
                max={500}
                height={6}
                color={getColorByMetric(value, 'latency')}
              />
            </Box>
          )
        })}
      </Stack>

      {/* Status codes */}
      {metrics?.status_codes && (
        <Box sx={{ pt: 2, mt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" fontWeight={500} color="text.secondary" sx={{ mb: 1.5 }}>
            {t('by_status', 'Por Status')}
          </Typography>
          <Stack spacing={1}>
            {Object.entries(metrics.status_codes).map(([status, count]) => (
              <Stack key={status} direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" alignItems="center" spacing={1}>
                  {status.startsWith('2') && <CheckCircleIcon sx={{ width: 16, height: 16, color: 'success.main' }} />}
                  {status.startsWith('4') && <WarningIcon sx={{ width: 16, height: 16, color: 'warning.main' }} />}
                  {status.startsWith('5') && <CancelIcon sx={{ width: 16, height: 16, color: 'error.main' }} />}
                  <Typography variant="body2" color="text.primary">{status}xx</Typography>
                </Stack>
                <Typography variant="body2" fontWeight={500} color="text.primary">
                  {count.toLocaleString()}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  )
}

/**
 * Panel de Cache
 */
function CachePanel({ cacheMetrics, dbMetrics }) {
  const { t } = useI18n()
  const overallHitRate = cacheMetrics?.overall_hit_rate || 0

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
        <ProgressCircle
          percentage={Math.round(overallHitRate)}
          size={120}
          strokeWidth={10}
          color={getColorByMetric(overallHitRate, 'cacheHit')}
          label={t('admin_hit_rate', 'Hit Rate')}
        />
      </Box>

      {cacheMetrics?.caches && Object.entries(cacheMetrics.caches).length > 0 && (
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {Object.entries(cacheMetrics.caches).map(([name, cache]) => (
            <Box key={name}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {name.replace(/_/g, ' ')}
                </Typography>
                <Typography variant="body2" fontWeight={500} color="text.primary">
                  {(cache.hit_rate || 0).toFixed(1)}%
                </Typography>
              </Stack>
              <ProgressBar
                value={cache.hit_rate || 0}
                max={100}
                height={4}
                color={getColorByMetric(cache.hit_rate || 0, 'cacheHit')}
              />
            </Box>
          ))}
        </Stack>
      )}

      {/* Database Pool */}
      {dbMetrics && (
        <Box sx={{ pt: 2, mt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <DataUsageIcon sx={{ width: 16, height: 16, color: 'success.main' }} />
            <Typography variant="body2" fontWeight={500} color="text.secondary">
              {t('connection_pool', 'Pool de Conexiones')}
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.disabled">
                {t('active', 'Activas')}
              </Typography>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {dbMetrics.active_connections || 0}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.disabled">Max</Typography>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {dbMetrics.max_connections || '--'}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.disabled">
                {t('total_queries', 'Queries')}
              </Typography>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {(dbMetrics.total_queries || 0).toLocaleString()}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  )
}

/**
 * Panel de Sistema
 */
function SystemPanel({ systemMetrics, health }) {
  const { t } = useI18n()

  if (!systemMetrics?.system) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
        <DnsIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
        <Typography variant="body2">{t('no_system_metrics', 'Sin metricas de sistema')}</Typography>
      </Box>
    )
  }

  return (
    <Stack spacing={3}>
      {/* System-wide metrics */}
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, color: 'text.secondary' }}>
            <MemoryIcon sx={{ width: 16, height: 16, color: 'primary.main' }} />
            <Typography variant="body2">{t('admin_cpu_system', 'CPU Sistema')}</Typography>
          </Stack>
          <Typography variant="h5" fontWeight="bold" color="text.primary">
            {systemMetrics.system.cpu_percent?.toFixed(1) || '--'}%
          </Typography>
          <ProgressBar
            value={systemMetrics.system.cpu_percent || 0}
            max={100}
            height={4}
            color={getColorByMetric(systemMetrics.system.cpu_percent || 0, 'cpu')}
          />
        </Grid>
        <Grid item xs={6}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, color: 'text.secondary' }}>
            <StorageIcon sx={{ width: 16, height: 16 }} />
            <Typography variant="body2">{t('admin_memory_system', 'Memoria Sistema')}</Typography>
          </Stack>
          <Typography variant="h5" fontWeight="bold" color="text.primary">
            {systemMetrics.system.memory_percent?.toFixed(1) || '--'}%
          </Typography>
          <ProgressBar
            value={systemMetrics.system.memory_percent || 0}
            max={100}
            height={4}
            color={getColorByMetric(systemMetrics.system.memory_percent || 0, 'memory')}
          />
        </Grid>
      </Grid>

      {/* Process metrics */}
      {systemMetrics.process && (
        <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" fontWeight={500} color="text.secondary" sx={{ mb: 1.5 }}>
            {t('process_metrics', 'Proceso SPM')}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.disabled">CPU</Typography>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {systemMetrics.process.cpu_percent?.toFixed(1) || '--'}%
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.disabled">
                {t('memory', 'Memoria')}
              </Typography>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {systemMetrics.process.memory_mb?.toFixed(0) || '--'} MB
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.disabled">Threads</Typography>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {systemMetrics.process.threads || '--'}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.disabled">
                {t('open_files', 'Archivos')}
              </Typography>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {systemMetrics.process.open_files || '--'}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Server info */}
      {health && (
        <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" fontWeight={500} color="text.secondary" sx={{ mb: 1.5 }}>
            {t('server_info', 'Informacion del Servidor')}
          </Typography>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.disabled">
                {t('version', 'Version')}
              </Typography>
              <Typography variant="body2" fontWeight={500} color="text.primary">
                {health.version || 'SPM 2.0'}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.disabled">
                {t('environment', 'Entorno')}
              </Typography>
              <Chip label={health.environment || 'development'} size="small" />
            </Stack>
          </Stack>
        </Box>
      )}
    </Stack>
  )
}

/**
 * Panel de Infraestructura
 */
function InfrastructurePanel({ infrastructure }) {
  const { t } = useI18n()

  if (!infrastructure) return null

  const getResourceBarColor = (percent) => {
    if (percent > 80) return 'error.main'
    if (percent > 60) return 'warning.main'
    return 'success.main'
  }

  return (
    <Stack spacing={3}>
      {/* Oracle Cloud Instance */}
      {infrastructure.oci?.available && (
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <DataUsageIcon sx={{ width: 16, height: 16, color: 'error.main' }} />
            <Typography variant="body2" fontWeight={500} color="text.secondary">
              {t('admin_oci_instance', 'Oracle Cloud Instance')}
            </Typography>
            <Chip
              label={infrastructure.oci.instance?.state}
              size="small"
              color="success"
            />
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'error.lighter',
                  border: '1px solid',
                  borderColor: 'error.light',
                }}
              >
                <Typography variant="caption" color="text.disabled" sx={{ mb: 0.5, display: 'block' }}>
                  Instancia
                </Typography>
                <Typography variant="body2" fontWeight="bold" color="text.primary">
                  {infrastructure.oci.instance?.name}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                  {infrastructure.oci.instance?.hostname}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'info.lighter',
                  border: '1px solid',
                  borderColor: 'info.light',
                }}
              >
                <Typography variant="caption" color="text.disabled" sx={{ mb: 0.5, display: 'block' }}>
                  Shape
                </Typography>
                <Typography variant="body2" fontWeight="bold" color="text.primary">
                  {infrastructure.oci.shape?.name}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                  {infrastructure.oci.shape?.ocpus} OCPU - {infrastructure.oci.shape?.memory_gb} GB RAM
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'success.lighter',
                  border: '1px solid',
                  borderColor: 'success.light',
                }}
              >
                <Typography variant="caption" color="text.disabled" sx={{ mb: 0.5, display: 'block' }}>
                  Region
                </Typography>
                <Typography variant="body2" fontWeight="bold" color="text.primary">
                  {infrastructure.oci.location?.region}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                  {infrastructure.oci.location?.availability_domain}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* System resources */}
      <Box
        sx={infrastructure.oci?.available ? { pt: 2, borderTop: '1px solid', borderColor: 'divider' } : {}}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <MonitorHeartIcon sx={{ width: 16, height: 16, color: 'success.main' }} />
          <Typography variant="body2" fontWeight={500} color="text.secondary">
            {t('admin_system_resources', 'Recursos del Sistema')}
          </Typography>
          {infrastructure.system?.uptime && (
            <Chip
              label={`Uptime: ${infrastructure.system.uptime.formatted}`}
              size="small"
            />
          )}
        </Stack>
        <Grid container spacing={2}>
          {/* Memory */}
          {infrastructure.system?.memory && (
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.disabled" sx={{ mb: 0.5, display: 'block' }}>
                  Memoria RAM
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="text.primary">
                  {infrastructure.system.memory.percent_used}%
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {infrastructure.system.memory.used_gb} / {infrastructure.system.memory.total_gb} GB
                </Typography>
                <Box
                  sx={{
                    mt: 1,
                    height: 6,
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: 'divider',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      borderRadius: 1,
                      width: `${infrastructure.system.memory.percent_used}%`,
                      bgcolor: getResourceBarColor(infrastructure.system.memory.percent_used),
                    }}
                  />
                </Box>
              </Paper>
            </Grid>
          )}
          {/* Disk */}
          {infrastructure.services?.system?.disk && (
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.disabled" sx={{ mb: 0.5, display: 'block' }}>
                  Disco
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="text.primary">
                  {infrastructure.services.system.disk.percent_used}%
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {infrastructure.services.system.disk.used_gb} / {infrastructure.services.system.disk.total_gb} GB
                </Typography>
                <Box
                  sx={{
                    mt: 1,
                    height: 6,
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: 'divider',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      borderRadius: 1,
                      width: `${infrastructure.services.system.disk.percent_used}%`,
                      bgcolor: getResourceBarColor(infrastructure.services.system.disk.percent_used),
                    }}
                  />
                </Box>
              </Paper>
            </Grid>
          )}
          {/* Load Average */}
          {infrastructure.services?.system?.load && (
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.disabled" sx={{ mb: 0.5, display: 'block' }}>
                  {t('admin_cpu_load', 'Carga CPU')}
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="text.primary">
                  {infrastructure.services.system.load['1min']}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  5m: {infrastructure.services.system.load['5min']} - 15m: {infrastructure.services.system.load['15min']}
                </Typography>
              </Paper>
            </Grid>
          )}
          {/* Network */}
          {infrastructure.oci?.shape?.network_gbps && (
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.disabled" sx={{ mb: 0.5, display: 'block' }}>
                  {t('admin_network', 'Red')}
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="text.primary">
                  {infrastructure.oci.shape.network_gbps} Gbps
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {t('admin_bandwidth_available', 'Bandwidth disponible')}
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Docker Containers */}
      {infrastructure.docker?.available && (
        <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <ViewInArIcon sx={{ width: 16, height: 16, color: 'primary.main' }} />
            <Typography variant="body2" fontWeight={500} color="text.secondary">
              {t('admin_docker_containers', 'Docker Containers')}
            </Typography>
            <Chip
              label={`v${infrastructure.docker.docker_version}`}
              size="small"
            />
          </Stack>
          <Grid container spacing={1.5}>
            {infrastructure.docker.containers?.map((container) => (
              <Grid item xs={12} sm={6} md={4} key={container.name}>
                <Paper
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: container.running ? 'success.lighter' : 'error.lighter',
                    border: '1px solid',
                    borderColor: container.running ? 'success.light' : 'error.light',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: container.running ? 'success.main' : 'error.main',
                      }}
                    />
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      color="text.primary"
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {container.name}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                  >
                    {container.status}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Git Status */}
      {infrastructure.git?.available && (
        <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <GitHubIcon sx={{ width: 16, height: 16, color: 'warning.main' }} />
            <Typography variant="body2" fontWeight={500} color="text.secondary">
              {t('admin_git_status', 'Git Status')}
            </Typography>
            <Chip label={infrastructure.git.branch} size="small" />
          </Stack>
          {infrastructure.git.last_commit && (
            <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Box
                  component="code"
                  sx={{
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.5,
                    bgcolor: 'divider',
                    color: 'text.primary',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                  }}
                >
                  {infrastructure.git.last_commit.hash}
                </Box>
                <Typography variant="caption" color="text.disabled">
                  {infrastructure.git.last_commit.time_ago}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.primary">
                {infrastructure.git.last_commit.message}
              </Typography>
            </Paper>
          )}
        </Box>
      )}
    </Stack>
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
    <Paper sx={{ overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <DnsIcon sx={{ width: 20, height: 20, color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={600}>
            {t('technical_metrics', 'Metricas Tecnicas')}
          </Typography>
        </Stack>
      </Box>
      <Stack spacing={2} sx={{ p: 2 }}>
        <CollapsibleSection
          title={t('latency', 'Latencia')}
          icon={FlashOnIcon}
          iconColor="warning.main"
          defaultOpen={false}
        >
          <LatencyPanel metrics={metrics} />
        </CollapsibleSection>

        <CollapsibleSection
          title={t('cache_performance', 'Cache Performance')}
          icon={StorageIcon}
          iconColor="primary.main"
          defaultOpen={false}
        >
          <CachePanel cacheMetrics={cacheMetrics} dbMetrics={dbMetrics} />
        </CollapsibleSection>

        <CollapsibleSection
          title={t('system_resources', 'Recursos del Sistema')}
          icon={DnsIcon}
          iconColor="info.main"
          defaultOpen={false}
        >
          <SystemPanel systemMetrics={systemMetrics} health={health} />
        </CollapsibleSection>

        {infrastructure && (
          <CollapsibleSection
            title={t('infrastructure', 'Infraestructura')}
            icon={ViewInArIcon}
            iconColor="primary.main"
            defaultOpen={false}
          >
            <InfrastructurePanel infrastructure={infrastructure} />
          </CollapsibleSection>
        )}
      </Stack>
    </Paper>
  )
}

export default TechnicalMetrics
