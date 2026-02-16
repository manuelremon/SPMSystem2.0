import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Divider
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import {
  Send as SendIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  CheckCircle as ResolveIcon,
  Upload as UploadIcon,
  ArrowBack as BackIcon,
  FiberManualRecord
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useI18n } from '../context/i18n';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const WarrantyClaimDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  // Estado
  const [reclamo, setReclamo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Modales
  const [openReviewModal, setOpenReviewModal] = useState(false);
  const [openApproveModal, setOpenApproveModal] = useState(false);
  const [openRejectModal, setOpenRejectModal] = useState(false);
  const [openResolveModal, setOpenResolveModal] = useState(false);
  const [openDocumentModal, setOpenDocumentModal] = useState(false);

  // Forms
  const [reviewNotes, setReviewNotes] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [resolveForm, setResolveForm] = useState({
    resolucion: 'reemplazo',
    monto_recuperado: '',
    notas: ''
  });
  const [documentForm, setDocumentForm] = useState({
    nombre: '',
    tipo: 'foto',
    path: ''
  });

  // Cargar reclamo
  useEffect(() => {
    const fetchReclamo = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/api/warranty/claims/${id}`);
        setReclamo(response.data);
      } catch (error) {
        console.error('Error fetching reclamo:', error);
        alert(t('warranty_error_fetch', 'Error al cargar reclamo'));
        navigate('/warranty');
      } finally {
        setLoading(false);
      }
    };

    fetchReclamo();
  }, [id, navigate, t]);

  // Handlers
  const handleSubmit = async () => {
    try {
      await api.put(`/api/warranty/claims/${id}/submit`);
      const response = await api.get(`/api/warranty/claims/${id}`);
      setReclamo(response.data);
    } catch (error) {
      console.error('Error submitting claim:', error);
      alert(t('warranty_error_submit', 'Error al enviar reclamo'));
    }
  };

  const handleReview = async () => {
    try {
      await api.put(`/api/warranty/claims/${id}/review`, { notas: reviewNotes });
      setOpenReviewModal(false);
      setReviewNotes('');
      const response = await api.get(`/api/warranty/claims/${id}`);
      setReclamo(response.data);
    } catch (error) {
      console.error('Error reviewing claim:', error);
      alert(t('warranty_error_review', 'Error al revisar reclamo'));
    }
  };

  const handleApprove = async () => {
    try {
      await api.put(`/api/warranty/claims/${id}/approve`, { notas: approveNotes });
      setOpenApproveModal(false);
      setApproveNotes('');
      const response = await api.get(`/api/warranty/claims/${id}`);
      setReclamo(response.data);
    } catch (error) {
      console.error('Error approving claim:', error);
      alert(t('warranty_error_approve', 'Error al aprobar reclamo'));
    }
  };

  const handleReject = async () => {
    try {
      await api.put(`/api/warranty/claims/${id}/reject`, { notas: rejectNotes });
      setOpenRejectModal(false);
      setRejectNotes('');
      const response = await api.get(`/api/warranty/claims/${id}`);
      setReclamo(response.data);
    } catch (error) {
      console.error('Error rejecting claim:', error);
      alert(t('warranty_error_reject', 'Error al rechazar reclamo'));
    }
  };

  const handleResolve = async () => {
    try {
      await api.put(`/api/warranty/claims/${id}/resolve`, {
        resolucion: resolveForm.resolucion,
        monto_recuperado: parseFloat(resolveForm.monto_recuperado),
        notas: resolveForm.notas
      });
      setOpenResolveModal(false);
      setResolveForm({ resolucion: 'reemplazo', monto_recuperado: '', notas: '' });
      const response = await api.get(`/api/warranty/claims/${id}`);
      setReclamo(response.data);
    } catch (error) {
      console.error('Error resolving claim:', error);
      alert(t('warranty_error_resolve', 'Error al resolver reclamo'));
    }
  };

  const handleAddDocument = async () => {
    try {
      await api.post(`/api/warranty/claims/${id}/documents`, documentForm);
      setOpenDocumentModal(false);
      setDocumentForm({ nombre: '', tipo: 'foto', path: '' });
      const response = await api.get(`/api/warranty/claims/${id}`);
      setReclamo(response.data);
    } catch (error) {
      console.error('Error adding document:', error);
      alert(t('warranty_error_document', 'Error al agregar documento'));
    }
  };

  // AG-Grid columns - Documents
  const documentColumns = [
    {
      field: 'nombre',
      headerName: t('warranty_doc_name', 'Nombre'),
      flex: 1
    },
    {
      field: 'tipo',
      headerName: t('warranty_doc_type', 'Tipo'),
      width: 120,
      cellRenderer: (params) => {
        const colors = { foto: 'primary', factura: 'secondary', informe: 'default', otro: 'default' };
        return <Chip label={params.value} color={colors[params.value]} size="small" />;
      }
    },
    {
      field: 'created_at',
      headerName: t('warranty_doc_created', 'Fecha'),
      width: 150,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : ''
    }
  ];

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('common_loading', 'Cargando...')}</Typography>
      </Box>
    );
  }

  if (!reclamo) {
    return null;
  }

  const estadoColors = {
    draft: 'default',
    submitted: 'info',
    under_review: 'warning',
    approved: 'success',
    rejected: 'error',
    resolved: 'success'
  };

  const tipoColors = {
    defecto: 'error',
    falta: 'warning',
    dano: 'error',
    incumplimiento: 'default'
  };

  const tipoLabels = {
    defecto: 'Defecto',
    falta: 'Falta',
    dano: 'Daño',
    incumplimiento: 'Incumplimiento'
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/warranty')}>
            {t('common_back', 'Volver')}
          </Button>
          <Typography variant="h4">{reclamo.numero_reclamo}</Typography>
          <Chip label={reclamo.estado} color={estadoColors[reclamo.estado]} />
          <Chip label={tipoLabels[reclamo.tipo]} color={tipoColors[reclamo.tipo]} />
        </Box>
        <Box>
          {reclamo.estado === 'draft' && (
            <Button variant="contained" startIcon={<SendIcon />} onClick={handleSubmit}>
              {t('warranty_submit', 'Enviar')}
            </Button>
          )}
          {reclamo.estado === 'submitted' && (
            <Button variant="contained" onClick={() => setOpenReviewModal(true)}>
              {t('warranty_review', 'Revisar')}
            </Button>
          )}
          {reclamo.estado === 'under_review' && (
            <>
              <Button variant="outlined" color="error" startIcon={<CloseIcon />} onClick={() => setOpenRejectModal(true)} sx={{ mr: 2 }}>
                {t('warranty_reject', 'Rechazar')}
              </Button>
              <Button variant="contained" color="success" startIcon={<CheckIcon />} onClick={() => setOpenApproveModal(true)}>
                {t('warranty_approve', 'Aprobar')}
              </Button>
            </>
          )}
          {reclamo.estado === 'approved' && (
            <Button variant="contained" color="success" startIcon={<ResolveIcon />} onClick={() => setOpenResolveModal(true)}>
              {t('warranty_resolve', 'Resolver')}
            </Button>
          )}
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)}>
          <Tab label={t('warranty_tab_data', 'Datos')} />
          <Tab label={t('warranty_tab_documents', 'Documentos')} />
          <Tab label={t('warranty_tab_history', 'Historial')} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('warranty_claim_info', 'Información del Reclamo')}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography><strong>{t('warranty_description', 'Descripción')}:</strong> {reclamo.descripcion}</Typography>
                  <Typography><strong>{t('warranty_affected_qty', 'Cantidad Afectada')}:</strong> {reclamo.cantidad_afectada || '-'}</Typography>
                  <Typography><strong>{t('warranty_estimated_cost', 'Costo Estimado')}:</strong> {reclamo.costo_estimado ? `$${reclamo.costo_estimado.toLocaleString()}` : '-'}</Typography>
                  <Typography><strong>{t('warranty_responsible', 'Responsable')}:</strong> {reclamo.responsable_nombre || '-'}</Typography>
                  <Typography><strong>{t('warranty_created', 'Creado')}:</strong> {new Date(reclamo.created_at).toLocaleString()}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('warranty_info', 'Garantía')}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography><strong>{t('warranty_material', 'Material')}:</strong> {reclamo.garantia.material_codigo} - {reclamo.garantia.material_desc}</Typography>
                  <Typography><strong>{t('warranty_supplier', 'Proveedor')}:</strong> {reclamo.garantia.proveedor_nombre}</Typography>
                  <Typography><strong>{t('warranty_type', 'Tipo')}:</strong> {reclamo.garantia.tipo}</Typography>
                  <Typography><strong>{t('warranty_duration', 'Duración')}:</strong> {reclamo.garantia.duracion_meses} meses</Typography>
                  <Typography><strong>{t('warranty_period', 'Periodo')}:</strong> {new Date(reclamo.garantia.fecha_inicio).toLocaleDateString()} - {new Date(reclamo.garantia.fecha_fin).toLocaleDateString()}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {reclamo.estado === 'resolved' && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t('warranty_resolution', 'Resolución')}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography><strong>{t('warranty_resolution_type', 'Tipo')}:</strong> {reclamo.resolucion}</Typography>
                    <Typography><strong>{t('warranty_recovered', 'Monto Recuperado')}:</strong> ${reclamo.monto_recuperado.toLocaleString()}</Typography>
                    <Typography><strong>{t('warranty_resolved_date', 'Fecha Resolución')}:</strong> {new Date(reclamo.fecha_resolucion).toLocaleString()}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {activeTab === 1 && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setOpenDocumentModal(true)}>
              {t('warranty_add_document', 'Agregar Documento')}
            </Button>
          </Box>
          <Box className="ag-theme-alpine" sx={{ height: 400, width: '100%' }}>
            <AgGridReact
              rowData={reclamo.documentos || []}
              columnDefs={documentColumns}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true
              }}
            />
          </Box>
        </Box>
      )}

      {activeTab === 2 && (
        <List>
          {reclamo.historial && reclamo.historial.map((item, index) => (
            <ListItem key={item.id} alignItems="flex-start" sx={{ mb: 1 }}>
              <ListItemIcon sx={{ mt: 1.5 }}>
                <FiberManualRecord sx={{ fontSize: 12, color: index === 0 ? 'primary.main' : 'grey.400' }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {item.estado_anterior} → {item.estado_nuevo}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(item.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                }
                secondary={
                  <>
                    <Typography variant="body2" color="text.secondary">
                      {item.actor_nombre || t('warranty_system', 'Sistema')}
                    </Typography>
                    {item.notas && (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {item.notas}
                      </Typography>
                    )}
                  </>
                }
              />
              {index < reclamo.historial.length - 1 && <Divider />}
            </ListItem>
          ))}
        </List>
      )}

      {/* Modal Review */}
      <Dialog open={openReviewModal} onClose={() => setOpenReviewModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('warranty_review_title', 'Revisar Reclamo')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label={t('warranty_notes', 'Notas')}
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReviewModal(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleReview} variant="contained">
            {t('warranty_review', 'Revisar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Approve */}
      <Dialog open={openApproveModal} onClose={() => setOpenApproveModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('warranty_approve_title', 'Aprobar Reclamo')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label={t('warranty_notes', 'Notas')}
            value={approveNotes}
            onChange={(e) => setApproveNotes(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenApproveModal(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleApprove} variant="contained" color="success">
            {t('warranty_approve', 'Aprobar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Reject */}
      <Dialog open={openRejectModal} onClose={() => setOpenRejectModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('warranty_reject_title', 'Rechazar Reclamo')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label={t('warranty_notes', 'Notas (Obligatorio)')}
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRejectModal(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleReject} variant="contained" color="error" disabled={!rejectNotes.trim()}>
            {t('warranty_reject', 'Rechazar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Resolve */}
      <Dialog open={openResolveModal} onClose={() => setOpenResolveModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('warranty_resolve_title', 'Resolver Reclamo')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t('warranty_resolution_type', 'Tipo de Resolución')}</InputLabel>
                <Select
                  value={resolveForm.resolucion}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolucion: e.target.value })}
                  label={t('warranty_resolution_type', 'Tipo de Resolución')}
                >
                  <MenuItem value="reemplazo">{t('warranty_resolution_replacement', 'Reemplazo')}</MenuItem>
                  <MenuItem value="credito">{t('warranty_resolution_credit', 'Crédito')}</MenuItem>
                  <MenuItem value="reparacion">{t('warranty_resolution_repair', 'Reparación')}</MenuItem>
                  <MenuItem value="rechazo">{t('warranty_resolution_rejection', 'Rechazo')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label={t('warranty_recovered', 'Monto Recuperado')}
                value={resolveForm.monto_recuperado}
                onChange={(e) => setResolveForm({ ...resolveForm, monto_recuperado: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label={t('warranty_notes', 'Notas')}
                value={resolveForm.notas}
                onChange={(e) => setResolveForm({ ...resolveForm, notas: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenResolveModal(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleResolve} variant="contained" color="success" disabled={!resolveForm.monto_recuperado}>
            {t('warranty_resolve', 'Resolver')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Add Document */}
      <Dialog open={openDocumentModal} onClose={() => setOpenDocumentModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('warranty_add_document_title', 'Agregar Documento')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('warranty_doc_name', 'Nombre')}
                value={documentForm.nombre}
                onChange={(e) => setDocumentForm({ ...documentForm, nombre: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t('warranty_doc_type', 'Tipo')}</InputLabel>
                <Select
                  value={documentForm.tipo}
                  onChange={(e) => setDocumentForm({ ...documentForm, tipo: e.target.value })}
                  label={t('warranty_doc_type', 'Tipo')}
                >
                  <MenuItem value="foto">{t('warranty_doc_photo', 'Foto')}</MenuItem>
                  <MenuItem value="factura">{t('warranty_doc_invoice', 'Factura')}</MenuItem>
                  <MenuItem value="informe">{t('warranty_doc_report', 'Informe')}</MenuItem>
                  <MenuItem value="otro">{t('warranty_doc_other', 'Otro')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('warranty_doc_path', 'Ruta/URL')}
                value={documentForm.path}
                onChange={(e) => setDocumentForm({ ...documentForm, path: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDocumentModal(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleAddDocument} variant="contained" disabled={!documentForm.nombre.trim()}>
            {t('common_add', 'Agregar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WarrantyClaimDetail;
