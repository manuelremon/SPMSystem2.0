/**
 * Componentes de visualizacion reutilizables
 * Estilo: KPI Dashboard - Visual y moderno
 * Usando MUI X Charts donde es apropiado
 */

import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';

// Mini grafico de barras - MUI X Charts SparkLineChart
export function MiniBarChart({ data, color = "#1976d2", height = 64, width }) {
  if (!data || data.length === 0) return null;

  return (
    <SparkLineChart
      data={data}
      height={height}
      width={width}
      plotType="bar"
      colors={[color]}
      showHighlight
      showTooltip
    />
  );
}

// Circulo de progreso - MUI X Charts Gauge
export function ProgressCircle({
  percentage,
  size = 96,
  color = "#1976d2",
  showLabel = true,
  label
}) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Gauge
        value={percentage}
        valueMin={0}
        valueMax={100}
        height={size}
        width={size}
        startAngle={-110}
        endAngle={110}
        text={showLabel ? ({ value }) => `${value}%` : undefined}
        sx={{
          [`& .${gaugeClasses.valueText}`]: {
            fontSize: size > 80 ? 20 : 14,
            fontWeight: 'bold',
          },
          [`& .${gaugeClasses.valueArc}`]: {
            fill: color,
          },
        }}
      />
      {label && showLabel && (
        <div className="absolute bottom-0 left-0 right-0 text-center">
          <span className="text-xs text-slate-500">{label}</span>
        </div>
      )}
    </div>
  );
}

// Linea de tendencia mini - MUI X Charts SparkLineChart
export function TrendLine({ data, color = "#1976d2", height = 48, width, area = true }) {
  if (!data || data.length < 2) return null;

  return (
    <SparkLineChart
      data={data}
      height={height}
      width={width}
      plotType="line"
      colors={[color]}
      showHighlight
      showTooltip
      area={area}
    />
  );
}

// Barra de progreso horizontal
export function ProgressBar({
  value,
  max = 100,
  color = "#3B82F6",
  bgColor = "#F1F5F9",
  height = 8,
  showValue = false,
  label,
  gradient = false
}) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2 text-sm">
          {label && <span className="text-slate-500 font-medium">{label}</span>}
          {showValue && <span className="text-slate-800 font-semibold">{value}</span>}
        </div>
      )}
      <div
        className="rounded-full overflow-hidden"
        style={{ height, backgroundColor: bgColor }}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${gradient ? 'bg-gradient-to-r from-blue-500 to-blue-400' : ''}`}
          style={{
            width: `${percentage}%`,
            backgroundColor: gradient ? undefined : color
          }}
        />
      </div>
    </div>
  );
}

// Indicador de tendencia
export function TrendIndicator({ value, suffix = "%", positive = true }) {
  const isPositive = value >= 0;
  const displayValue = Math.abs(value);

  return (
    <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
      <svg
        className={`w-4 h-4 ${isPositive ? '' : 'rotate-180'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
      <span className="font-semibold">
        {isPositive ? '+' : '-'}{displayValue}{suffix}
      </span>
    </div>
  );
}

// Card de metrica estilo KPI - Enterprise Compact Style
// "Boring is Better" - No colored borders, clean and compact
export function KPICard({
  icon,
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  onClick,
  highlight = false,
  children
}) {
  return (
    <div
      className={`
        bg-white border border-slate-200 rounded-lg shadow-sm p-4
        ${onClick ? 'cursor-pointer' : ''}
        ${highlight ? 'ring-1 ring-blue-500/30' : ''}
      `}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {/* Header: Title + Icon */}
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {title}
        </p>
        {/* Icon: Small, muted gray, top-right */}
        <div className="text-slate-400 flex-shrink-0">
          {icon && (
            <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>
          )}
        </div>
      </div>

      {/* Value: Large, bold, left-aligned */}
      <p className="text-2xl font-bold text-slate-900 tabular-nums kpi-value leading-none">
        {value}
      </p>

      {/* Trend + Subtitle: Small and subtle below value */}
      {(trend !== undefined || subtitle) && (
        <div className="flex items-center gap-2 mt-2 text-xs">
          {trend !== undefined && <TrendIndicator value={trend} />}
          {subtitle && (
            <span className="text-slate-500">{trendLabel || subtitle}</span>
          )}
        </div>
      )}

      {children && <div className="mt-3 pt-3 border-t border-slate-200">{children}</div>}
    </div>
  );
}

// Stat compacto para grids
export function StatItem({ label, value, color = "#1e293b" }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}
