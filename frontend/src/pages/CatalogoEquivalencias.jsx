import { useEffect, useState, useCallback } from 'react'
import { equivalencias, materiales } from '../services/spm'
import { formatCurrency } from '../utils/formatters'
import { useI18n } from '../context/i18n'
import { useAuthStore } from '../store/authStore'

// UI Components
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Alert } from '../components/ui/Alert'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Badge } from '../components/ui/Badge'
import { TableSkeleton } from '../components/ui/Skeleton'
import { MaterialDetailModal } from '../components/materials/MaterialDetailModal'
import {
  Search,
  Loader2,
  GitCompare,
  Plus,
  Edit2,
  Trash2,
  X,
  ArrowRight,
  Check,
  ExternalLink
} from '../components/ui/Icons'

const DEBOUNCE_MS = 300
const PAGE_SIZE = 50

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debounced
}

export default function CatalogoEquivalencias() {
  const { t } = useI18n()
  const { user } = useAuthStore()

  // Check if user can manage (Admin or Planificador)
  const canManage = user?.rol?.toLowerCase().includes('admin') ||
                    user?.rol?.toLowerCase().includes('planificador')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebouncedValue(searchQuery, DEBOUNCE_MS)

  // Results state
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [pagination, setPagination] = useState({ total: 0, offset: 0, hasMore: false })

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedEquivalencia, setSelectedEquivalencia] = useState(null)

  // Material detail modal state
  const [showMaterialDetail, setShowMaterialDetail] = useState(false)
  const [selectedMaterialForDetail, setSelectedMaterialForDetail] = useState(null)
  const [materialDetail, setMaterialDetail] = useState(null)
  const [loadingMaterialDetail, setLoadingMaterialDetail] = useState(false)

  // Open material detail - load material data
  const openMaterialDetail = async (codigo) => {
    setShowMaterialDetail(true)
    setLoadingMaterialDetail(true)
    setMaterialDetail(null)

    try {
      // Get basic material info - search by codigo exactly
      const res = await materiales.buscar({ codigo: codigo, limit: 10 })
      // API returns {data: [...], ok, total} - find exact match by codigo
      const materialesArray = res.data?.data || res.data || []
      const mat = materialesArray.find(m => String(m.codigo) === String(codigo)) || materialesArray[0]

      if (mat) {
        setSelectedMaterialForDetail(mat)

        // Get full detail including stock, mrp, consumo
        const detailRes = await materiales.detalle(codigo)
        // axios response has data in .data property
        const detailData = detailRes.data || {}
        setMaterialDetail(detailData)
      } else {
        // Material not found in catalog, create minimal object
        setSelectedMaterialForDetail({
          codigo: codigo,
          descripcion: 'Material no encontrado en catálogo',
          descripcion_larga: ''
        })
      }
    } catch (err) {
      console.error('Error loading material detail:', err)
      setSelectedMaterialForDetail({
        codigo: codigo,
        descripcion: 'Error al cargar material',
        descripcion_larga: ''
      })
    } finally {
      setLoadingMaterialDetail(false)
    }
  }

  // Close material detail modal
  const closeMaterialDetail = () => {
    setShowMaterialDetail(false)
    setSelectedMaterialForDetail(null)
    setMaterialDetail(null)
  }

  // Form state
  const [formData, setFormData] = useState({
    codigo_original: '',
    codigo_equivalente: '',
    compatibilidad_pct: 80,
    descripcion: '',
    notas: ''
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  // Material search for form
  const [searchOriginal, setSearchOriginal] = useState('')
  const [searchEquivalente, setSearchEquivalente] = useState('')
  const [originalResults, setOriginalResults] = useState([])
  const [equivalenteResults, setEquivalenteResults] = useState([])
  const [loadingOriginal, setLoadingOriginal] = useState(false)
  const [loadingEquivalente, setLoadingEquivalente] = useState(false)
  const [selectedOriginal, setSelectedOriginal] = useState(null)
  const [selectedEquivalente, setSelectedEquivalente] = useState(null)

  const debouncedOriginal = useDebouncedValue(searchOriginal, DEBOUNCE_MS)
  const debouncedEquivalente = useDebouncedValue(searchEquivalente, DEBOUNCE_MS)

  // Load equivalencias
  const loadEquivalencias = useCallback(async (offset = 0) => {
    setLoading(true)
    setError('')

    try {
      const res = await equivalencias.listar({
        q: debouncedQuery,
        limit: PAGE_SIZE,
        offset
      })
      const data = res.data

      setResults(data.data || [])
      setPagination({
        total: data.pagination?.total || 0,
        offset: data.pagination?.offset || 0,
        hasMore: data.pagination?.has_more || false
      })
    } catch (err) {
      console.error('load equivalencias', err)
      setError(err.response?.data?.error?.message || err.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery])

  // Initial load and search
  useEffect(() => {
    loadEquivalencias(0)
  }, [loadEquivalencias])

  // Search materials for form (original)
  useEffect(() => {
    if (!debouncedOriginal.trim()) {
      setOriginalResults([])
      return
    }

    setLoadingOriginal(true)
    materiales
      .buscar({ descripcion: debouncedOriginal, limit: 10 })
      .then((res) => setOriginalResults(res.data || []))
      .catch(() => setOriginalResults([]))
      .finally(() => setLoadingOriginal(false))
  }, [debouncedOriginal])

  // Search materials for form (equivalente)
  useEffect(() => {
    if (!debouncedEquivalente.trim()) {
      setEquivalenteResults([])
      return
    }

    setLoadingEquivalente(true)
    materiales
      .buscar({ descripcion: debouncedEquivalente, limit: 10 })
      .then((res) => setEquivalenteResults(res.data || []))
      .catch(() => setEquivalenteResults([]))
      .finally(() => setLoadingEquivalente(false))
  }, [debouncedEquivalente])

  // Auto-dismiss success message
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMsg])

  // Handle create
  const handleCreate = async () => {
    setFormError('')
    setFormLoading(true)

    try {
      await equivalencias.crear({
        codigo_original: formData.codigo_original,
        codigo_equivalente: formData.codigo_equivalente,
        compatibilidad_pct: formData.compatibilidad_pct,
        descripcion: formData.descripcion,
        notas: formData.notas
      })

      setSuccessMsg(t('equivalencias_creada', 'Equivalencia creada exitosamente'))
      setShowCreateModal(false)
      resetForm()
      loadEquivalencias(0)
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.message)
    } finally {
      setFormLoading(false)
    }
  }

  // Handle update
  const handleUpdate = async () => {
    if (!selectedEquivalencia) return

    setFormError('')
    setFormLoading(true)

    try {
      await equivalencias.actualizar(selectedEquivalencia.id, {
        compatibilidad_pct: formData.compatibilidad_pct,
        descripcion: formData.descripcion,
        notas: formData.notas
      })

      setSuccessMsg(t('equivalencias_actualizada', 'Equivalencia actualizada exitosamente'))
      setShowEditModal(false)
      resetForm()
      loadEquivalencias(pagination.offset)
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.message)
    } finally {
      setFormLoading(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!selectedEquivalencia) return

    setFormLoading(true)

    try {
      await equivalencias.eliminar(selectedEquivalencia.id)

      setSuccessMsg(t('equivalencias_eliminada', 'Equivalencia eliminada exitosamente'))
      setShowDeleteModal(false)
      setSelectedEquivalencia(null)
      loadEquivalencias(0)
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message)
    } finally {
      setFormLoading(false)
    }
  }

  // Open edit modal
  const openEditModal = (eq) => {
    setSelectedEquivalencia(eq)
    setFormData({
      codigo_original: eq.codigo_original,
      codigo_equivalente: eq.codigo_equivalente,
      compatibilidad_pct: eq.compatibilidad_pct,
      descripcion: eq.descripcion || '',
      notas: eq.notas || ''
    })
    setShowEditModal(true)
  }

  // Open delete modal
  const openDeleteModal = (eq) => {
    setSelectedEquivalencia(eq)
    setShowDeleteModal(true)
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      codigo_original: '',
      codigo_equivalente: '',
      compatibilidad_pct: 80,
      descripcion: '',
      notas: ''
    })
    setSearchOriginal('')
    setSearchEquivalente('')
    setOriginalResults([])
    setEquivalenteResults([])
    setSelectedOriginal(null)
    setSelectedEquivalente(null)
    setFormError('')
  }

  // Select material for form
  const selectOriginal = (mat) => {
    setSelectedOriginal(mat)
    setFormData(prev => ({ ...prev, codigo_original: mat.codigo }))
    setSearchOriginal(mat.codigo + ' - ' + mat.descripcion)
    setOriginalResults([])
  }

  const selectEquivalente = (mat) => {
    setSelectedEquivalente(mat)
    setFormData(prev => ({ ...prev, codigo_equivalente: mat.codigo }))
    setSearchEquivalente(mat.codigo + ' - ' + mat.descripcion)
    setEquivalenteResults([])
  }

  // Pagination
  const handleNextPage = () => {
    if (pagination.hasMore) {
      loadEquivalencias(pagination.offset + PAGE_SIZE)
    }
  }

  const handlePrevPage = () => {
    if (pagination.offset > 0) {
      loadEquivalencias(Math.max(0, pagination.offset - PAGE_SIZE))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('equivalencias_titulo', 'Catálogo de Materiales Alternativos')}
        actions={
          canManage && (
            <Button onClick={() => { resetForm(); setShowCreateModal(true) }}>
              <Plus className="h-4 w-4" />
              {t('equivalencias_nueva', 'Nueva Equivalencia')}
            </Button>
          )
        }
      />

      {/* Search Card */}
      <Card hover={false}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                {t('equivalencias_buscar', 'Buscar por código o descripción')}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('equivalencias_placeholder', 'Código SAP o descripción...')}
                  className="pl-10"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    variant="icon"
                    size="icon-xs"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
            {searchQuery && (
              <Badge variant="primary">
                {pagination.total} {t('common_resultados', 'resultados')}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      {error && (
        <Alert variant="danger" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert variant="success" onDismiss={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}

      {/* Results Table */}
      <Card hover={false}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-violet-500" />
            {t('equivalencias_lista', 'Equivalencias')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <GitCompare className="h-12 w-12 text-violet-500/30 mx-auto mb-4" />
              <p className="text-slate-500">
                {searchQuery
                  ? t('equivalencias_sin_resultados', 'No se encontraron equivalencias con los criterios de búsqueda')
                  : t('equivalencias_vacio', 'No hay equivalencias registradas')}
              </p>
              {canManage && !searchQuery && (
                <Button
                  variant="secondary"
                  className="mt-4"
                  onClick={() => { resetForm(); setShowCreateModal(true) }}
                >
                  <Plus className="h-4 h-4 text-blue-600" />
                  {t('equivalencias_crear_primera', 'Crear la primera equivalencia')}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border border-white/30 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--bg-soft)] backdrop-blur-sm border-b-2 border-[var(--border)]">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                        {t('equivalencias_col_original', 'Material Original')}
                      </th>
                      <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                        {t('equivalencias_col_equivalente', 'Material Equivalente')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                        {t('equivalencias_col_tipo', 'Tipo')}
                      </th>
                      <th className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] ${canManage ? 'border-r border-b border-slate-200' : ''}`}>
                        {t('equivalencias_col_motivo', 'Motivo')}
                      </th>
                      {canManage && (
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                          {t('equivalencias_col_acciones', 'Acciones')}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((eq, idx) => (
                      <tr
                        key={eq.id}
                        className={`
                          border-b border-white/30 transition-colors
                          ${idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/70/30'}
                          hover:bg-slate-100/70
                        `}
                      >
                        <td className="px-4 py-3 border-r border-b border-slate-200">
                          <div>
                            <button
                              type="button"
                              onClick={() => openMaterialDetail(eq.codigo_original)}
                              className="font-mono font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer inline-flex items-center gap-1 group"
                              title={t('equivalencias_ver_detalle', 'Ver detalle del material')}
                            >
                              {eq.codigo_original}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              {eq.descripcion_original}
                            </p>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center border-r border-b border-slate-200">
                          <ArrowRight className="h-4 w-4 text-slate-600 mx-auto" />
                        </td>
                        <td className="px-4 py-3 border-r border-b border-slate-200">
                          <div>
                            <button
                              type="button"
                              onClick={() => openMaterialDetail(eq.codigo_equivalente)}
                              className="font-mono font-semibold text-cyan-600 hover:text-cyan-800 hover:underline cursor-pointer inline-flex items-center gap-1 group"
                              title={t('equivalencias_ver_detalle', 'Ver detalle del material')}
                            >
                              {eq.codigo_equivalente}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              {eq.descripcion_equivalente}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center border-r border-b border-slate-200">
                          <Badge variant={eq.tipo_equivalencia === 'SUSTITUTO' ? 'success' : 'secondary'}>
                            {eq.tipo_equivalencia || '-'}
                          </Badge>
                          {eq.criterio && (
                            <p className="text-xs text-slate-500 mt-0.5">{eq.criterio}</p>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-slate-800 ${canManage ? 'border-r border-b border-slate-200' : ''}`}>
                          <p className="line-clamp-2">{eq.motivo || '-'}</p>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                type="button"
                                variant="icon-primary"
                                size="icon-sm"
                                onClick={() => openEditModal(eq)}
                                title={t('common_editar', 'Editar')}
                              >
                                <Edit2 className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                type="button"
                                variant="icon-danger"
                                size="icon-sm"
                                onClick={() => openDeleteModal(eq)}
                                title={t('common_eliminar', 'Eliminar')}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {(pagination.offset > 0 || pagination.hasMore) && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/30">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={pagination.offset === 0}
                  >
                    {t('common_anterior', 'Anterior')}
                  </Button>
                  <span className="text-sm text-slate-500">
                    {pagination.offset + 1} - {Math.min(pagination.offset + PAGE_SIZE, pagination.total)} de {pagination.total}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!pagination.hasMore}
                  >
                    {t('common_siguiente', 'Siguiente')}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetForm() }}
        title={t('equivalencias_crear_titulo', 'Crear Nueva Equivalencia')}
        size="lg"
      >
        <div className="space-y-4">
          {formError && (
            <Alert variant="danger" size="sm">
              {formError}
            </Alert>
          )}

          {/* Material Original */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {t('equivalencias_material_original', 'Material Original')} *
            </label>
            {selectedOriginal ? (
              <div className="flex items-center gap-2 p-3 bg-slate-50/70 border border-blue-500/30 rounded-lg">
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="font-mono text-blue-600">{selectedOriginal.codigo}</span>
                <span className="text-sm text-slate-800">{selectedOriginal.descripcion}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedOriginal(null); setSearchOriginal(''); setFormData(prev => ({ ...prev, codigo_original: '' })) }}
                  className="ml-auto p-1 hover:bg-slate-100/70 rounded"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={searchOriginal}
                  onChange={(e) => setSearchOriginal(e.target.value)}
                  placeholder={t('equivalencias_buscar_material', 'Buscar material por código o descripción...')}
                />
                {loadingOriginal && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-500" />
                )}
                {originalResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-white/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {originalResults.map((mat) => (
                      <button
                        key={mat.codigo}
                        type="button"
                        onClick={() => selectOriginal(mat)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-100/70 transition-colors"
                      >
                        <span className="font-mono text-sm text-blue-600">{mat.codigo}</span>
                        <span className="text-sm text-slate-800 ml-2">{mat.descripcion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Material Equivalente */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {t('equivalencias_material_equivalente', 'Material Equivalente')} *
            </label>
            {selectedEquivalente ? (
              <div className="flex items-center gap-2 p-3 bg-slate-50/70 border border-cyan-500/30 rounded-lg">
                <Check className="h-4 w-4 text-emerald-600" />
                <span className="font-mono text-cyan-600">{selectedEquivalente.codigo}</span>
                <span className="text-sm text-slate-800">{selectedEquivalente.descripcion}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedEquivalente(null); setSearchEquivalente(''); setFormData(prev => ({ ...prev, codigo_equivalente: '' })) }}
                  className="ml-auto p-1 hover:bg-slate-100/70 rounded"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={searchEquivalente}
                  onChange={(e) => setSearchEquivalente(e.target.value)}
                  placeholder={t('equivalencias_buscar_material', 'Buscar material por código o descripción...')}
                />
                {loadingEquivalente && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-500" />
                )}
                {equivalenteResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-white/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {equivalenteResults.map((mat) => (
                      <button
                        key={mat.codigo}
                        type="button"
                        onClick={() => selectEquivalente(mat)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-100/70 transition-colors"
                      >
                        <span className="font-mono text-sm text-cyan-600">{mat.codigo}</span>
                        <span className="text-sm text-slate-800 ml-2">{mat.descripcion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Compatibilidad */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {t('equivalencias_compatibilidad', 'Porcentaje de Compatibilidad')} *
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={formData.compatibilidad_pct}
                onChange={(e) => setFormData(prev => ({ ...prev, compatibilidad_pct: parseInt(e.target.value) }))}
                className="flex-1"
              />
              <div className="w-20">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.compatibilidad_pct}
                  onChange={(e) => setFormData(prev => ({ ...prev, compatibilidad_pct: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  className="text-center"
                />
              </div>
              <CompatibilityBar percent={formData.compatibilidad_pct} showLabel={false} />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {t('equivalencias_descripcion', 'Descripción')}
            </label>
            <Input
              value={formData.descripcion}
              onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              placeholder={t('equivalencias_desc_placeholder', 'Descripción de la equivalencia...')}
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {t('equivalencias_notas', 'Notas')}
            </label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
              placeholder={t('equivalencias_notas_placeholder', 'Notas adicionales...')}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-white/50 bg-white/50 backdrop-blur-sm text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 outline-none transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/30">
            <Button variant="ghost" onClick={() => { setShowCreateModal(false); resetForm() }}>
              {t('common_cancelar', 'Cancelar')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.codigo_original || !formData.codigo_equivalente || formLoading}
            >
              {formLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 text-blue-600" />
              )}
              {t('equivalencias_crear', 'Crear Equivalencia')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); resetForm() }}
        title={t('equivalencias_editar_titulo', 'Editar Equivalencia')}
        size="lg"
      >
        <div className="space-y-4">
          {formError && (
            <Alert variant="danger" size="sm">
              {formError}
            </Alert>
          )}

          {/* Show readonly material info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50/70 border border-white/30 rounded-lg">
              <p className="text-xs text-slate-500 uppercase mb-1">Material Original</p>
              <p className="font-mono text-blue-600">{formData.codigo_original}</p>
            </div>
            <div className="p-3 bg-slate-50/70 border border-white/30 rounded-lg">
              <p className="text-xs text-slate-500 uppercase mb-1">Material Equivalente</p>
              <p className="font-mono text-cyan-600">{formData.codigo_equivalente}</p>
            </div>
          </div>

          {/* Compatibilidad */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {t('equivalencias_compatibilidad', 'Porcentaje de Compatibilidad')}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={formData.compatibilidad_pct}
                onChange={(e) => setFormData(prev => ({ ...prev, compatibilidad_pct: parseInt(e.target.value) }))}
                className="flex-1"
              />
              <div className="w-20">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.compatibilidad_pct}
                  onChange={(e) => setFormData(prev => ({ ...prev, compatibilidad_pct: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  className="text-center"
                />
              </div>
              <CompatibilityBar percent={formData.compatibilidad_pct} showLabel={false} />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {t('equivalencias_descripcion', 'Descripción')}
            </label>
            <Input
              value={formData.descripcion}
              onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              placeholder={t('equivalencias_desc_placeholder', 'Descripción de la equivalencia...')}
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              {t('equivalencias_notas', 'Notas')}
            </label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
              placeholder={t('equivalencias_notas_placeholder', 'Notas adicionales...')}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-white/50 bg-white/50 backdrop-blur-sm text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 outline-none transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/30">
            <Button variant="ghost" onClick={() => { setShowEditModal(false); resetForm() }}>
              {t('common_cancelar', 'Cancelar')}
            </Button>
            <Button onClick={handleUpdate} disabled={formLoading}>
              {formLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
              {t('equivalencias_guardar', 'Guardar Cambios')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedEquivalencia(null) }}
        onConfirm={handleDelete}
        title={t('equivalencias_eliminar_titulo', 'Eliminar Equivalencia')}
        description={
          selectedEquivalencia
            ? t('equivalencias_eliminar_confirm', `¿Estás seguro de eliminar la equivalencia entre ${selectedEquivalencia.codigo_original} y ${selectedEquivalencia.codigo_equivalente}?`)
            : ''
        }
        confirmText={t('common_eliminar', 'Eliminar')}
        cancelText={t('common_cancelar', 'Cancelar')}
        variant="danger"
        loading={formLoading}
      />

      {/* Material Detail Modal */}
      <MaterialDetailModal
        isOpen={showMaterialDetail}
        onClose={closeMaterialDetail}
        selectedMaterial={selectedMaterialForDetail}
        detail={materialDetail}
        loadingDetail={loadingMaterialDetail}
      />
    </div>
  )
}

// Helper Component: Compatibility Bar
function CompatibilityBar({ percent, showLabel = true }) {
  let colorClass = 'text-emerald-600'
  let bgClass = 'bg-emerald-500'
  if (percent < 50) {
    colorClass = 'text-red-600'
    bgClass = 'bg-red-500'
  } else if (percent < 80) {
    colorClass = 'text-amber-600'
    bgClass = 'bg-amber-500'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-slate-50/70 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${bgClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-sm font-semibold ${colorClass}`}>
          {percent}%
        </span>
      )}
    </div>
  )
}
