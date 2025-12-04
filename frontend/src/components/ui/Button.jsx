import React from "react";

const variants = {
  // Estilo principal con borde de color (nuevo estilo consistente)
  primary: `
    bg-transparent
    text-[var(--primary)]
    border border-[var(--primary)]
    hover:bg-[var(--primary)]
    hover:text-[var(--on-primary)]
    active:brightness-95
  `,
  // Estilo secundario con borde sutil
  secondary: `
    bg-transparent
    text-[var(--fg)]
    border border-[var(--border)]
    hover:border-[var(--fg-muted)]
    hover:text-[var(--fg-strong)]
  `,
  // Estilo ghost sin borde
  ghost: `
    bg-transparent
    text-[var(--fg-muted)]
    hover:text-[var(--fg)]
    hover:bg-[var(--bg-elevated)]
  `,
  // Estilo peligro/eliminar
  danger: `
    bg-transparent
    text-[var(--danger)]
    border border-[var(--danger)]
    hover:bg-[var(--danger)]
    hover:text-white
  `,
  // Estilo éxito/aprobar
  success: `
    bg-transparent
    text-[var(--success)]
    border border-[var(--success)]
    hover:bg-[var(--success)]
    hover:text-white
  `,
  // Estilo info
  info: `
    bg-transparent
    text-[var(--info)]
    border border-[var(--info)]
    hover:bg-[var(--info)]
    hover:text-white
  `,
  // Estilo warning
  warning: `
    bg-transparent
    text-[var(--warning)]
    border border-[var(--warning)]
    hover:bg-[var(--warning)]
    hover:text-[var(--bg)]
  `,
  // Estilo accent (cyan)
  accent: `
    bg-transparent
    text-[var(--accent)]
    border border-[var(--accent)]
    hover:bg-[var(--accent)]
    hover:text-[var(--bg)]
  `,
  // Outline (alias de primary)
  outline: `
    bg-transparent
    text-[var(--primary)]
    border border-[var(--primary)]
    hover:bg-[var(--primary)]
    hover:text-[var(--on-primary)]
  `,
  // Solid primary (para casos especiales donde se necesita fondo sólido)
  "primary-solid": `
    bg-gradient-to-r from-[var(--primary)] to-[var(--primary-strong)]
    text-[var(--on-primary)]
    shadow-[var(--shadow-glow)]
    hover:shadow-[var(--shadow-glow-strong)]
    hover:brightness-110
    active:brightness-95
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
  ...props
}) {
  return (
    <Component
      className={`
        inline-flex items-center justify-center gap-2
        font-semibold
        rounded-[var(--radius-md)]
        transition-all duration-[var(--transition-base)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </Component>
  );
}
