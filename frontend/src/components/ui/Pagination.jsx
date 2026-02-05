/**
 * Pagination - Componente de paginacion
 * Diseño SAP/Enterprise moderno (sin dependencias MUI)
 */

import PropTypes from "prop-types";

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  labels = {},
  className = "",
}) {
  const {
    showing = "Mostrando",
    of = "de",
    prev = "Anterior",
    next = "Siguiente",
  } = labels;

  // Calcular items mostrados
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  if (totalPages <= 1) return null;

  // Generate page numbers to display (max 5)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else if (currentPage <= 3) {
      for (let i = 1; i <= maxVisible; i++) {
        pages.push(i);
      }
    } else if (currentPage >= totalPages - 2) {
      for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      for (let i = currentPage - 2; i <= currentPage + 2; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  return (
    <div className={`flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50 text-sm ${className}`}>
      {/* Info de página */}
      <span className="text-slate-500">
        {showing} <span className="font-medium text-slate-700">{startItem}-{endItem}</span> {of} <span className="font-medium text-slate-700">{totalItems}</span>
      </span>

      {/* Botones de navegación */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {prev}
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 text-xs font-medium rounded transition-colors ${
                currentPage === page
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {next}
        </button>
      </div>
    </div>
  );
}

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  totalItems: PropTypes.number.isRequired,
  itemsPerPage: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  labels: PropTypes.shape({
    showing: PropTypes.string,
    of: PropTypes.string,
    prev: PropTypes.string,
    next: PropTypes.string,
  }),
  className: PropTypes.string,
};

export default Pagination;
