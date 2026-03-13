/**
 * FreightTariffs - Freight tariff management page
 *
 * Displays tariffs with filter by transportista_cuit, SPMAgGrid table,
 * and a dialog to create new tariffs.
 * Sprint 61
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const INITIAL_FORM = {
  transportista_cuit: '',
  ruta_origen: '',
  ruta_destino: '',
  tipo_vehiculo: '',
  tarifa_base: '',
  tarifa_por_km: '',
  tarifa_por_kg: '',
  vigencia_desde: '',
  vigencia_hasta: '',
};

export default function FreightTariffs() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCuit, setFilterCuit] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = {};
        if (filterCuit) params.transportista_cuit = filterCuit;
        const res = await api.get('/freight/tariffs', { params });
        if (!cancelled && res.data?.ok) setTariffs(res.data.tariffs || res.data.items || []);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('tariff_error_load', 'Error al cargar tarifas'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [filterCuit, reloadTick]);

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.transportista_cuit.trim() || !form.ruta_origen.trim() || !form.ruta_destino.trim()) {
      toastRef.current.warning(tRef.current('tariff_required', 'Complete transportista, origen y destino'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        tarifa_base: form.tarifa_base ? parseFloat(form.tarifa_base) : null,
        tarifa_por_km: form.tarifa_por_km ? parseFloat(form.tarifa_por_km) : null,
        tarifa_por_kg: form.tarifa_por_kg ? parseFloat(form.tarifa_por_kg) : null,
      };
      const res = await api.post('/freight/tariffs', payload);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('tariff_created', 'Tarifa registrada'));
        setDialogOpen(false);
        setForm(INITIAL_FORM);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('tariff_error_create', 'Error al registrar tarifa'));
    } finally {
      setSubmitting(false);
    }
  }, [form]);

  const columnDefs = useMemo(() => [
    { field: 'transportista_cuit', headerName: t('tariff_transportista', 'Transportista CUIT'), flex: 1, minWidth: 150 },
    { field: 'ruta_origen', headerName: t('tariff_origen', 'Origen'), flex: 1, minWidth: 120 },
    { field: 'ruta_destino', headerName: t('tariff_destino', 'Destino'), flex: 1, minWidth: 120 },
    { field: 'tipo_vehiculo', headerName: t('tariff_vehiculo', 'Tipo Vehiculo'), flex: 1, minWidth: 120 },
    {
      field: 'tarifa_base',
      headerName: t('tariff_base', 'Tarifa Base'),
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'tarifa_por_km',
      headerName: t('tariff_por_km', 'Tarifa/km'),
      width: 120,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value, 4) : '-',
    },
    {
      field: 'tarifa_por_kg',
      headerName: t('tariff_por_kg', 'Tarifa/kg'),
      width: 120,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value, 4) : '-',
    },
    {
      field: 'vigencia_desde',
      headerName: t('tariff_vigencia_desde', 'Vigencia Desde'),
      width: 130,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'vigencia_hasta',
      headerName: t('tariff_vigencia_hasta', 'Vigencia Hasta'),
      width: 130,
      valueFormatter: (p) => formatDate(p.value),
    },
  ], [t]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
    <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
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
            {t('tariff_title', 'Tarifas de Flete')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          aria-label={t('tariff_new', 'Nueva Tarifa')}
        >
          {t('tariff_new', 'Nueva Tarifa')}
        </Button>
      </Stack>

      {/* Filter */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
          <TextField
            size="small"
            label={t('tariff_filter_transportista', 'Transportista CUIT')}
            value={filterCuit}
            onChange={(e) => setFilterCuit(e.target.value)}
            sx={{ minWidth: 220 }}
          />
        </Stack>
      </Paper>

      {/* Table */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider' }}
        aria-label={t('tariff_title', 'Tarifas de Flete')}
      >
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={tariffs}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          exportFileName="tarifas_flete"
          emptyMessage={t('tariff_empty', 'No hay tarifas registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Create Tariff Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <LocalShippingIcon color="primary" />
            <span>{t('tariff_new', 'Nueva Tarifa')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('tariff_field_transportista', 'Transportista CUIT')}
              value={form.transportista_cuit}
              onChange={(e) => handleFormChange('transportista_cuit', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('tariff_field_origen', 'Ruta Origen')}
                value={form.ruta_origen}
                onChange={(e) => handleFormChange('ruta_origen', e.target.value)}
                fullWidth
                required
                size="small"
              />
              <TextField
                label={t('tariff_field_destino', 'Ruta Destino')}
                value={form.ruta_destino}
                onChange={(e) => handleFormChange('ruta_destino', e.target.value)}
                fullWidth
                required
                size="small"
              />
            </Stack>
            <TextField
              label={t('tariff_field_vehiculo', 'Tipo Vehiculo')}
              value={form.tipo_vehiculo}
              onChange={(e) => handleFormChange('tipo_vehiculo', e.target.value)}
              fullWidth
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('tariff_field_base', 'Tarifa Base')}
                type="number"
                value={form.tarifa_base}
                onChange={(e) => handleFormChange('tarifa_base', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0, step: 0.01 }}
              />
              <TextField
                label={t('tariff_field_km', 'Tarifa por km')}
                type="number"
                value={form.tarifa_por_km}
                onChange={(e) => handleFormChange('tarifa_por_km', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0, step: 0.0001 }}
              />
              <TextField
                label={t('tariff_field_kg', 'Tarifa por kg')}
                type="number"
                value={form.tarifa_por_kg}
                onChange={(e) => handleFormChange('tarifa_por_kg', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0, step: 0.0001 }}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('tariff_field_desde', 'Vigencia Desde')}
                type="date"
                value={form.vigencia_desde}
                onChange={(e) => handleFormChange('vigencia_desde', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label={t('tariff_field_hasta', 'Vigencia Hasta')}
                type="date"
                value={form.vigencia_hasta}
                onChange={(e) => handleFormChange('vigencia_hasta', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || !form.transportista_cuit.trim() || !form.ruta_origen.trim() || !form.ruta_destino.trim()}
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
