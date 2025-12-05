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
} from 'lucide-react'

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
        setResults(res.data || [])
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
          subtitle={t('catalogo_materiales_subtitulo', 'Busca materiales por código SAP, descripción o palabra clave')}
        />
      </ScrollReveal>

      {/* Search Card */}
      <ScrollReveal delay={100}>
        <Card hover={false}>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Código SAP */}
            <div className="lg:w-40">
              <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-2">
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
              <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-2">
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
              <label className="block text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wide mb-2">
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--bg-elevated)] rounded transition-colors"
                  >
                    <X className="h-4 w-4 text-[var(--fg-muted)]" />
                  </button>
                )}
              </div>
            </div>

            {/* Search indicator */}
            <div className="flex items-end">
              {loading ? (
                <div className="flex items-center gap-2 h-10 px-4 text-[var(--fg-muted)]">
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
              <Package className="h-5 w-5 text-[var(--primary)]" />
              {t('catalogo_resultados', 'Resultados de Búsqueda')}
            </CardTitle>
          </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : !hasSearched ? (
            <div className="py-12 text-center">
              <Search className="h-12 w-12 text-[var(--fg-muted)]/30 mx-auto mb-4" />
              <p className="text-[var(--fg-muted)]">
                {t('catalogo_instruccion', 'Ingresa un código SAP, descripción o palabra clave para buscar materiales')}
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="h-12 w-12 text-[var(--fg-muted)]/30 mx-auto mb-4" />
              <p className="text-[var(--fg-muted)]">
                {t('catalogo_sin_resultados', 'No se encontraron materiales con los criterios de búsqueda')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                      {t('catalogo_col_codigo', 'Código')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                      {t('catalogo_col_descripcion', 'Descripción')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                      {t('catalogo_col_unidad', 'Unidad')}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                      {t('catalogo_col_precio', 'Precio USD')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                      {t('catalogo_col_acciones', 'Acciones')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((mat, idx) => (
                    <tr
                      key={mat.codigo}
                      className={`
                        border-b border-[var(--border)] transition-colors cursor-pointer
                        ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[var(--bg-soft)]/30'}
                        hover:bg-[var(--bg-elevated)]
                        ${selectedMaterial?.codigo === mat.codigo ? 'ring-2 ring-inset ring-[var(--primary)]' : ''}
                      `}
                      onClick={() => loadDetail(mat)}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-[var(--primary)]">
                        {mat.codigo}
                      </td>
                      <td className="px-4 py-3 text-[var(--fg)]">
                        <p className="line-clamp-1">{mat.descripcion}</p>
                        {mat.descripcion_larga && mat.descripcion_larga !== mat.descripcion && (
                          <p className="text-xs text-[var(--fg-muted)] line-clamp-1 mt-0.5">
                            {mat.descripcion_larga}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-[var(--fg-muted)]">
                        {mat.unidad || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--fg)]">
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
                          <ChevronRight className="h-4 w-4" />
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
            <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
          </div>
        ) : selectedMaterial && (
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--bg-soft)] border border-[var(--border)] rounded-lg">
                <p className="text-xs uppercase font-semibold text-[var(--fg-muted)] mb-2">
                  {t('catalogo_desc_larga', 'Descripción larga')}
                </p>
                <p className="text-[var(--fg)]">
                  {selectedMaterial.descripcion_larga || selectedMaterial.descripcion || 'N/D'}
                </p>
              </div>
              <div className="p-4 bg-[var(--bg-soft)] border border-[var(--border)] rounded-lg space-y-2">
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
                    <p className="text-xs uppercase font-semibold text-[var(--fg-muted)] mb-2">
                      {t('catalogo_stock_por_centro', 'Desglose por Centro/Almacén')}
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {detail.stock_detalle.map((row, idx) => (
                        <div key={idx} className="text-xs p-2 bg-[var(--bg)] rounded border border-[var(--border)]">
                          <span className="font-medium">Centro {row.centro}</span> /
                          <span className="ml-1">Almacén {formatAlmacen(row.almacen_consultado || row.almacen)}</span>
                          {row.lote && <span className="ml-1">/ Lote {row.lote}</span>}
                          <span className="ml-2 font-mono font-semibold text-[var(--primary)]">
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
            >
              <div className="space-y-2">
                <InfoRow
                  label={t('catalogo_planificado_mrp', 'Planificado MRP')}
                  value={detail?.mrp?.planificado_mrp ? 'Sí' : 'No'}
                />
                <InfoRow
                  label={t('catalogo_sector', 'Sector')}
                  value={detail?.mrp?.sector || 'N/D'}
                />
                <InfoRow
                  label={t('catalogo_stock_seguridad', 'Stock Seguridad')}
                  value={detail?.mrp?.stock_seguridad ?? 'N/D'}
                />
                <InfoRow
                  label={t('catalogo_punto_pedido', 'Punto de Pedido')}
                  value={detail?.mrp?.punto_pedido ?? 'N/D'}
                />
                <InfoRow
                  label={t('catalogo_stock_maximo', 'Stock Máximo')}
                  value={detail?.mrp?.stock_maximo ?? 'N/D'}
                />
              </div>
            </CollapsibleSection>

            {/* Consumo Histórico */}
            <CollapsibleSection
              title={t('catalogo_consumo', 'Consumo Histórico')}
              icon={<TrendingUp className="h-4 w-4" />}
              expanded={expandedSections.consumo}
              onToggle={() => toggleSection('consumo')}
              variant="success"
            >
              <div className="space-y-2">
                <InfoRow
                  label={t('catalogo_total_consumo', 'Total Consumido')}
                  value={detail?.consumo?.total?.toFixed ? detail.consumo.total.toFixed(0) : 'N/D'}
                />
                <InfoRow
                  label={t('catalogo_promedio_anual', 'Promedio Anual')}
                  value={detail?.consumo?.promedio_anual?.toFixed ? detail.consumo.promedio_anual.toFixed(0) : 'N/D'}
                />
                <InfoRow
                  label={t('catalogo_rango_anios', 'Rango de Años')}
                  value={detail?.consumo?.anio_desde ? `${detail.consumo.anio_desde} - ${detail.consumo.anio_hasta}` : 'N/D'}
                />
                {(detail?.consumo?.registros?.length > 0) && (
                  <div className="mt-3">
                    <p className="text-xs uppercase font-semibold text-[var(--fg-muted)] mb-2">
                      {t('catalogo_ultimos_consumos', 'Últimos Consumos')}
                    </p>
                    <div className="space-y-1">
                      {detail.consumo.registros.map((r, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span>{r.fecha}</span>
                          <span className="font-mono font-semibold">{r.cantidad}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                <div className="flex items-center gap-2 text-[var(--fg-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t('common_cargando', 'Cargando...')}</span>
                </div>
              ) : solicitudesData.length === 0 ? (
                <p className="text-sm text-[var(--fg-muted)]">
                  {t('catalogo_sin_solicitudes', 'No hay solicitudes SPM activas para este material')}
                </p>
              ) : (
                <div className="space-y-2">
                  {solicitudesData.map((sol) => (
                    <div
                      key={sol.id}
                      className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[var(--primary)]">
                          SPM #{sol.id}
                        </span>
                        <Badge variant={getStatusVariant(sol.estado)}>
                          {sol.estado}
                        </Badge>
                      </div>
                      <div className="text-xs text-[var(--fg-muted)] space-y-0.5">
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
                <div className="flex items-center gap-2 text-[var(--fg-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t('common_cargando', 'Cargando...')}</span>
                </div>
              ) : equivalenciasData.length === 0 ? (
                <p className="text-sm text-[var(--fg-muted)]">
                  {t('catalogo_sin_equivalencias', 'No hay materiales equivalentes registrados')}
                </p>
              ) : (
                <div className="space-y-2">
                  {equivalenciasData.map((eq) => (
                    <div
                      key={eq.id || eq.codigo_equivalente}
                      className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-semibold text-[var(--accent)]">
                          {eq.codigo_equivalente}
                        </span>
                        <CompatibilityBadge percent={eq.compatibilidad_pct} />
                      </div>
                      <p className="text-sm text-[var(--fg)]">{eq.descripcion_equivalente}</p>
                      {eq.descripcion && (
                        <p className="text-xs text-[var(--fg-muted)] mt-1">{eq.descripcion}</p>
                      )}
                      {eq.precio_usd && (
                        <p className="text-xs font-mono text-[var(--fg-muted)] mt-1">
                          {formatCurrency(eq.precio_usd)}
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
      <span className="text-[var(--fg-muted)]">{label}</span>
      <span className="font-semibold text-[var(--fg-strong)]">{value}</span>
    </div>
  )
}

function CollapsibleSection({ title, icon, expanded, onToggle, variant = 'default', badge, children }) {
  const variantStyles = {
    default: 'border-[var(--border)]',
    primary: 'border-[var(--primary)]/30 bg-[var(--primary)]/5',
    info: 'border-[var(--info)]/30 bg-[var(--info)]/5',
    warning: 'border-[var(--warning)]/30 bg-[var(--warning)]/5',
    success: 'border-[var(--success)]/30 bg-[var(--success)]/5',
    accent: 'border-[var(--accent)]/30 bg-[var(--accent)]/5',
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${variantStyles[variant]}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-elevated)] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-[var(--fg-strong)]">{title}</span>
          {badge !== undefined && (
            <Badge variant="primary" size="sm">{badge}</Badge>
          )}
        </div>
        <ChevronRight className={`h-4 w-4 text-[var(--fg-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-[var(--border)]">
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
