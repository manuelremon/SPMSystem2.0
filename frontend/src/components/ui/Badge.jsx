/**
 * Badge Component - MUI Chip
 * Etiquetas de estado profesionales con estilo MUI
 */

import React, { memo } from "react";
import PropTypes from "prop-types";
import Chip from "@mui/material/Chip";

// Mapeo de variantes legacy a colores MUI
const variantColorMap = {
  default: 'default',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  error: 'error',
  info: 'info',
  primary: 'primary',
  secondary: 'secondary',
};

// Mapeo de tamaños
const sizeMap = {
  sm: 'small',
  md: 'small',
  lg: 'medium',
};

/**
 * Badge - Etiqueta de estado con MUI Chip
 *
 * @param {string} variant - Variante de color: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'
 * @param {string} size - Tamaño: 'sm' | 'md' | 'lg'
 * @param {string} className - Clases adicionales (compatibilidad)
 * @param {object} sx - Estilos MUI adicionales
 * @param {React.ReactNode} children - Contenido del badge
 * @param {React.ReactNode} icon - Icono opcional al inicio
 * @param {function} onDelete - Callback para mostrar botón de eliminar
 */
export const Badge = memo(function Badge({
  variant = "default",
  size = "md",
  className,
  sx,
  children,
  icon,
  onDelete,
  ...props
}) {
  const muiColor = variantColorMap[variant] || 'default';
  const muiSize = sizeMap[size] || 'small';

  return (
    <Chip
      label={children}
      color={muiColor}
      size={muiSize}
      variant="outlined"
      icon={icon}
      onDelete={onDelete}
      className={className}
      sx={{
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.025em',
        fontSize: size === 'sm' ? '0.625rem' : size === 'lg' ? '0.8125rem' : '0.6875rem',
        ...sx,
      }}
      {...props}
    />
  );
});

Badge.propTypes = {
  variant: PropTypes.oneOf([
    "default",
    "success",
    "warning",
    "danger",
    "error",
    "info",
    "primary",
    "secondary",
  ]),
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  className: PropTypes.string,
  sx: PropTypes.object,
  children: PropTypes.node,
  icon: PropTypes.node,
  onDelete: PropTypes.func,
};

export default Badge;
