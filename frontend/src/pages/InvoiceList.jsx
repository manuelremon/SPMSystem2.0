/**
 * InvoiceList - Supplier invoice list page with 3-way matching status
 *
 * Displays all invoices with filtering by estado and proveedor_cuit.
 * Shows KPI cards for matching metrics at the top.
 * Row click navigates to invoice detail page.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import CircularProgress from '@mui/material/CircularProgress';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddIcon from '@mui/icons-material/Add';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'matched', label: 'Matched' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'paid', label: 'Pagada' },
];

const ESTADO_COLORS = {
  pending: 'default',
  matched: 'success',
  disputed: 'error',
  approved: 'info',
  paid: 'success',
};

// Labels via i18n — use t() in column renderer

export default function InvoiceList() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [filters, setFilters] = useState({
    estado: '',
    proveedor_cuit: '',
    search: '',
  });

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.estado) params.estado = filters.estado;
      if (filters.proveedor_cuit) params.proveedor_cuit = filters.proveedor_cuit;
      if (filters.search) params.search = filters.search;
      const res = await api.get('/matching/invoices', { params });
      if (res.data?.ok) {
        setInvoices(res.data.invoices || res.data.items || []);
      }
    } catch {
      toast.error(t('invoice_error_load', 'Error al cargar facturas'));
    } finally {
      setLoading(false);
    }
  }, [filters, t, toast]);

  const fetchKpis = useCallback(async () => {
    try {
      setKpisLoading(true);
      const res = await api.get('/matching/kpis');
      if (res.data?.ok) {
        setKpis(res.data.kpis || res.data);
      }
    } catch {
      // KPIs are non-critical, fail silently
    } finally {
      setKpisLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchKpis(); }, [fetchKpis]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const columnDefs = useMemo(() => [
    { field: 'numero_factura', headerName: t('invoice_numero', 'N. Factura'), flex: 1, minWidth: 140 },
    { field: 'proveedor_cuit', headerName: t('invoice_proveedor_cuit', 'CUIT Proveedor'), flex: 1, minWidth: 140 },
    {
      field: 'monto_total', headerName: t('invoice_monto', 'Monto Total'), width: 150,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'fecha_factura', headerName: t('invoice_fecha', 'Fecha Factura'), width: 130,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'estado', headerName: t('invoice_estado', 'Estado'), width: 140,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={t(`invoice_estado_${p.value}`, p.value)}
          color={ESTADO_COLORS[p.value] || 'default'}
        />
      ),
    },
    { field: 'tipo_comprobante', headerName: t('invoice_tipo', 'Tipo Comprobante'), width: 140 },
  ], [t]);

  const kpiCards = [
    {
      label: t('invoice_kpi_total', 'Total Facturas'),
      value: kpis?.total_facturas ?? '-',
      color: 'primary.main',
    },
    {
      label: t('invoice_kpi_matched', '% Matched'),
      value: kpis?.matched_pct != null ? `${Number(kpis.matched_pct).toFixed(1)}%` : '-',
      color: 'success.main',
    },
    {
      label: t('invoice_kpi_disputed', '% Disputed'),
      value: kpis?.disputed_pct != null ? `${Number(kpis.disputed_pct).toFixed(1)}%` : '-',
      color: 'error.main',
    },
    {
      label: t('invoice_kpi_pending', 'Pendientes'),
      value: kpis?.pending_count ?? '-',
      color: 'warning.main',
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" gap={1}>
          <ReceiptLongIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('invoice_title', 'Facturas de Proveedores')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/procurement/invoices/new')}
        >
          {t('invoice_new', 'Nueva Factura')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        {kpiCards.map((kpi) => (
          <Paper
            key={kpi.label}
            elevation={0}
            sx={{
              flex: 1,
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {kpi.label}
            </Typography>
            {kpisLoading ? (
              <CircularProgress size={20} sx={{ mt: 0.5 }} />
            ) : (
              <Typography variant="h5" sx={{ fontWeight: 700, color: kpi.color, mt: 0.5 }}>
                {kpi.value}
              </Typography>
            )}
          </Paper>
        ))}
      </Stack>

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <TextField
            size="small"
            label={t('invoice_filter_search', 'Buscar')}
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('invoice_filter_estado', 'Estado')}</InputLabel>
            <Select
              value={filters.estado}
              label={t('invoice_filter_estado', 'Estado')}
              onChange={(e) => handleFilterChange('estado', e.target.value)}
            >
              {ESTADO_OPTIONS.map(o => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t('invoice_filter_cuit', 'CUIT Proveedor')}
            value={filters.proveedor_cuit}
            onChange={(e) => handleFilterChange('proveedor_cuit', e.target.value)}
            sx={{ minWidth: 180 }}
          />
        </Stack>
      </Paper>

      {/* Data Table */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider' }}
        aria-label={t('invoice_title', 'Facturas de Proveedores')}
      >
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={invoices}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={(row) => navigate(`/procurement/invoices/${row.id}`)}
          exportFileName="facturas"
          emptyMessage={t('invoice_empty', 'No hay facturas registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>
    </Box>
  );
}
