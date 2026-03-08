/**
 * DemandPlanDetail - Detail of a demand planning cycle
 *
 * Shows cycle header with status, tabs for entries and consensus data,
 * action buttons for ML baseline generation, consensus calculation,
 * and approval. Includes ForecastComparisonChart visualization.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventNoteIcon from '@mui/icons-material/EventNote';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CalculateIcon from '@mui/icons-material/Calculate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import ForecastComparisonChart from '../components/ForecastComparisonChart';

const ESTADO_COLORS = {
  draft: 'default',
  collecting: 'info',
  review: 'warning',
  consensus: 'secondary',
  approved: 'success',
  closed: 'default',
  cancelled: 'error',
};

const ESTADO_LABELS = {
  draft: 'Borrador',
  collecting: 'Recopilando',
  review: 'Revision',
  consensus: 'Consenso',
  approved: 'Aprobado',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
};

const STATUS_TRANSITIONS = [
  { value: 'collecting', label: 'Recopilando' },
  { value: 'review', label: 'Revision' },
  { value: 'consensus', label: 'Consenso' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'closed', label: 'Cerrado' },
];

const FUENTE_OPTIONS = [
  { value: 'sales', label: 'Ventas' },
  { value: 'operations', label: 'Operaciones' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'manual', label: 'Manual' },
];

const INITIAL_ENTRY = {
  material_codigo: '',
  fuente: 'manual',
  cantidad_pronosticada: '',
  confianza: '',
};

export default function DemandPlanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const [entries, setEntries] = useState([]);
  const [consensus, setConsensus] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // Entry dialog state
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryForm, setEntryForm] = useState(INITIAL_ENTRY);
  const [savingEntry, setSavingEntry] = useState(false);

  // Status dialog state
  const [statusOpen, setStatusOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/demand-planning/cycles/${id}`);
        if (cancelled) return;
        if (res.data?.ok) {
          const data = res.data;
          setCycle(data);
          const rawEntradas = data.entradas || [];
          const flat = [];
          for (const mat of rawEntradas) {
            for (const e of (mat.entradas || [])) {
              flat.push({
                material_codigo: mat.material_codigo,
                material_descripcion: mat.material_descripcion,
                fuente: e.fuente,
                cantidad_pronosticada: e.cantidad_pronosticada,
                usuario: e.usuario_nombre,
                notas: e.notas,
                created_at: e.created_at,
              });
            }
          }
          setEntries(flat);
          setConsensus(data.consensos || []);
        }
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('demand_error_detail', 'Error al cargar ciclo'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, reloadTick]);

  const handleAddEntry = useCallback(async () => {
    if (!entryForm.material_codigo || !entryForm.cantidad_pronosticada) {
      toastRef.current.warning(tRef.current('demand_entry_required', 'Complete material y cantidad'));
      return;
    }
    setSavingEntry(true);
    try {
      const res = await api.post(`/demand-planning/cycles/${id}/entries`, {
        material_codigo: entryForm.material_codigo,
        fuente: entryForm.fuente,
        cantidad_pronosticada: Number(entryForm.cantidad_pronosticada),
        confianza: entryForm.confianza ? Number(entryForm.confianza) : null,
      });
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('demand_entry_added', 'Entrada agregada'));
        setEntryOpen(false);
        setEntryForm(INITIAL_ENTRY);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('demand_error_entry', 'Error al agregar entrada'));
    } finally {
      setSavingEntry(false);
    }
  }, [id, entryForm]);

  const handleGenerateBaseline = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await api.post(`/demand-planning/cycles/${id}/baseline`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('demand_baseline_ok', 'Baseline ML generado'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('demand_error_baseline', 'Error al generar baseline'));
    } finally {
      setProcessing(false);
    }
  }, [id]);

  const handleCalculateConsensus = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await api.post(`/demand-planning/cycles/${id}/consensus`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('demand_consensus_ok', 'Consenso calculado'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('demand_error_consensus', 'Error al calcular consenso'));
    } finally {
      setProcessing(false);
    }
  }, [id]);

  const handleStatusChange = useCallback(async () => {
    if (!targetStatus) return;
    setProcessing(true);
    try {
      const res = await api.put(`/demand-planning/cycles/${id}/status`, { estado: targetStatus });
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('demand_status_updated', 'Estado actualizado'));
        setStatusOpen(false);
        setTargetStatus('');
        reload();
      }
    } catch (err) {
      setStatusOpen(false);
      setTargetStatus('');
      toastRef.current.error(err.response?.data?.error || tRef.current('demand_error_status', 'Error al cambiar estado'));
    } finally {
      setProcessing(false);
    }
  }, [id, targetStatus]);

  const entryColumns = useMemo(() => [
    { field: 'material_codigo', headerName: t('demand_material', 'Material'), width: 150 },
    { field: 'material_descripcion', headerName: t('demand_descripcion', 'Descripcion'), flex: 1, minWidth: 180 },
    { field: 'fuente', headerName: t('demand_fuente', 'Fuente'), width: 130,
      cellRenderer: (p) => <Chip size="small" label={FUENTE_OPTIONS.find(o => o.value === p.value)?.label || p.value} variant="outlined" />,
    },
    { field: 'cantidad_pronosticada', headerName: t('demand_cantidad', 'Cantidad'), width: 130, type: 'numericColumn' },
    { field: 'usuario', headerName: t('demand_usuario', 'Usuario'), width: 140 },
  ], [t]);

  const consensusColumns = useMemo(() => [
    { field: 'material_codigo', headerName: t('demand_material', 'Material'), width: 150 },
    { field: 'material_descripcion', headerName: t('demand_descripcion', 'Descripcion'), flex: 1, minWidth: 180 },
    { field: 'cantidad_consenso', headerName: t('demand_consenso', 'Consenso'), width: 130, type: 'numericColumn' },
    { field: 'aprobado_por_nombre', headerName: t('demand_aprobado_por', 'Aprobado por'), width: 140 },
  ], [t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
        <Skeleton variant="rectangular" height={40} width={300} />
        <Skeleton variant="rectangular" height={160} />
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  if (!cycle) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{t('demand_not_found', 'Ciclo no encontrado')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/planning/demand')} sx={{ mt: 2 }}>
          {t('common_volver', 'Volver')}
        </Button>
      </Box>
    );
  }

  const estado = cycle.estado || 'draft';

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
    <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Back */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/planning/demand')} color="inherit" sx={{ alignSelf: 'flex-start' }}>
        {t('common_volver', 'Volver')}
      </Button>

      {/* Header */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
              <EventNoteIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {cycle.nombre}
              </Typography>
              <Chip size="small" label={ESTADO_LABELS[estado] || estado} color={ESTADO_COLORS[estado] || 'default'} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t('demand_periodo', 'Periodo')}: {formatDate(cycle.periodo_desde)} - {formatDate(cycle.periodo_hasta)}
            </Typography>
          </Box>

          {/* Actions */}
          <Stack direction="row" gap={1} flexWrap="wrap">
            {(estado === 'draft' || estado === 'collecting') && (
              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setEntryOpen(true)}>
                {t('demand_add_entry', 'Agregar Entrada')}
              </Button>
            )}
            {(estado === 'collecting' || estado === 'review') && (
              <Button variant="outlined" size="small" color="info" startIcon={processing ? <CircularProgress size={16} /> : <SmartToyIcon />} onClick={handleGenerateBaseline} disabled={processing}>
                {t('demand_gen_baseline', 'Generar Baseline ML')}
              </Button>
            )}
            {(estado === 'review' || estado === 'consensus') && (
              <Button variant="outlined" size="small" color="warning" startIcon={processing ? <CircularProgress size={16} /> : <CalculateIcon />} onClick={handleCalculateConsensus} disabled={processing}>
                {t('demand_calc_consensus', 'Calcular Consenso')}
              </Button>
            )}
            {estado === 'consensus' && (
              <Button variant="contained" size="small" color="success" startIcon={processing ? <CircularProgress size={16} /> : <CheckCircleIcon />} onClick={() => { setTargetStatus('approved'); setStatusOpen(true); }} disabled={processing}>
                {t('demand_approve', 'Aprobar')}
              </Button>
            )}
            <Button variant="outlined" size="small" onClick={() => setStatusOpen(true)}>
              {t('demand_change_status', 'Cambiar Estado')}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Chart */}
      {entries.length > 0 && (
        <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>{t('demand_chart_title', 'Comparacion de Pronosticos por Fuente')}</Typography>
          <ForecastComparisonChart entries={entries} consensus={consensus} />
        </Paper>
      )}

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={(_, val) => setCurrentTab(val)} aria-label={t('demand_tabs', 'Secciones del ciclo')} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label={t('demand_tab_entries', 'Entradas')} />
          <Tab label={t('demand_tab_consensus', 'Consenso')} />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {currentTab === 0 && (
            <SPMAgGrid
              columnDefs={entryColumns}
              rowData={entries}
              loading={false}
              height={400}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="entradas_demanda"
              emptyMessage={t('demand_no_entries', 'Sin entradas registradas')}
            />
          )}
          {currentTab === 1 && (
            <SPMAgGrid
              columnDefs={consensusColumns}
              rowData={consensus}
              loading={false}
              height={400}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="consenso_demanda"
              emptyMessage={t('demand_no_consensus', 'Sin datos de consenso')}
            />
          )}
        </Box>
      </Paper>

      {/* Add Entry Dialog */}
      <Dialog open={entryOpen} onClose={() => setEntryOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('demand_add_entry', 'Agregar Entrada')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('demand_material', 'Codigo Material')}
              value={entryForm.material_codigo}
              onChange={(e) => setEntryForm(prev => ({ ...prev, material_codigo: e.target.value }))}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>{t('demand_fuente', 'Fuente')}</InputLabel>
              <Select value={entryForm.fuente} label={t('demand_fuente', 'Fuente')} onChange={(e) => setEntryForm(prev => ({ ...prev, fuente: e.target.value }))}>
                {FUENTE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label={t('demand_cantidad', 'Cantidad Pronosticada')}
              type="number"
              value={entryForm.cantidad_pronosticada}
              onChange={(e) => setEntryForm(prev => ({ ...prev, cantidad_pronosticada: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label={t('demand_confianza', 'Confianza (0-1)')}
              type="number"
              inputProps={{ min: 0, max: 1, step: 0.1 }}
              value={entryForm.confianza}
              onChange={(e) => setEntryForm(prev => ({ ...prev, confianza: e.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEntryOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleAddEntry} disabled={savingEntry} startIcon={savingEntry && <CircularProgress size={16} />}>
            {t('common_agregar', 'Agregar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusOpen} onClose={() => setStatusOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('demand_change_status', 'Cambiar Estado')}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>{t('demand_new_status', 'Nuevo Estado')}</InputLabel>
            <Select value={targetStatus} label={t('demand_new_status', 'Nuevo Estado')} onChange={(e) => setTargetStatus(e.target.value)}>
              {STATUS_TRANSITIONS.filter(s => s.value !== estado).map(s => (
                <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setStatusOpen(false); setTargetStatus(''); }}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleStatusChange} disabled={processing || !targetStatus} startIcon={processing && <CircularProgress size={16} />}>
            {t('common_confirmar', 'Confirmar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </Box>
  );
}
