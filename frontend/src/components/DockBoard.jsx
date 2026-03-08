/**
 * DockBoard - Visual board of warehouse docks
 *
 * Renders docks as a CSS grid of cards. Each card shows dock number,
 * almacen, capacity, and status badge with color coding.
 * Click triggers onAssign (available) or onUpdateTimes (occupied).
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import { useI18n } from '../context/i18n';

const ESTADO_COLORS = {
  available: { color: '#4caf50', borderColor: '#4caf50' },
  occupied: { color: '#f44336', borderColor: '#f44336' },
  maintenance: { color: '#9e9e9e', borderColor: '#9e9e9e' },
};

const ESTADO_LABEL_KEYS = {
  available: ['warehouse_dock_available', 'Disponible'],
  occupied: ['warehouse_dock_occupied', 'Ocupado'],
  maintenance: ['warehouse_dock_maintenance', 'Mantenimiento'],
};

export default function DockBoard({ docks = [], onAssign, onUpdateTimes }) {
  const { t } = useI18n();

  if (docks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
        {t('warehouse_no_docks', 'No hay docks registrados')}
      </Typography>
    );
  }

  const handleClick = (dock) => {
    const estado = dock.estado || 'available';
    if (estado === 'available' && onAssign) {
      onAssign(dock);
    } else if (estado === 'occupied' && onUpdateTimes) {
      onUpdateTimes(dock);
    }
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(1, 1fr)',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
          lg: 'repeat(4, 1fr)',
        },
        gap: 2,
      }}
    >
      {docks.map((dock) => {
        const estado = dock.estado || 'available';
        const colors = ESTADO_COLORS[estado] || ESTADO_COLORS.available;
        const [labelKey, labelFallback] = ESTADO_LABEL_KEYS[estado] || ESTADO_LABEL_KEYS.available;
        const estadoLabel = t(labelKey, labelFallback);

        return (
          <Box
            key={dock.id || dock.numero_dock}
            onClick={() => handleClick(dock)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(dock); } }}
            aria-label={`Dock ${dock.numero_dock} - ${estadoLabel}`}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '2px solid',
              borderColor: colors.borderColor,
              backgroundColor: 'background.paper',
              cursor: estado === 'maintenance' ? 'default' : 'pointer',
              transition: 'box-shadow 0.2s, transform 0.2s',
              '&:hover': estado !== 'maintenance' ? {
                boxShadow: 3,
                transform: 'translateY(-2px)',
              } : {},
              '&:focus-visible': {
                outline: `2px solid ${colors.borderColor}`,
                outlineOffset: 2,
              },
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {dock.numero_dock}
              </Typography>
              <Chip
                size="small"
                label={estadoLabel}
                sx={{
                  backgroundColor: colors.color,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.65rem',
                }}
              />
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                {t('warehouse_almacen', 'Almacen')}: <strong>{dock.almacen || '-'}</strong>
              </Typography>
              {dock.capacidad_pallets != null && (
                <Typography variant="body2" color="text.secondary">
                  {t('warehouse_capacity', 'Capacidad')}: <strong>{dock.capacidad_pallets} pallets</strong>
                </Typography>
              )}
              {estado === 'available' && (
                <Typography variant="caption" color="success.main" sx={{ mt: 0.5 }}>
                  {t('warehouse_click_assign', 'Clic para asignar recepcion')}
                </Typography>
              )}
              {estado === 'occupied' && (
                <Typography variant="caption" color="error.main" sx={{ mt: 0.5 }}>
                  {t('warehouse_click_times', 'Clic para registrar tiempos')}
                </Typography>
              )}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
