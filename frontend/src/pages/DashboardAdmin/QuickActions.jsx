import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../context/i18n';
import { useUserRoles } from '../../hooks/useUserRoles';
import { useModuleStore } from '../../store/moduleStore';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EventNoteIcon from '@mui/icons-material/EventNote';
import InventoryIcon from '@mui/icons-material/Inventory';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import VerifiedIcon from '@mui/icons-material/Verified';

/**
 * QuickActions - Role-based navigation shortcuts.
 * Purely navigational, no API calls.
 */
function QuickActions() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { isAdmin, isPlanner, isJefe, canApprove, canSeeBudget } = useUserRoles();
  const planificacionEnabled = useModuleStore(s => s.isModuleEnabled('planificacion'));
  const logisticaEnabled = useModuleStore(s => s.isModuleEnabled('logistica'));
  const calidadEnabled = useModuleStore(s => s.isModuleEnabled('calidad'));

  const actions = [
    {
      key: 'new_request',
      label: t('dash_quick_new_request', 'Nueva solicitud'),
      icon: <AddIcon />,
      path: '/solicitudes/nueva',
      visible: true,
    },
    {
      key: 'approve',
      label: t('dash_quick_approve', 'Aprobar'),
      icon: <CheckCircleOutlineIcon />,
      path: '/aprobaciones',
      visible: canApprove,
    },
    {
      key: 'plan',
      label: t('dash_quick_plan', 'Planificar'),
      icon: <EventNoteIcon />,
      path: '/planificador',
      visible: (isAdmin || isPlanner) && planificacionEnabled,
    },
    {
      key: 'mrp',
      label: 'MRP',
      icon: <InventoryIcon />,
      path: '/mrp/portfolio',
      visible: (isAdmin || isPlanner) && planificacionEnabled,
    },
    {
      key: 'budgets',
      label: t('dash_quick_budgets', 'Presupuestos'),
      icon: <AccountBalanceWalletIcon />,
      path: '/presupuestos',
      visible: canSeeBudget,
    },
    {
      key: 'shipping',
      label: t('dash_quick_shipping', 'Envíos'),
      icon: <LocalShippingIcon />,
      path: '/tms/shipments',
      visible: isAdmin && logisticaEnabled,
    },
    {
      key: 'quality',
      label: t('dash_quick_quality', 'Calidad'),
      icon: <VerifiedIcon />,
      path: '/quality/inspections',
      visible: isAdmin && calidadEnabled,
    },
  ];

  const visibleActions = actions.filter(a => a.visible);

  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {visibleActions.map(action => (
        <Button
          key={action.key}
          variant="outlined"
          size="small"
          startIcon={action.icon}
          onClick={() => navigate(action.path)}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            borderColor: 'divider',
            color: 'text.primary',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'primary.50',
            },
          }}
        >
          {action.label}
        </Button>
      ))}
    </Stack>
  );
}

export default memo(QuickActions);
