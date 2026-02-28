/**
 * SupplierRiskMap - Supplier risk assessment dashboard
 *
 * Shows supplier risk evaluations with KPI cards, risk distribution summary,
 * top risky suppliers, alerts, and a filterable data table with detail panel.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import { useUser } from '../store/authStore';
import api from '../services/api';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';

import ShieldIcon from '@mui/icons-material/Shield';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import RiskScoreBreakdown from '../components/RiskScoreBreakdown';

const NIVEL_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'low', label: 'Bajo' },
  { value: 'medium', label: 'Medio' },
  { value: 'high', label: 'Alto' },
  { value: 'critical', label: 'Critico' },
];

const NIVEL_COLORS = {
  low: 'success',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

const NIVEL_LABELS = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  critical: 'Critico',
};

function getScoreColor(score) {
  const v = Number(score) || 0;
  if (v <= 25) return '#22c55e';
  if (v <= 50) return '#eab308';
  if (v <= 75) return '#f97316';
  return '#ef4444';
}

// Inline score bar for the grid
function ScoreBar({ value }) {
  const v = Number(value) || 0;
  const color = getScoreColor(v);
  return (
    <Stack direction="row" alignItems="center" gap={1} sx={{ width: '100%' }}>
      <Box sx={{ flex: 1, height: 6, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden', minWidth: 40 }}>
        <Box sx={{ width: `${Math.min(v, 100)}%`, height: '100%', bgcolor: color, borderRadius: 1 }} />
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 600, color, minWidth: 32, textAlign: 'right', fontSize: '0.8rem' }}>
        {v.toFixed(1)}
      </Typography>
    </Stack>
  );
}

export default function SupplierRiskMap() {
  const { t } = useI18n();
  const toast = useToast();
  const user = useUser();

  const [suppliers, setSuppliers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [singleSource, setSingleSource] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [filters, setFilters] = useState({ nivel: '', search: '' });

  const isAdmin = user?.rol === 'admin' || user?.roles?.includes('admin');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mapRes, alertRes, ssRes] = await Promise.allSettled([
        api.get('/supplier-risk/map', { params: {
          ...(filters.nivel ? { nivel: filters.nivel } : {}),
          per_page: 200,
        } }),
        api.get('/supplier-risk/alerts'),
        api.get('/supplier-risk/single-source'),
      ]);

      if (mapRes.status === 'fulfilled' && mapRes.value.data?.ok) {
        setSuppliers(mapRes.value.data.suppliers || mapRes.value.data.data || []);
      }
      if (alertRes.status === 'fulfilled' && alertRes.value.data?.ok) {
        setAlerts(alertRes.value.data.alerts || alertRes.value.data.data || []);
      }
      if (ssRes.status === 'fulfilled' && ssRes.value.data?.ok) {
        setSingleSource(ssRes.value.data.single_source || ssRes.value.data.data || []);
      }
    } catch {
      toast.error(t('risk_error_load', 'Error al cargar datos de riesgo'));
    } finally {
      setLoading(false);
    }
  }, [filters.nivel, t, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleRecalculate = useCallback(async () => {
    try {
      setRecalculating(true);
      const res = await api.post('/supplier-risk/recalculate');
      if (res.data?.ok) {
        toast.success(t('risk_recalculate_success', 'Riesgo recalculado correctamente'));
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('risk_recalculate_error', 'Error al recalcular riesgo'));
    } finally {
      setRecalculating(false);
    }
  }, [fetchData, t, toast]);

  // Client-side search filter
  const filteredSuppliers = useMemo(() => {
    if (!filters.search) return suppliers;
    const term = filters.search.toLowerCase();
    return suppliers.filter(s =>
      (s.proveedor_nombre || '').toLowerCase().includes(term) ||
      (s.proveedor_cuit || '').toLowerCase().includes(term)
    );
  }, [suppliers, filters.search]);

  // KPI computations
  const kpis = useMemo(() => {
    const total = suppliers.length;
    const critical = suppliers.filter(s => s.nivel === 'critical').length;
    const high = suppliers.filter(s => s.nivel === 'high').length;
    const medium = suppliers.filter(s => s.nivel === 'medium').length;
    const low = suppliers.filter(s => s.nivel === 'low').length;
    const avgScore = total > 0 ? suppliers.reduce((sum, s) => sum + (Number(s.score_riesgo) || 0), 0) / total : 0;
    const ssCount = singleSource.length;

    // Top risk dimensions across all suppliers
    const avgEntrega = total > 0 ? suppliers.reduce((sum, s) => sum + (Number(s.riesgo_entrega) || 0), 0) / total : 0;
    const avgCalidad = total > 0 ? suppliers.reduce((sum, s) => sum + (Number(s.riesgo_calidad) || 0), 0) / total : 0;
    const avgDependencia = total > 0 ? suppliers.reduce((sum, s) => sum + (Number(s.riesgo_dependencia) || 0), 0) / total : 0;

    return { total, critical, high, medium, low, avgScore, ssCount, avgEntrega, avgCalidad, avgDependencia };
  }, [suppliers, singleSource]);

  // Top 5 riskiest suppliers
  const topRisky = useMemo(() => {
    return [...suppliers].sort((a, b) => (b.score_riesgo || 0) - (a.score_riesgo || 0)).slice(0, 5);
  }, [suppliers]);

  // Consolidated critical alerts (limit to most important)
  const criticalAlerts = useMemo(() => {
    return alerts.filter(a => a.nivel === 'critical' || a.nivel === 'high').slice(0, 8);
  }, [alerts]);

  // Top single-source by spend
  const topSingleSource = useMemo(() => {
    return [...singleSource].sort((a, b) => (b.gasto_total || 0) - (a.gasto_total || 0)).slice(0, 5);
  }, [singleSource]);

  const columnDefs = useMemo(() => [
    { field: 'proveedor_nombre', headerName: t('risk_proveedor', 'Proveedor'), flex: 2, minWidth: 180 },
    { field: 'proveedor_cuit', headerName: 'CUIT', width: 120 },
    {
      field: 'score_riesgo', headerName: t('risk_score', 'Score'), width: 150,
      cellRenderer: (p) => <ScoreBar value={p.value} />,
      sort: 'desc',
    },
    {
      field: 'nivel', headerName: t('risk_nivel', 'Nivel'), width: 110,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={NIVEL_LABELS[p.value] || p.value}
          color={NIVEL_COLORS[p.value] || 'default'}
          variant={p.value === 'critical' ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      field: 'riesgo_entrega', headerName: t('risk_entrega', 'Entrega'), width: 90,
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(0) : '-',
      cellStyle: (p) => ({ color: getScoreColor(p.value), fontWeight: 600 }),
    },
    {
      field: 'riesgo_calidad', headerName: t('risk_calidad', 'Calidad'), width: 90,
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(0) : '-',
      cellStyle: (p) => ({ color: getScoreColor(p.value), fontWeight: 600 }),
    },
    {
      field: 'riesgo_dependencia', headerName: t('risk_dependencia', 'Depend.'), width: 90,
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(0) : '-',
      cellStyle: (p) => ({ color: getScoreColor(p.value), fontWeight: 600 }),
    },
    {
      field: 'es_fuente_unica', headerName: 'F.U.', width: 60,
      cellRenderer: (p) => p.value ? (
        <Tooltip title={t('risk_single_source_tooltip', 'Fuente unica - sin proveedor alternativo')}>
          <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 18, mt: 0.5 }} />
        </Tooltip>
      ) : null,
    },
  ], [t]);

  // Selected supplier detail
  const selectedSupplier = useMemo(() => {
    if (!expandedRow) return null;
    return filteredSuppliers.find(s => (s.id || s.proveedor_cuit) === expandedRow);
  }, [expandedRow, filteredSuppliers]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <ShieldIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('risk_title', 'Mapa de Riesgo de Proveedores')}
          </Typography>
        </Stack>
        {isAdmin && (
          <Button
            variant="outlined"
            startIcon={recalculating ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleRecalculate}
            disabled={recalculating}
            size="small"
          >
            {t('risk_recalculate', 'Recalcular Todo')}
          </Button>
        )}
      </Stack>

      {/* Row 1: KPI Cards + Score Promedio */}
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
        {/* Score Promedio Global - card grande */}
        <Paper elevation={0} sx={{ flex: 1, p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
            {t('risk_avg_score', 'Score Promedio')}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, color: getScoreColor(kpis.avgScore), lineHeight: 1.3 }}>
            {kpis.avgScore.toFixed(1)}
          </Typography>
          <Chip
            size="small"
            label={kpis.avgScore < 25 ? 'Bajo' : kpis.avgScore < 50 ? 'Medio' : kpis.avgScore < 75 ? 'Alto' : 'Critico'}
            color={kpis.avgScore < 25 ? 'success' : kpis.avgScore < 50 ? 'warning' : 'error'}
            variant="outlined"
            sx={{ mt: 0.5 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            {t('risk_avg_desc', 'Promedio ponderado de todos los proveedores evaluados')}
          </Typography>
        </Paper>

        {/* Distribucion por nivel */}
        <Paper elevation={0} sx={{ flex: 2, p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
            {t('risk_distribution', 'Distribucion por Nivel de Riesgo')}
          </Typography>
          <Stack spacing={1.2}>
            {[
              { label: 'Critico', count: kpis.critical, color: '#ef4444', key: 'critical' },
              { label: 'Alto', count: kpis.high, color: '#f97316', key: 'high' },
              { label: 'Medio', count: kpis.medium, color: '#eab308', key: 'medium' },
              { label: 'Bajo', count: kpis.low, color: '#22c55e', key: 'low' },
            ].map(item => {
              const pct = kpis.total > 0 ? (item.count / kpis.total) * 100 : 0;
              return (
                <Stack key={item.key} direction="row" alignItems="center" gap={1}>
                  <Typography variant="body2" sx={{ width: 55, fontWeight: 500, fontSize: '0.8rem' }}>{item.label}</Typography>
                  <Box sx={{ flex: 1, height: 14, bgcolor: 'grey.100', borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
                    <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: item.color, borderRadius: 1, transition: 'width 0.5s' }} />
                  </Box>
                  <Typography variant="body2" sx={{ minWidth: 55, textAlign: 'right', fontWeight: 600, fontSize: '0.8rem' }}>
                    {item.count} ({pct.toFixed(0)}%)
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {t('risk_total_evaluated', '{count} proveedores evaluados').replace('{count}', kpis.total)}
          </Typography>
        </Paper>

        {/* Dimensiones promedio */}
        <Paper elevation={0} sx={{ flex: 1.5, p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
            {t('risk_avg_dimensions', 'Riesgo Promedio por Dimension')}
          </Typography>
          <Stack spacing={1.5}>
            {[
              { label: t('risk_dim_entrega', 'Entrega'), value: kpis.avgEntrega, icon: '🚚' },
              { label: t('risk_dim_calidad', 'Calidad'), value: kpis.avgCalidad, icon: '🔍' },
              { label: t('risk_dim_dependencia', 'Dependencia'), value: kpis.avgDependencia, icon: '🔗' },
            ].map(dim => (
              <Box key={dim.label}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.3 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>{dim.label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: getScoreColor(dim.value), fontSize: '0.8rem' }}>
                    {dim.value.toFixed(1)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(dim.value, 100)}
                  sx={{
                    height: 8, borderRadius: 1, bgcolor: 'grey.100',
                    '& .MuiLinearProgress-bar': { bgcolor: getScoreColor(dim.value), borderRadius: 1 },
                  }}
                />
              </Box>
            ))}
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" alignItems="center" gap={0.5}>
            <WarningAmberIcon sx={{ color: 'info.main', fontSize: 16 }} />
            <Typography variant="caption" color="text.secondary">
              {t('risk_single_source_count', '{count} materiales sin proveedor alternativo').replace('{count}', kpis.ssCount)}
            </Typography>
          </Stack>
        </Paper>
      </Stack>

      {/* Row 2: Top Riesgosos + Alertas */}
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
        {/* Top 5 Proveedores mas riesgosos */}
        <Paper elevation={0} sx={{ flex: 1, p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
            <TrendingUpIcon sx={{ color: 'error.main', fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {t('risk_top_risky', 'Proveedores con Mayor Riesgo')}
            </Typography>
          </Stack>
          <Stack spacing={1}>
            {topRisky.map((s, idx) => (
              <Box
                key={s.proveedor_cuit}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1,
                  bgcolor: idx === 0 ? 'error.50' : 'transparent',
                  cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' },
                  border: expandedRow === (s.id || s.proveedor_cuit) ? '1px solid' : '1px solid transparent',
                  borderColor: expandedRow === (s.id || s.proveedor_cuit) ? 'primary.main' : 'transparent',
                }}
                onClick={() => setExpandedRow(s.id || s.proveedor_cuit)}
              >
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', width: 18 }}>{idx + 1}</Typography>
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.proveedor_nombre || s.proveedor_cuit}
                  </Typography>
                  <Stack direction="row" gap={0.5} sx={{ mt: 0.3 }}>
                    {s.es_fuente_unica && <Chip size="small" label="F.U." color="info" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />}
                    <Typography variant="caption" color="text.secondary">
                      E:{Number(s.riesgo_entrega || 0).toFixed(0)} C:{Number(s.riesgo_calidad || 0).toFixed(0)} D:{Number(s.riesgo_dependencia || 0).toFixed(0)}
                    </Typography>
                  </Stack>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: getScoreColor(s.score_riesgo) }}>
                    {Number(s.score_riesgo || 0).toFixed(1)}
                  </Typography>
                  <Chip
                    size="small"
                    label={NIVEL_LABELS[s.nivel] || s.nivel}
                    color={NIVEL_COLORS[s.nivel] || 'default'}
                    variant={s.nivel === 'critical' ? 'filled' : 'outlined'}
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                </Box>
              </Box>
            ))}
          </Stack>
        </Paper>

        {/* Alertas + Single Source (collapsible, compact) */}
        <Paper elevation={0} sx={{ flex: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          {/* Critical alerts */}
          <Box sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
              <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('risk_alerts_title', 'Alertas de Riesgo')}
              </Typography>
              <Chip size="small" label={alerts.length} color="warning" sx={{ height: 20, fontSize: '0.7rem' }} />
            </Stack>
            {criticalAlerts.length > 0 ? (
              <Stack spacing={0.5}>
                {criticalAlerts.map((alert, idx) => (
                  <Alert key={`alert-${idx}`} severity={alert.nivel === 'critical' ? 'error' : 'warning'} variant="outlined" sx={{ py: 0, '& .MuiAlert-message': { py: 0.5 } }}>
                    <Typography variant="caption" sx={{ lineHeight: 1.4 }}>
                      <strong>{alert.proveedor_nombre || alert.proveedor_cuit}</strong>: {alert.alerta || alert.mensaje}
                    </Typography>
                  </Alert>
                ))}
                {alerts.length > criticalAlerts.length && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                    +{alerts.length - criticalAlerts.length} {t('risk_more_alerts', 'alertas mas')}
                  </Typography>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">{t('risk_no_alerts', 'Sin alertas activas')}</Typography>
            )}
          </Box>

          <Divider />

          {/* Single Source - collapsible */}
          <Box>
            <Box
              sx={{ p: 1.5, px: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              onClick={() => setAlertsExpanded(!alertsExpanded)}
            >
              <Stack direction="row" alignItems="center" gap={1}>
                <InfoOutlinedIcon sx={{ color: 'info.main', fontSize: 18 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  {t('risk_single_source_title', 'Materiales Fuente Unica')}
                </Typography>
                <Chip size="small" label={singleSource.length} color="info" sx={{ height: 20, fontSize: '0.7rem' }} />
              </Stack>
              {alertsExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
            </Box>
            <Collapse in={alertsExpanded}>
              <Box sx={{ px: 2, pb: 2 }}>
                <Stack spacing={0.5}>
                  {topSingleSource.map((ss, idx) => (
                    <Stack key={`ss-${idx}`} direction="row" alignItems="center" gap={1} sx={{ py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', width: 14 }}>{idx + 1}</Typography>
                      <Box sx={{ flex: 1, overflow: 'hidden' }}>
                        <Typography variant="caption" sx={{ fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ss.material_descripcion || ss.material_codigo}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          {ss.proveedor_nombre || ss.proveedor_cuit} - {ss.num_ordenes} OC - ${Number(ss.gasto_total || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                  {singleSource.length > 5 && (
                    <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                      +{singleSource.length - 5} {t('risk_more_materials', 'materiales mas')}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Collapse>
          </Box>
        </Paper>
      </Stack>

      {/* Row 3: Filters */}
      <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>{t('risk_filter_nivel', 'Nivel')}</InputLabel>
            <Select
              value={filters.nivel}
              label={t('risk_filter_nivel', 'Nivel')}
              onChange={(e) => handleFilterChange('nivel', e.target.value)}
            >
              {NIVEL_OPTIONS.map(o => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t('risk_filter_search', 'Buscar proveedor')}
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            sx={{ minWidth: 200, flex: 1 }}
          />
          <Stack direction="row" gap={1.5} sx={{ ml: 'auto' }}>
            {[
              { label: t('risk_legend_low', 'Bajo'), color: '#22c55e', range: '0-25' },
              { label: t('risk_legend_medium', 'Medio'), color: '#eab308', range: '25-50' },
              { label: t('risk_legend_high', 'Alto'), color: '#f97316', range: '50-75' },
              { label: t('risk_legend_critical', 'Critico'), color: '#ef4444', range: '75-100' },
            ].map(item => (
              <Tooltip key={item.label} title={`Score ${item.range}`}>
                <Stack direction="row" alignItems="center" gap={0.3}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{item.label}</Typography>
                </Stack>
              </Tooltip>
            ))}
          </Stack>
        </Stack>
      </Paper>

      {/* Row 4: Data Table + Detail Panel */}
      <Stack direction={{ xs: 'column', lg: 'row' }} gap={2}>
        {/* Data Table */}
        <Paper
          elevation={0}
          sx={{ flex: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
        >
          <SPMAgGrid
            columnDefs={columnDefs}
            rowData={filteredSuppliers}
            loading={loading}
            height={480}
            pagination={true}
            paginationPageSize={20}
            enableQuickFilter={false}
            onRowClick={(row) => setExpandedRow(row.id || row.proveedor_cuit)}
            exportFileName="riesgo_proveedores"
            emptyMessage={t('risk_empty', 'No hay proveedores evaluados')}
            getRowId={(params) => String(params.data.id || params.data.proveedor_cuit)}
          />
        </Paper>

        {/* Detail Panel: always visible */}
        <Paper
          elevation={0}
          sx={{ flex: 1, minWidth: 300, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5 }}
        >
          {selectedSupplier ? (
            <>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                {selectedSupplier.proveedor_nombre || selectedSupplier.proveedor_cuit}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                CUIT: {selectedSupplier.proveedor_cuit}
                {selectedSupplier.es_fuente_unica && (
                  <Chip size="small" label={t('risk_single_source_badge', 'Fuente Unica')} color="info" variant="outlined" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
                )}
              </Typography>
              <RiskScoreBreakdown risk={selectedSupplier} />
            </>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, gap: 1 }}>
              <TouchAppIcon sx={{ fontSize: 48, color: 'grey.300' }} />
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                {t('risk_select_supplier', 'Selecciona un proveedor de la tabla o del ranking para ver su desglose de riesgo')}
              </Typography>
              <Stack direction="row" gap={1} sx={{ mt: 1 }}>
                {[
                  { label: t('risk_dim_financiero', 'Financiero'), icon: '💰' },
                  { label: t('risk_dim_entrega', 'Entrega'), icon: '🚚' },
                  { label: t('risk_dim_calidad', 'Calidad'), icon: '🔍' },
                  { label: t('risk_dim_dependencia', 'Dependencia'), icon: '🔗' },
                  { label: t('risk_dim_geografico', 'Geografico'), icon: '🌍' },
                ].map(dim => (
                  <Tooltip key={dim.label} title={dim.label}>
                    <Typography variant="body1" sx={{ opacity: 0.3 }}>{dim.icon}</Typography>
                  </Tooltip>
                ))}
              </Stack>
            </Box>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
