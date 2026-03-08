/**
 * ContractCreate - Create a new contract
 *
 * Form for creating contracts with auto-generated number,
 * proveedor info, dates, value, and notes.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';

const TIPO_OPTIONS = [
  { value: 'blanket_po', label: 'Orden Abierta' },
  { value: 'fixed_price', label: 'Precio Fijo' },
  { value: 'time_materials', label: 'Tiempo y Materiales' },
  { value: 'framework', label: 'Marco' },
];

const MONEDA_OPTIONS = ['ARS', 'USD', 'EUR'];

const INITIAL_FORM = {
  proveedor_nombre: '',
  proveedor_cuit: '',
  tipo: 'blanket_po',
  fecha_inicio: '',
  fecha_vencimiento: '',
  valor_total: '',
  moneda: 'USD',
  centro: '',
  notas: '',
};

export default function ContractCreate() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.proveedor_nombre.trim()) {
      toast.warning(t('contracts_proveedor_required', 'El proveedor es requerido'));
      return;
    }
    if (!form.fecha_inicio || !form.fecha_vencimiento) {
      toast.warning(t('contracts_dates_required', 'Las fechas son requeridas'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        proveedor_nombre: form.proveedor_nombre.trim(),
        proveedor_cuit: form.proveedor_cuit.trim(),
        tipo: form.tipo,
        fecha_inicio: form.fecha_inicio,
        fecha_vencimiento: form.fecha_vencimiento,
        valor_total: form.valor_total ? Number(form.valor_total) : 0,
        moneda: form.moneda,
        centro: form.centro.trim(),
        notas: form.notas.trim(),
      };
      const res = await api.post('/contracts', payload);
      if (res.data?.ok) {
        toast.success(t('contracts_created', 'Contrato creado'));
        navigate(`/procurement/contracts/${res.data.contract?.id || res.data.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('contracts_error_create', 'Error al crear contrato'));
    } finally {
      setSaving(false);
    }
  }, [form, navigate, t, toast]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 700, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/procurement/contracts')} color="inherit">
          {t('common_volver', 'Volver')}
        </Button>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {t('contracts_create_title', 'Nuevo Contrato')}
        </Typography>
      </Stack>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={2.5}>
          <TextField label={t('contracts_numero', 'N. Contrato')} value={t('contracts_auto', 'Auto-generado')} disabled fullWidth size="small" />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField label={t('contracts_proveedor', 'Proveedor')} value={form.proveedor_nombre} onChange={(e) => handleChange('proveedor_nombre', e.target.value)} fullWidth required size="small" />
            <TextField label={t('contracts_cuit', 'CUIT')} value={form.proveedor_cuit} onChange={(e) => handleChange('proveedor_cuit', e.target.value)} fullWidth size="small" />
          </Stack>
          <FormControl fullWidth size="small">
            <InputLabel>{t('contracts_tipo', 'Tipo')}</InputLabel>
            <Select value={form.tipo} label={t('contracts_tipo', 'Tipo')} onChange={(e) => handleChange('tipo', e.target.value)}>
              {TIPO_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField type="date" label={t('contracts_fecha_inicio', 'Fecha Inicio')} value={form.fecha_inicio} onChange={(e) => handleChange('fecha_inicio', e.target.value)} fullWidth required size="small" InputLabelProps={{ shrink: true }} />
            <TextField type="date" label={t('contracts_fecha_vencimiento', 'Fecha Vencimiento')} value={form.fecha_vencimiento} onChange={(e) => handleChange('fecha_vencimiento', e.target.value)} fullWidth required size="small" InputLabelProps={{ shrink: true }} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField type="number" label={t('contracts_valor', 'Valor Total')} value={form.valor_total} onChange={(e) => handleChange('valor_total', e.target.value)} fullWidth size="small" />
            <FormControl sx={{ minWidth: 120 }} size="small">
              <InputLabel>{t('contracts_moneda', 'Moneda')}</InputLabel>
              <Select value={form.moneda} label={t('contracts_moneda', 'Moneda')} onChange={(e) => handleChange('moneda', e.target.value)}>
                {MONEDA_OPTIONS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <TextField label={t('contracts_centro', 'Centro')} value={form.centro} onChange={(e) => handleChange('centro', e.target.value)} fullWidth size="small" />
          <TextField label={t('contracts_notas', 'Notas')} value={form.notas} onChange={(e) => handleChange('notas', e.target.value)} fullWidth multiline rows={3} size="small" />
        </Stack>
      </Paper>

      <Stack direction="row" justifyContent="flex-end" gap={2}>
        <Button variant="outlined" color="inherit" onClick={() => navigate('/procurement/contracts')}>
          {t('common_cancelar', 'Cancelar')}
        </Button>
        <Button variant="contained" startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />} onClick={handleSubmit} disabled={saving}>
          {t('contracts_create_btn', 'Crear Contrato')}
        </Button>
      </Stack>
    </Box>
  );
}
