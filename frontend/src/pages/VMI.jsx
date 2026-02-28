/**
 * VMI - Vendor Managed Inventory Programs list
 *
 * Displays KPI cards (programas activos, reposiciones pendientes, fill rate),
 * AG-Grid of VMI programs with filters, create dialog, and a tab for
 * pending reposiciones with approve/reject actions.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import AddIcon from '@mui/icons-material/Add';
import InventoryIcon from '@mui/icons-material/Inventory';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import PercentIcon from '@mui/icons-material/Percent';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Activo' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'draft', label: 'Borrador' },
  { value: 'terminated', label: 'Terminado' },
];

const ESTADO_COLORS = {
  active: 'success',
  suspended: 'warning',
  draft: 'default',
  terminated: 'error',
};

const ESTADO_LABELS = {
  active: 'Activo',
  suspended: 'Suspendido',
  draft: 'Borrador',
  terminated: 'Terminado',
};

const REPO_ESTADO_COLORS = {
  suggested: 'warning',
  approved: 'success',
  rejected: 'error',
  in_progress: 'info',
  delivered: 'default',
  cancelled: 'error',
};

const REPO_ESTADO_LABELS = {
  suggested: 'Sugerida',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  in_progress: 'En Proceso',
  delivered: 'Entregada',
  cancelled: 'Cancelada',
};

const INITIAL_FORM = {
  proveedor_id: '',
  material_codigo: '',
  centro: '',
  tipo_reposicion: 'min_max',
  stock_minimo: '',
  stock_maximo: '',
  punto_pedido: '',
  lead_time_dias: '',
};

export default function VMI() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [tabValue, setTabValue] = useState(0);
  const [kpis, setKpis] = useState(null);

  // Programs
  const [programas, setProgramas] = useState([]);
  const [loadingProgramas, setLoadingProgramas] = useState(true);
  const [filters, setFilters] = useState({ estado: '', proveedor: '' });

  // Reposiciones
  const [reposiciones, setReposiciones] = useState([]);
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [processingRepo, setProcessingRepo] = useState({});

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const toastRef = useRef(toast);
  toastRef.current = toast;
  const tRef = useRef(t);
  tRef.current = t;

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  // Reload function for manual refresh (after create, approve, etc.)
  const [reloadTick, setReloadTick] = useState(0);
  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      // Always load KPIs
      try {
        const { data } = await api.get('/vmi/dashboard');
        if (!cancelled && data?.ok) setKpis(data);
      } catch { /* non-critical */ }

      // Load based on tab
      if (tabValue === 0) {
        setLoadingProgramas(true);
        try {
          const params = {};
          const flt = JSON.parse(filtersKey);
          if (flt.estado) params.estado = flt.estado;
          if (flt.proveedor) params.proveedor = flt.proveedor;
          const { data } = await api.get('/vmi/programas', { params });
          if (!cancelled && data?.ok) {
            setProgramas(data.programas || data.items || []);
          }
        } catch {
          if (!cancelled) toastRef.current.error(tRef.current('vmi_error_load', 'Error al cargar programas VMI'));
        } finally {
          if (!cancelled) setLoadingProgramas(false);
        }
      } else {
        setLoadingRepo(true);
        try {
          const { data } = await api.get('/vmi/reposiciones', { params: { estado: 'suggested' } });
          if (!cancelled && data?.ok) {
            setReposiciones(data.reposiciones || data.items || []);
          }
        } catch {
          if (!cancelled) toastRef.current.error(tRef.current('vmi_error_repo', 'Error al cargar reposiciones'));
        } finally {
          if (!cancelled) setLoadingRepo(false);
        }
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [tabValue, filtersKey, reloadTick]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!form.proveedor_id || !form.material_codigo.trim() || !form.centro.trim()) {
      toastRef.current.warning(tRef.current('vmi_required', 'Complete proveedor, material y centro'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        proveedor_cuit: form.proveedor_id,
        material_codigo: form.material_codigo,
        centro_id: form.centro,
        tipo_reposicion: form.tipo_reposicion,
        min_stock: form.stock_minimo ? Number(form.stock_minimo) : null,
        max_stock: form.stock_maximo ? Number(form.stock_maximo) : null,
        punto_pedido: form.punto_pedido ? Number(form.punto_pedido) : null,
        frecuencia_dias: form.lead_time_dias ? Number(form.lead_time_dias) : null,
      };
      const res = await api.post('/vmi/programas', payload);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('vmi_created', 'Programa VMI creado'));
        setDialogOpen(false);
        setForm(INITIAL_FORM);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('vmi_error_create', 'Error al crear programa'));
    } finally {
      setSubmitting(false);
    }
  }, [form, reload]);

  const handleRepoAction = useCallback(async (repoId, action) => {
    setProcessingRepo((prev) => ({ ...prev, [repoId]: action }));
    try {
      const res = await api.put(`/vmi/reposiciones/${repoId}/${action}`);
      if (res.data?.ok) {
        toastRef.current.success(
          action === 'approve'
            ? tRef.current('vmi_repo_approved', 'Reposicion aprobada')
            : tRef.current('vmi_repo_rejected', 'Reposicion rechazada')
        );
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('vmi_error_repo_action', 'Error al procesar reposicion'));
    } finally {
      setProcessingRepo((prev) => ({ ...prev, [repoId]: null }));
    }
  }, [reload]);

  const programaColumnDefs = useMemo(() => [
    { field: 'nombre', headerName: t('vmi_col_nombre', 'Nombre'), flex: 1.5, minWidth: 180 },
    {
      field: 'proveedor_nombre',
      headerName: t('vmi_col_proveedor', 'Proveedor'),
      flex: 1.5,
      minWidth: 160,
      valueGetter: (p) => p.data?.proveedor_nombre || p.data?.proveedor_cuit || '-',
    },
    { field: 'material_codigo', headerName: t('vmi_col_material', 'Material'), flex: 1, minWidth: 140 },
    { field: 'centro_id', headerName: t('vmi_col_centro', 'Centro'), width: 100 },
    {
      field: 'estado',
      headerName: t('vmi_col_estado', 'Estado'),
      width: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={ESTADO_LABELS[p.value] || p.value || '-'} color={ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    { field: 'tipo_reposicion', headerName: t('vmi_col_tipo', 'Tipo Reposicion'), width: 140 },
    { field: 'min_stock', headerName: t('vmi_col_min', 'Min'), width: 80, type: 'numericColumn' },
    { field: 'max_stock', headerName: t('vmi_col_max', 'Max'), width: 80, type: 'numericColumn' },
    { field: 'punto_pedido', headerName: t('vmi_col_rop', 'Pto. Pedido'), width: 100, type: 'numericColumn' },
  ], [t]);

  const repoColumnDefs = useMemo(() => [
    { field: 'programa_id', headerName: t('vmi_col_programa', 'Programa'), width: 100 },
    { field: 'proveedor_nombre', headerName: t('vmi_col_proveedor', 'Proveedor'), flex: 1, minWidth: 160 },
    { field: 'material_codigo', headerName: t('vmi_col_material', 'Material'), flex: 1, minWidth: 140 },
    { field: 'cantidad_sugerida', headerName: t('vmi_col_sugerida', 'Sugerida'), width: 110, type: 'numericColumn' },
    {
      field: 'estado',
      headerName: t('vmi_col_estado', 'Estado'),
      width: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={REPO_ESTADO_LABELS[p.value] || p.value || '-'} color={REPO_ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    {
      headerName: t('vmi_col_acciones', 'Acciones'),
      width: 230,
      sortable: false,
      filter: false,
      cellRenderer: (p) => {
        const row = p.data;
        if (!row || row.estado !== 'suggested') return null;
        const isProcessing = processingRepo[row.id];
        return (
          <Stack direction="row" gap={0.5} alignItems="center" sx={{ height: '100%' }}>
            <Button
              size="small"
              variant="outlined"
              color="success"
              startIcon={isProcessing === 'approve' ? <CircularProgress size={14} /> : <CheckCircleIcon />}
              onClick={(e) => { e.stopPropagation(); handleRepoAction(row.id, 'approve'); }}
              disabled={!!isProcessing}
            >
              {t('vmi_aprobar', 'Aprobar')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={isProcessing === 'reject' ? <CircularProgress size={14} /> : <CancelIcon />}
              onClick={(e) => { e.stopPropagation(); handleRepoAction(row.id, 'reject'); }}
              disabled={!!isProcessing}
            >
              {t('vmi_rechazar', 'Rechazar')}
            </Button>
          </Stack>
        );
      },
    },
  ], [t, processingRepo, handleRepoAction]);

  const KpiCard = ({ icon, label, value, color }) => (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, flex: 1, minWidth: 170 }}>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <StorefrontIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('vmi_title', 'VMI - Inventario Gestionado por Proveedor')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          aria-label={t('vmi_new', 'Nuevo Programa VMI')}
        >
          {t('vmi_new', 'Nuevo Programa VMI')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
          <KpiCard
            icon={<InventoryIcon fontSize="small" sx={{ color: 'success.main' }} />}
            label={t('vmi_kpi_activos', 'Programas Activos')}
            value={kpis.programas_activos}
            color="success.main"
          />
          <KpiCard
            icon={<AutorenewIcon fontSize="small" sx={{ color: 'warning.main' }} />}
            label={t('vmi_kpi_reposiciones', 'Reposiciones Pendientes')}
            value={kpis.reposiciones_pendientes}
            color="warning.main"
          />
          <KpiCard
            icon={<PercentIcon fontSize="small" sx={{ color: 'info.main' }} />}
            label={t('vmi_kpi_fill_rate', 'Fill Rate Promedio')}
            value={kpis.fill_rate_promedio != null ? `${Number(kpis.fill_rate_promedio).toFixed(1)}%` : null}
            color="info.main"
          />
        </Stack>
      )}

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={t('vmi_tab_programas', 'Programas')} icon={<InventoryIcon />} iconPosition="start" />
          <Tab label={t('vmi_tab_reposiciones', 'Reposiciones Pendientes')} icon={<AutorenewIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Programas */}
      {tabValue === 0 && (
        <>
          {/* Filters */}
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>{t('vmi_filter_estado', 'Estado')}</InputLabel>
                <Select
                  value={filters.estado}
                  label={t('vmi_filter_estado', 'Estado')}
                  onChange={(e) => handleFilterChange('estado', e.target.value)}
                >
                  {ESTADO_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label={t('vmi_filter_proveedor', 'Proveedor')}
                value={filters.proveedor}
                onChange={(e) => handleFilterChange('proveedor', e.target.value)}
                sx={{ minWidth: 200 }}
              />
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            aria-label={t('vmi_tab_programas', 'Programas VMI')}
          >
            <SPMAgGrid
              columnDefs={programaColumnDefs}
              rowData={programas}
              loading={loadingProgramas}
              height={480}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="vmi_programas"
              emptyMessage={t('vmi_empty', 'No hay programas VMI registrados')}
              getRowId={(params) => String(params.data.id)}
              onRowClicked={(e) => {
                if (e.data?.id) navigate(`/operations/vmi/${e.data.id}`);
              }}
            />
          </Paper>
        </>
      )}

      {/* Tab 1: Reposiciones Pendientes */}
      {tabValue === 1 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
          aria-label={t('vmi_tab_reposiciones', 'Reposiciones Pendientes')}
        >
          <SPMAgGrid
            columnDefs={repoColumnDefs}
            rowData={reposiciones}
            loading={loadingRepo}
            height={480}
            pagination={true}
            paginationPageSize={20}
            enableQuickFilter={true}
            exportFileName="vmi_reposiciones"
            emptyMessage={t('vmi_empty_repo', 'No hay reposiciones pendientes')}
            getRowId={(params) => String(params.data.id)}
          />
        </Paper>
      )}

      {/* Create Program Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <StorefrontIcon color="primary" />
            <span>{t('vmi_new', 'Nuevo Programa VMI')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('vmi_field_proveedor', 'ID Proveedor')}
              value={form.proveedor_id}
              onChange={(e) => handleFormChange('proveedor_id', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('vmi_field_material', 'Codigo Material')}
              value={form.material_codigo}
              onChange={(e) => handleFormChange('material_codigo', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('vmi_field_centro', 'Centro')}
              value={form.centro}
              onChange={(e) => handleFormChange('centro', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <FormControl size="small" fullWidth>
              <InputLabel>{t('vmi_field_tipo', 'Tipo Reposicion')}</InputLabel>
              <Select
                value={form.tipo_reposicion}
                label={t('vmi_field_tipo', 'Tipo Reposicion')}
                onChange={(e) => handleFormChange('tipo_reposicion', e.target.value)}
              >
                <MenuItem value="min_max">Min/Max</MenuItem>
                <MenuItem value="eoq">EOQ</MenuItem>
                <MenuItem value="periodic">Periodico</MenuItem>
                <MenuItem value="forecast_based">Basado en Forecast</MenuItem>
              </Select>
            </FormControl>
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('vmi_field_min', 'Stock Minimo')}
                type="number"
                value={form.stock_minimo}
                onChange={(e) => handleFormChange('stock_minimo', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0 }}
              />
              <TextField
                label={t('vmi_field_max', 'Stock Maximo')}
                type="number"
                value={form.stock_maximo}
                onChange={(e) => handleFormChange('stock_maximo', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0 }}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('vmi_field_rop', 'Punto de Pedido')}
                type="number"
                value={form.punto_pedido}
                onChange={(e) => handleFormChange('punto_pedido', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0 }}
              />
              <TextField
                label={t('vmi_field_lead_time', 'Lead Time (dias)')}
                type="number"
                value={form.lead_time_dias}
                onChange={(e) => handleFormChange('lead_time_dias', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0 }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={submitting || !form.proveedor_id || !form.material_codigo.trim() || !form.centro.trim()}
            startIcon={submitting && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
