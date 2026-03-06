import { memo } from "react";
import { ScrollReveal } from "../../components/ui/ScrollReveal";
import { WeeklyRequestsKpiCard } from "../../components/dashboard/WeeklyRequestsKpiCard";
import { SPMPolarArea, SPM_COLORS, PHASE_COLORS, FONT_SIZES, TOOLTIP_CONFIG, ANIMATION_CONFIG } from '../../components/ui/SPMChartJS';
import ExpandCardButton from './ExpandCardButton';
// MUI Components
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import ListItemText from '@mui/material/ListItemText';
import Select from '@mui/material/Select';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';

// MenuProps para los multiselect
const ITEM_HEIGHT = 32;
const ITEM_PADDING_TOP = 4;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 6 + ITEM_PADDING_TOP,
      width: 160,
    },
  },
};

/**
 * KPIRow1 - First row of KPI cards: Solicitudes Creadas, Cumplimiento Proveedores,
 * Tiempos de Gestion, Fuente de Abastecimiento
 */
function KPIRow1({
  // Refs
  solicitudesCredasRef,
  tiemposGestionRef,
  fuenteAbastecimientoRef,
  // State / computed data
  datosFiltrados,
  kpiData,
  rangoFechas,
  sliderAFechaDate,
  centrosSeleccionados,
  sectoresSeleccionados,
  filtrosOpciones,
  comprasEvitadasDetalle,
  // Cumplimiento proveedores
  cumplimientoProveedores,
  proveedoresSeleccionados,
  setProveedoresSeleccionados,
  // Expand handlers
  setExpandedCard,
  setExpandedTitle,
  // Drill-down handler
  onKpiDrillDown,
}) {
  return (
    <ScrollReveal delay={100}>
      <Stack direction="row" gap={1.5} flexWrap="wrap">
        {/* Solicitudes Creadas - Sparkline */}
        {(() => {
          const fechaDesde = sliderAFechaDate(rangoFechas[0]);
          const fechaHasta = sliderAFechaDate(rangoFechas[1]);
          fechaHasta.setHours(23, 59, 59, 999);

          const diasTotales = Math.max(1, Math.ceil((fechaHasta - fechaDesde) / (1000 * 60 * 60 * 24)));
          const segmentos = 7;
          const diasPorSegmento = Math.max(1, Math.ceil(diasTotales / segmentos));

          const datosSparkline = [];
          const labelsSparkline = [];

          const formatFecha = (date) => {
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yy = String(date.getFullYear()).slice(-2);
            return `${dd}/${mm}/${yy}`;
          };

          for (let i = 0; i < segmentos; i++) {
            const inicioSegmento = new Date(fechaDesde);
            inicioSegmento.setDate(fechaDesde.getDate() + (i * diasPorSegmento));

            const finSegmento = new Date(inicioSegmento);
            finSegmento.setDate(inicioSegmento.getDate() + diasPorSegmento - 1);
            finSegmento.setHours(23, 59, 59, 999);

            const finReal = finSegmento > fechaHasta ? fechaHasta : finSegmento;

            const count = datosFiltrados.filter(s => {
              const fechaCreacion = new Date(s.created_at || s.fecha_creacion);
              return fechaCreacion >= inicioSegmento && fechaCreacion <= finReal;
            }).length;

            datosSparkline.push(count);
            labelsSparkline.push(formatFecha(inicioSegmento));
          }

          return (
            <Box ref={solicitudesCredasRef} onClick={() => onKpiDrillDown?.('solicitudes_diarias')} sx={{ flex: '1 1 340px', minWidth: 300, maxWidth: 420, height: 180, position: 'relative', cursor: onKpiDrillDown ? 'pointer' : 'default' }}>
              <Box sx={{ position: 'absolute', top: 40, right: 8, zIndex: 10 }}>
                <ExpandCardButton
                  onClick={() => {
                    setExpandedCard('solicitudes');
                    setExpandedTitle('Solicitudes Creadas');
                  }}
                />
              </Box>
              <WeeklyRequestsKpiCard
                data={datosSparkline}
                labels={labelsSparkline}
                previousWeekTotal={null}
                trendPercentage={null}
                compact={false}
              />
            </Box>
          );
        })()}

        {/* Cumplimiento de Proveedores */}
        {(() => {
          const totalPedidos = cumplimientoProveedores.reduce((sum, p) => sum + (p.total_pedidos || 0), 0);
          const entregasATiempo = cumplimientoProveedores.reduce((sum, p) => sum + (p.entregas_a_tiempo || 0), 0);
          const pctCumplimiento = totalPedidos > 0 ? Math.round((entregasATiempo / totalPedidos) * 100) : 0;

          // Filtrar proveedores seleccionados
          const proveedoresFiltrados = cumplimientoProveedores.filter(p =>
            proveedoresSeleccionados.includes(p.proveedor_cuit || p.proveedor_nombre)
          );

          return (
            <Paper
              elevation={0}
              sx={{
                flex: '1 1 400px',
                minWidth: 380,
                maxWidth: 500,
                height: 180,
                bgcolor: 'var(--surface)',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'box-shadow 0.2s ease-in-out',
                overflow: 'hidden',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                },
              }}
            >
              <Box sx={{ p: 2, height: '100%' }}>
                <Stack direction="row" gap={2} sx={{ height: '100%' }}>
                  {/* Lado izquierdo - KPI */}
                  <Box sx={{ flexShrink: 0, minWidth: 120 }}>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                        Cumplimiento Proveedores
                      </Typography>
                      <Tooltip title={totalPedidos > 0 ? `${entregasATiempo} entregas a tiempo de ${totalPedidos} pedidos totales` : 'Sin datos de pedidos'} arrow placement="right">
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'grey.800' }}>
                        {totalPedidos > 0 ? `${pctCumplimiento}%` : 'N/A'}
                      </Typography>
                    </Tooltip>
                    </Box>
                    <Typography variant="caption" sx={{ color: 'grey.500' }}>
                      {totalPedidos > 0 ? `${entregasATiempo}/${totalPedidos} a tiempo` : `${cumplimientoProveedores.length} proveedores`}
                    </Typography>
                  </Box>

                  {/* Separador */}
                  <Divider orientation="vertical" flexItem />

                  {/* Lado derecho - Selector y datos */}
                  <Box sx={{ flex: 1 }}>
                    <FormControl size="small" fullWidth sx={{ mb: 0.5 }}>
                      <InputLabel id="proveedores-label" sx={{ fontSize: FONT_SIZES.md }}>Proveedores</InputLabel>
                      <Select
                        labelId="proveedores-label"
                        multiple
                        value={proveedoresSeleccionados}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.includes('__todos__')) {
                            const todosIds = cumplimientoProveedores.map(p => p.proveedor_cuit || p.proveedor_nombre);
                            if (proveedoresSeleccionados.length === todosIds.length) {
                              setProveedoresSeleccionados([]);
                            } else {
                              setProveedoresSeleccionados(todosIds);
                            }
                          } else {
                            setProveedoresSeleccionados(typeof value === 'string' ? value.split(',') : value);
                          }
                        }}
                        input={<OutlinedInput label="Proveedores" />}
                        renderValue={(selected) => selected.length > 1 ? `${selected.length} seleccionados` : selected[0] || ''}
                        MenuProps={MenuProps}
                        sx={{ fontSize: FONT_SIZES.md }}
                      >
                        <MenuItem value="__todos__">
                          <Checkbox checked={proveedoresSeleccionados.length === cumplimientoProveedores.length && cumplimientoProveedores.length > 0} size="small" />
                          <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontSize: FONT_SIZES.md, fontWeight: 600 }} />
                        </MenuItem>
                        {cumplimientoProveedores.map((p) => (
                          <MenuItem key={p.proveedor_cuit || p.proveedor_nombre} value={p.proveedor_cuit || p.proveedor_nombre}>
                            <Checkbox checked={proveedoresSeleccionados.includes(p.proveedor_cuit || p.proveedor_nombre)} size="small" />
                            <ListItemText primary={p.proveedor_nombre || 'Proveedor'} primaryTypographyProps={{ fontSize: FONT_SIZES.md }} />
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {proveedoresFiltrados.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 80, overflow: 'auto' }}>
                        {proveedoresFiltrados.slice(0, 5).map((p, idx) => {
                          const pct = p.pct_otif !== null && p.pct_otif !== undefined
                            ? Math.round(p.pct_otif)
                            : p.total_pedidos > 0
                              ? Math.round((p.entregas_a_tiempo / p.total_pedidos) * 100)
                              : null;
                          return (
                            <Stack key={idx} direction="row" alignItems="center" justifyContent="space-between">
                              <Tooltip title={`${p.proveedor_nombre || 'Proveedor'} — ${p.entregas_a_tiempo || 0}/${p.total_pedidos || 0} entregas a tiempo`} arrow>
                                <Typography variant="caption" sx={{ color: 'grey.600', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.proveedor_nombre || 'Proveedor'}
                                </Typography>
                              </Tooltip>
                              {pct !== null ? (
                                <Tooltip title={`${pct >= 90 ? 'Excelente' : pct >= 70 ? 'Aceptable' : 'Bajo'}: ${p.entregas_a_tiempo || 0} de ${p.total_pedidos || 0}`} arrow>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontWeight: 600,
                                      ml: 1,
                                      color: pct >= 90 ? 'success.main' : pct >= 70 ? 'warning.main' : 'error.main',
                                    }}
                                  >
                                    {pct}%
                                  </Typography>
                                </Tooltip>
                              ) : (
                                <Typography variant="caption" sx={{ color: 'grey.400', ml: 1, fontSize: FONT_SIZES.xs }}>Sin datos</Typography>
                              )}
                            </Stack>
                          );
                        })}
                      </Box>
                    ) : (
                      <Typography variant="caption" sx={{ color: 'grey.400', textAlign: 'center', py: 1, display: 'block' }}>
                        No hay datos de proveedores disponibles
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Box>
            </Paper>
          );
        })()}

        {/* Tiempos de Gestion - Barras Apiladas */}
        {(() => {
          // Calcular tiempos promedio desde datos filtrados
          const calcularTiempos = () => {
            const solicitudesProcesadas = datosFiltrados.filter(s => {
              const estado = (s.estado || s.status || '').toLowerCase();
              return estado.includes('aprobada') || estado === 'approved' ||
                estado.includes('proceso') || estado === 'processing' ||
                estado.includes('despach') || estado === 'dispatched' ||
                estado.includes('complet') || estado === 'completed' ||
                estado.includes('cerrada') || estado === 'closed';
            });

            if (solicitudesProcesadas.length === 0) {
              const tiempoKpi = kpiData?.tiempoAprobacion?.promedio || 0;
              if (tiempoKpi > 0) {
                return {
                  aprobacion: Math.round(tiempoKpi * 0.35),
                  planificacion: Math.round(tiempoKpi * 0.40),
                  proveedor: Math.round(tiempoKpi * 0.25),
                  total: Math.round(tiempoKpi)
                };
              }
              return { aprobacion: 0, planificacion: 0, proveedor: 0, total: 0 };
            }

            let tiempoTotalAcumulado = 0;
            let count = 0;

            solicitudesProcesadas.forEach(s => {
              const fechaCreacion = new Date(s.created_at || s.fecha_creacion);
              const fechaActualizacion = new Date(s.updated_at || s.fecha_actualizacion || s.created_at);

              if (fechaActualizacion > fechaCreacion) {
                const dias = Math.max(1, Math.round((fechaActualizacion - fechaCreacion) / (1000 * 60 * 60 * 24)));
                tiempoTotalAcumulado += dias;
                count++;
              }
            });

            const tiempoPromedio = count > 0 ? Math.round(tiempoTotalAcumulado / count) : 0;

            if (tiempoPromedio === 0) {
              return { aprobacion: 0, planificacion: 0, proveedor: 0, total: 0 };
            }

            const tiempoAprobacion = Math.round(tiempoPromedio * 0.35);
            const tiempoPlanificacion = Math.round(tiempoPromedio * 0.40);
            const tiempoProveedor = tiempoPromedio - tiempoAprobacion - tiempoPlanificacion;

            return {
              aprobacion: Math.max(0, tiempoAprobacion),
              planificacion: Math.max(0, tiempoPlanificacion),
              proveedor: Math.max(0, tiempoProveedor),
              total: tiempoPromedio
            };
          };

          const tiempos = calcularTiempos();
          const colores = PHASE_COLORS;

          const pctAprobacion = tiempos.total > 0 ? (tiempos.aprobacion / tiempos.total) * 100 : 0;
          const pctPlanificacion = tiempos.total > 0 ? (tiempos.planificacion / tiempos.total) * 100 : 0;
          const pctProveedor = tiempos.total > 0 ? (tiempos.proveedor / tiempos.total) * 100 : 0;

          return (
            <Paper
              ref={tiemposGestionRef}
              elevation={0}
              onClick={() => onKpiDrillDown?.('tiempos_promedio')}
              sx={{
                flex: '1 1 320px',
                minWidth: 280,
                maxWidth: 420,
                height: 180,
                bgcolor: 'var(--surface)',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                overflow: 'visible',
                cursor: onKpiDrillDown ? 'pointer' : 'default',
                transition: 'box-shadow 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                },
              }}
            >
              <Box sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {/* Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                    Tiempos de Gesti&oacute;n
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: SPM_COLORS.primary, fontSize: FONT_SIZES.sm }}>
                      Promedio: {tiempos.total || 0}d
                    </Typography>
                    <ExpandCardButton
                      onClick={() => {
                        setExpandedCard('tiempos');
                        setExpandedTitle('Tiempos de Gesti\u00f3n');
                      }}
                    />
                  </Stack>
                </Stack>

                {/* Barra apilada horizontal */}
                <Stack spacing={1.5} sx={{ flex: 1, justifyContent: 'center' }}>
                  <Box>
                    <Stack direction="row" spacing={0.5} sx={{ width: '100%', height: 12, borderRadius: 1, overflow: 'hidden' }}>
                      <Tooltip title={`Aprobación: ${tiempos.aprobacion}d (${pctAprobacion.toFixed(0)}%)`} arrow>
                        <Box sx={{ flex: pctAprobacion, bgcolor: colores.aprobacion.bg, minWidth: pctAprobacion > 5 ? 'auto' : 0, transition: 'flex 0.3s ease' }} />
                      </Tooltip>
                      <Tooltip title={`Planificación: ${tiempos.planificacion}d (${pctPlanificacion.toFixed(0)}%)`} arrow>
                        <Box sx={{ flex: pctPlanificacion, bgcolor: colores.planificacion.bg, minWidth: pctPlanificacion > 5 ? 'auto' : 0, transition: 'flex 0.3s ease' }} />
                      </Tooltip>
                      <Tooltip title={`Proveedor: ${tiempos.proveedor}d (${pctProveedor.toFixed(0)}%)`} arrow>
                        <Box sx={{ flex: pctProveedor, bgcolor: colores.proveedor.bg, minWidth: pctProveedor > 5 ? 'auto' : 0, transition: 'flex 0.3s ease' }} />
                      </Tooltip>
                    </Stack>
                  </Box>

                  {/* Leyenda */}
                  <Stack direction="row" spacing={2} sx={{ width: '100%', justifyContent: 'space-around' }}>
                    {/* Aprobacion */}
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colores.aprobacion.bg, flexShrink: 0 }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: FONT_SIZES.sm }}>
                          Aprobaci&oacute;n
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ ml: 2.25 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: colores.aprobacion.bg, fontSize: FONT_SIZES.lg }}>
                          {tiempos.aprobacion}d
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: FONT_SIZES.xs }}>
                          ({pctAprobacion.toFixed(0)}%)
                        </Typography>
                      </Stack>
                    </Box>

                    {/* Planificacion */}
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colores.planificacion.bg, flexShrink: 0 }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: FONT_SIZES.sm }}>
                          Planificaci&oacute;n
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ ml: 2.25 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: colores.planificacion.bg, fontSize: FONT_SIZES.lg }}>
                          {tiempos.planificacion}d
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: FONT_SIZES.xs }}>
                          ({pctPlanificacion.toFixed(0)}%)
                        </Typography>
                      </Stack>
                    </Box>

                    {/* Proveedor */}
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colores.proveedor.bg, flexShrink: 0 }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: FONT_SIZES.sm }}>
                          Proveedor
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ ml: 2.25 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: colores.proveedor.bg, fontSize: FONT_SIZES.lg }}>
                          {tiempos.proveedor}d
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: FONT_SIZES.xs }}>
                          ({pctProveedor.toFixed(0)}%)
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </Stack>
              </Box>
            </Paper>
          );
        })()}

        {/* Compras Evitadas - Polar Area Chart */}
        {(() => {
          const fechaDesde = sliderAFechaDate(rangoFechas[0]);
          const fechaHasta = sliderAFechaDate(rangoFechas[1]);
          fechaHasta.setHours(23, 59, 59, 999);

          const comprasFiltradas = comprasEvitadasDetalle.filter(item => {
            if (item.fecha) {
              const fechaItem = new Date(item.fecha);
              if (fechaItem < fechaDesde || fechaItem > fechaHasta) return false;
            }
            if (centrosSeleccionados.length > 0 && !centrosSeleccionados.includes(item.centro)) return false;
            if (sectoresSeleccionados.length > 0 && !sectoresSeleccionados.includes(item.sector)) return false;
            return true;
          });

          const valorStockInterno = comprasFiltradas.reduce((sum, item) => sum + (item.valor || 0), 0);
          const itemsStockInterno = comprasFiltradas.length;

          const solicitudesConCompra = datosFiltrados.filter(s =>
            ['processing', 'dispatched', 'closed'].includes(s.estado_actual) &&
            s.origen_abastecimiento !== 'interno' &&
            s.origen_abastecimiento !== 'stock'
          );
          const valorCompraExterna = solicitudesConCompra.reduce((sum, s) =>
            sum + (Number(s.monto_total) || Number(s.valor_estimado) || 0), 0
          );
          const itemsCompraExterna = solicitudesConCompra.length;

          const polarData = [
            { label: 'Stock interno', value: valorStockInterno || 0.01, color: SPM_COLORS.success },
            { label: 'Compra externa', value: valorCompraExterna || 0.01, color: SPM_COLORS.warning },
          ];

          const totalValor = valorStockInterno + valorCompraExterna;
          const pctInterno = totalValor > 0 ? ((valorStockInterno / totalValor) * 100).toFixed(1) : 0;

          const formatMontoCorto = (val) => {
            if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
            if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
            return val.toFixed(0);
          };

          const todosLosCentros = centrosSeleccionados.length === filtrosOpciones.centros.length;
          const todosLosSectores = sectoresSeleccionados.length === filtrosOpciones.sectores.length;
          const rangoCompleto = rangoFechas[0] === 0 && rangoFechas[1] === 365;
          const hayFiltrosActivos = !todosLosCentros || !todosLosSectores || !rangoCompleto;

          return (
            <Paper
              ref={fuenteAbastecimientoRef}
              elevation={0}
              onClick={() => onKpiDrillDown?.('compras_evitadas')}
              sx={{
                flex: '1 1 320px',
                minWidth: 280,
                maxWidth: 400,
                height: 180,
                bgcolor: 'var(--surface)',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                cursor: onKpiDrillDown ? 'pointer' : 'default',
                transition: 'box-shadow 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                },
                position: 'relative',
              }}
            >
              <Box sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                      Fuente de Abastecimiento
                    </Typography>
                    {hayFiltrosActivos && (
                      <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'primary.main' }}>(filtrado)</Typography>
                    )}
                  </Stack>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: SPM_COLORS.success, fontSize: FONT_SIZES.sm }}>
                      {pctInterno}% interno
                    </Typography>
                    <ExpandCardButton
                      onClick={() => {
                        setExpandedCard('fuente');
                        setExpandedTitle('Fuente de Abastecimiento');
                      }}
                    />
                  </Stack>
                </Stack>

                {/* Content: Chart + Legend */}
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1 }}>
                  {/* Polar Area Chart */}
                  <Box sx={{ width: 110, height: 110, flexShrink: 0 }}>
                    <SPMPolarArea
                      data={polarData}
                      height={110}
                      options={{
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            ...TOOLTIP_CONFIG,
                            callbacks: {
                              label: (context) => {
                                const value = context.parsed.r;
                                const pct = totalValor > 0 ? ((value / totalValor) * 100).toFixed(1) : 0;
                                return `USD ${formatMontoCorto(value)} (${pct}%)`;
                              }
                            }
                          }
                        },
                        scales: {
                          r: {
                            display: false,
                            beginAtZero: true,
                          }
                        },
                        animation: ANIMATION_CONFIG,
                      }}
                    />
                  </Box>

                  {/* Leyenda personalizada */}
                  <Stack spacing={1} sx={{ flex: 1 }}>
                    <Box>
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: SPM_COLORS.success, flexShrink: 0 }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: FONT_SIZES.sm }}>
                          Stock interno
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ ml: 2.25 }}>
                        <Tooltip title={`USD ${valorStockInterno.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} arrow>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: SPM_COLORS.success, fontSize: FONT_SIZES.lg }}>
                            USD {formatMontoCorto(valorStockInterno)}
                          </Typography>
                        </Tooltip>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: FONT_SIZES.xs }}>
                          ({itemsStockInterno} items)
                        </Typography>
                      </Stack>
                    </Box>

                    <Box>
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: SPM_COLORS.warning, flexShrink: 0 }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: FONT_SIZES.sm }}>
                          Compra externa
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ ml: 2.25 }}>
                        <Tooltip title={`USD ${valorCompraExterna.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} arrow>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: SPM_COLORS.warning, fontSize: FONT_SIZES.lg }}>
                            USD {formatMontoCorto(valorCompraExterna)}
                          </Typography>
                        </Tooltip>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: FONT_SIZES.xs }}>
                          ({itemsCompraExterna} sol.)
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </Stack>
              </Box>
            </Paper>
          );
        })()}
      </Stack>
    </ScrollReveal>
  );
}

export default memo(KPIRow1);
