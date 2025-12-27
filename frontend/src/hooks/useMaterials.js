/**
 * useMaterials - Custom hook for Materials page state management
 * Encapsulates all state, side effects, and handlers for the materials workflow
 *
 * This hook manages the complete Materials page workflow including:
 * - Solicitud loading and persistence
 * - Material search with debouncing
 * - Item cart management (add, update quantity, delete)
 * - Modal states (detail, cancel, submit, comment, assistant)
 * - Budget validation
 */
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { materiales, solicitudes } from '../services/spm'
import api from '../services/api'
import { useI18n } from '../context/i18n'
import { useDebounced } from './useDebounced'

const DEBOUNCE_MS = 250
const MAX_RESULTS = 500
const AUTO_DISMISS_MS = 3000

/**
 * Main materials hook - manages all state and business logic
 */
export function useMaterials() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()

  // ═══════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════

  // Solicitud principal
  const [sol, setSol] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  // Búsqueda
  const [searchCodigo, setSearchCodigo] = useState('')
  const [searchDesc, setSearchDesc] = useState('')
  const debouncedCodigo = useDebounced(searchCodigo, DEBOUNCE_MS)
  const debouncedDesc = useDebounced(searchDesc, DEBOUNCE_MS)
  const [results, setResults] = useState([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  // Material seleccionado y detalle
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailCache, setDetailCache] = useState({})
  const [detailViewed, setDetailViewed] = useState(false)
  const [showStockFull, setShowStockFull] = useState(false)

  // Modales
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false)
  const [commentModal, setCommentModal] = useState({ open: false, codigo: null, comment: '' })

  // Loading states para operaciones
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  // Tracking de cambios sin guardar
  const [lastSavedItems, setLastSavedItems] = useState([])

  // Presupuesto
  const [presupuesto, setPresupuesto] = useState(null)

  // Refs
  const dropdownRef = useRef(null)
  const searchContainerRef = useRef(null)

  // ═══════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════

  const contextoCentro = useMemo(
    () => sol?.centro || localStorage.getItem('lastCentro') || '',
    [sol]
  )

  const contextoAlmacen = useMemo(
    () => sol?.almacen_virtual || sol?.almacen || localStorage.getItem('lastAlmacen') || '',
    [sol]
  )

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(items) !== JSON.stringify(lastSavedItems)
  }, [items, lastSavedItems])

  const total = useMemo(
    () => items.reduce((sum, it) => sum + (it.cantidad || 0) * (it.precio_unitario || 0), 0),
    [items]
  )

  const presupuestoInsuf = presupuesto && total > (presupuesto.saldo_usd ?? 0)

  const itemsSorted = useMemo(
    () => [...items].sort((a, b) => String(b.codigo).localeCompare(String(a.codigo))),
    [items]
  )

  // ═══════════════════════════════════════════════════════════════════
  // SIDE EFFECTS
  // ═══════════════════════════════════════════════════════════════════

  // Cargar solicitud inicial
  useEffect(() => {
    if (!id) return

    setLoading(true)
    solicitudes
      .obtener(id)
      .then((res) => {
        const data = res.data.solicitud || res.data
        setSol(data)
        const loadedItems = Array.isArray(data?.items) ? data.items : []
        setItems(loadedItems)
        setLastSavedItems(loadedItems)
        if (data?.centro && data?.sector) {
          api
            .get('/planificador/presupuesto', { params: { centro: data.centro, sector: data.sector } })
            .then((r) => setPresupuesto(r.data))
            .catch(() => {})
        }
      })
      .catch((err) => setError(err.response?.data?.error?.message || err.message))
      .finally(() => setLoading(false))
  }, [id])

  // Cargar items sugeridos desde el asistente NLP (si existen)
  useEffect(() => {
    const suggestedJson = sessionStorage.getItem('suggested_items')
    if (suggestedJson) {
      try {
        const suggestedItems = JSON.parse(suggestedJson)
        if (Array.isArray(suggestedItems) && suggestedItems.length > 0) {
          // Agregar items sugeridos a los existentes (evitando duplicados)
          setItems((prev) => {
            const existingCodes = new Set(prev.map((it) => it.codigo))
            const newItems = suggestedItems.filter((it) => !existingCodes.has(it.codigo))
            if (newItems.length > 0) {
              setActionMsg(t('materials_suggestions_loaded', `${newItems.length} material(es) sugeridos agregados`))
              return [...prev, ...newItems.map((it) => ({
                codigo: it.codigo || it.codigo_sap,
                descripcion: it.descripcion,
                descripcion_larga: it.descripcion_larga,
                unidad: it.unidad || 'UNI',
                cantidad: it.cantidad || 1,
                precio_unitario: it.precio_unitario || 0,
              }))]
            }
            return prev
          })
        }
      } catch (err) {
        console.error('Error parsing suggested_items:', err)
      } finally {
        // Limpiar sessionStorage después de procesar
        sessionStorage.removeItem('suggested_items')
      }
    }
  }, [t])

  // Cerrar dropdown al hacer clic afuera
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

  // Calcular posición del dropdown cuando se abre
  useEffect(() => {
    if (dropdownOpen && searchContainerRef.current) {
      const rect = searchContainerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      })
    }
  }, [dropdownOpen, results])

  // Auto-dismiss de mensajes de éxito
  useEffect(() => {
    if (actionMsg) {
      const timer = setTimeout(() => setActionMsg(''), AUTO_DISMISS_MS)
      return () => clearTimeout(timer)
    }
  }, [actionMsg])

  // Búsqueda de materiales
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
        // Soporta tanto formato nuevo {ok, data: [...]} como antiguo [...]
        const materiales = res.data?.data || res.data || []
        setResults(Array.isArray(materiales) ? materiales.slice(0, MAX_RESULTS) : [])
        setDropdownOpen(true)
      })
      .catch((err) => {
        console.error('search materiales', err)
        setResults([])
        setDropdownOpen(false)
      })
      .finally(() => setLoadingSearch(false))
  }, [debouncedCodigo, debouncedDesc])

  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  const loadDetail = useCallback(
    async (codigo, showModal = false) => {
      setLoadingDetail(true)
      try {
        const res = await materiales.detalle(codigo, {
          centro: contextoCentro,
          almacen: contextoAlmacen,
        })
        const data = res.data || {}
        setDetailCache((prev) => ({ ...prev, [codigo]: data }))
        if (showModal) {
          setDetail(data)
          setShowDetailModal(true)
          setDetailViewed(true)
        }
        return data
      } catch (err) {
        console.error('detalle material', err)
        if (showModal) setDetail(null)
        return null
      } finally {
        setLoadingDetail(false)
      }
    },
    [contextoCentro, contextoAlmacen]
  )

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
        setSelectedMaterial(mat)
        setDropdownOpen(false)
        setHighlightedIndex(-1)
        setSearchCodigo(mat.codigo)
        setSearchDesc(mat.descripcion)
        setDetail(null)
        setShowStockFull(false)
        loadDetail(mat.codigo, false).then((detailData) => {
          if (detailData) {
            setDetail(detailData)
            setDetailViewed(true)
          }
        })
      } else if (results.length > 0) {
        setDropdownOpen(true)
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false)
      setHighlightedIndex(-1)
    }
  }, [results, highlightedIndex, loadDetail])

  const handleSelect = useCallback(
    async (mat) => {
      setSelectedMaterial(mat)
      setDropdownOpen(false)
      setHighlightedIndex(-1)
      setSearchCodigo('')
      setSearchDesc('')
      setResults([])
      setDetail(null)
      setShowStockFull(false)
      const detailData = await loadDetail(mat.codigo, false)
      if (detailData) {
        setDetail(detailData)
        setDetailViewed(true)
      }
    },
    [loadDetail]
  )

  const handleAdd = useCallback(async () => {
    if (!selectedMaterial) return

    if (!detailCache[selectedMaterial.codigo]) {
      await loadDetail(selectedMaterial.codigo, false)
    }

    const exists = items.find((it) => it.codigo === selectedMaterial.codigo)
    const nextItems = exists
      ? items.map((it) =>
          it.codigo === selectedMaterial.codigo
            ? { ...it, cantidad: (it.cantidad || 1) + 1 }
            : it
        )
      : [
          ...items,
          {
            codigo: selectedMaterial.codigo,
            descripcion: selectedMaterial.descripcion,
            descripcion_larga: selectedMaterial.descripcion_larga,
            unidad: selectedMaterial.unidad_medida || selectedMaterial.unidad || 'UNI',
            cantidad: 1,
            precio_unitario: selectedMaterial.precio_usd || 0,
          },
        ]

    setItems(nextItems)
    setActionMsg(t('materials_added', 'Material agregado al listado.'))
    setSelectedMaterial(null)
    setDetailViewed(false)
    setDetail(null)
  }, [selectedMaterial, detailCache, items, loadDetail, t])

  const handleQtyChange = useCallback((codigo, value) => {
    const qty = Number(value)
    if (Number.isNaN(qty) || qty < 1) return
    setItems((prev) =>
      prev.map((it) => (it.codigo === codigo ? { ...it, cantidad: qty } : it))
    )
  }, [])

  const handleDelete = useCallback((codigo) => {
    setItems((prev) => prev.filter((it) => it.codigo !== codigo))
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchCodigo('')
    setSearchDesc('')
    setResults([])
    setDropdownOpen(false)
    setHighlightedIndex(-1)
    setSelectedMaterial(null)
  }, [])

  const handleOpenComment = useCallback((codigo) => {
    const item = items.find((it) => it.codigo === codigo)
    setCommentModal({
      open: true,
      codigo,
      comment: item?.comentario || ''
    })
  }, [items])

  const handleSaveComment = useCallback(() => {
    setItems((prev) =>
      prev.map((it) =>
        it.codigo === commentModal.codigo
          ? { ...it, comentario: commentModal.comment }
          : it
      )
    )
    setCommentModal({ open: false, codigo: null, comment: '' })
  }, [commentModal])

  const handleSaveDraft = useCallback(async () => {
    setActionMsg('')
    setError('')
    setSavingDraft(true)
    try {
      const res = await solicitudes.guardarBorrador(id, items, total)
      setSol(res.data.solicitud || res.data)
      setLastSavedItems([...items])
      setActionMsg(t('materials_draft_saved', 'Borrador guardado.'))
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message)
    } finally {
      setSavingDraft(false)
    }
  }, [id, items, total, t])

  const handleFinalizar = useCallback(() => {
    setError('')
    if (!items.length) {
      setError(t('materials_add_at_least_one', 'Agrega al menos un ítem'))
      return
    }
    setShowSubmitModal(true)
  }, [items.length, t])

  const confirmFinalizar = useCallback(async () => {
    setShowSubmitModal(false)
    setActionMsg('')
    setError('')
    setSubmitting(true)

    try {
      const res = await solicitudes.finalizar(id, {
        ...(sol || {}),
        items,
        total_monto: total,
      })
      setSol(res.data.solicitud || res.data)
      setActionMsg(t('materials_submitted', 'Solicitud enviada para aprobación. Redirigiendo...'))
      setTimeout(() => navigate('/mis-solicitudes'), 4000)
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message)
    } finally {
      setSubmitting(false)
    }
  }, [id, items, sol, total, t, navigate])

  const handleCancelar = useCallback(() => {
    setShowCancelModal(true)
  }, [])

  const confirmCancelar = useCallback(async () => {
    setShowCancelModal(false)
    setError('')
    try {
      await solicitudes.eliminar(id)
      setItems([])
      setSelectedMaterial(null)
      setSearchCodigo('')
      setSearchDesc('')
      setActionMsg(t('materials_cancelar_success', 'Solicitud cancelada. Redirigiendo...'))
      setTimeout(() => navigate('/mis-solicitudes'), 1500)
    } catch (err) {
      setItems([])
      setSelectedMaterial(null)
      setSearchCodigo('')
      setSearchDesc('')
      setActionMsg(t('materials_cancelar_local', 'Datos locales limpiados.'))
    }
  }, [id, t, navigate])

  const handleAddSuggestedItems = useCallback((suggestedItems) => {
    if (!Array.isArray(suggestedItems) || suggestedItems.length === 0) return

    setItems((prev) => {
      const existingCodes = new Set(prev.map((it) => it.codigo))
      const newItems = suggestedItems.filter((it) => !existingCodes.has(it.codigo || it.codigo_sap))

      if (newItems.length > 0) {
        setActionMsg(t('materials_suggestions_loaded', `${newItems.length} material(es) sugeridos agregados`))
        return [...prev, ...newItems.map((it) => ({
          codigo: it.codigo || it.codigo_sap,
          descripcion: it.descripcion,
          descripcion_larga: it.descripcion_larga,
          unidad: it.unidad || 'UNI',
          cantidad: it.cantidad || 1,
          precio_unitario: it.precio_unitario || 0,
        }))]
      }

      setActionMsg(t('materials_suggestions_duplicates', 'Los materiales ya existen en el listado'))
      return prev
    })

    setShowAssistant(false)
  }, [t])

  const openDetailModal = useCallback(async () => {
    if (!selectedMaterial) return
    await loadDetail(selectedMaterial.codigo, true)
  }, [selectedMaterial, loadDetail])

  const closeDetailModal = useCallback(() => {
    setShowDetailModal(false)
  }, [])

  const closeCommentModal = useCallback(() => {
    setCommentModal({ open: false, codigo: null, comment: '' })
  }, [])

  const updateCommentText = useCallback((text) => {
    setCommentModal((prev) => ({ ...prev, comment: text }))
  }, [])

  return {
    // Identifiers
    id,

    // State
    sol,
    items,
    loading,
    error,
    actionMsg,
    searchCodigo,
    searchDesc,
    debouncedCodigo,
    debouncedDesc,
    results,
    loadingSearch,
    dropdownOpen,
    highlightedIndex,
    dropdownPosition,
    selectedMaterial,
    showDetailModal,
    detail,
    loadingDetail,
    detailViewed,
    showStockFull,
    showCancelModal,
    showSubmitModal,
    showAssistant,
    commentModal,
    submitting,
    savingDraft,
    presupuesto,

    // Refs
    dropdownRef,
    searchContainerRef,

    // Computed
    contextoCentro,
    contextoAlmacen,
    hasUnsavedChanges,
    total,
    presupuestoInsuf,
    itemsSorted,

    setSearchCodigo,
    setSearchDesc,
    setDropdownOpen,
    setHighlightedIndex,
    setShowStockFull,
    setShowCancelModal,
    setShowSubmitModal,
    setShowAssistant,
    setError,
    setActionMsg,

    // Handlers
    loadDetail,
    handleSearchKeyDown,
    handleSelect,
    handleAdd,
    handleQtyChange,
    handleDelete,
    handleClearSearch,
    handleOpenComment,
    handleSaveComment,
    handleSaveDraft,
    handleFinalizar,
    confirmFinalizar,
    handleCancelar,
    confirmCancelar,
    handleAddSuggestedItems,
    openDetailModal,
    closeDetailModal,
    closeCommentModal,
    updateCommentText,
  }
}
