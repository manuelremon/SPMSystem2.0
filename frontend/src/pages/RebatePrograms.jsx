/**
 * RebatePrograms - Rebate programs and claims management
 *
 * Tabbed view with Programs and Claims. Programs can be created
 * and rebates calculated. Claims can have their status updated.
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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
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
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalculateIcon from '@mui/icons-material/Calculate';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const PROGRAMA_ESTADO_COLORS = {
  draft: 'default',
  active: 'success',
  suspended: 'warning',
  expired: 'error',
  closed: 'default',
};

const CLAIM_ESTADO_COLORS = {
  draft: 'default',
  claimed: 'info',
  approved: 'success',
  paid: 'success',
  rejected: 'error',
};

const TIPO_OPTIONS = [
  { value: 'volume', label: 'Volumen' },
  { value: 'growth', label: 'Crecimiento' },
  { value: 'mix', label: 'Mix de Productos' },
  { value: 'loyalty', label: 'Fidelidad' },
];

const INITIAL_PROGRAM = {
  nombre: '',
  contrato_id: '',
  tipo: 'volume',
  umbral: '',
  porcentaje_rebate: '',
  periodo_desde: '',
  periodo_hasta: '',
};

export default function RebatePrograms() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [currentTab, setCurrentTab] = useState(0);
  const [programs, setPrograms] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [processing, setProcessing] = useState(false);

  // New program dialog
  const [programOpen, setProgramOpen] = useState(false);
  const [programForm, setProgramForm] = useState(INITIAL_PROGRAM);

  const fetchPrograms = useCallback(async () => {
    try {
      setLoadingPrograms(true);
      const res = await api.get('/compliance/rebates/programs');
      if (res.data?.ok) {
        setPrograms(res.data.programs || res.data.items || []);
      }
    } catch {
      toast.error(t('rebates_error_programs', 'Error al cargar programas'));
    } finally {
      setLoadingPrograms(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClaims = useCallback(async () => {
    try {
      setLoadingClaims(true);
      const res = await api.get('/compliance/rebates/claims');
      if (res.data?.ok) {
        setClaims(res.data.claims || res.data.items || []);
      }
    } catch {
      toast.error(t('rebates_error_claims', 'Error al cargar claims'));
    } finally {
      setLoadingClaims(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchPrograms(); }, [fetchPrograms]);
  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const handleCreateProgram = useCallback(async () => {
    if (!programForm.nombre || !programForm.umbral || !programForm.porcentaje_rebate) {
      toast.warning(t('rebates_form_required', 'Complete los campos requeridos'));
      return;
    }
    setProcessing(true);
    try {
      const res = await api.post('/compliance/rebates/programs', {
        ...programForm,
        contrato_id: programForm.contrato_id ? Number(programForm.contrato_id) : null,
        umbral: Number(programForm.umbral),
        porcentaje_rebate: Number(programForm.porcentaje_rebate),
      });
      if (res.data?.ok) {
        toast.success(t('rebates_program_created', 'Programa creado'));
        setProgramOpen(false);
        setProgramForm(INITIAL_PROGRAM);
        fetchPrograms();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('rebates_error_create', 'Error al crear programa'));
    } finally {
      setProcessing(false);
    }
  }, [programForm, fetchPrograms, t, toast]);

  const handleCalculateRebate = useCallback(async (programId) => {
    try {
      const res = await api.post(`/compliance/rebates/calculate/${programId}`);
      if (res.data?.ok) {
        toast.success(t('rebates_calculated', 'Rebate calculado'));
        fetchClaims();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('rebates_error_calculate', 'Error al calcular rebate'));
    }
  }, [fetchClaims, t, toast]);

  const handleClaimStatus = useCallback(async (claimId, estado) => {
    try {
      const res = await api.put(`/compliance/rebates/claims/${claimId}/status`, { estado });
      if (res.data?.ok) {
        toast.success(t('rebates_claim_updated', 'Claim actualizado'));
        fetchClaims();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('rebates_error_claim', 'Error al actualizar claim'));
    }
  }, [fetchClaims, t, toast]);

  const programColumns = useMemo(() => [
    { field: 'nombre', headerName: t('rebates_nombre', 'Nombre'), flex: 2, minWidth: 180 },
    { field: 'contrato_id', headerName: t('rebates_contrato', 'Contrato'), width: 100 },
    {
      field: 'tipo', headerName: t('rebates_tipo', 'Tipo'), width: 130,
      cellRenderer: (p) => <Chip size="small" label={TIPO_OPTIONS.find(o => o.value === p.value)?.label || p.value} variant="outlined" />,
    },
    {
      field: 'umbral', headerName: t('rebates_umbral', 'Umbral'), width: 120,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'porcentaje_rebate', headerName: t('rebates_porcentaje', 'Rebate %'), width: 100,
      valueFormatter: (p) => p.value != null ? `${p.value}%` : '-',
    },
    {
      field: 'estado', headerName: t('rebates_estado', 'Estado'), width: 120,
      cellRenderer: (p) => <Chip size="small" label={p.value} color={PROGRAMA_ESTADO_COLORS[p.value] || 'default'} />,
    },
    {
      field: 'periodo_desde', headerName: t('rebates_periodo', 'Periodo'), width: 180,
      valueGetter: (p) => `${formatDate(p.data?.periodo_desde)} - ${formatDate(p.data?.periodo_hasta)}`,
    },
    {
      field: 'acciones', headerName: t('rebates_acciones', 'Acciones'), width: 150,
      sortable: false,
      filter: false,
      cellRenderer: (p) => (
        <Button
          size="small"
          variant="outlined"
          startIcon={<CalculateIcon />}
          onClick={(e) => { e.stopPropagation(); handleCalculateRebate(p.data.id); }}
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
        >
          {t('rebates_calculate', 'Calcular')}
        </Button>
      ),
    },
  ], [t, handleCalculateRebate]);

  const claimColumns = useMemo(() => [
    { field: 'programa_nombre', headerName: t('rebates_programa', 'Programa'), flex: 2, minWidth: 180 },
    { field: 'periodo', headerName: t('rebates_claim_periodo', 'Periodo'), width: 140 },
    {
      field: 'monto_base', headerName: t('rebates_monto_base', 'Monto Base'), width: 150,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'monto_rebate', headerName: t('rebates_monto_rebate', 'Monto Rebate'), width: 150,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
    {
      field: 'estado', headerName: t('rebates_claim_estado', 'Estado'), width: 120,
      cellRenderer: (p) => <Chip size="small" label={p.value} color={CLAIM_ESTADO_COLORS[p.value] || 'default'} />,
    },
    {
      field: 'acciones', headerName: t('rebates_acciones', 'Acciones'), width: 220,
      sortable: false,
      filter: false,
      cellRenderer: (p) => {
        const estado = p.data?.estado;
        const actions = [];
        if (estado === 'draft' || estado === 'claimed') {
          actions.push(
            <Button key="claim" size="small" variant="outlined" color="info" onClick={(e) => { e.stopPropagation(); handleClaimStatus(p.data.id, estado === 'draft' ? 'claimed' : 'approved'); }} sx={{ textTransform: 'none', fontSize: '0.7rem', mr: 0.5 }}>
              {estado === 'draft' ? t('rebates_claim_btn', 'Reclamar') : t('rebates_approve_btn', 'Aprobar')}
            </Button>
          );
        }
        if (estado === 'approved') {
          actions.push(
            <Button key="pay" size="small" variant="outlined" color="success" onClick={(e) => { e.stopPropagation(); handleClaimStatus(p.data.id, 'paid'); }} sx={{ textTransform: 'none', fontSize: '0.7rem' }}>
              {t('rebates_paid_btn', 'Marcar Pagado')}
            </Button>
          );
        }
        return <Stack direction="row" gap={0.5}>{actions}</Stack>;
      },
    },
  ], [t, handleClaimStatus]);

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
            {t('rebates_title', 'Programas de Rebate')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setProgramOpen(true)}>
          {t('rebates_new_program', 'Nuevo Programa')}
        </Button>
      </Stack>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={(_, val) => setCurrentTab(val)} aria-label={t('rebates_tabs', 'Secciones de Rebate')} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label={t('rebates_tab_programs', 'Programas')} />
          <Tab label={t('rebates_tab_claims', 'Claims')} />
        </Tabs>

        <Box sx={{ p: 0 }}>
          {currentTab === 0 && (
            <SPMAgGrid
              columnDefs={programColumns}
              rowData={programs}
              loading={loadingPrograms}
              height={500}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="programas_rebate"
              emptyMessage={t('rebates_no_programs', 'No hay programas registrados')}
              getRowId={(params) => String(params.data.id)}
            />
          )}
          {currentTab === 1 && (
            <SPMAgGrid
              columnDefs={claimColumns}
              rowData={claims}
              loading={loadingClaims}
              height={500}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="claims_rebate"
              emptyMessage={t('rebates_no_claims', 'No hay claims registrados')}
              getRowId={(params) => String(params.data.id)}
            />
          )}
        </Box>
      </Paper>

      {/* New Program Dialog */}
      <Dialog open={programOpen} onClose={() => setProgramOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('rebates_new_program', 'Nuevo Programa de Rebate')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('rebates_nombre', 'Nombre')}
              value={programForm.nombre}
              onChange={(e) => setProgramForm(prev => ({ ...prev, nombre: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label={t('rebates_contrato', 'Contrato ID (opcional)')}
              type="number"
              value={programForm.contrato_id}
              onChange={(e) => setProgramForm(prev => ({ ...prev, contrato_id: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>{t('rebates_tipo', 'Tipo')}</InputLabel>
              <Select value={programForm.tipo} label={t('rebates_tipo', 'Tipo')} onChange={(e) => setProgramForm(prev => ({ ...prev, tipo: e.target.value }))}>
                {TIPO_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label={t('rebates_umbral', 'Umbral (monto minimo)')}
              type="number"
              value={programForm.umbral}
              onChange={(e) => setProgramForm(prev => ({ ...prev, umbral: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label={t('rebates_porcentaje', 'Porcentaje de Rebate')}
              type="number"
              inputProps={{ min: 0, max: 100, step: 0.1 }}
              value={programForm.porcentaje_rebate}
              onChange={(e) => setProgramForm(prev => ({ ...prev, porcentaje_rebate: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label={t('rebates_desde', 'Periodo Desde')}
              type="date"
              value={programForm.periodo_desde}
              onChange={(e) => setProgramForm(prev => ({ ...prev, periodo_desde: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label={t('rebates_hasta', 'Periodo Hasta')}
              type="date"
              value={programForm.periodo_hasta}
              onChange={(e) => setProgramForm(prev => ({ ...prev, periodo_hasta: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgramOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleCreateProgram} disabled={processing} startIcon={processing && <CircularProgress size={16} />}>
            {t('common_crear', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
