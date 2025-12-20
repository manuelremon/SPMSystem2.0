import React from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { AlertCircle, CheckCircle, Info, XCircle, X } from "./Icons";

/**
 * Alert Component - Glass Morphism Style
 * Translucent alerts with blur effect and semantic colors
 */
const variants = {
  success: {
    glass: "bg-emerald-50/70 dark:bg-emerald-900/30 backdrop-blur-sm border-emerald-200/50 dark:border-emerald-700/50",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle,
  },
  danger: {
    glass: "bg-red-50/70 dark:bg-red-900/30 backdrop-blur-sm border-red-200/50 dark:border-red-700/50",
    text: "text-red-700 dark:text-red-300",
    icon: XCircle,
  },
  warning: {
    glass: "bg-amber-50/70 dark:bg-amber-900/30 backdrop-blur-sm border-amber-200/50 dark:border-amber-700/50",
    text: "text-amber-700 dark:text-amber-300",
    icon: AlertCircle,
  },
  info: {
    glass: "bg-blue-50/70 dark:bg-blue-900/30 backdrop-blur-sm border-blue-200/50 dark:border-blue-700/50",
    text: "text-blue-700 dark:text-blue-300",
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
      className={clsx(
        // Glass base
        "flex items-start gap-3",
        "px-4 py-3.5",
        "rounded-[16px]",
        "border",
        // Glass effect per variant
        config.glass,
        config.text,
        // Animation
        "animate-slideDown",
        className
      )}
      {...props}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm font-medium">{children}</div>
      {canDismiss && handleClose && (
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
          type="button"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

Alert.propTypes = {
  variant: PropTypes.oneOf(["success", "danger", "warning", "info"]),
  children: PropTypes.node,
  className: PropTypes.string,
  onClose: PropTypes.func,
  dismissible: PropTypes.bool,
  onDismiss: PropTypes.func,
};

Alert.defaultProps = {
  variant: "info",
  className: "",
};
