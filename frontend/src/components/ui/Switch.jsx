import React from "react";
import clsx from "clsx";

/**
 * Switch/Toggle component
 * @param {boolean} checked - Current state
 * @param {function} onChange - Callback when state changes
 * @param {string} label - Optional label text
 * @param {string} description - Optional description text
 * @param {boolean} disabled - Disabled state
 * @param {string} size - Size variant: "sm" | "md" | "lg"
 */
export const Switch = React.forwardRef(({
  className,
  label,
  description,
  checked = false,
  onChange,
  disabled = false,
  size = "md",
  ...props
}, ref) => {
  const sizes = {
    sm: {
      track: "w-8 h-4",
      thumb: "w-3 h-3",
      translate: "translate-x-4",
    },
    md: {
      track: "w-11 h-6",
      thumb: "w-5 h-5",
      translate: "translate-x-5",
    },
    lg: {
      track: "w-14 h-7",
      thumb: "w-6 h-6",
      translate: "translate-x-7",
    },
  };

  const sizeConfig = sizes[size] || sizes.md;

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!disabled && onChange) {
        onChange(!checked);
      }
    }
  };

  return (
    <label
      className={clsx(
        "inline-flex items-start gap-3 cursor-pointer group",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange && onChange(!checked)}
        onKeyDown={handleKeyDown}
        className={clsx(
          // Track
          "relative inline-flex flex-shrink-0 rounded-full",
          "transition-colors duration-[var(--transition-fast)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
          sizeConfig.track,
          checked
            ? "bg-[var(--primary)]"
            : "bg-[var(--border-strong)]"
        )}
        {...props}
      >
        {/* Thumb */}
        <span
          className={clsx(
            "pointer-events-none inline-block rounded-full",
            "bg-white shadow-sm",
            "transform transition-transform duration-[var(--transition-fast)]",
            "ring-0",
            sizeConfig.thumb,
            // Position
            "absolute top-1/2 -translate-y-1/2 left-0.5",
            checked && sizeConfig.translate
          )}
        />
      </button>

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

Switch.displayName = "Switch";
