/**
 * WarehouseReceiving - Dock management and receiving page
 *
 * Displays warehouse docks as a visual board with KPI cards,
 * dock assignment dialog, and times registration.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import DockBoard from '../components/DockBoard';

export default function WarehouseReceiving() {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const [docks, setDocks] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDockId, setAssignDockId] = useState(null);
  const [recepcionId, setRecepcionId] = useState('');

  // Times dialog
  const [timesOpen, setTimesOpen] = useState(false);
  const [timesDockId, setTimesDockId] = useState(null);
  const [timesForm, setTimesForm] = useState({ hora_inicio_descarga: '', hora_fin_descarga: '' });

  // New dock dialog
  const [newDockOpen, setNewDockOpen] = useState(false);
  const [newDockForm, setNewDockForm] = useState({ numero_dock: '', almacen: '', capacidad_pallets: '' });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [docksRes, kpiRes] = await Promise.all([
          api.get('/warehouse/docks'),
          api.get('/warehouse/kpis'),
        ]);
        if (cancelled) return;
        if (docksRes.data?.ok) setDocks(docksRes.data.items || []);
        if (kpiRes.data?.ok) setKpis(kpiRes.data);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('warehouse_error_docks', 'Error al cargar docks'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [reloadTick]);

  const handleAssign = async () => {
    if (!recepcionId) {
      toastRef.current.warning(tRef.current('warehouse_recepcion_required', 'Ingrese ID de recepcion'));
      return;
    }
    setProcessing(true);
    try {
      const res = await api.post(`/warehouse/docks/${assignDockId}/assign/${recepcionId}`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('warehouse_assigned', 'Dock asignado'));
        setAssignOpen(false);
        setRecepcionId('');
        setAssignDockId(null);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('warehouse_error_assign', 'Error al asignar dock'));
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateTimes = async () => {
    setProcessing(true);
    try {
      const res = await api.put(`/warehouse/docks/${timesDockId}/times`, timesForm);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('warehouse_times_updated', 'Tiempos actualizados'));
        setTimesOpen(false);
        setTimesForm({ hora_inicio_descarga: '', hora_fin_descarga: '' });
        setTimesDockId(null);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('warehouse_error_times', 'Error al actualizar tiempos'));
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateDock = async () => {
    if (!newDockForm.numero_dock || !newDockForm.almacen) {
      toastRef.current.warning(tRef.current('warehouse_dock_required', 'Complete numero y almacen'));
      return;
    }
    setProcessing(true);
    try {
      const res = await api.post('/warehouse/docks', {
        ...newDockForm,
        capacidad_pallets: newDockForm.capacidad_pallets ? Number(newDockForm.capacidad_pallets) : null,
      });
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('warehouse_dock_created', 'Dock creado'));
        setNewDockOpen(false);
        setNewDockForm({ numero_dock: '', almacen: '', capacidad_pallets: '' });
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('warehouse_error_create_dock', 'Error al crear dock'));
    } finally {
      setProcessing(false);
    }
  };

  const handleDockAssign = useCallback((dock) => {
    setAssignDockId(dock.id);
    setAssignOpen(true);
  }, []);

  const handleDockUpdateTimes = useCallback((dock) => {
    setTimesDockId(dock.id);
    setTimesOpen(true);
  }, []);

  const KpiCard = ({ icon, label, value, color }) => (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', flex: 1, minWidth: 180 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
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
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" gap={1}>
          <WarehouseIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('warehouse_title', 'Recepcion en Almacen')}
          </Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewDockOpen(true)}>
          {t('warehouse_new_dock', 'Nuevo Dock')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <KpiCard
            icon={<CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />}
            label={t('warehouse_kpi_available', 'Docks Disponibles')}
            value={kpis.docks_disponibles}
            color="success.main"
          />
          <KpiCard
            icon={<BlockIcon fontSize="small" sx={{ color: 'error.main' }} />}
            label={t('warehouse_kpi_occupied', 'Docks Ocupados')}
            value={kpis.docks_ocupados}
            color="error.main"
          />
          <KpiCard
            icon={<LocalShippingIcon fontSize="small" sx={{ color: 'warning.main' }} />}
            label={t('warehouse_kpi_pending', 'Tareas Pendientes')}
            value={kpis.tareas_pendientes}
            color="warning.main"
          />
          <KpiCard
            icon={<AccessTimeIcon fontSize="small" sx={{ color: 'info.main' }} />}
            label={t('warehouse_kpi_avg_time', 'Tiempo Prom. Descarga (min)')}
            value={kpis.tiempo_promedio_descarga_min != null ? kpis.tiempo_promedio_descarga_min.toFixed(0) : null}
            color="info.main"
          />
        </Stack>
      )}

      {/* Dock Board */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>{t('warehouse_dock_board', 'Panel de Docks')}</Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <DockBoard
            docks={docks}
            onAssign={handleDockAssign}
            onUpdateTimes={handleDockUpdateTimes}
          />
        )}
      </Paper>

      {/* Assign Dialog */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('warehouse_assign_dock', 'Asignar Recepcion al Dock')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('warehouse_recepcion_id', 'ID de Recepcion')}
            type="number"
            value={recepcionId}
            onChange={(e) => setRecepcionId(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleAssign} disabled={processing} startIcon={processing && <CircularProgress size={16} />}>
            {t('common_asignar', 'Asignar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Times Dialog */}
      <Dialog open={timesOpen} onClose={() => setTimesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('warehouse_update_times', 'Registrar Tiempos de Descarga')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('warehouse_start_time', 'Inicio Descarga')}
              type="datetime-local"
              value={timesForm.hora_inicio_descarga}
              onChange={(e) => setTimesForm(prev => ({ ...prev, hora_inicio_descarga: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label={t('warehouse_end_time', 'Fin Descarga')}
              type="datetime-local"
              value={timesForm.hora_fin_descarga}
              onChange={(e) => setTimesForm(prev => ({ ...prev, hora_fin_descarga: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimesOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleUpdateTimes} disabled={processing} startIcon={processing && <CircularProgress size={16} />}>
            {t('common_guardar', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Dock Dialog */}
      <Dialog open={newDockOpen} onClose={() => setNewDockOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('warehouse_new_dock', 'Nuevo Dock')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('warehouse_dock_number', 'Numero de Dock')}
              value={newDockForm.numero_dock}
              onChange={(e) => setNewDockForm(prev => ({ ...prev, numero_dock: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label={t('warehouse_almacen', 'Almacen')}
              value={newDockForm.almacen}
              onChange={(e) => setNewDockForm(prev => ({ ...prev, almacen: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label={t('warehouse_capacity', 'Capacidad (Pallets)')}
              type="number"
              value={newDockForm.capacidad_pallets}
              onChange={(e) => setNewDockForm(prev => ({ ...prev, capacidad_pallets: e.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDockOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleCreateDock} disabled={processing} startIcon={processing && <CircularProgress size={16} />}>
            {t('common_crear', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
