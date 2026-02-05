/**
 * MetricsChart - Grafico de tendencias de metricas
 *
 * Usa Chart.js (SPMChartJS) para mostrar graficos de linea con metricas historicas
 */
import { useMemo } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';
import { SPMLine, SPM_COLORS } from '../../components/ui/SPMChartJS';

// Configuracion de colores por tipo de metrica
const METRIC_CONFIG = {
  cpu: { colorKey: 'primary', name: 'CPU', unit: '%' },
  memory: { colorKey: 'secondary', name: 'Memoria', unit: '%' },
  latency_p50: { colorKey: 'warning', name: 'Latencia P50', unit: 'ms' },
  error_rate: { colorKey: 'error', name: 'Errores', unit: '%' },
  cache_hit: { colorKey: 'success', name: 'Cache Hit', unit: '%' },
};

// Mapeo de colorKey a colores SPM
const COLOR_MAP = {
  primary: SPM_COLORS.primary,
  secondary: SPM_COLORS.secondary,
  warning: SPM_COLORS.warning,
  error: SPM_COLORS.error,
  success: SPM_COLORS.success,
  grey: SPM_COLORS.grey,
};

/**
 * Formatea timestamp para eje X
 */
function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Grafico simple de una metrica
 */
export function SingleMetricChart({ data, metricType, title, height = 200 }) {
  const theme = useTheme();
  const config = METRIC_CONFIG[metricType] || { colorKey: 'grey', name: metricType, unit: '' };
  const color = COLOR_MAP[config.colorKey] || SPM_COLORS.grey;

  const chartData = useMemo(() => {
    if (!data || !data[metricType]) return { labels: [], values: [] };
    const sortedData = [...data[metricType]].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return {
      labels: sortedData.map((point) => formatTime(new Date(point.timestamp))),
      values: sortedData.map((point) => point.value),
    };
  }, [data, metricType]);

  const NoDataPlaceholder = () => (
    <Box sx={{ px: 2, pb: 2 }}>
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.disabled',
        }}
      >
        Sin datos historicos
      </Box>
    </Box>
  );

  const chartOptions = useMemo(() => ({
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y?.toFixed(2)}${config.unit || ''}`,
        },
      },
    },
    scales: {
      y: {
        title: {
          display: true,
          text: config.unit,
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  }), [config.unit]);

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {title || config.name}
        </Typography>
      </Box>
      {!chartData.labels.length ? <NoDataPlaceholder /> : (
        <Box sx={{ pl: 1, pr: 2, pb: 1 }}>
          <SPMLine
            height={height}
            labels={chartData.labels}
            datasets={[{
              data: chartData.values,
              label: config.name,
              borderColor: color,
              backgroundColor: `${color}33`,
              fill: true,
              pointRadius: 0,
            }]}
            options={chartOptions}
          />
        </Box>
      )}
    </Paper>
  );
}


/**
 * Grafico combinado de CPU y Memoria
 */
export function CpuMemoryChart({ data, height = 250 }) {
  const theme = useTheme();

  const chartData = useMemo(() => {
    if (!data) return { labels: [], cpu: [], memory: [] };

    const cpuData = data.cpu || [];
    const memoryData = data.memory || [];

    const combined = {};
    cpuData.forEach((p) => {
      combined[p.timestamp] = { ...combined[p.timestamp], timestamp: new Date(p.timestamp), cpu: p.value };
    });
    memoryData.forEach((p) => {
      combined[p.timestamp] = { ...combined[p.timestamp], timestamp: new Date(p.timestamp), memory: p.value };
    });

    const sorted = Object.values(combined).sort((a, b) => a.timestamp - b.timestamp);

    return {
      labels: sorted.map(d => formatTime(d.timestamp)),
      cpu: sorted.map(d => d.cpu ?? null),
      memory: sorted.map(d => d.memory ?? null),
    };
  }, [data]);


  const NoDataPlaceholder = () => (
    <Box sx={{ px: 2, pb: 2 }}>
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
        Sin datos historicos
      </Box>
    </Box>
  );

  const chartOptions = useMemo(() => ({
    scales: {
      y: {
        min: 0,
        max: 100,
        title: {
          display: true,
          text: '%',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  }), []);

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          CPU y Memoria
        </Typography>
      </Box>
      {!chartData.labels.length ? <NoDataPlaceholder /> : (
        <Box sx={{ pl: 1, pr: 2, pb: 1 }}>
          <SPMLine
            height={height}
            labels={chartData.labels}
            datasets={[
              {
                data: chartData.cpu,
                label: 'CPU',
                borderColor: SPM_COLORS.primary,
                pointRadius: 0,
                spanGaps: true,
              },
              {
                data: chartData.memory,
                label: 'Memoria',
                borderColor: SPM_COLORS.secondary,
                pointRadius: 0,
                spanGaps: true,
              },
            ]}
            options={chartOptions}
          />
        </Box>
      )}
    </Paper>
  );
}

/**
 * Grafico de Latencia y Error Rate
 */
export function LatencyErrorChart({ data, height = 250 }) {
  const theme = useTheme();

  const chartData = useMemo(() => {
    if (!data) return { labels: [], latency: [], errors: [] };

    const latencyData = data.latency_p50 || [];
    const errorData = data.error_rate || [];

    const combined = {};
    latencyData.forEach((p) => {
      combined[p.timestamp] = { ...combined[p.timestamp], timestamp: new Date(p.timestamp), latency: p.value };
    });
    errorData.forEach((p) => {
      combined[p.timestamp] = { ...combined[p.timestamp], timestamp: new Date(p.timestamp), errors: p.value };
    });

    const sorted = Object.values(combined).sort((a, b) => a.timestamp - b.timestamp);

    return {
      labels: sorted.map(d => formatTime(d.timestamp)),
      latency: sorted.map(d => d.latency ?? null),
      errors: sorted.map(d => d.errors ?? null),
    };
  }, [data]);

  const NoDataPlaceholder = () => (
    <Box sx={{ px: 2, pb: 2 }}>
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
        Sin datos historicos
      </Box>
    </Box>
  );

  const chartOptions = useMemo(() => ({
    scales: {
      y: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'ms',
        },
      },
      y1: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: '%',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  }), []);

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Latencia y Errores
        </Typography>
      </Box>
      {!chartData.labels.length ? <NoDataPlaceholder /> : (
        <Box sx={{ pl: 1, pr: 2, pb: 1 }}>
          <SPMLine
            height={height}
            labels={chartData.labels}
            datasets={[
              {
                data: chartData.latency,
                label: 'Latencia P50 (ms)',
                borderColor: SPM_COLORS.warning,
                yAxisID: 'y',
                pointRadius: 0,
                spanGaps: true,
              },
              {
                data: chartData.errors,
                label: 'Error Rate (%)',
                borderColor: SPM_COLORS.error,
                yAxisID: 'y1',
                pointRadius: 0,
                spanGaps: true,
              },
            ]}
            options={chartOptions}
          />
        </Box>
      )}
    </Paper>
  );
}

export default { SingleMetricChart, CpuMemoryChart, LatencyErrorChart };
