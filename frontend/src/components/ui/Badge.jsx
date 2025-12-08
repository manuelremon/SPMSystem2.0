import React from "react";
import clsx from "clsx";

/**
 * Badge Component - Glass Morphism Style
 * Translucent badges with subtle blur effect
 */
const variants = {
  default: "bg-slate-100/70 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-600/50",
  success: "bg-emerald-50/70 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-700/50",
  warning: "bg-amber-50/70 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200/50 dark:border-amber-700/50",
  danger: "bg-red-50/70 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200/50 dark:border-red-700/50",
  info: "bg-blue-50/70 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-700/50",
  primary: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-300/30 dark:border-blue-600/30",
};

export function Badge({ variant = "default", className, children }) {
  return (
    <span
      className={clsx(
        // Glass base
        "inline-flex items-center gap-1.5",
        "rounded-full px-2.5 py-1",
        "text-xs font-semibold",
        "border backdrop-blur-sm",
        // Variant styles
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
