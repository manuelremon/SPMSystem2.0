/**
 * QualityInspections - Lista de inspecciones de calidad
 *
 * Muestra inspecciones con KPI cards, filtros, y tabla.
 * Permite crear nueva inspeccion via modal.
 * Sprint 58
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VerifiedIcon from '@mui/icons-material/Verified';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const RESULTADO_COLORS = {
  pass: 'success',
  fail: 'error',
  partial: 'warning',
  pending: 'default',
};

const TIPO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'recepcion', label: 'Recepcion' },
  { value: 'proceso', label: 'En Proceso' },
  { value: 'final', label: 'Final' },
];

export default function QualityInspections() {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;
  const navigate = useNavigate();

  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [tipoFilter, setTipoFilter] = useState('');
  const [resultadoFilter, setResultadoFilter] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // New inspection modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newForm, setNewForm] = useState({ recepcion_id: '', tipo: 'recepcion' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = {};
        if (tipoFilter) params.tipo = tipoFilter;
        if (resultadoFilter) params.resultado = resultadoFilter;
        const [inspRes, kpiRes] = await Promise.all([
          api.get('/quality/inspections', { params }),
          api.get('/quality/kpis')
        ]);
        if (cancelled) return;
        if (inspRes.data?.ok) setInspections(inspRes.data.inspections || []);
        if (kpiRes.data?.ok) setKpis(kpiRes.data.kpis);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('quality_error_cargar', 'Error al cargar inspecciones'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tipoFilter, resultadoFilter, reloadTick]);

  const handleCreate = useCallback(async () => {
    if (!newForm.recepcion_id.trim()) {
      toastRef.current.warning(tRef.current('quality_recepcion_requerida', 'El ID de recepcion es requerido'));
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/quality/inspections', {
        recepcion_id: newForm.recepcion_id.trim(),
        tipo: newForm.tipo,
      });
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('quality_inspeccion_creada', 'Inspeccion creada'));
        setCreateOpen(false);
        setNewForm({ recepcion_id: '', tipo: 'recepcion' });
        navigate(`/quality/inspections/${res.data.inspection_id}`);
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('quality_error_crear', 'Error al crear inspeccion'));
    } finally {
      setCreating(false);
    }
  }, [newForm, navigate]);

  const columnDefs = useMemo(() => [
    {
      field: 'numero_inspeccion',
      headerName: t('quality_numero', 'N. Inspeccion'),
      width: 150,
    },
    {
      field: 'tipo',
      headerName: t('quality_tipo', 'Tipo'),
      width: 120,
      cellRenderer: (params) => (
        <Chip label={params.value || '-'} size="small" variant="outlined" />
      ),
    },
    {
      field: 'fecha',
      headerName: t('quality_fecha', 'Fecha'),
      width: 130,
      valueFormatter: (params) => {
        if (!params.value) return '-';
        return new Date(params.value).toLocaleDateString('es-AR');
      },
    },
    {
      field: 'resultado',
      headerName: t('quality_resultado', 'Resultado'),
      width: 120,
      cellRenderer: (params) => (
        <Chip
          label={params.value || 'pending'}
          color={RESULTADO_COLORS[params.value] || 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'inspector',
      headerName: t('quality_inspector', 'Inspector'),
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'proveedor_nombre',
      headerName: t('quality_proveedor', 'Proveedor'),
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'total_items',
      headerName: t('quality_total_items', 'Items'),
      width: 80,
      type: 'numericColumn',
    },
  ], [t]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
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
            {t('quality_inspections_title', 'Inspecciones de Calidad')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          aria-label={t('quality_nueva_inspeccion', 'Nueva Inspeccion')}
        >
          {t('quality_nueva_inspeccion', 'Nueva Inspeccion')}
        </Button>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">{t('quality_kpi_total', 'Total Inspecciones')}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{kpis.total ?? 0}</Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">{t('quality_kpi_pass_rate', 'Tasa Aprobacion')}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
              {kpis.pass_rate != null ? `${kpis.pass_rate.toFixed(1)}%` : '-'}
            </Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">{t('quality_kpi_pending', 'Pendientes')}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>{kpis.pending ?? 0}</Typography>
          </Paper>
          <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">{t('quality_kpi_fail', 'Rechazadas')}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>{kpis.failed ?? 0}</Typography>
          </Paper>
        </Stack>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('quality_filtro_tipo', 'Tipo')}</InputLabel>
            <Select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              label={t('quality_filtro_tipo', 'Tipo')}
            >
              {TIPO_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>{t('quality_filtro_resultado', 'Resultado')}</InputLabel>
            <Select
              value={resultadoFilter}
              onChange={(e) => setResultadoFilter(e.target.value)}
              label={t('quality_filtro_resultado', 'Resultado')}
            >
              <MenuItem value="">{t('common_todos', 'Todos')}</MenuItem>
              <MenuItem value="pass">{t('quality_pass', 'Aprobado')}</MenuItem>
              <MenuItem value="fail">{t('quality_fail', 'Rechazado')}</MenuItem>
              <MenuItem value="partial">{t('quality_partial', 'Parcial')}</MenuItem>
              <MenuItem value="pending">{t('quality_pending', 'Pendiente')}</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }} aria-label={t('quality_inspections_title', 'Inspecciones de Calidad')}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={inspections}
          loading={loading}
          height={480}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          onRowClick={(row) => navigate(`/quality/inspections/${row.id}`)}
          exportFileName="inspecciones_calidad"
          emptyMessage={t('quality_empty', 'No hay inspecciones registradas')}
          getRowId={(params) => String(params.data.id)}
        />
      </Paper>

      {/* Create Inspection Modal */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <VerifiedIcon color="primary" />
            <span>{t('quality_nueva_inspeccion', 'Nueva Inspeccion')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label={t('quality_recepcion_id', 'ID de Recepcion')}
              value={newForm.recepcion_id}
              onChange={(e) => setNewForm((prev) => ({ ...prev, recepcion_id: e.target.value }))}
              fullWidth
              required
              autoFocus
              placeholder="Ej: REC-001"
            />
            <FormControl fullWidth>
              <InputLabel>{t('quality_tipo', 'Tipo')}</InputLabel>
              <Select
                value={newForm.tipo}
                onChange={(e) => setNewForm((prev) => ({ ...prev, tipo: e.target.value }))}
                label={t('quality_tipo', 'Tipo')}
              >
                <MenuItem value="recepcion">{t('quality_tipo_recepcion', 'Recepcion')}</MenuItem>
                <MenuItem value="proceso">{t('quality_tipo_proceso', 'En Proceso')}</MenuItem>
                <MenuItem value="final">{t('quality_tipo_final', 'Final')}</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating || !newForm.recepcion_id.trim()}
            startIcon={creating && <CircularProgress size={16} />}
          >
            {t('quality_crear_btn', 'Crear Inspeccion')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
