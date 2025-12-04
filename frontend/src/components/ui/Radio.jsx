import React, { createContext, useContext } from "react";
import clsx from "clsx";

// Context for RadioGroup
const RadioGroupContext = createContext(null);

/**
 * RadioGroup - Container for radio buttons
 * @param {string} value - Current selected value
 * @param {function} onValueChange - Callback when selection changes
 * @param {string} name - Name attribute for the radio group
 * @param {string} orientation - "horizontal" | "vertical"
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
 * Radio - Individual radio button
 * @param {string} value - Value for this radio option
 * @param {string} label - Label text
 * @param {string} description - Optional description text
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
        {/* Radio circle */}
        <div
          className={clsx(
            // Base
            "w-5 h-5 rounded-full",
            "border-2 transition-all duration-[var(--transition-fast)]",
            // Default state
            "border-[var(--border-strong)]",
            "bg-[var(--input-bg)]",
            // Hover
            "group-hover:border-[var(--fg-muted)]",
            // Focus
            "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--primary)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--bg)]",
            // Checked state
            "peer-checked:border-[var(--primary)]",
            // Flex for inner dot
            "flex items-center justify-center"
          )}
        >
          {/* Inner dot */}
          <div
            className={clsx(
              "w-2.5 h-2.5 rounded-full",
              "bg-[var(--primary)]",
              "transition-all duration-[var(--transition-fast)]",
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

Radio.displayName = "Radio";
