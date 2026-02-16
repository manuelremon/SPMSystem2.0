/**
 * MaterialSearchInput - Buscador de materiales para Forecast
 *
 * Búsqueda con autocompletado del catálogo de materiales
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../context/i18n';
import { materiales } from '../../services/spm';
import { Search, X, Loader2, Check } from '../ui/Icons';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Escape regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlight matching text
function highlightText(text, query) {
  if (!query || !text) return text;

  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return String(text)
    .split(regex)
    .map((part, idx) =>
      regex.test(part) ? (
        <mark key={idx} className="bg-yellow-200 text-slate-900 rounded px-0.5">
          {part}
        </mark>
      ) : (
        <span key={idx}>{part}</span>
      )
    );
}

const MaterialSearchInput = ({
  value,
  onChange,
  onSelect,
  selectedMaterial = null,
  placeholder = '',
  disabled = false,
  className = '',
  showSelectedInfo = true,
  searchFn = null
}) => {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const debouncedQuery = useDebounce(inputValue, 300);

  // Update input value when value prop changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]);

  // Search materials when query changes
  useEffect(() => {
    const searchMaterials = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        let data;
        if (searchFn) {
          // Custom search function (e.g., search in consumo_historico)
          data = await searchFn(debouncedQuery);
        } else {
          const response = await materiales.buscar({
            codigo: debouncedQuery,
            descripcion: debouncedQuery,
            limit: 20
          });
          // Backend returns { ok: true, data: [...] }
          data = response.data?.data || response.data || [];
        }
        setResults(Array.isArray(data) ? data : []);
        setHighlightedIndex(-1);
      } catch (error) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    searchMaterials();
  }, [debouncedQuery]);

  // Update dropdown position
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input change
  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value.toUpperCase();
    setInputValue(newValue);
    onChange?.(newValue);
    setIsOpen(true);
  }, [onChange]);

  // Handle material selection
  const handleSelect = useCallback((material) => {
    setInputValue(material.codigo);
    onChange?.(material.codigo);
    onSelect?.(material);
    setIsOpen(false);
  }, [onChange, onSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  }, [isOpen, highlightedIndex, results, handleSelect]);

  // Clear input
  const handleClear = useCallback(() => {
    setInputValue('');
    onChange?.('');
    onSelect?.(null);
    setResults([]);
    inputRef.current?.focus();
  }, [onChange, onSelect]);

  return (
    <div className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-slate-400" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.length >= 2 && setIsOpen(true)}
          placeholder={placeholder || t('forecast_buscar_material', 'Buscar material...')}
          disabled={disabled}
          className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
          autoComplete="off"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
          </button>
        )}
      </div>

      {/* Selected material info */}
      {showSelectedInfo && selectedMaterial && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-blue-600" />
            <span className="font-mono font-semibold text-blue-700">{selectedMaterial.codigo}</span>
          </div>
          <p className="text-blue-600 mt-1 truncate">{selectedMaterial.descripcion}</p>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (inputValue.length >= 2 || results.length > 0) && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            maxHeight: '320px'
          }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('common_buscando', 'Buscando...')}
                </span>
              ) : (
                `${results.length} ${t('common_resultados', 'resultados')}`
              )}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          {/* Results */}
          <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
            {!loading && results.length === 0 && inputValue.length >= 2 && (
              <div className="p-6 text-center">
                <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">
                  {t('forecast_sin_materiales', 'No se encontraron materiales')}
                </p>
              </div>
            )}

            {!loading && results.map((material, idx) => (
              <button
                key={material.codigo}
                type="button"
                onClick={() => handleSelect(material)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-slate-100 last:border-b-0 transition-colors ${
                  highlightedIndex === idx ? 'bg-blue-50' : 'hover:bg-slate-50'
                } ${selectedMaterial?.codigo === material.codigo ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-blue-600">
                      {highlightText(material.codigo, debouncedQuery)}
                    </span>
                    {selectedMaterial?.codigo === material.codigo && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <p className="text-sm text-slate-600 truncate mt-0.5">
                    {highlightText(material.descripcion, debouncedQuery)}
                  </p>
                  {material.unidad_medida && (
                    <span className="text-xs text-slate-400 mt-1">
                      Unidad: {material.unidad_medida}
                    </span>
                  )}
                </div>
                {material.precio_usd !== undefined && material.precio_usd !== null && (
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded shrink-0">
                    ${material.precio_usd?.toFixed(2)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MaterialSearchInput;
