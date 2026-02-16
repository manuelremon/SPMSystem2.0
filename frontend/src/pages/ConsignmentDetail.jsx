/**
 * ConsignmentDetail - Detalle de programa de consignación
 *
 * Header con info + tabs: Stock, Consumptions, Reconciliations, Config
 * Sprint 83
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import api from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/formatters';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InventoryIcon from '@mui/icons-material/Inventory';

import { SPMAgGrid } from '../components/ui/SPMAgGrid';

const ESTADO_RECON_COLORS = {
  draft: 'default',
  enviado: 'info',
  confirmado: 'success',
  facturado: 'primary',
};

export default function ConsignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();

  const [programa, setPrograma] = useState(null);
  const [stock, setStock] = useState([]);
  const [consumos, setConsumos] = useState([]);
  const [reconciliaciones, setReconciliaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Stock dialog
  const [stockOpen, setStockOpen] = useState(false);
  const [stockSubmitting, setStockSubmitting] = useState(false);
  const [stockForm, setStockForm] = useState({
    material_codigo: '',
    cantidad_disponible: '',
    valor_unitario: '',
  });

  // Consumo dialog
  const [consumoOpen, setConsumoOpen] = useState(false);
  const [consumoSubmitting, setConsumoSubmitting] = useState(false);
  const [consumoForm, setConsumoForm] = useState({
    stock_id: '',
    cantidad: '',
  });

  // Reconciliacion dialog
  const [reconOpen, setReconOpen] = useState(false);
  const [reconSubmitting, setReconSubmitting] = useState(false);
  const [reconPeriodo, setReconPeriodo] = useState('');

  // Config
  const [configEditing, setConfigEditing] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configForm, setConfigForm] = useState({
    nombre: '',
    descripcion: '',
    estado: '',
    periodo_reconciliacion: '',
    porcentaje_margen: '',
  });

  const fetchDetalle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/consignment/programs/${id}`);
      if (res.data?.ok) {
        setPrograma(res.data.programa);
        setStock(res.data.stock || []);
        setConsumos(res.data.consumos_recientes || []);
        setReconciliaciones(res.data.reconciliaciones || []);

        // Initialize config form
        if (res.data.programa) {
          setConfigForm({
            nombre: res.data.programa.nombre || '',
            descripcion: res.data.programa.descripcion || '',
            estado: res.data.programa.estado || '',
            periodo_reconciliacion: res.data.programa.periodo_reconciliacion || '',
            porcentaje_margen: res.data.programa.porcentaje_margen || '',
          });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('consign_error_detail', 'Error al cargar detalle'));
    } finally {
      setLoading(false);
    }
  }, [id, t, toast]);

  useEffect(() => {
    fetchDetalle();
  }, [fetchDetalle]);

  const handleTabChange = useCallback((event, newValue) => {
    setActiveTab(newValue);
  }, []);

  // Stock handlers
  const handleStockOpen = useCallback(() => {
    setStockForm({ material_codigo: '', cantidad_disponible: '', valor_unitario: '' });
    setStockOpen(true);
  }, []);

  const handleStockSubmit = useCallback(async () => {
    if (!stockForm.material_codigo.trim() || !stockForm.cantidad_disponible) {
      toast.warning(t('consign_fill_stock', 'Complete los campos requeridos'));
      return;
    }

    setStockSubmitting(true);
    try {
      const payload = {
        material_codigo: stockForm.material_codigo.trim(),
        cantidad_disponible: parseFloat(stockForm.cantidad_disponible),
        valor_unitario: stockForm.valor_unitario ? parseFloat(stockForm.valor_unitario) : undefined,
      };

      const res = await api.post(`/consignment/programs/${id}/stock`, payload);
      if (res.data?.ok) {
        toast.success(t('consign_stock_updated', 'Stock actualizado'));
        setStockOpen(false);
        fetchDetalle();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('consign_error_stock', 'Error al actualizar stock'));
    } finally {
      setStockSubmitting(false);
    }
  }, [id, stockForm, t, toast, fetchDetalle]);

  // Consumo handlers
  const handleConsumoOpen = useCallback(() => {
    setConsumoForm({ stock_id: '', cantidad: '' });
    setConsumoOpen(true);
  }, []);

  const handleConsumoSubmit = useCallback(async () => {
    if (!consumoForm.stock_id || !consumoForm.cantidad) {
      toast.warning(t('consign_fill_consumo', 'Complete los campos requeridos'));
      return;
    }

    setConsumoSubmitting(true);
    try {
      const payload = {
        stock_id: parseInt(consumoForm.stock_id, 10),
        cantidad: parseFloat(consumoForm.cantidad),
      };

      const res = await api.post(`/consignment/programs/${id}/consume`, payload);
      if (res.data?.ok) {
        toast.success(t('consign_consumo_registered', 'Consumo registrado'));
        setConsumoOpen(false);
        fetchDetalle();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('consign_error_consumo', 'Error al registrar consumo'));
    } finally {
      setConsumoSubmitting(false);
    }
  }, [id, consumoForm, t, toast, fetchDetalle]);

  // Reconciliacion handlers
  const handleReconOpen = useCallback(() => {
    setReconPeriodo('');
    setReconOpen(true);
  }, []);

  const handleReconGenerate = useCallback(async () => {
    if (!reconPeriodo.trim()) {
      toast.warning(t('consign_periodo_required', 'Ingrese periodo (YYYY-MM)'));
      return;
    }

    setReconSubmitting(true);
    try {
      const res = await api.post(`/consignment/programs/${id}/reconciliation`, {
        periodo: reconPeriodo.trim(),
      });
      if (res.data?.ok) {
        toast.success(t('consign_recon_generated', 'Reconciliación generada'));
        setReconOpen(false);
        fetchDetalle();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('consign_error_recon', 'Error al generar reconciliación'));
    } finally {
      setReconSubmitting(false);
    }
  }, [id, reconPeriodo, t, toast, fetchDetalle]);

  const handleReconSend = useCallback(async (reconId) => {
    try {
      const res = await api.put(`/consignment/reconciliations/${reconId}/send`);
      if (res.data?.ok) {
        toast.success(t('consign_recon_sent', 'Reconciliación enviada'));
        fetchDetalle();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('consign_error_send', 'Error al enviar'));
    }
  }, [t, toast, fetchDetalle]);

  const handleReconConfirm = useCallback(async (reconId) => {
    try {
      const res = await api.put(`/consignment/reconciliations/${reconId}/confirm`);
      if (res.data?.ok) {
        toast.success(t('consign_recon_confirmed', 'Reconciliación confirmada'));
        fetchDetalle();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('consign_error_confirm', 'Error al confirmar'));
    }
  }, [t, toast, fetchDetalle]);

  // Config handlers
  const handleConfigSave = useCallback(async () => {
    setConfigSaving(true);
    try {
      const payload = {
        nombre: configForm.nombre.trim(),
        descripcion: configForm.descripcion.trim() || undefined,
        estado: configForm.estado,
        periodo_reconciliacion: configForm.periodo_reconciliacion,
        porcentaje_margen: configForm.porcentaje_margen ? parseFloat(configForm.porcentaje_margen) : undefined,
      };

      const res = await api.put(`/consignment/programs/${id}`, payload);
      if (res.data?.ok) {
        toast.success(t('consign_config_saved', 'Configuración guardada'));
        setConfigEditing(false);
        fetchDetalle();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || t('consign_error_config', 'Error al guardar'));
    } finally {
      setConfigSaving(false);
    }
  }, [id, configForm, t, toast, fetchDetalle]);

  // AG-Grid columns
  const stockColumns = useMemo(() => [
    { headerName: t('consign_col_material', 'Material'), field: 'material_codigo', flex: 1, sortable: true },
    {
      headerName: t('consign_col_disponible', 'Disponible'),
      field: 'cantidad_disponible',
      width: 140,
      sortable: true,
      valueFormatter: (p) => p.value?.toFixed(2) || '0.00',
    },
    {
      headerName: t('consign_col_consumida', 'Consumida Acumulada'),
      field: 'cantidad_consumida_acumulada',
      width: 180,
      sortable: true,
      valueFormatter: (p) => p.value?.toFixed(2) || '0.00',
    },
    {
      headerName: t('consign_col_valor', 'Valor Unitario'),
      field: 'valor_unitario',
      width: 150,
      sortable: true,
      valueFormatter: (p) => (p.value != null ? formatCurrency(p.value) : '-'),
    },
    {
      headerName: t('consign_col_updated', 'Última Actualización'),
      field: 'ultima_actualizacion',
      width: 180,
      sortable: true,
      valueFormatter: (p) => formatDateTime(p.value),
    },
  ], [t]);

  const consumoColumns = useMemo(() => [
    { headerName: t('consign_col_material', 'Material'), field: 'material_codigo', flex: 1, sortable: true },
    {
      headerName: t('consign_col_cantidad', 'Cantidad'),
      field: 'cantidad',
      width: 120,
      sortable: true,
      valueFormatter: (p) => p.value?.toFixed(2) || '0.00',
    },
    { headerName: t('consign_col_solicitud', 'Solicitud'), field: 'solicitud_id', width: 120, sortable: true },
    {
      headerName: t('consign_col_fecha_consumo', 'Fecha Consumo'),
      field: 'fecha_consumo',
      width: 180,
      sortable: true,
      valueFormatter: (p) => formatDateTime(p.value),
    },
    {
      headerName: t('consign_col_facturado', 'Facturado'),
      field: 'facturado',
      width: 120,
      sortable: true,
      cellRenderer: (p) => (p.value ? <Chip label="Sí" color="success" size="small" /> : <Chip label="No" size="small" />),
    },
  ], [t]);

  const reconColumns = useMemo(() => [
    { headerName: t('consign_col_periodo', 'Periodo'), field: 'periodo', width: 120, sortable: true },
    {
      headerName: t('consign_col_cantidad_total', 'Cantidad Total'),
      field: 'cantidad_consumida_total',
      width: 150,
      sortable: true,
      valueFormatter: (p) => p.value?.toFixed(2) || '0.00',
    },
    {
      headerName: t('consign_col_monto_total', 'Monto Total'),
      field: 'monto_total',
      width: 150,
      sortable: true,
      valueFormatter: (p) => formatCurrency(p.value || 0),
    },
    {
      headerName: t('consign_col_estado', 'Estado'),
      field: 'estado',
      width: 140,
      sortable: true,
      cellRenderer: (p) => (
        <Chip label={t(`consign_recon_${p.value}`, p.value)} color={ESTADO_RECON_COLORS[p.value] || 'default'} size="small" />
      ),
    },
    {
      headerName: t('consign_col_created', 'Creado'),
      field: 'created_at',
      width: 180,
      sortable: true,
      valueFormatter: (p) => formatDateTime(p.value),
    },
    {
      headerName: t('common_acciones', 'Acciones'),
      field: 'id',
      width: 200,
      cellRenderer: (params) => {
        const estado = params.data.estado;
        return (
          <Stack direction="row" spacing={0.5}>
            {estado === 'draft' && (
              <Button size="small" variant="outlined" onClick={() => handleReconSend(params.value)}>
                {t('consign_send', 'Enviar')}
              </Button>
            )}
            {estado === 'enviado' && (
              <Button size="small" variant="outlined" color="success" onClick={() => handleReconConfirm(params.value)}>
                {t('consign_confirm', 'Confirmar')}
              </Button>
            )}
          </Stack>
        );
      },
    },
  ], [t, handleReconSend, handleReconConfirm]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!programa) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          {t('consign_not_found', 'Programa no encontrado')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" gap={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/consignment')}>
            {t('common_volver', 'Volver')}
          </Button>
          <Stack>
            <Stack direction="row" alignItems="center" gap={1}>
              <InventoryIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
                {programa.nombre}
              </Typography>
              <Chip label={t(`consign_estado_${programa.estado}`, programa.estado)} color={programa.estado === 'active' ? 'success' : 'default'} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t('consign_proveedor', 'Proveedor')}: {programa.proveedor_nombre} ({programa.proveedor_cuit})
            </Typography>
          </Stack>
        </Stack>
      </Stack>

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={t('consign_tab_stock', 'Stock')} />
          <Tab label={t('consign_tab_consumos', 'Consumos')} />
          <Tab label={t('consign_tab_recon', 'Reconciliaciones')} />
          <Tab label={t('consign_tab_config', 'Configuración')} />
        </Tabs>

        {/* Stock Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={handleStockOpen}>
                {t('consign_update_stock', 'Actualizar Stock')}
              </Button>
            </Stack>
            <SPMAgGrid
              rowData={stock}
              columnDefs={stockColumns}
              defaultColDef={{ resizable: true }}
              pagination={true}
              paginationPageSize={10}
              emptyMessage={t('consign_no_stock', 'Sin stock')}
              height={400}
              exportFileName="consignment-stock"
            />
          </Box>
        )}

        {/* Consumos Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={handleConsumoOpen}>
                {t('consign_register_consumo', 'Registrar Consumo')}
              </Button>
            </Stack>
            <SPMAgGrid
              rowData={consumos}
              columnDefs={consumoColumns}
              defaultColDef={{ resizable: true }}
              pagination={true}
              paginationPageSize={10}
              emptyMessage={t('consign_no_consumos', 'Sin consumos')}
              height={400}
              exportFileName="consignment-consumos"
            />
          </Box>
        )}

        {/* Reconciliaciones Tab */}
        {activeTab === 2 && (
          <Box sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={handleReconOpen}>
                {t('consign_new_recon', 'Nueva Reconciliación')}
              </Button>
            </Stack>
            <SPMAgGrid
              rowData={reconciliaciones}
              columnDefs={reconColumns}
              defaultColDef={{ resizable: true }}
              pagination={true}
              paginationPageSize={10}
              emptyMessage={t('consign_no_recon', 'Sin reconciliaciones')}
              height={400}
              exportFileName="consignment-reconciliaciones"
            />
          </Box>
        )}

        {/* Config Tab */}
        {activeTab === 3 && (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label={t('consign_field_nombre', 'Nombre del Programa')}
                  value={configForm.nombre}
                  onChange={(e) => setConfigForm({ ...configForm, nombre: e.target.value })}
                  fullWidth
                  size="small"
                  disabled={!configEditing}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label={t('consign_field_descripcion', 'Descripción')}
                  value={configForm.descripcion}
                  onChange={(e) => setConfigForm({ ...configForm, descripcion: e.target.value })}
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  disabled={!configEditing}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label={t('consign_field_estado', 'Estado')}
                  value={configForm.estado}
                  onChange={(e) => setConfigForm({ ...configForm, estado: e.target.value })}
                  fullWidth
                  size="small"
                  disabled={!configEditing}
                >
                  <MenuItem value="active">{t('consign_estado_active', 'Activo')}</MenuItem>
                  <MenuItem value="suspended">{t('consign_estado_suspended', 'Suspendido')}</MenuItem>
                  <MenuItem value="terminated">{t('consign_estado_terminated', 'Terminado')}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label={t('consign_field_periodo', 'Periodo de Reconciliación')}
                  value={configForm.periodo_reconciliacion}
                  onChange={(e) => setConfigForm({ ...configForm, periodo_reconciliacion: e.target.value })}
                  fullWidth
                  size="small"
                  disabled={!configEditing}
                >
                  <MenuItem value="mensual">{t('consign_periodo_mensual', 'Mensual')}</MenuItem>
                  <MenuItem value="quincenal">{t('consign_periodo_quincenal', 'Quincenal')}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label={t('consign_field_margen', 'Porcentaje Margen (%)')}
                  value={configForm.porcentaje_margen}
                  onChange={(e) => setConfigForm({ ...configForm, porcentaje_margen: e.target.value })}
                  fullWidth
                  size="small"
                  type="number"
                  disabled={!configEditing}
                />
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={2}>
                  {!configEditing ? (
                    <Button variant="contained" onClick={() => setConfigEditing(true)}>
                      {t('common_editar', 'Editar')}
                    </Button>
                  ) : (
                    <>
                      <Button onClick={() => setConfigEditing(false)} disabled={configSaving}>
                        {t('common_cancelar', 'Cancelar')}
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleConfigSave}
                        disabled={configSaving}
                        startIcon={configSaving ? <CircularProgress size={16} /> : null}
                      >
                        {t('common_guardar', 'Guardar')}
                      </Button>
                    </>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Stock Dialog */}
      <Dialog open={stockOpen} onClose={() => setStockOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('consign_update_stock_title', 'Actualizar Stock')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('consign_field_material', 'Código Material')}
              value={stockForm.material_codigo}
              onChange={(e) => setStockForm({ ...stockForm, material_codigo: e.target.value })}
              fullWidth
              size="small"
              required
            />
            <TextField
              label={t('consign_field_disponible', 'Cantidad Disponible')}
              value={stockForm.cantidad_disponible}
              onChange={(e) => setStockForm({ ...stockForm, cantidad_disponible: e.target.value })}
              fullWidth
              size="small"
              type="number"
              required
            />
            <TextField
              label={t('consign_field_valor', 'Valor Unitario')}
              value={stockForm.valor_unitario}
              onChange={(e) => setStockForm({ ...stockForm, valor_unitario: e.target.value })}
              fullWidth
              size="small"
              type="number"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStockOpen(false)} disabled={stockSubmitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button variant="contained" onClick={handleStockSubmit} disabled={stockSubmitting}>
            {stockSubmitting ? <CircularProgress size={16} /> : t('common_guardar', 'Guardar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Consumo Dialog */}
      <Dialog open={consumoOpen} onClose={() => setConsumoOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('consign_register_consumo_title', 'Registrar Consumo')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label={t('consign_field_stock', 'Material')}
              value={consumoForm.stock_id}
              onChange={(e) => setConsumoForm({ ...consumoForm, stock_id: e.target.value })}
              fullWidth
              size="small"
              required
            >
              {stock.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.material_codigo} (Disponible: {s.cantidad_disponible?.toFixed(2)})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('consign_field_cantidad', 'Cantidad Consumida')}
              value={consumoForm.cantidad}
              onChange={(e) => setConsumoForm({ ...consumoForm, cantidad: e.target.value })}
              fullWidth
              size="small"
              type="number"
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConsumoOpen(false)} disabled={consumoSubmitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button variant="contained" onClick={handleConsumoSubmit} disabled={consumoSubmitting}>
            {consumoSubmitting ? <CircularProgress size={16} /> : t('common_registrar', 'Registrar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reconciliacion Dialog */}
      <Dialog open={reconOpen} onClose={() => setReconOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('consign_new_recon_title', 'Generar Reconciliación')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('consign_field_periodo', 'Periodo (YYYY-MM)')}
            value={reconPeriodo}
            onChange={(e) => setReconPeriodo(e.target.value)}
            fullWidth
            size="small"
            placeholder="2026-02"
            sx={{ mt: 1 }}
            required
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReconOpen(false)} disabled={reconSubmitting}>
            {t('common_cancelar', 'Cancelar')}
          </Button>
          <Button variant="contained" onClick={handleReconGenerate} disabled={reconSubmitting}>
            {reconSubmitting ? <CircularProgress size={16} /> : t('consign_generate', 'Generar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
