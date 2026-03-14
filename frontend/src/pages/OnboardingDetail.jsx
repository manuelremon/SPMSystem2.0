/**
 * OnboardingDetail - Supplier Onboarding Detail View
 *
 * Header with company info, status, score. Tabs: Data (editable company info),
 * Documents (AG-Grid with upload, approve/reject), Evaluation (AG-Grid criteria
 * with editable scores, total score), History (timeline).
 * Sprint 81
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BusinessIcon from '@mui/icons-material/Business';
import SaveIcon from '@mui/icons-material/Save';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import { formatDateTime } from '../utils/formatters';

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

const DOC_ESTADO_COLORS = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  expired: 'default',
};

const DOC_ESTADO_LABELS = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  expired: 'Vencido',
};

const TIPO_DOC_OPTIONS = [
  { value: 'inscripcion_afip', label: 'Inscripción AFIP' },
  { value: 'constancia_cuit', label: 'Constancia CUIT' },
  { value: 'seguro', label: 'Seguro' },
  { value: 'iso_cert', label: 'Certificación ISO' },
  { value: 'balance', label: 'Balance' },
  { value: 'ref_comercial', label: 'Referencia Comercial' },
  { value: 'otro', label: 'Otro' },
];

const CRITERIO_OPTIONS = [
  { value: 'capacidad_tecnica', label: 'Capacidad Técnica', peso: 1.5 },
  { value: 'solidez_financiera', label: 'Solidez Financiera', peso: 1.2 },
  { value: 'experiencia', label: 'Experiencia', peso: 1.0 },
  { value: 'calidad', label: 'Calidad', peso: 1.3 },
  { value: 'precio', label: 'Precio', peso: 1.0 },
  { value: 'plazo_entrega', label: 'Plazo Entrega', peso: 0.8 },
];

export default function OnboardingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();

  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(null);
  const [documentos, setDocumentos] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [historial, setHistorial] = useState([]);

  // Edit data
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Add document
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docForm, setDocForm] = useState({ tipo_documento: '', nombre_archivo: '', path: '', fecha_vencimiento: '' });
  const [addingDoc, setAddingDoc] = useState(false);

  // Review document
  const [reviewingDoc, setReviewingDoc] = useState({});

  // Add evaluation
  const [evalDialogOpen, setEvalDialogOpen] = useState(false);
  const [evalForm, setEvalForm] = useState({ criterio: '', puntaje: '', peso: 1.0, comentarios: '' });
  const [addingEval, setAddingEval] = useState(false);

  // Approve/reject
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processingApproval, setProcessingApproval] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/supplier-onboarding/${id}`);
      if (res.data?.ok) {
        setOnboarding(res.data.onboarding);
        setDocumentos(res.data.documentos || []);
        setEvaluaciones(res.data.evaluaciones || []);
        setHistorial(res.data.historial || []);
        setEditForm(res.data.onboarding || {});
      }
    } catch (err) {
      toast.error(t('onboarding_error_load_detail', 'Error al cargar detalle'));
      navigate('/onboarding');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleEditChange = useCallback((field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveData = useCallback(async () => {
    setSaving(true);
    try {
      const res = await api.put(`/supplier-onboarding/${id}`, editForm);
      if (res.data?.ok) {
        toast.success(t('onboarding_saved', 'Datos guardados'));
        fetchDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('onboarding_error_save', 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  }, [id, editForm, t, toast, fetchDetail]);

  const handleSubmit = useCallback(async () => {
    try {
      const res = await api.post(`/supplier-onboarding/${id}/submit`);
      if (res.data?.ok) {
        toast.success(t('onboarding_submitted', 'Enviado a revisión'));
        fetchDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('onboarding_error_submit', 'Error al enviar'));
    }
  }, [id, t, toast, fetchDetail]);

  const handleAddDocument = useCallback(async () => {
    if (!docForm.tipo_documento || !docForm.nombre_archivo.trim()) {
      toast.warning(t('onboarding_doc_required', 'Tipo y nombre son obligatorios'));
      return;
    }
    setAddingDoc(true);
    try {
      const res = await api.post(`/supplier-onboarding/${id}/documents`, docForm);
      if (res.data?.ok) {
        toast.success(t('onboarding_doc_added', 'Documento agregado'));
        setDocDialogOpen(false);
        setDocForm({ tipo_documento: '', nombre_archivo: '', path: '', fecha_vencimiento: '' });
        fetchDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('onboarding_error_add_doc', 'Error al agregar documento'));
    } finally {
      setAddingDoc(false);
    }
  }, [id, docForm, t, toast, fetchDetail]);

  const handleReviewDocument = useCallback(async (docId, aprobado) => {
    setReviewingDoc((prev) => ({ ...prev, [docId]: true }));
    try {
      const res = await api.put(`/supplier-onboarding/${id}/documents/${docId}/review`, { aprobado });
      if (res.data?.ok) {
        toast.success(aprobado ? t('onboarding_doc_approved', 'Documento aprobado') : t('onboarding_doc_rejected', 'Documento rechazado'));
        fetchDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('onboarding_error_review_doc', 'Error al revisar documento'));
    } finally {
      setReviewingDoc((prev) => ({ ...prev, [docId]: false }));
    }
  }, [id, t, toast, fetchDetail]);

  const handleAddEvaluation = useCallback(async () => {
    if (!evalForm.criterio || evalForm.puntaje === '') {
      toast.warning(t('onboarding_eval_required', 'Criterio y puntaje son obligatorios'));
      return;
    }
    const puntaje = Number(evalForm.puntaje);
    if (puntaje < 0 || puntaje > 100) {
      toast.warning(t('onboarding_eval_range', 'Puntaje debe estar entre 0 y 100'));
      return;
    }
    setAddingEval(true);
    try {
      const res = await api.post(`/supplier-onboarding/${id}/evaluations`, {
        ...evalForm,
        puntaje,
        peso: Number(evalForm.peso),
      });
      if (res.data?.ok) {
        toast.success(t('onboarding_eval_added', 'Evaluación agregada'));
        setEvalDialogOpen(false);
        setEvalForm({ criterio: '', puntaje: '', peso: 1.0, comentarios: '' });
        fetchDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('onboarding_error_add_eval', 'Error al agregar evaluación'));
    } finally {
      setAddingEval(false);
    }
  }, [id, evalForm, t, toast, fetchDetail]);

  const handleApprove = useCallback(async () => {
    setProcessingApproval(true);
    try {
      const res = await api.put(`/supplier-onboarding/${id}/approve`);
      if (res.data?.ok) {
        toast.success(t('onboarding_approved_success', 'Onboarding aprobado y proveedor creado'));
        setApproveDialogOpen(false);
        fetchDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('onboarding_error_approve', 'Error al aprobar'));
    } finally {
      setProcessingApproval(false);
    }
  }, [id, t, toast, fetchDetail]);

  const handleReject = useCallback(async () => {
    if (!rejectReason.trim()) {
      toast.warning(t('onboarding_reject_reason_required', 'Razón de rechazo es obligatoria'));
      return;
    }
    setProcessingApproval(true);
    try {
      const res = await api.put(`/supplier-onboarding/${id}/reject`, { razon: rejectReason });
      if (res.data?.ok) {
        toast.success(t('onboarding_rejected_success', 'Onboarding rechazado'));
        setRejectDialogOpen(false);
        setRejectReason('');
        fetchDetail();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('onboarding_error_reject', 'Error al rechazar'));
    } finally {
      setProcessingApproval(false);
    }
  }, [id, rejectReason, t, toast, fetchDetail]);

  const handleCriterioChange = useCallback((criterio) => {
    const criterioData = CRITERIO_OPTIONS.find((c) => c.value === criterio);
    setEvalForm((prev) => ({ ...prev, criterio, peso: criterioData?.peso || 1.0 }));
  }, []);

  const docColumnDefs = useMemo(() => [
    {
      field: 'tipo_documento',
      headerName: t('onboarding_doc_col_tipo', 'Tipo'),
      flex: 1,
      minWidth: 150,
      valueFormatter: (p) => TIPO_DOC_OPTIONS.find((opt) => opt.value === p.value)?.label || p.value || '-',
    },
    { field: 'nombre_archivo', headerName: t('onboarding_doc_col_nombre', 'Nombre Archivo'), flex: 2, minWidth: 180 },
    {
      field: 'estado',
      headerName: t('onboarding_doc_col_estado', 'Estado'),
      width: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={DOC_ESTADO_LABELS[p.value] || p.value || '-'} color={DOC_ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    { field: 'fecha_vencimiento', headerName: t('onboarding_doc_col_venc', 'Vencimiento'), width: 120 },
    {
      headerName: t('onboarding_doc_col_acciones', 'Acciones'),
      width: 200,
      sortable: false,
      filter: false,
      cellRenderer: (p) => {
        const row = p.data;
        if (!row || row.estado !== 'pending') return null;
        const isProcessing = reviewingDoc[row.id];
        return (
          <Stack direction="row" gap={0.5} alignItems="center" sx={{ height: '100%' }}>
            <Button
              size="small"
              variant="outlined"
              color="success"
              startIcon={isProcessing ? <CircularProgress size={14} /> : <CheckCircleIcon />}
              onClick={(e) => { e.stopPropagation(); handleReviewDocument(row.id, true); }}
              disabled={isProcessing}
            >
              {t('onboarding_aprobar', 'Aprobar')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={isProcessing ? <CircularProgress size={14} /> : <CancelIcon />}
              onClick={(e) => { e.stopPropagation(); handleReviewDocument(row.id, false); }}
              disabled={isProcessing}
            >
              {t('onboarding_rechazar', 'Rechazar')}
            </Button>
          </Stack>
        );
      },
    },
  ], [t, reviewingDoc, handleReviewDocument]);

  const evalColumnDefs = useMemo(() => [
    {
      field: 'criterio',
      headerName: t('onboarding_eval_col_criterio', 'Criterio'),
      flex: 1,
      minWidth: 150,
      valueFormatter: (p) => CRITERIO_OPTIONS.find((c) => c.value === p.value)?.label || p.value || '-',
    },
    {
      field: 'puntaje',
      headerName: t('onboarding_eval_col_puntaje', 'Puntaje'),
      width: 100,
      type: 'numericColumn',
      cellRenderer: (p) => {
        if (p.value == null) return '--';
        const puntaje = Number(p.value);
        const color = puntaje >= 80 ? 'success.main' : puntaje >= 60 ? 'warning.main' : 'error.main';
        return (
          <Typography variant="body2" sx={{ fontWeight: 600, color }}>
            {Number(puntaje).toFixed(1)}
          </Typography>
        );
      },
    },
    { field: 'peso', headerName: t('onboarding_eval_col_peso', 'Peso'), width: 80, type: 'numericColumn' },
    { field: 'comentarios', headerName: t('onboarding_eval_col_comentarios', 'Comentarios'), flex: 2, minWidth: 200 },
  ], [t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!onboarding) {
    return null;
  }

  const canEdit = onboarding.estado === 'draft';
  const canSubmit = onboarding.estado === 'draft';
  const canApprove = ['submitted', 'under_review'].includes(onboarding.estado);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconButton onClick={() => navigate('/onboarding')} size="small">
            <ArrowBackIcon />
          </IconButton>
          <BusinessIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }} color="text.primary">
            {onboarding.razon_social}
          </Typography>
          <Chip label={ESTADO_LABELS[onboarding.estado] || onboarding.estado} color={ESTADO_COLORS[onboarding.estado] || 'default'} />
        </Stack>
        <Stack direction="row" gap={1}>
          {canSubmit && (
            <Button variant="outlined" startIcon={<SendIcon />} onClick={handleSubmit}>
              {t('onboarding_submit', 'Enviar a Revisión')}
            </Button>
          )}
          {canApprove && (
            <>
              <Button variant="outlined" color="error" startIcon={<ThumbDownIcon />} onClick={() => setRejectDialogOpen(true)}>
                {t('onboarding_reject', 'Rechazar')}
              </Button>
              <Button variant="contained" color="success" startIcon={<ThumbUpIcon />} onClick={() => setApproveDialogOpen(true)}>
                {t('onboarding_approve', 'Aprobar')}
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {/* Info Summary */}
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">{t('onboarding_cuit', 'CUIT')}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{onboarding.cuit}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">{t('onboarding_rubro', 'Rubro')}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{onboarding.rubro || '--'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">{t('onboarding_contacto', 'Contacto')}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{onboarding.contacto_nombre || '--'}</Typography>
          </Box>
          {onboarding.score_calificacion != null && (
            <Box>
              <Typography variant="caption" color="text.secondary">{t('onboarding_score', 'Score')}</Typography>
              <Typography variant="h6" sx={{
                fontWeight: 700,
                color: onboarding.score_calificacion >= 80 ? 'success.main' : onboarding.score_calificacion >= 60 ? 'warning.main' : 'error.main'
              }}>
                {Number(onboarding.score_calificacion).toFixed(1)}
              </Typography>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label={t('onboarding_tab_data', 'Datos')} />
          <Tab label={t('onboarding_tab_docs', 'Documentos')} />
          <Tab label={t('onboarding_tab_eval', 'Evaluación')} />
          <Tab label={t('onboarding_tab_history', 'Historial')} />
        </Tabs>

        {/* Tab 0: Data */}
        {tabValue === 0 && (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  label={t('onboarding_razon_social', 'Razón Social')}
                  value={editForm.razon_social || ''}
                  onChange={(e) => handleEditChange('razon_social', e.target.value)}
                  fullWidth
                  size="small"
                  disabled={!canEdit}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label={t('onboarding_cuit', 'CUIT')}
                  value={editForm.cuit || ''}
                  onChange={(e) => handleEditChange('cuit', e.target.value)}
                  fullWidth
                  size="small"
                  disabled
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('onboarding_rubro', 'Rubro')}
                  value={editForm.rubro || ''}
                  onChange={(e) => handleEditChange('rubro', e.target.value)}
                  fullWidth
                  size="small"
                  disabled={!canEdit}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('onboarding_contacto_nombre', 'Nombre Contacto')}
                  value={editForm.contacto_nombre || ''}
                  onChange={(e) => handleEditChange('contacto_nombre', e.target.value)}
                  fullWidth
                  size="small"
                  disabled={!canEdit}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('onboarding_contacto_email', 'Email')}
                  value={editForm.contacto_email || ''}
                  onChange={(e) => handleEditChange('contacto_email', e.target.value)}
                  fullWidth
                  size="small"
                  type="email"
                  disabled={!canEdit}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('onboarding_contacto_telefono', 'Teléfono')}
                  value={editForm.contacto_telefono || ''}
                  onChange={(e) => handleEditChange('contacto_telefono', e.target.value)}
                  fullWidth
                  size="small"
                  disabled={!canEdit}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label={t('onboarding_direccion', 'Dirección')}
                  value={editForm.direccion || ''}
                  onChange={(e) => handleEditChange('direccion', e.target.value)}
                  fullWidth
                  size="small"
                  disabled={!canEdit}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label={t('onboarding_ciudad', 'Ciudad')}
                  value={editForm.ciudad || ''}
                  onChange={(e) => handleEditChange('ciudad', e.target.value)}
                  fullWidth
                  size="small"
                  disabled={!canEdit}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label={t('onboarding_provincia', 'Provincia')}
                  value={editForm.provincia || ''}
                  onChange={(e) => handleEditChange('provincia', e.target.value)}
                  fullWidth
                  size="small"
                  disabled={!canEdit}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label={t('onboarding_pais', 'País')}
                  value={editForm.pais || ''}
                  onChange={(e) => handleEditChange('pais', e.target.value)}
                  fullWidth
                  size="small"
                  disabled={!canEdit}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label={t('onboarding_sitio_web', 'Sitio Web')}
                  value={editForm.sitio_web || ''}
                  onChange={(e) => handleEditChange('sitio_web', e.target.value)}
                  fullWidth
                  size="small"
                  disabled={!canEdit}
                />
              </Grid>
            </Grid>
            {canEdit && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                  onClick={handleSaveData}
                  disabled={saving}
                >
                  {t('onboarding_save', 'Guardar')}
                </Button>
              </Box>
            )}
          </Box>
        )}

        {/* Tab 1: Documents */}
        {tabValue === 1 && (
          <Box sx={{ p: 0 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Button variant="outlined" startIcon={<UploadFileIcon />} size="small" onClick={() => setDocDialogOpen(true)}>
                {t('onboarding_add_doc', 'Agregar Documento')}
              </Button>
            </Box>
            <Box sx={{ height: 400 }}>
              <SPMAgGrid rowData={documentos} columnDefs={docColumnDefs} />
            </Box>
          </Box>
        )}

        {/* Tab 2: Evaluation */}
        {tabValue === 2 && (
          <Box sx={{ p: 0 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="subtitle2">{t('onboarding_total_score', 'Score Total')}:</Typography>
                <Typography variant="h6" sx={{
                  fontWeight: 700,
                  color: onboarding.score_calificacion >= 80 ? 'success.main' : onboarding.score_calificacion >= 60 ? 'warning.main' : 'error.main'
                }}>
                  {Number(onboarding.score_calificacion || 0).toFixed(1) || '--'}
                </Typography>
              </Stack>
              <Button variant="outlined" startIcon={<AddIcon />} size="small" onClick={() => setEvalDialogOpen(true)}>
                {t('onboarding_add_eval', 'Agregar Evaluación')}
              </Button>
            </Box>
            <Box sx={{ height: 400 }}>
              <SPMAgGrid rowData={evaluaciones} columnDefs={evalColumnDefs} />
            </Box>
          </Box>
        )}

        {/* Tab 3: History */}
        {tabValue === 3 && (
          <Box sx={{ p: 3 }}>
            {historial.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                {t('onboarding_no_history', 'Sin historial')}
              </Typography>
            ) : (
              <List>
                {historial.map((entry, idx) => (
                  <ListItem key={entry.id || idx} sx={{ borderLeft: '2px solid', borderColor: 'primary.main', ml: 1, mb: 1, alignItems: 'flex-start' }}>
                    <ListItemIcon sx={{ minWidth: 28, mt: 0.5 }}>
                      <FiberManualRecordIcon color="primary" sx={{ fontSize: 10 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {entry.estado_anterior || 'N/A'} &rarr; {entry.estado_nuevo}
                        </Typography>
                      }
                      secondary={
                        <>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(entry.created_at)}
                          </Typography>
                          {entry.notas && (
                            <Typography variant="caption" display="block" color="text.secondary">{entry.notas}</Typography>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </Paper>

      {/* Add Document Dialog */}
      <Dialog open={docDialogOpen} onClose={() => setDocDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('onboarding_add_doc_title', 'Agregar Documento')}</DialogTitle>
        <DialogContent>
          <Stack gap={2} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>{t('onboarding_doc_tipo', 'Tipo Documento')}</InputLabel>
              <Select
                value={docForm.tipo_documento}
                label={t('onboarding_doc_tipo', 'Tipo Documento')}
                onChange={(e) => setDocForm((prev) => ({ ...prev, tipo_documento: e.target.value }))}
              >
                {TIPO_DOC_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('onboarding_doc_nombre', 'Nombre Archivo')}
              value={docForm.nombre_archivo}
              onChange={(e) => setDocForm((prev) => ({ ...prev, nombre_archivo: e.target.value }))}
              fullWidth
              size="small"
              required
            />
            <TextField
              label={t('onboarding_doc_path', 'Path/URL')}
              value={docForm.path}
              onChange={(e) => setDocForm((prev) => ({ ...prev, path: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label={t('onboarding_doc_venc', 'Fecha Vencimiento')}
              value={docForm.fecha_vencimiento}
              onChange={(e) => setDocForm((prev) => ({ ...prev, fecha_vencimiento: e.target.value }))}
              fullWidth
              size="small"
              type="date"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDocDialogOpen(false)} disabled={addingDoc}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={handleAddDocument}
            disabled={addingDoc || !docForm.tipo_documento || !docForm.nombre_archivo.trim()}
            startIcon={addingDoc ? <CircularProgress size={16} /> : <UploadFileIcon />}
          >
            {t('onboarding_add', 'Agregar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Evaluation Dialog */}
      <Dialog open={evalDialogOpen} onClose={() => setEvalDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('onboarding_add_eval_title', 'Agregar Evaluación')}</DialogTitle>
        <DialogContent>
          <Stack gap={2} sx={{ mt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>{t('onboarding_eval_criterio', 'Criterio')}</InputLabel>
              <Select
                value={evalForm.criterio}
                label={t('onboarding_eval_criterio', 'Criterio')}
                onChange={(e) => handleCriterioChange(e.target.value)}
              >
                {CRITERIO_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('onboarding_eval_puntaje', 'Puntaje (0-100)')}
              value={evalForm.puntaje}
              onChange={(e) => setEvalForm((prev) => ({ ...prev, puntaje: e.target.value }))}
              fullWidth
              size="small"
              type="number"
              inputProps={{ min: 0, max: 100, step: 0.1 }}
              required
            />
            <TextField
              label={t('onboarding_eval_peso', 'Peso')}
              value={evalForm.peso}
              onChange={(e) => setEvalForm((prev) => ({ ...prev, peso: e.target.value }))}
              fullWidth
              size="small"
              type="number"
              inputProps={{ min: 0, step: 0.1 }}
            />
            <TextField
              label={t('onboarding_eval_comentarios', 'Comentarios')}
              value={evalForm.comentarios}
              onChange={(e) => setEvalForm((prev) => ({ ...prev, comentarios: e.target.value }))}
              fullWidth
              size="small"
              multiline
              rows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEvalDialogOpen(false)} disabled={addingEval}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={handleAddEvaluation}
            disabled={addingEval || !evalForm.criterio || evalForm.puntaje === ''}
            startIcon={addingEval ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {t('onboarding_add', 'Agregar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('onboarding_approve_title', 'Confirmar Aprobación')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t('onboarding_approve_confirm', '¿Está seguro que desea aprobar este onboarding? Se creará el proveedor en el sistema.')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setApproveDialogOpen(false)} disabled={processingApproval}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleApprove}
            disabled={processingApproval}
            startIcon={processingApproval ? <CircularProgress size={16} /> : <ThumbUpIcon />}
          >
            {t('onboarding_approve', 'Aprobar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('onboarding_reject_title', 'Rechazar Onboarding')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('onboarding_reject_reason', 'Razón de Rechazo')}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={4}
            sx={{ mt: 1 }}
            required
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={processingApproval}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReject}
            disabled={processingApproval || !rejectReason.trim()}
            startIcon={processingApproval ? <CircularProgress size={16} /> : <ThumbDownIcon />}
          >
            {t('onboarding_reject', 'Rechazar')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
