import React, { createContext, useContext } from "react";
import clsx from "clsx";

// Context for RadioGroup
const RadioGroupContext = createContext(null);

/**
 * RadioGroup - Glass Morphism Style
 * Container for radio buttons
 */
export function RadioGroup({
  children,
  value,
  onValueChange,
  name,
  orientation = "vertical",
  className,
  ...props
}) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange, name }}>
      <div
        role="radiogroup"
        className={clsx(
          "flex",
          orientation === "horizontal" ? "flex-row gap-4" : "flex-col gap-2",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

/**
 * Radio - Glass Morphism Style
 * Individual radio button with glow effect
 */
export const Radio = React.forwardRef(({
  value,
  label,
  description,
  disabled = false,
  className,
  ...props
}, ref) => {
  const context = useContext(RadioGroupContext);
  const isChecked = context?.value === value;
  const name = context?.name;

  const handleChange = () => {
    if (!disabled && context?.onValueChange) {
      context.onValueChange(value);
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
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          ref={ref}
          type="radio"
          name={name}
          value={value}
          checked={isChecked}
          disabled={disabled}
          onChange={handleChange}
          className="sr-only peer"
          {...props}
        />
        {/* Radio circle - Glass style */}
        <div
          className={clsx(
            // Glass base
            "w-5 h-5 rounded-full",
            "border-2 transition-all duration-200",
            "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
            "border-white/50 dark:border-white/10",
            // Hover
            "group-hover:bg-white/70 dark:group-hover:bg-slate-700/70 group-hover:border-slate-300/50 dark:group-hover:border-slate-500/50",
            // Focus - glass glow
            "peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400/30 peer-focus-visible:ring-offset-2",
            // Checked state
            "peer-checked:border-blue-500/50",
            "peer-checked:bg-white/70 dark:peer-checked:bg-slate-700/70",
            // Flex for inner dot
            "flex items-center justify-center"
          )}
        >
          {/* Inner dot - gradient */}
          <div
            className={clsx(
              "w-2.5 h-2.5 rounded-full",
              "bg-gradient-to-br from-blue-500 to-blue-600",
              "shadow-lg shadow-blue-500/30",
              "transition-all duration-200",
              isChecked
                ? "opacity-100 scale-100"
                : "opacity-0 scale-0"
            )}
          />
        </div>
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

Radio.displayName = "Radio";
