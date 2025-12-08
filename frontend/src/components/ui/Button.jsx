import React from "react";
import { buttonStyles } from "../../utils/gradients";

/**
 * Button Component - Glass Morphism Style
 * Gradient buttons with glow effects and glass variants
 *
 * REFACTORIZADO: Usa sistema centralizado de gradients.js
 * para soporte de Dark Mode y consistencia visual
 */

// Inline styles importados desde sistema centralizado
// Las variantes glass (secondary, ghost, outline) NO usan inline styles
// para preservar el efecto backdrop-blur
const inlineStyles = buttonStyles;

const variants = {
  // Primary - Gradient con glow (acción principal)
  primary: `
    bg-gradient-to-r from-blue-500 to-blue-600
    text-white
    border border-blue-400/50
    shadow-lg shadow-blue-500/25
    hover:shadow-xl hover:shadow-blue-500/30
    hover:from-blue-600 hover:to-blue-700
    active:scale-[0.98]
  `,
  // Secondary - Glass effect (acción secundaria)
  secondary: `
    bg-white/50 dark:bg-slate-800/50
    backdrop-blur-sm
    text-slate-700 dark:text-slate-200
    border border-white/50 dark:border-white/10
    hover:bg-white/70 dark:hover:bg-slate-700/70
    hover:border-white/70 dark:hover:border-white/20
    active:scale-[0.98]
  `,
  // Ghost - Super sutil (acciones terciarias)
  ghost: `
    bg-transparent
    text-slate-600 dark:text-slate-300
    border border-transparent
    hover:bg-white/30 dark:hover:bg-slate-700/30
    hover:backdrop-blur-sm
    active:bg-white/40 dark:active:bg-slate-700/40
  `,
  // Danger - Rojo con glow
  danger: `
    bg-gradient-to-r from-red-500 to-red-600
    text-white
    border border-red-400/50
    shadow-lg shadow-red-500/25
    hover:shadow-xl hover:shadow-red-500/30
    hover:from-red-600 hover:to-red-700
    active:scale-[0.98]
  `,
  // Success - Verde con glow
  success: `
    bg-gradient-to-r from-emerald-500 to-emerald-600
    text-white
    border border-emerald-400/50
    shadow-lg shadow-emerald-500/25
    hover:shadow-xl hover:shadow-emerald-500/30
    hover:from-emerald-600 hover:to-emerald-700
    active:scale-[0.98]
  `,
  // Info - Sky blue con glow
  info: `
    bg-gradient-to-r from-sky-500 to-sky-600
    text-white
    border border-sky-400/50
    shadow-lg shadow-sky-500/25
    hover:shadow-xl hover:shadow-sky-500/30
    hover:from-sky-600 hover:to-sky-700
    active:scale-[0.98]
  `,
  // Warning - Amber con glow
  warning: `
    bg-gradient-to-r from-amber-500 to-amber-600
    text-white
    border border-amber-400/50
    shadow-lg shadow-amber-500/25
    hover:shadow-xl hover:shadow-amber-500/30
    hover:from-amber-600 hover:to-amber-700
    active:scale-[0.98]
  `,
  // Accent - Pink/Magenta con glow
  accent: `
    bg-gradient-to-r from-pink-500 to-pink-600
    text-white
    border border-pink-400/50
    shadow-lg shadow-pink-500/25
    hover:shadow-xl hover:shadow-pink-500/30
    hover:from-pink-600 hover:to-pink-700
    active:scale-[0.98]
  `,
  // Outline - Borde primario glass
  outline: `
    bg-white/30 dark:bg-slate-800/30
    backdrop-blur-sm
    text-blue-600 dark:text-blue-400
    border border-blue-400/50 dark:border-blue-500/50
    hover:bg-blue-50/50 dark:hover:bg-blue-900/30
    hover:border-blue-500/70 dark:hover:border-blue-400/70
    active:scale-[0.98]
  `,
  // Solid primary (legacy support)
  "primary-solid": `
    bg-gradient-to-r from-blue-500 to-blue-600
    text-white
    shadow-lg shadow-blue-500/25
    hover:shadow-xl hover:shadow-blue-500/30
    hover:from-blue-600 hover:to-blue-700
    active:scale-[0.98]
  `,
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-base",
};

export function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  className = "",
  children,
  disabled = false,
  style = {},
  ...props
}) {
  // Combinar inline styles del variant con los estilos pasados como prop
  const combinedStyle = {
    ...(inlineStyles[variant] || inlineStyles.primary),
    ...style
  };

  return (
    <Component
      className={`
        inline-flex items-center justify-center gap-2
        font-medium
        rounded-xl
        transition-all duration-300 ease-spring
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      style={combinedStyle}
      disabled={disabled}
      {...props}
    >
      {children}
    </Component>
  );
}
