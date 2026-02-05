/**
 * TabButton - Componente de boton de tab reutilizable
 * Diseño SAP/Enterprise moderno
 */

import PropTypes from 'prop-types';

export function TabButton({
  active,
  onClick,
  children,
  icon,
  count,
  size = "normal",
  className = ""
}) {
  const sizeClasses = size === "small"
    ? "px-4 py-2.5 text-xs gap-1.5"
    : "px-5 py-3.5 text-sm gap-2";

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center ${sizeClasses} font-semibold transition-all border-b-2
        ${active
          ? "border-blue-600 text-blue-600 bg-white"
          : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
        }
        ${className}
      `}
    >
      {icon && (
        <span className={active ? "text-blue-600" : "text-slate-400"}>
          {icon}
        </span>
      )}
      {children}
      {count !== undefined && (
        <span className={`
          ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full
          ${active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}
        `}>
          {count}
        </span>
      )}
    </button>
  );
}

TabButton.propTypes = {
  active: PropTypes.bool,
  onClick: PropTypes.func,
  children: PropTypes.node.isRequired,
  icon: PropTypes.node,
  count: PropTypes.number,
  size: PropTypes.oneOf(['normal', 'small']),
  className: PropTypes.string,
};

export default TabButton;
