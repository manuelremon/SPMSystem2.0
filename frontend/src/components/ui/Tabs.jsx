import React, { createContext, useContext, useState } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

// Context for Tabs state
const TabsContext = createContext(null);

/**
 * Tabs Component - SPM Design System
 * Usa CSS variables para consistencia global
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
 * TabsList - Container for tab triggers
 */
export function TabsList({ children, className, ...props }) {
  const { variant } = useContext(TabsContext);

  const variantStyles = {
    default: "bg-white/50 backdrop-blur-sm p-1 rounded-xl border border-white/30 gap-1",
    pills: "gap-2",
    underline: "border-b border-white/30 gap-0",
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
 * TabsTrigger - Tab button
 */
export function TabsTrigger({ children, value, className, disabled = false, ...props }) {
  const { activeValue, onValueChange, variant } = useContext(TabsContext);
  const isActive = activeValue === value;

  const baseStyles = clsx(
    "inline-flex items-center justify-center gap-2",
    "text-sm font-medium",
    "transition-all duration-200",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2",
    disabled && "opacity-50 cursor-not-allowed pointer-events-none"
  );

  const variantStyles = {
    default: clsx(
      "px-4 py-2 rounded-lg",
      isActive
        ? "bg-white shadow-sm text-blue-600"
        : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
    ),
    pills: clsx(
      "px-4 py-2 rounded-full border",
      isActive
        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-500/50 shadow-lg"
        : "bg-white/50 backdrop-blur-sm text-slate-600 border-white/30 hover:border-white/50 hover:text-slate-800"
    ),
    underline: clsx(
      "px-4 py-3 border-b-2 -mb-px",
      isActive
        ? "text-blue-600 border-blue-600"
        : "text-slate-600 border-transparent hover:text-slate-800 hover:border-slate-200"
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
 * TabsContent - Tab content panel
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

Tabs.propTypes = {
  children: PropTypes.node,
  defaultValue: PropTypes.string,
  value: PropTypes.string,
  onValueChange: PropTypes.func,
  variant: PropTypes.oneOf(["default", "pills", "underline"]),
  className: PropTypes.string,
};

Tabs.defaultProps = {
  variant: "default",
};

TabsList.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

TabsTrigger.propTypes = {
  children: PropTypes.node,
  value: PropTypes.string.isRequired,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

TabsTrigger.defaultProps = {
  disabled: false,
};

TabsContent.propTypes = {
  children: PropTypes.node,
  value: PropTypes.string.isRequired,
  className: PropTypes.string,
};
