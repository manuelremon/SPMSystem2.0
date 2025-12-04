import React from "react";
import clsx from "clsx";

export const Textarea = React.forwardRef(({
  className,
  error = false,
  ...props
}, ref) => {
  return (
    <textarea
      ref={ref}
      className={clsx(
        // Base styles - matching Input component
        "w-full rounded-[var(--radius-md)]",
        "px-4 py-3",
        "bg-[var(--input-bg)]",
        "text-sm text-[var(--fg)]",
        "placeholder:text-[var(--fg-subtle)]",
        // Border
        "border",
        error
          ? "border-[var(--danger)]"
          : "border-[var(--border-strong)]",
        // Transitions
        "transition-all duration-[var(--transition-fast)]",
        // Focus states
        "focus:outline-none focus:ring-2",
        error
          ? "focus:ring-[var(--danger)]/20 focus:border-[var(--danger)]"
          : "focus:ring-[var(--primary)] focus:border-[var(--primary)]",
        // Resize control
        "resize-y min-h-[100px]",
        // Disabled state
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--bg-soft)]",
        className
      )}
      aria-invalid={error ? "true" : undefined}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
