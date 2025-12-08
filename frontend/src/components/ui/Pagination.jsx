import React from "react";
import clsx from "clsx";
import { Button } from "./Button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Pagination Component - Glass Morphism Style
 * Translucent pagination with subtle glass effect
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
    <div className={clsx(
      "flex items-center justify-between pt-4",
      "border-t border-white/30 dark:border-white/10",
      className
    )}>
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {page} {currentPage} {of} {totalPages}
        <span className="ml-2">
          ({showing} {startItem}-{endItem} {of} {totalItems})
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex items-center gap-1"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-4 h-4" />
          {prev}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex items-center gap-1"
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
