/**
 * useTheme - Hook para gestionar el tema de la aplicacion (light/dark)
 *
 * Prioridad de inicializacion:
 * 1. Valor guardado en localStorage
 * 2. Preferencia del sistema operativo (prefers-color-scheme)
 * 3. 'light' por defecto
 *
 * Aplica el atributo data-theme en :root para activar las variables CSS
 */

import { useState, useEffect, useCallback } from 'react'

const THEME_KEY = 'spm-theme'

/**
 * Obtiene el tema inicial basado en localStorage o preferencias del sistema
 */
function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'

  // 1. Intentar obtener de localStorage
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light') {
    return stored
  }

  // 2. Detectar preferencia del sistema
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  // 3. Default
  return 'light'
}

/**
 * Hook para gestionar el tema de la aplicacion
 * @returns {{ theme: 'light' | 'dark', setTheme: Function, toggleTheme: Function, isDark: boolean }}
 */
export function useTheme() {
  const [theme, setThemeState] = useState(getInitialTheme)

  // Aplicar tema al DOM y guardar en localStorage
  useEffect(() => {
    const root = document.documentElement

    // Aplicar data-theme
    root.setAttribute('data-theme', theme)

    // Guardar en localStorage
    localStorage.setItem(THEME_KEY, theme)

    // Limpiar tema anterior del key viejo si existe
    const oldTheme = localStorage.getItem('theme')
    if (oldTheme) {
      localStorage.removeItem('theme')
    }
  }, [theme])

  // Escuchar cambios en preferencias del sistema
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e) => {
      // Solo aplicar si no hay preferencia guardada
      const stored = localStorage.getItem(THEME_KEY)
      if (!stored) {
        setThemeState(e.matches ? 'dark' : 'light')
      }
    }

    // Algunos navegadores usan addListener, otros addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
    } else {
      mediaQuery.addListener(handleChange)
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange)
      } else {
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [])

  // Setter memoizado
  const setTheme = useCallback((newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme)
    }
  }, [])

  // Toggle memoizado
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
  }
}

export default useTheme
