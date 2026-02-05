/**
 * MetricCard - Enterprise Design System
 * Clean metric display cards with CSS variable theming
 */

import React from "react";
import clsx from "clsx";
import { Tooltip } from "./Tooltip";
import { HelpCircle } from "./Icons";

// CSS variable based variant styles
const getVariantStyles = (variant) => {
  const styles = {
    default: {
      iconBg: "var(--primary-muted)",
      iconColor: "var(--primary)",
      activeBorder: "var(--primary)",
    },
    primary: {
      iconBg: "var(--primary-muted)",
      iconColor: "var(--primary)",
      activeBorder: "var(--primary)",
    },
    success: {
      iconBg: "var(--success-bg)",
      iconColor: "var(--success)",
      activeBorder: "var(--success)",
    },
    warning: {
      iconBg: "var(--warning-bg)",
      iconColor: "var(--warning)",
      activeBorder: "var(--warning)",
    },
    danger: {
      iconBg: "var(--danger-bg)",
      iconColor: "var(--danger)",
      activeBorder: "var(--danger)",
    },
    info: {
      iconBg: "var(--info-bg)",
      iconColor: "var(--info)",
      activeBorder: "var(--info)",
    },
  };
  return styles[variant] || styles.default;
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  onClick,
  highlight = false,
  active = false,
  size = "sm",
  variant = "default",
  tooltip,
}) {
  const styles = getVariantStyles(highlight ? "warning" : variant);

  // Compact size (dashboards)
  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          "flex items-center gap-3 px-4 py-3",
          "border rounded-lg",
          "shadow-sm",
          "transition-all duration-200",
          onClick ? "cursor-pointer hover:shadow-md" : "cursor-default"
        )}
        style={{
          backgroundColor: highlight ? "var(--warning-bg)" : "var(--card)",
          borderColor: highlight ? "var(--warning-border)" : "var(--border)",
        }}
      >
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: styles.iconBg }}
        >
          <Icon className="w-4 h-4" style={{ color: styles.iconColor }} />
        </div>
        <div className="text-left">
          <div className="flex items-center gap-1">
            <p
              className="text-xs uppercase tracking-wide font-medium"
              style={{ color: "var(--fg-muted)" }}
            >
              {label}
            </p>
            {tooltip && (
              <Tooltip content={tooltip} position="top">
                <HelpCircle
                  className="w-3 h-3 cursor-help"
                  style={{ color: "var(--fg-subtle)" }}
                />
              </Tooltip>
            )}
          </div>
          <p
            className="text-lg font-bold tabular-nums"
            style={{ color: highlight ? "var(--warning-text)" : "var(--fg-strong)" }}
          >
            {value}
          </p>
        </div>
      </button>
    );
  }

  // Large size
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-full",
        "border rounded-lg",
        "shadow-sm",
        "transition-all duration-200",
        onClick ? "cursor-pointer hover:shadow-md" : "cursor-default"
      )}
      style={{
        backgroundColor: "var(--card)",
        borderColor: active ? styles.activeBorder : "var(--border)",
      }}
    >
      <div className="px-5 py-5">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <div className="flex items-center gap-1">
              <p
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: "var(--fg-muted)" }}
              >
                {label}
              </p>
              {tooltip && (
                <Tooltip content={tooltip} position="top">
                  <HelpCircle
                    className="w-3 h-3 cursor-help"
                    style={{ color: "var(--fg-subtle)" }}
                  />
                </Tooltip>
              )}
            </div>
            <p
              className="text-2xl font-bold mt-1 tabular-nums"
              style={{ color: "var(--fg-strong)" }}
            >
              {value}
            </p>
          </div>
          <div
            className="h-12 w-12 rounded-lg grid place-items-center"
            style={{ backgroundColor: styles.iconBg }}
          >
            <Icon className="w-6 h-6" style={{ color: styles.iconColor }} />
          </div>
        </div>
      </div>
    </button>
  );
}

export default MetricCard;
