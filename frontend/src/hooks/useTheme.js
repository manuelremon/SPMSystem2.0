/**
 * useTheme Hook - Tema siempre claro (dark mode eliminado)
 */

export function useTheme() {
  return {
    theme: 'light',
    effectiveTheme: 'light',
    setTheme: () => {},
    toggleTheme: () => {},
    cycleTheme: () => {},
    isDark: false,
    isLight: true,
    isSystem: false,
  };
}

export default useTheme;
