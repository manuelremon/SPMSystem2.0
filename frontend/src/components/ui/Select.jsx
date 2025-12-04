import React from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";

export const Select = React.forwardRef(({
  className = "",
  error = false,
  children,
  ...props
}, ref) => {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={clsx(
          // Base styles - matching Input component
          "w-full appearance-none rounded-[var(--radius-md)]",
          "px-4 py-3 pr-10",
          "bg-[var(--input-bg)]",
          "text-sm text-[var(--fg)]",
          // Border styles
          "border border-[var(--border-strong)]",
          // Transitions
          "transition-all duration-[var(--transition-fast)]",
          // Focus states
          "focus:outline-none focus:ring-2",
          // Cursor
          "cursor-pointer",
          // Disabled state
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--bg-soft)]",
          // Error or normal states
          error
            ? "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/20"
            : "focus:ring-[var(--primary)] focus:border-[var(--primary)] hover:border-[var(--border-strong)]",
          className
        )}
        aria-invalid={error ? "true" : undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className={clsx(
          "absolute right-3 top-1/2 -translate-y-1/2",
          "w-4 h-4 pointer-events-none",
          "text-[var(--fg-muted)]",
          "transition-transform duration-150"
        )}
        aria-hidden="true"
      />
    </div>
  );
});

Select.displayName = "Select";
