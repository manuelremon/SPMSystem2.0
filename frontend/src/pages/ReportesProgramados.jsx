/**
 * ReportesProgramados - CRUD de reportes programados
 *
 * Permite crear, editar, eliminar y ejecutar reportes programados.
 * Los reportes se generan automáticamente según su frecuencia.
 */

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import EmailIcon from '@mui/icons-material/Email';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import PageLayout from '../components/ui/PageLayout';
import EmptyState from '../components/ui/EmptyState';
import { formatDateTime } from '../utils/formatters';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const TIPOS_REPORTE = [
  { value: 'solicitudes', key: 'reportes_tipo_solicitudes', label: 'Solicitudes' },
  { value: 'stock', key: 'reportes_tipo_stock', label: 'Stock' },
  { value: 'presupuesto', key: 'reportes_tipo_presupuesto', label: 'Presupuesto' },
  { value: 'kpis', key: 'reportes_tipo_kpis', label: 'Indicadores (KPI)' },
  { value: 'materiales', key: 'reportes_tipo_materiales', label: 'Materiales' },
];

const FRECUENCIAS = [
  { value: 'manual', key: 'reportes_frec_manual', label: 'Manual' },
  { value: 'diario', key: 'reportes_frec_diario', label: 'Diario' },
  { value: 'semanal', key: 'reportes_frec_semanal', label: 'Semanal' },
  { value: 'mensual', key: 'reportes_frec_mensual', label: 'Mensual' },
];

const FORMATOS = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV (.csv)' },
];

const INITIAL_FORM = {
  nombre: '',
  tipo: 'solicitudes',
  frecuencia: 'manual',
  formato: 'xlsx',
  activo: true,
  destinatarios: '',
  filtros: {},
};

export default function ReportesProgramados() {
  const { t } = useI18n();
  const toast = useToast();

  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(null);

  const fetchReportes = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const response = await api.get('/export/programados');
      if (response.data?.ok) {
        setReportes(response.data.reportes || []);
      }
    } catch (err) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchReportes();
  }, [fetchReportes]);

  const handleOpenDialog = useCallback((reporte = null) => {
    if (reporte) {
      setEditingId(reporte.id);
      setForm({
        nombre: reporte.nombre || '',
        tipo: reporte.tipo || 'solicitudes',
        frecuencia: reporte.frecuencia || 'manual',
        formato: reporte.formato || 'xlsx',
        activo: reporte.activo !== 0 && reporte.activo !== false,
        destinatarios: Array.isArray(reporte.destinatarios)
          ? reporte.destinatarios.join(', ')
          : reporte.destinatarios || '',
        filtros: reporte.filtros || {},
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
    if (!form.nombre.trim()) {
      toast.warning(t('reportes_nombre_requerido', 'El nombre es requerido'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        frecuencia: form.frecuencia,
        formato: form.formato,
        activo: form.activo ? 1 : 0,
        destinatarios_json: JSON.stringify(
          form.destinatarios.split(',').map(e => e.trim()).filter(Boolean)
        ),
        filtros_json: JSON.stringify(form.filtros),
      };

      if (editingId) {
        await api.put(`/export/programados/${editingId}`, payload);
        toast.success(t('reportes_actualizado', 'Reporte actualizado'));
      } else {
        await api.post('/export/programados', payload);
        toast.success(t('reportes_creado', 'Reporte creado'));
      }

      handleCloseDialog();
      fetchReportes();
    } catch (err) {
      toast.error(err.response?.data?.error || t('reportes_error_guardar', 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  }, [form, editingId, fetchReportes, handleCloseDialog, t, toast]);

  const handleDelete = useCallback(async (id) => {
    setConfirmDeleteId(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.delete(`/export/programados/${id}`);
      toast.success(t('reportes_eliminado', 'Reporte eliminado'));
      fetchReportes();
    } catch (err) {
      toast.error(t('reportes_error_eliminar', 'Error al eliminar'));
    }
  }, [confirmDeleteId, fetchReportes, t, toast]);

  const handleExecute = useCallback(async (id) => {
    setExecuting(id);
    try {
      const response = await api.post(`/export/programados/${id}/ejecutar`, {}, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `reporte_${id}.xlsx`;

      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(t('reportes_generado', 'Reporte generado y descargado'));
    } catch (err) {
      toast.error(t('reportes_error_ejecutar', 'Error al ejecutar reporte'));
    } finally {
      setExecuting(null);
    }
  }, [t, toast]);

  const handleSendEmail = useCallback(async (id) => {
    setSendingEmail(id);
    try {
      const response = await api.post(`/export/programados/${id}/enviar`);
      if (response.data?.ok) {
        const { enviados_count, destinatarios_count, errores } = response.data.data;
        if (errores && errores.length > 0) {
          toast.warning(
            t('reportes_email_parcial', `Enviado a ${enviados_count}/${destinatarios_count} destinatarios. ${errores.length} errores.`)
          );
        } else {
          toast.success(
            t('reportes_email_enviado', `Reporte enviado a ${enviados_count} destinatario(s)`)
          );
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.response?.data?.error || t('reportes_error_email', 'Error al enviar por correo');
      toast.error(errorMsg);
    } finally {
      setSendingEmail(null);
    }
  }, [t, toast]);

  const columnDefs = [
    {
      field: 'nombre',
      headerName: t('reportes_nombre', 'Nombre'),
      flex: 2,
      minWidth: 200,
    },
    {
      field: 'tipo',
      headerName: t('reportes_tipo', 'Tipo'),
      flex: 1,
      cellRenderer: (params) => {
        const tipo = TIPOS_REPORTE.find(tr => tr.value === params.value);
        return tipo ? t(tipo.key, tipo.label) : params.value;
      },
    },
    {
      field: 'frecuencia',
      headerName: t('reportes_frecuencia', 'Frecuencia'),
      flex: 1,
      cellRenderer: (params) => {
        const frec = FRECUENCIAS.find(f => f.value === (params.value || 'manual'));
        return frec ? t(frec.key, frec.label) : params.value;
      },
    },
    {
      field: 'formato',
      headerName: t('reportes_formato', 'Formato'),
      width: 100,
      cellRenderer: (params) => (params.value || 'xlsx').toUpperCase(),
    },
    {
      field: 'activo',
      headerName: t('reportes_estado', 'Estado'),
      width: 100,
      cellRenderer: (params) => params.value ? t('reportes_activo', 'Activo') : t('reportes_inactivo', 'Inactivo'),
    },
    {
      field: 'ultimo_envio',
      headerName: t('reportes_ultimo_envio', 'Último envío'),
      flex: 1,
      valueFormatter: (params) => {
        if (!params.value) return t('reportes_nunca', 'Nunca');
        return formatDateTime(params.value);
      },
    },
    {
      headerName: t('reportes_acciones', 'Acciones'),
      width: 200,
      sortable: false,
      filter: false,
      cellRenderer: (params) => (
        <Stack direction="row" spacing={0.5} sx={{ height: '100%', alignItems: 'center' }}>
          <Tooltip describeChild title={t('reportes_ejecutar', 'Ejecutar ahora')}>
            <span>
              <IconButton
                size="small"
                onClick={() => handleExecute(params.data.id)}
                disabled={executing === params.data.id}
                aria-label={t('reportes_ejecutar', 'Ejecutar ahora')}
              >
                {executing === params.data.id ? (
                  <CircularProgress size={16} />
                ) : (
                  <PlayArrowIcon fontSize="small" color="success" />
                )}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip describeChild title={t('reportes_enviar_email', 'Enviar por correo')}>
            <span>
              <IconButton
                size="small"
                onClick={() => handleSendEmail(params.data.id)}
                disabled={sendingEmail === params.data.id}
                aria-label={t('reportes_enviar_email', 'Enviar por correo')}
              >
                {sendingEmail === params.data.id ? (
                  <CircularProgress size={16} />
                ) : (
                  <EmailIcon fontSize="small" color="info" />
                )}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('reportes_editar_btn', 'Editar')}>
            <IconButton
              size="small"
              onClick={() => handleOpenDialog(params.data)}
              aria-label={t('reportes_editar_btn', 'Editar')}
            >
              <EditIcon fontSize="small" color="primary" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('reportes_eliminar_btn', 'Eliminar')}>
            <IconButton
              size="small"
              onClick={() => handleDelete(params.data.id)}
              aria-label={t('reportes_eliminar_btn', 'Eliminar')}
            >
              <DeleteIcon fontSize="small" color="error" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <PageLayout
      title={t('reportes_title', 'Reportes programados')}
      actions={
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ textTransform: 'none' }}
        >
          {t('reportes_crear', 'Nuevo reporte')}
        </Button>
      }
    >
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }} aria-label={t('reportes_title', 'Reportes programados')}>
        {loadError ? (
          <EmptyState
            title={t('reportes_error_cargar', 'Error al cargar reportes programados')}
            description={t('common_error_carga_desc', 'No pudimos obtener los datos. Intenta nuevamente en unos minutos.')}
            action={t('common_reintentar', 'Reintentar')}
            onAction={fetchReportes}
          />
        ) : (
          <SPMAgGrid
            columnDefs={columnDefs}
            rowData={reportes}
            loading={loading}
            height={500}
            enableQuickFilter={true}
            exportFileName="reportes_programados"
            emptyMessage={t('reportes_empty', 'No hay reportes programados')}
          />
        )}
      </Paper>

      {/* Dialog Crear/Editar */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <DescriptionIcon color="primary" />
            <Typography variant="h6">
              {editingId ? t('reportes_editar', 'Editar reporte') : t('reportes_nuevo', 'Nuevo reporte programado')}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label={t('reportes_nombre', 'Nombre')}
              value={form.nombre}
              onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
              fullWidth
              required
              autoFocus
            />
            <FormControl fullWidth>
              <InputLabel>{t('reportes_tipo_reporte', 'Tipo de reporte')}</InputLabel>
              <Select
                value={form.tipo}
                onChange={(e) => setForm(prev => ({ ...prev, tipo: e.target.value }))}
                label={t('reportes_tipo_reporte', 'Tipo de reporte')}
              >
                {TIPOS_REPORTE.map(tr => (
                  <MenuItem key={tr.value} value={tr.value}>{t(tr.key, tr.label)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>{t('reportes_frecuencia', 'Frecuencia')}</InputLabel>
              <Select
                value={form.frecuencia}
                onChange={(e) => setForm(prev => ({ ...prev, frecuencia: e.target.value }))}
                label={t('reportes_frecuencia', 'Frecuencia')}
              >
                {FRECUENCIAS.map(f => (
                  <MenuItem key={f.value} value={f.value}>{t(f.key, f.label)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>{t('reportes_formato', 'Formato')}</InputLabel>
              <Select
                value={form.formato}
                onChange={(e) => setForm(prev => ({ ...prev, formato: e.target.value }))}
                label={t('reportes_formato', 'Formato')}
              >
                {FORMATOS.map(f => (
                  <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('reportes_destinatarios', 'Destinatarios (correos separados por coma)')}
              value={form.destinatarios}
              onChange={(e) => setForm(prev => ({ ...prev, destinatarios: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              helperText={t('reportes_destinatarios_hint', 'Déjalo vacío si solo lo descargas manualmente')}
              placeholder="usuario@empresa.com, otro@empresa.com"
            />
            {form.destinatarios && form.destinatarios.trim() && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: -1 }}>
                {form.destinatarios.split(',').map((email, idx) => {
                  const trimmed = email.trim();
                  if (!trimmed) return null;
                  return (
                    <Chip
                      key={idx}
                      label={trimmed}
                      size="small"
                      color="primary"
                      variant="outlined"
                      icon={<EmailIcon fontSize="small" />}
                    />
                  );
                })}
              </Box>
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={form.activo}
                  onChange={(e) => setForm(prev => ({ ...prev, activo: e.target.checked }))}
                />
              }
              label={t('reportes_activo', 'Activo')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog}>{t('reportes_cancelar', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.nombre.trim()}
            startIcon={saving && <CircularProgress size={16} />}
          >
            {editingId ? t('reportes_guardar', 'Guardar') : t('reportes_crear', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Confirmar Eliminación */}
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} maxWidth="xs">
        <DialogTitle>{t('reportes_confirm_delete', '¿Eliminar este reporte programado?')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('reportes_confirm_delete_desc', 'Esta acción no se puede deshacer.')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>{t('reportes_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>{t('common_eliminar', 'Eliminar')}</Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
}
