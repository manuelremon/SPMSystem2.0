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
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  LocalShipping as ShippingIcon,
  Inventory as PackageIcon,
  Label as LabelIcon
} from '@mui/icons-material';
import { SPMAgGrid } from '../components/ui/SPMAgGrid';
import api from '../services/api';
import { useI18n } from '../context/i18n';
import { useNavigate } from 'react-router-dom';

const PackingLists = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [kpis, setKpis] = useState({
    packing_lists_activos: 0,
    bultos_mes: 0,
    etiquetas_generadas: 0,
    peso_despachado_mes_kg: 0
  });

  const [packingLists, setPackingLists] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [tabValue, setTabValue] = useState(0);

  // Create modals
  const [openCreatePacking, setOpenCreatePacking] = useState(false);
  const [openCreateTemplate, setOpenCreateTemplate] = useState(false);

  // Form states
  const [newPacking, setNewPacking] = useState({
    orden_compra_id: '',
    envio_id: '',
    notas: ''
  });

  const [newTemplate, setNewTemplate] = useState({
    nombre: '',
    tipo: 'caja',
    largo: '',
    ancho: '',
    alto: '',
    peso_max: '',
    unidad_medida: 'cm',
    material_empaque: '',
    costo_unitario: 0
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpisRes, packingsRes, templatesRes] = await Promise.all([
        api.get('/packaging/kpis'),
        api.get('/packaging/packing-lists', {
          params: estadoFilter !== 'all' ? { estado: estadoFilter } : {}
        }),
        api.get('/packaging/templates')
      ]);

      if (kpisRes.data.ok) setKpis(kpisRes.data.kpis);
      if (packingsRes.data.ok) setPackingLists(packingsRes.data.packing_lists);
      if (templatesRes.data.ok) setTemplates(templatesRes.data.templates);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [estadoFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreatePacking = async () => {
    try {
      const res = await api.post('/packaging/packing-lists', newPacking);
      if (res.data.ok) {
        setOpenCreatePacking(false);
        setNewPacking({ orden_compra_id: '', envio_id: '', notas: '' });
        loadData();
        // Navigate to detail
        navigate(`/packing-lists/${res.data.packing_list.id}`);
      }
    } catch (error) {
      alert('Error al crear packing list');
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const res = await api.post('/packaging/templates', newTemplate);
      if (res.data.ok) {
        setOpenCreateTemplate(false);
        setNewTemplate({
          nombre: '',
          tipo: 'caja',
          largo: '',
          ancho: '',
          alto: '',
          peso_max: '',
          unidad_medida: 'cm',
          material_empaque: '',
          costo_unitario: 0
        });
        loadData();
      }
    } catch (error) {
      alert('Error al crear template');
    }
  };

  const packingColumnDefs = [
    {
      field: 'numero',
      headerName: t('pack_numero', 'Número'),
      flex: 1,
      cellRenderer: (params) => (
        <Button
          size="small"
          onClick={() => navigate(`/packing-lists/${params.data.id}`)}
          sx={{ textTransform: 'none' }}
        >
          {params.value}
        </Button>
      )
    },
    {
      field: 'estado',
      headerName: t('common_estado', 'Estado'),
      flex: 0.8,
      cellRenderer: (params) => {
        const colors = {
          draft: 'default',
          empacado: 'primary',
          despachado: 'success'
        };
        return (
          <Chip
            label={t(`pack_estado_${params.value}`, params.value)}
            color={colors[params.value] || 'default'}
            size="small"
          />
        );
      }
    },
    {
      field: 'bultos_total',
      headerName: t('pack_bultos', 'Bultos'),
      flex: 0.6,
      type: 'numericColumn'
    },
    {
      field: 'peso_total',
      headerName: t('pack_peso_kg', 'Peso (kg)'),
      flex: 0.8,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ? params.value.toFixed(2) : '0.00'
    },
    {
      field: 'orden_compra_id',
      headerName: t('pack_oc', 'OC'),
      flex: 0.8
    },
    {
      field: 'created_at',
      headerName: t('common_creado', 'Creado'),
      flex: 1,
      valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : ''
    }
  ];

  const templateColumnDefs = [
    { field: 'nombre', headerName: t('pack_nombre', 'Nombre'), flex: 1 },
    {
      field: 'tipo',
      headerName: t('pack_tipo', 'Tipo'),
      flex: 0.8,
      cellRenderer: (params) => (
        <Chip label={t(`pack_tipo_${params.value}`, params.value)} size="small" />
      )
    },
    {
      field: 'dimensiones',
      headerName: t('pack_dimensiones', 'Dimensiones'),
      flex: 1.2,
      valueGetter: (params) => {
        const { largo, ancho, alto, unidad_medida } = params.data;
        return largo && ancho && alto
          ? `${largo} × ${ancho} × ${alto} ${unidad_medida}`
          : 'N/A';
      }
    },
    {
      field: 'peso_max',
      headerName: t('pack_peso_max', 'Peso Máx (kg)'),
      flex: 0.8,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ? params.value.toFixed(2) : 'N/A'
    },
    {
      field: 'costo_unitario',
      headerName: t('pack_costo', 'Costo'),
      flex: 0.8,
      type: 'numericColumn',
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`
    },
    {
      field: 'estado',
      headerName: t('common_estado', 'Estado'),
      flex: 0.7,
      cellRenderer: (params) => (
        <Chip
          label={t(`pack_estado_${params.value}`, params.value)}
          color={params.value === 'active' ? 'success' : 'default'}
          size="small"
        />
      )
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('pack_title', 'Packing Lists')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={t('common_refresh', 'Actualizar')}>
            <IconButton onClick={loadData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenCreatePacking(true)}
          >
            {t('pack_create', 'Crear Packing List')}
          </Button>
        </Box>
      </Box>

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PackageIcon color="primary" />
                <Box>
                  <Typography variant="h5">{kpis.packing_lists_activos}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('pack_kpi_activos', 'Activos')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShippingIcon color="success" />
                <Box>
                  <Typography variant="h5">{kpis.bultos_mes}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('pack_kpi_bultos_mes', 'Bultos este mes')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LabelIcon color="info" />
                <Box>
                  <Typography variant="h5">{kpis.etiquetas_generadas}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('pack_kpi_etiquetas', 'Etiquetas generadas')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PackageIcon color="warning" />
                <Box>
                  <Typography variant="h5">{kpis.peso_despachado_mes_kg.toFixed(1)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('pack_kpi_peso_mes', 'kg despachados')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={t('pack_tab_lists', 'Packing Lists')} />
          <Tab label={t('pack_tab_templates', 'Templates')} />
        </Tabs>

        {/* Tab 0: Packing Lists */}
        {tabValue === 0 && (
          <CardContent>
            <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
              <TextField
                select
                label={t('pack_filter_estado', 'Estado')}
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
                size="small"
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="all">{t('common_todos', 'Todos')}</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="empacado">Empacado</MenuItem>
                <MenuItem value="despachado">Despachado</MenuItem>
              </TextField>
            </Box>

            <SPMAgGrid
              rowData={packingLists}
              columnDefs={packingColumnDefs}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true
              }}
              height={500}
              pagination
              paginationPageSize={20}
              loading={loading}
              exportFileName="packing-lists"
            />
          </CardContent>
        )}

        {/* Tab 1: Templates */}
        {tabValue === 1 && (
          <CardContent>
            <Box sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setOpenCreateTemplate(true)}
              >
                {t('pack_create_template', 'Crear Template')}
              </Button>
            </Box>

            <SPMAgGrid
              rowData={templates}
              columnDefs={templateColumnDefs}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true
              }}
              height={500}
              pagination
              paginationPageSize={20}
              loading={loading}
              exportFileName="packing-templates"
            />
          </CardContent>
        )}
      </Card>

      {/* Create Packing List Dialog */}
      <Dialog open={openCreatePacking} onClose={() => setOpenCreatePacking(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('pack_create', 'Crear Packing List')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label={t('pack_oc_id', 'Orden de Compra ID')}
              type="number"
              value={newPacking.orden_compra_id}
              onChange={(e) => setNewPacking({ ...newPacking, orden_compra_id: e.target.value })}
              fullWidth
            />
            <TextField
              label={t('pack_envio_id', 'Envío ID')}
              type="number"
              value={newPacking.envio_id}
              onChange={(e) => setNewPacking({ ...newPacking, envio_id: e.target.value })}
              fullWidth
            />
            <TextField
              label={t('pack_notas', 'Notas')}
              value={newPacking.notas}
              onChange={(e) => setNewPacking({ ...newPacking, notas: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreatePacking(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleCreatePacking} variant="contained">
            {t('common_create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog open={openCreateTemplate} onClose={() => setOpenCreateTemplate(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('pack_create_template', 'Crear Template')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label={t('pack_nombre', 'Nombre')}
              value={newTemplate.nombre}
              onChange={(e) => setNewTemplate({ ...newTemplate, nombre: e.target.value })}
              required
              fullWidth
            />
            <TextField
              select
              label={t('pack_tipo', 'Tipo')}
              value={newTemplate.tipo}
              onChange={(e) => setNewTemplate({ ...newTemplate, tipo: e.target.value })}
              fullWidth
            >
              <MenuItem value="caja">Caja</MenuItem>
              <MenuItem value="pallet">Pallet</MenuItem>
              <MenuItem value="contenedor">Contenedor</MenuItem>
            </TextField>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <TextField
                  label={t('pack_largo', 'Largo')}
                  type="number"
                  value={newTemplate.largo}
                  onChange={(e) => setNewTemplate({ ...newTemplate, largo: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label={t('pack_ancho', 'Ancho')}
                  type="number"
                  value={newTemplate.ancho}
                  onChange={(e) => setNewTemplate({ ...newTemplate, ancho: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label={t('pack_alto', 'Alto')}
                  type="number"
                  value={newTemplate.alto}
                  onChange={(e) => setNewTemplate({ ...newTemplate, alto: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  select
                  label={t('pack_unidad', 'Unidad')}
                  value={newTemplate.unidad_medida}
                  onChange={(e) => setNewTemplate({ ...newTemplate, unidad_medida: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="cm">cm</MenuItem>
                  <MenuItem value="in">in</MenuItem>
                </TextField>
              </Grid>
            </Grid>

            <TextField
              label={t('pack_peso_max', 'Peso Máximo (kg)')}
              type="number"
              value={newTemplate.peso_max}
              onChange={(e) => setNewTemplate({ ...newTemplate, peso_max: e.target.value })}
              fullWidth
            />
            <TextField
              label={t('pack_material', 'Material de Empaque')}
              value={newTemplate.material_empaque}
              onChange={(e) => setNewTemplate({ ...newTemplate, material_empaque: e.target.value })}
              fullWidth
            />
            <TextField
              label={t('pack_costo', 'Costo Unitario')}
              type="number"
              value={newTemplate.costo_unitario}
              onChange={(e) => setNewTemplate({ ...newTemplate, costo_unitario: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateTemplate(false)}>{t('common_cancel', 'Cancelar')}</Button>
          <Button onClick={handleCreateTemplate} variant="contained">
            {t('common_create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PackingLists;
