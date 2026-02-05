/**
 * Checkbox Component - MUI Checkbox
 * Checkbox profesional con estilo MUI
 */

import React from "react";
import PropTypes from "prop-types";
import MuiCheckbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/**
 * Checkbox - Checkbox con MUI
 *
 * @param {string} className - Clases adicionales (compatibilidad)
 * @param {string} label - Texto del label
 * @param {string} description - Descripción adicional debajo del label
 * @param {boolean} error - Estado de error
 * @param {string} helperText - Texto de ayuda o error
 * @param {boolean} checked - Estado checked
 * @param {function} onChange - Callback cuando cambia el estado
 * @param {boolean} disabled - Estado deshabilitado
 * @param {string} size - Tamaño: 'small' | 'medium'
 * @param {string} color - Color MUI: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'
 * @param {object} sx - Estilos MUI adicionales
 */
export const Checkbox = React.forwardRef(({
  className,
  label,
  description,
  error = false,
  helperText,
  checked,
  onChange,
  disabled = false,
  size = "medium",
  color = "primary",
  sx,
  ...props
}, ref) => {
  // Si no hay label, renderizar solo el checkbox
  if (!label && !description) {
    return (
      <MuiCheckbox
        ref={ref}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        size={size}
        color={error ? "error" : color}
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
          <MuiCheckbox
            ref={ref}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            size={size}
            color={error ? "error" : color}
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
            mt: 0.5,
          },
          ...sx,
        }}
      />
      {helperText && (
        <FormHelperText error={error} sx={{ ml: 4 }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  );
});

Checkbox.displayName = "Checkbox";

Checkbox.propTypes = {
  className: PropTypes.string,
  label: PropTypes.string,
  description: PropTypes.string,
  error: PropTypes.bool,
  helperText: PropTypes.string,
  checked: PropTypes.bool,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(["small", "medium"]),
  color: PropTypes.oneOf(["primary", "secondary", "success", "error", "info", "warning"]),
  sx: PropTypes.object,
  id: PropTypes.string,
  name: PropTypes.string,
};

export default Checkbox;
