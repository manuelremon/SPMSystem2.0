/**
 * Canvas-based Donut Chart Component
 *
 * Migrado de Canvas nativo a Chart.js para consistencia con el resto del sistema.
 * Usa SPMDoughnut de Chart.js con estilo corporativo SPM.
 *
 * Uso:
 *   import { SPM_COLORS } from '../utils/chartTheme';
 *
 *   <CanvasDonutChart
 *     data={[150, 85, 120]}
 *     colors={[SPM_COLORS.primary, SPM_COLORS.error, SPM_COLORS.success]}
 *     labels={['Completadas', 'Pendientes', 'Rechazadas']}
 *     width={100}
 *     height={100}
 *   />
 */

import React, { useMemo } from 'react';
import { SPMDoughnut, CHART_PALETTE } from '../ui/SPMChartJS';

export function CanvasDonutChart({
  data = [],
  colors = [],
  labels = [],
  width = 100,
  height = 100,
  innerRadius = 30,
  outerRadius = 45,
}) {
  // Calcular el total para mostrar en el centro
  const total = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.reduce((sum, val) => sum + val, 0);
  }, [data]);

  // Transformar datos al formato esperado por SPMDoughnut
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const sliceColors = colors.length > 0 ? colors : generateDefaultColors(data.length);

    return data.map((value, index) => ({
      label: labels[index] || `Segmento ${index + 1}`,
      value: value,
      color: sliceColors[index] || CHART_PALETTE[index % CHART_PALETTE.length],
    }));
  }, [data, colors, labels]);

  // Calcular cutout basado en innerRadius/outerRadius
  const cutoutPercentage = useMemo(() => {
    if (outerRadius <= 0) return '65%';
    const ratio = (innerRadius / outerRadius) * 100;
    return `${Math.round(ratio)}%`;
  }, [innerRadius, outerRadius]);

  // Si no hay datos, mostrar placeholder vacio
  if (!data || data.length === 0 || total === 0) {
    return (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: 'var(--fg-subtle)', fontSize: '12px' }}>Sin datos</span>
      </div>
    );
  }

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
      }}
    >
      <SPMDoughnut
        data={chartData}
        height={height}
        centerText={String(total)}
        options={{
          cutout: cutoutPercentage,
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  return `${label}: ${value} (${percentage}%)`;
                },
              },
            },
          },
        }}
      />
    </div>
  );
}

/**
 * Genera colores por defecto si no se proporcionan
 */
function generateDefaultColors(count) {
  const hues = [
    'var(--primary)', // blue
    'var(--danger)', // red
    'var(--success)', // green
    'var(--warning)', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
  ];
  return Array.from({ length: count }, (_, i) => hues[i % hues.length]);
}

/**
 * Hook para calcular colores automaticamente
 */
export function useDonutChartColors(dataLength) {
  return generateDefaultColors(dataLength);
}

export default CanvasDonutChart;
