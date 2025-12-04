/**
 * Componentes de visualizacion reutilizables
 * Estilo: KPI Dashboard - Visual y moderno
 */

// Mini grafico de barras
export function MiniBarChart({ data, maxValue, color = "var(--primary)", height = 64 }) {
  const max = maxValue || Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((value, idx) => {
        const barHeight = (value / max) * 100;
        return (
          <div
            key={idx}
            className="flex-1 rounded-t-sm transition-all duration-300 hover:opacity-80"
            style={{
              height: `${barHeight}%`,
              backgroundColor: color,
              minHeight: value > 0 ? '4px' : '0'
            }}
            title={value.toString()}
          />
        );
      })}
    </div>
  );
}

// Circulo de progreso
export function ProgressCircle({
  percentage,
  size = 96,
  strokeWidth = 8,
  color = "var(--primary)",
  bgColor = "var(--border)",
  showLabel = true,
  label
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-[var(--fg)]">{percentage}%</span>
          {label && <span className="text-xs text-[var(--fg-muted)]">{label}</span>}
        </div>
      )}
    </div>
  );
}

// Linea de tendencia mini
export function TrendLine({ data, color = "var(--primary)", height = 48 }) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, idx) => {
      const x = (idx / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div style={{ height }} className="w-full">
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        <polyline
          points={`0,100 ${points} 100,100`}
          fill={color}
          fillOpacity="0.1"
        />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

// Barra de progreso horizontal
export function ProgressBar({
  value,
  max = 100,
  color = "var(--primary)",
  bgColor = "var(--bg-soft)",
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
          {label && <span className="text-[var(--fg-muted)] font-medium">{label}</span>}
          {showValue && <span className="text-[var(--fg)] font-semibold">{value}</span>}
        </div>
      )}
      <div
        className="rounded-full overflow-hidden"
        style={{ height, backgroundColor: bgColor }}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${gradient ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-bright)]' : ''}`}
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

// Card de metrica estilo KPI
export function KPICard({
  icon,
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  borderColor = "var(--primary)",
  iconBgColor,
  onClick,
  highlight = false,
  children
}) {
  const bgColor = iconBgColor || `${borderColor}20`;

  const cardClasses = `
    bg-[var(--card)] border border-[var(--border)] rounded-xl
    border-l-4 transition-all duration-200
    ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.01]' : ''}
    ${highlight ? 'ring-2 ring-[var(--warning)] ring-opacity-50 animate-pulse-subtle' : ''}
  `;

  return (
    <div
      className={cardClasses}
      style={{ borderLeftColor: borderColor }}
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
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-1">
              {title}
            </p>
            <p className="text-3xl font-bold text-[var(--fg)]">{value}</p>
          </div>
          <div
            className="h-12 w-12 rounded-full grid place-items-center flex-shrink-0"
            style={{ backgroundColor: bgColor, color: borderColor }}
          >
            {icon}
          </div>
        </div>

        {(trend !== undefined || subtitle) && (
          <div className="flex items-center gap-2 text-sm">
            {trend !== undefined && <TrendIndicator value={trend} />}
            {subtitle && <span className="text-[var(--fg-muted)]">{trendLabel || subtitle}</span>}
          </div>
        )}

        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}

// Stat compacto para grids
export function StatItem({ label, value, color = "var(--fg)" }) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
