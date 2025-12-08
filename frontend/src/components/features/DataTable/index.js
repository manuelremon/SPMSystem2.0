/**
 * ModernDataTable - Exportaciones
 *
 * Uso:
 * import { ModernDataTable } from '@/components/features/DataTable';
 * import { withSpmAlignments } from '@/utils/tableAlignments';
 *
 * const columns = withSpmAlignments([
 *   { key: 'id', header: 'ID' },
 *   { key: 'nombre', header: 'Nombre' },
 * ]);
 *
 * <ModernDataTable columns={columns} rows={data} />
 */

export { ModernDataTable } from './ModernDataTable';
export { adaptLegacyColumns, getAlignmentClass } from './columns';
export { default } from './ModernDataTable';
