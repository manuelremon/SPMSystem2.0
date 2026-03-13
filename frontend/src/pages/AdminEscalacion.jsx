import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EscalatorWarningIcon from '@mui/icons-material/EscalatorWarning';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const CRITICIDAD_OPTIONS = ['baja', 'media', 'alta', 'critica'];
const ROLE_OPTIONS = ['admin', 'coordinador', 'jefe'];

const INITIAL_FORM = {
  centro: '',
  criticidad: 'media',
  timeout_dias: 3,
  escalate_to_role: 'admin',
  activo: true,
};

export default function AdminEscalacion() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/escalation-rules');
      if (res.data?.ok) {
        setRules(res.data.rules || []);
      }
    } catch {
      toast.error(t('escalation_error_load', 'Error al cargar reglas de escalado'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleOpenDialog = useCallback((rule = null) => {
    if (rule) {
      setEditingId(rule.id);
      setForm({
        centro: rule.centro || '',
        criticidad: rule.criticidad || 'media',
        timeout_dias: rule.timeout_dias || 3,
        escalate_to_role: rule.escalate_to_role || 'admin',
        activo: rule.activo !== 0 && rule.activo !== false,
      });
    } else {
      setEditingId(null);
      setForm(INITIAL_FORM);
    }
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        centro: form.centro || null,
        criticidad: form.criticidad,
        timeout_dias: form.timeout_dias,
        escalate_to_role: form.escalate_to_role,
        activo: form.activo ? 1 : 0,
      };

      if (editingId) {
        await api.put(`/admin/escalation-rules/${editingId}`, payload);
        toast.success(t('escalation_updated', 'Regla actualizada'));
      } else {
        await api.post('/admin/escalation-rules', payload);
        toast.success(t('escalation_created', 'Regla creada'));
      }

      handleCloseDialog();
      fetchRules();
    } catch (err) {
      toast.error(err.response?.data?.error || t('escalation_error_save', 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  }, [form, editingId, fetchRules, handleCloseDialog, t]);

  const handleDelete = useCallback((id) => {
    setConfirmDeleteId(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.delete(`/admin/escalation-rules/${id}`);
      toast.success(t('escalation_deleted', 'Regla eliminada'));
      fetchRules();
    } catch {
      toast.error(t('escalation_error_delete', 'Error al eliminar'));
    }
  }, [confirmDeleteId, fetchRules, t]);

  const columnDefs = [
    {
      field: 'centro',
      headerName: t('common_centro', 'Centro'),
      width: 120,
      valueFormatter: (p) => p.value || t('auto_approval_todos', 'Todos'),
    },
    {
      field: 'criticidad',
      headerName: t('criticidad_label', 'Criticidad'),
      width: 120,
    },
    {
      field: 'timeout_dias',
      headerName: t('escalation_timeout', 'Timeout (días)'),
      width: 130,
      type: 'numericColumn',
    },
    {
      field: 'escalate_to_role',
      headerName: t('escalation_role', 'Escalar a'),
      width: 130,
    },
    {
      field: 'activo',
      headerName: t('common_estado', 'Estado'),
      width: 100,
      cellRenderer: (p) => p.value ? t('auto_approval_activa', 'Activa') : t('auto_approval_inactiva', 'Inactiva'),
    },
    {
      headerName: t('common_acciones', 'Acciones'),
      width: 120,
      sortable: false,
      filter: false,
      cellRenderer: (p) => (
        <Stack direction="row" spacing={0.5} sx={{ height: '100%', alignItems: 'center' }}>
          <IconButton size="small" onClick={() => handleOpenDialog(p.data)} aria-label={t('admin_editar', 'Editar')}>
            <EditIcon fontSize="small" color="primary" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDelete(p.data.id)} aria-label={t('admin_eliminar', 'Eliminar')}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
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
            {t('escalation_title', 'Escalado de Aprobaciones')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          {t('escalation_new', 'Nueva Regla')}
        </Button>
      </Stack>

      <Alert severity="info">
        {t('escalation_info', 'Configura reglas de escalado para solicitudes que excedan el tiempo de aprobación. Cuando una solicitud supera el timeout, se notifica al rol indicado.')}
      </Alert>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }} aria-label={t('escalation_title', 'Escalado de Aprobaciones')}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={rules}
          loading={loading}
          height={400}
          enableQuickFilter={true}
          exportFileName="reglas_escalacion"
          emptyMessage={t('escalation_empty', 'No hay reglas de escalado configuradas')}
        />
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <EscalatorWarningIcon color="primary" />
            <Typography variant="h6">
              {editingId ? t('escalation_edit', 'Editar Regla') : t('escalation_new_dialog', 'Nueva Regla de Escalado')}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label={t('escalation_centro', 'Centro (vacío = todos)')}
              value={form.centro}
              onChange={(e) => setForm(prev => ({ ...prev, centro: e.target.value }))}
              fullWidth
              placeholder="Ej: AA101"
            />
            <FormControl fullWidth>
              <InputLabel>{t('criticidad_label', 'Criticidad')}</InputLabel>
              <Select
                value={form.criticidad}
                onChange={(e) => setForm(prev => ({ ...prev, criticidad: e.target.value }))}
                label={t('criticidad_label', 'Criticidad')}
              >
                {CRITICIDAD_OPTIONS.map(c => (
                  <MenuItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                {t('escalation_timeout', 'Timeout')}: {form.timeout_dias} {t('common_dias', 'días')}
              </Typography>
              <Slider
                value={form.timeout_dias}
                onChange={(_, val) => setForm(prev => ({ ...prev, timeout_dias: val }))}
                min={1}
                max={30}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 7, label: '7' },
                  { value: 14, label: '14' },
                  { value: 30, label: '30' },
                ]}
                aria-label={t('escalation_timeout', 'Timeout')}
              />
            </Box>
            <FormControl fullWidth>
              <InputLabel>{t('escalation_role', 'Escalar a')}</InputLabel>
              <Select
                value={form.escalate_to_role}
                onChange={(e) => setForm(prev => ({ ...prev, escalate_to_role: e.target.value }))}
                label={t('escalation_role', 'Escalar a')}
              >
                {ROLE_OPTIONS.map(r => (
                  <MenuItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={form.activo}
                  onChange={(e) => setForm(prev => ({ ...prev, activo: e.target.checked }))}
                />
              }
              label={t('auto_approval_regla_activa', 'Regla activa')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving && <CircularProgress size={16} />}
          >
            {editingId ? t('common_guardar', 'Guardar') : t('admin_crear', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} maxWidth="xs">
        <DialogTitle>{t('escalation_confirm_delete', '¿Eliminar esta regla de escalado?')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('auto_approval_confirm_delete_desc', 'Esta acción no se puede deshacer.')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>{t('common_eliminar', 'Eliminar')}</Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
