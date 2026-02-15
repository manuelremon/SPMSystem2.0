import { memo } from "react";
import { ScrollReveal } from "../../components/ui/ScrollReveal";
import { FONT_SIZES } from '../../components/ui/SPMChartJS';
// MUI Components
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';

/**
 * KPIRow3 - Third row: Materiales Mas Solicitados, Stock Inmovilizado Global,
 * Stock Inmovilizado with local filters
 */
function KPIRow3({
  datosFiltrados,
  stockInmovilizadoFiltrado,
  kpiLoading,
  // Stock filtrado local
  stockFiltradoLocal,
  stockFiltrosCentro,
  setStockFiltrosCentro,
  stockFiltrosAlmacen,
  setStockFiltrosAlmacen,
  stockFiltrosPeriodo,
  setStockFiltrosPeriodo,
  filtrosOpciones,
  // Drill-down handler
  onKpiDrillDown,
}) {
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
            return `USD ${val.toFixed(2).replace('.', ',')}`;
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
                borderRadius: 2,
                cursor: onKpiDrillDown ? 'pointer' : 'default',
                transition: 'box-shadow 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                },
              }}
            >
              <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                  {`Materiales M\u00e1s Solicitados`}
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
                        <Typography variant="caption" sx={{ color: 'grey.700', flex: 1 }}>
                          {material.nombre}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'grey.600', fontWeight: 600, width: 48, textAlign: 'right' }}>{Math.round(material.cantidad)}</Typography>
                        {hayMontos && (
                          <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace', width: 112, textAlign: 'right' }}>{formatMonto(material.monto)}</Typography>
                        )}
                      </Stack>
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 2, display: 'block' }}>No hay datos</Typography>
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
            return `USD ${(val || 0).toFixed(2).replace('.', ',')}`;
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
                borderRadius: 2,
                cursor: onKpiDrillDown ? 'pointer' : 'default',
                transition: 'box-shadow 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                },
              }}
            >
              <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                  Stock Inmovilizado Global
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
                        <Typography variant="caption" sx={{ color: 'grey.700', flex: 1 }}>
                          {item.descripcion}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'grey.600', fontWeight: 600, width: 48, textAlign: 'right' }}>{Math.round(item.stock || 0)}</Typography>
                        {hayMontosStock && (
                          <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace', width: 112, textAlign: 'right' }}>{formatMontoStock(item.valor || 0)}</Typography>
                        )}
                      </Stack>
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 2, display: 'block' }}>
                      {kpiLoading ? 'Cargando...' : 'No hay stock inmovilizado disponible'}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Paper>
          );
        })()}

        {/* Stock Inmovilizado con Filtros - Nueva card */}
        {(() => {
          const formatMontoStock = (val) => {
            if (val >= 1000000) return `MUSD ${(val / 1000000).toFixed(2).replace('.', ',')}`;
            if (val >= 1000) return `KUSD ${(val / 1000).toFixed(2).replace('.', ',')}`;
            return `USD ${(val || 0).toFixed(2).replace('.', ',')}`;
          };

          const hayMontosStock = stockFiltradoLocal.items.some(item => (item.valor || 0) > 0);

          return (
            <Paper
              elevation={0}
              sx={{
                flex: 1,
                bgcolor: 'var(--surface)',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'box-shadow 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                },
              }}
            >
              <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                  Stock Inmovilizado
                </Typography>
                {/* Filtros MUI */}
                <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel id="stock-centro-label" sx={{ fontSize: '0.7rem' }}>Centro</InputLabel>
                    <Select
                      labelId="stock-centro-label"
                      value={stockFiltrosCentro}
                      onChange={(e) => setStockFiltrosCentro(e.target.value)}
                      input={<OutlinedInput label="Centro" />}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      <MenuItem value=""><em>Todos</em></MenuItem>
                      {filtrosOpciones.centros.map((centro) => (
                        <MenuItem key={centro} value={centro} sx={{ fontSize: FONT_SIZES.md }}>{centro}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel id="stock-almacen-label" sx={{ fontSize: '0.7rem' }}>Almacen</InputLabel>
                    <Select
                      labelId="stock-almacen-label"
                      value={stockFiltrosAlmacen}
                      onChange={(e) => setStockFiltrosAlmacen(e.target.value)}
                      input={<OutlinedInput label="Almacen" />}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      <MenuItem value=""><em>Todos</em></MenuItem>
                      {filtrosOpciones.almacenes.map((almacen) => (
                        <MenuItem key={almacen} value={almacen} sx={{ fontSize: FONT_SIZES.md }}>{almacen}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id="stock-periodo-label" sx={{ fontSize: '0.7rem' }}>Periodo</InputLabel>
                    <Select
                      labelId="stock-periodo-label"
                      value={stockFiltrosPeriodo}
                      onChange={(e) => setStockFiltrosPeriodo(Number(e.target.value))}
                      input={<OutlinedInput label="Periodo" />}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      <MenuItem value={1} sx={{ fontSize: FONT_SIZES.md }}>1 a\u00f1o sin consumo</MenuItem>
                      <MenuItem value={2} sx={{ fontSize: FONT_SIZES.md }}>2 a\u00f1os sin consumo</MenuItem>
                      <MenuItem value={3} sx={{ fontSize: FONT_SIZES.md }}>3 a\u00f1os sin consumo</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Box>
              <Box sx={{ px: 2, pb: 2 }}>
                <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid', borderColor: 'grey.200' } }}>
                  {stockFiltradoLocal.loading ? (
                    <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 2, display: 'block' }}>Cargando...</Typography>
                  ) : stockFiltradoLocal.items.length > 0 ? (
                    [...stockFiltradoLocal.items].sort((a, b) => (b.valor || 0) - (a.valor || 0)).slice(0, 10).map((item, idx) => (
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
                        <Typography variant="caption" sx={{ color: 'grey.700', flex: 1 }}>
                          {item.descripcion}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'grey.600', fontWeight: 600, width: 48, textAlign: 'right' }}>{Math.round(item.stock || 0)}</Typography>
                        {hayMontosStock && (
                          <Typography variant="caption" sx={{ color: 'grey.600', fontFamily: 'monospace', width: 112, textAlign: 'right' }}>{formatMontoStock(item.valor || 0)}</Typography>
                        )}
                      </Stack>
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ color: 'grey.500', textAlign: 'center', py: 2, display: 'block' }}>
                      No hay stock inmovilizado con estos filtros
                    </Typography>
                  )}
                </Box>
              </Box>
            </Paper>
          );
        })()}

      </Stack>
    </ScrollReveal>
  );
}

export default memo(KPIRow3);
