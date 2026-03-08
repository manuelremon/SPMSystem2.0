import { memo, useState, useEffect } from 'react';
import { ScrollReveal } from '../../components/ui/ScrollReveal';
import { SPM_COLORS, FONT_SIZES } from '../../components/ui/SPMChartJS';
import { cachedGet } from '../../services/cachedApi';
import { useI18n } from '../../context/i18n';
// MUI
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
// Icons
import InventoryIcon from '@mui/icons-material/Inventory';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import TimerIcon from '@mui/icons-material/Timer';
import ScoreboardIcon from '@mui/icons-material/Scoreboard';
import VerifiedIcon from '@mui/icons-material/Verified';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SavingsIcon from '@mui/icons-material/Savings';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';

const cardSx = {
  flex: '1 1 280px',
  minWidth: 260,
  maxWidth: 380,
  bgcolor: 'var(--surface)',
  border: '1px solid',
  borderColor: 'divider',
  p: 1.5,
  transition: 'box-shadow 0.2s ease-in-out',
  '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  overflow: 'hidden',
};

const headerSx = {
  fontWeight: 600,
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  fontSize: FONT_SIZES.md,
};

const valueSx = {
  fontWeight: 700,
  fontSize: '1.25rem',
  fontFamily: 'monospace',
  fontVariantNumeric: 'tabular-nums',
};

const labelSx = {
  fontSize: FONT_SIZES.sm,
  color: 'text.secondary',
};

const miniBarSx = (pct, color) => ({
  height: 6,
  borderRadius: 3,
  bgcolor: 'grey.200',
  position: 'relative',
  overflow: 'hidden',
  '&::after': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: `${Math.min(pct, 100)}%`,
    bgcolor: color,
    borderRadius: 3,
    transition: 'width 0.5s ease',
  },
});

function MetricRow({ label, value, sub, color }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="caption" sx={labelSx}>{label}</Typography>
      <Stack direction="row" alignItems="baseline" gap={0.5}>
        <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.78rem', color: color || 'text.primary' }}>
          {value}
        </Typography>
        {sub && <Typography variant="caption" sx={{ fontSize: FONT_SIZES.xs, color: 'text.disabled' }}>{sub}</Typography>}
      </Stack>
    </Stack>
  );
}

function formatMonto(val) {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
  return val.toFixed(0);
}

function getColor(pct, invert = false) {
  const p = invert ? 100 - pct : pct;
  if (p >= 80) return 'success.main';
  if (p >= 50) return 'warning.main';
  return 'error.main';
}

/**
 * KPIRow4 - Advanced KPIs (Tiers 1, 2, 3)
 * Fetches from /api/kpis/advanced
 */
function KPIRow4() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await cachedGet('/kpis/advanced');
        if (!cancelled && res.data?.ok) {
          setData(res.data.data);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <ScrollReveal delay={400}>
        <Typography variant="caption" sx={{ ...headerSx, mb: 1, display: 'block' }}>
          {t('dash_advanced_title', 'Métricas Avanzadas')}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1.5}>
          {[1, 2, 3, 4].map(i => (
            <Paper key={i} elevation={0} sx={{ ...cardSx, height: 140 }}>
              <Skeleton variant="text" width="60%" height={20} />
              <Skeleton variant="text" width="40%" height={32} sx={{ mt: 1 }} />
              <Skeleton variant="text" width="80%" height={16} sx={{ mt: 1 }} />
              <Skeleton variant="text" width="70%" height={16} />
            </Paper>
          ))}
        </Stack>
      </ScrollReveal>
    );
  }

  if (!data) return null;

  const sa = data.stockAging || {};
  const sotd = data.supplierOtd || {};
  const pe = data.productionEfficiency || {};
  const ia = data.inventoryAccuracy || {};
  const pc = data.procurementCycle || {};
  const ss = data.supplierScorecard || {};
  const qs = data.qualityScorecard || {};
  const fu = data.fleetUtilization || {};
  const fa = data.forecastAccuracy || {};
  const scr = data.supplyChainRisk || {};
  const ca = data.costAvoidance || {};
  const kh = data.kanbanHealth || {};

  return (
    <ScrollReveal delay={400}>
      {/* Tier 1 - Operational KPIs */}
      <Typography variant="caption" sx={{ ...headerSx, mb: 1, display: 'block' }}>
        {t('dash_tier1_title', 'KPIs Operativos')}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 3 }}>

        {/* Stock Aging */}
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <InventoryIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            <Typography variant="caption" sx={headerSx}>
              {t('dash_stock_aging', 'Aging de Stock')}
            </Typography>
          </Stack>
          <Tooltip title={`${sa.pctSinConsumo6m}% del stock no tuvo consumo en los últimos 6 meses`} arrow>
            <Typography sx={{ ...valueSx, color: sa.pctSinConsumo6m > 50 ? 'error.main' : 'warning.main' }}>
              {sa.pctSinConsumo6m}%
            </Typography>
          </Tooltip>
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 1 }}>
            sin consumo 6m
          </Typography>
          <MetricRow label="3 meses" value={`${sa.periodos?.['3m']?.materiales || 0} mat`} sub={`USD ${formatMonto(sa.periodos?.['3m']?.valor || 0)}`} />
          <MetricRow label="6 meses" value={`${sa.periodos?.['6m']?.materiales || 0} mat`} sub={`USD ${formatMonto(sa.periodos?.['6m']?.valor || 0)}`} />
          <MetricRow label="12 meses" value={`${sa.periodos?.['12m']?.materiales || 0} mat`} sub={`USD ${formatMonto(sa.periodos?.['12m']?.valor || 0)}`} />
        </Paper>

        {/* Supplier OTD */}
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <LocalShippingIcon sx={{ fontSize: 16, color: 'info.main' }} />
            <Typography variant="caption" sx={headerSx}>
              {t('dash_supplier_otd', 'OTD Proveedores')}
            </Typography>
          </Stack>
          <Typography sx={{ ...valueSx, color: getColor(sotd.otdGlobal) }}>
            {sotd.otdGlobal}%
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 1 }}>
            {sotd.totalDecisiones} decisiones • {sotd.totalProveedores} proveedores
          </Typography>
          {(sotd.proveedores || []).slice(0, 4).map((p, i) => {
            const otd = p.totalDecisiones > 0 ? Math.round((p.confirmadas / p.totalDecisiones) * 100) : 0;
            return (
              <Tooltip key={i} title={`${p.nombre || p.cuit} — OTD: ${otd}% (${p.confirmadas}/${p.totalDecisiones}) — Plazo prom: ${p.plazoPromedio}d`} arrow placement="left">
                <Box>
                  <MetricRow
                    label={p.nombre?.substring(0, 20) || p.cuit}
                    value={`${otd}%`}
                    sub={`${p.plazoPromedio}d`}
                    color={getColor(otd)}
                  />
                </Box>
              </Tooltip>
            );
          })}
        </Paper>

        {/* Production Efficiency */}
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <PrecisionManufacturingIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography variant="caption" sx={headerSx}>
              {t('dash_production_eff', 'Eficiencia Producción')}
            </Typography>
          </Stack>
          <Stack direction="row" gap={2} sx={{ mb: 1 }}>
            <Tooltip title={`Eficiencia: ${pe.eficiencia}% — Producido: ${formatMonto(pe.totalProducida)} / Planificado: ${formatMonto(pe.totalPlanificada)}`} arrow>
              <Box>
                <Typography sx={{ ...valueSx, color: getColor(pe.eficiencia) }}>{pe.eficiencia}%</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>eficiencia</Typography>
              </Box>
            </Tooltip>
            <Tooltip title={`Utilización de capacidad: ${pe.utilizacionCapacidad}% de los ${pe.totalItems} items planificados`} arrow>
              <Box>
                <Typography sx={{ ...valueSx, color: getColor(pe.utilizacionCapacidad) }}>{pe.utilizacionCapacidad}%</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>util. cap.</Typography>
              </Box>
            </Tooltip>
          </Stack>
          <Tooltip title={`Barra de eficiencia: ${pe.eficiencia}%`} arrow>
            <Box sx={miniBarSx(pe.eficiencia, SPM_COLORS.primary)} mb={0.5} />
          </Tooltip>
          <MetricRow label="Items totales" value={pe.totalItems} />
          <MetricRow label="Planificada" value={formatMonto(pe.totalPlanificada)} />
          <MetricRow label="Producida" value={formatMonto(pe.totalProducida)} />
          {(pe.workCenters || []).length > 0 && (
            <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
              {pe.workCenters.length} centros de trabajo
            </Typography>
          )}
        </Paper>

        {/* Inventory Accuracy */}
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <FactCheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
            <Typography variant="caption" sx={headerSx}>
              {t('dash_inv_accuracy', 'Precisión Inventario')}
            </Typography>
          </Stack>
          <Typography sx={{ ...valueSx, color: getColor(ia.precision) }}>
            {ia.precision}%
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 1 }}>
            varianza prom: {ia.varianzaPromedio}%
          </Typography>
          <MetricRow label="Contados" value={ia.totalItems} />
          <MetricRow label="Exactos" value={ia.exactos} color="success.main" />
          <MetricRow label="Sobrantes" value={ia.sobrantes} color="warning.main" />
          <MetricRow label="Faltantes" value={ia.faltantes} color="error.main" />
          <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>
            {Object.entries(ia.conteos || {}).map(([estado, cnt]) => (
              <Tooltip key={estado} title={`Estado "${estado}": ${cnt} conteos cíclicos`} arrow>
                <Chip size="small" label={`${estado}: ${cnt}`} variant="outlined"
                  sx={{ fontSize: '0.65rem', height: 20 }} />
              </Tooltip>
            ))}
          </Stack>
        </Paper>

        {/* Procurement Cycle */}
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <TimerIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
            <Typography variant="caption" sx={headerSx}>
              {t('dash_procurement_cycle', 'Ciclo de Compras')}
            </Typography>
          </Stack>
          <Typography sx={{ ...valueSx, color: 'text.primary' }}>
            {pc.diasTotal}d
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 1 }}>
            ciclo total promedio
          </Typography>
          <MetricRow label="Sol → Decisión" value={`${pc.diasSolicitudDecision}d`} />
          <MetricRow label="Orden Compra" value={`${pc.diasOrdenCompra}d`} />
          <MetricRow label="Decisiones" value={pc.totalDecisiones} />
          {(pc.trend || []).length > 0 && (
            <Stack direction="row" gap={0.25} alignItems="flex-end" sx={{ mt: 1, height: 24 }}>
              {pc.trend.map((t, i) => (
                <Tooltip key={i} title={`${t.mes}: ${t.dias}d`} arrow>
                  <Box sx={{
                    flex: 1, bgcolor: 'primary.light', borderRadius: '2px 2px 0 0',
                    height: `${Math.max(4, (t.dias / Math.max(...pc.trend.map(x => x.dias), 1)) * 24)}px`,
                    transition: 'height 0.3s',
                  }} />
                </Tooltip>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>

      {/* Tier 2 - Tactical KPIs */}
      <Typography variant="caption" sx={{ ...headerSx, mb: 1, display: 'block' }}>
        {t('dash_tier2_title', 'KPIs Tácticos')}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 3 }}>

        {/* Supplier Scorecard */}
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <ScoreboardIcon sx={{ fontSize: 16, color: 'info.main' }} />
            <Typography variant="caption" sx={headerSx}>
              {t('dash_supplier_score', 'Scorecard Proveedores')}
            </Typography>
          </Stack>
          <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid', borderColor: 'grey.100' } }}>
            {(ss.proveedores || []).slice(0, 6).map((p, i) => (
              <Tooltip key={i} title={`${p.nombre || p.cuit} — Gasto: USD ${(p.gastoTotal || 0).toLocaleString('es-AR')}${p.qualityPct !== null ? ` — Calidad: ${Math.round(p.qualityPct)}%` : ''}${p.riskLevel ? ` — Riesgo: ${p.riskLevel}` : ''}`} arrow placement="left">
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ py: 0.5 }}>
                  <Typography variant="caption" sx={{ flex: 1, fontSize: FONT_SIZES.sm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.nombre?.substring(0, 22) || p.cuit}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: FONT_SIZES.xs, color: 'text.secondary' }}>
                    USD {formatMonto(p.gastoTotal)}
                  </Typography>
                  {p.qualityPct !== null && (
                    <Chip size="small" label={`Q${Math.round(p.qualityPct)}%`}
                      color={p.qualityPct >= 80 ? 'success' : p.qualityPct >= 50 ? 'warning' : 'error'}
                      variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                  )}
                  {p.riskLevel && (
                    <Chip size="small" label={p.riskLevel}
                      color={p.riskLevel === 'bajo' ? 'success' : p.riskLevel === 'medio' ? 'warning' : 'error'}
                      variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                  )}
                </Stack>
              </Tooltip>
            ))}
            {(ss.proveedores || []).length === 0 && (
              <Typography variant="caption" sx={{ color: 'grey.400', py: 1, display: 'block', textAlign: 'center' }}>
                Sin datos
              </Typography>
            )}
          </Box>
        </Paper>

        {/* Quality Scorecard */}
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <VerifiedIcon sx={{ fontSize: 16, color: qs.passRate >= 80 ? 'success.main' : 'warning.main' }} />
            <Typography variant="caption" sx={headerSx}>
              {t('dash_quality_score', 'Calidad')}
            </Typography>
          </Stack>
          <Stack direction="row" gap={2} sx={{ mb: 1 }}>
            <Box>
              <Typography sx={{ ...valueSx, color: getColor(qs.passRate) }}>{qs.passRate}%</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>pass rate</Typography>
            </Box>
            <Box>
              <Typography sx={{ ...valueSx, color: 'text.primary' }}>{qs.totalReclamos}</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>reclamos</Typography>
            </Box>
          </Stack>
          <Box sx={miniBarSx(qs.passRate, qs.passRate >= 80 ? SPM_COLORS.success : SPM_COLORS.warning)} mb={1} />
          <MetricRow label="Checks totales" value={qs.totalChecks} />
          <MetricRow label="Desviación prom." value={`${qs.desviacionPromedio}%`} />
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
            {Object.entries(qs.garantias || {}).map(([estado, cnt]) => (
              <Tooltip key={estado} title={`Garantías en estado "${estado}": ${cnt} reclamos`} arrow>
                <Chip size="small" label={`${estado}: ${cnt}`} variant="outlined"
                  sx={{ fontSize: '0.6rem', height: 18 }} />
              </Tooltip>
            ))}
          </Stack>
        </Paper>

        {/* Fleet Utilization */}
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <DirectionsCarIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography variant="caption" sx={headerSx}>
              {t('dash_fleet_util', 'Utilización Flota')}
            </Typography>
          </Stack>
          <Stack direction="row" gap={2} sx={{ mb: 1 }}>
            <Box>
              <Typography sx={{ ...valueSx, color: getColor(fu.disponibilidadPct) }}>{fu.disponibilidadPct}%</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>disponible</Typography>
            </Box>
            <Box>
              <Typography sx={{ ...valueSx, color: 'text.primary' }}>{fu.totalVehiculos}</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>vehículos</Typography>
            </Box>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
            {Object.entries(fu.vehiculosPorEstado || {}).map(([est, cnt]) => (
              <Tooltip key={est} title={`${cnt} vehículos en estado "${est.replace('_', ' ')}"`} arrow>
                <Chip size="small" label={`${est}: ${cnt}`}
                  color={est === 'disponible' ? 'success' : est === 'en_mantenimiento' ? 'warning' : 'default'}
                  variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
              </Tooltip>
            ))}
          </Stack>
          <MetricRow label="OTs totales" value={fu.totalOrdenesTrabajo} />
          <MetricRow label="Costo total OT" value={`USD ${formatMonto(fu.costoTotalOT)}`} />
          <MetricRow label="Mant. próximo 30d" value={fu.mantenimientoProximo30d} color={fu.mantenimientoProximo30d > 0 ? 'warning.main' : 'text.primary'} />
        </Paper>

        {/* Forecast Accuracy */}
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <TrendingUpIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
            <Typography variant="caption" sx={headerSx}>
              {t('dash_forecast_acc', 'Precisión Pronóstico')}
            </Typography>
          </Stack>
          <Stack direction="row" gap={2} sx={{ mb: 1 }}>
            <Tooltip title={`Precisión del pronóstico: ${fa.accuracy}% — basado en ${fa.totalPronosticos} pronósticos`} arrow>
              <Box>
                <Typography sx={{ ...valueSx, color: getColor(fa.accuracy) }}>{fa.accuracy}%</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>accuracy</Typography>
              </Box>
            </Tooltip>
            <Tooltip title={`MAPE (Mean Absolute Percentage Error): ${fa.mape}% — ${fa.mape <= 10 ? 'Excelente' : fa.mape <= 20 ? 'Bueno' : fa.mape <= 30 ? 'Aceptable' : 'Requiere mejora'}`} arrow>
              <Box>
                <Typography sx={{ ...valueSx, color: fa.mape > 30 ? 'error.main' : 'text.primary' }}>{fa.mape}%</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>MAPE</Typography>
              </Box>
            </Tooltip>
          </Stack>
          <MetricRow label="Confianza prom." value={`${fa.confianzaPromedio}`} />
          <MetricRow label="Total pronósticos" value={fa.totalPronosticos} />
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
            {Object.entries(fa.porFuente || {}).map(([fuente, cnt]) => (
              <Tooltip key={fuente} title={`Fuente "${fuente.replace('_', ' ')}": ${cnt} pronósticos generados`} arrow>
                <Chip size="small" label={`${fuente.replace('_', ' ')}: ${cnt}`}
                  variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
              </Tooltip>
            ))}
          </Stack>
        </Paper>
      </Stack>

      {/* Tier 3 - Strategic KPIs */}
      <Typography variant="caption" sx={{ ...headerSx, mb: 1, display: 'block' }}>
        {t('dash_tier3_title', 'KPIs Estratégicos')}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1.5}>

        {/* Supply Chain Risk */}
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <WarningAmberIcon sx={{ fontSize: 16, color: 'error.main' }} />
            <Typography variant="caption" sx={headerSx}>
              {t('dash_scr', 'Riesgo Cadena Suministro')}
            </Typography>
          </Stack>
          <Stack direction="row" gap={2} sx={{ mb: 1 }}>
            <Box>
              <Typography sx={{ ...valueSx, color: 'text.primary' }}>{scr.totalProveedores}</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>evaluados</Typography>
            </Box>
            <Box>
              <Typography sx={{ ...valueSx, color: scr.fuenteUnica > 0 ? 'error.main' : 'success.main' }}>{scr.fuenteUnica}</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>fuente única</Typography>
            </Box>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
            {Object.entries(scr.porNivel || {}).map(([nivel, info]) => (
              <Tooltip key={nivel} title={`Riesgo ${nivel}: ${info.count} proveedores — Score promedio: ${info.scorePromedio}/100`} arrow>
                <Chip size="small"
                  label={`${nivel}: ${info.count} (${info.scorePromedio})`}
                  color={nivel === 'bajo' ? 'success' : nivel === 'medio' ? 'warning' : 'error'}
                  variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
              </Tooltip>
            ))}
          </Stack>
          <Box sx={{ '& > *:not(:last-child)': { borderBottom: '1px solid', borderColor: 'grey.100' } }}>
            {(scr.topRisk || []).slice(0, 4).map((p, i) => (
              <Tooltip key={i} title={`${p.nombre} — Score riesgo: ${p.score}/100 (${p.score > 70 ? 'Alto' : p.score > 40 ? 'Medio' : 'Bajo'})${p.fuenteUnica ? ' — Fuente Única (sin alternativa)' : ''}`} arrow placement="left">
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ py: 0.4 }}>
                  <Typography variant="caption" sx={{ flex: 1, fontSize: FONT_SIZES.sm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.nombre?.substring(0, 20)}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: FONT_SIZES.xs, color: p.score > 70 ? 'error.main' : p.score > 40 ? 'warning.main' : 'success.main' }}>
                    {p.score}
                  </Typography>
                  {p.fuenteUnica && (
                    <Tooltip title="Fuente Única: sin proveedores alternativos" arrow>
                      <Chip size="small" label="FU" color="error" variant="filled" sx={{ fontSize: '0.55rem', height: 16, minWidth: 24 }} />
                    </Tooltip>
                  )}
                </Stack>
              </Tooltip>
            ))}
          </Box>
        </Paper>

        {/* Cost Avoidance */}
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <SavingsIcon sx={{ fontSize: 16, color: 'success.main' }} />
            <Typography variant="caption" sx={headerSx}>
              {t('dash_cost_avoid', 'Ahorros y Cost Avoidance')}
            </Typography>
          </Stack>
          <Tooltip title={`USD ${(ca.negociaciones?.ahorroTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} arrow>
            <Typography sx={{ ...valueSx, color: 'success.main' }}>
              USD {formatMonto(ca.negociaciones?.ahorroTotal || 0)}
            </Typography>
          </Tooltip>
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 1 }}>
            ahorro por negociación
          </Typography>
          <MetricRow label="Negociaciones" value={ca.negociaciones?.total || 0} />
          <MetricRow label="Descuento prom." value={`${ca.negociaciones?.descuentoPromedio || 0}%`} />
          <MetricRow label="Aprobadas" value={ca.negociaciones?.aprobadas || 0} />
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ ...labelSx, fontWeight: 600 }}>Abastecimiento por fuente</Typography>
            {Object.entries(ca.abastecimiento || {}).map(([fuente, info]) => (
              <MetricRow key={fuente} label={fuente} value={`USD ${formatMonto(info.valor)}`} sub={`${info.items} items`} />
            ))}
          </Box>
        </Paper>

        {/* Kanban Health */}
        <Paper elevation={0} sx={cardSx}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 1 }}>
            <ViewKanbanIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            <Typography variant="caption" sx={headerSx}>
              {t('dash_kanban', 'Salud Kanban')}
            </Typography>
          </Stack>
          <Stack direction="row" gap={2} sx={{ mb: 1 }}>
            <Box>
              <Typography sx={{ ...valueSx, color: getColor(kh.eficiencia) }}>{kh.eficiencia}%</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>eficiencia</Typography>
            </Box>
            <Box>
              <Typography sx={{ ...valueSx, color: 'text.primary' }}>{kh.totalTarjetas}</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>tarjetas</Typography>
            </Box>
          </Stack>
          <Box sx={miniBarSx(kh.eficiencia, SPM_COLORS.primary)} mb={1} />
          <MetricRow label="Señales totales" value={kh.totalSenales} />
          <MetricRow label="Completadas" value={kh.senalesCompletadas} color="success.main" />
          <MetricRow label="Tiempo resp." value={`${kh.tiempoRespuestaHoras}h`} />
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
            {Object.entries(kh.tarjetas || {}).map(([est, info]) => (
              <Tooltip key={est} title={`Tarjetas "${est}": ${info.count} tarjetas kanban`} arrow>
                <Chip size="small"
                  label={`${est}: ${info.count}`}
                  variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
              </Tooltip>
            ))}
          </Stack>
        </Paper>
      </Stack>
    </ScrollReveal>
  );
}

export default memo(KPIRow4);
