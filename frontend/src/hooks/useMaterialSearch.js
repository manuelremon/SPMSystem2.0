/**
 * useMaterialSearch - Search and dropdown logic for materials
 *
 * Manages material search with debouncing, dropdown positioning,
 * keyboard navigation, and result selection.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { materiales } from '../services/spm'
import { useDebouncedValue as useDebounced } from './useDebouncedValue'

const DEBOUNCE_MS = 250
const MAX_RESULTS = 500

/**
 * @param {Object} params
 * @param {Function} params.onSelect - Called when a material is selected from results
 */
export function useMaterialSearch({ onSelect }) {
  const [searchCodigo, setSearchCodigo] = useState('')
  const [searchDesc, setSearchDesc] = useState('')
  const debouncedCodigo = useDebounced(searchCodigo, DEBOUNCE_MS)
  const debouncedDesc = useDebounced(searchDesc, DEBOUNCE_MS)
  const [results, setResults] = useState([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  const dropdownRef = useRef(null)
  const searchContainerRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        searchContainerRef.current && !searchContainerRef.current.contains(event.target)
      ) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  // Calculate dropdown position when open
  useEffect(() => {
    if (dropdownOpen && searchContainerRef.current) {
      const rect = searchContainerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
  }, [dropdownOpen, results])

  // Search materials on debounced input change
  useEffect(() => {
    const shouldSearch = debouncedCodigo.trim() !== '' || debouncedDesc.trim() !== ''
    if (!shouldSearch) {
      setResults([])
      setDropdownOpen(false)
      return
    }

    setLoadingSearch(true)
    setHighlightedIndex(-1)
    materiales
      .buscar({ codigo: debouncedCodigo.trim(), descripcion: debouncedDesc.trim(), limit: MAX_RESULTS })
      .then((res) => {
        const data = res.data?.data || res.data || []
        setResults(Array.isArray(data) ? data.slice(0, MAX_RESULTS) : [])
        setDropdownOpen(true)
      })
      .catch((err) => {
        console.error('search materiales', err)
        setResults([])
        setDropdownOpen(false)
      })
      .finally(() => setLoadingSearch(false))
  }, [debouncedCodigo, debouncedDesc])

  const handleSearchKeyDown = useCallback((e) => {
    if (!results.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDropdownOpen(true)
      setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDropdownOpen(true)
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && results[highlightedIndex]) {
        const mat = results[highlightedIndex]
        setDropdownOpen(false)
        setHighlightedIndex(-1)
        setSearchCodigo(mat.codigo)
        setSearchDesc(mat.descripcion)
        onSelect(mat, { keepSearchText: true })
      } else if (results.length > 0) {
        setDropdownOpen(true)
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false)
      setHighlightedIndex(-1)
    }
  }, [results, highlightedIndex, onSelect])

  const handleSelect = useCallback(
    (mat) => {
      setDropdownOpen(false)
      setHighlightedIndex(-1)
      setSearchCodigo('')
      setSearchDesc('')
      setResults([])
      onSelect(mat, { keepSearchText: false })
    },
    [onSelect]
  )

  const handleClearSearch = useCallback(() => {
    setSearchCodigo('')
    setSearchDesc('')
    setResults([])
    setDropdownOpen(false)
    setHighlightedIndex(-1)
  }, [])

  return {
    searchCodigo,
    searchDesc,
    debouncedCodigo,
    debouncedDesc,
    results,
    loadingSearch,
    dropdownOpen,
    highlightedIndex,
    dropdownPosition,
    dropdownRef,
    searchContainerRef,
    setSearchCodigo,
    setSearchDesc,
    setDropdownOpen,
    setHighlightedIndex,
    handleSearchKeyDown,
    handleSelect,
    handleClearSearch,
  }
}
