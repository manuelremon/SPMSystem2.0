import React from "react";
import clsx from "clsx";
import { Search, X } from "lucide-react";

/**
 * SearchInput Component - Glass Morphism Style
 * Translucent search input with blur effect
 */
export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Buscar...",
  className = "",
  clearLabel = "Limpiar búsqueda",
  ...props
}) {
  return (
    <div className={clsx("relative", className)}>
      <Search
        className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500"
        aria-hidden="true"
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={placeholder}
        className={clsx(
          // Glass base
          "w-full",
          "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
          "rounded-xl",
          value && onClear ? "pl-11 pr-10 py-3" : "pl-11 pr-4 py-3",
          // Typography
          "text-sm text-slate-800 dark:text-slate-200",
          "placeholder:text-slate-400 dark:placeholder:text-slate-500",
          // Border - Always blue
          "border border-blue-300 dark:border-blue-600",
          "ring-1 ring-blue-100 dark:ring-blue-900/30",
          // Transitions
          "transition-all duration-200",
          // Focus states - glass glow
          "focus:outline-none",
          "focus:bg-white/70 dark:focus:bg-slate-700/70",
          "focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800/30 focus:border-blue-400 dark:focus:border-blue-500",
          // Hover
          "hover:bg-white/60 dark:hover:bg-slate-700/60",
          "hover:border-blue-400 dark:hover:border-blue-500"
        )}
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={clearLabel}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <X className="w-4 h-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default SearchInput;
