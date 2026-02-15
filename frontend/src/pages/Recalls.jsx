/**
 * Recalls - Recall management list page
 *
 * Displays recalls with KPI cards (active recalls, blocked lots, recovered lots,
 * estimated cost), AG-Grid table with filters by estado/severidad, and create recall dialog.
 * Row click navigates to recall detail.
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import RecyclingIcon from '@mui/icons-material/Recycling';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'active', label: 'Activo' },
  { value: 'in_progress', label: 'En Proceso' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const ESTADO_COLORS = {
  draft: 'default',
  active: 'error',
  in_progress: 'warning',
  closed: 'success',
  cancelled: 'default',
};

const ESTADO_LABELS = {
  draft: 'Borrador',
  active: 'Activo',
  in_progress: 'En Proceso',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
};

const SEVERIDAD_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Critica' },
];

const SEVERIDAD_COLORS = {
  low: 'info',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

const SEVERIDAD_LABELS = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica',
};

const TIPO_OPTIONS = [
  { value: 'safety', label: 'Seguridad' },
  { value: 'quality', label: 'Calidad' },
  { value: 'compliance', label: 'Cumplimiento' },
  { value: 'voluntary', label: 'Voluntario' },
];

const TIPO_COLORS = {
  safety: 'error',
  quality: 'warning',
  compliance: 'info',
  voluntary: 'default',
};

const TIPO_LABELS = {
  safety: 'Seguridad',
  quality: 'Calidad',
  compliance: 'Cumplimiento',
  voluntary: 'Voluntario',
};

const INITIAL_RECALL_FORM = {
  titulo: '',
  severidad: 'medium',
  tipo: 'quality',
  razon: '',
  material_codigo: '',
  proveedor_cuit: '',
  plan_accion: '',
  costo_estimado: '',
};

export default function Recalls() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const [recalls, setRecalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [filters, setFilters] = useState({ estado: '', severidad: '' });

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [recallForm, setRecallForm] = useState(INITIAL_RECALL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchRecalls = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: 1, per_page: 200 };
      if (filters.estado) params.estado = filters.estado;
      if (filters.severidad) params.severidad = filters.severidad;
      const res = await api.get('/lots/recalls', { params });
      if (res.data?.ok) {
        setRecalls(res.data.recalls || res.data.items || []);
        // Extract KPIs if embedded in response
        if (res.data.kpis) {
          setKpis(res.data.kpis);
        }
      }
    } catch {
      toast.error(t('recall_error_load', 'Error al cargar recalls'));
    } finally {
      setLoading(false);
    }
  }, [filters, t, toast]);

  const fetchKPIs = useCallback(async () => {
    try {
      const res = await api.get('/lots/recalls', { params: { summary: true } });
      if (res.data?.ok && res.data.kpis) {
        setKpis(res.data.kpis);
      }
    } catch {
      // Non-critical - try to get from recalls response instead
    }
  }, []);

  useEffect(() => {
    fetchRecalls();
    fetchKPIs();
  }, [fetchRecalls, fetchKPIs]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setRecallForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleCreateRecall = useCallback(async () => {
    if (!recallForm.titulo.trim() || !recallForm.razon.trim()) {
      toast.warning(t('recall_required', 'Complete titulo y razon'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...recallForm,
        costo_estimado: recallForm.costo_estimado ? parseFloat(recallForm.costo_estimado) : undefined,
      };
      const res = await api.post('/lots/recalls', payload);
      if (res.data?.ok) {
        toast.success(t('recall_created', 'Recall creado'));
        setCreateOpen(false);
        setRecallForm(INITIAL_RECALL_FORM);
        fetchRecalls();
        fetchKPIs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('recall_error_create', 'Error al crear recall'));
    } finally {
      setSubmitting(false);
    }
  }, [recallForm, t, toast, fetchRecalls, fetchKPIs]);

  const fmtMoney = useCallback((val) => {
    return val != null ? formatCurrency(val) : '-';
  }, []);

  const columnDefs = useMemo(() => [
    { field: 'numero_recall', headerName: t('recall_numero', 'N. Recall'), flex: 1, minWidth: 130 },
    { field: 'titulo', headerName: t('recall_titulo', 'Titulo'), flex: 2, minWidth: 200 },
    {
      field: 'severidad',
      headerName: t('recall_severidad', 'Severidad'),
      width: 120,
      cellRenderer: (p) => {
        const isCritical = p.value === 'critical';
        return (
          <Chip
            size="small"
            label={SEVERIDAD_LABELS[p.value] || p.value || '-'}
            color={SEVERIDAD_COLORS[p.value] || 'default'}
            variant={isCritical ? 'filled' : 'outlined'}
            sx={isCritical ? { fontWeight: 700 } : {}}
          />
        );
      },
    },
    {
      field: 'tipo',
      headerName: t('recall_tipo', 'Tipo'),
      width: 130,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={TIPO_LABELS[p.value] || p.value || '-'}
          color={TIPO_COLORS[p.value] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'estado',
      headerName: t('recall_estado', 'Estado'),
      width: 130,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={ESTADO_LABELS[p.value] || p.value || '-'}
          color={ESTADO_COLORS[p.value] || 'default'}
        />
      ),
    },
    { field: 'material_codigo', headerName: t('recall_material', 'Material'), width: 130 },
    { field: 'proveedor_cuit', headerName: t('recall_proveedor', 'Proveedor'), width: 140 },
    {
      field: 'lotes_afectados',
      headerName: t('recall_lotes', 'Lotes Afectados'),
      width: 130,
      type: 'numericColumn',
    },
    {
      field: 'costo_estimado',
      headerName: t('recall_costo', 'Costo Estimado'),
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => fmtMoney(p.value),
    },
    {
      field: 'created_at',
      headerName: t('recall_fecha', 'Fecha'),
      width: 110,
      valueFormatter: (p) => formatDate(p.value),
    },
  ], [t, fmtMoney]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <ReportProblemIcon sx={{ color: 'error.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('recall_title', 'Recalls')}
          </Typography>
        </Stack>
        <Button
          variant="contained"
          color="error"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          aria-label={t('recall_new', 'Crear Recall')}
        >
          {t('recall_new', 'Crear Recall')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 170 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
              <WarningAmberIcon fontSize="small" sx={{ color: 'error.main' }} />
              <Typography variant="caption" color="text.secondary">
                {t('recall_kpi_activos', 'Recalls Activos')}
              </Typography>
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
              {kpis.recalls_activos ?? 0}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 170 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
              <BlockIcon fontSize="small" sx={{ color: 'warning.main' }} />
              <Typography variant="caption" color="text.secondary">
                {t('recall_kpi_bloqueados', 'Lotes Bloqueados')}
              </Typography>
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
              {kpis.lotes_bloqueados ?? 0}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 170 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
              <RecyclingIcon fontSize="small" sx={{ color: 'success.main' }} />
              <Typography variant="caption" color="text.secondary">
                {t('recall_kpi_recuperados', 'Lotes Recuperados')}
              </Typography>
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
              {kpis.lotes_recuperados ?? 0}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 170 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
              <AttachMoneyIcon fontSize="small" sx={{ color: 'info.main' }} />
              <Typography variant="caption" color="text.secondary">
                {t('recall_kpi_costo', 'Costo Estimado Total')}
              </Typography>
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
              {fmtMoney(kpis.costo_estimado_total)}
            </Typography>
          </Paper>
        </Stack>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('recall_filter_estado', 'Estado')}</InputLabel>
            <Select
              value={filters.estado}
              label={t('recall_filter_estado', 'Estado')}
              onChange={(e) => handleFilterChange('estado', e.target.value)}
            >
              {ESTADO_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('recall_filter_severidad', 'Severidad')}</InputLabel>
            <Select
              value={filters.severidad}
              label={t('recall_filter_severidad', 'Severidad')}
              onChange={(e) => handleFilterChange('severidad', e.target.value)}
            >
              {SEVERIDAD_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Recalls Table */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
        aria-label={t('recall_title', 'Recalls')}
      >
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={recalls}
          loading={loading}
          height={500}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={(row) => navigate(`/operations/recalls/${row.id}`)}
          exportFileName="recalls"
          emptyMessage={t('recall_empty', 'No hay recalls registrados')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Create Recall Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <ReportProblemIcon color="error" />
            <span>{t('recall_new', 'Crear Recall')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('recall_field_titulo', 'Titulo')}
              value={recallForm.titulo}
              onChange={(e) => handleFormChange('titulo', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <FormControl fullWidth size="small" required>
                <InputLabel>{t('recall_field_severidad', 'Severidad')}</InputLabel>
                <Select
                  value={recallForm.severidad}
                  label={t('recall_field_severidad', 'Severidad')}
                  onChange={(e) => handleFormChange('severidad', e.target.value)}
                >
                  {SEVERIDAD_OPTIONS.filter((o) => o.value).map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" required>
                <InputLabel>{t('recall_field_tipo', 'Tipo')}</InputLabel>
                <Select
                  value={recallForm.tipo}
                  label={t('recall_field_tipo', 'Tipo')}
                  onChange={(e) => handleFormChange('tipo', e.target.value)}
                >
                  {TIPO_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label={t('recall_field_razon', 'Razon')}
              value={recallForm.razon}
              onChange={(e) => handleFormChange('razon', e.target.value)}
              fullWidth
              required
              multiline
              rows={2}
              size="small"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                label={t('recall_field_material', 'Codigo Material')}
                value={recallForm.material_codigo}
                onChange={(e) => handleFormChange('material_codigo', e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label={t('recall_field_proveedor', 'Proveedor CUIT')}
                value={recallForm.proveedor_cuit}
                onChange={(e) => handleFormChange('proveedor_cuit', e.target.value)}
                fullWidth
                size="small"
              />
            </Stack>
            <TextField
              label={t('recall_field_plan', 'Plan de Accion')}
              value={recallForm.plan_accion}
              onChange={(e) => handleFormChange('plan_accion', e.target.value)}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
            <TextField
              label={t('recall_field_costo', 'Costo Estimado (USD)')}
              type="number"
              value={recallForm.costo_estimado}
              onChange={(e) => handleFormChange('costo_estimado', e.target.value)}
              fullWidth
              size="small"
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={submitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCreateRecall}
            disabled={submitting || !recallForm.titulo.trim() || !recallForm.razon.trim()}
            startIcon={submitting ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {t('common_crear', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
