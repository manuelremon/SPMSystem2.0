/**
 * ThemeToggle - Boton para alternar entre modo claro y oscuro
 *
 * Usa el contexto de tema para cambiar entre light/dark mode.
 * Muestra icono de Sol cuando esta en dark mode (para cambiar a light)
 * y Luna cuando esta en light mode (para cambiar a dark).
 */

import React from 'react'
import clsx from 'clsx'
import { Sun, Moon } from './Icons'
import { useThemeContext } from '../../context/ThemeContext'
import { useI18n } from '../../context/i18n'

/**
 * Boton de toggle para cambiar tema
 * @param {Object} props
 * @param {string} [props.className] - Clases CSS adicionales
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] - Tamano del boton
 * @param {boolean} [props.showLabel] - Mostrar texto ademas del icono
 * @param {boolean} [props.collapsed] - Modo colapsado (solo icono)
 */
export function ThemeToggle({
  className = '',
  size = 'md',
  showLabel = false,
  collapsed = false,
}) {
  const { theme, toggleTheme, isDark } = useThemeContext()
  const { t } = useI18n()

  const sizes = {
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  const label = isDark
    ? t('theme_switch_light', 'Cambiar a modo claro')
    : t('theme_switch_dark', 'Cambiar a modo oscuro')

  // Modo colapsado: solo icono circular
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={clsx(
          'flex items-center justify-center rounded-xl',
          'transition-all duration-200',
          'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          'hover:bg-[var(--bg-glass)]',
          sizes[size],
          className
        )}
        aria-label={label}
        title={label}
      >
        {isDark ? (
          <Sun className={clsx(iconSizes[size], 'text-amber-400')} />
        ) : (
          <Moon className={clsx(iconSizes[size], 'text-slate-500')} />
        )}
      </button>
    )
  }

  // Modo expandido: con label opcional
  if (showLabel) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={clsx(
          'flex items-center gap-3 w-full rounded-xl',
          'transition-all duration-200',
          'text-sm font-medium px-3 py-2.5',
          'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          'hover:bg-[var(--bg-glass)]',
          className
        )}
        aria-label={label}
      >
        {isDark ? (
          <Sun className={clsx(iconSizes[size], 'text-amber-400')} />
        ) : (
          <Moon className={clsx(iconSizes[size], 'text-slate-500')} />
        )}
        <span>{t('tooltip_tema', 'Cambiar tema')}</span>
      </button>
    )
  }

  // Modo por defecto: solo icono
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={clsx(
        'flex items-center justify-center rounded-xl',
        'transition-all duration-200',
        'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
        'hover:bg-[var(--bg-glass)]',
        sizes[size],
        className
      )}
      aria-label={label}
      title={label}
    >
      {isDark ? (
        <Sun className={clsx(iconSizes[size], 'text-amber-400')} />
      ) : (
        <Moon className={clsx(iconSizes[size], 'text-slate-500')} />
      )}
    </button>
  )
}

export default ThemeToggle
