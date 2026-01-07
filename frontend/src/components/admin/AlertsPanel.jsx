/**
 * AlertsPanel - Panel de alertas activas del sistema
 *
 * Muestra alertas criticas y warnings con opcion de reconocer
 */

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { AlertTriangle, Bell, CheckCircle, Clock, X } from '../ui/Icons'

/**
 * Formatea timestamp relativo
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)

  if (diff < 60) return 'hace unos segundos'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} horas`
  return date.toLocaleDateString('es')
}

/**
 * Componente de alerta individual
 */
function AlertItem({ alert, onAcknowledge, isAcknowledging }) {
  const isCritical = alert.alert_type === 'critical'
  const isWarning = alert.alert_type === 'warning'

  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-lg border
        ${isCritical ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800' : ''}
        ${isWarning ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800' : ''}
        ${!isCritical && !isWarning ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' : ''}
      `}
    >
      <div className={`
        flex-shrink-0 mt-0.5
        ${isCritical ? 'text-red-500 dark:text-red-400' : ''}
        ${isWarning ? 'text-amber-500 dark:text-amber-400' : ''}
        ${!isCritical && !isWarning ? 'text-blue-500 dark:text-blue-400' : ''}
      `}>
        {isCritical ? (
          <AlertTriangle className="w-5 h-5" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
      </div>

      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge
            variant={isCritical ? 'destructive' : isWarning ? 'warning' : 'default'}
            className="text-xs"
          >
            {alert.metric_name}
          </Badge>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(alert.timestamp)}
          </span>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-200">{alert.message}</p>

        {alert.actual_value !== undefined && alert.threshold_value !== undefined && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Valor: <span className="font-medium">{alert.actual_value}</span>
            {' / '}
            Umbral: <span className="font-medium">{alert.threshold_value}</span>
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAcknowledge(alert.id)}
        disabled={isAcknowledging}
        className="flex-shrink-0"
        title="Reconocer alerta"
      >
        <CheckCircle className="w-4 h-4" />
      </Button>
    </div>
  )
}

/**
 * Panel de alertas activas
 */
export function AlertsPanel({
  alerts = [],
  onAcknowledge,
  onAcknowledgeAll,
  isLoading = false,
  acknowledging = null,
}) {
  const activeAlerts = alerts.filter((a) => !a.acknowledged)
  const criticalCount = activeAlerts.filter((a) => a.alert_type === 'critical').length
  const warningCount = activeAlerts.filter((a) => a.alert_type === 'warning').length

  if (!activeAlerts.length && !isLoading) {
    return (
      <Card className="border-l-4 border-green-500 dark:border-green-400">
        <CardContent className="py-6">
          <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
            <CheckCircle className="w-6 h-6" />
            <div>
              <p className="font-medium">Sistema Operando Normalmente</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">No hay alertas activas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`border-l-4 ${criticalCount > 0 ? 'border-red-500' : 'border-amber-500'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className={`w-5 h-5 ${criticalCount > 0 ? 'text-red-500' : 'text-amber-500'}`} />
            Alertas Activas
            <Badge variant={criticalCount > 0 ? 'destructive' : 'warning'}>
              {activeAlerts.length}
            </Badge>
          </CardTitle>

          {activeAlerts.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAcknowledgeAll}
              disabled={acknowledging === 'all'}
            >
              {acknowledging === 'all' ? 'Reconociendo...' : 'Reconocer Todas'}
            </Button>
          )}
        </div>

        {(criticalCount > 0 || warningCount > 0) && (
          <div className="flex gap-2 mt-2">
            {criticalCount > 0 && (
              <span className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded">
                {criticalCount} criticas
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded">
                {warningCount} warnings
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            Cargando alertas...
          </div>
        ) : (
          activeAlerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onAcknowledge={onAcknowledge}
              isAcknowledging={acknowledging === alert.id}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

export default AlertsPanel
