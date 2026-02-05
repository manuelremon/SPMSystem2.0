import React from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { AlertCircle, CheckCircle2 } from "./Icons";

/**
 * Input Component - Glass Morphism Style
 * Translucent inputs with blur effect
 *
 * Mejorado con:
 * - Feedback visual de error/success
 * - Mensaje de ayuda (helperText)
 * - Contador de caracteres
 * - Atributos ARIA para accesibilidad
 *
 * @param {boolean} error - Show error state with red border/ring
 * @param {string} errorMessage - Error message to display below input
 * @param {boolean} success - Show success state with green border/ring
 * @param {string} successMessage - Success message to display below input
 * @param {string} helperText - Helper text to display below input
 * @param {boolean} showCharCount - Show character counter
 * @param {number} maxLength - Maximum character length
 */
export const Input = React.forwardRef(
  (
    {
      className,
      error = false,
      errorMessage,
      success = false,
      successMessage,
      helperText,
      showCharCount = false,
      maxLength,
      id,
      value,
      ...props
    },
    ref
  ) => {
    // Generar ID unico si no se proporciona
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    // Calcular longitud actual para contador
    const currentLength = typeof value === "string" ? value.length : 0;
    const isOverLimit = maxLength && currentLength > maxLength;

    // Determinar que mensaje mostrar (prioridad: error > success > helper)
    const showError = error && errorMessage;
    const showSuccess = success && successMessage && !showError;
    const showHelper = helperText && !showError && !showSuccess;

    // Construir aria-describedby
    const ariaDescribedBy = [
      showError && errorId,
      showHelper && helperId,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="w-full">
        <input
          ref={ref}
          id={inputId}
          value={value}
          maxLength={maxLength}
          className={clsx(
            // Glass base
            "w-full bg-[var(--bg-glass)] backdrop-blur-sm",
            "rounded-lg",
            "px-4 py-3",
            // Typography - texto más grande en móvil (16px para evitar zoom en iOS)
            "text-base sm:text-sm text-[var(--text-primary)]",
            "placeholder:text-[var(--text-muted)]",
            // Focus state - Glass effect intensifies
            "focus:bg-[var(--bg-glass-strong)]",
            "focus:outline-none",
            // Hover
            "hover:bg-[var(--bg-glass-strong)]",
            // Disabled
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--bg-glass-subtle)]",
            // Transition
            "transition-all duration-300 ease-spring",
            // Touch target mínimo de 44px
            "min-h-[44px]",
            // Border states
            error
              ? "border border-red-400 ring-1 ring-red-100 focus:border-red-400 focus:ring-2 focus:ring-red-200"
              : success
              ? "border border-emerald-400 ring-1 ring-emerald-100 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
              : "border border-[var(--border-colored)] ring-1 ring-[var(--primary-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-muted)] hover:border-[var(--primary)]",
            className
          )}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={ariaDescribedBy}
          {...props}
        />

        {/* Feedback area */}
        <div className="mt-1.5 flex items-start justify-between gap-2">
          {/* Messages */}
          <div className="flex-1 min-w-0">
            {showError && (
              <p
                id={errorId}
                className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"
                role="alert"
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </p>
            )}

            {showSuccess && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span>{successMessage}</span>
              </p>
            )}

            {showHelper && (
              <p
                id={helperId}
                className="text-xs text-slate-500 dark:text-slate-400"
              >
                {helperText}
              </p>
            )}
          </div>

          {/* Character counter */}
          {showCharCount && (
            <span
              className={clsx(
                "text-xs tabular-nums flex-shrink-0",
                isOverLimit
                  ? "text-red-600 dark:text-red-400 font-medium"
                  : "text-slate-400 dark:text-slate-500"
              )}
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

Input.displayName = "Input";

Input.propTypes = {
  className: PropTypes.string,
  error: PropTypes.bool,
  errorMessage: PropTypes.string,
  success: PropTypes.bool,
  successMessage: PropTypes.string,
  helperText: PropTypes.string,
  showCharCount: PropTypes.bool,
  maxLength: PropTypes.number,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  disabled: PropTypes.bool,
  id: PropTypes.string,
  name: PropTypes.string,
  autoComplete: PropTypes.string,
  "aria-label": PropTypes.string,
};

Input.defaultProps = {
  error: false,
  success: false,
  showCharCount: false,
  type: "text",
};

export default Input;
