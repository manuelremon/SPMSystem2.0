/**
 * Textarea Component - Enterprise Design System
 * Clean textarea with CSS variable theming
 */

import React from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

export const Textarea = React.forwardRef(({
  className,
  label,
  error = false,
  errorMessage,
  helperText,
  required = false,
  disabled = false,
  id,
  name,
  ...props
}, ref) => {
  const inputId = id || name || `textarea-${Math.random().toString(36).substr(2, 9)}`;

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
      <textarea
        ref={ref}
        id={inputId}
        name={name}
        disabled={disabled}
        style={{
          color: "var(--fg)",
          backgroundColor: disabled ? "var(--bg-soft)" : "var(--input-bg)",
          borderColor: error ? "var(--danger-border)" : "var(--input-border)",
        }}
        className={clsx(
          "w-full",
          "rounded-md",
          "px-3 py-2.5",
          "text-sm",
          "border",
          "placeholder:text-[var(--fg-subtle)]",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2",
          error
            ? "focus:border-[var(--danger)] focus:ring-[var(--danger-bg)]"
            : "focus:border-[var(--primary)] focus:ring-[var(--input-focus)]",
          "resize-y min-h-[100px]",
          "disabled:opacity-60 disabled:cursor-not-allowed"
        )}
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
      {error && errorMessage && (
        <p
          className="mt-1.5 text-xs"
          style={{ color: "var(--danger-text)" }}
          role="alert"
        >
          {errorMessage}
        </p>
      )}
      {!error && helperText && (
        <p
          className="mt-1.5 text-xs"
          style={{ color: "var(--fg-subtle)" }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = "Textarea";

Textarea.propTypes = {
  className: PropTypes.string,
  label: PropTypes.string,
  error: PropTypes.bool,
  errorMessage: PropTypes.string,
  helperText: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  rows: PropTypes.number,
  id: PropTypes.string,
  name: PropTypes.string,
};

export default Textarea;
