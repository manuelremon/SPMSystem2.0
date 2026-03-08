import { memo } from "react";
import { StatusDistributionChart } from '../../components/dashboard/StatusDistributionChart';
import { TrendChart } from '../../components/dashboard/TrendChart';
import { WeeklyRequestsKpiCard } from "../../components/dashboard/WeeklyRequestsKpiCard";
import { SPMGauge, SPMPolarArea, SPM_COLORS, STATUS_COLORS, BUDGET_COLORS, FONT_SIZES, TOOLTIP_CONFIG, ANIMATION_CONFIG } from '../../components/ui/SPMChartJS';
// MUI Components
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import CloseIcon from '@mui/icons-material/Close';

/**
 * ExpandedCardDialog - Modal dialog for expanded KPI cards
 */
function ExpandedCardDialog({
  t,
  expandedCard,
  expandedTitle,
  setExpandedCard,
  datosFiltrados,
  trendData,
  kpiData,
  handleDrillDown,
}) {
  return (
    <Dialog
      open={Boolean(expandedCard)}
      onClose={() => setExpandedCard(null)}
      maxWidth="lg"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          maxHeight: '90vh',
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: FONT_SIZES.lg }}>
          {expandedTitle}
        </Typography>
        <IconButton onClick={() => setExpandedCard(null)} size="small" aria-label={t('common_cerrar', 'Cerrar')}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ overflow: 'auto', py: 2, minHeight: 300 }}>
        {/* Distribucion de Estados - ampliado */}
        {expandedCard === 'distribucion' && (() => {
          const estados = { borrador: 0, enviadas: 0, aprobadas: 0, enProceso: 0, rechazadas: 0, cerradas: 0 };
          datosFiltrados.forEach(s => {
            const e = (s.estado || s.status || '').toLowerCase().trim();
            if (e.includes('draft') || e.includes('borrador')) estados.borrador++;
            else if (e.includes('submitted') || e.includes('enviada') || e.includes('pending') || e.includes('pendiente') || e === '') estados.enviadas++;
            else if (e.includes('approved') || e.includes('aprobada')) estados.aprobadas++;
            else if (e.includes('processing') || e.includes('proceso') || e.includes('in_processing') || e.includes('compra')) estados.enProceso++;
            else if (e.includes('rejected') || e.includes('rechazada')) estados.rechazadas++;
            else if (e.includes('closed') || e.includes('cerrada') || e.includes('dispatched') || e.includes('completed')) estados.cerradas++;
            else estados.enProceso++;
          });
          const data = [
            { id: 'borrador', label: t('sol_tab_borrador', 'Borrador'), value: estados.borrador, color: STATUS_COLORS['borrador'] || '#94a3b8' },
            { id: 'enviadas', label: t('sol_tab_enviadas', 'Enviadas'), value: estados.enviadas, color: STATUS_COLORS['enviadas'] || '#3b82f6' },
            { id: 'aprobadas', label: t('sol_tab_aprobadas', 'Aprobadas'), value: estados.aprobadas, color: STATUS_COLORS['aprobadas'] || '#10b981' },
            { id: 'enProceso', label: t('sol_tab_en_proceso', 'En Proceso'), value: estados.enProceso, color: STATUS_COLORS['enProceso'] || '#8b5cf6' },
            { id: 'rechazadas', label: t('sol_tab_rechazadas', 'Rechazadas'), value: estados.rechazadas, color: STATUS_COLORS['rechazadas'] || '#ef4444' },
            { id: 'cerradas', label: t('sol_tab_cerradas', 'Cerradas'), value: estados.cerradas, color: STATUS_COLORS['cerradas'] || '#8b5cf6' },
          ];
          return (
            <Box sx={{ height: 400 }}>
              <StatusDistributionChart data={data} onDrillDown={handleDrillDown} height={380} innerRadius={80} outerRadius={140} />
            </Box>
          );
        })()}

        {/* Tendencia Historica - ampliado */}
        {expandedCard === 'tendencia' && (
          <Box sx={{ height: 400 }}>
            <TrendChart data={trendData} height={380} showLegend={true} showArea={true} />
          </Box>
        )}

        {/* Presupuesto Global - ampliado */}
        {expandedCard === 'presupuesto' && (() => {
          const p = kpiData.presupuesto;
          const fmt = (val) => {
            if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
            if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
            return (val || 0).toFixed(0);
          };
          const topC = (p.topCentros || []).slice(0, 5);
          const topS = (p.topSectores || []).slice(0, 5);
          return (
            <Stack spacing={3}>
              <Stack direction="row" justifyContent="space-around" alignItems="center">
                <Stack alignItems="center" sx={{ width: 140 }}>
                  <SPMGauge value={p.percentage || 0} max={100} height={120} color={BUDGET_COLORS.total} />
                  <Typography variant="caption" sx={{ fontWeight: 600, mt: 0.5 }}>{t('dash_total', 'Total')} MUSD {fmt(p.total)}</Typography>
                </Stack>
                <Stack alignItems="center" sx={{ width: 140 }}>
                  <SPMGauge value={p.total > 0 ? Math.round((p.utilizado / p.total) * 100) : 0} max={100} height={120} color={BUDGET_COLORS.utilizado} />
                  <Typography variant="caption" sx={{ fontWeight: 600, mt: 0.5 }}>{t('dash_utilizado', 'Utilizado')} MUSD {fmt(p.utilizado)}</Typography>
                </Stack>
                <Stack alignItems="center" sx={{ width: 140 }}>
                  <SPMGauge value={p.total > 0 ? Math.round((p.disponible / p.total) * 100) : 0} max={100} height={120} color={BUDGET_COLORS.disponible} />
                  <Typography variant="caption" sx={{ fontWeight: 600, mt: 0.5 }}>{t('dash_disponible', 'Disponible')} MUSD {fmt(p.disponible)}</Typography>
                </Stack>
              </Stack>
              {topC.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>{t('dash_top_centros', 'Top Centros')}</Typography>
                  {topC.map((c, i) => (
                    <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                      <Typography variant="caption" sx={{ width: 80, flexShrink: 0 }}>{c.nombre}</Typography>
                      <Box sx={{ flex: 1, height: 8, bgcolor: 'grey.100', borderRadius: 1, overflow: 'hidden' }}>
                        <Box sx={{ width: `${c.monto > 0 ? Math.min(100, (c.utilizado / c.monto) * 100) : 0}%`, height: '100%', bgcolor: BUDGET_COLORS.utilizado, borderRadius: 1 }} />
                      </Box>
                      <Typography variant="caption" sx={{ width: 70, textAlign: 'right' }}>KUSD {fmt(c.utilizado)}</Typography>
                    </Stack>
                  ))}
                </Box>
              )}
              {topS.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>{t('dash_top_sectores', 'Top Sectores')}</Typography>
                  {topS.map((s, i) => (
                    <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                      <Typography variant="caption" sx={{ width: 100, flexShrink: 0 }}>{s.nombre}</Typography>
                      <Box sx={{ flex: 1, height: 8, bgcolor: 'grey.100', borderRadius: 1, overflow: 'hidden' }}>
                        <Box sx={{ width: `${s.monto > 0 ? Math.min(100, (s.utilizado / s.monto) * 100) : 0}%`, height: '100%', bgcolor: BUDGET_COLORS.disponible, borderRadius: 1 }} />
                      </Box>
                      <Typography variant="caption" sx={{ width: 70, textAlign: 'right' }}>KUSD {fmt(s.utilizado)}</Typography>
                    </Stack>
                  ))}
                </Box>
              )}
            </Stack>
          );
        })()}

        {/* Solicitudes Creadas - ampliado */}
        {expandedCard === 'solicitudes' && (
          <Box sx={{ height: 350 }}>
            <WeeklyRequestsKpiCard
              data={datosFiltrados.map(() => 1)}
              labels={[]}
              previousWeekTotal={null}
              trendPercentage={null}
              compact={false}
            />
          </Box>
        )}

        {/* Tiempos de Gestion - ampliado */}
        {expandedCard === 'tiempos' && (() => {
          const sols = datosFiltrados.filter(s => {
            const e = (s.estado || s.status || '').toLowerCase();
            return ['approved', 'aprobada', 'in_planning', 'in_treatment', 'treated', 'completed', 'closed'].some(st => e.includes(st));
          });
          let sumAprobacion = 0, sumPlanificacion = 0, sumProveedor = 0, count = 0;
          sols.forEach(s => {
            const creado = new Date(s.created_at || s.fecha_creacion);
            const aprobado = s.fecha_aprobacion ? new Date(s.fecha_aprobacion) : null;
            const planificado = s.fecha_planificacion ? new Date(s.fecha_planificacion) : null;
            if (aprobado) { sumAprobacion += Math.max(0, (aprobado - creado) / 86400000); count++; }
            if (planificado && aprobado) sumPlanificacion += Math.max(0, (planificado - aprobado) / 86400000);
          });
          const avgA = count > 0 ? Math.round(sumAprobacion / count) : 0;
          const avgP = count > 0 ? Math.round(sumPlanificacion / count) : 0;
          const avgPr = Math.max(0, Math.round(avgA * 0.7));
          const total = avgA + avgP + avgPr || 1;
          return (
            <Stack spacing={3} sx={{ py: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, textAlign: 'center' }}>{t('dash_promedio', 'Promedio')} total: {total}d</Typography>
              <Stack direction="row" spacing={0.5} sx={{ width: '100%', height: 32, borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ flex: avgA, bgcolor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>{avgA}d</Typography>
                </Box>
                <Box sx={{ flex: avgP, bgcolor: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>{avgP}d</Typography>
                </Box>
                <Box sx={{ flex: avgPr, bgcolor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>{avgPr}d</Typography>
                </Box>
              </Stack>
              <Stack direction="row" justifyContent="space-around">
                {[{ label: t('dash_aprobacion', 'Aprobación'), val: avgA, color: '#3b82f6' }, { label: t('dash_planificacion', 'Planificación'), val: avgP, color: '#f59e0b' }, { label: t('common_proveedor', 'Proveedor'), val: avgPr, color: '#10b981' }].map(item => (
                  <Stack key={item.label} alignItems="center" spacing={0.5}>
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: item.color }} />
                    <Typography variant="body2" sx={{ fontWeight: 700, color: item.color }}>{item.val}d</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{item.label}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>({total > 0 ? ((item.val / total) * 100).toFixed(0) : 0}%)</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          );
        })()}

        {/* Fuente de Abastecimiento - ampliado */}
        {expandedCard === 'fuente' && (() => {
          const compras = datosFiltrados.filter(s => {
            const origen = (s.origen_abastecimiento || '').toLowerCase();
            return origen === 'stock' || origen.includes('interno') || origen.includes('almacen');
          });
          const valInt = compras.reduce((sum, item) => sum + (item.valor || 0), 0);
          const itemsInt = compras.length;
          const externas = datosFiltrados.filter(s => {
            const o = (s.origen_abastecimiento || '').toLowerCase();
            return o && o !== 'stock' && !o.includes('interno') && !o.includes('almacen');
          });
          const valExt = externas.reduce((sum, s) => sum + (Number(s.monto_total) || Number(s.valor_estimado) || 0), 0);
          const itemsExt = externas.length;
          const polar = [
            { label: t('dash_stock_interno', 'Stock interno'), value: valInt || 0.01, color: SPM_COLORS.success },
            { label: t('dash_compra_externa', 'Compra externa'), value: valExt || 0.01, color: SPM_COLORS.warning },
          ];
          const tot = valInt + valExt;
          const fmt = (v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : (v || 0).toFixed(0);
          return (
            <Stack direction="row" alignItems="center" spacing={4} sx={{ py: 2 }}>
              <Box sx={{ width: 280, height: 280 }}>
                <SPMPolarArea data={polar} height={280} options={{ plugins: { legend: { display: true }, tooltip: TOOLTIP_CONFIG }, scales: { r: { display: false, beginAtZero: true } }, animation: ANIMATION_CONFIG }} />
              </Box>
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: SPM_COLORS.success }} />
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{t('dash_stock_interno', 'Stock interno')}</Typography>
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: SPM_COLORS.success, ml: 3.5 }}>USD {fmt(valInt)}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', ml: 3.5 }}>{itemsInt} items ({tot > 0 ? ((valInt / tot) * 100).toFixed(1) : 0}%)</Typography>
                </Box>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: SPM_COLORS.warning }} />
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{t('dash_compra_externa', 'Compra externa')}</Typography>
                  </Stack>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: SPM_COLORS.warning, ml: 3.5 }}>USD {fmt(valExt)}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', ml: 3.5 }}>{itemsExt} solicitudes ({tot > 0 ? ((valExt / tot) * 100).toFixed(1) : 0}%)</Typography>
                </Box>
              </Stack>
            </Stack>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}

export default memo(ExpandedCardDialog);
