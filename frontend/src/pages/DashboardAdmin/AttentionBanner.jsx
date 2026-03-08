import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../context/i18n';
import { useUserRoles } from '../../hooks/useUserRoles';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

/**
 * AttentionBanner - Hero banner with urgent action items.
 * Shows role-specific alerts requiring immediate attention.
 */
function AttentionBanner({ resumen }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { isAdmin, isPlanner, isCoordinador, isJefe, canApprove } = useUserRoles();

  if (!resumen) return null;

  const alerts = [];

  // Solicitudes pendientes aprobacion
  if (canApprove && resumen.pendientes_aprobacion > 0) {
    alerts.push({
      key: 'pending_approval',
      label: t('dash_attention_pending_approval', '{count} pendientes de aprobación').replace('{count}', resumen.pendientes_aprobacion),
      color: 'warning',
      icon: <AssignmentLateIcon sx={{ fontSize: 16 }} />,
      onClick: () => navigate('/aprobaciones'),
    });
  }

  // Solicitudes pendientes planificacion
  if ((isPlanner || isAdmin) && resumen.pendientes_planificacion > 0) {
    alerts.push({
      key: 'pending_planning',
      label: t('dash_attention_pending_planning', '{count} por planificar').replace('{count}', resumen.pendientes_planificacion),
      color: 'info',
      icon: <PlaylistAddCheckIcon sx={{ fontSize: 16 }} />,
      onClick: () => navigate('/planner'),
    });
  }

  // Incumplimientos SLA
  if ((isAdmin || isCoordinador || isJefe) && resumen.sla_breaches > 0) {
    alerts.push({
      key: 'sla_breaches',
      label: t('dash_attention_sla', '{count} incumplimientos SLA').replace('{count}', resumen.sla_breaches),
      color: 'error',
      icon: <ErrorOutlineIcon sx={{ fontSize: 16 }} />,
      onClick: () => navigate('/solicitudes/todas?tab=pendientes&sla=breach'),
    });
  }

  // Alertas MRP criticas
  if ((isAdmin || isPlanner) && resumen.alertas_mrp > 0) {
    alerts.push({
      key: 'mrp_alerts',
      label: t('dash_attention_mrp', '{count} alertas MRP').replace('{count}', resumen.alertas_mrp),
      color: 'error',
      icon: <WarningAmberIcon sx={{ fontSize: 16 }} />,
      onClick: () => navigate('/mrp'),
    });
  }

  // Notificaciones sin leer
  if (resumen.notificaciones_sin_leer > 0) {
    alerts.push({
      key: 'unread_notifications',
      label: t('dash_attention_notifications', '{count} notificaciones').replace('{count}', resumen.notificaciones_sin_leer),
      color: 'default',
      icon: <NotificationsActiveIcon sx={{ fontSize: 16 }} />,
      onClick: () => navigate('/notificaciones'),
    });
  }

  if (alerts.length === 0) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'var(--surface)',
        border: '1px solid',
        borderColor: 'divider',
        px: 2,
        py: 1.5,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontSize: '0.7rem',
          mb: 1,
          display: 'block',
        }}
      >
        {t('dash_attention_title', 'Requiere tu atención')}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {alerts.map(alert => (
          <Chip
            key={alert.key}
            icon={alert.icon}
            label={alert.label}
            color={alert.color}
            variant="outlined"
            size="small"
            onClick={alert.onClick}
            sx={{
              cursor: 'pointer',
              fontWeight: 500,
              '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
            }}
          />
        ))}
      </Stack>
    </Paper>
  );
}

export default memo(AttentionBanner);
