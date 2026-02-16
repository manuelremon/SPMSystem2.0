/**
 * OnboardingList - Supplier Onboarding Management
 *
 * KPI cards (pending, approved this month, avg score, expired docs),
 * AG-Grid with status/rubro badges, filters, and create dialog.
 * Sprint 81
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

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
import Grid from '@mui/material/Grid';
import AddIcon from '@mui/icons-material/Add';
import BusinessIcon from '@mui/icons-material/Business';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import WarningIcon from '@mui/icons-material/Warning';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'submitted', label: 'Enviado' },
  { value: 'under_review', label: 'En Revisión' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'active', label: 'Activo' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'suspended', label: 'Suspendido' },
];

const ESTADO_COLORS = {
  draft: 'default',
  submitted: 'info',
  under_review: 'warning',
  approved: 'success',
  active: 'success',
  rejected: 'error',
  suspended: 'warning',
};

const ESTADO_LABELS = {
  draft: 'Borrador',
  submitted: 'Enviado',
  under_review: 'En Revisión',
  approved: 'Aprobado',
  active: 'Activo',
  rejected: 'Rechazado',
  suspended: 'Suspendido',
};

const INITIAL_FORM = {
  razon_social: '',
  cuit: '',
  rubro: '',
  contacto_nombre: '',
  contacto_email: '',
  contacto_telefono: '',
  direccion: '',
  ciudad: '',
  provincia: '',
  pais: 'Argentina',
  sitio_web: '',
};

export default function OnboardingList() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [kpis, setKpis] = useState(null);
  const [onboardings, setOnboardings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ estado: '', rubro: '' });

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchKPIs = useCallback(async () => {
    try {
      const res = await api.get('/supplier-onboarding/kpis');
      if (res.data?.ok) {
        setKpis(res.data.kpis || res.data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchOnboardings = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.estado) params.estado = filters.estado;
      if (filters.rubro) params.rubro = filters.rubro;

      const res = await api.get('/supplier-onboarding/', { params });
      if (res.data?.ok) {
        setOnboardings(res.data.items || []);
      }
    } catch {
      toast.error(t('onboarding_error_load', 'Error al cargar onboardings'));
    } finally {
      setLoading(false);
    }
  }, [filters, t, toast]);

  useEffect(() => {
    fetchKPIs();
    fetchOnboardings();
  }, [fetchKPIs, fetchOnboardings]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!form.razon_social.trim() || !form.cuit.trim()) {
      toast.warning(t('onboarding_required', 'Razón social y CUIT son obligatorios'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/supplier-onboarding/', form);
      if (res.data?.ok) {
        toast.success(t('onboarding_created', 'Onboarding creado'));
        setDialogOpen(false);
        setForm(INITIAL_FORM);
        fetchOnboardings();
        fetchKPIs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('onboarding_error_create', 'Error al crear onboarding'));
    } finally {
      setSubmitting(false);
    }
  }, [form, t, toast, fetchOnboardings, fetchKPIs]);

  const handleRowClick = useCallback((event) => {
    if (event.data?.id) {
      navigate(`/onboarding/${event.data.id}`);
    }
  }, [navigate]);

  const columnDefs = useMemo(() => [
    { field: 'razon_social', headerName: t('onboarding_col_razon_social', 'Razón Social'), flex: 2, minWidth: 200 },
    { field: 'cuit', headerName: t('onboarding_col_cuit', 'CUIT'), width: 140 },
    { field: 'rubro', headerName: t('onboarding_col_rubro', 'Rubro'), flex: 1, minWidth: 140 },
    {
      field: 'estado',
      headerName: t('onboarding_col_estado', 'Estado'),
      width: 140,
      cellRenderer: (p) => (
        <Chip size="small" label={ESTADO_LABELS[p.value] || p.value || '-'} color={ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    {
      field: 'score_calificacion',
      headerName: t('onboarding_col_score', 'Score'),
      width: 100,
      type: 'numericColumn',
      cellRenderer: (p) => {
        if (p.value == null) return '--';
        const score = Number(p.value);
        const color = score >= 80 ? 'success.main' : score >= 60 ? 'warning.main' : 'error.main';
        return (
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 600, color }}>
              {score.toFixed(1)}
            </Typography>
          </Stack>
        );
      },
    },
    { field: 'contacto_nombre', headerName: t('onboarding_col_contacto', 'Contacto'), flex: 1, minWidth: 140 },
    { field: 'contacto_email', headerName: t('onboarding_col_email', 'Email'), flex: 1, minWidth: 160 },
  ], [t]);

  const KpiCard = ({ icon, label, value, color }) => (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, flex: 1, minWidth: 170 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
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
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" gap={1}>
          <BusinessIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('onboarding_title', 'Supplier Onboarding')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          {t('onboarding_new', 'Nuevo Onboarding')}
        </Button>
      </Stack>

      {/* KPIs */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
          <KpiCard
            icon={<BusinessIcon sx={{ color: 'warning.main' }} />}
            label={t('onboarding_kpi_pending', 'Pendientes')}
            value={kpis.pending}
            color="warning.main"
          />
          <KpiCard
            icon={<CheckCircleIcon sx={{ color: 'success.main' }} />}
            label={t('onboarding_kpi_approved', 'Aprobados este Mes')}
            value={kpis.approved_this_month}
            color="success.main"
          />
          <KpiCard
            icon={<StarIcon sx={{ color: 'info.main' }} />}
            label={t('onboarding_kpi_avg_score', 'Score Promedio')}
            value={kpis.avg_score?.toFixed(1)}
            color="info.main"
          />
          <KpiCard
            icon={<WarningIcon sx={{ color: 'error.main' }} />}
            label={t('onboarding_kpi_expired_docs', 'Docs Vencidos')}
            value={kpis.expired_docs}
            color="error.main"
          />
        </Stack>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('onboarding_filter_estado', 'Estado')}</InputLabel>
            <Select
              value={filters.estado}
              label={t('onboarding_filter_estado', 'Estado')}
              onChange={(e) => handleFilterChange('estado', e.target.value)}
            >
              {ESTADO_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label={t('onboarding_filter_rubro', 'Rubro')}
            size="small"
            value={filters.rubro}
            onChange={(e) => handleFilterChange('rubro', e.target.value)}
            sx={{ minWidth: 200 }}
          />
        </Stack>
      </Paper>

      {/* Grid */}
      <Paper elevation={0} sx={{ p: 0, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ height: 600 }}>
          <SPMAgGrid
            rowData={onboardings}
            columnDefs={columnDefs}
            loading={loading}
            onRowClicked={handleRowClick}
          />
        </Box>
      </Paper>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <BusinessIcon color="primary" />
            <span>{t('onboarding_create_title', 'Nuevo Onboarding de Proveedor')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={8}>
              <TextField
                label={t('onboarding_razon_social', 'Razón Social')}
                value={form.razon_social}
                onChange={(e) => handleFormChange('razon_social', e.target.value)}
                fullWidth
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label={t('onboarding_cuit', 'CUIT')}
                value={form.cuit}
                onChange={(e) => handleFormChange('cuit', e.target.value)}
                fullWidth
                size="small"
                required
                placeholder="20-12345678-9"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('onboarding_rubro', 'Rubro')}
                value={form.rubro}
                onChange={(e) => handleFormChange('rubro', e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('onboarding_contacto_nombre', 'Nombre Contacto')}
                value={form.contacto_nombre}
                onChange={(e) => handleFormChange('contacto_nombre', e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('onboarding_contacto_email', 'Email')}
                value={form.contacto_email}
                onChange={(e) => handleFormChange('contacto_email', e.target.value)}
                fullWidth
                size="small"
                type="email"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('onboarding_contacto_telefono', 'Teléfono')}
                value={form.contacto_telefono}
                onChange={(e) => handleFormChange('contacto_telefono', e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={t('onboarding_direccion', 'Dirección')}
                value={form.direccion}
                onChange={(e) => handleFormChange('direccion', e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label={t('onboarding_ciudad', 'Ciudad')}
                value={form.ciudad}
                onChange={(e) => handleFormChange('ciudad', e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label={t('onboarding_provincia', 'Provincia')}
                value={form.provincia}
                onChange={(e) => handleFormChange('provincia', e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label={t('onboarding_pais', 'País')}
                value={form.pais}
                onChange={(e) => handleFormChange('pais', e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={t('onboarding_sitio_web', 'Sitio Web')}
                value={form.sitio_web}
                onChange={(e) => handleFormChange('sitio_web', e.target.value)}
                fullWidth
                size="small"
                placeholder="https://www.ejemplo.com"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={submitting || !form.razon_social.trim() || !form.cuit.trim()}
            startIcon={submitting ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {t('onboarding_create_btn', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
