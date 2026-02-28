/**
 * ECODetail - Engineering Change Order detail page
 *
 * Shows ECO header with status/priority/type chips, info section,
 * tabbed views (Changes, Approvals, Impact, Timeline),
 * action buttons based on estado, and dialog for adding changes.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EngineeringIcon from '@mui/icons-material/Engineering';
import SendIcon from '@mui/icons-material/Send';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import BuildIcon from '@mui/icons-material/Build';
import AddIcon from '@mui/icons-material/Add';
import TimelineIcon from '@mui/icons-material/Timeline';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_COLORS = {
  draft: 'default',
  submitted: 'info',
  approved: 'success',
  rejected: 'error',
  implemented: 'success',
  cancelled: 'default',
};

const ESTADO_LABELS = {
  draft: 'Borrador',
  submitted: 'Enviado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  implemented: 'Implementado',
  cancelled: 'Cancelado',
};

const TIPO_LABELS = {
  material_change: 'Cambio Material',
  specification: 'Especificacion',
  process: 'Proceso',
  supplier: 'Proveedor',
  packaging: 'Empaque',
};

const PRIORIDAD_COLORS = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

const PRIORIDAD_LABELS = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica',
};

const DECISION_COLORS = {
  approved: 'success',
  rejected: 'error',
  pending: 'warning',
};

const DECISION_LABELS = {
  approved: 'Aprobado',
  rejected: 'Rechazado',
  pending: 'Pendiente',
};

const CHANGE_TIPO_OPTIONS = [
  { value: 'specification', label: 'Especificacion' },
  { value: 'material_replacement', label: 'Reemplazo Material' },
  { value: 'process_change', label: 'Cambio Proceso' },
  { value: 'supplier_change', label: 'Cambio Proveedor' },
  { value: 'other', label: 'Otro' },
];

const INITIAL_CHANGE_FORM = {
  tipo_cambio: 'specification',
  campo_afectado: '',
  valor_anterior: '',
  valor_nuevo: '',
};

export default function ECODetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const [eco, setEco] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // Impact data
  const [impact, setImpact] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);

  // Add change dialog
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [changeForm, setChangeForm] = useState(INITIAL_CHANGE_FORM);
  const [changeSubmitting, setChangeSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/eco/${id}`);
        if (!cancelled && res.data?.ok) setEco(res.data.eco || res.data);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('eco_error_detail', 'Error al cargar ECO'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, reloadTick]);

  useEffect(() => {
    if (tabValue !== 2 || impact) return;
    let cancelled = false;
    const load = async () => {
      setImpactLoading(true);
      try {
        const res = await api.get(`/eco/${id}/impact`);
        if (!cancelled && res.data?.ok) setImpact(res.data.impact || res.data);
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setImpactLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tabValue, impact, id]);

  // Actions
  const handleSubmitECO = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await api.post(`/eco/${id}/submit`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('eco_submitted', 'ECO enviada a aprobacion'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('eco_error_submit', 'Error al enviar ECO'));
    } finally {
      setProcessing(false);
    }
  }, [id]);

  const handleApprove = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await api.put(`/eco/${id}/approve`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('eco_approved', 'ECO aprobada'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('eco_error_approve', 'Error al aprobar ECO'));
    } finally {
      setProcessing(false);
    }
  }, [id]);

  const handleReject = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await api.put(`/eco/${id}/reject`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('eco_rejected', 'ECO rechazada'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('eco_error_reject', 'Error al rechazar ECO'));
    } finally {
      setProcessing(false);
    }
  }, [id]);

  const handleImplement = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await api.post(`/eco/${id}/implement`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('eco_implemented', 'ECO implementada'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('eco_error_implement', 'Error al implementar ECO'));
    } finally {
      setProcessing(false);
    }
  }, [id]);

  // Add change
  const handleChangeFormChange = useCallback((field, value) => {
    setChangeForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAddChange = useCallback(async () => {
    if (!changeForm.campo_afectado.trim()) {
      toastRef.current.warning(tRef.current('eco_change_required', 'Complete el campo afectado'));
      return;
    }
    setChangeSubmitting(true);
    try {
      const res = await api.post(`/eco/${id}/changes`, changeForm);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('eco_change_added', 'Cambio agregado'));
        setChangeDialogOpen(false);
        setChangeForm(INITIAL_CHANGE_FORM);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('eco_error_add_change', 'Error al agregar cambio'));
    } finally {
      setChangeSubmitting(false);
    }
  }, [id, changeForm]);

  // Column definitions
  const changesColumnDefs = useMemo(() => [
    { field: 'tipo_cambio', headerName: t('eco_change_tipo', 'Tipo Cambio'), width: 160 },
    { field: 'campo_afectado', headerName: t('eco_change_campo', 'Campo'), flex: 1, minWidth: 140 },
    { field: 'valor_anterior', headerName: t('eco_change_anterior', 'Valor Anterior'), flex: 1, minWidth: 140 },
    { field: 'valor_nuevo', headerName: t('eco_change_nuevo', 'Valor Nuevo'), flex: 1, minWidth: 140 },
    { field: 'material_anterior', headerName: t('eco_change_mat_ant', 'Material Anterior'), width: 140 },
    { field: 'material_nuevo', headerName: t('eco_change_mat_nuevo', 'Material Nuevo'), width: 140 },
  ], [t]);

  const approvalsColumnDefs = useMemo(() => [
    { field: 'aprobador', headerName: t('eco_appr_aprobador', 'Aprobador'), flex: 1, minWidth: 140 },
    { field: 'rol', headerName: t('eco_appr_rol', 'Rol'), width: 130 },
    {
      field: 'decision',
      headerName: t('eco_appr_decision', 'Decision'),
      width: 130,
      cellRenderer: (p) => (
        <Chip size="small" label={DECISION_LABELS[p.value] || p.value || '-'} color={DECISION_COLORS[p.value] || 'default'} />
      ),
    },
    { field: 'comentarios', headerName: t('eco_appr_comentarios', 'Comentarios'), flex: 2, minWidth: 200 },
    {
      field: 'fecha',
      headerName: t('eco_appr_fecha', 'Fecha'),
      width: 130,
      valueFormatter: (p) => formatDateTime(p.value),
    },
  ], [t]);

  const impactOCColumnDefs = useMemo(() => [
    { field: 'numero_oc', headerName: t('eco_impact_oc', 'N. OC'), flex: 1, minWidth: 120 },
    { field: 'proveedor', headerName: t('eco_impact_proveedor', 'Proveedor'), flex: 1, minWidth: 140 },
    { field: 'estado', headerName: t('eco_impact_estado', 'Estado'), width: 120 },
    {
      field: 'monto',
      headerName: t('eco_impact_monto', 'Monto'),
      width: 130,
      valueFormatter: (p) => p.value != null ? formatCurrency(p.value) : '-',
    },
  ], [t]);

  const impactContratosColumnDefs = useMemo(() => [
    { field: 'numero_contrato', headerName: t('eco_impact_contrato', 'N. Contrato'), flex: 1, minWidth: 140 },
    { field: 'proveedor', headerName: t('eco_impact_proveedor', 'Proveedor'), flex: 1, minWidth: 140 },
    { field: 'estado', headerName: t('eco_impact_estado', 'Estado'), width: 120 },
  ], [t]);

  const impactStockColumnDefs = useMemo(() => [
    { field: 'material_codigo', headerName: t('eco_impact_material', 'Material'), flex: 1, minWidth: 120 },
    { field: 'almacen', headerName: t('eco_impact_almacen', 'Almacen'), width: 120 },
    { field: 'stock_actual', headerName: t('eco_impact_stock', 'Stock Actual'), width: 120, type: 'numericColumn' },
  ], [t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
        <Skeleton variant="rectangular" height={40} width={300} />
        <Skeleton variant="rectangular" height={200} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
    );
  }

  if (!eco) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{t('eco_not_found', 'ECO no encontrada')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/engineering/eco')} sx={{ mt: 2 }}>
          {t('common_volver', 'Volver')}
        </Button>
      </Box>
    );
  }

  const estado = eco.estado || 'draft';
  const changes = eco.changes || eco.cambios || [];
  const approvals = eco.approvals || eco.aprobaciones || [];
  const historial = eco.historial || eco.history || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Back */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/engineering/eco')} color="inherit" sx={{ alignSelf: 'flex-start' }}>
        {t('common_volver', 'Volver')}
      </Button>

      {/* Header */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
              <EngineeringIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {eco.numero_eco}
              </Typography>
              <Chip size="small" label={ESTADO_LABELS[estado] || estado} color={ESTADO_COLORS[estado] || 'default'} />
              <Chip size="small" label={PRIORIDAD_LABELS[eco.prioridad] || eco.prioridad} color={PRIORIDAD_COLORS[eco.prioridad] || 'default'} />
              <Chip size="small" label={TIPO_LABELS[eco.tipo] || eco.tipo} variant="outlined" />
            </Stack>
            <Typography variant="h6" sx={{ mb: 1 }}>{eco.titulo}</Typography>
            <Stack spacing={0.5} sx={{ color: 'text.secondary' }}>
              {eco.descripcion && <Typography variant="body2">{eco.descripcion}</Typography>}
              <Typography variant="body2">{t('eco_material', 'Material')}: <strong>{eco.material_codigo || '-'}</strong></Typography>
              <Typography variant="body2">{t('eco_solicitante', 'Solicitante')}: {eco.solicitante || '-'}</Typography>
              <Typography variant="body2">{t('eco_fecha_efectividad', 'Fecha Efectividad')}: {formatDate(eco.fecha_efectividad)}</Typography>
              {eco.costo_estimado != null && (
                <Typography variant="body2">{t('eco_costo', 'Costo Estimado')}: {formatCurrency(eco.costo_estimado)}</Typography>
              )}
              {eco.justificacion && (
                <Typography variant="body2">{t('eco_justificacion', 'Justificacion')}: {eco.justificacion}</Typography>
              )}
            </Stack>
          </Box>

          {/* Action buttons based on estado */}
          <Stack direction="row" gap={1} flexWrap="wrap">
            {estado === 'draft' && (
              <Button
                variant="contained"
                color="primary"
                startIcon={processing ? <CircularProgress size={16} /> : <SendIcon />}
                onClick={handleSubmitECO}
                disabled={processing}
              >
                {t('eco_btn_submit', 'Enviar')}
              </Button>
            )}
            {estado === 'submitted' && (
              <>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={processing ? <CircularProgress size={16} /> : <CheckIcon />}
                  onClick={handleApprove}
                  disabled={processing}
                >
                  {t('eco_btn_approve', 'Aprobar')}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={processing ? <CircularProgress size={16} /> : <CloseIcon />}
                  onClick={handleReject}
                  disabled={processing}
                >
                  {t('eco_btn_reject', 'Rechazar')}
                </Button>
              </>
            )}
            {estado === 'approved' && (
              <Button
                variant="contained"
                color="warning"
                startIcon={processing ? <CircularProgress size={16} /> : <BuildIcon />}
                onClick={handleImplement}
                disabled={processing}
              >
                {t('eco_btn_implement', 'Implementar')}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={t('eco_tab_changes', 'Cambios')} />
          <Tab label={t('eco_tab_approvals', 'Aprobaciones')} />
          <Tab label={t('eco_tab_impact', 'Impacto')} />
          <Tab label={t('eco_tab_history', 'Historial')} />
        </Tabs>
      </Paper>

      {/* Tab 0: Changes */}
      {tabValue === 0 && (
        <>
          {(estado === 'draft' || estado === 'submitted') && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setChangeDialogOpen(true)}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('eco_add_change', 'Agregar Cambio')}
            </Button>
          )}
          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            aria-label={t('eco_tab_changes', 'Cambios')}
          >
            <SPMAgGrid
              columnDefs={changesColumnDefs}
              rowData={changes}
              loading={false}
              height={300}
              pagination={false}
              enableQuickFilter={false}
              exportFileName="eco_cambios"
              emptyMessage={t('eco_no_changes', 'Sin cambios registrados')}
              getRowId={(params) => String(params.data.id || params.rowIndex)}
            />
          </Paper>
        </>
      )}

      {/* Tab 1: Approvals */}
      {tabValue === 1 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
          aria-label={t('eco_tab_approvals', 'Aprobaciones')}
        >
          <SPMAgGrid
            columnDefs={approvalsColumnDefs}
            rowData={approvals}
            loading={false}
            height={300}
            pagination={false}
            enableQuickFilter={false}
            exportFileName="eco_aprobaciones"
            emptyMessage={t('eco_no_approvals', 'Sin aprobaciones')}
            getRowId={(params) => String(params.data.id || params.rowIndex)}
          />
        </Paper>
      )}

      {/* Tab 2: Impact */}
      {tabValue === 2 && (
        <Stack spacing={3}>
          {impactLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* OC Afectadas */}
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2">{t('eco_impact_oc_title', 'OC Afectadas')}</Typography>
                </Box>
                <SPMAgGrid
                  columnDefs={impactOCColumnDefs}
                  rowData={impact?.ordenes_compra || []}
                  loading={false}
                  height={200}
                  pagination={false}
                  enableQuickFilter={false}
                  emptyMessage={t('eco_impact_no_oc', 'Sin OC afectadas')}
                  getRowId={(params) => String(params.data.id || params.rowIndex)}
                />
              </Paper>

              {/* Contratos */}
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2">{t('eco_impact_contratos_title', 'Contratos Afectados')}</Typography>
                </Box>
                <SPMAgGrid
                  columnDefs={impactContratosColumnDefs}
                  rowData={impact?.contratos || []}
                  loading={false}
                  height={200}
                  pagination={false}
                  enableQuickFilter={false}
                  emptyMessage={t('eco_impact_no_contratos', 'Sin contratos afectados')}
                  getRowId={(params) => String(params.data.id || params.rowIndex)}
                />
              </Paper>

              {/* Stock */}
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2">{t('eco_impact_stock_title', 'Stock Afectado')}</Typography>
                </Box>
                <SPMAgGrid
                  columnDefs={impactStockColumnDefs}
                  rowData={impact?.stock || []}
                  loading={false}
                  height={200}
                  pagination={false}
                  enableQuickFilter={false}
                  emptyMessage={t('eco_impact_no_stock', 'Sin stock afectado')}
                  getRowId={(params) => String(params.data.id || params.data.material_codigo || params.rowIndex)}
                />
              </Paper>
            </>
          )}
        </Stack>
      )}

      {/* Tab 3: History */}
      {tabValue === 3 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>{t('eco_history_title', 'Historial de Cambios')}</Typography>
          {historial.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              {t('eco_no_history', 'Sin historial')}
            </Typography>
          ) : (
            <Stack spacing={2}>
              {historial.map((entry, idx) => (
                <Stack key={idx} direction="row" gap={2} alignItems="flex-start">
                  <TimelineIcon fontSize="small" sx={{ color: 'primary.main', mt: 0.3 }} />
                  <Box>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Chip size="small" label={ESTADO_LABELS[entry.estado_anterior] || entry.estado_anterior || '-'} color={ESTADO_COLORS[entry.estado_anterior] || 'default'} variant="outlined" sx={{ fontSize: '0.65rem' }} />
                      <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Chip size="small" label={ESTADO_LABELS[entry.estado_nuevo] || entry.estado_nuevo || '-'} color={ESTADO_COLORS[entry.estado_nuevo] || 'default'} sx={{ fontSize: '0.65rem' }} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {formatDateTime(entry.fecha || entry.created_at)} {entry.actor && `- ${entry.actor}`}
                    </Typography>
                    {entry.notas && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{entry.notas}</Typography>}
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      {/* Add Change Dialog */}
      <Dialog open={changeDialogOpen} onClose={() => setChangeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <AddIcon color="primary" />
            <span>{t('eco_add_change', 'Agregar Cambio')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>{t('eco_change_field_tipo', 'Tipo Cambio')}</InputLabel>
              <Select
                value={changeForm.tipo_cambio}
                label={t('eco_change_field_tipo', 'Tipo Cambio')}
                onChange={(e) => handleChangeFormChange('tipo_cambio', e.target.value)}
              >
                {CHANGE_TIPO_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('eco_change_field_campo', 'Campo Afectado')}
              value={changeForm.campo_afectado}
              onChange={(e) => handleChangeFormChange('campo_afectado', e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('eco_change_field_anterior', 'Valor Anterior')}
              value={changeForm.valor_anterior}
              onChange={(e) => handleChangeFormChange('valor_anterior', e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label={t('eco_change_field_nuevo', 'Valor Nuevo')}
              value={changeForm.valor_nuevo}
              onChange={(e) => handleChangeFormChange('valor_nuevo', e.target.value)}
              fullWidth
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setChangeDialogOpen(false)} disabled={changeSubmitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleAddChange}
            disabled={changeSubmitting || !changeForm.campo_afectado.trim()}
            startIcon={changeSubmitting && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
