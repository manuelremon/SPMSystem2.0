/**
 * WeeklyRequestsKpiCard - Tarjeta KPI compacta con sparkline
 *
 * Muestra el total de solicitudes de la semana actual con:
 * - KPI grande (total semanal)
 * - Variacion vs semana pasada
 * - Sparkline minimalista
 */

import { Card, CardContent } from '../ui/Card'
import { TrendingUp, TrendingDown, Minus, FileText } from '../ui/Icons'
import clsx from 'clsx'

/**
 * Sparkline minimalista SVG
 * Sin ejes, sin grid, linea suave
 */
function Sparkline({ data, className = '' }) {
  // Fallback si no hay datos
  if (!data || data.length === 0 || data.every(v => v === 0)) {
    return (
      <div className={clsx('flex items-center justify-center text-slate-400 dark:text-slate-500', className)}>
        <span className="text-xs">Sin datos</span>
      </div>
    )
  }

  const width = 120
  const height = 40
  const padding = 4

  // Normalizar datos
  const values = data.map(v => Number(v) || 0)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1

  // Generar puntos para el path
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - 2 * padding)
    const y = height - padding - ((v - min) / range) * (height - 2 * padding)
    return { x, y, value: v }
  })

  // Crear path suave con curvas
  const pathD = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`

    // Control points para curva suave
    const prev = points[i - 1]
    const cpX = (prev.x + point.x) / 2
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${point.y}, ${point.x} ${point.y}`
  }, '')

  // Crear area bajo la curva
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`

  // Determinar color basado en tendencia
  const isPositive = values[values.length - 1] >= values[0]
  const strokeColor = isPositive ? '#10b981' : '#ef4444'
  const fillColor = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={clsx('overflow-visible', className)}
      preserveAspectRatio="none"
    >
      {/* Area de relleno sutil */}
      <path
        d={areaD}
        fill={fillColor}
        className="transition-all duration-300"
      />

      {/* Linea principal */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-300"
      />

      {/* Punto final (opcional, solo el ultimo) */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="3"
        fill={strokeColor}
        className="transition-all duration-300"
      />
    </svg>
  )
}

/**
 * Calcula estadisticas de la semana
 */
function calculateWeekStats(currentWeek, previousWeekTotal = null) {
  const current = (currentWeek || []).map(v => Number(v) || 0)
  const totalActual = current.reduce((a, b) => a + b, 0)

  // Si no hay datos de semana pasada, intentar estimar o mostrar N/A
  let variacion = null
  let variacionPct = null

  if (previousWeekTotal !== null && previousWeekTotal > 0) {
    variacion = totalActual - previousWeekTotal
    variacionPct = ((totalActual - previousWeekTotal) / previousWeekTotal) * 100
  }

  return {
    total: totalActual,
    variacion,
    variacionPct,
    promedio: current.length > 0 ? Math.round(totalActual / current.length) : 0,
    hasData: totalActual > 0 || current.some(v => v > 0)
  }
}

/**
 * Componente principal
 */
export function WeeklyRequestsKpiCard({
  data = [],
  previousWeekTotal = null,
  trendPercentage = null,
  className = ''
}) {
  // Calcular estadisticas
  const stats = calculateWeekStats(data, previousWeekTotal)

  // Usar trendPercentage del backend si esta disponible, sino calcular
  const displayVariacionPct = trendPercentage !== null ? trendPercentage : stats.variacionPct
  const hasVariacion = displayVariacionPct !== null && !isNaN(displayVariacionPct)

  // Determinar estado de variacion
  const isPositive = hasVariacion && displayVariacionPct > 0
  const isNegative = hasVariacion && displayVariacionPct < 0
  const isNeutral = hasVariacion && displayVariacionPct === 0

  return (
    <Card className={clsx(
      'bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border-white/30 dark:border-slate-700/30',
      className
    )}>
      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Seccion KPI (izquierda) */}
          <div className="flex-1">
            {/* Titulo */}
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 grid place-items-center">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Solicitudes esta semana
              </span>
            </div>

            {/* KPI Grande */}
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {stats.total.toLocaleString()}
              </span>

              {/* Variacion */}
              {hasVariacion ? (
                <div className={clsx(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium',
                  isPositive && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
                  isNegative && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                  isNeutral && 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                )}>
                  {isPositive && <TrendingUp className="w-3.5 h-3.5" />}
                  {isNegative && <TrendingDown className="w-3.5 h-3.5" />}
                  {isNeutral && <Minus className="w-3.5 h-3.5" />}
                  <span>
                    {isPositive ? '+' : ''}{displayVariacionPct.toFixed(0)}%
                  </span>
                </div>
              ) : (
                <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
              )}
            </div>

            {/* Subtexto */}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {hasVariacion ? 'vs semana pasada' : 'sin datos previos'}
              {stats.promedio > 0 && (
                <span className="ml-2 text-slate-400 dark:text-slate-500">
                  · {stats.promedio} prom/día
                </span>
              )}
            </p>
          </div>

          {/* Seccion Sparkline (derecha) */}
          <div className="w-full md:w-32 h-12 flex-shrink-0">
            <Sparkline data={data} className="w-full h-full" />
          </div>
        </div>

        {/* Labels de dias (opcional, muy sutil) */}
        <div className="flex justify-end mt-2 md:mt-0">
          <div className="flex gap-2 text-[10px] text-slate-400 dark:text-slate-500 w-32">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
              <span key={i} className="flex-1 text-center">{d}</span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default WeeklyRequestsKpiCard
