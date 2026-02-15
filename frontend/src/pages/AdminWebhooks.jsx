import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WebhookIcon from '@mui/icons-material/Webhook';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const AVAILABLE_EVENTS = [
  { value: 'solicitud.aprobada', label: 'Solicitud Aprobada' },
  { value: 'solicitud.rechazada', label: 'Solicitud Rechazada' },
];

const INITIAL_FORM = {
  url: '',
  secret: '',
  eventos: [],
  activo: true,
};

export default function AdminWebhooks() {
  const { t } = useI18n();
  const toast = useToast();

  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deliveries, setDeliveries] = useState({});
  const [loadingDeliveries, setLoadingDeliveries] = useState({});
  const [generatedSecret, setGeneratedSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState({});

  const fetchWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/webhooks?activo_only=false');
      if (res.data?.ok) {
        setWebhooks(res.data.webhooks || []);
      }
    } catch {
      toast.error(t('webhooks_error_load', 'Error al cargar webhooks'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleOpenDialog = useCallback((webhook = null) => {
    if (webhook) {
      setEditingId(webhook.id);
      const eventos = typeof webhook.eventos === 'string'
        ? JSON.parse(webhook.eventos)
        : webhook.eventos || [];
      setForm({
        url: webhook.url || '',
        secret: webhook.secret || '',
        eventos,
        activo: webhook.activo !== 0 && webhook.activo !== false,
      });
      setGeneratedSecret('');
      setShowSecret(false);
    } else {
      setEditingId(null);
      // Generate a random secret for new webhooks
      const newSecret = Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      setForm({ ...INITIAL_FORM, secret: newSecret });
      setGeneratedSecret(newSecret);
      setShowSecret(true);
    }
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setGeneratedSecret('');
    setShowSecret(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.url) {
      toast.error(t('webhooks_url_required', 'URL es requerida'));
      return;
    }
    if (form.eventos.length === 0) {
      toast.error(t('webhooks_events_required', 'Debes seleccionar al menos un evento'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        url: form.url,
        secret: form.secret,
        eventos: form.eventos,
        activo: form.activo ? 1 : 0,
      };

      if (editingId) {
        await api.put(`/webhooks/${editingId}`, payload);
        toast.success(t('webhooks_updated', 'Webhook actualizado'));
      } else {
        const res = await api.post('/webhooks', payload);
        toast.success(t('webhooks_created', 'Webhook creado'));
        // Show secret one more time after creation
        if (res.data?.secret) {
          setGeneratedSecret(res.data.secret);
          setShowSecret(true);
        }
      }

      handleCloseDialog();
      fetchWebhooks();
    } catch (err) {
      toast.error(err.response?.data?.error || t('webhooks_error_save', 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  }, [form, editingId, fetchWebhooks, handleCloseDialog, t]);

  const handleDelete = useCallback((id) => {
    setConfirmDeleteId(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.delete(`/webhooks/${id}`);
      toast.success(t('webhooks_deleted', 'Webhook eliminado'));
      fetchWebhooks();
    } catch {
      toast.error(t('webhooks_error_delete', 'Error al eliminar'));
    }
  }, [confirmDeleteId, fetchWebhooks, t]);

  const handleTestWebhook = useCallback(async (webhookId) => {
    setTesting((prev) => ({ ...prev, [webhookId]: true }));
    try {
      const res = await api.post(`/webhooks/${webhookId}/test`);
      if (res.data?.ok) {
        toast.success(t('webhooks_test_success', 'Test exitoso'));
      } else {
        toast.error(t('webhooks_test_failed', `Test falló: ${res.data?.error || 'error desconocido'}`));
      }
      // Refresh deliveries after test
      loadDeliveries(webhookId);
    } catch (err) {
      toast.error(t('webhooks_test_error', 'Error al enviar test'));
    } finally {
      setTesting((prev) => ({ ...prev, [webhookId]: false }));
    }
  }, [t]);

  const loadDeliveries = useCallback(async (webhookId) => {
    setLoadingDeliveries((prev) => ({ ...prev, [webhookId]: true }));
    try {
      const res = await api.get(`/webhooks/${webhookId}/deliveries?limit=10`);
      if (res.data?.ok) {
        setDeliveries((prev) => ({ ...prev, [webhookId]: res.data.deliveries || [] }));
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingDeliveries((prev) => ({ ...prev, [webhookId]: false }));
    }
  }, []);

  const handleCopySecret = useCallback(() => {
    navigator.clipboard.writeText(form.secret);
    toast.success(t('webhooks_secret_copied', 'Secret copiado al portapapeles'));
  }, [form.secret, t]);

  const columnDefs = [
    {
      field: 'url',
      headerName: t('webhooks_url', 'URL'),
      flex: 1,
      minWidth: 250,
    },
    {
      field: 'eventos',
      headerName: t('webhooks_events', 'Eventos'),
      width: 250,
      valueFormatter: (p) => {
        if (!p.value) return '';
        try {
          const eventos = typeof p.value === 'string' ? JSON.parse(p.value) : p.value;
          return eventos.join(', ');
        } catch {
          return p.value;
        }
      },
    },
    {
      field: 'activo',
      headerName: t('common_estado', 'Estado'),
      width: 100,
      cellRenderer: (p) => p.value ? t('auto_approval_activa', 'Activa') : t('auto_approval_inactiva', 'Inactiva'),
    },
    {
      field: 'created_at',
      headerName: t('common_fecha', 'Fecha'),
      width: 180,
      valueFormatter: (p) => p.value ? new Date(p.value).toLocaleString() : '',
    },
    {
      headerName: t('common_acciones', 'Acciones'),
      width: 180,
      sortable: false,
      filter: false,
      cellRenderer: (p) => (
        <Stack direction="row" spacing={0.5} sx={{ height: '100%', alignItems: 'center' }}>
          <Tooltip title={t('webhooks_test', 'Enviar test')}>
            <span>
              <IconButton
                size="small"
                onClick={() => handleTestWebhook(p.data.id)}
                disabled={testing[p.data.id]}
                aria-label={t('webhooks_test', 'Enviar test')}
              >
                {testing[p.data.id] ? (
                  <CircularProgress size={16} />
                ) : (
                  <SendIcon fontSize="small" color="action" />
                )}
              </IconButton>
            </span>
          </Tooltip>
          <IconButton size="small" onClick={() => handleOpenDialog(p.data)} aria-label={t('admin_editar', 'Editar')}>
            <EditIcon fontSize="small" color="primary" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDelete(p.data.id)} aria-label={t('admin_eliminar', 'Eliminar')}>
            <DeleteIcon fontSize="small" color="error" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" gap={1}>
          <WebhookIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('webhooks_title', 'Webhooks Externos')}
          </Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          {t('webhooks_new', 'Nuevo Webhook')}
        </Button>
      </Stack>

      <Alert severity="info" sx={{ borderRadius: 2 }}>
        {t('webhooks_info', 'Los webhooks permiten enviar eventos de solicitudes aprobadas/rechazadas a sistemas externos. El secret se usa para firmar las peticiones con HMAC-SHA256.')}
      </Alert>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }} aria-label={t('webhooks_title', 'Webhooks Externos')}>
        <SPMAgGrid
          columnDefs={columnDefs}
          rowData={webhooks}
          loading={loading}
          height={400}
          enableQuickFilter={true}
          exportFileName="webhooks"
          emptyMessage={t('webhooks_empty', 'No hay webhooks configurados')}
        />
      </Paper>

      {/* Deliveries Accordion */}
      {webhooks.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            {t('webhooks_deliveries', 'Historial de Entregas')}
          </Typography>
          {webhooks.map((wh) => (
            <Accordion key={wh.id} onChange={(_, expanded) => expanded && loadDeliveries(wh.id)}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {wh.url}
                  </Typography>
                  <Chip
                    size="small"
                    label={wh.activo ? t('auto_approval_activa', 'Activa') : t('auto_approval_inactiva', 'Inactiva')}
                    color={wh.activo ? 'success' : 'default'}
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                {loadingDeliveries[wh.id] ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : deliveries[wh.id]?.length > 0 ? (
                  <Stack spacing={1}>
                    {deliveries[wh.id].map((delivery) => (
                      <Paper key={delivery.id} sx={{ p: 1.5, bgcolor: 'background.default' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack direction="row" alignItems="center" gap={1}>
                            {delivery.success ? (
                              <CheckCircleIcon fontSize="small" color="success" />
                            ) : (
                              <ErrorIcon fontSize="small" color="error" />
                            )}
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {delivery.evento}
                            </Typography>
                            {delivery.status_code && (
                              <Chip size="small" label={delivery.status_code} />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(delivery.created_at).toLocaleString()}
                          </Typography>
                        </Stack>
                        {delivery.response_body && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            {delivery.response_body.substring(0, 200)}
                            {delivery.response_body.length > 200 && '...'}
                          </Typography>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('webhooks_no_deliveries', 'Sin entregas registradas')}
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <WebhookIcon color="primary" />
            <Typography variant="h6">
              {editingId ? t('webhooks_edit', 'Editar Webhook') : t('webhooks_new_dialog', 'Nuevo Webhook')}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label={t('webhooks_url', 'URL')}
              value={form.url}
              onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
              fullWidth
              required
              placeholder="https://ejemplo.com/webhook"
            />

            <Box>
              <TextField
                label={t('webhooks_secret', 'Secret')}
                value={form.secret}
                onChange={(e) => setForm((prev) => ({ ...prev, secret: e.target.value }))}
                fullWidth
                required
                type={showSecret ? 'text' : 'password'}
                helperText={editingId ? t('webhooks_secret_help_edit', 'Dejar en blanco para mantener el secret actual') : t('webhooks_secret_help', 'Guarda este secret, solo se muestra al crear')}
                InputProps={{
                  endAdornment: (
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => setShowSecret((prev) => !prev)}>
                        {showSecret ? '👁️' : '👁️‍🗨️'}
                      </IconButton>
                      <IconButton size="small" onClick={handleCopySecret}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ),
                }}
              />
              {generatedSecret && showSecret && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {t('webhooks_secret_warning', 'Guarda este secret ahora. No podrás verlo después de cerrar este diálogo.')}
                </Alert>
              )}
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                {t('webhooks_events', 'Eventos')}
              </Typography>
              <FormGroup>
                {AVAILABLE_EVENTS.map((evt) => (
                  <FormControlLabel
                    key={evt.value}
                    control={
                      <Checkbox
                        checked={form.eventos.includes(evt.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm((prev) => ({ ...prev, eventos: [...prev.eventos, evt.value] }));
                          } else {
                            setForm((prev) => ({ ...prev, eventos: prev.eventos.filter((v) => v !== evt.value) }));
                          }
                        }}
                      />
                    }
                    label={evt.label}
                  />
                ))}
              </FormGroup>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={form.activo}
                  onChange={(e) => setForm((prev) => ({ ...prev, activo: e.target.checked }))}
                />
              }
              label={t('webhooks_active', 'Webhook activo')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving && <CircularProgress size={16} />}
          >
            {editingId ? t('common_guardar', 'Guardar') : t('admin_crear', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} maxWidth="xs">
        <DialogTitle>{t('webhooks_confirm_delete', '¿Eliminar este webhook?')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('auto_approval_confirm_delete_desc', 'Esta acción no se puede deshacer.')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>
            {t('common_eliminar', 'Eliminar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
