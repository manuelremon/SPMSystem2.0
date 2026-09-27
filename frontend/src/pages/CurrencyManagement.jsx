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
import { formatCurrency, formatDate, formatNumber, toNumber } from '../utils/formatters';

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
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import PageLayout from '../components/ui/PageLayout';
import EmptyState from '../components/ui/EmptyState';

const FUENTE_COLORS = {
  manual: 'default',
  api: 'info',
  bcra: 'success',
  system: 'warning',
};

const FUENTE_LABELS = {
  manual: 'Manual',
  api: 'API',
  bcra: 'BCRA',
  system: 'Sistema',
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
  const [loadError, setLoadError] = useState(false);

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
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
  }, []);

  const fetchRates = useCallback(async () => {
    try {
      setRatesLoading(true);
      const res = await api.get('/currency/rates');
      if (res.data?.ok) {
        setRates(res.data.rates || res.data.items || []);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    } finally {
      setRatesLoading(false);
    }
  }, []);

  const fetchExposure = useCallback(async () => {
    setExposureLoading(true);
    try {
      const res = await api.get('/currency/exposure');
      if (res.data?.ok) {
        setExposure(res.data.exposure || res.data.items || []);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    } finally {
      setExposureLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleRetry = useCallback(() => {
    setLoadError(false);
    fetchDashboard();
    if (tabValue === 0) fetchRates();
    else if (tabValue === 1) fetchExposure();
  }, [tabValue, fetchDashboard, fetchRates, fetchExposure]);

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
      toast.warning(t('currency_required_rate', 'Completa las monedas y la tasa'));
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
      toast.error(err.response?.data?.error || t('currency_error_create_rate', 'Error al registrar la tasa'));
    } finally {
      setRateSubmitting(false);
    }
  }, [rateForm, t, toast, fetchRates, fetchDashboard]);

  // Converter
  const handleConvert = useCallback(async () => {
    if (!convertForm.monto || !convertForm.from || !convertForm.to) {
      toast.warning(t('currency_convert_required', 'Completa el monto y las monedas'));
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
    if (val == null) return '—';
    return toNumber(val).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }, []);

  const rateColumnDefs = useMemo(() => [
    { field: 'moneda_origen', headerName: t('currency_col_origen', 'Moneda origen'), minWidth: 130 },
    { field: 'moneda_destino', headerName: t('currency_col_destino', 'Moneda destino'), minWidth: 130 },
    {
      field: 'tasa',
      headerName: t('currency_col_tasa', 'Tasa'),
      minWidth: 140,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => fmtRate(p.value),
    },
    {
      field: 'fecha',
      headerName: t('currency_col_fecha', 'Fecha'),
      minWidth: 120,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'fuente',
      headerName: t('currency_col_fuente', 'Fuente'),
      minWidth: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={FUENTE_LABELS[p.value] || p.value || FUENTE_LABELS.manual} color={FUENTE_COLORS[p.value] || 'default'} variant="outlined" />
      ),
    },
  ], [t, fmtRate]);

  const exposureColumnDefs = useMemo(() => [
    { field: 'moneda', headerName: t('currency_exp_moneda', 'Moneda'), minWidth: 120 },
    {
      field: 'total_comprometido',
      headerName: t('currency_exp_comprometido', 'Total comprometido'),
      flex: 1,
      minWidth: 180,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '—',
    },
    {
      field: 'equivalente_ars',
      headerName: t('currency_exp_equiv_ars', 'Equivalente ARS'),
      flex: 1,
      minWidth: 180,
      type: 'rightAligned',
      filter: 'agNumberColumnFilter',
      valueFormatter: (p) => p.value != null ? `ARS ${formatNumber(p.value, 2)}` : '—',
    },
  ], [t]);

  // Dashboard KPI helpers
  const usdRate = dashboard?.usd_rate;
  const eurRate = dashboard?.eur_rate;
  const brlRate = dashboard?.brl_rate;
  const totalExposure = dashboard?.total_exposure_ars;

  return (
    <PageLayout
      title={t('currency_title', 'Gestión de monedas')}
      backTo="/admin"
      actions={
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setRateDialogOpen(true)}
          sx={{ textTransform: 'none' }}
        >
          {t('currency_new_rate', 'Registrar tasa')}
        </Button>
      }
    >
      {loadError ? (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <EmptyState
            icon={<ErrorOutlineIcon sx={{ fontSize: 32, color: 'error.main' }} />}
            title={t('currency_error_load', 'No se pudieron cargar los datos de monedas')}
            description={t('currency_error_load_desc', 'Revisa tu conexión o inténtalo de nuevo en unos minutos.')}
            action={t('common_reintentar', 'Reintentar')}
            onAction={handleRetry}
          />
        </Paper>
      ) : (
      <>
      {/* KPI Cards */}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: { xs: 0, sm: 150 } }}>
          <Typography variant="caption" color="text.secondary">{t('currency_kpi_usd', 'Tasa USD')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {usdRate != null ? fmtRate(usdRate) : '—'}
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: { xs: 0, sm: 150 } }}>
          <Typography variant="caption" color="text.secondary">{t('currency_kpi_eur', 'Tasa EUR')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {eurRate != null ? fmtRate(eurRate) : '—'}
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: { xs: 0, sm: 150 } }}>
          <Typography variant="caption" color="text.secondary">{t('currency_kpi_brl', 'Tasa BRL')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {brlRate != null ? fmtRate(brlRate) : '—'}
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: { xs: 0, sm: 150 } }}>
          <Typography variant="caption" color="text.secondary">{t('currency_kpi_exposure', 'Exposición total ARS')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {totalExposure != null ? `ARS ${formatNumber(totalExposure, 0)}` : '—'}
          </Typography>
        </Paper>
      </Stack>

      {/* Converter Tool */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
          <SwapHorizIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: 'text-bottom' }} />
          {t('currency_converter', 'Convertidor')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ xs: 'stretch', sm: 'flex-end' }} flexWrap="wrap">
          <TextField
            size="small"
            type="number"
            label={t('currency_conv_monto', 'Monto')}
            value={convertForm.monto}
            onChange={(e) => setConvertForm((prev) => ({ ...prev, monto: e.target.value }))}
            sx={{ minWidth: { xs: 0, sm: 140 } }}
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
            sx={{ textTransform: 'none' }}
          >
            {t('currency_conv_btn', 'Convertir')}
          </Button>
          {convertResult && (
            <Paper elevation={0} sx={{ px: 2, py: 1, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.main' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.dark' }}>
                {convertResult.resultado != null
                  ? `${formatNumber(convertResult.resultado, 2)} ${convertForm.to}`
                  : '—'}
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
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ '& .MuiTab-root': { textTransform: 'none', minHeight: 48 } }}
        >
          <Tab label={t('currency_tab_rates', 'Tasas')} icon={<CurrencyExchangeIcon />} iconPosition="start" />
          <Tab label={t('currency_tab_exposure', 'Exposición')} icon={<AccountBalanceIcon />} iconPosition="start" />
          <Tab label={t('currency_tab_gl', 'Ganancia/Pérdida')} icon={<TrendingUpIcon />} iconPosition="start" />
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
            paginationPageSize={25}
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
          aria-label={t('currency_tab_exposure', 'Exposición')}
        >
          <SPMAgGrid
            columnDefs={exposureColumnDefs}
            rowData={exposure}
            loading={exposureLoading}
            height={400}
            pagination={false}
            enableQuickFilter={false}
            exportFileName="exposicion_monedas"
            emptyMessage={t('currency_empty_exposure', 'Sin datos de exposición')}
            getRowId={(params) => String(params.data.moneda || params.data.id)}
          />
        </Paper>
      )}

      {/* Tab 2: Gain/Loss */}
      {tabValue === 2 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>{t('currency_gl_title', 'Ganancia/Pérdida cambiaria')}</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">{t('currency_gl_realized', 'Realizada')}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                {dashboard?.ganancia_realizada != null ? formatCurrency(dashboard.ganancia_realizada) : '-'}
              </Typography>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">{t('currency_gl_unrealized', 'No realizada')}</Typography>
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
            {t('currency_gl_note', 'Los valores se calculan sobre operaciones de compra con monedas extranjeras en el período actual.')}
          </Typography>
        </Paper>
      )}

      </>
      )}

      {/* Register Rate Dialog */}
      <Dialog open={rateDialogOpen} onClose={() => setRateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <CurrencyExchangeIcon color="primary" />
            <span>{t('currency_new_rate', 'Registrar tasa')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('currency_field_origen', 'Moneda origen')}</InputLabel>
                <Select
                  value={rateForm.moneda_origen}
                  label={t('currency_field_origen', 'Moneda origen')}
                  onChange={(e) => handleRateFormChange('moneda_origen', e.target.value)}
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('currency_field_destino', 'Moneda destino')}</InputLabel>
                <Select
                  value={rateForm.moneda_destino}
                  label={t('currency_field_destino', 'Moneda destino')}
                  onChange={(e) => handleRateFormChange('moneda_destino', e.target.value)}
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label={t('currency_field_tasa', 'Tasa de cambio')}
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
          <Button onClick={() => setRateDialogOpen(false)} disabled={rateSubmitting} sx={{ textTransform: 'none' }}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateRate}
            disabled={rateSubmitting || !rateForm.tasa}
            startIcon={rateSubmitting && <CircularProgress size={16} />}
            sx={{ textTransform: 'none' }}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
}
