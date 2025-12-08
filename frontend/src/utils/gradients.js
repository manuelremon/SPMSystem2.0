/**
 * Gradients and Shadow System - CSS Variables Based
 * Centraliza todos los estilos de gradiente y sombras para consistencia
 * y soporte de Dark Mode
 */

// Gradientes usando variables CSS
export const gradients = {
  primary: 'var(--gradient-primary)',
  accent: 'var(--gradient-accent)',
  glass: 'var(--gradient-glass)',

  // Gradientes directos para botones (compatibilidad)
  primaryButton: 'linear-gradient(to right, hsl(217 91% 60%), hsl(217 91% 50%))',
  dangerButton: 'linear-gradient(to right, hsl(0 72% 51%), hsl(0 72% 41%))',
  successButton: 'linear-gradient(to right, hsl(160 84% 39%), hsl(160 84% 29%))',
  infoButton: 'linear-gradient(to right, hsl(199 89% 48%), hsl(199 89% 38%))',
  warningButton: 'linear-gradient(to right, hsl(45 93% 47%), hsl(45 93% 37%))',
  accentButton: 'linear-gradient(to right, hsl(330 81% 60%), hsl(330 81% 50%))',
};

// Sombras con glow por color
export const shadows = {
  primary: 'var(--shadow-glow)',
  accent: 'var(--shadow-glow-accent)',
  soft: 'var(--shadow-soft)',
  strong: 'var(--shadow-strong)',
  elevated: 'var(--shadow-elevated)',
  glass: 'var(--shadow-glass)',

  // Sombras específicas para botones
  primaryGlow: '0 10px 15px -3px var(--primary-glow)',
  dangerGlow: '0 10px 15px -3px hsl(0 72% 51% / 0.25)',
  successGlow: '0 10px 15px -3px hsl(160 84% 39% / 0.25)',
  infoGlow: '0 10px 15px -3px hsl(199 89% 48% / 0.25)',
  warningGlow: '0 10px 15px -3px hsl(45 93% 47% / 0.25)',
  accentGlow: '0 10px 15px -3px var(--accent-glow)',
};

// Bordes con opacidad
export const borders = {
  glass: 'var(--border-glass)',
  glassStrong: 'var(--border-glass-strong)',
  primary: '1px solid hsl(217 91% 70% / 0.5)',
  danger: '1px solid hsl(0 72% 70% / 0.5)',
  success: '1px solid hsl(160 84% 60% / 0.5)',
  info: '1px solid hsl(199 89% 65% / 0.5)',
  warning: '1px solid hsl(45 93% 65% / 0.5)',
  accent: '1px solid hsl(330 81% 70% / 0.5)',
};

// Colores de texto
export const colors = {
  onPrimary: 'var(--on-primary)',
  fg: 'var(--fg)',
  fgMuted: 'var(--fg-muted)',
  primary: 'var(--primary)',
};

// Configuracion de estilos para botones
export const buttonStyles = {
  primary: {
    background: gradients.primaryButton,
    color: colors.onPrimary,
    boxShadow: shadows.primaryGlow,
    border: borders.primary,
  },
  danger: {
    background: gradients.dangerButton,
    color: colors.onPrimary,
    boxShadow: shadows.dangerGlow,
    border: borders.danger,
  },
  success: {
    background: gradients.successButton,
    color: colors.onPrimary,
    boxShadow: shadows.successGlow,
    border: borders.success,
  },
  info: {
    background: gradients.infoButton,
    color: colors.onPrimary,
    boxShadow: shadows.infoGlow,
    border: borders.info,
  },
  warning: {
    background: gradients.warningButton,
    color: colors.onPrimary,
    boxShadow: shadows.warningGlow,
    border: borders.warning,
  },
  accent: {
    background: gradients.accentButton,
    color: colors.onPrimary,
    boxShadow: shadows.accentGlow,
    border: borders.accent,
  },
  // Variantes glass - no usan inline styles
  secondary: {},
  ghost: {},
  outline: {},
  'primary-solid': {
    background: gradients.primaryButton,
    color: colors.onPrimary,
    boxShadow: shadows.primaryGlow,
  },
};
