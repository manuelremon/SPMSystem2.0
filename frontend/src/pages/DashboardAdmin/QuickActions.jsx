import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../context/i18n';
import { useUserRoles } from '../../hooks/useUserRoles';
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

  const actions = [
    {
      key: 'new_request',
      label: t('dash_quick_new_request', 'Nueva Solicitud'),
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
      path: '/planner',
      visible: isAdmin || isPlanner,
    },
    {
      key: 'mrp',
      label: 'MRP',
      icon: <InventoryIcon />,
      path: '/mrp',
      visible: isAdmin || isPlanner,
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
      path: '/tms',
      visible: isAdmin,
    },
    {
      key: 'quality',
      label: t('dash_quick_quality', 'Calidad'),
      icon: <VerifiedIcon />,
      path: '/quality',
      visible: isAdmin,
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
