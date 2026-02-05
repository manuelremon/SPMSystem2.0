/**
 * SPMChartJS - Componentes Chart.js para SPM
 *
 * Wrappers optimizados con estilo corporativo SPM
 */

import React, { useMemo, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut, PolarArea } from 'react-chartjs-2';
import { Box, Typography, Skeleton } from '@mui/material';
import {
  FONT_FAMILY,
  FONT_SIZES,
  TEXT_COLORS,
  SPM_COLORS,
  CHART_PALETTE,
  STATUS_COLORS,
  PHASE_COLORS,
  TREND_COLORS,
  BUDGET_COLORS,
  TOOLTIP_CONFIG,
  ANIMATION_CONFIG,
  LEGEND_CONFIG,
  getDefaultOptions,
  createDataset,
  createPieData,
} from '../../utils/chartTheme';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Re-exportar utilidades del tema
export {
  // Tipografía
  FONT_FAMILY,
  FONT_SIZES,
  TEXT_COLORS,
  // Colores
  SPM_COLORS,
  CHART_PALETTE,
  STATUS_COLORS,
  PHASE_COLORS,
  TREND_COLORS,
  BUDGET_COLORS,
  // Configuraciones de Chart.js
  TOOLTIP_CONFIG,
  ANIMATION_CONFIG,
  LEGEND_CONFIG,
  createDataset,
  createPieData,
};

/**
 * SPMLine - Gráfico de líneas
 *
 * @param {Array} labels - Etiquetas del eje X
 * @param {Array} datasets - Array de datasets [{label, data, borderColor, ...}]
 * @param {Object} options - Opciones adicionales de Chart.js
 * @param {number|string} height - Altura del gráfico (default: 300)
 * @param {boolean} loading - Estado de carga
 * @param {string} title - Título opcional del gráfico
 */
export function SPMLine({
  labels = [],
  datasets = [],
  options = {},
  height = 300,
  loading = false,
  title,
}) {
  const chartData = useMemo(() => ({
    labels,
    datasets: datasets.map((ds, i) => ({
      borderColor: CHART_PALETTE[i % CHART_PALETTE.length],
      backgroundColor: ds.fill ? `${CHART_PALETTE[i % CHART_PALETTE.length]}33` : 'transparent',
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
      ...ds,
    })),
  }), [labels, datasets]);

  const chartOptions = useMemo(() => ({
    ...getDefaultOptions('line'),
    ...options,
    plugins: {
      ...getDefaultOptions('line').plugins,
      ...options.plugins,
      title: title ? {
        display: true,
        text: title,
        font: { size: 14, weight: 'bold' },
        color: SPM_COLORS.text,
        padding: { bottom: 16 },
      } : undefined,
    },
  }), [options, title]);

  if (loading) {
    return <Skeleton variant="rounded" height={height} />;
  }

  return (
    <Box sx={{ height, position: 'relative' }}>
      <Line data={chartData} options={chartOptions} />
    </Box>
  );
}

/**
 * SPMBar - Gráfico de barras
 *
 * @param {Array} labels - Etiquetas del eje X
 * @param {Array} datasets - Array de datasets [{label, data, backgroundColor, ...}]
 * @param {Object} options - Opciones adicionales de Chart.js
 * @param {number|string} height - Altura del gráfico (default: 300)
 * @param {boolean} loading - Estado de carga
 * @param {boolean} horizontal - Barras horizontales
 * @param {boolean} stacked - Barras apiladas
 * @param {string} title - Título opcional
 */
export function SPMBar({
  labels = [],
  datasets = [],
  options = {},
  height = 300,
  loading = false,
  horizontal = false,
  stacked = false,
  title,
}) {
  const chartData = useMemo(() => ({
    labels,
    datasets: datasets.map((ds, i) => ({
      backgroundColor: ds.backgroundColor || CHART_PALETTE[i % CHART_PALETTE.length],
      borderColor: ds.borderColor || CHART_PALETTE[i % CHART_PALETTE.length],
      borderWidth: 1,
      borderRadius: 4,
      ...ds,
    })),
  }), [labels, datasets]);

  const chartOptions = useMemo(() => ({
    ...getDefaultOptions('bar'),
    indexAxis: horizontal ? 'y' : 'x',
    ...options,
    plugins: {
      ...getDefaultOptions('bar').plugins,
      ...options.plugins,
      title: title ? {
        display: true,
        text: title,
        font: { size: 14, weight: 'bold' },
        color: SPM_COLORS.text,
        padding: { bottom: 16 },
      } : undefined,
    },
    scales: {
      ...getDefaultOptions('bar').scales,
      x: {
        ...getDefaultOptions('bar').scales?.x,
        stacked,
      },
      y: {
        ...getDefaultOptions('bar').scales?.y,
        stacked,
      },
    },
  }), [options, horizontal, stacked, title]);

  if (loading) {
    return <Skeleton variant="rounded" height={height} />;
  }

  return (
    <Box sx={{ height, position: 'relative' }}>
      <Bar data={chartData} options={chartOptions} />
    </Box>
  );
}

/**
 * SPMPie - Gráfico de pastel
 *
 * @param {Array} data - Array de objetos [{label, value, color?}] o {labels, values}
 * @param {Object} options - Opciones adicionales
 * @param {number|string} height - Altura (default: 300)
 * @param {boolean} loading - Estado de carga
 * @param {string} title - Título opcional
 */
export function SPMPie({
  data = [],
  options = {},
  height = 300,
  loading = false,
  title,
}) {
  const chartData = useMemo(() => {
    // Soportar formato [{label, value}] o {labels, values}
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'label' in data[0]) {
      const labels = data.map(d => d.label);
      const values = data.map(d => d.value);
      const colors = data.map((d, i) => d.color || CHART_PALETTE[i % CHART_PALETTE.length]);
      return {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: SPM_COLORS.background,
          borderWidth: 2,
          hoverOffset: 4,
        }],
      };
    }

    // Formato legacy {labels, values}
    return createPieData(data.labels || [], data.values || []);
  }, [data]);

  const chartOptions = useMemo(() => ({
    ...getDefaultOptions('pie'),
    ...options,
    plugins: {
      ...getDefaultOptions('pie').plugins,
      ...options.plugins,
      title: title ? {
        display: true,
        text: title,
        font: { size: 14, weight: 'bold' },
        color: SPM_COLORS.text,
        padding: { bottom: 16 },
      } : undefined,
    },
  }), [options, title]);

  if (loading) {
    return <Skeleton variant="circular" width={height} height={height} sx={{ mx: 'auto' }} />;
  }

  return (
    <Box sx={{ height, position: 'relative' }}>
      <Pie data={chartData} options={chartOptions} />
    </Box>
  );
}

/**
 * SPMDoughnut - Gráfico de dona
 *
 * @param {Array} data - Array de objetos [{label, value, color?}]
 * @param {Object} options - Opciones adicionales
 * @param {number|string} height - Altura (default: 300)
 * @param {boolean} loading - Estado de carga
 * @param {string} title - Título opcional
 * @param {string|number} centerText - Texto central opcional
 */
export function SPMDoughnut({
  data = [],
  options = {},
  height = 300,
  loading = false,
  title,
  centerText,
}) {
  const chartData = useMemo(() => {
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'label' in data[0]) {
      const labels = data.map(d => d.label);
      const values = data.map(d => d.value);
      const colors = data.map((d, i) => d.color || CHART_PALETTE[i % CHART_PALETTE.length]);
      return {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: SPM_COLORS.background,
          borderWidth: 2,
          hoverOffset: 4,
        }],
      };
    }
    return createPieData(data.labels || [], data.values || []);
  }, [data]);

  const chartOptions = useMemo(() => ({
    ...getDefaultOptions('doughnut'),
    cutout: '65%',
    ...options,
    plugins: {
      ...getDefaultOptions('doughnut').plugins,
      ...options.plugins,
      title: title ? {
        display: true,
        text: title,
        font: { size: 14, weight: 'bold' },
        color: SPM_COLORS.text,
        padding: { bottom: 16 },
      } : undefined,
    },
  }), [options, title]);

  if (loading) {
    return <Skeleton variant="circular" width={height} height={height} sx={{ mx: 'auto' }} />;
  }

  return (
    <Box sx={{ height, position: 'relative' }}>
      <Doughnut data={chartData} options={chartOptions} />
      {centerText && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <Typography variant="h4" fontWeight={700} color="text.primary">
            {centerText}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/**
 * SPMSparkline - Mini gráfico de línea inline
 *
 * @param {Array} data - Array de valores numéricos
 * @param {string} color - Color de la línea (default: primary)
 * @param {number} width - Ancho (default: 100)
 * @param {number} height - Alto (default: 30)
 * @param {boolean} showArea - Mostrar área bajo la curva
 */
export function SPMSparkline({
  data = [],
  color = SPM_COLORS.primary,
  width = 100,
  height = 30,
  showArea = false,
}) {
  const chartData = useMemo(() => ({
    labels: data.map((_, i) => i),
    datasets: [{
      data,
      borderColor: color,
      backgroundColor: showArea ? `${color}33` : 'transparent',
      borderWidth: 1.5,
      tension: 0.4,
      pointRadius: 0,
      fill: showArea,
    }],
  }), [data, color, showArea]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    elements: {
      point: { radius: 0 },
    },
  }), []);

  if (!data.length) return null;

  return (
    <Box sx={{ width, height, display: 'inline-block' }}>
      <Line data={chartData} options={chartOptions} />
    </Box>
  );
}

/**
 * SPMGauge - Indicador tipo velocímetro
 *
 * @param {number} value - Valor actual (0-100 por defecto)
 * @param {number} max - Valor máximo (default: 100) - También acepta valueMax para compatibilidad
 * @param {Object} thresholds - Umbrales {warning, danger} - Si no se pasa, usa color fijo
 * @param {number|string} height - Altura (default: 200)
 * @param {number} width - Ancho (ignorado, usa height para mantener aspecto cuadrado)
 * @param {string} label - Etiqueta opcional
 * @param {string} unit - Unidad (ej: "%", "ms")
 * @param {string} color - Color fijo (se usa si no hay thresholds)
 * @param {number} startAngle - Ángulo inicial (ignorado, siempre semicírculo)
 * @param {number} endAngle - Ángulo final (ignorado, siempre semicírculo)
 * @param {boolean} showText - Mostrar valor en el centro (default: true)
 */
export function SPMGauge({
  value = 0,
  max,
  valueMax,
  thresholds = null,
  height = 200,
  width, // ignorado, usa height
  label,
  unit = '%',
  color = SPM_COLORS.primary,
  startAngle, // ignorado
  endAngle, // ignorado
  showText = true,
}) {
  // Compatibilidad: valueMax es alias de max
  const maxValue = max ?? valueMax ?? 100;
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));

  const getColor = () => {
    if (!thresholds) return color;
    if (percentage >= thresholds.danger) return SPM_COLORS.error;
    if (percentage >= thresholds.warning) return SPM_COLORS.warning;
    return SPM_COLORS.success;
  };

  const chartData = useMemo(() => ({
    labels: ['Valor', 'Restante'],
    datasets: [{
      data: [percentage, 100 - percentage],
      backgroundColor: [getColor(), SPM_COLORS.greyLight],
      borderWidth: 0,
      circumference: 180,
      rotation: 270,
    }],
  }), [percentage, thresholds, color]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  }), []);

  // Usar el menor entre height y width si ambos están definidos
  const effectiveHeight = width ? Math.min(height, width) : height;

  return (
    <Box sx={{ height: effectiveHeight, width: effectiveHeight, position: 'relative', pt: 1 }}>
      <Doughnut data={chartData} options={chartOptions} />
      {showText && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
          }}
        >
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{
              color: getColor(),
              fontSize: effectiveHeight < 100 ? '0.7rem' : '1rem',
            }}
          >
            {Math.round(value)}{unit}
          </Typography>
          {label && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
              {label}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

/**
 * SPMArea - Gráfico de área
 *
 * @param {Array} labels - Etiquetas del eje X
 * @param {Array} datasets - Array de datasets con fill: true automático
 * @param {Object} options - Opciones adicionales
 * @param {number|string} height - Altura (default: 300)
 * @param {boolean} loading - Estado de carga
 * @param {boolean} stacked - Áreas apiladas
 */
export function SPMArea({
  labels = [],
  datasets = [],
  options = {},
  height = 300,
  loading = false,
  stacked = false,
}) {
  const chartData = useMemo(() => ({
    labels,
    datasets: datasets.map((ds, i) => ({
      borderColor: CHART_PALETTE[i % CHART_PALETTE.length],
      backgroundColor: `${CHART_PALETTE[i % CHART_PALETTE.length]}40`,
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 0,
      fill: stacked ? (i === 0 ? 'origin' : '-1') : true,
      ...ds,
    })),
  }), [labels, datasets, stacked]);

  const chartOptions = useMemo(() => ({
    ...getDefaultOptions('line'),
    ...options,
    scales: {
      ...getDefaultOptions('line').scales,
      y: {
        ...getDefaultOptions('line').scales?.y,
        stacked,
      },
    },
  }), [options, stacked]);

  if (loading) {
    return <Skeleton variant="rounded" height={height} />;
  }

  return (
    <Box sx={{ height, position: 'relative' }}>
      <Line data={chartData} options={chartOptions} />
    </Box>
  );
}

/**
 * ProgressBar - Barra de progreso simple
 *
 * @param {number} value - Valor actual (0-100)
 * @param {string} color - Color de la barra
 * @param {number} height - Altura en px (default: 8)
 * @param {boolean} showLabel - Mostrar porcentaje
 */
export function ProgressBar({
  value = 0,
  color = SPM_COLORS.primary,
  height = 8,
  showLabel = false,
  label,
}) {
  const percentage = Math.min(100, Math.max(0, value));

  return (
    <Box sx={{ width: '100%' }}>
      {(showLabel || label) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          {label && (
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          )}
          {showLabel && (
            <Typography variant="caption" fontWeight={600} color="text.primary">
              {percentage.toFixed(0)}%
            </Typography>
          )}
        </Box>
      )}
      <Box
        sx={{
          width: '100%',
          height,
          bgcolor: 'grey.200',
          borderRadius: height / 2,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${percentage}%`,
            height: '100%',
            bgcolor: color,
            borderRadius: height / 2,
            transition: 'width 0.3s ease',
          }}
        />
      </Box>
    </Box>
  );
}

/**
 * ProgressCircle - Círculo de progreso simple
 *
 * @param {number} percentage - Valor (0-100)
 * @param {number} size - Tamaño en px (default: 80)
 * @param {string} color - Color del progreso
 * @param {string} label - Etiqueta central opcional
 */
export function ProgressCircle({
  percentage = 0,
  size = 80,
  color = SPM_COLORS.primary,
  label,
}) {
  const pct = Math.min(100, Math.max(0, percentage));
  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={SPM_COLORS.greyLight}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            transition: 'stroke-dashoffset 0.3s ease',
          }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ fontSize: size * 0.18, color: 'text.primary' }}
        >
          {label || `${pct.toFixed(0)}%`}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * SPMPolarArea - Gráfico de Área Polar
 *
 * @param {Array} data - Array de objetos [{label, value, color?}]
 * @param {Object} options - Opciones adicionales
 * @param {number|string} height - Altura (default: 200)
 * @param {boolean} loading - Estado de carga
 * @param {string} title - Título opcional
 */
export function SPMPolarArea({
  data = [],
  options = {},
  height = 200,
  loading = false,
  title,
}) {
  const chartData = useMemo(() => {
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'label' in data[0]) {
      const labels = data.map(d => d.label);
      const values = data.map(d => d.value);
      const colors = data.map((d, i) => d.color || CHART_PALETTE[i % CHART_PALETTE.length]);
      return {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.map(c => `${c}CC`), // 80% opacidad
          borderColor: colors,
          borderWidth: 2,
        }],
      };
    }
    return { labels: [], datasets: [] };
  }, [data]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: ANIMATION_CONFIG,
    plugins: {
      legend: {
        display: false, // Usamos leyenda custom generalmente
      },
      tooltip: {
        ...TOOLTIP_CONFIG,
        callbacks: {
          label: (context) => {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const value = context.parsed.r;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${context.label}: ${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
      ...options.plugins,
    },
    scales: {
      r: {
        display: false, // Ocultar escala radial para diseño más limpio
        ...options.scales?.r,
      },
    },
    ...options,
  }), [options]);

  if (loading) {
    return <Skeleton variant="circular" width={height} height={height} sx={{ mx: 'auto' }} />;
  }

  if (!data || data.length === 0) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.disabled">Sin datos</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height, position: 'relative' }}>
      {title && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mb: 1,
            fontWeight: 600,
            color: 'text.secondary',
          }}
        >
          {title}
        </Typography>
      )}
      <PolarArea data={chartData} options={chartOptions} />
    </Box>
  );
}

// Export default con todos los componentes
export default {
  // Componentes
  SPMLine,
  SPMBar,
  SPMPie,
  SPMDoughnut,
  SPMPolarArea,
  SPMSparkline,
  SPMGauge,
  SPMArea,
  ProgressBar,
  ProgressCircle,
  // Tipografía
  FONT_FAMILY,
  FONT_SIZES,
  TEXT_COLORS,
  // Colores
  SPM_COLORS,
  CHART_PALETTE,
  STATUS_COLORS,
  PHASE_COLORS,
  TREND_COLORS,
  BUDGET_COLORS,
  // Configuraciones de Chart.js
  TOOLTIP_CONFIG,
  ANIMATION_CONFIG,
  LEGEND_CONFIG,
  createDataset,
  createPieData,
};
