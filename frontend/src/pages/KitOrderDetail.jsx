/**
 * KitOrderDetail - Kit order detail page
 *
 * Shows order header with status/priority chips, availability indicators,
 * components AG-Grid table, and action buttons based on current estado.
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
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BuildIcon from '@mui/icons-material/Build';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import VerifiedIcon from '@mui/icons-material/Verified';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_COLORS = {
  draft: 'default',
  released: 'info',
  allocated: 'warning',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'error',
};

const ESTADO_LABELS = {
  draft: 'Borrador',
  released: 'Liberada',
  allocated: 'Asignada',
  in_progress: 'En Proceso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const PRIORIDAD_COLORS = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
};

const PRIORIDAD_LABELS = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

const COMPONENT_ESTADO_COLORS = {
  pending: 'default',
  allocated: 'warning',
  consumed: 'success',
  short: 'error',
};

const COMPONENT_ESTADO_LABELS = {
  pending: 'Pendiente',
  allocated: 'Asignado',
  consumed: 'Consumido',
  short: 'Faltante',
};

export default function KitOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/kitting/orders/${id}`);
      if (res.data?.ok) {
        setOrder(res.data.order || res.data);
      }
    } catch {
      toast.error(t('kit_error_detail', 'Error al cargar orden de kit'));
    } finally {
      setLoading(false);
    }
  }, [id, t, toast]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleCheckAvailability = useCallback(async () => {
    setAvailLoading(true);
    try {
      const res = await api.get(`/kitting/orders/${id}/availability`);
      if (res.data?.ok) {
        setAvailability(res.data.availability || res.data.components || []);
        toast.success(t('kit_avail_checked', 'Disponibilidad verificada'));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('kit_error_avail', 'Error al verificar disponibilidad'));
    } finally {
      setAvailLoading(false);
    }
  }, [id, t, toast]);

  const handleAllocate = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await api.post(`/kitting/orders/${id}/allocate`);
      if (res.data?.ok) {
        toast.success(t('kit_allocated', 'Componentes asignados'));
        fetchOrder();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('kit_error_allocate', 'Error al asignar componentes'));
    } finally {
      setProcessing(false);
    }
  }, [id, t, toast, fetchOrder]);

  const handleStart = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await api.put(`/kitting/orders/${id}/start`);
      if (res.data?.ok) {
        toast.success(t('kit_started', 'Produccion iniciada'));
        fetchOrder();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('kit_error_start', 'Error al iniciar produccion'));
    } finally {
      setProcessing(false);
    }
  }, [id, t, toast, fetchOrder]);

  const handleComplete = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await api.put(`/kitting/orders/${id}/complete`);
      if (res.data?.ok) {
        toast.success(t('kit_completed', 'Orden completada'));
        fetchOrder();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('kit_error_complete', 'Error al completar orden'));
    } finally {
      setProcessing(false);
    }
  }, [id, t, toast, fetchOrder]);

  const componentColumns = useMemo(() => [
    { field: 'material_codigo', headerName: t('kit_comp_material', 'Material'), flex: 1.5, minWidth: 160 },
    {
      field: 'cantidad_requerida',
      headerName: t('kit_comp_requerida', 'Requerida'),
      width: 110,
      type: 'numericColumn',
    },
    {
      field: 'cantidad_asignada',
      headerName: t('kit_comp_asignada', 'Asignada'),
      width: 110,
      type: 'numericColumn',
    },
    {
      field: 'cantidad_consumida',
      headerName: t('kit_comp_consumida', 'Consumida'),
      width: 110,
      type: 'numericColumn',
    },
    {
      field: 'estado',
      headerName: t('kit_comp_estado', 'Estado'),
      width: 130,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={COMPONENT_ESTADO_LABELS[p.value] || p.value || '-'}
          color={COMPONENT_ESTADO_COLORS[p.value] || 'default'}
        />
      ),
    },
    { field: 'ubicacion', headerName: t('kit_comp_ubicacion', 'Ubicacion'), width: 120 },
    { field: 'lote', headerName: t('kit_comp_lote', 'Lote'), width: 120 },
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

  if (!order) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{t('kit_not_found', 'Orden de kit no encontrada')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/operations/kitting/orders')} sx={{ mt: 2 }}>
          {t('common_volver', 'Volver')}
        </Button>
      </Box>
    );
  }

  const estado = order.estado || 'draft';
  const componentes = order.componentes || order.items || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Back */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/operations/kitting/orders')}
        color="inherit"
        sx={{ alignSelf: 'flex-start' }}
      >
        {t('common_volver', 'Volver')}
      </Button>

      {/* Header */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
              <BuildIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {order.numero_orden}
              </Typography>
              <Chip
                size="small"
                label={ESTADO_LABELS[estado] || estado}
                color={ESTADO_COLORS[estado] || 'default'}
              />
              <Chip
                size="small"
                label={PRIORIDAD_LABELS[order.prioridad] || order.prioridad}
                color={PRIORIDAD_COLORS[order.prioridad] || 'default'}
                variant="outlined"
              />
            </Stack>
            <Stack spacing={0.5} sx={{ color: 'text.secondary' }}>
              <Typography variant="body2">
                {t('kit_kit', 'Kit')}: <strong>{order.kit_nombre || order.kit_codigo || `BOM #${order.kit_bom_id}`}</strong>
              </Typography>
              <Typography variant="body2">
                {t('kit_cantidad', 'Cantidad Kits')}: <strong>{order.cantidad_kits}</strong>
              </Typography>
            </Stack>
          </Box>

          <Stack direction="row" gap={1} flexWrap="wrap">
            {estado === 'draft' && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={availLoading ? <CircularProgress size={16} /> : <VerifiedIcon />}
                  onClick={handleCheckAvailability}
                  disabled={availLoading || processing}
                >
                  {t('kit_check_avail', 'Verificar Disponibilidad')}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={processing ? <CircularProgress size={16} /> : <AssignmentTurnedInIcon />}
                  onClick={handleAllocate}
                  disabled={processing}
                >
                  {t('kit_allocate', 'Asignar Componentes')}
                </Button>
              </>
            )}
            {(estado === 'released' || estado === 'allocated') && (
              <Button
                variant="contained"
                size="small"
                color="primary"
                startIcon={processing ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                onClick={handleStart}
                disabled={processing}
              >
                {t('kit_start', 'Iniciar Produccion')}
              </Button>
            )}
            {estado === 'in_progress' && (
              <Button
                variant="contained"
                size="small"
                color="success"
                startIcon={processing ? <CircularProgress size={16} /> : <CheckCircleIcon />}
                onClick={handleComplete}
                disabled={processing}
              >
                {t('kit_complete', 'Completar')}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Order Info */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>{t('kit_info', 'Informacion de la Orden')}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={3} divider={<Divider orientation="vertical" flexItem />}>
          <Box>
            <Typography variant="caption" color="text.secondary">{t('kit_almacen', 'Almacen')}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{order.almacen_id || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">{t('kit_fecha_requerida', 'Fecha Requerida')}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDate(order.fecha_requerida)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">{t('kit_fecha_inicio', 'Fecha Inicio')}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDateTime(order.fecha_inicio)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">{t('kit_fecha_completado', 'Fecha Completado')}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDateTime(order.fecha_completado)}</Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Availability Panel */}
      {availability && availability.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>{t('kit_availability', 'Disponibilidad de Componentes')}</Typography>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {availability.map((comp, idx) => {
              const sufficient = comp.disponible >= comp.requerida;
              return (
                <Chip
                  key={idx}
                  label={`${comp.material_codigo}: ${comp.disponible}/${comp.requerida}`}
                  color={sufficient ? 'success' : 'error'}
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              );
            })}
          </Stack>
        </Paper>
      )}

      {/* Components Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2">{t('kit_components', 'Componentes')}</Typography>
        </Box>
        <SPMAgGrid
          columnDefs={componentColumns}
          rowData={componentes}
          loading={false}
          height={350}
          pagination={false}
          enableQuickFilter={false}
          exportFileName="kit_componentes"
          emptyMessage={t('kit_no_components', 'Sin componentes')}
          getRowId={(params) => String(params.data.id || params.data.material_codigo)}
        />
      </Paper>
    </Box>
  );
}
