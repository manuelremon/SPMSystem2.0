import React from "react";
import PropTypes from "prop-types";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import MuiButton from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";

/**
 * Button Component - MUI Based
 * Wrapper around MUI Button that maintains backward compatibility
 * with the existing API used across 42+ files
 *
 * Mapeo de variantes:
 * - primary     → contained + primary
 * - secondary   → outlined + inherit
 * - ghost       → text + inherit
 * - danger      → contained + error
 * - success     → contained + success
 * - info        → contained + info
 * - warning     → contained + warning
 * - accent      → contained + secondary
 * - outline     → outlined + primary
 * - icon-*      → IconButton
 */

// Mapeo de variantes custom a MUI
const variantMap = {
  primary: { variant: "contained", color: "primary" },
  "primary-solid": { variant: "contained", color: "primary" },
  secondary: { variant: "outlined", color: "inherit" },
  ghost: { variant: "text", color: "inherit" },
  // Botones negativos: outlined + error (cancelar, rechazar, borrar, error)
  danger: { variant: "outlined", color: "error" },
  cancel: { variant: "outlined", color: "error" },
  reject: { variant: "outlined", color: "error" },
  delete: { variant: "outlined", color: "error" },
  success: { variant: "contained", color: "success" },
  info: { variant: "contained", color: "info" },
  warning: { variant: "contained", color: "warning" },
  accent: { variant: "contained", color: "secondary" },
  outline: { variant: "outlined", color: "primary" },
};

// Variantes de IconButton
const iconVariants = ["icon", "icon-primary", "icon-danger", "icon-success", "icon-warning"];

// Mapeo de colores para IconButton
const iconColorMap = {
  icon: "default",
  "icon-primary": "primary",
  "icon-danger": "error",
  "icon-success": "success",
  "icon-warning": "warning",
};

// Mapeo de tamaños custom a MUI
const sizeMap = {
  xs: "small",
  sm: "small",
  md: "medium",
  lg: "large",
  "icon-xs": "small",
  "icon-sm": "small",
  "icon-md": "medium",
  "icon-lg": "large",
};

export function Button({
  as: Component,
  variant = "primary",
  size = "md",
  className = "",
  children,
  disabled = false,
  loading = false,
  startIcon,
  endIcon,
  fullWidth = false,
  responsive = false, // Nueva prop: fullWidth automático en móvil
  style = {},
  "aria-label": ariaLabel,
  ...props
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  // Si es un IconButton
  if (iconVariants.includes(variant)) {
    return (
      <IconButton
        color={iconColorMap[variant] || "default"}
        size={sizeMap[size] || "medium"}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        className={className}
        style={style}
        {...props}
      >
        {loading ? (
          <CircularProgress size={size === "lg" || size === "icon-lg" ? 24 : 20} color="inherit" />
        ) : (
          children
        )}
      </IconButton>
    );
  }

  // Obtener config de MUI basada en la variante
  const muiConfig = variantMap[variant] || variantMap.primary;

  // Si se especifica un componente custom (como Link de react-router)
  const buttonProps = Component ? { component: Component } : {};

  // Determinar si debe ser fullWidth
  const shouldBeFullWidth = fullWidth || (responsive && isMobile);

  // Ajustar tamaño en móvil para mejor touch target
  const effectiveSize = isMobile && size === "sm" ? "medium" : (sizeMap[size] || "medium");

  return (
    <MuiButton
      variant={muiConfig.variant}
      color={muiConfig.color}
      size={effectiveSize}
      disabled={disabled || loading}
      fullWidth={shouldBeFullWidth}
      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : startIcon}
      endIcon={!loading ? endIcon : undefined}
      aria-label={ariaLabel}
      className={className}
      style={{
        // Asegurar touch target mínimo de 44px en móvil
        minHeight: isMobile ? '44px' : undefined,
        ...style,
      }}
      {...buttonProps}
      {...props}
    >
      {children}
    </MuiButton>
  );
}

Button.propTypes = {
  as: PropTypes.elementType,
  variant: PropTypes.oneOf([
    "primary",
    "secondary",
    "ghost",
    "danger",
    "cancel",
    "reject",
    "delete",
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
  loading: PropTypes.bool,
  startIcon: PropTypes.node,
  endIcon: PropTypes.node,
  fullWidth: PropTypes.bool,
  responsive: PropTypes.bool, // fullWidth automático en móvil
  style: PropTypes.object,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  "aria-label": PropTypes.string,
};

export default Button;
