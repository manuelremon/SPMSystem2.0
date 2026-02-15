/**
 * ImbalanceHeatmap - Visual heatmap of stock imbalances
 *
 * Renders a CSS grid where rows are materials and columns are almacenes.
 * Cell color indicates stock/safety_stock ratio:
 *   - ratio < 0.5: red (critical deficit)
 *   - 0.5 - 1.0: orange (low stock)
 *   - 1.0 - 1.5: green (optimal)
 *   - > 1.5: blue (excess)
 * Tooltip shows exact values on hover.
 */

import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

function getRatioColor(ratio) {
  if (ratio < 0.5) return '#ef5350';
  if (ratio < 1.0) return '#ff9800';
  if (ratio <= 1.5) return '#4caf50';
  return '#2196f3';
}

function getRatioLabel(ratio) {
  if (ratio < 0.5) return 'Critico';
  if (ratio < 1.0) return 'Bajo';
  if (ratio <= 1.5) return 'Optimo';
  return 'Exceso';
}

export default function ImbalanceHeatmap({ data = [] }) {
  const { materials, almacenes, cellMap } = useMemo(() => {
    const matSet = new Set();
    const almSet = new Set();
    const map = {};

    data.forEach(d => {
      matSet.add(d.material_codigo);
      almSet.add(d.almacen);
      const key = `${d.material_codigo}__${d.almacen}`;
      map[key] = d.ratio;
    });

    return {
      materials: Array.from(matSet).sort(),
      almacenes: Array.from(almSet).sort(),
      cellMap: map,
    };
  }, [data]);

  if (materials.length === 0 || almacenes.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
        Sin datos para el mapa de calor
      </Typography>
    );
  }

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      {/* Legend */}
      <Stack direction="row" gap={2} sx={{ mb: 2 }} flexWrap="wrap">
        {[
          { color: '#ef5350', label: '< 0.5 (Critico)' },
          { color: '#ff9800', label: '0.5 - 1.0 (Bajo)' },
          { color: '#4caf50', label: '1.0 - 1.5 (Optimo)' },
          { color: '#2196f3', label: '> 1.5 (Exceso)' },
        ].map(l => (
          <Stack key={l.label} direction="row" alignItems="center" gap={0.5}>
            <Box sx={{ width: 14, height: 14, borderRadius: '2px', backgroundColor: l.color }} />
            <Typography variant="caption">{l.label}</Typography>
          </Stack>
        ))}
      </Stack>

      {/* Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `120px repeat(${almacenes.length}, minmax(70px, 1fr))`,
          gap: '2px',
          maxHeight: 400,
          overflowY: 'auto',
        }}
      >
        {/* Header row */}
        <Box sx={{ p: 0.5, fontWeight: 600, fontSize: '0.7rem', display: 'flex', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>Material / Almacen</Typography>
        </Box>
        {almacenes.map(alm => (
          <Box key={alm} sx={{ p: 0.5, textAlign: 'center', fontWeight: 600 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.65rem' }}>{alm}</Typography>
          </Box>
        ))}

        {/* Data rows */}
        {materials.map(mat => (
          <Box key={mat} sx={{ display: 'contents' }}>
            {/* Material label */}
            <Box sx={{ p: 0.5, display: 'flex', alignItems: 'center', borderRight: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mat}
              </Typography>
            </Box>
            {/* Cells */}
            {almacenes.map(alm => {
              const key = `${mat}__${alm}`;
              const ratio = cellMap[key];
              if (ratio == null) {
                return (
                  <Box
                    key={key}
                    sx={{
                      backgroundColor: '#f5f5f5',
                      borderRadius: '2px',
                      minHeight: 28,
                    }}
                  />
                );
              }
              return (
                <Tooltip
                  key={key}
                  title={`${mat} @ ${alm}: ratio ${ratio.toFixed(2)} (${getRatioLabel(ratio)})`}
                  arrow
                >
                  <Box
                    sx={{
                      backgroundColor: getRatioColor(ratio),
                      borderRadius: '2px',
                      minHeight: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'default',
                      transition: 'opacity 0.2s',
                      '&:hover': { opacity: 0.8 },
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'white', fontWeight: 600, fontSize: '0.6rem' }}>
                      {ratio.toFixed(1)}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
