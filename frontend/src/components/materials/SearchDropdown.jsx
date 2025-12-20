/**
 * SearchDropdown - Dropdown component for material search results
 * Rendered as a portal to avoid z-index issues
 */
import { createPortal } from 'react-dom'
import { useI18n } from '../../context/i18n'
import { formatCurrency } from '../../utils/formatters'
import { Search, X, Loader2, Check } from '../ui/Icons'

/**
 * Escape regex special characters for safe string matching
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Highlight matching text in search results
 */
function highlight(text, query) {
  if (!query) return text

  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  return String(text)
    .split(regex)
    .map((part, idx) =>
      regex.test(part) ? (
        <mark key={idx} className="bg-[var(--warning)] text-[var(--on-primary)] rounded px-0.5">
          {part}
        </mark>
      ) : (
        <span key={idx}>{part}</span>
      )
    )
}

export function SearchDropdown({
  dropdownRef,
  dropdownOpen,
  dropdownPosition,
  results,
  loadingSearch,
  selectedMaterial,
  highlightedIndex,
  debouncedCodigo,
  debouncedDesc,
  onSelect,
  onClose,
  setHighlightedIndex,
}) {
  const { t } = useI18n()

  if (!dropdownOpen) return null

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed bg-[var(--card)] border-2 border-[var(--border-strong)] rounded-xl shadow-elevated overflow-hidden animate-scale-in"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        zIndex: 9999,
        maxHeight: '320px',
      }}
      role="listbox"
      aria-label={t('materials_resultados', 'Resultados de busqueda')}
    >
      {/* Header del dropdown */}
      <div className="sticky top-0 bg-[var(--bg-elevated)] border-b border-[var(--border-strong)] px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--fg-muted)]">
          {loadingSearch ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('common_buscando', 'Buscando...')}
            </span>
          ) : (
            `${results.length} ${results.length !== 1 ? t('common_resultados', 'resultados') : t('common_resultado', 'resultado')}`
          )}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-[var(--bg-soft)] rounded transition-colors"
          aria-label={t('common_cerrar', 'Cerrar')}
        >
          <X className="h-4 w-4 text-[var(--fg-muted)]" />
        </button>
      </div>

      {/* Lista de resultados */}
      <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
        {!loadingSearch && results.length === 0 && (
          <div className="p-6 text-center">
            <Search className="h-8 w-8 text-[var(--fg-muted)]/40 mx-auto mb-2" />
            <p className="text-sm text-[var(--fg-muted)]">
              {t('materials_sin_resultados', 'No se encontraron materiales')}
            </p>
          </div>
        )}
        {!loadingSearch &&
          results.map((m, idx) => (
            <button
              key={m.codigo}
              role="option"
              aria-selected={selectedMaterial?.codigo === m.codigo}
              className={`
                w-full text-left px-4 py-3 flex items-center gap-3
                border-b border-[var(--border)]/50 last:border-b-0
                transition-all duration-100
                ${selectedMaterial?.codigo === m.codigo
                  ? 'bg-[var(--primary)]/10 border-l-2 border-l-[var(--primary)]'
                  : 'border-l-2 border-l-transparent'}
                ${highlightedIndex === idx
                  ? 'bg-[var(--primary-muted)]'
                  : 'hover:bg-[var(--bg-soft)]'}
              `}
              onClick={() => onSelect(m)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              type="button"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[var(--primary)]">
                    {highlight(m.codigo, debouncedCodigo)}
                  </span>
                  {selectedMaterial?.codigo === m.codigo && (
                    <Check className="h-4 w-4 text-[var(--primary)]" />
                  )}
                </div>
                <p className="text-sm text-[var(--fg)] truncate mt-0.5">
                  {highlight(m.descripcion, debouncedDesc)}
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--fg-muted)] bg-[var(--bg-soft)] px-2 py-1 rounded shrink-0">
                {formatCurrency(m.precio_usd || 0)}
              </span>
            </button>
          ))}
      </div>
    </div>,
    document.body
  )
}
