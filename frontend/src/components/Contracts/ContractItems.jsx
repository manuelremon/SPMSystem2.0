/**
 * ContractItems - Contract line items table with add/delete
 *
 * Displays items linked to a contract with progress bars for
 * consumed vs committed quantities. Supports adding and deleting items.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../../context/i18n';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { SPMAgGrid } from '../ui/SPMAgGrid';

export default function ContractItems({ contractId }) {
  const { t } = useI18n();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    material_codigo: '',
    material_descripcion: '',
    precio_unitario: '',
    unidad: 'UN',
    cantidad_comprometida: '',
    vigencia_desde: '',
    vigencia_hasta: '',
  });

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/contracts/${contractId}/items`);
      if (res.data?.ok) {
        setItems(res.data.items || []);
      }
    } catch {
      toast.error(t('contracts_items_error', 'Error al cargar items'));
    } finally {
      setLoading(false);
    }
  }, [contractId, t, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAdd = useCallback(async () => {
    if (!form.material_codigo.trim()) {
      toast.warning(t('contracts_items_material_required', 'El codigo de material es requerido'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        material_codigo: form.material_codigo.trim(),
        material_descripcion: form.material_descripcion.trim(),
        precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : 0,
        unidad: form.unidad.trim() || 'UN',
        cantidad_comprometida: form.cantidad_comprometida ? Number(form.cantidad_comprometida) : 0,
        vigencia_desde: form.vigencia_desde || null,
        vigencia_hasta: form.vigencia_hasta || null,
      };
      await api.post(`/contracts/${contractId}/items`, payload);
      toast.success(t('contracts_items_added', 'Item agregado'));
      setDialogOpen(false);
      setForm({ material_codigo: '', material_descripcion: '', precio_unitario: '', unidad: 'UN', cantidad_comprometida: '', vigencia_desde: '', vigencia_hasta: '' });
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.error || t('contracts_items_error_add', 'Error al agregar item'));
    } finally {
      setSaving(false);
    }
  }, [contractId, form, fetchItems, t, toast]);

  const handleDelete = useCallback(async (itemId) => {
    try {
      await api.delete(`/contracts/${contractId}/items/${itemId}`);
      toast.success(t('contracts_items_deleted', 'Item eliminado'));
      fetchItems();
    } catch {
      toast.error(t('contracts_items_error_delete', 'Error al eliminar item'));
    }
  }, [contractId, fetchItems, t, toast]);

  const columnDefs = useMemo(() => [
    { field: 'material_codigo', headerName: t('contracts_items_codigo', 'Codigo'), width: 130 },
    { field: 'material_descripcion', headerName: t('contracts_items_descripcion', 'Descripcion'), flex: 2, minWidth: 200 },
    {
      field: 'precio_unitario', headerName: t('contracts_items_precio', 'Precio Unit.'), width: 130,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    { field: 'unidad', headerName: t('contracts_items_unidad', 'Unidad'), width: 80 },
    { field: 'cantidad_comprometida', headerName: t('contracts_items_comprometida', 'Comprometida'), width: 120, type: 'numericColumn' },
    {
      field: 'cantidad_consumida', headerName: t('contracts_items_consumida', 'Consumida'), flex: 1, minWidth: 160,
      cellRenderer: (p) => {
        const comprometida = p.data?.cantidad_comprometida || 1;
        const consumida = p.data?.cantidad_consumida || 0;
        const pct = Math.min((consumida / comprometida) * 100, 100);
        return (
          <Stack direction="row" alignItems="center" gap={1} sx={{ width: '100%' }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress variant="determinate" value={pct} color={pct > 90 ? 'error' : pct > 70 ? 'warning' : 'primary'} sx={{ height: 8, borderRadius: 1 }} />
            </Box>
            <Typography variant="caption" sx={{ minWidth: 55, textAlign: 'right' }}>{consumida}/{comprometida}</Typography>
          </Stack>
        );
      },
    },
    {
      headerName: '', width: 60, sortable: false, filter: false,
      cellRenderer: (p) => (
        <IconButton size="small" onClick={() => handleDelete(p.data.id)} aria-label={t('common_eliminar', 'Eliminar')}>
          <DeleteIcon fontSize="small" color="error" />
        </IconButton>
      ),
    },
  ], [t, handleDelete]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t('contracts_tab_items', 'Items')} ({items.length})</Typography>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          {t('contracts_items_add', 'Agregar Item')}
        </Button>
      </Stack>

      <SPMAgGrid
        columnDefs={columnDefs}
        rowData={items}
        loading={loading}
        height={350}
        emptyMessage={t('contracts_items_empty', 'Sin items')}
        getRowId={(params) => String(params.data.id)}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('contracts_items_add', 'Agregar Item')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('contracts_items_codigo', 'Codigo Material')} value={form.material_codigo} onChange={(e) => setForm(prev => ({ ...prev, material_codigo: e.target.value }))} fullWidth required size="small" autoFocus />
            <TextField label={t('contracts_items_descripcion', 'Descripcion')} value={form.material_descripcion} onChange={(e) => setForm(prev => ({ ...prev, material_descripcion: e.target.value }))} fullWidth size="small" />
            <Stack direction="row" gap={2}>
              <TextField type="number" label={t('contracts_items_precio', 'Precio Unit.')} value={form.precio_unitario} onChange={(e) => setForm(prev => ({ ...prev, precio_unitario: e.target.value }))} fullWidth size="small" />
              <TextField label={t('contracts_items_unidad', 'Unidad')} value={form.unidad} onChange={(e) => setForm(prev => ({ ...prev, unidad: e.target.value }))} sx={{ maxWidth: 100 }} size="small" />
            </Stack>
            <TextField type="number" label={t('contracts_items_comprometida', 'Cantidad Comprometida')} value={form.cantidad_comprometida} onChange={(e) => setForm(prev => ({ ...prev, cantidad_comprometida: e.target.value }))} fullWidth size="small" />
            <Stack direction="row" gap={2}>
              <TextField type="date" label={t('contracts_items_vigencia_desde', 'Vigencia Desde')} value={form.vigencia_desde} onChange={(e) => setForm(prev => ({ ...prev, vigencia_desde: e.target.value }))} fullWidth size="small" InputLabelProps={{ shrink: true }} />
              <TextField type="date" label={t('contracts_items_vigencia_hasta', 'Vigencia Hasta')} value={form.vigencia_hasta} onChange={(e) => setForm(prev => ({ ...prev, vigencia_hasta: e.target.value }))} fullWidth size="small" InputLabelProps={{ shrink: true }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleAdd} disabled={saving} startIcon={saving && <CircularProgress size={16} />}>
            {t('contracts_items_save', 'Agregar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
