/**
 * Icon Component - Sistema de iconos unificado
 * Tamaños y colores estandarizados para UI consistente
 *
 * Usa SVGs locales en lugar de lucide-react
 */

import clsx from "clsx";

// Importar iconos para presets
import CheckCircleFill from "./Icons/svg/checkmark_circle_fill.svg?react";
import XCircleFill from "./Icons/svg/xmark_circle_fill.svg?react";
import AlertTriangleFill from "./Icons/svg/exclamationmark_triangle_fill.svg?react";
import InfoCircle from "./Icons/svg/info_circle.svg?react";
import ArrowCirclepath from "./Icons/svg/arrow_2_circlepath.svg?react";

// Sistema de tamaños estandarizado
export const ICON_SIZES = {
  xs: "w-3 h-3",      // Muy pequeño: badges, dots
  sm: "w-4 h-4",      // Pequeño: botones, inline, nav
  md: "w-5 h-5",      // Mediano: alerts, headers, cards
  lg: "w-6 h-6",      // Grande: títulos, destacados
  xl: "w-8 h-8",      // Extra grande: empty states
  "2xl": "w-12 h-12", // Hero: success states
  "3xl": "w-16 h-16", // Máximo: splash screens
};

// Sistema de colores semánticos
export const ICON_COLORS = {
  // Estados
  success: "text-emerald-600",
  error: "text-red-600",
  warning: "text-amber-500",
  info: "text-blue-600",

  // Tonos neutros
  muted: "text-slate-400",
  subtle: "text-slate-500",
  default: "text-slate-600",
  strong: "text-slate-700",

  // Acciones
  primary: "text-blue-600",
  secondary: "text-slate-600",
  accent: "text-indigo-600",

  // Especiales
  white: "text-white",
  current: "text-current",
  inherit: "inherit",
};

/**
 * Icon wrapper component for consistent styling
 *
 * @param {React.ComponentType} icon - SVG icon component
 * @param {string} size - Size key: xs, sm, md, lg, xl, 2xl, 3xl
 * @param {string} color - Color key from ICON_COLORS
 * @param {string} className - Additional classes
 * @param {boolean} spin - Add spin animation (for loaders)
 */
export function Icon({
  icon: IconComponent,
  size = "sm",
  color,
  className,
  spin = false,
  ...props
}) {
  if (!IconComponent) return null;

  return (
    <IconComponent
      className={clsx(
        ICON_SIZES[size] || ICON_SIZES.sm,
        color && ICON_COLORS[color],
        spin && "animate-spin",
        "flex-shrink-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * Preset icons for common use cases
 * Usan SVGs locales con colores semanticos
 */

// Status icons with correct colors (usando SVGs locales)
export function SuccessIcon({ size = "md", className }) {
  return <Icon icon={CheckCircleFill} size={size} color="success" className={className} />;
}

export function ErrorIcon({ size = "md", className }) {
  return <Icon icon={XCircleFill} size={size} color="error" className={className} />;
}

export function WarningIcon({ size = "md", className }) {
  return <Icon icon={AlertTriangleFill} size={size} color="warning" className={className} />;
}

export function InfoIcon({ size = "md", className }) {
  return <Icon icon={InfoCircle} size={size} color="info" className={className} />;
}

export function LoadingIcon({ size = "md", className }) {
  return <Icon icon={ArrowCirclepath} size={size} color="muted" spin className={className} />;
}

export default Icon;
