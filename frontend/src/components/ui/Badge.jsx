import React from "react";
import clsx from "clsx";

const variants = {
  default: "bg-[var(--bg-elevated)] text-[var(--fg-muted)] border-[var(--border)]",
  success: "bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]",
  warning: "bg-[var(--status-warn-bg)] text-[var(--status-warn-text)] border-[var(--status-warn-border)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]",
};

export function Badge({ variant = "default", className, children }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
