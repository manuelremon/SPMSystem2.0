/**
 * ControlTower - Supply Chain Control Tower dashboard
 *
 * Displays 8 KPI cards in 2 rows, with tabbed views for Timeline, Alertas,
 * and Tendencias. Includes filters by categoria, severidad, and date range.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TimelineIcon from '@mui/icons-material/Timeline';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AssignmentIcon from '@mui/icons-material/Assignment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const CATEGORIA_VALUES = ['procurement', 'logistics', 'quality', 'planning', 'finance'];
const SEVERIDAD_VALUES = ['critical', 'warning', 'info', 'success'];

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
  procurement: ['ct_cat_procurement', 'Compras'],
  logistics: ['ct_cat_logistics', 'Logística'],
  quality: ['ct_cat_quality', 'Calidad'],
  planning: ['ct_cat_planning', 'Planificación'],
  finance: ['ct_cat_finance', 'Finanzas'],
};

const SEVERIDAD_LABELS = {
  critical: ['ct_sev_critical', 'Crítica'],
  warning: ['ct_sev_warning', 'Alerta'],
  info: ['ct_sev_info', 'Informativa'],
  success: ['ct_sev_success', 'Éxito'],
};

const TIPO_EVENTO_LABELS = {
  budget_exceeded: ['ct_tipo_budget_exceeded', 'Presupuesto excedido'],
  supplier_risk: ['ct_tipo_supplier_risk', 'Riesgo de proveedor'],
  ncr_opened: ['ct_tipo_ncr_opened', 'No conformidad abierta'],
  sla_breach: ['ct_tipo_sla_breach', 'SLA vencido'],
  stock_critical: ['ct_tipo_stock_critical', 'Stock crítico'],
  quality_issue: ['ct_tipo_quality_issue', 'Problema de calidad'],
  delivery_delay: ['ct_tipo_delivery_delay', 'Demora de entrega'],
  contract_expiry: ['ct_tipo_contract_expiry', 'Contrato por vencer'],
  inspection_fail: ['ct_tipo_inspection_fail', 'Inspección fallida'],
  price_change: ['ct_tipo_price_change', 'Cambio de precio'],
  stock_alert: ['ct_tipo_stock_alert', 'Alerta de stock'],
};

const PRIORIDAD_LABELS = {
  critica: ['ct_prio_critica', 'Crítica'],
  alta: ['ct_prio_alta', 'Alta'],
  media: ['ct_prio_media', 'Media'],
  baja: ['ct_prio_baja', 'Baja'],
};

const ALERTA_ESTADO_COLORS = {
  active: 'error',
  acknowledged: 'warning',
  resolved: 'success',
};

const ALERTA_ESTADO_LABELS = {
  active: ['ct_estado_active', 'Activa'],
  acknowledged: ['ct_estado_acknowledged', 'Reconocida'],
  resolved: ['ct_estado_resolved', 'Resuelta'],
};

export default function ControlTower() {
  const { t } = useI18n();
  const toast = useToast();
  // Traduce una etiqueta [clave, fallback] de los mapas de arriba
  const lbl = useCallback((map, value) => (map[value] ? t(map[value][0], map[value][1]) : value || '-'), [t]);
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
      valueFormatter: (p) => lbl(TIPO_EVENTO_LABELS, p.value),
    },
    {
      field: 'categoria',
      headerName: t('ct_col_categoria', 'Categoría'),
      width: 140,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={lbl(CATEGORIA_LABELS, p.value)}
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
          label={lbl(SEVERIDAD_LABELS, p.value)}
          color={SEVERIDAD_COLORS[p.value] || 'default'}
        />
      ),
    },
    { field: 'titulo', headerName: t('ct_col_titulo', 'Título'), flex: 2, minWidth: 200 },
    { field: 'entidad', headerName: t('ct_col_entidad', 'Entidad'), flex: 1, minWidth: 140 },
  ], [t, lbl]);

  const alertColumnDefs = useMemo(() => [
    {
      field: 'tipo',
      headerName: t('ct_col_tipo', 'Tipo'),
      width: 160,
      valueFormatter: (p) => lbl(TIPO_EVENTO_LABELS, p.value),
    },
    {
      field: 'prioridad',
      headerName: t('ct_col_prioridad', 'Prioridad'),
      width: 120,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={lbl(PRIORIDAD_LABELS, p.value)}
          color={PRIORIDAD_COLORS[p.value] || 'default'}
        />
      ),
    },
    {
      field: 'cantidad',
      headerName: t('ct_col_cantidad', 'Cantidad'),
      width: 100,
      type: 'numericColumn',
      valueFormatter: (p) => (p.value != null ? formatNumber(p.value) : '-'),
    },
    { field: 'titulo', headerName: t('ct_col_titulo', 'Título'), flex: 2, minWidth: 200 },
    {
      field: 'estado',
      headerName: t('ct_col_estado', 'Estado'),
      width: 130,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={lbl(ALERTA_ESTADO_LABELS, p.value)}
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
                sx={{ textTransform: 'none' }}
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
                sx={{ textTransform: 'none' }}
              >
                {t('ct_resolver', 'Resolver')}
              </Button>
            )}
          </Stack>
        );
      },
    },
  ], [t, lbl, processing, handleAcknowledge, handleResolve]);

  const trendColumnDefs = useMemo(() => [
    { field: 'nombre', headerName: t('ct_col_kpi_name', 'KPI'), flex: 1, minWidth: 180 },
    {
      field: 'valor_actual',
      headerName: t('ct_col_valor_actual', 'Valor actual'),
      width: 130,
      type: 'numericColumn',
      valueFormatter: (p) => (p.value != null ? formatNumber(p.value) : '-'),
    },
    {
      field: 'variacion',
      headerName: t('ct_col_variacion', 'Variación'),
      width: 120,
      cellRenderer: (p) => {
        const val = p.value;
        if (val == null) return '-';
        const color = val > 0 ? 'success.main' : val < 0 ? 'error.main' : 'text.secondary';
        const prefix = val > 0 ? '+' : '';
        return (
          <Typography variant="body2" sx={{ color, fontWeight: 600 }}>
            {prefix}{formatNumber(Number(val).toFixed(1))} %
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
    { field: 'periodo', headerName: t('ct_col_periodo', 'Período'), width: 120 },
  ], [t, renderSparkline]);

  // Solo se muestran los KPI de modulos activos (compras, logistica, calidad y
  // contratos estan deshabilitados, sus contadores siempre serian 0).
  const slaValue = kpis?.sla_porcentaje != null ? Number(kpis.sla_porcentaje) : null;
  const slaVariant = slaValue == null ? 'default' : slaValue >= 90 ? 'success' : slaValue >= 70 ? 'warning' : 'danger';

  return (
    <PageLayout title={t('ct_title', 'Torre de control')}>
      {kpis && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
          <MetricCard
            size="lg"
            icon={AssignmentIcon}
            variant="warning"
            label={t('ct_kpi_solicitudes_pend', 'Solicitudes pendientes')}
            value={kpis.solicitudes_pendientes != null ? formatNumber(kpis.solicitudes_pendientes) : t('common_sin_datos', 'Sin datos')}
          />
          <MetricCard
            size="lg"
            icon={NotificationsActiveIcon}
            variant={kpis.alertas_activas > 0 ? 'danger' : 'success'}
            label={t('ct_kpi_alertas_activas', 'Alertas activas')}
            value={kpis.alertas_activas != null ? formatNumber(kpis.alertas_activas) : t('common_sin_datos', 'Sin datos')}
          />
          <MetricCard
            size="lg"
            icon={CheckCircleIcon}
            variant={slaVariant}
            label={t('ct_kpi_sla_cumplimiento', 'Cumplimiento de SLA')}
            value={slaValue != null ? `${formatNumber(slaValue.toFixed(1))} %` : t('common_sin_datos', 'Sin datos')}
          />
        </Box>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
            <InputLabel shrink>{t('ct_filter_categoria', 'Categoría')}</InputLabel>
            <Select
              value={filters.categoria}
              label={t('ct_filter_categoria', 'Categoría')}
              onChange={(e) => handleFilterChange('categoria', e.target.value)}
              displayEmpty
              notched
            >
              <MenuItem value="">{t('common_todas', 'Todas')}</MenuItem>
              {CATEGORIA_VALUES.map((v) => (
                <MenuItem key={v} value={v}>{lbl(CATEGORIA_LABELS, v)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
            <InputLabel shrink>{t('ct_filter_severidad', 'Severidad')}</InputLabel>
            <Select
              value={filters.severidad}
              label={t('ct_filter_severidad', 'Severidad')}
              onChange={(e) => handleFilterChange('severidad', e.target.value)}
              displayEmpty
              notched
            >
              <MenuItem value="">{t('common_todas', 'Todas')}</MenuItem>
              {SEVERIDAD_VALUES.map((v) => (
                <MenuItem key={v} value={v}>{lbl(SEVERIDAD_LABELS, v)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="date"
            label={t('ct_filter_desde', 'Desde')}
            value={filters.fecha_desde}
            onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: { xs: '1 1 140px', sm: '0 0 auto' } }}
          />
          <TextField
            size="small"
            type="date"
            label={t('ct_filter_hasta', 'Hasta')}
            value={filters.fecha_hasta}
            onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: { xs: '1 1 140px', sm: '0 0 auto' } }}
          />
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', minHeight: 48 } }}
        >
          <Tab label={t('ct_tab_linea_tiempo', 'Línea de tiempo')} icon={<TimelineIcon />} iconPosition="start" />
          <Tab label={t('ct_tab_alertas', 'Alertas')} icon={<NotificationsActiveIcon />} iconPosition="start" />
          <Tab label={t('ct_tab_tendencias', 'Tendencias')} icon={<TrendingUpIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Timeline */}
      {tabValue === 0 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider' }}
          aria-label={t('ct_tab_linea_tiempo', 'Línea de tiempo')}
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
    </PageLayout>
  );
}
