/**
 * Adaptador de columnas legacy → TanStack Table
 *
 * Convierte el formato de columnas del DataTable legacy al formato
 * requerido por TanStack Table v8, manteniendo compatibilidad total.
 */

/**
 * Adapta columnas del formato legacy al formato TanStack Table
 *
 * @param {Array<{
 *   key: string,
 *   header: string,
 *   render?: (row: object) => React.ReactNode,
 *   sortAccessor?: (row: object) => any,
 *   align?: 'left' | 'center' | 'right'
 * }>} legacyColumns - Columnas en formato legacy
 *
 * @returns {Array<ColumnDef>} - Columnas en formato TanStack
 *
 * @example
 * const tanstackColumns = adaptLegacyColumns([
 *   { key: 'id', header: 'ID' },
 *   { key: 'nombre', header: 'Nombre', render: (row) => <strong>{row.nombre}</strong> },
 *   { key: 'fecha', header: 'Fecha', sortAccessor: (row) => new Date(row.fecha) },
 * ]);
 */
export function adaptLegacyColumns(legacyColumns) {
  return legacyColumns.map(col => ({
    // Identificador y accessor
    id: col.key,
    accessorKey: col.key,

    // Header
    header: col.header,

    // Cell renderer
    cell: col.render
      ? ({ row }) => col.render(row.original)
      : ({ getValue }) => getValue() ?? '-',

    // Sorting
    enableSorting: !!col.sortAccessor,
    sortingFn: col.sortAccessor
      ? (rowA, rowB) => {
          const a = col.sortAccessor(rowA.original);
          const b = col.sortAccessor(rowB.original);
          if (a == null && b == null) return 0;
          if (a == null) return 1;
          if (b == null) return -1;
          return a < b ? -1 : a > b ? 1 : 0;
        }
      : undefined,

    // Size (ancho de columna)
    size: col.width,
    minSize: col.minWidth,
    maxSize: col.maxWidth,

    // Metadata (alineación, etc.)
    meta: {
      align: col.align || 'center',
      minWidth: col.minWidth,
      maxWidth: col.maxWidth,
    },
  }));
}

/**
 * Obtiene la clase de alineación para una columna
 *
 * @param {ColumnDef} column - Definición de columna TanStack
 * @returns {string} - Clase Tailwind de alineación
 */
export function getAlignmentClass(column) {
  const align = column.columnDef?.meta?.align || 'center';
  return {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align] || 'text-center';
}
