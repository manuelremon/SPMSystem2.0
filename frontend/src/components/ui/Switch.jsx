/**
 * Switch Component - MUI Switch
 * Toggle switch profesional con estilo MUI
 */

import React from "react";
import PropTypes from "prop-types";
import MuiSwitch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// Mapeo de tamaños legacy a MUI
const sizeMap = {
  sm: 'small',
  md: 'medium',
  lg: 'medium', // MUI solo tiene small y medium
};

/**
 * Switch - Toggle switch con MUI
 *
 * @param {string} className - Clases adicionales (compatibilidad)
 * @param {string} label - Texto del label
 * @param {string} description - Descripción adicional debajo del label
 * @param {boolean} checked - Estado checked
 * @param {function} onChange - Callback cuando cambia el estado
 * @param {boolean} disabled - Estado deshabilitado
 * @param {string} size - Tamaño: 'sm' | 'md' | 'lg' | 'small' | 'medium'
 * @param {string} color - Color MUI: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'
 * @param {object} sx - Estilos MUI adicionales
 */
export const Switch = React.forwardRef(({
  className,
  label,
  description,
  checked = false,
  onChange,
  disabled = false,
  size = "md",
  color = "primary",
  sx,
  ...props
}, ref) => {
  const muiSize = sizeMap[size] || size;

  // Handler para compatibilidad con API anterior (recibe boolean directamente)
  const handleChange = (event) => {
    if (onChange) {
      // Detectar si el onChange espera el evento o solo el valor
      if (onChange.length === 1) {
        // Compatibilidad: onChange espera solo el valor booleano
        onChange(event.target.checked);
      } else {
        // Standard MUI: onChange recibe el evento
        onChange(event, event.target.checked);
      }
    }
  };

  // Si no hay label, renderizar solo el switch
  if (!label && !description) {
    return (
      <MuiSwitch
        ref={ref}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        size={muiSize}
        color={color}
        className={className}
        sx={sx}
        {...props}
      />
    );
  }

  return (
    <Box className={className}>
      <FormControlLabel
        control={
          <MuiSwitch
            ref={ref}
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            size={muiSize}
            color={color}
            {...props}
          />
        }
        label={
          <Box>
            <Typography
              variant="body2"
              component="span"
              sx={{
                fontWeight: 500,
                color: disabled ? 'text.disabled' : 'text.primary',
              }}
            >
              {label}
            </Typography>
            {description && (
              <Typography
                variant="caption"
                component="p"
                sx={{
                  color: 'text.secondary',
                  mt: 0.25,
                }}
              >
                {description}
              </Typography>
            )}
          </Box>
        }
        sx={{
          alignItems: 'flex-start',
          '& .MuiFormControlLabel-label': {
            mt: 0.75,
          },
          ...sx,
        }}
      />
    </Box>
  );
});

Switch.displayName = "Switch";

Switch.propTypes = {
  className: PropTypes.string,
  label: PropTypes.string,
  description: PropTypes.string,
  checked: PropTypes.bool,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(["sm", "md", "lg", "small", "medium"]),
  color: PropTypes.oneOf(["primary", "secondary", "success", "error", "info", "warning"]),
  sx: PropTypes.object,
};

export default Switch;
