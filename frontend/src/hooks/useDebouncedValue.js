import { useState, useEffect } from 'react';

/**
 * Hook para debounce de valores
 * Útil para operaciones costosas como filtrados, búsquedas, etc.
 *
 * @param {*} value - Valor a debounce
 * @param {number} delay - Delay en ms (default 300ms)
 * @returns {*} Valor debounced
 *
 * @example
 * const [searchLocal, setSearchLocal] = useState('');
 * const searchDebounced = useDebouncedValue(searchLocal, 500);
 *
 * // searchLocal actualiza inmediatamente en UI
 * // searchDebounced dispara búsqueda/filtrado después de 500ms sin cambios
 */
export function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Esperar delay ms antes de actualizar
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: cancelar timeout si el valor cambia antes de que expire
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default useDebouncedValue;
