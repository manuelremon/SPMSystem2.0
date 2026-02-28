import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Paper,
  Divider,
  TextField,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ArrowDownward as EmptyIcon,
  ArrowUpward as FillIcon,
  LocalShipping as TransitIcon,
  CheckCircle as FullIcon
} from '@mui/icons-material';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import api from '../services/api';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';

const KanbanBoard = () => {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;
  const [tableros, setTableros] = useState([]);
  const [selectedTablero, setSelectedTablero] = useState(null);
  const [tableroDetalle, setTableroDetalle] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionDialog, setActionDialog] = useState({ open: false, type: null, tarjeta: null });
  const [notas, setNotas] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

  // Load boards list + KPIs
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [boardsRes, kpiRes] = await Promise.all([
          api.get('/kanban/boards'),
          api.get('/kanban/kpis'),
        ]);
        if (cancelled) return;
        const boards = boardsRes.data?.boards || boardsRes.data || [];
        setTableros(boards);
        if (boards.length > 0) {
          setSelectedTablero((prev) => prev || boards[0].id);
        }
        setKpis(kpiRes.data?.kpis || kpiRes.data || null);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('kanban_error_load', 'Error al cargar tableros'));
      }
    };
    load();
    return () => { cancelled = true; };
  }, [reloadTick]);

  // Load board detail when selection changes
  useEffect(() => {
    if (!selectedTablero) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/kanban/boards/${selectedTablero}`);
        if (!cancelled) setTableroDetalle(res.data?.board || res.data || null);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('kanban_error_detail', 'Error al cargar detalle del tablero'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedTablero, reloadTick]);

  const handleVaciarTarjeta = async () => {
    try {
      await api.put(`/kanban/cards/${actionDialog.tarjeta.id}/empty`, { notas });
      setActionDialog({ open: false, type: null, tarjeta: null });
      setNotas('');
      reload();
    } catch {
      toastRef.current.error(tRef.current('kanban_error_empty', 'Error al vaciar tarjeta'));
    }
  };

  const handleLlenarTarjeta = async () => {
    try {
      await api.put(`/kanban/cards/${actionDialog.tarjeta.id}/fill`, { notas });
      setActionDialog({ open: false, type: null, tarjeta: null });
      setNotas('');
      reload();
    } catch {
      toastRef.current.error(tRef.current('kanban_error_fill', 'Error al llenar tarjeta'));
    }
  };

  const getTipoChipColor = (tipo) => {
    switch (tipo) {
      case 'produccion':
        return 'primary';
      case 'transporte':
        return 'warning';
      case 'proveedor':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'empty':
        return <EmptyIcon sx={{ color: 'error.main' }} />;
      case 'in_transit':
        return <TransitIcon sx={{ color: 'warning.main' }} />;
      case 'full':
        return <FullIcon sx={{ color: 'success.main' }} />;
      default:
        return null;
    }
  };

  const renderKanbanCard = (tarjeta) => (
    <Card
      key={tarjeta.id}
      sx={{
        mb: 2,
        border: '2px solid',
        borderColor: tarjeta.estado === 'empty' ? 'error.main' : tarjeta.estado === 'in_transit' ? 'warning.main' : 'success.main'
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {tarjeta.material_codigo}
          </Typography>
          {getEstadoIcon(tarjeta.estado)}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {t('kanban_cantidad', 'Cantidad')}: {tarjeta.cantidad_contenedor}
        </Typography>
        <Chip
          label={tarjeta.tipo}
          color={getTipoChipColor(tarjeta.tipo)}
          size="small"
          sx={{ mt: 1, mb: 1 }}
        />
        {tarjeta.proveedor_cuit && (
          <Typography variant="caption" display="block" color="text.secondary">
            {t('kanban_proveedor', 'Proveedor')}: {tarjeta.proveedor_cuit}
          </Typography>
        )}
        <Typography variant="caption" display="block" color="text.secondary">
          {t('kanban_ciclos', 'Ciclos')}: {tarjeta.ciclos_totales}
        </Typography>
        {tarjeta.ubicacion_supermarket && (
          <Typography variant="caption" display="block" color="text.secondary">
            {t('kanban_ubicacion', 'Ubicación')}: {tarjeta.ubicacion_supermarket}
          </Typography>
        )}
        <Box mt={2} display="flex" gap={1}>
          {tarjeta.estado === 'full' && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<EmptyIcon />}
              onClick={() => setActionDialog({ open: true, type: 'empty', tarjeta })}
            >
              {t('kanban_vaciar', 'Vaciar')}
            </Button>
          )}
          {tarjeta.estado === 'empty' && (
            <Button
              size="small"
              variant="outlined"
              color="success"
              startIcon={<FillIcon />}
              onClick={() => setActionDialog({ open: true, type: 'fill', tarjeta })}
            >
              {t('kanban_llenar', 'Llenar')}
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  const senalesColumns = [
    {
      headerName: t('kanban_material', 'Material'),
      field: 'material_codigo',
      flex: 1
    },
    {
      headerName: t('kanban_tipo', 'Tipo'),
      field: 'tipo',
      flex: 1,
      cellRenderer: (params) => (
        <Chip label={params.value} size="small" color="primary" />
      )
    },
    {
      headerName: t('kanban_estado', 'Estado'),
      field: 'estado',
      flex: 1,
      cellRenderer: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'completada' ? 'success' : params.value === 'en_proceso' ? 'warning' : 'default'}
        />
      )
    },
    {
      headerName: t('kanban_cantidad_solicitada', 'Cantidad Solicitada'),
      field: 'cantidad_solicitada',
      flex: 1
    },
    {
      headerName: t('kanban_fecha', 'Fecha Generación'),
      field: 'fecha_generacion',
      flex: 1,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : ''
    }
  ];

  if (loading && !tableroDetalle) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>{t('common_loading', 'Cargando...')}</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          {t('kanban_titulo', 'Tablero Kanban')}
        </Typography>
        <Tooltip title={t('kanban_refresh', 'Actualizar')}>
          <IconButton onClick={reload}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* KPIs */}
      {kpis && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
                {kpis.tarjetas_vacias}
              </Typography>
              <Typography variant="body2" sx={{ color: 'white' }}>
                {t('kanban_vacias', 'Tarjetas Vacías')}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
                {kpis.tarjetas_transito}
              </Typography>
              <Typography variant="body2" sx={{ color: 'white' }}>
                {t('kanban_transito', 'En Tránsito')}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
                {kpis.tarjetas_llenas}
              </Typography>
              <Typography variant="body2" sx={{ color: 'white' }}>
                {t('kanban_llenas', 'Tarjetas Llenas')}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
                {kpis.senales_pendientes}
              </Typography>
              <Typography variant="body2" sx={{ color: 'white' }}>
                {t('kanban_senales_pendientes', 'Señales Pendientes')}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Selector de Tablero */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>{t('kanban_seleccionar_tablero', 'Seleccionar Tablero')}</InputLabel>
        <Select
          value={selectedTablero || ''}
          onChange={(e) => setSelectedTablero(e.target.value)}
          label={t('kanban_seleccionar_tablero', 'Seleccionar Tablero')}
        >
          {tableros.map((tb) => (
            <MenuItem key={tb.id} value={tb.id}>
              {tb.nombre}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {tableroDetalle && (
        <>
          {/* Columnas Kanban */}
          <Grid container spacing={3} mb={4}>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, bgcolor: 'error.light', minHeight: '400px' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'white' }}>
                  {t('kanban_vacias', 'Vacías')} ({tableroDetalle.tarjetas.filter(t => t.estado === 'empty').length})
                </Typography>
                {tableroDetalle.tarjetas
                  .filter((t) => t.estado === 'empty')
                  .map((tarjeta) => renderKanbanCard(tarjeta))}
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, bgcolor: 'warning.light', minHeight: '400px' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'white' }}>
                  {t('kanban_transito', 'En Tránsito')} ({tableroDetalle.tarjetas.filter(t => t.estado === 'in_transit').length})
                </Typography>
                {tableroDetalle.tarjetas
                  .filter((t) => t.estado === 'in_transit')
                  .map((tarjeta) => renderKanbanCard(tarjeta))}
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, bgcolor: 'success.light', minHeight: '400px' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'white' }}>
                  {t('kanban_llenas', 'Llenas')} ({tableroDetalle.tarjetas.filter(t => t.estado === 'full').length})
                </Typography>
                {tableroDetalle.tarjetas
                  .filter((t) => t.estado === 'full')
                  .map((tarjeta) => renderKanbanCard(tarjeta))}
              </Paper>
            </Grid>
          </Grid>

          {/* Señales Pendientes */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              {t('kanban_senales_pendientes', 'Señales Pendientes')} ({tableroDetalle.senales_pendientes.length})
            </Typography>
            <SPMAgGrid
              rowData={tableroDetalle.senales_pendientes}
              columnDefs={senalesColumns}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true
              }}
              pagination={true}
              paginationPageSize={10}
              height={300}
              exportFileName="kanban-signals"
            />
          </Paper>
        </>
      )}

      {/* Dialog de Confirmación */}
      <Dialog
        open={actionDialog.open}
        onClose={() => setActionDialog({ open: false, type: null, tarjeta: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {actionDialog.type === 'empty'
            ? t('kanban_confirmar_vaciar', 'Confirmar Vaciar Tarjeta')
            : t('kanban_confirmar_llenar', 'Confirmar Llenar Tarjeta')}
        </DialogTitle>
        <DialogContent>
          {actionDialog.tarjeta && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>{t('kanban_material', 'Material')}:</strong> {actionDialog.tarjeta.material_codigo}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('kanban_cantidad', 'Cantidad')}:</strong> {actionDialog.tarjeta.cantidad_contenedor}
                </Typography>
              </Alert>
              {actionDialog.type === 'empty' && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {t('kanban_aviso_vaciar', 'Al vaciar la tarjeta se generará automáticamente una señal de reposición.')}
                </Alert>
              )}
              {actionDialog.type === 'fill' && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {t('kanban_aviso_llenar', 'Al llenar la tarjeta se incrementará el contador de ciclos.')}
                </Alert>
              )}
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('kanban_notas', 'Notas (opcional)')}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                sx={{ mt: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog({ open: false, type: null, tarjeta: null })}>
            {t('common_cancel', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            color={actionDialog.type === 'empty' ? 'error' : 'success'}
            onClick={actionDialog.type === 'empty' ? handleVaciarTarjeta : handleLlenarTarjeta}
          >
            {t('common_confirm', 'Confirmar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KanbanBoard;
