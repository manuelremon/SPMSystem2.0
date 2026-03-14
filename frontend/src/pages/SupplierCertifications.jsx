/**
 * SupplierCertifications - Supplier certification tracking page
 *
 * Displays certifications with filters (proveedor, tipo, estado), alert banner
 * for expiring certs, SPMAgGrid table, and a dialog to register new certifications.
 * Sprint 61
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatDate } from '../utils/formatters';

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
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import CertExpiryBadge from '../components/CertExpiryBadge';

const TIPO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ISO_9001', label: 'ISO 9001' },
  { value: 'ISO_14001', label: 'ISO 14001' },
  { value: 'ISO_45001', label: 'ISO 45001' },
  { value: 'HACCP', label: 'HACCP' },
  { value: 'custom', label: 'Custom' },
];

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Activa' },
  { value: 'expired', label: 'Vencida' },
  { value: 'revoked', label: 'Revocada' },
  { value: 'pending_renewal', label: 'Pendiente Renovacion' },
];

const ESTADO_COLORS = {
  active: 'success',
  expired: 'error',
  revoked: 'error',
  pending_renewal: 'warning',
};

const ESTADO_LABELS = {
  active: 'Activa',
  expired: 'Vencida',
  revoked: 'Revocada',
  pending_renewal: 'Pend. Renovacion',
};

const INITIAL_FORM = {
  proveedor_cuit: '',
  tipo: 'ISO_9001',
  nombre: '',
  numero_certificado: '',
  organismo_certificador: '',
  fecha_emision: '',
  fecha_vencimiento: '',
};

export default function SupplierCertifications() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expiringCount, setExpiringCount] = useState(0);
  const [filters, setFilters] = useState({
    proveedor_cuit: '',
    tipo: '',
    estado: '',
  });

  // Create dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchCertifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: 1, per_page: 200 };
      if (filters.proveedor_cuit) params.proveedor_cuit = filters.proveedor_cuit;
      if (filters.tipo) params.tipo = filters.tipo;
      if (filters.estado) params.estado = filters.estado;
      const res = await api.get('/supplier-audit/certifications', { params });
      if (res.data?.ok) {
        setCertifications(res.data.certifications || res.data.items || []);
      }
    } catch {
      toast.error(t('cert_error_load', 'Error al cargar certificaciones'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchExpiring = useCallback(async () => {
    try {
      const res = await api.get('/supplier-audit/certifications/expiring', {
        params: { dias: 30 },
      });
      if (res.data?.ok) {
        setExpiringCount(res.data.count || (res.data.certifications || []).length);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchCertifications();
    fetchExpiring();
  }, [fetchCertifications, fetchExpiring]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.proveedor_cuit.trim() || !form.nombre.trim()) {
      toast.warning(t('cert_required_fields', 'Complete proveedor y nombre'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/supplier-audit/certifications', form);
      if (res.data?.ok) {
        toast.success(t('cert_created', 'Certificacion registrada'));
        setDialogOpen(false);
        setForm(INITIAL_FORM);
        fetchCertifications();
        fetchExpiring();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('cert_error_create', 'Error al registrar certificacion'));
    } finally {
      setSubmitting(false);
    }
  }, [form, t, toast, fetchCertifications, fetchExpiring]);

  const columnDefs = useMemo(() => [
    { field: 'proveedor_cuit', headerName: t('cert_proveedor', 'Proveedor CUIT'), flex: 1, minWidth: 140 },
    {
      field: 'tipo',
      headerName: t('cert_tipo', 'Tipo'),
      width: 130,
      cellRenderer: (p) => <Chip size="small" label={p.value || '-'} variant="outlined" />,
    },
    { field: 'nombre', headerName: t('cert_nombre', 'Nombre'), flex: 2, minWidth: 180 },
    { field: 'numero_certificado', headerName: t('cert_numero', 'N. Certificado'), flex: 1, minWidth: 140 },
    { field: 'organismo_certificador', headerName: t('cert_organismo', 'Organismo'), flex: 1, minWidth: 150 },
    {
      field: 'fecha_emision',
      headerName: t('cert_fecha_emision', 'Emision'),
      width: 110,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'fecha_vencimiento',
      headerName: t('cert_fecha_vencimiento', 'Vencimiento'),
      width: 110,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      field: 'estado',
      headerName: t('cert_estado', 'Estado'),
      width: 150,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={ESTADO_LABELS[p.value] || p.value || '-'}
          color={ESTADO_COLORS[p.value] || 'default'}
        />
      ),
    },
    {
      field: 'fecha_vencimiento',
      headerName: t('cert_dias_restantes', 'Dias Restantes'),
      width: 130,
      colId: 'expiry_badge',
      cellRenderer: (p) => <CertExpiryBadge fecha_vencimiento={p.value} />,
    },
  ], [t]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
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
            {t('cert_title', 'Certificaciones de Proveedores')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          aria-label={t('cert_new', 'Registrar Certificacion')}
        >
          {t('cert_new', 'Registrar Certificacion')}
        </Button>
      </Box>

      {/* Expiring alert banner */}
      {expiringCount > 0 && (
        <Alert severity="warning" aria-label={t('cert_alert_expiring', 'Certificaciones por vencer')}>
          {expiringCount} {t('cert_alert_expiring_msg', 'certificaciones por vencer en 30 dias')}
        </Alert>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('cert_filter_tipo', 'Tipo')}</InputLabel>
            <Select
              value={filters.tipo}
              label={t('cert_filter_tipo', 'Tipo')}
              onChange={(e) => handleFilterChange('tipo', e.target.value)}
            >
              {TIPO_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t('cert_filter_estado', 'Estado')}</InputLabel>
            <Select
              value={filters.estado}
              label={t('cert_filter_estado', 'Estado')}
              onChange={(e) => handleFilterChange('estado', e.target.value)}
            >
              {ESTADO_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t('cert_filter_proveedor', 'Proveedor CUIT')}
            value={filters.proveedor_cuit}
            onChange={(e) => handleFilterChange('proveedor_cuit', e.target.value)}
            sx={{ minWidth: 180 }}
          />
        </Stack>
      </Paper>

      {/* Table */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider' }}
        aria-label={t('cert_title', 'Certificaciones de Proveedores')}
      >
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={certifications}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          exportFileName="certificaciones_proveedores"
          emptyMessage={t('cert_empty', 'No hay certificaciones registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Register Certification Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <VerifiedUserIcon color="primary" />
            <span>{t('cert_new', 'Registrar Certificacion')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('cert_field_proveedor', 'Proveedor CUIT')}
              value={form.proveedor_cuit}
              onChange={(e) => handleFormChange('proveedor_cuit', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <FormControl size="small" fullWidth>
              <InputLabel>{t('cert_field_tipo', 'Tipo')}</InputLabel>
              <Select
                value={form.tipo}
                onChange={(e) => handleFormChange('tipo', e.target.value)}
                label={t('cert_field_tipo', 'Tipo')}
              >
                {TIPO_OPTIONS.filter((o) => o.value).map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('cert_field_nombre', 'Nombre Certificacion')}
              value={form.nombre}
              onChange={(e) => handleFormChange('nombre', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('cert_field_numero', 'Numero Certificado')}
              value={form.numero_certificado}
              onChange={(e) => handleFormChange('numero_certificado', e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label={t('cert_field_organismo', 'Organismo Certificador')}
              value={form.organismo_certificador}
              onChange={(e) => handleFormChange('organismo_certificador', e.target.value)}
              fullWidth
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('cert_field_emision', 'Fecha Emision')}
                type="date"
                value={form.fecha_emision}
                onChange={(e) => handleFormChange('fecha_emision', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label={t('cert_field_vencimiento', 'Fecha Vencimiento')}
                type="date"
                value={form.fecha_vencimiento}
                onChange={(e) => handleFormChange('fecha_vencimiento', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || !form.proveedor_cuit.trim() || !form.nombre.trim()}
            startIcon={submitting && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
