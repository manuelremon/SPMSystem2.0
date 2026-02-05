import React from "react";
import PropTypes from "prop-types";
import MuiSelect from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import FormHelperText from "@mui/material/FormHelperText";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";

/**
 * CustomSelect - MUI Outlined Style
 * Wrapper around MUI Select with outlined variant
 * Supports icons in options
 *
 * @param {string} value - Selected value
 * @param {function} onChange - Change handler (receives synthetic event with target.name and target.value)
 * @param {array} options - Array of options: [{value, label, icon?, disabled?}]
 * @param {string} placeholder - Placeholder text
 * @param {boolean} disabled - Disabled state
 * @param {boolean} error - Error state
 * @param {boolean} required - Required field
 * @param {string} label - Label for the select
 * @param {string} helperText - Helper text below select
 * @param {string} size - Size: 'small' | 'medium'
 */
export function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Seleccionar...",
  disabled = false,
  error = false,
  required = false,
  className = "",
  name,
  id,
  label,
  helperText,
  size = "medium",
  fullWidth = true,
  "aria-label": ariaLabel,
}) {
  const selectId = id || `custom-select-${Math.random().toString(36).substr(2, 9)}`;
  const labelId = label ? `${selectId}-label` : undefined;

  // Handler que simula el evento de un input nativo para compatibilidad con onChange(e)
  const handleChange = (event) => {
    if (typeof onChange === "function") {
      const syntheticEvent = {
        target: {
          name: name,
          value: event.target.value,
        },
      };
      onChange(syntheticEvent);
    }
  };

  return (
    <FormControl
      fullWidth={fullWidth}
      error={error}
      disabled={disabled}
      size={size}
      className={className}
      required={required}
    >
      {label && (
        <InputLabel id={labelId}>
          {label}
        </InputLabel>
      )}
      <MuiSelect
        labelId={labelId}
        id={selectId}
        name={name}
        value={value ?? ""}
        onChange={handleChange}
        label={label}
        displayEmpty={!!placeholder}
        variant="outlined"
        aria-label={ariaLabel}
        renderValue={(selected) => {
          if (!selected) {
            return <em style={{ color: '#9ca3af' }}>{placeholder}</em>;
          }
          const selectedOption = options.find((opt) => opt.value === selected);
          return selectedOption?.label || selected;
        }}
      >
        {placeholder && (
          <MenuItem value="" disabled>
            <em>{placeholder}</em>
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.icon && (
              <ListItemIcon sx={{ minWidth: 36 }}>
                {option.icon}
              </ListItemIcon>
            )}
            <ListItemText primary={option.label} />
          </MenuItem>
        ))}
      </MuiSelect>
      {helperText && (
        <FormHelperText>{helperText}</FormHelperText>
      )}
    </FormControl>
  );
}

CustomSelect.displayName = "CustomSelect";

CustomSelect.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.node,
      disabled: PropTypes.bool,
    })
  ),
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  error: PropTypes.bool,
  required: PropTypes.bool,
  className: PropTypes.string,
  name: PropTypes.string,
  id: PropTypes.string,
  label: PropTypes.string,
  helperText: PropTypes.string,
  size: PropTypes.oneOf(["small", "medium"]),
  fullWidth: PropTypes.bool,
  "aria-label": PropTypes.string,
};

CustomSelect.defaultProps = {
  options: [],
  placeholder: "Seleccionar...",
  disabled: false,
  error: false,
  required: false,
  className: "",
  size: "medium",
  fullWidth: true,
};

export default CustomSelect;
