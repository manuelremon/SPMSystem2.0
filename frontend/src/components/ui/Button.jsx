import React from "react";
import PropTypes from "prop-types";
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
  // Icon - Para botones de solo icono (ghost con hover suave)
  icon: `
    bg-transparent
    text-slate-500 dark:text-slate-400
    border border-transparent
    hover:bg-slate-100/70 dark:hover:bg-slate-700/50
    hover:text-slate-700 dark:hover:text-slate-200
    active:bg-slate-200/70 dark:active:bg-slate-600/50
    active:scale-[0.95]
  `,
  // Icon Primary - Icono con hover azul
  "icon-primary": `
    bg-transparent
    text-blue-500 dark:text-blue-400
    border border-transparent
    hover:bg-blue-50/70 dark:hover:bg-blue-900/30
    hover:text-blue-600 dark:hover:text-blue-300
    active:bg-blue-100/70 dark:active:bg-blue-800/30
    active:scale-[0.95]
  `,
  // Icon Danger - Icono con hover rojo
  "icon-danger": `
    bg-transparent
    text-red-500 dark:text-red-400
    border border-transparent
    hover:bg-red-50/70 dark:hover:bg-red-900/30
    hover:text-red-600 dark:hover:text-red-300
    active:bg-red-100/70 dark:active:bg-red-800/30
    active:scale-[0.95]
  `,
  // Icon Success - Icono con hover verde
  "icon-success": `
    bg-transparent
    text-emerald-500 dark:text-emerald-400
    border border-transparent
    hover:bg-emerald-50/70 dark:hover:bg-emerald-900/30
    hover:text-emerald-600 dark:hover:text-emerald-300
    active:bg-emerald-100/70 dark:active:bg-emerald-800/30
    active:scale-[0.95]
  `,
  // Icon Warning - Icono con hover amber
  "icon-warning": `
    bg-transparent
    text-amber-500 dark:text-amber-400
    border border-transparent
    hover:bg-amber-50/70 dark:hover:bg-amber-900/30
    hover:text-amber-600 dark:hover:text-amber-300
    active:bg-amber-100/70 dark:active:bg-amber-800/30
    active:scale-[0.95]
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
  xs: "px-2.5 py-1.5 text-xs",
  sm: "px-3.5 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-base",
  // Para icon buttons (cuadrado)
  "icon-xs": "p-1",
  "icon-sm": "p-1.5",
  "icon-md": "p-2",
  "icon-lg": "p-2.5",
};

// Focus ring colors per variant
const focusRings = {
  primary: "focus-visible:ring-blue-400/50",
  secondary: "focus-visible:ring-slate-400/50",
  ghost: "focus-visible:ring-slate-400/50",
  danger: "focus-visible:ring-red-400/50",
  success: "focus-visible:ring-emerald-400/50",
  info: "focus-visible:ring-sky-400/50",
  warning: "focus-visible:ring-amber-400/50",
  accent: "focus-visible:ring-pink-400/50",
  outline: "focus-visible:ring-blue-400/50",
  icon: "focus-visible:ring-slate-400/50",
  "icon-primary": "focus-visible:ring-blue-400/50",
  "icon-danger": "focus-visible:ring-red-400/50",
  "icon-success": "focus-visible:ring-emerald-400/50",
  "icon-warning": "focus-visible:ring-amber-400/50",
  "primary-solid": "focus-visible:ring-blue-400/50",
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
        rounded-lg
        transition-all duration-300 ease-spring
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        ${focusRings[variant] || focusRings.primary}
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

Button.propTypes = {
  as: PropTypes.elementType,
  variant: PropTypes.oneOf([
    "primary",
    "secondary",
    "ghost",
    "danger",
    "success",
    "info",
    "warning",
    "accent",
    "outline",
    "icon",
    "icon-primary",
    "icon-danger",
    "icon-success",
    "icon-warning",
    "primary-solid",
  ]),
  size: PropTypes.oneOf(["xs", "sm", "md", "lg", "icon-xs", "icon-sm", "icon-md", "icon-lg"]),
  className: PropTypes.string,
  children: PropTypes.node,
  disabled: PropTypes.bool,
  style: PropTypes.object,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
};

Button.defaultProps = {
  as: "button",
  variant: "primary",
  size: "md",
  className: "",
  disabled: false,
  style: {},
};
