/**
 * MetricsChart - Grafico de tendencias de metricas
 *
 * Usa recharts para mostrar graficos de linea con metricas historicas
 */

import { useMemo, useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'

// Hook para detectar dark mode
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.getAttribute('data-theme') === 'dark'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
};

// Colores adaptativos para dark mode
const getChartColors = (isDark) => ({
  grid: isDark ? '#334155' : '#e2e8f0',       // slate-700 vs slate-200
  axis: isDark ? '#475569' : '#cbd5e1',       // slate-600 vs slate-300
  tick: isDark ? '#94a3b8' : '#94a3b8',       // slate-400 (mismo)
  tooltipBg: isDark ? '#1e293b' : 'white',    // slate-800 vs white
  tooltipBorder: isDark ? '#334155' : '#e2e8f0', // slate-700 vs slate-200
  tooltipText: isDark ? '#94a3b8' : '#64748b',   // slate-400 vs slate-500
});

// Configuracion de colores por tipo de metrica
const METRIC_CONFIG = {
  cpu: { color: '#3b82f6', name: 'CPU', unit: '%' },
  memory: { color: '#8b5cf6', name: 'Memoria', unit: '%' },
  latency_p50: { color: '#f59e0b', name: 'Latencia P50', unit: 'ms' },
  error_rate: { color: '#ef4444', name: 'Errores', unit: '%' },
  cache_hit: { color: '#10b981', name: 'Cache Hit', unit: '%' },
}

/**
 * Formatea timestamp para eje X
 */
function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Tooltip personalizado con soporte dark mode
 */
function CustomTooltip({ active, payload, label, colors }) {
  if (!active || !payload || !payload.length) return null

  return (
    <div
      className="rounded-lg shadow-lg p-3"
      style={{
        backgroundColor: colors?.tooltipBg || 'white',
        border: `1px solid ${colors?.tooltipBorder || '#e2e8f0'}`
      }}
    >
      <p className="text-xs mb-1" style={{ color: colors?.tooltipText || '#64748b' }}>
        {formatTime(label)}
      </p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toFixed(2)}{entry.unit || ''}
        </p>
      ))}
    </div>
  )
}

/**
 * Grafico simple de una metrica
 */
export function SingleMetricChart({ data, metricType, title, height = 200 }) {
  const isDarkMode = useDarkMode()
  const chartColors = getChartColors(isDarkMode)
  const config = METRIC_CONFIG[metricType] || { color: '#64748b', name: metricType, unit: '' }

  const chartData = useMemo(() => {
    if (!data || !data[metricType]) return []
    return data[metricType].map((point) => ({
      timestamp: point.timestamp,
      value: point.value,
    }))
  }, [data, metricType])

  if (!chartData.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title || config.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-slate-400 dark:text-slate-500">
            Sin datos historicos
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title || config.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`gradient-${metricType}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={config.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              tick={{ fontSize: 10, fill: chartColors.tick }}
              stroke={chartColors.axis}
            />
            <YAxis
              tick={{ fontSize: 10, fill: chartColors.tick }}
              stroke={chartColors.axis}
              unit={config.unit}
              domain={metricType === 'error_rate' ? [0, 'auto'] : ['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip colors={chartColors} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={2}
              fill={`url(#gradient-${metricType})`}
              name={config.name}
              unit={config.unit}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

/**
 * Grafico combinado de CPU y Memoria
 */
export function CpuMemoryChart({ data, height = 250 }) {
  const isDarkMode = useDarkMode()
  const chartColors = getChartColors(isDarkMode)

  const chartData = useMemo(() => {
    if (!data) return []

    const cpuData = data.cpu || []
    const memoryData = data.memory || []

    // Combinar datos por timestamp
    const combined = {}
    cpuData.forEach((p) => {
      combined[p.timestamp] = { timestamp: p.timestamp, cpu: p.value }
    })
    memoryData.forEach((p) => {
      if (combined[p.timestamp]) {
        combined[p.timestamp].memory = p.value
      } else {
        combined[p.timestamp] = { timestamp: p.timestamp, memory: p.value }
      }
    })

    return Object.values(combined).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    )
  }, [data])

  if (!chartData.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">CPU y Memoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-slate-400 dark:text-slate-500">
            Sin datos historicos
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">CPU y Memoria</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              tick={{ fontSize: 10, fill: chartColors.tick }}
              stroke={chartColors.axis}
            />
            <YAxis
              tick={{ fontSize: 10, fill: chartColors.tick }}
              stroke={chartColors.axis}
              unit="%"
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip colors={chartColors} />} />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="cpu"
              stroke={METRIC_CONFIG.cpu.color}
              strokeWidth={2}
              dot={false}
              name="CPU"
              unit="%"
            />
            <Line
              type="monotone"
              dataKey="memory"
              stroke={METRIC_CONFIG.memory.color}
              strokeWidth={2}
              dot={false}
              name="Memoria"
              unit="%"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

/**
 * Grafico de Latencia y Error Rate
 */
export function LatencyErrorChart({ data, height = 250 }) {
  const isDarkMode = useDarkMode()
  const chartColors = getChartColors(isDarkMode)

  const chartData = useMemo(() => {
    if (!data) return []

    const latencyData = data.latency_p50 || []
    const errorData = data.error_rate || []

    const combined = {}
    latencyData.forEach((p) => {
      combined[p.timestamp] = { timestamp: p.timestamp, latency: p.value }
    })
    errorData.forEach((p) => {
      if (combined[p.timestamp]) {
        combined[p.timestamp].errors = p.value
      } else {
        combined[p.timestamp] = { timestamp: p.timestamp, errors: p.value }
      }
    })

    return Object.values(combined).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    )
  }, [data])

  if (!chartData.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Latencia y Errores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-slate-400 dark:text-slate-500">
            Sin datos historicos
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Latencia y Errores</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              tick={{ fontSize: 10, fill: chartColors.tick }}
              stroke={chartColors.axis}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: chartColors.tick }}
              stroke={chartColors.axis}
              unit="ms"
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: chartColors.tick }}
              stroke={chartColors.axis}
              unit="%"
              domain={[0, 'auto']}
            />
            <Tooltip content={<CustomTooltip colors={chartColors} />} />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              iconType="line"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="latency"
              stroke={METRIC_CONFIG.latency_p50.color}
              strokeWidth={2}
              dot={false}
              name="Latencia P50"
              unit="ms"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="errors"
              stroke={METRIC_CONFIG.error_rate.color}
              strokeWidth={2}
              dot={false}
              name="Error Rate"
              unit="%"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export default { SingleMetricChart, CpuMemoryChart, LatencyErrorChart }
