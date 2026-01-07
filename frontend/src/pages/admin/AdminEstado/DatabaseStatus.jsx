/**
 * DatabaseStatus - Panel de estadisticas de bases de datos
 *
 * Muestra conteo de registros y tamano de cada BD
 */

import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Database } from '../../../components/ui/Icons'
import { useI18n } from '../../../context/i18n'

/**
 * Tarjeta individual de base de datos
 */
function DatabaseCard({ name, info }) {
  const { t } = useI18n()

  if (info?.error) {
    return (
      <div className="p-4 border rounded-lg bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100 uppercase text-sm">
            {name.replace(/_/g, ' ')}
          </h4>
          <Badge variant="danger">Error</Badge>
        </div>
        <p className="text-sm text-red-500 dark:text-red-400">{info.error}</p>
      </div>
    )
  }

  if (!info?.counts) {
    return (
      <div className="p-4 border rounded-lg bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100 uppercase text-sm">
            {name.replace(/_/g, ' ')}
          </h4>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('no_data', 'Sin datos')}</p>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-slate-800 dark:text-slate-100 uppercase text-sm">
          {name.replace(/_/g, ' ')}
        </h4>
        {info.size_mb !== undefined && (
          <Badge variant="default">{info.size_mb} MB</Badge>
        )}
      </div>
      <div className="space-y-1">
        {Object.entries(info.counts).map(([table, count]) => (
          <div key={table} className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">{table}</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {count.toLocaleString()}
            </span>
          </div>
        ))}
        <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between text-sm font-medium">
          <span className="text-slate-600 dark:text-slate-400">{t('subtotal', 'Subtotal')}</span>
          <span className="text-emerald-600 dark:text-emerald-400">
            {info.total_records?.toLocaleString() || '0'}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Panel de estadisticas de bases de datos
 */
export function DatabaseStatus({ dbStats }) {
  const { t } = useI18n()

  if (!dbStats) return null

  return (
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
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              {t('total_records', 'Total Registros')}
            </p>
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
              {dbStats.totals?.records?.toLocaleString() || '0'}
            </p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              {t('total_size', 'Espacio Total')}
            </p>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">
              {dbStats.totals?.size_mb?.toFixed(1) || '0'} MB
            </p>
          </div>
        </div>

        {/* Por base de datos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dbStats.databases && Object.entries(dbStats.databases).map(([dbName, dbInfo]) => (
            <DatabaseCard key={dbName} name={dbName} info={dbInfo} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default DatabaseStatus
