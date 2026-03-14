/**
 * KitOrders - Kit order management page
 *
 * Displays kit orders with KPI cards (active, completed, on-time %),
 * AG-Grid table with filters by estado and kit_bom_id, create order dialog.
 * Row click navigates to order detail page.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InventoryIcon from '@mui/icons-material/Inventory';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BuildIcon from '@mui/icons-material/Build';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'asignado', label: 'Asignado' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'en_proceso', label: 'En Proceso' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const ESTADO_COLORS = {
  pendiente: 'default',
  asignado: 'info',
  parcial: 'warning',
  en_proceso: 'primary',
  completado: 'success',
  cancelado: 'error',
};

const ESTADO_LABELS = {
  pendiente: 'Pendiente',
  asignado: 'Asignado',
  parcial: 'Parcial',
  en_proceso: 'En Proceso',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

const PRIORIDAD_OPTIONS = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Critica' },
];

const PRIORIDAD_COLORS = {
  baja: 'default',
  media: 'info',
  alta: 'warning',
  critica: 'error',
};

const PRIORIDAD_LABELS = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Critica',
};

const INITIAL_ORDER_FORM = {
  kit_bom_id: '',
  cantidad_kits: '',
  prioridad: 'media',
  almacen_id: '',
  fecha_requerida: '',
};

export default function KitOrders() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [kitsOptions, setKitsOptions] = useState([]);
  const [filters, setFilters] = useState({ estado: '', kit_bom_id: '' });

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [orderForm, setOrderForm] = useState(INITIAL_ORDER_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: 1, per_page: 200 };
      if (filters.estado) params.estado = filters.estado;
      if (filters.kit_bom_id) params.kit_bom_id = filters.kit_bom_id;
      const res = await api.get('/kitting/orders', { params });
      if (res.data?.ok) {
        setOrders(res.data.orders || res.data.items || []);
      }
    } catch {
      toast.error(t('kit_error_load', 'Error al cargar ordenes de kit'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchKPIs = useCallback(async () => {
    try {
      const res = await api.get('/kitting/kpis');
      if (res.data?.ok) {
        setKpis(res.data.kpis || res.data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchKitsOptions = useCallback(async () => {
    try {
      const res = await api.get('/kitting/boms', { params: { per_page: 100 } });
      if (res.data?.ok) {
        setKitsOptions(res.data.boms || res.data.items || []);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchKPIs();
    fetchKitsOptions();
  }, [fetchOrders, fetchKPIs, fetchKitsOptions]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setOrderForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreateOrder = useCallback(async () => {
    if (!orderForm.kit_bom_id || !orderForm.cantidad_kits || !orderForm.fecha_requerida) {
      toast.warning(t('kit_required_fields', 'Complete kit, cantidad y fecha requerida'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        kit_bom_id: Number(orderForm.kit_bom_id),
        cantidad_kits: Number(orderForm.cantidad_kits),
        prioridad: orderForm.prioridad,
        almacen_id: orderForm.almacen_id ? String(orderForm.almacen_id) : undefined,
        fecha_requerida: orderForm.fecha_requerida,
      };
      const res = await api.post('/kitting/orders', payload);
      if (res.data?.ok) {
        toast.success(t('kit_created', 'Orden de kit creada'));
        setCreateOpen(false);
        setOrderForm(INITIAL_ORDER_FORM);
        fetchOrders();
        fetchKPIs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('kit_error_create', 'Error al crear orden'));
    } finally {
      setSubmitting(false);
    }
  }, [orderForm, t, toast, fetchOrders, fetchKPIs]);

  const columnDefs = useMemo(() => [
    { field: 'numero_orden', headerName: t('kit_numero', 'Numero Orden'), flex: 1, minWidth: 140 },
    { field: 'kit_nombre', headerName: t('kit_kit', 'Kit'), flex: 1.5, minWidth: 160 },
    {
      field: 'cantidad_kits',
      headerName: t('kit_cantidad', 'Cantidad Kits'),
      width: 130,
      type: 'numericColumn',
    },
    {
      field: 'estado',
      headerName: t('kit_estado', 'Estado'),
      width: 140,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={ESTADO_LABELS[p.value] || p.value || '-'}
          color={ESTADO_COLORS[p.value] || 'default'}
        />
      ),
    },
    {
      field: 'prioridad',
      headerName: t('kit_prioridad', 'Prioridad'),
      width: 120,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={PRIORIDAD_LABELS[p.value] || p.value || '-'}
          color={PRIORIDAD_COLORS[p.value] || 'default'}
          variant="outlined"
        />
      ),
    },
    { field: 'almacen_id', headerName: t('kit_almacen', 'Almacen'), width: 110 },
    {
      field: 'fecha_requerida',
      headerName: t('kit_fecha_requerida', 'Fecha Requerida'),
      width: 140,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'fecha_completado',
      headerName: t('kit_fecha_completado', 'Fecha Completado'),
      width: 150,
      valueFormatter: (p) => formatDate(p.value),
    },
  ], [t]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
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
            {t('kit_title', 'Ordenes de Kit')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          aria-label={t('kit_new', 'Crear Orden')}
        >
          {t('kit_new', 'Crear Orden')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 180 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
              <InventoryIcon fontSize="small" sx={{ color: 'info.main' }} />
              <Typography variant="caption" color="text.secondary">
                {t('kit_kpi_activas', 'Ordenes Activas')}
              </Typography>
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
              {kpis.activas ?? 0}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 180 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
              <CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />
              <Typography variant="caption" color="text.secondary">
                {t('kit_kpi_completadas', 'Completadas (Mes)')}
              </Typography>
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
              {kpis.completadas_mes ?? 0}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 180 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
              <AccessTimeIcon fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography variant="caption" color="text.secondary">
                {t('kit_kpi_ontime', '% On-Time')}
              </Typography>
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {kpis.on_time_pct != null ? `${Number(kpis.on_time_pct).toFixed(1)}%` : '-'}
            </Typography>
          </Paper>
        </Stack>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('kit_filter_estado', 'Estado')}</InputLabel>
            <Select
              value={filters.estado}
              label={t('kit_filter_estado', 'Estado')}
              onChange={(e) => handleFilterChange('estado', e.target.value)}
            >
              {ESTADO_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('kit_filter_kit', 'Kit BOM')}</InputLabel>
            <Select
              value={filters.kit_bom_id}
              label={t('kit_filter_kit', 'Kit BOM')}
              onChange={(e) => handleFilterChange('kit_bom_id', e.target.value)}
            >
              <MenuItem value="">{t('common_todos', 'Todos')}</MenuItem>
              {kitsOptions.map((k) => (
                <MenuItem key={k.id} value={k.id}>{k.nombre || k.codigo || `Kit #${k.id}`}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Orders Table */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider' }}
        aria-label={t('kit_title', 'Ordenes de Kit')}
      >
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={orders}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={(row) => navigate(`/operations/kitting/orders/${row.id}`)}
          exportFileName="ordenes_kit"
          emptyMessage={t('kit_empty', 'No hay ordenes de kit registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Create Order Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <BuildIcon color="primary" />
            <span>{t('kit_new', 'Crear Orden de Kit')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small" required>
              <InputLabel>{t('kit_field_bom', 'Kit BOM')}</InputLabel>
              <Select
                value={orderForm.kit_bom_id}
                label={t('kit_field_bom', 'Kit BOM')}
                onChange={(e) => handleFormChange('kit_bom_id', e.target.value)}
              >
                {kitsOptions.map((k) => (
                  <MenuItem key={k.id} value={k.id}>{k.nombre || k.codigo || `Kit #${k.id}`}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('kit_field_cantidad', 'Cantidad de Kits')}
              type="number"
              value={orderForm.cantidad_kits}
              onChange={(e) => handleFormChange('cantidad_kits', e.target.value)}
              fullWidth
              required
              size="small"
              inputProps={{ min: 1, step: 1 }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>{t('kit_field_prioridad', 'Prioridad')}</InputLabel>
              <Select
                value={orderForm.prioridad}
                label={t('kit_field_prioridad', 'Prioridad')}
                onChange={(e) => handleFormChange('prioridad', e.target.value)}
              >
                {PRIORIDAD_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('kit_field_almacen', 'Almacen')}
              value={orderForm.almacen_id}
              onChange={(e) => handleFormChange('almacen_id', e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label={t('kit_field_fecha', 'Fecha Requerida')}
              type="date"
              value={orderForm.fecha_requerida}
              onChange={(e) => handleFormChange('fecha_requerida', e.target.value)}
              fullWidth
              required
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={submitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateOrder}
            disabled={submitting || !orderForm.kit_bom_id || !orderForm.cantidad_kits || !orderForm.fecha_requerida}
            startIcon={submitting ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {t('common_crear', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
