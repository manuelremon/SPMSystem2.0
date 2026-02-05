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
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

/**
 * InfoRow - Key-value display row
 */
function InfoRow({ label, value }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ typography: 'body2' }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
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
            Centro {r.centro || 'N/D'} / Almacen {formatAlmacen(r.almacen_consultado || r.almacen)}
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
      <Stack spacing={2}>
        <Grid container spacing={2}>
          {/* Descripcion larga */}
          <Grid item xs={12} md={6}>
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
                {t('materials_desc_larga', 'Descripcion larga')}
              </Typography>
              <Typography variant="body2" color="text.primary">
                {selectedMaterial.descripcion_larga || 'N/D'}
              </Typography>
            </Paper>
          </Grid>

          {/* Info general */}
          <Grid item xs={12} md={6}>
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
        </Grid>

        <Grid container spacing={2}>
          {/* MRP */}
          <Grid item xs={12} md={6}>
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
                {t('materials_mrp', 'MRP / Reposicion automatica')}
              </Typography>
              <Stack spacing={1}>
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
              </Stack>
            </Paper>
          </Grid>

          {/* Consumo historico */}
          <Grid item xs={12} md={6}>
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
                {t('materials_consumo', 'Consumo historico')}
              </Typography>
              <Stack spacing={1}>
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
                    {t('materials_ultimos_consumos', 'Ultimos consumos')}
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
                            sx={{ fontFamily: 'monospace' }}
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
      </Stack>
    </Modal>
  )
}
