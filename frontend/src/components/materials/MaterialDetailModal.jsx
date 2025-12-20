/**
 * MaterialDetailModal - Modal showing detailed material information
 * Displays stock, MRP parameters, and consumption history
 */
import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useI18n } from '../../context/i18n'
import { formatCurrency, formatAlmacen } from '../../utils/formatters'
import { ChevronDown, ChevronRight } from '../ui/Icons'

/**
 * InfoRow - Key-value display row
 */
function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--fg-muted)]">{label}</span>
      <span className="font-semibold text-[var(--fg-strong)]">{value}</span>
    </div>
  )
}

/**
 * StockList - List of stock details by location
 */
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
          Centro {r.centro || 'N/D'} / Almacen {formatAlmacen(r.almacen_consultado || r.almacen)}
          {r.lote ? ` / Lote ${r.lote}` : ''} / Stock {r.stock ?? r.cantidad ?? 'N/D'}
        </div>
      ))}
    </div>
  )
}

export function MaterialDetailModal({
  isOpen,
  onClose,
  selectedMaterial,
  detail,
  loadingDetail,
  contextoCentro,
  contextoAlmacen,
  showStockFull,
  setShowStockFull,
}) {
  const { t } = useI18n()
  const [showStockDetalle, setShowStockDetalle] = useState(false)

  if (!selectedMaterial) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${selectedMaterial.codigo} — ${selectedMaterial.descripcion}`}
      size="xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Descripcion larga */}
          <div className="p-4 bg-[var(--bg-soft)] border border-[var(--border)] rounded-lg">
            <p className="text-xs uppercase font-semibold text-[var(--fg-muted)] mb-2">
              {t('materials_desc_larga', 'Descripcion larga')}
            </p>
            <p className="text-[var(--fg)]">
              {selectedMaterial.descripcion_larga || 'N/D'}
            </p>
          </div>

          {/* Info general */}
          <div className="p-4 bg-[var(--bg-soft)] border border-[var(--border)] rounded-lg space-y-2">
            <InfoRow
              label={t('materials_unidad', 'Unidad')}
              value={selectedMaterial.unidad_medida || selectedMaterial.unidad || 'N/D'}
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
              label={t('materials_almacen', 'Almacen consultado')}
              value={detail?.almacen_consultado || contextoAlmacen || 'N/D'}
            />
            <InfoRow
              label={t('materials_stock', 'Stock (centro/almacen)')}
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

            {/* Stock detallado - Colapsable */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowStockDetalle((v) => !v)}
                className="flex items-center gap-1 text-xs uppercase font-semibold text-[var(--fg-muted)] hover:text-[var(--accent)] transition-colors cursor-pointer"
              >
                {showStockDetalle ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                {t('materials_stock_detalle', 'Stock detallado (centro)')}
                <span className="ml-1 text-[var(--accent)]">
                  ({(detail?.stock_detalle?.length || 0)})
                </span>
              </button>
              {showStockDetalle && (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MRP */}
          <div className="p-4 bg-[var(--warning-bg)] border border-[var(--warning-border)] rounded-lg space-y-2">
            <p className="text-xs uppercase font-semibold text-[var(--fg-muted)] mb-2">
              {t('materials_mrp', 'MRP / Reposicion automatica')}
            </p>
            <InfoRow
              label={t('materials_planificado_mrp', 'Planificado MRP')}
              value={detail?.mrp?.planificado_mrp ? 'Si' : 'No'}
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
              label={t('materials_stock_maximo', 'Stock maximo')}
              value={detail?.mrp?.stock_maximo ?? 'N/D'}
            />
          </div>

          {/* Consumo historico */}
          <div className="p-4 bg-[var(--info-bg)] border border-[var(--info-border)] rounded-lg space-y-2">
            <p className="text-xs uppercase font-semibold text-[var(--fg-muted)] mb-2">
              {t('materials_consumo', 'Consumo historico')}
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
              label={t('materials_rango_anios', 'Rango anios')}
              value={
                detail?.consumo?.anio_desde
                  ? `${detail.consumo.anio_desde} - ${detail.consumo.anio_hasta}`
                  : 'N/D'
              }
            />

            {/* Ultimos consumos */}
            <div className="pt-2">
              <p className="text-xs uppercase font-semibold text-[var(--fg-muted)] mb-1">
                {t('materials_ultimos_consumos', 'Ultimos consumos')}
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
    </Modal>
  )
}
