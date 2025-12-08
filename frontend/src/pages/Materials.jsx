/**
 * Materials Page - Add materials to a request
 *
 * This page has been refactored into:
 * - useMaterials hook: State management and handlers
 * - MaterialDetailModal: Detail modal component
 * - MaterialsTable: Table of added items
 * - SearchDropdown: Search results dropdown
 */
import { Link } from 'react-router-dom'
import { useMaterials } from '../hooks/useMaterials'
import { formatCurrency } from '../utils/formatters'
import { useI18n } from '../context/i18n'
import { renderSector } from '../constants/sectores'

// UI Components
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Alert } from '../components/ui/Alert'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { ScrollReveal } from '../components/ui/ScrollReveal'
import { Loader2, Check, X, Sparkles, Eye } from 'lucide-react'

// Material-specific components
import { MaterialDetailModal, MaterialsTable, SearchDropdown } from '../components/materials'
import { AssistantModal } from '../components/AssistantModal'

export default function Materials() {
  const { t } = useI18n()

  // Get all state and handlers from custom hook
  const m = useMaterials()

  // ═══════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════

  if (m.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('materials_title', 'Agregar Materiales')} />
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton rows={5} columns={6} />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <ScrollReveal>
        <PageHeader
          title={t('materials_title', 'Agregar Materiales')}
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
      </ScrollReveal>

      {/* Messages */}
      {m.error && (
        <Alert variant="danger" onDismiss={() => m.setError('')}>
          {m.error}
        </Alert>
      )}
      {m.actionMsg && (
        <Alert variant="success" onDismiss={() => m.setActionMsg('')}>
          {m.actionMsg}
        </Alert>
      )}

      {/* Search and Context Section */}
      <ScrollReveal delay={100}>
        <Card hover={false}>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Search */}
              <SearchSection m={m} t={t} />

              {/* Center: Selected Material */}
              <SelectedMaterialSection m={m} t={t} />

              {/* Right: Context Info */}
              <ContextSection m={m} t={t} />
            </div>
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* Materials Summary Section */}
      <ScrollReveal delay={200}>
        <Card hover={false}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle>{t('materials_resumen', 'Resumen de Materiales')}</CardTitle>
              {m.items.length > 0 && (
                <Badge variant="primary">
                  {m.items.length} {m.items.length === 1 ? t('common_item', 'item') : t('common_items', 'items')}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <MaterialsTable
              items={m.itemsSorted}
              onQtyChange={m.handleQtyChange}
              onDelete={m.handleDelete}
              onOpenComment={m.handleOpenComment}
            />

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-end mt-6 pt-4 border-t border-white/30">
              <Button
                variant="ghost"
                onClick={m.handleCancelar}
                disabled={m.submitting || m.savingDraft}
                className="hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              >
                {t('materials_cancelar_solicitud', 'Cancelar Solicitud')}
              </Button>
              <Button
                variant="secondary"
                onClick={m.handleSaveDraft}
                disabled={m.items.length === 0 || m.savingDraft || m.submitting}
              >
                {m.savingDraft
                  ? t('materials_guardando', 'Guardando...')
                  : t('materials_guardar_borrador', 'Guardar como borrador')}
              </Button>
              <Button
                onClick={m.handleFinalizar}
                disabled={m.items.length === 0 || m.submitting || m.savingDraft}
              >
                {m.submitting
                  ? t('materials_enviando', 'Enviando...')
                  : t('materials_enviar', 'Enviar Solicitud')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* Material Detail Modal */}
      <MaterialDetailModal
        isOpen={m.showDetailModal}
        onClose={m.closeDetailModal}
        selectedMaterial={m.selectedMaterial}
        detail={m.detail}
        loadingDetail={m.loadingDetail}
        contextoCentro={m.contextoCentro}
        contextoAlmacen={m.contextoAlmacen}
        showStockFull={m.showStockFull}
        setShowStockFull={m.setShowStockFull}
      />

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={m.showCancelModal}
        onClose={() => m.setShowCancelModal(false)}
        onConfirm={m.confirmCancelar}
        title={t('materials_cancelar_titulo', 'Cancelar Solicitud')}
        description={t('materials_cancelar_confirm', 'Se borraran todos los datos ingresados. Continuar?')}
        confirmText={t('common_confirmar', 'Confirmar')}
        cancelText={t('common_cancelar', 'Cancelar')}
        variant="warning"
      />

      {/* Submit Confirmation Modal */}
      <ConfirmModal
        isOpen={m.showSubmitModal}
        onClose={() => m.setShowSubmitModal(false)}
        onConfirm={m.confirmFinalizar}
        title={t('materials_enviar_titulo', 'Enviar Solicitud')}
        description={t(
          'materials_enviar_confirm',
          `Confirmas el envio de la solicitud con ${m.items.length} material(es) por un total de ${formatCurrency(m.total)}?`
        )}
        confirmText={t('materials_enviar_btn', 'Si, enviar solicitud')}
        cancelText={t('common_cancelar', 'Cancelar')}
        variant="info"
        loading={m.submitting}
      />

      {/* Comment Modal */}
      <Modal
        isOpen={m.commentModal.open}
        onClose={m.closeCommentModal}
        title={t('materials_nota_titulo', 'Nota para el material')}
        size="md"
      >
        <div className="space-y-4">
          {m.commentModal.codigo && (
            <p className="text-sm text-slate-500">
              {t('materials_nota_para', 'Material:')} <span className="font-mono font-semibold text-slate-800">{m.commentModal.codigo}</span>
            </p>
          )}
          <div className="space-y-1.5">
            <label
              htmlFor="commentInput"
              className="text-xs uppercase font-semibold tracking-wider text-slate-500"
            >
              {t('materials_nota_label_input', 'Comentario / Nota')}
            </label>
            <textarea
              id="commentInput"
              value={m.commentModal.comment}
              onChange={(e) => m.updateCommentText(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/50 backdrop-blur-sm border border-white/50 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400/50 outline-none transition-all resize-none"
              rows={4}
              placeholder={t('materials_nota_placeholder', 'Escribe una nota o comentario para este material...')}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={m.closeCommentModal}>
              {t('common_cancelar', 'Cancelar')}
            </Button>
            <Button onClick={m.handleSaveComment}>
              {t('materials_nota_guardar', 'Guardar nota')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Search Dropdown */}
      <SearchDropdown
        dropdownRef={m.dropdownRef}
        dropdownOpen={m.dropdownOpen}
        dropdownPosition={m.dropdownPosition}
        results={m.results}
        loadingSearch={m.loadingSearch}
        selectedMaterial={m.selectedMaterial}
        highlightedIndex={m.highlightedIndex}
        debouncedCodigo={m.debouncedCodigo}
        debouncedDesc={m.debouncedDesc}
        onSelect={m.handleSelect}
        onClose={() => m.setDropdownOpen(false)}
        setHighlightedIndex={m.setHighlightedIndex}
      />

      {/* Assistant Modal for AI-powered material creation */}
      <AssistantModal
        isOpen={m.showAssistant}
        onClose={() => m.setShowAssistant(false)}
        onUseSuggestions={(suggestions) => {
          m.handleAddSuggestedItems(suggestions.items)
        }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS (inline for simplicity)
// ═══════════════════════════════════════════════════════════════════════════

function SearchSection({ m, t }) {
  return (
    <div ref={m.searchContainerRef} className="space-y-3">
      <div className="flex items-center gap-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {t('materials_buscar', 'Buscar material')}
        </p>
        <button
          type="button"
          onClick={() => m.setShowAssistant && m.setShowAssistant(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider text-amber-700 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/60 shadow-sm hover:from-amber-100 hover:to-yellow-100 hover:border-amber-300 transition-all duration-200"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          {t('materials_asistente_ia', 'Asistente IA')}
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Codigo SAP */}
        <div className="relative w-full sm:w-36 shrink-0">
          <Input
            id="searchCodigo"
            value={m.searchCodigo}
            onChange={(e) => m.setSearchCodigo(e.target.value)}
            onKeyDown={m.handleSearchKeyDown}
            placeholder={t('materials_codigo_sap', 'Codigo SAP')}
            className="font-mono"
            aria-label={t('materials_codigo_sap', 'Codigo SAP')}
          />
        </div>
        {/* Descripcion */}
        <div className="relative flex-1 sm:max-w-sm">
          <div className="relative">
            <Input
              id="searchDesc"
              value={m.searchDesc}
              onChange={(e) => m.setSearchDesc(e.target.value)}
              onKeyDown={m.handleSearchKeyDown}
              placeholder={t('materials_buscar_desc', 'Buscar por descripcion...')}
              aria-label={t('materials_descripcion', 'Descripcion')}
            />
            {/* Indicators */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {m.loadingSearch && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              )}
              {!m.loadingSearch && m.results.length > 0 && (
                <span className="text-xs text-slate-500 bg-slate-100/70 px-1.5 py-0.5 rounded">
                  {m.results.length}
                </span>
              )}
              {(m.searchCodigo || m.searchDesc) && (
                <button
                  type="button"
                  onClick={m.handleClearSearch}
                  className="p-0.5 hover:bg-white/70 rounded transition-colors"
                  aria-label={t('materials_limpiar_busqueda', 'Limpiar busqueda')}
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Results indicator */}
      {(m.searchCodigo || m.searchDesc) && !m.loadingSearch && m.results.length > 0 && (
        <p className="text-xs text-slate-500">
          {m.results.length} {m.results.length === 1 ? t('common_resultado', 'resultado') : t('common_resultados', 'resultados')}
          <span className="opacity-60"> — {t('materials_selecciona_uno', 'selecciona uno')}</span>
        </p>
      )}
    </div>
  )
}

function SelectedMaterialSection({ m, t }) {
  return (
    <div className="flex flex-col">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        {t('materials_selected', 'Material seleccionado')}
      </p>
      {m.selectedMaterial ? (
        <div className="p-3 bg-slate-50/70 backdrop-blur-sm border border-blue-200/50 rounded-lg flex-1">
          <div className="flex items-center gap-2 mb-2">
            {m.detailViewed && <Check className="h-4 w-4 text-emerald-600" />}
            <span className="font-mono text-sm text-blue-600 font-medium">
              {m.selectedMaterial.codigo}
            </span>
          </div>
          <p className="text-sm text-slate-800 font-medium mb-1 line-clamp-2">
            {m.selectedMaterial.descripcion}
          </p>
          {m.selectedMaterial.precio_usd > 0 && (
            <p className="text-sm text-slate-500">
              {t('materials_precio', 'Precio')}: <span className="font-mono font-medium">{formatCurrency(m.selectedMaterial.precio_usd)}</span>
            </p>
          )}
          {!m.detailViewed && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              {t('materials_view_detail_first', 'Ver detalles antes de agregar')}
            </p>
          )}
          {/* Actions */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/50">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={m.openDetailModal}
              disabled={m.loadingDetail}
            >
              {m.loadingDetail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  {t('materials_mas_detalles', 'Ver detalles')}
                </>
              )}
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={m.handleAdd}
              disabled={!m.detailViewed}
            >
              {t('materials_agregar', 'Agregar')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 border border-dashed border-slate-300/50 rounded-lg flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-500 text-center">
            {t('materials_busca_selecciona', 'Busca y selecciona un material')}
          </p>
        </div>
      )}
    </div>
  )
}

function ContextSection({ m, t }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        {t('materials_contexto', 'Contexto')}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <span className="text-slate-500">{t('common_solicitud', 'Solicitud')}</span>
          <p className="font-semibold text-slate-800">#{m.id}</p>
        </div>
        <div>
          <span className="text-slate-500">{t('common_centro', 'Centro')}</span>
          <p className="font-semibold text-slate-800">{m.sol?.centro || '—'}</p>
        </div>
        <div>
          <span className="text-slate-500">{t('common_sector', 'Sector')}</span>
          <p className="font-semibold text-slate-800">{renderSector(m.sol) || '—'}</p>
        </div>
        <div>
          <span className="text-slate-500">{t('common_almacen', 'Almacen')}</span>
          <p className="font-semibold text-slate-800">{m.sol?.almacen_virtual || '—'}</p>
        </div>
        <div className="col-span-2 pt-2 mt-2 border-t border-white/30">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-slate-500">{t('common_total', 'Total')}</span>
              <p className="font-bold text-lg text-slate-800 font-mono">{formatCurrency(m.total)}</p>
            </div>
            {m.presupuesto && (
              <div className="text-right">
                <span className="text-slate-500">{t('materials_saldo_disponible', 'Saldo disponible')}</span>
                <p className={`font-semibold font-mono ${m.presupuestoInsuf ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatCurrency(m.presupuesto.saldo_usd || 0)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
