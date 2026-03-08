/**
 * ECOList - Engineering Change Orders list page
 *
 * Displays ECO KPI cards, AG-Grid with filters (estado, tipo, prioridad, material),
 * and a dialog for creating new ECOs.
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import EngineeringIcon from '@mui/icons-material/Engineering';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'submitted', label: 'Enviado' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'implemented', label: 'Implementado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const ESTADO_COLORS = {
  draft: 'default',
  submitted: 'info',
  approved: 'success',
  rejected: 'error',
  implemented: 'success',
  cancelled: 'default',
};

const ESTADO_LABELS = {
  draft: 'Borrador',
  submitted: 'Enviado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  implemented: 'Implementado',
  cancelled: 'Cancelado',
};

const TIPO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'material_change', label: 'Cambio Material' },
  { value: 'specification', label: 'Especificacion' },
  { value: 'process', label: 'Proceso' },
  { value: 'supplier', label: 'Proveedor' },
  { value: 'packaging', label: 'Empaque' },
];

const TIPO_LABELS = {
  material_change: 'Cambio Material',
  specification: 'Especificacion',
  process: 'Proceso',
  supplier: 'Proveedor',
  packaging: 'Empaque',
};

const PRIORIDAD_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Critica' },
];

const PRIORIDAD_COLORS = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

const PRIORIDAD_LABELS = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica',
};

const INITIAL_FORM = {
  titulo: '',
  descripcion: '',
  tipo: 'material_change',
  prioridad: 'medium',
  material_codigo: '',
  fecha_efectividad: '',
  costo_estimado: '',
  justificacion: '',
};

export default function ECOList() {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;
  const navigate = useNavigate();

  const [ecos, setEcos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [filters, setFilters] = useState({
    estado: '',
    tipo: '',
    prioridad: '',
    material: '',
  });
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = { page: 1, per_page: 200 };
        if (filters.estado) params.estado = filters.estado;
        if (filters.tipo) params.tipo = filters.tipo;
        if (filters.prioridad) params.prioridad = filters.prioridad;
        if (filters.material) params.material = filters.material;
        const [ecoRes, kpiRes] = await Promise.all([
          api.get('/eco', { params }),
          api.get('/eco/kpis')
        ]);
        if (cancelled) return;
        if (ecoRes.data?.ok) setEcos(ecoRes.data.ecos || ecoRes.data.items || []);
        if (kpiRes.data?.ok) setKpis(kpiRes.data.kpis || kpiRes.data);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('eco_error_load', 'Error al cargar ECOs'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [filters, reloadTick]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!form.titulo.trim()) {
      toastRef.current.warning(tRef.current('eco_required_titulo', 'Complete el titulo'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        costo_estimado: form.costo_estimado ? parseFloat(form.costo_estimado) : null,
      };
      const res = await api.post('/eco', payload);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('eco_created', 'ECO creada'));
        setDialogOpen(false);
        setForm(INITIAL_FORM);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('eco_error_create', 'Error al crear ECO'));
    } finally {
      setSubmitting(false);
    }
  }, [form]);

  const columnDefs = useMemo(() => [
    { field: 'numero_eco', headerName: t('eco_col_numero', 'N. ECO'), width: 130 },
    { field: 'titulo', headerName: t('eco_col_titulo', 'Titulo'), flex: 2, minWidth: 200 },
    {
      field: 'tipo',
      headerName: t('eco_col_tipo', 'Tipo'),
      width: 140,
      cellRenderer: (p) => <Chip size="small" label={TIPO_LABELS[p.value] || p.value || '-'} variant="outlined" />,
    },
    {
      field: 'prioridad',
      headerName: t('eco_col_prioridad', 'Prioridad'),
      width: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={PRIORIDAD_LABELS[p.value] || p.value || '-'} color={PRIORIDAD_COLORS[p.value] || 'default'} />
      ),
    },
    {
      field: 'estado',
      headerName: t('eco_col_estado', 'Estado'),
      width: 130,
      cellRenderer: (p) => (
        <Chip size="small" label={ESTADO_LABELS[p.value] || p.value || '-'} color={ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    { field: 'material_codigo', headerName: t('eco_col_material', 'Material'), width: 130 },
    { field: 'solicitante', headerName: t('eco_col_solicitante', 'Solicitante'), flex: 1, minWidth: 130 },
    {
      field: 'fecha_efectividad',
      headerName: t('eco_col_fecha_efectividad', 'Fecha Efectividad'),
      width: 140,
      valueFormatter: (p) => formatDate(p.value),
    },
  ], [t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <EngineeringIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('eco_title', 'Ordenes de Cambio de Ingenieria')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          aria-label={t('eco_new', 'Crear ECO')}
        >
          {t('eco_new', 'Crear ECO')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('eco_kpi_pending', 'Pendientes')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {kpis.pendientes ?? 0}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('eco_kpi_implemented', 'Implementadas (mes)')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
              {kpis.implementadas_mes ?? 0}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('eco_kpi_rejected', 'Rechazadas (mes)')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
              {kpis.rechazadas_mes ?? 0}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('eco_kpi_avg_time', 'Tiempo Prom. Aprobacion')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {kpis.tiempo_promedio_aprobacion != null ? `${Number(kpis.tiempo_promedio_aprobacion).toFixed(1)}d` : '-'}
            </Typography>
          </Paper>
        </Stack>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('eco_filter_estado', 'Estado')}</InputLabel>
            <Select
              value={filters.estado}
              label={t('eco_filter_estado', 'Estado')}
              onChange={(e) => handleFilterChange('estado', e.target.value)}
            >
              {ESTADO_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('eco_filter_tipo', 'Tipo')}</InputLabel>
            <Select
              value={filters.tipo}
              label={t('eco_filter_tipo', 'Tipo')}
              onChange={(e) => handleFilterChange('tipo', e.target.value)}
            >
              {TIPO_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('eco_filter_prioridad', 'Prioridad')}</InputLabel>
            <Select
              value={filters.prioridad}
              label={t('eco_filter_prioridad', 'Prioridad')}
              onChange={(e) => handleFilterChange('prioridad', e.target.value)}
            >
              {PRIORIDAD_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t('eco_filter_material', 'Material')}
            value={filters.material}
            onChange={(e) => handleFilterChange('material', e.target.value)}
            sx={{ minWidth: 160 }}
          />
        </Stack>
      </Paper>

      {/* Data Table */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider' }}
        aria-label={t('eco_title', 'Ordenes de Cambio de Ingenieria')}
      >
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={ecos}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={(row) => navigate(`/engineering/eco/${row.id}`)}
          exportFileName="eco_list"
          emptyMessage={t('eco_empty', 'No hay ECOs registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Create ECO Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <EngineeringIcon color="primary" />
            <span>{t('eco_new', 'Crear ECO')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('eco_field_titulo', 'Titulo')}
              value={form.titulo}
              onChange={(e) => handleFormChange('titulo', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('eco_field_descripcion', 'Descripcion')}
              value={form.descripcion}
              onChange={(e) => handleFormChange('descripcion', e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('eco_field_tipo', 'Tipo')}</InputLabel>
                <Select
                  value={form.tipo}
                  label={t('eco_field_tipo', 'Tipo')}
                  onChange={(e) => handleFormChange('tipo', e.target.value)}
                >
                  {TIPO_OPTIONS.filter((o) => o.value).map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('eco_field_prioridad', 'Prioridad')}</InputLabel>
                <Select
                  value={form.prioridad}
                  label={t('eco_field_prioridad', 'Prioridad')}
                  onChange={(e) => handleFormChange('prioridad', e.target.value)}
                >
                  {PRIORIDAD_OPTIONS.filter((o) => o.value).map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label={t('eco_field_material', 'Material Codigo')}
              value={form.material_codigo}
              onChange={(e) => handleFormChange('material_codigo', e.target.value)}
              fullWidth
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('eco_field_fecha_efectividad', 'Fecha Efectividad')}
                type="date"
                value={form.fecha_efectividad}
                onChange={(e) => handleFormChange('fecha_efectividad', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label={t('eco_field_costo', 'Costo Estimado')}
                type="number"
                value={form.costo_estimado}
                onChange={(e) => handleFormChange('costo_estimado', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Stack>
            <TextField
              label={t('eco_field_justificacion', 'Justificacion')}
              value={form.justificacion}
              onChange={(e) => handleFormChange('justificacion', e.target.value)}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={submitting || !form.titulo.trim()}
            startIcon={submitting && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
