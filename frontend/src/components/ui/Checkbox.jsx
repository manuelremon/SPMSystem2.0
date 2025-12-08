import React from "react";
import clsx from "clsx";
import { Check } from "lucide-react";

/**
 * Checkbox Component - Glass Morphism Style
 * Translucent checkbox with glow effect on focus
 */
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
            // Glass base
            "w-5 h-5 rounded-lg relative",
            "border-2 transition-all duration-200",
            // Glass effect
            "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
            "border-white/50 dark:border-white/10",
            // Hover
            "group-hover:bg-white/70 dark:group-hover:bg-slate-700/70 group-hover:border-slate-300/50 dark:group-hover:border-slate-500/50",
            // Focus - glass glow
            "peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400/30 peer-focus-visible:ring-offset-2",
            // Checked state - gradient
            "peer-checked:bg-gradient-to-br peer-checked:from-blue-500 peer-checked:to-blue-600",
            "peer-checked:border-blue-400/50 peer-checked:shadow-lg peer-checked:shadow-blue-500/25",
            // Error state
            error && "border-red-400/50"
          )}
        />
        <Check
          className={clsx(
            "w-4 h-4 text-white",
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "pointer-events-none",
            "transition-all duration-200",
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
              "text-sm font-medium text-slate-700 dark:text-slate-300",
              "transition-colors duration-200",
              "group-hover:text-slate-900 dark:group-hover:text-slate-100"
            )}>
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
});

Checkbox.displayName = "Checkbox";
