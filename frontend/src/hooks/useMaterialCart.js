/**
 * useMaterialCart - Cart/selection management for materials
 *
 * Manages the list of items in a solicitud, including add, remove,
 * quantity changes, comments, and suggested items from the assistant.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useI18n } from '../context/i18n'

function normalizarSugerido(it) {
  return {
    codigo: it.codigo || it.codigo_sap,
    descripcion: it.descripcion,
    descripcion_larga: it.descripcion_larga,
    unidad: it.unidad || 'UNI',
    cantidad: it.cantidad || 1,
    precio_unitario: it.precio_unitario || 0,
  }
}

/**
 * @param {Object} params
 * @param {Array} params.initialItems - Initial items loaded from solicitud
 * @param {Function} params.setActionMsg - Setter for the action message displayed to user
 * @param {Function} params.setShowAssistant - Setter to toggle the assistant modal
 */
export function useMaterialCart({ initialItems, setActionMsg, setShowAssistant }) {
  const { t } = useI18n()
  const [items, setItems] = useState([])
  const [lastSavedItems, setLastSavedItems] = useState([])
  const [commentModal, setCommentModal] = useState({ open: false, codigo: null, comment: '' })
  // Sobrevive a recargas de initialItems (p. ej. doble efecto de useMaterialForm en
  // StrictMode) para que los sugeridos del asistente no se pierdan si initialItems
  // cambia de instancia despues de haberlos mezclado una vez.
  const pendingSuggestedRef = useRef([])
  const mensajeSugeridosMostradoRef = useRef(false)

  // Sync cuando se cargan/recargan los items iniciales de la solicitud, mezclando
  // cualquier sugerido pendiente del asistente conversacional (sessionStorage).
  useEffect(() => {
    if (initialItems === null) return

    if (pendingSuggestedRef.current.length === 0) {
      const suggestedJson = sessionStorage.getItem('suggested_items')
      if (suggestedJson) {
        try {
          const suggestedItems = JSON.parse(suggestedJson)
          if (Array.isArray(suggestedItems) && suggestedItems.length > 0) {
            pendingSuggestedRef.current = suggestedItems.map(normalizarSugerido)
          }
        } catch (err) {
          // Ignorar: items sugeridos malformados en sessionStorage no deben romper la carga
          console.debug('[useMaterialCart] suggested_items invalido:', err)
        } finally {
          sessionStorage.removeItem('suggested_items')
        }
      }
    }

    const existingCodes = new Set(initialItems.map((it) => it.codigo))
    const newItems = pendingSuggestedRef.current.filter((it) => !existingCodes.has(it.codigo))

    setItems([...initialItems, ...newItems])
    setLastSavedItems(initialItems)

    if (newItems.length > 0 && !mensajeSugeridosMostradoRef.current) {
      mensajeSugeridosMostradoRef.current = true
      setActionMsg(`${newItems.length} ${t('materials_suggestions_loaded', 'material(es) sugeridos agregados')}`)
    }
  }, [initialItems, t, setActionMsg])

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(items) !== JSON.stringify(lastSavedItems)
  }, [items, lastSavedItems])

  const total = useMemo(
    () => items.reduce((sum, it) => sum + (it.cantidad || 0) * (it.precio_unitario || 0), 0),
    [items]
  )

  const itemsSorted = useMemo(
    () => [...items].sort((a, b) => String(b.codigo).localeCompare(String(a.codigo))),
    [items]
  )

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

  const closeCommentModal = useCallback(() => {
    setCommentModal({ open: false, codigo: null, comment: '' })
  }, [])

  const updateCommentText = useCallback((text) => {
    setCommentModal((prev) => ({ ...prev, comment: text }))
  }, [])

  /**
   * Add a material to the cart. If it already exists, increment quantity.
   * @param {Object} material - The selected material object
   * @param {Object} detailCache - Cache of material details (for pre-fetching)
   * @param {Function} loadDetail - Function to load material details
   */
  const handleAdd = useCallback(async (material, detailCache, loadDetail) => {
    if (!material) return

    if (!detailCache[material.codigo]) {
      await loadDetail(material.codigo, false)
    }

    const exists = items.find((it) => it.codigo === material.codigo)
    const nextItems = exists
      ? items.map((it) =>
          it.codigo === material.codigo
            ? { ...it, cantidad: (it.cantidad || 1) + 1 }
            : it
        )
      : [
          ...items,
          {
            codigo: material.codigo,
            descripcion: material.descripcion,
            descripcion_larga: material.descripcion_larga,
            unidad: material.unidad_medida || material.unidad || 'UNI',
            cantidad: 1,
            precio_unitario: material.precio_usd || 0,
          },
        ]

    setItems(nextItems)
    setActionMsg(t('materials_added', 'Material agregado al listado.'))
  }, [items, t, setActionMsg])

  const handleAddSuggestedItems = useCallback((suggestedItems) => {
    if (!Array.isArray(suggestedItems) || suggestedItems.length === 0) return

    setItems((prev) => {
      const existingCodes = new Set(prev.map((it) => it.codigo))
      const newItems = suggestedItems.filter((it) => !existingCodes.has(it.codigo || it.codigo_sap))

      if (newItems.length > 0) {
        setActionMsg(`${newItems.length} ${t('materials_suggestions_loaded', 'material(es) sugeridos agregados')}`)
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
  }, [t, setActionMsg, setShowAssistant])

  /** Mark current items as saved (called after successful draft save) */
  const markAsSaved = useCallback(() => {
    setLastSavedItems([...items])
  }, [items])

  /** Reset items and clear cart (used on cancel) */
  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  return {
    items,
    setItems,
    hasUnsavedChanges,
    total,
    itemsSorted,
    commentModal,
    handleQtyChange,
    handleDelete,
    handleOpenComment,
    handleSaveComment,
    closeCommentModal,
    updateCommentText,
    handleAdd,
    handleAddSuggestedItems,
    markAsSaved,
    clearCart,
  }
}
