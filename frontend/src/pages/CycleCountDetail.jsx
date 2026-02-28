/**
 * CycleCountDetail - Cycle count detail page with inline item editing
 *
 * Shows count header info, stats (total/counted/pending/variance items),
 * AG-Grid with editable cantidad_contada cells for in_progress counts,
 * and action buttons (Start, Complete, Back).
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatDate } from '../utils/formatters';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InventoryIcon from '@mui/icons-material/Inventory';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_COLORS = {
  planned: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'error',
};

const ESTADO_LABELS = {
  planned: 'Planificado',
  in_progress: 'En Progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const TIPO_LABELS = {
  abc_scheduled: 'ABC Programado',
  spot: 'Spot',
  full_physical: 'Inv. Fisico',
};

const ITEM_ESTADO_LABELS = {
  pending: 'Pendiente',
  counted: 'Contado',
  adjusted: 'Ajustado',
};

const ITEM_ESTADO_COLORS = {
  pending: 'default',
  counted: 'success',
  adjusted: 'info',
};

export default function CycleCountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/cycle-count/counts/${id}`);
        if (cancelled) return;
        if (res.data?.ok) setCount(res.data.count || res.data);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('cc_error_detail', 'Error al cargar conteo'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id, reloadTick]);

  const handleStart = async () => {
    setProcessing(true);
    try {
      const res = await api.put(`/cycle-count/counts/${id}/start`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('cc_started', 'Conteo iniciado'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('cc_error_start', 'Error al iniciar conteo'));
    } finally {
      setProcessing(false);
    }
  };

  const handleComplete = async () => {
    setProcessing(true);
    try {
      const res = await api.put(`/cycle-count/counts/${id}/complete`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('cc_completed', 'Conteo completado'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('cc_error_complete', 'Error al completar conteo'));
    } finally {
      setProcessing(false);
    }
  };

  const handleCellEdit = useCallback(async (event) => {
    const { data, colDef, newValue } = event;
    if (colDef.field !== 'cantidad_contada') return;

    const parsedValue = parseFloat(newValue);
    if (isNaN(parsedValue) || parsedValue < 0) {
      toastRef.current.warning(tRef.current('cc_invalid_quantity', 'Cantidad invalida'));
      reload();
      return;
    }

    try {
      const res = await api.put(`/cycle-count/counts/${id}/items/${data.id}`, {
        cantidad_contada: parsedValue,
      });
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('cc_item_updated', 'Item actualizado'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('cc_error_update_item', 'Error al actualizar item'));
      reload();
    }
  }, [id]);

  const isInProgress = count?.estado === 'in_progress';

  const itemColumnDefs = useMemo(() => [
    { field: 'material_codigo', headerName: t('cc_item_material', 'Material'), flex: 1, minWidth: 140 },
    { field: 'ubicacion', headerName: t('cc_item_ubicacion', 'Ubicacion'), flex: 1, minWidth: 120 },
    {
      field: 'cantidad_sistema',
      headerName: t('cc_item_cant_sistema', 'Cant. Sistema'),
      width: 130,
      type: 'numericColumn',
    },
    {
      field: 'cantidad_contada',
      headerName: t('cc_item_cant_contada', 'Cant. Contada'),
      width: 140,
      type: 'numericColumn',
      editable: isInProgress,
      cellStyle: isInProgress ? { backgroundColor: '#fff8e1' } : undefined,
    },
    {
      field: 'varianza',
      headerName: t('cc_item_varianza', 'Varianza'),
      width: 110,
      type: 'numericColumn',
      valueGetter: (p) => {
        if (p.data.cantidad_contada == null) return null;
        return (p.data.cantidad_contada || 0) - (p.data.cantidad_sistema || 0);
      },
    },
    {
      headerName: t('cc_item_varianza_pct', 'Varianza %'),
      width: 120,
      colId: 'varianza_pct',
      cellRenderer: (p) => {
        const sistema = p.data.cantidad_sistema || 0;
        const contada = p.data.cantidad_contada;
        if (contada == null || sistema === 0) return '-';
        const pct = ((contada - sistema) / sistema) * 100;
        const isHighVariance = Math.abs(pct) > 5;
        return (
          <Typography
            variant="body2"
            sx={{ color: isHighVariance ? 'error.main' : 'text.primary', fontWeight: isHighVariance ? 600 : 400 }}
          >
            {pct.toFixed(1)}%
          </Typography>
        );
      },
    },
    {
      field: 'estado',
      headerName: t('cc_item_estado', 'Estado'),
      width: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={ITEM_ESTADO_LABELS[p.value] || p.value || '-'} color={ITEM_ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
  ], [t, isInProgress]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
        <Skeleton variant="rectangular" height={40} width={300} />
        <Skeleton variant="rectangular" height={180} />
        <Skeleton variant="rectangular" height={300} />
      </Box>
    );
  }

  if (!count) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{t('cc_not_found', 'Conteo no encontrado')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/operations/cycle-count')} sx={{ mt: 2 }}>
          {t('common_volver', 'Volver')}
        </Button>
      </Box>
    );
  }

  const estado = count.estado || 'planned';
  const items = count.items || [];
  const totalItems = items.length;
  const countedItems = items.filter((i) => i.cantidad_contada != null).length;
  const pendingItems = totalItems - countedItems;
  const varianceItems = items.filter((i) => {
    if (i.cantidad_contada == null) return false;
    return i.cantidad_contada !== i.cantidad_sistema;
  }).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Back */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/operations/cycle-count')} color="inherit" sx={{ alignSelf: 'flex-start' }}>
        {t('common_volver', 'Volver')}
      </Button>

      {/* Header */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
              <InventoryIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('cc_detail_title', 'Conteo')} #{count.id}
              </Typography>
              <Chip size="small" label={TIPO_LABELS[count.tipo] || count.tipo} variant="outlined" />
              <Chip size="small" label={ESTADO_LABELS[estado] || estado} color={ESTADO_COLORS[estado] || 'default'} />
            </Stack>
            <Stack spacing={0.5} sx={{ color: 'text.secondary' }}>
              <Typography variant="body2">{t('cc_almacen', 'Almacen')}: <strong>{count.almacen_id}</strong></Typography>
              <Typography variant="body2">{t('cc_fecha_planificada', 'Fecha Planificada')}: {formatDate(count.fecha_planificada)}</Typography>
              {count.asignado_a && (
                <Typography variant="body2">{t('cc_asignado', 'Asignado a')}: {count.asignado_a}</Typography>
              )}
              {count.programa_id && (
                <Typography variant="body2">{t('cc_programa', 'Programa')}: #{count.programa_id}</Typography>
              )}
            </Stack>
          </Box>

          <Stack direction="row" gap={1} flexWrap="wrap">
            {estado === 'planned' && (
              <Button
                variant="contained"
                color="primary"
                startIcon={processing ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                onClick={handleStart}
                disabled={processing}
              >
                {t('cc_btn_start', 'Iniciar')}
              </Button>
            )}
            {estado === 'in_progress' && (
              <Button
                variant="contained"
                color="success"
                startIcon={processing ? <CircularProgress size={16} /> : <CheckCircleIcon />}
                onClick={handleComplete}
                disabled={processing}
              >
                {t('cc_btn_complete', 'Completar')}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Stats */}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">{t('cc_stat_total', 'Total Items')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalItems}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">{t('cc_stat_counted', 'Contados')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>{countedItems}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">{t('cc_stat_pending', 'Pendientes')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>{pendingItems}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">{t('cc_stat_variance', 'Con Varianza')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>{varianceItems}</Typography>
        </Paper>
      </Stack>

      {/* Editing hint */}
      {isInProgress && (
        <Alert severity="info">
          {t('cc_edit_hint', 'Haga doble clic en la columna "Cant. Contada" para editar la cantidad registrada.')}
        </Alert>
      )}

      {/* Items Table */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
        aria-label={t('cc_items_table', 'Items del Conteo')}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2">{t('cc_items_title', 'Items del Conteo')}</Typography>
        </Box>
        <SPMAgGrid
          columnDefs={itemColumnDefs}
          rowData={items}
          loading={false}
          height={450}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          exportFileName="conteo_items"
          emptyMessage={t('cc_no_items', 'Sin items')}
          getRowId={(params) => String(params.data.id)}
          onCellValueChanged={isInProgress ? handleCellEdit : undefined}
        />
      </Paper>
    </Box>
  );
}
