import React from "react";
import { Search, X } from "lucide-react";

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
    <div className={`relative ${className}`}>
      <Search
        className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-subtle)]"
        aria-hidden="true"
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`
          w-full
          pl-11 pr-${value && onClear ? '10' : '4'} py-3
          bg-[var(--input-bg)]
          border border-[var(--input-border)]
          rounded-[var(--radius-md)]
          text-sm text-[var(--fg)]
          placeholder:text-[var(--fg-subtle)]
          transition-all duration-[var(--transition-base)]
          focus:border-[var(--primary)]
          focus:ring-2 focus:ring-[var(--input-focus)]
          focus:outline-none
          hover:border-[var(--border-strong)]
        `}
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={clearLabel}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <X className="w-4 h-4 text-[var(--fg-muted)]" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default SearchInput;
