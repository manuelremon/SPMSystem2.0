/**
 * RecallDetail - Recall detail page
 *
 * Shows recall header info (numero, titulo, severidad, estado, tipo),
 * stats (cantidad afectada, lotes count, recovered), AG-Grid of affected lotes
 * with recover action, and plan de accion display.
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
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InventoryIcon from '@mui/icons-material/Inventory';
import RestoreIcon from '@mui/icons-material/Restore';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const SEVERIDAD_COLORS = {
  critica: 'error',
  alta: 'warning',
  media: 'default',
  baja: 'info',
};

const SEVERIDAD_LABELS = {
  critica: 'Critica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

const ESTADO_COLORS = {
  draft: 'info',
  initiated: 'error',
  en_proceso: 'warning',
  completed: 'success',
  cerrado: 'default',
};

const ESTADO_LABELS = {
  draft: 'Borrador',
  initiated: 'Iniciado',
  en_proceso: 'En Proceso',
  completed: 'Completado',
  cerrado: 'Cerrado',
};

const RECUPERACION_COLORS = {
  pending: 'warning',
  identified: 'info',
  recovered: 'success',
  retrieved: 'success',
  disposed: 'error',
  not_required: 'default',
};

const RECUPERACION_LABELS = {
  pending: 'Pendiente',
  identified: 'Identificado',
  recovered: 'Recuperado',
  retrieved: 'Recuperado',
  disposed: 'Descartado',
  not_required: 'No Requerido',
};

export default function RecallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const [recall, setRecall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState({});
  const [reloadTick, setReloadTick] = useState(0);
  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/lots/recalls/${id}`);
        if (!cancelled && res.data?.ok) {
          // Response is flat (no recall wrapper), remove 'ok' key from the recall object
          const data = { ...res.data };
          delete data.ok;
          setRecall(data);
        }
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('recall_error_detail', 'Error al cargar retiro'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, reloadTick]);

  const handleRecover = useCallback(async (loteId) => {
    setRecovering((prev) => ({ ...prev, [loteId]: true }));
    try {
      const res = await api.put(`/lots/recalls/${id}/lotes/${loteId}/recover`);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('recall_lote_recovered', 'Lote marcado como recuperado'));
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('recall_error_recover', 'Error al recuperar lote'));
    } finally {
      setRecovering((prev) => ({ ...prev, [loteId]: false }));
    }
  }, [id, reload]);

  const loteColumnDefs = useMemo(() => [
    { field: 'numero_lote', headerName: t('recall_col_lote', 'Numero Lote'), flex: 1, minWidth: 140 },
    {
      field: 'cantidad_afectada',
      headerName: t('recall_col_cantidad', 'Cantidad Afectada'),
      width: 150,
      type: 'numericColumn',
    },
    { field: 'ubicacion', headerName: t('recall_col_ubicacion', 'Ubicacion'), flex: 1, minWidth: 140 },
    {
      field: 'estado_recuperacion',
      headerName: t('recall_col_recuperacion', 'Estado Recuperacion'),
      width: 170,
      cellRenderer: (p) => (
        <Chip
          size="small"
          label={RECUPERACION_LABELS[p.value] || p.value || '-'}
          color={RECUPERACION_COLORS[p.value] || 'default'}
        />
      ),
    },
    {
      field: 'fecha_recuperacion',
      headerName: t('recall_col_fecha_rec', 'Fecha Recuperacion'),
      width: 150,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      headerName: t('recall_col_accion', 'Accion'),
      width: 160,
      sortable: false,
      filter: false,
      cellRenderer: (p) => {
        const row = p.data;
        if (!row || ['recovered', 'retrieved', 'disposed'].includes(row.estado_recuperacion)) return null;
        const isRecovering = recovering[row.lote_id || row.id];
        return (
          <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={isRecovering ? <CircularProgress size={14} /> : <RestoreIcon />}
            onClick={(e) => { e.stopPropagation(); handleRecover(row.lote_id || row.id); }}
            disabled={isRecovering}
          >
            {t('recall_recuperar', 'Recuperar')}
          </Button>
        );
      },
    },
  ], [t, recovering, handleRecover]);

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

  if (!recall) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
        <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 4 }}>
          <Alert severity="error">{t('recall_not_found', 'Retiro no encontrado')}</Alert>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/operations/recalls')} sx={{ mt: 2 }}>
            {t('common_volver', 'Volver')}
          </Button>
        </Box>
      </Box>
    );
  }

  const estado = recall.estado || 'draft';
  const severidad = recall.severidad || 'alta';
  const lotesAfectados = recall.lotes || [];
  const cantidadTotal = recall.cantidad_total_afectada ?? lotesAfectados.reduce((sum, l) => sum + (l.cantidad_afectada || 0), 0);
  const totalLotes = lotesAfectados.length;
  const recoveredCount = recall.recovered_count ?? lotesAfectados.filter((l) => ['recovered', 'retrieved'].includes(l.estado_recuperacion)).length;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
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
                {recall.numero_recall || `RECALL-${recall.id}`}
              </Typography>
              <Chip
                size="small"
                label={SEVERIDAD_LABELS[severidad] || severidad}
                color={SEVERIDAD_COLORS[severidad] || 'default'}
              />
              <Chip
                size="small"
                label={ESTADO_LABELS[estado] || estado}
                color={ESTADO_COLORS[estado] || 'default'}
              />
              {recall.tipo && (
                <Chip size="small" label={recall.tipo} variant="outlined" />
              )}
            </Stack>
            <Stack spacing={0.5} sx={{ color: 'text.secondary' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '1rem', color: 'text.primary' }}>
                {recall.titulo}
              </Typography>
              {recall.material_codigo && (
                <Typography variant="body2">{t('recall_material', 'Material')}: <strong>{recall.material_codigo}</strong></Typography>
              )}
              <Typography variant="body2">{t('recall_fecha', 'Fecha')}: {formatDate(recall.created_at)}</Typography>
              {recall.descripcion && (
                <Typography variant="body2">{recall.descripcion}</Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* Stats */}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 160 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
            <WarningAmberIcon fontSize="small" sx={{ color: 'error.main' }} />
            <Typography variant="caption" color="text.secondary">{t('recall_stat_cantidad', 'Cantidad Total Afectada')}</Typography>
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
            {cantidadTotal != null ? cantidadTotal.toLocaleString('es-ES') : '--'}
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 160 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
            <InventoryIcon fontSize="small" sx={{ color: 'warning.main' }} />
            <Typography variant="caption" color="text.secondary">{t('recall_stat_lotes', 'Lotes Afectados')}</Typography>
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>
            {totalLotes}
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', minWidth: 160 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
            <CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />
            <Typography variant="caption" color="text.secondary">{t('recall_stat_recovered', 'Lotes Recuperados')}</Typography>
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
            {recoveredCount} / {totalLotes}
          </Typography>
        </Paper>
      </Stack>

      {/* Affected Lotes Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <InventoryIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2">{t('recall_lotes_title', 'Lotes Afectados')}</Typography>
          </Stack>
        </Box>
        <SPMAgGrid
          columnDefs={loteColumnDefs}
          rowData={lotesAfectados}
          loading={false}
          height={380}
          pagination={true}
          paginationPageSize={20}
          enableQuickFilter={true}
          exportFileName="recall_lotes_afectados"
          emptyMessage={t('recall_empty_lotes', 'No hay lotes afectados registrados')}
          getRowId={(params) => String(params.data.lote_id || params.data.id)}
        />
      </Paper>

      {/* Plan de Accion */}
      {recall.plan_accion && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
            <AssignmentIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t('recall_plan_title', 'Plan de Acción')}
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              p: 2,
              bgcolor: 'action.hover',
              lineHeight: 1.7,
            }}
          >
            {recall.plan_accion}
          </Typography>
        </Paper>
      )}
      </Box>
    </Box>
  );
}
