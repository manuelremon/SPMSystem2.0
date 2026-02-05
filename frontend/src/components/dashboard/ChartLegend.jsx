/**
 * ChartLegend - Leyenda uniforme para gráficos del dashboard
 *
 * Estilo consistente con Chart.js legend (puntos circulares, alineación derecha)
 * Tipografía: Roboto (heredada del tema MUI)
 */

import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { FONT_SIZES } from '../ui/SPMChartJS';

/**
 * Item individual de la leyenda
 */
function LegendItem({ color, label, value, valueColor }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: FONT_SIZES.sm,  // 11px - tamaño uniforme para leyendas
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
      {value !== undefined && (
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: valueColor || color,
            fontSize: FONT_SIZES.sm,  // 11px - tamaño uniforme para leyendas
            lineHeight: 1,
          }}
        >
          {value}
        </Typography>
      )}
    </Stack>
  );
}

/**
 * ChartLegend - Contenedor de leyenda
 *
 * @param {Array} items - Array de { color, label, value?, valueColor? }
 * @param {string} position - 'top' | 'bottom' | 'right' (default: 'top')
 * @param {string} align - 'start' | 'center' | 'end' (default: 'end')
 * @param {boolean} wrap - Si permite wrap en múltiples líneas
 */
export function ChartLegend({
  items = [],
  position = 'top',
  align = 'end',
  wrap = true,
  spacing = 2,
  sx = {},
}) {
  if (!items || items.length === 0) return null;

  const justifyContent = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
  }[align] || 'flex-end';

  return (
    <Stack
      direction="row"
      spacing={spacing}
      sx={{
        flexWrap: wrap ? 'wrap' : 'nowrap',
        justifyContent,
        gap: wrap ? 1 : undefined,
        ...sx,
      }}
    >
      {items.map((item, index) => (
        <LegendItem
          key={item.id || index}
          color={item.color}
          label={item.label}
          value={item.value}
          valueColor={item.valueColor}
        />
      ))}
    </Stack>
  );
}

/**
 * Leyenda compacta horizontal (para cards pequeñas)
 */
export function ChartLegendCompact({ items = [], sx = {} }) {
  return (
    <ChartLegend
      items={items}
      align="center"
      spacing={1.5}
      sx={{ mt: 1, ...sx }}
    />
  );
}

/**
 * Leyenda vertical (para cards con espacio lateral)
 */
export function ChartLegendVertical({ items = [], sx = {} }) {
  if (!items || items.length === 0) return null;

  return (
    <Stack spacing={0.5} sx={sx}>
      {items.map((item, index) => (
        <LegendItem
          key={item.id || index}
          color={item.color}
          label={item.label}
          value={item.value}
          valueColor={item.valueColor}
        />
      ))}
    </Stack>
  );
}

export default ChartLegend;
