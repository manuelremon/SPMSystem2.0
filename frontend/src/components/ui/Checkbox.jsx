import React from "react";
import clsx from "clsx";
import { Check } from "lucide-react";

export const Checkbox = React.forwardRef(({
  className,
  label,
  description,
  error = false,
  checked,
  onChange,
  disabled = false,
  ...props
}, ref) => {
  return (
    <label
      className={clsx(
        "inline-flex items-start gap-3 cursor-pointer group",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only peer"
          aria-invalid={error ? "true" : undefined}
          {...props}
        />
        <div
          className={clsx(
            // Base
            "w-5 h-5 rounded-[var(--radius-sm)] relative",
            "border-2 transition-all duration-[var(--transition-fast)]",
            // Default state
            "border-[var(--border-strong)]",
            "bg-[var(--input-bg)]",
            // Hover (when not checked)
            "group-hover:border-[var(--fg-muted)]",
            // Focus
            "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--primary)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--bg)]",
            // Checked state
            "peer-checked:bg-[var(--primary)] peer-checked:border-[var(--primary)]",
            // Error state
            error && "border-[var(--danger)]"
          )}
        />
        <Check
          className={clsx(
            "w-3.5 h-3.5 text-[var(--on-primary)]",
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "pointer-events-none",
            "transition-all duration-[var(--transition-fast)]",
            checked
              ? "opacity-100 scale-100"
              : "opacity-0 scale-50"
          )}
          strokeWidth={3}
        />
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className={clsx(
              "text-sm font-medium text-[var(--fg)]",
              "transition-colors duration-[var(--transition-fast)]",
              "group-hover:text-[var(--fg-strong)]"
            )}>
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-[var(--fg-muted)] mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
});

Checkbox.displayName = "Checkbox";
