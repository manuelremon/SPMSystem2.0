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
import { formatDate, formatNumber } from '../utils/formatters';
import PageLayout from '../components/ui/PageLayout';
import { MetricCard } from '../components/ui/MetricCard';

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
import Co2Icon from '@mui/icons-material/Co2';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NatureIcon from '@mui/icons-material/Nature';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const SCOPE_VALUES = ['scope_1', 'scope_2', 'scope_3'];
const scopeLabel = (t, v) => {
  const n = String(v || '').replace(/\D/g, '');
  return n ? `${t('sust_alcance', 'Alcance')} ${n}` : (v || '-');
};
// Numero con decimales fijos y coma decimal (es-ES)
const fmtFixed = (v, d) => formatNumber(Number(v || 0).toFixed(d));

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
  active: ['sust_estado_active', 'Activa'],
  completed: ['sust_estado_completed', 'Cumplida'],
  expired: ['sust_estado_expired', 'Vencida'],
  draft: ['sust_estado_draft', 'Borrador'],
};

const META_TIPO_LABELS = {
  reduccion_emisiones: ['sust_tipo_reduccion_emisiones', 'Reducción de emisiones'],
  reciclaje: ['sust_tipo_reciclaje', 'Reciclaje'],
  energia_renovable: ['sust_tipo_energia_renovable', 'Energía renovable'],
  reduccion_residuos: ['sust_tipo_reduccion_residuos', 'Reducción de residuos'],
  otro: ['sust_tipo_otro', 'Otro'],
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emisionFilters]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      toast.warning(t('sust_esg_proveedor_requerido', 'Ingresa el ID del proveedor'));
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
        toast.success(t('sust_esg_created', 'Evaluación ESG registrada'));
        setEsgDialogOpen(false);
        setEsgForm(INITIAL_ESG_FORM);
        fetchEsgProveedores();
        fetchKPIs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('sust_error_esg_create', 'Error al registrar la evaluación'));
    } finally {
      setSubmittingEsg(false);
    }
  }, [esgForm, t, toast, fetchEsgProveedores, fetchKPIs]);

  // Meta submit
  const handleMetaSubmit = useCallback(async () => {
    if (!metaForm.nombre.trim() || !metaForm.valor_objetivo) {
      toast.warning(t('sust_meta_requerida', 'Completa el nombre y el valor objetivo'));
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
      toast.warning(t('sust_huella_requerida', 'Completa el material y el CO₂ por unidad'));
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
      headerName: t('sust_col_alcance', 'Alcance'),
      width: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={scopeLabel(t, p.value)} color={SCOPE_COLORS[p.value] || 'default'} />
      ),
    },
    { field: 'categoria', headerName: t('sust_col_categoria', 'Categoría'), width: 140 },
    {
      field: 'cantidad',
      headerName: t('sust_col_cantidad', 'Cantidad (kg CO₂e)'),
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? formatNumber(Math.round(Number(p.value) * 100) / 100) : '-',
    },
    { field: 'material', headerName: t('sust_col_material', 'Material'), width: 140 },
    { field: 'proveedor', headerName: t('sust_col_proveedor', 'Proveedor'), width: 140 },
    { field: 'periodo', headerName: t('sust_col_periodo', 'Período'), width: 120 },
  ], [t]);

  const esgColumnDefs = useMemo(() => [
    { field: 'proveedor_nombre', headerName: t('sust_col_proveedor', 'Proveedor'), flex: 2, minWidth: 180 },
    {
      field: 'environmental',
      headerName: t('sust_col_e', 'Ambiental'),
      width: 110,
      type: 'numericColumn',
      cellRenderer: (p) => (
        <Typography variant="body2" sx={{ fontWeight: 600, color: ESG_SCORE_COLOR(p.value) }}>
          {p.value != null ? fmtFixed(p.value, 0) : '-'}
        </Typography>
      ),
    },
    {
      field: 'social',
      headerName: t('sust_col_s', 'Social'),
      width: 110,
      type: 'numericColumn',
      cellRenderer: (p) => (
        <Typography variant="body2" sx={{ fontWeight: 600, color: ESG_SCORE_COLOR(p.value) }}>
          {p.value != null ? fmtFixed(p.value, 0) : '-'}
        </Typography>
      ),
    },
    {
      field: 'governance',
      headerName: t('sust_col_g', 'Gobernanza'),
      width: 110,
      type: 'numericColumn',
      cellRenderer: (p) => (
        <Typography variant="body2" sx={{ fontWeight: 600, color: ESG_SCORE_COLOR(p.value) }}>
          {p.value != null ? fmtFixed(p.value, 0) : '-'}
        </Typography>
      ),
    },
    {
      field: 'overall',
      headerName: t('sust_col_global', 'Global'),
      width: 100,
      type: 'numericColumn',
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={p.value != null ? fmtFixed(p.value, 0) : '-'}
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
    {
      field: 'tipo',
      headerName: t('sust_col_tipo', 'Tipo'),
      width: 180,
      valueFormatter: (p) => (META_TIPO_LABELS[p.value] ? t(META_TIPO_LABELS[p.value][0], META_TIPO_LABELS[p.value][1]) : p.value || '-'),
    },
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
              {fmtFixed(pct, 0)} %
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
          label={META_ESTADO_LABELS[p.value] ? t(META_ESTADO_LABELS[p.value][0], META_ESTADO_LABELS[p.value][1]) : p.value || '-'}
          color={META_ESTADO_COLORS[p.value] || 'default'}
        />
      ),
    },
    {
      field: 'fecha_limite',
      headerName: t('sust_col_fecha_limite', 'Fecha límite'),
      width: 130,
      valueFormatter: (p) => formatDate(p.value),
    },
  ], [t]);

  const huellaColumnDefs = useMemo(() => [
    { field: 'material_codigo', headerName: t('sust_col_material', 'Material'), flex: 1, minWidth: 140 },
    { field: 'descripcion', headerName: t('sust_col_descripcion', 'Descripción'), flex: 2, minWidth: 200 },
    {
      field: 'co2_por_unidad',
      headerName: t('sust_col_co2_unidad', 'CO₂ por unidad (kg)'),
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? formatNumber(Math.round(Number(p.value) * 10000) / 10000) : '-',
    },
    { field: 'unidad_medida', headerName: t('sust_col_unidad', 'Unidad'), width: 100 },
    { field: 'fuente_datos', headerName: t('sust_col_fuente', 'Fuente'), flex: 1, minWidth: 140 },
  ], [t]);

  const sinDatos = t('common_sin_datos', 'Sin datos');
  const showVal = (v, fmt = (x) => formatNumber(x)) => (v != null ? fmt(v) : sinDatos);

  return (
    <PageLayout title={t('sust_titulo', 'Sostenibilidad')}>
      {/* KPI Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
        <MetricCard
          size="lg"
          icon={Co2Icon}
          variant="danger"
          label={t('sust_kpi_emisiones_totales', 'Emisiones totales (kg CO₂e)')}
          value={showVal(kpis?.emisiones_totales)}
        />
        <MetricCard
          size="lg"
          icon={AssessmentIcon}
          variant="info"
          label={t('sust_kpi_esg_promedio', 'Puntaje ESG promedio')}
          value={kpis?.esg_promedio ? fmtFixed(kpis.esg_promedio, 1) : sinDatos}
        />
        <MetricCard
          size="lg"
          icon={TrackChangesIcon}
          variant="warning"
          label={t('sust_kpi_metas_activas_label', 'Metas activas')}
          value={showVal(kpis?.metas_activas)}
        />
        <MetricCard
          size="lg"
          icon={CheckCircleIcon}
          variant="success"
          label={t('sust_kpi_metas_cumplidas_label', 'Metas cumplidas')}
          value={showVal(kpis?.metas_cumplidas)}
        />
      </Box>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', minHeight: 48 } }}
        >
          <Tab label={t('sust_tab_resumen', 'Resumen')} icon={<AssessmentIcon />} iconPosition="start" />
          <Tab label={t('sust_tab_emisiones', 'Emisiones')} icon={<Co2Icon />} iconPosition="start" />
          <Tab label={t('sust_tab_esg_proveedores', 'ESG de proveedores')} icon={<BusinessIcon />} iconPosition="start" />
          <Tab label={t('sust_tab_metas', 'Metas')} icon={<TrackChangesIcon />} iconPosition="start" />
          <Tab label={t('sust_tab_huella_materiales', 'Huella de materiales')} icon={<CategoryIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Dashboard Summary */}
      {tabValue === 0 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          {dashboardData ? (
            <Stack spacing={3}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t('sust_resumen_titulo', 'Resumen de sostenibilidad')}
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} gap={3}>
                <Paper elevation={0} sx={{ flex: 1, p: 2, bgcolor: 'action.hover' }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <Co2Icon fontSize="small" color="error" />
                    <Typography variant="subtitle2">{t('sust_dash_emisiones_alcance', 'Emisiones por alcance')}</Typography>
                  </Stack>
                  {(dashboardData.emisiones_por_scope || []).length === 0 && (
                    <Typography variant="body2" color="text.secondary">{sinDatos}</Typography>
                  )}
                  {(dashboardData.emisiones_por_scope || []).map((s, idx) => (
                    <Stack key={idx} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
                      <Chip size="small" label={scopeLabel(t, s.scope)} color={SCOPE_COLORS[s.scope] || 'default'} variant="outlined" />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatNumber(s.total)} kg
                      </Typography>
                    </Stack>
                  ))}
                </Paper>
                <Paper elevation={0} sx={{ flex: 1, p: 2, bgcolor: 'action.hover' }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <NatureIcon fontSize="small" color="success" />
                    <Typography variant="subtitle2">{t('sust_dash_estado_metas', 'Estado de metas')}</Typography>
                  </Stack>
                  <Typography variant="body2">
                    {t('sust_dash_activas', 'Activas')}: <strong>{dashboardData.metas_activas ?? 0}</strong>
                  </Typography>
                  <Typography variant="body2">
                    {t('sust_dash_cumplidas', 'Cumplidas')}: <strong>{dashboardData.metas_cumplidas ?? 0}</strong>
                  </Typography>
                  <Typography variant="body2">
                    {t('sust_dash_vencidas', 'Vencidas')}: <strong>{dashboardData.metas_expiradas ?? 0}</strong>
                  </Typography>
                </Paper>
                <Paper elevation={0} sx={{ flex: 1, p: 2, bgcolor: 'action.hover' }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                    <BusinessIcon fontSize="small" color="info" />
                    <Typography variant="subtitle2">{t('sust_tab_esg_proveedores', 'ESG de proveedores')}</Typography>
                  </Stack>
                  <Typography variant="body2">
                    {t('sust_dash_evaluados', 'Evaluados')}: <strong>{dashboardData.proveedores_evaluados ?? 0}</strong>
                  </Typography>
                  <Typography variant="body2">
                    {t('sust_dash_puntaje_promedio', 'Puntaje promedio')}: <strong>{dashboardData.esg_promedio ? fmtFixed(dashboardData.esg_promedio, 1) : sinDatos}</strong>
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
            <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel shrink>{t('sust_alcance', 'Alcance')}</InputLabel>
                <Select
                  value={emisionFilters.scope}
                  label={t('sust_alcance', 'Alcance')}
                  onChange={(e) => setEmisionFilters((prev) => ({ ...prev, scope: e.target.value }))}
                  displayEmpty
                  notched
                >
                  <MenuItem value="">{t('common_all', 'Todos')}</MenuItem>
                  {SCOPE_VALUES.map((v) => (
                    <MenuItem key={v} value={v}>{scopeLabel(t, v)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label={t('sust_filter_categoria', 'Categoría')}
                value={emisionFilters.categoria}
                onChange={(e) => setEmisionFilters((prev) => ({ ...prev, categoria: e.target.value }))}
                sx={{ minWidth: 160 }}
              />
              <TextField
                size="small"
                label={t('sust_filter_periodo', 'Período')}
                value={emisionFilters.periodo}
                onChange={(e) => setEmisionFilters((prev) => ({ ...prev, periodo: e.target.value }))}
                placeholder="2026-01"
                sx={{ minWidth: 140 }}
              />
              <Button variant="outlined" size="small" onClick={fetchEmisiones} sx={{ textTransform: 'none' }}>
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
              paginationPageSize={25}
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
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setEsgDialogOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              {t('sust_nueva_evaluacion', 'Nueva evaluación ESG')}
            </Button>
          </Stack>
          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider' }}
            aria-label={t('sust_tab_esg_proveedores', 'ESG de proveedores')}
          >
            <SPMAgGrid
              columnDefs={esgColumnDefs}
              rowData={esgProveedores}
              loading={loadingEsg}
              height={480}
              pagination={true}
              paginationPageSize={25}
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
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setMetaDialogOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              {t('sust_nueva_meta', 'Nueva meta')}
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
              paginationPageSize={25}
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
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setHuellaDialogOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              {t('sust_registrar_huella', 'Registrar huella')}
            </Button>
          </Stack>
          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider' }}
            aria-label={t('sust_tab_huella_materiales', 'Huella de materiales')}
          >
            <SPMAgGrid
              columnDefs={huellaColumnDefs}
              rowData={huella}
              loading={loadingHuella}
              height={480}
              pagination={true}
              paginationPageSize={25}
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
            <span>{t('sust_nueva_evaluacion', 'Nueva evaluación ESG')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('sust_field_proveedor', 'ID de proveedor')}
              value={esgForm.proveedor_id}
              onChange={(e) => setEsgForm((prev) => ({ ...prev, proveedor_id: e.target.value }))}
              fullWidth
              required
              size="small"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t('sust_field_ambiental', 'Ambiental (0-100)')}
                type="number"
                value={esgForm.environmental}
                onChange={(e) => setEsgForm((prev) => ({ ...prev, environmental: e.target.value }))}
                fullWidth
                size="small"
                inputProps={{ min: 0, max: 100 }}
              />
              <TextField
                label={t('sust_field_social', 'Social (0-100)')}
                type="number"
                value={esgForm.social}
                onChange={(e) => setEsgForm((prev) => ({ ...prev, social: e.target.value }))}
                fullWidth
                size="small"
                inputProps={{ min: 0, max: 100 }}
              />
              <TextField
                label={t('sust_field_gobernanza', 'Gobernanza (0-100)')}
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
            <span>{t('sust_nueva_meta', 'Nueva meta')}</span>
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
              label={t('sust_field_descripcion', 'Descripción')}
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
                {Object.entries(META_TIPO_LABELS).map(([value, [key, fb]]) => (
                  <MenuItem key={value} value={value}>{t(key, fb)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('sust_field_objetivo', 'Valor objetivo')}
                type="number"
                value={metaForm.valor_objetivo}
                onChange={(e) => setMetaForm((prev) => ({ ...prev, valor_objetivo: e.target.value }))}
                fullWidth
                required
                size="small"
                inputProps={{ min: 0 }}
              />
              <TextField
                label={t('sust_field_actual', 'Valor actual')}
                type="number"
                value={metaForm.valor_actual}
                onChange={(e) => setMetaForm((prev) => ({ ...prev, valor_actual: e.target.value }))}
                fullWidth
                size="small"
                inputProps={{ min: 0 }}
              />
            </Stack>
            <TextField
              label={t('sust_field_fecha_limite', 'Fecha límite')}
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
            <span>{t('sust_registrar_huella', 'Registrar huella')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('sust_field_material', 'Código de material')}
              value={huellaForm.material_codigo}
              onChange={(e) => setHuellaForm((prev) => ({ ...prev, material_codigo: e.target.value }))}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('sust_field_co2', 'CO₂ por unidad (kg)')}
              type="number"
              value={huellaForm.co2_por_unidad}
              onChange={(e) => setHuellaForm((prev) => ({ ...prev, co2_por_unidad: e.target.value }))}
              fullWidth
              required
              size="small"
              inputProps={{ min: 0, step: 0.001 }}
            />
            <TextField
              label={t('sust_field_unidad', 'Unidad de medida')}
              value={huellaForm.unidad_medida}
              onChange={(e) => setHuellaForm((prev) => ({ ...prev, unidad_medida: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label={t('sust_field_fuente', 'Fuente de datos')}
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
    </PageLayout>
  );
}
