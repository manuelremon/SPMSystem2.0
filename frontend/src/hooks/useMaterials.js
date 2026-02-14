/**
 * useMaterials - Custom hook for Materials page state management
 *
 * Composes three focused sub-hooks:
 * - useMaterialForm: Solicitud loading, draft/submit/cancel, budget
 * - useMaterialCart: Item list, quantities, comments, suggestions
 * - useMaterialSearch: Search with debouncing, dropdown, keyboard nav
 *
 * Detail/selection state lives here as the glue between search and cart.
 * The return value is identical to the original monolithic version so that
 * consuming components (Materials.jsx) require zero changes.
 */
import { useState, useCallback, useRef } from 'react'
import { materiales } from '../services/spm'
import { useMaterialForm } from './useMaterialForm'
import { useMaterialCart } from './useMaterialCart'
import { useMaterialSearch } from './useMaterialSearch'

export function useMaterials() {
  // Detail / selection state (shared between search and cart)
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailCache, setDetailCache] = useState({})
  const [detailViewed, setDetailViewed] = useState(false)
  const [showStockFull, setShowStockFull] = useState(false)

  // Ref bridge: form handlers read cart state lazily through this ref,
  // avoiding the TDZ issue of cart not yet being declared when form initializes.
  const cartRef = useRef({ items: [], total: 0, markAsSaved: () => {}, clearCart: () => {} })

  // Form hook (sol, loading, error, actionMsg, presupuesto, modals, submit/cancel)
  const form = useMaterialForm({ cartRef })

  // Cart hook (items, quantities, comments, suggestions)
  const cart = useMaterialCart({
    initialItems: form.initialItems,
    setActionMsg: form.setActionMsg,
    setShowAssistant: form.setShowAssistant,
  })

  // Keep the ref in sync with the latest cart state every render
  cartRef.current = {
    items: cart.items,
    total: cart.total,
    markAsSaved: cart.markAsSaved,
    clearCart: cart.clearCart,
  }

  // Computed: budget insufficient (needs both presupuesto from form and total from cart)
  const presupuestoInsuf = form.presupuesto && cart.total > (form.presupuesto.saldo_usd ?? 0)

  // Detail loading (uses form's contextoCentro/contextoAlmacen)
  const loadDetail = useCallback(
    async (codigo, showModal = false) => {
      setLoadingDetail(true)
      try {
        const res = await materiales.detalle(codigo, {
          centro: form.contextoCentro,
          almacen: form.contextoAlmacen,
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
    [form.contextoCentro, form.contextoAlmacen]
  )

  // Search hook (onSelect wires detail state)
  const handleMaterialSelected = useCallback(
    async (mat) => {
      setSelectedMaterial(mat)
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

  const search = useMaterialSearch({ onSelect: handleMaterialSelected })

  // Cross-cutting handlers
  const handleAdd = useCallback(async () => {
    if (!selectedMaterial) return
    await cart.handleAdd(selectedMaterial, detailCache, loadDetail)
    setSelectedMaterial(null)
    setDetailViewed(false)
    setDetail(null)
  }, [selectedMaterial, detailCache, loadDetail, cart.handleAdd])

  const handleClearSearch = useCallback(() => {
    search.handleClearSearch()
    setSelectedMaterial(null)
  }, [search.handleClearSearch])

  // Wrap confirmCancelar to also reset selection and search state
  const confirmCancelar = useCallback(async () => {
    await form.confirmCancelar()
    setSelectedMaterial(null)
    search.handleClearSearch()
  }, [form.confirmCancelar, search.handleClearSearch])

  const openDetailModal = useCallback(async () => {
    if (!selectedMaterial) return
    await loadDetail(selectedMaterial.codigo, true)
  }, [selectedMaterial, loadDetail])

  const closeDetailModal = useCallback(() => {
    setShowDetailModal(false)
  }, [])

  // Return identical API to the original monolithic hook
  return {
    id: form.id,
    sol: form.sol,
    items: cart.items,
    loading: form.loading,
    error: form.error,
    actionMsg: form.actionMsg,
    searchCodigo: search.searchCodigo,
    searchDesc: search.searchDesc,
    debouncedCodigo: search.debouncedCodigo,
    debouncedDesc: search.debouncedDesc,
    results: search.results,
    loadingSearch: search.loadingSearch,
    dropdownOpen: search.dropdownOpen,
    highlightedIndex: search.highlightedIndex,
    dropdownPosition: search.dropdownPosition,
    selectedMaterial,
    showDetailModal,
    detail,
    loadingDetail,
    detailViewed,
    showStockFull,
    showCancelModal: form.showCancelModal,
    showSubmitModal: form.showSubmitModal,
    showAssistant: form.showAssistant,
    commentModal: cart.commentModal,
    submitting: form.submitting,
    savingDraft: form.savingDraft,
    presupuesto: form.presupuesto,
    dropdownRef: search.dropdownRef,
    searchContainerRef: search.searchContainerRef,
    contextoCentro: form.contextoCentro,
    contextoAlmacen: form.contextoAlmacen,
    hasUnsavedChanges: cart.hasUnsavedChanges,
    total: cart.total,
    presupuestoInsuf,
    itemsSorted: cart.itemsSorted,
    setSearchCodigo: search.setSearchCodigo,
    setSearchDesc: search.setSearchDesc,
    setDropdownOpen: search.setDropdownOpen,
    setHighlightedIndex: search.setHighlightedIndex,
    setShowStockFull,
    setShowCancelModal: form.setShowCancelModal,
    setShowSubmitModal: form.setShowSubmitModal,
    setShowAssistant: form.setShowAssistant,
    setError: form.setError,
    setActionMsg: form.setActionMsg,
    loadDetail,
    handleSearchKeyDown: search.handleSearchKeyDown,
    handleSelect: search.handleSelect,
    handleAdd,
    handleQtyChange: cart.handleQtyChange,
    handleDelete: cart.handleDelete,
    handleClearSearch,
    handleOpenComment: cart.handleOpenComment,
    handleSaveComment: cart.handleSaveComment,
    handleSaveDraft: form.handleSaveDraft,
    handleFinalizar: form.handleFinalizar,
    confirmFinalizar: form.confirmFinalizar,
    handleCancelar: form.handleCancelar,
    confirmCancelar,
    handleAddSuggestedItems: cart.handleAddSuggestedItems,
    openDetailModal,
    closeDetailModal,
    closeCommentModal: cart.closeCommentModal,
    updateCommentText: cart.updateCommentText,
  }
}
