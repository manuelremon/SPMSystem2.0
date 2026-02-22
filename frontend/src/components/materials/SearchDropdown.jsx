/**
 * SearchDropdown - Dropdown component for material search results
 * Rendered as a portal to avoid z-index issues
 *
 * UX Improvements (2026-01):
 * - Better highlight colors for dark/light mode
 * - Two-line descriptions with line-clamp
 * - Organized grid layout for price alignment
 * - Professional typography and spacing
 *
 * Migrated to MUI (2026-02)
 */
import { createPortal } from 'react-dom'
import { useI18n } from '../../context/i18n'
import { formatCurrency } from '../../utils/formatters'
import {
  Box,
  Paper,
  Typography,
  IconButton,
  CircularProgress,
  Stack,
  Chip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import CheckIcon from '@mui/icons-material/Check'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'

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
        <Box
          component="mark"
          key={idx}
          sx={{
            bgcolor: 'info.light',
            color: 'text.primary',
            borderRadius: 0.5,
            px: 0.5,
            fontWeight: 600,
          }}
        >
          {part}
        </Box>
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
  favoritos = [],
  toggleFavorito,
}) {
  const { t } = useI18n()

  if (!dropdownOpen) return null

  return createPortal(
    <Paper
      ref={dropdownRef}
      elevation={8}
      sx={{
        position: 'fixed',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        minWidth: '320px',
        zIndex: 9999,
        maxHeight: '380px',
        overflow: 'hidden',
        borderRadius: 3,
        animation: 'scaleIn 0.15s ease-out',
        '@keyframes scaleIn': {
          '0%': { opacity: 0, transform: 'scale(0.95)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      }}
      role="listbox"
      aria-label={t('materials_resultados', 'Resultados de busqueda')}
    >
      {/* Header del dropdown - Sticky con blur */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
          backdropFilter: 'blur(8px)',
          borderBottom: 1,
          borderColor: 'divider',
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          {loadingSearch ? (
            <>
              <CircularProgress size={16} color="primary" />
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                {t('common_buscando', 'Buscando...')}
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {results.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {results.length !== 1 ? t('common_resultados', 'resultados') : t('common_resultado', 'resultado')}
              </Typography>
            </>
          )}
        </Stack>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label={t('common_cerrar', 'Cerrar')}
          sx={{
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Lista de resultados */}
      <Box sx={{ overflowY: 'auto', maxHeight: '320px' }}>
        {/* Estado vacio */}
        {!loadingSearch && results.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                mx: 'auto',
                mb: 1.5,
                borderRadius: '50%',
                bgcolor: 'action.hover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SearchIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
            </Box>
            <Typography variant="body2" fontWeight={500} color="text.primary">
              {t('materials_sin_resultados', 'No se encontraron materiales')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {t('materials_intenta_otro_termino', 'Intenta con otro termino de busqueda')}
            </Typography>
          </Box>
        )}

        {/* Items de resultado */}
        {!loadingSearch &&
          results.map((m, idx) => {
            const isSelected = selectedMaterial?.codigo === m.codigo
            const isHighlighted = highlightedIndex === idx

            return (
              <Box
                component="div"
                key={m.codigo}
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(m)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                sx={{
                  width: '100%',
                  textAlign: 'left',
                  px: 2,
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: 'divider',
                  borderLeft: 3,
                  borderLeftColor: isSelected ? 'primary.main' : 'transparent',
                  transition: 'all 0.15s ease-out',
                  bgcolor: isSelected
                    ? 'primary.lighter'
                    : isHighlighted
                    ? 'action.hover'
                    : 'transparent',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: isSelected ? 'primary.lighter' : 'action.hover',
                  },
                  '&:last-child': {
                    borderBottom: 0,
                  },
                }}
              >
                {/* Grid layout para mejor alineacion */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 1.5,
                    alignItems: 'start',
                  }}
                >
                  {/* Columna izquierda: Codigo + Descripcion */}
                  <Box sx={{ minWidth: 0 }}>
                    {/* Codigo SAP con badge de seleccion */}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: 'primary.main',
                        }}
                      >
                        {highlight(m.codigo, debouncedCodigo)}
                      </Typography>
                      {isSelected && (
                        <Chip
                          icon={<CheckIcon sx={{ fontSize: 12 }} />}
                          label="Seleccionado"
                          size="small"
                          color="primary"
                          sx={{
                            height: 20,
                            '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' },
                            '& .MuiChip-icon': { ml: 0.5 },
                          }}
                        />
                      )}
                      {toggleFavorito && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorito(m.codigo)
                          }}
                          aria-label={
                            favoritos.some(f => f.codigo === m.codigo)
                              ? t('favorites_remove', 'Quitar de favoritos')
                              : t('favorites_add', 'Agregar a favoritos')
                          }
                          sx={{ p: 0.25 }}
                        >
                          {favoritos.some(f => f.codigo === m.codigo) ? (
                            <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                          ) : (
                            <StarBorderIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          )}
                        </IconButton>
                      )}
                    </Stack>
                    {/* Descripcion en 2 lineas con line-clamp */}
                    <Typography
                      variant="body2"
                      color="text.primary"
                      sx={{
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {highlight(m.descripcion, debouncedDesc)}
                    </Typography>
                  </Box>

                  {/* Columna derecha: Precio alineado */}
                  <Box sx={{ textAlign: 'right', flexShrink: 0, pt: 0.5 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        bgcolor: 'action.hover',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        display: 'inline-block',
                      }}
                    >
                      {formatCurrency(m.precio_usd || 0)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )
          })}
      </Box>

      {/* Footer con hint de teclado */}
      {results.length > 0 && (
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            bgcolor: 'background.paper',
            backdropFilter: 'blur(8px)',
            borderTop: 1,
            borderColor: 'divider',
            px: 2,
            py: 1,
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ typography: 'caption', color: 'text.secondary' }}
          >
            <Box>
              <Box
                component="kbd"
                sx={{
                  px: 0.75,
                  py: 0.25,
                  bgcolor: 'action.hover',
                  borderRadius: 0.5,
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  mr: 0.5,
                }}
              >
                ↑
              </Box>
              <Box
                component="kbd"
                sx={{
                  px: 0.75,
                  py: 0.25,
                  bgcolor: 'action.hover',
                  borderRadius: 0.5,
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  mr: 0.5,
                }}
              >
                ↓
              </Box>
              navegar
            </Box>
            <Box>
              <Box
                component="kbd"
                sx={{
                  px: 0.75,
                  py: 0.25,
                  bgcolor: 'action.hover',
                  borderRadius: 0.5,
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  mr: 0.5,
                }}
              >
                Enter
              </Box>
              seleccionar
            </Box>
            <Box>
              <Box
                component="kbd"
                sx={{
                  px: 0.75,
                  py: 0.25,
                  bgcolor: 'action.hover',
                  borderRadius: 0.5,
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  mr: 0.5,
                }}
              >
                Esc
              </Box>
              cerrar
            </Box>
          </Stack>
        </Box>
      )}
    </Paper>,
    document.body
  )
}
