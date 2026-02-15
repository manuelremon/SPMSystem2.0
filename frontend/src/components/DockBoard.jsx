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

const ESTADO_CONFIG = {
  available: { color: '#4caf50', label: 'Disponible', borderColor: '#4caf50' },
  occupied: { color: '#f44336', label: 'Ocupado', borderColor: '#f44336' },
  maintenance: { color: '#9e9e9e', label: 'Mantenimiento', borderColor: '#9e9e9e' },
};

export default function DockBoard({ docks = [], onAssign, onUpdateTimes }) {
  if (docks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
        No hay docks registrados
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
        const config = ESTADO_CONFIG[estado] || ESTADO_CONFIG.available;

        return (
          <Box
            key={dock.id || dock.numero_dock}
            onClick={() => handleClick(dock)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(dock); } }}
            aria-label={`Dock ${dock.numero_dock} - ${config.label}`}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '2px solid',
              borderColor: config.borderColor,
              backgroundColor: 'background.paper',
              cursor: estado === 'maintenance' ? 'default' : 'pointer',
              transition: 'box-shadow 0.2s, transform 0.2s',
              '&:hover': estado !== 'maintenance' ? {
                boxShadow: 3,
                transform: 'translateY(-2px)',
              } : {},
              '&:focus-visible': {
                outline: `2px solid ${config.borderColor}`,
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
                label={config.label}
                sx={{
                  backgroundColor: config.color,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.65rem',
                }}
              />
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                Almacen: <strong>{dock.almacen || '-'}</strong>
              </Typography>
              {dock.capacidad_pallets != null && (
                <Typography variant="body2" color="text.secondary">
                  Capacidad: <strong>{dock.capacidad_pallets} pallets</strong>
                </Typography>
              )}
              {estado === 'available' && (
                <Typography variant="caption" color="success.main" sx={{ mt: 0.5 }}>
                  Clic para asignar recepcion
                </Typography>
              )}
              {estado === 'occupied' && (
                <Typography variant="caption" color="error.main" sx={{ mt: 0.5 }}>
                  Clic para registrar tiempos
                </Typography>
              )}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
