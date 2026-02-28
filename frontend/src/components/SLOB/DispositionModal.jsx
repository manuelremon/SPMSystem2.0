/**
 * DispositionModal - Modal para proponer disposicion SLOB
 *
 * Permite registrar una disposicion (scrap, transfer, discount_sale,
 * rework, donate) para un material obsoleto.
 * Sprint 53
 */

import { useState, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import { useI18n } from '../../context/i18n';
import { useToast } from '../../hooks/useToast';
import api from '../../services/api';

const TIPOS_DISPOSICION = [
  { value: 'scrap', label: 'Scrap (Desecho)' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'discount_sale', label: 'Venta con descuento' },
  { value: 'rework', label: 'Retrabajo' },
  { value: 'donate', label: 'Donacion' },
];

export default function DispositionModal({ open, onClose, item, onCreated }) {
  const { t } = useI18n();
  const toast = useToast();
  const [tipo, setTipo] = useState('scrap');
  const [cantidad, setCantidad] = useState('');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!cantidad || parseFloat(cantidad) <= 0) {
      toast.warning(t('slob_quantity_required', 'Ingrese una cantidad valida'));
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/slob/disposition', {
        material_codigo: item?.material_codigo,
        almacen: item?.almacen,
        tipo_disposicion: tipo,
        cantidad: parseFloat(cantidad),
        notas,
      });
      setTipo('scrap');
      setCantidad('');
      setNotas('');
      if (onCreated) onCreated();
    } catch {
      toast.error(t('slob_disposition_error', 'Error al crear disposicion'));
    } finally {
      setSubmitting(false);
    }
  }, [item, tipo, cantidad, notas, t, toast, onCreated]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('slob_propose_disposition', 'Proponer Disposicion')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label={t('slob_material', 'Material')} value={item?.material_codigo || ''} disabled size="small" fullWidth />
          <TextField label={t('slob_warehouse', 'Almacen')} value={item?.almacen || ''} disabled size="small" fullWidth />
          <TextField
            label={t('slob_quantity', 'Cantidad')}
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            size="small"
            fullWidth
            required
            inputProps={{ min: 1, step: 1 }}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>{t('slob_disposition_type', 'Tipo Disposicion')}</InputLabel>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)} label={t('slob_disposition_type', 'Tipo Disposicion')}>
              {TIPOS_DISPOSICION.map((td) => (
                <MenuItem key={td.value} value={td.value}>{td.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label={t('slob_notes', 'Notas')} value={notas} onChange={(e) => setNotas(e.target.value)} multiline rows={2} size="small" fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>{t('common_cancel', 'Cancelar')}</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <CircularProgress size={18} /> : t('common_save', 'Guardar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
