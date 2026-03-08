import { createTheme } from '@mui/material/styles';

/**
 * SPM v3.0 - Material UI Theme
 * Full MUI Theming Migration
 *
 * Paleta: SAP Blue (#0070f3) - Consistent with CSS Design System
 * Tipografía: Inter (consistent with CSS Design System)
 * Bordes: Redondeados (borderRadius: 6)
 *
 * Breakpoints personalizados para diseño responsive:
 * - xs: 0px      - Móvil pequeño (iPhone SE)
 * - sm: 375px    - Móvil estándar (iPhone 12/13/14)
 * - md: 768px    - Tablet (iPad)
 * - lg: 1024px   - Desktop
 * - xl: 1440px   - Desktop grande
 */

// Unified color constants - matching CSS Design System (index.css)
const COLORS = {
  // Primary - SAP Blue
  primary: '#0070f3',
  primaryLight: '#3291ff',
  primaryDark: '#0051a8',

  // Secondary - Neutral Gray
  secondary: '#475569',
  secondaryLight: '#64748b',
  secondaryDark: '#334155',

  // Status colors
  success: '#16a34a',
  successLight: '#22c55e',
  successDark: '#15803d',

  warning: '#d97706',
  warningLight: '#f59e0b',
  warningDark: '#b45309',

  error: '#dc2626',
  errorLight: '#ef4444',
  errorDark: '#b91c1c',

  info: '#0284c7',
  infoLight: '#0ea5e9',
  infoDark: '#0369a1',

  // Neutrals
  grey50: '#f8fafc',
  grey100: '#f1f5f9',
  grey200: '#e2e8f0',
  grey300: '#cbd5e1',
  grey400: '#94a3b8',
  grey500: '#64748b',
  grey600: '#475569',
  grey700: '#334155',
  grey800: '#1e293b',
  grey900: '#0f172a',

  // Text
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textDisabled: '#94a3b8',

  // Backgrounds
  background: '#f8fafc',
  paper: '#ffffff',

  // Borders
  divider: '#e2e8f0',
};

const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 375,
      md: 768,
      lg: 1024,
      xl: 1440,
    },
  },
  palette: {
    mode: 'light',
    primary: {
      main: COLORS.primary,
      light: COLORS.primaryLight,
      dark: COLORS.primaryDark,
      contrastText: '#fff',
    },
    secondary: {
      main: COLORS.secondary,
      light: COLORS.secondaryLight,
      dark: COLORS.secondaryDark,
      contrastText: '#fff',
    },
    success: {
      main: COLORS.success,
      light: COLORS.successLight,
      dark: COLORS.successDark,
      contrastText: '#fff',
    },
    warning: {
      main: COLORS.warning,
      light: COLORS.warningLight,
      dark: COLORS.warningDark,
      contrastText: '#fff',
    },
    error: {
      main: COLORS.error,
      light: COLORS.errorLight,
      dark: COLORS.errorDark,
      contrastText: '#fff',
    },
    info: {
      main: COLORS.info,
      light: COLORS.infoLight,
      dark: COLORS.infoDark,
      contrastText: '#fff',
    },
    grey: {
      50: COLORS.grey50,
      100: COLORS.grey100,
      200: COLORS.grey200,
      300: COLORS.grey300,
      400: COLORS.grey400,
      500: COLORS.grey500,
      600: COLORS.grey600,
      700: COLORS.grey700,
      800: COLORS.grey800,
      900: COLORS.grey900,
    },
    background: {
      default: COLORS.background,
      paper: COLORS.paper,
    },
    text: {
      primary: COLORS.textPrimary,
      secondary: COLORS.textSecondary,
      disabled: COLORS.textDisabled,
    },
    divider: COLORS.divider,
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: {
      fontWeight: 700,
      fontSize: '2rem',
      lineHeight: 1.2,
    },
    h2: {
      fontWeight: 700,
      fontSize: '1.5rem',
      lineHeight: 1.3,
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.4,
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: 1.4,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    h6: {
      fontWeight: 600,
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
  },
  shape: {
    borderRadius: 6,
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
        sizeMedium: {
          padding: '0.5rem 1rem',
        },
        sizeSmall: {
          padding: '0.375rem 0.75rem',
          fontSize: '0.8125rem',
        },
        sizeLarge: {
          padding: '0.625rem 1.25rem',
          fontSize: '0.9375rem',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '50%',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {},
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {},
        rounded: {},
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {},
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {},
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {},
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {},
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {},
        notchedOutline: {},
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {},
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {},
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {},
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {},
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          backgroundColor: COLORS.paper,
          borderBottom: `2px solid ${COLORS.divider}`,
        },
        indicator: {
          backgroundColor: COLORS.primary,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          color: COLORS.textSecondary,
          '&.Mui-selected': {
            color: COLORS.primary,
          },
          '&:hover': {
            color: COLORS.primary,
            backgroundColor: COLORS.grey100,
          },
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          borderRadius: '50%',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {},
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {},
        listbox: {},
      },
    },
    // DataGrid - Estilos globales (Fondo blanco, texto oscuro)
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: `1px solid ${COLORS.divider}`,
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: `${COLORS.paper} !important`,
          },
          '& .MuiDataGrid-columnHeader': {
            backgroundColor: `${COLORS.paper} !important`,
          },
        },
        columnHeaders: {
          backgroundColor: `${COLORS.paper} !important`,
          color: `${COLORS.textPrimary} !important`,
          borderBottom: `2px solid ${COLORS.divider}`,
        },
        columnHeader: {
          backgroundColor: `${COLORS.paper} !important`,
          color: `${COLORS.textPrimary} !important`,
          '&:focus': {
            outline: 'none',
          },
          '&:focus-within': {
            outline: 'none',
          },
        },
        columnHeaderTitle: {
          fontWeight: 600,
          color: `${COLORS.textPrimary} !important`,
        },
        sortIcon: {
          color: `${COLORS.textSecondary} !important`,
          fill: `${COLORS.textSecondary} !important`,
          opacity: '1 !important',
          '& path': {
            fill: `${COLORS.textSecondary} !important`,
          },
        },
        menuIcon: {
          color: `${COLORS.textSecondary} !important`,
          fill: `${COLORS.textSecondary} !important`,
          '& path': {
            fill: `${COLORS.textSecondary} !important`,
          },
        },
        menuIconButton: {
          color: `${COLORS.textSecondary} !important`,
          '& svg': {
            color: `${COLORS.textSecondary} !important`,
            fill: `${COLORS.textSecondary} !important`,
          },
          '& svg path': {
            fill: `${COLORS.textSecondary} !important`,
          },
        },
        iconButtonContainer: {
          visibility: 'visible !important',
          '& .MuiIconButton-root': {
            color: `${COLORS.textSecondary} !important`,
          },
          '& svg': {
            color: `${COLORS.textSecondary} !important`,
            fill: `${COLORS.textSecondary} !important`,
          },
          '& svg path': {
            fill: `${COLORS.textSecondary} !important`,
          },
          '& .MuiSvgIcon-root': {
            color: `${COLORS.textSecondary} !important`,
            fill: `${COLORS.textSecondary} !important`,
          },
        },
        columnSeparator: {
          color: COLORS.divider,
        },
        cell: {
          borderBottom: `1px solid ${COLORS.divider}`,
        },
        row: {
          '&:hover': {
            backgroundColor: COLORS.grey100,
          },
        },
      },
    },
  },
});

export default theme;

// Export unified colors for use in other files
export { COLORS };

// Helper hook para detectar breakpoints
export const BREAKPOINTS = {
  xs: 0,
  sm: 375,
  md: 768,
  lg: 1024,
  xl: 1440,
};

// CSS media queries para usar con styled-components o emotion
export const mediaQueries = {
  xs: `@media (min-width: ${BREAKPOINTS.xs}px)`,
  sm: `@media (min-width: ${BREAKPOINTS.sm}px)`,
  md: `@media (min-width: ${BREAKPOINTS.md}px)`,
  lg: `@media (min-width: ${BREAKPOINTS.lg}px)`,
  xl: `@media (min-width: ${BREAKPOINTS.xl}px)`,
  // Down queries (max-width)
  xsDown: `@media (max-width: ${BREAKPOINTS.sm - 1}px)`,
  smDown: `@media (max-width: ${BREAKPOINTS.md - 1}px)`,
  mdDown: `@media (max-width: ${BREAKPOINTS.lg - 1}px)`,
  lgDown: `@media (max-width: ${BREAKPOINTS.xl - 1}px)`,
};
