/**
 * MaterialDetailModal - Modal showing detailed material information
 * Displays stock, MRP parameters, and consumption history
 *
 * Migrated to MUI (2026-02)
 */
import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useI18n } from '../../context/i18n'
import { formatCurrency, formatAlmacen } from '../../utils/formatters'
import {
  Box,
  Typography,
  Paper,
  Stack,
  Collapse,
  Button,
  Divider,
  Grid,
  Tooltip,
} from '@mui/material'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

/**
 * InfoRow - Key-value display row
 */
function InfoRow({ label, value, tooltip }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ typography: 'body2' }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        {tooltip && (
          <Tooltip title={tooltip}>
            <HelpOutlineIcon
              sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }}
            />
          </Tooltip>
        )}
      </Stack>
      <Typography variant="body2" fontWeight={600} color="text.primary">
        {value}
      </Typography>
    </Stack>
  )
}

/**
 * StockList - List of stock details by location
 */
function StockList({ rows = [], compact = false }) {
  if (!rows || rows.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        Sin stock registrado
      </Typography>
    )
  }

  return (
    <Stack spacing={0.5} sx={{ mt: compact ? 0.5 : 1 }}>
      {rows.map((r, idx) => (
        <Paper
          key={idx}
          variant="outlined"
          sx={{
            px: 1,
            py: 0.5,
            borderStyle: 'dashed',
          }}
        >
          <Typography variant="caption" color="text.primary">
            Centro {r.centro || 'N/D'} / Almacén {formatAlmacen(r.almacen_consultado || r.almacen)}
            {r.lote ? ` / Lote ${r.lote}` : ''} / Stock {r.stock ?? r.cantidad ?? 'N/D'}
          </Typography>
        </Paper>
      ))}
    </Stack>
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
      <Grid container spacing={2}>
        {/* Descripcion larga */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              height: '100%',
              bgcolor: 'action.hover',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                textTransform: 'uppercase',
                fontWeight: 600,
                color: 'text.secondary',
                mb: 1,
                display: 'block',
              }}
            >
              {t('materials_desc_larga', 'Descripción larga')}
            </Typography>
            <Typography variant="body2" color="text.primary">
              {selectedMaterial.descripcion_larga || 'N/D'}
            </Typography>
          </Paper>
        </Grid>

        {/* Info general */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              height: '100%',
              bgcolor: 'action.hover',
            }}
          >
            <Stack spacing={1}>
              <InfoRow
                label={t('materials_unidad', 'Unidad de medida')}
                value={selectedMaterial.unidad_medida || selectedMaterial.unidad || 'N/D'}
              />
              <InfoRow
                label={t('materials_precio_usd', 'Precio')}
                value={
                  selectedMaterial.precio_usd == null
                    ? t('materials_sin_precio', 'Sin precio')
                    : formatCurrency(selectedMaterial.precio_usd)
                }
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
                tooltip={t('materials_pedidos_tt', 'Pedidos de compra a proveedor ya emitidos y pendientes de recepción')}
              />
              <InfoRow
                label={t('materials_spm_en_curso', 'Solicitudes SPM en curso')}
                value="N/D"
                tooltip={t('materials_spm_en_curso_tt', 'Solicitudes de este material que ya están en trámite dentro del sistema')}
              />

              {/* Stock detallado - Colapsable */}
              <Box sx={{ pt: 1 }}>
                <Button
                  size="small"
                  onClick={() => setShowStockDetalle((v) => !v)}
                  startIcon={showStockDetalle ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                  sx={{
                    textTransform: 'uppercase',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'text.secondary',
                    p: 0,
                    minWidth: 'auto',
                    '&:hover': {
                      bgcolor: 'transparent',
                      color: 'primary.main',
                    },
                  }}
                >
                  {t('materials_stock_detalle', 'Stock detallado (centro)')}
                  <Typography
                    component="span"
                    sx={{ ml: 0.5, color: 'primary.main', fontSize: 'inherit' }}
                  >
                    ({(detail?.stock_detalle?.length || 0)})
                  </Typography>
                </Button>
                <Collapse in={showStockDetalle}>
                  <StockList rows={detail?.stock_detalle || []} />
                  {(detail?.stock_detalle_full?.length || 0) > (detail?.stock_detalle?.length || 0) && (
                    <Button
                      size="small"
                      onClick={() => setShowStockFull((v) => !v)}
                      sx={{
                        mt: 1,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        p: 0,
                        minWidth: 'auto',
                      }}
                    >
                      {showStockFull
                        ? t('materials_ocultar_stock', 'Ocultar stock interno completo')
                        : t('materials_ver_stock', 'Ver stock interno completo (+)')}
                    </Button>
                  )}
                  {showStockFull && <StockList rows={detail?.stock_detalle_full || []} compact />}
                </Collapse>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* MRP */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              height: '100%',
              bgcolor: 'warning.lighter',
              borderColor: 'warning.light',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                textTransform: 'uppercase',
                fontWeight: 600,
                color: 'text.secondary',
                mb: 1,
                display: 'block',
              }}
            >
              {t('materials_mrp', 'MRP / Reposición automática')}
            </Typography>
            <Stack spacing={1}>
              <InfoRow
                label={t('materials_planificado_mrp', 'Planificado MRP')}
                value={detail?.mrp?.planificado_mrp ? 'Si' : 'No'}
                tooltip={t('materials_planificado_mrp_tt', 'Indica si el material se repone automáticamente mediante el sistema MRP')}
              />
              <InfoRow
                label={t('materials_sector', 'Sector')}
                value={detail?.mrp?.sector || 'N/D'}
              />
              <InfoRow
                label={t('materials_stock_seguridad', 'Stock de seguridad')}
                value={detail?.mrp?.stock_seguridad ?? 'N/D'}
                tooltip={t('materials_stock_seguridad_tt', 'Cantidad mínima que se mantiene en reserva para cubrir imprevistos de demanda o suministro')}
              />
              <InfoRow
                label={t('materials_punto_pedido', 'Punto de pedido')}
                value={detail?.mrp?.punto_pedido ?? 'N/D'}
                tooltip={t('materials_punto_pedido_tt', 'Nivel de stock que dispara una nueva orden de reposición automática')}
              />
              <InfoRow
                label={t('materials_stock_maximo', 'Stock máximo')}
                value={detail?.mrp?.stock_maximo ?? 'N/D'}
                tooltip={t('materials_stock_maximo_tt', 'Cantidad máxima a almacenar; la reposición no supera este nivel')}
              />
            </Stack>
          </Paper>
        </Grid>

        {/* Consumo historico */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              height: '100%',
              bgcolor: 'info.lighter',
              borderColor: 'info.light',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                textTransform: 'uppercase',
                fontWeight: 600,
                color: 'text.secondary',
                mb: 1,
                display: 'block',
              }}
            >
              {t('materials_consumo', 'Consumo histórico')}
            </Typography>
            <Stack spacing={1}>
              <InfoRow
                label={t('materials_total_consumo', 'Total consumo')}
                value={
                  detail?.consumo?.total?.toFixed
                    ? detail.consumo.total.toFixed(0)
                    : 'N/D'
                }
                tooltip={t('materials_total_consumo_tt', 'Consumo acumulado del material en todo el rango de años disponible')}
              />
              <InfoRow
                label={t('materials_promedio_anual', 'Promedio anual')}
                value={
                  detail?.consumo?.promedio_anual?.toFixed
                    ? detail.consumo.promedio_anual.toFixed(0)
                    : 'N/D'
                }
                tooltip={t('materials_promedio_anual_tt', 'Consumo medio por año; útil para estimar la demanda futura')}
              />
              <InfoRow
                label={t('materials_rango_anios', 'Rango de años')}
                value={
                  detail?.consumo?.anio_desde
                    ? `${detail.consumo.anio_desde} - ${detail.consumo.anio_hasta}`
                    : 'N/D'
                }
              />

              {/* Ultimos consumos */}
              <Box sx={{ pt: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    color: 'text.secondary',
                    mb: 0.5,
                    display: 'block',
                  }}
                >
                  {t('materials_ultimos_consumos', 'Últimos consumos')}
                </Typography>
                {(detail?.consumo?.registros || []).length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    {t('materials_sin_registros', 'Sin registros')}
                  </Typography>
                ) : (
                  <Stack spacing={0.5}>
                    {(detail?.consumo?.registros || []).map((r, idx) => (
                      <Stack
                        key={idx}
                        direction="row"
                        justifyContent="space-between"
                      >
                        <Typography variant="caption" color="text.primary">
                          {r.fecha}
                        </Typography>
                        <Typography
                          variant="caption"
                          fontWeight={600}
                          
                        >
                          {r.cantidad}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Modal>
  );
}
