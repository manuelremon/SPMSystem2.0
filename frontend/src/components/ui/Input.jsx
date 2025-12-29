import React from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * Input Component - Glass Morphism Style
 * Translucent inputs with blur effect
 *
 * @param {boolean} error - Show error state with red border/ring
 */
export const Input = React.forwardRef(({ className, error = false, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={clsx(
        // Glass base
        "w-full bg-[var(--bg-glass)] backdrop-blur-sm",
        "rounded-lg",
        "px-4 py-3",
        // Typography
        "text-sm text-[var(--text-primary)]",
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
        // Border - Primary (default) or Red (error)
        error
          ? "border border-red-400 ring-1 ring-red-100 focus:border-red-400 focus:ring-2 focus:ring-red-200"
          : "border border-[var(--border-colored)] ring-1 ring-[var(--primary-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-muted)] hover:border-[var(--primary)]",
        className
      )}
      aria-invalid={error ? "true" : undefined}
      {...props}
    />
  );
});

Input.displayName = "Input";

Input.propTypes = {
  className: PropTypes.string,
  error: PropTypes.bool,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  id: PropTypes.string,
  name: PropTypes.string,
};

Input.defaultProps = {
  error: false,
  type: "text",
};
