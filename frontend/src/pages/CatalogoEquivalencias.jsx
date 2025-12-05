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
import {
  Search,
  Loader2,
  GitCompare,
  Plus,
  Edit2,
  Trash2,
  X,
  ArrowRight,
  Check
} from 'lucide-react'

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
        subtitle={t('equivalencias_subtitulo', 'Gestiona las equivalencias entre materiales')}
        actions={
          canManage && (
            <Button onClick={() => { resetForm(); setShowCreateModal(true) }}>
              <Plus className="h-4 w-4 mr-2" />
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
              <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-2">
                {t('equivalencias_buscar', 'Buscar por código o descripción')}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('equivalencias_placeholder', 'Código SAP o descripción...')}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--bg-elevated)] rounded"
                  >
                    <X className="h-4 w-4 text-[var(--fg-muted)]" />
                  </button>
                )}
              </div>
            </div>
            <Badge variant="primary">
              {pagination.total} {t('common_resultados', 'resultados')}
            </Badge>
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
            <GitCompare className="h-5 w-5 text-[var(--accent)]" />
            {t('equivalencias_lista', 'Equivalencias')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <GitCompare className="h-12 w-12 text-[var(--fg-muted)]/30 mx-auto mb-4" />
              <p className="text-[var(--fg-muted)]">
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
                  <Plus className="h-4 w-4 mr-2" />
                  {t('equivalencias_crear_primera', 'Crear la primera equivalencia')}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                        {t('equivalencias_col_original', 'Material Original')}
                      </th>
                      <th className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                        {t('equivalencias_col_equivalente', 'Material Equivalente')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                        {t('equivalencias_col_compatibilidad', 'Compatibilidad')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                        {t('equivalencias_col_descripcion', 'Descripción')}
                      </th>
                      {canManage && (
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
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
                          border-b border-[var(--border)] transition-colors
                          ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[var(--bg-soft)]/30'}
                          hover:bg-[var(--bg-elevated)]
                        `}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-mono font-semibold text-[var(--primary)]">
                              {eq.codigo_original}
                            </span>
                            <p className="text-xs text-[var(--fg-muted)] line-clamp-1 mt-0.5">
                              {eq.descripcion_original}
                            </p>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <ArrowRight className="h-4 w-4 text-[var(--fg-muted)] mx-auto" />
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-mono font-semibold text-[var(--accent)]">
                              {eq.codigo_equivalente}
                            </span>
                            <p className="text-xs text-[var(--fg-muted)] line-clamp-1 mt-0.5">
                              {eq.descripcion_equivalente}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <CompatibilityBar percent={eq.compatibilidad_pct} />
                        </td>
                        <td className="px-4 py-3 text-[var(--fg)]">
                          <p className="line-clamp-2">{eq.descripcion || '-'}</p>
                          {eq.notas && (
                            <p className="text-xs text-[var(--fg-muted)] line-clamp-1 mt-0.5 italic">
                              {eq.notas}
                            </p>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(eq)}
                                className="p-2 rounded-lg text-[var(--info)] hover:bg-[var(--info)]/10 transition-colors"
                                title={t('common_editar', 'Editar')}
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteModal(eq)}
                                className="p-2 rounded-lg text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                                title={t('common_eliminar', 'Eliminar')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={pagination.offset === 0}
                  >
                    {t('common_anterior', 'Anterior')}
                  </Button>
                  <span className="text-sm text-[var(--fg-muted)]">
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
            <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-2">
              {t('equivalencias_material_original', 'Material Original')} *
            </label>
            {selectedOriginal ? (
              <div className="flex items-center gap-2 p-3 bg-[var(--bg-soft)] border border-[var(--primary)]/30 rounded-lg">
                <Check className="h-4 w-4 text-[var(--success)]" />
                <span className="font-mono text-[var(--primary)]">{selectedOriginal.codigo}</span>
                <span className="text-sm text-[var(--fg)]">{selectedOriginal.descripcion}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedOriginal(null); setSearchOriginal(''); setFormData(prev => ({ ...prev, codigo_original: '' })) }}
                  className="ml-auto p-1 hover:bg-[var(--bg-elevated)] rounded"
                >
                  <X className="h-4 w-4 text-[var(--fg-muted)]" />
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
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[var(--fg-muted)]" />
                )}
                {originalResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {originalResults.map((mat) => (
                      <button
                        key={mat.codigo}
                        type="button"
                        onClick={() => selectOriginal(mat)}
                        className="w-full text-left px-4 py-2 hover:bg-[var(--bg-elevated)] transition-colors"
                      >
                        <span className="font-mono text-sm text-[var(--primary)]">{mat.codigo}</span>
                        <span className="text-sm text-[var(--fg)] ml-2">{mat.descripcion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Material Equivalente */}
          <div>
            <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-2">
              {t('equivalencias_material_equivalente', 'Material Equivalente')} *
            </label>
            {selectedEquivalente ? (
              <div className="flex items-center gap-2 p-3 bg-[var(--bg-soft)] border border-[var(--accent)]/30 rounded-lg">
                <Check className="h-4 w-4 text-[var(--success)]" />
                <span className="font-mono text-[var(--accent)]">{selectedEquivalente.codigo}</span>
                <span className="text-sm text-[var(--fg)]">{selectedEquivalente.descripcion}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedEquivalente(null); setSearchEquivalente(''); setFormData(prev => ({ ...prev, codigo_equivalente: '' })) }}
                  className="ml-auto p-1 hover:bg-[var(--bg-elevated)] rounded"
                >
                  <X className="h-4 w-4 text-[var(--fg-muted)]" />
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
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[var(--fg-muted)]" />
                )}
                {equivalenteResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {equivalenteResults.map((mat) => (
                      <button
                        key={mat.codigo}
                        type="button"
                        onClick={() => selectEquivalente(mat)}
                        className="w-full text-left px-4 py-2 hover:bg-[var(--bg-elevated)] transition-colors"
                      >
                        <span className="font-mono text-sm text-[var(--accent)]">{mat.codigo}</span>
                        <span className="text-sm text-[var(--fg)] ml-2">{mat.descripcion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Compatibilidad */}
          <div>
            <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-2">
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
            <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-2">
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
            <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-2">
              {t('equivalencias_notas', 'Notas')}
            </label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
              placeholder={t('equivalencias_notas_placeholder', 'Notas adicionales...')}
              rows={2}
              className="w-full px-3 py-2.5 rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:ring-2 focus:ring-[var(--input-focus)] focus:border-[var(--primary)] outline-none transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => { setShowCreateModal(false); resetForm() }}>
              {t('common_cancelar', 'Cancelar')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.codigo_original || !formData.codigo_equivalente || formLoading}
            >
              {formLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
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
            <div className="p-3 bg-[var(--bg-soft)] border border-[var(--border)] rounded-lg">
              <p className="text-xs text-[var(--fg-muted)] uppercase mb-1">Material Original</p>
              <p className="font-mono text-[var(--primary)]">{formData.codigo_original}</p>
            </div>
            <div className="p-3 bg-[var(--bg-soft)] border border-[var(--border)] rounded-lg">
              <p className="text-xs text-[var(--fg-muted)] uppercase mb-1">Material Equivalente</p>
              <p className="font-mono text-[var(--accent)]">{formData.codigo_equivalente}</p>
            </div>
          </div>

          {/* Compatibilidad */}
          <div>
            <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-2">
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
            <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-2">
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
            <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-2">
              {t('equivalencias_notas', 'Notas')}
            </label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
              placeholder={t('equivalencias_notas_placeholder', 'Notas adicionales...')}
              rows={2}
              className="w-full px-3 py-2.5 rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input-bg)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:ring-2 focus:ring-[var(--input-focus)] focus:border-[var(--primary)] outline-none transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <Button variant="ghost" onClick={() => { setShowEditModal(false); resetForm() }}>
              {t('common_cancelar', 'Cancelar')}
            </Button>
            <Button onClick={handleUpdate} disabled={formLoading}>
              {formLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
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
    </div>
  )
}

// Helper Component: Compatibility Bar
function CompatibilityBar({ percent, showLabel = true }) {
  let color = 'var(--success)'
  let bgColor = 'var(--success)'
  if (percent < 50) {
    color = 'var(--danger)'
    bgColor = 'var(--danger)'
  } else if (percent < 80) {
    color = 'var(--warning)'
    bgColor = 'var(--warning)'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-[var(--bg-soft)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: bgColor }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-semibold" style={{ color }}>
          {percent}%
        </span>
      )}
    </div>
  )
}
