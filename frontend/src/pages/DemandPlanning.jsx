/**
 * DemandPlanning - S&OP demand planning cycles list
 *
 * Displays demand planning cycles with KPI accuracy cards,
 * filters, and paginated table. Allows creating new cycles.
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
import EventNoteIcon from '@mui/icons-material/EventNote';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import PercentIcon from '@mui/icons-material/Percent';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'collecting', label: 'Recopilando' },
  { value: 'review', label: 'Revision' },
  { value: 'consensus', label: 'Consenso' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const ESTADO_COLORS = {
  draft: 'default',
  collecting: 'info',
  review: 'warning',
  consensus: 'secondary',
  approved: 'success',
  closed: 'default',
  cancelled: 'error',
};

const INITIAL_FORM = {
  nombre: '',
  periodo_desde: '',
  periodo_hasta: '',
};

export default function DemandPlanning() {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;
  const navigate = useNavigate();

  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ estado: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = { page, per_page: 20 };
        if (filters.estado) params.estado = filters.estado;
        const [cyclesRes, kpiRes] = await Promise.all([
          api.get('/demand-planning/cycles', { params }),
          api.get('/demand-planning/accuracy'),
        ]);
        if (cancelled) return;
        if (cyclesRes.data?.ok) setCycles(cyclesRes.data.items || []);
        if (kpiRes.data?.ok) setKpis(kpiRes.data);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('demand_error_load', 'Error al cargar ciclos de demanda'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [page, filters, reloadTick]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1);
  }, []);

  const handleCreate = async () => {
    if (!form.nombre || !form.periodo_desde || !form.periodo_hasta) {
      toastRef.current.warning(tRef.current('demand_form_required', 'Complete todos los campos'));
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/demand-planning/cycles', form);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('demand_created', 'Ciclo creado exitosamente'));
        setCreateOpen(false);
        setForm(INITIAL_FORM);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('demand_error_create', 'Error al crear ciclo'));
    } finally {
      setSaving(false);
    }
  };

  const columnDefs = useMemo(() => [
    { field: 'nombre', headerName: t('demand_nombre', 'Nombre'), flex: 2, minWidth: 200 },
    {
      field: 'periodo_desde', headerName: t('demand_desde', 'Desde'), width: 120,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'periodo_hasta', headerName: t('demand_hasta', 'Hasta'), width: 120,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'estado', headerName: t('demand_estado', 'Estado'), width: 140,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={ESTADO_OPTIONS.find(o => o.value === p.value)?.label || p.value}
          color={ESTADO_COLORS[p.value] || 'default'}
        />
      ),
    },
    { field: 'num_entradas', headerName: t('demand_entradas', 'Entradas'), width: 100 },
    { field: 'creado_por_nombre', headerName: t('demand_creado_por', 'Creado por'), width: 140 },
  ], [t]);

  const KpiCard = ({ icon, label, value, unit, color }) => (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', flex: 1, minWidth: 180 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
        {icon}
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </Stack>
      <Typography variant="h5" sx={{ fontWeight: 700, color: color || 'text.primary' }}>
        {value != null ? value : '--'}{unit || ''}
      </Typography>
    </Paper>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" gap={1}>
          <EventNoteIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('demand_title', 'Planificacion de Demanda (S&OP)')}
          </Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          {t('demand_new', 'Nuevo Ciclo')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <KpiCard
            icon={<TrackChangesIcon fontSize="small" sx={{ color: 'info.main' }} />}
            label={t('demand_kpi_mape', 'MAPE')}
            value={kpis.mape != null ? kpis.mape.toFixed(1) : null}
            unit="%"
            color="info.main"
          />
          <KpiCard
            icon={<TrendingUpIcon fontSize="small" sx={{ color: 'warning.main' }} />}
            label={t('demand_kpi_bias', 'Bias')}
            value={kpis.bias != null ? kpis.bias.toFixed(2) : null}
            color="warning.main"
          />
          <KpiCard
            icon={<PercentIcon fontSize="small" sx={{ color: 'success.main' }} />}
            label={t('demand_kpi_accuracy', 'Precision')}
            value={kpis.accuracy_pct != null ? kpis.accuracy_pct.toFixed(1) : null}
            unit="%"
            color="success.main"
          />
        </Stack>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('demand_filter_estado', 'Estado')}</InputLabel>
            <Select value={filters.estado} label={t('demand_filter_estado', 'Estado')} onChange={(e) => handleFilterChange('estado', e.target.value)}>
              {ESTADO_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }} aria-label={t('demand_title', 'Planificacion de Demanda')}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={cycles}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={(row) => navigate(`/planning/demand/${row.id}`)}
          exportFileName="ciclos_demanda"
          emptyMessage={t('demand_empty', 'No hay ciclos de demanda registrados')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('demand_new', 'Nuevo Ciclo')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('demand_nombre', 'Nombre')}
              value={form.nombre}
              onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label={t('demand_desde', 'Periodo Desde')}
              type="date"
              value={form.periodo_desde}
              onChange={(e) => setForm(prev => ({ ...prev, periodo_desde: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
            <TextField
              label={t('demand_hasta', 'Periodo Hasta')}
              type="date"
              value={form.periodo_hasta}
              onChange={(e) => setForm(prev => ({ ...prev, periodo_hasta: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving} startIcon={saving && <CircularProgress size={16} />}>
            {t('common_crear', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
