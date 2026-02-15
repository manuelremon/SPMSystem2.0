/**
 * LotDetail - Lot detail page with traceability
 *
 * Shows lot header info with tabs for Info, Movimientos, Forward traceability,
 * and Backward traceability. Includes action buttons for block/unblock and consume.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatDate, formatDateTime } from '../utils/formatters';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Collapse from '@mui/material/Collapse';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import InfoIcon from '@mui/icons-material/Info';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import BlockIcon from '@mui/icons-material/Block';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_COLORS = {
  available: 'success',
  blocked: 'error',
  consumed: 'default',
  expired: 'warning',
  in_inspection: 'info',
};

const ESTADO_LABELS = {
  available: 'Disponible',
  blocked: 'Bloqueado',
  consumed: 'Consumido',
  expired: 'Vencido',
  in_inspection: 'En Inspeccion',
};

const CALIDAD_COLORS = {
  approved: 'success',
  pending: 'warning',
  rejected: 'error',
};

const CALIDAD_LABELS = {
  approved: 'Aprobado',
  pending: 'Pendiente',
  rejected: 'Rechazado',
};

const MOV_TIPO_COLORS = {
  ingreso: 'success',
  consumo: 'warning',
  transferencia: 'info',
  ajuste: 'default',
  bloqueo: 'error',
  desbloqueo: 'success',
};

// Recursive traceability tree node
function TraceNode({ node, level = 0 }) {
  const [expanded, setExpanded] = useState(level < 2);
  const children = node.children || node.lotes || [];
  const hasChildren = children.length > 0;

  return (
    <Box sx={{ ml: level * 3 }}>
      <ListItem
        sx={{ py: 0.5, cursor: hasChildren ? 'pointer' : 'default' }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          {hasChildren ? (expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />) : <SubdirectoryArrowRightIcon fontSize="small" color="disabled" />}
        </ListItemIcon>
        <ListItemText
          primary={
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {node.numero_lote || node.referencia || '-'}
              </Typography>
              {node.material_codigo && (
                <Chip size="small" label={node.material_codigo} variant="outlined" sx={{ fontSize: '0.7rem' }} />
              )}
              {node.cantidad != null && (
                <Typography variant="caption" color="text.secondary">
                  Qty: {node.cantidad}
                </Typography>
              )}
            </Stack>
          }
          secondary={node.descripcion || node.destino || node.origen || null}
        />
      </ListItem>
      {hasChildren && (
        <Collapse in={expanded}>
          {children.map((child, idx) => (
            <TraceNode key={idx} node={child} level={level + 1} />
          ))}
        </Collapse>
      )}
    </Box>
  );
}

export default function LotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();

  const [lote, setLote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  // Traceability data
  const [forwardTrace, setForwardTrace] = useState([]);
  const [backwardTrace, setBackwardTrace] = useState([]);
  const [loadingForward, setLoadingForward] = useState(false);
  const [loadingBackward, setLoadingBackward] = useState(false);

  // Consume dialog
  const [consumeOpen, setConsumeOpen] = useState(false);
  const [consumeQty, setConsumeQty] = useState('');
  const [consuming, setConsuming] = useState(false);

  // Block dialog
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);

  const fetchLote = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/lots/${id}`);
      if (res.data?.ok) {
        setLote(res.data.lote || res.data);
      }
    } catch {
      toast.error(t('lot_error_detail', 'Error al cargar lote'));
    } finally {
      setLoading(false);
    }
  }, [id, t, toast]);

  const fetchForwardTrace = useCallback(async () => {
    setLoadingForward(true);
    try {
      const res = await api.get(`/lots/${id}/traceability/forward`);
      if (res.data?.ok) {
        setForwardTrace(res.data.nodes || res.data.traceability || []);
      }
    } catch {
      toast.error(t('lot_error_forward', 'Error al cargar trazabilidad forward'));
    } finally {
      setLoadingForward(false);
    }
  }, [id, t, toast]);

  const fetchBackwardTrace = useCallback(async () => {
    setLoadingBackward(true);
    try {
      const res = await api.get(`/lots/${id}/traceability/backward`);
      if (res.data?.ok) {
        setBackwardTrace(res.data.nodes || res.data.traceability || []);
      }
    } catch {
      toast.error(t('lot_error_backward', 'Error al cargar trazabilidad backward'));
    } finally {
      setLoadingBackward(false);
    }
  }, [id, t, toast]);

  useEffect(() => { fetchLote(); }, [fetchLote]);

  useEffect(() => {
    if (tabValue === 2) fetchForwardTrace();
    if (tabValue === 3) fetchBackwardTrace();
  }, [tabValue, fetchForwardTrace, fetchBackwardTrace]);

  // Consume
  const handleConsume = useCallback(async () => {
    if (!consumeQty) return;
    setConsuming(true);
    try {
      const res = await api.post(`/lots/${id}/consume`, { cantidad: Number(consumeQty) });
      if (res.data?.ok) {
        toast.success(t('lot_consumed', 'Consumo registrado'));
        setConsumeOpen(false);
        setConsumeQty('');
        fetchLote();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('lot_error_consume', 'Error al consumir'));
    } finally {
      setConsuming(false);
    }
  }, [id, consumeQty, fetchLote, t, toast]);

  // Block/Unblock
  const handleBlockToggle = useCallback(async () => {
    setBlocking(true);
    try {
      const isBlocked = lote?.estado === 'blocked';
      const endpoint = isBlocked ? `/lots/${id}/unblock` : `/lots/${id}/block`;
      const payload = isBlocked ? {} : { razon: blockReason };
      const res = await api.put(endpoint, payload);
      if (res.data?.ok) {
        toast.success(isBlocked ? t('lot_unblocked', 'Lote desbloqueado') : t('lot_blocked', 'Lote bloqueado'));
        setBlockOpen(false);
        setBlockReason('');
        fetchLote();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('lot_error_block', 'Error al bloquear/desbloquear'));
    } finally {
      setBlocking(false);
    }
  }, [id, lote, blockReason, fetchLote, t, toast]);

  const movimientoColumnDefs = useMemo(() => [
    {
      field: 'fecha',
      headerName: t('lot_col_fecha', 'Fecha'),
      width: 160,
      valueFormatter: (p) => formatDateTime(p.value),
    },
    {
      field: 'tipo',
      headerName: t('lot_col_tipo', 'Tipo'),
      width: 130,
      cellRenderer: (p) => (
        <Chip size="small" label={p.value || '-'} color={MOV_TIPO_COLORS[p.value] || 'default'} variant="outlined" />
      ),
    },
    { field: 'cantidad', headerName: t('lot_col_cantidad', 'Cantidad'), width: 110, type: 'numericColumn' },
    { field: 'origen', headerName: t('lot_col_origen', 'Origen'), flex: 1, minWidth: 120 },
    { field: 'destino', headerName: t('lot_col_destino', 'Destino'), flex: 1, minWidth: 120 },
    { field: 'usuario', headerName: t('lot_col_usuario', 'Usuario'), width: 130 },
    { field: 'observaciones', headerName: t('lot_col_observaciones', 'Observaciones'), flex: 2, minWidth: 200 },
  ], [t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
        <Skeleton variant="rectangular" height={40} width={300} />
        <Skeleton variant="rectangular" height={180} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
    );
  }

  if (!lote) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{t('lot_not_found', 'Lote no encontrado')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/operations/lots')} sx={{ mt: 2 }}>
          {t('common_volver', 'Volver')}
        </Button>
      </Box>
    );
  }

  const estado = lote.estado || 'available';
  const calidad = lote.calidad || null;
  const movimientos = lote.movimientos || [];
  const isBlocked = estado === 'blocked';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Back */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/operations/lots')} color="inherit" sx={{ alignSelf: 'flex-start' }}>
        {t('common_volver', 'Volver')}
      </Button>

      {/* Header */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
              <QrCode2Icon sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {lote.numero_lote}
              </Typography>
              <Chip size="small" label={ESTADO_LABELS[estado] || estado} color={ESTADO_COLORS[estado] || 'default'} />
              {calidad && (
                <Chip size="small" label={CALIDAD_LABELS[calidad] || calidad} color={CALIDAD_COLORS[calidad] || 'default'} variant="outlined" />
              )}
            </Stack>
            <Stack spacing={0.5} sx={{ color: 'text.secondary' }}>
              <Typography variant="body2">{t('lot_material', 'Material')}: <strong>{lote.material_codigo}</strong> {lote.material_descripcion && `- ${lote.material_descripcion}`}</Typography>
              <Typography variant="body2">{t('lot_proveedor', 'Proveedor')}: <strong>{lote.proveedor_nombre || lote.proveedor_id || '-'}</strong></Typography>
              <Typography variant="body2">{t('lot_vencimiento', 'Vencimiento')}: <strong>{formatDate(lote.fecha_vencimiento) || '-'}</strong></Typography>
            </Stack>
          </Box>

          <Stack direction="row" gap={1} flexWrap="wrap">
            {estado === 'available' && (
              <Button
                variant="outlined"
                size="small"
                color="info"
                startIcon={<RemoveCircleOutlineIcon />}
                onClick={() => setConsumeOpen(true)}
              >
                {t('lot_consumir', 'Consumir')}
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              color={isBlocked ? 'success' : 'error'}
              startIcon={isBlocked ? <LockOpenIcon /> : <BlockIcon />}
              onClick={() => { setBlockReason(''); setBlockOpen(true); }}
            >
              {isBlocked ? t('lot_desbloquear', 'Desbloquear') : t('lot_bloquear', 'Bloquear')}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={t('lot_tab_info', 'Info')} icon={<InfoIcon />} iconPosition="start" />
          <Tab label={t('lot_tab_movimientos', 'Movimientos')} icon={<SwapHorizIcon />} iconPosition="start" />
          <Tab label={t('lot_tab_forward', 'Forward')} icon={<ArrowForwardIcon />} iconPosition="start" />
          <Tab label={t('lot_tab_backward', 'Backward')} icon={<ArrowBackIosNewIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Info */}
      {tabValue === 0 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            {t('lot_info_title', 'Informacion del Lote')}
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={3}>
            <Paper elevation={0} sx={{ flex: 1, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('lot_info_general', 'Datos Generales')}</Typography>
              <Stack spacing={0.5}>
                <Typography variant="body2">{t('lot_col_numero', 'Numero Lote')}: <strong>{lote.numero_lote}</strong></Typography>
                <Typography variant="body2">{t('lot_col_material', 'Material')}: <strong>{lote.material_codigo}</strong></Typography>
                <Typography variant="body2">{t('lot_col_proveedor', 'Proveedor')}: <strong>{lote.proveedor_nombre || lote.proveedor_id || '-'}</strong></Typography>
                <Typography variant="body2">{t('lot_col_almacen', 'Almacen')}: <strong>{lote.almacen || '-'}</strong></Typography>
                <Typography variant="body2">{t('lot_col_ubicacion', 'Ubicacion')}: <strong>{lote.ubicacion || '-'}</strong></Typography>
              </Stack>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('lot_info_cantidades', 'Cantidades')}</Typography>
              <Stack spacing={0.5}>
                <Typography variant="body2">{t('lot_col_inicial', 'Cantidad Inicial')}: <strong>{lote.cantidad_inicial ?? '-'}</strong></Typography>
                <Typography variant="body2">{t('lot_col_disponible', 'Cantidad Disponible')}: <strong>{lote.cantidad_disponible ?? '-'}</strong></Typography>
                <Typography variant="body2">{t('lot_col_estado', 'Estado')}: <Chip size="small" label={ESTADO_LABELS[estado] || estado} color={ESTADO_COLORS[estado] || 'default'} sx={{ ml: 0.5 }} /></Typography>
                <Typography variant="body2">{t('lot_col_calidad', 'Calidad')}: {calidad ? <Chip size="small" label={CALIDAD_LABELS[calidad] || calidad} color={CALIDAD_COLORS[calidad] || 'default'} variant="outlined" sx={{ ml: 0.5 }} /> : '-'}</Typography>
              </Stack>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('lot_info_fechas', 'Fechas')}</Typography>
              <Stack spacing={0.5}>
                <Typography variant="body2">{t('lot_col_vencimiento', 'Vencimiento')}: <strong>{formatDate(lote.fecha_vencimiento) || '-'}</strong></Typography>
                <Typography variant="body2">{t('lot_fecha_ingreso', 'Ingreso')}: <strong>{formatDate(lote.fecha_ingreso || lote.created_at) || '-'}</strong></Typography>
                {lote.fecha_bloqueo && (
                  <Typography variant="body2">{t('lot_fecha_bloqueo', 'Bloqueado')}: <strong>{formatDate(lote.fecha_bloqueo)}</strong></Typography>
                )}
                {lote.razon_bloqueo && (
                  <Typography variant="body2" color="error.main">{t('lot_razon_bloqueo', 'Razon')}: {lote.razon_bloqueo}</Typography>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Paper>
      )}

      {/* Tab 1: Movimientos */}
      {tabValue === 1 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
          aria-label={t('lot_tab_movimientos', 'Movimientos')}
        >
          <SPMAgGrid
            columnDefs={movimientoColumnDefs}
            rowData={movimientos}
            loading={false}
            height={480}
            pagination={true}
            paginationPageSize={20}
            enableQuickFilter={true}
            exportFileName="lote_movimientos"
            emptyMessage={t('lot_empty_movimientos', 'No hay movimientos registrados')}
            getRowId={(params) => String(params.data.id || `${params.data.fecha}-${params.data.tipo}`)}
          />
        </Paper>
      )}

      {/* Tab 2: Forward Traceability */}
      {tabValue === 2 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
            <AccountTreeIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t('lot_forward_title', 'Trazabilidad Forward')}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('lot_forward_desc', 'Donde fue consumido o distribuido este lote.')}
          </Typography>
          {loadingForward ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : forwardTrace.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              {t('lot_no_forward', 'No se encontraron registros de trazabilidad forward')}
            </Typography>
          ) : (
            <List dense>
              {forwardTrace.map((node, idx) => (
                <TraceNode key={idx} node={node} level={0} />
              ))}
            </List>
          )}
        </Paper>
      )}

      {/* Tab 3: Backward Traceability */}
      {tabValue === 3 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
            <AccountTreeIcon color="secondary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t('lot_backward_title', 'Trazabilidad Backward')}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('lot_backward_desc', 'De donde proviene este lote (origen, materia prima).')}
          </Typography>
          {loadingBackward ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : backwardTrace.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              {t('lot_no_backward', 'No se encontraron registros de trazabilidad backward')}
            </Typography>
          ) : (
            <List dense>
              {backwardTrace.map((node, idx) => (
                <TraceNode key={idx} node={node} level={0} />
              ))}
            </List>
          )}
        </Paper>
      )}

      {/* Consume Dialog */}
      <Dialog open={consumeOpen} onClose={() => setConsumeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <RemoveCircleOutlineIcon color="info" />
            <span>{t('lot_consume_title', 'Consumir Lote')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('lot_consume_lote', 'Lote')}: {lote.numero_lote} - {t('lot_consume_disponible', 'Disponible')}: {lote.cantidad_disponible}
            </Typography>
            <TextField
              label={t('lot_field_consume_qty', 'Cantidad a Consumir')}
              type="number"
              value={consumeQty}
              onChange={(e) => setConsumeQty(e.target.value)}
              fullWidth
              required
              size="small"
              inputProps={{ min: 1, max: lote.cantidad_disponible }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConsumeOpen(false)} disabled={consuming}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            color="info"
            onClick={handleConsume}
            disabled={consuming || !consumeQty}
            startIcon={consuming && <CircularProgress size={16} />}
          >
            {t('lot_consumir', 'Consumir')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Block/Unblock Dialog */}
      <Dialog open={blockOpen} onClose={() => setBlockOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            {isBlocked ? <LockOpenIcon color="success" /> : <BlockIcon color="error" />}
            <span>{isBlocked ? t('lot_unblock_title', 'Desbloquear Lote') : t('lot_block_title', 'Bloquear Lote')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('lot_consume_lote', 'Lote')}: {lote.numero_lote}
            </Typography>
            {!isBlocked && (
              <TextField
                label={t('lot_field_razon', 'Razon del Bloqueo')}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                fullWidth
                required
                multiline
                rows={2}
                size="small"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBlockOpen(false)} disabled={blocking}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            color={isBlocked ? 'success' : 'error'}
            onClick={handleBlockToggle}
            disabled={blocking || (!isBlocked && !blockReason.trim())}
            startIcon={blocking && <CircularProgress size={16} />}
          >
            {isBlocked ? t('lot_desbloquear', 'Desbloquear') : t('lot_bloquear', 'Bloquear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
