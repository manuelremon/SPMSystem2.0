import { useState, useEffect, useCallback } from 'react';
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
  Tabs,
  Tab,
  Alert
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-material.css';
import api from '../services/api';
import { useI18n } from '../context/i18n';
import { useNavigate } from 'react-router-dom';

const ProductionPlanning = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState({
    planes_activos: 0,
    items_retrasados: 0,
    utilizacion_promedio: 0,
    work_centers_activos: 0,
    items_completados_hoy: 0
  });
  const [activeTab, setActiveTab] = useState(0);

  // Plans state
  const [plans, setPlans] = useState([]);
  const [plansTotal, setPlansTotal] = useState(0);
  const [plansPage, setPlansPage] = useState(1);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [newPlan, setNewPlan] = useState({
    nombre: '',
    periodo_desde: '',
    periodo_hasta: '',
    notas: ''
  });

  // Work centers state
  const [workCenters, setWorkCenters] = useState([]);
  const [createWCOpen, setCreateWCOpen] = useState(false);
  const [editWC, setEditWC] = useState(null);
  const [wcForm, setWCForm] = useState({
    nombre: '',
    codigo: '',
    tipo: 'assembly',
    capacidad_diaria: 0,
    unidad: 'horas',
    turnos: 1,
    eficiencia_pct: 85,
    costo_hora: 0,
    estado: 'active',
    ubicacion: ''
  });

  useEffect(() => {
    loadKPIs();
    loadPlans();
    loadWorkCenters();
  }, []);

  const loadKPIs = async () => {
    try {
      const res = await api.get('/api/production/kpis');
      if (res.data.ok) {
        setKpis(res.data.kpis);
      }
    } catch (error) {
    }
  };

  const loadPlans = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/production/plans?page=${page}&page_size=20`);
      if (res.data.ok) {
        setPlans(res.data.planes);
        setPlansTotal(res.data.total);
        setPlansPage(page);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadWorkCenters = async () => {
    try {
      const res = await api.get('/api/production/work-centers');
      if (res.data.ok) {
        setWorkCenters(res.data.work_centers);
      }
    } catch (error) {
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlan.nombre) {
      alert(t('prod_plan_name_required', 'Plan name is required'));
      return;
    }

    try {
      const res = await api.post('/api/production/plans', newPlan);
      if (res.data.ok) {
        setCreatePlanOpen(false);
        setNewPlan({ nombre: '', periodo_desde: '', periodo_hasta: '', notas: '' });
        loadPlans();
        loadKPIs();
        // Navigate to detail page
        navigate(`/production/${res.data.id}`);
      }
    } catch (error) {
      alert(t('common_error', 'Error: ') + (error.response?.data?.mensaje || error.message));
    }
  };

  const handleCreateWC = async () => {
    if (!wcForm.nombre || !wcForm.codigo) {
      alert(t('prod_wc_name_code_required', 'Name and code are required'));
      return;
    }

    try {
      const res = await api.post('/api/production/work-centers', wcForm);
      if (res.data.ok) {
        setCreateWCOpen(false);
        setWCForm({
          nombre: '',
          codigo: '',
          tipo: 'assembly',
          capacidad_diaria: 0,
          unidad: 'horas',
          turnos: 1,
          eficiencia_pct: 85,
          costo_hora: 0,
          estado: 'active',
          ubicacion: ''
        });
        loadWorkCenters();
        loadKPIs();
      }
    } catch (error) {
      alert(t('common_error', 'Error: ') + (error.response?.data?.mensaje || error.message));
    }
  };

  const handleUpdateWC = async () => {
    if (!editWC) return;

    try {
      const res = await api.put(`/api/production/work-centers/${editWC.id}`, wcForm);
      if (res.data.ok) {
        setEditWC(null);
        setWCForm({
          nombre: '',
          codigo: '',
          tipo: 'assembly',
          capacidad_diaria: 0,
          unidad: 'horas',
          turnos: 1,
          eficiencia_pct: 85,
          costo_hora: 0,
          estado: 'active',
          ubicacion: ''
        });
        loadWorkCenters();
      }
    } catch (error) {
      alert(t('common_error', 'Error: ') + (error.response?.data?.mensaje || error.message));
    }
  };

  const openEditWC = (wc) => {
    setEditWC(wc);
    setWCForm({ ...wc });
  };

  // Plans grid columns
  const plansColumns = [
    { field: 'id', headerName: t('common_id', 'ID'), width: 80 },
    { field: 'nombre', headerName: t('prod_plan_name', 'Plan Name'), flex: 1 },
    { field: 'periodo_desde', headerName: t('prod_period_from', 'From'), width: 120 },
    { field: 'periodo_hasta', headerName: t('prod_period_to', 'To'), width: 120 },
    {
      field: 'estado',
      headerName: t('common_status', 'Status'),
      width: 130,
      cellRenderer: (params) => {
        const estadoColors = {
          draft: 'default',
          publicado: 'info',
          en_ejecucion: 'primary',
          completado: 'success',
          cancelado: 'error'
        };
        return <Chip label={params.value} color={estadoColors[params.value] || 'default'} size="small" />;
      }
    },
    { field: 'responsable_nombre', headerName: t('prod_responsible', 'Responsible'), width: 150 },
    { field: 'total_items', headerName: t('prod_total_items', 'Items'), width: 90 },
    {
      field: 'completados_pct',
      headerName: t('prod_completed_pct', 'Complete %'),
      width: 120,
      valueGetter: (params) => {
        const total = params.data.total_items || 0;
        const completados = params.data.items_completados || 0;
        return total > 0 ? Math.round((completados / total) * 100) : 0;
      },
      cellRenderer: (params) => `${params.value}%`
    },
    {
      field: 'acciones',
      headerName: t('common_actions', 'Actions'),
      width: 120,
      cellRenderer: (params) => (
        <Button
          size="small"
          variant="outlined"
          onClick={() => navigate(`/production/${params.data.id}`)}
        >
          {t('common_view', 'View')}
        </Button>
      )
    }
  ];

  // Work centers grid columns
  const wcColumns = [
    { field: 'id', headerName: t('common_id', 'ID'), width: 80 },
    { field: 'codigo', headerName: t('prod_wc_code', 'Code'), width: 120 },
    { field: 'nombre', headerName: t('prod_wc_name', 'Name'), flex: 1 },
    {
      field: 'tipo',
      headerName: t('prod_wc_type', 'Type'),
      width: 120,
      cellRenderer: (params) => {
        const tipoLabels = {
          assembly: t('prod_type_assembly', 'Assembly'),
          machining: t('prod_type_machining', 'Machining'),
          packaging: t('prod_type_packaging', 'Packaging'),
          testing: t('prod_type_testing', 'Testing')
        };
        return tipoLabels[params.value] || params.value;
      }
    },
    { field: 'capacidad_diaria', headerName: t('prod_daily_capacity', 'Daily Cap.'), width: 110 },
    { field: 'unidad', headerName: t('prod_unit', 'Unit'), width: 90 },
    { field: 'turnos', headerName: t('prod_shifts', 'Shifts'), width: 90 },
    {
      field: 'eficiencia_pct',
      headerName: t('prod_efficiency', 'Efficiency'),
      width: 110,
      cellRenderer: (params) => `${params.value}%`
    },
    {
      field: 'estado',
      headerName: t('common_status', 'Status'),
      width: 120,
      cellRenderer: (params) => {
        const estadoColors = {
          active: 'success',
          maintenance: 'warning',
          inactive: 'default'
        };
        return <Chip label={params.value} color={estadoColors[params.value] || 'default'} size="small" />;
      }
    },
    {
      field: 'acciones',
      headerName: t('common_actions', 'Actions'),
      width: 100,
      cellRenderer: (params) => (
        <Button size="small" variant="outlined" onClick={() => openEditWC(params.data)}>
          {t('common_edit', 'Edit')}
        </Button>
      )
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('prod_planning_title', 'Production Planning (MPS)')}
      </Typography>

      {/* KPIs Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {t('prod_active_plans', 'Active Plans')}
              </Typography>
              <Typography variant="h5">{kpis.planes_activos}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {t('prod_delayed_items', 'Delayed Items')}
              </Typography>
              <Typography variant="h5" color="error">
                {kpis.items_retrasados}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {t('prod_avg_utilization', 'Avg Utilization')}
              </Typography>
              <Typography variant="h5">{kpis.utilizacion_promedio}%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {t('prod_active_wc', 'Active Work Centers')}
              </Typography>
              <Typography variant="h5">{kpis.work_centers_activos}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {t('prod_completed_today', 'Completed Today')}
              </Typography>
              <Typography variant="h5" color="success.main">
                {kpis.items_completados_hoy}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label={t('prod_plans_tab', 'Production Plans')} />
          <Tab label={t('prod_wc_tab', 'Work Centers')} />
        </Tabs>
      </Box>

      {/* Plans Tab */}
      {activeTab === 0 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">{t('prod_plans_list', 'Production Plans')}</Typography>
              <Button variant="contained" onClick={() => setCreatePlanOpen(true)}>
                {t('prod_create_plan', 'Create Plan')}
              </Button>
            </Box>

            <div className="ag-theme-material" style={{ height: 500, width: '100%' }}>
              <AgGridReact
                rowData={plans}
                columnDefs={plansColumns}
                pagination={true}
                paginationPageSize={20}
                loading={loading}
                domLayout="normal"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Work Centers Tab */}
      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">{t('prod_wc_list', 'Work Centers')}</Typography>
              <Button variant="contained" onClick={() => setCreateWCOpen(true)}>
                {t('prod_create_wc', 'Create Work Center')}
              </Button>
            </Box>

            <div className="ag-theme-material" style={{ height: 500, width: '100%' }}>
              <AgGridReact
                rowData={workCenters}
                columnDefs={wcColumns}
                pagination={true}
                paginationPageSize={20}
                domLayout="normal"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Plan Dialog */}
      <Dialog open={createPlanOpen} onClose={() => setCreatePlanOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('prod_create_plan', 'Create Production Plan')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('prod_plan_name', 'Plan Name')}
              value={newPlan.nombre}
              onChange={(e) => setNewPlan({ ...newPlan, nombre: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label={t('prod_period_from', 'Period From')}
              type="date"
              value={newPlan.periodo_desde}
              onChange={(e) => setNewPlan({ ...newPlan, periodo_desde: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('prod_period_to', 'Period To')}
              type="date"
              value={newPlan.periodo_hasta}
              onChange={(e) => setNewPlan({ ...newPlan, periodo_hasta: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('prod_notes', 'Notes')}
              value={newPlan.notas}
              onChange={(e) => setNewPlan({ ...newPlan, notas: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreatePlanOpen(false)}>{t('common_cancel', 'Cancel')}</Button>
          <Button onClick={handleCreatePlan} variant="contained">
            {t('common_create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Work Center Dialog */}
      <Dialog
        open={createWCOpen || editWC !== null}
        onClose={() => {
          setCreateWCOpen(false);
          setEditWC(null);
          setWCForm({
            nombre: '',
            codigo: '',
            tipo: 'assembly',
            capacidad_diaria: 0,
            unidad: 'horas',
            turnos: 1,
            eficiencia_pct: 85,
            costo_hora: 0,
            estado: 'active',
            ubicacion: ''
          });
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editWC ? t('prod_edit_wc', 'Edit Work Center') : t('prod_create_wc', 'Create Work Center')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('prod_wc_name', 'Name')}
              value={wcForm.nombre}
              onChange={(e) => setWCForm({ ...wcForm, nombre: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label={t('prod_wc_code', 'Code')}
              value={wcForm.codigo}
              onChange={(e) => setWCForm({ ...wcForm, codigo: e.target.value })}
              fullWidth
              required
              disabled={!!editWC}
            />
            <TextField
              select
              label={t('prod_wc_type', 'Type')}
              value={wcForm.tipo}
              onChange={(e) => setWCForm({ ...wcForm, tipo: e.target.value })}
              fullWidth
            >
              <MenuItem value="assembly">{t('prod_type_assembly', 'Assembly')}</MenuItem>
              <MenuItem value="machining">{t('prod_type_machining', 'Machining')}</MenuItem>
              <MenuItem value="packaging">{t('prod_type_packaging', 'Packaging')}</MenuItem>
              <MenuItem value="testing">{t('prod_type_testing', 'Testing')}</MenuItem>
            </TextField>
            <TextField
              label={t('prod_daily_capacity', 'Daily Capacity')}
              type="number"
              value={wcForm.capacidad_diaria}
              onChange={(e) => setWCForm({ ...wcForm, capacidad_diaria: parseFloat(e.target.value) })}
              fullWidth
            />
            <TextField
              select
              label={t('prod_unit', 'Unit')}
              value={wcForm.unidad}
              onChange={(e) => setWCForm({ ...wcForm, unidad: e.target.value })}
              fullWidth
            >
              <MenuItem value="horas">{t('prod_unit_hours', 'Hours')}</MenuItem>
              <MenuItem value="unidades">{t('prod_unit_units', 'Units')}</MenuItem>
            </TextField>
            <TextField
              label={t('prod_shifts', 'Number of Shifts')}
              type="number"
              value={wcForm.turnos}
              onChange={(e) => setWCForm({ ...wcForm, turnos: parseInt(e.target.value) })}
              fullWidth
            />
            <TextField
              label={t('prod_efficiency', 'Efficiency %')}
              type="number"
              value={wcForm.eficiencia_pct}
              onChange={(e) => setWCForm({ ...wcForm, eficiencia_pct: parseFloat(e.target.value) })}
              fullWidth
            />
            <TextField
              label={t('prod_cost_hour', 'Cost per Hour')}
              type="number"
              value={wcForm.costo_hora}
              onChange={(e) => setWCForm({ ...wcForm, costo_hora: parseFloat(e.target.value) })}
              fullWidth
            />
            <TextField
              select
              label={t('common_status', 'Status')}
              value={wcForm.estado}
              onChange={(e) => setWCForm({ ...wcForm, estado: e.target.value })}
              fullWidth
            >
              <MenuItem value="active">{t('prod_status_active', 'Active')}</MenuItem>
              <MenuItem value="maintenance">{t('prod_status_maintenance', 'Maintenance')}</MenuItem>
              <MenuItem value="inactive">{t('prod_status_inactive', 'Inactive')}</MenuItem>
            </TextField>
            <TextField
              label={t('prod_location', 'Location')}
              value={wcForm.ubicacion}
              onChange={(e) => setWCForm({ ...wcForm, ubicacion: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCreateWCOpen(false);
              setEditWC(null);
            }}
          >
            {t('common_cancel', 'Cancel')}
          </Button>
          <Button onClick={editWC ? handleUpdateWC : handleCreateWC} variant="contained">
            {editWC ? t('common_save', 'Save') : t('common_create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductionPlanning;
