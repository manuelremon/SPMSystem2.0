/**
 * Chart.js Theme Configuration for SPM
 *
 * Colores corporativos y configuración global de Chart.js
 * Unified with CSS Design System (index.css)
 * Tipografía: Inter (consistent with Design System)
 */

// Familia tipográfica global - Consistent with CSS Design System
export const FONT_FAMILY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/**
 * Escala tipográfica unificada para dashboards y cards
 * Basada en escala de 4px (rem relativo a 16px base)
 */
export const FONT_SIZES = {
  // Tamaños para UI compacta (cards, dashboards)
  xs: '0.625rem',      // 10px - índices, números de ranking
  sm: '0.6875rem',     // 11px - leyendas de charts, labels compactos
  md: '0.75rem',       // 12px - caption estándar, texto secundario en cards
  lg: '0.8125rem',     // 13px - texto principal en cards compactas
  xl: '0.875rem',      // 14px - body estándar

  // Tamaños para headings
  h6: '0.875rem',      // 14px
  h5: '1rem',          // 16px
  h4: '1.125rem',      // 18px
  h3: '1.25rem',       // 20px
  h2: '1.5rem',        // 24px
  h1: '2rem',          // 32px
};

/**
 * Colores de texto unificados - Consistent with CSS Design System
 */
export const TEXT_COLORS = {
  primary: '#0f172a',        // --fg (fg-strong)
  secondary: '#475569',      // --fg-muted
  disabled: '#94a3b8',       // --fg-subtle
  muted: '#94a3b8',          // --fg-subtle
  white: '#ffffff',          // Texto sobre fondos oscuros
};

// Paleta de colores SPM - Unified with CSS Design System (index.css)
export const SPM_COLORS = {
  // Primarios - SAP Blue (consistent with --primary)
  primary: '#0070f3',
  primaryLight: '#3291ff',
  primaryDark: '#0051a8',

  // Secundarios - Neutral Gray (consistent with --secondary)
  secondary: '#475569',
  secondaryLight: '#64748b',
  secondaryDark: '#334155',

  // Estados - Consistent with CSS Design System
  success: '#16a34a',
  successLight: '#22c55e',
  warning: '#d97706',
  warningLight: '#f59e0b',
  error: '#dc2626',
  errorLight: '#ef4444',
  info: '#0284c7',
  infoLight: '#0ea5e9',

  // Neutrales - Consistent with CSS greys
  grey: '#64748b',
  greyLight: '#e2e8f0',
  greyDark: '#475569',

  // Texto - Consistent with --fg variables
  text: '#0f172a',
  textSecondary: '#475569',

  // Fondos - Consistent with --bg variables
  background: '#ffffff',
  backgroundAlt: '#f1f5f9',

  // Bordes - Consistent with --border
  border: '#e2e8f0',
};

// Paleta para series múltiples - Consistent with CSS --chart-* variables
export const CHART_PALETTE = [
  '#0070f3', // Primary Blue (--chart-1)
  '#10b981', // Emerald (--chart-2)
  '#f59e0b', // Amber (--chart-3)
  '#ef4444', // Red (--chart-4)
  '#8b5cf6', // Purple (--chart-5)
  '#06b6d4', // Cyan (--chart-6)
  '#f97316', // Orange (--chart-7)
  '#ec4899', // Pink (--chart-8)
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];

// Paleta unificada para estados de solicitudes - Bien diferenciada
export const STATUS_COLORS = {
  // Estados principales de solicitudes
  borrador: '#94a3b8',      // Gris - No iniciado
  enviadas: '#3b82f6',      // Azul - Pendiente de aprobación
  enviada: '#3b82f6',       // Alias
  pendiente: '#3b82f6',     // Alias (pendiente = enviada)
  revision: '#3b82f6',      // Alias
  aprobadas: '#10b981',     // Verde - Aprobado
  aprobado: '#10b981',      // Alias
  enProceso: '#f97316',     // Naranja - En progreso/Compra
  en_proceso: '#f97316',    // Alias
  planificacion: '#f97316', // Alias (planificación = en proceso)
  rechazadas: '#ef4444',    // Rojo - Rechazado
  rechazado: '#ef4444',     // Alias
  despachada: '#06b6d4',    // Cyan - Despachada (específico)
  cerradas: '#6366f1',      // Índigo - Cerrado/Completado
  completado: '#6366f1',    // Alias
  cancelado: '#8b5cf6',     // Púrpura - Cancelado
};

// Colores para fases de gestión (Tiempos) - Using CSS Design System colors
export const PHASE_COLORS = {
  aprobacion: { bg: '#0070f3', text: '#0051a8' },    // Primary blue
  planificacion: { bg: '#8b5cf6', text: '#7c3aed' }, // Purple (planning)
  proveedor: { bg: '#10b981', text: '#059669' },     // Emerald (success)
};

// Colores para tendencias (TrendChart) - Consistent with STATUS_COLORS
export const TREND_COLORS = {
  aprobadas: '#10b981',   // --success
  rechazadas: '#ef4444',  // --danger
  pendientes: '#f59e0b',  // --warning
};

// Colores para criticidad - Using CSS Design System colors
export const CRITICIDAD_COLORS = {
  Critico: '#dc2626',     // --danger
  Alto: '#f97316',        // --orange
  Normal: '#0070f3',      // --primary
  Bajo: '#16a34a',        // --success
};

// Colores para presupuesto (Budget) - Consistent with CSS Design System
export const BUDGET_COLORS = {
  total: '#0070f3',        // --primary - presupuesto total
  utilizado: '#f59e0b',    // --warning - consumido/utilizado
  disponible: '#10b981',   // --success - disponible
  excedido: '#ef4444',     // --danger - sobrepasado
};

/**
 * Configuración unificada de tooltips para todos los gráficos
 */
export const TOOLTIP_CONFIG = {
  enabled: true,
  backgroundColor: 'rgba(17, 24, 39, 0.95)',  // Gray-900 casi opaco
  titleColor: '#ffffff',
  bodyColor: '#e5e7eb',
  borderColor: 'rgba(255, 255, 255, 0.1)',
  borderWidth: 1,
  padding: 12,
  cornerRadius: 8,
  titleFont: {
    family: FONT_FAMILY,
    size: 13,
    weight: '600',
  },
  bodyFont: {
    family: FONT_FAMILY,
    size: 12,
    weight: '400',
  },
  displayColors: true,
  boxWidth: 8,
  boxHeight: 8,
  boxPadding: 4,
  usePointStyle: true,
  caretSize: 6,
  caretPadding: 8,
};

/**
 * Configuración unificada de animaciones
 */
export const ANIMATION_CONFIG = {
  duration: 400,
  easing: 'easeOutQuart',
  // Animaciones específicas por propiedad
  animations: {
    numbers: {
      type: 'number',
      properties: ['x', 'y', 'borderWidth', 'radius', 'tension'],
    },
    colors: {
      type: 'color',
      properties: ['color', 'borderColor', 'backgroundColor'],
      duration: 300,
    },
  },
  // Hover
  hover: {
    animationDuration: 150,
  },
  // Resize
  resize: {
    duration: 0,
  },
};

/**
 * Estilo unificado para leyendas
 */
export const LEGEND_CONFIG = {
  display: true,
  position: 'top',
  align: 'end',
  labels: {
    usePointStyle: true,
    pointStyle: 'circle',
    boxWidth: 8,
    boxHeight: 8,
    padding: 16,
    font: {
      family: FONT_FAMILY,
      size: 11,
      weight: '500',
    },
    color: SPM_COLORS.textSecondary,
  },
};

/**
 * Configuración global por defecto para Chart.js
 */
export const getDefaultOptions = (type = 'line') => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  animation: ANIMATION_CONFIG,
  plugins: {
    legend: LEGEND_CONFIG,
    tooltip: TOOLTIP_CONFIG,
  },
  scales: type === 'pie' || type === 'doughnut' ? undefined : {
    x: {
      grid: {
        color: SPM_COLORS.greyLight,
        drawBorder: false,
      },
      ticks: {
        font: {
          family: FONT_FAMILY,
          size: 11,
        },
        color: SPM_COLORS.textSecondary,
      },
    },
    y: {
      grid: {
        color: SPM_COLORS.greyLight,
        drawBorder: false,
      },
      ticks: {
        font: {
          family: FONT_FAMILY,
          size: 11,
        },
        color: SPM_COLORS.textSecondary,
      },
      beginAtZero: true,
    },
  },
});

/**
 * Crear dataset con estilo SPM
 */
export const createDataset = (label, data, colorIndex = 0, options = {}) => {
  const color = CHART_PALETTE[colorIndex % CHART_PALETTE.length];

  return {
    label,
    data,
    borderColor: color,
    backgroundColor: options.fill ? `${color}33` : color,
    borderWidth: options.borderWidth || 2,
    tension: options.tension || 0.4,
    fill: options.fill || false,
    pointRadius: options.pointRadius ?? 3,
    pointHoverRadius: options.pointHoverRadius ?? 5,
    ...options,
  };
};

/**
 * Crear datos para gráfico de pastel/dona
 */
export const createPieData = (labels, values, colors = CHART_PALETTE) => ({
  labels,
  datasets: [{
    data: values,
    backgroundColor: colors.slice(0, labels.length),
    borderColor: '#ffffff',
    borderWidth: 2,
    hoverOffset: 4,
  }],
});

export default {
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
  CRITICIDAD_COLORS,
  BUDGET_COLORS,
  // Configuraciones de Chart.js
  TOOLTIP_CONFIG,
  ANIMATION_CONFIG,
  LEGEND_CONFIG,
  getDefaultOptions,
  createDataset,
  createPieData,
};
