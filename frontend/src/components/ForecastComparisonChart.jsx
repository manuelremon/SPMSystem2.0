/**
 * ForecastComparisonChart - Bar chart comparing forecast entries by source
 *
 * Renders horizontal grouped bars using pure CSS/divs (no chart library).
 * Groups entries by material_codigo and color-codes by fuente.
 * Shows consensus line overlaid when available.
 */

import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

const FUENTE_COLORS = {
  ml_baseline: 'var(--info)',
  sales: 'var(--success)',
  operations: 'var(--warning-light)',
  finance: 'var(--purple)',
  manual: 'var(--neutral)',
};

const FUENTE_LABELS = {
  ml_baseline: 'ML Baseline',
  sales: 'Ventas',
  operations: 'Operaciones',
  finance: 'Finanzas',
  manual: 'Manual',
};

export default function ForecastComparisonChart({ entries = [], consensus = [] }) {
  const { grouped, maxValue, materials } = useMemo(() => {
    const map = {};
    let max = 0;

    (entries || []).forEach(e => {
      const mat = e.material_codigo;
      if (!map[mat]) map[mat] = {};
      map[mat][e.fuente] = (map[mat][e.fuente] || 0) + (e.cantidad_pronosticada || 0);
      const val = map[mat][e.fuente];
      if (val > max) max = val;
    });

    // Include consensus values in max calculation
    (consensus || []).forEach(c => {
      const val = c.cantidad_consenso || 0;
      if (val > max) max = val;
    });

    const mats = Object.keys(map).sort();
    return { grouped: map, maxValue: max || 1, materials: mats };
  }, [entries, consensus]);

  const consensusMap = useMemo(() => {
    const map = {};
    (consensus || []).forEach(c => {
      map[c.material_codigo] = c.cantidad_consenso;
    });
    return map;
  }, [consensus]);

  const allFuentes = useMemo(() => {
    const fuentes = new Set();
    (entries || []).forEach(e => fuentes.add(e.fuente));
    return Array.from(fuentes).sort();
  }, [entries]);

  if (materials.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
        Sin datos para graficar
      </Typography>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Legend */}
      <Stack direction="row" gap={2} sx={{ mb: 2 }} flexWrap="wrap">
        {allFuentes.map(fuente => (
          <Stack key={fuente} direction="row" alignItems="center" gap={0.5}>
            <Box sx={{ width: 12, height: 12, borderRadius: '2px', backgroundColor: FUENTE_COLORS[fuente] || 'var(--fg-muted)' }} />
            <Typography variant="caption">{FUENTE_LABELS[fuente] || fuente}</Typography>
          </Stack>
        ))}
        {consensus.length > 0 && (
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Box sx={{ width: 12, height: 3, backgroundColor: 'var(--danger-light)' }} />
            <Typography variant="caption">Consenso</Typography>
          </Stack>
        )}
      </Stack>

      {/* Chart rows */}
      <Stack spacing={1.5} sx={{ maxHeight: 400, overflowY: 'auto' }}>
        {materials.map(mat => {
          const data = grouped[mat] || {};
          const consensusVal = consensusMap[mat];
          const consensusPos = consensusVal != null ? (consensusVal / maxValue) * 100 : null;

          return (
            <Box key={mat}>
              <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
                {mat}
              </Typography>
              <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {allFuentes.map(fuente => {
                  const val = data[fuente];
                  if (val == null) return null;
                  const widthPct = Math.max((val / maxValue) * 100, 1);
                  return (
                    <Tooltip key={fuente} title={`${FUENTE_LABELS[fuente] || fuente}: ${val.toLocaleString('es-ES')}`} arrow>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            height: 18,
                            width: `${widthPct}%`,
                            minWidth: 4,
                            backgroundColor: FUENTE_COLORS[fuente] || 'var(--fg-muted)',
                            borderRadius: '2px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                        <Typography variant="caption" sx={{ whiteSpace: 'nowrap', fontSize: '0.65rem', color: 'text.secondary' }}>
                          {val.toLocaleString('es-ES')}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })}
                {/* Consensus line overlay */}
                {consensusPos != null && (
                  <Tooltip title={`Consenso: ${consensusVal.toLocaleString('es-ES')}`} arrow>
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${consensusPos}%`,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        backgroundColor: 'var(--danger-light)',
                        borderRadius: '1px',
                        zIndex: 1,
                      }}
                    />
                  </Tooltip>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
