/**
 * Icon Component - Sistema de iconos SVG local
 *
 * Reemplaza lucide-react con SVGs locales del paquete SF Symbols.
 * Soporta tamaños estandarizados y colores semanticos via Tailwind.
 */

import clsx from 'clsx';
import { ICON_DEFAULT_COLORS } from './iconMap';

// Tamaños estandarizados (coinciden con el sistema anterior)
const sizeClasses = {
  xs: 'w-3 h-3',      // 12px - badges, dots
  sm: 'w-4 h-4',      // 16px - botones, inline, nav (default)
  md: 'w-5 h-5',      // 20px - alerts, headers, cards
  lg: 'w-6 h-6',      // 24px - titulos, destacados
  xl: 'w-8 h-8',      // 32px - empty states
  '2xl': 'w-10 h-10', // 40px - hero sections
  '3xl': 'w-12 h-12', // 48px - splash screens
};

// Colores semanticos - exportados como ICON_COLORS para uso directo
export const ICON_COLORS = {
  // Estados
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',

  // Tonos
  muted: 'text-slate-400',
  subtle: 'text-slate-500',
  default: 'text-slate-600',
  strong: 'text-slate-700',

  // Acciones
  primary: 'text-blue-600',
  secondary: 'text-slate-600',
  accent: 'text-indigo-600',

  // Categorías semánticas
  danger: 'text-red-500',           // Eliminar, cancelar
  notification: 'text-amber-500',   // Campana, alertas
  money: 'text-amber-700',          // Billetera, dinero
  logistics: 'text-indigo-500',     // Paquetes, envío
  communication: 'text-violet-500', // Mensajes, correo
  time: 'text-cyan-500',            // Reloj, calendario
  users: 'text-teal-500',           // Usuarios
  charts: 'text-pink-500',          // Gráficos
  favorites: 'text-yellow-500',     // Estrellas, trofeos
  ai: 'text-purple-500',            // IA, magia

  // Especiales
  white: 'text-white',
  current: 'text-current',
  inherit: '',
};

/**
 * Componente Icon principal
 *
 * @param {React.ComponentType} icon - Componente SVG importado
 * @param {string} size - Tamaño: xs, sm, md, lg, xl, 2xl, 3xl
 * @param {string} color - Color semantico o inherit
 * @param {string} className - Clases adicionales
 * @param {boolean} spin - Animacion de rotacion (para loaders)
 */
export function Icon({
  icon: SvgComponent,
  size = 'sm',
  color = 'inherit',
  className = '',
  spin = false,
  ...props
}) {
  if (!SvgComponent) {
    console.warn('Icon: No se proporciono componente de icono');
    return null;
  }

  const sizeClass = sizeClasses[size] || sizeClasses.sm;
  const colorClass = ICON_COLORS[color] || '';

  return (
    <SvgComponent
      className={clsx(
        'flex-shrink-0',
        sizeClass,
        colorClass,
        spin && 'animate-spin',
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

// Iconos de estado preconfigurados (compatibilidad con sistema anterior)
export function SuccessIcon({ size = 'md', className, ...props }) {
  const CheckCircleFill = require('./svg/checkmark_circle_fill.svg?react').default;
  return <Icon icon={CheckCircleFill} size={size} color="success" className={className} {...props} />;
}

export function ErrorIcon({ size = 'md', className, ...props }) {
  const XCircleFill = require('./svg/xmark_circle_fill.svg?react').default;
  return <Icon icon={XCircleFill} size={size} color="error" className={className} {...props} />;
}

export function WarningIcon({ size = 'md', className, ...props }) {
  const AlertTriangleFill = require('./svg/exclamationmark_triangle_fill.svg?react').default;
  return <Icon icon={AlertTriangleFill} size={size} color="warning" className={className} {...props} />;
}

export function InfoIcon({ size = 'md', className, ...props }) {
  const InfoCircle = require('./svg/info_circle.svg?react').default;
  return <Icon icon={InfoCircle} size={size} color="info" className={className} {...props} />;
}

export function LoadingIcon({ size = 'md', className, ...props }) {
  const ArrowCircle = require('./svg/arrow_2_circlepath.svg?react').default;
  return <Icon icon={ArrowCircle} size={size} color="muted" className={className} spin {...props} />;
}

/**
 * Obtiene la clase de color Tailwind para un icono según su semántica
 * @param {string} iconName - Nombre del icono (ej: 'CheckCircle', 'XCircle')
 * @returns {string} Clase Tailwind de color (ej: 'text-emerald-500')
 */
export function getIconColorClass(iconName) {
  const semanticColor = ICON_DEFAULT_COLORS[iconName];
  return ICON_COLORS[semanticColor] || ICON_COLORS.default;
}

/**
 * Obtiene el nombre de color semántico para un icono
 * @param {string} iconName - Nombre del icono
 * @returns {string} Nombre semántico (ej: 'success', 'danger')
 */
export function getIconSemanticColor(iconName) {
  return ICON_DEFAULT_COLORS[iconName] || 'default';
}

export default Icon;
