import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../ui/table";
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from "../../ui/Icons";
import { cn } from "../../../lib/utils";
import { adaptLegacyColumns, getAlignmentClass } from "./columns";

/**
 * ModernDataTable - Componente de tabla empresarial con TanStack Table
 *
 * Características:
 * - Densidad compacta (32px filas) por defecto
 * - Ordenamiento integrado via TanStack Table
 * - Headers sticky para scroll
 * - Compatible con API del DataTable legacy
 * - Alineación automática por tipo de columna
 *
 * @param {Object} props
 * @param {Array<{key: string, header: string, render?, sortAccessor?, align?}>} props.columns - Definición de columnas
 * @param {Array<object>} props.rows - Datos a mostrar
 * @param {string | React.ReactNode} [props.emptyMessage="Sin datos"] - Mensaje cuando no hay datos
 * @param {string} [props.className] - Clases adicionales para el contenedor
 * @param {'compact' | 'cozy'} [props.density='compact'] - Densidad de la tabla
 */
export function ModernDataTable({
  columns = [],
  rows = [],
  emptyMessage = "Sin datos",
  className = "",
  density = "compact",
}) {
  const [sorting, setSorting] = React.useState([]);

  // Adaptar columnas legacy al formato TanStack
  const tanstackColumns = React.useMemo(
    () => adaptLegacyColumns(columns),
    [columns]
  );

  const table = useReactTable({
    data: rows,
    columns: tanstackColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const densityClass = density === "compact" ? "h-row-compact" : "h-row-cozy";

  // Empty state
  if (rows.length === 0) {
    // Si emptyMessage es un elemento React, renderizarlo directamente
    if (React.isValidElement(emptyMessage)) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--bg-soft)] flex items-center justify-center mb-4">
          <Inbox className="w-6 h-6 text-[var(--fg-muted)]" />
        </div>
        <div className="text-[var(--fg-muted)] text-sm">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)} role="region" aria-label="Tabla de datos" data-density={density}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className={densityClass}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                const minWidth = header.column.columnDef.meta?.minWidth;

                return (
                  <TableHead
                    key={header.id}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    onKeyDown={(e) => {
                      if (canSort && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        header.column.getToggleSortingHandler()(e);
                      }
                    }}
                    tabIndex={canSort ? 0 : undefined}
                    role={canSort ? "button" : undefined}
                    aria-sort={
                      sorted
                        ? sorted === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={cn(
                      "text-center",
                      canSort && "cursor-pointer select-none",
                      canSort && "hover:text-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-inset"
                    )}
                    style={minWidth ? { minWidth: `${minWidth}px` } : undefined}
                  >
                    <div className="flex items-center gap-1 justify-center">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span aria-hidden="true">
                          <SortIcon sorted={sorted} />
                        </span>
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row, rowIndex) => (
            <TableRow
              key={row.id}
              className={cn(
                densityClass,
                rowIndex % 2 === 1 && "bg-[var(--bg-soft)]/30"
              )}
            >
              {row.getVisibleCells().map((cell) => {
                const alignClass = getAlignmentClass(cell.column);
                const minWidth = cell.column.columnDef.meta?.minWidth;

                return (
                  <TableCell
                    key={cell.id}
                    align={cell.column.columnDef.meta?.align}
                    style={minWidth ? { minWidth: `${minWidth}px` } : undefined}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Icono de ordenamiento
 */
function SortIcon({ sorted }) {
  if (sorted === "asc") {
    return <ChevronUp className="w-3 h-3" />;
  }
  if (sorted === "desc") {
    return <ChevronDown className="w-3 h-3" />;
  }
  return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
}

export default ModernDataTable;
