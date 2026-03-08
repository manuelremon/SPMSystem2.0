/**
 * VMIDetail - VMI Program detail page
 *
 * Shows program header info with tabs for Resumen, Inventario, Reposiciones,
 * and KPIs. Includes dialog to update inventory manually.
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StorefrontIcon from '@mui/icons-material/Storefront';
import InventoryIcon from '@mui/icons-material/Inventory';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import BarChartIcon from '@mui/icons-material/BarChart';
import InfoIcon from '@mui/icons-material/Info';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_COLORS = {
  active: 'success',
  suspended: 'warning',
  draft: 'default',
  terminated: 'error',
};

const ESTADO_LABELS = {
  active: 'Activo',
  suspended: 'Suspendido',
  draft: 'Borrador',
  terminated: 'Terminado',
};

const REPO_ESTADO_COLORS = {
  suggested: 'warning',
  approved: 'success',
  rejected: 'error',
  in_progress: 'info',
  delivered: 'default',
  cancelled: 'error',
};

const REPO_ESTADO_LABELS = {
  suggested: 'Sugerida',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  in_progress: 'En Proceso',
  delivered: 'Entregada',
  cancelled: 'Cancelada',
};

const ALERTA_COLORS = {
  ok: 'success',
  reposicion_sugerida: 'warning',
  stock_bajo: 'error',
};

export default function VMIDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();

  const [programa, setPrograma] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  // Inventory update dialog
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    stock_disponible: '',
    reservado: '',
    en_transito: '',
    consumo_diario: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Repo action processing
  const [processingRepo, setProcessingRepo] = useState({});

  const toastRef = useRef(toast);
  toastRef.current = toast;
  const tRef = useRef(t);
  tRef.current = t;

  const [reloadTick, setReloadTick] = useState(0);
  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function loadPrograma() {
      setLoading(true);
      try {
        const { data } = await api.get(`/vmi/programas/${id}`);
        if (!cancelled && data?.ok) {
          const prog = data.programa || {};
          prog.inventario = data.inventario || [];
          prog.reposiciones = data.reposiciones || [];
          prog.kpis = data.kpis || [];
          prog.inventario_actual = data.inventario_actual || {};
          setPrograma(prog);
        }
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('vmi_error_detail', 'Error al cargar programa VMI'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPrograma();
    return () => { cancelled = true; };
  }, [id, reloadTick]);

  const handleInventorySubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const payload = {};
      if (inventoryForm.stock_disponible) payload.stock_disponible = Number(inventoryForm.stock_disponible);
      if (inventoryForm.reservado) payload.reservado = Number(inventoryForm.reservado);
      if (inventoryForm.en_transito) payload.en_transito = Number(inventoryForm.en_transito);
      if (inventoryForm.consumo_diario) payload.consumo_diario = Number(inventoryForm.consumo_diario);
      const res = await api.post(`/vmi/programas/${id}/inventario`, payload);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('vmi_inventory_updated', 'Inventario actualizado'));
        setInventoryDialogOpen(false);
        setInventoryForm({ stock_disponible: '', reservado: '', en_transito: '', consumo_diario: '' });
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('vmi_error_inventory', 'Error al actualizar inventario'));
    } finally {
      setSubmitting(false);
    }
  }, [id, inventoryForm, reload]);

  const handleRepoAction = useCallback(async (repoId, action) => {
    setProcessingRepo((prev) => ({ ...prev, [repoId]: action }));
    try {
      const res = await api.put(`/vmi/reposiciones/${repoId}/${action}`);
      if (res.data?.ok) {
        toastRef.current.success(
          action === 'approve'
            ? tRef.current('vmi_repo_approved', 'Reposicion aprobada')
            : tRef.current('vmi_repo_rejected', 'Reposicion rechazada')
        );
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('vmi_error_repo_action', 'Error al procesar reposicion'));
    } finally {
      setProcessingRepo((prev) => ({ ...prev, [repoId]: null }));
    }
  }, [reload]);

  const inventarioColumnDefs = useMemo(() => [
    {
      field: 'fecha',
      headerName: t('vmi_col_fecha', 'Fecha'),
      width: 120,
      valueFormatter: (p) => formatDate(p.value),
    },
    { field: 'stock_disponible', headerName: t('vmi_col_stock', 'Stock Disponible'), width: 140, type: 'numericColumn' },
    { field: 'stock_reservado', headerName: t('vmi_col_reservado', 'Reservado'), width: 110, type: 'numericColumn' },
    { field: 'stock_en_transito', headerName: t('vmi_col_transito', 'En Transito'), width: 120, type: 'numericColumn' },
    { field: 'consumo_diario_promedio', headerName: t('vmi_col_consumo', 'Consumo Diario'), width: 130, type: 'numericColumn' },
    { field: 'dias_inventario', headerName: t('vmi_col_dias', 'Dias Inventario'), width: 130, type: 'numericColumn' },
    { field: 'stock_proyectado_7d', headerName: t('vmi_col_proyectado', 'Proyectado 7d'), width: 130, type: 'numericColumn' },
    {
      field: 'alerta',
      headerName: t('vmi_col_alerta', 'Alerta'),
      width: 110,
      cellRenderer: (p) => p.value ? (
        <Chip size="small" label={p.value} color={ALERTA_COLORS[p.value] || 'default'} />
      ) : '-',
    },
  ], [t]);

  const repoColumnDefs = useMemo(() => [
    { field: 'tipo', headerName: t('vmi_col_tipo', 'Tipo'), width: 120 },
    { field: 'cantidad_sugerida', headerName: t('vmi_col_sugerida', 'Sugerida'), width: 110, type: 'numericColumn' },
    { field: 'cantidad_aprobada', headerName: t('vmi_col_aprobada', 'Aprobada'), width: 110, type: 'numericColumn' },
    {
      field: 'estado',
      headerName: t('vmi_col_estado', 'Estado'),
      width: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={REPO_ESTADO_LABELS[p.value] || p.value || '-'} color={REPO_ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    {
      field: 'fecha',
      headerName: t('vmi_col_fecha', 'Fecha'),
      width: 120,
      valueFormatter: (p) => formatDate(p.value),
    },
    {
      headerName: t('vmi_col_acciones', 'Acciones'),
      width: 230,
      sortable: false,
      filter: false,
      cellRenderer: (p) => {
        const row = p.data;
        if (!row || row.estado !== 'suggested') return null;
        const isProcessing = processingRepo[row.id];
        return (
          <Stack direction="row" gap={0.5} alignItems="center" sx={{ height: '100%' }}>
            <Button
              size="small"
              variant="outlined"
              color="success"
              startIcon={isProcessing === 'approve' ? <CircularProgress size={14} /> : <CheckCircleIcon />}
              onClick={(e) => { e.stopPropagation(); handleRepoAction(row.id, 'approve'); }}
              disabled={!!isProcessing}
            >
              {t('vmi_aprobar', 'Aprobar')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={isProcessing === 'reject' ? <CircularProgress size={14} /> : <CancelIcon />}
              onClick={(e) => { e.stopPropagation(); handleRepoAction(row.id, 'reject'); }}
              disabled={!!isProcessing}
            >
              {t('vmi_rechazar', 'Rechazar')}
            </Button>
          </Stack>
        );
      },
    },
  ], [t, processingRepo, handleRepoAction]);

  const kpiColumnDefs = useMemo(() => [
    { field: 'periodo', headerName: t('vmi_col_periodo', 'Periodo'), flex: 1, minWidth: 120 },
    { field: 'fill_rate', headerName: t('vmi_col_fill_rate', 'Fill Rate (%)'), width: 130, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? `${Number(p.value).toFixed(1)}%` : '-',
    },
    { field: 'dias_stockout', headerName: t('vmi_col_stockout', 'Dias Stockout'), width: 130, type: 'numericColumn' },
    { field: 'inventory_turnover', headerName: t('vmi_col_turnover', 'Rotacion'), width: 120, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(2) : '-',
    },
    { field: 'lead_time_avg', headerName: t('vmi_col_lead_time', 'Lead Time Prom.'), width: 130, type: 'numericColumn' },
    { field: 'costo_almacenamiento', headerName: t('vmi_col_costo', 'Costo Almac.'), width: 130, type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? `$${Number(p.value).toLocaleString()}` : '-',
    },
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

  if (!programa) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
        <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 4 }}>
          <Alert severity="error">{t('vmi_not_found', 'Programa VMI no encontrado')}</Alert>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/operations/vmi')} sx={{ mt: 2 }}>
            {t('common_volver', 'Volver')}
          </Button>
        </Box>
      </Box>
    );
  }

  const estado = programa.estado || 'draft';
  const inventario = programa.inventario || [];
  const reposiciones = programa.reposiciones || [];
  const kpisData = programa.kpis || [];
  const snapshot = programa.snapshot || programa.inventario_actual || {};

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Back */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/operations/vmi')} color="inherit" sx={{ alignSelf: 'flex-start' }}>
        {t('common_volver', 'Volver')}
      </Button>

      {/* Header */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
              <StorefrontIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('vmi_programa', 'Programa VMI')} #{programa.id}
              </Typography>
              <Chip size="small" label={ESTADO_LABELS[estado] || estado} color={ESTADO_COLORS[estado] || 'default'} />
              <Chip size="small" label={programa.tipo_reposicion || '-'} variant="outlined" />
            </Stack>
            <Stack spacing={0.5} sx={{ color: 'text.secondary' }}>
              <Typography variant="body2">{t('vmi_proveedor', 'Proveedor')}: <strong>{programa.proveedor_nombre || programa.proveedor_cuit}</strong></Typography>
              <Typography variant="body2">{t('vmi_material', 'Material')}: <strong>{programa.material_codigo}</strong></Typography>
              <Typography variant="body2">{t('vmi_centro', 'Centro')}: <strong>{programa.centro_id}</strong></Typography>
            </Stack>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setInventoryDialogOpen(true)}
          >
            {t('vmi_update_inventory', 'Actualizar Inventario')}
          </Button>
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={t('vmi_tab_resumen', 'Resumen')} icon={<InfoIcon />} iconPosition="start" />
          <Tab label={t('vmi_tab_inventario', 'Inventario')} icon={<InventoryIcon />} iconPosition="start" />
          <Tab label={t('vmi_tab_reposiciones', 'Reposiciones')} icon={<AutorenewIcon />} iconPosition="start" />
          <Tab label={t('vmi_tab_kpis', 'KPIs')} icon={<BarChartIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Resumen */}
      {tabValue === 0 && (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            {t('vmi_resumen_title', 'Informacion del Programa')}
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={3}>
            <Paper elevation={0} sx={{ flex: 1, p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('vmi_parametros', 'Parametros')}</Typography>
              <Typography variant="body2">{t('vmi_col_min', 'Stock Minimo')}: <strong>{programa.min_stock ?? '-'}</strong></Typography>
              <Typography variant="body2">{t('vmi_col_max', 'Stock Maximo')}: <strong>{programa.max_stock ?? '-'}</strong></Typography>
              <Typography variant="body2">{t('vmi_col_rop', 'Punto de Pedido')}: <strong>{programa.punto_pedido ?? '-'}</strong></Typography>
              <Typography variant="body2">{t('vmi_lead_time', 'Frecuencia')}: <strong>{programa.frecuencia_dias ?? '-'} {t('vmi_dias', 'dias')}</strong></Typography>
            </Paper>
            <Paper elevation={0} sx={{ flex: 1, p: 2, bgcolor: 'action.hover' }}>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                <InventoryIcon fontSize="small" color="info" />
                <Typography variant="subtitle2">{t('vmi_snapshot', 'Inventario Actual')}</Typography>
              </Stack>
              <Typography variant="body2">{t('vmi_col_stock', 'Stock Disponible')}: <strong>{snapshot.stock_disponible ?? '-'}</strong></Typography>
              <Typography variant="body2">{t('vmi_col_reservado', 'Reservado')}: <strong>{snapshot.stock_reservado ?? '-'}</strong></Typography>
              <Typography variant="body2">{t('vmi_col_transito', 'En Transito')}: <strong>{snapshot.stock_en_transito ?? '-'}</strong></Typography>
              <Typography variant="body2">{t('vmi_col_consumo', 'Consumo Diario')}: <strong>{snapshot.consumo_diario_promedio ?? '-'}</strong></Typography>
              {snapshot.alerta && (
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 1 }}>
                  <WarningAmberIcon fontSize="small" color="warning" />
                  <Chip size="small" label={snapshot.alerta} color={ALERTA_COLORS[snapshot.alerta] || 'default'} />
                </Stack>
              )}
            </Paper>
          </Stack>
        </Paper>
      )}

      {/* Tab 1: Inventario */}
      {tabValue === 1 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider' }}
          aria-label={t('vmi_tab_inventario', 'Inventario')}
        >
          <SPMAgGrid
            columnDefs={inventarioColumnDefs}
            rowData={inventario}
            loading={false}
            height={480}
            pagination={true}
            paginationPageSize={20}
            enableQuickFilter={true}
            exportFileName="vmi_inventario"
            emptyMessage={t('vmi_empty_inventario', 'No hay registros de inventario')}
            getRowId={(params) => String(params.data.id || params.data.fecha)}
          />
        </Paper>
      )}

      {/* Tab 2: Reposiciones */}
      {tabValue === 2 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider' }}
          aria-label={t('vmi_tab_reposiciones', 'Reposiciones')}
        >
          <SPMAgGrid
            columnDefs={repoColumnDefs}
            rowData={reposiciones}
            loading={false}
            height={480}
            pagination={true}
            paginationPageSize={20}
            enableQuickFilter={true}
            exportFileName="vmi_reposiciones"
            emptyMessage={t('vmi_empty_repo', 'No hay reposiciones registradas')}
            getRowId={(params) => String(params.data.id)}
          />
        </Paper>
      )}

      {/* Tab 3: KPIs */}
      {tabValue === 3 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider' }}
          aria-label={t('vmi_tab_kpis', 'KPIs')}
        >
          <SPMAgGrid
            columnDefs={kpiColumnDefs}
            rowData={kpisData}
            loading={false}
            height={400}
            pagination={false}
            enableQuickFilter={false}
            exportFileName="vmi_kpis"
            emptyMessage={t('vmi_empty_kpis', 'No hay datos de KPIs')}
            getRowId={(params) => String(params.data.periodo || params.data.id)}
          />
        </Paper>
      )}

      {/* Update Inventory Dialog */}
      <Dialog open={inventoryDialogOpen} onClose={() => setInventoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <InventoryIcon color="primary" />
            <span>{t('vmi_update_inventory', 'Actualizar Inventario')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('vmi_field_stock', 'Stock Disponible')}
              type="number"
              value={inventoryForm.stock_disponible}
              onChange={(e) => setInventoryForm((prev) => ({ ...prev, stock_disponible: e.target.value }))}
              fullWidth
              size="small"
              inputProps={{ min: 0 }}
            />
            <TextField
              label={t('vmi_field_reservado', 'Reservado')}
              type="number"
              value={inventoryForm.reservado}
              onChange={(e) => setInventoryForm((prev) => ({ ...prev, reservado: e.target.value }))}
              fullWidth
              size="small"
              inputProps={{ min: 0 }}
            />
            <TextField
              label={t('vmi_field_transito', 'En Transito')}
              type="number"
              value={inventoryForm.en_transito}
              onChange={(e) => setInventoryForm((prev) => ({ ...prev, en_transito: e.target.value }))}
              fullWidth
              size="small"
              inputProps={{ min: 0 }}
            />
            <TextField
              label={t('vmi_field_consumo', 'Consumo Diario')}
              type="number"
              value={inventoryForm.consumo_diario}
              onChange={(e) => setInventoryForm((prev) => ({ ...prev, consumo_diario: e.target.value }))}
              fullWidth
              size="small"
              inputProps={{ min: 0, step: 0.1 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInventoryDialogOpen(false)} disabled={submitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleInventorySubmit}
            disabled={submitting}
            startIcon={submitting && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
