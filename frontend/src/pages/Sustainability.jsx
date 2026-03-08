/**
 * Sustainability - ESG & Sustainability dashboard
 *
 * Displays KPI cards (emissions, ESG avg, goals), with tabbed views for
 * Dashboard summary, Emisiones, ESG Proveedores, Metas, and Huella Materiales.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatDate } from '../utils/formatters';

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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import AddIcon from '@mui/icons-material/Add';
import EcoIcon from '@mui/icons-material/EnergySavingsLeaf';
import Co2Icon from '@mui/icons-material/Co2';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NatureIcon from '@mui/icons-material/Nature';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const SCOPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'scope_1', label: 'Scope 1' },
  { value: 'scope_2', label: 'Scope 2' },
  { value: 'scope_3', label: 'Scope 3' },
];

const SCOPE_COLORS = {
  scope_1: 'error',
  scope_2: 'warning',
  scope_3: 'info',
};

const ESG_SCORE_COLOR = (val) => {
  if (val == null) return 'text.secondary';
  if (val >= 80) return 'success.main';
  if (val >= 60) return 'warning.main';
  return 'error.main';
};

const META_ESTADO_COLORS = {
  active: 'info',
  completed: 'success',
  expired: 'error',
  draft: 'default',
};

const META_ESTADO_LABELS = {
  active: 'Activa',
  completed: 'Cumplida',
  expired: 'Expirada',
  draft: 'Borrador',
};

const INITIAL_ESG_FORM = {
  proveedor_id: '',
  environmental: '',
  social: '',
  governance: '',
  notas: '',
};

const INITIAL_META_FORM = {
  nombre: '',
  descripcion: '',
  tipo: 'reduccion_emisiones',
  valor_objetivo: '',
  valor_actual: '',
  fecha_limite: '',
};

const INITIAL_HUELLA_FORM = {
  material_codigo: '',
  co2_por_unidad: '',
  unidad_medida: 'kg',
  fuente_datos: '',
};

export default function Sustainability() {
  const { t } = useI18n();
  const toast = useToast();

  const [tabValue, setTabValue] = useState(0);
  const [kpis, setKpis] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  // Emisiones
  const [emisiones, setEmisiones] = useState([]);
  const [loadingEmisiones, setLoadingEmisiones] = useState(false);
  const [emisionFilters, setEmisionFilters] = useState({ scope: '', categoria: '', periodo: '' });

  // ESG Proveedores
  const [esgProveedores, setEsgProveedores] = useState([]);
  const [loadingEsg, setLoadingEsg] = useState(false);
  const [esgDialogOpen, setEsgDialogOpen] = useState(false);
  const [esgForm, setEsgForm] = useState(INITIAL_ESG_FORM);
  const [submittingEsg, setSubmittingEsg] = useState(false);

  // Metas
  const [metas, setMetas] = useState([]);
  const [loadingMetas, setLoadingMetas] = useState(false);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [metaForm, setMetaForm] = useState(INITIAL_META_FORM);
  const [submittingMeta, setSubmittingMeta] = useState(false);

  // Huella Materiales
  const [huella, setHuella] = useState([]);
  const [loadingHuella, setLoadingHuella] = useState(false);
  const [huellaDialogOpen, setHuellaDialogOpen] = useState(false);
  const [huellaForm, setHuellaForm] = useState(INITIAL_HUELLA_FORM);
  const [submittingHuella, setSubmittingHuella] = useState(false);

  const fetchKPIs = useCallback(async () => {
    try {
      const res = await api.get('/sustainability/kpis');
      if (res.data?.ok) {
        setKpis(res.data.kpis || res.data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/sustainability/dashboard');
      if (res.data?.ok) {
        setDashboardData(res.data.dashboard || res.data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchEmisiones = useCallback(async () => {
    setLoadingEmisiones(true);
    try {
      const params = {};
      if (emisionFilters.scope) params.scope = emisionFilters.scope;
      if (emisionFilters.categoria) params.categoria = emisionFilters.categoria;
      if (emisionFilters.periodo) params.periodo = emisionFilters.periodo;
      const res = await api.get('/sustainability/emisiones', { params });
      if (res.data?.ok) {
        setEmisiones(res.data.emisiones || res.data.items || []);
      }
    } catch {
      toast.error(t('sust_error_emisiones', 'Error al cargar emisiones'));
    } finally {
      setLoadingEmisiones(false);
    }
  }, [emisionFilters, t, toast]);

  const fetchEsgProveedores = useCallback(async () => {
    setLoadingEsg(true);
    try {
      const res = await api.get('/sustainability/esg-proveedores');
      if (res.data?.ok) {
        setEsgProveedores(res.data.proveedores || res.data.items || []);
      }
    } catch {
      toast.error(t('sust_error_esg', 'Error al cargar evaluaciones ESG'));
    } finally {
      setLoadingEsg(false);
    }
  }, [t, toast]);

  const fetchMetas = useCallback(async () => {
    setLoadingMetas(true);
    try {
      const res = await api.get('/sustainability/metas');
      if (res.data?.ok) {
        setMetas(res.data.metas || res.data.items || []);
      }
    } catch {
      toast.error(t('sust_error_metas', 'Error al cargar metas'));
    } finally {
      setLoadingMetas(false);
    }
  }, [t, toast]);

  const fetchHuella = useCallback(async () => {
    setLoadingHuella(true);
    try {
      const res = await api.get('/sustainability/huella-materiales');
      if (res.data?.ok) {
        setHuella(res.data.materiales || res.data.items || []);
      }
    } catch {
      toast.error(t('sust_error_huella', 'Error al cargar huella de materiales'));
    } finally {
      setLoadingHuella(false);
    }
  }, [t, toast]);

  useEffect(() => { fetchKPIs(); }, [fetchKPIs]);

  useEffect(() => {
    if (tabValue === 0) fetchDashboard();
    if (tabValue === 1) fetchEmisiones();
    if (tabValue === 2) fetchEsgProveedores();
    if (tabValue === 3) fetchMetas();
    if (tabValue === 4) fetchHuella();
  }, [tabValue, fetchDashboard, fetchEmisiones, fetchEsgProveedores, fetchMetas, fetchHuella]);

  // ESG submit
  const handleEsgSubmit = useCallback(async () => {
    if (!esgForm.proveedor_id) {
      toast.warning(t('sust_esg_required', 'Seleccione un proveedor'));
      return;
    }
    setSubmittingEsg(true);
    try {
      const payload = {
        proveedor_id: esgForm.proveedor_id,
        environmental: esgForm.environmental ? Number(esgForm.environmental) : null,
        social: esgForm.social ? Number(esgForm.social) : null,
        governance: esgForm.governance ? Number(esgForm.governance) : null,
        notas: esgForm.notas,
      };
      const res = await api.post('/sustainability/esg-evaluaciones', payload);
      if (res.data?.ok) {
        toast.success(t('sust_esg_created', 'Evaluacion ESG registrada'));
        setEsgDialogOpen(false);
        setEsgForm(INITIAL_ESG_FORM);
        fetchEsgProveedores();
        fetchKPIs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('sust_error_esg_create', 'Error al registrar evaluacion'));
    } finally {
      setSubmittingEsg(false);
    }
  }, [esgForm, t, toast, fetchEsgProveedores, fetchKPIs]);

  // Meta submit
  const handleMetaSubmit = useCallback(async () => {
    if (!metaForm.nombre.trim() || !metaForm.valor_objetivo) {
      toast.warning(t('sust_meta_required', 'Complete nombre y valor objetivo'));
      return;
    }
    setSubmittingMeta(true);
    try {
      const payload = {
        ...metaForm,
        valor_objetivo: Number(metaForm.valor_objetivo),
        valor_actual: metaForm.valor_actual ? Number(metaForm.valor_actual) : 0,
      };
      const res = await api.post('/sustainability/metas', payload);
      if (res.data?.ok) {
        toast.success(t('sust_meta_created', 'Meta creada'));
        setMetaDialogOpen(false);
        setMetaForm(INITIAL_META_FORM);
        fetchMetas();
        fetchKPIs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('sust_error_meta_create', 'Error al crear meta'));
    } finally {
      setSubmittingMeta(false);
    }
  }, [metaForm, t, toast, fetchMetas, fetchKPIs]);

  // Huella submit
  const handleHuellaSubmit = useCallback(async () => {
    if (!huellaForm.material_codigo.trim() || !huellaForm.co2_por_unidad) {
      toast.warning(t('sust_huella_required', 'Complete material y CO2 por unidad'));
      return;
    }
    setSubmittingHuella(true);
    try {
      const payload = {
        ...huellaForm,
        co2_por_unidad: Number(huellaForm.co2_por_unidad),
      };
      const res = await api.post('/sustainability/huella-materiales', payload);
      if (res.data?.ok) {
        toast.success(t('sust_huella_created', 'Huella registrada'));
        setHuellaDialogOpen(false);
        setHuellaForm(INITIAL_HUELLA_FORM);
        fetchHuella();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('sust_error_huella_create', 'Error al registrar huella'));
    } finally {
      setSubmittingHuella(false);
    }
  }, [huellaForm, t, toast, fetchHuella]);

  // Column definitions
  const emisionColumnDefs = useMemo(() => [
    { field: 'origen', headerName: t('sust_col_origen', 'Origen'), flex: 1, minWidth: 140 },
    {
      field: 'scope',
      headerName: t('sust_col_scope', 'Scope'),
      width: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={p.value || '-'} color={SCOPE_COLORS[p.value] || 'default'} />
      ),
    },
    { field: 'categoria', headerName: t('sust_col_categoria', 'Categoria'), width: 140 },
    {
      field: 'cantidad',
      headerName: t('sust_col_cantidad', 'Cantidad (kg CO2e)'),
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toLocaleString('es-ES', { maximumFractionDigits: 2 }) : '-',
    },
    { field: 'material', headerName: t('sust_col_material', 'Material'), width: 140 },
    { field: 'proveedor', headerName: t('sust_col_proveedor', 'Proveedor'), width: 140 },
    { field: 'periodo', headerName: t('sust_col_periodo', 'Periodo'), width: 120 },
  ], [t]);

  const esgColumnDefs = useMemo(() => [
    { field: 'proveedor_nombre', headerName: t('sust_col_proveedor', 'Proveedor'), flex: 2, minWidth: 180 },
    {
      field: 'environmental',
      headerName: 'E',
      width: 80,
      type: 'numericColumn',
      cellRenderer: (p) => (
        <Typography variant="body2" sx={{ fontWeight: 600, color: ESG_SCORE_COLOR(p.value) }}>
          {p.value != null ? Number(p.value).toFixed(0) : '-'}
        </Typography>
      ),
    },
    {
      field: 'social',
      headerName: 'S',
      width: 80,
      type: 'numericColumn',
      cellRenderer: (p) => (
        <Typography variant="body2" sx={{ fontWeight: 600, color: ESG_SCORE_COLOR(p.value) }}>
          {p.value != null ? Number(p.value).toFixed(0) : '-'}
        </Typography>
      ),
    },
    {
      field: 'governance',
      headerName: 'G',
      width: 80,
      type: 'numericColumn',
      cellRenderer: (p) => (
        <Typography variant="body2" sx={{ fontWeight: 600, color: ESG_SCORE_COLOR(p.value) }}>
          {p.value != null ? Number(p.value).toFixed(0) : '-'}
        </Typography>
      ),
    },
    {
      field: 'overall',
      headerName: t('sust_col_overall', 'Overall'),
      width: 100,
      type: 'numericColumn',
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={p.value != null ? Number(p.value).toFixed(0) : '-'}
          color={p.value >= 80 ? 'success' : p.value >= 60 ? 'warning' : 'error'}
        />
      ),
    },
    {
      field: 'fecha_evaluacion',
      headerName: t('sust_col_fecha', 'Fecha'),
      width: 120,
      valueFormatter: (p) => formatDate(p.value),
    },
  ], [t]);

  const metaColumnDefs = useMemo(() => [
    { field: 'nombre', headerName: t('sust_col_nombre', 'Nombre'), flex: 2, minWidth: 200 },
    { field: 'tipo', headerName: t('sust_col_tipo', 'Tipo'), width: 160 },
    {
      field: 'progreso',
      headerName: t('sust_col_progreso', 'Progreso'),
      width: 200,
      cellRenderer: (p) => {
        const objetivo = p.data?.valor_objetivo || 0;
        const actual = p.data?.valor_actual || 0;
        const pct = objetivo > 0 ? Math.min((actual / objetivo) * 100, 100) : 0;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 1 }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{ flex: 1, height: 8 }}
              color={pct >= 100 ? 'success' : pct >= 50 ? 'warning' : 'error'}
            />
            <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right' }}>
              {pct.toFixed(0)}%
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'estado',
      headerName: t('sust_col_estado', 'Estado'),
      width: 120,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={META_ESTADO_LABELS[p.value] || p.value || '-'}
          color={META_ESTADO_COLORS[p.value] || 'default'}
        />
      ),
    },
    {
      field: 'fecha_limite',
      headerName: t('sust_col_fecha_limite', 'Fecha Limite'),
      width: 130,
      valueFormatter: (p) => formatDate(p.value),
    },
  ], [t]);

  const huellaColumnDefs = useMemo(() => [
    { field: 'material_codigo', headerName: t('sust_col_material', 'Material'), flex: 1, minWidth: 140 },
    { field: 'descripcion', headerName: t('sust_col_descripcion', 'Descripcion'), flex: 2, minWidth: 200 },
    {
      field: 'co2_por_unidad',
      headerName: t('sust_col_co2', 'CO2/Unidad (kg)'),
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toLocaleString('es-ES', { maximumFractionDigits: 4 }) : '-',
    },
    { field: 'unidad_medida', headerName: t('sust_col_unidad', 'Unidad'), width: 100 },
    { field: 'fuente_datos', headerName: t('sust_col_fuente', 'Fuente'), flex: 1, minWidth: 140 },
  ], [t]);

  const KpiCard = ({ icon, label, value, color }) => (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', flex: 1, minWidth: 160 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
        {icon}
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </Stack>
      <Typography variant="h5" sx={{ fontWeight: 700, color: color || 'text.primary' }}>
        {value != null ? value : '--'}
      </Typography>
    </Paper>
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1}>
        <EcoIcon sx={{ color: 'success.main' }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {t('sust_title', 'Sustentabilidad & ESG')}
        </Typography>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
          <KpiCard
            icon={<Co2Icon fontSize="small" sx={{ color: 'error.main' }} />}
            label={t('sust_kpi_emisiones', 'Emisiones Totales (kg CO2e)')}
            value={kpis.emisiones_totales != null ? Number(kpis.emisiones_totales).toLocaleString('es-ES') : null}
            color="error.main"
          />
          <KpiCard
            icon={<AssessmentIcon fontSize="small" sx={{ color: 'info.main' }} />}
            label={t('sust_kpi_esg', 'ESG Promedio')}
            value={kpis.esg_promedio != null ? Number(kpis.esg_promedio).toFixed(1) : null}
            color="info.main"
          />
          <KpiCard
            icon={<TrackChangesIcon fontSize="small" sx={{ color: 'warning.main' }} />}
            label={t('sust_kpi_metas_activas', 'Metas Activas')}
            value={kpis.metas_activas}
            color="warning.main"
          />
          <KpiCard
            icon={<CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />}
            label={t('sust_kpi_metas_cumplidas', 'Metas Cumplidas')}
            value={kpis.metas_cumplidas}
            color="success.main"
          />
        </Stack>
      )}

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={t('sust_tab_dashboard', 'Dashboard')} icon={<AssessmentIcon />} iconPosition="start" />
          <Tab label={t('sust_tab_emisiones', 'Emisiones')} icon={<Co2Icon />} iconPosition="start" />
          <Tab label={t('sust_tab_esg', 'ESG Proveedores')} icon={<BusinessIcon />} iconPosition="start" />
          <Tab label={t('sust_tab_metas', 'Metas')} icon={<TrackChangesIcon />} iconPosition="start" />
          <Tab label={t('sust_tab_huella', 'Huella Materiales')} icon={<CategoryIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Dashboard Summary */}
      {tabValue === 0 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          {dashboardData ? (
            <Stack spacing={3}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t('sust_dashboard_title', 'Resumen de Sustentabilidad')}
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} gap={3}>
                <Paper elevation={0} sx={{ flex: 1, p: 2, bgcolor: 'action.hover' }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <Co2Icon fontSize="small" color="error" />
                    <Typography variant="subtitle2">{t('sust_dash_emisiones', 'Emisiones por Scope')}</Typography>
                  </Stack>
                  {(dashboardData.emisiones_por_scope || []).map((s, idx) => (
                    <Stack key={idx} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                      <Chip size="small" label={s.scope} color={SCOPE_COLORS[s.scope] || 'default'} variant="outlined" />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {Number(s.total || 0).toLocaleString('es-ES')} kg
                      </Typography>
                    </Stack>
                  ))}
                </Paper>
                <Paper elevation={0} sx={{ flex: 1, p: 2, bgcolor: 'action.hover' }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <NatureIcon fontSize="small" color="success" />
                    <Typography variant="subtitle2">{t('sust_dash_metas', 'Estado de Metas')}</Typography>
                  </Stack>
                  <Typography variant="body2">
                    {t('sust_dash_activas', 'Activas')}: <strong>{dashboardData.metas_activas ?? 0}</strong>
                  </Typography>
                  <Typography variant="body2">
                    {t('sust_dash_cumplidas', 'Cumplidas')}: <strong>{dashboardData.metas_cumplidas ?? 0}</strong>
                  </Typography>
                  <Typography variant="body2">
                    {t('sust_dash_expiradas', 'Expiradas')}: <strong>{dashboardData.metas_expiradas ?? 0}</strong>
                  </Typography>
                </Paper>
                <Paper elevation={0} sx={{ flex: 1, p: 2, bgcolor: 'action.hover' }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <BusinessIcon fontSize="small" color="info" />
                    <Typography variant="subtitle2">{t('sust_dash_esg', 'ESG Proveedores')}</Typography>
                  </Stack>
                  <Typography variant="body2">
                    {t('sust_dash_evaluados', 'Evaluados')}: <strong>{dashboardData.proveedores_evaluados ?? 0}</strong>
                  </Typography>
                  <Typography variant="body2">
                    {t('sust_dash_promedio', 'Score Promedio')}: <strong>{dashboardData.esg_promedio != null ? Number(dashboardData.esg_promedio).toFixed(1) : '-'}</strong>
                  </Typography>
                </Paper>
              </Stack>
            </Stack>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}
        </Paper>
      )}

      {/* Tab 1: Emisiones */}
      {tabValue === 1 && (
        <>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>{t('sust_filter_scope', 'Scope')}</InputLabel>
                <Select
                  value={emisionFilters.scope}
                  label={t('sust_filter_scope', 'Scope')}
                  onChange={(e) => setEmisionFilters((prev) => ({ ...prev, scope: e.target.value }))}
                >
                  {SCOPE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label={t('sust_filter_categoria', 'Categoria')}
                value={emisionFilters.categoria}
                onChange={(e) => setEmisionFilters((prev) => ({ ...prev, categoria: e.target.value }))}
                sx={{ minWidth: 160 }}
              />
              <TextField
                size="small"
                label={t('sust_filter_periodo', 'Periodo')}
                value={emisionFilters.periodo}
                onChange={(e) => setEmisionFilters((prev) => ({ ...prev, periodo: e.target.value }))}
                placeholder="2026-01"
                sx={{ minWidth: 140 }}
              />
              <Button variant="outlined" size="small" onClick={fetchEmisiones}>
                {t('common_buscar', 'Buscar')}
              </Button>
            </Stack>
          </Paper>
          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider' }}
            aria-label={t('sust_tab_emisiones', 'Emisiones')}
          >
            <SPMAgGrid
              columnDefs={emisionColumnDefs}
              rowData={emisiones}
              loading={loadingEmisiones}
              height={480}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="emisiones_co2"
              emptyMessage={t('sust_empty_emisiones', 'No hay registros de emisiones')}
              getRowId={(params) => String(params.data.id)}
            />
          </Paper>
        </>
      )}

      {/* Tab 2: ESG Proveedores */}
      {tabValue === 2 && (
        <>
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setEsgDialogOpen(true)}
              aria-label={t('sust_new_esg', 'Nueva Evaluacion ESG')}
            >
              {t('sust_new_esg', 'Nueva Evaluacion ESG')}
            </Button>
          </Stack>
          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider' }}
            aria-label={t('sust_tab_esg', 'ESG Proveedores')}
          >
            <SPMAgGrid
              columnDefs={esgColumnDefs}
              rowData={esgProveedores}
              loading={loadingEsg}
              height={480}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="esg_proveedores"
              emptyMessage={t('sust_empty_esg', 'No hay evaluaciones ESG registradas')}
              getRowId={(params) => String(params.data.proveedor_id || params.data.id)}
            />
          </Paper>
        </>
      )}

      {/* Tab 3: Metas */}
      {tabValue === 3 && (
        <>
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setMetaDialogOpen(true)}
              aria-label={t('sust_new_meta', 'Nueva Meta')}
            >
              {t('sust_new_meta', 'Nueva Meta')}
            </Button>
          </Stack>
          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider' }}
            aria-label={t('sust_tab_metas', 'Metas')}
          >
            <SPMAgGrid
              columnDefs={metaColumnDefs}
              rowData={metas}
              loading={loadingMetas}
              height={480}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="metas_sustentabilidad"
              emptyMessage={t('sust_empty_metas', 'No hay metas registradas')}
              getRowId={(params) => String(params.data.id)}
            />
          </Paper>
        </>
      )}

      {/* Tab 4: Huella Materiales */}
      {tabValue === 4 && (
        <>
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setHuellaDialogOpen(true)}
              aria-label={t('sust_new_huella', 'Registrar Huella')}
            >
              {t('sust_new_huella', 'Registrar Huella')}
            </Button>
          </Stack>
          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider' }}
            aria-label={t('sust_tab_huella', 'Huella Materiales')}
          >
            <SPMAgGrid
              columnDefs={huellaColumnDefs}
              rowData={huella}
              loading={loadingHuella}
              height={480}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="huella_materiales"
              emptyMessage={t('sust_empty_huella', 'No hay registros de huella')}
              getRowId={(params) => String(params.data.id || params.data.material_codigo)}
            />
          </Paper>
        </>
      )}

      {/* ESG Dialog */}
      <Dialog open={esgDialogOpen} onClose={() => setEsgDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <BusinessIcon color="primary" />
            <span>{t('sust_new_esg', 'Nueva Evaluacion ESG')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('sust_field_proveedor', 'ID Proveedor')}
              value={esgForm.proveedor_id}
              onChange={(e) => setEsgForm((prev) => ({ ...prev, proveedor_id: e.target.value }))}
              fullWidth
              required
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Environmental (0-100)"
                type="number"
                value={esgForm.environmental}
                onChange={(e) => setEsgForm((prev) => ({ ...prev, environmental: e.target.value }))}
                fullWidth
                size="small"
                inputProps={{ min: 0, max: 100 }}
              />
              <TextField
                label="Social (0-100)"
                type="number"
                value={esgForm.social}
                onChange={(e) => setEsgForm((prev) => ({ ...prev, social: e.target.value }))}
                fullWidth
                size="small"
                inputProps={{ min: 0, max: 100 }}
              />
              <TextField
                label="Governance (0-100)"
                type="number"
                value={esgForm.governance}
                onChange={(e) => setEsgForm((prev) => ({ ...prev, governance: e.target.value }))}
                fullWidth
                size="small"
                inputProps={{ min: 0, max: 100 }}
              />
            </Stack>
            <TextField
              label={t('sust_field_notas', 'Notas')}
              value={esgForm.notas}
              onChange={(e) => setEsgForm((prev) => ({ ...prev, notas: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEsgDialogOpen(false)} disabled={submittingEsg}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleEsgSubmit}
            disabled={submittingEsg || !esgForm.proveedor_id}
            startIcon={submittingEsg && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Meta Dialog */}
      <Dialog open={metaDialogOpen} onClose={() => setMetaDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <TrackChangesIcon color="primary" />
            <span>{t('sust_new_meta', 'Nueva Meta')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('sust_field_nombre', 'Nombre')}
              value={metaForm.nombre}
              onChange={(e) => setMetaForm((prev) => ({ ...prev, nombre: e.target.value }))}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('sust_field_descripcion', 'Descripcion')}
              value={metaForm.descripcion}
              onChange={(e) => setMetaForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
            <FormControl size="small" fullWidth>
              <InputLabel>{t('sust_field_tipo', 'Tipo')}</InputLabel>
              <Select
                value={metaForm.tipo}
                label={t('sust_field_tipo', 'Tipo')}
                onChange={(e) => setMetaForm((prev) => ({ ...prev, tipo: e.target.value }))}
              >
                <MenuItem value="reduccion_emisiones">Reduccion de Emisiones</MenuItem>
                <MenuItem value="reciclaje">Reciclaje</MenuItem>
                <MenuItem value="energia_renovable">Energia Renovable</MenuItem>
                <MenuItem value="reduccion_residuos">Reduccion de Residuos</MenuItem>
                <MenuItem value="otro">Otro</MenuItem>
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('sust_field_objetivo', 'Valor Objetivo')}
                type="number"
                value={metaForm.valor_objetivo}
                onChange={(e) => setMetaForm((prev) => ({ ...prev, valor_objetivo: e.target.value }))}
                fullWidth
                required
                size="small"
                inputProps={{ min: 0 }}
              />
              <TextField
                label={t('sust_field_actual', 'Valor Actual')}
                type="number"
                value={metaForm.valor_actual}
                onChange={(e) => setMetaForm((prev) => ({ ...prev, valor_actual: e.target.value }))}
                fullWidth
                size="small"
                inputProps={{ min: 0 }}
              />
            </Stack>
            <TextField
              label={t('sust_field_fecha_limite', 'Fecha Limite')}
              type="date"
              value={metaForm.fecha_limite}
              onChange={(e) => setMetaForm((prev) => ({ ...prev, fecha_limite: e.target.value }))}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMetaDialogOpen(false)} disabled={submittingMeta}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleMetaSubmit}
            disabled={submittingMeta || !metaForm.nombre.trim() || !metaForm.valor_objetivo}
            startIcon={submittingMeta && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Huella Dialog */}
      <Dialog open={huellaDialogOpen} onClose={() => setHuellaDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <CategoryIcon color="primary" />
            <span>{t('sust_new_huella', 'Registrar Huella')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('sust_field_material', 'Codigo Material')}
              value={huellaForm.material_codigo}
              onChange={(e) => setHuellaForm((prev) => ({ ...prev, material_codigo: e.target.value }))}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('sust_field_co2', 'CO2 por Unidad (kg)')}
              type="number"
              value={huellaForm.co2_por_unidad}
              onChange={(e) => setHuellaForm((prev) => ({ ...prev, co2_por_unidad: e.target.value }))}
              fullWidth
              required
              size="small"
              inputProps={{ min: 0, step: 0.001 }}
            />
            <TextField
              label={t('sust_field_unidad', 'Unidad de Medida')}
              value={huellaForm.unidad_medida}
              onChange={(e) => setHuellaForm((prev) => ({ ...prev, unidad_medida: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label={t('sust_field_fuente', 'Fuente de Datos')}
              value={huellaForm.fuente_datos}
              onChange={(e) => setHuellaForm((prev) => ({ ...prev, fuente_datos: e.target.value }))}
              fullWidth
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setHuellaDialogOpen(false)} disabled={submittingHuella}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleHuellaSubmit}
            disabled={submittingHuella || !huellaForm.material_codigo.trim() || !huellaForm.co2_por_unidad}
            startIcon={submittingHuella && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
