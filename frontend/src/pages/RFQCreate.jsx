/**
 * RFQCreate - Formulario para crear nueva RFQ
 *
 * Permite definir titulo, descripcion, fecha cierre, items (materiales)
 * y proveedores invitados. Envía POST /api/rfq.
 * Sprint 57
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const EMPTY_ITEM = {
  material_codigo: '',
  descripcion: '',
  cantidad: '',
  unidad: 'UN',
  especificaciones: '',
};

const EMPTY_PROVEEDOR = {
  cuit: '',
  nombre: '',
};

export default function RFQCreate() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    fecha_cierre_ofertas: '',
  });
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [proveedores, setProveedores] = useState([{ ...EMPTY_PROVEEDOR }]);
  const [saving, setSaving] = useState(false);

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleItemChange = useCallback((index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }, []);

  const removeItem = useCallback((index) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleProveedorChange = useCallback((index, field, value) => {
    setProveedores((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }, []);

  const addProveedor = useCallback(() => {
    setProveedores((prev) => [...prev, { ...EMPTY_PROVEEDOR }]);
  }, []);

  const removeProveedor = useCallback((index) => {
    setProveedores((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.titulo.trim()) {
      toast.warning(t('rfq_titulo_requerido', 'El titulo es requerido'));
      return;
    }

    const validItems = items.filter((it) => it.material_codigo.trim() || it.descripcion.trim());
    if (validItems.length === 0) {
      toast.warning(t('rfq_items_requeridos', 'Agregue al menos un item'));
      return;
    }

    for (const it of validItems) {
      if (!it.cantidad || Number(it.cantidad) <= 0) {
        toast.warning(t('rfq_cantidad_invalida', 'Todos los items deben tener cantidad mayor a 0'));
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        fecha_cierre_ofertas: form.fecha_cierre_ofertas || null,
        items: validItems.map((it) => ({
          material_codigo: it.material_codigo.trim(),
          descripcion: it.descripcion.trim(),
          cantidad: Number(it.cantidad),
          unidad: it.unidad.trim() || 'UN',
          especificaciones: it.especificaciones.trim(),
        })),
        proveedores: proveedores
          .filter((p) => p.cuit.trim() || p.nombre.trim())
          .map((p) => ({
            cuit: p.cuit.trim(),
            nombre: p.nombre.trim(),
          })),
      };

      const res = await api.post('/rfq', payload);
      if (res.data?.ok) {
        toast.success(t('rfq_creada', 'RFQ creada exitosamente'));
        navigate(`/procurement/rfq/${res.data.rfq_id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('rfq_error_crear', 'Error al crear RFQ'));
    } finally {
      setSaving(false);
    }
  }, [form, items, proveedores, navigate, t, toast]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 960, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1}>
        <IconButton onClick={() => navigate('/procurement/rfq')} aria-label={t('common_volver', 'Volver')}>
          <ArrowBackIcon />
        </IconButton>
        <ReceiptLongIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {t('rfq_crear_titulo', 'Crear Nueva RFQ')}
        </Typography>
      </Stack>

      {/* Form fields */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={2.5}>
          <TextField
            label={t('rfq_titulo', 'Titulo')}
            value={form.titulo}
            onChange={(e) => handleFormChange('titulo', e.target.value)}
            fullWidth
            required
            autoFocus
          />
          <TextField
            label={t('rfq_descripcion', 'Descripcion')}
            value={form.descripcion}
            onChange={(e) => handleFormChange('descripcion', e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
          <TextField
            label={t('rfq_fecha_cierre', 'Fecha Cierre de Ofertas')}
            type="date"
            value={form.fecha_cierre_ofertas}
            onChange={(e) => handleFormChange('fecha_cierre_ofertas', e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Stack>
      </Paper>

      {/* Items */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t('rfq_items', 'Items Solicitados')}
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addItem}>
            {t('rfq_agregar_item', 'Agregar Item')}
          </Button>
        </Stack>
        <TableContainer>
          <Table size="small" aria-label={t('rfq_items', 'Items Solicitados')}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t('rfq_material_codigo', 'Codigo Material')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('rfq_item_descripcion', 'Descripcion')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} width={100}>{t('rfq_cantidad', 'Cantidad')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} width={80}>{t('rfq_unidad', 'Unidad')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('rfq_especificaciones', 'Especificaciones')}</TableCell>
                <TableCell width={50} />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <TextField
                      size="small"
                      value={item.material_codigo}
                      onChange={(e) => handleItemChange(idx, 'material_codigo', e.target.value)}
                      placeholder="Ej: 100012345"
                      variant="standard"
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={item.descripcion}
                      onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                      variant="standard"
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => handleItemChange(idx, 'cantidad', e.target.value)}
                      variant="standard"
                      inputProps={{ min: 1 }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={item.unidad}
                      onChange={(e) => handleItemChange(idx, 'unidad', e.target.value)}
                      variant="standard"
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={item.especificaciones}
                      onChange={(e) => handleItemChange(idx, 'especificaciones', e.target.value)}
                      variant="standard"
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                      aria-label={t('rfq_eliminar_item', 'Eliminar item')}
                    >
                      <DeleteIcon fontSize="small" color={items.length > 1 ? 'error' : 'disabled'} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Proveedores */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t('rfq_proveedores_invitados', 'Proveedores Invitados')}
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addProveedor}>
            {t('rfq_agregar_proveedor', 'Agregar Proveedor')}
          </Button>
        </Stack>
        <Stack spacing={1.5}>
          {proveedores.map((prov, idx) => (
            <Stack key={idx} direction="row" gap={2} alignItems="center">
              <TextField
                size="small"
                label={t('rfq_proveedor_cuit', 'CUIT')}
                value={prov.cuit}
                onChange={(e) => handleProveedorChange(idx, 'cuit', e.target.value)}
                sx={{ flex: 1 }}
                placeholder="Ej: 30-12345678-9"
              />
              <TextField
                size="small"
                label={t('rfq_proveedor_nombre', 'Nombre')}
                value={prov.nombre}
                onChange={(e) => handleProveedorChange(idx, 'nombre', e.target.value)}
                sx={{ flex: 2 }}
              />
              <IconButton
                size="small"
                onClick={() => removeProveedor(idx)}
                disabled={proveedores.length <= 1}
                aria-label={t('rfq_eliminar_proveedor', 'Eliminar proveedor')}
              >
                <DeleteIcon fontSize="small" color={proveedores.length > 1 ? 'error' : 'disabled'} />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </Paper>

      {/* Actions */}
      <Stack direction="row" justifyContent="flex-end" gap={2}>
        <Button variant="outlined" onClick={() => navigate('/procurement/rfq')}>
          {t('common_cancelar', 'Cancelar')}
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSubmit}
          disabled={saving || !form.titulo.trim()}
        >
          {saving ? t('rfq_guardando', 'Guardando...') : t('rfq_crear_btn', 'Crear RFQ')}
        </Button>
      </Stack>
    </Box>
  );
}
