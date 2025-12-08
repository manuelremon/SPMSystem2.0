import React from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";

/**
 * Select Component - Glass Morphism Style
 * Translucent dropdown with blur effect
 */
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
          // Glass base
          "w-full appearance-none",
          "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
          "rounded-xl",
          "px-4 py-3 pr-10",
          // Typography
          "text-sm text-slate-800 dark:text-slate-200",
          // Transitions
          "transition-all duration-200",
          // Focus states
          "focus:outline-none",
          "focus:bg-white/70 dark:focus:bg-slate-700/70",
          // Cursor
          "cursor-pointer",
          // Hover
          "hover:bg-white/60 dark:hover:bg-slate-700/60",
          // Disabled state
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/30 dark:disabled:bg-slate-800/30",
          // Border - Always blue (or red for error)
          error
            ? "border border-red-400 dark:border-red-500 ring-1 ring-red-100 dark:ring-red-900/30 focus:border-red-400 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800/30"
            : "border border-blue-300 dark:border-blue-600 ring-1 ring-blue-100 dark:ring-blue-900/30 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/30 hover:border-blue-400 dark:hover:border-blue-500",
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
          "text-slate-500 dark:text-slate-400",
          "transition-transform duration-200"
        )}
        aria-hidden="true"
      />
    </div>
  );
});

Select.displayName = "Select";
