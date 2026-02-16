import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  IconButton,
  Tooltip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import api from '../services/api';
import { useI18n } from '../context/i18n';

const KanbanConfig = () => {
  const { t } = useI18n();
  const [tabIndex, setTabIndex] = useState(0);
  const [tableros, setTableros] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [selectedTablero, setSelectedTablero] = useState(null);
  const [openTableroDialog, setOpenTableroDialog] = useState(false);
  const [openTarjetaDialog, setOpenTarjetaDialog] = useState(false);
  const [tableroForm, setTableroForm] = useState({
    nombre: '',
    almacen_id: '',
    centro_id: '',
    descripcion: ''
  });
  const [tarjetaForm, setTarjetaForm] = useState({
    material_codigo: '',
    tipo: 'proveedor',
    cantidad_contenedor: '',
    punto_reorden: 1,
    lead_time_horas: '',
    ubicacion_supermarket: '',
    proveedor_cuit: ''
  });
  const [editingTarjeta, setEditingTarjeta] = useState(null);

  const fetchTableros = useCallback(async () => {
    try {
      const res = await api.get('/api/kanban/boards');
      setTableros(res.data);
      if (res.data.length > 0 && !selectedTablero) {
        setSelectedTablero(res.data[0].id);
      }
    } catch (error) {
    }
  }, [selectedTablero]);

  const fetchTarjetas = useCallback(async () => {
    if (!selectedTablero) return;
    try {
      const res = await api.get(`/api/kanban/boards/${selectedTablero}`);
      setTarjetas(res.data.tarjetas || []);
    } catch (error) {
    }
  }, [selectedTablero]);

  useEffect(() => {
    fetchTableros();
  }, []);

  useEffect(() => {
    if (tabIndex === 1) {
      fetchTarjetas();
    }
  }, [tabIndex, selectedTablero]);

  const handleCreateTablero = async () => {
    try {
      await api.post('/api/kanban/boards', tableroForm);
      setOpenTableroDialog(false);
      setTableroForm({ nombre: '', almacen_id: '', centro_id: '', descripcion: '' });
      fetchTableros();
    } catch (error) {
      alert(t('kanban_error_create_board', 'Error al crear tablero'));
    }
  };

  const handleCreateTarjeta = async () => {
    try {
      await api.post(`/api/kanban/boards/${selectedTablero}/cards`, tarjetaForm);
      setOpenTarjetaDialog(false);
      setTarjetaForm({
        material_codigo: '',
        tipo: 'proveedor',
        cantidad_contenedor: '',
        punto_reorden: 1,
        lead_time_horas: '',
        ubicacion_supermarket: '',
        proveedor_cuit: ''
      });
      fetchTarjetas();
    } catch (error) {
      alert(t('kanban_error_create_card', 'Error al crear tarjeta'));
    }
  };

  const handleUpdateTarjeta = async () => {
    try {
      const updateData = {
        cantidad_contenedor: parseFloat(tarjetaForm.cantidad_contenedor),
        punto_reorden: parseInt(tarjetaForm.punto_reorden),
        lead_time_horas: parseInt(tarjetaForm.lead_time_horas),
        ubicacion_supermarket: tarjetaForm.ubicacion_supermarket,
        proveedor_cuit: tarjetaForm.proveedor_cuit
      };
      await api.put(`/api/kanban/cards/${editingTarjeta}`, updateData);
      setOpenTarjetaDialog(false);
      setEditingTarjeta(null);
      setTarjetaForm({
        material_codigo: '',
        tipo: 'proveedor',
        cantidad_contenedor: '',
        punto_reorden: 1,
        lead_time_horas: '',
        ubicacion_supermarket: '',
        proveedor_cuit: ''
      });
      fetchTarjetas();
    } catch (error) {
      alert(t('kanban_error_update_card', 'Error al actualizar tarjeta'));
    }
  };

  const handleEditTarjeta = (tarjeta) => {
    setEditingTarjeta(tarjeta.id);
    setTarjetaForm({
      material_codigo: tarjeta.material_codigo,
      tipo: tarjeta.tipo,
      cantidad_contenedor: tarjeta.cantidad_contenedor,
      punto_reorden: tarjeta.punto_reorden || 1,
      lead_time_horas: tarjeta.lead_time_horas || '',
      ubicacion_supermarket: tarjeta.ubicacion_supermarket || '',
      proveedor_cuit: tarjeta.proveedor_cuit || ''
    });
    setOpenTarjetaDialog(true);
  };

  const tablerosColumns = [
    {
      headerName: t('kanban_nombre', 'Nombre'),
      field: 'nombre',
      flex: 1
    },
    {
      headerName: t('kanban_centro', 'Centro'),
      field: 'centro_id',
      flex: 1
    },
    {
      headerName: t('kanban_almacen', 'Almacén'),
      field: 'almacen_id',
      flex: 1
    },
    {
      headerName: t('kanban_estado', 'Estado'),
      field: 'estado',
      flex: 1
    },
    {
      headerName: t('kanban_descripcion', 'Descripción'),
      field: 'descripcion',
      flex: 2
    }
  ];

  const tarjetasColumns = [
    {
      headerName: t('kanban_material', 'Material'),
      field: 'material_codigo',
      flex: 1
    },
    {
      headerName: t('kanban_tipo', 'Tipo'),
      field: 'tipo',
      flex: 1
    },
    {
      headerName: t('kanban_cantidad_contenedor', 'Cantidad Contenedor'),
      field: 'cantidad_contenedor',
      flex: 1
    },
    {
      headerName: t('kanban_punto_reorden', 'Punto Reorden'),
      field: 'punto_reorden',
      flex: 1
    },
    {
      headerName: t('kanban_lead_time', 'Lead Time (hrs)'),
      field: 'lead_time_horas',
      flex: 1
    },
    {
      headerName: t('kanban_ubicacion', 'Ubicación'),
      field: 'ubicacion_supermarket',
      flex: 1
    },
    {
      headerName: t('kanban_proveedor', 'Proveedor'),
      field: 'proveedor_cuit',
      flex: 1
    },
    {
      headerName: t('kanban_ciclos', 'Ciclos'),
      field: 'ciclos_totales',
      flex: 1
    },
    {
      headerName: t('common_actions', 'Acciones'),
      field: 'id',
      flex: 1,
      cellRenderer: (params) => (
        <Box>
          <Tooltip title={t('common_edit', 'Editar')}>
            <IconButton size="small" onClick={() => handleEditTarjeta(params.data)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          {t('kanban_config_titulo', 'Configuración Kanban')}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Tabs value={tabIndex} onChange={(e, newValue) => setTabIndex(newValue)}>
            <Tab label={t('kanban_tableros', 'Tableros')} />
            <Tab label={t('kanban_tarjetas', 'Tarjetas')} />
          </Tabs>

          {/* Tab 0: Tableros */}
          {tabIndex === 0 && (
            <Box mt={3}>
              <Box display="flex" justifyContent="flex-end" mb={2}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenTableroDialog(true)}
                >
                  {t('kanban_crear_tablero', 'Crear Tablero')}
                </Button>
              </Box>
              <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
                <AgGridReact
                  rowData={tableros}
                  columnDefs={tablerosColumns}
                  defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true
                  }}
                  pagination={true}
                  paginationPageSize={20}
                />
              </div>
            </Box>
          )}

          {/* Tab 1: Tarjetas */}
          {tabIndex === 1 && (
            <Box mt={3}>
              <FormControl fullWidth sx={{ mb: 2 }}>
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
              <Box display="flex" justifyContent="flex-end" mb={2}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingTarjeta(null);
                    setOpenTarjetaDialog(true);
                  }}
                  disabled={!selectedTablero}
                >
                  {t('kanban_crear_tarjeta', 'Crear Tarjeta')}
                </Button>
              </Box>
              <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
                <AgGridReact
                  rowData={tarjetas}
                  columnDefs={tarjetasColumns}
                  defaultColDef={{
                    sortable: true,
                    filter: true,
                    resizable: true
                  }}
                  pagination={true}
                  paginationPageSize={20}
                />
              </div>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Dialog Crear/Editar Tablero */}
      <Dialog
        open={openTableroDialog}
        onClose={() => setOpenTableroDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('kanban_crear_tablero', 'Crear Tablero')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('kanban_nombre', 'Nombre')}
                value={tableroForm.nombre}
                onChange={(e) => setTableroForm({ ...tableroForm, nombre: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('kanban_centro', 'Centro ID')}
                type="number"
                value={tableroForm.centro_id}
                onChange={(e) => setTableroForm({ ...tableroForm, centro_id: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('kanban_almacen', 'Almacén ID')}
                type="number"
                value={tableroForm.almacen_id}
                onChange={(e) => setTableroForm({ ...tableroForm, almacen_id: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('kanban_descripcion', 'Descripción')}
                value={tableroForm.descripcion}
                onChange={(e) => setTableroForm({ ...tableroForm, descripcion: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTableroDialog(false)}>
            {t('common_cancel', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateTablero}
            disabled={!tableroForm.nombre}
          >
            {t('common_create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Crear/Editar Tarjeta */}
      <Dialog
        open={openTarjetaDialog}
        onClose={() => {
          setOpenTarjetaDialog(false);
          setEditingTarjeta(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingTarjeta
            ? t('kanban_editar_tarjeta', 'Editar Tarjeta')
            : t('kanban_crear_tarjeta', 'Crear Tarjeta')}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('kanban_material', 'Código Material')}
                value={tarjetaForm.material_codigo}
                onChange={(e) => setTarjetaForm({ ...tarjetaForm, material_codigo: e.target.value })}
                required
                disabled={!!editingTarjeta}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required disabled={!!editingTarjeta}>
                <InputLabel>{t('kanban_tipo', 'Tipo')}</InputLabel>
                <Select
                  value={tarjetaForm.tipo}
                  onChange={(e) => setTarjetaForm({ ...tarjetaForm, tipo: e.target.value })}
                  label={t('kanban_tipo', 'Tipo')}
                >
                  <MenuItem value="produccion">{t('kanban_tipo_produccion', 'Producción')}</MenuItem>
                  <MenuItem value="transporte">{t('kanban_tipo_transporte', 'Transporte')}</MenuItem>
                  <MenuItem value="proveedor">{t('kanban_tipo_proveedor', 'Proveedor')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('kanban_cantidad_contenedor', 'Cantidad Contenedor')}
                type="number"
                value={tarjetaForm.cantidad_contenedor}
                onChange={(e) => setTarjetaForm({ ...tarjetaForm, cantidad_contenedor: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('kanban_punto_reorden', 'Punto Reorden')}
                type="number"
                value={tarjetaForm.punto_reorden}
                onChange={(e) => setTarjetaForm({ ...tarjetaForm, punto_reorden: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('kanban_lead_time', 'Lead Time (horas)')}
                type="number"
                value={tarjetaForm.lead_time_horas}
                onChange={(e) => setTarjetaForm({ ...tarjetaForm, lead_time_horas: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('kanban_ubicacion', 'Ubicación Supermarket')}
                value={tarjetaForm.ubicacion_supermarket}
                onChange={(e) => setTarjetaForm({ ...tarjetaForm, ubicacion_supermarket: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('kanban_proveedor', 'Proveedor CUIT')}
                value={tarjetaForm.proveedor_cuit}
                onChange={(e) => setTarjetaForm({ ...tarjetaForm, proveedor_cuit: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenTarjetaDialog(false);
              setEditingTarjeta(null);
            }}
          >
            {t('common_cancel', 'Cancelar')}
          </Button>
          <Button
            variant="contained"
            onClick={editingTarjeta ? handleUpdateTarjeta : handleCreateTarjeta}
            disabled={!tarjetaForm.material_codigo || !tarjetaForm.tipo || !tarjetaForm.cantidad_contenedor}
          >
            {editingTarjeta ? t('common_save', 'Guardar') : t('common_create', 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KanbanConfig;
