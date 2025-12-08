import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

/**
 * ThemeToggle Component - Toggle Dark/Light Mode
 *
 * Muestra un boton que cicla entre system/light/dark
 * con iconos apropiados para cada estado.
 */
export function ThemeToggle({ className = '', showLabel = false, size = 'md' }) {
  const { theme, effectiveTheme, cycleTheme, toggleTheme } = useTheme();

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // Icono segun el tema actual
  const Icon = theme === 'system' ? Monitor : effectiveTheme === 'dark' ? Moon : Sun;

  // Label para accesibilidad y tooltip
  const label = theme === 'system'
    ? 'Tema del sistema'
    : effectiveTheme === 'dark'
    ? 'Modo oscuro'
    : 'Modo claro';

  return (
    <button
      onClick={toggleTheme}
      onDoubleClick={cycleTheme}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-xl
        ${sizeClasses[size]}
        bg-white/50 dark:bg-slate-800/50
        backdrop-blur-sm
        border border-white/50 dark:border-white/10
        text-slate-600 dark:text-slate-300
        hover:bg-white/70 dark:hover:bg-slate-700/50
        hover:text-slate-800 dark:hover:text-white
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-400/50
        ${className}
      `}
      title={`${label} (doble click para ciclar)`}
      aria-label={label}
    >
      <Icon className={`${iconSizes[size]} transition-transform duration-200`} />
      {showLabel && (
        <span className="text-sm font-medium">{label}</span>
      )}
    </button>
  );
}

/**
 * ThemeToggleMenu - Dropdown con opciones de tema
 */
export function ThemeToggleMenu({ className = '' }) {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'system', label: 'Sistema', icon: Monitor },
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
  ];

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`
            flex items-center gap-3 px-3 py-2 rounded-lg text-sm
            transition-all duration-200
            ${theme === value
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
              : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }
          `}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

export default ThemeToggle;
