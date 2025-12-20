import { useEffect, useState, useCallback, useMemo } from 'react'
import { materiales, equivalencias } from '../services/spm'
import { formatCurrency, formatAlmacen } from '../utils/formatters'
import { useI18n } from '../context/i18n'

// UI Components
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Alert } from '../components/ui/Alert'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { TableSkeleton } from '../components/ui/Skeleton'
import { ScrollReveal } from '../components/ui/ScrollReveal'
import {
  Search,
  Loader2,
  Package,
  TrendingUp,
  Boxes,
  ClipboardList,
  GitCompare,
  ChevronRight,
  X
} from '../components/ui/Icons'

const DEBOUNCE_MS = 300
const MAX_RESULTS = 100

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debounced
}

export default function CatalogoMateriales() {
  const { t } = useI18n()

  // Search state
  const [searchCodigo, setSearchCodigo] = useState('')
  const [searchDesc, setSearchDesc] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')

  const debouncedCodigo = useDebouncedValue(searchCodigo, DEBOUNCE_MS)
  const debouncedDesc = useDebouncedValue(searchDesc, DEBOUNCE_MS)
  const debouncedKeyword = useDebouncedValue(searchKeyword, DEBOUNCE_MS)

  // Results state
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  // Detail state
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Additional detail data
  const [solicitudesData, setSolicitudesData] = useState([])
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false)
  const [equivalenciasData, setEquivalenciasData] = useState([])
  const [loadingEquivalencias, setLoadingEquivalencias] = useState(false)

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    stock: true,
    mrp: true,
    consumo: true,
    solicitudes: true,
    equivalencias: true
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Search materials
  useEffect(() => {
    const shouldSearch =
      debouncedCodigo.trim() !== '' ||
      debouncedDesc.trim() !== '' ||
      debouncedKeyword.trim() !== ''

    if (!shouldSearch) {
      if (hasSearched) {
        setResults([])
        setHasSearched(false)
      }
      return
    }

    setLoading(true)
    setError('')
    setHasSearched(true)

    // Combine description and keyword for search
    const searchTerms = [debouncedDesc.trim(), debouncedKeyword.trim()]
      .filter(Boolean)
      .join(' ')

    materiales
      .buscar({
        codigo: debouncedCodigo.trim(),
        descripcion: searchTerms,
        limit: MAX_RESULTS
      })
      .then((res) => {
        // Backend devuelve {ok, data: [...], total}, necesitamos res.data.data
        const data = res.data?.data || res.data || []
        setResults(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        console.error('search materiales', err)
        setError(err.response?.data?.error?.message || err.message)
        setResults([])
      })
      .finally(() => setLoading(false))
  }, [debouncedCodigo, debouncedDesc, debouncedKeyword, hasSearched])

  // Load material detail
  const loadDetail = useCallback(async (mat) => {
    setSelectedMaterial(mat)
    setShowDetailModal(true)
    setLoadingDetail(true)
    setDetail(null)
    setSolicitudesData([])
    setEquivalenciasData([])

    try {
      const res = await materiales.detalle(mat.codigo)
      setDetail(res.data || {})
    } catch (err) {
      console.error('detalle material', err)
      setDetail(null)
    } finally {
      setLoadingDetail(false)
    }

    // Load solicitudes
    setLoadingSolicitudes(true)
    try {
      const res = await materiales.solicitudes(mat.codigo)
      setSolicitudesData(res.data?.solicitudes || [])
    } catch (err) {
      console.error('solicitudes material', err)
      setSolicitudesData([])
    } finally {
      setLoadingSolicitudes(false)
    }

    // Load equivalencias
    setLoadingEquivalencias(true)
    try {
      const res = await equivalencias.porMaterial(mat.codigo)
      setEquivalenciasData(res.data?.equivalencias || [])
    } catch (err) {
      console.error('equivalencias material', err)
      setEquivalenciasData([])
    } finally {
      setLoadingEquivalencias(false)
    }
  }, [])

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchCodigo('')
    setSearchDesc('')
    setSearchKeyword('')
    setResults([])
    setHasSearched(false)
    setSelectedMaterial(null)
  }, [])

  // Close modal
  const handleCloseModal = useCallback(() => {
    setShowDetailModal(false)
    setSelectedMaterial(null)
    setDetail(null)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <ScrollReveal>
        <PageHeader
          title={t('catalogo_materiales_titulo', 'Catálogo de Materiales')}
        />
      </ScrollReveal>

      {/* Search Card */}
      <ScrollReveal delay={100}>
        <Card hover={false}>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Código SAP */}
            <div className="lg:w-40">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                {t('catalogo_codigo_sap', 'Código SAP')}
              </label>
              <Input
                value={searchCodigo}
                onChange={(e) => setSearchCodigo(e.target.value)}
                placeholder="Ej: 100012345"
                className="font-mono"
              />
            </div>

            {/* Descripción */}
            <div className="flex-1 lg:max-w-md">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                {t('catalogo_descripcion', 'Descripción')}
              </label>
              <Input
                value={searchDesc}
                onChange={(e) => setSearchDesc(e.target.value)}
                placeholder={t('catalogo_buscar_desc', 'Buscar por descripción...')}
              />
            </div>

            {/* Palabra clave */}
            <div className="flex-1 lg:max-w-sm">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                {t('catalogo_palabra_clave', 'Palabra clave')}
              </label>
              <div className="relative">
                <Input
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder={t('catalogo_buscar_keyword', 'Filtro adicional...')}
                />
                {(searchCodigo || searchDesc || searchKeyword) && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100/70 rounded transition-colors"
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>

            {/* Search indicator */}
            <div className="flex items-end">
              {loading ? (
                <div className="flex items-center gap-2 h-10 px-4 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t('common_buscando', 'Buscando...')}</span>
                </div>
              ) : hasSearched && (
                <div className="flex items-center h-10 px-4">
                  <Badge variant={results.length > 0 ? 'primary' : 'ghost'}>
                    {results.length} {t('common_resultados', 'resultados')}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        </Card>
      </ScrollReveal>

      {/* Error */}
      {error && (
        <Alert variant="danger" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Results Table */}
      <ScrollReveal delay={200}>
        <Card hover={false}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-500" />
              {t('catalogo_resultados', 'Resultados de Búsqueda')}
            </CardTitle>
          </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : !hasSearched ? (
            <div className="py-12 text-center">
              <Search className="h-12 w-12 text-blue-500/30 mx-auto mb-4" />
              <p className="text-slate-500">
                {t('catalogo_instruccion', 'Ingresa un código SAP, descripción o palabra clave para buscar materiales')}
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="h-12 w-12 text-indigo-500/30 mx-auto mb-4" />
              <p className="text-slate-500">
                {t('catalogo_sin_resultados', 'No se encontraron materiales con los criterios de búsqueda')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-white/30 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-soft)] backdrop-blur-sm border-b-2 border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                      {t('catalogo_col_codigo', 'Código')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                      {t('catalogo_col_descripcion', 'Descripción')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                      {t('catalogo_col_unidad', 'Unidad')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] border-r border-b border-slate-200">
                      {t('catalogo_col_precio', 'Precio USD')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                      {t('catalogo_col_acciones', 'Acciones')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((mat, idx) => (
                    <tr
                      key={mat.codigo}
                      className={`
                        border-b border-white/30 transition-colors cursor-pointer
                        ${idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/70/30'}
                        hover:bg-slate-100/70
                        ${selectedMaterial?.codigo === mat.codigo ? 'ring-2 ring-inset ring-blue-500' : ''}
                      `}
                      onClick={() => loadDetail(mat)}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-blue-600 border-r border-b border-slate-200">
                        {mat.codigo}
                      </td>
                      <td className="px-4 py-3 text-slate-800 border-r border-b border-slate-200">
                        <p className="line-clamp-1">{mat.descripcion}</p>
                        {mat.descripcion_larga && mat.descripcion_larga !== mat.descripcion && (
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {mat.descripcion_larga}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 border-r border-b border-slate-200">
                        {mat.unidad_medida || mat.unidad || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-800 border-r border-b border-slate-200">
                        {formatCurrency(mat.precio_usd || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            loadDetail(mat)
                          }}
                        >
                          <ChevronRight className="h-4 w-4 text-slate-600" />
                          {t('catalogo_ver_detalle', 'Ver detalle')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={handleCloseModal}
        title={
          selectedMaterial
            ? `${selectedMaterial.codigo} — ${selectedMaterial.descripcion}`
            : t('catalogo_detalle_titulo', 'Detalle del Material')
        }
        size="xl"
      >
        {loadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : selectedMaterial && (
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50/70 border border-white/30 rounded-lg">
                <p className="text-xs uppercase font-semibold text-slate-500 mb-2">
                  {t('catalogo_desc_larga', 'Descripción larga')}
                </p>
                <p className="text-slate-800">
                  {selectedMaterial.descripcion_larga || selectedMaterial.descripcion || 'N/D'}
                </p>
              </div>
              <div className="p-4 bg-slate-50/70 border border-white/30 rounded-lg space-y-2">
                <InfoRow label={t('catalogo_unidad', 'Unidad')} value={selectedMaterial.unidad || 'N/D'} />
                <InfoRow label={t('catalogo_precio_usd', 'Precio USD')} value={formatCurrency(selectedMaterial.precio_usd || 0)} />
              </div>
            </div>

            {/* Stock Section */}
            <CollapsibleSection
              title={t('catalogo_stock', 'Stock')}
              icon={<Boxes className="h-4 w-4" />}
              expanded={expandedSections.stock}
              onToggle={() => toggleSection('stock')}
              variant="info"
            >
              <div className="space-y-2">
                <InfoRow
                  label={t('catalogo_stock_total', 'Stock Total')}
                  value={detail?.stock_total ?? 'N/D'}
                />
                <InfoRow
                  label={t('catalogo_pedidos_curso', 'Pedidos en Curso')}
                  value={detail?.pedidos_en_curso ?? 'N/D'}
                />
                {(detail?.stock_detalle?.length > 0) && (
                  <div className="mt-3">
                    <p className="text-xs uppercase font-semibold text-slate-500 mb-2">
                      {t('catalogo_stock_por_centro', 'Desglose por Centro/Almacén')}
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {detail.stock_detalle.map((row, idx) => (
                        <div key={idx} className="text-xs p-2 bg-white rounded border border-white/30">
                          <span className="font-medium">Centro {row.centro}</span> /
                          <span className="ml-1">Almacén {formatAlmacen(row.almacen_consultado || row.almacen)}</span>
                          {row.lote && <span className="ml-1">/ Lote {row.lote}</span>}
                          <span className="ml-2 font-mono font-semibold text-blue-600">
                            Stock: {row.stock}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* MRP Section */}
            <CollapsibleSection
              title={t('catalogo_mrp', 'Parámetros MRP')}
              icon={<TrendingUp className="h-4 w-4" />}
              expanded={expandedSections.mrp}
              onToggle={() => toggleSection('mrp')}
              variant="warning"
              badge={detail?.mrp_list?.length > 0 ? detail.mrp_list.length : undefined}
            >
              {detail?.mrp_list?.length > 0 ? (
                <div className="space-y-3">
                  {detail.mrp_list.map((mrp, idx) => (
                    <div
                      key={`${mrp.centro}-${mrp.almacen}-${idx}`}
                      className="p-3 bg-white border border-white/30 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-amber-700">
                          {t('catalogo_centro', 'Centro')}: {mrp.centro}
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="text-sm text-slate-600">
                          {t('catalogo_almacen', 'Almacén')}: {mrp.almacen}
                        </span>
                        {mrp.sector && (
                          <>
                            <span className="text-slate-400">|</span>
                            <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded">
                              {mrp.sector}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center p-2 bg-slate-50/50 rounded">
                          <div className="text-xs text-slate-500">{t('catalogo_stock_seguridad', 'Stock Seg.')}</div>
                          <div className="font-semibold text-slate-800">{mrp.stock_seguridad ?? 0}</div>
                        </div>
                        <div className="text-center p-2 bg-slate-50/50 rounded">
                          <div className="text-xs text-slate-500">{t('catalogo_punto_pedido', 'Pto. Pedido')}</div>
                          <div className="font-semibold text-slate-800">{mrp.punto_pedido ?? 0}</div>
                        </div>
                        <div className="text-center p-2 bg-slate-50/50 rounded">
                          <div className="text-xs text-slate-500">{t('catalogo_stock_maximo', 'Stock Máx.')}</div>
                          <div className="font-semibold text-slate-800">{mrp.stock_maximo ?? 0}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {t('catalogo_sin_mrp', 'Este material no está planificado en MRP')}
                </p>
              )}
            </CollapsibleSection>

            {/* Consumo Histórico */}
            <CollapsibleSection
              title={t('catalogo_consumo', 'Consumo Histórico')}
              icon={<TrendingUp className="h-4 w-4" />}
              expanded={expandedSections.consumo}
              onToggle={() => toggleSection('consumo')}
              variant="success"
              badge={detail?.consumo_list?.length > 0 ? detail.consumo_list.length : undefined}
            >
              {detail?.consumo_list?.length > 0 ? (
                <div className="space-y-3">
                  {detail.consumo_list.map((c, idx) => (
                    <div
                      key={`${c.centro}-${c.almacen}-${idx}`}
                      className="p-3 bg-white border border-white/30 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-emerald-700">
                          {t('catalogo_centro', 'Centro')}: {c.centro}
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="text-sm text-slate-600">
                          {t('catalogo_almacen', 'Almacén')}: {c.almacen}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center p-2 bg-slate-50/50 rounded">
                          <div className="text-xs text-slate-500">{t('catalogo_promedio_anual', 'Prom. Anual')}</div>
                          <div className="font-semibold text-emerald-700">{c.promedio_anual}</div>
                        </div>
                        <div className="text-center p-2 bg-slate-50/50 rounded">
                          <div className="text-xs text-slate-500">{t('catalogo_total_consumo', 'Total')}</div>
                          <div className="font-semibold text-slate-800">{c.total}</div>
                        </div>
                        <div className="text-center p-2 bg-slate-50/50 rounded">
                          <div className="text-xs text-slate-500">{t('catalogo_rango_anios', 'Años')}</div>
                          <div className="font-semibold text-slate-800">{c.anio_desde}-{c.anio_hasta}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {t('catalogo_sin_consumo', 'No hay consumo histórico registrado')}
                </p>
              )}
            </CollapsibleSection>

            {/* Solicitudes SPM Activas */}
            <CollapsibleSection
              title={t('catalogo_solicitudes_spm', 'Solicitudes SPM Activas')}
              icon={<ClipboardList className="h-4 w-4" />}
              expanded={expandedSections.solicitudes}
              onToggle={() => toggleSection('solicitudes')}
              variant="primary"
              badge={solicitudesData.length > 0 ? solicitudesData.length : undefined}
            >
              {loadingSolicitudes ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t('common_cargando', 'Cargando...')}</span>
                </div>
              ) : solicitudesData.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t('catalogo_sin_solicitudes', 'No hay solicitudes SPM activas para este material')}
                </p>
              ) : (
                <div className="space-y-2">
                  {solicitudesData.map((sol) => (
                    <div
                      key={sol.id}
                      className="p-3 bg-white border border-white/30 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-blue-600">
                          SPM #{sol.id}
                        </span>
                        <Badge variant={getStatusVariant(sol.estado)}>
                          {sol.estado}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        <p><span className="font-medium">Solicitante:</span> {sol.solicitante}</p>
                        <p><span className="font-medium">Cantidad:</span> {sol.cantidad_solicitada}</p>
                        <p><span className="font-medium">Fecha:</span> {new Date(sol.fecha).toLocaleDateString()}</p>
                        {sol.centro && <p><span className="font-medium">Centro:</span> {sol.centro}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>

            {/* Equivalencias */}
            <CollapsibleSection
              title={t('catalogo_equivalencias', 'Materiales Equivalentes')}
              icon={<GitCompare className="h-4 w-4" />}
              expanded={expandedSections.equivalencias}
              onToggle={() => toggleSection('equivalencias')}
              variant="accent"
              badge={equivalenciasData.length > 0 ? equivalenciasData.length : undefined}
            >
              {loadingEquivalencias ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t('common_cargando', 'Cargando...')}</span>
                </div>
              ) : equivalenciasData.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t('catalogo_sin_equivalencias', 'No hay materiales equivalentes registrados')}
                </p>
              ) : (
                <div className="space-y-2">
                  {equivalenciasData.map((eq, idx) => (
                    <div
                      key={eq.codigo_equivalente || idx}
                      className="p-3 bg-white border border-white/30 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-semibold text-cyan-600">
                          {eq.codigo_equivalente}
                        </span>
                        {eq.tipo_equivalencia && (
                          <span className="text-xs px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded">
                            {eq.tipo_equivalencia}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-800">{eq.descripcion_equivalente}</p>
                      {eq.criterio && (
                        <p className="text-xs text-slate-500 mt-1">
                          <span className="font-medium">{t('catalogo_criterio', 'Criterio')}:</span> {eq.criterio}
                        </p>
                      )}
                      {eq.motivo && (
                        <p className="text-xs text-slate-500 mt-1">
                          <span className="font-medium">{t('catalogo_motivo', 'Motivo')}:</span> {eq.motivo}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          </div>
        )}
      </Modal>
    </div>
  )
}

// Helper Components

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  )
}

function CollapsibleSection({ title, icon, expanded, onToggle, variant = 'default', badge, children }) {
  const variantStyles = {
    default: 'border-white/30',
    primary: 'border-blue-500/30 bg-blue-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    success: 'border-emerald-500/30 bg-emerald-500/5',
    accent: 'border-cyan-500/30 bg-cyan-500/5',
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${variantStyles[variant]}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-slate-900">{title}</span>
          {badge !== undefined && (
            <Badge variant="primary" size="sm">{badge}</Badge>
          )}
        </div>
        <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-white/30">
          {children}
        </div>
      )}
    </div>
  )
}

function CompatibilityBadge({ percent }) {
  let variant = 'success'
  if (percent < 50) variant = 'danger'
  else if (percent < 80) variant = 'warning'

  return (
    <Badge variant={variant}>
      {percent}% compatible
    </Badge>
  )
}

function getStatusVariant(status) {
  const variants = {
    submitted: 'warning',
    approved: 'success',
    processing: 'info',
    dispatched: 'primary',
    rejected: 'danger',
    closed: 'ghost',
    draft: 'ghost',
  }
  return variants[status] || 'ghost'
}
