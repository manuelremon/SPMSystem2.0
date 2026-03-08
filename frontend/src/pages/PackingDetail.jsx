import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  MenuItem,
  IconButton,
  Tooltip,
  Alert,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  AutoFixHigh as OptimizeIcon,
  CheckCircle as PackIcon,
  LocalShipping as DispatchIcon,
  Label as LabelIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import api from '../services/api';
import { useI18n } from '../context/i18n';

const PackingDetail = () => {
  const { id } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [packing, setPacking] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openAddItem, setOpenAddItem] = useState(false);
  const [openGenerateLabel, setOpenGenerateLabel] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  const [newItem, setNewItem] = useState({
    material_codigo: '',
    cantidad: '',
    peso_item: '',
    template_id: '',
    bulto_numero: '',
    notas: ''
  });

  const [labelConfig, setLabelConfig] = useState({
    bulto_numero: '',
    tipo: 'shipping',
    formato: 'pdf'
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [packingRes, templatesRes] = await Promise.all([
        api.get(`/packaging/packing-lists/${id}`),
        api.get('/packaging/templates')
      ]);

      if (packingRes.data.ok) setPacking(packingRes.data.packing_list);
      if (templatesRes.data.ok) setTemplates(templatesRes.data.templates);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddItem = async () => {
    try {
      const res = await api.post(`/packaging/packing-lists/${id}/items`, newItem);
      if (res.data.ok) {
        setOpenAddItem(false);
        setNewItem({
          material_codigo: '',
          cantidad: '',
          peso_item: '',
          template_id: '',
          bulto_numero: '',
          notas: ''
        });
        loadData();
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Error al agregar item');
    }
  };

  const handleDeleteItem = (itemId) => {
    setConfirmDialog({
      open: true,
      title: t('pack_confirm_delete_item', '¿Eliminar este item?'),
      message: t('pack_confirm_delete_item_desc', 'Esta acción no se puede deshacer.'),
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          await api.delete(`/packaging/packing-lists/${id}/items/${itemId}`);
          loadData();
        } catch (error) {
          alert(error.response?.data?.error || 'Error al eliminar item');
        }
      },
    });
  };

  const handleOptimize = async () => {
    try {
      const res = await api.post(`/packaging/packing-lists/${id}/optimize`);
      if (res.data.ok) {
        const { resultado } = res.data;
        alert(
          `Optimización completa:\n` +
          `- Bultos creados: ${resultado.bultos_creados}\n` +
          `- Items asignados: ${resultado.items_asignados}\n` +
          `- Peso total: ${resultado.peso_total.toFixed(2)} kg`
        );
        loadData();
      }
    } catch (error) {
      alert('Error al optimizar');
    }
  };

  const handlePack = () => {
    setConfirmDialog({
      open: true,
      title: t('pack_confirm_pack', '¿Marcar como empacado?'),
      message: t('pack_confirm_pack_desc', 'Una vez empacado, no se podrán agregar más items.'),
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          const res = await api.put(`/packaging/packing-lists/${id}/pack`);
          if (res.data.ok) {
            loadData();
          }
        } catch (error) {
          alert(error.response?.data?.error || 'Error al empacar');
        }
      },
    });
  };

  const handleDispatch = () => {
    setConfirmDialog({
      open: true,
      title: t('pack_confirm_dispatch', '¿Despachar packing list?'),
      message: t('pack_confirm_dispatch_desc', 'El packing list se marcará como despachado.'),
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          const res = await api.put(`/packaging/packing-lists/${id}/dispatch`);
          if (res.data.ok) {
            loadData();
          }
        } catch (error) {
          alert(error.response?.data?.error || 'Error al despachar');
        }
      },
    });
  };

  const handleGenerateLabel = async () => {
    try {
      const res = await api.post(`/packaging/packing-lists/${id}/labels`, labelConfig);
      if (res.data.ok) {
        setOpenGenerateLabel(false);
        setLabelConfig({ bulto_numero: '', tipo: 'shipping', formato: 'pdf' });
        loadData();
        alert(t('pack_label_generated', 'Etiqueta generada exitosamente'));
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Error al generar etiqueta');
    }
  };

  if (!packing) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('common_loading', 'Cargando...')}</Typography>
      </Box>
    );
  }

  const itemsColumnDefs = [
    { field: 'material_codigo', headerName: t('pack_material', 'Material'), flex: 1 },
    {
      field: 'cantidad',
      headerName: t('pack_cantidad', 'Cantidad'),
      flex: 0.7,
      type: 'numericColumn'
    },
    {
      field: 'bulto_numero',
      headerName: t('pack_bulto_num', 'Bulto #'),
      flex: 0.7,
      cellRenderer: (params) => params.value || <Chip label="Sin asignar" size="small" color="warning" />
    },
    {
      field: 'peso_item',
      headerName: t('pack_peso_kg', 'Peso (kg)'),
      flex: 0.7,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ? params.value.toFixed(2) : '0.00'
    },
    {
      field: 'template_nombre',
      headerName: t('pack_template', 'Template'),
      flex: 1
    },
    {
      field: 'actions',
      headerName: t('common_actions', 'Acciones'),
      flex: 0.6,
      cellRenderer: (params) =>
        packing.estado === 'draft' ? (
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteItem(params.data.id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ) : null
    }
  ];

  const getEstadoColor = (estado) => {
    const colors = { draft: 'default', empacado: 'primary', despachado: 'success' };
    return colors[estado] || 'default';
  };

  // Group labels by bulto
  const labelsByBulto = {};
  if (packing.etiquetas) {
    packing.etiquetas.forEach((label) => {
      if (!labelsByBulto[label.bulto_numero]) {
        labelsByBulto[label.bulto_numero] = [];
      }
      labelsByBulto[label.bulto_numero].push(label);
    });
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/packing-lists')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4">{packing.numero}</Typography>
          <Chip label={t(`pack_estado_${packing.estado}`, packing.estado)} color={getEstadoColor(packing.estado)} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={t('common_refresh', 'Actualizar')}>
            <IconButton onClick={loadData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('pack_peso_total', 'Peso Total')}
            </Typography>
            <Typography variant="h5">{packing.peso_total.toFixed(2)} kg</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('pack_bultos_total', 'Bultos Totales')}
            </Typography>
            <Typography variant="h5">{packing.bultos_total}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('pack_items', 'Items')}
            </Typography>
            <Typography variant="h5">{packing.items?.length || 0}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('pack_etiquetas', 'Etiquetas')}
            </Typography>
            <Typography variant="h5">{packing.etiquetas?.length || 0}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {packing.notas && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {packing.notas}
        </Alert>
      )}

      {/* Items */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">{t('pack_items', 'Items')}</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {packing.estado === 'draft' && (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<OptimizeIcon />}
                    onClick={handleOptimize}
                    disabled={!packing.items || packing.items.length === 0}
                  >
                    {t('pack_optimize', 'Optimizar')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setOpenAddItem(true)}
                  >
                    {t('pack_add_item', 'Agregar Item')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<PackIcon />}
                    onClick={handlePack}
                    disabled={!packing.items || packing.items.length === 0}
                  >
                    {t('pack_mark_packed', 'Empacar')}
                  </Button>
                </>
              )}
              {packing.estado === 'empacado' && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<DispatchIcon />}
                  onClick={handleDispatch}
                >
                  {t('pack_dispatch', 'Despachar')}
                </Button>
              )}
            </Box>
          </Box>

          <SPMAgGrid
            rowData={packing.items || []}
            columnDefs={itemsColumnDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true
            }}
            height={400}
            pagination
            paginationPageSize={20}
            exportFileName="packing-detail-items"
          />
        </CardContent>
      </Card>

      {/* Labels */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">{t('pack_labels', 'Etiquetas de Envío')}</Typography>
            {packing.estado !== 'draft' && (
              <Button
                variant="outlined"
                startIcon={<LabelIcon />}
                onClick={() => setOpenGenerateLabel(true)}
              >
                {t('pack_generate_label', 'Generar Etiqueta')}
              </Button>
            )}
          </Box>

          {Object.keys(labelsByBulto).length === 0 ? (
            <Alert severity="info">{t('pack_no_labels', 'No hay etiquetas generadas')}</Alert>
          ) : (
            <Grid container spacing={2}>
              {Object.entries(labelsByBulto).map(([bultoNum, labels]) => (
                <Grid item xs={12} sm={6} md={4} key={bultoNum}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {t('pack_bulto', 'Bulto')} #{bultoNum}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <List dense>
                      {labels.map((label) => (
                        <ListItem key={label.id}>
                          <ListItemText
                            primary={
                              <Chip
                                label={t(`pack_label_tipo_${label.tipo}`, label.tipo)}
                                size="small"
                                color="primary"
                              />
                            }
                            secondary={`${label.formato.toUpperCase()}`}
                          />
                          <ListItemSecondaryAction>
                            <Tooltip title={t('pack_download', 'Descargar')}>
                              <IconButton
                                edge="end"
                                size="small"
                                onClick={() => window.open(label.url_label, '_blank')}
                              >
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={openAddItem} onClose={() => setOpenAddItem(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('pack_add_item', 'Agregar Item')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label={t('pack_material_code', 'Código Material')}
              value={newItem.material_codigo}
              onChange={(e) => setNewItem({ ...newItem, material_codigo: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label={t('pack_cantidad', 'Cantidad')}
              type="number"
              value={newItem.cantidad}
              onChange={(e) => setNewItem({ ...newItem, cantidad: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label={t('pack_peso_kg', 'Peso (kg)')}
              type="number"
              value={newItem.peso_item}
              onChange={(e) => setNewItem({ ...newItem, peso_item: e.target.value })}
              fullWidth
            />
            <TextField
              select
              label={t('pack_template', 'Template')}
              value={newItem.template_id}
              onChange={(e) => setNewItem({ ...newItem, template_id: e.target.value })}
              fullWidth
            >
              <MenuItem value="">{t('common_none', 'Ninguno')}</MenuItem>
              {templates.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.nombre} ({t.tipo})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('pack_bulto_num', 'Número de Bulto (opcional)')}
              type="number"
              value={newItem.bulto_numero}
              onChange={(e) => setNewItem({ ...newItem, bulto_numero: e.target.value })}
              fullWidth
            />
            <TextField
              label={t('pack_notas', 'Notas')}
              value={newItem.notas}
              onChange={(e) => setNewItem({ ...newItem, notas: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddItem(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button
            onClick={handleAddItem}
            variant="contained"
            disabled={!newItem.material_codigo || !newItem.cantidad}
          >
            {t('common_add', 'Agregar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>{t('common_cancel', 'Cancelar')}</Button>
          <Button variant="contained" color="warning" onClick={confirmDialog.onConfirm}>{t('common_confirm', 'Confirmar')}</Button>
        </DialogActions>
      </Dialog>

      {/* Generate Label Dialog */}
      <Dialog open={openGenerateLabel} onClose={() => setOpenGenerateLabel(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('pack_generate_label', 'Generar Etiqueta')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label={t('pack_bulto_num', 'Número de Bulto')}
              type="number"
              value={labelConfig.bulto_numero}
              onChange={(e) => setLabelConfig({ ...labelConfig, bulto_numero: e.target.value })}
              required
              fullWidth
            />
            <TextField
              select
              label={t('pack_label_tipo', 'Tipo de Etiqueta')}
              value={labelConfig.tipo}
              onChange={(e) => setLabelConfig({ ...labelConfig, tipo: e.target.value })}
              fullWidth
            >
              <MenuItem value="shipping">Shipping</MenuItem>
              <MenuItem value="return">Return</MenuItem>
              <MenuItem value="hazmat">Hazmat</MenuItem>
              <MenuItem value="customs">Customs</MenuItem>
            </TextField>
            <TextField
              select
              label={t('pack_label_formato', 'Formato')}
              value={labelConfig.formato}
              onChange={(e) => setLabelConfig({ ...labelConfig, formato: e.target.value })}
              fullWidth
            >
              <MenuItem value="pdf">PDF</MenuItem>
              <MenuItem value="zpl">ZPL (Zebra)</MenuItem>
              <MenuItem value="png">PNG</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenGenerateLabel(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button
            onClick={handleGenerateLabel}
            variant="contained"
            disabled={!labelConfig.bulto_numero}
          >
            {t('pack_generate', 'Generar')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PackingDetail;
