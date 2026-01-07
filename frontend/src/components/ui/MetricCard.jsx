import React from "react";
import clsx from "clsx";
import { Tooltip } from "./Tooltip";
import { HelpCircle } from "./Icons";

/**
 * MetricCard - Glass Morphism Style
 * Translucent metric cards with blur effect and glow on hover
 *
 * @param {React.ElementType} icon - Icono de lucide-react
 * @param {string} label - Etiqueta superior (ej: "Pendientes")
 * @param {string|number} value - Valor numerico a mostrar
 * @param {function} onClick - Handler opcional de click
 * @param {boolean} highlight - Resalta con colores de warning (atencion)
 * @param {boolean} active - Si la card esta seleccionada/activa
 * @param {string} size - Tamano: 'sm' (compacto) | 'lg' (grande con icono circular)
 * @param {string} variant - Color variante: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
 * @param {string} tooltip - Texto explicativo opcional
 */
export function MetricCard({
  icon: Icon,
  label,
  value,
  onClick,
  highlight = false,
  active = false,
  size = "sm",
  variant = "default",
  tooltip
}) {
  // Glass variant colors for icon backgrounds
  const variantStyles = {
    default: { iconBg: "bg-blue-500/10", iconColor: "text-blue-600", activeBorder: "border-blue-400/50" },
    primary: { iconBg: "bg-blue-500/10", iconColor: "text-blue-600", activeBorder: "border-blue-400/50" },
    success: { iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600", activeBorder: "border-emerald-400/50" },
    warning: { iconBg: "bg-amber-500/10", iconColor: "text-amber-600", activeBorder: "border-amber-400/50" },
    danger: { iconBg: "bg-red-500/10", iconColor: "text-red-600", activeBorder: "border-red-400/50" },
    info: { iconBg: "bg-sky-500/10", iconColor: "text-sky-600", activeBorder: "border-sky-400/50" },
  };

  const styles = variantStyles[variant] || variantStyles.default;

  // Tamano compacto (dashboards)
  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          // Glass base
          "flex items-center gap-3 px-4 py-3",
          "bg-white/60 dark:bg-slate-800/60 backdrop-blur-md",
          "border border-white/40 dark:border-slate-700/40",
          "rounded-[16px]",
          "shadow-glass-sm",
          // Highlight mode
          highlight && "ring-2 ring-amber-400/50 bg-amber-50/50 dark:bg-amber-900/30",
          // Interactive states
          "transition-all duration-300",
          onClick ? "cursor-pointer hover:bg-white/80 dark:hover:bg-slate-700/80 hover:shadow-glow-primary" : "cursor-default"
        )}
      >
        <div className={clsx("p-2 rounded-xl", highlight ? "bg-amber-500/10" : styles.iconBg)}>
          <Icon className={clsx("w-4 h-4", highlight ? "text-amber-600" : styles.iconColor)} />
        </div>
        <div className="text-left">
          <div className="flex items-center gap-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">{label}</p>
            {tooltip && (
              <Tooltip content={tooltip} position="top">
                <HelpCircle className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help" />
              </Tooltip>
            )}
          </div>
          <p className={clsx("text-lg font-bold tabular-nums", highlight ? "text-amber-700 dark:text-amber-400" : "text-slate-800 dark:text-slate-100")}>
            {value}
          </p>
        </div>
      </button>
    );
  }

  // Tamano grande (MisSolicitudes)
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        // Glass base
        "w-full",
        "bg-white/60 dark:bg-slate-800/60 backdrop-blur-md",
        "border",
        "rounded-[20px]",
        "shadow-glass-sm",
        // Active/default border
        active ? styles.activeBorder : "border-white/40 dark:border-slate-700/40",
        // Interactive states
        "transition-all duration-300",
        onClick ? "cursor-pointer hover:bg-white/80 dark:hover:bg-slate-700/80 hover:shadow-glow-primary" : "cursor-default"
      )}
    >
      <div className="px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <div className="flex items-center gap-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
              {tooltip && (
                <Tooltip content={tooltip} position="top">
                  <HelpCircle className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help" />
                </Tooltip>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1 tabular-nums">{value}</p>
          </div>
          <div
            className={clsx(
              "h-12 w-12 rounded-full grid place-items-center",
              styles.iconBg
            )}
          >
            <Icon className={clsx("w-6 h-6", styles.iconColor)} />
          </div>
        </div>
      </div>
    </button>
  );
}

export default MetricCard;
