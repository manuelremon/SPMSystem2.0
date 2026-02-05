/**
 * EmptyState - Estado vacio para listas/tablas
 * Diseño SAP/Enterprise moderno
 */

import PropTypes from "prop-types";

// Default icon (document)
const DefaultIcon = (
  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
  className = "",
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 flex items-center justify-center">
        {icon || DefaultIcon}
      </div>
      <h3 className="text-sm font-medium text-slate-500 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-slate-400 mb-4 max-w-sm">
          {description}
        </p>
      )}
      {action && onAction && (
        <button
          onClick={onAction}
          className="mt-3 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          {action}
        </button>
      )}
    </div>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  action: PropTypes.string,
  onAction: PropTypes.func,
  className: PropTypes.string,
};

export default EmptyState;
