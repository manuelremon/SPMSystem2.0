/**
 * Contracts - Contract list page with filters and paginated table
 *
 * Displays all contracts with filtering by estado, proveedor, tipo, and date range.
 * Navigates to detail or creation pages.
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
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'under_negotiation', label: 'En Negociacion' },
  { value: 'active', label: 'Activo' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'expired', label: 'Vencido' },
  { value: 'terminated', label: 'Terminado' },
];

const TIPO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'blanket_po', label: 'Orden Abierta' },
  { value: 'fixed_price', label: 'Precio Fijo' },
  { value: 'time_materials', label: 'Tiempo y Materiales' },
  { value: 'framework', label: 'Marco' },
];

const ESTADO_COLORS = {
  draft: 'default',
  under_negotiation: 'warning',
  active: 'success',
  suspended: 'warning',
  expired: 'error',
  terminated: 'error',
};

const TIPO_LABELS = {
  blanket_po: 'Orden Abierta',
  fixed_price: 'Precio Fijo',
  time_materials: 'T&M',
  framework: 'Marco',
};

export default function Contracts() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    estado: '',
    proveedor: '',
    tipo: '',
    fecha_desde: '',
    fecha_hasta: '',
  });

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.estado) params.estado = filters.estado;
      if (filters.proveedor) params.proveedor = filters.proveedor;
      if (filters.tipo) params.tipo = filters.tipo;
      if (filters.fecha_desde) params.fecha_desde = filters.fecha_desde;
      if (filters.fecha_hasta) params.fecha_hasta = filters.fecha_hasta;
      const res = await api.get('/contracts', { params });
      if (res.data?.ok) {
        setContracts(res.data.contracts || res.data.items || []);
      }
    } catch {
      toast.error(t('contracts_error_load', 'Error al cargar contratos'));
    } finally {
      setLoading(false);
    }
  }, [filters, t, toast]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const columnDefs = useMemo(() => [
    { field: 'numero_contrato', headerName: t('contracts_numero', 'N. Contrato'), flex: 1, minWidth: 140 },
    { field: 'proveedor_nombre', headerName: t('contracts_proveedor', 'Proveedor'), flex: 2, minWidth: 180 },
    {
      field: 'tipo', headerName: t('contracts_tipo', 'Tipo'), width: 130,
      cellRenderer: (p) => <Chip size="small" label={TIPO_LABELS[p.value] || p.value} variant="outlined" />,
    },
    {
      field: 'estado', headerName: t('contracts_estado', 'Estado'), width: 150,
      cellRenderer: (p) => (
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Chip size="small" label={ESTADO_OPTIONS.find(o => o.value === p.value)?.label || p.value} color={ESTADO_COLORS[p.value] || 'default'} />
          {p.data?.alerta_vencimiento === 1 && <WarningAmberIcon fontSize="small" sx={{ color: 'warning.main' }} />}
        </Stack>
      ),
    },
    {
      field: 'fecha_vencimiento', headerName: t('contracts_vencimiento', 'Vencimiento'), width: 120,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'valor_total', headerName: t('contracts_valor', 'Valor Total'), width: 140,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
  ], [t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" gap={1}>
          <DescriptionIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('contracts_title', 'Contratos')}
          </Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/procurement/contracts/new')}>
          {t('contracts_new', 'Nuevo Contrato')}
        </Button>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('contracts_filter_estado', 'Estado')}</InputLabel>
            <Select value={filters.estado} label={t('contracts_filter_estado', 'Estado')} onChange={(e) => handleFilterChange('estado', e.target.value)}>
              {ESTADO_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label={t('contracts_filter_proveedor', 'Proveedor')} value={filters.proveedor} onChange={(e) => handleFilterChange('proveedor', e.target.value)} sx={{ minWidth: 180 }} />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('contracts_filter_tipo', 'Tipo')}</InputLabel>
            <Select value={filters.tipo} label={t('contracts_filter_tipo', 'Tipo')} onChange={(e) => handleFilterChange('tipo', e.target.value)}>
              {TIPO_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" type="date" label={t('contracts_filter_desde', 'Desde')} value={filters.fecha_desde} onChange={(e) => handleFilterChange('fecha_desde', e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label={t('contracts_filter_hasta', 'Hasta')} value={filters.fecha_hasta} onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)} InputLabelProps={{ shrink: true }} />
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }} aria-label={t('contracts_title', 'Contratos')}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={contracts}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={(row) => navigate(`/procurement/contracts/${row.id}`)}
          exportFileName="contratos"
          emptyMessage={t('contracts_empty', 'No hay contratos registrados')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>
    </Box>
  );
}
