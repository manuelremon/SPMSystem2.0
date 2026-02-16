/**
 * PriceManagement - Gestión de listas de precios y negociaciones
 *
 * Tabs:
 * 1. Listas de Precios - AG-Grid con crear/activar/ver detalle
 * 2. Negociaciones - Aprobar/Rechazar inline
 * 3. Historial - Timeline de precios
 *
 * Sprint 82
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatDateTime, formatDate, formatCurrency } from '../utils/formatters';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SearchIcon from '@mui/icons-material/Search';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';

import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_COLORS = {
  draft: 'default',
  active: 'success',
  expired: 'error',
};

const NEGO_ESTADO_COLORS = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

export default function PriceManagement() {
  const { t } = useI18n();
  const toast = useToast();

  const [tab, setTab] = useState(0);

  // Listas Tab
  const [listas, setListas] = useState([]);
  const [listasLoading, setListasLoading] = useState(true);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [newList, setNewList] = useState({
    nombre: '',
    proveedor_cuit: '',
    moneda: 'ARS',
    fecha_vigencia_desde: '',
    fecha_vigencia_hasta: '',
    notas: '',
  });
  const [creating, setCreating] = useState(false);

  // Detalle Lista Dialog
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleListaId, setDetalleListaId] = useState(null);
  const [detalleLista, setDetalleLista] = useState(null);
  const [detalleItems, setDetalleItems] = useState([]);
  const [detalleLoading, setDetalleLoading] = useState(false);

  // Negociaciones Tab
  const [negociaciones, setNegociaciones] = useState([]);
  const [negosLoading, setNegosLoading] = useState(false);
  const [processingNego, setProcessingNego] = useState(null);

  // Historial Tab
  const [historialMaterial, setHistorialMaterial] = useState('');
  const [historial, setHistorial] = useState([]);
  const [historialLoading, setHistorialLoading] = useState(false);

  const fetchListas = useCallback(async () => {
    setListasLoading(true);
    try {
      const res = await api.get('/prices/lists');
      if (res.data?.ok) {
        setListas(res.data.items || []);
      }
    } catch (err) {
      toast.error(t('price_error_listas', 'Error al cargar listas de precios'));
    } finally {
      setListasLoading(false);
    }
  }, [t, toast]);

  const fetchNegociaciones = useCallback(async () => {
    setNegosLoading(true);
    try {
      const res = await api.get('/prices/negotiations?estado=pending');
      if (res.data?.ok) {
        setNegociaciones(res.data.negociaciones || []);
      }
    } catch (err) {
      toast.error(t('price_error_negos', 'Error al cargar negociaciones'));
    } finally {
      setNegosLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    if (tab === 0) fetchListas();
    else if (tab === 1) fetchNegociaciones();
  }, [tab, fetchListas, fetchNegociaciones]);

  const handleCreateList = useCallback(async () => {
    if (!newList.nombre.trim()) {
      toast.warning(t('price_nombre_requerido', 'Nombre requerido'));
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/prices/lists', newList);
      if (res.data?.ok) {
        toast.success(t('price_lista_creada', 'Lista creada exitosamente'));
        setCreateListOpen(false);
        setNewList({
          nombre: '',
          proveedor_cuit: '',
          moneda: 'ARS',
          fecha_vigencia_desde: '',
          fecha_vigencia_hasta: '',
          notas: '',
        });
        fetchListas();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('price_error_crear', 'Error al crear lista'));
    } finally {
      setCreating(false);
    }
  }, [newList, t, toast, fetchListas]);

  const handleActivarLista = useCallback(async (listaId) => {
    try {
      const res = await api.put(`/prices/lists/${listaId}/activate`);
      if (res.data?.ok) {
        toast.success(t('price_lista_activada', 'Lista activada'));
        fetchListas();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('price_error_activar', 'Error al activar lista'));
    }
  }, [t, toast, fetchListas]);

  const handleVerDetalle = useCallback(async (listaId) => {
    setDetalleListaId(listaId);
    setDetalleOpen(true);
    setDetalleLoading(true);
    try {
      const res = await api.get(`/prices/lists/${listaId}`);
      if (res.data?.ok) {
        setDetalleLista(res.data.lista || {});
        setDetalleItems(res.data.items || []);
      }
    } catch (err) {
      toast.error(t('price_error_detalle', 'Error al cargar detalle'));
    } finally {
      setDetalleLoading(false);
    }
  }, [t, toast]);

  const handleAprobarNego = useCallback(async (negoId) => {
    setProcessingNego(negoId);
    try {
      const res = await api.put(`/prices/negotiations/${negoId}/approve`);
      if (res.data?.ok) {
        toast.success(t('price_nego_aprobada', 'Negociacion aprobada'));
        fetchNegociaciones();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('price_error_aprobar_nego', 'Error al aprobar'));
    } finally {
      setProcessingNego(null);
    }
  }, [t, toast, fetchNegociaciones]);

  const handleRechazarNego = useCallback(async (negoId) => {
    setProcessingNego(negoId);
    try {
      const res = await api.put(`/prices/negotiations/${negoId}/reject`);
      if (res.data?.ok) {
        toast.success(t('price_nego_rechazada', 'Negociacion rechazada'));
        fetchNegociaciones();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('price_error_rechazar_nego', 'Error al rechazar'));
    } finally {
      setProcessingNego(null);
    }
  }, [t, toast, fetchNegociaciones]);

  const handleSearchHistorial = useCallback(async () => {
    if (!historialMaterial.trim()) {
      toast.warning(t('price_material_requerido', 'Ingrese codigo de material'));
      return;
    }
    setHistorialLoading(true);
    try {
      const res = await api.get(`/prices/material/${historialMaterial.trim()}/history`);
      if (res.data?.ok) {
        setHistorial(res.data.historial || []);
      }
    } catch (err) {
      toast.error(t('price_error_historial', 'Error al cargar historial'));
    } finally {
      setHistorialLoading(false);
    }
  }, [historialMaterial, t, toast]);

  // AG-Grid column defs
  const listasColumns = useMemo(() => [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'nombre', headerName: t('price_nombre', 'Nombre'), flex: 1, minWidth: 150 },
    {
      field: 'proveedor_nombre',
      headerName: t('price_proveedor', 'Proveedor'),
      flex: 1,
      minWidth: 150,
      valueGetter: (params) => params.data.proveedor_nombre || t('price_general', 'General'),
    },
    { field: 'moneda', headerName: t('price_moneda', 'Moneda'), width: 100 },
    {
      field: 'fecha_vigencia_desde',
      headerName: t('price_desde', 'Desde'),
      width: 120,
      valueFormatter: (params) => params.value ? formatDate(params.value) : '-',
    },
    {
      field: 'fecha_vigencia_hasta',
      headerName: t('price_hasta', 'Hasta'),
      width: 120,
      valueFormatter: (params) => params.value ? formatDate(params.value) : '-',
    },
    {
      field: 'estado',
      headerName: t('price_estado', 'Estado'),
      width: 120,
      cellRenderer: (params) => (
        <Chip
          size="small"
          label={params.value}
          color={ESTADO_COLORS[params.value] || 'default'}
        />
      ),
    },
    { field: 'items_count', headerName: t('price_items', 'Items'), width: 100 },
    {
      field: 'acciones',
      headerName: t('price_acciones', 'Acciones'),
      width: 180,
      cellRenderer: (params) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleVerDetalle(params.data.id)}
            title={t('price_ver_detalle', 'Ver Detalle')}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
          {params.data.estado === 'draft' && (
            <IconButton
              size="small"
              color="success"
              onClick={() => handleActivarLista(params.data.id)}
              title={t('price_activar', 'Activar')}
            >
              <PlayArrowIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      ),
    },
  ], [t, handleVerDetalle, handleActivarLista]);

  const negosColumns = useMemo(() => [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'material_codigo', headerName: t('price_material', 'Material'), width: 130 },
    {
      field: 'material_nombre',
      headerName: t('price_descripcion', 'Descripcion'),
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'proveedor_nombre',
      headerName: t('price_proveedor', 'Proveedor'),
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'precio_anterior',
      headerName: t('price_anterior', 'Precio Anterior'),
      width: 140,
      valueFormatter: (params) => params.value ? formatCurrency(params.value) : '-',
    },
    {
      field: 'precio_nuevo',
      headerName: t('price_nuevo', 'Precio Nuevo'),
      width: 140,
      valueFormatter: (params) => formatCurrency(params.value),
      cellStyle: (params) => {
        if (params.data.precio_anterior && params.value < params.data.precio_anterior) {
          return { color: 'green', fontWeight: 700 };
        }
        return {};
      },
    },
    {
      field: 'descuento_negociado_pct',
      headerName: t('price_descuento', 'Descuento'),
      width: 120,
      valueFormatter: (params) => `${params.value || 0}%`,
    },
    {
      field: 'fecha',
      headerName: t('price_fecha', 'Fecha'),
      width: 120,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: 'acciones',
      headerName: t('price_acciones', 'Acciones'),
      width: 150,
      cellRenderer: (params) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleRechazarNego(params.data.id)}
            disabled={processingNego === params.data.id}
            title={t('price_rechazar', 'Rechazar')}
          >
            {processingNego === params.data.id ? (
              <CircularProgress size={16} />
            ) : (
              <CloseIcon fontSize="small" />
            )}
          </IconButton>
          <IconButton
            size="small"
            color="success"
            onClick={() => handleAprobarNego(params.data.id)}
            disabled={processingNego === params.data.id}
            title={t('price_aprobar', 'Aprobar')}
          >
            {processingNego === params.data.id ? (
              <CircularProgress size={16} />
            ) : (
              <CheckIcon fontSize="small" />
            )}
          </IconButton>
        </Stack>
      ),
    },
  ], [t, processingNego, handleAprobarNego, handleRechazarNego]);

  const detalleItemsColumns = useMemo(() => [
    { field: 'material_codigo', headerName: t('price_material', 'Material'), width: 130 },
    {
      field: 'material_nombre',
      headerName: t('price_descripcion', 'Descripcion'),
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'precio_unitario',
      headerName: t('price_precio_unitario', 'Precio Unitario'),
      width: 150,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    { field: 'unidad', headerName: t('price_unidad', 'Unidad'), width: 100 },
    { field: 'cantidad_minima', headerName: t('price_min', 'Min'), width: 80 },
    { field: 'cantidad_maxima', headerName: t('price_max', 'Max'), width: 80 },
    {
      field: 'descuento_pct',
      headerName: t('price_descuento', 'Descuento'),
      width: 120,
      valueFormatter: (params) => `${params.value || 0}%`,
    },
  ], [t]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1}>
        <PriceCheckIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {t('price_title', 'Gestion de Precios')}
        </Typography>
      </Stack>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Tabs value={tab} onChange={(e, val) => setTab(val)}>
          <Tab label={t('price_tab_listas', 'Listas de Precios')} />
          <Tab label={t('price_tab_negos', 'Negociaciones')} />
          <Tab label={t('price_tab_historial', 'Historial')} />
        </Tabs>

        <Divider />

        <Box sx={{ p: 3 }}>
          {/* Tab 0: Listas */}
          {tab === 0 && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">
                  {t('price_listas_subtitle', 'Gestionar listas de precios por proveedor')}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateListOpen(true)}
                  size="small"
                >
                  {t('price_crear_lista', 'Crear Lista')}
                </Button>
              </Stack>

              {listasLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <SPMAgGrid
                  rowData={listas}
                  columnDefs={listasColumns}
                  height={500}
                  pagination
                  paginationPageSize={20}
                  exportFileName="price-lists"
                />
              )}
            </Box>
          )}

          {/* Tab 1: Negociaciones */}
          {tab === 1 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                {t('price_negos_subtitle', 'Aprobar o rechazar negociaciones pendientes')}
              </Typography>

              {negosLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : negociaciones.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  {t('price_no_negos', 'No hay negociaciones pendientes')}
                </Typography>
              ) : (
                <SPMAgGrid
                  rowData={negociaciones}
                  columnDefs={negosColumns}
                  height={500}
                  pagination
                  paginationPageSize={20}
                  exportFileName="price-negotiations"
                />
              )}
            </Box>
          )}

          {/* Tab 2: Historial */}
          {tab === 2 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                {t('price_historial_subtitle', 'Buscar historial de precios por material')}
              </Typography>

              <Stack direction="row" gap={1} sx={{ mb: 3 }}>
                <TextField
                  value={historialMaterial}
                  onChange={(e) => setHistorialMaterial(e.target.value)}
                  placeholder={t('price_material_placeholder', 'Codigo de material')}
                  size="small"
                  sx={{ width: 250 }}
                />
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={handleSearchHistorial}
                  disabled={historialLoading}
                >
                  {t('price_buscar', 'Buscar')}
                </Button>
              </Stack>

              {historialLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : historial.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  {t('price_no_historial', 'No hay historial para mostrar')}
                </Typography>
              ) : (
                <List>
                  {historial.map((item, idx) => (
                    <ListItem key={idx} sx={{ alignItems: 'flex-start', borderLeft: '2px solid', borderColor: 'primary.main', ml: 1, mb: 1 }}>
                      <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                        <FiberManualRecordIcon color="primary" sx={{ fontSize: 12 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {formatCurrency(item.precio)}
                            </Typography>
                            <Chip size="small" label={item.fuente} sx={{ fontSize: '0.7rem', height: 20 }} />
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography variant="body2" color="text.secondary">
                              {item.proveedor_nombre || t('price_sin_proveedor', 'Sin proveedor')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(item.fecha_desde)} - {item.fecha_hasta ? formatDate(item.fecha_hasta) : t('price_actual', 'Actual')}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Create List Dialog */}
      <Dialog open={createListOpen} onClose={() => setCreateListOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <AddIcon color="primary" />
            <span>{t('price_crear_lista', 'Crear Lista')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label={t('price_nombre', 'Nombre')}
                value={newList.nombre}
                onChange={(e) => setNewList((prev) => ({ ...prev, nombre: e.target.value }))}
                fullWidth
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('price_proveedor_cuit', 'CUIT Proveedor')}
                value={newList.proveedor_cuit}
                onChange={(e) => setNewList((prev) => ({ ...prev, proveedor_cuit: e.target.value }))}
                fullWidth
                size="small"
                placeholder={t('price_opcional', 'Opcional')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('price_moneda', 'Moneda')}
                value={newList.moneda}
                onChange={(e) => setNewList((prev) => ({ ...prev, moneda: e.target.value }))}
                select
                fullWidth
                size="small"
              >
                <MenuItem value="ARS">ARS</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="EUR">EUR</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('price_desde', 'Desde')}
                type="date"
                value={newList.fecha_vigencia_desde}
                onChange={(e) => setNewList((prev) => ({ ...prev, fecha_vigencia_desde: e.target.value }))}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('price_hasta', 'Hasta')}
                type="date"
                value={newList.fecha_vigencia_hasta}
                onChange={(e) => setNewList((prev) => ({ ...prev, fecha_vigencia_hasta: e.target.value }))}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={t('price_notas', 'Notas')}
                value={newList.notas}
                onChange={(e) => setNewList((prev) => ({ ...prev, notas: e.target.value }))}
                fullWidth
                size="small"
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateListOpen(false)} disabled={creating}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateList}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {t('price_crear', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detalle Lista Dialog */}
      <Dialog open={detalleOpen} onClose={() => setDetalleOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <VisibilityIcon color="primary" />
            <span>{t('price_detalle_lista', 'Detalle de Lista')}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {detalleLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : detalleLista ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    {t('price_nombre', 'Nombre')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {detalleLista.nombre}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    {t('price_estado', 'Estado')}
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      size="small"
                      label={detalleLista.estado}
                      color={ESTADO_COLORS[detalleLista.estado] || 'default'}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    {t('price_proveedor', 'Proveedor')}
                  </Typography>
                  <Typography variant="body2">
                    {detalleLista.proveedor_nombre || t('price_general', 'General')}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    {t('price_moneda', 'Moneda')}
                  </Typography>
                  <Typography variant="body2">{detalleLista.moneda}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('price_items_lista', 'Items de Precio')}
              </Typography>

              {detalleItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  {t('price_no_items', 'Sin items')}
                </Typography>
              ) : (
                <SPMAgGrid
                  rowData={detalleItems}
                  columnDefs={detalleItemsColumns}
                  height={300}
                  pagination={false}
                  exportFileName="price-list-items"
                />
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetalleOpen(false)}>{t('common_cerrar', 'Cerrar')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
