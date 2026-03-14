/**
 * ContractDetail - Contract detail page with tabs
 *
 * Shows contract header, status actions, and tabs for items,
 * documents, linked POs, and history timeline.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TimelineIcon from '@mui/icons-material/Timeline';

import ContractItems from '../components/Contracts/ContractItems';
import ContractDocuments from '../components/Contracts/ContractDocuments';
import LinkedPOs from '../components/Contracts/LinkedPOs';

const ESTADO_COLORS = {
  draft: 'default',
  under_negotiation: 'warning',
  active: 'success',
  suspended: 'warning',
  expired: 'error',
  terminated: 'error',
};

const ESTADO_LABELS = {
  draft: 'Borrador',
  under_negotiation: 'En Negociacion',
  active: 'Activo',
  suspended: 'Suspendido',
  expired: 'Vencido',
  terminated: 'Terminado',
};

const TIPO_LABELS = {
  blanket_po: 'Orden Abierta',
  fixed_price: 'Precio Fijo',
  time_materials: 'Tiempo y Materiales',
  framework: 'Marco',
};

const STATUS_ACTIONS = {
  draft: [{ target: 'under_negotiation', label: 'Enviar a Negociacion', color: 'warning' }],
  under_negotiation: [{ target: 'active', label: 'Activar', color: 'success' }],
  active: [
    { target: 'suspended', label: 'Suspender', color: 'warning' },
    { target: 'terminated', label: 'Terminar', color: 'error' },
  ],
  suspended: [
    { target: 'active', label: 'Reactivar', color: 'success' },
    { target: 'terminated', label: 'Terminar', color: 'error' },
  ],
};

export default function ContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();

  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);
  const [statusDialog, setStatusDialog] = useState({ open: false, target: '', label: '' });
  const [changingStatus, setChangingStatus] = useState(false);

  const fetchContract = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/contracts/${id}`);
      if (res.data?.ok) {
        setContract(res.data.contract || res.data);
      }
    } catch {
      toast.error(t('contracts_error_detail', 'Error al cargar contrato'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { fetchContract(); }, [fetchContract]);

  const handleStatusChange = useCallback(async () => {
    setChangingStatus(true);
    try {
      const res = await api.put(`/contracts/${id}/status`, { estado: statusDialog.target });
      if (res.data?.ok) {
        toast.success(t('contracts_status_updated', 'Estado actualizado'));
        fetchContract();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('contracts_error_status', 'Error al cambiar estado'));
    } finally {
      setChangingStatus(false);
      setStatusDialog({ open: false, target: '', label: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, statusDialog.target, fetchContract]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
        <Skeleton variant="rectangular" height={40} width={300} />
        <Skeleton variant="rectangular" height={160} />
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  if (!contract) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{t('contracts_not_found', 'Contrato no encontrado')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/procurement/contracts')} sx={{ mt: 2 }}>
          {t('common_volver', 'Volver')}
        </Button>
      </Box>
    );
  }

  const estado = contract.estado || 'draft';
  const actions = STATUS_ACTIONS[estado] || [];
  const historial = contract.historial || [];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Alert for expiring contracts */}
      {contract.alerta_vencimiento === 1 && (
        <Alert severity="warning" icon={<WarningAmberIcon />}>
          {t('contracts_alert_expiring', 'Este contrato esta proximo a vencer. Revise la fecha de vencimiento.')}
        </Alert>
      )}

      {/* Header card */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
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
                {contract.numero_contrato}
              </Typography>
              <Chip size="small" label={ESTADO_LABELS[estado] || estado} color={ESTADO_COLORS[estado] || 'default'} />
            </Stack>
            <Stack spacing={0.5} sx={{ color: 'text.secondary' }}>
              <Typography variant="body2">{t('contracts_proveedor', 'Proveedor')}: <strong>{contract.proveedor_nombre}</strong> {contract.proveedor_cuit && `(${contract.proveedor_cuit})`}</Typography>
              <Typography variant="body2">{t('contracts_tipo', 'Tipo')}: {TIPO_LABELS[contract.tipo] || contract.tipo}</Typography>
              <Typography variant="body2">{t('contracts_periodo', 'Periodo')}: {formatDate(contract.fecha_inicio)} - {formatDate(contract.fecha_vencimiento)}</Typography>
              <Typography variant="body2">{t('contracts_valor', 'Valor Total')}: {formatCurrency(contract.valor_total)} {contract.moneda && contract.moneda !== 'USD' ? `(${contract.moneda})` : ''}</Typography>
              {contract.centro && <Typography variant="body2">{t('contracts_centro', 'Centro')}: {contract.centro}</Typography>}
            </Stack>
          </Box>

          {/* Status action buttons */}
          {actions.length > 0 && (
            <Stack direction="row" gap={1} flexWrap="wrap">
              {actions.map(action => (
                <Button
                  key={action.target}
                  variant="outlined"
                  color={action.color}
                  size="small"
                  onClick={() => setStatusDialog({ open: true, target: action.target, label: action.label })}
                >
                  {t(`contracts_action_${action.target}`, action.label)}
                </Button>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={(_, val) => setCurrentTab(val)} aria-label={t('contracts_tabs', 'Secciones del contrato')} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label={t('contracts_tab_items', 'Items')} />
          <Tab label={t('contracts_tab_docs', 'Documentos')} />
          <Tab label={t('contracts_tab_ocs', 'OCs Vinculadas')} />
          <Tab label={t('contracts_tab_history', 'Historial')} />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {currentTab === 0 && <ContractItems contractId={id} />}
          {currentTab === 1 && <ContractDocuments contractId={id} />}
          {currentTab === 2 && <LinkedPOs contractId={id} />}
          {currentTab === 3 && (
            <Box>
              {historial.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                  {t('contracts_no_history', 'Sin historial')}
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {historial.map((entry, idx) => (
                    <Stack key={idx} direction="row" gap={2} alignItems="flex-start">
                      <TimelineIcon fontSize="small" sx={{ color: 'primary.main', mt: 0.3 }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {entry.accion || entry.evento}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(entry.fecha)} {entry.usuario && `- ${entry.usuario}`}
                        </Typography>
                        {entry.notas && <Typography variant="body2" color="text.secondary">{entry.notas}</Typography>}
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Status change confirmation dialog */}
      <Dialog open={statusDialog.open} onClose={() => setStatusDialog({ open: false, target: '', label: '' })} maxWidth="xs" fullWidth>
        <DialogTitle>{t('contracts_confirm_status', 'Confirmar cambio de estado')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('contracts_confirm_status_msg', `Se cambiara el estado del contrato a "${statusDialog.label}". Esta accion no se puede deshacer.`)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog({ open: false, target: '', label: '' })}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleStatusChange} disabled={changingStatus} startIcon={changingStatus && <CircularProgress size={16} />}>
            {t('contracts_confirm_btn', 'Confirmar')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
