/**
 * SupplierRiskMap - Supplier risk assessment page
 *
 * Shows supplier risk evaluations with KPI cards, critical alerts,
 * single-source warnings, and a filterable data table.
 * Admin users can trigger a full recalculation.
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

import ShieldIcon from '@mui/icons-material/Shield';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const [filters, setFilters] = useState({ nivel: '', search: '' });

  const isAdmin = user?.rol === 'admin' || user?.roles?.includes('admin');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mapRes, alertRes, ssRes] = await Promise.allSettled([
        api.get('/supplier-risk/map', { params: filters.nivel ? { nivel: filters.nivel } : {} }),
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

  // KPI computations
  const kpis = useMemo(() => {
    const total = suppliers.length;
    const critical = suppliers.filter(s => s.nivel === 'critical').length;
    const high = suppliers.filter(s => s.nivel === 'high').length;
    const ssCount = singleSource.length;
    return { total, critical, high, ssCount };
  }, [suppliers, singleSource]);

  const columnDefs = useMemo(() => [
    { field: 'proveedor_nombre', headerName: t('risk_proveedor', 'Proveedor'), flex: 2, minWidth: 200 },
    { field: 'proveedor_cuit', headerName: t('risk_cuit', 'CUIT'), width: 140 },
    {
      field: 'score_riesgo', headerName: t('risk_score', 'Score Riesgo'), width: 130,
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(1) : '-',
      sort: 'desc',
    },
    {
      field: 'nivel', headerName: t('risk_nivel', 'Nivel'), width: 120,
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
      field: 'riesgo_entrega', headerName: t('risk_entrega', 'Entrega'), width: 100,
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(0) : '-',
    },
    {
      field: 'riesgo_calidad', headerName: t('risk_calidad', 'Calidad'), width: 100,
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(0) : '-',
    },
    {
      field: 'riesgo_dependencia', headerName: t('risk_dependencia', 'Dependencia'), width: 120,
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(0) : '-',
    },
  ], [t]);

  // Selected supplier detail
  const selectedSupplier = useMemo(() => {
    if (!expandedRow) return null;
    return suppliers.find(s => (s.id || s.proveedor_cuit) === expandedRow);
  }, [expandedRow, suppliers]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
          >
            {t('risk_recalculate', 'Recalcular Todo')}
          </Button>
        )}
      </Stack>

      {/* KPI Cards */}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        {[
          { label: t('risk_kpi_total', 'Proveedores Evaluados'), value: kpis.total, color: 'primary.main' },
          { label: t('risk_kpi_critical', 'Riesgo Critico'), value: kpis.critical, color: 'error.main' },
          { label: t('risk_kpi_high', 'Riesgo Alto'), value: kpis.high, color: 'warning.main' },
          { label: t('risk_kpi_single_source', 'Single Source'), value: kpis.ssCount, color: 'info.main' },
        ].map((kpi) => (
          <Paper key={kpi.label} elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">{kpi.label}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: kpi.color, mt: 0.5 }}>
              {kpi.value}
            </Typography>
          </Paper>
        ))}
      </Stack>

      {/* Alerts Panel */}
      {(alerts.length > 0 || singleSource.length > 0) && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Box
            sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setAlertsExpanded(!alertsExpanded)}
            role="button"
            aria-expanded={alertsExpanded}
            tabIndex={0}
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <WarningAmberIcon sx={{ color: 'warning.main' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('risk_alerts_title', 'Alertas de Riesgo')}
              </Typography>
              <Chip size="small" label={alerts.length + singleSource.length} color="warning" />
            </Stack>
            {alertsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>
          <Collapse in={alertsExpanded}>
            <Box sx={{ p: 2, pt: 0 }}>
              <Stack spacing={1}>
                {alerts.map((alert, idx) => (
                  <Alert key={`alert-${idx}`} severity={alert.nivel === 'critical' ? 'error' : 'warning'} variant="outlined">
                    <Typography variant="body2">
                      <strong>{alert.proveedor_nombre || alert.proveedor_cuit}</strong>: {alert.mensaje || alert.descripcion}
                    </Typography>
                  </Alert>
                ))}
                {singleSource.map((ss, idx) => (
                  <Alert key={`ss-${idx}`} severity="info" variant="outlined">
                    <Typography variant="body2">
                      <strong>{t('risk_single_source_alert', 'Single Source')}</strong>: {ss.material || ss.categoria} - {ss.proveedor_nombre || ss.proveedor_cuit}
                    </Typography>
                  </Alert>
                ))}
              </Stack>
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
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
            sx={{ minWidth: 200 }}
          />
        </Stack>
      </Paper>

      {/* Main content: table + optional detail panel */}
      <Stack direction={{ xs: 'column', lg: 'row' }} gap={3}>
        {/* Data Table */}
        <Paper
          elevation={0}
          sx={{ flex: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
          aria-label={t('risk_title', 'Mapa de Riesgo de Proveedores')}
        >
          <SPMAgGrid
            columnDefs={columnDefs}
            rowData={suppliers}
            loading={loading}
            height={500}
            pagination={true}
            paginationPageSize={20}
            enableQuickFilter={true}
            onRowClick={(row) => setExpandedRow(row.id || row.proveedor_cuit)}
            exportFileName="riesgo_proveedores"
            emptyMessage={t('risk_empty', 'No hay proveedores evaluados')}
            getRowId={(params) => String(params.data.id || params.data.proveedor_cuit)}
          />
        </Paper>

        {/* Detail Panel: RiskScoreBreakdown */}
        {selectedSupplier && (
          <Paper
            elevation={0}
            sx={{ flex: 1, minWidth: 320, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}
            aria-label={t('risk_breakdown_title', 'Desglose de Riesgo')}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              {selectedSupplier.proveedor_nombre || selectedSupplier.proveedor_cuit}
            </Typography>
            <RiskScoreBreakdown risk={selectedSupplier} />
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
