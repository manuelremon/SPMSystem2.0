/**
 * SummaryCard - Tarjeta de resumen/metrica
 * Diseño SAP/Enterprise moderno
 */

import PropTypes from 'prop-types';

const colorClasses = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  green: "bg-emerald-50 text-emerald-600 border-emerald-100",
  red: "bg-red-50 text-red-600 border-red-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  yellow: "bg-amber-50 text-amber-600 border-amber-100",
  purple: "bg-purple-50 text-purple-600 border-purple-100",
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  slate: "bg-slate-50 text-slate-600 border-slate-100",
};

export function SummaryCard({
  icon,
  label,
  value,
  subvalue,
  color = "blue",
  onClick,
  className = ""
}) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`
        bg-white border border-slate-200 p-4 flex items-start gap-4 text-left
        ${onClick ? "cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all" : ""}
        ${className}
      `}
    >
      {icon && (
        <div className={`p-2.5 rounded-lg border ${colorClasses[color] || colorClasses.blue}`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-1">
          {label}
        </p>
        <p className="text-xl font-bold text-slate-800 truncate">
          {value}
        </p>
        {subvalue && (
          <p className="text-xs text-slate-500 mt-0.5">
            {subvalue}
          </p>
        )}
      </div>
    </Component>
  );
}

SummaryCard.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  subvalue: PropTypes.string,
  color: PropTypes.oneOf(['blue', 'emerald', 'green', 'red', 'amber', 'yellow', 'purple', 'indigo', 'slate']),
  onClick: PropTypes.func,
  className: PropTypes.string,
};

export default SummaryCard;
