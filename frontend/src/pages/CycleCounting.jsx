/**
 * CycleCounting - Cycle counting management page
 *
 * Displays KPI cards (accuracy, pending, variance, adjustments), tabbed view
 * for Programs and Counts, AG-Grid tables with filters, and dialogs for
 * creating programs and generating counts.
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
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import AddIcon from '@mui/icons-material/Add';
import InventoryIcon from '@mui/icons-material/Inventory';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const PROGRAM_ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Activo' },
  { value: 'paused', label: 'Pausado' },
  { value: 'completed', label: 'Completado' },
];

const PROGRAM_ESTADO_COLORS = {
  active: 'success',
  paused: 'warning',
  completed: 'default',
};

const PROGRAM_ESTADO_LABELS = {
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Completado',
};

const COUNT_ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'planned', label: 'Planificado' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const COUNT_ESTADO_COLORS = {
  planned: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'error',
};

const COUNT_ESTADO_LABELS = {
  planned: 'Planificado',
  in_progress: 'En Progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const TIPO_OPTIONS = [
  { value: 'abc_scheduled', label: 'ABC Programado' },
  { value: 'spot', label: 'Spot' },
  { value: 'full_physical', label: 'Inventario Fisico' },
];

const TIPO_LABELS = {
  abc_scheduled: 'ABC Programado',
  spot: 'Spot',
  full_physical: 'Inv. Fisico',
};

const INITIAL_PROGRAM_FORM = {
  nombre: '',
  tipo: 'abc_scheduled',
  almacen_id: '',
  freq_a_dias: '30',
  freq_b_dias: '60',
  freq_c_dias: '90',
};

const INITIAL_COUNT_FORM = {
  tipo: 'abc_scheduled',
  almacen_id: '',
  programa_id: '',
};

export default function CycleCounting() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const [tabValue, setTabValue] = useState(0);
  const [kpis, setKpis] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // Programs state
  const [programs, setPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programFilters, setProgramFilters] = useState({ estado: '' });
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [programForm, setProgramForm] = useState(INITIAL_PROGRAM_FORM);
  const [programSubmitting, setProgramSubmitting] = useState(false);

  // Counts state
  const [counts, setCounts] = useState([]);
  const [countsLoading, setCountsLoading] = useState(true);
  const [countFilters, setCountFilters] = useState({ estado: '', almacen_id: '', tipo: '' });
  const [countDialogOpen, setCountDialogOpen] = useState(false);
  const [countForm, setCountForm] = useState(INITIAL_COUNT_FORM);
  const [countSubmitting, setCountSubmitting] = useState(false);

  // Load KPIs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/cycle-count/kpis');
        if (!cancelled && res.data?.ok) setKpis(res.data.kpis || res.data);
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  // Load tab data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (tabValue === 0) {
        setProgramsLoading(true);
        try {
          const params = { page: 1, per_page: 200 };
          if (programFilters.estado) params.estado = programFilters.estado;
          const res = await api.get('/cycle-count/programs', { params });
          if (!cancelled && res.data?.ok) {
            setPrograms(res.data.programs || res.data.items || []);
          }
        } catch {
          if (!cancelled) toastRef.current.error(tRef.current('cc_error_load_programs', 'Error al cargar programas'));
        } finally {
          if (!cancelled) setProgramsLoading(false);
        }
      } else {
        setCountsLoading(true);
        try {
          const params = { page: 1, per_page: 200 };
          if (countFilters.estado) params.estado = countFilters.estado;
          if (countFilters.almacen_id) params.almacen_id = countFilters.almacen_id;
          if (countFilters.tipo) params.tipo = countFilters.tipo;
          const res = await api.get('/cycle-count/counts', { params });
          if (!cancelled && res.data?.ok) {
            setCounts(res.data.counts || res.data.items || []);
          }
        } catch {
          if (!cancelled) toastRef.current.error(tRef.current('cc_error_load_counts', 'Error al cargar conteos'));
        } finally {
          if (!cancelled) setCountsLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tabValue, programFilters, countFilters, reloadTick]);

  // Program form handlers
  const handleProgramFormChange = useCallback((field, value) => {
    setProgramForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreateProgram = async () => {
    if (!programForm.nombre.trim() || !programForm.almacen_id.trim()) {
      toastRef.current.warning(tRef.current('cc_required_program', 'Complete nombre y almacen'));
      return;
    }
    setProgramSubmitting(true);
    try {
      const payload = {
        ...programForm,
        freq_a_dias: parseInt(programForm.freq_a_dias) || 30,
        freq_b_dias: parseInt(programForm.freq_b_dias) || 60,
        freq_c_dias: parseInt(programForm.freq_c_dias) || 90,
      };
      const res = await api.post('/cycle-count/programs', payload);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('cc_program_created', 'Programa creado'));
        setProgramDialogOpen(false);
        setProgramForm(INITIAL_PROGRAM_FORM);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('cc_error_create_program', 'Error al crear programa'));
    } finally {
      setProgramSubmitting(false);
    }
  };

  // Count form handlers
  const handleCountFormChange = useCallback((field, value) => {
    setCountForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleGenerateCount = async () => {
    if (!countForm.tipo || !countForm.almacen_id.trim()) {
      toastRef.current.warning(tRef.current('cc_required_count', 'Seleccione tipo y almacen'));
      return;
    }
    setCountSubmitting(true);
    try {
      const payload = { ...countForm };
      if (!payload.programa_id) delete payload.programa_id;
      const res = await api.post('/cycle-count/counts/generate', payload);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('cc_count_generated', 'Conteo generado'));
        setCountDialogOpen(false);
        setCountForm(INITIAL_COUNT_FORM);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('cc_error_generate', 'Error al generar conteo'));
    } finally {
      setCountSubmitting(false);
    }
  };

  const programColumnDefs = useMemo(() => [
    { field: 'nombre', headerName: t('cc_prog_nombre', 'Nombre'), flex: 2, minWidth: 180 },
    {
      field: 'tipo',
      headerName: t('cc_prog_tipo', 'Tipo'),
      width: 140,
      cellRenderer: (p) => <Chip size="small" label={TIPO_LABELS[p.value] || p.value || '-'} variant="outlined" />,
    },
    { field: 'almacen_id', headerName: t('cc_prog_almacen', 'Almacen'), width: 120 },
    { field: 'freq_a_dias', headerName: t('cc_prog_freq_a', 'Freq A (dias)'), width: 120, type: 'numericColumn' },
    { field: 'freq_b_dias', headerName: t('cc_prog_freq_b', 'Freq B (dias)'), width: 120, type: 'numericColumn' },
    { field: 'freq_c_dias', headerName: t('cc_prog_freq_c', 'Freq C (dias)'), width: 120, type: 'numericColumn' },
    {
      field: 'estado',
      headerName: t('cc_prog_estado', 'Estado'),
      width: 130,
      cellRenderer: (p) => (
        <Chip size="small" label={PROGRAM_ESTADO_LABELS[p.value] || p.value || '-'} color={PROGRAM_ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    {
      field: 'proximo_conteo',
      headerName: t('cc_prog_proximo', 'Proximo Conteo'),
      width: 130,
      valueFormatter: (p) => formatDate(p.value),
    },
  ], [t]);

  const countColumnDefs = useMemo(() => [
    { field: 'id', headerName: 'ID', width: 80, type: 'numericColumn' },
    {
      field: 'tipo',
      headerName: t('cc_count_tipo', 'Tipo'),
      width: 140,
      cellRenderer: (p) => <Chip size="small" label={TIPO_LABELS[p.value] || p.value || '-'} variant="outlined" />,
    },
    { field: 'almacen_id', headerName: t('cc_count_almacen', 'Almacen'), width: 120 },
    {
      field: 'estado',
      headerName: t('cc_count_estado', 'Estado'),
      width: 140,
      cellRenderer: (p) => (
        <Chip size="small" label={COUNT_ESTADO_LABELS[p.value] || p.value || '-'} color={COUNT_ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    {
      field: 'fecha_planificada',
      headerName: t('cc_count_fecha', 'Fecha Planificada'),
      width: 140,
      valueFormatter: (p) => formatDate(p.value),
    },
    { field: 'asignado_a', headerName: t('cc_count_asignado', 'Asignado'), flex: 1, minWidth: 130 },
    { field: 'items_count', headerName: t('cc_count_items', 'Items'), width: 90, type: 'numericColumn' },
  ], [t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <InventoryIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('cc_title', 'Conteo Ciclico')}
          </Typography>
        </Stack>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('cc_kpi_accuracy', 'Accuracy Rate')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
              {kpis.accuracy_rate != null ? `${Number(kpis.accuracy_rate).toFixed(1)}%` : '-'}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('cc_kpi_pending', 'Conteos Pendientes')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {kpis.conteos_pendientes ?? 0}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('cc_kpi_variance', 'Varianza Total')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
              {kpis.varianza_total ?? 0}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('cc_kpi_adjustments', 'Ajustes Pendientes')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {kpis.ajustes_pendientes ?? 0}
            </Typography>
          </Paper>
        </Stack>
      )}

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={t('cc_tab_programs', 'Programas')} icon={<EventRepeatIcon />} iconPosition="start" />
          <Tab label={t('cc_tab_counts', 'Conteos')} icon={<PlaylistAddCheckIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Programs */}
      {tabValue === 0 && (
        <>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, flex: 1 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>{t('cc_filter_estado', 'Estado')}</InputLabel>
                  <Select
                    value={programFilters.estado}
                    label={t('cc_filter_estado', 'Estado')}
                    onChange={(e) => setProgramFilters((prev) => ({ ...prev, estado: e.target.value }))}
                  >
                    {PROGRAM_ESTADO_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Paper>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setProgramDialogOpen(true)}
              aria-label={t('cc_new_program', 'Nuevo Programa')}
              sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' } }}
            >
              {t('cc_new_program', 'Nuevo Programa')}
            </Button>
          </Stack>

          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            aria-label={t('cc_tab_programs', 'Programas')}
          >
            <SPMAgGrid
              columnDefs={programColumnDefs}
              rowData={programs}
              loading={programsLoading}
              height={480}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="conteo_ciclico_programas"
              emptyMessage={t('cc_empty_programs', 'No hay programas registrados')}
              getRowId={(params) => String(params.data.id)}
            />
          </Paper>
        </>
      )}

      {/* Tab 1: Counts */}
      {tabValue === 1 && (
        <>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, flex: 1 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>{t('cc_filter_estado', 'Estado')}</InputLabel>
                  <Select
                    value={countFilters.estado}
                    label={t('cc_filter_estado', 'Estado')}
                    onChange={(e) => setCountFilters((prev) => ({ ...prev, estado: e.target.value }))}
                  >
                    {COUNT_ESTADO_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label={t('cc_filter_almacen', 'Almacen')}
                  value={countFilters.almacen_id}
                  onChange={(e) => setCountFilters((prev) => ({ ...prev, almacen_id: e.target.value }))}
                  sx={{ minWidth: 140 }}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>{t('cc_filter_tipo', 'Tipo')}</InputLabel>
                  <Select
                    value={countFilters.tipo}
                    label={t('cc_filter_tipo', 'Tipo')}
                    onChange={(e) => setCountFilters((prev) => ({ ...prev, tipo: e.target.value }))}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    {TIPO_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Paper>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCountDialogOpen(true)}
              aria-label={t('cc_generate_count', 'Generar Conteo')}
              sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' } }}
            >
              {t('cc_generate_count', 'Generar Conteo')}
            </Button>
          </Stack>

          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            aria-label={t('cc_tab_counts', 'Conteos')}
          >
            <SPMAgGrid
              columnDefs={countColumnDefs}
              rowData={counts}
              loading={countsLoading}
              height={480}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              onRowClick={(row) => navigate(`/operations/cycle-count/${row.id}`)}
              exportFileName="conteo_ciclico_conteos"
              emptyMessage={t('cc_empty_counts', 'No hay conteos registrados')}
              getRowId={(params) => String(params.data.id)}
            />
          </Paper>
        </>
      )}

      {/* Create Program Dialog */}
      <Dialog open={programDialogOpen} onClose={() => setProgramDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <EventRepeatIcon color="primary" />
            <span>{t('cc_new_program', 'Nuevo Programa')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('cc_field_nombre', 'Nombre')}
              value={programForm.nombre}
              onChange={(e) => handleProgramFormChange('nombre', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <FormControl size="small" fullWidth>
              <InputLabel>{t('cc_field_tipo', 'Tipo')}</InputLabel>
              <Select
                value={programForm.tipo}
                label={t('cc_field_tipo', 'Tipo')}
                onChange={(e) => handleProgramFormChange('tipo', e.target.value)}
              >
                {TIPO_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('cc_field_almacen', 'Almacen ID')}
              value={programForm.almacen_id}
              onChange={(e) => handleProgramFormChange('almacen_id', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('cc_field_freq_a', 'Freq A (dias)')}
                type="number"
                value={programForm.freq_a_dias}
                onChange={(e) => handleProgramFormChange('freq_a_dias', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 1 }}
              />
              <TextField
                label={t('cc_field_freq_b', 'Freq B (dias)')}
                type="number"
                value={programForm.freq_b_dias}
                onChange={(e) => handleProgramFormChange('freq_b_dias', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 1 }}
              />
              <TextField
                label={t('cc_field_freq_c', 'Freq C (dias)')}
                type="number"
                value={programForm.freq_c_dias}
                onChange={(e) => handleProgramFormChange('freq_c_dias', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 1 }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setProgramDialogOpen(false)} disabled={programSubmitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateProgram}
            disabled={programSubmitting || !programForm.nombre.trim() || !programForm.almacen_id.trim()}
            startIcon={programSubmitting && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate Count Dialog */}
      <Dialog open={countDialogOpen} onClose={() => setCountDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <PlaylistAddCheckIcon color="primary" />
            <span>{t('cc_generate_count', 'Generar Conteo')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth required>
              <InputLabel>{t('cc_field_tipo', 'Tipo')}</InputLabel>
              <Select
                value={countForm.tipo}
                label={t('cc_field_tipo', 'Tipo')}
                onChange={(e) => handleCountFormChange('tipo', e.target.value)}
              >
                {TIPO_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('cc_field_almacen', 'Almacen ID')}
              value={countForm.almacen_id}
              onChange={(e) => handleCountFormChange('almacen_id', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('cc_field_programa', 'Programa ID (opcional)')}
              value={countForm.programa_id}
              onChange={(e) => handleCountFormChange('programa_id', e.target.value)}
              fullWidth
              size="small"
              helperText={t('cc_field_programa_help', 'Deje vacio para conteo independiente')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCountDialogOpen(false)} disabled={countSubmitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerateCount}
            disabled={countSubmitting || !countForm.tipo || !countForm.almacen_id.trim()}
            startIcon={countSubmitting && <CircularProgress size={16} />}
          >
            {t('cc_btn_generate', 'Generar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
