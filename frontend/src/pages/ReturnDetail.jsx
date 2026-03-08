/**
 * ReturnDetail - RMA detail page with timeline
 *
 * Shows return header, items table, credit tracking with progress bar,
 * timeline of status changes, and action buttons for status/credit.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import LinearProgress from '@mui/material/LinearProgress';
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
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import TimelineIcon from '@mui/icons-material/Timeline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_COLORS = {
  draft: 'default',
  pending_approval: 'warning',
  approved: 'info',
  in_transit: 'info',
  received_by_supplier: 'success',
  credit_issued: 'success',
  closed: 'default',
  cancelled: 'error',
};

const ESTADO_LABELS = {
  draft: 'Borrador',
  pending_approval: 'Pend. Aprobacion',
  approved: 'Aprobado',
  in_transit: 'En Transito',
  received_by_supplier: 'Recibido por Proveedor',
  credit_issued: 'Credito Emitido',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
};

const TIPO_LABELS = {
  defectuoso: 'Defectuoso',
  excedente: 'Excedente',
  incorrecto: 'Incorrecto',
  garantia: 'Garantia',
};

const STATUS_TRANSITIONS = [
  { value: 'pending_approval', label: 'Enviar a Aprobacion' },
  { value: 'approved', label: 'Aprobar' },
  { value: 'in_transit', label: 'En Transito' },
  { value: 'received_by_supplier', label: 'Recibido por Proveedor' },
  { value: 'credit_issued', label: 'Credito Emitido' },
  { value: 'closed', label: 'Cerrar' },
  { value: 'cancelled', label: 'Cancelar' },
];

export default function ReturnDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();

  const [rma, setRma] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Status dialog
  const [statusOpen, setStatusOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');

  // Credit dialog
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');

  const fetchReturn = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/returns/${id}`);
      if (res.data?.ok) {
        setRma(res.data.return || res.data.devolucion || res.data);
      }
    } catch {
      toast.error(t('returns_error_detail', 'Error al cargar devolucion'));
    } finally {
      setLoading(false);
    }
  }, [id, t, toast]);

  useEffect(() => { fetchReturn(); }, [fetchReturn]);

  const handleStatusChange = useCallback(async () => {
    if (!targetStatus) return;
    setProcessing(true);
    try {
      const res = await api.put(`/returns/${id}/status`, { estado: targetStatus });
      if (res.data?.ok) {
        toast.success(t('returns_status_updated', 'Estado actualizado'));
        setStatusOpen(false);
        setTargetStatus('');
        fetchReturn();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('returns_error_status', 'Error al cambiar estado'));
    } finally {
      setProcessing(false);
    }
  }, [id, targetStatus, fetchReturn, t, toast]);

  const handleRegisterCredit = useCallback(async () => {
    if (!creditAmount) {
      toast.warning(t('returns_credit_required', 'Ingrese monto del credito'));
      return;
    }
    setProcessing(true);
    try {
      const res = await api.put(`/returns/${id}/credit`, { monto_credito_recibido: Number(creditAmount) });
      if (res.data?.ok) {
        toast.success(t('returns_credit_registered', 'Credito registrado'));
        setCreditOpen(false);
        setCreditAmount('');
        fetchReturn();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('returns_error_credit', 'Error al registrar credito'));
    } finally {
      setProcessing(false);
    }
  }, [id, creditAmount, fetchReturn, t, toast]);

  const itemColumns = useMemo(() => [
    { field: 'material_codigo', headerName: t('returns_material', 'Material'), flex: 1, minWidth: 140 },
    { field: 'cantidad', headerName: t('returns_cantidad', 'Cantidad'), width: 120, type: 'numericColumn' },
    { field: 'motivo_detalle', headerName: t('returns_motivo_detalle', 'Motivo Detalle'), flex: 2, minWidth: 200 },
  ], [t]);

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
        <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Skeleton variant="rectangular" height={40} width={300} />
          <Skeleton variant="rectangular" height={180} />
          <Skeleton variant="rectangular" height={300} />
        </Box>
      </Box>
    );
  }

  if (!rma) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
        <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 4 }}>
          <Alert severity="error">{t('returns_not_found', 'Devolucion no encontrada')}</Alert>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/operations/returns')} sx={{ mt: 2 }}>
            {t('common_volver', 'Volver')}
          </Button>
        </Box>
      </Box>
    );
  }

  const estado = rma.estado || 'draft';
  const items = rma.items || [];
  const historial = rma.historial || rma.devolucion_historial || [];
  const creditoEsperado = rma.monto_credito_esperado || 0;
  const creditoRecibido = rma.monto_credito_recibido || 0;
  const creditProgress = creditoEsperado > 0 ? Math.min((creditoRecibido / creditoEsperado) * 100, 100) : 0;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Back */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/operations/returns')} color="inherit" sx={{ alignSelf: 'flex-start' }}>
        {t('common_volver', 'Volver')}
      </Button>

      {/* Header */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
              <AssignmentReturnIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {rma.numero_rma}
              </Typography>
              <Chip size="small" label={TIPO_LABELS[rma.tipo] || rma.tipo} variant="outlined" />
              <Chip size="small" label={ESTADO_LABELS[estado] || estado} color={ESTADO_COLORS[estado] || 'default'} />
            </Stack>
            <Stack spacing={0.5} sx={{ color: 'text.secondary' }}>
              <Typography variant="body2">{t('returns_proveedor', 'Proveedor')}: <strong>{rma.proveedor_cuit}</strong></Typography>
              <Typography variant="body2">{t('returns_motivo', 'Motivo')}: {rma.motivo}</Typography>
              <Typography variant="body2">{t('returns_fecha', 'Fecha')}: {formatDate(rma.created_at)}</Typography>
            </Stack>
          </Box>

          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button variant="outlined" size="small" onClick={() => setStatusOpen(true)}>
              {t('returns_change_status', 'Cambiar Estado')}
            </Button>
            {(estado === 'received_by_supplier' || estado === 'credit_issued') && (
              <Button variant="outlined" size="small" color="success" onClick={() => setCreditOpen(true)}>
                {t('returns_register_credit', 'Registrar Credito')}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Credit Tracking */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>{t('returns_credit_tracking', 'Seguimiento de Credito')}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={3} alignItems="center">
          <Box sx={{ flex: 1, width: '100%' }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">{t('returns_esperado', 'Esperado')}: {formatCurrency(creditoEsperado)}</Typography>
              <Typography variant="body2" color="text.secondary">{t('returns_recibido', 'Recibido')}: {formatCurrency(creditoRecibido)}</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={creditProgress}
              sx={{ height: 12 }}
              color={creditProgress >= 100 ? 'success' : creditProgress >= 50 ? 'warning' : 'error'}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}>
              {Number(creditProgress).toFixed(1)}%
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Items Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2">{t('returns_items', 'Items de la Devolucion')}</Typography>
        </Box>
        <SPMAgGrid
          columnDefs={itemColumns}
          rowData={items}
          loading={false}
          height={250}
          pagination={false}
          enableQuickFilter={false}
          exportFileName="devolucion_items"
          emptyMessage={t('returns_no_items', 'Sin items')}
        />
      </Paper>

      {/* Timeline */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>{t('returns_timeline', 'Historial')}</Typography>
        {historial.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            {t('returns_no_history', 'Sin historial')}
          </Typography>
        ) : (
          <Stack spacing={2}>
            {historial.map((entry, idx) => (
              <Stack key={idx} direction="row" gap={2} alignItems="flex-start">
                <TimelineIcon fontSize="small" sx={{ color: 'primary.main', mt: 0.3 }} />
                <Box>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Chip size="small" label={ESTADO_LABELS[entry.estado_anterior] || entry.estado_anterior} color={ESTADO_COLORS[entry.estado_anterior] || 'default'} variant="outlined" sx={{ fontSize: '0.65rem' }} />
                    <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Chip size="small" label={ESTADO_LABELS[entry.estado_nuevo] || entry.estado_nuevo} color={ESTADO_COLORS[entry.estado_nuevo] || 'default'} sx={{ fontSize: '0.65rem' }} />
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

      {/* Status Change Dialog */}
      <Dialog open={statusOpen} onClose={() => setStatusOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('returns_change_status', 'Cambiar Estado')}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>{t('returns_new_status', 'Nuevo Estado')}</InputLabel>
            <Select value={targetStatus} label={t('returns_new_status', 'Nuevo Estado')} onChange={(e) => setTargetStatus(e.target.value)}>
              {STATUS_TRANSITIONS.filter(s => s.value !== estado).map(s => (
                <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setStatusOpen(false); setTargetStatus(''); }}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleStatusChange} disabled={processing || !targetStatus} startIcon={processing && <CircularProgress size={16} />}>
            {t('common_confirmar', 'Confirmar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Register Credit Dialog */}
      <Dialog open={creditOpen} onClose={() => setCreditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('returns_register_credit', 'Registrar Credito')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('returns_credit_amount', 'Monto del Credito (USD)')}
            type="number"
            value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreditOpen(false)}>{t('common_cancelar', 'Cancelar')}</Button>
          <Button variant="contained" onClick={handleRegisterCredit} disabled={processing} startIcon={processing && <CircularProgress size={16} />}>
            {t('common_registrar', 'Registrar')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
