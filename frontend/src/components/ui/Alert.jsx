import React from "react";
import { AlertCircle, CheckCircle, Info, XCircle, X } from "lucide-react";

const variants = {
  success: {
    bg: "var(--status-success-bg)",
    border: "var(--status-success-border)",
    text: "var(--status-success-text)",
    icon: CheckCircle,
  },
  danger: {
    bg: "var(--status-danger-bg)",
    border: "var(--status-danger-border)",
    text: "var(--status-danger-text)",
    icon: XCircle,
  },
  warning: {
    bg: "var(--status-warning-bg)",
    border: "var(--status-warning-border)",
    text: "var(--status-warning-text)",
    icon: AlertCircle,
  },
  info: {
    bg: "var(--status-info-bg)",
    border: "var(--status-info-border)",
    text: "var(--status-info-text)",
    icon: Info,
  },
};

export function Alert({
  variant = "info",
  children,
  className = "",
  onClose,
  dismissible,
  onDismiss, // Legacy support
  ...props
}) {
  const config = variants[variant] || variants.info;
  const Icon = config.icon;
  const handleClose = onClose || onDismiss;
  const canDismiss = dismissible || !!handleClose;

  return (
    <div
      className={`
        flex items-start gap-3
        px-4 py-3.5
        rounded-[var(--radius-md)]
        border
        animate-slideDown
        ${className}
      `}
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
        color: config.text,
      }}
      {...props}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm font-medium">{children}</div>
      {canDismiss && handleClose && (
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
          type="button"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
