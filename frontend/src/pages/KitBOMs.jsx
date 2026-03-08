/**
 * KitBOMs - Kit Bill of Materials management page
 *
 * Displays BOMs in AG-Grid with estado filter, row click navigates to detail,
 * and a dialog for creating new BOMs.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import AddIcon from '@mui/icons-material/Add';
import CategoryIcon from '@mui/icons-material/Category';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'activo', label: 'Activo' },
  { value: 'obsoleto', label: 'Obsoleto' },
];

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

const INITIAL_FORM = {
  kit_codigo: '',
  nombre: '',
  descripcion: '',
};

export default function KitBOMs() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ estado: '' });

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchBOMs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: 1, per_page: 200 };
      if (filters.estado) params.estado = filters.estado;
      const res = await api.get('/kitting/boms', { params });
      if (res.data?.ok) {
        setBoms(res.data.boms || res.data.items || []);
      }
    } catch {
      toast.error(t('kit_error_load', 'Error al cargar BOMs'));
    } finally {
      setLoading(false);
    }
  }, [filters, t, toast]);

  useEffect(() => { fetchBOMs(); }, [fetchBOMs]);

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!form.kit_codigo.trim() || !form.nombre.trim()) {
      toast.warning(t('kit_required', 'Complete codigo y nombre'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/kitting/boms', form);
      if (res.data?.ok) {
        toast.success(t('kit_created', 'BOM creada'));
        setDialogOpen(false);
        setForm(INITIAL_FORM);
        fetchBOMs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('kit_error_create', 'Error al crear BOM'));
    } finally {
      setSubmitting(false);
    }
  }, [form, t, toast, fetchBOMs]);

  const columnDefs = useMemo(() => [
    { field: 'kit_codigo', headerName: t('kit_col_codigo', 'Kit Codigo'), flex: 1, minWidth: 140 },
    { field: 'nombre', headerName: t('kit_col_nombre', 'Nombre'), flex: 2, minWidth: 200 },
    {
      field: 'estado',
      headerName: t('kit_col_estado', 'Estado'),
      width: 130,
      cellRenderer: (p) => (
        <Chip size="small" label={ESTADO_LABELS[p.value] || p.value || '-'} color={ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    { field: 'version', headerName: t('kit_col_version', 'Version'), width: 100, type: 'numericColumn' },
    { field: 'componentes_count', headerName: t('kit_col_componentes', 'Componentes'), width: 130, type: 'numericColumn' },
    { field: 'creado_por', headerName: t('kit_col_creado_por', 'Creado Por'), flex: 1, minWidth: 130 },
  ], [t]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <CategoryIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }} color="text.primary">
            {t('kit_title', 'Kit BOMs')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          aria-label={t('kit_new', 'Crear BOM')}
        >
          {t('kit_new', 'Crear BOM')}
        </Button>
      </Stack>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('kit_filter_estado', 'Estado')}</InputLabel>
            <Select
              value={filters.estado}
              label={t('kit_filter_estado', 'Estado')}
              onChange={(e) => setFilters((prev) => ({ ...prev, estado: e.target.value }))}
            >
              {ESTADO_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Data Table */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider' }}
        aria-label={t('kit_title', 'Kit BOMs')}
      >
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={boms}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={(row) => navigate(`/operations/kitting/boms/${row.id}`)}
          exportFileName="kit_boms"
          emptyMessage={t('kit_empty', 'No hay BOMs registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Create BOM Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <CategoryIcon color="primary" />
            <span>{t('kit_new', 'Crear BOM')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('kit_field_codigo', 'Kit Codigo')}
              value={form.kit_codigo}
              onChange={(e) => handleFormChange('kit_codigo', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('kit_field_nombre', 'Nombre')}
              value={form.nombre}
              onChange={(e) => handleFormChange('nombre', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('kit_field_descripcion', 'Descripcion')}
              value={form.descripcion}
              onChange={(e) => handleFormChange('descripcion', e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={submitting || !form.kit_codigo.trim() || !form.nombre.trim()}
            startIcon={submitting && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
