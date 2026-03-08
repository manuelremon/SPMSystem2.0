import { useState, useEffect, useRef } from 'react';
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
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import api from '../services/api';
import { useI18n } from '../context/i18n';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';

const WC_INITIAL = {
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
};

const ProductionPlanning = () => {
  const { t } = useI18n();
  const toast = useToast();
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;
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
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((n) => n + 1);

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
  const [wcForm, setWCForm] = useState(WC_INITIAL);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [kpiRes, plansRes, wcRes] = await Promise.all([
          api.get('/production/kpis'),
          api.get(`/production/plans?page=${plansPage}&page_size=20`),
          api.get('/production/work-centers'),
        ]);
        if (cancelled) return;
        if (kpiRes.data?.ok) setKpis(kpiRes.data.kpis);
        if (plansRes.data?.ok) {
          setPlans(plansRes.data.planes || []);
          setPlansTotal(plansRes.data.total || 0);
        }
        if (wcRes.data?.ok) setWorkCenters(wcRes.data.work_centers || []);
      } catch {
        if (!cancelled) toastRef.current.error(tRef.current('prod_error_load', 'Error al cargar datos de produccion'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [plansPage, reloadTick]);

  const handleCreatePlan = async () => {
    if (!newPlan.nombre) {
      toastRef.current.warning(tRef.current('prod_plan_name_required', 'El nombre del plan es requerido'));
      return;
    }

    try {
      const res = await api.post('/production/plans', newPlan);
      if (res.data?.ok) {
        setCreatePlanOpen(false);
        setNewPlan({ nombre: '', periodo_desde: '', periodo_hasta: '', notas: '' });
        navigate(`/production/${res.data.id}`);
      }
    } catch (error) {
      toastRef.current.error(error.response?.data?.mensaje || tRef.current('prod_error_create_plan', 'Error al crear plan'));
    }
  };

  const handleCreateWC = async () => {
    if (!wcForm.nombre || !wcForm.codigo) {
      toastRef.current.warning(tRef.current('prod_wc_name_code_required', 'Nombre y codigo son requeridos'));
      return;
    }

    try {
      const res = await api.post('/production/work-centers', wcForm);
      if (res.data?.ok) {
        setCreateWCOpen(false);
        setWCForm(WC_INITIAL);
        reload();
      }
    } catch (error) {
      toastRef.current.error(error.response?.data?.mensaje || tRef.current('prod_error_create_wc', 'Error al crear centro de trabajo'));
    }
  };

  const handleUpdateWC = async () => {
    if (!editWC) return;

    try {
      const res = await api.put(`/production/work-centers/${editWC.id}`, wcForm);
      if (res.data?.ok) {
        setEditWC(null);
        setWCForm(WC_INITIAL);
        reload();
      }
    } catch (error) {
      toastRef.current.error(error.response?.data?.mensaje || tRef.current('prod_error_update_wc', 'Error al actualizar centro de trabajo'));
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
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <Box sx={{ maxWidth: 1700, mx: "auto", px: 4, py: 3 }}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.primary', mb: 2 }}>
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

            <SPMAgGrid
              rowData={plans}
              columnDefs={plansColumns}
              height={500}
              pagination={true}
              paginationPageSize={20}
              loading={loading}
              exportFileName="production-plans"
            />
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

            <SPMAgGrid
              rowData={workCenters}
              columnDefs={wcColumns}
              height={500}
              pagination={true}
              paginationPageSize={20}
              exportFileName="work-centers"
            />
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
          setWCForm(WC_INITIAL);
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
    </Box>
  );
};

export default ProductionPlanning;
