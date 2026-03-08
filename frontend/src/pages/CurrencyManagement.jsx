/**
 * CurrencyManagement - Multi-currency management page
 *
 * Displays KPI cards for main exchange rates and total exposure, tabbed view
 * for Rates/Exposure/Gain-Loss, inline currency converter, and dialogs
 * for registering new rates.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

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
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const FUENTE_COLORS = {
  manual: 'default',
  api: 'info',
  bcra: 'success',
  system: 'warning',
};

const INITIAL_RATE_FORM = {
  moneda_origen: 'USD',
  moneda_destino: 'ARS',
  tasa: '',
  fecha: '',
};

const CURRENCY_OPTIONS = ['USD', 'EUR', 'BRL', 'ARS', 'CLP', 'UYU', 'GBP', 'CNY'];

export default function CurrencyManagement() {
  const { t } = useI18n();
  const toast = useToast();

  const [tabValue, setTabValue] = useState(0);
  const [dashboard, setDashboard] = useState(null);

  // Rates state
  const [rates, setRates] = useState([]);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [rateForm, setRateForm] = useState(INITIAL_RATE_FORM);
  const [rateSubmitting, setRateSubmitting] = useState(false);

  // Exposure state
  const [exposure, setExposure] = useState([]);
  const [exposureLoading, setExposureLoading] = useState(false);

  // Converter state
  const [convertForm, setConvertForm] = useState({ monto: '', from: 'USD', to: 'ARS' });
  const [convertResult, setConvertResult] = useState(null);
  const [converting, setConverting] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/currency/dashboard');
      if (res.data?.ok) {
        setDashboard(res.data.dashboard || res.data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchRates = useCallback(async () => {
    try {
      setRatesLoading(true);
      const res = await api.get('/currency/rates');
      if (res.data?.ok) {
        setRates(res.data.rates || res.data.items || []);
      }
    } catch {
      toast.error(t('currency_error_load_rates', 'Error al cargar tasas'));
    } finally {
      setRatesLoading(false);
    }
  }, [t, toast]);

  const fetchExposure = useCallback(async () => {
    setExposureLoading(true);
    try {
      const res = await api.get('/currency/exposure');
      if (res.data?.ok) {
        setExposure(res.data.exposure || res.data.items || []);
      }
    } catch {
      toast.error(t('currency_error_load_exposure', 'Error al cargar exposicion'));
    } finally {
      setExposureLoading(false);
    }
  }, [t, toast]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    if (tabValue === 0) {
      fetchRates();
    } else if (tabValue === 1) {
      fetchExposure();
    }
  }, [tabValue, fetchRates, fetchExposure]);

  // Rate form handlers
  const handleRateFormChange = useCallback((field, value) => {
    setRateForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreateRate = useCallback(async () => {
    if (!rateForm.tasa || !rateForm.moneda_origen || !rateForm.moneda_destino) {
      toast.warning(t('currency_required_rate', 'Complete monedas y tasa'));
      return;
    }
    setRateSubmitting(true);
    try {
      const payload = {
        ...rateForm,
        tasa: parseFloat(rateForm.tasa),
      };
      const res = await api.post('/currency/rates', payload);
      if (res.data?.ok) {
        toast.success(t('currency_rate_created', 'Tasa registrada'));
        setRateDialogOpen(false);
        setRateForm(INITIAL_RATE_FORM);
        fetchRates();
        fetchDashboard();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('currency_error_create_rate', 'Error al registrar tasa'));
    } finally {
      setRateSubmitting(false);
    }
  }, [rateForm, t, toast, fetchRates, fetchDashboard]);

  // Converter
  const handleConvert = useCallback(async () => {
    if (!convertForm.monto || !convertForm.from || !convertForm.to) {
      toast.warning(t('currency_convert_required', 'Complete monto y monedas'));
      return;
    }
    setConverting(true);
    setConvertResult(null);
    try {
      const res = await api.post('/currency/convert', {
        monto: parseFloat(convertForm.monto),
        moneda_origen: convertForm.from,
        moneda_destino: convertForm.to,
      });
      if (res.data?.ok) {
        setConvertResult(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('currency_error_convert', 'Error al convertir'));
    } finally {
      setConverting(false);
    }
  }, [convertForm, t, toast]);

  const fmtRate = useCallback((val) => {
    if (val == null) return '-';
    return Number(val).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }, []);

  const rateColumnDefs = useMemo(() => [
    { field: 'moneda_origen', headerName: t('currency_col_origen', 'Moneda Origen'), width: 130 },
    { field: 'moneda_destino', headerName: t('currency_col_destino', 'Moneda Destino'), width: 130 },
    {
      field: 'tasa',
      headerName: t('currency_col_tasa', 'Tasa'),
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => fmtRate(p.value),
    },
    {
      field: 'fecha',
      headerName: t('currency_col_fecha', 'Fecha'),
      width: 120,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'fuente',
      headerName: t('currency_col_fuente', 'Fuente'),
      width: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={p.value || 'manual'} color={FUENTE_COLORS[p.value] || 'default'} variant="outlined" />
      ),
    },
  ], [t, fmtRate]);

  const exposureColumnDefs = useMemo(() => [
    { field: 'moneda', headerName: t('currency_exp_moneda', 'Moneda'), width: 120 },
    {
      field: 'total_comprometido',
      headerName: t('currency_exp_comprometido', 'Total Comprometido'),
      flex: 1,
      minWidth: 180,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'equivalente_ars',
      headerName: t('currency_exp_equiv_ars', 'Equivalente ARS'),
      flex: 1,
      minWidth: 180,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? `ARS ${Number(p.value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-',
    },
  ], [t]);

  // Dashboard KPI helpers
  const usdRate = dashboard?.usd_rate;
  const eurRate = dashboard?.eur_rate;
  const brlRate = dashboard?.brl_rate;
  const totalExposure = dashboard?.total_exposure_ars;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <CurrencyExchangeIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('currency_title', 'Gestion de Monedas')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setRateDialogOpen(true)}
          aria-label={t('currency_new_rate', 'Registrar Tasa')}
        >
          {t('currency_new_rate', 'Registrar Tasa')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 150 }}>
          <Typography variant="caption" color="text.secondary">{t('currency_kpi_usd', 'USD Rate')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
            {usdRate != null ? fmtRate(usdRate) : '-'}
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 150 }}>
          <Typography variant="caption" color="text.secondary">{t('currency_kpi_eur', 'EUR Rate')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
            {eurRate != null ? fmtRate(eurRate) : '-'}
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 150 }}>
          <Typography variant="caption" color="text.secondary">{t('currency_kpi_brl', 'BRL Rate')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
            {brlRate != null ? fmtRate(brlRate) : '-'}
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 150 }}>
          <Typography variant="caption" color="text.secondary">{t('currency_kpi_exposure', 'Exposicion Total ARS')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
            {totalExposure != null ? `ARS ${Number(totalExposure).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
          </Typography>
        </Paper>
      </Stack>

      {/* Converter Tool */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          <SwapHorizIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
          {t('currency_converter', 'Convertidor')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems="flex-end">
          <TextField
            size="small"
            type="number"
            label={t('currency_conv_monto', 'Monto')}
            value={convertForm.monto}
            onChange={(e) => setConvertForm((prev) => ({ ...prev, monto: e.target.value }))}
            sx={{ minWidth: 140 }}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>{t('currency_conv_from', 'De')}</InputLabel>
            <Select
              value={convertForm.from}
              label={t('currency_conv_from', 'De')}
              onChange={(e) => setConvertForm((prev) => ({ ...prev, from: e.target.value }))}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>{t('currency_conv_to', 'A')}</InputLabel>
            <Select
              value={convertForm.to}
              label={t('currency_conv_to', 'A')}
              onChange={(e) => setConvertForm((prev) => ({ ...prev, to: e.target.value }))}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            size="small"
            onClick={handleConvert}
            disabled={converting || !convertForm.monto}
            startIcon={converting ? <CircularProgress size={16} /> : <SwapHorizIcon />}
          >
            {t('currency_conv_btn', 'Convertir')}
          </Button>
          {convertResult && (
            <Paper elevation={0} sx={{ px: 2, py: 1, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.main' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.dark' }}>
                {convertResult.resultado != null
                  ? `${Number(convertResult.resultado).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${convertForm.to}`
                  : '-'}
              </Typography>
              {convertResult.tasa_usada && (
                <Typography variant="caption" color="text.secondary">
                  {t('currency_conv_rate_used', 'Tasa')}: {fmtRate(convertResult.tasa_usada)}
                </Typography>
              )}
            </Paper>
          )}
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={t('currency_tab_rates', 'Tasas')} icon={<CurrencyExchangeIcon />} iconPosition="start" />
          <Tab label={t('currency_tab_exposure', 'Exposicion')} icon={<AccountBalanceIcon />} iconPosition="start" />
          <Tab label={t('currency_tab_gl', 'Ganancia/Perdida')} icon={<TrendingUpIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Rates */}
      {tabValue === 0 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider' }}
          aria-label={t('currency_tab_rates', 'Tasas')}
        >
          <SPMAgGrid
            columnDefs={rateColumnDefs}
            rowData={rates}
            loading={ratesLoading}
            height={480}
            pagination={true}
            paginationPageSize={20}
            enableQuickFilter={true}
            exportFileName="tasas_cambio"
            emptyMessage={t('currency_empty_rates', 'No hay tasas registradas')}
            getRowId={(params) => String(params.data.id || `${params.data.moneda_origen}_${params.data.moneda_destino}_${params.data.fecha}`)}
          />
        </Paper>
      )}

      {/* Tab 1: Exposure */}
      {tabValue === 1 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider' }}
          aria-label={t('currency_tab_exposure', 'Exposicion')}
        >
          <SPMAgGrid
            columnDefs={exposureColumnDefs}
            rowData={exposure}
            loading={exposureLoading}
            height={400}
            pagination={false}
            enableQuickFilter={false}
            exportFileName="exposicion_monedas"
            emptyMessage={t('currency_empty_exposure', 'Sin datos de exposicion')}
            getRowId={(params) => String(params.data.moneda || params.data.id)}
          />
        </Paper>
      )}

      {/* Tab 2: Gain/Loss */}
      {tabValue === 2 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>{t('currency_gl_title', 'Ganancia / Perdida Cambiaria')}</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">{t('currency_gl_realized', 'Realizada')}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                {dashboard?.ganancia_realizada != null ? formatCurrency(dashboard.ganancia_realizada) : '-'}
              </Typography>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">{t('currency_gl_unrealized', 'No Realizada')}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
                {dashboard?.ganancia_no_realizada != null ? formatCurrency(dashboard.ganancia_no_realizada) : '-'}
              </Typography>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">{t('currency_gl_net', 'Neto')}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {dashboard?.ganancia_neta != null ? formatCurrency(dashboard.ganancia_neta) : '-'}
              </Typography>
            </Paper>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary">
            {t('currency_gl_note', 'Los valores se calculan sobre operaciones de compra con monedas extranjeras en el periodo actual.')}
          </Typography>
        </Paper>
      )}

      {/* Register Rate Dialog */}
      <Dialog open={rateDialogOpen} onClose={() => setRateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <CurrencyExchangeIcon color="primary" />
            <span>{t('currency_new_rate', 'Registrar Tasa')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('currency_field_origen', 'Moneda Origen')}</InputLabel>
                <Select
                  value={rateForm.moneda_origen}
                  label={t('currency_field_origen', 'Moneda Origen')}
                  onChange={(e) => handleRateFormChange('moneda_origen', e.target.value)}
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('currency_field_destino', 'Moneda Destino')}</InputLabel>
                <Select
                  value={rateForm.moneda_destino}
                  label={t('currency_field_destino', 'Moneda Destino')}
                  onChange={(e) => handleRateFormChange('moneda_destino', e.target.value)}
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label={t('currency_field_tasa', 'Tasa de Cambio')}
              type="number"
              value={rateForm.tasa}
              onChange={(e) => handleRateFormChange('tasa', e.target.value)}
              fullWidth
              required
              size="small"
              inputProps={{ min: 0, step: 0.0001 }}
            />
            <TextField
              label={t('currency_field_fecha', 'Fecha')}
              type="date"
              value={rateForm.fecha}
              onChange={(e) => handleRateFormChange('fecha', e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRateDialogOpen(false)} disabled={rateSubmitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateRate}
            disabled={rateSubmitting || !rateForm.tasa}
            startIcon={rateSubmitting && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
