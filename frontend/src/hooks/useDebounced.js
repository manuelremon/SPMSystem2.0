/**
 * Hook para debounce de valores
 *
 * Útil para evitar llamadas excesivas a APIs durante escritura en inputs.
 *
 * @param {any} value - Valor a debounce
 * @param {number} delay - Retraso en milisegundos (default: 300ms)
 * @returns {any} Valor debounced
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('')
 * const debouncedSearch = useDebounced(searchTerm, 500)
 *
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     fetchResults(debouncedSearch)
 *   }
 * }, [debouncedSearch])
 */

import { useState, useEffect } from 'react'

export function useDebounced(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

export default useDebounced
