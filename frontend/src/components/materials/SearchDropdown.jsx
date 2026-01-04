/**
 * SearchDropdown - Dropdown component for material search results
 * Rendered as a portal to avoid z-index issues
 *
 * UX Improvements (2026-01):
 * - Better highlight colors for dark/light mode
 * - Two-line descriptions with line-clamp
 * - Organized grid layout for price alignment
 * - Professional typography and spacing
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
 * Uses cyan/sky color that works well in both light and dark modes
 */
function highlight(text, query) {
  if (!query) return text

  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  return String(text)
    .split(regex)
    .map((part, idx) =>
      regex.test(part) ? (
        <mark
          key={idx}
          className="bg-sky-400/30 text-[var(--fg-strong)] rounded-sm px-0.5 font-semibold"
        >
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
      className="fixed bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-elevated overflow-hidden animate-scale-in"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        minWidth: '320px',
        zIndex: 9999,
        maxHeight: '380px',
      }}
      role="listbox"
      aria-label={t('materials_resultados', 'Resultados de busqueda')}
    >
      {/* Header del dropdown - Sticky con blur */}
      <div className="sticky top-0 z-10 bg-[var(--bg-elevated)]/95 backdrop-blur-sm border-b border-[var(--border)] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {loadingSearch ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
              <span className="text-sm font-medium text-[var(--fg-muted)]">
                {t('common_buscando', 'Buscando...')}
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-[var(--fg)]">
                {results.length}
              </span>
              <span className="text-sm text-[var(--fg-muted)]">
                {results.length !== 1 ? t('common_resultados', 'resultados') : t('common_resultado', 'resultado')}
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 hover:bg-[var(--bg-soft)] rounded-lg transition-colors group"
          aria-label={t('common_cerrar', 'Cerrar')}
        >
          <X className="h-4 w-4 text-[var(--fg-muted)] group-hover:text-[var(--fg)]" />
        </button>
      </div>

      {/* Lista de resultados */}
      <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
        {/* Estado vacio */}
        {!loadingSearch && results.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--bg-soft)] flex items-center justify-center">
              <Search className="h-6 w-6 text-[var(--fg-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--fg)]">
              {t('materials_sin_resultados', 'No se encontraron materiales')}
            </p>
            <p className="text-xs text-[var(--fg-muted)] mt-1">
              {t('materials_intenta_otro_termino', 'Intenta con otro termino de busqueda')}
            </p>
          </div>
        )}

        {/* Items de resultado */}
        {!loadingSearch &&
          results.map((m, idx) => {
            const isSelected = selectedMaterial?.codigo === m.codigo
            const isHighlighted = highlightedIndex === idx

            return (
              <button
                key={m.codigo}
                role="option"
                aria-selected={isSelected}
                className={`
                  w-full text-left px-4 py-3
                  border-b border-[var(--border)]/40 last:border-b-0
                  transition-all duration-150 ease-out
                  ${isSelected
                    ? 'bg-[var(--primary)]/10 border-l-[3px] border-l-[var(--primary)]'
                    : 'border-l-[3px] border-l-transparent'}
                  ${isHighlighted
                    ? 'bg-[var(--primary)]/5'
                    : 'hover:bg-[var(--bg-soft)]/70'}
                `}
                onClick={() => onSelect(m)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                type="button"
              >
                {/* Grid layout para mejor alineacion */}
                <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                  {/* Columna izquierda: Codigo + Descripcion */}
                  <div className="min-w-0">
                    {/* Codigo SAP con badge de seleccion */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-[var(--primary)]">
                        {highlight(m.codigo, debouncedCodigo)}
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 py-0.5 rounded-full">
                          <Check className="h-3 w-3" />
                          <span>Seleccionado</span>
                        </span>
                      )}
                    </div>
                    {/* Descripcion en 2 lineas con line-clamp */}
                    <p className="text-sm text-[var(--fg)] leading-snug line-clamp-2">
                      {highlight(m.descripcion, debouncedDesc)}
                    </p>
                  </div>

                  {/* Columna derecha: Precio alineado */}
                  <div className="text-right shrink-0 pt-0.5">
                    <span className="inline-block text-sm font-mono font-semibold text-[var(--fg-strong)] bg-[var(--bg-soft)] px-2.5 py-1 rounded-lg">
                      {formatCurrency(m.precio_usd || 0)}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
      </div>

      {/* Footer con hint de teclado */}
      {results.length > 0 && (
        <div className="sticky bottom-0 bg-[var(--bg-elevated)]/95 backdrop-blur-sm border-t border-[var(--border)] px-4 py-2">
          <div className="flex items-center justify-between text-xs text-[var(--fg-muted)]">
            <span>
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-soft)] rounded text-[10px] font-mono mr-1">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-soft)] rounded text-[10px] font-mono mr-1">↓</kbd>
              navegar
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-soft)] rounded text-[10px] font-mono mr-1">Enter</kbd>
              seleccionar
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-soft)] rounded text-[10px] font-mono mr-1">Esc</kbd>
              cerrar
            </span>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
