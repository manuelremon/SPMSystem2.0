/**
 * ReturnsList - RMA/Returns list page
 *
 * Displays returns with KPI cards, filters by estado/tipo/proveedor,
 * and paginated table. Allows creating new returns or from NCR.
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
import AddIcon from '@mui/icons-material/Add';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import BugReportIcon from '@mui/icons-material/BugReport';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PercentIcon from '@mui/icons-material/Percent';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'pending_approval', label: 'Pend. Aprobacion' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'in_transit', label: 'En Transito' },
  { value: 'received_by_supplier', label: 'Recibido' },
  { value: 'credit_issued', label: 'Credito Emitido' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const ESTADO_COLORS = {
  draft: 'default',
  pending_approval: 'warning',
  approved: 'info',
  in_transit: 'info',
  received_by_supplier: 'success',
  credit_issued: 'success',
  closed: 'default',
  cancelled: 'error',
};

const TIPO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'defectuoso', label: 'Defectuoso' },
  { value: 'excedente', label: 'Excedente' },
  { value: 'incorrecto', label: 'Incorrecto' },
  { value: 'garantia', label: 'Garantia' },
];

const TIPO_COLORS = {
  defectuoso: 'error',
  excedente: 'warning',
  incorrecto: 'info',
  garantia: 'default',
};

export default function ReturnsList() {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const navigate = useNavigate();

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ estado: '', tipo: '', proveedor_cuit: '' });
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // NCR dialog
  const [ncrOpen, setNcrOpen] = useState(false);
  const [ncrId, setNcrId] = useState('');
  const [creatingFromNcr, setCreatingFromNcr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = { page, per_page: 20 };
        if (filters.estado) params.estado = filters.estado;
        if (filters.tipo) params.tipo = filters.tipo;
        if (filters.proveedor_cuit) params.proveedor_cuit = filters.proveedor_cuit;
        const [retRes, kpiRes] = await Promise.all([
          api.get('/returns', { params }),
          api.get('/returns/kpis')
        ]);
        if (cancelled) return;
        if (retRes.data?.ok) setReturns(retRes.data.returns || retRes.data.items || []);
        if (kpiRes.data?.ok) setKpis(kpiRes.data);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('returns_error_load', 'Error al cargar devoluciones'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [page, filters, reloadTick]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1);
  }, []);

  const handleCreateFromNcr = useCallback(async () => {
    if (!ncrId) {
      toastRef.current.warning(tRef.current('returns_ncr_required', 'Ingrese ID de NCR'));
      return;
    }
    setCreatingFromNcr(true);
    try {
      const res = await api.post('/returns/from-ncr', { ncr_id: Number(ncrId) });
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('returns_created_ncr', 'Devolucion creada desde NCR'));
        setNcrOpen(false);
        setNcrId('');
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('returns_error_ncr', 'Error al crear desde NCR'));
    } finally {
      setCreatingFromNcr(false);
    }
  }, [ncrId]);

  const columnDefs = useMemo(() => [
    { field: 'numero_rma', headerName: t('returns_numero', 'N. RMA'), flex: 1, minWidth: 140 },
    {
      field: 'tipo', headerName: t('returns_tipo', 'Tipo'), width: 130,
      cellRenderer: (p) => <Chip size="small" label={TIPO_OPTIONS.find(o => o.value === p.value)?.label || p.value} color={TIPO_COLORS[p.value] || 'default'} variant="outlined" />,
    },
    { field: 'proveedor_cuit', headerName: t('returns_proveedor', 'Proveedor CUIT'), width: 150 },
    { field: 'motivo', headerName: t('returns_motivo', 'Motivo'), flex: 2, minWidth: 180 },
    {
      field: 'estado', headerName: t('returns_estado', 'Estado'), width: 160,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={ESTADO_OPTIONS.find(o => o.value === p.value)?.label || p.value}
          color={ESTADO_COLORS[p.value] || 'default'}
        />
      ),
    },
    {
      field: 'monto_credito_esperado', headerName: t('returns_credito', 'Credito Esperado'), width: 150,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'created_at', headerName: t('returns_fecha', 'Fecha'), width: 110,
      valueFormatter: (p) => formatDate(p.value),
    },
  ], [t]);

  const KpiCard = ({ icon, label, value, color }) => (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, flex: 1, minWidth: 180 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
        {icon}
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </Stack>
      <Typography variant="h5" sx={{ fontWeight: 700, color: color || 'text.primary' }}>
        {value != null ? value : '--'}
      </Typography>
    </Paper>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" gap={1}>
          <AssignmentReturnIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('returns_title', 'Devoluciones (RMA)')}
          </Typography>
        </Stack>
        <Stack direction="row" gap={1}>
          <Button variant="outlined" startIcon={<BugReportIcon />} onClick={() => setNcrOpen(true)}>
            {t('returns_from_ncr', 'Desde NCR')}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/operations/returns/new')}>
            {t('returns_new', 'Nueva Devolucion')}
          </Button>
        </Stack>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <KpiCard
            icon={<ReceiptLongIcon fontSize="small" sx={{ color: 'info.main' }} />}
            label={t('returns_kpi_total', 'Total Devoluciones')}
            value={kpis.total}
            color="info.main"
          />
          <KpiCard
            icon={<AttachMoneyIcon fontSize="small" sx={{ color: 'warning.main' }} />}
            label={t('returns_kpi_esperado', 'Credito Esperado')}
            value={kpis.monto_credito_esperado != null ? formatCurrency(kpis.monto_credito_esperado) : null}
            color="warning.main"
          />
          <KpiCard
            icon={<AttachMoneyIcon fontSize="small" sx={{ color: 'success.main' }} />}
            label={t('returns_kpi_recibido', 'Credito Recibido')}
            value={kpis.monto_credito_recibido != null ? formatCurrency(kpis.monto_credito_recibido) : null}
            color="success.main"
          />
          <KpiCard
            icon={<PercentIcon fontSize="small" sx={{ color: 'primary.main' }} />}
            label={t('returns_kpi_tasa', 'Tasa Recuperacion')}
            value={kpis.tasa_recuperacion != null ? `${kpis.tasa_recuperacion.toFixed(1)}%` : null}
            color="primary.main"
          />
        </Stack>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('returns_filter_estado', 'Estado')}</InputLabel>
            <Select value={filters.estado} label={t('returns_filter_estado', 'Estado')} onChange={(e) => handleFilterChange('estado', e.target.value)}>
              {ESTADO_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('returns_filter_tipo', 'Tipo')}</InputLabel>
            <Select value={filters.tipo} label={t('returns_filter_tipo', 'Tipo')} onChange={(e) => handleFilterChange('tipo', e.target.value)}>
              {TIPO_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label={t('returns_filter_proveedor', 'Proveedor CUIT')} value={filters.proveedor_cuit} onChange={(e) => handleFilterChange('proveedor_cuit', e.target.value)} sx={{ minWidth: 180 }} />
        </Stack>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }} aria-label={t('returns_title', 'Devoluciones')}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={returns}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={(row) => navigate(`/operations/returns/${row.id}`)}
          exportFileName="devoluciones"
          emptyMessage={t('returns_empty', 'No hay devoluciones registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* NCR Dialog */}
      <Dialog open={ncrOpen} onClose={() => setNcrOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('returns_from_ncr', 'Crear Devolucion desde NCR')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('returns_ncr_id', 'ID de NCR')}
            type="number"
            value={ncrId}
            onChange={(e) => setNcrId(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNcrOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleCreateFromNcr} disabled={creatingFromNcr} startIcon={creatingFromNcr && <CircularProgress size={16} />}>
            {t('common_crear', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
