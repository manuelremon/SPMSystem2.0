/**
 * MaterialsTable - Table component for displaying added materials
 * Handles quantity editing, comments, and deletion
 */
import { useI18n } from '../../context/i18n'
import { formatCurrency } from '../../utils/formatters'
import { MessageSquare, Trash2 } from 'lucide-react'

export function MaterialsTable({
  items,
  onQtyChange,
  onDelete,
  onOpenComment,
}) {
  const { t } = useI18n()

  return (
    <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              {t('materials_col_codigo', 'Codigo')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              {t('materials_col_descripcion', 'Descripcion')}
            </th>
            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              {t('materials_col_unidad', 'Unidad')}
            </th>
            <th className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] w-20">
              {t('materials_col_cantidad', 'Cant.')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              {t('materials_col_precio', 'Precio USD')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
              {t('materials_col_subtotal', 'Subtotal')}
            </th>
            <th className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] w-12">
              {t('materials_col_nota', 'Nota')}
            </th>
            <th className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] w-12">
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td
                className="px-4 py-8 text-center text-[var(--fg-muted)]"
                colSpan={8}
              >
                {t('materials_sin_materiales', 'Sin materiales agregados')}
              </td>
            </tr>
          )}
          {items.map((it, idx) => {
            const subtotal = (it.cantidad || 0) * (it.precio_unitario || 0)

            return (
              <tr
                key={it.codigo}
                className={`
                  border-b border-[var(--border)] transition-colors
                  ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[var(--bg-soft)]/30'}
                  hover:bg-[var(--bg-elevated)]
                `}
              >
                <td className="px-4 py-3 font-mono font-semibold text-[var(--fg-strong)]">
                  {it.codigo}
                </td>
                <td className="px-4 py-3 text-[var(--fg)]">{it.descripcion}</td>
                <td className="px-4 py-3 text-center text-[var(--fg-muted)]">
                  {it.unidad || '-'}
                </td>
                <td className="px-2 py-3">
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={it.cantidad || 0}
                      onChange={(e) => onQtyChange(it.codigo, e.target.value)}
                      className="w-16 text-center px-2 py-1.5 rounded-md border-2 border-[var(--accent)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--accent)]/50 focus:outline-none"
                      aria-label={t('materials_cantidad_label', 'Cantidad del material')}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--fg)]">
                  {formatCurrency(it.precio_unitario || 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--fg-strong)]">
                  {formatCurrency(subtotal)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => onOpenComment(it.codigo)}
                    className={`
                      p-2 rounded-lg transition-colors
                      ${it.comentario
                        ? 'text-[var(--primary)] bg-[var(--primary-muted)]'
                        : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-elevated)]'
                      }
                    `}
                    title={it.comentario || t('materials_agregar_nota', 'Agregar nota')}
                    aria-label={`${t('materials_nota_label', 'Nota para')} ${it.codigo}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </td>
                <td className="px-2 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => onDelete(it.codigo)}
                    className="p-2 rounded-lg text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                    title={t('materials_eliminar', 'Eliminar')}
                    aria-label={`${t('materials_eliminar', 'Eliminar')} ${it.codigo}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
