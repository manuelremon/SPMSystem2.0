import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { materiales, solicitudes } from '../services/spm'
import api from '../services/api'
import { formatCurrency } from '../utils/formatters'
import { useI18n } from '../context/i18n'
import { renderSector } from '../constants/sectores'

// UI Components
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card'
import { Alert } from '../components/ui/Alert'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { MessageSquare, Search, X, Loader2, Check, Trash2 } from 'lucide-react'

const DEBOUNCE_MS = 250
const MAX_RESULTS = 500
const AUTO_DISMISS_MS = 3000

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debounced
}

export default function Materials() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()

  // Estado principal
  const [sol, setSol] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')

  // Búsqueda
  const [searchCodigo, setSearchCodigo] = useState('')
  const [searchDesc, setSearchDesc] = useState('')
  const debouncedCodigo = useDebouncedValue(searchCodigo, DEBOUNCE_MS)
  const debouncedDesc = useDebouncedValue(searchDesc, DEBOUNCE_MS)
  const [results, setResults] = useState([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

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

  // Loading states para operaciones
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  // Ref para cerrar dropdown al hacer clic afuera y navegación con teclado
  const dropdownRef = useRef(null)
  const searchContainerRef = useRef(null)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  // Tracking de cambios sin guardar
  const [lastSavedItems, setLastSavedItems] = useState([])
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(items) !== JSON.stringify(lastSavedItems)
  }, [items, lastSavedItems])

  // Modal de comentario por item
  const [commentModal, setCommentModal] = useState({ open: false, codigo: null, comment: '' })

  // Presupuesto
  const [presupuesto, setPresupuesto] = useState(null)

  // Contexto de centro/almacén
  const contextoCentro = useMemo(
    () => sol?.centro || localStorage.getItem('lastCentro') || '',
    [sol]
  )
  const contextoAlmacen = useMemo(
    () => sol?.almacen_virtual || sol?.almacen || localStorage.getItem('lastAlmacen') || '',
    [sol]
  )

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
        setResults((res.data || []).slice(0, MAX_RESULTS))
        setDropdownOpen(true)
      })
      .catch((err) => {
        console.error('search materiales', err)
        setResults([])
        setDropdownOpen(false)
      })
      .finally(() => setLoadingSearch(false))
  }, [debouncedCodigo, debouncedDesc])

  // Cargar detalle de material (definido antes de handleSearchKeyDown para evitar TDZ)
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

  // Handler: Navegación con teclado en inputs de búsqueda
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
        // Seleccionar material resaltado
        const mat = results[highlightedIndex]
        setSelectedMaterial(mat)
        setDropdownOpen(false)
        setHighlightedIndex(-1)
        setSearchCodigo(mat.codigo)
        setSearchDesc(mat.descripcion)
        setDetail(null)
        setShowStockFull(false)
        // Auto-cargar detalles
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

  // Handler: Seleccionar material de la lista (auto-carga detalles)
  const handleSelect = useCallback(
    async (mat) => {
      setSelectedMaterial(mat)
      setDropdownOpen(false)
      setHighlightedIndex(-1)
      // Limpiar campos de búsqueda después de seleccionar
      setSearchCodigo('')
      setSearchDesc('')
      setResults([])
      setDetail(null)
      setShowStockFull(false)
      // Auto-cargar detalles y marcar como visto
      const detailData = await loadDetail(mat.codigo, false)
      if (detailData) {
        setDetail(detailData)
        setDetailViewed(true)
      }
    },
    [loadDetail]
  )

  // Handler: Agregar material al listado
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
            unidad: selectedMaterial.unidad || 'UNI',
            cantidad: 1,
            precio_unitario: selectedMaterial.precio_usd || 0,
          },
        ]

    setItems(nextItems)
    setActionMsg(t('materials_added', 'Material agregado al listado.'))
    // Limpiar selección para indicar que está listo para otra búsqueda
    setSelectedMaterial(null)
    setDetailViewed(false)
    setDetail(null)
  }, [selectedMaterial, detailCache, items, loadDetail, t])

  // Handler: Cambiar cantidad
  const handleQtyChange = useCallback((codigo, value) => {
    const qty = Number(value)
    if (Number.isNaN(qty) || qty < 1) return
    setItems((prev) =>
      prev.map((it) => (it.codigo === codigo ? { ...it, cantidad: qty } : it))
    )
  }, [])

  // Handler: Eliminar material
  const handleDelete = useCallback((codigo) => {
    setItems((prev) => prev.filter((it) => it.codigo !== codigo))
  }, [])

  // Handler: Limpiar búsqueda
  const handleClearSearch = useCallback(() => {
    setSearchCodigo('')
    setSearchDesc('')
    setResults([])
    setDropdownOpen(false)
    setHighlightedIndex(-1)
    setSelectedMaterial(null)
  }, [])

  // Handler: Abrir modal de comentario
  const handleOpenComment = useCallback((codigo) => {
    const item = items.find((it) => it.codigo === codigo)
    setCommentModal({
      open: true,
      codigo,
      comment: item?.comentario || ''
    })
  }, [items])

  // Handler: Guardar comentario
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

  // Calcular total (debe estar antes de handleSaveDraft y confirmFinalizar que lo usan)
  const total = useMemo(
    () => items.reduce((sum, it) => sum + (it.cantidad || 0) * (it.precio_unitario || 0), 0),
    [items]
  )

  // Handler: Guardar borrador
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

  // Handler: Abrir modal de confirmación para enviar
  const handleFinalizar = useCallback(() => {
    setError('')
    if (!items.length) {
      setError(t('materials_add_at_least_one', 'Agrega al menos un ítem'))
      return
    }
    setShowSubmitModal(true)
  }, [items.length, t])

  // Handler: Confirmar envío de solicitud
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

      // Redirigir a Mis Solicitudes después de 1.5 segundos
      setTimeout(() => {
        navigate('/mis-solicitudes')
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message)
    } finally {
      setSubmitting(false)
    }
  }, [id, items, sol, total, t, navigate])

  // Handler: Cancelar solicitud
  const handleCancelar = useCallback(() => {
    setShowCancelModal(true)
  }, [])

  const confirmCancelar = useCallback(async () => {
    setShowCancelModal(false)
    setError('')
    try {
      // Intentar eliminar del backend
      await solicitudes.eliminar(id)
      setItems([])
      setSelectedMaterial(null)
      setSearchCodigo('')
      setSearchDesc('')
      setActionMsg(t('materials_cancelar_success', 'Solicitud cancelada. Redirigiendo...'))
      setTimeout(() => navigate('/mis-solicitudes'), 1500)
    } catch (err) {
      // Si falla (ej: ya fue enviada), solo limpiar localmente
      setItems([])
      setSelectedMaterial(null)
      setSearchCodigo('')
      setSearchDesc('')
      setActionMsg(t('materials_cancelar_local', 'Datos locales limpiados.'))
    }
  }, [id, t, navigate])

  // Verificar si el presupuesto es insuficiente
  const presupuestoInsuf = presupuesto && total > (presupuesto.saldo_usd ?? 0)

  // Items ordenados
  const itemsSorted = useMemo(
    () => [...items].sort((a, b) => String(b.codigo).localeCompare(String(a.codigo))),
    [items]
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('materials_title', 'Agregar Materiales')}
        />
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton rows={5} columns={6} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('materials_title', 'Agregar Materiales')}
        subtitle={hasUnsavedChanges ? <Badge variant="warning">{t('common_sin_guardar', 'Sin guardar')}</Badge> : null}
        actions={
          <Button
            as={Link}
            to="/mis-solicitudes"
            variant="ghost"
            aria-label={t('common_volver_mis_solicitudes', 'Volver a Mis Solicitudes')}
          >
            {t('common_volver', 'Volver')}
          </Button>
        }
      />

      {/* Mensajes de error y acción */}
      {error && (
        <Alert variant="danger" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      {actionMsg && (
        <Alert variant="success" onDismiss={() => setActionMsg('')}>
          {actionMsg}
        </Alert>
      )}

      {/* Sección de búsqueda y contexto */}
      <Card hover={false}>
        <CardContent className="pt-6 space-y-4">
          {/* Layout de 3 columnas: Búsqueda | Material seleccionado | Info contextual */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna izquierda: Búsqueda */}
            <div ref={searchContainerRef} className="space-y-3">
              <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide">
                {t('materials_buscar', 'Buscar material')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Código SAP */}
                <div className="relative w-full sm:w-36 shrink-0">
                  <Input
                    id="searchCodigo"
                    value={searchCodigo}
                    onChange={(e) => setSearchCodigo(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={t('materials_codigo_sap', 'Código SAP')}
                    className="font-mono"
                    aria-label={t('materials_codigo_sap', 'Código SAP')}
                  />
                </div>
                {/* Descripción */}
                <div className="relative flex-1 sm:max-w-sm">
                  <div className="relative">
                    <Input
                      id="searchDesc"
                      value={searchDesc}
                      onChange={(e) => setSearchDesc(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder={t('materials_buscar_desc', 'Buscar por descripción...')}
                      aria-label={t('materials_descripcion', 'Descripción')}
                    />
                    {/* Indicadores dentro del input */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {loadingSearch && (
                        <Loader2 className="h-4 w-4 animate-spin text-[var(--fg-muted)]" />
                      )}
                      {!loadingSearch && results.length > 0 && (
                        <span className="text-xs text-[var(--fg-muted)] bg-[var(--bg-soft)] px-1.5 py-0.5 rounded">
                          {results.length}
                        </span>
                      )}
                      {(searchCodigo || searchDesc) && (
                        <button
                          type="button"
                          onClick={handleClearSearch}
                          className="p-0.5 hover:bg-[var(--bg-elevated)] rounded transition-colors"
                          aria-label={t('materials_limpiar_busqueda', 'Limpiar búsqueda')}
                        >
                          <X className="h-4 w-4 text-[var(--fg-muted)]" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {/* Indicador de resultados */}
              {(searchCodigo || searchDesc) && !loadingSearch && results.length > 0 && (
                <p className="text-xs text-[var(--fg-muted)]">
                  {results.length} {results.length === 1 ? t('common_resultado', 'resultado') : t('common_resultados', 'resultados')}
                  <span className="opacity-60"> — {t('materials_selecciona_uno', 'selecciona uno')}</span>
                </p>
              )}
            </div>

            {/* Columna central: Material seleccionado */}
            <div className="flex flex-col">
              <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-3">
                {t('materials_selected', 'Material seleccionado')}
              </p>
              {selectedMaterial ? (
                <div className="p-3 bg-[var(--bg-soft)] border border-[var(--primary)]/30 rounded-lg flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {detailViewed && <Check className="h-4 w-4 text-[var(--success)]" />}
                    <span className="font-mono text-sm text-[var(--primary)] font-medium">
                      {selectedMaterial.codigo}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--fg-strong)] font-medium mb-1 line-clamp-2">
                    {selectedMaterial.descripcion}
                  </p>
                  {selectedMaterial.precio_usd > 0 && (
                    <p className="text-sm text-[var(--fg-muted)]">
                      {t('materials_precio', 'Precio')}: <span className="font-mono font-medium">{formatCurrency(selectedMaterial.precio_usd)}</span>
                    </p>
                  )}
                  {!detailViewed && (
                    <p className="text-xs text-[var(--warning)] mt-2 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 bg-[var(--warning)] rounded-full"></span>
                      {t('materials_view_detail_first', 'Ver detalles antes de agregar')}
                    </p>
                  )}
                  {/* Acciones */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={async () => {
                        if (!selectedMaterial) return
                        await loadDetail(selectedMaterial.codigo, true)
                      }}
                      disabled={loadingDetail}
                    >
                      {loadingDetail ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t('materials_mas_detalles', 'Ver detalles')
                      )}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleAdd}
                      disabled={!detailViewed}
                    >
                      {t('materials_agregar', 'Agregar')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-dashed border-[var(--border)] rounded-lg flex-1 flex items-center justify-center">
                  <p className="text-sm text-[var(--fg-muted)] text-center">
                    {t('materials_busca_selecciona', 'Busca y selecciona un material')}
                  </p>
                </div>
              )}
            </div>

            {/* Columna derecha: Info contextual */}
            <div>
              <p className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-3">
                {t('materials_contexto', 'Contexto')}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="text-[var(--fg-muted)]">{t('common_solicitud', 'Solicitud')}</span>
                  <p className="font-semibold text-[var(--fg-strong)]">#{id}</p>
                </div>
                <div>
                  <span className="text-[var(--fg-muted)]">{t('common_centro', 'Centro')}</span>
                  <p className="font-semibold text-[var(--fg-strong)]">{sol?.centro || '—'}</p>
                </div>
                <div>
                  <span className="text-[var(--fg-muted)]">{t('common_sector', 'Sector')}</span>
                  <p className="font-semibold text-[var(--fg-strong)]">{renderSector(sol) || '—'}</p>
                </div>
                <div>
                  <span className="text-[var(--fg-muted)]">{t('common_almacen', 'Almacén')}</span>
                  <p className="font-semibold text-[var(--fg-strong)]">{sol?.almacen_virtual || '—'}</p>
                </div>
                <div className="col-span-2 pt-2 mt-2 border-t border-[var(--border)]">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[var(--fg-muted)]">{t('common_total', 'Total')}</span>
                      <p className="font-bold text-lg text-[var(--fg-strong)] font-mono">{formatCurrency(total)}</p>
                    </div>
                    {presupuesto && (
                      <div className="text-right">
                        <span className="text-[var(--fg-muted)]">{t('materials_saldo_disponible', 'Saldo disponible')}</span>
                        <p className={`font-semibold font-mono ${presupuestoInsuf ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                          {formatCurrency(presupuesto.saldo_usd || 0)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sección de resumen de materiales */}
      <Card hover={false}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle>{t('materials_resumen', 'Resumen de Materiales')}</CardTitle>
            {items.length > 0 && (
              <Badge variant="primary">{items.length} {items.length === 1 ? t('common_item', 'item') : t('common_items', 'items')}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Tabla de materiales */}
          <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                    {t('materials_col_codigo', 'Código')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                    {t('materials_col_descripcion', 'Descripción')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                    {t('materials_col_unidad', 'Unidad')}
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] w-20">
                    {t('materials_col_cantidad', 'Cant.')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                    {t('materials_col_precio', 'Precio USD')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                    {t('materials_col_subtotal', 'Subtotal')}
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] w-12">
                    {t('materials_col_nota', 'Nota')}
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] w-12">
                  </th>
                </tr>
              </thead>
              <tbody>
                {itemsSorted.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-[var(--fg-muted)]"
                      colSpan={8}
                    >
                      {t('materials_sin_materiales', 'Sin materiales agregados')}
                    </td>
                  </tr>
                )}
                {itemsSorted.map((it, idx) => {
                  const subtotal = (it.cantidad || 0) * (it.precio_unitario || 0)

                  return (
                    <tr
                      key={it.codigo}
                      className={`
                        border-b border-[var(--border)] transition-colors
                        ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[var(--bg-soft)]/30'}
                        hover:bg-[var(--bg-elevated)]
                      `}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-[var(--fg-strong)]">
                        {it.codigo}
                      </td>
                      <td className="px-4 py-3 text-[var(--fg)]">{it.descripcion}</td>
                      <td className="px-4 py-3 text-center text-[var(--fg-muted)]">
                        {it.unidad || '-'}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-col items-center">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={it.cantidad || 0}
                            onChange={(e) => handleQtyChange(it.codigo, e.target.value)}
                            className="w-16 text-center px-2 py-1.5 rounded-md border-2 border-[var(--accent)] bg-[var(--input-bg)] text-sm text-[var(--fg)] focus:ring-2 focus:ring-[var(--accent)]/50 focus:outline-none"
                            aria-label={t('materials_cantidad_label', 'Cantidad del material')}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--fg)]">
                        {formatCurrency(it.precio_unitario || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--fg-strong)]">
                        {formatCurrency(subtotal)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenComment(it.codigo)}
                          className={`
                            p-2 rounded-lg transition-colors
                            ${it.comentario
                              ? 'text-[var(--primary)] bg-[var(--primary-muted)]'
                              : 'text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-elevated)]'
                            }
                          `}
                          title={it.comentario || t('materials_agregar_nota', 'Agregar nota')}
                          aria-label={`${t('materials_nota_label', 'Nota para')} ${it.codigo}`}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(it.codigo)}
                          className="p-2 rounded-lg text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                          title={t('materials_eliminar', 'Eliminar')}
                          aria-label={`${t('materials_eliminar', 'Eliminar')} ${it.codigo}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap gap-3 justify-end mt-6 pt-4 border-t border-[var(--border)]">
            <Button
              variant="ghost"
              onClick={handleCancelar}
              disabled={submitting || savingDraft}
              aria-label={t('materials_cancelar_solicitud', 'Cancelar Solicitud')}
            >
              {t('materials_cancelar_solicitud', 'Cancelar Solicitud')}
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={items.length === 0 || savingDraft || submitting}
              aria-label={t('materials_guardar_borrador', 'Guardar como borrador')}
            >
              {savingDraft
                ? t('materials_guardando', 'Guardando...')
                : t('materials_guardar_borrador', 'Guardar como borrador')}
            </Button>
            <Button
              onClick={handleFinalizar}
              disabled={items.length === 0 || submitting || savingDraft}
              aria-label={t('materials_enviar', 'Enviar Solicitud')}
            >
              {submitting
                ? t('materials_enviando', 'Enviando...')
                : t('materials_enviar', 'Enviar Solicitud')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalle del material */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={
          selectedMaterial
            ? `${selectedMaterial.codigo} — ${selectedMaterial.descripcion}`
            : t('materials_detalle', 'Detalle del Material')
        }
        size="xl"
      >
        {selectedMaterial && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Descripción larga */}
              <div className="p-4 bg-[var(--bg-soft)] border border-[var(--border)] rounded-lg">
                <p className="text-xs uppercase font-semibold text-[var(--fg-muted)] mb-2">
                  {t('materials_desc_larga', 'Descripción larga')}
                </p>
                <p className="text-[var(--fg)]">
                  {selectedMaterial.descripcion_larga || 'N/D'}
                </p>
              </div>

              {/* Info general */}
              <div className="p-4 bg-[var(--bg-soft)] border border-[var(--border)] rounded-lg space-y-2">
                <InfoRow
                  label={t('materials_unidad', 'Unidad')}
                  value={selectedMaterial.unidad || 'N/D'}
                />
                <InfoRow
                  label={t('materials_precio_usd', 'Precio USD')}
                  value={formatCurrency(selectedMaterial.precio_usd || 0)}
                />
                <InfoRow
                  label={t('materials_centro', 'Centro consultado')}
                  value={detail?.centro_consultado || contextoCentro || 'N/D'}
                />
                <InfoRow
                  label={t('materials_almacen', 'Almacén consultado')}
                  value={detail?.almacen_consultado || contextoAlmacen || 'N/D'}
                />
                <InfoRow
                  label={t('materials_stock', 'Stock (centro/almacén)')}
                  value={loadingDetail ? '...' : detail?.stock_total ?? 'N/D'}
                />
                <InfoRow
                  label={t('materials_pedidos', 'Pedidos en curso')}
                  value={loadingDetail ? '...' : detail?.pedidos_en_curso ?? 'N/D'}
                />
                <InfoRow
                  label={t('materials_spm_en_curso', 'Solicitudes SPM en curso')}
                  value="N/D"
                />

                {/* Stock detallado */}
                <div className="pt-2">
                  <p className="text-xs uppercase font-semibold text-[var(--fg-muted)] mb-1">
                    {t('materials_stock_detalle', 'Stock detallado (centro)')}
                  </p>
                  <StockList rows={detail?.stock_detalle || []} />
                  {(detail?.stock_detalle_full?.length || 0) > (detail?.stock_detalle?.length || 0) && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[var(--accent)] hover:underline mt-2"
                      onClick={() => setShowStockFull((v) => !v)}
                    >
                      {showStockFull
                        ? t('materials_ocultar_stock', 'Ocultar stock interno completo')
                        : t('materials_ver_stock', 'Ver stock interno completo (+)')}
                    </button>
                  )}
                  {showStockFull && <StockList rows={detail?.stock_detalle_full || []} compact />}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* MRP */}
              <div className="p-4 bg-[var(--warning-bg)] border border-[var(--warning-border)] rounded-lg space-y-2">
                <p className="text-xs uppercase font-semibold text-[var(--fg-muted)] mb-2">
                  {t('materials_mrp', 'MRP / Reposición automática')}
                </p>
                <InfoRow
                  label={t('materials_planificado_mrp', 'Planificado MRP')}
                  value={detail?.mrp?.planificado_mrp ? 'Sí' : 'No'}
                />
                <InfoRow
                  label={t('materials_sector', 'Sector')}
                  value={detail?.mrp?.sector || 'N/D'}
                />
                <InfoRow
                  label={t('materials_stock_seguridad', 'Stock seguridad')}
                  value={detail?.mrp?.stock_seguridad ?? 'N/D'}
                />
                <InfoRow
                  label={t('materials_punto_pedido', 'Punto pedido')}
                  value={detail?.mrp?.punto_pedido ?? 'N/D'}
                />
                <InfoRow
                  label={t('materials_stock_maximo', 'Stock máximo')}
                  value={detail?.mrp?.stock_maximo ?? 'N/D'}
                />
              </div>

              {/* Consumo histórico */}
              <div className="p-4 bg-[var(--info-bg)] border border-[var(--info-border)] rounded-lg space-y-2">
                <p className="text-xs uppercase font-semibold text-[var(--fg-muted)] mb-2">
                  {t('materials_consumo', 'Consumo histórico')}
                </p>
                <InfoRow
                  label={t('materials_total_consumo', 'Total consumo')}
                  value={
                    detail?.consumo?.total?.toFixed
                      ? detail.consumo.total.toFixed(0)
                      : 'N/D'
                  }
                />
                <InfoRow
                  label={t('materials_promedio_anual', 'Promedio anual')}
                  value={
                    detail?.consumo?.promedio_anual?.toFixed
                      ? detail.consumo.promedio_anual.toFixed(0)
                      : 'N/D'
                  }
                />
                <InfoRow
                  label={t('materials_rango_anios', 'Rango años')}
                  value={
                    detail?.consumo?.anio_desde
                      ? `${detail.consumo.anio_desde} - ${detail.consumo.anio_hasta}`
                      : 'N/D'
                  }
                />

                {/* Últimos consumos */}
                <div className="pt-2">
                  <p className="text-xs uppercase font-semibold text-[var(--fg-muted)] mb-1">
                    {t('materials_ultimos_consumos', 'Últimos consumos')}
                  </p>
                  {(detail?.consumo?.registros || []).length === 0 ? (
                    <p className="text-xs text-[var(--fg-muted)]">
                      {t('materials_sin_registros', 'Sin registros')}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {(detail?.consumo?.registros || []).map((r, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between text-xs text-[var(--fg)]"
                        >
                          <span>{r.fecha}</span>
                          <span className="font-semibold font-mono">{r.cantidad}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de confirmación para cancelar */}
      <ConfirmModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={confirmCancelar}
        title={t('materials_cancelar_titulo', 'Cancelar Solicitud')}
        description={t(
          'materials_cancelar_confirm',
          'Se borrarán todos los datos ingresados. ¿Continuar?'
        )}
        confirmText={t('common_confirmar', 'Confirmar')}
        cancelText={t('common_cancelar', 'Cancelar')}
        variant="warning"
      />

      {/* Modal de confirmación para enviar solicitud */}
      <ConfirmModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={confirmFinalizar}
        title={t('materials_enviar_titulo', 'Enviar Solicitud')}
        description={t(
          'materials_enviar_confirm',
          `¿Confirmas el envío de la solicitud con ${items.length} material(es) por un total de ${formatCurrency(total)}?`
        )}
        confirmText={t('materials_enviar_btn', 'Sí, enviar solicitud')}
        cancelText={t('common_cancelar', 'Cancelar')}
        variant="info"
        loading={submitting}
      />

      {/* Modal de comentario por item */}
      <Modal
        isOpen={commentModal.open}
        onClose={() => setCommentModal({ open: false, codigo: null, comment: '' })}
        title={t('materials_nota_titulo', 'Nota para el material')}
        size="md"
      >
        <div className="space-y-4">
          {commentModal.codigo && (
            <p className="text-sm text-[var(--fg-muted)]">
              {t('materials_nota_para', 'Material:')} <span className="font-mono font-semibold text-[var(--fg-strong)]">{commentModal.codigo}</span>
            </p>
          )}
          <div className="space-y-1.5">
            <label
              htmlFor="commentInput"
              className="text-xs uppercase font-semibold tracking-wide text-[var(--fg-muted)]"
            >
              {t('materials_nota_label_input', 'Comentario / Nota')}
            </label>
            <textarea
              id="commentInput"
              value={commentModal.comment}
              onChange={(e) => setCommentModal((prev) => ({ ...prev, comment: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:ring-2 focus:ring-[var(--input-focus)] focus:border-[var(--primary)] outline-none transition-all resize-none"
              rows={4}
              placeholder={t('materials_nota_placeholder', 'Escribe una nota o comentario para este material...')}
              aria-label={t('materials_nota_label_input', 'Comentario / Nota')}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setCommentModal({ open: false, codigo: null, comment: '' })}
            >
              {t('common_cancelar', 'Cancelar')}
            </Button>
            <Button onClick={handleSaveComment}>
              {t('materials_nota_guardar', 'Guardar nota')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dropdown de resultados - Portal para evitar problemas de z-index */}
      {dropdownOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 9999,
            maxHeight: '320px',
          }}
          role="listbox"
          aria-label={t('materials_resultados', 'Resultados de búsqueda')}
        >
          {/* Header del dropdown */}
          <div className="sticky top-0 bg-[var(--bg-elevated)] border-b border-[var(--border)] px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--fg-muted)]">
              {loadingSearch ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('common_buscando', 'Buscando...')}
                </span>
              ) : (
                `${results.length} ${results.length !== 1 ? t('common_resultados', 'resultados') : t('common_resultado', 'resultado')}`
              )}
            </span>
            <button
              type="button"
              onClick={() => setDropdownOpen(false)}
              className="p-1 hover:bg-[var(--bg-soft)] rounded transition-colors"
              aria-label={t('common_cerrar', 'Cerrar')}
            >
              <X className="h-3.5 w-3.5 text-[var(--fg-muted)]" />
            </button>
          </div>

          {/* Lista de resultados */}
          <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
            {!loadingSearch && results.length === 0 && (
              <div className="p-6 text-center">
                <Search className="h-8 w-8 text-[var(--fg-muted)]/40 mx-auto mb-2" />
                <p className="text-sm text-[var(--fg-muted)]">
                  {t('materials_sin_resultados', 'No se encontraron materiales')}
                </p>
              </div>
            )}
            {!loadingSearch &&
              results.map((m, idx) => (
                <button
                  key={m.codigo}
                  role="option"
                  aria-selected={selectedMaterial?.codigo === m.codigo}
                  className={`
                    w-full text-left px-4 py-3 flex items-center gap-3
                    border-b border-[var(--border)]/50 last:border-b-0
                    transition-all duration-100
                    ${selectedMaterial?.codigo === m.codigo
                      ? 'bg-[var(--primary)]/10 border-l-2 border-l-[var(--primary)]'
                      : 'border-l-2 border-l-transparent'}
                    ${highlightedIndex === idx
                      ? 'bg-[var(--bg-elevated)]'
                      : 'hover:bg-[var(--bg-soft)]'}
                  `}
                  onClick={() => handleSelect(m)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  type="button"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-[var(--primary)]">
                        {highlight(m.codigo, debouncedCodigo)}
                      </span>
                      {selectedMaterial?.codigo === m.codigo && (
                        <Check className="h-3.5 w-3.5 text-[var(--primary)]" />
                      )}
                    </div>
                    <p className="text-sm text-[var(--fg)] truncate mt-0.5">
                      {highlight(m.descripcion, debouncedDesc)}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[var(--fg-muted)] bg-[var(--bg-soft)] px-2 py-1 rounded shrink-0">
                    {formatCurrency(m.precio_usd || 0)}
                  </span>
                </button>
              ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// Componente auxiliar: Info Row
function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--fg-muted)]">{label}</span>
      <span className="font-semibold text-[var(--fg-strong)]">{value}</span>
    </div>
  )
}

// Componente auxiliar: Stock List
function StockList({ rows = [], compact = false }) {
  if (!rows || rows.length === 0) {
    return <p className="text-xs text-[var(--fg-muted)]">Sin stock registrado</p>
  }

  return (
    <div className={`space-y-1 ${compact ? 'mt-1' : 'mt-2'}`}>
      {rows.map((r, idx) => (
        <div
          key={idx}
          className="text-xs text-[var(--fg)] border border-dashed border-[var(--border)] px-2 py-1 rounded"
        >
          Centro {r.centro || 'N/D'} / Almacén {r.almacen_consultado || r.almacen || 'N/D'}
          {r.lote ? ` / Lote ${r.lote}` : ''} / Stock {r.stock ?? r.cantidad ?? 'N/D'}
        </div>
      ))}
    </div>
  )
}

// Función auxiliar: Resaltar texto de búsqueda
function highlight(text, query) {
  if (!query) return text

  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  return String(text)
    .split(regex)
    .map((part, idx) =>
      regex.test(part) ? (
        <mark key={idx} className="bg-[var(--warning)] text-[var(--on-primary)] rounded px-0.5">
          {part}
        </mark>
      ) : (
        <span key={idx}>{part}</span>
      )
    )
}

// Función auxiliar: Escapar regex
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
