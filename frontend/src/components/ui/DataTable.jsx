import React, { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from "lucide-react";

// Columnas que deben centrarse automáticamente
const CENTERED_COLUMNS = [
  'id', 'centro', 'almacen', 'almacen_virtual',
  'solicitante', 'sector', 'criticidad', 'estado', 'status',
  'accion', 'acciones', 'planificador', 'planificado',
  'items', 'items_count', 'cantidad',
  'fecha', 'fecha_creacion', 'fecha_necesidad', 'created_at', 'updated_at',
  'rol', 'roles', 'tipo', 'prioridad'
];
// Columnas que deben alinearse a la derecha
const RIGHT_ALIGNED_COLUMNS = [
  'monto', 'total_monto', 'precio', 'precio_unitario',
  'subtotal', 'total', 'presupuesto', 'importe', 'valor'
];
// Columnas que deben alinearse a la izquierda (texto largo)
const LEFT_ALIGNED_COLUMNS = [
  'justificacion', 'asunto', 'descripcion', 'observaciones',
  'motivo', 'comentario', 'notas', 'mensaje'
];

function getColumnAlignment(key) {
  const keyLower = (key || '').toLowerCase();
  // Primero verificar alineación derecha (montos)
  if (RIGHT_ALIGNED_COLUMNS.some(col => keyLower.includes(col))) return 'right';
  // Luego verificar alineación izquierda explícita (texto largo)
  if (LEFT_ALIGNED_COLUMNS.some(col => keyLower.includes(col))) return 'left';
  // Luego verificar centrado
  if (CENTERED_COLUMNS.some(col => keyLower.includes(col) || keyLower === col)) return 'center';
  // Por defecto: centrado para mantener consistencia
  return 'center';
}

export function DataTable({
  columns = [],
  rows = [],
  emptyMessage = "Sin datos",
  className = ""
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const handleSort = (key, sortAccessor) => {
    if (!sortAccessor) return;

    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    } else if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const sortedRows = React.useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return rows;

    const column = columns.find(c => c.key === sortConfig.key);
    if (!column?.sortAccessor) return rows;

    return [...rows].sort((a, b) => {
      const aVal = column.sortAccessor(a);
      const bVal = column.sortAccessor(b);

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, columns, sortConfig]);

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />;
    if (sortConfig.direction === "asc") return <ChevronUp className="w-3.5 h-3.5" />;
    if (sortConfig.direction === "desc") return <ChevronDown className="w-3.5 h-3.5" />;
    return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />;
  };

  if (rows.length === 0) {
    // If emptyMessage is a React element (like EmptyState), render it directly
    // Otherwise, wrap it in the default empty state UI
    const isReactElement = React.isValidElement(emptyMessage);

    if (isReactElement) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 text-[var(--fg-muted)]" />
        </div>
        <div className="text-[var(--fg-muted)] text-sm">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`} role="region" aria-label="Tabla de datos">
      <table className="w-full border-collapse border border-[var(--border)]" role="table">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {columns.map((col) => {
              const align = col.align || getColumnAlignment(col.key);
              const alignClass = align === 'center' ? 'text-center justify-center' : align === 'right' ? 'text-right justify-end' : 'text-left justify-start';

              return (
                <th
                  key={col.key}
                  scope="col"
                  onClick={() => handleSort(col.key, col.sortAccessor)}
                  onKeyDown={(e) => {
                    if (col.sortAccessor && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleSort(col.key, col.sortAccessor);
                    }
                  }}
                  tabIndex={col.sortAccessor ? 0 : undefined}
                  role={col.sortAccessor ? "button" : undefined}
                  aria-sort={
                    sortConfig.key === col.key
                      ? sortConfig.direction === "asc"
                        ? "ascending"
                        : sortConfig.direction === "desc"
                        ? "descending"
                        : "none"
                      : undefined
                  }
                  className={`
                    px-4 py-4
                    text-center text-sm font-bold uppercase tracking-wide
                    text-[var(--fg)]
                    bg-[var(--bg-soft)]
                    border-r border-[var(--border)] last:border-r-0
                    ${col.sortAccessor ? 'cursor-pointer hover:text-[var(--primary)] hover:bg-[var(--bg-elevated)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-inset' : ''}
                  `}
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  <div className={`flex items-center gap-2 ${alignClass}`}>
                    {col.header}
                    {col.sortAccessor && <span aria-hidden="true">{getSortIcon(col.key)}</span>}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rowIndex) => (
            <tr
              key={row.id || rowIndex}
              className={`
                border-b border-[var(--border)]
                transition-colors duration-[var(--transition-fast)]
                hover:bg-[var(--bg-elevated)]
                ${rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-[var(--bg-soft)]/30'}
              `}
            >
              {columns.map((col) => {
                const align = col.align || getColumnAlignment(col.key);
                const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

                return (
                  <td
                    key={col.key}
                    className={`px-4 py-3.5 text-sm text-[var(--fg)] border-r border-[var(--border)] last:border-r-0 ${alignClass}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
