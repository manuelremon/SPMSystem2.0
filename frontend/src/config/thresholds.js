/**
 * Umbrales de alertas y colores para el sistema de monitoreo
 * Centraliza todos los valores de threshold para facilitar ajustes
 */

// Umbrales para metricas de latencia (en ms)
export const LATENCY_THRESHOLDS = {
  good: 100,    // Verde: <= 100ms
  warning: 500, // Amarillo: 100-500ms
  // Rojo: > 500ms
}

// Umbrales para tasa de errores (en %)
export const ERROR_RATE_THRESHOLDS = {
  good: 1,    // Verde: <= 1%
  warning: 5, // Amarillo: 1-5%
  // Rojo: > 5%
}

// Umbrales para cache hit rate (en %)
export const CACHE_HIT_THRESHOLDS = {
  good: 90,    // Verde: >= 90%
  warning: 70, // Amarillo: 70-90%
  // Rojo: < 70%
}

// Umbrales para uso de CPU (en %)
export const CPU_THRESHOLDS = {
  good: 50,    // Verde: <= 50%
  warning: 80, // Amarillo: 50-80%
  // Rojo: > 80%
}

// Umbrales para uso de memoria (en %)
export const MEMORY_THRESHOLDS = {
  good: 60,    // Verde: <= 60%
  warning: 80, // Amarillo: 60-80%
  // Rojo: > 80%
}

// Umbrales para uso de disco (en %)
export const DISK_THRESHOLDS = {
  good: 70,    // Verde: <= 70%
  warning: 85, // Amarillo: 70-85%
  // Rojo: > 85%
}

// Colores del sistema - Corporate Blue Palette
export const COLORS = {
  success: '#2e7d32', // MUI Green 800
  warning: '#ed6c02', // MUI Orange 800
  danger: '#d32f2f',  // MUI Red 700
  info: '#0288d1',    // MUI Light Blue 700
  primary: '#567ebb', // Color3 - Azul medio
  muted: '#606d80',   // Color4 - Gris azulado
}

// Colores Tailwind para clases (Corporate Blue)
export const TAILWIND_COLORS = {
  success: {
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  warning: {
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    border: 'border-amber-200 dark:border-amber-800',
  },
  danger: {
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/30',
    border: 'border-red-200 dark:border-red-800',
  },
  info: {
    text: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-200 dark:border-blue-800',
  },
  muted: {
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    border: 'border-slate-200 dark:border-slate-700',
  },
}

/**
 * Obtiene la variante de color basada en un valor y tipo de metrica
 * @param {number} value - El valor a evaluar
 * @param {'latency'|'errorRate'|'cacheHit'|'cpu'|'memory'|'disk'} metricType - Tipo de metrica
 * @returns {'success'|'warning'|'danger'|'muted'} - Variante de color
 */
export function getVariantByMetric(value, metricType) {
  const thresholds = {
    latency: LATENCY_THRESHOLDS,
    errorRate: ERROR_RATE_THRESHOLDS,
    cacheHit: CACHE_HIT_THRESHOLDS,
    cpu: CPU_THRESHOLDS,
    memory: MEMORY_THRESHOLDS,
    disk: DISK_THRESHOLDS,
  }

  const threshold = thresholds[metricType]
  if (!threshold) return 'muted'

  // Cache hit es inverso (mayor es mejor)
  if (metricType === 'cacheHit') {
    if (value >= threshold.good) return 'success'
    if (value >= threshold.warning) return 'warning'
    return 'danger'
  }

  // El resto son directos (menor es mejor)
  if (value <= threshold.good) return 'success'
  if (value <= threshold.warning) return 'warning'
  return 'danger'
}

/**
 * Obtiene el color hex basado en un valor y tipo de metrica
 * @param {number} value - El valor a evaluar
 * @param {'latency'|'errorRate'|'cacheHit'|'cpu'|'memory'|'disk'} metricType - Tipo de metrica
 * @returns {string} - Color hex
 */
export function getColorByMetric(value, metricType) {
  const variant = getVariantByMetric(value, metricType)
  return COLORS[variant] || COLORS.muted
}

/**
 * Exportacion de todos los umbrales para referencia
 */
export const THRESHOLDS = {
  latency: LATENCY_THRESHOLDS,
  errorRate: ERROR_RATE_THRESHOLDS,
  cacheHit: CACHE_HIT_THRESHOLDS,
  cpu: CPU_THRESHOLDS,
  memory: MEMORY_THRESHOLDS,
  disk: DISK_THRESHOLDS,
}

export default THRESHOLDS
