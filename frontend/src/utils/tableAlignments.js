/**
 * Lógica de alineación de columnas para tablas SPM
 *
 * Este archivo centraliza la lógica de dominio específica de SPM,
 * manteniendo los componentes UI genéricos y reutilizables.
 *
 * Estándar de alineación:
 * - Centrado: IDs, códigos, estados, fechas, cantidades
 * - Derecha: Montos, precios, totales (valores numéricos monetarios)
 * - Izquierda: Textos largos (justificaciones, descripciones)
 */

// Mapeo de columnas SPM a alineación
export const SPM_COLUMN_ALIGNMENTS = {
  // ══════════════════════════════════════════════════════════════
  // COLUMNAS CENTRADAS (IDs, códigos, fechas)
  // ══════════════════════════════════════════════════════════════
  id: 'center',
  centro: 'center',
  almacen: 'center',
  almacen_virtual: 'center',
  planificado: 'center',

  // ══════════════════════════════════════════════════════════════
  // COLUMNAS ALINEADAS A LA IZQUIERDA (Nombres, estados, sectores)
  // ══════════════════════════════════════════════════════════════
  sector: 'left',
  solicitante: 'left',
  planificador: 'left',

  // Estados y criticidad
  estado: 'left',
  status: 'left',
  criticidad: 'left',
  prioridad: 'left',

  // Fechas
  fecha: 'center',
  fecha_creacion: 'center',
  fecha_necesidad: 'center',
  created_at: 'center',
  updated_at: 'center',

  // Cantidades y contadores
  items: 'center',
  items_count: 'center',
  cantidad: 'center',

  // Roles y tipos
  rol: 'center',
  roles: 'center',
  tipo: 'center',

  // Acciones
  accion: 'center',
  acciones: 'center',

  // ══════════════════════════════════════════════════════════════
  // COLUMNAS ALINEADAS A LA DERECHA (Montos y valores monetarios)
  // ══════════════════════════════════════════════════════════════
  monto: 'right',
  total_monto: 'right',
  precio: 'right',
  precio_unitario: 'right',
  subtotal: 'right',
  total: 'right',
  presupuesto: 'right',
  importe: 'right',
  valor: 'right',

  // ══════════════════════════════════════════════════════════════
  // COLUMNAS ALINEADAS A LA IZQUIERDA (Texto largo)
  // ══════════════════════════════════════════════════════════════
  justificacion: 'left',
  asunto: 'left',
  descripcion: 'left',
  observaciones: 'left',
  motivo: 'left',
  comentario: 'left',
  notas: 'left',
  mensaje: 'left',
  nombre: 'left',
  email: 'left',
};

/**
 * Obtiene la alineación para una columna específica
 *
 * @param {string} key - Clave de la columna
 * @returns {'left' | 'center' | 'right'} - Alineación de la columna
 *
 * @example
 * getColumnAlignment('monto') // 'right'
 * getColumnAlignment('estado') // 'center'
 * getColumnAlignment('descripcion') // 'left'
 */
export function getColumnAlignment(key) {
  if (!key) return 'center';

  const keyLower = key.toLowerCase();

  // Buscar coincidencia exacta primero
  if (SPM_COLUMN_ALIGNMENTS[keyLower]) {
    return SPM_COLUMN_ALIGNMENTS[keyLower];
  }

  // Buscar coincidencia parcial para columnas compuestas
  // ej: 'total_monto' contiene 'monto'
  const rightKeys = ['monto', 'precio', 'total', 'subtotal', 'presupuesto', 'importe', 'valor'];
  if (rightKeys.some(k => keyLower.includes(k))) {
    return 'right';
  }

  const leftKeys = ['justificacion', 'asunto', 'descripcion', 'observaciones', 'motivo', 'comentario', 'notas', 'mensaje'];
  if (leftKeys.some(k => keyLower.includes(k))) {
    return 'left';
  }

  // Por defecto: centrado (estándar empresarial para datos tabulares)
  return 'center';
}

/**
 * Agrega alineación automática a un array de columnas
 *
 * @param {Array<{key: string, header: string, align?: string}>} columns - Columnas sin alineación
 * @returns {Array<{key: string, header: string, align: string}>} - Columnas con alineación
 *
 * @example
 * const columns = withSpmAlignments([
 *   { key: 'id', header: 'ID' },
 *   { key: 'monto', header: 'Monto' },
 * ]);
 * // [{ key: 'id', header: 'ID', align: 'center' }, { key: 'monto', header: 'Monto', align: 'right' }]
 */
export function withSpmAlignments(columns) {
  return columns.map(col => ({
    ...col,
    align: col.align ?? getColumnAlignment(col.key),
  }));
}
