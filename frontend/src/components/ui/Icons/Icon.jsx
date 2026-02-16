/**
 * Icon Component - Material UI Icons wrapper
 *
 * Wrapper para iconos de @mui/icons-material con soporte
 * para tamaños estandarizados y colores semánticos.
 */

import clsx from 'clsx';
import { ICON_DEFAULT_COLORS } from './iconMap';

// Tamaños estandarizados (Material UI usa fontSize)
const sizeMap = {
  xs: { fontSize: '0.75rem' },    // 12px - badges, dots
  sm: { fontSize: '1rem' },       // 16px - botones, inline, nav (default)
  md: { fontSize: '1.25rem' },    // 20px - alerts, headers, cards
  lg: { fontSize: '1.5rem' },     // 24px - titulos, destacados
  xl: { fontSize: '2rem' },       // 32px - empty states
  '2xl': { fontSize: '2.5rem' },  // 40px - hero sections
  '3xl': { fontSize: '3rem' },    // 48px - splash screens
};

// Clases de tamaño para compatibilidad con Tailwind
const sizeClasses = {
  xs: 'text-xs',
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
  '2xl': 'text-4xl',
  '3xl': 'text-5xl',
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
 * @param {React.ComponentType} icon - Componente de icono MUI
 * @param {string} size - Tamaño: xs, sm, md, lg, xl, 2xl, 3xl
 * @param {string} color - Color semantico o inherit
 * @param {string} className - Clases adicionales
 * @param {boolean} spin - Animacion de rotacion (para loaders)
 */
export function Icon({
  icon: IconComponent,
  size = 'sm',
  color = 'inherit',
  className = '',
  spin = false,
  ...props
}) {
  if (!IconComponent) {
    return null;
  }

  const sizeStyle = sizeMap[size] || sizeMap.sm;
  const colorClass = ICON_COLORS[color] || '';

  return (
    <IconComponent
      sx={sizeStyle}
      className={clsx(
        'flex-shrink-0',
        colorClass,
        spin && 'animate-spin',
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

// Importar iconos específicos para los presets
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningIcon from '@mui/icons-material/Warning';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AutorenewIcon from '@mui/icons-material/Autorenew';

// Iconos de estado preconfigurados (compatibilidad con sistema anterior)
export function SuccessIcon({ size = 'md', className, ...props }) {
  return <Icon icon={CheckCircleIcon} size={size} color="success" className={className} {...props} />;
}

export function ErrorIcon({ size = 'md', className, ...props }) {
  return <Icon icon={CancelIcon} size={size} color="error" className={className} {...props} />;
}

export function WarningIconPreset({ size = 'md', className, ...props }) {
  return <Icon icon={WarningIcon} size={size} color="warning" className={className} {...props} />;
}

export function InfoIcon({ size = 'md', className, ...props }) {
  return <Icon icon={InfoOutlinedIcon} size={size} color="info" className={className} {...props} />;
}

export function LoadingIcon({ size = 'md', className, ...props }) {
  return <Icon icon={AutorenewIcon} size={size} color="muted" className={className} spin {...props} />;
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
