/**
 * ContractCompliance - Contract compliance dashboard
 *
 * Shows compliance KPIs (rate, non-compliant count, deviation),
 * checks table with filtering, and OC verification dialog.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatCurrency } from '../utils/formatters';

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
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VerifiedIcon from '@mui/icons-material/Verified';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PercentIcon from '@mui/icons-material/Percent';
import SearchIcon from '@mui/icons-material/Search';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

export default function ContractCompliance() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [kpis, setKpis] = useState(null);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ contrato_id: '', es_compliant: '' });
  const [processing, setProcessing] = useState(false);

  // Verify dialog
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [ocId, setOcId] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/compliance/dashboard');
      if (res.data?.ok) {
        setKpis(res.data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchChecks = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.contrato_id) params.contrato_id = filters.contrato_id;
      if (filters.es_compliant !== '') params.es_compliant = filters.es_compliant;
      const res = await api.get('/compliance/checks', { params });
      if (res.data?.ok) {
        setChecks(res.data.checks || res.data.items || []);
      }
    } catch {
      toast.error(t('compliance_error_load', 'Error al cargar verificaciones'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { fetchChecks(); }, [fetchChecks]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleVerify = useCallback(async () => {
    if (!ocId) {
      toast.warning(t('compliance_oc_required', 'Ingrese ID de Orden de Compra'));
      return;
    }
    setProcessing(true);
    try {
      const res = await api.post(`/compliance/check/${ocId}`);
      if (res.data?.ok) {
        toast.success(t('compliance_verified', 'OC verificada exitosamente'));
        setVerifyOpen(false);
        setOcId('');
        fetchChecks();
        fetchDashboard();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('compliance_error_verify', 'Error al verificar OC'));
    } finally {
      setProcessing(false);
    }
  }, [ocId, fetchChecks, fetchDashboard, t, toast]);

  const columnDefs = useMemo(() => [
    { field: 'contrato_id', headerName: t('compliance_contrato', 'Contrato ID'), width: 120 },
    { field: 'orden_compra_id', headerName: t('compliance_oc', 'OC ID'), width: 100 },
    { field: 'material_codigo', headerName: t('compliance_material', 'Material'), flex: 1, minWidth: 140 },
    {
      field: 'precio_contrato', headerName: t('compliance_precio_contrato', 'Precio Contrato'), width: 150,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'precio_real', headerName: t('compliance_precio_real', 'Precio Real'), width: 140,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'es_compliant', headerName: t('compliance_compliant', 'Cumple'), width: 110,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={p.value ? t('common_si', 'Si') : t('common_no', 'No')}
          color={p.value ? 'success' : 'error'}
        />
      ),
    },
    {
      field: 'desviacion_porcentaje', headerName: t('compliance_desviacion', 'Desviacion %'), width: 130,
      valueFormatter: (p) => p.value != null ? `${p.value.toFixed(2)}%` : '-',
      cellStyle: (p) => {
        if (p.value == null) return {};
        return { color: p.value > 0 ? 'var(--danger)' : p.value < 0 ? 'var(--success-text)' : 'inherit' };
      },
    },
  ], [t]);

  const KpiCard = ({ icon, label, value, color }) => (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', flex: 1, minWidth: 180 }}>
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
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
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
            {t('compliance_title', 'Cumplimiento Contractual')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<SearchIcon />} onClick={() => setVerifyOpen(true)}>
          {t('compliance_verify_oc', 'Verificar OC')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <KpiCard
            icon={<PercentIcon fontSize="small" sx={{ color: 'success.main' }} />}
            label={t('compliance_kpi_rate', 'Tasa de Cumplimiento')}
            value={kpis.compliant_pct != null ? `${kpis.compliant_pct.toFixed(1)}%` : null}
            color="success.main"
          />
          <KpiCard
            icon={<WarningAmberIcon fontSize="small" sx={{ color: 'error.main' }} />}
            label={t('compliance_kpi_non_compliant', 'No Cumplidos')}
            value={kpis.non_compliant_count}
            color="error.main"
          />
          <KpiCard
            icon={<VerifiedIcon fontSize="small" sx={{ color: 'info.main' }} />}
            label={t('compliance_kpi_desviacion', 'Desviacion Promedio')}
            value={kpis.desviacion_promedio != null ? `${kpis.desviacion_promedio.toFixed(2)}%` : null}
            color="info.main"
          />
        </Stack>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <TextField size="small" label={t('compliance_filter_contrato', 'Contrato ID')} value={filters.contrato_id} onChange={(e) => handleFilterChange('contrato_id', e.target.value)} sx={{ minWidth: 160 }} />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('compliance_filter_compliant', 'Cumplimiento')}</InputLabel>
            <Select value={filters.es_compliant} label={t('compliance_filter_compliant', 'Cumplimiento')} onChange={(e) => handleFilterChange('es_compliant', e.target.value)}>
              <MenuItem value="">{t('common_todos', 'Todos')}</MenuItem>
              <MenuItem value="true">{t('common_si', 'Si')}</MenuItem>
              <MenuItem value="false">{t('common_no', 'No')}</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }} aria-label={t('compliance_title', 'Cumplimiento Contractual')}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={checks}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          exportFileName="cumplimiento_contractual"
          emptyMessage={t('compliance_empty', 'No hay verificaciones registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Verify Dialog */}
      <Dialog open={verifyOpen} onClose={() => setVerifyOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('compliance_verify_oc', 'Verificar Orden de Compra')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('compliance_oc_id', 'ID de Orden de Compra')}
            type="number"
            value={ocId}
            onChange={(e) => setOcId(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerifyOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleVerify} disabled={processing} startIcon={processing && <CircularProgress size={16} />}>
            {t('common_verificar', 'Verificar')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
