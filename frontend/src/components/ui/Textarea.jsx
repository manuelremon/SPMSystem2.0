import React from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * Textarea Component - Glass Morphism Style
 * Translucent textarea matching Input glass style
 */
export const Textarea = React.forwardRef(({
  className,
  error = false,
  ...props
}, ref) => {
  return (
    <textarea
      ref={ref}
      className={clsx(
        // Glass base
        "w-full",
        "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
        "rounded-xl",
        "px-4 py-3",
        // Typography
        "text-sm text-slate-800 dark:text-slate-200",
        "placeholder:text-slate-400 dark:placeholder:text-slate-500",
        // Transitions
        "transition-all duration-200",
        // Focus states - glass glow
        "focus:outline-none",
        "focus:bg-white/70 dark:focus:bg-slate-700/70",
        // Border - Always blue (or red for error)
        error
          ? "border border-red-400 dark:border-red-500 ring-1 ring-red-100 dark:ring-red-900/30 focus:border-red-400 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800/30"
          : "border border-blue-300 dark:border-blue-600 ring-1 ring-blue-100 dark:ring-blue-900/30 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/30",
        // Hover
        "hover:bg-white/60 dark:hover:bg-slate-700/60",
        !error && "hover:border-blue-400 dark:hover:border-blue-500",
        // Resize control
        "resize-y min-h-[100px]",
        // Disabled state
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/30 dark:disabled:bg-slate-800/30",
        className
      )}
      aria-invalid={error ? "true" : undefined}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

Textarea.propTypes = {
  className: PropTypes.string,
  error: PropTypes.bool,
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  rows: PropTypes.number,
  id: PropTypes.string,
  name: PropTypes.string,
};

Textarea.defaultProps = {
  error: false,
};
