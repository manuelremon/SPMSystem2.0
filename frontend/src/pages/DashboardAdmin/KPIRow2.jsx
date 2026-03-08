import { memo } from "react";
import { ScrollReveal } from "../../components/ui/ScrollReveal";
import { StatusDistributionChart } from '../../components/dashboard/StatusDistributionChart';
import { TrendChart } from '../../components/dashboard/TrendChart';
import { ChartExportButton } from '../../components/dashboard/ChartExportButton';
import { SPMGauge, SPM_COLORS, STATUS_COLORS, BUDGET_COLORS, FONT_SIZES } from '../../components/ui/SPMChartJS';
import ExpandCardButton from './ExpandCardButton';
import { useI18n } from "../../context/i18n";
// MUI Components
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

/**
 * KPIRow2 - Second row: Distribucion de Estados, Tendencia Historica, Presupuesto
 */
function KPIRow2({
  // Refs
  distribucionRef,
  tendenciaRef,
  presupuestoGlobalRef,
  // Data
  datosFiltrados,
  trendData,
  kpiData,
  centrosSeleccionados,
  sectoresSeleccionados,
  filtrosOpciones,
  // Handlers
  handleDrillDown,
  setExpandedCard,
  setExpandedTitle,
  // Drill-down handler
  onKpiDrillDown,
}) {
  const { t } = useI18n();
  return (
    <ScrollReveal delay={200}>
      <Stack direction="row" flexWrap="wrap" gap={1.5}>

        {/* Distribucion de Estados - Chart.js Doughnut */}
        {(() => {
          const estados = {
            borrador: 0,
            enviadas: 0,
            aprobadas: 0,
            enProceso: 0,
            rechazadas: 0,
            cerradas: 0
          };

          datosFiltrados.forEach(s => {
            const estado = (s.estado || s.status || '').toLowerCase().trim();
            if (estado.includes('draft') || estado.includes('borrador')) {
              estados.borrador++;
            } else if (estado.includes('submitted') || estado.includes('enviada') || estado.includes('pending') || estado.includes('pendiente') || estado === '') {
              estados.enviadas++;
            } else if (estado.includes('approved') || estado.includes('aprobada')) {
              estados.aprobadas++;
            } else if (estado.includes('processing') || estado.includes('proceso') || estado.includes('in_processing') || estado.includes('en proceso') || estado.includes('compra')) {
              estados.enProceso++;
            } else if (estado.includes('rejected') || estado.includes('rechazada')) {
              estados.rechazadas++;
            } else if (estado.includes('closed') || estado.includes('cerrada') || estado.includes('dispatched') || estado.includes('despachada') || estado.includes('completed')) {
              estados.cerradas++;
            } else {
              estados.enProceso++;
            }
          });

          const chartData = [
            { id: 'borrador', label: t('sol_tab_borrador', 'Borrador'), value: estados.borrador, color: STATUS_COLORS['borrador'] || '#94a3b8' },
            { id: 'enviadas', label: t('sol_tab_enviadas', 'Enviadas'), value: estados.enviadas, color: STATUS_COLORS['enviadas'] || '#3b82f6' },
            { id: 'aprobadas', label: t('sol_tab_aprobadas', 'Aprobadas'), value: estados.aprobadas, color: STATUS_COLORS['aprobadas'] || '#10b981' },
            { id: 'enProceso', label: t('sol_tab_en_proceso', 'En Proceso'), value: estados.enProceso, color: STATUS_COLORS['enProceso'] || '#8b5cf6' },
            { id: 'rechazadas', label: t('sol_tab_rechazadas', 'Rechazadas'), value: estados.rechazadas, color: STATUS_COLORS['rechazadas'] || '#ef4444' },
            { id: 'cerradas', label: t('sol_tab_cerradas', 'Cerradas'), value: estados.cerradas, color: STATUS_COLORS['cerradas'] || '#8b5cf6' },
          ];

          return (
            <Paper
              ref={distribucionRef}
              elevation={0}
              onClick={() => onKpiDrillDown?.('solicitudes_por_estado')}
              sx={{
                flex: '0 0 280px',
                height: 200,
                bgcolor: 'var(--surface)',
                border: '1px solid',
                borderColor: 'divider',
                cursor: onKpiDrillDown ? 'pointer' : 'default',
                transition: 'box-shadow 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                },
                p: 1.5,
                overflow: 'visible',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                  {t('dash_distribucion_estados', 'Distribuci\u00f3n de Estados')}
                </Typography>
                <Stack direction="row" alignItems="center" gap={0}>
                  <ExpandCardButton
                    onClick={() => {
                      setExpandedCard('distribucion');
                      setExpandedTitle(t('dash_distribucion_estados', 'Distribuci\u00f3n de Estados'));
                    }}
                  />
                  <ChartExportButton chartRef={distribucionRef} filename="distribucion-estados" size="small" />
                </Stack>
              </Stack>
              <Box sx={{ height: 155 }}>
                <StatusDistributionChart
                  data={chartData}
                  onDrillDown={handleDrillDown}
                  height={150}
                  innerRadius={35}
                  outerRadius={55}
                />
              </Box>
            </Paper>
          );
        })()}

        {/* Tendencia Historica - Chart.js Line */}
        <Paper
          ref={tendenciaRef}
          elevation={0}
          sx={{
            flex: '1 1 350px',
            minWidth: 350,
            height: 200,
            bgcolor: 'var(--surface)',
            border: '1px solid',
            borderColor: 'divider',
            p: 2,
            transition: 'box-shadow 0.2s ease-in-out',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            },
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
              {t('dash_tendencia_historica', 'Tendencia Hist\u00f3rica (12 meses)')}
            </Typography>
            <Stack direction="row" alignItems="center" gap={0}>
              <ExpandCardButton
                onClick={() => {
                  setExpandedCard('tendencia');
                  setExpandedTitle(t('dash_tendencia_historica', 'Tendencia Hist\u00f3rica (12 meses)'));
                }}
              />
              <ChartExportButton chartRef={tendenciaRef} filename="tendencia-historica" size="small" />
            </Stack>
          </Stack>
          <Box>
            <TrendChart
              data={trendData}
              height={145}
              showLegend={true}
              showArea={true}
            />
          </Box>
        </Paper>

        {/* Presupuesto - Filtrable por Centro/Sector - Con Chart.js Gauge */}
        {(() => {
          const topCentros = (kpiData.presupuesto.topCentros || []);
          const topSectores = (kpiData.presupuesto.topSectores || []);

          const centrosFiltrados = centrosSeleccionados.length > 0
            ? topCentros.filter(c => centrosSeleccionados.includes(c.nombre))
            : topCentros;

          const sectoresFiltrados = sectoresSeleccionados.length > 0
            ? topSectores.filter(s => sectoresSeleccionados.includes(s.nombre))
            : topSectores;

          let presupuestoFiltrado = {
            total: kpiData.presupuesto.total,
            utilizado: kpiData.presupuesto.utilizado,
            disponible: kpiData.presupuesto.disponible,
            percentage: kpiData.presupuesto.percentage,
          };

          if (centrosSeleccionados.length > 0 && centrosFiltrados.length > 0) {
            const utilizadoFiltrado = centrosFiltrados.reduce((sum, c) => sum + (c.utilizado || 0), 0);
            const totalFiltrado = centrosFiltrados.reduce((sum, c) => sum + (c.monto || 0), 0);
            presupuestoFiltrado = {
              total: totalFiltrado,
              utilizado: utilizadoFiltrado,
              disponible: totalFiltrado - utilizadoFiltrado,
              percentage: totalFiltrado > 0 ? Math.round((utilizadoFiltrado / totalFiltrado) * 100) : 0,
            };
          }

          const hayFiltrosActivos = centrosSeleccionados.length > 0 && centrosSeleccionados.length < filtrosOpciones.centros.length;
          const mostrandoGlobal = !hayFiltrosActivos || centrosFiltrados.length === 0;

          return (
            <Paper
              ref={presupuestoGlobalRef}
              elevation={0}
              onClick={() => onKpiDrillDown?.('presupuesto_por_centro')}
              sx={{
                flex: '1 1 auto',
                minWidth: 480,
                maxWidth: 620,
                height: 200,
                bgcolor: 'var(--surface)',
                border: '1px solid',
                borderColor: 'divider',
                cursor: onKpiDrillDown ? 'pointer' : 'default',
                transition: 'box-shadow 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                },
                p: 1.5,
                overflow: 'visible',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={0.5}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: FONT_SIZES.md }}>
                    {t('dash_presupuesto_global', 'Presupuesto')} {mostrandoGlobal ? t('dash_total', 'Global') : t('dash_filtrado', 'Filtrado')}
                  </Typography>
                  {!mostrandoGlobal && (
                    <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'primary.main' }}>
                      ({centrosFiltrados.length} {t('dash_centros', 'centros')})
                    </Typography>
                  )}
                </Stack>
                <Stack direction="row" alignItems="center" gap={0}>
                  <ExpandCardButton
                    onClick={() => {
                      setExpandedCard('presupuesto');
                      setExpandedTitle(t('dash_presupuesto_global', 'Presupuesto') + ' ' + t('dash_total', 'Global'));
                    }}
                  />
                  <ChartExportButton chartRef={presupuestoGlobalRef} filename="presupuesto-global" size="small" />
                </Stack>
              </Stack>
              <Stack direction="row" alignItems="flex-start" gap={1.5}>
                {/* Medidores con SPMGauge Chart.js */}
                <Stack direction="row" gap={0} sx={{ flexShrink: 0 }}>
                  <Tooltip title={`USD ${presupuestoFiltrado.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} arrow>
                    <Stack alignItems="center" sx={{ width: 75 }}>
                      <SPMGauge value={100} valueMax={100} width={70} height={70} color={BUDGET_COLORS.total} startAngle={-90} endAngle={90} />
                      <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.secondary', mt: -0.5 }}>{t('dash_total', 'Total')}</Typography>
                      <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, fontWeight: 700, color: BUDGET_COLORS.total, whiteSpace: 'nowrap' }}>
                        MUSD {(presupuestoFiltrado.total / 1000000).toFixed(1)}
                      </Typography>
                    </Stack>
                  </Tooltip>
                  <Tooltip title={`USD ${presupuestoFiltrado.utilizado.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (${presupuestoFiltrado.percentage}%)`} arrow>
                    <Stack alignItems="center" sx={{ width: 75 }}>
                      <SPMGauge value={presupuestoFiltrado.percentage} valueMax={100} width={70} height={70} color={BUDGET_COLORS.utilizado} startAngle={-90} endAngle={90} />
                      <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.secondary', mt: -0.5 }}>{t('dash_utilizado', 'Utilizado')}</Typography>
                      <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, fontWeight: 700, color: BUDGET_COLORS.utilizado, whiteSpace: 'nowrap' }}>
                        MUSD {(presupuestoFiltrado.utilizado / 1000000).toFixed(1)}
                      </Typography>
                    </Stack>
                  </Tooltip>
                  <Tooltip title={`USD ${presupuestoFiltrado.disponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (${100 - presupuestoFiltrado.percentage}%)`} arrow>
                    <Stack alignItems="center" sx={{ width: 75 }}>
                      <SPMGauge value={100 - presupuestoFiltrado.percentage} valueMax={100} width={70} height={70} color={BUDGET_COLORS.disponible} startAngle={-90} endAngle={90} />
                      <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.secondary', mt: -0.5 }}>{t('dash_disponible', 'Disponible')}</Typography>
                      <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, fontWeight: 700, color: BUDGET_COLORS.disponible, whiteSpace: 'nowrap' }}>
                        MUSD {(presupuestoFiltrado.disponible / 1000000).toFixed(1)}
                      </Typography>
                    </Stack>
                  </Tooltip>
                </Stack>
                {/* Separador vertical */}
                <Box sx={{ width: '1px', height: 120, bgcolor: 'divider', flexShrink: 0, alignSelf: 'center' }} />
                {/* Top 3 en dos columnas */}
                <Box sx={{ flex: 1, minWidth: 240, overflow: 'visible' }}>
                  <Typography variant="caption" sx={{ display: 'block', fontSize: FONT_SIZES.xs, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.3px', mb: 0.75, textAlign: 'center' }}>
                    {mostrandoGlobal ? 'Top3 consumo del Presupuesto Global por:' : t('dash_seleccionados', 'Seleccionados')}
                  </Typography>
                  <Stack direction="row" gap={2}>
                    {/* Top Centros */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" sx={{ display: 'block', fontSize: FONT_SIZES.xs, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 0.5 }}>
                        {t('dash_centros', 'Centros')}
                      </Typography>
                      <Stack spacing={0.75}>
                        {(mostrandoGlobal ? topCentros : centrosFiltrados).slice(0, 3).map((centro, idx) => (
                          <Tooltip key={idx} title={`${centro.nombre}: USD ${(centro.utilizado || 0).toLocaleString('es-AR')} de ${(centro.monto || 0).toLocaleString('es-AR')} (${centro.porcentaje}%)`} arrow placement="top">
                            <Box>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25, width: '100%', overflow: 'visible' }}>
                                <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                                  {centro.nombre}
                                </Typography>
                                <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, fontWeight: 700, color: BUDGET_COLORS.utilizado, ml: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {centro.porcentaje}%
                                </Typography>
                              </Stack>
                              <Box sx={{ height: 4, bgcolor: 'grey.200', overflow: 'hidden' }}>
                                <Box sx={{ height: '100%', width: `${Math.min(centro.porcentaje || 0, 100)}%`, bgcolor: BUDGET_COLORS.utilizado, transition: 'width 0.3s ease' }} />
                              </Box>
                            </Box>
                          </Tooltip>
                        ))}
                        {(mostrandoGlobal ? topCentros : centrosFiltrados).length === 0 && (
                          <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.disabled' }}>{t('common_sin_datos', 'Sin datos')}</Typography>
                        )}
                      </Stack>
                    </Box>
                    {/* Top Sectores */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" sx={{ display: 'block', fontSize: FONT_SIZES.xs, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 0.5 }}>
                        {t('dash_sectores_label', 'Sectores')}
                      </Typography>
                      <Stack spacing={0.75}>
                        {(mostrandoGlobal ? topSectores : sectoresFiltrados).slice(0, 3).map((sector, idx) => (
                          <Tooltip key={idx} title={`${sector.nombre}: USD ${(sector.utilizado || 0).toLocaleString('es-AR')} de ${(sector.monto || 0).toLocaleString('es-AR')} (${sector.porcentaje}%)`} arrow placement="top">
                            <Box>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25, width: '100%', overflow: 'visible' }}>
                                <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                                  {sector.nombre}
                                </Typography>
                                <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, fontWeight: 700, color: BUDGET_COLORS.total, ml: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {sector.porcentaje}%
                                </Typography>
                              </Stack>
                              <Box sx={{ height: 4, bgcolor: 'grey.200', overflow: 'hidden' }}>
                                <Box sx={{ height: '100%', width: `${Math.min(sector.porcentaje || 0, 100)}%`, bgcolor: BUDGET_COLORS.total, transition: 'width 0.3s ease' }} />
                              </Box>
                            </Box>
                          </Tooltip>
                        ))}
                        {(mostrandoGlobal ? topSectores : sectoresFiltrados).length === 0 && (
                          <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.disabled' }}>{t('common_sin_datos', 'Sin datos')}</Typography>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          );
        })()}

      </Stack>
    </ScrollReveal>
  );
}

export default memo(KPIRow2);
