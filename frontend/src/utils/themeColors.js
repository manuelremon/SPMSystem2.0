/**
 * Theme Colors - CSS Variable Based Color System
 *
 * Use these constants in MUI sx props and inline styles
 * to maintain consistency with the design system.
 */

// Core semantic colors (read from CSS variables)
export const colors = {
  // Primary
  primary: 'var(--primary)',
  primaryLight: 'var(--primary-light)',
  primaryMuted: 'var(--primary-muted)',

  // Success
  success: 'var(--success)',
  successBg: 'var(--success-bg)',
  successText: 'var(--success-text)',
  successBorder: 'var(--success-border)',

  // Warning
  warning: 'var(--warning)',
  warningBg: 'var(--warning-bg)',
  warningText: 'var(--warning-text)',
  warningBorder: 'var(--warning-border)',

  // Danger/Error
  danger: 'var(--danger)',
  dangerBg: 'var(--danger-bg)',
  dangerText: 'var(--danger-text)',
  dangerBorder: 'var(--danger-border)',

  // Info
  info: 'var(--info)',
  infoBg: 'var(--info-bg)',
  infoText: 'var(--info-text)',
  infoBorder: 'var(--info-border)',

  // Foreground (text)
  fg: 'var(--fg)',
  fgStrong: 'var(--fg-strong)',
  fgMuted: 'var(--fg-muted)',
  fgSubtle: 'var(--fg-subtle)',

  // Background
  bg: 'var(--bg)',
  bgSoft: 'var(--bg-soft)',
  card: 'var(--card)',

  // Borders
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',

  // Input
  inputBg: 'var(--input-bg)',
  inputBorder: 'var(--input-border)',
};

// MUI-compatible color getters for dynamic styling
export const getScoreColor = (score) => {
  if (score >= 0.8) return colors.danger;
  if (score >= 0.5) return colors.warning;
  return colors.success;
};

export const getCumplimientoColor = (porcentaje) => {
  if (porcentaje >= 90) return colors.success;
  if (porcentaje >= 70) return colors.warning;
  return colors.danger;
};

// Common MUI sx patterns for reuse
export const muiPatterns = {
  // Card pattern
  card: {
    border: `1px solid ${colors.border}`,
    borderRadius: 2,
    bgcolor: colors.card,
  },

  // Section header
  sectionHeader: {
    p: 2.5,
    borderBottom: `1px solid ${colors.border}`,
  },

  // Page header title
  pageTitle: {
    fontWeight: 700,
    color: colors.fgStrong,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  // Muted text
  mutedText: {
    color: colors.fgMuted,
  },

  // Subtle text
  subtleText: {
    color: colors.fgSubtle,
  },

  // Icon button
  iconButton: {
    color: colors.fgMuted,
  },
};

// Status colors for badges/chips
export const statusColors = {
  submitted: {
    bg: colors.warningBg,
    text: colors.warningText,
    border: colors.warningBorder,
  },
  approved: {
    bg: colors.successBg,
    text: colors.successText,
    border: colors.successBorder,
  },
  processing: {
    bg: colors.infoBg,
    text: colors.infoText,
    border: colors.infoBorder,
  },
  dispatched: {
    bg: colors.infoBg,
    text: colors.infoText,
    border: colors.infoBorder,
  },
  rejected: {
    bg: colors.dangerBg,
    text: colors.dangerText,
    border: colors.dangerBorder,
  },
};

// SLA alert type colors
export const alertTypeColors = {
  warning: {
    bg: colors.warningBg,
    border: colors.warningBorder,
    text: colors.warningText,
  },
  breach: {
    bg: colors.dangerBg,
    border: colors.dangerBorder,
    text: colors.dangerText,
  },
  escalated: {
    bg: 'var(--primary-muted)',
    border: 'var(--primary)',
    text: 'var(--primary)',
  },
};

// Criticidad colors for priority indicators
export const criticidadColors = {
  alta: {
    bg: colors.dangerBg,
    text: colors.dangerText,
  },
  media: {
    bg: colors.warningBg,
    text: colors.warningText,
  },
  baja: {
    bg: colors.bgSoft,
    text: colors.fgMuted,
  },
};

// Tendencia (trend) backgrounds
export const tendenciaColors = {
  up: colors.successBg,
  down: colors.dangerBg,
  stable: colors.warningBg,
};

export default colors;
