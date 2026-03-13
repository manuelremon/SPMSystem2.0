/**
 * LotTraceability - Lot management and recall tracking
 *
 * Displays KPI cards (lotes activos, bloqueados, por vencer, recalls),
 * with tabs for Lotes and Recalls. Includes filters and dialogs for
 * create, consume, block, and create recall.
 * Sprint 71
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import BlockIcon from '@mui/icons-material/Block';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const LOTE_ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'bloqueado', label: 'Bloqueado' },
  { value: 'reservado', label: 'Reservado' },
  { value: 'agotado', label: 'Agotado' },
];

const LOTE_ESTADO_COLORS = {
  disponible: 'success',
  bloqueado: 'error',
  reservado: 'info',
  agotado: 'default',
};

const LOTE_ESTADO_LABELS = {
  disponible: 'Disponible',
  bloqueado: 'Bloqueado',
  reservado: 'Reservado',
  agotado: 'Agotado',
};

const CALIDAD_COLORS = {
  aprobado: 'success',
  pendiente: 'warning',
  rechazado: 'error',
};

const CALIDAD_LABELS = {
  aprobado: 'Aprobado',
  pendiente: 'Pendiente',
  rechazado: 'Rechazado',
};

const RECALL_SEVERIDAD_COLORS = {
  critica: 'error',
  alta: 'warning',
  media: 'default',
  baja: 'info',
};

const RECALL_ESTADO_COLORS = {
  initiated: 'error',
  en_proceso: 'warning',
  completed: 'success',
  cerrado: 'default',
  draft: 'info',
};

const RECALL_ESTADO_LABELS = {
  initiated: 'Iniciado',
  en_proceso: 'En Proceso',
  completed: 'Completado',
  cerrado: 'Cerrado',
  draft: 'Borrador',
};

const INITIAL_LOTE_FORM = {
  numero_lote: '',
  material_codigo: '',
  proveedor_id: '',
  cantidad_inicial: '',
  fecha_vencimiento: '',
  almacen: '',
  ubicacion: '',
};

const INITIAL_RECALL_FORM = {
  titulo: '',
  severidad: 'alta',
  tipo: 'calidad',
  material_codigo: '',
  descripcion: '',
  plan_accion: '',
};

export default function LotTraceability() {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const [tabValue, setTabValue] = useState(0);
  const [kpis, setKpis] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // Lotes
  const [lotes, setLotes] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(true);
  const [filters, setFilters] = useState({ material: '', estado: '', proveedor: '', almacen: '' });

  // Recalls
  const [recalls, setRecalls] = useState([]);
  const [loadingRecalls, setLoadingRecalls] = useState(false);

  // Dialogs
  const [createLoteOpen, setCreateLoteOpen] = useState(false);
  const [loteForm, setLoteForm] = useState(INITIAL_LOTE_FORM);
  const [submittingLote, setSubmittingLote] = useState(false);

  const [consumeOpen, setConsumeOpen] = useState(false);
  const [consumeLote, setConsumeLote] = useState(null);
  const [consumeQty, setConsumeQty] = useState('');
  const [consuming, setConsuming] = useState(false);

  const [blockOpen, setBlockOpen] = useState(false);
  const [blockLote, setBlockLote] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);

  const [createRecallOpen, setCreateRecallOpen] = useState(false);
  const [recallForm, setRecallForm] = useState(INITIAL_RECALL_FORM);
  const [submittingRecall, setSubmittingRecall] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/lots/kpis');
        if (!cancelled && res.data?.ok) setKpis(res.data.kpis || res.data);
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLotes(true);
      try {
        const params = { page: 1, per_page: 200 };
        if (filters.material) params.material = filters.material;
        if (filters.estado) params.estado = filters.estado;
        if (filters.proveedor) params.proveedor = filters.proveedor;
        if (filters.almacen) params.almacen = filters.almacen;
        const res = await api.get('/lots', { params });
        if (!cancelled && res.data?.ok) setLotes(res.data.lotes || res.data.items || []);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('lot_error_load', 'Error al cargar lotes'));
      } finally {
        if (!cancelled) setLoadingLotes(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters.material, filters.estado, filters.proveedor, filters.almacen, reloadTick]);

  useEffect(() => {
    if (tabValue !== 1) return;
    let cancelled = false;
    (async () => {
      setLoadingRecalls(true);
      try {
        const res = await api.get('/lots/recalls');
        if (!cancelled && res.data?.ok) setRecalls(res.data.recalls || res.data.items || []);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('lot_error_recalls', 'Error al cargar recalls'));
      } finally {
        if (!cancelled) setLoadingRecalls(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tabValue, reloadTick]);

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Create lote
  const handleCreateLote = useCallback(async () => {
    if (!loteForm.numero_lote.trim() || !loteForm.material_codigo.trim() || !loteForm.cantidad_inicial) {
      toastRef.current.warning(tRef.current('lot_required', 'Complete numero, material y cantidad'));
      return;
    }
    setSubmittingLote(true);
    try {
      const payload = {
        ...loteForm,
        cantidad_inicial: Number(loteForm.cantidad_inicial),
      };
      const res = await api.post('/lots', payload);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('lot_created', 'Lote creado'));
        setCreateLoteOpen(false);
        setLoteForm(INITIAL_LOTE_FORM);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('lot_error_create', 'Error al crear lote'));
    } finally {
      setSubmittingLote(false);
    }
  }, [loteForm]);

  // Consume
  const handleConsume = useCallback(async () => {
    if (!consumeLote || !consumeQty) {
      toastRef.current.warning(tRef.current('lot_consume_required', 'Ingrese la cantidad'));
      return;
    }
    setConsuming(true);
    try {
      const res = await api.post(`/lots/${consumeLote.id}/consume`, { cantidad: Number(consumeQty) });
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('lot_consumed', 'Consumo registrado'));
        setConsumeOpen(false);
        setConsumeLote(null);
        setConsumeQty('');
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('lot_error_consume', 'Error al consumir'));
    } finally {
      setConsuming(false);
    }
  }, [consumeLote, consumeQty]);

  // Block/Unblock
  const handleBlock = useCallback(async () => {
    if (!blockLote) return;
    setBlocking(true);
    try {
      const isBlocked = blockLote.estado === 'bloqueado';
      const endpoint = isBlocked ? `/lots/${blockLote.id}/unblock` : `/lots/${blockLote.id}/block`;
      const payload = isBlocked ? {} : { razon: blockReason };
      const res = await api.put(endpoint, payload);
      if (res.data?.ok) {
        toastRef.current.success(isBlocked ? tRef.current('lot_unblocked', 'Lote desbloqueado') : tRef.current('lot_blocked', 'Lote bloqueado'));
        setBlockOpen(false);
        setBlockLote(null);
        setBlockReason('');
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('lot_error_block', 'Error al bloquear/desbloquear'));
    } finally {
      setBlocking(false);
    }
  }, [blockLote, blockReason]);

  // Create recall
  const handleCreateRecall = useCallback(async () => {
    if (!recallForm.titulo.trim() || !recallForm.material_codigo.trim()) {
      toastRef.current.warning(tRef.current('lot_recall_required', 'Complete titulo y material'));
      return;
    }
    setSubmittingRecall(true);
    try {
      const res = await api.post('/lots/recalls', recallForm);
      if (res.data?.ok) {
        toastRef.current.success(tRef.current('lot_recall_created', 'Recall creado'));
        setCreateRecallOpen(false);
        setRecallForm(INITIAL_RECALL_FORM);
        reload();
      }
    } catch (err) {
      toastRef.current.error(err.response?.data?.error || tRef.current('lot_error_recall_create', 'Error al crear recall'));
    } finally {
      setSubmittingRecall(false);
    }
  }, [recallForm]);

  const loteColumnDefs = useMemo(() => [
    { field: 'numero_lote', headerName: t('lot_col_numero', 'Numero Lote'), flex: 1, minWidth: 140 },
    { field: 'material_codigo', headerName: t('lot_col_material', 'Material'), flex: 1, minWidth: 140 },
    { field: 'proveedor_nombre', headerName: t('lot_col_proveedor', 'Proveedor'), flex: 1, minWidth: 140 },
    { field: 'cantidad_disponible', headerName: t('lot_col_disponible', 'Disponible'), width: 110, type: 'numericColumn' },
    { field: 'cantidad_inicial', headerName: t('lot_col_inicial', 'Inicial'), width: 100, type: 'numericColumn' },
    {
      field: 'estado',
      headerName: t('lot_col_estado', 'Estado'),
      width: 130,
      cellRenderer: (p) => (
        <Chip size="small" label={LOTE_ESTADO_LABELS[p.value] || p.value || '-'} color={LOTE_ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    {
      field: 'calidad',
      headerName: t('lot_col_calidad', 'Calidad'),
      width: 120,
      cellRenderer: (p) => p.value ? (
        <Chip size="small" label={CALIDAD_LABELS[p.value] || p.value} color={CALIDAD_COLORS[p.value] || 'default'} variant="outlined" />
      ) : '-',
    },
    {
      field: 'fecha_vencimiento',
      headerName: t('lot_col_vencimiento', 'Vencimiento'),
      width: 120,
      valueFormatter: (p) => formatDate(p.value),
    },
    { field: 'almacen', headerName: t('lot_col_almacen', 'Almacen'), width: 110 },
    { field: 'ubicacion', headerName: t('lot_col_ubicacion', 'Ubicacion'), width: 110 },
    {
      headerName: t('lot_col_acciones', 'Acciones'),
      width: 260,
      sortable: false,
      filter: false,
      cellRenderer: (p) => {
        const row = p.data;
        if (!row) return null;
        return (
          <Stack direction="row" gap={0.5} alignItems="center" sx={{ height: '100%' }}>
            {row.estado === 'disponible' && (
              <Button
                size="small"
                variant="outlined"
                color="info"
                startIcon={<RemoveCircleOutlineIcon />}
                onClick={(e) => { e.stopPropagation(); setConsumeLote(row); setConsumeOpen(true); }}
              >
                {t('lot_consumir', 'Consumir')}
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              color={row.estado === 'bloqueado' ? 'success' : 'error'}
              startIcon={row.estado === 'bloqueado' ? <LockOpenIcon /> : <BlockIcon />}
              onClick={(e) => { e.stopPropagation(); setBlockLote(row); setBlockReason(''); setBlockOpen(true); }}
            >
              {row.estado === 'bloqueado' ? t('lot_desbloquear', 'Desbloquear') : t('lot_bloquear', 'Bloquear')}
            </Button>
          </Stack>
        );
      },
    },
  ], [t]);

  const recallColumnDefs = useMemo(() => [
    { field: 'numero_recall', headerName: t('lot_col_recall_numero', 'Numero'), flex: 1, minWidth: 130 },
    { field: 'titulo', headerName: t('lot_col_recall_titulo', 'Titulo'), flex: 2, minWidth: 200 },
    {
      field: 'severidad',
      headerName: t('lot_col_recall_severidad', 'Severidad'),
      width: 120,
      cellRenderer: (p) => (
        <Chip size="small" label={p.value || '-'} color={RECALL_SEVERIDAD_COLORS[p.value] || 'default'} />
      ),
    },
    { field: 'tipo', headerName: t('lot_col_recall_tipo', 'Tipo'), width: 120 },
    {
      field: 'estado',
      headerName: t('lot_col_estado', 'Estado'),
      width: 130,
      cellRenderer: (p) => (
        <Chip size="small" label={RECALL_ESTADO_LABELS[p.value] || p.value || '-'} color={RECALL_ESTADO_COLORS[p.value] || 'default'} />
      ),
    },
    { field: 'material_codigo', headerName: t('lot_col_material', 'Material'), width: 140 },
    { field: 'lotes_afectados', headerName: t('lot_col_lotes_afectados', 'Lotes Afectados'), width: 130, type: 'numericColumn' },
    {
      field: 'created_at',
      headerName: t('lot_col_fecha', 'Fecha'),
      width: 120,
      valueFormatter: (p) => formatDate(p.value),
    },
  ], [t]);

  const KpiCard = ({ icon, label, value, color }) => (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', flex: 1, minWidth: 150 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
        {icon}
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </Stack>
      <Typography variant="h5" sx={{ fontWeight: 700, color: color || 'text.primary' }}>
        {value != null ? value : '--'}
      </Typography>
    </Paper>
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
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
          <Typography variant="h5" component="h1" fontWeight={700} textTransform="uppercase" letterSpacing="0.05em" color="text.primary">
            {t('lot_title', 'Trazabilidad de Lotes')}
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Button
            variant="outlined"
            startIcon={<ReportProblemIcon />}
            onClick={() => setCreateRecallOpen(true)}
            color="error"
          >
            {t('lot_new_recall', 'Nuevo Recall')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateLoteOpen(true)}
            aria-label={t('lot_new', 'Nuevo Lote')}
          >
            {t('lot_new', 'Nuevo Lote')}
          </Button>
        </Stack>
      </Stack>

      {/* KPI Cards */}
      {kpis && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
          <KpiCard
            icon={<CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />}
            label={t('lot_kpi_activos', 'Lotes Activos')}
            value={kpis.lotes_activos}
            color="success.main"
          />
          <KpiCard
            icon={<BlockIcon fontSize="small" sx={{ color: 'error.main' }} />}
            label={t('lot_kpi_bloqueados', 'Bloqueados')}
            value={kpis.lotes_bloqueados}
            color="error.main"
          />
          <KpiCard
            icon={<EventBusyIcon fontSize="small" sx={{ color: 'warning.main' }} />}
            label={t('lot_kpi_por_vencer', 'Por Vencer (30 dias)')}
            value={kpis.lotes_por_vencer}
            color="warning.main"
          />
          <KpiCard
            icon={<WarningAmberIcon fontSize="small" sx={{ color: 'error.main' }} />}
            label={t('lot_kpi_recalls', 'Recalls Activos')}
            value={kpis.recalls_activos}
            color="error.main"
          />
        </Stack>
      )}

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={t('lot_tab_lotes', 'Lotes')} icon={<QrCode2Icon />} iconPosition="start" />
          <Tab label={t('lot_tab_recalls', 'Recalls')} icon={<ReportProblemIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Lotes */}
      {tabValue === 0 && (
        <>
          {/* Filters */}
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} gap={2} flexWrap="wrap">
              <TextField
                size="small"
                label={t('lot_filter_material', 'Material')}
                value={filters.material}
                onChange={(e) => handleFilterChange('material', e.target.value)}
                sx={{ minWidth: 160 }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>{t('lot_filter_estado', 'Estado')}</InputLabel>
                <Select
                  value={filters.estado}
                  label={t('lot_filter_estado', 'Estado')}
                  onChange={(e) => handleFilterChange('estado', e.target.value)}
                >
                  {LOTE_ESTADO_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label={t('lot_filter_proveedor', 'Proveedor')}
                value={filters.proveedor}
                onChange={(e) => handleFilterChange('proveedor', e.target.value)}
                sx={{ minWidth: 160 }}
              />
              <TextField
                size="small"
                label={t('lot_filter_almacen', 'Almacen')}
                value={filters.almacen}
                onChange={(e) => handleFilterChange('almacen', e.target.value)}
                sx={{ minWidth: 140 }}
              />
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider' }}
            aria-label={t('lot_tab_lotes', 'Lotes')}
          >
            <SPMAgGrid
              columnDefs={loteColumnDefs}
              rowData={lotes}
              loading={loadingLotes}
              height={480}
              pagination={true}
              paginationPageSize={20}
              enableQuickFilter={true}
              exportFileName="lotes"
              emptyMessage={t('lot_empty', 'No hay lotes registrados')}
              getRowId={(params) => String(params.data.id)}
              onRowClick={(row) => {
                if (row?.id) navigate(`/operations/lots/${row.id}`);
              }}
            />
          </Paper>
        </>
      )}

      {/* Tab 1: Recalls */}
      {tabValue === 1 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider' }}
          aria-label={t('lot_tab_recalls', 'Recalls')}
        >
          <SPMAgGrid
            columnDefs={recallColumnDefs}
            rowData={recalls}
            loading={loadingRecalls}
            height={480}
            pagination={true}
            paginationPageSize={20}
            enableQuickFilter={true}
            exportFileName="recalls"
            emptyMessage={t('lot_empty_recalls', 'No hay recalls registrados')}
            getRowId={(params) => String(params.data.id)}
            onRowClick={(row) => {
              if (row?.id) navigate(`/operations/recalls/${row.id}`);
            }}
          />
        </Paper>
      )}

      {/* Create Lote Dialog */}
      <Dialog open={createLoteOpen} onClose={() => setCreateLoteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <QrCode2Icon color="primary" />
            <span>{t('lot_new', 'Nuevo Lote')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('lot_field_numero', 'Numero de Lote')}
              value={loteForm.numero_lote}
              onChange={(e) => setLoteForm((prev) => ({ ...prev, numero_lote: e.target.value }))}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('lot_field_material', 'Codigo Material')}
              value={loteForm.material_codigo}
              onChange={(e) => setLoteForm((prev) => ({ ...prev, material_codigo: e.target.value }))}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('lot_field_proveedor', 'ID Proveedor')}
              value={loteForm.proveedor_id}
              onChange={(e) => setLoteForm((prev) => ({ ...prev, proveedor_id: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label={t('lot_field_cantidad', 'Cantidad Inicial')}
              type="number"
              value={loteForm.cantidad_inicial}
              onChange={(e) => setLoteForm((prev) => ({ ...prev, cantidad_inicial: e.target.value }))}
              fullWidth
              required
              size="small"
              inputProps={{ min: 1 }}
            />
            <TextField
              label={t('lot_field_vencimiento', 'Fecha Vencimiento')}
              type="date"
              value={loteForm.fecha_vencimiento}
              onChange={(e) => setLoteForm((prev) => ({ ...prev, fecha_vencimiento: e.target.value }))}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label={t('lot_field_almacen', 'Almacen')}
                value={loteForm.almacen}
                onChange={(e) => setLoteForm((prev) => ({ ...prev, almacen: e.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label={t('lot_field_ubicacion', 'Ubicacion')}
                value={loteForm.ubicacion}
                onChange={(e) => setLoteForm((prev) => ({ ...prev, ubicacion: e.target.value }))}
                fullWidth
                size="small"
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateLoteOpen(false)} disabled={submittingLote}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateLote}
            disabled={submittingLote || !loteForm.numero_lote.trim() || !loteForm.material_codigo.trim() || !loteForm.cantidad_inicial}
            startIcon={submittingLote && <CircularProgress size={16} />}
          >
            {t('common_save', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>

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
            {consumeLote && (
              <Typography variant="body2" color="text.secondary">
                {t('lot_consume_lote', 'Lote')}: {consumeLote.numero_lote} - {t('lot_consume_disponible', 'Disponible')}: {consumeLote.cantidad_disponible}
              </Typography>
            )}
            <TextField
              label={t('lot_field_consume_qty', 'Cantidad a Consumir')}
              type="number"
              value={consumeQty}
              onChange={(e) => setConsumeQty(e.target.value)}
              fullWidth
              required
              size="small"
              inputProps={{ min: 1, max: consumeLote?.cantidad_disponible }}
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
            {blockLote?.estado === 'bloqueado' ? <LockOpenIcon color="success" /> : <BlockIcon color="error" />}
            <span>{blockLote?.estado === 'bloqueado' ? t('lot_unblock_title', 'Desbloquear Lote') : t('lot_block_title', 'Bloquear Lote')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {blockLote && (
              <Typography variant="body2" color="text.secondary">
                {t('lot_consume_lote', 'Lote')}: {blockLote.numero_lote}
              </Typography>
            )}
            {blockLote?.estado !== 'blocked' && (
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
            color={blockLote?.estado === 'bloqueado' ? 'success' : 'error'}
            onClick={handleBlock}
            disabled={blocking || (blockLote?.estado !== 'blocked' && !blockReason.trim())}
            startIcon={blocking && <CircularProgress size={16} />}
          >
            {blockLote?.estado === 'bloqueado' ? t('lot_desbloquear', 'Desbloquear') : t('lot_bloquear', 'Bloquear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Recall Dialog */}
      <Dialog open={createRecallOpen} onClose={() => setCreateRecallOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <ReportProblemIcon color="error" />
            <span>{t('lot_new_recall', 'Nuevo Recall')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('lot_field_recall_titulo', 'Titulo')}
              value={recallForm.titulo}
              onChange={(e) => setRecallForm((prev) => ({ ...prev, titulo: e.target.value }))}
              fullWidth
              required
              size="small"
            />
            <Stack direction="row" spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('lot_field_severidad', 'Severidad')}</InputLabel>
                <Select
                  value={recallForm.severidad}
                  label={t('lot_field_severidad', 'Severidad')}
                  onChange={(e) => setRecallForm((prev) => ({ ...prev, severidad: e.target.value }))}
                >
                  <MenuItem value="critica">Critica</MenuItem>
                  <MenuItem value="alta">Alta</MenuItem>
                  <MenuItem value="media">Media</MenuItem>
                  <MenuItem value="baja">Baja</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('lot_field_recall_tipo', 'Tipo')}</InputLabel>
                <Select
                  value={recallForm.tipo}
                  label={t('lot_field_recall_tipo', 'Tipo')}
                  onChange={(e) => setRecallForm((prev) => ({ ...prev, tipo: e.target.value }))}
                >
                  <MenuItem value="calidad">Calidad</MenuItem>
                  <MenuItem value="seguridad">Seguridad</MenuItem>
                  <MenuItem value="regulatorio">Regulatorio</MenuItem>
                  <MenuItem value="proveedor">Proveedor</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label={t('lot_field_recall_material', 'Codigo Material')}
              value={recallForm.material_codigo}
              onChange={(e) => setRecallForm((prev) => ({ ...prev, material_codigo: e.target.value }))}
              fullWidth
              required
              size="small"
            />
            <TextField
              label={t('lot_field_recall_desc', 'Descripcion')}
              value={recallForm.descripcion}
              onChange={(e) => setRecallForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
            <TextField
              label={t('lot_field_recall_plan', 'Plan de Accion')}
              value={recallForm.plan_accion}
              onChange={(e) => setRecallForm((prev) => ({ ...prev, plan_accion: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateRecallOpen(false)} disabled={submittingRecall}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCreateRecall}
            disabled={submittingRecall || !recallForm.titulo.trim() || !recallForm.material_codigo.trim()}
            startIcon={submittingRecall && <CircularProgress size={16} />}
          >
            {t('lot_crear_recall', 'Crear Recall')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}
