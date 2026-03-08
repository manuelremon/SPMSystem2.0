/**
 * PutawayTasks - Putaway task management page
 *
 * Displays putaway tasks with filters by estado, prioridad, and almacen.
 * Allows generating tasks from a reception and completing individual tasks.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const ESTADO_COLORS = {
  pending: 'warning',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'error',
};

const PRIORIDAD_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Baja' },
];

const PRIORIDAD_COLORS = {
  urgent: 'error',
  high: 'warning',
  normal: 'default',
  low: 'info',
};

export default function PutawayTasks() {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ estado: '', prioridad: '', almacen: '' });
  const [processing, setProcessing] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // Generate dialog
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateRecepcionId, setGenerateRecepcionId] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = { page, per_page: 20 };
        if (filters.estado) params.estado = filters.estado;
        if (filters.prioridad) params.prioridad = filters.prioridad;
        if (filters.almacen) params.almacen = filters.almacen;
        const res = await api.get('/warehouse/putaway', { params });
        if (cancelled) return;
        if (res.data?.ok) {
          setTasks(res.data.tasks || res.data.items || []);
        }
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('putaway_error_load', 'Error al cargar tareas'));
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

  const handleGenerate = async () => {
    if (!generateRecepcionId) {
      toastRef.current.warning(tRef.current('putaway_recepcion_required', 'Ingrese ID de recepcion'));
      return;
    }
    setProcessing(true);
    try {
      const res = await api.post(`/warehouse/putaway/generate/${generateRecepcionId}`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('putaway_generated', 'Tareas generadas exitosamente'));
        setGenerateOpen(false);
        setGenerateRecepcionId('');
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('putaway_error_generate', 'Error al generar tareas'));
    } finally {
      setProcessing(false);
    }
  };

  const handleComplete = useCallback(async (taskId) => {
    try {
      const res = await api.put(`/warehouse/putaway/${taskId}/complete`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('putaway_completed', 'Tarea completada'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('putaway_error_complete', 'Error al completar tarea'));
    }
  }, []);

  const columnDefs = useMemo(() => [
    { field: 'material_codigo', headerName: t('putaway_material', 'Material'), flex: 1, minWidth: 140 },
    { field: 'cantidad', headerName: t('putaway_cantidad', 'Cantidad'), width: 110, type: 'numericColumn' },
    { field: 'ubicacion_destino', headerName: t('putaway_ubicacion', 'Ubicacion Destino'), flex: 1, minWidth: 140 },
    { field: 'almacen', headerName: t('putaway_almacen', 'Almacen'), width: 120 },
    {
      field: 'estado', headerName: t('putaway_estado', 'Estado'), width: 130,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={ESTADO_OPTIONS.find(o => o.value === p.value)?.label || p.value}
          color={ESTADO_COLORS[p.value] || 'default'}
        />
      ),
    },
    {
      field: 'prioridad', headerName: t('putaway_prioridad', 'Prioridad'), width: 120,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={PRIORIDAD_OPTIONS.find(o => o.value === p.value)?.label || p.value}
          color={PRIORIDAD_COLORS[p.value] || 'default'}
          variant="outlined"
        />
      ),
    },
    { field: 'asignado_a', headerName: t('putaway_asignado', 'Asignado A'), width: 140 },
    {
      field: 'acciones', headerName: t('putaway_acciones', 'Acciones'), width: 130,
      sortable: false,
      filter: false,
      cellRenderer: (p) => {
        if (p.data?.estado === 'completed' || p.data?.estado === 'cancelled') return null;
        return (
          <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={<CheckCircleOutlineIcon />}
            onClick={(e) => { e.stopPropagation(); handleComplete(p.data.id); }}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            {t('putaway_complete_btn', 'Completar')}
          </Button>
        );
      },
    },
  ], [t, handleComplete]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" gap={1}>
          <PlaylistAddCheckIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('putaway_title', 'Tareas de Ubicacion (Putaway)')}
          </Typography>
        </Stack>
        <Button variant="contained" startIcon={<AutoFixHighIcon />} onClick={() => setGenerateOpen(true)}>
          {t('putaway_generate', 'Generar Tareas')}
        </Button>
      </Stack>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('putaway_filter_estado', 'Estado')}</InputLabel>
            <Select value={filters.estado} label={t('putaway_filter_estado', 'Estado')} onChange={(e) => handleFilterChange('estado', e.target.value)}>
              {ESTADO_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('putaway_filter_prioridad', 'Prioridad')}</InputLabel>
            <Select value={filters.prioridad} label={t('putaway_filter_prioridad', 'Prioridad')} onChange={(e) => handleFilterChange('prioridad', e.target.value)}>
              {PRIORIDAD_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label={t('putaway_filter_almacen', 'Almacen')} value={filters.almacen} onChange={(e) => handleFilterChange('almacen', e.target.value)} sx={{ minWidth: 160 }} />
        </Stack>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }} aria-label={t('putaway_title', 'Tareas de Ubicacion')}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={tasks}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          exportFileName="tareas_putaway"
          emptyMessage={t('putaway_empty', 'No hay tareas registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onClose={() => setGenerateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('putaway_generate', 'Generar Tareas de Ubicacion')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('putaway_recepcion_id', 'ID de Recepcion')}
            type="number"
            value={generateRecepcionId}
            onChange={(e) => setGenerateRecepcionId(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleGenerate} disabled={processing} startIcon={processing && <CircularProgress size={16} />}>
            {t('common_generar', 'Generar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
