import { memo } from "react";
import { ScrollReveal } from "../../components/ui/ScrollReveal";
import { FONT_SIZES } from '../../components/ui/SPMChartJS';
import MrpAlertsCard from './MrpAlertsCard';
import { useI18n } from '../../context/i18n';
// MUI Components
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

/**
 * KPIRow3 - Third row: Materiales Mas Solicitados, Stock Inmovilizado Global,
 * Stock Inmovilizado with local filters
 */
function KPIRow3({
  datosFiltrados,
  stockInmovilizadoFiltrado,
  kpiLoading,
  // Resumen data for MRP alerts
  resumen,
  // Drill-down handler
  onKpiDrillDown,
}) {
  const { t } = useI18n();
  return (
    <ScrollReveal delay={300}>
      <Stack direction="row" flexWrap="wrap" gap={1.5}>

        {/* Materiales Mas Solicitados - Lista simple top 10 */}
        {(() => {
          const materialesCount = {};
          datosFiltrados.forEach(s => {
            (s.items || []).forEach(item => {
              const codigo = item.material || item.codigo || item.codigo_sap || '';
              const nombre = item.descripcion || item.nombre || item.material_nombre || `Material ${item.material_id || codigo}`;
              const cantidad = item.cantidad || 1;
              const precio = item.precio_usd || item.precio_unitario || item.precio || item.precio_estimado || 0;
              const subtotal = item.subtotal || (cantidad * precio);
              const key = codigo || nombre;
              if (!materialesCount[key]) {
                materialesCount[key] = { codigo, nombre, cantidad: 0, monto: 0, precioUnitario: precio };
              }
              materialesCount[key].cantidad += cantidad;
              materialesCount[key].monto += subtotal;
              if (precio > materialesCount[key].precioUnitario) {
                materialesCount[key].precioUnitario = precio;
              }
            });
          });

          const materialesList = Object.values(materialesCount)
            .sort((a, b) => b.monto - a.monto)
            .slice(0, 10);

          const hayMontos = materialesList.some(m => m.monto > 0);

          const formatMonto = (val) => {
            if (val >= 1000000) return `MUSD ${(val / 1000000).toFixed(2).replace('.', ',')}`;
            if (val >= 1000) return `KUSD ${(val / 1000).toFixed(2).replace('.', ',')}`;
            return `USD ${Number(val).toFixed(2).replace('.', ',')}`;
          };

          return (
            <Paper
              elevation={0}
              onClick={() => onKpiDrillDown?.('materiales_top')}
              sx={{
                flex: 1,
                bgcolor: 'var(--surface)',
                border: '1px solid',
                borderColor: 'divider',
                cursor: onKpiDrillDown ? 'pointer' : 'default',
                transition: 'box-shadow 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                },
              }}
            >
              <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                  {t('dash_materiales_solicitados', 'Materiales Más Solicitados')}
                </Typography>
              </Box>
              <Box sx={{ px: 2, pb: 2 }}>
                <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid', borderColor: 'grey.200' } }}>
                  {materialesList.length > 0 ? (
                    materialesList.map((material, idx) => (
                      <Stack
                        key={idx}
                        direction="row"
                        alignItems="center"
                        gap={1}
                        sx={{
                          py: 0.75,
                          px: 0.5,
                          mx: -0.5,
                          '&:hover': { bgcolor: 'grey.50' },
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'grey.400', width: 16, fontSize: FONT_SIZES.xs }}>{idx + 1}.</Typography>
                        <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace' }}>{material.codigo || '-'}</Typography>
                        <Tooltip title={`${material.nombre}${material.codigo ? ` (${material.codigo})` : ''} — Cant: ${Math.round(material.cantidad)}${material.monto > 0 ? ` — USD ${material.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : ''}`} arrow placement="top">
                          <Typography variant="caption" sx={{ color: 'grey.700', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {material.nombre}
                          </Typography>
                        </Tooltip>
                        <Typography variant="caption" sx={{ color: 'grey.600', fontWeight: 600, width: 48, textAlign: 'right' }}>{Math.round(material.cantidad)}</Typography>
                        {hayMontos && (
                          <Tooltip title={`USD ${material.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} arrow>
                            <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace', width: 112, textAlign: 'right' }}>{formatMonto(material.monto)}</Typography>
                          </Tooltip>
                        )}
                      </Stack>
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 2, display: 'block' }}>{t('common_sin_datos', 'No hay datos')}</Typography>
                  )}
                </Box>
              </Box>
            </Paper>
          );
        })()}

        {/* Stock Inmovilizado Global - Lista top 10 */}
        {(() => {
          const formatMontoStock = (val) => {
            if (val >= 1000000) return `MUSD ${(val / 1000000).toFixed(2).replace('.', ',')}`;
            if (val >= 1000) return `KUSD ${(val / 1000).toFixed(2).replace('.', ',')}`;
            return `USD ${Number(val || 0).toFixed(2).replace('.', ',')}`;
          };

          const hayMontosStock = stockInmovilizadoFiltrado.items.some(item => (item.valor || 0) > 0);

          return (
            <Paper
              elevation={0}
              onClick={() => onKpiDrillDown?.('stock_critico')}
              sx={{
                flex: 1,
                bgcolor: 'var(--surface)',
                border: '1px solid',
                borderColor: 'divider',
                cursor: onKpiDrillDown ? 'pointer' : 'default',
                transition: 'box-shadow 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                },
              }}
            >
              <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                  {t('dash_stock_inmovilizado', 'Stock Inmovilizado Global')}
                </Typography>
              </Box>
              <Box sx={{ px: 2, pb: 2 }}>
                <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid', borderColor: 'grey.200' } }}>
                  {stockInmovilizadoFiltrado.items.length > 0 ? (
                    stockInmovilizadoFiltrado.items.map((item, idx) => (
                      <Stack
                        key={idx}
                        direction="row"
                        alignItems="center"
                        gap={1}
                        sx={{
                          py: 0.75,
                          px: 0.5,
                          mx: -0.5,
                          '&:hover': { bgcolor: 'grey.50' },
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'grey.400', width: 16, fontSize: FONT_SIZES.xs }}>{idx + 1}.</Typography>
                        <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace' }}>{item.codigo || '-'}</Typography>
                        <Tooltip title={`${item.descripcion}${item.codigo ? ` (${item.codigo})` : ''}${item.lote ? ` — Lote: ${item.lote}` : ''} — Stock: ${Math.round(item.stock || 0)}${(item.valor || 0) > 0 ? ` — USD ${(item.valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : ''}`} arrow placement="top">
                          <Typography variant="caption" sx={{ color: 'grey.700', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.descripcion}
                          </Typography>
                        </Tooltip>
                        <Typography variant="caption" sx={{ color: 'grey.600', fontWeight: 600, width: 48, textAlign: 'right' }}>{Math.round(item.stock || 0)}</Typography>
                        {hayMontosStock && (
                          <Tooltip title={`USD ${(item.valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} arrow>
                            <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace', width: 112, textAlign: 'right' }}>{formatMontoStock(item.valor || 0)}</Typography>
                          </Tooltip>
                        )}
                      </Stack>
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 2, display: 'block' }}>
                      {kpiLoading ? t('common_cargando', 'Cargando...') : t('common_sin_datos', 'No hay stock inmovilizado disponible')}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Paper>
          );
        })()}

        {/* Alertas MRP */}
        <MrpAlertsCard resumen={resumen} onKpiDrillDown={onKpiDrillDown} />

      </Stack>
    </ScrollReveal>
  );
}

export default memo(KPIRow3);
