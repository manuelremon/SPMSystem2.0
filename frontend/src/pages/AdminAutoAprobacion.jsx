/**
 * AdminAutoAprobacion - Configuración de reglas de auto-aprobación
 *
 * Permite crear, editar y eliminar reglas que auto-aprueban solicitudes
 * que cumplen ciertos criterios predefinidos.
 */

import { useState, useEffect, useCallback } from 'react';
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
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import HistoryIcon from '@mui/icons-material/History';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import PageLayout from '../components/ui/PageLayout';
import { NewButton, ActiveStatus, RowActions, actionsColumn } from '../components/admin/AdminCrudParts';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const INITIAL_FORM = {
  nombre: '',
  descripcion: '',
  activo: true,
  centro_id: '',
  prioridad: 100,
  condiciones: {
    monto_max: 50000,
    materiales_conocidos_only: false,
    historial_solicitante_min: 5,
    criticidad_max: 'media',
  },
};

const CRITICIDAD_OPTIONS = [
  { value: 'baja', label: 'Baja', level: 1 },
  { value: 'media', label: 'Media', level: 2 },
  { value: 'alta', label: 'Alta', level: 3 },
  { value: 'critica', label: 'Crítica', level: 4 },
];

export default function AdminAutoAprobacion() {
  const { t } = useI18n();
  const toast = useToast();

  const [currentTab, setCurrentTab] = useState(0);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Simulation state
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);

  // Historial state
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/auto-approval-rules');
      if (response.data?.ok) {
        setRules(response.data.rules || []);
      }
    } catch (err) {
      toast.error(t('auto_approval_error_cargar', 'Error al cargar reglas'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistorial = useCallback(async () => {
    try {
      setLoadingHistorial(true);
      const response = await api.get('/admin/auto-approval/historial', {
        params: { limit: 100 },
      });
      if (response.data?.ok) {
        setHistorial(response.data.historial || []);
      }
    } catch (err) {
      toast.error(t('auto_approval_historial_error', 'Error al cargar historial'));
    } finally {
      setLoadingHistorial(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (currentTab === 1) {
      fetchHistorial();
    }
  }, [currentTab, fetchHistorial]);

  const handleOpenDialog = useCallback((rule = null) => {
    if (rule) {
      setEditingId(rule.id);
      const condiciones = typeof rule.condiciones_json === 'string'
        ? JSON.parse(rule.condiciones_json)
        : rule.condiciones || {};
      setForm({
        nombre: rule.nombre || '',
        descripcion: rule.descripcion || '',
        activo: rule.activo !== 0 && rule.activo !== false,
        centro_id: rule.centro_id || '',
        prioridad: rule.prioridad || 100,
        condiciones: {
          monto_max: condiciones.monto_max || 50000,
          materiales_conocidos_only: condiciones.materiales_conocidos_only || false,
          historial_solicitante_min: condiciones.historial_solicitante_min || 5,
          criticidad_max: condiciones.criticidad_max || 'media',
        },
      });
    } else {
      setEditingId(null);
      setForm(INITIAL_FORM);
    }
    setDialogOpen(true);
    setSimulationResult(null);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setSimulationResult(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.nombre.trim()) {
      toast.warning(t('auto_approval_nombre_requerido', 'El nombre es requerido'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        activo: form.activo ? 1 : 0,
        centro_id: form.centro_id || null,
        prioridad: form.prioridad,
        condiciones_json: JSON.stringify(form.condiciones),
      };

      if (editingId) {
        await api.put(`/admin/auto-approval-rules/${editingId}`, payload);
        toast.success(t('auto_approval_actualizada', 'Regla actualizada'));
      } else {
        await api.post('/admin/auto-approval-rules', payload);
        toast.success(t('auto_approval_creada', 'Regla creada'));
      }

      handleCloseDialog();
      fetchRules();
    } catch (err) {
      toast.error(err.response?.data?.error || t('auto_approval_error_guardar', 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  }, [form, editingId, fetchRules, handleCloseDialog]);

  const handleDelete = useCallback(async (id) => {
    setConfirmDeleteId(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.delete(`/admin/auto-approval-rules/${id}`);
      toast.success(t('auto_approval_eliminada', 'Regla eliminada'));
      fetchRules();
    } catch (err) {
      toast.error(t('auto_approval_error_eliminar', 'Error al eliminar'));
    }
  }, [confirmDeleteId, fetchRules, t]);

  const handleSimulate = useCallback(async () => {
    setSimulating(true);
    try {
      const response = await api.post('/admin/auto-approval-rules/simulate', {
        condiciones: form.condiciones,
        dias: 30,
      });

      if (response.data?.ok) {
        setSimulationResult(response.data);
      }
    } catch (err) {
      toast.error(t('auto_approval_error_simular', 'Error en simulación'));
    } finally {
      setSimulating(false);
    }
  }, [form.condiciones]);

  const columnDefs = [
    {
      field: 'nombre',
      headerName: t('admin_nombre', 'Nombre'),
      flex: 2,
      minWidth: 200,
    },
    {
      field: 'prioridad',
      headerName: t('auto_approval_prioridad', 'Prioridad'),
      width: 110,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
    },
    {
      field: 'centro_id',
      headerName: t('common_centro', 'Centro'),
      width: 120,
      valueFormatter: (params) => params.value || t('auto_approval_todos', 'Todos'),
    },
    {
      field: 'condiciones_json',
      headerName: t('auto_approval_monto_col', 'Monto máx.'),
      width: 140,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueGetter: (params) => {
        try {
          const c = typeof params.data.condiciones_json === 'string'
            ? JSON.parse(params.data.condiciones_json)
            : params.data.condiciones || {};
          return c.monto_max || 0;
        } catch { return 0; }
      },
      valueFormatter: (params) => formatCurrency(params.value || 0, 0),
    },
    {
      field: 'activo',
      headerName: t('common_estado', 'Estado'),
      width: 120,
      valueFormatter: (params) => (params.value ? t('auto_approval_activa', 'Activa') : t('auto_approval_inactiva', 'Inactiva')),
      cellRenderer: (params) => <ActiveStatus activo={!!params.value} />,
    },
    {
      field: 'created_at',
      headerName: t('auto_approval_creada_col', 'Creada'),
      flex: 1,
      valueFormatter: (params) => (params.value ? formatDate(params.value) : '—'),
    },
    actionsColumn(t('common_acciones', 'Acciones'), (params) => (
      <RowActions
        onEdit={() => handleOpenDialog(params.data)}
        onDelete={() => handleDelete(params.data.id)}
      />
    )),
  ];

  const historialColumnDefs = [
    {
      field: 'solicitud_id',
      headerName: t('auto_approval_historial_solicitud', 'Solicitud'),
      width: 110,
    },
    {
      field: 'fecha',
      headerName: t('auto_approval_historial_fecha', 'Fecha'),
      flex: 1,
      valueFormatter: (params) => (params.value ? formatDateTime(params.value) : '—'),
    },
    {
      field: 'regla_nombre',
      headerName: t('auto_approval_historial_regla', 'Regla aplicada'),
      flex: 2,
    },
    {
      field: 'confianza',
      headerName: t('auto_approval_historial_confianza', 'Confianza'),
      width: 120,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => {
        if (params.value == null) return '—';
        return `${(Number(params.value) * 100).toFixed(0)}%`;
      },
    },
    {
      field: 'solicitante',
      headerName: t('auto_approval_historial_solicitante', 'Solicitante'),
      flex: 2,
    },
    {
      field: 'monto_usd',
      headerName: t('auto_approval_historial_monto', 'Monto USD'),
      flex: 1,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => (params.value ? formatCurrency(params.value) : '—'),
    },
  ];

  return (
    <PageLayout
      title={t('auto_approval_title', 'Reglas de autoaprobación')}
      backTo="/admin"
      actions={currentTab === 0 ? (
        <NewButton onClick={() => handleOpenDialog()}>
          {t('auto_approval_create', 'Nueva regla')}
        </NewButton>
      ) : null}
    >
      <Alert severity="info">
        {currentTab === 0
          ? t('auto_approval_info', 'Las reglas de auto-aprobación permiten aprobar automáticamente solicitudes que cumplen todos los criterios configurados, sin intervención humana. Se evalúan por orden de prioridad (menor número = mayor prioridad).')
          : t('auto_approval_historial_info', 'Historial de solicitudes que fueron auto-aprobadas por reglas configuradas.')}
      </Alert>

      <Tabs
        value={currentTab}
        onChange={(_, val) => setCurrentTab(val)}
        aria-label={t("aria_auto_approval_tabs", "Pestañas de autoaprobación")}
        sx={{ borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', minHeight: 48 } }}
      >
        <Tab label={t('auto_approval_tab_reglas', 'Reglas')} icon={<AutoFixHighIcon />} iconPosition="start" />
        <Tab label={t('auto_approval_historial_tab', 'Historial')} icon={<HistoryIcon />} iconPosition="start" />
      </Tabs>

      {currentTab === 0 && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }} aria-label={t('auto_approval_title', 'Reglas de autoaprobación')}>
          <SPMAgGrid
            columnDefs={columnDefs}
            rowData={rules}
            loading={loading}
            height={450}
            enableQuickFilter={true}
            exportFileName="reglas_auto_aprobacion"
            emptyMessage={t('auto_approval_empty', 'No hay reglas configuradas')}
          />
        </Paper>
      )}

      {currentTab === 1 && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }} aria-label={t('auto_approval_historial_tab', 'Historial')}>
          <SPMAgGrid
            columnDefs={historialColumnDefs}
            rowData={historial}
            loading={loadingHistorial}
            height={450}
            enableQuickFilter={true}
            exportFileName="auto_aprobacion_historial"
            emptyMessage={t('auto_approval_historial_empty', 'No hay solicitudes auto-aprobadas registradas')}
          />
        </Paper>
      )}

      {/* Dialog Crear/Editar */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <AutoFixHighIcon color="primary" />
            <Typography variant="h6" component="span">
              {editingId ? t('auto_approval_edit', 'Editar regla') : t('auto_approval_new', 'Nueva regla de autoaprobación')}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label={t('auto_approval_nombre', 'Nombre de la regla')}
              value={form.nombre}
              onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
              fullWidth
              required
              autoFocus
              placeholder={t('auto_approval_nombre_placeholder', 'Ej.: Materiales conocidos de bajo costo')}
            />

            <TextField
              label={t('auto_approval_descripcion', 'Descripción')}
              value={form.descripcion}
              onChange={(e) => setForm(prev => ({ ...prev, descripcion: e.target.value }))}
              fullWidth
              multiline
              rows={2}
            />

            <TextField
              label={t('auto_approval_centro', 'Centro (vacío = todos)')}
              value={form.centro_id}
              onChange={(e) => setForm(prev => ({ ...prev, centro_id: e.target.value }))}
              fullWidth
              placeholder={t('auto_approval_centro_placeholder', 'Ej.: AA101')}
            />

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                {t('auto_approval_prioridad', 'Prioridad')}: {form.prioridad} ({t('auto_approval_prioridad_hint', 'menor = mayor prioridad')})
              </Typography>
              <Slider
                value={form.prioridad}
                onChange={(_, val) => setForm(prev => ({ ...prev, prioridad: val }))}
                min={1}
                max={200}
                step={1}
                aria-label={t('auto_approval_prioridad', 'Prioridad')}
                marks={[
                  { value: 1, label: '1 (alta)' },
                  { value: 100, label: '100' },
                  { value: 200, label: '200 (baja)' },
                ]}
              />
            </Box>

            <Divider>
              <Chip label={t('auto_approval_condiciones', 'Condiciones')} size="small" />
            </Divider>

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                {t('auto_approval_monto_max', 'Monto máximo')}: {formatCurrency(form.condiciones.monto_max, 0)}
              </Typography>
              <Slider
                value={form.condiciones.monto_max}
                onChange={(_, val) => setForm(prev => ({
                  ...prev,
                  condiciones: { ...prev.condiciones, monto_max: val },
                }))}
                min={1000}
                max={500000}
                step={1000}
                aria-label={t('auto_approval_monto_max', 'Monto máximo')}
                marks={[
                  { value: 1000, label: '1K' },
                  { value: 50000, label: '50K' },
                  { value: 200000, label: '200K' },
                  { value: 500000, label: '500K' },
                ]}
              />
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                {t('auto_approval_historial_min', 'Historial mínimo del solicitante')}: {form.condiciones.historial_solicitante_min} {t('auto_approval_historial_suffix', 'solicitudes aprobadas')}
              </Typography>
              <Slider
                value={form.condiciones.historial_solicitante_min}
                onChange={(_, val) => setForm(prev => ({
                  ...prev,
                  condiciones: { ...prev.condiciones, historial_solicitante_min: val },
                }))}
                min={0}
                max={50}
                step={1}
                aria-label={t('auto_approval_historial_min', 'Historial mínimo del solicitante')}
                marks={[
                  { value: 0, label: '0' },
                  { value: 5, label: '5' },
                  { value: 20, label: '20' },
                  { value: 50, label: '50' },
                ]}
              />
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                {t('auto_approval_criticidad_max', 'Criticidad máxima')}: {CRITICIDAD_OPTIONS.find(c => c.value === form.condiciones.criticidad_max)?.label}
              </Typography>
              <Stack direction="row" gap={1} flexWrap="wrap">
                {CRITICIDAD_OPTIONS.map(opt => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    onClick={() => setForm(prev => ({
                      ...prev,
                      condiciones: { ...prev.condiciones, criticidad_max: opt.value },
                    }))}
                    variant={form.condiciones.criticidad_max === opt.value ? 'filled' : 'outlined'}
                    color={form.condiciones.criticidad_max === opt.value ? 'primary' : 'default'}
                  />
                ))}
              </Stack>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={form.condiciones.materiales_conocidos_only}
                  onChange={(e) => setForm(prev => ({
                    ...prev,
                    condiciones: { ...prev.condiciones, materiales_conocidos_only: e.target.checked },
                  }))}
                />
              }
              label={t('auto_approval_materiales_conocidos', 'Solo materiales previamente solicitados')}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={form.activo}
                  onChange={(e) => setForm(prev => ({ ...prev, activo: e.target.checked }))}
                />
              }
              label={t('auto_approval_regla_activa', 'Regla activa')}
            />

            <Divider />

            {/* Simulación */}
            <Button
              variant="outlined"
              startIcon={simulating ? <CircularProgress size={16} /> : <PlayArrowIcon />}
              onClick={handleSimulate}
              disabled={simulating}
              fullWidth
              sx={{ textTransform: 'none' }}
            >
              {simulating ? t('auto_approval_simulando', 'Simulando...') : t('auto_approval_simular', 'Simular (últimos 30 días)')}
            </Button>

            {simulationResult && (
              <Alert
                severity={simulationResult.porcentaje > 50 ? 'warning' : 'success'}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t('auto_approval_resultado', 'Resultado de simulación:')}
                </Typography>
                <Typography variant="body2">
                  {t('auto_approval_resultado_msg', `${simulationResult.auto_aprobables} de ${simulationResult.total_solicitudes} solicitudes habrían sido auto-aprobadas (${simulationResult.porcentaje}%)`, { auto: simulationResult.auto_aprobables, total: simulationResult.total_solicitudes, pct: simulationResult.porcentaje })}
                </Typography>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} sx={{ textTransform: 'none' }}>{t('auto_approval_cancelar', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.nombre.trim()}
            startIcon={saving && <CircularProgress size={16} />}
            sx={{ textTransform: 'none' }}
          >
            {editingId ? t('auto_approval_guardar', 'Guardar') : t('auto_approval_crear_btn', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog for Delete */}
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} maxWidth="xs">
        <DialogTitle>{t('auto_approval_confirm_delete', '¿Eliminar esta regla de auto-aprobación?')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('auto_approval_confirm_delete_desc', 'Esta acción no se puede deshacer.')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)} sx={{ textTransform: 'none' }}>{t('auto_approval_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" color="error" onClick={confirmDelete} sx={{ textTransform: 'none' }}>{t('common_eliminar', 'Eliminar')}</Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
}
