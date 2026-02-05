/**
 * SelectField - Componente de select unificado
 * Soporta dos variantes: 'mui' (Material-UI) y 'native' (SAP/Enterprise style)
 *
 * Reemplaza y unifica:
 * - Select.jsx (MUI wrapper)
 * - FormSelect.jsx (native select)
 */

import React from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import MuiSelect from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import FormHelperText from "@mui/material/FormHelperText";
import { ChevronDown } from "./Icons";

export const SelectField = React.forwardRef(
  (
    {
      // Shared props
      className,
      label,
      name,
      id,
      value,
      onChange,
      options = [],
      disabled = false,
      required = false,
      placeholder,

      // Error/validation
      error = false,
      errorMessage,
      helperText,

      // MUI-specific props
      fullWidth = true,
      size = "medium",
      children,

      // Variant
      variant = "mui",

      ...props
    },
    ref
  ) => {
    const isNative = variant === "native";

    // Generate unique ID if not provided
    const selectId = id || name || `selectfield-${Math.random().toString(36).substr(2, 9)}`;
    const labelId = `${selectId}-label`;

    // Normalize error message
    const normalizedError = errorMessage || (typeof error === "string" ? error : "");

    // Native variant (SAP/Enterprise style)
    if (isNative) {
      return (
        <div className={clsx("space-y-1", className)}>
          {label && (
            <label
              htmlFor={selectId}
              className="block text-xs font-medium text-slate-600 uppercase tracking-wide"
            >
              {label}
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
          )}
          <div className="relative">
            <select
              ref={ref}
              id={selectId}
              name={name}
              value={value ?? ""}
              onChange={onChange}
              disabled={disabled}
              style={{
                color: "#334155",
                backgroundColor: disabled ? "#f8fafc" : "#ffffff",
                paddingRight: "2.5rem",
              }}
              className={clsx(
                "w-full h-10 px-3",
                "text-sm font-medium",
                "border rounded-none",
                "appearance-none cursor-pointer",
                "hover:border-slate-400",
                "disabled:text-slate-500 disabled:cursor-not-allowed",
                "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                "outline-none transition-colors",
                error || normalizedError ? "border-red-300" : "border-slate-300"
              )}
              aria-invalid={error ? "true" : undefined}
              {...props}
            >
              <option value="">{placeholder || "Seleccionar..."}</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              <ChevronDown className="w-4 h-4" />
            </span>
          </div>
          {helperText && !normalizedError && (
            <p className="text-xs text-slate-500">{helperText}</p>
          )}
          {normalizedError && (
            <p className="text-xs text-red-600" role="alert">
              {normalizedError}
            </p>
          )}
        </div>
      );
    }

    // MUI variant (default)
    return (
      <FormControl
        fullWidth={fullWidth}
        error={!!error || !!normalizedError}
        disabled={disabled}
        size={size}
        className={className}
      >
        {label && (
          <InputLabel id={labelId} required={required}>
            {label}
          </InputLabel>
        )}
        <MuiSelect
          ref={ref}
          labelId={label ? labelId : undefined}
          id={selectId}
          name={name}
          value={value ?? ""}
          onChange={onChange}
          label={label}
          displayEmpty={!!placeholder}
          variant="outlined"
          {...props}
        >
          {placeholder && (
            <MenuItem value="" disabled>
              <em>{placeholder}</em>
            </MenuItem>
          )}
          {/* Render children if provided, otherwise render options */}
          {children ||
            options.map((option) => (
              <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </MenuItem>
            ))}
        </MuiSelect>
        {(helperText || normalizedError) && (
          <FormHelperText>{normalizedError || helperText}</FormHelperText>
        )}
      </FormControl>
    );
  }
);

SelectField.displayName = "SelectField";

SelectField.propTypes = {
  className: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string,
  id: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      disabled: PropTypes.bool,
    })
  ),
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  placeholder: PropTypes.string,
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  errorMessage: PropTypes.string,
  helperText: PropTypes.string,
  fullWidth: PropTypes.bool,
  size: PropTypes.oneOf(["small", "medium"]),
  children: PropTypes.node,
  variant: PropTypes.oneOf(["mui", "native"]),
};

SelectField.defaultProps = {
  options: [],
  disabled: false,
  required: false,
  error: false,
  fullWidth: true,
  size: "medium",
  variant: "mui",
};

export default SelectField;
