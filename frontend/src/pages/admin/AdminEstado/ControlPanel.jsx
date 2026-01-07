/**
 * ControlPanel - Panel de controles del sistema
 *
 * Refresh, auto-refresh, reset metricas, exportar
 */

import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import {
  RefreshCw, Pause, Play, Activity, Download
} from '../../../components/ui/Icons'
import { useI18n } from '../../../context/i18n'

/**
 * Panel de controles del administrador
 */
export function ControlPanel({
  onRefresh,
  onResetMetrics,
  onExport,
  onToggleAutoRefresh,
  autoRefresh,
  loading,
  resetting
}) {
  const { t } = useI18n()

  return (
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
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh', 'Actualizar')}
          </Button>

          <Button
            variant={autoRefresh ? 'primary' : 'outline'}
            size="sm"
            onClick={onToggleAutoRefresh}
          >
            {autoRefresh ? (
              <Pause className="w-4 h-4 mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onResetMetrics}
            disabled={resetting}
          >
            <Activity className={`w-4 h-4 mr-2 ${resetting ? 'animate-spin' : ''}`} />
            {t('reset_metrics', 'Reiniciar Metricas')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
          >
            <Download className="w-4 h-4 mr-2" />
            {t('export_json', 'Exportar JSON')}
          </Button>
        </div>

        <div className="border-t dark:border-slate-700 pt-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('auto_refresh_info', 'Auto-refresh cada 30 segundos cuando esta activado. Las metricas se acumulan desde el ultimo reinicio del servidor.')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default ControlPanel
