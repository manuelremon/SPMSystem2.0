import { useState, useEffect } from 'react';
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
  Alert,
  Paper,
  Divider
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-material.css';
import api from '../services/api';
import { useI18n } from '../context/i18n';
import { useParams, useNavigate } from 'react-router-dom';

const ProductionDetail = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [items, setItems] = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [validationResult, setValidationResult] = useState(null);

  // Add item dialog
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    material_codigo: '',
    work_center_id: '',
    fecha_programada: '',
    cantidad_planificada: 0,
    prioridad: 'media',
    notas: ''
  });

  // Report production dialog
  const [reportOpen, setReportOpen] = useState(false);
  const [reportItem, setReportItem] = useState(null);
  const [reportData, setReportData] = useState({
    cantidad_producida: 0,
    notas: ''
  });

  useEffect(() => {
    loadPlanDetail();
    loadWorkCenters();
  }, [id]);

  const loadPlanDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/production/plans/${id}`);
      if (res.data.ok) {
        setPlan(res.data.plan);
        setItems(res.data.plan.items || []);
      }
    } catch (error) {
      console.error('Error loading plan:', error);
      alert(t('common_error', 'Error: ') + (error.response?.data?.mensaje || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadWorkCenters = async () => {
    try {
      const res = await api.get('/api/production/work-centers?estado=active');
      if (res.data.ok) {
        setWorkCenters(res.data.work_centers);
      }
    } catch (error) {
      console.error('Error loading work centers:', error);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.material_codigo || !newItem.fecha_programada || newItem.cantidad_planificada <= 0) {
      alert(t('prod_item_validation', 'Material, date and quantity are required'));
      return;
    }

    try {
      const res = await api.post(`/api/production/plans/${id}/items`, newItem);
      if (res.data.ok) {
        setAddItemOpen(false);
        setNewItem({
          material_codigo: '',
          work_center_id: '',
          fecha_programada: '',
          cantidad_planificada: 0,
          prioridad: 'media',
          notas: ''
        });
        loadPlanDetail();
      }
    } catch (error) {
      console.error('Error adding item:', error);
      alert(t('common_error', 'Error: ') + (error.response?.data?.mensaje || error.message));
    }
  };

  const openReportDialog = (item) => {
    setReportItem(item);
    setReportData({
      cantidad_producida: 0,
      notas: ''
    });
    setReportOpen(true);
  };

  const handleReportProduction = async () => {
    if (!reportItem || reportData.cantidad_producida <= 0) {
      alert(t('prod_quantity_required', 'Quantity must be greater than 0'));
      return;
    }

    try {
      const res = await api.put(`/api/production/plans/${id}/items/${reportItem.id}/report`, reportData);
      if (res.data.ok) {
        setReportOpen(false);
        setReportItem(null);
        setReportData({ cantidad_producida: 0, notas: '' });
        loadPlanDetail();
      }
    } catch (error) {
      console.error('Error reporting production:', error);
      alert(t('common_error', 'Error: ') + (error.response?.data?.mensaje || error.message));
    }
  };

  const handleValidateCapacity = async () => {
    try {
      const res = await api.post(`/api/production/plans/${id}/validate`);
      if (res.data.ok) {
        setValidationResult(res.data);
      }
    } catch (error) {
      console.error('Error validating capacity:', error);
      alert(t('common_error', 'Error: ') + (error.response?.data?.mensaje || error.message));
    }
  };

  const handlePublish = async () => {
    // Validate first
    await handleValidateCapacity();

    const confirmMsg = t(
      'prod_confirm_publish',
      'Are you sure you want to publish this plan? This will commit capacity.'
    );
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.put(`/api/production/plans/${id}/publish`);
      if (res.data.ok) {
        alert(t('prod_plan_published', 'Plan published successfully'));
        loadPlanDetail();
      }
    } catch (error) {
      console.error('Error publishing plan:', error);
      alert(t('common_error', 'Error: ') + (error.response?.data?.mensaje || error.message));
    }
  };

  const handleComplete = async () => {
    const confirmMsg = t('prod_confirm_complete', 'Mark this plan as completed?');
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.put(`/api/production/plans/${id}/complete`);
      if (res.data.ok) {
        alert(t('prod_plan_completed', 'Plan completed successfully'));
        loadPlanDetail();
      }
    } catch (error) {
      console.error('Error completing plan:', error);
      alert(t('common_error', 'Error: ') + (error.response?.data?.mensaje || error.message));
    }
  };

  // Items grid columns
  const itemsColumns = [
    { field: 'id', headerName: t('common_id', 'ID'), width: 70 },
    { field: 'material_codigo', headerName: t('prod_material', 'Material'), width: 150 },
    { field: 'work_center_codigo', headerName: t('prod_work_center', 'Work Center'), width: 130 },
    { field: 'fecha_programada', headerName: t('prod_scheduled_date', 'Scheduled'), width: 120 },
    {
      field: 'cantidad_planificada',
      headerName: t('prod_planned_qty', 'Planned'),
      width: 110,
      cellRenderer: (params) => params.value.toFixed(2)
    },
    {
      field: 'cantidad_producida',
      headerName: t('prod_produced_qty', 'Produced'),
      width: 110,
      cellRenderer: (params) => params.value.toFixed(2)
    },
    {
      field: 'progress',
      headerName: t('prod_progress', 'Progress'),
      width: 100,
      valueGetter: (params) => {
        const planificada = params.data.cantidad_planificada || 0;
        const producida = params.data.cantidad_producida || 0;
        return planificada > 0 ? Math.round((producida / planificada) * 100) : 0;
      },
      cellRenderer: (params) => `${params.value}%`
    },
    {
      field: 'prioridad',
      headerName: t('common_priority', 'Priority'),
      width: 100,
      cellRenderer: (params) => {
        const prioridadColors = {
          baja: 'default',
          media: 'info',
          alta: 'error'
        };
        return <Chip label={params.value} color={prioridadColors[params.value] || 'default'} size="small" />;
      }
    },
    {
      field: 'estado',
      headerName: t('common_status', 'Status'),
      width: 130,
      cellRenderer: (params) => {
        const estadoColors = {
          pendiente: 'default',
          en_proceso: 'primary',
          completado: 'success',
          retrasado: 'error'
        };
        return <Chip label={params.value} color={estadoColors[params.value] || 'default'} size="small" />;
      }
    },
    {
      field: 'acciones',
      headerName: t('common_actions', 'Actions'),
      width: 150,
      cellRenderer: (params) => (
        <Button
          size="small"
          variant="outlined"
          onClick={() => openReportDialog(params.data)}
          disabled={params.data.estado === 'completado'}
        >
          {t('prod_report', 'Report')}
        </Button>
      )
    }
  ];

  if (loading || !plan) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('common_loading', 'Loading...')}</Typography>
      </Box>
    );
  }

  const estadoColors = {
    draft: 'default',
    publicado: 'info',
    en_ejecucion: 'primary',
    completado: 'success',
    cancelado: 'error'
  };

  const canEdit = plan.estado === 'draft';
  const canPublish = plan.estado === 'draft' && items.length > 0;
  const canComplete = plan.estado === 'publicado' || plan.estado === 'en_ejecucion';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{plan.nombre}</Typography>
        <Button onClick={() => navigate('/production')}>{t('common_back', 'Back')}</Button>
      </Box>

      {/* Plan Header Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                {t('common_status', 'Status')}
              </Typography>
              <Chip label={plan.estado} color={estadoColors[plan.estado] || 'default'} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                {t('prod_period', 'Period')}
              </Typography>
              <Typography>
                {plan.periodo_desde || '-'} → {plan.periodo_hasta || '-'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                {t('prod_responsible', 'Responsible')}
              </Typography>
              <Typography>{plan.responsable_nombre || '-'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary">
                {t('prod_total_items', 'Total Items')}
              </Typography>
              <Typography>{items.length}</Typography>
            </Grid>
            {plan.notas && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  {t('prod_notes', 'Notes')}
                </Typography>
                <Typography>{plan.notas}</Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Validation Alert */}
      {validationResult && (
        <Alert severity={validationResult.valido ? 'success' : 'warning'} sx={{ mb: 2 }}>
          {validationResult.valido ? (
            <Typography>
              {t('prod_capacity_valid', 'Capacity validation passed')} - Utilization:{' '}
              {validationResult.utilizacion_pct.toFixed(1)}%
            </Typography>
          ) : (
            <Box>
              <Typography>
                {t('prod_capacity_exceeded', 'Capacity exceeded in')} {validationResult.total_excesos}{' '}
                {t('prod_work_centers', 'work center(s)')}
              </Typography>
              {validationResult.excesos.slice(0, 3).map((exceso, idx) => (
                <Typography key={idx} variant="body2">
                  • {exceso.work_center_nombre} ({exceso.fecha}): {exceso.exceso.toFixed(2)}{' '}
                  {t('prod_units_over', 'units over')} ({exceso.exceso_pct.toFixed(1)}%)
                </Typography>
              ))}
            </Box>
          )}
        </Alert>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {canEdit && (
          <Button variant="contained" onClick={() => setAddItemOpen(true)}>
            {t('prod_add_item', 'Add Item')}
          </Button>
        )}
        <Button variant="outlined" onClick={handleValidateCapacity}>
          {t('prod_validate_capacity', 'Validate Capacity')}
        </Button>
        {canPublish && (
          <Button variant="contained" color="primary" onClick={handlePublish}>
            {t('prod_publish_plan', 'Publish Plan')}
          </Button>
        )}
        {canComplete && (
          <Button variant="contained" color="success" onClick={handleComplete}>
            {t('prod_complete_plan', 'Complete Plan')}
          </Button>
        )}
      </Box>

      {/* Items Grid */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('prod_plan_items', 'Plan Items')}
          </Typography>
          <div className="ag-theme-material" style={{ height: 500, width: '100%' }}>
            <AgGridReact
              rowData={items}
              columnDefs={itemsColumns}
              pagination={true}
              paginationPageSize={20}
              domLayout="normal"
            />
          </div>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={addItemOpen} onClose={() => setAddItemOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('prod_add_item', 'Add Production Item')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('prod_material_code', 'Material Code')}
              value={newItem.material_codigo}
              onChange={(e) => setNewItem({ ...newItem, material_codigo: e.target.value })}
              fullWidth
              required
            />
            <TextField
              select
              label={t('prod_work_center', 'Work Center')}
              value={newItem.work_center_id}
              onChange={(e) => setNewItem({ ...newItem, work_center_id: e.target.value })}
              fullWidth
            >
              <MenuItem value="">{t('common_none', 'None')}</MenuItem>
              {workCenters.map((wc) => (
                <MenuItem key={wc.id} value={wc.id}>
                  {wc.codigo} - {wc.nombre}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('prod_scheduled_date', 'Scheduled Date')}
              type="date"
              value={newItem.fecha_programada}
              onChange={(e) => setNewItem({ ...newItem, fecha_programada: e.target.value })}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('prod_planned_qty', 'Planned Quantity')}
              type="number"
              value={newItem.cantidad_planificada}
              onChange={(e) => setNewItem({ ...newItem, cantidad_planificada: parseFloat(e.target.value) })}
              fullWidth
              required
            />
            <TextField
              select
              label={t('common_priority', 'Priority')}
              value={newItem.prioridad}
              onChange={(e) => setNewItem({ ...newItem, prioridad: e.target.value })}
              fullWidth
            >
              <MenuItem value="baja">{t('common_low', 'Low')}</MenuItem>
              <MenuItem value="media">{t('common_medium', 'Medium')}</MenuItem>
              <MenuItem value="alta">{t('common_high', 'High')}</MenuItem>
            </TextField>
            <TextField
              label={t('prod_notes', 'Notes')}
              value={newItem.notas}
              onChange={(e) => setNewItem({ ...newItem, notas: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddItemOpen(false)}>{t('common_cancel', 'Cancel')}</Button>
          <Button onClick={handleAddItem} variant="contained">
            {t('common_add', 'Add')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report Production Dialog */}
      <Dialog open={reportOpen} onClose={() => setReportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('prod_report_production', 'Report Production')}</DialogTitle>
        <DialogContent>
          {reportItem && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                <Typography variant="body2">
                  <strong>{t('prod_material', 'Material')}:</strong> {reportItem.material_codigo}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('prod_planned_qty', 'Planned')}:</strong> {reportItem.cantidad_planificada}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('prod_produced_qty', 'Produced')}:</strong> {reportItem.cantidad_producida}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('prod_remaining', 'Remaining')}:</strong>{' '}
                  {(reportItem.cantidad_planificada - reportItem.cantidad_producida).toFixed(2)}
                </Typography>
              </Paper>
              <TextField
                label={t('prod_quantity_to_report', 'Quantity to Report')}
                type="number"
                value={reportData.cantidad_producida}
                onChange={(e) =>
                  setReportData({ ...reportData, cantidad_producida: parseFloat(e.target.value) })
                }
                fullWidth
                required
              />
              <TextField
                label={t('prod_notes', 'Notes')}
                value={reportData.notas}
                onChange={(e) => setReportData({ ...reportData, notas: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportOpen(false)}>{t('common_cancel', 'Cancel')}</Button>
          <Button onClick={handleReportProduction} variant="contained">
            {t('prod_report', 'Report')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductionDetail;
