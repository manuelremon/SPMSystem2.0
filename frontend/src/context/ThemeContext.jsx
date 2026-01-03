/**
 * ThemeContext - Provider para gestionar el tema de la aplicacion
 *
 * Provee acceso al estado del tema (light/dark) a toda la aplicacion
 * mediante el hook useThemeContext.
 *
 * Uso:
 * import { useThemeContext } from '../context/ThemeContext'
 * const { theme, toggleTheme, isDark } = useThemeContext()
 */

import React, { createContext, useContext } from 'react'
import { useTheme } from '../hooks/useTheme'

// Contexto con valores por defecto (para casos sin provider)
const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: false,
})

/**
 * Provider que envuelve la aplicacion y provee el estado del tema
 */
export function ThemeProvider({ children }) {
  const themeState = useTheme()

  return (
    <ThemeContext.Provider value={themeState}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Hook para acceder al contexto del tema
 * @returns {{ theme: 'light' | 'dark', setTheme: Function, toggleTheme: Function, isDark: boolean }}
 */
export function useThemeContext() {
  const context = useContext(ThemeContext)
  if (!context) {
    console.warn('useThemeContext debe usarse dentro de un ThemeProvider')
  }
  return context
}

export default ThemeContext
