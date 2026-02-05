/**
 * AlertsPanel - Panel de alertas activas del sistema
 *
 * Muestra alertas criticas y warnings con opcion de reconocer
 */

import { Box, Paper, Typography, Stack, Chip, Button, IconButton, CircularProgress } from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import NotificationsIcon from '@mui/icons-material/Notifications'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AccessTimeIcon from '@mui/icons-material/AccessTime'

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

  const getAlertStyles = () => {
    if (isCritical) {
      return {
        bgcolor: 'error.50',
        borderColor: 'error.200',
        iconColor: 'error.main',
      }
    }
    if (isWarning) {
      return {
        bgcolor: 'warning.50',
        borderColor: 'warning.200',
        iconColor: 'warning.main',
      }
    }
    return {
      bgcolor: 'info.50',
      borderColor: 'info.200',
      iconColor: 'info.main',
    }
  }

  const styles = getAlertStyles()

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        border: 1,
        borderColor: styles.borderColor,
        bgcolor: styles.bgcolor,
      }}
    >
      <Box sx={{ flexShrink: 0, mt: 0.25, color: styles.iconColor }}>
        {isCritical ? (
          <WarningAmberIcon sx={{ fontSize: 20 }} />
        ) : (
          <NotificationsIcon sx={{ fontSize: 20 }} />
        )}
      </Box>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <Chip
            label={alert.metric_name}
            size="small"
            color={isCritical ? 'error' : isWarning ? 'warning' : 'default'}
            sx={{ fontSize: '0.75rem', height: 20 }}
          />
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <AccessTimeIcon sx={{ fontSize: 12 }} />
            {formatRelativeTime(alert.timestamp)}
          </Typography>
        </Stack>

        <Typography variant="body2" sx={{ color: 'text.primary' }}>
          {alert.message}
        </Typography>

        {alert.actual_value !== undefined && alert.threshold_value !== undefined && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            Valor: <Box component="span" sx={{ fontWeight: 500 }}>{alert.actual_value}</Box>
            {' / '}
            Umbral: <Box component="span" sx={{ fontWeight: 500 }}>{alert.threshold_value}</Box>
          </Typography>
        )}
      </Box>

      <IconButton
        size="small"
        onClick={() => onAcknowledge(alert.id)}
        disabled={isAcknowledging}
        title="Reconocer alerta"
        sx={{ flexShrink: 0 }}
      >
        <CheckCircleIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
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
      <Paper
        elevation={0}
        sx={{
          borderLeft: 4,
          borderColor: 'success.main',
          border: 1,
          borderLeftWidth: 4,
        }}
      >
        <Box sx={{ py: 3, px: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ color: 'success.main' }}>
            <CheckCircleIcon sx={{ fontSize: 24 }} />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                Sistema Operando Normalmente
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No hay alertas activas
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Paper>
    )
  }

  return (
    <Paper
      elevation={0}
      sx={{
        borderLeft: 4,
        borderColor: criticalCount > 0 ? 'error.main' : 'warning.main',
        border: 1,
        borderLeftWidth: 4,
      }}
    >
      <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <WarningAmberIcon
              sx={{ fontSize: 20, color: criticalCount > 0 ? 'error.main' : 'warning.main' }}
            />
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              Alertas Activas
            </Typography>
            <Chip
              label={activeAlerts.length}
              size="small"
              color={criticalCount > 0 ? 'error' : 'warning'}
              sx={{ height: 20, fontSize: '0.75rem' }}
            />
          </Stack>

          {activeAlerts.length > 1 && (
            <Button
              variant="outlined"
              size="small"
              onClick={onAcknowledgeAll}
              disabled={acknowledging === 'all'}
            >
              {acknowledging === 'all' ? 'Reconociendo...' : 'Reconocer Todas'}
            </Button>
          )}
        </Stack>

        {(criticalCount > 0 || warningCount > 0) && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {criticalCount > 0 && (
              <Chip
                label={`${criticalCount} criticas`}
                size="small"
                sx={{
                  bgcolor: 'error.100',
                  color: 'error.dark',
                  fontSize: '0.75rem',
                  height: 22,
                }}
              />
            )}
            {warningCount > 0 && (
              <Chip
                label={`${warningCount} warnings`}
                size="small"
                sx={{
                  bgcolor: 'warning.100',
                  color: 'warning.dark',
                  fontSize: '0.75rem',
                  height: 22,
                }}
              />
            )}
          </Stack>
        )}
      </Box>

      <Box sx={{ px: 2, pb: 2, maxHeight: 400, overflowY: 'auto' }}>
        <Stack spacing={1}>
          {isLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
                Cargando alertas...
              </Typography>
            </Box>
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
        </Stack>
      </Box>
    </Paper>
  )
}

export default AlertsPanel
