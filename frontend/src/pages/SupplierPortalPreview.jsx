/**
 * SupplierPortalPreview - Preview of what suppliers see in their portal
 *
 * Select a proveedor_cuit to preview their portal view including
 * pending POs, ASNs, and shared forecasts displayed in AG-Grid tables.
 * Sprint 71
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
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const OC_ESTADO_COLORS = {
  pending: 'warning',
  confirmed: 'info',
  shipped: 'primary',
  delivered: 'success',
  cancelled: 'error',
};

const ASN_ESTADO_COLORS = {
  draft: 'default',
  sent: 'info',
  in_transit: 'primary',
  received: 'success',
  cancelled: 'error',
};

export default function SupplierPortalPreview() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [cuitInput, setCuitInput] = useState('');
  const [selectedCuit, setSelectedCuit] = useState('');

  const [pos, setPos] = useState([]);
  const [posLoading, setPosLoading] = useState(false);

  const [asns, setAsns] = useState([]);
  const [asnsLoading, setAsnsLoading] = useState(false);

  const [forecasts, setForecasts] = useState([]);
  const [forecastsLoading, setForecastsLoading] = useState(false);

  const handleSearch = useCallback(() => {
    const trimmed = cuitInput.trim();
    if (!trimmed) {
      toast.warning(t('portal_preview_cuit_required', 'Ingrese un CUIT de proveedor'));
      return;
    }
    setSelectedCuit(trimmed);
  }, [cuitInput, t, toast]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const fetchPOs = useCallback(async () => {
    if (!selectedCuit) return;
    setPosLoading(true);
    try {
      const res = await api.get('/supplier-portal/pos', { params: { proveedor_cuit: selectedCuit } });
      if (res.data?.ok) {
        setPos(res.data.pos || res.data.orders || res.data.items || []);
      }
    } catch {
      toast.error(t('portal_preview_error_pos', 'Error al cargar OCs'));
    } finally {
      setPosLoading(false);
    }
  }, [selectedCuit, t, toast]);

  const fetchASNs = useCallback(async () => {
    if (!selectedCuit) return;
    setAsnsLoading(true);
    try {
      const res = await api.get('/supplier-portal/asns', { params: { proveedor_cuit: selectedCuit } });
      if (res.data?.ok) {
        setAsns(res.data.asns || res.data.items || []);
      }
    } catch {
      toast.error(t('portal_preview_error_asns', 'Error al cargar ASNs'));
    } finally {
      setAsnsLoading(false);
    }
  }, [selectedCuit, t, toast]);

  const fetchForecasts = useCallback(async () => {
    if (!selectedCuit) return;
    setForecastsLoading(true);
    try {
      const res = await api.get('/supplier-portal/forecasts', { params: { proveedor_cuit: selectedCuit } });
      if (res.data?.ok) {
        setForecasts(res.data.forecasts || res.data.items || []);
      }
    } catch {
      toast.error(t('portal_preview_error_forecasts', 'Error al cargar forecasts'));
    } finally {
      setForecastsLoading(false);
    }
  }, [selectedCuit, t, toast]);

  useEffect(() => {
    if (selectedCuit) {
      fetchPOs();
      fetchASNs();
      fetchForecasts();
    }
  }, [selectedCuit, fetchPOs, fetchASNs, fetchForecasts]);

  // Column defs
  const poColumnDefs = useMemo(() => [
    { field: 'numero_oc', headerName: t('portal_po_numero', 'Numero OC'), flex: 1, minWidth: 140 },
    {
      field: 'fecha',
      headerName: t('portal_po_fecha', 'Fecha'),
      width: 120,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'estado',
      headerName: t('portal_po_estado', 'Estado'),
      width: 130,
      cellRenderer: (p) => (
        <Chip size="small" label={p.value || '-'} color={OC_ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    {
      field: 'monto_total',
      headerName: t('portal_po_monto', 'Monto'),
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'items_count',
      headerName: t('portal_po_items', 'Items'),
      width: 90,
      type: 'numericColumn',
    },
  ], [t]);

  const asnColumnDefs = useMemo(() => [
    { field: 'numero_asn', headerName: t('portal_asn_numero', 'Numero ASN'), flex: 1, minWidth: 140 },
    { field: 'numero_oc', headerName: t('portal_asn_oc', 'OC'), flex: 1, minWidth: 130 },
    {
      field: 'estado',
      headerName: t('portal_asn_estado', 'Estado'),
      width: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={p.value || '-'} color={ASN_ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    {
      field: 'fecha_envio',
      headerName: t('portal_asn_fecha', 'Fecha Envio'),
      width: 130,
      valueFormatter: (p) => formatDate(p.value),
    },
    { field: 'transportista', headerName: t('portal_asn_transportista', 'Transportista'), flex: 1, minWidth: 140 },
  ], [t]);

  const forecastColumnDefs = useMemo(() => [
    { field: 'material_codigo', headerName: t('portal_fc_material', 'Material'), flex: 1, minWidth: 150 },
    { field: 'periodo', headerName: t('portal_fc_periodo', 'Periodo'), width: 120 },
    {
      field: 'cantidad',
      headerName: t('portal_fc_cantidad', 'Cantidad'),
      width: 120,
      type: 'numericColumn',
    },
    { field: 'fuente', headerName: t('portal_fc_fuente', 'Fuente'), width: 120 },
  ], [t]);

  const isAnyLoading = posLoading || asnsLoading || forecastsLoading;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
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
        <Typography
          variant="h5"
          component="h1"
          fontWeight={700}
          textTransform="uppercase"
          letterSpacing="0.05em"
          color="text.primary"
        >
          {t('portal_preview_title', 'Vista Previa Portal Proveedor')}
        </Typography>
      </Box>

      {/* Proveedor Selector */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>
          {t('portal_preview_select', 'Seleccionar Proveedor para Vista Previa')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'flex-end' }}>
          <TextField
            label={t('portal_preview_cuit', 'CUIT Proveedor')}
            value={cuitInput}
            onChange={(e) => setCuitInput(e.target.value)}
            onKeyDown={handleKeyDown}
            size="small"
            sx={{ minWidth: 240 }}
            placeholder="20-12345678-9"
          />
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            disabled={!cuitInput.trim()}
          >
            {t('portal_preview_search', 'Ver Portal')}
          </Button>
        </Stack>
      </Paper>

      {/* Loading indicator */}
      {isAnyLoading && !selectedCuit && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* No selection message */}
      {!selectedCuit && (
        <Alert severity="info">
          {t('portal_preview_hint', 'Ingrese un CUIT de proveedor para ver su portal')}
        </Alert>
      )}

      {/* Portal Preview Content */}
      {selectedCuit && (
        <>
          <Alert severity="info">
            {t('portal_preview_viewing', 'Vista previa del portal para proveedor')}: <strong>{selectedCuit}</strong>
          </Alert>

          {/* POs Section */}
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <ReceiptLongIcon fontSize="small" sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle2">{t('portal_preview_pos', 'OCs Pendientes')}</Typography>
              </Stack>
            </Box>
            <SPMAgGrid
              columnDefs={poColumnDefs}
              rowData={pos}
              loading={posLoading}
              height={280}
              pagination={true}
              paginationPageSize={10}
              enableQuickFilter={false}
              exportFileName={`portal_pos_${selectedCuit}`}
              emptyMessage={t('portal_preview_no_pos', 'Sin ordenes de compra pendientes')}
              getRowId={(params) => String(params.data.id || params.data.numero_oc)}
            />
          </Paper>

          {/* ASNs Section */}
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <LocalShippingIcon fontSize="small" sx={{ color: 'info.main' }} />
                <Typography variant="subtitle2">{t('portal_preview_asns', 'ASNs')}</Typography>
              </Stack>
            </Box>
            <SPMAgGrid
              columnDefs={asnColumnDefs}
              rowData={asns}
              loading={asnsLoading}
              height={280}
              pagination={true}
              paginationPageSize={10}
              enableQuickFilter={false}
              exportFileName={`portal_asns_${selectedCuit}`}
              emptyMessage={t('portal_preview_no_asns', 'Sin ASNs registrados')}
              getRowId={(params) => String(params.data.id || params.data.numero_asn)}
            />
          </Paper>

          {/* Forecasts Section */}
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <TrendingUpIcon fontSize="small" sx={{ color: 'success.main' }} />
                <Typography variant="subtitle2">{t('portal_preview_forecasts', 'Forecasts Compartidos')}</Typography>
              </Stack>
            </Box>
            <SPMAgGrid
              columnDefs={forecastColumnDefs}
              rowData={forecasts}
              loading={forecastsLoading}
              height={280}
              pagination={true}
              paginationPageSize={10}
              enableQuickFilter={false}
              exportFileName={`portal_forecasts_${selectedCuit}`}
              emptyMessage={t('portal_preview_no_forecasts', 'Sin forecasts compartidos')}
              getRowId={(params) => String(params.data.id || `${params.data.material_codigo}-${params.data.periodo}`)}
            />
          </Paper>
        </>
      )}
      </Box>
    </Box>
  );
}
