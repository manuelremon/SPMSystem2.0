/**
 * KitBOMDetail - Kit BOM detail page with component management
 *
 * Shows BOM header (kit_codigo, nombre, estado, version), description,
 * AG-Grid of components with add/delete actions, and an activate button.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_COLORS = {
  draft: 'default',
  activo: 'success',
  obsoleto: 'error',
};

const ESTADO_LABELS = {
  draft: 'Borrador',
  activo: 'Activo',
  obsoleto: 'Obsoleto',
};

const INITIAL_COMPONENT_FORM = {
  secuencia: '',
  material_codigo: '',
  cantidad: '',
  unidad: 'UN',
  opcional: false,
  alternativa: '',
  notas: '',
};

export default function KitBOMDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();

  const [bom, setBom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Add component dialog
  const [compDialogOpen, setCompDialogOpen] = useState(false);
  const [compForm, setCompForm] = useState(INITIAL_COMPONENT_FORM);
  const [compSubmitting, setCompSubmitting] = useState(false);

  const fetchBOM = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/kitting/boms/${id}`);
      if (res.data?.ok) {
        setBom(res.data.bom || res.data);
      }
    } catch {
      toast.error(t('kit_error_detail', 'Error al cargar BOM'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { fetchBOM(); }, [fetchBOM]);

  const handleActivate = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await api.put(`/kitting/boms/${id}`, { estado: 'activo' });
      if (res.data?.ok) {
        toast.success(t('kit_activated', 'BOM activada'));
        fetchBOM();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('kit_error_activate', 'Error al activar BOM'));
    } finally {
      setProcessing(false);
    }
  }, [id, fetchBOM, t, toast]);

  // Add component
  const handleCompFormChange = useCallback((field, value) => {
    setCompForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAddComponent = useCallback(async () => {
    if (!compForm.material_codigo.trim() || !compForm.cantidad) {
      toast.warning(t('kit_comp_required', 'Complete material y cantidad'));
      return;
    }
    setCompSubmitting(true);
    try {
      const payload = {
        ...compForm,
        secuencia: compForm.secuencia ? parseInt(compForm.secuencia) : null,
        cantidad: parseFloat(compForm.cantidad),
      };
      const res = await api.post(`/kitting/boms/${id}/components`, payload);
      if (res.data?.ok) {
        toast.success(t('kit_comp_added', 'Componente agregado'));
        setCompDialogOpen(false);
        setCompForm(INITIAL_COMPONENT_FORM);
        fetchBOM();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('kit_error_add_comp', 'Error al agregar componente'));
    } finally {
      setCompSubmitting(false);
    }
  }, [id, compForm, fetchBOM, t, toast]);

  // Delete component
  const handleDeleteComponent = useCallback(async (compId) => {
    try {
      const res = await api.delete(`/kitting/boms/${id}/components/${compId}`);
      if (res.data?.ok) {
        toast.success(t('kit_comp_deleted', 'Componente eliminado'));
        fetchBOM();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('kit_error_delete_comp', 'Error al eliminar componente'));
    }
  }, [id, fetchBOM, t, toast]);

  const componentColumnDefs = useMemo(() => [
    { field: 'secuencia', headerName: t('kit_comp_seq', 'Seq'), width: 80, type: 'numericColumn' },
    { field: 'material_codigo', headerName: t('kit_comp_material', 'Material Codigo'), flex: 1, minWidth: 140 },
    { field: 'cantidad', headerName: t('kit_comp_cantidad', 'Cantidad'), width: 110, type: 'numericColumn' },
    { field: 'unidad', headerName: t('kit_comp_unidad', 'Unidad'), width: 90 },
    {
      field: 'es_opcional',
      headerName: t('kit_comp_opcional', 'Opcional'),
      width: 100,
      cellRenderer: (p) => (
        <Checkbox checked={!!p.value} disabled size="small" />
      ),
    },
    { field: 'alternativa_material', headerName: t('kit_comp_alternativa', 'Alternativa'), flex: 1, minWidth: 120 },
    { field: 'notas', headerName: t('kit_comp_notas', 'Notas'), flex: 1, minWidth: 140 },
    {
      headerName: '',
      width: 60,
      sortable: false,
      filter: false,
      cellRenderer: (p) => {
        const row = p.data;
        if (!row) return null;
        return (
          <Tooltip title={t('kit_comp_delete', 'Eliminar')}>
            <IconButton
              size="small"
              color="error"
              onClick={(e) => { e.stopPropagation(); handleDeleteComponent(row.id); }}
              aria-label={t('kit_comp_delete', 'Eliminar')}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      },
    },
  ], [t, handleDeleteComponent]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
        <Skeleton variant="rectangular" height={40} width={300} />
        <Skeleton variant="rectangular" height={180} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
    );
  }

  if (!bom) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{t('kit_not_found', 'BOM no encontrada')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/operations/kitting/boms')} sx={{ mt: 2 }}>
          {t('common_volver', 'Volver')}
        </Button>
      </Box>
    );
  }

  const estado = bom.estado || 'draft';
  const components = bom.componentes || bom.components || [];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
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
              <Typography
                variant="h5"
                component="h1"
                fontWeight={700}
                textTransform="uppercase"
                letterSpacing="0.05em"
                color="text.primary"
              >
                {bom.kit_codigo}
              </Typography>
              <Chip size="small" label={ESTADO_LABELS[estado] || estado} color={ESTADO_COLORS[estado] || 'default'} />
              {bom.version != null && (
                <Chip size="small" label={`v${bom.version}`} variant="outlined" />
              )}
            </Stack>
            <Typography variant="h6" sx={{ mb: 1 }}>{bom.nombre}</Typography>
            {bom.descripcion && (
              <Typography variant="body2" color="text.secondary">{bom.descripcion}</Typography>
            )}
          </Box>

          <Stack direction="row" gap={1} flexWrap="wrap">
            {estado === 'draft' && (
              <Button
                variant="contained"
                color="success"
                startIcon={processing ? <CircularProgress size={16} /> : <CheckCircleIcon />}
                onClick={handleActivate}
                disabled={processing}
              >
                {t('kit_btn_activate', 'Activar BOM')}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Components Section */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {t('kit_components_title', 'Componentes')} ({components.length})
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setCompDialogOpen(true)}
          size="small"
        >
          {t('kit_add_component', 'Agregar Componente')}
        </Button>
      </Stack>

      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider' }}
        aria-label={t('kit_components_title', 'Componentes')}
      >
        <SPMAgGrid
          columnDefs={componentColumnDefs}
          rowData={components}
          loading={false}
          height={400}
          pagination={false}
          enableQuickFilter={true}
          exportFileName="bom_componentes"
          emptyMessage={t('kit_no_components', 'Sin componentes registrados')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Add Component Dialog */}
      <Dialog open={compDialogOpen} onClose={() => setCompDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <AddIcon color="primary" />
            <span>{t('kit_add_component', 'Agregar Componente')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('kit_comp_field_seq', 'Secuencia')}
                type="number"
                value={compForm.secuencia}
                onChange={(e) => handleCompFormChange('secuencia', e.target.value)}
                sx={{ width: 120 }}
                size="small"
                inputProps={{ min: 1 }}
              />
              <TextField
                label={t('kit_comp_field_material', 'Material Codigo')}
                value={compForm.material_codigo}
                onChange={(e) => handleCompFormChange('material_codigo', e.target.value)}
                fullWidth
                required
                size="small"
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('kit_comp_field_cantidad', 'Cantidad')}
                type="number"
                value={compForm.cantidad}
                onChange={(e) => handleCompFormChange('cantidad', e.target.value)}
                fullWidth
                required
                size="small"
                inputProps={{ min: 0, step: 0.01 }}
              />
              <TextField
                label={t('kit_comp_field_unidad', 'Unidad')}
                value={compForm.unidad}
                onChange={(e) => handleCompFormChange('unidad', e.target.value)}
                sx={{ width: 120 }}
                size="small"
              />
            </Stack>
            <TextField
              label={t('kit_comp_field_alternativa', 'Alternativa')}
              value={compForm.alternativa}
              onChange={(e) => handleCompFormChange('alternativa', e.target.value)}
              fullWidth
              size="small"
              helperText={t('kit_comp_alt_help', 'Material alternativo (opcional)')}
            />
            <TextField
              label={t('kit_comp_field_notas', 'Notas')}
              value={compForm.notas}
              onChange={(e) => handleCompFormChange('notas', e.target.value)}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
            <Stack direction="row" alignItems="center" gap={1}>
              <Checkbox
                checked={compForm.opcional}
                onChange={(e) => handleCompFormChange('opcional', e.target.checked)}
                size="small"
              />
              <Typography variant="body2">{t('kit_comp_field_opcional', 'Componente opcional')}</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCompDialogOpen(false)} disabled={compSubmitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleAddComponent}
            disabled={compSubmitting || !compForm.material_codigo.trim() || !compForm.cantidad}
            startIcon={compSubmitting && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
