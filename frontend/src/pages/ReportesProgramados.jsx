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
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DescriptionIcon from '@mui/icons-material/Description';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const TIPOS_REPORTE = [
  { value: 'solicitudes', label: 'Solicitudes' },
  { value: 'stock', label: 'Stock' },
  { value: 'presupuesto', label: 'Presupuesto' },
  { value: 'kpis', label: 'KPIs' },
  { value: 'materiales', label: 'Materiales' },
];

const FRECUENCIAS = [
  { value: 'manual', label: 'Manual' },
  { value: 'diario', label: 'Diario' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
];

const FORMATOS = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV (.csv)' },
];

const FRECUENCIA_COLORS = {
  manual: 'default',
  diario: 'info',
  semanal: 'primary',
  mensual: 'secondary',
};

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(null);

  const fetchReportes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/export/programados');
      if (response.data?.ok) {
        setReportes(response.data.reportes || []);
      }
    } catch (err) {
      toast.error('Error al cargar reportes programados');
    } finally {
      setLoading(false);
    }
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
      toast.warning('El nombre es requerido');
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
        toast.success('Reporte actualizado');
      } else {
        await api.post('/export/programados', payload);
        toast.success('Reporte creado');
      }

      handleCloseDialog();
      fetchReportes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }, [form, editingId, fetchReportes, handleCloseDialog]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('¿Eliminar este reporte programado?')) return;

    try {
      await api.delete(`/export/programados/${id}`);
      toast.success('Reporte eliminado');
      fetchReportes();
    } catch (err) {
      toast.error('Error al eliminar');
    }
  }, [fetchReportes]);

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
      toast.success('Reporte generado y descargado');
    } catch (err) {
      toast.error('Error al ejecutar reporte');
    } finally {
      setExecuting(null);
    }
  }, []);

  const columnDefs = [
    {
      field: 'nombre',
      headerName: 'Nombre',
      flex: 2,
      minWidth: 200,
    },
    {
      field: 'tipo',
      headerName: 'Tipo',
      flex: 1,
      cellRenderer: (params) => {
        const tipo = TIPOS_REPORTE.find(t => t.value === params.value);
        return tipo?.label || params.value;
      },
    },
    {
      field: 'frecuencia',
      headerName: 'Frecuencia',
      flex: 1,
      cellRenderer: (params) => params.value || 'manual',
    },
    {
      field: 'formato',
      headerName: 'Formato',
      width: 100,
      cellRenderer: (params) => (params.value || 'xlsx').toUpperCase(),
    },
    {
      field: 'activo',
      headerName: 'Estado',
      width: 100,
      cellRenderer: (params) => params.value ? 'Activo' : 'Inactivo',
    },
    {
      field: 'ultimo_envio',
      headerName: 'Último Envío',
      flex: 1,
      valueFormatter: (params) => {
        if (!params.value) return 'Nunca';
        return new Date(params.value).toLocaleString('es-AR');
      },
    },
    {
      headerName: 'Acciones',
      width: 160,
      sortable: false,
      filter: false,
      cellRenderer: (params) => (
        <Stack direction="row" spacing={0.5} sx={{ height: '100%', alignItems: 'center' }}>
          <IconButton
            size="small"
            onClick={() => handleExecute(params.data.id)}
            disabled={executing === params.data.id}
            title="Ejecutar ahora"
          >
            {executing === params.data.id ? (
              <CircularProgress size={16} />
            ) : (
              <PlayArrowIcon fontSize="small" color="success" />
            )}
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleOpenDialog(params.data)}
            title="Editar"
          >
            <EditIcon fontSize="small" color="primary" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.data.id)}
            title="Eliminar"
          >
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" gap={1}>
          <ScheduleIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('reportes_title', 'Reportes Programados')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          {t('reportes_crear', 'Crear Reporte')}
        </Button>
      </Stack>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={reportes}
          loading={loading}
          height={500}
          enableQuickFilter={true}
          exportFileName="reportes_programados"
          emptyMessage={t('reportes_empty', 'No hay reportes programados')}
        />
      </Paper>

      {/* Dialog Crear/Editar */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <DescriptionIcon color="primary" />
            <Typography variant="h6">
              {editingId ? 'Editar Reporte' : 'Nuevo Reporte Programado'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Nombre"
              value={form.nombre}
              onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
              fullWidth
              required
              autoFocus
            />
            <FormControl fullWidth>
              <InputLabel>Tipo de Reporte</InputLabel>
              <Select
                value={form.tipo}
                onChange={(e) => setForm(prev => ({ ...prev, tipo: e.target.value }))}
                label="Tipo de Reporte"
              >
                {TIPOS_REPORTE.map(t => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Frecuencia</InputLabel>
              <Select
                value={form.frecuencia}
                onChange={(e) => setForm(prev => ({ ...prev, frecuencia: e.target.value }))}
                label="Frecuencia"
              >
                {FRECUENCIAS.map(f => (
                  <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Formato</InputLabel>
              <Select
                value={form.formato}
                onChange={(e) => setForm(prev => ({ ...prev, formato: e.target.value }))}
                label="Formato"
              >
                {FORMATOS.map(f => (
                  <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Destinatarios (emails separados por coma)"
              value={form.destinatarios}
              onChange={(e) => setForm(prev => ({ ...prev, destinatarios: e.target.value }))}
              fullWidth
              helperText="Dejar vacío si solo se descarga manualmente"
              placeholder="usuario@empresa.com, otro@empresa.com"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.activo}
                  onChange={(e) => setForm(prev => ({ ...prev, activo: e.target.checked }))}
                />
              }
              label="Activo"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.nombre.trim()}
            startIcon={saving && <CircularProgress size={16} />}
          >
            {editingId ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
