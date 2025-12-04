import React from "react";
import { Button } from "./Button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Componente de paginación reutilizable
 * @param {number} currentPage - Página actual (1-indexed)
 * @param {number} totalPages - Total de páginas
 * @param {number} totalItems - Total de items
 * @param {number} itemsPerPage - Items por página
 * @param {function} onPageChange - Callback cuando cambia la página
 * @param {object} labels - Labels personalizables para i18n
 */
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
    page = "Página",
    of = "de",
    showing = "Mostrando",
    prev = "Anterior",
    next = "Siguiente",
  } = labels;

  // Calcular items mostrados
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between pt-4 border-t border-[var(--border)] ${className}`}>
      <div className="text-sm text-[var(--fg-muted)]">
        {page} {currentPage} {of} {totalPages}
        <span className="ml-2">
          ({showing} {startItem}-{endItem} {of} {totalItems})
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          className="px-3 py-1.5 text-sm flex items-center gap-1"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-4 h-4" />
          {prev}
        </Button>
        <Button
          variant="ghost"
          className="px-3 py-1.5 text-sm flex items-center gap-1"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          {next}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default Pagination;
