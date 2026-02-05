/**
 * TextField - Enterprise Design System
 * Clean, professional input with CSS variable theming
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "./Icons";

export const TextField = React.forwardRef(
  (
    {
      className,
      label,
      name,
      id,
      value,
      onChange,
      onBlur,
      type = "text",
      placeholder,
      disabled = false,
      required = false,
      autoComplete,
      error = false,
      errorMessage,
      success = false,
      successMessage,
      helperText,
      helper,
      showCharCount = false,
      maxLength,
      variant, // Kept for backward compatibility, ignored
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";

    const normalizedHelperText = helperText || helper;
    const inputId = id || name || `textfield-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const currentLength = typeof value === "string" ? value.length : 0;
    const isOverLimit = maxLength && currentLength > maxLength;

    const showError = error && errorMessage;
    const showSuccess = success && successMessage && !showError;
    const showHelper = normalizedHelperText && !showError && !showSuccess;

    const ariaDescribedBy =
      [showError && errorId, showHelper && helperId].filter(Boolean).join(" ") || undefined;

    return (
      <div className={clsx("w-full", className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium uppercase tracking-wide mb-1.5"
            style={{ color: "var(--fg-muted)" }}
          >
            {label}
            {required && <span style={{ color: "var(--danger)" }} className="ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword && showPassword ? "text" : type}
            name={name}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete={autoComplete}
            maxLength={maxLength}
            style={{
              color: "var(--fg)",
              backgroundColor: disabled ? "var(--bg-soft)" : "var(--input-bg)",
              borderColor: error ? "var(--danger-border)" : success ? "var(--success-border)" : "var(--input-border)",
            }}
            className={clsx(
              "w-full h-10 px-3 text-sm",
              "border rounded-md",
              "placeholder:text-[var(--fg-subtle)]",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "focus:outline-none focus:ring-2",
              "transition-colors duration-150",
              error
                ? "focus:border-[var(--danger)] focus:ring-[var(--danger-bg)]"
                : success
                ? "focus:border-[var(--success)] focus:ring-[var(--success-bg)]"
                : "focus:border-[var(--primary)] focus:ring-[var(--input-focus)]",
              isPassword && "pr-10"
            )}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={ariaDescribedBy}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 transition-colors"
              style={{ color: "var(--fg-subtle)" }}
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Feedback area */}
        <div className="mt-1.5 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {showError && (
              <p
                id={errorId}
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--danger-text)" }}
                role="alert"
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </p>
            )}

            {showSuccess && (
              <p
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--success-text)" }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{successMessage}</span>
              </p>
            )}

            {showHelper && (
              <p
                id={helperId}
                className="text-xs"
                style={{ color: "var(--fg-subtle)" }}
              >
                {normalizedHelperText}
              </p>
            )}
          </div>

          {showCharCount && (
            <span
              className="text-xs tabular-nums flex-shrink-0"
              style={{ color: isOverLimit ? "var(--danger-text)" : "var(--fg-subtle)" }}
              aria-live="polite"
            >
              {currentLength}
              {maxLength && `/${maxLength}`}
            </span>
          )}
        </div>
      </div>
    );
  }
);

TextField.displayName = "TextField";

TextField.propTypes = {
  className: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string,
  id: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  autoComplete: PropTypes.string,
  error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  errorMessage: PropTypes.string,
  success: PropTypes.bool,
  successMessage: PropTypes.string,
  helperText: PropTypes.string,
  helper: PropTypes.string,
  showCharCount: PropTypes.bool,
  maxLength: PropTypes.number,
  variant: PropTypes.string, // Deprecated, kept for compatibility
};

export default TextField;
