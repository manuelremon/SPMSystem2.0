import React, { createContext, useContext, useState } from "react";
import clsx from "clsx";

// Context for Tabs state
const TabsContext = createContext(null);

/**
 * Tabs container component
 * @param {string} defaultValue - Default active tab value
 * @param {string} value - Controlled active tab value
 * @param {function} onValueChange - Callback when tab changes
 * @param {string} variant - Style variant: "default" | "pills" | "underline"
 */
export function Tabs({
  children,
  defaultValue,
  value,
  onValueChange,
  variant = "default",
  className,
  ...props
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeValue = value !== undefined ? value : internalValue;

  const handleChange = (newValue) => {
    if (value === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeValue, onValueChange: handleChange, variant }}>
      <div className={clsx("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

/**
 * Tabs list - container for tab triggers
 */
export function TabsList({ children, className, ...props }) {
  const { variant } = useContext(TabsContext);

  const variantStyles = {
    default: "bg-[var(--bg-soft)] p-1 rounded-[var(--radius-md)]",
    pills: "gap-2",
    underline: "border-b border-[var(--border)] gap-0",
  };

  return (
    <div
      role="tablist"
      className={clsx(
        "inline-flex items-center",
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Tab trigger button
 * @param {string} value - Unique value for this tab
 */
export function TabsTrigger({ children, value, className, disabled = false, ...props }) {
  const { activeValue, onValueChange, variant } = useContext(TabsContext);
  const isActive = activeValue === value;

  const baseStyles = clsx(
    "inline-flex items-center justify-center gap-2",
    "text-sm font-medium",
    "transition-all duration-[var(--transition-fast)]",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2",
    disabled && "opacity-50 cursor-not-allowed pointer-events-none"
  );

  const variantStyles = {
    default: clsx(
      "px-4 py-2 rounded-[var(--radius-sm)]",
      isActive
        ? "bg-[var(--card)] text-[var(--fg-strong)] shadow-sm"
        : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
    ),
    pills: clsx(
      "px-4 py-2 rounded-full border",
      isActive
        ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]"
        : "bg-transparent text-[var(--fg-muted)] border-[var(--border)] hover:border-[var(--fg-muted)] hover:text-[var(--fg)]"
    ),
    underline: clsx(
      "px-4 py-3 border-b-2 -mb-px",
      isActive
        ? "text-[var(--primary)] border-[var(--primary)]"
        : "text-[var(--fg-muted)] border-transparent hover:text-[var(--fg)] hover:border-[var(--border-strong)]"
    ),
  };

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => !disabled && onValueChange(value)}
      className={clsx(baseStyles, variantStyles[variant] || variantStyles.default, className)}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Tab content panel
 * @param {string} value - Value that matches the TabsTrigger
 */
export function TabsContent({ children, value, className, ...props }) {
  const { activeValue } = useContext(TabsContext);

  if (activeValue !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      tabIndex={0}
      className={clsx(
        "mt-4 focus:outline-none",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
