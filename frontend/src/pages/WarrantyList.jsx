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
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import { Add as AddIcon, Warning as WarningIcon, CheckCircle as CheckCircleIcon, AttachMoney as MoneyIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useI18n } from '../context/i18n';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const WarrantyList = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  // Estado
  const [activeTab, setActiveTab] = useState(0);
  const [kpis, setKpis] = useState(null);
  const [garantias, setGarantias] = useState([]);
  const [reclamos, setReclamos] = useState([]);
  const [loadingGarantias, setLoadingGarantias] = useState(false);
  const [loadingReclamos, setLoadingReclamos] = useState(false);

  // Modales
  const [openGarantiaModal, setOpenGarantiaModal] = useState(false);
  const [openReclamoModal, setOpenReclamoModal] = useState(false);

  // Form Garantía
  const [formGarantia, setFormGarantia] = useState({
    material_codigo: '',
    proveedor_cuit: '',
    tipo: 'standard',
    duracion_meses: 12,
    fecha_inicio: new Date().toISOString().split('T')[0],
    condiciones: '',
    lote_id: '',
    orden_compra_id: ''
  });

  // Form Reclamo
  const [formReclamo, setFormReclamo] = useState({
    garantia_id: '',
    tipo: 'defecto',
    descripcion: '',
    cantidad_afectada: '',
    costo_estimado: ''
  });

  // Cargar KPIs
  const fetchKpis = useCallback(async () => {
    try {
      const response = await api.get('/api/warranty/kpis');
      setKpis(response.data);
    } catch (error) {
    }
  }, []);

  // Cargar garantías
  const fetchGarantias = useCallback(async () => {
    setLoadingGarantias(true);
    try {
      const response = await api.get('/api/warranty/', {
        params: { page: 1, per_page: 1000 }
      });
      setGarantias(response.data.garantias || []);
    } catch (error) {
    } finally {
      setLoadingGarantias(false);
    }
  }, []);

  // Cargar reclamos
  const fetchReclamos = useCallback(async () => {
    setLoadingReclamos(true);
    try {
      const response = await api.get('/api/warranty/claims', {
        params: { page: 1, per_page: 1000 }
      });
      setReclamos(response.data.reclamos || []);
    } catch (error) {
    } finally {
      setLoadingReclamos(false);
    }
  }, []);

  useEffect(() => {
    fetchKpis();
    fetchGarantias();
    fetchReclamos();
  }, [fetchKpis, fetchGarantias, fetchReclamos]);

  // Handlers
  const handleCreateGarantia = async () => {
    try {
      await api.post('/api/warranty/', formGarantia);
      setOpenGarantiaModal(false);
      setFormGarantia({
        material_codigo: '',
        proveedor_cuit: '',
        tipo: 'standard',
        duracion_meses: 12,
        fecha_inicio: new Date().toISOString().split('T')[0],
        condiciones: '',
        lote_id: '',
        orden_compra_id: ''
      });
      fetchGarantias();
      fetchKpis();
    } catch (error) {
      alert(t('warranty_error_create', 'Error al crear garantía'));
    }
  };

  const handleCreateReclamo = async () => {
    try {
      const payload = {
        ...formReclamo,
        garantia_id: parseInt(formReclamo.garantia_id),
        cantidad_afectada: formReclamo.cantidad_afectada ? parseFloat(formReclamo.cantidad_afectada) : null,
        costo_estimado: formReclamo.costo_estimado ? parseFloat(formReclamo.costo_estimado) : null
      };
      await api.post('/api/warranty/claims', payload);
      setOpenReclamoModal(false);
      setFormReclamo({
        garantia_id: '',
        tipo: 'defecto',
        descripcion: '',
        cantidad_afectada: '',
        costo_estimado: ''
      });
      fetchReclamos();
      fetchKpis();
    } catch (error) {
      alert(t('warranty_error_create_claim', 'Error al crear reclamo'));
    }
  };

  // AG-Grid columns - Garantías
  const garantiasColumns = [
    {
      field: 'numero',
      headerName: t('warranty_number', 'Número'),
      valueGetter: (params) => `GAR-${params.data.id}`,
      width: 120
    },
    {
      field: 'material_codigo',
      headerName: t('warranty_material', 'Material'),
      width: 150
    },
    {
      field: 'material_desc',
      headerName: t('warranty_material_desc', 'Descripción'),
      flex: 1
    },
    {
      field: 'proveedor_nombre',
      headerName: t('warranty_supplier', 'Proveedor'),
      width: 200
    },
    {
      field: 'tipo',
      headerName: t('warranty_type', 'Tipo'),
      width: 120,
      cellRenderer: (params) => {
        const colors = { standard: 'default', extended: 'primary', special: 'secondary' };
        return <Chip label={params.value} color={colors[params.value]} size="small" />;
      }
    },
    {
      field: 'duracion_meses',
      headerName: t('warranty_duration', 'Duración (meses)'),
      width: 150
    },
    {
      field: 'fecha_inicio',
      headerName: t('warranty_start', 'Inicio'),
      width: 120,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : ''
    },
    {
      field: 'fecha_fin',
      headerName: t('warranty_end', 'Fin'),
      width: 120,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : ''
    },
    {
      field: 'estado',
      headerName: t('warranty_status', 'Estado'),
      width: 120,
      cellRenderer: (params) => {
        const colors = { active: 'success', expired: 'error', voided: 'default' };
        return <Chip label={params.value} color={colors[params.value]} size="small" />;
      }
    },
    {
      field: 'reclamos_count',
      headerName: t('warranty_claims_count', 'Reclamos'),
      width: 100
    }
  ];

  // AG-Grid columns - Reclamos
  const reclamosColumns = [
    {
      field: 'numero_reclamo',
      headerName: t('warranty_claim_number', 'Número'),
      width: 150,
      cellRenderer: (params) => (
        <Button
          size="small"
          onClick={() => navigate(`/warranty/claims/${params.data.id}`)}
          sx={{ textTransform: 'none' }}
        >
          {params.value}
        </Button>
      )
    },
    {
      field: 'material_desc',
      headerName: t('warranty_material', 'Material'),
      flex: 1
    },
    {
      field: 'proveedor_nombre',
      headerName: t('warranty_supplier', 'Proveedor'),
      width: 200
    },
    {
      field: 'tipo',
      headerName: t('warranty_claim_type', 'Tipo'),
      width: 130,
      cellRenderer: (params) => {
        const colors = { defecto: 'error', falta: 'warning', dano: 'error', incumplimiento: 'default' };
        const labels = { defecto: 'Defecto', falta: 'Falta', dano: 'Daño', incumplimiento: 'Incumplimiento' };
        return <Chip label={labels[params.value]} color={colors[params.value]} size="small" />;
      }
    },
    {
      field: 'descripcion',
      headerName: t('warranty_description', 'Descripción'),
      flex: 1
    },
    {
      field: 'costo_estimado',
      headerName: t('warranty_estimated_cost', 'Costo Est.'),
      width: 120,
      valueFormatter: (params) => params.value ? `$${params.value.toLocaleString()}` : '-'
    },
    {
      field: 'estado',
      headerName: t('warranty_claim_status', 'Estado'),
      width: 140,
      cellRenderer: (params) => {
        const colors = {
          draft: 'default',
          submitted: 'info',
          under_review: 'warning',
          approved: 'success',
          rejected: 'error',
          resolved: 'success'
        };
        return <Chip label={params.value} color={colors[params.value]} size="small" />;
      }
    },
    {
      field: 'monto_recuperado',
      headerName: t('warranty_recovered', 'Recuperado'),
      width: 120,
      valueFormatter: (params) => params.value ? `$${params.value.toLocaleString()}` : '-'
    },
    {
      field: 'created_at',
      headerName: t('warranty_created', 'Creado'),
      width: 120,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleDateString() : ''
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('warranty_title', 'Garantías y Reclamos')}
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setOpenGarantiaModal(true)}
            sx={{ mr: 2 }}
          >
            {t('warranty_new', 'Nueva Garantía')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenReclamoModal(true)}
          >
            {t('warranty_new_claim', 'Nuevo Reclamo')}
          </Button>
        </Box>
      </Box>

      {/* KPIs */}
      {kpis && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon color="warning" />
                  <Typography variant="h6" color="text.secondary">
                    {t('warranty_kpi_open', 'Reclamos Abiertos')}
                  </Typography>
                </Box>
                <Typography variant="h4">{kpis.reclamos_abiertos}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MoneyIcon color="success" />
                  <Typography variant="h6" color="text.secondary">
                    {t('warranty_kpi_recovered', 'Monto Recuperado (30d)')}
                  </Typography>
                </Box>
                <Typography variant="h4">${kpis.monto_recuperado.toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon color="primary" />
                  <Typography variant="h6" color="text.secondary">
                    {t('warranty_kpi_approval', 'Tasa Aprobación (90d)')}
                  </Typography>
                </Box>
                <Typography variant="h4">{kpis.tasa_aprobacion}%</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ScheduleIcon color="error" />
                  <Typography variant="h6" color="text.secondary">
                    {t('warranty_kpi_expiring', 'Por Vencer (30d)')}
                  </Typography>
                </Box>
                <Typography variant="h4">{kpis.garantias_por_vencer}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)}>
          <Tab label={t('warranty_tab_warranties', 'Garantías')} />
          <Tab label={t('warranty_tab_claims', 'Reclamos')} />
        </Tabs>
      </Box>

      {/* Content */}
      {activeTab === 0 && (
        <Box className="ag-theme-alpine" sx={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={garantias}
            columnDefs={garantiasColumns}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true
            }}
            pagination={true}
            paginationPageSize={50}
            loading={loadingGarantias}
          />
        </Box>
      )}

      {activeTab === 1 && (
        <Box className="ag-theme-alpine" sx={{ height: 600, width: '100%' }}>
          <AgGridReact
            rowData={reclamos}
            columnDefs={reclamosColumns}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true
            }}
            pagination={true}
            paginationPageSize={50}
            loading={loadingReclamos}
          />
        </Box>
      )}

      {/* Modal Crear Garantía */}
      <Dialog open={openGarantiaModal} onClose={() => setOpenGarantiaModal(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('warranty_create_title', 'Nueva Garantía')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('warranty_material_code', 'Código Material')}
                value={formGarantia.material_codigo}
                onChange={(e) => setFormGarantia({ ...formGarantia, material_codigo: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('warranty_supplier_cuit', 'CUIT Proveedor')}
                value={formGarantia.proveedor_cuit}
                onChange={(e) => setFormGarantia({ ...formGarantia, proveedor_cuit: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>{t('warranty_type', 'Tipo')}</InputLabel>
                <Select
                  value={formGarantia.tipo}
                  onChange={(e) => setFormGarantia({ ...formGarantia, tipo: e.target.value })}
                  label={t('warranty_type', 'Tipo')}
                >
                  <MenuItem value="standard">{t('warranty_type_standard', 'Standard')}</MenuItem>
                  <MenuItem value="extended">{t('warranty_type_extended', 'Extended')}</MenuItem>
                  <MenuItem value="special">{t('warranty_type_special', 'Special')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label={t('warranty_duration_months', 'Duración (meses)')}
                value={formGarantia.duracion_meses}
                onChange={(e) => setFormGarantia({ ...formGarantia, duracion_meses: parseInt(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label={t('warranty_start_date', 'Fecha Inicio')}
                value={formGarantia.fecha_inicio}
                onChange={(e) => setFormGarantia({ ...formGarantia, fecha_inicio: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('warranty_po_id', 'ID Orden de Compra')}
                value={formGarantia.orden_compra_id}
                onChange={(e) => setFormGarantia({ ...formGarantia, orden_compra_id: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('warranty_conditions', 'Condiciones')}
                value={formGarantia.condiciones}
                onChange={(e) => setFormGarantia({ ...formGarantia, condiciones: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenGarantiaModal(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleCreateGarantia} variant="contained">
            {t('common_create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Crear Reclamo */}
      <Dialog open={openReclamoModal} onClose={() => setOpenReclamoModal(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('warranty_create_claim_title', 'Nuevo Reclamo')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>{t('warranty_select_warranty', 'Garantía')}</InputLabel>
                <Select
                  value={formReclamo.garantia_id}
                  onChange={(e) => setFormReclamo({ ...formReclamo, garantia_id: e.target.value })}
                  label={t('warranty_select_warranty', 'Garantía')}
                >
                  {garantias.filter(g => g.estado === 'active').map((g) => (
                    <MenuItem key={g.id} value={g.id}>
                      GAR-{g.id} - {g.material_desc} ({g.proveedor_nombre})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>{t('warranty_claim_type', 'Tipo Reclamo')}</InputLabel>
                <Select
                  value={formReclamo.tipo}
                  onChange={(e) => setFormReclamo({ ...formReclamo, tipo: e.target.value })}
                  label={t('warranty_claim_type', 'Tipo Reclamo')}
                >
                  <MenuItem value="defecto">{t('warranty_claim_defect', 'Defecto')}</MenuItem>
                  <MenuItem value="falta">{t('warranty_claim_missing', 'Falta')}</MenuItem>
                  <MenuItem value="dano">{t('warranty_claim_damage', 'Daño')}</MenuItem>
                  <MenuItem value="incumplimiento">{t('warranty_claim_breach', 'Incumplimiento')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label={t('warranty_affected_qty', 'Cantidad Afectada')}
                value={formReclamo.cantidad_afectada}
                onChange={(e) => setFormReclamo({ ...formReclamo, cantidad_afectada: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label={t('warranty_estimated_cost', 'Costo Estimado')}
                value={formReclamo.costo_estimado}
                onChange={(e) => setFormReclamo({ ...formReclamo, costo_estimado: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label={t('warranty_description', 'Descripción')}
                value={formReclamo.descripcion}
                onChange={(e) => setFormReclamo({ ...formReclamo, descripcion: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReclamoModal(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleCreateReclamo} variant="contained">
            {t('common_create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WarrantyList;
