/**
 * ControlTower - Supply Chain Control Tower dashboard
 *
 * Displays 8 KPI cards in 2 rows, with tabbed views for Timeline, Alertas,
 * and Tendencias. Includes filters by categoria, severidad, and date range.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TimelineIcon from '@mui/icons-material/Timeline';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import GavelIcon from '@mui/icons-material/Gavel';
import AssignmentIcon from '@mui/icons-material/Assignment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const CATEGORIA_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'procurement', label: 'Compras' },
  { value: 'logistics', label: 'Logistica' },
  { value: 'quality', label: 'Calidad' },
  { value: 'planning', label: 'Planificacion' },
  { value: 'finance', label: 'Finanzas' },
];

const SEVERIDAD_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'critical', label: 'Critica' },
  { value: 'warning', label: 'Alerta' },
  { value: 'info', label: 'Informativa' },
  { value: 'success', label: 'Exito' },
];

const SEVERIDAD_COLORS = {
  critical: 'error',
  warning: 'warning',
  info: 'info',
  success: 'success',
};

const PRIORIDAD_COLORS = {
  critica: 'error',
  alta: 'warning',
  media: 'default',
  baja: 'info',
};

const CATEGORIA_COLORS = {
  procurement: 'primary',
  logistics: 'warning',
  quality: 'secondary',
  planning: 'info',
  finance: 'success',
};

const CATEGORIA_LABELS = {
  procurement: 'Compras',
  logistics: 'Logistica',
  quality: 'Calidad',
  planning: 'Planificacion',
  finance: 'Finanzas',
};

const SEVERIDAD_LABELS = {
  critical: 'Critica',
  warning: 'Alerta',
  info: 'Informativa',
  success: 'Exito',
};

const TIPO_EVENTO_LABELS = {
  budget_exceeded: 'Presupuesto excedido',
  supplier_risk: 'Riesgo proveedor',
  ncr_opened: 'NCR abierto',
  sla_breach: 'SLA vencido',
  stock_critical: 'Stock critico',
  quality_issue: 'Problema calidad',
  delivery_delay: 'Demora entrega',
  contract_expiry: 'Contrato por vencer',
  inspection_fail: 'Inspeccion fallida',
  price_change: 'Cambio de precio',
  stock_alert: 'Alerta stock',
};

const ALERTA_ESTADO_COLORS = {
  active: 'error',
  acknowledged: 'warning',
  resolved: 'success',
};

const ALERTA_ESTADO_LABELS = {
  active: 'Activa',
  acknowledged: 'Reconocida',
  resolved: 'Resuelta',
};

export default function ControlTower() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [tabValue, setTabValue] = useState(0);
  const [kpis, setKpis] = useState(null);
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [processing, setProcessing] = useState({});

  const [filters, setFilters] = useState({
    categoria: '',
    severidad: '',
    fecha_desde: '',
    fecha_hasta: '',
  });

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchKPIs = useCallback(async () => {
    try {
      const res = await api.get('/control-tower/kpis');
      if (res.data?.ok) {
        setKpis(res.data.kpis || res.data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      setLoadingEvents(true);
      const f = filtersRef.current;
      const params = {};
      if (f.categoria) params.categoria = f.categoria;
      if (f.severidad) params.severidad = f.severidad;
      if (f.fecha_desde) params.fecha_desde = f.fecha_desde;
      if (f.fecha_hasta) params.fecha_hasta = f.fecha_hasta;
      const res = await api.get('/control-tower/events', { params });
      if (res.data?.ok) {
        setEvents(res.data.events || res.data.items || []);
      }
    } catch {
      toastRef.current.error(t('ct_error_events', 'Error al cargar eventos'));
    } finally {
      setLoadingEvents(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const f = filtersRef.current;
      const params = {};
      if (f.categoria) params.categoria = f.categoria;
      if (f.severidad) params.severidad = f.severidad;
      const res = await api.get('/control-tower/alerts', { params });
      if (res.data?.ok) {
        setAlerts(res.data.alerts || res.data.items || []);
      }
    } catch {
      toastRef.current.error(t('ct_error_alerts', 'Error al cargar alertas'));
    } finally {
      setLoadingAlerts(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTrends = useCallback(async () => {
    setLoadingTrends(true);
    try {
      const res = await api.get('/control-tower/trends');
      if (res.data?.ok) {
        setTrends(res.data.trends || res.data.items || []);
      }
    } catch {
      toastRef.current.error(t('ct_error_trends', 'Error al cargar tendencias'));
    } finally {
      setLoadingTrends(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load - runs once
  useEffect(() => {
    fetchKPIs();
    fetchEvents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch events when filters change (skip initial render)
  const filtersInitRef = useRef(true);
  useEffect(() => {
    if (filtersInitRef.current) {
      filtersInitRef.current = false;
      return;
    }
    fetchEvents();
  }, [filters.categoria, filters.severidad, filters.fecha_desde, filters.fecha_hasta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch tab-specific data
  useEffect(() => {
    if (tabValue === 1) fetchAlerts();
    if (tabValue === 2) fetchTrends();
  }, [tabValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAcknowledge = useCallback(async (alertId) => {
    setProcessing((prev) => ({ ...prev, [alertId]: 'ack' }));
    try {
      const res = await api.put(`/control-tower/alerts/${alertId}/acknowledge`);
      if (res.data?.ok) {
        toastRef.current.success(t('ct_alert_acknowledged', 'Alerta reconocida'));
        fetchAlerts();
        fetchKPIs();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || t('ct_error_acknowledge', 'Error al reconocer alerta'));
    } finally {
      setProcessing((prev) => ({ ...prev, [alertId]: null }));
    }
  }, [fetchAlerts, fetchKPIs]);

  const handleResolve = useCallback(async (alertId) => {
    setProcessing((prev) => ({ ...prev, [alertId]: 'resolve' }));
    try {
      const res = await api.put(`/control-tower/alerts/${alertId}/resolve`);
      if (res.data?.ok) {
        toastRef.current.success(t('ct_alert_resolved', 'Alerta resuelta'));
        fetchAlerts();
        fetchKPIs();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || t('ct_error_resolve', 'Error al resolver alerta'));
    } finally {
      setProcessing((prev) => ({ ...prev, [alertId]: null }));
    }
  }, [fetchAlerts, fetchKPIs]);

  // Sparkline renderer: simple text-based bar
  const renderSparkline = useCallback((values) => {
    if (!values || values.length === 0) return '-';
    const max = Math.max(...values, 1);
    const blocks = ['_', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];
    return values.map((v) => {
      const idx = Math.round((v / max) * (blocks.length - 1));
      return blocks[Math.min(idx, blocks.length - 1)];
    }).join('');
  }, []);

  const eventColumnDefs = useMemo(() => [
    {
      field: 'fecha',
      headerName: t('ct_col_fecha', 'Fecha'),
      width: 150,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'tipo',
      headerName: t('ct_col_tipo', 'Tipo'),
      width: 160,
      valueFormatter: (p) => TIPO_EVENTO_LABELS[p.value] || p.value || '-',
    },
    {
      field: 'categoria',
      headerName: t('ct_col_categoria', 'Categoria'),
      width: 140,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={CATEGORIA_LABELS[p.value] || p.value || '-'}
          color={CATEGORIA_COLORS[p.value] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'severidad',
      headerName: t('ct_col_severidad', 'Severidad'),
      width: 130,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={SEVERIDAD_LABELS[p.value] || p.value || '-'}
          color={SEVERIDAD_COLORS[p.value] || 'default'}
        />
      ),
    },
    { field: 'titulo', headerName: t('ct_col_titulo', 'Titulo'), flex: 2, minWidth: 200 },
    { field: 'entidad', headerName: t('ct_col_entidad', 'Entidad'), flex: 1, minWidth: 140 },
  ], [t]);

  const alertColumnDefs = useMemo(() => [
    {
      field: 'tipo',
      headerName: t('ct_col_tipo', 'Tipo'),
      width: 160,
      valueFormatter: (p) => TIPO_EVENTO_LABELS[p.value] || p.value || '-',
    },
    {
      field: 'prioridad',
      headerName: t('ct_col_prioridad', 'Prioridad'),
      width: 120,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={p.value || '-'}
          color={PRIORIDAD_COLORS[p.value] || 'default'}
        />
      ),
    },
    {
      field: 'cantidad',
      headerName: t('ct_col_cantidad', 'Cantidad'),
      width: 100,
      type: 'numericColumn',
    },
    { field: 'titulo', headerName: t('ct_col_titulo', 'Titulo'), flex: 2, minWidth: 200 },
    {
      field: 'estado',
      headerName: t('ct_col_estado', 'Estado'),
      width: 130,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={ALERTA_ESTADO_LABELS[p.value] || p.value || '-'}
          color={ALERTA_ESTADO_COLORS[p.value] || 'default'}
        />
      ),
    },
    {
      headerName: t('ct_col_acciones', 'Acciones'),
      width: 260,
      sortable: false,
      filter: false,
      cellRenderer: (p) => {
        const row = p.data;
        if (!row) return null;
        const isProcessing = processing[row.id];
        return (
          <Stack direction="row" gap={0.5} alignItems="center" sx={{ height: '100%' }}>
            {row.estado === 'active' && (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={isProcessing === 'ack' ? <CircularProgress size={14} /> : <VisibilityIcon />}
                onClick={(e) => { e.stopPropagation(); handleAcknowledge(row.id); }}
                disabled={!!isProcessing}
              >
                {t('ct_reconocer', 'Reconocer')}
              </Button>
            )}
            {(row.estado === 'active' || row.estado === 'acknowledged') && (
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={isProcessing === 'resolve' ? <CircularProgress size={14} /> : <DoneAllIcon />}
                onClick={(e) => { e.stopPropagation(); handleResolve(row.id); }}
                disabled={!!isProcessing}
              >
                {t('ct_resolver', 'Resolver')}
              </Button>
            )}
          </Stack>
        );
      },
    },
  ], [t, processing, handleAcknowledge, handleResolve]);

  const trendColumnDefs = useMemo(() => [
    { field: 'nombre', headerName: t('ct_col_kpi_name', 'KPI'), flex: 1, minWidth: 180 },
    {
      field: 'valor_actual',
      headerName: t('ct_col_valor_actual', 'Valor Actual'),
      width: 130,
      type: 'numericColumn',
    },
    {
      field: 'variacion',
      headerName: t('ct_col_variacion', 'Variacion'),
      width: 120,
      cellRenderer: (p) => {
        const val = p.value;
        if (val == null) return '-';
        const color = val > 0 ? 'success.main' : val < 0 ? 'error.main' : 'text.secondary';
        const prefix = val > 0 ? '+' : '';
        return (
          <Typography variant="body2" sx={{ color, fontWeight: 600 }}>
            {prefix}{Number(val).toFixed(1)}%
          </Typography>
        );
      },
    },
    {
      field: 'sparkline',
      headerName: t('ct_col_tendencia', 'Tendencia'),
      flex: 1,
      minWidth: 160,
      cellRenderer: (p) => {
        const values = p.value || p.data?.valores || [];
        return (
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '1px', lineHeight: '40px' }}
          >
            {renderSparkline(values)}
          </Typography>
        );
      },
    },
    { field: 'periodo', headerName: t('ct_col_periodo', 'Periodo'), width: 120 },
  ], [t, renderSparkline]);

  const KpiCard = ({ icon, label, value, color }) => (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', flex: 1, minWidth: 150 }}>
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <IconButton
          onClick={() => navigate(-1)}
          sx={{
            color: "text.disabled",
            "&:hover": {
              color: "text.secondary",
              bgcolor: "background.paper",
            },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary">
          {t('ct_title', 'Torre de Control')}
        </Typography>
      </Box>

      {/* KPI Cards - Row 1 */}
      {kpis && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
            <KpiCard
              icon={<AssignmentIcon fontSize="small" sx={{ color: 'warning.main' }} />}
              label={t('ct_kpi_solicitudes', 'Solicitudes Pendientes')}
              value={kpis.solicitudes_pendientes}
              color="warning.main"
            />
            <KpiCard
              icon={<ShoppingCartIcon fontSize="small" sx={{ color: 'info.main' }} />}
              label={t('ct_kpi_ocs', 'OCs Activas')}
              value={kpis.ocs_activas}
              color="info.main"
            />
            <KpiCard
              icon={<LocalShippingIcon fontSize="small" sx={{ color: 'primary.main' }} />}
              label={t('ct_kpi_envios', 'Envios en Transito')}
              value={kpis.envios_en_transito}
              color="primary.main"
            />
            <KpiCard
              icon={<SearchIcon fontSize="small" sx={{ color: 'secondary.main' }} />}
              label={t('ct_kpi_inspecciones', 'Inspecciones Pendientes')}
              value={kpis.inspecciones_pendientes}
              color="secondary.main"
            />
          </Stack>

          {/* KPI Cards - Row 2 */}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
            <KpiCard
              icon={<NotificationsActiveIcon fontSize="small" sx={{ color: 'error.main' }} />}
              label={t('ct_kpi_alertas', 'Alertas Activas')}
              value={kpis.alertas_activas}
              color="error.main"
            />
            <KpiCard
              icon={<CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />}
              label={t('ct_kpi_sla', 'SLA %')}
              value={kpis.sla_porcentaje != null ? `${Number(kpis.sla_porcentaje).toFixed(1)}%` : null}
              color="success.main"
            />
            <KpiCard
              icon={<DescriptionIcon fontSize="small" sx={{ color: 'warning.main' }} />}
              label={t('ct_kpi_contratos', 'Contratos por Vencer')}
              value={kpis.contratos_por_vencer}
              color="warning.main"
            />
            <KpiCard
              icon={<GavelIcon fontSize="small" sx={{ color: 'info.main' }} />}
              label={t('ct_kpi_rfqs', 'RFQs Abiertas')}
              value={kpis.rfqs_abiertas}
              color="info.main"
            />
          </Stack>
        </>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('ct_filter_categoria', 'Categoria')}</InputLabel>
            <Select
              value={filters.categoria}
              label={t('ct_filter_categoria', 'Categoria')}
              onChange={(e) => handleFilterChange('categoria', e.target.value)}
            >
              {CATEGORIA_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('ct_filter_severidad', 'Severidad')}</InputLabel>
            <Select
              value={filters.severidad}
              label={t('ct_filter_severidad', 'Severidad')}
              onChange={(e) => handleFilterChange('severidad', e.target.value)}
            >
              {SEVERIDAD_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="date"
            label={t('ct_filter_desde', 'Desde')}
            value={filters.fecha_desde}
            onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="date"
            label={t('ct_filter_hasta', 'Hasta')}
            value={filters.fecha_hasta}
            onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={t('ct_tab_timeline', 'Linea de Tiempo')} icon={<TimelineIcon />} iconPosition="start" />
          <Tab label={t('ct_tab_alertas', 'Alertas')} icon={<NotificationsActiveIcon />} iconPosition="start" />
          <Tab label={t('ct_tab_tendencias', 'Tendencias')} icon={<TrendingUpIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Timeline */}
      {tabValue === 0 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider' }}
          aria-label={t('ct_tab_timeline', 'Linea de Tiempo')}
        >
          <SPMAgGrid
            columnDefs={eventColumnDefs}
            rowData={events}
            loading={loadingEvents}
            height={480}
            pagination={true}
            paginationPageSize={25}
            enableQuickFilter={true}
            exportFileName="control_tower_events"
            emptyMessage={t('ct_empty_events', 'No hay eventos registrados')}
            getRowId={(params) => String(params.data.id)}
          />
        </Paper>
      )}

      {/* Tab 1: Alertas */}
      {tabValue === 1 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider' }}
          aria-label={t('ct_tab_alertas', 'Alertas')}
        >
          <SPMAgGrid
            columnDefs={alertColumnDefs}
            rowData={alerts}
            loading={loadingAlerts}
            height={480}
            pagination={true}
            paginationPageSize={25}
            enableQuickFilter={true}
            exportFileName="control_tower_alertas"
            emptyMessage={t('ct_empty_alerts', 'No hay alertas activas')}
            getRowId={(params) => String(params.data.id)}
          />
        </Paper>
      )}

      {/* Tab 2: Tendencias */}
      {tabValue === 2 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider' }}
          aria-label={t('ct_tab_tendencias', 'Tendencias')}
        >
          <SPMAgGrid
            columnDefs={trendColumnDefs}
            rowData={trends}
            loading={loadingTrends}
            height={400}
            pagination={false}
            enableQuickFilter={false}
            exportFileName="control_tower_trends"
            emptyMessage={t('ct_empty_trends', 'No hay datos de tendencia')}
            getRowId={(params) => String(params.data.nombre || params.data.id)}
          />
        </Paper>
      )}
      </Box>
    </Box>
  );
}
