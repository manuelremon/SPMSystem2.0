/**
 * WeeklyRequestsKpiCard - Tarjeta KPI profesional con sparkline
 *
 * Muestra el total de solicitudes con:
 * - KPI grande con indicador de tendencia
 * - Sparkline elegante con gradiente y puntos
 * - Comparación con período anterior
 * - Tooltip interactivo
 */

import { useMemo } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { Line } from 'react-chartjs-2';
import { TrendingUp, TrendingDown } from '../ui/Icons';
import { FONT_SIZES, TOOLTIP_CONFIG } from '../ui/SPMChartJS';

/**
 * Colores para el chart profesional
 */
const CHART_COLORS = {
  positive: {
    line: '#10b981',
    gradient: ['rgba(16, 185, 129, 0.3)', 'rgba(16, 185, 129, 0.02)'],
    point: '#10b981',
  },
  negative: {
    line: '#ef4444',
    gradient: ['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.02)'],
    point: '#ef4444',
  },
  neutral: {
    line: '#3b82f6',
    gradient: ['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.02)'],
    point: '#3b82f6',
  },
};

/**
 * Sparkline profesional con gradiente y puntos
 */
function ProfessionalSparkline({ data, labels = [], height = 60, trend = 'neutral' }) {
  // Fallback si no hay datos
  if (!data || data.length === 0 || data.every(v => v === 0)) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height,
          color: 'text.disabled',
        }}
      >
        <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs }}>
          Sin datos disponibles
        </Typography>
      </Box>
    );
  }

  // Normalizar datos
  const values = data.map(v => Number(v) || 0);
  const colors = CHART_COLORS[trend] || CHART_COLORS.neutral;

  // Configuración del chart
  const chartData = useMemo(() => ({
    labels: labels.length > 0 ? labels : values.map((_, i) => `Día ${i + 1}`),
    datasets: [{
      data: values,
      borderColor: colors.line,
      borderWidth: 2.5,
      tension: 0.4,
      fill: true,
      backgroundColor: (context) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, colors.gradient[0]);
        gradient.addColorStop(1, colors.gradient[1]);
        return gradient;
      },
      pointRadius: 0,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: '#ffffff',
      pointHoverBorderColor: colors.point,
      pointHoverBorderWidth: 2.5,
    }],
  }), [values, labels, colors, height]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800,
      easing: 'easeOutQuart',
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_CONFIG,
        callbacks: {
          title: (items) => items[0]?.label || '',
          label: (context) => `${context.parsed.y} solicitudes`,
        },
      },
    },
    scales: {
      x: { display: false },
      y: {
        display: false,
        beginAtZero: true,
        // Agregar padding para que la línea no toque los bordes
        grace: '10%',
      },
    },
    elements: {
      line: {
        capBezierPoints: true,
      },
    },
  }), []);

  return (
    <Box sx={{ width: '100%', height, position: 'relative' }}>
      <Line data={chartData} options={chartOptions} />
    </Box>
  );
}

/**
 * Calcula estadísticas y tendencia
 */
function calculateStats(currentData, previousTotal = null) {
  const current = (currentData || []).map(v => Number(v) || 0);
  const total = current.reduce((a, b) => a + b, 0);
  const promedio = current.length > 0 ? Math.round(total / current.length) : 0;
  const max = Math.max(...current, 0);
  const min = Math.min(...current.filter(v => v > 0), 0) || 0;

  let variacion = null;
  let variacionPct = null;
  let trend = 'neutral';

  if (previousTotal !== null && previousTotal > 0) {
    variacion = total - previousTotal;
    variacionPct = ((total - previousTotal) / previousTotal) * 100;
    trend = variacionPct > 0 ? 'positive' : variacionPct < 0 ? 'negative' : 'neutral';
  } else if (current.length >= 2) {
    // Calcular tendencia basada en primera vs última mitad
    const mid = Math.floor(current.length / 2);
    const firstHalf = current.slice(0, mid).reduce((a, b) => a + b, 0);
    const secondHalf = current.slice(mid).reduce((a, b) => a + b, 0);
    trend = secondHalf > firstHalf ? 'positive' : secondHalf < firstHalf ? 'negative' : 'neutral';
  }

  return {
    total,
    promedio,
    max,
    min,
    variacion,
    variacionPct,
    trend,
    hasData: total > 0 || current.some(v => v > 0),
  };
}

/**
 * Indicador de tendencia con icono y porcentaje
 */
function TrendIndicator({ variacionPct, trend }) {
  if (variacionPct === null) return null;

  const isPositive = trend === 'positive';
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const color = isPositive ? '#10b981' : '#ef4444';
  const bgColor = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.5}
      sx={{
        px: 1,
        py: 0.25,
        backgroundColor: bgColor,
      }}
    >
      <Icon size={14} style={{ color }} />
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color,
          fontSize: FONT_SIZES.xs,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Math.abs(variacionPct).toFixed(1)}%
      </Typography>
    </Stack>
  );
}

/**
 * Componente principal - WeeklyRequestsKpiCard
 */
export function WeeklyRequestsKpiCard({
  data = [],
  labels = [],
  previousWeekTotal = null,
  title = 'Solicitudes creadas',
  subtitle = 'Esta semana',
  compact = false,
  sx = {},
}) {
  // Calcular estadísticas
  const stats = calculateStats(data, previousWeekTotal);

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        height: '100%',
        backgroundColor: '#ffffff',
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease-in-out',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        },
        ...sx,
      }}
    >
      <Box sx={{ p: compact ? 1.5 : 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header: Título a la izquierda, KPI a la derecha */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
          <Box>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontSize: FONT_SIZES.md,
                display: 'block',
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.disabled',
                fontSize: FONT_SIZES.xs,
              }}
            >
              {subtitle}
            </Typography>
          </Box>
          {/* KPI Principal + Tendencia en esquina superior derecha */}
          <Stack alignItems="flex-end" spacing={0.5}>
            <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ px: 1.5, py: 0.5, bgcolor: 'grey.100' }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {stats.total.toLocaleString()}
              </Typography>
            </Stack>
            <TrendIndicator variacionPct={stats.variacionPct} trend={stats.trend} />
          </Stack>
        </Stack>

        {/* Sparkline */}
        <Box sx={{ flex: 1, minHeight: 50 }}>
          <ProfessionalSparkline
            data={data}
            labels={labels}
            height={compact ? 40 : 55}
            trend={stats.trend}
          />
        </Box>

        {/* Footer: Métricas secundarias */}
        {!compact && stats.hasData && (
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{
              mt: 1,
              pt: 1,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box>
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', fontSize: FONT_SIZES.xs, display: 'block' }}
              >
                Promedio diario
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: 'text.secondary', fontSize: FONT_SIZES.sm }}
              >
                {stats.promedio}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', fontSize: FONT_SIZES.xs, display: 'block' }}
              >
                Máximo
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: 'text.secondary', fontSize: FONT_SIZES.sm }}
              >
                {stats.max}
              </Typography>
            </Box>
          </Stack>
        )}
      </Box>
    </Paper>
  );
}

export default WeeklyRequestsKpiCard;
