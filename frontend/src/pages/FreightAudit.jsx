/**
 * FreightAudit - Freight invoice audit page
 *
 * Displays freight invoices with KPI cards, filters (estado, transportista, date range),
 * SPMAgGrid table with row actions (Auto-Audit, Aprobar, Disputar), new invoice dialog,
 * and a carrier performance section.
 * Sprint 61
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import AddIcon from '@mui/icons-material/Add';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckIcon from '@mui/icons-material/Check';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'audited', label: 'Auditada' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'disputed', label: 'Disputada' },
  { value: 'paid', label: 'Pagada' },
];

const ESTADO_COLORS = {
  pending: 'default',
  audited: 'info',
  approved: 'success',
  disputed: 'error',
  paid: 'success',
};

const ESTADO_LABELS = {
  pending: 'Pendiente',
  audited: 'Auditada',
  approved: 'Aprobada',
  disputed: 'Disputada',
  paid: 'Pagada',
};

const INITIAL_INVOICE_FORM = {
  numero_factura: '',
  transportista_cuit: '',
  monto_facturado: '',
  concepto: '',
  fecha_factura: '',
};

export default function FreightAudit() {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [filters, setFilters] = useState({
    estado: '',
    transportista_cuit: '',
    fecha_desde: '',
    fecha_hasta: '',
  });

  // Tab state for invoices vs carrier performance
  const [tabValue, setTabValue] = useState(0);

  // Carrier performance
  const [carrierPerf, setCarrierPerf] = useState([]);
  const [carrierLoading, setCarrierLoading] = useState(false);

  // Create invoice dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(INITIAL_INVOICE_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // Approve dialog
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveInvoice, setApproveInvoice] = useState(null);
  const [approveAmount, setApproveAmount] = useState('');
  const [approving, setApproving] = useState(false);

  // Dispute dialog
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeInvoice, setDisputeInvoice] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputing, setDisputing] = useState(false);

  // Fetch invoices + KPIs
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = { page: 1, per_page: 200 };
        if (filters.estado) params.estado = filters.estado;
        if (filters.transportista_cuit) params.transportista_cuit = filters.transportista_cuit;
        if (filters.fecha_desde) params.fecha_desde = filters.fecha_desde;
        if (filters.fecha_hasta) params.fecha_hasta = filters.fecha_hasta;
        const [invRes, kpiRes] = await Promise.all([
          api.get('/freight/invoices', { params }),
          api.get('/freight/kpis')
        ]);
        if (cancelled) return;
        if (invRes.data?.ok) setInvoices(invRes.data.invoices || invRes.data.items || []);
        if (kpiRes.data?.ok) setKpis(kpiRes.data.kpis || kpiRes.data);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('freight_error_load', 'Error al cargar facturas'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [filters, reloadTick]);

  // Fetch carrier performance when tab selected
  useEffect(() => {
    if (tabValue !== 1) return;
    let cancelled = false;
    const load = async () => {
      setCarrierLoading(true);
      try {
        const res = await api.get('/freight/carrier-performance');
        if (!cancelled && res.data?.ok) setCarrierPerf(res.data.carriers || res.data.items || []);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('freight_error_carrier', 'Error al cargar rendimiento transportistas'));
      } finally {
        if (!cancelled) setCarrierLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tabValue, reloadTick]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleInvoiceFormChange = useCallback((field, value) => {
    setInvoiceForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Create invoice
  const handleCreateInvoice = useCallback(async () => {
    if (!invoiceForm.numero_factura.trim() || !invoiceForm.transportista_cuit.trim() || !invoiceForm.monto_facturado) {
      toastRef.current.warning(tRef.current('freight_required', 'Complete numero, transportista y monto'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...invoiceForm,
        monto_facturado: parseFloat(invoiceForm.monto_facturado),
      };
      const res = await api.post('/freight/invoices', payload);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('freight_created', 'Factura registrada'));
        setCreateOpen(false);
        setInvoiceForm(INITIAL_INVOICE_FORM);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('freight_error_create', 'Error al registrar factura'));
    } finally {
      setSubmitting(false);
    }
  }, [invoiceForm]);

  // Auto-audit
  const handleAutoAudit = useCallback(async (invoiceId) => {
    try {
      const res = await api.post(`/freight/invoices/${invoiceId}/audit`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('freight_audited', 'Factura auditada'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('freight_error_audit', 'Error al auditar'));
    }
  }, []);

  // Approve
  const handleApproveSubmit = useCallback(async () => {
    if (!approveInvoice) return;
    setApproving(true);
    try {
      const res = await api.put(`/freight/invoices/${approveInvoice.id}/approve`, {
        monto_aprobado: approveAmount ? parseFloat(approveAmount) : approveInvoice.monto_facturado,
      });
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('freight_approved', 'Factura aprobada'));
        setApproveOpen(false);
        setApproveInvoice(null);
        setApproveAmount('');
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('freight_error_approve', 'Error al aprobar'));
    } finally {
      setApproving(false);
    }
  }, [approveInvoice, approveAmount]);

  // Dispute
  const handleDisputeSubmit = useCallback(async () => {
    if (!disputeInvoice || !disputeReason.trim()) {
      toastRef.current.warning(tRef.current('freight_dispute_reason_req', 'Ingrese la razon de la disputa'));
      return;
    }
    setDisputing(true);
    try {
      const res = await api.put(`/freight/invoices/${disputeInvoice.id}/dispute`, {
        razon: disputeReason,
      });
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('freight_disputed', 'Factura disputada'));
        setDisputeOpen(false);
        setDisputeInvoice(null);
        setDisputeReason('');
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('freight_error_dispute', 'Error al disputar'));
    } finally {
      setDisputing(false);
    }
  }, [disputeInvoice, disputeReason]);

  const fmtMoney = useCallback((val) => {
    return val != null ? formatCurrency(val) : '-';
  }, []);

  const invoiceColumnDefs = useMemo(() => [
    { field: 'numero_factura', headerName: t('freight_numero', 'N. Factura'), flex: 1, minWidth: 130 },
    { field: 'transportista_cuit', headerName: t('freight_transportista', 'Transportista'), flex: 1, minWidth: 140 },
    {
      field: 'monto_facturado',
      headerName: t('freight_monto_facturado', 'Monto Facturado'),
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => fmtMoney(p.value),
    },
    { field: 'concepto', headerName: t('freight_concepto', 'Concepto'), flex: 1, minWidth: 140 },
    {
      field: 'fecha_factura',
      headerName: t('freight_fecha', 'Fecha'),
      width: 110,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'estado',
      headerName: t('freight_estado', 'Estado'),
      width: 130,
      cellRenderer: (p) => (
        <Chip size="small" label={ESTADO_LABELS[p.value] || p.value || '-'} color={ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    {
      field: 'monto_aprobado',
      headerName: t('freight_monto_aprobado', 'Monto Aprobado'),
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => fmtMoney(p.value),
    },
    {
      field: 'diferencia',
      headerName: t('freight_diferencia', 'Diferencia'),
      width: 130,
      type: 'numericColumn',
      cellRenderer: (p) => {
        const val = p.value;
        if (val == null) return '-';
        const formatted = formatCurrency(val);
        const isPositive = val > 0;
        return (
          <Typography variant="body2" sx={{ color: isPositive ? 'error.main' : 'text.primary', fontWeight: isPositive ? 600 : 400 }}>
            {formatted}
          </Typography>
        );
      },
    },
    {
      headerName: t('freight_acciones', 'Acciones'),
      width: 280,
      sortable: false,
      filter: false,
      cellRenderer: (p) => {
        const row = p.data;
        if (!row) return null;
        return (
          <Stack direction="row" gap={0.5} alignItems="center" sx={{ height: '100%' }}>
            {row.estado === 'pending' && (
              <Button
                size="small"
                variant="outlined"
                color="info"
                startIcon={<PlayArrowIcon />}
                onClick={(e) => { e.stopPropagation(); handleAutoAudit(row.id); }}
              >
                Auto-Audit
              </Button>
            )}
            {(row.estado === 'pending' || row.estado === 'audited') && (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  startIcon={<CheckIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setApproveInvoice(row);
                    setApproveAmount(String(row.monto_facturado || ''));
                    setApproveOpen(true);
                  }}
                >
                  {t('freight_aprobar', 'Aprobar')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<ReportProblemIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDisputeInvoice(row);
                    setDisputeOpen(true);
                  }}
                >
                  {t('freight_disputar', 'Disputar')}
                </Button>
              </>
            )}
          </Stack>
        );
      },
    },
  ], [t, fmtMoney, handleAutoAudit]);

  const carrierColumnDefs = useMemo(() => [
    { field: 'transportista_cuit', headerName: t('freight_carrier_cuit', 'CUIT'), flex: 1, minWidth: 140 },
    { field: 'nombre', headerName: t('freight_carrier_nombre', 'Nombre'), flex: 2, minWidth: 180 },
    {
      field: 'total_facturas',
      headerName: t('freight_carrier_facturas', 'Facturas'),
      width: 100,
      type: 'numericColumn',
    },
    {
      field: 'tasa_disputa',
      headerName: t('freight_carrier_tasa_disputa', 'Tasa Disputa'),
      width: 130,
      valueFormatter: (p) => p.value != null ? `${Number(p.value).toFixed(1)}%` : '-',
    },
    {
      field: 'monto_total',
      headerName: t('freight_carrier_monto', 'Monto Total'),
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => fmtMoney(p.value),
    },
    {
      field: 'diferencia_promedio',
      headerName: t('freight_carrier_dif_prom', 'Dif. Promedio'),
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => fmtMoney(p.value),
    },
    {
      field: 'score',
      headerName: t('freight_carrier_score', 'Score'),
      width: 90,
      type: 'numericColumn',
    },
  ], [t, fmtMoney]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <ReceiptLongIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('freight_title', 'Auditoria de Fletes')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          aria-label={t('freight_new', 'Nueva Factura Flete')}
        >
          {t('freight_new', 'Nueva Factura Flete')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('freight_kpi_total', 'Total Facturado')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{fmtMoney(kpis.total_facturado)}</Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('freight_kpi_aprobado', 'Total Aprobado')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>{fmtMoney(kpis.total_aprobado)}</Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('freight_kpi_diferencia', 'Diferencia Total')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>{fmtMoney(kpis.diferencia_total)}</Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('freight_kpi_tasa_disputa', 'Tasa Disputa')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {kpis.tasa_disputa != null ? `${Number(kpis.tasa_disputa).toFixed(1)}%` : '-'}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">{t('freight_kpi_pendientes', 'Facturas Pendientes')}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{kpis.facturas_pendientes ?? 0}</Typography>
          </Paper>
        </Stack>
      )}

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={t('freight_tab_facturas', 'Facturas')} icon={<ReceiptLongIcon />} iconPosition="start" />
          <Tab label={t('freight_tab_carrier', 'Rendimiento Transportistas')} icon={<LeaderboardIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Invoices */}
      {tabValue === 0 && (
        <>
          {/* Filters */}
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>{t('freight_filter_estado', 'Estado')}</InputLabel>
                <Select
                  value={filters.estado}
                  label={t('freight_filter_estado', 'Estado')}
                  onChange={(e) => handleFilterChange('estado', e.target.value)}
                >
                  {ESTADO_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label={t('freight_filter_transportista', 'Transportista CUIT')}
                value={filters.transportista_cuit}
                onChange={(e) => handleFilterChange('transportista_cuit', e.target.value)}
                sx={{ minWidth: 180 }}
              />
              <TextField
                size="small"
                type="date"
                label={t('freight_filter_desde', 'Desde')}
                value={filters.fecha_desde}
                onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                size="small"
                type="date"
                label={t('freight_filter_hasta', 'Hasta')}
                value={filters.fecha_hasta}
                onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </Paper>

          {/* Invoice Table */}
          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            aria-label={t('freight_title', 'Auditoria de Fletes')}
          >
            <SPMAgGrid
              columnDefs={invoiceColumnDefs}
              rowData={invoices}
              loading={loading}
              height={480}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="facturas_flete"
              emptyMessage={t('freight_empty', 'No hay facturas de flete registradas')}
              getRowId={(params) => String(params.data.id)}
            />
          </Paper>
        </>
      )}

      {/* Tab 1: Carrier Performance */}
      {tabValue === 1 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
          aria-label={t('freight_tab_carrier', 'Rendimiento Transportistas')}
        >
          <SPMAgGrid
            columnDefs={carrierColumnDefs}
            rowData={carrierPerf}
            loading={carrierLoading}
            height={480}
            pagination={true}
            paginationPageSize={20}
            enableQuickFilter={true}
            exportFileName="rendimiento_transportistas"
            emptyMessage={t('freight_carrier_empty', 'No hay datos de rendimiento')}
            getRowId={(params) => String(params.data.transportista_cuit || params.data.id)}
          />
        </Paper>
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <ReceiptLongIcon color="primary" />
            <span>{t('freight_new', 'Nueva Factura Flete')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('freight_field_numero', 'Numero Factura')}
              value={invoiceForm.numero_factura}
              onChange={(e) => handleInvoiceFormChange('numero_factura', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('freight_field_transportista', 'Transportista CUIT')}
              value={invoiceForm.transportista_cuit}
              onChange={(e) => handleInvoiceFormChange('transportista_cuit', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('freight_field_monto', 'Monto Facturado')}
              type="number"
              value={invoiceForm.monto_facturado}
              onChange={(e) => handleInvoiceFormChange('monto_facturado', e.target.value)}
              fullWidth
              required
              size="small"
              inputProps={{ min: 0, step: 0.01 }}
            />
            <TextField
              label={t('freight_field_concepto', 'Concepto')}
              value={invoiceForm.concepto}
              onChange={(e) => handleInvoiceFormChange('concepto', e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label={t('freight_field_fecha', 'Fecha Factura')}
              type="date"
              value={invoiceForm.fecha_factura}
              onChange={(e) => handleInvoiceFormChange('fecha_factura', e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={submitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateInvoice}
            disabled={submitting || !invoiceForm.numero_factura.trim() || !invoiceForm.transportista_cuit.trim() || !invoiceForm.monto_facturado}
            startIcon={submitting && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveOpen} onClose={() => setApproveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <CheckIcon color="success" />
            <span>{t('freight_aprobar_title', 'Aprobar Factura')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {approveInvoice && (
              <Typography variant="body2" color="text.secondary">
                {t('freight_approve_factura', 'Factura')}: {approveInvoice.numero_factura} - {t('freight_approve_monto_orig', 'Monto original')}: {fmtMoney(approveInvoice.monto_facturado)}
              </Typography>
            )}
            <TextField
              label={t('freight_field_monto_aprobado', 'Monto Aprobado')}
              type="number"
              value={approveAmount}
              onChange={(e) => setApproveAmount(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setApproveOpen(false)} disabled={approving}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleApproveSubmit}
            disabled={approving}
            startIcon={approving && <CircularProgress size={16} />}
          >
            {t('freight_aprobar', 'Aprobar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={disputeOpen} onClose={() => setDisputeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <ReportProblemIcon color="error" />
            <span>{t('freight_disputar_title', 'Disputar Factura')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {disputeInvoice && (
              <Typography variant="body2" color="text.secondary">
                {t('freight_approve_factura', 'Factura')}: {disputeInvoice.numero_factura}
              </Typography>
            )}
            <TextField
              label={t('freight_field_razon', 'Razon de la Disputa')}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              fullWidth
              required
              multiline
              rows={3}
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDisputeOpen(false)} disabled={disputing}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDisputeSubmit}
            disabled={disputing || !disputeReason.trim()}
            startIcon={disputing && <CircularProgress size={16} />}
          >
            {t('freight_disputar', 'Disputar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
