/**
 * useMaterialForm - Solicitud form state management
 *
 * Manages solicitud loading, budget validation, draft saving,
 * submission (finalizar), and cancellation.
 *
 * Cart state (items, total) is accessed through a ref so that this hook
 * can be initialized before the cart hook without TDZ issues.
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { solicitudes } from '../services/spm'
import api from '../services/api'
import { useI18n } from '../context/i18n'

const AUTO_DISMISS_MS = 3000

/**
 * @param {Object} params
 * @param {React.MutableRefObject} params.cartRef - Ref to cart API { items, total, markAsSaved, clearCart }
 */
export function useMaterialForm({ cartRef }) {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()

  const [sol, setSol] = useState(null)
  const [initialItems, setInitialItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [presupuesto, setPresupuesto] = useState(null)

  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false)

  // Loading states for operations
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  // Computed from solicitud
  const contextoCentro = useMemo(
    () => sol?.centro || localStorage.getItem('lastCentro') || '',
    [sol]
  )

  const contextoAlmacen = useMemo(
    () => sol?.almacen_virtual || sol?.almacen || localStorage.getItem('lastAlmacen') || '',
    [sol]
  )

  // Load solicitud on mount
  useEffect(() => {
    if (!id) return

    setLoading(true)
    solicitudes
      .obtener(id)
      .then((res) => {
        const data = res.data.solicitud || res.data
        setSol(data)
        const loadedItems = Array.isArray(data?.items) ? data.items : []
        setInitialItems(loadedItems)
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

  // Auto-dismiss action messages
  useEffect(() => {
    if (actionMsg) {
      const timer = setTimeout(() => setActionMsg(''), AUTO_DISMISS_MS)
      return () => clearTimeout(timer)
    }
  }, [actionMsg])

  const handleSaveDraft = useCallback(async () => {
    setActionMsg('')
    setError('')
    setSavingDraft(true)
    try {
      const { items, total, markAsSaved } = cartRef.current
      const res = await solicitudes.guardarBorrador(id, items, total)
      setSol(res.data.solicitud || res.data)
      markAsSaved()
      setActionMsg(t('materials_draft_saved', 'Borrador guardado.'))
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message)
    } finally {
      setSavingDraft(false)
    }
  }, [id, t, cartRef])

  const handleFinalizar = useCallback(() => {
    setError('')
    const { items } = cartRef.current
    if (!items.length) {
      setError(t('materials_add_at_least_one', 'Agrega al menos un ítem'))
      return
    }
    setShowSubmitModal(true)
  }, [t, cartRef])

  const confirmFinalizar = useCallback(async () => {
    setShowSubmitModal(false)
    setActionMsg('')
    setError('')
    setSubmitting(true)

    try {
      const { items, total } = cartRef.current
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
  }, [id, sol, t, navigate, cartRef])

  const handleCancelar = useCallback(() => {
    setShowCancelModal(true)
  }, [])

  const confirmCancelar = useCallback(async () => {
    setShowCancelModal(false)
    setError('')
    try {
      await solicitudes.eliminar(id)
      cartRef.current.clearCart()
      setActionMsg(t('materials_cancelar_success', 'Solicitud cancelada. Redirigiendo...'))
      setTimeout(() => navigate('/mis-solicitudes'), 1500)
    } catch (_err) {
      cartRef.current.clearCart()
      setActionMsg(t('materials_cancelar_local', 'Datos locales limpiados.'))
    }
  }, [id, t, navigate, cartRef])

  return {
    id,
    sol,
    initialItems,
    loading,
    error,
    actionMsg,
    presupuesto,
    showCancelModal,
    showSubmitModal,
    showAssistant,
    submitting,
    savingDraft,
    contextoCentro,
    contextoAlmacen,
    setError,
    setActionMsg,
    setShowCancelModal,
    setShowSubmitModal,
    setShowAssistant,
    handleSaveDraft,
    handleFinalizar,
    confirmFinalizar,
    handleCancelar,
    confirmCancelar,
  }
}
